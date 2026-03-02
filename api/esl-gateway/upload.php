<?php
/**
 * ESL Device File Upload API
 *
 * Cihaza dosya yükler.
 *
 * POST /api/esl-gateway/upload
 * {
 *   "device_ip": "192.168.1.173",
 *   "file_path": "test.json",
 *   "content": "..."
 * }
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Request body
$request = new Request();
$deviceIp = $request->input('device_ip');
$filePath = $request->input('file_path');
$content = $request->input('content');

if (!$deviceIp) {
    Response::error('device_ip is required', 400);
}

if (!$filePath) {
    Response::error('file_path is required', 400);
}

if ($content === null) {
    Response::error('content is required', 400);
}

// IP formatı kontrolü
if (!filter_var($deviceIp, FILTER_VALIDATE_IP)) {
    Response::error('Invalid IP address format', 400);
}

try {
    $gateway = new PavoDisplayGateway();
    
    // Dosya yükle
    $result = $gateway->uploadFile($deviceIp, $filePath, $content);
    
    if ($result['success']) {
        Response::success([
            'message' => 'File uploaded successfully',
            'file_path' => $result['file_path']
        ]);
    } else {
        Response::error($result['error'] ?? 'Upload failed', 500);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































