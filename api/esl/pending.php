<?php
/**
 * ESL Pending Device Registrations List API
 *
 * GET /api/esl/pending
 * User Auth required (admin or user with device permissions)
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - per_page: Items per page (default: 20)
 * - search: Search by serial number or store code
 * - status: Filter by status (pending, approved, rejected, expired)
 *
 * Response:
 * - data: Array of pending registrations
 * - pagination: Pagination info
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Get company context for multi-tenant isolation
$companyId = Auth::getActiveCompanyId();

// Pagination
$page = max(1, (int)$request->query('page', 1));
$perPage = min(100, max(1, (int)$request->query('per_page', 20)));
$offset = ($page - 1) * $perPage;

// Filters
$search = $request->query('search', '');
$status = $request->query('status', '');
$includeUnbound = (int)$request->query('include_unbound', 0) === 1;

// Build query
$where = [];
$params = [];

// TENANT ISOLATION: By default show only active company rows.
// Unbound rows (company_id IS NULL) are hidden unless include_unbound=1.
// SuperAdmin with no active company still sees all.
if ($companyId) {
    if ($includeUnbound) {
        $where[] = "(dsr.company_id = ? OR dsr.company_id IS NULL)";
    } else {
        $where[] = "dsr.company_id = ?";
    }
    $params[] = $companyId;
}

// Default to pending status if not specified
if (!$status) {
    $status = 'pending';
}

// Filter by status
if ($status === 'all') {
    // Show all statuses
} elseif ($status === 'expired') {
    // Show only expired pending requests
    $where[] = "dsr.status = 'pending'";
    $where[] = "(dsr.expires_at IS NULL OR dsr.expires_at <= CURRENT_TIMESTAMP)";
} else {
    $where[] = "dsr.status = ?";
    $params[] = $status;

    // For pending status, show both valid and expired (let frontend distinguish)
    // Removed strict expires_at filter to avoid timezone issues
}

// Search filter (supports both ESL and PWA Player fields)
if ($search) {
    $where[] = "(dsr.serial_number LIKE ? OR dsr.store_code LIKE ? OR dsr.manufacturer LIKE ? OR dsr.fingerprint LIKE ? OR dsr.browser LIKE ? OR dsr.os LIKE ? OR dsr.sync_code LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
$approvedByJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(dsr.approved_by AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON dsr.approved_by = u.id';
$deviceJoin = $db->isPostgres()
    ? 'LEFT JOIN devices d ON CAST(dsr.device_id AS TEXT) = CAST(d.id AS TEXT)'
    : 'LEFT JOIN devices d ON dsr.device_id = d.id';

// Get total count
$total = $db->fetchColumn(
    "SELECT COUNT(*) FROM device_sync_requests dsr $whereClause",
    $params
);

// Get requests
$requests = $db->fetchAll(
    "SELECT dsr.*,
            u.first_name || ' ' || u.last_name as approved_by_name,
            d.name as device_name
     FROM device_sync_requests dsr
     $approvedByJoin
     $deviceJoin
     $whereClause
     ORDER BY dsr.created_at DESC
     LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

// Format response
$data = [];
foreach ($requests as $req) {
    $isExpired = $req['status'] === 'pending' && strtotime($req['expires_at'] ?? 'now') < time();

    // Determine device type (ESL vs PWA Player)
    $isPwaPlayer = !empty($req['fingerprint']) || !empty($req['browser']);

    // Build display name for identification
    $displayName = '';
    $brand = $req['brand'] ?? null;
    $model = $req['model'] ?? null;
    $osVersion = $req['os_version'] ?? null;
    $browserVersion = $req['browser_version'] ?? null;
    $detailedDeviceType = $req['device_type'] ?? null;

    if ($isPwaPlayer) {
        // Use brand/model if available, otherwise fallback to browser/os
        if ($brand && $model) {
            $displayName = "$brand $model";
        } elseif ($model) {
            $displayName = $model;
        } else {
            $browser = $req['browser'] ?? 'Unknown';
            $os = $req['os'] ?? 'Unknown';
            $displayName = "$browser / $os";
        }
    } else {
        $displayName = $req['serial_number'] ?? $req['manufacturer'] ?? 'Unknown Device';
    }

    // Format fingerprint: trim leading zeros and show last 12 chars max
    $fingerprint = $req['fingerprint'] ?? null;
    if ($fingerprint) {
        $fingerprint = ltrim($fingerprint, '0'); // Remove leading zeros
        if (strlen($fingerprint) > 12) {
            $fingerprint = substr($fingerprint, -12); // Show last 12 chars
        }
        if (empty($fingerprint)) {
            $fingerprint = '0'; // In case all zeros
        }
    }

    // Use serial_number if available, otherwise use formatted fingerprint
    $serialNumber = $req['serial_number'] ?? $fingerprint ?? null;

    $data[] = [
        'id' => $req['id'],
        // ESL fields (with fallbacks for PWA)
        'serialNumber' => $serialNumber,
        'syncCode' => $req['sync_code'] ?? null,
        'firmware' => $req['firmware'] ?? null,
        'screenType' => $req['screen_type'] ?? null,
        'resolution' => $req['resolution'] ?? $req['screen_resolution'] ?? null,
        'manufacturer' => $req['manufacturer'] ?? null,
        'storeCode' => $req['store_code'] ?? null,
        'ipAddress' => $req['ip_address'] ?? null,
        'macAddress' => $req['mac_address'] ?? null,
        // PWA Player fields
        'fingerprint' => $fingerprint,
        'fingerprintFull' => $req['fingerprint'] ?? null, // Keep full version if needed
        'browser' => $req['browser'] ?? null,
        'browserVersion' => $browserVersion,
        'os' => $req['os'] ?? null,
        'osVersion' => $osVersion,
        'userAgent' => $req['user_agent'] ?? null,
        'timezone' => $req['timezone'] ?? null,
        'language' => $req['language'] ?? null,
        // Device details (new fields)
        'brand' => $brand,
        'model' => $model,
        'detailedDeviceType' => $detailedDeviceType,
        'screenWidth' => $req['screen_width'] ?? null,
        'screenHeight' => $req['screen_height'] ?? null,
        'screenDiagonal' => $req['screen_diagonal'] ?? null,
        'pixelRatio' => $req['pixel_ratio'] ?? null,
        'colorDepth' => $req['color_depth'] ?? null,
        'cpuCores' => $req['cpu_cores'] ?? null,
        'deviceMemory' => $req['device_memory'] ?? null,
        'touchSupport' => !empty($req['touch_support']),
        'connectionType' => $req['connection_type'] ?? null,
        // Common fields
        'displayName' => $displayName,
        'deviceType' => $isPwaPlayer ? 'pwa_player' : 'esl',
        'status' => $isExpired ? 'expired' : ($req['status'] ?? 'pending'),
        'deviceId' => $req['device_id'] ?? null,
        'deviceName' => $req['device_name'] ?? null,
        'approvedBy' => $req['approved_by'] ?? null,
        'approvedByName' => $req['approved_by_name'] ?? null,
        'approvedAt' => $req['approved_at'] ?? null,
        'rejectedReason' => $req['rejection_reason'] ?? null,
        'expiresAt' => $req['expires_at'] ?? null,
        'isExpired' => $isExpired,
        'createdAt' => $req['created_at'] ?? null,
        'updatedAt' => $req['updated_at'] ?? null
    ];
}

// Count by status for summary (with tenant isolation)
$summaryWhere = '';
$summaryParams = [];
if ($companyId) {
    if ($includeUnbound) {
        $summaryWhere = "WHERE (company_id = ? OR company_id IS NULL)";
    } else {
        $summaryWhere = "WHERE company_id = ?";
    }
    $summaryParams[] = $companyId;
}

$statusCounts = $db->fetchAll(
    "SELECT
        status,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'pending' AND expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as expired_count
     FROM device_sync_requests
     $summaryWhere
     GROUP BY status",
    $summaryParams
);

$summary = [
    'pending' => 0,
    'expired' => 0,
    'approved' => 0,
    'rejected' => 0
];

foreach ($statusCounts as $sc) {
    if ($sc['status'] === 'pending') {
        $summary['pending'] = (int)$sc['count'] - (int)$sc['expired_count'];
        $summary['expired'] = (int)$sc['expired_count'];
    } else {
        $summary[$sc['status']] = (int)$sc['count'];
    }
}

Response::paginated($data, $total, $page, $perPage, [
    'summary' => $summary
]);

