<?php
/**
 * RenderQueueWorker - Phase 2: Queue ????leyici
 *
 * Background process olarak ??al??????r ve render_queue tablosundaki
 * i??leri Phase 1'deki paralel g??nderim sistemiyle i??ler.
 *
 * Kullan??m:
 *   php workers/RenderQueueWorker.php                    # Tek seferlik ??al????t??r
 *   php workers/RenderQueueWorker.php --daemon           # Daemon modunda ??al????
 *   php workers/RenderQueueWorker.php --once             # Tek i?? i??le ve ????k
 *   php workers/RenderQueueWorker.php --company=UUID     # Belirli firma i??in
 *   php workers/RenderQueueWorker.php --status           # Durum bilgisi
 *
 * @version 1.0.0
 */

// CLI check
if (php_sapi_name() !== 'cli') {
    die("Bu script sadece CLI'dan ??al????t??r??labilir.\n");
}

// Config y??kle
require_once __DIR__ . '/../config.php';
require_once BASE_PATH . '/services/RenderQueueService.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';
require_once BASE_PATH . '/services/HanshowGateway.php';
require_once BASE_PATH . '/services/MqttBrokerService.php';
require_once BASE_PATH . '/services/dal/DeviceAdapterRegistry.php';

class RenderQueueWorker
{
    private RenderQueueService $queueService;
    private PavoDisplayGateway $gateway;
    private MqttBrokerService $mqttService;
    private $db;

    // Worker ayarlar??
    private int $pollInterval = 2;          // Saniye - queue kontrol?? aral??????
    private int $batchSize = 10;            // Ayn?? anda i??lenecek cihaz say??s??
    private int $maxRuntime = 3600;         // Maksimum ??al????ma s??resi (1 saat)
    private bool $daemon = false;           // Daemon modunda m???
    private bool $verbose = true;           // Detayl?? ????kt??
    private ?string $companyId = null;      // Belirli firma i??in mi?
    private bool $running = true;           // ??al????ma durumu

    // ??statistikler
    private int $jobsProcessed = 0;
    private int $devicesProcessed = 0;
    private int $devicesSuccessful = 0;
    private int $devicesFailed = 0;
    private float $startTime;
    private array $companyRuntimeConfigCache = [];

    public function __construct()
    {
        $this->queueService = new RenderQueueService();
        $this->gateway = new PavoDisplayGateway();
        $this->mqttService = new MqttBrokerService();
        $this->db = Database::getInstance();
        $this->startTime = microtime(true);

        // SIGTERM/SIGINT handler (graceful shutdown)
        if (function_exists('pcntl_signal')) {
            pcntl_signal(SIGTERM, [$this, 'handleSignal']);
            pcntl_signal(SIGINT, [$this, 'handleSignal']);
        }
    }

    /**
     * Sinyal handler (graceful shutdown)
     */
    public function handleSignal(int $signal): void
    {
        $this->log("Sinyal al??nd?? ($signal), kapat??l??yor...", 'warn');
        $this->running = false;
    }

    /**
     * Worker'?? ba??lat
     */
    public function run(): void
    {
        $this->log("=== RenderQueueWorker Ba??lat??ld?? ===");
        $this->log("Daemon: " . ($this->daemon ? 'Evet' : 'Hay??r'));
        $this->log("Poll Interval: {$this->pollInterval}s");
        $this->log("Batch Size: {$this->batchSize}");

        if ($this->companyId) {
            $this->log("Firma: {$this->companyId}");
        }

        $this->log("---");

        $emptyLoops = 0;
        $maxEmptyLoops = 30; // 30 * 2s = 60s bo?? beklemeden sonra slow mode

        while ($this->running) {
            // Signal check (pcntl varsa)
            if (function_exists('pcntl_signal_dispatch')) {
                pcntl_signal_dispatch();
            }

            // Max runtime kontrol??
            $runtime = microtime(true) - $this->startTime;
            if ($runtime > $this->maxRuntime) {
                $this->log("Maksimum ??al????ma s??resine ula????ld?? ({$this->maxRuntime}s)", 'warn');
                break;
            }

            // Queue'dan i?? al
            $job = $this->queueService->dequeue($this->companyId);

            if ($job) {
                $emptyLoops = 0;
                $this->processJob($job);
                $this->jobsProcessed++;

                // Daemon de??ilse veya --once modundaysa ????k
                if (!$this->daemon) {
                    break;
                }
            } else {
                $emptyLoops++;

                // Daemon modunda de??ilse ve i?? yoksa ????k
                if (!$this->daemon) {
                    $this->log("Bekleyen i?? yok, ????k??l??yor.");
                    break;
                }

                // Slow mode - ??ok uzun s??redir i?? yoksa interval'i art??r
                $sleepTime = $emptyLoops > $maxEmptyLoops ? 10 : $this->pollInterval;

                if ($this->verbose && $emptyLoops % 15 === 0) {
                    $this->log("Bekleyen i?? yok, bekleniyor... (empty loops: $emptyLoops)");
                }

                sleep($sleepTime);
            }
        }

        $this->printStats();
    }

