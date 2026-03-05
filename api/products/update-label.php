<?php
/**
 * Update Label Assignment API
 * PUT /api/products/:id/labels/:labelId
 *
 * labelId is the device_id in this context
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->routeParam('id');
$deviceId = $request->routeParam('labelId'); // labelId is actually device_id
$publicTemplateFilter = "(company_id = ? OR is_public = true OR scope = 'system' OR company_id IS NULL)";

// Verify product exists and belongs to user's company
$product = $db->fetch(
    "SELECT id, name FROM products WHERE id = ? AND company_id = ?",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Urun bulunamadi');
}

// Get new values
$newDeviceId = $request->input('device_id');
$newTemplateId = $request->input('template_id');

if (!$newDeviceId) {
    Response::badRequest('Cihaz ID gerekli');
}

// Verify new device exists
$newDevice = $db->fetch(
    "SELECT id, name FROM devices WHERE id = ? AND company_id = ?",
    [$newDeviceId, $companyId]
);

if (!$newDevice) {
    Response::notFound('Yeni cihaz bulunamadi');
}

// If template specified, verify it exists
if ($newTemplateId) {
    $template = $db->fetch(
        "SELECT id FROM templates WHERE id = ? AND $publicTemplateFilter",
        [$newTemplateId, $companyId]
    );

    if (!$template) {
        Response::notFound('Sablon bulunamadi');
    }
}

// If device is changing, clear old device first
if ($deviceId !== $newDeviceId) {
    // Preserve device preview image if it was stored in current_content
    $oldDevice = $db->fetch("SELECT current_content, metadata FROM devices WHERE id = ?", [$deviceId]);
    if ($oldDevice && !empty($oldDevice['current_content'])) {
        $contentData = json_decode($oldDevice['current_content'], true);
        if (!$contentData) {
            $metadata = $oldDevice['metadata'] ? json_decode($oldDevice['metadata'], true) : [];
            if (!is_array($metadata)) {
                $metadata = [];
            }
            if (empty($metadata['preview_image'])) {
                $metadata['preview_image'] = $oldDevice['current_content'];
                $db->update('devices', ['metadata' => json_encode($metadata)], 'id = ?', [$deviceId]);
            }
        }
    }

    $db->update('devices', [
        'current_content' => null,
        'current_template_id' => null,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$deviceId]);
}

// Update new device with assignment
$targetDevice = $db->fetch("SELECT current_content, metadata FROM devices WHERE id = ?", [$newDeviceId]);
if ($targetDevice && !empty($targetDevice['current_content'])) {
    $contentData = json_decode($targetDevice['current_content'], true);
    if (!$contentData) {
        $metadata = $targetDevice['metadata'] ? json_decode($targetDevice['metadata'], true) : [];
        if (!is_array($metadata)) {
            $metadata = [];
        }
        if (empty($metadata['preview_image'])) {
            $metadata['preview_image'] = $targetDevice['current_content'];
            $db->update('devices', ['metadata' => json_encode($metadata)], 'id = ?', [$newDeviceId]);
        }
    }
}

$db->update('devices', [
    'current_content' => json_encode([
        'type' => 'product',
        'product_id' => $productId,
        'template_id' => $newTemplateId,
        'assigned_at' => date('Y-m-d H:i:s')
    ]),
    'current_template_id' => $newTemplateId,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$newDeviceId]);

// Log the action
Logger::audit('update_label', 'products', [
    'product_id' => $productId,
    'old_device_id' => $deviceId,
    'new_device_id' => $newDeviceId,
    'template_id' => $newTemplateId
]);

Response::success([
    'product_id' => $productId,
    'device_id' => $newDeviceId,
    'template_id' => $newTemplateId
], 'Etiket guncellendi');
