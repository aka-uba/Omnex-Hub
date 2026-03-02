<?php
/**
 * TemplateSeeder - Şablon verilerini seed eder
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class TemplateSeeder extends BaseSeeder
{
    /**
     * Tablo adı
     */
    protected function getTableName(): string
    {
        return 'templates';
    }

    /**
     * Veri dosyası adı
     */
    protected function getDataFileName(): string
    {
        return 'templates.json';
    }

    /**
     * Seed işlemini çalıştır
     */
    public function run(): bool
    {
        $this->log("\n📋 TemplateSeeder çalışıyor...");
        $this->log("   Dil: {$this->locale}");

        // JSON verisini yükle
        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Şablon verisi bulunamadı veya boş");
            return false;
        }

        $templates = $jsonData['data'];
        $this->log("   Şablon sayısı: " . count($templates));

        foreach ($templates as $template) {
            // design_data'yı JSON string'e çevir
            if (isset($template['design_data']) && is_array($template['design_data'])) {
                $template['design_data'] = json_encode($template['design_data'], JSON_UNESCAPED_UNICODE);
            }

            // Upsert için hazırla
            $this->upsert($template, 'key');
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }
}
