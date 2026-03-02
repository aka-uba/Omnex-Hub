<?php
/**
 * Product Create API
 */

require_once BASE_PATH . '/services/RenderCacheService.php';

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Validate input
$validator = Validator::make($request->all(), [
    'sku' => 'required|max:100',
    'name' => 'required|max:500',
    'current_price' => 'required|numeric|min:0',
    'barcode' => 'max:100',
    'unit' => 'max:100'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Check SKU uniqueness manually for this company
$existingSku = $db->fetch(
    "SELECT id FROM products WHERE sku = ? AND company_id = ?",
    [$request->input('sku'), $companyId]
);
if ($existingSku) {
    Response::validationError(['sku' => ['Bu SKU zaten kullanılıyor']]);
}

$productId = $db->generateUuid();
$nowDateTime = date('Y-m-d H:i:s');
$initialPreviousPrice = $request->input('previous_price');

// Generate slug from name if not provided
$slug = $request->input('slug');
if (!$slug) {
    $name = $request->input('name');
    $slug = strtolower(trim($name));
    $slug = preg_replace('/[çÇ]/', 'c', $slug);
    $slug = preg_replace('/[ğĞ]/', 'g', $slug);
    $slug = preg_replace('/[ıİ]/', 'i', $slug);
    $slug = preg_replace('/[öÖ]/', 'o', $slug);
    $slug = preg_replace('/[şŞ]/', 's', $slug);
    $slug = preg_replace('/[üÜ]/', 'u', $slug);
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
    $slug = preg_replace('/[\s]+/', '-', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');
}

$data = [
    'id' => $productId,
    'company_id' => $companyId,
    'sku' => $request->input('sku'),
    'barcode' => $request->input('barcode'),
    'name' => $request->input('name'),
    'slug' => $slug,
    'current_price' => $request->input('current_price'),
    'previous_price' => $initialPreviousPrice,
    'price_updated_at' => $request->input('price_updated_at') ?: $nowDateTime,
    'previous_price_updated_at' => $request->input('previous_price_updated_at') ?: (($initialPreviousPrice !== null && $initialPreviousPrice !== '') ? $nowDateTime : null),
    'price_valid_until' => $request->input('price_valid_until'),
    'unit' => $request->input('unit', 'adet'),
    'group' => $request->input('group'),
    'category' => $request->input('category'),
    'subcategory' => $request->input('subcategory'),
    'brand' => $request->input('brand'),
    'origin' => $request->input('origin'),
    // production_type artık product_hal_data tablosunda saklanıyor (migration 059-060)
    'description' => $request->input('description'),
    'image_url' => $request->input('image_url'),
    'images' => $request->input('images'),
    'videos' => $request->input('videos'),
    'cover_image_index' => $request->input('cover_image_index', 0),
    'stock' => $request->input('stock', 0),
    'vat_rate' => $request->input('vat_rate', 20),
    'discount_percent' => $request->input('discount_percent'),
    'campaign_text' => $request->input('campaign_text'),
    'weight' => $request->input('weight'),
    'kunye_no' => $request->input('kunye_no'),
    'shelf_location' => $request->input('shelf_location'),
    'supplier_code' => $request->input('supplier_code'),
    'is_featured' => $request->input('is_featured', false) ? 1 : 0,
    'status' => $request->input('status', 'active'),
    'extra_data' => $request->input('extra_data') ? json_encode($request->input('extra_data')) : null,
    'valid_from' => $request->input('valid_from'),
    'valid_until' => $request->input('valid_until'),
    'created_at' => $nowDateTime,
    'updated_at' => $nowDateTime
];

// Add version and render_status only if columns exist
try {
    $columnNames = $db->getTableColumns('products');
    if (in_array('version', $columnNames)) {
        $data['version'] = 1;
    }
    if (in_array('render_status', $columnNames)) {
        $data['render_status'] = 'pending';
    }
    if (in_array('vat_updated_at', $columnNames)) {
        $data['vat_updated_at'] = $request->input('vat_updated_at') ?: $nowDateTime;
    }
} catch (Exception $e) {
    // Ignore column check errors
}

// Remove null values
$data = array_filter($data, fn($v) => $v !== null);

$db->insert('products', $data);

// Trigger render cache for new product
try {
    $cacheService = new RenderCacheService();
    $renderResult = $cacheService->onProductUpdated($productId, $companyId, 'api', [
        'user_id' => $user['id'],
        'is_new' => true
    ]);
} catch (Exception $e) {
    // Log error but don't fail the create
    Logger::error('Render cache trigger failed', [
        'product_id' => $productId,
        'error' => $e->getMessage()
    ]);
}

// Log
Logger::audit('create', 'products', [
    'product_id' => $productId,
    'sku' => $data['sku']
]);

// Get created product
$product = $db->fetch("SELECT * FROM products WHERE id = ?", [$productId]);

Response::success($product, 'Ürün başarıyla oluşturuldu', 201);
