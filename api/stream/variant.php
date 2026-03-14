<?php
/**
 * Stream API - Variant HLS Playlist
 * GET /api/stream/{token}/variant/{profile}/playlist.m3u8
 *
 * Live HLS modu: Kayan pencere (sliding window) ile sonsuz dongu.
 * IPTV uygulamalari bunu "canli yayin" olarak algilar.
 *
 * Mantik:
 * 1. Tum video item'larinin segmentlerini topla (global segment listesi)
 * 2. stream_started_at referans zamani ile elapsed time hesapla
 * 3. elapsed_time % total_duration = current_position (dongu noktasi)
 * 4. current_position etrafinda WINDOW_SIZE segment goster (~60 segment)
 * 5. EXT-X-MEDIA-SEQUENCE surekli artar (VOD degil, LIVE)
 * 6. #EXT-X-ENDLIST YOK -> IPTV app canli yayin olarak gorur
 */

$db = Database::getInstance();
require_once __DIR__ . '/helpers.php';
$assignmentPlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON dca.content_id = p.id";

$token = $request->getRouteParam('token');
$profile = $request->getRouteParam('profile');

if (!function_exists('streamVariantSyncBootstrapEnabled')) {
    function streamVariantSyncBootstrapEnabled(): bool
    {
        $raw = strtolower(trim((string)(getenv('STREAM_CHANNEL_SYNC_BOOTSTRAP') ?: '1')));
        return !in_array($raw, ['0', 'false', 'no', 'off'], true);
    }
}

if (!$token || !$profile) {
    http_response_code(400);
    echo json_encode(['error' => 'Token and profile required']);
    exit;
}

// Token dogrula
$device = $db->fetch(
    "SELECT * FROM devices
     WHERE stream_token = ?
       AND (
            stream_mode = true
            OR model IN ('stream_player', 'pwa_player')
            OR type IN ('android_tv', 'web_display')
       )",
    [$token]
);

if (!$device) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid stream token']);
    exit;
}

$companyId = $device['company_id'];
$segmentDuration = defined('STREAM_SEGMENT_DURATION') ? STREAM_SEGMENT_DURATION : 6;
$basePath = streamResolveBasePath();
$baseUrl = streamResolveBaseUrl();

if (class_exists('StreamChannelService') && StreamChannelService::isChannelModeEnabled()) {
    $channelService = new StreamChannelService($db);
    $profile = $channelService->normalizeProfile((string)$profile);
    $channelService->touchChannelAccess($token, $profile);
    $channelService->queueBuildRequest($device, $profile, false);

    $channelPlaylist = $channelService->getPublicChannelPlaylist($token, $profile, $baseUrl);
    if ($channelPlaylist === null && streamVariantSyncBootstrapEnabled()) {
        $channelService->ensureChannel($device, $profile, false);
        $channelPlaylist = $channelService->getPublicChannelPlaylist($token, $profile, $baseUrl);
    }

    if ($channelPlaylist !== null) {
        $now = date('Y-m-d H:i:s');
        $db->query(
            "UPDATE devices SET last_stream_request_at = ?, last_seen = ? WHERE id = ?",
            [$now, $now, $device['id']]
        );

        try {
            $db->query(
                "INSERT INTO stream_access_logs (device_id, stream_token, request_type, profile, ip_address, response_status, created_at)
                 VALUES (?, ?, 'variant_channel', ?, ?, 200, ?)",
                [$device['id'], $token, $profile, $_SERVER['REMOTE_ADDR'] ?? '', $now]
            );
        } catch (\Exception $e) {}

        header('Content-Type: application/vnd.apple.mpegurl');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('Access-Control-Allow-Origin: *');
        header('X-Stream-Pipeline: channel');
        echo $channelPlaylist;
        exit;
    }
}

// Aktif playlist'i bul
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

if (empty($playlistItems) && !empty($device['current_playlist_id'])) {
    $p = $db->fetch("SELECT items FROM playlists WHERE id = ?", [$device['current_playlist_id']]);
    if ($p) {
        $playlistItems = json_decode($p['items'] ?? '[]', true) ?: [];
    }
}

// ====================================================================
// Legacy stitched HLS fallback (channel pipeline not ready/disabled)
// ====================================================================

