<?php
/**
 * Render Queue API - Job Retry
 *
 * POST /api/render-queue/:id/retry
 *
 * Body (opsiyonel):
 * {
 *   "error_type": "unknown",
 *   "device_ids": ["device-uuid-1", "device-uuid-2"]
 * }
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
$data = $request->all();

if (!$queueId) {
    Response::badRequest('Queue ID gerekli');
}

// Queue'yu kontrol et
$queue = $db->fetch(
    "SELECT * FROM render_queue WHERE id = ?",
    [$queueId]
);

if (!$queue) {
    Response::notFound('Queue bulunamadi');
}

// Yetki kontrolu
if ($queue['company_id'] !== $companyId && $user['role'] !== 'superadmin') {
    Response::forbidden('Bu queue icin tekrar deneme yetkiniz yok');
}

// Sadece failed veya failed item iceren completed job'lar retry edilebilir
if (!in_array($queue['status'], ['failed', 'completed'], true)) {
    Response::badRequest('Sadece basarisiz veya kismi basarisiz joblar tekrar denenebilir');
}

$deviceIds = $data['device_ids'] ?? null;
if ($deviceIds !== null && !is_array($deviceIds)) {
    Response::badRequest('device_ids array olmalidir');
}

$deviceIds = is_array($deviceIds)
    ? array_values(array_unique(array_filter($deviceIds, static fn($id) => is_string($id) && $id !== '')))
    : [];

$failedSql = "SELECT COUNT(*) as count FROM render_queue_items WHERE queue_id = ? AND status = 'failed'";
$failedParams = [$queueId];

if (!empty($deviceIds)) {
    $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
    $failedSql .= " AND device_id IN ($placeholders)";
    $failedParams = array_merge($failedParams, $deviceIds);
}

$failedItems = $db->fetch($failedSql, $failedParams);
if (((int)($failedItems['count'] ?? 0)) === 0) {
    if (!empty($deviceIds)) {
        Response::badRequest('Secili cihazlar icin tekrar denenecek basarisiz item yok');
    }
    Response::badRequest('Bu job icin tekrar denenecek basarisiz cihaz yok');
}

// Retry planla
$queueService = new RenderQueueService();
$errorType = $data['error_type'] ?? 'unknown';

if (!empty($deviceIds)) {
    $result = $queueService->scheduleRetryForDevices($queueId, $deviceIds, $errorType);
} else {
    $result = $queueService->scheduleRetry($queueId, $errorType);
}

if (!$result['success']) {
    Response::error($result['error']);
}

Response::success($result, 'Retry planlandi');
