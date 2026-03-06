<?php
/**
 * Render Queue API - İşleri İşle
 *
 * POST /api/render-queue/process
 *
 * Bekleyen işleri işler. Frontend'den periyodik olarak çağrılabilir.
 * Her çağrıda bir iş alır ve işler.
 *
 * Request:
 *   { "max_jobs": 1 }  // Opsiyonel, varsayılan 1
 *
 * Response:
 *   {
 *     "success": true,
 *     "jobs_processed": 1,
 *     "devices_sent": 3,
 *     "devices_failed": 0,
 *     "has_more": true
 *   }
 */

require_once BASE_PATH . '/services/RenderQueueService.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';
require_once BASE_PATH . '/services/RenderCacheService.php';

$db = Database::getInstance();
// Use global request if available (has route params), otherwise create new
$request = $GLOBALS['request'] ?? new Request();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$data = $request->all();
$maxJobs = min(5, max(1, (int)($data['max_jobs'] ?? 1)));
$now = date('Y-m-d H:i:s');

$queueService = new RenderQueueService();

// İstatistikler
$jobsProcessed = 0;
$devicesSent = 0;
$devicesFailed = 0;
$devicesSkipped = 0;
$results = [];

// Gateway ayarını kontrol et
$gatewayEnabled = true;
$companySettings = $db->fetch(
    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);
if ($companySettings && !empty($companySettings['data'])) {
    $settingsData = json_decode($companySettings['data'], true);
    if (isset($settingsData['gateway_enabled'])) {
        $gatewayEnabled = (bool)$settingsData['gateway_enabled'];
    }
}
$userSettings = $db->fetch(
    "SELECT data FROM settings WHERE user_id = ?",
    [$user['id']]
);
if ($userSettings && !empty($userSettings['data'])) {
    $userSettingsData = json_decode($userSettings['data'], true);
    if (isset($userSettingsData['gateway_enabled'])) {
        $gatewayEnabled = (bool)$userSettingsData['gateway_enabled'];
    }
}

