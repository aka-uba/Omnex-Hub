<?php
/**
 * Template Fork API
 *
 * Creates a company-specific copy of a system template.
 * POST /api/templates/:id/fork
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!$companyId) {
    Response::error('Firma bağlamı gerekli', 400);
}

// Get template ID from route
$templateId = $request->getRouteParam('id');

if (!$templateId) {
    Response::error('Şablon ID gerekli', 400);
}

// Get the source template
$sourceTemplate = $db->fetch("SELECT * FROM templates WHERE id = ?", [$templateId]);

if (!$sourceTemplate) {
    Response::error('Şablon bulunamadı', 404);
}

// Check if template is a system template or accessible to this company
$isSystemTemplate = $sourceTemplate['scope'] === 'system' || $sourceTemplate['company_id'] === null;
$isOwnTemplate = $sourceTemplate['company_id'] === $companyId;

if (!$isSystemTemplate && !$isOwnTemplate) {
    Response::error('Bu şablona erişim izniniz yok', 403);
}

// Check if already forked from this template by this company
$existingFork = $db->fetch(
    "SELECT id, name FROM templates WHERE parent_id = ? AND company_id = ?",
    [$templateId, $companyId]
);

if ($existingFork) {
    Response::error('Bu şablon zaten kopyalanmış: ' . $existingFork['name'], 400, [
        'existing_fork_id' => $existingFork['id']
    ]);
}

// Get custom name from request or generate one
$data = $request->body();
$newName = $data['name'] ?? $sourceTemplate['name'] . ' (Kopya)';

// Create the forked template
$newId = $db->generateUuid();

$forkData = [
    'id' => $newId,
    'company_id' => $companyId,
    'name' => $newName,
    'description' => $sourceTemplate['description'],
    'type' => $sourceTemplate['type'],
    'category' => $sourceTemplate['category'],
    'width' => $sourceTemplate['width'],
    'height' => $sourceTemplate['height'],
    'orientation' => $sourceTemplate['orientation'],
    'design_data' => $sourceTemplate['design_data'],
    'preview_image' => $sourceTemplate['preview_image'],
    'version' => 1,
    'parent_id' => $templateId,
    'is_default' => 0,
    'is_public' => 0,
    'status' => 'active',
    'scope' => 'company',
    'is_forked' => 1,
    'created_by' => $user['id']
];

// Copy additional fields if they exist
$additionalFields = ['layout_type', 'template_file', 'slots', 'device_types', 'target_device_type', 'grid_layout', 'regions_config'];
foreach ($additionalFields as $field) {
    if (isset($sourceTemplate[$field])) {
        $forkData[$field] = $sourceTemplate[$field];
    }
}

try {
    $db->insert('templates', $forkData);

    // Get the created template
    $forkedTemplate = $db->fetch("SELECT * FROM templates WHERE id = ?", [$newId]);

    // Map database fields to frontend expected fields
    $typeMapReverse = ['label' => 'esl', 'signage' => 'signage', 'tv' => 'tv'];
    $forkedTemplate['type'] = $typeMapReverse[$forkedTemplate['type']] ?? $forkedTemplate['type'];
    $forkedTemplate['content'] = $forkedTemplate['design_data'];
    $forkedTemplate['thumbnail'] = $forkedTemplate['preview_image'];

    // Log the action
    Logger::audit('fork', 'template', [
        'source_id' => $templateId,
        'fork_id' => $newId
    ]);

    Response::created($forkedTemplate, 'Şablon başarıyla kopyalandı');

} catch (Exception $e) {
    Response::error('Şablon kopyalama başarısız: ' . $e->getMessage(), 500);
}
