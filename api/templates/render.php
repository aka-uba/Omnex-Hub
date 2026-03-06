<?php
/**
 * Template Render API
 *
 * Şablonu ürün verileriyle render eder.
 * Opsiyonel olarak PavoDisplay cihazına gönderir.
 *
 * POST /api/templates/:id/render
 * Body: {
 *   product_id: "xxx",       // Ürün ID (veritabanından çek)
 *   product: {...},          // VEYA doğrudan ürün verileri
 *   device_id: "xxx",        // Opsiyonel: Cihaza gönder
 *   format: "html|image|both" // Çıktı formatı
 * }
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Template ID'yi al
$templateId = $request->getRouteParam('id');

if (!$templateId) {
    Response::error('Şablon ID gerekli', 400);
}

// Şablonu getir
$template = $db->fetch(
    "SELECT * FROM templates WHERE id = ? AND (company_id = ? OR company_id IS NULL)",
    [$templateId, $companyId]
);

if (!$template) {
    Response::notFound('Şablon bulunamadı');
}

// Ürün verilerini al
$productId = $request->input('product_id');
$productData = $request->input('product');

if ($productId) {
    // Veritabanından ürün getir
    $product = $db->fetch(
        "SELECT * FROM products WHERE id = ? AND company_id = ?",
        [$productId, $companyId]
    );

    if (!$product) {
        Response::notFound('Ürün bulunamadı');
    }

    // category_name için category alanını kullan
    $product['category_name'] = $product['category'] ?? '';

    // JSON alanlarını parse et
    if (isset($product['images']) && is_string($product['images'])) {
        $product['images'] = json_decode($product['images'], true) ?: [];
    }
    if (isset($product['videos']) && is_string($product['videos'])) {
        $product['videos'] = json_decode($product['videos'], true) ?: [];
    }
    if (isset($product['extra_data']) && is_string($product['extra_data'])) {
        $product['extra_data'] = json_decode($product['extra_data'], true) ?: [];
    }
} elseif ($productData) {
    // Doğrudan gönderilen verileri kullan
    $product = $productData;
} else {
    // Demo verilerle render et
    $product = [
        'name' => 'Örnek Ürün',
        'sku' => 'SKU-001',
        'barcode' => '8690000000001',
        'category' => 'Kategori',
        'current_price' => 29.99,
        'previous_price' => 39.99,
        'origin' => 'Türkiye',
        'unit' => '1 kg',
        'storage_info' => 'Serin ve kuru yerde saklayın',
        'image_url' => ''
    ];
}

// Şirket bilgilerini al
$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$companyId]);

// Terazi barkodu kontrolü - 5 haneli terazi kodunu işle
if (isset($product['barcode']) && preg_match('/^\d{5}$/', $product['barcode'])) {
    // Settings'ten terazi barkod ayarlarını al
    $settings = $db->fetch(
        "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
        [$companyId]
    );

    $flagCode = '27'; // Varsayılan
    $barcodeFormat = 'CODE128';

    if ($settings && !empty($settings['data'])) {
        $settingsData = json_decode($settings['data'], true);
        if (isset($settingsData['weighing_flag_code'])) {
            $flagCode = $settingsData['weighing_flag_code'];
        }
        if (isset($settingsData['weighing_barcode_format'])) {
            $barcodeFormat = $settingsData['weighing_barcode_format'];
        }
    }

    // Orijinal terazi kodunu sakla
    $product['original_barcode'] = $product['barcode'];
    // Flag code + scale code = barkod
    $product['barcode'] = $flagCode . $product['barcode'];
    $product['barcode_format'] = $barcodeFormat;
}

// Format
$format = $request->input('format', 'html');

// TemplateRenderer'ı yükle
require_once BASE_PATH . '/services/TemplateRenderer.php';
$renderer = new TemplateRenderer();

$result = [
    'template_id' => $templateId,
    'template_name' => $template['name'],
    'width' => $template['width'],
    'height' => $template['height']
];

// HTML render
if ($format === 'html' || $format === 'both') {
    if ($template['template_file']) {
        // HTML şablon dosyasından render et
        $html = $renderer->renderHtml($template['template_file'], $product, [
            'width' => $template['width'],
            'height' => $template['height'],
            'company_name' => $company['name'] ?? 'OMNEX',
            'company_logo' => $company['logo'] ?? ''
        ]);
        $result['html'] = $html;
    } else {
        // Fabric.js design_data varsa, onu JSON olarak döndür
        $result['design_data'] = $template['design_data'];
        $result['slots'] = $template['slots'] ? json_decode($template['slots'], true) : null;
    }
}

// Image render
if ($format === 'image' || $format === 'both') {
    // Basit GD render
    $imageBase64 = $renderer->renderSimpleImage($product, $template['width'], $template['height']);
    $result['image'] = 'data:image/png;base64,' . $imageBase64;
}

// Cihaza gönder
$deviceId = $request->input('device_id');
if ($deviceId) {
    // Cihaz bilgilerini al (gateway bağlantısı ile birlikte)
    $device = $db->fetch(
        "SELECT d.*, gd.gateway_id, gd.local_ip as gateway_local_ip,
                gw.name as gateway_name, gw.status as gateway_status,
                gw.last_heartbeat as gateway_last_heartbeat
         FROM devices d
         LEFT JOIN gateway_devices gd ON d.id = gd.device_id
         LEFT JOIN gateways gw ON gd.gateway_id = gw.id
         WHERE d.id = ? AND d.company_id = ?",
        [$deviceId, $companyId]
    );

    if (!$device) {
        Response::error('Cihaz bulunamadı', 404);
    }

    $isHanshowEsl = ($device['model'] ?? '') === 'hanshow_esl';
    $isPavoDisplay = in_array($device['model'] ?? '', ['esl_android', 'PD1010-II', '']) ||
                     ($device['type'] ?? '') === 'esl';
    $communicationMode = $device['communication_mode'] ?? 'http-server';
    $isMqttDevice = ($communicationMode === 'mqtt');
    $isHttpPullDevice = ($communicationMode === 'http');

    // ============== MQTT DEVICE: Kuyruk bazli gonderim ==============
    // Erken cikis devre disi: ayni sendParams akisini MQTT'de de kullan.
    if (false && $isMqttDevice && $isPavoDisplay) {
        try {
            // Gorsel kaynagini belirle ve dosyaya kaydet
            $imageSource = null;
            $tempDir = STORAGE_PATH . '/renders';
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // Client-side render edilmis gorsel (en yuksek oncelik)
            $clientRenderedImage = $request->input('rendered_image');
            if ($clientRenderedImage && strpos($clientRenderedImage, 'data:image') === 0) {
                $parts = explode(',', $clientRenderedImage);
                if (count($parts) === 2) {
                    $imageData = base64_decode($parts[1]);
                    $ext = strpos($parts[0], 'png') !== false ? 'png' : 'jpg';
                    $fileName = 'mqtt_' . $deviceId . '_' . time() . '.' . $ext;
                    $renderDir = $tempDir . '/' . $companyId . '/esl';
                    if (!is_dir($renderDir)) {
                        mkdir($renderDir, 0755, true);
                    }
                    $filePath = $renderDir . '/' . $fileName;
                    file_put_contents($filePath, $imageData);
                    $imageSource = 'storage/renders/' . $companyId . '/esl/' . $fileName;
                }
            }

            // Fallback: template render_image veya preview_image
            if (!$imageSource && !empty($template['render_image'])) {
                $imageSource = $template['render_image'];
            }
            if (!$imageSource && !empty($template['preview_image'])) {
                $imageSource = $template['preview_image'];
            }

            if (!$imageSource) {
                Response::error('MQTT gonderimi icin gorsel kaynagi bulunamadi', 400);
            }

            // product_renders tablosuna kaydet
            $renderHash = md5_file(BASE_PATH . '/' . $imageSource);
            $productId = $request->input('product_id');

            $existingRender = $db->fetch(
                "SELECT id FROM product_renders WHERE company_id = ? AND product_id = ? AND template_id = ? AND device_type = 'esl'",
                [$companyId, $productId ?? '', $templateId]
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
                    'template_id' => $templateId,
                    'device_type' => 'esl',
                    'file_path' => $imageSource,
                    'render_hash' => $renderHash,
                    'status' => 'completed',
                    'created_at' => date('Y-m-d H:i:s'),
                    'completed_at' => date('Y-m-d H:i:s')
                ]);
            }

            // device_content_assignments guncelle/olustur
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

            // device_commands'a updatelabel komutu ekle
            require_once BASE_PATH . '/services/MqttBrokerService.php';
            $mqttService = new MqttBrokerService();
            $mqttCmdResult = $mqttService->publishCommand($deviceId, [
                'action' => 'updatelabel',
                'push_id' => $mqttService->createPushId($deviceId . ':' . ($productId ?? 'preview')),
                'clientid' => $device['device_id'] ?? $device['mqtt_client_id'],
                'priority' => 5
            ], $companyId);

            $result['device_sent'] = true;
            $result['delivery'] = 'queued';
            $result['communication_mode'] = 'mqtt';
            $result['mqtt_published'] = $mqttCmdResult['mqtt_published'] ?? false;
            $result['message'] = ($mqttCmdResult['mqtt_published'] ?? false)
                ? 'Icerik MQTT ile aninda gonderildi.'
                : 'Icerik kuyruga eklendi. Cihaz periyodik sorguda alacak.';
            $result['render_id'] = $renderId;
            $result['file_path'] = $imageSource;

            Logger::audit('send_to_device', 'devices', [
                'device_id' => $deviceId,
                'device_name' => $device['name'],
                'communication_mode' => 'mqtt',
                'template_id' => $templateId,
                'product_id' => $productId,
                'user_id' => $user['id']
            ]);

            Response::success($result);
            return;

        } catch (Exception $e) {
            error_log("render.php MQTT error: " . $e->getMessage());
            Response::error('MQTT gonderim hatasi: ' . $e->getMessage(), 500);
        }
    }

    // ============== HTTP-SERVER / GATEWAY: Mevcut dogrudan push akisi ==============

    if (empty($device['ip_address']) && !$isHanshowEsl && !$isMqttDevice) {
        Response::error('Cihaz IP adresi tanımlı değil', 400);
    }

    // Gateway üzerinden mi gönderilecek kontrol et
    $gatewayId = $device['gateway_id'] ?? null;
    $gatewayOnline = ($device['gateway_status'] ?? '') === 'online';
    $gatewayLastHeartbeat = $device['gateway_last_heartbeat'] ?? null;

    // Eğer gateway_devices'dan gateway bulunamadıysa, firmanın aktif gateway'ini ara
    if (!$gatewayId) {
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

        if (!$gatewayHeartbeatOk) {
            error_log("render.php: Gateway heartbeat stale ({$heartbeatAge}s > 120s), switching to direct send for device " . $device['id']);
        }
    }

    // Gateway sistemi aktif mi kontrol et (settings tablosundan)
    $gatewayEnabled = true; // Varsayılan aktif
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

    // Kullanıcı ayarlarını da kontrol et (override)
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

    $useGateway = $gatewayEnabled && $gatewayId && $gatewayOnline && $gatewayHeartbeatOk;

    // PavoDisplayGateway ile gönder (doğrudan veya gateway üzerinden)
    require_once BASE_PATH . '/services/PavoDisplayGateway.php';
    $gateway = new PavoDisplayGateway();

    try {
        // Görsel kaynağını belirle
        $imageSource = null;
        $tempDir = STORAGE_PATH . '/renders';
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // 0. EN ÖNCELİKLİ: Client-side render edilmiş görsel (dinamik verilerle)
        $clientRenderedImage = $request->input('rendered_image');
        if ($clientRenderedImage && strpos($clientRenderedImage, 'data:image') === 0) {
            // Base64 data URL'den görsel çıkar
            $parts = explode(',', $clientRenderedImage);
            if (count($parts) === 2) {
                $imageData = base64_decode($parts[1]);
                $tempFile = $tempDir . '/' . $device['device_id'] . '_rendered_' . time() . '.png';
                if (file_put_contents($tempFile, $imageData)) {
                    $imageSource = $tempFile;
                }
            }
        }

        // 1. render_image (editörde kaydedilen statik render - placeholder'lı)
        if (!$imageSource && !empty($template['render_image'])) {
            $renderPath = STORAGE_PATH . '/' . $template['render_image'];
            if (file_exists($renderPath)) {
                $imageSource = $renderPath;
            } else if ($companyId) {
                // Firma bazlı fallback
                $companyRenderPath = STORAGE_PATH . '/companies/' . $companyId . '/templates/renders/' . basename($template['render_image']);
                if (file_exists($companyRenderPath)) {
                    $imageSource = $companyRenderPath;
                }
            }
        }

        // 2. Şablon adından tasarım klasörü ara (esl_android altında)
        if (!$imageSource) {
            $templateName = $template['name'] ?? '';
            $templateSlug = strtolower(str_replace(' ', '_', $templateName));

            // Olası klasör yolları (firma bazlı öncelikli)
            $possibleDirs = [];
            if ($companyId) {
                $companyDesignBase = STORAGE_PATH . '/companies/' . $companyId . '/tasarımlar';
                $possibleDirs[] = $companyDesignBase . '/esl_android/' . $templateSlug;
                $possibleDirs[] = $companyDesignBase . '/esl_android/' . $templateSlug . '_v1';
            }
            $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . $templateSlug;
            $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . $templateSlug . '_v1';

            if (!empty($template['template_file'])) {
                $possibleDirs[] = BASE_PATH . '/tasarımlar/' . dirname($template['template_file']);
                $possibleDirs[] = BASE_PATH . '/tasarımlar/esl_android/' . pathinfo($template['template_file'], PATHINFO_FILENAME) . '_v1';
            }

            // Her klasörde screen.png veya screen1*.png ara
            foreach ($possibleDirs as $dir) {
                if ($dir && is_dir($dir)) {
                    // Önce screen.png dene
                    if (file_exists($dir . '/screen.png')) {
                        $imageSource = $dir . '/screen.png';
                        break;
                    }
                    // Sonra screen1*.png pattern'ini ara
                    $screenFiles = glob($dir . '/screen1*.png');
                    if (!empty($screenFiles)) {
                        $imageSource = $screenFiles[0];
                        break;
                    }
                }
            }
        }

        // 3. preview_image varsa kontrol et (düşük çözünürlük - son çare)
        if (!$imageSource && !empty($template['preview_image'])) {
            // Data URL mi kontrol et
            if (strpos($template['preview_image'], 'data:image') === 0) {
                // Base64 data URL'den görsel çıkar
                $parts = explode(',', $template['preview_image']);
                if (count($parts) === 2) {
                    $imageData = base64_decode($parts[1]);
                    $tempFile = $tempDir . '/' . $device['device_id'] . '_preview.png';
                    file_put_contents($tempFile, $imageData);
                    $imageSource = $tempFile;
                }
            } else {
                // Dosya yolu olarak dene
                $previewPath = STORAGE_PATH . '/' . $template['preview_image'];
                if (file_exists($previewPath)) {
                    $imageSource = $previewPath;
                } else if ($companyId) {
                    $companyPreviewPath = STORAGE_PATH . '/companies/' . $companyId . '/templates/renders/' . basename($template['preview_image']);
                    if (file_exists($companyPreviewPath)) {
                        $imageSource = $companyPreviewPath;
                    }
                }
            }
        }

        // 4. Yoksa GD ile basit render yap ve temp dosyaya kaydet
        if (!$imageSource) {
            $imageBase64Data = $imageBase64 ?? $renderer->renderSimpleImage($product, $template['width'], $template['height']);
            $imageData = base64_decode($imageBase64Data);

            $tempFile = $tempDir . '/' . $device['device_id'] . '_temp.png';
            file_put_contents($tempFile, $imageData);
            $imageSource = $tempFile;
        }

        // Cihaz boyutlarını al (varsayılan 800x1280)
        $deviceWidth = (int)($device['screen_width'] ?? 800);
        $deviceHeight = (int)($device['screen_height'] ?? 1280);

        // Ürün bilgilerini hazırla - TÜM ürün verilerini geçir (dinamik render için gerekli)
        $productInfo = $product; // Tam ürün verisi

        // Şablon design_data'sını hazırla (dinamik alan render için gerekli)
        $templateDesignData = [];
        if (!empty($template['design_data'])) {
            $templateDesignData = is_string($template['design_data'])
                ? json_decode($template['design_data'], true)
                : $template['design_data'];
        }
        // Şablon boyutlarını design_data'ya ekle
        $templateDesignData['_templateWidth'] = (int)($template['width'] ?? 800);
        $templateDesignData['_templateHeight'] = (int)($template['height'] ?? 1280);

        // Video var mı kontrol et (ürün veya şablon)
        $videoPath = null;
        $videos = [];
        $images = [];

        /**
         * Medya dosya yolunu çöz - URL veya yerel dosya
         * @param string $mediaPath Medya yolu (URL veya yerel)
         * @param string $type Medya tipi ('video' veya 'image')
         * @return string|null Yerel dosya yolu veya null
         */
        $resolveMediaPath = function($mediaPath, $type = 'video') use ($tempDir) {
            if (empty($mediaPath)) return null;

            // 1. serve.php proxy URL'sini çöz: /api/media/serve.php?path=xxx
            if (strpos($mediaPath, 'serve.php') !== false && strpos($mediaPath, 'path=') !== false) {
                // Query string'den gerçek path'i çıkar
                $parsed = parse_url($mediaPath);
                if (isset($parsed['query'])) {
                    parse_str($parsed['query'], $queryParams);
                    if (isset($queryParams['path'])) {
                        $mediaPath = urldecode($queryParams['path']);
                    }
                }
            }

            // 2. Bilinen tüm base path'leri temizle
            $knownBasePaths = [
                '/market-etiket-sistemi',
                '/signage',
                '/omnex',
                '/display-hub'
            ];

            // Dinamik olarak mevcut base path'i de ekle
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

            // Tüm bilinen base path'leri temizle
            foreach ($knownBasePaths as $basePath) {
                if (strpos($mediaPath, $basePath . '/') === 0) {
                    $mediaPath = substr($mediaPath, strlen($basePath));
                    break;
                }
            }

            // 3. /storage/ ile başlıyorsa storage path'e çevir
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
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_USERAGENT => 'OmnexDisplayHub/1.0'
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
                // Tam yol (Windows veya Unix absolute path)
                $mediaPath,
                // STORAGE_PATH + path (en yaygın durum)
                STORAGE_PATH . '/' . ltrim($mediaPath, '/'),
                // BASE_PATH + path
                BASE_PATH . '/' . ltrim($mediaPath, '/'),
                // storage/ önekini kaldırarak
                STORAGE_PATH . '/' . ltrim(preg_replace('/^storage\//i', '', $mediaPath), '/'),
                // public/ içinden
                BASE_PATH . '/public/' . ltrim($mediaPath, '/'),
                // uploads/ klasöründen
                STORAGE_PATH . '/uploads/' . ltrim($mediaPath, '/'),
                // media/ klasöründen (sadece dosya adıyla)
                STORAGE_PATH . '/media/' . basename($mediaPath),
                // videos/ klasöründen
                STORAGE_PATH . '/videos/' . basename($mediaPath),
                // images/ klasöründen
                STORAGE_PATH . '/images/' . basename($mediaPath)
            ];

            foreach ($possiblePaths as $path) {
                // Windows path normalize
                $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
                if (file_exists($path) && is_file($path)) {
                    return $path;
                }
            }

            return null;
        };

        // Video debug log
        $videoLogFile = STORAGE_PATH . '/logs/video_resolve.log';
        $videoLog = function($msg) use ($videoLogFile) {
            file_put_contents($videoLogFile, "[" . date('Y-m-d H:i:s') . "] $msg\n", FILE_APPEND);
        };
        $videoLog("=== Video Resolution Started ===");
        $videoLog("Product video_url: " . ($product['video_url'] ?? 'EMPTY'));
        $videoLog("Product videos: " . (isset($product['videos']) ? json_encode($product['videos']) : 'EMPTY'));

        // Ürün videosu
        if (!empty($product['video_url'])) {
            $videoLog("Resolving video_url: " . $product['video_url']);
            $resolvedVideo = $resolveMediaPath($product['video_url'], 'video');
            $videoLog("Resolved to: " . ($resolvedVideo ?: 'NULL'));
            if ($resolvedVideo) {
                $videos[] = $resolvedVideo;
                $videoLog("Added to videos array");
            }
        }

        // Ürün video listesi (birden fazla video)
        if (!empty($product['videos'])) {
            $productVideos = is_string($product['videos']) ? json_decode($product['videos'], true) : $product['videos'];
            $videoLog("Product videos parsed: " . json_encode($productVideos));
            if (is_array($productVideos)) {
                foreach ($productVideos as $idx => $vid) {
                    $vidPath = is_string($vid) ? $vid : ($vid['url'] ?? $vid['path'] ?? null);
                    $videoLog("Video[$idx] original path: " . ($vidPath ?: 'NULL'));
                    if ($vidPath) {
                        $resolvedVideo = $resolveMediaPath($vidPath, 'video');
                        $videoLog("Video[$idx] resolved to: " . ($resolvedVideo ?: 'NULL'));
                        if ($resolvedVideo) {
                            $videoLog("Video[$idx] file exists: " . (file_exists($resolvedVideo) ? 'YES' : 'NO'));
                            $videos[] = $resolvedVideo;
                            $videoLog("Video[$idx] added to array");
                        } else {
                            // Debug: Olası yolları göster
                            $videoLog("Video[$idx] trying paths:");
                            $videoLog("  STORAGE_PATH: " . STORAGE_PATH);
                            $testPath1 = STORAGE_PATH . '/media/2026/01/' . basename($vidPath);
                            $videoLog("  Test path 1: $testPath1 - " . (file_exists($testPath1) ? 'EXISTS' : 'NOT FOUND'));
                        }
                    }
                }
            }
        }

        // Şablondaki video placeholder objesine bağlanan statik video seçimleri (MediaPicker)
        $templateStaticVideoCandidates = [];
        if (!empty($templateDesignData) && is_array($templateDesignData)) {
            $collectStaticVideos = function($objects) use (&$collectStaticVideos, &$templateStaticVideoCandidates) {
                if (!is_array($objects)) return;
                foreach ($objects as $obj) {
                    if (!is_array($obj)) continue;

                    $customType = (string)($obj['customType'] ?? '');
                    $dynamicField = (string)($obj['dynamicField'] ?? '');
                    $isVideoPlaceholder = !empty($obj['isVideoPlaceholder']) ||
                        $customType === 'video-placeholder' ||
                        strpos($dynamicField, 'video_url') !== false ||
                        strpos($dynamicField, 'videos') !== false;

                    if ($isVideoPlaceholder) {
                        $staticVideos = $obj['staticVideos'] ?? [];
                        if (is_string($staticVideos)) {
                            $decoded = json_decode($staticVideos, true);
                            if (json_last_error() === JSON_ERROR_NONE) {
                                $staticVideos = $decoded;
                            } else {
                                $staticVideos = [];
                            }
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

            $collectStaticVideos($templateDesignData['objects'] ?? []);
        }

        if (!empty($templateStaticVideoCandidates)) {
            $videoLog("Template static videos found: " . count($templateStaticVideoCandidates));
            $resolvedVideoMap = [];
            foreach ($videos as $existingVideoPath) {
                if (is_string($existingVideoPath) && $existingVideoPath !== '') {
                    $resolvedVideoMap[$existingVideoPath] = true;
                }
            }

            foreach ($templateStaticVideoCandidates as $idx => $candidatePath) {
                $videoLog("TemplateVideo[$idx] original path: " . $candidatePath);
                $resolvedVideo = $resolveMediaPath($candidatePath, 'video');
                $videoLog("TemplateVideo[$idx] resolved to: " . ($resolvedVideo ?: 'NULL'));
                if ($resolvedVideo && empty($resolvedVideoMap[$resolvedVideo])) {
                    $videos[] = $resolvedVideo;
                    $resolvedVideoMap[$resolvedVideo] = true;
                    $videoLog("TemplateVideo[$idx] added to videos array");
                }
            }
        }
        $videoLog("Final videos count: " . count($videos));

        // Ürün görseli (image_url) - video yoksa ana görsel olarak kullanılabilir
        if (!empty($product['image_url'])) {
            $resolvedImage = $resolveMediaPath($product['image_url'], 'image');
            if ($resolvedImage) {
                $images[] = $resolvedImage;
                // Görsel varsa ve imageSource boşsa, bunu kullan
                if (!$imageSource) {
                    $imageSource = $resolvedImage;
                }
            }
        }

        // Ürün görsel listesi (birden fazla görsel) - images JSON array
        if (!empty($product['images'])) {
            $productImages = is_string($product['images']) ? json_decode($product['images'], true) : $product['images'];
            if (is_array($productImages)) {
                foreach ($productImages as $img) {
                    $imgPath = is_string($img) ? $img : ($img['url'] ?? $img['path'] ?? $img['filename'] ?? null);
                    if ($imgPath) {
                        $resolvedImage = $resolveMediaPath($imgPath, 'image');
                        if ($resolvedImage) {
                            $images[] = $resolvedImage;
                            // İlk çözümlenen görsel imageSource olsun
                            if (!$imageSource) {
                                $imageSource = $resolvedImage;
                            }
                        }
                    }
                }
            }
        }

        // Şablon grid layout kontrolü
        $gridLayout = $template['grid_layout'] ?? null;
        $regionsConfig = $template['regions_config'] ?? null;

        // DEBUG: Grid layout ve regions kontrolü

        // Grid layout ID'sini normalize et (tire -> alt tire)
        if ($gridLayout) {
            $gridLayout = str_replace('-', '_', $gridLayout);
        }

        // Regions config'i parse et
        $regions = null;
        if ($regionsConfig) {
            $regions = is_string($regionsConfig) ? json_decode($regionsConfig, true) : $regionsConfig;
        }

        // Debug: Medya bilgilerini result'a ekle
        $result['media_debug'] = [
            'product_video_url' => $product['video_url'] ?? null,
            'product_videos' => $product['videos'] ?? null,
            'template_static_videos' => $templateStaticVideoCandidates,
            'product_image_url' => $product['image_url'] ?? null,
            'product_images' => $product['images'] ?? null,
            'resolved_videos' => $videos,
            'resolved_videos_count' => count($videos),
            'resolved_images' => $images,
            'resolved_images_count' => count($images),
            'image_source' => $imageSource,
            'temp_dir' => $tempDir,
            'grid_layout' => $gridLayout,
            'regions' => $regions
        ];

        /**
         * ŞABLON GÖNDERİM STRATEJİSİ:
         *
         * 1. Client-rendered image varsa (kullanıcı "Cihaza Gönder" tıkladığında canvas'tan alınan görsel):
         *    - Bu görsel şablonun tamamını içerir (grid dahil)
         *    - Tam ekran olarak gönder, ayrıca grid bölmesi yapma
         *
         * 2. Video varsa VE regions_config'de video bölgesi tanımlıysa:
         *    - Şablon görselini alt bölgeye, videoyu üst bölgeye yerleştir
         *    - regions_config'deki pozisyonları kullan
         *
         * 3. Sadece görsel varsa:
         *    - Tam ekran gönder
         */

        // Video bölgesi var mı kontrol et
        $hasVideoRegion = false;
        $videoRegionConfig = null;
        $imageRegionConfig = null;
        $isSingleGridWithVideo = false;
        $videoPlaceholderFound = null;


        if (is_array($regions)) {
            foreach ($regions as $region) {
                $regionType = $region['type'] ?? '';

                // Video placeholder varsa kaydet (region type'dan bağımsız)
                if (!empty($region['videoPlaceholder'])) {
                    $vp = $region['videoPlaceholder'];
                    $vpX = (int)($vp['x'] ?? 0);
                    $vpY = (int)($vp['y'] ?? 0);
                    $vpW = (int)($vp['width'] ?? $deviceWidth);
                    $vpH = (int)($vp['height'] ?? $deviceHeight);

                    // Eski format kontrolü: Eğer x + width > deviceWidth ise
                    // muhtemelen center koordinat olarak kaydedilmiş (eski format)
                    // Bu durumda koordinatları dönüştür
                    if ($vpX + $vpW > $deviceWidth * 1.1 || $vpY + $vpH > $deviceHeight * 1.1) {
                        // Eski format: x ve y merkez koordinatları
                        $newX = max(0, $vpX - $vpW / 2);
                        $newY = max(0, $vpY - $vpH / 2);
                        $newW = min($vpW, $deviceWidth - $newX);
                        $newH = min($vpH, $deviceHeight - $newY);

                        $videoPlaceholderFound = [
                            'x' => (int)$newX,
                            'y' => (int)$newY,
                            'width' => (int)$newW,
                            'height' => (int)$newH
                        ];
                    } else {
                        // Yeni format: zaten sol/üst koordinatları
                        $videoPlaceholderFound = [
                            'x' => max(0, $vpX),
                            'y' => max(0, $vpY),
                            'width' => min($vpW, $deviceWidth - max(0, $vpX)),
                            'height' => min($vpH, $deviceHeight - max(0, $vpY))
                        ];
                    }

                    // ÖNEMLİ: Dönüştürülmüş koordinatları region'a da yaz!
                    // Bu sayede sonraki kodlar doğru koordinatları kullanır
                    $region['videoPlaceholder'] = $videoPlaceholderFound;

                }

                if ($regionType === 'video' || $regionType === 'media') {
                    $hasVideoRegion = true;
                    $videoRegionConfig = $region;
                } elseif ($regionType === 'image' || $regionType === 'label') {
                    // Label bölgesinde de videoPlaceholder olabilir
                    if (!empty($region['videoPlaceholder'])) {
                        $hasVideoRegion = true;
                        $videoRegionConfig = $region;
                    } else {
                        $imageRegionConfig = $region;
                    }
                }
            }
        }

        // Debug: Show final config state

        // design_data'da video placeholder var mı kontrol et + pozisyonunu al
        $hasVideoPlaceholderInDesign = false;
        $designVideoPosition = null;
        if (!empty($template['design_data'])) {
            $designDataCheck = is_string($template['design_data'])
                ? json_decode($template['design_data'], true)
                : $template['design_data'];

            if ($designDataCheck && isset($designDataCheck['objects'])) {
                foreach ($designDataCheck['objects'] as $obj) {
                    // Video placeholder objesi mi kontrol et
                    $objCustomType = $obj['customType'] ?? '';
                    $objFill = $obj['fill'] ?? '';
                    $objType = strtolower($obj['type'] ?? '');
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

                        // Video placeholder pozisyonunu çıkar
                        $objLeft = (int)($obj['left'] ?? 0);
                        $objTop = (int)($obj['top'] ?? 0);
                        $objW = (int)(($obj['width'] ?? $deviceWidth) * ($obj['scaleX'] ?? 1));
                        $objH = (int)(($obj['height'] ?? (int)($deviceHeight * 0.4)) * ($obj['scaleY'] ?? 1));

                        // Fabric.js v7 center origin → sol-üst'e çevir
                        $originX = $obj['originX'] ?? 'center';
                        $originY = $obj['originY'] ?? 'center';
                        if ($originX === 'center') $objLeft -= (int)($objW / 2);
                        if ($originY === 'center') $objTop -= (int)($objH / 2);

                        // Şablon boyutundan cihaz boyutuna ölçekle
                        $templateW = (int)($template['width'] ?? 800);
                        $templateH = (int)($template['height'] ?? 1280);
                        $scaleX = $deviceWidth / max(1, $templateW);
                        $scaleY = $deviceHeight / max(1, $templateH);

                        $designVideoPosition = [
                            'x' => max(0, (int)($objLeft * $scaleX)),
                            'y' => max(0, (int)($objTop * $scaleY)),
                            'width' => min($deviceWidth, (int)($objW * $scaleX)),
                            'height' => min($deviceHeight, (int)($objH * $scaleY))
                        ];
                        break;
                    }
                }
            }
        }

        // ÖNEMLİ: Şablon tasarımında video placeholder yoksa, ürün videolarını kullanma!
        // Bu sayede sadece metin/görsel içeren şablonlar tam ekran görsel olarak gönderilir
        if (!$hasVideoRegion && !$videoPlaceholderFound && !$hasVideoPlaceholderInDesign) {
            // Şablon video içermiyor - ürün videolarını temizle
            $videos = [];
        }

        // videoPlaceholder veya designVideoPosition bulunmuşsa ama videoRegionConfig yoksa, oluştur
        if (!$videoRegionConfig) {
            $vpSource = $videoPlaceholderFound ?? $designVideoPosition;
            if ($vpSource) {
                $hasVideoRegion = true;
                $videoRegionConfig = [
                    'id' => 'auto_video',
                    'type' => 'video',
                    'x' => $vpSource['x'] ?? 0,
                    'y' => $vpSource['y'] ?? 0,
                    'width' => $vpSource['width'] ?? $deviceWidth,
                    'height' => $vpSource['height'] ?? $deviceHeight,
                    'videoPlaceholder' => $vpSource
                ];
                $videoPlaceholderFound = $vpSource;
            }
        }

        // Tek grid düzeni + video içeriği özel durumu
        // Kullanıcı tek grid seçmiş ama içine video placeholder koymuş
        $normalizedLayout = str_replace('-', '_', $gridLayout ?? '');
        if ($normalizedLayout === 'single' && $hasVideoRegion && !$imageRegionConfig) {
            $isSingleGridWithVideo = true;

            // Video placeholder'ın gerçek pozisyonunu kullan (varsa)
            // GridManager.js artık videoPlaceholder alanını export ediyor
            $videoPlaceholder = $videoRegionConfig['videoPlaceholder'] ?? null;

            if ($videoPlaceholder) {
                // Video placeholder'ın gerçek pozisyonunu kullan
                $videoX = (int)($videoPlaceholder['x'] ?? 0);
                $videoY = (int)($videoPlaceholder['y'] ?? 0);
                $videoW = (int)($videoPlaceholder['width'] ?? $deviceWidth);
                $videoH = (int)($videoPlaceholder['height'] ?? $deviceHeight);

                // Video bölgesini güncelle
                $videoRegionConfig['x'] = $videoX;
                $videoRegionConfig['y'] = $videoY;
                $videoRegionConfig['width'] = $videoW;
                $videoRegionConfig['height'] = $videoH;

            } else {
                // Eski yöntem - region bounds kullan
                $videoX = (int)($videoRegionConfig['x'] ?? 0);
                $videoY = (int)($videoRegionConfig['y'] ?? 0);
                $videoW = (int)($videoRegionConfig['width'] ?? $deviceWidth);
                $videoH = (int)($videoRegionConfig['height'] ?? $deviceHeight);
            }

            // Video tüm ekranı kaplıyorsa sadece video gönder
            $isFullScreenVideo = ($videoX == 0 && $videoY == 0 &&
                                  $videoW >= $deviceWidth * 0.95 && $videoH >= $deviceHeight * 0.95);

            if (!$isFullScreenVideo) {
                // OVERLAY MODE: Görsel tam ekran, video tasarımdaki pozisyonda üstte
                // PavoDisplay'de LabelPicture ve LabelVideo üst üste binebilir
                // Video görselin üstünde görünür (z-index olarak video üstte)
                // Bu sayede kullanıcı video'yu tasarımda nereye koyarsa orada görünür
                $imageRegionConfig = [
                    'id' => 'auto_image',
                    'type' => 'label',
                    'x' => 0,
                    'y' => 0,
                    'width' => $deviceWidth,
                    'height' => $deviceHeight
                ];

            } else {
            }
        }

        // Hanshow ESL: RF tabanli gonderim (IP/PavoDisplay gerektirmez)
        if ($isHanshowEsl) {
            require_once BASE_PATH . '/services/HanshowGateway.php';
            $hanshowGw = new HanshowGateway();
            $eslId = $device['device_id'];

            if (!$imageSource || !file_exists($imageSource)) {
                Response::error('Gonderilecek gorsel bulunamadi', 400);
            }

            $imageBase64ForHanshow = base64_encode(file_get_contents($imageSource));
            $hanshowResult = $hanshowGw->sendImageToESL($eslId, $imageBase64ForHanshow, [
                'priority' => 1
            ]);

            // errno: 0 = immediate success, 1 = accepted/in processing (async)
            $errno = isset($hanshowResult['errno']) ? (int)$hanshowResult['errno'] : -1;
            $sendResult = [
                'success' => $errno === 0 || $errno === 1,
                'message' => $hanshowResult['errmsg'] ?? 'Hanshow send completed'
            ];

            // hanshow_esls tablosunu guncelle
            $db->query(
                "UPDATE hanshow_esls SET current_product_id = ?, current_template_id = ?, updated_at = ? WHERE esl_id = ?",
                [$productId ?? null, $templateId ?? null, date('Y-m-d H:i:s'), $eslId]
            );
        }
        // PavoDisplay: IP tabanli gonderim
        else {

        $dispatchSend = function(array $sendParams, string $type) use (
            $isMqttDevice,
            $isHttpPullDevice,
            $companyId,
            $device,
            $templateId,
            $productId,
            $useGateway,
            $db,
            $gatewayId,
            $gateway
        ) {
            // ========== HTTP PULL MODE ==========
            // Cihaz sunucumuza bağlanır ve içeriği çeker (PUSH yapmıyoruz)
            // Kuyruk mantığı MQTT ile aynı: payload dosyası + device_content_assignments
            if ($isHttpPullDevice) {
                if (empty($companyId)) {
                    return [
                        'success' => false,
                        'error' => 'HTTP gonderimi icin company context eksik'
                    ];
                }

                require_once BASE_PATH . '/services/EslSignValidator.php';
                $eslValidator = new EslSignValidator();
                return $eslValidator->queueContentForHttpDevice(
                    $device,
                    $sendParams,
                    $companyId,
                    $templateId ?: null,
                    $productId ?: null
                );
            }

            // ========== MQTT MODE ==========
            if ($isMqttDevice) {
                if (empty($companyId)) {
                    return [
                        'success' => false,
                        'error' => 'MQTT gonderimi icin company context eksik'
                    ];
                }

                require_once BASE_PATH . '/services/MqttBrokerService.php';
                $mqttService = new MqttBrokerService();
                return $mqttService->queueContentUpdate(
                    $device,
                    $sendParams,
                    $companyId,
                    $templateId ?: null,
                    $productId ?: null
                );
            }

            // ========== HTTP-SERVER (PUSH) MODE ==========
            if ($useGateway) {
                return sendLabelViaGateway($db, $gatewayId, $device, $sendParams, $type);
            }

            if ($type === 'label') {
                return $gateway->sendLabel(
                    $device['ip_address'],
                    $device['device_id'],
                    $sendParams['image'] ?? null,
                    $sendParams['product'] ?? [],
                    (int)($sendParams['width'] ?? 800),
                    (int)($sendParams['height'] ?? 1280),
                    $sendParams['design_data'] ?? []
                );
            }

            return $gateway->sendGridLabel(
                $device['ip_address'],
                $device['device_id'],
                $sendParams
            );
        };

        // DEBUG: Video ve bölge durumu

        // Koşul kontrolü debug
        $willEnterMainBranch = !empty($videos) && $hasVideoRegion && $videoRegionConfig && $imageRegionConfig;

        // Video varsa VE şablonda video bölgesi tanımlıysa özel grid gönderimi yap
        if (!empty($videos) && $hasVideoRegion && $videoRegionConfig && $imageRegionConfig) {
            // Şablon görselinden sadece label bölgesini crop et
            $croppedImageSource = $imageSource;

            if ($imageSource && file_exists($imageSource)) {
                // Kaynak görseli yükle
                $srcImage = null;
                $ext = strtolower(pathinfo($imageSource, PATHINFO_EXTENSION));
                if ($ext === 'png') {
                    $srcImage = @imagecreatefrompng($imageSource);
                } elseif (in_array($ext, ['jpg', 'jpeg'])) {
                    $srcImage = @imagecreatefromjpeg($imageSource);
                }

                if ($srcImage) {
                    $srcWidth = imagesx($srcImage);
                    $srcHeight = imagesy($srcImage);

                    // Bölge pozisyonlarını kaynak görsel boyutuna göre hesapla
                    // (regions_config pixel cinsinden, ama görsel farklı boyutta olabilir)
                    $scaleX = $srcWidth / ($template['width'] ?? 800);
                    $scaleY = $srcHeight / ($template['height'] ?? 1280);

                    $cropX = (int)(($imageRegionConfig['x'] ?? 0) * $scaleX);
                    $cropY = (int)(($imageRegionConfig['y'] ?? 0) * $scaleY);
                    $cropW = (int)(($imageRegionConfig['width'] ?? $srcWidth) * $scaleX);
                    $cropH = (int)(($imageRegionConfig['height'] ?? $srcHeight) * $scaleY);

                    // Sınır kontrolü
                    $cropX = max(0, min($cropX, $srcWidth - 1));
                    $cropY = max(0, min($cropY, $srcHeight - 1));
                    $cropW = min($cropW, $srcWidth - $cropX);
                    $cropH = min($cropH, $srcHeight - $cropY);

                    // Crop işlemi
                    if ($cropW > 0 && $cropH > 0) {
                        $croppedImage = imagecreatetruecolor($cropW, $cropH);
                        imagecopy($croppedImage, $srcImage, 0, 0, $cropX, $cropY, $cropW, $cropH);

                        // Crop edilmiş görseli kaydet
                        $croppedFile = $tempDir . '/' . $device['device_id'] . '_cropped_' . time() . '.png';
                        imagepng($croppedImage, $croppedFile);
                        imagedestroy($croppedImage);

                        $croppedImageSource = $croppedFile;

                    }

                    imagedestroy($srcImage);
                }
            }

            // Video için gerçek videoPlaceholder ölçülerini kullan (varsa)
            // videoRegionConfig['videoPlaceholder'] video objesinin canvas'taki gerçek boyutunu içerir
            $vp = $videoRegionConfig['videoPlaceholder'] ?? null;
            $actualVideoX = $vp ? (int)($vp['x'] ?? 0) : (int)($videoRegionConfig['x'] ?? 0);
            $actualVideoY = $vp ? (int)($vp['y'] ?? 0) : (int)($videoRegionConfig['y'] ?? 0);
            $actualVideoW = $vp ? (int)($vp['width'] ?? $deviceWidth) : (int)($videoRegionConfig['width'] ?? $deviceWidth);
            $actualVideoH = $vp ? (int)($vp['height'] ?? ($deviceHeight / 2)) : (int)($videoRegionConfig['height'] ?? ($deviceHeight / 2));


            // Video koordinatlarını cihaz sınırlarına göre düzelt (boundary check)
            // Kullanıcının tasarımda belirlediği pozisyon korunur, sadece taşma önlenir

            // 1. X pozisyonu - negatif olamaz ve sağ kenar taşamaz
            if ($actualVideoX < 0) {
                $actualVideoX = 0;
            }
            if ($actualVideoX + $actualVideoW > $deviceWidth) {
                // Sağa taşıyorsa genişliği kısalt
                $actualVideoW = $deviceWidth - $actualVideoX;
            }

            // 2. Genişlik kontrolü - ekrana sığdır
            if ($actualVideoW > $deviceWidth) {
                $actualVideoW = $deviceWidth;
            }

            // 3. Y pozisyonu - negatif olamaz
            if ($actualVideoY < 0) {
                $actualVideoY = 0;
            }

            // 4. Yükseklik kontrolü
            if ($actualVideoH > $deviceHeight) {
                $actualVideoH = $deviceHeight;
            }

            // 5. Alt kenar taşma kontrolü
            if ($actualVideoY + $actualVideoH > $deviceHeight) {
                $actualVideoH = $deviceHeight - $actualVideoY;
            }

            // Minimum boyut kontrolü
            $actualVideoW = max(100, $actualVideoW);
            $actualVideoH = max(100, $actualVideoH);



            // Image region - Video'nun ALTINDA olacak şekilde ayarla
            // PavoDisplay'de LabelVideo üstte, LabelPicture altta olmalı
            // Video region'ın hemen altından başla
            $actualImageX = 0;
            $actualImageY = $actualVideoY + $actualVideoH; // Video'nun altından başla
            $actualImageW = $deviceWidth;
            $actualImageH = $deviceHeight - $actualImageY; // Kalan yükseklik

            // Minimum görsel yüksekliği kontrolü
            if ($actualImageH < 100) {
                // Video neredeyse tam ekran, görsel için çok az yer kalmış
                $actualImageH = 100;
            }

            // Görsel her zaman gösterilir (video placeholder gizlenmiş olarak render edildi)
            $showImage = true;


            // Image region'ı güncelle
            if ($showImage) {
                $imageRegionConfig = [
                    'id' => 'recalc_image',
                    'type' => 'label',
                    'x' => $actualImageX,
                    'y' => $actualImageY,
                    'width' => $actualImageW,
                    'height' => $actualImageH
                ];

                // ÖNEMLİ: Kırpma bölgesi ile cihaz görsel bölgesi aynı koordinatlardan başlamalı!
                // Video üstte ise: actualImageY = actualVideoH, kırpma da bu Y'den başlamalı
                // Bu sayede kırpılan görseldeki içerikler cihazda doğru yerde görünür.

                // Tasarımdaki orijinal video placeholder pozisyonunu bul
                $originalVideoY = $vp ? (int)($vp['y'] ?? 0) : 0;
                $originalVideoH = $vp ? (int)($vp['height'] ?? $actualVideoH) : $actualVideoH;
                $originalVideoBottom = $originalVideoY + $originalVideoH;

                // Video üstte mi altta mı belirlendi (actualVideoY = 0 ise üstte)
                // Kırpma bölgesi: Tasarımdaki video placeholder'ın alt kenarından başla
                // Cihazda yerleştirme: actualImageY (= actualVideoH) pozisyonuna

                // İKİ YÖNTEM ARASINDAKİ TUTARLILIK:
                // Tasarımda: video Y=0, H=originalVideoH --> içerik Y=originalVideoBottom'dan başlar
                // Cihazda: video Y=0, H=actualVideoH --> görsel Y=actualVideoH'dan başlar
                //
                // Eğer originalVideoH != actualVideoH ise, içerikler kaydırılacak
                // Bu durumda: kırpmayı cihazın beklediği pozisyondan yap

                // Basit ve tutarlı yaklaşım: Kırpma = Cihazın görsel bölgesi koordinatları
                // Yani Y=actualImageY'den başlayarak kırp, böylece içerikler tam doğru yerde olur
                $contentStartY = $actualImageY;
                $contentEndY = $deviceHeight;

                // Design_data'dan video olmayan içerik elementlerinin konumlarını bul (debug için)
                $contentMinY = $deviceHeight;
                $contentMaxY = 0;
                $videoMaxY = 0;

                if (!empty($template['design_data'])) {
                    $designData = is_string($template['design_data'])
                        ? json_decode($template['design_data'], true)
                        : $template['design_data'];

                    if ($designData && isset($designData['objects'])) {
                        foreach ($designData['objects'] as $obj) {
                            // Overlay ve background objelerini atla
                            if (!empty($obj['isRegionOverlay']) || !empty($obj['isBackground'])) {
                                continue;
                            }

                            $objTop = (int)($obj['top'] ?? 0);
                            $objHeight = (int)(($obj['height'] ?? 0) * ($obj['scaleY'] ?? 1));
                            $objBottom = $objTop + $objHeight;

                            // Video placeholder mı?
                            $isVideo = !empty($obj['isVideoPlaceholder']) ||
                                       (isset($obj['dynamicField']) && (
                                           strpos($obj['dynamicField'], 'video_url') !== false ||
                                           strpos($obj['dynamicField'], 'videos') !== false
                                       ));

                            if ($isVideo) {
                                $videoMaxY = max($videoMaxY, $objBottom);
                            } else {
                                // İçerik elementi (metin, şekil, görsel vb.)
                                if ($objHeight > 0) {
                                    $contentMinY = min($contentMinY, $objTop);
                                    $contentMaxY = max($contentMaxY, $objBottom);
                                }
                            }
                        }
                    }
                }


                // Image'ı tasarımdaki içerik bölgesinden kırp (video placeholder'ın altı)
                if ($imageSource && file_exists($imageSource)) {
                    $srcImage2 = null;
                    $ext2 = strtolower(pathinfo($imageSource, PATHINFO_EXTENSION));
                    if ($ext2 === 'png') {
                        $srcImage2 = @imagecreatefrompng($imageSource);
                    } elseif (in_array($ext2, ['jpg', 'jpeg'])) {
                        $srcImage2 = @imagecreatefromjpeg($imageSource);
                    }

                    if ($srcImage2) {
                        $srcWidth2 = imagesx($srcImage2);
                        $srcHeight2 = imagesy($srcImage2);

                        // Kaynak görsel boyutu ile şablon boyutu arasındaki oran
                        $scaleX2 = $srcWidth2 / ($template['width'] ?? 800);
                        $scaleY2 = $srcHeight2 / ($template['height'] ?? 1280);

                        // Tasarımdaki içerik bölgesini kırp (video placeholder'ın altı)
                        $cropX2 = 0;
                        $cropY2 = (int)($contentStartY * $scaleY2);
                        $cropW2 = $srcWidth2;
                        $cropH2 = (int)(($contentEndY - $contentStartY) * $scaleY2);

                        // Sınır kontrolü
                        $cropX2 = max(0, min($cropX2, $srcWidth2 - 1));
                        $cropY2 = max(0, min($cropY2, $srcHeight2 - 1));
                        $cropW2 = min($cropW2, $srcWidth2 - $cropX2);
                        $cropH2 = min($cropH2, $srcHeight2 - $cropY2);


                        if ($cropW2 > 0 && $cropH2 > 0) {
                            $finalCroppedImage = imagecreatetruecolor($cropW2, $cropH2);

                            // PNG için şeffaflık desteği
                            imagealphablending($finalCroppedImage, false);
                            imagesavealpha($finalCroppedImage, true);

                            imagecopy($finalCroppedImage, $srcImage2, 0, 0, $cropX2, $cropY2, $cropW2, $cropH2);

                            $finalCroppedFile = $tempDir . '/' . $device['device_id'] . '_final_crop_' . time() . '.png';
                            imagepng($finalCroppedImage, $finalCroppedFile);
                            imagedestroy($finalCroppedImage);

                            $croppedImageSource = $finalCroppedFile;
                        }

                        imagedestroy($srcImage2);
                    }
                }
            }

            // Gönderim parametrelerini hazırla
            // ÖNEMLİ: Gateway'e TAM EKRAN görseli gönder, gateway kırpacak (local mantık ile aynı)
            // render.php kırpma YAPMAMALI, sadece region bilgisini göndermeli
            $sendParams = [
                'layout' => 'custom', // Özel bölgeleme
                'width' => $deviceWidth,
                'height' => $deviceHeight,
                'image' => $showImage ? $imageSource : null, // TAM EKRAN görsel (kırpılmamış)
                'videos' => $videos,
                'product' => $productInfo,
                'design_data' => $templateDesignData, // Dinamik alan render için
                'image_region' => $showImage ? [
                    'x' => $actualImageX,
                    'y' => $actualImageY,
                    'width' => $actualImageW,
                    'height' => $actualImageH
                ] : null,
                'video_region' => [
                    'x' => $actualVideoX,
                    'y' => $actualVideoY,
                    'width' => $actualVideoW,
                    'height' => $actualVideoH
                ]
            ];

            $sendResult = $dispatchSend($sendParams, 'grid');
        }
        // Video varsa ama bölge tanımı yoksa veya tek grid + tam ekran video durumu
        elseif (!empty($videos)) {
            $layout = $gridLayout ?? 'split_vertical';

            // Önce zaten bulunan videoPlaceholder'ı kullan, yoksa design_data'dan ara
            $videoPlaceholderFromDesign = $videoPlaceholderFound;

            // Eğer regions_config'den bulamadıysak, design_data'dan ara
            if (!$videoPlaceholderFromDesign && !empty($template['design_data'])) {
                $designData = is_string($template['design_data'])
                    ? json_decode($template['design_data'], true)
                    : $template['design_data'];

                if ($designData && isset($designData['objects'])) {
                    foreach ($designData['objects'] as $obj) {
                        // Video placeholder objesini bul
                        if (isset($obj['dynamicField']) && (
                            strpos($obj['dynamicField'], 'video_url') !== false ||
                            strpos($obj['dynamicField'], 'videos') !== false ||
                            !empty($obj['isVideoPlaceholder'])
                        )) {
                            $objWidth = ($obj['width'] ?? 100) * ($obj['scaleX'] ?? 1);
                            $objHeight = ($obj['height'] ?? 100) * ($obj['scaleY'] ?? 1);

                            // Fabric.js koordinatları - origin'e göre dönüştür
                            $objLeft = (float)($obj['left'] ?? 0);
                            $objTop = (float)($obj['top'] ?? 0);
                            $originX = $obj['originX'] ?? 'left';
                            $originY = $obj['originY'] ?? 'top';

                            // Center origin ise sol/üst koordinatlara çevir
                            if ($originX === 'center') {
                                $objLeft = $objLeft - $objWidth / 2;
                            } elseif ($originX === 'right') {
                                $objLeft = $objLeft - $objWidth;
                            }

                            if ($originY === 'center') {
                                $objTop = $objTop - $objHeight / 2;
                            } elseif ($originY === 'bottom') {
                                $objTop = $objTop - $objHeight;
                            }

                            // Negatif değerleri 0'a sabitle ve cihaz sınırlarına göre düzelt
                            $finalLeft = max(0, (int)$objLeft);
                            $finalTop = max(0, (int)$objTop);
                            $finalWidth = min((int)$objWidth, $deviceWidth - $finalLeft);
                            $finalHeight = min((int)$objHeight, $deviceHeight - $finalTop);

                            $videoPlaceholderFromDesign = [
                                'x' => $finalLeft,
                                'y' => $finalTop,
                                'width' => $finalWidth,
                                'height' => $finalHeight
                            ];
                            break;
                        }
                    }
                }
            }


            // Eğer design_data'dan video placeholder bulduysa, özel bölgeleme yap
            if ($videoPlaceholderFromDesign) {
                $vpX = $videoPlaceholderFromDesign['x'];
                $vpY = $videoPlaceholderFromDesign['y'];
                $vpW = $videoPlaceholderFromDesign['width'];
                $vpH = $videoPlaceholderFromDesign['height'];

                // Video tam ekran mı kontrol et
                $isVpFullScreen = ($vpX == 0 && $vpY == 0 &&
                                   $vpW >= $deviceWidth * 0.95 && $vpH >= $deviceHeight * 0.95);

                if (!$isVpFullScreen) {
                    // OVERLAY MODE: Görsel tam ekran, video üstünde
                    // Video placeholder gizlenmiş olarak render edildi, o yüzden tam görsel gönderiyoruz
                    $autoImageRegion = [
                        'x' => 0,
                        'y' => 0,
                        'width' => $deviceWidth,
                        'height' => $deviceHeight
                    ];


                    // OVERLAY MODE: Görseli kırpma, tam gönder
                    // Video placeholder render sırasında gizlendiği için görsel zaten hazır
                    $croppedForSingle = $imageSource;

                    // Özel bölgeleme ile gönder
                    $sendParams = [
                        'layout' => 'custom',
                        'width' => $deviceWidth,
                        'height' => $deviceHeight,
                        'image' => $croppedForSingle,
                        'videos' => $videos,
                        'product' => $productInfo,
                        'design_data' => $templateDesignData, // Dinamik alan render için
                        'image_region' => $autoImageRegion,
                        'video_region' => $videoPlaceholderFromDesign
                    ];
                    $sendResult = $dispatchSend($sendParams, 'grid');
                } else {
                    // Tam ekran video - sadece video gönder
                    $sendParams = [
                        'layout' => 'fullscreen_video',
                        'width' => $deviceWidth,
                        'height' => $deviceHeight,
                        'videos' => $videos,
                        'product' => $productInfo,
                        'design_data' => $templateDesignData // Dinamik alan render için
                    ];
                    $sendResult = $dispatchSend($sendParams, 'grid');
                }
            } else {
                // Varsayılan grid layout kullan
                $sendParams = [
                    'layout' => $layout,
                    'width' => $deviceWidth,
                    'height' => $deviceHeight,
                    'image' => $imageSource,
                    'videos' => $videos,
                    'product' => $productInfo,
                    'design_data' => $templateDesignData // Dinamik alan render için
                ];
                $sendResult = $dispatchSend($sendParams, 'grid');
            }
        }
        // Sadece görsel - tam ekran gönder
        else {
            $sendParams = [
                'layout' => 'single',
                'width' => $deviceWidth,
                'height' => $deviceHeight,
                'image' => $imageSource,
                'product' => $productInfo,
                'design_data' => $templateDesignData // Dinamik alan render için
            ];
            $sendResult = $dispatchSend($sendParams, 'label');
        }

        } // end PavoDisplay else block

        if ($sendResult['success']) {
            $result['device_sent'] = true;
            $result['device_id'] = $deviceId;
            $result['device_name'] = $device['name'];
            $result['device_ip'] = $device['ip_address'];
            $result['send_result'] = $sendResult;

            // Cihazın son gönderim bilgisini güncelle
            $db->update('devices', [
                'current_content' => json_encode([
                    'type' => 'product',
                    'product_id' => $productId ?? null,
                    'template_id' => $templateId ?? null,
                    'sent_at' => date('Y-m-d H:i:s')
                ]),
                'current_template_id' => $templateId ?? null,
                'last_sync' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$deviceId]);

            // Audit log - cihaza gönderim
            Logger::audit('send', 'device', [
                'id' => $deviceId,
                'device_name' => $device['name'],
                'device_ip' => $device['ip_address'],
                'template_id' => $templateId ?? null,
                'product_id' => $productId ?? null,
                'send_type' => $isHttpPullDevice ? 'http-pull' : ($isMqttDevice ? 'mqtt' : ($useGateway ? 'gateway' : 'direct')),
                'communication_mode' => $isHttpPullDevice ? 'http' : ($isMqttDevice ? 'mqtt' : 'http-server')
            ]);

        } else {
            $result['device_sent'] = false;
            $result['device_error'] = $sendResult['error'] ?? 'Gönderim başarısız';
            $result['send_result'] = $sendResult;
        }

    } catch (Exception $e) {
        $result['device_sent'] = false;
        $result['device_error'] = $e->getMessage();
    }
}

// Hata durumunda Response::error döndür
if (!empty($result['device_error']) && $result['device_sent'] === false) {
    Response::error($result['device_error'], 500);
} else {
    Response::success($result);
}

/**
 * Gateway üzerinden etiket gönder
 *
 * @param Database $db
 * @param string $gatewayId
 * @param array $device
 * @param array $sendParams
 * @param string $type 'label' veya 'grid'
 * @return array
 */
function templateGatewayPublicBaseUrl(): string
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

    if ($basePath === '/api') {
        $basePath = '';
    } elseif (substr($basePath, -4) === '/api') {
        $basePath = substr($basePath, 0, -4);
    }

    return rtrim($scheme . '://' . $host . $basePath, '/');
}

