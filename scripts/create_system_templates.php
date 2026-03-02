<?php
/**
 * Sistem Şablonları Oluşturma Script'i
 *
 * Bu script, profesyonel ESL tablet şablonlarını veritabanına ekler.
 * Fabric.js v7 uyumlu, tam dinamik alan destekli tasarımlar.
 */

require_once __DIR__ . '/../config.php';

echo "=== Sistem Şablonları Oluşturma ===\n\n";

$db = Database::getInstance();

// Yardımcı fonksiyon: UUID oluştur
function generateUuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// =============================================================================
// ŞABLON 1: Manav Premium - Dikey (Media Üst)
// =============================================================================
$template1 = [
    'id' => generateUuid(),
    'name' => 'Manav Premium - Dikey (Media Üst)',
    'description' => 'Meyve ve sebze ürünleri için premium dikey şablon. Üst bölümde ürün görseli, alt bölümde fiyat ve HAL kunye bilgileri.',
    'type' => 'label',
    'category' => 'Manav',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#FFFFFF',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#ffffff',
                'selectable' => false,
                'evented' => false,
                'customType' => 'background',
                'isBackground' => true
            ],
            // Üst bölüm - Yeşil gradient header
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 80,
                'fill' => '#2d8f4e',
                'selectable' => true
            ],
            // Kategori etiketi
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 22,
                'width' => 200,
                'text' => 'TAZE MANAV',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'selectable' => true
            ],
            // Menşei etiketi sağ üst
            [
                'type' => 'textbox',
                'left' => 580,
                'top' => 22,
                'width' => 200,
                'text' => '{{origin}}',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            // Ürün görseli alanı (üst %45)
            [
                'type' => 'rect',
                'left' => 20,
                'top' => 100,
                'width' => 760,
                'height' => 476,
                'fill' => '#f8f9fa',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#e9ecef',
                'strokeWidth' => 2,
                'selectable' => true,
                'regionId' => 'media-area'
            ],
            // Ürün görseli
            [
                'type' => 'image',
                'left' => 40,
                'top' => 120,
                'width' => 720,
                'height' => 436,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true,
                'crossOrigin' => 'anonymous'
            ],
            // Alt bölüm arka planı
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 596,
                'width' => 800,
                'height' => 684,
                'fill' => '#f0fdf4',
                'selectable' => true
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 620,
                'width' => 740,
                'text' => '{{product_name}}',
                'fontSize' => 52,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1a1a1a',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Üretim tipi rozeti
            [
                'type' => 'rect',
                'left' => 280,
                'top' => 690,
                'width' => 240,
                'height' => 40,
                'fill' => '#16a34a',
                'rx' => 20,
                'ry' => 20
            ],
            [
                'type' => 'textbox',
                'left' => 280,
                'top' => 698,
                'width' => 240,
                'text' => '{{production_type}}',
                'fontSize' => 22,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'production_type',
                'isDataField' => true
            ],
            // Fiyat bölümü arka planı
            [
                'type' => 'rect',
                'left' => 30,
                'top' => 750,
                'width' => 500,
                'height' => 160,
                'fill' => '#ffffff',
                'rx' => 16,
                'ry' => 16,
                'shadow' => [
                    'color' => 'rgba(0,0,0,0.1)',
                    'blur' => 10,
                    'offsetX' => 0,
                    'offsetY' => 4
                ]
            ],
            // Eski fiyat (üstü çizili)
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 765,
                'width' => 200,
                'text' => '{{previous_price}}',
                'fontSize' => 32,
                'fontFamily' => 'Arial',
                'fill' => '#9ca3af',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // Güncel fiyat
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 810,
                'width' => 350,
                'text' => '{{current_price}}',
                'fontSize' => 72,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // Birim
            [
                'type' => 'textbox',
                'left' => 400,
                'top' => 850,
                'width' => 120,
                'text' => '{{unit}}',
                'fontSize' => 28,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280',
                'customType' => 'dynamic-text',
                'dynamicField' => 'unit',
                'isDataField' => true
            ],
            // İndirim rozeti
            [
                'type' => 'rect',
                'left' => 550,
                'top' => 760,
                'width' => 200,
                'height' => 140,
                'fill' => '#fef2f2',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#fecaca',
                'strokeWidth' => 2
            ],
            [
                'type' => 'textbox',
                'left' => 550,
                'top' => 790,
                'width' => 200,
                'text' => '%{{discount_percent}}',
                'fontSize' => 48,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 550,
                'top' => 850,
                'width' => 200,
                'text' => 'İNDİRİM',
                'fontSize' => 20,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'textAlign' => 'center'
            ],
            // Kampanya metni
            [
                'type' => 'rect',
                'left' => 30,
                'top' => 930,
                'width' => 740,
                'height' => 50,
                'fill' => '#fef3c7',
                'rx' => 8,
                'ry' => 8
            ],
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 942,
                'width' => 740,
                'text' => '{{campaign_text}}',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#92400e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // HAL Künye Bilgileri Bölümü
            [
                'type' => 'rect',
                'left' => 30,
                'top' => 1000,
                'width' => 540,
                'height' => 250,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#d1d5db',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1015,
                'width' => 200,
                'text' => 'HAL KÜNYE BİLGİLERİ',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#16a34a'
            ],
            // Üretici
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1050,
                'width' => 120,
                'text' => 'Üretici:',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 170,
                'top' => 1050,
                'width' => 380,
                'text' => '{{hal.uretici_adi}}',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretici_adi',
                'isDataField' => true
            ],
            // Mal Adı
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1085,
                'width' => 120,
                'text' => 'Mal Adı:',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 170,
                'top' => 1085,
                'width' => 380,
                'text' => '{{hal.malin_adi}}',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.malin_adi',
                'isDataField' => true
            ],
            // Üretim Yeri
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1120,
                'width' => 120,
                'text' => 'Üretim Yeri:',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 170,
                'top' => 1120,
                'width' => 380,
                'text' => '{{hal.uretim_yeri}}',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretim_yeri',
                'isDataField' => true
            ],
            // Bildirim Tarihi
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1155,
                'width' => 120,
                'text' => 'Bildirim:',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 170,
                'top' => 1155,
                'width' => 380,
                'text' => '{{hal.ilk_bildirim_tarihi}}',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.ilk_bildirim_tarihi',
                'isDataField' => true
            ],
            // Sertifika
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1190,
                'width' => 120,
                'text' => 'Sertifika:',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 170,
                'top' => 1190,
                'width' => 380,
                'text' => '{{hal.sertifikasyon_kurulusu}}',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.sertifikasyon_kurulusu',
                'isDataField' => true
            ],
            // QR Kod alanı (Künye için)
            [
                'type' => 'rect',
                'left' => 590,
                'top' => 1000,
                'width' => 180,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#16a34a',
                'strokeWidth' => 2
            ],
            [
                'type' => 'textbox',
                'left' => 590,
                'top' => 1010,
                'width' => 180,
                'text' => 'KÜNYE',
                'fontSize' => 14,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#16a34a',
                'textAlign' => 'center'
            ],
            // QR Code placeholder
            [
                'type' => 'rect',
                'left' => 620,
                'top' => 1035,
                'width' => 120,
                'height' => 120,
                'fill' => '#f3f4f6',
                'customType' => 'qrcode-placeholder',
                'dynamicField' => 'kunye_no',
                'isDataField' => true,
                'qrValue' => '{{kunye_no}}'
            ],
            // Barkod
            [
                'type' => 'rect',
                'left' => 590,
                'top' => 1190,
                'width' => 180,
                'height' => 60,
                'fill' => '#ffffff',
                'stroke' => '#e5e7eb',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 590,
                'top' => 1200,
                'width' => 180,
                'text' => '{{barcode}}',
                'fontSize' => 16,
                'fontFamily' => 'Courier New',
                'fill' => '#374151',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}',
                'barcodeFormat' => 'EAN13'
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// ŞABLON 2: Et & Balık Premium - Dikey
// =============================================================================
$template2 = [
    'id' => generateUuid(),
    'name' => 'Et & Balık Premium - Dikey',
    'description' => 'Et ve balık ürünleri için premium kırmızı temalı dikey şablon.',
    'type' => 'label',
    'category' => 'Et-Balık',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#FFFFFF',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#ffffff',
                'selectable' => false,
                'customType' => 'background',
                'isBackground' => true
            ],
            // Kırmızı header
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 90,
                'fill' => '#b91c1c'
            ],
            // Kategori başlığı
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 25,
                'width' => 300,
                'text' => 'TAZE ET & BALIK',
                'fontSize' => 32,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff'
            ],
            // TAZE rozeti
            [
                'type' => 'rect',
                'left' => 620,
                'top' => 20,
                'width' => 150,
                'height' => 50,
                'fill' => '#fef2f2',
                'rx' => 25,
                'ry' => 25
            ],
            [
                'type' => 'textbox',
                'left' => 620,
                'top' => 32,
                'width' => 150,
                'text' => '🔴 TAZE',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#b91c1c',
                'textAlign' => 'center'
            ],
            // Ürün görseli alanı
            [
                'type' => 'rect',
                'left' => 20,
                'top' => 110,
                'width' => 760,
                'height' => 480,
                'fill' => '#fef2f2',
                'rx' => 16,
                'ry' => 16,
                'stroke' => '#fecaca',
                'strokeWidth' => 2
            ],
            // Ürün görseli
            [
                'type' => 'image',
                'left' => 40,
                'top' => 130,
                'width' => 720,
                'height' => 440,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ],
            // Alt bölüm
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 610,
                'width' => 800,
                'height' => 670,
                'fill' => '#fff7ed'
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 640,
                'width' => 740,
                'text' => '{{product_name}}',
                'fontSize' => 48,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1c1917',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Menşei ve birim satırı
            [
                'type' => 'textbox',
                'left' => 200,
                'top' => 710,
                'width' => 400,
                'text' => '{{origin}} • {{unit}}',
                'fontSize' => 26,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            // Fiyat kartı
            [
                'type' => 'rect',
                'left' => 50,
                'top' => 770,
                'width' => 700,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 20,
                'ry' => 20,
                'shadow' => [
                    'color' => 'rgba(0,0,0,0.08)',
                    'blur' => 20,
                    'offsetY' => 4
                ]
            ],
            // Eski fiyat
            [
                'type' => 'textbox',
                'left' => 80,
                'top' => 795,
                'width' => 200,
                'text' => '{{previous_price}} ₺',
                'fontSize' => 28,
                'fontFamily' => 'Arial',
                'fill' => '#a8a29e',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // Güncel fiyat
            [
                'type' => 'textbox',
                'left' => 80,
                'top' => 840,
                'width' => 400,
                'text' => '{{current_price}}',
                'fontSize' => 80,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#b91c1c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // TL ve KG
            [
                'type' => 'textbox',
                'left' => 500,
                'top' => 870,
                'width' => 100,
                'text' => '₺/KG',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#78716c'
            ],
            // İndirim rozeti
            [
                'type' => 'rect',
                'left' => 600,
                'top' => 790,
                'width' => 130,
                'height' => 130,
                'fill' => '#b91c1c',
                'rx' => 65,
                'ry' => 65
            ],
            [
                'type' => 'textbox',
                'left' => 600,
                'top' => 825,
                'width' => 130,
                'text' => '%{{discount_percent}}',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 600,
                'top' => 870,
                'width' => 130,
                'text' => 'İNDİRİM',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center'
            ],
            // Kampanya alanı
            [
                'type' => 'rect',
                'left' => 50,
                'top' => 970,
                'width' => 700,
                'height' => 60,
                'fill' => '#fef3c7',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 985,
                'width' => 700,
                'text' => '{{campaign_text}}',
                'fontSize' => 26,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#92400e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // Bilgi satırı
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1060,
                'width' => 350,
                'text' => 'Raf: {{shelf_location}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'shelf_location',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 400,
                'top' => 1060,
                'width' => 350,
                'text' => 'Stok: {{stock}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'stock',
                'isDataField' => true
            ],
            // Barkod alanı
            [
                'type' => 'rect',
                'left' => 50,
                'top' => 1110,
                'width' => 700,
                'height' => 150,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#e7e5e4',
                'strokeWidth' => 1
            ],
            [
                'type' => 'rect',
                'left' => 150,
                'top' => 1130,
                'width' => 500,
                'height' => 80,
                'fill' => '#f5f5f4',
                'customType' => 'barcode-placeholder',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}',
                'barcodeFormat' => 'EAN13'
            ],
            [
                'type' => 'textbox',
                'left' => 150,
                'top' => 1220,
                'width' => 500,
                'text' => '{{barcode}}',
                'fontSize' => 20,
                'fontFamily' => 'Courier New',
                'fill' => '#57534e',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// ŞABLON 3: Süt Ürünleri - Beyaz Tema
// =============================================================================
$template3 = [
    'id' => generateUuid(),
    'name' => 'Süt Ürünleri - Beyaz Tema',
    'description' => 'Süt ürünleri için minimalist beyaz ve mavi temalı şablon.',
    'type' => 'label',
    'category' => 'Süt Ürünleri',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#FFFFFF',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Beyaz arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#ffffff',
                'customType' => 'background',
                'isBackground' => true
            ],
            // Mavi header
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 80,
                'fill' => '#0284c7'
            ],
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 22,
                'width' => 400,
                'text' => 'SÜT ÜRÜNLERİ',
                'fontSize' => 30,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff'
            ],
            // Menşei sağ üst
            [
                'type' => 'textbox',
                'left' => 550,
                'top' => 22,
                'width' => 220,
                'text' => '{{origin}}',
                'fontSize' => 24,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            // Ürün görseli
            [
                'type' => 'rect',
                'left' => 30,
                'top' => 100,
                'width' => 740,
                'height' => 450,
                'fill' => '#f0f9ff',
                'rx' => 16,
                'ry' => 16
            ],
            [
                'type' => 'image',
                'left' => 60,
                'top' => 130,
                'width' => 680,
                'height' => 390,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ],
            // Marka rozeti
            [
                'type' => 'rect',
                'left' => 30,
                'top' => 565,
                'width' => 200,
                'height' => 45,
                'fill' => '#0284c7',
                'rx' => 8,
                'ry' => 8
            ],
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 575,
                'width' => 200,
                'text' => '{{brand}}',
                'fontSize' => 22,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'brand',
                'isDataField' => true
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 630,
                'width' => 740,
                'text' => '{{product_name}}',
                'fontSize' => 46,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#0c4a6e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Açıklama
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 695,
                'width' => 740,
                'text' => '{{description}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#64748b',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'description',
                'isDataField' => true
            ],
            // Birim ve ağırlık
            [
                'type' => 'textbox',
                'left' => 250,
                'top' => 740,
                'width' => 300,
                'text' => '{{weight}} {{unit}}',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#475569',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'weight',
                'isDataField' => true
            ],
            // Fiyat bölümü
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 790,
                'width' => 720,
                'height' => 200,
                'fill' => '#f8fafc',
                'rx' => 20,
                'ry' => 20,
                'stroke' => '#e2e8f0',
                'strokeWidth' => 2
            ],
            // Eski fiyat
            [
                'type' => 'textbox',
                'left' => 70,
                'top' => 815,
                'width' => 200,
                'text' => '{{previous_price}} ₺',
                'fontSize' => 28,
                'fontFamily' => 'Arial',
                'fill' => '#94a3b8',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // Güncel fiyat
            [
                'type' => 'textbox',
                'left' => 70,
                'top' => 860,
                'width' => 400,
                'text' => '{{current_price}}',
                'fontSize' => 90,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#0284c7',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // TL sembolü
            [
                'type' => 'textbox',
                'left' => 480,
                'top' => 900,
                'width' => 80,
                'text' => '₺',
                'fontSize' => 48,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#0284c7'
            ],
            // İndirim yüzdesi
            [
                'type' => 'rect',
                'left' => 580,
                'top' => 820,
                'width' => 160,
                'height' => 150,
                'fill' => '#0284c7',
                'rx' => 16,
                'ry' => 16
            ],
            [
                'type' => 'textbox',
                'left' => 580,
                'top' => 860,
                'width' => 160,
                'text' => '%{{discount_percent}}',
                'fontSize' => 42,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 580,
                'top' => 915,
                'width' => 160,
                'text' => 'İNDİRİM',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center'
            ],
            // Kampanya
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 1010,
                'width' => 720,
                'height' => 55,
                'fill' => '#fef9c3',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1022,
                'width' => 720,
                'text' => '{{campaign_text}}',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#854d0e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // Son kullanma tarihi
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 1085,
                'width' => 350,
                'height' => 70,
                'fill' => '#fef2f2',
                'rx' => 10,
                'ry' => 10,
                'stroke' => '#fecaca',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1095,
                'width' => 330,
                'text' => 'SKT: {{expiry_date}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'customType' => 'dynamic-text',
                'dynamicField' => 'expiry_date',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 50,
                'top' => 1125,
                'width' => 330,
                'text' => 'Saklama: {{storage_info}}',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#991b1b',
                'customType' => 'dynamic-text',
                'dynamicField' => 'storage_info',
                'isDataField' => true
            ],
            // Barkod
            [
                'type' => 'rect',
                'left' => 410,
                'top' => 1085,
                'width' => 350,
                'height' => 70,
                'fill' => '#f8fafc',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'rect',
                'left' => 430,
                'top' => 1095,
                'width' => 310,
                'height' => 40,
                'fill' => '#ffffff',
                'customType' => 'barcode-placeholder',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}'
            ],
            [
                'type' => 'textbox',
                'left' => 430,
                'top' => 1140,
                'width' => 310,
                'text' => '{{barcode}}',
                'fontSize' => 14,
                'fontFamily' => 'Courier New',
                'fill' => '#64748b',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true
            ],
            // Alt bilgi satırı
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 1180,
                'width' => 800,
                'height' => 100,
                'fill' => '#0284c7'
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1210,
                'width' => 350,
                'text' => 'SKU: {{sku}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'customType' => 'dynamic-text',
                'dynamicField' => 'sku',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 410,
                'top' => 1210,
                'width' => 350,
                'text' => 'Raf: {{shelf_location}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'shelf_location',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1245,
                'width' => 720,
                'text' => 'Tedarikçi: {{supplier_code}}',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#bae6fd',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'supplier_code',
                'isDataField' => true
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// ŞABLON 4: Temel Gıda - Kompakt Tasarım
// =============================================================================
$template4 = [
    'id' => generateUuid(),
    'name' => 'Temel Gıda - Kompakt Tasarım',
    'description' => 'Temel gıda ürünleri için turuncu temalı kompakt şablon.',
    'type' => 'label',
    'category' => 'Temel Gıda',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#FFFBEB',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Krem arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#fffbeb',
                'customType' => 'background',
                'isBackground' => true
            ],
            // Turuncu header
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 85,
                'fill' => '#ea580c'
            ],
            [
                'type' => 'textbox',
                'left' => 30,
                'top' => 24,
                'width' => 400,
                'text' => 'TEMEL GIDA',
                'fontSize' => 32,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff'
            ],
            // Kategori rozeti
            [
                'type' => 'rect',
                'left' => 580,
                'top' => 18,
                'width' => 190,
                'height' => 48,
                'fill' => '#fff7ed',
                'rx' => 24,
                'ry' => 24
            ],
            [
                'type' => 'textbox',
                'left' => 580,
                'top' => 30,
                'width' => 190,
                'text' => '{{category}}',
                'fontSize' => 20,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#c2410c',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'category',
                'isDataField' => true
            ],
            // Ürün görseli
            [
                'type' => 'rect',
                'left' => 25,
                'top' => 105,
                'width' => 750,
                'height' => 440,
                'fill' => '#ffffff',
                'rx' => 20,
                'ry' => 20,
                'shadow' => [
                    'color' => 'rgba(0,0,0,0.06)',
                    'blur' => 15,
                    'offsetY' => 5
                ]
            ],
            [
                'type' => 'image',
                'left' => 55,
                'top' => 135,
                'width' => 690,
                'height' => 380,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 25,
                'top' => 570,
                'width' => 750,
                'text' => '{{product_name}}',
                'fontSize' => 48,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1c1917',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Marka ve ağırlık
            [
                'type' => 'textbox',
                'left' => 150,
                'top' => 635,
                'width' => 500,
                'text' => '{{brand}} • {{weight}} {{unit}}',
                'fontSize' => 26,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'brand',
                'isDataField' => true
            ],
            // Büyük fiyat alanı
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 690,
                'width' => 720,
                'height' => 220,
                'fill' => '#ffffff',
                'rx' => 24,
                'ry' => 24,
                'stroke' => '#fed7aa',
                'strokeWidth' => 3
            ],
            // Eski fiyat
            [
                'type' => 'textbox',
                'left' => 80,
                'top' => 720,
                'width' => 250,
                'text' => '{{previous_price}} ₺',
                'fontSize' => 32,
                'fontFamily' => 'Arial',
                'fill' => '#a8a29e',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // Ana fiyat
            [
                'type' => 'textbox',
                'left' => 80,
                'top' => 770,
                'width' => 450,
                'text' => '{{current_price}}',
                'fontSize' => 100,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ea580c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // TL
            [
                'type' => 'textbox',
                'left' => 540,
                'top' => 820,
                'width' => 80,
                'text' => '₺',
                'fontSize' => 52,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ea580c'
            ],
            // İndirim rozeti
            [
                'type' => 'rect',
                'left' => 620,
                'top' => 710,
                'width' => 120,
                'height' => 120,
                'fill' => '#ea580c',
                'rx' => 60,
                'ry' => 60
            ],
            [
                'type' => 'textbox',
                'left' => 620,
                'top' => 745,
                'width' => 120,
                'text' => '%{{discount_percent}}',
                'fontSize' => 32,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 620,
                'top' => 785,
                'width' => 120,
                'text' => 'İNDİRİM',
                'fontSize' => 14,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center'
            ],
            // Kampanya banner
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 930,
                'width' => 720,
                'height' => 70,
                'fill' => '#fef3c7',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#fcd34d',
                'strokeWidth' => 2
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 950,
                'width' => 720,
                'text' => '{{campaign_text}}',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#92400e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // Detay bilgiler
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 1020,
                'width' => 350,
                'height' => 100,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12
            ],
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1040,
                'width' => 310,
                'text' => 'SKU: {{sku}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'sku',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1070,
                'width' => 310,
                'text' => 'Raf: {{shelf_location}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'shelf_location',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1100,
                'width' => 310,
                'text' => 'Stok: {{stock}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#78716c',
                'customType' => 'dynamic-text',
                'dynamicField' => 'stock',
                'isDataField' => true
            ],
            // Barkod alanı
            [
                'type' => 'rect',
                'left' => 410,
                'top' => 1020,
                'width' => 350,
                'height' => 100,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12
            ],
            [
                'type' => 'rect',
                'left' => 430,
                'top' => 1035,
                'width' => 310,
                'height' => 50,
                'fill' => '#f5f5f4',
                'customType' => 'barcode-placeholder',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}'
            ],
            [
                'type' => 'textbox',
                'left' => 430,
                'top' => 1095,
                'width' => 310,
                'text' => '{{barcode}}',
                'fontSize' => 18,
                'fontFamily' => 'Courier New',
                'fill' => '#78716c',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true
            ],
            // Alt footer
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 1140,
                'width' => 800,
                'height' => 140,
                'fill' => '#ea580c'
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1175,
                'width' => 720,
                'text' => '{{origin}}',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1220,
                'width' => 720,
                'text' => 'Tedarikçi: {{supplier_code}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#fed7aa',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'supplier_code',
                'isDataField' => true
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// ŞABLON 5: Organik Ürünler - Yeşil Premium
// =============================================================================
$template5 = [
    'id' => generateUuid(),
    'name' => 'Organik Ürünler - Yeşil Premium',
    'description' => 'Organik ürünler için koyu yeşil premium şablon. HAL künye ve sertifika bilgileri içerir.',
    'type' => 'label',
    'category' => 'Organik',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'split-vertical',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#F0FDF4',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Açık yeşil arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#f0fdf4',
                'customType' => 'background',
                'isBackground' => true
            ],
            // Koyu yeşil header
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 100,
                'fill' => '#166534'
            ],
            // Organik rozeti sol
            [
                'type' => 'rect',
                'left' => 20,
                'top' => 20,
                'width' => 60,
                'height' => 60,
                'fill' => '#22c55e',
                'rx' => 30,
                'ry' => 30
            ],
            [
                'type' => 'textbox',
                'left' => 20,
                'top' => 38,
                'width' => 60,
                'text' => '🌿',
                'fontSize' => 28,
                'textAlign' => 'center'
            ],
            // Başlık
            [
                'type' => 'textbox',
                'left' => 100,
                'top' => 25,
                'width' => 450,
                'text' => 'ORGANİK ÜRÜN',
                'fontSize' => 36,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff'
            ],
            // Sertifika rozeti sağ
            [
                'type' => 'rect',
                'left' => 560,
                'top' => 15,
                'width' => 220,
                'height' => 70,
                'fill' => '#dcfce7',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 570,
                'top' => 25,
                'width' => 200,
                'text' => '✓ SERTİFİKALI',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'textAlign' => 'center'
            ],
            [
                'type' => 'textbox',
                'left' => 570,
                'top' => 50,
                'width' => 200,
                'text' => '{{production_type}}',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#15803d',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'production_type',
                'isDataField' => true
            ],
            // Ürün görseli
            [
                'type' => 'rect',
                'left' => 25,
                'top' => 120,
                'width' => 750,
                'height' => 420,
                'fill' => '#ffffff',
                'rx' => 20,
                'ry' => 20,
                'stroke' => '#86efac',
                'strokeWidth' => 3
            ],
            [
                'type' => 'image',
                'left' => 50,
                'top' => 145,
                'width' => 700,
                'height' => 370,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 25,
                'top' => 560,
                'width' => 750,
                'text' => '{{product_name}}',
                'fontSize' => 44,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#14532d',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Menşei ve birim
            [
                'type' => 'textbox',
                'left' => 150,
                'top' => 620,
                'width' => 500,
                'text' => '{{origin}} • {{weight}} {{unit}}',
                'fontSize' => 24,
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            // Fiyat kartı
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 670,
                'width' => 480,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 20,
                'ry' => 20,
                'shadow' => [
                    'color' => 'rgba(0,0,0,0.08)',
                    'blur' => 15,
                    'offsetY' => 4
                ]
            ],
            // Eski fiyat
            [
                'type' => 'textbox',
                'left' => 70,
                'top' => 695,
                'width' => 200,
                'text' => '{{previous_price}} ₺',
                'fontSize' => 26,
                'fontFamily' => 'Arial',
                'fill' => '#9ca3af',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // Güncel fiyat
            [
                'type' => 'textbox',
                'left' => 70,
                'top' => 735,
                'width' => 350,
                'text' => '{{current_price}}',
                'fontSize' => 80,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // TL ve KG
            [
                'type' => 'textbox',
                'left' => 420,
                'top' => 780,
                'width' => 90,
                'text' => '₺/KG',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#166534'
            ],
            // QR ve İndirim alanı
            [
                'type' => 'rect',
                'left' => 540,
                'top' => 670,
                'width' => 220,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 16,
                'ry' => 16,
                'stroke' => '#22c55e',
                'strokeWidth' => 2
            ],
            // İndirim
            [
                'type' => 'rect',
                'left' => 560,
                'top' => 685,
                'width' => 180,
                'height' => 70,
                'fill' => '#166534',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 560,
                'top' => 700,
                'width' => 180,
                'text' => '%{{discount_percent}} İND.',
                'fontSize' => 28,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            // QR Code
            [
                'type' => 'textbox',
                'left' => 560,
                'top' => 765,
                'width' => 180,
                'text' => 'KÜNYE',
                'fontSize' => 12,
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'textAlign' => 'center'
            ],
            [
                'type' => 'rect',
                'left' => 595,
                'top' => 782,
                'width' => 110,
                'height' => 60,
                'fill' => '#f0fdf4',
                'customType' => 'qrcode-placeholder',
                'dynamicField' => 'kunye_no',
                'isDataField' => true,
                'qrValue' => '{{kunye_no}}'
            ],
            // Kampanya
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 870,
                'width' => 720,
                'height' => 55,
                'fill' => '#dcfce7',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 883,
                'width' => 720,
                'text' => '{{campaign_text}}',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // HAL Künye Bilgileri
            [
                'type' => 'rect',
                'left' => 40,
                'top' => 945,
                'width' => 500,
                'height' => 200,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#bbf7d0',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 960,
                'width' => 200,
                'text' => 'HAL KÜNYE BİLGİLERİ',
                'fontSize' => 14,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#166534'
            ],
            // Üretici
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 990,
                'width' => 100,
                'text' => 'Üretici:',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 160,
                'top' => 990,
                'width' => 360,
                'text' => '{{hal.uretici_adi}}',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretici_adi',
                'isDataField' => true
            ],
            // Mal Adı
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1020,
                'width' => 100,
                'text' => 'Mal Adı:',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 160,
                'top' => 1020,
                'width' => 360,
                'text' => '{{hal.malin_adi}}',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.malin_adi',
                'isDataField' => true
            ],
            // Üretim Yeri
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1050,
                'width' => 100,
                'text' => 'Üretim Yeri:',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 160,
                'top' => 1050,
                'width' => 360,
                'text' => '{{hal.uretim_yeri}}',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretim_yeri',
                'isDataField' => true
            ],
            // Bildirim Tarihi
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1080,
                'width' => 100,
                'text' => 'Bildirim:',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 160,
                'top' => 1080,
                'width' => 360,
                'text' => '{{hal.ilk_bildirim_tarihi}}',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.ilk_bildirim_tarihi',
                'isDataField' => true
            ],
            // Sertifika
            [
                'type' => 'textbox',
                'left' => 60,
                'top' => 1110,
                'width' => 100,
                'text' => 'Sertifika:',
                'fontSize' => 16,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 160,
                'top' => 1110,
                'width' => 360,
                'text' => '{{hal.sertifikasyon_kurulusu}}',
                'fontSize' => 16,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.sertifikasyon_kurulusu',
                'isDataField' => true
            ],
            // Barkod alanı
            [
                'type' => 'rect',
                'left' => 560,
                'top' => 945,
                'width' => 200,
                'height' => 200,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#bbf7d0',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 560,
                'top' => 960,
                'width' => 200,
                'text' => 'BARKOD',
                'fontSize' => 12,
                'fontFamily' => 'Arial',
                'fill' => '#166534',
                'textAlign' => 'center'
            ],
            [
                'type' => 'rect',
                'left' => 580,
                'top' => 985,
                'width' => 160,
                'height' => 80,
                'fill' => '#f0fdf4',
                'customType' => 'barcode-placeholder',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}'
            ],
            [
                'type' => 'textbox',
                'left' => 560,
                'top' => 1080,
                'width' => 200,
                'text' => '{{barcode}}',
                'fontSize' => 14,
                'fontFamily' => 'Courier New',
                'fill' => '#374151',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 560,
                'top' => 1110,
                'width' => 200,
                'text' => 'SKU: {{sku}}',
                'fontSize' => 14,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'sku',
                'isDataField' => true
            ],
            // Footer
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 1165,
                'width' => 800,
                'height' => 115,
                'fill' => '#166534'
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1190,
                'width' => 720,
                'text' => '🌿 %100 Organik • Kimyasal İçermez • Doğal Üretim',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center'
            ],
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1230,
                'width' => 350,
                'text' => 'Raf: {{shelf_location}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#bbf7d0',
                'customType' => 'dynamic-text',
                'dynamicField' => 'shelf_location',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 410,
                'top' => 1230,
                'width' => 350,
                'text' => 'Tedarik: {{supplier_code}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#bbf7d0',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'supplier_code',
                'isDataField' => true
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// ŞABLON 6: Manav Video - Üst Bölüm Video
// =============================================================================
$template6 = [
    'id' => generateUuid(),
    'name' => 'Manav Video - Üst Bölüm Video',
    'description' => 'Meyve ve sebze ürünleri için üst bölümde video/medya alanı bulunan şablon.',
    'type' => 'label',
    'category' => 'Manav',
    'width' => 800,
    'height' => 1280,
    'orientation' => 'portrait',
    'target_device_type' => 'esl_101_portrait',
    'grid_layout' => 'top-one-bottom-two',
    'scope' => 'system',
    'status' => 'active',
    'background_type' => 'color',
    'background_value' => '#FFFFFF',
    'design_data' => json_encode([
        'version' => '7.0.0',
        'objects' => [
            // Beyaz arka plan
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 1280,
                'fill' => '#ffffff',
                'customType' => 'background',
                'isBackground' => true
            ],
            // Video/Medya alanı (üst %40)
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 0,
                'width' => 800,
                'height' => 512,
                'fill' => '#1a1a1a',
                'customType' => 'video-region',
                'isVideoPlaceholder' => true,
                'regionId' => 'video-area'
            ],
            // Video placeholder ikonu
            [
                'type' => 'textbox',
                'left' => 300,
                'top' => 200,
                'width' => 200,
                'text' => '▶',
                'fontSize' => 100,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'opacity' => 0.5
            ],
            [
                'type' => 'textbox',
                'left' => 200,
                'top' => 320,
                'width' => 400,
                'text' => 'Video / Medya Alanı',
                'fontSize' => 24,
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center',
                'opacity' => 0.7
            ],
            // Yeşil şerit
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 512,
                'width' => 800,
                'height' => 8,
                'fill' => '#22c55e'
            ],
            // Alt bölüm - Açık yeşil
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 520,
                'width' => 800,
                'height' => 760,
                'fill' => '#f0fdf4'
            ],
            // Ürün görseli (sol alt)
            [
                'type' => 'rect',
                'left' => 25,
                'top' => 540,
                'width' => 360,
                'height' => 300,
                'fill' => '#ffffff',
                'rx' => 16,
                'ry' => 16,
                'stroke' => '#86efac',
                'strokeWidth' => 2
            ],
            [
                'type' => 'image',
                'left' => 45,
                'top' => 560,
                'width' => 320,
                'height' => 260,
                'src' => '',
                'customType' => 'dynamic-image',
                'dynamicField' => 'image_url',
                'isDataField' => true
            ],
            // Ürün bilgileri (sağ alt)
            [
                'type' => 'rect',
                'left' => 405,
                'top' => 540,
                'width' => 370,
                'height' => 300,
                'fill' => '#ffffff',
                'rx' => 16,
                'ry' => 16
            ],
            // Kategori
            [
                'type' => 'rect',
                'left' => 425,
                'top' => 555,
                'width' => 140,
                'height' => 35,
                'fill' => '#22c55e',
                'rx' => 17,
                'ry' => 17
            ],
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 562,
                'width' => 140,
                'text' => 'MANAV',
                'fontSize' => 18,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#ffffff',
                'textAlign' => 'center'
            ],
            // Ürün adı
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 605,
                'width' => 330,
                'text' => '{{product_name}}',
                'fontSize' => 32,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#14532d',
                'customType' => 'dynamic-text',
                'dynamicField' => 'product_name',
                'isDataField' => true
            ],
            // Üretim tipi
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 655,
                'width' => 330,
                'text' => '{{production_type}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#16a34a',
                'customType' => 'dynamic-text',
                'dynamicField' => 'production_type',
                'isDataField' => true
            ],
            // Menşei
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 690,
                'width' => 330,
                'text' => '📍 {{origin}}',
                'fontSize' => 20,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280',
                'customType' => 'dynamic-text',
                'dynamicField' => 'origin',
                'isDataField' => true
            ],
            // Fiyat
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 730,
                'width' => 250,
                'text' => '{{current_price}}',
                'fontSize' => 56,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'customType' => 'dynamic-text',
                'dynamicField' => 'current_price',
                'isDataField' => true
            ],
            // TL/KG
            [
                'type' => 'textbox',
                'left' => 680,
                'top' => 760,
                'width' => 80,
                'text' => '₺/{{unit}}',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280',
                'customType' => 'dynamic-text',
                'dynamicField' => 'unit',
                'isDataField' => true
            ],
            // Eski fiyat
            [
                'type' => 'textbox',
                'left' => 425,
                'top' => 800,
                'width' => 150,
                'text' => '{{previous_price}} ₺',
                'fontSize' => 22,
                'fontFamily' => 'Arial',
                'fill' => '#9ca3af',
                'linethrough' => true,
                'customType' => 'dynamic-text',
                'dynamicField' => 'previous_price',
                'isDataField' => true
            ],
            // İndirim
            [
                'type' => 'rect',
                'left' => 600,
                'top' => 790,
                'width' => 100,
                'height' => 40,
                'fill' => '#fef2f2',
                'rx' => 8,
                'ry' => 8
            ],
            [
                'type' => 'textbox',
                'left' => 600,
                'top' => 800,
                'width' => 100,
                'text' => '%{{discount_percent}}',
                'fontSize' => 20,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#dc2626',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'discount_percent',
                'isDataField' => true
            ],
            // Kampanya metni
            [
                'type' => 'rect',
                'left' => 25,
                'top' => 860,
                'width' => 750,
                'height' => 55,
                'fill' => '#fef3c7',
                'rx' => 10,
                'ry' => 10
            ],
            [
                'type' => 'textbox',
                'left' => 25,
                'top' => 873,
                'width' => 750,
                'text' => '{{campaign_text}}',
                'fontSize' => 24,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#92400e',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'campaign_text',
                'isDataField' => true
            ],
            // HAL Künye bölümü
            [
                'type' => 'rect',
                'left' => 25,
                'top' => 935,
                'width' => 580,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#d1d5db',
                'strokeWidth' => 1
            ],
            [
                'type' => 'textbox',
                'left' => 45,
                'top' => 950,
                'width' => 200,
                'text' => 'HAL KÜNYE BİLGİLERİ',
                'fontSize' => 14,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#16a34a'
            ],
            // Üretici
            [
                'type' => 'textbox',
                'left' => 45,
                'top' => 980,
                'width' => 80,
                'text' => 'Üretici:',
                'fontSize' => 15,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 130,
                'top' => 980,
                'width' => 450,
                'text' => '{{hal.uretici_adi}}',
                'fontSize' => 15,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretici_adi',
                'isDataField' => true
            ],
            // Mal Adı
            [
                'type' => 'textbox',
                'left' => 45,
                'top' => 1010,
                'width' => 80,
                'text' => 'Mal Adı:',
                'fontSize' => 15,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 130,
                'top' => 1010,
                'width' => 450,
                'text' => '{{hal.malin_adi}}',
                'fontSize' => 15,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.malin_adi',
                'isDataField' => true
            ],
            // Üretim Yeri
            [
                'type' => 'textbox',
                'left' => 45,
                'top' => 1040,
                'width' => 80,
                'text' => 'Üretim:',
                'fontSize' => 15,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 130,
                'top' => 1040,
                'width' => 450,
                'text' => '{{hal.uretim_yeri}}',
                'fontSize' => 15,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.uretim_yeri',
                'isDataField' => true
            ],
            // Bildirim Tarihi
            [
                'type' => 'textbox',
                'left' => 45,
                'top' => 1070,
                'width' => 80,
                'text' => 'Tarih:',
                'fontSize' => 15,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 130,
                'top' => 1070,
                'width' => 200,
                'text' => '{{hal.ilk_bildirim_tarihi}}',
                'fontSize' => 15,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.ilk_bildirim_tarihi',
                'isDataField' => true
            ],
            // Sertifika
            [
                'type' => 'textbox',
                'left' => 340,
                'top' => 1070,
                'width' => 80,
                'text' => 'Sertifika:',
                'fontSize' => 15,
                'fontFamily' => 'Arial',
                'fill' => '#6b7280'
            ],
            [
                'type' => 'textbox',
                'left' => 420,
                'top' => 1070,
                'width' => 170,
                'text' => '{{hal.sertifikasyon_kurulusu}}',
                'fontSize' => 15,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#1f2937',
                'customType' => 'dynamic-text',
                'dynamicField' => 'hal.sertifikasyon_kurulusu',
                'isDataField' => true
            ],
            // QR Kod
            [
                'type' => 'rect',
                'left' => 625,
                'top' => 935,
                'width' => 150,
                'height' => 180,
                'fill' => '#ffffff',
                'rx' => 12,
                'ry' => 12,
                'stroke' => '#22c55e',
                'strokeWidth' => 2
            ],
            [
                'type' => 'textbox',
                'left' => 625,
                'top' => 948,
                'width' => 150,
                'text' => 'KÜNYE QR',
                'fontSize' => 12,
                'fontWeight' => 'bold',
                'fontFamily' => 'Arial',
                'fill' => '#16a34a',
                'textAlign' => 'center'
            ],
            [
                'type' => 'rect',
                'left' => 655,
                'top' => 970,
                'width' => 90,
                'height' => 90,
                'fill' => '#f0fdf4',
                'customType' => 'qrcode-placeholder',
                'dynamicField' => 'kunye_no',
                'isDataField' => true,
                'qrValue' => '{{kunye_no}}'
            ],
            [
                'type' => 'textbox',
                'left' => 625,
                'top' => 1070,
                'width' => 150,
                'text' => '{{kunye_no}}',
                'fontSize' => 10,
                'fontFamily' => 'Courier New',
                'fill' => '#6b7280',
                'textAlign' => 'center',
                'customType' => 'dynamic-text',
                'dynamicField' => 'kunye_no',
                'isDataField' => true
            ],
            // Alt bilgi satırı
            [
                'type' => 'rect',
                'left' => 0,
                'top' => 1135,
                'width' => 800,
                'height' => 145,
                'fill' => '#166534'
            ],
            // Barkod
            [
                'type' => 'rect',
                'left' => 200,
                'top' => 1155,
                'width' => 400,
                'height' => 60,
                'fill' => '#ffffff',
                'rx' => 8,
                'ry' => 8
            ],
            [
                'type' => 'rect',
                'left' => 220,
                'top' => 1165,
                'width' => 360,
                'height' => 35,
                'fill' => '#f3f4f6',
                'customType' => 'barcode-placeholder',
                'dynamicField' => 'barcode',
                'isDataField' => true,
                'barcodeValue' => '{{barcode}}'
            ],
            [
                'type' => 'textbox',
                'left' => 200,
                'top' => 1205,
                'width' => 400,
                'text' => '{{barcode}}',
                'fontSize' => 14,
                'fontFamily' => 'Courier New',
                'fill' => '#374151',
                'textAlign' => 'center',
                'customType' => 'barcode-text',
                'dynamicField' => 'barcode',
                'isDataField' => true
            ],
            // SKU ve Raf
            [
                'type' => 'textbox',
                'left' => 40,
                'top' => 1235,
                'width' => 350,
                'text' => 'SKU: {{sku}} • Raf: {{shelf_location}}',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#bbf7d0',
                'customType' => 'dynamic-text',
                'dynamicField' => 'sku',
                'isDataField' => true
            ],
            [
                'type' => 'textbox',
                'left' => 410,
                'top' => 1235,
                'width' => 350,
                'text' => 'Stok: {{stock}}',
                'fontSize' => 18,
                'fontFamily' => 'Arial',
                'fill' => '#bbf7d0',
                'textAlign' => 'right',
                'customType' => 'dynamic-text',
                'dynamicField' => 'stock',
                'isDataField' => true
            ]
        ]
    ], JSON_UNESCAPED_UNICODE)
];

