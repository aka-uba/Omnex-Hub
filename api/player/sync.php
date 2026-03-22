<?php
/**
 * PWA Player Content Sync API
 *
 * GET /api/player/sync?since=timestamp
 * Header: X-DEVICE-TOKEN: <token>
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

function playerBuildStableHtmlItemId(array $item): string
{
    if (!empty($item['id'])) {
        return (string)$item['id'];
    }

    $order = (string)($item['order'] ?? $item['order_index'] ?? 0);
    $url = trim((string)($item['url'] ?? ''));
    $name = trim((string)($item['name'] ?? ''));
    $seed = $order . '|' . $url . '|' . $name;

    return 'web_' . substr(hash('sha256', $seed), 0, 16);
}

function playerParseBooleanSetting($value, bool $fallback): bool
{
    if ($value === null || $value === '') {
        return $fallback;
    }

    if (is_bool($value)) {
        return $value;
    }

    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }

    return $fallback;
}

function playerNormalizeBoostLevels($value): array
{
    $raw = [];
    if (is_array($value)) {
        $raw = $value;
    } elseif (is_string($value) && trim($value) !== '') {
        $raw = explode(',', $value);
    }

    $levels = [];
    foreach ($raw as $entry) {
        $floatVal = (float)$entry;
        if ($floatVal <= 1.0 || $floatVal > 1.30) {
            continue;
        }
        $levels[] = round($floatVal, 2);
    }

    if (empty($levels)) {
        return [1.15, 1.30];
    }

    $levels = array_values(array_unique($levels));
    sort($levels, SORT_NUMERIC);
    return $levels;
}

function playerFetchDisplayTuningPolicy(Database $db, ?string $companyId): array
{
    $defaults = [
        'enabled' => true,
        'include_l0' => true,
        'boost_levels' => [1.15, 1.30]
    ];

    if (!is_string($companyId) || trim($companyId) === '') {
        return $defaults;
    }

    $row = $db->fetch(
        "SELECT data
         FROM settings
         WHERE company_id = ? AND user_id IS NULL
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1",
        [$companyId]
    );

    if (empty($row['data'])) {
        return $defaults;
    }

    $settings = json_decode((string)$row['data'], true);
    if (!is_array($settings)) {
        return $defaults;
    }

    $enabled = playerParseBooleanSetting($settings['player_display_tuning_enabled'] ?? null, $defaults['enabled']);
    $includeL0 = playerParseBooleanSetting($settings['player_display_tuning_include_l0'] ?? null, $defaults['include_l0']);
    $boostRaw = $settings['player_display_tuning_boost_levels'] ?? ($settings['player_display_tuning_levels'] ?? null);
    $boostLevels = playerNormalizeBoostLevels($boostRaw);

    return [
        'enabled' => $enabled,
        'include_l0' => $includeL0,
        'boost_levels' => $boostLevels
    ];
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
                error_log("[player sync] auto enqueue skipped for media {$mediaId}: " . $e->getMessage());
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

$device = DeviceAuthMiddleware::device();
if (!$device) {
    Response::unauthorized('Device authentication required');
}

$deviceId = DeviceAuthMiddleware::deviceId();

// Calculate base path for URL building (same approach as init.php)
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

// Parse since value (unix timestamp or ISO)
$since = $request->get('since');
$sinceDateTime = null;
if ($since) {
    if (is_numeric($since)) {
        $sinceDateTime = date('Y-m-d H:i:s', (int) $since);
    } else {
        $parsed = strtotime($since);
        if ($parsed !== false) {
            $sinceDateTime = date('Y-m-d H:i:s', $parsed);
        }
    }
}
if (!$sinceDateTime) {
    $sinceDateTime = date('Y-m-d H:i:s', strtotime('-24 hours'));
}

// Get device info and update last seen
$deviceInfo = $db->fetch("SELECT * FROM devices WHERE id = ?", [$deviceId]);
if (!$deviceInfo) {
    Response::notFound('Device not found');
}
$companyId = $deviceInfo['company_id'] ?? DeviceAuthMiddleware::companyId();
$displayTuningPolicy = playerFetchDisplayTuningPolicy($db, is_string($companyId) ? $companyId : null);
$transcodeService = new TranscodeQueueService();
$deviceMaxHeight = playerResolveDeviceMaxHeight($deviceInfo);

$db->update(
    'devices',
    ['last_seen' => date('Y-m-d H:i:s')],
    'id = ?',
    [$deviceId]
);

$scheduleChanged = false;
$assignmentChanged = false;
$playlistChanged = false;
$templateChanged = false;
$deviceChanged = ($deviceInfo['updated_at'] ?? '') > $sinceDateTime;

// 1) Try direct device playlist assignment (highest priority)
$directAssignment = $db->fetch(
    "SELECT dca.created_at as assignment_created_at, p.*
     FROM device_content_assignments dca
     $assignmentPlaylistJoin
     WHERE dca.device_id = ?
       AND dca.content_type = 'playlist'
       AND dca.status = 'active'
     ORDER BY dca.created_at DESC
     LIMIT 1",
    [$deviceId]
);

if ($directAssignment && !empty($directAssignment['assignment_created_at']) && $directAssignment['assignment_created_at'] > $sinceDateTime) {
    $assignmentChanged = true;
}

// 2) Schedule-based playlist fallback
$schedulePlaylist = null;
$activeSchedule = $db->fetch(
    "SELECT s.*, p.id as playlist_id, p.updated_at as playlist_updated_at
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

if ($activeSchedule && !empty($activeSchedule['updated_at']) && $activeSchedule['updated_at'] > $sinceDateTime) {
    $scheduleChanged = true;
}

if ($activeSchedule && !empty($activeSchedule['playlist_id'])) {
    $schedulePlaylist = $db->fetch(
        "SELECT * FROM playlists WHERE id = ?",
        [$activeSchedule['playlist_id']]
    );
}

// 3) Group schedule fallback (if direct assignment and device schedule missing)
if (!$directAssignment && !$schedulePlaylist && !empty($deviceInfo['group_id'])) {
    $groupSchedule = $db->fetch(
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

    if ($groupSchedule && !empty($groupSchedule['updated_at']) && $groupSchedule['updated_at'] > $sinceDateTime) {
        $scheduleChanged = true;
    }

    if ($groupSchedule && !empty($groupSchedule['playlist_id'])) {
        $schedulePlaylist = $db->fetch(
            "SELECT * FROM playlists WHERE id = ?",
            [$groupSchedule['playlist_id']]
        );
    }
}

$playlist = $directAssignment ?: $schedulePlaylist;

// Build playlist items using normalized table first, then JSON fallback
$playlistItems = [];
if ($playlist) {
    if (!empty($playlist['updated_at']) && $playlist['updated_at'] > $sinceDateTime) {
        $playlistChanged = true;
    }

    $playlistItems = $db->fetchAll(
        "SELECT pi.*, pi.{$playlistOrderColumn} as order_index, m.name as media_name, m.file_path as media_path, m.file_type as media_type,
                m.mime_type, m.file_size as media_size, m.updated_at as media_updated_at
         FROM playlist_items pi
         LEFT JOIN media m ON CAST(pi.media_id AS TEXT) = CAST(m.id AS TEXT)
         WHERE pi.playlist_id = ?
         ORDER BY pi.{$playlistOrderColumn} ASC",
        [$playlist['id']]
    );

    foreach ($playlistItems as $item) {
        if (
            (!empty($item['updated_at']) && $item['updated_at'] > $sinceDateTime) ||
            (!empty($item['media_updated_at']) && $item['media_updated_at'] > $sinceDateTime)
        ) {
            $playlistChanged = true;
            break;
        }
    }

    if (empty($playlistItems) && !empty($playlist['items'])) {
        $rawItems = is_string($playlist['items']) ? json_decode($playlist['items'], true) : $playlist['items'];
        if (is_array($rawItems)) {
            foreach ($rawItems as $item) {
                $mediaId = $item['media_id'] ?? null;
                $templateId = $item['template_id'] ?? null;
                $itemType = $item['type'] ?? null;

                if ($templateId || $itemType === 'template') {
                    $playlistItems[] = [
                        'id' => $item['id'] ?? $templateId,
                        'template_id' => $templateId,
                        'content_type' => 'template',
                        'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                        'loop' => $item['loop'] ?? 0,
                        'order_index' => $item['order'] ?? 0
                    ];
                    continue;
                }

                if ($itemType === 'html' || $itemType === 'webpage') {
                    $playlistItems[] = [
                        'id' => playerBuildStableHtmlItemId($item),
                        'content_type' => 'html',
                        'name' => $item['name'] ?? 'Web Sayfasi',
                        'url' => $item['url'] ?? '',
                        'duration' => $item['duration'] ?? $playlist['default_duration'] ?? 10,
                        'loop' => $item['loop'] ?? 0,
                        'order_index' => $item['order'] ?? 0
                    ];
                    continue;
                }

                if ($mediaId) {
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
                            'order_index' => $item['order'] ?? 0
                        ];
                    }
                }
            }
        }
    }

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
    unset($item);
}

// Transform to player format (same shape as init.php)
$transformedItems = [];
foreach ($playlistItems as $item) {
    $isTemplate = ($item['content_type'] ?? '') === 'template' || !empty($item['template_id']);

    if ($isTemplate && !empty($item['template_id'])) {
        $templateInfo = $db->fetch(
            "SELECT id, name, preview_image, type, width, height FROM templates WHERE id = ?",
            [$item['template_id']]
        );

        if ($templateInfo) {
            $previewUrl = '';
            $previewPath = $templateInfo['preview_image'] ?? '';
            if ($previewPath) {
                if (strpos($previewPath, 'data:') === 0) {
                    $previewUrl = $previewPath;
                } elseif (strpos($previewPath, 'http://') === 0 || strpos($previewPath, 'https://') === 0) {
                    $previewUrl = $previewPath;
                } elseif (preg_match('/^[A-Za-z]:/', $previewPath)) {
                    $previewUrl = $basePath . '/api/media/serve.php?path=' . urlencode($previewPath);
                } elseif (strpos($previewPath, 'storage/') === 0) {
                    $previewUrl = $basePath . '/' . ltrim($previewPath, '/');
                } else {
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
                'order' => (int) ($item['order_index'] ?? 0)
            ];
        }
        continue;
    }

    if (($item['content_type'] ?? '') === 'html') {
        $transformedItems[] = [
            'id' => $item['id'],
            'name' => $item['name'] ?? 'Web Sayfasi',
            'type' => 'html',
            'url' => $item['url'] ?? '',
            'duration' => isset($item['duration']) ? (int) $item['duration'] : null,
            'loop' => (int) ($item['loop'] ?? 0),
            'order' => (int) ($item['order_index'] ?? 0)
        ];
        continue;
    }

    $contentType = $item['media_type'] ?? '';
    if (empty($contentType) || $contentType === 'unknown') {
        $mimeType = $item['mime_type'] ?? '';
        if (strpos($mimeType, 'image/') === 0) {
            $contentType = 'image';
        } elseif (strpos($mimeType, 'video/') === 0) {
            $contentType = 'video';
        } else {
            $contentType = 'image';
        }
    }

    $transformedItems[] = [
        'id' => $item['id'] ?? $item['media_id'] ?? null,
        'media_id' => $item['media_id'] ?? null,
        'name' => $item['media_name'] ?? 'Unnamed',
        'type' => $contentType,
        'url' => $item['media_url'] ?? '',
        'stream_profile' => $item['stream_profile'] ?? null,
        'mime_type' => $item['mime_type'] ?? '',
        'duration' => isset($item['duration']) ? (int) $item['duration'] : null,
        'loop' => (int) ($item['loop'] ?? 0),
        'order' => (int) ($item['order_index'] ?? 0)
    ];
}

if ($assignmentChanged || $scheduleChanged) {
    $playlistChanged = true;
}

// Template change check
$template = null;
if (!empty($deviceInfo['current_template_id'])) {
    $templateData = $db->fetch(
        "SELECT * FROM templates WHERE id = ?",
        [$deviceInfo['current_template_id']]
    );

    if ($templateData && !empty($templateData['updated_at']) && $templateData['updated_at'] > $sinceDateTime) {
        $templateChanged = true;
        $template = [
            'id' => $templateData['id'],
            'name' => $templateData['name'],
            'type' => $templateData['type'],
            'orientation' => $templateData['orientation'] ?? null,
            'version' => $templateData['version'] ?? 1,
            'updatedAt' => $templateData['updated_at']
        ];
    }
}

// Pending commands
$commands = $db->fetchAll(
    "SELECT id, command, parameters, priority
     FROM device_commands
     WHERE device_id = ? AND status = 'pending'
     ORDER BY priority DESC, created_at ASC",
    [$deviceId]
);

$hasUpdate = $deviceChanged || $scheduleChanged || $assignmentChanged || $playlistChanged || $templateChanged || !empty($commands);

$response = [
    'hasUpdate' => $hasUpdate,
    'since' => $sinceDateTime,
    'serverTime' => date('Y-m-d H:i:s'),
    'display_tuning' => $displayTuningPolicy,
    'changes' => [
        'schedule' => $scheduleChanged,
        'assignment' => $assignmentChanged,
        'playlist' => $playlistChanged,
        'template' => $templateChanged,
        'device' => $deviceChanged,
        'commands' => !empty($commands)
    ]
];

if ($hasUpdate) {
    if ($playlistChanged || $deviceChanged || $assignmentChanged || $scheduleChanged) {
        $response['playlist'] = $playlist ? [
            'id' => $playlist['id'],
            'name' => $playlist['name'],
            'description' => $playlist['description'] ?? '',
            'orientation' => $playlist['orientation'] ?? 'landscape',
            'layout_type' => $playlist['layout_type'] ?? 'full',
            'transition' => $playlist['transition'] ?? 'fade',
            'transition_duration' => (int) ($playlist['transition_duration'] ?? 500),
            'default_duration' => (int) ($playlist['default_duration'] ?? 10),
            'updatedAt' => $playlist['updated_at'] ?? null,
            'items' => $transformedItems
        ] : null;
    }

    if ($templateChanged && $template) {
        $response['template'] = $template;
    }

    if (!empty($commands)) {
        $response['commands'] = $commands;
        $commandIds = array_column($commands, 'id');
        if (!empty($commandIds)) {
            $placeholders = implode(',', array_fill(0, count($commandIds), '?'));
            $db->query(
                "UPDATE device_commands SET status = 'sent' WHERE id IN ($placeholders)",
                $commandIds
            );
        }
    }

    if ($deviceChanged) {
        $response['device'] = [
            'orientation' => $deviceInfo['orientation'] ?? null,
            'screenWidth' => $deviceInfo['screen_width'] ?? null,
            'screenHeight' => $deviceInfo['screen_height'] ?? null,
            'currentTemplateId' => $deviceInfo['current_template_id'] ?? null
        ];
    }
}

Logger::debug('PWA player sync request', [
    'device_id' => $deviceId,
    'since' => $sinceDateTime,
    'has_update' => $hasUpdate,
    'playlist_id' => $playlist['id'] ?? null
]);

Response::success($response);
