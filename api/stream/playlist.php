<?php
/**
 * Stream API - M3U wrapper playlist
 * GET /api/stream/{token}/playlist.m3u
 */

$db = Database::getInstance();
require_once __DIR__ . '/helpers.php';

if (!function_exists('streamPlaylistExtractHeight')) {
    function streamPlaylistExtractHeight($value): ?int
    {
        if ($value === null) return null;
        $v = trim((string)$value);
        if ($v === '') return null;

        if (preg_match('/(\d{3,4})\s*x\s*(\d{3,4})/i', $v, $m)) {
            return max((int)$m[1], (int)$m[2]);
        }
        if (preg_match('/(\d{3,4})\s*p/i', $v, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^\d{3,4}$/', $v)) {
            return (int)$v;
        }

        return null;
    }
}

if (!function_exists('streamPlaylistResolveProfile')) {
    function streamPlaylistResolveProfile(array $device, string $requestedProfile): string
    {
        $allowed = ['360p', '540p', '720p', '1080p'];
        $requestedProfile = strtolower(trim($requestedProfile));
        if (in_array($requestedProfile, $allowed, true)) {
            return $requestedProfile;
        }

        $deviceProfile = [];
        if (!empty($device['device_profile'])) {
            if (is_array($device['device_profile'])) {
                $deviceProfile = $device['device_profile'];
            } elseif (is_string($device['device_profile'])) {
                $decoded = json_decode($device['device_profile'], true);
                if (is_array($decoded)) {
                    $deviceProfile = $decoded;
                }
            }
        }

        $height = null;
        foreach (['max_res', 'max_resolution', 'resolution', 'max_profile', 'max_height'] as $key) {
            if (!empty($deviceProfile[$key])) {
                $height = streamPlaylistExtractHeight($deviceProfile[$key]);
                if ($height) break;
            }
        }

        if (!$height) {
            $screenW = (int)($device['screen_width'] ?? 0);
            $screenH = (int)($device['screen_height'] ?? 0);
            $height = max($screenW, $screenH);
        }

        if ($height <= 0) return '720p';
        if ($height <= 360) return '360p';
        if ($height <= 540) return '540p';
        // IPTV tarafinda 1080p adaptasyonu her uygulamada stabil olmadigi icin
        // otomatik secimi 720p'de sinirla; 1080p isteyen istemci query ile isteyebilir.
        return '720p';
    }
}

$token = $request->getRouteParam('token');
if (!$token) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token required']);
    exit;
}

$device = $db->fetch(
    "SELECT id, company_id, name, device_profile, screen_width, screen_height FROM devices WHERE stream_token = ? AND stream_mode = true",
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
$requestedProfile = (string)$request->query('profile', '');
$selectedProfile = streamPlaylistResolveProfile($device, $requestedProfile);
$targetUrl = $baseUrl . '/api/stream/' . $token . '/variant/' . $selectedProfile . '/playlist.m3u8';
$showLabelRaw = strtolower((string)$request->query('label', '1'));
$showLabel = !in_array($showLabelRaw, ['0', 'false', 'no'], true);
$extInfTitle = $showLabel ? $streamLabel : '';

$lines = [
    '#EXTM3U',
    '#EXTINF:-1,' . $extInfTitle,
    $targetUrl,
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
header('X-Stream-Profile: ' . $selectedProfile);
echo implode("\n", $lines);
