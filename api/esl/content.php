<?php
/**
 * ESL Device Content Synchronization API
 *
 * GET /api/esl/content
 * Device Auth required: Authorization: Device <token>
 *
 * Query Parameters:
 * - since: ISO timestamp - only return content updated after this time
 * - type: Filter by content type (template, product, playlist, image)
 * - full: If "true", return full content including rendered images
 *
 * Response:
 * - version: Current content version timestamp
 * - items: Array of content items
 * - totalCount: Total number of items
 * - hasMore: Whether there's more content to fetch
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device not authenticated');
}

$deviceId = $device['id'] ?? $device['device_id'];
$companyId = $device['company_id'];

// Parse query parameters
$since = $request->query('since');
$contentType = $request->query('type');
$fullContent = $request->query('full') === 'true';
$page = max(1, (int)$request->query('page', 1));
$limit = min(100, max(1, (int)$request->query('limit', 50)));
$offset = ($page - 1) * $limit;
$templateJoin = $db->isPostgres()
    ? "LEFT JOIN templates t ON dca.content_type = 'template' AND CAST(dca.content_id AS TEXT) = CAST(t.id AS TEXT)"
    : "LEFT JOIN templates t ON dca.content_type = 'template' AND dca.content_id = t.id";

// Build query for content assignments
$where = ["dca.device_id = ?", "dca.status = 'active'"];
$params = [$deviceId];

// Filter by update time if 'since' provided
if ($since) {
    $sinceTime = date('Y-m-d H:i:s', strtotime($since));
    $where[] = "dca.updated_at > ?";
    $params[] = $sinceTime;
}

// Filter by content type if provided
if ($contentType) {
    $where[] = "dca.content_type = ?";
    $params[] = $contentType;
}

// Filter by validity
$where[] = "(dca.valid_from IS NULL OR dca.valid_from <= CURRENT_TIMESTAMP)";
$where[] = "(dca.valid_until IS NULL OR dca.valid_until >= CURRENT_TIMESTAMP)";

$whereClause = implode(' AND ', $where);

// Get total count
$totalCount = $db->fetchColumn(
    "SELECT COUNT(*) FROM device_content_assignments dca WHERE $whereClause",
    $params
);

// Get content assignments
$assignments = $db->fetchAll(
    "SELECT dca.*, p.name as product_name, p.sku, p.barcode, p.current_price, p.previous_price,
            p.unit, p.origin, p.production_type, p.image_url as product_image,
            t.name as template_name, t.content as template_content, t.width as template_width, t.height as template_height
     FROM device_content_assignments dca
     LEFT JOIN products p ON dca.product_id = p.id
     $templateJoin
     WHERE $whereClause
     ORDER BY dca.priority DESC, dca.updated_at DESC
     LIMIT ? OFFSET ?",
    array_merge($params, [$limit, $offset])
);

// Process and format items
$items = [];
foreach ($assignments as $assignment) {
    $item = [
        'id' => $assignment['id'],
        'contentType' => $assignment['content_type'],
        'contentId' => $assignment['content_id'],
        'priority' => (int)$assignment['priority'],
        'version' => (int)$assignment['version'],
        'updatedAt' => $assignment['updated_at'],
        'validFrom' => $assignment['valid_from'],
        'validUntil' => $assignment['valid_until']
    ];

    // Add product data if linked
    if ($assignment['product_id']) {
        $item['product'] = [
            'id' => $assignment['product_id'],
            'name' => $assignment['product_name'],
            'sku' => $assignment['sku'],
            'barcode' => $assignment['barcode'],
            'currentPrice' => $assignment['current_price'],
            'previousPrice' => $assignment['previous_price'],
            'unit' => $assignment['unit'],
            'origin' => $assignment['origin'],
            'productionType' => $assignment['production_type'],
            'imageUrl' => $assignment['product_image']
        ];
    }

    // Add template data if content type is template
    if ($assignment['content_type'] === 'template' && $assignment['template_content']) {
        $item['template'] = [
            'id' => $assignment['content_id'],
            'name' => $assignment['template_name'],
            'width' => (int)$assignment['template_width'],
            'height' => (int)$assignment['template_height']
        ];

        if ($fullContent) {
            $item['template']['content'] = json_decode($assignment['template_content'], true);
        }
    }

    // If content type is image, get media details
    if ($assignment['content_type'] === 'image') {
        $media = $db->fetch(
            "SELECT id, filename, path, mime_type, width, height FROM media WHERE id = ?",
            [$assignment['content_id']]
        );

        if ($media) {
            $item['image'] = [
                'id' => $media['id'],
                'filename' => $media['filename'],
                'path' => $media['path'],
                'mimeType' => $media['mime_type'],
                'width' => (int)$media['width'],
                'height' => (int)$media['height']
            ];
        }
    }

    // If content type is playlist, get playlist details
    if ($assignment['content_type'] === 'playlist') {
        $playlist = $db->fetch(
            "SELECT id, name, description FROM playlists WHERE id = ?",
            [$assignment['content_id']]
        );

        if ($playlist && $fullContent) {
            // Get playlist items
            $playlistItems = $db->fetchAll(
                "SELECT pi.*, m.filename, m.path, m.mime_type
                 FROM playlist_items pi
                 LEFT JOIN media m ON pi.media_id = m.id
                 WHERE pi.playlist_id = ?
                 ORDER BY pi.sort_order ASC",
                [$playlist['id']]
            );

            $item['playlist'] = [
                'id' => $playlist['id'],
                'name' => $playlist['name'],
                'items' => $playlistItems
            ];
        }
    }

    $items[] = $item;
}

// Get the latest version timestamp
$latestVersion = $db->fetchColumn(
    "SELECT MAX(updated_at) FROM device_content_assignments WHERE device_id = ? AND status = 'active'",
    [$deviceId]
);

// Mark items as synced (update synced_at)
if (!empty($items)) {
    $itemIds = array_column($items, 'id');
    $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
    $db->query(
        "UPDATE device_content_assignments SET synced_at = CURRENT_TIMESTAMP WHERE id IN ($placeholders)",
        $itemIds
    );
}

Response::success([
    'version' => $latestVersion ?? date('Y-m-d H:i:s'),
    'items' => $items,
    'totalCount' => (int)$totalCount,
    'page' => $page,
    'limit' => $limit,
    'hasMore' => ($offset + count($items)) < $totalCount
]);

