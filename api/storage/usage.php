<?php
/**
 * Storage Usage API
 *
 * GET: Firma depolama kullanım bilgilerini döner
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

// Company ID belirleme
$companyId = Auth::getActiveCompanyId();
if (!$companyId) {
    Response::error('Firma bilgisi bulunamadı', 400);
}

$storageService = new StorageService();

// Formatlanmış kullanım bilgisi
$usage = $storageService->getFormattedUsage($companyId);

Response::success([
    'company_id' => $companyId,
    'usage' => $usage['usage'],
    'usage_mb' => $usage['usage_mb'],
    'limit_mb' => $usage['limit_mb'],
    'unlimited' => $usage['unlimited'],
    'percent_used' => $usage['percent_used'],
    'status' => $usage['status'],
    'last_calculated_at' => $usage['last_calculated_at']
]);
