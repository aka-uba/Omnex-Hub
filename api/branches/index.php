<?php
/**
 * Branches API - List & Stats
 * GET /api/branches - Şube listesi
 * GET /api/branches?stats=1 - İstatistiklerle birlikte
 */

require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// SuperAdmin için company_id parametresi desteği
// Bu, başka şirketlerin kullanıcılarını düzenlerken o şirketin şubelerini getirmek için kullanılır
$companyId = Auth::getActiveCompanyId();

// SuperAdmin ise ve company_id parametresi varsa, o şirketin şubelerini getir
if ($user['role'] === 'SuperAdmin' && !empty($_GET['company_id'])) {
    $companyId = $_GET['company_id'];
}

// Query params
$includeStats = isset($_GET['stats']);
$type = $_GET['type'] ?? null; // region, store, warehouse, online
$parentId = $_GET['parent_id'] ?? null;
$activeOnly = !isset($_GET['all']);

// Base query - b. prefix ile kolon adları
$where = ['b.company_id = ?'];
$params = [$companyId];

if ($type) {
    $where[] = 'b.type = ?';
    $params[] = $type;
}

if ($parentId) {
    $where[] = 'b.parent_id = ?';
    $params[] = $parentId;
}

if ($activeOnly) {
    $where[] = $db->isPostgres() ? 'b.is_active IS TRUE' : 'b.is_active = 1';
}

$whereClause = implode(' AND ', $where);

$branches = $db->fetchAll(
    "SELECT b.*, p.name as parent_name
     FROM branches b
     LEFT JOIN branches p ON b.parent_id = p.id
     WHERE $whereClause ORDER BY b.sort_order, b.name",
    $params
);

// Stats ekle
if ($includeStats) {
    foreach ($branches as &$branch) {
        // Alt şube sayısı
        $childCount = $db->fetch(
            "SELECT COUNT(*) as count FROM branches WHERE parent_id = ?",
            [$branch['id']]
        );
        $branch['child_count'] = $childCount['count'];

        // Cihaz sayısı
        $deviceCount = $db->fetch(
            "SELECT COUNT(*) as count FROM devices WHERE branch_id = ?",
            [$branch['id']]
        );
        $branch['device_count'] = $deviceCount['count'];

        // Override sayısı
        $overrideCount = $db->fetch(
            "SELECT COUNT(*) as count FROM product_branch_overrides
             WHERE branch_id = ? AND deleted_at IS NULL",
            [$branch['id']]
        );
        $branch['override_count'] = $overrideCount['count'];

        // Kullanıcı erişim sayısı
        $accessCount = $db->fetch(
            "SELECT COUNT(*) as count FROM user_branch_access WHERE branch_id = ?",
            [$branch['id']]
        );
        $branch['user_count'] = $accessCount['count'];
    }
}

// Hiyerarşi formatı isteniyorsa
if (isset($_GET['hierarchy'])) {
    $result = BranchService::getBranchHierarchy($companyId);
    Response::success($result);
}

Response::success($branches);
