<?php
/**
 * Render Queue API - Otomatik Toplu Gönderim
 *
 * POST /api/render-queue/auto
 *
 * Önceden atanmış template ve device bilgilerini kullanarak
 * seçilen ürünler için otomatik render job'ları oluşturur.
 *
 * Request Format 1 (Simple - product_ids only):
 *   {
 *     product_ids: ["product_id_1", "product_id_2"],
 *     priority: "normal"
 *   }
 *
 * Request Format 2 (Detailed - products with labels):
 *   {
 *     products: [
 *       {
 *         id: "product_id",
 *         labels: [
 *           { template_id: "...", device_ids: ["..."] }
 *         ]
 *       }
 *     ],
 *     priority: "normal"
 *   }
 *
 * Request Format 3 (With Pre-rendered Images):
 *   {
 *     product_ids: ["product_id_1", "product_id_2"],
 *     pre_rendered_images: {
 *       "product_id_1": "data:image/png;base64,...",
 *       "product_id_2": "data:image/png;base64,..."
 *     },
 *     priority: "normal"
 *   }
 */

require_once BASE_PATH . '/services/RenderQueueService.php';

/**
 * Pre-rendered image'ı dosya olarak kaydet
 * Aynı ürün için her render eskisinin üzerine yazar (birikmez)
 *
 * @param string $base64Image Base64 encoded image data
 * @param string $productId Product ID
 * @param string $companyId Company ID
 * @return string|null Saved file path or null on failure
 */
