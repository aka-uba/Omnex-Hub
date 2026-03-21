<?php
/**
 * Device-specific PriceView settings
 * GET /api/devices/{id}/priceview-settings
 * PUT /api/devices/{id}/priceview-settings
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

require_once __DIR__ . '/../priceview/template-utils.php';

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');

if (!is_string($deviceId) || trim($deviceId) === '') {
    Response::error('Geçersiz cihaz', 400);
}

$device = $db->fetch(
    "SELECT id, name, company_id, metadata
     FROM devices
     WHERE id = ? AND company_id = ?
     LIMIT 1",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

$method = strtoupper((string)$request->getMethod());
$companySettings = priceviewFetchCompanySettings($db, (string)$companyId);
$presets = priceviewTemplatePresets();
$presetNames = array_values(array_map(static function (array $preset): string {
    return (string)$preset['name'];
}, $presets));

$metadata = priceviewParseMetadata($device['metadata'] ?? null);
$deviceOverride = priceviewReadDeviceTemplateOverride($metadata);

if ($method === 'PUT') {
    $payload = $request->json();
    if (empty($payload)) {
        $payload = $request->body();
    }

    $rawOverride = $payload['display_template_override'] ?? null;
    $normalizedOverride = priceviewNormalizeTemplateName($rawOverride);

    if ($normalizedOverride !== null && !in_array($normalizedOverride, $presetNames, true)) {
        Response::error('Geçersiz görüntüleme şablonu', 422);
    }

    $metadata = priceviewWriteDeviceTemplateOverride($metadata, $normalizedOverride);

    $db->update('devices', [
        'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'updated_at' => date('Y-m-d H:i:s'),
    ], 'id = ? AND company_id = ?', [$deviceId, $companyId]);

    $deviceOverride = $normalizedOverride;
}

$resolved = priceviewResolveTemplateSelection(
    $companySettings['priceview_product_display_template'] ?? null,
    $deviceOverride,
    $presetNames
);

Response::success([
    'device_id' => $deviceId,
    'device_name' => $device['name'] ?? null,
    'product_display_mode' => $companySettings['priceview_product_display_mode'] ?? 'native',
    'company_display_template' => $resolved['company_template_name'],
    'device_display_template_override' => $resolved['device_template_override'],
    'effective_display_template' => $resolved['template_name'],
    'effective_display_template_source' => $resolved['source'],
    'display_template_presets' => $presets,
], $method === 'PUT' ? 'PriceView cihaz ayarı kaydedildi' : 'Success');

