<?php
/**
 * Label Sizes API - Delete
 *
 * DELETE /api/label-sizes/:id
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

// Global kayıtlar (company_id NULL) silinemez
if (empty($labelSize['company_id'])) {
    Response::error('Sistem varsayılan boyutları silinemez', 403);
}

// Sadece kendi şirketinin kayıtlarını silebilir
if ($labelSize['company_id'] !== $companyId) {
    Response::error('Bu kayda erişim yetkiniz yok', 403);
}

$db->delete('label_sizes', 'id = ?', [$id]);

Response::success(['deleted' => true], 'Etiket boyutu silindi');
