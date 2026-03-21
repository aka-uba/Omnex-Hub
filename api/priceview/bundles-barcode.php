<?php
/**
 * PriceView Bundle Barcode Lookup
 * GET /api/priceview/bundles/barcode/{barcode}
 */

require_once BASE_PATH . '/services/BundlePriceResolver.php';

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

$bundle = $db->fetch(
    "SELECT * FROM bundles WHERE company_id = ? AND barcode = ? AND status = 'active' LIMIT 1",
    [$companyId, $barcode]
);

if (!$bundle) {
    // Try SKU as fallback
    $bundle = $db->fetch(
        "SELECT * FROM bundles WHERE company_id = ? AND sku = ? AND status = 'active' LIMIT 1",
        [$companyId, $barcode]
    );
}

if (!$bundle) {
    Response::error('Bundle not found', 404);
}

if (!empty($branchId) && !empty($bundle['id'])) {
    $resolvedData = BundlePriceResolver::resolve($bundle['id'], $branchId);
    if (!empty($resolvedData['success']) && !empty($resolvedData['values'])) {
        $values = $resolvedData['values'];
        if (isset($values['final_price']['value']) && $values['final_price']['value'] !== null) {
            $bundle['final_price'] = $values['final_price']['value'];
        }
        if (isset($values['previous_final_price']['value']) && $values['previous_final_price']['value'] !== null) {
            $bundle['previous_final_price'] = $values['previous_final_price']['value'];
        }
        if (isset($values['discount_percent']['value']) && $values['discount_percent']['value'] !== null) {
            $bundle['discount_percent'] = $values['discount_percent']['value'];
        }
        if (isset($values['total_price']['value']) && $values['total_price']['value'] !== null) {
            $bundle['total_price'] = $values['total_price']['value'];
        }
    }
}

$bundle['image_url'] = toAbsoluteMediaUrl($bundle['image_url'] ?? null, $mediaBaseUrl);
foreach (['images', 'videos'] as $field) {
    if (!empty($bundle[$field]) && is_string($bundle[$field])) {
        $decoded = json_decode($bundle[$field], true);
        if (is_array($decoded)) {
            foreach ($decoded as &$item) {
                if (is_string($item)) {
                    $item = toAbsoluteMediaUrl($item, $mediaBaseUrl);
                } elseif (is_array($item)) {
                    foreach (['url', 'path', 'thumbnail', 'thumbnail_url', 'poster', 'poster_url'] as $key) {
                        if (!array_key_exists($key, $item)) {
                            continue;
                        }
                        $item[$key] = toAbsoluteMediaUrl($item[$key], $mediaBaseUrl);
                    }
                }
            }
            unset($item);
            $bundle[$field] = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
}

$items = $db->fetchAll(
    "SELECT bi.bundle_id, bi.product_id, bi.quantity, bi.unit_price, bi.custom_price, bi.sort_order,
            p.name as product_name, p.sku as product_sku, p.barcode as product_barcode, p.image_url as product_image_url
     FROM bundle_items bi
     LEFT JOIN products p ON p.id = bi.product_id
     WHERE bi.bundle_id = ?
     ORDER BY bi.sort_order ASC",
    [$bundle['id']]
);

foreach ($items as &$item) {
    $item['product_image_url'] = toAbsoluteMediaUrl($item['product_image_url'] ?? null, $mediaBaseUrl);
}
unset($item);

$bundle['products_json'] = json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

Response::success($bundle);

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
