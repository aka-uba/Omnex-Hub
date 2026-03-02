<?php
/**
 * BaseSeeder - Tüm seeder sınıfları için temel sınıf
 *
 * Universal seeder sistemi için abstract base class.
 * Tüm seeder'lar bu sınıftan türetilir.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/../../config.php';

abstract class BaseSeeder
{
    /** @var Database */
    protected $db;

    /** @var string Dil kodu (tr, en, ru, az, de, nl, fr) */
    protected $locale = 'tr';

    /** @var string Firma ID */
    protected $companyId;

    /** @var string Kullanıcı ID (oluşturan) */
    protected $createdBy;

    /** @var bool Sadece demo verileri mi */
    protected $demoOnly = false;

    /** @var bool Sadece varsayılan verileri mi */
    protected $defaultOnly = false;

    /** @var bool Dry-run modu (veritabanına yazmaz) */
    protected $dryRun = false;

    /** @var bool Verbose çıktı */
    protected $verbose = false;

    /** @var array İstatistikler */
    protected $stats = [
        'created' => 0,
        'updated' => 0,
        'skipped' => 0,
        'errors' => 0
    ];

    /** @var array Hatalar */
    protected $errors = [];

    /** @var array<string, array<string, bool>> Tablo kolon cache */
    protected array $tableColumns = [];

    /** @var string Veri dizini */
    protected $dataPath;

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->dataPath = __DIR__ . '/data';
    }

    /**
     * Ana seed metodu - Alt sınıflarda override edilmeli
     *
     * @return bool
     */
    abstract public function run(): bool;

    /**
     * Tablo adını döndürür - Alt sınıflarda override edilmeli
     *
     * @return string
     */
    abstract protected function getTableName(): string;

    /**
     * Veri dosyasının adını döndürür - Alt sınıflarda override edilmeli
     *
     * @return string
     */
    abstract protected function getDataFileName(): string;

    /**
     * Dil kodunu ayarlar
     *
     * @param string $locale
     * @return self
     */
    public function setLocale(string $locale): self
    {
        $validLocales = ['tr', 'en', 'ru', 'az', 'de', 'nl', 'fr'];
        if (in_array($locale, $validLocales)) {
            $this->locale = $locale;
        }
        return $this;
    }

    /**
     * Firma ID'sini ayarlar
     *
     * @param string $companyId
     * @return self
     */
    public function setCompanyId(string $companyId): self
    {
        $this->companyId = $companyId;
        return $this;
    }

    /**
     * Oluşturan kullanıcı ID'sini ayarlar
     *
     * @param string $userId
     * @return self
     */
    public function setCreatedBy(string $userId): self
    {
        $this->createdBy = $userId;
        return $this;
    }

    /**
     * Demo-only modunu ayarlar
     *
     * @param bool $demoOnly
     * @return self
     */
    public function setDemoOnly(bool $demoOnly): self
    {
        $this->demoOnly = $demoOnly;
        return $this;
    }

    /**
     * Default-only modunu ayarlar
     *
     * @param bool $defaultOnly
     * @return self
     */
    public function setDefaultOnly(bool $defaultOnly): self
    {
        $this->defaultOnly = $defaultOnly;
        return $this;
    }

    /**
     * Dry-run modunu ayarlar
     *
     * @param bool $dryRun
     * @return self
     */
    public function setDryRun(bool $dryRun): self
    {
        $this->dryRun = $dryRun;
        return $this;
    }

    /**
     * Verbose modunu ayarlar
     *
     * @param bool $verbose
     * @return self
     */
    public function setVerbose(bool $verbose): self
    {
        $this->verbose = $verbose;
        return $this;
    }

    /**
     * JSON veri dosyasını yükler
     *
     * @param string|null $fileName Dosya adı (null ise getDataFileName() kullanılır)
     * @param bool $localeSpecific Dil-spesifik dosya mı
     * @return array|null
     */
    protected function loadJsonData(?string $fileName = null, bool $localeSpecific = true): ?array
    {
        $fileName = $fileName ?? $this->getDataFileName();

        if ($localeSpecific) {
            $filePath = "{$this->dataPath}/{$this->locale}/{$fileName}";
        } else {
            $filePath = "{$this->dataPath}/shared/{$fileName}";
        }

        if (!file_exists($filePath)) {
            $this->logError("Veri dosyası bulunamadı: {$filePath}");
            return null;
        }

        $content = file_get_contents($filePath);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logError("JSON parse hatası ({$filePath}): " . json_last_error_msg());
            return null;
        }

        return $data;
    }

    /**
     * Shared (dil-bağımsız) veri dosyasını yükler
     *
     * @param string $fileName
     * @return array|null
     */
    protected function loadSharedData(string $fileName): ?array
    {
        return $this->loadJsonData($fileName, false);
    }

    /**
     * Tablo kolonlarını bool-map olarak döndürür.
     *
     * @param string $table
     * @return array<string, bool>
     */
    protected function getTableColumnsMap(string $table): array
    {
        if (!isset($this->tableColumns[$table])) {
            $columns = $this->db->getTableColumns($table);
            $map = [];
            foreach ($columns as $column) {
                $map[(string)$column] = true;
            }
            $this->tableColumns[$table] = $map;
        }

        return $this->tableColumns[$table];
    }

    /**
     * Veriyi tabloda olmayan kolonlardan temizler.
     *
     * @param array $data
     * @param string|null $table
     * @return array
     */
    protected function filterDataForTable(array $data, ?string $table = null): array
    {
        $table = $table ?? $this->getTableName();
        $columnsMap = $this->getTableColumnsMap($table);

        if (empty($columnsMap)) {
            return $data;
        }

        return array_intersect_key($data, $columnsMap);
    }

    /**
     * Driver'a uygun true literal üretir.
     */
    protected function trueLiteral(): string
    {
        return $this->db->isPostgres() ? 'TRUE' : '1';
    }

    /**
     * Kayıt ekler veya günceller
     *
     * @param array $data Kayıt verileri
     * @param string $uniqueKey Benzersiz anahtar alanı (key, sku, slug vb.)
     * @return bool
     */
    protected function upsert(array $data, string $uniqueKey = 'key'): bool
    {
        $table = $this->getTableName();

        // Demo/Default filtreleme
        if ($this->demoOnly && empty($data['is_demo'])) {
            $this->stats['skipped']++;
            return true;
        }
        if ($this->defaultOnly && empty($data['is_default'])) {
            $this->stats['skipped']++;
            return true;
        }

        // Company ID ekle
        if ($this->companyId && !isset($data['company_id'])) {
            $data['company_id'] = $this->companyId;
        }

        // Dry-run modunda sadece logla
        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would upsert: " . ($data[$uniqueKey] ?? 'unknown'));
            $this->stats['created']++;
            return true;
        }

        try {
            // Mevcut kayıt var mı kontrol et
            $whereClause = "{$uniqueKey} = ?";
            $whereParams = [$data[$uniqueKey]];

            // Company bazlı kontrol
            if ($this->companyId && isset($data['company_id'])) {
                $whereClause .= " AND company_id = ?";
                $whereParams[] = $this->companyId;
            }

            $existing = $this->db->fetch(
                "SELECT id FROM {$table} WHERE {$whereClause}",
                $whereParams
            );

            if ($existing) {
                // Güncelle
                $data['updated_at'] = date('Y-m-d H:i:s');
                unset($data['id']); // ID güncellenmesin
                unset($data['created_at']); // created_at korunsun
                $data = $this->filterDataForTable($data, $table);

                $this->db->update($table, $data, "{$uniqueKey} = ?", [$data[$uniqueKey]]);
                $this->stats['updated']++;
                $this->log("  ↻ Güncellendi: " . ($data['name'] ?? $data[$uniqueKey]));
            } else {
                // Yeni ekle
                if (!isset($data['id'])) {
                    $data['id'] = $this->db->generateUuid();
                }
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['updated_at'] = date('Y-m-d H:i:s');

                if ($this->createdBy && !isset($data['created_by'])) {
                    $data['created_by'] = $this->createdBy;
                }
                $data = $this->filterDataForTable($data, $table);

                $this->db->insert($table, $data);
                $this->stats['created']++;
                $this->log("  ✓ Eklendi: " . ($data['name'] ?? $data[$uniqueKey]));
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Kayıt hatası (" . ($data[$uniqueKey] ?? 'unknown') . "): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Toplu kayıt ekler
     *
     * @param array $records
     * @param string $uniqueKey
     * @return int Başarılı kayıt sayısı
     */
    protected function bulkUpsert(array $records, string $uniqueKey = 'key'): int
    {
        $success = 0;
        foreach ($records as $record) {
            if ($this->upsert($record, $uniqueKey)) {
                $success++;
            }
        }
        return $success;
    }

    /**
     * Demo verilerini temizler
     *
     * @return int Silinen kayıt sayısı
     */
    public function clearDemoData(): int
    {
        $table = $this->getTableName();
        $demoCondition = "is_demo = " . $this->trueLiteral();

        if ($this->dryRun) {
            $count = $this->db->fetch(
                "SELECT COUNT(*) as cnt FROM {$table} WHERE {$demoCondition} AND company_id = ?",
                [$this->companyId]
            );
            $this->log("[DRY-RUN] Would delete {$count['cnt']} demo records from {$table}");
            return $count['cnt'] ?? 0;
        }

        $whereClause = $demoCondition;
        $params = [];

        if ($this->companyId) {
            $whereClause .= " AND company_id = ?";
            $params[] = $this->companyId;
        }

        $count = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM {$table} WHERE {$whereClause}",
            $params
        );

        $this->db->delete($table, $whereClause, $params);
        $deleted = $count['cnt'] ?? 0;

        $this->log("✗ {$deleted} demo kaydı silindi ({$table})");
        return $deleted;
    }

    /**
     * Tüm verileri temizler (dikkatli kullan!)
     *
     * @return int Silinen kayıt sayısı
     */
    public function clearAllData(): int
    {
        $table = $this->getTableName();

        if ($this->dryRun) {
            $count = $this->db->fetch(
                "SELECT COUNT(*) as cnt FROM {$table} WHERE company_id = ?",
                [$this->companyId]
            );
            $this->log("[DRY-RUN] Would delete ALL {$count['cnt']} records from {$table}");
            return $count['cnt'] ?? 0;
        }

        $whereClause = "1=1";
        $params = [];

        if ($this->companyId) {
            $whereClause = "company_id = ?";
            $params[] = $this->companyId;
        }

        $count = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM {$table} WHERE {$whereClause}",
            $params
        );

        $this->db->delete($table, $whereClause, $params);
        $deleted = $count['cnt'] ?? 0;

        $this->log("✗ TÜM {$deleted} kayıt silindi ({$table})");
        return $deleted;
    }

    /**
     * İstatistikleri döndürür
     *
     * @return array
     */
    public function getStats(): array
    {
        return $this->stats;
    }

    /**
     * Hataları döndürür
     *
     * @return array
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * İstatistikleri sıfırlar
     *
     * @return self
     */
    public function resetStats(): self
    {
        $this->stats = [
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => 0
        ];
        $this->errors = [];
        return $this;
    }

    /**
     * Log mesajı yazar (verbose modda)
     *
     * @param string $message
     */
    protected function log(string $message): void
    {
        if ($this->verbose) {
            echo $message . "\n";
        }
    }

    /**
     * Hata loglar
     *
     * @param string $message
     */
    protected function logError(string $message): void
    {
        $this->errors[] = $message;
        if ($this->verbose) {
            echo "  [HATA] {$message}\n";
        }
    }

    /**
     * Özet raporu yazdırır
     */
    public function printSummary(): void
    {
        if (!$this->verbose) {
            return;
        }

        $table = $this->getTableName();
        echo "\n=== {$table} Seed Özeti ===\n";
        echo "  Eklenen:    {$this->stats['created']}\n";
        echo "  Güncellenen: {$this->stats['updated']}\n";
        echo "  Atlanan:    {$this->stats['skipped']}\n";
        echo "  Hata:       {$this->stats['errors']}\n";

        if (!empty($this->errors)) {
            echo "\n  Hatalar:\n";
            foreach ($this->errors as $error) {
                echo "    - {$error}\n";
            }
        }
        echo "\n";
    }

    /**
     * Türkçe karakterleri slug'a dönüştürür
     *
     * @param string $text
     * @return string
     */
    protected function slugify(string $text): string
    {
        $text = trim($text);
        $text = mb_strtolower($text, 'UTF-8');

        // Türkçe karakter dönüşümleri
        $tr = ['ş', 'ı', 'ğ', 'ü', 'ö', 'ç', 'Ş', 'İ', 'Ğ', 'Ü', 'Ö', 'Ç', ' '];
        $en = ['s', 'i', 'g', 'u', 'o', 'c', 's', 'i', 'g', 'u', 'o', 'c', '-'];
        $text = str_replace($tr, $en, $text);

        // Alfanumerik olmayan karakterleri tire ile değiştir
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);

        // Başta ve sonda tireleri kaldır
        $text = trim($text, '-');

        // Birden fazla tireyi tek tireye dönüştür
        $text = preg_replace('/-+/', '-', $text);

        return $text;
    }

    /**
     * UUID oluşturur
     *
     * @return string
     */
    protected function generateUuid(): string
    {
        return $this->db->generateUuid();
    }
}