function savePreRenderedImage(string $base64Image, string $productId, string $companyId, ?string $templateId = null): ?string
{
    // Base64 formatını kontrol et
    if (strpos($base64Image, 'data:image') !== 0) {
        return null;
    }

    // Base64 verisini ayır
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
    if (!is_dir($renderDir)) {
        mkdir($renderDir, 0755, true);
    }

    // Sadece productId kullan - aynı ürün için üzerine yazar
    $filename = $productId . ($templateId ? ('_' . $templateId) : '') . '.png';
    $filePath = $renderDir . '/' . $filename;

    // Dosyayı kaydet
    if (file_put_contents($filePath, $imageData) === false) {
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
$targetDeviceId = $data['target_device_id'] ?? null;
$targetTemplateId = $data['target_template_id'] ?? null;
$assignedDeviceJoin = $db->isPostgres()
    ? "INNER JOIN devices d ON CAST(d.id AS TEXT) = CAST(p.assigned_device_id AS TEXT)"
    : "INNER JOIN devices d ON d.id = p.assigned_device_id";

// Format 1: product_ids array - look up labels from database
if (!empty($data['product_ids']) && is_array($data['product_ids'])) {
    $productIds = $data['product_ids'];
    if (!empty($targetDeviceId) && !empty($targetTemplateId)) {
        $data['products'] = [];
        foreach ($productIds as $pid) {
            $data['products'][] = [
                'id' => $pid,
                'labels' => [[
                    'template_id' => $targetTemplateId,
                    'device_ids' => [$targetDeviceId]
                ]]
            ];
        }
    } else {


    // Yöntem 1: devices.current_content'ten JSON olarak oku
    $allDevices = $db->fetchAll(
        "SELECT id, name, current_content, current_template_id
         FROM devices
         WHERE company_id = ?
         AND current_content IS NOT NULL",
        [$companyId]
    );


    // Build product -> single job map (group ALL devices for same product)
    $productLabelsMap = [];

    // Önce devices.current_content'ten JSON formatında oku
    foreach ($allDevices as $device) {
        $content = json_decode($device['current_content'], true);
        if ($content && isset($content['product_id']) && in_array($content['product_id'], $productIds)) {
            $pid = $content['product_id'];
            $templateId = $content['template_id'] ?? $device['current_template_id'] ?? null;

            if (!isset($productLabelsMap[$pid])) {
                $productLabelsMap[$pid] = [
                    'template_id' => $templateId,
                    'device_ids' => []
                ];
            }

            if (!$productLabelsMap[$pid]['template_id'] && $templateId) {
                $productLabelsMap[$pid]['template_id'] = $templateId;
            }

            $productLabelsMap[$pid]['device_ids'][] = $device['id'];
        }
    }

    // Yöntem 2 (Fallback): products.assigned_device_id ve assigned_template_id alanlarından oku
    // Bu, current_content'in JSON formatında olmadığı durumlar için gerekli
    $assignedProducts = $db->fetchAll(
        "SELECT p.id as product_id, p.assigned_device_id, p.assigned_template_id, d.id as device_id, d.current_template_id
         FROM products p
         $assignedDeviceJoin
         WHERE p.company_id = ?
         AND p.assigned_device_id IS NOT NULL
         AND p.id IN (" . implode(',', array_fill(0, count($productIds), '?')) . ")",
        array_merge([$companyId], $productIds)
    );


    foreach ($assignedProducts as $assigned) {
        $pid = $assigned['product_id'];
        $deviceId = $assigned['device_id'];
        $templateId = $assigned['assigned_template_id'] ?? $assigned['current_template_id'] ?? null;

        // Eğer bu ürün zaten productLabelsMap'te yoksa veya bu cihaz henüz eklenmemişse ekle
        if (!isset($productLabelsMap[$pid])) {
            $productLabelsMap[$pid] = [
                'template_id' => $templateId,
                'device_ids' => []
            ];
        }

        if (!$productLabelsMap[$pid]['template_id'] && $templateId) {
            $productLabelsMap[$pid]['template_id'] = $templateId;
        }

        if (!in_array($deviceId, $productLabelsMap[$pid]['device_ids'])) {
            $productLabelsMap[$pid]['device_ids'][] = $deviceId;
        }
    }


    // Convert to products array format - her ürün için TEK label (tüm cihazlarla)
    $data['products'] = [];
    foreach ($productIds as $pid) {
        if (isset($productLabelsMap[$pid]) && !empty($productLabelsMap[$pid]['device_ids'])) {
            $data['products'][] = [
                'id' => $pid,
                'labels' => [$productLabelsMap[$pid]] // Tek label, tüm cihazlar
            ];
        } else {
            $data['products'][] = [
                'id' => $pid,
                'labels' => []
            ];
        }
    }
    }
}

// Validasyon
if (empty($data['products']) || !is_array($data['products'])) {
    Response::badRequest('products veya product_ids (array) zorunlu');
}

$priority = $data['priority'] ?? 'normal';
$validPriorities = ['urgent', 'high', 'normal', 'low'];
if (!in_array($priority, $validPriorities)) {
    $priority = 'normal';
}

// Pre-rendered images (Frontend canvas ile render edilmiş görseller)
$preRenderedImages = $data['pre_rendered_images'] ?? [];
$savedImagePaths = [];

// use_cache: true gönderildiğinde cached_images'dan file path'leri al
$useCache = !empty($data['use_cache']) && $data['use_cache'] === true;
$cachedImages = $data['cached_images'] ?? [];

if ($useCache && !empty($cachedImages) && is_array($cachedImages)) {

    foreach ($cachedImages as $productId => $imagePath) {
        // cached_images yapısı: { "product_id": "path" } veya { "product_id": { "template_id": "path" } }
        if (is_array($imagePath)) {
            foreach ($imagePath as $templateId => $templatePath) {
                $finalPath = null;
                if (is_string($templatePath) && !empty($templatePath)) {
                    if (file_exists($templatePath)) {
                        $finalPath = $templatePath;
                    } elseif (strpos($templatePath, '/storage/') === 0) {
                        $absolutePath = BASE_PATH . '/public' . $templatePath;
                        if (file_exists($absolutePath)) {
                            $finalPath = $absolutePath;
                        }
                    } elseif (strpos($templatePath, 'storage/') === 0) {
                        $absolutePath = BASE_PATH . '/public/' . $templatePath;
                        if (file_exists($absolutePath)) {
                            $finalPath = $absolutePath;
                        }
                    }
                }

                if ($finalPath) {
                    $savedImagePaths[$productId][$templateId] = $finalPath;
                } else {
                }
            }
        } elseif (is_string($imagePath) && !empty($imagePath)) {
            $finalPath = null;
            if (file_exists($imagePath)) {
                $finalPath = $imagePath;
            } elseif (strpos($imagePath, '/storage/') === 0) {
                $absolutePath = BASE_PATH . '/public' . $imagePath;
                if (file_exists($absolutePath)) {
                    $finalPath = $absolutePath;
                }
            } elseif (strpos($imagePath, 'storage/') === 0) {
                $absolutePath = BASE_PATH . '/public/' . $imagePath;
                if (file_exists($absolutePath)) {
                    $finalPath = $absolutePath;
                }
            }

            if ($finalPath) {
                if (!empty($targetTemplateId)) {
                    $savedImagePaths[$productId][$targetTemplateId] = $finalPath;
                }
                $savedImagePaths[$productId]['_default'] = $finalPath;
            } else {
            }
        }
    }

}

// Pre-rendered images (base64 data - fallback method)
if (!empty($preRenderedImages) && is_array($preRenderedImages)) {

    foreach ($preRenderedImages as $productId => $base64Image) {
        if (is_array($base64Image)) {
            foreach ($base64Image as $templateId => $templateImage) {
                if (isset($savedImagePaths[$productId][$templateId])) {
                    continue;
                }

                $savedPath = savePreRenderedImage($templateImage, $productId, $companyId, (string)$templateId);
                if ($savedPath) {
                    $savedImagePaths[$productId][$templateId] = $savedPath;
                } else {
                }
            }
        } else {
            // Zaten cached path varsa skip et
            if (isset($savedImagePaths[$productId])) {
                continue;
            }

            $savedPath = savePreRenderedImage($base64Image, $productId, $companyId, $targetTemplateId ? (string)$targetTemplateId : null);
            if ($savedPath) {
                if (!empty($targetTemplateId)) {
                    $savedImagePaths[$productId][$targetTemplateId] = $savedPath;
                }
                $savedImagePaths[$productId]['_default'] = $savedPath;
            } else {
            }
        }
    }

}

// Zamanlama
$scheduledAt = null;
if (!empty($data['scheduled_at'])) {
    $scheduledAt = $data['scheduled_at'];
    // Format kontrolü: 2026-01-22T14:30:00
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/', $scheduledAt)) {
        $scheduledAt = null;
    }
}

// Queue service
$queueService = new RenderQueueService();

// Sonuçlar
$results = [];
$successCount = 0;
$failCount = 0;
$totalDevices = 0;
$skippedProducts = 0;

// Batch ID oluştur - aynı wizard'dan gelen tüm joblar gruplandırılır
$batchId = $db->generateUuid();

// Her ürün için job oluştur
foreach ($data['products'] as $productData) {
    $productId = $productData['id'] ?? null;
    $labels = $productData['labels'] ?? [];

    if (!$productId) {
        $skippedProducts++;
        continue;
    }

    // Multi-product composite gönderimi — synthetic product ID bypass
    $isMultiProduct = strpos($productId, 'multi_') === 0;
    if ($isMultiProduct) {
        $product = ['id' => null, 'name' => 'Multi-Product Composite'];
    } else {
        // Ürünün bu firmaya ait olduğunu doğrula
        $product = $db->fetch(
            "SELECT id, name FROM products WHERE id = ? AND company_id = ?",
            [$productId, $companyId]
        );

        if (!$product) {
            $skippedProducts++;
            $results[] = [
                'product_id' => $productId,
                'success' => false,
                'error' => 'Ürün bulunamadı'
            ];
            continue;
        }
    }

    // Atanmış etiket yoksa atla
    if (empty($labels)) {
        $skippedProducts++;
        $results[] = [
            'product_id' => $productId,
            'product_name' => $product['name'],
            'success' => false,
            'error' => 'Atanmış etiket bulunamadı'
        ];
        continue;
    }

    // Her label (template + devices) için job oluştur
    foreach ($labels as $label) {
        $templateId = $label['template_id'] ?? null;
        $deviceIds = $label['device_ids'] ?? [];

        if (!$templateId || empty($deviceIds)) {
            continue;
        }

        // Template'in geçerliliğini kontrol et (draft dahil - kullanıcı cihaza atamışsa kullanmak istiyordur)
        $template = $db->fetch(
            "SELECT id, name FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system' OR company_id IS NULL)",
            [$templateId, $companyId]
        );

        if (!$template) {
            $results[] = [
                'product_id' => $productId,
                'product_name' => $product['name'],
                'template_id' => $templateId,
                'success' => false,
                'error' => 'Şablon bulunamadı veya pasif'
            ];
            $failCount++;
            continue;
        }

        // Device'ların geçerliliğini kontrol et
        $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
        $params = array_merge($deviceIds, [$companyId]);

        $validDevices = $db->fetchAll(
            "SELECT id FROM devices WHERE id IN ($placeholders) AND company_id = ?",
            $params
        );

        $validDeviceIds = array_column($validDevices, 'id');

        if (empty($validDeviceIds)) {
            $results[] = [
                'product_id' => $productId,
                'product_name' => $product['name'],
                'template_id' => $templateId,
                'success' => false,
                'error' => 'Geçerli cihaz bulunamadı'
            ];
            $failCount++;
            continue;
        }

        // Job oluştur

        // Pre-rendered image path'i kontrol et
        $renderedImagePath = null;
        if (isset($savedImagePaths[$productId][$templateId])) {
            $renderedImagePath = $savedImagePaths[$productId][$templateId];
        } elseif (isset($savedImagePaths[$productId]['_default'])) {
            $canUseDefault = count($labels) === 1 || (!empty($targetTemplateId) && $templateId === $targetTemplateId);
            if ($canUseDefault) {
                $renderedImagePath = $savedImagePaths[$productId]['_default'];
            } else {
            }
        } else {
        }

        $result = $queueService->enqueue([
            'company_id' => $companyId,
            'template_id' => $templateId,
            'product_id' => $isMultiProduct ? null : $productId,
            'product_name' => $product['name'],
            'device_ids' => $validDeviceIds,
            'priority' => $priority,
            'job_type' => 'auto_send',
            'render_params' => [],
            'scheduled_at' => $scheduledAt,
            'max_retries' => 3,
            'created_by' => $user['id'],
            'rendered_image_path' => $renderedImagePath, // Frontend'den gelen pre-rendered görsel
            'batch_id' => $batchId
        ]);


        if ($result['success']) {
            $successCount++;
            $totalDevices += count($validDeviceIds);
            $results[] = [
                'product_id' => $productId,
                'product_name' => $product['name'],
                'template_id' => $templateId,
                'template_name' => $template['name'],
                'queue_id' => $result['queue_id'],
                'devices_count' => count($validDeviceIds),
                'success' => true
            ];
        } else {
            $failCount++;
            $results[] = [
                'product_id' => $productId,
                'product_name' => $product['name'],
                'template_id' => $templateId,
                'success' => false,
                'error' => $result['error']
            ];
        }
    }
}

// Özet response
$response = [
    'success' => $successCount > 0,
    'auto_send' => true,
    'total_products' => count($data['products']),
    'total_devices' => $totalDevices,
    'jobs_created' => $successCount,
    'jobs_failed' => $failCount,
    'skipped_products' => $skippedProducts,
    'results' => $results
];

// Uyarılar
$warnings = [];
if ($skippedProducts > 0) {
    $warnings[] = "$skippedProducts ürün atandı (atama yok veya geçersiz)";
}
if ($failCount > 0) {
    $warnings[] = "$failCount job oluşturulamadı";
}

if (!empty($warnings)) {
    $response['warning'] = implode('. ', $warnings);
}

$message = $successCount > 0
    ? "$successCount job başarıyla kuyruğa eklendi ($totalDevices cihaz)"
    : "Hiçbir job oluşturulamadı";

Response::success($response, $message);
