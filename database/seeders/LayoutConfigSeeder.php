<?php
/**
 * LayoutConfigSeeder - Layout konfigürasyonlarını seed eder
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class LayoutConfigSeeder extends BaseSeeder
{
    /**
     * Tablo adı
     */
    protected function getTableName(): string
    {
        return 'layout_configs';
    }

    /**
     * Veri dosyası adı
     */
    protected function getDataFileName(): string
    {
        return 'layout_config.json';
    }

    /**
     * Seed işlemini çalıştır
     */
    public function run(): bool
    {
        $this->log("\n🎨 LayoutConfigSeeder çalışıyor...");

        // Shared veri dosyasını yükle
        $jsonData = $this->loadSharedData($this->getDataFileName());
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Layout config verisi bulunamadı veya boş");
            return false;
        }

        $configs = $jsonData['data'];
        $this->log("   Layout config sayısı: " . count($configs));

        foreach ($configs as $config) {
            // config objesini JSON string'e çevir
            if (isset($config['config']) && is_array($config['config'])) {
                $configData = $config['config'];
                unset($config['config']);
                $config['config'] = json_encode($configData, JSON_UNESCAPED_UNICODE);
            }

            // scope_id ayarla
            if ($config['scope'] === 'default') {
                $config['scope_id'] = null;
            } elseif ($config['scope'] === 'company' && $this->companyId) {
                $config['scope_id'] = $this->companyId;
            }

            $this->upsertLayoutConfig($config);
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    /**
     * Layout config için özel upsert
     * scope + scope_id üzerinden benzersizlik
     */
    protected function upsertLayoutConfig(array $data): bool
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

        // Dry-run modunda
        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would upsert: " . ($data['key'] ?? 'unknown'));
            $this->stats['created']++;
            return true;
        }

        try {
            // Mevcut kayıt var mı kontrol et (scope + scope_id)
            $whereClause = "scope = ?";
            $whereParams = [$data['scope']];

            if ($data['scope_id'] === null) {
                $whereClause .= " AND scope_id IS NULL";
            } else {
                $whereClause .= " AND scope_id = ?";
                $whereParams[] = $data['scope_id'];
            }

            $existing = $this->db->fetch(
                "SELECT id FROM {$table} WHERE {$whereClause}",
                $whereParams
            );

            // is_demo ve is_default alanlarını kaldır (tablo şemasında yok)
            unset($data['is_demo'], $data['is_default'], $data['key']);

            if ($existing) {
                // Güncelle
                $data['updated_at'] = date('Y-m-d H:i:s');
                $this->db->update($table, $data, 'id = ?', [$existing['id']]);
                $this->stats['updated']++;
                $this->log("  ↻ Güncellendi: " . $data['scope']);
            } else {
                // Yeni ekle
                $data['id'] = $this->generateUuid();
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['updated_at'] = date('Y-m-d H:i:s');

                $this->db->insert($table, $data);
                $this->stats['created']++;
                $this->log("  ✓ Eklendi: " . $data['scope']);
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Kayıt hatası: " . $e->getMessage());
            return false;
        }
    }
}
