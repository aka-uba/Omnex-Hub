<?php
/**
 * RenderQueueService - Phase 2: Queue & Retry Sistemi
 *
 * Multi-device render işlemleri için:
 * - Queue yönetimi (FIFO + Priority)
 * - Retry mekanizması (Exponential backoff)
 * - Progress tracking
 * - Batch işleme
 *
 * @version 1.0.0
 */

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/NotificationService.php';

class RenderQueueService
{
    private $db;
    private array $companyRetryConfigCache = [];

    // Priority ağırlıkları (yüksek = öncelikli)
    private const PRIORITY_WEIGHTS = [
        'urgent' => 100,
        'high' => 75,
        'normal' => 50,
        'low' => 25
    ];

    // Varsayılan retry ayarları
    private const DEFAULT_MAX_RETRIES = 3;
    private const DEFAULT_BASE_DELAY = 5;      // saniye
    private const DEFAULT_MAX_DELAY = 300;     // 5 dakika
    private const DEFAULT_BACKOFF_MULTIPLIER = 2.0;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ============================================
    // QUEUE OLUŞTURMA
    // ============================================

    /**
     * Yeni render job'ı queue'ya ekle
     *
     * @param array $params [
     *   'company_id' => string,
     *   'template_id' => string,
     *   'product_id' => string,
     *   'device_ids' => array,
     *   'priority' => 'urgent'|'high'|'normal'|'low',
     *   'render_params' => array,
     *   'scheduled_at' => string|null,
     *   'created_by' => string
     * ]
     * @return array ['success' => bool, 'queue_id' => string, ...]
     */
    public function enqueue(array $params): array
    {
        $queueId = $this->db->generateUuid();
        $deviceIds = $params['device_ids'] ?? [];
        $deviceCount = count($deviceIds);

        if ($deviceCount === 0) {
            return ['success' => false, 'error' => 'En az bir cihaz seçilmeli'];
        }

        $priority = $params['priority'] ?? 'normal';
        if (!isset(self::PRIORITY_WEIGHTS[$priority])) {
            $priority = 'normal';
        }

        try {
            $this->db->beginTransaction();

            // 1. Ana queue kaydı
            $this->db->insert('render_queue', [
                'id' => $queueId,
                'company_id' => $params['company_id'],
                'job_type' => $params['job_type'] ?? 'render_send',
                'priority' => $priority,
                'template_id' => $params['template_id'] ?? null,
                'product_id' => $params['product_id'] ?? null,
                'product_name' => $params['product_name'] ?? null, // Ürün silinse bile görüntülenebilir
                'device_ids' => json_encode($deviceIds),
                'device_count' => $deviceCount,
                'render_params' => json_encode($params['render_params'] ?? []),
                'rendered_image_path' => $params['rendered_image_path'] ?? null, // Frontend pre-rendered image
                'status' => 'pending',
                'progress' => 0,
                'devices_total' => $deviceCount,
                'devices_completed' => 0,
                'devices_failed' => 0,
                'devices_skipped' => 0,
                'retry_count' => 0,
                'max_retries' => $params['max_retries'] ?? self::DEFAULT_MAX_RETRIES,
                'batch_id' => $params['batch_id'] ?? null,
                'scheduled_at' => $params['scheduled_at'] ?? null,
                'created_by' => $params['created_by'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            // 2. Her cihaz için queue item
            foreach ($deviceIds as $deviceId) {
                $this->db->insert('render_queue_items', [
                    'id' => $this->db->generateUuid(),
                    'queue_id' => $queueId,
                    'device_id' => $deviceId,
                    'status' => 'pending',
                    'retry_count' => 0,
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            }

            $this->db->commit();

            return [
                'success' => true,
                'queue_id' => $queueId,
                'device_count' => $deviceCount,
                'priority' => $priority,
                'message' => "$deviceCount cihaz için render job'ı oluşturuldu"
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Toplu cihaz gönderimi için queue oluştur
     */
    public function enqueueBulk(
        string $companyId,
        string $templateId,
        string $productId,
        array $deviceIds,
        string $priority = 'normal',
        array $renderParams = [],
        ?string $createdBy = null
    ): array {
        return $this->enqueue([
            'company_id' => $companyId,
            'template_id' => $templateId,
            'product_id' => $productId,
            'device_ids' => $deviceIds,
            'priority' => $priority,
            'job_type' => 'bulk_send',
            'render_params' => $renderParams,
            'created_by' => $createdBy
        ]);
    }

    // ============================================
    // QUEUE İŞLEME (WORKER)
    // ============================================

    /**
     * Sıradaki işlenecek job'ı al (priority sırasına göre)
     *
     * @param string|null $companyId Belirli bir firmaya ait job'lar
     * @return array|null Job verisi veya null
     */
    public function dequeue(?string $companyId = null): ?array
    {
        $now = date('Y-m-d H:i:s');
        $maxAttempts = 3;

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            try {
                $this->db->beginTransaction();

                $readyCondition = $this->db->isPostgres()
                    ? "(q.scheduled_at IS NULL OR q.scheduled_at <= ?)
                       AND (q.next_retry_at IS NULL OR q.next_retry_at <= ?)"
                    : "(q.scheduled_at IS NULL OR REPLACE(q.scheduled_at, 'T', ' ') <= ?)
                       AND (q.next_retry_at IS NULL OR REPLACE(q.next_retry_at, 'T', ' ') <= ?)";

                // Priority weight'e göre sırala
                $sql = "
                    SELECT q.*,
                           pw.weight as priority_weight,
                           pw.timeout_seconds
                    FROM render_queue q
                    LEFT JOIN render_priority_weights pw ON q.priority = pw.priority
                    WHERE q.status = 'pending'
                      AND {$readyCondition}
                ";
                $params = [$now, $now];

                if ($companyId) {
                    $sql .= " AND q.company_id = ?";
                    $params[] = $companyId;
                }

                $sql .= " ORDER BY pw.weight DESC, q.created_at ASC LIMIT 1";

                $job = $this->db->fetch($sql, $params);
                if (!$job) {
                    $this->db->commit();
                    return null;
                }

                // Atomik claim: sadece hala pending ise processing'e al
                $claimed = $this->db->update('render_queue', [
                    'status' => 'processing',
                    'started_at' => $now,
                    'updated_at' => $now
                ], 'id = ? AND status = ?', [$job['id'], 'pending']);

                if ($claimed > 0) {
                    $this->db->commit();
                    $job['status'] = 'processing';
                    $job['device_ids'] = json_decode($job['device_ids'] ?? '[]', true) ?: [];
                    $job['render_params'] = json_decode($job['render_params'] ?? '{}', true) ?: [];
                    $this->notifyQueueStarted($job);
                    return $job;
                }

                // Başka worker aldı, yeniden dene
                $this->db->commit();
            } catch (Exception $e) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
            }
        }

        return null;
    }

    /**
     * Belirli bir job'ın pending item'larını al
     */
    public function getPendingItems(string $queueId, int $limit = 10): array
    {
        $now = date('Y-m-d H:i:s');
        $itemReadyCondition = $this->db->isPostgres()
            ? "(qi.next_retry_at IS NULL OR qi.next_retry_at <= ?)"
            : "(qi.next_retry_at IS NULL OR REPLACE(qi.next_retry_at, 'T', ' ') <= ?)";

        return $this->db->fetchAll(
            "SELECT qi.*,
                    d.ip_address,
                    d.device_id as client_id,
                    d.type as device_type,
                    d.model as device_model,
                    d.name as device_name,
                    d.communication_mode,
                    d.mqtt_client_id,
                    d.mqtt_topic,
                    d.screen_width,
                    d.screen_height,
                    d.adapter_id,
                    d.device_brand,
                    d.manufacturer,
                    d.company_id,
                    gd.gateway_id,
                    gd.local_ip as gateway_local_ip,
                    gw.status as gateway_status,
                    gw.last_heartbeat as gateway_last_heartbeat
             FROM render_queue_items qi
             LEFT JOIN devices d ON qi.device_id = d.id
             LEFT JOIN gateway_devices gd ON qi.device_id = gd.device_id
             LEFT JOIN gateways gw ON gd.gateway_id = gw.id
              WHERE qi.queue_id = ? AND qi.status = 'pending'
               AND {$itemReadyCondition}
              ORDER BY qi.created_at ASC
              LIMIT ?",
            [$queueId, $now, $limit]
        );
    }

    /**
     * Queue item durumunu güncelle
     */
    public function updateItemStatus(
        string $itemId,
        string $status,
        ?string $error = null,
        ?int $durationMs = null,
        ?string $fileMd5 = null,
        ?string $skippedReason = null,
        ?string $errorType = null
    ): bool {
        $data = [
            'status' => $status,
            'completed_at' => in_array($status, ['completed', 'failed', 'skipped']) ? date('Y-m-d H:i:s') : null
        ];

        if ($error !== null) {
            $data['last_error'] = $error;
            // error_type belirtilmemişse otomatik tespit et
            if ($errorType === null && $status === 'failed') {
                $errorType = $this->detectErrorType($error);
            }
        }
        if ($errorType !== null) {
            $data['error_type'] = $errorType;
        }
        if ($durationMs !== null) {
            $data['duration_ms'] = $durationMs;
        }
        if ($fileMd5 !== null) {
            $data['file_md5'] = $fileMd5;
        }
        if ($skippedReason !== null) {
            $data['skipped_reason'] = $skippedReason;
            $data['status'] = 'skipped';
        }

        return $this->db->update('render_queue_items', $data, 'id = ?', [$itemId]) > 0;
    }

    /**
     * Queue item için retry sayacını artır
     */
    public function incrementItemRetry(string $itemId): int
    {
        $this->db->query(
            "UPDATE render_queue_items SET retry_count = retry_count + 1 WHERE id = ?",
            [$itemId]
        );

        $item = $this->db->fetch("SELECT retry_count FROM render_queue_items WHERE id = ?", [$itemId]);
        return $item['retry_count'] ?? 0;
    }

    // ============================================
    // PROGRESS TRACKING
    // ============================================

    /**
     * Queue progress'ini güncelle (item tamamlandığında çağrılır)
     */
    public function updateQueueProgress(string $queueId): array
    {
        $queueMeta = $this->db->fetch(
            "SELECT status, created_by, batch_id, company_id FROM render_queue WHERE id = ?",
            [$queueId]
        );
        $previousStatus = (string)($queueMeta['status'] ?? '');
        $createdBy = $queueMeta['created_by'] ?? null;
        $batchId = $queueMeta['batch_id'] ?? null;
        $companyId = $queueMeta['company_id'] ?? null;

        // Item istatistiklerini hesapla
        $stats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
             FROM render_queue_items
             WHERE queue_id = ?",
            [$queueId]
        );

        $total = (int)$stats['total'];
        $completed = (int)$stats['completed'];
        $failed = (int)$stats['failed'];
        $skipped = (int)$stats['skipped'];
        $pending = (int)$stats['pending'];

        // Progress yüzdesi (completed + skipped + failed = işlenen)
        $processed = $completed + $failed + $skipped;
        $progress = $total > 0 ? round(($processed / $total) * 100) : 0;

        // Queue durumunu belirle
        $status = 'processing';
        if ($pending === 0 && $stats['processing'] == 0) {
            // Tüm item'lar işlendi
            $status = $failed > 0 ? 'failed' : 'completed';
        }

        $updateData = [
            'devices_completed' => $completed,
            'devices_failed' => $failed,
            'devices_skipped' => $skipped,
            'progress' => $progress,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($status !== 'processing') {
            $updateData['status'] = $status;
            $updateData['completed_at'] = date('Y-m-d H:i:s');
        }

        $this->db->update('render_queue', $updateData, 'id = ?', [$queueId]);

        if (
            in_array($status, ['completed', 'failed'], true)
            && in_array($previousStatus, ['pending', 'processing'], true)
        ) {
            $this->notifyQueueCompleted(
                $queueId,
                $status,
                $total,
                $completed,
                $failed,
                $skipped,
                $createdBy,
                $batchId,
                $companyId
            );
        }

        return [
            'queue_id' => $queueId,
            'status' => $status,
            'progress' => $progress,
            'total' => $total,
            'completed' => $completed,
            'failed' => $failed,
            'skipped' => $skipped,
            'pending' => $pending
        ];
    }

    /**
     * Queue durumunu getir
     */
    public function getQueueStatus(string $queueId): ?array
    {
        $queue = $this->db->fetch(
            "SELECT * FROM render_queue WHERE id = ?",
            [$queueId]
        );

        if (!$queue) {
            return null;
        }

        // Item detaylarını al
        $items = $this->db->fetchAll(
            "SELECT qi.*, d.name as device_name, d.ip_address
             FROM render_queue_items qi
             LEFT JOIN devices d ON qi.device_id = d.id
             WHERE qi.queue_id = ?
             ORDER BY qi.status DESC, qi.completed_at DESC",
            [$queueId]
        );

        $queue['device_ids'] = !empty($queue['device_ids']) ? json_decode($queue['device_ids'], true) ?: [] : [];
        $queue['render_params'] = !empty($queue['render_params']) ? json_decode($queue['render_params'], true) ?: [] : [];
        $queue['result'] = !empty($queue['result']) ? json_decode($queue['result'], true) ?: [] : [];
        $queue['failed_devices'] = !empty($queue['failed_devices']) ? json_decode($queue['failed_devices'], true) ?: [] : [];
        $queue['items'] = $items;

        return $queue;
    }

    // ============================================
    // RETRY MEKANİZMASI
    // ============================================

    /**
     * Exponential backoff ile sonraki retry zamanını hesapla
     *
     * @param int $retryCount Mevcut retry sayısı
     * @param string $errorType Hata tipi
     * @return int Bekleme süresi (saniye)
     */
    public function calculateBackoff(int $retryCount, string $errorType = 'unknown', ?string $companyId = null): int
    {
        // Retry policy'yi al
        $policy = $this->db->fetch(
            "SELECT * FROM render_retry_policies WHERE error_type = ?",
            [$errorType]
        );

        if (!$policy) {
            $policy = [
                'base_delay_seconds' => self::DEFAULT_BASE_DELAY,
                'max_delay_seconds' => self::DEFAULT_MAX_DELAY,
                'backoff_multiplier' => self::DEFAULT_BACKOFF_MULTIPLIER
            ];
        }

        $companyOverride = $this->getCompanyRetryBackoffConfig($companyId);
        if (isset($companyOverride['base_delay_seconds'])) {
            $policy['base_delay_seconds'] = $companyOverride['base_delay_seconds'];
        }
        if (isset($companyOverride['max_delay_seconds'])) {
            $policy['max_delay_seconds'] = $companyOverride['max_delay_seconds'];
        }
        if (isset($companyOverride['backoff_multiplier'])) {
            $policy['backoff_multiplier'] = $companyOverride['backoff_multiplier'];
        }

        $baseDelay = max(1, (int)$policy['base_delay_seconds']);
        $maxDelay = max($baseDelay, (int)$policy['max_delay_seconds']);
        $multiplier = max(1.0, (float)$policy['backoff_multiplier']);

        // Exponential backoff: base * (multiplier ^ retryCount)
        $delay = (int)round($baseDelay * pow($multiplier, max(0, $retryCount)));

        // Max delay'i aşmasın
        return min($delay, $maxDelay);
    }

    /**
     * Queue'yu retry için zamanla
     */
    public function scheduleRetry(string $queueId, string $errorType = 'unknown'): array
    {
        return $this->scheduleRetryInternal($queueId, null, $errorType);
    }

    /**
     * Queue icinde sadece secili cihazlarin failed item'larini retry kuyruuna al.
     */
    public function scheduleRetryForDevices(string $queueId, array $deviceIds, string $errorType = 'unknown'): array
    {
        $normalizedDeviceIds = array_values(array_unique(array_filter(
            $deviceIds,
            static fn($id) => is_string($id) && $id !== ''
        )));

        if (empty($normalizedDeviceIds)) {
            return ['success' => false, 'error' => 'Retry icin gecerli cihaz secilmedi'];
        }

        return $this->scheduleRetryInternal($queueId, $normalizedDeviceIds, $errorType);
    }

    /**
     * Queue retry planlama (tum failed item'lar veya secili cihazlar).
     *
     * @param string $queueId
     * @param array|null $deviceIds null ise tum failed item'lar
     * @param string $errorType
     * @return array
     */
    private function scheduleRetryInternal(string $queueId, ?array $deviceIds, string $errorType = 'unknown'): array
    {
        $queue = $this->db->fetch("SELECT * FROM render_queue WHERE id = ?", [$queueId]);

        if (!$queue) {
            return ['success' => false, 'error' => 'Queue bulunamadi'];
        }

        $retryCount = (int)$queue['retry_count'];
        $maxRetries = (int)$queue['max_retries'];

        if ($retryCount >= $maxRetries) {
            // Max retry'a ulasildi, failed olarak isaretle
            $this->db->update('render_queue', [
                'status' => 'failed',
                'error_message' => "Maksimum retry sayisina ($maxRetries) ulasildi",
                'completed_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$queueId]);

            return [
                'success' => false,
                'error' => 'Maksimum retry sayisina ulasildi',
                'retry_count' => $retryCount
            ];
        }

        $failedCountSql = "SELECT COUNT(*) as count
                           FROM render_queue_items
                           WHERE queue_id = ? AND status = 'failed'";
        $failedCountParams = [$queueId];

        if (is_array($deviceIds) && !empty($deviceIds)) {
            $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
            $failedCountSql .= " AND device_id IN ($placeholders)";
            $failedCountParams = array_merge($failedCountParams, $deviceIds);
        }

        $failedCount = (int)($this->db->fetch($failedCountSql, $failedCountParams)['count'] ?? 0);
        if ($failedCount === 0) {
            return ['success' => false, 'error' => 'Retry edilecek basarisiz cihaz bulunamadi'];
        }

        // Backoff hesapla
        $backoffSeconds = $this->calculateBackoff($retryCount, $errorType, $queue['company_id'] ?? null);
        $nextRetry = date('Y-m-d H:i:s', time() + $backoffSeconds);

        $this->db->update('render_queue', [
            'status' => 'pending',
            'retry_count' => $retryCount + 1,
            'last_retry_at' => date('Y-m-d H:i:s'),
            'next_retry_at' => $nextRetry,
            'started_at' => null,
            'error_message' => null,
            'completed_at' => null,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$queueId]);

        // Basarisiz item'lari tekrar pending yap
        $itemRetrySql = "UPDATE render_queue_items
                         SET status = 'pending',
                             next_retry_at = ?,
                             completed_at = NULL,
                             retry_count = retry_count + 1
                         WHERE queue_id = ? AND status = 'failed'";
        $itemRetryParams = [$nextRetry, $queueId];

        if (is_array($deviceIds) && !empty($deviceIds)) {
            $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
            $itemRetrySql .= " AND device_id IN ($placeholders)";
            $itemRetryParams = array_merge($itemRetryParams, $deviceIds);
        }

        $this->db->query($itemRetrySql, $itemRetryParams);

        return [
            'success' => true,
            'retry_count' => $retryCount + 1,
            'next_retry_at' => $nextRetry,
            'backoff_seconds' => $backoffSeconds,
            'target_failed_items' => $failedCount,
            'message' => "Retry #" . ($retryCount + 1) . " icin $backoffSeconds saniye sonra tekrar denenecek"
        ];
    }
    /**
     * Hata tipini belirle
     */
    public function detectErrorType(string $errorMessage): string
    {
        $errorMessage = strtolower($errorMessage);

        // Timeout hataları
        if (strpos($errorMessage, 'timeout') !== false ||
            strpos($errorMessage, 'timed out') !== false ||
            strpos($errorMessage, 'deadline') !== false ||
            strpos($errorMessage, 'zaman aşımı') !== false) {
            return 'timeout';
        }

        // Bağlantı hataları
        if (strpos($errorMessage, 'connection') !== false ||
            strpos($errorMessage, 'refused') !== false ||
            strpos($errorMessage, 'reset') !== false ||
            strpos($errorMessage, 'network') !== false ||
            strpos($errorMessage, 'bağlantı') !== false ||
            strpos($errorMessage, 'erişilemiyor') !== false) {
            return 'connection';
        }

        // Cihaz çevrimdışı hataları
        if (strpos($errorMessage, 'offline') !== false ||
            strpos($errorMessage, 'unreachable') !== false ||
            strpos($errorMessage, 'not found') !== false ||
            strpos($errorMessage, 'çevrimdışı') !== false ||
            strpos($errorMessage, 'bulunamadı') !== false ||
            strpos($errorMessage, 'cihaz bulunamadı') !== false) {
            return 'device_offline';
        }

        // Yükleme hataları
        if (strpos($errorMessage, 'upload') !== false ||
            strpos($errorMessage, 'transfer') !== false ||
            strpos($errorMessage, '413') !== false ||
            strpos($errorMessage, 'too large') !== false ||
            strpos($errorMessage, 'yükleme') !== false ||
            strpos($errorMessage, 'dosya') !== false) {
            return 'upload_failed';
        }

        // Render hataları
        if (strpos($errorMessage, 'render') !== false ||
            strpos($errorMessage, 'image') !== false ||
            strpos($errorMessage, 'template') !== false ||
            strpos($errorMessage, 'şablon') !== false ||
            strpos($errorMessage, 'görsel') !== false) {
            return 'render_failed';
        }

        return 'unknown';
    }

    /**
     * Firma bazli retry backoff override ayarlarini getir.
     *
     * Desteklenen keys:
     * - render_retry_base_delay_seconds (fallback: retry_base_delay_seconds)
     * - render_retry_max_delay_seconds (fallback: retry_max_delay_seconds)
     * - render_retry_backoff_multiplier (fallback: retry_backoff_multiplier)
     */
    private function getCompanyRetryBackoffConfig(?string $companyId): array
    {
        if (empty($companyId)) {
            return [];
        }

        if (isset($this->companyRetryConfigCache[$companyId])) {
            return $this->companyRetryConfigCache[$companyId];
        }

        $settings = $this->db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );

        $config = [];
        if ($settings && !empty($settings['data'])) {
            $data = json_decode($settings['data'], true) ?: [];

            $baseDelay = $data['render_retry_base_delay_seconds'] ?? $data['retry_base_delay_seconds'] ?? null;
            if ($baseDelay !== null) {
                $config['base_delay_seconds'] = max(1, (int)$baseDelay);
            }

            $maxDelay = $data['render_retry_max_delay_seconds'] ?? $data['retry_max_delay_seconds'] ?? null;
            if ($maxDelay !== null) {
                $config['max_delay_seconds'] = max(1, (int)$maxDelay);
            }

            $multiplier = $data['render_retry_backoff_multiplier'] ?? $data['retry_backoff_multiplier'] ?? null;
            if ($multiplier !== null) {
                $config['backoff_multiplier'] = max(1.0, (float)$multiplier);
            }
        }

        if (isset($config['base_delay_seconds'], $config['max_delay_seconds'])) {
            $config['max_delay_seconds'] = max($config['base_delay_seconds'], $config['max_delay_seconds']);
        }

        $this->companyRetryConfigCache[$companyId] = $config;
        return $config;
    }

    // ============================================
    // QUEUE YÖNETİMİ
    // ============================================

    /**
     * Queue'yu tamamlandı olarak işaretle
     */
    public function completeQueue(string $queueId): bool
    {
        $queueMeta = $this->db->fetch(
            "SELECT status, created_by, batch_id, company_id FROM render_queue WHERE id = ?",
            [$queueId]
        );
        $previousStatus = (string)($queueMeta['status'] ?? '');
        $createdBy = $queueMeta['created_by'] ?? null;
        $batchId = $queueMeta['batch_id'] ?? null;
        $companyId = $queueMeta['company_id'] ?? null;

        // Item istatistiklerini hesapla
        $stats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
             FROM render_queue_items
             WHERE queue_id = ?",
            [$queueId]
        );

        $total = (int)($stats['total'] ?? 0);
        $completed = (int)($stats['completed'] ?? 0);
        $failed = (int)($stats['failed'] ?? 0);
        $skipped = (int)($stats['skipped'] ?? 0);
        $pending = (int)($stats['pending'] ?? 0);

        // Durumu belirle
        $status = 'completed';
        $errorMessage = null;

        if ($total === 0) {
            // Hiç item yok - başarısız
            $status = 'failed';
            $errorMessage = 'Kuyrukta işlenecek cihaz bulunamadı';
        } elseif ($pending > 0 && $completed === 0 && $failed === 0) {
            // Item'lar var ama hiçbiri işlenemedi (muhtemelen device JOIN başarısız)
            $status = 'failed';
            $errorMessage = 'Cihazlar bulunamadı veya işlenemedi (device_id eşleşmesi başarısız)';
            // Pending item'ları failed olarak işaretle (error_type ile birlikte)
            $this->db->query(
                "UPDATE render_queue_items SET status = 'failed', last_error = 'Cihaz bulunamadı', error_type = 'device_offline' WHERE queue_id = ? AND status = 'pending'",
                [$queueId]
            );
            $failed = $pending;
        } elseif ($failed > 0) {
            $status = 'failed';
        }

        $updateData = [
            'status' => $status,
            'progress' => 100,
            'devices_completed' => $completed,
            'devices_failed' => $failed,
            'devices_skipped' => $skipped,
            'completed_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($errorMessage) {
            $updateData['error_message'] = $errorMessage;
        }

        $this->db->update('render_queue', $updateData, 'id = ?', [$queueId]);

        if (
            in_array($status, ['completed', 'failed'], true)
            && in_array($previousStatus, ['pending', 'processing'], true)
        ) {
            $this->notifyQueueCompleted(
                $queueId,
                $status,
                $total,
                $completed,
                $failed,
                $skipped,
                $createdBy,
                $batchId,
                $companyId
            );
        }

        return true;
    }

    private function cleanupOldDeviceNotifications(?string $companyId): void
    {
        $companyId = trim((string)$companyId);
        if ($companyId === '') {
            return;
        }

        try {
            $notificationService = NotificationService::getInstance();
            $retentionDays = $notificationService->getDeviceNotificationRetentionDays($companyId, 30);
            $notificationService->cleanupDeviceSendNotifications($companyId, $retentionDays);
        } catch (Exception $e) {
            Logger::warning('RenderQueueService device notification cleanup failed', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function notifyQueueStarted(array $job): void
    {
        try {
            $userId = trim((string)($job['created_by'] ?? ''));
            if ($userId === '') {
                return;
            }
            $this->cleanupOldDeviceNotifications($job['company_id'] ?? null);

            $batchId = trim((string)($job['batch_id'] ?? ''));
            $priority = strtolower((string)($job['priority'] ?? 'normal'));
            $deviceCount = (int)($job['device_count'] ?? 0);
            $scheduledAtRaw = trim((string)($job['scheduled_at'] ?? ''));
            $scheduledTs = $scheduledAtRaw !== '' ? strtotime(str_replace('T', ' ', $scheduledAtRaw)) : false;
            $nowTs = time();

            $modeText = 'Anlik';
            if ($scheduledTs !== false && $scheduledTs > ($nowTs + 30)) {
                $modeText = 'Ileri tarihli';
            } elseif ($priority === 'urgent') {
                $modeText = 'Acil';
            } elseif ($priority === 'high') {
                $modeText = 'Hemen';
            }

            $scheduleText = '';
            if ($scheduledTs !== false && $scheduledTs > ($nowTs + 30)) {
                $scheduleText = ' Planlanan zaman: ' . date('d.m.Y H:i', $scheduledTs) . '.';
            }

            if ($batchId !== '') {
                $processedInBatch = (int)$this->db->fetchColumn(
                    "SELECT COUNT(*)
                     FROM render_queue
                     WHERE batch_id = ?
                       AND status IN ('processing', 'completed', 'failed', 'cancelled')",
                    [$batchId]
                );
                if ($processedInBatch > 1) {
                    return;
                }

                $batchStats = $this->db->fetch(
                    "SELECT COUNT(*) AS jobs_total,
                            COALESCE(SUM(device_count), 0) AS total_devices
                     FROM render_queue
                     WHERE batch_id = ?",
                    [$batchId]
                ) ?: ['jobs_total' => 0, 'total_devices' => $deviceCount];

                $title = 'Toplu Cihaz Gonderimi Basladi';
                $link = '#/admin/queue?batch=' . $batchId;
                if ($this->hasRecentNotification($userId, $title, $link)) {
                    return;
                }

                $jobsTotal = (int)($batchStats['jobs_total'] ?? 0);
                $devicesTotal = (int)($batchStats['total_devices'] ?? $deviceCount);
                $message = "{$modeText} toplu gonderim basladi. Toplam is: {$jobsTotal}, Toplam cihaz: {$devicesTotal}.{$scheduleText}";

                NotificationService::getInstance()->sendToUser(
                    $userId,
                    $title,
                    $message,
                    [
                        'type' => NotificationService::TYPE_INFO,
                        'icon' => 'ti-player-play',
                        'link' => $link,
                        'priority' => $priority === 'urgent'
                            ? NotificationService::PRIORITY_HIGH
                            : NotificationService::PRIORITY_NORMAL,
                        'channels' => ['web', 'toast']
                    ]
                );
                return;
            }

            $title = 'Cihaz Gonderimi Basladi';
            $link = '#/admin/queue?job=' . ($job['id'] ?? '');
            if ($this->hasRecentNotification($userId, $title, $link)) {
                return;
            }

            NotificationService::getInstance()->sendToUser(
                $userId,
                $title,
                "{$modeText} cihaz gonderimi basladi. Toplam cihaz: {$deviceCount}.{$scheduleText}",
                [
                    'type' => NotificationService::TYPE_INFO,
                    'icon' => 'ti-player-play',
                    'link' => $link,
                    'priority' => $priority === 'urgent'
                        ? NotificationService::PRIORITY_HIGH
                        : NotificationService::PRIORITY_NORMAL,
                    'channels' => ['web', 'toast']
                ]
            );
        } catch (Exception $e) {
            Logger::warning('RenderQueueService start notification failed', [
                'queue_id' => $job['id'] ?? null,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function notifyQueueCompleted(
        string $queueId,
        string $status,
        int $total,
        int $completed,
        int $failed,
        int $skipped,
        $createdBy,
        $batchId = null,
        $companyId = null
    ): void {
        try {
            $userId = trim((string)$createdBy);
            if ($userId === '') {
                return;
            }
            $this->cleanupOldDeviceNotifications($companyId);

            $batchId = trim((string)$batchId);
            if ($batchId !== '') {
                $remaining = (int)$this->db->fetchColumn(
                    "SELECT COUNT(*)
                     FROM render_queue
                     WHERE batch_id = ?
                       AND status IN ('pending', 'processing')",
                    [$batchId]
                );
                if ($remaining > 0) {
                    return;
                }

                $summary = $this->db->fetch(
                    "SELECT
                        COUNT(*) AS jobs_total,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS jobs_failed,
                        COALESCE(SUM(devices_total), 0) AS total_devices,
                        COALESCE(SUM(devices_completed), 0) AS completed_devices,
                        COALESCE(SUM(devices_failed), 0) AS failed_devices,
                        COALESCE(SUM(devices_skipped), 0) AS skipped_devices
                     FROM render_queue
                     WHERE batch_id = ?",
                    [$batchId]
                ) ?: [];

                $jobsFailed = (int)($summary['jobs_failed'] ?? 0);
                $totalDevices = (int)($summary['total_devices'] ?? $total);
                $completedDevices = (int)($summary['completed_devices'] ?? $completed);
                $failedDevices = (int)($summary['failed_devices'] ?? $failed);
                $skippedDevices = (int)($summary['skipped_devices'] ?? $skipped);
                $jobsTotal = (int)($summary['jobs_total'] ?? 0);
                $hasFailure = $jobsFailed > 0 || $failedDevices > 0;

                $title = $hasFailure
                    ? 'Toplu Cihaz Gonderimi Tamamlandi (Hatali)'
                    : 'Toplu Cihaz Gonderimi Tamamlandi';
                $link = '#/admin/queue?batch=' . $batchId;
                $startTitle = 'Toplu Cihaz Gonderimi Basladi';
                if (!$this->hasRecentNotification($userId, $startTitle, $link)) {
                    NotificationService::getInstance()->sendToUser(
                        $userId,
                        $startTitle,
                        "Toplu gonderim basladi. Toplam is: {$jobsTotal}, Toplam cihaz: {$totalDevices}.",
                        [
                            'type' => NotificationService::TYPE_INFO,
                            'icon' => 'ti-player-play',
                            'link' => $link,
                            'priority' => NotificationService::PRIORITY_NORMAL,
                            'channels' => ['web', 'toast']
                        ]
                    );
                }
                if ($this->hasRecentNotification($userId, $title, $link)) {
                    return;
                }

                $message = "Toplu gonderim tamamlandi. Basarili: {$completedDevices}, Basarisiz: {$failedDevices}, Toplam cihaz: {$totalDevices}, Toplam is: {$jobsTotal}";
                if ($skippedDevices > 0) {
                    $message .= ", Atlanan: {$skippedDevices}";
                }

                NotificationService::getInstance()->sendToUser(
                    $userId,
                    $title,
                    $message,
                    [
                        'type' => $hasFailure ? NotificationService::TYPE_WARNING : NotificationService::TYPE_SUCCESS,
                        'icon' => $hasFailure ? 'ti-alert-triangle' : 'ti-circle-check',
                        'link' => $link,
                        'priority' => $hasFailure ? NotificationService::PRIORITY_HIGH : NotificationService::PRIORITY_NORMAL,
                        'channels' => ['web', 'toast']
                    ]
                );
                return;
            }

            $hasFailure = $status === 'failed' || $failed > 0;
            $title = $hasFailure
                ? 'Cihaz Gonderimi Tamamlandi (Hatali)'
                : 'Cihaz Gonderimi Tamamlandi';
            $message = "Gonderim tamamlandi. Basarili: {$completed}, Basarisiz: {$failed}, Toplam cihaz: {$total}";
            if ($skipped > 0) {
                $message .= ", Atlanan: {$skipped}";
            }
            $link = '#/admin/queue?job=' . $queueId;
            $startTitle = 'Cihaz Gonderimi Basladi';
            if (!$this->hasRecentNotification($userId, $startTitle, $link)) {
                NotificationService::getInstance()->sendToUser(
                    $userId,
                    $startTitle,
                    "Cihaz gonderimi basladi. Toplam cihaz: {$total}.",
                    [
                        'type' => NotificationService::TYPE_INFO,
                        'icon' => 'ti-player-play',
                        'link' => $link,
                        'priority' => NotificationService::PRIORITY_NORMAL,
                        'channels' => ['web', 'toast']
                    ]
                );
            }
            if ($this->hasRecentNotification($userId, $title, $link)) {
                return;
            }

            NotificationService::getInstance()->sendToUser(
                $userId,
                $title,
                $message,
                [
                    'type' => $hasFailure ? NotificationService::TYPE_WARNING : NotificationService::TYPE_SUCCESS,
                    'icon' => $hasFailure ? 'ti-alert-triangle' : 'ti-circle-check',
                    'link' => $link,
                    'priority' => $hasFailure ? NotificationService::PRIORITY_HIGH : NotificationService::PRIORITY_NORMAL,
                    'channels' => ['web', 'toast']
                ]
            );
        } catch (Exception $e) {
            Logger::warning('RenderQueueService completion notification failed', [
                'queue_id' => $queueId,
                'error' => $e->getMessage()
            ]);
        }
    }

    private function hasRecentNotification(string $userId, string $title, string $link): bool
    {
        $since = date('Y-m-d H:i:s', time() - 3600);
        $count = (int)$this->db->fetchColumn(
            "SELECT COUNT(*)
             FROM notifications n
             INNER JOIN notification_recipients nr ON nr.notification_id = n.id
             WHERE nr.user_id = ?
               AND n.title = ?
               AND n.link = ?
               AND n.created_at >= ?",
            [$userId, $title, $link, $since]
        );

        return $count > 0;
    }


    /**
     * Queue'yu iptal et
     */
    public function cancelQueue(string $queueId): bool
    {
        $this->db->update('render_queue', [
            'status' => 'cancelled',
            'completed_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$queueId]);

        // Pending item'ları da iptal et
        $this->db->query(
            "UPDATE render_queue_items SET status = 'skipped', skipped_reason = 'cancelled' WHERE queue_id = ? AND status IN ('pending', 'processing')",
            [$queueId]
        );

        return true;
    }

    /**
     * Firma için queue listesi
     */
    public function getQueues(
        string $companyId,
        ?string $status = null,
        int $limit = 50,
        int $offset = 0
    ): array {
        $sql = "SELECT * FROM render_queue WHERE company_id = ?";
        $params = [$companyId];

        if ($status) {
            $sql .= " AND status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        $queues = $this->db->fetchAll($sql, $params);

        foreach ($queues as &$q) {
            // JSON alanlarını decode et
            $q['device_ids'] = !empty($q['device_ids']) ? json_decode($q['device_ids'], true) ?: [] : [];
            $q['render_params'] = !empty($q['render_params']) ? json_decode($q['render_params'], true) ?: [] : [];

            // Frontend uyumluluğu için alan adı eşleştirmesi
            $q['total_devices'] = $q['devices_total'] ?? 0;
            $q['completed_devices'] = $q['devices_completed'] ?? 0;
            $q['failed_devices'] = $q['devices_failed'] ?? 0;
            $q['skipped_devices'] = $q['devices_skipped'] ?? 0;
            $q['progress_percent'] = $q['progress'] ?? 0;
        }

        return $queues;
    }

    /**
     * Eski tamamlanmış queue'ları temizle
     * completed_at NULL ise created_at kullanılır
     *
     * @param int $daysOld Kaç günden eski kayıtlar silinecek
     * @param string|null $companyId Firma ID (güvenlik için)
     * @return int Silinen kayıt sayısı
     */
    public function cleanupOldQueues(int $daysOld = 7, ?string $companyId = null): int
    {
        $cutoff = date('Y-m-d H:i:s', strtotime("-$daysOld days"));

        // Firma filtresi
        $companyFilter = $companyId ? " AND company_id = ?" : "";
        $params = [$cutoff];
        if ($companyId) {
            $params[] = $companyId;
        }

        // Önce item'ları sil
        // COALESCE ile completed_at NULL ise created_at kullanılır
        $this->db->query(
            "DELETE FROM render_queue_items WHERE queue_id IN (
                SELECT id FROM render_queue
                WHERE status IN ('completed', 'failed', 'cancelled')
                  AND COALESCE(completed_at, created_at) < ?
                  $companyFilter
            )",
            $params
        );

        // Sonra queue'ları sil
        $result = $this->db->query(
            "DELETE FROM render_queue
             WHERE status IN ('completed', 'failed', 'cancelled')
               AND COALESCE(completed_at, created_at) < ?
               $companyFilter",
            $params
        );

        return $result->rowCount();
    }

    /**
     * Queue istatistikleri
     */
    public function getStats(?string $companyId = null): array
    {
        $where = $companyId ? "WHERE company_id = ?" : "";
        $params = $companyId ? [$companyId] : [];

        return $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(devices_total) as total_devices,
                SUM(devices_completed) as completed_devices,
                SUM(devices_failed) as failed_devices,
                SUM(devices_skipped) as skipped_devices
             FROM render_queue $where",
            $params
        ) ?: [];
    }
}
