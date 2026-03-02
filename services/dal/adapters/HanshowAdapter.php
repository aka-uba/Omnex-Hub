<?php
/**
 * Hanshow ESL Device Adapter
 *
 * HanshowGateway sinifini sarar (wrap).
 * Mevcut gateway koduna DOKUNMAZ, sadece DAL arabirimini saglar.
 *
 * Protokol: RF (ESL-Working v2.5.3 REST API uzerinden)
 * IP gerektirmez - cihazlar RF ile haberlesir.
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';
require_once BASE_PATH . '/services/HanshowGateway.php';

class HanshowAdapter extends AbstractDeviceAdapter
{
    private ?HanshowGateway $gateway = null;

    /**
     * Lazy initialization - HanshowGateway DB'den ayar yukler.
     */
    private function getGateway(): HanshowGateway
    {
        if ($this->gateway === null) {
            $this->gateway = new HanshowGateway();
        }
        return $this->gateway;
    }

    public function getAdapterId(): string
    {
        return 'hanshow';
    }

    public function getDisplayName(): string
    {
        return 'Hanshow ESL';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping'       => true,
            'send_image' => true,
            'led_flash'  => true,
            'page_switch' => true,
            'batch_send' => true,
        ]);
    }

    /**
     * Hanshow ESL'e ping: LED flash testi ile.
     */
    public function ping(array $device): array
    {
        $eslId = $this->normalizeEslId($device);
        if (!$eslId) {
            return ['online' => false, 'error' => 'ESL ID missing', 'method' => 'rf_led'];
        }

        try {
            $gw = $this->getGateway();
            $result = $gw->flashLight($eslId, ['green'], [
                'flash_count' => 1,
                'loop_count'  => 1,
                'on_time'     => 50,
                'off_time'    => 50,
            ]);

            $success = (isset($result['errno']) && (int)$result['errno'] <= 1);
            return [
                'online'        => $success,
                'method'        => 'rf_led',
                'response_time' => null,
                'error'         => $success ? null : ($result['errmsg'] ?? 'LED flash failed'),
            ];
        } catch (\Exception $e) {
            return ['online' => false, 'error' => $e->getMessage(), 'method' => 'rf_led'];
        }
    }

    /**
     * Base64 gorsel olarak ESL'e icerik gonder.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $eslId = $this->normalizeEslId($device);
        if (!$eslId) {
            return ['success' => false, 'error' => 'ESL ID missing'];
        }

        if (!file_exists($imagePath)) {
            return ['success' => false, 'error' => 'Image file not found: ' . $imagePath];
        }

        try {
            $gw = $this->getGateway();
            $imageBase64 = base64_encode(file_get_contents($imagePath));

            $priority = ($options['priority'] ?? 'normal') === 'urgent' ? 1 : 10;
            $sendOptions = [
                'priority' => $priority,
            ];

            $result = $gw->sendImageToESL($eslId, $imageBase64, $sendOptions);

            $errno = isset($result['errno']) ? (int)$result['errno'] : -1;
            $success = ($errno === 0 || $errno === 1);

            return [
                'success' => $success,
                'error'   => $success ? null : ($result['errmsg'] ?? 'Hanshow send failed'),
                'skipped' => false,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Cihaz kontrol komutu calistir.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        $eslId = $this->normalizeEslId($device);
        if (!$eslId) {
            return ['success' => false, 'message' => 'ESL ID missing'];
        }

        try {
            $gw = $this->getGateway();

            switch ($action) {
                case 'led_flash':
                case 'ping':
                    $colors = $params['colors'] ?? ['green'];
                    $flashOptions = [
                        'on_time'     => $params['on_time'] ?? 100,
                        'off_time'    => $params['off_time'] ?? 100,
                        'flash_count' => $params['flash_count'] ?? 3,
                        'loop_count'  => $params['loop_count'] ?? 2,
                    ];
                    $result = $gw->flashLight($eslId, $colors, $flashOptions);
                    $ok = (isset($result['errno']) && (int)$result['errno'] <= 1);
                    return [
                        'success' => $ok,
                        'message' => $ok
                            ? (((int)($result['errno'] ?? 0) === 1) ? 'LED signal sent, processing...' : 'LED signal sent successfully')
                            : ($result['errmsg'] ?? 'LED flash failed'),
                        'data' => $result,
                    ];

                case 'page_switch':
                    $pageId = (int)($params['page'] ?? $params['pageId'] ?? 0);
                    $stayTime = (int)($params['stay_time'] ?? $params['stayTime'] ?? 0);
                    $result = $gw->switchPage($eslId, $pageId, $stayTime);
                    $ok = (isset($result['errno']) && (int)$result['errno'] <= 1);
                    return [
                        'success' => $ok,
                        'message' => $ok ? 'Page switch sent' : ($result['errmsg'] ?? 'Page switch failed'),
                        'data' => $result,
                    ];

                case 'refresh':
                    // Hanshow icin refresh = son icerigi tekrar gonder
                    return [
                        'success' => false,
                        'message' => 'Refresh requires content re-send for Hanshow ESL',
                    ];

                default:
                    return parent::control($device, $action, $params);
            }
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * ESL ID formatini normalize et.
     * 8 hex karakter -> XX-XX-XX-XX formatina cevir.
     */
    private function normalizeEslId(array $device): string
    {
        $eslId = $device['device_id'] ?? $device['client_id'] ?? $device['serial_number'] ?? '';
        if (empty($eslId)) {
            return '';
        }

        $eslIdNoDash = strtoupper(str_replace('-', '', $eslId));
        if (strlen($eslIdNoDash) === 8 && strpos($eslId, '-') === false) {
            $eslId = implode('-', str_split($eslIdNoDash, 2));
        }

        return $eslId;
    }
}
