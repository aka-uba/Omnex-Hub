<?php
/**
 * Products List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Pagination
$page = (int)$request->query('page', 1);
$limit = (int)$request->query('limit', 25);
$offset = ($page - 1) * $limit;

// Search & Filters
$search = $request->query('search');
$group = $request->query('group');
$category = $request->query('category');
$status = $request->query('status');
$hasLabel = $request->query('has_label');
$hasDevice = $request->query('has_device');
$sortBy = $request->query('sort_by', 'updated_at');
$sortDir = $request->query('sort_dir', 'DESC');
$sortAnchor = trim((string)$request->query('sort_anchor', ''));

// Build query
$where = ["p.company_id = ?"];
$params = [$companyId];

if ($search) {
    // Turkish character normalization for case-insensitive search
    $turkishMap = [
        'ı' => 'i', 'İ' => 'i', 'ş' => 's', 'Ş' => 's',
        'ç' => 'c', 'Ç' => 'c', 'ğ' => 'g', 'Ğ' => 'g',
        'ü' => 'u', 'Ü' => 'u', 'ö' => 'o', 'Ö' => 'o',
        'I' => 'i'
    ];
    $searchNorm = mb_strtolower(strtr($search, $turkishMap), 'UTF-8');
    $searchTerm = "%$search%";
    $searchTermNorm = "%$searchNorm%";

    // REPLACE chain for Turkish character normalization on DB fields
    $normExpr = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p.name),'ı','i'),'ğ','g'),'ü','u'),'ş','s'),'ö','o'),'ç','c'),'İ','i'),'Ğ','g'),'Ü','u'),'Ş','s'),'Ö','o'),'Ç','c'),'I','i')";
    $normExprSku = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(p.sku),'ı','i'),'ğ','g'),'ü','u'),'ş','s'),'ö','o'),'ç','c'),'İ','i'),'Ğ','g'),'Ü','u'),'Ş','s'),'Ö','o'),'Ç','c'),'I','i')";
    $normExprBarcode = "LOWER(p.barcode)";

    $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR $normExpr LIKE ? OR $normExprSku LIKE ? OR $normExprBarcode LIKE ?)";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTermNorm;
    $params[] = $searchTermNorm;
    $params[] = $searchTermNorm;
}

if ($group) {
    $where[] = "p.\"group\" = ?";
    $params[] = $group;
}

if ($category) {
    $where[] = "p.category = ?";
    $params[] = $category;
}

if ($status) {
    $where[] = "p.status = ?";
    $params[] = $status;
}

// Filter by label assignment (both device and template assigned)
if ($hasLabel === 'assigned') {
    $where[] = "(p.assigned_device_id IS NOT NULL AND p.assigned_device_id != '' AND p.assigned_template_id IS NOT NULL AND p.assigned_template_id != '')";
} elseif ($hasLabel === 'unassigned') {
    $where[] = "(p.assigned_device_id IS NULL OR p.assigned_device_id = '' OR p.assigned_template_id IS NULL OR p.assigned_template_id = '')";
}

// Filter by device assignment
if ($hasDevice === 'assigned') {
    $where[] = "(p.assigned_device_id IS NOT NULL AND p.assigned_device_id != '')";
} elseif ($hasDevice === 'unassigned') {
    $where[] = "(p.assigned_device_id IS NULL OR p.assigned_device_id = '')";
}

$whereClause = implode(' AND ', $where);

// Allowed sort columns (request key -> safe SQL expression)
$allowedSortMap = [
    'name' => 'LOWER(p.name)',
    'sku' => 'LOWER(p.sku)',
    'barcode' => 'LOWER(p.barcode)',
    'group' => 'LOWER(p."group")',
    'category' => 'LOWER(p.category)',
    'current_price' => 'p.current_price',
    'stock' => 'p.stock',
    'status' => 'LOWER(p.status)',
    'assigned_device' => 'LOWER(d_sort.name)',
    'assigned_template' => 'LOWER(t_sort.name)',
    'created_at' => 'p.created_at',
    'updated_at' => 'p.updated_at'
];
if (!isset($allowedSortMap[$sortBy])) {
    $sortBy = 'updated_at';
}
$sortExpr = $allowedSortMap[$sortBy];
$sortDir = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';
$orderBySql = "$sortExpr $sortDir NULLS LAST, LOWER(p.name) ASC, p.id ASC";
$orderByParams = [];

if (($sortBy === 'group' || $sortBy === 'category') && $sortAnchor !== '') {
    $anchorExpr = $sortBy === 'group' ? 'LOWER(p."group")' : 'LOWER(p.category)';
    $orderBySql = "CASE WHEN $anchorExpr = LOWER(?) THEN 0 ELSE 1 END ASC, $orderBySql";
    $orderByParams[] = $sortAnchor;
}

$fromClause = "FROM products p";
if ($sortBy === 'assigned_device') {
    $fromClause .= "\nLEFT JOIN devices d_sort ON CAST(p.assigned_device_id AS TEXT) = CAST(d_sort.id AS TEXT) AND d_sort.company_id = p.company_id";
}
if ($sortBy === 'assigned_template') {
    $fromClause .= "\nLEFT JOIN templates t_sort ON CAST(p.assigned_template_id AS TEXT) = CAST(t_sort.id AS TEXT) AND (t_sort.company_id = p.company_id OR t_sort.scope = 'system' OR t_sort.company_id IS NULL)";
}

// Count total
$total = $db->fetch(
    "SELECT COUNT(*) as count FROM products p WHERE $whereClause",
    $params
)['count'];

// Get products
$products = $db->fetchAll(
    "SELECT p.id, p.sku, p.barcode, p.name, p.current_price, p.previous_price, p.unit,
            p.\"group\", p.category, p.subcategory, p.brand, p.image_url, p.images, p.cover_image_index, p.stock, p.status, p.is_featured,
            p.assigned_device_id, p.assigned_template_id,
            p.created_at, p.updated_at
     $fromClause
     WHERE $whereClause
     ORDER BY $orderBySql
     LIMIT ? OFFSET ?",
    array_merge($params, $orderByParams, [$limit, $offset])
);

// Check if with_labels parameter is set for auto-send wizard
$withLabels = $request->query('with_labels');

// Get all device assignments for products in this batch
$productIds = array_column($products, 'id');
if (!empty($productIds)) {
    $assignedDeviceIds = [];
    $assignedTemplateIds = [];
    foreach ($products as $p) {
        if (!empty($p['assigned_device_id']) && !empty($p['assigned_template_id'])) {
            $assignedDeviceIds[] = $p['assigned_device_id'];
            $assignedTemplateIds[] = $p['assigned_template_id'];
        }
    }
    $assignedDeviceIds = array_values(array_unique($assignedDeviceIds));
    $assignedTemplateIds = array_values(array_unique($assignedTemplateIds));

    // Build device and template lookup maps only for assigned records in current page.
    $deviceLookup = [];
    $templateLookup = [];

    if (!empty($assignedDeviceIds)) {
        $devicePlaceholders = implode(', ', array_fill(0, count($assignedDeviceIds), '?'));
        $deviceRows = $db->fetchAll(
            "SELECT id, name, location, ip_address, status
             FROM devices
             WHERE company_id = ?
               AND id IN ($devicePlaceholders)",
            array_merge([$companyId], $assignedDeviceIds)
        );

        foreach ($deviceRows as $device) {
            $deviceLookup[$device['id']] = [
                'name' => $device['name'],
                'location' => $device['location'],
                'ip_address' => $device['ip_address'],
                'status' => $device['status']
            ];
        }
    }

    if (!empty($assignedTemplateIds)) {
        $templatePlaceholders = implode(', ', array_fill(0, count($assignedTemplateIds), '?'));
        $templateRows = $db->fetchAll(
            "SELECT id, name
             FROM templates
             WHERE id IN ($templatePlaceholders)
               AND (company_id = ? OR scope = 'system' OR company_id IS NULL)",
            array_merge($assignedTemplateIds, [$companyId])
        );

        foreach ($templateRows as $templateRow) {
            $templateLookup[$templateRow['id']] = $templateRow['name'];
        }
    }

    // Build labels from products.assigned_device_id and assigned_template_id
    foreach ($products as &$product) {
        $product['labels'] = [];

        // If product has assigned device and template, create label entry
        if (!empty($product['assigned_device_id']) && !empty($product['assigned_template_id'])) {
            $deviceInfo = $deviceLookup[$product['assigned_device_id']] ?? null;
            $templateName = $templateLookup[$product['assigned_template_id']] ?? null;

            if ($deviceInfo) {
                $product['labels'][] = [
                    'id' => $product['assigned_device_id'],
                    'device_id' => $product['assigned_device_id'],
                    'device_name' => $deviceInfo['name'],
                    'location' => $deviceInfo['location'],
                    'ip_address' => $deviceInfo['ip_address'],
                    'template_id' => $product['assigned_template_id'],
                    'template_name' => $templateName,
                    'status' => $deviceInfo['status'] === 'online' ? 'synced' : 'pending'
                ];
            }
        }

        // For auto wizard, add grouped labels array
        if ($withLabels) {
            $product['labels_grouped'] = [];
            if (!empty($product['labels'])) {
                $label = $product['labels'][0];
                $product['labels_grouped'][] = [
                    'template_id' => $label['template_id'],
                    'template_name' => $label['template_name'],
                    'device_ids' => [$label['device_id']]
                ];
            }
            // Count total assigned devices
            $product['assigned_devices_count'] = count($product['labels']);
            // Has assignment flag
            $product['has_assignments'] = !empty($product['labels']);
        }
    }
    unset($product);
}

// Get categories for filter
$categories = $db->fetchAll(
    "SELECT DISTINCT p.category FROM products p WHERE p.company_id = ? AND p.category IS NOT NULL AND p.category != '' ORDER BY p.category",
    [$companyId]
);

Response::success([
    'products' => $products,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => (int)$total,
        'pages' => ceil($total / $limit)
    ],
    'filters' => [
        'categories' => array_column($categories, 'category')
    ]
]);
