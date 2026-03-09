<?php
/**
 * System Status API
 * Returns server metrics: CPU, RAM, Disk, Uptime, PHP info, API stats
 *
 * GET /api/system/status
 * Requires: SuperAdmin or Admin role
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only SuperAdmin and Admin can access
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu sayfaya erisim yetkiniz bulunmuyor');
}

// Check if only live metrics are requested (for faster polling)
$liveOnly = isset($_GET['live_only']) && $_GET['live_only'] === '1';

if ($liveOnly) {
    // Return only live API metrics for fast refresh (based on real api.log timings)
    $liveMetrics = collectApiLogMetrics();
    $quickStats = collectQuickStatsForLiveCards();
    Response::success([
        'api_stats' => [
            'live' => [
                'requests_per_second' => $liveMetrics['requests_per_second'],
                'response_time_ms' => $liveMetrics['response_time_ms'],
                'active_connections' => $liveMetrics['active_connections'],
                'error_rate' => $liveMetrics['error_rate'],
                'client_error_rate' => $liveMetrics['client_error_rate'],
                'requests_per_minute' => $liveMetrics['requests_per_minute'],
                'last_updated' => date('Y-m-d H:i:s')
            ]
        ],
        'quick_stats' => $quickStats
    ]);
    exit;
}

// Get system metrics
$metrics = [];

// 1. Server Information
$metrics['server'] = [
    'hostname' => gethostname(),
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'server_ip' => getLocalIP(),
    'server_port' => $_SERVER['SERVER_PORT'] ?? 80,
    'protocol' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'HTTPS' : 'HTTP',
    'server_time' => date('Y-m-d H:i:s'),
    'timezone' => date_default_timezone_get()
];

// 2. PHP Information
$metrics['php'] = [
    'version' => PHP_VERSION,
    'sapi' => php_sapi_name(),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'extensions' => [
        'pdo' => extension_loaded('pdo'),
        'pdo_pgsql' => extension_loaded('pdo_pgsql'),
        'pgsql' => extension_loaded('pgsql'),
        'gd' => extension_loaded('gd'),
        'curl' => extension_loaded('curl'),
        'json' => extension_loaded('json'),
        'mbstring' => extension_loaded('mbstring'),
        'openssl' => extension_loaded('openssl')
    ]
];

// 3. Memory Usage
$memoryUsage = memory_get_usage(true);
$memoryPeak = memory_get_peak_usage(true);
$memoryLimit = ini_get('memory_limit');
$memoryLimitBytes = convertToBytes($memoryLimit);

$metrics['memory'] = [
    'current' => $memoryUsage,
    'current_formatted' => formatBytes($memoryUsage),
    'peak' => $memoryPeak,
    'peak_formatted' => formatBytes($memoryPeak),
    'limit' => $memoryLimitBytes,
    'limit_formatted' => $memoryLimit,
    'usage_percent' => $memoryLimitBytes > 0 ? round(($memoryUsage / $memoryLimitBytes) * 100, 2) : 0
];

// 4. Storage Usage (measures actual storage folder size, not entire disk partition)
$storagePath = BASE_PATH . '/storage';

// Calculate actual storage folder size
$storageUsed = 0;
if (is_dir($storagePath)) {
    $storageUsed = getFolderSize($storagePath);
}

// Get disk partition info for reference
$diskFree = @disk_free_space($storagePath);
$diskTotal = @disk_total_space($storagePath);

// Database size/path
$dbPath = sprintf(
    'pgsql://%s:%s/%s',
    defined('DB_PG_HOST') ? DB_PG_HOST : '127.0.0.1',
    defined('DB_PG_PORT') ? (string)DB_PG_PORT : '5432',
    defined('DB_PG_NAME') ? DB_PG_NAME : 'market_etiket'
);
$dbSize = 0;
try {
    $sizeRow = $db->fetch("SELECT pg_database_size(current_database()) AS size");
    $dbSize = (int)($sizeRow['size'] ?? 0);
} catch (Exception $e) {
    $dbSize = 0;
}

// Total application storage (storage folder + database)
$totalAppStorage = $storageUsed + $dbSize;

$metrics['disk'] = [
    // Application storage (what we actually use)
    'app_used' => $totalAppStorage,
    'app_used_formatted' => formatBytes($totalAppStorage),
    'storage_used' => $storageUsed,
    'storage_used_formatted' => formatBytes($storageUsed),
    'db_size' => $dbSize,
    'db_size_formatted' => formatBytes($dbSize),
    // Disk partition info (for reference)
    'partition_total' => $diskTotal ?: 0,
    'partition_total_formatted' => $diskTotal ? formatBytes($diskTotal) : 'N/A',
    'partition_free' => $diskFree ?: 0,
    'partition_free_formatted' => $diskFree ? formatBytes($diskFree) : 'N/A',
    'partition_used' => ($diskTotal && $diskFree) ? ($diskTotal - $diskFree) : 0,
    'partition_used_formatted' => ($diskTotal && $diskFree) ? formatBytes($diskTotal - $diskFree) : 'N/A',
    'partition_usage_percent' => ($diskTotal && $diskFree) ? round((($diskTotal - $diskFree) / $diskTotal) * 100, 2) : 0
];

// 5. Database Info (dbPath and dbSize already defined above)
// Get table counts
$tableStats = [];
$tables = ['users', 'companies', 'products', 'devices', 'templates', 'media', 'playlists', 'notifications'];

foreach ($tables as $table) {
    try {
        $count = $db->fetch("SELECT COUNT(*) as count FROM {$table}");
        $tableStats[$table] = $count['count'] ?? 0;
    } catch (Exception $e) {
        $tableStats[$table] = 0;
    }
}

$dbType = 'PostgreSQL';
$dbVersion = $db->fetch("SELECT version() as version")['version'] ?? 'Unknown';

$metrics['database'] = [
    'type' => $dbType,
    'version' => $dbVersion,
    'path' => $dbPath,
    'size' => $dbSize,
    'size_formatted' => formatBytes($dbSize),
    'tables' => $tableStats
];

// 6. System Uptime (Windows & Linux)
$uptime = getSystemUptime();
$metrics['uptime'] = $uptime;

// 7. CPU Usage (if available)
$cpuUsage = getCpuUsage();
$metrics['cpu'] = $cpuUsage;

// 8. API Statistics (from audit_logs)
$today = date('Y-m-d');
$thisMonth = date('Y-m');

try {
    // Today's API calls
    $todayStats = $db->fetch(
        "SELECT COUNT(*) as count FROM audit_logs WHERE DATE(created_at) = ?",
        [$today]
    );

    $monthExpr = "to_char(created_at, 'YYYY-MM')";
    $hourExpr = "to_char(created_at, 'HH24')";
    $minuteExpr = "to_char(created_at, 'HH24:MI')";

    // This month's API calls
    $monthStats = $db->fetch(
        "SELECT COUNT(*) as count FROM audit_logs WHERE $monthExpr = ?",
        [$thisMonth]
    );

    // Total API calls
    $totalStats = $db->fetch("SELECT COUNT(*) as count FROM audit_logs");

    // Recent activity by action type
    $activityByType = $db->fetchAll(
        "SELECT action, COUNT(*) as count
         FROM audit_logs
         WHERE DATE(created_at) = ?
         GROUP BY action
         ORDER BY count DESC
         LIMIT 10",
        [$today]
    );

    // Hourly distribution today
    $hourlyActivity = $db->fetchAll(
        "SELECT $hourExpr as hour, COUNT(*) as count
         FROM audit_logs
         WHERE DATE(created_at) = ?
         GROUP BY hour
         ORDER BY hour",
        [$today]
    );

    // Live API metrics from real API log
    $liveMetrics = collectApiLogMetrics();

    $metrics['api_stats'] = [
        'today' => $todayStats['count'] ?? 0,
        'this_month' => $monthStats['count'] ?? 0,
        'total' => $totalStats['count'] ?? 0,
        'by_type' => $activityByType,
        'hourly' => $hourlyActivity,
        // Live metrics
        'live' => [
            'requests_per_second' => $liveMetrics['requests_per_second'],
            'response_time_ms' => $liveMetrics['response_time_ms'],
            'active_connections' => $liveMetrics['active_connections'],
            'requests_per_minute' => $liveMetrics['requests_per_minute'],
            'error_rate' => $liveMetrics['error_rate'],
            'client_error_rate' => $liveMetrics['client_error_rate'],
            'last_updated' => date('Y-m-d H:i:s')
        ]
    ];
} catch (Exception $e) {
    $metrics['api_stats'] = [
        'today' => 0,
        'this_month' => 0,
        'total' => 0,
        'by_type' => [],
        'hourly' => [],
        'live' => [
            'requests_per_second' => 0,
            'response_time_ms' => 0,
            'active_connections' => 0,
            'requests_per_minute' => [],
            'error_rate' => 0,
            'client_error_rate' => 0,
            'last_updated' => date('Y-m-d H:i:s')
        ]
    ];
}

// 9. Active Sessions
try {
    $activeSessions = $db->fetch(
        "SELECT COUNT(*) as count FROM sessions WHERE expires_at > CURRENT_TIMESTAMP"
    );
    $metrics['sessions'] = [
        'active' => $activeSessions['count'] ?? 0
    ];
} catch (Exception $e) {
    $metrics['sessions'] = ['active' => 0];
}

// 10. Storage breakdown
$storageFolders = ['media', 'avatars', 'templates', 'exports', 'logs'];
$storageBreakdown = [];

foreach ($storageFolders as $folder) {
    $folderPath = BASE_PATH . '/storage/' . $folder;
    if (is_dir($folderPath)) {
        $size = getFolderSize($folderPath);
        $storageBreakdown[$folder] = [
            'size' => $size,
            'size_formatted' => formatBytes($size)
        ];
    } else {
        $storageBreakdown[$folder] = [
            'size' => 0,
            'size_formatted' => '0 B'
        ];
    }
}

$metrics['storage_breakdown'] = $storageBreakdown;

// Return all metrics
Response::success($metrics);

// ============ Helper Functions ============

/**
 * Get local IP address (not loopback)
 * Tries multiple methods to get the actual network IP
 */
