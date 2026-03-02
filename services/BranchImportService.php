<?php
/**
 * BranchImportService - Şube bazlı import servisi
 *
 * Şube fiyat, stok, kampanya import işlemleri
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/BranchService.php';
require_once __DIR__ . '/ProductPriceResolver.php';

class BranchImportService
{
    const MODE_OVERWRITE = 'overwrite';
    const MODE_SKIP_IF_MANUAL = 'skip_if_manual';
    const MODE_MERGE = 'merge';

    const TYPE_PRICE = 'price';
    const TYPE_STOCK = 'stock';
    const TYPE_CAMPAIGN = 'campaign';
    const TYPE_FULL = 'full';

    private $db;
    private $companyId;
    private $userId;
    private $logId;

    public function __construct(string $companyId, ?string $userId = null)
    {
        $this->db = Database::getInstance();
        $this->companyId = $companyId;
        $this->userId = $userId;
    }

    /**
     * Import işlemi başlat
     */
    public function import(
        array $data,
        string $mode = self::MODE_SKIP_IF_MANUAL,
        string $importType = self::TYPE_PRICE,
        ?string $targetBranchId = null,
        ?string $sourceName = null
    ): array {
        // Log kaydı oluştur
        $this->logId = $this->createImportLog($importType, $mode, $sourceName, $targetBranchId);

        $this->updateLogStatus('processing');

        $results = [
            'total' => count($data),
            'processed' => 0,
            'inserted' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'changes' => [],
            'warnings' => [],
            'errors' => []
        ];

        foreach ($data as $index => $row) {
            $rowNum = $index + 1;

            try {
                $result = $this->processRow($row, $mode, $importType, $targetBranchId);

                $results['processed']++;

                switch ($result['action']) {
                    case 'inserted':
                        $results['inserted']++;
                        if (!empty($result['changes'])) {
                            $results['changes'][] = $result['changes'];
                        }
                        break;

                    case 'updated':
                        $results['updated']++;
                        if (!empty($result['changes'])) {
                            $results['changes'][] = $result['changes'];
                        }
                        break;

                    case 'skipped':
                        $results['skipped']++;
                        if (!empty($result['warning'])) {
                            $results['warnings'][] = [
                                'row' => $rowNum,
                                'sku' => $row['sku'] ?? '',
                                'branch' => $row['branch_code'] ?? '',
                                'warning' => $result['warning']
                            ];
                        }
                        break;
                }
            } catch (Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'row' => $rowNum,
                    'sku' => $row['sku'] ?? '',
                    'error' => $e->getMessage()
                ];
            }
        }

        // Log güncelle
        $this->finalizeLog($results);

        return [
            'success' => true,
            'import_log_id' => $this->logId,
            'summary' => [
                'total' => $results['total'],
                'processed' => $results['processed'],
                'inserted' => $results['inserted'],
                'updated' => $results['updated'],
                'skipped' => $results['skipped'],
                'failed' => $results['failed']
            ],
            'changes' => array_slice($results['changes'], 0, 100), // İlk 100 değişiklik
            'warnings' => $results['warnings'],
            'errors' => $results['errors']
        ];
    }

    /**
     * Tek satır işle
     */
    private function processRow(
        array $row,
        string $mode,
        string $importType,
        ?string $targetBranchId
    ): array {
        // SKU zorunlu
        if (empty($row['sku'])) {
            throw new Exception('SKU alanı boş');
        }

        // Ürünü bul
        $product = $this->db->fetch(
            "SELECT id FROM products WHERE company_id = ? AND sku = ?",
            [$this->companyId, $row['sku']]
        );

        if (!$product) {
            throw new Exception('Ürün bulunamadı: ' . $row['sku']);
        }

        // Şubeyi belirle
        $branchId = $targetBranchId;

        if (!$branchId && !empty($row['branch_code'])) {
            $branch = BranchService::findByCode($this->companyId, $row['branch_code']);
            if (!$branch) {
                throw new Exception('Şube bulunamadı: ' . $row['branch_code']);
            }
            $branchId = $branch['id'];
        }

        if (!$branchId) {
            throw new Exception('Şube belirtilmedi');
        }

        // Mevcut override'ı kontrol et
        $existing = $this->db->fetch(
            "SELECT * FROM product_branch_overrides
             WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$product['id'], $branchId]
        );

        // Mode kontrolü
        if ($existing && $mode === self::MODE_SKIP_IF_MANUAL && $existing['source'] === 'manual') {
            return [
                'action' => 'skipped',
                'warning' => 'Manuel override var, atlandı'
            ];
        }

        if ($existing && $mode === self::MODE_MERGE) {
            // Sadece boş alanları doldur
            $row = $this->mergeWithExisting($row, $existing, $importType);
        }

        // Değerleri hazırla
        $values = $this->prepareValues($row, $importType);

        if (empty($values)) {
            return ['action' => 'skipped', 'warning' => 'Güncellenecek değer yok'];
        }

        // Override oluştur/güncelle
        $result = ProductPriceResolver::setOverride(
            $product['id'],
            $branchId,
            $values,
            'import',
            $this->userId
        );

        // Değişiklik kaydı
        $changes = null;
        if ($result['success']) {
            $changes = [
                'sku' => $row['sku'],
                'branch' => $row['branch_code'] ?? $branchId,
                'fields' => array_keys($values)
            ];

            if ($existing && isset($values['current_price'])) {
                $changes['old_price'] = $existing['current_price'];
                $changes['new_price'] = $values['current_price'];
            }
        }

        return [
            'action' => $result['action'],
            'changes' => $changes
        ];
    }

    /**
     * Mevcut override ile birleştir (merge modu)
     */
    private function mergeWithExisting(array $row, array $existing, string $importType): array
    {
        $fields = $this->getFieldsForType($importType);

        foreach ($fields as $field => $rowKey) {
            // Mevcut değer varsa import değerini atla
            if (!empty($existing[$field])) {
                unset($row[$rowKey]);
            }
        }

        return $row;
    }

    /**
     * Import tipine göre değerleri hazırla
     */
    private function prepareValues(array $row, string $importType): array
    {
        $values = [];
        $fields = $this->getFieldsForType($importType);

        foreach ($fields as $dbField => $rowKey) {
            if (isset($row[$rowKey]) && $row[$rowKey] !== '') {
                $value = $row[$rowKey];

                // Sayısal alanları dönüştür
                if (in_array($dbField, ['current_price', 'previous_price', 'discount_percent', 'discount_amount'])) {
                    $value = floatval(str_replace(',', '.', $value));
                } elseif (in_array($dbField, ['stock_quantity', 'min_stock_level', 'max_stock_level', 'reorder_point'])) {
                    $value = intval($value);
                }

                $values[$dbField] = $value;
            }
        }

        // Fiyat güncelleme tarihi
        if (isset($values['current_price'])) {
            $values['price_updated_at'] = date('Y-m-d H:i:s');
        }

        return $values;
    }

    /**
     * Import tipine göre alan eşleştirmesi
     */
    private function getFieldsForType(string $importType): array
    {
        $priceFields = [
            'current_price' => 'price',
            'previous_price' => 'previous_price',
            'price_valid_until' => 'price_valid_until'
        ];

        $campaignFields = [
            'discount_percent' => 'discount_percent',
            'discount_amount' => 'discount_amount',
            'campaign_text' => 'campaign_text',
            'campaign_start' => 'campaign_start',
            'campaign_end' => 'campaign_end'
        ];

        $stockFields = [
            'stock_quantity' => 'stock',
            'min_stock_level' => 'min_stock',
            'max_stock_level' => 'max_stock',
            'shelf_location' => 'shelf_location',
            'aisle' => 'aisle',
            'shelf_number' => 'shelf_number'
        ];

        $complianceFields = [
            'kunye_no' => 'kunye_no'
        ];

        switch ($importType) {
            case self::TYPE_PRICE:
                return $priceFields;

            case self::TYPE_STOCK:
                return $stockFields;

            case self::TYPE_CAMPAIGN:
                return $campaignFields;

            case self::TYPE_FULL:
                return array_merge($priceFields, $campaignFields, $stockFields, $complianceFields);

            default:
                return $priceFields;
        }
    }

    /**
     * Import log oluştur
     */
    private function createImportLog(
        string $importType,
        string $mode,
        ?string $sourceName,
        ?string $branchId
    ): string {
        $id = $this->db->generateUuid();

        $this->db->insert('branch_import_logs', [
            'id' => $id,
            'company_id' => $this->companyId,
            'branch_id' => $branchId,
            'import_type' => $importType,
            'import_mode' => $mode,
            'source_type' => 'file',
            'source_name' => $sourceName,
            'status' => 'pending',
            'created_by' => $this->userId
        ]);

        return $id;
    }

    /**
     * Log durumunu güncelle
     */
    private function updateLogStatus(string $status): void
    {
        $data = ['status' => $status];

        if ($status === 'processing') {
            $data['started_at'] = date('Y-m-d H:i:s');
        }

        $this->db->update('branch_import_logs', $data, 'id = ?', [$this->logId]);
    }

    /**
     * Import log'u tamamla
     */
    private function finalizeLog(array $results): void
    {
        $status = 'completed';
        if ($results['failed'] > 0 && $results['processed'] > $results['failed']) {
            $status = 'completed_with_errors';
        } elseif ($results['failed'] > 0 && $results['processed'] === $results['failed']) {
            $status = 'failed';
        }

        $this->db->update('branch_import_logs', [
            'status' => $status,
            'total_rows' => $results['total'],
            'processed_rows' => $results['processed'],
            'inserted_rows' => $results['inserted'],
            'updated_rows' => $results['updated'],
            'skipped_rows' => $results['skipped'],
            'failed_rows' => $results['failed'],
            'changes_log' => json_encode($results['changes']),
            'errors_log' => json_encode($results['errors']),
            'warnings_log' => json_encode($results['warnings']),
            'completed_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$this->logId]);
    }

    /**
     * CSV/TXT dosyasını parse et
     */
    public static function parseFile(string $filePath, string $delimiter = ';'): array
    {
        $data = [];

        if (!file_exists($filePath)) {
            throw new Exception('Dosya bulunamadı');
        }

        $handle = fopen($filePath, 'r');
        if (!$handle) {
            throw new Exception('Dosya açılamadı');
        }

        // BOM kontrolü
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        // Header satırı
        $header = fgetcsv($handle, 0, $delimiter);
        if (!$header) {
            fclose($handle);
            throw new Exception('Header satırı okunamadı');
        }

        // Header'ı normalize et
        $header = array_map(function ($col) {
            return strtolower(trim(str_replace([' ', '-'], '_', $col)));
        }, $header);

        // Veri satırları
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            if (count($row) !== count($header)) continue;

            $item = [];
            foreach ($header as $i => $key) {
                $item[$key] = trim($row[$i] ?? '');
            }

            // SKU varsa ekle
            if (!empty($item['sku']) || !empty($item['stok_kodu']) || !empty($item['kod'])) {
                // Alan adı normalizasyonu
                $item['sku'] = $item['sku'] ?? $item['stok_kodu'] ?? $item['kod'] ?? '';
                $item['branch_code'] = $item['branch_code'] ?? $item['sube_kodu'] ?? $item['sube'] ?? '';
                $item['price'] = $item['price'] ?? $item['fiyat'] ?? $item['satis_fiyati'] ?? '';
                $item['previous_price'] = $item['previous_price'] ?? $item['onceki_fiyat'] ?? $item['eski_fiyat'] ?? '';
                $item['stock'] = $item['stock'] ?? $item['stok'] ?? $item['miktar'] ?? '';
                $item['discount_percent'] = $item['discount_percent'] ?? $item['indirim'] ?? $item['indirim_orani'] ?? '';
                $item['campaign_text'] = $item['campaign_text'] ?? $item['kampanya'] ?? $item['kampanya_adi'] ?? '';

                $data[] = $item;
            }
        }

        fclose($handle);

        return $data;
    }

    /**
     * Import geçmişini getir
     */
    public static function getImportHistory(string $companyId, int $limit = 20): array
    {
        $db = Database::getInstance();
        $createdByJoin = $db->isPostgres()
            ? 'LEFT JOIN users u ON CAST(bil.created_by AS TEXT) = CAST(u.id AS TEXT)'
            : 'LEFT JOIN users u ON bil.created_by = u.id';

        return $db->fetchAll(
            "SELECT bil.*, b.name as branch_name, b.code as branch_code,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM branch_import_logs bil
             LEFT JOIN branches b ON bil.branch_id = b.id
             $createdByJoin
             WHERE bil.company_id = ?
             ORDER BY bil.created_at DESC
             LIMIT ?",
            [$companyId, $limit]
        );
    }

    /**
     * Import detayını getir
     */
    public static function getImportDetail(string $logId): ?array
    {
        $db = Database::getInstance();
        $createdByJoin = $db->isPostgres()
            ? 'LEFT JOIN users u ON CAST(bil.created_by AS TEXT) = CAST(u.id AS TEXT)'
            : 'LEFT JOIN users u ON bil.created_by = u.id';

        $log = $db->fetch(
            "SELECT bil.*, b.name as branch_name, b.code as branch_code,
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM branch_import_logs bil
             LEFT JOIN branches b ON bil.branch_id = b.id
             $createdByJoin
             WHERE bil.id = ?",
            [$logId]
        );

        if ($log) {
            $log['changes_log'] = json_decode($log['changes_log'], true) ?? [];
            $log['errors_log'] = json_decode($log['errors_log'], true) ?? [];
            $log['warnings_log'] = json_decode($log['warnings_log'], true) ?? [];
        }

        return $log;
    }
}
