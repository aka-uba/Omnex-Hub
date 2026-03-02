<?php
/**
 * ESL HTTP Client Content API (PavoDisplay /openapi/easylabel uyumlu)
 *
 * GET /api/esl/http/content
 *
 * HTTP modundaki ESL cihazları bu endpoint'i periyodik olarak sorgular.
 * PavoDisplay firmware'inin beklediği format ile tam uyumludur.
 *
 * Cihaz isteği:
 *   GET /api/esl/http/content?appid=xxx&clientid=MAC&nlast=0&ts=1234567890123&version=V3.36&sign=ABC123
 *
 * Başarılı yanıt (KRITIK: Data bir JSON STRING, obje değil!):
 * {
 *   "State": "Done",
 *   "Message": "Success",
 *   "Number": "",
 *   "Data": "{\"Id\":\"MAC\",\"ItemCode\":\"SKU\",\"ItemName\":\"Name\",\"LabelPicture\":{...},\"Nlast\":123}",
 *   "Level": 0,
 *   "ErrorColumn": null
 * }
 *
 * İçerik Öncelik Sırası:
 * 1. device_content_assignments (render.php tarafından yazılır)
 * 2. devices.current_content (ürün/şablon ataması)
 * 3. Firma geneli en son render (fallback)
 */

require_once dirname(dirname(dirname(__DIR__))) . '/config.php';
require_once BASE_PATH . '/services/EslSignValidator.php';

$db = Database::getInstance();
$validator = new EslSignValidator();

// --- Base URL hesaplama ---
$serverBaseUrl = preg_replace('#/api$#', '', APP_URL);
$requestHost = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
if (is_string($requestHost) && $requestHost !== '') {
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $httpsFlag = $_SERVER['HTTPS'] ?? '';
    $scheme = (!empty($forwardedProto) ? strtolower((string)$forwardedProto) : null)
        ?: ((!empty($httpsFlag) && strtolower((string)$httpsFlag) !== 'off') ? 'https' : 'http');

    $appPath = '';
    $appUrlPath = parse_url((string)APP_URL, PHP_URL_PATH);
    if (is_string($appUrlPath) && $appUrlPath !== '') {
        $appPath = preg_replace('#/api/?$#', '', rtrim($appUrlPath, '/')) ?: '';
    }
    if ($appPath === '') {
        $scriptName = (string)($_SERVER['SCRIPT_NAME'] ?? '');
        $appPath = preg_replace('#/api(?:/index\.php)?$#i', '', rtrim($scriptName, '/')) ?: '';
        if ($appPath !== '' && strpos($appPath, '/') !== 0) {
            $appPath = '/' . $appPath;
        }
    }
    $serverBaseUrl = $scheme . '://' . $requestHost . rtrim((string)$appPath, '/');
}

// --- Query parametreleri (GET + POST desteği) ---
$clientId = $_GET['clientId'] ?? $_GET['clientid'] ?? $_GET['sn'] ?? null;
$appId    = $_GET['appId'] ?? $_GET['appid'] ?? '';
$sign     = $_GET['sign'] ?? '';
$nlast    = $_GET['nlast'] ?? $_GET['push_id'] ?? null;
$version  = $_GET['version'] ?? null;
$ts       = $_GET['ts'] ?? null;

// POST body desteği
if (empty($clientId)) {
    $body = json_decode(file_get_contents('php://input'), true);
    if ($body) {
        $clientId = $body['clientId'] ?? $body['clientid'] ?? $body['sn'] ?? null;
        $appId    = $body['appId'] ?? $body['appid'] ?? $appId;
        $sign     = $body['sign'] ?? $sign;
        $nlast    = $body['nlast'] ?? $body['push_id'] ?? $nlast;
        $version  = $body['version'] ?? $version;
        $ts       = $body['ts'] ?? $ts;
    }
}

if (empty($clientId)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'clientId required',
        'Number' => 'MISSING_PARAM',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 400);
}

// --- Kimlik Doğrulama ---
$settings = null;

// 1. AppID + Sign ile doğrula
if (!empty($appId)) {
    $params = $_GET ?: [];
    if (empty($params)) {
        $params = json_decode(file_get_contents('php://input'), true) ?: [];
    }
    $settings = $validator->authenticate($appId, $sign, $params);
}

// 2. Legacy fallback (appId olmadan cihaz kaydına göre)
if (!$settings) {
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;
    $settings = $validator->authenticateLegacy($clientId, $remoteIp);
    if ($settings) {
        error_log("[ESL HTTP content] legacy auth fallback clientId={$clientId} ip={$remoteIp}");
    }
}

