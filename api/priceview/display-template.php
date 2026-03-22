<?php
/**
 * PriceView display templates
 * GET /api/priceview/display-template
 *
 * Returns both product-found and not-found HTML templates.
 */

try {
    $db = Database::getInstance();
    $device = DeviceAuthMiddleware::device();

    if (!$device) {
        Response::unauthorized('Device authentication required');
    }

    require_once __DIR__ . '/template-utils.php';

    $companyId = $device['company_id'];
    $settingsData = priceviewFetchCompanySettings($db, $companyId);
    $deviceId = $device['device_id'] ?? $device['id'] ?? null;

    $deviceMetadata = [];
    if (is_string($deviceId) && $deviceId !== '') {
        $deviceRow = $db->fetch(
            "SELECT metadata FROM devices WHERE id = ? AND company_id = ? LIMIT 1",
            [$deviceId, $companyId]
        );
        $deviceMetadata = priceviewParseMetadata($deviceRow['metadata'] ?? null);
    } else {
        $deviceMetadata = priceviewParseMetadata($device['metadata'] ?? $device['device_metadata'] ?? null);
    }

    $deviceOverride = priceviewReadDeviceTemplateOverride($deviceMetadata);
    $presets = priceviewTemplatePresets();
    $presetNames = array_values(array_map(static function (array $preset): string {
        return (string)$preset['name'];
    }, $presets));

    $resolved = priceviewResolveTemplateSelection(
        $settingsData['priceview_product_display_template'] ?? null,
        $deviceOverride,
        $presetNames
    );

    $fileInfo = priceviewTemplateFileInfo($resolved['template_name']);
    $productHtml = priceviewReadTemplateFile($fileInfo['product_path']);
    $notFoundHtml = priceviewReadTemplateFile($fileInfo['not_found_path']);

    if ($productHtml === null) {
        $productHtml = priceviewDefaultProductTemplate();
    }
    if ($notFoundHtml === null) {
        $notFoundHtml = priceviewDefaultNotFoundTemplate();
    }

    $signature = $fileInfo['signature'] ?: sha1($resolved['template_name'] . '|' . $productHtml . '|' . $notFoundHtml);

    Response::success([
        'html' => $productHtml, // Backward compatibility
        'product_html' => $productHtml,
        'not_found_html' => $notFoundHtml,
        'template_name' => $resolved['template_name'],
        'template_source' => $resolved['source'],
        'template_signature' => $signature,
        'product_display_mode' => $settingsData['priceview_product_display_mode'] ?? 'native',
        'server_time' => date('c'),
    ]);
} catch (Throwable $e) {
    Response::error('Display template error: ' . $e->getMessage(), 500);
}
