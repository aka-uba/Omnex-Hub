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

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];

$page = max(1, intval($request->get('page') ?: 1));
$limit = min(10000, max(100, intval($request->get('limit') ?: 5000)));
$offset = ($page - 1) * $limit;

if ($request->get('full')) {
    // Full sync - all active products (paginated)
    $products = $db->fetchAll(
        "SELECT * FROM products WHERE company_id = ? AND status = 'active' ORDER BY updated_at ASC LIMIT ? OFFSET ?",
        [$companyId, $limit, $offset]
    );

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

    // Delta: changed products
    $changed = $db->fetchAll(
        "SELECT * FROM products WHERE company_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT ?",
        [$companyId, $since, $limit]
    );

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
