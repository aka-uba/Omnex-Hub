<?php
/**
 * PWA Player Content API
 *
 * GET /api/player/content
 * Device Token Auth required
 *
 * Returns active playlist and content assigned to the device
 */

$db = Database::getInstance();
$playlistTemplateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.template_id = t.id';

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

// Get device from middleware
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$deviceId = $device['device_id'] ?? $device['id'];

// ✅ iOS PLAYLIST CASCADE FIX: Get full device record with status and heartbeat
$fullDevice = $db->fetch("SELECT * FROM devices WHERE id = ?", [$deviceId]);
$lastHeartbeat = $fullDevice ? strtotime($fullDevice['last_heartbeat'] ?? '1970-01-01') : 0;
$now = time();
$deviceStatus = $fullDevice['status'] ?? 'offline';

// Grace period: 5 minutes (300 seconds)
$gracePeriod = 300;
$timeSinceHeartbeat = $now - $lastHeartbeat;

// Get active content assignments for this device
$assignments = $db->fetchAll(
    "SELECT * FROM device_content_assignments
     WHERE device_id = ? AND status = 'active'
     ORDER BY created_at DESC",
    [$deviceId]
);

$content = [
    'device_id' => $deviceId,
    'device_name' => $device['name'] ?? $device['device_name'] ?? 'Unknown',
    'playlists' => [],
    'media' => [],
    'templates' => []
];

foreach ($assignments as $assignment) {
    $contentType = $assignment['content_type'];
    $contentId = $assignment['content_id'];

    switch ($contentType) {
        case 'playlist':
            $playlist = $db->fetch(
                "SELECT p.*, t.name as template_name, t.preview_image as template_preview
                 FROM playlists p
                 $playlistTemplateJoin
                 WHERE p.id = ? AND p.status = 'active'",
                [$contentId]
            );

            if ($playlist) {
                // Parse and enrich items
                $items = [];
                $itemsJson = $playlist['items'] ?? '[]';
                $rawItems = is_string($itemsJson) ? json_decode($itemsJson, true) : $itemsJson;

                if (is_array($rawItems)) {
                    foreach ($rawItems as $item) {
                        $mediaId = $item['media_id'] ?? null;
                        if ($mediaId) {
                            $media = $db->fetch(
                                "SELECT id, name, file_path, file_type, mime_type FROM media WHERE id = ?",
                                [$mediaId]
                            );
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
                                    // Default to storage prefix
                                    $url = $basePath . '/storage/' . ltrim($filePath, '/');
                                }

                                $items[] = [
                                    'id' => $media['id'],
                                    'name' => $media['name'],
                                    'url' => $url,
                                    'type' => $media['file_type'],
                                    'mime_type' => $media['mime_type'],
                                    'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                                    'order' => $item['order'] ?? 0,
                                    // ✅ CRITICAL FIX: muted INTEGER olarak döndür (0/1), boolean değil
                                    // JavaScript hash hesaplaması için tutarlılık sağla
                                    'muted' => isset($item['muted']) ? (int)$item['muted'] : ($media['file_type'] === 'video' ? 1 : null),
                                    // Per-item transition override (null = use playlist default)
                                    'transition' => $item['transition'] ?? null,
                                    'transition_duration' => isset($item['transition_duration']) ? (int)$item['transition_duration'] : null
                                ];
                            }
                        }
                    }
                }

                // Sort by order
                usort($items, fn($a, $b) => ($a['order'] ?? 0) - ($b['order'] ?? 0));

                $content['playlists'][] = [
                    'id' => $playlist['id'],
                    'name' => $playlist['name'],
                    'description' => $playlist['description'],
                    'orientation' => $playlist['orientation'] ?? 'landscape',
                    'layout_type' => $playlist['layout_type'] ?? 'full',
                    'transition' => $playlist['transition'] ?? 'fade',
                    'transition_duration' => $playlist['transition_duration'] ?? 500,
                    'default_duration' => $playlist['default_duration'] ?? 10,
                    'template_id' => $playlist['template_id'],
                    'template_name' => $playlist['template_name'],
                    'items' => $items
                ];
            }
            break;

        case 'media':
            $media = $db->fetch(
                "SELECT * FROM media WHERE id = ?",
                [$contentId]
            );
            if ($media) {
                // Build proper URL based on file_path
                $filePath = $media['file_path'];
                if (preg_match('/^[A-Za-z]:/', $filePath)) {
                    $mediaUrl = $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
                } elseif (strpos($filePath, 'storage/') === 0) {
                    $mediaUrl = $basePath . '/' . ltrim($filePath, '/');
                } else {
                    $mediaUrl = $basePath . '/storage/' . ltrim($filePath, '/');
                }

                $content['media'][] = [
                    'id' => $media['id'],
                    'name' => $media['name'],
                    'url' => $mediaUrl,
                    'type' => $media['file_type'],
                    'mime_type' => $media['mime_type']
                ];
            }
            break;

        case 'template':
            $template = $db->fetch(
                "SELECT * FROM templates WHERE id = ?",
                [$contentId]
            );
            if ($template) {
                $content['templates'][] = [
                    'id' => $template['id'],
                    'name' => $template['name'],
                    'content' => $template['content'],
                    'width' => $template['width'],
                    'height' => $template['height']
                ];
            }
            break;
    }
}

