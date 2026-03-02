<?php
/**
 * Storage Recalculate API
 *
 * POST: Depolama kullanımını yeniden hesaplar (disk tarama)
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

// Kullanımı yeniden hesapla (disk tarama)
$usage = $storageService->recalculateUsage($companyId);

// Limit bilgisini al
$limit = $storageService->getLimit($companyId);
$unlimited = ($limit <= 0);

$percentUsed = 0;
if (!$unlimited && $limit > 0) {
    $usedMB = $usage['total_bytes'] / 1024 / 1024;
    $percentUsed = min(100, round(($usedMB / $limit) * 100, 1));
}

// Audit log
if (class_exists('Logger')) {
    Logger::audit('storage_recalculate', 'company', [
        'company_id' => $companyId,
        'total_bytes' => $usage['total_bytes'],
        'recalculated_by' => $user['id']
    ]);
}

Response::success([
    'company_id' => $companyId,
    'usage' => $usage,
    'usage_mb' => [
        'media' => round($usage['media_bytes'] / 1024 / 1024, 2),
        'templates' => round($usage['templates_bytes'] / 1024 / 1024, 2),
        'renders' => round($usage['renders_bytes'] / 1024 / 1024, 2),
        'total' => round($usage['total_bytes'] / 1024 / 1024, 2)
    ],
    'limit_mb' => $limit,
    'unlimited' => $unlimited,
    'percent_used' => $percentUsed,
    'recalculated_at' => $usage['last_calculated_at']
], 'Depolama kullanımı yeniden hesaplandı');
