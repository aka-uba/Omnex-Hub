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

// Hard delete - permanently remove from database
$db->delete('products', 'id = ?', [$productId]);

// Log
Logger::audit('delete', 'products', [
    'product_id' => $productId,
    'sku' => $product['sku'],
    'name' => $product['name']
]);

Response::success(null, 'Ürün kalıcı olarak silindi');