    /**
     * Tek bir job'?? i??le
     */
    private function processJob(array $job): void
    {
        $queueId = $job['id'];
        $jobType = (string)($job['job_type'] ?? '');
        $autoRetryDisabledForJobType = in_array($jobType, ['auto_send', 'bulk_send'], true);
        $this->log("???? ba??lat??ld??: $queueId (Priority: {$job['priority']}, Devices: {$job['device_count']})");

        $startTime = microtime(true);

        try {
            // 1. Render parametrelerini haz??rla
            $renderParams = $this->prepareRenderParams($job);

            if (!$renderParams['success']) {
                throw new Exception($renderParams['error']);
            }

            // 2. Cache'den veya render'dan g??rsel al
            $imagePath = $this->getOrRenderImage($job, $renderParams);

            if (!$imagePath || !file_exists($imagePath)) {
                throw new Exception("G??rsel olu??turulamad?? veya bulunamad??");
            }

            $this->log("  G??rsel haz??r: " . basename($imagePath));

            // 3. Pending item'lar?? batch'ler halinde i??le
            $totalProcessed = 0;
            $totalSuccess = 0;
            $totalFailed = 0;
            $totalSkipped = 0;

            while (true) {
                $items = $this->queueService->getPendingItems($queueId, $this->batchSize);

                if (empty($items)) {
                    break;
                }

                $this->log("  Batch i??leniyor: " . count($items) . " cihaz");

                // DAL feature flag kontrolu
                $dalEnabled = $this->isDalEnabled($job['company_id'] ?? null);
                if ($dalEnabled) {
                    $result = $this->sendToDevicesBatchDAL($items, $imagePath, $job);
                } else {
                    // Mevcut Phase 1 paralel gonderim (fallback)
                    $result = $this->sendToDevicesBatch($items, $imagePath, $job);
                }

                $totalProcessed += $result['processed'];
                $totalSuccess += $result['success'];
                $totalFailed += $result['failed'];
                $totalSkipped += $result['skipped'];

                // Progress g??ncelle
                $progress = $this->queueService->updateQueueProgress($queueId);
                $this->log("  ??lerleme: {$progress['progress']}% ({$progress['completed']}/{$progress['total']})");
            }

            // 4. Job tamamland??
            $duration = round((microtime(true) - $startTime) * 1000);

            $this->db->update('render_queue', [
                'result' => json_encode([
                    'processed' => $totalProcessed,
                    'success' => $totalSuccess,
                    'failed' => $totalFailed,
                    'skipped' => $totalSkipped,
                    'duration_ms' => $duration
                ]),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$queueId]);

            // Son progress kontrol??
            $finalProgress = $this->queueService->updateQueueProgress($queueId);

            $this->log("  ??? ???? tamamland??: {$duration}ms (Ba??ar??l??: $totalSuccess, Hatal??: $totalFailed, Atlanan: $totalSkipped)");

            // ??statistikleri g??ncelle
            $this->devicesProcessed += $totalProcessed;
            $this->devicesSuccessful += $totalSuccess;
            $this->devicesFailed += $totalFailed;

            // Hata varsa ve retry gerekiyorsa
            if ($totalFailed > 0 && $finalProgress['status'] !== 'completed' && !$autoRetryDisabledForJobType) {
                $this->handleJobRetry($queueId, $totalFailed);
            }

        } catch (Exception $e) {
            $this->log("  ??? ???? ba??ar??s??z: " . $e->getMessage(), 'error');

            // Job'?? failed olarak i??aretle ve retry planla
            $this->db->update('render_queue', [
                'error_message' => $e->getMessage(),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$queueId]);

            if ($autoRetryDisabledForJobType) {
                $this->db->update('render_queue', [
                    'status' => 'failed',
                    'completed_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ], 'id = ?', [$queueId]);
            } else {
                $this->handleJobRetry($queueId, $job['device_count']);
            }
        }
    }

    /**
     * Render parametrelerini haz??rla
     */
    private function prepareRenderParams(array $job): array
    {
        // Template bilgisi al
        $template = null;
        if (!empty($job['template_id'])) {
            $template = $this->db->fetch(
                "SELECT * FROM templates WHERE id = ?",
                [$job['template_id']]
            );
        }

        // ??r??n bilgisi al
        $product = null;
        if (!empty($job['product_id'])) {
            $product = $this->db->fetch(
                "SELECT * FROM products WHERE id = ?",
                [$job['product_id']]
            );
        }

        // Render params
        $renderParams = $job['render_params'] ?? [];

        // Varsay??lan de??erler (numeric-safe)
        $width = (isset($renderParams['width']) && is_numeric($renderParams['width']))
            ? (int)$renderParams['width']
            : 800;
        $height = (isset($renderParams['height']) && is_numeric($renderParams['height']))
            ? (int)$renderParams['height']
            : 1280;
        $locale = $renderParams['locale'] ?? 'tr';

        // Device type'a g??re boyut ayarla
        if ($template && !empty($template['target_device_type'])) {
            $presets = [
                'esl_101_portrait' => ['width' => 800, 'height' => 1280],
                'esl_101_landscape' => ['width' => 1280, 'height' => 800],
                'esl_75' => ['width' => 800, 'height' => 480],
                'esl_42' => ['width' => 400, 'height' => 300],
                'esl_29' => ['width' => 296, 'height' => 128]
            ];

            if (isset($presets[$template['target_device_type']])) {
                $width = $presets[$template['target_device_type']]['width'];
                $height = $presets[$template['target_device_type']]['height'];
            }
        }

        return [
            'success' => true,
            'template' => $template,
            'product' => $product,
            'width' => $width,
            'height' => $height,
            'locale' => $locale,
            'params' => $renderParams
        ];
    }

    /**
     * G??rsel al (cache'den veya render et)
     */
    private function getOrRenderImage(array $job, array $renderParams): ?string
    {
        $template = $renderParams['template'];
        $product = $renderParams['product'];

        if (!$template) {
            $this->log("  Template bulunamad??, basit g??rsel olu??turuluyor...");
            return $this->createSimpleImage($product, $renderParams);
        }

        // Cache key oluştur
        // Responsive modda: cihaz boyutu bazlı cache (her farklı boyut = ayrı cache)
        $responsiveMode = $template['responsive_mode'] ?? 'off';
        $resolution = $renderParams['width'] . 'x' . $renderParams['height'];
        if ($responsiveMode !== 'off' && !empty($renderParams['params']['device_resolution'])) {
            $resolution = $renderParams['params']['device_resolution'];
        }

        $cacheKey = $this->gateway->generateCacheKey(
            $template['id'],
            $template['version'] ?? '1',
            $product['id'] ?? 'no-product',
            $product['version'] ?? '1',
            $renderParams['locale'],
            $resolution,
            'esl_android'
        );

        // Cache'den kontrol et
        $cachePath = $this->gateway->getCachedRender($job['company_id'], 'esl_android', $cacheKey);

        if ($cachePath && file_exists($cachePath)) {
            $this->log("  Cache hit: $cacheKey");
            return $cachePath;
        }

        // Render et
        $this->log("  Cache miss, render ediliyor...");
        return $this->renderTemplate($job, $template, $product, $renderParams);
    }

    /**
     * Template'i render et
     */
    private function renderTemplate(array $job, array $template, ?array $product, array $params): ?string
    {
        // TemplateRenderer kullan (varsa)
        $rendererPath = BASE_PATH . '/services/TemplateRenderer.php';
        if (file_exists($rendererPath)) {
            require_once $rendererPath;
            $renderer = new TemplateRenderer();

            $result = $renderer->renderForDevice(
                $template['template_path'] ?? null,
                $product ?? [],
                null,
                [
                    'width' => $params['width'],
                    'height' => $params['height'],
                    'company_name' => $this->getCompanyName($job['company_id'])
                ]
            );

            if (!empty($result['image_file']) && file_exists($result['image_file'])) {
                return $result['image_file'];
            }
        }

        // Fallback: basit g??rsel olu??tur
        return $this->createSimpleImage($product, $params);
    }

    /**
     * Basit g??rsel olu??tur (template yoksa)
     */
    private function createSimpleImage(?array $product, array $params): ?string
    {
        $width = $params['width'] ?? 800;
        $height = $params['height'] ?? 1280;

        $img = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);

        imagefill($img, 0, 0, $white);

        if ($product) {
            // ??r??n ad??
            $name = $product['name'] ?? '??r??n';
            imagestring($img, 5, 50, 50, $name, $black);

            // Fiyat
            $price = $product['current_price'] ?? '0.00';
            imagestring($img, 5, 50, 100, "Fiyat: $price TL", $black);
        }

        // Ge??ici dosyaya kaydet
        $tempPath = sys_get_temp_dir() . '/render_' . uniqid() . '.jpg';
        imagejpeg($img, $tempPath, 90);
        imagedestroy($img);

        return $tempPath;
    }

    /**
     * Cihazlara batch halinde g??nder (Phase 1 paralel sistem)
     */
    private function sendToDevicesBatch(array $items, string $imagePath, array $job): array
    {
        $result = [
            'processed' => 0,
            'success' => 0,
            'failed' => 0,
            'skipped' => 0
        ];

        $renderParams = is_array($job['render_params'] ?? null)
            ? $job['render_params']
            : (json_decode($job['render_params'] ?? '{}', true) ?: []);

        $taskConfig = [
            'width' => $renderParams['width'] ?? 800,
            'height' => $renderParams['height'] ?? 1280,
            'priority' => $job['priority'] ?? 'normal'
        ];

        $runtimeConfig = $this->getCompanyRuntimeConfig($job['company_id'] ?? null);
        $gatewayEnabled = (bool)($runtimeConfig['gateway_enabled'] ?? true);
        $heartbeatTimeoutSeconds = (int)($runtimeConfig['gateway_heartbeat_timeout_seconds'] ?? 120);

        $directDevices = [];
        $directItemMap = [];
        $gatewayItems = [];
        $hanshowItems = [];
        $mqttItems = [];

        foreach ($items as $item) {
            $communicationMode = strtolower(trim((string)($item['communication_mode'] ?? 'http-server')));
            $deviceModel = strtolower(trim((string)($item['device_model'] ?? '')));
            $adapterId = strtolower(trim((string)($item['adapter_id'] ?? '')));
            $manufacturer = strtolower(trim((string)($item['manufacturer'] ?? '')));
            $deviceBrand = strtolower(trim((string)($item['device_brand'] ?? '')));
            $isHanshow = $deviceModel === 'hanshow_esl'
                || $adapterId === 'hanshow'
                || strpos($manufacturer, 'hanshow') !== false
                || strpos($deviceBrand, 'hanshow') !== false;

            // Hanshow ESL: RF tabanli, IP gerektirmez
            if ($isHanshow) {
                $hanshowItems[] = $item;
                continue;
            }

            if ($communicationMode === 'mqtt') {
                $mqttItems[] = $item;
                continue;
            }

            $heartbeatOk = false;
            if (!empty($item['gateway_last_heartbeat'])) {
                $lastHeartbeatTs = strtotime((string)$item['gateway_last_heartbeat']);
                if ($lastHeartbeatTs !== false) {
                    $heartbeatOk = (time() - $lastHeartbeatTs) <= $heartbeatTimeoutSeconds;
                }
            }

            $shouldUseGateway = $gatewayEnabled
                && !empty($item['gateway_id'])
                && ($item['gateway_status'] ?? '') === 'online'
                && $heartbeatOk;

            if ($shouldUseGateway) {
                $gatewayItems[] = $item;
                continue;
            }

            if (empty($item['ip_address']) || empty($item['client_id'])) {
                $this->queueService->updateItemStatus($item['id'], 'failed', 'Device network info missing');
                $this->queueService->incrementItemRetry($item['id']);
                $result['failed']++;
                $result['processed']++;
                continue;
            }

            $directDevices[] = [
                'id' => $item['device_id'],
                'ip_address' => $item['ip_address'],
                'device_id' => $item['client_id'],
                'type' => $item['device_type'],
                'name' => $item['device_name']
            ];
            $directItemMap[$item['device_id']] = $item;
        }

        // Hanshow ESL: HanshowGateway ile gonder
        if (!empty($hanshowItems)) {
            $hanshowResult = $this->sendToHanshowDevices($hanshowItems, $imagePath, $job);
            $result['processed'] += $hanshowResult['processed'];
            $result['success'] += $hanshowResult['success'];
            $result['failed'] += $hanshowResult['failed'];
        }

        if (!empty($mqttItems)) {
            $mqttResult = $this->sendToMqttDevices($mqttItems, $imagePath, $job, $taskConfig);
            $result['processed'] += $mqttResult['processed'];
            $result['success'] += $mqttResult['success'];
            $result['failed'] += $mqttResult['failed'];
        }

        if (!empty($directDevices)) {
            $this->gateway->sendToMultipleDevicesParallel(
                $directDevices,
                $imagePath,
                $taskConfig,
                function($deviceId, $status, $message) use (&$result, &$directItemMap) {
                    $item = $directItemMap[$deviceId] ?? null;
                    if (!$item) {
                        return;
                    }

                    $itemId = $item['id'];

                    if ($status === 'success') {
                        $this->queueService->updateItemStatus($itemId, 'completed');
                        $result['success']++;
                    } elseif ($status === 'skipped') {
                        $this->queueService->updateItemStatus(
                            $itemId,
                            'skipped',
                            null,
                            null,
                            null,
                            $message
                        );
                        $result['skipped']++;
                    } else {
                        $this->queueService->updateItemStatus($itemId, 'failed', $message ?: 'Direct send failed');
                        $this->queueService->incrementItemRetry($itemId);
                        $result['failed']++;
                    }

                    $result['processed']++;
                }
            );
        }

        $gatewayBatchResults = $this->processGatewayBatch($gatewayItems, $imagePath, $taskConfig, $job, $runtimeConfig);
        foreach ($gatewayItems as $item) {
            $gatewayResult = $gatewayBatchResults[$item['id']] ?? [
                'success' => false,
                'error' => 'Gateway batch result missing'
            ];

            if ($gatewayResult['success']) {
                $this->queueService->updateItemStatus(
                    $item['id'],
                    'completed',
                    null,
                    null,
                    $gatewayResult['md5'] ?? null
                );
                $result['success']++;
            } else {
                $this->queueService->updateItemStatus(
                    $item['id'],
                    'failed',
                    $gatewayResult['error'] ?? 'Gateway send failed'
                );
                $this->queueService->incrementItemRetry($item['id']);
                $result['failed']++;
            }

            $result['processed']++;
        }

        return $result;
    }

    /**
     * MQTT modundaki cihazlara payload yazip updatelabel komutu tetikler.
     */
    private function sendToMqttDevices(array $items, string $imagePath, array $job, array $taskConfig): array
    {
        $result = ['processed' => 0, 'success' => 0, 'failed' => 0];

        $companyId = (string)($job['company_id'] ?? '');
        $productId = (string)($job['product_id'] ?? '');
        $templateId = (string)($job['template_id'] ?? '');

        $product = [];
        if ($productId !== '') {
            $row = $this->db->fetch("SELECT * FROM products WHERE id = ?", [$productId]);
            if (is_array($row)) {
                $product = $row;
            }
        }

        $designData = [];
        if ($templateId !== '') {
            $template = $this->db->fetch("SELECT design_data FROM templates WHERE id = ?", [$templateId]);
            $rawDesign = is_array($template) ? ($template['design_data'] ?? null) : null;
            if (is_string($rawDesign) && $rawDesign !== '') {
                $decodedDesign = json_decode($rawDesign, true);
                if (is_array($decodedDesign)) {
                    $designData = $decodedDesign;
                }
            }
        }

        foreach ($items as $item) {
            $deviceId = (string)($item['device_id'] ?? '');
            if ($deviceId === '') {
                $result['failed']++;
                $result['processed']++;
                continue;
            }

            $deviceRow = [
                'id' => $deviceId,
                'device_id' => $item['client_id'] ?? null,
                'mqtt_client_id' => $item['mqtt_client_id'] ?? null,
                'screen_width' => $item['screen_width'] ?? null,
                'screen_height' => $item['screen_height'] ?? null
            ];

            $sendParams = [
                'image' => $imagePath,
                'width' => (int)($taskConfig['width'] ?? 800),
                'height' => (int)($taskConfig['height'] ?? 1280),
                'priority' => $taskConfig['priority'] ?? 'normal',
                'product' => $product
            ];
            if (!empty($designData)) {
                $sendParams['design_data'] = $designData;
            }

            $mqttResult = $this->mqttService->queueContentUpdate(
                $deviceRow,
                $sendParams,
                $companyId,
                $templateId !== '' ? $templateId : null,
                $productId !== '' ? $productId : null
            );

            if (!empty($mqttResult['success'])) {
                $this->queueService->updateItemStatus($item['id'], 'completed');
                $result['success']++;
            } else {
                $error = (string)($mqttResult['error'] ?? 'MQTT delivery failed');
                $this->queueService->updateItemStatus($item['id'], 'failed', $error);
                $this->queueService->incrementItemRetry($item['id']);
                $result['failed']++;
            }

            $result['processed']++;
        }

        return $result;
    }

    /**
     * Hanshow ESL cihazlarina HanshowGateway ile gonder
     */
    private function sendToHanshowDevices(array $items, string $imagePath, array $job): array
    {
        $result = ['processed' => 0, 'success' => 0, 'failed' => 0];

        if (!file_exists($imagePath)) {
            foreach ($items as $item) {
                $this->queueService->updateItemStatus($item['id'], 'failed', 'Render image missing');
                $this->queueService->incrementItemRetry($item['id']);
                $result['failed']++;
                $result['processed']++;
            }
            return $result;
        }

        try {
            $hanshowGateway = new HanshowGateway();
            $imageBase64 = base64_encode(file_get_contents($imagePath));

            foreach ($items as $item) {
                $eslId = $item['client_id'] ?? '';
                if (empty($eslId)) {
                    $this->queueService->updateItemStatus($item['id'], 'failed', 'ESL ID missing');
                    $this->queueService->incrementItemRetry($item['id']);
                    $result['failed']++;
                    $result['processed']++;
                    continue;
                }

                try {
                    $sendResult = $hanshowGateway->sendImageToESL($eslId, $imageBase64, [
                        'priority' => $job['priority'] === 'urgent' ? 1 : 10
                    ]);

                    // errno: 0 = immediate success, 1 = accepted/in processing (async)
                    $errno = isset($sendResult['errno']) ? (int)$sendResult['errno'] : -1;
                    if ($errno === 0 || $errno === 1) {
                        $this->queueService->updateItemStatus($item['id'], 'completed');
                        $result['success']++;
                    } else {
                        $errMsg = $sendResult['errmsg'] ?? 'Hanshow send failed';
                        $this->queueService->updateItemStatus($item['id'], 'failed', $errMsg);
                        $this->queueService->incrementItemRetry($item['id']);
                        $result['failed']++;
                    }
                } catch (\Exception $e) {
                    $this->queueService->updateItemStatus($item['id'], 'failed', $e->getMessage());
                    $this->queueService->incrementItemRetry($item['id']);
                    $result['failed']++;
                }

                $result['processed']++;
            }
        } catch (\Exception $e) {
            foreach ($items as $item) {
                $this->queueService->updateItemStatus($item['id'], 'failed', 'HanshowGateway init failed: ' . $e->getMessage());
                $this->queueService->incrementItemRetry($item['id']);
                $result['failed']++;
                $result['processed']++;
            }
        }

        return $result;
    }

    private function processGatewayBatch(
        array $gatewayItems,
        string $imagePath,
        array $taskConfig,
        array $job,
        array $runtimeConfig
    ): array {
        $results = [];
        if (empty($gatewayItems)) {
            return $results;
        }

        if (!file_exists($imagePath)) {
            foreach ($gatewayItems as $item) {
                $results[$item['id']] = [
                    'success' => false,
                    'error' => 'Render image missing for gateway send'
                ];
            }
            return $results;
        }

        $imageMd5 = @md5_file($imagePath) ?: null;
        $imageSize = @filesize($imagePath) ?: 0;

        $timeout = max(5, (int)($runtimeConfig['gateway_command_timeout_seconds'] ?? 20));
        $pollIntervalMs = max(100, (int)($runtimeConfig['gateway_poll_interval_ms'] ?? 500));
        $pollIntervalUs = $pollIntervalMs * 1000;

        $commandMap = [];

        foreach ($gatewayItems as $item) {
            $gatewayId = $item['gateway_id'] ?? null;
            $deviceIp = $item['gateway_local_ip'] ?? $item['ip_address'] ?? null;
            $clientId = $item['client_id'] ?? null;

            if (!$gatewayId) {
                $results[$item['id']] = ['success' => false, 'error' => 'Gateway id missing'];
                continue;
            }
            if (!$deviceIp || !$clientId) {
                $results[$item['id']] = ['success' => false, 'error' => 'Gateway device network info missing'];
                continue;
            }

            $commandParams = [
                'device_id' => $item['device_id'],
                'device_ip' => $deviceIp,
                'client_id' => $clientId,
                'type' => 'image',
                'layout' => 'single',
                'width' => (int)($taskConfig['width'] ?? 800),
                'height' => (int)($taskConfig['height'] ?? 1280),
                'product' => [],
                'design_data' => [],
                'image_path' => $imagePath,
                'image_md5' => $imageMd5,
                'image_size' => (int)$imageSize,
                'video_paths' => [],
                'queue_id' => $job['id'] ?? null
            ];

            $jsonParams = json_encode($commandParams);
            if ($jsonParams === false) {
                $results[$item['id']] = ['success' => false, 'error' => 'Gateway params encode failed'];
                continue;
            }

            $commandId = $this->db->generateUuid();
            $this->db->insert('gateway_commands', [
                'id' => $commandId,
                'gateway_id' => $gatewayId,
                'device_id' => $item['device_id'],
                'command' => 'send_label',
                'parameters' => $jsonParams,
                'status' => 'pending',
                'created_at' => date('Y-m-d H:i:s')
            ]);

            $commandMap[$commandId] = [
                'item_id' => $item['id'],
                'md5' => $imageMd5
            ];
        }

        if (empty($commandMap)) {
            return $results;
        }

        $pendingIds = array_keys($commandMap);
        $startTime = time();

        while (!empty($pendingIds) && (time() - $startTime) < $timeout) {
            $placeholders = implode(',', array_fill(0, count($pendingIds), '?'));
            $rows = $this->db->fetchAll(
                "SELECT id, status, result, error_message FROM gateway_commands WHERE id IN ($placeholders)",
                $pendingIds
            );

            foreach ($rows as $row) {
                $commandId = $row['id'];
                if (!isset($commandMap[$commandId])) {
                    continue;
                }

                if ($row['status'] === 'completed') {
                    $cmdResult = json_decode($row['result'] ?? '', true) ?: [];
                    $results[$commandMap[$commandId]['item_id']] = [
                        'success' => (bool)($cmdResult['success'] ?? true),
                        'error' => $cmdResult['error'] ?? null,
                        'md5' => $commandMap[$commandId]['md5']
                    ];
                    unset($commandMap[$commandId]);
                } elseif ($row['status'] === 'failed' || $row['status'] === 'timeout') {
                    $results[$commandMap[$commandId]['item_id']] = [
                        'success' => false,
                        'error' => $row['error_message'] ?? 'Gateway command failed'
                    ];
                    unset($commandMap[$commandId]);
                }
            }

            $pendingIds = array_keys($commandMap);
            if (!empty($pendingIds)) {
                usleep($pollIntervalUs);
            }
        }

        if (!empty($commandMap)) {
            $timeoutIds = array_keys($commandMap);
            $timeoutPlaceholders = implode(',', array_fill(0, count($timeoutIds), '?'));
            $params = array_merge(['Gateway response timeout after ' . $timeout . 's'], $timeoutIds);
            $this->db->query(
                "UPDATE gateway_commands
                 SET status = 'timeout',
                     error_message = ?,
                     completed_at = CURRENT_TIMESTAMP
                 WHERE id IN ($timeoutPlaceholders)
                   AND status IN ('pending', 'sent', 'executing')",
                $params
            );

            foreach ($commandMap as $meta) {
                $results[$meta['item_id']] = [
                    'success' => false,
                    'error' => 'Gateway response timeout',
                    'retryable' => true
                ];
            }
        }

        return $results;
    }

    private function getCompanyRuntimeConfig(?string $companyId): array
    {
        if (empty($companyId)) {
            return [
                'gateway_enabled' => true,
                'gateway_heartbeat_timeout_seconds' => 120,
                'gateway_command_timeout_seconds' => 20,
                'gateway_poll_interval_ms' => 500
            ];
        }

        if (isset($this->companyRuntimeConfigCache[$companyId])) {
            return $this->companyRuntimeConfigCache[$companyId];
        }

        $config = [
            'gateway_enabled' => true,
            'gateway_heartbeat_timeout_seconds' => 120,
            'gateway_command_timeout_seconds' => 20,
            'gateway_poll_interval_ms' => 500,
            'dal_enabled' => false,  // Device Abstraction Layer (varsayilan: pasif)
        ];

        $companySettings = $this->db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );

        if ($companySettings && !empty($companySettings['data'])) {
            $settingsData = json_decode($companySettings['data'], true) ?: [];
            if (isset($settingsData['gateway_enabled'])) {
                $config['gateway_enabled'] = (bool)$settingsData['gateway_enabled'];
            }
            if (isset($settingsData['gateway_heartbeat_timeout_seconds'])) {
                $config['gateway_heartbeat_timeout_seconds'] = max(30, (int)$settingsData['gateway_heartbeat_timeout_seconds']);
            }
            if (isset($settingsData['gateway_command_timeout_seconds'])) {
                $config['gateway_command_timeout_seconds'] = max(5, (int)$settingsData['gateway_command_timeout_seconds']);
            }
            if (isset($settingsData['gateway_poll_interval_ms'])) {
                $config['gateway_poll_interval_ms'] = max(100, (int)$settingsData['gateway_poll_interval_ms']);
            }
            if (isset($settingsData['dal_enabled'])) {
                $config['dal_enabled'] = (bool)$settingsData['dal_enabled'];
            }
        }

        $this->companyRuntimeConfigCache[$companyId] = $config;
        return $config;
    }

