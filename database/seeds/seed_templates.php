<?php
/**
 * Template Seed Script
 * Dinamik alanları kullanan örnek şablonları veritabanına ekler
 *
 * Kullanım: php database/seeds/seed_templates.php
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';

$db = Database::getInstance();

// Mevcut company_id ve user_id'yi bul
$company = $db->fetch("SELECT id FROM companies LIMIT 1");
$user = $db->fetch("SELECT id FROM users LIMIT 1");

if (!$company) {
    die("Hata: Veritabanında firma bulunamadı. Önce bir firma oluşturun.\n");
}

$companyId = $company['id'];
$userId = $user ? $user['id'] : null;

echo "Şablonlar ekleniyor...\n";
echo "Company ID: $companyId\n";
echo "User ID: " . ($userId ?: 'null') . "\n\n";

// Template veri dizisi
$templates = [
    [
        'name' => 'Kasap Premium (Koyu)',
        'description' => 'Koyu arka planlı kasap ürünleri için premium etiket şablonu',
        'type' => 'label',
        'category' => 'kasap',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'target_device_type' => 'esl_101_portrait',
        'grid_layout' => 'split-vertical',
        'design_data' => createButcherTemplate()
    ],
    [
        'name' => 'Manav Taze Ürün',
        'description' => 'Yeşil temalı taze meyve/sebze etiketi',
        'type' => 'label',
        'category' => 'manav',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'target_device_type' => 'esl_101_portrait',
        'grid_layout' => 'single',
        'design_data' => createGreengrocerTemplate()
    ],
    [
        'name' => 'Flash İndirim Kampanya',
        'description' => 'Yüksek enerjili flash indirim kampanya şablonu',
        'type' => 'label',
        'category' => 'kampanya',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'target_device_type' => 'esl_101_portrait',
        'grid_layout' => 'split-vertical',
        'design_data' => createFlashSaleTemplate()
    ],
    [
        'name' => 'Organik Minimal',
        'description' => 'Minimalist organik ürün etiketi',
        'type' => 'label',
        'category' => 'organik',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'target_device_type' => 'esl_101_portrait',
        'grid_layout' => 'single',
        'design_data' => createOrganicTemplate()
    ],
    [
        'name' => 'Detaylı Ürün Bilgisi',
        'description' => 'Tüm ürün alanlarını gösteren detaylı etiket',
        'type' => 'label',
        'category' => 'genel',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'target_device_type' => 'esl_101_portrait',
        'grid_layout' => 'header-content-footer',
        'design_data' => createDetailedTemplate()
    ],
    [
        'name' => 'Şarküteri Kampanya (Yatay)',
        'description' => 'Yatay formatta şarküteri kampanya etiketi',
        'type' => 'label',
        'category' => 'sarküteri',
        'width' => 1280,
        'height' => 800,
        'orientation' => 'landscape',
        'target_device_type' => 'esl_101_landscape',
        'grid_layout' => 'split-horizontal',
        'design_data' => createDeliHorizontalTemplate()
    ]
];

$insertedCount = 0;
$skippedCount = 0;

foreach ($templates as $template) {
    // Aynı isimde şablon var mı kontrol et
    $existing = $db->fetch(
        "SELECT id FROM templates WHERE name = ? AND company_id = ?",
        [$template['name'], $companyId]
    );

    if ($existing) {
        echo "Atlandı (mevcut): {$template['name']}\n";
        $skippedCount++;
        continue;
    }

    $id = $db->generateUuid();

    $db->insert('templates', [
        'id' => $id,
        'company_id' => $companyId,
        'name' => $template['name'],
        'description' => $template['description'],
        'type' => $template['type'],
        'category' => $template['category'],
        'width' => $template['width'],
        'height' => $template['height'],
        'orientation' => $template['orientation'],
        'target_device_type' => $template['target_device_type'],
        'grid_layout' => $template['grid_layout'],
        'design_data' => $template['design_data'],
        'status' => 'active',
        'is_public' => 1,
        'created_by' => $userId,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);

    echo "Eklendi: {$template['name']}\n";
    $insertedCount++;
}

echo "\n";
echo "Toplam: " . count($templates) . " şablon\n";
echo "Eklenen: $insertedCount\n";
echo "Atlanan: $skippedCount\n";
echo "\nİşlem tamamlandı!\n";

// ============================================
// TEMPLATE DESIGN DATA FUNCTIONS
// ============================================

/**
 * Kasap Premium Dark Template
 */
function createButcherTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#120808',
        'objects' => [
            // Ürün Görseli Placeholder
            createImagePlaceholder(0, 0, 800, 640, '{{image_url}}'),

            // Kategori Badge
            createRectangle(40, 680, 200, 48, '#ec1313', 24),
            createDynamicText('{{category}}', 70, 692, 24, '#ffffff', 'bold'),

            // Ürün Adı
            createDynamicText('{{product_name}}', 40, 760, 64, '#ffffff', 'bold'),

            // Marka - Üretim Tipi
            createDynamicText('{{brand}} - {{production_type}}', 40, 840, 20, '#b99d9d', 'normal'),

            // Fiyat Ana
            createDynamicText('{{current_price}}', 40, 900, 100, '#FFD700', 'bold'),

            // Birim
            createDynamicText('TL/{{unit}}', 400, 960, 28, '#FFD700', 'normal'),

            // Önceki Fiyat
            createDynamicText('{{previous_price}} TL', 500, 920, 24, '#b99d9d', 'normal'),

            // Menşei
            createDynamicText('{{origin}}', 40, 1050, 18, '#ffffff', 'bold'),
            createText('Yerli Üretim', 40, 1075, 14, '#b99d9d', 'normal'),

            // Stok
            createDynamicText('Stok: {{stock}}', 40, 1120, 16, '#ffffff', 'normal'),

            // Raf Konumu
            createDynamicText('Raf: {{shelf_location}}', 40, 1150, 14, '#b99d9d', 'normal'),

            // Alt Kırmızı Çizgi
            createRectangle(0, 1274, 800, 6, '#ec1313', 0)
        ]
    ];

    return json_encode($canvas);
}

/**
 * Manav Taze Template
 */
function createGreengrocerTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#ffffff',
        'objects' => [
            // Üst Görsel
            createImagePlaceholder(0, 0, 800, 500, '{{image_url}}'),

            // Menşei Badge
            createRectangle(24, 24, 140, 40, '#ffffff', 20),
            createDynamicText('{{origin}}', 50, 34, 12, '#2e7d32', 'bold'),

            // Kategori
            createDynamicText('{{category}}', 400, 540, 14, '#13ec13', 'bold'),

            // Ürün Adı
            createDynamicText('{{product_name}}', 400, 580, 40, '#111811', 'bold'),

            // Üretim Tipi - Marka
            createDynamicText('{{production_type}} - {{brand}}', 400, 640, 16, '#64748b', 'normal'),

            // Fiyat Badge (Yeşil)
            createRectangle(250, 700, 300, 140, '#13ec13', 0),
            createDynamicText('{{current_price}}', 300, 730, 72, '#ffffff', 'bold'),
            createDynamicText('TL', 520, 780, 24, '#ffffff', 'normal'),
            createDynamicText('{{unit}}', 350, 810, 16, '#ffffff', 'bold'),

            // Bilgi Kartı
            createRectangle(40, 880, 720, 200, '#f8fafc', 16),

            // Fiyat Güncelleme
            createText('Fiyat Güncelleme:', 60, 910, 12, '#94a3b8', 'normal'),
            createDynamicText('{{price_updated_at}}', 200, 910, 14, '#111811', 'bold'),

            // KDV Oranı
            createText('KDV Oranı:', 60, 950, 12, '#94a3b8', 'normal'),
            createDynamicText('%{{vat_rate}}', 200, 950, 14, '#111811', 'bold'),

            // Raf Konumu
            createText('Raf Konumu:', 60, 990, 12, '#94a3b8', 'normal'),
            createDynamicText('{{shelf_location}}', 200, 990, 14, '#111811', 'bold'),

            // Barkod
            createDynamicText('{{barcode}}', 400, 1150, 14, '#64748b', 'normal'),

            // KDV Notu
            createText('Fiyatlarımıza KDV Dahildir', 400, 1200, 12, '#94a3b8', 'normal')
        ]
    ];

    return json_encode($canvas);
}

