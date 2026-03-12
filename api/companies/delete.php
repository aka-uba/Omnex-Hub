<?php
/**
 * Delete Company API (Admin Only)
 */

$db = Database::getInstance();
$id = $request->routeParam('id');

$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);
if (!$company) {
    Response::notFound('Şirket bulunamadı');
}

// Check if company has users
$userCount = $db->fetchColumn("SELECT COUNT(*) FROM users WHERE company_id = ?", [$id]);
if ($userCount > 0) {
    Response::badRequest('Şirkete bağlı kullanıcılar var. Önce kullanıcıları silin.');
}

$db->beginTransaction();
try {
    $db->delete('companies', 'id = ?', [$id]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    Logger::error('Company delete error', [
        'company_id' => $id,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

try {
    Logger::audit('delete', 'company', [
        'id' => $id,
        'old' => [
            'name' => $company['name'],
            'code' => $company['code']
        ]
    ]);
} catch (Throwable $e) {
    error_log('Company delete audit skipped: ' . $e->getMessage());
}

Response::success(null, 'Şirket silindi');
