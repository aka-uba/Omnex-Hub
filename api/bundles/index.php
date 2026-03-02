<?php
/**
 * Bundles List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Pagination
$page = (int)$request->query('page', 1);
$limit = (int)$request->query('limit', 25);
$offset = ($page - 1) * $limit;

// Search & Filters
$search = $request->query('search');
$type = $request->query('type');
$status = $request->query('status');
$sortBy = $request->query('sort_by', 'updated_at');
$sortDir = $request->query('sort_dir', 'DESC');

// Build query
$where = ["b.company_id = ?"];
$params = [$companyId];

if ($search) {
    $where[] = "(b.name LIKE ? OR b.sku LIKE ? OR b.barcode LIKE ?)";
    $searchTerm = "%$search%";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

if ($type) {
    $where[] = "b.type = ?";
    $params[] = $type;
}

if ($status) {
    $where[] = "b.status = ?";
    $params[] = $status;
}

$whereClause = implode(' AND ', $where);

// Whitelist sort columns
$allowedSort = ['name', 'type', 'item_count', 'total_price', 'final_price', 'status', 'created_at', 'updated_at'];
if (!in_array($sortBy, $allowedSort)) {
    $sortBy = 'updated_at';
}
$sortDir = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

// Count
$total = $db->fetch(
    "SELECT COUNT(*) as total FROM bundles b WHERE $whereClause",
    $params
)['total'];

// Fetch
$bundles = $db->fetchAll(
    "SELECT b.* FROM bundles b
     WHERE $whereClause
     ORDER BY b.$sortBy $sortDir
     LIMIT ? OFFSET ?",
    array_merge($params, [$limit, $offset])
);

// Parse JSON fields
foreach ($bundles as &$bundle) {
    $bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
    $bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
    $bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];
}

// Stats
$stats = $db->fetch(
    "SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(item_count) as total_items
     FROM bundles WHERE company_id = ?",
    [$companyId]
);

Response::success([
    'bundles' => $bundles,
    'pagination' => [
        'total' => (int)$total,
        'page' => $page,
        'limit' => $limit,
        'pages' => ceil($total / $limit)
    ],
    'stats' => [
        'total' => (int)($stats['total'] ?? 0),
        'active' => (int)($stats['active'] ?? 0),
        'draft' => (int)($stats['draft'] ?? 0),
        'total_items' => (int)($stats['total_items'] ?? 0)
    ]
]);
