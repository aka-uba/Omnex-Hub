<?php
/**
 * Hanshow ESL-Working Baglanti Testi
 *
 * GET /api/hanshow/ping
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$gateway = new HanshowGateway();
$result = $gateway->ping();

if ($result['success']) {
    Response::success([
        'online' => true,
        'response_time' => $result['response_time'],
        'connected_aps' => $result['connected_aps'] ?? 0,
        'ap_list' => $result['data']['ap_list'] ?? []
    ], 'ESL-Working baglantisi basarili');
} else {
    $errorMsg = $result['data']['errmsg'] ?? $result['errmsg'] ?? 'Bilinmeyen hata';
    Response::error('ESL-Working baglantisi basarisiz: ' . $errorMsg, 503);
}
