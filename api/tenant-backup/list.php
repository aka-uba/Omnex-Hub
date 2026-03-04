<?php
/**
 * GET /api/tenant-backup/list — Yedekleri listele
 * Query: ?company_id=xxx&limit=50&offset=0
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

require_once __DIR__ . '/../../services/TenantBackupService.php';

$companyId = $_GET['company_id'] ?? null;
$limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

// Non-superadmin can only see own company
if ($user['role'] !== 'SuperAdmin') {
    $companyId = Auth::getActiveCompanyId();
}

$service = TenantBackupService::getInstance();

// If no specific company, return summary view
if (!$companyId && $user['role'] === 'SuperAdmin') {
    $summary = $service->getCompanyBackupSummary();
    Response::success([
        'mode'    => 'summary',
        'companies' => $summary,
    ]);
}

$result = $service->listBackups($companyId, $limit, $offset);
Response::success([
    'mode'   => 'list',
    'items'  => $result['items'],
    'total'  => $result['total'],
    'limit'  => $limit,
    'offset' => $offset,
]);
