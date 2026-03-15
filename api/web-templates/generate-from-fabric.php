<?php
/**
 * Web Templates - Generate from Fabric.js Template
 * POST /api/web-templates/generate-from-fabric
 *
 * Fabric.js şablonunu ürün verileriyle birleştirerek bağımsız HTML sayfası oluşturur.
 * Oluşan HTML web_templates tablosuna kaydedilir ve playlist'e eklenebilir hale gelir.
 *
 * Request Body:
 * {
 *   "template_id": "uuid",          // Fabric.js templates tablosundan şablon ID
 *   "product_ids": ["uuid", ...],   // Bağlanacak ürün ID'leri (tekli veya çoklu)
 *   "name": "Opsiyonel isim",       // Boşsa otomatik oluşturulur
 *   "width": 1920,                  // Opsiyonel hedef genişlik
 *   "height": 1080,                 // Opsiyonel hedef yükseklik
 *   "currency": "₺"                 // Opsiyonel para birimi
 * }
 */

require_once BASE_PATH . '/services/FabricToHtmlConverter.php';

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
$data = $request->body();

// ── Validasyon ───────────────────────────────────────────

$templateId = $data['template_id'] ?? '';
$productIds = $data['product_ids'] ?? [];

if (empty($templateId)) {
    Response::error('template_id gerekli', 400);
}

if (empty($productIds) || !is_array($productIds)) {
    Response::error('product_ids gerekli (dizi)', 400);
}

// ── Şablon yükle ─────────────────────────────────────────

$template = $db->fetch(
    "SELECT id, name, design_data, type, width, height, grid_layout, regions_config,
            responsive_mode, scale_policy, design_width, design_height
     FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system')",
    [$templateId, $companyId]
);

if (!$template) {
    Response::error('Şablon bulunamadı', 404);
}

if (empty($template['design_data'])) {
    Response::error('Şablonda design_data bulunamadı', 400);
}

// ── Ürünleri yükle ───────────────────────────────────────

$products = [];
foreach ($productIds as $pid) {
    $product = $db->fetch("SELECT * FROM products WHERE id = ? AND company_id = ?", [$pid, $companyId]);
    if (!$product) {
        Response::error("Ürün bulunamadı: {$pid}", 404);
    }

    // HAL Künye verileri ekle
    $halData = $db->fetch(
        "SELECT * FROM product_hal_data WHERE product_id = ? AND company_id = ?",
        [$pid, $companyId]
    );
    if ($halData) {
        foreach ($halData as $field => $value) {
            if (in_array($field, ['id', 'product_id', 'company_id', 'created_at', 'updated_at', 'deleted_at'], true)) {
                continue;
            }
            if (($product[$field] ?? null) === null || ($product[$field] ?? '') === '') {
                if ($value !== null && $value !== '') {
                    $product[$field] = $value;
                }
            }
        }
    }

    $products[] = $product;
}

// ── Dönüşüm ─────────────────────────────────────────────

try {
    $converter = new FabricToHtmlConverter($companyId);

    $options = [];
    if (!empty($data['width']))    $options['width']    = (int)$data['width'];
    if (!empty($data['height']))   $options['height']   = (int)$data['height'];
    if (!empty($data['currency'])) $options['currency'] = $data['currency'];

    // İsim oluştur
    $customName = trim($data['name'] ?? '');
    if (empty($customName)) {
        $productNames = array_map(fn($p) => $p['name'] ?? '', $products);
        $productLabel = count($productNames) > 2
            ? $productNames[0] . ' +' . (count($productNames) - 1)
            : implode(', ', $productNames);
        $customName = $template['name'] . ' - ' . $productLabel;
    }
    $options['title'] = $customName;

    $result = $converter->convert($template, $products, $options);

} catch (Throwable $e) {
    Logger::error('FabricToHtml conversion error', [
        'template_id' => $templateId,
        'product_ids' => $productIds,
        'error' => $e->getMessage()
    ]);
    Response::error('HTML dönüşümü başarısız: ' . $e->getMessage(), 500);
}

// ── HTML dosyasını diske kaydet ──────────────────────────

$htmlDir = STORAGE_PATH . '/companies/' . $companyId . '/html-templates';
if (!is_dir($htmlDir)) {
    mkdir($htmlDir, 0755, true);
}

$fileSlug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $customName));
$fileSlug = trim($fileSlug, '-');
if (strlen($fileSlug) > 80) {
    $fileSlug = substr($fileSlug, 0, 80);
}
$fileName = $fileSlug . '.html';

// Aynı isimde dosya varsa suffix ekle
$counter = 1;
while (file_exists($htmlDir . '/' . $fileName)) {
    $fileName = $fileSlug . '-' . $counter . '.html';
    $counter++;
}

$filePath = $htmlDir . '/' . $fileName;
$written = file_put_contents($filePath, $result['html']);

if ($written === false) {
    Response::error('HTML dosyası kaydedilemedi', 500);
}

// ── Mevcut web şablonu kontrol et (aynı fabric_template + product_ids) ──────
// Aynı kaynak şablon ve ürün kombinasyonu varsa güncelle, yoksa yeni oluştur.

$sortedProductIds = $productIds;
sort($sortedProductIds);
$productIdsKey = json_encode($sortedProductIds);

