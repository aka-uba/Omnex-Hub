<?php
/**
 * Schedules - Show
 */

$db = Database::getInstance();
$user = Auth::user();
$schedulePlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(s.playlist_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON s.playlist_id = p.id";

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

try {
    $schedule = $db->fetch(
        "SELECT s.*, p.name as playlist_name
         FROM schedules s
         $schedulePlaylistJoin
         WHERE s.id = ? AND s.company_id = ?",
        [$id, $companyId]
    );

    if (!$schedule) {
        Response::notFound('Zamanlama bulunamadi');
    }

    // Get associated devices
    $devices = $db->fetchAll(
        "SELECT device_id FROM schedule_devices WHERE schedule_id = ?",
        [$id]
    );
    $schedule['device_ids'] = array_column($devices, 'device_id');

    // Parse weekdays if stored as JSON
    if ($schedule['weekdays'] && is_string($schedule['weekdays'])) {
        $schedule['weekdays'] = json_decode($schedule['weekdays'], true);
    }

    Response::success($schedule);
} catch (Exception $e) {
    Logger::error('Schedule show error', ['error' => $e->getMessage()]);
    Response::serverError('Zamanlama yuklenemedi');
}
