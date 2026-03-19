<?php
/**
 * Update Device API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

$device = $db->fetch("SELECT * FROM devices WHERE id = ? AND company_id = ?", [$id, $companyId]);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Map frontend type to database type (allowed: esl, android_tv, panel, web_display)
$typeMap = [
    'tv' => 'android_tv',
    'esl' => 'esl',
    'esl_android' => 'esl',      // PavoDisplay Android ESL devices
    'esl_rtos' => 'esl',         // RTOS-based ESL devices
    'hanshow_esl' => 'esl',      // Hanshow ESL devices
    'tablet' => 'android_tv',    // Tablets as signage
    'mobile' => 'android_tv',    // Mobile as signage
    'android_tv' => 'android_tv',
    'panel' => 'panel',
    'web_display' => 'web_display',
    'pwa_player' => 'web_display',  // PWA Player -> web_display
    'stream_player' => 'android_tv',  // Stream Mode (VLC/IPTV)
    'priceview' => 'android_tv'        // PriceView price checker kiosks
];

$existingMetadata = $device['metadata'] ? json_decode($device['metadata'], true) : [];
$existingOriginalType = is_array($existingMetadata) ? ($existingMetadata['original_type'] ?? null) : null;
$effectiveFrontendType = $request->has('type')
    ? (string)$request->input('type')
    : ((is_string($existingOriginalType) && $existingOriginalType !== '') ? $existingOriginalType : (string)($device['type'] ?? ''));
$isEslFamilyType = in_array($effectiveFrontendType, ['esl', 'esl_rtos', 'esl_android', 'hanshow_esl'], true)
    || (($device['type'] ?? null) === 'esl');

$data = [];

// Map frontend fields to database fields
if ($request->has('name')) $data['name'] = $request->input('name');
if ($request->has('group_id')) $data['group_id'] = $request->input('group_id');
if ($request->has('branch_id')) $data['branch_id'] = $request->input('branch_id');
if ($request->has('mac_address')) $data['mac_address'] = $request->input('mac_address');
if ($request->has('ip_address')) $data['ip_address'] = $request->input('ip_address');
if ($request->has('firmware_version')) $data['firmware_version'] = $request->input('firmware_version');
if ($request->has('status')) $data['status'] = $request->input('status');
if ($request->has('model')) $data['model'] = $request->input('model');
if ($request->has('manufacturer')) $data['manufacturer'] = $request->input('manufacturer');
if ($request->has('location')) $data['location'] = $request->input('location');
if ($request->has('mqtt_client_id')) {
    $mqttClientId = trim((string)$request->input('mqtt_client_id'));
    $data['mqtt_client_id'] = $mqttClientId !== '' ? $mqttClientId : null;
}
if ($request->has('mqtt_topic')) {
    $mqttTopic = trim((string)$request->input('mqtt_topic'));
    $data['mqtt_topic'] = $mqttTopic !== '' ? $mqttTopic : null;
}
if ($request->has('communication_mode')) {
    $communicationMode = trim((string)$request->input('communication_mode'));
    $allowedCommunicationModes = ['http-server', 'http', 'mqtt'];
    if (!in_array($communicationMode, $allowedCommunicationModes, true)) {
        Response::error('Iletisim modu gecersiz', 422);
    }
    $data['communication_mode'] = $communicationMode;

    // Sync active assignment content_type when communication_mode changes
    $oldMode = $device['communication_mode'] ?? 'http-server';
    if ($communicationMode !== $oldMode) {
        $newContentType = ($communicationMode === 'mqtt') ? 'mqtt_payload' : 'http_payload';
        $staleType = ($communicationMode === 'mqtt') ? 'http_payload' : 'mqtt_payload';

        $db->query(
            "UPDATE device_content_assignments
                SET content_type = ?, created_at = now()
              WHERE device_id = ?
                AND status = 'active'
                AND content_type = ?",
            [$newContentType, $id, $staleType]
        );
    }
}

// Map serial_number to device_id
if ($request->has('serial_number')) {
    $data['device_id'] = $request->input('serial_number');
}
if ($request->has('device_id')) {
    $data['device_id'] = $request->input('device_id');
}

// Screen dimensions
if ($request->has('screen_width')) $data['screen_width'] = $request->input('screen_width');
if ($request->has('screen_height')) $data['screen_height'] = $request->input('screen_height');

// Preview image (current_content)
if ($request->has('current_content')) {
    $data['current_content'] = $request->input('current_content');
}


// Map type - store original_type in metadata and model column for frontend
if ($request->has('type')) {
    $frontendType = $request->input('type');
    $data['type'] = $typeMap[$frontendType] ?? $frontendType;
    $data['model'] = $frontendType; // Store original type in model column for DeviceRegistry.resolve()

    // Store original frontend type in metadata
    $metadataPayload = is_array($existingMetadata) ? $existingMetadata : [];
    $metadataPayload['original_type'] = $frontendType;
    $data['metadata'] = json_encode($metadataPayload);

    $isEslFamilyType = in_array($frontendType, ['esl', 'esl_rtos', 'esl_android', 'hanshow_esl'], true)
        || (($data['type'] ?? null) === 'esl');
}

if (isset($data['metadata']) && is_array($data['metadata'])) {
    $data['metadata'] = json_encode($data['metadata']);
}

// Normalize IP update and capture change state for cross-table sync
$oldIpAddress = $device['ip_address'] ?? null;
$oldClientId = $device['device_id'] ?? null;

if (array_key_exists('ip_address', $data)) {
    $normalizedIp = trim((string)$data['ip_address']);
    $data['ip_address'] = $normalizedIp !== '' ? $normalizedIp : null;

    if ($data['ip_address'] !== null && strtolower($data['ip_address']) !== 'localhost') {
        if (!filter_var($data['ip_address'], FILTER_VALIDATE_IP)) {
            Response::error('IP adresi formatı geçersiz', 422);
        }

        if ($isEslFamilyType) {
            $existingIpDevice = $db->fetch(
                "SELECT id, name FROM devices WHERE company_id = ? AND ip_address = ? AND id != ? LIMIT 1",
                [$companyId, $data['ip_address'], $id]
            );

            if ($existingIpDevice) {
                Response::error(
                    'Bu IP adresi başka bir cihaza atanmış',
                    409,
                    ['existing_device' => $existingIpDevice]
                );
            }
        }
    }
}

$newIpAddress = array_key_exists('ip_address', $data) ? $data['ip_address'] : $oldIpAddress;
$newClientId = array_key_exists('device_id', $data) ? $data['device_id'] : $oldClientId;

$ipChanged = $newIpAddress !== $oldIpAddress;
$clientIdChanged = $newClientId !== $oldClientId;

// Stream Mode fields
if ($request->has('stream_mode')) {
    $data['stream_mode'] = (int)$request->input('stream_mode');
    // Auto-generate stream_token when enabling stream mode
    if ($data['stream_mode'] === 1 && empty($device['stream_token'])) {
        $tokenLength = defined('STREAM_TOKEN_LENGTH') ? STREAM_TOKEN_LENGTH : 32;
        $data['stream_token'] = bin2hex(random_bytes($tokenLength));
    } elseif ($data['stream_mode'] === 0) {
        // Stream kapatildiginda canli pencere referansini sifirla.
        $data['stream_started_at'] = null;

        // Eski stream oyuncusu modeli UI'da stream olarak kalmasin.
        if (($device['model'] ?? null) === 'stream_player' && !$request->has('model')) {
            $data['model'] = null;
        }
    }
}
if ((int)$request->input('ensure_stream_token', $request->input('ensureStreamToken', 0)) === 1) {
    if (empty($device['stream_token'])) {
        $tokenLength = defined('STREAM_TOKEN_LENGTH') ? STREAM_TOKEN_LENGTH : 32;
        $data['stream_token'] = bin2hex(random_bytes($tokenLength));
    } else {
        $data['stream_token'] = $device['stream_token'];
    }
}
if ($request->has('device_profile')) {
    $dp = $request->input('device_profile');
    if (is_string($dp) && in_array($dp, ['360p', '540p', '720p', '1080p'])) {
        $profileMap = [
            '360p' => json_encode(['max_res' => '640x360', 'max_bitrate' => 600]),
            '540p' => json_encode(['max_res' => '960x540', 'max_bitrate' => 1200]),
            '720p' => json_encode(['max_res' => '1280x720', 'max_bitrate' => 3000]),
            '1080p' => json_encode(['max_res' => '1920x1080', 'max_bitrate' => 6000]),
        ];
        $data['device_profile'] = $profileMap[$dp];
    } else {
        $data['device_profile'] = is_array($dp) ? json_encode($dp) : $dp;
    }
}

// Bluetooth password protection (PavoDisplay/Kexin)
if ($request->has('bt_password')) {
    $btPassword = $request->input('bt_password');
    if (!empty($btPassword) && is_string($btPassword)) {
        $data['bt_password_encrypted'] = Security::encrypt($btPassword);
    } elseif ($btPassword === null || $btPassword === '') {
        $data['bt_password_encrypted'] = null;
    }
}

$data['updated_at'] = date('Y-m-d H:i:s');

$updatedDevice = null;

try {
    $db->beginTransaction();

    $db->update('devices', $data, 'id = ?', [$id]);

    // Keep gateway mapping in sync when device IP changes from UI.
    if ($ipChanged) {
        $db->update('gateway_devices', [
            'local_ip' => $newIpAddress,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'device_id = ?', [$id]);
    }

    // Keep pending gateway command payloads in sync with edited device identity.
    if ($ipChanged || $clientIdChanged) {
        $pendingCommands = $db->fetchAll(
            "SELECT id, parameters
             FROM gateway_commands
             WHERE device_id = ? AND status = 'pending'",
            [$id]
        );

        foreach ($pendingCommands as $command) {
            $params = json_decode($command['parameters'] ?? '', true);
            if (!is_array($params)) {
                continue;
            }

            $changed = false;

            if ($ipChanged) {
                foreach (['device_ip', 'ip', 'ip_address'] as $ipKey) {
                    if (array_key_exists($ipKey, $params)) {
                        $params[$ipKey] = $newIpAddress;
                        $changed = true;
                    }
                }
            }

            if ($clientIdChanged) {
                foreach (['client_id', 'clientid'] as $clientKey) {
                    if (array_key_exists($clientKey, $params)) {
                        $params[$clientKey] = $newClientId;
                        $changed = true;
                    }
                }
            }

            if ($changed) {
                $db->update('gateway_commands', [
                    'parameters' => json_encode($params, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ], 'id = ?', [$command['id']]);
            }
        }
    }

    $updatedDevice = $db->fetch("SELECT * FROM devices WHERE id = ?", [$id]);
    if (!$updatedDevice) {
        throw new Exception('Updated device not found');
    }

    // Map back for frontend - use original_type from metadata if available
    $metadata = $updatedDevice['metadata'] ? json_decode($updatedDevice['metadata'], true) : [];
    $updatedDevice['serial_number'] = $updatedDevice['device_id'];

    // Return original_type if stored, otherwise map from db type
    if (!empty($metadata['original_type'])) {
        $updatedDevice['type'] = $metadata['original_type'];
    } else {
        $typeMapReverse = ['android_tv' => 'android_tv', 'esl' => 'esl', 'panel' => 'panel', 'web_display' => 'web_display'];
        $updatedDevice['type'] = $typeMapReverse[$updatedDevice['type']] ?? $updatedDevice['type'];
    }

    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    Logger::error('Device update error', [
        'device_id' => $id,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

try {
    Logger::audit('update', 'devices', ['device_id' => $id]);
} catch (Throwable $auditError) {
    error_log('Device update audit skipped: ' . $auditError->getMessage());
}

Response::success($updatedDevice, 'Cihaz güncellendi');
