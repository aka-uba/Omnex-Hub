<?php
/**
 * MQTT ESL Device Registration API
 *
 * POST /api/esl/mqtt/register
 * Public endpoint - PavoDisplay cihazı MQTT modunda başlatıldığında çağrılır.
 *
 * Cihaz clientId ve appId ile gelir, sunucu MQTT broker bilgilerini döner.
 * Yeni cihazlar önce device_sync_requests'e eklenir (admin onayı gerekir).
 *
 * Request Body:
 * {
 *   "clientId": "2051F54F500A",    // Cihaz MAC/ID
 *   "appId": "omnex_abc123",       // Firma AppID
 *   "sign": "MD5_SIGN",           // İmza (opsiyonel)
 *   "firmware": "V3.36",          // Firmware versiyonu
 *   "model": "PD1010-II",         // Cihaz modeli
 *   "screenWidth": 800,
 *   "screenHeight": 1280
 * }
 */

require_once dirname(dirname(dirname(__DIR__))) . '/config.php';

$db = Database::getInstance();

// Request body parse (JSON body → POST form → GET query string → raw parse)
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);
if (!$body) {
    $body = $_POST;
}
// PavoDisplay bazen POST body'yi URL-encoded gonderir ama Content-Type header eksik olabilir
if (empty($body) && !empty($rawInput)) {
    parse_str($rawInput, $body);
}
// PavoDisplay bazen POST isteklerinde bile query string kullanir
if (empty($body) || (!isset($body['clientId']) && !isset($body['clientid']))) {
    $body = array_merge($_GET, $body ?: []);
}

// Debug log (gecici - cihaz isteklerini anlamak icin)
error_log("[MQTT register] method={$_SERVER['REQUEST_METHOD']} rawInput=" . substr($rawInput, 0, 500)
    . " body=" . json_encode($body)
    . " GET=" . json_encode($_GET)
    . " POST=" . json_encode($_POST)
    . " contentType=" . ($_SERVER['CONTENT_TYPE'] ?? 'none'));

$clientId = $body['clientId'] ?? $body['clientid'] ?? $body['sn'] ?? null;
$appId = $body['appId'] ?? $body['appid'] ?? '';
$sign = $body['sign'] ?? '';
$firmware = $body['firmware'] ?? $body['version'] ?? '';
$model = $body['model'] ?? 'PD1010-II';
$manufacturer = $body['manufacturer'] ?? $body['brand'] ?? '';
$screenWidth = (int)($body['screenWidth'] ?? $body['lcd_screen_width'] ?? 800);
$screenHeight = (int)($body['screenHeight'] ?? $body['lcd_screen_height'] ?? 1280);

// Manufacturer tespiti: bos ise model'den veya clientId formatindan cikar
if (empty($manufacturer)) {
    // Bilinen model-marka eslestirmeleri
    $knownBrands = [
        'PD1010' => 'PavoDisplay',
        'T240' => 'LUMEX',
        'T290' => 'LUMEX',
        'SL' => 'Sunmi',
        'NB' => 'Nebular',
    ];
    foreach ($knownBrands as $prefix => $brand) {
        if (stripos($model, $prefix) === 0) {
            $manufacturer = $brand;
            break;
        }
    }
    if (empty($manufacturer)) {
        $manufacturer = 'Unknown';
    }
}

if (empty($clientId)) {
    Response::badRequest('clientId gerekli');
}

// MqttBrokerService yükle
require_once BASE_PATH . '/services/MqttBrokerService.php';
$mqttService = new MqttBrokerService();
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;

// Once strict appId+sign dogrulamasi, sonra kayitli cihaz icin fallback
$settings = null;
$strictAuthPassed = false;

if (!empty($appId)) {
    $settings = $mqttService->getSettingsByAppId($appId);
    if ($settings) {
        $strictAuthPassed = true;
        if (!empty($settings['app_secret'])) {
            if (empty($sign)) {
                $strictAuthPassed = false;
            } else {
                $signParams = $body;
                unset($signParams['sign']);
                $expectedSign = $mqttService->calculateSign($signParams, $settings['app_secret']);
                $strictAuthPassed = hash_equals($expectedSign, strtoupper($sign));
            }
        }
    }
}

if (!$strictAuthPassed) {
    $settings = $mqttService->resolveLegacySettingsByDevice($clientId, $remoteIp);
    if ($settings) {
        error_log("[MQTT register] legacy auth fallback appid={$appId} clientId={$clientId} ip={$remoteIp}");
    }
}

if (!$settings) {
    Response::error('Geçersiz AppID veya MQTT ayarı bulunamadı', 403);
}

$companyId = $settings['company_id'];

// Cihaz mevcut mu kontrol et
$device = $mqttService->findDeviceByClientId($clientId, $companyId);

