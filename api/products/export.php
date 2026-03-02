<?php
/**
 * Export Products API
 * GET /api/products/export
 *
 * Tüm ürün kartı alanlarını export eder
 */

$db = Database::getInstance();
$user = Auth::user();

$format = $request->query('format', 'csv');
$category = $request->query('category');
$status = $request->query('status', 'active');

// Build query
$where = ['company_id = ?'];
$params = [Auth::getActiveCompanyId()];

if ($category) {
    $where[] = 'category = ?';
    $params[] = $category;
}

if ($status) {
    $where[] = 'status = ?';
    $params[] = $status;
}

$whereClause = implode(' AND ', $where);

// Tüm ürün kartı alanları
$products = $db->fetchAll(
    "SELECT
        sku, barcode, slug, name, \"group\", category, subcategory, brand, origin, unit,
        current_price, previous_price, campaign_price, vat_rate, discount_percent,
        stock, weight, shelf_location, supplier_code, kunye_no,
        description, image_url, images, videos, video_url, storage_info,
        campaign_text,
        valid_from, valid_until, is_featured, status,
        price_updated_at, previous_price_updated_at,
        created_at, updated_at
     FROM products
     WHERE $whereClause
     ORDER BY \"group\", category, name ASC",
    $params
);

if ($format === 'json') {
    // JSON export
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="products_' . date('Y-m-d') . '.json"');
    echo json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($format === 'xml') {
    // XML export
    header('Content-Type: application/xml');
    header('Content-Disposition: attachment; filename="products_' . date('Y-m-d') . '.xml"');

    $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><products></products>');
    foreach ($products as $product) {
        $item = $xml->addChild('product');
        foreach ($product as $key => $value) {
            $item->addChild($key, htmlspecialchars($value ?? ''));
        }
    }
    echo $xml->asXML();
    exit;
}

if ($format === 'txt') {
    // TXT (TAB-delimited) export - ERP uyumlu
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="products_' . date('Y-m-d') . '.txt"');

    // UTF-8 BOM for Excel compatibility
    echo "\xEF\xBB\xBF";

    // Headers - Türkçe alan adları
    $headers = [
        'STOK_KODU', 'BARKOD', 'SLUG', 'URUN_ADI', 'GRUP', 'KATEGORI', 'ALT_KATEGORI', 'MARKA', 'MENSEI', 'BIRIM',
        'SATIS_FIYATI', 'ESKI_FIYAT', 'KAMPANYA_FIYATI', 'KDV_ORANI', 'INDIRIM_ORANI',
        'STOK', 'AGIRLIK', 'RAF_KONUM', 'TEDARIKCI_KODU', 'KUNYE_NO',
        'ACIKLAMA', 'RESIM', 'RESIMLER', 'VIDEOLAR', 'VIDEO_URL', 'SAKLAMA_BILGISI',
        'KAMPANYA',
        'GECERLILIK_BASLANGIC', 'GECERLILIK_BITIS', 'ONE_CIKAN', 'DURUM',
        'FIYAT_GUNCELLEME', 'ESKI_FIYAT_GUNCELLEME',
        'OLUSTURMA_TARIHI', 'GUNCELLEME_TARIHI'
    ];
    echo implode("\t", $headers) . "\n";

    // Data
    foreach ($products as $product) {
        $row = [
            $product['sku'] ?? '',
            $product['barcode'] ?? '',
            $product['slug'] ?? '',
            $product['name'] ?? '',
            $product['group'] ?? '',
            $product['category'] ?? '',
            $product['subcategory'] ?? '',
            $product['brand'] ?? '',
            $product['origin'] ?? '',
            $product['unit'] ?? '',
            $product['current_price'] ?? '',
            $product['previous_price'] ?? '',
            $product['campaign_price'] ?? '',
            $product['vat_rate'] ?? '',
            $product['discount_percent'] ?? '',
            $product['stock'] ?? '',
            $product['weight'] ?? '',
            $product['shelf_location'] ?? '',
            $product['supplier_code'] ?? '',
            $product['kunye_no'] ?? '',
            str_replace(["\t", "\n", "\r"], ' ', $product['description'] ?? ''),
            $product['image_url'] ?? '',
            $product['images'] ?? '',
            $product['videos'] ?? '',
            $product['video_url'] ?? '',
            str_replace(["\t", "\n", "\r"], ' ', $product['storage_info'] ?? ''),
            $product['campaign_text'] ?? '',
            $product['valid_from'] ?? '',
            $product['valid_until'] ?? '',
            $product['is_featured'] ?? '0',
            $product['status'] ?? 'active',
            $product['price_updated_at'] ?? '',
            $product['previous_price_updated_at'] ?? '',
            $product['created_at'] ?? '',
            $product['updated_at'] ?? ''
        ];
        echo implode("\t", $row) . "\n";
    }
    exit;
}

// Default: CSV export (semicolon-delimited for Turkish Excel)
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="products_' . date('Y-m-d') . '.csv"');

// UTF-8 BOM for Excel compatibility
echo "\xEF\xBB\xBF";

$output = fopen('php://output', 'w');

// Headers - Türkçe alan adları
$headers = [
    'STOK_KODU', 'BARKOD', 'SLUG', 'URUN_ADI', 'GRUP', 'KATEGORI', 'ALT_KATEGORI', 'MARKA', 'MENSEI', 'BIRIM',
    'SATIS_FIYATI', 'ESKI_FIYAT', 'KAMPANYA_FIYATI', 'KDV_ORANI', 'INDIRIM_ORANI',
    'STOK', 'AGIRLIK', 'RAF_KONUM', 'TEDARIKCI_KODU', 'KUNYE_NO',
    'ACIKLAMA', 'RESIM', 'RESIMLER', 'VIDEOLAR', 'VIDEO_URL', 'SAKLAMA_BILGISI',
    'KAMPANYA',
    'GECERLILIK_BASLANGIC', 'GECERLILIK_BITIS', 'ONE_CIKAN', 'DURUM',
    'FIYAT_GUNCELLEME', 'ESKI_FIYAT_GUNCELLEME',
    'OLUSTURMA_TARIHI', 'GUNCELLEME_TARIHI'
];
fputcsv($output, $headers, ';');

// Data
foreach ($products as $product) {
    fputcsv($output, [
        $product['sku'] ?? '',
        $product['barcode'] ?? '',
        $product['slug'] ?? '',
        $product['name'] ?? '',
        $product['group'] ?? '',
        $product['category'] ?? '',
        $product['subcategory'] ?? '',
        $product['brand'] ?? '',
        $product['origin'] ?? '',
        $product['unit'] ?? '',
        $product['current_price'] ?? '',
        $product['previous_price'] ?? '',
        $product['campaign_price'] ?? '',
        $product['vat_rate'] ?? '',
        $product['discount_percent'] ?? '',
        $product['stock'] ?? '',
        $product['weight'] ?? '',
        $product['shelf_location'] ?? '',
        $product['supplier_code'] ?? '',
        $product['kunye_no'] ?? '',
        $product['description'] ?? '',
        $product['image_url'] ?? '',
        $product['images'] ?? '',
        $product['videos'] ?? '',
        $product['video_url'] ?? '',
        $product['storage_info'] ?? '',
        $product['campaign_text'] ?? '',
        $product['valid_from'] ?? '',
        $product['valid_until'] ?? '',
        $product['is_featured'] ?? '0',
        $product['status'] ?? 'active',
        $product['price_updated_at'] ?? '',
        $product['previous_price_updated_at'] ?? '',
        $product['created_at'] ?? '',
        $product['updated_at'] ?? ''
    ], ';');
}

fclose($output);
exit;
