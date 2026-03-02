<?php
/**
 * Transcode API - Is durumu sorgula
 * GET /api/transcode/{id}/status
 */

$db = Database::getInstance();
$user = Auth::user();
if (!$user) Response::unauthorized('Oturum gerekli');

$companyId = Auth::getActiveCompanyId();
// $request router closure'dan gelir
$jobId = $request->getRouteParam('id');

if (!$jobId) {
    Response::error('Job ID gerekli', 400);
}

$job = $db->fetch(
    "SELECT tq.*, m.name as media_name
     FROM transcode_queue tq
     LEFT JOIN media m ON tq.media_id = m.id
     WHERE tq.id = ? AND tq.company_id = ?",
    [$jobId, $companyId]
);

if (!$job) {
    Response::error('Is bulunamadi', 404);
}

$job['profiles'] = json_decode($job['profiles'] ?? '[]', true);
$job['variants'] = $db->fetchAll(
    "SELECT * FROM transcode_variants WHERE media_id = ? AND company_id = ? ORDER BY bitrate ASC",
    [$job['media_id'], $companyId]
);

Response::success($job);
