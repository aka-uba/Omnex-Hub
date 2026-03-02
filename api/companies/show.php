<?php
/**
 * Company Detail API (Admin Only)
 */

$db = Database::getInstance();
$id = $request->routeParam('id');

$company = $db->fetch(
    "SELECT c.*,
            (SELECT COUNT(*) FROM users WHERE company_id = c.id) as user_count,
            (SELECT COUNT(*) FROM devices WHERE company_id = c.id) as device_count
     FROM companies c
     WHERE c.id = ?",
    [$id]
);

if (!$company) {
    Response::notFound('Şirket bulunamadı');
}

// Get license
$license = $db->fetch("SELECT * FROM licenses WHERE company_id = ?", [$id]);
$company['license'] = $license;

// Get recent users
$users = $db->fetchAll(
    "SELECT id, name, email, role, status, last_login_at
     FROM users WHERE company_id = ? ORDER BY created_at DESC LIMIT 5",
    [$id]
);
$company['recent_users'] = $users ?? [];

Response::success($company);
