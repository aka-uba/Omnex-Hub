<?php
/**
 * Media Diagnostics API - Admin only
 *
 * Diagnoses media file issues: missing files, path problems, storage info.
 *
 * GET  /api/media/fix-paths                - Full diagnostic report
 * GET  /api/media/fix-paths?scope=public   - Only public/shared files
 * POST /api/media/fix-paths?action=clean   - Remove DB entries for missing files
 * POST /api/media/fix-paths?action=rescan  - Re-scan storage/public/samples and import missing
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
    return;
}

$userRole = $user['role'] ?? 'Viewer';
if (!in_array($userRole, ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islem icin yonetici yetkisi gerekli');
    return;
}

$storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(dirname(__DIR__)) . '/storage';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($request ? $request->query('action', 'diagnose') : 'diagnose');
$filterScope = $_GET['scope'] ?? ($request ? $request->query('scope', '') : '');

// ─── Storage directory analysis ───
$publicSamplesPath = $storagePath . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'samples';
$directories = [
    'storage_path' => $storagePath,
    'storage_exists' => is_dir($storagePath),
    'storage_writable' => is_writable($storagePath),
    'public_exists' => is_dir($storagePath . '/public'),
    'public_samples_exists' => is_dir($publicSamplesPath),
    'php_os' => PHP_OS,
    'directory_separator' => DIRECTORY_SEPARATOR,
];

// Count actual files on disk in public/samples
$diskFileCount = 0;
$diskFiles = [];
if (is_dir($publicSamplesPath)) {
    $scanRecursive = function($dir) use (&$scanRecursive, &$diskFileCount, &$diskFiles, $storagePath) {
        $entries = @scandir($dir);
        if (!$entries) return;
        foreach ($entries as $e) {
            if ($e === '.' || $e === '..') continue;
            $full = $dir . DIRECTORY_SEPARATOR . $e;
            if (is_dir($full)) {
                $scanRecursive($full);
            } elseif (is_file($full)) {
                $diskFileCount++;
                if ($diskFileCount <= 30) {
                    $rel = str_replace('\\', '/', substr($full, strlen($storagePath) + 1));
                    $diskFiles[] = $rel;
                }
            }
        }
    };
    $scanRecursive($publicSamplesPath);
}
$directories['public_samples_file_count'] = $diskFileCount;
$directories['public_samples_files_preview'] = $diskFiles;

// ─── Database analysis ───
$whereClause = '';
$params = [];
if ($filterScope === 'public') {
    $whereClause = "WHERE (is_public = true OR scope = 'public' OR company_id IS NULL)";
}

$allMedia = $db->fetchAll("SELECT id, file_path, company_id, scope, is_public, name, file_type FROM media $whereClause ORDER BY created_at DESC", $params);

$results = [
    'total_in_db' => count($allMedia),
    'files_found_on_disk' => 0,
    'files_missing_from_disk' => 0,
    'path_types' => ['relative' => 0, 'windows_absolute' => 0, 'linux_absolute' => 0, 'empty' => 0],
    'missing_files' => [],
    'sample_found_paths' => [],
];

foreach ($allMedia as $media) {
    $filePath = $media['file_path'] ?? '';

    if (empty($filePath)) {
        $results['path_types']['empty']++;
        continue;
    }

    // Classify path type
    if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath)) {
        $results['path_types']['windows_absolute']++;
    } elseif ($filePath[0] === '/') {
        $results['path_types']['linux_absolute']++;
    } else {
        $results['path_types']['relative']++;
    }

    // Build full path for is_file check
    if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath) || strpos($filePath, '\\\\') === 0 || $filePath[0] === '/') {
        $fullPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
    } else {
        $fullPath = $storagePath . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
    }

    if (is_file($fullPath)) {
        $results['files_found_on_disk']++;
        if (count($results['sample_found_paths']) < 5) {
            $results['sample_found_paths'][] = [
                'file_path' => $filePath,
                'full_path' => $fullPath,
                'size' => filesize($fullPath),
            ];
        }
    } else {
        $results['files_missing_from_disk']++;
        if (count($results['missing_files']) < 50) {
            $results['missing_files'][] = [
                'id' => $media['id'],
                'name' => $media['name'],
                'file_path' => $filePath,
                'full_path_checked' => $fullPath,
                'scope' => $media['scope'] ?? '',
                'is_public' => (int)($media['is_public'] ?? 0),
                'file_type' => $media['file_type'] ?? '',
            ];
        }
    }
}

// ─── Actions ───
$actionResult = null;

if ($method === 'POST' && $action === 'clean') {
    // Remove DB entries for files that don't exist on disk
    $cleaned = 0;
    foreach ($allMedia as $media) {
        $filePath = $media['file_path'] ?? '';
        if (empty($filePath)) continue;

        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath) || strpos($filePath, '\\\\') === 0 || $filePath[0] === '/') {
            $fullPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
        } else {
            $fullPath = $storagePath . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
        }

        if (!is_file($fullPath)) {
            $db->delete('media', 'id = ?', [$media['id']]);
            $cleaned++;
        }
    }
    $actionResult = "Temizlendi: $cleaned eksik dosya kaydi silindi";
}

if ($method === 'POST' && $action === 'rescan') {
    // Re-scan public/samples directory
    if (!is_dir($publicSamplesPath)) {
        $actionResult = "HATA: $publicSamplesPath dizini bulunamadi";
    } else {
        // Trigger the scan API internally
        $actionResult = "Lutfen /api/media/scan endpoint'ini kullanarak yeniden tarama yapin";
    }
}

Response::success([
    'directories' => $directories,
    'database' => $results,
    'action' => $actionResult,
    'tips' => [
        'Eger files_missing_from_disk > 0 ise dosyalar sunucuda fiziksel olarak mevcut degil',
        'Eger public_samples_file_count = 0 ise ortak kutuphanenin dosyalari sunucuya yuklenmemis',
        'Eksik dosyalari temizlemek icin POST /api/media/fix-paths?action=clean',
        'Dosyalari sunucuya yukledikten sonra /api/media/scan ile yeniden tarayin',
    ],
]);
