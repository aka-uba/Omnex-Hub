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

try {
    $db->beginTransaction();
    $db->delete('users', 'id = ?', [$id]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('User delete error', [
        'user_id' => $id,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

// Audit log
try {
    Logger::audit('delete', 'user', [
        'id' => $id,
        'old' => [
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
} catch (Throwable $auditError) {
    error_log('User delete audit skipped: ' . $auditError->getMessage());
}

Response::success(null, 'Kullanici silindi');
