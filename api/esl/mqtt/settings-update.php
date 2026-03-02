<?php
/**
 * MQTT Settings API - Update
 *
 * PUT /api/esl/mqtt/settings
 * Firmanin MQTT broker ayarlarini kaydet/guncelle.
 * User Auth required (Admin+).
 *
 * Request Body:
 * {
 *   "broker_url": "mqtt.example.com",
 *   "broker_port": 1883,
 *   "use_tls": false,
 *   "username": "user",
 *   "password": "pass",
 *   "topic_prefix": "omnex/esl",
 *   "provider": "mosquitto",
 *   "app_id": "omnex_abc123",
 *   "app_secret": "secret",
 *   "content_server_url": "http://...",
 *   "report_server_url": "http://...",
 *   "status": "active"
 * }
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Admin veya SuperAdmin kontrolu
if (!in_array(strtolower($user['role'] ?? ''), ['superadmin', 'admin'])) {
    Response::forbidden('MQTT ayarlari icin yonetici yetkisi gerekli');
}

$companyId = Auth::getActiveCompanyId();
$body = $request->body();

$sanitizeEndpointUrl = static function (string $url): string {
    $value = trim($url);
    if ($value === '') {
        return '';
    }

    // Guard against malformed host such as: http://l192.168.1.23/...
    $value = preg_replace('#://l((?:\d{1,3}\.){3}\d{1,3})#i', '://$1', $value);
    return $value;
};

// Validasyon
$brokerUrl = trim($body['broker_url'] ?? '');
if (empty($brokerUrl)) {
    Response::badRequest('Broker URL gerekli');
}

$brokerPort = (int)($body['broker_port'] ?? 1883);
if ($brokerPort < 1 || $brokerPort > 65535) {
    Response::badRequest('Gecersiz port numarasi (1-65535)');
}

// Mevcut ayar var mi?
$existing = $db->fetch(
    "SELECT * FROM mqtt_settings WHERE company_id = ?",
    [$companyId]
);

$data = [
    'broker_url' => $brokerUrl,
    'broker_port' => $brokerPort,
    'use_tls' => (int)($body['use_tls'] ?? 0),
    'username' => trim($body['username'] ?? ''),
    'topic_prefix' => trim($body['topic_prefix'] ?? 'omnex/esl'),
    'provider' => trim($body['provider'] ?? 'mosquitto'),
    'app_id' => trim($body['app_id'] ?? ''),
    'content_server_url' => $sanitizeEndpointUrl((string)($body['content_server_url'] ?? '')),
    'report_server_url' => $sanitizeEndpointUrl((string)($body['report_server_url'] ?? '')),
    'status' => in_array($body['status'] ?? '', ['active', 'testing', 'inactive'])
        ? $body['status']
        : ($existing ? $existing['status'] : 'active'),
    'updated_at' => date('Y-m-d H:i:s')
];

// Sifre: sadece degistirilmisse guncelle (masked deger gelirse atla)
$password = $body['password'] ?? null;
if ($password !== null && $password !== '********' && $password !== '') {
    $data['password'] = $password;
} elseif (!$existing) {
    $data['password'] = '';
}

// AppSecret: sadece degistirilmisse guncelle
$appSecret = $body['app_secret'] ?? null;
if ($appSecret !== null && $appSecret !== '********' && $appSecret !== '') {
    $data['app_secret'] = $appSecret;
} elseif (!$existing) {
    $data['app_secret'] = '';
}

if ($existing) {
    // Guncelle
    $db->update('mqtt_settings', $data, 'company_id = ?', [$companyId]);

    Logger::audit('update', 'mqtt_settings', [
        'company_id' => $companyId,
        'broker_url' => $brokerUrl,
        'user_id' => $user['id']
    ]);

    Response::success([
        'message' => 'MQTT ayarlari guncellendi',
        'id' => $existing['id']
    ]);
} else {
    // Yeni kayit olustur
    $data['company_id'] = $companyId;
    $data['created_at'] = date('Y-m-d H:i:s');

    // Password ve app_secret yoksa bos string olarak set et
    if (!isset($data['password'])) {
        $data['password'] = '';
    }
    if (!isset($data['app_secret'])) {
        $data['app_secret'] = '';
    }

    $settingsId = $db->insert('mqtt_settings', $data);

    Logger::audit('create', 'mqtt_settings', [
        'company_id' => $companyId,
        'broker_url' => $brokerUrl,
        'user_id' => $user['id']
    ]);

    Response::success([
        'message' => 'MQTT ayarlari kaydedildi',
        'id' => $settingsId
    ], 201);
}
