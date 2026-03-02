<?php
/**
 * Notifications List API
 * GET /api/notifications - List user's notifications
 *
 * Query params:
 * - status: active, unread, read, archived, all (default: active)
 * - type: info, success, warning, error, system
 * - priority: low, normal, high, urgent
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $user['id'];
$companyId = Auth::getActiveCompanyId();

// Pagination
$page = max(1, (int)($request->query('page', 1)));
$limit = min(100, max(1, (int)($request->query('limit', 20))));
$offset = ($page - 1) * $limit;

// Status filter
$status = strtolower((string)$request->query('status', 'active'));
$type = strtolower(trim((string)$request->query('type', '')));
$priority = strtolower(trim((string)$request->query('priority', '')));

$where = ["nr.user_id = ?"];
$params = [$userId];

// Filter by status
if ($status === 'active') {
    $where[] = "nr.status IN ('unread', 'sent', 'read')";
} elseif ($status === 'unread') {
    $where[] = "nr.status IN ('unread', 'sent')";
} elseif ($status === 'read') {
    $where[] = "nr.status = 'read'";
} elseif ($status === 'archived') {
    $where[] = "nr.status = 'archived'";
} elseif ($status === 'all') {
    // Include archived but exclude deleted
    $where[] = "nr.status != 'deleted'";
} else {
    Response::badRequest('Gecersiz status filtresi');
}

// Filter by type
if ($type !== '') {
    $validTypes = ['info', 'success', 'warning', 'error', 'system'];
    if (!in_array($type, $validTypes, true)) {
        Response::badRequest('Gecersiz bildirim tipi');
    }
    $where[] = "LOWER(n.type) = ?";
    $params[] = $type;
}

// Filter by priority
if ($priority !== '') {
    $validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!in_array($priority, $validPriorities, true)) {
        Response::badRequest('Gecersiz oncelik filtresi');
    }
    $where[] = "LOWER(n.priority) = ?";
    $params[] = $priority;
}

// Filter by company
if ($companyId) {
    $where[] = "n.company_id = ?";
    $params[] = $companyId;
}

// Exclude expired notifications
$where[] = "(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)";

$whereClause = 'WHERE ' . implode(' AND ', $where);

// Total count
$total = $db->fetchColumn(
    "SELECT COUNT(*)
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     $whereClause",
    $params
);

// Get notifications with pagination
$notifications = $db->fetchAll(
    "SELECT
        n.id,
        n.title,
        n.message,
        n.type,
        n.icon,
        n.link,
        n.priority,
        n.channels,
        n.created_at,
        n.expires_at,
        nr.status,
        nr.read_at,
        nr.archived_at,
        u.first_name || ' ' || u.last_name as created_by_name
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     LEFT JOIN users u ON CAST(n.created_by AS TEXT) = CAST(u.id AS TEXT)
     $whereClause
     ORDER BY
        CASE nr.status WHEN 'unread' THEN 0 WHEN 'sent' THEN 0 ELSE 1 END,
        n.priority = 'urgent' DESC,
        n.priority = 'high' DESC,
        n.created_at DESC
     LIMIT ? OFFSET ?",
    array_merge($params, [$limit, $offset])
);

// Parse channels JSON
foreach ($notifications as &$notification) {
    $notification['channels'] = json_decode($notification['channels'], true) ?? ['web'];
}

Response::paginated($notifications ?? [], $total, $page, $limit);

