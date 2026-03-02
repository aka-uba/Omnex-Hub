<?php
/**
 * Template Export API
 * Tek veya toplu şablon export işlemi
 *
 * GET  /api/templates/export?ids=id1,id2,id3  - Belirli şablonları export et
 * GET  /api/templates/export?id=xxx           - Tek şablon export et
 * GET  /api/templates/export?all=true         - Tüm şablonları export et
 *
 * @version 1.0.0
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

// Export parametrelerini al
$singleId = $request->query('id', '');
$multipleIds = $request->query('ids', '');
$exportAll = $request->query('all', '') === 'true';
$format = $request->query('format', 'json'); // json veya file

$templates = [];

if ($singleId) {
    // Tek şablon export
    $template = $db->fetch(
        "SELECT * FROM templates WHERE id = ? AND company_id = ?",
        [$singleId, $companyId]
    );

    if (!$template) {
        Response::notFound('Şablon bulunamadı');
    }

    $templates[] = $template;

} elseif ($multipleIds) {
    // Çoklu şablon export
    $ids = array_filter(explode(',', $multipleIds));

    if (empty($ids)) {
        Response::badRequest('Geçersiz şablon ID listesi');
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $params = array_merge($ids, [$companyId]);

    $templates = $db->fetchAll(
        "SELECT * FROM templates WHERE id IN ($placeholders) AND company_id = ?",
        $params
    );

    if (empty($templates)) {
        Response::notFound('Şablonlar bulunamadı');
    }

} elseif ($exportAll) {
    // Tüm şablonları export
    $templates = $db->fetchAll(
        "SELECT * FROM templates WHERE company_id = ? ORDER BY created_at DESC",
        [$companyId]
    );

    if (empty($templates)) {
        Response::notFound('Export edilecek şablon bulunamadı');
    }

} else {
    Response::badRequest('Export parametresi belirtilmedi. id, ids veya all parametresi kullanın.');
}

// Export formatını hazırla
$exportData = [
    'version' => '2.0.0',
    'export_date' => date('Y-m-d H:i:s'),
    'export_by' => $user['first_name'] . ' ' . $user['last_name'],
    'template_count' => count($templates),
    'templates' => []
];

// Type mapping
$typeMapReverse = ['label' => 'esl', 'signage' => 'signage', 'tv' => 'tv'];

foreach ($templates as $template) {
    // Export edilecek alanları seç (hassas bilgileri hariç tut)
    $exportTemplate = [
        'name' => $template['name'],
        'description' => $template['description'] ?? '',
        'type' => $typeMapReverse[$template['type']] ?? $template['type'],
        'orientation' => $template['orientation'] ?? 'portrait',
        'width' => (int)($template['width'] ?? 800),
        'height' => (int)($template['height'] ?? 1280),
        'design_data' => $template['design_data'],
        'preview_image' => $template['preview_image'] ?? null,
        'render_image' => $template['render_image'] ?? null,
        'target_device_type' => $template['target_device_type'] ?? null,
        'device_types' => $template['device_types'] ?? null,
        'grid_layout' => $template['grid_layout'] ?? null,
        'regions_config' => $template['regions_config'] ?? null,
        'layout_type' => $template['layout_type'] ?? 'full',
        'template_file' => $template['template_file'] ?? null,
        'slots' => $template['slots'] ?? null,
        'status' => $template['status'] ?? 'active',
        'created_at' => $template['created_at'],
        'updated_at' => $template['updated_at']
    ];

    $exportData['templates'][] = $exportTemplate;
}

// Dosya olarak indir
if ($format === 'file') {
    $filename = count($templates) === 1
        ? 'template_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $templates[0]['name']) . '.json'
        : 'templates_export_' . date('Y-m-d_His') . '.json';

    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    echo json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// JSON response olarak döndür
Response::success([
    'export' => $exportData,
    'download_ready' => true,
    'message' => count($templates) . ' şablon export edildi'
]);
