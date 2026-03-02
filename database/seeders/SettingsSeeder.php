<?php
/**
 * SettingsSeeder - Varsayılan ayarları seed eder
 *
 * Settings tablosu farklı bir yapıya sahip (data JSON alanı).
 * Bu seeder firma bazlı varsayılan ayarları oluşturur.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class SettingsSeeder extends BaseSeeder
{
    /**
     * Tablo adı
     */
    protected function getTableName(): string
    {
        return 'settings';
    }

    /**
     * Veri dosyası adı
     */
    protected function getDataFileName(): string
    {
        return 'settings.json';
    }

    /**
     * Seed işlemini çalıştır
     */
    public function run(): bool
    {
        $this->log("\n⚙️ SettingsSeeder çalışıyor...");
        $this->log("   Dil: {$this->locale}");

        // JSON verisini yükle
        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Ayar verisi bulunamadı veya boş");
            return false;
        }

        $settingsData = $jsonData['data'];
        $metadata = $jsonData['metadata'] ?? [];

        // Dry-run modunda
        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would create/update company settings");
            $this->stats['created']++;
            $this->printSummary();
            return true;
        }

        // Firma ID kontrolü
        if (empty($this->companyId)) {
            $this->logError("Firma ID gerekli");
            return false;
        }

        try {
            // Mevcut ayarları kontrol et
            $existing = $this->db->fetch(
                "SELECT id, data FROM settings WHERE company_id = ? AND user_id IS NULL",
                [$this->companyId]
            );

            if ($existing) {
                // Mevcut ayarları güncelle (mevcut değerleri koru, eksik olanları ekle)
                $existingData = json_decode($existing['data'], true) ?? [];
                $mergedData = array_replace_recursive($settingsData, $existingData);

                $this->db->update(
                    'settings',
                    [
                        'data' => json_encode($mergedData, JSON_UNESCAPED_UNICODE),
                        'updated_at' => date('Y-m-d H:i:s')
                    ],
                    'id = ?',
                    [$existing['id']]
                );
                $this->stats['updated']++;
                $this->log("  ↻ Güncellendi: Firma ayarları");
            } else {
                // Yeni ayarlar oluştur
                $this->db->insert('settings', [
                    'id' => $this->generateUuid(),
                    'company_id' => $this->companyId,
                    'user_id' => null,
                    'data' => json_encode($settingsData, JSON_UNESCAPED_UNICODE),
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                $this->stats['created']++;
                $this->log("  ✓ Eklendi: Firma ayarları");
            }

        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Ayar kaydetme hatası: " . $e->getMessage());
            return false;
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }
}
