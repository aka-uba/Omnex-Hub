<?php
/**
 * DELETE /api/tenant-backup/{id} — Yedeği sil
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu işlem için SuperAdmin yetkisi gerekli');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$backupId = $request->getRouteParam('id');
if (!$backupId) {
    Response::error('Yedek ID gerekli', 400);
}

$service = TenantBackupService::getInstance();
$deleted = $service->deleteBackup($backupId);

if ($deleted) {
    Response::success(null, 'Yedek silindi');
} else {
    Response::error('Yedek bulunamadı', 404);
}
