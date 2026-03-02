<?php
/**
 * Media Browse API - Secure directory browse under storage only
 */

error_reporting(0);
header('Content-Type: application/json');

try {
    $user = Auth::user();
    if (!$user) {
        Response::unauthorized('Oturum gerekli');
        return;
    }

    $companyId = Auth::getActiveCompanyId();
    $userRole = $user['role'] ?? 'Viewer';
    $isSuperAdmin = $userRole === 'SuperAdmin';
    $isAdmin = in_array($userRole, ['SuperAdmin', 'Admin'], true);

    // Shared i18n key mapping for public folder names
    require_once __DIR__ . '/_folder_i18n.php';
    $getFolderNameKey = 'getFolderNameKey'; // Use shared function from _folder_i18n.php

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

    $inputPath = str_replace(['..', "\0"], '', $inputPath);
    $inputPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $inputPath);
    $inputPath = preg_replace('/^storage[\/\\\\]?/i', '', $inputPath);
    $inputPath = ltrim($inputPath, DIRECTORY_SEPARATOR);

    $isAbsolute = (bool)preg_match('/^[A-Za-z]:[\/\\\\]/', $inputPath) || str_starts_with($inputPath, DIRECTORY_SEPARATOR);

    if ($isAbsolute) {
        $realPath = realpath($inputPath);
    } elseif ($inputPath === '' || $inputPath === '.') {
        $realPath = $storagePath;
    } else {
        $realPath = realpath($storagePath . DIRECTORY_SEPARATOR . $inputPath);
    }

    if (!$realPath || !$startsWithPath($realPath, $storagePath)) {
        Response::error('Erisim reddedildi - sadece storage dizini icerisinde gezinebilirsiniz', 403);
        return;
    }

    if (!is_dir($realPath)) {
        Response::error('Dizin bulunamadi', 404);
        return;
    }

    $relativePath = '';
    if ($normalizePath($realPath) !== $normalizePath($storagePath)) {
        $relativePath = substr($normalizePath($realPath), strlen($normalizePath($storagePath)) + 1);
        $relativePath = str_replace('\\', '/', $relativePath);
    }

    $accessAllowed = false;

    if ($relativePath === '') {
        $accessAllowed = true;
    } elseif ($relativePath === 'public' || str_starts_with($relativePath, 'public/')) {
        $accessAllowed = true;
    } elseif ($relativePath === 'avatars' || str_starts_with($relativePath, 'avatars/')) {
        $accessAllowed = true;
    } elseif ($relativePath === 'defaults' || str_starts_with($relativePath, 'defaults/')) {
        $accessAllowed = true;
    } elseif ($relativePath === 'companies' || str_starts_with($relativePath, 'companies/')) {
        if ($relativePath === 'companies') {
            $accessAllowed = $isSuperAdmin;
        } elseif (preg_match('/^companies\/([^\/]+)(\/|$)/', $relativePath, $matches)) {
            $pathCompanyId = $matches[1];
            $accessAllowed = $isSuperAdmin || (!empty($companyId) && $companyId === $pathCompanyId);
        }
    } elseif ($relativePath === 'system' || str_starts_with($relativePath, 'system/')) {
        $accessAllowed = $isAdmin;
    } elseif (
        $relativePath === 'media' || str_starts_with($relativePath, 'media/') ||
        $relativePath === 'renders' || str_starts_with($relativePath, 'renders/') ||
        $relativePath === 'templates' || str_starts_with($relativePath, 'templates/')
    ) {
        // Legacy storage areas: admin only.
        $accessAllowed = $isAdmin;
    }

    if (!$accessAllowed) {
        Response::error('Bu dizine erisim izniniz yok', 403);
        return;
    }

    $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    $videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    $documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
    $allExtensions = array_merge($imageExtensions, $videoExtensions, $documentExtensions);

    $files = [];
    $folders = [];
    $items = @scandir($realPath);

    if ($items === false) {
        Response::error('Dizin okunamadi', 500);
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || $item === '.gitkeep' || $item === '.htaccess') {
            continue;
        }

        $fullPath = $realPath . DIRECTORY_SEPARATOR . $item;
        $itemRelativePath = $relativePath !== '' ? ($relativePath . '/' . $item) : $item;
        $itemRelativePath = str_replace('\\', '/', $itemRelativePath);

        if (is_dir($fullPath)) {
            $showFolder = true;

            if ($relativePath === '') {
                $allowedRootDirs = ['public', 'avatars', 'defaults'];
                if ($companyId) {
                    $allowedRootDirs[] = 'companies';
                }
                if ($isAdmin) {
                    $allowedRootDirs[] = 'system';
                    $allowedRootDirs[] = 'media';
                    $allowedRootDirs[] = 'renders';
                    $allowedRootDirs[] = 'templates';
                }
                $showFolder = in_array($item, $allowedRootDirs, true);
            } elseif ($relativePath === 'companies') {
                if ($isSuperAdmin) {
                    $showFolder = true;
                } elseif ($companyId && $item === $companyId) {
                    $showFolder = true;
                } else {
                    $showFolder = false;
                }
            }

            if ($showFolder) {
                $folderEntry = [
                    'id' => md5($itemRelativePath),
                    'name' => $item,
                    'path' => $itemRelativePath,
                    'type' => 'folder'
                ];
                // Add i18n name_key for public sample folders
                $nameKey = $getFolderNameKey($itemRelativePath);
                if ($nameKey) {
                    $folderEntry['name_key'] = $nameKey;
                }
                $folders[] = $folderEntry;
            }
            continue;
        }

        $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
        if (!in_array($ext, $allExtensions, true)) {
            continue;
        }

        $type = 'document';
        if (in_array($ext, $imageExtensions, true)) {
            $type = 'image';
        } elseif (in_array($ext, $videoExtensions, true)) {
            $type = 'video';
        }

        $files[] = [
            'id' => md5($itemRelativePath),
            'name' => pathinfo($item, PATHINFO_FILENAME),
            'original_name' => $item,
            'path' => $itemRelativePath,
            'file_path' => $itemRelativePath,
            'file_type' => $type,
            'file_size' => @filesize($fullPath) ?: 0,
            'extension' => $ext,
            'created_at' => date('Y-m-d H:i:s', @filemtime($fullPath) ?: time())
        ];
    }

    usort($folders, static fn($a, $b) => strcasecmp($a['name'], $b['name']));
    usort($files, static fn($a, $b) => strcasecmp($a['name'], $b['name']));

    $currentPath = $relativePath === '' ? 'storage' : ('storage/' . $relativePath);
    $parentRelative = '';
    if ($relativePath !== '') {
        $parentRelative = dirname($relativePath);
        if ($parentRelative === '.' || $parentRelative === DIRECTORY_SEPARATOR) {
            $parentRelative = '';
        }
    }
    $parentPath = $relativePath === '' ? null : ($parentRelative === '' ? 'storage' : ('storage/' . str_replace('\\', '/', $parentRelative)));

    Response::success([
        'folders' => $folders,
        'files' => $files,
        'current_path' => $currentPath,
        'parent_path' => $parentPath,
        'relative_path' => $relativePath,
        'company_id' => $companyId,
        'company_path' => $companyId ? ('storage/companies/' . $companyId) : null
    ]);
} catch (Exception $e) {
    Response::error('Dizin tarama hatasi: ' . $e->getMessage(), 500);
}
