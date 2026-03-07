<?php
/**
 * Update Template API
 *
 * SECURITY:
 * - SuperAdmin can edit any template including system templates
 * - Regular users can only edit their own company templates
 * - System templates are protected from non-SuperAdmin edits
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
    // System templates can only be edited by SuperAdmin
    if (!$isSuperAdmin) {
        Response::error('Sistem şablonlarını düzenleme yetkiniz yok. Kopyalayarak kendi versiyonunuzu oluşturabilirsiniz.', 403);
    }
} else {
    // Company templates can only be edited by their own company
    if (!$isOwnTemplate && !$isSuperAdmin) {
        Response::error('Bu şablonu düzenleme yetkiniz yok', 403);
    }
}

// Map frontend type to database type
$typeMap = ['esl' => 'label', 'signage' => 'signage', 'tv' => 'tv', 'label_printer' => 'label'];

$data = [];

// Map frontend fields to database fields
if ($request->has('name')) {
    $newName = trim($request->input('name'));
    // Duplicate name check (only if name is changing)
    if ($newName !== $template['name']) {
        $ownerCompanyId = $template['company_id'];
        $duplicateCheck = $ownerCompanyId
            ? $db->fetch("SELECT id FROM templates WHERE company_id = ? AND name = ? AND id != ?", [$ownerCompanyId, $newName, $id])
            : $db->fetch("SELECT id FROM templates WHERE company_id IS NULL AND name = ? AND id != ?", [$newName, $id]);
        if ($duplicateCheck) {
            Response::error('Bu isimde bir şablon zaten mevcut', 409);
        }
    }
    $data['name'] = $newName;
}
if ($request->has('description')) $data['description'] = $request->input('description');
if ($request->has('width')) $data['width'] = $request->input('width');
if ($request->has('height')) $data['height'] = $request->input('height');
if ($request->has('orientation')) $data['orientation'] = $request->input('orientation');
if ($request->has('category')) $data['category'] = $request->input('category');
if ($request->has('status')) $data['status'] = $request->input('status');

// Map type (frontend -> database)
if ($request->has('type')) {
    $frontendType = $request->input('type');
    $data['type'] = $typeMap[$frontendType] ?? $frontendType;

    // label_printer türü için category'yi otomatik ayarla
    if ($frontendType === 'label_printer') {
        $data['category'] = 'label_printer';
    }
}
// label_printer için ortak şablon (tüm boyutlar)
if ($request->has('is_default')) {
    $data['is_default'] = $request->input('is_default') ? 1 : 0;
}

// Map content/design_data
if ($request->has('design_data')) {
    $data['design_data'] = $request->input('design_data');
} elseif ($request->has('content')) {
    $data['design_data'] = $request->input('content');
}

// Map thumbnail/preview_image
if ($request->has('preview_image')) {
    $data['preview_image'] = $request->input('preview_image');
} elseif ($request->has('thumbnail')) {
    $data['preview_image'] = $request->input('thumbnail');
}

// Render image'ı dosyaya kaydet (firma bazlı izolasyon)
$renderImageData = $request->input('render_image');
if ($renderImageData && strpos($renderImageData, 'data:image') === 0) {
    // Firma bazlı render dizini oluştur
    $renderOwnerId = $companyId ?: 'system';
    $renderDir = STORAGE_PATH . '/companies/' . $renderOwnerId . '/templates/renders';
    if (!is_dir($renderDir)) {
        mkdir($renderDir, 0755, true);
    }

    // Eski render dosyasını sil (varsa)
    if (!empty($template['render_image'])) {
        $oldFile = STORAGE_PATH . '/' . $template['render_image'];
        if (file_exists($oldFile)) {
            @unlink($oldFile);
        }
    }

    // Base64'ten görsel çıkar
    $parts = explode(',', $renderImageData);
    if (count($parts) === 2) {
        $imageData = base64_decode($parts[1]);
        $fileName = $id . '_' . time() . '.png';
        $filePath = $renderDir . '/' . $fileName;

        if (file_put_contents($filePath, $imageData)) {
            $data['render_image'] = 'companies/' . $renderOwnerId . '/templates/renders/' . $fileName;
        }
    }
}

// Shared (system) template toggle - SuperAdmin only
if ($isSuperAdmin && $request->has('is_shared')) {
    $isShared = (bool)$request->input('is_shared');
    if ($isShared) {
        $data['scope'] = 'system';
        $data['company_id'] = null;
        $data['is_public'] = 1;
    } else {
        $data['scope'] = 'company';
        $data['company_id'] = $companyId ?: $template['company_id'];
        $data['is_public'] = 0;
    }
}

// New fields from migration 021
if ($request->has('layout_type')) {
    $data['layout_type'] = $request->input('layout_type');
}
if ($request->has('template_file')) {
    $data['template_file'] = $request->input('template_file');
}
if ($request->has('slots')) {
    $slots = $request->input('slots');
    if (is_array($slots)) {
        $slots = json_encode($slots);
    }
    $data['slots'] = $slots;
}

// New fields from migration 025 - Grid layout
if ($request->has('grid_layout')) {
    $data['grid_layout'] = $request->input('grid_layout');
}
if ($request->has('regions_config')) {
    $regionsConfig = $request->input('regions_config');
    if (is_array($regionsConfig)) {
        $regionsConfig = json_encode($regionsConfig);
    }
    $data['regions_config'] = $regionsConfig;
}
if ($request->has('target_device_type')) {
    $data['target_device_type'] = $request->input('target_device_type');
}
if ($request->has('grid_visible')) {
    $data['grid_visible'] = $request->input('grid_visible') ? 1 : 0;
}
// Responsive template fields (migration 068)
if ($request->has('responsive_mode')) {
    $data['responsive_mode'] = $request->input('responsive_mode', 'off');
}
if ($request->has('scale_policy')) {
    $data['scale_policy'] = $request->input('scale_policy', 'contain');
}
if ($request->has('design_width')) {
    $data['design_width'] = (int)$request->input('design_width') ?: null;
}
if ($request->has('design_height')) {
    $data['design_height'] = (int)$request->input('design_height') ?: null;
}

$data['updated_at'] = date('Y-m-d H:i:s');

// Render/caching davranisini etkileyen alanlar degisti mi?
$renderImpactFields = [
    'design_data', 'width', 'height', 'orientation',
    'render_image', 'preview_image', 'grid_layout', 'regions_config',
    'layout_type', 'template_file', 'slots', 'target_device_type',
    'responsive_mode', 'scale_policy'
];
$jsonLikeFields = ['design_data', 'regions_config', 'slots'];
$normalizeForCompare = function ($value, bool $jsonLike = false): string {
    if ($value === null) {
        return '';
    }

    if ($jsonLike) {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            return trim($value);
        }
        if (is_array($value) || is_object($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }

    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    if (is_scalar($value)) {
        return trim((string)$value);
    }

    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
};

$shouldRefreshRenderCache = false;
foreach ($renderImpactFields as $field) {
    if (!array_key_exists($field, $data)) {
        continue;
    }

    $isJsonLike = in_array($field, $jsonLikeFields, true);
    $oldValue = $normalizeForCompare($template[$field] ?? null, $isJsonLike);
    $newValue = $normalizeForCompare($data[$field], $isJsonLike);

    if ($oldValue !== $newValue) {
        $shouldRefreshRenderCache = true;
        break;
    }
}

$db->update('templates', $data, 'id = ?', [$id]);

// Tek ortak şablon kuralı (label_printer)
if (
    isset($data['is_default']) &&
    $data['is_default'] == 1 &&
    (($data['category'] ?? $template['category']) === 'label_printer')
) {
    $targetCompanyId = $template['company_id'] ?? $companyId;
    if ($targetCompanyId) {
        $db->query(
            "UPDATE templates SET is_default = 0
             WHERE company_id = ? AND category = 'label_printer' AND id != ?",
            [$targetCompanyId, $id]
        );
    }
}

// Render-impact degisikliginde cache'i stale yap ve yeni render job'larini tetikle
if ($shouldRefreshRenderCache) {
    try {
        require_once BASE_PATH . '/services/RenderCacheService.php';
        $cacheService = new RenderCacheService();

        $targetCompanyIds = [];
        if (!empty($template['company_id'])) {
            $targetCompanyIds[] = (string)$template['company_id'];
        }
        if (!empty($companyId)) {
            $targetCompanyIds[] = (string)$companyId;
        }

        $collectCompanyIds = function (string $sql, array $params = []) use ($db, &$targetCompanyIds): void {
            try {
                $rows = $db->fetchAll($sql, $params);
                foreach ($rows as $row) {
                    $cid = (string)($row['company_id'] ?? '');
                    if ($cid !== '') {
                        $targetCompanyIds[] = $cid;
                    }
                }
            } catch (Exception $e) {
                // Tablo/kolon farkliliklarinda update akisinin bozulmamasi icin yutulur.
            }
        };

        // System template senaryosunda template'i kullanan firma baglamlarini da topla
        $collectCompanyIds(
            "SELECT DISTINCT company_id FROM devices
             WHERE current_template_id = ? AND company_id IS NOT NULL",
            [$id]
        );
        $collectCompanyIds(
            "SELECT DISTINCT company_id FROM products
             WHERE assigned_template_id = ? AND company_id IS NOT NULL",
            [$id]
        );
        $collectCompanyIds(
            "SELECT DISTINCT company_id FROM render_cache
             WHERE template_id = ? AND company_id IS NOT NULL",
            [$id]
        );
        $collectCompanyIds(
            "SELECT DISTINCT company_id FROM product_renders
             WHERE template_id = ? AND company_id IS NOT NULL",
            [$id]
        );

        $targetCompanyIds = array_values(array_unique(array_filter($targetCompanyIds)));

        $refreshSummary = [
            'companies' => $targetCompanyIds,
            'jobs_created' => 0,
            'affected_products' => 0
        ];

        foreach ($targetCompanyIds as $targetCompanyId) {
            $refreshResult = $cacheService->onTemplateUpdated($id, $targetCompanyId);
            $refreshSummary['jobs_created'] += (int)($refreshResult['jobs_created'] ?? 0);
            $refreshSummary['affected_products'] += (int)($refreshResult['affected_products'] ?? 0);
        }

        Logger::info('Template cache refresh triggered', [
            'template_id' => $id,
            'companies' => $refreshSummary['companies'],
            'jobs_created' => $refreshSummary['jobs_created'],
            'affected_products' => $refreshSummary['affected_products']
        ]);
    } catch (Exception $e) {
        Logger::warning('Template cache refresh trigger failed', [
            'template_id' => $id,
            'error' => $e->getMessage()
        ]);
    }
}

$template = $db->fetch("SELECT * FROM templates WHERE id = ?", [$id]);

// Map back for frontend compatibility
// label_printer uses category field to distinguish from regular esl/label
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

Logger::audit('update', 'templates', ['template_id' => $id]);

Response::success($template, 'Şablon güncellendi');
