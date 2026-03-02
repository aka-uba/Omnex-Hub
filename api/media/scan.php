<?php
/**
 * Media Scan API - Secure scan/import under storage only
 */

require_once __DIR__ . '/_thumbnail_utils.php';

error_reporting(0);
ob_start();

try {
    $db = Database::getInstance();
    $user = Auth::user();

    if (!$user) {
        Response::unauthorized('Oturum gerekli');
        return;
    }

    $userRole = $user['role'] ?? 'Viewer';
    $isSuperAdmin = $userRole === 'SuperAdmin';
    $isAdmin = in_array($userRole, ['SuperAdmin', 'Admin'], true);

    if (!$isAdmin) {
        Response::forbidden('Bu islem icin yonetici yetkisi gerekli');
        return;
    }

    $companyId = Auth::getActiveCompanyId();
    if (!$companyId && !$isSuperAdmin) {
        Response::error('Company ID gerekli', 400);
        return;
    }

    $data = $request->body();
    $inputPath = trim((string)($data['path'] ?? ''));
    if ($inputPath === '') {
        Response::error('Dizin yolu gerekli', 400);
        return;
    }

    $storagePath = defined('STORAGE_PATH')
        ? STORAGE_PATH
        : dirname(dirname(__DIR__)) . DIRECTORY_SEPARATOR . 'storage';
    $storagePath = realpath($storagePath);

    if (!$storagePath || !is_dir($storagePath)) {
        Response::error('Storage dizini bulunamadi', 500);
        return;
    }

    $normalizePath = static function (string $path): string {
        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        return rtrim($path, DIRECTORY_SEPARATOR);
    };
    $startsWithPath = static function (string $path, string $base) use ($normalizePath): bool {
        $path = strtolower($normalizePath($path));
        $base = strtolower($normalizePath($base));
        return $path === $base || strpos($path, $base . DIRECTORY_SEPARATOR) === 0;
    };
    $normalizeFolderPath = static function (string $path) use ($storagePath): string {
        $path = str_replace('\\', '/', trim($path));
        // Ensure UTF-8 encoding for consistent comparison
        if (!mb_check_encoding($path, 'UTF-8')) {
            $path = @mb_convert_encoding($path, 'UTF-8', 'ISO-8859-9') ?: $path;
        }
        // Strip absolute storage prefix to get relative path for comparison
        $normalizedStorage = str_replace('\\', '/', $storagePath);
        if (stripos($path, $normalizedStorage . '/') === 0) {
            $path = substr($path, strlen($normalizedStorage) + 1);
        }
        return strtolower(rtrim($path, '/'));
    };

    $inputPath = str_replace(['..', "\0"], '', $inputPath);
    $inputPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $inputPath);
    $inputPath = preg_replace('/^storage[\/\\\\]?/i', '', $inputPath);
    $inputPath = ltrim($inputPath, DIRECTORY_SEPARATOR);

    $isAbsolute = (bool)preg_match('/^[A-Za-z]:[\/\\\\]/', $inputPath) || str_starts_with($inputPath, DIRECTORY_SEPARATOR);

    if ($isAbsolute) {
        $scanPath = realpath($inputPath);
    } else {
        $scanPath = realpath($storagePath . DIRECTORY_SEPARATOR . $inputPath);
    }

    if (!$scanPath || !$startsWithPath($scanPath, $storagePath)) {
        Response::error('Erisim reddedildi - sadece storage dizini taranabilir', 403);
        return;
    }

    if (!is_dir($scanPath)) {
        Response::error('Dizin bulunamadi', 404);
        return;
    }

    $relativeScanPath = '';
    if ($normalizePath($scanPath) !== $normalizePath($storagePath)) {
        $relativeScanPath = substr($normalizePath($scanPath), strlen($normalizePath($storagePath)) + 1);
        $relativeScanPath = str_replace('\\', '/', $relativeScanPath);
    }

    // Access policy:
    // - SuperAdmin: any storage path
    // - Admin: only own company path or public/samples
    $isPublicSamples = ($relativeScanPath === 'public/samples' || str_starts_with($relativeScanPath, 'public/samples/'));
    $pathCompanyId = null;
    if (preg_match('/^companies\/([^\/]+)(\/|$)/', $relativeScanPath, $matches)) {
        $pathCompanyId = $matches[1];
    }

    if (!$isSuperAdmin) {
        $allowed = false;
        if ($isPublicSamples) {
            $allowed = true;
        } elseif ($pathCompanyId && $companyId && $pathCompanyId === $companyId) {
            $allowed = true;
        }

        if (!$allowed) {
            Response::error('Bu dizini tarama yetkiniz yok', 403);
            return;
        }
    }

    $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    $videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    $documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
    $allExtensions = array_merge($imageExtensions, $videoExtensions, $documentExtensions);

    // Ensure filename is valid UTF-8 (Linux filesystem may return non-UTF-8 bytes)
    $ensureUtf8 = static function (string $str): string {
        if (mb_check_encoding($str, 'UTF-8')) {
            return $str;
        }
        // Try common encodings
        $converted = @mb_convert_encoding($str, 'UTF-8', 'ISO-8859-9');
        if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
            return $converted;
        }
        $converted = @mb_convert_encoding($str, 'UTF-8', 'Windows-1254');
        if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
            return $converted;
        }
        return $str;
    };

    $scanDir = function ($dir, &$files) use (&$scanDir, $allExtensions, $ensureUtf8) {
        $items = @scandir($dir);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item === '.gitkeep' || $item === '.htaccess') {
                continue;
            }

            // The raw $item from scandir is what the OS returns - use it for file access
            $fullPath = $dir . DIRECTORY_SEPARATOR . $item;

            // But for DB storage, ensure the name is valid UTF-8
            $itemUtf8 = $ensureUtf8($item);

            if (is_dir($fullPath)) {
                $scanDir($fullPath, $files);
                continue;
            }

            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (!in_array($ext, $allExtensions, true)) {
                continue;
            }

            $files[] = [
                'name' => $itemUtf8,
                'path' => $fullPath,
                'extension' => $ext,
                'size' => @filesize($fullPath) ?: 0
            ];
        }
    };

    $files = [];
    $scanDir($scanPath, $files);

    $imported = 0;
    $skipped = 0;
    $videoThumbnailsGenerated = 0;
    $errors = [];
    $publicFolderPathMap = [];
    $publicFolderRows = $db->fetchAll("SELECT id, path FROM media_folders WHERE company_id IS NULL");
    foreach ($publicFolderRows as $folderRow) {
        $normalizedPathKey = $normalizeFolderPath((string)($folderRow['path'] ?? ''));
        if ($normalizedPathKey !== '' && !isset($publicFolderPathMap[$normalizedPathKey])) {
            $publicFolderPathMap[$normalizedPathKey] = $folderRow['id'];
        }
    }

    foreach ($files as $file) {
        try {
            $normalizedFullPath = $normalizePath($file['path']);
            if (!$startsWithPath($normalizedFullPath, $storagePath)) {
                $errors[] = $file['name'] . ': storage disi dosya atlandi';
                continue;
            }

            $relativeFilePath = substr($normalizedFullPath, strlen($normalizePath($storagePath)) + 1);
            $relativeFilePath = str_replace('\\', '/', $relativeFilePath);
            // Ensure relative path is valid UTF-8 (Linux may return non-UTF-8 bytes for Turkish chars)
            if (!mb_check_encoding($relativeFilePath, 'UTF-8')) {
                $relativeFilePath = @mb_convert_encoding($relativeFilePath, 'UTF-8', 'ISO-8859-9') ?: $relativeFilePath;
            }
            $absoluteFilePath = $file['path'];

            $isPublicSample = ($relativeFilePath === 'public/samples' || str_starts_with($relativeFilePath, 'public/samples/'));
            $publicMediaFilter = $db->isPostgres() ? 'company_id IS NULL OR is_public IS TRUE' : 'company_id IS NULL OR is_public = 1';

            if ($isPublicSample) {
                $existing = $db->fetch(
                    "SELECT id FROM media
                     WHERE (file_path = ? OR file_path = ?)
                     AND ($publicMediaFilter)
                     LIMIT 1",
                    [$relativeFilePath, $absoluteFilePath]
                );
            } else {
                $existing = $db->fetch(
                    "SELECT id FROM media
                     WHERE (file_path = ? OR file_path = ?)
                     AND company_id = ?
                     LIMIT 1",
                    [$relativeFilePath, $absoluteFilePath, $companyId]
                );
            }

            if ($existing) {
                $skipped++;
                continue;
            }

            $type = 'document';
            if (in_array($file['extension'], $imageExtensions, true)) {
                $type = 'image';
            } elseif (in_array($file['extension'], $videoExtensions, true)) {
                $type = 'video';
            }

            $mimeType = @mime_content_type($absoluteFilePath) ?: 'application/octet-stream';

            $folderId = null;
            if ($isPublicSample) {
                // Use relative paths for folder storage (cross-platform compatible)
                $publicSamplesRelativePath = 'public/samples';
                $publicSamplesPathKey = $normalizeFolderPath($publicSamplesRelativePath);

                $parentFolderId = null;
                if (isset($publicFolderPathMap[$publicSamplesPathKey])) {
                    $parentFolderId = $publicFolderPathMap[$publicSamplesPathKey];
                } else {
                    $parentFolderId = $db->generateUuid();
                    try {
                        $db->insert('media_folders', [
                            'id' => $parentFolderId,
                            'company_id' => null,
                            'parent_id' => null,
                            'name' => 'Ortak Kutuphane',
                            'path' => $publicSamplesRelativePath,
                            'created_at' => date('Y-m-d H:i:s'),
                            'updated_at' => date('Y-m-d H:i:s')
                        ]);
                        $publicFolderPathMap[$publicSamplesPathKey] = $parentFolderId;
                    } catch (Exception $e) {
                        $publicFolderRows = $db->fetchAll("SELECT id, path FROM media_folders WHERE company_id IS NULL");
                        foreach ($publicFolderRows as $folderRow) {
                            if ($normalizeFolderPath((string)($folderRow['path'] ?? '')) === $publicSamplesPathKey) {
                                $parentFolderId = $folderRow['id'];
                                $publicFolderPathMap[$publicSamplesPathKey] = $parentFolderId;
                                break;
                            }
                        }
                    }
                }

                $relativeInsideSamples = substr($relativeFilePath, strlen('public/samples') + 1);
                $pathParts = explode('/', $relativeInsideSamples);

                if (count($pathParts) > 1) {
                    $subfolderName = $pathParts[0];
                    $subfolderRelativePath = $publicSamplesRelativePath . '/' . $subfolderName;
                    $subfolderPathKey = $normalizeFolderPath($subfolderRelativePath);

                    if (isset($publicFolderPathMap[$subfolderPathKey])) {
                        $folderId = $publicFolderPathMap[$subfolderPathKey];
                    } else {
                        $folderId = $db->generateUuid();
                        try {
                            $db->insert('media_folders', [
                                'id' => $folderId,
                                'company_id' => null,
                                'parent_id' => $parentFolderId,
                                'name' => $subfolderName,
                                'path' => $subfolderRelativePath,
                                'created_at' => date('Y-m-d H:i:s'),
                                'updated_at' => date('Y-m-d H:i:s')
                            ]);
                            $publicFolderPathMap[$subfolderPathKey] = $folderId;
                        } catch (Exception $e) {
                            $publicFolderRows = $db->fetchAll("SELECT id, path FROM media_folders WHERE company_id IS NULL");
                            foreach ($publicFolderRows as $folderRow) {
                                if ($normalizeFolderPath((string)($folderRow['path'] ?? '')) === $subfolderPathKey) {
                                    $folderId = $folderRow['id'];
                                    $publicFolderPathMap[$subfolderPathKey] = $folderId;
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    $folderId = $parentFolderId;
                }
            }

            $id = $db->generateUuid();
            $insertData = [
                'id' => $id,
                'company_id' => $isPublicSample ? null : $companyId,
                'name' => pathinfo($file['name'], PATHINFO_FILENAME),
                'original_name' => $file['name'],
                'file_path' => $relativeFilePath,
                'file_type' => $type,
                'mime_type' => $mimeType,
                'file_size' => $file['size'],
                'folder_id' => $folderId,
                'source' => 'api',
                'status' => 'active',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];

            if ($isPublicSample) {
                $insertData['is_public'] = 1;
                $insertData['scope'] = 'public';
            }

            $db->insert('media', $insertData);
            if ($type === 'video') {
                $thumbMedia = [
                    'id' => $id,
                    'file_type' => $type,
                    'file_path' => $relativeFilePath,
                    'mime_type' => $mimeType
                ];
                if (@media_thumbnail_ensure($thumbMedia, 200)) {
                    $videoThumbnailsGenerated++;
                }
            }
            $imported++;
        } catch (Exception $e) {
            $errors[] = $file['name'] . ': ' . $e->getMessage();
        }
    }

    ob_end_clean();
    Response::success([
        'imported' => $imported,
        'skipped' => $skipped,
        'video_thumbnails_generated' => $videoThumbnailsGenerated,
        'total_found' => count($files),
        'errors' => $errors,
        'message' => "$imported dosya iceri aktarildi, $skipped dosya zaten mevcut, $videoThumbnailsGenerated video thumbnail uretildi"
    ]);
} catch (Exception $e) {
    ob_end_clean();
    Response::error('Tarama hatasi: ' . $e->getMessage(), 500);
}
