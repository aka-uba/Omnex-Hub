<?php
/**
 * RenderService - Ürün render yönetimi
 *
 * Ürün değişikliklerinde render invalidation ve versiyon bazlı
 * cache kontrolü sağlar.
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

class RenderService
{
    private $db;
    private $storageService;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->storageService = new StorageService();
    }

    /**
     * Ürün render'larını geçersiz kıl ve sil
     *
     * @param string $productId Ürün ID
     * @param string $companyId Firma ID
     * @return array Silme sonucu
     */
    public function invalidateProductRenders(string $productId, string $companyId): array
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
        $basePath = $storagePath . DIRECTORY_SEPARATOR . 'companies' . DIRECTORY_SEPARATOR .
                    $companyId . DIRECTORY_SEPARATOR . 'renders' . DIRECTORY_SEPARATOR .
                    'products' . DIRECTORY_SEPARATOR . $productId;

        $deletedBytes = 0;
        $deletedCount = 0;

        if (is_dir($basePath)) {
            try {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::CHILD_FIRST
                );

                foreach ($iterator as $file) {
                    if ($file->isFile()) {
                        $deletedBytes += $file->getSize();
                        @unlink($file->getPathname());
                        $deletedCount++;
                    } elseif ($file->isDir()) {
                        @rmdir($file->getPathname());
                    }
                }
                @rmdir($basePath);
            } catch (Exception $e) {
                error_log("RenderService: Failed to delete renders for product {$productId}: " . $e->getMessage());
            }
        }

        // Veritabanından kayıtları sil
        $this->db->delete('product_renders', 'product_id = ?', [$productId]);

        // Storage kullanımını güncelle
        if ($deletedBytes > 0) {
            $this->storageService->decrementUsage($companyId, $deletedBytes, 'renders');
        }

        // Audit log
        if (class_exists('Logger')) {
            Logger::audit('render_invalidation', 'product', [
                'product_id' => $productId,
                'company_id' => $companyId,
                'deleted_files' => $deletedCount,
                'freed_bytes' => $deletedBytes
            ]);
        }

        return [
            'deleted_files' => $deletedCount,
            'freed_bytes' => $deletedBytes,
            'freed_mb' => round($deletedBytes / 1024 / 1024, 2)
        ];
    }

    /**
     * Şablon render'larını geçersiz kıl
     *
     * @param string $templateId Şablon ID
     * @param string $companyId Firma ID
     * @return array Silme sonucu
     */
    public function invalidateTemplateRenders(string $templateId, string $companyId): array
    {
        // Şablonu kullanan tüm ürün render'larını sil
        $renders = $this->db->fetchAll(
            "SELECT DISTINCT product_id FROM product_renders WHERE template_id = ? AND company_id = ?",
            [$templateId, $companyId]
        );

        $totalDeleted = 0;
        $totalBytes = 0;

        foreach ($renders as $render) {
            $result = $this->invalidateProductRenders($render['product_id'], $companyId);
            $totalDeleted += $result['deleted_files'];
            $totalBytes += $result['freed_bytes'];
        }

        return [
            'affected_products' => count($renders),
            'deleted_files' => $totalDeleted,
            'freed_bytes' => $totalBytes,
            'freed_mb' => round($totalBytes / 1024 / 1024, 2)
        ];
    }

    /**
     * Yeni render kaydet
     *
     * @param array $params Render bilgileri
     * @return string Oluşturulan render ID
     */
    public function saveRender(array $params): string
    {
        // Mevcut render varsa güncelle
        $existing = $this->db->fetch(
            "SELECT id, file_size FROM product_renders
             WHERE product_id = ? AND template_id = ? AND device_type = ? AND locale = ?",
            [
                $params['product_id'],
                $params['template_id'],
                $params['device_type'] ?? 'default',
                $params['locale'] ?? 'tr'
            ]
        );

        if ($existing) {
            // Eski boyutu çıkar, yeni boyutu ekle
            $oldSize = (int)$existing['file_size'];
            $newSize = (int)($params['file_size'] ?? 0);

            $this->db->update('product_renders', [
                'file_path' => $params['file_path'],
                'file_size' => $newSize,
                'product_version' => $params['product_version'] ?? 1,
                'template_version' => $params['template_version'] ?? 1,
                'render_hash' => $params['render_hash'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$existing['id']]);

            // Storage farkını güncelle
            $sizeDiff = $newSize - $oldSize;
            if ($sizeDiff > 0) {
                $this->storageService->incrementUsage($params['company_id'], $sizeDiff, 'renders');
            } elseif ($sizeDiff < 0) {
                $this->storageService->decrementUsage($params['company_id'], abs($sizeDiff), 'renders');
            }

            return $existing['id'];
        }

        // Yeni kayıt oluştur
        $id = $this->db->generateUuid();

        $this->db->insert('product_renders', [
            'id' => $id,
            'company_id' => $params['company_id'],
            'product_id' => $params['product_id'],
            'template_id' => $params['template_id'],
            'device_type' => $params['device_type'] ?? 'default',
            'locale' => $params['locale'] ?? 'tr',
            'file_path' => $params['file_path'],
            'file_size' => $params['file_size'] ?? 0,
            'product_version' => $params['product_version'] ?? 1,
            'template_version' => $params['template_version'] ?? 1,
            'render_hash' => $params['render_hash'] ?? null
        ]);

        // Storage kullanımını artır
        if (!empty($params['file_size'])) {
            $this->storageService->incrementUsage($params['company_id'], $params['file_size'], 'renders');
        }

        return $id;
    }

    /**
     * Render yolu oluştur
     *
     * @param string $companyId Firma ID
     * @param string $productId Ürün ID
     * @param string $templateId Şablon ID
     * @param string $deviceType Cihaz tipi
     * @param string $locale Dil kodu
     * @return string Relative path
     */
    public function getRenderPath(string $companyId, string $productId, string $templateId, string $deviceType = 'default', string $locale = 'tr'): string
    {
        $hash = substr(md5($templateId . $deviceType . $locale), 0, 8);
        return "companies/{$companyId}/renders/products/{$productId}/{$hash}.jpg";
    }

    /**
     * Render var mı ve güncel mi kontrol et
     *
     * @param string $productId Ürün ID
     * @param string $templateId Şablon ID
     * @param int $productVersion Beklenen ürün versiyonu
     * @param int $templateVersion Beklenen şablon versiyonu
     * @param string|null $deviceType Cihaz tipi
     * @param string|null $locale Dil kodu
     * @return array|null Varsa render kaydı, yoksa null
     */
    public function isRenderValid(string $productId, string $templateId, int $productVersion, int $templateVersion, ?string $deviceType = null, ?string $locale = null): ?array
    {
        $sql = "SELECT * FROM product_renders
                WHERE product_id = ? AND template_id = ?
                AND product_version = ? AND template_version = ?";
        $params = [$productId, $templateId, $productVersion, $templateVersion];

        if ($deviceType !== null) {
            $sql .= " AND device_type = ?";
            $params[] = $deviceType;
        }

        if ($locale !== null) {
            $sql .= " AND locale = ?";
            $params[] = $locale;
        }

        $render = $this->db->fetch($sql, $params);

        // Dosya da mevcut mu kontrol et
        if ($render) {
            $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
            $fullPath = $storagePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $render['file_path']);

            if (!file_exists($fullPath)) {
                // Dosya yok, kaydı sil
                $this->db->delete('product_renders', 'id = ?', [$render['id']]);
                return null;
            }
        }

        return $render;
    }

    /**
     * Ürünün tüm render'larını getir
     *
     * @param string $productId Ürün ID
     * @return array Render listesi
     */
    public function getProductRenders(string $productId): array
    {
        $templateJoin = $this->db->isPostgres()
            ? 'LEFT JOIN templates t ON CAST(pr.template_id AS TEXT) = CAST(t.id AS TEXT)'
            : 'LEFT JOIN templates t ON pr.template_id = t.id';
        return $this->db->fetchAll(
            "SELECT pr.*, t.name as template_name
             FROM product_renders pr
             $templateJoin
             WHERE pr.product_id = ?
             ORDER BY pr.created_at DESC",
            [$productId]
        );
    }

    /**
     * Şablonun render sayısını getir
     *
     * @param string $templateId Şablon ID
     * @return int Render sayısı
     */
    public function getTemplateRenderCount(string $templateId): int
    {
        $result = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM product_renders WHERE template_id = ?",
            [$templateId]
        );
        return (int)($result['cnt'] ?? 0);
    }

    /**
     * Firma render istatistikleri
     *
     * @param string $companyId Firma ID
     * @return array İstatistikler
     */
    public function getCompanyRenderStats(string $companyId): array
    {
        $stats = $this->db->fetch(
            "SELECT
                COUNT(*) as total_renders,
                COUNT(DISTINCT product_id) as unique_products,
                COUNT(DISTINCT template_id) as unique_templates,
                SUM(file_size) as total_bytes
             FROM product_renders
             WHERE company_id = ?",
            [$companyId]
        );

        return [
            'total_renders' => (int)($stats['total_renders'] ?? 0),
            'unique_products' => (int)($stats['unique_products'] ?? 0),
            'unique_templates' => (int)($stats['unique_templates'] ?? 0),
            'total_bytes' => (int)($stats['total_bytes'] ?? 0),
            'total_mb' => round(($stats['total_bytes'] ?? 0) / 1024 / 1024, 2)
        ];
    }

    /**
     * Eski/geçersiz render'ları temizle
     *
     * @param string $companyId Firma ID
     * @param int $daysOld Kaç günden eski (varsayılan 30)
     * @return array Temizleme sonucu
     */
    public function cleanupOldRenders(string $companyId, int $daysOld = 30): array
    {
        $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$daysOld} days"));

        // Eski render kayıtlarını bul
        $oldRenders = $this->db->fetchAll(
            "SELECT DISTINCT product_id FROM product_renders
             WHERE company_id = ? AND created_at < ?",
            [$companyId, $cutoffDate]
        );

        $cleanedCount = 0;
        $freedBytes = 0;

        foreach ($oldRenders as $render) {
            // Ürün hala var mı kontrol et
            $product = $this->db->fetch(
                "SELECT version FROM products WHERE id = ?",
                [$render['product_id']]
            );

            if (!$product) {
                // Ürün silinmiş, render'ları da sil
                $result = $this->invalidateProductRenders($render['product_id'], $companyId);
                $cleanedCount += $result['deleted_files'];
                $freedBytes += $result['freed_bytes'];
            }
        }

        return [
            'cleaned_files' => $cleanedCount,
            'freed_bytes' => $freedBytes,
            'freed_mb' => round($freedBytes / 1024 / 1024, 2)
        ];
    }

    /**
     * Render dizinini hazırla
     *
     * @param string $companyId Firma ID
     * @param string $productId Ürün ID
     * @return string Dizin yolu
     */
    public function ensureRenderDirectory(string $companyId, string $productId): string
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
        $dirPath = $storagePath . DIRECTORY_SEPARATOR . 'companies' . DIRECTORY_SEPARATOR .
                   $companyId . DIRECTORY_SEPARATOR . 'renders' . DIRECTORY_SEPARATOR .
                   'products' . DIRECTORY_SEPARATOR . $productId;

        if (!is_dir($dirPath)) {
            @mkdir($dirPath, 0755, true);
        }

        return $dirPath;
    }
}
