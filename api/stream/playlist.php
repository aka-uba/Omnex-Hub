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
        return '1080p';
    }
}

if (!function_exists('streamPlaylistResolveAvailableProfiles')) {
    function streamPlaylistResolveAvailableProfiles($db, array $device): array
    {
        $assignmentPlaylistJoin = $db->isPostgres()
            ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
            : "LEFT JOIN playlists p ON dca.content_id = p.id";
        $schedulePlaylistJoin = $db->isPostgres()
            ? "LEFT JOIN playlists p ON CAST(s.content_id AS TEXT) = CAST(p.id AS TEXT)"
            : "LEFT JOIN playlists p ON s.content_id = p.id";

        $playlistItems = [];

        $assignment = $db->fetch(
            "SELECT p.items FROM device_content_assignments dca
             $assignmentPlaylistJoin
             WHERE dca.device_id = ? AND dca.status = 'active' AND dca.content_type = 'playlist'
             ORDER BY dca.created_at DESC LIMIT 1",
            [$device['id']]
        );

        if ($assignment) {
            $playlistItems = json_decode($assignment['items'] ?? '[]', true) ?: [];
        }

        if (empty($playlistItems)) {
            $now = date('Y-m-d H:i:s');
            $currentTime = date('H:i:s');
            $schedule = $db->fetch(
                "SELECT p.items FROM schedules s
                 JOIN schedule_devices sd ON s.id = sd.schedule_id
                 $schedulePlaylistJoin
                 WHERE sd.device_id = ? AND s.status = 'active'
                 AND (s.start_date IS NULL OR s.start_date <= ?)
                 AND (s.end_date IS NULL OR s.end_date >= ?)
                 AND (s.start_time IS NULL OR s.start_time <= ?)
                 AND (s.end_time IS NULL OR s.end_time >= ?)
                 ORDER BY s.priority DESC LIMIT 1",
                [$device['id'], $now, $now, $currentTime, $currentTime]
            );

            if ($schedule) {
                $playlistItems = json_decode($schedule['items'] ?? '[]', true) ?: [];
            }
        }

        if (empty($playlistItems) && !empty($device['current_playlist_id'])) {
            $playlist = $db->fetch("SELECT items FROM playlists WHERE id = ?", [$device['current_playlist_id']]);
            if ($playlist) {
                $playlistItems = json_decode($playlist['items'] ?? '[]', true) ?: [];
            }
        }

        $mediaIds = [];
        foreach ($playlistItems as $item) {
            $itemType = $item['type'] ?? '';
            $mediaId = $item['media_id'] ?? $item['id'] ?? null;
            if ($itemType === 'video' && $mediaId) {
                $mediaIds[] = (string)$mediaId;
            }
        }
        $mediaIds = array_values(array_unique($mediaIds));
        if (empty($mediaIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($mediaIds), '?'));
        $params = array_merge([(string)$device['company_id']], $mediaIds);

        $rows = $db->fetchAll(
            "SELECT profile, COUNT(*) as cnt
             FROM transcode_variants
             WHERE company_id = ? AND status = 'ready' AND media_id IN ($placeholders)
             GROUP BY profile",
            $params
        );

        $available = [];
        foreach ($rows as $row) {
            $profile = strtolower((string)($row['profile'] ?? ''));
            if ($profile !== '') {
                $available[$profile] = (int)($row['cnt'] ?? 0);
            }
        }

        return $available;
    }
}

if (!function_exists('streamPlaylistSelectProfile')) {
    function streamPlaylistSelectProfile(array $availableProfiles, string $requestedProfile, string $autoProfile): string
    {
        $allowed = ['360p', '540p', '720p', '1080p'];
        $requested = strtolower(trim($requestedProfile));
        $auto = strtolower(trim($autoProfile));

        if (!in_array($auto, $allowed, true)) {
            $auto = '720p';
        }

        if (empty($availableProfiles)) {
            if (in_array($requested, $allowed, true)) {
                return $requested;
            }
            // Availability data bulunamazsa uyumluluk icin 1080p yerine 720p'e in.
            return $auto === '1080p' ? '720p' : $auto;
        }

        if (in_array($requested, $allowed, true) && isset($availableProfiles[$requested])) {
            return $requested;
        }
        if (isset($availableProfiles[$auto])) {
            return $auto;
        }

        $fallbackOrder = [
            '1080p' => ['720p', '540p', '360p'],
            '720p' => ['540p', '360p', '1080p'],
            '540p' => ['360p', '720p', '1080p'],
            '360p' => ['540p', '720p', '1080p'],
        ];

        foreach ($fallbackOrder[$auto] as $candidate) {
            if (isset($availableProfiles[$candidate])) {
                return $candidate;
            }
        }

        foreach (['720p', '540p', '360p', '1080p'] as $candidate) {
            if (isset($availableProfiles[$candidate])) {
                return $candidate;
            }
        }

        return $auto;
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
$autoProfile = streamPlaylistResolveProfile($device, '');
$availableProfiles = streamPlaylistResolveAvailableProfiles($db, $device);
$selectedProfile = streamPlaylistSelectProfile($availableProfiles, $requestedProfile, $autoProfile);
$targetUrl = $baseUrl . '/api/stream/' . $token . '/variant/' . $selectedProfile . '/playlist.m3u8';
$showLabelRaw = strtolower((string)$request->query('label', '1'));
$showLabel = !in_array($showLabelRaw, ['0', 'false', 'no'], true);
$extInfTitle = $showLabel ? $streamLabel : '';

$downloadRaw = strtolower((string)$request->query('download', '0'));
$isDownload = in_array($downloadRaw, ['1', 'true', 'yes', 'download'], true);
$modeRaw = strtolower((string)$request->query('mode', 'm3u'));
$isRedirectMode = !$isDownload && ($modeRaw === 'redirect' || $modeRaw === 'stream' || $modeRaw === 'direct');
$contentDisposition = $isDownload ? 'attachment' : 'inline';

if ($isRedirectMode) {
    $now = date('Y-m-d H:i:s');
    try {
        $db->query(
            "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
            [$now, $now, $device['id']]
        );
        $db->query(
            "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
             VALUES (?, ?, 'playlist_redirect', ?, ?, ?, 302, ?)",
            [$device['id'], $token, $_SERVER['REQUEST_URI'] ?? '', $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', $now]
        );
    } catch (\Throwable $e) {
        // Best effort only.
    }

    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    header('X-Stream-Profile: ' . $selectedProfile);
    header('X-Stream-Target: ' . $targetUrl);
    header('X-Stream-Profile-Requested: ' . ($requestedProfile !== '' ? $requestedProfile : 'auto'));
    header('X-Stream-Profile-Auto: ' . $autoProfile);
    header('Location: ' . $targetUrl, true, 302);
    exit;
}

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

$lines = [
    '#EXTM3U',
    '#EXTINF:-1,' . $extInfTitle,
    $targetUrl,
    '',
];

header('Content-Type: application/x-mpegURL; charset=utf-8');
if ($isDownload) {
    header('Content-Disposition: ' . $contentDisposition . '; filename="' . streamBuildSafeFilename($streamLabel, 'm3u') . '"');
}
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('X-Stream-Label: ' . $streamLabel);
header('X-Stream-Profile: ' . $selectedProfile);
header('X-Stream-Target: ' . $targetUrl);
header('X-Stream-Profile-Requested: ' . ($requestedProfile !== '' ? $requestedProfile : 'auto'));
header('X-Stream-Profile-Auto: ' . $autoProfile);
echo implode("\n", $lines);
