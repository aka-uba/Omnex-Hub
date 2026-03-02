<?php
/**
 * ProductionTypeSeeder - Üretim tipi verilerini seed eder
 *
 * Konvansiyonel, Organik, Naturel, Geleneksel gibi üretim tiplerini ekler.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class ProductionTypeSeeder extends BaseSeeder
{
    /**
     * @inheritDoc
     */
    protected function getTableName(): string
    {
        return 'production_types';
    }

    /**
     * @inheritDoc
     */
    protected function getDataFileName(): string
    {
        return 'production_types.json';
    }

    /**
     * @inheritDoc
     */
    public function run(): bool
    {
        $this->log("=== ProductionTypeSeeder başlatılıyor ({$this->locale}) ===");

        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Üretim tipi verisi yüklenemedi veya boş");
            return false;
        }

        $types = $jsonData['data'];
        $this->log("  {$this->locale} dilinde " . count($types) . " üretim tipi bulundu");

        foreach ($types as $type) {
            $this->seedProductionType($type);
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    /**
     * Tek bir üretim tipini seed eder
     *
     * @param array $type
     * @return bool
     */
    private function seedProductionType(array $type): bool
    {
        // Demo/Default filtreleme
        if ($this->demoOnly && empty($type['is_demo'])) {
            $this->stats['skipped']++;
            return true;
        }
        if ($this->defaultOnly && empty($type['is_default'])) {
            $this->stats['skipped']++;
            return true;
        }

        // Veri hazırla
        $data = [
            'name' => $type['name'],
            'slug' => $type['slug'] ?? $this->slugify($type['name']),
            'color' => $type['color'] ?? '#9E9E9E',
            'description' => $type['description'] ?? null,
            'sort_order' => $type['sort_order'] ?? 0,
            'is_demo' => $type['is_demo'] ?? false,
            'status' => $type['status'] ?? 'active'
        ];

        if ($this->companyId) {
            $data['company_id'] = $this->companyId;
        }

        // Dry-run modunda
        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would seed: {$data['name']}");
            $this->stats['created']++;
            return true;
        }

        try {
            // Mevcut kayıt var mı kontrol et (name + company_id bazlı)
            $whereClause = "name = ?";
            $whereParams = [$data['name']];

            if ($this->companyId) {
                $whereClause .= " AND company_id = ?";
                $whereParams[] = $this->companyId;
            }

            $existing = $this->db->fetch(
                "SELECT id FROM production_types WHERE {$whereClause}",
                $whereParams
            );

            if ($existing) {
                // Güncelle
                $data['updated_at'] = date('Y-m-d H:i:s');
                $this->db->update('production_types', $data, "id = ?", [$existing['id']]);
                $this->stats['updated']++;
                $this->log("  ↻ Güncellendi: {$data['name']}");
            } else {
                // Yeni ekle
                $data['id'] = $this->generateUuid();
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['updated_at'] = date('Y-m-d H:i:s');

                $this->db->insert('production_types', $data);
                $this->stats['created']++;
                $this->log("  ✓ Eklendi: {$data['name']}");
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Üretim tipi kayıt hatası ({$data['name']}): " . $e->getMessage());
            return false;
        }
    }
}
