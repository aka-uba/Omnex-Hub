<?php
/**
 * Auth - Authentication Handler (JWT)
 *
 * @package OmnexDisplayHub
 */

class Auth
{
    private static ?array $user = null;

    /**
     * Generate access and refresh tokens
     */
    public static function generateTokens(array $user): array
    {
        $accessToken = self::createToken([
            'user_id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'company_id' => $user['company_id'] ?? null
        ], JWT_EXPIRY);

        $refreshToken = self::createToken([
            'user_id' => $user['id'],
            'type' => 'refresh'
        ], REFRESH_TOKEN_EXPIRY);

        // Store session in database
        $db = Database::getInstance();
        $db->insert('sessions', [
            'id' => $db->generateUuid(),
            'user_id' => $user['id'],
            'token_hash' => hash('sha256', $accessToken),
            'refresh_token_hash' => hash('sha256', $refreshToken),
            'expires_at' => date('Y-m-d H:i:s', time() + REFRESH_TOKEN_EXPIRY),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'last_activity' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s')
        ]);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => JWT_EXPIRY
        ];
    }

    /**
     * Create JWT token
     */
    public static function createToken(array $payload, int $expiry): string
    {
        $header = self::base64UrlEncode(json_encode([
            'typ' => 'JWT',
            'alg' => 'HS256'
        ]));

        $payload['iat'] = time();
        $payload['exp'] = time() + $expiry;
        $payload = self::base64UrlEncode(json_encode($payload));

        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
        );

        return "$header.$payload.$signature";
    }

    /**
     * Validate and decode JWT token
     */
    public static function validateToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerB64, $payload, $signature] = $parts;

        // Verify algorithm - only accept HS256 to prevent algorithm confusion attacks
        $header = json_decode(self::base64UrlDecode($headerB64), true);
        if (!$header || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        // Verify signature
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', "$headerB64.$payload", JWT_SECRET, true)
        );

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $data = json_decode(self::base64UrlDecode($payload), true);

        // Check expiry
        if (!isset($data['exp']) || $data['exp'] < time()) {
            return null;
        }

        return $data;
    }

    /**
     * Refresh access token
     */
    public static function refreshToken(string $refreshToken): ?array
    {
        $data = self::validateToken($refreshToken);

        if (!$data || ($data['type'] ?? '') !== 'refresh') {
            return null;
        }

        // Verify refresh token in database
        $db = Database::getInstance();
        $hash = hash('sha256', $refreshToken);

        $session = $db->fetch(
            "SELECT * FROM sessions WHERE refresh_token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
            [$hash]
        );

        if (!$session) {
            return null;
        }

        // Get user
        $user = $db->fetch(
            "SELECT * FROM users WHERE id = ? AND status = 'active'",
            [$data['user_id']]
        );

        if (!$user) {
            return null;
        }

        // Delete old session
        $db->delete('sessions', 'id = ?', [$session['id']]);

        // Generate new tokens
        return self::generateTokens($user);
    }

    /**
     * Revoke token (logout)
     */
    public static function revokeToken(string $token): bool
    {
        $db = Database::getInstance();
        $hash = hash('sha256', $token);

        $deleted = $db->delete('sessions', 'token_hash = ? OR refresh_token_hash = ?', [$hash, $hash]);
        return $deleted > 0;
    }

    /**
     * Revoke all user tokens
     */
    public static function revokeAllTokens(string $userId): int
    {
        $db = Database::getInstance();
        return $db->delete('sessions', 'user_id = ?', [$userId]);
    }

    /**
     * Get current authenticated user
     */
    public static function user(): ?array
    {
        return self::$user;
    }

    /**
     * Set current user (called by middleware)
     */
    public static function setUser(array $user): void
    {
        self::$user = $user;
    }

    /**
     * Check if user is authenticated
     */
    public static function check(): bool
    {
        return self::$user !== null;
    }

    /**
     * Check if user is guest
     */
    public static function guest(): bool
    {
        return self::$user === null;
    }

    /**
     * Get user ID
     */
    public static function id(): ?string
    {
        return self::$user['id'] ?? null;
    }

    /**
     * Get user role
     */
    public static function role(): ?string
    {
        return self::$user['role'] ?? null;
    }

    /**
     * Get user company ID
     */
    public static function companyId(): ?string
    {
        return self::$user['company_id'] ?? null;
    }

    /**
     * Get active company ID for operations
     * For SuperAdmin: uses X-Active-Company header or falls back to first company
     * For regular users: returns their own company_id
     */
    public static function getActiveCompanyId(): ?string
    {
        $user = self::$user;
        if (!$user) {
            return null;
        }

        // Regular users always use their own company
        if (($user['role'] ?? '') !== 'SuperAdmin') {
            return $user['company_id'] ?? null;
        }

        // SuperAdmin: check X-Active-Company header first
        $activeCompanyId = $_SERVER['HTTP_X_ACTIVE_COMPANY'] ?? null;
        if ($activeCompanyId) {
            // Validate that the company exists
            $db = Database::getInstance();
            $company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$activeCompanyId]);
            if ($company) {
                return $activeCompanyId;
            }
        }

        // Fallback: get first company
        $db = Database::getInstance();
        $defaultCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
        return $defaultCompany['id'] ?? null;
    }

    /**
     * Check if user has role
     */
    public static function hasRole(string|array $roles): bool
    {
        if (!self::$user) {
            return false;
        }

        $roles = is_array($roles) ? $roles : [$roles];
        return in_array(self::$user['role'], $roles);
    }

    /**
     * Get active branch ID for operations
     * Reads from X-Active-Branch header
     */
    public static function getActiveBranchId(): ?string
    {
        $user = self::$user;
        if (!$user) {
            return null;
        }

        // Check X-Active-Branch header
        $activeBranchId = $_SERVER['HTTP_X_ACTIVE_BRANCH'] ?? null;
        if ($activeBranchId) {
            // Validate that the branch exists and belongs to current company context
            $db = Database::getInstance();
            $companyId = self::getActiveCompanyId();

            if ($companyId) {
                $branch = $db->fetch(
                    "SELECT id FROM branches WHERE id = ? AND company_id = ?",
                    [$activeBranchId, $companyId]
                );
            } else {
                $branch = $db->fetch("SELECT id FROM branches WHERE id = ?", [$activeBranchId]);
            }

            if ($branch) {
                return $activeBranchId;
            }
        }

        return null;
    }

    /**
     * Check if user is SuperAdmin
     */
    public static function isSuperAdmin(): bool
    {
        return self::hasRole('SuperAdmin');
    }

    /**
     * Check if user is Admin (company admin)
     */
    public static function isAdmin(): bool
    {
        return self::hasRole(['SuperAdmin', 'Admin']);
    }

    /**
     * Hash password
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);
    }

    /**
     * Verify password
     */
    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    /**
     * Generate random token
     */
    public static function generateRandomToken(int $length = 32): string
    {
        return bin2hex(random_bytes($length));
    }

    /**
     * Set JWT token as HttpOnly cookie
     */
    public static function setTokenCookie(string $token, int $expiresIn = 86400): void
    {
        setcookie('omnex_token', $token, [
            'expires' => time() + $expiresIn,
            'path' => '/',
            'httponly' => true,
            'secure' => defined('PRODUCTION_MODE') && PRODUCTION_MODE,
            'samesite' => 'Strict'
        ]);
    }

    /**
     * Clear JWT token cookie
     */
    public static function clearTokenCookie(): void
    {
        setcookie('omnex_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => defined('PRODUCTION_MODE') && PRODUCTION_MODE,
            'samesite' => 'Strict'
        ]);
    }

    /**
     * Base64 URL encode
     */
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Base64 URL decode
     */
    private static function base64UrlDecode(string $data): string
    {
        $padding = 4 - strlen($data) % 4;
        if ($padding !== 4) {
            $data .= str_repeat('=', $padding);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

