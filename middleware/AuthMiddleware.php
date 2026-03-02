<?php
/**
 * AuthMiddleware - JWT Authentication Middleware
 *
 * @package OmnexDisplayHub
 */

class AuthMiddleware
{
    /**
     * Handle the request
     */
    public function handle(Request $request, callable $next): void
    {
        $token = $request->bearerToken();

        // Fallback: read token from HttpOnly cookie
        if (!$token && isset($_COOKIE['omnex_token'])) {
            $token = $_COOKIE['omnex_token'];
        }

        if (!$token) {
            Response::unauthorized('Erişim token\'ı gerekli');
        }

        // Decode and validate token
        $payload = Auth::validateToken($token);

        if (!$payload) {
            Response::unauthorized('Geçersiz veya süresi dolmuş token');
        }

        // Check token type (refresh tokens can't be used for API access)
        if (isset($payload['type']) && $payload['type'] === 'refresh') {
            Response::unauthorized('Geçersiz token türü');
        }

        $db = Database::getInstance();

        // Verify token exists in database (session still active)
        // NOT: Bu kontrol isteğe bağlı - token valid olsa bile session kontrolü yapmak istersen aktif et
        // Şu anda sadece log tutuyoruz, çünkü refresh sonrası eski token ile gelen istekler session bulamıyor
        $tokenHash = hash('sha256', $token);
        $session = $db->fetch(
            "SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
            [$tokenHash]
        );

        if (!$session) {
            // Token valid ama session yok - muhtemelen refresh edilmiş
            // Log tut ama isteği reddetme (JWT expiry yeterli)
            Logger::debug('AuthMiddleware: Token valid but session not found (possibly refreshed)', [
                'user_id' => $payload['user_id'] ?? null,
                'token_preview' => substr($token, 0, 20) . '...'
            ]);
            // NOT: Strict session check istersen uncomment et:
            // Response::unauthorized('Oturum sonlandırılmış');
        }

        // Get user_id from payload (could be 'user_id' or 'sub')
        $userId = $payload['user_id'] ?? $payload['sub'] ?? null;

        if (!$userId) {
            Response::unauthorized('Geçersiz token');
        }

        // Load user
        $user = $db->fetch(
            "SELECT id, email, first_name, last_name, role, company_id, status, preferences
             FROM users WHERE id = ?",
            [$userId]
        );

        if (!$user) {
            Response::unauthorized('Kullanıcı bulunamadı');
        }

        if ($user['status'] !== 'active') {
            Response::forbidden('Hesabınız aktif değil');
        }

        // Add name field for convenience
        $user['name'] = trim($user['first_name'] . ' ' . $user['last_name']);

        // Load permissions
        $permissions = $db->fetchAll(
            "SELECT resource, actions FROM permissions WHERE role = ?",
            [$user['role']]
        );

        $user['permissions'] = [];
        if ($permissions) {
            foreach ($permissions as $perm) {
                $user['permissions'][$perm['resource']] = json_decode($perm['actions'], true);
            }
        }

        // Parse preferences
        $user['preferences'] = json_decode($user['preferences'] ?? '{}', true) ?? [];

        // Set authenticated user globally
        Auth::setUser($user);

        // Apply timezone from settings (user overrides company)
        try {
            $timezone = null;

            $userSettings = $db->fetch(
                "SELECT data FROM settings WHERE user_id = ?",
                [$userId]
            );
            if ($userSettings && !empty($userSettings['data'])) {
                $settingsData = json_decode($userSettings['data'], true) ?? [];
                $timezone = $settingsData['timezone'] ?? null;
            }

            if (!$timezone && !empty($user['company_id'])) {
                $companySettings = $db->fetch(
                    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
                    [$user['company_id']]
                );
                if ($companySettings && !empty($companySettings['data'])) {
                    $settingsData = json_decode($companySettings['data'], true) ?? [];
                    $timezone = $settingsData['timezone'] ?? null;
                }
            }

            if ($timezone && in_array($timezone, timezone_identifiers_list(), true)) {
                date_default_timezone_set($timezone);
            }
        } catch (Exception $e) {
            // Ignore timezone errors to avoid blocking auth
        }

        // Lisans kontrolü (SuperAdmin hariç)
        if ($user['role'] !== 'SuperAdmin' && $user['company_id']) {
            if (!LicenseMiddleware::handle($request)) {
                return; // Response zaten gönderildi
            }
        }

        // Continue to next middleware/handler
        $next();
    }
}
