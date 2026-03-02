<?php
/**
 * TAMSOFT ERP Sync API
 * POST - Ürün senkronizasyonu başlat
 * GET - Son senkronizasyon durumunu getir
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/TamsoftGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Son senkronizasyon loglarını getir
            $logs = $db->fetchAll(
                "SELECT * FROM tamsoft_sync_logs
                 WHERE company_id = ?
                 ORDER BY created_at DESC
                 LIMIT 10",
                [$companyId]
            );

            // Son başarılı senkronizasyon
            $lastSuccess = $db->fetch(
                "SELECT * FROM tamsoft_sync_logs
                 WHERE company_id = ? AND status = 'completed'
                 ORDER BY completed_at DESC
                 LIMIT 1",
                [$companyId]
            );

            // Ayarlardan son sync tarihi
            $settings = $db->fetch(
                "SELECT last_sync_date FROM tamsoft_settings WHERE company_id = ?",
                [$companyId]
            );

            Response::success([
                'logs' => $logs,
                'last_success' => $lastSuccess,
                'last_sync_date' => $settings['last_sync_date'] ?? null
            ]);
            break;

        case 'POST':
            // Senkronizasyon başlat
            $input = json_decode(file_get_contents('php://input'), true);

            // A3 FIX: intval("all") = 0 problemi - is_numeric kontrolü ekle
            $rawDepoId = $input['depo_id'] ?? null;
            $depoId = ($rawDepoId !== null && is_numeric($rawDepoId)) ? intval($rawDepoId) : 0;
            $fullSync = boolval($input['full_sync'] ?? false);
            $allDepots = boolval($input['all_depots'] ?? false);

            $gateway = new TamsoftGateway($companyId);

            // Tüm depolar mı yoksa tek depo mu?
            if ($allDepots) {
                $result = $gateway->syncAllProducts([
                    'full_sync' => $fullSync
                ], function($progress) {
                    // Progress callback
                });
            } else {
                $result = $gateway->syncProducts([
                    'depoid' => $depoId,
                    'full_sync' => $fullSync
                ], function($progress) {
                    // Progress callback
                });
            }

            if ($result['success']) {
                $responseData = [
                    'message' => 'Senkronizasyon tamamlandı',
                    'summary' => [
                        'total' => $result['total'] ?? 0,
                        'inserted' => $result['inserted'] ?? 0,
                        'updated' => $result['updated'] ?? 0,
                        'failed' => $result['failed'] ?? 0,
                        'render_jobs_created' => $result['render_jobs_created'] ?? 0
                    ]
                ];

                // Tüm depolar modunda depo bazlı detayları da ekle
                if ($allDepots && !empty($result['depo_results'])) {
                    $responseData['summary']['depo_count'] = $result['depo_count'] ?? 0;
                    $responseData['summary']['depo_results'] = $result['depo_results'];
                }

                Response::success($responseData);
            } else {
                $errors = $result['errors'] ?? [];
                $errorMsg = !empty($errors) ? ($errors[0]['error'] ?? 'Senkronizasyon başarısız') : 'Senkronizasyon başarısız';
                Response::error($errorMsg, 400, [
                    'summary' => [
                        'total' => $result['total'] ?? 0,
                        'inserted' => $result['inserted'] ?? 0,
                        'updated' => $result['updated'] ?? 0,
                        'failed' => $result['failed'] ?? 0
                    ]
                ]);
            }
            break;

        default:
            Response::methodNotAllowed('Desteklenmeyen metod');
    }
} catch (Exception $e) {
    Response::error('İşlem başarısız: ' . $e->getMessage());
}
