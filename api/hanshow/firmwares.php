<?php
/**
 * Hanshow ESL Firmware/Cihaz Tipleri
 *
 * GET /api/hanshow/firmwares       - Tum firmware listesi (ESL-Working'den)
 * GET /api/hanshow/firmwares/cache - Cache'deki firmware listesi
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$source = $_GET['source'] ?? 'api'; // 'api' veya 'cache'

if ($source === 'cache') {
    // Cache'den al
    $firmwares = $db->fetchAll(
        "SELECT * FROM hanshow_firmwares ORDER BY id ASC"
    );

    Response::success([
        'source' => 'cache',
        'count' => count($firmwares),
        'items' => $firmwares
    ]);
} else {
    // ESL-Working API'den al
    $gateway = new HanshowGateway();
    $result = $gateway->getFirmwares();

    if ($result['success']) {
        $firmwares = $result['data'] ?? [];

        Response::success([
            'source' => 'api',
            'count' => count($firmwares),
            'items' => $firmwares
        ]);
    } else {
        // API basarisizsa cache'den al
        $firmwares = $db->fetchAll(
            "SELECT * FROM hanshow_firmwares ORDER BY id ASC"
        );

        if (count($firmwares) > 0) {
            Response::success([
                'source' => 'cache_fallback',
                'count' => count($firmwares),
                'items' => $firmwares,
                'warning' => 'ESL-Working baglantisi basarisiz, cache kullanildi'
            ]);
        } else {
            Response::error('ESL-Working baglantisi basarisiz ve cache bos: ' . ($result['errmsg'] ?? ''));
        }
    }
}
