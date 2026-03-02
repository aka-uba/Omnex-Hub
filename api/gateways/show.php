<?php
/**
 * Gateway Show API
 *
 * GET /api/gateways/:id - Tek gateway detayı
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

$gateway = $db->fetch(
    "SELECT
        g.*,
        (SELECT COUNT(*) FROM gateway_devices gd WHERE gd.gateway_id = g.id) as device_count,
        (SELECT COUNT(*) FROM gateway_commands gc WHERE gc.gateway_id = g.id AND gc.status = 'pending') as pending_commands
    FROM gateways g
    WHERE g.id = ? AND g.company_id = ?",
    [$gatewayId, $companyId]
);

if (!$gateway) {
    Response::notFound('Gateway bulunamadı');
}

// API secret'ı gizle
unset($gateway['api_secret']);

// Gateway'e bağlı cihazları da getir
$devices = $db->fetchAll(
    "SELECT
        gd.*,
        d.name as device_name,
        d.type as device_type,
        d.model,
        d.device_id as serial_number,
        d.ip_address,
        d.status as device_status
    FROM gateway_devices gd
    JOIN devices d ON d.id = gd.device_id
    WHERE gd.gateway_id = ?
    ORDER BY gd.last_seen DESC",
    [$gatewayId]
);

$gateway['devices'] = $devices;

Response::success($gateway);
