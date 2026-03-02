<?php
/**
 * ESL Device Demo Sync API
 *
 * Demo içeriklerle cihaza sync testi yapar.
 *
 * POST /api/esl-gateway/sync-demo
 * {
 *   "device_ip": "192.168.1.173",
 *   "demo_type": "strawberry" // strawberry, apple, lemon, cherry
 * }
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Request body
$request = new Request();
$deviceIp = $request->input('device_ip');
$demoType = $request->input('demo_type', 'strawberry');

if (!$deviceIp) {
    Response::error('device_ip is required', 400);
}

// IP formatı kontrolü
if (!filter_var($deviceIp, FILTER_VALIDATE_IP)) {
    Response::error('Invalid IP address format', 400);
}

try {
    $gateway = new PavoDisplayGateway();
    
    // Önce cihazın online olduğunu kontrol et
    $pingResult = $gateway->ping($deviceIp);
    if (!$pingResult['online']) {
        Response::error('Device is offline or unreachable', 503);
    }
    
    // Demo sync yap
    $result = $gateway->syncDemo($deviceIp, $demoType);
    
    if ($result['success']) {
        Response::success([
            'message' => 'Demo content synced successfully',
            'device_ip' => $deviceIp,
            'demo_type' => $demoType,
            'task_md5' => $result['task_md5'] ?? null,
            'task_size' => $result['task_size'] ?? 0
        ]);
    } else {
        Response::error($result['error'] ?? 'Sync failed', 500);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































