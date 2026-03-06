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

// Build query
$where = ["company_id = ?"];
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

    // SQLite REPLACE chain for Turkish character normalization on DB fields
    $normExpr = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(name),'ı','i'),'ğ','g'),'ü','u'),'ş','s'),'ö','o'),'ç','c'),'İ','i'),'Ğ','g'),'Ü','u'),'Ş','s'),'Ö','o'),'Ç','c'),'I','i')";
    $normExprSku = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(sku),'ı','i'),'ğ','g'),'ü','u'),'ş','s'),'ö','o'),'ç','c'),'İ','i'),'Ğ','g'),'Ü','u'),'Ş','s'),'Ö','o'),'Ç','c'),'I','i')";
    $normExprBarcode = "LOWER(barcode)";

    $where[] = "(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR $normExpr LIKE ? OR $normExprSku LIKE ? OR $normExprBarcode LIKE ?)";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTermNorm;
    $params[] = $searchTermNorm;
    $params[] = $searchTermNorm;
}

if ($group) {
    $where[] = "\"group\" = ?";
    $params[] = $group;
}

if ($category) {
    $where[] = "category = ?";
    $params[] = $category;
}

if ($status) {
    $where[] = "status = ?";
    $params[] = $status;
}

// Filter by label assignment (both device and template assigned)
if ($hasLabel === 'assigned') {
    $where[] = "(assigned_device_id IS NOT NULL AND assigned_device_id != '' AND assigned_template_id IS NOT NULL AND assigned_template_id != '')";
} elseif ($hasLabel === 'unassigned') {
    $where[] = "(assigned_device_id IS NULL OR assigned_device_id = '' OR assigned_template_id IS NULL OR assigned_template_id = '')";
}

// Filter by device assignment
if ($hasDevice === 'assigned') {
    $where[] = "(assigned_device_id IS NOT NULL AND assigned_device_id != '')";
} elseif ($hasDevice === 'unassigned') {
    $where[] = "(assigned_device_id IS NULL OR assigned_device_id = '')";
}

$whereClause = implode(' AND ', $where);

// Allowed sort columns
$allowedSort = ['name', 'sku', 'current_price', 'category', 'created_at', 'updated_at'];
if (!in_array($sortBy, $allowedSort)) {
    $sortBy = 'updated_at';
}
$sortDir = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

// Count total
$total = $db->fetch(
    "SELECT COUNT(*) as count FROM products WHERE $whereClause",
    $params
)['count'];

// Get products
$products = $db->fetchAll(
    "SELECT id, sku, barcode, name, current_price, previous_price, unit,
            \"group\", category, subcategory, brand, image_url, images, cover_image_index, stock, status, is_featured,
            assigned_device_id, assigned_template_id,
            created_at, updated_at
     FROM products
     WHERE $whereClause
     ORDER BY $sortBy $sortDir
     LIMIT ? OFFSET ?",
    array_merge($params, [$limit, $offset])
);

// Check if with_labels parameter is set for auto-send wizard
$withLabels = $request->query('with_labels');

// Get all device assignments for products in this batch
$productIds = array_column($products, 'id');
if (!empty($productIds)) {
    // Query all devices with product assignments including template info
    $allDevices = $db->fetchAll(
        "SELECT id, name, location, ip_address, current_content, current_template_id, status
         FROM devices
         WHERE company_id = ?
         AND current_content IS NOT NULL",
        [$companyId]
    );

    // Get all templates for lookup (include draft - user assigned them to devices)
    $templateLookup = [];
    if ($withLabels) {
        $allTemplates = $db->fetchAll(
            "SELECT id, name FROM templates WHERE (company_id = ? OR scope = 'system' OR company_id IS NULL)",
            [$companyId]
        );
        foreach ($allTemplates as $t) {
            $templateLookup[$t['id']] = $t['name'];
        }
    }

    // Build device and template lookup maps
    $deviceLookup = [];
    foreach ($allDevices as $device) {
        $deviceLookup[$device['id']] = [
            'name' => $device['name'],
            'location' => $device['location'],
            'ip_address' => $device['ip_address'],
            'status' => $device['status']
        ];
    }

    // Get all templates for lookup
    $allTemplates = $db->fetchAll(
        "SELECT id, name FROM templates WHERE (company_id = ? OR scope = 'system' OR company_id IS NULL)",
        [$companyId]
    );
    foreach ($allTemplates as $t) {
        $templateLookup[$t['id']] = $t['name'];
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
    "SELECT DISTINCT category FROM products WHERE company_id = ? AND category IS NOT NULL AND category != '' ORDER BY category",
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
