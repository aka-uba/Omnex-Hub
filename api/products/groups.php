<?php
/**
 * Product Groups API
 *
 * Ürünlerdeki benzersiz grup (kategori) değerlerini döndürür
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

// Benzersiz grup değerlerini çek
$groups = $db->fetchAll(
    "SELECT DISTINCT \"group\" as name
     FROM products
     WHERE company_id = ?
       AND \"group\" IS NOT NULL
       AND \"group\" != ''
     ORDER BY \"group\" ASC",
    [$companyId]
);

// ID olarak index ekle
$result = [];
foreach ($groups as $index => $group) {
    $result[] = [
        'id' => $group['name'], // Grup adını ID olarak kullan
        'name' => $group['name']
    ];
}

Response::success($result, 'Ürün grupları');
