<?php
/**
 * Audit Logs - List
 *
 * Database columns: entity_type, entity_id, old_values, new_values
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only admins can view audit logs
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

$page = (int)($_GET['page'] ?? 1);
$perPage = (int)($_GET['per_page'] ?? 50);
$offset = ($page - 1) * $perPage;

// Filters
$userId = $_GET['user_id'] ?? null;
$action = $_GET['action'] ?? null;
$entityType = $_GET['entity_type'] ?? $_GET['resource'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$search = $_GET['search'] ?? null;
$sortBy = $_GET['sort_by'] ?? 'created_at';
$sortDir = strtoupper($_GET['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

// Validate sort column
$sortColumnMap = [
    'created_at' => 'al.created_at',
    'action' => 'al.action',
    'entity_type' => 'al.entity_type',
    'resource' => 'al.entity_type',
    'user_name' => "COALESCE(u.first_name || ' ' || u.last_name, 'System')",
    'ip_address' => 'al.ip_address'
];

$sortColumn = $sortColumnMap[$sortBy] ?? 'al.created_at';
$auditUserJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(al.user_id AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON al.user_id = u.id';
$todayDateExpr = $db->isPostgres() ? 'CURRENT_DATE' : "DATE('now')";

try {
    $where = [];
    $params = [];

    // Company filter for non-super admins
    if ($user['role'] !== 'SuperAdmin') {
        $where[] = "al.company_id = ?";
        $params[] = $user['company_id'];
    }

    if ($userId) {
        $where[] = "al.user_id = ?";
        $params[] = $userId;
    }

    if ($action) {
        $where[] = "al.action = ?";
        $params[] = $action;
    }

    if ($entityType) {
        $where[] = "al.entity_type = ?";
        $params[] = $entityType;
    }

    if ($dateFrom) {
        $where[] = "DATE(al.created_at) >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $where[] = "DATE(al.created_at) <= ?";
        $params[] = $dateTo;
    }

    if ($search) {
        $where[] = "(al.entity_type LIKE ? OR al.action LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR al.ip_address LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Get total count
    $countQuery = "SELECT COUNT(*) as total
                   FROM audit_logs al
                   $auditUserJoin
                   $whereClause";
    $countResult = $db->fetch($countQuery, $params);
    $total = $countResult['total'] ?? 0;

    // Get stats (for current filter)
    $statsParams = $params; // Copy params without limit/offset
    $statsQuery = "SELECT
                       COUNT(*) as total,
                       SUM(CASE WHEN al.action = 'create' THEN 1 ELSE 0 END) as creates,
                       SUM(CASE WHEN al.action = 'update' THEN 1 ELSE 0 END) as updates,
                       SUM(CASE WHEN al.action = 'delete' THEN 1 ELSE 0 END) as deletes,
                       SUM(CASE WHEN al.action = 'login' THEN 1 ELSE 0 END) as logins,
                       SUM(CASE WHEN al.action = 'logout' THEN 1 ELSE 0 END) as logouts,
                       SUM(CASE WHEN al.action = 'import' THEN 1 ELSE 0 END) as imports,
                       SUM(CASE WHEN al.action = 'export' THEN 1 ELSE 0 END) as exports,
                       SUM(CASE WHEN al.action = 'send' THEN 1 ELSE 0 END) as sends
                   FROM audit_logs al
                   $auditUserJoin
                   $whereClause";
    $stats = $db->fetch($statsQuery, $statsParams);

    // Get today's stats (for the company)
    $todayWhere = $user['role'] !== 'SuperAdmin' ? "WHERE company_id = ?" : "";
    $todayParams = $user['role'] !== 'SuperAdmin' ? [$user['company_id']] : [];

    $todayStatsQuery = "SELECT
                            COUNT(*) as today_total,
                            SUM(CASE WHEN action = 'create' THEN 1 ELSE 0 END) as today_creates,
                            SUM(CASE WHEN action = 'update' THEN 1 ELSE 0 END) as today_updates,
                            SUM(CASE WHEN action = 'delete' THEN 1 ELSE 0 END) as today_deletes
                        FROM audit_logs
                        $todayWhere " . ($todayWhere ? "AND" : "WHERE") . " DATE(created_at) = $todayDateExpr";
    $todayStats = $db->fetch($todayStatsQuery, $todayParams);

    // Get logs with user info and entity name
    // Use aliases for frontend compatibility: old_values -> old_data, new_values -> new_data
    // Join with related tables to get entity_name based on entity_type
    $query = "SELECT
                     al.id,
                     al.company_id,
                     al.user_id,
                     al.action,
                     al.entity_type,
                     al.entity_id,
                     al.old_values as old_data,
                     al.new_values as new_data,
                     al.ip_address,
                     al.user_agent,
                     al.created_at,
                     COALESCE(u.first_name || ' ' || u.last_name, 'System') as user_name,
                     CASE
                         WHEN al.entity_type = 'products' THEN (SELECT name FROM products WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'templates' THEN (SELECT name FROM templates WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'devices' THEN (SELECT name FROM devices WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'users' THEN (SELECT first_name || ' ' || last_name FROM users WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'companies' THEN (SELECT name FROM companies WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'categories' THEN (SELECT name FROM categories WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'media' THEN (SELECT COALESCE(name, original_name) FROM media WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'playlists' THEN (SELECT name FROM playlists WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'schedules' THEN (SELECT name FROM schedules WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'device_groups' THEN (SELECT name FROM device_groups WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'licenses' THEN (SELECT license_key FROM licenses WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         WHEN al.entity_type = 'production_types' THEN (SELECT name FROM production_types WHERE CAST(id AS TEXT) = CAST(al.entity_id AS TEXT))
                         ELSE NULL
                     END as entity_name
              FROM audit_logs al
              $auditUserJoin
              $whereClause
              ORDER BY $sortColumn $sortDir
              LIMIT ? OFFSET ?";

    $params[] = $perPage;
    $params[] = $offset;

    $logs = $db->fetchAll($query, $params);

    // Get unique entity types for filter dropdown
    $entityTypesQuery = "SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type";
    $entityTypes = $db->fetchAll($entityTypesQuery);

    // Get unique users for filter dropdown
    $usersQuery = "SELECT DISTINCT al.user_id, COALESCE(u.first_name || ' ' || u.last_name, 'System') as user_name
                   FROM audit_logs al
                   $auditUserJoin
                   WHERE al.user_id IS NOT NULL
                   ORDER BY user_name";
    $users = $db->fetchAll($usersQuery);

    Response::json([
        'success' => true,
        'data' => $logs,
        'meta' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => (int)$total,
            'total_pages' => (int)ceil($total / $perPage)
        ],
        'stats' => [
            'total' => (int)($stats['total'] ?? 0),
            'creates' => (int)($stats['creates'] ?? 0),
            'updates' => (int)($stats['updates'] ?? 0),
            'deletes' => (int)($stats['deletes'] ?? 0),
            'logins' => (int)($stats['logins'] ?? 0),
            'logouts' => (int)($stats['logouts'] ?? 0),
            'imports' => (int)($stats['imports'] ?? 0),
            'exports' => (int)($stats['exports'] ?? 0),
            'sends' => (int)($stats['sends'] ?? 0)
        ],
        'today' => [
            'total' => (int)($todayStats['today_total'] ?? 0),
            'creates' => (int)($todayStats['today_creates'] ?? 0),
            'updates' => (int)($todayStats['today_updates'] ?? 0),
            'deletes' => (int)($todayStats['today_deletes'] ?? 0)
        ],
        'filters' => [
            'resources' => array_column($entityTypes, 'entity_type'),
            'users' => $users
        ]
    ]);
} catch (Exception $e) {
    Logger::error('Audit logs list error', ['error' => $e->getMessage()]);
    Response::serverError('Loglar yuklenemedi');
}
