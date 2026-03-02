<?php
/**
 * Gateway Devices API
 *
 * GET /api/gateways/:id/devices - Gateway'e bağlı cihazları listele
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

$devices = $db->fetchAll(
    "SELECT
        gd.*,
        d.name as device_name,
        d.type as device_type,
        d.model,
        d.device_id as serial_number,
        d.screen_width,
        d.screen_height,
        d.status as device_status,
        d.ip_address as global_ip,
        (SELECT COUNT(*) FROM gateway_commands gc
         WHERE gc.gateway_id = gd.gateway_id
         AND gc.device_id = gd.device_id
         AND gc.status = 'pending') as pending_commands
    FROM gateway_devices gd
    JOIN devices d ON d.id = gd.device_id
    WHERE gd.gateway_id = ?
    ORDER BY gd.last_seen DESC",
    [$gatewayId]
);

Response::success($devices);
