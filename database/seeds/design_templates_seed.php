<?php
/**
 * Design Templates Seed
 * Tasarım klasöründeki şablonları veritabanına ekler
 *
 * Kullanım: php database/seeds/design_templates_seed.php
 */

require_once __DIR__ . '/../../config.php';

$db = Database::getInstance();

echo "=== Tasarım Şablonları Yükleniyor ===\n\n";

// Şirket ID'sini al (varsayılan sistem şablonları için null, ilk şirket için ID)
$company = $db->fetch("SELECT id FROM companies LIMIT 1");
$companyId = $company ? $company['id'] : null;

// Fabric.js text elemanları için varsayılan özellikler
if (!function_exists('createTextObject')) {
    function createTextObject($props) {
        $defaults = [
            'type' => 'i-text',
            'version' => '5.3.0',
            'originX' => 'left',
            'originY' => 'top',
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0,
            'fontStyle' => 'normal',
            'textAlign' => 'left',
            'underline' => false,
            'overline' => false,
            'linethrough' => false,
            'direction' => 'ltr',
            'charSpacing' => 0,
            'lineHeight' => 1.16,
            'styles' => []
        ];

        return array_merge($defaults, $props);
    }
}

// Fabric.js rect elemanları için varsayılan özellikler
if (!function_exists('createRectObject')) {
    function createRectObject($props) {
        $defaults = [
            'type' => 'rect',
            'version' => '5.3.0',
            'originX' => 'left',
            'originY' => 'top',
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0,
            'rx' => 0,
            'ry' => 0
        ];

        return array_merge($defaults, $props);
    }
}

// Fabric.js circle elemanları için varsayılan özellikler
if (!function_exists('createCircleObject')) {
    function createCircleObject($props) {
        $defaults = [
            'type' => 'circle',
            'version' => '5.3.0',
            'originX' => 'left',
            'originY' => 'top',
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0
        ];

        return array_merge($defaults, $props);
    }
}

// Fabric.js line elemanları için varsayılan özellikler
if (!function_exists('createLineObject')) {
    function createLineObject($props) {
        $defaults = [
            'type' => 'line',
            'version' => '5.3.0',
            'originX' => 'left',
            'originY' => 'top',
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0
        ];

        return array_merge($defaults, $props);
    }
}

// Fabric.js image elemanları için varsayılan özellikler
if (!function_exists('createImageObject')) {
    function createImageObject($props) {
        $defaults = [
            'type' => 'image',
            'version' => '5.3.0',
            'originX' => 'left',
            'originY' => 'top',
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0,
            'cropX' => 0,
            'cropY' => 0,
            'src' => ''
        ];

        return array_merge($defaults, $props);
    }
}

