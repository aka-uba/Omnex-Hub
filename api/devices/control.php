<?php
/**
 * Device Control API - Direct device control for ESL/PavoDisplay devices
 *
 * POST /api/devices/:id/control
 *
 * Actions: refresh, reboot, clear_memory, ping, device_info, set_brightness, check_file
 *
 * Supports both direct control (local server) and gateway-based control (remote server)
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');
$body = $request->body();

// FormData (multipart) ile gelen action kontrolü
$action = $body['action'] ?? $_POST['action'] ?? '';

// Validate action
$allowedActions = [
    'refresh',          // Refresh/replay display
    'reboot',           // Reboot device
    'clear_memory',     // Clear device storage
    'ping',             // Check device online status
    'device_info',      // Get detailed device info
    'set_brightness',   // Set backlight brightness
    'check_file',       // Check if file exists on device
    'firmware_upgrade', // Upload firmware update (DANGEROUS!)
    'led_flash',        // LED flash test (Hanshow ESL)
    'page_switch'       // Page switch (Hanshow ESL)
];

if (!in_array($action, $allowedActions)) {
    Response::badRequest('Geçersiz işlem: ' . $action);
}

// Get device with full details including gateway link
$device = $db->fetch(
    "SELECT d.*, g.name as group_name,
            gd.gateway_id, gd.local_ip as gateway_local_ip,
            gw.name as gateway_name, gw.status as gateway_status
     FROM devices d
     LEFT JOIN device_groups g ON d.group_id = g.id
     LEFT JOIN gateway_devices gd ON d.id = gd.device_id
     LEFT JOIN gateways gw ON gd.gateway_id = gw.id
     WHERE d.id = ? AND d.company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Check if device has IP address for direct control
$ipAddress = $device['ip_address'] ?? null;
$deviceType = $device['type'] ?? '';
$model = $device['model'] ?? '';

// Determine if this is a PavoDisplay ESL device
$isPavoDisplay = ($deviceType === 'esl' || $model === 'esl_android' || $model === 'PavoDisplay');

// Determine if this is a Hanshow ESL device (communicates via RF, no IP required)
$isHanshowEsl = ($model === 'hanshow_esl' || strpos($device['manufacturer'] ?? '', 'Hanshow') !== false);

// Check if device is behind a gateway
$gatewayId = $device['gateway_id'] ?? null;
$gatewayOnline = ($device['gateway_status'] ?? '') === 'online';

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

$useGateway = $gatewayEnabled && $gatewayId && $gatewayOnline;

// If gateway local IP is available, prefer it
if ($useGateway && !empty($device['gateway_local_ip'])) {
    $ipAddress = $device['gateway_local_ip'];
}

// ============== DAL (Device Abstraction Layer) YOLU ==============
// dal_enabled aktifse, tum kontrol komutlari adapter uzerinden gider.
// Pasifse mevcut if/else zinciri (asagida) fallback olarak calisir.
$dalEnabled = false;
if ($companySettings && !empty($companySettings['data'])) {
    $settingsCheck = json_decode($companySettings['data'], true) ?: [];
    $dalEnabled = (bool)($settingsCheck['dal_enabled'] ?? false);
}

if ($dalEnabled) {
    require_once BASE_PATH . '/services/dal/DeviceAdapterRegistry.php';

    $registry = DeviceAdapterRegistry::getInstance();
    $adapter = $registry->resolveWithGateway($device);

    $controlResult = $adapter->control($device, $action, $body);

    $result = [
        'device_id'   => $deviceId,
        'device_name' => $device['name'],
        'action'      => $action,
        'success'     => $controlResult['success'] ?? false,
        'message'     => $controlResult['message'] ?? '',
        'via_gateway' => (strpos($adapter->getAdapterId(), 'gateway:') === 0),
        'via_dal'     => true,
        'adapter'     => $adapter->getAdapterId(),
    ];

    if (isset($controlResult['data'])) {
        $result = array_merge($result, $controlResult['data']);
    }

    // Ping basarilarinda cihaz durumunu guncelle
    if ($action === 'ping' && ($controlResult['data']['online'] ?? $controlResult['success'] ?? false)) {
        $db->update('devices', [
            'status'     => 'online',
            'last_seen'  => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$deviceId]);
    }

    // Audit log
    Logger::audit($action, 'devices', [
        'device_id'   => $deviceId,
        'device_name' => $device['name'],
        'adapter'     => $adapter->getAdapterId(),
        'success'     => $result['success'],
        'user_id'     => $user['id'],
    ]);

    if ($result['success'] || isSoftDeviceInfoFailure($action, $result['message'] ?? '')) {
        if (!$result['success']) {
            $result['success'] = true;
            $result['soft_failure'] = true;
            $result['reachable'] = false;
        }
        Response::success($result);
    } else {
        Response::json(['success' => false, 'message' => $result['message'], 'data' => $result], 400);
    }
    return;
}
// ============== DAL SONU - Asagisi mevcut fallback ==============

// ============== MQTT HYBRID MODE CHECK ==============
// MQTT modundaki PavoDisplay cihazlari icin komut kuyruguna yonlendir
$communicationMode = $device['communication_mode'] ?? 'http-server';
$isMqttDevice = ($communicationMode === 'mqtt');

if ($isMqttDevice) {
    require_once BASE_PATH . '/services/MqttBrokerService.php';
    $mqttService = new MqttBrokerService();

    // MQTT action mapping: control.php actions -> PavoDisplay MQTT actions
    $mqttActionMap = [
        'refresh' => 'updatelabel',
        'reboot' => 'deviceRestart',
        'clear_memory' => 'clearspace',
        'set_brightness' => 'backlight',
        'firmware_upgrade' => 'deviceUpgrade'
    ];

    // ping ve device_info icin ozel islem
    if ($action === 'ping') {
        // MQTT cihazda ping: son report zamanini kontrol et
        $lastSeen = $device['last_seen'] ?? $device['last_online'] ?? null;
        $isOnline = false;
        if ($lastSeen) {
            $lastSeenTime = strtotime($lastSeen);
            // Report interval (varsayilan 300sn) + 60sn tolerans
            $isOnline = (time() - $lastSeenTime) < 360;
        }

        $result['success'] = true;
        $result['message'] = $isOnline ? 'Cihaz cevrimici (MQTT)' : 'Cihaz cevrimdisi (MQTT)';
        $result['online'] = $isOnline;
        $result['last_seen'] = $lastSeen;
        $result['communication_mode'] = 'mqtt';

        if ($isOnline) {
            $db->update('devices', [
                'status' => 'online',
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$deviceId]);
        }

        Response::success($result);
        return;
    }

    if ($action === 'device_info') {
        // MQTT cihazda device_info: metadata'dan cache'li bilgi don
        $metadata = json_decode($device['metadata'] ?? '{}', true) ?: [];

        $result['success'] = true;
        $result['message'] = 'Cihaz bilgileri (MQTT cache)';
        $result['communication_mode'] = 'mqtt';
        $result['device_info'] = [
            'name' => $device['name'],
            'client_id' => $device['device_id'] ?? $device['mqtt_client_id'],
            'model' => $metadata['model'] ?? $device['model'],
            'firmware' => $metadata['firmware'] ?? $device['firmware_version'],
            'screen_width' => $device['screen_width'],
            'screen_height' => $device['screen_height'],
            'free_space' => $metadata['free_space'] ?? null,
            'total_storage' => $metadata['total_storage'] ?? $metadata['storage'] ?? null,
            'temperature' => $metadata['temperature'] ?? null,
            'uptime' => $metadata['uptime'] ?? null,
            'last_report' => $metadata['last_report'] ?? null,
            'battery_level' => $device['battery_level'] ?? null,
            'signal_strength' => $device['signal_strength'] ?? null
        ];

        // Storage hesaplama (HTTP tarafiyla ayni mantik)
        $freeSpace = $result['device_info']['free_space'];
        $totalStorage = $result['device_info']['total_storage'];
        if ($freeSpace && $totalStorage) {
            $usedSpace = $totalStorage - $freeSpace;
            $result['device_info']['used_space'] = $usedSpace;
            $result['device_info']['usage_percent'] = round(($usedSpace / $totalStorage) * 100, 1);
        }

        Response::success($result);
        return;
    }

    // Diger aksiyonlar icin MQTT komut kuyruguna ekle
    $mqttAction = $mqttActionMap[$action] ?? $action;
    $commandPayload = [
        'action' => $mqttAction,
        'push_id' => time(),
        'clientid' => $device['device_id'] ?? $device['mqtt_client_id'],
        'priority' => ($action === 'reboot' || $action === 'firmware_upgrade') ? 10 : 5
    ];

    // Aksiyon parametreleri ekle
    if ($action === 'set_brightness') {
        $commandPayload['brightness_action'] = $body['brightness_action'] ?? 'set';
        $commandPayload['level'] = isset($body['level']) ? (int)$body['level'] : 100;
    }

    $publishResult = $mqttService->publishCommand($deviceId, $commandPayload, $companyId);

    $result['success'] = $publishResult['success'];
    $result['message'] = $publishResult['success']
        ? 'MQTT komutu kuyruga eklendi (cihaz sonraki report\'unda alacak)'
        : ($publishResult['error'] ?? 'MQTT komutu gonderilemedi');
    $result['communication_mode'] = 'mqtt';
    $result['command_id'] = $publishResult['command_id'] ?? null;

    // Log the action
    Logger::audit($action, 'devices', [
        'device_id' => $deviceId,
        'device_name' => $device['name'],
        'communication_mode' => 'mqtt',
        'success' => $result['success'],
        'user_id' => $user['id']
    ]);

    if ($result['success']) {
        Response::success($result);
    } else {
        Response::json(['success' => false, 'message' => $result['message'], 'data' => $result], 400);
    }
    return;
}

// Hanshow ESL specific actions (don't require IP - RF based communication)
$hanshowActions = ['led_flash', 'page_switch', 'refresh', 'ping', 'reboot', 'clear_memory'];
$isHanshowAction = $isHanshowEsl && in_array($action, $hanshowActions);

// Some actions require IP address (except for Hanshow ESL and MQTT devices)
$ipRequiredActions = ['ping', 'refresh', 'clear_memory', 'device_info', 'set_brightness', 'check_file'];
if (in_array($action, $ipRequiredActions) && !$ipAddress && $isPavoDisplay && !$isHanshowEsl) {
    Response::badRequest('Cihazda IP adresi yapılandırılmamış');
}

$result = [
    'device_id' => $deviceId,
    'device_name' => $device['name'],
    'action' => $action,
    'success' => false,
    'via_gateway' => $useGateway,
    'device_type' => $isHanshowEsl ? 'hanshow_esl' : ($isPavoDisplay ? 'pavo_display' : 'other')
];

// ============== HANSHOW ESL CONTROL ==============
// Hanshow ESL uses RF communication through ESL-Working, not IP-based control
if ($isHanshowEsl && $isHanshowAction) {
    require_once BASE_PATH . '/services/HanshowGateway.php';
    $hanshowGateway = new HanshowGateway();

    // ESL ID is stored in device_id or serial_number field
    $eslId = $device['device_id'] ?? $device['serial_number'] ?? '';

    // Normalize ESL ID format (should be XX-XX-XX-XX)
    $eslIdNoDash = strtoupper(str_replace('-', '', $eslId));
    if (strlen($eslIdNoDash) === 8 && strpos($eslId, '-') === false) {
        $eslId = implode('-', str_split($eslIdNoDash, 2));
    }

    if (empty($eslId)) {
        Response::badRequest('ESL ID bulunamadı');
    }

    try {
        switch ($action) {
            case 'led_flash':
            case 'ping':
                // LED flash as ping/test for Hanshow ESL
                $colors = $body['colors'] ?? ['green'];
                $options = [
                    'on_time' => $body['on_time'] ?? 100,
                    'off_time' => $body['off_time'] ?? 100,
                    'flash_count' => $body['flash_count'] ?? 3,
                    'loop_count' => $body['loop_count'] ?? 2
                ];

                $flashResult = $hanshowGateway->flashLight($eslId, $colors, $options);

                // v2.5.3 errno: 0=success, 1=processing
                $isSuccess = (isset($flashResult['errno']) && $flashResult['errno'] <= 1) ||
                             (isset($flashResult['status_no']) && $flashResult['status_no'] <= 1);

                $result['success'] = $isSuccess;
                $result['message'] = $isSuccess
                    ? (($flashResult['errno'] ?? 0) === 1 ? 'LED sinyal gönderildi, işleniyor...' : 'LED sinyal başarıyla gönderildi')
                    : ($flashResult['errmsg'] ?? $flashResult['message'] ?? 'LED sinyal gönderilemedi');
                $result['esl_id'] = $eslId;
                $result['colors'] = $colors;
                $result['api_response'] = $flashResult;

                // Include debug info if available
                if (isset($flashResult['_debug'])) {
                    $result['debug'] = $flashResult['_debug'];
                }
                break;

            case 'refresh':
                // Hanshow ESL refresh: mevcut ürün/template binding'ini bulup tekrar gönder
                // Önce hanshow_esls tablosundan kontrol et
                $eslRecord = $db->fetch(
                    "SELECT * FROM hanshow_esls WHERE esl_id = ? AND company_id = ?",
                    [$eslId, $companyId]
                );

                $currentProductId = $eslRecord['current_product_id']
                    ?? $device['current_content']
                    ?? null;
                $currentTemplateId = $eslRecord['current_template_id']
                    ?? $device['current_template_id']
                    ?? null;

                if (empty($currentProductId) && empty($currentTemplateId)) {
                    $result['success'] = false;
                    $result['message'] = 'Bu ESL\'e henüz ürün/şablon atanmamış. Önce ürün üzerinden etiket gönderin.';
                    break;
                }

                // Ürün bilgilerini al
                $product = null;
                if ($currentProductId) {
                    $product = $db->fetch(
                        "SELECT * FROM products WHERE id = ? AND company_id = ?",
                        [$currentProductId, $companyId]
                    );
                }

                // Template bilgilerini al
                $template = null;
                if ($currentTemplateId) {
                    $template = $db->fetch(
                        "SELECT * FROM templates WHERE id = ?",
                        [$currentTemplateId]
                    );
                }

                if (!$product && !$template) {
                    $result['success'] = false;
                    $result['message'] = 'Atanmış ürün veya şablon bulunamadı. Ürün üzerinden tekrar etiket gönderin.';
                    break;
                }

                // Ekran boyutlarını belirle
                $width = $eslRecord['screen_width'] ?? $device['screen_width'] ?? $template['width'] ?? 152;
                $height = $eslRecord['screen_height'] ?? $device['screen_height'] ?? $template['height'] ?? 152;
                $screenColor = $eslRecord['screen_color'] ?? 'BWR';

                // Görseli render et ve gönder
                if ($product) {
                    $imageBase64 = $hanshowGateway->renderImage($product, $template ?? [], $width, $height, $screenColor);
                    $sendResult = $hanshowGateway->sendImageToESL($eslId, $imageBase64, ['priority' => 10]);
                } else {
                    $result['success'] = false;
                    $result['message'] = 'Ürün bilgisi olmadan yenileme yapılamaz.';
                    break;
                }

                $isSuccess = ($sendResult['success'] ?? false) ||
                             (isset($sendResult['errno']) && $sendResult['errno'] <= 1);

                $result['success'] = $isSuccess;
                $result['message'] = $isSuccess
                    ? 'Ekran yenileme komutu gönderildi'
                    : ('Ekran yenilenemedi: ' . ($sendResult['errmsg'] ?? $sendResult['message'] ?? 'Bilinmeyen hata'));
                $result['esl_id'] = $eslId;

                // Status güncelle
                if ($isSuccess && $eslRecord) {
                    $db->update('hanshow_esls', [
                        'status' => 'updating',
                        'updated_at' => date('Y-m-d H:i:s')
                    ], 'id = ?', [$eslRecord['id']]);
                }
                break;

            case 'page_switch':
                $pageId = $body['page_id'] ?? 0;
                $stayTime = $body['stay_time'] ?? 10;

                $pageResult = $hanshowGateway->switchPage($eslId, $pageId, $stayTime);

                $isSuccess = (isset($pageResult['errno']) && $pageResult['errno'] <= 1) ||
                             (isset($pageResult['status_no']) && $pageResult['status_no'] <= 1);

                $result['success'] = $isSuccess;
                $result['message'] = $isSuccess
                    ? 'Sayfa değiştirme komutu gönderildi'
                    : ($pageResult['errmsg'] ?? 'Sayfa değiştirilemedi');
                $result['esl_id'] = $eslId;
                $result['page_id'] = $pageId;
                break;

            case 'reboot':
                // Hanshow ESL'de doğrudan reboot komutu yok.
                // Sayfa 0'a switch yaparak cihazın iletişimini yenileyebiliriz.
                $rebootResult = $hanshowGateway->switchPage($eslId, 0, 0);

                $isSuccess = (isset($rebootResult['errno']) && $rebootResult['errno'] <= 1) ||
                             (isset($rebootResult['status_no']) && $rebootResult['status_no'] <= 1);

                if ($isSuccess) {
                    // LED flash ile görsel geri bildirim
                    $hanshowGateway->flashLight($eslId, ['red', 'green'], [
                        'flash_count' => 2, 'loop_count' => 1,
                        'on_time' => 100, 'off_time' => 100
                    ]);
                }

                $result['success'] = $isSuccess;
                $result['message'] = $isSuccess
                    ? 'ESL yeniden başlatma komutu gönderildi'
                    : ('ESL yeniden başlatılamadı: ' . ($rebootResult['errmsg'] ?? 'Bilinmeyen hata'));
                $result['esl_id'] = $eslId;
                break;

            case 'clear_memory':
                // Hanshow ESL'de bellek temizleme: boş sayfa gönder
                // 1x1 beyaz piksel base64
                $whitePixel = base64_encode(str_repeat("\xFF", 3));
                $clearResult = $hanshowGateway->sendImageToESL($eslId, $whitePixel, ['priority' => 1]);

                $isSuccess = ($clearResult['success'] ?? false) ||
                             (isset($clearResult['errno']) && $clearResult['errno'] <= 1);

                $result['success'] = $isSuccess;
                $result['message'] = $isSuccess
                    ? 'ESL ekran temizleme komutu gönderildi'
                    : ('ESL temizlenemedi: ' . ($clearResult['errmsg'] ?? 'Bilinmeyen hata'));
                $result['esl_id'] = $eslId;
                break;
        }

        // Update device last_seen
        $db->update('devices', [
            'last_seen' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$deviceId]);

    } catch (Exception $e) {
        Logger::error('Hanshow ESL control error', [
            'device_id' => $deviceId,
            'esl_id' => $eslId,
            'action' => $action,
            'error' => $e->getMessage()
        ]);
        $result['success'] = false;
        $result['message'] = 'ESL kontrol hatası: ' . $e->getMessage();
    }

    // Log the action
    Logger::audit($action, 'devices', [
        'device_id' => $deviceId,
        'device_name' => $device['name'],
        'esl_id' => $eslId ?? null,
        'success' => $result['success'],
        'user_id' => $user['id']
    ]);

    if ($result['success']) {
        Response::success($result);
    } else {
        Response::json(['success' => false, 'message' => $result['message'], 'data' => $result], 400);
    }
    return;
}

// ============== PAVO DISPLAY / GATEWAY CONTROL ==============
// If device is behind a gateway, send command through gateway
if ($useGateway && $isPavoDisplay && $action !== 'firmware_upgrade') {
    $gatewayResult = sendCommandViaGateway($db, $gatewayId, $action, $device, $body);
    $responsePayload = array_merge($result, $gatewayResult);

    if (($gatewayResult['success'] ?? false) || isSoftDeviceInfoFailure($action, $gatewayResult['message'] ?? '')) {
        if (!($gatewayResult['success'] ?? false)) {
            $responsePayload['success'] = true;
            $responsePayload['soft_failure'] = true;
            $responsePayload['reachable'] = false;
        }
        Response::success($responsePayload);
    } else {
        Response::json(['success' => false, 'message' => $gatewayResult['message'], 'data' => $responsePayload], 400);
    }
    return;
}

// Direct control (local server or no gateway)
try {
    // Load PavoDisplayGateway for ESL devices
    $pavoGatewayFile = BASE_PATH . '/services/PavoDisplayGateway.php';

    if ($isPavoDisplay && file_exists($pavoGatewayFile)) {
        require_once $pavoGatewayFile;
        $gateway = new PavoDisplayGateway();

        $result = executeDirectControl($gateway, $action, $device, $ipAddress, $body, $db, $user, $result);
    } else {
        // For non-PavoDisplay devices or missing gateway service, use command queue
        $result = executeCommandQueue($action, $device, $db, $user, $result);
    }
} catch (Exception $e) {
    Logger::error('Device control error', [
        'device_id' => $deviceId,
        'action' => $action,
        'error' => $e->getMessage()
    ]);
    $result['success'] = false;
    $result['message'] = $e->getMessage();
}

// Log the action
Logger::audit($action, 'devices', [
    'device_id' => $deviceId,
    'device_name' => $device['name'],
    'success' => $result['success'],
    'user_id' => $user['id']
]);

if ($result['success'] || isSoftDeviceInfoFailure($action, $result['message'] ?? '')) {
    if (!$result['success']) {
        $result['success'] = true;
        $result['soft_failure'] = true;
        $result['reachable'] = false;
    }
    Response::success($result);
} else {
    Response::json(['success' => false, 'message' => $result['message'], 'data' => $result], 400);
}

function isSoftDeviceInfoFailure($action, $message): bool
{
    if ($action !== 'device_info') {
        return false;
    }

    $normalized = strtolower((string)$message);
    if ($normalized === '') {
        return false;
    }

    $offlinePatterns = [
        'timeout',
        'timed out',
        'failed to connect',
        'could not connect',
        'connection refused',
        'network is unreachable',
        'no route to host',
        'host is down',
        'gateway yan',
        'zaman a',
    ];

    foreach ($offlinePatterns as $pattern) {
        if (strpos($normalized, $pattern) !== false) {
            return true;
        }
    }

    return false;
}

/**
 * Send command to device through gateway
 */
