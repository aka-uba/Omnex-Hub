<?php
/**
 * Update Schedule API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

$schedule = $db->fetch("SELECT * FROM schedules WHERE id = ? AND company_id = ?", [$id, $companyId]);
if (!$schedule) {
    Response::notFound('Zamanlama bulunamadı');
}

$data = ['updated_at' => date('Y-m-d H:i:s')];

if ($request->has('name')) $data['name'] = $request->input('name');
if ($request->has('playlist_id')) $data['playlist_id'] = $request->input('playlist_id');
if ($request->has('start_date')) $data['start_date'] = $request->input('start_date');
if ($request->has('end_date')) $data['end_date'] = $request->input('end_date');
if ($request->has('status')) $data['status'] = $request->input('status');

$db->update('schedules', $data, 'id = ?', [$id]);

$schedule = $db->fetch("SELECT * FROM schedules WHERE id = ?", [$id]);
Response::success($schedule, 'Zamanlama güncellendi');