// ============================================================================
// 1. ORGANIC PRODUCE ESL DESIGN - Organik Manav Etiketi
// ============================================================================
$organicProduceTemplate = [
    'id' => $db->generateUuid(),
    'company_id' => $companyId,
    'name' => 'Organik Manav Etiketi',
    'description' => '10.1" dikey ESL için organik meyve/sebze etiketi. Ürün görseli, QR künye, indirim rozeti ve raf konumu içerir.',
    'type' => 'label',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'design_data' => json_encode([
        'version' => '5.3.0',
        'objects' => [
            // Arka plan - beyaz
            createRectObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#ffffff',
                'selectable' => false,
                'evented' => false,
                'isBackground' => true
            ]),
            // Üst bölüm - Ürün görseli alanı (40%)
            createRectObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 512,
                'fill' => '#1a1a1a',
                'selectable' => true
            ]),
            // Ürün görseli placeholder
            createImageObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 512,
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ]),
            // İndirim rozeti - sarı daire
            createCircleObject([
                'left' => 660,
                'top' => 420,
                'radius' => 55,
                'fill' => '#fab005',
                'stroke' => '#ffffff',
                'strokeWidth' => 4,
                'angle' => 12
            ]),
            // İndirim yüzdesi
            createTextObject([
                'left' => 715,
                'top' => 455,
                'originX' => 'center',
                'originY' => 'center',
                'text' => '{{discount_percent}}',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#000000',
                'angle' => 12,
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ]),
            // "SAVE" yazısı
            createTextObject([
                'left' => 715,
                'top' => 485,
                'originX' => 'center',
                'originY' => 'center',
                'text' => 'SAVE',
                'fontSize' => 11,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#000000',
                'angle' => 12
            ]),
            // Alt bölüm - Beyaz arka plan
            createRectObject([
                'left' => 0,
                'top' => 512,
                'width' => 800,
                'height' => 768,
                'fill' => '#ffffff'
            ]),
            // Ürün adı - koyu yeşil
            createTextObject([
                'left' => 48,
                'top' => 560,
                'text' => '{{product_name}}',
                'fontSize' => 52,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#2b8a3e',
                'lineHeight' => 1.1,
                'dynamicField' => 'product_name',
                'isDataField' => true
            ]),
            // Fiyat - siyah, büyük
            createTextObject([
                'left' => 48,
                'top' => 720,
                'text' => '{{current_price}}',
                'fontSize' => 96,
                'fontWeight' => '900',
                'fontFamily' => 'Work Sans',
                'fill' => '#000000',
                'customType' => 'price',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ]),
            // Birim (per lb / per kg)
            createTextObject([
                'left' => 55,
                'top' => 830,
                'text' => 'per {{unit}}',
                'fontSize' => 22,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'dynamicField' => 'unit',
                'isDataField' => true
            ]),
            // QR Kod - künye için
            createRectObject([
                'left' => 520,
                'top' => 700,
                'width' => 116,
                'height' => 116,
                'fill' => '#ffffff',
                'stroke' => 'rgba(43,136,61,0.1)',
                'strokeWidth' => 2,
                'rx' => 8,
                'ry' => 8
            ]),
            createImageObject([
                'left' => 528,
                'top' => 708,
                'width' => 100,
                'height' => 100,
                'customType' => 'qrcode',
                'dynamicField' => 'kunye_no',
                'qrValue' => '{{kunye_no}}',
                'isDataField' => true
            ]),
            // "SCAN ORIGIN" yazısı
            createTextObject([
                'left' => 578,
                'top' => 830,
                'originX' => 'center',
                'text' => 'SCAN ORIGIN',
                'fontSize' => 11,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#2b8a3e',
                'charSpacing' => 50
            ]),
            // Alt ayırıcı çizgi
            createLineObject([
                'left' => 0,
                'top' => 930,
                'x1' => 0,
                'y1' => 0,
                'x2' => 800,
                'y2' => 0,
                'stroke' => '#f3f4f6',
                'strokeWidth' => 2
            ]),
            // Organik rozet - sol alt
            createRectObject([
                'left' => 48,
                'top' => 980,
                'width' => 160,
                'height' => 48,
                'fill' => 'rgba(43,136,61,0.1)',
                'rx' => 8,
                'ry' => 8
            ]),
            // Organik ikonu placeholder (yaprak)
            createTextObject([
                'left' => 68,
                'top' => 992,
                'text' => '🌿',
                'fontSize' => 22
            ]),
            // Organik yazısı
            createTextObject([
                'left' => 100,
                'top' => 994,
                'text' => '{{production_type}}',
                'fontSize' => 22,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#2b8a3e',
                'dynamicField' => 'production_type',
                'isDataField' => true
            ]),
            // Raf konumu - sağ alt
            createTextObject([
                'left' => 620,
                'top' => 968,
                'text' => 'LOCATION',
                'fontSize' => 12,
                'fontWeight' => '600',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'charSpacing' => 80
            ]),
            createTextObject([
                'left' => 565,
                'top' => 995,
                'text' => '{{shelf_location}}',
                'fontSize' => 20,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#1f2937',
                'dynamicField' => 'shelf_location',
                'isDataField' => true
            ])
        ],
        'background' => '#ffffff'
    ], JSON_UNESCAPED_UNICODE),
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
];

