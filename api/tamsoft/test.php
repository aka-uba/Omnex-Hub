<?php
/**
 * TAMSOFT ERP Connection Test API
 * GET - Bağlantı testi yap
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
    $result = $gateway->ping();

    if ($result['success']) {
        Response::success([
            'connected' => true,
            'response_time' => $result['response_time'] ?? null,
            'token_expires_in' => $result['token_expires_in'] ?? null,
            'message' => 'TAMSOFT ERP bağlantısı başarılı'
        ]);
    } else {
        Response::error($result['message'] ?? 'Bağlantı başarısız', 400, [
            'connected' => false,
            'error' => $result['error'] ?? null
        ]);
    }
} catch (Exception $e) {
    Response::error('Bağlantı testi başarısız: ' . $e->getMessage(), 500, [
        'connected' => false
    ]);
}
