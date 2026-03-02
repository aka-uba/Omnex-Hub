<?php
/**
 * Render Queue API - Liste ve İstatistikler
 *
 * GET /api/render-queue         - Queue listesi
 * GET /api/render-queue/stats   - İstatistikler
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/services/RenderQueueService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$queueService = new RenderQueueService();

// İstatistik endpoint'i
if (isset($_GET['stats'])) {
    $stats = $queueService->getStats($companyId);
    Response::success($stats);
}

// Liste parametreleri
$status = $_GET['status'] ?? null;
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

$queues = $queueService->getQueues($companyId, $status, $limit, $offset);

// Toplam sayı
$countSql = "SELECT COUNT(*) as total FROM render_queue WHERE company_id = ?";
$countParams = [$companyId];
if ($status) {
    $countSql .= " AND status = ?";
    $countParams[] = $status;
}
$totalCount = $db->fetch($countSql, $countParams)['total'] ?? 0;

Response::success([
    'queues' => $queues,
    'pagination' => [
        'total' => $totalCount,
        'limit' => $limit,
        'offset' => $offset,
        'has_more' => ($offset + $limit) < $totalCount
    ]
]);