    private function isGatewayEnabledForCompany(?string $companyId): bool
    {
        $config = $this->getCompanyRuntimeConfig($companyId);
        return (bool)($config['gateway_enabled'] ?? true);
    }

    /**
     * DAL (Device Abstraction Layer) aktif mi kontrol et.
     * Settings tablosundan dal_enabled ayarini okur.
     */
    private function isDalEnabled(?string $companyId): bool
    {
        $config = $this->getCompanyRuntimeConfig($companyId);
        return (bool)($config['dal_enabled'] ?? false);
    }

    /**
     * DAL tabanli cihaz gonderimi.
     * DeviceAdapterRegistry uzerinden her cihaz icin dogru adapter'i cozer
     * ve adapter arayuzu uzerinden gonderim yapar.
     *
     * Mevcut sendToDevicesBatch() ile ayni giris/cikis formatini kullanir.
     */
    private function sendToDevicesBatchDAL(array $items, string $imagePath, array $job): array
    {
        $result = [
            'processed' => 0,
            'success'   => 0,
            'failed'    => 0,
            'skipped'   => 0,
        ];

        $renderParams = is_array($job['render_params'] ?? null)
            ? $job['render_params']
            : (json_decode($job['render_params'] ?? '{}', true) ?: []);

        $options = [
            'width'       => $renderParams['width'] ?? 800,
            'height'      => $renderParams['height'] ?? 1280,
            'priority'    => $job['priority'] ?? 'normal',
            'template_id' => $job['template_id'] ?? null,
            'product_id'  => $job['product_id'] ?? null,
        ];

        $registry = DeviceAdapterRegistry::getInstance();

        // Cihazlari adapter'a gore grupla (batch optimizasyonu icin)
        $adapterGroups = [];
        foreach ($items as $item) {
            $deviceRow = $this->buildDeviceRowForDAL($item);
            $adapter = $registry->resolveWithGateway($deviceRow);
            $adapterId = $adapter->getAdapterId();

            if (!isset($adapterGroups[$adapterId])) {
                $adapterGroups[$adapterId] = [
                    'adapter' => $adapter,
                    'entries' => [],
                ];
            }
            $adapterGroups[$adapterId]['entries'][] = [
                'item'   => $item,
                'device' => $deviceRow,
            ];
        }

        foreach ($adapterGroups as $adapterId => $group) {
            $adapter = $group['adapter'];
            $entries = $group['entries'];
            $caps = $adapter->getCapabilities();

            // PavoDisplay batch optimizasyonu: batch_send yetenegi varsa ve birden fazla cihaz varsa
            if (!empty($caps['batch_send']) && count($entries) > 1 && ($adapter instanceof PavoDisplayAdapter)) {
                $batchResult = $this->processPavoDisplayBatchDAL($adapter, $entries, $imagePath, $options, $job);
                $result['processed'] += $batchResult['processed'];
                $result['success']   += $batchResult['success'];
                $result['failed']    += $batchResult['failed'];
                $result['skipped']   += $batchResult['skipped'];
                continue;
            }

            // Tek tek gonderim
            foreach ($entries as $entry) {
                $item = $entry['item'];
                $device = $entry['device'];
                $itemId = $item['id'];

                try {
                    $sendResult = $adapter->sendContent($device, $imagePath, $options);

                    if (!empty($sendResult['skipped'])) {
                        $this->queueService->updateItemStatus(
                            $itemId, 'skipped', null, null, null,
                            $sendResult['reason'] ?? 'Delta match'
                        );
                        $result['skipped']++;
                    } elseif (!empty($sendResult['success'])) {
                        $this->queueService->updateItemStatus(
                            $itemId, 'completed', null, null,
                            $sendResult['md5'] ?? null
                        );
                        $result['success']++;
                    } else {
                        $error = $sendResult['error'] ?? 'Send failed via ' . $adapterId;
                        $this->queueService->updateItemStatus($itemId, 'failed', $error);
                        $this->queueService->incrementItemRetry($itemId);
                        $result['failed']++;
                    }
                } catch (\Exception $e) {
                    $this->queueService->updateItemStatus($itemId, 'failed', $e->getMessage());
                    $this->queueService->incrementItemRetry($itemId);
                    $result['failed']++;
                }

                $result['processed']++;
            }
        }

        return $result;
    }