function sendCommandViaGateway($db, $gatewayId, $action, $device, $body): array
{
    // Map actions to gateway commands
    $commandMap = [
        'ping' => 'ping_device',
        'refresh' => 'refresh_device',
        'reboot' => 'reboot_device',
        'clear_memory' => 'clear_device',
        'device_info' => 'device_info',
        'set_brightness' => 'set_brightness',
        'check_file' => 'check_file'
    ];

    $gatewayCommand = $commandMap[$action] ?? $action;

    // Prepare parameters
    $params = [
        'device_id' => $device['id'],
        'device_ip' => $device['ip_address'] ?? $device['gateway_local_ip'],
        'client_id' => $device['device_id']
    ];

    // Add action-specific parameters
    if ($action === 'set_brightness') {
        $params['brightness_action'] = $body['brightness_action'] ?? 'set';
        $params['level'] = isset($body['level']) ? (int)$body['level'] : 100;
    } elseif ($action === 'check_file') {
        $params['file_path'] = $body['file_path'] ?? 'files/task/test.txt';
    }

    // Create command in gateway_commands table
    $commandId = $db->generateUuid();
    $db->insert('gateway_commands', [
        'id' => $commandId,
        'gateway_id' => $gatewayId,
        'device_id' => $device['id'],
        'command' => $gatewayCommand,
        'parameters' => json_encode($params),
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s')
    ]);

    // Wait for gateway to process command (max 30 seconds for control actions)
    $timeout = 30;
    $startTime = time();

    while ((time() - $startTime) < $timeout) {
        $command = $db->fetch(
            "SELECT * FROM gateway_commands WHERE id = ?",
            [$commandId]
        );

        if ($command && $command['status'] === 'completed') {
            $cmdResult = json_decode($command['result'], true) ?? [];
            return [
                'success' => $cmdResult['success'] ?? true,
                'message' => $cmdResult['message'] ?? 'Komut başarıyla çalıştırıldı',
                'gateway_result' => $cmdResult
            ];
        } elseif ($command && $command['status'] === 'failed') {
            return [
                'success' => false,
                'message' => $command['error_message'] ?? 'Gateway komutu başarısız'
            ];
        }

        usleep(500000); // 0.5 second
    }

    return [
        'success' => false,
        'message' => 'Gateway yanıt zaman aşımı. Gateway çalışıyor mu?'
    ];
}

