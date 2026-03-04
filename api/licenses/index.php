<?php
/**
 * Licenses List API (Admin Only)
 */

$db = Database::getInstance();
$user = Auth::user();

// Build query with company filter
$where = [];
$params = [];

// For SuperAdmin: only filter if explicitly selected a company via header
// For regular users: always filter by their company
if ($user && $user['role'] === 'SuperAdmin') {
    // Only apply filter if X-Active-Company header is explicitly set
    $activeCompanyHeader = $_SERVER['HTTP_X_ACTIVE_COMPANY'] ?? null;
    if ($activeCompanyHeader) {
        $where[] = "l.company_id = ?";
        $params[] = $activeCompanyHeader;
    }
    // If no header, show all licenses (no company filter)
} else {
    // Regular users - always filter by their company
    $companyId = $user['company_id'] ?? null;
    if ($companyId) {
        $where[] = "l.company_id = ?";
        $params[] = $companyId;
    } else {
        $where[] = "1 = 0";
    }
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Main license query with plan join
$licenses = $db->fetchAll(
    "SELECT l.*, c.name as company_name,
            l.valid_until as expires_at,
            l.valid_from as starts_at,
            (SELECT COUNT(*) FROM devices d WHERE d.company_id = l.company_id) as assigned_devices,
            lp.name as plan,
            lp.slug as plan_slug,
            lp.plan_type as plan_type,
            lp.max_users,
            lp.max_devices,
            lp.max_products,
            lp.max_templates,
            lp.max_branches,
            lp.max_storage
     FROM licenses l
     LEFT JOIN companies c ON l.company_id = c.id
     LEFT JOIN license_plans lp ON l.plan_id = lp.id
     $whereClause
     ORDER BY l.valid_until ASC",
    $params
);

// Get aggregate limits from active licenses
$limits = [
    'max_users' => -1,
    'max_devices' => -1,
    'max_products' => -1,
    'max_templates' => -1,
    'max_branches' => -1,
    'max_storage' => -1
];

// Calculate aggregate limits from all active licenses
if ($licenses) {
    foreach ($licenses as $license) {
        if ($license['status'] !== 'active') continue;

        $limitKeys = ['max_users', 'max_devices', 'max_products', 'max_templates', 'max_branches', 'max_storage'];
        foreach ($limitKeys as $key) {
            if (isset($license[$key])) {
                $val = (int)$license[$key];
                if ($val == -1 || $val == 0) {
                    $limits[$key] = -1; // Unlimited
                } elseif ($limits[$key] != -1 && $val > 0) {
                    $limits[$key] = max($limits[$key], $val);
                }
            }
        }
    }
}

Response::success([
    'licenses' => $licenses ?? [],
    'limits' => $limits
]);