if (!function_exists('streamVariantBuildMediaUrl')) {
    function streamVariantBuildMediaUrl($filePath, $baseUrl, $basePath)
    {
        if (empty($filePath)) return null;
        $normalized = str_replace('\\', '/', $filePath);

        if (preg_match('/^https?:\/\//i', $normalized)) return $normalized;

        if (preg_match('/^[A-Za-z]:/', $normalized)) {
            return $baseUrl . '/api/media/serve.php?path=' . urlencode($filePath);
        }

        if (strpos($normalized, 'storage/') === 0) {
            return $baseUrl . '/' . $normalized;
        }

        return $baseUrl . '/storage/' . ltrim($normalized, '/');
    }
}

// Global segment listesi: her eleman { duration, url, media_id }
// Farkli kaynak videolar birlestirildiginde TS zaman damgalari sifirlanabildigi
// icin gecislerde #EXT-X-DISCONTINUITY etiketi zorunludur (ozellikle VLC/ffmpeg).
$allSegments = [];

foreach ($playlistItems as $item) {
    $itemType = $item['type'] ?? '';
    $mediaId = $item['media_id'] ?? $item['id'] ?? null;

    if ($itemType !== 'video' || !$mediaId) continue;

    $variant = $db->fetch(
        "SELECT * FROM transcode_variants WHERE media_id = ? AND company_id = ? AND profile = ? AND status = 'ready'",
        [$mediaId, $companyId, $profile]
    );

    if (!$variant || empty($variant['playlist_path'])) continue;

    $variantPlaylistPath = $variant['playlist_path'];
    if (!file_exists($variantPlaylistPath)) continue;

    $variantContent = file_get_contents($variantPlaylistPath);
    $variantLines = explode("\n", $variantContent);

    $pendingDuration = null;

    foreach ($variantLines as $vLine) {
        $vLine = trim($vLine);
        if (empty($vLine)) continue;

        // Header/footer satirlarini atla
        if (strpos($vLine, '#EXTM3U') === 0) continue;
        if (strpos($vLine, '#EXT-X-VERSION') === 0) continue;
        if (strpos($vLine, '#EXT-X-TARGETDURATION') === 0) continue;
        if (strpos($vLine, '#EXT-X-MEDIA-SEQUENCE') === 0) continue;
        if (strpos($vLine, '#EXT-X-ENDLIST') === 0) continue;

        // EXTINF: sure bilgisi
        if (strpos($vLine, '#EXTINF:') === 0) {
            if (preg_match('/#EXTINF:([\d.]+)/', $vLine, $dm)) {
                $pendingDuration = (float)$dm[1];
            }
            continue;
        }

        // Segment dosya referansi
        if (strpos($vLine, '#') !== 0 && strpos($vLine, 'segment_') !== false) {
            $segmentFilename = basename($vLine);
            $segmentUrl = "{$baseUrl}/api/stream/{$token}/segment/{$mediaId}/{$profile}/{$segmentFilename}";
            $dur = $pendingDuration ?? (float)$segmentDuration;

            $allSegments[] = [
                'duration'       => $dur,
                'url'            => $segmentUrl,
                'media_id'       => (string)$mediaId,
            ];
            $pendingDuration = null;
            continue;
        }
    }
}

