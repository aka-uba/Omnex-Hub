<?php
/**
 * Gateways List API
 *
 * GET /api/gateways - Firma gateway'lerini listele
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();

$gateways = $db->fetchAll(
    "SELECT
        g.*,
        (SELECT COUNT(*) FROM gateway_devices gd WHERE gd.gateway_id = g.id) as device_count,
        (SELECT COUNT(*) FROM gateway_commands gc WHERE gc.gateway_id = g.id AND gc.status = 'pending') as pending_commands
    FROM gateways g
    WHERE g.company_id = ?
    ORDER BY g.created_at DESC",
    [$companyId]
);

// API secret'ları gizle
foreach ($gateways as &$gateway) {
    unset($gateway['api_secret']);
}

Response::success($gateways);