/**
 * Execute direct control on device
 */
function executeDirectControl($gateway, $action, $device, $ipAddress, $body, $db, $user, $result): array
{
    $deviceId = $device['id'];
    $isPavoDisplay = true;

    switch ($action) {
        case 'ping':
            $pingResult = $gateway->ping($ipAddress);
            $result['success'] = $pingResult['online'] ?? false;
            $result['response_time'] = $pingResult['response_time'] ?? null;
            $result['message'] = $result['success'] ? 'Cihaz çevrimiçi' : 'Cihaz çevrimdışı';

            // Update device status
            $newStatus = $result['success'] ? 'online' : 'offline';
            $db->update('devices', [
                'status' => $newStatus,
                'last_seen' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$deviceId]);
            break;

        case 'refresh':
            $taskPath = "files/task/{$device['device_id']}.js";
            $refreshResult = $gateway->triggerReplay($ipAddress, $taskPath);
            $result['success'] = $refreshResult['success'] ?? false;
            $result['message'] = $result['success'] ? 'Ekran yenilendi' : ($refreshResult['error'] ?? 'Yenileme başarısız');
            break;

        case 'reboot':
            $restartResult = $gateway->restartDevice($ipAddress);
            $result['success'] = $restartResult['success'] ?? false;

            if ($result['success']) {
                $result['message'] = 'Cihaz yeniden başlatılıyor';
            } else {
                $result['message'] = 'HTTP-SERVER modunda yeniden başlatma desteklenmiyor';
                $result['not_supported'] = true;
                $result['hint'] = 'Bluetooth veya MQTT kullanın';
                $result['bluetooth_command'] = '+SET-DEVICE:{"reboot":1, "Token":""}';
            }
            break;

        case 'clear_memory':
            $clearResult = $gateway->clearSpace($ipAddress);
            $result['success'] = $clearResult['success'] ?? false;
            $result['message'] = $result['success'] ? 'Cihaz belleği temizlendi' : ($clearResult['error'] ?? 'Bellek temizleme başarısız');

            // Temizleme başarılıysa varsayılan görsel yükle
            if ($result['success']) {
                $defaultImageUploaded = uploadDefaultImage($gateway, $ipAddress, $device, $db);
                if ($defaultImageUploaded) {
                    $result['message'] .= ' ve varsayılan görsel yüklendi';
                    $result['default_image_uploaded'] = true;
                }
            }
            break;

        case 'device_info':
            $infoResult = $gateway->getDeviceDetails($ipAddress);
            $result['success'] = $infoResult['success'] ?? false;

            if ($result['success']) {
                $result['message'] = 'Cihaz bilgileri alındı';
                $result['device_info'] = [
                    'name' => $infoResult['name'] ?? null,
                    'client_id' => $infoResult['client_id'] ?? null,
                    'model' => $infoResult['model'] ?? null,
                    'firmware' => $infoResult['firmware'] ?? null,
                    'screen_width' => $infoResult['screen_width'] ?? null,
                    'screen_height' => $infoResult['screen_height'] ?? null,
                    'free_space' => $infoResult['free_space'] ?? null,
                    'total_storage' => $infoResult['storage'] ?? null
                ];

                if ($result['device_info']['free_space'] && $result['device_info']['total_storage']) {
                    $usedSpace = $result['device_info']['total_storage'] - $result['device_info']['free_space'];
                    $usagePercent = round(($usedSpace / $result['device_info']['total_storage']) * 100, 1);
                    $result['device_info']['used_space'] = $usedSpace;
                    $result['device_info']['usage_percent'] = $usagePercent;
                }
            } else {
                $result['message'] = $infoResult['error'] ?? 'Cihaz bilgileri alınamadı';
                $result['device_info'] = [
                    'name' => $device['name'] ?? null,
                    'client_id' => $device['device_id'] ?? null,
                    'model' => $device['model'] ?? null,
                    'firmware' => $device['firmware_version'] ?? null,
                    'screen_width' => $device['screen_width'] ?? null,
                    'screen_height' => $device['screen_height'] ?? null,
                    'free_space' => null,
                    'total_storage' => null
                ];
            }
            break;

        case 'set_brightness':
            $brightnessAction = $body['brightness_action'] ?? 'set';
            $level = isset($body['level']) ? (int)$body['level'] : 100;

            $backlightResult = $gateway->setBacklight($ipAddress, $brightnessAction, $level);
            $result['success'] = $backlightResult['success'] ?? false;

            if ($result['success']) {
                $result['message'] = $brightnessAction === 'on' ? 'Ekran ışığı açıldı' :
                    ($brightnessAction === 'off' ? 'Ekran ışığı kapatıldı' : "Parlaklık %{$level} olarak ayarlandı");
            } else {
                $result['message'] = $backlightResult['error'] ?? 'Parlaklık ayarlanamadı';
                $result['not_supported'] = true;
                $result['hint'] = $backlightResult['hint'] ?? 'Bluetooth veya MQTT kullanın';
            }
            break;

        case 'check_file':
            $filePath = $body['file_path'] ?? 'files/task/test.txt';
            $checkResult = $gateway->checkFileDetailed($ipAddress, $filePath);
            $result['success'] = true;
            $result['file_exists'] = $checkResult['exists'] ?? false;
            $result['file_md5'] = $checkResult['md5'] ?? null;
            $result['file_size'] = $checkResult['size'] ?? null;
            $result['message'] = $result['file_exists'] ? 'Dosya mevcut' : 'Dosya bulunamadı';
            break;

        case 'firmware_upgrade':
            $result = handleFirmwareUpgrade($gateway, $device, $ipAddress, $user, $result);
            break;
    }

    return $result;
}

