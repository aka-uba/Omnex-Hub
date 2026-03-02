<?php
/**
 * ERP Import File History API
 *
 * GET /api/import/history - List import file history for current company
 *
 * @package OmnexDisplayHub
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;
$status = $_GET['status'] ?? null;
$source = $_GET['source'] ?? null;

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
        ]
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
