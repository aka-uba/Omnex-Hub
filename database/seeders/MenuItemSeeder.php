<?php
/**
 * MenuItemSeeder - Menü öğelerini seed eder
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class MenuItemSeeder extends BaseSeeder
{
    /**
     * Tablo adı
     */
    protected function getTableName(): string
    {
        return 'menu_items';
    }

    /**
     * Veri dosyası adı
     */
    protected function getDataFileName(): string
    {
        return 'menu_items.json';
    }

    /**
     * Seed işlemini çalıştır
     */
    public function run(): bool
    {
        $this->log("\n📜 MenuItemSeeder çalışıyor...");

        // Shared veri dosyasını yükle (dil bağımsız - i18n key kullanıyor)
        $jsonData = $this->loadSharedData($this->getDataFileName());
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Menü öğesi verisi bulunamadı veya boş");
            return false;
        }

        $menuItems = $jsonData['data'];
        $this->log("   Menü öğesi sayısı: " . count($menuItems));

        foreach ($menuItems as $item) {
            // roles dizisini JSON string'e çevir
            if (isset($item['roles']) && is_array($item['roles'])) {
                $item['roles'] = json_encode($item['roles']);
            }

            // label_key'i label olarak kullan (i18n için)
            if (isset($item['label_key'])) {
                $item['label'] = json_encode([
                    'tr' => $item['label_key'],
                    'en' => $item['label_key']
                ]);
                unset($item['label_key']);
            }

            // visible default 1
            if (!isset($item['visible'])) {
                $item['visible'] = 1;
            }

            $this->upsert($item, 'key');
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }
}
