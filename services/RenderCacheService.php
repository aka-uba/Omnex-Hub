<?php
/**
 * Render Cache Service
 *
 * Ürün değişikliklerinde arka planda render işlemlerini yönetir.
 * Cache sistemi ile hazır görselleri saklar ve toplu gönderimde kullanır.
 *
 * @package OmnexDisplayHub
 */

class RenderCacheService
{
    private $db;

    // Render job öncelik ağırlıkları
    const PRIORITY_WEIGHTS = [
        'urgent' => 100,
        'high' => 75,
        'normal' => 50,
        'low' => 25
    ];

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Ürün güncellendiğinde render job'u oluştur
     *
     * @param string $productId Ürün ID
     * @param string $companyId Firma ID
     * @param string $source Kaynak (api, import, erp, manual)
     * @param array $options Ek seçenekler
     * @return array
     */
    public function onProductUpdated(string $productId, string $companyId, string $source = 'api', array $options = []): array
    {
        // Ürün versiyonunu artır (local timezone)
        $now = date('Y-m-d H:i:s');
        $this->db->query(
            "UPDATE products SET version = version + 1, render_status = 'pending', updated_at = ? WHERE id = ?",
            [$now, $productId]
        );

        // Bu ürünün atandığı cihazları ve şablonları bul
        $assignments = $this->getProductAssignments($productId, $companyId);

        if (empty($assignments)) {
            return [
                'success' => true,
                'jobs_created' => 0,
                'message' => 'Ürün hiçbir cihaza atanmamış, render job oluşturulmadı'
            ];
        }

        // Benzersiz template'ler için job oluştur
        $templateIds = array_unique(array_column($assignments, 'template_id'));
        $jobsCreated = 0;
        $batchId = $this->db->generateUuid();

        foreach ($templateIds as $templateId) {
            if (empty($templateId)) continue;

            // Mevcut cache'i stale yap
            $this->markCacheStale($productId, $templateId, $companyId);

            // Yeni job oluştur
            $this->createRenderJob([
                'company_id' => $companyId,
                'product_id' => $productId,
                'template_id' => $templateId,
                'job_type' => 'product_update',
                'source' => $source,
                'priority' => $options['priority'] ?? 'normal',
                'batch_id' => $batchId,
                'batch_total' => count($templateIds),
                'batch_index' => $jobsCreated + 1,
                'created_by' => $options['user_id'] ?? null
            ]);

            $jobsCreated++;
        }

        return [
            'success' => true,
            'jobs_created' => $jobsCreated,
            'batch_id' => $batchId,
            'template_ids' => $templateIds
        ];
    }

    /**
     * Toplu ürün güncellemesi için render job'ları oluştur
     *
     * @param array $productIds Ürün ID listesi
     * @param string $companyId Firma ID
     * @param string $source Kaynak
     * @param array $options Seçenekler
     * @return array
     */
    public function onBulkProductsUpdated(array $productIds, string $companyId, string $source = 'import', array $options = []): array
    {
        $batchId = $this->db->generateUuid();
        $totalJobs = 0;
        $results = [];

        // Önce tüm ürünlerin versiyonunu artır
        if (!empty($productIds)) {
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $now = date('Y-m-d H:i:s');
            $this->db->query(
                "UPDATE products SET version = version + 1, render_status = 'pending', updated_at = ?
                 WHERE id IN ($placeholders)",
                array_merge([$now], $productIds)
            );
        }

        // Her ürün için atanmış şablonları bul ve job oluştur
        foreach ($productIds as $index => $productId) {
            $assignments = $this->getProductAssignments($productId, $companyId);
            $templateIds = array_unique(array_filter(array_column($assignments, 'template_id')));

            foreach ($templateIds as $templateId) {
                // Mevcut cache'i stale yap
                $this->markCacheStale($productId, $templateId, $companyId);

                // Job oluştur
                $this->createRenderJob([
                    'company_id' => $companyId,
                    'product_id' => $productId,
                    'template_id' => $templateId,
                    'job_type' => 'bulk',
                    'source' => $source,
                    'priority' => $options['priority'] ?? 'low', // Toplu işlemler düşük öncelikli
                    'batch_id' => $batchId,
                    'created_by' => $options['user_id'] ?? null
                ]);

                $totalJobs++;
            }

            $results[$productId] = count($templateIds);
        }

        // Batch bilgilerini güncelle
        $this->db->query(
            "UPDATE render_jobs SET batch_total = ?, batch_index = (
                SELECT COUNT(*) FROM render_jobs r2
                WHERE r2.batch_id = render_jobs.batch_id AND r2.created_at <= render_jobs.created_at
            ) WHERE batch_id = ?",
            [$totalJobs, $batchId]
        );

