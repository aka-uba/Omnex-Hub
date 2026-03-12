<?php
/**
 * Render Queue API - Yeni Job Oluştur
 *
 * POST /api/render-queue
 *
 * Tek ürün:
 *   { device_ids: [...], template_id: "...", product_id: "...", priority: "normal" }
 *
 * Çoklu ürün (Bulk Send Wizard):
 *   { device_ids: [...], template_id: "...", products: ["id1", "id2", ...], priority: "normal" }
 *
 * Pre-rendered image ile:
 *   { ..., pre_rendered_images: { "product_id": "data:image/png;base64,..." } }
 */

require_once BASE_PATH . '/services/RenderQueueService.php';

/**
 * Pre-rendered image'ı dosya olarak kaydet
 * Aynı ürün için her render eskisinin üzerine yazar (birikmez)
 */
function savePreRenderedImage(string $base64Image, string $productId, string $companyId): ?string
{
    if (strpos($base64Image, 'data:image') !== 0) {
        return null;
    }

    $parts = explode(',', $base64Image);
    if (count($parts) !== 2) {
        return null;
    }

    $imageData = base64_decode($parts[1]);
    if ($imageData === false) {
        return null;
    }

    // Multi-tenant dizin yapısı: /renders/{company_id}/queue/
    $renderDir = STORAGE_PATH . '/renders/' . $companyId . '/queue';
    if (!is_dir($renderDir) && !@mkdir($renderDir, 0755, true) && !is_dir($renderDir)) {
        return null;
    }

    // Sadece productId kullan - aynı ürün için üzerine yazar
    $filename = $productId . '.png';
    $filePath = $renderDir . '/' . $filename;

    if (@file_put_contents($filePath, $imageData) === false) {
        return null;
    }

    return $filePath;
}

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$data = $request->all();

// Pre-rendered images işle (Frontend canvas ile render edilmiş görseller)
$preRenderedImages = $data['pre_rendered_images'] ?? [];
$savedImagePaths = [];

if (!empty($preRenderedImages) && is_array($preRenderedImages)) {
    foreach ($preRenderedImages as $productId => $base64Image) {
        $savedPath = savePreRenderedImage($base64Image, $productId, $companyId);
        if ($savedPath) {
            $savedImagePaths[$productId] = $savedPath;
        }
    }
}

// Validasyon
if (empty($data['device_ids']) || !is_array($data['device_ids'])) {
    Response::badRequest('device_ids (array) zorunlu');
}

// Çoklu ürün veya tek ürün kontrolü
$productIds = [];
if (!empty($data['products']) && is_array($data['products'])) {
    $productIds = $data['products'];
} elseif (!empty($data['product_id'])) {
    $productIds = [$data['product_id']];
}

if (empty($data['template_id']) && empty($productIds)) {
    Response::badRequest('template_id veya product_id/products gerekli');
}

// Device'ların bu firmaya ait olduğunu doğrula
$deviceIds = $data['device_ids'];
$placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
$params = array_merge($deviceIds, [$companyId]);

$validDevices = $db->fetchAll(
    "SELECT id FROM devices WHERE id IN ($placeholders) AND company_id = ?",
    $params
);

$validDeviceIds = array_column($validDevices, 'id');
$invalidDeviceCount = count($deviceIds) - count($validDeviceIds);

if (empty($validDeviceIds)) {
    Response::badRequest('Geçerli cihaz bulunamadı');
}

// Ürünlerin bu firmaya ait olduğunu doğrula (çoklu ürün varsa)
$validProductIds = [];
$invalidProductCount = 0;

if (!empty($productIds)) {
    $productPlaceholders = implode(',', array_fill(0, count($productIds), '?'));
    $productParams = array_merge($productIds, [$companyId]);

    $validProducts = $db->fetchAll(
        "SELECT id, name FROM products WHERE id IN ($productPlaceholders) AND company_id = ?",
        $productParams
    );

    $validProductIds = array_column($validProducts, 'id');
    // Ürün ID -> Ürün Adı eşleştirmesi (queue'da ürün silinse bile görüntülenebilir)
    $productNameMap = array_column($validProducts, 'name', 'id');
    $invalidProductCount = count($productIds) - count($validProductIds);

    if (empty($validProductIds)) {
        Response::badRequest('Geçerli ürün bulunamadı');
    }
}

