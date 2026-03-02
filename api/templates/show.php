<?php
/**
 * Template Detail API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

// Sistem şablonları (scope='system' veya company_id IS NULL) herkes tarafından görülebilir
// Firma şablonları sadece kendi firması tarafından görülebilir
$template = $db->fetch(
    "SELECT * FROM templates
     WHERE id = ?
     AND (company_id = ? OR company_id IS NULL OR scope = 'system')",
    [$id, $companyId]
);

if (!$template) {
    Response::notFound('Şablon bulunamadı');
}

// Map database fields to frontend expected fields
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

Response::success($template);
