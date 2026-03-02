<?php
/**
 * Get Single Notification API
 * GET /api/notifications/:id
 *
 * Returns notification details
 * Automatically marks as read when viewed
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$id = $request->routeParam('id');
$userId = $user['id'];
$createdByJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(n.created_by AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON n.created_by = u.id';

if (!$id) {
    Response::badRequest('Bildirim ID gerekli');
}

// Get notification with recipient info
$notification = $db->fetch(
    "SELECT
        n.id,
        n.company_id,
        n.title,
        n.message,
        n.type,
        n.icon,
        n.link,
        n.target_type,
        n.target_id,
        n.channels,
        n.priority,
        n.expires_at,
        n.created_by,
        n.created_at,
        nr.id as recipient_id,
        nr.status,
        nr.read_at,
        nr.archived_at,
        u.first_name || ' ' || u.last_name as created_by_name
     FROM notification_recipients nr
     INNER JOIN notifications n ON nr.notification_id = n.id
     $createdByJoin
     WHERE n.id = ? AND nr.user_id = ?",
    [$id, $userId]
);

if (!$notification) {
    Response::notFound('Bildirim bulunamadi');
}

// Check if notification is deleted
if ($notification['status'] === 'deleted') {
    Response::notFound('Bildirim bulunamadi');
}

// Auto-mark as read if currently unread
if ($notification['status'] === 'unread' || $notification['status'] === 'sent') {
    $db->update('notification_recipients', [
        'status' => 'read',
        'read_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$notification['recipient_id']]);

    $notification['status'] = 'read';
    $notification['read_at'] = date('Y-m-d H:i:s');
}

// Parse channels JSON
$notification['channels'] = json_decode($notification['channels'], true) ?? ['web'];

// Remove internal recipient_id from response
unset($notification['recipient_id']);

Response::success($notification);
