<?php
/**
 * ESL Device Alert API
 *
 * POST /api/esl/alert
 * Device Auth required: Authorization: Device <token>
 *
 * Body:
 * - type (required): Alert type (low_battery, connection_lost, sync_failed, error, warning, info)
 * - title (required): Alert title
 * - message: Alert message (optional)
 * - severity: Alert severity (low, medium, high, critical) - default: medium
 * - metadata: Additional data (optional)
 *
 * Response:
 * - success: true
 * - alertId: Created alert ID
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device not authenticated');
}

$deviceId = $device['id'] ?? $device['device_id'];
$recentAlertExpr = "created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'";

// Get request data
$data = $request->json();

// Validate required fields
if (empty($data['type'])) {
    Response::badRequest('Alert type is required');
}

if (empty($data['title'])) {
    Response::badRequest('Alert title is required');
}

$type = strtolower($data['type']);
$title = trim($data['title']);
$message = $data['message'] ?? null;
$severity = strtolower($data['severity'] ?? 'medium');
$metadata = $data['metadata'] ?? null;

// Validate alert type
$validTypes = ['low_battery', 'connection_lost', 'sync_failed', 'error', 'warning', 'info'];
if (!in_array($type, $validTypes)) {
    Response::badRequest('Invalid alert type. Must be one of: ' . implode(', ', $validTypes));
}

// Validate severity
$validSeverities = ['low', 'medium', 'high', 'critical'];
if (!in_array($severity, $validSeverities)) {
    $severity = 'medium';
}

// Auto-escalate severity for critical alert types
if ($type === 'low_battery' && ($device['battery_level'] ?? 100) <= 5) {
    $severity = 'critical';
}

// Check for duplicate recent alerts (within 5 minutes)
$recentAlert = $db->fetch(
    "SELECT id FROM device_alerts
     WHERE device_id = ? AND alert_type = ? AND title = ?
     AND $recentAlertExpr
     AND resolved_at IS NULL",
    [$deviceId, $type, $title]
);

if ($recentAlert) {
    // Update existing alert instead of creating duplicate
    $db->query(
        "UPDATE device_alerts SET message = ?, severity = ?, metadata = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
        [$message, $severity, json_encode($metadata), $recentAlert['id']]
    );

    Response::success([
        'alertId' => $recentAlert['id'],
        'message' => 'Alert updated (duplicate within 5 minutes)',
        'duplicate' => true
    ]);
}

// Create new alert
$alertId = $db->generateUuid();

$db->query(
    "INSERT INTO device_alerts (id, device_id, alert_type, severity, title, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [
        $alertId,
        $deviceId,
        $type,
        $severity,
        $title,
        $message,
        json_encode($metadata)
    ]
);

// Update device status if critical
if ($severity === 'critical' || $type === 'error') {
    $db->query(
        "UPDATE devices SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [$title . ($message ? ': ' . $message : ''), $deviceId]
    );
}

// Log the alert
if (class_exists('Logger')) {
    Logger::warning('ESL device alert', [
        'device_id' => $deviceId,
        'alert_id' => $alertId,
        'type' => $type,
        'severity' => $severity,
        'title' => $title
    ]);
}

// TODO: In the future, trigger notifications to admins for critical alerts

Response::success([
    'alertId' => $alertId,
    'message' => 'Alert created successfully',
    'severity' => $severity
], 201);

