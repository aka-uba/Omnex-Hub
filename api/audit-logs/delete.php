<?php
/**
 * Audit Logs - Delete
 *
 * Permanently deletes audit logs
 * Only SuperAdmin can delete
 * Last 1 month of data is protected and cannot be deleted
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only SuperAdmin can delete audit logs
if ($user['role'] !== 'SuperAdmin') {
    Response::forbidden('Audit kayitlarini sadece SuperAdmin silebilir');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'DELETE' && $method !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);

// Get IDs to delete or use filters
$ids = $data['ids'] ?? null;
$deleteArchived = $data['delete_archived'] ?? false;
$dateBefore = $data['date_before'] ?? null;

// Calculate 1 month ago date (protection boundary)
$oneMonthAgo = date('Y-m-d H:i:s', strtotime('-1 month'));

try {
    $deleted = 0;
    $protected = 0;

    if ($ids && is_array($ids)) {
        // Delete specific IDs (but check date protection)
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // Count protected records
        $protectedQuery = "SELECT COUNT(*) as count FROM audit_logs
                          WHERE id IN ($placeholders)
                          AND created_at >= ?";
        $protectedParams = array_merge($ids, [$oneMonthAgo]);
        $protectedResult = $db->fetch($protectedQuery, $protectedParams);
        $protected = $protectedResult['count'] ?? 0;

        // Delete only unprotected logs
        $query = "DELETE FROM audit_logs
                  WHERE id IN ($placeholders)
                  AND created_at < ?";
        $params = array_merge($ids, [$oneMonthAgo]);

        $db->query($query, $params);
        $deleted = $db->rowCount();

    } elseif ($deleteArchived) {
        // Delete all archived logs (safe operation)
        $query = "DELETE FROM audit_logs
                  WHERE archived_at IS NOT NULL
                  AND created_at < ?";
        $params = [$oneMonthAgo];

        $db->query($query, $params);
        $deleted = $db->rowCount();

    } elseif ($dateBefore) {
        // Delete all logs before a specific date (must be older than 1 month)
        $targetDate = date('Y-m-d H:i:s', strtotime($dateBefore));

        // Ensure target date is before the 1-month protection
        if ($targetDate >= $oneMonthAgo) {
            Response::error('Son 1 ayin verileri silinemez', 400);
        }

        $query = "DELETE FROM audit_logs WHERE created_at < ?";
        $params = [$targetDate];

        $db->query($query, $params);
        $deleted = $db->rowCount();

    } else {
        Response::error('Silme parametreleri belirtilmedi (ids, delete_archived veya date_before)', 400);
    }

    // Log the delete action (ironically, this creates a new audit log)
    Logger::audit('delete', 'audit_logs', [
        'deleted_count' => $deleted,
        'protected_count' => $protected,
        'delete_archived' => $deleteArchived,
        'date_before' => $dateBefore
    ]);

    Response::json([
        'success' => true,
        'message' => "{$deleted} kayit kalici olarak silindi",
        'data' => [
            'deleted' => $deleted,
            'protected' => $protected,
            'protection_date' => $oneMonthAgo
        ]
    ]);

} catch (Exception $e) {
    Logger::error('Audit log delete error', ['error' => $e->getMessage()]);
    Response::serverError('Silme islemi basarisiz');
}
