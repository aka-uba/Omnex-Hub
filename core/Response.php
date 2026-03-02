<?php
/**
 * Response - HTTP Response Handler
 *
 * @package OmnexDisplayHub
 */

class Response
{
    /**
     * Send JSON response and exit
     */
    public static function json(array $data, int $status = 200): never
    {
        // If an included file accidentally emitted output (e.g., BOM/whitespace),
        // clear it so headers + JSON response remain valid.
        if (ob_get_level() > 0) {
            @ob_clean();
        }

        http_response_code($status);

        // Security headers
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');

        // CORS headers
        self::cors();

        // Encode with security flags
        echo json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Success response
     */
    public static function success(mixed $data = null, string $message = 'Success', int $status = 200): never
    {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $status);
    }

    /**
     * Error response
     */
    public static function error(string $message, int $status = 400, array $errors = []): never
    {
        $response = [
            'success' => false,
            'message' => $message
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        self::json($response, $status);
    }

    /**
     * Validation error response
     */
    public static function validationError(array $errors): never
    {
        self::json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $errors
        ], 422);
    }

    /**
     * Bad request response
     */
    public static function badRequest(string $message = 'Bad request'): never
    {
        self::error($message, 400);
    }

    /**
     * Not found response
     */
    public static function notFound(string $message = 'Resource not found'): never
    {
        self::error($message, 404);
    }

    /**
     * Unauthorized response
     */
    public static function unauthorized(string $message = 'Unauthorized'): never
    {
        self::error($message, 401);
    }

    /**
     * Forbidden response
     */
    public static function forbidden(string $message = 'Access denied'): never
    {
        self::error($message, 403);
    }

    /**
     * Method not allowed response
     */
    public static function methodNotAllowed(string $message = 'Method not allowed'): never
    {
        self::error($message, 405);
    }

    /**
     * Too many requests response
     */
    public static function tooManyRequests(int $retryAfter = 60): never
    {
        header("Retry-After: $retryAfter");
        self::json([
            'success' => false,
            'message' => 'Too many requests',
            'retry_after' => $retryAfter
        ], 429);
    }

    /**
     * Server error response
     */
    public static function serverError(string $message = 'Internal server error'): never
    {
        self::error($message, 500);
    }

    /**
     * Created response
     */
    public static function created(mixed $data, string $message = 'Created successfully'): never
    {
        self::success($data, $message, 201);
    }

    /**
     * No content response
     */
    public static function noContent(): never
    {
        http_response_code(204);
        exit;
    }

    /**
     * Paginated response
     */
    public static function paginated(array $items, int $total, int $page, int $perPage): never
    {
        $totalPages = ceil($total / $perPage);

        self::json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => $totalPages,
                'has_more' => $page < $totalPages
            ]
        ]);
    }

    /**
     * Download file response
     */
    public static function download(string $content, string $filename, string $contentType = 'application/octet-stream'): never
    {
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($content));
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');

        echo $content;
        exit;
    }

    /**
     * Redirect response
     */
    public static function redirect(string $url, int $status = 302): never
    {
        header("Location: $url", true, $status);
        exit;
    }

    /**
     * Set CORS headers
     */
    public static function cors(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = false;

        // Check if origin is in allowed list
        if (in_array($origin, CORS_ALLOWED_ORIGINS) || in_array('*', CORS_ALLOWED_ORIGINS)) {
            $allowed = true;
        }
        // Check if local network access is enabled and origin is from local network
        elseif (defined('CORS_ALLOW_LOCAL_NETWORK') && CORS_ALLOW_LOCAL_NETWORK && self::isLocalNetworkOrigin($origin)) {
            $allowed = true;
        }

        if ($allowed && $origin) {
            header("Access-Control-Allow-Origin: $origin");
        }

        header('Access-Control-Allow-Methods: ' . implode(', ', CORS_ALLOWED_METHODS));
        header('Access-Control-Allow-Headers: ' . implode(', ', CORS_ALLOWED_HEADERS));
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
    }

    /**
     * Check if origin is from local network
     * Supports: 192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, 127.0.0.1
     */
    private static function isLocalNetworkOrigin(string $origin): bool
    {
        if (empty($origin)) {
            return false;
        }

        // Parse origin URL
        $parsed = parse_url($origin);
        if (!isset($parsed['host'])) {
            return false;
        }

        $host = $parsed['host'];

        // Check for localhost variants
        if (in_array($host, ['localhost', '127.0.0.1', '::1'])) {
            return true;
        }

        // Check for local network IP ranges
        $ip = gethostbyname($host);
        if ($ip === $host) {
            // Could not resolve, might be a hostname
            return false;
        }

        // Check if IP is in private network ranges
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }

    /**
     * Handle preflight OPTIONS request
     */
    public static function preflight(): never
    {
        self::cors();
        http_response_code(204);
        exit;
    }
}
