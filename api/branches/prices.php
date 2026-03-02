<?php
/**
 * Branch Prices API - Ürün fiyatlarını şube bazlı çözümle
 *
 * GET /api/branches/:id/prices - Şubeye göre ürün fiyatları
 * GET /api/branches/:id/prices/:productId - Tek ürün efektif fiyatı
 */

require_once __DIR__ . '/../../services/ProductPriceResolver.php';
require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$branchId = $request->routeParam('id');
$productId = $request->routeParam('productId') ?? $_GET['product_id'] ?? null;

$companyId = Auth::getActiveCompanyId();

// Şube erişim kontrolü
if ($branchId && !BranchService::userHasAccess($user['id'], $branchId)) {
    Response::error('Bu şubeye erişim yetkiniz yok', 403);
}

// Tek ürün
if ($productId) {
    $result = ProductPriceResolver::resolve($productId, $branchId);
    Response::success($result);
}

// Toplu çözümleme
$page = (int)($_GET['page'] ?? 1);
$perPage = (int)($_GET['per_page'] ?? 50);
$offset = ($page - 1) * $perPage;
$search = $_GET['search'] ?? null;
$categoryId = $_GET['category_id'] ?? null;
$hasOverride = isset($_GET['has_override']) ? $_GET['has_override'] === '1' : null;

$where = ['p.company_id = ?'];
$params = [$companyId];

if ($search) {
    $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($categoryId) {
    $where[] = 'p.category_id = ?';
    $params[] = $categoryId;
}

$whereClause = implode(' AND ', $where);

// Ürünleri al
$products = $db->fetchAll(
    "SELECT p.id, p.sku, p.name, p.barcode, p.current_price, p.previous_price,
            p.stock_quantity, p.category_id
     FROM products p
     WHERE $whereClause
     ORDER BY p.name
     LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

$productIds = array_column($products, 'id');

// Toplu çözümleme
$resolved = [];
if (!empty($productIds)) {
    $resolved = ProductPriceResolver::resolveMultiple(
        $productIds,
        $branchId,
        ['price', 'campaign', 'stock', 'availability']
    );
}

// Ürünlerle birleştir
$result = [];
foreach ($products as $product) {
    $priceData = $resolved[$product['id']] ?? null;

    $item = [
        'id' => $product['id'],
        'sku' => $product['sku'],
        'name' => $product['name'],
        'barcode' => $product['barcode'],
        'master_price' => $product['current_price'],
        'master_stock' => $product['stock_quantity']
    ];

    if ($priceData) {
        $item['effective_price'] = $priceData['values']['current_price']['value'] ?? $product['current_price'];
        $item['effective_stock'] = $priceData['values']['stock_quantity']['value'] ?? $product['stock_quantity'];
        $item['price_source'] = $priceData['values']['current_price']['source'] ?? 'master';
        $item['has_override'] = $priceData['has_override'];
        $item['override_scope'] = $priceData['override_scope'];
        $item['is_available'] = $priceData['values']['is_available']['value'] ?? true;
    }

    // has_override filtresi
    if ($hasOverride !== null) {
        if ($hasOverride && !($item['has_override'] ?? false)) continue;
        if (!$hasOverride && ($item['has_override'] ?? false)) continue;
    }

    $result[] = $item;
}

// Total count
$total = $db->fetch(
    "SELECT COUNT(*) as count FROM products p WHERE $whereClause",
    array_slice($params, 0, -2) ?: $params
);

Response::success([
    'data' => $result,
    'total' => $total['count'],
    'page' => $page,
    'per_page' => $perPage,
    'branch_id' => $branchId
]);
