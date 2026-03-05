<?php
/**
 * Assign Playlist to Devices API (bulk replace)
 *
 * POST /api/playlists/:id/assign-devices
 *
 * Body:
 * - device_ids (required): array of device IDs
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$playlistId = $request->routeParam('id');
$data = $request->json();
$deviceIds = $data['device_ids'] ?? null;

if (empty($playlistId)) {
    Response::badRequest('Playlist ID is required');
}

if (!is_array($deviceIds)) {
    Response::badRequest('device_ids must be an array');
}

$companyId = Auth::getActiveCompanyId();

// Verify playlist exists and belongs to company
$playlist = $db->fetch(
    "SELECT * FROM playlists WHERE id = ? AND company_id = ?",
    [$playlistId, $companyId]
);

if (!$playlist) {
    Response::notFound('Playlist not found');
}

// Read currently assigned devices (same company) before replacing.
$previousAssignments = $db->fetchAll(
    "SELECT dca.device_id
     FROM device_content_assignments dca
     JOIN devices d ON dca.device_id = d.id
     WHERE dca.content_type = 'playlist'
       AND dca.content_id = ?
       AND dca.status = 'active'
       AND d.company_id = ?",
    [$playlistId, $companyId]
);
$previousDeviceIds = array_values(array_unique(array_column($previousAssignments, 'device_id')));

// Normalize device IDs and keep only distinct values
$deviceIds = array_values(array_unique(array_filter($deviceIds)));

// Verify devices belong to company
if (!empty($deviceIds)) {
    $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
    $devices = $db->fetchAll(
        "SELECT id, name FROM devices WHERE company_id = ? AND id IN ($placeholders)",
        array_merge([$companyId], $deviceIds)
    );
    $validDeviceIds = array_column($devices, 'id');
    $deviceIds = $validDeviceIds;
}

try {
    $db->beginTransaction();

    // Enforce single active playlist per device:
    // - clear this playlist assignments
    // - clear selected devices from any other active playlist assignments
    $deactivateSql = "
        UPDATE device_content_assignments
        SET status = 'inactive'
        WHERE content_type = 'playlist'
          AND status = 'active'
          AND (content_id = ?
    ";
    $deactivateParams = [$playlistId];

    if (!empty($deviceIds)) {
        $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
        $deactivateSql .= " OR device_id IN ($placeholders)";
        $deactivateParams = array_merge($deactivateParams, $deviceIds);
    }
    $deactivateSql .= ")";
    $db->query($deactivateSql, $deactivateParams);

    // Create active assignments for selected devices
    $created = 0;
    foreach ($deviceIds as $deviceId) {
        $assignmentId = $db->generateUuid();
        $db->query(
            "INSERT INTO device_content_assignments (id, device_id, content_type, content_id, status, created_at)
             VALUES (?, ?, 'playlist', ?, 'active', CURRENT_TIMESTAMP)",
            [$assignmentId, $deviceId, $playlistId]
        );

        // Activity log
        $db->insert('device_logs', [
            'id' => $db->generateUuid(),
            'device_id' => $deviceId,
            'action' => 'sync',
            'content_type' => 'playlist',
            'content_id' => $playlistId,
            'status' => 'success',
            'request_data' => json_encode([
                'playlist_id' => $playlistId,
                'assigned' => true
            ])
        ]);

        $created++;
    }

    $removedDeviceIds = array_values(array_diff($previousDeviceIds, $deviceIds));
    $affectedDeviceIds = array_values(array_unique(array_merge($deviceIds, $removedDeviceIds)));

    // Ensure all affected devices refresh immediately (assigned + unassigned).
    // Reset stream_started_at so live HLS window restarts from beginning with new playlist.
    foreach ($affectedDeviceIds as $deviceId) {
        $db->query("UPDATE devices SET updated_at = CURRENT_TIMESTAMP, stream_started_at = NULL WHERE id = ?", [$deviceId]);

        $commandId = $db->generateUuid();
        $db->query(
            "INSERT INTO device_commands (id, device_id, command, parameters, status, created_by, created_at)
             VALUES (?, ?, 'refresh_content', ?, 'pending', ?, CURRENT_TIMESTAMP)",
            [
                $commandId,
                $deviceId,
                json_encode([
                    'playlist_id' => in_array($deviceId, $deviceIds, true) ? $playlistId : null,
                    'source' => 'playlist_assign_devices'
                ]),
                $user['id']
            ]
        );
    }

    foreach ($removedDeviceIds as $deviceId) {
        $db->insert('device_logs', [
            'id' => $db->generateUuid(),
            'device_id' => $deviceId,
            // Keep action value compatible with existing CHECK constraints across deployments.
            'action' => 'sync',
            'content_type' => 'playlist',
            'content_id' => $playlistId,
            'status' => 'success',
            'request_data' => json_encode([
                'playlist_id' => $playlistId,
                'assigned' => false,
                'unassigned' => true
            ])
        ]);
    }

    $db->commit();

    Response::success([
        'playlist_id' => $playlistId,
        'assigned_count' => $created,
        'unassigned_count' => count($removedDeviceIds),
        'device_ids' => $deviceIds
    ]);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    if (class_exists('Logger')) {
        Logger::error('Playlist assign-devices failed', [
            'playlist_id' => $playlistId,
            'company_id' => $companyId,
            'device_ids' => $deviceIds,
            'error' => $e->getMessage()
        ]);
    }

    Response::serverError('Cihaz atamalari kaydedilemedi');
}














