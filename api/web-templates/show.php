<?php
/**
 * Web Templates - Show
 * GET /api/web-templates/:id
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$templateId = $request->getRouteParam('id');
$isSuperAdmin = strtolower((string)($user['role'] ?? '')) === 'superadmin';
$createdByJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(wt.created_by AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON wt.created_by = u.id';
$updatedByJoin = $db->isPostgres()
    ? 'LEFT JOIN users u2 ON CAST(wt.updated_by AS TEXT) = CAST(u2.id AS TEXT)'
    : 'LEFT JOIN users u2 ON wt.updated_by = u2.id';

if (!$templateId) {
    Response::error('Şablon ID gerekli', 400);
}

// Şablonu getir
$template = $db->fetch("
    SELECT
        wt.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as updated_by_name
    FROM web_templates wt
    $createdByJoin
    $updatedByJoin
    WHERE wt.id = ?
    AND wt.deleted_at IS NULL
    AND (wt.company_id = ? OR wt.scope = 'system')
", [$templateId, $companyId]);

if (!$template) {
    Response::notFound('Şablon bulunamadı');
}

// JSON alanları decode et
$template['tags'] = !empty($template['tags']) ? json_decode($template['tags'], true) : [];
$template['responsive_breakpoints'] = !empty($template['responsive_breakpoints']) ? json_decode($template['responsive_breakpoints'], true) : null;
$template['data_sources'] = !empty($template['data_sources']) ? json_decode($template['data_sources'], true) : [];
$template['dynamic_fields'] = !empty($template['dynamic_fields']) ? json_decode($template['dynamic_fields'], true) : [];

// Cihaz atamalarını getir
$assignmentQuery = "
    SELECT
        wta.id,
        wta.device_id,
        wta.priority,
        wta.is_active,
        wta.start_date,
        wta.end_date,
        wta.sync_status,
        wta.last_synced_at,
        d.name as device_name,
        d.type as device_type,
        d.status as device_status
    FROM web_template_assignments wta
    JOIN devices d ON wta.device_id = d.id
    WHERE wta.template_id = ?
";
$assignmentParams = [$templateId];

if (!$isSuperAdmin) {
    $assignmentQuery .= " AND d.company_id = ?";
    $assignmentParams[] = $companyId;
}

$assignmentQuery .= " ORDER BY wta.priority DESC, d.name";
$assignments = $db->fetchAll($assignmentQuery, $assignmentParams);

$template['assignments'] = $assignments;

// Son versiyonları getir (en son 5 tanesi)
$versions = $db->fetchAll("
    SELECT
        id,
        version_number,
        version_name,
        change_notes,
        created_at,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = web_template_versions.created_by) as created_by_name
    FROM web_template_versions
    WHERE template_id = ?
    ORDER BY version_number DESC
    LIMIT 5
", [$templateId]);

$template['recent_versions'] = $versions;

Response::success($template);
