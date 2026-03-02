<?php
/**
 * CSV to JSON Converter for Demo Product Seeder
 *
 * Bu script yeni-urun-listesi-son.csv dosyasını okuyup
 * database/seeders/data/tr/products.json dosyasına dönüştürür.
 *
 * Kullanım: php CsvToJsonConverter.php
 */

// Proje kök dizinini bul
$rootPath = dirname(dirname(__DIR__));

// CSV dosya yolu
$csvPath = $rootPath . '/kutuphane/yeni-urun-listesi-son.csv';

// Çıktı dizini
$outputDir = $rootPath . '/database/seeders/data/tr';

// Dizin yoksa oluştur
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

// Grup prefix'leri (SKU kodu için)
$groupPrefixes = [
    'Manav' => 'MNV',
    'Bakliyat' => 'BKL',
    'Donuk' => 'DNK',
    'Baharat' => 'BHR',
    'Dondurulmuş' => 'DND',
    'Fırın' => 'FRN',
    'Kahvaltılık' => 'KHV',
    'Tatlı' => 'TTL',
    'Çerez' => 'CRZ',
    'İçecek' => 'ICK',
    'Deniz Ürünleri' => 'DNZ',
    'Kasap' => 'KSP',
    'Şarküteri' => 'SRK',
    'Unlu Mamüller' => 'UNL',
    'Süt Ürünleri' => 'SUT',
    'Temizlik' => 'TMZ',
    'Kişisel Bakım' => 'KSB',
    'Temel Gıda' => 'TGL'
];

// Kategori bazlı fiyat aralıkları (TL/kg veya TL/adet)
$priceRanges = [
    'Meyve' => ['min' => 15, 'max' => 85],
    'Sebze' => ['min' => 8, 'max' => 45],
    'Orman Meyvesi' => ['min' => 120, 'max' => 250],
    'Tropikal' => ['min' => 45, 'max' => 180],
    'Turunçgil' => ['min' => 12, 'max' => 35],
    'Sert Meyve' => ['min' => 25, 'max' => 65],
    'Yumuşak Meyve' => ['min' => 35, 'max' => 95],
    'Çekirdekli' => ['min' => 30, 'max' => 75],
    'Yaz Meyvesi' => ['min' => 8, 'max' => 25],
    'Yapraklı' => ['min' => 6, 'max' => 28],
    'Yeşillik' => ['min' => 5, 'max' => 18],
    'Kök Sebze' => ['min' => 8, 'max' => 25],
    'Kabak' => ['min' => 10, 'max' => 30],
    'Patlıcan/Biber' => ['min' => 15, 'max' => 45],
    'Mantar' => ['min' => 45, 'max' => 150],
    'Soğan/Sarımsak' => ['min' => 18, 'max' => 55],
    'Fasulye/Bezelye' => ['min' => 25, 'max' => 65],
    'Kuru Baklagil' => ['min' => 35, 'max' => 95],
    'Pirinç' => ['min' => 45, 'max' => 120],
    'Bulgur' => ['min' => 25, 'max' => 55],
    'Baharat' => ['min' => 80, 'max' => 350],
    'Toz Baharat' => ['min' => 120, 'max' => 450],
    'Karışım' => ['min' => 150, 'max' => 380],
    'Et' => ['min' => 180, 'max' => 450],
    'Kırmızı Et' => ['min' => 250, 'max' => 550],
    'Beyaz Et' => ['min' => 85, 'max' => 180],
    'Kuzu' => ['min' => 280, 'max' => 480],
    'Dana' => ['min' => 220, 'max' => 420],
    'Tavuk' => ['min' => 65, 'max' => 140],
    'Balık' => ['min' => 120, 'max' => 380],
    'Taze Balık' => ['min' => 150, 'max' => 450],
    'Dondurulmuş Balık' => ['min' => 85, 'max' => 220],
    'Deniz Ürünü' => ['min' => 180, 'max' => 550],
    'Şarküteri' => ['min' => 150, 'max' => 380],
    'Peynir' => ['min' => 120, 'max' => 450],
    'Süt Ürünü' => ['min' => 25, 'max' => 85],
    'Kahvaltılık' => ['min' => 45, 'max' => 180],
    'Çerez' => ['min' => 85, 'max' => 280],
    'Kuruyemiş' => ['min' => 120, 'max' => 380],
    'Tatlı' => ['min' => 65, 'max' => 220],
    'İçecek' => ['min' => 15, 'max' => 65],
    'Donuk' => ['min' => 45, 'max' => 150],
    'default' => ['min' => 20, 'max' => 80]
];

/**
 * Türkçe karakterleri slug-safe hale getirir
 */
function slugify($text) {
    $text = trim($text);
    $text = mb_strtolower($text, 'UTF-8');

    // Türkçe karakter dönüşümleri
    $tr = ['ş', 'ı', 'ğ', 'ü', 'ö', 'ç', 'Ş', 'İ', 'Ğ', 'Ü', 'Ö', 'Ç'];
    $en = ['s', 'i', 'g', 'u', 'o', 'c', 's', 'i', 'g', 'u', 'o', 'c'];
    $text = str_replace($tr, $en, $text);

    // Alfanumerik olmayan karakterleri tire ile değiştir
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);

    // Başta ve sonda tireleri kaldır
    $text = trim($text, '-');

    // Birden fazla tireyi tek tireye dönüştür
    $text = preg_replace('/-+/', '-', $text);

    return $text;
}

