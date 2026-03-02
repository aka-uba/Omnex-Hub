<?php
/**
 * PWA Player Heartbeat API
 *
 * POST /api/player/heartbeat
 * Header: X-DEVICE-TOKEN: <token>
 *
 * Cihaz durumunu guncelle ve bekleyen komutlari dondur
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();

// Get authenticated device
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$deviceId = DeviceAuthMiddleware::deviceId();
$companyId = DeviceAuthMiddleware::companyId();

// Get request body
$body = $request->body();

// Extract heartbeat data
$status = $body['status'] ?? 'playing';
$currentItem = $body['currentItem'] ?? null;
$batteryLevel = isset($body['battery']) ? (int) $body['battery'] : null;
$signalStrength = isset($body['signal']) ? (int) $body['signal'] : null;
$memoryUsage = isset($body['memory']) ? (int) $body['memory'] : null;
$cpuUsage = isset($body['cpu']) ? (int) $body['cpu'] : null;
$storageFree = isset($body['storageFree']) ? (int) $body['storageFree'] : null;
$temperature = isset($body['temperature']) ? (float) $body['temperature'] : null;
$uptime = isset($body['uptime']) ? (int) $body['uptime'] : null;
$errors = isset($body['errors']) ? json_encode($body['errors']) : null;
$metadata = isset($body['metadata']) ? json_encode($body['metadata']) : null;
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;

// âœ… Playlist bilgisi
$playlistInfo = isset($body['playlist']) ? $body['playlist'] : null;
$playlistId = $playlistInfo['playlist_id'] ?? null;
$playlistName = $playlistInfo['playlist_name'] ?? null;
$currentIndex = isset($playlistInfo['current_index']) ? (int) $playlistInfo['current_index'] : null;
$totalItems = isset($playlistInfo['total_items']) ? (int) $playlistInfo['total_items'] : null;
$lastSync = $playlistInfo['last_sync'] ?? null;

// Update device status
$deviceUpdate = [
    'status' => 'online',
    'last_online' => date('Y-m-d H:i:s'),
    'last_seen' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
];

if ($batteryLevel !== null) {
    $deviceUpdate['battery_level'] = $batteryLevel;
}

if ($signalStrength !== null) {
    $deviceUpdate['signal_strength'] = $signalStrength;
}

if ($currentItem !== null) {
    $deviceUpdate['current_content'] = is_string($currentItem) ? $currentItem : json_encode($currentItem);
}

// âœ… Playlist bilgisini kaydet
if ($playlistId !== null) {
    $deviceUpdate['current_playlist_id'] = $playlistId;
}
if ($currentIndex !== null) {
    $deviceUpdate['current_playlist_index'] = $currentIndex;
}
if ($totalItems !== null) {
    $deviceUpdate['playlist_total_items'] = $totalItems;
}
if ($lastSync !== null) {
    $deviceUpdate['last_sync'] = $lastSync;
}

// Check for error status
if ($status === 'error' && !empty($body['errorMessage'])) {
    $deviceUpdate['status'] = 'error';
    $deviceUpdate['error_message'] = $body['errorMessage'];
}

$db->update('devices', $deviceUpdate, 'id = ?', [$deviceId]);

// Store heartbeat record
$heartbeatData = [
    'id' => $db->generateUuid(),
    'device_id' => $deviceId,
    'status' => $status,
    'current_item' => is_string($currentItem) ? $currentItem : json_encode($currentItem),
    'battery_level' => $batteryLevel,
    'signal_strength' => $signalStrength,
    'memory_usage' => $memoryUsage,
    'cpu_usage' => $cpuUsage,
    'storage_free' => $storageFree,
    'temperature' => $temperature,
    'uptime' => $uptime,
    'errors' => $errors,
    'metadata' => $playlistInfo ? json_encode($playlistInfo) : $metadata, // âœ… Playlist bilgisini metadata'ya ekle
    'ip_address' => $ipAddress,
    'created_at' => date('Y-m-d H:i:s')
];

// Insert heartbeat using direct query since it's not in the allowed tables list
$db->query(
    "INSERT INTO device_heartbeats (id, device_id, status, current_item, battery_level, signal_strength,
     memory_usage, cpu_usage, storage_free, temperature, uptime, errors, metadata, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
        $heartbeatData['id'],
        $heartbeatData['device_id'],
        $heartbeatData['status'],
        $heartbeatData['current_item'],
        $heartbeatData['battery_level'],
        $heartbeatData['signal_strength'],
        $heartbeatData['memory_usage'],
        $heartbeatData['cpu_usage'],
        $heartbeatData['storage_free'],
        $heartbeatData['temperature'],
        $heartbeatData['uptime'],
        $heartbeatData['errors'],
        $heartbeatData['metadata'],
        $heartbeatData['ip_address'],
        $heartbeatData['created_at']
    ]
);

// Get pending commands (only pending, not sent - to prevent duplicate processing)
$pendingCommands = $db->fetchAll(
    "SELECT id, command, parameters, priority
     FROM device_commands
     WHERE device_id = ? AND status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT 10",
    [$deviceId]
);

// Process commands and format response
$commands = [];
foreach ($pendingCommands as $cmd) {
    $commands[] = [
        'id' => $cmd['id'],
        'command' => $cmd['command'],
        'parameters' => $cmd['parameters'] ? json_decode($cmd['parameters'], true) : null
    ];
}

// Mark commands as sent if they were pending
if (!empty($pendingCommands)) {
    $commandIds = array_column($pendingCommands, 'id');
    $placeholders = implode(',', array_fill(0, count($commandIds), '?'));
    $db->query(
        "UPDATE device_commands SET status = 'sent' WHERE id IN ($placeholders) AND status = 'pending'",
        $commandIds
    );
}

// Acknowledge completed commands if provided
if (!empty($body['completedCommands']) && is_array($body['completedCommands'])) {
    foreach ($body['completedCommands'] as $completedCmd) {
        $cmdId = is_array($completedCmd) ? ($completedCmd['id'] ?? null) : $completedCmd;
        $result = is_array($completedCmd) ? ($completedCmd['result'] ?? null) : null;

        if ($cmdId) {
            $db->query(
                "UPDATE device_commands SET status = 'completed', executed_at = CURRENT_TIMESTAMP, result = ? WHERE id = ? AND device_id = ?",
                [$result ? json_encode($result) : null, $cmdId, $deviceId]
            );
        }
    }
}

// Build response
$response = [
    'status' => 'ok',
    'serverTime' => date('Y-m-d H:i:s'),
    'commands' => $commands,
    'nextHeartbeat' => 30 // Recommended seconds until next heartbeat
];

// Add sync recommendation if there are commands
if (!empty($commands)) {
    $response['shouldSync'] = true;
}

Response::success($response);

