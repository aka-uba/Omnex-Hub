<?php
/**
 * PriceView Barcode Lookup
 * GET /api/priceview/products/barcode/{barcode}
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];

$barcode = $request->getRouteParam('barcode');
if (!$barcode) {
    Response::error('Barcode required', 400);
}

$product = $db->fetch(
    "SELECT * FROM products WHERE company_id = ? AND barcode = ? AND status = 'active' LIMIT 1",
    [$companyId, $barcode]
);

if (!$product) {
    // Try SKU as fallback
    $product = $db->fetch(
        "SELECT * FROM products WHERE company_id = ? AND sku = ? AND status = 'active' LIMIT 1",
        [$companyId, $barcode]
    );
}

if (!$product) {
    Response::error('Product not found', 404);
}

Response::success($product);
