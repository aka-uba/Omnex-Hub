<?php
/**
 * Omnex Display Hub - Main Entry Point
 *
 * @package OmnexDisplayHub
 * @version 1.0.0
 */

// Load configuration
require_once __DIR__ . '/config.php';

/**
 * Build version used for frontend cache busting.
 * Priority:
 * 1) Git HEAD hash (when .git metadata exists)
 * 2) Latest mtime across critical frontend resources (JS + locales)
 */
function omnexResolveBuildVersion(): string
{
    $headFile = __DIR__ . '/.git/HEAD';
    if (is_file($headFile)) {
        $head = trim((string)file_get_contents($headFile));
        $hash = '';

        if (strpos($head, 'ref: ') === 0) {
            $refPath = __DIR__ . '/.git/' . trim(substr($head, 5));
            if (is_file($refPath)) {
                $hash = trim((string)file_get_contents($refPath));
            }
        } else {
            $hash = $head;
        }

        if ($hash !== '') {
            return substr($hash, 0, 12);
        }
    }

    $latest = 0;
    $criticalFiles = [
        __DIR__ . '/public/assets/js/app.js',
        __DIR__ . '/public/assets/js/core/i18n.js',
        __DIR__ . '/public/assets/js/pages/settings/IntegrationSettings.js',
        __DIR__ . '/public/assets/js/pages/devices/DeviceDetail.js',
    ];

    foreach ($criticalFiles as $file) {
        if (is_file($file)) {
            $mtime = (int)@filemtime($file);
            if ($mtime > $latest) {
                $latest = $mtime;
            }
        }
    }

    $localesDir = __DIR__ . '/locales';
    if (is_dir($localesDir)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($localesDir, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $fileInfo) {
            /** @var SplFileInfo $fileInfo */
            if (!$fileInfo->isFile()) {
                continue;
            }
            if (strtolower($fileInfo->getExtension()) !== 'json') {
                continue;
            }
            $mtime = (int)$fileInfo->getMTime();
            if ($mtime > $latest) {
                $latest = $mtime;
            }
        }
    }

    if ($latest <= 0) {
        $latest = time();
    }

    return gmdate('YmdHis', $latest);
}

// Error handling
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function ($e) {
    if (class_exists('Logger')) {
        Logger::error('Unhandled exception', [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
    }

    if (defined('API_REQUEST') && API_REQUEST) {
        if (class_exists('Response')) {
            Response::error('Internal server error', 500);
        } else {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Internal server error']);
        }
    } else {
        http_response_code(500);
        echo "Internal Server Error";
    }
});

// Get request URI and calculate base path
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME'];

// Calculate base path (directory containing index.php)
$basePath = dirname($scriptName);
$basePath = str_replace('\\', '/', $basePath); // Windows compatibility
$basePath = $basePath === '/' ? '' : rtrim($basePath, '/');

// Remove base path from URI to get clean path
$uri = $requestUri;
if ($basePath && strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}
$uri = parse_url($uri, PHP_URL_PATH);
$uri = '/' . trim($uri, '/');

// Debug logging (remove in production)
// error_log("Request URI: $requestUri, Script: $scriptName, Base: $basePath, Clean URI: $uri");

// Check if this is an API request
if (strpos($uri, '/api/') === 0 || $uri === '/api') {
    define('API_REQUEST', true);

    // Route to API handler
    require_once API_PATH . '/index.php';
    exit;
}

// For SPA, serve index.html for all other routes
define('API_REQUEST', false);

// Check if request is for the player folder - let it use its own index.html
if (strpos($uri, '/player') === 0) {
    $playerPath = PUBLIC_PATH . $uri;

    // If it's a directory request, serve player's index.html
    if ($uri === '/player' || $uri === '/player/') {
        $playerIndex = PUBLIC_PATH . '/player/index.html';
        if (file_exists($playerIndex)) {
            header('Content-Type: text/html; charset=UTF-8');
            readfile($playerIndex);
            exit;
        }
    }

    // If it's a file request within player folder, serve the file
    if (is_file($playerPath)) {
        $extension = strtolower(pathinfo($playerPath, PATHINFO_EXTENSION));
        $mimeTypes = [
            'js' => 'application/javascript',
            'mjs' => 'application/javascript',
            'css' => 'text/css',
            'html' => 'text/html',
            'json' => 'application/json',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webmanifest' => 'application/manifest+json'
        ];
        $mimeType = $mimeTypes[$extension] ?? 'application/octet-stream';
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($playerPath));
        readfile($playerPath);
        exit;
    }

    // For SPA routes within player, serve player's index.html
    $playerIndex = PUBLIC_PATH . '/player/index.html';
    if (file_exists($playerIndex)) {
        header('Content-Type: text/html; charset=UTF-8');
        readfile($playerIndex);
        exit;
    }
}

