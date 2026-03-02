<?php
/**
 * Render Queue Analytics API
 *
 * GET /api/render-queue/analytics
 *
 * Operational Visibility Mini-Phase:
 * - Queue state dashboard verileri
 * - En çok tekrar eden hata tipleri
 * - Ortalama tamamlanma süresi
 * - En çok bekleyen priority
 * - Trend verileri (son 24 saat, 7 gün)
 */

require_once __DIR__ . '/../../config.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$now = date('Y-m-d H:i:s');
$since24h = date('Y-m-d H:i:s', strtotime('-24 hours'));
$since7d = date('Y-m-d H:i:s', strtotime('-7 days'));
$isPostgres = $db->isPostgres();

// ========================================
// 1. GENEL KUYRUK DURUMU
// ========================================

// Aktif kuyruklar (status bazlı)
$queueStatusCounts = $db->fetchAll(
    "SELECT status, COUNT(*) as count
     FROM render_queue
     WHERE company_id = ?
     GROUP BY status",
    [$companyId]
);

$queueStatus = [
    'pending' => 0,
    'processing' => 0,
    'completed' => 0,
    'failed' => 0,
    'cancelled' => 0,
    'total' => 0
];

foreach ($queueStatusCounts as $row) {
    $queueStatus[$row['status']] = (int)$row['count'];
    $queueStatus['total'] += (int)$row['count'];
}

// Aktif işlenen cihaz sayısı
$activeItems = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ? AND rqi.status = 'processing'",
    [$companyId]
);

$queueStatus['processing_items'] = (int)($activeItems['count'] ?? 0);

// Şu an işlenmeye hazır olan pending job sayısı (scheduled_at geçmiş veya NULL)
$readyCondition = $isPostgres
    ? "(scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
       AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)"
    : "(scheduled_at IS NULL OR REPLACE(scheduled_at, 'T', ' ') <= ?)
       AND (next_retry_at IS NULL OR REPLACE(next_retry_at, 'T', ' ') <= ?)";
$readyParams = $isPostgres ? [$companyId] : [$companyId, $now, $now];
$readyToProcess = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue
     WHERE company_id = ? AND status = 'pending'
       AND $readyCondition",
    $readyParams
);
$queueStatus['ready_to_process'] = (int)($readyToProcess['count'] ?? 0);

// ========================================
// 2. PRİORİTY BAZLI ANALİZ
// ========================================

// Tüm işler priority bazlı (toplam + aktif)
$priorityAll = $db->fetchAll(
    "SELECT priority,
            COUNT(*) as total_jobs,
            SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as active_jobs,
            SUM(CASE WHEN status IN ('pending', 'processing') THEN devices_total - devices_completed - devices_failed ELSE 0 END) as pending_devices,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs
     FROM render_queue
     WHERE company_id = ?
     GROUP BY priority
     ORDER BY
        CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
        END",
    [$companyId]
);

$priorityAnalysis = [
    'urgent' => ['jobs' => 0, 'pending_devices' => 0, 'total_jobs' => 0, 'completed_jobs' => 0, 'failed_jobs' => 0],
    'high' => ['jobs' => 0, 'pending_devices' => 0, 'total_jobs' => 0, 'completed_jobs' => 0, 'failed_jobs' => 0],
    'normal' => ['jobs' => 0, 'pending_devices' => 0, 'total_jobs' => 0, 'completed_jobs' => 0, 'failed_jobs' => 0],
    'low' => ['jobs' => 0, 'pending_devices' => 0, 'total_jobs' => 0, 'completed_jobs' => 0, 'failed_jobs' => 0],
    'most_waiting' => null
];

$maxWaiting = 0;
foreach ($priorityAll as $row) {
    $priorityAnalysis[$row['priority']] = [
        'jobs' => (int)$row['active_jobs'],
        'pending_devices' => (int)($row['pending_devices'] ?? 0),
        'total_jobs' => (int)$row['total_jobs'],
        'completed_jobs' => (int)$row['completed_jobs'],
        'failed_jobs' => (int)$row['failed_jobs']
    ];

    $waiting = (int)($row['pending_devices'] ?? 0);
    if ($waiting > $maxWaiting) {
        $maxWaiting = $waiting;
        $priorityAnalysis['most_waiting'] = [
            'priority' => $row['priority'],
            'pending_devices' => $waiting,
            'jobs' => (int)$row['active_jobs']
        ];
    }
}

// ========================================
// 3. HATA TİPİ ANALİZİ
// ========================================

