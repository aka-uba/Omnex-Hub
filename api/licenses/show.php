<?php
/**
 * License Show API (Admin Only)
 * GET /api/licenses/:id
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

global $request;
$id = $request ? $request->routeParam('id') : null;

if (!$id) {
    Response::error('License ID gerekli', 400);
}

$license = $db->fetch(
    "SELECT l.*, c.name as company_name, c.code as company_code
     FROM licenses l
     LEFT JOIN companies c ON l.company_id = c.id
     WHERE l.id = ?",
    [$id]
);

if (!$license) {
    Response::error('Lisans bulunamadı', 404);
}

if (strcasecmp((string)($user['role'] ?? ''), 'SuperAdmin') !== 0
    && ($license['company_id'] ?? null) !== ($user['company_id'] ?? null)) {
    Response::forbidden('Bu lisansi gorme yetkiniz yok');
}

// Include device pricing breakdown if per_device_type
if (($license['pricing_mode'] ?? 'flat') === 'per_device_type') {
    $pricing = $db->fetchAll(
        "SELECT * FROM license_device_pricing WHERE license_id = ? ORDER BY device_category",
        [$id]
    );
    $totalMonthly = 0;
    foreach ($pricing as &$row) {
        $row['unit_price'] = (float)$row['unit_price'];
        $row['device_count'] = (int)$row['device_count'];
        $row['subtotal'] = $row['unit_price'] * $row['device_count'];
        $totalMonthly += $row['subtotal'];
    }
    unset($row);
    $license['device_pricing'] = $pricing;
    $license['total_monthly_base'] = round($totalMonthly, 2);
    $exchangeRate = (float)($license['exchange_rate'] ?? 1.0);
    $license['total_monthly_try'] = round($totalMonthly * $exchangeRate, 2);
    $license['total_annual_base'] = round($totalMonthly * 12, 2);
    $license['total_annual_try'] = round($totalMonthly * 12 * $exchangeRate, 2);
}

Response::success($license);
