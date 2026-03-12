<?php
/**
 * Stream API - Master HLS Playlist
 * GET /api/stream/{token}/master.m3u8
 *
 * VLC/IPTV player'lar bu endpoint'i acar.
 * Cihazin aktif playlist'indeki videolari adaptive HLS olarak sunar.
 */

$db = Database::getInstance();
require_once __DIR__ . '/helpers.php';
$assignmentPlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON dca.content_id = p.id";
$schedulePlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(s.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON s.content_id = p.id";
// $request router closure'dan gelir - yeni olusturma (route params kaybolur)

/**
 * "720p", "1280x720", "720", "FullHD 1080p" gibi degerlerden yukseklik cikarir.
 */
function streamExtractHeight($value): ?int {
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

/**
 * Cihaz icin maksimum oynatma yuksekligini hesaplar.
 */
function streamResolveDeviceMaxHeight(array $device, ?array $deviceProfile): ?int {
    $candidates = [];

    if (is_array($deviceProfile)) {
        foreach (['max_res', 'max_resolution', 'resolution', 'max_profile', 'max_height'] as $key) {
            if (!empty($deviceProfile[$key])) {
                $h = streamExtractHeight($deviceProfile[$key]);
                if ($h) {
                    $candidates[] = $h;
                }
            }
        }
    }

    $screenW = (int)($device['screen_width'] ?? 0);
    $screenH = (int)($device['screen_height'] ?? 0);
    if ($screenW > 0 || $screenH > 0) {
        $candidates[] = max($screenW, $screenH);
    }

    if (empty($candidates)) {
        return null;
    }

    return max($candidates);
}

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
    "SELECT * FROM devices WHERE stream_token = ? AND stream_mode = true",
    [$token]
);

if (!$device) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid or inactive stream token']);
    exit;
}

$companyId = $device['company_id'];
$companyName = streamResolveCompanyName($db, $companyId);
$streamLabel = streamBuildDisplayLabel($companyName, $device['name'] ?? 'player');
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
$missingVariantMediaIds = [];

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
    } else {
        $missingVariantMediaIds[] = (string)$mediaId;
    }
}

// HLS variant yoksa otomatik transcode kuyruğu olustur (best-effort)
if (!empty($missingVariantMediaIds)) {
    $missingVariantMediaIds = array_values(array_unique($missingVariantMediaIds));
    foreach ($missingVariantMediaIds as $missingMediaId) {
        try {
            $transcodeService->enqueue($missingMediaId, $companyId, null);
        } catch (\Throwable $e) {
            error_log("[stream master] auto enqueue skipped for media {$missingMediaId}: " . $e->getMessage());
        }
    }
}

// Base path hesapla (hem HLS hem passthrough icin ortak)
$basePath = streamResolveBasePath();
$baseUrl = streamResolveBaseUrl();

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
// STRICT HLS MODE:
// - Video item'lar yalnizca transcode edilmis HLS variant'lari ile sunulur.
// - Variant hazir degilse istemciye "hazirlaniyor" yaniti verilir.
// ====================================================================
if (empty($streamVariants)) {
    $now = date('Y-m-d H:i:s');
    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [$now, $now, $device['id']]
    );

    try {
        $db->query(
            "INSERT INTO stream_access_logs (device_id, stream_token, request_type, request_path, ip_address, user_agent, response_status, created_at)
             VALUES (?, ?, 'master_waiting_transcode', ?, ?, ?, 503, ?)",
            [$device['id'], $token, $_SERVER['REQUEST_URI'] ?? '', $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', $now]
        );
    } catch (\Exception $e) {
        // Log hatasi kritik degil.
    }

    http_response_code(503);
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Retry-After: 5');
    header('Access-Control-Allow-Origin: *');
    echo json_encode([
        'error' => 'Stream is preparing',
        'message' => 'HLS variants are not ready yet. Please retry shortly.',
        'retry_after_seconds' => 5,
        'pending_media_ids' => $missingVariantMediaIds
    ]);
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

// Cihaz profili / ekran cozunurlugu bazli profil filtresi
$allProfiles = $availableProfiles;
$deviceMaxHeight = streamResolveDeviceMaxHeight($device, $deviceProfile);
if ($deviceMaxHeight !== null) {
    foreach ($availableProfiles as $name => $v) {
        $profileDef = HlsTranscoder::PROFILES[$name] ?? null;
        $profileHeight = $profileDef['height'] ?? streamExtractHeight($v['resolution'] ?? $name) ?? 0;
        if ($profileHeight > $deviceMaxHeight) {
            unset($availableProfiles[$name]);
        }
    }
}

// Filtreleme sonrasi profil kalmazsa en yakin profili tut
if (empty($availableProfiles) && !empty($allProfiles)) {
    if ($deviceMaxHeight !== null) {
        $bestName = null;
        $bestHeight = 0;
        foreach ($allProfiles as $name => $v) {
            $profileDef = HlsTranscoder::PROFILES[$name] ?? null;
            $profileHeight = $profileDef['height'] ?? streamExtractHeight($v['resolution'] ?? $name) ?? 0;
            if ($profileHeight <= $deviceMaxHeight && $profileHeight >= $bestHeight) {
                $bestName = $name;
                $bestHeight = $profileHeight;
            }
        }
        if ($bestName !== null) {
            $availableProfiles[$bestName] = $allProfiles[$bestName];
        }
    }

    if (empty($availableProfiles)) {
        // Son fallback: en dusuk bitrate profili
        uasort($allProfiles, static function ($a, $b) {
            return (int)($a['bitrate'] ?? 0) <=> (int)($b['bitrate'] ?? 0);
        });
        $first = array_key_first($allProfiles);
        if ($first !== null) {
            $availableProfiles[$first] = $allProfiles[$first];
        }
    }
}

// Profilleri bitrate'e gore dusukten yuksege sirala
uksort($availableProfiles, static function ($left, $right) use ($availableProfiles) {
    $leftBitrate = (int)($availableProfiles[$left]['bitrate'] ?? (HlsTranscoder::PROFILES[$left]['bitrate'] ?? 0));
    $rightBitrate = (int)($availableProfiles[$right]['bitrate'] ?? (HlsTranscoder::PROFILES[$right]['bitrate'] ?? 0));
    if ($leftBitrate === $rightBitrate) {
        return strcmp((string)$left, (string)$right);
    }
    return $leftBitrate <=> $rightBitrate;
});

// HLS master playlist ciktisi
$lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-SESSION-DATA:DATA-ID=\"com.omnex.stream.title\",VALUE=\"{$streamLabel}\"",
    "",
];

foreach ($availableProfiles as $profileName => $variant) {
    $profileDef = HlsTranscoder::PROFILES[$profileName] ?? null;
    $bitrateKbps = (int)($variant['bitrate'] ?? ($profileDef['bitrate'] ?? 1000));
    $bandwidth = max(128000, $bitrateKbps * 1000);
    $resolution = $variant['resolution'] ?? ($profileDef ? ($profileDef['width'] . 'x' . $profileDef['height']) : '1280x720');

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
header('Content-Disposition: inline; filename="' . streamBuildSafeFilename($streamLabel, 'm3u8') . '"');
header('X-Stream-Label: ' . $streamLabel);
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
echo implode("\n", $lines);
