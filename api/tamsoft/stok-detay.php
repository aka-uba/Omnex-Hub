<?php
/**
 * TAMSOFT ERP Stok Detay API
 * GET - Tek ürün detayı getir
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

// Stok kodu parametresi
$stokKodu = $_GET['stok_kodu'] ?? null;

if (empty($stokKodu)) {
    Response::badRequest('Stok kodu gerekli');
}

try {
    $gateway = new TamsoftGateway($companyId);
    $result = $gateway->getStokDetay($stokKodu);

    // getStokDetay() doğrudan TAMSOFT API yanıtını döndürür (tek ürün objesi)
    // success/data wrapper'ı yok - ham veri gelir
    if (!empty($result) && is_array($result)) {
        Response::success([
            'product' => $result
        ]);
    } else {
        Response::error('Stok detayı alınamadı: Beklenmeyen yanıt formatı');
    }
} catch (Exception $e) {
    Response::error('Stok detayı alınamadı: ' . $e->getMessage());
}
