<?php
/**
 * Forgot Password API
 */

$db = Database::getInstance();

$email = $request->input('email');
if (!$email) {
    Response::badRequest('E-posta adresi gerekli');
}

$user = $db->fetch("SELECT id, name, email FROM users WHERE email = ?", [$email]);

// Always return success (don't reveal if email exists)
if ($user) {
    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Store hashed token in DB (plain token is sent to user via email)
    $db->query(
        "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
        [$tokenHash, $expiresAt, $user['id']]
    );

    // In production, send email with plain $token in the reset link
    Logger::info('Password reset requested', [
        'user_id' => $user['id'],
        'email' => $email
    ]);
}

Response::success(null, 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi');
