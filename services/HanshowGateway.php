<?php
/**
 * Hanshow ESL Gateway Service
 *
 * Hanshow ESL-Working API ile iletisim icin kullanilir.
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

class HanshowGateway
{
    private $baseUrl;
    private $userId;
    private $callbackUrl;
    private $timeout;
    private $db;

    /**
     * Constructor
     *
     * @param array|null $settings Ayarlar (null ise veritabanindan yukler)
     */
    public function __construct($settings = null)
    {
        $this->db = Database::getInstance();

        if ($settings === null) {
            $settings = $this->loadSettings();
        }

        $this->baseUrl = rtrim($settings['eslworking_url'] ?? 'http://127.0.0.1:9000', '/');
        $this->userId = $settings['user_id'] ?? 'default';
        $this->callbackUrl = $settings['callback_url'] ?? '';
        $this->timeout = $settings['timeout'] ?? 30;

        // Generate default callback URL if not provided
        if (empty($this->callbackUrl)) {
            $this->callbackUrl = $this->generateCallbackUrl();
        }
    }

    /**
     * Generate default callback URL based on server configuration
     * ESL-Working requires a valid back_url even for simple operations
     */
    private function generateCallbackUrl()
    {
        // Try to get the server URL from various sources
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';

        // Get the base path from the script
        $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
        $basePath = '';

        // Extract base path (e.g., /market-etiket-sistemi)
        if (preg_match('#^(/[^/]+)/#', $scriptPath, $matches)) {
            $basePath = $matches[1];
        }

        // Build URL if we have a valid host
        if (!empty($host) && $host !== '127.0.0.1' && $host !== 'localhost') {
            return "{$protocol}://{$host}{$basePath}/api/hanshow/callback";
        }

        // Fallback: Use the server's IP address from config or try to detect it
        $serverIp = $this->getServerIp();
        if (!empty($serverIp)) {
            return "http://{$serverIp}{$basePath}/api/hanshow/callback";
        }

        // Last resort: Use a valid-looking URL that ESL-Working will accept
        // ESL-Working validates URL format but doesn't need to actually reach it for LED flash
        return "http://192.168.1.1/api/hanshow/callback";
    }

    /**
     * Try to detect server's IP address
     */
    private function getServerIp()
    {
        // Try SERVER_ADDR first
        if (!empty($_SERVER['SERVER_ADDR']) && $_SERVER['SERVER_ADDR'] !== '127.0.0.1') {
            return $_SERVER['SERVER_ADDR'];
        }

        // Try to get from network interfaces (Windows/Linux)
        if (function_exists('shell_exec')) {
            if (PHP_OS_FAMILY === 'Windows') {
                // Windows: Parse ipconfig
                $output = @shell_exec('ipconfig');
                if ($output && preg_match('/IPv4[^:]*:\s*(\d+\.\d+\.\d+\.\d+)/i', $output, $matches)) {
                    if ($matches[1] !== '127.0.0.1') {
                        return $matches[1];
                    }
                }
            } else {
                // Linux: Use hostname -I
                $output = @shell_exec('hostname -I 2>/dev/null');
                if ($output) {
                    $ips = explode(' ', trim($output));
                    foreach ($ips as $ip) {
                        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && $ip !== '127.0.0.1') {
                            return $ip;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Ayarlari veritabanindan yukle
     */
    private function loadSettings()
    {
        $user = Auth::user();
        $companyId = $user['company_id'] ?? null;

        if ($companyId) {
            $settings = $this->db->fetch(
                "SELECT * FROM hanshow_settings WHERE company_id = ?",
                [$companyId]
            );
            if ($settings) {
                return $settings;
            }
        }

        return [
            'eslworking_url' => 'http://127.0.0.1:9000',
            'user_id' => 'default',
            'callback_url' => ''
        ];
    }

    /**
     * ESL-Working baglantisini test et
     */
    public function ping()
    {
        $startTime = microtime(true);
        $result = $this->getAPs();
        $responseTime = round((microtime(true) - $startTime) * 1000);

        // v2.5.3 uses 'errno' instead of 'status_no'
        $success = (isset($result['errno']) && $result['errno'] === 0) ||
                   (isset($result['status_no']) && $result['status_no'] === 0);

        return [
            'success' => $success,
            'response_time' => $responseTime,
            'connected_aps' => $this->countOnlineAPs($result),
            'data' => $result
        ];
    }

    /**
     * Online AP sayisini hesapla
     */
    private function countOnlineAPs($result)
    {
        $count = 0;
        if (isset($result['ap_list'])) {
            foreach ($result['ap_list'] as $gen => $aps) {
                foreach ($aps as $ap) {
                    if (!empty($ap['online'])) {
                        $count++;
                    }
                }
            }
        }
        return $count;
    }

    /**
     * API yanitinin basarili olup olmadigini kontrol et
     */
    private function isApiSuccess($result)
    {
        return (isset($result['errno']) && (int)$result['errno'] === 0) ||
               (isset($result['status_no']) && (int)$result['status_no'] === 0);
    }

    /**
     * AP "online" alani false donse bile, ESL tarafinda online cihazlar varsa
     * AP durumunu turetilmis olarak online'a cek.
     */
    private function enrichApsWithOnlineFallback($apsResult)
    {
        if (!$this->isApiSuccess($apsResult) || empty($apsResult['ap_list']) || !is_array($apsResult['ap_list'])) {
            return $apsResult;
        }

        // Dogrudan online AP varsa fallback'e gerek yok
        if ($this->countOnlineAPs($apsResult) > 0) {
            return $apsResult;
        }

        $eslResult = $this->request('GET', '/esls?page=1&limit=1000');
        if (!$this->isApiSuccess($eslResult)) {
            return $apsResult;
        }

        $eslList = [];
        if (isset($eslResult['result']['esl_list']) && is_array($eslResult['result']['esl_list'])) {
            $eslList = $eslResult['result']['esl_list'];
        } elseif (isset($eslResult['esl_list']) && is_array($eslResult['esl_list'])) {
            $eslList = $eslResult['esl_list'];
        } elseif (isset($eslResult['data']) && is_array($eslResult['data'])) {
            $eslList = $eslResult['data'];
        }

        if (empty($eslList)) {
            return $apsResult;
        }

        $onlineApMacs = [];
        foreach ($eslList as $esl) {
            $status = $esl['status'] ?? null;
            $isOnline = ($status === 1 || $status === '1') || !empty($esl['online']) || !empty($esl['is_online']);
            $apMac = strtoupper(trim((string)($esl['ap_mac'] ?? '')));
            if ($isOnline && $apMac !== '') {
                $onlineApMacs[$apMac] = true;
            }
        }

        if (empty($onlineApMacs)) {
            return $apsResult;
        }

        foreach ($apsResult['ap_list'] as $gen => $aps) {
            if (!is_array($aps)) {
                continue;
            }

            foreach ($aps as $idx => $ap) {
                $apMac = strtoupper(trim((string)($ap['mac'] ?? '')));
                if ($apMac === '' || !isset($onlineApMacs[$apMac])) {
                    continue;
                }

                if (empty($apsResult['ap_list'][$gen][$idx]['online'])) {
                    $apsResult['ap_list'][$gen][$idx]['online'] = true;
                    $apsResult['ap_list'][$gen][$idx]['online_derived'] = true;
                }
            }
        }

        return $apsResult;
    }

    /**
     * Tek ESL'e icerik gonder
     *
     * @param string $eslId ESL ID (XX-XX-XX-XX format)
     * @param array $content Ekran icerigi
     * @param array $options Ek secenekler
     */
    public function sendToESL($eslId, $content, $options = [])
    {
        $sid = $this->generateSid();
        $priority = $options['priority'] ?? 10;
        $forceUpdate = $options['force_update'] ?? false;
        $callbackUrl = $this->getValidCallbackUrl();

        $payload = [
            'sid' => $sid,
            'priority' => $priority,
            'back_url' => $callbackUrl,
            'screen' => $content,
            'force_update' => $forceUpdate
        ];

        // LED flash ekle (opsiyonel)
        if (!empty($options['flash_light'])) {
            $payload['control'] = [
                'flash_light' => $options['flash_light']
            ];
        }

        $result = $this->request('PUT', "/esls/{$eslId}", $payload);

        // Kuyruga kaydet
        $this->logQueue($eslId, $sid, $content, 'template', $result);

        return array_merge($result, ['sid' => $sid]);
    }

    /**
     * Tek ESL'e gorsel gonder
     *
     * @param string $eslId ESL ID
     * @param string $imageBase64 Base64 encoded gorsel
     * @param array $options Ek secenekler
     */
    public function sendImageToESL($eslId, $imageBase64, $options = [])
    {
        $content = [
            'name' => $options['name'] ?? 'omnex_image_' . time(),
            'pages' => [
                [
                    'id' => 0,
                    'name' => 'main',
                    'image' => $imageBase64
                ]
            ]
        ];

        return $this->sendToESL($eslId, $content, $options);
    }

    /**
     * Toplu ESL guncelleme
     *
     * @param array $updates Guncelleme listesi
     */
    public function batchUpdate($updates)
    {
        $callbackUrl = $this->getValidCallbackUrl();
        $data = [];
        $sids = [];

        foreach ($updates as $update) {
            $sid = $this->generateSid();
            $sids[$update['esl_id']] = $sid;

            $data[] = [
                'esl_id' => $update['esl_id'],
                'sid' => $sid,
                'priority' => $update['priority'] ?? 10,
                'back_url' => $callbackUrl,
                'screen' => $update['content'],
                'force_update' => $update['force_update'] ?? false
            ];
        }

        $result = $this->request('PUT', '/esls', ['data' => $data]);

        return array_merge($result, ['sids' => $sids]);
    }

    /**
     * Toplu ekran guncelleme
     */
    public function batchScreenUpdate($updates)
    {
        $callbackUrl = $this->getValidCallbackUrl();
        $data = [];

        foreach ($updates as $update) {
            $data[] = [
                'esl_id' => $update['esl_id'],
                'sid' => $this->generateSid(),
                'priority' => $update['priority'] ?? 10,
                'back_url' => $callbackUrl,
                'name' => $update['name'] ?? 'screen_' . time(),
                'pages' => $update['pages'] ?? []
            ];
        }

        return $this->request('PUT', '/esls/screen', ['data' => $data]);
    }

    /**
     * LED kontrolu
     *
     * ESL-Working v2.5.3 format:
     * - Root level parameters for validation (id, page_id, stay_time, led_color, loop_count)
     * - flash_light object for actual LED timing control
     *
     * @param string $eslId ESL ID
     * @param array $colors Renk listesi ['red', 'green', 'blue'] - ilk renk kullanilir
     * @param array $options Zamanlama ayarlari
     */
    public function flashLight($eslId, $colors = ['green'], $options = [])
    {
        // Ensure we have a valid callback URL
        $callbackUrl = $this->getValidCallbackUrl();
        $sid = $this->generateSid();

        // Get first color from array
        $ledColor = is_array($colors) ? ($colors[0] ?? 'green') : $colors;

        // LED timing parameters
        $onTime = $options['on_time'] ?? 50;      // 30ms birimi: 50 * 30ms = 1.5s
        $offTime = $options['off_time'] ?? 50;    // 30ms birimi
        $flashCount = $options['flash_count'] ?? 3;
        $sleepTime = $options['sleep_time'] ?? 100;
        $loopCount = $options['loop_count'] ?? 3;

        // ESL-Working v2.5.3: Both root level params AND flash_light object
        $payload = [
            'back_url' => $callbackUrl,
            'id' => $eslId,
            'page_id' => $options['page_id'] ?? 0,
            'stay_time' => $options['stay_time'] ?? 0,  // 0-3 arasi (0=kalici)
            'led_color' => $ledColor,
            'loop_count' => $loopCount,
            // flash_light objesi - gercek LED zamanlama kontrolu
            'flash_light' => [
                'colors' => is_array($colors) ? $colors : [$colors],
                'on_time' => $onTime,
                'off_time' => $offTime,
                'flash_count' => $flashCount,
                'sleep_time' => $sleepTime,
                'loop_count' => $loopCount
            ]
        ];

        $result = $this->request('PUT', '/esls/control', $payload);

        // Add debug info for troubleshooting
        $result['_debug'] = [
            'callback_url_used' => $callbackUrl,
            'esl_id' => $eslId,
            'sid' => $sid,
            'led_color' => $ledColor,
            'flash_light' => $payload['flash_light'],
            'payload_sent' => $payload
        ];

        return $result;
    }

    /**
     * Get a valid callback URL, never returns empty
     */
    private function getValidCallbackUrl()
    {
        // If we have a configured callback URL, use it
        if (!empty($this->callbackUrl) && filter_var($this->callbackUrl, FILTER_VALIDATE_URL)) {
            return $this->callbackUrl;
        }

        // Try to generate one
        $generated = $this->generateCallbackUrl();
        if (!empty($generated) && filter_var($generated, FILTER_VALIDATE_URL)) {
            return $generated;
        }

        // Absolute fallback - ESL-Working requires a valid URL format
        // but doesn't need to actually reach it for LED flash operations
        return 'http://omnex.local/api/hanshow/callback';
    }

    /**
     * Toplu LED kontrolu
     *
     * ESL-Working v2.5.3: Her ESL icin ayri istek gonderilmeli
     */
    public function batchFlashLight($eslIds, $colors = ['green'], $options = [])
    {
        $results = [];
        $ledColor = is_array($colors) ? ($colors[0] ?? 'green') : $colors;

        foreach ($eslIds as $eslId) {
            $results[$eslId] = $this->flashLight($eslId, [$ledColor], $options);
        }

        // Return summary
        $successCount = 0;
        $failCount = 0;
        foreach ($results as $r) {
            if (isset($r['errno']) && $r['errno'] <= 1) {
                $successCount++;
            } else {
                $failCount++;
            }
        }

        return [
            'errno' => $failCount === 0 ? 1 : 101,
            'errmsg' => $failCount === 0 ? 'In processing' : "Some ESLs failed: {$failCount}/" . count($eslIds),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'results' => $results
        ];
    }

    /**
     * Sayfa degistir
     *
     * ESL-Working v2.5.3 format: All parameters at root level
     */
    public function switchPage($eslId, $pageId = 0, $stayTime = 0)
    {
        $callbackUrl = $this->getValidCallbackUrl();
        $sid = $this->generateSid();

        // ESL-Working v2.5.3: All control parameters at root level
        // stay_time: 0-3 arasi (0=kalici, 1-3=saniye)
        $stayTime = min(3, max(0, (int)$stayTime));

        $payload = [
            'back_url' => $callbackUrl,
            'id' => $eslId,
            'page_id' => (int)$pageId,
            'stay_time' => $stayTime,
            'led_color' => 'green',  // Gecerli renk gerekli, loop_count=0 ile LED yanmaz
            'loop_count' => 0,
            'data' => [[
                'esl_id' => $eslId,
                'sid' => $sid,
                'priority' => 1
            ]]
        ];

        return $this->request('PUT', '/esls/control', $payload);
    }

    /**
     * Tum ESL tiplerini/firmware'leri al
     */
    public function getFirmwares()
    {
        $result = $this->request('GET', '/esls/firmwares');

        // Cache'e kaydet
        if (isset($result['data']) && is_array($result['data'])) {
            $this->cacheFirmwares($result['data']);
        }

        return $result;
    }

    /**
     * Tek firmware bilgisi al
     */
    public function getFirmware($firmwareId)
    {
        return $this->request('GET', "/esls/firmwares/{$firmwareId}");
    }

    /**
     * Tum kullanicilari ve AP'leri al
     */
    public function getUsers()
    {
        return $this->request('GET', '/users');
    }

    /**
     * Belirli kullanici bilgisi al
     */
    public function getUser()
    {
        return $this->request('GET', '/user');
    }

    /**
     * AP ata
     */
    public function assignAP($mac, $allowV1 = false)
    {
        return $this->request('PUT', '/users/ap', [
            'mac' => $mac,
            'allow_bind_v1esl' => $allowV1
        ]);
    }

    /**
     * AP kaldir
     */
    public function removeAP($mac)
    {
        return $this->request('DELETE', "/users/ap/{$mac}");
    }

    /**
     * ESL ROM/firmware guncelle
     */
    public function upgradeESL($eslId, $romFile, $stream)
    {
        $callbackUrl = $this->getValidCallbackUrl();

        $payload = [
            'sid' => $this->generateSid(),
            'back_url' => $callbackUrl,
            'romfile' => $romFile,
            'stream' => $stream
        ];

        return $this->request('PUT', "/esls/{$eslId}/rom", $payload);
    }

    // ==================== Helper Methods ====================

    /**
     * Urun ve template'den gorsel olustur
     *
     * @param array $product Urun bilgileri
     * @param array $template Template ayarlari
     * @param int $width Genislik
     * @param int $height Yukseklik
     * @param string $color Ekran renk modu (BW, BWR, BWRY)
     */
    public function renderImage($product, $template, $width, $height, $color = 'BWR')
    {
        // GD ile gorsel olustur
        $img = imagecreatetruecolor($width, $height);

        // Renk paleti
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        $red = imagecolorallocate($img, 255, 0, 0);
        $yellow = imagecolorallocate($img, 255, 255, 0);

        // Arkaplan beyaz
        imagefilledrectangle($img, 0, 0, $width, $height, $white);

        // Font yolu
        $fontPath = defined('BASE_PATH') ? BASE_PATH . '/fonts/arial.ttf' : __DIR__ . '/../fonts/arial.ttf';
        $fontBold = defined('BASE_PATH') ? BASE_PATH . '/fonts/arialbd.ttf' : __DIR__ . '/../fonts/arialbd.ttf';

        // Fallback: sistem fontu
        if (!file_exists($fontPath)) {
            $fontPath = 'arial';
            $fontBold = 'arial';
        }

        // Urun adi
        $name = mb_substr($product['name'] ?? 'Urun', 0, 20, 'UTF-8');
        if (function_exists('imagettftext') && file_exists($fontPath)) {
            imagettftext($img, 12, 0, 5, 20, $black, $fontPath, $name);
        } else {
            imagestring($img, 4, 5, 5, $name, $black);
        }

        // Fiyat
        $price = number_format($product['current_price'] ?? 0, 2, ',', '.');
        $priceColor = ($color === 'BW') ? $black : $red;

        if (function_exists('imagettftext') && file_exists($fontBold)) {
            imagettftext($img, 24, 0, 5, 60, $priceColor, $fontBold, $price);
            imagettftext($img, 10, 0, 5 + strlen($price) * 15, 45, $priceColor, $fontPath, 'TL');
        } else {
            imagestring($img, 5, 5, 35, $price . ' TL', $priceColor);
        }

        // Birim
        $unit = $product['unit'] ?? 'Adet';
        if (function_exists('imagettftext') && file_exists($fontPath)) {
            imagettftext($img, 10, 0, 5, 80, $black, $fontPath, '/' . $unit);
        } else {
            imagestring($img, 2, 5, 70, '/' . $unit, $black);
        }

        // Barkod (varsa)
        if (!empty($product['barcode'])) {
            $barcode = $product['barcode'];
            if (function_exists('imagettftext') && file_exists($fontPath)) {
                imagettftext($img, 8, 0, 5, $height - 10, $black, $fontPath, $barcode);
            } else {
                imagestring($img, 1, 5, $height - 15, $barcode, $black);
            }
        }

        // Eski fiyat (varsa)
        if (!empty($product['previous_price']) && $product['previous_price'] > $product['current_price']) {
            $oldPrice = number_format($product['previous_price'], 2, ',', '.');
            if (function_exists('imagettftext') && file_exists($fontPath)) {
                imagettftext($img, 10, 0, $width - 70, 20, $black, $fontPath, $oldPrice . ' TL');
                // Ustu cizili
                imageline($img, $width - 70, 17, $width - 10, 17, $black);
            }
        }

        // Base64'e donustur
        ob_start();
        imagepng($img);
        $imageData = ob_get_clean();
        imagedestroy($img);

        return base64_encode($imageData);
    }

    /**
     * Fabric.js template'i Hanshow layout'a donustur
     */
    public function createLayout($product, $template, $width, $height)
    {
        $layout = [
            'direction' => 0,
            'screen_block' => []
        ];

        // Template content'i parse et
        $content = is_string($template['content']) ? json_decode($template['content'], true) : $template['content'];

        if (!$content || !isset($content['objects'])) {
            // Varsayilan layout olustur
            return $this->createDefaultLayout($product, $width, $height);
        }

        foreach ($content['objects'] as $obj) {
            $block = $this->convertFabricObject($obj, $product);
            if ($block) {
                $layout['screen_block'][] = $block;
            }
        }

        return json_encode($layout, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Varsayilan layout olustur
     */
    private function createDefaultLayout($product, $width, $height)
    {
        $layout = [
            'direction' => 0,
            'screen_block' => [
                // Urun adi
                [
                    'start_x' => 5,
                    'start_y' => 5,
                    'end_x' => $width - 5,
                    'end_y' => 30,
                    'font_type' => 'Arial Bold 14',
                    'font_size' => 14,
                    'content_type' => 'CONTENT_TYPE_TEXT',
                    'content_title' => 'name',
                    'content_value' => $product['name'] ?? '',
                    'content_color' => 'BLACK',
                    'content_alignment' => 'LEFT'
                ],
                // Fiyat
                [
                    'start_x' => 5,
                    'start_y' => 35,
                    'end_x' => $width - 5,
                    'end_y' => 80,
                    'font_type' => 'Arial Bold 32',
                    'font_size' => 32,
                    'content_type' => 'CONTENT_TYPE_NUMBER',
                    'content_title' => 'price',
                    'content_value' => number_format($product['current_price'] ?? 0, 2),
                    'content_color' => 'RED',
                    'content_alignment' => 'LEFT',
                    'number_script' => 'SUPER',
                    'number_gap' => 'CONSECUTIVE'
                ],
                // Birim
                [
                    'start_x' => 5,
                    'start_y' => 85,
                    'end_x' => 50,
                    'end_y' => 100,
                    'font_type' => 'Arial 10',
                    'font_size' => 10,
                    'content_type' => 'CONTENT_TYPE_TEXT',
                    'content_title' => 'unit',
                    'content_value' => '/' . ($product['unit'] ?? 'Adet'),
                    'content_color' => 'BLACK',
                    'content_alignment' => 'LEFT'
                ]
            ]
        ];

        // Barkod varsa ekle
        if (!empty($product['barcode'])) {
            $layout['screen_block'][] = [
                'start_x' => 5,
                'start_y' => $height - 25,
                'end_x' => $width - 5,
                'end_y' => $height - 5,
                'content_type' => 'CONTENT_TYPE_BARCODE',
                'content_title' => 'barcode',
                'content_value' => $product['barcode'],
                'content_color' => 'BLACK'
            ];
        }

        return json_encode($layout, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Fabric.js objesini Hanshow block'a donustur
     */
    private function convertFabricObject($obj, $product)
    {
        $block = [
            'start_x' => (int)($obj['left'] ?? 0),
            'start_y' => (int)($obj['top'] ?? 0),
            'end_x' => (int)(($obj['left'] ?? 0) + (($obj['width'] ?? 100) * ($obj['scaleX'] ?? 1))),
            'end_y' => (int)(($obj['top'] ?? 0) + (($obj['height'] ?? 50) * ($obj['scaleY'] ?? 1))),
            'content_color' => $this->convertColor($obj['fill'] ?? '#000000')
        ];

        switch ($obj['type'] ?? '') {
            case 'textbox':
            case 'i-text':
            case 'text':
                $block['content_type'] = 'CONTENT_TYPE_TEXT';
                $block['font_type'] = ($obj['fontFamily'] ?? 'Arial') . ' ' . ($obj['fontSize'] ?? 12);
                $block['font_size'] = (int)($obj['fontSize'] ?? 12);
                $block['content_title'] = $obj['dynamicField'] ?? 'text';
                $block['content_value'] = $this->replaceDynamicValue($obj['text'] ?? '', $product);
                $block['content_alignment'] = strtoupper($obj['textAlign'] ?? 'left');

                // Kalin/Italik
                if (!empty($obj['fontWeight']) && $obj['fontWeight'] === 'bold') {
                    $block['font_type'] .= ' Bold';
                }
                break;

            case 'rect':
                $block['content_type'] = 'CONTENT_TYPE_RECTANGLE';
                $block['content_reverse'] = !empty($obj['fill']) && $obj['fill'] !== '#ffffff';
                break;

            case 'line':
                $block['content_type'] = 'CONTENT_TYPE_LINE';
                break;

            case 'image':
                $block['content_type'] = 'CONTENT_TYPE_IMAGE';
                $block['content_value'] = $obj['src'] ?? '';
                break;

            default:
                return null;
        }

        return $block;
    }

    /**
     * Hex rengi Hanshow renk adina donustur
     */
    private function convertColor($hex)
    {
        if (empty($hex) || $hex === 'transparent') {
            return 'BLACK';
        }

        $hex = ltrim($hex, '#');

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));

        // Renk eslestirme (en yakin renk)
        if ($r > 200 && $g < 100 && $b < 100) return 'RED';
        if ($r > 200 && $g > 200 && $b < 100) return 'YELLOW';
        if ($r > 200 && $g > 200 && $b > 200) return 'WHITE';

        return 'BLACK';
    }

    /**
     * Dinamik degerleri degistir
     */
    private function replaceDynamicValue($text, $product)
    {
        $replacements = [
            '{{product_name}}' => $product['name'] ?? '',
            '{{name}}' => $product['name'] ?? '',
            '{{sku}}' => $product['sku'] ?? '',
            '{{barcode}}' => $product['barcode'] ?? '',
            '{{current_price}}' => number_format($product['current_price'] ?? 0, 2, ',', '.'),
            '{{price}}' => number_format($product['current_price'] ?? 0, 2, ',', '.'),
            '{{previous_price}}' => number_format($product['previous_price'] ?? 0, 2, ',', '.'),
            '{{unit}}' => $product['unit'] ?? 'Adet',
            '{{origin}}' => $product['origin'] ?? '',
            '{{category}}' => $product['category'] ?? '',
            '{{description}}' => $product['description'] ?? ''
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $text);
    }

    /**
     * Firmware listesini cache'e kaydet
     */
    private function cacheFirmwares($firmwares)
    {
        foreach ($firmwares as $fw) {
            $this->db->query(
                "INSERT OR REPLACE INTO hanshow_firmwares
                (id, name, description, magnet, led, mpd, generation, heartbeat, direction,
                battery, freezer, dpi, ic, display_mode, screen_type, resolution_x, resolution_y,
                screen_color, screen_size, refresh_time, flash_size, max_package, osd_version,
                max_page_num, esl_model, mix_mode, screen_model, cached_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                [
                    $fw['id'],
                    $fw['name'] ?? '',
                    $fw['description'] ?? '',
                    $fw['magnet'] ?? 0,
                    $fw['led'] ?? 0,
                    $fw['mpd'] ?? 0,
                    $fw['generation'] ?? 0,
                    $fw['heartbeat'] ?? 1,
                    $fw['direction'] ?? 0,
                    $fw['battery'] ?? '',
                    $fw['freezer'] ?? 0,
                    $fw['dpi'] ?? 0,
                    $fw['ic'] ?? '',
                    $fw['display_mode'] ?? '',
                    $fw['screen_type'] ?? '',
                    $fw['resolution_x'] ?? 0,
                    $fw['resolution_y'] ?? 0,
                    $fw['screen_color'] ?? '',
                    $fw['screen_size'] ?? '',
                    $fw['refresh_time'] ?? 0,
                    $fw['flash_size'] ?? 0,
                    $fw['max_package'] ?? 0,
                    $fw['osd_version'] ?? 0,
                    $fw['max_page_num'] ?? 1,
                    $fw['esl_model'] ?? '',
                    $fw['mix_mode'] ?? 0,
                    $fw['screen_model'] ?? ''
                ]
            );
        }
    }

    /**
     * Gonderim islemini kuyruga kaydet
     */
    private function logQueue($eslId, $sid, $content, $type, $result)
    {
        $user = Auth::user();
        $companyId = $user['company_id'] ?? null;

        if (!$companyId) return;

        $this->db->insert('hanshow_queue', [
            'id' => $this->db->generateUuid(),
            'company_id' => $companyId,
            'esl_id' => $eslId,
            'session_id' => $sid,
            'content_type' => $type,
            'content_data' => is_array($content) ? json_encode($content) : $content,
            'status' => isset($result['status_no']) && $result['status_no'] <= 1 ? 'processing' : 'failed',
            'error_message' => $result['errmsg'] ?? null
        ]);
    }

    /**
     * Tum AP'leri listele
     */
    public function getAPs()
    {
        $result = $this->request('GET', '/aps');
        return $this->enrichApsWithOnlineFallback($result);
    }

    /**
     * Tum ESL'leri listele
     *
     * @param int $page Sayfa numarasi
     * @param int $limit Sayfa basina kayit
     */
    public function getESLs($page = 1, $limit = 100)
    {
        return $this->request('GET', "/esls?page={$page}&limit={$limit}");
    }

    /**
     * Tek ESL bilgisi al
     */
    public function getESL($eslId)
    {
        return $this->request('GET', "/esls/{$eslId}");
    }

    /**
     * ESL kaydet/bagla
     */
    public function registerESL($eslId, $apMac = null)
    {
        $payload = [
            'esl_id' => $eslId
        ];

        if ($apMac) {
            $payload['ap_mac'] = $apMac;
        }

        return $this->request('POST', '/esls', $payload);
    }

    /**
     * ESL kaydini sil
     */
    public function unregisterESL($eslId)
    {
        return $this->request('DELETE', "/esls/{$eslId}");
    }

    /**
     * HTTP istegi gonder
     */
    private function request($method, $endpoint, $data = null)
    {
        // ESL-Working v2.5.3 uses /api2/ prefix
        // Global endpoints (no user context needed) - /esls ile baslayan tum endpoint'ler global
        $globalPrefixes = ['/users', '/aps', '/esls'];

        $isGlobal = false;
        foreach ($globalPrefixes as $prefix) {
            if (strpos($endpoint, $prefix) === 0) {
                $isGlobal = true;
                break;
            }
        }

        if ($isGlobal) {
            $url = $this->baseUrl . '/api2' . $endpoint;
        } else {
            $url = $this->baseUrl . '/api2/' . $this->userId . $endpoint;
        }

        $ch = curl_init();

        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json'
            ]
        ];

        if ($data !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($data, JSON_UNESCAPED_UNICODE);
        }

        curl_setopt_array($ch, $options);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'status_no' => -1,
                'errmsg' => 'CURL Error: ' . $error,
                'http_code' => $httpCode
            ];
        }

        $decoded = json_decode($response, true);

        if ($decoded === null) {
            return [
                'success' => false,
                'status_no' => -2,
                'errmsg' => 'Invalid JSON response',
                'raw_response' => $response,
                'http_code' => $httpCode
            ];
        }

        $decoded['success'] = isset($decoded['status_no']) && $decoded['status_no'] <= 1;
        $decoded['http_code'] = $httpCode;

        return $decoded;
    }

    /**
     * Benzersiz session ID olustur
     */
    private function generateSid()
    {
        return 'omnex_' . uniqid('', true) . '_' . time();
    }

    /**
     * Callback verilerini isle
     */
    public function processCallback($data)
    {
        if (empty($data['sid'])) {
            return ['success' => false, 'error' => 'Missing sid'];
        }

        $sid = $data['sid'];
        $statusNo = $data['status_no'] ?? -1;
        $eslId = $data['esl_id'] ?? '';

        // Kuyruktan bul
        $queue = $this->db->fetch(
            "SELECT * FROM hanshow_queue WHERE session_id = ?",
            [$sid]
        );

        if (!$queue) {
            return ['success' => false, 'error' => 'Queue item not found'];
        }

        // Durumu guncelle
        $status = ($statusNo === 0) ? 'completed' : 'failed';

        $this->db->update('hanshow_queue', [
            'status' => $status,
            'callback_data' => json_encode($data),
            'rf_power' => $data['rf_power'] ?? null,
            'retry_count' => $data['retry'] ?? null,
            'ap_id' => $data['ap_id'] ?? null,
            'error_message' => $data['errmsg'] ?? null,
            'completed_at' => date('Y-m-d H:i:s')
        ], 'session_id = ?', [$sid]);

        // ESL durumunu guncelle
        if ($eslId) {
            $this->db->query(
                "UPDATE hanshow_esls SET
                    status = ?,
                    last_sync_at = CURRENT_TIMESTAMP,
                    last_heartbeat_at = ?
                WHERE esl_id = ?",
                [
                    $status === 'completed' ? 'online' : 'offline',
                    $data['last_hb_time'] ?? null,
                    $eslId
                ]
            );
        }

        return ['success' => true, 'status' => $status];
    }
}

