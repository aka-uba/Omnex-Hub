<?php
/**
 * Security - Security Utilities (CSRF, XSS, Rate Limiting)
 *
 * @package OmnexDisplayHub
 */

class Security
{
    private static array $rateLimitCache = [];

    /**
     * Generate CSRF token
     */
    public static function generateCsrfToken(): string
    {
        if (empty($_SESSION[CSRF_TOKEN_NAME])) {
            $_SESSION[CSRF_TOKEN_NAME] = bin2hex(random_bytes(32));
        }
        return $_SESSION[CSRF_TOKEN_NAME];
    }

    /**
     * Validate CSRF token
     */
    public static function validateCsrfToken(?string $token): bool
    {
        if (empty($token) || empty($_SESSION[CSRF_TOKEN_NAME])) {
            return false;
        }
        return hash_equals($_SESSION[CSRF_TOKEN_NAME], $token);
    }

    /**
     * Regenerate CSRF token
     */
    public static function regenerateCsrfToken(): string
    {
        $_SESSION[CSRF_TOKEN_NAME] = bin2hex(random_bytes(32));
        return $_SESSION[CSRF_TOKEN_NAME];
    }

    /**
     * Escape output to prevent XSS
     */
    public static function escape(string $input): string
    {
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Escape array values recursively
     */
    public static function escapeArray(array $data): array
    {
        return array_map(function ($value) {
            if (is_string($value)) {
                return self::escape($value);
            }
            if (is_array($value)) {
                return self::escapeArray($value);
            }
            return $value;
        }, $data);
    }

    /**
     * Sanitize string input
     */
    public static function sanitize(string $input): string
    {
        // Remove null bytes
        $input = str_replace(chr(0), '', $input);
        // Trim whitespace
        $input = trim($input);
        // Remove control characters except newlines and tabs
        $input = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $input);
        return $input;
    }

    /**
     * Check rate limit
     */
    public static function checkRateLimit(string $key, ?int $limit = null, ?int $window = null): bool
    {
        $limit = $limit ?? RATE_LIMIT_REQUESTS;
        $window = $window ?? RATE_LIMIT_WINDOW;

        $cacheFile = STORAGE_PATH . '/cache/rate_limit_' . md5($key) . '.json';

        $data = ['count' => 0, 'reset' => time() + $window];

        if (file_exists($cacheFile)) {
            $stored = json_decode(file_get_contents($cacheFile), true);
            if ($stored && $stored['reset'] > time()) {
                $data = $stored;
            }
        }

        $data['count']++;

        // Save updated data
        $cacheDir = dirname($cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        file_put_contents($cacheFile, json_encode($data), LOCK_EX);

        return $data['count'] <= $limit;
    }

    /**
     * Get remaining rate limit
     */
    public static function getRateLimitRemaining(string $key, ?int $limit = null): int
    {
        $limit = $limit ?? RATE_LIMIT_REQUESTS;
        $cacheFile = STORAGE_PATH . '/cache/rate_limit_' . md5($key) . '.json';

        if (!file_exists($cacheFile)) {
            return $limit;
        }

        $data = json_decode(file_get_contents($cacheFile), true);
        if (!$data || $data['reset'] <= time()) {
            return $limit;
        }

        return max(0, $limit - $data['count']);
    }

    /**
     * Get rate limit reset time
     */
    public static function getRateLimitReset(string $key): int
    {
        $cacheFile = STORAGE_PATH . '/cache/rate_limit_' . md5($key) . '.json';

        if (!file_exists($cacheFile)) {
            return time() + RATE_LIMIT_WINDOW;
        }

        $data = json_decode(file_get_contents($cacheFile), true);
        return $data['reset'] ?? time() + RATE_LIMIT_WINDOW;
    }

    /**
     * Clean expired rate limit cache
     */
    public static function cleanRateLimitCache(): int
    {
        $cacheDir = STORAGE_PATH . '/cache';
        if (!is_dir($cacheDir)) {
            return 0;
        }

        $cleaned = 0;
        $files = glob($cacheDir . '/rate_limit_*.json');

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (!$data || $data['reset'] <= time()) {
                unlink($file);
                $cleaned++;
            }
        }

        return $cleaned;
    }

