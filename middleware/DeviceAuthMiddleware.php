<?php
/**
 * DeviceAuthMiddleware - Device Token Authentication Middleware
 *
 * Supports two authentication methods:
 * 1. X-DEVICE-TOKEN header (legacy PWA player)
 * 2. Authorization: Device <jwt_token> (ESL devices)
 *
 * @package OmnexDisplayHub
 */

class DeviceAuthMiddleware
{
    private static ?array $device = null;

    /**
     * Get device token from request headers
     * Supports both X-DEVICE-TOKEN and Authorization: Device formats
     */
    public static function getToken(Request $request = null): ?string
    {
        // Check Authorization: Device <token> header first
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($auth && preg_match('/Device\s+(.+)$/i', $auth, $matches)) {
            return $matches[1];
        }

        // Fallback to X-DEVICE-TOKEN header (legacy)
        $token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? null;
        if (!$token) {
            $token = $_SERVER['HTTP_X_Device_Token'] ?? null;
        }

        return $token;
    }

    /**
     * Validate device token and return device info
     * Supports both JWT and plain tokens
     */
    public static function validateToken(string $token): ?array
    {
        $db = Database::getInstance();

        // First try to validate as JWT token
        $jwtPayload = Auth::validateToken($token);

        if ($jwtPayload && isset($jwtPayload['type']) && $jwtPayload['type'] === 'device') {
            // JWT device token
            $tokenHash = hash('sha256', $token);
            $tokenRecord = $db->fetch(
                "SELECT * FROM device_tokens WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
                [$tokenHash]
            );

            if (!$tokenRecord) {
                return null;
            }

            $device = $db->fetch(
                "SELECT d.*, c.name as company_name, g.name as group_name
                 FROM devices d
                 LEFT JOIN companies c ON d.company_id = c.id
                 LEFT JOIN device_groups g ON d.group_id = g.id
                 WHERE d.id = ?",
                [$jwtPayload['device_id']]
            );

            if ($device) {
                $device['token_id'] = $tokenRecord['id'];
                $device['token_type'] = 'jwt';
            }

            return $device;
        }

        // Fallback to plain token validation (legacy)
        $deviceToken = $db->fetch(
            "SELECT dt.*, d.id as device_id, d.company_id, d.name as device_name,
                    d.type as device_type, d.status as device_status,
                    c.name as company_name, g.name as group_name
             FROM device_tokens dt
             JOIN devices d ON dt.device_id = d.id
             LEFT JOIN companies c ON d.company_id = c.id
             LEFT JOIN device_groups g ON d.group_id = g.id
             WHERE dt.token = ? AND dt.revoked_at IS NULL",
            [$token]
        );

        if (!$deviceToken) {
            // Try by token_hash as well
            $tokenHash = hash('sha256', $token);
            $deviceToken = $db->fetch(
                "SELECT dt.*, d.id as device_id, d.company_id, d.name as device_name,
                        d.type as device_type, d.status as device_status,
                        c.name as company_name, g.name as group_name
                 FROM device_tokens dt
                 JOIN devices d ON dt.device_id = d.id
                 LEFT JOIN companies c ON d.company_id = c.id
                 LEFT JOIN device_groups g ON d.group_id = g.id
                 WHERE dt.token_hash = ? AND (dt.revoked_at IS NULL OR dt.revoked_at = '')",
                [$tokenHash]
            );
        }

        if (!$deviceToken) {
            return null;
        }

        // Check if token is expired
        if ($deviceToken['expires_at']) {
            $expiresAt = strtotime($deviceToken['expires_at']);
            if ($expiresAt && $expiresAt < time()) {
                return null;
            }
        }

        $deviceToken['token_type'] = 'plain';

        return $deviceToken;
    }

