<?php
/**
 * Product Delete API - Hard Delete
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->getRouteParam('id');

// Check product exists
$product = $db->fetch(
    "SELECT id, sku, name FROM products WHERE id = ? AND company_id = ?",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Ürün bulunamadı');
}

try {
    $db->beginTransaction();
    // Hard delete - permanently remove from database
    $db->delete('products', 'id = ?', [$productId]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Product delete error', [
        'product_id' => $productId,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

try {
    Logger::audit('delete', 'products', [
        'product_id' => $productId,
        'sku' => $product['sku'],
        'name' => $product['name']
    ]);
} catch (Throwable $auditError) {
    error_log('Product delete audit skipped: ' . $auditError->getMessage());
}

Response::success(null, 'Ürün kalıcı olarak silindi');
