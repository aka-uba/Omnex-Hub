<?php
/**
 * Auth Session API - Get current user session
 */

// Get current user from Auth
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum bulunamadı');
}

$db = Database::getInstance();

// Load fresh user data
$userData = $db->fetch(
    "SELECT id, email, first_name, last_name, role, company_id, avatar, preferences, status
     FROM users WHERE id = ? AND status = 'active'",
    [$user['id']]
);

if (!$userData) {
    Response::unauthorized('Kullanıcı bulunamadı veya hesap aktif değil');
}

// Load permissions
$permissions = $db->fetchAll(
    "SELECT resource, actions FROM permissions WHERE role = ?",
    [$userData['role']]
);

$userData['permissions'] = [];
foreach ($permissions as $perm) {
    $userData['permissions'][$perm['resource']] = json_decode($perm['actions'], true);
}

// Parse preferences (handle null safely)
$userData['preferences'] = !empty($userData['preferences'])
    ? (json_decode($userData['preferences'], true) ?? [])
    : [];

// Remove sensitive fields
unset($userData['status']);

// Load company info if user belongs to a company
if ($userData['company_id']) {
    $company = $db->fetch(
        "SELECT id, name, slug, logo, settings FROM companies WHERE id = ? AND status = 'active'",
        [$userData['company_id']]
    );

    if ($company) {
        $company['settings'] = !empty($company['settings'])
            ? (json_decode($company['settings'], true) ?? [])
            : [];
        $userData['company'] = $company;
    }
}

Response::success([
    'user' => $userData
], 'Oturum bilgileri');
