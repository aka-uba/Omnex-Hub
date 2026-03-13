<?php
/**
 * Gateway Delete API
 *
 * DELETE /api/gateways/:id - Gateway sil
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$gatewayId = $request->getRouteParam('id');

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

// İlişkili kayıtları sil
try {
    $db->beginTransaction();
    $db->delete('gateway_commands', 'gateway_id = ?', [$gatewayId]);
    $db->delete('gateway_devices', 'gateway_id = ?', [$gatewayId]);
    $db->delete('gateways', 'id = ?', [$gatewayId]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Gateway delete error', [
        'gateway_id' => $gatewayId,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

Response::success([
    'id' => $gatewayId,
    'message' => 'Gateway silindi'
]);
