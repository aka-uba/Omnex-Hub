<?php
/**
 * Stream API - Stream Bilgi (Panel icin)
 * GET /api/stream/{deviceId}/info
 * Auth: User JWT (admin panelden cagrilir)
 */

$db = Database::getInstance();
$assignmentPlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON dca.content_id = p.id";
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// $request router closure'dan gelir
$deviceId = $request->getRouteParam('deviceId');

if (!$deviceId) {
    Response::error('Device ID gerekli', 400);
}

$companyId = Auth::getActiveCompanyId();
$device = $db->fetch(
    "SELECT * FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::error('Cihaz bulunamadi', 404);
}

// Stream durumu hesapla
$streamStatus = 'offline';
$lastRequest = $device['last_stream_request_at'] ?? null;
if ($lastRequest) {
    $secondsAgo = time() - strtotime($lastRequest);
    if ($secondsAgo <= 60) {
        $streamStatus = 'online';
    } elseif ($secondsAgo <= 300) {
        $streamStatus = 'weak';
    }
}

// Son 1 saatlik metrikler
$oneHourAgo = date('Y-m-d H:i:s', time() - 3600);
$metrics = $db->fetch(
    "SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN request_type='segment' THEN 1 ELSE 0 END) as segment_requests,
        SUM(CASE WHEN request_type='master' THEN 1 ELSE 0 END) as master_requests,
        SUM(CASE WHEN request_type='variant' THEN 1 ELSE 0 END) as variant_requests,
        SUM(response_bytes) as total_bytes,
        AVG(latency_ms) as avg_latency,
        MAX(created_at) as last_activity
    FROM stream_access_logs
    WHERE device_id = ? AND created_at >= ?",
    [$deviceId, $oneHourAgo]
);

// Segments per minute (son 5 dk)
$fiveMinAgo = date('Y-m-d H:i:s', time() - 300);
$recentSegments = $db->fetch(
    "SELECT COUNT(*) as cnt FROM stream_access_logs
     WHERE device_id = ? AND request_type = 'segment' AND created_at >= ?",
    [$deviceId, $fiveMinAgo]
);
$segmentsPerMinute = round(($recentSegments['cnt'] ?? 0) / 5, 1);

// Aktif playlist bilgisi
$currentPlaylist = null;
$assignment = $db->fetch(
    "SELECT p.id, p.name FROM device_content_assignments dca
     $assignmentPlaylistJoin
     WHERE dca.device_id = ? AND dca.status = 'active' AND dca.content_type = 'playlist'
     ORDER BY dca.created_at DESC LIMIT 1",
    [$deviceId]
);
if ($assignment) {
    $currentPlaylist = ['id' => $assignment['id'], 'name' => $assignment['name']];
}

// Stream URL olustur
$streamUrl = null;
if ($device['stream_mode'] && !empty($device['stream_token'])) {
    $appUrl = defined('APP_URL') ? APP_URL : '';
    $streamUrl = $appUrl . '/api/stream/' . $device['stream_token'] . '/master.m3u8';
}

Response::success([
    'device_id' => $deviceId,
    'stream_mode' => (bool)$device['stream_mode'],
    'stream_token' => $device['stream_token'] ?? null,
    'stream_url' => $streamUrl,
    'stream_status' => $streamStatus,
    'last_stream_request' => $lastRequest,
    'device_profile' => !empty($device['device_profile']) ? json_decode($device['device_profile'], true) : null,
    'current_playlist' => $currentPlaylist,
    'metrics' => [
        'total_requests_1h' => (int)($metrics['total_requests'] ?? 0),
        'segment_requests_1h' => (int)($metrics['segment_requests'] ?? 0),
        'master_requests_1h' => (int)($metrics['master_requests'] ?? 0),
        'total_bytes_1h' => (int)($metrics['total_bytes'] ?? 0),
        'avg_latency_ms' => round((float)($metrics['avg_latency'] ?? 0), 1),
        'segments_per_minute' => $segmentsPerMinute,
        'last_activity' => $metrics['last_activity'] ?? null,
    ],
]);
