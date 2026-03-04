<?php
/**
 * Update Playlist API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.template_id = t.id';

$playlist = $db->fetch("SELECT * FROM playlists WHERE id = ? AND company_id = ?", [$id, $companyId]);
if (!$playlist) {
    Response::notFound('Oynatma listesi bulunamadı');
}

$data = ['updated_at' => date('Y-m-d H:i:s')];

if ($request->has('name')) $data['name'] = $request->input('name');
if ($request->has('description')) $data['description'] = $request->input('description');
if ($request->has('items')) $data['items'] = is_array($request->input('items')) ? json_encode($request->input('items')) : $request->input('items');
if ($request->has('duration')) $data['duration'] = $request->input('duration');
if ($request->has('default_duration')) $data['default_duration'] = $request->input('default_duration');
if ($request->has('transition_type')) $data['transition'] = $request->input('transition_type');
elseif ($request->has('transition')) $data['transition'] = $request->input('transition');
if ($request->has('transition_duration')) $data['transition_duration'] = $request->input('transition_duration');
if ($request->has('status')) $data['status'] = $request->input('status');
if ($request->has('orientation')) $data['orientation'] = $request->input('orientation');
if ($request->has('layout_type')) $data['layout_type'] = $request->input('layout_type');
if ($request->has('template_id')) $data['template_id'] = $request->input('template_id') ?: null;

$db->update('playlists', $data, 'id = ?', [$id]);

$assignedDevices = $db->fetchAll(
    "SELECT DISTINCT dca.device_id
     FROM device_content_assignments dca
     JOIN devices d ON dca.device_id = d.id
     WHERE dca.content_type = 'playlist'
       AND dca.content_id = ?
       AND dca.status = 'active'
       AND d.company_id = ?",
    [$id, $companyId]
);

foreach ($assignedDevices as $assignedDevice) {
    $deviceId = $assignedDevice['device_id'] ?? null;

    if (!$deviceId) {
        continue;
    }

    $db->query(
        "UPDATE devices SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [$deviceId]
    );

    $commandId = $db->generateUuid();
    $db->query(
        "INSERT INTO device_commands (id, device_id, command, parameters, status, priority, created_at, created_by)
         VALUES (?, ?, 'refresh_content', ?, 'pending', ?, CURRENT_TIMESTAMP, ?)",
        [
            $commandId,
            $deviceId,
            json_encode([
                'playlist_id' => $id,
                'source' => 'playlist_update'
            ]),
            10,
            $user['id']
        ]
    );
}

// Fetch with template info
$playlist = $db->fetch(
    "SELECT p.*, t.name as template_name, t.preview_image as template_preview
     FROM playlists p
     $templateJoin
     WHERE p.id = ?",
    [$id]
);
Response::success($playlist, 'Oynatma listesi güncellendi');