    /**
     * PavoDisplay batch gonderimi (DAL versiyonu).
     * Mevcut sendToMultipleDevicesParallel callback mekanizmasini kullanir.
     */
    private function processPavoDisplayBatchDAL(PavoDisplayAdapter $adapter, array $entries, string $imagePath, array $options, array $job): array
    {
        $batchResult = ['processed' => 0, 'success' => 0, 'failed' => 0, 'skipped' => 0];

        // item map olustur (device ID -> queue item eslestirmesi)
        $itemMap = [];
        $devices = [];
        foreach ($entries as $entry) {
            $device = $entry['device'];
            $item = $entry['item'];

            if (empty($device['ip_address']) || empty($device['device_id'])) {
                $this->queueService->updateItemStatus($item['id'], 'failed', 'Device network info missing');
                $this->queueService->incrementItemRetry($item['id']);
                $batchResult['failed']++;
                $batchResult['processed']++;
                continue;
            }

            $devices[] = $device;
            $itemMap[$device['id']] = $item;
        }

        if (empty($devices)) {
            return $batchResult;
        }

        $taskConfig = [
            'width'    => $options['width'] ?? 800,
            'height'   => $options['height'] ?? 1280,
            'priority' => $options['priority'] ?? 'normal',
        ];

        $adapter->sendBatch(
            $devices,
            $imagePath,
            $taskConfig,
            function ($deviceId, $status, $message) use (&$batchResult, &$itemMap) {
                $item = $itemMap[$deviceId] ?? null;
                if (!$item) return;

                $itemId = $item['id'];

                if ($status === 'success') {
                    $this->queueService->updateItemStatus($itemId, 'completed');
                    $batchResult['success']++;
                } elseif ($status === 'skipped') {
                    $this->queueService->updateItemStatus($itemId, 'skipped', null, null, null, $message);
                    $batchResult['skipped']++;
                } else {
                    $this->queueService->updateItemStatus($itemId, 'failed', $message ?: 'Direct send failed');
                    $this->queueService->incrementItemRetry($itemId);
                    $batchResult['failed']++;
                }

                $batchResult['processed']++;
            }
        );

        return $batchResult;
    }

