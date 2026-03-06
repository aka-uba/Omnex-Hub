<?php
/**
 * Create Template API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$isSuperAdmin = strtolower($user['role'] ?? '') === 'superadmin';

// Map frontend type to database type
$typeMap = ['esl' => 'label', 'signage' => 'signage', 'tv' => 'tv', 'label_printer' => 'label'];

$validator = Validator::make($request->all(), [
    'name' => 'required|max:255',
    'type' => 'required',
    'width' => 'required|numeric|min:1',
    'height' => 'required|numeric|min:1'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

$frontendType = $request->input('type', 'esl');
$dbType = $typeMap[$frontendType] ?? $frontendType;

// Shared (system) template handling - only SuperAdmin
$isShared = $isSuperAdmin && (bool)$request->input('is_shared', false);
$templateCompanyId = $isShared ? null : $companyId;
$templateScope = $isShared ? 'system' : 'company';

// label_printer türü için category'yi otomatik ayarla
$category = $request->input('category');
if ($frontendType === 'label_printer') {
    $category = 'label_printer';
}

// Ortak şablon (tüm boyutlar için) - sadece label_printer
$isDefault = 0;
if ($frontendType === 'label_printer') {
    $isDefault = $request->input('is_default') ? 1 : 0;
}

// Get design_data from content or design_data field
$designData = $request->input('design_data') ?: $request->input('content', '{}');

// Process slots - convert to JSON if array
$slots = $request->input('slots');
if (is_array($slots)) {
    $slots = json_encode($slots);
}

// Render image'ı dosyaya kaydet (firma bazlı izolasyon)
$renderImagePath = null;
$renderImageData = $request->input('render_image');
if ($renderImageData && strpos($renderImageData, 'data:image') === 0) {
    // Firma bazlı render dizini oluştur
    $renderOwnerId = $companyId ?: 'system';
    $renderDir = STORAGE_PATH . '/companies/' . $renderOwnerId . '/templates/renders';
    if (!is_dir($renderDir)) {
        mkdir($renderDir, 0755, true);
    }

    // Base64'ten görsel çıkar
    $parts = explode(',', $renderImageData);
    if (count($parts) === 2) {
        $imageData = base64_decode($parts[1]);
        $fileName = uniqid() . '_' . time() . '.png';
        $filePath = $renderDir . '/' . $fileName;

        if (file_put_contents($filePath, $imageData)) {
            $renderImagePath = 'companies/' . $renderOwnerId . '/templates/renders/' . $fileName;
        }
    }
}

// Grid layout ve regions config
$gridLayout = $request->input('grid_layout', 'single');
$regionsConfig = $request->input('regions_config');
if (is_array($regionsConfig)) {
    $regionsConfig = json_encode($regionsConfig);
}

$id = $db->insert('templates', [
    'company_id' => $templateCompanyId,
    'name' => $request->input('name'),
    'description' => $request->input('description', ''),
    'type' => $dbType,
    'category' => $category,
    'width' => $request->input('width'),
    'height' => $request->input('height'),
    'orientation' => $request->input('orientation', 'landscape'),
    'design_data' => $designData,
    'preview_image' => $request->input('preview_image') ?: $request->input('thumbnail'),
    'render_image' => $renderImagePath,  // Tam boyutlu render dosya yolu
    'is_default' => $isDefault,
    'status' => $request->input('status', 'draft'),
    'created_by' => $user['id'],
    'scope' => $templateScope,
    'is_public' => $isShared ? 1 : 0,
    // New fields from migration 021
    'layout_type' => $request->input('layout_type', 'full'),
    'template_file' => $request->input('template_file'),
    'slots' => $slots,
    // New fields from migration 025 - Grid layout
    'grid_layout' => $gridLayout,
    'regions_config' => $regionsConfig,
    'target_device_type' => $request->input('target_device_type'),
    'grid_visible' => $request->input('grid_visible', true) ? 1 : 0,
    // New fields from migration 068 - Responsive template
    'responsive_mode' => $request->input('responsive_mode', 'off'),
    'scale_policy' => $request->input('scale_policy', 'contain'),
    'design_width' => $request->input('design_width') ?: $request->input('width'),
    'design_height' => $request->input('design_height') ?: $request->input('height')
]);

// Tek ortak şablon kuralı: label_printer için diğerlerini kapat
if ($frontendType === 'label_printer' && $isDefault && $templateCompanyId) {
    $db->query(
        "UPDATE templates SET is_default = 0
         WHERE company_id = ? AND category = 'label_printer' AND id != ?",
        [$templateCompanyId, $id]
    );
}

$template = $db->fetch("SELECT * FROM templates WHERE id = ?", [$id]);

// Map back for frontend compatibility
// label_printer uses category field to distinguish from regular esl/label
// Check if this is a label_printer type based on category BEFORE reverse mapping
if ($template['type'] === 'label' && $template['category'] === 'label_printer') {
    $template['type'] = 'label_printer';
} else {
    $typeMapReverse = ['label' => 'esl', 'signage' => 'signage', 'tv' => 'tv'];
    $template['type'] = $typeMapReverse[$template['type']] ?? $template['type'];
}
$template['content'] = $template['design_data'];
$template['thumbnail'] = $template['preview_image'];

// New fields from migration 021
$template['layout_type'] = $template['layout_type'] ?? 'full';
$template['template_file'] = $template['template_file'] ?? null;
$template['slots'] = $template['slots'] ? json_decode($template['slots'], true) : null;

Logger::audit('create', 'templates', ['template_id' => $id]);

Response::created($template, 'Şablon oluşturuldu');
