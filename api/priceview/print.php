<?php
/**
 * PriceView Print HTML Generator
 * POST /api/priceview/print/{id}
 *
 * Body: { "product_id": "uuid" }
 * Returns: text/html - ready for Android PrintManager
 */

// Debug: if this line doesn't appear, file isn't reached
error_log('[PriceView] print.php reached, method=' . $_SERVER['REQUEST_METHOD']);

try {

require_once SERVICES_PATH . '/FabricToHtmlConverter.php';

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];

$templateId = $request->getRouteParam('id');
if (!$templateId) {
    Response::error('Template ID required', 400);
}

// Load template
$template = $db->fetch(
    "SELECT * FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system')",
    [$templateId, $companyId]
);
if (!$template) {
    Response::error('Template not found', 404);
}

// Load product
$body = $request->all();
$productId = $body['product_id'] ?? null;
if (!$productId) {
    Response::error('product_id required', 400);
}

$product = $db->fetch(
    "SELECT * FROM products WHERE id = ? AND company_id = ?",
    [$productId, $companyId]
);
if (!$product) {
    Response::error('Product not found', 404);
}

// Merge HAL kunye data if available
if (!empty($product['kunye_data'])) {
    $kunyeData = json_decode($product['kunye_data'], true);
    if ($kunyeData) {
        $product = array_merge($product, $kunyeData);
    }
}

// Create converter (same pattern as print-html.php)
try {
    $basePath = defined('BASE_PATH') ? '/' . basename(BASE_PATH) : '';
    $converter = new FabricToHtmlConverter($companyId, $basePath);

    // Convert template to HTML fragment
    $result = $converter->convertToFragment($template, [$product], ['print_mode' => true]);
} catch (Throwable $e) {
    Response::error('Converter error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine(), 500);
}

// Build full HTML page
$fragment = $result['fragment'] ?? '';
$fonts = $result['fonts'] ?? [];
$width = $result['width'] ?? intval($template['width'] ?? 800);
$height = $result['height'] ?? intval($template['height'] ?? 600);
$bg = $result['bg'] ?? '#ffffff';

// Font imports
$fontImports = '';
if (!empty($fonts)) {
    $fontFamilies = array_unique(array_values($fonts));
    $fontParams = array_map(function($f) { return urlencode($f) . ':wght@400;700'; }, $fontFamilies);
    $fontImports = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' . implode('&family=', $fontParams) . '&display=swap">';
}

$productName = htmlspecialchars($product['name'] ?? '', ENT_QUOTES, 'UTF-8');

// Output print-ready HTML
header('Content-Type: text/html; charset=UTF-8');
echo <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PriceView Print - {$productName}</title>
{$fontImports}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
@page { size: {$width}px {$height}px; margin: 0; }
@media print { body { margin: 0; padding: 0; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: {$width}px; height: {$height}px; background: {$bg}; overflow: hidden; }
.label-container { width: {$width}px; height: {$height}px; position: relative; overflow: hidden; }
</style>
</head>
<body>
<div class="label-container">
{$fragment}
</div>
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Render barcodes
    document.querySelectorAll('.barcode-container').forEach(function(el) {
        var value = el.getAttribute('data-barcode-value');
        var format = el.getAttribute('data-barcode-format') || 'CODE128';
        if (value) {
            try {
                JsBarcode(el.querySelector('svg') || el, value, {
                    format: format, displayValue: true, fontSize: 14,
                    width: 2, height: 60, margin: 0
                });
            } catch(e) { console.warn('Barcode error:', e); }
        }
    });
});
</script>
</body>
</html>
HTML;
exit;

} catch (Throwable $e) {
    Response::error('Print error: ' . $e->getMessage() . ' at ' . basename($e->getFile()) . ':' . $e->getLine(), 500);
}
