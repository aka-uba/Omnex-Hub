<?php
/**
 * PavoDisplay Price Tag Gateway
 *
 * PavoDisplay marka elektronik fiyat etiketi cihazları ile iletişim sağlar.
 * Cihaz HTTP-SERVER modunda çalışır ve dosya tabanlı senkronizasyon yapar.
 *
 * Desteklenen Firmware: V3.36+
 * Ekran Boyutları: 800x1280, 1920x1080, 1280x800
 */

class PavoDisplayGateway
{
    private $timeout = 10;
    private $connectTimeout = 5;

    /**
     * PavoDisplay API dokümantasyonuna göre sign hesapla.
     *
     * Algoritma:
     * 1. Tüm URL parametrelerini (sign hariç) alfabetik sırala
     * 2. key1=value1&key2=value2 formatında birleştir
     * 3. Sonuna &key=AppSecret ekle
     * 4. MD5 al ve uppercase yap
     *
     * @param array $params URL query parametreleri (sign hariç)
     * @param string $appSecret AppSecret değeri
     * @return string Uppercase MD5 sign
     */
    private function calculateSign(array $params, string $appSecret): string
    {
        // sign parametresini çıkar (varsa)
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
     * Cihaza ping at ve online durumunu kontrol et
     *
     * @param string $ip Cihaz IP adresi
     * @param bool $lightweight Hafif ping (sadece TCP bağlantı kontrolü)
     */
    public function ping(string $ip, bool $lightweight = false): array
    {
        // Hafif ping: sadece TCP bağlantısını kontrol et (HTTP isteği göndermeden)
        if ($lightweight) {
            $startTime = microtime(true);
            $connection = @fsockopen($ip, 80, $errno, $errstr, 2);
            $responseTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($connection) {
                fclose($connection);
                return [
                    'online' => true,
                    'ip' => $ip,
                    'response_time' => $responseTime,
                    'method' => 'tcp'
                ];
            }

            return [
                'online' => false,
                'ip' => $ip,
                'error' => $errstr ?? 'Connection failed',
                'method' => 'tcp'
            ];
        }

        // Normal ping: HTTP /check endpoint
        $url = "http://{$ip}/check?file_path=files/task/ping.txt";

        $response = $this->httpRequest($url);

        if ($response['success']) {
            return [
                'online' => true,
                'ip' => $ip,
                'response_time' => $response['time'],
                'method' => 'http'
            ];
        }

        return [
            'online' => false,
            'ip' => $ip,
            'error' => $response['error'] ?? 'Connection failed',
            'method' => 'http'
        ];
    }

    /**
     * Cihaza dosya yükle
     *
     * @param string $ip Cihaz IP adresi
     * @param string $filePath Hedef dosya yolu (files/task/ altında)
     * @param string $content Dosya içeriği
     * @param bool $clearSpace Yükleme öncesi alan temizle
     * @param string|null $clientId Client ID (APK sync için)
     */
    public function uploadFile(string $ip, string $filePath, string $content, bool $clearSpace = false, ?string $clientId = null): array
    {
        // Dosya yolu kontrolü
        if (strpos($filePath, 'files/task/') !== 0 && strpos($filePath, 'files/config/') !== 0) {
            $filePath = 'files/task/' . $filePath;
        }

        $url = "http://{$ip}/upload?file_path=" . urlencode($filePath);
        if ($clearSpace) {
            $url .= "&clearspace=1";
        }
        if ($clientId) {
            $url .= "&client_id=" . urlencode($clientId);
        }

        // Binary dosya mı kontrol et (resim, video vb.)
        $isBinary = false;
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if (in_array($extension, ['png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov', 'webm'])) {
            $isBinary = true;
        }

        // Content-Type belirle
        $contentType = 'application/json';
        if ($isBinary) {
            $contentType = 'application/octet-stream';
        } elseif (strpos($filePath, '.json') !== false) {
            $contentType = 'application/json';
        }

        // Client ID header ekle
        $headers = [];
        if ($clientId) {
            $headers[] = 'X-Client-ID: ' . $clientId;
        }

        $timeoutOverride = null;
        if ($isBinary) {
            // Allow larger uploads (videos/images) to complete.
            $timeoutOverride = max($this->timeout, 120);
        }

        $response = $this->httpRequest($url, 'POST', $content, $contentType, $headers, $timeoutOverride);

        if ($response['success'] && isset($response['data']['STATE']) && $response['data']['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'message' => $response['data']['message'] ?? 'File uploaded',
                'file_path' => $filePath
            ];
        }

        return [
            'success' => false,
            'error' => $response['data']['message'] ?? $response['error'] ?? 'Upload failed'
        ];
    }

    /**
     * Dosya MD5 ve boyut kontrolü
     */
    public function checkFile(string $ip, string $filePath): array
    {
        if (strpos($filePath, 'files/task/') !== 0) {
            $filePath = 'files/task/' . $filePath;
        }

        $url = "http://{$ip}/check?file_path=" . urlencode($filePath);

        $response = $this->httpRequest($url);

        if ($response['success'] && isset($response['data']['STATE']) && $response['data']['STATE'] === 'SUCCEED') {
            return [
                'exists' => true,
                'md5' => $response['data']['MD5'] ?? null,
                'length' => $response['data']['Length'] ?? 0
            ];
        }

        return [
            'exists' => false,
            'error' => $response['data']['message'] ?? 'File not found'
        ];
    }

    /**
     * Task JSON oluştur ve yükle
     *
     * API Dokümantasyonuna göre doğru akış:
     * 1. Resim/video dosyalarını yükle
     * 2. Task dosyasını .js uzantısıyla yükle (LabelPicture formatında)
     * 3. /replay endpoint'i ile ekranı güncelle
     *
     * @param string $ip Cihaz IP
     * @param array $product Ürün bilgileri
     * @param array $template Şablon ayarları
     * @param string|null $clientId Client ID
     */
    public function syncProduct(string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // Varsayılan şablon
        $screenWidth = $template['width'] ?? 800;
        $screenHeight = $template['height'] ?? 1280;

        // Client ID yoksa varsayılan oluştur
        $clientId = $clientId ?? ('DEVICE_' . time());

        // 1. Önce mevcut task klasörünü temizle (clearspace=1)
        $this->uploadFile($ip, 'files/task/.clear', '', true, $clientId);

        // 2. Ürün görseli varsa önce yükle
        $imageName = null;
        $imagePath = null;
        $imageMD5 = null;

        if (!empty($product['image_path']) && file_exists($product['image_path'])) {
            $imageContent = file_get_contents($product['image_path']);
            $imageName = basename($product['image_path']);
            $imagePath = 'files/task/' . $imageName;

            $imageResult = $this->uploadFile($ip, $imagePath, $imageContent, false, $clientId);

            if (!$imageResult['success']) {
                return [
                    'success' => false,
                    'error' => 'Image upload failed: ' . ($imageResult['error'] ?? 'Unknown error')
                ];
            }

            // MD5 doğrula
            $imageCheck = $this->checkFile($ip, $imagePath);
            if ($imageCheck['exists']) {
                $imageMD5 = $imageCheck['md5'];
            }
        }

        // 3. Video dosyası varsa yükle
        $videoName = null;
        $videoPath = null;
        $videoMD5 = null;

        if (!empty($product['video_path']) && file_exists($product['video_path'])) {
            $videoContent = file_get_contents($product['video_path']);
            $videoName = basename($product['video_path']);
            $videoPath = 'files/task/' . $videoName;

            $videoResult = $this->uploadFile($ip, $videoPath, $videoContent, false, $clientId);

            if ($videoResult['success']) {
                $videoCheck = $this->checkFile($ip, $videoPath);
                if ($videoCheck['exists']) {
                    $videoMD5 = $videoCheck['md5'];
                }
            }
        }

        // 4. Task JSON oluştur (API dokümantasyonundaki format)
        $taskData = [
            'Id' => $clientId,
            'ItemCode' => $product['sku'] ?? $clientId,
            'ItemName' => $product['name'] ?? 'Product'
        ];

        // LabelPicture ekle (resim varsa)
        if ($imagePath && $imageMD5) {
            $taskData['LabelPicture'] = [
                'Height' => $screenHeight,
                'Width' => $screenWidth,
                'X' => 0,
                'Y' => 0,
                'PictureName' => $imageName,
                'PicturePath' => $imagePath,
                'PictureMD5' => $imageMD5
            ];
        }

        // LabelVideo ekle (video varsa)
        if ($videoPath && $videoMD5) {
            $taskData['LabelVideo'] = [
                'Height' => $template['videoHeight'] ?? 640,
                'Width' => $screenWidth,
                'X' => 0,
                'Y' => 0,
                'VideoList' => [
                    [
                        'VideoNo' => 1,
                        'VideoName' => $videoName,
                        'VideoPath' => $videoPath,
                        'VideoMD5' => $videoMD5
                    ]
                ]
            ];
        }

        // 5. Task dosyasını .js uzantısıyla yükle
        $taskJson = json_encode($taskData, JSON_UNESCAPED_UNICODE);
        $taskFileName = "{$clientId}.js";
        $taskFilePath = "files/task/{$taskFileName}";

        $taskResult = $this->uploadFile($ip, $taskFilePath, $taskJson, false, $clientId);

        if (!$taskResult['success']) {
            return [
                'success' => false,
                'error' => 'Task file upload failed: ' . ($taskResult['error'] ?? 'Unknown error')
            ];
        }

        // 6. /replay ile ekranı güncelle
        $replayResult = $this->triggerReplay($ip, $taskFilePath);

        if (!$replayResult['success']) {
            return [
                'success' => false,
                'error' => 'Replay trigger failed: ' . ($replayResult['error'] ?? 'Unknown error'),
                'replay_response' => $replayResult['response'] ?? null
            ];
        }

        return [
            'success' => true,
            'message' => 'Product synced to device successfully',
            'device_ip' => $ip,
            'product_id' => $product['id'] ?? null,
            'task_file' => $taskFilePath,
            'image_file' => $imagePath,
            'video_file' => $videoPath,
            'client_id' => $clientId,
            'replay_response' => $replayResult['response'] ?? null
        ];
    }

    /**
     * /replay endpoint'i ile ekran güncellemeyi tetikle
     *
     * API Dokümantasyonundan: GET /replay?task=files/task/xxx.js
     * Bu endpoint task dosyasını okur ve ekranı günceller.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $taskPath Task dosyasının yolu (files/task/xxx.js)
     * @param string|null $sign İmza (opsiyonel - MD5)
     */
    public function triggerReplay(string $ip, string $taskPath, ?string $sign = null): array
    {
        $url = "http://{$ip}/replay?task=" . urlencode($taskPath);

        if ($sign) {
            $url .= "&sign=" . urlencode($sign);
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
                'Content-Type: application/x-www-form-urlencoded; charset=UTF-8'
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        $success = $httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED';

        return [
            'success' => $success,
            'http_code' => $httpCode,
            'response' => $data,
            'error' => $error ?: ($data['Task'] ?? null)
        ];
    }

    /**
     * Eski tetikleme metodu (geriye uyumluluk için)
     * @deprecated triggerReplay() kullanın
     */
    private function triggerDeviceRefresh(string $ip, string $clientId): void
    {
        // Artık /replay kullanılıyor, bu metod sadece geriye uyumluluk için
        $taskPath = "files/task/{$clientId}.js";
        $this->triggerReplay($ip, $taskPath);
    }

    /**
     * Toplu cihaz senkronizasyonu
     */
    public function syncToMultipleDevices(array $deviceIps, array $product, array $template = []): array
    {
        $results = [];

        foreach ($deviceIps as $ip) {
            $results[$ip] = $this->syncProduct($ip, $product, $template);
        }

        $successCount = count(array_filter($results, fn($r) => $r['success']));

        return [
            'total' => count($deviceIps),
            'success' => $successCount,
            'failed' => count($deviceIps) - $successCount,
            'details' => $results
        ];
    }

    /**
     * Task JSON formatı oluştur
     * APK'dan keşfedilen format: LabelText, LabelPicture, LabelVideo, VideoList
     */
    private function buildTaskJson(array $product, int $width, int $height, array $template = []): array
    {
        $task = [
            'screenWidth' => $width,
            'screenHeight' => $height,
            'backgroundColor' => $template['backgroundColor'] ?? '#FFFFFF',
            'LabelText' => [],
            'LabelPicture' => [],
            'LabelVideo' => [],
            'VideoList' => []
        ];

        // Ürün adı
        if (!empty($product['name'])) {
            $task['LabelText'][] = [
                'id' => 1,
                'text' => $product['name'],
                'x' => $template['nameX'] ?? 50,
                'y' => $template['nameY'] ?? 100,
                'fontSize' => $template['nameFontSize'] ?? 36,
                'fontColor' => $template['nameFontColor'] ?? '#000000',
                'fontStyle' => 'bold'
            ];
        }

        // Fiyat
        if (!empty($product['current_price'])) {
            $priceText = number_format((float)$product['current_price'], 2, ',', '.') . ' TL';
            $task['LabelText'][] = [
                'id' => 2,
                'text' => $priceText,
                'x' => $template['priceX'] ?? 50,
                'y' => $template['priceY'] ?? 200,
                'fontSize' => $template['priceFontSize'] ?? 72,
                'fontColor' => $template['priceFontColor'] ?? '#FF0000',
                'fontStyle' => 'bold'
            ];
        }

        // Eski fiyat (üstü çizili)
        if (!empty($product['previous_price']) && $product['previous_price'] != $product['current_price']) {
            $oldPriceText = number_format((float)$product['previous_price'], 2, ',', '.') . ' TL';
            $task['LabelText'][] = [
                'id' => 3,
                'text' => $oldPriceText,
                'x' => $template['oldPriceX'] ?? 50,
                'y' => $template['oldPriceY'] ?? 280,
                'fontSize' => $template['oldPriceFontSize'] ?? 32,
                'fontColor' => '#999999',
                'fontStyle' => 'strikethrough'
            ];
        }

        // Barkod
        if (!empty($product['barcode'])) {
            $task['LabelText'][] = [
                'id' => 4,
                'text' => $product['barcode'],
                'x' => $template['barcodeX'] ?? 50,
                'y' => $template['barcodeY'] ?? $height - 100,
                'fontSize' => 24,
                'fontColor' => '#000000',
                'fontStyle' => 'normal'
            ];
        }

        // Ürün görseli
        if (!empty($product['image_path']) || !empty($product['image_url'])) {
            $imageName = 'product_' . ($product['id'] ?? time()) . '.png';
            $task['LabelPicture'][] = [
                'id' => 1,
                'path' => 'files/task/' . $imageName,
                'x' => $template['imageX'] ?? 100,
                'y' => $template['imageY'] ?? 100,
                'width' => $template['imageWidth'] ?? 600,
                'height' => $template['imageHeight'] ?? 600
            ];
        }

        // Video desteği (opsiyonel)
        // Not: Video yükleme syncProduct metodunda yapılıyor, burada sadece placeholder
        // Gerçek video path syncProduct'ta set edilecek

        return $task;
    }

    /**
     * Demo içerik ile sync testi yap
     * 
     * @param string $ip Cihaz IP adresi
     * @param string $demoType Demo tipi: 'strawberry', 'apple', 'lemon', 'cherry'
     * @param string|null $clientId Client ID (APK sync için)
     */
    public function syncDemo(string $ip, string $demoType = 'strawberry', ?string $clientId = null): array
    {
        $demoAssets = [
            'strawberry' => [
                'image' => 'tasarımlar/cihazlar/base (2)/assets/Strawberry.png',
                'name' => 'Kırmızı Çilek',
                'price' => '18.99',
                'unit' => 'TL/kg'
            ],
            'apple' => [
                'image' => 'tasarımlar/cihazlar/base (2)/assets/Apple.png',
                'name' => 'Kırmızı Elma',
                'price' => '24.50',
                'unit' => 'TL/kg'
            ],
            'lemon' => [
                'image' => 'tasarımlar/cihazlar/base (2)/assets/Lemon.png',
                'name' => 'Limon',
                'price' => '12.99',
                'unit' => 'TL/kg'
            ],
            'cherry' => [
                'image' => 'tasarımlar/cihazlar/base (2)/assets/Cherry.png',
                'name' => 'Kiraz',
                'price' => '35.00',
                'unit' => 'TL/kg'
            ]
        ];

        if (!isset($demoAssets[$demoType])) {
            return [
                'success' => false,
                'error' => 'Invalid demo type. Available: ' . implode(', ', array_keys($demoAssets))
            ];
        }

        $demo = $demoAssets[$demoType];
        $imagePath = BASE_PATH . '/' . $demo['image'];

        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Demo image not found: ' . $imagePath
            ];
        }

        // Demo ürün bilgisi oluştur
        $product = [
            'id' => 'demo_' . $demoType,
            'name' => $demo['name'],
            'current_price' => $demo['price'],
            'image_path' => $imagePath
        ];

        // Sync yap
        return $this->syncProduct($ip, $product, [
            'width' => 800,
            'height' => 1280
        ], $clientId);
    }

    /**
     * HTTP isteği gönder
     */
    private function httpRequest(string $url, string $method = 'GET', ?string $body = null, string $contentType = 'application/json', array $extraHeaders = [], ?int $timeoutOverride = null): array
    {
        $startTime = microtime(true);
        $timeout = $timeoutOverride ?? $this->timeout;

        $ch = curl_init();
        $headers = $extraHeaders;
        
        // Content-Type belirleme
        if ($method === 'POST' && $body !== null) {
            if (is_string($body) && (strpos($body, '{') === 0 || strpos($body, '[') === 0)) {
                // JSON içerik
                $headers[] = 'Content-Type: application/json';
            } else {
                // Binary içerik (resim, video vb.)
                $headers[] = 'Content-Type: application/octet-stream';
            }
        }

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
            CURLOPT_HTTPHEADER => $headers
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $endTime = microtime(true);

        if ($response === false || !empty($error)) {
            return [
                'success' => false,
                'error' => $error ?: 'Connection failed',
                'time' => round(($endTime - $startTime) * 1000)
            ];
        }

        $data = json_decode($response, true);

        return [
            'success' => $httpCode === 200,
            'http_code' => $httpCode,
            'data' => $data,
            'raw' => $response,
            'time' => round(($endTime - $startTime) * 1000)
        ];
    }

