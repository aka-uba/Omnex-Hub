<?php
/**
 * Örnek Şablon Seed Dosyası
 *
 * Bu dosya, yeni şablonların nasıl oluşturulacağını gösterir.
 * FabricHelpers sınıfı kullanılarak Fabric.js uyumlu şablonlar oluşturulur.
 *
 * Kullanım: php database/seeds/example_template_seed.php
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/helpers/FabricObjectHelpers.php';

$db = Database::getInstance();

echo "=== Örnek Şablon Oluşturuluyor ===\n\n";

// Şirket ID'sini al
$company = $db->fetch("SELECT id FROM companies LIMIT 1");
$companyId = $company ? $company['id'] : null;

// ============================================================
// ÖRNEK 1: Basit Fiyat Etiketi
// ============================================================

$simpleLabel = [
    'version' => '5.3.0',
    'objects' => [
        // 1. Arka plan
        FabricHelpers::rect([
            'left' => 0,
            'top' => 0,
            'width' => 800,
            'height' => 1280,
            'fill' => '#ffffff'
        ]),

        // 2. Üst başlık bandı
        FabricHelpers::rect([
            'left' => 0,
            'top' => 0,
            'width' => 800,
            'height' => 100,
            'fill' => '#228be6'
        ]),

        // 3. Mağaza adı (statik metin)
        FabricHelpers::text([
            'left' => 400,
            'top' => 35,
            'text' => 'ÖRNEK MARKET',
            'fontSize' => 36,
            'fontWeight' => 'bold',
            'fill' => '#ffffff',
            'textAlign' => 'center',
            'originX' => 'center'
        ]),

        // 4. Ürün adı (dinamik)
        FabricHelpers::dynamicText('product_name', [
            'left' => 50,
            'top' => 150,
            'fontSize' => 48,
            'fontWeight' => 'bold',
            'fill' => '#1a1a2e'
        ]),

        // 5. Kategori (dinamik)
        FabricHelpers::dynamicText('category', [
            'left' => 50,
            'top' => 220,
            'fontSize' => 24,
            'fill' => '#666666'
        ]),

        // 6. Ürün görseli placeholder
        FabricHelpers::dynamicImage([
            'left' => 150,
            'top' => 280,
            'width' => 500,
            'height' => 400
        ]),

        // 7. Fiyat çizgisi
        FabricHelpers::line([
            'left' => 50,
            'top' => 720,
            'width' => 700,
            'x2' => 700,
            'stroke' => '#e9ecef',
            'strokeWidth' => 2
        ]),

        // 8. Eski fiyat (üstü çizili)
        FabricHelpers::price('previous_price', [
            'left' => 50,
            'top' => 760,
            'fontSize' => 36,
            'fill' => '#868e96',
            'linethrough' => true
        ]),

        // 9. Güncel fiyat (büyük)
        FabricHelpers::price('current_price', [
            'left' => 50,
            'top' => 820,
            'fontSize' => 120,
            'fontWeight' => 'bold',
            'fill' => '#e63946'
        ]),

        // 10. Birim
        FabricHelpers::dynamicText('unit', [
            'left' => 400,
            'top' => 900,
            'fontSize' => 32,
            'fill' => '#495057'
        ]),

        // 11. Alt bilgi alanı
        FabricHelpers::rect([
            'left' => 0,
            'top' => 1000,
            'width' => 800,
            'height' => 280,
            'fill' => '#f8f9fa'
        ]),

        // 12. Barkod
        FabricHelpers::barcode([
            'left' => 50,
            'top' => 1050,
            'width' => 300,
            'height' => 100
        ]),

        // 13. Menşei
        FabricHelpers::dynamicText('origin', [
            'left' => 400,
            'top' => 1050,
            'fontSize' => 24,
            'fill' => '#495057'
        ]),

        // 14. Raf konumu
        FabricHelpers::dynamicText('shelf_location', [
            'left' => 400,
            'top' => 1100,
            'fontSize' => 24,
            'fill' => '#495057'
        ]),

        // 15. QR Kod (künye için)
        FabricHelpers::qrcode('kunye_no', [
            'left' => 650,
            'top' => 1030,
            'width' => 120,
            'height' => 120
        ])
    ],
    'background' => '#ffffff'
];

// Şablonu veritabanına kaydet
$templateId = $db->generateUuid();
$now = date('Y-m-d H:i:s');

$existingTemplate = $db->fetch(
    "SELECT id FROM templates WHERE name = ? AND scope = 'system'",
    ['Örnek Basit Etiket']
);

if ($existingTemplate) {
    $db->update('templates', [
        'design_data' => json_encode($simpleLabel),
        'updated_at' => $now
    ], 'id = ?', [$existingTemplate['id']]);
    echo "✓ Güncellendi: Örnek Basit Etiket\n";
} else {
    $db->insert('templates', [
        'id' => $templateId,
        'company_id' => $companyId,
        'name' => 'Örnek Basit Etiket',
        'description' => 'FabricHelpers ile oluşturulmuş basit fiyat etiketi',
        'type' => 'label',
        'category' => 'etiket',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'design_data' => json_encode($simpleLabel),
        'preview_image' => '',
        'version' => 1,
        'is_default' => 0,
        'is_public' => 1,
        'status' => 'active',
        'scope' => 'system',
        'is_forked' => 0,
        'is_demo' => 0,
        'target_device_type' => 'esl_101_portrait',
        'background_type' => 'color',
        'background_value' => '#ffffff',
        'created_at' => $now,
        'updated_at' => $now
    ]);
    echo "✓ Oluşturuldu: Örnek Basit Etiket\n";
}

// ============================================================
// ÖRNEK 2: İndirimli Ürün Etiketi (Daire badge ile)
// ============================================================

$discountLabel = [
    'version' => '5.3.0',
    'objects' => [
        // Arka plan
        FabricHelpers::rect([
            'left' => 0,
            'top' => 0,
            'width' => 800,
            'height' => 1280,
            'fill' => '#fff5f5'
        ]),

        // İndirim dairesi
        FabricHelpers::circle([
            'left' => 600,
            'top' => 50,
            'radius' => 80,
            'fill' => '#e63946'
        ]),

        // İndirim yüzdesi
        FabricHelpers::dynamicText('discount_percent', [
            'left' => 680,
            'top' => 100,
            'fontSize' => 36,
            'fontWeight' => 'bold',
            'fill' => '#ffffff',
            'textAlign' => 'center',
            'originX' => 'center',
            'originY' => 'center'
        ]),

        // Ürün adı
        FabricHelpers::dynamicText('product_name', [
            'left' => 50,
            'top' => 200,
            'fontSize' => 56,
            'fontWeight' => 'bold',
            'fill' => '#1a1a2e'
        ]),

        // Fiyat
        FabricHelpers::price('current_price', [
            'left' => 50,
            'top' => 400,
            'fontSize' => 144,
            'fontWeight' => 'bold',
            'fill' => '#e63946'
        ]),

        // TL sembolü
        FabricHelpers::text([
            'left' => 500,
            'top' => 450,
            'text' => '₺',
            'fontSize' => 72,
            'fontWeight' => 'bold',
            'fill' => '#e63946'
        ]),

        // Birim
        FabricHelpers::dynamicText('unit', [
            'left' => 50,
            'top' => 580,
            'fontSize' => 36,
            'fill' => '#495057'
        ]),

        // Kampanya metni
        FabricHelpers::dynamicText('campaign_text', [
            'left' => 50,
            'top' => 700,
            'fontSize' => 32,
            'fontWeight' => 'bold',
            'fill' => '#e63946'
        ]),

        // Barkod
        FabricHelpers::barcode([
            'left' => 250,
            'top' => 1100,
            'width' => 300,
            'height' => 100
        ])
    ],
    'background' => '#fff5f5'
];

$templateId2 = $db->generateUuid();

$existingTemplate2 = $db->fetch(
    "SELECT id FROM templates WHERE name = ? AND scope = 'system'",
    ['Örnek İndirim Etiketi']
);

if ($existingTemplate2) {
    $db->update('templates', [
        'design_data' => json_encode($discountLabel),
        'updated_at' => $now
    ], 'id = ?', [$existingTemplate2['id']]);
    echo "✓ Güncellendi: Örnek İndirim Etiketi\n";
} else {
    $db->insert('templates', [
        'id' => $templateId2,
        'company_id' => $companyId,
        'name' => 'Örnek İndirim Etiketi',
        'description' => 'İndirim badge\'i olan fiyat etiketi',
        'type' => 'label',
        'category' => 'etiket',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'design_data' => json_encode($discountLabel),
        'preview_image' => '',
        'version' => 1,
        'is_default' => 0,
        'is_public' => 1,
        'status' => 'active',
        'scope' => 'system',
        'is_forked' => 0,
        'is_demo' => 0,
        'target_device_type' => 'esl_101_portrait',
        'background_type' => 'color',
        'background_value' => '#fff5f5',
        'created_at' => $now,
        'updated_at' => $now
    ]);
    echo "✓ Oluşturuldu: Örnek İndirim Etiketi\n";
}

echo "\n=== İşlem Tamamlandı ===\n";
echo "Toplam 2 örnek şablon işlendi.\n";
echo "\nKullanım:\n";
echo "1. Şablon editörüne gidin\n";
echo "2. 'Örnek Basit Etiket' veya 'Örnek İndirim Etiketi' şablonlarını açın\n";
echo "3. Düzenleyin ve kaydedin\n";