    /**
     * Handle the request - Middleware entry point
     */
    public function handle(Request $request, callable $next): void
    {
        $token = self::getToken($request);

        if (!$token) {
            Response::unauthorized('Device token required');
        }

        $device = self::validateToken($token);

        if (!$device) {
            Response::unauthorized('Invalid or expired device token');
        }

        // Check device status
        if (isset($device['status']) && $device['status'] === 'maintenance') {
            Response::forbidden('Device is under maintenance');
        }

        if (isset($device['device_status']) && $device['device_status'] === 'maintenance') {
            Response::forbidden('Device is under maintenance');
        }

        // Update last_used_at
        $db = Database::getInstance();
        if (isset($device['token_id'])) {
            $db->query(
                "UPDATE device_tokens SET last_used_at = CURRENT_TIMESTAMP, ip_address = ? WHERE id = ?",
                [$request->ip(), $device['token_id']]
            );
        } elseif (isset($device['id'])) {
            $db->query(
                "UPDATE device_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
                [$device['id']]
            );
        }

        // Store device info
        self::$device = $device;

        // Continue to next middleware/handler
        $next();
    }

    /**
     * Get current authenticated device
     */
    public static function device(): ?array
    {
        return self::$device;
    }

    /**
     * Set current device (for internal use)
     */
    public static function setDevice(array $device): void
    {
        self::$device = $device;
    }

    /**
     * Check if device is authenticated
     */
    public static function check(): bool
    {
        return self::$device !== null;
    }

    /**
     * Get device ID
     */
    public static function deviceId(): ?string
    {
        return self::$device['id'] ?? self::$device['device_id'] ?? null;
    }

    /**
     * Get device company ID
     */
    public static function companyId(): ?string
    {
        return self::$device['company_id'] ?? null;
    }

    /**
     * Generate a JWT device token
     *
     * @param array $device Device data
     * @param int $expiresInDays Token expiry in days (default: 365)
     * @return array Token data with token and hash
     */
    public static function generateJwtToken(array $device, int $expiresInDays = 365): array
    {
        $expiry = $expiresInDays * 24 * 60 * 60; // Convert to seconds

        $token = Auth::createToken([
            'device_id' => $device['id'],
            'serial_number' => $device['device_id'] ?? $device['serial_number'] ?? '',
            'company_id' => $device['company_id'],
            'type' => 'device'
        ], $expiry);

        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', time() + $expiry);

        // Store in database
        $db = Database::getInstance();

        // Optionally revoke old tokens
        $db->query(
            "DELETE FROM device_tokens WHERE device_id = ?",
            [$device['id']]
        );

        $id = $db->generateUuid();
        $db->query(
            "INSERT INTO device_tokens (id, device_id, token, token_hash, expires_at, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            [$id, $device['id'], $token, $tokenHash, $expiresAt, $_SERVER['REMOTE_ADDR'] ?? null]
        );

        return [
            'token' => $token,
            'hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'token_id' => $id
        ];
    }

    /**
     * Generate a plain device token (legacy)
     */
    public static function generateToken(string $deviceId, ?int $expiresInDays = null): string
    {
        $db = Database::getInstance();

        // Generate secure random token
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);

        // Calculate expiration
        $expiresAt = null;
        if ($expiresInDays) {
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiresInDays} days"));
        }

        // Insert token
        $db->query(
            "INSERT INTO device_tokens (id, device_id, token, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            [$db->generateUuid(), $deviceId, $token, $tokenHash, $expiresAt]
        );

        return $token;
    }

    /**
     * Revoke a device token
     */
    public static function revokeToken(string $token): bool
    {
        $db = Database::getInstance();

        // Try by token first
        $affected = $db->query(
            "UPDATE device_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = ?",
            [$token]
        )->rowCount();

        if ($affected === 0) {
            // Try by token_hash
            $tokenHash = hash('sha256', $token);
            $affected = $db->query(
                "UPDATE device_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
                [$tokenHash]
            )->rowCount();
        }

        return $affected > 0;
    }

    /**
     * Revoke all tokens for a device
     */
    public static function revokeAllTokens(string $deviceId): int
    {
        $db = Database::getInstance();

        return $db->query(
            "DELETE FROM device_tokens WHERE device_id = ?",
            [$deviceId]
        )->rowCount();
    }
}
