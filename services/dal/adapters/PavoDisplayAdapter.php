<?php
/**
 * PavoDisplay Device Adapter
 *
 * PavoDisplayGateway sinifini sarar (wrap).
 * Mevcut gateway koduna DOKUNMAZ, sadece DAL arabirimini saglar.
 *
 * Protokol: HTTP-SERVER (cihaz HTTP sunucu calistirir, biz push ederiz)
 * Desteklenen cihazlar: PavoDisplay 10.1", 13.3", 21" ESL Android
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

class PavoDisplayAdapter extends AbstractDeviceAdapter
{
    private PavoDisplayGateway $gateway;

    public function __construct()
    {
        parent::__construct();
        $this->gateway = new PavoDisplayGateway();
    }

    public function getAdapterId(): string
    {
        return 'pavodisplay';
    }

    public function getDisplayName(): string
    {
        return 'PavoDisplay ESL';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping'                => true,
            'send_image'          => true,
            'send_video'          => true,
            'delta_check'         => true,
            'reboot'              => true,
            'clear_storage'       => true,
            'brightness'          => true,
            'device_info'         => true,
            'firmware_update'     => true,
            'bluetooth_provision' => true,
            'network_config'      => true,
            'batch_send'          => true,
            'gateway_bridge'      => true,
        ]);
    }

    /**
     * TCP socket veya HTTP ile ping.
     */
    public function ping(array $device): array
    {
        $ip = $device['ip_address'] ?? null;
        if (!$ip) {
            return ['online' => false, 'error' => 'No IP address', 'method' => 'none'];
        }

        try {
            return $this->gateway->ping($ip, true); // lightweight TCP ping
        } catch (\Exception $e) {
            return ['online' => false, 'error' => $e->getMessage(), 'method' => 'tcp'];
        }
    }

    /**
     * Gorsel/video icerigini cihaza gonder.
     * Mevcut sendToMultipleDevicesParallel() metodunu kullanir.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $ip = $device['ip_address'] ?? null;
        $clientId = $device['device_id'] ?? $device['client_id'] ?? null;

        if (!$ip || !$clientId) {
            return ['success' => false, 'error' => 'Device network info missing (IP or client ID)'];
        }

        $devices = [[
            'id'        => $device['id'] ?? '',
            'ip_address' => $ip,
            'device_id'  => $clientId,
            'type'       => $device['type'] ?? 'esl',
            'name'       => $device['name'] ?? '',
        ]];

        $taskConfig = [
            'width'    => $options['width'] ?? $device['screen_width'] ?? 800,
            'height'   => $options['height'] ?? $device['screen_height'] ?? 1280,
            'priority' => $options['priority'] ?? 'normal',
        ];

        // Ek task config (varsa)
        if (!empty($options['task_config'])) {
            $taskConfig = array_merge($taskConfig, $options['task_config']);
        }

        try {
            $result = $this->gateway->sendToMultipleDevicesParallel($devices, $imagePath, $taskConfig);

            $detail = $result['details'][0] ?? [];
            $successCount = (int)($result['success'] ?? 0);
            $skippedCount = (int)($result['skipped'] ?? 0);

            return [
                'success' => $successCount > 0,
                'skipped' => $skippedCount > 0,
                'error'   => $detail['error'] ?? null,
                'md5'     => $result['image_md5'] ?? null,
                'reason'  => $skippedCount > 0 ? ($detail['skip_reason'] ?? 'Delta match') : null,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Batch gonderim icin cihaz listesini ve callback'i hazirlar.
     * RenderQueueWorker tarafindan batch_send capability ile kullanilir.
     *
     * @param array    $devices     Cihaz satirlari dizisi
     * @param string   $imagePath   Gorsel yolu
     * @param array    $taskConfig  Task yapılandirmasi
     * @param callable|null $progressCallback  Her cihaz icin callback($deviceId, $status, $message)
     * @return array ['total','success','failed','skipped','details','image_md5']
     */
    public function sendBatch(array $devices, string $imagePath, array $taskConfig = [], ?callable $progressCallback = null): array
    {
        $formattedDevices = [];
        foreach ($devices as $dev) {
            $formattedDevices[] = [
                'id'         => $dev['id'] ?? '',
                'ip_address' => $dev['ip_address'] ?? '',
                'device_id'  => $dev['device_id'] ?? $dev['client_id'] ?? '',
                'type'       => $dev['type'] ?? 'esl',
                'name'       => $dev['name'] ?? '',
            ];
        }

        try {
            return $this->gateway->sendToMultipleDevicesParallel(
                $formattedDevices,
                $imagePath,
                $taskConfig,
                $progressCallback
            );
        } catch (\Exception $e) {
            return [
                'total'   => count($devices),
                'success' => 0,
                'failed'  => count($devices),
                'skipped' => 0,
                'error'   => $e->getMessage(),
            ];
        }
    }

    /**
     * Cihaz kontrol komutu calistir.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        $ip = $device['ip_address'] ?? null;
        if (!$ip) {
            return ['success' => false, 'message' => 'No IP address configured'];
        }

        try {
            switch ($action) {
                case 'ping':
                    $r = $this->gateway->ping($ip);
                    return [
                        'success' => $r['online'] ?? false,
                        'message' => ($r['online'] ?? false) ? 'Device online' : 'Device offline',
                        'data'    => $r,
                    ];

                case 'device_info':
                    $appId = $params['app_id'] ?? '';
                    $appSecret = $params['app_secret'] ?? '';
                    $r = $this->gateway->getDeviceDetails($ip, $appId, $appSecret);
                    return [
                        'success' => $r['success'] ?? false,
                        'message' => ($r['success'] ?? false) ? 'Device info retrieved' : ($r['error'] ?? 'Failed'),
                        'data'    => $r,
                    ];

                case 'refresh':
                    $taskPath = $params['task_path'] ?? $params['taskJson'] ?? null;
                    if (!$taskPath) {
                        return ['success' => false, 'message' => 'No task path provided'];
                    }
                    $r = $this->gateway->triggerReplay($ip, $taskPath);
                    return [
                        'success' => $r['success'] ?? false,
                        'message' => $r['message'] ?? '',
                        'data'    => $r,
                    ];

                case 'clear_memory':
                    $r = $this->gateway->uploadFile($ip, 'files/task/.clear', '', true);
                    return [
                        'success' => $r['success'] ?? false,
                        'message' => ($r['success'] ?? false) ? 'Storage cleared' : ($r['error'] ?? 'Failed'),
                        'data'    => $r,
                    ];

                case 'set_brightness':
                    $level = (int)($params['level'] ?? 100);
                    $brightnessAction = $params['brightness_action'] ?? 'set';
                    $payload = json_encode([
                        'action'  => 'backlight',
                        'push_id' => time(),
                        'brightness_action' => $brightnessAction,
                        'level'   => $level,
                    ]);
                    $clientId = $device['device_id'] ?? '';
                    $r = $this->gateway->uploadFile($ip, "files/config/{$clientId}_brightness.js", $payload);
                    return [
                        'success' => $r['success'] ?? false,
                        'message' => ($r['success'] ?? false) ? "Brightness set to {$level}" : ($r['error'] ?? 'Failed'),
                        'data'    => $r,
                    ];

                case 'check_file':
                    $filePath = $params['file_path'] ?? '';
                    if (!$filePath) {
                        return ['success' => false, 'message' => 'No file path provided'];
                    }
                    $r = $this->gateway->checkFile($ip, $filePath);
                    return [
                        'success' => true,
                        'message' => ($r['exists'] ?? false) ? 'File exists' : 'File not found',
                        'data'    => $r,
                    ];

                default:
                    return parent::control($device, $action, $params);
            }
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Mevcut PavoDisplayGateway'e dogrudan erisim (ozel durumlar icin).
     */
    public function getGateway(): PavoDisplayGateway
    {
        return $this->gateway;
    }
}