// İşleri al ve işle
for ($i = 0; $i < $maxJobs; $i++) {
    $job = $queueService->dequeue($companyId);

    if (!$job) {
        break; // Bekleyen iş yok
    }

    $jobsProcessed++;
    $jobResult = [
        'job_id' => $job['id'],
        'devices_sent' => 0,
        'devices_failed' => 0,
        'devices_skipped' => 0,
        'errors' => []
    ];

    try {
        // Template ve ürün bilgisini al
        $template = null;
        $product = null;

        if (!empty($job['template_id'])) {
            $template = $db->fetch(
                "SELECT id, name, design_data, type, target_device_type,
                        render_image, preview_image, template_file, width, height,
                        grid_layout, regions_config,
                        responsive_mode, scale_policy, design_width, design_height
                 FROM templates WHERE id = ?",
                [$job['template_id']]
            );
        }

        if (!empty($job['product_id'])) {
            $product = $db->fetch(
                "SELECT * FROM products WHERE id = ?",
                [$job['product_id']]
            );

            // HAL Künye verilerini urune ekle
            if ($product) {
                $halData = $db->fetch(
                    "SELECT * FROM product_hal_data WHERE product_id = ? AND company_id = ?",
                    [$job['product_id'], $companyId]
                );
                if ($halData) {
                    if (!empty($halData['gecmis_bildirimler']) && is_string($halData['gecmis_bildirimler'])) {
                        $decodedHistory = json_decode($halData['gecmis_bildirimler'], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $halData['gecmis_bildirimler'] = $decodedHistory;
                        }
                    }
                    if (!empty($halData['hal_raw_data']) && is_string($halData['hal_raw_data'])) {
                        $decodedRaw = json_decode($halData['hal_raw_data'], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $halData['hal_raw_data'] = $decodedRaw;
                        }
                    }

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
                    $product['hal_data'] = $halData;
                }
            }
        }

        // Cihazları al
        $pendingItems = $queueService->getPendingItems($job['id'], 100);

        if (empty($pendingItems)) {
            // Tüm cihazlar işlenmiş, job'ı tamamla
            $queueService->completeQueue($job['id']);
            continue;
        }

        // PavoDisplayGateway ile gönder (gateway ayarından bağımsız - doğrudan HTTP)
        // Not: gateway_enabled ayarı sadece Gateway Agent kullanımı için,
        // doğrudan cihaz iletişimi her zaman çalışmalı
        $gateway = new PavoDisplayGateway();

        foreach ($pendingItems as $item) {
            $startTime = microtime(true);

            try {
                // Item'ı processing olarak işaretle
                $claimed = $db->update('render_queue_items', [
                    'status' => 'processing',
                    'started_at' => date('Y-m-d H:i:s')
                ], 'id = ? AND status = ?', [$item['id'], 'pending']);

                // Başka bir worker/process zaten aldıysa skip et
                if ($claimed <= 0) {
                    continue;
                }

                // Cihaz bilgisini al (gateway bilgisi ile birlikte)
                $device = $db->fetch(
                    "SELECT d.*, gd.gateway_id, gd.local_ip as gateway_local_ip,
                            gw.name as gateway_name, gw.status as gateway_status,
                            gw.last_heartbeat as gateway_last_heartbeat
                     FROM devices d
                     LEFT JOIN gateway_devices gd ON d.id = gd.device_id
                     LEFT JOIN gateways gw ON gd.gateway_id = gw.id
                     WHERE d.id = ?",
                    [$item['device_id']]
                );

                $isHanshowEsl = isHanshowDeviceRow(is_array($device) ? $device : []);

                if (!$device) {
                    throw new Exception('Cihaz bulunamadı');
                }

                $communicationMode = $device['communication_mode'] ?? 'http-server';
                if ($communicationMode !== 'mqtt' && empty($device['ip_address']) && !$isHanshowEsl) {
                    throw new Exception('Cihaz IP adresi yok');
                }

                // Render işlemi yap (protokole göre processForPavoDisplay içinde dispatch edilir)
                $renderResult = processDeviceRender($db, $gateway, $device, $template, $product, $job, $item, $gatewayEnabled);

                $durationMs = (int)((microtime(true) - $startTime) * 1000);

                if ($renderResult['success']) {
                    $isGatewayQueued = !empty($renderResult['via_gateway']) && !empty($renderResult['queued']);
                    $queueService->updateItemStatus(
                        $item['id'],
                        $isGatewayQueued ? 'processing' : 'completed',
                        null,
                        $durationMs,
                        $renderResult['md5'] ?? null
                    );
                    $jobResult['devices_sent']++;
                    $devicesSent++;
                } else {
                    $queueService->updateItemStatus(
                        $item['id'],
                        'failed',
                        $renderResult['error'] ?? 'Bilinmeyen hata',
                        $durationMs
                    );
                    $jobResult['devices_failed']++;
                    $jobResult['errors'][] = [
                        'device_id' => $item['device_id'],
                        'error' => $renderResult['error']
                    ];
                    $devicesFailed++;
                }

            } catch (Exception $e) {
                $durationMs = (int)((microtime(true) - $startTime) * 1000);
                $queueService->updateItemStatus(
                    $item['id'],
                    'failed',
                    $e->getMessage(),
                    $durationMs
                );
                $jobResult['devices_failed']++;
                $jobResult['errors'][] = [
                    'device_id' => $item['device_id'],
                    'error' => $e->getMessage()
                ];
                $devicesFailed++;
            }
        }

        // Progress güncelle
        $progressState = $queueService->updateQueueProgress($job['id']);

        // Basarisiz cihazlar icin otomatik retry planla.
        // Not: auto_send / bulk_send job'larinda sonsuz tekrar hissini engellemek icin
        // otomatik retry kapali, bu tiplerde retry manuel aksiyonla tetiklenir.
        $jobType = (string)($job['job_type'] ?? '');
        $autoRetryDisabledForJobType = in_array($jobType, ['auto_send', 'bulk_send'], true);
        if (
            !$autoRetryDisabledForJobType
            && ($progressState['failed'] ?? 0) > 0
            && ($progressState['pending'] ?? 0) === 0
        ) {
            $failedItem = $db->fetch(
                "SELECT error_type, last_error
                 FROM render_queue_items
                 WHERE queue_id = ? AND status = 'failed'
                 ORDER BY retry_count DESC, completed_at DESC
                 LIMIT 1",
                [$job['id']]
            );

            $errorType = $failedItem['error_type'] ?? null;
            if (!$errorType && !empty($failedItem['last_error'])) {
                $errorType = $queueService->detectErrorType($failedItem['last_error']);
            }

            $queueService->scheduleRetry($job['id'], $errorType ?: 'unknown');
        }

    } catch (Exception $e) {
        // Job seviyesinde hata
        $db->update('render_queue', [
            'status' => 'failed',
            'error_message' => $e->getMessage(),
            'completed_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$job['id']]);

        $jobResult['errors'][] = ['job_error' => $e->getMessage()];
    }

    $results[] = $jobResult;
}

// Hala bekleyen iş var mı?
$pendingCount = $db->fetch(
    "SELECT COUNT(*) as count FROM render_queue
     WHERE company_id = ? AND status = 'pending'
       AND (scheduled_at IS NULL OR scheduled_at <= ?)
       AND (next_retry_at IS NULL OR next_retry_at <= ?)",
    [$companyId, $now, $now]
)['count'] ?? 0;

$processingCount = $db->fetch(
    "SELECT COUNT(*) as count
     FROM render_queue q
     WHERE q.company_id = ?
       AND q.status = 'processing'
       AND (
            (q.started_at IS NOT NULL AND q.started_at >= (CURRENT_TIMESTAMP - INTERVAL '10 minutes'))
            OR EXISTS (
                SELECT 1
                FROM render_queue_items qi
                WHERE qi.queue_id = q.id
                  AND qi.status IN ('pending', 'processing')
                LIMIT 1
            )
       )",
    [$companyId]
)['count'] ?? 0;

$response = [
    'jobs_processed' => $jobsProcessed,
    'devices_sent' => $devicesSent,
    'devices_failed' => $devicesFailed,
    'devices_skipped' => $devicesSkipped,
    'has_more' => $pendingCount > 0,
    'pending_count' => $pendingCount,
    'processing_count' => $processingCount,
    'gateway_enabled' => $gatewayEnabled,
    'results' => $results
];

Response::success($response);

/**
 * Cihaza render gönder
 */
function processDeviceRender($db, $gateway, $device, $template, $product, $job, $queueItem = null, $gatewayEnabled = true): array
{
    $isHanshowEsl = isHanshowDeviceRow($device);
    $isPavoDisplay = isPavoDisplayDeviceRow($device);

    // Cihaz tipine göre işlem (legacy/fallback bilgi)
    $deviceType = !empty($device['model'])
        ? $device['model']
        : ($device['type'] ?? 'esl');
    $deviceTypeNorm = strtolower(trim((string)$deviceType));

    // Job'dan rendered_image_path al (Frontend pre-rendered image)
    $preRenderedImagePath = $job['rendered_image_path'] ?? null;

    // Job'dan company_id al (render_cache kontrolü için)
    $companyId = $job['company_id'] ?? $device['company_id'] ?? null;
    $queueId = $job['id'] ?? null;
    $queueItemId = is_array($queueItem) ? ($queueItem['id'] ?? null) : null;

    // Gateway routing kararı
    $gatewayId = $device['gateway_id'] ?? null;
    $gatewayOnline = ($device['gateway_status'] ?? '') === 'online';
    $gatewayLastHeartbeat = $device['gateway_last_heartbeat'] ?? null;

    // Eğer gateway_devices'dan gateway bulunamadıysa, firmanın aktif gateway'ini ara
    if (!$gatewayId && $companyId) {
        $companyGateway = $db->fetch(
            "SELECT id, name, status, last_heartbeat
             FROM gateways
             WHERE company_id = ? AND status = 'online'
             ORDER BY last_heartbeat DESC
             LIMIT 1",
            [$companyId]
        );

        if ($companyGateway) {
            $gatewayId = $companyGateway['id'];
            $gatewayOnline = true;
            $gatewayLastHeartbeat = $companyGateway['last_heartbeat'];
        }
    }

    // Heartbeat kontrolü: Son 2 dakika içinde heartbeat yoksa gateway kapalı kabul et
    $gatewayHeartbeatOk = false;
    if ($gatewayOnline && !empty($gatewayLastHeartbeat)) {
        $lastHeartbeat = strtotime($gatewayLastHeartbeat);
        $heartbeatAge = time() - $lastHeartbeat;
        $gatewayHeartbeatOk = $heartbeatAge <= 120; // 2 dakika

    }

    // Eğer cihaz eski gateway'e bağlıysa ama heartbeat stale ise, aktif gateway'e fallback
    if ($companyId && $gatewayId && (!$gatewayOnline || !$gatewayHeartbeatOk)) {
        $companyGateway = $db->fetch(
            "SELECT id, name, status, last_heartbeat
             FROM gateways
             WHERE company_id = ? AND status = 'online'
             ORDER BY last_heartbeat DESC
             LIMIT 1",
            [$companyId]
        );

        if ($companyGateway && $companyGateway['id'] !== $gatewayId) {
            $gatewayId = $companyGateway['id'];
            $gatewayOnline = true;
            $gatewayLastHeartbeat = $companyGateway['last_heartbeat'];
            $lastHeartbeat = strtotime($gatewayLastHeartbeat);
            $heartbeatAge = time() - $lastHeartbeat;
            $gatewayHeartbeatOk = $heartbeatAge <= 120;
        }
    }

    $useGateway = $gatewayEnabled && $gatewayId && $gatewayOnline && $gatewayHeartbeatOk;

    // PavoDisplay (Android ESL)
    if ($isPavoDisplay) {
        return processForPavoDisplay(
            $db,
            $gateway,
            $device,
            $template,
            $product,
            $preRenderedImagePath,
            $useGateway,
            $gatewayId,
            $companyId,
            $gatewayEnabled,
            $queueId,
            $queueItemId,
            $device['communication_mode'] ?? 'http-server'
        );
    }

    // Hanshow ESL (RF tabanli)
    if ($isHanshowEsl) {
        return processForHanshowESL($db, $device, $template, $product, $preRenderedImagePath, $companyId);
    }

    // PWA Player / TV
    if (in_array($deviceTypeNorm, ['android_tv', 'web_display', 'pwa_player', 'tv'])) {
        return processForPWAPlayer($db, $device, $template, $product);
    }

    // Varsayılan: Simülasyon
    return [
        'success' => true,
        'md5' => md5(json_encode(['device' => $device['id'], 'time' => time()])),
        'message' => 'Simüle edildi (desteklenmeyen cihaz tipi)'
    ];
}

function normalizeDeviceValue($value): string
{
    return strtolower(trim((string)$value));
}

function isHanshowDeviceRow(array $device): bool
{
    $model = normalizeDeviceValue($device['model'] ?? '');
    $adapterId = normalizeDeviceValue($device['adapter_id'] ?? '');
    $manufacturer = normalizeDeviceValue($device['manufacturer'] ?? '');
    $deviceBrand = normalizeDeviceValue($device['device_brand'] ?? '');

    if ($model === 'hanshow_esl') {
        return true;
    }
    if ($adapterId === 'hanshow') {
        return true;
    }
    if (strpos($manufacturer, 'hanshow') !== false) {
        return true;
    }
    return strpos($deviceBrand, 'hanshow') !== false;
}

function isPavoDisplayDeviceRow(array $device): bool
{
    if (isHanshowDeviceRow($device)) {
        return false;
    }

    $model = normalizeDeviceValue($device['model'] ?? '');
    $adapterId = normalizeDeviceValue($device['adapter_id'] ?? '');
    $manufacturer = normalizeDeviceValue($device['manufacturer'] ?? '');
    $deviceBrand = normalizeDeviceValue($device['device_brand'] ?? '');
    $type = normalizeDeviceValue($device['type'] ?? '');

    if ($adapterId === 'pavodisplay') {
        return true;
    }
    if (in_array($model, ['esl_android', 'pd1010-ii', 'pavodisplay', 'esl_rtos'], true)) {
        return true;
    }
    if (strpos($manufacturer, 'pavo') !== false || strpos($manufacturer, 'pavodisplay') !== false) {
        return true;
    }
    if (strpos($deviceBrand, 'pavo') !== false) {
        return true;
    }
    return $type === 'esl';
}

/**
 * Medya dosya yolunu çöz - URL veya yerel dosya (render.php'den alındı)
 */
function resolveMediaPath($mediaPath, $type = 'video', $tempDir = null, $companyId = null) {
    if (empty($mediaPath)) return null;
    if (!$tempDir) $tempDir = STORAGE_PATH . '/renders';

    // 1. serve.php proxy URL'sini çöz
    if (strpos($mediaPath, 'serve.php') !== false && strpos($mediaPath, 'path=') !== false) {
        $parsed = parse_url($mediaPath);
        if (isset($parsed['query'])) {
            parse_str($parsed['query'], $queryParams);
            if (isset($queryParams['path'])) {
                $mediaPath = urldecode($queryParams['path']);
            }
        }
    }

    // 2. Base path'leri temizle
    $knownBasePaths = ['/market-etiket-sistemi', '/signage', '/omnex', '/display-hub'];
    if (defined('BASE_PATH')) {
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
        $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
        $fsBasePath = str_replace('\\', '/', BASE_PATH);
        if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
            $currentBasePath = substr($fsBasePath, strlen($docRoot));
            $currentBasePath = rtrim($currentBasePath, '/');
            if ($currentBasePath && !in_array($currentBasePath, $knownBasePaths)) {
                $knownBasePaths[] = $currentBasePath;
            }
        }
    }

    foreach ($knownBasePaths as $basePath) {
        if (strpos($mediaPath, $basePath . '/') === 0) {
            $mediaPath = substr($mediaPath, strlen($basePath));
            break;
        }
    }

    // 3. /storage/ ile başlıyorsa
    if (preg_match('/^\/storage\/(.+)$/i', $mediaPath, $matches)) {
        $mediaPath = $matches[1];
    }

    // 4. HTTP/HTTPS URL ise indir
    if (preg_match('/^https?:\/\//i', $mediaPath)) {
        $extension = pathinfo(parse_url($mediaPath, PHP_URL_PATH), PATHINFO_EXTENSION) ?: ($type === 'video' ? 'mp4' : 'jpg');
        $tempFile = $tempDir . '/' . uniqid($type . '_') . '.' . $extension;

        $ch = curl_init($mediaPath);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $content = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = (string)(curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?? '');
        curl_close($ch);

        if ($httpCode === 200 && $content && strlen($content) > 0) {
            $head = strtolower(ltrim(substr((string)$content, 0, 64)));
            $looksLikeTextError = $head !== '' && (
                str_starts_with($head, '<!doctype html') ||
                str_starts_with($head, '<html') ||
                str_starts_with($head, '{"error"') ||
                str_starts_with($head, '{"success":false')
            );
            if (preg_match('#(text/html|application/json)#i', $contentType) || $looksLikeTextError) {
                return null;
            }
            if (file_put_contents($tempFile, $content)) {
                return $tempFile;
            }
        }
        return null;
    }

    // 5. Yerel path için olası yolları dene
    $possiblePaths = [
        $mediaPath,
        STORAGE_PATH . '/' . ltrim($mediaPath, '/'),
        BASE_PATH . '/' . ltrim($mediaPath, '/'),
        STORAGE_PATH . '/' . ltrim(preg_replace('/^storage\//i', '', $mediaPath), '/'),
        BASE_PATH . '/public/' . ltrim($mediaPath, '/'),
        STORAGE_PATH . '/uploads/' . ltrim($mediaPath, '/'),
        STORAGE_PATH . '/media/' . basename($mediaPath),
        STORAGE_PATH . '/videos/' . basename($mediaPath),
        STORAGE_PATH . '/images/' . basename($mediaPath)
    ];

    // Firma bazlı yolları ekle (multi-tenant)
    if ($companyId) {
        $companyBase = STORAGE_PATH . '/companies/' . $companyId;
        $possiblePaths = array_merge([
            $companyBase . '/media/images/' . basename($mediaPath),
            $companyBase . '/media/videos/' . basename($mediaPath),
            $companyBase . '/media/' . basename($mediaPath),
            $companyBase . '/templates/renders/' . basename($mediaPath),
            $companyBase . '/' . ltrim($mediaPath, '/'),
        ], $possiblePaths);
    }

    foreach ($possiblePaths as $path) {
        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        if (file_exists($path) && is_file($path)) {
            return $path;
        }
    }

    return null;
}

/**
 * Gateway'in uzaktan erisebilecegi base URL'i uret.
 */
function gatewayPublicBaseUrl(): string
{
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $scheme = (!empty($forwardedProto))
        ? trim(explode(',', $forwardedProto)[0])
        : ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');

    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? '');
    if ($host === '') {
        return defined('APP_URL') ? rtrim(APP_URL, '/') : '';
    }

    $basePath = '';
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
    $fsBasePath = str_replace('\\', '/', BASE_PATH);
    if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
        $basePath = substr($fsBasePath, strlen($docRoot));
        $basePath = rtrim($basePath, '/');
    }

    // API endpoint'ten hesaplanmissa /api sonunu temizle.
    if ($basePath === '/api') {
        $basePath = '';
    } elseif (substr($basePath, -4) === '/api') {
        $basePath = substr($basePath, 0, -4);
    }

    return rtrim($scheme . '://' . $host . $basePath, '/');
}

