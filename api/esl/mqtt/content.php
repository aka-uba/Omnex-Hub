<?php
/**
 * MQTT ESL Device Content API (PavoDisplay /openapi/easylabel uyumlu)
 *
 * GET /api/esl/mqtt/content
 * PavoDisplay MQTT modunda icerik senkronizasyonu.
 * Cihaz periyodik olarak bu endpoint'i sorgular.
 *
 * PavoDisplay Request:
 *   GET /api/esl/mqtt/content?appid=xxx&clientid=SN&nlast=0&ts=xxx&version=V3.36&sign=xxx
 *
 * PavoDisplay Response Format (KRITIK: Data bir STRING, JSON objesi degil!):
 * {
 *   "State": "Done",
 *   "Message": "Success",
 *   "Number": "",
 *   "Data": "{\"Id\":\"1\",\"ItemCode\":\"10001\",\"ItemName\":\"Product\",\"LabelPicture\":{\"X\":0,\"Y\":0,\"Width\":800,\"Height\":1280,\"PictureUrl\":\"http://server/image.jpg\",\"PictureMD5\":\"hash\",\"PictureName\":\"image.jpg\"},\"Nlast\":1}",
 *   "Level": 0,
 *   "ErrorColumn": null
 * }
 *
 * ONEMLI FARKLAR:
 * - Data = JSON STRING (stringify edilmis), JSON objesi DEGIL
 * - Gorsel alan adi: PictureUrl (PicturePath degil!)
 * - Nlast: Delta update icin Data icerisinde doner
 */

require_once dirname(dirname(dirname(__DIR__))) . '/config.php';

$db = Database::getInstance();

// Dinamik base URL - APP_URL API context'te /api icerdiginden, bunu kaldir
// Ornek: APP_URL = http://192.168.1.23/market-etiket-sistemi/api -> http://192.168.1.23/market-etiket-sistemi
$serverBaseUrl = preg_replace('#/api$#', '', APP_URL);

// APP_URL stale ise (yanlis host/IP), request host'u ile override et.
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
        // /market-etiket-sistemi/api/index.php -> /market-etiket-sistemi
        $appPath = preg_replace('#/api(?:/index\.php)?$#i', '', rtrim($scriptName, '/')) ?: '';
        if ($appPath !== '' && strpos($appPath, '/') !== 0) {
            $appPath = '/' . $appPath;
        }
    }

    $serverBaseUrl = $scheme . '://' . $requestHost . rtrim((string)$appPath, '/');
}
$serverBasePath = (string)(parse_url($serverBaseUrl, PHP_URL_PATH) ?? '');
$serverBasePath = '/' . trim($serverBasePath, '/');
if ($serverBasePath === '/') {
    $serverBasePath = '';
}
$requestHostNormalized = strtolower((string)(parse_url($serverBaseUrl, PHP_URL_HOST) ?? ''));

// Query parametreleri (GET) - PavoDisplay 'sn' parametresi de desteklenir
$clientId = $_GET['clientId'] ?? $_GET['clientid'] ?? $_GET['sn'] ?? null;
$appId = $_GET['appId'] ?? $_GET['appid'] ?? '';
$sign = $_GET['sign'] ?? '';
$lastPushId = $_GET['push_id'] ?? $_GET['nlast'] ?? null;
$lastVersion = $_GET['version'] ?? null;

