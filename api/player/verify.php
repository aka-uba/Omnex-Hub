<?php
/**
 * PWA Player Sync Code Verification API
 *
 * GET /api/player/verify?syncCode=123456
 *
 * PWA bu endpoint'i poll ederek onay bekler
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();

// Get sync code from query params
$syncCode = $request->get('syncCode');
$fingerprint = trim((string)($request->get('fingerprint') ?? ''));
$companyIdInput = trim((string) (
    $request->get('companyId')
    ?? $request->get('company_id')
    ?? $request->get('cid')
    ?? ''
));
$companySlugInput = trim((string) (
    $request->get('companySlug')
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
            "SELECT id FROM companies WHERE id = ?",
            [$companyIdInput]
        );

        if (!$companyById) {
            Response::badRequest('Invalid companyId');
        }
    }

    if ($companySlugInput !== '') {
        $companyBySlug = $db->fetch(
            "SELECT id FROM companies WHERE slug = ?",
            [$companySlugInput]
        );

        if (!$companyBySlug) {
            Response::badRequest('Invalid companySlug');
        }
    }

    if ($companyById && $companyBySlug && $companyById['id'] !== $companyBySlug['id']) {
        Response::badRequest('companyId and companySlug do not match');
    }

    $resolvedCompanyId = ($companyById ?: $companyBySlug)['id'] ?? null;
}

if (empty($syncCode)) {
    Response::badRequest('Sync code is required');
}

// Validate sync code format (6 digits)
if (!preg_match('/^\d{6}$/', $syncCode)) {
    Response::badRequest('Invalid sync code format');
}

// Find sync request (scope-aware for tenant-safe polling)
$syncRequestSql = "SELECT * FROM device_sync_requests WHERE sync_code = ?";
$syncRequestParams = [$syncCode];

if ($resolvedCompanyId) {
    $syncRequestSql .= " AND company_id = ?";
    $syncRequestParams[] = $resolvedCompanyId;
}

if ($fingerprint !== '') {
    $syncRequestSql .= " AND (fingerprint = ? OR serial_number = ?)";
    $syncRequestParams[] = $fingerprint;
    $syncRequestParams[] = $fingerprint;
}

$syncRequest = $db->fetch($syncRequestSql, $syncRequestParams);

if (!$syncRequest) {
    Response::notFound('Sync code not found');
}

// Check expiration
$expiresAt = strtotime($syncRequest['expires_at']);
$isExpired = $expiresAt < time();

// Update status to expired if needed
if ($isExpired && $syncRequest['status'] === 'pending') {
    $db->update(
        'device_sync_requests',
        ['status' => 'expired'],
        'id = ?',
        [$syncRequest['id']]
    );
    $syncRequest['status'] = 'expired';
}

// Prepare response based on status
$response = [
    'status' => $syncRequest['status'],
    'expiresAt' => $syncRequest['expires_at']
];

// If approved, include device token
if ($syncRequest['status'] === 'approved' && $syncRequest['device_id']) {
    // Get existing device token (generateJwtToken deletes old tokens, so we just need to find active one)
    $existingToken = $db->fetch(
        "SELECT token FROM device_tokens
         WHERE device_id = ? AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC LIMIT 1",
        [$syncRequest['device_id']]
    );

    if ($existingToken && !empty($existingToken['token'])) {
        $response['token'] = $existingToken['token'];
        $response['deviceToken'] = $existingToken['token']; // Backward compat
    } else {
        // Token not found - generate new JWT token
        $device = $db->fetch("SELECT * FROM devices WHERE id = ?", [$syncRequest['device_id']]);
        if ($device) {
            $tokenData = DeviceAuthMiddleware::generateJwtToken([
                'id' => $device['id'],
                'device_id' => $device['device_id'],
                'company_id' => $device['company_id']
            ], 365);
            $response['token'] = $tokenData['token'];
            $response['deviceToken'] = $tokenData['token']; // Backward compat
        }
    }

    $response['deviceId'] = $syncRequest['device_id'];

    // Include device info
    $device = $db->fetch(
        "SELECT id, name, type, company_id FROM devices WHERE id = ?",
        [$syncRequest['device_id']]
    );

    if ($device) {
        $response['device'] = [
            'id' => $device['id'],
            'name' => $device['name'],
            'type' => $device['type']
        ];
        $response['companyId'] = $device['company_id'];
    }

    Logger::info('PWA device sync code verified and approved', [
        'sync_code' => $syncCode,
        'device_id' => $syncRequest['device_id']
    ]);
}

Response::success($response);

