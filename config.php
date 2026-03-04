<?php
/**
 * Omnex Display Hub - Configuration
 *
 * @package OmnexDisplayHub
 * @version 1.0.0
 */

// Lightweight .env loader (no external dependency).
// Order: .env.local -> .env (process environment always takes precedence).
$envFiles = [__DIR__ . '/.env.local', __DIR__ . '/.env'];
foreach ($envFiles as $envFile) {
    if (!is_file($envFile) || !is_readable($envFile)) {
        continue;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        continue;
    }

    foreach ($lines as $line) {
        $line = trim((string)$line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }
        if (!str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim((string)$key);
        $value = trim((string)$value);
        if ($key === '' || preg_match('/^[A-Z0-9_]+$/i', $key) !== 1) {
            continue;
        }

        $len = strlen($value);
        if ($len >= 2) {
            $first = $value[0];
            $last = $value[$len - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        if (getenv($key) !== false) {
            continue;
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

// Production mode detection (set to true for production)
define('PRODUCTION_MODE', getenv('OMNEX_PRODUCTION') === 'true' || file_exists(__DIR__ . '/.production'));

// Error reporting based on environment
if (PRODUCTION_MODE) {
    error_reporting(0);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
}

// Timezone
date_default_timezone_set('Europe/Istanbul');

// Base paths
define('BASE_PATH', __DIR__);
define('CORE_PATH', BASE_PATH . '/core');
define('API_PATH', BASE_PATH . '/api');
define('MODELS_PATH', BASE_PATH . '/models');
define('SERVICES_PATH', BASE_PATH . '/services');
define('MIDDLEWARE_PATH', BASE_PATH . '/middleware');
define('PARSERS_PATH', BASE_PATH . '/parsers');
define('MAPPINGS_PATH', BASE_PATH . '/mappings');
define('DATABASE_PATH', BASE_PATH . '/database');
define('PUBLIC_PATH', BASE_PATH . '/public');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('LOCALES_PATH', BASE_PATH . '/locales');
define('TEMPLATES_PATH', BASE_PATH . '/templates');

// Database
define('DB_DRIVER', strtolower((string)(getenv('OMNEX_DB_DRIVER') ?: 'sqlite')));
define('DB_PROFILE', strtolower((string)(getenv('OMNEX_DB_PROFILE') ?: 'local'))); // local|docker|server
define('DB_URL', (string)(getenv('DATABASE_URL') ?: getenv('OMNEX_DB_URL') ?: ''));
define('DB_PATH', DATABASE_PATH . '/omnex.db');

$dbPgHostDefault = match (DB_PROFILE) {
    'docker' => 'postgres',
    default => '127.0.0.1',
};

define('DB_PG_HOST', (string)(getenv('OMNEX_DB_HOST') ?: $dbPgHostDefault));
define('DB_PG_PORT', (int)(getenv('OMNEX_DB_PORT') ?: 5432));
define('DB_PG_NAME', (string)(getenv('OMNEX_DB_NAME') ?: 'market_etiket'));
define('DB_PG_USER', (string)(getenv('OMNEX_DB_USER') ?: 'postgres'));
define('DB_PG_PASS', (string)(getenv('OMNEX_DB_PASS') ?: ''));
define('DB_PG_SSLMODE', (string)(getenv('OMNEX_DB_SSLMODE') ?: 'prefer'));
define('DB_PG_CONNECT_TIMEOUT', (int)(getenv('OMNEX_DB_CONNECT_TIMEOUT') ?: 5));
define('DB_PG_APP_NAME', (string)(getenv('OMNEX_DB_APP_NAME') ?: 'market-etiket-sistemi'));
define('DB_PG_SCHEMA', (string)(getenv('OMNEX_DB_SCHEMA') ?: 'public'));
define(
    'DB_PG_SEARCH_PATH',
    (string)(getenv('OMNEX_DB_SEARCH_PATH') ?: 'core,license,catalog,branch,labels,media,devices,signage,integration,audit,legacy,public')
);

// Security
// JWT_SECRET: Use environment variable in production, fallback to generated key for development
$jwtSecret = getenv('OMNEX_JWT_SECRET');
if (!$jwtSecret) {
    if (PRODUCTION_MODE) {
        // In production, require environment variable or use file-based secret
        $secretFile = __DIR__ . '/.jwt_secret';
        if (file_exists($secretFile)) {
            $jwtSecret = trim(file_get_contents($secretFile));
        } else {
            // Generate and store a secure secret
            $jwtSecret = bin2hex(random_bytes(32));
            file_put_contents($secretFile, $jwtSecret);
            chmod($secretFile, 0600);
        }
    } else {
        // Development fallback
        $jwtSecret = 'dev-only-secret-' . md5(__DIR__);
    }
}
define('JWT_SECRET', $jwtSecret);
define('JWT_EXPIRY', 3600); // 1 hour
define('REFRESH_TOKEN_EXPIRY', 2592000); // 30 days
define('CSRF_TOKEN_NAME', '_csrf_token');
define('SESSION_NAME', 'OMNEX_SESSION');

// Rate limiting
define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60); // seconds
define('LOGIN_RATE_LIMIT', 5);
define('LOGIN_RATE_WINDOW', 300); // 5 minutes

// File upload
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4', 'video/webm', 'video/ogg']);
define('ALLOWED_DOCUMENT_TYPES', ['application/pdf', 'application/json', 'text/plain', 'text/csv']);

// App settings
define('APP_NAME', 'Omnex Display Hub');
define('APP_VERSION', '1.0.52');

// CLI detection - CLI ortamında HTTP değişkenleri yok
define('IS_CLI', php_sapi_name() === 'cli');
define('IS_HTTP', !IS_CLI);

// Dynamic URL detection (CLI-safe)
if (IS_HTTP) {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '/');
    // Normalize slashes for Windows compatibility
    $scriptDir = str_replace('\\', '/', $scriptDir);
    $baseUrl = $protocol . '://' . $host . ($scriptDir === '/' ? '' : $scriptDir);
} else {
    // CLI mode: Use environment or sensible defaults
    $baseUrl = getenv('APP_URL') ?: 'http://localhost/market-etiket-sistemi';
}

define('APP_URL', $baseUrl);
define('API_URL', APP_URL . '/api');

// Default admin credentials
// WARNING: Change these immediately after first login in production!
define('DEFAULT_ADMIN_EMAIL', getenv('OMNEX_ADMIN_EMAIL') ?: 'admin@omnexcore.com');
// In production, generate a random password if not set via environment
$defaultAdminPass = getenv('OMNEX_ADMIN_PASSWORD');
if (!$defaultAdminPass && PRODUCTION_MODE) {
    $passFile = __DIR__ . '/.admin_initial_pass';
    if (file_exists($passFile)) {
        $defaultAdminPass = trim(file_get_contents($passFile));
    } else {
        // Generate secure random password for first-time setup
        $defaultAdminPass = bin2hex(random_bytes(16));
        file_put_contents($passFile, $defaultAdminPass);
        chmod($passFile, 0600);
        error_log("OMNEX: Initial admin password generated. Check $passFile");
    }
}
define('DEFAULT_ADMIN_PASSWORD', $defaultAdminPass ?: 'OmnexAdmin2024!');

// Multi-tenant settings
define('MULTI_TENANT_MODE', true);
define('DEFAULT_COMPANY_SLUG', 'default');

// Layout defaults
define('DEFAULT_LAYOUT', 'sidebar');
define('DEFAULT_THEME', 'light');
define('DEFAULT_DIRECTION', 'ltr');
define('DEFAULT_LANGUAGE', 'tr');

// Supported languages
define('SUPPORTED_LANGUAGES', ['tr', 'en', 'ar']);
define('RTL_LANGUAGES', ['ar']);

// Cache settings
define('CACHE_ENABLED', true);
define('CACHE_TTL', 3600); // 1 hour

// Security: HTTPS enforcement (enable in production)
define('FORCE_HTTPS', PRODUCTION_MODE && getenv('OMNEX_FORCE_HTTPS') !== 'false');

// Stream Mode Configuration (HLS Signage)
define('STREAM_SEGMENT_DURATION', 6);                          // HLS segment suresi (saniye)
define('STREAM_DEFAULT_PROFILE', '720p');                      // Varsayilan transcode profili
define('STREAM_PLAYLIST_TTL', 60);                             // Playlist cache suresi (saniye)
define('STREAM_TOKEN_LENGTH', 32);                             // Token uzunlugu (byte, hex=64 char)
// FFmpeg binary resolution order (cross-platform):
// 1) Environment variable (FFMPEG_PATH / FFPROBE_PATH)
// 2) Bundled binary under project (tools/ffmpeg/bin)
// 3) Common Linux/macOS paths (cpanel/cloud friendly)
// 4) System PATH fallback (ffmpeg / ffprobe)
$isWindows = DIRECTORY_SEPARATOR === '\\';
$resolveBinary = static function (array $candidates, string $fallback) use ($isWindows): string {
    foreach ($candidates as $candidate) {
        if (!$candidate || !is_string($candidate)) {
            continue;
        }

        // Plain command names (ffmpeg/ffprobe) are kept for PATH resolution.
        if ($candidate === 'ffmpeg' || $candidate === 'ffprobe') {
            return $candidate;
        }

        if (!is_file($candidate)) {
            continue;
        }

        // Windows does not reliably report executable bit; file existence is enough.
        if ($isWindows || is_executable($candidate)) {
            return $candidate;
        }
    }

    return $fallback;
};

$ffmpegCandidates = [
    getenv('FFMPEG_PATH') ?: null,
    BASE_PATH . '/tools/ffmpeg/bin/ffmpeg.exe',
    BASE_PATH . '/tools/ffmpeg/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/cpanel/3rdparty/bin/ffmpeg',
    'ffmpeg'
];
$ffprobeCandidates = [
    getenv('FFPROBE_PATH') ?: null,
    BASE_PATH . '/tools/ffmpeg/bin/ffprobe.exe',
    BASE_PATH . '/tools/ffmpeg/bin/ffprobe',
    '/usr/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/cpanel/3rdparty/bin/ffprobe',
    'ffprobe'
];
define('FFMPEG_PATH', $resolveBinary($ffmpegCandidates, 'ffmpeg'));
define('FFMPEG_PROBE_PATH', $resolveBinary($ffprobeCandidates, 'ffprobe'));
define('STREAM_STORAGE_PATH', STORAGE_PATH . '/streams');      // HLS cikti dizini
define('STREAM_MAX_CONCURRENT_TRANSCODE', 2);                  // Paralel transcode limiti

// Logging
define('LOG_LEVEL', 'debug'); // debug, info, warning, error
define('LOG_FILE', STORAGE_PATH . '/logs/app.log');
define('ERROR_LOG_FILE', STORAGE_PATH . '/logs/error.log');
define('AUDIT_LOG_FILE', STORAGE_PATH . '/logs/audit.log');

// CORS settings
// Allow localhost, 127.0.0.1, and local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
define('CORS_ALLOWED_ORIGINS', [
    'http://localhost',
    'http://127.0.0.1',
    'http://192.168.1.23',
    'http://192.168.1.*'  // All local network
]);
define('CORS_ALLOW_LOCAL_NETWORK', true); // Enable local network access
define('CORS_ALLOWED_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
define('CORS_ALLOWED_HEADERS', ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']);

// Autoload core classes
spl_autoload_register(function ($class) {
    $paths = [
        CORE_PATH . '/' . $class . '.php',
        MODELS_PATH . '/' . $class . '.php',
        SERVICES_PATH . '/' . $class . '.php',
        MIDDLEWARE_PATH . '/' . $class . '.php',
        PARSERS_PATH . '/' . $class . '.php',
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// Start session (only in HTTP context - CLI doesn't need sessions)
if (IS_HTTP && session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => PRODUCTION_MODE,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_name('OMNEX_SID');
    session_start();
}
