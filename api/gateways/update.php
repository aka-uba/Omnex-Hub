<?php
/**
 * Gateway Update API
 *
 * PUT /api/gateways/:id - Gateway güncelle
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

$updateData = ['updated_at' => date('Y-m-d H:i:s')];

if (!empty($data['name'])) {
    $updateData['name'] = $data['name'];
}

if (isset($data['description'])) {
    $updateData['description'] = $data['description'];
}

if (isset($data['config'])) {
    $currentConfig = json_decode($gateway['config'], true) ?: [];
    $newConfig = array_merge($currentConfig, $data['config']);
    $updateData['config'] = json_encode($newConfig);
}

$db->update('gateways', $updateData, 'id = ?', [$gatewayId]);

Response::success([
    'id' => $gatewayId,
    'message' => 'Gateway güncellendi'
]);
