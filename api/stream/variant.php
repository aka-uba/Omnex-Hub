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

if (!$token || !$profile) {
    http_response_code(400);
    echo json_encode(['error' => 'Token and profile required']);
    exit;
}

// Token dogrula
$device = $db->fetch(
    "SELECT * FROM devices WHERE stream_token = ? AND stream_mode = true",
    [$token]
);

if (!$device) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid stream token']);
    exit;
}

$companyId = $device['company_id'];

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
// Tum video segmentlerini topla (global segment listesi)
// ====================================================================
$segmentDuration = defined('STREAM_SEGMENT_DURATION') ? STREAM_SEGMENT_DURATION : 6;
$basePath = streamResolveBasePath();
$baseUrl = streamResolveBaseUrl();

// Global segment listesi: her eleman { duration, url }
// NOT: #EXT-X-DISCONTINUITY kaldirildi. Tum videolar HlsTranscoder tarafindan
// ayni codec ayarlariyla (ayni GOP, keyframe interval, audio sample rate)
// encode edildigi icin discontinuity gereksiz. VLC'de discontinuity tag'i
// decoder pipeline reset'e, donmaya ve baslik goruntulemesine neden oluyordu.
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
            ];
            $pendingDuration = null;
            continue;
        }
    }
}

// Segment yoksa 404
if (empty($allSegments)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No transcoded segments found for this profile']);
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
$halfWindow = (int)floor($windowSize / 2);

// Pencere baslangici: current - halfWindow (geride biraz birakiyoruz)
// Bos pencere yok - her zaman windowSize kadar segment goster
$windowStart = $currentSegmentIndex - $halfWindow;

// Global media sequence: monoton artan (HLS spec gereksinimi)
// windowStart negatif olabilir (currentSegmentIndex < halfWindow),
// ama global sequence her zaman pozitif ve artan olmali.
// Burada sequence'i gercek segment ilerleyisi ile esitliyoruz.
// Ortalama sure kullanimi degisken segmentlerde drift olusturur.
$elapsedSegments = ($completedLoops * $totalSegmentCount) + $currentSegmentIndex;
$globalMediaSequence = max(0, $elapsedSegments - $halfWindow);

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
    ""
];

for ($w = 0; $w < $windowSize; $w++) {
    // Dongusel index: negatif veya tasma durumunda modulo ile sar
    $idx = (($windowStart + $w) % $totalSegmentCount + $totalSegmentCount) % $totalSegmentCount;
    $seg = $allSegments[$idx];

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