        return [
            'success' => true,
            'batch_id' => $batchId,
            'total_products' => count($productIds),
            'total_jobs' => $totalJobs,
            'results' => $results
        ];
    }

    /**
     * Şablon güncellendiğinde ilgili tüm ürünler için render job'u oluştur
     *
     * @param string $templateId Şablon ID
     * @param string $companyId Firma ID
     * @return array
     */
    public function onTemplateUpdated(string $templateId, string $companyId): array
    {
        // Şablon versiyonunu artır
        $this->db->query(
            "UPDATE templates
             SET version = COALESCE(version, 0) + 1,
                 updated_at = ?
             WHERE id = ?",
            [date('Y-m-d H:i:s'), $templateId]
        );

        // Önce bu şablonun mevcut cache kayıtlarını stale yap
        $this->db->query(
            "UPDATE render_cache
             SET status = 'stale', updated_at = CURRENT_TIMESTAMP
             WHERE company_id = ? AND template_id = ?",
            [$companyId, $templateId]
        );

        // Legacy/yardımcı kayıtlar için de completed render'ları stale yap
        $this->db->query(
            "UPDATE product_renders
             SET status = 'stale'
             WHERE company_id = ? AND template_id = ? AND status = 'completed'",
            [$companyId, $templateId]
        );

        // Bu şablondan etkilenen ürünleri farklı kaynaklardan topla
        $productIds = [];

        // 1) Cihaz current_content atamaları
        $devices = $this->db->fetchAll(
            "SELECT current_content
             FROM devices
             WHERE company_id = ? AND current_template_id = ?",
            [$companyId, $templateId]
        );
        foreach ($devices as $device) {
            if (empty($device['current_content'])) {
                continue;
            }
            $content = json_decode($device['current_content'], true);
            if (!empty($content['product_id'])) {
                $productIds[] = (string)$content['product_id'];
            }
        }

        // 2) Ürün üzerindeki assigned_template_id
        $assignedProducts = $this->db->fetchAll(
            "SELECT id
             FROM products
             WHERE company_id = ? AND assigned_template_id = ?",
            [$companyId, $templateId]
        );
        foreach ($assignedProducts as $row) {
            if (!empty($row['id'])) {
                $productIds[] = (string)$row['id'];
            }
        }

        // 3) Mevcut render_cache kayıtları
        $cachedProducts = $this->db->fetchAll(
            "SELECT DISTINCT product_id
             FROM render_cache
             WHERE company_id = ? AND template_id = ?",
            [$companyId, $templateId]
        );
        foreach ($cachedProducts as $row) {
            if (!empty($row['product_id'])) {
                $productIds[] = (string)$row['product_id'];
            }
        }

        // 4) Legacy product_renders kayıtları
        $legacyProducts = $this->db->fetchAll(
            "SELECT DISTINCT product_id
             FROM product_renders
             WHERE company_id = ? AND template_id = ?",
            [$companyId, $templateId]
        );
        foreach ($legacyProducts as $row) {
            if (!empty($row['product_id'])) {
                $productIds[] = (string)$row['product_id'];
            }
        }

        $productIds = array_values(array_unique(array_filter($productIds)));

        if (empty($productIds)) {
            return [
                'success' => true,
                'jobs_created' => 0,
                'message' => 'Bu şablon icin etkilenen urun bulunamadi'
            ];
        }

        $batchId = $this->db->generateUuid();
        $jobsCreated = 0;

        foreach ($productIds as $productId) {
            // Cache'i stale yap
            $this->markCacheStale($productId, $templateId, $companyId);

            // Ayni urun/sablon icin bekleyen bir job varsa yeni job ekleme
            $pendingJob = $this->db->fetch(
                "SELECT id
                 FROM render_jobs
                 WHERE company_id = ? AND product_id = ? AND template_id = ?
                   AND status IN ('pending', 'processing')
                 ORDER BY created_at DESC
                 LIMIT 1",
                [$companyId, $productId, $templateId]
            );
            if ($pendingJob) {
                continue;
            }

            // Job oluştur
            $this->createRenderJob([
                'company_id' => $companyId,
                'product_id' => $productId,
                'template_id' => $templateId,
                'job_type' => 'template_update',
                'source' => 'api',
                'priority' => 'high', // Şablon değişikliği yüksek öncelikli
                'batch_id' => $batchId
            ]);

            $jobsCreated++;
        }

        return [
            'success' => true,
            'batch_id' => $batchId,
            'jobs_created' => $jobsCreated,
            'product_ids' => $productIds,
            'affected_products' => count($productIds)
        ];
    }

    /**
     * Render job oluştur
     */
    public function createRenderJob(array $params): string
    {
        $companyId = trim((string)($params['company_id'] ?? ''));
        $productId = trim((string)($params['product_id'] ?? ''));
        $templateId = $params['template_id'] ?? null;
        $priority = $params['priority'] ?? 'normal';

        // Önce bu ürün/şablon için stale "processing" işleri geri al.
        // Aksi halde aynı job id'si sonsuza kadar tekrar edilip kuyruk kilitlenebilir.
        if ($companyId !== '' && $productId !== '') {
            $recoverFilters = [
                'product_ids' => [$productId]
            ];
            if ($templateId !== null && $templateId !== '') {
                $recoverFilters['template_ids'] = [$templateId];
            }
            $this->recoverStaleProcessingJobs($companyId, $recoverFilters);
        }

        // Avoid queue explosion: if same product/template already has an active job,
        // reuse that job instead of inserting duplicates.
        if ($companyId !== '' && $productId !== '') {
            if ($templateId === null || $templateId === '') {
                $existing = $this->db->fetch(
                    "SELECT id, priority, status
                     FROM render_jobs
                     WHERE company_id = ? AND product_id = ? AND template_id IS NULL
                       AND status IN ('pending', 'processing')
                     ORDER BY created_at DESC
                     LIMIT 1",
                    [$companyId, $productId]
                );
            } else {
                $existing = $this->db->fetch(
                    "SELECT id, priority, status
                     FROM render_jobs
                     WHERE company_id = ? AND product_id = ? AND template_id = ?
                       AND status IN ('pending', 'processing')
                     ORDER BY created_at DESC
                     LIMIT 1",
                    [$companyId, $productId, $templateId]
                );
            }

            if ($existing && !empty($existing['id'])) {
                $this->upgradeJobPriorityIfNeeded(
                    (string)$existing['id'],
                    (string)($existing['priority'] ?? 'normal'),
                    (string)$priority,
                    (string)($existing['status'] ?? 'pending')
                );
                return (string)$existing['id'];
            }
        }

        $jobId = $this->db->generateUuid();

        $this->db->insert('render_jobs', [
            'id' => $jobId,
            'company_id' => $params['company_id'],
            'product_id' => $params['product_id'],
            'template_id' => $params['template_id'] ?? null,
            'job_type' => $params['job_type'] ?? 'product_update',
            'source' => $params['source'] ?? 'api',
            'priority' => $priority,
            'status' => 'pending',
            'batch_id' => $params['batch_id'] ?? null,
            'batch_total' => $params['batch_total'] ?? null,
            'batch_index' => $params['batch_index'] ?? null,
            'created_by' => $params['created_by'] ?? null,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        return $jobId;
    }

    /**
     * Sıradaki render job'unu al (öncelik sırasına göre)
     */
    public function getNextJob(?string $companyId = null, array $filters = []): ?array
    {
        // Worker crash/refresh sonrası "processing"te kalan işleri geri al.
        $this->recoverStaleProcessingJobs($companyId, $filters);
        $productJoin = $this->db->isPostgres()
            ? 'LEFT JOIN products p ON CAST(p.id AS TEXT) = CAST(rj.product_id AS TEXT)'
            : 'LEFT JOIN products p ON p.id = rj.product_id';
        $templateJoin = $this->db->isPostgres()
            ? 'LEFT JOIN templates t ON CAST(t.id AS TEXT) = CAST(rj.template_id AS TEXT)'
            : 'LEFT JOIN templates t ON t.id = rj.template_id';

        $sql = "SELECT rj.*, p.name as product_name, t.name as template_name
                FROM render_jobs rj
                $productJoin
                $templateJoin
                WHERE rj.status = 'pending'";
        $params = [];

        if ($companyId) {
            $sql .= " AND rj.company_id = ?";
            $params[] = $companyId;
        }

        $batchId = trim((string)($filters['batch_id'] ?? ''));
        if ($batchId !== '') {
            $sql .= " AND rj.batch_id = ?";
            $params[] = $batchId;
        }

        $productIds = $this->normalizeFilterIds($filters['product_ids'] ?? []);
        if (!empty($productIds)) {
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $sql .= " AND rj.product_id IN ($placeholders)";
            $params = array_merge($params, $productIds);
        }

        $templateIds = $this->normalizeFilterIds($filters['template_ids'] ?? []);
        if (!empty($templateIds)) {
            $placeholders = implode(',', array_fill(0, count($templateIds), '?'));
            $sql .= " AND rj.template_id IN ($placeholders)";
            $params = array_merge($params, $templateIds);
        }

        // Öncelik sırasına göre sırala
        $sql .= " ORDER BY
            CASE rj.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
            END,
            rj.created_at ASC
            LIMIT 1";

        $job = $this->db->fetch($sql, $params);

        if ($job) {
            // Job'u işleniyor olarak işaretle
            $this->db->query(
                "UPDATE render_jobs SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = ?",
                [$job['id']]
            );
        }

        return $job;
    }

    /**
     * Render job'unu tamamla
     */
    public function completeJob(string $jobId, string $imagePath, string $imageMd5, int $imageSize): bool
    {
        $job = $this->db->fetch("SELECT * FROM render_jobs WHERE id = ?", [$jobId]);
        if (!$job) return false;

        // Job'u tamamla
        $this->db->query(
            "UPDATE render_jobs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [$jobId]
        );

        // Ürün render durumunu güncelle
        $this->db->query(
            "UPDATE products SET render_status = 'ready', last_rendered_at = CURRENT_TIMESTAMP WHERE id = ?",
            [$job['product_id']]
        );

        // Cache kaydını güncelle veya oluştur
        $this->updateCache(
            $job['product_id'],
            $job['template_id'],
            $job['company_id'],
            $imagePath,
            $imageMd5,
            $imageSize
        );

        return true;
    }

    /**
     * Render job'unu başarısız olarak işaretle
     */
    public function failJob(string $jobId, string $errorMessage): bool
    {
        $job = $this->db->fetch("SELECT * FROM render_jobs WHERE id = ?", [$jobId]);
        if (!$job) return false;

        $retryCount = (int)$job['retry_count'] + 1;
        $maxRetries = (int)$job['max_retries'];

        if ($retryCount < $maxRetries) {
            // Tekrar dene
            $this->db->query(
                "UPDATE render_jobs SET status = 'pending', retry_count = ?, error_message = ?, started_at = NULL WHERE id = ?",
                [$retryCount, $errorMessage, $jobId]
            );
        } else {
            // Tamamen başarısız
            $this->db->query(
                "UPDATE render_jobs SET status = 'failed', retry_count = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                [$retryCount, $errorMessage, $jobId]
            );

            // Ürün render durumunu güncelle
            $this->db->query(
                "UPDATE products SET render_status = 'failed' WHERE id = ?",
                [$job['product_id']]
            );
        }

        return true;
    }

    /**
     * Cache'den render al
     *
     * @return array|null Cache bilgisi veya null
     */
    public function getCachedRender(string $productId, string $templateId, string $companyId): ?array
    {
        $cache = $this->db->fetch(
            "SELECT * FROM render_cache
             WHERE product_id = ? AND template_id = ? AND company_id = ? AND status = 'ready'",
            [$productId, $templateId, $companyId]
        );

        if (!$cache || empty($cache['image_path']) || !file_exists($cache['image_path'])) {
            return null;
        }

        // Version korumasi: stale işaretlenememiş olsa bile eski cache'i kullanma.
        $product = $this->db->fetch("SELECT version FROM products WHERE id = ?", [$productId]);
        $template = $this->db->fetch("SELECT version FROM templates WHERE id = ?", [$templateId]);

        $currentProductVersion = (int)($product['version'] ?? 1);
        $currentTemplateVersion = (int)($template['version'] ?? 1);
        $cachedProductVersion = (int)($cache['product_version'] ?? 0);
        $cachedTemplateVersion = (int)($cache['template_version'] ?? 0);

        if ($cachedProductVersion !== $currentProductVersion || $cachedTemplateVersion !== $currentTemplateVersion) {
            $this->markCacheStale($productId, $templateId, $companyId);
            return null;
        }

        // Cache olustuktan sonra ayni urun/sablon icin yeni bir render job'u acildiysa
        // eski gorseli kullanma; once yeni job tamamlansin.
        $cacheRenderedAt = (string)($cache['rendered_at'] ?? $cache['updated_at'] ?? '');
        $activeJob = $this->db->fetch(
            "SELECT id, created_at
             FROM render_jobs
             WHERE company_id = ? AND product_id = ? AND template_id = ?
               AND status IN ('pending', 'processing')
             ORDER BY created_at DESC
             LIMIT 1",
            [$companyId, $productId, $templateId]
        );

        if ($activeJob) {
            $jobCreatedAt = (string)($activeJob['created_at'] ?? '');
            if ($cacheRenderedAt === '' || ($jobCreatedAt !== '' && $jobCreatedAt > $cacheRenderedAt)) {
                return null;
            }
        }

        return $cache;
    }

    /**
     * Toplu gönderim için cache durumunu kontrol et
     *
     * @param array $products Ürün listesi (id, template_id içermeli)
     * @param string $companyId Firma ID
     * @return array Cache durumu
     */
    public function checkBulkCacheStatus(array $products, string $companyId): array
    {
        $ready = [];
        $pending = [];
        $notCached = [];

        foreach ($products as $product) {
            $productId = $product['id'] ?? $product['product_id'] ?? null;
            $templateId = $product['template_id'] ?? $product['labels'][0]['template_id'] ?? null;

            if (!$productId || !$templateId) {
                continue;
            }

            $cache = $this->getCachedRender($productId, $templateId, $companyId);

            if ($cache) {
                $ready[] = [
                    'product_id' => $productId,
                    'template_id' => $templateId,
                    'image_path' => $cache['image_path'],
                    'image_md5' => $cache['image_md5']
                ];
            } else {
                // Bekleyen job var mı kontrol et
                $pendingJob = $this->db->fetch(
                    "SELECT id, status FROM render_jobs
                     WHERE product_id = ? AND template_id = ? AND company_id = ? AND status IN ('pending', 'processing')
                     ORDER BY created_at DESC LIMIT 1",
                    [$productId, $templateId, $companyId]
                );

                if ($pendingJob) {
                    $pending[] = [
                        'product_id' => $productId,
                        'template_id' => $templateId,
                        'job_id' => $pendingJob['id'],
                        'status' => $pendingJob['status']
                    ];
                } else {
                    $notCached[] = [
                        'product_id' => $productId,
                        'template_id' => $templateId
                    ];
                }
            }
        }

        return [
            'total' => count($products),
            'ready' => $ready,
            'ready_count' => count($ready),
            'pending' => $pending,
            'pending_count' => count($pending),
            'not_cached' => $notCached,
            'not_cached_count' => count($notCached),
            'all_ready' => count($ready) === count($products),
            'progress_percent' => count($products) > 0
                ? round((count($ready) / count($products)) * 100, 1)
                : 0
        ];
    }

    /**
     * Cache kaydını güncelle veya oluştur
     */
    public function updateCache(string $productId, string $templateId, string $companyId, string $imagePath, string $imageMd5, int $imageSize): void
    {
        // Ürün ve şablon versiyonlarını al
        $product = $this->db->fetch("SELECT version FROM products WHERE id = ?", [$productId]);
        $template = $this->db->fetch("SELECT version FROM templates WHERE id = ?", [$templateId]);

        $productVersion = $product['version'] ?? 1;
        $templateVersion = $template['version'] ?? 1;
        $cacheKey = md5($productId . $templateId . $productVersion . $templateVersion);

        $existing = $this->db->fetch(
            "SELECT id FROM render_cache WHERE product_id = ? AND template_id = ? AND company_id = ?",
            [$productId, $templateId, $companyId]
        );

        if ($existing) {
            $this->db->query(
                "UPDATE render_cache SET
                    cache_key = ?,
                    product_version = ?,
                    template_version = ?,
                    image_path = ?,
                    image_md5 = ?,
                    image_size = ?,
                    status = 'ready',
                    error_message = NULL,
                    rendered_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?",
                [$cacheKey, $productVersion, $templateVersion, $imagePath, $imageMd5, $imageSize, $existing['id']]
            );
        } else {
            $this->db->insert('render_cache', [
                'id' => $this->db->generateUuid(),
                'company_id' => $companyId,
                'product_id' => $productId,
                'template_id' => $templateId,
                'cache_key' => $cacheKey,
                'product_version' => $productVersion,
                'template_version' => $templateVersion,
                'image_path' => $imagePath,
                'image_md5' => $imageMd5,
                'image_size' => $imageSize,
                'status' => 'ready',
                'rendered_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
        }
    }

    /**
     * Cache'i stale (geçersiz) olarak işaretle
     */
    public function markCacheStale(string $productId, string $templateId, string $companyId): void
    {
        $this->db->query(
            "UPDATE render_cache SET status = 'stale', updated_at = CURRENT_TIMESTAMP
             WHERE product_id = ? AND template_id = ? AND company_id = ?",
            [$productId, $templateId, $companyId]
        );

        // Legacy MQTT path compatibility: ensure old product_renders entries are not reused.
        $this->db->query(
            "UPDATE product_renders
             SET status = 'stale'
             WHERE company_id = ? AND product_id = ? AND template_id = ? AND status = 'completed'",
            [$companyId, $productId, $templateId]
        );
    }

    /**
     * Bekleyen job sayısını al
     */
    public function getPendingJobCount(?string $companyId = null, array $filters = []): int
    {
        $sql = "SELECT COUNT(*) as count
                FROM render_jobs
                WHERE status IN ('pending', 'processing')";
        $params = [];

        if ($companyId) {
            $sql .= " AND company_id = ?";
            $params[] = $companyId;
        }

        $batchId = trim((string)($filters['batch_id'] ?? ''));
        if ($batchId !== '') {
            $sql .= " AND batch_id = ?";
            $params[] = $batchId;
        }

        $productIds = $this->normalizeFilterIds($filters['product_ids'] ?? []);
        if (!empty($productIds)) {
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $sql .= " AND product_id IN ($placeholders)";
            $params = array_merge($params, $productIds);
        }

        $templateIds = $this->normalizeFilterIds($filters['template_ids'] ?? []);
        if (!empty($templateIds)) {
            $placeholders = implode(',', array_fill(0, count($templateIds), '?'));
            $sql .= " AND template_id IN ($placeholders)";
            $params = array_merge($params, $templateIds);
        }

        $result = $this->db->fetch($sql, $params);
        return (int)($result['count'] ?? 0);
    }

    private function upgradeJobPriorityIfNeeded(string $jobId, string $currentPriority, string $requestedPriority, string $status): void
    {
        if ($status !== 'pending') {
            return;
        }

        $currentWeight = self::PRIORITY_WEIGHTS[$currentPriority] ?? self::PRIORITY_WEIGHTS['normal'];
        $requestedWeight = self::PRIORITY_WEIGHTS[$requestedPriority] ?? self::PRIORITY_WEIGHTS['normal'];

        if ($requestedWeight <= $currentWeight) {
            return;
        }

        $this->db->query(
            "UPDATE render_jobs SET priority = ? WHERE id = ? AND status = 'pending'",
            [$requestedPriority, $jobId]
        );
    }

    private function normalizeFilterIds($rawIds): array
    {
        if (is_string($rawIds)) {
            $rawIds = explode(',', $rawIds);
        }

        if (!is_array($rawIds)) {
            return [];
        }

        $normalized = [];
        foreach ($rawIds as $id) {
            $value = trim((string)$id);
            if ($value !== '') {
                $normalized[$value] = true;
            }
        }

        return array_keys($normalized);
    }

    /**
     * "processing"te takılı kalan işleri tekrar "pending"e al.
     *
     * @param string|null $companyId
     * @param array $filters batch/product/template filtresi
     * @param int $staleSeconds
     * @return int Güncellenen satır sayısı
     */
    private function recoverStaleProcessingJobs(?string $companyId = null, array $filters = [], int $staleSeconds = 120): int
    {
        $seconds = max(30, (int)$staleSeconds);
        if ($this->db->isPostgres()) {
            $sql = "UPDATE render_jobs
                    SET status = 'pending',
                        started_at = NULL
                    WHERE status = 'processing'
                      AND (started_at IS NULL OR started_at < (CURRENT_TIMESTAMP - (? * INTERVAL '1 second')))";
            $params = [$seconds];
        } else {
            $modifier = '-' . $seconds . ' seconds';
            $sql = "UPDATE render_jobs
                    SET status = 'pending',
                        started_at = NULL
                    WHERE status = 'processing'
                      AND (started_at IS NULL OR started_at < datetime('now', ?))";
            $params = [$modifier];
        }

        if ($companyId) {
            $sql .= " AND company_id = ?";
            $params[] = $companyId;
        }

        $batchId = trim((string)($filters['batch_id'] ?? ''));
        if ($batchId !== '') {
            $sql .= " AND batch_id = ?";
            $params[] = $batchId;
        }

        $productIds = $this->normalizeFilterIds($filters['product_ids'] ?? []);
        if (!empty($productIds)) {
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $sql .= " AND product_id IN ($placeholders)";
            $params = array_merge($params, $productIds);
        }

        $templateIds = $this->normalizeFilterIds($filters['template_ids'] ?? []);
        if (!empty($templateIds)) {
            $placeholders = implode(',', array_fill(0, count($templateIds), '?'));
            $sql .= " AND template_id IN ($placeholders)";
            $params = array_merge($params, $templateIds);
        }

        $stmt = $this->db->query($sql, $params);
        if ($stmt && method_exists($stmt, 'rowCount')) {
            return (int)$stmt->rowCount();
        }

        return 0;
    }

    /**
     * Batch durumunu al
     */
    public function getBatchStatus(string $batchId): array
    {
        $jobs = $this->db->fetchAll(
            "SELECT status, COUNT(*) as count FROM render_jobs WHERE batch_id = ? GROUP BY status",
            [$batchId]
        );

        $total = $this->db->fetch(
            "SELECT COUNT(*) as total FROM render_jobs WHERE batch_id = ?",
            [$batchId]
        );

        $statusCounts = [];
        foreach ($jobs as $job) {
            $statusCounts[$job['status']] = (int)$job['count'];
        }

        $completed = ($statusCounts['completed'] ?? 0) + ($statusCounts['failed'] ?? 0);
        $totalCount = (int)($total['total'] ?? 0);

        return [
            'batch_id' => $batchId,
            'total' => $totalCount,
            'completed' => $statusCounts['completed'] ?? 0,
            'failed' => $statusCounts['failed'] ?? 0,
            'pending' => $statusCounts['pending'] ?? 0,
            'processing' => $statusCounts['processing'] ?? 0,
            'progress_percent' => $totalCount > 0 ? round(($completed / $totalCount) * 100, 1) : 0,
            'is_complete' => $completed >= $totalCount
        ];
    }

    /**
     * Ürünün atandığı cihazları ve şablonları al
     */
    private function getProductAssignments(string $productId, string $companyId): array
    {
        $assignments = [];

        // JSON1 fonksiyonlarinda malformed JSON hatasina dusmemek icin
        // current_content parse islemi SQL yerine PHP tarafinda yapilir.
        $devices = $this->db->fetchAll(
            "SELECT d.id as device_id, d.current_template_id as template_id, d.current_content
             FROM devices d
             WHERE d.company_id = ?
               AND d.current_content IS NOT NULL
               AND TRIM(d.current_content) != ''",
            [$companyId]
        );

        foreach ($devices as $device) {
            $rawContent = $device['current_content'] ?? '';
            if (!is_string($rawContent) || trim($rawContent) === '') {
                continue;
            }

            $content = json_decode($rawContent, true);
            if (!is_array($content)) {
                continue;
            }

            $contentProductId = (string)($content['product_id'] ?? '');
            if ($contentProductId !== (string)$productId) {
                continue;
            }

            $assignments[] = [
                'device_id' => $device['device_id'],
                'template_id' => $device['template_id']
            ];
        }

        // Fallback: use product assigned_device_id/assigned_template_id
        $product = $this->db->fetch(
            "SELECT assigned_device_id, assigned_template_id FROM products WHERE id = ? AND company_id = ?",
            [$productId, $companyId]
        );

        if ($product && !empty($product['assigned_device_id'])) {
            $device = $this->db->fetch(
                "SELECT id, current_template_id FROM devices WHERE id = ? AND company_id = ?",
                [$product['assigned_device_id'], $companyId]
            );

            if ($device) {
                $templateId = $product['assigned_template_id'] ?? $device['current_template_id'] ?? null;
                if ($templateId) {
                    $assignments[] = [
                        'device_id' => $device['id'],
                        'template_id' => $templateId
                    ];
                }
            }
        }

        // De-duplicate and filter empty template ids
        $unique = [];
        $final = [];
        foreach ($assignments as $assignment) {
            $deviceId = $assignment['device_id'] ?? '';
            $templateId = $assignment['template_id'] ?? '';
            if (!$deviceId || !$templateId) {
                continue;
            }
            $key = $deviceId . '|' . $templateId;
            if (!isset($unique[$key])) {
                $unique[$key] = true;
                $final[] = $assignment;
            }
        }

        return $final;
    }

    /**
     * İstatistikleri al
     */
    public function getStats(string $companyId): array
    {
        $last24hExpr = $this->db->isPostgres()
            ? "CURRENT_TIMESTAMP - INTERVAL '24 hours'"
            : "datetime('now', '-24 hours')";
        // Cache istatistikleri
        $cacheStats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN status = 'stale' THEN 1 ELSE 0 END) as stale,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(image_size) as total_size
             FROM render_cache WHERE company_id = ?",
            [$companyId]
        );

        // Job istatistikleri
        $jobStats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
             FROM render_jobs WHERE company_id = ?",
            [$companyId]
        );

        // Son 24 saat istatistikleri
        $last24h = $this->db->fetch(
            "SELECT
                COUNT(*) as jobs_created,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as jobs_completed
             FROM render_jobs
             WHERE company_id = ? AND created_at >= $last24hExpr",
            [$companyId]
        );

        return [
            'cache' => [
                'total' => (int)($cacheStats['total'] ?? 0),
                'ready' => (int)($cacheStats['ready'] ?? 0),
                'stale' => (int)($cacheStats['stale'] ?? 0),
                'pending' => (int)($cacheStats['pending'] ?? 0),
                'failed' => (int)($cacheStats['failed'] ?? 0),
                'total_size_mb' => round(($cacheStats['total_size'] ?? 0) / 1024 / 1024, 2)
            ],
            'jobs' => [
                'total' => (int)($jobStats['total'] ?? 0),
                'pending' => (int)($jobStats['pending'] ?? 0),
                'processing' => (int)($jobStats['processing'] ?? 0),
                'completed' => (int)($jobStats['completed'] ?? 0),
                'failed' => (int)($jobStats['failed'] ?? 0)
            ],
            'last_24h' => [
                'created' => (int)($last24h['jobs_created'] ?? 0),
                'completed' => (int)($last24h['jobs_completed'] ?? 0)
            ]
        ];
    }

    /**
     * Eski job kayıtlarını temizle
     */
    public function cleanupOldJobs(int $daysOld = 7): int
    {
        if ($this->db->isPostgres()) {
            $result = $this->db->query(
                "DELETE FROM render_jobs
                 WHERE status IN ('completed', 'failed')
                   AND completed_at < (CURRENT_TIMESTAMP - (? * INTERVAL '1 day'))",
                [$daysOld]
            );
        } else {
            $result = $this->db->query(
                "DELETE FROM render_jobs WHERE status IN ('completed', 'failed') AND completed_at < datetime('now', '-' || ? || ' days')",
                [$daysOld]
            );
        }

        return $result->rowCount();
    }
}

