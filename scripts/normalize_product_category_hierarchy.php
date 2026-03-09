<?php
/**
 * Normalize product category hierarchy for existing rows.
 *
 * Usage:
 *   php scripts/normalize_product_category_hierarchy.php [--company=UUID] [--apply] [--no-add-missing]
 *
 * Behavior:
 * - Keeps category on parent level
 * - Keeps subcategory on child level
 * - If needed, can create missing child categories to preserve existing subcategory preferences
 */

require_once __DIR__ . '/../config.php';

$db = Database::getInstance();
$pdo = $db->getPdo();

$options = getopt('', ['company:', 'apply', 'no-add-missing']);
$targetCompanyId = $options['company'] ?? null;
$apply = isset($options['apply']);
$addMissing = !isset($options['no-add-missing']);

function normalize_text(string $value): string
{
    return mb_strtolower(trim($value), 'UTF-8');
}

function resolve_parent_from_group(string $groupNorm, array $parents): ?string
{
    if (isset($parents[$groupNorm])) {
        return $parents[$groupNorm]['name'];
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
    if ($targetNorm && isset($parents[$targetNorm])) {
        return $parents[$targetNorm]['name'];
    }

    return null;
}

function pick_target_company(Database $db, ?string $explicitCompanyId): ?string
{
    if (!empty($explicitCompanyId)) {
        return $explicitCompanyId;
    }

    $row = $db->fetch(
        "SELECT company_id, COUNT(*) AS n
         FROM products
         WHERE company_id IS NOT NULL AND status != 'deleted'
         GROUP BY company_id
         ORDER BY n DESC
         LIMIT 1"
    );

    return $row['company_id'] ?? null;
}

$companyId = pick_target_company($db, $targetCompanyId);
if (!$companyId) {
    echo "No target company found.\n";
    exit(1);
}

$company = $db->fetch("SELECT id, name FROM companies WHERE id = ?", [$companyId]);
if (!$company) {
    echo "Company not found: {$companyId}\n";
    exit(1);
}

echo "=== Product Category Hierarchy Normalization ===\n";
echo "Company: {$company['name']} ({$company['id']})\n";
echo "Mode: " . ($apply ? 'APPLY' : 'DRY-RUN') . "\n";
echo "Add missing subcategories: " . ($addMissing ? 'yes' : 'no') . "\n\n";

$categories = $db->fetchAll(
    "SELECT id, name, parent_id, sort_order
     FROM categories
     WHERE company_id = ? OR company_id IS NULL
     ORDER BY sort_order ASC, name ASC",
    [$companyId]
);

$parents = [];
$childrenByParent = [];
$childToParent = [];
$categoryIdsByParentAndChild = [];
$maxSortByParent = [];

foreach ($categories as $cat) {
    $name = trim((string)($cat['name'] ?? ''));
    if ($name === '') {
        continue;
    }
    $nameNorm = normalize_text($name);
    $parentId = (string)($cat['parent_id'] ?? '');
    if ($parentId === '') {
        $parents[$nameNorm] = [
            'id' => (string)$cat['id'],
            'name' => $name,
        ];
    }
}

// Build parentId->parentName map
$parentNameById = [];
foreach ($parents as $parent) {
    $parentNameById[$parent['id']] = $parent['name'];
}

foreach ($categories as $cat) {
    $name = trim((string)($cat['name'] ?? ''));
    $parentId = (string)($cat['parent_id'] ?? '');
    if ($name === '' || $parentId === '' || !isset($parentNameById[$parentId])) {
        continue;
    }

    $parentName = $parentNameById[$parentId];
    $parentNorm = normalize_text($parentName);
    $childNorm = normalize_text($name);

    $childrenByParent[$parentNorm][$childNorm] = $name;
    $childToParent[$childNorm] = $parentName;
    $categoryIdsByParentAndChild[$parentNorm][$childNorm] = (string)$cat['id'];
    $maxSortByParent[$parentNorm] = max(
        (int)($maxSortByParent[$parentNorm] ?? 0),
        (int)($cat['sort_order'] ?? 0)
    );
}

$products = $db->fetchAll(
    "SELECT id, sku, \"group\", category, subcategory
     FROM products
     WHERE company_id = ? AND status != 'deleted'",
    [$companyId]
);

if (empty($products)) {
    echo "No products found.\n";
    exit(0);
}

$stats = [
    'products_total' => count($products),
    'products_update_needed' => 0,
    'products_updated' => 0,
    'products_update_noop' => 0,
    'categories_created' => 0,
    'errors' => 0,
];

$samples = [];

try {
    if ($apply) {
        $pdo->beginTransaction();
    }

    foreach ($products as $p) {
        $id = (string)$p['id'];
        $sku = (string)$p['sku'];
        $group = trim((string)($p['group'] ?? ''));
        $category = trim((string)($p['category'] ?? ''));
        $subcategory = trim((string)($p['subcategory'] ?? ''));

        $newCategory = $category;
        $newSubcategory = $subcategory;

        $groupNorm = normalize_text($group);
        $catNorm = normalize_text($category);
        $subNorm = normalize_text($subcategory);

        // 1) If category is child-level, promote parent and move child into subcategory
        if ($category !== '' && isset($childToParent[$catNorm])) {
            $newCategory = $childToParent[$catNorm];
            $newSubcategory = $category;
        }

        // 2) If category is unknown parent but group is a known parent, map category to group
        $newCatNorm = normalize_text($newCategory);
        $resolvedGroupParent = $group !== '' ? resolve_parent_from_group($groupNorm, $parents) : null;
        if ($newCategory !== '' && !isset($parents[$newCatNorm]) && $resolvedGroupParent !== null) {
            $originalCategory = $newCategory;
            $newCategory = $resolvedGroupParent;
            $newCatNorm = normalize_text($newCategory);

            $originalNorm = normalize_text($originalCategory);
            if (isset($childrenByParent[$newCatNorm][$originalNorm])) {
                $newSubcategory = $childrenByParent[$newCatNorm][$originalNorm];
            }
        }

        // 3) Fill missing category from group if possible
        if ($newCategory === '' && $resolvedGroupParent !== null) {
            $newCategory = $resolvedGroupParent;
            $newCatNorm = normalize_text($newCategory);
        }

        // 4) Validate subcategory under selected parent category
        $newSubNorm = normalize_text($newSubcategory);
        if ($newCategory !== '' && $newSubcategory !== '') {
            $isValidChild = isset($childrenByParent[$newCatNorm][$newSubNorm]);
            if (!$isValidChild && $addMissing && isset($parents[$newCatNorm])) {
                // Create child category under selected parent to preserve preference
                $newId = $db->generateUuid();
                $sortOrder = ((int)($maxSortByParent[$newCatNorm] ?? 0)) + 1;
                $slug = preg_replace('/[^a-z0-9]+/i', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $newSubcategory));
                $slug = trim((string)$slug, '-');
                if ($slug === '') {
                    $slug = 'subcategory-' . substr(str_replace('-', '', $newId), 0, 8);
                }

                if ($apply) {
                    $db->insert('categories', [
                        'id' => $newId,
                        'company_id' => $companyId,
                        'name' => $newSubcategory,
                        'slug' => $slug,
                        'parent_id' => $parents[$newCatNorm]['id'],
                        'sort_order' => $sortOrder,
                        'is_demo' => true,
                        'status' => 'active',
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                }

                $childrenByParent[$newCatNorm][$newSubNorm] = $newSubcategory;
                $categoryIdsByParentAndChild[$newCatNorm][$newSubNorm] = $newId;
                $maxSortByParent[$newCatNorm] = $sortOrder;
                $stats['categories_created']++;
            }
        }

        if ($newCategory === '') {
            $newCategory = null;
        }
        if ($newSubcategory === '') {
            $newSubcategory = null;
        }

        $changed = (($category ?: null) !== $newCategory) || (($subcategory ?: null) !== $newSubcategory);
        if ($changed) {
            $stats['products_update_needed']++;
            if (count($samples) < 25) {
                $samples[] = "{$sku}: ({$category} > {$subcategory}) => ({$newCategory} > {$newSubcategory})";
            }

            if ($apply) {
                $affected = $db->update('products', [
                    'category' => $newCategory,
                    'subcategory' => $newSubcategory,
                    'updated_at' => date('Y-m-d H:i:s'),
                ], 'id = ?', [$id]);
                if ($affected > 0) {
                    $stats['products_updated'] += $affected;
                } else {
                    $stats['products_update_noop']++;
                }
            }
        }
    }

    if ($apply) {
        $pdo->commit();
    }
} catch (Throwable $e) {
    if ($apply && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $stats['errors']++;
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Products total: {$stats['products_total']}\n";
echo "Products needing update: {$stats['products_update_needed']}\n";
echo "Products updated: {$stats['products_updated']}\n";
echo "Products update noop: {$stats['products_update_noop']}\n";
echo "Categories created: {$stats['categories_created']}\n";
echo "Errors: {$stats['errors']}\n\n";

if (!empty($samples)) {
    echo "Sample changes:\n";
    foreach ($samples as $sample) {
        echo "- {$sample}\n";
    }
}

echo "\nDone.\n";
