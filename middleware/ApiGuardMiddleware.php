<?php
/**
 * API Guard Middleware
 *
 * Comprehensive API security layer that handles:
 * - Origin/CORS validation
 * - Rate limiting
 * - Request fingerprinting
 * - Brute force protection
 *
 * @package OmnexDisplayHub
 */

class ApiGuardMiddleware
{
    /**
     * Allowed origins (configured in config.php or here)
     */
    private static array $allowedOrigins = [];

    /**
     * Rate limit settings per endpoint type
     */
    private static array $rateLimits = [
        'default' => ['limit' => 300, 'window' => 60],      // 300 req/min (increased for media library)
        'auth' => ['limit' => 10, 'window' => 60],          // 10 req/min (login, register)
        'upload' => ['limit' => 20, 'window' => 60],        // 20 req/min
        'export' => ['limit' => 5, 'window' => 60],         // 5 req/min
        'admin' => ['limit' => 50, 'window' => 60],         // 50 req/min
        'media' => ['limit' => 500, 'window' => 60],        // 500 req/min (thumbnails, etc.)
    ];

    /**
     * Endpoints that require stricter rate limiting
     */
    private static array $strictEndpoints = [
        '/api/auth/login' => 'auth',
        '/api/auth/register' => 'auth',
        '/api/auth/forgot-password' => 'auth',
        '/api/auth/reset-password' => 'auth',
        '/api/media/upload' => 'upload',
        '/api/products/import' => 'upload',
        '/api/products/export' => 'export',
        '/api/branding/upload' => 'upload',
    ];

    /**
     * Handle the middleware
     */
    public static function handle(Request $request): bool
    {
        // 1. Origin validation
        if (!self::validateOrigin($request)) {
            Logger::warning('Origin validation failed', [
                'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'none',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'path' => $request->getPath()
            ]);
            Response::json([
                'success' => false,
                'message' => 'Invalid origin',
                'error_code' => 'INVALID_ORIGIN'
            ], 403);
            return false;
        }

        // 2. Rate limiting
        $rateLimitResult = self::checkRateLimit($request);
        if (!$rateLimitResult['allowed']) {
            Logger::warning('Rate limit exceeded', [
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'path' => $request->getPath(),
                'limit' => $rateLimitResult['limit'],
                'reset' => $rateLimitResult['reset']
            ]);

            // Add rate limit headers
            header('X-RateLimit-Limit: ' . $rateLimitResult['limit']);
            header('X-RateLimit-Remaining: 0');
            header('X-RateLimit-Reset: ' . $rateLimitResult['reset']);
            header('Retry-After: ' . ($rateLimitResult['reset'] - time()));

            Response::json([
                'success' => false,
                'message' => 'Too many requests. Please try again later.',
                'error_code' => 'RATE_LIMIT_EXCEEDED',
                'retry_after' => $rateLimitResult['reset'] - time()
            ], 429);
            return false;
        }

        // Add rate limit headers for successful requests
        header('X-RateLimit-Limit: ' . $rateLimitResult['limit']);
        header('X-RateLimit-Remaining: ' . $rateLimitResult['remaining']);
        header('X-RateLimit-Reset: ' . $rateLimitResult['reset']);

        return true;
    }

