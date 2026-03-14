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
    $where[] = 'b.is_active = true';
}

$whereClause = implode(' AND ', $where);

// Sorting support
$allowedSortColumns = ['name', 'type', 'code', 'sort_order', 'is_active', 'created_at', 'city', 'address'];
$sortBy = $_GET['sort_by'] ?? 'sort_order';
$sortDir = strtoupper($_GET['sort_dir'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';
if (!in_array($sortBy, $allowedSortColumns)) {
    $sortBy = 'sort_order';
}
$orderClause = "ORDER BY b.{$sortBy} {$sortDir}" . ($sortBy !== 'name' ? ', b.name' : '');

$branches = $db->fetchAll(
    "SELECT b.*, p.name as parent_name
     FROM branches b
     LEFT JOIN branches p ON b.parent_id = p.id
     WHERE $whereClause {$orderClause}",
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
