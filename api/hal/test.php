<?php
/**
 * HAL Bağlantı Testi API
 *
 * GET /api/hal/test
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../services/HalKunyeService.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $service = new HalKunyeService();
    $result = $service->testConnection();

    Response::success($result, $result['success'] ? 'Bağlantı başarılı' : 'Bağlantı başarısız');

} catch (Exception $e) {
    Response::error('Test hatası: ' . $e->getMessage(), 500);
}