if (!$settings) {
    Response::json([
        'State' => 'Fail',
        'Message' => empty($appId) ? 'appId required' : 'Invalid appId/sign',
        'Number' => empty($appId) ? 'MISSING_PARAM' : 'AUTH_FAILED',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], empty($appId) ? 400 : 403);
}

$companyId = $settings['company_id'];

// --- Cihazı Bul ---
$device = $validator->findDeviceByClientId($clientId, $companyId);

if (!$device) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device not found',
        'Number' => 'NOT_FOUND',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 404);
}

$deviceId = $device['id'];
if ($companyId !== ($device['company_id'] ?? null)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device company mismatch',
        'Number' => 'AUTH_FAILED',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 403);
}

$nlast = (int)($nlast ?? 0);
$screenWidth = $device['screen_width'] ?? 800;
$screenHeight = $device['screen_height'] ?? 1280;

// --- Yardımcı Fonksiyonlar ---

/**
 * Dosya yolundan task oluştur
 */
$buildTaskFromImagePath = function(string $imagePath, string $clientIdForTask, string $itemCode, string $itemName) use (
    $serverBaseUrl, $screenWidth, $screenHeight
): ?array {
    $normalizedPath = str_replace('\\', '/', trim($imagePath));
    $normalizedBasePath = str_replace('\\', '/', BASE_PATH);
    $normalizedStoragePath = str_replace('\\', '/', STORAGE_PATH);
    if ($normalizedPath === '') {
        return null;
    }

    if (preg_match('#^https?://#i', $normalizedPath)) {
        return null;
    }

    $fullPath = null;
    $relativePath = null;

    if (strpos($normalizedPath, $normalizedBasePath) === 0) {
        $fullPath = $normalizedPath;
        $relativePath = ltrim(substr($normalizedPath, strlen($normalizedBasePath)), '/');
    } elseif (strpos($normalizedPath, $normalizedStoragePath) === 0) {
        $fullPath = $normalizedPath;
        $storageRelative = ltrim(substr($normalizedPath, strlen($normalizedStoragePath)), '/');
        $relativePath = 'storage/' . $storageRelative;
    } elseif (strpos($normalizedPath, 'storage/') === 0) {
        $relativePath = $normalizedPath;
        $fullPath = BASE_PATH . '/' . $normalizedPath;
    } else {
        $relativePath = ltrim($normalizedPath, '/');
        $fullPath = BASE_PATH . '/' . $relativePath;
    }

    if (!$fullPath || !file_exists($fullPath)) {
        return null;
    }

    $md5 = md5_file($fullPath);
    $fileName = basename($fullPath);
    $pictureUrl = rtrim($serverBaseUrl, '/') . '/' . ltrim((string)$relativePath, '/');
    $newNlast = crc32($md5) & 0x7FFFFFFF;

    return [
        'Id' => $clientIdForTask,
        'ItemCode' => $itemCode,
        'ItemName' => $itemName,
        'LabelPicture' => [
            'X' => 0,
            'Y' => 0,
            'Width' => (int)$screenWidth,
            'Height' => (int)$screenHeight,
            'PictureUrl' => $pictureUrl,
            'PictureMD5' => $md5,
            'PictureName' => $fileName
        ],
        'Nlast' => $newNlast
    ];
};

/**
 * Medya URL'lerini normalize et
 */
$rewriteMediaUrl = function (?string $rawUrl) use ($serverBaseUrl): ?string {
    if (!is_string($rawUrl)) return $rawUrl;
    $url = trim($rawUrl);
    if ($url === '' || !preg_match('#^https?://#i', $url)) return $url;

    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) return $url;

    $host = strtolower((string)$parts['host']);
    $path = (string)($parts['path'] ?? '');
    $query = isset($parts['query']) ? ('?' . $parts['query']) : '';

    $isLocalHost = in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    $pathLooksInternal = strpos($path, '/storage/') !== false || strpos($path, '/public/') !== false;

    if (!$isLocalHost && !$pathLooksInternal) return $url;

    $serverBasePath = (string)(parse_url($serverBaseUrl, PHP_URL_PATH) ?? '');
    $serverBasePath = '/' . trim($serverBasePath, '/');
    if ($serverBasePath === '/') $serverBasePath = '';

    $relativePath = ltrim($path, '/');
    if ($serverBasePath !== '' && strpos($path, $serverBasePath . '/') === 0) {
        $relativePath = ltrim(substr($path, strlen($serverBasePath)), '/');
    }

    return rtrim($serverBaseUrl, '/') . '/' . $relativePath . $query;
};

