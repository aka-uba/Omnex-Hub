<?php
/**
 * Render Cache API - Bulk send oncesi cache durumu kontrolu
 *
 * POST /api/render-cache/check
 */

require_once BASE_PATH . '/services/RenderCacheService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$cacheService = new RenderCacheService();
$data = $request->all();

$products = [];

// product_ids verilmisse, cihazlardan template bilgisini bul
if (!empty($data['product_ids']) && is_array($data['product_ids'])) {
    $productIds = $data['product_ids'];

    // Bozuk JSON kayitlarinda SQL json_extract hatasi almamak icin
    // current_content parse islemini PHP tarafinda yap.
    $deviceTemplateByProductId = [];
    $deviceRows = $db->fetchAll(
        "SELECT current_template_id, current_content
         FROM devices
         WHERE company_id = ?
           AND current_content IS NOT NULL
           AND TRIM(current_content) != ''",
        [$companyId]
    );

    foreach ($deviceRows as $deviceRow) {
        $rawContent = $deviceRow['current_content'] ?? '';
        if (!is_string($rawContent) || trim($rawContent) === '') {
            continue;
        }

        $content = json_decode($rawContent, true);
        if (!is_array($content)) {
            continue;
        }

        $mappedProductId = (string)($content['product_id'] ?? '');
        if ($mappedProductId === '') {
            continue;
        }

        if (!isset($deviceTemplateByProductId[$mappedProductId])) {
            $templateFromDevice = $deviceRow['current_template_id'] ?? null;
            if (!$templateFromDevice) {
                $templateFromDevice = $content['template_id'] ?? null;
            }
            if (!empty($templateFromDevice)) {
                $deviceTemplateByProductId[$mappedProductId] = $templateFromDevice;
            }
        }
    }

    $productTemplateByProductId = [];
    $uniqueProductIds = array_values(array_unique(array_filter(array_map('strval', $productIds))));
    if (!empty($uniqueProductIds)) {
        $placeholders = implode(',', array_fill(0, count($uniqueProductIds), '?'));
        $productRows = $db->fetchAll(
            "SELECT id, assigned_template_id
             FROM products
             WHERE company_id = ?
               AND id IN ($placeholders)",
            array_merge([$companyId], $uniqueProductIds)
        );

        foreach ($productRows as $productRow) {
            $pid = (string)($productRow['id'] ?? '');
            if ($pid !== '' && !empty($productRow['assigned_template_id'])) {
                $productTemplateByProductId[$pid] = $productRow['assigned_template_id'];
            }
        }
    }

    foreach ($productIds as $productId) {
        $templateId = null;
        $productIdKey = (string)$productId;

        if (isset($deviceTemplateByProductId[$productIdKey])) {
            $templateId = $deviceTemplateByProductId[$productIdKey];
        }

        if (!$templateId) {
            $templateId = $productTemplateByProductId[$productIdKey] ?? null;
        }

        if ($templateId) {
            $products[] = [
                'id' => $productId,
                'template_id' => $templateId
            ];
        }
    }
}

// products dizisi verilmisse direkt kullan
if (!empty($data['products']) && is_array($data['products'])) {
    $products = $data['products'];
}

if (empty($products)) {
    Response::success([
        'total' => 0,
        'all_ready' => true,
        'ready_count' => 0,
        'pending_count' => 0,
        'not_cached_count' => 0,
        'progress_percent' => 100,
        'ready' => [],
        'pending' => [],
        'not_cached' => [],
        'message' => 'Kontrol edilecek urun bulunamadi'
    ]);
}

// Cache durumunu kontrol et
$status = $cacheService->checkBulkCacheStatus($products, $companyId);

// create_jobs_for_missing true ise eksikler icin job olustur
if (!empty($data['create_jobs_for_missing']) && !empty($status['not_cached'])) {
    $batchId = $db->generateUuid();
    $jobsCreated = 0;

    foreach ($status['not_cached'] as $item) {
        $cacheService->createRenderJob([
            'company_id' => $companyId,
            'product_id' => $item['product_id'],
            'template_id' => $item['template_id'],
            'job_type' => 'bulk',
            'source' => 'api',
            'priority' => 'high',
            'batch_id' => $batchId,
            'created_by' => $user['id']
        ]);
        $jobsCreated++;
    }

    $status['jobs_created'] = $jobsCreated;
    $status['batch_id'] = $batchId;
}

Response::success($status);