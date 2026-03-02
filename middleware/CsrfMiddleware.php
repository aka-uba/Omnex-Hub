<?php
/**
 * CsrfMiddleware - CSRF Token Validation Middleware
 *
 * @package OmnexDisplayHub
 */

class CsrfMiddleware
{
    /**
     * Methods that require CSRF validation
     */
    private static array $protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    /**
     * Paths that are exempt from CSRF validation (e.g., API auth endpoints)
     */
    private static array $exemptPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh-token',
        '/api/auth/forgot-password',
        '/api/auth/reset-password'
    ];

    /**
     * Handle the request
     */
    public function handle(Request $request, callable $next): void
    {
        $method = $request->getMethod();
        $path = $request->getPath();

        // Skip for GET, HEAD, OPTIONS requests
        if (!in_array($method, self::$protectedMethods)) {
            $next();
            return;
        }

        // Skip for exempt paths
        foreach (self::$exemptPaths as $exemptPath) {
            if ($path === $exemptPath || strpos($path, $exemptPath . '/') === 0) {
                $next();
                return;
            }
        }

        // Skip CSRF validation in development mode if configured
        if (!PRODUCTION_MODE && getenv('OMNEX_SKIP_CSRF') === 'true') {
            $next();
            return;
        }

        // Get CSRF token from header or request body
        $csrfToken = $request->header('X-CSRF-Token')
            ?? $request->input(CSRF_TOKEN_NAME)
            ?? null;

        if (!$csrfToken) {
            Response::forbidden('CSRF token eksik');
        }

        // Validate token
        if (!self::validateToken($csrfToken)) {
            Response::forbidden('Geçersiz CSRF token');
        }

        $next();
    }

    /**
     * Generate a new CSRF token
     */
    public static function generateToken(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION[CSRF_TOKEN_NAME] = $token;
        $_SESSION[CSRF_TOKEN_NAME . '_time'] = time();

        return $token;
    }

    /**
     * Validate a CSRF token
     */
    public static function validateToken(?string $token): bool
    {
        if (!$token) {
            return false;
        }

        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $storedToken = $_SESSION[CSRF_TOKEN_NAME] ?? null;
        $tokenTime = $_SESSION[CSRF_TOKEN_NAME . '_time'] ?? 0;

        // Token expires after 1 hour
        $tokenExpiry = 3600;
        if (time() - $tokenTime > $tokenExpiry) {
            unset($_SESSION[CSRF_TOKEN_NAME], $_SESSION[CSRF_TOKEN_NAME . '_time']);
            return false;
        }

        // Constant-time comparison to prevent timing attacks
        return hash_equals($storedToken ?? '', $token);
    }

    /**
     * Get current token or generate new one
     */
    public static function getToken(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $token = $_SESSION[CSRF_TOKEN_NAME] ?? null;
        $tokenTime = $_SESSION[CSRF_TOKEN_NAME . '_time'] ?? 0;

        // If no token or expired, generate new one
        if (!$token || (time() - $tokenTime > 3600)) {
            return self::generateToken();
        }

        return $token;
    }
}
