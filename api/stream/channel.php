<?php
/**
 * Stream API - Channel pipeline output
 *
 * Routes:
 * - GET /api/stream/{token}/channel/{profile}/playlist.m3u8
 * - GET /api/stream/{token}/channel/{profile}/{filename}
 */

$db = Database::getInstance();
require_once __DIR__ . '/helpers.php';

$token = (string)$request->getRouteParam('token');
$profile = (string)$request->getRouteParam('profile');
$filename = $request->getRouteParam('filename');

if ($token === '' || $profile === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token and profile required']);
    exit;
}

if (!class_exists('StreamChannelService') || !StreamChannelService::isChannelModeEnabled()) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Channel mode disabled']);
    exit;
}

$channelService = new StreamChannelService($db);
$device = $channelService->getDeviceByToken($token);
if (!$device) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid stream token']);
    exit;
}

$profile = $channelService->normalizeProfile($profile);
$channelService->touchChannelAccess($token, $profile);

$requestPath = (string)($_SERVER['REQUEST_URI'] ?? '');
$remoteIp = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$now = date('Y-m-d H:i:s');

if ($filename === null || $filename === '') {
    $channelService->queueBuildRequest($device, $profile, false);

    $playlistContent = $channelService->getPublicChannelPlaylist($token, $profile, streamResolveBaseUrl());
    $syncBootstrap = strtolower((string)(getenv('STREAM_CHANNEL_SYNC_BOOTSTRAP') ?: '1'));
    $bootstrapEnabled = !in_array($syncBootstrap, ['0', 'false', 'no', 'off'], true);

    if ($playlistContent === null && $bootstrapEnabled) {
        $channelService->ensureChannel($device, $profile, false);
        $playlistContent = $channelService->getPublicChannelPlaylist($token, $profile, streamResolveBaseUrl());
    }

    if ($playlistContent === null) {
        http_response_code(503);
        header('Retry-After: 2');
        header('Content-Type: application/json');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Access-Control-Allow-Origin: *');
        echo json_encode(['error' => 'Channel is building, retry shortly']);
        exit;
    }

    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [$now, $now, $device['id']]
    );

    try {
        $db->query(
            "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
             VALUES (?, ?, 'channel_playlist', ?, ?, ?, 200, ?)",
            [$device['id'], $token, $requestPath, $remoteIp, $userAgent, $now]
        );
    } catch (\Throwable $e) {
        // Best effort.
    }

    header('Content-Type: application/vnd.apple.mpegurl');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Access-Control-Allow-Origin: *');
    header('X-Stream-Pipeline: channel');
    echo $playlistContent;
    exit;
}

if (preg_match('/[\/\\\\]|\.\./', (string)$filename)) {
    http_response_code(400);
    exit;
}

$filePath = $channelService->getChannelFilePath($token, $profile, (string)$filename);
if (!is_file($filePath)) {
    http_response_code(404);
    exit;
}

$ext = strtolower((string)pathinfo((string)$filename, PATHINFO_EXTENSION));
$contentTypes = [
    'ts' => 'video/MP2T',
    'm3u8' => 'application/vnd.apple.mpegurl',
    'm4s' => 'video/mp4',
    'mp4' => 'video/mp4',
];
$contentType = $contentTypes[$ext] ?? 'application/octet-stream';
$fileSize = filesize($filePath);

header("Content-Type: {$contentType}");
if ($fileSize !== false) {
    header('Content-Length: ' . (string)$fileSize);
}
header('Cache-Control: public, max-age=30');
header('Access-Control-Allow-Origin: *');
header('X-Stream-Pipeline: channel');
readfile($filePath);
