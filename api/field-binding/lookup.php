<?php
/**
 * Field Binding Lookup API
 *
 * Looks up a device or product by code (barcode, SKU, ID, MAC address, etc.)
 * and returns the entity along with its current assignment information.
 *
 * POST /api/field-binding/lookup
 * Body: { "code": "...", "type": "device" | "product" }
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$code = trim($request->input('code', ''));
$type = trim($request->input('type', ''));

// --- Validation ---

if ($code === '') {
    Response::badRequest('Kod gerekli');
}

if (!in_array($type, ['device', 'product'], true)) {
    Response::badRequest('Geçersiz arama tipi');
}

// =====================================================
// Device Lookup
// =====================================================
if ($type === 'device') {
    // Search by id, device_id, mac_address (case-insensitive), name, or ip_address
    $device = $db->fetch(
        "SELECT id, name, type, ip_address, mac_address, status,
                screen_width, screen_height, model, manufacturer, device_id
         FROM devices
         WHERE company_id = ?
           AND (
               id::text = ?
               OR device_id = ?
               OR LOWER(mac_address) = LOWER(?)
               OR name = ?
               OR ip_address = ?
           )
         LIMIT 1",
        [$companyId, $code, $code, $code, $code, $code]
    );

    if (!$device) {
        Response::notFound('Cihaz bulunamadı');
    }

    // Find the product currently assigned to this device
    $currentAssignment = null;
    $assignedProduct = $db->fetch(
        "SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
                p.assigned_template_id AS template_id, t.name AS template_name
         FROM products p
         LEFT JOIN templates t ON t.id = p.assigned_template_id
         WHERE p.assigned_device_id = ?
           AND p.company_id = ?
           AND p.status != 'deleted'
         LIMIT 1",
        [$device['id'], $companyId]
    );

    if ($assignedProduct) {
        $currentAssignment = [
            'product_id'    => $assignedProduct['product_id'],
            'product_name'  => $assignedProduct['product_name'],
            'product_sku'   => $assignedProduct['product_sku'],
            'template_id'   => $assignedProduct['template_id'],
            'template_name' => $assignedProduct['template_name'],
        ];
    }

    Response::success([
        'id'                  => $device['id'],
        'name'                => $device['name'],
        'type'                => $device['type'],
        'ip_address'          => $device['ip_address'],
        'mac_address'         => $device['mac_address'],
        'status'              => $device['status'],
        'screen_width'        => $device['screen_width'],
        'screen_height'       => $device['screen_height'],
        'model'               => $device['model'],
        'manufacturer'        => $device['manufacturer'],
        'current_assignment'  => $currentAssignment,
    ]);
}

// =====================================================
// Product Lookup
// =====================================================
if ($type === 'product') {
    // Search by barcode, sku, or id
    $product = $db->fetch(
        "SELECT p.id, p.name, p.sku, p.barcode, p.current_price, p.previous_price,
                p.category, p.images, p.assigned_device_id, p.assigned_template_id
         FROM products p
         WHERE p.company_id = ?
           AND p.status != 'deleted'
           AND (
               p.barcode = ?
               OR p.sku = ?
               OR p.id::text = ?
           )
         LIMIT 1",
        [$companyId, $code, $code, $code]
    );

    if (!$product) {
        Response::notFound('Ürün bulunamadı');
    }

    // Resolve device name if assigned
    $deviceName = null;
    if (!empty($product['assigned_device_id'])) {
        $assignedDevice = $db->fetch(
            "SELECT name FROM devices WHERE id = ?",
            [$product['assigned_device_id']]
        );
        $deviceName = $assignedDevice['name'] ?? null;
    }

    // Resolve template name if assigned
    $templateName = null;
    if (!empty($product['assigned_template_id'])) {
        $assignedTemplate = $db->fetch(
            "SELECT name FROM templates WHERE id = ?",
            [$product['assigned_template_id']]
        );
        $templateName = $assignedTemplate['name'] ?? null;
    }

    // Parse images JSON if stored as string
    $images = $product['images'];
    if (is_string($images)) {
        $images = json_decode($images, true) ?: [];
    }

    Response::success([
        'id'                    => $product['id'],
        'name'                  => $product['name'],
        'sku'                   => $product['sku'],
        'barcode'               => $product['barcode'],
        'current_price'         => $product['current_price'],
        'previous_price'        => $product['previous_price'],
        'category'              => $product['category'],
        'images'                => $images,
        'assigned_device_id'    => $product['assigned_device_id'],
        'assigned_template_id'  => $product['assigned_template_id'],
        'device_name'           => $deviceName,
        'template_name'         => $templateName,
    ]);
}
