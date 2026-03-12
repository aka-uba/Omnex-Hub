<?php
/**
 * Stream API - M3U wrapper playlist
 * GET /api/stream/{token}/playlist.m3u
 */

$db = Database::getInstance();
require_once __DIR__ . '/helpers.php';

$token = $request->getRouteParam('token');
if (!$token) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token required']);
    exit;
}

$device = $db->fetch(
    "SELECT id, company_id, name FROM devices WHERE stream_token = ? AND stream_mode = true",
    [$token]
);

if (!$device) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid or inactive stream token']);
    exit;
}

$companyName = streamResolveCompanyName($db, $device['company_id'] ?? null);
$streamLabel = streamBuildDisplayLabel($companyName, $device['name'] ?? 'player');
$baseUrl = streamResolveBaseUrl();
$masterUrl = $baseUrl . '/api/stream/' . $token . '/master.m3u8';

$lines = [
    '#EXTM3U',
    '#EXTINF:-1,' . $streamLabel,
    $masterUrl,
    '',
];

$downloadRaw = strtolower((string)$request->query('download', '0'));
$isDownload = in_array($downloadRaw, ['1', 'true', 'yes', 'download'], true);
$contentDisposition = $isDownload ? 'attachment' : 'inline';

$now = date('Y-m-d H:i:s');
try {
    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [$now, $now, $device['id']]
    );
    $db->query(
        "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
         VALUES (?, ?, 'playlist_m3u', ?, ?, ?, 200, ?)",
        [$device['id'], $token, $_SERVER['REQUEST_URI'] ?? '', $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', $now]
    );
} catch (\Throwable $e) {
    // Best effort only.
}

header('Content-Type: audio/x-mpegurl');
header('Content-Disposition: ' . $contentDisposition . '; filename="' . streamBuildSafeFilename($streamLabel, 'm3u') . '"');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('X-Stream-Label: ' . $streamLabel);
echo implode("\n", $lines);
