<?php
/**
 * Omnex Display Hub - Main Entry Point
 *
 * This file serves the SPA with automatic cache busting.
 * All CSS/JS files are versioned based on their modification time.
 */

// Load configuration
// Sunucu: index.php root'ta, Local: index.php public/ içinde
$configPath = file_exists(__DIR__ . '/config.php')
    ? __DIR__ . '/config.php'
    : dirname(__DIR__) . '/config.php';

if (file_exists($configPath)) {
    require_once $configPath;
}

// Load cache helper
$cachePath = file_exists(__DIR__ . '/core/Cache.php')
    ? __DIR__ . '/core/Cache.php'
    : dirname(__DIR__) . '/core/Cache.php';
require_once $cachePath;

// Send no-cache headers in development
Cache::sendNoCacheHeaders();

// Get versioning info
$isDev = Cache::isDevelopment();
$buildHash = Cache::getBuildHash();

// Helper function for versioned URLs
function v($path) {
    return Cache::url($path);
}
?>
<!DOCTYPE html>
<html lang="tr" dir="ltr" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Omnex Display Hub - Dijital Etiket ve Signage Yönetim Platformu">
    <meta name="theme-color" content="#228be6">

    <title>Omnex Display Hub</title>

    <!-- PWA -->
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="branding/icon-192.png">
    <link rel="apple-touch-icon" sizes="192x192" href="branding/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="branding/icon-512.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Omnex Hub">
    <meta name="mobile-web-app-capable" content="yes">

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="branding/favicon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="branding/favicon.png">
    <link rel="icon" type="image/png" sizes="16x16" href="branding/favicon.png">
    <link rel="icon" type="image/png" sizes="192x192" href="branding/icon-192.png">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Tabler Icons (Local Vendor) -->
    <link rel="stylesheet" href="assets/vendor/tabler-icons/tabler-icons.min.css">

    <!-- Main Stylesheet (auto-versioned) -->
    <link rel="stylesheet" href="<?= v('assets/css/main.css') ?>">
    <link rel="stylesheet" href="<?= v('assets/css/app.css') ?>">
    <link rel="stylesheet" href="<?= v('assets/css/theme-configurator.css') ?>">

    <!-- Preload critical JS -->
    <link rel="modulepreload" href="<?= v('assets/js/app.js') ?>">

    <!-- OMNEX_CONFIG_START -->
    <script id="omnex-config">
    (function() {
        // PHP-injected configuration
        var origin = window.location.origin;
        var basePath = <?= json_encode(defined('WEB_PATH') ? WEB_PATH : '', JSON_UNESCAPED_SLASHES) ?>;

        // If basePath not set by PHP, detect from URL
        if (!basePath) {
            var fullPath = window.location.pathname;
            fullPath = fullPath.split('?')[0].split('#')[0];
            fullPath = fullPath.replace(/\/index\.(html|php)$/i, '');
            fullPath = fullPath.replace(/\/$/, '');
            basePath = fullPath;
        }

        var apiUrl = origin + basePath + '/api';

        window.OmnexConfig = {
            _phpInjected: true,
            appName: 'Omnex Display Hub',
            appVersion: '<?= $buildHash ?>',
            apiUrl: apiUrl,
            basePath: basePath,
            defaultLanguage: 'tr',
            supportedLanguages: ['tr', 'en', 'ar'],
            rtlLanguages: ['ar'],
            isDevelopment: <?= $isDev ? 'true' : 'false' ?>,
            storageKeys: {
                token: 'omnex_token',
                refreshToken: 'omnex_refresh_token',
                user: 'omnex_user',
                layout: 'omnex_layout_config',
                theme: 'omnex_theme',
                language: 'omnex_language'
            }
        };
    })();
    </script>
    <!-- OMNEX_CONFIG_END -->

    <!-- Cache Management Script -->
    <?= Cache::getClientCacheScript() ?>
</head>

<body class="bg-secondary text-primary antialiased">
    <!-- App Root -->
    <div id="app">
        <!-- Loading Screen -->
        <div id="loading-screen" class="fixed inset-0 z-50 flex items-center justify-center bg-primary">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 mb-4">
                    <svg class="animate-spin w-10 h-10 text-brand" xmlns="http://www.w3.org/2000/svg" fill="none"
                        viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                        </path>
                    </svg>
                </div>
                <h2 class="text-xl font-semibold text-primary">Omnex Display Hub</h2>
                <p class="text-sm text-muted mt-1">Yükleniyor...</p>
            </div>
        </div>
    </div>

    <!-- Toast Container -->
    <div id="toast-container" class="toast-container bottom-right"></div>

    <!-- Modal Container -->
    <div id="modal-container"></div>

    <!-- Early initialization -->
    <script>
        // Theme detection
        (function() {
            var stored = localStorage.getItem('omnex_theme');
            var theme = stored || 'light';
            if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
                document.documentElement.dataset.theme = 'dark';
            }
        })();

        // Modal cleanup
        (function() {
            var modals = document.querySelectorAll('.modal-overlay');
            for (var i = 0; i < modals.length; i++) modals[i].remove();
            document.body.classList.remove('modal-open');
        })();
    </script>

    <script type="module" src="<?= v('assets/js/app.js') ?>"></script>

    <!-- Service Worker -->
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                // Add build hash to SW URL to force update when build changes
                var swUrl = './sw.js?v=<?= $buildHash ?>';
                navigator.serviceWorker.register(swUrl, { scope: './' })
                    .then(function(reg) {
                        console.log('[SW] Registered:', reg.scope);

                        // Check for updates
                        reg.addEventListener('updatefound', function() {
                            console.log('[SW] Update found, new version installing...');
                        });

                        // In development, always check for updates
                        if (window.OmnexConfig && window.OmnexConfig.isDevelopment) {
                            reg.update();
                        }
                    })
                    .catch(function(err) { console.warn('[SW] Failed:', err); });
            });

            // Listen for SW updates
            navigator.serviceWorker.addEventListener('controllerchange', function() {
                console.log('[SW] Controller changed, reloading...');
                // Only reload if not already reloading
                if (!window._swReloading) {
                    window._swReloading = true;
                    window.location.reload();
                }
            });
        }
    </script>
</body>

</html>
