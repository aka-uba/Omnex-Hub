<?php
/**
 * PriceView Product Sync API
 * GET /api/priceview/products/sync
 *
 * Query params:
 *   full=true     - Full sync (paginated)
 *   since=ISO8601 - Delta sync (changed + deleted since timestamp)
 *   page=N        - Page number (default 1)
 *   limit=N       - Items per page (default 5000, max 10000)
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

$page = max(1, intval($request->get('page') ?: 1));
$limit = min(10000, max(100, intval($request->get('limit') ?: 5000)));
$offset = ($page - 1) * $limit;

if ($request->get('full')) {
    // Full sync - all active products (paginated)
    $products = $db->fetchAll(
        "SELECT * FROM products WHERE company_id = ? AND status = 'active' ORDER BY updated_at ASC LIMIT ? OFFSET ?",
        [$companyId, $limit, $offset]
    );
    $products = applyBranchProductOverrides($products, $branchId);
    $products = normalizeProductsMediaUrls($products, $mediaBaseUrl);

    $total = $db->fetch(
        "SELECT COUNT(*) as cnt FROM products WHERE company_id = ? AND status = 'active'",
        [$companyId]
    );

    Response::success([
        'products' => $products,
        'deleted_ids' => [],
        'server_time' => date('c'),
        'total' => intval($total['cnt'] ?? 0),
        'page' => $page,
        'limit' => $limit,
        'has_more' => count($products) >= $limit
    ]);
} else {
    $since = $request->get('since');
    if (!$since) {
        Response::error('Parameter "since" or "full=true" required', 400);
    }

    // Delta: changed products (master + branch override changes)
    $changed = fetchDeltaProducts($db, $companyId, $since, $limit, $branchId);
    $changed = applyBranchProductOverrides($changed, $branchId);
    $changed = normalizeProductsMediaUrls($changed, $mediaBaseUrl);

    // Delta: deleted products (from audit log)
    $deleted = $db->fetchAll(
        "SELECT product_id FROM product_deletions WHERE company_id = ? AND deleted_at > ?",
        [$companyId, $since]
    );

    Response::success([
        'products' => $changed,
        'deleted_ids' => array_column($deleted, 'product_id'),
        'server_time' => date('c'),
        'has_more' => count($changed) >= $limit
    ]);
}

function fetchDeltaProducts(Database $db, string $companyId, string $since, int $limit, ?string $branchId): array
{
    if (empty($branchId)) {
        return $db->fetchAll(
            "SELECT * FROM products WHERE company_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT ?",
            [$companyId, $since, $limit]
        );
    }

    $branchIds = collectBranchScopeIds($db, $branchId);
    $overrideChangedIds = [];

    if (!empty($branchIds)) {
        $branchPlaceholders = implode(', ', array_fill(0, count($branchIds), '?'));
        $overrideRows = $db->fetchAll(
            "SELECT DISTINCT product_id
             FROM product_branch_overrides
             WHERE branch_id IN ($branchPlaceholders)
               AND (
                    (updated_at IS NOT NULL AND updated_at > ?)
                 OR (deleted_at IS NOT NULL AND deleted_at > ?)
               )
             LIMIT ?",
            array_merge($branchIds, [$since, $since, $limit])
        );
        $overrideChangedIds = array_values(array_unique(array_filter(array_column($overrideRows, 'product_id'))));
    }

    $params = [$companyId, $since];
    $where = "company_id = ? AND status = 'active' AND updated_at > ?";

    if (!empty($overrideChangedIds)) {
        $idPlaceholders = implode(', ', array_fill(0, count($overrideChangedIds), '?'));
        $where = "company_id = ? AND status = 'active' AND (updated_at > ? OR id IN ($idPlaceholders))";
        $params = array_merge($params, $overrideChangedIds);
    }

    $params[] = $limit;
    return $db->fetchAll(
        "SELECT * FROM products WHERE $where ORDER BY updated_at ASC LIMIT ?",
        $params
    );
}

function applyBranchProductOverrides(array $products, ?string $branchId): array
{
    if (empty($branchId) || empty($products)) {
        return $products;
    }

    $productIds = array_values(array_filter(array_column($products, 'id')));
    if (empty($productIds)) {
        return $products;
    }

    $resolved = ProductPriceResolver::resolveMultiple(
        $productIds,
        $branchId,
        ['price', 'campaign', 'stock', 'compliance']
    );

    foreach ($products as &$product) {
        $pid = $product['id'] ?? null;
        if (!$pid || empty($resolved[$pid]['values'])) {
            continue;
        }

        $values = $resolved[$pid]['values'];
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
        if (isset($values['shelf_location']['value']) && $values['shelf_location']['value'] !== null) {
            $product['shelf_location'] = $values['shelf_location']['value'];
        }
        if (isset($values['kunye_no']['value']) && $values['kunye_no']['value'] !== null) {
            $product['kunye_no'] = $values['kunye_no']['value'];
        }
        if (isset($values['kunye_data']['value']) && $values['kunye_data']['value'] !== null) {
            $product['kunye_data'] = $values['kunye_data']['value'];
        }
    }
    unset($product);

    return $products;
}

function collectBranchScopeIds(Database $db, ?string $branchId): array
{
    if (empty($branchId)) {
        return [];
    }

    $branchIds = [$branchId];
    $branch = $db->fetch("SELECT parent_id FROM branches WHERE id = ?", [$branchId]);
    if (!empty($branch['parent_id'])) {
        $branchIds[] = $branch['parent_id'];
    }

    return array_values(array_unique(array_filter($branchIds)));
}

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
    if ($url === null) {
        return null;
    }

    $url = trim((string)$url);
    if ($url === '') {
        return null;
    }

    if (preg_match('#^(https?:)?//#i', $url) || str_starts_with($url, 'data:')) {
        return $url;
    }

    if (str_starts_with($url, '/')) {
        return rtrim($baseUrl, '/') . $url;
    }

    return rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
}

function normalizeProductsMediaUrls(array $products, string $baseUrl): array
{
    foreach ($products as &$product) {
        $product['image_url'] = toAbsoluteMediaUrl($product['image_url'] ?? null, $baseUrl);

        foreach (['images', 'videos'] as $mediaField) {
            if (empty($product[$mediaField]) || !is_string($product[$mediaField])) {
                continue;
            }

            $decoded = json_decode($product[$mediaField], true);
            if (!is_array($decoded)) {
                continue;
            }

            foreach ($decoded as &$item) {
                if (is_string($item)) {
                    $item = toAbsoluteMediaUrl($item, $baseUrl);
                    continue;
                }

                if (!is_array($item)) {
                    continue;
                }

                foreach (['url', 'path', 'thumbnail', 'thumbnail_url', 'poster', 'poster_url'] as $key) {
                    if (!array_key_exists($key, $item)) {
                        continue;
                    }
                    $item[$key] = toAbsoluteMediaUrl($item[$key], $baseUrl);
                }
            }
            unset($item);

            $product[$mediaField] = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
    unset($product);

    return $products;
}
