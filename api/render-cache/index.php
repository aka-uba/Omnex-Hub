<?php
/**
 * Render Cache API - Liste ve İstatistikler
 *
 * GET /api/render-cache
 * GET /api/render-cache?stats=true - Sadece istatistikler
 * GET /api/render-cache?pending=true - Bekleyen job'lar
 */

require_once BASE_PATH . '/services/RenderCacheService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$cacheService = new RenderCacheService();
$jobProductJoin = $db->isPostgres()
    ? 'LEFT JOIN products p ON CAST(p.id AS TEXT) = CAST(rj.product_id AS TEXT)'
    : 'LEFT JOIN products p ON p.id = rj.product_id';
$cacheProductJoin = $db->isPostgres()
    ? 'LEFT JOIN products p ON CAST(p.id AS TEXT) = CAST(rc.product_id AS TEXT)'
    : 'LEFT JOIN products p ON p.id = rc.product_id';
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(t.id AS TEXT) = CAST(rj.template_id AS TEXT)'
    : 'LEFT JOIN templates t ON t.id = rj.template_id';
$cacheTemplateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(t.id AS TEXT) = CAST(rc.template_id AS TEXT)'
    : 'LEFT JOIN templates t ON t.id = rc.template_id';

// Sadece istatistikler
if (!empty($_GET['stats'])) {
    $stats = $cacheService->getStats($companyId);
    Response::success($stats);
}

// Bekleyen job'lar
if (!empty($_GET['pending'])) {
    $pendingJobs = $db->fetchAll(
        "SELECT rj.*, p.name as product_name, p.sku, t.name as template_name
         FROM render_jobs rj
         $jobProductJoin
         $templateJoin
         WHERE rj.company_id = ? AND rj.status IN ('pending', 'processing')
         ORDER BY
            CASE rj.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END,
            rj.created_at ASC
         LIMIT 100",
        [$companyId]
    );

    Response::success([
        'jobs' => $pendingJobs,
        'total' => count($pendingJobs)
    ]);
}

// Batch durumu
if (!empty($_GET['batch_id'])) {
    $batchStatus = $cacheService->getBatchStatus($_GET['batch_id']);
    Response::success($batchStatus);
}

// Genel liste ve istatistikler
$stats = $cacheService->getStats($companyId);

// Son render job'ları
$recentJobs = $db->fetchAll(
    "SELECT rj.*, p.name as product_name, t.name as template_name
     FROM render_jobs rj
     $jobProductJoin
     $templateJoin
     WHERE rj.company_id = ?
     ORDER BY rj.created_at DESC
     LIMIT 50",
    [$companyId]
);

// Cache durumundaki ürünler
$cachedProducts = $db->fetchAll(
    "SELECT rc.*, p.name as product_name, p.sku, t.name as template_name
     FROM render_cache rc
     $cacheProductJoin
     $cacheTemplateJoin
     WHERE rc.company_id = ? AND rc.status = 'ready'
     ORDER BY rc.rendered_at DESC
     LIMIT 50",
    [$companyId]
);

Response::success([
    'stats' => $stats,
    'recent_jobs' => $recentJobs,
    'cached_products' => $cachedProducts,
    'pending_count' => $cacheService->getPendingJobCount($companyId)
]);
