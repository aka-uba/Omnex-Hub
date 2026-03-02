<?php
/**
 * Audit Logs - Show
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only admins can view audit logs
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

$id = $request->routeParam('id');

try {
    $auditUserJoin = $db->isPostgres()
        ? 'LEFT JOIN users u ON CAST(al.user_id AS TEXT) = CAST(u.id AS TEXT)'
        : 'LEFT JOIN users u ON al.user_id = u.id';
    $query = "SELECT al.*,
                     COALESCE(u.first_name || ' ' || u.last_name, 'System') as user_name
              FROM audit_logs al
              $auditUserJoin
              WHERE al.id = ?";

    $params = [$id];

    // Company filter for non-super admins
    if ($user['role'] !== 'SuperAdmin') {
        $query .= " AND al.company_id = ?";
        $params[] = $user['company_id'];
    }

    $log = $db->fetch($query, $params);

    if (!$log) {
        Response::notFound('Log kaydı bulunamadi');
    }

    // Parse JSON fields
    if ($log['old_values']) {
        $log['old_values'] = json_decode($log['old_values'], true);
    }
    if ($log['new_values']) {
        $log['new_values'] = json_decode($log['new_values'], true);
    }

    Response::success($log);
} catch (Exception $e) {
    Logger::error('Audit log show error', ['error' => $e->getMessage()]);
    Response::serverError('Log kaydı yuklenemedi');
}
