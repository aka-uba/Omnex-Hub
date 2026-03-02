<?php
/**
 * PWA Player Command Acknowledge API
 *
 * POST /api/player/command-ack
 * Header: X-DEVICE-TOKEN: <token>
 *
 * Komut tamamlandı bildirimi
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

// Get request body
$body = $request->body();

$commandId = $body['command_id'] ?? null;
$status = $body['status'] ?? 'completed';
$result = $body['result'] ?? null;

if (!$commandId) {
    Response::badRequest('command_id is required');
}

// Verify command belongs to this device
$command = $db->fetch(
    "SELECT id, command, status FROM device_commands WHERE id = ? AND device_id = ?",
    [$commandId, $deviceId]
);

if (!$command) {
    Response::notFound('Command not found');
}

// Update command status
$updateData = [
    'status' => $status === 'completed' ? 'completed' : 'failed',
    'executed_at' => date('Y-m-d H:i:s'),
    'result' => $result ? json_encode($result) : null
];

$db->update('device_commands', $updateData, 'id = ?', [$commandId]);

Logger::info('Command acknowledged', [
    'device_id' => $deviceId,
    'command_id' => $commandId,
    'command' => $command['command'],
    'status' => $status
]);

Response::success([
    'acknowledged' => true,
    'command_id' => $commandId,
    'status' => $updateData['status']
]);
