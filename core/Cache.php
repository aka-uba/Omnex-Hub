<?php
/**
 * Cache Helper
 *
 * Provides automatic cache busting based on file modification time.
 * Generates version strings for CSS/JS files.
 *
 * @package OmnexDisplayHub
 */

class Cache {

    /**
     * Cache version prefix (increment to force full cache clear)
     */
    const VERSION_PREFIX = '1.0.36';

    /**
     * Development mode flag
     */
    private static $isDevelopment = null;

    /**
     * Check if running in development mode
     */
    public static function isDevelopment(): bool {
        if (self::$isDevelopment === null) {
            $host = $_SERVER['HTTP_HOST'] ?? '';
            self::$isDevelopment = (
                strpos($host, 'localhost') !== false ||
                strpos($host, '127.0.0.1') !== false ||
                strpos($host, '192.168.') !== false ||
                strpos($host, '10.') !== false ||
                preg_match('/\.local$/', $host)
            );
        }
        return self::$isDevelopment;
    }

    /**
     * Get version string for a file based on modification time
     *
     * @param string $filePath Relative path from public directory
     * @return string Version string
     */
    public static function version(string $filePath): string {
        // In development, ALWAYS use current timestamp to bypass all caching
        if (self::isDevelopment()) {
            return self::VERSION_PREFIX . '.' . time() . '.' . mt_rand(1000, 9999);
        }

        $basePath = defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__);
        $fullPath = $basePath . '/public/' . ltrim($filePath, '/');

        if (file_exists($fullPath)) {
            $mtime = filemtime($fullPath);
            // In production, use shorter hash based on file modification time
            return self::VERSION_PREFIX . '.' . substr(md5($mtime), 0, 8);
        }

        // Fallback to prefix only
        return self::VERSION_PREFIX;
    }

    /**
     * Get versioned URL for a file
     *
     * @param string $filePath Relative path
     * @return string URL with version query param
     */
    public static function url(string $filePath): string {
        $version = self::version($filePath);
        $separator = strpos($filePath, '?') !== false ? '&' : '?';
        return $filePath . $separator . 'v=' . $version;
    }

    /**
     * Get cache control headers for development
     *
     * @return array Headers to set
     */
    public static function getNoCacheHeaders(): array {
        return [
            'Cache-Control' => 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => 'Thu, 01 Jan 1970 00:00:00 GMT'
        ];
    }

    /**
     * Send no-cache headers (for development)
     */
    public static function sendNoCacheHeaders(): void {
        if (self::isDevelopment() && !headers_sent()) {
            foreach (self::getNoCacheHeaders() as $name => $value) {
                header("$name: $value");
            }
        }
    }

    /**
     * Get unique build identifier based on critical files
     *
     * @return string Build hash
     */
    public static function getBuildHash(): string {
        $basePath = defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__);
        $criticalFiles = [
            '/public/assets/js/app.js',
            '/public/assets/css/main.css',
            '/public/index.html'
        ];

        $timestamps = [];
        foreach ($criticalFiles as $file) {
            $fullPath = $basePath . $file;
            if (file_exists($fullPath)) {
                $timestamps[] = filemtime($fullPath);
            }
        }

        if (empty($timestamps)) {
            return self::VERSION_PREFIX;
        }

        return self::VERSION_PREFIX . '.' . substr(md5(implode('-', $timestamps)), 0, 8);
    }

    /**
     * Clear opcache if available (for PHP file changes)
     */
    public static function clearOpcache(): bool {
        if (function_exists('opcache_reset')) {
            return opcache_reset();
        }
        return false;
    }

    /**
     * Get JS code for client-side cache management
     *
     * @return string JavaScript code
     */
    public static function getClientCacheScript(): string {
        $buildHash = self::getBuildHash();
        $isDev = self::isDevelopment() ? 'true' : 'false';

        return <<<JS
<script>
(function() {
    window.OmnexCache = {
        version: '{$buildHash}',
        isDevelopment: {$isDev},

        // Check if cache needs clearing
        checkVersion: function() {
            var stored = localStorage.getItem('omnex_cache_version');
            if (stored !== this.version) {
                this.clearAll();
                localStorage.setItem('omnex_cache_version', this.version);
                return true;
            }
            return false;
        },

        // Clear all caches
        clearAll: function() {
            // Clear Service Worker caches
            if ('caches' in window) {
                caches.keys().then(function(names) {
                    names.forEach(function(name) {
                        caches.delete(name);
                    });
                });
            }

            // Tell SW to skip waiting
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
            }

            console.log('[Cache] All caches cleared, version:', this.version);
        },

        // Force reload without cache
        forceReload: function() {
            this.clearAll();
            setTimeout(function() {
                window.location.reload(true);
            }, 100);
        }
    };

    // Auto-check version on load
    if (window.OmnexCache.checkVersion()) {
        console.log('[Cache] New version detected, caches cleared');
    }

    // In development, always clear on load
    if (window.OmnexCache.isDevelopment) {
        // Clear on every page load in development
        window.OmnexCache.clearAll();
    }
})();
</script>
JS;
    }
}
