<?php
/**
 * Unread Notifications Count API
 * GET /api/notifications/unread-count
 *
 * Returns: { count: number }
 * Used for header badge display
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $user['id'];
$companyId = Auth::getActiveCompanyId();

$where = ["nr.user_id = ?", "nr.status IN ('unread', 'sent')"];
$params = [$userId];

// Filter by company
if ($companyId) {
    $where[] = "n.company_id = ?";
    $params[] = $companyId;
}

// Exclude expired notifications
$where[] = "(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)";

$whereClause = 'WHERE ' . implode(' AND ', $where);

$count = $db->fetchColumn(
    "SELECT COUNT(*)
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     $whereClause",
    $params
);

Response::success(['count' => (int)$count]);

