<?php
/**
 * POST /api/tenant-backup/import — Dosya yükle ve import başlat
 * Multipart form data:
 *   file: .tar.gz archive
 *   mode: "overwrite" | "new_company"
 *   company_id: target company (overwrite mode only)
 *   company_name: new company name (new_company mode only)
 *   include_media: "1" | "0"
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu işlem için SuperAdmin yetkisi gerekli');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';
require_once __DIR__ . '/../../services/NotificationTriggers.php';

// Check uploaded file
if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    Response::error('Dosya yükleme hatası', 400);
}

$uploadedFile = $_FILES['file']['tmp_name'];
$mode = $_POST['mode'] ?? 'overwrite';
$includeMedia = ($_POST['include_media'] ?? '1') === '1';

// Save to a persistent temp location
$storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__, 2) . '/storage');
$backupDir = $storageBase . '/backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0755, true);
}
$archivePath = $backupDir . '/upload_' . uniqid() . '_' . basename($_FILES['file']['name']);
move_uploaded_file($uploadedFile, $archivePath);

$service = TenantBackupService::getInstance();

if ($mode === 'new_company') {
    $newName = trim($_POST['company_name'] ?? '');
    if (empty($newName)) {
        @unlink($archivePath);
        Response::error('Yeni firma adı gerekli', 400);
    }

    $result = $service->importAsNewCompany($archivePath, $newName, [
        'include_media' => $includeMedia,
    ]);
} else {
    // overwrite mode
    $targetCompanyId = $_POST['company_id'] ?? null;
    if (!$targetCompanyId) {
        @unlink($archivePath);
        Response::error('Hedef firma (company_id) gerekli', 400);
    }

    $result = $service->importOverwrite($archivePath, $targetCompanyId, [
        'include_media' => $includeMedia,
    ]);
}

// Cleanup uploaded archive
@unlink($archivePath);

if ($result['success']) {
    Response::success($result, 'İçe aktarma başarıyla tamamlandı');
} else {
    Response::error($result['error'] ?? 'İçe aktarma başarısız', 500);
}