function getLocalIP() {
    // Method 1: Check SERVER_ADDR first, but skip if it's loopback
    $serverAddr = $_SERVER['SERVER_ADDR'] ?? '';
    if ($serverAddr && $serverAddr !== '::1' && $serverAddr !== '127.0.0.1') {
        return $serverAddr;
    }

    // Method 2: Use gethostbyname with hostname
    $hostname = gethostname();
    if ($hostname) {
        $ip = gethostbyname($hostname);
        // gethostbyname returns the hostname itself if it fails
        if ($ip !== $hostname && $ip !== '127.0.0.1') {
            return $ip;
        }
    }

    // Method 3: Windows - use ipconfig
    if (PHP_OS_FAMILY === 'Windows') {
        $output = @shell_exec('ipconfig 2>nul');
        if ($output) {
            // Match IPv4 addresses (prefer 192.168.x.x or 10.x.x.x patterns)
            if (preg_match('/IPv4.*?:\s*(192\.168\.\d+\.\d+)/i', $output, $matches)) {
                return $matches[1];
            }
            if (preg_match('/IPv4.*?:\s*(10\.\d+\.\d+\.\d+)/i', $output, $matches)) {
                return $matches[1];
            }
            if (preg_match('/IPv4.*?:\s*(172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/i', $output, $matches)) {
                return $matches[1];
            }
            // Any IPv4 that's not loopback
            if (preg_match('/IPv4.*?:\s*(\d+\.\d+\.\d+\.\d+)/i', $output, $matches)) {
                if ($matches[1] !== '127.0.0.1') {
                    return $matches[1];
                }
            }
        }
    } else {
        // Method 3: Linux - use hostname -I or ip addr
        $output = @shell_exec('hostname -I 2>/dev/null');
        if ($output) {
            $ips = explode(' ', trim($output));
            foreach ($ips as $ip) {
                $ip = trim($ip);
                if ($ip && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && $ip !== '127.0.0.1') {
                    return $ip;
                }
            }
        }
    }

    // Method 4: Socket-based detection (works on most systems)
    $sock = @socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
    if ($sock) {
        // Connect to a public DNS (doesn't actually send data, just determines route)
        @socket_connect($sock, '8.8.8.8', 53);
        @socket_getsockname($sock, $localIP);
        @socket_close($sock);
        if ($localIP && $localIP !== '0.0.0.0' && $localIP !== '127.0.0.1') {
            return $localIP;
        }
    }

    // Fallback: return loopback
    return $serverAddr ?: '127.0.0.1';
}

