<?php
/**
 * Device Detail API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');
$playlistOrderColumn = $db->columnExists('playlist_items', 'sort_order') ? 'sort_order' : 'order_index';

$device = $db->fetch(
    "SELECT d.*, g.name as group_name, c.name as company_name, b.name as branch_name
     FROM devices d
     LEFT JOIN device_groups g ON d.group_id = g.id
     LEFT JOIN companies c ON d.company_id = c.id
     LEFT JOIN branches b ON d.branch_id = b.id
     WHERE d.id = ? AND d.company_id = ?",
    [$id, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Map type - use original_type from metadata if available
$metadataRaw = $device['metadata'] ?? null;
if (is_array($metadataRaw)) {
    $metadata = $metadataRaw;
} elseif (is_string($metadataRaw) && $metadataRaw !== '') {
    $decodedMetadata = json_decode($metadataRaw, true);
    $metadata = is_array($decodedMetadata) ? $decodedMetadata : [];
} else {
    $metadata = [];
}
$device['serial_number'] = $device['device_id'];
$device['db_type'] = $device['type'];

if (!empty($metadata['original_type'])) {
    $device['type'] = $metadata['original_type'];
    $device['original_type'] = $metadata['original_type'];
} else {
    $typeMapReverse = ['android_tv' => 'android_tv', 'esl' => 'esl', 'panel' => 'panel', 'web_display' => 'web_display'];
    $device['type'] = $typeMapReverse[$device['type']] ?? $device['type'];
    $device['original_type'] = $device['type'];
}

// Get recent logs
$logs = $db->fetchAll(
    "SELECT * FROM device_logs WHERE device_id = ? ORDER BY created_at DESC LIMIT 10",
    [$id]
);

$device['recent_logs'] = $logs;

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

// Helper: check if value is a valid file path (not base64 data)
function isValidImagePath($value) {
    if (empty($value)) return false;
    if (strlen($value) > 500) return false;
    if (strpos($value, 'data:') === 0) return false;
    if (preg_match('/^[A-Za-z0-9+\/=]{50,}$/', $value)) return false;
    if (strpos($value, '{') === 0 || strpos($value, '[') === 0) return false;
    return true;
}

// Helper: build public URL from file path
function buildPublicUrl($path, $basePath) {
    if (empty($path)) return null;
    $normalized = str_replace('\\', '/', $path);

    // If already an HTTP URL, return as-is
    if (preg_match('/^https?:\/\//i', $normalized)) {
        return $normalized;
    }

    // Remove Windows drive letter if present
    $normalized = preg_replace('/^[A-Za-z]:/', '', $normalized);

    // Remove BASE_PATH prefix if present
    $baseFs = str_replace('\\', '/', BASE_PATH);
    if (strpos($normalized, $baseFs) === 0) {
        $normalized = substr($normalized, strlen($baseFs));
    }

    $normalized = ltrim($normalized, '/');

    if (strpos($normalized, 'storage/') === 0) {
        return $basePath . '/' . $normalized;
    }

    return $basePath . '/storage/' . $normalized;
}

// Parse current_content JSON to get assigned template info
$device['assigned_template'] = null;
$device['render_image_url'] = null;
$device['content_preview_url'] = null;
$device['preview_url'] = null;

// Determine template ID: from current_content JSON or current_template_id column
$templateId = null;
$productId = null;
$assignedAt = null;

if (!empty($device['current_content'])) {
    $contentData = null;
    if (is_array($device['current_content'])) {
        $contentData = $device['current_content'];
    } elseif (is_string($device['current_content'])) {
        $contentData = json_decode($device['current_content'], true);
    }

    if ($contentData && isset($contentData['template_id'])) {
        $templateId = $contentData['template_id'];
        $productId = $contentData['product_id'] ?? null;
        $assignedAt = $contentData['assigned_at'] ?? null;
    }

    // If current_content is a valid image path (from upload-preview), expose it
    if (!$contentData && isValidImagePath($device['current_content'])) {
        $contentPath = $device['current_content'];
        if (strpos($contentPath, 'storage/') === 0 || strpos($contentPath, 'devices/') === 0) {
            $device['content_preview_url'] = $basePath . '/storage/' . ltrim($contentPath, '/');
        } else {
            $device['content_preview_url'] = $basePath . '/' . ltrim($contentPath, '/');
        }
    }
}

// Device preview image from metadata (preferred for hero image)
$previewImage = $metadata['preview_image'] ?? null;
if (isValidImagePath($previewImage)) {
    $device['preview_url'] = $previewImage;
} elseif (!empty($device['content_preview_url'])) {
    $device['preview_url'] = $device['content_preview_url'];
}

// Fallback: use current_template_id column if current_content didn't have template_id
if (!$templateId && !empty($device['current_template_id'])) {
    $templateId = $device['current_template_id'];
}

$templateIdText = is_scalar($templateId) ? trim((string)$templateId) : '';
$isTemplateUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $templateIdText) === 1;
$templateLookupExpr = $db->isPostgres()
    ? 'CAST(id AS TEXT) = CAST(? AS TEXT)'
    : 'id = ?';

// If we have a template ID (from any source), load template details and render cache
if ($templateId && (!$db->isPostgres() || $isTemplateUuid)) {
    // Get template details
    $template = $db->fetch(
        "SELECT id, name, type, target_device_type, render_image, preview_image, grid_layout, created_at, updated_at
         FROM templates WHERE $templateLookupExpr AND (company_id = ? OR scope = 'system' OR company_id IS NULL)",
        [$templateId, $companyId]
    );

    if ($template) {
        $device['assigned_template'] = [
            'id' => $template['id'],
            'name' => $template['name'],
            'type' => $template['type'],
            'target_device_type' => $template['target_device_type'],
            'grid_layout' => $template['grid_layout'],
            'preview_image' => isValidImagePath($template['preview_image']) ? buildPublicUrl($template['preview_image'], $basePath) : null,
            'render_image' => isValidImagePath($template['render_image']) ? buildPublicUrl($template['render_image'], $basePath) : null,
            'assigned_at' => $assignedAt,
            'created_at' => $template['created_at'],
            'updated_at' => $template['updated_at']
        ];
    }

    // Look for device-specific render cache image
    // Path: storage/renders/{company_id}/{device_type}/{locale}/{template_id}/{cache_key}.jpg
    $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : (BASE_PATH . '/storage');
    $deviceType = $device['db_type'] ?? $device['type'] ?? 'esl';

    // Try user locale first, fallback to 'tr'
    $userPrefsRaw = $user['preferences'] ?? null;
    if (is_array($userPrefsRaw)) {
        $userPrefs = $userPrefsRaw;
    } elseif (is_string($userPrefsRaw) && $userPrefsRaw !== '') {
        $decodedPrefs = json_decode($userPrefsRaw, true);
        $userPrefs = is_array($decodedPrefs) ? $decodedPrefs : [];
    } else {
        $userPrefs = [];
    }
    $locales = array_unique(array_filter([$userPrefs['language'] ?? null, 'tr', 'en']));

    $renderFile = null;
    foreach ($locales as $locale) {
        $renderDir = $storagePath . '/renders/' . $companyId . '/' . $deviceType . '/' . $locale . '/' . $templateId;

        if (!is_dir($renderDir)) continue;

        $files = glob($renderDir . '/*.{jpg,png,jpeg}', GLOB_BRACE);
        if (empty($files)) continue;

        // Sort by modification time, newest first
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        $renderFile = $files[0];
        break;
    }

    if ($renderFile) {
        $relativePath = str_replace(str_replace('\\', '/', BASE_PATH), '', str_replace('\\', '/', $renderFile));
        $device['render_image_url'] = $basePath . $relativePath;
    }

    // Fallback: check template's own render_image field
    if (empty($device['render_image_url']) && !empty($device['assigned_template']['render_image'])) {
        $device['render_image_url'] = $device['assigned_template']['render_image'];
    }
}

// Try render cache (preferred for device content preview)
if (empty($device['render_image_url']) && $productId && $templateId && (!$db->isPostgres() || $isTemplateUuid)) {
    try {
        $renderCache = $db->fetch(
            "SELECT image_path, rendered_at FROM render_cache
             WHERE company_id = ? AND product_id = ? AND template_id = ?
             AND image_path IS NOT NULL
             ORDER BY rendered_at DESC, updated_at DESC LIMIT 1",
            [$companyId, $productId, $templateId]
        );

        if (!empty($renderCache['image_path'])) {
            $device['render_image_url'] = buildPublicUrl($renderCache['image_path'], $basePath);
        }
    } catch (Exception $e) {
        // render_cache table may not exist on some installs
    }
}

// Fallback to product_renders (new render tracking)
if (empty($device['render_image_url']) && $productId && $templateId && (!$db->isPostgres() || $isTemplateUuid)) {
    try {
        $productRender = $db->fetch(
            "SELECT file_path FROM product_renders
             WHERE company_id = ? AND product_id = ? AND template_id = ?
             AND file_path IS NOT NULL
             ORDER BY completed_at DESC, created_at DESC LIMIT 1",
            [$companyId, $productId, $templateId]
        );

        if (!empty($productRender['file_path'])) {
            $device['render_image_url'] = buildPublicUrl($productRender['file_path'], $basePath);
        }
    } catch (Exception $e) {
        // product_renders table may not exist on some installs
    }
}

// Get assigned playlist (active)
$playlistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON dca.content_type = 'playlist' AND CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON dca.content_id = p.id AND dca.content_type = 'playlist'";

$assignedContent = $db->fetch(
    "SELECT dca.*, p.name as playlist_name, p.description as playlist_description,
            p.items as playlist_items, p.status as playlist_status,
            p.orientation, p.layout_type, p.default_duration
     FROM device_content_assignments dca
     $playlistJoin
     WHERE dca.device_id = ? AND dca.status = 'active'
     ORDER BY dca.created_at DESC
     LIMIT 1",
    [$id]
);

if ($assignedContent && (($assignedContent['content_type'] ?? '') === 'playlist') && !empty($assignedContent['content_id'])) {
    $playlistItemsRaw = $assignedContent['playlist_items'] ?? '[]';
    if (is_array($playlistItemsRaw)) {
        $playlistItems = $playlistItemsRaw;
    } elseif (is_string($playlistItemsRaw) && $playlistItemsRaw !== '') {
        $playlistItems = json_decode($playlistItemsRaw, true);
    } else {
        $playlistItems = [];
    }
    if (!is_array($playlistItems)) {
        $playlistItems = [];
    }

    $device['assigned_playlist'] = [
        'id' => $assignedContent['content_id'],
        'name' => $assignedContent['playlist_name'],
        'description' => $assignedContent['playlist_description'],
        'status' => $assignedContent['playlist_status'],
        'orientation' => $assignedContent['orientation'],
        'layout_type' => $assignedContent['layout_type'],
        'default_duration' => $assignedContent['default_duration'],
        'items' => $playlistItems,
        'assigned_at' => $assignedContent['created_at']
    ];

    if (empty($device['assigned_playlist']['items']) || !is_array($device['assigned_playlist']['items'])) {
        $normalizedItems = $db->fetchAll(
            "SELECT id, media_id, duration, {$playlistOrderColumn} as order_index
             FROM playlist_items
             WHERE playlist_id = ?
             ORDER BY {$playlistOrderColumn} ASC",
            [$assignedContent['content_id']]
        );

        $device['assigned_playlist']['items'] = array_map(function ($item) {
            return [
                'id' => $item['id'],
                'media_id' => $item['media_id'] ?? null,
                'duration' => $item['duration'] ?? null,
                'order' => $item['order_index'] ?? 0
            ];
        }, $normalizedItems);
    }

    // If playlist has items, get media details
    if (!empty($device['assigned_playlist']['items'])) {
        $mediaIds = array_column($device['assigned_playlist']['items'], 'media_id');
        if (!empty($mediaIds)) {
            $placeholders = implode(',', array_fill(0, count($mediaIds), '?'));
            $mediaItems = $db->fetchAll(
                "SELECT id, name, file_path, file_type, mime_type, file_size FROM media WHERE id IN ($placeholders)",
                $mediaIds
            );

            // Build proper URLs for each media item
            foreach ($mediaItems as &$m) {
                $filePath = $m['file_path'];
                if (preg_match('/^[A-Za-z]:/', $filePath)) {
                    $m['url'] = $basePath . '/api/media/serve.php?path=' . urlencode($filePath);
                } elseif (strpos($filePath, 'storage/') === 0) {
                    $m['url'] = $basePath . '/' . ltrim($filePath, '/');
                } else {
                    $m['url'] = $basePath . '/storage/' . ltrim($filePath, '/');
                }
                $m['type'] = $m['file_type'];
                $m['size'] = $m['file_size'];
            }

            $device['assigned_playlist']['media'] = $mediaItems;
        }
    }
}

// Sanitize current_content - don't send raw base64 data to frontend
if (!empty($device['current_content']) && !isValidImagePath($device['current_content'])) {
    // If it's valid JSON, keep it; otherwise clear it
    if (is_array($device['current_content'])) {
        $parsed = $device['current_content'];
    } else {
        $parsed = json_decode((string)$device['current_content'], true);
    }
    if (!$parsed) {
        $device['current_content'] = null;
    }
}

Response::success($device);
