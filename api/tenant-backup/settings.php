<?php
/**
 * GET /api/tenant-backup/settings — Yedek ayarlarını oku
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu işlem için SuperAdmin yetkisi gerekli');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$service = TenantBackupService::getInstance();
$settings = $service->getBackupSettings();

Response::success($settings);