    /**
     * Validate password strength
     */
    public static function validatePasswordStrength(string $password): array
    {
        $errors = [];

        if (strlen($password) < 8) {
            $errors[] = 'Password must be at least 8 characters';
        }

        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Password must contain at least one uppercase letter';
        }

        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Password must contain at least one lowercase letter';
        }

        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'Password must contain at least one number';
        }

        if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
            $errors[] = 'Password must contain at least one special character';
        }

        return $errors;
    }

    /**
     * Generate secure random string
     */
    public static function randomString(int $length = 32, ?string $chars = null): string
    {
        $chars = $chars ?? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $charsLength = strlen($chars);
        $result = '';

        for ($i = 0; $i < $length; $i++) {
            $result .= $chars[random_int(0, $charsLength - 1)];
        }

        return $result;
    }

    /**
     * Encrypt data
     */
    public static function encrypt(string $data): string
    {
        $key = hash('sha256', JWT_SECRET, true);
        $iv = random_bytes(16);
        $encrypted = openssl_encrypt($data, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $encrypted);
    }

    /**
     * Decrypt data
     */
    public static function decrypt(string $data): ?string
    {
        $key = hash('sha256', JWT_SECRET, true);
        $data = base64_decode($data);

        if (strlen($data) < 16) {
            return null;
        }

        $iv = substr($data, 0, 16);
        $encrypted = substr($data, 16);

        $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        return $decrypted !== false ? $decrypted : null;
    }

    /**
     * Validate file upload
     */
    public static function validateFileUpload(array $file, array $allowedTypes, ?int $maxSize = null): array
    {
        $errors = [];
        $maxSize = $maxSize ?? MAX_UPLOAD_SIZE;

        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = self::getUploadErrorMessage($file['error']);
            return $errors;
        }

        // Check file size
        if ($file['size'] > $maxSize) {
            $errors[] = 'File size exceeds limit (' . round($maxSize / 1024 / 1024, 2) . 'MB)';
        }

        // Check MIME type using magic bytes
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);

        if (!in_array($mimeType, $allowedTypes)) {
            $errors[] = 'Invalid file type: ' . $mimeType;
        }

        return $errors;
    }

    /**
     * Get upload error message
     */
    private static function getUploadErrorMessage(int $error): string
    {
        return match ($error) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'File upload stopped by extension',
            default => 'Unknown upload error'
        };
    }

    /**
     * Sanitize filename
     */
    /**
     * Atomic rate limit check
     */
    public static function checkRateLimitAtomic(string $key, int $limit, int $windowSeconds): bool
    {
        $db = Database::getInstance();
        $windowSeconds = max(1, $windowSeconds);
        $nowEpoch = time();
        $windowStartEpoch = (int)(floor($nowEpoch / $windowSeconds) * $windowSeconds);
        $isPostgres = method_exists($db, 'isPostgres') && $db->isPostgres();

        $windowStart = $isPostgres
            ? gmdate('Y-m-d H:i:s', $windowStartEpoch)
            : $windowStartEpoch;

        // Clean old entries
        $db->query(
            "DELETE FROM rate_limits WHERE key_name = ? AND window_start < ?",
            [$key, $windowStart]
        );

        // Atomic check and increment in current time bucket
        $record = $db->fetch(
            "SELECT count FROM rate_limits WHERE key_name = ? AND window_start = ?",
            [$key, $windowStart]
        );

        if ($record) {
            if ($record['count'] >= $limit) {
                return false;
            }
            $db->query(
                "UPDATE rate_limits SET count = count + 1 WHERE key_name = ? AND window_start = ?",
                [$key, $windowStart]
            );
        } else {
            if ($isPostgres) {
                $db->query(
                    "INSERT INTO rate_limits (key_name, count, window_start)
                     VALUES (?, 1, ?)
                     ON CONFLICT (key_name, window_start)
                     DO UPDATE SET count = rate_limits.count + 1",
                    [$key, $windowStart]
                );
            } else {
                $db->query(
                    "INSERT INTO rate_limits (key_name, count, window_start) VALUES (?, 1, ?) ON CONFLICT DO NOTHING",
                    [$key, $windowStart]
                );
            }
        }

        return true;
    }

    /**
     * Reset rate limit for a key
     */
    public static function resetRateLimit(string $key): void
    {
        $db = Database::getInstance();
        $db->query("DELETE FROM rate_limits WHERE key_name = ?", [$key]);
    }

    /**
     * Sanitize filename
     */
    public static function sanitizeFilename(string $filename): string
    {
        // Remove path information
        $filename = basename($filename);
        // Replace special characters
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
        // Remove multiple underscores/dots
        $filename = preg_replace('/[_]+/', '_', $filename);
        $filename = preg_replace('/[.]+/', '.', $filename);
        // Limit length
        if (strlen($filename) > 200) {
            $ext = pathinfo($filename, PATHINFO_EXTENSION);
            $name = pathinfo($filename, PATHINFO_FILENAME);
            $filename = substr($name, 0, 195 - strlen($ext)) . '.' . $ext;
        }
        return $filename;
    }
}
