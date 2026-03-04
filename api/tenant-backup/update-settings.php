<?php
/**
 * PUT /api/tenant-backup/settings — Yedek ayarlarını güncelle
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu işlem için SuperAdmin yetkisi gerekli');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    Response::error('Geçersiz veri', 400);
}

$service = TenantBackupService::getInstance();
$current = $service->getBackupSettings();

// Merge only allowed fields
$allowed = ['enabled', 'cycle', 'retention_count', 'include_media_default'];
foreach ($allowed as $key) {
    if (isset($data[$key])) {
        $current[$key] = $data[$key];
    }
}

// Validate
if (!in_array($current['cycle'], ['daily', 'weekly', 'monthly'])) {
    Response::error('Geçersiz döngü değeri', 400);
}
$current['retention_count'] = max(1, min(100, (int)$current['retention_count']));

$service->saveBackupSettings($current);

Response::success($current, 'Ayarlar güncellendi');
