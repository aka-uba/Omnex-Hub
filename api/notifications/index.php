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
 * - sort_by: created_at, title, type, status, priority
 * - sort_dir: ASC, DESC
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
$category = strtolower(trim((string)$request->query('category', '')));
$priority = strtolower(trim((string)$request->query('priority', '')));
$sortBy = strtolower(trim((string)$request->query('sort_by', 'created_at')));
$sortDir = strtoupper(trim((string)$request->query('sort_dir', 'DESC')));

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

// Filter by category
if ($category !== '') {
    $validCategories = ['device_send'];
    if (!in_array($category, $validCategories, true)) {
        Response::badRequest('Gecersiz bildirim kategorisi');
    }

    if ($category === 'device_send') {
        $where[] = "(n.link LIKE '#/admin/queue%' OR n.link LIKE '#/queue%')";
    }
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

// Sorting (whitelist only)
$sortMap = [
    'created_at' => 'n.created_at',
    'title' => 'n.title',
    'type' => 'n.type',
    'status' => 'nr.status',
    'priority' => 'n.priority'
];
$sortColumn = $sortMap[$sortBy] ?? $sortMap['created_at'];
$sortDirection = in_array($sortDir, ['ASC', 'DESC'], true) ? $sortDir : 'DESC';
$orderClause = "ORDER BY $sortColumn $sortDirection, n.created_at DESC";

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
     $orderClause
     LIMIT ? OFFSET ?",
    array_merge($params, [$limit, $offset])
);

// Parse channels JSON
foreach ($notifications as &$notification) {
    $notification['channels'] = json_decode($notification['channels'], true) ?? ['web'];
}

Response::paginated($notifications ?? [], $total, $page, $limit);

