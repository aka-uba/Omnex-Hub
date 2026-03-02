<?php
/**
 * Render Queue API - Job Durumu
 *
 * GET /api/render-queue/:id/status
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

$queueService = new RenderQueueService();
$queue = $queueService->getQueueStatus($queueId);

if (!$queue) {
    Response::notFound('Queue bulunamadı');
}

// Yetki kontrolü
if ($queue['company_id'] !== $companyId && $user['role'] !== 'superadmin') {
    Response::forbidden('Bu queue\'ya erişim yetkiniz yok');
}

Response::success($queue);
