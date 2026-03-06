<?php
/**
 * HTTP Pull Device Adapter
 *
 * Cihazin sunucudan polling ile icerik cektigi mod.
 * Push yerine device_content_assignments icin payload dosyasi yazilir.
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';
require_once BASE_PATH . '/services/EslSignValidator.php';

class HttpPullAdapter extends AbstractDeviceAdapter
{
    private EslSignValidator $validator;

    public function __construct()
    {
        parent::__construct();
        $this->validator = new EslSignValidator();
    }

    public function getAdapterId(): string
    {
        return 'http-pull';
    }

    public function getDisplayName(): string
    {
        return 'HTTP Pull Device';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping' => true,
            'send_image' => true,
            'send_video' => true,
            'batch_send' => false,
            'gateway_bridge' => false,
        ]);
    }

    public function ping(array $device): array
    {
        $lastSeen = $device['last_seen'] ?? $device['last_online'] ?? null;
        $isOnline = false;

        if ($lastSeen) {
            $lastSeenTime = strtotime((string)$lastSeen);
            if ($lastSeenTime !== false) {
                $isOnline = (time() - $lastSeenTime) < 360;
            }
        }

        return [
            'online' => $isOnline,
            'method' => 'http_poll_heartbeat',
            'response_time' => null,
            'last_seen' => $lastSeen,
        ];
    }

    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $companyId = (string)($device['company_id'] ?? '');
        if ($companyId === '') {
            return ['success' => false, 'error' => 'Company context missing'];
        }

        $sendParams = [
            'image' => $imagePath,
            'width' => $options['width'] ?? $device['screen_width'] ?? 800,
            'height' => $options['height'] ?? $device['screen_height'] ?? 1280,
            'priority' => $options['priority'] ?? 'normal',
        ];

        if (!empty($options['product']) && is_array($options['product'])) {
            $sendParams['product'] = $options['product'];
        }
        if (!empty($options['design_data']) && is_array($options['design_data'])) {
            $sendParams['design_data'] = $options['design_data'];
        }

        $result = $this->validator->queueContentForHttpDevice(
            $device,
            $sendParams,
            $companyId,
            $options['template_id'] ?? null,
            $options['product_id'] ?? null
        );

        return [
            'success' => (bool)($result['success'] ?? false),
            'error' => $result['error'] ?? null,
            'skipped' => false,
        ];
    }
}
