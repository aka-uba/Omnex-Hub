<?php
/**
 * PWA Player Initialization API
 *
 * GET /api/player/init
 * Header: X-DEVICE-TOKEN: <token>
 *
 * Cihaza atanmis playlist ve template bilgisini dondur
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$playlistOrderColumn = $db->columnExists('playlist_items', 'sort_order') ? 'sort_order' : 'order_index';
$assignmentPlaylistJoin = "JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)";
$schedulePlaylistJoin = "LEFT JOIN playlists p ON CAST(s.playlist_id AS TEXT) = CAST(p.id AS TEXT)";

function playerBuildMediaUrl(string $filePath, string $basePath): ?string
{
    if ($filePath === '') {
        return null;
    }

    if (preg_match('/^https?:\/\//i', $filePath)) {
        return $filePath;
    }

    if (preg_match('/^[A-Za-z]:/', $filePath)) {
        return $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
    }

    if (strpos($filePath, 'storage/') === 0) {
        return $basePath . '/' . ltrim($filePath, '/');
    }

    return $basePath . '/storage/' . ltrim($filePath, '/');
}

function playerBuildVariantPlaylistUrl(?string $playlistPath, string $basePath): ?string
{
    if (!$playlistPath) {
        return null;
    }

    $normalized = str_replace('\\', '/', $playlistPath);
    if (preg_match('/^https?:\/\//i', $normalized)) {
        return $normalized;
    }

    if (strpos($normalized, 'storage/') === 0) {
        return $basePath . '/' . ltrim($normalized, '/');
    }

    if (defined('BASE_PATH')) {
        $basePathFs = str_replace('\\', '/', rtrim(BASE_PATH, '/\\'));
        if (strpos($normalized, $basePathFs . '/') === 0) {
            $relative = ltrim(substr($normalized, strlen($basePathFs)), '/');
            return $basePath . '/' . $relative;
        }
    }

    return null;
}

function playerExtractHeight($value): ?int
{
    if ($value === null) {
        return null;
    }

    $raw = trim((string)$value);
    if ($raw === '') {
        return null;
    }

    if (preg_match('/(\d{3,4})\s*x\s*(\d{3,4})/i', $raw, $matches)) {
        return max((int)$matches[1], (int)$matches[2]);
    }

    if (preg_match('/(\d{3,4})\s*p/i', $raw, $matches)) {
        return (int)$matches[1];
    }

    if (preg_match('/^\d{3,4}$/', $raw)) {
        return (int)$raw;
    }

    return null;
}

function playerResolveDeviceMaxHeight(array $deviceInfo): ?int
{
    $candidates = [];
    $rawProfile = $deviceInfo['device_profile'] ?? null;
    $deviceProfile = null;

    if (is_string($rawProfile) && $rawProfile !== '') {
        $decoded = json_decode($rawProfile, true);
        if (is_array($decoded)) {
            $deviceProfile = $decoded;
        }
    } elseif (is_array($rawProfile)) {
        $deviceProfile = $rawProfile;
    }

    if (is_array($deviceProfile)) {
        foreach (['max_res', 'max_resolution', 'resolution', 'max_profile', 'max_height'] as $key) {
            if (!empty($deviceProfile[$key])) {
                $height = playerExtractHeight($deviceProfile[$key]);
                if ($height !== null) {
                    $candidates[] = $height;
                }
            }
        }
    }

    $screenW = (int)($deviceInfo['screen_width'] ?? 0);
    $screenH = (int)($deviceInfo['screen_height'] ?? 0);
    if ($screenW > 0 || $screenH > 0) {
        $candidates[] = max($screenW, $screenH);
    }

    if (empty($candidates)) {
        return null;
    }

    return max($candidates);
}

function playerVariantHeight(array $variant): int
{
    $profileName = (string)($variant['profile'] ?? '');
    $profileDef = HlsTranscoder::PROFILES[$profileName] ?? null;
    if (is_array($profileDef) && !empty($profileDef['height'])) {
        return (int)$profileDef['height'];
    }

    $height = playerExtractHeight($variant['resolution'] ?? $profileName);
    return $height ?? 0;
}

function playerSelectVariantForDevice(array $variants, ?int $deviceMaxHeight): ?array
{
    if (empty($variants)) {
        return null;
    }

    usort($variants, static function ($left, $right) {
        $leftBitrate = (int)($left['bitrate'] ?? 0);
        $rightBitrate = (int)($right['bitrate'] ?? 0);
        if ($leftBitrate === $rightBitrate) {
            return strcmp((string)($left['profile'] ?? ''), (string)($right['profile'] ?? ''));
        }
        return $leftBitrate <=> $rightBitrate;
    });

    if ($deviceMaxHeight !== null) {
        $bestVariant = null;
        $bestHeight = 0;
        foreach ($variants as $variant) {
            $height = playerVariantHeight($variant);
            if ($height > 0 && $height <= $deviceMaxHeight && $height >= $bestHeight) {
                $bestHeight = $height;
                $bestVariant = $variant;
            }
        }
        if ($bestVariant) {
            return $bestVariant;
        }

        return $variants[0];
    }

    $defaultProfile = defined('STREAM_DEFAULT_PROFILE') ? STREAM_DEFAULT_PROFILE : '720p';
    foreach ($variants as $variant) {
        if (($variant['profile'] ?? '') === $defaultProfile) {
            return $variant;
        }
    }

    return $variants[count($variants) - 1];
}

function playerResolveMediaPlayback(array $item, array $deviceInfo, ?string $companyId, string $basePath, TranscodeQueueService $transcodeService, ?int $deviceMaxHeight): array
{
    $fallbackUrl = playerBuildMediaUrl((string)($item['media_path'] ?? ''), $basePath);
    $contentType = (string)($item['media_type'] ?? '');
    $mimeType = (string)($item['mime_type'] ?? '');
    $isVideo = $contentType === 'video' || strpos($mimeType, 'video/') === 0;
    $mediaId = (string)($item['media_id'] ?? '');

    if (!$isVideo || $mediaId === '') {
        return [
            'url' => $fallbackUrl ?? '',
            'profile' => null,
        ];
    }

    $variants = $transcodeService->getReadyVariants($mediaId);
    if (empty($variants)) {
        if (!empty($companyId)) {
            try {
                $transcodeService->enqueue($mediaId, $companyId, null);
            } catch (\Throwable $e) {
                error_log("[player init] auto enqueue skipped for media {$mediaId}: " . $e->getMessage());
            }
        }

        return [
            'url' => $fallbackUrl ?? '',
            'profile' => null,
        ];
    }

    $selectedVariant = playerSelectVariantForDevice($variants, $deviceMaxHeight);
    if (!$selectedVariant) {
        return [
            'url' => $fallbackUrl ?? '',
            'profile' => null,
        ];
    }

    $variantUrl = playerBuildVariantPlaylistUrl($selectedVariant['playlist_path'] ?? null, $basePath);
    if (!$variantUrl) {
        return [
            'url' => $fallbackUrl ?? '',
            'profile' => null,
        ];
    }

    return [
        'url' => $variantUrl,
        'profile' => $selectedVariant['profile'] ?? null,
    ];
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

// Get authenticated device
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$deviceId = DeviceAuthMiddleware::deviceId();
$companyId = DeviceAuthMiddleware::companyId();

// Get full device info
$deviceInfo = $db->fetch(
    "SELECT d.*, g.name as group_name, g.store_name, g.store_code
     FROM devices d
     LEFT JOIN device_groups g ON d.group_id = g.id
     WHERE d.id = ?",
    [$deviceId]
);

if (!$deviceInfo) {
    Response::notFound('Device not found');
}

// Update device status to online
$db->update(
    'devices',
    [
        'status' => 'online',
        'last_online' => date('Y-m-d H:i:s'),
        'last_seen' => date('Y-m-d H:i:s')
    ],
    'id = ?',
    [$deviceId]
);

// Get current template
$template = null;
if ($deviceInfo['current_template_id']) {
    $template = $db->fetch(
        "SELECT id, name, type, width, height, orientation, thumbnail, version
         FROM templates WHERE id = ?",
        [$deviceInfo['current_template_id']]
    );
}

// Get active playlist for this device
$playlist = null;
$playlistItems = [];
$transcodeService = new TranscodeQueueService();
$deviceMaxHeight = playerResolveDeviceMaxHeight($deviceInfo);

// FIRST: Check device_content_assignments table for direct playlist assignment
$contentAssignment = $db->fetch(
    "SELECT dca.content_id, p.id as playlist_id, p.name as playlist_name, p.*
     FROM device_content_assignments dca
     $assignmentPlaylistJoin
     WHERE dca.device_id = ?
       AND dca.content_type = 'playlist'
       AND dca.status = 'active'
     ORDER BY dca.created_at DESC
     LIMIT 1",
    [$deviceId]
);

if ($contentAssignment) {
    $playlist = $contentAssignment;
}

// If no direct assignment, check schedules table
if (!$playlist) {
    $activeSchedule = $db->fetch(
        "SELECT s.*, p.id as playlist_id, p.name as playlist_name
         FROM schedules s
         JOIN schedule_devices sd ON s.id = sd.schedule_id
         $schedulePlaylistJoin
         WHERE sd.device_id = ?
           AND s.status = 'active'
           AND (s.start_date IS NULL OR s.start_date <= now())
           AND (s.end_date IS NULL OR s.end_date >= now())
           AND (s.start_time IS NULL OR s.start_time::time <= CURRENT_TIME)
           AND (s.end_time IS NULL OR s.end_time::time >= CURRENT_TIME)
         ORDER BY s.priority DESC
         LIMIT 1",
        [$deviceId]
    );

    if ($activeSchedule && $activeSchedule['playlist_id']) {
        $playlist = $db->fetch(
            "SELECT * FROM playlists WHERE id = ?",
            [$activeSchedule['playlist_id']]
        );
    }
}

// If no schedule-based playlist, check device group
// Note: group-based schedule lookup requires schedule_devices join through group members
if (!$playlist && $deviceInfo['group_id']) {
    $groupDeviceSchedule = $db->fetch(
        "SELECT s.*, p.id as playlist_id
         FROM schedules s
         JOIN schedule_devices sd ON s.id = sd.schedule_id
         JOIN devices gd ON sd.device_id = gd.id AND gd.group_id = ?
         $schedulePlaylistJoin
         WHERE s.status = 'active'
           AND (s.start_date IS NULL OR s.start_date <= now())
           AND (s.end_date IS NULL OR s.end_date >= now())
         ORDER BY s.priority DESC
         LIMIT 1",
        [$deviceInfo['group_id']]
    );

    if ($groupDeviceSchedule && $groupDeviceSchedule['playlist_id']) {
        $playlist = $db->fetch(
            "SELECT * FROM playlists WHERE id = ?",
            [$groupDeviceSchedule['playlist_id']]
        );
    }
}

// Get playlist items - try from playlist_items table first, then from items JSON
if ($playlist) {
    // Try playlist_items table
    $playlistItems = $db->fetchAll(
        "SELECT pi.*, pi.{$playlistOrderColumn} as order_index, m.name as media_name, m.file_path as media_path, m.file_type as media_type,
                m.mime_type, m.file_size as media_size
         FROM playlist_items pi
         LEFT JOIN media m ON CAST(pi.media_id AS TEXT) = CAST(m.id AS TEXT)
         WHERE pi.playlist_id = ?
         ORDER BY pi.{$playlistOrderColumn} ASC",
        [$playlist['id']]
    );

    // If playlist_items table is empty, parse the items JSON from playlist
    if (empty($playlistItems) && !empty($playlist['items'])) {
        $itemsJson = $playlist['items'];
        $rawItems = is_string($itemsJson) ? json_decode($itemsJson, true) : $itemsJson;

        if (is_array($rawItems)) {
            foreach ($rawItems as $item) {
                $mediaId = $item['media_id'] ?? null;
                $templateId = $item['template_id'] ?? null;
                $itemType = $item['type'] ?? null;

                // Handle template items
                if ($templateId || $itemType === 'template') {
                    $playlistItems[] = [
                        'id' => $item['id'] ?? $templateId,
                        'template_id' => $templateId,
                        'content_type' => 'template',
                        'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                        'loop' => $item['loop'] ?? 0,
                        'order_index' => $item['order'] ?? 0,
                        'muted' => $item['muted'] ?? null
                    ];
                }
                // Handle html/webpage items (external URLs)
                elseif ($itemType === 'html' || $itemType === 'webpage') {
                    $playlistItems[] = [
                        'id' => $item['id'] ?? uniqid('web_'),
                        'content_type' => 'html',
                        'name' => $item['name'] ?? 'Web Sayfası',
                        'url' => $item['url'] ?? '',
                        'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                        'loop' => $item['loop'] ?? 0,
                        'order_index' => $item['order'] ?? 0,
                        'muted' => $item['muted'] ?? null
                    ];
                }
                // Handle media items
                elseif ($mediaId) {
                    $media = $db->fetch(
                        "SELECT id, name, file_path, file_type, mime_type, file_size FROM media WHERE id = ?",
                        [$mediaId]
                    );
                    if ($media) {
                        $playlistItems[] = [
                            'id' => $item['id'] ?? $media['id'],
                            'media_id' => $media['id'],
                            'media_name' => $media['name'],
                            'media_path' => $media['file_path'],
                            'media_type' => $media['file_type'],
                            'mime_type' => $media['mime_type'],
                            'media_size' => $media['file_size'],
                            'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                            'loop' => $item['loop'] ?? 0,
                            'order_index' => $item['order'] ?? 0,
                            'muted' => $item['muted'] ?? null  // ✅ Video ses kontrolü
                        ];
                    }
                }
            }
        }
    }

    // Add full URL to media items (skip template items - they're handled separately)
    $resolvedMediaCache = [];
    foreach ($playlistItems as &$item) {
        if (!empty($item['media_path'])) {
            $mediaId = (string)($item['media_id'] ?? '');
            if ($mediaId !== '' && isset($resolvedMediaCache[$mediaId])) {
                $item['media_url'] = $resolvedMediaCache[$mediaId]['url'];
                if (!empty($resolvedMediaCache[$mediaId]['profile'])) {
                    $item['stream_profile'] = $resolvedMediaCache[$mediaId]['profile'];
                }
            } else {
                $resolved = playerResolveMediaPlayback(
                    $item,
                    $deviceInfo,
                    $companyId,
                    $basePath,
                    $transcodeService,
                    $deviceMaxHeight
                );
                $item['media_url'] = $resolved['url'];
                if (!empty($resolved['profile'])) {
                    $item['stream_profile'] = $resolved['profile'];
                }
                if ($mediaId !== '') {
                    $resolvedMediaCache[$mediaId] = $resolved;
                }
            }
        }
    }
    unset($item); // CRITICAL: foreach referans (&$item) sonrası unset gerekli!
}

// Calculate rotation/refresh interval
$rotation = 45; // Default 45 seconds
if ($playlist && isset($playlist['settings'])) {
    $settings = json_decode($playlist['settings'], true);
    if ($settings && isset($settings['rotation'])) {
        $rotation = (int) $settings['rotation'];
    }
}

// Transform playlist items to player-expected format
$transformedItems = [];
foreach ($playlistItems as $item) {
    // Check if this is a template item (from items JSON)
    $isTemplate = ($item['content_type'] ?? '') === 'template' || !empty($item['template_id']);

    if ($isTemplate && !empty($item['template_id'])) {
        // Get template info
        $templateInfo = $db->fetch(
            "SELECT id, name, preview_image, type, width, height, design_data FROM templates WHERE id = ?",
            [$item['template_id']]
        );

        if ($templateInfo) {
            $previewUrl = '';
            if ($templateInfo['preview_image']) {
                $previewPath = $templateInfo['preview_image'];

                // Data URI (base64) - return as-is
                if (strpos($previewPath, 'data:') === 0) {
                    $previewUrl = $previewPath;
                }
                // Already a full URL
                elseif (strpos($previewPath, 'http://') === 0 || strpos($previewPath, 'https://') === 0) {
                    $previewUrl = $previewPath;
                }
                // Windows absolute path
                elseif (preg_match('/^[A-Za-z]:/', $previewPath)) {
                    $previewUrl = $basePath . '/api/media/serve.php?path=' . urlencode($previewPath);
                }
                // Storage path
                elseif (strpos($previewPath, 'storage/') === 0) {
                    $previewUrl = $basePath . '/' . ltrim($previewPath, '/');
                }
                // Relative path
                else {
                    $previewUrl = $basePath . '/storage/' . ltrim($previewPath, '/');
                }
            }

            $transformedItems[] = [
                'id' => $item['id'] ?? $templateInfo['id'],
                'template_id' => $templateInfo['id'],
                'name' => $templateInfo['name'],
                'type' => 'template',
                'url' => $previewUrl,
                'template_type' => $templateInfo['type'],
                'width' => (int) $templateInfo['width'],
                'height' => (int) $templateInfo['height'],
                'duration' => isset($item['duration']) ? (int) $item['duration'] : null,
                'loop' => (int) ($item['loop'] ?? 0),
                'order' => (int) ($item['sort_order'] ?? $item['order_index'] ?? 0),
                // ✅ CRITICAL FIX: muted INTEGER olarak döndür (0/1), boolean değil
                'muted' => isset($item['muted']) ? (int)$item['muted'] : null
            ];
        }
    } elseif (($item['content_type'] ?? '') === 'html') {
        // HTML/webpage item (external URL in iframe)
        $transformedItems[] = [
            'id' => $item['id'],
            'name' => $item['name'] ?? 'Web Sayfası',
            'type' => 'html',
            'url' => $item['url'] ?? '',
            'duration' => isset($item['duration']) ? (int) $item['duration'] : null,
            'loop' => (int) ($item['loop'] ?? 0),
            'order' => (int) ($item['sort_order'] ?? $item['order_index'] ?? 0),
            // ✅ CRITICAL FIX: muted INTEGER olarak döndür (0/1), boolean değil
            'muted' => isset($item['muted']) ? (int)$item['muted'] : null
        ];
    } else {
        // Regular media item
        // Determine content type from media_type or mime_type
        $contentType = $item['media_type'] ?? '';
        if (empty($contentType) || $contentType === 'unknown') {
            $mimeType = $item['mime_type'] ?? '';
            if (strpos($mimeType, 'image/') === 0) {
                $contentType = 'image';
            } elseif (strpos($mimeType, 'video/') === 0) {
                $contentType = 'video';
            } else {
                $contentType = 'image'; // default
            }
        }

        $transformedItems[] = [
            'id' => $item['id'] ?? $item['media_id'],
            'media_id' => $item['media_id'] ?? null,
            'name' => $item['media_name'] ?? 'Unnamed',
            'type' => $contentType,
            'url' => $item['media_url'] ?? '',
            'mime_type' => $item['mime_type'] ?? '',
            'duration' => isset($item['duration']) ? (int) $item['duration'] : null,
            'loop' => (int) ($item['loop'] ?? 0),
            'order' => (int) ($item['sort_order'] ?? $item['order_index'] ?? 0),
            // ✅ CRITICAL FIX: muted INTEGER olarak döndür (0/1), boolean değil - video için varsayılan 1
            'muted' => isset($item['muted']) ? (int)$item['muted'] : ($contentType === 'video' ? 1 : null)
        ];
    }
}

// Build response
$response = [
    'status' => 'ok',
    'device' => [
        'id' => $deviceInfo['id'],
        'name' => $deviceInfo['name'],
        'type' => $deviceInfo['type'],
        'orientation' => $deviceInfo['orientation'],
        'screenWidth' => $deviceInfo['screen_width'],
        'screenHeight' => $deviceInfo['screen_height'],
        'group' => $deviceInfo['group_name'],
        'store' => $deviceInfo['store_name'],
        'storeCode' => $deviceInfo['store_code']
    ],
    'playlist' => $playlist ? [
        'id' => $playlist['id'],
        'name' => $playlist['name'],
        'description' => $playlist['description'] ?? '',
        'orientation' => $playlist['orientation'] ?? 'landscape',
        'layout_type' => $playlist['layout_type'] ?? 'full',
        'transition' => $playlist['transition'] ?? 'fade',
        'transition_duration' => (int) ($playlist['transition_duration'] ?? 500),
        'default_duration' => (int) ($playlist['default_duration'] ?? 10),
        'items' => $transformedItems
    ] : null,
    'template' => $template ? [
        'id' => $template['id'],
        'name' => $template['name'],
        'type' => $template['type'],
        'orientation' => $template['orientation'],
        'version' => $template['version'] ?? 1
    ] : null,
    'rotation' => $rotation,
    'serverTime' => date('Y-m-d H:i:s'),
    'timezone' => date_default_timezone_get()
];

// Log initialization
Logger::info('PWA player initialized', [
    'device_id' => $deviceId,
    'device_name' => $deviceInfo['name'],
    'playlist_id' => $playlist ? $playlist['id'] : null,
    'items_count' => count($playlistItems)
]);

Response::success($response);
