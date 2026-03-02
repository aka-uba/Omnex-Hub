<?php
/**
 * Users List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

// Pagination
$page = (int)($request->query('page', 1));
$perPage = (int)($request->query('per_page', 20));
$offset = ($page - 1) * $perPage;

// Filters
$search = $request->query('search', '');
$role = $request->query('role', '');
$status = $request->query('status', '');

$where = [];
$params = [];

// Company filter (non-SuperAdmin sees only their company)
if ($user['role'] !== 'SuperAdmin' && $companyId) {
    $where[] = "u.company_id = ?";
    $params[] = $companyId;
}

if ($search) {
    $where[] = "(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($role) {
    $where[] = "u.role = ?";
    $params[] = $role;
}

if ($status) {
    $where[] = "u.status = ?";
    $params[] = $status;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Total count
$total = $db->fetchColumn("SELECT COUNT(*) FROM users u $whereClause", $params);

if ($db->isPostgres()) {
    $branchNamesExpr = "string_agg(b.name::text, ', ' ORDER BY b.name)";
    $branchIdsExpr = "string_agg(uba.branch_id::text, ',' ORDER BY uba.branch_id)";
} else {
    $branchNamesExpr = "GROUP_CONCAT(b.name, ', ')";
    $branchIdsExpr = "GROUP_CONCAT(uba.branch_id, ',')";
}
$defaultBranchExpr = $db->isPostgres() ? 'uba.is_default IS TRUE' : 'uba.is_default = 1';

// Get users with branch info
$users = $db->fetchAll(
    "SELECT u.id, u.first_name, u.last_name, (u.first_name || ' ' || u.last_name) as name,
            u.email, u.role, u.status, u.avatar, u.last_login, u.created_at,
            c.name as company_name, u.company_id,
            (SELECT $branchNamesExpr
             FROM user_branch_access uba
             JOIN branches b ON uba.branch_id = b.id
             WHERE uba.user_id = u.id) as branch_names,
            (SELECT $branchIdsExpr
             FROM user_branch_access uba
             WHERE uba.user_id = u.id) as branch_ids,
            (SELECT b.id FROM user_branch_access uba
             JOIN branches b ON uba.branch_id = b.id
             WHERE uba.user_id = u.id AND $defaultBranchExpr LIMIT 1) as default_branch_id
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     $whereClause
     ORDER BY u.first_name ASC
     LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

Response::paginated($users ?? [], $total, $page, $perPage);
