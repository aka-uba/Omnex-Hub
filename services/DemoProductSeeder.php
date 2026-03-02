<?php
/**
 * DemoProductSeeder Service
 *
 * Yeni oluşturulan firmalar için demo ürün, kategori ve üretim tipi verilerini yükler.
 * JSON dosyalarından veri okur ve veritabanına idempotent şekilde ekler.
 *
 * @package Omnex Display Hub
 * @version 2.0.12
 */

class DemoProductSeeder
{
    private $db;
    private $companyId;
    private $locale;
    private $dataPath;

    /**
     * Constructor
     *
     * @param string $companyId The company ID to seed data for
     * @param string $locale Locale code (default: 'tr')
     */
    public function __construct(string $companyId, string $locale = 'tr')
    {
        $this->db = Database::getInstance();
        $this->companyId = $companyId;
        $this->locale = $locale;
        $this->dataPath = dirname(__DIR__) . '/database/seeders/data/' . $locale;
    }

    /**
     * Seed all demo data
     *
     * @return array Results summary
     */
    public function seedAll(): array
    {
        $results = [
            'categories' => $this->seedCategories(),
            'production_types' => $this->seedProductionTypes(),
            'products' => $this->seedProducts()
        ];

        // Log the seeding action
        if (class_exists('Logger')) {
            Logger::audit('seed_demo_data', 'company', [
                'company_id' => $this->companyId,
                'locale' => $this->locale,
                'results' => $results
            ]);
        }

        return $results;
    }

    /**
     * Load JSON data file
     *
     * @param string $filename JSON file name
     * @return array|null Parsed data or null on error
     */
    private function loadJsonFile(string $filename): ?array
    {
        $filePath = $this->dataPath . '/' . $filename;

        if (!file_exists($filePath)) {
            return null;
        }

        $content = file_get_contents($filePath);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }

