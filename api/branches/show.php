<?php
/**
 * Branches API - Show
 * GET /api/branches/:id
 */

require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$branchId = $request->routeParam('id');
if (!$branchId) {
    Response::error('Şube ID gerekli', 400);
}

$companyId = Auth::getActiveCompanyId();

$branch = $db->fetch(
    "SELECT * FROM branches WHERE id = ? AND company_id = ?",
    [$branchId, $companyId]
);

if (!$branch) {
    Response::error('Şube bulunamadı', 404);
}

// İstatistikler
$childCount = $db->fetch(
    "SELECT COUNT(*) as count FROM branches WHERE parent_id = ?",
    [$branchId]
);
$branch['child_count'] = $childCount['count'];

// Alt şubeler (bölge ise)
if ($branch['type'] === 'region') {
    $branch['children'] = $db->fetchAll(
        "SELECT * FROM branches WHERE parent_id = ? ORDER BY sort_order, name",
        [$branchId]
    );
}

// Parent bilgisi
if ($branch['parent_id']) {
    $branch['parent'] = $db->fetch(
        "SELECT id, code, name, type FROM branches WHERE id = ?",
        [$branch['parent_id']]
    );
}

// Cihazlar
$branch['devices'] = $db->fetchAll(
    "SELECT id, name, type, status FROM devices WHERE branch_id = ? LIMIT 10",
    [$branchId]
);
$deviceCount = $db->fetch(
    "SELECT COUNT(*) as count FROM devices WHERE branch_id = ?",
    [$branchId]
);
$branch['device_count'] = $deviceCount['count'];

// Override sayısı
$overrideCount = $db->fetch(
    "SELECT COUNT(*) as count FROM product_branch_overrides
     WHERE branch_id = ? AND deleted_at IS NULL",
    [$branchId]
);
$branch['override_count'] = $overrideCount['count'];

// Erişim yetkisi olan kullanıcılar
$branch['users'] = $db->fetchAll(
    "SELECT u.id, u.first_name, u.last_name, u.email, uba.access_level, uba.is_default
     FROM user_branch_access uba
     JOIN users u ON uba.user_id = u.id
     WHERE uba.branch_id = ?",
    [$branchId]
);

Response::success($branch);