// Segment yoksa passthrough fallback
if (empty($allSegments)) {
    $directVideos = [];

    foreach ($playlistItems as $item) {
        $itemType = $item['type'] ?? '';

        if ($itemType === 'stream') {
            $streamUrl = (string)($item['url'] ?? '');
            if ($streamUrl === '') {
                continue;
            }

            $isMuted = isset($item['muted'])
                ? ($item['muted'] !== false && $item['muted'] !== 0 && $item['muted'] !== '0')
                : true;

            $directVideos[] = [
                'duration' => (int)($item['duration'] ?? -1),
                'url' => $streamUrl,
                'muted' => $isMuted,
            ];
            continue;
        }

        if ($itemType !== 'video') {
            continue;
        }

        $mediaId = $item['media_id'] ?? $item['id'] ?? null;
        if (!$mediaId) {
            continue;
        }

        $media = $db->fetch(
            "SELECT id, file_path FROM media WHERE id = ?",
            [$mediaId]
        );
        if (!$media || empty($media['file_path'])) {
            continue;
        }

        $url = streamVariantBuildMediaUrl($media['file_path'], $baseUrl, $basePath);
        if (!$url) {
            continue;
        }

        $isMuted = isset($item['muted'])
            ? ($item['muted'] !== false && $item['muted'] !== 0 && $item['muted'] !== '0')
            : true;

        $directVideos[] = [
            'duration' => (int)($item['duration'] ?? -1),
            'url' => $url,
            'muted' => $isMuted,
        ];
    }

    if (empty($directVideos)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'No transcoded segments found for this profile']);
        exit;
    }

    $itemLines = [];
    foreach ($directVideos as $video) {
        $itemLines[] = "#EXTINF:" . (int)$video['duration'] . ",";
        if (!empty($video['muted'])) {
            $itemLines[] = "#EXTVLCOPT:no-audio";
        }
        $itemLines[] = $video['url'];
    }

    $totalDuration = 0;
    foreach ($directVideos as $video) {
        $dur = (int)$video['duration'];
        $totalDuration += $dur > 0 ? $dur : 30;
    }
    $targetSeconds = 604800; // 7 gun
    $repeatCount = $totalDuration > 0 ? (int)ceil($targetSeconds / $totalDuration) : 500;
    $repeatCount = max(500, min(25000, $repeatCount));

    $lines = ["#EXTM3U"];
    for ($i = 0; $i < $repeatCount; $i++) {
        foreach ($itemLines as $line) {
            $lines[] = $line;
        }
    }

    try {
        $db->query(
            "INSERT INTO stream_access_logs (device_id, stream_token, request_type, profile, ip_address, response_status, created_at)
             VALUES (?, ?, 'variant_passthrough', ?, ?, 200, ?)",
            [$device['id'], $token, $profile, $_SERVER['REMOTE_ADDR'] ?? '', date('Y-m-d H:i:s')]
        );
    } catch (\Exception $e) {}

    header('Content-Type: application/x-mpegurl; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Access-Control-Allow-Origin: *');
    header('X-Stream-Fallback: passthrough');
    header('X-Stream-Fallback-Format: m3u');
    echo implode("\n", $lines) . "\n";
    exit;
}

// ====================================================================
// Live HLS Sliding Window hesaplamasi
// ====================================================================
$totalSegmentCount = count($allSegments);

// Toplam playlist suresi
$totalDuration = 0.0;
foreach ($allSegments as $seg) {
    $totalDuration += $seg['duration'];
}
if ($totalDuration <= 0) {
    $totalDuration = (float)$segmentDuration * max(1, $totalSegmentCount);
}

// stream_started_at referans zamani (yoksa simdi set et)
$streamStarted = $device['stream_started_at'] ?? null;
if (!$streamStarted) {
    $streamStarted = date('Y-m-d H:i:s');
    $db->query(
        "UPDATE devices SET stream_started_at = ? WHERE id = ?",
        [$streamStarted, $device['id']]
    );
}

$startTimestamp = strtotime($streamStarted);
$now = time();
$elapsed = max(0, $now - $startTimestamp);

// Dongu pozisyonu: elapsed modulo total_duration
$currentPosition = fmod((float)$elapsed, $totalDuration);

// currentPosition'dan hangi segment'te oldugunu bul
$accumulatedTime = 0.0;
$currentSegmentIndex = 0;
for ($i = 0; $i < $totalSegmentCount; $i++) {
    if ($accumulatedTime + $allSegments[$i]['duration'] > $currentPosition) {
        $currentSegmentIndex = $i;
        break;
    }
    $accumulatedTime += $allSegments[$i]['duration'];
}

// Kac tam dongu yapildi (media sequence icin)
$completedLoops = (int)floor((float)$elapsed / $totalDuration);

// Window boyutu: ~6 dakika = ~60 segment (6sn per segment)
$windowSize = min(60, $totalSegmentCount);

