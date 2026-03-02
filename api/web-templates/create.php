<?php
/**
 * Web Templates - Create
 * POST /api/web-templates
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
$data = $request->getBody();

// Validasyon
$name = trim($data['name'] ?? '');
if (empty($name)) {
    Response::error('Şablon adı gerekli', 400);
}

// Slug oluştur
$slug = $data['slug'] ?? null;
if (!$slug) {
    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
    $slug = trim($slug, '-');
}

// Slug benzersizlik kontrolü
$existingSlug = $db->fetch(
    "SELECT id FROM web_templates WHERE slug = ? AND company_id = ? AND deleted_at IS NULL",
    [$slug, $companyId]
);

if ($existingSlug) {
    $slug .= '-' . substr(uniqid(), -6);
}

// Yeni ID oluştur
$templateId = $db->generateUuid();

// Şablon oluştur
$db->insert('web_templates', [
    'id' => $templateId,
    'company_id' => $companyId,
    'name' => $name,
    'slug' => $slug,
    'description' => $data['description'] ?? null,
    'html_content' => $data['html_content'] ?? null,
    'css_content' => $data['css_content'] ?? null,
    'js_content' => $data['js_content'] ?? null,
    'template_type' => $data['template_type'] ?? 'signage',
    'category' => $data['category'] ?? null,
    'tags' => !empty($data['tags']) ? json_encode($data['tags']) : null,
    'thumbnail' => $data['thumbnail'] ?? null,
    'width' => $data['width'] ?? null,
    'height' => $data['height'] ?? null,
    'orientation' => $data['orientation'] ?? 'landscape',
    'responsive_breakpoints' => !empty($data['responsive_breakpoints']) ? json_encode($data['responsive_breakpoints']) : null,
    'data_sources' => !empty($data['data_sources']) ? json_encode($data['data_sources']) : null,
    'dynamic_fields' => !empty($data['dynamic_fields']) ? json_encode($data['dynamic_fields']) : null,
    'status' => $data['status'] ?? 'draft',
    'version' => 1,
    'scope' => 'company',
    'created_by' => $user['id'],
    'updated_by' => $user['id']
]);

// İlk versiyonu kaydet
if (!empty($data['html_content'])) {
    $db->insert('web_template_versions', [
        'id' => $db->generateUuid(),
        'template_id' => $templateId,
        'version_number' => 1,
        'version_name' => 'İlk versiyon',
        'change_notes' => 'Şablon oluşturuldu',
        'html_content' => $data['html_content'],
        'css_content' => $data['css_content'] ?? null,
        'js_content' => $data['js_content'] ?? null,
        'created_by' => $user['id']
    ]);
}

// Audit log
if (class_exists('Logger')) {
    Logger::audit('web_template_created', [
        'template_id' => $templateId,
        'name' => $name,
        'user_id' => $user['id']
    ]);
}

// Oluşturulan şablonu getir
$template = $db->fetch("SELECT * FROM web_templates WHERE id = ?", [$templateId]);

Response::success($template, 'Şablon oluşturuldu', 201);
