<?php
/**
 * Input Sanitization Middleware
 *
 * Prevents SQL injection, NoSQL injection, and command injection attacks
 * by filtering dangerous patterns from all input data.
 *
 * @package OmnexDisplayHub
 */

class InputSanitizeMiddleware
{
    /**
     * Dangerous patterns to detect and block
     */
    private static array $dangerousPatterns = [
        // SQL Injection patterns
        '/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i',
        '/(-{2}|\/\*|\*\/|;)/',  // SQL comments and terminators
        '/(\'|\"|`).*?(OR|AND).*?(\'|\"|`)/i', // String-based SQL injection
        '/(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i', // OR 1=1, AND 1=1 patterns

        // NoSQL Injection patterns (MongoDB, etc.)
        '/\$ne\b/', '/\$gt\b/', '/\$lt\b/', '/\$gte\b/', '/\$lte\b/',
        '/\$in\b/', '/\$nin\b/', '/\$or\b/', '/\$and\b/', '/\$not\b/',
        '/\$regex\b/', '/\$where\b/', '/\$exists\b/',

        // Command Injection patterns
        '/[;&|`$]/',  // Shell metacharacters
        '/(\\x00|\\x0a|\\x0d)/',  // Null bytes, newlines

        // Path Traversal patterns
        '/\.\.\//', '/\.\.\\\\/',

        // XSS patterns (additional layer)
        '/<script\b/i', '/<\/script>/i',
        '/on\w+\s*=/i',  // Event handlers (onclick=, onerror=, etc.)
        '/javascript:/i',
    ];

    /**
     * Fields that should skip deep sanitization
     * (e.g., password fields, rich text content, device info)
     */
    private static array $skipFields = [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'content',  // Rich text / HTML content
        'template_content',
        'html',
        // Device/Browser info fields (contain semicolons, special chars)
        'useragent',
        'user_agent',
        'userAgent',
        'fingerprint',
        'screen_resolution',
        'screenResolution',
        'timezone',
        'platform',
        // Product media fields (may contain URLs, JSON, special chars)
        'image_url',
        'images',
        'videos',
        'video_url',
        'storage_info',
        'cover_image',
        'thumbnail',
        'media_url',
        'file_path',
        'url',
        'items',  // Playlist/schedule items array (contains nested URLs)
        'pre_rendered_images',  // Base64 encoded images for bulk send
        'rendered_image_path',  // Pre-rendered image file path
        'image_base64',  // Base64 encoded render result
        'cached_images',  // Cached render image paths for auto-send
        // Company fields (may contain special characters)
        'address',  // Company address may contain semicolons, commas, etc.
    ];

    /**
     * Maximum input length for any field
     */
    private const MAX_INPUT_LENGTH = 100000;

    /**
     * Paths that should be exempt from sanitization for ALL methods
     * (file uploads, imports, exports, device communication, etc.)
     */
    private static array $exemptPaths = [
        '/api/products/import',
        '/api/products/import/preview',
        '/api/products/import/analyze',
        '/api/products/export',
        '/api/media/upload',
        '/api/media/scan',
        '/api/media/browse',
        '/api/branding/upload',
        '/api/users/upload-avatar',
        '/api/esl-gateway',  // Device communication
        '/api/esl/',  // ESL device API
        '/api/player/',  // Player API
        '/api/proxy/',  // Web page proxy for iframe display
        '/api/render-cache/',  // Render cache API (handles base64 images)
    ];

    /**
     * Method+path based exemptions for routes that need to accept complex content
     * Only POST/PUT are exempt; GET requests are still sanitized.
     */
    private static array $exemptRoutes = [
        'POST:/api/templates'        => true,
        'PUT:/api/templates'         => true,
        'POST:/api/playlists'        => true,
        'PUT:/api/playlists'         => true,
        'POST:/api/schedules'        => true,
        'PUT:/api/schedules'         => true,
        'POST:/api/render-queue'     => true,
        'POST:/api/logs/cleanup'     => true,
        'POST:/api/hanshow/callback' => true,
        'POST:/api/layout/config'    => true,
        'PUT:/api/layout/config'     => true,
    ];

