<?php
/**
 * ESL Network Scanner API
 *
 * Yerel ağdaki ESL cihazlarını tarar.
 *
 * GET /api/esl-gateway/scan?subnet=192.168.1&start=1&end=254
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Request.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Router auth middleware ile gelmedigi durumlar icin fallback
$request = $request ?? new Request();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Sadece admin tarayabilir
if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'superadmin', 'admin'])) {
    Response::forbidden('Only admins can scan network');
}

$subnet = $_GET['subnet'] ?? '192.168.1';
$startIp = (int)($_GET['start'] ?? 1);
$endIp = (int)($_GET['end'] ?? 254);

// Güvenlik: IP aralığı sınırla
if ($endIp - $startIp > 50) {
    Response::error('IP range too large. Maximum 50 IPs per scan.', 400);
}

try {
    $gateway = new PavoDisplayGateway();
    $devices = $gateway->scanNetwork($subnet, $startIp, $endIp);

    Response::success([
        'subnet' => $subnet,
        'range' => "{$startIp}-{$endIp}",
        'found' => count($devices),
        'devices' => $devices
    ]);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