/**
 * Verilen path'ten storage altindaki relative yolu cikar.
 */
function gatewayExtractStorageRelativePath(string $path): ?string
{
    $normalized = str_replace('\\', '/', trim($path));
    if ($normalized === '') {
        return null;
    }

    // URL geldiyse /storage/ segmentinden relative yolu al.
    if (preg_match('/^https?:\/\//i', $normalized)) {
        $urlPath = parse_url($normalized, PHP_URL_PATH) ?: '';
        $storagePos = stripos($urlPath, '/storage/');
        if ($storagePos !== false) {
            $relativeStorage = substr($urlPath, $storagePos + strlen('/storage/'));
            return ltrim($relativeStorage, '/');
        }
        return null;
    }

    // Relative veya absolute storage path.
    if (strpos($normalized, '/storage/') === 0 || strpos($normalized, 'storage/') === 0) {
        $relativeStorage = preg_replace('#^/?storage/#i', '', $normalized);
        return ltrim($relativeStorage, '/');
    }

    // Lokal dosya yolunu realpath ile storage altina map et.
    $realPath = realpath($path) ?: null;
    if (!$realPath && file_exists($path)) {
        $realPath = $path;
    }
    if (!$realPath) {
        return null;
    }

    $realNormalized = str_replace('\\', '/', $realPath);
    $storageNormalized = rtrim(str_replace('\\', '/', STORAGE_PATH), '/');
    $storagePrefix = $storageNormalized . '/';
    if (strpos($realNormalized, $storagePrefix) === 0) {
        $relativeStorage = substr($realNormalized, strlen($storagePrefix));
        return ltrim($relativeStorage, '/');
    }

    return null;
}

/**
 * Gateway'in indirebilmesi icin signed media URL olustur.
 */
function gatewayBuildSignedMediaUrl(string $relativeStorage): ?string
{
    $baseUrl = gatewayPublicBaseUrl();
    if ($baseUrl === '') {
        return null;
    }

    $relativeStorage = ltrim(str_replace('\\', '/', $relativeStorage), '/');
    if ($relativeStorage === '') {
        return null;
    }

    // Komut kuyrukta bekleyebilecegi icin token suresi bir miktar uzun tutuluyor.
    $expiresAt = time() + 43200; // 12 saat
    $signature = hash_hmac('sha256', $relativeStorage . '|' . $expiresAt, JWT_SECRET);

    return $baseUrl . '/api/media/serve.php?path=' . rawurlencode($relativeStorage)
        . '&exp=' . $expiresAt
        . '&sig=' . $signature;
}

/**
 * Local dosya yolunu gateway icin public URL'e cevir.
 */
function gatewayMediaPathToUrl(?string $path): ?string
{
    if (empty($path)) {
        return null;
    }

    $relativeStorage = gatewayExtractStorageRelativePath($path);
    if ($relativeStorage !== null) {
        return gatewayBuildSignedMediaUrl($relativeStorage);
    }

    $normalized = str_replace('\\', '/', $path);
    if (preg_match('/^https?:\/\//i', $normalized)) {
        return $normalized;
    }

    return null;
}

/**
 * PavoDisplay için işlem (Video + Image destekli)
 *
 * NOT: İşlem esnasında render yapılmaz!
 * Öncelik sırası:
 * 1. preRenderedImagePath - Frontend canvas ile render edilmiş görsel (en kaliteli)
 * 2. render_image - Editörde kaydedilen statik render
 * 3. preview_image - Şablon önizleme görseli
 * 4. screen.png - Tasarım klasöründeki hazır görsel
 *
 * @param Database $db Veritabanı bağlantısı
 * @param mixed $gateway PavoDisplayGateway instance
 * @param array $device Cihaz bilgisi
 * @param array|null $template Şablon bilgisi
 * @param array|null $product Ürün bilgisi
 * @param string|null $preRenderedImagePath Frontend'den gelen pre-rendered görsel path'i
 * @param bool $useGateway Gateway üzerinden mi gönderilecek
 * @param string|null $gatewayId Gateway ID
 * @param string|null $companyId Firma ID (render_cache kontrolü için)
 */
