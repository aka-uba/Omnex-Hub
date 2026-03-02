<?php
/**
 * Gateway Bridge Decorator
 *
 * IP-bazli adapter'i gateway agent uzerinden yonlendiren dekorator.
 * Decorator pattern: ayni interface, farkli transport katmani.
 *
 * Cihaz yerel agda, sunucu uzakta oldugunda gateway agent kopruleme yapar.
 * gateway_commands tablosuna komut ekler, gateway agent alip calistirir.
 *
 * @package OmnexDisplayHub\DAL
 */

require_once __DIR__ . '/AbstractDeviceAdapter.php';

class GatewayBridgeDecorator extends AbstractDeviceAdapter
{
    private DeviceAdapterInterface $inner;
    private array $gatewayInfo;

    /**
     * @param DeviceAdapterInterface $inner       Sarilacak adapter
     * @param array                  $gatewayInfo ['gateway_id', 'local_ip']
     */
    public function __construct(DeviceAdapterInterface $inner, array $gatewayInfo)
    {
        parent::__construct();
        $this->inner = $inner;
        $this->gatewayInfo = $gatewayInfo;
    }

    public function getAdapterId(): string
    {
        return 'gateway:' . $this->inner->getAdapterId();
    }

    public function getDisplayName(): string
    {
        return $this->inner->getDisplayName() . ' (via Gateway)';
    }

    public function getCapabilities(): array
    {
        return $this->inner->getCapabilities();
    }

    public function getSupportedActions(): array
    {
        return $this->inner->getSupportedActions();
    }

    /**
     * Gateway uzerinden ping.
     */
    public function ping(array $device): array
    {
        $result = $this->sendGatewayCommand($device, 'ping_device', [
            'device_ip' => $this->gatewayInfo['local_ip'],
        ]);

        return [
            'online'        => $result['success'] ?? false,
            'method'        => 'gateway',
            'response_time' => null,
            'error'         => $result['error'] ?? null,
            'via_gateway'   => true,
        ];
    }

    /**
     * Gateway uzerinden icerik gonder.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $result = $this->sendGatewayCommand($device, 'send_label', [
            'device_ip'  => $this->gatewayInfo['local_ip'],
            'client_id'  => $device['device_id'] ?? $device['client_id'] ?? '',
            'image_path' => $imagePath,
            'width'      => $options['width'] ?? 800,
            'height'     => $options['height'] ?? 1280,
            'priority'   => $options['priority'] ?? 'normal',
        ]);

        return [
            'success'     => $result['success'] ?? false,
            'error'       => $result['error'] ?? null,
            'skipped'     => false,
            'md5'         => $result['md5'] ?? null,
            'via_gateway' => true,
        ];
    }

    /**
     * Gateway uzerinden kontrol komutu.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        $commandParams = array_merge($params, [
            'device_ip' => $this->gatewayInfo['local_ip'],
            'client_id' => $device['device_id'] ?? $device['client_id'] ?? '',
        ]);

        $result = $this->sendGatewayCommand($device, $action . '_device', $commandParams);

        return [
            'success'     => $result['success'] ?? false,
            'message'     => $result['message'] ?? ($result['success'] ? 'Command sent via gateway' : 'Gateway command failed'),
            'data'        => $result['data'] ?? null,
            'via_gateway' => true,
        ];
    }

    /**
     * Gateway komut kuyruguna komut ekle ve sonucu bekle.
     *
     * @param array  $device
     * @param string $command  Komut tipi (orn: 'send_label', 'ping_device')
     * @param array  $params   Komut parametreleri
     * @param int    $timeout  Bekleme suresi (saniye)
     * @return array ['success','error','message','data','md5']
     */
    private function sendGatewayCommand(array $device, string $command, array $params, int $timeout = 20): array
    {
        $commandId = $this->db->generateUuid();
        $gatewayId = $this->gatewayInfo['gateway_id'];
        $deviceId = $device['id'] ?? '';

        try {
            // Komutu kuyruga ekle
            $this->db->insert('gateway_commands', [
                'id'         => $commandId,
                'gateway_id' => $gatewayId,
                'device_id'  => $deviceId,
                'type'       => $command,
                'payload'    => json_encode($params),
                'status'     => 'pending',
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            // Sonucu bekle (polling)
            $startTime = time();
            $pollInterval = 500000; // 0.5 saniye (microseconds)

            while ((time() - $startTime) < $timeout) {
                usleep($pollInterval);

                $cmd = $this->db->fetch(
                    "SELECT status, result, error FROM gateway_commands WHERE id = ?",
                    [$commandId]
                );

                if (!$cmd) {
                    return ['success' => false, 'error' => 'Gateway command not found'];
                }

                $status = $cmd['status'] ?? 'pending';

                if ($status === 'completed') {
                    $resultData = json_decode($cmd['result'] ?? '{}', true) ?: [];
                    return [
                        'success' => true,
                        'message' => 'Command completed via gateway',
                        'data'    => $resultData,
                        'md5'     => $resultData['md5'] ?? null,
                    ];
                }

                if ($status === 'failed') {
                    return [
                        'success' => false,
                        'error'   => $cmd['error'] ?? 'Gateway command failed',
                    ];
                }

                // Hala pending veya processing - beklemeye devam
            }

            // Timeout
            // Komutu timeout olarak isaretle
            $this->db->update('gateway_commands', [
                'status'     => 'timeout',
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$commandId]);

            return [
                'success' => false,
                'error'   => "Gateway command timed out after {$timeout}s",
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
