<?php
/**
 * ProductSeeder - Seeds product data.
 *
 * Reads demo products from JSON and persists them.
 * Also normalizes category/subcategory to match seeded category hierarchy.
 */

require_once __DIR__ . '/BaseSeeder.php';

class ProductSeeder extends BaseSeeder
{
    /** @var int Batch size for bulk insert */
    private $batchSize = 100;

    /** @var array<string, string> normalized parent name => canonical parent name */
    private $parentCategoryMap = [];

    /** @var array<string, string> normalized child name => canonical parent name */
    private $childToParentMap = [];

    /** @var array<string, string> normalized child name => canonical child name */
    private $childCategoryMap = [];

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
        $this->log("=== ProductSeeder starting ({$this->locale}) ===");

        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError('Product data could not be loaded or is empty');
            return false;
        }

        $products = $jsonData['data'];
        $total = count($products);
        $this->log("  {$this->locale} locale: {$total} products found");

        $this->loadCategoryHierarchy();

        $batches = array_chunk($products, $this->batchSize);
        $batchNum = 0;

        foreach ($batches as $batch) {
            $batchNum++;
            $this->log('  Processing batch ' . $batchNum . '/' . count($batches) . ' ...');

            foreach ($batch as $product) {
                $this->seedProduct($product);
            }
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    /**
     * Loads category hierarchy for current company to enforce category/subcategory consistency.
     */
    private function loadCategoryHierarchy(): void
    {
        $this->parentCategoryMap = [];
        $this->childToParentMap = [];
        $this->childCategoryMap = [];

        $where = '1=1';
        $params = [];
        if ($this->companyId) {
            $where = '(c.company_id = ? OR c.company_id IS NULL)';
            $params[] = $this->companyId;
        }

        $rows = $this->db->fetchAll(
            "SELECT c.name AS child_name, c.parent_id, p.name AS parent_name
             FROM categories c
             LEFT JOIN categories p ON p.id::text = c.parent_id
             WHERE {$where}",
            $params
        );

        foreach ($rows as $row) {
            $childName = trim((string)($row['child_name'] ?? ''));
            $parentName = trim((string)($row['parent_name'] ?? ''));

            if ($childName === '') {
                continue;
            }

            if ($parentName === '' || empty($row['parent_id'])) {
                $this->parentCategoryMap[$this->normalizeName($childName)] = $childName;
                continue;
            }

            $childNorm = $this->normalizeName($childName);
            $this->childToParentMap[$childNorm] = $parentName;
            $this->childCategoryMap[$childNorm] = $childName;
            $this->parentCategoryMap[$this->normalizeName($parentName)] = $parentName;
        }
    }

    /**
     * Normalize a label for case-insensitive matching.
     */
    private function normalizeName(?string $value): string
    {
        return mb_strtolower(trim((string)$value), 'UTF-8');
    }

    /**
     * Resolve parent category from group name using exact or alias mapping.
     */
    private function resolveParentFromGroup(?string $group): ?string
    {
        $groupNorm = $this->normalizeName((string)$group);
        if ($groupNorm === '') {
            return null;
        }

        if (isset($this->parentCategoryMap[$groupNorm])) {
            return $this->parentCategoryMap[$groupNorm];
        }

        $aliases = [
            'fırın' => 'fırın ürünleri',
            'firin' => 'fırın ürünleri',
            'çerez' => 'kuruyemiş',
            'cerez' => 'kuruyemiş',
            'fırın/donuk' => 'donuk',
            'firin/donuk' => 'donuk',
            'dondurulmuş' => 'donuk',
            'dondurulmus' => 'donuk',
            'kasap' => 'et ürünleri',
            'balık' => 'deniz ürünleri',
            'balik' => 'deniz ürünleri',
            'sarkuteri' => 'şarküteri',
        ];

        $targetNorm = $aliases[$groupNorm] ?? null;
        if ($targetNorm && isset($this->parentCategoryMap[$targetNorm])) {
            return $this->parentCategoryMap[$targetNorm];
        }

        return null;
    }

    /**
     * Normalize category/subcategory using known hierarchy.
     * Goal: category at parent level, subcategory at child level when possible.
     *
     * @return array{0:?string,1:?string}
     */
    private function normalizeCategoryFields(?string $group, ?string $category, ?string $subcategory): array
    {
        $group = trim((string)$group);
        $category = trim((string)$category);
        $subcategory = trim((string)$subcategory);

        // Fill missing category from group when group exists in parent categories.
        $resolvedGroupParent = $this->resolveParentFromGroup($group);
        if ($category === '' && $resolvedGroupParent !== null) {
            $category = $resolvedGroupParent;
        }

        $categoryNorm = $this->normalizeName($category);

        // Source category is child-level; promote to parent and use child as subcategory.
        if ($category !== '' && isset($this->childToParentMap[$categoryNorm])) {
            $category = $this->childToParentMap[$categoryNorm];
            $subcategory = $this->childCategoryMap[$categoryNorm] ?? $subcategory;
            $categoryNorm = $this->normalizeName($category);
        }

        // If category is unknown but group maps to a known parent, use group as category.
        if ($category !== '' && !isset($this->parentCategoryMap[$categoryNorm]) && $resolvedGroupParent !== null) {
                $originalCategory = $category;
                $category = $resolvedGroupParent;
                $categoryNorm = $this->normalizeName($category);

                $originalNorm = $this->normalizeName($originalCategory);
                if (isset($this->childToParentMap[$originalNorm]) && $this->normalizeName($this->childToParentMap[$originalNorm]) === $categoryNorm) {
                    $subcategory = $this->childCategoryMap[$originalNorm] ?? $originalCategory;
                }
        }

        $category = $category !== '' ? $category : null;
        $subcategory = $subcategory !== '' ? $subcategory : null;

        return [$category, $subcategory];
    }

    /**
     * Seeds one product row.
     *
     * @param array<string,mixed> $product
     */
    private function seedProduct(array $product): bool
    {
        if ($this->demoOnly && empty($product['is_demo'])) {
            $this->stats['skipped']++;
            return true;
        }
        if ($this->defaultOnly && empty($product['is_default'])) {
            $this->stats['skipped']++;
            return true;
        }

        [$normalizedCategory, $normalizedSubcategory] = $this->normalizeCategoryFields(
            $product['group'] ?? null,
            $product['category'] ?? null,
            $product['subcategory'] ?? null
        );

        $data = [
            'sku' => $product['sku'],
            'barcode' => $product['barcode'] ?? null,
            'name' => $product['name'],
            'slug' => $product['slug'] ?? $this->slugify($product['name']),
            'description' => $product['description'] ?? null,
            'category' => $normalizedCategory,
            'subcategory' => $normalizedSubcategory,
            'group' => $product['group'] ?? null,
            'origin' => $product['origin'] ?? 'Türkiye',
            'production_type' => $product['production_type'] ?? 'Konvansiyonel',
            'unit' => $product['unit'] ?? 'kg',
            'current_price' => $product['current_price'] ?? 0,
            'previous_price' => $product['previous_price'] ?? null,
            'vat_rate' => $product['vat_rate'] ?? 10,
            'kunye_no' => $product['kunye_no'] ?? null,
            'is_demo' => $product['is_demo'] ?? false,
            'status' => $product['status'] ?? 'active',
        ];

        if ($this->companyId) {
            $data['company_id'] = $this->companyId;
        }

        if ($this->dryRun) {
            $this->log("  [DRY-RUN] Would seed: {$data['name']} ({$data['sku']})");
            $this->stats['created']++;
            return true;
        }

        try {
            $whereClause = 'sku = ?';
            $whereParams = [$data['sku']];

            if ($this->companyId) {
                $whereClause .= ' AND company_id = ?';
                $whereParams[] = $this->companyId;
            }

            $existing = $this->db->fetch(
                "SELECT id FROM products WHERE {$whereClause}",
                $whereParams
            );

            if ($existing) {
                $data['updated_at'] = date('Y-m-d H:i:s');
                $data = $this->filterDataForTable($data, 'products');
                $this->db->update('products', $data, 'id = ?', [$existing['id']]);
                $this->stats['updated']++;

                if ($this->verbose) {
                    $this->log("  ↻ Updated: {$data['name']}");
                }
            } else {
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
                    $this->log("  ✓ Added: {$data['name']}");
                }
            }

            return true;
        } catch (Exception $e) {
            $this->stats['errors']++;
            $this->logError("Product save error ({$data['sku']}): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sets batch size.
     */
    public function setBatchSize(int $size): self
    {
        $this->batchSize = max(1, $size);
        return $this;
    }
}