// ============================================================================
// 2. PREMIUM BUTCHERY ESL DESIGN - Premium Kasap Etiketi
// ============================================================================
$premiumButcheryTemplate = [
    'id' => $db->generateUuid(),
    'company_id' => $companyId,
    'name' => 'Premium Kasap Etiketi',
    'description' => '10.1" dikey ESL için premium et ürünleri etiketi. Koyu tema, video placeholder, menşei bilgisi ve saklama koşulları içerir.',
    'type' => 'label',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'design_data' => json_encode([
        'version' => '5.3.0',
        'objects' => [
            // Tam ekran koyu arka plan
            createRectObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#111111',
                'selectable' => false,
                'evented' => false,
                'isBackground' => true
            ]),
            // Üst bölüm - Video/Görsel alanı (50%)
            createRectObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 640,
                'fill' => '#0a0a0a'
            ]),
            // Ürün görseli
            createImageObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 640,
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ]),
            // Play butonu placeholder (video için)
            createCircleObject([
                'left' => 360,
                'top' => 280,
                'radius' => 40,
                'fill' => 'rgba(255,255,255,0.15)',
                'stroke' => 'rgba(255,255,255,0.3)',
                'strokeWidth' => 2
            ]),
            // Play ikonu (üçgen)
            createTextObject([
                'left' => 400,
                'top' => 320,
                'originX' => 'center',
                'originY' => 'center',
                'text' => '▶',
                'fontSize' => 36,
                'fill' => '#ffffff'
            ]),
            // Premium rozet - sağ üst
            createRectObject([
                'left' => 580,
                'top' => 48,
                'width' => 172,
                'height' => 36,
                'fill' => 'rgba(225,51,51,0.9)',
                'rx' => 18,
                'ry' => 18
            ]),
            createTextObject([
                'left' => 610,
                'top' => 55,
                'text' => 'PREMIUM CUT',
                'fontSize' => 13,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#ffffff',
                'charSpacing' => 100
            ]),
            // Alt info kartı - koyu gri, yuvarlatılmış üst
            createRectObject([
                'left' => 0,
                'top' => 600,
                'width' => 800,
                'height' => 680,
                'fill' => '#1a1a1a',
                'rx' => 32,
                'ry' => 32
            ]),
            // Dekoratif çizgi (üst orta)
            createRectObject([
                'left' => 368,
                'top' => 624,
                'width' => 64,
                'height' => 6,
                'fill' => 'rgba(255,255,255,0.1)',
                'rx' => 3,
                'ry' => 3
            ]),
            // Ürün adı - büyük beyaz
            createTextObject([
                'left' => 64,
                'top' => 680,
                'text' => '{{product_name}}',
                'fontSize' => 52,
                'fontWeight' => '800',
                'fontFamily' => 'Work Sans',
                'fill' => '#ffffff',
                'lineHeight' => 1.1,
                'dynamicField' => 'product_name',
                'isDataField' => true
            ]),
            // Menşei rozeti
            createRectObject([
                'left' => 64,
                'top' => 800,
                'width' => 200,
                'height' => 40,
                'fill' => '#2d2d2d',
                'stroke' => 'rgba(255,255,255,0.05)',
                'strokeWidth' => 1,
                'rx' => 8,
                'ry' => 8
            ]),
            // Bayrak ikonu placeholder
            createTextObject([
                'left' => 80,
                'top' => 810,
                'text' => '🇹🇷',
                'fontSize' => 18
            ]),
            // Menşei yazısı
            createTextObject([
                'left' => 115,
                'top' => 810,
                'text' => 'Origin: {{origin}}',
                'fontSize' => 18,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#d1d5db',
                'dynamicField' => 'origin',
                'isDataField' => true
            ]),
            // Ayırıcı nokta
            createCircleObject([
                'left' => 288,
                'top' => 814,
                'radius' => 4,
                'fill' => '#4b5563'
            ]),
            // Üretim tipi (Grass Fed vb.)
            createTextObject([
                'left' => 310,
                'top' => 810,
                'text' => '{{production_type}}',
                'fontSize' => 18,
                'fontWeight' => '400',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'dynamicField' => 'production_type',
                'isDataField' => true
            ]),
            // Ayırıcı çizgi
            createLineObject([
                'left' => 64,
                'top' => 870,
                'x1' => 0,
                'y1' => 0,
                'x2' => 672,
                'y2' => 0,
                'stroke' => 'rgba(255,255,255,0.1)',
                'strokeWidth' => 1
            ]),
            // Para birimi - küçük kırmızı
            createTextObject([
                'left' => 64,
                'top' => 920,
                'text' => '₺',
                'fontSize' => 40,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#e13333'
            ]),
            // Fiyat - devasa kırmızı
            createTextObject([
                'left' => 110,
                'top' => 885,
                'text' => '{{current_price}}',
                'fontSize' => 120,
                'fontWeight' => '900',
                'fontFamily' => 'Work Sans',
                'fill' => '#e13333',
                'customType' => 'price',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ]),
            // Birim
            createTextObject([
                'left' => 520,
                'top' => 965,
                'text' => 'per {{unit}}',
                'fontSize' => 22,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#6b7280',
                'dynamicField' => 'unit',
                'isDataField' => true
            ]),
            // Saklama bilgisi ikonu
            createTextObject([
                'left' => 64,
                'top' => 1050,
                'text' => '🌡️',
                'fontSize' => 24
            ]),
            // Saklama bilgisi
            createTextObject([
                'left' => 105,
                'top' => 1052,
                'text' => '{{storage_info}}',
                'fontSize' => 20,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'dynamicField' => 'storage_info',
                'isDataField' => true
            ]),
            // Barkod alanı - beyaz arka plan
            createRectObject([
                'left' => 64,
                'top' => 1110,
                'width' => 672,
                'height' => 90,
                'fill' => '#ffffff',
                'rx' => 8,
                'ry' => 8
            ]),
            // Barkod
            createImageObject([
                'left' => 80,
                'top' => 1125,
                'width' => 450,
                'height' => 60,
                'customType' => 'barcode',
                'dynamicField' => 'barcode',
                'barcodeFormat' => 'EAN13',
                'barcodeValue' => '{{barcode}}',
                'isDataField' => true
            ]),
            // SKU
            createTextObject([
                'left' => 560,
                'top' => 1145,
                'text' => '{{sku}}',
                'fontSize' => 14,
                'fontWeight' => 'bold',
                'fontFamily' => 'Courier New',
                'fill' => '#000000',
                'charSpacing' => 100,
                'dynamicField' => 'sku',
                'isDataField' => true
            ])
        ],
        'background' => '#111111'
    ], JSON_UNESCAPED_UNICODE),
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
];

