<?php
/**
 * Null Device Adapter (Fallback)
 *
 * Hicbir adapter eslesmediginde kullanilir.
 * Tum operasyonlar basarisiz doner ve log kaydeder.
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';

class NullAdapter extends AbstractDeviceAdapter
{
    public function getAdapterId(): string
    {
        return 'null';
    }

    public function getDisplayName(): string
    {
        return 'Unknown Device';
    }

    public function ping(array $device): array
    {
        $this->logWarning('ping', $device);
        return [
            'online' => false,
            'error'  => 'No adapter configured for this device type',
            'method' => 'none',
        ];
    }

    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $this->logWarning('sendContent', $device);
        return [
            'success' => false,
            'error'   => 'No adapter configured for this device type (model: '
                . ($device['model'] ?? 'unknown') . ', type: ' . ($device['type'] ?? 'unknown') . ')',
        ];
    }

    public function control(array $device, string $action, array $params = []): array
    {
        $this->logWarning('control:' . $action, $device);
        return [
            'success' => false,
            'message' => 'No adapter configured for this device type',
        ];
    }

    /**
     * Uyari logu yaz.
     */
    private function logWarning(string $operation, array $device): void
    {
        $deviceId = $device['id'] ?? 'unknown';
        $model = $device['model'] ?? 'unknown';
        $type = $device['type'] ?? 'unknown';

        error_log("[DAL NullAdapter] Operation '{$operation}' called for device {$deviceId} (model={$model}, type={$type}). No adapter matched.");
    }
}