function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];

    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);

    $bytes /= pow(1024, $pow);

    return round($bytes, $precision) . ' ' . $units[$pow];
}

function convertToBytes($value) {
    $value = trim($value);
    $last = strtolower($value[strlen($value) - 1]);
    $numValue = (int) $value;

    switch ($last) {
        case 'g': $numValue *= 1024;
        case 'm': $numValue *= 1024;
        case 'k': $numValue *= 1024;
    }

    return $numValue;
}

function getSystemUptime() {
    $uptime = [
        'seconds' => 0,
        'formatted' => 'N/A',
        'boot_time' => null
    ];

    if (PHP_OS_FAMILY === 'Windows') {
        // Windows: Use wmic
        $output = @shell_exec('wmic os get lastbootuptime 2>nul');
        if ($output) {
            preg_match('/(\d{14})/', $output, $matches);
            if (!empty($matches[1])) {
                $bootTime = DateTime::createFromFormat('YmdHis', substr($matches[1], 0, 14));
                if ($bootTime) {
                    $now = new DateTime();
                    $diff = $now->diff($bootTime);
                    $uptime['seconds'] = $now->getTimestamp() - $bootTime->getTimestamp();
                    $uptime['boot_time'] = $bootTime->format('Y-m-d H:i:s');
                    $uptime['formatted'] = formatUptime($diff);
                }
            }
        }
    } else {
        // Linux/Unix: Read from /proc/uptime
        if (file_exists('/proc/uptime')) {
            $uptimeData = file_get_contents('/proc/uptime');
            $uptimeSeconds = (int) explode(' ', $uptimeData)[0];
            $uptime['seconds'] = $uptimeSeconds;
            $uptime['boot_time'] = date('Y-m-d H:i:s', time() - $uptimeSeconds);
            $uptime['formatted'] = formatUptimeSeconds($uptimeSeconds);
        }
    }

    return $uptime;
}

