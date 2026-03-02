<?php
/**
 * ESL Device Sync Like APK API
 *
 * APK'nın sync butonunun yaptığı işlemleri taklit eder.
 *
 * POST /api/esl-gateway/sync-like-apk
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
    
    // Demo ürün bilgisi oluştur (video desteği ile)
    $demoAssets = [
        'strawberry' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Strawberry.png',
            'video' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Strawberry_Vertical_HalfScreen.mp4',
            'name' => 'Kırmızı Çilek',
            'price' => '18.99',
            'unit' => 'TL/kg'
        ],
        'apple' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Apple.png',
            'video' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Apple_Vertical_HalfScreen.mp4',
            'name' => 'Kırmızı Elma',
            'price' => '24.50',
            'unit' => 'TL/kg'
        ],
        'lemon' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Lemon.png',
            'video' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Lemon_Vertical_HalfScreen.mp4',
            'name' => 'Limon',
            'price' => '12.99',
            'unit' => 'TL/kg'
        ],
        'cherry' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Cherry.png',
            'video' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/Cherry_Vertical_HalfScreen.mp4',
            'name' => 'Kiraz',
            'price' => '35.00',
            'unit' => 'TL/kg'
        ],
        'johnny' => [
            'image' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/cocacola.png',
            'video' => BASE_PATH . '/tasarımlar/cihazlar/base (2)/assets/JohnnieWalker.mp4',
            'name' => 'Johnnie Walker',
            'price' => '299.99',
            'unit' => 'TL'
        ]
    ];

    if (!isset($demoAssets[$demoType])) {
        Response::error('Invalid demo type', 400);
    }

    $demo = $demoAssets[$demoType];
    $imagePath = $demo['image'];
    $videoPath = $demo['video'] ?? null;

    if (!file_exists($imagePath)) {
        Response::error('Demo image not found: ' . $imagePath, 404);
    }

    $product = [
        'id' => 'demo_' . $demoType,
        'name' => $demo['name'],
        'current_price' => $demo['price'],
        'image_path' => $imagePath
    ];

    // Video varsa ekle
    if ($videoPath && file_exists($videoPath)) {
        $product['video_path'] = $videoPath;
        $product['video_duration'] = 30; // Varsayılan süre
    }

    // APK'nın sync akışını taklit et
    $result = $gateway->syncLikeAPK(
        $deviceIp,
        $product,
        ['width' => 800, 'height' => 1280],
        $clientId
    );
    
    if ($result['success']) {
        Response::success([
            'message' => 'Sync completed like APK',
            'device_ip' => $deviceIp,
            'client_id' => $clientId,
            'demo_type' => $demoType,
            'upload_result' => $result['upload_result'],
            'trigger_result' => $result['trigger_result']
        ]);
    } else {
        Response::error($result['error'] ?? 'Sync failed', 500);
    }
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}

