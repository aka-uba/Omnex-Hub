<?php
/**
 * Bundles List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Branch override support
$activeBranchId = $request->header('X-Active-Branch');

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
unset($bundle);

// ── Branch price override ──────────────────────────────────────
if ($activeBranchId && !empty($bundles)) {
    $bundleIds = array_column($bundles, 'id');
    $placeholders = implode(',', array_fill(0, count($bundleIds), '?'));

    // Şube override'larını al
    $overrides = $db->fetchAll(
        "SELECT * FROM bundle_branch_overrides
         WHERE bundle_id IN ($placeholders) AND branch_id = ? AND deleted_at IS NULL",
        array_merge($bundleIds, [$activeBranchId])
    );

    // Bölge override'larını al (parent branch varsa)
    $branch = $db->fetch("SELECT id, parent_id FROM branches WHERE id = ?", [$activeBranchId]);
    $regionOverrides = [];
    if ($branch && $branch['parent_id']) {
        $regionOverrides = $db->fetchAll(
            "SELECT * FROM bundle_branch_overrides
             WHERE bundle_id IN ($placeholders) AND branch_id = ? AND deleted_at IS NULL",
            array_merge($bundleIds, [$branch['parent_id']])
        );
    }

    // Map'e dönüştür
    $overrideMap = [];
    foreach ($overrides as $o) {
        $overrideMap[$o['bundle_id']] = $o;
    }
    $regionMap = [];
    foreach ($regionOverrides as $ro) {
        $regionMap[$ro['bundle_id']] = $ro;
    }

    // Override uygula (fallback: şube → bölge → master)
    foreach ($bundles as &$bundle) {
        $bo = $overrideMap[$bundle['id']] ?? null;
        $ro = $regionMap[$bundle['id']] ?? null;
        $override = $bo ?: $ro;

        if (!$override) continue;

        $source = $bo ? 'branch' : 'region';

        if ($override['final_price'] !== null) {
            $bundle['final_price'] = $override['final_price'];
        }
        if ($override['total_price'] !== null) {
            $bundle['total_price'] = $override['total_price'];
        }
        if ($override['previous_final_price'] !== null) {
            $bundle['previous_final_price'] = $override['previous_final_price'];
        }
        if ($override['discount_percent'] !== null) {
            $bundle['discount_percent'] = $override['discount_percent'];
        }

        $bundle['_branch_override'] = [
            'source' => $source,
            'price_override' => (bool)($override['price_override'] ?? false)
        ];
    }
    unset($bundle);
}
// ───────────────────────────────────────────────────────────────

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

$responseData = [
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
];

if ($activeBranchId) {
    $activeBranch = $db->fetch(
        "SELECT id, name, type FROM branches WHERE id = ? AND company_id = ?",
        [$activeBranchId, $companyId]
    );
    if ($activeBranch) {
        $responseData['active_branch'] = $activeBranch;
    }
}

Response::success($responseData);