// Queue oluştur
$queueService = new RenderQueueService();

// Çoklu ürün için her ürüne ayrı job oluştur
$results = [];
$successCount = 0;
$failCount = 0;

// Tek ürün veya ürünsüz (sadece template) ise
if (count($validProductIds) <= 1) {
    $productId = $validProductIds[0] ?? null;
    $productName = $productId ? ($productNameMap[$productId] ?? null) : null;
    $result = $queueService->enqueue([
        'company_id' => $companyId,
        'template_id' => $data['template_id'] ?? null,
        'product_id' => $productId,
        'product_name' => $productName,
        'device_ids' => $validDeviceIds,
        'priority' => $data['priority'] ?? 'normal',
        'job_type' => $data['job_type'] ?? 'render_send',
        'render_params' => $data['render_params'] ?? [],
        'scheduled_at' => $data['scheduled_at'] ?? null,
        'max_retries' => $data['max_retries'] ?? 3,
        'created_by' => $user['id'],
        'rendered_image_path' => $productId ? ($savedImagePaths[$productId] ?? null) : null
    ]);

    if (!$result['success']) {
        Response::error($result['error']);
    }

    // Uyarı ekle
    $warnings = [];
    if ($invalidDeviceCount > 0) {
        $warnings[] = "$invalidDeviceCount cihaz geçersiz olduğu için atlandı";
    }
    if ($invalidProductCount > 0) {
        $warnings[] = "$invalidProductCount ürün geçersiz olduğu için atlandı";
    }

    if (!empty($warnings)) {
        $result['warning'] = implode('. ', $warnings);
    }

    Response::success($result, 'Render job oluşturuldu');
}

// Batch ID oluştur - aynı wizard'dan gelen tüm joblar gruplandırılır
$batchId = $db->generateUuid();

// Çoklu ürün: Her ürün için ayrı job oluştur
foreach ($validProductIds as $productId) {
    $result = $queueService->enqueue([
        'company_id' => $companyId,
        'template_id' => $data['template_id'] ?? null,
        'product_id' => $productId,
        'product_name' => $productNameMap[$productId] ?? null,
        'device_ids' => $validDeviceIds,
        'priority' => $data['priority'] ?? 'normal',
        'job_type' => $data['job_type'] ?? 'bulk_send',
        'render_params' => $data['render_params'] ?? [],
        'scheduled_at' => $data['scheduled_at'] ?? null,
        'max_retries' => $data['max_retries'] ?? 3,
        'created_by' => $user['id'],
        'rendered_image_path' => $savedImagePaths[$productId] ?? null,
        'batch_id' => $batchId
    ]);

    if ($result['success']) {
        $successCount++;
        $results[] = [
            'product_id' => $productId,
            'queue_id' => $result['queue_id'],
            'success' => true
        ];
    } else {
        $failCount++;
        $results[] = [
            'product_id' => $productId,
            'success' => false,
            'error' => $result['error']
        ];
    }
}

// Özet response
$response = [
    'success' => $successCount > 0,
    'bulk_send' => true,
    'total_products' => count($validProductIds),
    'total_devices' => count($validDeviceIds),
    'jobs_created' => $successCount,
    'jobs_failed' => $failCount,
    'results' => $results
];

// Uyarılar
$warnings = [];
if ($invalidDeviceCount > 0) {
    $warnings[] = "$invalidDeviceCount cihaz geçersiz olduğu için atlandı";
}
if ($invalidProductCount > 0) {
    $warnings[] = "$invalidProductCount ürün geçersiz olduğu için atlandı";
}
if ($failCount > 0) {
    $warnings[] = "$failCount ürün için job oluşturulamadı";
}

if (!empty($warnings)) {
    $response['warning'] = implode('. ', $warnings);
}

$message = $successCount > 0
    ? "$successCount ürün için render job oluşturuldu"
    : "Hiçbir job oluşturulamadı";

Response::success($response, $message);
