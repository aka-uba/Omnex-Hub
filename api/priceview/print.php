<?php
/**
 * PriceView Print HTML Generator
 * POST /api/priceview/print/{id}
 *
 * Body: { "product_id": "uuid" }
 * Returns: text/html - ready for Android PrintManager
 */

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

// Build server base URL for absolute media resolution
// On Docker (DocumentRoot=/var/www/html = project root) basePath should be empty.
// On XAMPP (DocumentRoot=C:\xampp\htdocs) basePath should be /market-etiket-sistemi.
// Using the full server URL as basePath ensures all media URLs are absolute and work
// regardless of where the HTML is rendered (Android WebView, print preview, etc.)
$serverProtocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$serverHost = $_SERVER['HTTP_HOST'] ?? 'localhost';

// Detect web-relative base path (e.g., '' on Docker, '/market-etiket-sistemi' on XAMPP)
$webBasePath = '';
if (defined('BASE_PATH')) {
    $docRoot = str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? '');
    $fsBasePath = str_replace('\\', '/', BASE_PATH);
    if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
        $webBasePath = rtrim(substr($fsBasePath, strlen($docRoot)), '/');
    }
}
// Build full URL basePath so all media URLs resolve to absolute URLs
$absoluteBasePath = $serverProtocol . '://' . $serverHost . $webBasePath;

// Create converter with absolute base path for reliable image resolution
try {
    $converter = new FabricToHtmlConverter($companyId, $absoluteBasePath);

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
    // Flatten fonts array (may contain nested arrays from converter)
    $fontFamilies = [];
    foreach ($fonts as $f) {
        if (is_string($f) && !empty(trim($f))) {
            $fontFamilies[] = trim($f);
        } elseif (is_array($f) && !empty($f['family'])) {
            $fontFamilies[] = trim($f['family']);
        }
    }
    $fontFamilies = array_unique($fontFamilies);
    if (!empty($fontFamilies)) {
        $fontParams = array_map(function($f) { return urlencode($f) . ':wght@400;700'; }, $fontFamilies);
        $fontImports = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' . implode('&family=', $fontParams) . '&display=swap">';
    }
}

$productName = htmlspecialchars($product['name'] ?? '', ENT_QUOTES, 'UTF-8');

// Reuse computed server URL for <base href>
$serverUrl = $serverProtocol . '://' . $serverHost . $webBasePath;

// Output print-ready HTML
header('Content-Type: text/html; charset=UTF-8');
echo <<<HTML
<!DOCTYPE html>
<html>
<head>
<base href="{$serverUrl}/">

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
    // Render barcodes - match converter output: .print-barcode SVGs with data-barcode attr
    document.querySelectorAll('.print-barcode, .barcode-container').forEach(function(el) {
        var value = el.getAttribute('data-barcode') || el.getAttribute('data-barcode-value') || '';
        if (!value) return;
        var target = el.tagName === 'SVG' ? el : (el.querySelector('svg') || el);
        var h = parseInt(el.getAttribute('data-height')) || 60;
        try {
            JsBarcode(target, value, {
                format: 'CODE128', displayValue: true, fontSize: 14,
                width: 2, height: h, margin: 0, textMargin: 2
            });
        } catch(e) {
            try { JsBarcode(target, value, { format: 'CODE128', displayValue: true }); }
            catch(e2) { console.warn('Barcode error:', value, e2); }
        }
    });

    // Replace video elements with poster frame for print (no playback in print)
    document.querySelectorAll('video').forEach(function(v) {
        var poster = v.getAttribute('poster') || v.getAttribute('data-poster');
        if (poster) {
            var img = document.createElement('img');
            img.src = poster;
            img.style.cssText = v.style.cssText;
            img.style.objectFit = 'cover';
            v.parentNode.replaceChild(img, v);
        } else {
            v.style.display = 'none';
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
