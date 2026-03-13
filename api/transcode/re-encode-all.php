<?php
/**
 * Transcode API - Re-encode All Variants
 * POST /api/transcode/re-encode-all
 *
 * Mevcut tum transcode edilmis videolari yeni FFmpeg keyframe/GOP
 * ayarlariyla yeniden encode kuyruguna ekler.
 * VLC gecis donma sorununu cozmek icin kullanilir.
 *
 * Admin yetkisi gerektirir.
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Sadece admin ve superadmin
if (!in_array($user['role'], ['superadmin', 'admin'])) {
    Response::forbidden('Bu islem icin admin yetkisi gerekli');
}

$companyId = Auth::getActiveCompanyId();

try {
    $service = new TranscodeQueueService();

    // SuperAdmin tum firmalar icin yapabilir, admin sadece kendi firmasi
    $targetCompanyId = ($user['role'] === 'superadmin') ? null : $companyId;
    $result = $service->reEncodeAll($targetCompanyId);

    Response::success([
        'queued' => $result['queued'],
        'skipped' => $result['skipped'],
        'errors' => $result['errors'],
        'message' => $result['queued'] . ' video yeniden encode kuyruguna eklendi'
    ]);
} catch (\Throwable $e) {
    Response::error('Re-encode baslatma hatasi: ' . $e->getMessage(), 500);
}
