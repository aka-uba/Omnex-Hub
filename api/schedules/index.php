<?php
/**
 * Schedules List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$schedulePlaylistJoin = $db->isPostgres()
    ? "LEFT JOIN playlists p ON CAST(s.playlist_id AS TEXT) = CAST(p.id AS TEXT)"
    : "LEFT JOIN playlists p ON s.playlist_id = p.id";

$where = [];
$params = [];

if ($companyId) {
    $where[] = "s.company_id = ?";
    $params[] = $companyId;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$schedules = $db->fetchAll(
    "SELECT s.*, p.name as playlist_name,
            (SELECT COUNT(*) FROM schedule_devices WHERE schedule_id = s.id) as device_count
     FROM schedules s
     $schedulePlaylistJoin
     $whereClause
     ORDER BY s.start_date DESC",
    $params
);

Response::success($schedules ?? []);
