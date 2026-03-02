<?php
/**
 * Premium Templates Seed
 *
 * Premium şablonları veritabanına ekler.
 * Kullanım: php database/seeds/premium_templates_seed.php
 */

// Bootstrap
require_once __DIR__ . '/../../config.php';

$db = Database::getInstance();

// Şablon verilerini hazırla
$templates = [
    [
        'name' => 'Premium Vertical Product Label',
        'description' => 'Dikey formatta premium ürün etiketi. Üst kısımda büyük ürün görseli, alt kısımda kategori, ürün adı, QR kod, fiyat ve detaylar.',
        'type' => 'label',
        'category' => 'product',
        'width' => 800,
        'height' => 1280,
        'orientation' => 'portrait',
        'layout_type' => 'split',
        'template_file' => 'portrait/premium_vertical_product_label.html',
        'slots' => json_encode([
            'image' => [
                'type' => 'image',
                'x' => 0,
                'y' => 0,
                'width' => 800,
                'height' => 768,
                'field' => 'image_url'
            ],
            'category' => [
                'type' => 'text',
                'x' => 32,
                'y' => 792,
                'fontSize' => 11,
                'fontWeight' => 'bold',
                'color' => '#E11D48',
                'field' => 'category'
            ],
            'product_name' => [
                'type' => 'text',
                'x' => 32,
                'y' => 820,
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'color' => '#1e293b',
                'field' => 'name'
            ],
            'qr_code' => [
                'type' => 'qrcode',
                'x' => 32,
                'y' => 900,
                'width' => 80,
                'height' => 80,
                'field' => 'barcode'
            ],
            'price' => [
                'type' => 'price',
                'x' => 600,
                'y' => 900,
                'fontSize' => 72,
                'fontWeight' => 'bold',
                'color' => '#1e293b',
                'field' => 'current_price',
                'currency' => '₺'
            ],
            'origin' => [
                'type' => 'text',
                'x' => 32,
                'y' => 1120,
                'fontSize' => 13,
                'color' => '#64748b',
                'field' => 'origin',
                'label' => 'Menşei'
            ],
            'weight' => [
                'type' => 'text',
                'x' => 32,
                'y' => 1146,
                'fontSize' => 13,
                'color' => '#64748b',
                'field' => 'unit',
                'label' => 'Ağırlık'
            ],
            'barcode' => [
                'type' => 'barcode',
                'x' => 550,
                'y' => 1100,
                'width' => 200,
                'height' => 50,
                'field' => 'barcode'
            ]
        ]),
        'design_data' => json_encode([
            'version' => '5.3.1',
            'objects' => [
                // Arkaplan dikdörtgeni - üst (görsel alanı)
                [
                    'type' => 'rect',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 0,
                    'top' => 0,
                    'width' => 800,
                    'height' => 768,
                    'fill' => '#1a1a2e',
                    'selectable' => false,
                    'evented' => false,
                    'isBackground' => true
                ],
                // Görsel placeholder
                [
                    'type' => 'rect',
                    'originX' => 'center',
                    'originY' => 'center',
                    'left' => 400,
                    'top' => 384,
                    'width' => 600,
                    'height' => 600,
                    'fill' => '#2d2d4a',
                    'rx' => 8,
                    'ry' => 8,
                    'customType' => 'dynamic-image',
                    'dynamicField' => 'image_url'
                ],
                // Arkaplan dikdörtgeni - alt (bilgi alanı)
                [
                    'type' => 'rect',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 0,
                    'top' => 768,
                    'width' => 800,
                    'height' => 512,
                    'fill' => '#ffffff',
                    'selectable' => false,
                    'evented' => false,
                    'isBackground' => true
                ],
                // Kategori text
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 792,
                    'text' => '{{category}}',
                    'fontSize' => 14,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#E11D48',
                    'isDataField' => true,
                    'dynamicField' => 'category'
                ],
                // Ürün adı
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 820,
                    'text' => '{{product_name}}',
                    'fontSize' => 32,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#1e293b',
                    'isDataField' => true,
                    'dynamicField' => 'product_name'
                ],
                // QR Code placeholder
                [
                    'type' => 'rect',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 900,
                    'width' => 96,
                    'height' => 96,
                    'fill' => '#f8fafc',
                    'stroke' => '#e2e8f0',
                    'strokeWidth' => 1,
                    'rx' => 12,
                    'ry' => 12,
                    'customType' => 'qrcode',
                    'dynamicField' => 'barcode'
                ],
                // Para birimi sembolü
                [
                    'type' => 'i-text',
                    'originX' => 'right',
                    'originY' => 'top',
                    'left' => 580,
                    'top' => 900,
                    'text' => '₺',
                    'fontSize' => 28,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#64748b'
                ],
                // Fiyat ana kısım
                [
                    'type' => 'i-text',
                    'originX' => 'right',
                    'originY' => 'top',
                    'left' => 720,
                    'top' => 880,
                    'text' => '{{price_main}}',
                    'fontSize' => 72,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#1e293b',
                    'isDataField' => true,
                    'dynamicField' => 'current_price',
                    'customType' => 'price'
                ],
                // Fiyat ondalık kısım
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 722,
                    'top' => 888,
                    'text' => '.{{price_decimal}}',
                    'fontSize' => 28,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#1e293b',
                    'isDataField' => true,
                    'dynamicField' => 'price_decimal'
                ],
                // Ayırıcı çizgi
                [
                    'type' => 'line',
                    'x1' => 32,
                    'y1' => 1080,
                    'x2' => 768,
                    'y2' => 1080,
                    'stroke' => '#f1f5f9',
                    'strokeWidth' => 1
                ],
                // Menşei label
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 1100,
                    'text' => 'Menşei:',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#1e293b'
                ],
                // Menşei value
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 95,
                    'top' => 1100,
                    'text' => '{{origin}}',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fill' => '#64748b',
                    'isDataField' => true,
                    'dynamicField' => 'origin'
                ],
                // Ağırlık label
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 1126,
                    'text' => 'Ağırlık:',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#1e293b'
                ],
                // Ağırlık value
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 95,
                    'top' => 1126,
                    'text' => '{{unit}}',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fill' => '#64748b',
                    'isDataField' => true,
                    'dynamicField' => 'unit'
                ],
                // Saklama label
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 32,
                    'top' => 1152,
                    'text' => 'Saklama:',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#1e293b'
                ],
                // Saklama value
                [
                    'type' => 'i-text',
                    'originX' => 'left',
                    'originY' => 'top',
                    'left' => 105,
                    'top' => 1152,
                    'text' => '{{storage_info}}',
                    'fontSize' => 13,
                    'fontFamily' => 'Inter',
                    'fill' => '#64748b',
                    'isDataField' => true,
                    'dynamicField' => 'storage_info'
                ],
                // Barcode placeholder
                [
                    'type' => 'rect',
                    'originX' => 'right',
                    'originY' => 'top',
                    'left' => 768,
                    'top' => 1100,
                    'width' => 180,
                    'height' => 45,
                    'fill' => '#f8fafc',
                    'customType' => 'barcode',
                    'dynamicField' => 'barcode'
                ],
                // Marka footer
                [
                    'type' => 'i-text',
                    'originX' => 'right',
                    'originY' => 'top',
                    'left' => 768,
                    'top' => 1155,
                    'text' => '{{company_name}}',
                    'fontSize' => 10,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#94a3b8',
                    'isDataField' => true,
                    'dynamicField' => 'company_name'
                ]
            ],
            'background' => '#ffffff'
        ]),
        'status' => 'active'
    ]
];

