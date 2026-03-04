<?php
/**
 * GET /api/tenant-backup/download/{id} — Arşiv dosyası indir (streaming)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

$backupId = $request->getRouteParam('id');
if (!$backupId) {
    Response::error('Yedek ID gerekli', 400);
}

$backup = $db->fetch("SELECT * FROM tenant_backups WHERE id = ?", [$backupId]);
if (!$backup) {
    Response::error('Yedek bulunamadı', 404);
}

// Non-superadmin: verify company access
if ($user['role'] !== 'SuperAdmin') {
    $activeCompanyId = Auth::getActiveCompanyId();
    if ($backup['company_id'] !== $activeCompanyId) {
        Response::forbidden('Bu yedeğe erişim izniniz yok');
    }
}

$filePath = $backup['file_path'];
if (!$filePath || !file_exists($filePath)) {
    Response::error('Yedek dosyası bulunamadı', 404);
}

// Get company name for the filename
$company = $db->fetch("SELECT name FROM companies WHERE id = ?", [$backup['company_id']]);
$companyName = $company ? $company['name'] : '';

// Build download filename with company name
$storedFilename = $backup['filename'] ?: basename($filePath);
if ($companyName) {
    // Sanitize company name for filename (remove special chars)
    $safeName = preg_replace('/[^a-zA-Z0-9_\-\x{00C0}-\x{024F}]/u', '_', $companyName);
    $safeName = preg_replace('/_+/', '_', trim($safeName, '_'));
    // Replace backup_ prefix with company name prefix
    if (strpos($storedFilename, 'backup_') === 0) {
        $filename = $safeName . '_' . $storedFilename;
    } else {
        $filename = $safeName . '_' . $storedFilename;
    }
} else {
    $filename = $storedFilename;
}

$fileSize = filesize($filePath);

header('Content-Type: application/gzip');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . $fileSize);
header('Cache-Control: no-cache');
header('Pragma: no-cache');

readfile($filePath);
exit;
