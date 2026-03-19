<?php
/**
 * PriceView Device Configuration
 * GET /api/priceview/config
 */

try {

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];

// Company settings
$settings = $db->fetch(
    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);
$settingsData = !empty($settings['data']) ? json_decode($settings['data'], true) ?: [] : [];

// Available print templates (active templates for this company or system)
$templates = $db->fetchAll(
    "SELECT id, name, type, width, height, thumbnail, preview_image, grid_layout
     FROM templates
     WHERE (company_id = ? OR scope = 'system')
       AND status = 'active'
     ORDER BY name ASC",
    [$companyId]
);

// Product count for sync estimation
$productCount = $db->fetch(
    "SELECT COUNT(*) as cnt FROM products WHERE company_id = ? AND status = 'active'",
    [$companyId]
);

Response::success([
    'device_id' => $device['id'],
    'company_id' => $companyId,
    'company_name' => $device['company_name'] ?? null,
    'sync_interval_minutes' => intval($settingsData['priceview_sync_interval'] ?? 30),
    'overlay_timeout_seconds' => intval($settingsData['priceview_overlay_timeout'] ?? 10),
    'default_template_id' => $settingsData['priceview_default_template'] ?? null,
    'print_enabled' => boolval($settingsData['priceview_print_enabled'] ?? true),
    'signage_enabled' => boolval($settingsData['priceview_signage_enabled'] ?? true),
    'product_display_mode' => $settingsData['priceview_product_display_mode'] ?? 'native',
    'display_template_url' => '/api/priceview/display-template',
    'templates' => $templates,
    'product_count' => intval($productCount['cnt'] ?? 0),
    'server_time' => date('c')
]);

} catch (Throwable $e) {
    Response::error('Config error: ' . $e->getMessage(), 500);
}
