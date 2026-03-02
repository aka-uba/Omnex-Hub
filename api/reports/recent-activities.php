<?php
/**
 * Recent Activities API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$limit = $request->query('limit', 10);

// Build query
$sql = "SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.new_values as changes,
            al.created_at,
            u.first_name,
            u.last_name,
            u.email
        FROM audit_logs al
        LEFT JOIN users u ON CAST(al.user_id AS TEXT) = CAST(u.id AS TEXT)
        WHERE 1=1";

$params = [];

// Filter by company for non-SuperAdmin
if ($user['role'] !== 'SuperAdmin' && $companyId) {
    $sql .= " AND al.company_id = ?";
    $params[] = $companyId;
}

$sql .= " ORDER BY al.created_at DESC LIMIT ?";
$params[] = min((int)$limit, 50);

$activities = $db->fetchAll($sql, $params);

// Format activities
$formatted = array_map(function ($activity) {
    $userName = trim(($activity['first_name'] ?? '') . ' ' . ($activity['last_name'] ?? ''));
    if (empty($userName)) {
        $userName = $activity['email'] ?? 'System';
    }

    return [
        'id' => $activity['id'],
        'action' => $activity['action'],
        'entity_type' => $activity['entity_type'],
        'entity_id' => $activity['entity_id'],
        'user_name' => $userName,
        'changes' => $activity['changes'] ? json_decode($activity['changes'], true) : null,
        'created_at' => $activity['created_at']
    ];
}, $activities);

Response::success($formatted);
