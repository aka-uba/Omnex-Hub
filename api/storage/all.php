<?php
/**
 * All Companies Storage Usage API (Admin)
 *
 * GET: Tüm firmaların depolama kullanım bilgilerini döner
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

require_once dirname(dirname(__DIR__)) . '/config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/services/StorageService.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Admin kontrolü
if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'superadmin', 'admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

$storageService = new StorageService();

// Tüm firmaların kullanım özeti
$companies = $storageService->getAllCompaniesUsage();

// Genel istatistikler
$totalUsage = 0;
$totalLimit = 0;
$criticalCount = 0;
$warningCount = 0;

foreach ($companies as $company) {
    $totalUsage += $company['usage_bytes'];
    if ($company['limit_mb'] > 0) {
        $totalLimit += $company['limit_mb'];
    }
    if ($company['status'] === 'critical') {
        $criticalCount++;
    } elseif ($company['status'] === 'warning') {
        $warningCount++;
    }
}

Response::success([
    'companies' => $companies,
    'summary' => [
        'total_companies' => count($companies),
        'total_usage_mb' => round($totalUsage / 1024 / 1024, 2),
        'total_limit_mb' => $totalLimit,
        'critical_count' => $criticalCount,
        'warning_count' => $warningCount
    ]
]);
