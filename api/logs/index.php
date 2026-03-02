<?php
/**
 * Log Management API - List log files
 * Returns all log files with metadata (size, date, line count)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Sadece SuperAdmin erişebilir');
}

$logDir = STORAGE_PATH . '/logs';
if (!is_dir($logDir)) {
    Response::success(['files' => [], 'total_size' => 0]);
}

$files = [];
$totalSize = 0;

$logFiles = glob($logDir . '/*.log');
// Include rotated logs too
$rotatedFiles = glob($logDir . '/*.log.*');
$allFiles = array_merge($logFiles, $rotatedFiles);

foreach ($allFiles as $filePath) {
    $filename = basename($filePath);
    $size = filesize($filePath);
    $totalSize += $size;
    $modTime = filemtime($filePath);

    // Detect log type from filename
    $type = 'general';
    if (strpos($filename, 'error') !== false) $type = 'error';
    elseif (strpos($filename, 'audit') !== false) $type = 'audit';
    elseif (strpos($filename, 'api') !== false) $type = 'api';
    elseif (strpos($filename, 'debug') !== false) $type = 'debug';
    elseif (strpos($filename, 'gateway') !== false || strpos($filename, 'pavo') !== false || strpos($filename, 'hanshow') !== false) $type = 'integration';
    elseif (strpos($filename, 'render') !== false) $type = 'render';
    elseif (strpos($filename, 'send') !== false || strpos($filename, 'upload') !== false) $type = 'device';

    // Count lines (efficient tail for large files)
    $lineCount = 0;
    if ($size > 0) {
        $fp = fopen($filePath, 'r');
        if ($fp) {
            while (!feof($fp)) {
                $buffer = fread($fp, 8192);
                $lineCount += substr_count($buffer, "\n");
            }
            fclose($fp);
        }
    }

    // Detect log level distribution (sample first 100 lines)
    $levels = ['debug' => 0, 'info' => 0, 'warning' => 0, 'error' => 0, 'critical' => 0];
    if ($size > 0) {
        $fp = fopen($filePath, 'r');
        if ($fp) {
            $sampleCount = 0;
            while (!feof($fp) && $sampleCount < 500) {
                $line = fgets($fp);
                if ($line !== false) {
                    $lineUpper = strtoupper($line);
                    if (strpos($lineUpper, '[CRITICAL]') !== false) $levels['critical']++;
                    elseif (strpos($lineUpper, '[ERROR]') !== false) $levels['error']++;
                    elseif (strpos($lineUpper, '[WARNING]') !== false) $levels['warning']++;
                    elseif (strpos($lineUpper, '[INFO]') !== false) $levels['info']++;
                    elseif (strpos($lineUpper, '[DEBUG]') !== false) $levels['debug']++;
                    $sampleCount++;
                }
            }
            fclose($fp);
        }
    }

    $files[] = [
        'filename' => $filename,
        'path' => $filePath,
        'size' => $size,
        'size_formatted' => formatFileSize($size),
        'modified_at' => date('Y-m-d H:i:s', $modTime),
        'modified_timestamp' => $modTime,
        'line_count' => $lineCount,
        'type' => $type,
        'levels' => $levels,
        'is_rotated' => strpos($filename, '.log.') !== false
    ];
}

// Sort by modification date (newest first)
usort($files, function($a, $b) {
    return $b['modified_timestamp'] - $a['modified_timestamp'];
});

// Apply type filter if provided
$filterType = $_GET['type'] ?? null;
if ($filterType && $filterType !== 'all') {
    $files = array_values(array_filter($files, function($f) use ($filterType) {
        return $f['type'] === $filterType;
    }));
}

Response::success([
    'files' => $files,
    'total_size' => $totalSize,
    'total_size_formatted' => formatFileSize($totalSize),
    'total_files' => count($files),
    'log_types' => ['general', 'error', 'audit', 'api', 'debug', 'integration', 'render', 'device']
]);

function formatFileSize($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' GB';
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 2) . ' KB';
    return $bytes . ' B';
}
