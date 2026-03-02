<?php
/**
 * Label Sizes API - Update
 *
 * PUT /api/label-sizes/:id
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../core/Request.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();

$id = $request->getRouteParam('id');
if (!$id) {
    Response::error('ID gerekli', 400);
}

// Mevcut kaydı kontrol et
$labelSize = $db->fetch(
    "SELECT * FROM label_sizes WHERE id = ?",
    [$id]
);

if (!$labelSize) {
    Response::error('Etiket boyutu bulunamadı', 404);
}

$input = json_decode(file_get_contents('php://input'), true);

// Sistem kayıtları için sadece is_active değiştirilebilir
$isSystemRecord = empty($labelSize['company_id']);

if ($isSystemRecord) {
    // Sistem kaydı: Sadece is_active güncellenebilir
    if (!isset($input['is_active'])) {
        Response::error('Sistem varsayılan boyutları için sadece aktif/pasif durumu değiştirilebilir', 403);
    }

    $updates = [
        'is_active' => $input['is_active'] ? 1 : 0,
        'updated_at' => date('Y-m-d H:i:s')
    ];
} else {
    // Şirket kaydı: Sadece kendi şirketinin kayıtlarını düzenleyebilir
    if ($labelSize['company_id'] !== $companyId) {
        Response::error('Bu kayda erişim yetkiniz yok', 403);
    }

    $updates = [
        'updated_at' => date('Y-m-d H:i:s')
    ];

    if (isset($input['name'])) {
        $updates['name'] = trim($input['name']);
    }

    if (isset($input['width'])) {
        $width = floatval($input['width']);
        if ($width > 0) {
            $updates['width'] = $width;
        }
    }

    if (isset($input['height'])) {
        $height = floatval($input['height']);
        if ($height > 0) {
            $updates['height'] = $height;
        }
    }

    if (isset($input['unit']) && in_array($input['unit'], ['mm', 'inch'])) {
        $updates['unit'] = $input['unit'];
    }

    if (isset($input['is_default'])) {
        $updates['is_default'] = $input['is_default'] ? 1 : 0;
    }

    if (isset($input['is_active'])) {
        $updates['is_active'] = $input['is_active'] ? 1 : 0;
    }

    if (isset($input['sort_order'])) {
        $updates['sort_order'] = intval($input['sort_order']);
    }
}

$db->update('label_sizes', $updates, 'id = ?', [$id]);

$labelSize = $db->fetch("SELECT * FROM label_sizes WHERE id = ?", [$id]);

Response::success($labelSize, 'Etiket boyutu güncellendi');