    /**
     * Validate request origin
     */
    private static function validateOrigin(Request $request): bool
    {
        // Skip for CLI requests
        if (php_sapi_name() === 'cli') {
            return true;
        }

        // Get origin header
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null;

        // If no origin, treat as non-browser/system client request.
        // Gateway, ESL devices, health checks and monitoring tools
        // usually do not send Origin/Referer headers.
        if (!$origin) {
            // Check Referer as fallback for same-origin detection
            $referer = $_SERVER['HTTP_REFERER'] ?? null;
            if ($referer) {
                $refererHost = self::normalizeHost($referer);
                $serverHost = self::normalizeHost($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '');

                // Same host is OK
                if ($refererHost !== '' && $serverHost !== '' && $refererHost === $serverHost) {
                    return true;
                }

                // Browser-sourced request with foreign referer:
                // keep strict behavior in production.
                return !self::isProduction();
            }

            // No Origin + no Referer: allow machine-to-machine calls in all envs.
            return true;
        }

        // Parse origin
        $originHost = self::normalizeHost($origin);
        $serverHost = self::normalizeHost($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '');

        // Same origin is always OK
        if ($originHost !== '' && $serverHost !== '' && $originHost === $serverHost) {
            self::setCorsHeaders($origin);
            return true;
        }

        // Check allowed origins list
        $allowedOrigins = self::getAllowedOrigins();
        foreach ($allowedOrigins as $allowed) {
            // Exact match
            if ($origin === $allowed) {
                self::setCorsHeaders($origin);
                return true;
            }

            // Wildcard subdomain match (e.g., *.example.com)
            if (strpos($allowed, '*.') === 0) {
                $domain = substr($allowed, 2);
                if (str_ends_with($originHost, $domain)) {
                    self::setCorsHeaders($origin);
                    return true;
                }
            }
        }

        // In development, allow localhost variants and local network
        if (!self::isProduction()) {
            $localHosts = ['localhost', '127.0.0.1', '::1'];
            foreach ($localHosts as $local) {
                if ($originHost === $local) {
                    self::setCorsHeaders($origin);
                    return true;
                }
            }

            // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            if (str_starts_with($originHost, '192.168.') ||
                str_starts_with($originHost, '10.') ||
                preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $originHost)) {
                self::setCorsHeaders($origin);
                return true;
            }
        }

        // Check config for local network allowance
        if (defined('CORS_ALLOW_LOCAL_NETWORK') && CORS_ALLOW_LOCAL_NETWORK) {
            if (str_starts_with($originHost, '192.168.') ||
                str_starts_with($originHost, '10.') ||
                preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $originHost)) {
                self::setCorsHeaders($origin);
                return true;
            }
        }

        return false;
    }

    /**
     * Normalize host value from URL or host header.
     */
    private static function normalizeHost(?string $value): string
    {
        $value = trim((string)$value);
        if ($value === '') {
            return '';
        }

        $host = parse_url($value, PHP_URL_HOST);
        if (is_string($host) && $host !== '') {
            return strtolower($host);
        }

        if (!str_contains($value, '://')) {
            $host = parse_url('http://' . $value, PHP_URL_HOST);
            if (is_string($host) && $host !== '') {
                return strtolower($host);
            }
        }

        // Last fallback for plain host:port values.
        return strtolower((string)preg_replace('/:\d+$/', '', $value));
    }

    /**
     * Set CORS headers
     */
    private static function setCorsHeaders(string $origin): void
    {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Active-Company, X-Requested-With, X-DEVICE-TOKEN');
        header('Access-Control-Max-Age: 86400'); // 24 hours
    }

    /**
     * Get allowed origins from config
     */
    private static function getAllowedOrigins(): array
    {
        $origins = [];

        // Check if defined in config as array
        if (defined('ALLOWED_ORIGINS') && is_array(ALLOWED_ORIGINS)) {
            $origins = array_merge($origins, ALLOWED_ORIGINS);
        }

        // Add configured single origin if available
        if (defined('ALLOWED_ORIGIN') && ALLOWED_ORIGIN) {
            $origins[] = ALLOWED_ORIGIN;
        }

        // Add current host as both http and https
        $host = $_SERVER['HTTP_HOST'] ?? '';
        if ($host) {
            $origins[] = 'https://' . $host;
            $origins[] = 'http://' . $host;
        }

        // Include static allowedOrigins
        $origins = array_merge($origins, self::$allowedOrigins);

        return array_unique($origins);
    }

    /**
     * Check if running in development mode
     */
    private static function isDevelopment(): bool
    {
        return !defined('PRODUCTION_MODE') || !PRODUCTION_MODE;
    }

    /**
     * Check rate limit
     */
    private static function checkRateLimit(Request $request): array
    {
        $path = $request->getPath();
        $method = $request->getMethod();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        // Determine rate limit type
        $limitType = 'default';
        foreach (self::$strictEndpoints as $endpoint => $type) {
            if (strpos($path, $endpoint) === 0) {
                $limitType = $type;
                break;
            }
        }

        // Admin endpoints
        if (strpos($path, '/api/admin') !== false ||
            strpos($path, '/api/companies') !== false ||
            strpos($path, '/api/licenses') !== false ||
            strpos($path, '/api/audit-logs') !== false) {
            $limitType = 'admin';
        }

        // Media endpoints (higher limit for thumbnails)
        if (strpos($path, '/api/media') !== false) {
            $limitType = 'media';
        }

        $settings = self::$rateLimits[$limitType];

        // Create unique key for this rate limit bucket
        $key = md5($ip . ':' . $limitType);
        $cacheFile = STORAGE_PATH . '/cache/rate_' . $key . '.json';

        // Ensure cache directory exists
        $cacheDir = dirname($cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }

        // Get current count
        $data = ['count' => 0, 'reset' => time() + $settings['window']];
        if (file_exists($cacheFile)) {
            $stored = json_decode(file_get_contents($cacheFile), true);
            if ($stored && $stored['reset'] > time()) {
                $data = $stored;
            }
        }

        // Increment count
        $data['count']++;

        // Save
        file_put_contents($cacheFile, json_encode($data), LOCK_EX);

        return [
            'allowed' => $data['count'] <= $settings['limit'],
            'limit' => $settings['limit'],
            'remaining' => max(0, $settings['limit'] - $data['count']),
            'reset' => $data['reset']
        ];
    }

    /**
     * Check if running in production
     */
    private static function isProduction(): bool
    {
        return defined('PRODUCTION_MODE') && PRODUCTION_MODE;
    }

    /**
     * Handle OPTIONS preflight request
     *
     * Security fix F3.1: Validate origin before setting CORS headers.
     * In production, unknown origins are rejected with 403.
     */
    public static function handlePreflight(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (self::isDevelopment()) {
            // Dev mode: allow all origins
            self::setCorsHeaders($origin ?: '*');
        } else {
            // Production: validate origin against allowed list
            $allowedOrigins = self::getAllowedOrigins();
            if ($origin && in_array($origin, $allowedOrigins)) {
                self::setCorsHeaders($origin);
            } elseif (!$origin) {
                // No origin header (e.g. same-origin or non-browser) - allow with wildcard
                self::setCorsHeaders('*');
            } else {
                // Unknown origin in production - reject with no CORS headers
                http_response_code(403);
                exit;
            }
        }

        http_response_code(204);
        exit;
    }

    /**
     * Clean expired rate limit cache
     */
    public static function cleanCache(): int
    {
        $cacheDir = STORAGE_PATH . '/cache';
        if (!is_dir($cacheDir)) {
            return 0;
        }

        $cleaned = 0;
        $files = glob($cacheDir . '/rate_*.json');

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (!$data || ($data['reset'] ?? 0) <= time()) {
                unlink($file);
                $cleaned++;
            }
        }

        return $cleaned;
    }
}
