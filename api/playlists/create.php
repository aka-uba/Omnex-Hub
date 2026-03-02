<?php
/**
 * Create Playlist API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.template_id = t.id';

$name = $request->input('name');
if (!$name) {
    Response::badRequest('Oynatma listesi adı gerekli');
}

$id = $db->generateUuid();

// Handle items - ensure it's JSON encoded
$items = $request->input('items', '[]');
if (is_array($items)) {
    $items = json_encode($items);
}

$data = [
    'id' => $id,
    'company_id' => $companyId,
    'name' => $name,
    'description' => $request->input('description'),
    'items' => $items,
    'status' => $request->input('status', 'draft'),
    'orientation' => $request->input('orientation', 'landscape'),
    'layout_type' => $request->input('layout_type', 'full'),
    'default_duration' => $request->input('default_duration', 10),
    'transition' => $request->input('transition_type', $request->input('transition', 'none')),
    'transition_duration' => $request->input('transition_duration', 500),
    'created_by' => $user['id']
];

// Add template_id if provided
$templateId = $request->input('template_id');
if ($templateId) {
    $data['template_id'] = $templateId;
}

$db->insert('playlists', $data);

// Fetch with template info
$playlist = $db->fetch(
    "SELECT p.*, t.name as template_name, t.preview_image as template_preview
     FROM playlists p
     $templateJoin
     WHERE p.id = ?",
    [$id]
);
Response::success($playlist, 'Oynatma listesi oluşturuldu');