// Şirket ID'sini al (ilk şirket veya varsayılan)
$company = $db->fetch("SELECT id FROM companies LIMIT 1");
$companyId = $company ? $company['id'] : $db->generateUuid();

// Admin kullanıcı ID'sini al
$admin = $db->fetch("SELECT id FROM users WHERE role = 'SuperAdmin' LIMIT 1");
$createdBy = $admin ? $admin['id'] : null;

echo "Premium Templates Seed başlıyor...\n\n";

foreach ($templates as $template) {
    // Mevcut şablonu kontrol et
    $existing = $db->fetch(
        "SELECT id FROM templates WHERE name = ? AND company_id = ?",
        [$template['name'], $companyId]
    );

    if ($existing) {
        echo "- '{$template['name']}' zaten mevcut, güncelleniyor...\n";
        $db->update('templates', [
            'description' => $template['description'],
            'type' => $template['type'],
            'category' => $template['category'],
            'width' => $template['width'],
            'height' => $template['height'],
            'orientation' => $template['orientation'],
            'layout_type' => $template['layout_type'],
            'template_file' => $template['template_file'],
            'slots' => $template['slots'],
            'design_data' => $template['design_data'],
            'status' => $template['status'],
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$existing['id']]);
        echo "  ✓ Güncellendi\n";
    } else {
        echo "- '{$template['name']}' ekleniyor...\n";
        $db->insert('templates', [
            'company_id' => $companyId,
            'name' => $template['name'],
            'description' => $template['description'],
            'type' => $template['type'],
            'category' => $template['category'],
            'width' => $template['width'],
            'height' => $template['height'],
            'orientation' => $template['orientation'],
            'layout_type' => $template['layout_type'],
            'template_file' => $template['template_file'],
            'slots' => $template['slots'],
            'design_data' => $template['design_data'],
            'status' => $template['status'],
            'created_by' => $createdBy
        ]);
        echo "  ✓ Eklendi\n";
    }
}

echo "\n✅ Premium Templates Seed tamamlandı!\n";
echo "Şablonlar /templates sayfasında görüntülenebilir.\n";