// ============================================================================
// 3. MULTI-PRODUCT PANTRY ESL DESIGN - Çoklu Ürün Kiler Etiketi
// ============================================================================
$multiProductPantryTemplate = [
    'id' => $db->generateUuid(),
    'company_id' => $companyId,
    'name' => 'Çoklu Ürün Kiler Etiketi',
    'description' => '10.1" dikey ESL için 2 ürün gösterimi. Kiler/market reyonu için ideal. Her slot\'ta ürün adı, fiyat, barkod ve ürün görseli.',
    'type' => 'label',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'design_data' => json_encode([
        'version' => '5.3.0',
        'objects' => [
            // Ana arka plan - açık gri
            createRectObject([
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#f6f8f8',
                'selectable' => false,
                'evented' => false,
                'isBackground' => true
            ]),

            // ===== SLOT 1 (ÜST) =====
            // Slot 1 arka plan kartı
            createRectObject([
                'left' => 32,
                'top' => 48,
                'width' => 736,
                'height' => 540,
                'fill' => '#f8f9fa',
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1,
                'rx' => 16,
                'ry' => 16,
                'isSlotBackground' => true,
                'slotId' => 1
            ]),
            // Slot 1 - Kategori ikonu daire
            createCircleObject([
                'left' => 64,
                'top' => 88,
                'radius' => 20,
                'fill' => 'rgba(19,157,195,0.1)',
                'slotId' => 1
            ]),
            // Slot 1 - Kategori ikonu
            createTextObject([
                'left' => 74,
                'top' => 98,
                'text' => '🌾',
                'fontSize' => 18,
                'slotId' => 1
            ]),
            // Slot 1 - Ürün adı
            createTextObject([
                'left' => 64,
                'top' => 148,
                'text' => '{{product_name}}',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#1f2937',
                'lineHeight' => 1.2,
                'dynamicField' => 'product_name',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Ağırlık/Birim
            createTextObject([
                'left' => 64,
                'top' => 198,
                'text' => '{{weight}}',
                'fontSize' => 20,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#6b7280',
                'dynamicField' => 'weight',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Ürün görseli
            createRectObject([
                'left' => 568,
                'top' => 88,
                'width' => 160,
                'height' => 160,
                'fill' => '#ffffff',
                'stroke' => '#f3f4f6',
                'strokeWidth' => 1,
                'rx' => 12,
                'ry' => 12,
                'slotId' => 1
            ]),
            createImageObject([
                'left' => 576,
                'top' => 96,
                'width' => 144,
                'height' => 144,
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Para birimi
            createTextObject([
                'left' => 64,
                'top' => 290,
                'text' => '₺',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#139dc3',
                'slotId' => 1
            ]),
            // Slot 1 - Fiyat tam kısım
            createTextObject([
                'left' => 100,
                'top' => 265,
                'text' => '{{current_price}}',
                'fontSize' => 80,
                'fontWeight' => '800',
                'fontFamily' => 'Work Sans',
                'fill' => '#139dc3',
                'customType' => 'price',
                'dynamicField' => 'current_price',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Eski fiyat (üstü çizili)
            createTextObject([
                'left' => 540,
                'top' => 280,
                'text' => '{{previous_price}}',
                'fontSize' => 16,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'linethrough' => true,
                'dynamicField' => 'previous_price',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Tasarruf rozeti
            createRectObject([
                'left' => 540,
                'top' => 310,
                'width' => 120,
                'height' => 28,
                'fill' => '#fef2f2',
                'rx' => 4,
                'ry' => 4,
                'slotId' => 1
            ]),
            createTextObject([
                'left' => 552,
                'top' => 316,
                'text' => 'SAVE {{discount_percent}}',
                'fontSize' => 12,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#ef4444',
                'dynamicField' => 'discount_percent',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Ayırıcı çizgi
            createLineObject([
                'left' => 64,
                'top' => 390,
                'x1' => 0,
                'y1' => 0,
                'x2' => 672,
                'y2' => 0,
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1,
                'slotId' => 1
            ]),
            // Slot 1 - SKU
            createTextObject([
                'left' => 64,
                'top' => 418,
                'text' => 'SKU {{sku}}',
                'fontSize' => 11,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'charSpacing' => 100,
                'dynamicField' => 'sku',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - Barkod
            createImageObject([
                'left' => 64,
                'top' => 450,
                'width' => 220,
                'height' => 55,
                'customType' => 'barcode',
                'dynamicField' => 'barcode',
                'barcodeFormat' => 'EAN13',
                'barcodeValue' => '{{barcode}}',
                'isDataField' => true,
                'slotId' => 1,
                'inMultiFrame' => true
            ]),
            // Slot 1 - QR kod placeholder
            createTextObject([
                'left' => 700,
                'top' => 450,
                'text' => '📱',
                'fontSize' => 28,
                'fill' => '#d1d5db',
                'slotId' => 1
            ]),
            // Slot 1 - Dekoratif çubuk (sağ kenar)
            createRectObject([
                'left' => 762,
                'top' => 120,
                'width' => 6,
                'height' => 80,
                'fill' => '#139dc3',
                'rx' => 3,
                'ry' => 3,
                'slotId' => 1
            ]),

            // ===== AYIRICI =====
            createLineObject([
                'left' => 64,
                'top' => 620,
                'x1' => 0,
                'y1' => 0,
                'x2' => 672,
                'y2' => 0,
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1
            ]),
            createTextObject([
                'left' => 390,
                'top' => 608,
                'originX' => 'center',
                'text' => '•••',
                'fontSize' => 14,
                'fill' => '#d1d5db'
            ]),

            // ===== SLOT 2 (ALT) =====
            // Slot 2 arka plan kartı
            createRectObject([
                'left' => 32,
                'top' => 660,
                'width' => 736,
                'height' => 540,
                'fill' => '#f8f9fa',
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1,
                'rx' => 16,
                'ry' => 16,
                'isSlotBackground' => true,
                'slotId' => 2
            ]),
            // Slot 2 - Kategori ikonu daire (turuncu)
            createCircleObject([
                'left' => 64,
                'top' => 700,
                'radius' => 20,
                'fill' => 'rgba(251,146,60,0.15)',
                'slotId' => 2
            ]),
            // Slot 2 - Kategori ikonu
            createTextObject([
                'left' => 74,
                'top' => 710,
                'text' => '🍲',
                'fontSize' => 18,
                'slotId' => 2
            ]),
            // Slot 2 - Ürün adı
            createTextObject([
                'left' => 64,
                'top' => 760,
                'text' => '{{product_name}}',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#1f2937',
                'lineHeight' => 1.2,
                'dynamicField' => 'product_name',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Ağırlık/Birim
            createTextObject([
                'left' => 64,
                'top' => 810,
                'text' => '{{weight}}',
                'fontSize' => 20,
                'fontWeight' => '500',
                'fontFamily' => 'Work Sans',
                'fill' => '#6b7280',
                'dynamicField' => 'weight',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Ürün görseli
            createRectObject([
                'left' => 568,
                'top' => 700,
                'width' => 160,
                'height' => 160,
                'fill' => '#ffffff',
                'stroke' => '#f3f4f6',
                'strokeWidth' => 1,
                'rx' => 12,
                'ry' => 12,
                'slotId' => 2
            ]),
            createImageObject([
                'left' => 576,
                'top' => 708,
                'width' => 144,
                'height' => 144,
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Para birimi
            createTextObject([
                'left' => 64,
                'top' => 902,
                'text' => '₺',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#139dc3',
                'slotId' => 2
            ]),
            // Slot 2 - Fiyat
            createTextObject([
                'left' => 100,
                'top' => 877,
                'text' => '{{current_price}}',
                'fontSize' => 80,
                'fontWeight' => '800',
                'fontFamily' => 'Work Sans',
                'fill' => '#139dc3',
                'customType' => 'price',
                'dynamicField' => 'current_price',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Organik rozet
            createRectObject([
                'left' => 540,
                'top' => 910,
                'width' => 110,
                'height' => 32,
                'fill' => 'rgba(19,157,195,0.1)',
                'rx' => 4,
                'ry' => 4,
                'slotId' => 2
            ]),
            createTextObject([
                'left' => 555,
                'top' => 918,
                'text' => '{{production_type}}',
                'fontSize' => 13,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#139dc3',
                'dynamicField' => 'production_type',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Ayırıcı çizgi
            createLineObject([
                'left' => 64,
                'top' => 1002,
                'x1' => 0,
                'y1' => 0,
                'x2' => 672,
                'y2' => 0,
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1,
                'slotId' => 2
            ]),
            // Slot 2 - SKU
            createTextObject([
                'left' => 64,
                'top' => 1030,
                'text' => 'SKU {{sku}}',
                'fontSize' => 11,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#9ca3af',
                'charSpacing' => 100,
                'dynamicField' => 'sku',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Barkod
            createImageObject([
                'left' => 64,
                'top' => 1062,
                'width' => 220,
                'height' => 55,
                'customType' => 'barcode',
                'dynamicField' => 'barcode',
                'barcodeFormat' => 'EAN13',
                'barcodeValue' => '{{barcode}}',
                'isDataField' => true,
                'slotId' => 2,
                'inMultiFrame' => true
            ]),
            // Slot 2 - Organik ikon
            createTextObject([
                'left' => 700,
                'top' => 1062,
                'text' => '🌿',
                'fontSize' => 28,
                'fill' => '#d1d5db',
                'slotId' => 2
            ]),
            // Slot 2 - Dekoratif çubuk (sağ kenar, turuncu)
            createRectObject([
                'left' => 762,
                'top' => 732,
                'width' => 6,
                'height' => 80,
                'fill' => '#fb923c',
                'rx' => 3,
                'ry' => 3,
                'slotId' => 2
            ]),

            // Alt branding
            createTextObject([
                'left' => 400,
                'top' => 1230,
                'originX' => 'center',
                'text' => 'SMART•SHELF',
                'fontSize' => 11,
                'fontWeight' => 'bold',
                'fontFamily' => 'Work Sans',
                'fill' => '#d1d5db',
                'charSpacing' => 200
            ])
        ],
        'background' => '#f6f8f8'
    ], JSON_UNESCAPED_UNICODE),
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
];

// Veritabanına ekle
$templates = [
    $organicProduceTemplate,
    $premiumButcheryTemplate,
    $multiProductPantryTemplate
];

foreach ($templates as $template) {
    // Aynı isimde şablon var mı kontrol et
    $existing = $db->fetch(
        "SELECT id FROM templates WHERE name = ? AND company_id " . ($template['company_id'] ? "= ?" : "IS NULL"),
        $template['company_id'] ? [$template['name'], $template['company_id']] : [$template['name']]
    );

    if ($existing) {
        // Güncelle
        $updateData = $template;
        unset($updateData['id']);
        unset($updateData['created_at']);

        $db->update('templates', $updateData, 'id = ?', [$existing['id']]);
        echo "✓ Güncellendi: {$template['name']}\n";
    } else {
        // Yeni ekle
        $db->insert('templates', $template);
        echo "✓ Eklendi: {$template['name']}\n";
    }
}

echo "\n=== İşlem Tamamlandı ===\n";
echo "Toplam " . count($templates) . " şablon işlendi.\n";
