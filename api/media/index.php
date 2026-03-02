<?php
/**
 * Media List API - Optimized Version
 *
 * Performance optimizations:
 * - No real-time directory scanning (use /api/media/scan for that)
 * - Database-only queries
 * - Efficient pagination
 * - Thumbnail URL support
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Shared i18n key mapping for public folder names
require_once __DIR__ . '/_folder_i18n.php';
require_once __DIR__ . '/_thumbnail_utils.php';
$getFolderNameKey = 'getFolderNameKey'; // Use shared function from _folder_i18n.php

// Fallback for edge cases
if (!$companyId) {
    $firstCompany = $db->fetch("SELECT id FROM companies WHERE status = 'active' ORDER BY created_at LIMIT 1");
    if ($firstCompany) {
        $companyId = $firstCompany['id'];
    }
}

// Pagination
$page = (int)($request->query('page', 1));
$perPage = (int)($request->query('per_page', 50)); // Increased default for better UX
$offset = ($page - 1) * $perPage;

// Filters
$search = $request->query('search', '');
$type = $request->query('type', '');
$folderId = $request->query('folder_id', '');
$showScope = $request->query('scope', ''); // '', 'company', 'public', 'all'
$publicMediaCondition = $db->isPostgres()
    ? "(is_public IS TRUE OR scope = 'public')"
    : "(is_public = 1 OR scope = 'public')";
$publicMediaOrUnboundCondition = $db->isPostgres()
    ? "(is_public IS TRUE OR scope = 'public' OR company_id IS NULL)"
    : "(is_public = 1 OR scope = 'public' OR company_id IS NULL)";

// Build query
$where = [];
$params = [];
$storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(dirname(__DIR__)) . '/storage';
$normalizeFolderPath = static function ($path) use ($storagePath) {
    $path = str_replace('\\', '/', (string)$path);
    // Strip absolute storage prefix to get relative path for comparison
    $normalizedStorage = str_replace('\\', '/', $storagePath);
    if (stripos($path, $normalizedStorage . '/') === 0) {
        $path = substr($path, strlen($normalizedStorage) + 1);
    }
    return strtolower(rtrim($path, '/'));
};
$getEquivalentPublicFolderIds = static function ($path) use ($db, $normalizeFolderPath) {
    if (!$path) {
        return [];
    }

    $targetPath = $normalizeFolderPath($path);
    $rows = $db->fetchAll("SELECT id, path FROM media_folders WHERE company_id IS NULL");
    $ids = [];
    foreach ($rows as $row) {
        if ($normalizeFolderPath($row['path'] ?? '') === $targetPath) {
            $ids[] = $row['id'];
        }
    }

    return array_values(array_unique($ids));
};
$getPublicFolderByPath = static function ($path) use ($db, $normalizeFolderPath) {
    if (!$path) {
        return null;
    }

    $targetPath = $normalizeFolderPath($path);
    $rows = $db->fetchAll("SELECT id, path FROM media_folders WHERE company_id IS NULL");
    foreach ($rows as $row) {
        if ($normalizeFolderPath($row['path'] ?? '') === $targetPath) {
            return $row;
        }
    }

    return null;
};

// Company filter - show company media + public media
if ($showScope === 'public') {
    $where[] = $publicMediaCondition;
} elseif ($showScope === 'company') {
    if ($companyId) {
        $where[] = "company_id = ?";
        $params[] = $companyId;
    }
} else {
    // Default: show both company + public media
    if ($user['role'] !== 'SuperAdmin') {
        if ($companyId) {
            $where[] = "(company_id = ? OR $publicMediaCondition)";
            $params[] = $companyId;
        } else {
            $where[] = $publicMediaCondition;
        }
    } elseif ($companyId) {
        $where[] = "(company_id = ? OR $publicMediaCondition)";
        $params[] = $companyId;
    }
}

if ($search) {
    $where[] = "(name LIKE ? OR original_name LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($type) {
    $where[] = "file_type = ?";
    $params[] = $type;
}

// Folder filter
if ($folderId) {
    // Check if this is a public folder
    $targetFolder = $db->fetch("SELECT id, company_id, path FROM media_folders WHERE id = ?", [$folderId]);
    $isPublicFolder = ($targetFolder && $targetFolder['company_id'] === null);
    $targetFolderIds = [$folderId];

    if ($isPublicFolder) {
        $equivalentIds = $getEquivalentPublicFolderIds($targetFolder['path'] ?? '');
        if (!empty($equivalentIds)) {
            $targetFolderIds = $equivalentIds;
        }

        // For public folders, override the company filter - show only public media in this folder
        $where = array_filter($where, function($w) {
            return strpos($w, 'company_id') === false && strpos($w, 'is_public') === false && strpos($w, 'scope') === false;
        });
        // Re-index array
        $where = array_values($where);
        // Remove company_id param if it was added
        if (!empty($params) && isset($companyId) && $params[0] === $companyId) {
            array_shift($params);
        }
        // Add public media filter
        $where[] = $publicMediaOrUnboundCondition;
    }

    if (count($targetFolderIds) > 1) {
        $placeholders = implode(', ', array_fill(0, count($targetFolderIds), '?'));
        $where[] = "folder_id IN ($placeholders)";
        $params = array_merge($params, $targetFolderIds);
    } else {
        $where[] = "folder_id = ?";
        $params[] = $targetFolderIds[0];
    }
} elseif ($showScope === 'public') {
    // When scope=public without folder_id, return ALL public media from all folders
    // This is used by MediaPicker's "Ortak Kütüphane" tab
    // Don't apply folder_id IS NULL filter - we want all public files regardless of folder
} else {
    // Root level - show files without folder_id
    $where[] = "folder_id IS NULL";
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$total = $db->fetchColumn("SELECT COUNT(*) FROM media $whereClause", $params);

// Get media with pagination
$media = $db->fetchAll(
    "SELECT * FROM media $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

// Calculate base URL for media files
$basePath = '';
if (defined('BASE_PATH')) {
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
    $fsBasePath = str_replace('\\', '/', BASE_PATH);

    if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
        $basePath = substr($fsBasePath, strlen($docRoot));
        $basePath = rtrim($basePath, '/');
    }
}

// $storagePath already defined above for normalizeFolderPath
$normalizedStoragePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $storagePath);
$normalizedStoragePath = rtrim($normalizedStoragePath, DIRECTORY_SEPARATOR);

// Filter and format media
$validMedia = [];
$skipValidation = $request->query('skip_validation', '0') === '1';

foreach ($media as &$file) {
    $filePath = $file['file_path'] ?? '';

    // Skip if no path
    if (empty($filePath)) {
        continue;
    }

    // Determine full path
    $fullPath = null;
    if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath) || strpos($filePath, '\\\\') === 0 || $filePath[0] === '/') {
        $filePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
        $fullPath = $filePath;
    } else {
        $fullPath = $storagePath . DIRECTORY_SEPARATOR . $filePath;
    }

    // Check if file exists - skip validation for faster loading when requested
    // Files in DB are assumed to exist, validation can be done in background
    if (!$skipValidation && !is_file($fullPath)) {
        continue;
    }

    // Add virtual fields for frontend compatibility
    $file['path'] = $file['file_path'];
    $file['type'] = $file['file_type'];
    $file['size'] = $file['file_size'];
    $file['filename'] = basename($file['file_path']);

    // Mark public media as readonly
    $isPublicMedia = (($file['scope'] ?? '') === 'public' || !empty($file['is_public']));
    $file['is_readonly'] = $isPublicMedia && ($user['role'] !== 'SuperAdmin');
    $file['is_public'] = $isPublicMedia ? 1 : 0;

    // Generate URL
    $normalizedFilePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);

    if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath) || strpos($filePath, '\\\\') === 0 || $filePath[0] === '/') {
        if (strpos($normalizedFilePath, $normalizedStoragePath) === 0) {
            $relativePath = substr($normalizedFilePath, strlen($normalizedStoragePath) + 1);
            $relativePath = str_replace('\\', '/', $relativePath);
            $file['url'] = $basePath . '/storage/' . $relativePath;
        } else {
            $file['url'] = $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
        }
    } elseif (strpos($filePath, 'storage/') === 0) {
        $file['url'] = $basePath . '/' . ltrim($filePath, '/');
    } else {
        $file['url'] = $basePath . '/storage/' . ltrim($filePath, '/');
    }

    // Generate thumbnail URL (image + video)
    $thumbUrl = media_thumbnail_url($file, $basePath, 200);
    if ($thumbUrl) {
        $file['thumbnail_url'] = $thumbUrl;
    }

    $validMedia[] = $file;
}

// Get folders at same level
$folders = [];

// Get company folders - only when not showing public-only view
if ($companyId && $showScope !== 'public') {
    $folderWhere = $folderId
        ? "WHERE parent_id = ? AND company_id = ?"
        : "WHERE parent_id IS NULL AND company_id = ?";
    $folderParams = $folderId
        ? [$folderId, $companyId]
        : [$companyId];

    $folders = $db->fetchAll(
        "SELECT * FROM media_folders $folderWhere ORDER BY name ASC",
        $folderParams
    );
}

// Track if we already added public subfolders
$publicSubfoldersAdded = false;

// Get public folders (company_id IS NULL) when inside a public folder
if ($folderId) {
    $checkFolder = $db->fetch("SELECT id, company_id, path FROM media_folders WHERE id = ?", [$folderId]);
    if ($checkFolder && $checkFolder['company_id'] === null) {
        $parentIds = [$folderId];
        $equivalentParentIds = $getEquivalentPublicFolderIds($checkFolder['path'] ?? '');
        if (!empty($equivalentParentIds)) {
            $parentIds = $equivalentParentIds;
        }

        // We're inside a public folder, show its subfolders
        $placeholders = implode(', ', array_fill(0, count($parentIds), '?'));
        $publicFolders = $db->fetchAll(
            "SELECT * FROM media_folders WHERE parent_id IN ($placeholders) AND company_id IS NULL ORDER BY name ASC",
            $parentIds
        );
        $seenPublicFolderPaths = [];
        foreach ($publicFolders as $pf) {
            $normalizedPublicPath = $normalizeFolderPath($pf['path'] ?? '');
            if ($normalizedPublicPath !== '' && isset($seenPublicFolderPaths[$normalizedPublicPath])) {
                continue;
            }
            $seenPublicFolderPaths[$normalizedPublicPath] = true;
            $pf['type'] = 'public';
            $pf['is_public'] = 1;
            $pf['isFolder'] = true;
            $pf['name_key'] = $getFolderNameKey($pf['path'] ?? null);
            $folders[] = $pf;
        }
        $publicSubfoldersAdded = true;
    }
}

// Add public media folders if showing public media
if ($showScope !== 'company') {
    $samplesPath = $storagePath . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'samples';
    $samplesRelativePath = 'public/samples';

    if (!$folderId) {
        // At root level, show "Ortak Kütüphane" folder
        if (is_dir($samplesPath)) {
            // Search using relative path (normalizeFolderPath strips absolute prefix)
            $existingFolder = $getPublicFolderByPath($samplesRelativePath);

            $folderId_db = null;
            if (!$existingFolder) {
                $folderId_db = $db->generateUuid();
                try {
                    $db->insert('media_folders', [
                        'id' => $folderId_db,
                        'company_id' => null,
                        'parent_id' => null,
                        'name' => 'Ortak Kütüphane',
                        'path' => $samplesRelativePath,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                } catch (Exception $e) {
                    $existingFolder = $getPublicFolderByPath($samplesRelativePath);
                    if ($existingFolder) {
                        $folderId_db = $existingFolder['id'];
                    }
                }
            } else {
                $folderId_db = $existingFolder['id'];
            }

            if ($folderId_db) {
                $folders[] = [
                    'id' => $folderId_db,
                    'folder_id' => $folderId_db,
                    'company_id' => null,
                    'parent_id' => null,
                    'name' => 'Ortak Kütüphane',
                    'name_key' => 'mediaLibrary.folders.publicLibrary',
                    'path' => $samplesRelativePath,
                    'type' => 'public',
                    'is_public' => 1,
                    'isFolder' => true
                ];
            }
        }
    }
    // Note: Public subfolders are already added above when inside a public folder
}

// Deduplicate public folders by normalized path (legacy mixed-slash rows can duplicate)
if (!empty($folders)) {
    $dedupedFolders = [];
    $seenPublicPaths = [];
    foreach ($folders as $folder) {
        if (($folder['company_id'] ?? null) === null && !empty($folder['path'])) {
            $normalizedPath = $normalizeFolderPath($folder['path']);
            if ($normalizedPath !== '' && isset($seenPublicPaths[$normalizedPath])) {
                continue;
            }
            $seenPublicPaths[$normalizedPath] = true;
            $folder['path'] = str_replace('\\', '/', $folder['path']);
            // Add i18n key if not already set
            if (!isset($folder['name_key'])) {
                $folder['name_key'] = $getFolderNameKey($folder['path']);
            }
        }
        $dedupedFolders[] = $folder;
    }
    $folders = $dedupedFolders;
}

// Get current folder info for breadcrumb
$currentFolderInfo = null;
if ($folderId) {
    $currentFolderInfo = $db->fetch(
        "SELECT * FROM media_folders WHERE id = ?",
        [$folderId]
    );
    if ($currentFolderInfo) {
        $currentFolderInfo['path'] = str_replace('\\', '/', $currentFolderInfo['path']);
        // Add i18n name_key for translation support
        $currentFolderInfo['name_key'] = $getFolderNameKey($currentFolderInfo['path']);
    }
}

$responseData = [
    'folders' => $folders,
    'files' => $validMedia,
    'current_folder' => $currentFolderInfo,
    'meta' => [
        'total' => $total,
        'page' => $page,
        'current_page' => $page,
        'per_page' => $perPage,
        'total_pages' => ceil($total / $perPage)
    ]
];

Response::success($responseData);
