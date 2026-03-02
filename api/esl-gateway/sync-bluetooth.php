<?php
/**
 * ESL Device Sync via Bluetooth API
 *
 * WiFi + Bluetooth kombinasyonu ile sync yapar.
 *
 * POST /api/esl-gateway/sync-bluetooth
 * {
 *   "device_ip": "192.168.1.173",
 *   "bluetooth_name": "@B2A401A977",
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
$bluetoothName = $request->input('bluetooth_name', '@B2A401A977');
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
    
    // Demo ürün bilgisi oluştur
    $demoAssets = [
        'strawberry' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Strawberry.png',
            'name' => 'Kırmızı Çilek',
            'price' => '18.99',
            'unit' => 'TL/kg'
        ],
        'apple' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Apple.png',
            'name' => 'Kırmızı Elma',
            'price' => '24.50',
            'unit' => 'TL/kg'
        ],
        'lemon' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Lemon.png',
            'name' => 'Limon',
            'price' => '12.99',
            'unit' => 'TL/kg'
        ],
        'cherry' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Cherry.png',
            'name' => 'Kiraz',
            'price' => '35.00',
            'unit' => 'TL/kg'
        ]
    ];

    if (!isset($demoAssets[$demoType])) {
        Response::error('Invalid demo type', 400);
    }

    $demo = $demoAssets[$demoType];
    $imagePath = $demo['image'];

    if (!file_exists($imagePath)) {
        Response::error('Demo image not found: ' . $imagePath, 404);
    }

    $product = [
        'id' => 'demo_' . $demoType,
        'name' => $demo['name'],
        'current_price' => $demo['price'],
        'image_path' => $imagePath
    ];

    // WiFi + Bluetooth sync yap
    $result = $gateway->syncWiFiAndBluetooth(
        $deviceIp,
        $bluetoothName,
        $product,
        ['width' => 800, 'height' => 1280],
        $clientId
    );
    
    if ($result['success']) {
        Response::success([
            'message' => 'Sync completed via WiFi + Bluetooth',
            'device_ip' => $deviceIp,
            'bluetooth_name' => $bluetoothName,
            'client_id' => $clientId,
            'demo_type' => $demoType,
            'wifi_sync' => $result['wifi_sync'],
            'bluetooth_info' => $result['bluetooth_info'],
            'bluetooth_trigger' => $result['bluetooth_trigger']
        ]);
    } else {
        Response::error($result['error'] ?? 'Sync failed', 500);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