// En çok tekrar eden hata tipleri
$errorTypes = $db->fetchAll(
    "SELECT rqi.error_type, COUNT(*) as count,
            AVG(rqi.retry_count) as avg_retries,
            MAX(rqi.retry_count) as max_retries
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ?
       AND rqi.error_type IS NOT NULL
       AND rqi.error_type != ''
     GROUP BY rqi.error_type
     ORDER BY count DESC
     LIMIT 10",
    [$companyId]
);

$errorAnalysis = [
    'types' => [],
    'total_errors' => 0,
    'most_common' => null
];

foreach ($errorTypes as $row) {
    $errorAnalysis['types'][] = [
        'type' => $row['error_type'],
        'count' => (int)$row['count'],
        'avg_retries' => round((float)$row['avg_retries'], 2),
        'max_retries' => (int)$row['max_retries']
    ];
    $errorAnalysis['total_errors'] += (int)$row['count'];
}

if (!empty($errorAnalysis['types'])) {
    $errorAnalysis['most_common'] = $errorAnalysis['types'][0];
}

// Son 24 saat hata dağılımı
$last24hErrors = $db->fetchAll(
    "SELECT rqi.error_type, COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ?
       AND rqi.error_type IS NOT NULL
       AND rqi.completed_at >= ?
     GROUP BY rqi.error_type
     ORDER BY count DESC",
    [$companyId, $since24h]
);

$errorAnalysis['last_24h'] = $last24hErrors;

// ========================================
// 4. PERFORMANS METRİKLERİ
// ========================================

// Ortalama tamamlanma süresi (son 100 iş)
$durationSecondsExpr = $isPostgres
    ? "EXTRACT(EPOCH FROM (completed_at - started_at))"
    : "CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS REAL)";
$avgCompletionTime = $db->fetch(
    "SELECT
        AVG(duration_seconds) as avg_seconds,
        MIN(duration_seconds) as min_seconds,
        MAX(duration_seconds) as max_seconds,
        COUNT(*) as sample_size
     FROM (
        SELECT $durationSecondsExpr as duration_seconds
        FROM render_queue
        WHERE company_id = ?
          AND status = 'completed'
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 100
     ) recent_jobs",
    [$companyId]
);

$performanceMetrics = [
    'avg_completion_seconds' => round((float)($avgCompletionTime['avg_seconds'] ?? 0), 2),
    'min_completion_seconds' => (int)($avgCompletionTime['min_seconds'] ?? 0),
    'max_completion_seconds' => (int)($avgCompletionTime['max_seconds'] ?? 0),
    'sample_size' => (int)($avgCompletionTime['sample_size'] ?? 0),
    'avg_completion_formatted' => null
];

// Formatla
$avgSec = $performanceMetrics['avg_completion_seconds'];
if ($performanceMetrics['sample_size'] > 0) {
    if ($avgSec < 60) {
        $performanceMetrics['avg_completion_formatted'] = round($avgSec) . ' saniye';
    } elseif ($avgSec < 3600) {
        $performanceMetrics['avg_completion_formatted'] = round($avgSec / 60, 1) . ' dakika';
    } else {
        $performanceMetrics['avg_completion_formatted'] = round($avgSec / 3600, 1) . ' saat';
    }
}

// Cihaz başına ortalama süre
$perDeviceSecondsExpr = $isPostgres
    ? "(EXTRACT(EPOCH FROM (completed_at - started_at)) / NULLIF(devices_total, 0))"
    : "(CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS REAL) / NULLIF(devices_total, 0))";
$avgPerDevice = $db->fetch(
    "SELECT AVG(per_device_seconds) as avg_per_device
     FROM (
        SELECT $perDeviceSecondsExpr as per_device_seconds
        FROM render_queue
        WHERE company_id = ?
          AND status = 'completed'
          AND devices_total > 0
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 100
     ) recent_jobs",
    [$companyId]
);

$performanceMetrics['avg_seconds_per_device'] = round((float)($avgPerDevice['avg_per_device'] ?? 0), 2);

// Başarı oranı (son 7 gün)
$successRate = $db->fetch(
    "SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM render_queue
     WHERE company_id = ?
       AND created_at >= ?",
    [$companyId, $since7d]
);

$total = (int)($successRate['total'] ?? 0);
$completed = (int)($successRate['completed'] ?? 0);
$failed = (int)($successRate['failed'] ?? 0);

$performanceMetrics['success_rate'] = $total > 0
    ? round(($completed / $total) * 100, 2)
    : 100;
$performanceMetrics['failure_rate'] = $total > 0
    ? round(($failed / $total) * 100, 2)
    : 0;