$existingWebTemplate = null;
$existingRows = $db->fetchAll(
    "SELECT id, data_sources, version, slug FROM web_templates
     WHERE company_id = ? AND deleted_at IS NULL
     AND data_sources IS NOT NULL AND data_sources != ''",
    [$companyId]
);

foreach ($existingRows as $row) {
    $ds = json_decode($row['data_sources'], true);
    if (!$ds || ($ds['source'] ?? '') !== 'fabric_template') continue;
    if (($ds['fabric_template_id'] ?? '') !== $templateId) continue;

    // Ürün ID'lerini sıralayıp karşılaştır
    $existingPids = $ds['product_ids'] ?? [];
    sort($existingPids);
    if (json_encode($existingPids) === $productIdsKey) {
        $existingWebTemplate = $row;
        break;
    }
}

$isUpdate = ($existingWebTemplate !== null);

// Kaynak şablon ve ürün ID'lerini meta olarak sakla
$dataSources = json_encode([
    'source' => 'fabric_template',
    'fabric_template_id' => $templateId,
    'product_ids' => $productIds,
    'generated_at' => date('Y-m-d H:i:s')
]);

// Relative file path for serving
$relativeFilePath = 'storage/companies/' . $companyId . '/html-templates/' . $fileName;

try {
    $db->beginTransaction();

    if ($isUpdate) {
        // ── Mevcut şablonu güncelle ──────────────────────────
        $webTemplateId = $existingWebTemplate['id'];
        $newVersion = ((int)($existingWebTemplate['version'] ?? 1)) + 1;

        $db->update('web_templates', [
            'name' => $customName,
            'html_content' => $result['html'],
            'width' => $result['width'],
            'height' => $result['height'],
            'orientation' => $result['width'] >= $result['height'] ? 'landscape' : 'portrait',
            'data_sources' => $dataSources,
            'dynamic_fields' => json_encode(['product_ids' => $productIds]),
            'version' => $newVersion,
            'updated_by' => $user['id'],
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$webTemplateId]);

        // Versiyon kaydı
        $db->insert('web_template_versions', [
            'id' => $db->generateUuid(),
            'template_id' => $webTemplateId,
            'version_number' => $newVersion,
            'version_name' => 'Güncelleme v' . $newVersion,
            'change_notes' => 'Fabric.js şablonundan yeniden oluşturuldu',
            'html_content' => $result['html'],
            'created_by' => $user['id']
        ]);

    } else {
        // ── Yeni şablon oluştur ──────────────────────────────
        $webTemplateId = $db->generateUuid();
        $slug = $fileSlug;

        // Slug benzersizlik
        $existingSlug = $db->fetch(
            "SELECT id FROM web_templates WHERE slug = ? AND company_id = ? AND deleted_at IS NULL",
            [$slug, $companyId]
        );
        if ($existingSlug) {
            $slug .= '-' . substr(uniqid(), -6);
        }

        $db->insert('web_templates', [
            'id' => $webTemplateId,
            'company_id' => $companyId,
            'name' => $customName,
            'slug' => $slug,
            'description' => 'Fabric.js şablonundan oluşturuldu: ' . $template['name'],
            'html_content' => $result['html'],
            'template_type' => 'signage',
            'width' => $result['width'],
            'height' => $result['height'],
            'orientation' => $result['width'] >= $result['height'] ? 'landscape' : 'portrait',
            'data_sources' => $dataSources,
            'dynamic_fields' => json_encode(['product_ids' => $productIds]),
            'status' => 'published',
            'version' => 1,
            'scope' => 'company',
            'created_by' => $user['id'],
            'updated_by' => $user['id']
        ]);

        // Versiyon kaydı
        $db->insert('web_template_versions', [
            'id' => $db->generateUuid(),
            'template_id' => $webTemplateId,
            'version_number' => 1,
            'version_name' => 'İlk oluşturma',
            'change_notes' => 'Fabric.js şablonundan otomatik dönüştürüldü',
            'html_content' => $result['html'],
            'created_by' => $user['id']
        ]);
    }

    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    // Dosyayı temizle
    if (file_exists($filePath)) {
        @unlink($filePath);
    }
    Logger::error('Web template save error', ['error' => $e->getMessage()]);
    Response::serverError('HTML şablonu kaydedilemedi');
}

// Audit log
$auditAction = $isUpdate ? 'update' : 'create';
try {
    Logger::audit($auditAction, 'web_template', [
        'template_id' => $webTemplateId,
        'source' => 'fabric_to_html',
        'fabric_template_id' => $templateId,
        'product_ids' => $productIds,
        'name' => $customName,
        'is_update' => $isUpdate,
        'user_id' => $user['id']
    ]);
} catch (Throwable $e) {
    // non-critical
}

// Oluşturulan/güncellenen şablonu getir
$webTemplate = $db->fetch("SELECT * FROM web_templates WHERE id = ?", [$webTemplateId]);

$message = $isUpdate
    ? 'HTML şablonu başarıyla güncellendi'
    : 'HTML şablonu başarıyla oluşturuldu';

Response::success([
    'web_template' => $webTemplate,
    'file_path' => $relativeFilePath,
    'file_url' => '/' . $relativeFilePath,
    'html_size' => strlen($result['html']),
    'width' => $result['width'],
    'height' => $result['height'],
    'is_update' => $isUpdate
], $message, $isUpdate ? 200 : 201);
