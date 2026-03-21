<?php
/**
 * PriceView Barcode Lookup
 * GET /api/priceview/products/barcode/{barcode}
 */

require_once BASE_PATH . '/services/ProductPriceResolver.php';

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];
$branchId = $device['branch_id'] ?? null;
$mediaBaseUrl = buildMediaBaseUrl();

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

if (!empty($branchId) && !empty($product['id'])) {
    $resolvedData = ProductPriceResolver::resolve(
        $product['id'],
        $branchId,
        ['price', 'campaign', 'stock', 'compliance']
    );

    if (!empty($resolvedData['success']) && !empty($resolvedData['values'])) {
        $values = $resolvedData['values'];
        if (isset($values['current_price']['value']) && $values['current_price']['value'] !== null) {
            $product['current_price'] = $values['current_price']['value'];
        }
        if (isset($values['previous_price']['value']) && $values['previous_price']['value'] !== null) {
            $product['previous_price'] = $values['previous_price']['value'];
        }
        if (isset($values['discount_percent']['value']) && $values['discount_percent']['value'] !== null) {
            $product['discount_percent'] = $values['discount_percent']['value'];
        }
        if (isset($values['campaign_text']['value']) && $values['campaign_text']['value'] !== null) {
            $product['campaign_text'] = $values['campaign_text']['value'];
        }
        if (isset($values['stock_quantity']['value']) && $values['stock_quantity']['value'] !== null) {
            $product['stock'] = $values['stock_quantity']['value'];
        }
        if (isset($values['kunye_data']['value']) && $values['kunye_data']['value'] !== null) {
            $product['kunye_data'] = $values['kunye_data']['value'];
        }
    }
}

$product = normalizeProductMediaUrls($product, $mediaBaseUrl);

Response::success($product);

function buildMediaBaseUrl(): string
{
    $serverProtocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $serverHost = $_SERVER['HTTP_HOST'] ?? 'localhost';

    $webBasePath = '';
    if (defined('BASE_PATH')) {
        $docRoot = str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? '');
        $fsBasePath = str_replace('\\', '/', BASE_PATH);
        if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
            $webBasePath = rtrim(substr($fsBasePath, strlen($docRoot)), '/');
        }
    }

    return $serverProtocol . '://' . $serverHost . $webBasePath;
}

function toAbsoluteMediaUrl(?string $url, string $baseUrl): ?string
{
    if ($url === null) return null;
    $url = trim((string)$url);
    if ($url === '') return null;

    if (preg_match('#^(https?:)?//#i', $url) || str_starts_with($url, 'data:')) {
        return $url;
    }
    if (str_starts_with($url, '/')) {
        return rtrim($baseUrl, '/') . $url;
    }
    return rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
}

function normalizeProductMediaUrls(array $product, string $baseUrl): array
{
    $product['image_url'] = toAbsoluteMediaUrl($product['image_url'] ?? null, $baseUrl);

    foreach (['images', 'videos'] as $field) {
        if (empty($product[$field]) || !is_string($product[$field])) {
            continue;
        }

        $decoded = json_decode($product[$field], true);
        if (!is_array($decoded)) {
            continue;
        }

        foreach ($decoded as &$item) {
            if (is_string($item)) {
                $item = toAbsoluteMediaUrl($item, $baseUrl);
                continue;
            }
            if (!is_array($item)) continue;

            foreach (['url', 'path', 'thumbnail', 'thumbnail_url', 'poster', 'poster_url'] as $key) {
                if (!array_key_exists($key, $item)) continue;
                $item[$key] = toAbsoluteMediaUrl($item[$key], $baseUrl);
            }
        }
        unset($item);

        $product[$field] = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    return $product;
}
