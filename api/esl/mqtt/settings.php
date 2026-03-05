<?php
/**
 * MQTT Settings API - Get
 *
 * GET /api/esl/mqtt/settings
 * Firmanin MQTT broker ayarlarini getirir.
 * User Auth required.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "broker_url": "mqtt.example.com",
 *     "broker_port": 1883,
 *     "use_tls": false,
 *     "username": "user",
 *     "topic_prefix": "omnex/esl",
 *     "app_id": "omnex_abc123",
 *     "content_server_url": "http://...",
 *     "report_server_url": "http://...",
 *     "status": "active",
 *     "last_connected": "2026-02-22 12:00:00"
 *   }
 * }
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array(strtolower((string)($user['role'] ?? '')), ['superadmin', 'admin'], true)) {
    Response::forbidden('MQTT settings require admin role');
}

$companyId = Auth::getActiveCompanyId();

$publicBaseUrl = rtrim((string)(defined('APP_URL') ? APP_URL : ''), '/');
if ($publicBaseUrl !== '') {
    $publicBaseUrl = preg_replace('#/api$#', '', $publicBaseUrl);
}
if ($publicBaseUrl === '') {
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $scheme = (!empty($forwardedProto))
        ? trim(explode(',', $forwardedProto)[0])
        : ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? '');
    $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $scriptDir = str_replace('\\', '/', dirname($scriptName));
    $basePath = preg_replace('#/api$#', '', $scriptDir);
    if ($basePath === '/' || $basePath === '.' || $basePath === '\\') {
        $basePath = '';
    }
    if ($host !== '') {
        $publicBaseUrl = $scheme . '://' . $host . $basePath;
    }
}
$defaultContentUrl = $publicBaseUrl !== '' ? ($publicBaseUrl . '/api/esl/mqtt/content') : '';
$defaultReportUrl = $publicBaseUrl !== '' ? ($publicBaseUrl . '/api/esl/mqtt/report') : '';
$isLocalLikeHost = static function (string $host): bool {
    $host = strtolower(trim($host));
    if ($host === '' || $host === 'localhost' || $host === '127.0.0.1' || $host === '::1') {
        return true;
    }
    if (substr($host, -6) === '.local') {
        return true;
    }
    return false;
};

$sanitizeEndpointUrl = static function (string $url): string {
    $value = trim($url);
    if ($value === '') {
        return '';
    }

    // Guard against malformed host such as: http://l192.168.1.23/...
    $value = preg_replace('#://l((?:\d{1,3}\.){3}\d{1,3})#i', '://$1', $value);
    return $value;
};

$normalizeEndpointUrl = static function (string $url, string $fallbackUrl) use ($publicBaseUrl, $isLocalLikeHost, $sanitizeEndpointUrl): string {
    $value = $sanitizeEndpointUrl($url);
    if ($value === '') {
        return $fallbackUrl;
    }

    $parts = @parse_url($value);
    if ($parts === false) {
        return $fallbackUrl;
    }

    $host = strtolower((string)($parts['host'] ?? ''));
    if ($host === '') {
        if ($publicBaseUrl !== '' && isset($value[0]) && $value[0] === '/') {
            return rtrim($publicBaseUrl, '/') . $value;
        }
        return $fallbackUrl;
    }

    if ($isLocalLikeHost($host)) {
        return $fallbackUrl;
    }

    return $value;
};

// MQTT ayarlarini getir
$settings = $db->fetch(
    "SELECT * FROM mqtt_settings WHERE company_id = ?",
    [$companyId]
);

if (!$settings) {
    // Ayar yoksa bos sema don (frontend formunu doldurabilsin)
    Response::success([
        'configured' => false,
        'broker_url' => '',
        'broker_port' => 1883,
        'use_tls' => false,
        'username' => '',
        'password' => '',
        'topic_prefix' => 'omnex/esl',
        'provider' => 'mosquitto',
        'app_id' => 'omnex_' . substr(md5($companyId), 0, 8),
        'app_secret' => '',
        'app_secret_plain' => '',
        'content_server_url' => $defaultContentUrl,
        'report_server_url' => $defaultReportUrl,
        'status' => 'active',
        'last_connected' => null
    ]);
    return;
}

// MQTT modunda olan cihaz sayisi
$mqttDeviceCount = $db->fetchColumn(
    "SELECT COUNT(*) FROM devices WHERE company_id = ? AND communication_mode = 'mqtt'",
    [$companyId]
);

// Son 24 saatteki heartbeat sayisi
$recentHeartbeats = $db->fetchColumn(
    "SELECT COUNT(*) FROM device_heartbeats dh
       JOIN devices d ON dh.device_id = d.id
       WHERE d.company_id = ? AND d.communication_mode = 'mqtt'
         AND dh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'",
    [$companyId]
);

$contentUrl = $sanitizeEndpointUrl((string)($settings['content_server_url'] ?? ''));
$reportUrl = $sanitizeEndpointUrl((string)($settings['report_server_url'] ?? ''));
$appId = trim((string)($settings['app_id'] ?? ''));
$appSecret = trim((string)($settings['app_secret'] ?? ''));
$updates = [];

if ($defaultContentUrl !== '' || $contentUrl !== '') {
    $normalizedContentUrl = $normalizeEndpointUrl($contentUrl, $defaultContentUrl ?: $contentUrl);
    if ($normalizedContentUrl !== $contentUrl) {
        $contentUrl = $normalizedContentUrl;
    }
}
if ($contentUrl !== (string)($settings['content_server_url'] ?? '')) {
    $updates['content_server_url'] = $contentUrl;
}

if ($defaultReportUrl !== '' || $reportUrl !== '') {
    $normalizedReportUrl = $normalizeEndpointUrl($reportUrl, $defaultReportUrl ?: $reportUrl);
    if ($normalizedReportUrl !== $reportUrl) {
        $reportUrl = $normalizedReportUrl;
    }
}
if ($reportUrl !== (string)($settings['report_server_url'] ?? '')) {
    $updates['report_server_url'] = $reportUrl;
}
if ($appId === '') {
    $appId = 'omnex_' . substr(md5($companyId), 0, 8);
    $updates['app_id'] = $appId;
}
if ($appSecret === '') {
    $appSecret = bin2hex(random_bytes(16));
    $updates['app_secret'] = $appSecret;
}

if (!empty($updates)) {
    $updates['updated_at'] = date('Y-m-d H:i:s');
    $db->update('mqtt_settings', $updates, 'id = ?', [$settings['id']]);
}

$registerUrl = '';
if ($contentUrl !== '') {
    $registerUrl = preg_replace('#/content/?$#', '/register', $contentUrl);
}

Response::success([
    'configured' => true,
    'id' => $settings['id'],
    'broker_url' => $settings['broker_url'],
    'broker_port' => (int)$settings['broker_port'],
    'use_tls' => (bool)$settings['use_tls'],
    'username' => $settings['username'],
    'password' => $settings['password'] ? '********' : '',  // Sifre maskeleme
    'topic_prefix' => $settings['topic_prefix'],
    'provider' => $settings['provider'],
    'app_id' => $appId,
    'app_secret' => $appSecret ? '********' : '',
    'app_secret_plain' => '',
    'content_server_url' => $contentUrl,
    'report_server_url' => $reportUrl,
    'register_url' => $registerUrl,
    'status' => $settings['status'],
    'last_connected' => $settings['last_connected'],
    'created_at' => $settings['created_at'],
    'updated_at' => $settings['updated_at'],
    'stats' => [
        'mqtt_device_count' => (int)$mqttDeviceCount,
        'recent_heartbeats_24h' => (int)$recentHeartbeats
    ]
]);
