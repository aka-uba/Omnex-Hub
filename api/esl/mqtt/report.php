<?php
/**
 * MQTT ESL Device Status Report API (PavoDisplay /openapi/reportinfo uyumlu)
 *
 * POST /api/esl/mqtt/report
 * PavoDisplay cihazı periyodik olarak durum raporu gönderir.
 *
 * PavoDisplay Request Body (form-urlencoded):
 *   appid=xxx&data={"clientid":"2051F54F5059","version":"V3.36","name_bluetooth":"@B2A301AB37","push_id":0}&ts=123&sign=xxx
 *
 * Eski format da desteklenir (geriye uyumluluk):
 *   clientId=xxx&battery=85&firmware=V3.36...
 *
 * Response (PavoDisplay format):
 * {
 *   "State": "Done",
 *   "Message": "Success",
 *   "Number": "",
 *   "Data": "null",
 *   "Level": 0,
 *   "ErrorColumn": null
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
if (empty($body) || (!isset($body['clientId']) && !isset($body['clientid']) && !isset($body['data']))) {
    $body = array_merge($_GET, $body ?: []);
}

// Debug log
error_log("[MQTT report] method={$_SERVER['REQUEST_METHOD']} rawInput=" . substr($rawInput, 0, 500)
    . " body=" . json_encode($body)
    . " contentType=" . ($_SERVER['CONTENT_TYPE'] ?? 'none'));

// PavoDisplay reportinfo formati: data alan JSON string icerir
// data={"clientid":"2051F54F5059","version":"V3.36","name_bluetooth":"@B2A301AB37","push_id":0}
$dataStr = $body['data'] ?? null;
$deviceData = null;
if ($dataStr && is_string($dataStr)) {
    $deviceData = json_decode($dataStr, true);
}

// clientId - PavoDisplay 'data' alanindaki 'clientid' veya ust seviye 'sn'/'clientId'
$clientId = null;
if ($deviceData && isset($deviceData['clientid'])) {
    $clientId = $deviceData['clientid'];
}
if (!$clientId) {
    $clientId = $body['clientId'] ?? $body['clientid'] ?? $body['sn'] ?? null;
}

$appId = $body['appId'] ?? $body['appid'] ?? '';
$sign = $body['sign'] ?? '';
if (empty($appId)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'appId required',
        'Number' => 'MISSING_PARAM',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 400);
}

if (empty($clientId)) {
    // PavoDisplay formati: State:Fail
    Response::json([
        'State' => 'Fail',
        'Message' => 'clientId required',
        'Number' => 'MISSING_PARAM',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 400);
}

require_once BASE_PATH . '/services/MqttBrokerService.php';
$mqttService = new MqttBrokerService();
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;

// Sign doğrulama (appId ile firma bul)
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
                $verified = $mqttService->verifySignByAppId($sign, $body, $appId);
                $strictAuthPassed = (bool)$verified;
            }
        }
    }
}

if (!$strictAuthPassed) {
    $settings = $mqttService->resolveLegacySettingsByDevice($clientId, $remoteIp);
    if ($settings) {
        error_log("[MQTT report] legacy auth fallback appid={$appId} clientId={$clientId} ip={$remoteIp}");
    }
}

if (!$settings) {
    Response::json([
        'State' => 'Fail',
        'Message' => empty($appId) ? 'appId required' : 'Invalid appId/sign',
        'Number' => empty($appId) ? 'MISSING_PARAM' : 'AUTH_FAILED',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], empty($appId) ? 400 : 403);
}

// Cihazı bul
$device = $mqttService->findDeviceByClientId($clientId, $settings['company_id']);

if (!$device) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device not found',
        'Number' => 'NOT_FOUND',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 404);
}

$deviceId = $device['id'];
$companyId = $device['company_id'];
if ($companyId !== ($settings['company_id'] ?? null)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device company mismatch',
        'Number' => 'AUTH_FAILED',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 403);
}

// PavoDisplay data alanindan bilgileri cek
$firmware = null;
$bluetoothName = null;
$pushId = null;
$contentVersion = null;

if ($deviceData) {
    $firmware = $deviceData['version'] ?? null;
    $bluetoothName = $deviceData['name_bluetooth'] ?? null;
    $pushId = $deviceData['push_id'] ?? null;
}

// Eski format desteği (geriye uyumluluk)
$batteryLevel = isset($body['battery']) ? (int)$body['battery'] : null;
$signalStrength = isset($body['wifi_signal']) ? (int)$body['wifi_signal'] : null;
$freeSpace = $body['free_space'] ?? $body['free-space'] ?? null;
if (!$firmware) $firmware = $body['firmware'] ?? $body['version'] ?? null;
$uptime = isset($body['uptime']) ? (int)$body['uptime'] : null;
$temperature = isset($body['temperature']) ? (float)$body['temperature'] : null;
if ($pushId === null) $pushId = $body['push_id'] ?? null;
if (!$contentVersion) $contentVersion = $body['content_version'] ?? null;

// Metadata güncelle
$metadata = json_decode($device['metadata'] ?? '{}', true) ?: [];
if ($freeSpace) $metadata['free_space'] = $freeSpace;
if ($firmware) $metadata['firmware'] = $firmware;
if ($bluetoothName) $metadata['name_bluetooth'] = $bluetoothName;
if ($uptime !== null) $metadata['uptime'] = $uptime;
if ($temperature !== null) $metadata['temperature'] = $temperature;
if ($pushId !== null) $metadata['last_push_id'] = $pushId;
if ($contentVersion) $metadata['content_version'] = $contentVersion;
$metadata['last_report'] = date('Y-m-d H:i:s');

// devices tablosunu güncelle
$updateData = [
    'status' => 'online',
    'last_online' => date('Y-m-d H:i:s'),
    'last_seen' => date('Y-m-d H:i:s'),
    'metadata' => json_encode($metadata),
    'updated_at' => date('Y-m-d H:i:s')
];

if ($batteryLevel !== null) {
    $updateData['battery_level'] = $batteryLevel;
}
if ($signalStrength !== null) {
    $updateData['signal_strength'] = $signalStrength;
}
if ($firmware && $firmware !== $device['firmware_version']) {
    $updateData['firmware_version'] = $firmware;
}

$db->update('devices', $updateData, 'id = ?', [$deviceId]);

// Heartbeat kaydı oluştur
try {
    $db->insert('device_heartbeats', [
        'id' => $db->generateUuid(),
        'device_id' => $deviceId,
        'status' => 'online',
        'battery_level' => $batteryLevel,
        'signal_strength' => $signalStrength,
        'storage_free' => $freeSpace ? (int)preg_replace('/[^0-9]/', '', $freeSpace) : null,
        'temperature' => $temperature,
        'uptime' => $uptime,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'metadata' => json_encode([
            'push_id' => $pushId,
            'content_version' => $contentVersion,
            'name_bluetooth' => $bluetoothName,
            'communication_mode' => 'mqtt'
        ]),
        'created_at' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    error_log('Heartbeat insert failed: ' . $e->getMessage());
}

// Komut fallback: publish kacmissa cihaz report yanitinda komutu alabilsin
$responseData = 'null';
try {
    $pendingCommands = $mqttService->getPendingCommands($deviceId, 10);
    if (!empty($pendingCommands)) {
        $normalizedClientId = strtoupper(str_replace([':', '-', '.'], '', (string)$clientId));
        $commandsPayload = [];

        foreach ($pendingCommands as $cmd) {
            $params = is_array($cmd['parameters'] ?? null) ? $cmd['parameters'] : [];
            $action = (string)($params['action'] ?? $cmd['command'] ?? 'updatelabel');
            $pushValue = $params['push_id'] ?? time();

            $commandsPayload[] = [
                'action' => $action,
                'push_id' => (int)$pushValue,
                'clientid' => $normalizedClientId,
                'data' => $params
            ];
        }

        $responseData = json_encode([
            'commands' => $commandsPayload,
            'commandCount' => count($commandsPayload)
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
} catch (Exception $e) {
    error_log('[MQTT report] command fetch failed: ' . $e->getMessage());
}

// PavoDisplay resmi response formati
Response::json([
    'State' => 'Done',
    'Message' => 'Success',
    'Number' => '',
    'Data' => $responseData,
    'Level' => 0,
    'ErrorColumn' => null
]);
