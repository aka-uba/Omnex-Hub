<?php
/**
 * Hanshow ESL LED ve Sayfa Kontrolu
 *
 * POST /api/hanshow/control/led   - LED yanip sonme
 * POST /api/hanshow/control/page  - Sayfa degistirme
 *
 * Body (LED):
 * {
 *   "esl_id": "55-3D-5F-67",       // Tek ESL
 *   "esl_ids": ["...", "..."],     // veya coklu ESL
 *   "colors": ["red", "green"],
 *   "on_time": 100,
 *   "off_time": 100,
 *   "flash_count": 3,
 *   "loop_count": 2
 * }
 *
 * Body (Page):
 * {
 *   "esl_id": "55-3D-5F-67",
 *   "page_id": 1,
 *   "stay_time": 10
 * }
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$gateway = new HanshowGateway();

// LED kontrolu
if (strpos($path, '/led') !== false) {
    // Tek veya coklu ESL kontrolu
    $eslIds = [];
    if (!empty($data['esl_ids']) && is_array($data['esl_ids'])) {
        $eslIds = $data['esl_ids'];
    } elseif (!empty($data['esl_id'])) {
        $eslIds = [$data['esl_id']];
    }

    if (empty($eslIds)) {
        Response::badRequest('esl_id veya esl_ids gerekli');
    }

    $colors = $data['colors'] ?? ['green'];
    $options = [
        'on_time' => $data['on_time'] ?? 100,
        'off_time' => $data['off_time'] ?? 100,
        'flash_count' => $data['flash_count'] ?? 3,
        'sleep_time' => $data['sleep_time'] ?? 200,
        'loop_count' => $data['loop_count'] ?? 2,
        'priority' => $data['priority'] ?? 1
    ];

    if (count($eslIds) === 1) {
        $result = $gateway->flashLight($eslIds[0], $colors, $options);
    } else {
        $result = $gateway->batchFlashLight($eslIds, $colors, $options);
    }

    // v2.5.3 errno kontrolü (0=başarılı, 1=işleniyor)
    $isSuccess = (isset($result['errno']) && $result['errno'] <= 1) ||
                 (isset($result['status_no']) && $result['status_no'] <= 1);

    if ($isSuccess) {
        $message = ($result['errno'] ?? $result['status_no'] ?? 0) === 1
            ? 'LED komutu gönderildi, işleniyor...'
            : 'LED komutu başarıyla gönderildi';

        Response::success([
            'esl_count' => count($eslIds),
            'colors' => $colors,
            'message' => $message
        ]);
    } else {
        Response::error('LED komutu basarisiz: ' . ($result['errmsg'] ?? 'Bilinmeyen hata'));
    }
}

// Sayfa degistirme
elseif (strpos($path, '/page') !== false) {
    if (empty($data['esl_id'])) {
        Response::badRequest('esl_id gerekli');
    }

    $eslId = $data['esl_id'];
    $pageId = $data['page_id'] ?? 0;
    $stayTime = $data['stay_time'] ?? 10;

    $result = $gateway->switchPage($eslId, $pageId, $stayTime);

    // v2.5.3 errno kontrolü (0=başarılı, 1=işleniyor)
    $isSuccess = (isset($result['errno']) && $result['errno'] <= 1) ||
                 (isset($result['status_no']) && $result['status_no'] <= 1);

    if ($isSuccess) {
        Response::success([
            'esl_id' => $eslId,
            'page_id' => $pageId,
            'stay_time' => $stayTime,
            'message' => 'Sayfa degistirme komutu gonderildi'
        ]);
    } else {
        Response::error('Sayfa degistirme basarisiz: ' . ($result['errmsg'] ?? 'Bilinmeyen hata'));
    }
}

else {
    Response::notFound('Bilinmeyen kontrol endpoint');
}
