<?php
/**
 * Transcode API - Kuyruk listesi
 * GET /api/transcode
 */

$db = Database::getInstance();
$user = Auth::user();
if (!$user) Response::unauthorized('Oturum gerekli');

$companyId = Auth::getActiveCompanyId();
// $request router closure'dan gelir

$page = (int)($request->query('page', 1));
$perPage = min(50, max(1, (int)($request->get('per_page') ?? 20)));
$status = $request->get('status');
$offset = ($page - 1) * $perPage;

$where = "tq.company_id = ?";
$params = [$companyId];

if ($status) {
    $where .= " AND tq.status = ?";
    $params[] = $status;
}

$total = $db->fetch("SELECT COUNT(*) as cnt FROM transcode_queue tq WHERE $where", $params);
$totalCount = (int)($total['cnt'] ?? 0);

$jobs = $db->fetchAll(
    "SELECT tq.*, m.name as media_name, m.original_name, m.file_type, m.mime_type
     FROM transcode_queue tq
     LEFT JOIN media m ON tq.media_id = m.id
     WHERE $where
     ORDER BY tq.created_at DESC
     LIMIT $perPage OFFSET $offset",
    $params
);

foreach ($jobs as &$job) {
    $job['profiles'] = json_decode($job['profiles'] ?? '[]', true);
    // Variant bilgileri
    $job['variants'] = $db->fetchAll(
        "SELECT profile, resolution, status, segment_count, total_size_bytes
         FROM transcode_variants WHERE media_id = ? AND company_id = ?",
        [$job['media_id'], $companyId]
    );
}

$service = new TranscodeQueueService();
$stats = $service->getQueueStats($companyId);

Response::success([
    'jobs' => $jobs,
    'stats' => $stats,
    'pagination' => [
        'total' => $totalCount,
        'page' => $page,
        'per_page' => $perPage,
        'last_page' => ceil($totalCount / $perPage),
    ],
]);
