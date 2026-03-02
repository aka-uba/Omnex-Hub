<?php
/**
 * Audit Logs - Archive
 *
 * Archives audit logs older than 1 month
 * Only Admin and SuperAdmin can archive
 * Last 1 month of data is protected
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only admins can archive audit logs
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Archive logs
    $data = json_decode(file_get_contents('php://input'), true);

    // Get IDs to archive or use date filter
    $ids = $data['ids'] ?? null;
    $dateBefore = $data['date_before'] ?? null;

    // Calculate 1 month ago date (protection boundary)
    $oneMonthAgo = date('Y-m-d H:i:s', strtotime('-1 month'));

    try {
        $archived = 0;
        $protected = 0;

        if ($ids && is_array($ids)) {
            // Archive specific IDs (but check date protection)
            $placeholders = implode(',', array_fill(0, count($ids), '?'));

            // First, count how many are protected
            $protectedQuery = "SELECT COUNT(*) as count FROM audit_logs
                              WHERE id IN ($placeholders)
                              AND created_at >= ?
                              AND archived_at IS NULL";
            $protectedParams = array_merge($ids, [$oneMonthAgo]);
            $protectedResult = $db->fetch($protectedQuery, $protectedParams);
            $protected = $protectedResult['count'] ?? 0;

            // Archive only unprotected logs
            $query = "UPDATE audit_logs
                      SET archived_at = CURRENT_TIMESTAMP,
                          archived_by = ?
                      WHERE id IN ($placeholders)
                      AND created_at < ?
                      AND archived_at IS NULL";

            // Company filter for non-super admins
            if ($user['role'] !== 'SuperAdmin') {
                $query .= " AND company_id = ?";
                $params = array_merge([$user['id']], $ids, [$oneMonthAgo, $user['company_id']]);
            } else {
                $params = array_merge([$user['id']], $ids, [$oneMonthAgo]);
            }

            $db->query($query, $params);
            $archived = $db->rowCount();

        } elseif ($dateBefore) {
            // Archive all logs before a specific date (but not within last month)
            $targetDate = date('Y-m-d H:i:s', strtotime($dateBefore));

            // Ensure target date is before the 1-month protection
            if ($targetDate >= $oneMonthAgo) {
                Response::error('Son 1 ayin verileri arsivlenemez', 400);
            }

            $query = "UPDATE audit_logs
                      SET archived_at = CURRENT_TIMESTAMP,
                          archived_by = ?
                      WHERE created_at < ?
                      AND archived_at IS NULL";
            $params = [$user['id'], $targetDate];

            // Company filter for non-super admins
            if ($user['role'] !== 'SuperAdmin') {
                $query .= " AND company_id = ?";
                $params[] = $user['company_id'];
            }

            $db->query($query, $params);
            $archived = $db->rowCount();

        } else {
            // Archive all logs older than 1 month
            $query = "UPDATE audit_logs
                      SET archived_at = CURRENT_TIMESTAMP,
                          archived_by = ?
                      WHERE created_at < ?
                      AND archived_at IS NULL";
            $params = [$user['id'], $oneMonthAgo];

            // Company filter for non-super admins
            if ($user['role'] !== 'SuperAdmin') {
                $query .= " AND company_id = ?";
                $params[] = $user['company_id'];
            }

            $db->query($query, $params);
            $archived = $db->rowCount();
        }

        // Log the archive action
        Logger::audit('archive', 'audit_logs', [
            'archived_count' => $archived,
            'protected_count' => $protected,
            'date_before' => $dateBefore ?? $oneMonthAgo
        ]);

        Response::json([
            'success' => true,
            'message' => "{$archived} kayit arsivelendi",
            'data' => [
                'archived' => $archived,
                'protected' => $protected,
                'protection_date' => $oneMonthAgo
            ]
        ]);

    } catch (Exception $e) {
        Logger::error('Audit log archive error', ['error' => $e->getMessage()]);
        Response::serverError('Arsivleme islemi basarisiz');
    }

} elseif ($method === 'GET') {
    // Get archive statistics
    try {
        $oneMonthAgo = date('Y-m-d H:i:s', strtotime('-1 month'));

        $companyFilter = '';
        $params = [];

        if ($user['role'] !== 'SuperAdmin') {
            $companyFilter = 'WHERE company_id = ?';
            $params = [$user['company_id']];
        }

        // Get total counts
        $statsQuery = "SELECT
                          COUNT(*) as total,
                          SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) as archived,
                          SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) as active,
                          SUM(CASE WHEN created_at >= ? AND archived_at IS NULL THEN 1 ELSE 0 END) as protected,
                          SUM(CASE WHEN created_at < ? AND archived_at IS NULL THEN 1 ELSE 0 END) as archivable
                       FROM audit_logs
                       $companyFilter";

        $statsParams = array_merge([$oneMonthAgo, $oneMonthAgo], $params);
        $stats = $db->fetch($statsQuery, $statsParams);

        Response::json([
            'success' => true,
            'data' => [
                'total' => (int)($stats['total'] ?? 0),
                'archived' => (int)($stats['archived'] ?? 0),
                'active' => (int)($stats['active'] ?? 0),
                'protected' => (int)($stats['protected'] ?? 0),
                'archivable' => (int)($stats['archivable'] ?? 0),
                'protection_date' => $oneMonthAgo
            ]
        ]);

    } catch (Exception $e) {
        Logger::error('Audit log stats error', ['error' => $e->getMessage()]);
        Response::serverError('Istatistikler yuklenemedi');
    }

} else {
    Response::error('Method not allowed', 405);
}

