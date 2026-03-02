<?php
/**
 * ProductSeeder - Ürün verilerini seed eder
 *
 * Demo ürünleri JSON dosyasından okuyarak veritabanına ekler.
 * Kategori ve üretim tipi ilişkilerini name bazlı kurar.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class ProductSeeder extends BaseSeeder
{
    /** @var int Batch size for bulk insert */
    private $batchSize = 100;

    /**
     * @inheritDoc
     */
    protected function getTableName(): string
    {
        return 'products';
    }

    /**
     * @inheritDoc
     */
    protected function getDataFileName(): string
    {
        return 'products.json';
    }

    /**
     * @inheritDoc
     */
    public function run(): bool
    {
        $this->log("=== ProductSeeder başlatılıyor ({$this->locale}) ===");

        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Ürün verisi yüklenemedi veya boş");
            return false;
        }

        $products = $jsonData['data'];
        $total = count($products);
        $this->log("  {$this->locale} dilinde {$total} ürün bulundu");

        // Batch işleme
        $batches = array_chunk($products, $this->batchSize);
        $batchNum = 0;

        foreach ($batches as $batch) {
            $batchNum++;
            $this->log("  Batch {$batchNum}/" . count($batches) . " işleniyor...");

            foreach ($batch as $product) {
                $this->seedProduct($product);
            }
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    /**
     * Tek bir ürünü seed eder
     *
     * @param array $product
     * @return bool
     */
    private function seedProduct(array $product): bool
    {
        // Demo/Default filtreleme
        if ($this->demoOnly && empty($product['is_demo'])) {
            $this->stats['skipped']++;
            return true;
        }
        if ($this->defaultOnly && empty($product['is_default'])) {
            $this->stats['skipped']++;
            return true;
        }

        // Veri hazırla
        $data = [
            'sku' => $product['sku'],
            'barcode' => $product['barcode'] ?? null,
            'name' => $product['name'],
            'slug' => $product['slug'] ?? $this->slugify($product['name']),
            'description' => $product['description'] ?? null,
            'category' => $product['category'] ?? null,
            'subcategory' => $product['subcategory'] ?? null,
            'group' => $product['group'] ?? null,
            'origin' => $product['origin'] ?? 'Türkiye',
            'production_type' => $product['production_type'] ?? 'Konvansiyonel',
            'unit' => $product['unit'] ?? 'kg',
            'current_price' => $product['current_price'] ?? 0,
            'previous_price' => $product['previous_price'] ?? null,
            'vat_rate' => $product['vat_rate'] ?? 10,
            'kunye_no' => $product['kunye_no'] ?? null,
            'is_demo' => $product['is_demo'] ?? false,
            'status' => $product['status'] ?? 'active'
        ];

        if ($this->companyId) {
            $data['company_id'] = $this->companyId;
        }

        // Dry-run modunda
        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would seed: {$data['name']} ({$data['sku']})");
            $this->stats['created']++;
            return true;
        }

        try {
            // Mevcut kayıt var mı kontrol et (sku + company_id bazlı)
            $whereClause = "sku = ?";
            $whereParams = [$data['sku']];

            if ($this->companyId) {
                $whereClause .= " AND company_id = ?";
                $whereParams[] = $this->companyId;
            }

            $existing = $this->db->fetch(
                "SELECT id FROM products WHERE {$whereClause}",
                $whereParams
            );

            if ($existing) {
                // Güncelle
                $data['updated_at'] = date('Y-m-d H:i:s');
                $data = $this->filterDataForTable($data, 'products');
                $this->db->update('products', $data, "id = ?", [$existing['id']]);
                $this->stats['updated']++;

                if ($this->verbose) {
                    $this->log("  ↻ Güncellendi: {$data['name']}");
                }
            } else {
                // Yeni ekle
                $data['id'] = $this->generateUuid();
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['updated_at'] = date('Y-m-d H:i:s');

                if ($this->createdBy) {
                    $data['created_by'] = $this->createdBy;
                }
                $data = $this->filterDataForTable($data, 'products');

                $this->db->insert('products', $data);
                $this->stats['created']++;

                if ($this->verbose) {
                    $this->log("  ✓ Eklendi: {$data['name']}");
                }
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Ürün kayıt hatası ({$data['sku']}): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Batch size ayarlar
     *
     * @param int $size
     * @return self
     */
    public function setBatchSize(int $size): self
    {
        $this->batchSize = max(1, $size);
        return $this;
    }
}
