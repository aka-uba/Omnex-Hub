<?php
/**
 * Stream API - Heartbeat
 * GET /api/stream/{token}/heartbeat
 *
 * VLC/IPTV cihaz durumu icin opsiyonel heartbeat.
 * Cihaz bu endpoint'i periyodik cagirabilir.
 */

$db = Database::getInstance();
// $request router closure'dan gelir

$token = $request->getRouteParam('token');
if (!$token) {
    http_response_code(400);
    echo json_encode(['error' => 'Token required']);
    exit;
}

$device = $db->fetch(
    "SELECT id, company_id, name, status FROM devices WHERE stream_token = ? AND stream_mode = 1",
    [$token]
);

if (!$device) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid stream token']);
    exit;
}

$now = date('Y-m-d H:i:s');

// Cihaz durumunu guncelle
$db->query(
    "UPDATE devices SET last_seen = ?, last_stream_request_at = ?, last_heartbeat = ?, status = 'online' WHERE id = ?",
    [$now, $now, $now, $device['id']]
);

// Heartbeat kaydini ekle
try {
    $db->insert('device_heartbeats', [
        'id' => $db->generateUuid(),
        'device_id' => $device['id'],
        'status' => 'playing',
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'metadata' => json_encode(['source' => 'stream_heartbeat', 'token' => substr($token, 0, 8) . '...']),
        'created_at' => $now,
    ]);
} catch (\Exception $e) {}

// Access log
try {
    $db->query(
        "INSERT INTO stream_access_logs (device_id, stream_token, request_type, ip_address, response_status, created_at)
         VALUES (?, ?, 'heartbeat', ?, 200, ?)",
        [$device['id'], $token, $_SERVER['REMOTE_ADDR'] ?? '', $now]
    );
} catch (\Exception $e) {}

header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'status' => 'ok',
    'serverTime' => $now,
    'deviceName' => $device['name'],
]);