$normalizeTaskMediaUrls = function (array $task) use ($rewriteMediaUrl): array {
    if (isset($task['LabelPicture']) && is_array($task['LabelPicture'])) {
        if (!empty($task['LabelPicture']['PictureUrl'])) {
            $task['LabelPicture']['PictureUrl'] = $rewriteMediaUrl((string)$task['LabelPicture']['PictureUrl']);
        }
    }
    if (isset($task['LabelVideo']['VideoList']) && is_array($task['LabelVideo']['VideoList'])) {
        foreach ($task['LabelVideo']['VideoList'] as $index => $videoItem) {
            if (!is_array($videoItem)) continue;
            if (!empty($videoItem['VideoUrl'])) {
                $videoItem['VideoUrl'] = $rewriteMediaUrl((string)$videoItem['VideoUrl']);
            }
            $task['LabelVideo']['VideoList'][$index] = $videoItem;
        }
    }
    return $task;
};

// ============================================================
// İÇERİK ÇÖZÜMLEMESİ
// ============================================================

$taskData = null;

// ÖNCELİK 1: device_content_assignments (render.php tarafından yazılır)
$assignment = $db->fetch(
    "SELECT dca.id, dca.content_type, dca.content_id, dca.created_at
     FROM device_content_assignments dca
     WHERE dca.device_id = ? AND dca.status = 'active'
     ORDER BY dca.created_at DESC
     LIMIT 1",
    [$deviceId]
);