function formatUptime($diff) {
    $parts = [];
    if ($diff->d > 0) $parts[] = $diff->d . " g\u{00FC}n";
    if ($diff->h > 0) $parts[] = $diff->h . ' saat';
    if ($diff->i > 0) $parts[] = $diff->i . ' dakika';
    return implode(' ', $parts) ?: "Az \u{00F6}nce";
}

function formatUptimeSeconds($seconds) {
    $days = floor($seconds / 86400);
    $hours = floor(($seconds % 86400) / 3600);
    $minutes = floor(($seconds % 3600) / 60);

    $parts = [];
    if ($days > 0) $parts[] = $days . " g\u{00FC}n";
    if ($hours > 0) $parts[] = $hours . ' saat';
    if ($minutes > 0) $parts[] = $minutes . ' dakika';

    return implode(' ', $parts) ?: "Az \u{00F6}nce";
}

function getCpuUsage() {
    $cpu = [
        'usage_percent' => null,
        'cores' => null,
        'model' => null,
        'load_average' => null
    ];

    if (PHP_OS_FAMILY === 'Windows') {
        // Windows: Use wmic for CPU info
        $output = @shell_exec('wmic cpu get loadpercentage 2>nul');
        if ($output) {
            preg_match('/(\d+)/', $output, $matches);
            if (!empty($matches[1])) {
                $cpu['usage_percent'] = (int) $matches[1];
            }
        }

        // Get CPU name
        $cpuName = @shell_exec('wmic cpu get name 2>nul');
        if ($cpuName) {
            $lines = explode("\n", trim($cpuName));
            if (isset($lines[1])) {
                $cpu['model'] = trim($lines[1]);
            }
        }

        // Get number of cores
        $cores = @shell_exec('wmic cpu get NumberOfCores 2>nul');
        if ($cores) {
            preg_match('/(\d+)/', $cores, $matches);
            if (!empty($matches[1])) {
                $cpu['cores'] = (int) $matches[1];
            }
        }
    } else {
        // Linux: Read from /proc/cpuinfo and /proc/loadavg
        if (file_exists('/proc/loadavg')) {
            $load = file_get_contents('/proc/loadavg');
            $loadParts = explode(' ', $load);
            $cpu['load_average'] = [
                '1min' => (float) $loadParts[0],
                '5min' => (float) $loadParts[1],
                '15min' => (float) $loadParts[2]
            ];
        }

        if (file_exists('/proc/cpuinfo')) {
            $cpuInfo = file_get_contents('/proc/cpuinfo');
            preg_match('/model name\s*:\s*(.+)/i', $cpuInfo, $modelMatch);
            preg_match_all('/^processor/m', $cpuInfo, $coreMatches);

            if (!empty($modelMatch[1])) {
                $cpu['model'] = trim($modelMatch[1]);
            }
            $cpu['cores'] = count($coreMatches[0]);
        }
    }

    return $cpu;
}

