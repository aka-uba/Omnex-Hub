<?php
/**
 * Device Send Command API
 *
 * POST /api/devices/:id/send-command
 *
 * Send a command to a device (start, stop, refresh, reboot, etc.)
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');
$body = $request->body();

$command = $body['command'] ?? '';
$parameters = $body['parameters'] ?? [];

// Validate command
$allowedCommands = [
    'start',      // Start playback
    'stop',       // Stop playback
    'pause',      // Pause playback
    'resume',     // Resume playback
    'refresh',    // Refresh content/sync
    'reboot',     // Reboot device
    'clear_cache', // Clear device cache
    'set_volume', // Set volume level
    'set_brightness', // Set brightness level
    'display_message', // Show temporary message
    'next',       // Skip to next item
    'prev',       // Go to previous item
    'goto'        // Go to specific item index
];

if (!in_array($command, $allowedCommands)) {
    Response::badRequest('Invalid command: ' . $command);
}

// Get device to verify ownership
$device = $db->fetch(
    "SELECT id, name, company_id, type, status FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Device not found');
}

// Create command record
$commandId = $db->generateUuid();
$priority = in_array($command, ['stop', 'reboot', 'refresh']) ? 10 : 5;

$db->query(
    "INSERT INTO device_commands (id, device_id, command, parameters, status, priority, created_at, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?)",
    [
        $commandId,
        $deviceId,
        $command,
        !empty($parameters) ? json_encode($parameters) : null,
        $priority,
        $user['id']
    ]
);

// Log the action
Logger::info('Command sent to device', [
    'device_id' => $deviceId,
    'device_name' => $device['name'],
    'command' => $command,
    'parameters' => $parameters,
    'user_id' => $user['id']
]);

Response::success([
    'command_id' => $commandId,
    'command' => $command,
    'device_id' => $deviceId,
    'device_name' => $device['name'],
    'status' => 'pending',
    'message' => 'Komut cihaza gönderildi'
]);