    /**
     * Render queue item'indan DAL icin cihaz satiri olustur.
     */
    private function buildDeviceRowForDAL(array $item): array
    {
        return [
            'id'                     => $item['device_id'] ?? '',
            'ip_address'             => $item['ip_address'] ?? null,
            'device_id'              => $item['client_id'] ?? null,
            'type'                   => $item['device_type'] ?? 'esl',
            'model'                  => $item['device_model'] ?? null,
            'name'                   => $item['device_name'] ?? '',
            'communication_mode'     => $item['communication_mode'] ?? 'http-server',
            'mqtt_client_id'         => $item['mqtt_client_id'] ?? null,
            'mqtt_topic'             => $item['mqtt_topic'] ?? null,
            'screen_width'           => $item['screen_width'] ?? null,
            'screen_height'          => $item['screen_height'] ?? null,
            'adapter_id'             => $item['adapter_id'] ?? null,
            'manufacturer'           => $item['manufacturer'] ?? null,
            'device_brand'           => $item['device_brand'] ?? null,
            'company_id'             => $item['company_id'] ?? null,
            'gateway_id'             => $item['gateway_id'] ?? null,
            'gateway_status'         => $item['gateway_status'] ?? null,
            'gateway_local_ip'       => $item['gateway_local_ip'] ?? null,
            'gateway_last_heartbeat' => $item['gateway_last_heartbeat'] ?? null,
        ];
    }