        return $data;
    }

    /**
     * Seed demo categories with hierarchical parent_id support
     *
     * @return array ['created' => int, 'skipped' => int, 'errors' => int]
     */
    public function seedCategories(): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'errors' => 0];

        $jsonData = $this->loadJsonFile('categories.json');
        if (!$jsonData || empty($jsonData['data'])) {
            return $result;
        }

        // Build key to ID mapping for parent_key resolution
        $keyToIdMap = [];

        // First pass: Create all categories without parent_id
        foreach ($jsonData['data'] as $category) {
            try {
                // Check if category with same slug exists for this company
                $existing = $this->db->fetch(
                    "SELECT id FROM categories WHERE company_id = ? AND slug = ?",
                    [$this->companyId, $category['slug']]
                );

                if ($existing) {
                    // Store existing ID for parent resolution
                    if (!empty($category['key'])) {
                        $keyToIdMap[$category['key']] = $existing['id'];
                    }
                    $result['skipped']++;
                    continue;
                }

                // Generate color based on category name
                $color = $category['color'] ?? $this->generateCategoryColor($category['name']);

                $categoryId = $this->db->generateUuid();

                // Insert new category (without parent_id first)
                $this->db->insert('categories', [
                    'id' => $categoryId,
                    'company_id' => $this->companyId,
                    'name' => $category['name'],
                    'slug' => $category['slug'],
                    'color' => $color,
                    'parent_id' => null, // Will be updated in second pass
                    'sort_order' => $category['sort_order'] ?? 0,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);

                // Store key to ID mapping
                if (!empty($category['key'])) {
                    $keyToIdMap[$category['key']] = $categoryId;
                }

                $result['created']++;
            } catch (Exception $e) {
                $result['errors']++;
            }
        }

        // Second pass: Update parent_id for categories with parent_key
        foreach ($jsonData['data'] as $category) {
            if (empty($category['parent_key'])) {
                continue;
            }

            try {
                $parentId = $keyToIdMap[$category['parent_key']] ?? null;
                if (!$parentId) {
                    continue;
                }

                // Get category ID by slug
                $cat = $this->db->fetch(
                    "SELECT id FROM categories WHERE company_id = ? AND slug = ?",
                    [$this->companyId, $category['slug']]
                );

                if ($cat) {
                    $this->db->update('categories',
                        ['parent_id' => $parentId, 'updated_at' => date('Y-m-d H:i:s')],
                        'id = ?',
                        [$cat['id']]
                    );
                }
            } catch (Exception $e) {
                // Silently ignore parent update errors
            }
        }

        return $result;
    }

    /**
     * Seed demo production types
     *
     * @return array ['created' => int, 'skipped' => int, 'errors' => int]
     */
    public function seedProductionTypes(): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'errors' => 0];

        $jsonData = $this->loadJsonFile('production_types.json');
        if (!$jsonData || empty($jsonData['data'])) {
            return $result;
        }

        foreach ($jsonData['data'] as $type) {
            try {
                // Check if production type with same slug exists
                $existing = $this->db->fetch(
                    "SELECT id FROM production_types WHERE company_id = ? AND slug = ?",
                    [$this->companyId, $type['slug']]
                );

                if ($existing) {
                    $result['skipped']++;
                    continue;
                }

                // Insert new production type
                $this->db->insert('production_types', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'name' => $type['name'],
                    'slug' => $type['slug'],
                    'color' => $type['color'] ?? '#9E9E9E',
                    'description' => $type['description'] ?? null,
                    'sort_order' => $type['sort_order'] ?? 0,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);

                $result['created']++;
            } catch (Exception $e) {
                $result['errors']++;
            }
        }

        return $result;
    }

    /**
     * Seed demo products
     *
     * @param int $limit Maximum number of products to seed (0 = all)
     * @return array ['created' => int, 'skipped' => int, 'errors' => int]
     */
    public function seedProducts(int $limit = 0): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'errors' => 0];

        $jsonData = $this->loadJsonFile('products.json');
        if (!$jsonData || empty($jsonData['data'])) {
            return $result;
        }

        $products = $jsonData['data'];
        if ($limit > 0) {
            $products = array_slice($products, 0, $limit);
        }

        foreach ($products as $product) {
            try {
                // Check if product with same SKU exists for this company
                $existing = $this->db->fetch(
                    "SELECT id FROM products WHERE company_id = ? AND sku = ?",
                    [$this->companyId, $product['sku']]
                );

                if ($existing) {
                    $result['skipped']++;
                    continue;
                }

                // Insert new product
                // Note: JSON has group (parent), category, subcategory hierarchy
                $this->db->insert('products', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'sku' => $product['sku'],
                    'barcode' => $product['barcode'] ?? null,
                    'name' => $product['name'],
                    'slug' => $product['slug'] ?? $this->slugify($product['name']),
                    'group' => $product['group'] ?? null,           // Parent category (e.g., Manav, Kasap)
                    'category' => $product['category'] ?? null,      // Main category (e.g., Meyve, Sebze)
                    'subcategory' => $product['subcategory'] ?? null, // Sub category (e.g., Orman Meyvesi)
                    'origin' => $product['origin'] ?? null,
                    'unit' => $product['unit'] ?? 'adet',
                    'current_price' => $product['current_price'] ?? 0,
                    'vat_rate' => $product['vat_rate'] ?? 10,
                    'kunye_no' => $product['kunye_no'] ?? null,
                    'production_type' => $product['production_type'] ?? null,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);

                $result['created']++;
            } catch (Exception $e) {
                $result['errors']++;
            }
        }

        return $result;
    }

    /**
     * Seed only a subset of products (for quick demo setup)
     *
     * @param int $count Number of products to seed
     * @return array Results
     */
    public function seedQuickDemo(int $count = 50): array
    {
        return [
            'categories' => $this->seedCategories(),
            'production_types' => $this->seedProductionTypes(),
            'products' => $this->seedProducts($count)
        ];
    }

    /**
     * Delete all demo data for this company
     *
     * @return array ['products' => int, 'categories' => int, 'production_types' => int]
     */
    public function clearDemoData(): array
    {
        $result = ['products' => 0, 'categories' => 0, 'production_types' => 0];

        // Delete demo products (SKU starts with group prefixes)
        $demoSkuPrefixes = ['MNV-', 'BKL-', 'DNK-', 'BHR-', 'DND-', 'FRN-', 'KHV-', 'TTL-', 'CRZ-', 'ICK-', 'DNZ-', 'KSP-', 'SRK-'];
        foreach ($demoSkuPrefixes as $prefix) {
            $deleted = $this->db->query(
                "DELETE FROM products WHERE company_id = ? AND sku LIKE ?",
                [$this->companyId, $prefix . '%']
            );
            $result['products'] += $deleted->rowCount();
        }

        // Note: Categories and production types are not deleted by default
        // as they might be used by user-created products

        return $result;
    }

    /**
     * Check if demo data exists for this company
     *
     * @return array ['has_products' => bool, 'product_count' => int]
     */
    public function hasDemoData(): array
    {
        $count = $this->db->fetch(
            "SELECT COUNT(*) as count FROM products WHERE company_id = ? AND sku LIKE 'MNV-%'",
            [$this->companyId]
        );

        return [
            'has_products' => ($count['count'] ?? 0) > 0,
            'product_count' => $count['count'] ?? 0
        ];
    }

    /**
     * Generate a color for category based on name hash
     *
     * @param string $name Category name
     * @return string Hex color code
     */
    private function generateCategoryColor(string $name): string
    {
        $colors = [
            '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
            '#00BCD4', '#795548', '#E91E63', '#3F51B5', '#CDDC39',
            '#607D8B', '#009688', '#FF5722', '#673AB7', '#8BC34A'
        ];

        $hash = crc32($name);
        $index = abs($hash) % count($colors);

        return $colors[$index];
    }

    /**
     * Generate slug from text
     *
     * @param string $text Input text
     * @return string Slug
     */
    private function slugify(string $text): string
    {
        $text = trim($text);
        $text = mb_strtolower($text, 'UTF-8');

        // Turkish character mapping
        $tr = ['ş', 'ı', 'ğ', 'ü', 'ö', 'ç', 'Ş', 'İ', 'Ğ', 'Ü', 'Ö', 'Ç'];
        $en = ['s', 'i', 'g', 'u', 'o', 'c', 's', 'i', 'g', 'u', 'o', 'c'];
        $text = str_replace($tr, $en, $text);

        // Replace non-alphanumeric with dashes
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        $text = trim($text, '-');
        $text = preg_replace('/-+/', '-', $text);

        return $text;
    }

    /**
     * Get seeding summary as a human-readable string
     *
     * @param array $results Results from seedAll()
     * @return string Summary message
     */
    public static function getSummary(array $results): string
    {
        $parts = [];

        if (isset($results['categories'])) {
            $parts[] = "Categories: {$results['categories']['created']} created, {$results['categories']['skipped']} skipped";
        }

        if (isset($results['production_types'])) {
            $parts[] = "Production Types: {$results['production_types']['created']} created, {$results['production_types']['skipped']} skipped";
        }

        if (isset($results['products'])) {
            $parts[] = "Products: {$results['products']['created']} created, {$results['products']['skipped']} skipped";
            if ($results['products']['errors'] > 0) {
                $parts[] = "  Errors: {$results['products']['errors']}";
            }
        }

        return implode("\n", $parts);
    }

    /**
     * Get available locales
     *
     * @return array List of available locale codes
     */
    public static function getAvailableLocales(): array
    {
        $dataDir = dirname(__DIR__) . '/database/seeders/data';
        $locales = [];

        if (is_dir($dataDir)) {
            foreach (scandir($dataDir) as $item) {
                if ($item !== '.' && $item !== '..' && is_dir($dataDir . '/' . $item)) {
                    // Check if products.json exists
                    if (file_exists($dataDir . '/' . $item . '/products.json')) {
                        $locales[] = $item;
                    }
                }
            }
        }

        return $locales;
    }

    /**
     * Get locale info
     *
     * @param string $locale Locale code
     * @return array|null Locale info or null
     */
    public static function getLocaleInfo(string $locale): ?array
    {
        $dataDir = dirname(__DIR__) . '/database/seeders/data/' . $locale;

        if (!is_dir($dataDir)) {
            return null;
        }

        $productsFile = $dataDir . '/products.json';
        if (!file_exists($productsFile)) {
            return null;
        }

        $data = json_decode(file_get_contents($productsFile), true);

        return [
            'locale' => $locale,
            'data_version' => $data['data_version'] ?? 'unknown',
            'product_count' => $data['total_count'] ?? count($data['data'] ?? []),
            'description' => $data['description'] ?? '',
            'generated_at' => $data['generated_at'] ?? null
        ];
    }
}
