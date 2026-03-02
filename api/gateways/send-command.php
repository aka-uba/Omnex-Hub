<?php
/**
 * Gateway Send Command API
 *
 * POST /api/gateways/:id/command - Gateway'e komut gönder
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$gatewayId = $request->getRouteParam('id');
$data = $request->all();

if (!$gatewayId) {
    Response::error('Gateway ID gerekli', 400);
}

// Gateway'in bu firmaya ait olduğunu doğrula
$gateway = $db->fetch(
    "SELECT * FROM gateways WHERE id = ? AND company_id = ?",
    [$gatewayId, $companyId]
);

if (!$gateway) {
    Response::notFound('Gateway bulunamadı');
}

$command = $data['command'] ?? null;
$deviceId = $data['device_id'] ?? null;
$parameters = $data['parameters'] ?? [];
$priority = $data['priority'] ?? 0;
$expiresIn = $data['expires_in'] ?? 3600; // Varsayılan 1 saat

if (!$command) {
    Response::error('command gerekli', 400);
}

// Desteklenen komutlar
$validCommands = [
    // Cihaz komutları
    'ping', 'refresh', 'reboot', 'clear_cache', 'set_brightness',
    'upload_content', 'sync_content', 'get_status',
    // Gateway komutları
    'scan_network', 'update_config', 'restart_gateway'
];

if (!in_array($command, $validCommands)) {
    Response::error('Geçersiz komut: ' . $command, 400);
}

// Cihaz komutu ise device_id'yi doğrula
if ($deviceId) {
    $gatewayDevice = $db->fetch(
        "SELECT * FROM gateway_devices WHERE gateway_id = ? AND device_id = ?",
        [$gatewayId, $deviceId]
    );

    if (!$gatewayDevice) {
        Response::error('Cihaz bu gateway\'e bağlı değil', 400);
    }
}

$commandId = $db->generateUuid();
$expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);

$db->insert('gateway_commands', [
    'id' => $commandId,
    'gateway_id' => $gatewayId,
    'device_id' => $deviceId,
    'command' => $command,
    'parameters' => json_encode($parameters),
    'priority' => $priority,
    'status' => 'pending',
    'expires_at' => $expiresAt,
    'created_by' => $user['id']
]);

Response::success([
    'command_id' => $commandId,
    'gateway_id' => $gatewayId,
    'device_id' => $deviceId,
    'command' => $command,
    'status' => 'pending',
    'expires_at' => $expiresAt,
    'message' => 'Komut kuyruğa eklendi'
]);
