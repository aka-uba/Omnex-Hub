<?php
/**
 * Branch Product Overrides API
 *
 * GET /api/branches/:id/overrides - Override listesi
 * POST /api/branches/:id/overrides - Override oluştur/güncelle
 * DELETE /api/branches/:id/overrides/:productId - Override sil
 */

require_once __DIR__ . '/../../services/ProductPriceResolver.php';
require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$branchId = $request->routeParam('id');
if (!$branchId) {
    Response::error('Şube ID gerekli', 400);
}

$companyId = Auth::getActiveCompanyId();

// Şube erişim kontrolü
if (!BranchService::userHasAccess($user['id'], $branchId)) {
    Response::error('Bu şubeye erişim yetkiniz yok', 403);
}

$method = $_SERVER['REQUEST_METHOD'];

// ==================== GET: Override Listesi ====================
if ($method === 'GET') {
    $page = (int)($_GET['page'] ?? 1);
    $perPage = (int)($_GET['per_page'] ?? 20);
    $offset = ($page - 1) * $perPage;
    $search = $_GET['search'] ?? null;
    $scope = $_GET['scope'] ?? null; // price, campaign, stock, compliance

    $where = ['pbo.branch_id = ?', 'pbo.deleted_at IS NULL'];
    $params = [$branchId];

    if ($search) {
        $where[] = '(p.name LIKE ? OR p.sku LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    if ($scope) {
        $where[] = 'pbo.override_scope = ?';
        $params[] = $scope;
    }

    $whereClause = implode(' AND ', $where);

    // Count
    $total = $db->fetch(
        "SELECT COUNT(*) as count FROM product_branch_overrides pbo
         JOIN products p ON pbo.product_id = p.id
         WHERE $whereClause",
        $params
    );

    // Data
    $overrides = $db->fetchAll(
        "SELECT pbo.*, p.name as product_name, p.sku, p.barcode,
                p.current_price as master_price, p.stock_quantity as master_stock
         FROM product_branch_overrides pbo
         JOIN products p ON pbo.product_id = p.id
         WHERE $whereClause
         ORDER BY pbo.updated_at DESC
         LIMIT ? OFFSET ?",
        array_merge($params, [$perPage, $offset])
    );

    Response::success([
        'data' => $overrides,
        'total' => $total['count'],
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => ceil($total['count'] / $perPage)
    ]);
}

// ==================== POST: Override Oluştur/Güncelle ====================
if ($method === 'POST') {
    $productId = $request->input('product_id');

    if (empty($productId)) {
        Response::error('Ürün ID gerekli', 400);
    }

    $data = $request->all();
    $values = [];
    $allowedFields = [
        'current_price', 'previous_price', 'price_updated_at', 'price_valid_until',
        'discount_percent', 'discount_amount', 'campaign_text', 'campaign_start', 'campaign_end',
        'stock_quantity', 'min_stock_level', 'max_stock_level', 'reorder_point',
        'shelf_location', 'aisle', 'shelf_number',
        'kunye_no', 'kunye_data',
        'is_available', 'availability_reason'
    ];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $data)) {
            $values[$field] = $data[$field];
        }
    }

    if (empty($values)) {
        Response::error('En az bir override değeri gerekli', 400);
    }

    $result = ProductPriceResolver::setOverride(
        $productId,
        $branchId,
        $values,
        $request->input('source', 'manual'),
        $user['id']
    );

    if ($result['success']) {
        Response::success($result, 'Override kaydedildi');
    } else {
        Response::error($result['error'], 400);
    }
}

// ==================== DELETE: Override Sil ====================
if ($method === 'DELETE') {
    $productId = $request->routeParam('productId') ?? $_GET['product_id'] ?? null;

    if (!$productId) {
        Response::error('Ürün ID gerekli', 400);
    }

    ProductPriceResolver::deleteOverride($productId, $branchId, $user['id']);

    Response::success(null, 'Override silindi');
}

Response::error('Geçersiz istek', 400);
