<?php
/**
 * Delete Template API
 *
 * SECURITY:
 * - SuperAdmin can delete any template including system templates
 * - Regular users can only delete their own company templates
 * - System templates are protected from non-SuperAdmin deletion
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$userRole = $user['role'] ?? 'Viewer';
$isSuperAdmin = strtolower($userRole) === 'superadmin';
$id = $request->routeParam('id');

// Get the template first
$template = $db->fetch("SELECT * FROM templates WHERE id = ?", [$id]);

if (!$template) {
    Response::notFound('Şablon bulunamadı');
}

// Check access permissions
$isSystemTemplate = $template['scope'] === 'system' || $template['company_id'] === null;
$isOwnTemplate = $template['company_id'] === $companyId;

if ($isSystemTemplate) {
    // System templates can only be deleted by SuperAdmin
    if (!$isSuperAdmin) {
        Response::error('Sistem şablonlarını silme yetkiniz yok', 403);
    }
} else {
    // Company templates can only be deleted by their own company
    if (!$isOwnTemplate && !$isSuperAdmin) {
        Response::error('Bu şablonu silme yetkiniz yok', 403);
    }
}

try {
    $db->beginTransaction();

    // İlişkili kayıtları temizle (foreign key constraint hatalarını önle)
    try {
        // render_queue tablosundaki referansları temizle
        $db->query("UPDATE render_queue SET template_id = NULL WHERE template_id = ?", [$id]);

        // devices tablosundaki referansları temizle
        $db->query("UPDATE devices SET current_template_id = NULL WHERE current_template_id = ?", [$id]);

        // products tablosundaki referansları temizle
        $db->query("UPDATE products SET assigned_template_id = NULL WHERE assigned_template_id = ?", [$id]);

        // hanshow_esls tablosundaki referansları temizle
        $db->query("UPDATE hanshow_esls SET current_template_id = NULL WHERE current_template_id = ?", [$id]);

        // hanshow_queue tablosundaki referansları temizle
        $db->query("UPDATE hanshow_queue SET template_id = NULL WHERE template_id = ?", [$id]);

        // product_renders tablosundaki referansları temizle
        $db->query("UPDATE product_renders SET template_id = NULL WHERE template_id = ?", [$id]);

        // Alt şablonların parent_id'sini temizle
        $db->query("UPDATE templates SET parent_id = NULL WHERE parent_id = ?", [$id]);
    } catch (Throwable $cleanupError) {
        // Hata olsa bile devam et (tablolar mevcut olmayabilir)
        error_log('[templates/delete] İlişkili kayıtlar temizlenirken hata: ' . $cleanupError->getMessage());
    }

    $db->delete('templates', 'id = ?', [$id]);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Template delete error', [
        'template_id' => $id,
        'company_id' => $companyId,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

try {
    Logger::audit('delete', 'templates', ['template_id' => $id]);
} catch (Throwable $auditError) {
    error_log('Template delete audit skipped: ' . $auditError->getMessage());
}

Response::success(null, 'Şablon silindi');