    private function handleJobRetry(string $queueId, int $failedCount): void
    {
        $queue = $this->db->fetch("SELECT * FROM render_queue WHERE id = ?", [$queueId]);

        if (!$queue || $queue['status'] === 'completed') {
            return;
        }

        // Hata tipini belirle
        $errorType = 'unknown';
        if (!empty($queue['error_message'])) {
            $errorType = $this->queueService->detectErrorType($queue['error_message']);
        }

        // Retry planla
        $retryResult = $this->queueService->scheduleRetry($queueId, $errorType);

        if ($retryResult['success']) {
            $this->log("  ??? Retry planland??: #{$retryResult['retry_count']} ({$retryResult['backoff_seconds']}s sonra)");
        } else {
            $this->log("  ??? Retry ba??ar??s??z: " . ($retryResult['error'] ?? 'Bilinmeyen hata'), 'warn');
        }
    }

    /**
     * Firma ad??n?? al
     */
    private function getCompanyName(string $companyId): string
    {
        $company = $this->db->fetch("SELECT name FROM companies WHERE id = ?", [$companyId]);
        return $company['name'] ?? 'Omnex';
    }

    /**
     * Log yaz
     */
    private function log(string $message, string $level = 'info'): void
    {
        if (!$this->verbose && $level === 'info') {
            return;
        }

        $timestamp = date('Y-m-d H:i:s');
        $prefix = match($level) {
            'error' => "\033[31m[ERROR]\033[0m",
            'warn' => "\033[33m[WARN]\033[0m",
            'success' => "\033[32m[OK]\033[0m",
            default => "\033[36m[INFO]\033[0m"
        };

        echo "[$timestamp] $prefix $message\n";
    }

