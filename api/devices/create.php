<?php
/**
 * Create Device API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Valid device types
$validTypes = ['esl', 'esl_rtos', 'esl_android', 'hanshow_esl', 'android_tv', 'panel', 'web_display', 'tablet', 'mobile', 'tv', 'stream_player'];

// Map frontend type to database type (SQLite CHECK constraint: esl, android_tv, panel, web_display)
$typeMap = [
    'tv' => 'android_tv',
    'esl_android' => 'esl',      // PavoDisplay Android ESL devices
    'esl_rtos' => 'esl',         // RTOS-based ESL devices
    'hanshow_esl' => 'esl',      // Hanshow E-Paper ESL devices (RF via Gateway)
    'tablet' => 'android_tv',    // Tablets as signage
    'mobile' => 'android_tv',    // Mobile as signage
    'stream_player' => 'android_tv'  // Stream Mode (VLC/IPTV) devices
];

$frontendType = $request->input('type', 'esl');
$dbType = $typeMap[$frontendType] ?? $frontendType;

// Validate type
if (!in_array($dbType, $validTypes)) {
    $dbType = 'esl'; // Default to esl
}

$validator = Validator::make($request->all(), [
    'name' => 'required|max:255',
    'type' => 'required'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Check duplicate device_id (serial number) if provided
$deviceId = $request->input('serial_number') ?: $request->input('device_id');
if ($deviceId) {
    $exists = $db->fetch(
        "SELECT 1 FROM devices WHERE device_id = ?",
        [$deviceId]
    );

    if ($exists) {
        Response::error('Bu cihaz ID zaten kayıtlı', 400);
    }
}

$ipAddress = trim((string)$request->input('ip_address', ''));
$ipAddress = $ipAddress !== '' ? $ipAddress : null;

if ($ipAddress !== null && strtolower($ipAddress) !== 'localhost') {
    if (!filter_var($ipAddress, FILTER_VALIDATE_IP)) {
        Response::error('IP adresi formatı geçersiz', 422);
    }

    $existingIpDevice = $db->fetch(
        "SELECT id, name FROM devices WHERE company_id = ? AND ip_address = ? LIMIT 1",
        [$companyId, $ipAddress]
    );

    if ($existingIpDevice) {
        Response::error(
            'Bu IP adresi başka bir cihaza atanmış',
            409,
            ['existing_device' => $existingIpDevice]
        );
    }
}

// Store original type in model field if it was mapped (for PavoDisplay detection)
$originalType = $frontendType;
$modelValue = $request->input('model') ?: $request->input('location');
if ($frontendType !== $dbType && !$modelValue) {
    $modelValue = $originalType; // Store original type like 'esl_android'
}

// Stream Mode: auto-generate stream_token when stream_mode=1
$streamMode = (int)($request->input('stream_mode', 0));
if ($originalType === 'stream_player') {
    $streamMode = 1; // Force stream mode for stream_player type
}
$streamToken = null;
if ($streamMode === 1) {
    $tokenLength = defined('STREAM_TOKEN_LENGTH') ? STREAM_TOKEN_LENGTH : 32;
    $streamToken = bin2hex(random_bytes($tokenLength));
}

// Device profile for stream mode
$deviceProfile = $request->input('device_profile');
if ($deviceProfile && is_string($deviceProfile)) {
    // If simple string like "720p", convert to JSON profile
    $profileMap = [
        '360p' => json_encode(['max_res' => '640x360', 'max_bitrate' => 600]),
        '540p' => json_encode(['max_res' => '960x540', 'max_bitrate' => 1200]),
        '720p' => json_encode(['max_res' => '1280x720', 'max_bitrate' => 3000]),
        '1080p' => json_encode(['max_res' => '1920x1080', 'max_bitrate' => 6000]),
    ];
    $deviceProfile = $profileMap[$deviceProfile] ?? $deviceProfile;
}

$insertData = [
    'company_id' => $companyId,
    'group_id' => $request->input('group_id'),
    'name' => $request->input('name'),
    'type' => $dbType,
    'device_id' => $deviceId,
    'mac_address' => $request->input('mac_address'),
    'ip_address' => $ipAddress,
    'firmware_version' => $request->input('firmware_version'),
    'model' => $modelValue,
    'manufacturer' => $request->input('manufacturer') ?: (
        $originalType === 'esl_android' ? 'PavoDisplay' :
        ($originalType === 'hanshow_esl' ? 'Hanshow' : null)
    ),
    'status' => $request->input('status', 'offline'),
    'screen_width' => $request->input('screen_width'),
    'screen_height' => $request->input('screen_height'),
    'communication_mode' => $request->input('communication_mode', 'http-server'),
    'mqtt_client_id' => $request->input('mqtt_client_id'),
    'mqtt_topic' => $request->input('mqtt_topic'),
    'stream_mode' => $streamMode,
    'stream_token' => $streamToken,
    'device_profile' => $deviceProfile
];

// Bluetooth password protection (PavoDisplay/Kexin)
$btPassword = $request->input('bt_password');
if (!empty($btPassword) && is_string($btPassword)) {
    $insertData['bt_password_encrypted'] = Security::encrypt($btPassword);
}

$id = $db->insert('devices', $insertData);

$device = $db->fetch("SELECT * FROM devices WHERE id = ?", [$id]);

// Add virtual fields for frontend
$device['serial_number'] = $device['device_id'];
$device['location'] = $device['model'];

Logger::audit('create', 'devices', ['device_id' => $id]);

Response::created($device, 'Cihaz oluşturuldu');

