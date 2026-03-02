<?php
/**
 * CategorySeeder - Kategori verilerini seed eder
 *
 * Hiyerarşik kategori yapısını destekler (parent_key ile).
 * Önce parent kategoriler, sonra child kategoriler eklenir.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

require_once __DIR__ . '/BaseSeeder.php';

class CategorySeeder extends BaseSeeder
{
    /** @var array Parent key -> ID mapping */
    private $keyToIdMap = [];

    /**
     * @inheritDoc
     */
    protected function getTableName(): string
    {
        return 'categories';
    }

    /**
     * @inheritDoc
     */
    protected function getDataFileName(): string
    {
        return 'categories.json';
    }

    /**
     * @inheritDoc
     */
    public function run(): bool
    {
        $this->log("=== CategorySeeder başlatılıyor ({$this->locale}) ===");

        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError("Kategori verisi yüklenemedi veya boş");
            return false;
        }

        $categories = $jsonData['data'];
        $this->log("  {$this->locale} dilinde " . count($categories) . " kategori bulundu");

        // Önce mevcut key->id mapping'i yükle
        $this->loadExistingKeyMap();

        // Parent kategorileri önce ekle (parent_key = null olanlar)
        $parents = array_filter($categories, fn($c) => empty($c['parent_key']));
        $children = array_filter($categories, fn($c) => !empty($c['parent_key']));

        $this->log("  Parent kategoriler: " . count($parents));
        $this->log("  Child kategoriler: " . count($children));

        // Parent kategorileri ekle
        foreach ($parents as $category) {
            $this->seedCategory($category);
        }

        // Child kategorileri ekle
        foreach ($children as $category) {
            $this->seedCategory($category);
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    /**
     * Mevcut key->id mapping'i yükler
     */
    private function loadExistingKeyMap(): void
    {
        $table = $this->getTableName();
        $whereClause = "1=1";
        $params = [];

        if ($this->companyId) {
            $whereClause = "company_id = ?";
            $params[] = $this->companyId;
        }

        $existing = $this->db->fetchAll(
            "SELECT id, name, slug FROM {$table} WHERE {$whereClause}",
            $params
        );

        foreach ($existing as $row) {
            // name ve slug bazlı key oluştur
            $key = 'demo.category.' . $this->slugify($row['name']);
            $this->keyToIdMap[$key] = $row['id'];

            // Slug bazlı da ekle
            $slugKey = 'demo.category.' . $row['slug'];
            $this->keyToIdMap[$slugKey] = $row['id'];
        }
    }

    /**
     * Tek bir kategoriyi seed eder
     *
     * @param array $category
     * @return bool
     */
    private function seedCategory(array $category): bool
    {
        // Demo/Default filtreleme
        if ($this->demoOnly && empty($category['is_demo'])) {
            $this->stats['skipped']++;
            return true;
        }
        if ($this->defaultOnly && empty($category['is_default'])) {
            $this->stats['skipped']++;
            return true;
        }

        // Parent ID'yi bul
        $parentId = null;
        if (!empty($category['parent_key'])) {
            $parentId = $this->keyToIdMap[$category['parent_key']] ?? null;
            if (!$parentId) {
                $this->logError("Parent bulunamadı: {$category['parent_key']} (kategori: {$category['name']})");
                // Parent olmasa da devam et, belki sonra eklenecek
            }
        }

        // Veri hazırla
        $data = [
            'name' => $category['name'],
            'slug' => $category['slug'] ?? $this->slugify($category['name']),
            'parent_id' => $parentId,
            'sort_order' => $category['sort_order'] ?? 0,
            'is_demo' => $category['is_demo'] ?? false,
            'status' => $category['status'] ?? 'active'
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
                "SELECT id FROM categories WHERE {$whereClause}",
                $whereParams
            );

            if ($existing) {
                // Güncelle
                $data['updated_at'] = date('Y-m-d H:i:s');
                $this->db->update('categories', $data, "id = ?", [$existing['id']]);
                $this->stats['updated']++;
                $this->log("  ↻ Güncellendi: {$data['name']}");

                // Key map'e ekle
                $this->keyToIdMap[$category['key']] = $existing['id'];
            } else {
                // Yeni ekle
                $data['id'] = $this->generateUuid();
                $data['created_at'] = date('Y-m-d H:i:s');
                $data['updated_at'] = date('Y-m-d H:i:s');

                $this->db->insert('categories', $data);
                $this->stats['created']++;
                $this->log("  ✓ Eklendi: {$data['name']}");

                // Key map'e ekle
                $this->keyToIdMap[$category['key']] = $data['id'];
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Kategori kayıt hatası ({$data['name']}): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Key'e göre kategori ID'sini döndürür
     *
     * @param string $key
     * @return string|null
     */
    public function getIdByKey(string $key): ?string
    {
        return $this->keyToIdMap[$key] ?? null;
    }

    /**
     * Tüm key->id mapping'i döndürür
     *
     * @return array
     */
    public function getKeyMap(): array
    {
        return $this->keyToIdMap;
    }
}
