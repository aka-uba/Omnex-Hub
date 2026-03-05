<?php
/**
 * Auth Logout API
 */

// Get current user from Auth
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum bulunamadı');
}

$db = Database::getInstance();

// Get token from header to invalidate
$token = $request->bearerToken();

if ($token) {
    // Decode token to get session ID
    $payload = Auth::validateToken($token);

    if ($payload && isset($payload['sid'])) {
        // Mark session as expired by setting expires_at to now
        $db->update('sessions', [
            'expires_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$payload['sid']]);
    }
}

// Log logout
Logger::audit('logout', 'users', ['user_id' => $user['id']]);

Response::success(null, 'Çıkış başarılı');
