<?php
/**
 * Device Logs API
 * GET /api/devices/:id/logs - Cihaz loglarını listele
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Get route parameters from global $request instance
global $request;
$deviceId = $request ? $request->routeParam('id') : null;

if (!$deviceId) {
    Response::error('Device ID gerekli', 400);
}

// Cihazı kontrol et
$device = $db->fetch("SELECT * FROM devices WHERE id = ?", [$deviceId]);
if (!$device) {
    Response::error('Cihaz bulunamadı', 404);
}

// Yetki kontrolü - aynı firmaya ait mi
$companyId = Auth::getActiveCompanyId();
if ($device['company_id'] !== $companyId && $user['role'] !== 'SuperAdmin') {
    Response::error('Bu cihaza erişim yetkiniz yok', 403);
}

// Query params
$limit = min((int)($request ? $request->query('limit', 50) : 50), 100);
$offset = max((int)($request ? $request->query('offset', 0) : 0), 0);
$status = $request ? $request->query('status') : null;
$action = $request ? $request->query('action') : null;

// Build query
$query = "SELECT * FROM device_logs WHERE device_id = ?";
$params = [$deviceId];

if ($status) {
    $query .= " AND status = ?";
    $params[] = $status;
}

if ($action) {
    $query .= " AND action = ?";
    $params[] = $action;
}

$query .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;

// Get logs
$logs = $db->fetchAll($query, $params);

// Get total count
$countQuery = "SELECT COUNT(*) as total FROM device_logs WHERE device_id = ?";
$countParams = [$deviceId];

if ($status) {
    $countQuery .= " AND status = ?";
    $countParams[] = $status;
}

if ($action) {
    $countQuery .= " AND action = ?";
    $countParams[] = $action;
}

$countResult = $db->fetch($countQuery, $countParams);
$total = $countResult ? (int)$countResult['total'] : 0;

Response::success([
    'logs' => $logs ?? [],
    'total' => $total,
    'limit' => $limit,
    'offset' => $offset
]);