    /**
     * Ağdaki cihazları tara
     *
     * @param string $subnet Alt ağ (örn: 192.168.1)
     * @param int $startIp Başlangıç IP (1-254)
     * @param int $endIp Bitiş IP (1-254)
     * @param callable|null $progressCallback İlerleme callback'i
     */
    public function scanNetwork(string $subnet = '192.168.1', int $startIp = 1, int $endIp = 254, ?callable $progressCallback = null): array
    {
        $devices = [];
        $total = $endIp - $startIp + 1;
        $current = 0;

        for ($i = $startIp; $i <= $endIp; $i++) {
            $ip = "{$subnet}.{$i}";
            $current++;

            // İlerleme bildir
            if ($progressCallback) {
                $progressCallback($current, $total, $ip);
            }

            $result = $this->ping($ip);

            if ($result['online']) {
                // Cihaz bilgilerini almaya çalış
                $deviceInfo = $this->getDeviceInfo($ip);

                $devices[] = [
                    'ip' => $ip,
                    'response_time' => $result['response_time'],
                    'client_id' => $deviceInfo['client_id'] ?? null,
                    'model' => $deviceInfo['model'] ?? null,
                    'firmware' => $deviceInfo['firmware'] ?? null,
                    'screen_width' => $deviceInfo['screen_width'] ?? 800,
                    'screen_height' => $deviceInfo['screen_height'] ?? 1280,
                    'type' => 'esl_android'
                ];
            }
        }

        return $devices;
    }

    /**
     * Tek bir IP'yi hızlı tara ve PavoDisplay cihazı mı kontrol et
     */
    public function scanSingleIp(string $ip): array
    {
        $result = $this->ping($ip);

        if (!$result['online']) {
            return [
                'found' => false,
                'ip' => $ip,
                'error' => 'Device not responding'
            ];
        }

        // Cihaz bilgilerini al
        $deviceInfo = $this->getDeviceInfo($ip);

        return [
            'found' => true,
            'ip' => $ip,
            'response_time' => $result['response_time'],
            'client_id' => $deviceInfo['client_id'] ?? null,
            'model' => $deviceInfo['model'] ?? 'PavoDisplay',
            'firmware' => $deviceInfo['firmware'] ?? null,
            'screen_width' => $deviceInfo['screen_width'] ?? 800,
            'screen_height' => $deviceInfo['screen_height'] ?? 1280,
            'type' => 'esl_android',
            'is_pavo_display' => $deviceInfo['is_pavo_display'] ?? true
        ];
    }

    /**
     * Cihaz bilgilerini almak için çeşitli endpoint'leri dene
     */
    public function getDeviceInfo(string $ip): array
    {
        $info = [
            'is_pavo_display' => false,
            'client_id' => null,
            'model' => null,
            'firmware' => null,
            'screen_width' => 800,
            'screen_height' => 1280
        ];

        // /check endpoint'i ile kontrol et (PavoDisplay imzası)
        $checkResult = $this->checkFile($ip, 'files/task/test.txt');

        // Eğer /check çalışıyorsa PavoDisplay cihazıdır
        if (isset($checkResult['exists']) || isset($checkResult['error'])) {
            $info['is_pavo_display'] = true;
        }

        // /info veya /status endpoint'lerini dene
        $infoEndpoints = [
            '/info',
            '/status',
            '/device/info',
            '/api/info',
            '/api/device'
        ];

        foreach ($infoEndpoints as $endpoint) {
            $url = "http://{$ip}{$endpoint}";
            $response = $this->httpRequest($url, 'GET', null, 'application/json');

            if ($response['success'] && !empty($response['data'])) {
                $data = $response['data'];

                // Client ID bul
                if (isset($data['clientId'])) $info['client_id'] = $data['clientId'];
                if (isset($data['client_id'])) $info['client_id'] = $data['client_id'];
                if (isset($data['Id'])) $info['client_id'] = $data['Id'];
                if (isset($data['deviceId'])) $info['client_id'] = $data['deviceId'];

                // Model/Firmware
                if (isset($data['model'])) $info['model'] = $data['model'];
                if (isset($data['firmware'])) $info['firmware'] = $data['firmware'];
                if (isset($data['version'])) $info['firmware'] = $data['version'];

                // Ekran boyutu
                if (isset($data['screenWidth'])) $info['screen_width'] = (int)$data['screenWidth'];
                if (isset($data['screenHeight'])) $info['screen_height'] = (int)$data['screenHeight'];
                if (isset($data['screen_width'])) $info['screen_width'] = (int)$data['screen_width'];
                if (isset($data['screen_height'])) $info['screen_height'] = (int)$data['screen_height'];

                break;
            }
        }

        // Eğer client_id bulunamadıysa IP'den oluştur
        if (!$info['client_id']) {
            $info['client_id'] = 'PAVO_' . str_replace('.', '', $ip);
        }

        return $info;
    }

    /**
     * Birden fazla IP'yi paralel tara (cURL multi)
     */
    public function scanNetworkFast(string $subnet = '192.168.1', int $startIp = 1, int $endIp = 254): array
    {
        $devices = [];
        $handles = [];
        $mh = curl_multi_init();

        // Tüm IP'ler için cURL handle'ları oluştur
        for ($i = $startIp; $i <= $endIp; $i++) {
            $ip = "{$subnet}.{$i}";
            $url = "http://{$ip}/check?file_path=" . urlencode('files/task/ping.txt');

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 2,
                CURLOPT_CONNECTTIMEOUT => 1,
                CURLOPT_NOBODY => false
            ]);

