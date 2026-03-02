<?php
/**
 * Playlist Detail API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');
$playlistOrderColumn = $db->columnExists('playlist_items', 'sort_order') ? 'sort_order' : 'order_index';
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.template_id = t.id';

$playlist = $db->fetch(
    "SELECT p.*, t.name as template_name, t.preview_image as template_preview
     FROM playlists p
     $templateJoin
     WHERE p.id = ? AND p.company_id = ?",
    [$id, $companyId]
);
if (!$playlist) {
    Response::notFound('Oynatma listesi bulunamadı');
}

// Calculate base path for URLs
$basePath = '';
if (defined('BASE_PATH')) {
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
    $fsBasePath = str_replace('\\', '/', BASE_PATH);
    if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
        $basePath = substr($fsBasePath, strlen($docRoot));
        $basePath = rtrim($basePath, '/');
    }
}

// Parse items JSON and enrich with media/template info
$items = [];
$itemsJson = $playlist['items'] ?? '[]';
$rawItems = is_string($itemsJson) ? json_decode($itemsJson, true) : $itemsJson;

if (!is_array($rawItems) || empty($rawItems)) {
    $normalizedItems = $db->fetchAll(
        "SELECT id, media_id, content_type, content_url, content_data, duration, {$playlistOrderColumn} as order_index
         FROM playlist_items
         WHERE playlist_id = ?
         ORDER BY {$playlistOrderColumn} ASC",
        [$id]
    );

    $rawItems = [];
    foreach ($normalizedItems as $normalizedItem) {
        $rawItems[] = [
            'id' => $normalizedItem['id'],
            'media_id' => $normalizedItem['media_id'] ?? null,
            'type' => $normalizedItem['content_type'] ?? null,
            'url' => $normalizedItem['content_url'] ?? '',
            'duration' => $normalizedItem['duration'] ?? null,
            'order' => $normalizedItem['order_index'] ?? 0,
        ];
    }
}

if (is_array($rawItems)) {
    foreach ($rawItems as $item) {
        $mediaId = $item['media_id'] ?? null;
        $templateId = $item['template_id'] ?? null;
        $itemType = $item['type'] ?? null;

        // Handle template items
        if ($templateId || $itemType === 'template') {
            $template = $db->fetch("SELECT id, name, preview_image, type, width, height FROM templates WHERE id = ?", [$templateId]);
            if ($template) {
                // Build preview URL
                $previewPath = $template['preview_image'];
                $url = '';
                if ($previewPath) {
                    // Data URI (base64) - return as-is
                    if (strpos($previewPath, 'data:') === 0) {
                        $url = $previewPath;
                    }
                    // Already a full URL
                    elseif (strpos($previewPath, 'http://') === 0 || strpos($previewPath, 'https://') === 0) {
                        $url = $previewPath;
                    }
                    // Windows absolute path
                    elseif (preg_match('/^[A-Za-z]:/', $previewPath)) {
                        $url = $basePath . '/api/media/serve.php?path=' . urlencode($previewPath);
                    }
                    // Storage path
                    elseif (strpos($previewPath, 'storage/') === 0) {
                        $url = $basePath . '/' . ltrim($previewPath, '/');
                    }
                    // Relative path
                    else {
                        $url = $basePath . '/storage/' . ltrim($previewPath, '/');
                    }
                }

                $items[] = [
                    'id' => $item['id'] ?? $template['id'],
                    'template_id' => $template['id'],
                    'name' => $template['name'],
                    'url' => $url,
                    'type' => 'template',
                    'template_type' => $template['type'],
                    'width' => $template['width'],
                    'height' => $template['height'],
                    'duration' => $item['duration'] ?? null,
                    'loop' => $item['loop'] ?? 0,
                    'order' => $item['order'] ?? 0,
                    'muted' => isset($item['muted']) ? (bool)$item['muted'] : null
                ];
            }
        }
        // Handle stream items (HLS m3u8, RTSP, etc.)
        elseif ($itemType === 'stream') {
            $items[] = [
                'id' => $item['id'] ?? uniqid('stream_'),
                'name' => $item['name'] ?? 'Stream',
                'url' => $item['url'] ?? '',
                'type' => 'stream',
                'duration' => $item['duration'] ?? null,
                'loop' => $item['loop'] ?? 0,
                'order' => $item['order'] ?? 0,
                'muted' => isset($item['muted']) ? (bool)$item['muted'] : true
            ];
        }
        // Handle html/webpage items (external URLs)
        elseif ($itemType === 'html' || $itemType === 'webpage' || $itemType === 'url') {
            $items[] = [
                'id' => $item['id'] ?? uniqid('web_'),
                'name' => $item['name'] ?? 'Web Sayfası',
                'url' => $item['url'] ?? '',
                'type' => 'html',
                'duration' => $item['duration'] ?? null,
                'loop' => $item['loop'] ?? 0,
                'order' => $item['order'] ?? 0,
                'muted' => isset($item['muted']) ? (bool)$item['muted'] : null
            ];
        }
        // Handle media items
        elseif ($mediaId) {
            $media = $db->fetch("SELECT id, name, file_path, file_type, mime_type FROM media WHERE id = ?", [$mediaId]);
            if ($media) {
                // Build proper URL based on file_path
                $filePath = $media['file_path'];
                if (preg_match('/^[A-Za-z]:/', $filePath)) {
                    // Absolute Windows path - use serve.php proxy
                    $url = $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
                } elseif (strpos($filePath, 'storage/') === 0) {
                    // Already has storage prefix
                    $url = $basePath . '/' . ltrim($filePath, '/');
                } else {
                    // Relative path (media/... or other) - serve from storage
                    $url = $basePath . '/storage/' . ltrim($filePath, '/');
                }

                // Determine content type from file_type or mime_type
                $contentType = $media['file_type'] ?? '';
                if (empty($contentType) || $contentType === 'unknown') {
                    $mimeType = $media['mime_type'] ?? '';
                    if (strpos($mimeType, 'image/') === 0) {
                        $contentType = 'image';
                    } elseif (strpos($mimeType, 'video/') === 0) {
                        $contentType = 'video';
                    }
                }

                $items[] = [
                    'id' => $item['id'] ?? $media['id'],
                    'media_id' => $media['id'],
                    'name' => $media['name'],
                    'url' => $url,
                    'type' => $contentType,
                    'mime_type' => $media['mime_type'],
                    'duration' => $item['duration'] ?? null,
                    'loop' => $item['loop'] ?? 0,
                    'order' => $item['order'] ?? 0,
                    // ✅ Video ses kontrolü - muted alanını ekle
                    'muted' => isset($item['muted']) ? (bool)$item['muted'] : ($contentType === 'video' ? true : null)
                ];
            }
        }
    }
}

$playlist['items'] = $items;

// Get assigned devices for this playlist
$assignedDevices = $db->fetchAll(
    "SELECT dca.device_id, d.name as device_name, d.ip_address, dca.created_at as assigned_at
     FROM device_content_assignments dca
     JOIN devices d ON dca.device_id = d.id
     WHERE dca.content_id = ? AND dca.content_type = 'playlist' AND dca.status = 'active'
     ORDER BY dca.created_at DESC",
    [$id]
);

$playlist['assigned_devices'] = $assignedDevices;
$playlist['assigned_device_id'] = !empty($assignedDevices) ? $assignedDevices[0]['device_id'] : null;

Response::success($playlist);
