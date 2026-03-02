<?php
/**
 * Delete Notification API
 * DELETE /api/notifications/:id
 *
 * Soft deletes a notification (status = 'deleted')
 * The notification is not permanently removed from database
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

// Get recipient record
$recipient = $db->fetch(
    "SELECT nr.id, nr.status
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     WHERE n.id = ? AND nr.user_id = ?",
    [$id, $userId]
);

if (!$recipient) {
    Response::notFound('Bildirim bulunamadi');
}

if ($recipient['status'] === 'deleted') {
    Response::success(null, 'Bildirim zaten silinmis');
}

// Soft delete: update status to deleted
$db->update('notification_recipients', [
    'status' => 'deleted',
    'deleted_at' => date('Y-m-d H:i:s')
], 'id = ?', [$recipient['id']]);

Response::success(null, 'Bildirim silindi');
