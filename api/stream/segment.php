<?php
/**
 * Stream API - Segment Servisi
 * GET /api/stream/{token}/segment/{mediaId}/{profile}/{filename}
 *
 * HLS .ts segment dosyalarini disk'ten okuyup sunar.
 * Hafif token dogrulama + agresif cache header.
 */

$db = Database::getInstance();
// $request router closure'dan gelir

$token = $request->getRouteParam('token');
$mediaId = $request->getRouteParam('mediaId');
$profile = $request->getRouteParam('profile');
$filename = $request->getRouteParam('filename');

if (!$token || !$mediaId || !$profile || !$filename) {
    http_response_code(400);
    exit;
}

// Guvenlik: Path traversal engelle
if (preg_match('/[\/\\\\]|\.\./', $filename)) {
    http_response_code(400);
    exit;
}

// Hafif token dogrulama (sadece varlik kontrolu - performans icin)
$device = $db->fetch(
    "SELECT id, company_id FROM devices WHERE stream_token = ? AND stream_mode = 1",
    [$token]
);

if (!$device) {
    http_response_code(403);
    exit;
}

// Segment dosya yolunu olustur
$streamStorage = defined('STREAM_STORAGE_PATH') ? STREAM_STORAGE_PATH : (defined('STORAGE_PATH') ? STORAGE_PATH . '/streams' : 'storage/streams');
$segmentPath = $streamStorage . '/' . $device['company_id'] . '/' . $mediaId . '/' . $profile . '/' . $filename;

if (!file_exists($segmentPath)) {
    http_response_code(404);
    exit;
}

// Content-Type belirleme
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$contentTypes = [
    'ts' => 'video/MP2T',
    'mp4' => 'video/mp4',
    'm4s' => 'video/mp4',
    'm3u8' => 'application/vnd.apple.mpegurl',
];
$contentType = $contentTypes[$ext] ?? 'application/octet-stream';

$fileSize = filesize($segmentPath);

// last_seen guncelle (her segment icin yapmak agir olabilir, 10 saniyede bir)
static $lastUpdate = 0;
$now = time();
if ($now - $lastUpdate > 10) {
    $db->query(
        "UPDATE devices SET last_stream_request_at = ?, last_seen = ?, status = 'online' WHERE id = ?",
        [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $device['id']]
    );
    $lastUpdate = $now;
}

// Segment'ler degismez - agresif cache
header("Content-Type: {$contentType}");
header("Content-Length: {$fileSize}");
header('Cache-Control: public, max-age=86400, immutable');
header('Access-Control-Allow-Origin: *');

// Dosyayi stream et
readfile($segmentPath);
