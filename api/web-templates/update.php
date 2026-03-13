<?php
/**
 * Web Templates - Update
 * PUT /api/web-templates/:id
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
$data = $request->getBody();
$isSuperAdmin = $role === 'superadmin';

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
    Response::forbidden('Sistem şablonlarını düzenleme yetkiniz yok');
}

if ($template['company_id'] !== $companyId && !$isSuperAdmin) {
    Response::forbidden('Bu şablonu düzenleme yetkiniz yok');
}

// Güncellenebilir alanlar
$updateData = [
    'updated_by' => $user['id'],
    'updated_at' => date('Y-m-d H:i:s')
];

// İsim güncellemesi
if (isset($data['name'])) {
    $name = trim($data['name']);
    if (empty($name)) {
        Response::error('Şablon adı boş olamaz', 400);
    }
    $updateData['name'] = $name;
}

// Diğer alanlar
$allowedFields = [
    'description', 'html_content', 'css_content', 'js_content',
    'template_type', 'category', 'thumbnail',
    'width', 'height', 'orientation', 'status'
];

foreach ($allowedFields as $field) {
    if (array_key_exists($field, $data)) {
        $updateData[$field] = $data[$field];
    }
}

// JSON alanları
if (isset($data['tags'])) {
    $updateData['tags'] = is_array($data['tags']) ? json_encode($data['tags']) : $data['tags'];
}

if (isset($data['responsive_breakpoints'])) {
    $updateData['responsive_breakpoints'] = is_array($data['responsive_breakpoints'])
        ? json_encode($data['responsive_breakpoints'])
        : $data['responsive_breakpoints'];
}

if (isset($data['data_sources'])) {
    $updateData['data_sources'] = is_array($data['data_sources'])
        ? json_encode($data['data_sources'])
        : $data['data_sources'];
}

if (isset($data['dynamic_fields'])) {
    $updateData['dynamic_fields'] = is_array($data['dynamic_fields'])
        ? json_encode($data['dynamic_fields'])
        : $data['dynamic_fields'];
}

// Yayınlanma durumu
if (isset($data['status']) && $data['status'] === 'published' && $template['status'] !== 'published') {
    $updateData['published_at'] = date('Y-m-d H:i:s');
}

// HTML içeriği değiştiyse versiyon numarasını artır
$contentChanged = false;
if (isset($data['html_content']) && $data['html_content'] !== $template['html_content']) {
    $contentChanged = true;
    $updateData['version'] = ($template['version'] ?? 0) + 1;
}

// Güncelle
try {
    $db->beginTransaction();
    $db->update('web_templates', $updateData, 'id = ?', [$templateId]);

// İçerik değiştiyse yeni versiyon kaydet
if ($contentChanged) {
    $db->insert('web_template_versions', [
        'id' => $db->generateUuid(),
        'template_id' => $templateId,
        'version_number' => $updateData['version'],
        'version_name' => $data['version_name'] ?? 'Versiyon ' . $updateData['version'],
        'change_notes' => $data['change_notes'] ?? 'Şablon güncellendi',
        'html_content' => $data['html_content'],
        'css_content' => $data['css_content'] ?? $template['css_content'],
        'js_content' => $data['js_content'] ?? $template['js_content'],
        'created_by' => $user['id']
    ]);
}
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('Web template update error', [
        'template_id' => $templateId,
        'error' => $e->getMessage()
    ]);
    Response::serverError();
}

// Audit log
if (class_exists('Logger')) {
    try {
        Logger::audit('web_template_updated', [
            'template_id' => $templateId,
            'changes' => array_keys($updateData),
            'user_id' => $user['id']
        ]);
    } catch (Throwable $auditError) {
        error_log('Web template update audit skipped: ' . $auditError->getMessage());
    }
}

// Güncellenmiş şablonu getir
$updatedTemplate = $db->fetch("SELECT * FROM web_templates WHERE id = ?", [$templateId]);

Response::success($updatedTemplate, 'Şablon güncellendi');