// =============================================================================
// VERİTABANINA EKLE
// =============================================================================
$templates = [$template1, $template2, $template3, $template4, $template5, $template6];

$inserted = 0;
$errors = 0;

foreach ($templates as $template) {
    try {
        $db->insert('templates', $template);
        echo "✓ Eklendi: {$template['name']}\n";
        $inserted++;
    } catch (Exception $e) {
        echo "✗ Hata ({$template['name']}): {$e->getMessage()}\n";
        $errors++;
    }
}

echo "\n=== Sonuç ===\n";
echo "Eklenen: $inserted\n";
echo "Hata: $errors\n";

// Doğrulama
$count = $db->fetchColumn("SELECT COUNT(*) FROM templates WHERE scope = 'system'");
echo "\nToplam sistem şablonu: $count\n";

// Eklenen şablonların özeti
echo "\n=== Eklenen Şablonlar ===\n";
$results = $db->fetchAll(
    "SELECT name, category, target_device_type,
            LENGTH(design_data) as design_size,
            json_array_length(json_extract(design_data, '$.objects')) as object_count
     FROM templates
     WHERE scope = 'system'
     ORDER BY created_at DESC
     LIMIT 10"
);

foreach ($results as $r) {
    echo sprintf(
        "  • %s (%s) - %d nesne, %d KB\n",
        $r['name'],
        $r['category'] ?? 'Genel',
        $r['object_count'] ?? 0,
        round(($r['design_size'] ?? 0) / 1024, 1)
    );
}

echo "\n✓ İşlem tamamlandı!\n";
