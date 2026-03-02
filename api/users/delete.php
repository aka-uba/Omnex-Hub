<?php
/**
 * Delete User API
 */

$db = Database::getInstance();
$currentUser = Auth::user();
$id = $request->routeParam('id');

if (!$currentUser) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($currentUser['role'] ?? '', ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

// Can't delete yourself
if ($id === ($currentUser['id'] ?? null)) {
    Response::badRequest('Kendinizi silemezsiniz');
}

$user = $db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
if (!$user) {
    Response::notFound('Kullanici bulunamadi');
}

if (($currentUser['role'] ?? '') !== 'SuperAdmin') {
    if (($user['company_id'] ?? null) !== ($currentUser['company_id'] ?? null)) {
        Response::forbidden('Bu kullaniciyi silme yetkiniz yok');
    }
    if (($user['role'] ?? '') === 'SuperAdmin') {
        Response::forbidden('SuperAdmin kullanicisi silinemez');
    }
}

$db->delete('users', 'id = ?', [$id]);

// Audit log
Logger::audit('delete', 'user', [
    'id' => $id,
    'old' => [
        'email' => $user['email'],
        'role' => $user['role']
    ]
]);

Response::success(null, 'Kullanici silindi');
