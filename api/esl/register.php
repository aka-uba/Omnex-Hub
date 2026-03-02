<?php
/**
 * ESL Device Registration API
 *
 * POST /api/esl/register
 * Public endpoint - No authentication required
 *
 * Body:
 * - serialNumber (required): Device serial number
 * - firmware: Firmware version
 * - screenType: Screen type (e.g., e-ink, lcd)
 * - resolution: Screen resolution (e.g., "296x128")
 * - manufacturer: Device manufacturer
 * - storeCode: Store code for auto-assignment
 * - macAddress: Device MAC address
 *
 * Response:
 * - status: "pending"
 * - deviceId: Temporary request ID
 * - syncCode: 6-digit code for approval
 * - message: Instructions for the user
 */

$db = Database::getInstance();

// Get request data
$data = $request->json();

// Validate required fields
if (empty($data['serialNumber'])) {
    Response::badRequest('Serial number is required');
}

$serialNumber = trim($data['serialNumber']);
$firmware = $data['firmware'] ?? null;
$screenType = $data['screenType'] ?? null;
$resolution = $data['resolution'] ?? null;
$manufacturer = $data['manufacturer'] ?? null;
$storeCode = $data['storeCode'] ?? null;
$macAddress = $data['macAddress'] ?? null;

// Optional tenant context for strict multi-tenant registration.
// Supported keys: companyId, company_id, cid, companySlug, company_slug
$companyIdInput = trim((string) (
    $data['companyId']
    ?? $data['company_id']
    ?? $data['cid']
    ?? $request->get('companyId')
    ?? $request->get('company_id')
    ?? $request->get('cid')
    ?? ''
));
$companySlugInput = trim((string) (
    $data['companySlug']
    ?? $data['company_slug']
    ?? $request->get('companySlug')
    ?? $request->get('company_slug')
    ?? ''
));
$resolvedCompanyId = null;

if ($companyIdInput !== '' || $companySlugInput !== '') {
    $companyById = null;
    $companyBySlug = null;

    if ($companyIdInput !== '') {
        if (!preg_match('/^[a-f0-9-]{36}$/i', $companyIdInput)) {
            Response::badRequest('Invalid companyId format');
        }

        $companyById = $db->fetch(
            "SELECT id, slug, status FROM companies WHERE id = ?",
            [$companyIdInput]
        );

        if (!$companyById) {
            Response::badRequest('Invalid companyId');
        }
    }

    if ($companySlugInput !== '') {
        $companyBySlug = $db->fetch(
            "SELECT id, slug, status FROM companies WHERE slug = ?",
            [$companySlugInput]
        );

        if (!$companyBySlug) {
            Response::badRequest('Invalid companySlug');
        }
    }

    if ($companyById && $companyBySlug && $companyById['id'] !== $companyBySlug['id']) {
        Response::badRequest('companyId and companySlug do not match');
    }

    $resolvedCompany = $companyById ?: $companyBySlug;
    if (!empty($resolvedCompany['status']) && $resolvedCompany['status'] !== 'active') {
        Response::forbidden('Company is not active');
    }

    $resolvedCompanyId = $resolvedCompany['id'] ?? null;
}

// Get IP address
$ipAddress = $request->ip();

// Check if device already exists
$existingDevice = $db->fetch(
    "SELECT id, name, status FROM devices WHERE device_id = ?",
    [$serialNumber]
);

if ($existingDevice) {
    // Device already registered
    Response::error('Device already registered', 409, [
        'status' => 'already_registered',
        'deviceId' => $existingDevice['id'],
        'deviceName' => $existingDevice['name'],
        'deviceStatus' => $existingDevice['status']
    ]);
}

// Check for existing pending request (not expired)
$existingRequestSql = "SELECT id, sync_code, expires_at FROM device_sync_requests
     WHERE serial_number = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP";
$existingRequestParams = [$serialNumber];

if ($resolvedCompanyId) {
    $existingRequestSql .= " AND company_id = ?";
    $existingRequestParams[] = $resolvedCompanyId;
} else {
    $existingRequestSql .= " AND company_id IS NULL";
}

$existingRequest = $db->fetch($existingRequestSql, $existingRequestParams);

if ($existingRequest) {
    // Return existing sync code
    Response::success([
        'status' => 'pending',
        'requestId' => $existingRequest['id'],
        'syncCode' => $existingRequest['sync_code'],
        'expiresAt' => $existingRequest['expires_at'],
        'message' => 'Device registration pending. Use the sync code in the admin panel to approve.'
    ]);
}

// Generate 6-digit sync code
$syncCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

// Set expiry (15 minutes from now)
$expiresAt = date('Y-m-d H:i:s', time() + (15 * 60));

// Create sync request
$requestId = $db->generateUuid();

$db->query(
    "INSERT INTO device_sync_requests (id, company_id, serial_number, sync_code, firmware, screen_type, resolution, manufacturer, store_code, ip_address, mac_address, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    [
        $requestId,
        $resolvedCompanyId,
        $serialNumber,
        $syncCode,
        $firmware,
        $screenType,
        $resolution,
        $manufacturer,
        $storeCode,
        $ipAddress,
        $macAddress
    ]
);

// Log the registration attempt
if (class_exists('Logger')) {
    Logger::info('ESL device registration request', [
        'request_id' => $requestId,
        'serial_number' => $serialNumber,
        'ip_address' => $ipAddress,
        'store_code' => $storeCode
    ]);
}

Response::success([
    'status' => 'pending',
    'requestId' => $requestId,
    'syncCode' => $syncCode,
    'companyId' => $resolvedCompanyId,
    'expiresAt' => $expiresAt,
    'expiresIn' => 900, // 15 minutes in seconds
    'message' => 'Device registration pending. Use the sync code in the admin panel to approve this device.'
], 201);

