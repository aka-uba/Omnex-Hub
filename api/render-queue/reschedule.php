<?php
/**
 * Render Queue API - Job Reschedule
 *
 * POST /api/render-queue/:id/reschedule
 *
 * İşin başlama zamanını değiştirir veya hemen başlatır.
 *
 * Request:
 *   {
 *     scheduled_at: "2026-01-22T14:30:00" | null  // null = hemen başlat
 *   }
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/services/RenderQueueService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$queueId = $request->getRouteParam('id');

if (!$queueId) {
    Response::badRequest('Queue ID gerekli');
}

// Queue'yu kontrol et
$queue = $db->fetch(
    "SELECT * FROM render_queue WHERE id = ?",
    [$queueId]
);

if (!$queue) {
    Response::notFound('Queue bulunamadı');
}

// Yetki kontrolü
if ($queue['company_id'] !== $companyId && $user['role'] !== 'superadmin') {
    Response::forbidden('Bu queue\'yu değiştirme yetkiniz yok');
}

// Sadece pending olan job'lar reschedule edilebilir
if ($queue['status'] !== 'pending') {
    Response::badRequest('Sadece bekleyen işler zamanlanabilir');
}

$data = $request->all();
$scheduledAt = $data['scheduled_at'] ?? null;

// Format kontrolü
if ($scheduledAt !== null) {
    // Format kontrolü: 2026-01-22T14:30:00
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/', $scheduledAt)) {
        Response::badRequest('Geçersiz tarih formatı. Format: YYYY-MM-DDTHH:MM:SS');
    }

    // Geçmiş tarih kontrolü
    if (strtotime($scheduledAt) < time()) {
        Response::badRequest('Geçmiş bir tarih seçemezsiniz');
    }
}

// Güncelle
$updateData = ['scheduled_at' => $scheduledAt];
if ($scheduledAt === null) {
    // "Hemen başlat" durumunda retry bekleme kilidini de temizle
    $updateData['next_retry_at'] = null;
}

$result = $db->update(
    'render_queue',
    $updateData,
    'id = ?',
    [$queueId]
);

if ($result === false) {
    Response::error('Zamanlama güncellenemedi');
}

$message = $scheduledAt
    ? "İş " . date('d.m.Y H:i', strtotime($scheduledAt)) . " tarihine zamanlandı"
    : "İş hemen başlatılacak şekilde ayarlandı";

Response::success([
    'queue_id' => $queueId,
    'scheduled_at' => $scheduledAt,
    'immediate' => $scheduledAt === null
], $message);
