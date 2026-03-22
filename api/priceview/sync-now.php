<?php
/**
 * PriceView Instant Sync Trigger API
 *
 * POST /api/priceview/sync-now
 *
 * Body (optional):
 * - device_id: string (single device)
 * - device_ids: string[] (multiple devices)
 *
 * Queues a high-priority `refresh` command for PriceView devices.
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$companyId = Auth::getActiveCompanyId();
$body = $request->body() ?: [];

$requestedDeviceIds = [];
$singleDeviceId = $body['device_id'] ?? null;
$multipleDeviceIds = $body['device_ids'] ?? null;

if (is_string($singleDeviceId) && trim($singleDeviceId) !== '') {
    $requestedDeviceIds[] = trim($singleDeviceId);
}

if (is_array($multipleDeviceIds)) {
    foreach ($multipleDeviceIds as $deviceId) {
        if (is_string($deviceId) && trim($deviceId) !== '') {
            $requestedDeviceIds[] = trim($deviceId);
        }
    }
}

$requestedDeviceIds = array_values(array_unique($requestedDeviceIds));

$params = [$companyId];
$sql = "SELECT id, name, model, company_id
        FROM devices
        WHERE company_id = ?
          AND model = 'priceview'";

if (!empty($requestedDeviceIds)) {
    $placeholders = implode(',', array_fill(0, count($requestedDeviceIds), '?'));
    $sql .= " AND id IN ($placeholders)";
    $params = array_merge($params, $requestedDeviceIds);
}

$devices = $db->fetchAll($sql, $params);

if (empty($devices)) {
    Response::success([
        'queued' => 0,
        'skipped' => 0,
        'targets' => 0,
        'device_ids' => [],
    ], 'No PriceView devices found for sync');
}

$queued = 0;
$skipped = 0;
$queuedDeviceIds = [];
$requestSource = is_string($body['source'] ?? null) ? trim((string)$body['source']) : '';
if ($requestSource === '') {
    $requestSource = !empty($requestedDeviceIds) ? 'device_detail' : 'integration';
}
$forceQueue = !empty($body['force']);
$isDeviceScopedRequest = !empty($requestedDeviceIds);

foreach ($devices as $device) {
    $deviceId = (string)($device['id'] ?? '');
    if ($deviceId === '') {
        continue;
    }

    // Allow explicit device-detail requests to force queue a fresh refresh command.
    // Integration-wide sync keeps short dedup to avoid flooding.
    if (!$forceQueue && !$isDeviceScopedRequest) {
        $existing = $db->fetch(
            "SELECT id
             FROM device_commands
             WHERE device_id = ?
               AND command = 'refresh'
               AND status IN ('pending', 'sent')
               AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '2 minutes')
             LIMIT 1",
            [$deviceId]
        );

        if ($existing) {
            $skipped++;
            continue;
        }
    }

    $commandId = $db->generateUuid();
    $parameters = json_encode([
        'reason' => 'priceview_sync_now',
        'source' => $requestSource,
        'requested_at' => date('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $db->query(
        "INSERT INTO device_commands (id, device_id, command, parameters, status, priority, created_at, created_by)
         VALUES (?, ?, 'refresh', ?, 'pending', 10, CURRENT_TIMESTAMP, ?)",
        [$commandId, $deviceId, $parameters, $user['id']]
    );

    $queued++;
    $queuedDeviceIds[] = $deviceId;
}

Logger::info('PriceView instant sync queued', [
    'company_id' => $companyId,
    'requested_count' => count($requestedDeviceIds),
    'target_count' => count($devices),
    'queued_count' => $queued,
    'skipped_count' => $skipped,
    'source' => $requestSource,
    'forced' => $forceQueue || $isDeviceScopedRequest,
    'user_id' => $user['id'] ?? null,
]);

Response::success([
    'queued' => $queued,
    'skipped' => $skipped,
    'targets' => count($devices),
    'device_ids' => $queuedDeviceIds,
], 'PriceView sync command queued');
