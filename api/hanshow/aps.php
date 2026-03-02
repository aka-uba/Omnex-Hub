<?php
/**
 * Hanshow AP (Gateway) Listesi
 *
 * GET /api/hanshow/aps - Tum AP'leri listele
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Response::methodNotAllowed('Izin verilmeyen method');
}

$gateway = new HanshowGateway();
$result = $gateway->getAPs();

// v2.5.3 response format
if (isset($result['errno']) && $result['errno'] === 0) {
    $aps = [];

    // Flatten AP list from generation groups
    if (isset($result['ap_list'])) {
        foreach ($result['ap_list'] as $generation => $apGroup) {
            foreach ($apGroup as $ap) {
                $aps[] = [
                    'id' => $ap['id'] ?? null,
                    'mac' => $ap['mac'] ?? '',
                    'serial' => $ap['serial'] ?? '',
                    'version' => $ap['version'] ?? '',
                    'ip' => $ap['ip'] ?? '',
                    'port' => $ap['port'] ?? 0,
                    'online' => !empty($ap['online']),
                    'idle' => !empty($ap['idle']),
                    'generation' => $generation,
                    'work_mode' => $ap['work_mode'] ?? 'unknown',
                    'description' => $ap['description'] ?? '',
                    'config' => $ap['config'] ?? [],
                    'online_begin_time' => $ap['online_begin_time'] ?? null,
                    'set_heartbeats' => $ap['set_heartbeats'] ?? []
                ];
            }
        }
    }

    Response::success([
        'items' => $aps,
        'total' => count($aps)
    ]);
} else {
    $errorMsg = $result['errmsg'] ?? 'Bilinmeyen hata';
    Response::error('AP listesi alinamadi: ' . $errorMsg, 503);
}
