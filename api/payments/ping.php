<?php
/**
 * Payment Gateway Connection Test
 *
 * GET - Iyzico veya Paynet baglanti testi (?provider=iyzico|paynet)
 *
 * Supports both Iyzico and Paynet payment gateways
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';
require_once __DIR__ . '/../../services/PaynetGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Admin ve SuperAdmin erisimine izin ver
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu isleme yetkiniz yok');
}

if ((new Request())->getMethod() !== 'GET') {
    Response::methodNotAllowed('Sadece GET desteklenir');
}

// Provider parametresini al (varsayilan: iyzico)
$provider = $_GET['provider'] ?? 'iyzico';
if (!in_array($provider, ['iyzico', 'paynet'])) {
    $provider = 'iyzico';
}

try {
    if ($provider === 'paynet') {
        $gateway = new PaynetGateway();
    } else {
        $gateway = new IyzicoGateway();
    }

    $result = $gateway->ping();
    $result['provider'] = $provider;

    Response::success($result);

} catch (Exception $e) {
    Logger::error('Payment ping error', ['error' => $e->getMessage(), 'provider' => $provider]);
    Response::success([
        'success' => false,
        'online' => false,
        'error' => $e->getMessage(),
        'provider' => $provider
    ]);
}