    /**
     * ??statistikleri yazd??r
     */
    private function printStats(): void
    {
        $runtime = round(microtime(true) - $this->startTime, 2);

        $this->log("---");
        $this->log("=== Worker ??statistikleri ===");
        $this->log("??al????ma S??resi: {$runtime}s");
        $this->log("????lenen Job: {$this->jobsProcessed}");
        $this->log("????lenen Cihaz: {$this->devicesProcessed}");
        $this->log("Ba??ar??l??: {$this->devicesSuccessful}");
        $this->log("Ba??ar??s??z: {$this->devicesFailed}");

        if ($this->devicesProcessed > 0) {
            $successRate = round(($this->devicesSuccessful / $this->devicesProcessed) * 100, 1);
            $this->log("Ba??ar?? Oran??: {$successRate}%");
        }

        $this->log("=============================");
    }

    /**
     * Durum bilgisini g??ster
     */
    public function showStatus(): void
    {
        $stats = $this->queueService->getStats($this->companyId);

        echo "\n=== Render Queue Durumu ===\n\n";
        echo "Toplam Job: " . ($stats['total'] ?? 0) . "\n";
        echo "Bekleyen: " . ($stats['pending'] ?? 0) . "\n";
        echo "????leniyor: " . ($stats['processing'] ?? 0) . "\n";
        echo "Tamamlanan: " . ($stats['completed'] ?? 0) . "\n";
        echo "Ba??ar??s??z: " . ($stats['failed'] ?? 0) . "\n";
        echo "??ptal: " . ($stats['cancelled'] ?? 0) . "\n";
        echo "\n";
        echo "Toplam Cihaz: " . ($stats['total_devices'] ?? 0) . "\n";
        echo "Ba??ar??l?? G??nderim: " . ($stats['completed_devices'] ?? 0) . "\n";
        echo "Ba??ar??s??z G??nderim: " . ($stats['failed_devices'] ?? 0) . "\n";
        echo "Atlanan: " . ($stats['skipped_devices'] ?? 0) . "\n";
        echo "\n===========================\n";
    }