function templateGatewayExtractStorageRelativePath(string $path): ?string
{
    $normalized = str_replace('\\', '/', trim($path));
    if ($normalized === '') {
        return null;
    }

    if (preg_match('/^https?:\/\//i', $normalized)) {
        $urlPath = parse_url($normalized, PHP_URL_PATH) ?: '';
        $storagePos = stripos($urlPath, '/storage/');
        if ($storagePos !== false) {
            $relativeStorage = substr($urlPath, $storagePos + strlen('/storage/'));
            return ltrim($relativeStorage, '/');
        }
        return null;
    }

    if (strpos($normalized, '/storage/') === 0 || strpos($normalized, 'storage/') === 0) {
        $relativeStorage = preg_replace('#^/?storage/#i', '', $normalized);
        return ltrim($relativeStorage, '/');
    }

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

function templateGatewayBuildSignedMediaUrl(string $relativeStorage): ?string
{
    $baseUrl = templateGatewayPublicBaseUrl();
    if ($baseUrl === '') {
        return null;
    }

    $relativeStorage = ltrim(str_replace('\\', '/', $relativeStorage), '/');
    if ($relativeStorage === '') {
        return null;
    }

    $expiresAt = time() + 43200; // 12 saat
    $signature = hash_hmac('sha256', $relativeStorage . '|' . $expiresAt, JWT_SECRET);

    return $baseUrl . '/api/media/serve.php?path=' . rawurlencode($relativeStorage)
        . '&exp=' . $expiresAt
        . '&sig=' . $signature;
}

function templateGatewayMediaPathToUrl(?string $path): ?string
{
    if (empty($path)) {
        return null;
    }

    $relativeStorage = templateGatewayExtractStorageRelativePath($path);
    if ($relativeStorage !== null) {
        return templateGatewayBuildSignedMediaUrl($relativeStorage);
    }

    $normalized = str_replace('\\', '/', $path);
    if (preg_match('/^https?:\/\//i', $normalized)) {
        return $normalized;
    }

    return null;
}

function sendLabelViaGateway($db, $gatewayId, $device, $sendParams, $type = 'label'): array
{
    // Debug log fonksiyonu
    $logFile = STORAGE_PATH . '/logs/gateway_send.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    $logMsg = function($msg) use ($logFile) {
        file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] $msg\n", FILE_APPEND);
    };

    $logMsg("=== sendLabelViaGateway başladı (v2 - file references) ===");
    $logMsg("Device IP: " . ($device['ip_address'] ?? 'YOK'));
    $logMsg("Device ID: " . ($device['device_id'] ?? 'YOK'));
    $logMsg("Image path: " . ($sendParams['image'] ?? 'YOK'));
    $logMsg("Videos count: " . (isset($sendParams['videos']) ? count($sendParams['videos']) : 0));

    // ===== PHASE 1 DEĞİŞİKLİK: Base64 yerine dosya yolları kullan =====
    // Artık base64 verisi DB'ye yazılmıyor, sadece dosya yolları saklanıyor

    $imagePath = null;
    $imagePublicUrl = null;
    $imageMd5 = null;
    $imageSize = 0;

    if (!empty($sendParams['image'])) {
        if (file_exists($sendParams['image'])) {
            $imagePath = $sendParams['image'];
            $imagePublicUrl = templateGatewayMediaPathToUrl($imagePath);
            $imageSize = filesize($imagePath);
            $imageMd5 = strtoupper(md5_file($imagePath));
            $logMsg("Image file: $imagePath, size: $imageSize bytes, md5: $imageMd5");
            if (!empty($imagePublicUrl)) {
                $logMsg("Image public URL: $imagePublicUrl");
            }
        } else {
            $logMsg("ERROR: Image file does not exist: " . $sendParams['image']);
        }
    } else {
        $logMsg("WARNING: No image path provided");
    }

    // Video dosyası bilgileri (base64 değil, sadece yollar)
    $videoPaths = [];
    if (!empty($sendParams['videos']) && is_array($sendParams['videos'])) {
        $logMsg("Processing " . count($sendParams['videos']) . " videos");
        foreach ($sendParams['videos'] as $videoPath) {
            if (file_exists($videoPath)) {
                $videoPublicUrl = templateGatewayMediaPathToUrl($videoPath);
                $videoSize = filesize($videoPath);
                $videoMd5 = strtoupper(md5_file($videoPath));
                $logMsg("Video: $videoPath, size: $videoSize bytes, md5: $videoMd5");
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
                $logMsg("ERROR: Video file not found: $videoPath");
            }
        }
    }

    // Komut parametrelerini hazırla (KÜÇÜK JSON - base64 yok!)
    $commandParams = [
        'device_id' => $device['id'],
        'device_ip' => $device['ip_address'],
        'client_id' => $device['device_id'],
        'type' => $type,
        'layout' => $sendParams['layout'] ?? 'single',
        'width' => $sendParams['width'] ?? 800,
        'height' => $sendParams['height'] ?? 1280,
        'product' => $sendParams['product'] ?? [],
        'design_data' => $sendParams['design_data'] ?? [], // Dinamik alan render için
        // ===== PHASE 1: Dosya referansları (base64 değil) =====
        // URL once kullanimi ile uzaktaki EXE gateway senaryosunu destekle.
        'image_path' => $imagePublicUrl ?: $imagePath,
        'image_url' => $imagePublicUrl,
        'image_local_path' => $imagePath,
        'image_md5' => $imageMd5,
        'image_size' => $imageSize,
        'video_paths' => $videoPaths,
        'image_region' => $sendParams['image_region'] ?? null,
        'video_region' => $sendParams['video_region'] ?? null
    ];

    // JSON encode ve boyut kontrolü
    $jsonParams = json_encode($commandParams);
    $jsonSize = strlen($jsonParams);
    $logMsg("JSON parameters size: $jsonSize bytes (no base64!)");

    if ($jsonParams === false) {
        $jsonError = json_last_error_msg();
        $logMsg("ERROR: JSON encode failed: $jsonError");
        return [
            'success' => false,
            'error' => 'JSON encode hatası: ' . $jsonError,
            'via_gateway' => true
        ];
    }

    // Komutu oluştur
    $commandId = $db->generateUuid();
    $logMsg("Creating command: $commandId");

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
        $logMsg("Command inserted to database (small JSON, no base64)");
    } catch (Exception $e) {
        $logMsg("ERROR: Database insert failed: " . $e->getMessage());
        return [
            'success' => false,
            'error' => 'Veritabanı hatası: ' . $e->getMessage(),
            'via_gateway' => true
        ];
    }

    // Gateway komut timeout degeri (ayar yoksa varsayilan: 60s)
    $timeout = 60;
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
        }
    }
    $timeout = max(10, min(300, $timeout));
    $startTime = time();
    $logMsg("Waiting for gateway response (timeout: {$timeout}s)...");

    while ((time() - $startTime) < $timeout) {
        $command = $db->fetch(
            "SELECT * FROM gateway_commands WHERE id = ?",
            [$commandId]
        );

        if ($command && $command['status'] === 'completed') {
            $cmdResult = json_decode($command['result'], true) ?? [];
            $elapsed = time() - $startTime;
            $logMsg("Command completed in {$elapsed}s: " . json_encode($cmdResult));

            return [
                'success' => $cmdResult['success'] ?? true,
                'message' => $cmdResult['message'] ?? 'Etiket başarıyla gönderildi',
                'via_gateway' => true,
                'gateway_result' => $cmdResult
            ];
        } elseif ($command && $command['status'] === 'failed') {
            $elapsed = time() - $startTime;
            $logMsg("Command failed in {$elapsed}s: " . ($command['error_message'] ?? 'unknown'));

            return [
                'success' => false,
                'error' => $command['error_message'] ?? 'Gateway komutu başarısız',
                'via_gateway' => true
            ];
        }

        usleep(500000); // 0.5 saniye bekle
    }

    $logMsg("TIMEOUT: Command did not complete in {$timeout}s");
    $db->update('gateway_commands', [
        'status' => 'timeout',
        'error_message' => 'Gateway response timeout after ' . $timeout . 's',
        'completed_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$commandId]);
    return [
        'success' => false,
        'error' => 'Gateway yanıt zaman aşımı (60 saniye). Gateway çalışıyor mu?',
        'via_gateway' => true
    ];
}
