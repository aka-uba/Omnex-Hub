<?php
/**
 * Delete Schedule API
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

$db->delete('schedules', 'id = ?', [$id]);
Response::success(null, 'Zamanlama silindi');