function processForPavoDisplay(
    $db,
    $gateway,
    $device,
    $template,
    $product,
    ?string $preRenderedImagePath = null,
    bool $useGateway = false,
    ?string $gatewayId = null,
    ?string $companyId = null,
    bool $gatewayEnabled = true,
    ?string $queueId = null,
    ?string $queueItemId = null,
    string $communicationMode = 'http-server'
): array
{
    // Opsiyonel detay log (varsayılan kapalı)
    $enablePavoTraceLog = false;
    $logFile = STORAGE_PATH . '/logs/pavo_process.log';
    $log = function($msg) use ($logFile, $enablePavoTraceLog) {
        if (!$enablePavoTraceLog) {
            return;
        }
        file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] $msg\n", FILE_APPEND);
    };
    $log("=== processForPavoDisplay BAŞLADI ===");

    $ip = $device['ip_address'];
    $clientId = $device['device_id'] ?? $device['serial_number'] ?? 'unknown';
    $log("IP: $ip, ClientID: $clientId");
    $log("useGateway: " . ($useGateway ? 'EVET' : 'HAYIR') . ", gatewayId: " . ($gatewayId ?? 'YOK'));

    $isMqttMode = ($communicationMode === 'mqtt');
    $isHttpPullMode = ($communicationMode === 'http');

    // Direct modda ping sadece bilgi amacli; karar mekanizmasini degistirmez.
    // Gateway kapali/stale ise local gonderim her durumda denenir.
    if (!$useGateway && !$isMqttMode && !$isHttpPullMode) {
        $pingResult = $gateway->ping($ip);
        if (!$pingResult['online']) {
            $log("Ping basarisiz, direct gonderim yine de denenecek. IP: " . $ip);
        }
    }

    // Cihaz boyutları
    $deviceWidth = (int)($device['screen_width'] ?? $template['width'] ?? 800);
    $deviceHeight = (int)($device['screen_height'] ?? $template['height'] ?? 1280);

    // Template ve ürün varsa etiket gönder
    // Multi-product composite gönderimlerinde product null olabilir, pre-rendered image varsa devam et
    if ($template && ($product || $preRenderedImagePath)) {
        // Multi-product composite: product null, sahte product bilgisi oluştur
        if (!$product) {
            $product = ['id' => null, 'name' => 'Multi-Product Composite'];
        }
        $tempDir = STORAGE_PATH . '/renders';
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // ============================================
        // 1. VIDEO VE MEDYA TOPLAMA (render.php mantığı)
        // ============================================
        $videos = [];
        $images = [];

        // 1a. Ürün videosu (video_url alanı)
        if (!empty($product['video_url'])) {
            $log("Media resolve - video_url: " . $product['video_url']);
            $resolvedVideo = resolveMediaPath($product['video_url'], 'video', $tempDir, $companyId);
            $log("Media resolve - video_url sonuç: " . ($resolvedVideo ?: 'BULUNAMADI'));
            if ($resolvedVideo) {
                $videos[] = $resolvedVideo;
            }
        }

        // 1b. Ürün video listesi (videos JSON array)
        if (!empty($product['videos'])) {
            $productVideos = is_string($product['videos']) ? json_decode($product['videos'], true) : $product['videos'];
            $log("Media resolve - videos JSON: " . (is_string($product['videos']) ? $product['videos'] : json_encode($product['videos'])));
            if (is_array($productVideos)) {
                foreach ($productVideos as $vid) {
                    $vidPath = is_string($vid) ? $vid : ($vid['url'] ?? $vid['path'] ?? null);
                    if ($vidPath) {
                        $log("Media resolve - video path: " . $vidPath);
                        $resolvedVideo = resolveMediaPath($vidPath, 'video', $tempDir, $companyId);
                        $log("Media resolve - video sonuç: " . ($resolvedVideo ?: 'BULUNAMADI'));
                        if ($resolvedVideo) {
                            $videos[] = $resolvedVideo;
                        }
                    }
                }
            }
        } else {
            $log("Media resolve - videos alanı BOŞ");
        }

        // 1b-bis. Şablon içindeki video placeholder objelerine bağlı statik videoları topla
        $templateStaticVideoCandidates = [];
        $templateDesignData = [];
        if (!empty($template['design_data'])) {
            $templateDesignData = is_string($template['design_data'])
                ? json_decode($template['design_data'], true)
                : $template['design_data'];
        }

        if (is_array($templateDesignData) && !empty($templateDesignData['objects']) && is_array($templateDesignData['objects'])) {
            $collectStaticVideos = function($objects) use (&$collectStaticVideos, &$templateStaticVideoCandidates) {
                if (!is_array($objects)) return;
                foreach ($objects as $obj) {
                    if (!is_array($obj)) continue;

                    $customType = (string)($obj['customType'] ?? '');
                    $dynamicField = (string)($obj['dynamicField'] ?? '');
                    $isVideoPlaceholder = !empty($obj['isVideoPlaceholder']) ||
                        !empty($obj['isMultipleVideos']) ||
                        $customType === 'video-placeholder' ||
                        strpos($dynamicField, 'video_url') !== false ||
                        strpos($dynamicField, 'videos') !== false;

                    if ($isVideoPlaceholder) {
                        $staticVideos = $obj['staticVideos'] ?? [];
                        if (is_string($staticVideos)) {
                            $decoded = json_decode($staticVideos, true);
                            $staticVideos = (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) ? $decoded : [];
                        }

                        if (is_array($staticVideos)) {
                            foreach ($staticVideos as $entry) {
                                if (is_string($entry) && trim($entry) !== '') {
                                    $templateStaticVideoCandidates[] = trim($entry);
                                } elseif (is_array($entry)) {
                                    $entryPath = $entry['url'] ?? $entry['path'] ?? $entry['file_path'] ?? '';
                                    if (is_string($entryPath) && trim($entryPath) !== '') {
                                        $templateStaticVideoCandidates[] = trim($entryPath);
                                    }
                                }
                            }
                        }

                        $singleVideo = $obj['videoPlaceholderUrl'] ?? '';
                        if (is_string($singleVideo) && trim($singleVideo) !== '') {
                            $templateStaticVideoCandidates[] = trim($singleVideo);
                        }
                    }

                    if (!empty($obj['objects']) && is_array($obj['objects'])) {
                        $collectStaticVideos($obj['objects']);
                    }
                }
            };

            $collectStaticVideos($templateDesignData['objects']);
        }

        if (!empty($templateStaticVideoCandidates)) {
            $log("Template static videos found: " . count($templateStaticVideoCandidates));
            $resolvedVideoMap = [];
            foreach ($videos as $existingVideoPath) {
                if (is_string($existingVideoPath) && $existingVideoPath !== '') {
                    $resolvedVideoMap[$existingVideoPath] = true;
                }
            }

            foreach ($templateStaticVideoCandidates as $idx => $candidatePath) {
                $log("TemplateVideo[$idx] original path: " . $candidatePath);
                $resolvedVideo = resolveMediaPath($candidatePath, 'video', $tempDir, $companyId);
                $log("TemplateVideo[$idx] resolved to: " . ($resolvedVideo ?: 'BULUNAMADI'));
                if ($resolvedVideo && empty($resolvedVideoMap[$resolvedVideo])) {
                    $videos[] = $resolvedVideo;
                    $resolvedVideoMap[$resolvedVideo] = true;
                    $log("TemplateVideo[$idx] added to videos array");
                }
            }
        }

        // 1c. Ürün görselleri (images JSON array)
        if (!empty($product['images'])) {
            $productImages = is_string($product['images']) ? json_decode($product['images'], true) : $product['images'];
            $log("Media resolve - images JSON: " . mb_substr(is_string($product['images']) ? $product['images'] : json_encode($product['images']), 0, 200));
            if (is_array($productImages)) {
                foreach ($productImages as $img) {
                    $imgPath = is_string($img) ? $img : ($img['url'] ?? $img['path'] ?? $img['filename'] ?? null);
                    if ($imgPath) {
                        $log("Media resolve - image path: " . $imgPath);
                        $resolvedImage = resolveMediaPath($imgPath, 'image', $tempDir, $companyId);
                        $log("Media resolve - image sonuç: " . ($resolvedImage ?: 'BULUNAMADI'));
                        if ($resolvedImage) {
                            $images[] = $resolvedImage;
                        }
                    }
                }
            }
        } else {
            $log("Media resolve - images alanı BOŞ");
        }

        // 1d. Ürün ana görseli (image_url)
        if (!empty($product['image_url'])) {
            $resolvedImage = resolveMediaPath($product['image_url'], 'image', $tempDir, $companyId);
            if ($resolvedImage) {
                $images[] = $resolvedImage;
            }
        }

        // ============================================
        // 2. GÖRSEL KAYNAĞI BELİRLE
        // ============================================
        $imageSource = null;
        // KRITIK: Pre-rendered görsellerde designData kullanılmamalı
        // Aksi halde zaten render edilmiş görselin üstüne tekrar elemanlar çizilir
        $isPreRendered = false;

        // 2a. PRE-RENDERED IMAGE (Frontend canvas render - EN KALİTELİ)
        // Eğer frontend'den pre-rendered görsel geldiyse, bunu kullan
        if ($preRenderedImagePath && file_exists($preRenderedImagePath)) {
            $imageSource = $preRenderedImagePath;
            $isPreRendered = true; // Frontend canvas ile zaten render edilmiş
            $log("ÖNCELIK 1: Pre-rendered image kullanılıyor: $preRenderedImagePath (isPreRendered=TRUE)");
        }

        // 2a-bis. RENDER_CACHE KONTROLÜ (RenderWorker.js tarafından oluşturulan cache)
        // Ürün güncellendiğinde arka planda render edilen görseller burada
        if (!$imageSource && $companyId && !empty($product['id']) && !empty($template['id'])) {
            try {
                $cacheService = new RenderCacheService();
                $cachedRender = $cacheService->getCachedRender($product['id'], $template['id'], $companyId);

                if ($cachedRender && !empty($cachedRender['image_path']) && file_exists($cachedRender['image_path'])) {
                    $imageSource = $cachedRender['image_path'];
                    $isPreRendered = true; // Cache'den gelen görsel zaten render edilmiş
                    $log("ÖNCELIK 1.5: Render cache kullanılıyor: " . $cachedRender['image_path'] . " (isPreRendered=TRUE)");
                    $log("Cache info - status: " . ($cachedRender['status'] ?? 'N/A') . ", rendered_at: " . ($cachedRender['rendered_at'] ?? 'N/A'));
                } else {
                    $log("Render cache bulunamadı veya dosya mevcut değil - product_id: " . $product['id'] . ", template_id: " . $template['id']);
                }
            } catch (Exception $e) {
                $log("Render cache kontrolü hatası: " . $e->getMessage());
            }
        }

        // 2b. render_image (editörde kaydedilen statik render)
        if (!$imageSource && !empty($template['render_image'])) {
            // Önce doğrudan storage yolunu dene (yeni format: companies/{id}/templates/renders/...)
            $renderPath = STORAGE_PATH . '/' . $template['render_image'];
            if (file_exists($renderPath)) {
                $imageSource = $renderPath;
                $isPreRendered = false; // Şablon arka planı, dinamik alanlar çizilmeli
                $log("ÖNCELIK 2: render_image bulundu: $renderPath (isPreRendered=FALSE)");
            } else if ($companyId) {
                // Firma bazlı yolda ara (eski kayıtlar için geriye uyumluluk)
                $companyRenderPath = STORAGE_PATH . '/companies/' . $companyId . '/templates/renders/' . basename($template['render_image']);
                if (file_exists($companyRenderPath)) {
                    $imageSource = $companyRenderPath;
                    $isPreRendered = false; // Şablon arka planı, dinamik alanlar çizilmeli
                    $log("ÖNCELIK 2: render_image firma yolunda bulundu: $companyRenderPath (isPreRendered=FALSE)");
                } else {
                    $log("render_image bulunamadı: $renderPath ve $companyRenderPath");
                }
            }
        }

        // 2c. Şablon adından tasarım klasörü ara
        if (!$imageSource) {
            $templateName = $template['name'] ?? '';
            $templateSlug = strtolower(str_replace(' ', '_', $templateName));

            $possibleDirs = [];

            // Firma bazlı tasarım klasörleri (öncelikli)
            if ($companyId) {
                $companyDesignBase = STORAGE_PATH . '/companies/' . $companyId . '/tasarımlar';
                $possibleDirs[] = $companyDesignBase . '/esl_android/' . $templateSlug;
                $possibleDirs[] = $companyDesignBase . '/esl_android/' . $templateSlug . '_v1';
            }

            // Paylaşılan tasarım klasörleri (fallback)
            $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . $templateSlug;
            $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . $templateSlug . '_v1';

            if (!empty($template['template_file'])) {
                if ($companyId) {
                    $possibleDirs[] = STORAGE_PATH . '/companies/' . $companyId . '/tasarımlar/' . dirname($template['template_file']);
                }
                $possibleDirs[] = BASE_PATH . '/tasarımlar/' . dirname($template['template_file']);
                $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . pathinfo($template['template_file'], PATHINFO_FILENAME) . '_v1';
            }

            foreach ($possibleDirs as $dir) {
                if ($dir && is_dir($dir)) {
                    if (file_exists($dir . '/screen.png')) {
                        $imageSource = $dir . '/screen.png';
                        $isPreRendered = false; // Arka plan görseli, dinamik alanlar çizilmeli
                        $log("ÖNCELIK 3: Tasarım klasöründe bulundu: $imageSource (isPreRendered=FALSE)");
                        break;
                    }
                    $screenFiles = glob($dir . '/screen1*.png');
                    if (!empty($screenFiles)) {
                        $imageSource = $screenFiles[0];
                        $isPreRendered = false; // Arka plan görseli, dinamik alanlar çizilmeli
                        $log("ÖNCELIK 3: Tasarım klasöründe bulundu: $imageSource (isPreRendered=FALSE)");
                        break;
                    }
                }
            }
        }

        // 2d. preview_image
        if (!$imageSource && !empty($template['preview_image'])) {
            if (strpos($template['preview_image'], 'data:image') === 0) {
                $parts = explode(',', $template['preview_image']);
                if (count($parts) === 2) {
                    $imageData = base64_decode($parts[1]);
                    $tempFile = $tempDir . '/' . $clientId . '_preview_' . time() . '.png';
                    if (file_put_contents($tempFile, $imageData)) {
                        $imageSource = $tempFile;
                        $isPreRendered = false; // Preview arka planı, dinamik alanlar çizilmeli
                        $log("ÖNCELIK 4: preview_image (base64) kullanıldı (isPreRendered=FALSE)");
                    }
                }
            } else {
                // Önce doğrudan storage yolunu dene
                $previewPath = STORAGE_PATH . '/' . $template['preview_image'];
                if (file_exists($previewPath)) {
                    $imageSource = $previewPath;
                    $isPreRendered = false; // Preview arka planı, dinamik alanlar çizilmeli
                    $log("ÖNCELIK 4: preview_image bulundu: $previewPath (isPreRendered=FALSE)");
                } else if ($companyId) {
                    // Firma bazlı yolda ara
                    $companyPreviewPath = STORAGE_PATH . '/companies/' . $companyId . '/templates/renders/' . basename($template['preview_image']);
                    if (file_exists($companyPreviewPath)) {
                        $imageSource = $companyPreviewPath;
                        $isPreRendered = false; // Preview arka planı, dinamik alanlar çizilmeli
                        $log("ÖNCELIK 4: preview_image firma yolunda bulundu: $companyPreviewPath (isPreRendered=FALSE)");
                    }
                }
            }
        }

        // 2e. Ürün görsellerinden ilkini kullan
        if (!$imageSource && !empty($images)) {
            $imageSource = $images[0];
        }

        // NOT: İşlem esnasında render yapılmaz - sadece önceden hazırlanmış dosyalar kullanılır
        // Görsel bulunamazsa detaylı hata dön
        if (!$imageSource) {
            // Render cache durumunu kontrol et
            $cacheStatus = 'kontrol_edilmedi';
            if ($companyId && !empty($product['id']) && !empty($template['id'])) {
                $pendingJob = $db->fetch(
                    "SELECT id, status, created_at FROM render_jobs
                     WHERE product_id = ? AND template_id = ? AND company_id = ?
                     ORDER BY created_at DESC LIMIT 1",
                    [$product['id'], $template['id'], $companyId]
                );
                $cacheEntry = $db->fetch(
                    "SELECT id, status, image_path, rendered_at FROM render_cache
                     WHERE product_id = ? AND template_id = ? AND company_id = ?",
                    [$product['id'], $template['id'], $companyId]
                );
                $cacheStatus = [
                    'render_job' => $pendingJob ? [
                        'status' => $pendingJob['status'],
                        'created_at' => $pendingJob['created_at']
                    ] : 'yok',
                    'cache_entry' => $cacheEntry ? [
                        'status' => $cacheEntry['status'],
                        'image_path' => $cacheEntry['image_path'] ?? 'N/A',
                        'file_exists' => !empty($cacheEntry['image_path']) && file_exists($cacheEntry['image_path']) ? 'evet' : 'hayır',
                        'rendered_at' => $cacheEntry['rendered_at'] ?? 'N/A'
                    ] : 'yok'
                ];
            }

            $errorDetails = [
                'template_id' => $template['id'] ?? 'N/A',
                'template_name' => $template['name'] ?? 'N/A',
                'product_id' => $product['id'] ?? 'N/A',
                'product_name' => $product['name'] ?? 'N/A',
                'render_image' => $template['render_image'] ?? 'N/A',
                'preview_image' => !empty($template['preview_image']) ? 'mevcut' : 'yok',
                'product_images' => count($images),
                'render_cache_status' => $cacheStatus,
                'company_id' => $companyId ?? 'N/A'
            ];

            $log("HATA: Görsel kaynağı bulunamadı - " . json_encode($errorDetails));

            return [
                'success' => false,
                'error' => 'Görsel kaynağı bulunamadı. Render henüz tamamlanmamış olabilir. Ürünü düzenleyip kaydedin veya birkaç saniye bekleyip tekrar deneyin.',
                'details' => $errorDetails,
                'hint' => 'Render cache durumu: ' . (is_array($cacheStatus) ? json_encode($cacheStatus) : $cacheStatus)
            ];
        }

        // Ürün bilgilerini hazırla (tüm alanları gönder - dinamik alanlar için)
        $productInfo = $product; // Tüm ürün verisini gönder

        // Şablon design_data'sını parse et (dinamik alanlar için)
        $designData = [];
        if (!empty($template['design_data'])) {
            $designData = is_string($template['design_data'])
                ? json_decode($template['design_data'], true)
                : $template['design_data'];
        }

        // ==================== Responsive Ölçekleme ====================
        // Şablon responsive_mode='proportional' ise ve cihaz boyutu tasarımdan farklıysa
        // design_data'yı hedef boyuta ölçekle
        $responsiveMode = $template['responsive_mode'] ?? 'off';
        $designW = (int)($template['design_width'] ?? $template['width'] ?? 800);
        $designH = (int)($template['design_height'] ?? $template['height'] ?? 1280);

        if ($responsiveMode !== 'off' &&
            ($deviceWidth !== $designW || $deviceHeight !== $designH) &&
            !empty($designData['objects']) && is_array($designData['objects'])) {

            require_once BASE_PATH . '/services/ResponsiveScaler.php';
            $scaler = new ResponsiveScaler();

            $regionsConfig = null;
            if (!empty($template['regions_config'])) {
                $regionsConfig = is_string($template['regions_config'])
                    ? json_decode($template['regions_config'], true)
                    : $template['regions_config'];
            }

            $designData['objects'] = $scaler->scale(
                $designData['objects'],
                $designW, $designH,
                $deviceWidth, $deviceHeight,
                $template['scale_policy'] ?? 'contain',
                $template['grid_layout'] ?? null,
                $regionsConfig
            );

            $log("Responsive ölçekleme: {$designW}x{$designH} → {$deviceWidth}x{$deviceHeight} (policy: " . ($template['scale_policy'] ?? 'contain') . ")");
        }
        // ==============================================================

        // Şablon boyutlarını designData'ya ekle (ölçekleme için)
        $designData['_templateWidth'] = (int)($template['width'] ?? 800);
        $designData['_templateHeight'] = (int)($template['height'] ?? 1280);

        // Şablon çoklu ürün frame içeriyor mu? (safe inset sadece bu durumda uygulanmalı)
        $hasMultiProductFrame = false;
        $containsMultiProductFrame = function($items) use (&$containsMultiProductFrame): bool {
            if (!is_array($items)) return false;
            foreach ($items as $item) {
                if (!is_array($item)) continue;
                $customType = $item['customType'] ?? '';
                if ($customType === 'multi-product-frame') {
                    return true;
                }
                if (!empty($item['objects']) && $containsMultiProductFrame($item['objects'])) {
                    return true;
                }
            }
            return false;
        };
        if (!empty($designData['objects']) && is_array($designData['objects'])) {
            $hasMultiProductFrame = $containsMultiProductFrame($designData['objects']);
        }
        $productInfo['__is_multi_product_frame'] = $hasMultiProductFrame;

        // ============================================
        // 3. ŞABLON VIDEO PLACEHOLDER KONTROLÜ (render.php mantığı)
        // Şablon tasarımında video placeholder yoksa, ürün videolarını kullanma!
        // ============================================
        $hasVideoRegion = false;
        $videoRegionConfig = null;
        $imageRegionConfig = null;
        $videoPlaceholderFound = null;

        // 3a. regions_config'den video bölgesi ara
        $gridLayout = $template['grid_layout'] ?? null;
        $regionsConfig = $template['regions_config'] ?? null;

        if ($gridLayout) {
            $gridLayout = str_replace('-', '_', $gridLayout);
        }

        $regions = null;
        if ($regionsConfig) {
            $regions = is_string($regionsConfig) ? json_decode($regionsConfig, true) : $regionsConfig;
        }

        $log("Şablon grid_layout: " . ($gridLayout ?? 'YOK') . ", regions_config: " . ($regionsConfig ? 'VAR' : 'YOK'));

        if (is_array($regions)) {
            foreach ($regions as $region) {
                $regionType = $region['type'] ?? '';

                // Video placeholder varsa kaydet
                if (!empty($region['videoPlaceholder'])) {
                    $vp = $region['videoPlaceholder'];
                    $videoPlaceholderFound = [
                        'x' => max(0, (int)($vp['x'] ?? 0)),
                        'y' => max(0, (int)($vp['y'] ?? 0)),
                        'width' => (int)($vp['width'] ?? $deviceWidth),
                        'height' => (int)($vp['height'] ?? $deviceHeight)
                    ];
                }

                if ($regionType === 'video' || $regionType === 'media') {
                    $hasVideoRegion = true;
                    $videoRegionConfig = $region;
                } elseif ($regionType === 'image' || $regionType === 'label') {
                    if (!empty($region['videoPlaceholder'])) {
                        $hasVideoRegion = true;
                        $videoRegionConfig = $region;
                    } else {
                        $imageRegionConfig = $region;
                    }
                }
            }
        }

        // 3b. design_data'da video placeholder var mı kontrol et + pozisyonunu al
        $hasVideoPlaceholderInDesign = false;
        $designVideoPosition = null;
        if (!empty($designData['objects'])) {
            foreach ($designData['objects'] as $obj) {
                $objCustomType = $obj['customType'] ?? '';
                $objFill = $obj['fill'] ?? '';
                $objType = strtolower($obj['type'] ?? '');
                // Video placeholder algılama: prop kontrolü + customType + renk fallback
                $isVP = !empty($obj['isVideoPlaceholder']) ||
                    !empty($obj['isMultipleVideos']) ||
                    $objCustomType === 'video-placeholder' ||
                    (isset($obj['dynamicField']) && (
                        strpos($obj['dynamicField'], 'video_url') !== false ||
                        strpos($obj['dynamicField'], 'videos') !== false
                    )) ||
                    ($objType === 'rect' && $objFill === '#1a1a2e');
                if ($isVP) {
                    $hasVideoPlaceholderInDesign = true;

                    // Video placeholder pozisyonunu çıkar (Fabric.js obje koordinatları)
                    $objLeft = (int)($obj['left'] ?? 0);
                    $objTop = (int)($obj['top'] ?? 0);
                    $objW = (int)(($obj['width'] ?? $deviceWidth) * ($obj['scaleX'] ?? 1));
                    $objH = (int)(($obj['height'] ?? (int)($deviceHeight * 0.4)) * ($obj['scaleY'] ?? 1));

                    // Fabric.js v7 center origin â†’ sol-üst'e çevir
                    $originX = $obj['originX'] ?? 'center';
                    $originY = $obj['originY'] ?? 'center';
                    if ($originX === 'center') $objLeft -= (int)($objW / 2);
                    if ($originY === 'center') $objTop -= (int)($objH / 2);

                    // Şablon boyutundan cihaz boyutuna ölçekle
                    $templateW = (int)($designData['_templateWidth'] ?? $template['width'] ?? 800);
                    $templateH = (int)($designData['_templateHeight'] ?? $template['height'] ?? 1280);
                    $scaleX = $deviceWidth / max(1, $templateW);
                    $scaleY = $deviceHeight / max(1, $templateH);

                    $designVideoPosition = [
                        'x' => max(0, (int)($objLeft * $scaleX)),
                        'y' => max(0, (int)($objTop * $scaleY)),
                        'width' => min($deviceWidth, (int)($objW * $scaleX)),
                        'height' => min($deviceHeight, (int)($objH * $scaleY))
                    ];

                    $log("Design data video placeholder pozisyonu: " . json_encode($designVideoPosition));
                    break;
                }
            }
        }

        // 3c. Şablon video içermiyorsa ürün videolarını temizle
        if (!$hasVideoRegion && !$videoPlaceholderFound && !$hasVideoPlaceholderInDesign) {
            if (!empty($videos)) {
                $log("Şablon tasarımında video placeholder YOK - ürün videoları temizlendi (" . count($videos) . " video atlandı)");
            }
            $videos = [];
        } else {
            $log("Şablon video placeholder tespit edildi - hasVideoRegion: " . ($hasVideoRegion ? 'EVET' : 'HAYIR')
                . ", videoPlaceholderFound: " . ($videoPlaceholderFound ? 'EVET' : 'HAYIR')
                . ", hasVideoPlaceholderInDesign: " . ($hasVideoPlaceholderInDesign ? 'EVET' : 'HAYIR'));
        }

        // videoPlaceholder veya designVideoPosition bulunmuşsa ama videoRegionConfig yoksa, oluştur
        if (!$videoRegionConfig) {
            $vpSource = $videoPlaceholderFound ?? $designVideoPosition;
            if ($vpSource) {
                $hasVideoRegion = true;
                $videoRegionConfig = [
                    'id' => 'auto_video',
                    'type' => 'video',
                    'x' => $vpSource['x'],
                    'y' => $vpSource['y'],
                    'width' => $vpSource['width'],
                    'height' => $vpSource['height'],
                    'videoPlaceholder' => $vpSource
                ];
                $videoPlaceholderFound = $vpSource;
                $log("Video region config oluşturuldu: " . json_encode($videoRegionConfig));
            }
        }

        // ============================================
        // 4. CİHAZA GÖNDER (Video varsa sendGridLabel, yoksa sendLabel)
        // ============================================
        $log("useGateway: " . ($useGateway ? 'EVET' : 'HAYIR') . ", gatewayId: " . ($gatewayId ?? 'YOK'));
        // Pre-rendered görsellerde designData'yı temizle â€” dinamik alanlar zaten frontend'de render edilmiş
        $effectiveDesignData = $isPreRendered ? [] : $designData;
        if (($isMqttMode || $isHttpPullMode) && empty($companyId)) {
            return [
                'success' => false,
                'error' => ($isHttpPullMode ? 'HTTP' : 'MQTT') . ' gonderimi icin company context eksik'
            ];
        }

        if (!empty($videos) && $hasVideoRegion) {
            // Video + grid gönderimi
            // Video ve image bölgelerini şablon ayarlarından al
            $vp = $videoPlaceholderFound ?? ($videoRegionConfig ? [
                'x' => (int)($videoRegionConfig['x'] ?? 0),
                'y' => (int)($videoRegionConfig['y'] ?? 0),
                'width' => (int)($videoRegionConfig['width'] ?? $deviceWidth),
                'height' => (int)($videoRegionConfig['height'] ?? (int)($deviceHeight * 0.5))
            ] : null);

            if (!$vp) {
                // Fallback: grid_layout'a göre hesapla
                $normalizedLayout = $gridLayout ?? 'split_vertical';
                if ($normalizedLayout === 'split_vertical') {
                    $vp = ['x' => 0, 'y' => 0, 'width' => $deviceWidth, 'height' => (int)($deviceHeight * 0.5)];
                } elseif ($normalizedLayout === 'split_vertical_60_40') {
                    $vp = ['x' => 0, 'y' => 0, 'width' => $deviceWidth, 'height' => (int)($deviceHeight * 0.6)];
                } elseif ($normalizedLayout === 'split_vertical_40_60') {
                    $vp = ['x' => 0, 'y' => 0, 'width' => $deviceWidth, 'height' => (int)($deviceHeight * 0.4)];
                } else {
                    $vp = ['x' => 0, 'y' => 0, 'width' => $deviceWidth, 'height' => (int)($deviceHeight * 0.5)];
                }
            }

            $videoX = (int)$vp['x'];
            $videoY = (int)$vp['y'];
            $videoW = (int)$vp['width'];
            $videoH = (int)$vp['height'];

            // Video tüm ekranı kaplıyor mu?
            $isFullScreenVideo = ($videoX == 0 && $videoY == 0 &&
                                  $videoW >= $deviceWidth * 0.95 && $videoH >= $deviceHeight * 0.95);

            // Tek grid + video (overlay mode) - single grid ama içinde video var
            $normalizedLayout = str_replace('-', '_', $gridLayout ?? '');
            $isSingleGridWithVideo = ($normalizedLayout === 'single' && $hasVideoRegion && !$imageRegionConfig);

            // ===== BÖLGE NORMALİZASYONU =====
            // Video placeholder Fabric.js objesinden gelen pozisyonlar cihaz boyutuyla tam eşleşmeyebilir
            // (örn: x:1 yerine x:0, width:798 yerine width:800, toplam yükseklik < deviceHeight)
            // Bu boşlukları kapatmak için normalize et
            $videoCenterY = $videoY + ((float)$videoH / 2.0);
            $isVideoBottomRegion = $videoCenterY >= ((float)$deviceHeight / 2.0);
            $totalCoverage = 0;
            if ($isVideoBottomRegion) {
                // Video altta: ustteki alan (image) + video
                $totalCoverage = $videoY + $videoH;
            } else {
                // Video ustte: video + alttaki alan (image)
                $totalCoverage = $videoH + ($deviceHeight - ($videoY + $videoH));
            }

            // Video width'i cihaz genişliğine normalize et (1-2px kenar boşluğu kapatma)
            if ($videoW < $deviceWidth && $videoW >= $deviceWidth * 0.95) {
                $videoX = 0;
                $videoW = $deviceWidth;
            }

            // Toplam yükseklik cihaz yüksekliğini kaplamıyorsa normalize et
            $gap = $deviceHeight - ($isVideoBottomRegion ? ($videoY + $videoH) : ($videoH + ($deviceHeight - $videoH)));
            if ($isVideoBottomRegion) {
                // Video altta
                $actualGap = $deviceHeight - ($videoY + $videoH);
                if ($actualGap > 0 && $actualGap < 100) {
                    // Boşluğu video'ya ekle
                    $videoH += $actualGap;
                    $log("Video region normalize: alt boşluk ({$actualGap}px) video'ya eklendi â†’ h={$videoH}");
                }
            } else {
                // Video üstte
                $imageStart = $videoY + $videoH;
                $imageAvail = $deviceHeight - $imageStart;
                // Eğer image + video tam kaplamıyorsa, aralarındaki veya alttaki boşluğu kapat
                // Bu durumda process.php grid mode zaten imageH = deviceHeight - videoBottom hesaplıyor
            }

            if ($isSingleGridWithVideo && !$isFullScreenVideo) {
                // OVERLAY MODE: Görsel tam ekran, video tasarımdaki pozisyonda üstte
                $log("OVERLAY MODE: Görsel tam ekran, video [{$videoX},{$videoY} {$videoW}x{$videoH}] üstte");
                $sendParams = [
                    'layout' => 'custom',
                    'width' => $deviceWidth,
                    'height' => $deviceHeight,
                    'image' => $imageSource,
                    'videos' => $videos,
                    'product' => $productInfo,
                    'design_data' => $effectiveDesignData,
                    'image_region' => [
                        'x' => 0,
                        'y' => 0,
                        'width' => $deviceWidth,
                        'height' => $deviceHeight
                    ],
                    'video_region' => [
                        'x' => $videoX,
                        'y' => $videoY,
                        'width' => $videoW,
                        'height' => $videoH
                    ]
                ];
            } elseif ($isFullScreenVideo) {
                // Tam ekran video
                $log("TAM EKRAN VIDEO: Görsel eklenmeyecek");
                $sendParams = [
                    'layout' => 'fullscreen_video',
                    'width' => $deviceWidth,
                    'height' => $deviceHeight,
                    'image' => $imageSource,
                    'videos' => $videos,
                    'product' => $productInfo,
                    'design_data' => $effectiveDesignData,
                    'video_region' => [
                        'x' => 0,
                        'y' => 0,
                        'width' => $deviceWidth,
                        'height' => $deviceHeight
                    ]
                ];
            } else {
                // Normal grid: Video belirli bölgede, görsel geri kalanda
                // Image ve video bölgeleri cihaz ekranını tamamen kaplamalı (boşluk olmamalı)
                if ($isVideoBottomRegion) {
                    // Video ALTTA - görsel üstte
                    $imageY = 0;
                    $imageH = $deviceHeight - $videoH; // Kalan alan tamamen görsele
                    // Video'yu görselin hemen altına yerleştir
                    $videoY = $imageH;
                } else {
                    // Video ÜSTTE - görsel altta
                    $imageY = $videoH; // Görseli video'nun hemen altına
                    $imageH = $deviceHeight - $videoH; // Kalan alan tamamen görsele
                }

                // Güvenlik: Görsel bölgesi çok küçükse minimum ayarla
                if ($imageH < 50) {
                    $imageH = max(100, $imageH);
                    $log("UYARI: Görsel bölgesi çok küçük, minimum 100px'e ayarlandı");
                }

                $log("GRID MODE: Video [{$videoX},{$videoY} {$videoW}x{$videoH}], Görsel [0,{$imageY} {$deviceWidth}x{$imageH}]");
                $log("  Toplam kaplama: " . ($imageH + $videoH) . "px / {$deviceHeight}px");

                $sendParams = [
                    'layout' => 'custom',
                    'width' => $deviceWidth,
                    'height' => $deviceHeight,
                    'image' => $imageSource,
                    'videos' => $videos,
                    'product' => $productInfo,
                    'design_data' => $effectiveDesignData,
                    'queue_id' => $queueId,
                    'queue_item_id' => $queueItemId,
                    'image_region' => [
                        'x' => 0,
                        'y' => $imageY,
                        'width' => $deviceWidth,
                        'height' => $imageH
                    ],
                    'video_region' => [
                        'x' => 0, // Her zaman sol kenardan başla
                        'y' => $videoY,
                        'width' => $deviceWidth, // Tam genişlik kullan
                        'height' => $videoH
                    ]
                ];
            }

            if ($isHttpPullMode) {
                $log("HTTP PULL modunda icerik kuyruga alinacak (grid)");
                require_once BASE_PATH . '/services/EslSignValidator.php';
                $eslValidator = new EslSignValidator();
                $renderResult = $eslValidator->queueContentForHttpDevice(
                    $device,
                    $sendParams,
                    (string)$companyId,
                    $template['id'] ?? null,
                    $product['id'] ?? null
                );
            } elseif ($isMqttMode) {
                $log("MQTT modunda icerik kuyruga alinacak (grid)");
                require_once BASE_PATH . '/services/MqttBrokerService.php';
                $mqttService = new MqttBrokerService();
                $renderResult = $mqttService->queueContentUpdate(
                    $device,
                    $sendParams,
                    (string)$companyId,
                    $template['id'] ?? null,
                    $product['id'] ?? null
                );
            } elseif ($useGateway) {
                $log("Gateway üzerinden grid label gönderiliyor...");
                $renderResult = sendLabelViaGatewayQueue($db, $gatewayId, $device, $sendParams, 'grid', $log);
            } else {
                $log("Doğrudan grid label gönderiliyor...");
                $renderResult = $gateway->sendGridLabel(
                    $ip,
                    $clientId,
                    $sendParams
                );
            }
            $log("sendGridLabel sonucu: " . json_encode($renderResult));
        } else {
            // Video yoksa sadece görsel gönder
            $log("sendLabel çağrılacak:");
            $log("  imageSource: $imageSource");
            $log("  isPreRendered: " . ($isPreRendered ? 'EVET' : 'HAYIR'));
            $log("  productInfo[name]: " . ($productInfo['name'] ?? 'YOK'));
            $log("  designData objects count: " . (isset($designData['objects']) ? count($designData['objects']) : 'YOK'));
            $log("  deviceSize: {$deviceWidth}x{$deviceHeight}");

            $sendParams = [
                'layout' => 'single',
                'width' => $deviceWidth,
                'height' => $deviceHeight,
                'image' => $imageSource,
                'product' => $productInfo,
                'design_data' => $effectiveDesignData,
                'queue_id' => $queueId,
                'queue_item_id' => $queueItemId
            ];

            if ($isHttpPullMode) {
                $log("HTTP PULL modunda icerik kuyruga alinacak (label)");
                require_once BASE_PATH . '/services/EslSignValidator.php';
                $eslValidator = new EslSignValidator();
                $renderResult = $eslValidator->queueContentForHttpDevice(
                    $device,
                    $sendParams,
                    (string)$companyId,
                    $template['id'] ?? null,
                    $product['id'] ?? null
                );
            } elseif ($isMqttMode) {
                $log("MQTT modunda icerik kuyruga alinacak (label)");
                require_once BASE_PATH . '/services/MqttBrokerService.php';
                $mqttService = new MqttBrokerService();
                $renderResult = $mqttService->queueContentUpdate(
                    $device,
                    $sendParams,
                    (string)$companyId,
                    $template['id'] ?? null,
                    $product['id'] ?? null
                );
            } elseif ($useGateway) {
                $log("Gateway üzerinden label gönderiliyor...");
                $renderResult = sendLabelViaGatewayQueue($db, $gatewayId, $device, $sendParams, 'label', $log);
            } else {
                $log("Doğrudan label gönderiliyor...");
                $renderResult = $gateway->sendLabel(
                    $ip,
                    $clientId,
                    $imageSource,
                    $productInfo,
                    $deviceWidth,
                    $deviceHeight,
                    $effectiveDesignData
                );
            }
            $log("sendLabel sonucu: " . json_encode($renderResult));
        }

        return [
            'success' => $renderResult['success'] ?? false,
            'error' => $renderResult['error'] ?? null,
            'md5' => $renderResult['md5'] ?? null,
            'communication_mode' => $isHttpPullMode ? 'http' : ($isMqttMode ? 'mqtt' : 'http-server'),
            'delivery' => $renderResult['delivery'] ?? null,
            'file_path' => $renderResult['file_path'] ?? null,
            'videos_sent' => count($videos),
            'images_found' => count($images)
        ];
    }

    // Template yoksa sadece refresh
    $taskPath = "files/task/{$clientId}.js";
    $refreshResult = $gateway->triggerReplay($ip, $taskPath);
    return [
        'success' => $refreshResult['success'] ?? false,
        'error' => $refreshResult['error'] ?? null,
        'md5' => null
    ];
}