/**
 * Flash Sale Template
 */
function createFlashSaleTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#181111',
        'objects' => [
            // Arka Plan Görsel
            createImagePlaceholder(0, 0, 800, 1280, '{{image_url}}'),

            // Flash Banner
            createRectangle(-50, 80, 900, 80, '#ec1313', 0),
            createDynamicText('{{campaign_text}}', 200, 100, 48, '#ffffff', 'bold'),

            // İndirim Badge
            createRectangle(550, 400, 180, 60, '#facc15', 30),
            createDynamicText('%{{discount_percent}} İNDİRİM', 570, 418, 18, '#181111', 'bold'),

            // Stok Bilgisi
            createDynamicText('Sınırlı Stok: {{stock}} Adet', 40, 700, 16, '#b99d9d', 'bold'),

            // Ürün Adı
            createDynamicText('{{product_name}}', 40, 740, 32, '#ffffff', 'bold'),

            // Eski Fiyat
            createText('Eski Fiyat', 40, 850, 14, '#facc15', 'bold'),
            createDynamicText('{{previous_price}} TL', 40, 880, 28, 'rgba(255,255,255,0.5)', 'normal'),

            // Yeni Fiyat
            createText('Yeni Fiyat', 450, 850, 14, '#ec1313', 'bold'),
            createDynamicText('{{current_price}}', 450, 880, 64, '#ffffff', 'bold'),
            createText('TL', 700, 920, 24, '#ffffff', 'normal'),

            // Kategori - Marka
            createDynamicText('{{category}} - {{brand}}', 40, 1020, 18, '#ffffff', 'normal'),

            // Geçerlilik
            createText('Son Geçerlilik:', 40, 1060, 14, '#b99d9d', 'normal'),
            createDynamicText('{{price_valid_until}}', 180, 1060, 14, '#ffffff', 'bold'),

            // Aksiyon Butonu
            createRectangle(200, 1150, 400, 60, '#ec1313', 30),
            createText('İNDİRİMİ YAKALA', 300, 1170, 18, '#ffffff', 'bold')
        ]
    ];

    return json_encode($canvas);
}

/**
 * Organic Minimal Template
 */
function createOrganicTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#f6f8f6',
        'objects' => [
            // Header
            createRectangle(0, 0, 800, 80, '#ffffff', 0),
            createDynamicText('{{company_name}}', 100, 28, 18, '#111711', 'bold'),
            createDynamicText('SKU: {{sku}}', 600, 32, 12, '#648764', 'normal'),

            // Ürün Görseli (Dairesel)
            createCircle(400, 280, 150, '#4ce64c', 0.1),
            createImagePlaceholder(250, 130, 300, 300, '{{image_url}}'),

            // Ürün Adı
            createDynamicText('{{product_name}}', 400, 480, 32, '#111711', 'bold'),

            // Kategori - Marka
            createDynamicText('{{category}} - {{brand}}', 400, 530, 16, '#648764', 'normal'),

            // Özellik Kartları
            // Üretim Tipi
            createRectangle(50, 580, 220, 100, '#f6f8f6', 12),
            createDynamicText('{{production_type}}', 100, 620, 14, '#111711', 'bold'),
            createText('Sertifikalı', 100, 650, 10, '#648764', 'normal'),

            // Menşei
            createRectangle(290, 580, 220, 100, '#f6f8f6', 12),
            createDynamicText('{{origin}}', 340, 620, 14, '#111711', 'bold'),
            createText('Menşei', 340, 650, 10, '#648764', 'normal'),

            // Stok
            createRectangle(530, 580, 220, 100, '#f6f8f6', 12),
            createDynamicText('{{stock}} Adet', 580, 620, 14, '#111711', 'bold'),
            createText('Stok', 580, 650, 10, '#648764', 'normal'),

            // Detay Satırı
            createDynamicText('{{weight}} / {{unit}}', 150, 720, 14, '#648764', 'normal'),
            createDynamicText('KDV: %{{vat_rate}}', 400, 720, 14, '#648764', 'normal'),
            createDynamicText('Raf: {{shelf_location}}', 600, 720, 14, '#648764', 'normal'),

            // Fiyat Bubble
            createRectangle(250, 780, 300, 100, 'rgba(76,230,76,0.15)', 50),
            createDynamicText('{{current_price}}', 320, 810, 48, '#111711', 'bold'),
            createText('TL', 520, 830, 20, '#648764', 'normal'),

            // Footer
            createRectangle(0, 920, 800, 360, '#f6f8f6', 0),
            createText('Ürün Detayları', 100, 960, 16, '#111711', 'bold'),
            createDynamicText('{{description}}', 100, 1000, 13, '#648764', 'normal')
        ]
    ];

    return json_encode($canvas);
}

