<?php
/**
 * Product Update API - With Version Tracking & Render Invalidation
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

require_once BASE_PATH . '/services/RenderCacheService.php';
require_once BASE_PATH . '/services/RenderService.php';
require_once BASE_PATH . '/services/ProductPriceResolver.php';

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->getRouteParam('id');

// Check product exists
$product = $db->fetch(
    "SELECT * FROM products WHERE id = ? AND company_id = ? AND status != 'deleted'",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Ürün bulunamadı');
}

// Detect optional columns once (for backward-compatible updates)
$productColumnNames = [];
$hasVersionColumn = false;
$hasVatUpdatedAtColumn = false;
try {
    $productColumnNames = $db->getTableColumns('products');
    $hasVersionColumn = in_array('version', $productColumnNames, true);
    $hasVatUpdatedAtColumn = in_array('vat_updated_at', $productColumnNames, true);
} catch (Exception $e) {
    // Keep defaults if schema inspection fails
}

// Validate input - basic checks only (price must be numeric and non-negative)
$rules = [
    'current_price' => 'numeric|min:0'
];

$validator = Validator::make($request->all(), $rules);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// SKU unique check if changing
$newSku = $request->input('sku');
if ($newSku && $newSku !== $product['sku']) {
    // Check manually if SKU already exists for this company (excluding current product)
    $existingSku = $db->fetch(
        "SELECT id FROM products WHERE sku = ? AND company_id = ? AND id != ?",
        [$newSku, $companyId, $productId]
    );
    if ($existingSku) {
        Response::validationError(['sku' => ['Bu SKU zaten kullanılıyor']]);
    }
}

// Check for branch-specific update
$branchId = $request->input('branch_id');
$isBranchUpdate = !empty($branchId);

// Debug: Log branch update info
Logger::info('Product update request', [
    'product_id' => $productId,
    'branch_id' => $branchId,
    'is_branch_update' => $isBranchUpdate,
    'current_price' => $request->input('current_price'),
    'has_current_price' => $request->has('current_price')
]);

// Track automatic change fields
$nowDateTime = date('Y-m-d H:i:s');
$currentPriceInputProvided = $request->has('current_price');
$newPrice = $currentPriceInputProvided ? $request->input('current_price') : null;
$priceChanged = $currentPriceInputProvided &&
    $newPrice !== null &&
    floatval($product['current_price']) !== floatval($newPrice);

$previousPriceInputProvided = $request->has('previous_price');
$previousPriceChanged = false;
if ($previousPriceInputProvided) {
    $existingPreviousPrice = $product['previous_price'];
    $incomingPreviousPrice = $request->input('previous_price');
    if ($existingPreviousPrice === null && $incomingPreviousPrice === null) {
        $previousPriceChanged = false;
    } else {
        $previousPriceChanged = floatval($existingPreviousPrice ?? 0) !== floatval($incomingPreviousPrice ?? 0);
    }
}

$vatRateInputProvided = $request->has('vat_rate');
$vatChanged = $vatRateInputProvided &&
    floatval($product['vat_rate'] ?? 0) !== floatval($request->input('vat_rate'));

// Prepare update data
$updateFields = [
    'sku', 'barcode', 'name', 'current_price', 'previous_price',
    'price_updated_at', 'previous_price_updated_at', 'unit',
    'category', 'subcategory', 'brand', 'origin', 'description',
    'image_url', 'images', 'videos', 'cover_image_index', 'stock', 'vat_rate', 'discount_percent', 'campaign_text',
    'weight', 'kunye_no', 'shelf_location', 'supplier_code',
    'valid_from', 'valid_until', 'status', 'price_valid_until', 'slug',
    'assigned_device_id', 'assigned_template_id'
];

$data = ['updated_at' => date('Y-m-d H:i:s')];

// Handle group field separately (reserved word in SQL)
if ($request->has('group')) {
    $data['group'] = $request->input('group');
}

foreach ($updateFields as $field) {
    if ($request->has($field)) {
        $data[$field] = $request->input($field);
    }
}

// Handle is_featured
if ($request->has('is_featured')) {
    $data['is_featured'] = $request->input('is_featured') ? 1 : 0;
}

// Handle extra_data
if ($request->has('extra_data')) {
    $data['extra_data'] = json_encode($request->input('extra_data'));
}

// Auto-update price/vat timestamps and previous price
if ($priceChanged) {
    // Old sale price becomes previous price automatically
    $data['previous_price'] = $product['current_price'];
    $data['price_updated_at'] = $nowDateTime;
    $data['previous_price_updated_at'] = $nowDateTime;
} elseif ($previousPriceChanged) {
    $data['previous_price_updated_at'] = $nowDateTime;
}

if ($vatChanged && $hasVatUpdatedAtColumn) {
    $data['vat_updated_at'] = $nowDateTime;
}

// ========================================
// BRANCH-SPECIFIC VS MASTER UPDATE
// ========================================
try {
    $db->beginTransaction();

if ($isBranchUpdate) {
    // Branch-specific update: Use ProductPriceResolver to create/update override
    $branchOverrideFields = [
        'current_price', 'previous_price', 'price_updated_at', 'price_valid_until',
        'discount_percent', 'discount_amount', 'campaign_text', 'campaign_start', 'campaign_end',
        'stock_quantity', 'min_stock_level', 'max_stock_level', 'reorder_point',
        'shelf_location', 'aisle', 'shelf_number',
        'kunye_no', 'kunye_data',
        'is_available', 'availability_reason'
    ];

    // Map incoming fields to override fields
    $overrideData = [];
    foreach ($branchOverrideFields as $field) {
        if ($request->has($field)) {
            $overrideData[$field] = $request->input($field);
        }
    }

    // Also check aliased fields
    if ($request->has('stock') && !isset($overrideData['stock_quantity'])) {
        $overrideData['stock_quantity'] = $request->input('stock');
    }

    // Debug: Log override data before saving
    Logger::info('Branch override data collected', [
        'product_id' => $productId,
        'branch_id' => $branchId,
        'override_data' => $overrideData,
        'override_data_empty' => empty($overrideData)
    ]);

    if (!empty($overrideData)) {
        $overrideResult = ProductPriceResolver::setOverride(
            $productId,
            $branchId,
            $overrideData,
            'manual',
            $user['id']
        );

        Logger::info('Branch override result', [
            'product_id' => $productId,
            'branch_id' => $branchId,
            'result' => $overrideResult
        ]);

        if (!$overrideResult['success']) {
            throw new RuntimeException($overrideResult['error'] ?? 'Branch override save failed');
        }

        Logger::info('Branch override saved', [
            'product_id' => $productId,
            'branch_id' => $branchId,
            'action' => $overrideResult['action'],
            'fields' => array_keys($overrideData)
        ]);
    } else {
        Logger::warning('Branch update requested but no override data', [
            'product_id' => $productId,
            'branch_id' => $branchId
        ]);
    }

    // For non-override fields (name, sku, barcode, etc.), still update master if provided
    $masterOnlyFields = ['sku', 'barcode', 'name', 'category', 'subcategory', 'brand',
                         'origin', 'description', 'image_url', 'images', 'videos',
                         'cover_image_index', 'vat_rate', 'vat_updated_at', 'weight', 'unit', 'supplier_code',
                         'valid_from', 'valid_until', 'status', 'slug', 'group',
                         'assigned_device_id', 'assigned_template_id', 'is_featured', 'extra_data'];

    $masterData = ['updated_at' => date('Y-m-d H:i:s')];
    foreach ($masterOnlyFields as $field) {
        if (isset($data[$field])) {
            $masterData[$field] = $data[$field];
        }
    }

    if (count($masterData) > 1) { // More than just updated_at
        $db->update('products', $masterData, 'id = ?', [$productId]);
    }
} else {
    // Master update: Update product directly (existing behavior)
    if ($hasVersionColumn) {
        $data['version'] = ($product['version'] ?? 0) + 1;
    }
    $db->update('products', $data, 'id = ?', [$productId]);
}
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Product update error', [
        'product_id' => $productId,
        'company_id' => $companyId,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

// ========================================
// RENDER INVALIDATION (v2.0.14)
// ========================================
// Ürün güncellendiğinde eski render'ları sil
try {
    $renderService = new RenderService();
    $invalidationResult = $renderService->invalidateProductRenders($productId, $companyId);

    if ($invalidationResult['deleted_files'] > 0) {
        Logger::info('Product renders invalidated', [
            'product_id' => $productId,
            'deleted_files' => $invalidationResult['deleted_files'],
            'freed_mb' => $invalidationResult['freed_mb']
        ]);
    }
} catch (Exception $e) {
    // Log error but don't fail the update
    Logger::error('Render invalidation failed', [
        'product_id' => $productId,
        'error' => $e->getMessage()
    ]);
}

// Trigger render cache update (legacy system)
try {
    $cacheService = new RenderCacheService();
    $renderResult = $cacheService->onProductUpdated($productId, $companyId, 'api', [
        'user_id' => $user['id'],
        'price_changed' => $priceChanged
    ]);
} catch (Exception $e) {
    // Log error but don't fail the update
    Logger::error('Render cache trigger failed', [
        'product_id' => $productId,
        'error' => $e->getMessage()
    ]);
}

// Log price change
// Note: Branch price changes are logged by ProductPriceResolver::setOverride() to branch_price_history
if ($priceChanged && !$isBranchUpdate) {
    try {
        // Master price change - log to central price_history
        $db->insert('price_history', [
            'id' => $db->generateUuid(),
            'product_id' => $productId,
            'old_price' => $product['current_price'],
            'new_price' => $newPrice,
            'changed_at' => date('Y-m-d H:i:s'),
            'source' => 'manual'
        ]);
    } catch (Throwable $priceHistoryError) {
        Logger::error('Price history insert failed', [
            'product_id' => $productId,
            'error' => $priceHistoryError->getMessage()
        ]);
    }
}

// Log update
try {
    Logger::audit('update', 'products', [
        'product_id' => $productId,
        'changes' => array_keys($data)
    ]);
} catch (Throwable $auditError) {
    error_log('Product update audit skipped: ' . $auditError->getMessage());
}

// Get updated product
$updated = $db->fetch("SELECT * FROM products WHERE id = ?", [$productId]);

// Add branch info to response if branch update
if ($isBranchUpdate) {
    $updated['_branch_update'] = true;
    $updated['_branch_id'] = $branchId;

    // Get branch-specific values using resolver
    $branchData = ProductPriceResolver::resolve($productId, $branchId, ['price', 'campaign', 'stock', 'compliance']);
    if ($branchData['success']) {
        $updated['_branch_values'] = $branchData['values'];
    }
}

Response::success($updated, $isBranchUpdate ? 'Şube ürün bilgileri güncellendi' : 'Ürün başarıyla güncellendi');
