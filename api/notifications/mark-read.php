<?php
/**
 * Mark Notification(s) as Read API
 * PUT /api/notifications/:id/read - Mark single notification as read
 * PUT /api/notifications/mark-all-read - Mark all notifications as read
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $user['id'];
$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

// Check if this is mark-all-read request
if ($id === 'mark-all-read') {
    // Mark all unread notifications as read for this user
    $where = ["nr.user_id = ?", "nr.status IN ('unread', 'sent')"];
    $params = [$userId];

    // Filter by company
    if ($companyId) {
        $where[] = "n.company_id = ?";
        $params[] = $companyId;
    }

    // Exclude expired notifications
    $where[] = "(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)";

    $whereClause = implode(' AND ', $where);

    // Get count of unread before update
    $unreadCount = $db->fetchColumn(
        "SELECT COUNT(*)
         FROM notification_recipients nr
         INNER JOIN notifications n ON nr.notification_id = n.id
         WHERE $whereClause",
        $params
    );

    // Update all unread to read (company-scoped only when active company exists)
    if ($companyId) {
        $db->query(
            "UPDATE notification_recipients
             SET status = 'read', read_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND status IN ('unread', 'sent')
             AND notification_id IN (
                 SELECT id FROM notifications
                 WHERE company_id = ?
                 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
             )",
            [$userId, $companyId]
        );
    } else {
        $db->query(
            "UPDATE notification_recipients
             SET status = 'read', read_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND status IN ('unread', 'sent')
             AND notification_id IN (
                 SELECT id FROM notifications
                 WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
             )",
            [$userId]
        );
    }

    Response::success([
        'marked_count' => (int)$unreadCount
    ], 'Tum bildirimler okundu olarak isaretlendi');

} else {
    // Mark single notification as read
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
        Response::notFound('Bildirim bulunamadi');
    }

    // Update status to read
    $db->update('notification_recipients', [
        'status' => 'read',
        'read_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$recipient['id']]);

    Response::success(null, 'Bildirim okundu olarak isaretlendi');
}