/**
 * Collect live API metrics from storage/logs/api.log.
 * Uses recent entries so polling remains lightweight.
 */
function collectApiLogMetrics(int $tailLines = 1200, int $maxTailBytes = 262144, int $cacheTtlSeconds = 2): array
{
    $default = [
        'requests_per_second' => 0,
        'response_time_ms' => 0,
        'active_connections' => 0,
        'error_rate' => 0,
        'client_error_rate' => 0,
        'requests_per_minute' => []
    ];

    $logFile = STORAGE_PATH . '/logs/api.log';
    if (!is_file($logFile) || !is_readable($logFile)) {
        return $default;
    }

    $cacheFile = STORAGE_PATH . '/cache/system_status_live_metrics.json';
    $logMtime = @filemtime($logFile);
    if ($logMtime === false) {
        $logMtime = 0;
    }

    if ($cacheTtlSeconds > 0) {
        $cached = readJsonCache($cacheFile, $cacheTtlSeconds);
        if (
            is_array($cached)
            && isset($cached['log_mtime'], $cached['payload'])
            && (int)$cached['log_mtime'] === (int)$logMtime
            && is_array($cached['payload'])
        ) {
            return $cached['payload'];
        }
    }

    $lines = readTailLines($logFile, $tailLines, $maxTailBytes);
    if (empty($lines)) {
        return $default;
    }

    $now = time();
    $oneMinuteAgo = $now - 60;
    $fiveMinutesAgo = $now - 300;
    $oneHourAgo = $now - 3600;

    $lastMinuteCount = 0;
    $lastMinuteDurations = [];
    $activeIps = [];
    $hourTotal = 0;
    $hourServerErrors = 0;
    $hourClientErrors = 0;
    $perMinuteBuckets = [];

    foreach ($lines as $line) {
        if (!preg_match('/^\[(.*?)\]\s+[A-Z]+\s+\S+\s+-\s+(\d+)\s+\(([0-9.]+)ms\)\s+-\s+(.+)$/', $line, $m)) {
            continue;
        }

        $ts = strtotime($m[1]);
        if ($ts === false) {
            continue;
        }

        $status = (int)$m[2];
        $duration = (float)$m[3];
        $ip = trim((string)$m[4]);

        if ($ts >= $oneHourAgo) {
            $hourTotal++;
            if ($status >= 500) {
                $hourServerErrors++;
            } elseif ($status >= 400) {
                $hourClientErrors++;
            }
        }

        if ($ts >= $oneMinuteAgo) {
            $lastMinuteCount++;
            $lastMinuteDurations[] = $duration;
        }

        if ($ts >= $fiveMinutesAgo) {
            if ($ip !== '' && $ip !== '-') {
                $activeIps[$ip] = true;
            }
            $minuteKey = date('H:i', $ts);
            if (!isset($perMinuteBuckets[$minuteKey])) {
                $perMinuteBuckets[$minuteKey] = 0;
            }
            $perMinuteBuckets[$minuteKey]++;
        }
    }

    $avgResponseMs = 0;
    if (!empty($lastMinuteDurations)) {
        $avgResponseMs = round(array_sum($lastMinuteDurations) / count($lastMinuteDurations), 2);
    }

    ksort($perMinuteBuckets);
    $requestsPerMinute = [];
    foreach ($perMinuteBuckets as $minute => $count) {
        $requestsPerMinute[] = ['minute' => $minute, 'count' => $count];
    }

    // keep only latest 5 buckets
    if (count($requestsPerMinute) > 5) {
        $requestsPerMinute = array_slice($requestsPerMinute, -5);
    }

    $result = [
        'requests_per_second' => round($lastMinuteCount / 60, 2),
        'response_time_ms' => $avgResponseMs,
        'active_connections' => count($activeIps),
        // Keep error_rate focused on server-side failures for operational clarity.
        'error_rate' => $hourTotal > 0 ? round(($hourServerErrors / $hourTotal) * 100, 2) : 0,
        'client_error_rate' => $hourTotal > 0 ? round(($hourClientErrors / $hourTotal) * 100, 2) : 0,
        'requests_per_minute' => array_reverse($requestsPerMinute)
    ];

    writeJsonCache($cacheFile, [
        'log_mtime' => (int)$logMtime,
        'payload' => $result
    ]);

    return $result;
}

