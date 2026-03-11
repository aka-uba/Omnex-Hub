<?php
/**
 * ERP Import File History API
 *
 * GET /api/import/history - List import file history for current company
 * DELETE /api/import/history?mode=all|older - Manual cleanup
 *
 * @package OmnexDisplayHub
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;
$status = $_GET['status'] ?? null;
$source = $_GET['source'] ?? null;
$cleanupMode = $_GET['mode'] ?? 'all';
$retentionDays = 30;
$retentionCutoff = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));

// Auto-clean old history entries (keep latest 30 days)
try {
    $db->query(
        "DELETE FROM erp_import_files
         WHERE company_id = ?
           AND status IN ('completed', 'failed', 'skipped')
           AND created_at < ?",
        [$companyId, $retentionCutoff]
    );
} catch (Exception $e) {
    // Keep endpoint resilient if cleanup fails.
}

if ($method === 'DELETE') {
    if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'Manager'], true)) {
        Response::forbidden('Import geçmişini temizleme yetkiniz yok');
    }

    try {
        if ($cleanupMode === 'older') {
            $stmt = $db->query(
                "DELETE FROM erp_import_files
                 WHERE company_id = ?
                   AND status IN ('completed', 'failed', 'skipped')
                   AND created_at < ?",
                [$companyId, $retentionCutoff]
            );
        } else {
            $stmt = $db->query(
                "DELETE FROM erp_import_files
                 WHERE company_id = ?
                   AND status IN ('completed', 'failed', 'skipped')",
                [$companyId]
            );
        }

        $deleted = $stmt->rowCount();

        Response::success([
            'deleted' => $deleted,
            'mode' => $cleanupMode,
            'retention_days' => $retentionDays
        ], 'Import geçmişi temizlendi');
    } catch (Exception $e) {
        Response::error('Import geçmişi temizlenemedi', 500);
    }
}

if ($method !== 'GET') {
    Response::methodNotAllowed('İzin verilmeyen method');
}

// Build query
$where = ['company_id = ?'];
$params = [$companyId];

if ($status && in_array($status, ['pending', 'processing', 'completed', 'failed', 'skipped'])) {
    $where[] = 'status = ?';
    $params[] = $status;
}

if ($source && in_array($source, ['api_push', 'directory_scan', 'manual'])) {
    $where[] = 'source = ?';
    $params[] = $source;
}

$whereClause = implode(' AND ', $where);

try {
    // Get total count
    $total = $db->fetch(
        "SELECT COUNT(*) as count FROM erp_import_files WHERE $whereClause",
        $params
    );
    $totalCount = (int) ($total['count'] ?? 0);

    // Get paginated results
    $files = $db->fetchAll(
        "SELECT id, filename, original_filename, file_size, file_format, source, status,
                total_rows, inserted, updated, failed, skipped, error_message,
                processed_at, created_at
         FROM erp_import_files
         WHERE $whereClause
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?",
        array_merge($params, [$perPage, $offset])
    );

    Response::success([
        'files' => $files,
        'pagination' => [
            'total' => $totalCount,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => ceil($totalCount / $perPage)
        ],
        'retention_days' => $retentionDays
    ]);
} catch (Exception $e) {
    Logger::error('Failed to fetch import history', ['error' => $e->getMessage()]);
    Response::success([
        'files' => [],
        'pagination' => [
            'total' => 0,
            'page' => 1,
            'per_page' => $perPage,
            'total_pages' => 0
        ]
    ]);
}
