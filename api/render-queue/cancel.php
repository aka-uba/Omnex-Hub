<?php
/**
 * Render Queue API - Job İptal
 *
 * POST /api/render-queue/:id/cancel
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
    Response::forbidden('Bu queue\'yu iptal etme yetkiniz yok');
}

// Tamamlanmış/iptal edilmiş job iptal edilemez
if (in_array($queue['status'], ['completed', 'cancelled'])) {
    Response::badRequest('Bu job zaten ' . ($queue['status'] === 'completed' ? 'tamamlanmış' : 'iptal edilmiş'));
}

// İptal et
$queueService = new RenderQueueService();
$queueService->cancelQueue($queueId);

Response::success(['queue_id' => $queueId], 'Render job iptal edildi');