/**
 * Kategori bazlı rastgele fiyat üretir
 */
function generatePrice($category, $subcategory, $priceRanges) {
    // Önce alt kategori, sonra ana kategori, sonra default
    $range = $priceRanges[$subcategory]
        ?? $priceRanges[$category]
        ?? $priceRanges['default'];

    // Rastgele fiyat (10 kuruş hassasiyetinde)
    $price = $range['min'] + (mt_rand(0, ($range['max'] - $range['min']) * 10) / 10);

    // Yuvarlama (.90, .95, .99 gibi)
    $endings = [0.90, 0.95, 0.99, 0.49, 0.00];
    $base = floor($price);
    $ending = $endings[array_rand($endings)];

    return $base + $ending;
}

/**
 * Demo barkod üretir (8690 ile başlayan 13 haneli EAN-13)
 */
function generateBarcode($index) {
    // 8690 (Türkiye) + 000 (demo firma) + 5 haneli sıra + check digit
    $base = '8690000' . str_pad($index, 5, '0', STR_PAD_LEFT);

    // EAN-13 check digit hesapla
    $sum = 0;
    for ($i = 0; $i < 12; $i++) {
        $sum += intval($base[$i]) * (($i % 2 === 0) ? 1 : 3);
    }
    $checkDigit = (10 - ($sum % 10)) % 10;

    return $base . $checkDigit;
}

/**
 * Birim normalizasyonu
 */
function normalizeUnit($unit) {
    $unit = trim(strtolower($unit));

    $mapping = [
        'kg' => 'kg',
        'kilo' => 'kg',
        'kilogram' => 'kg',
        'gr' => 'gr',
        'gram' => 'gr',
        'lt' => 'lt',
        'litre' => 'lt',
        'ml' => 'ml',
        'adet' => 'adet',
        'ad' => 'adet',
        'paket' => 'paket',
        'pkt' => 'paket',
        'kutu' => 'kutu',
        'demet' => 'demet',
        'bağ' => 'demet',
        'bag' => 'demet'
    ];

    return $mapping[$unit] ?? 'adet';
}

/**
 * Menşei normalizasyonu
 */
function normalizeOrigin($origin) {
    $origin = trim($origin);

    $mapping = [
        'Türkiye' => 'Türkiye',
        'türkiye' => 'Türkiye',
        'TÜRKIYE' => 'Türkiye',
        'İthal' => 'İthal',
        'ithal' => 'İthal',
        'ITHAL' => 'İthal'
    ];

    return $mapping[$origin] ?? $origin;
}

/**
 * Üretim şekli normalizasyonu
 */
function normalizeProductionType($type) {
    $type = trim($type);

    $mapping = [
        'Konvansiyonel' => 'Konvansiyonel',
        'konvansiyonel' => 'Konvansiyonel',
        'Organik' => 'Organik',
        'organik' => 'Organik',
        'Naturel' => 'Naturel',
        'naturel' => 'Naturel',
        'İyi Tarım' => 'İyi Tarım',
        'iyi tarım' => 'İyi Tarım',
        'Geleneksel' => 'Geleneksel',
        'geleneksel' => 'Geleneksel'
    ];

    return $mapping[$type] ?? 'Konvansiyonel';
}

// CSV dosyasını oku
echo "CSV dosyası okunuyor: $csvPath\n";

$handle = fopen($csvPath, 'r');
if (!$handle) {
    die("CSV dosyası açılamadı!\n");
}

// BOM karakterini temizle
$bom = fread($handle, 3);
if ($bom !== "\xef\xbb\xbf") {
    rewind($handle);
}

// Başlık satırını oku
$header = fgetcsv($handle, 0, ';');
$header = array_map('trim', $header);

echo "Sütunlar: " . implode(', ', $header) . "\n\n";

// Ürünleri işle
$products = [];
$categories = [];
$productionTypes = [];
$groupCounters = [];
$index = 0;

