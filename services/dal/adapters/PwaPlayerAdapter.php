<?php
/**
 * PWA Player Device Adapter
 *
 * Pull-bazli cihazlar (PWA Signage Player) icin adapter.
 * Cihaz sunucudan icerik ceker (poll), biz icerik atamasini DB'de yapariz.
 *
 * Protokol: PULL (cihaz GET /api/player/content cagirarak icerik alir)
 * IP gerektirmez - cihaz kendisi baglanir.
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';

class PwaPlayerAdapter extends AbstractDeviceAdapter
{
    public function getAdapterId(): string
    {
        return 'pwa_player';
    }

    public function getDisplayName(): string
    {
        return 'PWA Signage Player';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping'            => true,
            'send_image'      => true,
            'send_video'      => true,
            'playlist_assign' => true,
        ]);
    }

    /**
     * PWA Player icin ping: son heartbeat zamanini kontrol et.
     */
    public function ping(array $device): array
    {
        $lastHeartbeat = $device['last_heartbeat'] ?? $device['last_seen'] ?? $device['last_online'] ?? null;
        $isOnline = false;

        if ($lastHeartbeat) {
            $ts = strtotime($lastHeartbeat);
            if ($ts !== false) {
                // Player 30sn'de bir heartbeat atar, 120sn tolerans
                $isOnline = (time() - $ts) < 120;
            }
        }

        return [
            'online'        => $isOnline,
            'method'        => 'heartbeat_check',
            'response_time' => null,
            'last_heartbeat' => $lastHeartbeat,
        ];
    }

    /**
     * PWA Player icin icerik gonderimi: DB'de icerik atamasi yap.
     * Player sonraki poll'da yeni icerigi alir.
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $deviceId = $device['id'] ?? '';
        if (!$deviceId) {
            return ['success' => false, 'error' => 'Device ID missing'];
        }

        try {
            $contentData = [
                'type'        => 'template',
                'image_path'  => $imagePath,
                'template_id' => $options['template_id'] ?? null,
                'product_id'  => $options['product_id'] ?? null,
                'updated_at'  => date('Y-m-d H:i:s'),
            ];

            // Cihazin current_content alanini guncelle
            $this->db->update('devices', [
                'current_content'     => json_encode($contentData),
                'current_template_id' => $options['template_id'] ?? null,
                'last_sync'           => date('Y-m-d H:i:s'),
                'updated_at'          => date('Y-m-d H:i:s'),
            ], 'id = ?', [$deviceId]);

            return [
                'success' => true,
                'skipped' => false,
                'error'   => null,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * PWA Player kontrol komutu: device_commands tablosuna ekle.
     */
    public function control(array $device, string $action, array $params = []): array
    {
        $deviceId = $device['id'] ?? '';

        if ($action === 'ping') {
            $pingResult = $this->ping($device);
            return [
                'success' => true,
                'message' => $pingResult['online'] ? 'Player online' : 'Player offline',
                'data'    => $pingResult,
            ];
        }

        // Komut kuyruguna ekle - player sonraki poll'da alir
        $allowedCommands = ['refresh', 'reload', 'clear_cache', 'restart'];
        if (!in_array($action, $allowedCommands)) {
            return parent::control($device, $action, $params);
        }

        try {
            $this->db->insert('device_commands', [
                'id'         => $this->db->generateUuid(),
                'device_id'  => $deviceId,
                'command'    => $action,
                'params'     => !empty($params) ? json_encode($params) : null,
                'status'     => 'pending',
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            return [
                'success' => true,
                'message' => "Command '{$action}' queued for player",
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
