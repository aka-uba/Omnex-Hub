<?php
/**
 * Create User API
 */

$db = Database::getInstance();
$currentUser = Auth::user();

if (!$currentUser) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($currentUser['role'] ?? '', ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

// Support both old (name) and new (first_name/last_name) formats
$firstName = $request->input('first_name');
$lastName = $request->input('last_name');
$name = $request->input('name');

if (!$firstName && !$lastName && $name) {
    $parts = explode(' ', trim($name), 2);
    $firstName = $parts[0] ?? null;
    $lastName = $parts[1] ?? '';
}

$email = $request->input('email');
$password = $request->input('password');
$role = $request->input('role', 'Viewer');

if (!$firstName || !$email || !$password) {
    Response::badRequest('Gerekli alanlar eksik');
}

$allowedRoles = ['SuperAdmin', 'Admin', 'Manager', 'Operator', 'Editor', 'Viewer'];
if (!in_array($role, $allowedRoles, true)) {
    Response::badRequest('Gecersiz rol');
}

$companyId = $request->input('company_id');
if (($currentUser['role'] ?? '') !== 'SuperAdmin') {
    if ($role === 'SuperAdmin') {
        Response::forbidden('SuperAdmin rolu atayamazsiniz');
    }
    $companyId = $currentUser['company_id'] ?? null;
}

if (!$companyId) {
    Response::badRequest('company_id gerekli');
}

// Check email exists
$exists = $db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
if ($exists) {
    Response::badRequest('Bu e-posta adresi zaten kullanimda');
}

$id = $db->generateUuid();
$db->beginTransaction();

try {
    $db->insert('users', [
        'id' => $id,
        'company_id' => $companyId,
        'first_name' => $firstName,
        'last_name' => $lastName ?? '',
        'email' => $email,
        'password_hash' => Auth::hashPassword($password),
        'role' => $role,
        'status' => 'active'
    ]);

    // Handle branch assignments
    if ($request->has('branch_ids')) {
        $branchIds = $request->input('branch_ids');
        $defaultBranchId = $request->input('default_branch_id');

        if (is_array($branchIds) && !empty($branchIds)) {
            foreach ($branchIds as $branchId) {
                $branch = $db->fetch(
                    "SELECT id FROM branches WHERE id = ? AND company_id = ?",
                    [$branchId, $companyId]
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
    Logger::error('User create error', ['error' => $e->getMessage(), 'email' => $email]);
    Response::serverError('Kullanici olusturulamadi');
}

$user = $db->fetch("SELECT id, first_name, last_name, email, role, status, phone FROM users WHERE id = ?", [$id]);
$user['name'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));

// Audit log (non-critical)
try {
    Logger::audit('create', 'user', [
        'id' => $id,
        'new' => [
            'email' => $email,
            'role' => $role,
            'company_id' => $companyId
        ]
    ]);
} catch (Throwable $e) {
    error_log('User create audit skipped: ' . $e->getMessage());
}

Response::success($user, 'Kullanici olusturuldu');
