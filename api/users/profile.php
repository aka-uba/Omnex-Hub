<?php
/**
 * Update Current User Profile API
 */

$db = Database::getInstance();
$currentUser = Auth::user();

if (!$currentUser) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $currentUser['id'];

// Fetch current user data
$user = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
if (!$user) {
    Response::notFound('Kullanici bulunamadi');
}

$data = ['updated_at' => date('Y-m-d H:i:s')];

// Update allowed fields
if ($request->has('first_name')) {
    $data['first_name'] = trim($request->input('first_name'));
}
if ($request->has('last_name')) {
    $data['last_name'] = trim($request->input('last_name'));
}
if ($request->has('phone')) {
    $data['phone'] = trim($request->input('phone'));
}

// Email requires validation
if ($request->has('email')) {
    $newEmail = trim($request->input('email'));

    // Check if email is already in use by another user
    $existingUser = $db->fetch(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [$newEmail, $userId]
    );

    if ($existingUser) {
        Response::error('Bu e-posta adresi zaten kullanilmakta');
    }

    $data['email'] = $newEmail;
}

// Update user
$db->update('users', $data, 'id = ?', [$userId]);

// Fetch updated user data
$updatedUser = $db->fetch(
    "SELECT id, first_name, last_name, email, role, phone, avatar, created_at, last_login
     FROM users WHERE id = ?",
    [$userId]
);

// Add computed name field for compatibility
$updatedUser['name'] = trim(($updatedUser['first_name'] ?? '') . ' ' . ($updatedUser['last_name'] ?? ''));

Response::success($updatedUser, 'Profil guncellendi');
