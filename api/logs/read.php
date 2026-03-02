<?php
/**
 * Log Management API - Read log file content
 * Returns parsed log lines with pagination and filtering
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Sadece SuperAdmin erişebilir');
}

$filename = $_GET['file'] ?? null;
if (!$filename) {
    Response::error('Dosya adı gerekli', 400);
}

// Security: only allow reading from logs directory
$logDir = STORAGE_PATH . '/logs';
$filePath = $logDir . '/' . basename($filename);

if (!file_exists($filePath)) {
    Response::error('Log dosyası bulunamadı', 404);
}

// Prevent directory traversal
$realPath = realpath($filePath);
$realLogDir = realpath($logDir);
if (strpos($realPath, $realLogDir) !== 0) {
    Response::error('Geçersiz dosya yolu', 403);
}

$page = max(1, intval($_GET['page'] ?? 1));
$perPage = min(500, max(10, intval($_GET['per_page'] ?? 100)));
$level = $_GET['level'] ?? null;
$search = $_GET['search'] ?? null;
$order = ($_GET['order'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

// Read file
$allLines = [];
$fp = fopen($filePath, 'r');
if (!$fp) {
    Response::error('Dosya okunamadı', 500);
}

$lineNum = 0;
while (!feof($fp)) {
    $line = fgets($fp);
    if ($line === false) break;
    $line = rtrim($line, "\r\n");
    if (empty(trim($line))) continue;
    $lineNum++;

    // Parse the log line
    $parsed = parseLogLine($line, $lineNum);

    // Apply level filter
    if ($level && $level !== 'all' && $parsed['level'] !== strtoupper($level)) {
        continue;
    }

    // Apply search filter
    if ($search && stripos($line, $search) === false) {
        continue;
    }

    $allLines[] = $parsed;
}
fclose($fp);

$totalLines = count($allLines);

// Sort
if ($order === 'desc') {
    $allLines = array_reverse($allLines);
}

// Paginate
$offset = ($page - 1) * $perPage;
$pagedLines = array_slice($allLines, $offset, $perPage);

// Level stats for this file
$levelStats = ['DEBUG' => 0, 'INFO' => 0, 'WARNING' => 0, 'ERROR' => 0, 'CRITICAL' => 0, 'UNKNOWN' => 0];
foreach ($allLines as $l) {
    $lvl = $l['level'] ?? 'UNKNOWN';
    if (isset($levelStats[$lvl])) {
        $levelStats[$lvl]++;
    } else {
        $levelStats['UNKNOWN']++;
    }
}

Response::success([
    'lines' => $pagedLines,
    'total' => $totalLines,
    'page' => $page,
    'per_page' => $perPage,
    'total_pages' => ceil($totalLines / $perPage),
    'filename' => $filename,
    'file_size' => filesize($filePath),
    'level_stats' => $levelStats
]);

function parseLogLine($line, $lineNum) {
    $result = [
        'line_number' => $lineNum,
        'timestamp' => null,
        'level' => 'UNKNOWN',
        'message' => $line,
        'context' => null,
        'raw' => $line
    ];

    // Try JSON format (audit log)
    if (substr($line, 0, 1) === '{') {
        $json = json_decode($line, true);
        if ($json) {
            $result['timestamp'] = $json['timestamp'] ?? null;
            $result['level'] = 'AUDIT';
            $result['message'] = ($json['action'] ?? '') . ' - ' . ($json['resource'] ?? '');
            $result['context'] = $json;
            return $result;
        }
    }

    // Try standard log format: [2026-01-10 22:01:16] [INFO] Message {json}
    if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)$/s', $line, $matches)) {
        $result['timestamp'] = $matches[1];
        $result['level'] = strtoupper($matches[2]);
        $message = $matches[3];

        // Try to extract JSON context from end of message
        if (preg_match('/^(.*?)\s+(\{.*\})\s*$/', $message, $ctxMatches)) {
            $result['message'] = $ctxMatches[1];
            $ctx = json_decode($ctxMatches[2], true);
            if ($ctx) {
                $result['context'] = $ctx;
            } else {
                $result['message'] = $message;
            }
        } else {
            $result['message'] = $message;
        }
        return $result;
    }

    // Try API log format: [2026-01-10 22:01:16] GET /api/products - 200 (12.34ms) - 127.0.0.1
    if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+(GET|POST|PUT|DELETE|PATCH)\s+(.+?)\s+-\s+(\d+)\s+\((.+?)\)\s+-\s+(.+)$/', $line, $matches)) {
        $result['timestamp'] = $matches[1];
        $result['level'] = intval($matches[4]) >= 400 ? 'ERROR' : 'INFO';
        $result['message'] = $matches[2] . ' ' . $matches[3] . ' - ' . $matches[4];
        $result['context'] = [
            'method' => $matches[2],
            'path' => $matches[3],
            'status' => intval($matches[4]),
            'duration' => $matches[5],
            'ip' => $matches[6]
        ];
        return $result;
    }

    // Try timestamp-only format: 2026-01-18 17:34:42 - message
    if (preg_match('/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+-\s+(.*)$/s', $line, $matches)) {
        $result['timestamp'] = $matches[1];
        $result['message'] = $matches[2];

        $json = json_decode($matches[2], true);
        if ($json) {
            $result['context'] = $json;
            $result['message'] = $json['errmsg'] ?? $json['status'] ?? $matches[2];
        }
        return $result;
    }

    // Try bracket timestamp: [2026-01-19 22:17:24] message
    if (preg_match('/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+(.*)$/s', $line, $matches)) {
        $result['timestamp'] = $matches[1];
        $result['message'] = $matches[2];

        // Detect level from message content
        $msgUpper = strtoupper($matches[2]);
        if (strpos($msgUpper, 'ERROR') !== false || strpos($msgUpper, 'FAIL') !== false || strpos($msgUpper, 'TIMEOUT') !== false) {
            $result['level'] = 'ERROR';
        } elseif (strpos($msgUpper, 'WARNING') !== false || strpos($msgUpper, 'WARN') !== false) {
            $result['level'] = 'WARNING';
        } elseif (strpos($msgUpper, 'DEBUG') !== false) {
            $result['level'] = 'DEBUG';
        } else {
            $result['level'] = 'INFO';
        }
        return $result;
    }

    return $result;
}
