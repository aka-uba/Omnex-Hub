<?php
/**
 * Log Management API - Cleanup / Delete log files
 * Supports single file delete, bulk delete, and age-based cleanup
 */

$db = Database::getInstance();
$user = Auth::user();
$role = strtolower((string)($user['role'] ?? ''));

if (!$user || $role !== 'superadmin') {
    Response::forbidden('Sadece SuperAdmin erisebilir');
}

$request = $GLOBALS['request'] ?? new Request();
$body = is_array($request->json()) ? $request->json() : [];
if (empty($body)) {
    $rawBody = file_get_contents('php://input');
    if (!empty($rawBody)) {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded)) {
            $body = $decoded;
        }
    }
}

$logDir = STORAGE_PATH . '/logs';
if (!is_dir($logDir)) {
    Response::error('Log dizini bulunamadi', 404);
}

$action = (string)($body['action'] ?? $request->input('action', 'delete_file'));

switch ($action) {
    case 'delete_file':
        $filename = trim((string)($body['filename'] ?? $request->input('filename', '')));
        if ($filename === '') {
            Response::error('Dosya adi gerekli', 400);
        }

        $filePath = validateLogFilePath($logDir, $filename);
        if (!is_file($filePath)) {
            Response::error('Dosya bulunamadi', 404);
        }

        $size = (int)@filesize($filePath);
        if (!@unlink($filePath)) {
            Response::error('Dosya silinemedi (izin veya kilit hatasi)', 500);
        }

        Logger::audit('delete', 'system_logs', [
            'filename' => basename($filePath),
            'size' => $size
        ]);

        Response::success([
            'message' => 'Log dosyasi silindi',
            'filename' => basename($filePath)
        ]);
        break;

    case 'delete_bulk':
        $filenames = $body['filenames'] ?? $request->input('filenames', []);
        if (!is_array($filenames) || empty($filenames)) {
            Response::error('Silinecek dosya secilmedi', 400);
        }

        $deleted = 0;
        $totalSize = 0;
        $errors = [];

        foreach ($filenames as $filename) {
            $filename = trim((string)$filename);
            if ($filename === '') {
                continue;
            }

            try {
                $filePath = validateLogFilePath($logDir, $filename);
            } catch (Throwable $e) {
                $errors[] = $filename . ' gecersiz yol';
                continue;
            }

            if (!is_file($filePath)) {
                $errors[] = $filename . ' bulunamadi';
                continue;
            }

            $totalSize += (int)@filesize($filePath);
            if (!@unlink($filePath)) {
                $errors[] = $filename . ' silinemedi';
                continue;
            }

            $deleted++;
        }

        Logger::audit('delete', 'system_logs', [
            'action' => 'bulk_delete',
            'deleted_count' => $deleted,
            'total_size' => $totalSize,
            'filenames' => $filenames
        ]);

        Response::success([
            'message' => $deleted . ' dosya silindi',
            'deleted' => $deleted,
            'total_size_freed' => $totalSize,
            'errors' => $errors
        ]);
        break;

    case 'cleanup_old':
        $days = max(1, (int)($body['days'] ?? $request->input('days', 30)));
        $cutoff = time() - ($days * 86400);

        $deleted = 0;
        $totalSize = 0;
        $deletedFiles = [];
        $errors = [];

        $allFiles = array_merge(glob($logDir . '/*.log') ?: [], glob($logDir . '/*.log.*') ?: []);

        // Keep active main files, remove only rotated/old ones
        $protectedBase = ['app.log', 'error.log', 'audit.log'];

        foreach ($allFiles as $filePath) {
            $filename = basename($filePath);

            if (in_array($filename, $protectedBase, true)) {
                continue;
            }

            if ((int)@filemtime($filePath) >= $cutoff) {
                continue;
            }

            $totalSize += (int)@filesize($filePath);
            if (!@unlink($filePath)) {
                $errors[] = $filename . ' silinemedi';
                continue;
            }

            $deletedFiles[] = $filename;
            $deleted++;
        }

        Logger::audit('cleanup', 'system_logs', [
            'action' => 'cleanup_old',
            'days_threshold' => $days,
            'deleted_count' => $deleted,
            'total_size' => $totalSize,
            'files' => $deletedFiles,
            'errors' => $errors
        ]);

        Response::success([
            'message' => $deleted . ' eski log dosyasi temizlendi',
            'deleted' => $deleted,
            'total_size_freed' => $totalSize,
            'deleted_files' => $deletedFiles,
            'errors' => $errors
        ]);
        break;

    case 'truncate':
        $filename = trim((string)($body['filename'] ?? $request->input('filename', '')));
        if ($filename === '') {
            Response::error('Dosya adi gerekli', 400);
        }

        $filePath = validateLogFilePath($logDir, $filename);
        if (!is_file($filePath)) {
            Response::error('Dosya bulunamadi', 404);
        }

        $oldSize = (int)@filesize($filePath);

        $handle = @fopen($filePath, 'c+');
        if ($handle === false) {
            Response::error('Dosya acilamadi (izin veya kilit hatasi)', 500);
        }

        $truncated = false;
        if (@flock($handle, LOCK_EX)) {
            $truncated = @ftruncate($handle, 0);
            @fflush($handle);
            @flock($handle, LOCK_UN);
        } else {
            $truncated = @ftruncate($handle, 0);
            @fflush($handle);
        }
        @fclose($handle);

        if (!$truncated) {
            Response::error('Log dosyasi temizlenemedi (izin veya kilit hatasi)', 500);
        }

        clearstatcache(true, $filePath);
        $newSize = (int)@filesize($filePath);

        Logger::audit('truncate', 'system_logs', [
            'filename' => basename($filePath),
            'old_size' => $oldSize,
            'new_size' => $newSize
        ]);

        Response::success([
            'message' => 'Log dosyasi temizlendi',
            'filename' => basename($filePath),
            'freed_size' => max(0, $oldSize - $newSize)
        ]);
        break;

    default:
        Response::error('Gecersiz islem', 400);
}

/**
 * Validate that requested file is inside log directory.
 */
function validateLogFilePath(string $logDir, string $filename): string
{
    $safeName = basename($filename);
    $filePath = $logDir . DIRECTORY_SEPARATOR . $safeName;

    $realLogDir = realpath($logDir);
    if ($realLogDir === false) {
        Response::error('Log dizini bulunamadi', 404);
    }

    // If file does not exist yet (delete/truncate will handle), still validate path form
    $realPath = realpath($filePath);
    if ($realPath === false) {
        return $filePath;
    }

    $normalizedDir = rtrim(str_replace('\\', '/', $realLogDir), '/') . '/';
    $normalizedPath = str_replace('\\', '/', $realPath);
    if (strpos($normalizedPath, $normalizedDir) !== 0) {
        Response::error('Gecersiz dosya yolu', 403);
    }

    return $realPath;
}