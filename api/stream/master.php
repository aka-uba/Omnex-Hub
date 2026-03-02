<?php
/**
 * Stream API - Master HLS Playlist
 * GET /api/stream/{token}/master.m3u8
 *
 * VLC/IPTV player'lar bu endpoint'i acar.
 * Cihazin aktif playlist'indeki videolari adaptive HLS olarak sunar.
 */

$db = Database::getInstance();
$assignmentPlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON dca.content_id = p.id";
$schedulePlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(s.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON s.content_id = p.id";
// $request router closure'dan gelir - yeni olusturma (route params kaybolur)

// Token'i route'dan al
$token = $request->getRouteParam('token');
if (!$token) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token required']);
    exit;
}

// Token ile cihazi bul
$device = $db->fetch(
    "SELECT * FROM devices WHERE stream_token = ? AND stream_mode = 1",
    [$token]
);

if (!$device) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid or inactive stream token']);
    exit;
}

$companyId = $device['company_id'];
$deviceProfile = !empty($device['device_profile']) ? json_decode($device['device_profile'], true) : null;

// Cihazin aktif playlist'ini bul
$playlist = null;
$playlistItems = [];

// 1. Oncelik: Dogrudan atanmis playlist
$assignment = $db->fetch(
    "SELECT dca.*, p.id as playlist_id, p.name as playlist_name, p.items as playlist_items
     FROM device_content_assignments dca
     $assignmentPlaylistJoin
     WHERE dca.device_id = ? AND dca.status = 'active' AND dca.content_type = 'playlist'
     ORDER BY dca.created_at DESC LIMIT 1",
    [$device['id']]
);

if ($assignment && $assignment['playlist_id']) {
    $playlist = ['id' => $assignment['playlist_id'], 'name' => $assignment['playlist_name']];
    $playlistItems = json_decode($assignment['playlist_items'] ?? '[]', true) ?: [];
}

