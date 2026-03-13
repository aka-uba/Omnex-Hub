<?php
/**
 * Update User API
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

$existingUser = $db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
if (!$existingUser) {
    Response::notFound('Kullanici bulunamadi');
}

if (($currentUser['role'] ?? '') !== 'SuperAdmin') {
    if (($existingUser['company_id'] ?? null) !== ($currentUser['company_id'] ?? null)) {
        Response::forbidden('Bu kullaniciyi guncelleme yetkiniz yok');
    }
    if (($existingUser['role'] ?? '') === 'SuperAdmin') {
        Response::forbidden('SuperAdmin kullanicisi guncellenemez');
    }
}

$data = ['updated_at' => date('Y-m-d H:i:s')];

// Support both old (name) and new (first_name/last_name) formats
if ($request->has('name')) {
    $fullName = trim((string)$request->input('name'));
    if ($fullName !== '') {
        $parts = explode(' ', $fullName, 2);
        if (!$request->has('first_name')) $data['first_name'] = $parts[0] ?? '';
        if (!$request->has('last_name')) $data['last_name'] = $parts[1] ?? '';
    }
}
if ($request->has('first_name')) $data['first_name'] = $request->input('first_name');
if ($request->has('last_name')) $data['last_name'] = $request->input('last_name');
if ($request->has('email')) $data['email'] = $request->input('email');
if ($request->has('status')) $data['status'] = $request->input('status');
if ($request->has('phone')) $data['phone'] = $request->input('phone');

if ($request->has('role')) {
    $newRole = $request->input('role');
    $allowedRoles = ['SuperAdmin', 'Admin', 'Manager', 'Operator', 'Editor', 'Viewer'];
    if (!in_array($newRole, $allowedRoles, true)) {
        Response::badRequest('Gecersiz rol');
    }
    if (($currentUser['role'] ?? '') !== 'SuperAdmin' && $newRole === 'SuperAdmin') {
        Response::forbidden('SuperAdmin rolu atayamazsiniz');
    }
    $data['role'] = $newRole;
}

// SuperAdmin can change company_id
if ($request->has('company_id')) {
    if (($currentUser['role'] ?? '') !== 'SuperAdmin') {
        Response::forbidden('company_id degistirme yetkiniz yok');
    }
    $data['company_id'] = $request->input('company_id');
}

if ($request->has('password') && $request->input('password')) {
    $data['password_hash'] = Auth::hashPassword($request->input('password'));
}

// Track changes for notifications
$oldStatus = $existingUser['status'];
$oldRole = $existingUser['role'];
$newStatus = $data['status'] ?? $oldStatus;
$newRole = $data['role'] ?? $oldRole;

try {
    $db->beginTransaction();

    $db->update('users', $data, 'id = ?', [$id]);

    // Handle branch assignments
    if ($request->has('branch_ids')) {
        $branchIds = $request->input('branch_ids');
        $defaultBranchId = $request->input('default_branch_id');
        $targetCompanyId = $data['company_id'] ?? $existingUser['company_id'] ?? null;

        $db->delete('user_branch_access', 'user_id = ?', [$id]);

        if (is_array($branchIds) && !empty($branchIds) && $targetCompanyId) {
            foreach ($branchIds as $branchId) {
                $branch = $db->fetch(
                    "SELECT id FROM branches WHERE id = ? AND company_id = ?",
                    [$branchId, $targetCompanyId]
                );
                if (!$branch) {
                    continue;
                }

                $db->insert('user_branch_access', [
                    'id' => $db->generateUuid(),
                    'user_id' => $id,
                    'branch_id' => $branchId,
                    'access_level' => 'full',
                    'is_default' => ($branchId === $defaultBranchId) ? 1 : 0,
                    'granted_by' => $currentUser['id'],
                    'granted_at' => date('Y-m-d H:i:s')
                ]);
            }
        }
    }

    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('User update error', [
        'user_id' => $id,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

// Send notifications for status and role changes
try {
    require_once __DIR__ . '/../../services/NotificationTriggers.php';

    if ($newStatus === 'active' && $oldStatus !== 'active') {
        NotificationTriggers::onUserApproved($id);
    }

    if ($newStatus === 'inactive' && $oldStatus === 'active') {
        NotificationTriggers::onUserDeactivated($id);
    }

    if ($newRole !== $oldRole) {
        NotificationTriggers::onRoleChanged($id, $oldRole, $newRole);
    }
} catch (Exception $notifyError) {
    Logger::warning('Failed to send user update notification', [
        'user_id' => $id,
        'error' => $notifyError->getMessage()
    ]);
}

$user = $db->fetch("SELECT id, first_name, last_name, email, role, status, phone FROM users WHERE id = ?", [$id]);
$user['name'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));

// Audit log
try {
    Logger::audit('update', 'user', [
        'id' => $id,
        'old' => [
            'email' => $existingUser['email'],
            'role' => $existingUser['role'],
            'status' => $existingUser['status']
        ],
        'new' => [
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status']
        ]
    ]);
} catch (Throwable $auditError) {
    error_log('User update audit skipped: ' . $auditError->getMessage());
}

Response::success($user, 'Kullanici guncellendi');
