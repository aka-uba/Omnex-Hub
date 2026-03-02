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

$db->delete('companies', 'id = ?', [$id]);

// Audit log
Logger::audit('delete', 'company', [
    'id' => $id,
    'old' => [
        'name' => $company['name'],
        'code' => $company['code']
    ]
]);

Response::success(null, 'Şirket silindi');