// 2. Fallback: Zamanlama bazli
if (!$playlist) {
    $now = date('Y-m-d H:i:s');
    $currentTime = date('H:i:s');
    $schedule = $db->fetch(
        "SELECT s.*, sd.device_id, p.id as playlist_id, p.name as playlist_name, p.items as playlist_items
         FROM schedules s
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

    if ($schedule && $schedule['playlist_id']) {
        $playlist = ['id' => $schedule['playlist_id'], 'name' => $schedule['playlist_name']];
        $playlistItems = json_decode($schedule['playlist_items'] ?? '[]', true) ?: [];
    }
}

// 3. Fallback: current_playlist_id
if (!$playlist && !empty($device['current_playlist_id'])) {
    $p = $db->fetch("SELECT * FROM playlists WHERE id = ?", [$device['current_playlist_id']]);
    if ($p) {
        $playlist = ['id' => $p['id'], 'name' => $p['name']];
        $playlistItems = json_decode($p['items'] ?? '[]', true) ?: [];
    }
}

if (!$playlist || empty($playlistItems)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No active playlist found']);
    exit;
}

// Video item'lari filtrele ve transcode variant'larini topla
$transcodeService = new TranscodeQueueService();
$streamVariants = [];

foreach ($playlistItems as $item) {
    $itemType = $item['type'] ?? '';
    $mediaId = $item['media_id'] ?? $item['id'] ?? null;

    if ($itemType !== 'video' || !$mediaId) continue;

    $variants = $transcodeService->getReadyVariants($mediaId);
    if (!empty($variants)) {
        $streamVariants[] = [
            'media_id' => $mediaId,
            'name' => $item['name'] ?? 'Video',
            'duration' => (float)($item['duration'] ?? 0),
            'variants' => $variants,
        ];
    }
}

// Base path hesapla (hem HLS hem passthrough icin ortak)
$basePath = '';
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
if (preg_match('#^(.*)/api/#', $scriptName, $m)) {
    $basePath = $m[1];
}
// Fallback: BASE_PATH'ten hesapla
if (!$basePath && defined('BASE_PATH')) {
    $docRoot = str_replace('\\', '/', rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/\\'));
    $fsBase = str_replace('\\', '/', BASE_PATH);
    if ($docRoot && strpos($fsBase, $docRoot) === 0) {
        $basePath = rtrim(substr($fsBase, strlen($docRoot)), '/');
    }
}

// Protocol + host
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$baseUrl = $scheme . '://' . $host . $basePath;

// Fonksiyon: medya dosyasinin tam URL'sini olustur
function buildMediaUrl($filePath, $baseUrl, $basePath) {
    if (empty($filePath)) return null;
    $normalized = str_replace('\\', '/', $filePath);

    // Zaten HTTP URL ise aynen dondur
    if (preg_match('/^https?:\/\//i', $normalized)) return $normalized;

    // Windows absolute path -> serve.php proxy
    if (preg_match('/^[A-Za-z]:/', $normalized)) {
        return $baseUrl . '/api/media/serve.php?path=' . urlencode($filePath);
    }

    // storage/ ile basliyorsa
    if (strpos($normalized, 'storage/') === 0) {
        return $baseUrl . '/' . $normalized;
    }

    return $baseUrl . '/storage/' . ltrim($normalized, '/');
}

// ====================================================================
// PASSTHROUGH MODE: Transcode yoksa orijinal videolari M3U olarak sun
// Desteklenen tipler: video (medya dosyasi), stream (HLS/m3u8 URL)
// ====================================================================
if (empty($streamVariants)) {

    // Orijinal video dosyalarini ve stream URL'lerini topla
    $directVideos = [];
    $trackIndex = 0;
    $playlistName = $playlist['name'] ?? 'Playlist';

    foreach ($playlistItems as $item) {
        $itemType = $item['type'] ?? '';

        // --- Stream tipi: m3u8/HLS/RTSP URL dogrudan eklenir ---
        if ($itemType === 'stream') {
            $streamUrl = $item['url'] ?? '';
            if (empty($streamUrl)) continue;

            $trackIndex++;
            $isMuted = isset($item['muted']) ? ($item['muted'] !== false && $item['muted'] !== 0 && $item['muted'] !== '0') : true;
            $itemName = $item['name'] ?? 'Stream';

            $directVideos[] = [
                'duration' => (int)($item['duration'] ?? -1),
                'url' => $streamUrl,
                'name' => $itemName,
                'muted' => $isMuted,
                'is_stream' => true,
            ];
            continue;
        }

        // --- Video tipi: medya dosyasindan URL olustur ---
        if ($itemType !== 'video') continue;
        $mediaId = $item['media_id'] ?? $item['id'] ?? null;
        if (!$mediaId) continue;

        $media = $db->fetch(
            "SELECT id, name, file_path, mime_type, file_size FROM media WHERE id = ?",
            [$mediaId]
        );
        if (!$media || empty($media['file_path'])) continue;

        $url = buildMediaUrl($media['file_path'], $baseUrl, $basePath);
        if (!$url) continue;

        $trackIndex++;
        // muted: varsayilan true (playlist'te muted !== false ise sesli degil)
        $isMuted = isset($item['muted']) ? ($item['muted'] !== false && $item['muted'] !== 0 && $item['muted'] !== '0') : true;

        $directVideos[] = [
            'duration' => (int)($item['duration'] ?? -1),
            'url' => $url,
            'name' => $media['name'] ?? 'Video',
            'muted' => $isMuted,
            'is_stream' => false,
        ];
    }

    if (empty($directVideos)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'No playable content found in playlist (video or stream items required)']);
        exit;
    }

    // last_stream_request_at guncelle (passthrough modunda stream_started_at gerekmez)
    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $device['id']]
    );

    // Access log
    try {
        $db->query(
            "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
             VALUES (?, ?, 'master_passthrough', ?, ?, ?, 200, ?)",
            [$device['id'], $token, $_SERVER['REQUEST_URI'] ?? '', $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', date('Y-m-d H:i:s')]
        );
    } catch (\Exception $e) {}

    // Tarayici erisimini engelle - sadece VLC/IPTV/media player erisebilir
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
    $isBrowser = (
        stripos($acceptHeader, 'text/html') !== false &&
        (stripos($userAgent, 'Mozilla') !== false || stripos($userAgent, 'Chrome') !== false)
        && stripos($userAgent, 'VLC') === false
        && stripos($userAgent, 'IPTV') === false
        && stripos($userAgent, 'Kodi') === false
        && stripos($userAgent, 'ExoPlayer') === false
        && stripos($userAgent, 'Lavf') === false
        && stripos($userAgent, 'mpv') === false
        && stripos($userAgent, 'Windows-Media-Player') === false
        && stripos($userAgent, 'NSPlayer') === false
        && stripos($userAgent, 'MPlayer') === false
    );

    if ($isBrowser) {
        http_response_code(403);
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
        echo json_encode([
            'error' => 'Browser access not allowed',
            'message' => 'Bu stream sadece VLC, IPTV veya media player uygulamalari ile izlenebilir. Tarayici ile erisim engellenmistir.',
            'hint' => 'VLC > Medya > Ag Akisi Ac > URL yapistir'
        ]);
        exit;
    }

    // M3U playlist (VLC/IPTV uyumlu + sonsuz dongu destegi)
    $lines = ["#EXTM3U"];

    // Playlist item'lari olustur (tekli blok - sonra tekrarlanacak)
    $itemLines = [];
    foreach ($directVideos as $v) {
        // EXTINF: sure, title
        // Title bos birakilir = VLC isim gostermez
        // Bosluk " " = WMP URL yerine bos gosterir
        $itemLines[] = "#EXTINF:{$v['duration']}, ";

        // VLC: ses kapaliysa no-audio direktifi
        // NOT: Windows Media Player #EXTVLCOPT'u tanImaz, WMP icin M3U ses kontrolu yok
        if ($v['muted']) {
            $itemLines[] = "#EXTVLCOPT:no-audio";
        }

        $itemLines[] = $v['url'];
    }

    // Dinamik dongu: 72 saat (3 gun) dolduracak kadar tekrarla
    // M3U duz metin - 10.000 tur bile ~3MB, playerlar rahat parse eder
    $totalDuration = 0;
    foreach ($directVideos as $v) {
        $dur = $v['duration'] > 0 ? $v['duration'] : 30;
        $totalDuration += $dur;
    }
    $targetSeconds = 604800; // 7 gun (1 hafta)
    $repeatCount = ($totalDuration > 0) ? (int)ceil($targetSeconds / $totalDuration) : 10000;
    $repeatCount = max($repeatCount, 500);    // minimum 500 tur
    $repeatCount = min($repeatCount, 25000);  // maksimum 25.000 tur (~7MB)

    for ($i = 0; $i < $repeatCount; $i++) {
        foreach ($itemLines as $line) {
            $lines[] = $line;
        }
    }

    header('Content-Type: audio/x-mpegurl');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    header('Content-Disposition: inline; filename="playlist.m3u"');
    echo implode("\n", $lines) . "\n";
    exit;
}