if ($assignment && $assignment['content_id']) {
    // http_payload veya mqtt_payload (aynı format)
    if (in_array($assignment['content_type'] ?? '', ['http_payload', 'mqtt_payload'])) {
        $payloadPath = ltrim((string)$assignment['content_id'], '/');
        $payloadFullPath = BASE_PATH . '/' . $payloadPath;
        if (file_exists($payloadFullPath)) {
            $payloadRaw = file_get_contents($payloadFullPath);
            $payloadJson = json_decode((string)$payloadRaw, true);
            if (
                is_array($payloadJson)
                && (($payloadJson['company_id'] ?? $companyId) === $companyId)
                && is_array($payloadJson['task'] ?? null)
            ) {
                $taskData = $payloadJson['task'];
                $taskData['Id'] = $clientId;
                if (!isset($taskData['Nlast'])) {
                    $taskData['Nlast'] = (int)($payloadJson['content_version'] ?? 0);
                }
                if (empty($taskData['Nlast'])) {
                    $taskData['Nlast'] = (int)sprintf(
                        '%u',
                        crc32(json_encode($taskData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                    );
                }
            }
        }
    }

    // content_id → product_renders tablosundaki render
    if (!$taskData) {
        $render = $db->fetch(
            "SELECT pr.id, pr.product_id, pr.template_id, pr.file_path, pr.render_hash
             FROM product_renders pr
             WHERE pr.id = ? AND pr.status = 'completed'",
            [$assignment['content_id']]
        );

        if ($render && !empty($render['file_path'])) {
            $productId = $render['product_id'] ?? 'content';
            $productName = 'Content';
            if (!empty($productId) && $productId !== 'content') {
                $prod = $db->fetch("SELECT name, sku FROM products WHERE id = ?", [$productId]);
                if ($prod) {
                    $productName = $prod['name'];
                    $productId = $prod['sku'] ?? $productId;
                }
            }

            $taskData = $buildTaskFromImagePath(
                (string)$render['file_path'],
                $clientId,
                (string)$productId,
                $productName
            );
        }
    }

    // content_id → media tablosu (direkt medya ataması)
    if (!$taskData && ($assignment['content_type'] ?? '') === 'image') {
        $media = $db->fetch(
            "SELECT id, filename, path, mime_type FROM media WHERE id = ?",
            [$assignment['content_id']]
        );

        if ($media && $media['path']) {
            $fullPath = BASE_PATH . '/storage/' . $media['path'];
            if (file_exists($fullPath)) {
                $md5 = md5_file($fullPath);
                $fileName = $media['filename'];
                $pictureUrl = rtrim($serverBaseUrl, '/') . '/storage/' . $media['path'];
                $newNlast = crc32($md5) & 0x7FFFFFFF;

                $taskData = [
                    'Id' => $clientId,
                    'ItemCode' => $assignment['content_id'],
                    'ItemName' => $fileName,
                    'LabelPicture' => [
                        'X' => 0,
                        'Y' => 0,
                        'Width' => (int)$screenWidth,
                        'Height' => (int)$screenHeight,
                        'PictureUrl' => $pictureUrl,
                        'PictureMD5' => $md5,
                        'PictureName' => $fileName
                    ],
                    'Nlast' => $newNlast
                ];
            }
        }
    }
}

// ÖNCELİK 2: devices.current_content (ürün/şablon ataması)
if (!$taskData) {
    $currentContentRaw = (string)($device['current_content'] ?? '');
    $currentContent = $currentContentRaw !== '' ? json_decode($currentContentRaw, true) : null;

    if (is_array($currentContent) && (($currentContent['type'] ?? '') === 'product')) {
        $assignedProductId = (string)($currentContent['product_id'] ?? '');
        $assignedTemplateId = (string)($currentContent['template_id'] ?? '');

        if ($assignedProductId !== '') {
            $assignedProduct = $db->fetch(
                "SELECT id, name, sku, images FROM products WHERE id = ? AND company_id = ?",
                [$assignedProductId, $companyId]
            );

            if ($assignedProduct) {
                $assignedItemCode = (string)($assignedProduct['sku'] ?? $assignedProduct['id'] ?? $assignedProductId);
                $assignedItemName = (string)($assignedProduct['name'] ?? 'Product');
                $assignedDeviceType = $device['type'] ?? 'esl';

                // product_renders'dan bul (template + product)
                $assignedRender = null;
                if ($assignedTemplateId !== '') {
                    $assignedRender = $db->fetch(
                        "SELECT pr.file_path FROM product_renders pr
                         WHERE pr.company_id = ? AND pr.product_id = ? AND pr.template_id = ?
                           AND pr.device_type = ? AND pr.status = 'completed'
                         ORDER BY pr.created_at DESC LIMIT 1",
                        [$companyId, $assignedProductId, $assignedTemplateId, $assignedDeviceType]
                    );
                }

                // template olmadan product bazlı en yeni render
                if (!$assignedRender) {
                    $assignedRender = $db->fetch(
                        "SELECT pr.file_path FROM product_renders pr
                         WHERE pr.company_id = ? AND pr.product_id = ? AND pr.device_type = ?
                           AND pr.status = 'completed'
                         ORDER BY pr.created_at DESC LIMIT 1",
                        [$companyId, $assignedProductId, $assignedDeviceType]
                    );
                }

                if ($assignedRender && !empty($assignedRender['file_path'])) {
                    $taskData = $buildTaskFromImagePath(
                        (string)$assignedRender['file_path'],
                        $clientId,
                        $assignedItemCode,
                        $assignedItemName
                    );
                }

                // render_cache fallback
                if (!$taskData && $assignedTemplateId !== '') {
                    $cacheRow = $db->fetch(
                        "SELECT image_path FROM render_cache
                         WHERE company_id = ? AND product_id = ? AND template_id = ? AND status IN ('ready', 'stale')
                         ORDER BY CASE WHEN status = 'ready' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1",
                        [$companyId, $assignedProductId, $assignedTemplateId]
                    );
                    if ($cacheRow && !empty($cacheRow['image_path'])) {
                        $taskData = $buildTaskFromImagePath(
                            (string)$cacheRow['image_path'],
                            $clientId,
                            $assignedItemCode,
                            $assignedItemName
                        );
                    }
                }

                // product images fallback
                if (!$taskData && !empty($assignedProduct['images'])) {
                    $imageList = is_string($assignedProduct['images'])
                        ? json_decode($assignedProduct['images'], true)
                        : $assignedProduct['images'];

                    if (is_array($imageList) && !empty($imageList[0]) && is_string($imageList[0])) {
                        $firstImage = ltrim($imageList[0], '/');
                        $firstImagePath = (strpos($firstImage, 'storage/') === 0)
                            ? $firstImage
                            : ('storage/' . $firstImage);
                        $taskData = $buildTaskFromImagePath(
                            $firstImagePath,
                            $clientId,
                            $assignedItemCode,
                            $assignedItemName
                        );
                    }
                }
            }
        }
    }
}

// ÖNCELİK 3: Firma geneli en son render (fallback)
if (!$taskData) {
    $deviceType = $device['type'] ?? 'esl';
    $latestRender = $db->fetch(
        "SELECT pr.id, pr.product_id, pr.template_id, pr.file_path
         FROM product_renders pr
         WHERE pr.company_id = ? AND pr.device_type = ? AND pr.status = 'completed'
         ORDER BY pr.created_at DESC LIMIT 1",
        [$companyId, $deviceType]
    );

    if ($latestRender && !empty($latestRender['file_path'])) {
        $renderPath = $latestRender['file_path'];
        if (file_exists(BASE_PATH . '/' . $renderPath)) {
            $productId = $latestRender['product_id'] ?? 'content';
            $productName = 'Content';
            if (!empty($productId) && $productId !== 'content') {
                $prod = $db->fetch("SELECT name, sku FROM products WHERE id = ?", [$productId]);
                if ($prod) {
                    $productName = $prod['name'];
                    $productId = $prod['sku'] ?? $productId;
                }
            }

            $taskData = $buildTaskFromImagePath(
                (string)$renderPath,
                $clientId,
                (string)$productId,
                $productName
            );
        }
    }
}

// --- Last seen güncelle ---
$validator->updateDeviceHeartbeat($deviceId, [
    'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    'version' => $version
]);

// --- URL normalizasyon ---
if (is_array($taskData)) {
    $taskData = $normalizeTaskMediaUrls($taskData);

    // PicturePath URL ise kaldır (firmware local path bekleyebilir)
    if (isset($taskData['LabelPicture']['PictureUrl']) && isset($taskData['LabelPicture']['PicturePath'])) {
        if (preg_match('#^https?://#i', (string)$taskData['LabelPicture']['PicturePath'])) {
            unset($taskData['LabelPicture']['PicturePath']);
        }
    }

    // Video path normalizasyonu
    if (isset($taskData['LabelVideo']['VideoList']) && is_array($taskData['LabelVideo']['VideoList'])) {
        foreach ($taskData['LabelVideo']['VideoList'] as &$videoItem) {
            if (!is_array($videoItem)) continue;
            if (!empty($videoItem['VideoUrl']) && !empty($videoItem['VideoPath'])) {
                if (preg_match('#^https?://#i', (string)$videoItem['VideoPath'])) {
                    unset($videoItem['VideoPath']);
                }
            }
        }
        unset($videoItem);
    }
}

// --- İçerik yok → Otomatik render job oluştur ---
if (!$taskData) {
    // current_content'te product+template varsa ama hiç render yoksa otomatik job oluştur
    $currentContentRaw = (string)($device['current_content'] ?? '');
    $currentContent = $currentContentRaw !== '' ? json_decode($currentContentRaw, true) : null;

    if (is_array($currentContent) && ($currentContent['type'] ?? '') === 'product') {
        $autoProductId = (string)($currentContent['product_id'] ?? '');
        $autoTemplateId = (string)($currentContent['template_id'] ?? '');

        if ($autoProductId !== '' && $autoTemplateId !== '') {
            // Zaten bekleyen job var mı kontrol et
            $existingJob = $db->fetch(
                "SELECT id FROM render_queue WHERE product_id = ? AND template_id = ? AND status IN ('pending', 'processing')
                 ORDER BY created_at DESC LIMIT 1",
                [$autoProductId, $autoTemplateId]
            );

            if (!$existingJob) {
                // Otomatik render-queue job oluştur
                try {
                    $deviceIds = json_encode([$deviceId]);
                    $db->insert('render_queue', [
                        'id' => $db->generateUuid(),
                        'company_id' => $companyId,
                        'job_type' => 'single',
                        'template_id' => $autoTemplateId,
                        'product_id' => $autoProductId,
                        'device_ids' => $deviceIds,
                        'device_count' => 1,
                        'priority' => 'high',
                        'status' => 'pending',
                        'progress' => 0,
                        'devices_total' => 1,
                        'devices_completed' => 0,
                        'devices_failed' => 0,
                        'retry_count' => 0,
                        'max_retries' => 3,
                        'render_params' => json_encode(['source' => 'http_auto_render']),
                        'created_by' => null,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                    error_log("[ESL HTTP content] Auto render-queue job created for device={$deviceId} product={$autoProductId} template={$autoTemplateId}");
                } catch (Exception $e) {
                    error_log("[ESL HTTP content] Auto render-queue job creation failed: " . $e->getMessage());
                }
            }
        }
    }

    Response::json([
        'State' => 'Done',
        'Message' => 'No content available',
        'Number' => '',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ]);
    return;
}

// --- Delta update: aynı Nlast ise içerik değişmemiş ---
if ($nlast > 0 && isset($taskData['Nlast']) && $nlast === $taskData['Nlast']) {
    Response::json([
        'State' => 'Done',
        'Message' => 'Up to date',
        'Number' => '',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ]);
    return;
}

// --- Başarılı yanıt ---
// KRITIK: Data JSON STRING olmalı, obje değil!
$dataString = json_encode($taskData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

Response::json([
    'State' => 'Done',
    'Message' => 'Success',
    'Number' => '',
    'Data' => $dataString,
    'Level' => 0,
    'ErrorColumn' => null
]);
