<?php
/**
 * Remove Label Assignment API
 * DELETE /api/products/:id/labels/:labelId
 *
 * labelId is the device_id in this context
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->routeParam('id');
$deviceId = $request->routeParam('labelId'); // labelId is actually device_id

// Verify product exists and belongs to user's company
$product = $db->fetch(
    "SELECT id, name, assigned_device_id, assigned_template_id FROM products WHERE id = ? AND company_id = ?",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Urun bulunamadi');
}

// Check if this product has the specified device assigned
if (empty($product['assigned_device_id']) || $product['assigned_device_id'] !== $deviceId) {
    Response::badRequest('Bu urunde bu cihaza ait etiket atamasi bulunamadi');
}

// Verify device exists
$device = $db->fetch(
    "SELECT id, name FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadi');
}

// Clear the assignment from product
$db->update('products', [
    'assigned_device_id' => null,
    'assigned_template_id' => null,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$productId]);

// Also clear the device's current_content if it references this product
$deviceContent = $db->fetch(
    "SELECT current_content FROM devices WHERE id = ?",
    [$deviceId]
);

if ($deviceContent && !empty($deviceContent['current_content'])) {
    $content = json_decode($deviceContent['current_content'], true);
    if ($content && isset($content['product_id']) && $content['product_id'] === $productId) {
        // Preserve device preview image if it was stored in current_content
        $metadata = $device['metadata'] ? json_decode($device['metadata'], true) : [];
        if (!is_array($metadata)) {
            $metadata = [];
        }
        if (empty($metadata['preview_image'])) {
            $metadata['preview_image'] = $deviceContent['current_content'];
            $db->update('devices', ['metadata' => json_encode($metadata)], 'id = ?', [$deviceId]);
        }

        $db->update('devices', [
            'current_content' => null,
            'current_template_id' => null,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$deviceId]);
    }
}

// Log the action
Logger::audit('remove_label', 'products', [
    'product_id' => $productId,
    'device_id' => $deviceId
]);

Response::success([
    'product_id' => $productId,
    'device_id' => $deviceId
], 'Etiket atamasi kaldirildi');