// Check if request is for a static file in public folder
$publicFile = PUBLIC_PATH . $uri;
if (is_file($publicFile)) {
    // Serve the static file with correct MIME type
    $extension = strtolower(pathinfo($publicFile, PATHINFO_EXTENSION));
    $mimeTypes = [
        'js' => 'application/javascript',
        'mjs' => 'application/javascript',
        'css' => 'text/css',
        'html' => 'text/html',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'ico' => 'image/x-icon',
        'webmanifest' => 'application/manifest+json'
    ];

    $mimeType = $mimeTypes[$extension] ?? 'application/octet-stream';
    header('Content-Type: ' . $mimeType);
    if ($extension === 'json') {
        // Locale/settings JSON should always be refreshed on deploy.
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
    header('Content-Length: ' . filesize($publicFile));
    readfile($publicFile);
    exit;
}

// Serve SPA entry point
$indexFile = PUBLIC_PATH . '/index.html';
if (!file_exists($indexFile)) {
    http_response_code(404);
    echo "Application not found. Please run the installation.";
    exit;
}

// Read index.html content
$html = file_get_contents($indexFile);

// Calculate dynamic values for injection
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
    ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$origin = $protocol . '://' . $host;
$apiUrl = $origin . $basePath . '/api';
$buildVersion = omnexResolveBuildVersion();

// Create PHP-injected config script
$injectedConfig = <<<SCRIPT
<script id="omnex-config">
    // PHP-injected configuration
    window.OmnexConfig = {
        _phpInjected: true,
        appName: 'Omnex Display Hub',
        appVersion: '{$buildVersion}',
        apiUrl: '{$apiUrl}',
        basePath: '{$basePath}',
        defaultLanguage: 'tr',
        supportedLanguages: ['tr', 'en', 'ru', 'az', 'de', 'nl', 'fr', 'ar'],
        rtlLanguages: ['ar'],
        storageKeys: {
            token: 'omnex_token',
            refreshToken: 'omnex_refresh_token',
            user: 'omnex_user',
            layout: 'omnex_layout_config',
            theme: 'omnex_theme',
            language: 'omnex_language'
        }
    };
    console.log('[Config] PHP-injected, basePath:', '{$basePath}', 'API:', '{$apiUrl}');
    </script>
SCRIPT;

// Replace the config block between markers
$pattern = '/<!-- OMNEX_CONFIG_START -->.*?<!-- OMNEX_CONFIG_END -->/s';
if (preg_match($pattern, $html)) {
    $html = preg_replace($pattern, "<!-- OMNEX_CONFIG_START -->\n" . $injectedConfig . "\n    <!-- OMNEX_CONFIG_END -->", $html);
} else {
    // Fallback: inject before </head>
    $html = str_replace('</head>', $injectedConfig . "\n</head>", $html);
}

// Ensure app entry/modulepreload query version follows current build version.
$html = preg_replace(
    '/assets\/js\/app\.js\?v=[^"\']+/',
    'assets/js/app.js?v=' . $buildVersion,
    $html
);

// Output the modified HTML
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
echo $html;
