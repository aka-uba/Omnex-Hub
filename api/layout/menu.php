<?php
/**
 * Layout Menu API
 */

$db = Database::getInstance();
$user = Auth::user();
$role = $user['role'] ?? 'Viewer';
$companyId = Auth::getActiveCompanyId();

// Get menu items
$where = "WHERE visible = true";
$params = [];

if ($companyId) {
    $where .= " AND (company_id = ? OR company_id IS NULL)";
    $params[] = $companyId;
} else {
    $where .= " AND company_id IS NULL";
}

$menuItems = $db->fetchAll(
    "SELECT * FROM menu_items $where ORDER BY order_index ASC",
    $params
);

// Filter by role
$filtered = [];
foreach ($menuItems as $item) {
    $roles = json_decode($item['roles'], true) ?? [];
    if (in_array('*', $roles) || in_array($role, $roles)) {
        // Parse label JSON
        $label = json_decode($item['label'], true);
        $item['label'] = is_array($label) ? ($label['tr'] ?? $label['en'] ?? '') : $item['label'];
        $filtered[] = $item;
    }
}

Response::success($filtered);
