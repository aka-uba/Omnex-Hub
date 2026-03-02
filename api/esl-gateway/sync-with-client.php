<?php
/**
 * ESL Device Sync with Client ID API
 *
 * Client ID ile sync yapar (APK'nın yöntemini taklit eder).
 *
 * POST /api/esl-gateway/sync-with-client
 * {
 *   "device_ip": "192.168.1.173",
 *   "client_id": "2051F54F507F",
 *   "demo_type": "strawberry"
 * }
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Request body
$request = new Request();
$deviceIp = $request->input('device_ip');
$clientId = $request->input('client_id', '2051F54F507F');
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
    
    if (!$result['success']) {
        Response::error($result['error'] ?? 'Sync failed', 500);
    }
    
    // Client ID ile tetikleme dene
    sleep(1);
    
    $triggerEndpoints = [
        "/notify?client_id={$clientId}",
        "/execute?client_id={$clientId}",
        "/refresh?client_id={$clientId}"
    ];
    
    $triggered = false;
    foreach ($triggerEndpoints as $endpoint) {
        $url = "http://{$deviceIp}{$endpoint}";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 2,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['client_id' => $clientId]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json']
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($response && $httpCode === 200) {
            $triggered = true;
            break;
        }
    }
    
    // Upload sırasında client_id header'ı ekle
    $taskContent = file_get_contents(BASE_PATH . '/tasarımlar/cihazlar/demo_task.json');
    $uploadUrl = "http://{$deviceIp}/upload?file_path=files/task/task.json&client_id=" . urlencode($clientId);
    
    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $taskContent,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Client-ID: ' . $clientId
        ]
    ]);
    
    $uploadResponse = curl_exec($ch);
    $uploadHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    Response::success([
        'message' => 'Sync completed with client ID',
        'device_ip' => $deviceIp,
        'client_id' => $clientId,
        'demo_type' => $demoType,
        'task_md5' => $result['task_md5'] ?? null,
        'task_size' => $result['task_size'] ?? 0,
        'trigger_attempted' => true,
        'upload_with_client_id' => ($uploadHttpCode === 200)
    ]);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































