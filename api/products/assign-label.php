<?php
/**
 * Assign Label to Product API
 * POST /api/products/:id/assign-label
 *
 * Parameters:
 * - device_id: Cihaz ID (zorunlu)
 * - template_id: Şablon ID (opsiyonel)
 * - force: Çakışma varsa zorla ata (opsiyonel, default: false)
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$productId = $request->routeParam('id');
$templateJoinExpr = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.assigned_template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.assigned_template_id = t.id';

// Verify product exists and belongs to user's company
$product = $db->fetch(
    "SELECT id, name FROM products WHERE id = ? AND company_id = ?",
    [$productId, $companyId]
);

if (!$product) {
    Response::notFound('Urun bulunamadi');
}

$deviceId = $request->input('device_id');
$templateId = $request->input('template_id');
$force = $request->input('force', false);

if (!$deviceId) {
    Response::badRequest('Cihaz ID gerekli');
}

// Verify device exists and belongs to user's company
$device = $db->fetch(
    "SELECT id, name, type FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadi');
}

// If template specified, verify it exists
if ($templateId) {
    $template = $db->fetch(
        "SELECT id FROM templates WHERE id = ? AND (company_id = ? OR is_public IS TRUE OR scope = 'system' OR company_id IS NULL)",
        [$templateId, $companyId]
    );

    if (!$template) {
        Response::notFound('Sablon bulunamadi');
    }
}

// CHECK: Is this device already assigned to another product?
$existingAssignment = $db->fetch(
    "SELECT p.id, p.name, p.sku, t.name as template_name
     FROM products p
     {$templateJoinExpr}
     WHERE p.assigned_device_id = ? AND p.company_id = ? AND p.id != ?",
    [$deviceId, $companyId, $productId]
);

if ($existingAssignment && !$force) {
    // Return conflict warning - frontend should show confirmation
    Response::json([
        'success' => false,
        'conflict' => true,
        'message' => 'Bu cihaz zaten başka bir ürüne atanmış',
        'existing_product' => [
            'id' => $existingAssignment['id'],
            'name' => $existingAssignment['name'],
            'sku' => $existingAssignment['sku'],
            'template_name' => $existingAssignment['template_name']
        ],
        'device' => [
            'id' => $device['id'],
            'name' => $device['name']
        ]
    ], 409); // 409 Conflict
}

// If force=true or no conflict, proceed with assignment
if ($existingAssignment && $force) {
    // Remove assignment from old product
    $db->update('products', [
        'assigned_device_id' => null,
        'assigned_template_id' => null,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$existingAssignment['id']]);

    // Log the removal
    Logger::audit('unassign_label', 'products', [
        'product_id' => $existingAssignment['id'],
        'device_id' => $deviceId,
        'reason' => 'reassigned_to_another_product',
        'new_product_id' => $productId
    ]);
}

// CHECK: If this product already has a different device assigned, clear that device's content
$currentProduct = $db->fetch(
    "SELECT assigned_device_id, assigned_template_id FROM products WHERE id = ?",
    [$productId]
);

$previousDeviceId = $currentProduct['assigned_device_id'] ?? null;
if ($previousDeviceId && $previousDeviceId !== $deviceId) {
    // Preserve device preview image if it was stored in current_content
    $previousDevice = $db->fetch("SELECT current_content, metadata FROM devices WHERE id = ?", [$previousDeviceId]);
    if ($previousDevice && !empty($previousDevice['current_content'])) {
        $contentData = json_decode($previousDevice['current_content'], true);
        if (!$contentData) {
            $metadata = $previousDevice['metadata'] ? json_decode($previousDevice['metadata'], true) : [];
            if (!is_array($metadata)) {
                $metadata = [];
            }
            if (empty($metadata['preview_image'])) {
                $metadata['preview_image'] = $previousDevice['current_content'];
                $db->update('devices', ['metadata' => json_encode($metadata)], 'id = ?', [$previousDeviceId]);
            }
        }
    }

    // Clear the old device's current_content since product is being reassigned
    $db->update('devices', [
        'current_content' => null,
        'current_template_id' => null,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$previousDeviceId]);

    // Log the old device content clearing
    Logger::audit('clear_device_content', 'devices', [
        'device_id' => $previousDeviceId,
        'reason' => 'product_reassigned_to_different_device',
        'product_id' => $productId,
        'new_device_id' => $deviceId
    ]);
}

// Log the assignment action
Logger::audit('assign_label', 'products', [
    'product_id' => $productId,
    'device_id' => $deviceId,
    'template_id' => $templateId,
    'force' => $force,
    'previous_device_id' => $previousDeviceId,
    'previous_product_id' => $existingAssignment['id'] ?? null
]);

// Update product with assigned device and template
$db->update('products', [
    'assigned_device_id' => $deviceId,
    'assigned_template_id' => $templateId,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$productId]);

// Update device with current content (product assignment)
$targetDevice = $db->fetch("SELECT current_content, metadata FROM devices WHERE id = ?", [$deviceId]);
if ($targetDevice && !empty($targetDevice['current_content'])) {
    $contentData = json_decode($targetDevice['current_content'], true);
    if (!$contentData) {
        $metadata = $targetDevice['metadata'] ? json_decode($targetDevice['metadata'], true) : [];
        if (!is_array($metadata)) {
            $metadata = [];
        }
        if (empty($metadata['preview_image'])) {
            $metadata['preview_image'] = $targetDevice['current_content'];
            $db->update('devices', ['metadata' => json_encode($metadata)], 'id = ?', [$deviceId]);
        }
    }
}

$db->update('devices', [
    'current_content' => json_encode([
        'type' => 'product',
        'product_id' => $productId,
        'template_id' => $templateId,
        'assigned_at' => date('Y-m-d H:i:s')
    ]),
    'current_template_id' => $templateId,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$deviceId]);

// Log device action
$db->insert('device_logs', [
    'device_id' => $deviceId,
    'action' => 'send',
    'content_type' => 'product',
    'content_id' => $productId,
    'status' => 'pending',
    'request_data' => json_encode([
        'product_id' => $productId,
        'template_id' => $templateId
    ])
]);

// Şablon atandıysa render cache job oluştur
$renderJobCreated = false;
if ($templateId) {
    require_once BASE_PATH . '/services/RenderCacheService.php';
    $cacheService = new RenderCacheService();

    // Render job oluştur
    $jobId = $cacheService->createRenderJob([
        'product_id' => $productId,
        'template_id' => $templateId,
        'company_id' => $companyId,
        'job_type' => 'assign',
        'source' => 'assign_label',
        'priority' => 'high',
        'created_by' => $user['id']
    ]);
    $renderJobCreated = !empty($jobId);

    if ($renderJobCreated) {
        Logger::info('Assign-label: Render job created', [
            'product_id' => $productId,
            'template_id' => $templateId,
            'job_id' => $jobId
        ]);
    }
}

Response::success([
    'product' => $product,
    'device' => $device,
    'template_id' => $templateId,
    'render_job_created' => $renderJobCreated
], 'Etiket basariyla atandi');