// ====================================================================
// HLS MODE: Transcode variant'lari varsa adaptive HLS master playlist
// ====================================================================

// Profilleri topla (tum videolarda ortak olanlar)
$availableProfiles = [];
foreach ($streamVariants as $sv) {
    foreach ($sv['variants'] as $v) {
        $profile = $v['profile'];
        if (!isset($availableProfiles[$profile])) {
            $availableProfiles[$profile] = $v;
        }
    }
}

// Device profile filtresi (Faz B icin hazir)
if ($deviceProfile && !empty($deviceProfile['max_res'])) {
    $maxHeight = (int)str_replace('p', '', $deviceProfile['max_res']);
    foreach ($availableProfiles as $name => $v) {
        $height = (int)str_replace('p', '', $name);
        if ($height > $maxHeight) {
            unset($availableProfiles[$name]);
        }
    }
}

// HLS master playlist ciktisi
$lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""];

foreach ($availableProfiles as $profileName => $variant) {
    $profileDef = HlsTranscoder::PROFILES[$profileName] ?? null;
    if (!$profileDef) continue;

    $bandwidth = ($variant['bitrate'] ?? $profileDef['bitrate']) * 1000;
    $resolution = $variant['resolution'] ?? ($profileDef['width'] . 'x' . $profileDef['height']);

    $lines[] = "#EXT-X-STREAM-INF:BANDWIDTH={$bandwidth},RESOLUTION={$resolution},NAME=\"{$profileName}\"";
    $lines[] = "{$basePath}/api/stream/{$token}/variant/{$profileName}/playlist.m3u8";
    $lines[] = "";
}

// stream_started_at: Ilk HLS stream isteginde set et (live window referans zamani)
// Zaten set edilmisse dokunma (playlist degisince NULL'a cekilir)
$now = date('Y-m-d H:i:s');
if (empty($device['stream_started_at'])) {
    $db->query(
        "UPDATE devices SET stream_started_at = ?, last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [$now, $now, $now, $device['id']]
    );
} else {
    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [$now, $now, $device['id']]
    );
}

// Access log
try {
    $db->query(
        "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
         VALUES (?, ?, 'master', ?, ?, ?, 200, ?)",
        [$device['id'], $token, $_SERVER['REQUEST_URI'] ?? '', $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', date('Y-m-d H:i:s')]
    );
} catch (\Exception $e) {
    // Log hatasini yutma - kritik degil
}

// M3U8 response
header('Content-Type: application/vnd.apple.mpegurl');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
echo implode("\n", $lines);
