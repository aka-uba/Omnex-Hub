<?php
/**
 * Web Templates - Delete
 * DELETE /api/web-templates/:id
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$role = strtolower((string)($user['role'] ?? ''));
$allowedRoles = ['superadmin', 'admin', 'manager', 'editor'];
if (!in_array($role, $allowedRoles, true)) {
    Response::forbidden('Bu islem icin yetkiniz yok');
}

$companyId = Auth::getActiveCompanyId();
$templateId = $request->getRouteParam('id');
$isSuperAdmin = $role === 'superadmin';
$activeAssignmentExpr = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';

if (!$templateId) {
    Response::error('Şablon ID gerekli', 400);
}

// Mevcut şablonu getir
$template = $db->fetch(
    "SELECT * FROM web_templates WHERE id = ? AND deleted_at IS NULL",
    [$templateId]
);

if (!$template) {
    Response::notFound('Şablon bulunamadı');
}

// Yetki kontrolü
if ($template['scope'] === 'system' && !$isSuperAdmin) {
    Response::forbidden('Sistem şablonlarını silme yetkiniz yok');
}

if ($template['company_id'] !== $companyId && !$isSuperAdmin) {
    Response::forbidden('Bu şablonu silme yetkiniz yok');
}

// Aktif cihaz atamaları var mı kontrol et
$activeAssignments = $db->fetch(
    "SELECT COUNT(*) as count FROM web_template_assignments WHERE template_id = ? AND $activeAssignmentExpr",
    [$templateId]
);

if ($activeAssignments['count'] > 0) {
    Response::error('Bu şablon aktif cihazlara atanmış. Önce atamaları kaldırın.', 400);
}

// Soft delete
$db->update('web_templates', [
    'deleted_at' => date('Y-m-d H:i:s'),
    'updated_by' => $user['id']
], 'id = ?', [$templateId]);

// Audit log
if (class_exists('Logger')) {
    Logger::audit('web_template_deleted', [
        'template_id' => $templateId,
        'name' => $template['name'],
        'user_id' => $user['id']
    ]);
}

Response::success(null, 'Şablon silindi');
