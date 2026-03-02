<?php
/**
 * ESL Device File Check API
 *
 * Cihazdaki dosyayı kontrol eder.
 *
 * GET /api/esl-gateway/check?ip=192.168.1.173&file_path=files/task/task.json
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Parametreler
$deviceIp = $_GET['ip'] ?? null;
$filePath = $_GET['file_path'] ?? null;

if (!$deviceIp) {
    Response::error('ip parameter is required', 400);
}

if (!$filePath) {
    Response::error('file_path parameter is required', 400);
}

// IP formatı kontrolü
if (!filter_var($deviceIp, FILTER_VALIDATE_IP)) {
    Response::error('Invalid IP address format', 400);
}

try {
    $gateway = new PavoDisplayGateway();
    
    // Dosya kontrolü
    $result = $gateway->checkFile($deviceIp, $filePath);
    
    if ($result['exists']) {
        Response::success([
            'exists' => true,
            'md5' => $result['md5'],
            'length' => $result['length'],
            'file_path' => $filePath
        ]);
    } else {
        Response::success([
            'exists' => false,
            'error' => $result['error'] ?? 'File not found',
            'file_path' => $filePath
        ]);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































