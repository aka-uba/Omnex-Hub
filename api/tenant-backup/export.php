<?php
/**
 * POST /api/tenant-backup/export — Manuel yedek tetikle
 * Body: { "company_id": "uuid", "include_media": false }
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';
require_once __DIR__ . '/../../services/NotificationTriggers.php';

$data = json_decode(file_get_contents('php://input'), true);
$companyId = $data['company_id'] ?? null;
$includeMedia = $data['include_media'] ?? false;

// Non-superadmin: force own company
if ($user['role'] !== 'SuperAdmin') {
    $companyId = Auth::getActiveCompanyId();
}

if (!$companyId) {
    Response::error('company_id gerekli', 400);
}

// Check if an export is already running for this company
$running = $db->fetch(
    "SELECT id FROM tenant_backups WHERE company_id = ? AND status = 'running'",
    [$companyId]
);
if ($running) {
    Response::error('Bu firma için zaten devam eden bir yedekleme var', 409);
}

$service = TenantBackupService::getInstance();
$result = $service->exportCompany($companyId, [
    'include_media' => $includeMedia,
    'backup_type'   => 'manual',
    'created_by'    => $user['id'],
]);

// Send notification
if ($result['success']) {
    NotificationTriggers::onTenantBackupCompleted($companyId, $result);
} else {
    NotificationTriggers::onTenantBackupFailed($companyId, $result['error'] ?? 'Bilinmeyen hata');
}

if ($result['success']) {
    Response::success($result, 'Yedek başarıyla oluşturuldu');
} else {
    Response::error($result['error'] ?? 'Yedekleme başarısız', 500);
}
