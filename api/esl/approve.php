<?php
/**
 * ESL Device Approval API
 *
 * POST /api/esl/approve
 * User Auth required (admin or user with device permissions)
 *
 * Body:
 * - syncCode (required): 6-digit sync code from device
 * - name (required): Device name
 * - groupId: Device group ID (optional)
 * - storeId: Store ID (optional)
 *
 * Response:
 * - success: true
 * - device: Device details
 * - deviceToken: JWT token for device authentication
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Get active company ID
$companyId = Auth::getActiveCompanyId();

if (empty($companyId)) {
    Response::badRequest('Active company context is required for device approval');
}

// Get request data
$data = $request->json();

// Accept both syncCode and sync_code
$syncCode = trim($data['syncCode'] ?? $data['sync_code'] ?? '');
$name = trim($data['name'] ?? '');
$groupId = $data['groupId'] ?? $data['group_id'] ?? null;
$playlistId = $data['playlistId'] ?? $data['playlist_id'] ?? null;
$storeId = $data['storeId'] ?? $data['store_id'] ?? null;
$deviceType = $data['type'] ?? null; // Will fallback to sync_request.device_type if not provided
$location = $data['location'] ?? null;
$requestId = $data['request_id'] ?? null;
$communicationMode = $data['communication_mode'] ?? null; // 'mqtt', 'http-server', 'http'
$targetDeviceId = trim((string)($data['target_device_id'] ?? $data['targetDeviceId'] ?? ''));

// Validate required fields
if (empty($syncCode) && empty($requestId)) {
    Response::badRequest('Sync code or request ID is required');
}

if (empty($name)) {
    Response::badRequest('Device name is required');
}

// Validate sync code format if provided (6 digits)
if ($syncCode && !preg_match('/^\d{6}$/', $syncCode)) {
    Response::badRequest('Invalid sync code format. Must be 6 digits.');
}

// Find pending sync request (by sync_code or request_id)
$syncRequest = null;
if ($requestId) {
    $syncRequest = $db->fetch(
        "SELECT * FROM device_sync_requests
         WHERE id = ? AND status = 'pending'
           AND (company_id = ? OR company_id IS NULL)",
        [$requestId, $companyId]
    );
} elseif ($syncCode) {
    $syncRequest = $db->fetch(
        "SELECT * FROM device_sync_requests
         WHERE sync_code = ? AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1",
        [$syncCode]
    );

    if ($syncRequest && !empty($syncRequest['company_id']) && $syncRequest['company_id'] !== $companyId) {
        Response::forbidden('This registration belongs to another company');
    }
}

if (!$syncRequest) {
    // Check if it exists but with different status
    $existingRequest = null;
    if ($requestId) {
        $existingRequest = $db->fetch("SELECT * FROM device_sync_requests WHERE id = ?", [$requestId]);
    } elseif ($syncCode) {
        $existingRequest = $db->fetch(
            "SELECT * FROM device_sync_requests
             WHERE sync_code = ?
             ORDER BY created_at DESC
             LIMIT 1",
            [$syncCode]
        );
    }

    if ($existingRequest) {
        if (!empty($existingRequest['company_id']) && $existingRequest['company_id'] !== $companyId) {
            Response::forbidden('This registration belongs to another company');
        }

        if ($existingRequest['status'] === 'approved') {
            Response::error('This device has already been approved', 409);
        } elseif ($existingRequest['status'] === 'rejected') {
            Response::error('This device registration was rejected', 409);
        } else {
            Response::error('Sync code has expired. Please restart the device registration.', 410);
        }
    }

    Response::notFound('Invalid sync code or request ID. Please check and try again.');
}

$targetDevice = null;
if ($targetDeviceId !== '') {
    $targetDevice = $db->fetch(
        "SELECT * FROM devices WHERE id = ? AND company_id = ?",
        [$targetDeviceId, $companyId]
    );

    if (!$targetDevice) {
        Response::notFound('Target device not found');
    }
}

// If type was not provided in body, use sync_request.device_type as fallback
if (empty($deviceType)) {
    $deviceType = $syncRequest['device_type'] ?? 'esl';
}

// Determine if this is a PWA player or ESL registration
$isPwaPlayer = !empty($syncRequest['fingerprint']) || !empty($syncRequest['browser']);
$deviceIdentifier = $isPwaPlayer
    ? ($syncRequest['fingerprint'] ?? $syncRequest['id'])
    : ($syncRequest['serial_number'] ?? $syncRequest['fingerprint'] ?? $syncRequest['id']);

// Check if device with this identifier already exists
$existingDevice = $db->fetch(
    "SELECT id, company_id FROM devices WHERE device_id = ? OR fingerprint = ?",
    [$deviceIdentifier, $deviceIdentifier]
);

if ($existingDevice) {
    if (!empty($existingDevice['company_id']) && $existingDevice['company_id'] !== $companyId) {
        Response::forbidden('Device is already paired with another company');
    }

    if ($targetDevice && $existingDevice['id'] !== $targetDevice['id']) {
        Response::error('Device already exists', 409, [
            'deviceId' => $existingDevice['id']
        ]);
    }

    if (!$targetDevice) {
        // Update sync request status
        $db->query(
            "UPDATE device_sync_requests
             SET company_id = COALESCE(company_id, ?),
                 status = 'approved',
                 device_id = ?,
                 approved_by = ?,
                 approved_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            [$companyId, $existingDevice['id'], $user['id'], $syncRequest['id']]
        );

        Response::error('Device already exists', 409, [
            'deviceId' => $existingDevice['id']
        ]);
    }
}

// Validate group if provided
if ($groupId) {
    $group = $db->fetch(
        "SELECT id FROM device_groups WHERE id = ? AND company_id = ?",
        [$groupId, $companyId]
    );

    if (!$group) {
        Response::badRequest('Invalid device group');
    }
}

$playlist = null;
$playlistHasItems = false;
$playlistItemsCount = 0;
$playlistWarning = null;
if (!empty($playlistId)) {
    $playlist = $db->fetch(
        "SELECT id, name, items FROM playlists WHERE id = ? AND company_id = ?",
        [$playlistId, $companyId]
    );

    if (!$playlist) {
        Response::badRequest('Invalid playlist');
    }

    $normalizedItemCount = (int) $db->fetchColumn(
        "SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ?",
        [$playlistId]
    );
    $playlistItems = json_decode($playlist['items'] ?? '[]', true);
    $jsonItemCount = is_array($playlistItems) ? count($playlistItems) : 0;
    $playlistItemsCount = max($normalizedItemCount, $jsonItemCount);
    $playlistHasItems = $playlistItemsCount > 0;

    if (!$playlistHasItems) {
        $playlistWarning = "Playlist atandi ancak bos. Icerik gormek icin playlist'e medya ekleyin.";
    }
}

// Begin transaction
$db->beginTransaction();

try {
    // Claim unbound request for the active company before approving.
    $claimResult = $db->query(
        "UPDATE device_sync_requests
         SET company_id = COALESCE(company_id, ?), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending' AND (company_id IS NULL OR company_id = ?)",
        [$companyId, $syncRequest['id'], $companyId]
    );

    if ($claimResult->rowCount() === 0) {
        throw new Exception('Device registration could not be claimed for this company.');
    }

    $syncRequest = $db->fetch(
        "SELECT * FROM device_sync_requests WHERE id = ?",
        [$syncRequest['id']]
    );

    if (!$syncRequest || ($syncRequest['company_id'] ?? null) !== $companyId) {
        throw new Exception('Device registration does not belong to active company.');
    }

    // Parse resolution (check both ESL and PWA fields)
    $screenWidth = null;
    $screenHeight = null;
    $resolution = $syncRequest['resolution'] ?? $syncRequest['screen_resolution'] ?? '';
    if ($resolution) {
        $parts = explode('x', strtolower($resolution));
        if (count($parts) === 2) {
            $screenWidth = (int)$parts[0];
            $screenHeight = (int)$parts[1];
        }
    }

    // Create new device or relink existing one
    $isRelink = $targetDevice !== null;
    $deviceId = $isRelink ? $targetDevice['id'] : $db->generateUuid();

    // Map frontend device types to database-compatible types
    // Database CHECK constraint: 'esl', 'android_tv', 'panel', 'web_display'
    $typeMapping = [
        'esl' => 'esl',
        'esl_rtos' => 'esl',
        'esl_android' => 'esl',
        'android_tv' => 'android_tv',
        'google_tv' => 'android_tv',
        'tv' => 'android_tv',
        'tablet' => 'android_tv',
        'mobile' => 'android_tv',
        'pc_browser' => 'web_display',
        'web_display' => 'web_display',
        'panel' => 'panel',
        'pwa_player' => 'android_tv',
        'priceview' => 'android_tv'
    ];

    // Determine actual device type
    $actualDeviceType = $typeMapping[$deviceType] ?? 'android_tv';
    if ($isPwaPlayer && $deviceType === 'esl') {
        $actualDeviceType = 'android_tv'; // Default PWA players to android_tv type
    }

    // Store original type in metadata for display purposes
    $originalType = $deviceType;

    // Build metadata based on registration type
    $metadata = [];
    if ($isPwaPlayer) {
        $metadata = [
            'browser' => $syncRequest['browser'] ?? null,
            'os' => $syncRequest['os'] ?? null,
            'user_agent' => $syncRequest['user_agent'] ?? null,
            'timezone' => $syncRequest['timezone'] ?? null,
            'language' => $syncRequest['language'] ?? null,
            'registration_type' => 'pwa_player',
            'original_device_type' => $originalType,
            'registered_at' => date('Y-m-d H:i:s'),
            'registered_by' => $user['id']
        ];
    } else {
        $metadata = [
            'screen_type' => $syncRequest['screen_type'] ?? null,
            'store_code' => $syncRequest['store_code'] ?? null,
            'registration_type' => 'esl',
            'original_device_type' => $originalType,
            'registered_at' => date('Y-m-d H:i:s'),
            'registered_by' => $user['id']
        ];
    }

    // MQTT modu icin communication_mode ve mqtt_client_id ayarla
    $actualCommMode = $communicationMode ?? ($targetDevice['communication_mode'] ?? 'http-server');
    $mqttClientId = null;
    $mqttTopic = null;

    if ($actualCommMode === 'mqtt' && ($communicationMode !== null || !$isRelink)) {
        require_once BASE_PATH . '/services/MqttBrokerService.php';
        $mqttService = new MqttBrokerService();
        $mqttClientId = $syncRequest['serial_number'] ?? $deviceIdentifier;
        $mqttTopic = $mqttService->generatePavoTopic($companyId, $mqttClientId);
        // MQTT cihazlarda IP zorunlu degil, ama varsa kullan
        $metadata['mqtt_registered'] = true;
        $metadata['mqtt_client_id'] = $mqttClientId;
    }

    if ($isRelink) {
        $targetMetadata = json_decode($targetDevice['metadata'] ?? '[]', true);
        if (!is_array($targetMetadata)) {
            $targetMetadata = [];
        }
        $mergedMetadata = array_merge($targetMetadata, $metadata);

        $updatePayload = [
            'name' => $name,
            'group_id' => $groupId,
            'store_id' => $storeId,
            'type' => $actualDeviceType,
            'model' => $originalType,
            'mac_address' => $syncRequest['mac_address'] ?? ($targetDevice['mac_address'] ?? null),
            'ip_address' => $syncRequest['ip_address'] ?? ($targetDevice['ip_address'] ?? null),
            'device_id' => $deviceIdentifier,
            'fingerprint' => $syncRequest['fingerprint'] ?? ($targetDevice['fingerprint'] ?? null),
            'manufacturer' => $syncRequest['manufacturer'] ?? ($isPwaPlayer ? 'PWA Browser' : ($targetDevice['manufacturer'] ?? null)),
            'firmware_version' => $syncRequest['firmware'] ?? ($targetDevice['firmware_version'] ?? null),
            'screen_width' => $screenWidth ?: ($targetDevice['screen_width'] ?? null),
            'screen_height' => $screenHeight ?: ($targetDevice['screen_height'] ?? null),
            'location' => $location,
            'metadata' => json_encode($mergedMetadata),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($communicationMode !== null) {
            $updatePayload['communication_mode'] = $actualCommMode;
            $updatePayload['mqtt_client_id'] = $mqttClientId;
            $updatePayload['mqtt_topic'] = $mqttTopic;
        }

        $db->update('devices', $updatePayload, 'id = ? AND company_id = ?', [$deviceId, $companyId]);
    } else {
        $db->query(
            "INSERT INTO devices (id, company_id, group_id, store_id, name, type, model, mac_address, ip_address, device_id, fingerprint, manufacturer, firmware_version, screen_width, screen_height, status, location, metadata, communication_mode, mqtt_client_id, mqtt_topic, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            [
                $deviceId,
                $companyId,
                $groupId,
                $storeId,
                $name,
                $actualDeviceType,
                $originalType,
                $syncRequest['mac_address'] ?? null,
                $syncRequest['ip_address'] ?? null,
                $deviceIdentifier,
                $syncRequest['fingerprint'] ?? null,
                $syncRequest['manufacturer'] ?? ($isPwaPlayer ? 'PWA Browser' : null),
                $syncRequest['firmware'] ?? null,
                $screenWidth,
                $screenHeight,
                $location,
                json_encode($metadata),
                $actualCommMode,
                $mqttClientId,
                $mqttTopic
            ]
        );
    }

    // Update sync request
    $db->query(
        "UPDATE device_sync_requests
         SET company_id = COALESCE(company_id, ?),
             status = 'approved',
             device_id = ?,
             approved_by = ?,
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
        [$companyId, $deviceId, $user['id'], $syncRequest['id']]
    );

    if ($playlist) {
        $db->query(
            "UPDATE device_content_assignments
             SET status = 'inactive'
             WHERE device_id = ? AND content_type = 'playlist'",
            [$deviceId]
        );

        $assignmentId = $db->generateUuid();
        $db->query(
            "INSERT INTO device_content_assignments (id, device_id, content_type, content_id, status, created_at)
             VALUES (?, ?, 'playlist', ?, 'active', CURRENT_TIMESTAMP)",
            [$assignmentId, $deviceId, $playlistId]
        );

        $commandId = $db->generateUuid();
        $db->query(
            "INSERT INTO device_commands (id, device_id, command, parameters, status, created_by, created_at)
             VALUES (?, ?, 'refresh_content', ?, 'pending', ?, CURRENT_TIMESTAMP)",
            [
                $commandId,
                $deviceId,
                json_encode(['playlist_id' => $playlistId, 'source' => 'approve_device']),
                $user['id']
            ]
        );

        $db->insert('device_logs', [
            'id' => $db->generateUuid(),
            'device_id' => $deviceId,
            'action' => 'sync',
            'content_type' => 'playlist',
            'content_id' => $playlistId,
            'status' => 'success',
            'request_data' => json_encode([
                'playlist_id' => $playlistId,
                'items_count' => $playlistItemsCount,
                'source' => 'approve'
            ])
        ]);
    }

    // Generate device token
    $tokenData = DeviceAuthMiddleware::generateJwtToken([
        'id' => $deviceId,
        'device_id' => $deviceIdentifier,
        'company_id' => $companyId
    ], 365); // 1 year expiry

    // Commit transaction
    $db->commit();

    // Get the created device
    $device = $db->fetch(
        "SELECT d.*, g.name as group_name
         FROM devices d
         LEFT JOIN device_groups g ON d.group_id = g.id
         WHERE d.id = ?",
        [$deviceId]
    );

    // Log the approval
    if (class_exists('Logger')) {
        Logger::info('ESL device approved', [
            'device_id' => $deviceId,
            'serial_number' => $syncRequest['serial_number'],
            'approved_by' => $user['id'],
            'company_id' => $companyId
        ]);
    }

    $responsePayload = [
        'device' => [
            'id' => $device['id'],
            'name' => $device['name'],
            'serialNumber' => $device['device_id'],
            'type' => $device['type'],
            'status' => $device['status'],
            'groupId' => $device['group_id'],
            'groupName' => $device['group_name'],
            'screenWidth' => $device['screen_width'],
            'screenHeight' => $device['screen_height'],
            'createdAt' => $device['created_at']
        ],
        'deviceToken' => $tokenData['token'],
        'tokenExpiresAt' => $tokenData['expires_at'],
        'message' => 'Device approved successfully'
    ];

    if ($playlist) {
        $responsePayload['playlist'] = [
            'id' => $playlist['id'],
            'name' => $playlist['name'],
            'has_items' => $playlistHasItems,
            'items_count' => $playlistItemsCount
        ];
    }

    if ($playlistWarning) {
        $responsePayload['warning'] = $playlistWarning;
    }

    Response::success($responsePayload, $isRelink ? 200 : 201);

} catch (Exception $e) {
    $db->rollBack();

    if (class_exists('Logger')) {
        Logger::error('ESL device approval failed', [
            'sync_code' => $syncCode,
            'error' => $e->getMessage()
        ]);
    }

    Response::serverError('Failed to approve device: ' . $e->getMessage());
}
