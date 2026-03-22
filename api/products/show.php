<?php
/**
 * Product Detail API
 * Supports branch-specific data when branch_id parameter is provided
 */

require_once BASE_PATH . '/services/ProductPriceResolver.php';

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->getRouteParam('id');
$branchId = $request->query('branch_id') ?: $request->header('X-Active-Branch');

// Get product
$product = $db->fetch(
    "SELECT * FROM products WHERE id = ? AND company_id = ? AND status != 'deleted'",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Ürün bulunamadı');
}

// Merge HAL data from product_hal_data so frontend render gets dynamic fields too
$halData = $db->fetch(
    "SELECT * FROM product_hal_data WHERE product_id = ? AND company_id = ?",
    [$productId, $companyId]
);
if ($halData) {
    if (!empty($halData['gecmis_bildirimler']) && is_string($halData['gecmis_bildirimler'])) {
        $decodedHistory = json_decode($halData['gecmis_bildirimler'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $halData['gecmis_bildirimler'] = $decodedHistory;
        }
    }
    if (!empty($halData['hal_raw_data']) && is_string($halData['hal_raw_data'])) {
        $decodedRaw = json_decode($halData['hal_raw_data'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $halData['hal_raw_data'] = $decodedRaw;
        }
    }

    foreach ($halData as $field => $value) {
        if (in_array($field, ['id', 'product_id', 'company_id', 'created_at', 'updated_at', 'deleted_at'], true)) {
            continue;
        }
        $current = $product[$field] ?? null;
        if (($current === null || $current === '') && $value !== null && $value !== '') {
            $product[$field] = $value;
        }
    }
    $product['hal_data'] = $halData;
}

// ========================================
// BRANCH-SPECIFIC DATA RESOLUTION
// ========================================
if (!empty($branchId)) {
    // Get branch-specific values using ProductPriceResolver
    $resolvedData = ProductPriceResolver::resolve($productId, $branchId, ['price', 'campaign', 'stock', 'compliance', 'availability']);

    if ($resolvedData['success']) {
        // Merge resolved values into product data
        foreach ($resolvedData['values'] as $field => $valueInfo) {
            if ($valueInfo['value'] !== null) {
                // Map override field names to product field names
                $productField = $field;
                if ($field === 'stock_quantity') $productField = 'stock';

                $product[$productField] = $valueInfo['value'];
                $product['_source_' . $field] = $valueInfo['source']; // master, branch, or region
            }
        }

        $product['_has_override'] = $resolvedData['has_override'];
        $product['_override_scope'] = $resolvedData['override_scope'] ?? null;
        $product['_data_source'] = $resolvedData['source'];
        $product['_branch_id'] = $branchId;
    }

    // Get branch-specific price history
    $priceHistory = $db->fetchAll(
        "SELECT old_price, new_price, change_reason as source, changed_at
         FROM branch_price_history
         WHERE product_id = ? AND branch_id = ?
         ORDER BY changed_at DESC
         LIMIT 20",
        [$productId, $branchId]
    );
} else {
    // Get central price history (master data)
    $priceHistory = $db->fetchAll(
        "SELECT old_price, new_price, changed_at, source
         FROM price_history
         WHERE product_id = ?
         ORDER BY changed_at DESC
         LIMIT 20",
        [$productId]
    );
}

$product['price_history'] = $priceHistory;

// Get assigned devices/labels for this product
$assignedDevices = $db->fetchAll(
    "SELECT d.id, d.name as device_name, d.location, d.type, d.current_content, d.current_template_id, d.status
     FROM devices d
     WHERE d.company_id = ?
     AND d.current_content IS NOT NULL
     AND d.current_content LIKE ?",
    [$companyId, '%"product_id":"' . $productId . '"%']
);

// Build template lookup for labels (name + preview_image)
$templateLookup = [];
$allTemplates = $db->fetchAll(
    "SELECT id, name, preview_image FROM templates WHERE (company_id = ? OR scope = 'system' OR company_id IS NULL)",
    [$companyId]
);
foreach ($allTemplates as $t) {
    $templateLookup[$t['id']] = [
        'name' => $t['name'],
        'preview_image' => $t['preview_image'] ?? null
    ];
}

// Format labels for frontend
$labels = [];
foreach ($assignedDevices as $device) {
    $content = json_decode($device['current_content'], true);
    if ($content && isset($content['product_id']) && $content['product_id'] === $productId) {
        $tplInfo = $templateLookup[$device['current_template_id']] ?? null;
        $labels[] = [
            'id' => $device['id'],  // Use device_id as label id for edit/delete
            'device_id' => $device['id'],
            'device_name' => $device['device_name'],
            'location' => $device['location'],
            'device_type' => $device['type'],
            'template_id' => $device['current_template_id'],
            'template_name' => $tplInfo['name'] ?? null,
            'template_preview' => $tplInfo['preview_image'] ?? null,
            'assigned_at' => $content['assigned_at'] ?? null,
            'status' => $device['status'] === 'online' ? 'synced' : 'pending'
        ];
    }
}
$product['labels'] = $labels;

// Parse JSON fields
if (isset($product['extra_data'])) {
    $product['extra_data'] = json_decode($product['extra_data'], true);
}

// Parse images array
if (isset($product['images']) && is_string($product['images'])) {
    $product['images'] = json_decode($product['images'], true) ?: [];
}

// Parse videos array
if (isset($product['videos']) && is_string($product['videos'])) {
    $product['videos'] = json_decode($product['videos'], true) ?: [];
}

Response::success($product);
