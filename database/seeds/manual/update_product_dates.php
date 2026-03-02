<?php
/**
 * Mevcut ürünlerin tarih alanlarını güncelle
 * Sadece CLI'dan çalıştırın: php database/seeds/manual/update_product_dates.php
 */

require_once __DIR__ . '/../../../config.php';
require_once CORE_PATH . '/Database.php';

$db = Database::getInstance();

// Tüm ürünleri al
$products = $db->fetchAll("SELECT id, sku, name, price_updated_at, previous_price_updated_at, price_valid_until FROM products WHERE price_updated_at IS NULL OR price_updated_at = ''");

echo "Tarih alanları boş olan " . count($products) . " ürün bulundu.\n\n";

$updated = 0;
foreach ($products as $product) {
    // Rastgele tarihler oluştur
    $priceUpdatedAt = date('Y-m-d H:i:s', strtotime('-' . rand(1, 10) . ' days'));
    $previousPriceUpdatedAt = date('Y-m-d H:i:s', strtotime('-' . rand(11, 20) . ' days'));
    $priceValidUntil = date('Y-m-d', strtotime('+' . rand(5, 30) . ' days'));

    $db->update('products', [
        'price_updated_at' => $priceUpdatedAt,
        'previous_price_updated_at' => $previousPriceUpdatedAt,
        'price_valid_until' => $priceValidUntil
    ], 'id = ?', [$product['id']]);

    echo "Güncellendi: {$product['name']}\n";
    echo "  - price_updated_at: $priceUpdatedAt\n";
    echo "  - previous_price_updated_at: $previousPriceUpdatedAt\n";
    echo "  - price_valid_until: $priceValidUntil\n";
    $updated++;
}

echo "\n========================================\n";
echo "Toplam $updated ürün güncellendi.\n";
echo "========================================\n";
