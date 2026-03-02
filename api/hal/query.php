<?php
/**
 * HAL Künye Sorgulama API
 *
 * POST /api/hal/query
 * Body: { "kunye_no": "2073079250202837944" }
 *
 * GET /api/hal/query?kunye_no=2073079250202837944
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $kunyeNo = $_GET['kunye_no'] ?? '';
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $kunyeNo = $input['kunye_no'] ?? '';
} else {
    Response::error('Method not allowed', 405);
}

if (empty($kunyeNo)) {
    Response::error('Künye numarası gerekli', 400);
}

// Künye numarasını temizle
$kunyeNo = preg_replace('/[^0-9]/', '', $kunyeNo);

if (strlen($kunyeNo) !== 19) {
    Response::error('Künye numarası 19 haneli olmalıdır', 400);
}

try {
    require_once __DIR__ . '/../../services/HalKunyeService.php';

    // HalKunyeService kendi içinde SettingsResolver + eski settings fallback ile
    // ayarları yükler ve credentials kontrolü yapar
    $service = new HalKunyeService();

    // queryByKunyeNo: SOAP API (cURL + PHP SoapClient) ve web scraping dener
    $result = $service->queryByKunyeNo($kunyeNo);

    if ($result['success']) {
        Response::success($result['data'], 'Künye bilgisi başarıyla alındı');
    } else {
        $errorData = [
            'error' => $result['error'] ?? 'Künye sorgulanamadı',
            'kunye_no' => $kunyeNo,
            'requires_captcha' => $result['requires_captcha'] ?? false,
            'manual_query_url' => $result['manual_query_url'] ?? 'https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx',
            'hint' => $result['hint'] ?? null,
            'has_credentials' => $service->hasCredentials(),
            'method' => $result['method'] ?? null
        ];
        Response::error($result['error'] ?? 'Künye sorgulanamadı', 404, $errorData);
    }

} catch (Exception $e) {
    Response::error('Sorgu hatası: ' . $e->getMessage(), 500);
}