    // Setter metodlar??
    public function setDaemon(bool $daemon): self
    {
        $this->daemon = $daemon;
        return $this;
    }

    public function setVerbose(bool $verbose): self
    {
        $this->verbose = $verbose;
        return $this;
    }

    public function setCompanyId(?string $companyId): self
    {
        $this->companyId = $companyId;
        return $this;
    }

    public function setPollInterval(int $interval): self
    {
        $this->pollInterval = max(1, $interval);
        return $this;
    }

    public function setBatchSize(int $size): self
    {
        $this->batchSize = max(1, min(50, $size));
        return $this;
    }

    public function setMaxRuntime(int $seconds): self
    {
        $this->maxRuntime = max(60, $seconds);
        return $this;
    }
}

// ============================================
// CLI EXECUTION
// ============================================

// Arg??manlar?? parse et
$options = getopt('', [
    'daemon',
    'once',
    'status',
    'company:',
    'batch:',
    'interval:',
    'runtime:',
    'quiet',
    'help'
]);

// Help
if (isset($options['help'])) {
    echo <<<HELP

RenderQueueWorker - Multi-Device Render Queue ????leyici

Kullan??m:
  php workers/RenderQueueWorker.php [se??enekler]

Se??enekler:
  --daemon          Daemon modunda ??al???? (s??rekli)
  --once            Tek i?? i??le ve ????k
  --status          Queue durumunu g??ster ve ????k
  --company=UUID    Belirli firma i??in i??le
  --batch=N         Batch boyutu (varsay??lan: 10, max: 50)
  --interval=N      Poll aral?????? saniye (varsay??lan: 2)
  --runtime=N       Maksimum ??al????ma s??resi saniye (varsay??lan: 3600)
  --quiet           Sessiz mod (sadece hatalar)
  --help            Bu yard??m?? g??ster

??rnekler:
  php workers/RenderQueueWorker.php --daemon
  php workers/RenderQueueWorker.php --once --company=abc-123
  php workers/RenderQueueWorker.php --status

HELP;
    exit(0);
}

// Worker olu??tur
$worker = new RenderQueueWorker();

// Se??enekleri uygula
if (isset($options['daemon'])) {
    $worker->setDaemon(true);
}

if (isset($options['quiet'])) {
    $worker->setVerbose(false);
}

if (isset($options['company'])) {
    $worker->setCompanyId($options['company']);
}

if (isset($options['batch'])) {
    $worker->setBatchSize((int)$options['batch']);
}

if (isset($options['interval'])) {
    $worker->setPollInterval((int)$options['interval']);
}

if (isset($options['runtime'])) {
    $worker->setMaxRuntime((int)$options['runtime']);
}

// Status modunda sadece durumu g??ster
if (isset($options['status'])) {
    $worker->showStatus();
    exit(0);
}

// Worker'?? ??al????t??r
$worker->run();

