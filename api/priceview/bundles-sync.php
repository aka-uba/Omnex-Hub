<?php
/**
 * PriceView Bundle Sync API
 * GET /api/priceview/bundles/sync
 *
 * Query params:
 *   full=true     - Full sync (paginated)
 *   since=ISO8601 - Delta sync (changed/deleted since timestamp)
 *   page=N        - Page number (default 1)
 *   limit=N       - Items per page (default 1000, max 5000)
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

$page = max(1, intval($request->get('page') ?: 1));
$limit = min(5000, max(100, intval($request->get('limit') ?: 1000)));
$offset = ($page - 1) * $limit;

if ($request->get('full')) {
    $bundles = $db->fetchAll(
        "SELECT * FROM bundles WHERE company_id = ? AND status = 'active' ORDER BY updated_at ASC LIMIT ? OFFSET ?",
        [$companyId, $limit, $offset]
    );
    $bundles = enrichBundlesForSync($db, $bundles, $branchId, $mediaBaseUrl);

    $total = $db->fetch(
        "SELECT COUNT(*) as cnt FROM bundles WHERE company_id = ? AND status = 'active'",
        [$companyId]
    );

    Response::success([
        'bundles' => $bundles,
        'deleted_ids' => [],
        'server_time' => date('c'),
        'total' => intval($total['cnt'] ?? 0),
        'page' => $page,
        'limit' => $limit,
        'has_more' => count($bundles) >= $limit
    ]);
} else {
    $since = $request->get('since');
    if (!$since) {
        Response::error('Parameter "since" or "full=true" required', 400);
    }

    $changed = fetchDeltaBundles($db, $companyId, $since, $limit, $branchId);
    $changed = enrichBundlesForSync($db, $changed, $branchId, $mediaBaseUrl);

    $deletedIds = [];
    if ($db->tableExists('bundle_deletions')) {
        $deletedRows = $db->fetchAll(
            "SELECT bundle_id FROM bundle_deletions WHERE company_id = ? AND deleted_at > ?",
            [$companyId, $since]
        );
        $deletedIds = array_values(array_unique(array_filter(array_column($deletedRows, 'bundle_id'))));
    }

    Response::success([
        'bundles' => $changed,
        'deleted_ids' => $deletedIds,
        'server_time' => date('c'),
        'has_more' => count($changed) >= $limit
    ]);
}

function fetchDeltaBundles(Database $db, string $companyId, string $since, int $limit, ?string $branchId): array
{
    if (empty($branchId)) {
        return $db->fetchAll(
            "SELECT * FROM bundles WHERE company_id = ? AND status = 'active' AND updated_at > ? ORDER BY updated_at ASC LIMIT ?",
            [$companyId, $since, $limit]
        );
    }

    $branchIds = collectBranchScopeIds($db, $branchId);
    $overrideChangedIds = [];
    if (!empty($branchIds)) {
        $branchPlaceholders = implode(', ', array_fill(0, count($branchIds), '?'));
        $overrideRows = $db->fetchAll(
            "SELECT DISTINCT bundle_id
             FROM bundle_branch_overrides
             WHERE branch_id IN ($branchPlaceholders)
               AND (
                    (updated_at IS NOT NULL AND updated_at > ?)
                 OR (deleted_at IS NOT NULL AND deleted_at > ?)
               )
             LIMIT ?",
            array_merge($branchIds, [$since, $since, $limit])
        );
        $overrideChangedIds = array_values(array_unique(array_filter(array_column($overrideRows, 'bundle_id'))));
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
        "SELECT * FROM bundles WHERE $where ORDER BY updated_at ASC LIMIT ?",
        $params
    );
}

function enrichBundlesForSync(Database $db, array $bundles, ?string $branchId, string $baseUrl): array
{
    if (empty($bundles)) {
        return $bundles;
    }

    $bundleIds = array_values(array_filter(array_column($bundles, 'id')));
    $itemsByBundle = [];

    if (!empty($bundleIds)) {
        $placeholders = implode(', ', array_fill(0, count($bundleIds), '?'));
        $itemRows = $db->fetchAll(
            "SELECT bi.bundle_id, bi.product_id, bi.quantity, bi.unit_price, bi.custom_price, bi.sort_order,
                    p.name as product_name, p.sku as product_sku, p.barcode as product_barcode, p.image_url as product_image_url
             FROM bundle_items bi
             LEFT JOIN products p ON p.id = bi.product_id
             WHERE bi.bundle_id IN ($placeholders)
             ORDER BY bi.bundle_id ASC, bi.sort_order ASC",
            $bundleIds
        );

        foreach ($itemRows as $row) {
            $bundleId = $row['bundle_id'] ?? null;
            if (!$bundleId) {
                continue;
            }

            $row['product_image_url'] = toAbsoluteMediaUrl($row['product_image_url'] ?? null, $baseUrl);
            $itemsByBundle[$bundleId][] = $row;
        }
    }

    foreach ($bundles as &$bundle) {
        if (!empty($branchId) && !empty($bundle['id'])) {
            $resolved = BundlePriceResolver::resolve($bundle['id'], $branchId);
            if (!empty($resolved['success']) && !empty($resolved['values'])) {
                $values = $resolved['values'];
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

        $bundle['image_url'] = toAbsoluteMediaUrl($bundle['image_url'] ?? null, $baseUrl);
        foreach (['images', 'videos'] as $field) {
            if (!empty($bundle[$field]) && is_string($bundle[$field])) {
                $decoded = json_decode($bundle[$field], true);
                if (is_array($decoded)) {
                    foreach ($decoded as &$item) {
                        if (is_string($item)) {
                            $item = toAbsoluteMediaUrl($item, $baseUrl);
                        } elseif (is_array($item)) {
                            foreach (['url', 'path', 'thumbnail', 'thumbnail_url', 'poster', 'poster_url'] as $key) {
                                if (!array_key_exists($key, $item)) {
                                    continue;
                                }
                                $item[$key] = toAbsoluteMediaUrl($item[$key], $baseUrl);
                            }
                        }
                    }
                    unset($item);
                    $bundle[$field] = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
            }
        }

        $bundle['products_json'] = json_encode(
            $itemsByBundle[$bundle['id']] ?? [],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }
    unset($bundle);

    return $bundles;
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
