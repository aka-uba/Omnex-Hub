<?php
/**
 * Web Templates - Bulk Delete
 * POST /api/web-templates/bulk-delete
 * Body: { "ids": ["uuid1", "uuid2", ...] }
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
$isSuperAdmin = $role === 'superadmin';
$activeAssignmentExpr = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';

$body = $request->body();
$ids = $body['ids'] ?? [];

if (!is_array($ids) || empty($ids)) {
    Response::error('Silinecek sablon ID listesi gerekli', 400);
}

if (count($ids) > 100) {
    Response::error('Tek seferde en fazla 100 sablon silinebilir', 400);
}

$deleted = 0;
$skipped = 0;
$errors = [];
$now = date('Y-m-d H:i:s');

try {
    $db->beginTransaction();

    foreach ($ids as $templateId) {
        if (!is_string($templateId) || empty($templateId)) {
            $skipped++;
            continue;
        }

        // Fetch template
        $template = $db->fetch(
            "SELECT * FROM web_templates WHERE id = ? AND deleted_at IS NULL",
            [$templateId]
        );

        if (!$template) {
            $skipped++;
            continue;
        }

        // Permission check
        if ($template['scope'] === 'system' && !$isSuperAdmin) {
            $skipped++;
            $errors[] = ['id' => $templateId, 'name' => $template['name'], 'reason' => 'Sistem sablonu silme yetkiniz yok'];
            continue;
        }

        if ($template['company_id'] !== $companyId && !$isSuperAdmin) {
            $skipped++;
            $errors[] = ['id' => $templateId, 'name' => $template['name'], 'reason' => 'Bu sablonu silme yetkiniz yok'];
            continue;
        }

        // Check active device assignments
        $activeAssignments = $db->fetch(
            "SELECT COUNT(*) as count FROM web_template_assignments WHERE template_id = ? AND $activeAssignmentExpr",
            [$templateId]
        );

        if ($activeAssignments['count'] > 0) {
            $skipped++;
            $errors[] = ['id' => $templateId, 'name' => $template['name'], 'reason' => 'Aktif cihaz atamasi mevcut'];
            continue;
        }

        // Soft delete
        $db->update('web_templates', [
            'deleted_at' => $now,
            'updated_by' => $user['id']
        ], 'id = ?', [$templateId]);

        $deleted++;
    }

    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Web template bulk delete error', [
        'ids' => $ids,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

// Audit log
if ($deleted > 0 && class_exists('Logger')) {
    try {
        Logger::audit('web_templates_bulk_deleted', [
            'deleted_count' => $deleted,
            'skipped_count' => $skipped,
            'ids' => $ids,
            'user_id' => $user['id']
        ]);
    } catch (Throwable $auditError) {
        error_log('Web template bulk delete audit skipped: ' . $auditError->getMessage());
    }
}

Response::success([
    'deleted' => $deleted,
    'skipped' => $skipped,
    'errors' => $errors
], "$deleted sablon silindi, $skipped atland\xC4\xB1");
