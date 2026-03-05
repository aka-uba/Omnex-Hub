<?php
/**
 * MQTT Broker Service
 *
 * PavoDisplay ESL cihazları için MQTT broker yönetimi.
 * MQTT modunda çalışan cihazlarla iletişim için gerekli
 * sign doğrulama, topic yönetimi ve komut kuyruğu işlevleri.
 *
 * Tasarım: PHP native MQTT client yerine mevcut device_commands
 * tablosu + gateway agent polling pattern kullanılır.
 */

class MqttBrokerService
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Cihaz kimligini PavoDisplay MQTT formatina normalize eder.
     * Ornek: 20:51:F5:4F:50:59 -> 2051F54F5059
     */
    private function normalizeClientId(string $clientId): string
    {
        return strtoupper(str_replace([':', '-', '.'], '', trim($clientId)));
    }

    /**
     * PavoDisplay API dokümantasyonuna göre sign hesapla.
     *
     * Algoritma:
     * 1. Tüm parametreleri (sign hariç) alfabetik sırala
     * 2. key1=value1&key2=value2 formatında birleştir
     * 3. Sonuna &key=AppSecret ekle
     * 4. MD5 al ve uppercase yap
     *
     * @param array $params Parametreler (sign hariç)
     * @param string $appSecret AppSecret değeri
     * @return string Uppercase MD5 sign
     */
    public function calculateSign(array $params, string $appSecret): string
    {
        unset($params['sign']);
        ksort($params);

        $parts = [];
        foreach ($params as $key => $value) {
            $parts[] = $key . '=' . $value;
        }

        $stringSignTemp = implode('&', $parts) . '&key=' . $appSecret;

        return strtoupper(md5($stringSignTemp));
    }

    /**
     * Cihazın gönderdiği sign'ı doğrula
     *
     * @param string $sign Cihazdan gelen sign
     * @param array $params İstek parametreleri (sign hariç)
     * @param string $companyId Firma ID
     * @return bool Geçerli mi
     */
    public function verifySign(string $sign, array $params, string $companyId): bool
    {
        $settings = $this->getSettings($companyId);
        if (!$settings || empty($settings['app_secret'])) {
            // AppSecret ayarlanmamışsa sign kontrolü atla
            return true;
        }

        $expectedSign = $this->calculateSign($params, $settings['app_secret']);
        return hash_equals($expectedSign, strtoupper($sign));
    }

    /**
     * AppID ile sign doğrula (firma ID bilinmiyorken)
     *
     * @param string $sign Cihazdan gelen sign
     * @param array $params İstek parametreleri
     * @param string $appId Cihazın gönderdiği AppID
     * @return array|null Eşleşen MQTT settings veya null
     */
    public function verifySignByAppId(string $sign, array $params, string $appId): ?array
    {
        $settings = $this->getSettingsByAppId($appId);

        if (!$settings) {
            return null;
        }

        // AppSecret boşsa sign kontrolü atla
        if (empty($settings['app_secret'])) {
            return $settings;
        }

        $expectedSign = $this->calculateSign($params, $settings['app_secret']);
        if (hash_equals($expectedSign, strtoupper($sign))) {
            return $settings;
        }

        return null;
    }

    /**
     * AppID ile MQTT ayarini getir (aktif/testing)
     */
    public function getSettingsByAppId(string $appId): ?array
    {
        $appId = trim($appId);
        if ($appId === '') {
            return null;
        }

        return $this->db->fetch(
            "SELECT ms.*, c.id as company_id, c.name as company_name
             FROM mqtt_settings ms
             JOIN companies c ON ms.company_id = c.id
             WHERE ms.app_id = ? AND ms.status IN ('active', 'testing')",
            [$appId]
        ) ?: null;
    }

    /**
     * Legacy cihazlar icin appId/sign uyumsuzlugunda cihaz kaydina gore
     * firma ayari fallback'i. Multi-tenant izolasyonunu korumak icin:
     * - cihaz daha once sisteme kayitli olmali
     * - cihaz modu mqtt olmali
     * - cihaz IP'si kayitliysa gelen IP ile eslesmeli
     */
    public function resolveLegacySettingsByDevice(string $clientId, ?string $remoteIp = null): ?array
    {
        $clientId = trim($clientId);
        if ($clientId === '') {
            return null;
        }

        $device = $this->findDeviceByClientId($clientId, null);
        if (!$device) {
            return null;
        }

        // PavoDisplay cihazlar fabrika ayarlarında MQTT endpoint kullanır ama
        // BLE wizard ile communication_mode='http' olarak güncellenir.
        // Legacy auth'ta her iki modu da kabul et â€” cihaz kimliği MAC ile doğrulanmış.
        $commMode = $device['communication_mode'] ?? '';
        if (!in_array($commMode, ['mqtt', 'http'], true)) {
            return null;
        }

        $deviceIp = trim((string)($device['ip_address'] ?? ''));
        $remoteIp = trim((string)($remoteIp ?? ''));
        if ($remoteIp !== '' && $deviceIp !== '' && $deviceIp !== $remoteIp) {
            return null;
        }

        $settings = $this->getSettings((string)$device['company_id']);
        if (!$settings) {
            return null;
        }

        return $settings;
    }

    /**
     * Firma MQTT ayarlarını getir
     *
     * @param string $companyId Firma ID
     * @return array|null MQTT settings veya null
     */
    public function getSettings(string $companyId): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM mqtt_settings WHERE company_id = ? AND status IN ('active', 'testing')",
            [$companyId]
        );
    }

    /**
     * Cihaz için MQTT topic oluştur
     *
     * Format: {topic_prefix}/{company_id}/{client_id}
     *
     * @param string $companyId Firma ID
     * @param string $clientId Cihaz client ID (MAC benzeri)
     * @return string MQTT topic
     */
    public function generateDeviceTopic(string $companyId, string $clientId): string
    {
        $settings = $this->getSettings($companyId);
        $prefix = $settings['topic_prefix'] ?? 'omnex/esl';

        return "{$prefix}/{$companyId}/{$clientId}";
    }

    /**
     * PavoDisplay MQTT topic formati:
     * {topic_prefix}/p2p/GID_omnex@@@{client_id}
     */
    public function generatePavoTopic(string $companyId, string $clientId): string
    {
        $settings = $this->getSettings($companyId);
        $prefix = trim((string)($settings['topic_prefix'] ?? 'omnex/esl'), '/');
        $normalizedClientId = $this->normalizeClientId($clientId);

        return "{$prefix}/p2p/GID_omnex@@@{$normalizedClientId}";
    }

    /**
     * Cihazin mqtt_topic degeri bossa firma ayarina gore otomatik tamamlar.
     */
    public function ensureDeviceTopic(string $deviceId, string $companyId, ?string $clientId = null): ?string
    {
        $device = $this->db->fetch(
            "SELECT id, device_id, mqtt_client_id, mqtt_topic FROM devices WHERE id = ?",
            [$deviceId]
        );

        if (!$device) {
            return null;
        }

        if (!empty($device['mqtt_topic'])) {
            $existingClientId = trim((string)($device['mqtt_client_id'] ?? ''));
            if ($existingClientId !== '') {
                $normalizedExisting = $this->normalizeClientId($existingClientId);
                if ($normalizedExisting !== $existingClientId) {
                    $this->db->update('devices', [
                        'mqtt_client_id' => $normalizedExisting,
                        'updated_at' => date('Y-m-d H:i:s')
                    ], 'id = ?', [$deviceId]);
                }
            }
            return $device['mqtt_topic'];
        }

        $effectiveClientId = trim((string)($clientId ?: ($device['mqtt_client_id'] ?? $device['device_id'] ?? '')));
        if ($effectiveClientId === '') {
            return null;
        }

        $normalizedClientId = $this->normalizeClientId($effectiveClientId);
        $topic = $this->generatePavoTopic($companyId, $normalizedClientId);
        $this->db->update('devices', [
            'mqtt_client_id' => $normalizedClientId,
            'mqtt_topic' => $topic,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$deviceId]);

        return $topic;
    }

    /**
     * Cihaz için MQTT broker bağlantı bilgilerini getir
     *
     * @param string $companyId Firma ID
     * @return array Broker bilgileri
     */
    public function getDeviceCredentials(string $companyId): array
    {
        $settings = $this->getSettings($companyId);

        if (!$settings) {
            return [
                'success' => false,
                'error' => 'MQTT ayarları yapılandırılmamış'
            ];
        }

        $protocol = $settings['use_tls'] ? 'mqtts' : 'mqtt';
        $brokerUrl = $settings['broker_url'];

        // URL'de protokol yoksa ekle
        if (strpos($brokerUrl, '://') === false) {
            $brokerUrl = "{$protocol}://{$brokerUrl}";
        }

        // Port URL'de yoksa ekle
        if (strpos($brokerUrl, ':' . $settings['broker_port']) === false
            && !preg_match('/:\d+$/', $brokerUrl)) {
            $brokerUrl .= ':' . $settings['broker_port'];
        }

        return [
            'success' => true,
            'broker_url' => $brokerUrl,
            'broker_port' => (int)$settings['broker_port'],
            'username' => $settings['username'] ?? '',
            'password' => $settings['password'] ?? '',
            'topic_prefix' => $settings['topic_prefix'] ?? 'omnex/esl',
            'use_tls' => (bool)$settings['use_tls']
        ];
    }

    /**
     * MQTT cihazına komut gönder (device_commands kuyruğuna ekle)
     *
     * Gateway agent bu kuyruğu polling ile okuyup MQTT broker'a publish eder.
     *
     * @param string $deviceId Cihaz ID (DB)
     * @param array $command Komut payload
     * @param string $companyId Firma ID
     * @return array Sonuç
     */
    public function publishCommand(string $deviceId, array $command, string $companyId): array
    {
        try {
            $commandId = $this->db->generateUuid();

            $this->db->insert('device_commands', [
                'id' => $commandId,
                'device_id' => $deviceId,
                'command' => $command['action'] ?? 'mqtt_command',
                'parameters' => json_encode($command),
                'status' => 'pending',
                'priority' => $command['priority'] ?? 0,
                'created_at' => date('Y-m-d H:i:s')
            ]);

            // Gercek MQTT publish - cihaza anlik bildirim gonder
            $mqttResult = $this->publishToMqttBroker($deviceId, $command, $companyId);

            // MQTT publish basarili ise komutu 'sent' olarak isaretle
            if ($mqttResult['success']) {
                $this->db->update('device_commands', [
                    'status' => 'sent',
                    'executed_at' => date('Y-m-d H:i:s')
                ], 'id = ?', [$commandId]);
            }

            return [
                'success' => true,
                'command_id' => $commandId,
                'mqtt_published' => $mqttResult['success'],
                'message' => $mqttResult['success']
                    ? 'MQTT komutu aninda gonderildi'
                    : 'MQTT komutu kuyruga eklendi (broker erisim hatasi: ' . ($mqttResult['error'] ?? '') . ')'
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Komut kuyruğa eklenemedi: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Gercek MQTT publish - mosquitto_pub ile broker'a mesaj gonder
     *
     * PavoDisplay cihaz subscribed topic'e mesaj gonderir.
     * Cihaz bu mesaji alinca hemen content endpoint'i sorgular.
     *
     * @param string $deviceId DB cihaz ID
     * @param array $command Komut payload (action, push_id, clientid, ...)
     * @param string $companyId Firma ID
     * @return array ['success' => bool, 'error' => string]
     */
    public function publishToMqttBroker(string $deviceId, array $command, string $companyId): array
    {
        $payloadFile = null;
        try {
            // Cihaz bilgisini al
            $device = $this->db->fetch(
                "SELECT mqtt_client_id, mqtt_topic, device_id FROM devices WHERE id = ?",
                [$deviceId]
            );

            if (!$device) {
                return ['success' => false, 'error' => 'Cihaz bulunamadi'];
            }

            // Broker ayarlarini al
            $settings = $this->getSettings($companyId);
            if (!$settings) {
                return ['success' => false, 'error' => 'MQTT ayarlari bulunamadi'];
            }

            if (empty($device['mqtt_topic'])) {
                $resolvedTopic = $this->ensureDeviceTopic($deviceId, $companyId, $device['mqtt_client_id'] ?? $device['device_id'] ?? null);
                if ($resolvedTopic) {
                    $device['mqtt_topic'] = $resolvedTopic;
                }
            }

            if (empty($device['mqtt_topic'])) {
                return ['success' => false, 'error' => 'Cihaz MQTT topic bulunamadi'];
            }

            $brokerHost = $settings['broker_url'] ?? '127.0.0.1';
            // URL icerisindeki protokolu kaldir
            $parsed = parse_url($brokerHost);
            $brokerHost = $parsed['host'] ?? $brokerHost;
            $brokerPort = (int)($settings['broker_port'] ?? 1883);
            $topic = (string)$device['mqtt_topic'];

            // Komut payload'ini olustur
            // NOT: Pavo MQTT komutlari genellikle minimal payload bekler.
            // "Data": null gibi alanlar bazi firmware'lerde "received message, no data"
            // bildirimi olusturabilir.
            $clientId = $this->normalizeClientId((string)($device['mqtt_client_id'] ?? $device['device_id'] ?? ''));
            $payloadData = [
                'action' => $command['action'] ?? 'updatelabel',
                'push_id' => (int)($command['push_id'] ?? time()),
                'clientid' => $clientId
            ];

            // Sadece gercekten set edilmis ek alanlari gonder
            if (array_key_exists('Data', $command) && $command['Data'] !== null) {
                $payloadData['Data'] = $command['Data'];
            }
            if (array_key_exists('clear-res', $command) && $command['clear-res'] !== null) {
                $payloadData['clear-res'] = $command['clear-res'];
            }

            $payload = json_encode($payloadData, JSON_UNESCAPED_SLASHES);
            if ($payload === false) {
                return ['success' => false, 'error' => 'MQTT payload encode edilemedi'];
            }

            // Windows shell quoting problemlerine girmemek icin payload'i dosyadan publish et.
            $tmpDir = STORAGE_PATH . '/tmp';
            if (!is_dir($tmpDir)) {
                @mkdir($tmpDir, 0755, true);
            }
            $payloadFile = tempnam($tmpDir, 'mqtt_payload_');
            if ($payloadFile === false || file_put_contents($payloadFile, $payload) === false) {
                if (is_string($payloadFile) && is_file($payloadFile)) {
                    @unlink($payloadFile);
                }
                return ['success' => false, 'error' => 'MQTT payload dosyasi olusturulamadi'];
            }

            // Topic adaylari:
            // 1) cihaz kaydindaki topic
            // 2) legacy/raw client id topic'i (eski firmware uyumlulugu)
            $topicCandidates = [];
            if ($topic !== '') {
                $topicCandidates[] = $topic;
            }

            $prefix = trim((string)($settings['topic_prefix'] ?? 'omnex/esl'), '/');
            $rawClientCandidates = [];
            $rawMqttClientId = trim((string)($device['mqtt_client_id'] ?? ''));
            $rawDeviceId = trim((string)($device['device_id'] ?? ''));
            if ($rawMqttClientId !== '') {
                $rawClientCandidates[] = $rawMqttClientId;
            }
            if ($rawDeviceId !== '') {
                $rawClientCandidates[] = $rawDeviceId;
            }

            foreach ($rawClientCandidates as $rawClient) {
                $rawClient = trim($rawClient);
                if ($rawClient === '') {
                    continue;
                }

                $rawTopic = "{$prefix}/p2p/GID_omnex@@@{$rawClient}";
                $topicCandidates[] = $rawTopic;

                $rawUpper = strtoupper($rawClient);
                if ($rawUpper !== $rawClient) {
                    $topicCandidates[] = "{$prefix}/p2p/GID_omnex@@@{$rawUpper}";
                }
            }

            $topicCandidates = array_values(array_unique(array_filter($topicCandidates)));
            if (empty($topicCandidates)) {
                if ($payloadFile && is_file($payloadFile)) {
                    @unlink($payloadFile);
                }
                return ['success' => false, 'error' => 'MQTT publish topic bulunamadi'];
            }

            // mosquitto_pub komutu olustur
            // Windows: "C:\Program Files\mosquitto\mosquitto_pub.exe"
            // Linux: mosquitto_pub
            $mosquittoPub = 'mosquitto_pub';
            if (PHP_OS_FAMILY === 'Windows') {
                $winPath = 'C:\\Program Files\\mosquitto\\mosquitto_pub.exe';
                if (file_exists($winPath)) {
                    $mosquittoPub = '"' . $winPath . '"';
                }
            }

            $publishSucceeded = false;
            $lastError = '';

            foreach ($topicCandidates as $topicCandidate) {
                $cmd = sprintf(
                    '%s -h %s -p %d -q 1 -t %s -f %s',
                    $mosquittoPub,
                    escapeshellarg($brokerHost),
                    $brokerPort,
                    escapeshellarg($topicCandidate),
                    escapeshellarg($payloadFile)
                );

                // Username/password varsa ekle
                if (!empty($settings['username'])) {
                    $cmd .= sprintf(' -u %s', escapeshellarg($settings['username']));
                    if (!empty($settings['password'])) {
                        $cmd .= sprintf(' -P %s', escapeshellarg($settings['password']));
                    }
                }

                $output = [];
                $exitCode = 0;
                exec($cmd . ' 2>&1', $output, $exitCode);

                if ($exitCode === 0) {
                    $publishSucceeded = true;
                    error_log("[MQTT] Published '{$command['action']}' to topic: {$topicCandidate}");
                } else {
                    $errorMsg = implode(' ', $output);
                    $lastError = "mosquitto_pub exit={$exitCode}: {$errorMsg}";
                    error_log("[MQTT] Publish failed (exit={$exitCode}): {$errorMsg} | cmd: {$cmd}");
                }
            }

            if ($payloadFile && is_file($payloadFile)) {
                @unlink($payloadFile);
            }

            if ($publishSucceeded) {
                return ['success' => true];
            }

            return ['success' => false, 'error' => $lastError !== '' ? $lastError : 'MQTT publish failed'];

        } catch (Exception $e) {
            if ($payloadFile && is_file($payloadFile)) {
                @unlink($payloadFile);
            }
            error_log("[MQTT] publishToMqttBroker exception: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Render sonucunu MQTT content endpoint'i icin dosyaya yazar ve cihazi guncelleme komutuna alir.
     *
     * @param array $device devices tablosundan satir (id/device_id/mqtt_client_id gerekli)
     * @param array $sendParams render.php / process.php send parametreleri
     * @param string $companyId aktif firma
     * @param string|null $templateId
     * @param string|null $productId
     */
    public function queueContentUpdate(array $device, array $sendParams, string $companyId, ?string $templateId = null, ?string $productId = null): array
    {
        try {
            $deviceId = (string)($device['id'] ?? '');
            if ($deviceId === '') {
                return ['success' => false, 'error' => 'Gecersiz cihaz kaydi'];
            }

            $rawClientId = trim((string)($device['mqtt_client_id'] ?? $device['device_id'] ?? ''));
            if ($rawClientId === '') {
                return ['success' => false, 'error' => 'MQTT client id eksik'];
            }
            $clientId = $this->normalizeClientId($rawClientId);

            $this->ensureDeviceTopic($deviceId, $companyId, $clientId);

            $width = (int)($sendParams['width'] ?? $device['screen_width'] ?? 800);
            $height = (int)($sendParams['height'] ?? $device['screen_height'] ?? 1280);
            $product = is_array($sendParams['product'] ?? null) ? $sendParams['product'] : [];

            $task = [
                'Id' => $clientId,
                'ItemCode' => (string)($product['sku'] ?? $product['id'] ?? $productId ?? 'ITEM'),
                'ItemName' => (string)($product['name'] ?? 'Product')
            ];

            $picture = $this->buildPicturePayload($companyId, $sendParams, $width, $height, $deviceId, $clientId);
            if (empty($picture)) {
                $picture = $this->buildDefaultPicturePayload($companyId, $device, $width, $height, $clientId);
            }
            if (!empty($picture)) {
                $task['LabelPicture'] = $picture;
            }

            $video = $this->buildVideoPayload($companyId, $sendParams, $width, $height);
            if (!empty($video)) {
                $task['LabelVideo'] = $video;
            }

            $contentVersion = sprintf('%u', crc32(json_encode($task, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
            $task['Nlast'] = (int)$contentVersion;

            $payloadWrapper = [
                'version' => 1,
                'company_id' => $companyId,
                'device_id' => $deviceId,
                'client_id' => $clientId,
                'template_id' => $templateId,
                'product_id' => $productId,
                'content_version' => (int)$contentVersion,
                'updated_at' => date('Y-m-d H:i:s'),
                'task' => $task
            ];

            $payloadDir = STORAGE_PATH . '/renders/' . $companyId . '/esl/mqtt-payloads';
            if (!is_dir($payloadDir)) {
                mkdir($payloadDir, 0755, true);
            }
            $payloadFileName = $deviceId . '.json';
            $payloadDiskPath = $payloadDir . '/' . $payloadFileName;
            file_put_contents(
                $payloadDiskPath,
                json_encode($payloadWrapper, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
            );

            $payloadRelativePath = 'storage/renders/' . $companyId . '/esl/mqtt-payloads/' . $payloadFileName;

            $existingAssignment = $this->db->fetch(
                "SELECT id FROM device_content_assignments WHERE device_id = ? AND status = 'active'",
                [$deviceId]
            );
            if ($existingAssignment) {
                $this->db->update('device_content_assignments', [
                    'content_type' => 'mqtt_payload',
                    'content_id' => $payloadRelativePath
                ], 'id = ?', [$existingAssignment['id']]);
            } else {
                $this->db->insert('device_content_assignments', [
                    'id' => $this->db->generateUuid(),
                    'device_id' => $deviceId,
                    'content_type' => 'mqtt_payload',
                    'content_id' => $payloadRelativePath,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            }

            // HTTP PULL cihazları MQTT broker dinlemez - publish atlansın
            $skipMqttPublish = !empty($sendParams['_skip_mqtt_publish']);

            $publishResult = ['mqtt_published' => false];

            if (!$skipMqttPublish) {
                // updatelabel komutunu standart modda gonder:
                // cihaz content endpoint'inden gorevi ceker. Bu, farkli firmware'lerde
                // updatelabel + Data parse farklarindan dogan uyumsuzluklari azaltir.
                $commandPayload = [
                    'action' => 'updatelabel',
                    'push_id' => time(),
                    'clientid' => $clientId,
                    'priority' => 5
                ];
                $forceClearResources = !empty($sendParams['force_clear_resources'])
                    || (isset($sendParams['clear-res']) && (int)$sendParams['clear-res'] === 1)
                    || (isset($sendParams['clear_res']) && (int)$sendParams['clear_res'] === 1);
                if ($forceClearResources) {
                    $commandPayload['clear-res'] = 1;
                }

                $publishResult = $this->publishCommand($deviceId, $commandPayload, $companyId);
            }

            return [
                'success' => true,
                'delivery' => 'queued',
                'communication_mode' => 'mqtt',
                'mqtt_published' => (bool)($publishResult['mqtt_published'] ?? false),
                'message' => (bool)($publishResult['mqtt_published'] ?? false)
                    ? 'Icerik MQTT ile aninda tetiklendi'
                    : 'Icerik MQTT kuyruguna alindi',
                'render_id' => $payloadRelativePath,
                'file_path' => $picture['PicturePath'] ?? $payloadRelativePath,
                'content_version' => (int)$contentVersion
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'MQTT icerik hazirlama hatasi: ' . $e->getMessage()
            ];
        }
    }

    private function buildPicturePayload(
        string $companyId,
        array $sendParams,
        int $defaultWidth,
        int $defaultHeight,
        string $deviceId,
        string $clientId
    ): array
    {
        $imagePath = $sendParams['image'] ?? null;
        if (empty($imagePath)) {
            return [];
        }

        $region = is_array($sendParams['image_region'] ?? null) ? $sendParams['image_region'] : [];
        $x = (int)($region['x'] ?? 0);
        $y = (int)($region['y'] ?? 0);
        $width = (int)($region['width'] ?? $defaultWidth);
        $height = (int)($region['height'] ?? $defaultHeight);
        if ($width <= 0 || $height <= 0) {
            return [];
        }

        $sourcePath = (string)$imagePath;
        $sourceDiskPath = $this->toDiskPath($sourcePath);
        $sourceAlreadyRegionSized = false;
        if ($sourceDiskPath && file_exists($sourceDiskPath)) {
            $imgInfo = @getimagesize($sourceDiskPath);
            if (is_array($imgInfo)) {
                $srcW = (int)($imgInfo[0] ?? 0);
                $srcH = (int)($imgInfo[1] ?? 0);
                $sourceAlreadyRegionSized = ($srcW === $width && $srcH === $height);
            }
        }

        // Kaynak gorsel zaten hedef region boyutundaysa yeni MQTT asset uretme.
        // Bu durumda mevcut render cache dosyasi dogrudan kullanilir.
        $preparedImage = null;
        if (!$sourceAlreadyRegionSized) {
            $preparedImage = $this->preparePictureAssetForMqtt(
                $companyId,
                $sendParams,
                $sourcePath,
                [
                    'x' => $x,
                    'y' => $y,
                    'width' => $width,
                    'height' => $height,
                    'device_width' => $defaultWidth,
                    'device_height' => $defaultHeight
                ],
                $deviceId,
                $clientId
            );
        }

        $effectivePath = $preparedImage['path'] ?? $sourcePath;

        $publicPath = $this->toPublicMediaUrl($companyId, $effectivePath);
        if ($publicPath === null) {
            return [];
        }

        $diskPath = $preparedImage['disk_path'] ?? $this->toDiskPath($effectivePath);
        $md5 = $preparedImage['md5'] ?? (($diskPath && file_exists($diskPath)) ? strtoupper(md5_file($diskPath)) : '');

        $pictureSafeLeftInset = $this->resolvePictureSafeLeftInsetForSendParams($sendParams, $x);

        return [
            'X' => $x + $pictureSafeLeftInset,
            'Y' => $y,
            'Width' => $width,
            'Height' => $height,
            'PictureName' => basename($effectivePath),
            'PicturePath' => $publicPath,
            'PictureUrl' => $publicPath,
            'PictureMD5' => $md5
        ];
    }

    /**
     * MQTT gonderimi icin gorseli hazirlar:
     * - region'e gore kirpma/olcekleme
     * - dynamic field render (design_data + product)
     * Sonucu storage/renders altinda yeni bir dosya olarak yazar.
     */
    private function preparePictureAssetForMqtt(
        string $companyId,
        array $sendParams,
        string $imagePath,
        array $region,
        string $deviceId,
        string $clientId
    ): ?array {
        $designData = is_array($sendParams['design_data'] ?? null) ? $sendParams['design_data'] : [];
        $product = is_array($sendParams['product'] ?? null) ? $sendParams['product'] : [];
        $needsRegionProcessing = ((int)($region['x'] ?? 0) > 0)
            || ((int)($region['y'] ?? 0) > 0)
            || ((int)($region['width'] ?? 0) !== (int)($region['device_width'] ?? 0))
            || ((int)($region['height'] ?? 0) !== (int)($region['device_height'] ?? 0));
        $needsDynamicRender = !empty($designData) && !empty($product);

        if (!$needsRegionProcessing && !$needsDynamicRender) {
            return null;
        }

        $diskPath = $this->toDiskPath($imagePath);
        if (!$diskPath || !file_exists($diskPath)) {
            return null;
        }

        $targetWidth = (int)($region['width'] ?? 0);
        $targetHeight = (int)($region['height'] ?? 0);
        if ($targetWidth <= 0 || $targetHeight <= 0) {
            return null;
        }

        $extension = strtolower(pathinfo($diskPath, PATHINFO_EXTENSION));
        if ($extension === 'png') {
            $srcImage = @imagecreatefrompng($diskPath);
        } elseif (in_array($extension, ['jpg', 'jpeg'], true)) {
            $srcImage = @imagecreatefromjpeg($diskPath);
        } else {
            return null;
        }
        if (!$srcImage) {
            return null;
        }

        $srcWidth = imagesx($srcImage);
        $srcHeight = imagesy($srcImage);
        $cropRegion = [
            'x' => (int)($region['x'] ?? 0),
            'y' => (int)($region['y'] ?? 0),
            'width' => $targetWidth,
            'height' => $targetHeight,
            'device_width' => (int)($region['device_width'] ?? $srcWidth),
            'device_height' => (int)($region['device_height'] ?? $srcHeight)
        ];

        if ($cropRegion['width'] > 0 && $cropRegion['height'] > 0) {
            $scaleX = $srcWidth / max(1, $cropRegion['device_width']);
            $scaleY = $srcHeight / max(1, $cropRegion['device_height']);

            $scaledCropX = (int)($cropRegion['x'] * $scaleX);
            $scaledCropY = (int)($cropRegion['y'] * $scaleY);
            $scaledCropW = (int)($cropRegion['width'] * $scaleX);
            $scaledCropH = (int)($cropRegion['height'] * $scaleY);

            $scaledCropX = max(0, min($scaledCropX, max(0, $srcWidth - 1)));
            $scaledCropY = max(0, min($scaledCropY, max(0, $srcHeight - 1)));
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

        $dstImage = imagecreatetruecolor($targetWidth, $targetHeight);
        $white = imagecolorallocate($dstImage, 255, 255, 255);
        imagefill($dstImage, 0, 0, $white);
        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $targetWidth, $targetHeight, $srcWidth, $srcHeight);

        if ($needsDynamicRender) {
            $templateWidth = (int)($designData['_templateWidth'] ?? ($cropRegion['device_width'] ?? $srcWidth));
            $templateHeight = (int)($designData['_templateHeight'] ?? ($cropRegion['device_height'] ?? $srcHeight));

            if ($cropRegion['x'] > 0 || $cropRegion['y'] > 0) {
                $adjustedDesignData = $designData;
                if (isset($adjustedDesignData['objects']) && is_array($adjustedDesignData['objects'])) {
                    $cropOffsetX = (int)$cropRegion['x'];
                    $cropOffsetY = (int)$cropRegion['y'];
                    $cropRight = $cropOffsetX + (int)$cropRegion['width'];
                    $cropBottom = $cropOffsetY + (int)$cropRegion['height'];

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

                        if ($objRight < $cropOffsetX || $objLeft > $cropRight || $objBottom < $cropOffsetY || $objTop > $cropBottom) {
                            $obj['visible'] = false;
                            continue;
                        }

                        $obj['left'] = $objLeft - $cropOffsetX;
                        $obj['top'] = $objTop - $cropOffsetY;
                    }
                    unset($obj);
                }

                $this->renderDynamicFieldsViaGateway(
                    $dstImage,
                    $adjustedDesignData,
                    $product,
                    (int)$cropRegion['width'],
                    (int)$cropRegion['height'],
                    $targetWidth,
                    $targetHeight
                );
            } else {
                $this->renderDynamicFieldsViaGateway(
                    $dstImage,
                    $designData,
                    $product,
                    $templateWidth,
                    $templateHeight,
                    $targetWidth,
                    $targetHeight
                );
            }
        }

        ob_start();
        imagejpeg($dstImage, null, 90);
        $imageContent = ob_get_clean();

        imagedestroy($srcImage);
        imagedestroy($dstImage);

        if ($imageContent === false || $imageContent === '') {
            return null;
        }

        // Ayrı mqtt-assets klasoru yerine mevcut render cache yapisini kullan.
        $assetDir = STORAGE_PATH . '/renders/cache/' . $companyId;
        if (!is_dir($assetDir)) {
            mkdir($assetDir, 0755, true);
        }

        $safeClientId = preg_replace('/[^A-Za-z0-9_-]/', '', $clientId);
        $fileName = $deviceId . '_' . ($safeClientId ?: 'client') . '_' . time() . '.jpg';
        $outputPath = $assetDir . '/' . $fileName;
        if (@file_put_contents($outputPath, $imageContent) === false) {
            return null;
        }

        return [
            'path' => $outputPath,
            'disk_path' => $outputPath,
            'md5' => strtoupper(md5($imageContent))
        ];
    }

    /**
     * Dynamic field render mantigini tek yerde tutmak icin
     * PavoDisplayGateway::renderDynamicFields metodunu kullan.
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
            error_log('[MQTT] renderDynamicFields fallback failed: ' . $e->getMessage());
        }
    }

    private function buildVideoPayload(string $companyId, array $sendParams, int $defaultWidth, int $defaultHeight): array
    {
        $videos = $sendParams['videos'] ?? [];
        if (!is_array($videos) || empty($videos)) {
            return [];
        }

        $region = is_array($sendParams['video_region'] ?? null) ? $sendParams['video_region'] : [];
        $x = (int)($region['x'] ?? 0);
        $y = (int)($region['y'] ?? 0);
        $width = (int)($region['width'] ?? $defaultWidth);
        $height = (int)($region['height'] ?? (int)($defaultHeight / 2));

        $videoList = [];
        foreach (array_values($videos) as $index => $videoEntry) {
            $videoPath = null;
            $videoMd5 = '';

            if (is_string($videoEntry)) {
                $videoPath = $videoEntry;
            } elseif (is_array($videoEntry)) {
                $candidate = $videoEntry['path']
                    ?? $videoEntry['video_path']
                    ?? $videoEntry['videoPath']
                    ?? $videoEntry['url']
                    ?? $videoEntry['video_url']
                    ?? $videoEntry['VideoPath']
                    ?? $videoEntry['VideoUrl']
                    ?? null;

                if (is_string($candidate)) {
                    $videoPath = $candidate;
                }

                $candidateMd5 = $videoEntry['md5']
                    ?? $videoEntry['video_md5']
                    ?? $videoEntry['VideoMD5']
                    ?? null;
                if (is_string($candidateMd5) && $candidateMd5 !== '') {
                    $videoMd5 = strtoupper($candidateMd5);
                }
            }

            if (!is_string($videoPath) || trim($videoPath) === '') {
                continue;
            }

            $videoPath = trim($videoPath);
            $publicPath = $this->toPublicMediaUrl($companyId, $videoPath);
            if ($publicPath === null) {
                continue;
            }

            if ($videoMd5 === '') {
                $diskPath = $this->toDiskPath($videoPath);
                $videoMd5 = ($diskPath && file_exists($diskPath)) ? strtoupper(md5_file($diskPath)) : '';
            }

            $videoFileName = basename(parse_url($videoPath, PHP_URL_PATH) ?: $videoPath);

            $videoList[] = [
                'VideoNo' => $index + 1,
                'VideoName' => $videoFileName,
                'VideoPath' => $publicPath,
                'VideoUrl' => $publicPath,
                'VideoMD5' => $videoMd5
            ];
        }

        if (empty($videoList)) {
            return [];
        }

        return [
            'X' => $x,
            'Y' => $y,
            'Width' => $width,
            'Height' => $height,
            'VideoList' => $videoList
        ];
    }

    private function buildDefaultPicturePayload(string $companyId, array $device, int $width, int $height, string $clientId): array
    {
        $defaultImagePath = $this->resolveDefaultImageDiskPath($device, $clientId, $width, $height);
        if (!$defaultImagePath || !is_file($defaultImagePath)) {
            return [];
        }

        $publicPath = $this->toPublicMediaUrl($companyId, $defaultImagePath);
        if ($publicPath === null) {
            return [];
        }

        $md5 = strtoupper((string)@md5_file($defaultImagePath));

        return [
            'X' => 0,
            'Y' => 0,
            'Width' => $width,
            'Height' => $height,
            'PictureName' => basename($defaultImagePath),
            'PicturePath' => $publicPath,
            'PictureUrl' => $publicPath,
            'PictureMD5' => $md5
        ];
    }

    private function resolveDefaultImageDiskPath(array $device, string $clientId, int $screenWidth, int $screenHeight): ?string
    {
        $companyId = (string)($device['company_id'] ?? '');
        $deviceId = (string)($device['id'] ?? '');
        $gatewayId = (string)($device['gateway_id'] ?? '');
        $orientation = ($screenHeight > $screenWidth) ? 'portrait' : 'landscape';

        $paths = [
            BASE_PATH . "/storage/defaults/devices/{$deviceId}.jpg",
            BASE_PATH . "/storage/defaults/devices/{$deviceId}.png",
            BASE_PATH . "/storage/defaults/devices/{$clientId}.jpg",
            BASE_PATH . "/storage/defaults/devices/{$clientId}.png",
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$screenWidth}x{$screenHeight}.jpg" : null),
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$screenWidth}x{$screenHeight}.png" : null),
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$orientation}.jpg" : null),
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$orientation}.png" : null),
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/default.jpg" : null),
            ($gatewayId !== '' ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/default.png" : null),
            BASE_PATH . "/storage/defaults/companies/{$companyId}/{$screenWidth}x{$screenHeight}.jpg",
            BASE_PATH . "/storage/defaults/companies/{$companyId}/{$screenWidth}x{$screenHeight}.png",
            BASE_PATH . "/storage/defaults/companies/{$companyId}/{$orientation}.jpg",
            BASE_PATH . "/storage/defaults/companies/{$companyId}/{$orientation}.png",
            BASE_PATH . "/storage/defaults/companies/{$companyId}/default.jpg",
            BASE_PATH . "/storage/defaults/companies/{$companyId}/default.png",
            BASE_PATH . "/storage/defaults/{$screenWidth}x{$screenHeight}.jpg",
            BASE_PATH . "/storage/defaults/{$screenWidth}x{$screenHeight}.png",
            BASE_PATH . "/storage/defaults/{$orientation}.jpg",
            BASE_PATH . "/storage/defaults/{$orientation}.png",
            BASE_PATH . "/storage/defaults/default.jpg",
            BASE_PATH . "/storage/defaults/default.png"
        ];

        foreach (array_filter($paths) as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        return null;
    }

    private function toDiskPath(string $path): ?string
    {
        $normalized = str_replace('\\', '/', trim($path));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^[A-Za-z]:\//', $normalized) || strpos($normalized, '/') === 0) {
            return $normalized;
        }

        if (strpos($normalized, 'storage/') === 0) {
            return BASE_PATH . '/' . $normalized;
        }

        if (file_exists(BASE_PATH . '/' . $normalized)) {
            return BASE_PATH . '/' . $normalized;
        }

        if (file_exists($normalized)) {
            return $normalized;
        }

        return null;
    }

    /**
     * MQTT LabelPicture icin guvenli sol inset kararini hesapla.
     * Sadece sol kenara dayali static (dynamicField olmayan) nesnelerde uygulanir.
     */
    private function resolvePictureSafeLeftInsetForSendParams(array $sendParams, int $regionX = 0): int
    {
        if ($regionX > 0) {
            return 0;
        }

        $designData = is_array($sendParams['design_data'] ?? null) ? $sendParams['design_data'] : [];
        $product = is_array($sendParams['product'] ?? null) ? $sendParams['product'] : [];

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

            if ($this->shouldApplySafeLeftInsetForObject($obj, $adjustedLeft, $textAlign, $threshold)) {
                return true;
            }
        }

        return false;
    }

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

    private function shouldApplySafeLeftInsetForObject(array $obj, float $adjustedLeft, string $textAlign = 'left', float $threshold = 12.0): bool
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

        if ($textAlign !== 'left' && $originX !== 'left') {
            return false;
        }

        return $adjustedLeft <= max(0.0, $threshold);
    }

    private function toPublicMediaUrl(string $companyId, string $path): ?string
    {
        $normalized = str_replace('\\', '/', trim($path));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $normalized)) {
            return $normalized;
        }

        $relative = $normalized;
        $diskPath = $this->toDiskPath($normalized);
        if ($diskPath) {
            $storageRoot = rtrim(str_replace('\\', '/', STORAGE_PATH), '/');
            $diskNormalized = str_replace('\\', '/', $diskPath);
            if (strpos($diskNormalized, $storageRoot . '/') === 0) {
                $relative = 'storage/' . ltrim(substr($diskNormalized, strlen($storageRoot)), '/');
            } elseif (strpos($diskNormalized, str_replace('\\', '/', BASE_PATH) . '/storage/') !== false) {
                $parts = explode('/storage/', $diskNormalized, 2);
                if (isset($parts[1])) {
                    $relative = 'storage/' . ltrim($parts[1], '/');
                }
            }
        }

        $relative = ltrim($relative, '/');
        if (strpos($relative, 'storage/') !== 0) {
            $relative = 'storage/' . $relative;
        }

        $contentServerUrl = trim((string)(($this->getSettings($companyId)['content_server_url'] ?? '') ?: ''));
        $contentServerUrl = preg_replace('#://l((?:\d{1,3}\.){3}\d{1,3})#i', '://$1', $contentServerUrl);
        $base = '';
        if ($contentServerUrl !== '' && preg_match('#^https?://#i', $contentServerUrl)) {
            $base = preg_replace('#/api/esl/mqtt/content/?$#i', '', rtrim($contentServerUrl, '/'));
        }
        if ($base === '') {
            $base = rtrim((string)(defined('APP_URL') ? APP_URL : ''), '/');
        }
        if ($base === '') {
            return null;
        }

        return $base . '/' . $relative;
    }

    /**
     * Cihaz için bekleyen MQTT komutlarını getir
     *
     * @param string $deviceId Cihaz ID
     * @param int $limit Maksimum komut sayısı
     * @return array Bekleyen komutlar
     */
    public function getPendingCommands(string $deviceId, int $limit = 10): array
    {
        $commands = $this->db->fetchAll(
            "SELECT id, command, parameters, priority, created_at
             FROM device_commands
             WHERE device_id = ? AND status = 'pending'
             ORDER BY priority DESC, created_at ASC
             LIMIT ?",
            [$deviceId, $limit]
        );

        // Komutları sent olarak işaretle
        if (!empty($commands)) {
            $ids = array_column($commands, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $this->db->query(
                "UPDATE device_commands SET status = 'sent', executed_at = CURRENT_TIMESTAMP
                 WHERE id IN ($placeholders) AND status = 'pending'",
                $ids
            );
        }

        // Parametreleri decode et
        foreach ($commands as &$cmd) {
            $cmd['parameters'] = json_decode($cmd['parameters'] ?? '{}', true) ?: [];
        }

        return $commands;
    }

    /**
     * Cihazdan gelen push_id ile eşleşen komutu tamamlandı olarak işaretler.
     *
     * @return int Güncellenen satır sayısı
     */
    public function acknowledgeCommandByPushId(string $deviceId, int $pushId): int
    {
        if ($pushId <= 0) {
            return 0;
        }

        $candidates = $this->db->fetchAll(
            "SELECT id, parameters
             FROM device_commands
             WHERE device_id = ? AND status IN ('pending', 'sent')
             ORDER BY created_at DESC
             LIMIT 50",
            [$deviceId]
        );

        $matchedId = null;
        foreach ($candidates as $candidate) {
            $params = json_decode((string)($candidate['parameters'] ?? '{}'), true);
            if (!is_array($params)) {
                continue;
            }

            $candidatePushId = (int)($params['push_id'] ?? 0);
            if ($candidatePushId === $pushId) {
                $matchedId = (string)($candidate['id'] ?? '');
                break;
            }
        }

        if ($matchedId === null || $matchedId === '') {
            return 0;
        }

        $this->db->update('device_commands', [
            'status' => 'completed',
            'executed_at' => date('Y-m-d H:i:s'),
            'result' => 'ack_push_id:' . $pushId
        ], "id = ? AND status IN ('pending', 'sent')", [$matchedId]);

        return $this->db->rowCount();
    }

    /**
     * ACK gelmeyen sent komutlarini tekrar pending durumuna alir.
     *
     * @return int Güncellenen satır sayısı
     */
    public function requeueStaleSentCommands(string $deviceId, int $olderThanSeconds = 45, int $limit = 20): int
    {
        $olderThanSeconds = max(5, $olderThanSeconds);
        $limit = max(1, $limit);

        $this->db->query(
            "WITH stale AS (
                SELECT id
                FROM device_commands
                WHERE device_id = ?
                  AND status = 'sent'
                  AND (result IS NULL OR result = '')
                  AND executed_at IS NOT NULL
                  AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '6 hours')
                  AND executed_at <= (CURRENT_TIMESTAMP - (? * INTERVAL '1 second'))
                ORDER BY executed_at ASC
                LIMIT ?
            )
            UPDATE device_commands dc
            SET status = 'pending', executed_at = NULL
            FROM stale
            WHERE dc.id = stale.id",
            [$deviceId, $olderThanSeconds, $limit]
        );

        return $this->db->rowCount();
    }

    /**
     * MQTT broker bağlantısını test et (fsockopen)
     *
     * @param string $companyId Firma ID
     * @return array Test sonucu
     */
    public function testConnection(string $companyId): array
    {
        $settings = $this->getSettings($companyId);

        if (!$settings) {
            return ['success' => false, 'error' => 'MQTT ayarları bulunamadı'];
        }

        $host = $settings['broker_url'];
        // URL'den host'u çıkar
        $parsed = parse_url($host);
        $host = $parsed['host'] ?? $host;
        $port = (int)($settings['broker_port'] ?? 1883);

        $startTime = microtime(true);
        $errno = 0;
        $errstr = '';
        set_error_handler(function() {}, E_WARNING);
        $connection = fsockopen($host, $port, $errno, $errstr, 5);
        restore_error_handler();
        $responseTime = round((microtime(true) - $startTime) * 1000, 2);

        if ($connection) {
            fclose($connection);

            // last_connected güncelle
            $this->db->update('mqtt_settings', [
                'last_connected' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'company_id = ?', [$companyId]);

            return [
                'success' => true,
                'message' => 'MQTT broker bağlantısı başarılı',
                'host' => $host,
                'port' => $port,
                'response_time' => $responseTime
            ];
        }

        return [
            'success' => false,
            'error' => "Bağlantı başarısız: {$errstr} (#{$errno})",
            'host' => $host,
            'port' => $port
        ];
    }

    /**
     * Cihazın iletişim modunu güncelle
     *
     * @param string $deviceId DB cihaz ID
     * @param string $mode İletişim modu (http-server, mqtt, http)
     * @param string|null $mqttClientId MQTT client ID
     * @param string|null $mqttTopic MQTT topic
     */
    public function setDeviceCommunicationMode(
        string $deviceId,
        string $mode,
        ?string $mqttClientId = null,
        ?string $mqttTopic = null
    ): bool {
        $data = [
            'communication_mode' => $mode,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($mqttClientId !== null) {
            $data['mqtt_client_id'] = $mode === 'mqtt'
                ? $this->normalizeClientId($mqttClientId)
                : $mqttClientId;
        }
        if ($mqttTopic !== null) {
            $data['mqtt_topic'] = $mqttTopic;
        }

        return $this->db->update('devices', $data, 'id = ?', [$deviceId]) !== false;
    }

    /**
     * ClientID ile cihaz bul
     *
     * @param string $clientId PavoDisplay client ID (MAC benzeri: 2051F54F500A)
     * @param string|null $companyId Opsiyonel firma filtresi
     * @return array|null Cihaz kaydı
     */
    public function findDeviceByClientId(string $clientId, ?string $companyId = null): ?array
    {
        // 1. Exact match
        $sql = "SELECT * FROM devices WHERE (device_id = ? OR mqtt_client_id = ?)";
        $params = [$clientId, $clientId];

        if ($companyId) {
            $sql .= " AND company_id = ?";
            $params[] = $companyId;
        }

        $result = $this->db->fetch($sql, $params);
        if ($result) return $result;

        // 2. Normalized MAC match (iki nokta/tire/nokta kaldirarak)
        $normalized = strtoupper(str_replace([':', '-', '.'], '', $clientId));
        $sql = "SELECT * FROM devices WHERE (
            UPPER(REPLACE(REPLACE(REPLACE(device_id, ':', ''), '-', ''), '.', '')) = ?
            OR UPPER(REPLACE(REPLACE(REPLACE(mqtt_client_id, ':', ''), '-', ''), '.', '')) = ?
        )";
        $params = [$normalized, $normalized];

        if ($companyId) {
            $sql .= " AND company_id = ?";
            $params[] = $companyId;
        }

        return $this->db->fetch($sql, $params) ?: null;
    }
}

