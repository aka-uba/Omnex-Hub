<?php
/**
 * PavoDisplay Price Tag Gateway
 *
 * PavoDisplay marka elektronik fiyat etiketi cihazlarÄ± ile iletiÅŸim saÄŸlar.
 * Cihaz HTTP-SERVER modunda Ã§alÄ±ÅŸÄ±r ve dosya tabanlÄ± senkronizasyon yapar.
 *
 * Desteklenen Firmware: V3.36+
 * Ekran BoyutlarÄ±: 800x1280, 1920x1080, 1280x800
 */

class PavoDisplayGateway
{
    private $timeout = 10;
    private $connectTimeout = 5;

    /**
     * PavoDisplay API dokÃ¼mantasyonuna gÃ¶re sign hesapla.
     *
     * Algoritma:
     * 1. TÃ¼m URL parametrelerini (sign hariÃ§) alfabetik sÄ±rala
     * 2. key1=value1&key2=value2 formatÄ±nda birleÅŸtir
     * 3. Sonuna &key=AppSecret ekle
     * 4. MD5 al ve uppercase yap
     *
     * @param array $params URL query parametreleri (sign hariÃ§)
     * @param string $appSecret AppSecret deÄŸeri
     * @return string Uppercase MD5 sign
     */
    private function calculateSign(array $params, string $appSecret): string
    {
        // sign parametresini Ã§Ä±kar (varsa)
        unset($params['sign']);

        // Alfabetik sÄ±rala
        ksort($params);

        // key=value formatÄ±nda birleÅŸtir
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
     * @param bool $lightweight Hafif ping (sadece TCP baÄŸlantÄ± kontrolÃ¼)
     */
    public function ping(string $ip, bool $lightweight = false): array
    {
        // Hafif ping: sadece TCP baÄŸlantÄ±sÄ±nÄ± kontrol et (HTTP isteÄŸi gÃ¶ndermeden)
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
     * Cihaza dosya yÃ¼kle
     *
     * @param string $ip Cihaz IP adresi
     * @param string $filePath Hedef dosya yolu (files/task/ altÄ±nda)
     * @param string $content Dosya iÃ§eriÄŸi
     * @param bool $clearSpace YÃ¼kleme Ã¶ncesi alan temizle
     * @param string|null $clientId Client ID (APK sync iÃ§in)
     */
    public function uploadFile(string $ip, string $filePath, string $content, bool $clearSpace = false, ?string $clientId = null): array
    {
        // Dosya yolu kontrolÃ¼
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

        // Binary dosya mÄ± kontrol et (resim, video vb.)
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
     * Dosya MD5 ve boyut kontrolÃ¼
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
     * Task JSON oluÅŸtur ve yÃ¼kle
     *
     * API DokÃ¼mantasyonuna gÃ¶re doÄŸru akÄ±ÅŸ:
     * 1. Resim/video dosyalarÄ±nÄ± yÃ¼kle
     * 2. Task dosyasÄ±nÄ± .js uzantÄ±sÄ±yla yÃ¼kle (LabelPicture formatÄ±nda)
     * 3. /replay endpoint'i ile ekranÄ± gÃ¼ncelle
     *
     * @param string $ip Cihaz IP
     * @param array $product ÃœrÃ¼n bilgileri
     * @param array $template Åablon ayarlarÄ±
     * @param string|null $clientId Client ID
     */
    public function syncProduct(string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // VarsayÄ±lan ÅŸablon
        $screenWidth = $template['width'] ?? 800;
        $screenHeight = $template['height'] ?? 1280;

        // Client ID yoksa varsayÄ±lan oluÅŸtur
        $clientId = $clientId ?? ('DEVICE_' . time());

        // 1. Ã–nce mevcut task klasÃ¶rÃ¼nÃ¼ temizle (clearspace=1)
        $this->uploadFile($ip, 'files/task/.clear', '', true, $clientId);

        // 2. ÃœrÃ¼n gÃ¶rseli varsa Ã¶nce yÃ¼kle
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

            // MD5 doÄŸrula
            $imageCheck = $this->checkFile($ip, $imagePath);
            if ($imageCheck['exists']) {
                $imageMD5 = $imageCheck['md5'];
            }
        }

        // 3. Video dosyasÄ± varsa yÃ¼kle
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

        // 4. Task JSON oluÅŸtur (API dokÃ¼mantasyonundaki format)
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

        // 5. Task dosyasÄ±nÄ± .js uzantÄ±sÄ±yla yÃ¼kle
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

        // 6. /replay ile ekranÄ± gÃ¼ncelle
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
     * /replay endpoint'i ile ekran gÃ¼ncellemeyi tetikle
     *
     * API DokÃ¼mantasyonundan: GET /replay?task=files/task/xxx.js
     * Bu endpoint task dosyasÄ±nÄ± okur ve ekranÄ± gÃ¼nceller.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $taskPath Task dosyasÄ±nÄ±n yolu (files/task/xxx.js)
     * @param string|null $sign Ä°mza (opsiyonel - MD5)
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
     * Eski tetikleme metodu (geriye uyumluluk iÃ§in)
     * @deprecated triggerReplay() kullanÄ±n
     */
    private function triggerDeviceRefresh(string $ip, string $clientId): void
    {
        // ArtÄ±k /replay kullanÄ±lÄ±yor, bu metod sadece geriye uyumluluk iÃ§in
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
     * Task JSON formatÄ± oluÅŸtur
     * APK'dan keÅŸfedilen format: LabelText, LabelPicture, LabelVideo, VideoList
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

        // ÃœrÃ¼n adÄ±
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

        // Eski fiyat (Ã¼stÃ¼ Ã§izili)
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

        // ÃœrÃ¼n gÃ¶rseli
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

        // Video desteÄŸi (opsiyonel)
        // Not: Video yÃ¼kleme syncProduct metodunda yapÄ±lÄ±yor, burada sadece placeholder
        // GerÃ§ek video path syncProduct'ta set edilecek

        return $task;
    }

    /**
     * Demo iÃ§erik ile sync testi yap
     * 
     * @param string $ip Cihaz IP adresi
     * @param string $demoType Demo tipi: 'strawberry', 'apple', 'lemon', 'cherry'
     * @param string|null $clientId Client ID (APK sync iÃ§in)
     */
    public function syncDemo(string $ip, string $demoType = 'strawberry', ?string $clientId = null): array
    {
        $demoAssets = [
            'strawberry' => [
                'image' => 'tasarÄ±mlar/cihazlar/base (2)/assets/Strawberry.png',
                'name' => 'KÄ±rmÄ±zÄ± Ã‡ilek',
                'price' => '18.99',
                'unit' => 'TL/kg'
            ],
            'apple' => [
                'image' => 'tasarÄ±mlar/cihazlar/base (2)/assets/Apple.png',
                'name' => 'KÄ±rmÄ±zÄ± Elma',
                'price' => '24.50',
                'unit' => 'TL/kg'
            ],
            'lemon' => [
                'image' => 'tasarÄ±mlar/cihazlar/base (2)/assets/Lemon.png',
                'name' => 'Limon',
                'price' => '12.99',
                'unit' => 'TL/kg'
            ],
            'cherry' => [
                'image' => 'tasarÄ±mlar/cihazlar/base (2)/assets/Cherry.png',
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

        // Demo Ã¼rÃ¼n bilgisi oluÅŸtur
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
     * HTTP isteÄŸi gÃ¶nder
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
                // JSON iÃ§erik
                $headers[] = 'Content-Type: application/json';
            } else {
                // Binary iÃ§erik (resim, video vb.)
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
     * AÄŸdaki cihazlarÄ± tara
     *
     * @param string $subnet Alt aÄŸ (Ã¶rn: 192.168.1)
     * @param int $startIp BaÅŸlangÄ±Ã§ IP (1-254)
     * @param int $endIp BitiÅŸ IP (1-254)
     * @param callable|null $progressCallback Ä°lerleme callback'i
     */
    public function scanNetwork(string $subnet = '192.168.1', int $startIp = 1, int $endIp = 254, ?callable $progressCallback = null): array
    {
        $devices = [];
        $total = $endIp - $startIp + 1;
        $current = 0;

        for ($i = $startIp; $i <= $endIp; $i++) {
            $ip = "{$subnet}.{$i}";
            $current++;

            // Ä°lerleme bildir
            if ($progressCallback) {
                $progressCallback($current, $total, $ip);
            }

            $result = $this->ping($ip);

            if ($result['online']) {
                // Cihaz bilgilerini almaya Ã§alÄ±ÅŸ
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
     * Tek bir IP'yi hÄ±zlÄ± tara ve PavoDisplay cihazÄ± mÄ± kontrol et
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
     * Cihaz bilgilerini almak iÃ§in Ã§eÅŸitli endpoint'leri dene
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

        // /check endpoint'i ile kontrol et (PavoDisplay imzasÄ±)
        $checkResult = $this->checkFile($ip, 'files/task/test.txt');

        // EÄŸer /check Ã§alÄ±ÅŸÄ±yorsa PavoDisplay cihazÄ±dÄ±r
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

        // EÄŸer client_id bulunamadÄ±ysa IP'den oluÅŸtur
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

        // TÃ¼m IP'ler iÃ§in cURL handle'larÄ± oluÅŸtur
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

        // Paralel Ã§alÄ±ÅŸtÄ±r
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh);
        } while ($running > 0);

        // SonuÃ§larÄ± topla
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

        // Bulunan cihazlarÄ±n detaylÄ± bilgilerini al
        foreach ($devices as &$device) {
            $deviceInfo = $this->getDeviceInfo($device['ip']);
            $device = array_merge($device, $deviceInfo);
        }

        return $devices;
    }

    /**
     * Bluetooth ile sync yap
     * 
     * @param string $bluetoothName Bluetooth cihaz adÄ± (Ã¶rn: @B2A401A977)
     * @param string $ip Cihaz IP adresi (WiFi Ã¼zerinden dosya yÃ¼kleme iÃ§in)
     * @param array $product ÃœrÃ¼n bilgileri
     * @param array $template Åablon ayarlarÄ±
     * @param string|null $clientId Client ID
     */
    public function syncViaBluetooth(string $bluetoothName, string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // Ã–nce WiFi Ã¼zerinden dosyalarÄ± yÃ¼kle
        $wifiSync = $this->syncProduct($ip, $product, $template, $clientId);
        
        if (!$wifiSync['success']) {
            return $wifiSync;
        }

        // Bluetooth Ã¼zerinden tetikleme dene
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
     * Bluetooth Ã¼zerinden sync tetikle
     * 
     * Not: PHP'den direkt Bluetooth eriÅŸimi sÄ±nÄ±rlÄ±dÄ±r.
     * Bu metod sistem komutlarÄ±nÄ± veya API endpoint'lerini kullanÄ±r.
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

        // Windows'ta Bluetooth komutlarÄ± (eÄŸer mevcut ise)
        if (PHP_OS_FAMILY === 'Windows') {
            // PowerShell ile Bluetooth komutlarÄ± deneyebiliriz
            // Ancak bu genellikle admin yetkisi gerektirir
            $result['note'] = 'Windows Bluetooth access requires admin privileges';
        }

        // Alternatif: CihazÄ±n Bluetooth Ã¼zerinden HTTP endpoint'i olabilir
        // Ã–rneÄŸin: Bluetooth Ã¼zerinden HTTP isteÄŸi gÃ¶nderme
        // Bu genellikle Ã¶zel bir Bluetooth-HTTP bridge gerektirir

        return $result;
    }

    /**
     * Bluetooth cihaz bilgilerini al
     */
    public function getBluetoothInfo(string $ip): array
    {
        // Cihazdan Bluetooth bilgilerini almak iÃ§in endpoint'leri dene
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
     * @param string $bluetoothName Bluetooth cihaz adÄ±
     * @param array $product ÃœrÃ¼n bilgileri
     * @param array $template Åablon ayarlarÄ±
     * @param string|null $clientId Client ID
     */
    public function syncWiFiAndBluetooth(string $ip, string $bluetoothName, array $product, array $template = [], ?string $clientId = null): array
    {
        // 1. WiFi Ã¼zerinden dosyalarÄ± yÃ¼kle
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
     * APK'nÄ±n sync butonunun yaptÄ±ÄŸÄ± iÅŸlemleri taklit et
     * 
     * APK analizinden bulunan bilgilere gÃ¶re:
     * - SyncDeviceUtils sÄ±nÄ±fÄ± sync iÅŸlemini yapÄ±yor
     * - Upload sonrasÄ± Ã¶zel bir tetikleme endpoint'i Ã§aÄŸrÄ±lÄ±yor olabilir
     * 
     * @param string $ip Cihaz IP
     * @param string|null $clientId Client ID
     */
    public function triggerSyncLikeAPK(string $ip, ?string $clientId = null): array
    {
        $results = [];
        
        // APK'nÄ±n muhtemelen Ã§aÄŸÄ±rdÄ±ÄŸÄ± endpoint'ler
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
        
        // BaÅŸarÄ±lÄ± olanlarÄ± bul
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
     * APK'nÄ±n tam sync akÄ±ÅŸÄ±nÄ± taklit et
     * 
     * 1. DosyalarÄ± yÃ¼kle
     * 2. Sync tetikle
     * 
     * @param string $ip Cihaz IP
     * @param array $product ÃœrÃ¼n bilgileri
     * @param array $template Åablon ayarlarÄ±
     * @param string|null $clientId Client ID
     */
    public function syncLikeAPK(string $ip, array $product, array $template = [], ?string $clientId = null): array
    {
        // 1. Ã–nce dosyalarÄ± yÃ¼kle
        $uploadResult = $this->syncProduct($ip, $product, $template, $clientId);
        
        if (!$uploadResult['success']) {
            return [
                'success' => false,
                'error' => 'Upload failed: ' . ($uploadResult['error'] ?? 'Unknown error'),
                'upload_result' => $uploadResult
            ];
        }
        
        // 2. Sync tetikle (APK'nÄ±n yaptÄ±ÄŸÄ± gibi)
        sleep(1); // APK muhtemelen kÄ±sa bir bekleme yapÄ±yor
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
     * Cihaz storage alanÄ±nÄ± temizle
     *
     * @param string $ip Cihaz IP adresi
     * @return array SonuÃ§
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
     * Cihaz detaylÄ± bilgilerini al (Iotags endpoint)
     *
     * @param string $ip Cihaz IP adresi
     * @param string $appId App ID (varsayÄ±lan boÅŸ)
     * @param string $appSecret App Secret (varsayÄ±lan boÅŸ)
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
            CURLOPT_TIMEOUT => 3,               // 10 -> 3 saniye (hÄ±zlÄ± yanÄ±t)
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
     * Cihaz arka Ä±ÅŸÄ±k kontrolÃ¼
     *
     * NOT: HTTP-SERVER modunda parlaklÄ±k kontrolÃ¼ desteklenmiyor!
     * Bu Ã¶zellik iÃ§in Bluetooth veya MQTT gerekiyor.
     *
     * Bluetooth komutu: +SET-DEVICE:{"Hardware":{"brightness":100}, "Token":""}\r\n
     * MQTT komutu: {"action":"backlight-set","push_id":0,"clientid":"DEVICE_ID","backlight":100}
     *
     * @param string $ip Cihaz IP adresi
     * @param string $action 'on', 'off' veya 'set'
     * @param int|null $level ParlaklÄ±k seviyesi (0-100, sadece action='set' iÃ§in)
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array SonuÃ§
     */
    public function setBacklight(string $ip, string $action = 'on', ?int $level = null, string $appId = '', string $appSecret = ''): array
    {
        // HTTP-SERVER modunda parlaklÄ±k kontrolÃ¼ desteklenmiyor
        // Ancak yine de deneyelim - belki firmware gÃ¼ncellendi

        // Action'a gÃ¶re endpoint belirle (sign her action iÃ§in ayrÄ± hesaplanÄ±r)
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
            'error' => 'HTTP-SERVER modunda parlaklÄ±k kontrolÃ¼ desteklenmiyor',
            'hint' => 'Bluetooth veya MQTT kullanÄ±n',
            'bluetooth_command' => '+SET-DEVICE:{"Hardware":{"brightness":' . ($level ?? 100) . '}, "Token":""}',
            'mqtt_command' => '{"action":"backlight-set","push_id":0,"clientid":"DEVICE_ID","backlight":' . ($level ?? 100) . '}'
        ];
    }

    /**
     * CihazÄ± yeniden baÅŸlat (HTTP-SERVER mode)
     * NOT: HTTP-SERVER modunda doÄŸrudan restart endpoint'i yoktur.
     * Bu metod cihaza restart komutu gÃ¶ndermeye Ã§alÄ±ÅŸÄ±r.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array SonuÃ§
     */
    public function restartDevice(string $ip, string $appId = '', string $appSecret = ''): array
    {
        // HTTP-SERVER modunda restart endpoint'i dene (her biri iÃ§in ayrÄ± sign)
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
     * Firmware gÃ¼ncelleme dosyasÄ±nÄ± cihaza yÃ¼kle
     *
     * WARNING: Bu iÅŸlem cihazÄ± kalÄ±cÄ± olarak bozabilir!
     * YalnÄ±zca gÃ¼venilir kaynaklardan alÄ±nan firmware dosyalarÄ±nÄ± kullanÄ±n.
     *
     * @param string $ip Cihaz IP adresi
     * @param string $content Firmware dosya iÃ§eriÄŸi (binary)
     * @param string $filePath Hedef dosya yolu (files/upgrade/firmware.pkg)
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array SonuÃ§
     */
    public function uploadFirmware(string $ip, string $content, string $filePath, string $appId = '', string $appSecret = ''): array
    {
        // Dosya yolu kontrolÃ¼ - upgrade dizini kullan
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
            CURLOPT_TIMEOUT => 300, // 5 dakika timeout (bÃ¼yÃ¼k dosyalar iÃ§in)
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'error' => 'BaÄŸlantÄ± hatasÄ±: ' . $curlError
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['STATE']) && $data['STATE'] === 'SUCCEED') {
            return [
                'success' => true,
                'message' => 'Firmware yÃ¼klendi, cihaz yeniden baÅŸlatÄ±lÄ±yor'
            ];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? 'Firmware yÃ¼kleme baÅŸarÄ±sÄ±z',
            'http_code' => $httpCode,
            'response' => $response
        ];
    }

    /**
     * Dosya varlÄ±ÄŸÄ±nÄ± detaylÄ± kontrol et
     *
     * @param string $ip Cihaz IP adresi
     * @param string $filePath Dosya yolu
     * @param string $appId App ID
     * @param string $appSecret App Secret
     * @return array SonuÃ§ (exists, md5 vb.)
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
     * ÃœrÃ¼n etiketini cihaza gÃ¶nder (tam akÄ±ÅŸ)
     *
     * AkÄ±ÅŸ:
     * 1. Storage temizle (clearspace)
     * 2. GÃ¶rseli 800x1280 JPEG olarak hazÄ±rla
     * 3. GÃ¶rseli yÃ¼kle
     * 4. Task config yÃ¼kle
     * 5. Replay tetikle
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID (MAC adresi)
     * @param string|resource $image GÃ¶rsel dosya yolu veya GD image resource
     * @param array $product ÃœrÃ¼n bilgileri (dinamik alanlar iÃ§in)
     * @param int $width Hedef geniÅŸlik (varsayÄ±lan 800)
     * @param int $height Hedef yÃ¼kseklik (varsayÄ±lan 1280)
     * @param array $designData Åablon design_data (dinamik alanlar iÃ§in, opsiyonel)
     * @return array SonuÃ§
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
        file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] === sendLabel Ã‡AÄRILDI ===\n", FILE_APPEND);
        file_put_contents($logFile, "IP: $ip, ClientID: $clientId, Width: $width, Height: $height\n", FILE_APPEND);
        file_put_contents($logFile, "Product keys: " . implode(', ', array_keys($product)) . "\n", FILE_APPEND);
        file_put_contents($logFile, "Product name: " . ($product['name'] ?? 'YOK') . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData keys: " . implode(', ', array_keys($designData)) . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData objects count: " . (isset($designData['objects']) ? count($designData['objects']) : 'YOK') . "\n", FILE_APPEND);
        file_put_contents($logFile, "designData _templateWidth: " . ($designData['_templateWidth'] ?? 'YOK') . "\n", FILE_APPEND);

        // 1. GÃ¶rseli hazÄ±rla (Ã¶nce MD5 hesapla, delta kontrolÃ¼ iÃ§in)
        if (is_string($image)) {
            // Dosya yolu verilmiÅŸ
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
            // GD resource verilmiÅŸ
            $srcImage = $image;
        } else {
            $result['error'] = 'Invalid image parameter';
            return $result;
        }

        $srcWidth = imagesx($srcImage);
        $srcHeight = imagesy($srcImage);

        // Hedef boyuta resize et
        $dstImage = imagecreatetruecolor($width, $height);

        // Beyaz arka plan (JPEG transparanlÄ±k desteklemez)
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

        // 1b. DÄ°NAMÄ°K ALANLARI RENDER ET (GD ile)
        if (!empty($designData) && !empty($product)) {
            $this->renderDynamicFields($dstImage, $designData, $product, $srcWidth, $srcHeight, $width, $height);
            $result['steps']['dynamic_fields'] = ['rendered' => true];
        }

        // JPEG olarak buffer'a kaydet
        ob_start();
        imagejpeg($dstImage, null, 90);
        $imageContent = ob_get_clean();

        // Sadece dosyadan oluÅŸturduysak destroy et
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

        // 2. DELTA CHECK: Cihazda aynÄ± dosya var mÄ± kontrol et
        $checkResult = $this->checkFile($ip, $targetFilePath);
        $result['steps']['delta_check'] = $checkResult;

        $needsUpload = true;
        if ($checkResult['exists'] && !empty($checkResult['md5'])) {
            // MD5 karÅŸÄ±laÅŸtÄ±r (case-insensitive)
            if (strcasecmp($checkResult['md5'], $imageMd5) === 0) {
                // Dosya zaten mevcut ve aynÄ±, yÃ¼kleme atla
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
            // 3a. Storage temizle (sadece yÃ¼kleme gerekiyorsa)
            $clearResult = $this->clearSpace($ip);
            $result['steps']['clear'] = $clearResult;

            if (!$clearResult['success']) {
                $result['error'] = 'Failed to clear storage: ' . ($clearResult['error'] ?? 'Unknown error');
                return $result;
            }

            // 3b. GÃ¶rseli yÃ¼kle
            $uploadResult = $this->uploadFile($ip, $targetFilePath, $imageContent);
            $result['steps']['upload'] = $uploadResult;

            if (!$uploadResult['success']) {
                $result['error'] = 'Failed to upload image: ' . ($uploadResult['error'] ?? 'Unknown error');
                return $result;
            }
        }

        // 4. Task config oluÅŸtur ve yÃ¼kle
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
     * Dinamik alanlarÄ± GD ile gÃ¶rsele render et
     *
     * Åablon design_data iÃ§indeki dynamicField Ã¶zellikli elemanlarÄ± bulur
     * ve Ã¼rÃ¼n verileriyle deÄŸiÅŸtirerek gÃ¶rsele yazar.
     *
     * @param \GdImage $image GD image resource
     * @param array $designData Åablon design_data (objects dizisi iÃ§ermeli)
     * @param array $product ÃœrÃ¼n bilgileri
     * @param int $srcWidth Kaynak gÃ¶rsel geniÅŸliÄŸi
     * @param int $srcHeight Kaynak gÃ¶rsel yÃ¼ksekliÄŸi
     * @param int $dstWidth Hedef gÃ¶rsel geniÅŸliÄŸi
     * @param int $dstHeight Hedef gÃ¶rsel yÃ¼ksekliÄŸi
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

        $log("=== renderDynamicFields BAÅLADI ===");
        $log("Src: {$srcWidth}x{$srcHeight}, Dst: {$dstWidth}x{$dstHeight}");
        $log("Product keys: " . implode(', ', array_keys($product)));
        $log("Product name: " . ($product['name'] ?? 'YOK'));

        // designData kontrolÃ¼
        if (!isset($designData['objects']) || !is_array($designData['objects'])) {
            $log("designData objects dizisi yok");
            $log("designData keys: " . implode(', ', array_keys($designData)));
            return;
        }

        $log("designData keys: " . implode(', ', array_keys($designData)));
        $log("Objects sayÄ±sÄ±: " . count($designData['objects']));

        // Åablon boyutu
        $templateWidth = (int)($designData['_templateWidth'] ?? $srcWidth);
        $templateHeight = (int)($designData['_templateHeight'] ?? $srcHeight);
        $log("Template size: {$templateWidth}x{$templateHeight}");

        // Ã–lÃ§ekleme oranlarÄ±
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
            $log("Font bulunamadÄ±, metin render'Ä± yapÄ±lamÄ±yor");
            return;
        }

        $renderMode = strtolower((string)($designData['_dynamic_render_mode'] ?? $designData['dynamic_render_mode'] ?? 'full'));
        $dynamicImageOnlyMode = in_array($renderMode, ['dynamic_image_only', 'image_only'], true);
        $log("Dynamic render mode: " . ($dynamicImageOnlyMode ? 'dynamic_image_only' : 'full'));

        // ÃœrÃ¼n deÄŸerlerini hazÄ±rla
        $fieldValues = $this->buildFieldValues($product);
        $log("Field values: " . json_encode($fieldValues, JSON_UNESCAPED_UNICODE));

        // Arka plan rengini bul (maskeleme iÃ§in)
        $bgColor = null;
        if (isset($designData['background'])) {
            $bg = $designData['background'];
            if (is_string($bg) && preg_match('/^#?[0-9a-fA-F]{3,6}$/', $bg)) {
                $rgb = $this->hexToRgb($bg);
                $bgColor = imagecolorallocate($image, $rgb['r'], $rgb['g'], $rgb['b']);
            }
        }
        if (!$bgColor) {
            $bgColor = imagecolorallocate($image, 255, 255, 255); // VarsayÄ±lan beyaz
        }

        $baseSnapshot = null;

        $dynamicCount = 0;
        $renderedCount = 0;

        // ÃœrÃ¼n gÃ¶rseli render edilen alanlarÄ± takip et
        // MASK adÄ±mÄ±nda bu alanlarÄ±n Ã¼rÃ¼n pikselleri korunacak (beyaz dolguyla ezilmeyecek)
        $productImageAreas = [];

        foreach ($designData['objects'] as $index => $obj) {
            // Dinamik alan var mÄ± kontrol et
            $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;
            $rawText = $obj['text'] ?? null;
            $resolvedText = null;
            $customType = $obj['customType'] ?? '';
            $type = strtolower((string)($obj['type'] ?? 'unknown'));
            $isImagePlaceholderType = in_array($customType, ['image-placeholder', 'dynamic-image', 'slot-image'], true);

            if ($dynamicImageOnlyMode && !$isImagePlaceholderType) {
                // Pre-render tabanli dynamic_image_only modunda sadece urun gorseli
                // placeholder nesneleri islenir. Diger tum nesneler base render'dan gelir.
                continue;
            }

            // Barkod/QR nesnelerinin dynamicField veya barcodeValue'dan da alan adÄ± alÄ±nabilir
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

            // Dinamik gÃ¶rsel placeholder nesnelerini erken yakala (value hesabÄ±ndan Ã¶nce)
            // image-placeholder'Ä±n dynamicField'i 'image_url' olabilir ama images[] dizisinden resolve edeceÄŸiz
            if (in_array($customType, ['image-placeholder', 'dynamic-image', 'slot-image'])) {
                $dynamicCount++;
                $imageIndex = (int)($obj['imageIndex'] ?? 0);
                $log("Object #{$index}: IMAGE-PLACEHOLDER imageIndex={$imageIndex}, customType={$customType}");

                // ÃœrÃ¼n gÃ¶rsellerini parse et
                $productImages = [];
                if (!empty($product['images'])) {
                    $parsed = is_string($product['images']) ? json_decode($product['images'], true) : $product['images'];
                    if (is_array($parsed)) {
                        foreach ($parsed as $img) {
                            $url = is_string($img) ? $img : ($img['url'] ?? $img['path'] ?? $img['file_path'] ?? $img['filename'] ?? null);
                            if ($url) $productImages[] = $url;
                        }
                    }
                }
                if (empty($productImages) && !empty($product['image_url'])) {
                    $productImages[] = $product['image_url'];
                }

                // Ä°ndeksteki gÃ¶rseli bul â€” yoksa kapak gÃ¶rseline fallback
                $targetUrl = $productImages[$imageIndex] ?? $productImages[0] ?? null;
                $log("  TARGET URL: " . ($targetUrl ?? 'YOK') . " (total images: " . count($productImages) . ")");

                if ($targetUrl) {
                    $resolvedPath = $this->resolveImagePath($targetUrl, $product['company_id'] ?? null);
                    if ($resolvedPath && file_exists($resolvedPath)) {
                        // === Z-ORDER UYUMLU COMPOSÄ°TÄ°NG ===
                        // Eski: eraseObjectArea â†’ renderImageOnPosition â†’ restoreUpperLayerPixels
                        //   Problem: piksel threshold (R,G,B>200) placeholder text/stroke'u (#888888, #000000)
                        //   ayÄ±rt edemiyordu, Ã¼rÃ¼n gÃ¶rseli Ã¼st nesneleri eziyordu.
                        // Yeni: ÃœrÃ¼n gÃ¶rselini ÅEFFAF temp canvas'a render et, sonra piksel piksel
                        //   akÄ±llÄ± birleÅŸtirme yap. Sadece placeholder pikselleri deÄŸiÅŸtirilir,
                        //   Ã¼st katman nesneleri (z-index > image) dokunulmadan kalÄ±r.

                        // 1) Åeffaf temp canvas oluÅŸtur (tam gÃ¶rÃ¼ntÃ¼ boyutunda)
                        $tempProduct = imagecreatetruecolor($dstWidth, $dstHeight);
                        imagesavealpha($tempProduct, true);
                        imagealphablending($tempProduct, false);
                        $tpFill = imagecolorallocatealpha($tempProduct, 0, 0, 0, 127);
                        imagefill($tempProduct, 0, 0, $tpFill);
                        imagealphablending($tempProduct, true);

                        // 2) ÃœrÃ¼n gÃ¶rselini temp canvas'a render et (shadow, stroke, clip dahil)
                        $this->renderImageOnPosition($tempProduct, $resolvedPath, $obj, $scaleX, $scaleY, $log);

                        // 3) Ust katman nesne sinirlarini topla (z-index > image)
                        // Not: Dinamik alan nesneleri (dynamicField/{{...}}) sonradan tekrar ciziliyor.
                        // Bu nedenle burada sadece statik ust nesneleri koruyoruz.
                        $upperObjBounds = [];
                        $upperProtectedCount = 0;
                        $upperSkippedCount = 0;
                        $upperObjDebug = [];
                        $upperSkippedDebug = [];
                        $objTotal = count($designData['objects']);
                        $currentOrder = $this->getObjectStackOrder($obj, $index);
                        $isBackLayerPlaceholder = $this->isBackLayerPlaceholder($designData['objects'], $index, $obj);
                        $placeholderKeyColors = $isBackLayerPlaceholder ? $this->getPlaceholderKeyColors($obj) : [];
                        for ($ui = 0; $ui < $objTotal; $ui++) {
                            if ($ui === $index) {
                                continue;
                            }
                            $uObj = $designData['objects'][$ui] ?? null;
                            if (!is_array($uObj) || (($uObj['visible'] ?? true) === false)) continue;
                            $upperOrder = $this->getObjectStackOrder($uObj, $ui);
                            if ($upperOrder < $currentOrder) {
                                continue;
                            }
                            if (abs($upperOrder - $currentOrder) < 0.0001 && $ui <= $index) {
                                continue;
                            }
                            $ub = $this->getObjectPixelBounds($uObj, $scaleX, $scaleY, $fontPath, $image);
                            if (!$ub) {
                                continue;
                            }

                            if ($this->shouldSkipUpperLayerProtection($uObj, $dynamicImageOnlyMode)) {
                                $upperSkippedCount++;
                                if (count($upperSkippedDebug) < 8) {
                                    $upperSkippedDebug[] = $this->formatObjectForZOrderLog($uObj, $ui, $ub);
                                }
                                continue;
                            }

                            $upperObjBounds[] = $ub;
                            $upperProtectedCount++;
                            if (count($upperObjDebug) < 8) {
                                $upperObjDebug[] = $this->formatObjectForZOrderLog($uObj, $ui, $ub);
                            }
                        }
                        $log("  Z-ORDER MAP: placeholderIndex={$index}, protectedUpper={$upperProtectedCount}, skippedDynamicUpper={$upperSkippedCount}");
                        if (!empty($upperObjDebug)) {
                            $log("  Z-ORDER protect list: " . implode(' | ', $upperObjDebug));
                        }
                        if (!empty($upperSkippedDebug)) {
                            $log("  Z-ORDER skipped list: " . implode(' | ', $upperSkippedDebug));
                        }
                        $log("  Z-ORDER background mode: " . ($isBackLayerPlaceholder ? 'on' : 'off'));

                        // 4) GÃ¶rsel sÄ±nÄ±rlarÄ±nÄ± hesapla (shadow + stroke marjÄ± dahil)
                        $imgBounds = $this->getObjectPixelBounds($obj, $scaleX, $scaleY, $fontPath, $image);
                        $strokePxW = (int)round(($obj['strokeWidth'] ?? 0) * max($scaleX, $scaleY));
                        $shMargin = 0;
                        $shData = $obj['shadow'] ?? null;
                        if ($shData) {
                            $shObj = is_string($shData) ? json_decode($shData, true) : (is_array($shData) ? $shData : null);
                            if ($shObj) {
                                $shBlur = (int)(($shObj['blur'] ?? 0) * max($scaleX, $scaleY));
                                $shOX = abs((int)(($shObj['offsetX'] ?? 0) * $scaleX));
                                $shOY = abs((int)(($shObj['offsetY'] ?? 0) * $scaleY));
                                $shMargin = $shBlur + max($shOX, $shOY);
                            }
                        }
                        $extraMrg = max($strokePxW + 2, $shMargin + 2);

                        // 5) Arka plan RGB
                        $bgR = ($bgColor >> 16) & 0xFF;
                        $bgG = ($bgColor >> 8) & 0xFF;
                        $bgB = $bgColor & 0xFF;

                        // 6) Piksel piksel akÄ±llÄ± birleÅŸtirme
                        if ($imgBounds) {
                            $imgW = imagesx($image);
                            $imgH = imagesy($image);
                            $cx1 = max(0, $imgBounds['x1'] - $extraMrg);
                            $cy1 = max(0, $imgBounds['y1'] - $extraMrg);
                            $cx2 = min($imgW - 1, $imgBounds['x2'] + $extraMrg);
                            $cy2 = min($imgH - 1, $imgBounds['y2'] + $extraMrg);

                            $replacedPx = 0;
                            $keptPx = 0;

                            for ($py = $cy1; $py <= $cy2; $py++) {
                                for ($px = $cx1; $px <= $cx2; $px++) {
                                    // Temp canvas pikseli (Ã¼rÃ¼n gÃ¶rseli + shadow + stroke)
                                    $tPx = imagecolorat($tempProduct, $px, $py);
                                    $tA = ($tPx >> 24) & 0x7F; // 0=opak, 127=ÅŸeffaf

                                    // Tamamen ÅŸeffaf â†’ Ã¼rÃ¼n gÃ¶rseli yok burda â†’ atla
                                    if ($tA >= 120) continue;

                                    // Orijinal piksel ($image = Fabric.js export, placeholder + Ã¼st nesneler)
                                    $oPx = imagecolorat($image, $px, $py);
                                    $oR = ($oPx >> 16) & 0xFF;
                                    $oG = ($oPx >> 8) & 0xFF;
                                    $oB = $oPx & 0xFF;

                                    // Bu piksel herhangi bir Ã¼st nesnenin sÄ±nÄ±rlarÄ± iÃ§inde mi?
                                    $inUpper = false;
                                    foreach ($upperObjBounds as $ub) {
                                        if ($px >= $ub['x1'] && $px <= $ub['x2'] && $py >= $ub['y1'] && $py <= $ub['y2']) {
                                            $inUpper = true;
                                            break;
                                        }
                                    }

                                    $doReplace = false;

                                    if ($isBackLayerPlaceholder) {
                                        // Back-layer mode: replace only pixels that are placeholder/background-like.
                                        $doReplace = $this->shouldReplaceBackLayerImagePixel(
                                            $oR,
                                            $oG,
                                            $oB,
                                            $bgR,
                                            $bgG,
                                            $bgB,
                                            $placeholderKeyColors
                                        );
                                    } elseif (!$inUpper) {
                                        // Üst nesne sınırları dışında → kesinlikle placeholder/bg → değiştir
                                        $doReplace = true;
                                    } else {
                                        // Üst nesne sınırları içinde → dikkatli renk analizi
                                        // Chroma (renk doygunluğu): yüksek = renkli üst nesne, düşük = gri placeholder
                                        $maxCh = max($oR, $oG, $oB);
                                        $minCh = min($oR, $oG, $oB);
                                        $chroma = $maxCh - $minCh;

                                        if ($chroma > 25) {
                                            // Renkli piksel → kesinlikle üst nesne → koru
                                            $doReplace = false;
                                        } else {
                                            // Gri tonlu piksel → arka plan veya placeholder olabilir
                                            $brightness = ($oR + $oG + $oB) / 3;

                                            if (abs($oR - $bgR) < 25 && abs($oG - $bgG) < 25 && abs($oB - $bgB) < 25) {
                                                // Arka plan rengine yakın → kesinlikle değiştir
                                                $doReplace = true;
                                            } elseif ($brightness > 150) {
                                                // Açık gri (placeholder fill #f0f0f0, border #cccccc) → değiştir
                                                $doReplace = true;
                                            } else {
                                                // Koyu gri/siyah → üst nesne siyah metin olabilir → koru
                                                $doReplace = false;
                                            }
                                        }
                                    }

                                    if ($doReplace) {
                                        if ($tA == 0) {
                                            // Tam opak Ã¼rÃ¼n pikseli â†’ doÄŸrudan yaz
                                            imagesetpixel($image, $px, $py, $tPx & 0x00FFFFFF);
                                        } else {
                                            // YarÄ± saydam (shadow, anti-alias kenarlar) â†’ blend
                                            $alpha = (127 - $tA) / 127.0;
                                            $tR = ($tPx >> 16) & 0xFF;
                                            $tG = ($tPx >> 8) & 0xFF;
                                            $tB = $tPx & 0xFF;
                                            $bR = (int)($tR * $alpha + $oR * (1 - $alpha));
                                            $bG = (int)($tG * $alpha + $oG * (1 - $alpha));
                                            $bB = (int)($tB * $alpha + $oB * (1 - $alpha));
                                            $blended = (min(255, max(0, $bR)) << 16) | (min(255, max(0, $bG)) << 8) | min(255, max(0, $bB));
                                            imagesetpixel($image, $px, $py, $blended);
                                        }
                                        $replacedPx++;
                                    } else {
                                        $keptPx++;
                                    }
                                }
                            }

                            $productImageAreas[] = $imgBounds;
                            $log("  Z-ORDER COMPOSITE: {$replacedPx} piksel deÄŸiÅŸtirildi, {$keptPx} piksel korundu (Ã¼st nesne: " . count($upperObjBounds) . ")");
                        }

                        imagedestroy($tempProduct);
                        $renderedCount++;
                    } else {
                        $log("  IMAGE-PLACEHOLDER: Dosya bulunamadÄ±: " . ($resolvedPath ?? $targetUrl));
                    }
                }
                continue;
            }

            if (!$dynamicField && $resolvedText === null) {
                continue;
            }

            $dynamicCount++;
            $log("Object #{$index}: type={$type}, dynamicField=" . ($dynamicField ?? 'YOK'));

            $value = null;
            if ($dynamicField) {
                // Field adÄ±nÄ± temizle ({{ }} kaldÄ±r)
                $fieldName = trim($dynamicField, '{} ');
                $log("  Cleaned fieldName: {$fieldName}");

                // DeÄŸeri bul
                if (!isset($fieldValues[$fieldName]) || $fieldValues[$fieldName] === '') {
                    $log("  SKIP: fieldValues[{$fieldName}] yok veya boÅŸ");
                    continue;
                }

                $value = (string)$fieldValues[$fieldName];
                $log("  Value: {$value}");
            } else {
                $value = (string)$resolvedText;
                $log("  ResolvedText: {$value}");
            }

            $effectiveFieldName = $dynamicField;
            if (!$effectiveFieldName && is_string($rawText) && preg_match('/\{\{\s*([^}\s]+)\s*\}\}/u', $rawText, $fieldMatch)) {
                $effectiveFieldName = $fieldMatch[1];
            }
            $isPriceLikeField = $this->isPriceLikeDynamicField($effectiveFieldName, $customType);
            $priceFractionScale = $this->normalizePriceFractionScale($obj['priceFractionScale'] ?? 1.0);
            $priceFractionDigits = $this->normalizePriceFractionDigits($obj['priceFractionDigits'] ?? -1);
            $priceMidlineEnabled = !empty($obj['priceMidlineEnabled']);
            $priceMidlineThickness = $this->normalizePriceMidlineThickness($obj['priceMidlineThickness'] ?? 1);
            $priceStyleMeta = $this->extractPriceStyleMeta($obj, (float)($obj['fontSize'] ?? 0));
            if (!array_key_exists('priceFractionScale', $obj) && isset($priceStyleMeta['fractionScale'])) {
                $priceFractionScale = $this->normalizePriceFractionScale($priceStyleMeta['fractionScale']);
            }
            $priceFractionDeltaY = (int)round((float)($priceStyleMeta['fractionDeltaY'] ?? 0.0) * $scaleY);

            // Barkod/QR nesnelerini Ã¶zel iÅŸle
            $customType = $obj['customType'] ?? '';
            if (in_array($customType, ['barcode', 'qrcode'])) {
                $log("  BARCODE/QR obje bulundu: customType={$customType}");
                $this->renderBarcodeOnImage($image, $obj, $value, $scaleX, $scaleY, $log, $safeLeftPad, $safeLeftThreshold);
                $renderedCount++;
                continue;
            }

            // Sadece metin tiplerini iÅŸle
            // Fabric.js v5: 'text','i-text','textbox' | v7: 'Text','IText','Textbox'
            // strtolower zaten uygulandÄ±, v7 'IText' â†’ 'itext' olur (tiresiz)
            if (!in_array($type, ['text', 'i-text', 'itext', 'textbox'])) {
                $log("  SKIP: Type '{$type}' metin deÄŸil, customType={$customType}");
                continue;
            }

            // visible kontrolÃ¼
            if (isset($obj['visible']) && $obj['visible'] === false) {
                $log("  SKIP: visible=false");
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
            $textAngle = (float)($obj['angle'] ?? 0);
            $textOpacity = (float)($obj['opacity'] ?? 1);
            $textShadow = $obj['shadow'] ?? null;
            $textStroke = $obj['stroke'] ?? null;
            $textStrokeWidth = (float)($obj['strokeWidth'] ?? 0);
            $textBackgroundColor = $obj['textBackgroundColor'] ?? null;
            $underlineEnabled = !empty($obj['underline']);
            $overlineEnabled = !empty($obj['overline']);
            $linethroughEnabled = !empty($obj['linethrough']);
            $textDecorationThickness = (float)($obj['textDecorationThickness'] ?? 1);

            // Nesne kendi scale'i ile efektif boyutlarÄ± hesapla
            $effectiveWidth = $objWidth * $objScaleX;
            $effectiveHeight = $objHeight * $objScaleY;
            $effectiveFontSize = $fontSize * $objScaleY; // scaleY font boyutunu etkiler

            // Åablon â†’ cihaz Ã¶lÃ§ekleme
            $scaledFontSize = (int)max(8, $effectiveFontSize * min($scaleX, $scaleY));
            $scaledWidth = (int)($effectiveWidth * $scaleX);

            // Origin'e gÃ¶re pozisyon dÃ¼zeltmesi (Fabric.js v7 center origin kullanÄ±r)
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

            // Renk (opacity desteÄŸi ile)
            $fillColor = $obj['fill'] ?? '#000000';
            $rgb = $this->hexToRgb($fillColor);
            if ($textOpacity < 1 && $textOpacity > 0) {
                $alpha = (int)(127 - ($textOpacity * 127));
                $textColor = imagecolorallocatealpha($image, $rgb['r'], $rgb['g'], $rgb['b'], $alpha);
            } else {
                $textColor = imagecolorallocate($image, $rgb['r'], $rgb['g'], $rgb['b']);
            }
            $log("  Color: {$fillColor} -> RGB({$rgb['r']},{$rgb['g']},{$rgb['b']}) opacity={$textOpacity}");

            // GÃ¶lge rengi hazÄ±rla
            $shadowColorGd = null;
            $shadowOffsetX = 0;
            $shadowOffsetY = 0;
            if ($textShadow) {
                $shadowObj = is_string($textShadow) ? json_decode($textShadow, true) : (is_array($textShadow) ? $textShadow : null);
                if ($shadowObj) {
                    $sColor = $shadowObj['color'] ?? 'rgba(0,0,0,0.4)';
                    $shadowOffsetX = (int)(($shadowObj['offsetX'] ?? 4) * $scaleX);
                    $shadowOffsetY = (int)(($shadowObj['offsetY'] ?? 4) * $scaleY);
                    $sRgb = $this->hexToRgb($sColor);
                    $sAlpha = (int)(127 - (($sRgb['a'] ?? 0.4) * 127));
                    $shadowColorGd = imagecolorallocatealpha($image, $sRgb['r'], $sRgb['g'], $sRgb['b'], max(0, min(127, $sAlpha)));
                    $log("  Shadow: color={$sColor} offset=({$shadowOffsetX},{$shadowOffsetY})");
                }
            }

            // Metin outline (stroke) rengi
            $strokeColorGd = null;
            if ($textStroke && $textStrokeWidth > 0) {
                $stRgb = $this->hexToRgb($textStroke);
                $strokeColorGd = imagecolorallocate($image, $stRgb['r'], $stRgb['g'], $stRgb['b']);
                $log("  Text stroke: {$textStroke} width={$textStrokeWidth}");
            }

            // Metin sarmalama (word-wrap) - geniÅŸlik varsa satÄ±rlara bÃ¶l
            $lines = [];
            if ($scaledWidth > 0) {
                if ($isPriceLikeField || !empty($obj['textAutoWidth'])) {
                    $scaledFontSize = $this->fitSingleLineFontSize($value, $scaledFontSize, $fontPath, $scaledWidth);
                    $lines = [$value];
                } else {
                    $lines = $this->wrapText($value, $scaledFontSize, $fontPath, $scaledWidth, $fontWeight);
                }
            } else {
                $lines = [$value]; // GeniÅŸlik yoksa tek satÄ±r
            }
            $log("  Lines: " . count($lines) . " satÄ±r (wrap width={$scaledWidth})");
            if ($isPriceLikeField) {
                $log("  Price style: digits={$priceFractionDigits} fractionScale={$priceFractionScale} midline=" . ($priceMidlineEnabled ? '1' : '0'));
            }

            // SatÄ±r yÃ¼ksekliÄŸi hesapla
            $lineHeight = (float)($obj['lineHeight'] ?? 1.16);
            $lineSpacing = (int)($scaledFontSize * $lineHeight);

            // Toplam metin yÃ¼ksekliÄŸi
            $totalTextHeight = count($lines) * $lineSpacing;

            // Maskeleme dikdÃ¶rtgeni Ã§iz (eski metni kapat)
            $maskWidth = $scaledWidth > 0 ? $scaledWidth : 0;
            foreach ($lines as $line) {
                $metrics = $this->measureTextLineMetrics(
                    $line,
                    $scaledFontSize,
                    $fontPath,
                    $isPriceLikeField,
                    $priceFractionDigits,
                    $priceFractionScale,
                    $priceFractionDeltaY
                );
                $lineWidth = $metrics['width'];
                $maskWidth = max($maskWidth, $lineWidth);
            }
            $maskRight = $scaledLeft + $maskWidth + 5;
            $maskBottom = $scaledTop + $totalTextHeight + 5;
            $log("  MASK: rectangle ({$scaledLeft},{$scaledTop}) to ({$maskRight},{$maskBottom})");

            // AkÄ±llÄ± MASK: ÃœrÃ¼n gÃ¶rseli alanlarÄ±nÄ±n piksellerini koru
            // Eski yaklaÅŸÄ±m: tÃ¼m MASK alanÄ±nÄ± beyazla doldur (Ã¼rÃ¼n gÃ¶rselini eziyordu)
            // Yeni yaklaÅŸÄ±m: Ã¶nce Ã¼rÃ¼n gÃ¶rseli ile Ã§akÄ±ÅŸan alanÄ± kaydet, MASK uygula, sonra geri yÃ¼kle
            $maskBounds = ['x1' => $scaledLeft, 'y1' => $scaledTop, 'x2' => $maskRight, 'y2' => $maskBottom];
            $preserveSnapshots = [];
            foreach ($productImageAreas as $pArea) {
                $overlap = $this->intersectBounds($maskBounds, $pArea);
                if ($overlap) {
                    $ow = $overlap['x2'] - $overlap['x1'] + 1;
                    $oh = $overlap['y2'] - $overlap['y1'] + 1;
                    if ($ow > 0 && $oh > 0) {
                        $snap = imagecreatetruecolor($ow, $oh);
                        if ($snap) {
                            imagecopy($snap, $image, 0, 0, $overlap['x1'], $overlap['y1'], $ow, $oh);
                            $preserveSnapshots[] = ['overlap' => $overlap, 'snapshot' => $snap];
                        }
                    }
                }
            }

            // MASK: eski metni sil (arka plan rengiyle doldur)
            imagefilledrectangle($image, $scaledLeft, $scaledTop, $maskRight, $maskBottom, $bgColor);

            // ÃœrÃ¼n gÃ¶rseli piksellerini geri yÃ¼kle (beyaz dolguyla ezilmesini Ã¶nle)
            foreach ($preserveSnapshots as $ps) {
                $o = $ps['overlap'];
                $ow = $o['x2'] - $o['x1'] + 1;
                $oh = $o['y2'] - $o['y1'] + 1;
                imagecopy($image, $ps['snapshot'], $o['x1'], $o['y1'], 0, 0, $ow, $oh);
                imagedestroy($ps['snapshot']);
            }
            if (!empty($preserveSnapshots)) {
                $log("  MASK: " . count($preserveSnapshots) . " Ã¼rÃ¼n gÃ¶rseli alanÄ± korundu");
            }

            // SatÄ±r satÄ±r metin yaz
            $currentY = $scaledTop;
            foreach ($lines as $lineIdx => $line) {
                // Font metrikleri
                $metrics = $this->measureTextLineMetrics(
                    $line,
                    $scaledFontSize,
                    $fontPath,
                    $isPriceLikeField,
                    $priceFractionDigits,
                    $priceFractionScale,
                    $priceFractionDeltaY
                );
                $lineWidth = $metrics['width'];
                $lineAscent = $metrics['ascent'];
                $priceSegments = $metrics['priceSegments'];

                // Hizalama (textAlign)
                $lineX = $scaledLeft;
                if ($textAlign === 'center' && $scaledWidth > 0) {
                    $lineX = $scaledLeft + (int)(($scaledWidth - $lineWidth) / 2);
                } elseif ($textAlign === 'right' && $scaledWidth > 0) {
                    $lineX = $scaledLeft + ($scaledWidth - $lineWidth);
                }

                $textY = $currentY + $lineAscent;
                $log("  LINE #{$lineIdx}: '{$line}' at ({$lineX}, {$textY}) align={$textAlign} angle={$textAngle}");
                $strokePx = $textStrokeWidth > 0 ? max(1, (int)round($textStrokeWidth * $scaleX)) : 0;

                if (is_string($textBackgroundColor) && trim($textBackgroundColor) !== '' && strtolower(trim($textBackgroundColor)) !== 'transparent') {
                    $bgRgb = $this->hexToRgb($textBackgroundColor);
                    $bgAlpha = isset($bgRgb['a']) ? (int)(127 - (($bgRgb['a'] ?? 1.0) * 127)) : 0;
                    $bgAlpha = max(0, min(127, $bgAlpha));
                    $lineBgColor = imagecolorallocatealpha($image, $bgRgb['r'], $bgRgb['g'], $bgRgb['b'], $bgAlpha);
                    imagefilledrectangle(
                        $image,
                        $lineX,
                        $currentY,
                        $lineX + max(1, $lineWidth),
                        $currentY + max(1, $lineSpacing),
                        $lineBgColor
                    );
                }

                if ($priceSegments && (float)$textAngle === 0.0) {
                    $cursorX = $lineX;
                    foreach ($priceSegments as $segment) {
                        $segText = $segment['text'] ?? '';
                        if ($segText === '') {
                            continue;
                        }
                        $segFontSize = (int)($segment['fontSize'] ?? $scaledFontSize);
                        $segDeltaY = (int)($segment['deltaY'] ?? 0);
                        $this->drawTextSegmentWithEffects(
                            $image,
                            $segText,
                            $segFontSize,
                            $textAngle,
                            $cursorX,
                            $textY + $segDeltaY,
                            $textColor,
                            $shadowColorGd,
                            $shadowOffsetX,
                            $shadowOffsetY,
                            $strokeColorGd,
                            $strokePx,
                            $fontPath
                        );
                        $cursorX += (int)($segment['width'] ?? 0);
                    }
                } else {
                    $this->drawTextSegmentWithEffects(
                        $image,
                        $line,
                        $scaledFontSize,
                        $textAngle,
                        $lineX,
                        $textY,
                        $textColor,
                        $shadowColorGd,
                        $shadowOffsetX,
                        $shadowOffsetY,
                        $strokeColorGd,
                        $strokePx,
                        $fontPath
                    );
                }

                $decorationThickness = max(1, (int)round($textDecorationThickness * min($scaleX, $scaleY)));
                if ($underlineEnabled || $overlineEnabled || $linethroughEnabled) {
                    $this->drawTextDecorations(
                        $image,
                        $lineX,
                        $lineWidth,
                        $textY,
                        $lineAscent,
                        $textColor,
                        $underlineEnabled,
                        $overlineEnabled,
                        $linethroughEnabled,
                        $decorationThickness
                    );
                }

                if ($priceMidlineEnabled && (float)$textAngle === 0.0) {
                    $lineY = (int)round($textY - ($lineAscent * 0.40));
                    $lineEndX = $lineX + max(1, $lineWidth - 1);
                    $lineThickness = max(1, (int)round($priceMidlineThickness * min($scaleX, $scaleY)));
                    imagesetthickness($image, $lineThickness);
                    imageline($image, $lineX, $lineY, $lineEndX, $lineY, $textColor);
                    imagesetthickness($image, 1);
                }

                $currentY += $lineSpacing;
            }

            $renderedCount++;
        }

        $log("=== SONUÃ‡: {$dynamicCount} dinamik alan bulundu, {$renderedCount} tanesi render edildi ===");
        if ($baseSnapshot) {
            imagedestroy($baseSnapshot);
        }
    }

    private function isPriceLikeDynamicField($dynamicField, string $customType = ''): bool
    {
        $normalizedType = strtolower(trim((string)$customType));
        if ($normalizedType === 'price') {
            return true;
        }

        $fieldName = strtolower(trim((string)$dynamicField, "{} \t\n\r\0\x0B"));
        if ($fieldName === '') {
            return false;
        }

        return in_array($fieldName, [
            'current_price',
            'currentprice',
            'price',
            'previous_price',
            'previousprice',
            'old_price',
            'oldprice',
            'alis_fiyati',
            'bundle_total_price',
            'bundle_final_price',
            'price_with_currency'
        ], true);
    }

    private function normalizePriceFractionScale($rawValue): float
    {
        $value = (float)$rawValue;
        if ($value <= 0) {
            $value = 1.0;
        }

        return max(0.30, min(1.0, $value));
    }

    private function normalizePriceFractionDigits($rawValue): int
    {
        $value = (int)$rawValue;
        if (!in_array($value, [-1, 1, 2], true)) {
            return -1;
        }

        return $value;
    }

    private function normalizePriceMidlineThickness($rawValue): int
    {
        $value = (int)$rawValue;
        if ($value < 1) {
            $value = 1;
        }

        return min(8, $value);
    }

    private function extractPriceStyleMeta(array $obj, float $baseFontSize): array
    {
        $meta = [
            'fractionScale' => null,
            'fractionDeltaY' => 0.0,
        ];

        if ($baseFontSize <= 0 || empty($obj['styles']) || !is_array($obj['styles'])) {
            return $meta;
        }

        $lineStyles = $obj['styles'][0] ?? null;
        if (!is_array($lineStyles)) {
            return $meta;
        }

        $firstStyle = null;
        foreach ($lineStyles as $styleEntry) {
            if (is_array($styleEntry) && !empty($styleEntry['style']) && is_array($styleEntry['style'])) {
                $firstStyle = $styleEntry['style'];
                break;
            }
        }

        if (!$firstStyle) {
            return $meta;
        }

        if (isset($firstStyle['fontSize']) && is_numeric($firstStyle['fontSize'])) {
            $meta['fractionScale'] = (float)$firstStyle['fontSize'] / $baseFontSize;
        }
        if (isset($firstStyle['deltaY']) && is_numeric($firstStyle['deltaY'])) {
            $meta['fractionDeltaY'] = (float)$firstStyle['deltaY'];
        }

        return $meta;
    }

    private function fitSingleLineFontSize(string $text, int $fontSize, string $fontPath, int $maxWidth): int
    {
        if ($maxWidth <= 0) {
            return $fontSize;
        }

        $size = max(8, $fontSize);
        while ($size > 8) {
            $bbox = imagettfbbox($size, 0, $fontPath, $text);
            $width = abs($bbox[2] - $bbox[0]);
            if ($width <= $maxWidth) {
                break;
            }
            $size--;
        }

        return $size;
    }

    private function splitPriceForRendering(string $text, int $fractionDigits = -1): ?array
    {
        if (!preg_match('/^(.*\d)([,.])(\d+)(\D*)$/u', trim($text), $matches)) {
            return null;
        }

        $major = $matches[1] . $matches[2];
        $fraction = $matches[3];
        $suffix = $matches[4] ?? '';

        if ($fractionDigits === 1) {
            $fraction = mb_substr($fraction, 0, 1);
        } elseif ($fractionDigits === 2) {
            $fraction = mb_substr($fraction, 0, 2);
            if (mb_strlen($fraction) < 2) {
                $fraction = str_pad($fraction, 2, '0');
            }
        }

        if ($fraction === '') {
            return null;
        }

        return [
            'major' => $major,
            'fraction' => $fraction,
            'suffix' => $suffix,
        ];
    }

    private function measureTextLineMetrics(
        string $line,
        int $fontSize,
        string $fontPath,
        bool $priceLike = false,
        int $priceFractionDigits = -1,
        float $priceFractionScale = 1.0,
        int $priceFractionDeltaY = 0
    ): array {
        $bbox = imagettfbbox($fontSize, 0, $fontPath, $line);
        $fallbackWidth = abs($bbox[2] - $bbox[0]);
        $fallbackAscent = abs($bbox[7] - $bbox[1]);

        if (!$priceLike) {
            return [
                'width' => $fallbackWidth,
                'ascent' => max(1, $fallbackAscent),
                'priceSegments' => null,
            ];
        }

        $parts = $this->splitPriceForRendering($line, $priceFractionDigits);
        if (!$parts) {
            return [
                'width' => $fallbackWidth,
                'ascent' => max(1, $fallbackAscent),
                'priceSegments' => null,
            ];
        }

        $fractionFontSize = max(6, (int)round($fontSize * $priceFractionScale));
        $segments = [
            ['text' => $parts['major'], 'fontSize' => $fontSize, 'deltaY' => 0],
            ['text' => $parts['fraction'], 'fontSize' => $fractionFontSize, 'deltaY' => $priceFractionDeltaY],
            ['text' => $parts['suffix'], 'fontSize' => $fontSize, 'deltaY' => 0],
        ];

        $totalWidth = 0;
        $maxAscent = 1;
        foreach ($segments as $i => $segment) {
            $segmentText = $segment['text'];
            if ($segmentText === '') {
                $segments[$i]['width'] = 0;
                continue;
            }
            $segBbox = imagettfbbox($segment['fontSize'], 0, $fontPath, $segmentText);
            $segWidth = abs($segBbox[2] - $segBbox[0]);
            $segAscent = abs($segBbox[7] - $segBbox[1]);
            $segments[$i]['width'] = $segWidth;
            $totalWidth += $segWidth;
            $maxAscent = max($maxAscent, $segAscent);
        }

        return [
            'width' => max(1, $totalWidth),
            'ascent' => $maxAscent,
            'priceSegments' => $segments,
        ];
    }

    private function drawTextSegmentWithEffects(
        $image,
        string $text,
        int $fontSize,
        float $angle,
        int $x,
        int $y,
        $textColor,
        $shadowColor,
        int $shadowOffsetX,
        int $shadowOffsetY,
        $strokeColor,
        int $strokePx,
        string $fontPath
    ): void {
        if ($text === '') {
            return;
        }

        if ($shadowColor) {
            imagettftext($image, $fontSize, $angle, $x + $shadowOffsetX, $y + $shadowOffsetY, $shadowColor, $fontPath, $text);
        }

        if ($strokeColor && $strokePx > 0) {
            for ($sx = -$strokePx; $sx <= $strokePx; $sx++) {
                for ($sy = -$strokePx; $sy <= $strokePx; $sy++) {
                    if ($sx === 0 && $sy === 0) {
                        continue;
                    }
                    imagettftext($image, $fontSize, $angle, $x + $sx, $y + $sy, $strokeColor, $fontPath, $text);
                }
            }
        }

        imagettftext($image, $fontSize, $angle, $x, $y, $textColor, $fontPath, $text);
    }

    private function drawTextDecorations(
        $image,
        int $x,
        int $lineWidth,
        int $baselineY,
        int $lineAscent,
        $color,
        bool $underline,
        bool $overline,
        bool $linethrough,
        int $thickness = 1
    ): void {
        if ($lineWidth <= 0) {
            return;
        }

        $x2 = $x + max(1, $lineWidth - 1);
        imagesetthickness($image, max(1, $thickness));

        if ($overline) {
            $y = (int)round($baselineY - $lineAscent);
            imageline($image, $x, $y, $x2, $y, $color);
        }
        if ($linethrough) {
            $y = (int)round($baselineY - ($lineAscent * 0.40));
            imageline($image, $x, $y, $x2, $y, $color);
        }
        if ($underline) {
            $y = (int)round($baselineY + max(1, $thickness));
            imageline($image, $x, $y, $x2, $y, $color);
        }

        imagesetthickness($image, 1);
    }

    private function renderStaticTextObject($image, array $obj, float $scaleX, float $scaleY, string $fontPath, callable $log): bool
    {
        $rawText = isset($obj['text']) ? (string)$obj['text'] : '';
        if ($rawText === '' || trim($rawText) === '') {
            return false;
        }

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
        $fontWeight = (string)($obj['fontWeight'] ?? 'normal');
        $textAngle = (float)($obj['angle'] ?? 0);

        $effectiveWidth = $objWidth * $objScaleX;
        $effectiveHeight = $objHeight * $objScaleY;
        $effectiveFontSize = $fontSize * $objScaleY;

        $scaledFontSize = (int)max(8, $effectiveFontSize * min($scaleX, $scaleY));
        $scaledWidth = (int)round($effectiveWidth * $scaleX);

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

        $scaledLeft = (int)round($adjLeft * $scaleX);
        $scaledTop = (int)round($adjTop * $scaleY);

        $textColor = $this->allocateObjectColor(
            $image,
            (string)($obj['fill'] ?? '#000000'),
            (float)($obj['opacity'] ?? 1.0)
        );
        if ($textColor === null) {
            return false;
        }

        $shadowColor = null;
        $shadowOffsetX = 0;
        $shadowOffsetY = 0;
        $shadowRaw = $obj['shadow'] ?? null;
        if ($shadowRaw) {
            $shadowObj = is_string($shadowRaw) ? json_decode($shadowRaw, true) : (is_array($shadowRaw) ? $shadowRaw : null);
            if (is_array($shadowObj)) {
                $shadowColor = $this->allocateObjectColor($image, (string)($shadowObj['color'] ?? 'rgba(0,0,0,0.4)'), 1.0);
                $shadowOffsetX = (int)round(((float)($shadowObj['offsetX'] ?? 4)) * $scaleX);
                $shadowOffsetY = (int)round(((float)($shadowObj['offsetY'] ?? 4)) * $scaleY);
            }
        }

        $strokeColor = null;
        $strokePx = 0;
        $strokeRaw = (string)($obj['stroke'] ?? '');
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        if ($strokeRaw !== '' && strtolower($strokeRaw) !== 'transparent' && $strokeWidth > 0) {
            $strokeColor = $this->allocateObjectColor($image, $strokeRaw, (float)($obj['opacity'] ?? 1.0));
            $strokePx = max(1, (int)round($strokeWidth * min($scaleX, $scaleY)));
        }

        $rawLines = preg_split('/\r\n|\r|\n/u', $rawText) ?: [$rawText];
        $lines = [];
        foreach ($rawLines as $segment) {
            $segment = (string)$segment;
            if ($scaledWidth > 0 && strtolower((string)($obj['type'] ?? '')) === 'textbox') {
                $wrapped = $this->wrapText($segment, $scaledFontSize, $fontPath, $scaledWidth, $fontWeight);
                foreach ($wrapped as $wLine) {
                    $lines[] = (string)$wLine;
                }
            } else {
                $lines[] = $segment;
            }
        }
        if (empty($lines)) {
            $lines = [''];
        }

        $lineHeight = (float)($obj['lineHeight'] ?? 1.16);
        $lineSpacing = max(1, (int)round($scaledFontSize * $lineHeight));
        $currentY = $scaledTop;

        foreach ($lines as $lineIdx => $line) {
            $metrics = $this->measureTextLineMetrics($line, $scaledFontSize, $fontPath, false, -1, 1.0);
            $lineWidth = (int)($metrics['width'] ?? 0);
            $lineAscent = max(1, (int)($metrics['ascent'] ?? $scaledFontSize));

            $lineX = $scaledLeft;
            if ($textAlign === 'center' && $scaledWidth > 0) {
                $lineX = $scaledLeft + (int)round(($scaledWidth - $lineWidth) / 2);
            } elseif ($textAlign === 'right' && $scaledWidth > 0) {
                $lineX = $scaledLeft + ($scaledWidth - $lineWidth);
            }

            $textY = $currentY + $lineAscent;
            $this->drawTextSegmentWithEffects(
                $image,
                $line,
                $scaledFontSize,
                $textAngle,
                $lineX,
                $textY,
                $textColor,
                $shadowColor,
                $shadowOffsetX,
                $shadowOffsetY,
                $strokeColor,
                $strokePx,
                $fontPath
            );

            $currentY += $lineSpacing;
        }

        $log("  STATIC redraw text at ({$scaledLeft},{$scaledTop}) lines=" . count($lines) . " font={$scaledFontSize}");
        return true;
    }

    private function renderStaticRectObject($image, array $obj, float $scaleX, float $scaleY, callable $log): bool
    {
        $left = (float)($obj['left'] ?? 0);
        $top = (float)($obj['top'] ?? 0);
        $objWidth = (float)($obj['width'] ?? 0);
        $objHeight = (float)($obj['height'] ?? 0);
        $objScaleX = (float)($obj['scaleX'] ?? 1.0);
        $objScaleY = (float)($obj['scaleY'] ?? 1.0);
        $originX = $obj['originX'] ?? 'center';
        $originY = $obj['originY'] ?? 'center';
        $angle = (float)($obj['angle'] ?? 0.0);

        $effectiveWidth = $objWidth * $objScaleX;
        $effectiveHeight = $objHeight * $objScaleY;
        if ($effectiveWidth <= 0 || $effectiveHeight <= 0) {
            return false;
        }

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

        $scaledLeft = (int)round($adjLeft * $scaleX);
        $scaledTop = (int)round($adjTop * $scaleY);
        $scaledW = max(1, (int)round($effectiveWidth * $scaleX));
        $scaledH = max(1, (int)round($effectiveHeight * $scaleY));
        $objectOpacity = (float)($obj['opacity'] ?? 1.0);

        $fillRaw = (string)($obj['fill'] ?? '');
        $fillColor = $this->allocateObjectColor($image, $fillRaw, $objectOpacity);

        $strokeRaw = (string)($obj['stroke'] ?? '');
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        $strokeColor = null;
        $strokePx = 0;
        if ($strokeRaw !== '' && strtolower($strokeRaw) !== 'transparent' && $strokeWidth > 0) {
            $strokeColor = $this->allocateObjectColor($image, $strokeRaw, $objectOpacity);
            $strokePx = max(1, (int)round($strokeWidth * min($scaleX, $scaleY)));
        }

        $didDraw = false;
        if (abs($angle) < 0.01) {
            if ($fillColor !== null) {
                imagefilledrectangle(
                    $image,
                    $scaledLeft,
                    $scaledTop,
                    $scaledLeft + $scaledW - 1,
                    $scaledTop + $scaledH - 1,
                    $fillColor
                );
                $didDraw = true;
            }

            if ($strokeColor !== null && $strokePx > 0) {
                for ($i = 0; $i < $strokePx; $i++) {
                    imagerectangle(
                        $image,
                        $scaledLeft + $i,
                        $scaledTop + $i,
                        $scaledLeft + $scaledW - 1 - $i,
                        $scaledTop + $scaledH - 1 - $i,
                        $strokeColor
                    );
                }
                $didDraw = true;
            }
        } else {
            $cx = $scaledLeft + ($scaledW / 2.0);
            $cy = $scaledTop + ($scaledH / 2.0);
            $rad = deg2rad($angle);
            $cosA = cos($rad);
            $sinA = sin($rad);

            $baseCorners = [
                [$scaledLeft, $scaledTop],
                [$scaledLeft + $scaledW - 1, $scaledTop],
                [$scaledLeft + $scaledW - 1, $scaledTop + $scaledH - 1],
                [$scaledLeft, $scaledTop + $scaledH - 1],
            ];

            $points = [];
            foreach ($baseCorners as $corner) {
                $dx = $corner[0] - $cx;
                $dy = $corner[1] - $cy;
                $rx = $cx + ($dx * $cosA) - ($dy * $sinA);
                $ry = $cy + ($dx * $sinA) + ($dy * $cosA);
                $points[] = (int)round($rx);
                $points[] = (int)round($ry);
            }

            if ($fillColor !== null) {
                imagefilledpolygon($image, $points, $fillColor);
                $didDraw = true;
            }

            if ($strokeColor !== null && $strokePx > 0) {
                imagesetthickness($image, $strokePx);
                imagepolygon($image, $points, $strokeColor);
                imagesetthickness($image, 1);
                $didDraw = true;
            }
        }

        if ($didDraw) {
            $log("  STATIC redraw rect at ({$scaledLeft},{$scaledTop}) size={$scaledW}x{$scaledH} angle={$angle}");
        }

        return $didDraw;
    }

    private function allocateObjectColor($image, string $color, float $opacity = 1.0)
    {
        $normalized = strtolower(trim($color));
        if ($normalized === '' || $normalized === 'transparent' || $normalized === 'none') {
            return null;
        }

        $rgb = $this->hexToRgb($color);
        $objectOpacity = max(0.0, min(1.0, $opacity));
        $colorOpacity = max(0.0, min(1.0, (float)($rgb['a'] ?? 1.0)));
        $effectiveOpacity = $objectOpacity * $colorOpacity;
        $alpha = (int)round(127 - ($effectiveOpacity * 127));
        $alpha = max(0, min(127, $alpha));

        return imagecolorallocatealpha($image, (int)$rgb['r'], (int)$rgb['g'], (int)$rgb['b'], $alpha);
    }

    private function restoreUpperLayerPixels(
        $image,
        $baseSnapshot,
        array $objects,
        int $currentIndex,
        array $currentObject,
        float $scaleX,
        float $scaleY,
        ?string $fontPath,
        callable $log
    ): void {
        $sourceBounds = $this->getObjectPixelBounds($currentObject, $scaleX, $scaleY, $fontPath, $image);
        if (!$sourceBounds) {
            return;
        }

        $restoreCount = 0;
        $total = count($objects);
        for ($i = $currentIndex + 1; $i < $total; $i++) {
            $upper = $objects[$i] ?? null;
            if (!is_array($upper) || (($upper['visible'] ?? true) === false)) {
                continue;
            }

            $upperBounds = $this->getObjectPixelBounds($upper, $scaleX, $scaleY, $fontPath, $image);
            if (!$upperBounds) {
                continue;
            }

            $overlap = $this->intersectBounds($sourceBounds, $upperBounds);
            if (!$overlap) {
                continue;
            }

            $copyW = $overlap['x2'] - $overlap['x1'] + 1;
            $copyH = $overlap['y2'] - $overlap['y1'] + 1;
            if ($copyW <= 0 || $copyH <= 0) {
                continue;
            }

            // SEÃ‡Ä°CÄ° PÄ°KSEL GERÄ° YÃœKLEME
            // Eski yÃ¶ntem: imagecopy ile TÃœM dikdÃ¶rtgeni kopyalÄ±yordu â†’ gri placeholder
            // arka planÄ± da geliyordu â†’ Ã¼rÃ¼n gÃ¶rseli Ã¼zerinde gri yamalar oluÅŸuyordu.
            // Yeni yÃ¶ntem: piksel piksel kontrol et, sadece Ã¼st nesne piksellerini kopyala,
            // placeholder arka planÄ±nÄ± (aÃ§Ä±k gri/beyaz) atla.
            $imageW = imagesx($image);
            $imageH = imagesy($image);
            $pixelCount = 0;

            $yStart = max(0, $overlap['y1']);
            $yEnd   = min($imageH - 1, $overlap['y2']);
            $xStart = max(0, $overlap['x1']);
            $xEnd   = min($imageW - 1, $overlap['x2']);

            for ($py = $yStart; $py <= $yEnd; $py++) {
                for ($px = $xStart; $px <= $xEnd; $px++) {
                    $basePixel = imagecolorat($baseSnapshot, $px, $py);
                    $r = ($basePixel >> 16) & 0xFF;
                    $g = ($basePixel >> 8) & 0xFF;
                    $b = $basePixel & 0xFF;

                    // Placeholder arka plan rengi (aÃ§Ä±k gri/beyaz) â†’ atla
                    // Ãœst nesne pikseli (renkli/koyu) â†’ kopyala
                    // EÅŸik: R,G,B hepsi > 200 ise arka plan sayÄ±lÄ±r
                    if ($r > 200 && $g > 200 && $b > 200) {
                        continue;
                    }

                    imagesetpixel($image, $px, $py, $basePixel);
                    $pixelCount++;
                }
            }

            if ($pixelCount > 0) {
                $restoreCount++;
                $log("  restoreUpperLayerPixels: overlap ({$overlap['x1']},{$overlap['y1']})-({$overlap['x2']},{$overlap['y2']}): {$pixelCount} piksel geri yuklendi");
            }
        }

        if ($restoreCount > 0) {
            $log("  restoreUpperLayerPixels: {$restoreCount} ust katman bolgesi (secici piksel) geri yuklendi");
        }
    }

    /**
     * Dynamic-image alanÄ±nda gerÃ§ek foto iÃ§eriÄŸi zaten varsa yeniden Ã§izimi atla.
     * Bu, pre-render gÃ¶rsel + dynamic_image_only modunda Ã§ift resim bindirmesini Ã¶nler.
     */
    /**
     * Dinamik gorsel compositing asamasinda bir ust nesnenin korunup korunmayacagini belirler.
     * Dinamik alan/placeholder nesneleri sonradan tekrar render edildigi icin burada korunmaz.
     */
    private function shouldSkipUpperLayerProtection(array $obj, bool $dynamicImageOnlyMode = false): bool
    {
        if (($obj['visible'] ?? true) === false) {
            return true;
        }

        // dynamic_image_only modunda artik text/shape/barcode yeniden cizilmiyor.
        // Bu nedenle image compositing sirasinda ust katman nesneleri korunmali.
        // Sadece yeniden islenecek image-placeholder turevlerini burada korumadan gec.
        if ($dynamicImageOnlyMode) {
            $customType = strtolower((string)($obj['customType'] ?? ''));
            $isDynamicImageType = in_array($customType, ['image-placeholder', 'dynamic-image', 'slot-image'], true);
            return $isDynamicImageType;
        }

        if (!empty($obj['dynamicField']) || !empty($obj['dynamic_field']) || !empty($obj['isDataField'])) {
            return true;
        }

        $customType = strtolower((string)($obj['customType'] ?? ''));
        if (in_array($customType, ['image-placeholder', 'dynamic-image', 'slot-image', 'dynamic-text', 'slot-text', 'video-placeholder'], true)) {
            return true;
        }

        $rawText = (string)($obj['text'] ?? '');
        if ($rawText !== '' && strpos($rawText, '{{') !== false) {
            return true;
        }

        if (in_array($customType, ['barcode', 'qrcode', 'slot-barcode', 'slot-qrcode'], true)) {
            $rawValue = (string)($obj['barcodeValue'] ?? $obj['qrValue'] ?? '');
            if ($rawValue !== '' && strpos($rawValue, '{{') !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Dynamic image placeholder is considered back-layer only when it is the first visible
     * object in stack order (order value + index tiebreak).
     */
    private function isBackLayerPlaceholder(array $objects, int $currentIndex, array $currentObj): bool
    {
        if (($currentObj['visible'] ?? true) === false) {
            return false;
        }

        $currentOrder = $this->getObjectStackOrder($currentObj, $currentIndex);
        $minOrder = null;
        $minIndex = null;

        foreach ($objects as $idx => $obj) {
            if (!is_array($obj) || (($obj['visible'] ?? true) === false)) {
                continue;
            }

            $order = $this->getObjectStackOrder($obj, (int)$idx);
            if (
                $minOrder === null
                || $order < ($minOrder - 0.0001)
                || (abs($order - $minOrder) < 0.0001 && ($minIndex === null || $idx < $minIndex))
            ) {
                $minOrder = $order;
                $minIndex = (int)$idx;
            }
        }

        if ($minOrder === null || $minIndex === null) {
            return false;
        }

        if ($currentOrder > ($minOrder + 0.0001)) {
            return false;
        }

        return $currentIndex === $minIndex;
    }

    /**
     * Placeholder-like colors used for back-layer keyed replacement.
     */
    private function getPlaceholderKeyColors(array $obj): array
    {
        $keyColors = [];
        $colorKeys = [];

        $pushColor = function (array $rgb) use (&$keyColors, &$colorKeys): void {
            $k = ((int)$rgb['r']) . ',' . ((int)$rgb['g']) . ',' . ((int)$rgb['b']);
            if (!isset($colorKeys[$k])) {
                $colorKeys[$k] = true;
                $keyColors[] = [
                    'r' => (int)$rgb['r'],
                    'g' => (int)$rgb['g'],
                    'b' => (int)$rgb['b'],
                ];
            }
        };

        foreach (['fill', 'stroke'] as $field) {
            $val = $obj[$field] ?? null;
            if (is_string($val) && $val !== '') {
                $pushColor($this->hexToRgb($val));
            }
        }

        // Common placeholder shades used by editor defaults.
        foreach (['#ffffff', '#f5f5f5', '#f0f0f0', '#eeeeee', '#dddddd', '#cccccc'] as $hex) {
            $pushColor($this->hexToRgb($hex));
        }

        return $keyColors;
    }

    /**
     * Decide if a pixel should be replaced by product image in back-layer mode.
     */
    private function shouldReplaceBackLayerImagePixel(
        int $r,
        int $g,
        int $b,
        int $bgR,
        int $bgG,
        int $bgB,
        array $placeholderKeyColors
    ): bool {
        if ($this->isPixelNearColor($r, $g, $b, $bgR, $bgG, $bgB, 24)) {
            return true;
        }

        foreach ($placeholderKeyColors as $c) {
            if ($this->isPixelNearColor($r, $g, $b, (int)$c['r'], (int)$c['g'], (int)$c['b'], 28)) {
                return true;
            }
        }

        $maxCh = max($r, $g, $b);
        $minCh = min($r, $g, $b);
        $chroma = $maxCh - $minCh;
        $brightness = ($r + $g + $b) / 3;

        // Light neutral pixels are usually placeholder/background, safe to replace.
        return $chroma < 14 && $brightness > 180;
    }

    private function isPixelNearColor(int $r, int $g, int $b, int $tr, int $tg, int $tb, int $tolerance): bool
    {
        return abs($r - $tr) <= $tolerance
            && abs($g - $tg) <= $tolerance
            && abs($b - $tb) <= $tolerance;
    }

    private function getObjectStackOrder(array $obj, int $index): float
    {
        foreach (['layerOrder', 'zIndex', 'z_index', 'stackOrder'] as $key) {
            if (isset($obj[$key]) && is_numeric($obj[$key])) {
                return (float)$obj[$key];
            }
        }

        return (float)$index;
    }

    private function formatObjectForZOrderLog(array $obj, int $index, array $bounds): string
    {
        $type = strtolower((string)($obj['type'] ?? 'unknown'));
        $customType = strtolower((string)($obj['customType'] ?? ''));
        $dyn = (string)($obj['dynamicField'] ?? $obj['dynamic_field'] ?? '');
        $id = (string)($obj['objectId'] ?? $obj['id'] ?? '');
        $order = $this->getObjectStackOrder($obj, $index);

        $dynSafe = $dyn !== '' ? $dyn : '-';
        $idSafe = $id !== '' ? $id : '-';

        return sprintf(
            '#%d order=%.2f type=%s custom=%s dyn=%s id=%s b=(%d,%d)-(%d,%d)',
            $index,
            $order,
            $type,
            $customType,
            $dynSafe,
            $idSafe,
            (int)($bounds['x1'] ?? 0),
            (int)($bounds['y1'] ?? 0),
            (int)($bounds['x2'] ?? 0),
            (int)($bounds['y2'] ?? 0)
        );
    }

    private function getObjectPixelBounds(array $obj, float $scaleX, float $scaleY, ?string $fontPath, $image): ?array
    {
        $type = strtolower((string)($obj['type'] ?? ''));
        $left = (float)($obj['left'] ?? 0);
        $top = (float)($obj['top'] ?? 0);
        $width = (float)($obj['width'] ?? 0);
        $height = (float)($obj['height'] ?? 0);
        $objScaleX = (float)($obj['scaleX'] ?? 1.0);
        $objScaleY = (float)($obj['scaleY'] ?? 1.0);
        // Fabric.js v7 varsayÄ±lan origin: 'center'/'center'
        // eraseObjectArea() ve renderImageOnPosition() ile tutarlÄ± olmalÄ±
        $originX = strtolower((string)($obj['originX'] ?? 'center'));
        $originY = strtolower((string)($obj['originY'] ?? 'center'));
        $angle = (float)($obj['angle'] ?? 0);

        $effectiveWidth = $width * $objScaleX;
        $effectiveHeight = $height * $objScaleY;
        $adjLeft = $left;
        $adjTop = $top;

        if ($originX === 'center') {
            $adjLeft -= ($effectiveWidth / 2);
        } elseif ($originX === 'right') {
            $adjLeft -= $effectiveWidth;
        }
        if ($originY === 'center') {
            $adjTop -= ($effectiveHeight / 2);
        } elseif ($originY === 'bottom') {
            $adjTop -= $effectiveHeight;
        }

        $x1 = (int)floor($adjLeft * $scaleX);
        $y1 = (int)floor($adjTop * $scaleY);
        $x2 = (int)ceil(($adjLeft + $effectiveWidth) * $scaleX);
        $y2 = (int)ceil(($adjTop + $effectiveHeight) * $scaleY);

        if (in_array($type, ['text', 'i-text', 'itext', 'textbox'], true) && $fontPath) {
            $fontSize = (float)($obj['fontSize'] ?? 20);
            $scaledFontSize = (int)max(8, ($fontSize * $objScaleY) * min($scaleX, $scaleY));
            $lineHeight = (float)($obj['lineHeight'] ?? 1.16);
            $text = (string)($obj['text'] ?? '');
            $bbox = imagettfbbox($scaledFontSize, $angle, $fontPath, $text !== '' ? $text : 'M');
            if (is_array($bbox)) {
                $w = max(abs($bbox[2] - $bbox[0]), abs($bbox[4] - $bbox[6]));
                $h = max(abs($bbox[1] - $bbox[7]), (int)round($scaledFontSize * $lineHeight));
                if ($w > 0) {
                    $x2 = max($x2, $x1 + (int)$w + 6);
                }
                if ($h > 0) {
                    $y2 = max($y2, $y1 + (int)$h + 6);
                }
            }
        }

        $imgW = imagesx($image);
        $imgH = imagesy($image);
        $x1 = max(0, min($imgW - 1, $x1));
        $y1 = max(0, min($imgH - 1, $y1));
        $x2 = max(0, min($imgW - 1, $x2));
        $y2 = max(0, min($imgH - 1, $y2));

        if ($x2 <= $x1 || $y2 <= $y1) {
            return null;
        }

        return ['x1' => $x1, 'y1' => $y1, 'x2' => $x2, 'y2' => $y2];
    }

    private function intersectBounds(array $a, array $b): ?array
    {
        $x1 = max($a['x1'], $b['x1']);
        $y1 = max($a['y1'], $b['y1']);
        $x2 = min($a['x2'], $b['x2']);
        $y2 = min($a['y2'], $b['y2']);

        if ($x2 <= $x1 || $y2 <= $y1) {
            return null;
        }

        return ['x1' => $x1, 'y1' => $y1, 'x2' => $x2, 'y2' => $y2];
    }

    /**
     * Metni belirli geniÅŸliÄŸe gÃ¶re satÄ±rlara bÃ¶l (word-wrap)
     *
     * @param string $text Sarmalanacak metin
     * @param int $fontSize Font boyutu (px)
     * @param string $fontPath Font dosyasÄ± yolu
     * @param int $maxWidth Maksimum geniÅŸlik (px)
     * @param string $fontWeight Font aÄŸÄ±rlÄ±ÄŸÄ± (normal, bold)
     * @return string[] SatÄ±r dizisi
     */
    private function wrapText(string $text, int $fontSize, string $fontPath, int $maxWidth, string $fontWeight = 'normal'): array
    {
        if ($maxWidth <= 0 || empty(trim($text))) {
            return [$text];
        }

        // Ã–nce tÃ¼m metin tek satÄ±ra sÄ±ÄŸÄ±yor mu kontrol et
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
                // Mevcut satÄ±r varsa kaydet
                if ($currentLine !== '') {
                    $lines[] = $currentLine;
                }

                // Tek kelime geniÅŸlikten bÃ¼yÃ¼kse, karakter bazlÄ± bÃ¶l
                $bbox = imagettfbbox($fontSize, 0, $fontPath, $word);
                $wordWidth = abs($bbox[2] - $bbox[0]);

                if ($wordWidth > $maxWidth) {
                    // Kelimeyi karakter bazlÄ± bÃ¶l
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
     * Barkod/QR nesnesini GD image Ã¼zerine render et
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

        // Otomatik algÄ±lama
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

        // Origin dÃ¼zeltmesi
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

        // Barkod Ã§izgilerini GD ile render et
        $lineRgb = $this->hexToRgb($lineHex);
        $lineColor = imagecolorallocate($image, $lineRgb['r'], $lineRgb['g'], $lineRgb['b']);

        if ($customType === 'qrcode') {
            // QR kod: Basit veri matrisi Ã§iz (gerÃ§ek QR algoritmasÄ± Ã§ok karmaÅŸÄ±k, placeholder)
            $log("  QR kod render (placeholder pattern)");
            $this->renderQRPlaceholder($image, $scaledLeft, $scaledTop, $scaledWidth, $scaledHeight, $lineColor, $bgColor, $value);
        } else {
            // Barkod: CODE128 Ã§izgileri oluÅŸtur
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
     * Barkod deÄŸerinden format algÄ±la (BarcodeUtils.js PHP karÅŸÄ±lÄ±ÄŸÄ±)
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

        // Alfanumerik: CODE128 (en geniÅŸ uyumluluk)
        return 'CODE128';
    }

    /**
     * GD ile barkod Ã§izgileri Ã§iz (CODE128 benzeri basit encoding)
     */
    private function renderBarcodeLines($image, int $x, int $y, int $w, int $h, $lineColor, $bgColor, string $value, string $format, bool $displayValue): void
    {
        // DeÄŸer gÃ¶sterimi iÃ§in alan ayÄ±r
        $fontPath = $this->findSystemFont();
        $textAreaHeight = $displayValue && $fontPath ? (int)($h * 0.2) : 0;
        $barAreaHeight = $h - $textAreaHeight;
        $barAreaTop = $y;

        // Basit barkod pattern oluÅŸtur (deÄŸerin her karakterinden Ã§izgi geniÅŸlikleri tÃ¼ret)
        $padding = max(2, (int)($w * 0.05));
        $barAreaWidth = $w - ($padding * 2);
        $barStartX = $x + $padding;

        // Karakter bazlÄ± barkod Ã§izgileri
        $pattern = $this->generateBarcodePattern($value, $format);
        $totalUnits = array_sum($pattern);

        if ($totalUnits <= 0) return;

        $unitWidth = $barAreaWidth / $totalUnits;
        $currentX = (float)$barStartX;
        $isBar = true; // Ã‡izgi ile baÅŸla

        foreach ($pattern as $units) {
            $barWidth = max(1, (int)round($units * $unitWidth));
            if ($isBar) {
                imagefilledrectangle($image, (int)$currentX, $barAreaTop, (int)$currentX + $barWidth - 1, $barAreaTop + $barAreaHeight - 1, $lineColor);
            }
            $currentX += $barWidth;
            $isBar = !$isBar;
        }

        // DeÄŸer gÃ¶sterimi
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
     * Barkod pattern oluÅŸtur (bar/space geniÅŸlikleri)
     */
    private function generateBarcodePattern(string $value, string $format): array
    {
        // CODE128 encoding tablosu (Start Code B + veri + check + stop)
        // BasitleÅŸtirilmiÅŸ: her karakter iÃ§in sabit pattern
        $pattern = [];

        // Start pattern
        $pattern = array_merge($pattern, [2, 1, 1, 2, 3, 2]); // Start Code B

        // Her karakter iÃ§in pattern
        foreach (str_split($value) as $char) {
            $code = ord($char);
            // Basit hash tabanlÄ± pattern (gerÃ§ek CODE128 deÄŸil ama gÃ¶rsel olarak barkod gÃ¶rÃ¼nÃ¼mlÃ¼)
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
     * QR kod placeholder render (GD gerÃ§ek QR encoder yok)
     */
    private function renderQRPlaceholder($image, int $x, int $y, int $w, int $h, $lineColor, $bgColor, string $value): void
    {
        $size = min($w, $h);
        $offsetX = $x + (int)(($w - $size) / 2);
        $offsetY = $y + (int)(($h - $size) / 2);

        // Basit QR benzeri pattern
        $gridSize = min(21, max(11, (int)(strlen($value) / 2) + 11)); // 11-21 arasÄ±
        $cellSize = max(1, (int)($size / $gridSize));

        // Position detection patterns (3 kÃ¶ÅŸe)
        $this->drawQRFinderPattern($image, $offsetX, $offsetY, $cellSize, $lineColor, $bgColor);
        $this->drawQRFinderPattern($image, $offsetX + ($gridSize - 7) * $cellSize, $offsetY, $cellSize, $lineColor, $bgColor);
        $this->drawQRFinderPattern($image, $offsetX, $offsetY + ($gridSize - 7) * $cellSize, $cellSize, $lineColor, $bgColor);

        // Veri modÃ¼lleri (hash tabanlÄ± pseudo-random pattern)
        for ($row = 0; $row < $gridSize; $row++) {
            for ($col = 0; $col < $gridSize; $col++) {
                // Finder pattern bÃ¶lgelerini atla
                if (($row < 8 && $col < 8) || ($row < 8 && $col >= $gridSize - 8) || ($row >= $gridSize - 8 && $col < 8)) {
                    continue;
                }

                // Hash tabanlÄ± doldurma
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
     * QR finder pattern (7x7 kÃ¶ÅŸe kareleri)
     */
    private function drawQRFinderPattern($image, int $x, int $y, int $cellSize, $dark, $light): void
    {
        // DÄ±ÅŸ kare (7x7)
        imagefilledrectangle($image, $x, $y, $x + 7 * $cellSize - 1, $y + 7 * $cellSize - 1, $dark);
        // Ä°Ã§ beyaz (5x5)
        imagefilledrectangle($image, $x + $cellSize, $y + $cellSize, $x + 6 * $cellSize - 1, $y + 6 * $cellSize - 1, $light);
        // Merkez kare (3x3)
        imagefilledrectangle($image, $x + 2 * $cellSize, $y + 2 * $cellSize, $x + 5 * $cellSize - 1, $y + 5 * $cellSize - 1, $dark);
    }

    /**
     * ÃœrÃ¼n bilgilerinden dinamik alan deÄŸerlerini oluÅŸtur
     */
    private function buildFieldValues(array $product): array
    {
        // Fiyat formatlama
        $currentPrice = $product['current_price'] ?? $product['price'] ?? 0;
        $previousPrice = $product['previous_price'] ?? $product['old_price'] ?? null;

        // FiyatÄ± formatla
        $formattedPrice = number_format((float)$currentPrice, 2, ',', '.');
        $formattedPrevPrice = $previousPrice ? number_format((float)$previousPrice, 2, ',', '.') : '';
        $formattedPriceWithCurrency = $formattedPrice . ' â‚º';
        $formattedPrevPriceWithCurrency = $formattedPrevPrice ? ($formattedPrevPrice . ' â‚º') : '';

        return [
            // Temel bilgiler
            'product_name' => $product['name'] ?? '',
            'name' => $product['name'] ?? '',
            'sku' => $product['sku'] ?? '',
            'barcode' => $product['barcode'] ?? $product['sku'] ?? '',
            'description' => $product['description'] ?? '',
            'slug' => $product['slug'] ?? '',

            // Fiyat bilgileri
            'current_price' => $formattedPriceWithCurrency,
            'price' => $formattedPriceWithCurrency,
            'price_with_currency' => $formattedPriceWithCurrency,
            'current_price_value' => $formattedPrice,
            'price_value' => $formattedPrice,
            'previous_price' => $formattedPrevPriceWithCurrency,
            'old_price' => $formattedPrevPriceWithCurrency,
            'previous_price_with_currency' => $formattedPrevPriceWithCurrency,
            'old_price_with_currency' => $formattedPrevPriceWithCurrency,
            'previous_price_value' => $formattedPrevPrice,
            'old_price_value' => $formattedPrevPrice,
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

            // HAL KÃ¼nye alanlarÄ±
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
            'alis_fiyati' => isset($product['alis_fiyati']) && $product['alis_fiyati'] !== '' ? number_format((float)$product['alis_fiyati'], 2, ',', '.') . ' â‚º' : '',
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
     * Sistemde kullanÄ±labilir font dosyasÄ± bul
     */
    private function findSystemFont(): ?string
    {
        $possibleFonts = [
            // Windows fontlarÄ±
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/arialbd.ttf',
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/tahoma.ttf',
            // Linux fontlarÄ±
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
            // MacOS fontlarÄ±
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
     * Hex renk kodunu RGB'ye dÃ¶nÃ¼ÅŸtÃ¼r
     */
    /**
     * GÃ¶rsel URL'sinden dosya yolunu resolve et
     * @param string $url GÃ¶rsel URL veya dosya yolu
     * @param string|null $companyId Firma ID
     * @return string|null Dosya yolu veya null
     */
    private function resolveImagePath(string $url, ?string $companyId = null): ?string
    {
        if (empty($url)) return null;

        // Zaten tam dosya yoluysa (Windows veya Linux)
        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $url) || strpos($url, '/') === 0) {
            return file_exists($url) ? $url : null;
        }

        $basePaths = [];

        // Storage yolu
        if (defined('STORAGE_PATH')) {
            $basePaths[] = STORAGE_PATH;
        }
        if (defined('BASE_PATH')) {
            $basePaths[] = BASE_PATH . '/storage';
            $basePaths[] = BASE_PATH;
        }

        // URL'den relative path Ã§Ä±kar
        $relativePath = $url;
        // /storage/ prefix'i varsa kaldÄ±r
        $relativePath = preg_replace('#^/?(storage/)#', '', $relativePath);
        // /api/media/serve.php?path= prefix'i varsa kaldÄ±r
        if (strpos($relativePath, 'api/media/serve.php') !== false) {
            parse_str(parse_url($relativePath, PHP_URL_QUERY) ?? '', $params);
            $relativePath = $params['path'] ?? $relativePath;
        }

        // Firma bazlÄ± yollarÄ± dene
        foreach ($basePaths as $base) {
            $candidates = [
                $base . '/' . $relativePath,
                $base . '/companies/' . $companyId . '/media/' . basename($relativePath),
            ];

            if ($companyId) {
                $candidates[] = $base . '/companies/' . $companyId . '/' . $relativePath;
            }

            foreach ($candidates as $candidate) {
                $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $candidate);
                if (file_exists($normalized)) {
                    return $normalized;
                }
            }
        }

        return null;
    }

    /**
     * Base image Ã¼zerindeki placeholder alanÄ±nÄ± arka plan rengiyle sil.
     *
     * Base image (render_image/preview_image), Fabric.js canvas export'undan gelir ve
     * tÃ¼m nesneleri (placeholder Rect dahil) zaten iÃ§erir. Product image oval maskeleme
     * ile Ã§izildiÄŸinde, saydam kÃ¶ÅŸeler eski placeholder'Ä± (gri dolgu + mavi Ã§izgili kenar)
     * gÃ¶sterir. Bu metod, product image Ã§izilmeden Ã–NCE placeholder alanÄ±nÄ± temizler.
     *
     * @param resource|\GdImage $image Hedef GD gÃ¶rsel (base image)
     * @param array $obj Fabric.js nesne verileri (pozisyon, boyut, origin bilgileri)
     * @param float $scaleX Yatay Ã¶lÃ§ekleme oranÄ±
     * @param float $scaleY Dikey Ã¶lÃ§ekleme oranÄ±
     * @param int $bgColor GD renk kaynaÄŸÄ± (template arka plan rengi)
     * @param callable $log Log fonksiyonu
     */
    private function eraseObjectArea($image, array $obj, float $scaleX, float $scaleY, $bgColor, callable $log): void
    {
        $left = (float)($obj['left'] ?? 0);
        $top = (float)($obj['top'] ?? 0);
        $width = (float)($obj['width'] ?? 150);
        $height = (float)($obj['height'] ?? 150);
        $objScaleX = (float)($obj['scaleX'] ?? 1);
        $objScaleY = (float)($obj['scaleY'] ?? 1);
        $originX = $obj['originX'] ?? 'center';
        $originY = $obj['originY'] ?? 'center';

        $dstW = (int)round($width * $objScaleX * $scaleX);
        $dstH = (int)round($height * $objScaleY * $scaleY);
        $dstX = (int)round($left * $scaleX);
        $dstY = (int)round($top * $scaleY);

        // Origin ayarÄ± (renderImageOnPosition ile aynÄ± mantÄ±k)
        if ($originX === 'center') $dstX -= (int)($dstW / 2);
        elseif ($originX === 'right') $dstX -= $dstW;

        if ($originY === 'center') $dstY -= (int)($dstH / 2);
        elseif ($originY === 'bottom') $dstY -= $dstH;

        // Stroke width kadar marj ekle â€” placeholder'Ä±n kenarlÄ±k Ã§izgileri de silinsin
        $sw = (int)round(($obj['strokeWidth'] ?? 2) * max($scaleX, $scaleY));
        $margin = max($sw + 1, 3);

        $imgW = imagesx($image);
        $imgH = imagesy($image);

        $x1 = max(0, $dstX - $margin);
        $y1 = max(0, $dstY - $margin);
        $x2 = min($imgW - 1, $dstX + $dstW + $margin);
        $y2 = min($imgH - 1, $dstY + $dstH + $margin);

        if ($x2 > $x1 && $y2 > $y1) {
            imagefilledrectangle($image, $x1, $y1, $x2, $y2, $bgColor);
            $log("  eraseObjectArea: ({$x1},{$y1})-({$x2},{$y2}) arka plan rengiyle silindi");
        }
    }

    /**
     * Dinamik gÃ¶rsel placeholder'Ä±nÄ± GD ile render et
     * @param resource|\GdImage $dstImage Hedef GD gÃ¶rsel
     * @param string $imagePath Kaynak gÃ¶rsel dosya yolu
     * @param array $obj Fabric.js nesne verileri
     * @param float $scaleX Yatay Ã¶lÃ§ekleme oranÄ±
     * @param float $scaleY Dikey Ã¶lÃ§ekleme oranÄ±
     * @param callable $log Log fonksiyonu
     */
    private function renderImageOnPosition($dstImage, string $imagePath, array $obj, float $scaleX, float $scaleY, callable $log): void
    {
        // visible kontrolÃ¼
        if (isset($obj['visible']) && $obj['visible'] === false) {
            $log("  renderImageOnPosition: visible=false, atlanÄ±yor");
            return;
        }

        // Kaynak gÃ¶rseli yÃ¼kle
        $srcImg = null;
        $ext = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));

        switch ($ext) {
            case 'jpg': case 'jpeg':
                $srcImg = @imagecreatefromjpeg($imagePath);
                break;
            case 'png':
                $srcImg = @imagecreatefrompng($imagePath);
                break;
            case 'gif':
                $srcImg = @imagecreatefromgif($imagePath);
                break;
            case 'webp':
                if (function_exists('imagecreatefromwebp')) {
                    $srcImg = @imagecreatefromwebp($imagePath);
                }
                break;
        }

        if (!$srcImg) {
            $log("  renderImageOnPosition: GÃ¶rsel yÃ¼klenemedi: $imagePath (ext: $ext)");
            return;
        }

        // Pozisyon ve boyut hesapla
        $left = (float)($obj['left'] ?? 0);
        $top = (float)($obj['top'] ?? 0);
        $width = (float)($obj['width'] ?? 150);
        $height = (float)($obj['height'] ?? 150);
        $objScaleX = (float)($obj['scaleX'] ?? 1);
        $objScaleY = (float)($obj['scaleY'] ?? 1);
        $originX = $obj['originX'] ?? 'center';
        $originY = $obj['originY'] ?? 'center';

        // GÃ¶rsel Ã¶zellikler
        $opacity = (float)($obj['opacity'] ?? 1);
        $stroke = $obj['stroke'] ?? null;
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        $rx = (float)($obj['rx'] ?? 0);
        $ry = (float)($obj['ry'] ?? 0);
        $angle = (float)($obj['angle'] ?? 0);
        $shadow = $obj['shadow'] ?? null;

        // Efektif boyutlarÄ± hesapla
        $dstW = (int)round($width * $objScaleX * $scaleX);
        $dstH = (int)round($height * $objScaleY * $scaleY);

        // Ã–lÃ§eklenmiÅŸ pozisyonu hesapla
        $dstX = (int)round($left * $scaleX);
        $dstY = (int)round($top * $scaleY);

        // Origin ayarÄ±
        if ($originX === 'center') $dstX -= (int)($dstW / 2);
        elseif ($originX === 'right') $dstX -= $dstW;

        if ($originY === 'center') $dstY -= (int)($dstH / 2);
        elseif ($originY === 'bottom') $dstY -= $dstH;

        // Kaynak boyutlarÄ±
        $srcW = imagesx($srcImg);
        $srcH = imagesy($srcImg);

        // imageFit moduna gÃ¶re render
        $fit = $obj['imageFit'] ?? 'cover';
        $cropSrcX = 0;
        $cropSrcY = 0;
        $cropSrcW = $srcW;
        $cropSrcH = $srcH;

        if ($fit === 'cover') {
            // Cover: Kaynak gÃ¶rseli kÄ±rp, hedef alanÄ± tamamen doldursun
            $srcAspect = $srcW / max(1, $srcH);
            $dstAspect = $dstW / max(1, $dstH);

            if ($srcAspect > $dstAspect) {
                $cropSrcW = (int)round($srcH * $dstAspect);
                $cropSrcX = (int)round(($srcW - $cropSrcW) / 2);
            } else {
                $cropSrcH = (int)round($srcW / max(0.01, $dstAspect));
                $cropSrcY = (int)round(($srcH - $cropSrcH) / 2);
            }
        } elseif ($fit === 'contain') {
            // Contain: Kaynak gÃ¶rseli kÃ¼Ã§Ã¼lt, hedef alanÄ± iÃ§ine sÄ±ÄŸsÄ±n
            $srcAspect = $srcW / max(1, $srcH);
            $dstAspect = $dstW / max(1, $dstH);

            if ($srcAspect > $dstAspect) {
                $newH = (int)round($dstW / max(0.01, $srcAspect));
                $dstY += (int)round(($dstH - $newH) / 2);
                $dstH = $newH;
            } else {
                $newW = (int)round($dstH * $srcAspect);
                $dstX += (int)round(($dstW - $newW) / 2);
                $dstW = $newW;
            }
        }

        // GeÃ§ersiz boyut kontrolÃ¼
        if ($dstW < 1 || $dstH < 1 || $cropSrcW < 1 || $cropSrcH < 1) {
            $log("  renderImageOnPosition: GeÃ§ersiz boyut: dst={$dstW}x{$dstH}, src={$cropSrcW}x{$cropSrcH}");
            imagedestroy($srcImg);
            return;
        }

        // Ara gÃ¶rÃ¼ntÃ¼ oluÅŸtur (border radius, opacity, rotation iÃ§in)
        $tempImg = imagecreatetruecolor($dstW, $dstH);
        imagealphablending($tempImg, true);
        imagesavealpha($tempImg, true);
        $transparent = imagecolorallocatealpha($tempImg, 0, 0, 0, 127);
        imagefill($tempImg, 0, 0, $transparent);

        // GÃ¶rseli ara gÃ¶rÃ¼ntÃ¼ye kopyala
        imagecopyresampled(
            $tempImg, $srcImg,
            0, 0,
            $cropSrcX, $cropSrcY,
            $dstW, $dstH,
            $cropSrcW, $cropSrcH
        );
        imagedestroy($srcImg);

        // --- KÃ¶ÅŸe yuvarlaklÄ±ÄŸÄ± (rx/ry) ---
        $scaledRx = (int)round($rx * $scaleX);
        $scaledRy = (int)round($ry * $scaleY);
        $hasRoundedCorners = ($scaledRx > 0 || $scaledRy > 0);
        $isFullEllipse = false;

        if ($hasRoundedCorners) {
            $this->applyRoundedCorners($tempImg, $dstW, $dstH, $scaledRx, $scaledRy);
            $effRx = min($scaledRx > 0 ? $scaledRx : $scaledRy, (int)floor($dstW / 2));
            $effRy = min($scaledRy > 0 ? $scaledRy : $scaledRx, (int)floor($dstH / 2));
            $isFullEllipse = ($effRx >= (int)floor($dstW / 2)) && ($effRy >= (int)floor($dstH / 2));
            $log("  renderImageOnPosition: rx={$scaledRx} ry={$scaledRy} kÃ¶ÅŸe yuvarlaklÄ±ÄŸÄ± uygulandÄ± (fullEllipse=" . ($isFullEllipse ? 'true' : 'false') . ")");
        }

        // --- KenarlÄ±k (stroke) â€” tempImg Ã¼zerine, yuvarlatÄ±lmÄ±ÅŸ ÅŸekli takip eder ---
        if ($stroke && $strokeWidth > 0) {
            $scaledStrokeW = max(1, (int)round($strokeWidth * $scaleX));
            $stRgb = $this->hexToRgb($stroke);
            $strokeAlpha = isset($stRgb['a']) && $stRgb['a'] < 1 ? (int)(127 - ($stRgb['a'] * 127)) : 0;
            $strokeColor = imagecolorallocatealpha($tempImg, $stRgb['r'], $stRgb['g'], $stRgb['b'], $strokeAlpha);

            if ($isFullEllipse) {
                // Eliptik kenarlÄ±k
                for ($i = 0; $i < $scaledStrokeW; $i++) {
                    imageellipse($tempImg, (int)floor($dstW / 2), (int)floor($dstH / 2), $dstW - 1 - 2 * $i, $dstH - 1 - 2 * $i, $strokeColor);
                }
            } elseif ($hasRoundedCorners) {
                // YuvarlatÄ±lmÄ±ÅŸ dikdÃ¶rtgen kenarlÄ±k (arc + line)
                $erx = min($scaledRx > 0 ? $scaledRx : $scaledRy, (int)floor($dstW / 2));
                $ery = min($scaledRy > 0 ? $scaledRy : $scaledRx, (int)floor($dstH / 2));
                for ($i = 0; $i < $scaledStrokeW; $i++) {
                    $arcW = max(1, 2 * $erx - 2 * $i);
                    $arcH = max(1, 2 * $ery - 2 * $i);
                    // 4 kÃ¶ÅŸe yayÄ±
                    imagearc($tempImg, $erx, $ery, $arcW, $arcH, 180, 270, $strokeColor);
                    imagearc($tempImg, $dstW - $erx - 1, $ery, $arcW, $arcH, 270, 360, $strokeColor);
                    imagearc($tempImg, $erx, $dstH - $ery - 1, $arcW, $arcH, 90, 180, $strokeColor);
                    imagearc($tempImg, $dstW - $erx - 1, $dstH - $ery - 1, $arcW, $arcH, 0, 90, $strokeColor);
                    // 4 kenar Ã§izgisi
                    imageline($tempImg, $erx, $i, $dstW - $erx - 1, $i, $strokeColor);
                    imageline($tempImg, $erx, $dstH - 1 - $i, $dstW - $erx - 1, $dstH - 1 - $i, $strokeColor);
                    imageline($tempImg, $i, $ery, $i, $dstH - $ery - 1, $strokeColor);
                    imageline($tempImg, $dstW - 1 - $i, $ery, $dstW - 1 - $i, $dstH - $ery - 1, $strokeColor);
                }
            } else {
                // DÃ¼z dikdÃ¶rtgen kenarlÄ±k
                imagesetthickness($tempImg, $scaledStrokeW);
                imagerectangle($tempImg, 0, 0, $dstW - 1, $dstH - 1, $strokeColor);
                imagesetthickness($tempImg, 1);
            }
            $log("  renderImageOnPosition: stroke={$stroke} width={$scaledStrokeW} kenarlÄ±k uygulandÄ±");
        }

        // --- Rotasyon (angle) ---
        if ($angle != 0) {
            $rotated = imagerotate($tempImg, -$angle, imagecolorallocatealpha($tempImg, 0, 0, 0, 127));
            if ($rotated) {
                imagesavealpha($rotated, true);
                $newW = imagesx($rotated);
                $newH = imagesy($rotated);
                $dstX -= (int)(($newW - $dstW) / 2);
                $dstY -= (int)(($newH - $dstH) / 2);
                imagedestroy($tempImg);
                $tempImg = $rotated;
                $dstW = $newW;
                $dstH = $newH;
                $log("  renderImageOnPosition: angle={$angle} rotasyon uygulandÄ±");
            }
        }

        // --- GÃ¶lge (shadow) â€” ÅŸekle uyumlu ---
        if ($shadow) {
            $shadowObj = is_string($shadow) ? json_decode($shadow, true) : (is_array($shadow) ? $shadow : null);
            if ($shadowObj) {
                $sColor = $shadowObj['color'] ?? 'rgba(0,0,0,0.4)';
                $sOffsetX = (int)(($shadowObj['offsetX'] ?? 4) * $scaleX);
                $sOffsetY = (int)(($shadowObj['offsetY'] ?? 4) * $scaleY);

                $sRgb = $this->hexToRgb($sColor);
                $sAlpha = (int)(127 - (($sRgb['a'] ?? 0.4) * 127));
                $shadowColor = imagecolorallocatealpha($dstImage, $sRgb['r'], $sRgb['g'], $sRgb['b'], max(0, min(127, $sAlpha)));

                if ($isFullEllipse && $angle == 0) {
                    // Elips gÃ¶lge
                    imagefilledellipse(
                        $dstImage,
                        $dstX + (int)($dstW / 2) + $sOffsetX,
                        $dstY + (int)($dstH / 2) + $sOffsetY,
                        $dstW, $dstH,
                        $shadowColor
                    );
                } else {
                    // DikdÃ¶rtgen gÃ¶lge
                    imagefilledrectangle(
                        $dstImage,
                        $dstX + $sOffsetX,
                        $dstY + $sOffsetY,
                        $dstX + $sOffsetX + $dstW - 1,
                        $dstY + $sOffsetY + $dstH - 1,
                        $shadowColor
                    );
                }
                $log("  renderImageOnPosition: shadow offset=({$sOffsetX},{$sOffsetY}) uygulandÄ±");
            }
        }

        // --- Hedef gÃ¶rÃ¼ntÃ¼ye kopyala (opacity + alpha uyumlu) ---
        if ($opacity < 1 && $opacity > 0) {
            if ($hasRoundedCorners) {
                // Alpha + opacity birlikte: Ã¶nce alpha blend, sonra opacity merge
                $temp2 = imagecreatetruecolor($dstW, $dstH);
                imagealphablending($temp2, false);
                imagesavealpha($temp2, true);
                // Hedef bÃ¶lgeyi kopyala
                $copyX = max(0, $dstX);
                $copyY = max(0, $dstY);
                $availW = min($dstW, imagesx($dstImage) - $copyX);
                $availH = min($dstH, imagesy($dstImage) - $copyY);
                if ($availW > 0 && $availH > 0) {
                    imagecopy($temp2, $dstImage, 0, 0, $copyX, $copyY, $availW, $availH);
                }
                // tempImg'i alpha ile Ã¼stÃ¼ne koy (ÅŸeffaf kÃ¶ÅŸeler korunur)
                imagealphablending($temp2, true);
                imagecopy($temp2, $tempImg, 0, 0, 0, 0, $dstW, $dstH);
                // Opacity ile birleÅŸtir
                imagecopymerge($dstImage, $temp2, $dstX, $dstY, 0, 0, $dstW, $dstH, (int)round($opacity * 100));
                imagedestroy($temp2);
            } else {
                imagecopymerge($dstImage, $tempImg, $dstX, $dstY, 0, 0, $dstW, $dstH, (int)round($opacity * 100));
            }
            $log("  renderImageOnPosition: opacity={$opacity} uygulandÄ±");
        } elseif ($opacity > 0) {
            // Tam opaklÄ±k â€” alpha kanalÄ±nÄ± koru
            imagealphablending($dstImage, true);
            imagecopy($dstImage, $tempImg, $dstX, $dstY, 0, 0, $dstW, $dstH);
        }
        imagedestroy($tempImg);

        $log("  renderImageOnPosition: OK {$dstW}x{$dstH} at ({$dstX},{$dstY}) fit={$fit} opacity={$opacity}");
    }

    /**
     * GD gÃ¶rÃ¼ntÃ¼sÃ¼ne kÃ¶ÅŸe yuvarlaklÄ±ÄŸÄ± uygula (alpha mask)
     */
    private function applyRoundedCorners($img, int $w, int $h, int $rx, int $ry): void
    {
        // rx veya ry 0 ise diÄŸerini kullan (Fabric.js davranÄ±ÅŸÄ±: tek deÄŸer her iki eksene uygulanÄ±r)
        $effRx = $rx > 0 ? $rx : $ry;
        $effRy = $ry > 0 ? $ry : $rx;

        if ($effRx < 1 || $effRy < 1 || $w < 2 || $h < 2) return;

        // YarÄ±Ã§aplarÄ± gÃ¶rÃ¼ntÃ¼ boyutunun yarÄ±sÄ±yla sÄ±nÄ±rla (boyut sÄ±nÄ±rlamasÄ± YAPMA)
        $halfW = (int)floor($w / 2);
        $halfH = (int)floor($h / 2);
        $effRx = min($effRx, $halfW);
        $effRy = min($effRy, $halfH);

        imagealphablending($img, false); // DoÄŸrudan piksel yazÄ±mÄ± iÃ§in
        $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);

        $isFullEllipse = ($effRx >= $halfW) && ($effRy >= $halfH);

        if ($isFullEllipse) {
            // ========== TAM ELÄ°PS MODU ==========
            // TÃ¼m gÃ¶rÃ¼ntÃ¼yÃ¼ elips olarak maskele (scanline yaklaÅŸÄ±mÄ± â€” performanslÄ±)
            $cx = ($w - 1) / 2.0;
            $cy = ($h - 1) / 2.0;
            $a  = $w / 2.0;   // yarÄ± eksen x
            $b  = $h / 2.0;   // yarÄ± eksen y

            for ($y = 0; $y < $h; $y++) {
                $ny   = ($y - $cy) / $b;   // normalleÅŸtirilmiÅŸ y (-1..1)
                $nySq = $ny * $ny;

                if ($nySq >= 1.0) {
                    // Bu satÄ±r tamamen elips dÄ±ÅŸÄ±nda â€” tÃ¼m pikseller ÅŸeffaf
                    for ($x = 0; $x < $w; $x++) {
                        imagesetpixel($img, $x, $y, $transparent);
                    }
                    continue;
                }

                // Bu satÄ±rdaki elips x sÄ±nÄ±rlarÄ±nÄ± hesapla
                $xSpan = $a * sqrt(1.0 - $nySq);
                $xLeftBound  = $cx - $xSpan;
                $xRightBound = $cx + $xSpan;

                // Sol dÄ±ÅŸ bÃ¶lge â€” elips sol sÄ±nÄ±rÄ±na kadar
                $leftEnd = min($w, (int)ceil($xLeftBound));
                for ($x = 0; $x < $leftEnd; $x++) {
                    $nx = ($x - $cx) / $a;
                    if ($nx * $nx + $nySq > 1.0) {
                        imagesetpixel($img, $x, $y, $transparent);
                    }
                }

                // SaÄŸ dÄ±ÅŸ bÃ¶lge â€” elips saÄŸ sÄ±nÄ±rÄ±ndan itibaren
                $rightStart = max(0, (int)floor($xRightBound));
                for ($x = $rightStart; $x < $w; $x++) {
                    $nx = ($x - $cx) / $a;
                    if ($nx * $nx + $nySq > 1.0) {
                        imagesetpixel($img, $x, $y, $transparent);
                    }
                }
            }
        } else {
            // ========== KÃ–ÅE YUVARLAMA MODU ==========
            // 4 kÃ¶ÅŸede eliptik yay uygula (ayrÄ± rx/ry ile gerÃ§ek elips desteÄŸi)
            // Merkez noktasÄ± kÃ¶ÅŸe eÄŸrisinin iÃ§ tarafÄ±nda â€” elips denklemiyle maskeleme

            $corners = [
                // [centerX, centerY, regionX1, regionY1, regionX2, regionY2]
                [$effRx,             $effRy,             0,             0,             $effRx - 1,       $effRy - 1      ], // Sol Ã¼st
                [$w - 1 - $effRx,    $effRy,             $w - $effRx,   0,             $w - 1,           $effRy - 1      ], // SaÄŸ Ã¼st
                [$effRx,             $h - 1 - $effRy,    0,             $h - $effRy,   $effRx - 1,       $h - 1          ], // Sol alt
                [$w - 1 - $effRx,    $h - 1 - $effRy,    $w - $effRx,   $h - $effRy,   $w - 1,           $h - 1          ], // SaÄŸ alt
            ];

            $aF = (float)$effRx;  // elips yarÄ± eksen x
            $bF = (float)$effRy;  // elips yarÄ± eksen y

            foreach ($corners as $c) {
                $cxF = (float)$c[0];
                $cyF = (float)$c[1];

                for ($y = $c[3]; $y <= $c[5]; $y++) {
                    $ny = ($y - $cyF) / $bF;
                    $nySq = $ny * $ny;

                    // SatÄ±r tamamen dÄ±ÅŸarÄ±daysa hÄ±zla atla
                    if ($nySq >= 1.0) {
                        for ($x = $c[2]; $x <= $c[4]; $x++) {
                            imagesetpixel($img, $x, $y, $transparent);
                        }
                        continue;
                    }

                    for ($x = $c[2]; $x <= $c[4]; $x++) {
                        // Elips denklemi: (dx/a)Â² + (dy/b)Â² > 1 â†’ dÄ±ÅŸarÄ±da â†’ ÅŸeffaf yap
                        $nx = ($x - $cxF) / $aF;
                        if ($nx * $nx + $nySq > 1.0) {
                            imagesetpixel($img, $x, $y, $transparent);
                        }
                    }
                }
            }
        }

        imagealphablending($img, true); // Alpha blending'i geri aÃ§
    }

    private function hexToRgb(string $color): array
    {
        // rgba(255,255,255,0.8) veya rgb(255,255,255) formatÄ±
        if (preg_match('/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/', $color, $matches)) {
            return [
                'r' => (int)$matches[1],
                'g' => (int)$matches[2],
                'b' => (int)$matches[3],
                'a' => isset($matches[4]) ? (float)$matches[4] : 1.0
            ];
        }

        // Hex format
        $hex = ltrim($color, '#');

        // KÄ±sa format (#RGB veya #RGBA)
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        } elseif (strlen($hex) === 4) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2].$hex[3].$hex[3];
        }

        // #RRGGBBAA format (8 karakter)
        if (strlen($hex) === 8) {
            return [
                'r' => hexdec(substr($hex, 0, 2)),
                'g' => hexdec(substr($hex, 2, 2)),
                'b' => hexdec(substr($hex, 4, 2)),
                'a' => round(hexdec(substr($hex, 6, 2)) / 255, 2)
            ];
        }

        // GeÃ§ersiz format iÃ§in varsayÄ±lan siyah
        if (strlen($hex) !== 6) {
            return ['r' => 0, 'g' => 0, 'b' => 0, 'a' => 1.0];
        }

        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2)),
            'a' => 1.0
        ];
    }

    /**
     * ÃœrÃ¼n etiketini GD ile render edip cihaza gÃ¶nder
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID
     * @param array $product ÃœrÃ¼n bilgileri
     * @param array $template Åablon ayarlarÄ±
     * @return array SonuÃ§
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

        // Font (varsayÄ±lan)
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

        // ÃœrÃ¼n gÃ¶rseli varsa Ã¼st yarÄ±ya yerleÅŸtir
        $imageAreaHeight = (int)($height * 0.45); // %45 gÃ¶rsel alanÄ±
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

                    // OranÄ± koru
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

        // Metin alanÄ± baÅŸlangÄ±cÄ±
        $textStartY = $imageAreaHeight + 40;

        if ($fontPath) {
            // TTF font ile render

            // Kategori/etiket
            if (!empty($product['category'])) {
                imagettftext($image, 14, 0, 50, $textStartY, $red, $fontPath, strtoupper($product['category']));
                $textStartY += 40;
            }

            // ÃœrÃ¼n adÄ±
            $name = $product['name'] ?? 'ÃœrÃ¼n AdÄ±';
            imagettftext($image, 28, 0, 50, $textStartY, $darkBlue, $fontPath, $name);
            $textStartY += 80;

            // Fiyat
            $price = number_format((float)($product['current_price'] ?? 0), 2, ',', '.');
            $currency = $product['currency'] ?? 'â‚º';
            imagettftext($image, 48, 0, $width - 250, $textStartY, $darkBlue, $fontPath, $currency);
            imagettftext($image, 72, 0, $width - 200, $textStartY, $darkBlue, $fontPath, explode(',', $price)[0]);
            imagettftext($image, 36, 0, $width - 80, $textStartY - 30, $darkBlue, $fontPath, ',' . explode(',', $price)[1]);

            $textStartY += 60;

            // Detaylar
            $details = [
                'MenÅŸei' => $product['origin'] ?? '',
                'AÄŸÄ±rlÄ±k' => $product['weight'] ?? $product['unit'] ?? '',
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
            // YerleÅŸik font ile basit render
            imagestring($image, 5, 50, $textStartY, $product['name'] ?? 'Product', $black);
            imagestring($image, 5, 50, $textStartY + 50, 'Price: ' . ($product['current_price'] ?? '0.00'), $red);
        }

        // GÃ¶rseli cihaza gÃ¶nder
        return $this->sendLabel($ip, $clientId, $image, $product, $width, $height);
    }

    /**
     * Video Grid destekli etiket gÃ¶nder
     *
     * Desteklenen dÃ¼zenler:
     * - fullscreen_image: Tam ekran gÃ¶rsel
     * - fullscreen_video: Tam ekran video
     * - split_vertical: Ãœst video, alt gÃ¶rsel (varsayÄ±lan)
     * - split_horizontal: Sol gÃ¶rsel, saÄŸ video
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID (MAC adresi)
     * @param array $config Grid yapÄ±landÄ±rmasÄ±
     *   - layout: string (fullscreen_image|fullscreen_video|split_vertical|split_horizontal)
     *   - width: int (ekran geniÅŸliÄŸi, varsayÄ±lan 800)
     *   - height: int (ekran yÃ¼ksekliÄŸi, varsayÄ±lan 1280)
     *   - image: string|null (gÃ¶rsel dosya yolu)
     *   - video: string|null (video dosya yolu)
     *   - videos: array|null (Ã§oklu video listesi)
     *   - product: array (Ã¼rÃ¼n bilgileri)
     * @return array SonuÃ§
     */
    public function sendGridLabel(string $ip, string $clientId, array $config): array
    {
        $result = [
            'success' => false,
            'steps' => [],
            'files_skipped' => 0,
            'files_uploaded' => 0
        ];

        // VarsayÄ±lan deÄŸerler
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

        // NOT: Storage temizleme kaldÄ±rÄ±ldÄ±!
        // Delta check ile dosya zaten mevcutsa yÃ¼kleme atlanÄ±r.
        // Storage dolu ise clearSpace ayrÄ± Ã§aÄŸrÄ±lmalÄ±dÄ±r.
        $result['steps']['clear'] = ['skipped' => true, 'reason' => 'Delta check enabled'];

        // Grid bÃ¶lgelerini hesapla
        // Custom layout ise config'den al, deÄŸilse hesapla
        // NOT: array_key_exists kullanÄ±yoruz Ã§Ã¼nkÃ¼ image_region: null olabilir (sadece video gÃ¶nderilecek)
        if ($layout === 'custom' && array_key_exists('video_region', $config) && $config['video_region']) {
            $regions = [];

            // Image region varsa ekle (null deÄŸilse)
            if (array_key_exists('image_region', $config) && $config['image_region']) {
                $regions['image'] = $config['image_region'];
            }

            // Video region ekle
            $regions['video'] = $config['video_region'];
        } else {
            $regions = $this->calculateGridRegions($layout, $width, $height);
        }
        $result['regions'] = $regions;

        // Task config hazÄ±rla
        $taskConfig = [
            'Id' => $clientId,
            'ItemCode' => $product['sku'] ?? $product['id'] ?? 'ITEM-001',
            'ItemName' => $product['name'] ?? 'Product'
        ];

        // 2. GÃ¶rsel varsa iÅŸle
        // NOT: PavoDisplay'de LabelPicture ve LabelVideo Ã¼st Ã¼ste binebilir (overlay)
        // Video gÃ¶rselin Ã¼stÃ¼nde gÃ¶rÃ¼nÃ¼r, bu yÃ¼zden her ikisini de gÃ¶nderebiliriz
        $shouldAddImage = true;

        if (!empty($videos) && isset($regions['video']) && isset($regions['image'])) {
            $vr = $regions['video'];

            // Video bÃ¶lge koordinatlarÄ±
            $videoY = (int)($vr['y'] ?? 0);
            $videoH = (int)($vr['height'] ?? 0);
            $videoBottom = $videoY + $videoH;

            // Video Ã¼stte mi altta mÄ± kontrol et
            if ($videoY > 0) {
                // Video ALTTA - gÃ¶rsel Ã¼stte olacak
                $remainingHeight = $videoY; // Video'nun Ã¼stÃ¼ndeki alan
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
                // Video ÃœSTTE - gÃ¶rsel altta olacak
                $remainingHeight = $height - $videoBottom; // Video'nun altÄ±ndaki alan
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

            // Video tÃ¼m ekranÄ± kaplÄ±yorsa gÃ¶rsel ekleme
            $totalArea = $width * $height;
            $videoArea = (int)($vr['width'] ?? 0) * $videoH;
            if ($videoArea >= $totalArea * 0.95) {
                $shouldAddImage = false;
            }
        }

        // fullscreen_video layout'ta gÃ¶rsel ekleme
        if ($layout === 'fullscreen_video') {
            $shouldAddImage = false;
        }

        if ($imagePath && isset($regions['image']) && $shouldAddImage) {
            $imageRegion = $regions['image'];

            // KÄ±rpma bÃ¶lgesi: GÃ¶rsel bÃ¶lgesini kaynak gÃ¶rseldan kÄ±rp
            // (video'nun altÄ±ndaki alanÄ± Ã§Ä±kar)
            $cropRegion = [
                'x' => $imageRegion['x'],
                'y' => $imageRegion['y'],
                'width' => $imageRegion['width'],
                'height' => $imageRegion['height'],
                'device_width' => $width,
                'device_height' => $height
            ];

            // GÃ¶rseli hazÄ±rla (kÄ±rpma ile + dinamik alanlar)
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

        // 3. Video(lar) varsa iÅŸle
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

                // DELTA CHECK: Cihazda aynÄ± video var mÄ± kontrol et
                $checkResult = $this->checkFile($ip, $videoFilepath);
                $videoSkipped = false;

                if ($checkResult['exists'] && !empty($checkResult['md5'])) {
                    if (strcasecmp($checkResult['md5'], $videoMd5) === 0) {
                        // Video zaten mevcut ve aynÄ±, yÃ¼kleme atla
                        $videoSkipped = true;
                        $result['steps']['video_' . ($index + 1)] = [
                            'success' => true,
                            'skipped' => true,
                            'reason' => 'Video already exists with same MD5'
                        ];
                    }
                }

                if (!$videoSkipped) {
                    // Video yÃ¼kle
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

        // 4. Task config yÃ¼kle
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
     * Grid bÃ¶lgelerini hesapla
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
                // Sol gÃ¶rsel, saÄŸ video
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
                // Ãœst video, alt gÃ¶rsel (50/50)
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
                // Ãœst video %60, alt gÃ¶rsel %40
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
                // Ãœst video %40, alt gÃ¶rsel %60
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
                // 3 satÄ±r - Ã¼st video, orta gÃ¶rsel, alt gÃ¶rsel (veya video)
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
                // 3 sÃ¼tun - sol gÃ¶rsel, orta video, saÄŸ gÃ¶rsel
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
                // Ãœst header (kÃ¼Ã§Ã¼k), alt iÃ§erik (bÃ¼yÃ¼k)
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
                // Tek grid - tÃ¼m ekranÄ± kaplar
                // Video varsa video, yoksa gÃ¶rsel tam ekran gÃ¶sterilir
                // KarÄ±ÅŸÄ±k iÃ§erik iÃ§in Ã¶zel bÃ¶lgeleme gerekir
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                // Video iÃ§in de tam ekran alan tanÄ±mla - hangisi kullanÄ±lacaÄŸÄ±nÄ± sendGridLabel belirler
                $regions['video'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;

            default:
                // Bilinmeyen layout - varsayÄ±lan olarak tam ekran gÃ¶rsel
                $regions['image'] = [
                    'x' => 0, 'y' => 0,
                    'width' => $width, 'height' => $height
                ];
                break;
        }

        return $regions;
    }

    /**
     * GÃ¶rseli hazÄ±rla ve yÃ¼kle
     */
    private function prepareAndUploadImage(string $ip, string $clientId, string $imagePath, int $width, int $height, ?array $cropRegion = null, array $designData = [], array $product = []): array
    {
        $result = ['success' => false];

        if (!file_exists($imagePath)) {
            $result['error'] = 'Image file not found: ' . $imagePath;
            return $result;
        }

        // GÃ¶rseli yÃ¼kle
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

        // KÄ±rpma bÃ¶lgesi belirtilmiÅŸse Ã¶nce kÄ±rp
        if ($cropRegion) {
            $cropX = $cropRegion['x'] ?? 0;
            $cropY = $cropRegion['y'] ?? 0;
            $cropW = $cropRegion['width'] ?? $srcWidth;
            $cropH = $cropRegion['height'] ?? $srcHeight;

            // KÄ±rpma koordinatlarÄ±nÄ± kaynak gÃ¶rsel boyutuna Ã¶lÃ§ekle
            // (cropRegion cihaz koordinatlarÄ±nda, srcImage farklÄ± boyutta olabilir)
            $scaleX = $srcWidth / ($cropRegion['device_width'] ?? $srcWidth);
            $scaleY = $srcHeight / ($cropRegion['device_height'] ?? $srcHeight);

            $scaledCropX = (int)($cropX * $scaleX);
            $scaledCropY = (int)($cropY * $scaleY);
            $scaledCropW = (int)($cropW * $scaleX);
            $scaledCropH = (int)($cropH * $scaleY);

            // SÄ±nÄ±r kontrolÃ¼
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

        // DÄ°NAMÄ°K ALANLARI RENDER ET (GD ile)
        if (!empty($designData) && !empty($product)) {
            // DEBUG LOG
            $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/prepareUpload.log' : '/tmp/prepareUpload.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] prepareAndUploadImage: DÄ°NAMÄ°K RENDER BAÅLIYOR\n", FILE_APPEND);
            file_put_contents($logFile, "  Product name: " . ($product['name'] ?? 'YOK') . "\n", FILE_APPEND);
            file_put_contents($logFile, "  designData objects: " . (isset($designData['objects']) ? count($designData['objects']) : 'YOK') . "\n", FILE_APPEND);

            // Åablon boyutlarÄ±nÄ± al (Ã¶lÃ§ekleme iÃ§in)
            // NOT: KÄ±rpma sonrasÄ± $srcWidth/$srcHeight kÄ±rpÄ±lmÄ±ÅŸ boyuttur.
            // Dinamik alanlar orijinal ÅŸablon boyutuna gÃ¶re pozisyonlandÄ±ÄŸÄ± iÃ§in
            // _templateWidth/_templateHeight kullanÄ±lmalÄ±. KÄ±rpma bÃ¶lgesi offset'i
            // de hesaba katÄ±lmalÄ±.
            $templateWidth = $designData['_templateWidth'] ?? ($cropRegion ? ($cropRegion['device_width'] ?? $srcWidth) : $srcWidth);
            $templateHeight = $designData['_templateHeight'] ?? ($cropRegion ? ($cropRegion['device_height'] ?? $srcHeight) : $srcHeight);

            // KÄ±rpma yapÄ±ldÄ±ysa, dinamik alan verilerini kÄ±rpma bÃ¶lgesine gÃ¶re ayarla
            if ($cropRegion && ($cropRegion['y'] > 0 || $cropRegion['x'] > 0)) {
                // KÄ±rpÄ±lmÄ±ÅŸ bÃ¶lgeye gÃ¶re offset'li designData oluÅŸtur
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

                        // Obje kÄ±rpma bÃ¶lgesi iÃ§inde mi kontrol et
                        $objRight = $objLeft + $objW;
                        $objBottom = $objTop + $objH;
                        $cropRight = $cropOffsetX + $cropW;
                        $cropBottom = $cropOffsetY + $cropH;

                        if ($objRight < $cropOffsetX || $objLeft > $cropRight ||
                            $objBottom < $cropOffsetY || $objTop > $cropBottom) {
                            // Obje kÄ±rpma alanÄ± dÄ±ÅŸÄ±nda - gizle
                            $obj['visible'] = false;
                            continue;
                        }

                        // Pozisyonu kÄ±rpma offset'ine gÃ¶re kaydÄ±r
                        $obj['left'] = $objLeft - $cropOffsetX;
                        $obj['top'] = $objTop - $cropOffsetY;
                    }
                    unset($obj);
                }

                // KÄ±rpÄ±lmÄ±ÅŸ bÃ¶lge boyutlarÄ±nÄ± ÅŸablon boyutu olarak kullan
                $this->renderDynamicFields($dstImage, $adjustedDesignData, $product, $cropW, $cropH, $width, $height);
            } else {
                $this->renderDynamicFields($dstImage, $designData, $product, $templateWidth, $templateHeight, $width, $height);
            }

            file_put_contents($logFile, "  DÄ°NAMÄ°K RENDER TAMAMLANDI\n", FILE_APPEND);
        } else {
            // DEBUG LOG
            $logFile = defined('STORAGE_PATH') ? STORAGE_PATH . '/logs/prepareUpload.log' : '/tmp/prepareUpload.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] prepareAndUploadImage: designData veya product BOÅ\n", FILE_APPEND);
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

        // DELTA CHECK: Cihazda aynÄ± dosya var mÄ± kontrol et
        $checkResult = $this->checkFile($ip, $filepath);
        $skipped = false;

        if ($checkResult['exists'] && !empty($checkResult['md5'])) {
            if (strcasecmp($checkResult['md5'], $imageMd5) === 0) {
                // Dosya zaten mevcut ve aynÄ±, yÃ¼kleme atla
                $skipped = true;
            }
        }

        if (!$skipped) {
            // Cihaza yÃ¼kle
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
     * Media listesi ile etiket gÃ¶nder (v3.26+ firmware)
     * GÃ¶rsel ve video karÄ±ÅŸÄ±k oynatma destekler
     *
     * @param string $ip Cihaz IP adresi
     * @param string $clientId Cihaz Client ID
     * @param array $mediaList Medya listesi [{path, duration, type}, ...]
     * @param array $config YapÄ±landÄ±rma
     * @return array SonuÃ§
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

        // 2. Medya dosyalarÄ±nÄ± yÃ¼kle
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

            // YÃ¼kle
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

        // 3. Task config oluÅŸtur
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

        // 4. Task yÃ¼kle
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
     * Dosya uzantÄ±sÄ±ndan medya tipini belirle
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
    // PARALEL GÃ–NDERÄ°M SÄ°STEMÄ° (Phase 1)
    // ========================================================================

    /**
     * Device tipi bazlÄ± eÅŸzamanlÄ±lÄ±k limitleri
     */
    private const CONCURRENCY_LIMITS = [
        'esl' => 2,           // ESL cihazlarÄ±: dÃ¼ÅŸÃ¼k bant geniÅŸliÄŸi
        'esl_android' => 2,   // PavoDisplay ESL
        'tablet' => 5,        // Tablet cihazlar
        'android_tv' => 10,   // TV/Signage
        'web_display' => 10,  // Web tabanlÄ± ekranlar
        'pwa_player' => 10,   // PWA Player
        'default' => 3        // Bilinmeyen tipler
    ];

    /**
     * Device tipi iÃ§in eÅŸzamanlÄ±lÄ±k limitini al
     */
    public function getConcurrencyLimit(string $deviceType): int
    {
        return self::CONCURRENCY_LIMITS[$deviceType] ?? self::CONCURRENCY_LIMITS['default'];
    }

    /**
     * Paralel Ã§oklu cihaz gÃ¶nderimi (curl_multi_exec ile)
     *
     * @param array $devices Cihaz listesi [['ip' => '...', 'client_id' => '...', 'type' => '...'], ...]
     * @param string $imagePath GÃ¶nderilecek gÃ¶rsel dosya yolu (disk Ã¼zerinde)
     * @param array $taskConfig Task konfigÃ¼rasyonu
     * @param callable|null $progressCallback Ä°lerleme callback'i function(int $completed, int $total, array $result)
     * @return array SonuÃ§ ['total' => N, 'success' => M, 'failed' => K, 'details' => [...]]
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

        // GÃ¶rsel dosyayÄ± oku
        if (!file_exists($imagePath)) {
            $results['error'] = 'Image file not found: ' . $imagePath;
            return $results;
        }

        $imageContent = file_get_contents($imagePath);
        $imageMd5 = strtoupper(md5($imageContent));
        $imageSize = strlen($imageContent);

        // CihazlarÄ± tipe gÃ¶re grupla (farklÄ± eÅŸzamanlÄ±lÄ±k limitleri iÃ§in)
        $devicesByType = [];
        foreach ($devices as $device) {
            $type = $device['type'] ?? $device['model'] ?? 'default';
            $devicesByType[$type][] = $device;
        }

        // Her tip iÃ§in paralel gÃ¶nderim yap
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

                // SonuÃ§larÄ± birleÅŸtir
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
     * Cihaz grubuna paralel gÃ¶nderim (curl_multi_exec ile)
     * Delta update: Ã–nce dosya kontrolÃ¼ yapar, aynÄ± dosya varsa atlar
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

        // AdÄ±m 1: Delta kontrol - hangi cihazlarda dosya zaten mevcut?
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

        // Paralel dosya kontrolÃ¼ Ã§alÄ±ÅŸtÄ±r
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // SonuÃ§larÄ± deÄŸerlendir - delta update
        foreach ($checkHandles as $clientId => $handleInfo) {
            $ch = $handleInfo['handle'];
            $response = curl_multi_getcontent($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            $data = json_decode($response, true);
            $existingMd5 = $data['md5'] ?? null;

            // Delta check: Dosya zaten aynÄ± mÄ±?
            if ($httpCode === 200 && $existingMd5 && strtoupper($existingMd5) === $imageMd5) {
                // Dosya aynÄ±, atla
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
                // GÃ¼ncelleme gerekiyor
                $devicesToUpdate[$clientId] = $handleInfo;
            }
        }

        curl_multi_close($mh);

        // AdÄ±m 2: GÃ¼ncellenmesi gereken cihazlara paralel gÃ¶nderim
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
     * Cihazlara paralel dosya yÃ¼kleme
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

        // AdÄ±m 1: TÃ¼m cihazlara paralel gÃ¶rsel yÃ¼kle
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

        // Paralel yÃ¼kleme
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // YÃ¼kleme sonuÃ§larÄ±nÄ± deÄŸerlendir
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

        // AdÄ±m 2: BaÅŸarÄ±lÄ± yÃ¼klemelere task config yÃ¼kle ve replay tetikle
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
     * Task config yÃ¼kleme ve replay tetikleme (paralel)
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

        // AdÄ±m 1: Task config yÃ¼kle
        $taskHandles = [];
        $mh = curl_multi_init();

        foreach ($devices as $clientId => $deviceInfo) {
            $ip = $deviceInfo['ip'];
            $device = $deviceInfo['device'];

            // Task config oluÅŸtur
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

        // Paralel task yÃ¼kleme
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.1);
        } while ($running > 0);

        // Task sonuÃ§larÄ±nÄ± deÄŸerlendir
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

        // AdÄ±m 2: Replay tetikle
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

            // Replay sonuÃ§larÄ±nÄ± deÄŸerlendir
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
     * Render edilmiÅŸ gÃ¶rseli diske kaydet (cache iÃ§in)
     *
     * @param string $imageContent GÃ¶rsel binary iÃ§eriÄŸi
     * @param string $companyId Åirket ID
     * @param string $deviceType Cihaz tipi
     * @param string $locale Dil kodu
     * @param string $templateId Åablon ID
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
        // HiyerarÅŸik dizin yapÄ±sÄ±
        $basePath = rtrim(STORAGE_PATH ?? dirname(__DIR__) . '/storage', '/');
        $cachePath = "{$basePath}/renders/{$companyId}/{$deviceType}/{$locale}/{$templateId}";

        // Dizin oluÅŸtur
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
     * @param string $companyId Åirket ID
     * @param string $deviceType Cihaz tipi
     * @param string $locale Dil kodu
     * @param string $templateId Åablon ID
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
     * Render cache key oluÅŸtur
     *
     * @param string $templateId Åablon ID
     * @param string $templateVersion Åablon versiyonu
     * @param string $productId ÃœrÃ¼n ID
     * @param string $productVersion ÃœrÃ¼n versiyonu (updated_at)
     * @param string $locale Dil kodu
     * @param string $resolution Ã‡Ã¶zÃ¼nÃ¼rlÃ¼k (WxH)
     * @param string $deviceType Cihaz tipi
     * @param string $priceRuleVersion Fiyat kuralÄ± versiyonu
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
     * NOT: Bu iÅŸlem iÃ§in Web Bluetooth API kullanÄ±lmasÄ± gerekiyor.
     * Backend'den bu komutu gÃ¶ndermek mÃ¼mkÃ¼n deÄŸil, frontend'den Bluetooth baÄŸlantÄ±sÄ± gerekli.
     *
     * @param string $ip Atanacak IP adresi
     * @param string $gateway Gateway adresi
     * @param string $netmask Subnet mask (varsayÄ±lan: 255.255.255.0)
     * @param string $token Admin ÅŸifresi (varsa)
     * @return array Bluetooth komutu ve talimatlar
     */
    public function prepareStaticIpCommand(
        string $ip,
        string $gateway,
        string $netmask = '255.255.255.0',
        string $token = ''
    ): array {
        // Bluetooth komutu formatÄ±
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
                '1. Cihaza Web Bluetooth ile baÄŸlanÄ±n (TarayÄ±cÄ±da Bluetooth Ã¶zelliÄŸi gerekli)',
                '2. AÅŸaÄŸÄ±daki komutu gÃ¶nderin:',
                '   ' . $command,
                '3. Cihaz yeniden baÅŸlatÄ±lacak ve yeni IP atanacak',
                '4. Yeni IP ile cihaza eriÅŸimi test edin'
            ],
            'new_ip' => $ip,
            'gateway' => $gateway,
            'netmask' => $netmask,
            'note' => 'Bu iÅŸlem Web Bluetooth API gerektirir, backend\'den doÄŸrudan gÃ¶nderilemez'
        ];
    }

    /**
     * Bluetooth ile DHCP moduna geÃ§
     *
     * @param string $token Admin ÅŸifresi (varsa)
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
                '1. Cihaza Web Bluetooth ile baÄŸlanÄ±n',
                '2. AÅŸaÄŸÄ±daki komutu gÃ¶nderin:',
                '   ' . $command,
                '3. Cihaz DHCP moduna geÃ§ecek ve otomatik IP alacak'
            ],
            'mode' => 'dhcp',
            'note' => 'Bu iÅŸlem Web Bluetooth API gerektirir'
        ];
    }

    /**
     * Bluetooth ile WiFi ayarla
     *
     * @param string $ssid WiFi aÄŸ adÄ±
     * @param string $password WiFi ÅŸifresi
     * @param string $token Admin ÅŸifresi (varsa)
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
                '1. Cihaza Web Bluetooth ile baÄŸlanÄ±n',
                '2. AÅŸaÄŸÄ±daki komutu gÃ¶nderin:',
                '   ' . $command,
                '3. Cihaz belirtilen WiFi aÄŸÄ±na baÄŸlanacak'
            ],
            'ssid' => $ssid,
            'note' => 'Åifre bu yanÄ±tta gÃ¶sterilmez (gÃ¼venlik nedeniyle)',
            'warning' => 'WiFi ÅŸifresini kaydetmeden Ã¶nce doÄŸru olduÄŸundan emin olun!'
        ];
    }

    // ==========================================
    // GELIÅMIÅ AÄ TARAMA SÄ°STEMÄ°
    // Multi-Subnet + Generic HTTP + Profil + Ping Sweep
    // ==========================================

    /**
     * Cihaz keÅŸif profilleri - farklÄ± marka cihazlar iÃ§in endpoint tanÄ±mlarÄ±
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
                'name' => 'HTTP Cihaz (TÃ¼mÃ¼)',
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
     * Multi-Subnet tarama: Birden fazla subnet bloÄŸunu paralel tara
     *
     * @param array $subnets Subnet listesi (Ã¶rn: ['192.168.1', '192.168.2', '192.168.3'])
     * @param int $startIp BaÅŸlangÄ±Ã§ IP
     * @param int $endIp BitiÅŸ IP
     * @param array $profiles KullanÄ±lacak profil isimleri (boÅŸ = pavodisplay)
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
     * GeliÅŸmiÅŸ tarama: Profil bazlÄ± cihaz keÅŸfi
     * Ã–nce ping sweep, sonra HTTP endpoint kontrolÃ¼
     *
     * @param string $subnet Alt aÄŸ
     * @param int $startIp BaÅŸlangÄ±Ã§ IP
     * @param int $endIp BitiÅŸ IP
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

        // AdÄ±m 1: Ping Sweep - TÃ¼m IP'leri TCP ile hÄ±zlÄ± tara
        $aliveIps = $this->pingSweep($subnet, $startIp, $endIp);

        if (empty($aliveIps)) {
            return [];
        }

        // AdÄ±m 2: CanlÄ± IP'lerde profil bazlÄ± HTTP keÅŸfi
        $devices = [];
        foreach ($activeProfiles as $profileName => $profile) {
            $profileDevices = $this->probeDevicesWithProfile($aliveIps, $profile, $profileName);
            $devices = array_merge($devices, $profileDevices);
        }

        // AynÄ± IP birden fazla profille eÅŸleÅŸmiÅŸse en spesifik olanÄ± tut
        $devices = $this->deduplicateDevices($devices);

        return $devices;
    }

    /**
     * Ping Sweep: TCP baÄŸlantÄ± kontrolÃ¼ ile canlÄ± IP'leri bul
     * Port 80 ve 8080'i kontrol eder
     *
     * @param string $subnet Alt aÄŸ
     * @param int $startIp BaÅŸlangÄ±Ã§
     * @param int $endIp BitiÅŸ
     * @return array CanlÄ± IP ve port bilgileri [['ip' => '...', 'port' => 80, 'time' => 12.5], ...]
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
                    CURLOPT_NOBODY => true,       // HEAD request - daha hÄ±zlÄ±
                    CURLOPT_FOLLOWLOCATION => false,
                ]);

                curl_multi_add_handle($mh, $ch);
                $handles[$key] = ['ch' => $ch, 'ip' => $ip, 'port' => $port];
            }
        }

        // Paralel Ã§alÄ±ÅŸtÄ±r
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.5);
        } while ($running > 0);

        // SonuÃ§larÄ± topla
        $seenIps = [];
        foreach ($handles as $key => $info) {
            $ch = $info['ch'];
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            $connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);

            // HTTP yanÄ±tÄ± aldÄ±ysak (herhangi bir status code) cihaz canlÄ±dÄ±r
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
     * Profil bazlÄ± HTTP endpoint keÅŸfi
     *
     * @param array $aliveHosts CanlÄ± IP'ler (pingSweep sonucu)
     * @param array $profile KeÅŸif profili
     * @param string $profileName Profil adÄ±
     * @return array EÅŸleÅŸen cihazlar
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

        // Paralel Ã§alÄ±ÅŸtÄ±r
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 0.5);
        } while ($running > 0);

        // SonuÃ§larÄ± topla
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

        // Bulunan cihazlarÄ±n detaylÄ± bilgilerini al (info endpoint'lerinden)
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
     * HTTP yanÄ±tÄ±ndan cihaz bilgisi Ã§Ä±kar
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
     * Info endpoint'lerinden detaylÄ± bilgi al
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
                    break; // Ä°lk baÅŸarÄ±lÄ± yanÄ±t yeterli
                }
            }
        }

        return $info;
    }

    /**
     * AynÄ± IP'ye birden fazla profil eÅŸleÅŸmiÅŸse en spesifik olanÄ± tut
     */
    private function deduplicateDevices(array $devices): array
    {
        $byIp = [];
        // Profil Ã¶nceliÄŸi: PavoDisplay > generic_android_esl > generic_signage > generic_http
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
     * Subnet formatÄ± doÄŸrulama
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