/**
 * Detailed Product Info Template
 */
function createDetailedTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#f8fafc',
        'objects' => [
            // Header
            createRectangle(0, 0, 800, 60, '#1e3a5f', 0),
            createDynamicText('{{company_name}}', 30, 18, 16, '#ffffff', 'bold'),
            createDynamicText('{{date_today}}', 650, 22, 12, 'rgba(255,255,255,0.8)', 'normal'),

            // Kampanya Banner
            createRectangle(0, 60, 800, 40, '#ef4444', 0),
            createDynamicText('{{campaign_text}}', 350, 72, 14, '#ffffff', 'bold'),

            // Ürün Görseli
            createImagePlaceholder(0, 100, 800, 350, '{{image_url}}'),

            // Kategori Badge
            createRectangle(20, 120, 200, 36, 'rgba(255,255,255,0.95)', 18),
            createDynamicText('{{category}} / {{subcategory}}', 40, 130, 12, '#1e3a5f', 'bold'),

            // Ürün Bilgileri
            createDynamicText('{{product_name}}', 30, 480, 28, '#1e293b', 'bold'),
            createDynamicText('{{brand}} | {{origin}} | {{production_type}}', 30, 520, 14, '#64748b', 'normal'),

            // Fiyat Kartı
            createRectangle(30, 560, 740, 120, '#1e3a5f', 16),
            createText('Satış Fiyatı', 60, 580, 12, 'rgba(255,255,255,0.7)', 'normal'),
            createDynamicText('{{current_price}}', 60, 610, 52, '#ffffff', 'bold'),
            createDynamicText('TL/{{unit}}', 280, 640, 16, 'rgba(255,255,255,0.8)', 'normal'),

            // Önceki Fiyat
            createText('Önceki Fiyat', 550, 580, 10, 'rgba(255,255,255,0.5)', 'normal'),
            createDynamicText('{{previous_price}} TL', 550, 600, 18, 'rgba(255,255,255,0.6)', 'normal'),

            // İndirim Badge
            createRectangle(550, 630, 180, 36, '#ef4444', 18),
            createDynamicText('%{{discount_percent}} İNDİRİM', 580, 640, 14, '#ffffff', 'bold'),

            // Bilgi Grid
            // SKU
            createRectangle(30, 700, 360, 70, '#f8fafc', 12),
            createText('SKU / Kod', 50, 720, 11, '#94a3b8', 'normal'),
            createDynamicText('{{sku}}', 50, 740, 14, '#1e293b', 'bold'),

            // Ağırlık
            createRectangle(410, 700, 360, 70, '#f8fafc', 12),
            createText('Ağırlık', 430, 720, 11, '#94a3b8', 'normal'),
            createDynamicText('{{weight}}', 430, 740, 14, '#1e293b', 'bold'),

            // Stok
            createRectangle(30, 780, 360, 70, '#f8fafc', 12),
            createText('Stok Miktarı', 50, 800, 11, '#94a3b8', 'normal'),
            createDynamicText('{{stock}} Adet', 50, 820, 14, '#1e293b', 'bold'),

            // Raf Konumu
            createRectangle(410, 780, 360, 70, '#f8fafc', 12),
            createText('Raf Konumu', 430, 800, 11, '#94a3b8', 'normal'),
            createDynamicText('{{shelf_location}}', 430, 820, 14, '#1e293b', 'bold'),

            // KDV Oranı
            createRectangle(30, 860, 360, 70, '#f8fafc', 12),
            createText('KDV Oranı', 50, 880, 11, '#94a3b8', 'normal'),
            createDynamicText('%{{vat_rate}}', 50, 900, 14, '#1e293b', 'bold'),

            // Tedarikçi
            createRectangle(410, 860, 360, 70, '#f8fafc', 12),
            createText('Tedarikçi', 430, 880, 11, '#94a3b8', 'normal'),
            createDynamicText('{{supplier_code}}', 430, 900, 14, '#1e293b', 'bold'),

            // Açıklama
            createRectangle(30, 950, 740, 100, '#fffbeb', 12),
            createText('Ürün Açıklaması', 50, 970, 12, '#d97706', 'bold'),
            createDynamicText('{{description}}', 50, 1000, 12, '#78716c', 'normal'),

            // Footer
            createRectangle(0, 1080, 800, 200, '#f8fafc', 0),
            createDynamicText('{{barcode}}', 50, 1120, 12, '#64748b', 'normal'),

            // Meta Bilgiler
            createText('Künye:', 550, 1100, 10, '#94a3b8', 'normal'),
            createDynamicText('{{kunye_no}}', 600, 1100, 10, '#64748b', 'bold'),

            createText('Güncelleme:', 550, 1120, 10, '#94a3b8', 'normal'),
            createDynamicText('{{price_updated_at}}', 620, 1120, 10, '#64748b', 'bold'),

            createText('Geçerlilik:', 550, 1140, 10, '#94a3b8', 'normal'),
            createDynamicText('{{price_valid_until}}', 610, 1140, 10, '#64748b', 'bold')
        ]
    ];

    return json_encode($canvas);
}