// POST body destegi (bazi cihazlar POST ile gonderir)
if (empty($clientId)) {
    $body = json_decode(file_get_contents('php://input'), true);
    if ($body) {
        $clientId = $body['clientId'] ?? $body['clientid'] ?? $body['sn'] ?? null;
        $appId = $body['appId'] ?? $body['appid'] ?? $appId;
        $sign = $body['sign'] ?? $sign;
        $lastPushId = $body['push_id'] ?? $lastPushId;
        $lastVersion = $body['version'] ?? $lastVersion;
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

require_once BASE_PATH . '/services/MqttBrokerService.php';
$mqttService = new MqttBrokerService();
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;

$settings = null;
$strictAuthPassed = false;

if (!empty($appId)) {
    $settings = $mqttService->getSettingsByAppId($appId);
    if ($settings) {
        $strictAuthPassed = true;
        if (!empty($settings['app_secret'])) {
            if (empty($sign)) {
                $strictAuthPassed = false;
            } else {
                $params = $_GET ?: [];
                if (empty($params)) {
                    $params = json_decode(file_get_contents('php://input'), true) ?: [];
                }
                $verified = $mqttService->verifySignByAppId($sign, $params, $appId);
                $strictAuthPassed = (bool)$verified;
            }
        }
    }
}

if (!$strictAuthPassed) {
    $settings = $mqttService->resolveLegacySettingsByDevice($clientId, $remoteIp);
    if ($settings) {
        error_log("[MQTT content] legacy auth fallback appid={$appId} clientId={$clientId} ip={$remoteIp}");
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

// Cihazi bul
$device = $mqttService->findDeviceByClientId($clientId, $settings['company_id']);

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
$companyId = $device['company_id'];
if ($companyId !== ($settings['company_id'] ?? null)) {
    Response::json([
        'State' => 'Fail',
        'Message' => 'Device company mismatch',
        'Number' => 'AUTH_FAILED',
        'Data' => 'null',
        'Level' => 0,
        'ErrorColumn' => null
    ], 403);
}

// nlast parametresi - delta update icin
$nlast = (int)($lastPushId ?? 0);
$screenWidth = $device['screen_width'] ?? 800;
$screenHeight = $device['screen_height'] ?? 1280;

$taskData = null;

$buildTaskFromImagePath = function(string $imagePath, string $clientIdForTask, string $itemCode, string $itemName) use (
    $serverBaseUrl,
    $screenWidth,
    $screenHeight
): ?array {
    $normalizedPath = str_replace('\\', '/', trim($imagePath));
    if ($normalizedPath === '') {
        return null;
    }

    $fullPath = null;
    $relativePath = null;

    if (preg_match('#^https?://#i', $normalizedPath)) {
        // Uzak URL'den md5 hesaplanamayacagi icin bu durumda payload olusturma.
        return null;
    }

    if (strpos($normalizedPath, BASE_PATH) === 0) {
        $fullPath = $normalizedPath;
        $relativePath = ltrim(substr($normalizedPath, strlen(BASE_PATH)), '/');
    } elseif (strpos($normalizedPath, STORAGE_PATH) === 0) {
        $fullPath = $normalizedPath;
        $storageRelative = ltrim(substr($normalizedPath, strlen(STORAGE_PATH)), '/');
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

$rewriteMediaUrl = function (?string $rawUrl) use ($serverBaseUrl, $serverBasePath, $requestHostNormalized): ?string {
    if (!is_string($rawUrl)) {
        return $rawUrl;
    }

    $url = trim($rawUrl);
    if ($url === '' || !preg_match('#^https?://#i', $url)) {
        return $url;
    }

    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) {
        return $url;
    }

    $host = strtolower((string)$parts['host']);
    $path = (string)($parts['path'] ?? '');
    $query = isset($parts['query']) ? ('?' . $parts['query']) : '';
    $fragment = isset($parts['fragment']) ? ('#' . $parts['fragment']) : '';
    $isLocalHost = in_array($host, ['localhost', '127.0.0.1', '::1'], true);

    if (!$isLocalHost && $requestHostNormalized !== '' && $host === $requestHostNormalized) {
        return $url;
    }

    $pathMatchesBase = $serverBasePath !== '' && strpos($path, $serverBasePath . '/') === 0;
    $pathLooksInternal = $pathMatchesBase
        || strpos($path, '/storage/') !== false
        || strpos($path, '/public/') !== false;

    if (!$isLocalHost && !$pathLooksInternal) {
        return $url;
    }

    $relativePath = ltrim($path, '/');
    if ($serverBasePath !== '' && strpos($path, $serverBasePath . '/') === 0) {
        $relativePath = ltrim(substr($path, strlen($serverBasePath)), '/');
    }

    return rtrim($serverBaseUrl, '/') . '/' . $relativePath . $query . $fragment;
};

$normalizeTaskMediaUrls = function (array $task) use ($rewriteMediaUrl): array {
    if (isset($task['LabelPicture']) && is_array($task['LabelPicture'])) {
        if (!empty($task['LabelPicture']['PictureUrl'])) {
            $task['LabelPicture']['PictureUrl'] = $rewriteMediaUrl((string)$task['LabelPicture']['PictureUrl']);
        }
        if (!empty($task['LabelPicture']['PicturePath'])) {
            $task['LabelPicture']['PicturePath'] = $rewriteMediaUrl((string)$task['LabelPicture']['PicturePath']);
        }
    }

    if (isset($task['LabelVideo']['VideoList']) && is_array($task['LabelVideo']['VideoList'])) {
        foreach ($task['LabelVideo']['VideoList'] as $index => $videoItem) {
            if (!is_array($videoItem)) {
                continue;
            }

            if (!empty($videoItem['VideoUrl'])) {
                $videoItem['VideoUrl'] = $rewriteMediaUrl((string)$videoItem['VideoUrl']);
            }
            if (!empty($videoItem['VideoPath'])) {
                $videoItem['VideoPath'] = $rewriteMediaUrl((string)$videoItem['VideoPath']);
            }

            $task['LabelVideo']['VideoList'][$index] = $videoItem;
        }
    }

    return $task;
};

// ============================================================
// ONCELIK 1: Cihaza ozel icerik atamasi (device_content_assignments)
// render.php bu tabloya cihaz bazli atama yapar
// ============================================================
$assignment = $db->fetch(
    "SELECT dca.id, dca.content_type, dca.content_id, dca.created_at
     FROM device_content_assignments dca
     WHERE dca.device_id = ? AND dca.status = 'active'
     ORDER BY dca.created_at DESC
     LIMIT 1",
    [$deviceId]
);

if ($assignment && $assignment['content_id']) {
    if (($assignment['content_type'] ?? '') === 'mqtt_payload') {
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

    // content_id -> product_renders tablosundaki render'i bul
    $render = null;
    if (!$taskData) {
        $render = $db->fetch(
            "SELECT pr.id, pr.product_id, pr.template_id, pr.file_path, pr.render_hash
             FROM product_renders pr
             WHERE pr.id = ? AND pr.status = 'completed'",
            [$assignment['content_id']]
        );
    }

    if ($render && !empty($render['file_path'])) {
        $renderPath = $render['file_path'];
        $fullPath = BASE_PATH . '/' . $renderPath;

        if (file_exists($fullPath)) {
            $md5 = md5_file($fullPath);
            $fileName = basename($renderPath);

            // Urun bilgisi
            $productId = $render['product_id'] ?? 'content';
            $productName = 'Content';
            if (!empty($productId) && $productId !== 'content') {
                $prod = $db->fetch("SELECT name, sku FROM products WHERE id = ?", [$productId]);
                if ($prod) {
                    $productName = $prod['name'];
                    $productId = $prod['sku'] ?? $productId;
                }
            }

            $pictureUrl = rtrim($serverBaseUrl, '/') . '/' . $renderPath;
            $newNlast = crc32($md5) & 0x7FFFFFFF;

            $taskData = [
                'Id' => $clientId,
                'ItemCode' => (string)$productId,
                'ItemName' => $productName,
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

    // content_id product_renders'da degilse media tablosunda ara (direkt medya atamasi)
    if (!$taskData && $assignment['content_type'] === 'image') {
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

// ============================================================
// ONCELIK 2: Cihazin current_content atamasindan gorev olustur
// assign-label akisi device_content_assignments yazmamis olsa bile
// cihazin atanmis urun/sablonu buradan bulunup icerik uretilir.
// ============================================================
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

                // 1) product_renders (template + product)
                $assignedRender = null;
                if ($assignedTemplateId !== '') {
                    $assignedRender = $db->fetch(
                        "SELECT pr.file_path
                         FROM product_renders pr
                         WHERE pr.company_id = ?
                           AND pr.product_id = ?
                           AND pr.template_id = ?
                           AND pr.device_type = ?
                           AND pr.status = 'completed'
                         ORDER BY pr.created_at DESC
                         LIMIT 1",
                        [$companyId, $assignedProductId, $assignedTemplateId, $assignedDeviceType]
                    );
                }

                // 2) template olmadan product bazli en yeni render
                if (!$assignedRender) {
                    $assignedRender = $db->fetch(
                        "SELECT pr.file_path
                         FROM product_renders pr
                         WHERE pr.company_id = ?
                           AND pr.product_id = ?
                           AND pr.device_type = ?
                           AND pr.status = 'completed'
                         ORDER BY pr.created_at DESC
                         LIMIT 1",
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

                // 3) render_cache fallback (render_jobs uretimi sonrasi)
                if (!$taskData && $assignedTemplateId !== '') {
                    $cacheRow = $db->fetch(
                        "SELECT image_path
                         FROM render_cache
                         WHERE company_id = ?
                           AND product_id = ?
                           AND template_id = ?
                           AND status = 'ready'
                         ORDER BY updated_at DESC
                         LIMIT 1",
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

                // 4) product images fallback
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

// ============================================================
// ONCELIK 3: Fallback - Firma genelindeki en son render
// (Cihaza ozel ve atama kaynakli icerik yoksa en yeni completed render)
// ============================================================
if (!$taskData) {
    $deviceType = $device['type'] ?? 'esl';
    $latestRender = $db->fetch(
        "SELECT pr.id, pr.product_id, pr.template_id, pr.file_path, pr.render_hash
         FROM product_renders pr
         WHERE pr.company_id = ? AND pr.device_type = ? AND pr.status = 'completed'
         ORDER BY pr.created_at DESC
         LIMIT 1",
        [$companyId, $deviceType]
    );

    if ($latestRender && !empty($latestRender['file_path'])) {
        $renderPath = $latestRender['file_path'];
        if (file_exists(BASE_PATH . '/' . $renderPath)) {
            $md5 = md5_file(BASE_PATH . '/' . $renderPath);
            $fileName = basename($renderPath);

            $productId = $latestRender['product_id'] ?? 'content';
            $productName = 'Content';
            if (!empty($productId) && $productId !== 'content') {
                $prod = $db->fetch("SELECT name, sku FROM products WHERE id = ?", [$productId]);
                if ($prod) {
                    $productName = $prod['name'];
                    $productId = $prod['sku'] ?? $productId;
                }
            }

            $pictureUrl = rtrim($serverBaseUrl, '/') . '/' . $renderPath;
            $newNlast = crc32($md5) & 0x7FFFFFFF;

            $taskData = [
                'Id' => $clientId,
                'ItemCode' => (string)$productId,
                'ItemName' => $productName,
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

// Last seen guncelle
$db->update('devices', [
    'last_seen' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$deviceId]);

// MQTT content uyumluluk normalizasyonu:
// HTTP URL tasinirken *Path alanlari URL ise bazi firmware'ler local path bekleyebilir.
// Bu durumda Url alanlarini tercih etmeleri icin URL olan Path alanlarini cikar.
if (is_array($taskData)) {
    $taskData = $normalizeTaskMediaUrls($taskData);

    if (isset($taskData['LabelPicture']) && is_array($taskData['LabelPicture'])) {
        if (
            !empty($taskData['LabelPicture']['PictureUrl'])
            && !empty($taskData['LabelPicture']['PicturePath'])
            && preg_match('#^https?://#i', (string)$taskData['LabelPicture']['PicturePath'])
        ) {
            unset($taskData['LabelPicture']['PicturePath']);
        }
    }

    if (isset($taskData['LabelVideo']['VideoList']) && is_array($taskData['LabelVideo']['VideoList'])) {
        foreach ($taskData['LabelVideo']['VideoList'] as &$videoItem) {
            if (!is_array($videoItem)) {
                continue;
            }
            if (
                !empty($videoItem['VideoUrl'])
                && !empty($videoItem['VideoPath'])
                && preg_match('#^https?://#i', (string)$videoItem['VideoPath'])
            ) {
                unset($videoItem['VideoPath']);
            }
        }
        unset($videoItem);
    }
}

// Icerik yoksa bos Data don
if (!$taskData) {
    $hasCurrentContent = !empty($device['current_content']) ? 'yes' : 'no';
    error_log("[MQTT content] no content device={$deviceId} clientId={$clientId} company={$companyId} has_current_content={$hasCurrentContent}");
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

// Delta update: ayni Nlast ise icerik degismemis
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

// PavoDisplay resmi content response formati
// KRITIK: Data bir JSON STRING olmali, obje/array degil!
// Cihaz Data string'ini parse ederek PictureUrl'den gorseli indirir
$dataString = json_encode($taskData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

Response::json([
    'State' => 'Done',
    'Message' => 'Success',
    'Number' => '',
    'Data' => $dataString,
    'Level' => 0,
    'ErrorColumn' => null
]);
