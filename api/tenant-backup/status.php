<?php
/**
 * GET /api/tenant-backup/status/{id} — Yedek durum/ilerleme sorgusu
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$backupId = $request->getRouteParam('id');
if (!$backupId) {
    Response::error('Yedek ID gerekli', 400);
}

$service = TenantBackupService::getInstance();
$status = $service->getBackupStatus($backupId);

if (!$status) {
    Response::error('Yedek bulunamadı', 404);
}

// Non-superadmin: verify company access
if ($user['role'] !== 'SuperAdmin') {
    $activeCompanyId = Auth::getActiveCompanyId();
    if ($status['company_id'] !== $activeCompanyId) {
        Response::forbidden('Bu yedeğe erişim izniniz yok');
    }
}

// Parse tables_exported JSON
if (!empty($status['tables_exported'])) {
    $status['tables_exported'] = json_decode($status['tables_exported'], true) ?: [];
}

Response::success($status);
