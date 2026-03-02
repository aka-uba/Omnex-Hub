<?php
/**
 * Bundle Export API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$bundleId = $request->query('id');
$bundleIds = $request->query('ids');
$all = $request->query('all');

$where = ["b.company_id = ?"];
$params = [$companyId];

if ($bundleId) {
    $where[] = "b.id = ?";
    $params[] = $bundleId;
} elseif ($bundleIds) {
    $ids = explode(',', $bundleIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $where[] = "b.id IN ($placeholders)";
    $params = array_merge($params, $ids);
} elseif (!$all) {
    Response::error('id, ids veya all parametresi gerekli', 400);
}

$whereClause = implode(' AND ', $where);

$bundles = $db->fetchAll(
    "SELECT b.* FROM bundles b WHERE $whereClause ORDER BY b.name ASC",
    $params
);

// Enrich with items
foreach ($bundles as &$bundle) {
    $bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
    $bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
    $bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];
    $bundle['extra_data'] = !empty($bundle['extra_data']) ? json_decode($bundle['extra_data'], true) ?: [] : [];

    $items = $db->fetchAll(
        "SELECT bi.*, p.name as product_name, p.sku as product_sku, p.barcode as product_barcode
         FROM bundle_items bi
         LEFT JOIN products p ON bi.product_id = p.id
         WHERE bi.bundle_id = ?
         ORDER BY bi.sort_order ASC",
        [$bundle['id']]
    );

    $bundle['items'] = $items;
}

$exportData = [
    'format' => 'omnex_bundles',
    'version' => '1.0',
    'exported_at' => date('Y-m-d H:i:s'),
    'count' => count($bundles),
    'bundles' => $bundles
];

header('Content-Type: application/json');
header('Content-Disposition: attachment; filename="bundles_export_' . date('Y-m-d_His') . '.json"');
echo json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
exit;