/**
 * Gateway üzerinden label gönder (render.php'den adapte edildi)
 *
 * Gateway agent'ın çalıştığı durumlarda, doğrudan cihaza bağlanmak yerine
 * gateway_commands tablosuna komut yazılır ve gateway agent bu komutu işler.
 */
function sendLabelViaGatewayQueue($db, $gatewayId, $device, $sendParams, $type = 'label', $log = null): array
{
    // Log fonksiyonu
    if ($log === null) {
        $log = function($msg) {};
    }

    $log("=== sendLabelViaGatewayQueue başladı ===");
    $log("Device IP: " . ($device['ip_address'] ?? 'YOK'));
    $log("Device ID: " . ($device['device_id'] ?? 'YOK'));
    $log("Type: $type");
    $log("Image path: " . ($sendParams['image'] ?? 'YOK'));
    $log("Videos count: " . (isset($sendParams['videos']) ? count($sendParams['videos']) : 0));

    // Görsel dosya bilgilerini hazırla
    $imagePath = null;
    $imagePublicUrl = null;
    $imageMd5 = null;
    $imageSize = 0;

    if (!empty($sendParams['image'])) {
        if (file_exists($sendParams['image'])) {
            $imagePath = $sendParams['image'];
            $imagePublicUrl = gatewayMediaPathToUrl($imagePath);
            $imageSize = filesize($imagePath);
            $imageMd5 = strtoupper(md5_file($imagePath));
            $log("Image file: $imagePath, size: $imageSize bytes, md5: $imageMd5");
            if (!empty($imagePublicUrl)) {
                $log("Image public URL: $imagePublicUrl");
            }
        } else {
            $log("ERROR: Image file does not exist: " . $sendParams['image']);
        }
    } else {
        $log("WARNING: No image path provided");
    }

    // Video dosyası bilgileri
    $videoPaths = [];
    if (!empty($sendParams['videos']) && is_array($sendParams['videos'])) {
        $log("Processing " . count($sendParams['videos']) . " videos");
        foreach ($sendParams['videos'] as $videoPath) {
            if (file_exists($videoPath)) {
                $videoPublicUrl = gatewayMediaPathToUrl($videoPath);
                $videoSize = filesize($videoPath);
                $videoMd5 = strtoupper(md5_file($videoPath));
                $log("Video: $videoPath, size: $videoSize bytes, md5: $videoMd5");
                $videoPaths[] = [
                    // Yeni gateway surumleri URL'den indirir; eski surumler local_path'i kullanabilir.
                    'path' => $videoPublicUrl ?: $videoPath,
                    'url' => $videoPublicUrl,
                    'local_path' => $videoPath,
                    'filename' => basename($videoPath),
                    'size' => $videoSize,
                    'md5' => $videoMd5
                ];
            } else {
                $log("ERROR: Video file not found: $videoPath");
            }
        }
    }

    // Komut parametrelerini hazırla (base64 yok, sadece dosya yolları)
    $commandParams = [
        'device_id' => $device['id'],
        'device_ip' => $device['ip_address'],
        'client_id' => $device['device_id'],
        'type' => $type,
        'layout' => $sendParams['layout'] ?? 'single',
        'width' => $sendParams['width'] ?? 800,
        'height' => $sendParams['height'] ?? 1280,
        'product' => $sendParams['product'] ?? [],
        'design_data' => $sendParams['design_data'] ?? [],
        // Dosya referansları
        // URL once kullanimi ile uzaktaki EXE gateway senaryosunu destekle.
        'image_path' => $imagePublicUrl ?: $imagePath,
        'image_url' => $imagePublicUrl,
        'image_local_path' => $imagePath,
        'image_md5' => $imageMd5,
        'image_size' => $imageSize,
        'video_paths' => $videoPaths,
        'image_region' => $sendParams['image_region'] ?? null,
        'video_region' => $sendParams['video_region'] ?? null,
        'queue_id' => $sendParams['queue_id'] ?? null,
        'queue_item_id' => $sendParams['queue_item_id'] ?? null
    ];

    // JSON encode ve boyut kontrolü
    $jsonParams = json_encode($commandParams);
    $jsonSize = strlen($jsonParams);
    $log("JSON parameters size: $jsonSize bytes");

    if ($jsonParams === false) {
        $jsonError = json_last_error_msg();
        $log("ERROR: JSON encode failed: $jsonError");
        return [
            'success' => false,
            'error' => 'JSON encode hatası: ' . $jsonError,
            'via_gateway' => true
        ];
    }

    // Komutu oluştur
    $commandId = $db->generateUuid();
    $log("Creating command: $commandId");

    try {
        $db->insert('gateway_commands', [
            'id' => $commandId,
            'gateway_id' => $gatewayId,
            'device_id' => $device['id'],
            'command' => 'send_label',
            'parameters' => $jsonParams,
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s')
        ]);
        $log("Command inserted to database");
    } catch (Exception $e) {
        $log("ERROR: Database insert failed: " . $e->getMessage());
        return [
            'success' => false,
            'error' => 'Veritabanı hatası: ' . $e->getMessage(),
            'via_gateway' => true
        ];
    }

    // Gateway durumunu kontrol et (son heartbeat)
    $gateway = $db->fetch("SELECT * FROM gateways WHERE id = ?", [$gatewayId]);
    if ($gateway) {
        $lastHeartbeat = strtotime($gateway['last_heartbeat'] ?? '1970-01-01');
        $heartbeatAge = time() - $lastHeartbeat;
        $log("Gateway last heartbeat: " . ($gateway['last_heartbeat'] ?? 'never') . " ({$heartbeatAge}s ago)");

        // Heartbeat 2 dakikadan eski ise gateway kapalı kabul et
        if ($heartbeatAge > 120) {
            $log("WARNING: Gateway heartbeat is stale ({$heartbeatAge}s > 120s). Gateway might be offline.");
            // Komutu iptal et ve başarısız olarak işaretle
            $db->update('gateway_commands', [
                'status' => 'failed',
                'error_message' => 'Gateway çevrimdışı (heartbeat stale)',
            ], 'id = ?', [$commandId]);

            return [
                'success' => false,
                'error' => 'Gateway çevrimdışı görünüyor. Doğrudan gönderim deneyin veya gateway agent\'ı başlatın.',
                'via_gateway' => true,
                'fallback_suggested' => true
            ];
        }
    }

    // Gateway komut timeout degeri (ayar yoksa varsayilan: 60s)
    $timeout = 60;
    $waitForCompletion = false; // Default: async queue mode
    $companyId = $device['company_id'] ?? null;
    if (!empty($companyId)) {
        $companySettings = $db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );
        if ($companySettings && !empty($companySettings['data'])) {
            $settingsData = json_decode($companySettings['data'], true);
            if (isset($settingsData['gateway_command_timeout_seconds'])) {
                $timeout = (int)$settingsData['gateway_command_timeout_seconds'];
            }
            if (array_key_exists('gateway_wait_for_completion', $settingsData)) {
                $waitForCompletion = (bool)$settingsData['gateway_wait_for_completion'];
            }
            if (array_key_exists('gateway_async_queue', $settingsData)) {
                $waitForCompletion = !((bool)$settingsData['gateway_async_queue']);
            }
        }
    }
    $timeout = max(10, min(300, $timeout));

    if (!$waitForCompletion) {
        $log("Gateway async queue mode aktif, command beklenmeden devam ediliyor.");
        return [
            'success' => true,
            'message' => 'Gateway komutu kuyruga alindi',
            'via_gateway' => true,
            'queued' => true,
            'command_id' => $commandId,
            'md5' => $imageMd5
        ];
    }

    $startTime = time();
    $log("Waiting for gateway response (timeout: {$timeout}s)...");

    while ((time() - $startTime) < $timeout) {
        $command = $db->fetch(
            "SELECT * FROM gateway_commands WHERE id = ?",
            [$commandId]
        );

        if ($command && $command['status'] === 'completed') {
            $cmdResult = json_decode($command['result'], true) ?? [];
            $elapsed = time() - $startTime;
            $log("Command completed in {$elapsed}s: " . json_encode($cmdResult));

            return [
                'success' => $cmdResult['success'] ?? true,
                'message' => $cmdResult['message'] ?? 'Etiket başarıyla gönderildi',
                'via_gateway' => true,
                'gateway_result' => $cmdResult,
                'md5' => $imageMd5
            ];
        } elseif ($command && $command['status'] === 'failed') {
            $elapsed = time() - $startTime;
            $log("Command failed in {$elapsed}s: " . ($command['error_message'] ?? 'unknown'));

            return [
                'success' => false,
                'error' => $command['error_message'] ?? 'Gateway komutu başarısız',
                'via_gateway' => true
            ];
        }

        usleep(500000); // 0.5 saniye bekle
    }
    // Timeout oldu - item'in basarili sayilmasini onlemek icin komutu timeout isaretle
    $log("TIMEOUT: Command did not complete in {$timeout}s");
    $db->update('gateway_commands', [
        'status' => 'timeout',
        'error_message' => 'Gateway response timeout after ' . $timeout . 's',
        'completed_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$commandId]);

    return [
        'success' => false,
        'error' => 'Gateway yanit zaman asimi (' . $timeout . ' saniye)',
        'via_gateway' => true,
        'retryable' => true,
        'md5' => $imageMd5
    ];
}

/**
 * PWA Player için işlem
 */
function processForPWAPlayer($db, $device, $template, $product): array
{
    // device_commands tablosuna komut ekle
    $commandId = $db->generateUuid();

    $db->insert('device_commands', [
        'id' => $commandId,
        'device_id' => $device['id'],
        'command' => 'refresh_content',
        'params' => json_encode([
            'template_id' => $template['id'] ?? null,
            'product_id' => $product['id'] ?? null
        ]),
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s')
    ]);

    return [
        'success' => true,
        'md5' => $commandId,
        'message' => 'Komut kuyruğa eklendi'
    ];
}

/**
 * Hanshow ESL icin render ve gonderim
 */
function processForHanshowESL($db, $device, $template, $product, $preRenderedImagePath, $companyId): array
{
    require_once BASE_PATH . '/services/HanshowGateway.php';

    $eslId = $device['device_id'] ?? '';
    if (empty($eslId)) {
        return ['success' => false, 'error' => 'ESL ID bulunamadı'];
    }

    // 1. Gorsel kaynagini belirle
    $imageSource = null;

    // Pre-rendered image (frontend'den)
    if ($preRenderedImagePath && file_exists($preRenderedImagePath)) {
        $imageSource = $preRenderedImagePath;
    }

    // Template render_image
    if (!$imageSource && !empty($template['render_image'])) {
        $renderPath = STORAGE_PATH . '/' . $template['render_image'];
        if (file_exists($renderPath)) {
            $imageSource = $renderPath;
        } elseif ($companyId) {
            $companyRenderPath = STORAGE_PATH . '/companies/' . $companyId . '/templates/renders/' . basename($template['render_image']);
            if (file_exists($companyRenderPath)) {
                $imageSource = $companyRenderPath;
            }
        }
    }

    // Template preview_image (base64 data URL)
    if (!$imageSource && !empty($template['preview_image']) && strpos($template['preview_image'], 'data:image') === 0) {
        $parts = explode(',', $template['preview_image']);
        if (count($parts) === 2) {
            $imageData = base64_decode($parts[1]);
            $tempDir = STORAGE_PATH . '/renders';
            if (!is_dir($tempDir)) mkdir($tempDir, 0755, true);
            $tempFile = $tempDir . '/' . $eslId . '_hanshow_' . time() . '.png';
            file_put_contents($tempFile, $imageData);
            $imageSource = $tempFile;
        }
    }

    // GD ile basit render (son care)
    if (!$imageSource) {
        $width = (int)($template['width'] ?? 200);
        $height = (int)($template['height'] ?? 200);
        $img = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefill($img, 0, 0, $white);
        $productName = $product['name'] ?? 'Unknown';
        imagestring($img, 5, 10, 10, $productName, $black);
        if (!empty($product['current_price'])) {
            imagestring($img, 5, 10, 40, $product['current_price'] . ' TL', $black);
        }
        $tempDir = STORAGE_PATH . '/renders';
        if (!is_dir($tempDir)) mkdir($tempDir, 0755, true);
        $tempFile = $tempDir . '/' . $eslId . '_gd_' . time() . '.jpg';
        imagejpeg($img, $tempFile, 90);
        imagedestroy($img);
        $imageSource = $tempFile;
    }

    // 2. HanshowGateway ile gonder
    try {
        $hanshowGw = new HanshowGateway();
        $imageBase64 = base64_encode(file_get_contents($imageSource));
        $result = $hanshowGw->sendImageToESL($eslId, $imageBase64, ['priority' => 1]);

        $errno = isset($result['errno']) ? (int)$result['errno'] : -1;
        $success = $errno === 0 || $errno === 1; // 0=immediate, 1=in processing

        if ($success) {
            // hanshow_esls tablosunu guncelle
            $db->query(
                "UPDATE hanshow_esls SET current_product_id = ?, current_template_id = ?, updated_at = ? WHERE esl_id = ?",
                [$product['id'] ?? null, $template['id'] ?? null, date('Y-m-d H:i:s'), $eslId]
            );

            // devices tablosunu guncelle
            $db->update('devices', [
                'current_content' => json_encode([
                    'type' => 'product',
                    'product_id' => $product['id'] ?? null,
                    'template_id' => $template['id'] ?? null,
                    'sent_at' => date('Y-m-d H:i:s')
                ]),
                'last_sync' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$device['id']]);

            return [
                'success' => true,
                'md5' => md5($imageBase64),
                'message' => $result['errmsg'] ?? 'Hanshow ESL gonderim basarili'
            ];
        } else {
            return [
                'success' => false,
                'error' => $result['errmsg'] ?? 'Hanshow ESL gonderim basarisiz (errno=' . $errno . ')'
            ];
        }
    } catch (\Exception $e) {
        return [
            'success' => false,
            'error' => 'HanshowGateway hatasi: ' . $e->getMessage()
        ];
    }
}

/**
 * MQTT cihaz icin render islemi
 * Gorseli dosyaya kaydeder, device_content_assignments + device_commands olusturur.
 * Cihaz sonraki report cagrisinda icerigi alacak.
 */
function processMqttDeviceRender($db, $device, $template, $product, $job, $queueItem): array
{
    $companyId = $job['company_id'] ?? $device['company_id'] ?? null;
    $deviceId = $device['id'];
    $templateId = $template['id'] ?? null;
    $productId = $product['id'] ?? null;
    $preRenderedImagePath = $job['rendered_image_path'] ?? null;

    $log = function($msg) use ($deviceId) {
        error_log("[MQTT render] device={$deviceId}: {$msg}");
    };

    $log("MQTT render basladi");

    try {
        // 1. Gorsel kaynagini belirle
        $imageSource = null;
        $tempDir = STORAGE_PATH . '/renders';
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Pre-rendered image (frontend canvas) - en yuksek oncelik
        if ($preRenderedImagePath && file_exists($preRenderedImagePath)) {
            // Dosyayi renders dizinine kopyala
            $ext = pathinfo($preRenderedImagePath, PATHINFO_EXTENSION) ?: 'jpg';
            $fileName = 'mqtt_' . $deviceId . '_' . time() . '.' . $ext;
            $renderDir = $tempDir . '/' . $companyId . '/esl';
            if (!is_dir($renderDir)) {
                mkdir($renderDir, 0755, true);
            }
            $destPath = $renderDir . '/' . $fileName;
            copy($preRenderedImagePath, $destPath);
            $imageSource = 'storage/renders/' . $companyId . '/esl/' . $fileName;
            $log("Pre-rendered gorsel kullanildi: {$imageSource}");
        }

        // Render cache kontrolu
        if (!$imageSource && $companyId && $templateId && $productId) {
            $cache = $db->fetch(
                "SELECT file_path, render_hash FROM product_renders
                 WHERE company_id = ? AND template_id = ? AND product_id = ? AND device_type = 'esl' AND status = 'completed'
                 ORDER BY created_at DESC LIMIT 1",
                [$companyId, $templateId, $productId]
            );
            if ($cache && !empty($cache['file_path']) && file_exists(BASE_PATH . '/' . $cache['file_path'])) {
                $imageSource = $cache['file_path'];
                $log("Render cache kullanildi: {$imageSource}");
            }
        }

        // Template render_image
        if (!$imageSource && !empty($template['render_image'])) {
            $renderImagePath = $template['render_image'];
            if (file_exists(BASE_PATH . '/' . $renderImagePath)) {
                $imageSource = $renderImagePath;
                $log("Template render_image kullanildi: {$imageSource}");
            }
        }

        // Template preview_image
        if (!$imageSource && !empty($template['preview_image'])) {
            $previewPath = $template['preview_image'];
            if (file_exists(BASE_PATH . '/' . $previewPath)) {
                $imageSource = $previewPath;
                $log("Template preview_image kullanildi: {$imageSource}");
            }
        }

        // Product image (son cozum)
        if (!$imageSource && !empty($product['images'])) {
            $images = is_string($product['images']) ? json_decode($product['images'], true) : $product['images'];
            if (!empty($images) && is_array($images)) {
                $firstImage = $images[0];
                if (is_string($firstImage) && file_exists(BASE_PATH . '/storage/' . $firstImage)) {
                    $imageSource = 'storage/' . $firstImage;
                    $log("Product image kullanildi: {$imageSource}");
                }
            }
        }

        if (!$imageSource) {
            return [
                'success' => false,
                'error' => 'MQTT gonderimi icin gorsel kaynagi bulunamadi'
            ];
        }

        // 2. product_renders tablosuna kaydet
        $fullPath = BASE_PATH . '/' . $imageSource;
        $renderHash = file_exists($fullPath) ? md5_file($fullPath) : md5($imageSource . time());

        $existingRender = $db->fetch(
            "SELECT id FROM product_renders
             WHERE company_id = ? AND product_id = ? AND template_id = ? AND device_type = 'esl'",
            [$companyId, $productId ?? '', $templateId ?? '']
        );

        if ($existingRender) {
            $db->update('product_renders', [
                'file_path' => $imageSource,
                'render_hash' => $renderHash,
                'status' => 'completed',
                'completed_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$existingRender['id']]);
            $renderId = $existingRender['id'];
        } else {
            $renderId = $db->generateUuid();
            $db->insert('product_renders', [
                'id' => $renderId,
                'company_id' => $companyId,
                'product_id' => $productId ?? '',
                'template_id' => $templateId ?? '',
                'device_type' => 'esl',
                'file_path' => $imageSource,
                'render_hash' => $renderHash,
                'status' => 'completed',
                'created_at' => date('Y-m-d H:i:s'),
                'completed_at' => date('Y-m-d H:i:s')
            ]);
        }

        // 3. device_content_assignments guncelle/olustur
        $existingAssignment = $db->fetch(
            "SELECT id FROM device_content_assignments WHERE device_id = ? AND status = 'active'",
            [$deviceId]
        );

        if ($existingAssignment) {
            $db->update('device_content_assignments', [
                'content_type' => 'image',
                'content_id' => $renderId
            ], 'id = ?', [$existingAssignment['id']]);
        } else {
            $db->insert('device_content_assignments', [
                'id' => $db->generateUuid(),
                'device_id' => $deviceId,
                'content_type' => 'image',
                'content_id' => $renderId,
                'status' => 'active',
                'created_at' => date('Y-m-d H:i:s')
            ]);
        }

        // 4. device_commands'a updatelabel komutu ekle
        require_once BASE_PATH . '/services/MqttBrokerService.php';
        $mqttService = new MqttBrokerService();
        $mqttService->publishCommand($deviceId, [
            'action' => 'updatelabel',
            'push_id' => time(),
            'clientid' => $device['device_id'] ?? $device['mqtt_client_id'] ?? '',
            'priority' => 5
        ], $companyId);

        $log("MQTT render tamamlandi: render_id={$renderId}, file={$imageSource}");

        return [
            'success' => true,
            'md5' => $renderHash,
            'message' => 'MQTT kuyruga eklendi',
            'communication_mode' => 'mqtt',
            'delivery' => 'queued',
            'render_id' => $renderId,
            'file_path' => $imageSource
        ];

    } catch (Exception $e) {
        $log("MQTT render hatasi: " . $e->getMessage());
        return [
            'success' => false,
            'error' => 'MQTT render hatasi: ' . $e->getMessage()
        ];
    }
}
