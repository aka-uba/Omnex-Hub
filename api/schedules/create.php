<?php
/**
 * Create Schedule API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$name = $request->input('name');
// Support both playlist_id and content_id
$contentId = $request->input('content_id') ?: $request->input('playlist_id');
$startDate = $request->input('start_date');

if (!$name || !$contentId || !$startDate) {
    Response::badRequest('Gerekli alanlar eksik');
}

$id = $db->generateUuid();
$db->insert('schedules', [
    'id' => $id,
    'company_id' => $companyId,
    'name' => $name,
    'description' => $request->input('description'),
    'target_type' => $request->input('target_type', 'all'),
    'target_id' => $request->input('target_id'),
    'content_type' => $request->input('content_type', 'playlist'),
    'content_id' => $contentId,
    'schedule_type' => $request->input('schedule_type', 'once'),
    'start_date' => $startDate,
    'end_date' => $request->input('end_date'),
    'start_time' => $request->input('start_time'),
    'end_time' => $request->input('end_time'),
    'days_of_week' => $request->input('days_of_week'),
    'priority' => $request->input('priority', 0),
    'status' => $request->input('status', 'pending'),
    'created_by' => $user['id']
]);

$schedule = $db->fetch("SELECT * FROM schedules WHERE id = ?", [$id]);

// Add virtual field for frontend compatibility
$schedule['playlist_id'] = $schedule['content_id'];

Response::success($schedule, 'Zamanlama oluşturuldu');
