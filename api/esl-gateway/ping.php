<?php
/**
 * ESL Device Ping API
 *
 * Cihaza ping atarak online durumunu kontrol eder.
 *
 * GET /api/esl-gateway/ping?ip=192.168.1.173
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// IP parametresi zorunlu
$ip = $_GET['ip'] ?? null;

if (!$ip) {
    Response::error('IP address is required', 400);
}

// IP formatı kontrolü
if (!filter_var($ip, FILTER_VALIDATE_IP)) {
    Response::error('Invalid IP address format', 400);
}

try {
    $gateway = new PavoDisplayGateway();
    $result = $gateway->ping($ip);

    Response::success($result);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
