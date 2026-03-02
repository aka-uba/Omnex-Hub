<?php
/**
 * StorageService - Firma depolama yönetimi
 *
 * Multi-tenant ortamda firma bazlı depolama kotası kontrolü ve
 * kullanım takibi sağlar.
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

class StorageService
{
    private $db;

    // Varsayılan limitler (MB cinsinden)
    const DEFAULT_LIMIT_MB = 1024; // 1GB

    // Cache süresi (saniye)
    const CACHE_TTL = 3600; // 1 saat

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Kota kontrolü
     *
     * @param string $companyId Firma ID
     * @param int $additionalBytes Eklenecek byte miktarı
     * @return array ['allowed' => bool, 'message' => string, ...]
     */
    public function checkQuota(string $companyId, int $additionalBytes): array
    {
        $usage = $this->getUsage($companyId);
        $limit = $this->getLimit($companyId);

        // Limit 0 ise sınırsız (unlimited license)
        if ($limit <= 0) {
            return [
                'allowed' => true,
                'unlimited' => true,
                'usage' => $usage,
                'limit_mb' => 0
            ];
        }

        $limitBytes = $limit * 1024 * 1024; // MB -> Bytes
        $newTotal = $usage['total_bytes'] + $additionalBytes;

        if ($newTotal > $limitBytes) {
            $usedMB = round($usage['total_bytes'] / 1024 / 1024, 2);
            $additionalMB = round($additionalBytes / 1024 / 1024, 2);

            return [
                'allowed' => false,
                'message' => "Depolama kotası aşıldı. Kullanılan: {$usedMB}MB / {$limit}MB. Yüklemek istediğiniz dosya: {$additionalMB}MB",
                'usage' => $usage,
                'limit_mb' => $limit,
                'remaining_bytes' => max(0, $limitBytes - $usage['total_bytes']),
                'remaining_mb' => round(max(0, $limitBytes - $usage['total_bytes']) / 1024 / 1024, 2)
            ];
        }

        return [
            'allowed' => true,
            'remaining_bytes' => $limitBytes - $newTotal,
            'remaining_mb' => round(($limitBytes - $newTotal) / 1024 / 1024, 2),
            'usage' => $usage,
            'limit_mb' => $limit
        ];
    }

    /**
     * Kullanım bilgisi al veya hesapla
     *
     * @param string $companyId Firma ID
     * @param bool $forceRecalculate Yeniden hesaplamayı zorla
     * @return array Kullanım detayları
     */
    public function getUsage(string $companyId, bool $forceRecalculate = false): array
    {
        $cached = $this->db->fetch(
            "SELECT * FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        // 1 saatten eski veya yoksa yeniden hesapla
        $shouldRecalculate = $forceRecalculate || !$cached;

        if (!$shouldRecalculate && $cached) {
            $lastCalculated = strtotime($cached['last_calculated_at'] ?? '2000-01-01');
            $shouldRecalculate = $lastCalculated < (time() - self::CACHE_TTL);
        }

        if ($shouldRecalculate) {
            return $this->recalculateUsage($companyId);
        }

        return [
            'media_bytes' => (int)$cached['media_bytes'],
            'templates_bytes' => (int)$cached['templates_bytes'],
            'renders_bytes' => (int)$cached['renders_bytes'],
            'total_bytes' => (int)$cached['total_bytes'],
            'last_calculated_at' => $cached['last_calculated_at']
        ];
    }

    /**
     * Kullanımı yeniden hesapla (disk tarama)
     *
     * @param string $companyId Firma ID
     * @return array Hesaplanan kullanım
     */
    public function recalculateUsage(string $companyId): array
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
        $basePath = $storagePath . DIRECTORY_SEPARATOR . 'companies' . DIRECTORY_SEPARATOR . $companyId;

        $mediaBytes = $this->calculateDirectorySize($basePath . DIRECTORY_SEPARATOR . 'media');
        $templatesBytes = $this->calculateDirectorySize($basePath . DIRECTORY_SEPARATOR . 'templates');
        $rendersBytes = $this->calculateDirectorySize($basePath . DIRECTORY_SEPARATOR . 'renders');
        $totalBytes = $mediaBytes + $templatesBytes + $rendersBytes;

        // Veritabanına kaydet
        $existing = $this->db->fetch(
            "SELECT id FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        $data = [
            'company_id' => $companyId,
            'media_bytes' => $mediaBytes,
            'templates_bytes' => $templatesBytes,
            'renders_bytes' => $rendersBytes,
            'total_bytes' => $totalBytes,
            'last_calculated_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            $this->db->update('company_storage_usage', $data, 'company_id = ?', [$companyId]);
        } else {
            $data['id'] = $this->db->generateUuid();
            $data['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('company_storage_usage', $data);
        }

        return [
            'media_bytes' => $mediaBytes,
            'templates_bytes' => $templatesBytes,
            'renders_bytes' => $rendersBytes,
            'total_bytes' => $totalBytes,
            'last_calculated_at' => $data['last_calculated_at']
        ];
    }

    /**
     * Dizin boyutunu hesapla
     *
     * @param string $path Dizin yolu
     * @return int Toplam byte
     */
    private function calculateDirectorySize(string $path): int
    {
        if (!is_dir($path)) return 0;

        $size = 0;

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $size += $file->getSize();
                }
            }
        } catch (Exception $e) {
            // Dizin okunamadı, 0 dön
            error_log("StorageService: Directory size calculation failed for {$path}: " . $e->getMessage());
        }

        return $size;
    }

    /**
     * Firma depolama limitini al (lisanstan veya plandan)
     *
     * @param string $companyId Firma ID
     * @return int Limit (MB cinsinden), 0 = sınırsız
     */
    public function getLimit(string $companyId): int
    {
        // LicenseService üzerinden merkezi limit kontrolü
        $limitInfo = LicenseService::getLimit($companyId, 'storage');

        // Sınırsız ise 0 döndür
        if ($limitInfo['unlimited']) {
            return 0;
        }

        // Limit değerini döndür
        $limit = $limitInfo['limit'] ?? 0;

        // -1 de sınırsız anlamına gelir (standart değer)
        if ($limit === -1) {
            return 0;
        }

        // Geçerli limit varsa döndür, yoksa varsayılan
        return $limit > 0 ? (int)$limit : self::DEFAULT_LIMIT_MB;
    }

    /**
     * Kullanımı artır (hızlı güncelleme - dosya yükleme sonrası)
     *
     * @param string $companyId Firma ID
     * @param int $bytes Artırılacak byte miktarı
     * @param string $type Kategori: media, templates, renders
     */
    public function incrementUsage(string $companyId, int $bytes, string $type = 'media'): void
    {
        $allowedTypes = ['media', 'templates', 'renders'];
        if (!in_array($type, $allowedTypes)) {
            $type = 'media';
        }

        $column = $type . '_bytes';

        // Önce kayıt var mı kontrol et
        $existing = $this->db->fetch(
            "SELECT id FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        if ($existing) {
            $this->db->query(
                "UPDATE company_storage_usage
                 SET {$column} = {$column} + ?,
                     total_bytes = total_bytes + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE company_id = ?",
                [$bytes, $bytes, $companyId]
            );
        } else {
            // İlk kullanım - kayıt oluştur
            $data = [
                'id' => $this->db->generateUuid(),
                'company_id' => $companyId,
                'media_bytes' => $type === 'media' ? $bytes : 0,
                'templates_bytes' => $type === 'templates' ? $bytes : 0,
                'renders_bytes' => $type === 'renders' ? $bytes : 0,
                'total_bytes' => $bytes,
                'last_calculated_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];
            $this->db->insert('company_storage_usage', $data);
        }

        // Depolama eşik bildirimi kontrolü
        $this->checkStorageNotification($companyId);
    }

    /**
     * Depolama bildirim kontrolü
     * Eşik aşıldığında bildirim tetikler (günde 1 kez)
     *
     * @param string $companyId Firma ID
     */
    public function checkStorageNotification(string $companyId): void
    {
        try {
            $limit = $this->getLimit($companyId);

            // Sınırsız lisanslarda bildirim gerekmez
            if ($limit <= 0) return;

            $usage = $this->getUsage($companyId);
            $usedMB = round($usage['total_bytes'] / 1024 / 1024);
            $percentage = round(($usedMB / $limit) * 100);

            // %75 altında bildirim gerekmez
            if ($percentage < 75) return;

            // Deduplikasyon: Son 24 saatte aynı uyarı gönderilmiş mi?
            $title = $percentage >= 90 ? 'Depolama Alani Kritik' : 'Depolama Alani Azaliyor';
            $recentExpr = $this->db->isPostgres()
                ? "CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                : "datetime('now', '-24 hours')";
            $existing = $this->db->fetch(
                "SELECT id FROM notifications WHERE company_id = ? AND title = ? AND created_at >= $recentExpr",
                [$companyId, $title]
            );

            if ($existing) return; // Son 24 saatte zaten gönderilmiş

            NotificationTriggers::onStorageLimitWarning($companyId, $usedMB, $limit);
        } catch (\Exception $e) {
            // Bildirim hatası yükleme işlemini engellemez
            if (class_exists('Logger')) {
                Logger::error('StorageService: Notification check failed', ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * Kullanımı azalt (dosya silme sonrası)
     *
     * @param string $companyId Firma ID
     * @param int $bytes Azaltılacak byte miktarı
     * @param string $type Kategori: media, templates, renders
     */
    public function decrementUsage(string $companyId, int $bytes, string $type = 'media'): void
    {
        $allowedTypes = ['media', 'templates', 'renders'];
        if (!in_array($type, $allowedTypes)) {
            $type = 'media';
        }

        $column = $type . '_bytes';

        $this->db->query(
            "UPDATE company_storage_usage
             SET {$column} = CASE
                     WHEN {$column} > ? THEN {$column} - ?
                     ELSE 0
                 END,
                 total_bytes = CASE
                     WHEN total_bytes > ? THEN total_bytes - ?
                     ELSE 0
                 END,
                  updated_at = CURRENT_TIMESTAMP
             WHERE company_id = ?",
            [$bytes, $bytes, $bytes, $bytes, $companyId]
        );
    }

    /**
     * Kullanım özetini formatla
     *
     * @param string $companyId Firma ID
     * @return array Formatlanmış özet
     */
    public function getFormattedUsage(string $companyId): array
    {
        $usage = $this->getUsage($companyId);
        $limit = $this->getLimit($companyId);

        $unlimited = ($limit <= 0);
        $percentUsed = 0;

        if (!$unlimited && $limit > 0) {
            $usedMB = $usage['total_bytes'] / 1024 / 1024;
            $percentUsed = min(100, round(($usedMB / $limit) * 100, 1));
        }

        return [
            'usage' => $usage,
            'usage_mb' => [
                'media' => round($usage['media_bytes'] / 1024 / 1024, 2),
                'templates' => round($usage['templates_bytes'] / 1024 / 1024, 2),
                'renders' => round($usage['renders_bytes'] / 1024 / 1024, 2),
                'total' => round($usage['total_bytes'] / 1024 / 1024, 2)
            ],
            'limit_mb' => $limit,
            'unlimited' => $unlimited,
            'percent_used' => $percentUsed,
            'status' => $this->getUsageStatus($percentUsed, $unlimited),
            'last_calculated_at' => $usage['last_calculated_at'] ?? null
        ];
    }

    /**
     * Kullanım durumu (renk kodu için)
     */
    private function getUsageStatus(float $percent, bool $unlimited): string
    {
        if ($unlimited) return 'unlimited';
        if ($percent >= 90) return 'critical';
        if ($percent >= 70) return 'warning';
        return 'normal';
    }

    /**
     * Tüm firmaların kullanım özetini al (Admin)
     *
     * @return array Firma listesi kullanım bilgileriyle
     */
    public function getAllCompaniesUsage(): array
    {
        // Önce firmaları ve kullanımlarını al
        $companies = $this->db->fetchAll(
            "SELECT c.id, c.name, c.code,
                    COALESCE(su.total_bytes, 0) as total_bytes,
                    COALESCE(su.media_bytes, 0) as media_bytes,
                    COALESCE(su.templates_bytes, 0) as templates_bytes,
                    COALESCE(su.renders_bytes, 0) as renders_bytes,
                    p.max_storage,
                    p.is_unlimited as plan_is_unlimited,
                    p.plan_type
             FROM companies c
             LEFT JOIN company_storage_usage su ON c.id = su.company_id
             LEFT JOIN (
                 SELECT l.company_id, l.plan_id
                 FROM licenses l
                 WHERE l.status = 'active'
                 GROUP BY l.company_id
                 HAVING l.created_at = MAX(l.created_at)
             ) lic ON c.id = lic.company_id
             LEFT JOIN license_plans p ON lic.plan_id = p.id
             WHERE c.status = 'active'
             ORDER BY total_bytes DESC"
        );

        return array_map(function ($company) {
            // Sınırsız plan kontrolü
            $isUnlimited = (int)($company['plan_is_unlimited'] ?? 0) === 1 ||
                           in_array($company['plan_type'] ?? '', ['enterprise', 'ultimate', 'unlimited']);

            // Limit belirleme
            $maxStorage = $company['max_storage'] ?? 0;
            $limit = $isUnlimited ? 0 : (LicenseService::isUnlimitedValue($maxStorage) ? 0 : (int)$maxStorage);
            if ($limit <= 0 && !$isUnlimited) {
                $limit = self::DEFAULT_LIMIT_MB;
            }

            $usedMB = $company['total_bytes'] / 1024 / 1024;
            $percentUsed = $limit > 0 ? min(100, round(($usedMB / $limit) * 100, 1)) : 0;

            return [
                'id' => $company['id'],
                'name' => $company['name'],
                'code' => $company['code'],
                'usage_bytes' => (int)$company['total_bytes'],
                'usage_mb' => round($usedMB, 2),
                'limit_mb' => $limit,
                'unlimited' => $isUnlimited || $limit <= 0,
                'percent_used' => $percentUsed,
                'status' => $this->getUsageStatus($percentUsed, $isUnlimited || $limit <= 0)
            ];
        }, $companies);
    }

    /**
     * Firma dizin yapısını oluştur
     *
     * @param string $companyId Firma ID
     * @return bool Başarılı mı
     */
    public function ensureCompanyDirectories(string $companyId): bool
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
        $basePath = $storagePath . DIRECTORY_SEPARATOR . 'companies' . DIRECTORY_SEPARATOR . $companyId;

        $directories = [
            $basePath . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'images',
            $basePath . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'videos',
            $basePath . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'renders',
            $basePath . DIRECTORY_SEPARATOR . 'renders' . DIRECTORY_SEPARATOR . 'products'
        ];

        $success = true;
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                if (!@mkdir($dir, 0755, true)) {
                    error_log("StorageService: Failed to create directory: {$dir}");
                    $success = false;
                }
            }
        }

        return $success;
    }
}

