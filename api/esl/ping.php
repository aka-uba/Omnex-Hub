<?php
/**
 * ESL Device Heartbeat/Ping API
 *
 * POST /api/esl/ping
 * Device Auth required: Authorization: Device <token>
 *
 * Body (optional):
 * - batteryLevel: Current battery level (0-100)
 * - signalStrength: WiFi/network signal strength
 * - temperature: Device temperature
 * - freeMemory: Available memory
 * - uptime: Device uptime in seconds
 *
 * Response:
 * - status: "ok"
 * - serverTime: Current server timestamp
 * - hasUpdate: Whether there's pending content update
 * - commands: Array of pending commands for the device
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device not authenticated');
}

$deviceId = $device['id'] ?? $device['device_id'];

// Get request data (optional device stats)
$data = $request->json();

// Update device status and stats
$updateData = [
    'last_seen' => date('Y-m-d H:i:s'),
    'last_online' => date('Y-m-d H:i:s'),
    'status' => 'online',
    'ip_address' => $request->ip()
];

// Update optional fields if provided
if (isset($data['batteryLevel'])) {
    $updateData['battery_level'] = (int)$data['batteryLevel'];
}
if (isset($data['signalStrength'])) {
    $updateData['signal_strength'] = (int)$data['signalStrength'];
}

// Build metadata JSON
$metadata = [];
if (isset($data['temperature'])) {
    $metadata['temperature'] = $data['temperature'];
}
if (isset($data['freeMemory'])) {
    $metadata['free_memory'] = $data['freeMemory'];
}
if (isset($data['uptime'])) {
    $metadata['uptime'] = $data['uptime'];
}
if (isset($data['firmware'])) {
    $metadata['firmware'] = $data['firmware'];
    $updateData['firmware_version'] = $data['firmware'];
}

if (!empty($metadata)) {
    // Merge with existing metadata
    $existingMetadata = json_decode($device['metadata'] ?? '{}', true) ?: [];
    $metadata = array_merge($existingMetadata, $metadata);
    $updateData['metadata'] = json_encode($metadata);
}

// Update device
$setClauses = [];
$params = [];
foreach ($updateData as $key => $value) {
    $setClauses[] = "`$key` = ?";
    $params[] = $value;
}
$params[] = $deviceId;

$db->query(
    "UPDATE devices SET " . implode(', ', $setClauses) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    $params
);

// Check for pending content updates
$hasUpdate = false;
$contentVersion = null;

// Check device_content_assignments for unsync'd content
$pendingContent = $db->fetch(
    "SELECT COUNT(*) as count, MAX(updated_at) as latest
     FROM device_content_assignments
     WHERE device_id = ? AND status = 'active' AND (synced_at IS NULL OR synced_at < updated_at)",
    [$deviceId]
);

if ($pendingContent && $pendingContent['count'] > 0) {
    $hasUpdate = true;
    $contentVersion = $pendingContent['latest'];
}

// Check for pending commands (from device_logs with pending status)
$pendingCommands = $db->fetchAll(
    "SELECT id, action, content_type, content_id, request_data
     FROM device_logs
     WHERE device_id = ? AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10",
    [$deviceId]
);

$commands = [];
foreach ($pendingCommands as $cmd) {
    $commands[] = [
        'id' => $cmd['id'],
        'action' => $cmd['action'],
        'contentType' => $cmd['content_type'],
        'contentId' => $cmd['content_id'],
        'data' => json_decode($cmd['request_data'], true)
    ];
}

Response::success([
    'status' => 'ok',
    'serverTime' => date('c'),
    'serverTimestamp' => time(),
    'hasUpdate' => $hasUpdate,
    'contentVersion' => $contentVersion,
    'commands' => $commands,
    'commandCount' => count($commands)
]);

