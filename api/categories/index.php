<?php
/**
 * Categories List API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Get active company ID (handles SuperAdmin with X-Active-Company header)
$companyId = Auth::getActiveCompanyId();

$where = [];
$params = [];

// Filter by active company (both regular users and SuperAdmin with selected company)
if ($companyId) {
    $where[] = "(company_id = ? OR company_id IS NULL)";
    $params[] = $companyId;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$categories = $db->fetchAll(
    "SELECT * FROM categories $whereClause ORDER BY sort_order ASC, name ASC",
    $params
);

Response::success($categories ?? []);
