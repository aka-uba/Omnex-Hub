<?php
/**
 * ESL Sign Validator
 *
 * PavoDisplay HTTP client protokolü için MD5 sign doğrulama servisi.
 * Hem HTTP hem MQTT modundaki cihazlar için ortak sign hesaplama/doğrulama sağlar.
 *
 * Sign Algoritması (PavoDisplay dokümantasyonu):
 * 1. Tüm URL parametrelerini (sign hariç) alfabetik sırala
 * 2. key1=value1&key2=value2 formatında birleştir
 * 3. Sonuna &key=AppSecret ekle
 * 4. MD5 al ve UPPERCASE yap
 *
 * Kullanım:
 *   $validator = new EslSignValidator();
 *   $settings = $validator->authenticate($appId, $sign, $params);
 *   if (!$settings) { // auth failed }
 */

class EslSignValidator
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * MD5 sign hesapla (PavoDisplay protokolü)
     *
     * @param array $params URL parametreleri (sign hariç)
     * @param string $appSecret AppSecret değeri
     * @return string Uppercase MD5 sign
     */
    public function calculateSign(array $params, string $appSecret): string
    {
        // sign parametresini çıkar
        unset($params['sign']);

        // Alfabetik sırala
        ksort($params);

        // key=value formatında birleştir
        $parts = [];
        foreach ($params as $key => $value) {
            $parts[] = $key . '=' . $value;
        }

        $stringSignTemp = implode('&', $parts) . '&key=' . $appSecret;

        return strtoupper(md5($stringSignTemp));
    }

    /**
     * AppID ile kimlik doğrulama yap
     *
     * 1. mqtt_settings tablosundan app_id eşleşmesi arar
     * 2. app_secret varsa sign doğrular
     * 3. Başarılıysa settings + company bilgisi döner
     *
     * @param string $appId Cihazdan gelen AppID
     * @param string $sign Cihazdan gelen sign
     * @param array $params Tüm istek parametreleri
     * @return array|null Settings veya null (auth failed)
     */
    public function authenticate(string $appId, string $sign, array $params): ?array
    {
        $appId = trim($appId);
        if ($appId === '') {
            return null;
        }

        // mqtt_settings'den app_id ile bul (HTTP ve MQTT ortak kullanır)
        $settings = $this->db->fetch(
            "SELECT ms.*, c.id as company_id, c.name as company_name
             FROM mqtt_settings ms
             JOIN companies c ON ms.company_id = c.id
             WHERE ms.app_id = ? AND ms.status IN ('active', 'testing')",
            [$appId]
        );

        if (!$settings) {
            return null;
        }

        // AppSecret boşsa sign kontrolü atla (geliştirme modu)
        if (empty($settings['app_secret'])) {
            return $settings;
        }

        // Sign doğrula
        if (empty($sign)) {
            return null;
        }

        $expectedSign = $this->calculateSign($params, $settings['app_secret']);
        if (hash_equals($expectedSign, strtoupper($sign))) {
            return $settings;
        }

        return null;
    }

    /**
     * Legacy fallback: AppID olmadan cihaz kaydına göre ayar bul
     *
     * Eski cihazlar veya appId göndermeyen cihazlar için:
     * - clientId ile cihaz bulunur
     * - Cihazın firma ayarları döner
     *
     * @param string $clientId Cihaz client ID (MAC/SN)
     * @param string|null $remoteIp Cihaz IP adresi
     * @return array|null Settings veya null
     */
    public function authenticateLegacy(string $clientId, ?string $remoteIp = null): ?array
    {
        $clientId = trim($clientId);
        if ($clientId === '') {
            return null;
        }

        // Cihazı bul (HTTP modunda olanlar)
        $device = $this->findDeviceByClientId($clientId, null);
        if (!$device) {
            return null;
        }

        // PavoDisplay cihazlar fabrika ayarlarında MQTT endpoint kullanabilir ama
        // BLE wizard ile communication_mode='http' olarak güncellenir.
        // Legacy auth'ta hem HTTP hem MQTT modunu kabul et — cihaz kimliği MAC ile doğrulanmış.
        $commMode = $device['communication_mode'] ?? 'http-server';
        if (!in_array($commMode, ['mqtt', 'http'], true)) {
            return null;
        }

        $companyId = $device['company_id'] ?? null;
        if (!$companyId) {
            return null;
        }

        // Firma ayarlarını getir
        $settings = $this->db->fetch(
            "SELECT ms.*, c.id as company_id, c.name as company_name
             FROM mqtt_settings ms
             JOIN companies c ON ms.company_id = c.id
             WHERE ms.company_id = ? AND ms.status IN ('active', 'testing')
             ORDER BY ms.created_at DESC
             LIMIT 1",
            [$companyId]
        );

        if ($settings) {
            return $settings;
        }

        if ($commMode === 'http') {
            $company = $this->db->fetch(
                "SELECT id, name FROM companies WHERE id = ? LIMIT 1",
                [$companyId]
            );
            if (!$company) {
                return null;
            }

            return [
                'company_id' => $company['id'],
                'company_name' => $company['name'],
                'status' => 'active',
                'app_id' => null,
                'app_secret' => null
            ];
        }

        return null;
    }

    /**
     * ClientID ile cihaz bul
     *
     * device_id veya mqtt_client_id alanlarında arar.
     * MAC adresi formatını normalize eder.
     *
     * @param string $clientId Cihaz client ID
     * @param string|null $companyId Firma ID (opsiyonel, izolasyon için)
     * @return array|null Cihaz kaydı veya null
     */
    public function findDeviceByClientId(string $clientId, ?string $companyId = null): ?array
    {
        $clientId = trim($clientId);
        if ($clientId === '') {
            return null;
        }

        // Normalize: iki nokta ve tire kaldır (MAC formatı)
        $normalizedId = str_replace([':', '-'], '', strtoupper($clientId));

        // Önce exact match dene
        $sql = "SELECT d.*, c.name as company_name
                FROM devices d
                JOIN companies c ON d.company_id = c.id
                WHERE (d.device_id = ? OR d.mqtt_client_id = ? OR REPLACE(REPLACE(UPPER(d.device_id), ':', ''), '-', '') = ?)";
        $params = [$clientId, $clientId, $normalizedId];

        if ($companyId) {
            $sql .= " AND d.company_id = ?";
            $params[] = $companyId;
        }

        $sql .= " AND d.status != 'deleted' LIMIT 1";

        return $this->db->fetch($sql, $params) ?: null;
    }

    /**
     * Cihaz heartbeat güncelle
     *
     * @param string $deviceId Cihaz UUID
     * @param array $info Cihaz bilgileri (version, battery, ip, vb.)
     */
    public function updateDeviceHeartbeat(string $deviceId, array $info = []): void
    {
        $updateData = [
            'last_seen' => date('Y-m-d H:i:s'),
            'status' => 'online',
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if (!empty($info['ip'])) {
            $updateData['ip_address'] = $info['ip'];
        }
        if (!empty($info['version'])) {
            $updateData['firmware_version'] = $info['version'];
        }

        $this->db->update('devices', $updateData, 'id = ?', [$deviceId]);

        // Heartbeat kaydı
        if (!empty($info)) {
            try {
                $this->db->insert('device_heartbeats', [
                    'id' => $this->db->generateUuid(),
                    'device_id' => $deviceId,
                    'battery_level' => $info['battery'] ?? null,
                    'signal_strength' => $info['wifi_signal'] ?? $info['signal_strength'] ?? null,
                    'uptime' => $info['uptime'] ?? null,
                    'storage_free' => isset($info['free_storage']) && $info['free_storage'] !== null && $info['free_storage'] !== ''
                        ? (int)$info['free_storage']
                        : null,
                    'ip_address' => $info['ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
                    'metadata' => json_encode([
                        'firmware_version' => $info['version'] ?? null,
                        'source' => 'esl_sign_validator'
                    ]),
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                // Heartbeat kaydı başarısız olsa bile devam et
                error_log("[EslSignValidator] heartbeat insert error: " . $e->getMessage());
            }
        }
    }

    /**
     * HTTP modundaki cihaz için içerik kuyruğuna ekle
     *
     * Render sonrası çağrılır. MQTT'nin queueContentUpdate'i gibi çalışır
     * ama MQTT bildirim göndermez (cihaz polling ile alacak).
     *
     * @param array $device Cihaz bilgileri
     * @param array $sendParams Gönderim parametreleri (image, videos, layout, vb.)
     * @param string $companyId Firma ID
     * @param string|null $templateId Şablon ID
     * @param string|null $productId Ürün ID
     * @return array Sonuç
     */
    public function queueContentForHttpDevice(
        array $device,
        array $sendParams,
        string $companyId,
        ?string $templateId = null,
        ?string $productId = null
    ): array {
        try {
            $deviceId = (string)($device['id'] ?? '');
            if ($deviceId === '') {
                return ['success' => false, 'error' => 'Geçersiz cihaz kaydı'];
            }

            $rawClientId = trim((string)($device['mqtt_client_id'] ?? $device['device_id'] ?? ''));
            if ($rawClientId === '') {
                return ['success' => false, 'error' => 'Cihaz client ID eksik'];
            }

            // Build HTTP payload directly and store it under http-payloads.

            // Fallback: sendParams'da image yoksa render cache'den bul
            if (empty($sendParams['image']) && ($templateId || $productId)) {
                $fallbackImage = $this->findFallbackImage($companyId, $templateId, $productId, $device);
                if ($fallbackImage) {
                    $sendParams['image'] = $fallbackImage;
                    error_log("[EslSignValidator] HTTP fallback image: {$fallbackImage}");
                }
            }

            // Fallback: sendParams'da video yoksa ürün/şablondan bul
            $videos = $sendParams['videos'] ?? [];
            if ((empty($videos) || !is_array($videos) || count($videos) === 0) && ($templateId || $productId)) {
                $fallbackVideos = $this->findFallbackVideos($companyId, $templateId, $productId, $device);
                if (!empty($fallbackVideos)) {
                    $sendParams['videos'] = $fallbackVideos;
                    error_log("[EslSignValidator] HTTP fallback videos: " . count($fallbackVideos));
                    // video_region yoksa şablondan hesapla
                    if (empty($sendParams['video_region'])) {
                        $width = (int)($sendParams['width'] ?? $device['screen_width'] ?? 800);
                        $height = (int)($sendParams['height'] ?? $device['screen_height'] ?? 1280);
                        $sendParams['video_region'] = $this->_detectVideoRegionFromTemplate($templateId, $width, $height);
                    }
                }
            }

            $width = (int)($sendParams['width'] ?? $device['screen_width'] ?? 800);
            $height = (int)($sendParams['height'] ?? $device['screen_height'] ?? 1280);
            $product = is_array($sendParams['product'] ?? null) ? $sendParams['product'] : [];

            $task = [
                'Id' => $rawClientId,
                'ItemCode' => (string)($product['sku'] ?? $product['id'] ?? $productId ?? 'ITEM'),
                'ItemName' => (string)($product['name'] ?? 'Product')
            ];

            $picture = $this->buildPicturePayload($companyId, $sendParams, $width, $height, $deviceId, $rawClientId);
            if (!empty($picture)) {
                $task['LabelPicture'] = $picture;
            }

            $video = $this->buildVideoPayload($companyId, $sendParams, $width, $height);
            if (!empty($video)) {
                $task['LabelVideo'] = $video;
            }

            if (empty($task['LabelPicture']) && empty($task['LabelVideo'])) {
                return [
                    'success' => false,
                    'error' => 'HTTP payload icin gorsel/video bulunamadi'
                ];
            }

            $contentVersion = sprintf('%u', crc32(json_encode($task, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
            $task['Nlast'] = (int)$contentVersion;

            $payloadWrapper = [
                'version' => 1,
                'company_id' => $companyId,
                'device_id' => $deviceId,
                'client_id' => $rawClientId,
                'template_id' => $templateId,
                'product_id' => $productId,
                'content_version' => (int)$contentVersion,
                'delivery_mode' => 'http',
                'updated_at' => date('Y-m-d H:i:s'),
                'task' => $task
            ];

            $httpPayloadDir = STORAGE_PATH . '/renders/' . $companyId . '/esl/http-payloads';
            if (!is_dir($httpPayloadDir)) {
                mkdir($httpPayloadDir, 0755, true);
            }

            $payloadFileName = $deviceId . '.json';
            $httpPayloadPath = $httpPayloadDir . '/' . $payloadFileName;
            $writeOk = file_put_contents(
                $httpPayloadPath,
                json_encode($payloadWrapper, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
            );
            if ($writeOk === false) {
                return [
                    'success' => false,
                    'error' => 'HTTP payload dosyasi yazilamadi'
                ];
            }

            $httpPayloadRelative = 'storage/renders/' . $companyId . '/esl/http-payloads/' . $payloadFileName;

            // Assignment'ı http_payload olarak güncelle
            $existingAssignment = $this->db->fetch(
                "SELECT id FROM device_content_assignments WHERE device_id = ? AND status = 'active'",
                [$deviceId]
            );

            if ($existingAssignment) {
                $this->db->update('device_content_assignments', [
                    'content_type' => 'http_payload',
                    'content_id' => $httpPayloadRelative
                ], 'id = ?', [$existingAssignment['id']]);
            } else {
                $this->db->insert('device_content_assignments', [
                    'id' => $this->db->generateUuid(),
                    'device_id' => $deviceId,
                    'content_type' => 'http_payload',
                    'content_id' => $httpPayloadRelative,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            }

            return [
                'success' => true,
                'delivery' => 'queued',
                'communication_mode' => 'http',
                'message' => 'İçerik HTTP kuyruğuna eklendi. Cihaz sonraki sorguda alacak.',
                'render_id' => $httpPayloadRelative,
                'file_path' => $picture['PicturePath'] ?? $httpPayloadRelative,
                'content_version' => (int)$contentVersion
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'HTTP kuyruk hatası: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Görsel payload oluştur (disk dosyası → URL + MD5)
     */
    private function buildPicturePayload(string $companyId, array $sendParams, int $width, int $height, string $deviceId, string $clientId): ?array
    {
        $imagePath = $sendParams['image'] ?? null;
        if (empty($imagePath) || !is_string($imagePath)) {
            return null;
        }

        $region = is_array($sendParams['image_region'] ?? null) ? $sendParams['image_region'] : [];
        $x = (int)($region['x'] ?? 0);
        $y = (int)($region['y'] ?? 0);
        $regionWidth = (int)($region['width'] ?? $width);
        $regionHeight = (int)($region['height'] ?? $height);

        // Dosya yolunu normalize et (Windows ters slash → forward slash)
        $normalizedPath = str_replace('\\', '/', trim($imagePath));
        $normalizedBasePath = str_replace('\\', '/', BASE_PATH);
        $normalizedStoragePath = str_replace('\\', '/', STORAGE_PATH);
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

        $prepared = $this->preparePictureAssetForHttp(
            $companyId,
            $sendParams,
            $fullPath,
            $deviceId,
            $clientId,
            $x,
            $y,
            $regionWidth,
            $regionHeight,
            $width,
            $height
        );
        if (is_array($prepared)) {
            $fullPath = $prepared['full_path'] ?? $fullPath;
            $relativePath = $prepared['relative_path'] ?? $relativePath;
        }

        $md5 = strtoupper((string)md5_file($fullPath));
        $fileName = basename($fullPath);

        $pictureUrl = $this->toPublicMediaUrl($companyId, $relativePath ?: $fullPath);
        if (!$pictureUrl) {
            return null;
        }

        return [
            'X' => $x,
            'Y' => $y,
            'Width' => $regionWidth,
            'Height' => $regionHeight,
            'PictureUrl' => $pictureUrl,
            'PictureMD5' => $md5,
            'PictureName' => $fileName,
            'PicturePath' => $pictureUrl
        ];
    }

    private function preparePictureAssetForHttp(
        string $companyId,
        array $sendParams,
        string $sourcePath,
        string $deviceId,
        string $clientId,
        int $x,
        int $y,
        int $regionWidth,
        int $regionHeight,
        int $deviceWidth,
        int $deviceHeight
    ): ?array {
        $designData = is_array($sendParams['design_data'] ?? null) ? $sendParams['design_data'] : [];
        $product = is_array($sendParams['product'] ?? null) ? $sendParams['product'] : [];
        $needsRegionProcessing = ($x > 0 || $y > 0 || $regionWidth !== $deviceWidth || $regionHeight !== $deviceHeight);
        $needsDynamicRender = !empty($designData) && !empty($product);

        if (!$needsRegionProcessing && !$needsDynamicRender) {
            return null;
        }
        if (!function_exists('imagecreatetruecolor') || !is_file($sourcePath)) {
            return null;
        }

        $imgInfo = @getimagesize($sourcePath);
        if (!is_array($imgInfo)) {
            return null;
        }

        $srcWidth = (int)($imgInfo[0] ?? 0);
        $srcHeight = (int)($imgInfo[1] ?? 0);
        if ($srcWidth <= 0 || $srcHeight <= 0 || $regionWidth <= 0 || $regionHeight <= 0 || $deviceWidth <= 0 || $deviceHeight <= 0) {
            return null;
        }

        $mime = strtolower((string)($imgInfo['mime'] ?? ''));
        $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
        $srcImage = null;
        if ($mime === 'image/png' || $ext === 'png') {
            $srcImage = @imagecreatefrompng($sourcePath);
        } elseif ($mime === 'image/jpeg' || $mime === 'image/jpg' || $ext === 'jpg' || $ext === 'jpeg') {
            $srcImage = @imagecreatefromjpeg($sourcePath);
        } elseif ($mime === 'image/webp' || $ext === 'webp') {
            if (function_exists('imagecreatefromwebp')) {
                $srcImage = @imagecreatefromwebp($sourcePath);
            }
        } elseif ($mime === 'image/gif' || $ext === 'gif') {
            $srcImage = @imagecreatefromgif($sourcePath);
        }

        if (!$srcImage) {
            return null;
        }

        // Region kırpma
        if ($needsRegionProcessing) {
            $scaleX = $srcWidth / max(1, $deviceWidth);
            $scaleY = $srcHeight / max(1, $deviceHeight);

            $cropX = max(0, min((int)round($x * $scaleX), max(0, $srcWidth - 1)));
            $cropY = max(0, min((int)round($y * $scaleY), max(0, $srcHeight - 1)));
            $cropW = max(1, (int)round($regionWidth * $scaleX));
            $cropH = max(1, (int)round($regionHeight * $scaleY));
            $cropW = min($cropW, $srcWidth - $cropX);
            $cropH = min($cropH, $srcHeight - $cropY);

            $croppedImage = imagecreatetruecolor($cropW, $cropH);
            imagecopy($croppedImage, $srcImage, 0, 0, $cropX, $cropY, $cropW, $cropH);
            imagedestroy($srcImage);
            $srcImage = $croppedImage;
            $srcWidth = $cropW;
            $srcHeight = $cropH;
        }

        $dstImage = imagecreatetruecolor($regionWidth, $regionHeight);
        $white = imagecolorallocate($dstImage, 255, 255, 255);
        imagefill($dstImage, 0, 0, $white);
        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $regionWidth, $regionHeight, $srcWidth, $srcHeight);
        imagedestroy($srcImage);

        // Dinamik alanları render et (metin, görsel, barkod — gölge, kenarlık, opacity dahil)
        if ($needsDynamicRender) {
            $templateWidth = (int)($designData['_templateWidth'] ?? $deviceWidth);
            $templateHeight = (int)($designData['_templateHeight'] ?? $deviceHeight);

            // Region kırpma varsa nesne koordinatlarını ayarla
            if ($needsRegionProcessing) {
                $adjustedDesignData = $designData;
                $adjustedDesignData['_templateWidth'] = $regionWidth;
                $adjustedDesignData['_templateHeight'] = $regionHeight;
                if (isset($adjustedDesignData['objects']) && is_array($adjustedDesignData['objects'])) {
                    $cropOffsetX = $x;
                    $cropOffsetY = $y;
                    $cropRight = $x + $regionWidth;
                    $cropBottom = $y + $regionHeight;

                    foreach ($adjustedDesignData['objects'] as &$obj) {
                        if (empty($obj['dynamicField']) && empty($obj['dynamic_field'])) {
                            continue;
                        }

                        $objLeft = (float)($obj['left'] ?? 0);
                        $objTop = (float)($obj['top'] ?? 0);
                        $objW = (float)(($obj['width'] ?? 0) * ($obj['scaleX'] ?? 1));
                        $objH = (float)(($obj['height'] ?? 0) * ($obj['scaleY'] ?? 1));
                        $objRight = $objLeft + $objW;
                        $objBottom = $objTop + $objH;

                        // Kırpma bölgesi dışındaki nesneleri gizle
                        if ($objRight < $cropOffsetX || $objLeft > $cropRight || $objBottom < $cropOffsetY || $objTop > $cropBottom) {
                            $obj['visible'] = false;
                            continue;
                        }

                        // Koordinatları kırpma bölgesine göre ayarla
                        $obj['left'] = $objLeft - $cropOffsetX;
                        $obj['top'] = $objTop - $cropOffsetY;
                    }
                    unset($obj);
                }

                $this->renderDynamicFieldsViaGateway(
                    $dstImage,
                    $adjustedDesignData,
                    $product,
                    $regionWidth,
                    $regionHeight,
                    $regionWidth,
                    $regionHeight
                );
            } else {
                $this->renderDynamicFieldsViaGateway(
                    $dstImage,
                    $designData,
                    $product,
                    $templateWidth,
                    $templateHeight,
                    $regionWidth,
                    $regionHeight
                );
            }
        }

        $assetDir = STORAGE_PATH . '/renders/cache/' . $companyId;
        if (!is_dir($assetDir)) {
            mkdir($assetDir, 0755, true);
        }

        $safeClientId = preg_replace('/[^A-Za-z0-9_-]/', '', $clientId);
        $fileName = 'http_' . $deviceId . '_' . ($safeClientId ?: 'client') . '_' . time() . '.jpg';
        $outputPath = $assetDir . '/' . $fileName;
        $saved = @imagejpeg($dstImage, $outputPath, 90);

        imagedestroy($dstImage);

        if (!$saved) {
            return null;
        }

        return [
            'full_path' => $outputPath,
            'relative_path' => 'storage/renders/cache/' . $companyId . '/' . $fileName
        ];
    }

    /**
     * PavoDisplayGateway'in renderDynamicFields metodunu Reflection ile çağırır.
     * Dinamik metin, görsel, barkod alanlarını GD imajına render eder.
     * Tüm görsel özellikler (opacity, shadow, stroke, rx/ry, angle) desteklenir.
     */
    private function renderDynamicFieldsViaGateway($image, array $designData, array $product, int $srcWidth, int $srcHeight, int $dstWidth, int $dstHeight): void
    {
        try {
            require_once BASE_PATH . '/services/PavoDisplayGateway.php';
            $gateway = new PavoDisplayGateway();
            $method = new ReflectionMethod($gateway, 'renderDynamicFields');

            if (method_exists($method, 'setAccessible')) {
                $method->setAccessible(true);
            }

            $method->invoke($gateway, $image, $designData, $product, $srcWidth, $srcHeight, $dstWidth, $dstHeight);
        } catch (Throwable $e) {
            error_log('[EslSignValidator] renderDynamicFields failed: ' . $e->getMessage());
        }
    }

    /**
     * Video payload oluştur
     */
    private function buildVideoPayload(string $companyId, array $sendParams, int $width, int $height): ?array
    {
        $videos = $sendParams['videos'] ?? [];
        if (empty($videos) || !is_array($videos)) {
            return null;
        }

        $normalizedBasePath = str_replace('\\', '/', BASE_PATH);
        $normalizedStoragePath = str_replace('\\', '/', STORAGE_PATH);
        $videoList = [];
        $videoNo = 1;

        foreach ($videos as $video) {
            // process.php düz string dizisi gönderir: ["/path/to/video.mp4", ...]
            // veya array formatı: [['path' => '...', 'duration' => 10], ...]
            $videoPath = null;
            $duration = 10;

            if (is_string($video)) {
                $videoPath = $video;
            } elseif (is_array($video)) {
                $videoPath = $video['path'] ?? $video['url'] ?? null;
                $duration = $video['duration'] ?? $video['switch_time'] ?? 10;
            }

            if (empty($videoPath) || !is_string($videoPath)) continue;

            $normalizedPath = str_replace('\\', '/', trim($videoPath));
            $videoUrl = $this->toPublicMediaUrl($companyId, $normalizedPath);
            $videoMd5 = '';

            if (!$videoUrl) {
                continue;
            }

            // Yerel dosya ise URL'ye çevir
            if (!preg_match('#^https?://#i', $normalizedPath)) {
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
                    $fullPath = $normalizedBasePath . '/' . $normalizedPath;
                } elseif (strpos($normalizedPath, '/') === 0) {
                    // /market-etiket-sistemi/storage/... formatı
                    $relativePath = ltrim($normalizedPath, '/');
                    $fullPath = $normalizedBasePath . '/' . $relativePath;
                    // BASE_PATH prefix'li olabilir
                    $baseName = basename($normalizedBasePath);
                    if ($baseName && strpos($relativePath, $baseName . '/') === 0) {
                        $relativePath = ltrim(substr($relativePath, strlen($baseName)), '/');
                        $fullPath = $normalizedBasePath . '/' . $relativePath;
                    }
                } else {
                    $relativePath = ltrim($normalizedPath, '/');
                    $fullPath = $normalizedBasePath . '/' . $relativePath;
                }

                // Windows path normalize
                $fullPath = str_replace('\\', '/', $fullPath ?? '');

                if ($fullPath && file_exists($fullPath)) {
                    $videoMd5 = strtoupper((string)md5_file($fullPath));
                } else {
                    error_log("[EslSignValidator] Video dosyası bulunamadı: {$fullPath} (orijinal: {$videoPath})");
                    continue;
                }
            }

            $videoList[] = [
                'VideoNo' => $videoNo++,
                'VideoName' => basename($videoPath),
                'VideoUrl' => $videoUrl,
                'VideoMD5' => $videoMd5,
                'VideoPath' => $videoUrl
            ];
        }

        if (empty($videoList)) {
            return null;
        }

        $videoRegion = $sendParams['video_region'] ?? null;

        return [
            'X' => (int)($videoRegion['x'] ?? 0),
            'Y' => (int)($videoRegion['y'] ?? 0),
            'Width' => (int)($videoRegion['width'] ?? $width),
            'Height' => (int)($videoRegion['height'] ?? (int)($height / 2)),
            'VideoList' => $videoList
        ];
    }

    private function toPublicMediaUrl(string $companyId, string $path): ?string
    {
        $normalized = str_replace('\\', '/', trim($path));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('#^https?://#i', $normalized)) {
            return $this->sanitizeBaseUrl($normalized);
        }

        $relative = ltrim($normalized, '/');
        $normalizedBasePath = str_replace('\\', '/', BASE_PATH);
        $normalizedStoragePath = str_replace('\\', '/', STORAGE_PATH);

        if (strpos($normalized, $normalizedStoragePath) === 0) {
            $relative = 'storage/' . ltrim(substr($normalized, strlen($normalizedStoragePath)), '/');
        } elseif (strpos($normalized, $normalizedBasePath) === 0) {
            $relative = ltrim(substr($normalized, strlen($normalizedBasePath)), '/');
        }

        $baseName = basename($normalizedBasePath);
        if ($baseName !== '' && strpos($relative, $baseName . '/') === 0) {
            $relative = ltrim(substr($relative, strlen($baseName)), '/');
        }

        if (strpos($relative, 'storage/') !== 0) {
            $relative = 'storage/' . $relative;
        }

        $base = rtrim($this->getCompanyContentBaseUrl($companyId), '/');
        if ($base === '') {
            return null;
        }

        return $base . '/' . ltrim($relative, '/');
    }

    private function getCompanyContentBaseUrl(string $companyId): string
    {
        $contentServerUrl = (string)($this->db->fetchColumn(
            "SELECT content_server_url
             FROM mqtt_settings
             WHERE company_id = ? AND status IN ('active', 'testing')
             ORDER BY created_at DESC
             LIMIT 1",
            [$companyId]
        ) ?? '');

        $contentServerUrl = $this->sanitizeBaseUrl($contentServerUrl);
        if ($contentServerUrl !== '' && preg_match('#^https?://#i', $contentServerUrl)) {
            return preg_replace('#/api/esl/(mqtt|http)/content/?$#i', '', rtrim($contentServerUrl, '/'));
        }

        $appUrl = $this->sanitizeBaseUrl((string)(defined('APP_URL') ? APP_URL : ''));
        if ($appUrl !== '') {
            return preg_replace('#/api/?$#i', '', rtrim($appUrl, '/'));
        }

        return rtrim($this->sanitizeBaseUrl($this->getServerBaseUrl()), '/');
    }

    private function sanitizeBaseUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        // Tipik yanlış giriş: http://l192.168.1.23/... -> http://192.168.1.23/...
        $url = preg_replace('#://l((?:\d{1,3}\.){3}\d{1,3})#i', '://$1', $url);

        return $url;
    }

    /**
     * Render cache, product_renders veya ürün görselleri arasından fallback görsel bul
     *
     * Sıralama:
     * 1. render_cache (RenderWorker tarafından oluşturulan)
     * 2. product_renders (render.php tarafından oluşturulan)
     * 3. Ürün ilk görseli (product.images[0])
     *
     * @param string $companyId Firma ID
     * @param string|null $templateId Şablon ID
     * @param string|null $productId Ürün ID
     * @param array $device Cihaz bilgileri
     * @return string|null Görsel dosya yolu veya null
     */
    public function findFallbackImage(string $companyId, ?string $templateId, ?string $productId, array $device): ?string
    {
        $deviceType = $device['type'] ?? 'esl';

        // 1. render_cache - en kaliteli kaynak (ready veya stale - dosya varsa kullan)
        if ($productId && $templateId) {
            $cacheRow = $this->db->fetch(
                "SELECT image_path FROM render_cache
                 WHERE company_id = ? AND product_id = ? AND template_id = ? AND status IN ('ready', 'stale')
                 ORDER BY CASE WHEN status = 'ready' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1",
                [$companyId, $productId, $templateId]
            );
            if ($cacheRow && !empty($cacheRow['image_path']) && file_exists($cacheRow['image_path'])) {
                return $cacheRow['image_path'];
            }
        }

        // 2. product_renders - template + product eşleşmesi
        if ($productId && $templateId) {
            $render = $this->db->fetch(
                "SELECT file_path FROM product_renders
                 WHERE company_id = ? AND product_id = ? AND template_id = ? AND device_type = ? AND status = 'completed'
                 ORDER BY created_at DESC LIMIT 1",
                [$companyId, $productId, $templateId, $deviceType]
            );
            if ($render && !empty($render['file_path'])) {
                $fullPath = $render['file_path'];
                if (strpos($fullPath, '/') !== 0 && strpos($fullPath, 'storage/') === 0) {
                    $fullPath = BASE_PATH . '/' . $fullPath;
                }
                if (file_exists($fullPath)) {
                    return $render['file_path'];
                }
            }
        }

        // 2b. product_renders - template olmadan en son render
        if ($productId) {
            $render = $this->db->fetch(
                "SELECT file_path FROM product_renders
                 WHERE company_id = ? AND product_id = ? AND device_type = ? AND status = 'completed'
                 ORDER BY created_at DESC LIMIT 1",
                [$companyId, $productId, $deviceType]
            );
            if ($render && !empty($render['file_path'])) {
                $fullPath = $render['file_path'];
                if (strpos($fullPath, '/') !== 0 && strpos($fullPath, 'storage/') === 0) {
                    $fullPath = BASE_PATH . '/' . $fullPath;
                }
                if (file_exists($fullPath)) {
                    return $render['file_path'];
                }
            }
        }

        // 3. Ürün görselleri - son çare
        if ($productId) {
            $product = $this->db->fetch(
                "SELECT images, image_url FROM products WHERE id = ? AND company_id = ?",
                [$productId, $companyId]
            );
            if ($product) {
                // images JSON array
                if (!empty($product['images'])) {
                    $images = is_string($product['images'])
                        ? json_decode($product['images'], true)
                        : $product['images'];
                    if (is_array($images) && !empty($images[0]) && is_string($images[0])) {
                        $firstImage = ltrim($images[0], '/');
                        $imagePath = (strpos($firstImage, 'storage/') === 0)
                            ? $firstImage
                            : 'storage/' . $firstImage;
                        $fullPath = BASE_PATH . '/' . $imagePath;
                        if (file_exists($fullPath)) {
                            return $imagePath;
                        }
                    }
                }
                // image_url
                if (!empty($product['image_url'])) {
                    $imgUrl = $product['image_url'];
                    if (!preg_match('#^https?://#i', $imgUrl)) {
                        $fullPath = BASE_PATH . '/' . ltrim($imgUrl, '/');
                        if (file_exists($fullPath)) {
                            return ltrim($imgUrl, '/');
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Ürün ve şablon verilerinden fallback video bul
     *
     * Sıralama:
     * 1. Ürün videos JSON array
     * 2. Ürün video_url alanı
     * 3. Şablon staticVideos / videoPlaceholderUrl
     *
     * @return array Video path dizisi (boş olabilir)
     */
    public function findFallbackVideos(string $companyId, ?string $templateId, ?string $productId, array $device): array
    {
        $videos = [];
        $normalizedBasePath = str_replace('\\', '/', BASE_PATH);

        // 1. Ürün videoları
        if ($productId) {
            $product = $this->db->fetch(
                "SELECT videos, video_url FROM products WHERE id = ? AND company_id = ?",
                [$productId, $companyId]
            );
            if ($product) {
                // videos JSON array
                if (!empty($product['videos'])) {
                    $productVideos = is_string($product['videos'])
                        ? json_decode($product['videos'], true)
                        : $product['videos'];
                    if (is_array($productVideos)) {
                        foreach ($productVideos as $vid) {
                            $vidPath = is_string($vid) ? $vid : ($vid['url'] ?? $vid['path'] ?? null);
                            if (empty($vidPath) || !is_string($vidPath)) continue;

                            $normalizedVid = str_replace('\\', '/', ltrim(trim($vidPath), '/'));
                            // storage/ prefix yoksa ekle
                            if (strpos($normalizedVid, 'storage/') !== 0 && !preg_match('#^https?://#i', $normalizedVid)) {
                                // Proje alt dizini prefix olabilir
                                $baseName = basename($normalizedBasePath);
                                if ($baseName && strpos($normalizedVid, $baseName . '/') === 0) {
                                    $normalizedVid = ltrim(substr($normalizedVid, strlen($baseName)), '/');
                                }
                            }

                            $testPath = $normalizedBasePath . '/' . ltrim($normalizedVid, '/');
                            if (file_exists($testPath)) {
                                $videos[] = $testPath;
                            } else {
                                // storage/ prefix ekleyerek dene
                                $testPath2 = $normalizedBasePath . '/storage/' . ltrim($normalizedVid, '/');
                                if (file_exists($testPath2)) {
                                    $videos[] = $testPath2;
                                }
                            }
                        }
                    }
                }

                // video_url alanı
                if (empty($videos) && !empty($product['video_url'])) {
                    $vidUrl = trim($product['video_url']);
                    if (preg_match('#^https?://#i', $vidUrl)) {
                        $videos[] = $vidUrl;
                    } else {
                        $normalizedVid = str_replace('\\', '/', ltrim($vidUrl, '/'));
                        $testPath = $normalizedBasePath . '/' . ltrim($normalizedVid, '/');
                        if (file_exists($testPath)) {
                            $videos[] = $testPath;
                        }
                    }
                }
            }
        }

        // 2. Şablon staticVideos
        if (empty($videos) && $templateId) {
            $template = $this->db->fetch(
                "SELECT design_data FROM templates WHERE id = ?",
                [$templateId]
            );
            if ($template && !empty($template['design_data'])) {
                $designData = is_string($template['design_data'])
                    ? json_decode($template['design_data'], true)
                    : $template['design_data'];
                if (is_array($designData) && !empty($designData['objects'])) {
                    $this->_collectTemplateVideos($designData['objects'], $videos, $normalizedBasePath);
                }
            }
        }

        return $videos;
    }

    /**
     * Şablon tasarımından video region pozisyonunu tespit et
     */
    private function _detectVideoRegionFromTemplate(?string $templateId, int $deviceWidth, int $deviceHeight): ?array
    {
        if (!$templateId) return null;

        $template = $this->db->fetch(
            "SELECT design_data, width, height FROM templates WHERE id = ?",
            [$templateId]
        );
        if (!$template || empty($template['design_data'])) return null;

        $designData = is_string($template['design_data'])
            ? json_decode($template['design_data'], true)
            : $template['design_data'];
        if (!is_array($designData) || empty($designData['objects'])) return null;

        $templateW = (int)($template['width'] ?? $designData['width'] ?? $deviceWidth);
        $templateH = (int)($template['height'] ?? $designData['height'] ?? $deviceHeight);
        if ($templateW <= 0) $templateW = $deviceWidth;
        if ($templateH <= 0) $templateH = $deviceHeight;

        $scaleX = $deviceWidth / max(1, $templateW);
        $scaleY = $deviceHeight / max(1, $templateH);

        foreach ($designData['objects'] as $obj) {
            if (!is_array($obj)) continue;
            $customType = (string)($obj['customType'] ?? '');
            if ($customType === 'video-placeholder' || !empty($obj['isVideoPlaceholder']) || !empty($obj['isMultipleVideos'])) {
                $objLeft = (float)($obj['left'] ?? 0);
                $objTop = (float)($obj['top'] ?? 0);
                $objW = (float)(($obj['width'] ?? 0) * ($obj['scaleX'] ?? 1));
                $objH = (float)(($obj['height'] ?? 0) * ($obj['scaleY'] ?? 1));

                return [
                    'x' => max(0, (int)($objLeft * $scaleX)),
                    'y' => max(0, (int)($objTop * $scaleY)),
                    'width' => min($deviceWidth, (int)($objW * $scaleX)),
                    'height' => min($deviceHeight, (int)($objH * $scaleY))
                ];
            }
            // Group içinde de arayabiliriz
            if (!empty($obj['objects']) && is_array($obj['objects'])) {
                foreach ($obj['objects'] as $child) {
                    if (!is_array($child)) continue;
                    $childType = (string)($child['customType'] ?? '');
                    if ($childType === 'video-placeholder' || !empty($child['isVideoPlaceholder'])) {
                        $cLeft = (float)($obj['left'] ?? 0) + (float)($child['left'] ?? 0);
                        $cTop = (float)($obj['top'] ?? 0) + (float)($child['top'] ?? 0);
                        $cW = (float)(($child['width'] ?? 0) * ($child['scaleX'] ?? 1));
                        $cH = (float)(($child['height'] ?? 0) * ($child['scaleY'] ?? 1));

                        return [
                            'x' => max(0, (int)($cLeft * $scaleX)),
                            'y' => max(0, (int)($cTop * $scaleY)),
                            'width' => min($deviceWidth, (int)($cW * $scaleX)),
                            'height' => min($deviceHeight, (int)($cH * $scaleY))
                        ];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Template objelerinden video yollarını topla (recursive)
     */
    private function _collectTemplateVideos(array $objects, array &$videos, string $basePath): void
    {
        foreach ($objects as $obj) {
            if (!is_array($obj)) continue;

            $customType = (string)($obj['customType'] ?? '');
            $isVideoObj = $customType === 'video-placeholder' ||
                !empty($obj['isVideoPlaceholder']) ||
                !empty($obj['isMultipleVideos']);

            if ($isVideoObj) {
                // staticVideos
                $staticVideos = $obj['staticVideos'] ?? [];
                if (is_string($staticVideos)) {
                    $decoded = json_decode($staticVideos, true);
                    $staticVideos = (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) ? $decoded : [];
                }
                if (is_array($staticVideos)) {
                    foreach ($staticVideos as $entry) {
                        $entryPath = is_string($entry) ? $entry : ($entry['url'] ?? $entry['path'] ?? '');
                        if (is_string($entryPath) && trim($entryPath) !== '') {
                            $normalized = str_replace('\\', '/', ltrim(trim($entryPath), '/'));
                            $testPath = $basePath . '/' . ltrim($normalized, '/');
                            if (file_exists($testPath)) {
                                $videos[] = $testPath;
                            }
                        }
                    }
                }

                // videoPlaceholderUrl
                $singleVideo = $obj['videoPlaceholderUrl'] ?? '';
                if (is_string($singleVideo) && trim($singleVideo) !== '') {
                    $normalized = str_replace('\\', '/', ltrim(trim($singleVideo), '/'));
                    $testPath = $basePath . '/' . ltrim($normalized, '/');
                    if (file_exists($testPath)) {
                        $videos[] = $testPath;
                    }
                }
            }

            // Recursive (Group nesneleri)
            if (!empty($obj['objects']) && is_array($obj['objects'])) {
                $this->_collectTemplateVideos($obj['objects'], $videos, $basePath);
            }
        }
    }

    /**
     * Sunucu base URL'ini dinamik hesapla
     */
    private function getServerBaseUrl(): string
    {
        // APP_URL'den /api kısmını çıkar
        $serverBaseUrl = preg_replace('#/api$#', '', APP_URL);

        // Request host ile override et (APP_URL stale olabilir)
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

        return $serverBaseUrl;
    }
}
