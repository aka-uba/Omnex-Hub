<?php
/**
 * Device Network Configuration API
 *
 * POST /api/devices/:id/network-config
 *
 * Cihaz network ayarlarını yapılandırma endpoint'i
 * Bluetooth komutları hazırlar (frontend Web Bluetooth ile gönderir)
 *
 * Actions:
 * - prepare_static_ip: Sabit IP atama komutu
 * - prepare_dhcp: DHCP modu komutu
 * - prepare_wifi: WiFi ayarlama komutu
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');
$body = $request->body();

$action = $body['action'] ?? '';

// Validate action
$allowedActions = ['prepare_static_ip', 'prepare_dhcp', 'prepare_wifi'];
if (!in_array($action, $allowedActions)) {
    Response::badRequest('Geçersiz işlem: ' . $action);
}

// Get device
$device = $db->fetch(
    "SELECT * FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Check if device is PavoDisplay ESL
$isPavoDisplay = ($device['type'] === 'esl' || $device['model'] === 'esl_android' || $device['model'] === 'PavoDisplay');

if (!$isPavoDisplay) {
    Response::badRequest('Bu işlem sadece PavoDisplay cihazlar için desteklenmektedir');
}

// Load PavoDisplayGateway
require_once BASE_PATH . '/services/PavoDisplayGateway.php';
$gateway = new PavoDisplayGateway();

$result = [
    'device_id' => $deviceId,
    'device_name' => $device['name'],
    'action' => $action,
    'success' => false
];

try {
    switch ($action) {
        case 'prepare_static_ip':
            $ip = $body['ip'] ?? null;
            $gateway_addr = $body['gateway'] ?? null;
            $netmask = $body['netmask'] ?? '255.255.255.0';
            $token = $body['token'] ?? '';

            if (!$ip || !$gateway_addr) {
                Response::badRequest('IP adresi ve gateway gereklidir');
            }

            // IP format kontrolü
            if (!filter_var($ip, FILTER_VALIDATE_IP) || !filter_var($gateway_addr, FILTER_VALIDATE_IP)) {
                Response::badRequest('Geçersiz IP adresi formatı');
            }

            $result = array_merge($result, $gateway->prepareStaticIpCommand($ip, $gateway_addr, $netmask, $token));
            break;

        case 'prepare_dhcp':
            $token = $body['token'] ?? '';
            $result = array_merge($result, $gateway->prepareDhcpCommand($token));
            break;

        case 'prepare_wifi':
            $ssid = $body['ssid'] ?? null;
            $password = $body['password'] ?? null;
            $token = $body['token'] ?? '';

            if (!$ssid || !$password) {
                Response::badRequest('WiFi SSID ve şifre gereklidir');
            }

            $result = array_merge($result, $gateway->prepareWifiCommand($ssid, $password, $token));
            break;
    }

    // Log the action
    Logger::audit('network_config', 'devices', [
        'device_id' => $deviceId,
        'device_name' => $device['name'],
        'action' => $action,
        'user_id' => $user['id']
    ]);

    if ($result['success']) {
        Response::success($result);
    } else {
        Response::json(['success' => false, 'message' => $result['message'] ?? 'İşlem başarısız', 'data' => $result], 400);
    }

} catch (Exception $e) {
    Logger::error('Network config error', [
        'device_id' => $deviceId,
        'action' => $action,
        'error' => $e->getMessage()
    ]);
    Response::error('Network yapılandırma hatası: ' . $e->getMessage());
}
