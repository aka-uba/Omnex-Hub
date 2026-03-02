<?php
/**
 * Artisan Bakery ESL Template Seed
 *
 * Kaynak: tasarımlar/sablon/stitch_butchery_esl_high_impact_promo
 * Boyut: 800x1280 (10.1" Dikey ESL)
 * Stil: Premium fırın/pastane etiketi - büyük ürün görseli, zarif tipografi
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/helpers/FabricObjectHelpers.php';

$db = Database::getInstance();
$companyId = null; // Sistem şablonu

echo "=== Artisan Bakery ESL Şablonu Oluşturuluyor ===\n\n";

// Renk paleti
$colors = [
    'background' => '#fdfaf5',      // Krem/bej arka plan
    'text_dark' => '#1b100d',       // Koyu kahve metin
    'text_muted' => '#9a594c',      // Soluk kahve
    'text_medium' => '#7d5a52',     // Orta kahve
    'price' => '#4e342e',           // Fiyat rengi (koyu kahve)
    'divider' => '#e7d3cf',         // Ayırıcı çizgi
    'primary' => '#ec3713',         // Vurgu kırmızı
];

// Canvas boyutları
$canvasWidth = 800;
$canvasHeight = 1280;

// Bölge yükseklikleri
$imageHeight = 450;     // Üst görsel alanı (%35)
$contentTop = 470;      // İçerik başlangıcı

// Fabric.js objeleri
$objects = [];

// 1. Arka plan (krem rengi)
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'left',
    'originY' => 'top',
    'left' => 0,
    'top' => 0,
    'width' => $canvasWidth,
    'height' => $canvasHeight,
    'fill' => $colors['background'],
    'stroke' => null,
    'strokeWidth' => 0,
    'rx' => 0,
    'ry' => 0,
    'selectable' => false,
    'evented' => false,
];

// 2. Ürün görseli alanı (placeholder)
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'left',
    'originY' => 'top',
    'left' => 0,
    'top' => 0,
    'width' => $canvasWidth,
    'height' => $imageHeight,
    'fill' => '#e8ddd4',
    'stroke' => null,
    'strokeWidth' => 0,
    'rx' => 0,
    'ry' => 0,
    'customType' => 'image-placeholder',
    'selectable' => true,
    'evented' => true,
];

// 3. Dinamik ürün görseli
$objects[] = [
    'type' => 'image',
    'version' => '5.3.0',
    'originX' => 'left',
    'originY' => 'top',
    'left' => 0,
    'top' => 0,
    'width' => $canvasWidth,
    'height' => $imageHeight,
    'scaleX' => 1,
    'scaleY' => 1,
    'src' => '',
    'crossOrigin' => 'anonymous',
    'customType' => 'dynamic-image',
    'dynamicField' => 'image_url',
    'isDataField' => true,
    'selectable' => true,
    'evented' => true,
];

// 4. Gradient overlay (görsel geçişi için)
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'left',
    'originY' => 'top',
    'left' => 0,
    'top' => $imageHeight - 60,
    'width' => $canvasWidth,
    'height' => 60,
    'fill' => [
        'type' => 'linear',
        'coords' => ['x1' => 0, 'y1' => 0, 'x2' => 0, 'y2' => 1],
        'colorStops' => [
            ['offset' => 0, 'color' => 'rgba(253, 250, 245, 0)'],
            ['offset' => 1, 'color' => $colors['background']],
        ],
    ],
    'stroke' => null,
    'strokeWidth' => 0,
    'selectable' => false,
    'evented' => false,
];

// 5. Kategori etiketi (VIENNOISERIE gibi)
$objects[] = FabricHelpers::text([
    'text' => '{{category}}',
    'left' => $canvasWidth / 2,
    'top' => $contentTop,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 22,
    'fontWeight' => '700',
    'fill' => $colors['text_muted'],
    'textAlign' => 'center',
    'charSpacing' => 300,
    'customType' => 'dynamic-text',
    'dynamicField' => 'category',
    'isDataField' => true,
]);

// 6. Ürün adı (Ana başlık - büyük)
$objects[] = FabricHelpers::text([
    'text' => '{{product_name}}',
    'left' => $canvasWidth / 2,
    'top' => $contentTop + 50,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 72,
    'fontWeight' => '700',
    'fill' => $colors['text_dark'],
    'textAlign' => 'center',
    'lineHeight' => 1.1,
    'customType' => 'dynamic-text',
    'dynamicField' => 'product_name',
    'isDataField' => true,
]);

// 7. Alt açıklama (Organic Butter • 65% Dark Chocolate gibi)
$objects[] = FabricHelpers::text([
    'text' => '{{description}}',
    'left' => $canvasWidth / 2,
    'top' => $contentTop + 180,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 26,
    'fontWeight' => '500',
    'fill' => $colors['text_medium'],
    'textAlign' => 'center',
    'customType' => 'dynamic-text',
    'dynamicField' => 'description',
    'isDataField' => true,
]);

// 8. Ayırıcı çizgi
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'center',
    'originY' => 'top',
    'left' => $canvasWidth / 2,
    'top' => $contentTop + 240,
    'width' => 100,
    'height' => 6,
    'fill' => $colors['divider'],
    'stroke' => null,
    'strokeWidth' => 0,
    'rx' => 3,
    'ry' => 3,
    'selectable' => true,
    'evented' => true,
];

// 9. Para birimi sembolü (€, ₺, $ vb.)
$objects[] = FabricHelpers::text([
    'text' => '₺',
    'left' => 180,
    'top' => $contentTop + 310,
    'originX' => 'left',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 48,
    'fontWeight' => '600',
    'fill' => $colors['price'],
    'textAlign' => 'left',
    'customType' => 'static-text',
]);

// 10. Fiyat (büyük, göze çarpan)
$objects[] = FabricHelpers::text([
    'text' => '{{current_price}}',
    'left' => $canvasWidth / 2,
    'top' => $contentTop + 280,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 160,
    'fontWeight' => '700',
    'fill' => $colors['price'],
    'textAlign' => 'center',
    'customType' => 'dynamic-text',
    'dynamicField' => 'current_price',
    'isDataField' => true,
]);

// 11. Birim etiketi (per unit, kg, adet vb.)
$objects[] = FabricHelpers::text([
    'text' => '{{unit}}',
    'left' => $canvasWidth / 2,
    'top' => $contentTop + 460,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 24,
    'fontWeight' => '500',
    'fill' => $colors['text_muted'],
    'textAlign' => 'center',
    'customType' => 'dynamic-text',
    'dynamicField' => 'unit',
    'isDataField' => true,
]);

// 12. Alt bölüm ayırıcı çizgi
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'left',
    'originY' => 'top',
    'left' => 40,
    'top' => $canvasHeight - 180,
    'width' => $canvasWidth - 80,
    'height' => 1,
    'fill' => $colors['divider'],
    'opacity' => 0.5,
    'stroke' => null,
    'strokeWidth' => 0,
    'selectable' => false,
    'evented' => false,
];

// 13. Sol alt - Ürün ID
$objects[] = FabricHelpers::text([
    'text' => 'ID: {{sku}}',
    'left' => 50,
    'top' => $canvasHeight - 140,
    'originX' => 'left',
    'originY' => 'top',
    'fontFamily' => 'Courier New',
    'fontSize' => 20,
    'fontWeight' => '700',
    'fill' => $colors['text_dark'],
    'textAlign' => 'left',
    'customType' => 'dynamic-text',
    'dynamicField' => 'sku',
    'isDataField' => true,
]);

// 14. Sol alt - Stok bilgisi
$objects[] = FabricHelpers::text([
    'text' => 'Stok: {{stock}}',
    'left' => 50,
    'top' => $canvasHeight - 110,
    'originX' => 'left',
    'originY' => 'top',
    'fontFamily' => 'Work Sans',
    'fontSize' => 18,
    'fontWeight' => '400',
    'fill' => $colors['text_muted'],
    'textAlign' => 'left',
    'customType' => 'dynamic-text',
    'dynamicField' => 'stock',
    'isDataField' => true,
]);

// 15. Barkod placeholder
$objects[] = [
    'type' => 'rect',
    'version' => '5.3.0',
    'originX' => 'right',
    'originY' => 'top',
    'left' => $canvasWidth - 50,
    'top' => $canvasHeight - 150,
    'width' => 250,
    'height' => 60,
    'fill' => '#f5f0eb',
    'stroke' => $colors['divider'],
    'strokeWidth' => 1,
    'rx' => 4,
    'ry' => 4,
    'customType' => 'barcode-placeholder',
    'selectable' => true,
    'evented' => true,
];

// 16. Barkod metni
$objects[] = FabricHelpers::text([
    'text' => '{{barcode}}',
    'left' => $canvasWidth - 175,
    'top' => $canvasHeight - 80,
    'originX' => 'center',
    'originY' => 'top',
    'fontFamily' => 'Courier New',
    'fontSize' => 18,
    'fontWeight' => '400',
    'fill' => $colors['text_dark'],
    'textAlign' => 'center',
    'charSpacing' => 150,
    'customType' => 'dynamic-text',
    'dynamicField' => 'barcode',
    'isDataField' => true,
]);

// Tam canvas JSON yapısı
$canvasJson = [
    'version' => '5.3.0',
    'objects' => $objects,
    'background' => $colors['background'],
    'width' => $canvasWidth,
    'height' => $canvasHeight,
];

$designData = json_encode($canvasJson, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

// Şablon verisi
$templateData = [
    'id' => $db->generateUuid(),
    'company_id' => $companyId,
    'name' => 'Artisan Bakery Premium ESL',
    'description' => 'Fırın ve pastane ürünleri için premium ESL etiketi. Büyük ürün görseli, zarif tipografi, minimalist tasarım.',
    'type' => 'label',
    'category' => 'bakery',
    'width' => $canvasWidth,
    'height' => $canvasHeight,
    'orientation' => 'portrait',
    'device_types' => json_encode(['esl']),
    'target_device_type' => 'esl_101_portrait',
    'design_data' => $designData,
    'preview_image' => null,
    'is_default' => 0,
    'status' => 'active',
    'scope' => 'system',
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s'),
];

// Mevcut şablonu kontrol et
$existing = $db->fetch(
    "SELECT id FROM templates WHERE name = ? AND (company_id IS NULL OR company_id = ?)",
    [$templateData['name'], $companyId]
);

if ($existing) {
    // Güncelle
    $db->update('templates', [
        'description' => $templateData['description'],
        'design_data' => $templateData['design_data'],
        'width' => $templateData['width'],
        'height' => $templateData['height'],
        'updated_at' => $templateData['updated_at'],
    ], 'id = ?', [$existing['id']]);
    echo "✓ Güncellendi: {$templateData['name']}\n";
} else {
    // Yeni ekle
    $db->insert('templates', $templateData);
    echo "✓ Oluşturuldu: {$templateData['name']}\n";
}

echo "\n=== İşlem Tamamlandı ===\n";
echo "Şablon: {$templateData['name']}\n";
echo "Boyut: {$canvasWidth}x{$canvasHeight}\n";
echo "Dinamik Alanlar: product_name, category, description, current_price, unit, sku, stock, barcode, image_url\n";
