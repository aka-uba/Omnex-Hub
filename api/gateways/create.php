<?php
/**
 * Gateway Create API
 *
 * POST /api/gateways - Yeni gateway oluştur
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$data = $request->all();

$name = $data['name'] ?? '';
$description = $data['description'] ?? null;

if (empty($name)) {
    Response::error('Gateway adı gerekli', 400);
}

$gatewayId = $db->generateUuid();
$apiKey = bin2hex(random_bytes(16)); // 32 karakter
$apiSecret = bin2hex(random_bytes(32)); // 64 karakter

$db->insert('gateways', [
    'id' => $gatewayId,
    'company_id' => $companyId,
    'name' => $name,
    'description' => $description,
    'api_key' => $apiKey,
    'api_secret' => $apiSecret, // Plain text - HMAC için gerekli
    'status' => 'offline',
    'config' => json_encode([
        'polling_interval' => $data['polling_interval'] ?? 5,
        'command_timeout' => $data['command_timeout'] ?? 30,
        'retry_count' => $data['retry_count'] ?? 3
    ])
]);

Response::success([
    'id' => $gatewayId,
    'name' => $name,
    'api_key' => $apiKey,
    'api_secret' => $apiSecret, // Sadece oluşturulurken gösterilir!
    'message' => 'Gateway oluşturuldu',
    'warning' => 'api_secret sadece bir kez gösterilir, kaydedin!'
]);
