<?php
/**
 * POST /api/tenant-backup/peek-manifest — Read manifest from uploaded archive
 * Used by restore modal to show available data groups before actual import.
 * Multipart form data: file: .tar.gz archive
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu işlem için SuperAdmin yetkisi gerekli');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

// Check uploaded file
if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    Response::error('Dosya yükleme hatası', 400);
}

$uploadedFile = $_FILES['file']['tmp_name'];

// Save to a temp location
$storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__, 2) . '/storage');
$backupDir = $storageBase . '/backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0755, true);
}
$archivePath = $backupDir . '/peek_' . uniqid() . '_' . basename($_FILES['file']['name']);
move_uploaded_file($uploadedFile, $archivePath);

$service = TenantBackupService::getInstance();
$manifest = $service->readArchiveManifest($archivePath);

// Cleanup
@unlink($archivePath);

if (!$manifest) {
    Response::error('Arşiv dosyası okunamadı veya geçersiz', 400);
}

Response::success($manifest, 'Arşiv bilgileri okundu');
