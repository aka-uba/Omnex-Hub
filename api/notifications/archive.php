<?php
/**
 * Archive Notification API
 * PUT /api/notifications/:id/archive
 *
 * Archives/unarchives a notification.
 * Optional body:
 * - archived: boolean (true=archive, false=unarchive)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$id = $request->routeParam('id');
$userId = $user['id'];

if (!$id) {
    Response::badRequest('Bildirim ID gerekli');
}

$archivedInput = $request->input('archived', true);
$shouldArchive = filter_var($archivedInput, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
if ($shouldArchive === null) {
    $shouldArchive = true;
}

// Get recipient record
$recipient = $db->fetch(
    "SELECT nr.id, nr.status, nr.read_at
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     WHERE n.id = ? AND nr.user_id = ?",
    [$id, $userId]
);

if (!$recipient) {
    Response::notFound('Bildirim bulunamadi');
}

if ($recipient['status'] === 'deleted') {
    Response::notFound('Bildirim bulunamadi');
}

if ($shouldArchive) {
    if ($recipient['status'] === 'archived') {
        Response::success(null, 'Bildirim zaten arsivlenmis');
    }

    // Update status to archived
    $db->update('notification_recipients', [
        'status' => 'archived',
        'archived_at' => date('Y-m-d H:i:s'),
        // Also mark as read if it wasn't
        'read_at' => $recipient['status'] === 'unread' ? date('Y-m-d H:i:s') : ($recipient['read_at'] ?? null)
    ], 'id = ?', [$recipient['id']]);

    Response::success(null, 'Bildirim arsivlendi');
}

if ($recipient['status'] !== 'archived') {
    Response::success(null, 'Bildirim zaten aktif');
}

// Unarchive: move back to read state
$db->update('notification_recipients', [
    'status' => 'read',
    'archived_at' => null,
    'read_at' => date('Y-m-d H:i:s')
], 'id = ?', [$recipient['id']]);

Response::success(null, 'Bildirim arsivden cikarildi');
