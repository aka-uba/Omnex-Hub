<?php
/**
 * PWA Player Device Registration API
 *
 * POST /api/player/register
 *
 * Browser fingerprint ile cihaz tanimla, 6 haneli sync code uret
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();

// Get request body
$body = $request->body();

// Validate required fields
if (empty($body['fingerprint'])) {
    Response::badRequest('Fingerprint is required');
}

$fingerprint = trim($body['fingerprint']);
$userAgent = $body['userAgent'] ?? $body['user_agent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
$screen = $body['screen'] ?? $body['screenResolution'] ?? '';
$os = $body['os'] ?? $body['platform'] ?? '';
$osVersion = $body['osVersion'] ?? $body['os_version'] ?? '';
$browser = $body['browser'] ?? '';
$browserVersion = $body['browserVersion'] ?? $body['browser_version'] ?? '';
$timezone = $body['timezone'] ?? '';
$language = $body['language'] ?? '';

// Optional tenant context from player URL/body.
// Supported keys: companyId, company_id, cid, companySlug, company_slug
$companyIdInput = trim((string) (
    $body['companyId']
    ?? $body['company_id']
    ?? $body['cid']
    ?? $request->get('companyId')
    ?? $request->get('company_id')
    ?? $request->get('cid')
    ?? ''
));
$companySlugInput = trim((string) (
    $body['companySlug']
    ?? $body['company_slug']
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

// Get IP address with proxy header support
$ipAddress = '';
if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    // X-Forwarded-For can contain multiple IPs, first is the client
    $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    $ipAddress = trim($ips[0]);
} elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
    $ipAddress = $_SERVER['HTTP_X_REAL_IP'];
} elseif (!empty($_SERVER['HTTP_CLIENT_IP'])) {
    $ipAddress = $_SERVER['HTTP_CLIENT_IP'];
} else {
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '';
}

// Device details
$deviceType = $body['deviceType'] ?? $body['device_type'] ?? '';
$brand = $body['brand'] ?? '';
$model = $body['model'] ?? '';
$screenWidth = isset($body['screenWidth']) ? (int)$body['screenWidth'] : null;
$screenHeight = isset($body['screenHeight']) ? (int)$body['screenHeight'] : null;
$screenDiagonal = isset($body['screenDiagonal']) ? (float)$body['screenDiagonal'] : null;
$pixelRatio = isset($body['devicePixelRatio']) ? (float)$body['devicePixelRatio'] : null;
$colorDepth = isset($body['colorDepth']) ? (int)$body['colorDepth'] : null;
$cpuCores = isset($body['cores']) ? (int)$body['cores'] : null;
$deviceMemory = isset($body['memory']) ? (float)$body['memory'] : null;
$touchSupport = !empty($body['touchSupport']) ? 1 : 0;
$connectionType = isset($body['connectionType']['type']) ? $body['connectionType']['type'] : (is_string($body['connectionType'] ?? null) ? $body['connectionType'] : null);

// Auto-detect browser from user agent if not provided
if (empty($browser) && $userAgent) {
    if (strpos($userAgent, 'Edg/') !== false) $browser = 'Edge';
    elseif (strpos($userAgent, 'Chrome') !== false) $browser = 'Chrome';
    elseif (strpos($userAgent, 'Firefox') !== false) $browser = 'Firefox';
    elseif (strpos($userAgent, 'Safari') !== false) $browser = 'Safari';
    else $browser = 'Unknown';
}

// Build screen resolution from screenWidth/screenHeight if not provided
if (empty($screen) && $screenWidth && $screenHeight) {
    $screen = $screenWidth . 'x' . $screenHeight;
}

// Build display name from device info
$displayName = '';
if ($brand && $model) {
    $displayName = "$brand $model";
} elseif ($model) {
    $displayName = $model;
} elseif ($brand) {
    $displayName = $brand;
}
if ($os && $osVersion) {
    $displayName .= ($displayName ? ' - ' : '') . "$os $osVersion";
} elseif ($os) {
    $displayName .= ($displayName ? ' - ' : '') . $os;
}

// Check if there's an existing pending request for this fingerprint
$existingRequestSql = "SELECT * FROM device_sync_requests
     WHERE fingerprint = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP";
$existingRequestParams = [$fingerprint];

if ($resolvedCompanyId) {
    $existingRequestSql .= " AND company_id = ?";
    $existingRequestParams[] = $resolvedCompanyId;
} else {
    $existingRequestSql .= " AND company_id IS NULL";
}

$existingRequestSql .= " ORDER BY created_at DESC LIMIT 1";
$existingRequest = $db->fetch($existingRequestSql, $existingRequestParams);

if ($existingRequest) {
    // Return existing sync code if still valid
    $expiresAt = strtotime($existingRequest['expires_at']);
    $expiresIn = $expiresAt - time();

    Response::success([
        'syncCode' => $existingRequest['sync_code'],
        'expiresIn' => $expiresIn,
        'expiresAt' => $existingRequest['expires_at']
    ], 'Existing sync code returned');
}

// Generate unique 6-digit sync code
$syncCode = null;
$maxAttempts = 10;
$attempts = 0;

while ($attempts < $maxAttempts) {
    $syncCode = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    // Check if code is unique
    $exists = $db->fetch(
        "SELECT id FROM device_sync_requests
         WHERE sync_code = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP",
        [$syncCode]
    );

    if (!$exists) {
        break;
    }

    $attempts++;
}

if ($attempts >= $maxAttempts) {
    Response::serverError('Could not generate unique sync code. Please try again.');
}

// Calculate expiration (15 minutes = 900 seconds)
$expiresInSeconds = 900;
$expiresAt = date('Y-m-d H:i:s', time() + $expiresInSeconds);

// Create sync request
$requestId = $db->generateUuid();

$insertData = [
    'id' => $requestId,
    'sync_code' => $syncCode,
    'company_id' => $resolvedCompanyId,
    'fingerprint' => $fingerprint,
    'user_agent' => $userAgent,
    'screen_resolution' => $screen,
    'os' => $os,
    'browser' => $browser,
    'timezone' => $timezone,
    'language' => $language,
    'ip_address' => $ipAddress,
    'status' => 'pending',
    'expires_at' => $expiresAt,
    'created_at' => date('Y-m-d H:i:s')
];

// Add new device detail fields (only if not null to avoid DB errors on old schemas)
$extraFields = [
    'device_type' => $deviceType,
    'brand' => $brand,
    'model' => $model,
    'os_version' => $osVersion,
    'browser_version' => $browserVersion,
    'screen_width' => $screenWidth,
    'screen_height' => $screenHeight,
    'screen_diagonal' => $screenDiagonal,
    'pixel_ratio' => $pixelRatio,
    'color_depth' => $colorDepth,
    'cpu_cores' => $cpuCores,
    'device_memory' => $deviceMemory,
    'touch_support' => $touchSupport,
    'connection_type' => $connectionType
];

// Only add non-empty extra fields
foreach ($extraFields as $key => $value) {
    if ($value !== null && $value !== '') {
        $insertData[$key] = $value;
    }
}

$db->insert('device_sync_requests', $insertData);

// Log the registration attempt
Logger::info('PWA device registration request', [
    'request_id' => $requestId,
    'sync_code' => $syncCode,
    'fingerprint' => substr($fingerprint, 0, 16) . '...',
    'device' => $displayName ?: 'Unknown',
    'brand' => $brand,
    'model' => $model,
    'device_type' => $deviceType,
    'os' => $os . ($osVersion ? " $osVersion" : ''),
    'browser' => $browser . ($browserVersion ? " $browserVersion" : ''),
    'screen' => $screen,
    'ip' => $ipAddress
]);

Response::success([
    'syncCode' => $syncCode,
    'expiresIn' => $expiresInSeconds,
    'expiresAt' => $expiresAt,
    'companyId' => $resolvedCompanyId
], 'Sync code generated successfully');