/**
 * Handle firmware upgrade (direct only, not through gateway)
 */
function handleFirmwareUpgrade($gateway, $device, $ipAddress, $user, $result): array
{
    // Check if admin role required
    if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'superadmin', 'admin'])) {
        $result['success'] = false;
        $result['message'] = 'Firmware güncelleme için yönetici yetkisi gereklidir';
        return $result;
    }

    // Check if file was uploaded
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $result['success'] = false;
        $result['message'] = 'Firmware dosyası yüklenemedi';
        return $result;
    }

    $uploadedFile = $_FILES['file'];
    $fileName = $uploadedFile['name'];
    $fileSize = $uploadedFile['size'];
    $fileTmpPath = $uploadedFile['tmp_name'];

    // Validate file extension
    $allowedExtensions = ['pkg', 'bin', 'zip', 'apk'];
    $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    if (!in_array($fileExt, $allowedExtensions)) {
        $result['success'] = false;
        $result['message'] = 'Geçersiz dosya türü. İzin verilen: ' . implode(', ', $allowedExtensions);
        return $result;
    }

    // Max file size: 100MB
    $maxSize = 100 * 1024 * 1024;
    if ($fileSize > $maxSize) {
        $result['success'] = false;
        $result['message'] = 'Dosya boyutu çok büyük (max: 100MB)';
        return $result;
    }

    // Read file content
    $fileContent = file_get_contents($fileTmpPath);
    if ($fileContent === false) {
        $result['success'] = false;
        $result['message'] = 'Dosya okunamadı';
        return $result;
    }

    // Upload firmware to device
    $upgradePath = 'files/upgrade/' . $fileName;
    $upgradeResult = $gateway->uploadFirmware($ipAddress, $fileContent, $upgradePath);

    if ($upgradeResult['success'] ?? false) {
        $result['success'] = true;
        $result['message'] = 'Firmware başarıyla yüklendi. Cihaz yeniden başlatılıyor...';

        Logger::info('Firmware upgrade initiated', [
            'device_id' => $device['id'],
            'device_name' => $device['name'],
            'firmware_file' => $fileName,
            'firmware_size' => $fileSize,
            'user_id' => $user['id']
        ]);
    } else {
        $result['success'] = false;
        $result['message'] = $upgradeResult['error'] ?? 'Firmware yükleme başarısız';
    }

    return $result;
}

