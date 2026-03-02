<?php
/**
 * Delete Playlist API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

$playlist = $db->fetch("SELECT * FROM playlists WHERE id = ? AND company_id = ?", [$id, $companyId]);
if (!$playlist) {
    Response::notFound('Oynatma listesi bulunamadı');
}

$db->delete('playlists', 'id = ?', [$id]);
Response::success(null, 'Oynatma listesi silindi');