// VLC stabilitesi icin pencereyi aktif videonun ilk segmentine hizala.
// Boylece playlist segment_0001/0002 ile baslamaz.
$windowStart = $currentSegmentIndex;
$currentMediaId = $allSegments[$currentSegmentIndex]['media_id'] ?? '';
for ($step = 0; $step < $totalSegmentCount; $step++) {
    $prevIdx = (($windowStart - 1) % $totalSegmentCount + $totalSegmentCount) % $totalSegmentCount;
    if (($allSegments[$prevIdx]['media_id'] ?? '') !== $currentMediaId) {
        break;
    }
    $windowStart = $prevIdx;
}

// Global media sequence: dongu + pencere baslangic index'i
$globalMediaSequence = max(0, ($completedLoops * $totalSegmentCount) + $windowStart);

// Live sliding window'da discontinuity offset'i de monoton olmalidir.
$isDiscontinuityBoundary = static function (int $index) use ($allSegments, $totalSegmentCount): bool {
    $prevIdx = (($index - 1) % $totalSegmentCount + $totalSegmentCount) % $totalSegmentCount;
    return (($allSegments[$prevIdx]['media_id'] ?? '') !== ($allSegments[$index]['media_id'] ?? ''));
};

$discontinuitiesPerLoop = 0;
for ($i = 0; $i < $totalSegmentCount; $i++) {
    if ($isDiscontinuityBoundary($i)) {
        $discontinuitiesPerLoop++;
    }
}

$discontinuitiesBeforeWindowStart = 0;
for ($i = 0; $i < $windowStart; $i++) {
    if ($isDiscontinuityBoundary($i)) {
        $discontinuitiesBeforeWindowStart++;
    }
}

$globalDiscontinuitySequence = max(
    0,
    ($completedLoops * $discontinuitiesPerLoop) + $discontinuitiesBeforeWindowStart
);

// ====================================================================
// HLS playlist ciktisi (LIVE mod - EXT-X-ENDLIST YOK)
// ====================================================================
// EXT-X-TARGETDURATION: segmentlerdeki maksimum surenin ceil degeri (HLS spec)
$maxSegDuration = 0.0;
foreach ($allSegments as $seg) {
    if ($seg['duration'] > $maxSegDuration) {
        $maxSegDuration = $seg['duration'];
    }
}
$targetDuration = (int)ceil($maxSegDuration > 0 ? $maxSegDuration : $segmentDuration);

$lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:{$targetDuration}",
    "#EXT-X-MEDIA-SEQUENCE:{$globalMediaSequence}",
    "#EXT-X-DISCONTINUITY-SEQUENCE:{$globalDiscontinuitySequence}",
    ""
];

for ($w = 0; $w < $windowSize; $w++) {
    // Dongusel index: negatif veya tasma durumunda modulo ile sar
    $idx = (($windowStart + $w) % $totalSegmentCount + $totalSegmentCount) % $totalSegmentCount;
    $seg = $allSegments[$idx];

    // Farkli kaynak video segmentine geciste decoder'a zaman tabani reset ipucu ver.
    if ($w > 0) {
        $prevIdx = (($windowStart + $w - 1) % $totalSegmentCount + $totalSegmentCount) % $totalSegmentCount;
        $prevSeg = $allSegments[$prevIdx];
        if (($prevSeg['media_id'] ?? '') !== ($seg['media_id'] ?? '')) {
            $lines[] = "#EXT-X-DISCONTINUITY";
        }
    }

    $lines[] = "#EXTINF:{$seg['duration']},";
    $lines[] = $seg['url'];
}

// #EXT-X-ENDLIST YOK -> IPTV app bunu canli yayin olarak gorur

// Device activity guncelle
$db->query(
    "UPDATE devices SET last_stream_request_at = ?, last_seen = ? WHERE id = ?",
    [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $device['id']]
);

// Access log
try {
    $db->query(
        "INSERT INTO stream_access_logs (device_id, stream_token, request_type, profile, ip_address, response_status, created_at)
         VALUES (?, ?, 'variant_live', ?, ?, 200, ?)",
        [$device['id'], $token, $profile, $_SERVER['REMOTE_ADDR'] ?? '', date('Y-m-d H:i:s')]
    );
} catch (\Exception $e) {}

// Live HLS playlist cache'lenmemeli (VLC/PWA eski m3u8 tutmasin)
header('Content-Type: application/vnd.apple.mpegurl');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
echo implode("\n", $lines);
