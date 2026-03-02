<?php
/**
 * ESL Device Logging API
 *
 * POST /api/esl/log
 * Device Auth required: Authorization: Device <token>
 *
 * Body:
 * - level (required): Log level (debug, info, warning, error)
 * - message (required): Log message
 * - context: Additional context data (optional)
 * - timestamp: Client timestamp (optional)
 *
 * Or for batch logging:
 * - logs: Array of log entries
 *
 * Response:
 * - success: true
 * - received: Number of log entries received
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device not authenticated');
}

$deviceId = $device['id'] ?? $device['device_id'];

// Get request data
$data = $request->json();

// Handle batch logs
$logs = [];
if (isset($data['logs']) && is_array($data['logs'])) {
    $logs = $data['logs'];
} else {
    // Single log entry
    if (empty($data['level']) || empty($data['message'])) {
        Response::badRequest('Log level and message are required');
    }
    $logs = [$data];
}

// Validate and insert logs
$validLevels = ['debug', 'info', 'warning', 'error'];
$inserted = 0;

foreach ($logs as $log) {
    $level = strtolower($log['level'] ?? 'info');
    $message = $log['message'] ?? '';
    $context = $log['context'] ?? null;
    $clientTimestamp = $log['timestamp'] ?? null;

    // Validate level
    if (!in_array($level, $validLevels)) {
        $level = 'info';
    }

    // Skip empty messages
    if (empty($message)) {
        continue;
    }

    // Determine action type for device_logs table
    $action = 'error'; // default
    if ($level === 'info' || $level === 'debug') {
        $action = 'sync';
    }

    // Insert into device_logs
    $db->query(
        "INSERT INTO device_logs (id, device_id, action, status, request_data, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            $db->generateUuid(),
            $deviceId,
            $action,
            $level === 'error' ? 'failed' : 'success',
            json_encode([
                'level' => $level,
                'context' => $context,
                'client_timestamp' => $clientTimestamp
            ]),
            $message,
            $clientTimestamp ? date('Y-m-d H:i:s', strtotime($clientTimestamp)) : date('Y-m-d H:i:s')
        ]
    );

    $inserted++;

    // If it's an error, also create an alert
    if ($level === 'error') {
        $db->query(
            "INSERT INTO device_alerts (id, device_id, alert_type, severity, title, message, metadata, created_at)
             VALUES (?, ?, 'error', 'medium', ?, ?, ?, CURRENT_TIMESTAMP)",
            [
                $db->generateUuid(),
                $deviceId,
                'Device Error',
                $message,
                json_encode($context)
            ]
        );
    }
}

// Log server-side if Logger is available
if (class_exists('Logger') && $inserted > 0) {
    Logger::debug('ESL device logs received', [
        'device_id' => $deviceId,
        'count' => $inserted
    ]);
}

Response::success([
    'received' => $inserted,
    'message' => "Received $inserted log entries"
]);

