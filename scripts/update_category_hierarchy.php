<?php
/**
 * Update Category Hierarchy Script
 *
 * Bu script mevcut kategorilerin parent_id değerlerini categories.json'daki
 * parent_key bilgilerine göre günceller.
 *
 * Kullanım: php scripts/update_category_hierarchy.php [company_id]
 */

require_once __DIR__ . '/../config.php';

$db = Database::getInstance();

// Company ID parametresi (opsiyonel)
$targetCompanyId = $argv[1] ?? null;

// JSON dosyasını oku
$jsonPath = BASE_PATH . '/database/seeders/data/tr/categories.json';
if (!file_exists($jsonPath)) {
    echo "HATA: categories.json dosyası bulunamadı: $jsonPath\n";
    exit(1);
}

$jsonContent = file_get_contents($jsonPath);
$jsonData = json_decode($jsonContent, true);

if (!$jsonData || empty($jsonData['data'])) {
    echo "HATA: categories.json içeriği okunamadı veya boş\n";
    exit(1);
}

// key -> parent_key mapping oluştur
$keyToParentKey = [];
foreach ($jsonData['data'] as $cat) {
    if (!empty($cat['key'])) {
        $keyToParentKey[$cat['slug']] = $cat['parent_key'] ?? null;
    }
}

echo "=== Kategori Hiyerarşisi Güncelleme ===\n\n";
echo "JSON'dan " . count($keyToParentKey) . " kategori slug'ı okundu.\n\n";

// Firmaları al
$companies = [];
if ($targetCompanyId) {
    $company = $db->fetch("SELECT id, name FROM companies WHERE id = ?", [$targetCompanyId]);
    if ($company) {
        $companies[] = $company;
    } else {
        echo "HATA: Firma bulunamadı: $targetCompanyId\n";
        exit(1);
    }
} else {
    $companies = $db->fetchAll("SELECT id, name FROM companies WHERE status = 'active'");
}

if (empty($companies)) {
    echo "HATA: İşlenecek firma bulunamadı.\n";
    exit(1);
}

$totalUpdated = 0;
$totalSkipped = 0;
$totalErrors = 0;

foreach ($companies as $company) {
    echo "Firma: {$company['name']} ({$company['id']})\n";
    echo str_repeat('-', 50) . "\n";

    // Bu firmadaki kategorileri al
    $categories = $db->fetchAll(
        "SELECT id, slug, name, parent_id FROM categories WHERE company_id = ?",
        [$company['id']]
    );

    if (empty($categories)) {
        echo "  Bu firmada kategori bulunamadı.\n\n";
        continue;
    }

    // slug -> id mapping oluştur
    $slugToId = [];
    foreach ($categories as $cat) {
        $slugToId[$cat['slug']] = $cat['id'];
    }

    $companyUpdated = 0;
    $companySkipped = 0;

    foreach ($categories as $cat) {
        $slug = $cat['slug'];

        // JSON'da bu slug var mı?
        if (!isset($keyToParentKey[$slug])) {
            // JSON'da yok, atla
            continue;
        }

        $parentKey = $keyToParentKey[$slug];
        $newParentId = null;

        if ($parentKey !== null) {
            // parent_key'den slug'ı çıkar (demo.category.meyve -> meyve)
            $parentSlug = str_replace('demo.category.', '', $parentKey);

            if (isset($slugToId[$parentSlug])) {
                $newParentId = $slugToId[$parentSlug];
            } else {
                echo "  UYARI: Parent slug bulunamadı: $parentSlug (kategori: $slug)\n";
                continue;
            }
        }

        // Mevcut parent_id ile karşılaştır
        if ($cat['parent_id'] === $newParentId) {
            $companySkipped++;
            continue;
        }

        // Güncelle
        try {
            $db->update('categories',
                ['parent_id' => $newParentId, 'updated_at' => date('Y-m-d H:i:s')],
                'id = ?',
                [$cat['id']]
            );

            $parentName = $newParentId ? "(parent: $parentSlug)" : "(üst kategori)";
            echo "  ✓ {$cat['name']} ($slug) -> $parentName\n";
            $companyUpdated++;
        } catch (Exception $e) {
            echo "  ✗ HATA: {$cat['name']} güncellenemedi: " . $e->getMessage() . "\n";
            $totalErrors++;
        }
    }

    echo "\n  Güncellenen: $companyUpdated, Atlanan: $companySkipped\n\n";
    $totalUpdated += $companyUpdated;
    $totalSkipped += $companySkipped;
}

echo "=== ÖZET ===\n";
echo "Toplam güncellenen: $totalUpdated\n";
echo "Toplam atlanan: $totalSkipped\n";
echo "Toplam hata: $totalErrors\n";
echo "\nİşlem tamamlandı.\n";
