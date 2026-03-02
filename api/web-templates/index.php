<?php
/**
 * Web Templates - List
 * GET /api/web-templates
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

// Query parametreleri
$status = $_GET['status'] ?? null;
$type = $_GET['type'] ?? null;
$search = $_GET['search'] ?? null;
$page = max(1, intval($_GET['page'] ?? 1));
$perPage = min(100, max(10, intval($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;

// Base query
$where = ['wt.company_id = ?', 'wt.deleted_at IS NULL'];
$params = [$companyId];

// Status filtresi
if ($status && in_array($status, ['draft', 'published', 'archived'])) {
    $where[] = 'wt.status = ?';
    $params[] = $status;
}

// Type filtresi
if ($type && in_array($type, ['signage', 'webpage', 'dashboard', 'menu'])) {
    $where[] = 'wt.template_type = ?';
    $params[] = $type;
}

// Arama
if ($search) {
    $where[] = '(wt.name LIKE ? OR wt.description LIKE ? OR wt.tags LIKE ?)';
    $searchTerm = '%' . $search . '%';
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

$whereClause = implode(' AND ', $where);
$activeAssignmentExpr = $db->isPostgres() ? 'wta.is_active IS TRUE' : 'wta.is_active = 1';
$createdByJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(wt.created_by AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON wt.created_by = u.id';

// Toplam sayı
$countQuery = "SELECT COUNT(*) as total FROM web_templates wt WHERE {$whereClause}";
$countResult = $db->fetch($countQuery, $params);
$total = $countResult['total'] ?? 0;

// Liste sorgusu
$query = "
    SELECT
        wt.id,
        wt.name,
        wt.slug,
        wt.description,
        wt.template_type,
        wt.category,
        wt.tags,
        wt.thumbnail,
        wt.width,
        wt.height,
        wt.orientation,
        wt.status,
        wt.version,
        wt.published_at,
        wt.scope,
        wt.created_at,
        wt.updated_at,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM web_template_assignments wta WHERE wta.template_id = wt.id AND $activeAssignmentExpr) as device_count
    FROM web_templates wt
    $createdByJoin
    WHERE {$whereClause}
    ORDER BY wt.updated_at DESC
    LIMIT ? OFFSET ?
";

$params[] = $perPage;
$params[] = $offset;

$templates = $db->fetchAll($query, $params);

// Tags'i JSON'dan array'e çevir
foreach ($templates as &$template) {
    $template['tags'] = !empty($template['tags']) ? json_decode($template['tags'], true) : [];
}

Response::success([
    'items' => $templates,
    'pagination' => [
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => ceil($total / $perPage)
    ]
]);
