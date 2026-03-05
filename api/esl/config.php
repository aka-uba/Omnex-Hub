<?php
/**
 * ESL Device Configuration API
 *
 * GET /api/esl/config
 * Device Auth required: Authorization: Device <token>
 *
 * Response:
 * - refreshInterval: Content refresh interval in seconds
 * - heartbeatInterval: Heartbeat/ping interval in seconds
 * - sleepMode: Whether sleep mode is enabled
 * - sleepStart: Sleep mode start time (HH:MM)
 * - sleepEnd: Sleep mode end time (HH:MM)
 * - timezone: Device timezone
 * - displaySettings: Display-specific settings
 * - networkSettings: Network configuration
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device not authenticated');
}

$deviceId = $device['id'] ?? $device['device_id'];
$companyId = $device['company_id'];

// Get company settings
$companySettings = $db->fetch(
    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);

$eslConfig = [];
if ($companySettings && $companySettings['data']) {
    $allSettings = json_decode($companySettings['data'], true) ?: [];
    $eslConfig = $allSettings['esl_config'] ?? [];
}

// Get device-specific settings from metadata
$deviceMetadata = json_decode($device['metadata'] ?? '{}', true) ?: [];
$deviceConfig = $deviceMetadata['config'] ?? [];

// Default configuration
$defaultConfig = [
    'refreshInterval' => 300,      // 5 minutes
    'heartbeatInterval' => 60,     // 1 minute
    'sleepMode' => false,
    'sleepStart' => '22:00',
    'sleepEnd' => '06:00',
    'timezone' => 'Europe/Istanbul',
    'displayBrightness' => 100,
    'displayContrast' => 100,
    'lowBatteryThreshold' => 20,
    'criticalBatteryThreshold' => 5,
    'autoUpdate' => true,
    'debugMode' => false,
    'logLevel' => 'info',
    'networkTimeout' => 30,
    'retryAttempts' => 3,
    'retryDelay' => 5
];

// Merge configurations: default < company < device
$config = array_merge($defaultConfig, $eslConfig, $deviceConfig);

// Get device group info if in a group
// Note: device_groups table has no metadata/config column - group-level ESL config is not yet supported
if (!empty($device['group_id'])) {
    $groupInfo = $db->fetch(
        "SELECT name, description FROM device_groups WHERE id = ?",
        [$device['group_id']]
    );

    if ($groupInfo) {
        $config['group_name'] = $groupInfo['name'];
    }
}

// Add device-specific information
$config['deviceId'] = $deviceId;
$config['deviceName'] = $device['name'];
$config['deviceType'] = $device['type'];
$config['groupId'] = $device['group_id'] ?? null;
$config['groupName'] = $device['group_name'] ?? null;
$config['companyId'] = $companyId;
$config['companyName'] = $device['company_name'] ?? null;

// Add screen information
$config['screenWidth'] = $device['screen_width'] ?? null;
$config['screenHeight'] = $device['screen_height'] ?? null;
$config['orientation'] = $device['orientation'] ?? 'landscape';

// Server information
$config['serverTime'] = date('c');
$config['serverTimestamp'] = time();

// Check if there's a firmware update available
$latestFirmware = $db->fetch(
    "SELECT version, url, notes FROM firmware_updates WHERE device_type = 'esl' ORDER BY created_at DESC LIMIT 1"
);

if ($latestFirmware && $latestFirmware['version'] !== $device['firmware_version']) {
    $config['firmwareUpdate'] = [
        'available' => true,
        'version' => $latestFirmware['version'],
        'url' => $latestFirmware['url'],
        'notes' => $latestFirmware['notes']
    ];
} else {
    $config['firmwareUpdate'] = ['available' => false];
}

Response::success($config);
