<?php
/**
 * Template Import API
 * JSON formatında şablon import işlemi
 *
 * POST /api/templates/import
 *
 * @version 1.0.0
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

// Content-Type kontrolü
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

$importData = null;

// Dosya yükleme
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $file = $_FILES['file'];

    // Dosya tipi kontrolü
    $allowedTypes = ['application/json', 'text/json', 'text/plain'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    // JSON uzantı kontrolü
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($extension !== 'json') {
        Response::badRequest('Sadece .json dosyaları kabul edilir');
    }

    // Dosya boyutu kontrolü (max 10MB)
    if ($file['size'] > 10 * 1024 * 1024) {
        Response::badRequest('Dosya boyutu 10MB\'ı aşamaz');
    }

    // JSON içeriğini oku
    $jsonContent = file_get_contents($file['tmp_name']);
    $importData = json_decode($jsonContent, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        Response::badRequest('Geçersiz JSON formatı: ' . json_last_error_msg());
    }

} elseif (strpos($contentType, 'application/json') !== false) {
    // JSON body olarak gönderildi
    $rawInput = file_get_contents('php://input');
    $importData = json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        Response::badRequest('Geçersiz JSON formatı: ' . json_last_error_msg());
    }
} else {
    Response::badRequest('Dosya veya JSON verisi gönderilmedi');
}

// Import verisi kontrolü
if (!$importData) {
    Response::badRequest('Import verisi boş');
}

// Export formatı kontrolü
if (!isset($importData['templates']) || !is_array($importData['templates'])) {
    // Tek şablon formatı olabilir
    if (isset($importData['name']) && isset($importData['design_data'])) {
        $importData = [
            'templates' => [$importData]
        ];
    } else {
        Response::badRequest('Geçersiz import formatı. templates dizisi bulunamadı.');
    }
}

// Type mapping
$typeMap = ['esl' => 'label', 'signage' => 'signage', 'tv' => 'tv'];

// Import seçenekleri
$skipExisting = $request->query('skip_existing', 'false') === 'true';
$overwrite = $request->query('overwrite', 'false') === 'true';
$addSuffix = $request->query('add_suffix', 'true') === 'true';

$results = [
    'total' => count($importData['templates']),
    'imported' => 0,
    'skipped' => 0,
    'failed' => 0,
    'details' => []
];

foreach ($importData['templates'] as $index => $templateData) {
    $templateName = $templateData['name'] ?? 'İsimsiz Şablon ' . ($index + 1);

    try {
        // Zorunlu alan kontrolü
        if (empty($templateData['design_data'])) {
            $results['failed']++;
            $results['details'][] = [
                'name' => $templateName,
                'status' => 'failed',
                'message' => 'design_data alanı zorunludur'
            ];
            continue;
        }

        // Aynı isimde şablon var mı kontrol et
        $existingTemplate = $db->fetch(
            "SELECT id, name FROM templates WHERE name = ? AND company_id = ?",
            [$templateName, $companyId]
        );

        if ($existingTemplate) {
            if ($skipExisting) {
                $results['skipped']++;
                $results['details'][] = [
                    'name' => $templateName,
                    'status' => 'skipped',
                    'message' => 'Aynı isimde şablon mevcut'
                ];
                continue;
            }

            if ($overwrite) {
                // Mevcut şablonu güncelle
                $updateData = [
                    'description' => $templateData['description'] ?? '',
                    'type' => $typeMap[$templateData['type'] ?? 'esl'] ?? 'label',
                    'orientation' => $templateData['orientation'] ?? 'portrait',
                    'width' => (int)($templateData['width'] ?? 800),
                    'height' => (int)($templateData['height'] ?? 1280),
                    'design_data' => $templateData['design_data'],
                    'preview_image' => $templateData['preview_image'] ?? null,
                    'render_image' => $templateData['render_image'] ?? null,
                    'target_device_type' => $templateData['target_device_type'] ?? null,
                    'device_types' => $templateData['device_types'] ?? null,
                    'grid_layout' => $templateData['grid_layout'] ?? null,
                    'regions_config' => $templateData['regions_config'] ?? null,
                    'layout_type' => $templateData['layout_type'] ?? 'full',
                    'template_file' => $templateData['template_file'] ?? null,
                    'slots' => $templateData['slots'] ?? null,
                    'status' => $templateData['status'] ?? 'active',
                    'updated_at' => date('Y-m-d H:i:s'),
                    'updated_by' => $user['id']
                ];

                $db->update('templates', $updateData, 'id = ?', [$existingTemplate['id']]);

                $results['imported']++;
                $results['details'][] = [
                    'name' => $templateName,
                    'status' => 'updated',
                    'id' => $existingTemplate['id'],
                    'message' => 'Mevcut şablon güncellendi'
                ];
                continue;
            }

            if ($addSuffix) {
                // İsme suffix ekle
                $counter = 1;
                $newName = $templateName . ' (İçe Aktarıldı)';
                while ($db->fetch("SELECT id FROM templates WHERE name = ? AND company_id = ?", [$newName, $companyId])) {
                    $counter++;
                    $newName = $templateName . ' (İçe Aktarıldı ' . $counter . ')';
                }
                $templateName = $newName;
            }
        }

        // Yeni şablon oluştur
        $newId = $db->generateUuid();
        $now = date('Y-m-d H:i:s');

        $insertData = [
            'id' => $newId,
            'company_id' => $companyId,
            'name' => $templateName,
            'description' => $templateData['description'] ?? '',
            'type' => $typeMap[$templateData['type'] ?? 'esl'] ?? 'label',
            'orientation' => $templateData['orientation'] ?? 'portrait',
            'width' => (int)($templateData['width'] ?? 800),
            'height' => (int)($templateData['height'] ?? 1280),
            'design_data' => $templateData['design_data'],
            'preview_image' => $templateData['preview_image'] ?? null,
            'render_image' => $templateData['render_image'] ?? null,
            'target_device_type' => $templateData['target_device_type'] ?? null,
            'device_types' => $templateData['device_types'] ?? null,
            'grid_layout' => $templateData['grid_layout'] ?? null,
            'regions_config' => $templateData['regions_config'] ?? null,
            'layout_type' => $templateData['layout_type'] ?? 'full',
            'template_file' => $templateData['template_file'] ?? null,
            'slots' => $templateData['slots'] ?? null,
            'status' => $templateData['status'] ?? 'active',
            'created_at' => $now,
            'updated_at' => $now,
            'created_by' => $user['id'],
            'updated_by' => $user['id']
        ];

        $db->insert('templates', $insertData);

        $results['imported']++;
        $results['details'][] = [
            'name' => $templateName,
            'status' => 'created',
            'id' => $newId,
            'message' => 'Şablon başarıyla oluşturuldu'
        ];

    } catch (Exception $e) {
        $results['failed']++;
        $results['details'][] = [
            'name' => $templateName,
            'status' => 'failed',
            'message' => 'Hata: ' . $e->getMessage()
        ];
    }
}

// Audit log
if ($results['imported'] > 0) {
    try {
        $db->insert('audit_logs', [
            'id' => $db->generateUuid(),
            'user_id' => $user['id'],
            'company_id' => $companyId,
            'action' => 'template_import',
            'entity_type' => 'template',
            'entity_id' => null,
            'description' => $results['imported'] . ' şablon içe aktarıldı',
            'metadata' => json_encode($results),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (Exception $e) {
        // Audit log hatası ana işlemi etkilemesin
    }
}

Response::success([
    'results' => $results,
    'message' => sprintf(
        '%d şablon içe aktarıldı, %d atlandı, %d başarısız',
        $results['imported'],
        $results['skipped'],
        $results['failed']
    )
]);
