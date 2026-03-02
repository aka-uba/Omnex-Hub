<?php
/**
 * Abstract Device Adapter
 *
 * Tum adapter'lar icin varsayilan implementasyon.
 * Yeni adapter yazarken bu siniftan turetilir ve sadece
 * gerekli metodlar override edilir.
 *
 * @package OmnexDisplayHub\DAL
 */

require_once __DIR__ . '/DeviceAdapterInterface.php';

abstract class AbstractDeviceAdapter implements DeviceAdapterInterface
{
    protected $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Varsayilan yetenekler - hepsi false.
     * Alt siniflar sadece desteklediklerini true yapar.
     */
    public function getCapabilities(): array
    {
        return [
            'ping'                 => false,
            'send_image'           => false,
            'send_video'           => false,
            'delta_check'          => false,
            'reboot'               => false,
            'clear_storage'        => false,
            'brightness'           => false,
            'led_flash'            => false,
            'page_switch'          => false,
            'firmware_update'      => false,
            'device_info'          => false,
            'bluetooth_provision'  => false,
            'network_config'       => false,
            'batch_send'           => false,
            'gateway_bridge'       => false,
            'playlist_assign'      => false,
        ];
    }

    /**
     * Yeteneklerden desteklenen aksiyonlari otomatik hesapla.
     */
    public function getSupportedActions(): array
    {
        $caps = $this->getCapabilities();
        $actionMap = [
            'ping'             => 'ping',
            'send_image'       => 'refresh',
            'reboot'           => 'reboot',
            'clear_storage'    => 'clear_memory',
            'brightness'       => 'set_brightness',
            'device_info'      => 'device_info',
            'led_flash'        => 'led_flash',
            'page_switch'      => 'page_switch',
            'firmware_update'  => 'firmware_upgrade',
        ];

        $actions = [];
        foreach ($actionMap as $cap => $action) {
            if (!empty($caps[$cap])) {
                $actions[] = $action;
            }
        }
        return $actions;
    }

    /**
     * Varsayilan kontrol: desteklenmiyor.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        return [
            'success' => false,
            'message' => "Action '{$action}' not supported by " . $this->getAdapterId()
        ];
    }

    /**
     * Varsayilan ping: desteklenmiyor.
     */
    public function ping(array $device): array
    {
        return [
            'online' => false,
            'error'  => 'Ping not supported by ' . $this->getAdapterId()
        ];
    }

    /**
     * Varsayilan sendContent: desteklenmiyor.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        return [
            'success' => false,
            'error'   => 'Send not supported by ' . $this->getAdapterId()
        ];
    }

    /**
     * Helper: Cihazin gateway uzerinden erisimi var mi?
     */
    protected function hasGatewayRoute(array $device): bool
    {
        return !empty($device['gateway_id'])
            && ($device['gateway_status'] ?? '') === 'online';
    }

    /**
     * Helper: Cihaz IP'si mevcut ve gecerli mi?
     */
    protected function hasValidIp(array $device): bool
    {
        $ip = $device['ip_address'] ?? '';
        return !empty($ip) && ($ip !== '0.0.0.0');
    }
}
