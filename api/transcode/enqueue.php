<?php
/**
 * Transcode API - Yeni transcode isi olustur
 * POST /api/transcode
 * Body: { media_id, profiles?: ['720p'] }
 */

$db = Database::getInstance();
$user = Auth::user();
if (!$user) Response::unauthorized('Oturum gerekli');

$companyId = Auth::getActiveCompanyId();
// $request router closure'dan gelir
$body = $request->all();

$mediaId = $body['media_id'] ?? null;
if (!$mediaId) {
    Response::error('media_id gerekli', 400);
}

$profiles = $body['profiles'] ?? null;

if ($profiles !== null) {
    if (!is_array($profiles) || empty($profiles)) {
        Response::error('profiles array olmali', 400);
    }

    // Gecerli profiller mi kontrol et
    $validProfiles = array_keys(HlsTranscoder::PROFILES);
    foreach ($profiles as $p) {
        if (!in_array($p, $validProfiles, true)) {
            Response::error("Gecersiz profil: $p. Gecerli: " . implode(', ', $validProfiles), 400);
        }
    }
}

try {
    $service = new TranscodeQueueService();
    $jobId = $service->enqueue($mediaId, $companyId, $profiles);
    $job = $db->fetch("SELECT profiles FROM transcode_queue WHERE id = ?", [$jobId]);
    $effectiveProfiles = json_decode($job['profiles'] ?? '[]', true) ?: [];

    Response::success([
        'job_id' => $jobId,
        'media_id' => $mediaId,
        'profiles' => $effectiveProfiles,
        'message' => 'Transcode isi kuyruge eklendi',
    ], 201);
} catch (\Exception $e) {
    Response::error($e->getMessage(), 400);
}
