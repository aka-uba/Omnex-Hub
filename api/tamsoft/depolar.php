<?php
/**
 * TAMSOFT ERP Depolar API
 * GET - Depo listesini getir
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/TamsoftGateway.php';

$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

try {
    $gateway = new TamsoftGateway($companyId);
    $result = $gateway->getDepolar();

    // getDepolar() doğrudan TAMSOFT API yanıtını döndürür (array of depolar)
    // success/data wrapper'ı yok - ham veri gelir
    if (is_array($result)) {
        // B3: Depoları şubelere otomatik eşle
        $mappingResult = null;
        try {
            $mappingResult = $gateway->mapDepotsToBranches($result, $companyId);
        } catch (Exception $e) {
            error_log("[TAMSOFT depolar] Branch mapping hatası: " . $e->getMessage());
        }

        $responseData = [
            'depolar' => $result,
            'total' => count($result)
        ];

        if ($mappingResult) {
            $responseData['branch_mapping'] = $mappingResult;
        }

        Response::success($responseData);
    } else {
        Response::error('Depo listesi alınamadı: Beklenmeyen yanıt formatı');
    }
} catch (Exception $e) {
    Response::error('Depo listesi alınamadı: ' . $e->getMessage());
}