// ========================================
// 5. TREND VERİLERİ (Son 7 gün)
// ========================================

// Günlük iş sayısı
$dailyTrend = $db->fetchAll(
    "SELECT
        date(created_at) as date,
        COUNT(*) as total_jobs,
        SUM(devices_total) as total_devices,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM render_queue
     WHERE company_id = ?
       AND created_at >= ?
     GROUP BY date(created_at)
     ORDER BY date ASC",
    [$companyId, $since7d]
);

$trends = [
    'daily' => $dailyTrend,
    'period' => '7_days'
];

// Saatlik trend (son 24 saat)
$hourBucketExpr = $db->isPostgres()
    ? "to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00')"
    : "strftime('%Y-%m-%d %H:00', created_at)";
$hourlyTrend = $db->fetchAll(
    "SELECT
        $hourBucketExpr as hour,
        COUNT(*) as jobs,
        SUM(devices_total) as devices
     FROM render_queue
     WHERE company_id = ?
       AND created_at >= ?
     GROUP BY 1
     ORDER BY hour ASC",
    [$companyId, $since24h]
);

$trends['hourly'] = $hourlyTrend;

// ========================================
// 6. RETRY ANALİZİ
// ========================================

// Retry bekleyen itemlar
$retryReadyCondition = $isPostgres
    ? "rqi.next_retry_at <= CURRENT_TIMESTAMP"
    : "REPLACE(rqi.next_retry_at, 'T', ' ') <= ?";
$retryPendingParams = $isPostgres ? [$companyId] : [$companyId, $now];
$retryPending = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ?
       AND rqi.status = 'pending'
       AND rqi.retry_count > 0
       AND rqi.next_retry_at IS NOT NULL
       AND $retryReadyCondition",
    $retryPendingParams
);

$retryAnalysis = [
    'pending_retries' => (int)($retryPending['count'] ?? 0)
];

// Retry dağılımı
$retryDistribution = $db->fetchAll(
    "SELECT rqi.retry_count, COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ? AND rqi.retry_count > 0
     GROUP BY rqi.retry_count
     ORDER BY rqi.retry_count",
    [$companyId]
);

$retryAnalysis['distribution'] = $retryDistribution;

// Max retry'a ulaşan itemlar (error_type üzerinden JOIN)
$maxRetryReached = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     JOIN render_retry_policies rrp ON rqi.error_type = rrp.error_type
     WHERE rq.company_id = ?
       AND rqi.retry_count >= rrp.max_retries
       AND rqi.status = 'failed'",
    [$companyId]
);

$retryAnalysis['max_retry_reached'] = (int)($maxRetryReached['count'] ?? 0);

// Toplam başarısız item sayısı
$totalFailedItems = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ? AND rqi.status = 'failed'",
    [$companyId]
);
$retryAnalysis['total_failed'] = (int)($totalFailedItems['count'] ?? 0);

// Toplam item sayısı
$totalItems = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue_items rqi
     JOIN render_queue rq ON rqi.queue_id = rq.id
     WHERE rq.company_id = ?",
    [$companyId]
);
$retryAnalysis['total_items'] = (int)($totalItems['count'] ?? 0);

// ========================================
// 7. WORKER DURUMU (Son aktivite)
// ========================================

$lastActivity = $db->fetch(
    "SELECT
        MAX(CASE WHEN status = 'processing' THEN updated_at END) as last_processing,
        MAX(CASE WHEN status = 'completed' THEN completed_at END) as last_completed,
        MAX(created_at) as last_created
     FROM render_queue
     WHERE company_id = ?",
    [$companyId]
);

$workerStatus = [
    'last_processing' => $lastActivity['last_processing'],
    'last_completed' => $lastActivity['last_completed'],
    'last_job_created' => $lastActivity['last_created'],
    'is_active' => false
];

// Son 5 dakikada processing varsa worker aktif
if ($lastActivity['last_processing']) {
    $lastProcessing = strtotime($lastActivity['last_processing']);
    $workerStatus['is_active'] = (time() - $lastProcessing) < 300;
}

// ========================================
// RESPONSE
// ========================================

Response::success([
    'queue_status' => $queueStatus,
    'priority_analysis' => $priorityAnalysis,
    'error_analysis' => $errorAnalysis,
    'performance_metrics' => $performanceMetrics,
    'retry_analysis' => $retryAnalysis,
    'trends' => $trends,
    'worker_status' => $workerStatus,
    'generated_at' => date('Y-m-d H:i:s')
], 'Kuyruk analitiği');
