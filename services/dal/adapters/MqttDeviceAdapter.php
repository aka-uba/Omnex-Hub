<?php
/**
 * MQTT Device Adapter
 *
 * MQTT protokolu ile haberlesebilen cihazlar icin adapter.
 * MqttBrokerService sinifini sarar.
 *
 * Protokol: MQTT (topic bazli publish/subscribe)
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';
require_once BASE_PATH . '/services/MqttBrokerService.php';

class MqttDeviceAdapter extends AbstractDeviceAdapter
{
    private MqttBrokerService $mqttService;

    public function __construct()
    {
        parent::__construct();
        $this->mqttService = new MqttBrokerService();
    }

    public function getAdapterId(): string
    {
        return 'mqtt';
    }

    public function getDisplayName(): string
    {
        return 'MQTT Device';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping'          => true,
            'send_image'    => true,
            'reboot'        => true,
            'clear_storage' => true,
            'brightness'    => true,
        ]);
    }

    /**
     * MQTT cihaz icin ping: son heartbeat zamanini kontrol et.
     */
    public function ping(array $device): array
    {
        $lastSeen = $device['last_seen'] ?? $device['last_online'] ?? null;
        $isOnline = false;

        if ($lastSeen) {
            $lastSeenTime = strtotime($lastSeen);
            if ($lastSeenTime !== false) {
                // Report interval (varsayilan 300sn) + 60sn tolerans
                $isOnline = (time() - $lastSeenTime) < 360;
            }
        }

        return [
            'online'        => $isOnline,
            'method'        => 'mqtt_heartbeat',
            'response_time' => null,
            'last_seen'     => $lastSeen,
        ];
    }

    /**
     * MQTT uzerinden icerik gonder.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $companyId = $device['company_id'] ?? '';
        $templateId = $options['template_id'] ?? null;
        $productId = $options['product_id'] ?? null;

        $sendParams = [
            'image'      => $imagePath,
            'width'      => $options['width'] ?? $device['screen_width'] ?? 800,
            'height'     => $options['height'] ?? $device['screen_height'] ?? 1280,
            'priority'   => $options['priority'] ?? 'normal',
        ];

        try {
            $result = $this->mqttService->queueContentUpdate(
                $device,
                $sendParams,
                $companyId,
                $templateId,
                $productId
            );

            return [
                'success' => $result['success'] ?? false,
                'error'   => $result['error'] ?? null,
                'skipped' => false,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * MQTT kontrol komutu gonder.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        $deviceId = $device['id'] ?? '';
        $companyId = $device['company_id'] ?? '';

        // Ping ozel: sadece heartbeat kontrolu
        if ($action === 'ping') {
            $pingResult = $this->ping($device);
            return [
                'success' => true,
                'message' => $pingResult['online'] ? 'Device online (MQTT)' : 'Device offline (MQTT)',
                'data'    => $pingResult,
            ];
        }

        // Device info ozel: metadata cache'den don
        if ($action === 'device_info') {
            $metadata = json_decode($device['metadata'] ?? '{}', true) ?: [];
            return [
                'success' => true,
                'message' => 'Device info (MQTT cache)',
                'data'    => [
                    'name'          => $device['name'] ?? '',
                    'client_id'     => $device['device_id'] ?? $device['mqtt_client_id'] ?? '',
                    'model'         => $metadata['model'] ?? $device['model'] ?? '',
                    'firmware'      => $metadata['firmware'] ?? $device['firmware_version'] ?? '',
                    'screen_width'  => $device['screen_width'] ?? null,
                    'screen_height' => $device['screen_height'] ?? null,
                    'free_space'    => $metadata['free_space'] ?? null,
                    'total_storage' => $metadata['total_storage'] ?? null,
                    'battery_level' => $device['battery_level'] ?? null,
                ],
            ];
        }

        // MQTT aksiyon esleme
        $mqttActionMap = [
            'refresh'          => 'updatelabel',
            'reboot'           => 'deviceRestart',
            'clear_memory'     => 'clearspace',
            'set_brightness'   => 'backlight',
            'firmware_upgrade' => 'deviceUpgrade',
        ];

        $mqttAction = $mqttActionMap[$action] ?? $action;
        $commandPayload = [
            'action'   => $mqttAction,
            'push_id'  => $this->mqttService->createPushId($deviceId . ':' . $action),
            'clientid' => $device['device_id'] ?? $device['mqtt_client_id'] ?? '',
            'priority' => in_array($action, ['reboot', 'firmware_upgrade']) ? 10 : 5,
        ];

        // Aksiyon parametreleri
        if ($action === 'set_brightness') {
            $commandPayload['brightness_action'] = $params['brightness_action'] ?? 'set';
            $commandPayload['level'] = (int)($params['level'] ?? 100);
        }

        try {
            $result = $this->mqttService->publishCommand($deviceId, $commandPayload, $companyId);

            return [
                'success' => $result['success'] ?? false,
                'message' => ($result['success'] ?? false)
                    ? 'MQTT command queued'
                    : ($result['error'] ?? 'MQTT command failed'),
                'data' => [
                    'command_id'         => $result['command_id'] ?? null,
                    'communication_mode' => 'mqtt',
                ],
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
