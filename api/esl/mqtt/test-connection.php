<?php
/**
 * MQTT Connection Test API
 *
 * POST /api/esl/mqtt/test
 * MQTT broker baglantisini test eder (fsockopen).
 * User Auth required (Admin+).
 *
 * Request Body (opsiyonel - ayarlar DB'den de okunabilir):
 * {
 *   "broker_url": "mqtt.example.com",
 *   "broker_port": 1883
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "connected": true,
 *     "host": "mqtt.example.com",
 *     "port": 1883,
 *     "response_time": 45.2
 *   }
 * }
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Admin veya SuperAdmin kontrolu
if (!in_array(strtolower($user['role'] ?? ''), ['superadmin', 'admin'])) {
    Response::forbidden('Bu islem icin yonetici yetkisi gerekli');
}

$companyId = Auth::getActiveCompanyId();
$body = $request->body();

require_once BASE_PATH . '/services/MqttBrokerService.php';
$mqttService = new MqttBrokerService();

// Body'de host/port varsa dogrudan test et (kaydetmeden once test)
$brokerUrl = trim($body['broker_url'] ?? '');
$brokerPort = (int)($body['broker_port'] ?? 0);

if (!empty($brokerUrl)) {
    // Dogrudan test (DB'den degil, kullanicinin girdigi degerlerle)
    $host = $brokerUrl;
    $parsed = parse_url($host);
    $host = $parsed['host'] ?? $host;
    $port = $brokerPort ?: 1883;

    $startTime = microtime(true);
    $errno = 0;
    $errstr = '';
    // Suppress fsockopen warning (connection refused, timeout, etc.)
    set_error_handler(function() {}, E_WARNING);
    $connection = fsockopen($host, $port, $errno, $errstr, 5);
    restore_error_handler();
    $responseTime = round((microtime(true) - $startTime) * 1000, 2);

    if ($connection) {
        fclose($connection);

        Response::success([
            'connected' => true,
            'message' => 'MQTT broker baglantisi basarili',
            'host' => $host,
            'port' => $port,
            'response_time' => $responseTime
        ]);
    } else {
        Response::success([
            'connected' => false,
            'message' => "Baglanti basarisiz: {$errstr} (#{$errno})",
            'host' => $host,
            'port' => $port
        ]);
    }
} else {
    // DB'deki ayarlarla test (status filtresi olmadan, test icin tüm kayitlar gecerli)
    $settings = $db->fetch(
        "SELECT * FROM mqtt_settings WHERE company_id = ?",
        [$companyId]
    );

    if (!$settings || empty($settings['broker_url'])) {
        Response::success([
            'connected' => false,
            'message' => 'MQTT ayarlari henuz yapilandirilmamis. Lutfen broker URL girin ve kaydedin.'
        ]);
        return;
    }

    $host = $settings['broker_url'];
    $parsed = parse_url($host);
    $host = $parsed['host'] ?? $host;
    $port = (int)($settings['broker_port'] ?? 1883);

    $startTime = microtime(true);
    $errno = 0;
    $errstr = '';
    set_error_handler(function() {}, E_WARNING);
    $connection = fsockopen($host, $port, $errno, $errstr, 5);
    restore_error_handler();
    $responseTime = round((microtime(true) - $startTime) * 1000, 2);

    if ($connection) {
        fclose($connection);

        // last_connected guncelle
        $db->update('mqtt_settings', [
            'last_connected' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'company_id = ?', [$companyId]);

        Response::success([
            'connected' => true,
            'message' => 'MQTT broker baglantisi basarili',
            'host' => $host,
            'port' => $port,
            'response_time' => $responseTime
        ]);
    } else {
        Response::success([
            'connected' => false,
            'message' => "Baglanti basarisiz: {$errstr} (#{$errno})",
            'host' => $host,
            'port' => $port
        ]);
    }
}
