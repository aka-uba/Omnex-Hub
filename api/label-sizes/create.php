<?php
/**
 * Label Sizes API - Create
 *
 * POST /api/label-sizes
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();

$input = json_decode(file_get_contents('php://input'), true);

// Validasyon
if (empty($input['width']) || empty($input['height'])) {
    Response::error('Genişlik ve yükseklik zorunludur', 400);
}

$width = floatval($input['width']);
$height = floatval($input['height']);

if ($width <= 0 || $height <= 0) {
    Response::error('Genişlik ve yükseklik pozitif olmalıdır', 400);
}

$unit = $input['unit'] ?? 'mm';
if (!in_array($unit, ['mm', 'inch'])) {
    $unit = 'mm';
}

// Otomatik isim oluştur
$name = $input['name'] ?? "{$width}x{$height} {$unit}";

// Aynı boyutun daha önce eklenmediğinden emin ol
$existing = $db->fetch(
    "SELECT id FROM label_sizes
     WHERE company_id = ? AND width = ? AND height = ?",
    [$companyId, $width, $height]
);

if ($existing) {
    Response::error('Bu boyut zaten mevcut', 400);
}

// Sıra numarası hesapla
$maxSort = $db->fetch(
    "SELECT MAX(sort_order) as max_sort FROM label_sizes WHERE company_id = ?",
    [$companyId]
);
$sortOrder = ($maxSort['max_sort'] ?? 0) + 1;

$id = $db->generateUuid();

$db->insert('label_sizes', [
    'id' => $id,
    'company_id' => $companyId,
    'name' => $name,
    'width' => $width,
    'height' => $height,
    'unit' => $unit,
    'is_default' => $input['is_default'] ?? 0,
    'is_active' => 1,
    'sort_order' => $sortOrder,
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
]);

$labelSize = $db->fetch("SELECT * FROM label_sizes WHERE id = ?", [$id]);

Response::success($labelSize, 'Etiket boyutu oluşturuldu');
