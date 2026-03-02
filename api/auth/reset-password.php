<?php
/**
 * Reset Password API
 */

$db = Database::getInstance();

$token = $request->input('token');
$password = $request->input('password');
$confirmation = $request->input('password_confirmation');

if (!$token || !$password) {
    Response::badRequest('Token ve şifre gerekli');
}

if ($password !== $confirmation) {
    Response::badRequest('Şifreler eşleşmiyor');
}

if (strlen($password) < 8) {
    Response::badRequest('Şifre en az 8 karakter olmalı');
}

// Hash the incoming token and compare against stored hash
$tokenHash = hash('sha256', $token);

$user = $db->fetch(
    "SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > CURRENT_TIMESTAMP",
    [$tokenHash]
);

if (!$user) {
    Response::badRequest('Geçersiz veya süresi dolmuş token');
}

// Update password and clear token using Auth::hashPassword for consistency
$db->query(
    "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [Auth::hashPassword($password), $user['id']]
);

Response::success(null, 'Şifreniz başarıyla değiştirildi');