if ($device) {
    // Mevcut cihaz - MQTT bilgilerini güncelle ve broker bilgilerini dön
    $topic = $mqttService->generatePavoTopic($companyId, $clientId);

    $mqttService->setDeviceCommunicationMode(
        $device['id'],
        'mqtt',
        $clientId,
        $topic
    );

    // Cihaz bilgilerini güncelle
    $metadata = json_decode($device['metadata'] ?? '{}', true) ?: [];
    $metadata['firmware'] = $firmware ?: ($metadata['firmware'] ?? '');
    $metadata['model'] = $model;
    $metadata['last_mqtt_register'] = date('Y-m-d H:i:s');

    $db->update('devices', [
        'status' => 'online',
        'last_online' => date('Y-m-d H:i:s'),
        'last_seen' => date('Y-m-d H:i:s'),
        'firmware_version' => $firmware ?: $device['firmware_version'],
        'screen_width' => $screenWidth ?: $device['screen_width'],
        'screen_height' => $screenHeight ?: $device['screen_height'],
        'metadata' => json_encode($metadata),
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$device['id']]);

    // Broker bilgilerini getir
    $credentials = $mqttService->getDeviceCredentials($companyId);
    if (empty($credentials['success'])) {
        Response::error($credentials['error'] ?? 'MQTT broker ayarlari okunamadi', 503);
    }

    // Broker URL'den host ve port ayikla
    $brokerUrl = $credentials['broker_url'] ?? '192.168.1.23';
    $brokerPort = $credentials['broker_port'] ?? 1883;
    // mqtt://host:port formatindan sadece host'u al
    $mqttHost = preg_replace('#^(mqtt|tcp|ssl)://#i', '', $brokerUrl);
    $mqttHost = preg_replace('#:\d+$#', '', $mqttHost);

    // MQTT client_id ve topic - PavoDisplay formatinda
    $mqttClientId = 'GID_omnex@@@' . strtoupper(str_replace([':', '-', '.'], '', $clientId));
    $mqttTopic = $mqttService->generatePavoTopic($companyId, $clientId);

    // Topic'i device tablosuna da kaydet (icerik push icin lazim)
    $db->update('devices', [
        'mqtt_topic' => $mqttTopic,
        'mqtt_client_id' => $clientId
    ], 'id = ?', [$device['id']]);

    // PavoDisplay resmi API formati:
    // {"State":"Done","Message":"...","Number":"","Data":{mqtthost,mqttport,username,password,client_id,topic},"Level":0,"ErrorColumn":null}
    Response::json([
        'State' => 'Done',
        'Message' => 'Registration successful',
        'Number' => '',
        'Data' => [
            'mqtthost' => $mqttHost,
            'mqttport' => (string)$brokerPort,
            'username' => $credentials['username'] ?? '',
            'password' => $credentials['password'] ?? '',
            'client_id' => $mqttClientId,
            'topic' => $mqttTopic
        ],
        'Level' => 0,
        'ErrorColumn' => null
    ]);
} else {
    // Yeni cihaz - device_sync_requests'e ekle
    // Mevcut kayıt var mı kontrol et
    $existing = $db->fetch(
        "SELECT * FROM device_sync_requests
         WHERE company_id = ? AND serial_number = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP",
        [$companyId, $clientId]
    );

    if ($existing) {
        // Mevcut bekleyen kayıt - PavoDisplay State:Fail ile bildir
        Response::json([
            'State' => 'Fail',
            'Message' => 'Device pending approval. Sync code: ' . $existing['sync_code'],
            'Number' => 'PENDING',
            'Data' => null,
            'Level' => 0,
            'ErrorColumn' => null
        ]);
        return;
    }

    // Yeni kayıt oluştur
    $requestId = $db->generateUuid();
    $syncCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', time() + 900); // 15 dakika

    $resolution = $screenWidth && $screenHeight ? "{$screenWidth}x{$screenHeight}" : '';

    $db->insert('device_sync_requests', [
        'id' => $requestId,
        'company_id' => $companyId,
        'serial_number' => $clientId,
        'sync_code' => $syncCode,
        'firmware' => $firmware,
        'screen_type' => 'tft-lcd',
        'resolution' => $resolution,
        'manufacturer' => $manufacturer,
        'brand' => $manufacturer,
        'model' => $model,
        'screen_width' => $screenWidth ?: null,
        'screen_height' => $screenHeight ?: null,
        'mac_address' => $clientId,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'status' => 'pending',
        'expires_at' => $expiresAt,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);

    // Yeni cihaz - PavoDisplay State:Fail ile bildir (onay bekliyor)
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device registered, pending admin approval. Sync code: ' . $syncCode,
        'Number' => 'PENDING',
        'Data' => null,
        'Level' => 0,
        'ErrorColumn' => null
    ]);
}

