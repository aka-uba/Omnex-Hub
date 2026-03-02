<?php
/**
 * Change Password API
 */

$db = Database::getInstance();
$currentUser = Auth::user();

if (!$currentUser) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $currentUser['id'];

// Get request data
$currentPassword = $request->input('current_password');
$newPassword = $request->input('new_password');

// Validate inputs
if (!$currentPassword || !$newPassword) {
    Response::error('Mevcut sifre ve yeni sifre gerekli');
}

if (strlen($newPassword) < 8) {
    Response::error('Yeni sifre en az 8 karakter olmali');
}

// Fetch user with password
$user = $db->fetch("SELECT id, password_hash FROM users WHERE id = ?", [$userId]);
if (!$user) {
    Response::notFound('Kullanici bulunamadi');
}

// Verify current password
if (!password_verify($currentPassword, $user['password_hash'])) {
    Response::error('Mevcut sifre yanlis');
}

// Update password using Auth::hashPassword for consistency
$newPasswordHash = Auth::hashPassword($newPassword);
$db->update('users', [
    'password_hash' => $newPasswordHash,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$userId]);

// Send notification about password change
try {
    require_once __DIR__ . '/../../services/NotificationTriggers.php';
    NotificationTriggers::onPasswordChanged($userId);
} catch (Exception $notifyError) {
    // Notification failure should not break password change response
    Logger::warning('Failed to send password change notification', [
        'user_id' => $userId,
        'error' => $notifyError->getMessage()
    ]);
}

Response::success(null, 'Sifre basariyla degistirildi');
