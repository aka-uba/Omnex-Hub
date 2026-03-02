<?php
/**
 * Auth Refresh Token API
 */

$refreshToken = $request->input('refresh_token');

if (!$refreshToken) {
    Response::validationError(['refresh_token' => ['Refresh token gerekli']]);
}

// Use Auth::refreshToken which handles all validation
$tokens = Auth::refreshToken($refreshToken);

if (!$tokens) {
    Response::unauthorized('Geçersiz veya süresi dolmuş refresh token');
}

// Log token refresh
Logger::info('Token refreshed', [
    'ip' => $request->ip()
]);

Response::success([
    'access_token' => $tokens['access_token'],
    'refresh_token' => $tokens['refresh_token'],
    'token_type' => $tokens['token_type'],
    'expires_in' => $tokens['expires_in']
], 'Token yenilendi');
