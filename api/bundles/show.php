<?php
/**
 * Bundle Detail API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$bundleId = $request->getRouteParam('id');

if (!$bundleId) {
    Response::error('Bundle ID gerekli', 400);
}

// Fetch bundle
$bundle = $db->fetch(
    "SELECT * FROM bundles WHERE id = ? AND company_id = ?",
    [$bundleId, $companyId]
);

if (!$bundle) {
    Response::error('Paket bulunamadı', 404);
}

// Parse JSON fields
$bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
$bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
$bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];
$bundle['extra_data'] = !empty($bundle['extra_data']) ? json_decode($bundle['extra_data'], true) ?: [] : [];

// Fetch items with product details
$items = $db->fetchAll(
    "SELECT bi.*, p.name as product_name, p.sku as product_sku, p.barcode as product_barcode,
            p.current_price as product_current_price, p.image_url as product_image_url,
            p.images as product_images, p.unit as product_unit, p.category as product_category,
            p.status as product_status
     FROM bundle_items bi
     LEFT JOIN products p ON bi.product_id = p.id
     WHERE bi.bundle_id = ?
     ORDER BY bi.sort_order ASC",
    [$bundleId]
);

// Parse product images for thumbnail
foreach ($items as &$item) {
    $productImages = !empty($item['product_images']) ? json_decode($item['product_images'], true) ?: [] : [];
    $item['product_thumbnail'] = $item['product_image_url'] ?: (!empty($productImages[0]['url']) ? $productImages[0]['url'] : null);
    unset($item['product_images']);
}

$bundle['items'] = $items;

// Check for branch-specific data
$branchId = $request->input('branch_id') ?? ($_GET['branch_id'] ?? null);

if (!empty($branchId)) {
    // Branch-specific: resolve override values and fetch branch price history
    require_once __DIR__ . '/../../services/BundlePriceResolver.php';

    $resolvedData = BundlePriceResolver::resolve($bundleId, $branchId);

    if ($resolvedData['success']) {
        // Merge resolved values into bundle
        foreach ($resolvedData['values'] as $field => $valueInfo) {
            if ($valueInfo['value'] !== null) {
                $bundle[$field] = $valueInfo['value'];
                $bundle['_source_' . $field] = $valueInfo['source'];
            }
        }

        $bundle['_has_override'] = $resolvedData['has_override'];
        $bundle['_data_source'] = $resolvedData['source'];
        $bundle['_branch_id'] = $branchId;
    }

    // Get branch-specific price history
    try {
        $priceHistory = $db->fetchAll(
            "SELECT old_price, new_price, old_total_price, new_total_price,
                    old_discount_percent, new_discount_percent,
                    change_reason as source, changed_at
             FROM bundle_branch_price_history
             WHERE bundle_id = ? AND branch_id = ?
             ORDER BY changed_at DESC
             LIMIT 100",
            [$bundleId, $branchId]
        );
        $bundle['price_history'] = $priceHistory ?: [];
    } catch (Exception $e) {
        $bundle['price_history'] = [];
    }
} else {
    // Master: fetch central price history
    try {
        $priceHistory = $db->fetchAll(
            "SELECT * FROM bundle_price_history WHERE bundle_id = ? ORDER BY changed_at DESC LIMIT 100",
            [$bundleId]
        );
        $bundle['price_history'] = $priceHistory ?: [];
    } catch (Exception $e) {
        $bundle['price_history'] = [];
    }
}

Response::success($bundle);