while (($row = fgetcsv($handle, 0, ';')) !== false) {
    if (count($row) < 15) continue; // Eksik satırları atla

    $index++;

    // Verileri al
    $name = trim($row[2] ?? '');
    if (empty($name)) continue;

    $group = trim($row[14] ?? 'Diğer');
    $category = trim($row[15] ?? '');
    $subcategory = trim($row[16] ?? '');
    $origin = normalizeOrigin($row[17] ?? 'Türkiye');
    $productionType = normalizeProductionType($row[18] ?? 'Konvansiyonel');
    $unit = normalizeUnit($row[4] ?? 'kg');
    $kunyeNo = trim($row[13] ?? '');

    // Mevcut değerler (varsa kullan)
    $existingCode = trim($row[1] ?? '');
    $existingBarcode = trim($row[3] ?? '');
    $existingPrice = floatval(str_replace(',', '.', trim($row[7] ?? '')));

    // Grup sayacı
    $groupKey = $group ?: 'Diger';
    if (!isset($groupCounters[$groupKey])) {
        $groupCounters[$groupKey] = 0;
    }
    $groupCounters[$groupKey]++;

    // SKU oluştur
    $prefix = $groupPrefixes[$groupKey] ?? 'OTH';
    $sku = !empty($existingCode)
        ? $existingCode
        : $prefix . '-' . str_pad($groupCounters[$groupKey], 4, '0', STR_PAD_LEFT);

    // Barkod oluştur
    $barcode = !empty($existingBarcode) ? $existingBarcode : generateBarcode($index);

    // Fiyat oluştur
    $price = $existingPrice > 0 ? $existingPrice : generatePrice($category, $subcategory, $priceRanges);

    // Slug oluştur
    $slug = slugify($name);

    // Key oluştur (demo.product.slug formatında)
    $key = 'demo.product.' . $slug;

    // Ürün objesi
    $product = [
        'key' => $key,
        'sku' => $sku,
        'barcode' => $barcode,
        'name' => $name,
        'slug' => $slug,
        'category' => $category ?: $group,
        'subcategory' => $subcategory,
        'group' => $group,
        'origin' => $origin,
        'production_type' => $productionType,
        'unit' => $unit,
        'current_price' => round($price, 2),
        'vat_rate' => 10, // Gıda KDV oranı
        'kunye_no' => $kunyeNo,
        'is_demo' => true,
        'is_default' => true,
        'status' => 'active'
    ];

    $products[] = $product;

    // Kategorileri topla
    if (!empty($category) && !in_array($category, $categories)) {
        $categories[] = $category;
    }
    if (!empty($subcategory) && !in_array($subcategory, $categories)) {
        $categories[] = $subcategory;
    }
    if (!empty($group) && !in_array($group, $categories)) {
        $categories[] = $group;
    }

    // Üretim tiplerini topla
    if (!in_array($productionType, $productionTypes)) {
        $productionTypes[] = $productionType;
    }
}

fclose($handle);

echo "Toplam {$index} ürün işlendi.\n";
echo "Benzersiz kategoriler: " . count($categories) . "\n";
echo "Üretim tipleri: " . implode(', ', $productionTypes) . "\n\n";

// JSON formatında kaydet
$output = [
    'schema_version' => '1.0',
    'data_version' => '2026.01.tr',
    'locale' => 'tr',
    'description' => 'Türkçe demo ürün verileri - Market/Manav kategorileri',
    'source' => 'yeni-urun-listesi-son.csv',
    'generated_at' => date('Y-m-d H:i:s'),
    'total_count' => count($products),
    'data' => $products
];

$jsonPath = $outputDir . '/products.json';
$jsonContent = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

if (file_put_contents($jsonPath, $jsonContent)) {
    echo "✓ products.json oluşturuldu: $jsonPath\n";
    echo "  Dosya boyutu: " . number_format(strlen($jsonContent)) . " byte\n";
} else {
    echo "✗ products.json yazılamadı!\n";
}

// Kategorileri de kaydet
$categoryOutput = [
    'schema_version' => '1.0',
    'data_version' => '2026.01.tr',
    'locale' => 'tr',
    'description' => 'Türkçe kategori verileri',
    'generated_at' => date('Y-m-d H:i:s'),
    'data' => array_map(function($cat, $idx) {
        return [
            'key' => 'demo.category.' . slugify($cat),
            'name' => $cat,
            'slug' => slugify($cat),
            'sort_order' => $idx,
            'is_demo' => true,
            'is_default' => true,
            'status' => 'active'
        ];
    }, $categories, array_keys($categories))
];

$catJsonPath = $outputDir . '/categories.json';
file_put_contents($catJsonPath, json_encode($categoryOutput, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "✓ categories.json oluşturuldu: $catJsonPath\n";

// Üretim tiplerini de kaydet
$colors = ['#9E9E9E', '#4CAF50', '#8BC34A', '#CDDC39', '#795548'];
$productionTypeOutput = [
    'schema_version' => '1.0',
    'data_version' => '2026.01.tr',
    'locale' => 'tr',
    'description' => 'Türkçe üretim tipi verileri',
    'generated_at' => date('Y-m-d H:i:s'),
    'data' => array_map(function($type, $idx) use ($colors) {
        return [
            'key' => 'demo.production_type.' . slugify($type),
            'name' => $type,
            'slug' => slugify($type),
            'color' => $colors[$idx % count($colors)],
            'sort_order' => $idx,
            'is_demo' => true,
            'is_default' => true,
            'status' => 'active'
        ];
    }, $productionTypes, array_keys($productionTypes))
];

$ptJsonPath = $outputDir . '/production_types.json';
file_put_contents($ptJsonPath, json_encode($productionTypeOutput, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "✓ production_types.json oluşturuldu: $ptJsonPath\n";

echo "\n✓ Tüm dönüşümler tamamlandı!\n";
