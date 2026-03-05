<?php
/**
 * Assign Playlist to Device API
 *
 * POST /api/devices/:id/assign-playlist
 * User Auth required
 *
 * Body:
 * - playlist_id (required): Playlist ID to assign
 *
 * Response:
 * - success: true
 * - assignment: Assignment record
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$deviceId = $request->getRouteParam('id');
$data = $request->json();
$playlistId = $data['playlist_id'] ?? null;

if (empty($deviceId)) {
    Response::badRequest('Device ID is required');
}

if (empty($playlistId)) {
    Response::badRequest('Playlist ID is required');
}

// Verify device exists and belongs to company
$companyId = Auth::getActiveCompanyId();
$device = $db->fetch(
    "SELECT * FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Device not found');
}

// Verify playlist exists and belongs to company
$playlist = $db->fetch(
    "SELECT * FROM playlists WHERE id = ? AND company_id = ?",
    [$playlistId, $companyId]
);

if (!$playlist) {
    Response::notFound('Playlist not found');
}

// Check if playlist has items (warn but don't block)
$normalizedItemCount = (int) $db->fetchColumn(
    "SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ?",
    [$playlistId]
);
$playlistItems = json_decode($playlist['items'] ?? '[]', true);
$jsonItemCount = is_array($playlistItems) ? count($playlistItems) : 0;
$itemsCount = max($normalizedItemCount, $jsonItemCount);
$hasItems = $itemsCount > 0;
$warning = null;
if (!$hasItems) {
    $warning = 'Bu playlist boş! Cihazda içerik görüntülenmeyecek. Playlist\'e medya ekleyin.';
}

// Deactivate existing playlist assignments for this device
$db->query(
    "UPDATE device_content_assignments SET status = 'inactive' WHERE device_id = ? AND content_type = 'playlist'",
    [$deviceId]
);

// Create new assignment
$assignmentId = $db->generateUuid();
$db->query(
    "INSERT INTO device_content_assignments (id, device_id, content_type, content_id, status, created_at)
     VALUES (?, ?, 'playlist', ?, 'active', CURRENT_TIMESTAMP)",
    [$assignmentId, $deviceId, $playlistId]
);

// Also update device last_sync to trigger refresh
$db->query(
    "UPDATE devices SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [$deviceId]
);

// Create device command to refresh content
$commandId = $db->generateUuid();
$db->query(
    "INSERT INTO device_commands (id, device_id, command, parameters, status, created_by, created_at)
     VALUES (?, ?, 'refresh_content', ?, 'pending', ?, CURRENT_TIMESTAMP)",
    [$commandId, $deviceId, json_encode(['playlist_id' => $playlistId]), $user['id']]
);

// Log the assignment
if (class_exists('Logger')) {
    Logger::info('Playlist assigned to device', [
        'device_id' => $deviceId,
        'playlist_id' => $playlistId,
        'assigned_by' => $user['id']
    ]);
}

// Add device log entry for activity history
$db->insert('device_logs', [
    'id' => $db->generateUuid(),
    'device_id' => $deviceId,
    'action' => 'sync',
    'content_type' => 'playlist',
    'content_id' => $playlistId,
    'status' => 'success',
    'request_data' => json_encode([
        'playlist_id' => $playlistId,
        'items_count' => $itemsCount
    ])
]);

$response = [
    'assignment' => [
        'id' => $assignmentId,
        'device_id' => $deviceId,
        'playlist_id' => $playlistId,
        'status' => 'active'
    ],
    'device' => [
        'id' => $device['id'],
        'name' => $device['name']
    ],
    'playlist' => [
        'id' => $playlist['id'],
        'name' => $playlist['name'],
        'has_items' => $hasItems,
        'items_count' => $itemsCount
    ],
    'message' => 'Playlist assigned successfully'
];

if ($warning) {
    $response['warning'] = $warning;
}

Response::success($response);

