<?php
/**
 * Render Queue API - Batch Retry
 *
 * POST /api/render-queue/batch/:batchId/retry
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
$batchId = $request->getRouteParam('batchId');
$data = $request->all();

if (!$batchId) {
    Response::badRequest('Batch ID gerekli');
}

$deviceIds = $data['device_ids'] ?? null;
if ($deviceIds !== null && !is_array($deviceIds)) {
    Response::badRequest('device_ids array olmalidir');
}

$deviceIds = is_array($deviceIds)
    ? array_values(array_unique(array_filter($deviceIds, static fn($id) => is_string($id) && $id !== '')))
    : [];

$errorType = $data['error_type'] ?? 'unknown';

$jobs = $db->fetchAll(
    "SELECT id, status, product_name
     FROM render_queue
     WHERE batch_id = ? AND company_id = ?
     ORDER BY created_at ASC",
    [$batchId, $companyId]
);

if (empty($jobs)) {
    Response::notFound('Batch bulunamadi');
}

$queueService = new RenderQueueService();
$retriedJobs = 0;
$skippedJobs = 0;
$details = [];
$errors = [];

foreach ($jobs as $job) {
    $jobId = $job['id'];

    // Sadece failed / completed joblar retry adayi
    if (!in_array($job['status'], ['failed', 'completed'], true)) {
        $skippedJobs++;
        $details[] = [
            'queue_id' => $jobId,
            'status' => $job['status'],
            'retried' => false,
            'reason' => 'job_not_retryable'
        ];
        continue;
    }

    $failedSql = "SELECT COUNT(*) as count
                  FROM render_queue_items
                  WHERE queue_id = ? AND status = 'failed'";
    $failedParams = [$jobId];

    if (!empty($deviceIds)) {
        $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
        $failedSql .= " AND device_id IN ($placeholders)";
        $failedParams = array_merge($failedParams, $deviceIds);
    }

    $failedCount = (int)($db->fetch($failedSql, $failedParams)['count'] ?? 0);
    if ($failedCount === 0) {
        $skippedJobs++;
        $details[] = [
            'queue_id' => $jobId,
            'status' => $job['status'],
            'retried' => false,
            'reason' => 'no_failed_items'
        ];
        continue;
    }

    if (!empty($deviceIds)) {
        $result = $queueService->scheduleRetryForDevices($jobId, $deviceIds, $errorType);
    } else {
        $result = $queueService->scheduleRetry($jobId, $errorType);
    }

    if (!empty($result['success'])) {
        $retriedJobs++;
        $details[] = [
            'queue_id' => $jobId,
            'status' => $job['status'],
            'retried' => true,
            'retry_count' => $result['retry_count'] ?? null,
            'next_retry_at' => $result['next_retry_at'] ?? null,
            'target_failed_items' => $result['target_failed_items'] ?? $failedCount
        ];
    } else {
        $errors[] = [
            'queue_id' => $jobId,
            'error' => $result['error'] ?? 'retry_failed'
        ];
        $details[] = [
            'queue_id' => $jobId,
            'status' => $job['status'],
            'retried' => false,
            'reason' => 'retry_failed'
        ];
    }
}

if ($retriedJobs === 0) {
    Response::error('Batch icinde tekrar denenecek uygun job bulunamadi', 400, [
        'batch_id' => $batchId,
        'retried_jobs' => 0,
        'skipped_jobs' => $skippedJobs,
        'errors' => $errors,
        'details' => $details
    ]);
}

Response::success([
    'batch_id' => $batchId,
    'retried_jobs' => $retriedJobs,
    'skipped_jobs' => $skippedJobs,
    'errors' => $errors,
    'details' => $details,
    'filtered_by_devices' => !empty($deviceIds)
], "$retriedJobs job retry kuyruuna alindi");