/**
 * Lightweight quick stats for 3s live card refresh.
 */
function collectQuickStatsForLiveCards(int $cacheTtlSeconds = 5): array
{
    $cacheFile = STORAGE_PATH . '/cache/system_status_quick_stats.json';
    if ($cacheTtlSeconds > 0) {
        $cached = readJsonCache($cacheFile, $cacheTtlSeconds);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $cpu = getCpuUsage();
    $memoryLimitBytes = convertToBytes((string)ini_get('memory_limit'));
    $memoryUsage = memory_get_usage(true);

    $result = [
        'uptime' => [
            'formatted' => (string)(getSystemUptime()['formatted'] ?? 'N/A')
        ],
        'cpu' => [
            'usage_percent' => $cpu['usage_percent'] ?? null,
            'load_average' => $cpu['load_average'] ?? null
        ],
        'memory' => [
            'usage_percent' => $memoryLimitBytes > 0 ? round(($memoryUsage / $memoryLimitBytes) * 100, 2) : 0
        ]
    ];

    writeJsonCache($cacheFile, $result);
    return $result;
}

/**
 * Read only the recent tail chunk from a potentially large log file.
 */
function readTailLines(string $filePath, int $maxLines = 1200, int $maxBytes = 262144): array
{
    if (!is_file($filePath) || !is_readable($filePath)) {
        return [];
    }

    $size = @filesize($filePath);
    if ($size === false || $size <= 0) {
        return [];
    }

    $readBytes = (int)min($size, max(4096, $maxBytes));
    $fp = @fopen($filePath, 'rb');
    if ($fp === false) {
        return [];
    }

    try {
        if ($size > $readBytes) {
            @fseek($fp, -$readBytes, SEEK_END);
        } else {
            @rewind($fp);
        }
        $chunk = (string)@fread($fp, $readBytes);
    } finally {
        @fclose($fp);
    }

    if ($chunk === '') {
        return [];
    }

    // If we started from middle of file, first line might be partial.
    if ($size > $readBytes) {
        $firstNewlinePos = strpos($chunk, "\n");
        if ($firstNewlinePos !== false) {
            $chunk = substr($chunk, $firstNewlinePos + 1);
        }
    }

    $lines = preg_split('/\R/', $chunk) ?: [];
    $lines = array_values(array_filter($lines, static fn($line): bool => trim((string)$line) !== ''));
    if (count($lines) > $maxLines) {
        $lines = array_slice($lines, -$maxLines);
    }
    return $lines;
}

function readJsonCache(string $cacheFile, int $ttlSeconds): ?array
{
    if ($ttlSeconds <= 0 || !is_file($cacheFile) || !is_readable($cacheFile)) {
        return null;
    }

    $mtime = @filemtime($cacheFile);
    if ($mtime === false || (time() - $mtime) > $ttlSeconds) {
        return null;
    }

    $raw = @file_get_contents($cacheFile);
    if (!is_string($raw) || $raw === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function writeJsonCache(string $cacheFile, array $payload): void
{
    $dir = dirname($cacheFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $tmp = $cacheFile . '.tmp';
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return;
    }

    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        return;
    }

    @rename($tmp, $cacheFile);
}

function getFolderSize($path) {
    $size = 0;

    if (!is_dir($path)) {
        return $size;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $size += $file->getSize();
        }
    }

    return $size;
}