// If no assignments, check for default/fallback content
if (empty($content['playlists']) && empty($content['media'])) {
    // Get first active playlist as fallback (optional)
    $companyId = $device['company_id'];
    if ($companyId) {
        $defaultPlaylist = $db->fetch(
            "SELECT p.*, t.name as template_name
             FROM playlists p
             $playlistTemplateJoin
             WHERE p.company_id = ? AND p.status = 'active'
             ORDER BY p.created_at DESC
             LIMIT 1",
            [$companyId]
        );

        if ($defaultPlaylist) {
            $items = [];
            $rawItems = json_decode($defaultPlaylist['items'] ?? '[]', true) ?: [];

            foreach ($rawItems as $item) {
                $mediaId = $item['media_id'] ?? null;
                if ($mediaId) {
                    $media = $db->fetch("SELECT * FROM media WHERE id = ?", [$mediaId]);
                    if ($media) {
                        // Build proper URL based on file_path
                        $filePath = $media['file_path'];
                        if (preg_match('/^[A-Za-z]:/', $filePath)) {
                            $mediaUrl = $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
                        } elseif (strpos($filePath, 'storage/') === 0) {
                            $mediaUrl = $basePath . '/' . ltrim($filePath, '/');
                        } else {
                            $mediaUrl = $basePath . '/storage/' . ltrim($filePath, '/');
                        }

                        $items[] = [
                            'id' => $media['id'],
                            'name' => $media['name'],
                            'url' => $mediaUrl,
                            'type' => $media['file_type'],
                            'duration' => $item['duration'] ?? 10,
                            'order' => $item['order'] ?? 0,
                            'transition' => $item['transition'] ?? null,
                            'transition_duration' => isset($item['transition_duration']) ? (int)$item['transition_duration'] : null
                        ];
                    }
                }
            }

            $content['playlists'][] = [
                'id' => $defaultPlaylist['id'],
                'name' => $defaultPlaylist['name'],
                'description' => $defaultPlaylist['description'],
                'orientation' => $defaultPlaylist['orientation'] ?? 'landscape',
                'layout_type' => $defaultPlaylist['layout_type'] ?? 'full',
                'default_duration' => $defaultPlaylist['default_duration'] ?? 10,
                'items' => $items,
                'is_fallback' => true
            ];
        }
    }
}

// ✅ iOS PLAYLIST CASCADE FIX: Handle offline status with grace period
if ($deviceStatus === 'offline') {
    if ($timeSinceHeartbeat < $gracePeriod) {
        // Temporary offline within grace period - return cached/last known playlist
        // Device is likely iOS PWA that suspended - don't clear playlist yet
        $cachedPlaylist = $db->fetch(
            "SELECT playlist_cache FROM devices WHERE id = ?",
            [$deviceId]
        );

        if ($cachedPlaylist && !empty($cachedPlaylist['playlist_cache'])) {
            $cached = json_decode($cachedPlaylist['playlist_cache'], true);
            if ($cached) {
                Response::success($cached);
            }
        }
        // If no cache, fall through to return current content
    } else {
        // Real offline (beyond grace period) - return empty playlist for THIS device only
        $emptyContent = [
            'device_id' => $deviceId,
            'device_name' => $device['name'] ?? $device['device_name'] ?? 'Unknown',
            'playlists' => [],
            'media' => [],
            'templates' => []
        ];
        Response::success($emptyContent);
    }
}

// Cache playlist for future grace period use
$db->update('devices', [
    'playlist_cache' => json_encode($content)
], 'id = ?', [$deviceId]);

Response::success($content);
