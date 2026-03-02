<?php
/**
 * User Detail API
 */

$db = Database::getInstance();
$currentUser = Auth::user();
$id = $request->routeParam('id');

if (!$currentUser) {
    Response::unauthorized('Oturum gerekli');
}

$user = $db->fetch(
    "SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.avatar, u.phone,
            u.last_login, u.created_at, u.company_id, c.name as company_name
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     WHERE u.id = ?",
    [$id]
);

if (!$user) {
    Response::notFound('Kullanici bulunamadi');
}

$isSelf = ($currentUser['id'] ?? null) === $id;
$isAdmin = in_array($currentUser['role'] ?? '', ['SuperAdmin', 'Admin'], true);

if (!$isSelf && !$isAdmin) {
    Response::forbidden('Bu kullaniciyi goruntuleme yetkiniz yok');
}

if (($currentUser['role'] ?? '') !== 'SuperAdmin' && ($user['company_id'] ?? null) !== ($currentUser['company_id'] ?? null)) {
    Response::forbidden('Bu kullaniciya erisim yetkiniz yok');
}

$user['name'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));

Response::success($user);