            curl_multi_add_handle($mh, $ch);
            $handles[$ip] = $ch;
        }

        // Paralel çalıştır
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh);
        } while ($running > 0);

        // Sonuçları topla
        foreach ($handles as $ip => $ch) {
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $response = curl_multi_getcontent($ch);

            if ($httpCode === 200) {
                $devices[] = [
                    'ip' => $ip,
                    'response_time' => curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000,
                    'type' => 'esl_android'
                ];
            }

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }

        curl_multi_close($mh);

        // Bulunan cihazların detaylı bilgilerini al
        foreach ($devices as &$device) {
            $deviceInfo = $this->getDeviceInfo($device['ip']);
            $device = array_merge($device, $deviceInfo);
        }

        return $devices;
    }

    /**
     * Bluetooth ile sync yap
     * 
     * @param string $bluetoothName Bluetooth cihaz adı (örn: @B2A401A977)
     * @param string $ip Cihaz IP adresi (WiFi üzerinden dosya yükleme için)
     * @param array $product Ürün bilgileri
     * @param array $template Şablon ayarları
     * @param string|null $clientId Client ID
     */
    public function syncViaBluetooth(string $bluetoothName, string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // Önce WiFi üzerinden dosyaları yükle
        $wifiSync = $this->syncProduct($ip, $product, $template, $clientId);
        
        if (!$wifiSync['success']) {
            return $wifiSync;
        }

        // Bluetooth üzerinden tetikleme dene
        $btResult = $this->triggerBluetoothSync($bluetoothName, $clientId);
        
        return [
            'success' => true,
            'message' => 'Sync completed via WiFi + Bluetooth trigger',
            'wifi_sync' => $wifiSync,
            'bluetooth_trigger' => $btResult,
            'device_ip' => $ip,
            'bluetooth_name' => $bluetoothName
        ];
    }

    /**
     * Bluetooth üzerinden sync tetikle
     * 
     * Not: PHP'den direkt Bluetooth erişimi sınırlıdır.
     * Bu metod sistem komutlarını veya API endpoint'lerini kullanır.
     */
    private function triggerBluetoothSync(string $bluetoothName, ?string $clientId = null): array
    {
        $result = [
            'method' => 'bluetooth',
            'device_name' => $bluetoothName,
            'attempted' => false,
            'success' => false,
            'note' => 'Bluetooth sync requires system-level access or API endpoint'
        ];

        // Windows'ta Bluetooth komutları (eğer mevcut ise)
        if (PHP_OS_FAMILY === 'Windows') {
            // PowerShell ile Bluetooth komutları deneyebiliriz
            // Ancak bu genellikle admin yetkisi gerektirir
            $result['note'] = 'Windows Bluetooth access requires admin privileges';
        }

        // Alternatif: Cihazın Bluetooth üzerinden HTTP endpoint'i olabilir
        // Örneğin: Bluetooth üzerinden HTTP isteği gönderme
        // Bu genellikle özel bir Bluetooth-HTTP bridge gerektirir

        return $result;
    }

    /**
     * Bluetooth cihaz bilgilerini al
     */
    public function getBluetoothInfo(string $ip): array
    {
        // Cihazdan Bluetooth bilgilerini almak için endpoint'leri dene
        $endpoints = [
            '/bluetooth/info',
            '/info/bluetooth',
            '/device/info',
            '/api/bluetooth'
        ];

        foreach ($endpoints as $endpoint) {
            $url = "http://{$ip}{$endpoint}";
            $response = $this->httpRequest($url);
            
            if ($response['success'] && isset($response['data'])) {
                return [
                    'found' => true,
                    'endpoint' => $endpoint,
                    'data' => $response['data']
                ];
            }
        }

        return [
            'found' => false,
            'note' => 'Bluetooth info endpoint not found. Using default: @B2A401A977'
        ];
    }

    /**
     * WiFi + Bluetooth kombinasyonu ile sync
     * 
     * @param string $ip Cihaz IP
     * @param string $bluetoothName Bluetooth cihaz adı
     * @param array $product Ürün bilgileri
     * @param array $template Şablon ayarları
     * @param string|null $clientId Client ID
     */
    public function syncWiFiAndBluetooth(string $ip, string $bluetoothName, array $product, array $template = [], ?string $clientId = null): array
    {
        // 1. WiFi üzerinden dosyaları yükle
        $wifiResult = $this->syncProduct($ip, $product, $template, $clientId);
        
        if (!$wifiResult['success']) {
            return [
                'success' => false,
                'error' => 'WiFi sync failed: ' . ($wifiResult['error'] ?? 'Unknown error'),
                'wifi_sync' => $wifiResult
            ];
        }

        // 2. Bluetooth bilgilerini al
        $btInfo = $this->getBluetoothInfo($ip);
        
        // 3. Bluetooth tetikleme dene
        $btTrigger = $this->triggerBluetoothSync($bluetoothName, $clientId);

        return [
            'success' => true,
            'message' => 'Sync completed via WiFi, Bluetooth trigger attempted',
            'wifi_sync' => $wifiResult,
            'bluetooth_info' => $btInfo,
            'bluetooth_trigger' => $btTrigger,
            'device_ip' => $ip,
            'bluetooth_name' => $bluetoothName,
            'client_id' => $clientId
        ];
    }

    /**
     * APK'nın sync butonunun yaptığı işlemleri taklit et
     * 
     * APK analizinden bulunan bilgilere göre:
     * - SyncDeviceUtils sınıfı sync işlemini yapıyor
     * - Upload sonrası özel bir tetikleme endpoint'i çağrılıyor olabilir
     * 
     * @param string $ip Cihaz IP
     * @param string|null $clientId Client ID
     */
    public function triggerSyncLikeAPK(string $ip, ?string $clientId = null): array
    {
        $results = [];
        
        // APK'nın muhtemelen çağırdığı endpoint'ler
        $triggerEndpoints = [
            '/sync',
            '/task',
            '/execute',
            '/notify',
            '/refresh',
            '/play',
            '/run',
            '/start',
            '/trigger',
            '/device/sync',
            '/device/refresh',
            '/api/sync',
            '/api/refresh'
        ];
        
        foreach($triggerEndpoints as $endpoint) {
            $url = "http://{$ip}{$endpoint}";
            
            // POST ile dene
            $postData = [];
            if ($clientId) {
                $postData['client_id'] = $clientId;
                $postData['clientId'] = $clientId;
            }
            $postData['action'] = 'sync';
            $postData['timestamp'] = time();
            
            $response = $this->httpRequest($url, 'POST', json_encode($postData), 'application/json');
            $results[$endpoint . '_POST'] = $response;
            
            // GET ile de dene
            $getUrl = $url;
            if ($clientId) {
                $getUrl .= '?client_id=' . urlencode($clientId) . '&action=sync';
            }
            $response = $this->httpRequest($getUrl, 'GET');
            $results[$endpoint . '_GET'] = $response;
        }
        
        // Başarılı olanları bul
        $successful = [];
        foreach($results as $key => $result) {
            if($result['success'] && isset($result['data'])) {
                $successful[$key] = $result;
            }
        }
        
        return [
            'success' => !empty($successful),
            'attempted_endpoints' => count($results),
            'successful_endpoints' => array_keys($successful),
            'results' => $results
        ];
    }

    /**
     * APK'nın tam sync akışını taklit et
     * 
     * 1. Dosyaları yükle
     * 2. Sync tetikle
     * 
     * @param string $ip Cihaz IP
     * @param array $product Ürün bilgileri
     * @param array $template Şablon ayarları
     * @param string|null $clientId Client ID
     */
    public function syncLikeAPK(string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // 1. Önce dosyaları yükle
        $uploadResult = $this->syncProduct($ip, $product, $template, $clientId);
        
        if (!$uploadResult['success']) {
            return [
                'success' => false,
                'error' => 'Upload failed: ' . ($uploadResult['error'] ?? 'Unknown error'),
                'upload_result' => $uploadResult
            ];
        }
        
        // 2. Sync tetikle (APK'nın yaptığı gibi)
        sleep(1); // APK muhtemelen kısa bir bekleme yapıyor
        $triggerResult = $this->triggerSyncLikeAPK($ip, $clientId);
        
        return [
            'success' => true,
            'message' => 'Sync completed like APK',
            'upload_result' => $uploadResult,
            'trigger_result' => $triggerResult,
            'device_ip' => $ip,
            'client_id' => $clientId
        ];
    }

    /**
     * Cihaz storage alanını temizle
     *
     * @param string $ip Cihaz IP adresi
     * @return array Sonuç
     */
    public function clearSpace(string $ip): array
    {
        $url = "http://{$ip}/control?action=clearspace";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
                'Content-Type: application/x-www-form-urlencoded; charset=UTF-8'
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'message' => 'Storage cleared'
            ];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? $error ?? 'Clear failed',
            'http_code' => $httpCode,
            'response' => $response
        ];
    }

    /**
     * Cihaz detaylı bilgilerini al (Iotags endpoint)
     *
     * @param string $ip Cihaz IP adresi
     * @param string $appId App ID (varsayılan boş)
     * @param string $appSecret App Secret (varsayılan boş)
     * @return array Cihaz bilgileri
     */
    public function getDeviceDetails(string $ip, string $appId = '', string $appSecret = ''): array
    {
        $timestamp = time();
        $params = ['appid' => $appId, 'timestamp' => $timestamp];
        $sign = $this->calculateSign($params, $appSecret);

        $url = "http://{$ip}/Iotags?appid={$appId}&timestamp={$timestamp}&sign={$sign}";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 3,               // 10 -> 3 saniye (hızlı yanıt)
            CURLOPT_CONNECTTIMEOUT => 2,         // 5 -> 2 saniye
            CURLOPT_HTTPHEADER => [
                'Accept: application/json'
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'name' => $data['name'] ?? null,
                'client_id' => $data['clientid'] ?? null,
                'model' => $data['model'] ?? null,
                'firmware' => $data['version'] ?? null,
                'keep_alive' => $data['keep-alive'] ?? null,
                'free_space' => $data['free-space'] ?? null,
                'storage' => $data['storage'] ?? null,
                'screen_width' => $data['lcd_screen_width'] ?? 800,
                'screen_height' => $data['lcd_screen_height'] ?? 1280
            ];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? $error ?? 'Failed to get device info',
            'http_code' => $httpCode
        ];
    }

    /**
     * Cihaz arka ışık kontrolü
     *
     * NOT: HTTP-SERVER modunda parlaklık kontrolü desteklenmiyor!
     * Bu özellik için Bluetooth veya MQTT gerekiyor.
     *
     * Bluetooth komutu: +SET-DEVICE:{"Hardware":{"brightness":100}, "Token":""}\r\n
     * MQTT komutu: {"action":"backlight-set","push_id":0,"clientid":"DEVICE_ID","backlight":100}
     *
     * @param string $ip Cihaz IP adresi
     * @param string $action 'on', 'off' veya 'set'
     * @param int|null $level Parlaklık seviyesi (0-100, sadece action='set' için)
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array Sonuç
     */
    public function setBacklight(string $ip, string $action = 'on', ?int $level = null, string $appId = '', string $appSecret = ''): array
    {
        // HTTP-SERVER modunda parlaklık kontrolü desteklenmiyor
        // Ancak yine de deneyelim - belki firmware güncellendi

        // Action'a göre endpoint belirle (sign her action için ayrı hesaplanır)
        switch ($action) {
            case 'on':
                $params = ['action' => 'backlight-on'];
                $sign = $this->calculateSign($params, $appSecret);
                $url = "http://{$ip}/control?action=backlight-on&sign={$sign}";
                break;
            case 'off':
                $params = ['action' => 'backlight-off'];
                $sign = $this->calculateSign($params, $appSecret);
                $url = "http://{$ip}/control?action=backlight-off&sign={$sign}";
                break;
            case 'set':
                $level = max(0, min(100, $level ?? 100));
                $params = ['action' => 'backlight-set', 'backlight' => $level];
                $sign = $this->calculateSign($params, $appSecret);
                $url = "http://{$ip}/control?action=backlight-set&backlight={$level}&sign={$sign}";
                break;
            default:
                return ['success' => false, 'error' => 'Invalid action'];
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'message' => 'Backlight ' . $action . ' successful'
            ];
        }

        // HTTP-SERVER modunda desteklenmiyor - Bluetooth/MQTT gerekiyor
        return [
            'success' => false,
            'error' => 'HTTP-SERVER modunda parlaklık kontrolü desteklenmiyor',
            'hint' => 'Bluetooth veya MQTT kullanın',
            'bluetooth_command' => '+SET-DEVICE:{"Hardware":{"brightness":' . ($level ?? 100) . '}, "Token":""}',
            'mqtt_command' => '{"action":"backlight-set","push_id":0,"clientid":"DEVICE_ID","backlight":' . ($level ?? 100) . '}'
        ];
    }

    /**
     * Cihazı yeniden başlat (HTTP-SERVER mode)
     * NOT: HTTP-SERVER modunda doğrudan restart endpoint'i yoktur.
     * Bu metod cihaza restart komutu göndermeye çalışır.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array Sonuç
     */
    public function restartDevice(string $ip, string $appId = '', string $appSecret = ''): array
    {
        // HTTP-SERVER modunda restart endpoint'i dene (her biri için ayrı sign)
        $endpointDefs = [
            ['path' => '/control', 'params' => ['action' => 'restart']],
            ['path' => '/control', 'params' => ['action' => 'reboot']],
            ['path' => '/restart', 'params' => []],
            ['path' => '/reboot', 'params' => []],
        ];

        foreach ($endpointDefs as $epDef) {
            $sign = $this->calculateSign($epDef['params'], $appSecret);
            $queryParams = array_merge($epDef['params'], ['sign' => $sign]);
            $queryString = http_build_query($queryParams);
            $url = "http://{$ip}{$epDef['path']}?{$queryString}";

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_CONNECTTIMEOUT => $this->connectTimeout
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $data = json_decode($response, true);

            if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
                return [
                    'success' => true,
                    'message' => 'Device restart initiated'
                ];
            }
        }

        // HTTP-SERVER modunda restart desteklenmiyorsa bildir
        return [
            'success' => false,
            'error' => 'Restart not supported in HTTP-SERVER mode. Use Bluetooth or MQTT.',
            'hint' => 'MQTT command: {"action":"deviceRestart","push_id":0,"clientid":"DEVICE_ID"}'
        ];
    }

    /**
     * Firmware güncelleme dosyasını cihaza yükle
     *
     * WARNING: Bu işlem cihazı kalıcı olarak bozabilir!
     * Yalnızca güvenilir kaynaklardan alınan firmware dosyalarını kullanın.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $content Firmware dosya içeriği (binary)
     * @param string $filePath Hedef dosya yolu (files/upgrade/firmware.pkg)
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array Sonuç
     */
    public function uploadFirmware(string $ip, string $content, string $filePath, string $appId = '', string $appSecret = ''): array
    {
        // Dosya yolu kontrolü - upgrade dizini kullan
        if (strpos($filePath, 'files/upgrade/') !== 0) {
            $filePath = 'files/upgrade/' . basename($filePath);
        }

        $params = ['file_path' => $filePath];
        $sign = $this->calculateSign($params, $appSecret);

        $url = "http://{$ip}/upgrade?file_path=" . urlencode($filePath) . "&sign={$sign}";

        // Binary upload
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $content,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/octet-stream',
                'Content-Length: ' . strlen($content)
            ],
            CURLOPT_TIMEOUT => 300, // 5 dakika timeout (büyük dosyalar için)
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'error' => 'Bağlantı hatası: ' . $curlError
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'message' => 'Firmware yüklendi, cihaz yeniden başlatılıyor'
            ];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? 'Firmware yükleme başarısız',
            'http_code' => $httpCode,
            'response' => $response
        ];
    }

    /**
     * Dosya varlığını detaylı kontrol et
     *
     * @param string $ip Cihaz IP adresi
     * @param string $filePath Dosya yolu
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array Sonuç (exists, md5 vb.)
     */
    public function checkFileDetailed(string $ip, string $filePath, string $appId = '', string $appSecret = ''): array
    {
        $params = ['file_path' => $filePath];
        $sign = $this->calculateSign($params, $appSecret);

        $url = "http://{$ip}/check?file_path=" . urlencode($filePath) . "&sign={$sign}";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'exists' => $data['exists'] ?? true,
                'md5' => $data['md5'] ?? null,
                'size' => $data['size'] ?? null
            ];
        }

        return [
            'success' => true,
            'exists' => false,
            'error' => $data['message'] ?? $error ?? null
        ];
    }

    /**
     * Ürün etiketini cihaza gönder (tam akış)
     *
     * Akış:
     * 1. Storage temizle (clearspace)
     * 2. Görseli 800x1280 JPEG olarak hazırla
     * 3. Görseli yükle
     * 4. Task config yükle
     * 5. Replay tetikle
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID (MAC adresi)
     * @param string|resource $image Görsel dosya yolu veya GD image resource
     * @param array $product Ürün bilgileri (dinamik alanlar için)
     * @param int $width Hedef genişlik (varsayılan 800)
     * @param int $height Hedef yükseklik (varsayılan 1280)
     * @param array $designData Şablon design_data (dinamik alanlar için, opsiyonel)
     * @return array Sonuç
     */
    public function sendLabel(string $ip, string $clientId, $image, array $product = [], int $width = 800, int $height = 1280, array $designData = []): array
    {
        $result = [
            'success' => false,
            'steps' => [],
            'skipped' => false
        ];

        // DEBUG: sendLabel parametrelerini logla
        $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/sendLabel_debug.log' : '/tmp/sendLabel_debug.log';
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
        file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] === sendLabel ÇAĞRILDI ===\n", FILE_APPEND);
        file_put_contents($logFile, "IP: $ip, ClientID: $clientId, Width: $width, Height: $height\n", FILE_APPEND);
        file_put_contents($logFile, "Product keys: " . implode(', ', array_keys($product)) . "\n", FILE_APPEND);
        file_put_contents($logFile, "Product name: " . ($product['name'] ?? 'YOK') . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData keys: " . implode(', ', array_keys($designData)) . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData objects count: " . (isset($designData['objects']) ? count($designData['objects']) : 'YOK') . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData _templateWidth: " . ($designData['_templateWidth'] ?? 'YOK') . "\n", FILE_APPEND);

        // 1. Görseli hazırla (önce MD5 hesapla, delta kontrolü için)
        if (is_string($image)) {
            // Dosya yolu verilmiş
            if (!file_exists($image)) {
                $result['error'] = 'Image file not found: ' . $image;
                return $result;
            }

            $extension = strtolower(pathinfo($image, PATHINFO_EXTENSION));
            if ($extension === 'png') {
                $srcImage = imagecreatefrompng($image);
            } elseif (in_array($extension, ['jpg', 'jpeg'])) {
                $srcImage = imagecreatefromjpeg($image);
            } else {
                $result['error'] = 'Unsupported image format: ' . $extension;
                return $result;
            }
        } elseif (is_resource($image) || $image instanceof \GdImage) {
            // GD resource verilmiş
            $srcImage = $image;
        } else {
            $result['error'] = 'Invalid image parameter';
            return $result;
        }

        $srcWidth = imagesx($srcImage);
        $srcHeight = imagesy($srcImage);

        // Hedef boyuta resize et
        $dstImage = imagecreatetruecolor($width, $height);

        // Beyaz arka plan (JPEG transparanlık desteklemez)
        $white = imagecolorallocate($dstImage, 255, 255, 255);
        imagefill($dstImage, 0, 0, $white);

        $srcRatio = $srcWidth / max(1, $srcHeight);
        $dstRatio = $width / max(1, $height);

        if (abs($srcRatio - $dstRatio) < 0.01) {
            imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $width, $height, $srcWidth, $srcHeight);
        } else {
            $cropWidth = $srcWidth;
            $cropHeight = (int)($srcWidth / $dstRatio);

            if ($cropHeight > $srcHeight) {
                $cropHeight = $srcHeight;
                $cropWidth = (int)($srcHeight * $dstRatio);
            }

            $cropX = (int)(($srcWidth - $cropWidth) / 2);
            $cropY = (int)(($srcHeight - $cropHeight) / 2);
            imagecopyresampled($dstImage, $srcImage, 0, 0, $cropX, $cropY, $width, $height, $cropWidth, $cropHeight);
        }

        // 1b. DİNAMİK ALANLARI RENDER ET (GD ile)
        if (!empty($designData) && !empty($product)) {
            $this->renderDynamicFields($dstImage, $designData, $product, $srcWidth, $srcHeight, $width, $height);
            $result['steps']['dynamic_fields'] = ['rendered' => true];
        }

        // JPEG olarak buffer'a kaydet
        ob_start();
        imagejpeg($dstImage, null, 90);
        $imageContent = ob_get_clean();

        // Sadece dosyadan oluşturduysak destroy et
        if (is_string($image)) {
            imagedestroy($srcImage);
        }
        imagedestroy($dstImage);

        $imageMd5 = strtoupper(md5($imageContent));
        $targetFileName = $clientId . '.jpg';
        $targetFilePath = "files/task/{$targetFileName}";

        $result['steps']['image'] = [
            'original_size' => "{$srcWidth}x{$srcHeight}",
            'target_size' => "{$width}x{$height}",
            'file_size' => strlen($imageContent),
            'md5' => $imageMd5
        ];

        // 2. DELTA CHECK: Cihazda aynı dosya var mı kontrol et
        $checkResult = $this->checkFile($ip, $targetFilePath);
        $result['steps']['delta_check'] = $checkResult;

        $needsUpload = true;
        if ($checkResult['exists'] && !empty($checkResult['md5'])) {
            // MD5 karşılaştır (case-insensitive)
            if (strcasecmp($checkResult['md5'], $imageMd5) === 0) {
                // Dosya zaten mevcut ve aynı, yükleme atla
                $needsUpload = false;
                $result['skipped'] = true;
                $result['steps']['upload'] = [
                    'success' => true,
                    'skipped' => true,
                    'reason' => 'File already exists with same MD5'
                ];
            }
        }

        if ($needsUpload) {
            // 3a. Storage temizle (sadece yükleme gerekiyorsa)
            $clearResult = $this->clearSpace($ip);
            $result['steps']['clear'] = $clearResult;

            if (!$clearResult['success']) {
                $result['error'] = 'Failed to clear storage: ' . ($clearResult['error'] ?? 'Unknown error');
                return $result;
            }

            // 3b. Görseli yükle
            $uploadResult = $this->uploadFile($ip, $targetFilePath, $imageContent);
            $result['steps']['upload'] = $uploadResult;

            if (!$uploadResult['success']) {
                $result['error'] = 'Failed to upload image: ' . ($uploadResult['error'] ?? 'Unknown error');
                return $result;
            }
        }

        // 4. Task config oluştur ve yükle
        $pictureSafeLeftInset = $this->resolvePictureSafeLeftInset($designData, $product, 0);
        if ($pictureSafeLeftInset > 0) {
            file_put_contents($logFile, "LabelPicture safe-left inset uygulandi: {$pictureSafeLeftInset}px\n", FILE_APPEND);
        }

        $taskConfig = [
            'Id' => $clientId,
            'ItemCode' => $product['sku'] ?? $product['id'] ?? 'ITEM-001',
            'ItemName' => $product['name'] ?? 'Product',
            'LabelPicture' => [
                'Height' => $height,
                'Width' => $width,
                'X' => $pictureSafeLeftInset,
                'Y' => 0,
                'PictureName' => $targetFileName,
                'PicturePath' => $targetFilePath,
                'PictureMD5' => $imageMd5
            ]
        ];

        $taskJson = json_encode($taskConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $taskFilePath = "files/task/{$clientId}.js";

        $taskUploadResult = $this->uploadFile($ip, $taskFilePath, $taskJson);
        $result['steps']['task'] = $taskUploadResult;

        if (!$taskUploadResult['success']) {
            $result['error'] = 'Failed to upload task config: ' . ($taskUploadResult['error'] ?? 'Unknown error');
            return $result;
        }

        // 5. Replay tetikle
        $replayResult = $this->triggerReplay($ip, $taskFilePath);
        $result['steps']['replay'] = $replayResult;

        if (!$replayResult['success']) {
            $result['error'] = 'Failed to trigger replay: ' . ($replayResult['error'] ?? 'Unknown error');
            return $result;
        }

        $result['success'] = true;
        $result['message'] = 'Label sent successfully';
        $result['device_ip'] = $ip;
        $result['client_id'] = $clientId;
        $result['image_path'] = $targetFilePath;
        $result['task_path'] = $taskFilePath;

        return $result;
    }

    /**
     * Dinamik alanları GD ile görsele render et
     *
     * Şablon design_data içindeki dynamicField özellikli elemanları bulur
     * ve ürün verileriyle değiştirerek görsele yazar.
     *
     * @param \GdImage $image GD image resource
     * @param array $designData Şablon design_data (objects dizisi içermeli)
     * @param array $product Ürün bilgileri
     * @param int $srcWidth Kaynak görsel genişliği
     * @param int $srcHeight Kaynak görsel yüksekliği
     * @param int $dstWidth Hedef görsel genişliği
     * @param int $dstHeight Hedef görsel yüksekliği
     */
    private function renderDynamicFields($image, array $designData, array $product, int $srcWidth, int $srcHeight, int $dstWidth, int $dstHeight): void
    {
        // DEBUG LOG
        $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/dynamic_render.log' : '/tmp/dynamic_render.log';
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) @mkdir($logDir, 0755, true);

        $log = function($msg) use ($logFile) {
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] $msg\n", FILE_APPEND);
        };

        $log("=== renderDynamicFields BAŞLADI ===");
        $log("Src: {$srcWidth}x{$srcHeight}, Dst: {$dstWidth}x{$dstHeight}");
        $log("Product keys: " . implode(', ', array_keys($product)));
        $log("Product name: " . ($product['name'] ?? 'YOK'));

        // designData kontrolü
        if (!isset($designData['objects']) || !is_array($designData['objects'])) {
            $log("designData objects dizisi yok");
            $log("designData keys: " . implode(', ', array_keys($designData)));
            return;
        }

        $log("designData keys: " . implode(', ', array_keys($designData)));
        $log("Objects sayısı: " . count($designData['objects']));

        // Şablon boyutu
        $templateWidth = (int)($designData['_templateWidth'] ?? $srcWidth);
        $templateHeight = (int)($designData['_templateHeight'] ?? $srcHeight);
        $log("Template size: {$templateWidth}x{$templateHeight}");

        // Ölçekleme oranları
        $scaleX = $dstWidth / $templateWidth;
        $scaleY = $dstHeight / $templateHeight;
        $log("Scale: X={$scaleX}, Y={$scaleY}");

        // Sol kenara dayali dinamik nesnelerde cihaz kirpmasini azaltmak icin guvenli pad.
        // HTTP sendLabel/sendGridLabel ve MQTT (reflection ile ayni metod) icin ortak davranis.
        $safeLeftPad = 10;
        if (isset($designData['safe_left_pad']) && is_numeric($designData['safe_left_pad'])) {
            $safeLeftPad = (int)$designData['safe_left_pad'];
        } elseif (isset($designData['safeLeftPad']) && is_numeric($designData['safeLeftPad'])) {
            $safeLeftPad = (int)$designData['safeLeftPad'];
        } elseif (isset($product['__safe_left_pad']) && is_numeric($product['__safe_left_pad'])) {
            $safeLeftPad = (int)$product['__safe_left_pad'];
        } elseif (isset($product['__safe_left_inset']) && is_numeric($product['__safe_left_inset'])) {
            $safeLeftPad = (int)$product['__safe_left_inset'];
        }
        $safeLeftPad = max(0, min(40, $safeLeftPad));

        $safeLeftThreshold = 12.0;
        if (isset($designData['safe_left_threshold']) && is_numeric($designData['safe_left_threshold'])) {
            $safeLeftThreshold = (float)$designData['safe_left_threshold'];
        }
        $safeLeftThreshold = max(0.0, min(80.0, $safeLeftThreshold));
        $log("Safe-left config: pad={$safeLeftPad}px threshold={$safeLeftThreshold}px");

        // Font bul
        $fontPath = $this->findSystemFont();
        $log("Font: " . ($fontPath ?? 'YOK'));

        if (!$fontPath) {
            $log("Font bulunamadı, metin render'ı yapılamıyor");
            return;
        }

        // Ürün değerlerini hazırla
        $fieldValues = $this->buildFieldValues($product);
        $log("Field values: " . json_encode($fieldValues, JSON_UNESCAPED_UNICODE));

        // Arka plan rengini bul (maskeleme için)
        $bgColor = null;
        if (isset($designData['background'])) {
            $bg = $designData['background'];
            if (is_string($bg) && preg_match('/^#?[0-9a-fA-F]{3,6}$/', $bg)) {
                $rgb = $this->hexToRgb($bg);
                $bgColor = imagecolorallocate($image, $rgb['r'], $rgb['g'], $rgb['b']);
            }
        }
        if (!$bgColor) {
            $bgColor = imagecolorallocate($image, 255, 255, 255); // Varsayılan beyaz
        }

        $dynamicCount = 0;
        $renderedCount = 0;

        foreach ($designData['objects'] as $index => $obj) {
            // Dinamik alan var mı kontrol et
            $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;
            $rawText = $obj['text'] ?? null;
            $resolvedText = null;

            // Barkod/QR nesnelerinin dynamicField veya barcodeValue'dan da alan adı alınabilir
            $customType = $obj['customType'] ?? '';
            if (!$dynamicField && in_array($customType, ['barcode', 'qrcode'])) {
                $barcodeVal = $obj['barcodeValue'] ?? $obj['qrValue'] ?? '';
                if (is_string($barcodeVal) && preg_match('/^\{\{(\w+)\}\}$/', $barcodeVal, $m)) {
                    $dynamicField = $m[1];
                }
            }

            if (!$dynamicField && is_string($rawText) && strpos($rawText, '{{') !== false) {
                $resolvedText = preg_replace_callback('/\{\{([^}]+)\}\}/', function ($matches) use ($fieldValues) {
                    $key = trim($matches[1]);
                    return isset($fieldValues[$key]) ? (string)$fieldValues[$key] : '';
                }, $rawText);
                if ($resolvedText === $rawText) {
                    continue;
                }
            }

            if (!$dynamicField && $resolvedText === null) {
                continue;
            }

            $dynamicCount++;
            $type = strtolower($obj['type'] ?? 'unknown');
            $log("Object #{$index}: type={$type}, dynamicField=" . ($dynamicField ?? 'YOK'));

            $value = null;
            if ($dynamicField) {
                // Field adını temizle ({{ }} kaldır)
                $fieldName = trim($dynamicField, '{} ');
                $log("  Cleaned fieldName: {$fieldName}");

                // Değeri bul
                if (!isset($fieldValues[$fieldName]) || $fieldValues[$fieldName] === '') {
                    $log("  SKIP: fieldValues[{$fieldName}] yok veya boş");
                    continue;
                }

                $value = (string)$fieldValues[$fieldName];
                $log("  Value: {$value}");
            } else {
                $value = (string)$resolvedText;
                $log("  ResolvedText: {$value}");
            }

            // Barkod/QR nesnelerini özel işle
            $customType = $obj['customType'] ?? '';
            if (in_array($customType, ['barcode', 'qrcode'])) {
                $log("  BARCODE/QR obje bulundu: customType={$customType}");
                $this->renderBarcodeOnImage($image, $obj, $value, $scaleX, $scaleY, $log, $safeLeftPad, $safeLeftThreshold);
                $renderedCount++;
                continue;
            }

            // Sadece metin tiplerini işle
            // Fabric.js v5: 'text','i-text','textbox' | v7: 'Text','IText','Textbox'
            // strtolower zaten uygulandı, v7 'IText' → 'itext' olur (tiresiz)
            if (!in_array($type, ['text', 'i-text', 'itext', 'textbox'])) {
                $log("  SKIP: Type '{$type}' metin değil, customType={$customType}");
                continue;
            }

            // Pozisyon ve boyut hesapla
            $left = (float)($obj['left'] ?? 0);
            $top = (float)($obj['top'] ?? 0);
            $fontSize = (float)($obj['fontSize'] ?? 20);
            $objWidth = (float)($obj['width'] ?? 0);
            $objHeight = (float)($obj['height'] ?? 0);
            $objScaleX = (float)($obj['scaleX'] ?? 1.0);
            $objScaleY = (float)($obj['scaleY'] ?? 1.0);
            $originX = $obj['originX'] ?? 'center';
            $originY = $obj['originY'] ?? 'center';
            $textAlign = $obj['textAlign'] ?? 'left';
            $fontWeight = $obj['fontWeight'] ?? 'normal';

            // Nesne kendi scale'i ile efektif boyutları hesapla
            $effectiveWidth = $objWidth * $objScaleX;
            $effectiveHeight = $objHeight * $objScaleY;
            $effectiveFontSize = $fontSize * $objScaleY; // scaleY font boyutunu etkiler

            // Şablon → cihaz ölçekleme
            $scaledFontSize = (int)max(8, $effectiveFontSize * min($scaleX, $scaleY));
            $scaledWidth = (int)($effectiveWidth * $scaleX);

            // Origin'e göre pozisyon düzeltmesi (Fabric.js v7 center origin kullanır)
            $adjLeft = $left;
            $adjTop = $top;
            if ($originX === 'center') {
                $adjLeft = $left - ($effectiveWidth / 2);
            } elseif ($originX === 'right') {
                $adjLeft = $left - $effectiveWidth;
            }
            if ($originY === 'center') {
                $adjTop = $top - ($effectiveHeight / 2);
            } elseif ($originY === 'bottom') {
                $adjTop = $top - $effectiveHeight;
            }

            $appliedSafeLeftPad = 0;
            if ($safeLeftPad > 0 && $this->shouldApplySafeLeftInset($obj, $adjLeft, $textAlign, $safeLeftThreshold)) {
                $adjLeft += $safeLeftPad;
                $appliedSafeLeftPad = $safeLeftPad;
            }

            $scaledLeft = (int)($adjLeft * $scaleX);
            $scaledTop = (int)($adjTop * $scaleY);

            $log("  Position: orig=({$left},{$top}) origin=({$originX},{$originY}) adj=({$adjLeft},{$adjTop}) -> scaled=({$scaledLeft},{$scaledTop})");
            if ($appliedSafeLeftPad > 0) {
                $log("  Safe-left pad uygulandi: +{$appliedSafeLeftPad}px");
            }
            $log("  ObjScale: scaleX={$objScaleX}, scaleY={$objScaleY}");
            $log("  Font: orig={$fontSize} effective={$effectiveFontSize} -> scaled={$scaledFontSize}");
            $log("  Width: orig={$objWidth} effective={$effectiveWidth} -> scaled={$scaledWidth}");

            // Renk
            $fillColor = $obj['fill'] ?? '#000000';
            $rgb = $this->hexToRgb($fillColor);
            $textColor = imagecolorallocate($image, $rgb['r'], $rgb['g'], $rgb['b']);
            $log("  Color: {$fillColor} -> RGB({$rgb['r']},{$rgb['g']},{$rgb['b']})");

            // Metin sarmalama (word-wrap) - genişlik varsa satırlara böl
            $lines = [];
            if ($scaledWidth > 0) {
                $lines = $this->wrapText($value, $scaledFontSize, $fontPath, $scaledWidth, $fontWeight);
            } else {
                $lines = [$value]; // Genişlik yoksa tek satır
            }
            $log("  Lines: " . count($lines) . " satır (wrap width={$scaledWidth})");

            // Satır yüksekliği hesapla
            $lineHeight = (float)($obj['lineHeight'] ?? 1.16);
            $lineSpacing = (int)($scaledFontSize * $lineHeight);

            // Toplam metin yüksekliği
            $totalTextHeight = count($lines) * $lineSpacing;

            // Maskeleme dikdörtgeni çiz (eski metni kapat)
            $maskWidth = $scaledWidth > 0 ? $scaledWidth : 0;
            foreach ($lines as $line) {
                $bbox = imagettfbbox($scaledFontSize, 0, $fontPath, $line);
                $lineWidth = abs($bbox[2] - $bbox[0]);
                $maskWidth = max($maskWidth, $lineWidth);
            }
            $maskRight = $scaledLeft + $maskWidth + 5;
            $maskBottom = $scaledTop + $totalTextHeight + 5;
            $log("  MASK: rectangle ({$scaledLeft},{$scaledTop}) to ({$maskRight},{$maskBottom})");
            imagefilledrectangle($image, $scaledLeft, $scaledTop, $maskRight, $maskBottom, $bgColor);

            // Satır satır metin yaz
            $currentY = $scaledTop;
            foreach ($lines as $lineIdx => $line) {
                // Font metrikleri
                $bbox = imagettfbbox($scaledFontSize, 0, $fontPath, $line);
                $lineWidth = abs($bbox[2] - $bbox[0]);
                $lineAscent = abs($bbox[7] - $bbox[1]);

                // Hizalama (textAlign)
                $lineX = $scaledLeft;
                if ($textAlign === 'center' && $scaledWidth > 0) {
                    $lineX = $scaledLeft + (int)(($scaledWidth - $lineWidth) / 2);
                } elseif ($textAlign === 'right' && $scaledWidth > 0) {
                    $lineX = $scaledLeft + ($scaledWidth - $lineWidth);
                }

                $textY = $currentY + $lineAscent;
                $log("  LINE #{$lineIdx}: '{$line}' at ({$lineX}, {$textY}) align={$textAlign}");
                imagettftext($image, $scaledFontSize, 0, $lineX, $textY, $textColor, $fontPath, $line);

                $currentY += $lineSpacing;
            }

            $renderedCount++;
        }

        $log("=== SONUÇ: {$dynamicCount} dinamik alan bulundu, {$renderedCount} tanesi render edildi ===");
    }

    /**
     * Metni belirli genişliğe göre satırlara böl (word-wrap)
     *
     * @param string $text Sarmalanacak metin
     * @param int $fontSize Font boyutu (px)
     * @param string $fontPath Font dosyası yolu
     * @param int $maxWidth Maksimum genişlik (px)
     * @param string $fontWeight Font ağırlığı (normal, bold)
     * @return string[] Satır dizisi
     */
    private function wrapText(string $text, int $fontSize, string $fontPath, int $maxWidth, string $fontWeight = 'normal'): array
    {
        if ($maxWidth <= 0 || empty(trim($text))) {
            return [$text];
        }

        // Önce tüm metin tek satıra sığıyor mu kontrol et
        $bbox = imagettfbbox($fontSize, 0, $fontPath, $text);
        $textWidth = abs($bbox[2] - $bbox[0]);
        if ($textWidth <= $maxWidth) {
            return [$text];
        }

        $words = explode(' ', $text);
        $lines = [];
        $currentLine = '';

        foreach ($words as $word) {
            $testLine = $currentLine === '' ? $word : $currentLine . ' ' . $word;

            $bbox = imagettfbbox($fontSize, 0, $fontPath, $testLine);
            $testWidth = abs($bbox[2] - $bbox[0]);

            if ($testWidth <= $maxWidth) {
                $currentLine = $testLine;
            } else {
                // Mevcut satır varsa kaydet
                if ($currentLine !== '') {
                    $lines[] = $currentLine;
                }

                // Tek kelime genişlikten büyükse, karakter bazlı böl
                $bbox = imagettfbbox($fontSize, 0, $fontPath, $word);
                $wordWidth = abs($bbox[2] - $bbox[0]);

                if ($wordWidth > $maxWidth) {
                    // Kelimeyi karakter bazlı böl
                    $chars = mb_str_split($word);
                    $currentLine = '';
                    foreach ($chars as $char) {
                        $testChar = $currentLine . $char;
                        $bbox = imagettfbbox($fontSize, 0, $fontPath, $testChar);
                        $charWidth = abs($bbox[2] - $bbox[0]);
                        if ($charWidth <= $maxWidth) {
                            $currentLine = $testChar;
                        } else {
                            if ($currentLine !== '') $lines[] = $currentLine;
                            $currentLine = $char;
                        }
                    }
                } else {
                    $currentLine = $word;
                }
            }
        }

        if ($currentLine !== '') {
            $lines[] = $currentLine;
        }

        return !empty($lines) ? $lines : [$text];
    }

    /**
     * Barkod/QR nesnesini GD image üzerine render et
     */
    private function renderBarcodeOnImage($image, array $obj, string $value, float $scaleX, float $scaleY, callable $log, int $safeLeftPad = 0, float $safeLeftThreshold = 12.0): void
    {
        $customType = $obj['customType'] ?? 'barcode';
        $barcodeFormat = $obj['barcodeFormat'] ?? 'AUTO';
        $barcodeAutoDetect = !empty($obj['barcodeAutoDetect']) || $barcodeFormat === 'AUTO';
        $displayValue = ($obj['barcodeDisplayValue'] ?? true) !== false;
        $bgHex = $obj['barcodeBackground'] ?? '#ffffff';
        $lineHex = $obj['barcodeLineColor'] ?? '#000000';
        $barcodeHeight = (int)($obj['barcodeHeight'] ?? 80);

        // Otomatik algılama
        if ($barcodeAutoDetect && $customType === 'barcode') {
            $barcodeFormat = $this->detectBarcodeFormat($value);
            $log("  AUTO-DETECT: value={$value} -> format={$barcodeFormat}");
        }

        // Pozisyon ve boyut hesapla
        $left = (float)($obj['left'] ?? 0);
        $top = (float)($obj['top'] ?? 0);
        $objWidth = (float)($obj['width'] ?? 150);
        $objHeight = (float)($obj['height'] ?? 80);
        $objScaleX = (float)($obj['scaleX'] ?? 1.0);
        $objScaleY = (float)($obj['scaleY'] ?? 1.0);
        $originX = $obj['originX'] ?? 'center';
        $originY = $obj['originY'] ?? 'center';

        $effectiveWidth = $objWidth * $objScaleX;
        $effectiveHeight = $objHeight * $objScaleY;

        // Origin düzeltmesi
        $adjLeft = $left;
        $adjTop = $top;
        if ($originX === 'center') $adjLeft = $left - ($effectiveWidth / 2);
        elseif ($originX === 'right') $adjLeft = $left - $effectiveWidth;
        if ($originY === 'center') $adjTop = $top - ($effectiveHeight / 2);
        elseif ($originY === 'bottom') $adjTop = $top - $effectiveHeight;

        $appliedSafeLeftPad = 0;
        if ($safeLeftPad > 0 && $this->shouldApplySafeLeftInset($obj, $adjLeft, 'left', $safeLeftThreshold)) {
            $adjLeft += $safeLeftPad;
            $appliedSafeLeftPad = $safeLeftPad;
        }

        $scaledLeft = (int)($adjLeft * $scaleX);
        $scaledTop = (int)($adjTop * $scaleY);
        $scaledWidth = (int)($effectiveWidth * $scaleX);
        $scaledHeight = (int)($effectiveHeight * $scaleY);

        $log("  Barcode pos: ({$scaledLeft},{$scaledTop}) size: {$scaledWidth}x{$scaledHeight}");
        if ($appliedSafeLeftPad > 0) {
            $log("  Barcode safe-left pad uygulandi: +{$appliedSafeLeftPad}px");
        }

        // Arka plan rengi ile maskeleme
        $bgRgb = $this->hexToRgb($bgHex);
        $bgColor = imagecolorallocate($image, $bgRgb['r'], $bgRgb['g'], $bgRgb['b']);
        imagefilledrectangle($image, $scaledLeft, $scaledTop, $scaledLeft + $scaledWidth, $scaledTop + $scaledHeight, $bgColor);

        // Barkod çizgilerini GD ile render et
        $lineRgb = $this->hexToRgb($lineHex);
        $lineColor = imagecolorallocate($image, $lineRgb['r'], $lineRgb['g'], $lineRgb['b']);

        if ($customType === 'qrcode') {
            // QR kod: Basit veri matrisi çiz (gerçek QR algoritması çok karmaşık, placeholder)
            $log("  QR kod render (placeholder pattern)");
            $this->renderQRPlaceholder($image, $scaledLeft, $scaledTop, $scaledWidth, $scaledHeight, $lineColor, $bgColor, $value);
        } else {
            // Barkod: CODE128 çizgileri oluştur
            $log("  Barkod render: format={$barcodeFormat}, value={$value}");
            $this->renderBarcodeLines($image, $scaledLeft, $scaledTop, $scaledWidth, $scaledHeight, $lineColor, $bgColor, $value, $barcodeFormat, $displayValue);
        }
    }

    /**
     * Sola dayali ve sol kenara yakin nesnelerde guvenli sol ic pay uygulanmali mi?
     */
    private function shouldApplySafeLeftInset(array $obj, float $adjustedLeft, string $textAlign = 'left', float $threshold = 12.0): bool
    {
        if (($obj['visible'] ?? true) === false) {
            return false;
        }

        if (!empty($obj['disableSafeLeftPad']) || !empty($obj['disable_safe_left_pad'])) {
            return false;
        }

        if (isset($obj['safeLeftPad']) && is_numeric($obj['safeLeftPad']) && (int)$obj['safeLeftPad'] <= 0) {
            return false;
        }

        $originX = strtolower((string)($obj['originX'] ?? 'left'));
        $textAlign = strtolower((string)$textAlign);

        // Yalnizca sol dayali/sol ankrajli nesnelerde uygula.
        if ($textAlign !== 'left' && $originX !== 'left') {
            return false;
        }

        return $adjustedLeft <= max(0.0, $threshold);
    }

    /**
     * Barkod değerinden format algıla (BarcodeUtils.js PHP karşılığı)
     */
    /**
     * LabelPicture seviyesinde guvenli sol inset hesapla.
     * Sadece sol kenara dayali static (dynamicField olmayan) nesnelerde uygulanir.
     */
    private function resolvePictureSafeLeftInset(array $designData, array $product, int $regionX = 0): int
    {
        if ($regionX > 0) {
            return 0;
        }

        if (!empty($designData['disable_safe_left_picture']) || !empty($designData['disableSafeLeftPicture'])) {
            return 0;
        }

        $safeLeftPad = 10;
        if (isset($designData['safe_left_pad']) && is_numeric($designData['safe_left_pad'])) {
            $safeLeftPad = (int)$designData['safe_left_pad'];
        } elseif (isset($designData['safeLeftPad']) && is_numeric($designData['safeLeftPad'])) {
            $safeLeftPad = (int)$designData['safeLeftPad'];
        } elseif (isset($product['__safe_left_pad']) && is_numeric($product['__safe_left_pad'])) {
            $safeLeftPad = (int)$product['__safe_left_pad'];
        } elseif (isset($product['__safe_left_inset']) && is_numeric($product['__safe_left_inset'])) {
            $safeLeftPad = (int)$product['__safe_left_inset'];
        }
        $safeLeftPad = max(0, min(40, $safeLeftPad));
        if ($safeLeftPad <= 0) {
            return 0;
        }

        if (!empty($designData['force_safe_left_picture']) || !empty($designData['forceSafeLeftPicture'])) {
            return $safeLeftPad;
        }

        if (!empty($product['__is_multi_product_frame']) || $this->containsMultiProductFrame($designData)) {
            return $safeLeftPad;
        }

        $safeLeftThreshold = 12.0;
        if (isset($designData['safe_left_threshold']) && is_numeric($designData['safe_left_threshold'])) {
            $safeLeftThreshold = (float)$designData['safe_left_threshold'];
        }
        $safeLeftThreshold = max(0.0, min(80.0, $safeLeftThreshold));

        return $this->hasStaticLeftAnchoredEdgeObject($designData, $safeLeftThreshold) ? $safeLeftPad : 0;
    }

    /**
     * Tasarimda static (dynamicField olmayan) sol kenara yakin nesne var mi?
     */
    private function hasStaticLeftAnchoredEdgeObject(array $designData, float $threshold): bool
    {
        $objects = $designData['objects'] ?? null;
        if (!is_array($objects)) {
            return false;
        }

        $templateWidth = (float)($designData['_templateWidth'] ?? $designData['width'] ?? 0);
        $templateHeight = (float)($designData['_templateHeight'] ?? $designData['height'] ?? 0);

        $stack = $objects;
        while (!empty($stack)) {
            $obj = array_shift($stack);
            if (!is_array($obj)) {
                continue;
            }

            if (!empty($obj['objects']) && is_array($obj['objects'])) {
                foreach ($obj['objects'] as $child) {
                    $stack[] = $child;
                }
            }

            if (($obj['visible'] ?? true) === false) {
                continue;
            }

            if (!empty($obj['dynamicField']) || !empty($obj['dynamic_field'])) {
                continue;
            }

            $left = (float)($obj['left'] ?? 0);
            $top = (float)($obj['top'] ?? 0);
            $width = (float)($obj['width'] ?? 0);
            $height = (float)($obj['height'] ?? 0);
            $scaleX = (float)($obj['scaleX'] ?? 1.0);
            $scaleY = (float)($obj['scaleY'] ?? 1.0);
            $effectiveWidth = $width * $scaleX;
            $effectiveHeight = $height * $scaleY;

            $type = strtolower((string)($obj['type'] ?? ''));
            $isFullCover = $templateWidth > 0
                && $templateHeight > 0
                && $left <= 1
                && $top <= 1
                && $effectiveWidth >= ($templateWidth - 2)
                && $effectiveHeight >= ($templateHeight - 2);
            if ($isFullCover && in_array($type, ['rect', 'image'], true)) {
                continue;
            }

            $originX = strtolower((string)($obj['originX'] ?? 'left'));
            $textAlign = strtolower((string)($obj['textAlign'] ?? 'left'));
            $adjustedLeft = $left;
            if ($originX === 'center') {
                $adjustedLeft = $left - ($effectiveWidth / 2);
            } elseif ($originX === 'right') {
                $adjustedLeft = $left - $effectiveWidth;
            }

            if ($this->shouldApplySafeLeftInset($obj, $adjustedLeft, $textAlign, $threshold)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Tasarimda multi-product-frame var mi?
     */
    private function containsMultiProductFrame(array $designData): bool
    {
        $objects = $designData['objects'] ?? null;
        if (!is_array($objects)) {
            return false;
        }

        $stack = $objects;
        while (!empty($stack)) {
            $obj = array_shift($stack);
            if (!is_array($obj)) {
                continue;
            }

            if (($obj['customType'] ?? '') === 'multi-product-frame') {
                return true;
            }

            if (!empty($obj['objects']) && is_array($obj['objects'])) {
                foreach ($obj['objects'] as $child) {
                    $stack[] = $child;
                }
            }
        }

        return false;
    }

    private function detectBarcodeFormat(string $value): string
    {
        $cleaned = preg_replace('/[\s\-]/', '', $value);
        $isNumeric = ctype_digit($cleaned);

        if ($isNumeric) {
            $len = strlen($cleaned);
            if ($len === 13) return 'EAN13';
            if ($len === 8) return 'EAN8';
            if ($len === 12) return 'UPC';
            if ($len === 14) return 'ITF14';
        }

        // Alfanumerik: CODE128 (en geniş uyumluluk)
        return 'CODE128';
    }

    /**
     * GD ile barkod çizgileri çiz (CODE128 benzeri basit encoding)
     */
    private function renderBarcodeLines($image, int $x, int $y, int $w, int $h, $lineColor, $bgColor, string $value, string $format, bool $displayValue): void
    {
        // Değer gösterimi için alan ayır
        $fontPath = $this->findSystemFont();
        $textAreaHeight = $displayValue && $fontPath ? (int)($h * 0.2) : 0;
        $barAreaHeight = $h - $textAreaHeight;
        $barAreaTop = $y;

        // Basit barkod pattern oluştur (değerin her karakterinden çizgi genişlikleri türet)
        $padding = max(2, (int)($w * 0.05));
        $barAreaWidth = $w - ($padding * 2);
        $barStartX = $x + $padding;

        // Karakter bazlı barkod çizgileri
        $pattern = $this->generateBarcodePattern($value, $format);
        $totalUnits = array_sum($pattern);

        if ($totalUnits <= 0) return;

        $unitWidth = $barAreaWidth / $totalUnits;
        $currentX = (float)$barStartX;
        $isBar = true; // Çizgi ile başla

        foreach ($pattern as $units) {
            $barWidth = max(1, (int)round($units * $unitWidth));
            if ($isBar) {
                imagefilledrectangle($image, (int)$currentX, $barAreaTop, (int)$currentX + $barWidth - 1, $barAreaTop + $barAreaHeight - 1, $lineColor);
            }
            $currentX += $barWidth;
            $isBar = !$isBar;
        }

        // Değer gösterimi
        if ($displayValue && $fontPath && $textAreaHeight > 0) {
            $fontSize = max(8, (int)($textAreaHeight * 0.7));
            $bbox = imagettfbbox($fontSize, 0, $fontPath, $value);
            $textWidth = abs($bbox[2] - $bbox[0]);
            $textX = $x + (int)(($w - $textWidth) / 2);
            $textY = $y + $barAreaHeight + (int)($textAreaHeight * 0.8);
            imagettftext($image, $fontSize, 0, $textX, $textY, $lineColor, $fontPath, $value);
        }
    }

    /**
     * Barkod pattern oluştur (bar/space genişlikleri)
     */
    private function generateBarcodePattern(string $value, string $format): array
    {
        // CODE128 encoding tablosu (Start Code B + veri + check + stop)
        // Basitleştirilmiş: her karakter için sabit pattern
        $pattern = [];

        // Start pattern
        $pattern = array_merge($pattern, [2, 1, 1, 2, 3, 2]); // Start Code B

        // Her karakter için pattern
        foreach (str_split($value) as $char) {
            $code = ord($char);
            // Basit hash tabanlı pattern (gerçek CODE128 değil ama görsel olarak barkod görünümlü)
            $seed = ($code * 7 + 3) % 17;
            $pattern[] = 1 + ($seed % 3);        // bar
            $pattern[] = 1 + (($seed >> 1) % 3); // space
            $pattern[] = 1 + (($seed >> 2) % 2); // bar
            $pattern[] = 1 + (($seed >> 3) % 3); // space
        }

        // Stop pattern
        $pattern = array_merge($pattern, [2, 3, 3, 1, 1, 1, 2]);

        return $pattern;
    }

    /**
     * QR kod placeholder render (GD gerçek QR encoder yok)
     */
    private function renderQRPlaceholder($image, int $x, int $y, int $w, int $h, $lineColor, $bgColor, string $value): void
    {
        $size = min($w, $h);
        $offsetX = $x + (int)(($w - $size) / 2);
        $offsetY = $y + (int)(($h - $size) / 2);

        // Basit QR benzeri pattern
        $gridSize = min(21, max(11, (int)(strlen($value) / 2) + 11)); // 11-21 arası
        $cellSize = max(1, (int)($size / $gridSize));

        // Position detection patterns (3 köşe)
        $this->drawQRFinderPattern($image, $offsetX, $offsetY, $cellSize, $lineColor, $bgColor);
        $this->drawQRFinderPattern($image, $offsetX + ($gridSize - 7) * $cellSize, $offsetY, $cellSize, $lineColor, $bgColor);
        $this->drawQRFinderPattern($image, $offsetX, $offsetY + ($gridSize - 7) * $cellSize, $cellSize, $lineColor, $bgColor);

        // Veri modülleri (hash tabanlı pseudo-random pattern)
        for ($row = 0; $row < $gridSize; $row++) {
            for ($col = 0; $col < $gridSize; $col++) {
                // Finder pattern bölgelerini atla
                if (($row < 8 && $col < 8) || ($row < 8 && $col >= $gridSize - 8) || ($row >= $gridSize - 8 && $col < 8)) {
                    continue;
                }

                // Hash tabanlı doldurma
                $hash = crc32($value . $row . $col);
                if ($hash % 3 !== 0) {
                    $cx = $offsetX + $col * $cellSize;
                    $cy = $offsetY + $row * $cellSize;
                    imagefilledrectangle($image, $cx, $cy, $cx + $cellSize - 1, $cy + $cellSize - 1, $lineColor);
                }
            }
        }
    }

    /**
     * QR finder pattern (7x7 köşe kareleri)
     */
    private function drawQRFinderPattern($image, int $x, int $y, int $cellSize, $dark, $light): void
    {
        // Dış kare (7x7)
        imagefilledrectangle($image, $x, $y, $x + 7 * $cellSize - 1, $y + 7 * $cellSize - 1, $dark);
        // İç beyaz (5x5)
        imagefilledrectangle($image, $x + $cellSize, $y + $cellSize, $x + 6 * $cellSize - 1, $y + 6 * $cellSize - 1, $light);
        // Merkez kare (3x3)
        imagefilledrectangle($image, $x + 2 * $cellSize, $y + 2 * $cellSize, $x + 5 * $cellSize - 1, $y + 5 * $cellSize - 1, $dark);
    }

    /**
     * Ürün bilgilerinden dinamik alan değerlerini oluştur
     */
    private function buildFieldValues(array $product): array
    {
        // Fiyat formatlama
        $currentPrice = $product['current_price'] ?? $product['price'] ?? 0;
        $previousPrice = $product['previous_price'] ?? $product['old_price'] ?? null;

        // Fiyatı formatla
        $formattedPrice = number_format((float)$currentPrice, 2, ',', '.');
        $formattedPrevPrice = $previousPrice ? number_format((float)$previousPrice, 2, ',', '.') : '';

        return [
            // Temel bilgiler
            'product_name' => $product['name'] ?? '',
            'name' => $product['name'] ?? '',
            'sku' => $product['sku'] ?? '',
            'barcode' => $product['barcode'] ?? $product['sku'] ?? '',
            'description' => $product['description'] ?? '',
            'slug' => $product['slug'] ?? '',

            // Fiyat bilgileri
            'current_price' => $formattedPrice . ' ₺',
            'price' => $formattedPrice . ' ₺',
            'previous_price' => $formattedPrevPrice ? $formattedPrevPrice . ' ₺' : '',
            'old_price' => $formattedPrevPrice ? $formattedPrevPrice . ' ₺' : '',
            'vat_rate' => ($product['vat_rate'] ?? '18') . '%',
            'discount_percent' => ($product['discount_percent'] ?? '') . '%',
            'campaign_text' => $product['campaign_text'] ?? '',

            // Kategori ve marka
            'category' => $product['category'] ?? $product['category_name'] ?? '',
            'subcategory' => $product['subcategory'] ?? '',
            'brand' => $product['brand'] ?? '',

            // Detay bilgileri
            'unit' => $product['unit'] ?? 'adet',
            'weight' => $product['weight'] ?? '',
            'stock' => $product['stock'] ?? '',
            'origin' => $product['origin'] ?? $product['country'] ?? '',
            'production_type' => $product['production_type'] ?? '',

            // Konum ve kod
            'shelf_location' => $product['shelf_location'] ?? '',
            'supplier_code' => $product['supplier_code'] ?? '',

            // HAL Künye alanları
            'kunye_no' => $product['kunye_no'] ?? '',
            'uretici_adi' => $product['uretici_adi'] ?? '',
            'malin_adi' => $product['malin_adi'] ?? '',
            'malin_cinsi' => $product['malin_cinsi'] ?? '',
            'malin_turu' => $product['malin_turu'] ?? '',
            'uretim_yeri' => $product['uretim_yeri'] ?? '',
            'ilk_bildirim_tarihi' => $product['ilk_bildirim_tarihi'] ?? '',
            'malin_sahibi' => $product['malin_sahibi'] ?? '',
            'tuketim_yeri' => $product['tuketim_yeri'] ?? '',
            'tuketim_bildirim_tarihi' => $product['tuketim_bildirim_tarihi'] ?? '',
            'gumruk_kapisi' => $product['gumruk_kapisi'] ?? '',
            'uretim_ithal_tarihi' => $product['uretim_ithal_tarihi'] ?? '',
            'miktar' => $product['miktar'] ?? '',
            'alis_fiyati' => isset($product['alis_fiyati']) && $product['alis_fiyati'] !== '' ? number_format((float)$product['alis_fiyati'], 2, ',', '.') . ' ₺' : '',
            'isletme_adi' => $product['isletme_adi'] ?? '',
            'uretim_sekli' => $product['uretim_sekli'] ?? $product['production_type'] ?? '',
            'sertifikasyon_kurulusu' => $product['sertifikasyon_kurulusu'] ?? '',
            'sertifika_no' => $product['sertifika_no'] ?? '',
            'diger_bilgiler' => $product['diger_bilgiler'] ?? '',
            'kalan_miktar' => $product['kalan_miktar'] ?? '',
            'birim' => $product['birim'] ?? '',
            'bildirim_turu' => $product['bildirim_turu'] ?? '',
            'belge_no' => $product['belge_no'] ?? '',
            'belge_tipi' => $product['belge_tipi'] ?? '',
            'analiz_status' => $product['analiz_status'] ?? '',

            // Tarih bilgileri
            'price_updated_at' => $product['price_updated_at'] ?? '',
            'price_valid_until' => $product['price_valid_until'] ?? '',
        ];
    }

    /**
     * Sistemde kullanılabilir font dosyası bul
     */
    private function findSystemFont(): ?string
    {
        $possibleFonts = [
            // Windows fontları
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/arialbd.ttf',
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/tahoma.ttf',
            // Linux fontları
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
            // MacOS fontları
            '/Library/Fonts/Arial.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ];

        foreach ($possibleFonts as $font) {
            if (file_exists($font)) {
                return $font;
            }
        }

        return null;
    }

    /**
     * Hex renk kodunu RGB'ye dönüştür
     */
    private function hexToRgb(string $color): array
    {
        // rgba(255,255,255,0.8) veya rgb(255,255,255) formatı
        if (preg_match('/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/', $color, $matches)) {
            return [
                'r' => (int)$matches[1],
                'g' => (int)$matches[2],
                'b' => (int)$matches[3]
            ];
        }

        // Hex format
        $hex = ltrim($color, '#');

        // Kısa format (#RGB)
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        // Geçersiz format için varsayılan siyah
        if (strlen($hex) !== 6) {
            return ['r' => 0, 'g' => 0, 'b' => 0];
        }

        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2))
        ];
    }

    /**
     * Ürün etiketini GD ile render edip cihaza gönder
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID
     * @param array $product Ürün bilgileri
     * @param array $template Şablon ayarları
     * @return array Sonuç
     */
    public function sendProductLabel(string $ip, string $clientId, array $product, array $template = []): array
    {
        $width = $template['width'] ?? 800;
        $height = $template['height'] ?? 1280;

        // Basit GD render
        $image = imagecreatetruecolor($width, $height);

        // Arka plan (beyaz)
        $bgColor = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $bgColor);

        // Renkler
        $black = imagecolorallocate($image, 0, 0, 0);
        $red = imagecolorallocate($image, 220, 53, 69);
        $gray = imagecolorallocate($image, 128, 128, 128);
        $darkBlue = imagecolorallocate($image, 30, 41, 59);

        // Font (varsayılan)
        $fontPath = null;
        $possibleFonts = [
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/segoeui.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        ];
        foreach ($possibleFonts as $font) {
            if (file_exists($font)) {
                $fontPath = $font;
                break;
            }
        }

        // Ürün görseli varsa üst yarıya yerleştir
        $imageAreaHeight = (int)($height * 0.45); // %45 görsel alanı
        if (!empty($product['image_url']) || !empty($product['image_path'])) {
            $imageSrc = $product['image_path'] ?? $product['image_url'];
            if (file_exists($imageSrc)) {
                $ext = strtolower(pathinfo($imageSrc, PATHINFO_EXTENSION));
                $productImage = null;
                if ($ext === 'png') {
                    $productImage = imagecreatefrompng($imageSrc);
                } elseif (in_array($ext, ['jpg', 'jpeg'])) {
                    $productImage = imagecreatefromjpeg($imageSrc);
                }

                if ($productImage) {
                    $pWidth = imagesx($productImage);
                    $pHeight = imagesy($productImage);

                    // Oranı koru
                    $ratio = min($width / $pWidth, $imageAreaHeight / $pHeight);
                    $newWidth = (int)($pWidth * $ratio);
                    $newHeight = (int)($pHeight * $ratio);
                    $x = (int)(($width - $newWidth) / 2);
                    $y = (int)(($imageAreaHeight - $newHeight) / 2);

                    imagecopyresampled($image, $productImage, $x, $y, 0, 0, $newWidth, $newHeight, $pWidth, $pHeight);
                    imagedestroy($productImage);
                }
            }
        }

        // Metin alanı başlangıcı
        $textStartY = $imageAreaHeight + 40;

        if ($fontPath) {
            // TTF font ile render

            // Kategori/etiket
            if (!empty($product['category'])) {
                imagettftext($image, 14, 0, 50, $textStartY, $red, $fontPath, strtoupper($product['category']));
                $textStartY += 40;
            }

            // Ürün adı
            $name = $product['name'] ?? 'Ürün Adı';
            imagettftext($image, 28, 0, 50, $textStartY, $darkBlue, $fontPath, $name);
            $textStartY += 80;

            // Fiyat
            $price = number_format((float)($product['current_price'] ?? 0), 2, ',', '.');
            $currency = $product['currency'] ?? '₺';
            imagettftext($image, 48, 0, $width - 250, $textStartY, $darkBlue, $fontPath, $currency);
            imagettftext($image, 72, 0, $width - 200, $textStartY, $darkBlue, $fontPath, explode(',', $price)[0]);
            imagettftext($image, 36, 0, $width - 80, $textStartY - 30, $darkBlue, $fontPath, ',' . explode(',', $price)[1]);

            $textStartY += 60;

            // Detaylar
            $details = [
                'Menşei' => $product['origin'] ?? '',
                'Ağırlık' => $product['weight'] ?? $product['unit'] ?? '',
                'Saklama' => $product['storage_info'] ?? ''
            ];

            foreach ($details as $label => $value) {
                if (!empty($value)) {
                    imagettftext($image, 14, 0, 50, $textStartY, $gray, $fontPath, $label . ':');
                    imagettftext($image, 14, 0, 150, $textStartY, $black, $fontPath, $value);
                    $textStartY += 30;
                }
            }

        } else {
            // Yerleşik font ile basit render
            imagestring($image, 5, 50, $textStartY, $product['name'] ?? 'Product', $black);
            imagestring($image, 5, 50, $textStartY + 50, 'Price: ' . ($product['current_price'] ?? '0.00'), $red);
        }

        // Görseli cihaza gönder
        return $this->sendLabel($ip, $clientId, $image, $product, $width, $height);
    }

    /**
     * Video Grid destekli etiket gönder
     *
     * Desteklenen düzenler:
     * - fullscreen_image: Tam ekran görsel
     * - fullscreen_video: Tam ekran video
     * - split_vertical: Üst video, alt görsel (varsayılan)
     * - split_horizontal: Sol görsel, sağ video
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID (MAC adresi)
     * @param array $config Grid yapılandırması
     *   - layout: string (fullscreen_image|fullscreen_video|split_vertical|split_horizontal)
     *   - width: int (ekran genişliği, varsayılan 800)
     *   - height: int (ekran yüksekliği, varsayılan 1280)
     *   - image: string|null (görsel dosya yolu)
     *   - video: string|null (video dosya yolu)
     *   - videos: array|null (çoklu video listesi)
     *   - product: array (ürün bilgileri)
     * @return array Sonuç
     */
    public function sendGridLabel(string $ip, string $clientId, array $config): array
    {
        $result = [
            'success' => false,
            'steps' => [],
            'files_skipped' => 0,
            'files_uploaded' => 0
        ];

        // Varsayılan değerler
        $layout = $config['layout'] ?? 'split_vertical';
        $width = $config['width'] ?? 800;
        $height = $config['height'] ?? 1280;
        $imagePath = $config['image'] ?? null;
        $videoPath = $config['video'] ?? null;
        $videos = $config['videos'] ?? [];
        $product = $config['product'] ?? [];
        $designData = $config['design_data'] ?? [];

        // Tek video varsa listeye ekle
        if ($videoPath && empty($videos)) {
            $videos = [$videoPath];
        }

        // NOT: Storage temizleme kaldırıldı!
        // Delta check ile dosya zaten mevcutsa yükleme atlanır.
        // Storage dolu ise clearSpace ayrı çağrılmalıdır.
        $result['steps']['clear'] = ['skipped' => true, 'reason' => 'Delta check enabled'];

        // Grid bölgelerini hesapla
        // Custom layout ise config'den al, değilse hesapla
        // NOT: array_key_exists kullanıyoruz çünkü image_region: null olabilir (sadece video gönderilecek)
        if ($layout === 'custom' && array_key_exists('video_region', $config) && $config['video_region']) {
            $regions = [];

            // Image region varsa ekle (null değilse)
            if (array_key_exists('image_region', $config) && $config['image_region']) {
                $regions['image'] = $config['image_region'];
            }

            // Video region ekle
            $regions['video'] = $config['video_region'];
        } else {
            $regions = $this->calculateGridRegions($layout, $width, $height);
        }
        $result['regions'] = $regions;

        // Task config hazırla
        $taskConfig = [
            'Id' => $clientId,
            'ItemCode' => $product['sku'] ?? $product['id'] ?? 'ITEM-001',
            'ItemName' => $product['name'] ?? 'Product'
        ];

        // 2. Görsel varsa işle
        // NOT: PavoDisplay'de LabelPicture ve LabelVideo üst üste binebilir (overlay)
        // Video görselin üstünde görünür, bu yüzden her ikisini de gönderebiliriz
        $shouldAddImage = true;

        if (!empty($videos) && isset($regions['video']) && isset($regions['image'])) {
            $vr = $regions['video'];

            // Video bölge koordinatları
            $videoY = (int)($vr['y'] ?? 0);
            $videoH = (int)($vr['height'] ?? 0);
            $videoBottom = $videoY + $videoH;

            // Video üstte mi altta mı kontrol et
            if ($videoY > 0) {
                // Video ALTTA - görsel üstte olacak
                $remainingHeight = $videoY; // Video'nun üstündeki alan
                if ($remainingHeight < 100) {
                    $shouldAddImage = false;
                } else {
                    $shouldAddImage = true;
                    $regions['image'] = [
                        'x' => 0,
                        'y' => 0,
                        'width' => $width,
                        'height' => $remainingHeight
                    ];
                }
            } else {
                // Video ÜSTTE - görsel altta olacak
                $remainingHeight = $height - $videoBottom; // Video'nun altındaki alan
                if ($remainingHeight < 100) {
                    $shouldAddImage = false;
                } else {
                    $shouldAddImage = true;
                    $regions['image'] = [
                        'x' => 0,
                        'y' => $videoBottom,
                        'width' => $width,
                        'height' => $remainingHeight
                    ];
                }
            }

            // Video tüm ekranı kaplıyorsa görsel ekleme
            $totalArea = $width * $height;
            $videoArea = (int)($vr['width'] ?? 0) * $videoH;
            if ($videoArea >= $totalArea * 0.95) {
                $shouldAddImage = false;
            }
        }

        // fullscreen_video layout'ta görsel ekleme
        if ($layout === 'fullscreen_video') {
            $shouldAddImage = false;
        }

        if ($imagePath && isset($regions['image']) && $shouldAddImage) {
            $imageRegion = $regions['image'];

            // Kırpma bölgesi: Görsel bölgesini kaynak görseldan kırp
            // (video'nun altındaki alanı çıkar)
            $cropRegion = [
                'x' => $imageRegion['x'],
                'y' => $imageRegion['y'],
                'width' => $imageRegion['width'],
                'height' => $imageRegion['height'],
                'device_width' => $width,
                'device_height' => $height
            ];

            // Görseli hazırla (kırpma ile + dinamik alanlar)
            $imageResult = $this->prepareAndUploadImage(
                $ip,
                $clientId,
                $imagePath,
                $imageRegion['width'],
                $imageRegion['height'],
                $cropRegion,
                $designData,
                $product
            );

            $result['steps']['image'] = $imageResult;

            if (!$imageResult['success']) {
                $result['error'] = 'Failed to process image: ' . ($imageResult['error'] ?? 'Unknown error');
                return $result;
            }

            // LabelPicture config ekle
            $pictureSafeLeftInset = $this->resolvePictureSafeLeftInset($designData, $product, (int)($imageRegion['x'] ?? 0));
            $taskConfig['LabelPicture'] = [
                'X' => (int)($imageRegion['x'] ?? 0) + $pictureSafeLeftInset,
                'Y' => $imageRegion['y'],
                'Width' => $imageRegion['width'],
                'Height' => $imageRegion['height'],
                'PictureName' => $imageResult['filename'],
                'PicturePath' => $imageResult['filepath'],
                'PictureMD5' => $imageResult['md5']
            ];
        } elseif ($imagePath && !$shouldAddImage) {
            $result['steps']['image'] = ['skipped' => true, 'reason' => 'Video region overlaps or fullscreen_video layout'];
        }

        // 3. Video(lar) varsa işle
        if (!empty($videos) && isset($regions['video'])) {
            $videoRegion = $regions['video'];
            $videoList = [];

            foreach ($videos as $index => $video) {
                if (!file_exists($video)) {
                    continue;
                }

                $videoContent = file_get_contents($video);
                $videoFilename = $clientId . '_video_' . ($index + 1) . '.mp4';
                $videoFilepath = "files/task/{$videoFilename}";
                $videoMd5 = strtoupper(md5($videoContent));

                // DELTA CHECK: Cihazda aynı video var mı kontrol et
                $checkResult = $this->checkFile($ip, $videoFilepath);
                $videoSkipped = false;

                if ($checkResult['exists'] && !empty($checkResult['md5'])) {
                    if (strcasecmp($checkResult['md5'], $videoMd5) === 0) {
                        // Video zaten mevcut ve aynı, yükleme atla
                        $videoSkipped = true;
                        $result['steps']['video_' . ($index + 1)] = [
                            'success' => true,
                            'skipped' => true,
                            'reason' => 'Video already exists with same MD5'
                        ];
                    }
                }

                if (!$videoSkipped) {
                    // Video yükle
                    $uploadResult = $this->uploadFile($ip, $videoFilepath, $videoContent);
                    $result['steps']['video_' . ($index + 1)] = $uploadResult;

                    if (!$uploadResult['success']) {
                        $result['error'] = 'Failed to upload video: ' . ($uploadResult['error'] ?? 'Unknown error');
                        return $result;
                    }
                }

                $videoList[] = [
                    'VideoNo' => $index + 1,
                    'VideoName' => $videoFilename,
                    'VideoPath' => $videoFilepath,
                    'VideoMD5' => $videoMd5
                ];
            }

            if (!empty($videoList)) {
                // LabelVideo config ekle
                $taskConfig['LabelVideo'] = [
                    'X' => $videoRegion['x'],
                    'Y' => $videoRegion['y'],
                    'Width' => $videoRegion['width'],
                    'Height' => $videoRegion['height'],
                    'VideoList' => $videoList
                ];
            }
        }

        // 4. Task config yükle
        $taskJson = json_encode($taskConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $taskFilePath = "files/task/{$clientId}.js";

        $taskUploadResult = $this->uploadFile($ip, $taskFilePath, $taskJson);
        $result['steps']['task'] = $taskUploadResult;
        $result['task_config'] = $taskConfig;

        if (!$taskUploadResult['success']) {
            $result['error'] = 'Failed to upload task config: ' . ($taskUploadResult['error'] ?? 'Unknown error');
            return $result;
        }

        // 5. Replay tetikle
        $replayResult = $this->triggerReplay($ip, $taskFilePath);
        $result['steps']['replay'] = $replayResult;

        if (!$replayResult['success']) {
            $result['error'] = 'Failed to trigger replay: ' . ($replayResult['error'] ?? 'Unknown error');
            return $result;
        }

        $result['success'] = true;
        $result['message'] = 'Grid label sent successfully';
        $result['device_ip'] = $ip;
        $result['client_id'] = $clientId;
        $result['layout'] = $layout;
        $result['task_path'] = $taskFilePath;

        return $result;
    }

    /**
     * Grid bölgelerini hesapla
     */
    private function calculateGridRegions(string $layout, int $width, int $height): array
    {
        $regions = [];

        switch ($layout) {
            case 'fullscreen_image':
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;

            case 'fullscreen_video':
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;

            case 'split_horizontal':
                // Sol görsel, sağ video
                $halfWidth = (int)($width / 2);
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $halfWidth, 'height' => $height
                ];
                $regions['video'] = [
                    'x' => $halfWidth, 'y' => 0,
                    'width' => $halfWidth, 'height' => $height
                ];
                break;

            case 'split_vertical':
                // Üst video, alt görsel (50/50)
                $halfHeight = (int)($height / 2);
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $halfHeight
                ];
                $regions['image'] = [
                    'x' => 0, 'y' => $halfHeight,
                    'width' => $width, 'height' => $halfHeight
                ];
                break;

            case 'split_vertical_60_40':
                // Üst video %60, alt görsel %40
                $topHeight = (int)($height * 0.6);
                $bottomHeight = $height - $topHeight;
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $topHeight
                ];
                $regions['image'] = [
                    'x' => 0, 'y' => $topHeight,
                    'width' => $width, 'height' => $bottomHeight
                ];
                break;

            case 'split_vertical_40_60':
                // Üst video %40, alt görsel %60
                $topHeight = (int)($height * 0.4);
                $bottomHeight = $height - $topHeight;
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $topHeight
                ];
                $regions['image'] = [
                    'x' => 0, 'y' => $topHeight,
                    'width' => $width, 'height' => $bottomHeight
                ];
                break;

            case 'grid_1x3':
                // 3 satır - üst video, orta görsel, alt görsel (veya video)
                $thirdHeight = (int)($height / 3);
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $thirdHeight
                ];
                $regions['image'] = [
                    'x' => 0, 'y' => $thirdHeight,
                    'width' => $width, 'height' => $thirdHeight * 2
                ];
                break;

            case 'grid_3x1':
                // 3 sütun - sol görsel, orta video, sağ görsel
                $thirdWidth = (int)($width / 3);
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $thirdWidth, 'height' => $height
                ];
                $regions['video'] = [
                    'x' => $thirdWidth, 'y' => 0,
                    'width' => $thirdWidth, 'height' => $height
                ];
                break;

            case 'header_content':
            case 'top_one_bottom_two':
                // Üst header (küçük), alt içerik (büyük)
                $headerHeight = (int)($height * 0.2);
                $contentHeight = $height - $headerHeight;
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $headerHeight
                ];
                $regions['image'] = [
                    'x' => 0, 'y' => $headerHeight,
                    'width' => $width, 'height' => $contentHeight
                ];
                break;

            case 'single':
                // Tek grid - tüm ekranı kaplar
                // Video varsa video, yoksa görsel tam ekran gösterilir
                // Karışık içerik için özel bölgeleme gerekir
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                // Video için de tam ekran alan tanımla - hangisi kullanılacağını sendGridLabel belirler
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;

            default:
                // Bilinmeyen layout - varsayılan olarak tam ekran görsel
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;
        }

        return $regions;
    }

    /**
     * Görseli hazırla ve yükle
     */
    private function prepareAndUploadImage(string $ip, string $clientId, string $imagePath, int $width, int $height, array $cropRegion = null, array $designData = [], array $product = []): array
    {
        $result = ['success' => false];

        if (!file_exists($imagePath)) {
            $result['error'] = 'Image file not found: ' . $imagePath;
            return $result;
        }

        // Görseli yükle
        $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));
        if ($extension === 'png') {
            $srcImage = imagecreatefrompng($imagePath);
        } elseif (in_array($extension, ['jpg', 'jpeg'])) {
            $srcImage = imagecreatefromjpeg($imagePath);
        } else {
            $result['error'] = 'Unsupported image format: ' . $extension;
            return $result;
        }

        if (!$srcImage) {
            $result['error'] = 'Failed to load image';
            return $result;
        }

        $srcWidth = imagesx($srcImage);
        $srcHeight = imagesy($srcImage);

        // Kırpma bölgesi belirtilmişse önce kırp
        if ($cropRegion) {
            $cropX = $cropRegion['x'] ?? 0;
            $cropY = $cropRegion['y'] ?? 0;
            $cropW = $cropRegion['width'] ?? $srcWidth;
            $cropH = $cropRegion['height'] ?? $srcHeight;

            // Kırpma koordinatlarını kaynak görsel boyutuna ölçekle
            // (cropRegion cihaz koordinatlarında, srcImage farklı boyutta olabilir)
            $scaleX = $srcWidth / ($cropRegion['device_width'] ?? $srcWidth);
            $scaleY = $srcHeight / ($cropRegion['device_height'] ?? $srcHeight);

            $scaledCropX = (int)($cropX * $scaleX);
            $scaledCropY = (int)($cropY * $scaleY);
            $scaledCropW = (int)($cropW * $scaleX);
            $scaledCropH = (int)($cropH * $scaleY);

            // Sınır kontrolü
            $scaledCropX = max(0, min($scaledCropX, $srcWidth - 1));
            $scaledCropY = max(0, min($scaledCropY, $srcHeight - 1));
            $scaledCropW = min($scaledCropW, $srcWidth - $scaledCropX);
            $scaledCropH = min($scaledCropH, $srcHeight - $scaledCropY);

            if ($scaledCropW > 0 && $scaledCropH > 0) {
                $croppedImage = imagecreatetruecolor($scaledCropW, $scaledCropH);
                imagecopy($croppedImage, $srcImage, 0, 0, $scaledCropX, $scaledCropY, $scaledCropW, $scaledCropH);
                imagedestroy($srcImage);
                $srcImage = $croppedImage;
                $srcWidth = $scaledCropW;
                $srcHeight = $scaledCropH;
            }
        }

        // Hedef boyuta resize et
        $dstImage = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($dstImage, 255, 255, 255);
        imagefill($dstImage, 0, 0, $white);
        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $width, $height, $srcWidth, $srcHeight);

        // DİNAMİK ALANLARI RENDER ET (GD ile)
        if (!empty($designData) && !empty($product)) {
            // DEBUG LOG
            $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/prepareUpload.log' : '/tmp/prepareUpload.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] prepareAndUploadImage: DİNAMİK RENDER BAŞLIYOR\n", FILE_APPEND);
            file_put_contents($logFile, "  Product name: " . ($product['name'] ?? 'YOK') . "\n", FILE_APPEND);
            file_put_contents($logFile, "  designData objects: " . (isset($designData['objects']) ? count($designData['objects']) : 'YOK') . "\n", FILE_APPEND);

            // Şablon boyutlarını al (ölçekleme için)
            // NOT: Kırpma sonrası $srcWidth/$srcHeight kırpılmış boyuttur.
            // Dinamik alanlar orijinal şablon boyutuna göre pozisyonlandığı için
            // _templateWidth/_templateHeight kullanılmalı. Kırpma bölgesi offset'i
            // de hesaba katılmalı.
            $templateWidth = $designData['_templateWidth'] ?? ($cropRegion ? ($cropRegion['device_width'] ?? $srcWidth) : $srcWidth);
            $templateHeight = $designData['_templateHeight'] ?? ($cropRegion ? ($cropRegion['device_height'] ?? $srcHeight) : $srcHeight);

            // Kırpma yapıldıysa, dinamik alan verilerini kırpma bölgesine göre ayarla
            if ($cropRegion && ($cropRegion['y'] > 0 || $cropRegion['x'] > 0)) {
                // Kırpılmış bölgeye göre offset'li designData oluştur
                $adjustedDesignData = $designData;
                $cropOffsetX = (int)($cropRegion['x'] ?? 0);
                $cropOffsetY = (int)($cropRegion['y'] ?? 0);
                $cropW = (int)($cropRegion['width'] ?? $width);
                $cropH = (int)($cropRegion['height'] ?? $height);

                if (isset($adjustedDesignData['objects']) && is_array($adjustedDesignData['objects'])) {
                    foreach ($adjustedDesignData['objects'] as &$obj) {
                        if (empty($obj['dynamicField']) && empty($obj['dynamic_field'])) continue;

                        $objLeft = (float)($obj['left'] ?? 0);
                        $objTop = (float)($obj['top'] ?? 0);
                        $objW = (float)(($obj['width'] ?? 0) * ($obj['scaleX'] ?? 1));
                        $objH = (float)(($obj['height'] ?? 0) * ($obj['scaleY'] ?? 1));

                        // Obje kırpma bölgesi içinde mi kontrol et
                        $objRight = $objLeft + $objW;
                        $objBottom = $objTop + $objH;
                        $cropRight = $cropOffsetX + $cropW;
                        $cropBottom = $cropOffsetY + $cropH;

                        if ($objRight < $cropOffsetX || $objLeft > $cropRight ||
                            $objBottom < $cropOffsetY || $objTop > $cropBottom) {
                            // Obje kırpma alanı dışında - gizle
                            $obj['visible'] = false;
                            continue;
                        }

                        // Pozisyonu kırpma offset'ine göre kaydır
                        $obj['left'] = $objLeft - $cropOffsetX;
                        $obj['top'] = $objTop - $cropOffsetY;
                    }
                    unset($obj);
                }

                // Kırpılmış bölge boyutlarını şablon boyutu olarak kullan
                $this->renderDynamicFields($dstImage, $adjustedDesignData, $product, $cropW, $cropH, $width, $height);
            } else {
                $this->renderDynamicFields($dstImage, $designData, $product, $templateWidth, $templateHeight, $width, $height);
            }

            file_put_contents($logFile, "  DİNAMİK RENDER TAMAMLANDI\n", FILE_APPEND);
        } else {
            // DEBUG LOG
            $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/prepareUpload.log' : '/tmp/prepareUpload.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] prepareAndUploadImage: designData veya product BOŞ\n", FILE_APPEND);
            file_put_contents($logFile, "  designData empty: " . (empty($designData) ? 'YES' : 'NO') . "\n", FILE_APPEND);
            file_put_contents($logFile, "  product empty: " . (empty($product) ? 'YES' : 'NO') . "\n", FILE_APPEND);
        }

        // JPEG olarak buffer'a kaydet
        ob_start();
        imagejpeg($dstImage, null, 90);
        $imageContent = ob_get_clean();

        imagedestroy($srcImage);
        imagedestroy($dstImage);

        $imageMd5 = strtoupper(md5($imageContent));
        $filename = $clientId . '.jpg';
        $filepath = "files/task/{$filename}";

        // DELTA CHECK: Cihazda aynı dosya var mı kontrol et
        $checkResult = $this->checkFile($ip, $filepath);
        $skipped = false;

        if ($checkResult['exists'] && !empty($checkResult['md5'])) {
            if (strcasecmp($checkResult['md5'], $imageMd5) === 0) {
                // Dosya zaten mevcut ve aynı, yükleme atla
                $skipped = true;
            }
        }

        if (!$skipped) {
            // Cihaza yükle
            $uploadResult = $this->uploadFile($ip, $filepath, $imageContent);

            if (!$uploadResult['success']) {
                $result['error'] = 'Failed to upload: ' . ($uploadResult['error'] ?? 'Unknown error');
                return $result;
            }
        }

        $result['success'] = true;
        $result['skipped'] = $skipped;
        $result['filename'] = $filename;
        $result['filepath'] = $filepath;
        $result['md5'] = $imageMd5;
        $result['original_size'] = "{$srcWidth}x{$srcHeight}";
        $result['target_size'] = "{$width}x{$height}";
        $result['file_size'] = strlen($imageContent);

        return $result;
    }

    /**
     * Media listesi ile etiket gönder (v3.26+ firmware)
     * Görsel ve video karışık oynatma destekler
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID
     * @param array $mediaList Medya listesi [{path, duration, type}, ...]
     * @param array $config Yapılandırma
     * @return array Sonuç
     */
    public function sendMediaLabel(string $ip, string $clientId, array $mediaList, array $config = []): array
    {
        $result = [
            'success' => false,
            'steps' => []
        ];

        $width = $config['width'] ?? 800;
        $height = $config['height'] ?? 1280;
        $product = $config['product'] ?? [];

        // 1. Storage temizle
        $clearResult = $this->clearSpace($ip);
        $result['steps']['clear'] = $clearResult;

        if (!$clearResult['success']) {
            $result['error'] = 'Failed to clear storage: ' . ($clearResult['error'] ?? 'Unknown error');
            return $result;
        }

        // 2. Medya dosyalarını yükle
        $mediaItems = [];
        foreach ($mediaList as $index => $media) {
            $path = $media['path'] ?? $media;
            $duration = $media['duration'] ?? 5;
            $type = $media['type'] ?? $this->detectMediaType($path);

            if (!file_exists($path)) {
                continue;
            }

            $content = file_get_contents($path);
            $ext = pathinfo($path, PATHINFO_EXTENSION);
            $filename = $clientId . '_media_' . ($index + 1) . '.' . $ext;
            $filepath = "files/task/{$filename}";
            $md5 = strtoupper(md5($content));

            // Yükle
            $uploadResult = $this->uploadFile($ip, $filepath, $content);
            $result['steps']['media_' . ($index + 1)] = $uploadResult;

            if (!$uploadResult['success']) {
                continue;
            }

            $mediaItems[] = [
                'MediaNo' => $index + 1,
                'MediaName' => $filename,
                'MediaUrl' => $filepath,
                'MediaMD5' => $md5,
                'SwitchTime' => $duration
            ];
        }

        if (empty($mediaItems)) {
            $result['error'] = 'No media files uploaded successfully';
            return $result;
        }

        // 3. Task config oluştur
        $taskConfig = [
            'Id' => $clientId,
            'ItemCode' => $product['sku'] ?? 'MEDIA-001',
            'ItemName' => $product['name'] ?? 'Media Playlist',
            'Media' => [
                'X' => 0,
                'Y' => 0,
                'Width' => $width,
                'Height' => $height,
                'MediaList' => $mediaItems
            ]
        ];

        $taskJson = json_encode($taskConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $taskFilePath = "files/task/{$clientId}.js";

        // 4. Task yükle
        $taskUploadResult = $this->uploadFile($ip, $taskFilePath, $taskJson);
        $result['steps']['task'] = $taskUploadResult;
        $result['task_config'] = $taskConfig;

        if (!$taskUploadResult['success']) {
            $result['error'] = 'Failed to upload task config: ' . ($taskUploadResult['error'] ?? 'Unknown error');
            return $result;
        }

        // 5. Replay tetikle
        $replayResult = $this->triggerReplay($ip, $taskFilePath);
        $result['steps']['replay'] = $replayResult;

        if (!$replayResult['success']) {
            $result['error'] = 'Failed to trigger replay: ' . ($replayResult['error'] ?? 'Unknown error');
            return $result;
        }

        $result['success'] = true;
        $result['message'] = 'Media label sent successfully';
        $result['media_count'] = count($mediaItems);

        return $result;
    }

    /**
     * Dosya uzantısından medya tipini belirle
     */
    private function detectMediaType(string $path): string
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if (in_array($ext, ['mp4', 'avi', 'mov', 'webm'])) {
            return 'video';
        }

        return 'image';
    }

    // ========================================================================
    // PARALEL GÖNDERİM SİSTEMİ (Phase 1)
    // ========================================================================

    /**
     * Device tipi bazlı eşzamanlılık limitleri
     */
    private const CONCURRENCY_LIMITS = [
        'esl' => 2,           // ESL cihazları: düşük bant genişliği
        'esl_android' => 2,   // PavoDisplay ESL
        'tablet' => 5,        // Tablet cihazlar
        'android_tv' => 10,   // TV/Signage
        'web_display' => 10,  // Web tabanlı ekranlar
        'pwa_player' => 10,   // PWA Player
        'default' => 3        // Bilinmeyen tipler
    ];

    /**
     * Device tipi için eşzamanlılık limitini al
     */
    public function getConcurrencyLimit(string $deviceType): int
    {
        return self::CONCURRENCY_LIMITS[$deviceType] ?? self::CONCURRENCY_LIMITS['default'];
    }

    /**
     * Paralel çoklu cihaz gönderimi (curl_multi_exec ile)
     *
     * @param array $devices Cihaz listesi [['ip' => '...', 'client_id' => '...', 'type' => '...'], ...]
     * @param string $imagePath Gönderilecek görsel dosya yolu (disk üzerinde)
     * @param array $taskConfig Task konfigürasyonu
     * @param callable|null $progressCallback İlerleme callback'i function(int $completed, int $total, array $result)
     * @return array Sonuç ['total' => N, 'success' => M, 'failed' => K, 'details' => [...]]
     */
    public function sendToMultipleDevicesParallel(
        array $devices,
        string $imagePath,
        array $taskConfig = [],
        ?callable $progressCallback = null
    ): array {
        $results = [
            'total' => count($devices),
            'success' => 0,
            'failed' => 0,
            'skipped' => 0,
            'details' => [],
            'start_time' => microtime(true)
        ];

        if (empty($devices)) {
            return $results;
        }

        // Görsel dosyayı oku
        if (!file_exists($imagePath)) {
            $results['error'] = 'Image file not found: ' . $imagePath;
            return $results;
        }

        $imageContent = file_get_contents($imagePath);
        $imageMd5 = strtoupper(md5($imageContent));
        $imageSize = strlen($imageContent);

        // Cihazları tipe göre grupla (farklı eşzamanlılık limitleri için)
        $devicesByType = [];
        foreach ($devices as $device) {
            $type = $device['type'] ?? $device['model'] ?? 'default';
            $devicesByType[$type][] = $device;
        }

        // Her tip için paralel gönderim yap
        foreach ($devicesByType as $type => $typeDevices) {
            $concurrencyLimit = $this->getConcurrencyLimit($type);
            $chunks = array_chunk($typeDevices, $concurrencyLimit);

            foreach ($chunks as $chunkIndex => $chunk) {
                $chunkResults = $this->sendToDeviceChunkParallel(
                    $chunk,
                    $imageContent,
                    $imageMd5,
                    $taskConfig,
                    $progressCallback,
                    $results['success'] + $results['failed'] + $results['skipped']
                );

                // Sonuçları birleştir
                $results['success'] += $chunkResults['success'];
                $results['failed'] += $chunkResults['failed'];
                $results['skipped'] += $chunkResults['skipped'];
                $results['details'] = array_merge($results['details'], $chunkResults['details']);
            }
        }

        $results['end_time'] = microtime(true);
        $results['duration'] = round($results['end_time'] - $results['start_time'], 2);
        $results['image_md5'] = $imageMd5;
        $results['image_size'] = $imageSize;

        return $results;
    }

    /**
     * Cihaz grubuna paralel gönderim (curl_multi_exec ile)
     * Delta update: Önce dosya kontrolü yapar, aynı dosya varsa atlar
     */
    private function sendToDeviceChunkParallel(
        array $devices,
        string $imageContent,
        string $imageMd5,
        array $taskConfig,
        ?callable $progressCallback,
        int $completedSoFar
    ): array {
        $results = [
            'success' => 0,
            'failed' => 0,
            'skipped' => 0,
            'details' => []
        ];

        // Adım 1: Delta kontrol - hangi cihazlarda dosya zaten mevcut?
        $devicesToUpdate = [];
        $checkHandles = [];
        $mh = curl_multi_init();

        foreach ($devices as $device) {
            $ip = $device['ip'] ?? $device['ip_address'] ?? null;
            $clientId = $device['client_id'] ?? $device['device_id'] ?? 'DEVICE_' . time();

            if (!$ip) {
                $results['details'][$clientId] = [
                    'success' => false,
                    'error' => 'No IP address',
                    'skipped' => false
                ];
                $results['failed']++;
                continue;
            }

            $targetFilePath = "files/task/{$clientId}.jpg";
            $url = "http://{$ip}/check?file_path=" . urlencode($targetFilePath);

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 3
            ]);

            curl_multi_add_handle($mh, $ch);
            $checkHandles[$clientId] = [
                'handle' => $ch,
                'device' => $device,
                'ip' => $ip,
                'file_path' => $targetFilePath
            ];
        }

        // Paralel dosya kontrolü çalıştır
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // Sonuçları değerlendir - delta update
        foreach ($checkHandles as $clientId => $handleInfo) {
            $ch = $handleInfo['handle'];
            $response = curl_multi_getcontent($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            $data = json_decode($response, true);
            $existingMd5 = $data['md5'] ?? null;

            // Delta check: Dosya zaten aynı mı?
            if ($httpCode === 200 && $existingMd5 && strtoupper($existingMd5) === $imageMd5) {
                // Dosya aynı, atla
                $results['details'][$clientId] = [
                    'success' => true,
                    'skipped' => true,
                    'reason' => 'File already exists with same MD5',
                    'device_ip' => $handleInfo['ip']
                ];
                $results['skipped']++;

                if ($progressCallback) {
                    $progressCallback(
                        $completedSoFar + $results['success'] + $results['failed'] + $results['skipped'],
                        count($devices) + $completedSoFar,
                        $results['details'][$clientId]
                    );
                }
            } else {
                // Güncelleme gerekiyor
                $devicesToUpdate[$clientId] = $handleInfo;
            }
        }

        curl_multi_close($mh);

        // Adım 2: Güncellenmesi gereken cihazlara paralel gönderim
        if (!empty($devicesToUpdate)) {
            $uploadResults = $this->parallelUploadToDevices(
                $devicesToUpdate,
                $imageContent,
                $imageMd5,
                $taskConfig,
                $progressCallback,
                $completedSoFar + $results['skipped']
            );

            $results['success'] += $uploadResults['success'];
            $results['failed'] += $uploadResults['failed'];
            $results['details'] = array_merge($results['details'], $uploadResults['details']);
        }

        return $results;
    }

    /**
     * Cihazlara paralel dosya yükleme
     */
    private function parallelUploadToDevices(
        array $devicesToUpdate,
        string $imageContent,
        string $imageMd5,
        array $taskConfig,
        ?callable $progressCallback,
        int $completedSoFar
    ): array {
        $results = [
            'success' => 0,
            'failed' => 0,
            'details' => []
        ];

        // Adım 1: Tüm cihazlara paralel görsel yükle
        $uploadHandles = [];
        $mh = curl_multi_init();

        foreach ($devicesToUpdate as $clientId => $deviceInfo) {
            $ip = $deviceInfo['ip'];
            $filePath = $deviceInfo['file_path'];
            $url = "http://{$ip}/upload?file_path=" . urlencode($filePath);

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $imageContent,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/octet-stream',
                    'Content-Length: ' . strlen($imageContent)
                ]
            ]);

            curl_multi_add_handle($mh, $ch);
            $uploadHandles[$clientId] = [
                'handle' => $ch,
                'device' => $deviceInfo['device'],
                'ip' => $ip,
                'file_path' => $filePath
            ];
        }

        // Paralel yükleme
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // Yükleme sonuçlarını değerlendir
        $successfulUploads = [];
        foreach ($uploadHandles as $clientId => $handleInfo) {
            $ch = $handleInfo['handle'];
            $response = curl_multi_getcontent($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            $data = json_decode($response, true);

            if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
                $successfulUploads[$clientId] = $handleInfo;
            } else {
                $results['details'][$clientId] = [
                    'success' => false,
                    'skipped' => false,
                    'error' => 'Upload failed: ' . ($data['message'] ?? 'HTTP ' . $httpCode),
                    'device_ip' => $handleInfo['ip']
                ];
                $results['failed']++;

                if ($progressCallback) {
                    $progressCallback(
                        $completedSoFar + $results['success'] + $results['failed'],
                        count($devicesToUpdate) + $completedSoFar,
                        $results['details'][$clientId]
                    );
                }
            }
        }

        curl_multi_close($mh);

        // Adım 2: Başarılı yüklemelere task config yükle ve replay tetikle
        if (!empty($successfulUploads)) {
            $taskResults = $this->parallelTaskAndReplay(
                $successfulUploads,
                $imageMd5,
                $taskConfig,
                $progressCallback,
                $completedSoFar + $results['failed']
            );

            $results['success'] += $taskResults['success'];
            $results['failed'] += $taskResults['failed'];
            $results['details'] = array_merge($results['details'], $taskResults['details']);
        }

        return $results;
    }

    /**
     * Task config yükleme ve replay tetikleme (paralel)
     */
    private function parallelTaskAndReplay(
        array $devices,
        string $imageMd5,
        array $taskConfig,
        ?callable $progressCallback,
        int $completedSoFar
    ): array {
        $results = [
            'success' => 0,
            'failed' => 0,
            'details' => []
        ];

        // Adım 1: Task config yükle
        $taskHandles = [];
        $mh = curl_multi_init();

        foreach ($devices as $clientId => $deviceInfo) {
            $ip = $deviceInfo['ip'];
            $device = $deviceInfo['device'];

            // Task config oluştur
            $config = array_merge([
                'Id' => $clientId,
                'ItemCode' => $device['sku'] ?? $clientId,
                'ItemName' => $device['product_name'] ?? 'Product',
                'LabelPicture' => [
                    'Height' => $taskConfig['height'] ?? 1280,
                    'Width' => $taskConfig['width'] ?? 800,
                    'X' => 0,
                    'Y' => 0,
                    'PictureName' => "{$clientId}.jpg",
                    'PicturePath' => "files/task/{$clientId}.jpg",
                    'PictureMD5' => $imageMd5
                ]
            ], $taskConfig);

            $taskJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $taskFilePath = "files/task/{$clientId}.js";
            $url = "http://{$ip}/upload?file_path=" . urlencode($taskFilePath);

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $taskJson,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Content-Length: ' . strlen($taskJson)
                ]
            ]);

            curl_multi_add_handle($mh, $ch);
            $taskHandles[$clientId] = [
                'handle' => $ch,
                'ip' => $ip,
                'task_path' => $taskFilePath,
                'device' => $device
            ];
        }

        // Paralel task yükleme
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // Task sonuçlarını değerlendir
        $successfulTasks = [];
        foreach ($taskHandles as $clientId => $handleInfo) {
            $ch = $handleInfo['handle'];
            $response = curl_multi_getcontent($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            $data = json_decode($response, true);

            if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
                $successfulTasks[$clientId] = $handleInfo;
            } else {
                $results['details'][$clientId] = [
                    'success' => false,
                    'skipped' => false,
                    'error' => 'Task upload failed: ' . ($data['message'] ?? 'HTTP ' . $httpCode),
                    'device_ip' => $handleInfo['ip']
                ];
                $results['failed']++;
            }
        }

        curl_multi_close($mh);

        // Adım 2: Replay tetikle
        if (!empty($successfulTasks)) {
            $replayHandles = [];
            $mh = curl_multi_init();

            foreach ($successfulTasks as $clientId => $handleInfo) {
                $url = "http://{$handleInfo['ip']}/replay?task=" . urlencode($handleInfo['task_path']);

                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $url,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 10,
                    CURLOPT_CONNECTTIMEOUT => 3
                ]);

                curl_multi_add_handle($mh, $ch);
                $replayHandles[$clientId] = [
                    'handle' => $ch,
                    'info' => $handleInfo
                ];
            }

            // Paralel replay
            $running = null;
            do {
                curl_multi_exec($mh, $running);
                curl_multi_select($mh, 0.1);
            } while ($running > 0);

            // Replay sonuçlarını değerlendir
            foreach ($replayHandles as $clientId => $handleInfo) {
                $ch = $handleInfo['handle'];
                $response = curl_multi_getcontent($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);

                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);

                $data = json_decode($response, true);
                $info = $handleInfo['info'];

                if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
                    $results['details'][$clientId] = [
                        'success' => true,
                        'skipped' => false,
                        'device_ip' => $info['ip'],
                        'task_path' => $info['task_path'],
                        'response_time' => round($totalTime * 1000, 2)
                    ];
                    $results['success']++;
                } else {
                    $results['details'][$clientId] = [
                        'success' => false,
                        'skipped' => false,
                        'error' => 'Replay failed: ' . ($data['Task'] ?? 'HTTP ' . $httpCode),
                        'device_ip' => $info['ip']
                    ];
                    $results['failed']++;
                }

                if ($progressCallback) {
                    $progressCallback(
                        $completedSoFar + $results['success'] + $results['failed'],
                        count($devices) + $completedSoFar,
                        $results['details'][$clientId]
                    );
                }
            }

            curl_multi_close($mh);
        }

        return $results;
    }

    /**
     * Render edilmiş görseli diske kaydet (cache için)
     *
     * @param string $imageContent Görsel binary içeriği
     * @param string $companyId Şirket ID
     * @param string $deviceType Cihaz tipi
     * @param string $locale Dil kodu
     * @param string $templateId Şablon ID
     * @param string $cacheKey Cache hash
     * @return string|false Kaydedilen dosya yolu veya false
     */
    public function saveRenderToCache(
        string $imageContent,
        string $companyId,
        string $deviceType,
        string $locale,
        string $templateId,
        string $cacheKey
    ): string|false {
        // Hiyerarşik dizin yapısı
        $basePath = rtrim(STORAGE_PATH ?? dirname(__DIR__) . '/storage', '/');
        $cachePath = "{$basePath}/renders/{$companyId}/{$deviceType}/{$locale}/{$templateId}";

        // Dizin oluştur
        if (!is_dir($cachePath)) {
            if (!mkdir($cachePath, 0755, true)) {
                return false;
            }
        }

        $filePath = "{$cachePath}/{$cacheKey}.jpg";

        if (file_put_contents($filePath, $imageContent) !== false) {
            return $filePath;
        }

        return false;
    }

    /**
     * Cache'den render al
     *
     * @param string $companyId Şirket ID
     * @param string $deviceType Cihaz tipi
     * @param string $locale Dil kodu
     * @param string $templateId Şablon ID
     * @param string $cacheKey Cache hash
     * @return string|false Dosya yolu veya false (yoksa)
     */
    public function getRenderFromCache(
        string $companyId,
        string $deviceType,
        string $locale,
        string $templateId,
        string $cacheKey
    ): string|false {
        $basePath = rtrim(STORAGE_PATH ?? dirname(__DIR__) . '/storage', '/');
        $filePath = "{$basePath}/renders/{$companyId}/{$deviceType}/{$locale}/{$templateId}/{$cacheKey}.jpg";

        if (file_exists($filePath)) {
            return $filePath;
        }

        return false;
    }

    /**
     * Render cache key oluştur
     *
     * @param string $templateId Şablon ID
     * @param string $templateVersion Şablon versiyonu
     * @param string $productId Ürün ID
     * @param string $productVersion Ürün versiyonu (updated_at)
     * @param string $locale Dil kodu
     * @param string $resolution Çözünürlük (WxH)
     * @param string $deviceType Cihaz tipi
     * @param string $priceRuleVersion Fiyat kuralı versiyonu
     * @param string $brandingVersion Branding versiyonu
     * @return string MD5 hash
     */
    public function generateCacheKey(
        string $templateId,
        string $templateVersion,
        string $productId,
        string $productVersion,
        string $locale,
        string $resolution,
        string $deviceType,
        string $priceRuleVersion = '',
        string $brandingVersion = ''
    ): string {
        $components = [
            $templateId,
            $templateVersion,
            $productId,
            $productVersion,
            $locale,
            $resolution,
            $deviceType,
            $priceRuleVersion,
            $brandingVersion
        ];

        return md5(implode('|', $components));
    }

    /**
     * Bluetooth ile sabit IP ayarla
     *
     * NOT: Bu işlem için Web Bluetooth API kullanılması gerekiyor.
     * Backend'den bu komutu göndermek mümkün değil, frontend'den Bluetooth bağlantısı gerekli.
     *
     * @param string $ip Atanacak IP adresi
     * @param string $gateway Gateway adresi
     * @param string $netmask Subnet mask (varsayılan: 255.255.255.0)
     * @param string $token Admin şifresi (varsa)
     * @return array Bluetooth komutu ve talimatlar
     */
    public function prepareStaticIpCommand(
        string $ip,
        string $gateway,
        string $netmask = '255.255.255.0',
        string $token = ''
    ): array {
        // Bluetooth komutu formatı
        $command = sprintf(
            '+SET-DEVICE:{"network":{"static-ip":"%s","gateway":"%s","Netmask":"%s"}, "Token":"%s"}',
            $ip,
            $gateway,
            $netmask,
            $token
        );

        return [
            'success' => true,
            'bluetooth_command' => $command,
            'instructions' => [
                '1. Cihaza Web Bluetooth ile bağlanın (Tarayıcıda Bluetooth özelliği gerekli)',
                '2. Aşağıdaki komutu gönderin:',
                '   ' . $command,
                '3. Cihaz yeniden başlatılacak ve yeni IP atanacak',
                '4. Yeni IP ile cihaza erişimi test edin'
            ],
            'new_ip' => $ip,
            'gateway' => $gateway,
            'netmask' => $netmask,
            'note' => 'Bu işlem Web Bluetooth API gerektirir, backend\'den doğrudan gönderilemez'
        ];
    }

    /**
     * Bluetooth ile DHCP moduna geç
     *
     * @param string $token Admin şifresi (varsa)
     * @return array Bluetooth komutu
     */
    public function prepareDhcpCommand(string $token = ''): array
    {
        $command = sprintf(
            '+SET-DEVICE:{"network":{"static-ip":"","gateway":"","Netmask":""}, "Token":"%s"}',
            $token
        );

        return [
            'success' => true,
            'bluetooth_command' => $command,
            'instructions' => [
                '1. Cihaza Web Bluetooth ile bağlanın',
                '2. Aşağıdaki komutu gönderin:',
                '   ' . $command,
                '3. Cihaz DHCP moduna geçecek ve otomatik IP alacak'
            ],
            'mode' => 'dhcp',
            'note' => 'Bu işlem Web Bluetooth API gerektirir'
        ];
    }

    /**
     * Bluetooth ile WiFi ayarla
     *
     * @param string $ssid WiFi ağ adı
     * @param string $password WiFi şifresi
     * @param string $token Admin şifresi (varsa)
     * @return array Bluetooth komutu
     */
    public function prepareWifiCommand(
        string $ssid,
        string $password,
        string $token = ''
    ): array {
        $command = sprintf(
            '+SET-DEVICE:{"WIFI":{"ssid":"%s","passwd":"%s"}, "Token":"%s"}',
            $ssid,
            $password,
            $token
        );

        return [
            'success' => true,
            'bluetooth_command' => $command,
            'instructions' => [
                '1. Cihaza Web Bluetooth ile bağlanın',
                '2. Aşağıdaki komutu gönderin:',
                '   ' . $command,
                '3. Cihaz belirtilen WiFi ağına bağlanacak'
            ],
            'ssid' => $ssid,
            'note' => 'Şifre bu yanıtta gösterilmez (güvenlik nedeniyle)',
            'warning' => 'WiFi şifresini kaydetmeden önce doğru olduğundan emin olun!'
        ];
    }

    // ==========================================
    // GELIŞMIŞ AĞ TARAMA SİSTEMİ
    // Multi-Subnet + Generic HTTP + Profil + Ping Sweep
    // ==========================================

    /**
     * Cihaz keşif profilleri - farklı marka cihazlar için endpoint tanımları
     */
    public static function getDiscoveryProfiles(): array
    {
        return [
            'pavodisplay' => [
                'name' => 'PavoDisplay',
                'icon' => 'ti-device-tablet',
                'color' => '#228be6',
                'ports' => [80],
                'endpoints' => [
                    ['path' => '/check?file_path=files/task/ping.txt', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/Iotags', 'method' => 'GET', 'expect_status' => 200],
                ],
                'info_endpoints' => ['/info', '/status', '/device/info', '/api/info', '/api/device'],
                'type' => 'esl_android',
                'model_prefix' => 'PAVO_',
                'default_screen' => ['width' => 800, 'height' => 1280],
                'manufacturer' => 'PavoDisplay',
            ],
            'generic_android_esl' => [
                'name' => 'Android ESL (Genel)',
                'icon' => 'ti-device-mobile',
                'color' => '#40c057',
                'ports' => [80, 8080],
                'endpoints' => [
                    ['path' => '/info', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/api/info', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/status', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/api/device', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/device/info', 'method' => 'GET', 'expect_status' => 200],
                ],
                'info_endpoints' => ['/info', '/api/info', '/status', '/device/info', '/api/device'],
                'type' => 'esl_android',
                'model_prefix' => 'ESL_',
                'default_screen' => ['width' => 800, 'height' => 1280],
                'manufacturer' => 'Generic',
            ],
            'generic_signage' => [
                'name' => 'Signage / TV (Genel)',
                'icon' => 'ti-device-tv',
                'color' => '#fab005',
                'ports' => [80, 8080, 8443],
                'endpoints' => [
                    ['path' => '/', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/api/info', 'method' => 'GET', 'expect_status' => 200],
                    ['path' => '/info', 'method' => 'GET', 'expect_status' => 200],
                ],
                'info_endpoints' => ['/api/info', '/info', '/status', '/api/device'],
                'type' => 'android_tv',
                'model_prefix' => 'SIGN_',
                'default_screen' => ['width' => 1920, 'height' => 1080],
                'manufacturer' => 'Generic',
            ],
            'generic_http' => [
                'name' => 'HTTP Cihaz (Tümü)',
                'icon' => 'ti-world',
                'color' => '#868e96',
                'ports' => [80, 8080],
                'endpoints' => [
                    ['path' => '/', 'method' => 'GET', 'expect_status' => [200, 301, 302, 401, 403]],
                ],
                'info_endpoints' => ['/info', '/api/info', '/status', '/device/info'],
                'type' => 'unknown',
                'model_prefix' => 'HTTP_',
                'default_screen' => ['width' => 0, 'height' => 0],
                'manufacturer' => 'Unknown',
            ],
        ];
    }

    /**
     * Multi-Subnet tarama: Birden fazla subnet bloğunu paralel tara
     *
     * @param array $subnets Subnet listesi (örn: ['192.168.1', '192.168.2', '192.168.3'])
     * @param int $startIp Başlangıç IP
     * @param int $endIp Bitiş IP
     * @param array $profiles Kullanılacak profil isimleri (boş = pavodisplay)
     * @return array Bulunan cihazlar
     */
    public function scanMultipleSubnets(array $subnets, int $startIp = 1, int $endIp = 254, array $profiles = ['pavodisplay']): array
    {
        $allDevices = [];

        foreach ($subnets as $subnet) {
            $subnet = trim($subnet);
            if (!$this->isValidSubnetFormat($subnet)) {
                continue;
            }

            $devices = $this->advancedScan($subnet, $startIp, $endIp, $profiles);

            foreach ($devices as &$device) {
                $device['subnet'] = $subnet;
            }

            $allDevices = array_merge($allDevices, $devices);
        }

        return $allDevices;
    }

    /**
     * Gelişmiş tarama: Profil bazlı cihaz keşfi
     * Önce ping sweep, sonra HTTP endpoint kontrolü
     *
     * @param string $subnet Alt ağ
     * @param int $startIp Başlangıç IP
     * @param int $endIp Bitiş IP
     * @param array $profileNames Profil isimleri
     * @return array Bulunan cihazlar
     */
    public function advancedScan(string $subnet = '192.168.1', int $startIp = 1, int $endIp = 254, array $profileNames = ['pavodisplay']): array
    {
        $allProfiles = self::getDiscoveryProfiles();
        $activeProfiles = [];
        foreach ($profileNames as $name) {
            if (isset($allProfiles[$name])) {
                $activeProfiles[$name] = $allProfiles[$name];
            }
        }

        if (empty($activeProfiles)) {
            $activeProfiles = ['pavodisplay' => $allProfiles['pavodisplay']];
        }

        // Adım 1: Ping Sweep - Tüm IP'leri TCP ile hızlı tara
        $aliveIps = $this->pingSweep($subnet, $startIp, $endIp);

        if (empty($aliveIps)) {
            return [];
        }

        // Adım 2: Canlı IP'lerde profil bazlı HTTP keşfi
        $devices = [];
        foreach ($activeProfiles as $profileName => $profile) {
            $profileDevices = $this->probeDevicesWithProfile($aliveIps, $profile, $profileName);
            $devices = array_merge($devices, $profileDevices);
        }

        // Aynı IP birden fazla profille eşleşmişse en spesifik olanı tut
        $devices = $this->deduplicateDevices($devices);

        return $devices;
    }

    /**
     * Ping Sweep: TCP bağlantı kontrolü ile canlı IP'leri bul
     * Port 80 ve 8080'i kontrol eder
     *
     * @param string $subnet Alt ağ
     * @param int $startIp Başlangıç
     * @param int $endIp Bitiş
     * @return array Canlı IP ve port bilgileri [['ip' => '...', 'port' => 80, 'time' => 12.5], ...]
     */
    public function pingSweep(string $subnet, int $startIp = 1, int $endIp = 254): array
    {
        $aliveHosts = [];
        $ports = [80, 8080];
        $mh = curl_multi_init();
        $handles = [];

        for ($i = $startIp; $i <= $endIp; $i++) {
            $ip = "{$subnet}.{$i}";
            foreach ($ports as $port) {
                $key = "{$ip}:{$port}";
                $url = "http://{$ip}" . ($port !== 80 ? ":{$port}" : '') . "/";

                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $url,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 2,
                    CURLOPT_CONNECTTIMEOUT => 1,
                    CURLOPT_NOBODY => true,       // HEAD request - daha hızlı
                    CURLOPT_FOLLOWLOCATION => false,
                ]);

                curl_multi_add_handle($mh, $ch);
                $handles[$key] = ['ch' => $ch, 'ip' => $ip, 'port' => $port];
            }
        }

        // Paralel çalıştır
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.5);
        } while ($running > 0);

        // Sonuçları topla
        $seenIps = [];
        foreach ($handles as $key => $info) {
            $ch = $info['ch'];
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            $connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);

            // HTTP yanıtı aldıysak (herhangi bir status code) cihaz canlıdır
            if ($httpCode > 0 && $connectTime > 0 && $connectTime < 2) {
                $ipKey = $info['ip'];
                if (!isset($seenIps[$ipKey])) {
                    $seenIps[$ipKey] = true;
                    $aliveHosts[] = [
                        'ip' => $info['ip'],
                        'port' => $info['port'],
                        'http_code' => $httpCode,
                        'response_time' => round($totalTime * 1000, 2),
                    ];
                }
            }

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }

        curl_multi_close($mh);

        return $aliveHosts;
    }

    /**
     * Profil bazlı HTTP endpoint keşfi
     *
     * @param array $aliveHosts Canlı IP'ler (pingSweep sonucu)
     * @param array $profile Keşif profili
     * @param string $profileName Profil adı
     * @return array Eşleşen cihazlar
     */
    public function probeDevicesWithProfile(array $aliveHosts, array $profile, string $profileName): array
    {
        $devices = [];
        $mh = curl_multi_init();
        $handles = [];

        foreach ($aliveHosts as $host) {
            $ip = $host['ip'];
            $hostPort = $host['port'];

            foreach ($profile['endpoints'] as $endpoint) {
                foreach ($profile['ports'] as $port) {
                    $portSuffix = ($port !== 80) ? ":{$port}" : '';
                    $url = "http://{$ip}{$portSuffix}{$endpoint['path']}";
                    $key = "{$ip}:{$port}:{$endpoint['path']}";

                    $ch = curl_init();
                    curl_setopt_array($ch, [
                        CURLOPT_URL => $url,
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 3,
                        CURLOPT_CONNECTTIMEOUT => 1,
                        CURLOPT_NOBODY => false,
                        CURLOPT_FOLLOWLOCATION => false,
                    ]);

                    curl_multi_add_handle($mh, $ch);
                    $handles[$key] = [
                        'ch' => $ch,
                        'ip' => $ip,
                        'port' => $port,
                        'endpoint' => $endpoint,
                        'host_port' => $hostPort,
                    ];
                }
            }
        }

        // Paralel çalıştır
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.5);
        } while ($running > 0);

        // Sonuçları topla
        $matchedIps = [];
        foreach ($handles as $key => $info) {
            $ch = $info['ch'];
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            $response = curl_multi_getcontent($ch);

            $expectedCodes = $info['endpoint']['expect_status'];
            if (!is_array($expectedCodes)) {
                $expectedCodes = [$expectedCodes];
            }

            if (in_array($httpCode, $expectedCodes) && !isset($matchedIps[$info['ip']])) {
                $matchedIps[$info['ip']] = true;

                // Cihaz bilgilerini topla
                $deviceInfo = $this->extractDeviceInfoFromResponse($response, $info['ip'], $profile);

                $devices[] = [
                    'ip' => $info['ip'],
                    'port' => $info['port'],
                    'response_time' => round($totalTime * 1000, 2),
                    'type' => $profile['type'],
                    'profile' => $profileName,
                    'profile_name' => $profile['name'],
                    'profile_icon' => $profile['icon'] ?? 'ti-device-tablet',
                    'profile_color' => $profile['color'] ?? '#228be6',
                    'manufacturer' => $profile['manufacturer'],
                    'client_id' => $deviceInfo['client_id'] ?? ($profile['model_prefix'] . str_replace('.', '', $info['ip'])),
                    'model' => $deviceInfo['model'] ?? $profile['name'],
                    'firmware' => $deviceInfo['firmware'] ?? null,
                    'screen_width' => $deviceInfo['screen_width'] ?? $profile['default_screen']['width'],
                    'screen_height' => $deviceInfo['screen_height'] ?? $profile['default_screen']['height'],
                    'matched_endpoint' => $info['endpoint']['path'],
                    'http_code' => $httpCode,
                ];
            }

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }

        curl_multi_close($mh);

        // Bulunan cihazların detaylı bilgilerini al (info endpoint'lerinden)
        foreach ($devices as &$device) {
            if (!empty($profile['info_endpoints'])) {
                $detailedInfo = $this->probeInfoEndpoints($device['ip'], $device['port'], $profile['info_endpoints']);
                if (!empty($detailedInfo)) {
                    $device = array_merge($device, $detailedInfo);
                }
            }
        }

        return $devices;
    }

    /**
     * HTTP yanıtından cihaz bilgisi çıkar
     */
    private function extractDeviceInfoFromResponse(?string $response, string $ip, array $profile): array
    {
        $info = [];
        if (empty($response)) return $info;

        $data = @json_decode($response, true);
        if (!is_array($data)) return $info;

        // Client ID bul
        $clientIdKeys = ['clientId', 'client_id', 'Id', 'deviceId', 'device_id', 'id', 'serial', 'serialNumber'];
        foreach ($clientIdKeys as $key) {
            if (isset($data[$key]) && is_string($data[$key]) && !empty($data[$key])) {
                $info['client_id'] = $data[$key];
                break;
            }
        }

        // Model
        $modelKeys = ['model', 'Model', 'deviceModel', 'device_model', 'product'];
        foreach ($modelKeys as $key) {
            if (isset($data[$key]) && is_string($data[$key])) {
                $info['model'] = $data[$key];
                break;
            }
        }

        // Firmware
        $fwKeys = ['firmware', 'version', 'firmwareVersion', 'fw_version', 'sw_version'];
        foreach ($fwKeys as $key) {
            if (isset($data[$key]) && is_string($data[$key])) {
                $info['firmware'] = $data[$key];
                break;
            }
        }

        // Ekran boyutu
        $screenKeys = [
            ['screenWidth', 'screenHeight'],
            ['screen_width', 'screen_height'],
            ['width', 'height'],
            ['display_width', 'display_height'],
        ];
        foreach ($screenKeys as [$wKey, $hKey]) {
            if (isset($data[$wKey]) && isset($data[$hKey])) {
                $info['screen_width'] = (int)$data[$wKey];
                $info['screen_height'] = (int)$data[$hKey];
                break;
            }
        }

        return $info;
    }

    /**
     * Info endpoint'lerinden detaylı bilgi al
     */
    private function probeInfoEndpoints(string $ip, int $port, array $endpoints): array
    {
        $info = [];
        $portSuffix = ($port !== 80) ? ":{$port}" : '';

        foreach ($endpoints as $endpoint) {
            $url = "http://{$ip}{$portSuffix}{$endpoint}";
            $response = $this->httpRequest($url, 'GET', null, 'application/json');

            if ($response['success'] && !empty($response['data'])) {
                $data = $response['data'];
                $extracted = $this->extractDeviceInfoFromResponse(json_encode($data), $ip, []);
                if (!empty($extracted)) {
                    $info = array_merge($info, $extracted);
                    break; // İlk başarılı yanıt yeterli
                }
            }
        }

        return $info;
    }

    /**
     * Aynı IP'ye birden fazla profil eşleşmişse en spesifik olanı tut
     */
    private function deduplicateDevices(array $devices): array
    {
        $byIp = [];
        // Profil önceliği: PavoDisplay > generic_android_esl > generic_signage > generic_http
        $priority = ['pavodisplay' => 4, 'generic_android_esl' => 3, 'generic_signage' => 2, 'generic_http' => 1];

        foreach ($devices as $device) {
            $ip = $device['ip'];
            $profile = $device['profile'] ?? 'generic_http';
            $currentPriority = $priority[$profile] ?? 0;

            if (!isset($byIp[$ip]) || $currentPriority > ($priority[$byIp[$ip]['profile']] ?? 0)) {
                $byIp[$ip] = $device;
            }
        }

        return array_values($byIp);
    }

    /**
     * Subnet formatı doğrulama
     */
    private function isValidSubnetFormat(string $subnet): bool
    {
        $parts = explode('.', trim($subnet));
        if (count($parts) !== 3) return false;
        foreach ($parts as $part) {
            if (!is_numeric($part) || (int)$part < 0 || (int)$part > 255) return false;
        }
        return true;
    }
}
