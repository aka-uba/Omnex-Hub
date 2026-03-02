<?php
/**
 * ESL HTTP Device Report Info API
 *
 * POST /api/esl/http/report-info
 *
 * HTTP modundaki ESL cihazları bu endpoint ile bilgilerini raporlar.
 * PavoDisplay firmware'inin info-server endpoint'ine karşılık gelir.
 *
 * Cihaz İsteği (JSON body):
 * {
 *   "appid": "xxx",
 *   "clientid": "MAC_ADDRESS",
 *   "sign": "MD5_SIGN",
 *   "ts": 1234567890123,
 *   "DeviceInfo": {
 *     "model": "PD1010-II",
 *     "firmware": "V3.36",
 *     "screen_width": 800,
 *     "screen_height": 1280,
 *     "battery": 100,
 *     "wifi_signal": -45,
 *     "free_storage": 1024,
 *     "uptime": 3600,
 *     "ip": "192.168.1.31"
 *   }
 * }
 *
 * Yanıt:
 * {
 *   "State": "Done",
 *   "Message": "Info received",
 *   "Data": null
 * }
 */

require_once dirname(dirname(dirname(__DIR__))) . '/config.php';
require_once BASE_PATH . '/services/EslSignValidator.php';

$db = Database::getInstance();
$validator = new EslSignValidator();

// --- Parametreleri al (GET + POST body) ---
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$clientId = $body['clientId'] ?? $body['clientid'] ?? $body['sn'] ?? $_GET['clientid'] ?? $_GET['clientId'] ?? null;
$appId    = $body['appId'] ?? $body['appid'] ?? $_GET['appid'] ?? '';
$sign     = $body['sign'] ?? $_GET['sign'] ?? '';
$ts       = $body['ts'] ?? $_GET['ts'] ?? null;

if (empty($clientId)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'clientId required',
        'Number' => 'MISSING_PARAM',
        'Data' => null
    ], 400);
}

// --- Kimlik Doğrulama ---
$settings = null;

if (!empty($appId)) {
    // Sign doğrulama için GET params veya body params kullan
    $signParams = !empty($_GET) ? $_GET : $body;
    $settings = $validator->authenticate($appId, $sign, $signParams);
}

// Legacy fallback
if (!$settings) {
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;
    $settings = $validator->authenticateLegacy($clientId, $remoteIp);
}

if (!$settings) {
    Response::json([
        'State' => 'Fail',
        'Message' => empty($appId) ? 'appId required' : 'Invalid appId/sign',
        'Number' => empty($appId) ? 'MISSING_PARAM' : 'AUTH_FAILED',
        'Data' => null
    ], empty($appId) ? 400 : 403);
}

$companyId = $settings['company_id'];

// --- Cihazı Bul ---
$device = $validator->findDeviceByClientId($clientId, $companyId);

if (!$device) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device not found',
        'Number' => 'NOT_FOUND',
        'Data' => null
    ], 404);
}

$deviceId = $device['id'];

// --- Cihaz Bilgilerini İşle ---
$deviceInfo = $body['DeviceInfo'] ?? $body['deviceInfo'] ?? $body['device_info'] ?? [];

$info = [
    'ip' => $deviceInfo['ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
    'version' => $deviceInfo['firmware'] ?? $deviceInfo['version'] ?? null,
    'battery' => $deviceInfo['battery'] ?? $deviceInfo['battery_level'] ?? null,
    'wifi_signal' => $deviceInfo['wifi_signal'] ?? $deviceInfo['rssi'] ?? null,
    'free_storage' => $deviceInfo['free_storage'] ?? $deviceInfo['freeStorage'] ?? null,
    'uptime' => $deviceInfo['uptime'] ?? null
];

// Cihaz durumunu güncelle
$validator->updateDeviceHeartbeat($deviceId, $info);

// Ekran boyutunu güncelle (ilk kayıtta veya değiştiğinde)
$updateFields = [];
if (!empty($deviceInfo['screen_width']) && (int)$deviceInfo['screen_width'] > 0) {
    $updateFields['screen_width'] = (int)$deviceInfo['screen_width'];
}
if (!empty($deviceInfo['screen_height']) && (int)$deviceInfo['screen_height'] > 0) {
    $updateFields['screen_height'] = (int)$deviceInfo['screen_height'];
}
if (!empty($deviceInfo['model'])) {
    $updateFields['model'] = $deviceInfo['model'];
}

if (!empty($updateFields)) {
    $updateFields['updated_at'] = date('Y-m-d H:i:s');
    $db->update('devices', $updateFields, 'id = ?', [$deviceId]);
}

// Log
error_log("[ESL HTTP report-info] device={$deviceId} clientId={$clientId} ip=" . ($info['ip'] ?? 'unknown'));

Response::json([
    'State' => 'Done',
    'Message' => 'Info received',
    'Number' => '',
    'Data' => null,
    'Level' => 0,
    'ErrorColumn' => null
]);