    /**
     * Handle the middleware
     */
    public static function handle(Request $request): bool
    {
        // Check if path is exempt from sanitization
        $path = $request->getPath();

        // 1. Check all-method exempt paths (uploads, imports, device APIs)
        foreach (self::$exemptPaths as $exemptPath) {
            if (strpos($path, $exemptPath) !== false) {
                return true; // Skip sanitization for exempt paths
            }
        }

        // 2. Check method+path based exemptions (only POST/PUT for complex content routes)
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        foreach (self::$exemptRoutes as $exemptRoute => $val) {
            [$exemptMethod, $exemptPath] = explode(':', $exemptRoute, 2);
            if ($method === $exemptMethod && strpos($path, $exemptPath) === 0) {
                return true; // Skip sanitization for exempt method+path
            }
        }

        // Get all input data
        $body = $request->body();
        $query = $request->queryAll();

        // Sanitize body
        if (!empty($body)) {
            $sanitizedBody = self::sanitizeRecursive($body);

            // Check for dangerous patterns
            $threat = self::detectThreats($body);
            if ($threat) {
                Logger::warning('Input sanitization blocked request', [
                    'threat_type' => $threat['type'],
                    'field' => $threat['field'],
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                    'path' => $request->getPath()
                ]);

                Response::json([
                    'success' => false,
                    'message' => 'Invalid input detected',
                    'error_code' => 'INVALID_INPUT'
                ], 400);
                return false;
            }
        }

        // Sanitize query params
        if (!empty($query)) {
            $threat = self::detectThreats($query);
            if ($threat) {
                Logger::warning('Query param sanitization blocked request', [
                    'threat_type' => $threat['type'],
                    'field' => $threat['field'],
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                    'path' => $request->getPath()
                ]);

                Response::json([
                    'success' => false,
                    'message' => 'Invalid query parameter',
                    'error_code' => 'INVALID_QUERY'
                ], 400);
                return false;
            }
        }

        return true;
    }

    /**
     * Detect threats in input data
     */
    private static function detectThreats(array $data, string $prefix = ''): ?array
    {
        foreach ($data as $key => $value) {
            $fieldName = $prefix ? "{$prefix}.{$key}" : $key;

            // Skip certain fields
            if (in_array(strtolower($key), self::$skipFields)) {
                continue;
            }

            if (is_array($value)) {
                $threat = self::detectThreats($value, $fieldName);
                if ($threat) {
                    return $threat;
                }
            } elseif (is_string($value)) {
                // Check length
                if (strlen($value) > self::MAX_INPUT_LENGTH) {
                    return [
                        'type' => 'MAX_LENGTH_EXCEEDED',
                        'field' => $fieldName
                    ];
                }

                // Check for dangerous patterns
                foreach (self::$dangerousPatterns as $index => $pattern) {
                    if (preg_match($pattern, $value)) {
                        // Allow certain patterns in specific contexts
                        if (self::isAllowedContext($key, $value, $pattern)) {
                            continue;
                        }

                        return [
                            'type' => self::getPatternType($index),
                            'field' => $fieldName,
                            'pattern_index' => $index
                        ];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if pattern is allowed in specific context
     */
    private static function isAllowedContext(string $key, string $value, string $pattern): bool
    {
        // Allow SQL keywords in search/filter contexts
        $searchFields = ['search', 'q', 'query', 'filter', 'sort', 'order'];
        if (in_array(strtolower($key), $searchFields)) {
            // Only allow if it's a simple search term (no special chars around SQL keywords)
            if (preg_match('/^[\w\s\-\.]+$/', $value)) {
                return true;
            }
        }

        // Allow semicolons in certain fields
        $semicolonAllowed = ['description', 'notes', 'message', 'comment'];
        if (in_array(strtolower($key), $semicolonAllowed) && $pattern === '/(-{2}|\/\*|\*\/|;)/') {
            // Only block if it looks like SQL injection attempt
            if (!preg_match('/;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i', $value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get threat type name from pattern index
     */
    private static function getPatternType(int $index): string
    {
        if ($index < 4) return 'SQL_INJECTION';
        if ($index < 13) return 'NOSQL_INJECTION';
        if ($index < 15) return 'COMMAND_INJECTION';
        if ($index < 17) return 'PATH_TRAVERSAL';
        return 'XSS_ATTEMPT';
    }

    /**
     * Recursively sanitize input data
     */
    private static function sanitizeRecursive(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            // Sanitize key
            $sanitizedKey = self::sanitizeKey($key);

            if (is_array($value)) {
                $result[$sanitizedKey] = self::sanitizeRecursive($value);
            } elseif (is_string($value)) {
                // Skip sanitization for certain fields
                if (in_array(strtolower($key), self::$skipFields)) {
                    $result[$sanitizedKey] = $value;
                } else {
                    $result[$sanitizedKey] = self::sanitizeValue($value);
                }
            } else {
                $result[$sanitizedKey] = $value;
            }
        }

        return $result;
    }

    /**
     * Sanitize array key
     */
    private static function sanitizeKey(string $key): string
    {
        // Only allow alphanumeric, underscore, and hyphen
        return preg_replace('/[^a-zA-Z0-9_\-]/', '', $key);
    }

    /**
     * Sanitize string value
     */
    private static function sanitizeValue(string $value): string
    {
        // Remove null bytes
        $value = str_replace(chr(0), '', $value);

        // Trim excessive whitespace
        $value = preg_replace('/\s+/', ' ', trim($value));

        // Remove control characters (except newlines and tabs)
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);

        return $value;
    }

    /**
     * Utility: Sanitize a single value (for use in other parts of app)
     */
    public static function sanitize(string $input): string
    {
        return self::sanitizeValue($input);
    }

    /**
     * Utility: Check if input contains threats
     */
    public static function containsThreats(string $input): bool
    {
        foreach (self::$dangerousPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                return true;
            }
        }
        return false;
    }
}
