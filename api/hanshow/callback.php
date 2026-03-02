<?php
/**
 * Hanshow ESL-Working Async Callback Handler
 *
 * POST /api/hanshow/callback
 *
 * ESL-Working asenkron islem sonuclarini bu endpoint'e gonderir.
 * Auth gerektirmez (ESL-Working'den gelir).
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

// ESL-Working callback'leri icin auth bypass
$data = json_decode(file_get_contents('php://input'), true) ?? [];

if (empty($data)) {
    $data = $_POST;
}

// Log callback
$logFile = defined('BASE_PATH') ? BASE_PATH . '/storage/logs/hanshow_callback.log' : __DIR__ . '/../../storage/logs/hanshow_callback.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$logEntry = date('Y-m-d H:i:s') . ' - ' . json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL;
file_put_contents($logFile, $logEntry, FILE_APPEND);

if (empty($data)) {
    Response::badRequest('Bos veri');
}

try {
    $gateway = new HanshowGateway();
    $result = $gateway->processCallback($data);

    if ($result['success']) {
        // Basarili callback - Hanshow 200 OK bekler
        Response::success([
            'received' => true,
            'sid' => $data['sid'] ?? '',
            'status' => $result['status']
        ]);
    } else {
        Response::error($result['error'] ?? 'Callback isleme hatasi');
    }
} catch (Exception $e) {
    // Hata durumunda da 200 don (Hanshow retry yapmasin)
    Response::success([
        'received' => true,
        'error' => $e->getMessage()
    ]);
}
