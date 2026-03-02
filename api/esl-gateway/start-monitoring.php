<?php
/**
 * Start HTTP Monitoring API
 * 
 * HTTP trafiği izlemeyi başlatır (basit versiyon)
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

$request = new Request();
$deviceIp = $request->input('device_ip', '192.168.1.173');

try {
    $gateway = new PavoDisplayGateway();
    
    // Cihazın mevcut durumunu al
    $filesToCheck = [
        'files/task/task.json',
        'files/task/JohnnieWalker.mp4',
        'files/task/Cherry_Vertical_HalfScreen.mp4',
        'files/task/Strawberry_Vertical_HalfScreen.mp4',
        'files/task/Apple_Vertical_HalfScreen.mp4',
        'files/task/Lemon_Vertical_HalfScreen.mp4'
    ];
    
    $currentState = [];
    foreach($filesToCheck as $file) {
        $check = $gateway->checkFile($deviceIp, $file);
        if ($check['exists']) {
            $currentState[$file] = [
                'md5' => $check['md5'],
                'size' => $check['length'],
                'timestamp' => time()
            ];
        }
    }
    
    Response::success([
        'message' => 'Monitoring başlatıldı',
        'device_ip' => $deviceIp,
        'baseline_state' => $currentState,
        'instructions' => [
            '1. Bu endpoint\'i periyodik olarak çağırın (her 500ms)',
            '2. APK\'dan sync yapın',
            '3. Değişiklikleri yakalayın'
        ]
    ]);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}











