/**
 * Deli Horizontal Template
 */
function createDeliHorizontalTemplate() {
    $canvas = [
        'version' => '5.3.0',
        'background' => '#ffffff',
        'objects' => [
            // Üst Banner
            createRectangle(0, 0, 1280, 80, '#D32F2F', 0),
            createDynamicText('{{campaign_text}}', 500, 24, 40, '#ffffff', 'bold'),

            // Sol - Ürün Görseli
            createImagePlaceholder(0, 80, 550, 720, '{{image_url}}'),

            // Sağ Panel
            // Ürün Adı
            createDynamicText('{{product_name}}', 600, 120, 36, '#1e293b', 'bold'),

            // Stok Badge
            createRectangle(1050, 100, 180, 60, '#fef2f2', 12),
            createDynamicText('Son {{stock}} Adet', 1080, 120, 12, '#D32F2F', 'bold'),

            // Marka - Üretim Tipi
            createDynamicText('{{brand}} - {{production_type}}', 600, 180, 16, '#64748b', 'normal'),

            // Info Pills
            createRectangle(600, 230, 120, 36, '#f1f5f9', 18),
            createDynamicText('{{origin}}', 630, 240, 12, '#475569', 'bold'),

            createRectangle(740, 230, 120, 36, '#f1f5f9', 18),
            createDynamicText('{{category}}', 760, 240, 12, '#475569', 'normal'),

            createRectangle(880, 230, 180, 36, '#f1f5f9', 18),
            createDynamicText('Raf: {{shelf_location}}', 900, 240, 12, '#475569', 'normal'),

            // Fiyat Kartı
            createRectangle(600, 320, 620, 200, '#f8fafc', 20),

            // Birim Bilgisi
            createText('Birim Fiyatı', 640, 360, 12, '#94a3b8', 'normal'),
            createDynamicText('{{weight}} / {{unit}}', 640, 400, 14, '#1e293b', 'bold'),

            // Ana Fiyat
            createDynamicText('{{current_price}}', 950, 360, 72, '#1e293b', 'bold'),
            createText('TL', 1150, 420, 24, '#64748b', 'normal'),

            // Footer
            createRectangle(600, 560, 620, 1, '#f1f5f9', 0),

            // Mağaza Bilgisi
            createCircle(640, 620, 24, '#1e293b', 1),
            createDynamicText('{{company_name}}', 690, 608, 14, '#1e293b', 'bold'),
            createText('Market', 690, 630, 10, '#94a3b8', 'normal')
        ]
    ];

    return json_encode($canvas);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function createText($text, $left, $top, $fontSize, $fill, $fontWeight = 'normal') {
    return [
        'type' => 'i-text',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => $left,
        'top' => $top,
        'width' => 400,
        'height' => $fontSize * 1.5,
        'fill' => $fill,
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'text' => $text,
        'fontSize' => $fontSize,
        'fontWeight' => $fontWeight,
        'fontFamily' => 'Inter, sans-serif',
        'fontStyle' => 'normal',
        'lineHeight' => 1.16,
        'underline' => false,
        'overline' => false,
        'linethrough' => false,
        'textAlign' => 'left',
        'textBackgroundColor' => '',
        'charSpacing' => 0,
        'styles' => [],
        'direction' => 'ltr',
        'path' => null,
        'pathStartOffset' => 0,
        'pathSide' => 'left',
        'pathAlign' => 'baseline',
        'customType' => 'text',
        'isDataField' => false
    ];
}

function createDynamicText($placeholder, $left, $top, $fontSize, $fill, $fontWeight = 'normal') {
    // Placeholder'dan field adını çıkar
    preg_match('/\{\{([a-z_]+)\}\}/i', $placeholder, $matches);
    $fieldName = $matches[1] ?? '';

    return [
        'type' => 'i-text',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => $left,
        'top' => $top,
        'width' => 400,
        'height' => $fontSize * 1.5,
        'fill' => $fill,
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'text' => $placeholder,
        'fontSize' => $fontSize,
        'fontWeight' => $fontWeight,
        'fontFamily' => 'Inter, sans-serif',
        'fontStyle' => 'normal',
        'lineHeight' => 1.16,
        'underline' => false,
        'overline' => false,
        'linethrough' => false,
        'textAlign' => 'left',
        'textBackgroundColor' => '',
        'charSpacing' => 0,
        'styles' => [],
        'direction' => 'ltr',
        'path' => null,
        'pathStartOffset' => 0,
        'pathSide' => 'left',
        'pathAlign' => 'baseline',
        'customType' => 'dynamic-text',
        'isDataField' => true,
        'dynamicField' => $fieldName
    ];
}

function createRectangle($left, $top, $width, $height, $fill, $rx = 0) {
    return [
        'type' => 'rect',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => $left,
        'top' => $top,
        'width' => $width,
        'height' => $height,
        'fill' => $fill,
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'rx' => $rx,
        'ry' => $rx,
        'customType' => 'shape',
        'isDataField' => false
    ];
}

function createCircle($left, $top, $radius, $fill, $opacity = 1) {
    return [
        'type' => 'circle',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => $left - $radius,
        'top' => $top - $radius,
        'width' => $radius * 2,
        'height' => $radius * 2,
        'fill' => $fill,
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => $opacity,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'radius' => $radius,
        'startAngle' => 0,
        'endAngle' => 360,
        'customType' => 'shape',
        'isDataField' => false
    ];
}

function createImagePlaceholder($left, $top, $width, $height, $placeholder) {
    preg_match('/\{\{([a-z_]+)\}\}/i', $placeholder, $matches);
    $fieldName = $matches[1] ?? 'image_url';

    return [
        'type' => 'image',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => $left,
        'top' => $top,
        'width' => $width,
        'height' => $height,
        'fill' => 'rgb(0,0,0)',
        'stroke' => null,
        'strokeWidth' => 0,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'cropX' => 0,
        'cropY' => 0,
        'customType' => 'dynamic-image',
        'isDataField' => true,
        'dynamicField' => $fieldName,
        'src' => ''
    ];
}
