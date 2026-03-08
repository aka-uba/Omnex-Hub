<?php
/**
 * GET /api/tenant-backup/table-groups — Get available backup groups with row counts
 * Query: ?company_id=uuid (optional, SuperAdmin only)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$companyId = $_GET['company_id'] ?? null;

// Non-superadmin: force own company
if ($user['role'] !== 'SuperAdmin') {
    $companyId = Auth::getActiveCompanyId();
}

$service = TenantBackupService::getInstance();
$groups = $service->getTableGroupsInfo($companyId);

Response::success($groups);
