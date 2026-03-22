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
require_once __DIR__ . '/template-utils.php';

// Company + device settings
$settingsData = priceviewFetchCompanySettings($db, $companyId);
$deviceId = $device['device_id'] ?? $device['id'] ?? null;
$resolvedDeviceId = priceviewResolveDeviceUuid($db, (string)$companyId, $device);
$deviceRow = null;
if (is_string($resolvedDeviceId) && $resolvedDeviceId !== '') {
    $deviceRow = $db->fetch(
        "SELECT d.id, d.company_id, d.branch_id, d.metadata, b.name AS branch_name
         FROM devices d
         LEFT JOIN branches b ON b.id = d.branch_id
         WHERE d.id = ? AND d.company_id = ?
         LIMIT 1",
        [$resolvedDeviceId, $companyId]
    );
}
$deviceMetadata = priceviewParseMetadata($deviceRow['metadata'] ?? ($device['metadata'] ?? $device['device_metadata'] ?? null));
$deviceTemplateOverride = priceviewReadDeviceTemplateOverride($deviceMetadata);

$presets = priceviewTemplatePresets();
$presetNames = array_values(array_map(static function (array $preset): string {
    return (string)$preset['name'];
}, $presets));
$companyTemplateName = $settingsData['priceview_product_display_template'] ?? null;
$resolvedTemplate = priceviewResolveTemplateSelection($companyTemplateName, $deviceTemplateOverride, $presetNames);
$templateInfo = priceviewTemplateFileInfo($resolvedTemplate['template_name']);
$templateSignature = $templateInfo['signature'] ?? sha1('default|' . ($resolvedTemplate['template_name'] ?? ''));

$displayMode = (string)($settingsData['priceview_product_display_mode'] ?? 'native');
if (!in_array($displayMode, ['native', 'html'], true)) {
    $displayMode = 'native';
}
$settingsData['priceview_product_display_mode'] = $displayMode;

// Available print templates (active templates for this company or system)
$printTemplates = $db->fetchAll(
    "SELECT id, name, type, width, height, preview_image, render_image, grid_layout
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
    'device_id' => $deviceId,
    'company_id' => $companyId,
    'company_name' => $device['company_name'] ?? null,
    'branch_id' => $deviceRow['branch_id'] ?? ($device['branch_id'] ?? null),
    'branch_name' => $deviceRow['branch_name'] ?? null,
    'sync_interval_minutes' => intval($settingsData['priceview_sync_interval'] ?? 30),
    'overlay_timeout_seconds' => intval($settingsData['priceview_overlay_timeout'] ?? 10),
    'default_template_id' => $settingsData['priceview_default_template'] ?? null,
    'print_enabled' => boolval($settingsData['priceview_print_enabled'] ?? true),
    'signage_enabled' => boolval($settingsData['priceview_signage_enabled'] ?? true),
    'product_display_mode' => $settingsData['priceview_product_display_mode'] ?? 'native',
    'display_template_url' => '/api/priceview/display-template',
    'display_template_name' => $resolvedTemplate['template_name'],
    'display_template_source' => $resolvedTemplate['source'],
    'display_template_signature' => $templateSignature,
    'display_template_company' => $resolvedTemplate['company_template_name'],
    'display_template_device_override' => $resolvedTemplate['device_template_override'],
    'display_template_presets' => $presets,
    'templates' => $printTemplates,
    'product_count' => intval($productCount['cnt'] ?? 0),
    'server_time' => date('c')
]);

} catch (Throwable $e) {
    Response::error('Config error: ' . $e->getMessage(), 500);
}
