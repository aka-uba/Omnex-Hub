<?php
/**
 * Demo görsel gönderim testi
 * GET /api/test-send-demo?ip=192.168.1.173&type=strawberry
 */

require_once __DIR__ . '/../config.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

header('Content-Type: application/json');

$ip = $_GET['ip'] ?? '192.168.1.173';
$demoType = $_GET['type'] ?? 'strawberry';

$gateway = new PavoDisplayGateway();

// Önce ping testi
$pingResult = $gateway->ping($ip);
if (!$pingResult['online']) {
    echo json_encode([
        'success' => false,
        'error' => 'Device not reachable',
        'ip' => $ip,
        'ping_result' => $pingResult
    ]);
    exit;
}

// Demo görselini gönder
$result = $gateway->syncDemo($ip, $demoType);

echo json_encode([
    'success' => $result['success'],
    'ip' => $ip,
    'demo_type' => $demoType,
    'result' => $result
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
