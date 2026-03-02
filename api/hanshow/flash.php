<?php
/**
 * Hanshow ESL LED Flash Control
 *
 * POST /api/hanshow/flash
 *
 * ESL cihazına LED flash sinyali gönderir
 *
 * Request:
 * {
 *   "esl_id": "50-F5-07-05",
 *   "colors": ["green", "red"],      // Opsiyonel, varsayılan: ["green"]
 *   "flash_count": 3,                // Opsiyonel, varsayılan: 3
 *   "loop_count": 2                  // Opsiyonel, varsayılan: 2
 * }
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    Response::methodNotAllowed('İzin verilmeyen method');
}

$data = $request->body();
$eslId = $data['esl_id'] ?? '';

if (empty($eslId)) {
    Response::badRequest('ESL ID gerekli');
}

// ESL ID formatını temizle
$eslId = strtoupper(trim($eslId));
// Tiresiz ise tireli formata çevir
$eslIdNoDash = str_replace('-', '', $eslId);
if (strlen($eslIdNoDash) === 8 && strpos($eslId, '-') === false) {
    $eslId = implode('-', str_split($eslIdNoDash, 2));
}

// LED ayarları
$colors = $data['colors'] ?? ['green'];
$options = [
    'on_time' => $data['on_time'] ?? 100,
    'off_time' => $data['off_time'] ?? 100,
    'flash_count' => $data['flash_count'] ?? 3,
    'sleep_time' => $data['sleep_time'] ?? 200,
    'loop_count' => $data['loop_count'] ?? 2
];

$gateway = new HanshowGateway();

try {
    $result = $gateway->flashLight($eslId, $colors, $options);

    // v2.5.3 errno kontrolü
    $isSuccess = (isset($result['errno']) && $result['errno'] <= 1) ||
                 (isset($result['status_no']) && $result['status_no'] <= 1);

    if ($isSuccess) {
        Response::success([
            'sent' => true,
            'esl_id' => $eslId,
            'colors' => $colors,
            'message' => $result['errno'] === 1 ? 'LED flash sinyali gönderildi, işleniyor...' : 'LED flash sinyali başarıyla gönderildi'
        ]);
    } else {
        $errorMsg = $result['errmsg'] ?? 'Bilinmeyen hata';
        Response::error("LED sinyal gönderilemedi: {$errorMsg}", 400);
    }

} catch (Exception $e) {
    Response::error('LED sinyal hatası: ' . $e->getMessage());
}