/**
 * Upload default image to device after clearing memory
 * Checks for: 1) Device-specific, 2) Company-specific, 3) System default
 */
function uploadDefaultImage($gateway, $ipAddress, $device, $db): bool
{
    $companyId = $device['company_id'] ?? '';
    $deviceId = $device['id'] ?? '';
    $clientId = $device['device_id'] ?? '';
    $screenWidth = $device['screen_width'] ?? 800;
    $screenHeight = $device['screen_height'] ?? 1280;
    $gatewayId = $device['gateway_id'] ?? null;

    // Orientation belirleme
    $orientation = ($screenHeight > $screenWidth) ? 'portrait' : 'landscape';

    // Varsayılan görsel arama sırası
    $possiblePaths = [
        // 1. Cihaza özel
        BASE_PATH . "/storage/defaults/devices/{$deviceId}.jpg",
        BASE_PATH . "/storage/defaults/devices/{$deviceId}.png",
        BASE_PATH . "/storage/defaults/devices/{$clientId}.jpg",
        BASE_PATH . "/storage/defaults/devices/{$clientId}.png",

        // 2. Gateway'e özel (firma altında)
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$screenWidth}x{$screenHeight}.jpg" : null),
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$screenWidth}x{$screenHeight}.png" : null),
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$orientation}.jpg" : null),
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/{$orientation}.png" : null),
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/default.jpg" : null),
        ($gatewayId ? BASE_PATH . "/storage/defaults/companies/{$companyId}/gateways/{$gatewayId}/default.png" : null),

        // 3. Firmaya ve boyuta özel
        BASE_PATH . "/storage/defaults/companies/{$companyId}/{$screenWidth}x{$screenHeight}.jpg",
        BASE_PATH . "/storage/defaults/companies/{$companyId}/{$screenWidth}x{$screenHeight}.png",
        BASE_PATH . "/storage/defaults/companies/{$companyId}/{$orientation}.jpg",
        BASE_PATH . "/storage/defaults/companies/{$companyId}/{$orientation}.png",
        BASE_PATH . "/storage/defaults/companies/{$companyId}/default.jpg",
        BASE_PATH . "/storage/defaults/companies/{$companyId}/default.png",

        // 4. Boyuta özel sistem varsayılanı
        BASE_PATH . "/storage/defaults/{$screenWidth}x{$screenHeight}.jpg",
        BASE_PATH . "/storage/defaults/{$screenWidth}x{$screenHeight}.png",
        BASE_PATH . "/storage/defaults/{$orientation}.jpg",
        BASE_PATH . "/storage/defaults/{$orientation}.png",

        // 5. Genel sistem varsayılanı
        BASE_PATH . "/storage/defaults/default.jpg",
        BASE_PATH . "/storage/defaults/default.png"
    ];

    $defaultImagePath = null;
    foreach (array_filter($possiblePaths) as $path) {
        if (file_exists($path)) {
            $defaultImagePath = $path;
            break;
        }
    }

    // Varsayılan görsel bulunamadıysa
    if (!$defaultImagePath) {
        Logger::debug('No default image found for device', [
            'device_id' => $deviceId,
            'company_id' => $companyId,
            'screen' => "{$screenWidth}x{$screenHeight}"
        ]);
        return false;
    }

    try {
        // Görsel içeriğini oku
        $imageContent = file_get_contents($defaultImagePath);
        if ($imageContent === false) {
            return false;
        }

        // Cihaza yükle
        $remotePath = "files/task/{$clientId}.jpg";
        $uploadResult = $gateway->uploadFile($ipAddress, $remotePath, $imageContent);

        if ($uploadResult['success'] ?? false) {
            // Task config oluştur ve yükle
            $taskConfig = [
                'Id' => $clientId,
                'ItemCode' => 'default',
                'ItemName' => 'Varsayılan Görsel',
                'LabelPicture' => [
                    'X' => 0,
                    'Y' => 0,
                    'Width' => $screenWidth,
                    'Height' => $screenHeight,
                    'PictureName' => "{$clientId}.jpg",
                    'PicturePath' => $remotePath,
                    'PictureMD5' => md5($imageContent)
                ]
            ];

            $taskPath = "files/task/{$clientId}.js";
            $taskUploadResult = $gateway->uploadFile($ipAddress, $taskPath, json_encode($taskConfig, JSON_UNESCAPED_UNICODE));

            if ($taskUploadResult['success'] ?? false) {
                // Ekranı yenile
                $gateway->triggerReplay($ipAddress, $taskPath);

                Logger::info('Default image uploaded after clear', [
                    'device_id' => $deviceId,
                    'image_path' => $defaultImagePath,
                    'remote_path' => $remotePath
                ]);

                return true;
            }
        }
    } catch (Exception $e) {
        Logger::error('Failed to upload default image', [
            'device_id' => $deviceId,
            'error' => $e->getMessage()
        ]);
    }

    return false;
}

/**
 * Queue command for non-PavoDisplay devices
 */
function executeCommandQueue($action, $device, $db, $user, $result): array
{
    $deviceId = $device['id'];
    $commandMap = [
        'refresh' => 'refresh',
        'reboot' => 'reboot',
        'clear_memory' => 'clear_cache'
    ];

    if (!isset($commandMap[$action])) {
        $result['success'] = false;
        $result['message'] = 'Bu cihaz tipi için desteklenmiyor';
        return $result;
    }

    $commandId = $db->generateUuid();
    $db->query(
        "INSERT INTO device_commands (id, device_id, command, status, priority, created_at, created_by)
         VALUES (?, ?, ?, 'pending', 10, CURRENT_TIMESTAMP, ?)",
        [$commandId, $deviceId, $commandMap[$action], $user['id']]
    );

    $result['success'] = true;
    $result['message'] = 'Komut kuyruğa eklendi';
    $result['command_id'] = $commandId;

    return $result;
}

