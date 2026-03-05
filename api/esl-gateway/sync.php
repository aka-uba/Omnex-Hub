<?php
/**
 * ESL Device Sync API
 *
 * Ürün bilgisini cihaza senkronize eder.
 *
 * POST /api/esl-gateway/sync
 * {
 *   "device_ip": "192.168.1.173",
 *   "product_id": "uuid",
 *   "template": { ... }  // opsiyonel
 * }
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Router auth middleware ile gelmedigi durumlar icin fallback
$request = $request ?? new Request();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Request body
$deviceIp = $request->input('device_ip');
$productId = $request->input('product_id');
$template = $request->input('template', []);

if (!$deviceIp) {
    Response::error('device_ip is required', 400);
}

if (!$productId) {
    Response::error('product_id is required', 400);
}

// IP formatı kontrolü
if (!filter_var($deviceIp, FILTER_VALIDATE_IP)) {
    Response::error('Invalid IP address format', 400);
}

try {
    $db = Database::getInstance();

    // Ürünü getir
    $product = $db->fetch(
        "SELECT * FROM products WHERE id = ? AND company_id = ?",
        [$productId, $user['company_id']]
    );

    if (!$product) {
        Response::notFound('Product not found');
    }

    // Gateway ile senkronize et
    $gateway = new PavoDisplayGateway();
    $result = $gateway->syncProduct($deviceIp, $product, $template);

    if ($result['success']) {
        // Audit log
        $db->insert('audit_logs', [
            'id' => $db->generateUuid(),
            'company_id' => $user['company_id'],
            'user_id' => $user['id'],
            'action' => 'esl_sync',
            'entity_type' => 'product',
            'entity_id' => $productId,
            'new_values' => json_encode([
                'device_ip' => $deviceIp,
                'product_name' => $product['name']
            ]),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        Response::success($result);
    } else {
        Response::error($result['error'] ?? 'Sync failed', 500);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
