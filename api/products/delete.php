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

    // Log deletion for PriceView delta sync (before hard delete)
    $deletedProduct = $db->fetch("SELECT id, company_id, sku, barcode FROM products WHERE id = ?", [$productId]);
    if ($deletedProduct) {
        try {
            $db->insert('product_deletions', [
                'product_id' => $deletedProduct['id'],
                'company_id' => $deletedProduct['company_id'],
                'sku' => $deletedProduct['sku'],
                'barcode' => $deletedProduct['barcode'],
                'deleted_by' => $user['id']
            ]);
        } catch (\Exception $e) {
            // Non-critical: don't block deletion if logging fails
        }
    }

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
