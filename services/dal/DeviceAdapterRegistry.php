<?php
/**
 * Device Adapter Registry
 *
 * Singleton kayit defteri: cihaz satirindan uygun adapter'i cozer.
 * Yeni adapter eklemek icin registerDefaults() icinde register() cagrilir.
 *
 * Cozumleme onceligi:
 *   1. device.adapter_id kolonu (acik override)
 *   2. Kural esleme (model, communication_mode, manufacturer, device_brand)
 *   3. type kolonu bazli fallback
 *   4. NullAdapter (son care)
 *
 * @package OmnexDisplayHub\DAL
 */

require_once __DIR__ . '/DeviceAdapterInterface.php';
require_once __DIR__ . '/AbstractDeviceAdapter.php';

class DeviceAdapterRegistry
{
    private static ?DeviceAdapterRegistry $instance = null;

    /** @var array<string, DeviceAdapterInterface> adapterId => instance */
    private array $adapters = [];

    /** @var array Oncelik sirali esleme kurallari */
    private array $resolverRules = [];

    private function __construct() {}

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
            self::$instance->registerDefaults();
        }
        return self::$instance;
    }

    /**
     * Adapter kaydet.
     *
     * @param DeviceAdapterInterface $adapter
     * @param array $matchRules  Esleme kurallari dizisi
     *   Ornek: [['model' => 'hanshow_esl'], ['manufacturer' => 'Hanshow']]
     */
    public function register(DeviceAdapterInterface $adapter, array $matchRules = []): void
    {
        $id = $adapter->getAdapterId();
        $this->adapters[$id] = $adapter;

        foreach ($matchRules as $rule) {
            $rule['_adapter_id'] = $id;
            $this->resolverRules[] = $rule;
        }
    }

    /**
     * Cihaz satirindan uygun adapter'i coz.
     *
     * @param array $device  Veritabanindan gelen cihaz satiri veya render_queue_items JOIN
     * @return DeviceAdapterInterface
     */
    public function resolve(array $device): DeviceAdapterInterface
    {
        // 1. Acik adapter_id kolonu (en yuksek oncelik)
        $explicitId = $device['adapter_id'] ?? null;
        if ($explicitId && isset($this->adapters[$explicitId])) {
            return $this->adapters[$explicitId];
        }

        // 2. Kural bazli esleme
        foreach ($this->resolverRules as $rule) {
            if ($this->matchesRule($device, $rule)) {
                return $this->adapters[$rule['_adapter_id']];
            }
        }

        // 3. Type bazli fallback
        $type = $device['type'] ?? $device['device_type'] ?? '';
        if ($type === 'esl' && isset($this->adapters['pavodisplay'])) {
            return $this->adapters['pavodisplay'];
        }

        // 4. NullAdapter
        return $this->adapters['null'] ?? $this->createNullAdapter();
    }

    /**
     * Gateway dekoratoru ile coz.
     * Gateway online ise ve adapter gateway destekliyorsa, dekorator ile sarar.
     *
     * @param array $device
     * @return DeviceAdapterInterface
     */
    public function resolveWithGateway(array $device): DeviceAdapterInterface
    {
        $adapter = $this->resolve($device);

        // Gateway kontrolu
        $gatewayId = $device['gateway_id'] ?? null;
        $gatewayStatus = $device['gateway_status'] ?? '';
        $gatewayBridge = $adapter->getCapabilities()['gateway_bridge'] ?? false;

        if ($gatewayId && $gatewayStatus === 'online' && $gatewayBridge) {
            // Heartbeat timeout kontrolu
            $heartbeat = $device['gateway_last_heartbeat'] ?? null;
            $heartbeatOk = false;
            if ($heartbeat) {
                $ts = strtotime((string)$heartbeat);
                $heartbeatOk = ($ts !== false && (time() - $ts) <= 120);
            }

            if ($heartbeatOk) {
                require_once __DIR__ . '/GatewayBridgeDecorator.php';
                return new GatewayBridgeDecorator($adapter, [
                    'gateway_id' => $gatewayId,
                    'local_ip'   => $device['gateway_local_ip'] ?? $device['ip_address'] ?? '',
                ]);
            }
        }

        return $adapter;
    }

    /**
     * ID ile adapter al.
     */
    public function get(string $adapterId): ?DeviceAdapterInterface
    {
        return $this->adapters[$adapterId] ?? null;
    }

    /**
     * Kayitli tum adapter'lari listele.
     *
     * @return array [ ['id'=>..., 'name'=>..., 'capabilities'=>[...]] ]
     */
    public function listAdapters(): array
    {
        $list = [];
        foreach ($this->adapters as $id => $adapter) {
            if ($id === 'null') continue;
            $list[] = [
                'id'           => $id,
                'name'         => $adapter->getDisplayName(),
                'capabilities' => $adapter->getCapabilities(),
                'actions'      => $adapter->getSupportedActions(),
            ];
        }
        return $list;
    }

    /**
     * Kural esleme kontrolu.
     */
    private function matchesRule(array $device, array $rule): bool
    {
        foreach ($rule as $key => $value) {
            if ($key === '_adapter_id') continue;

            $deviceVal = $device[$key] ?? '';

            // manufacturer icin kısmi esleme (stripos)
            if ($key === 'manufacturer' && !empty($deviceVal)) {
                if (stripos($deviceVal, $value) !== false) continue;
                return false;
            }

            // device_brand icin buyuk/kucuk harf duyarsiz esleme
            if ($key === 'device_brand' && !empty($deviceVal)) {
                if (strcasecmp($deviceVal, $value) === 0) continue;
                return false;
            }

            // Tam esleme
            if ((string)$deviceVal !== (string)$value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Varsayilan adapter'lari kaydet.
     * SIRA ONEMLI: Daha spesifik kurallar once gelmeli.
     */
    private function registerDefaults(): void
    {
        $adapterDir = __DIR__ . '/adapters';

        // Tum adapter dosyalarini yukle
        if (is_dir($adapterDir)) {
            $files = glob($adapterDir . '/*Adapter.php');
            if ($files) {
                foreach ($files as $file) {
                    require_once $file;
                }
            }
        }

        // Hanshow ESL (RF tabanli, IP gerektirmez)
        if (class_exists('HanshowAdapter')) {
            $this->register(new HanshowAdapter(), [
                ['model' => 'hanshow_esl'],
            ]);
        }

        // MQTT cihazlar (iletisim modu bazli)
        if (class_exists('MqttDeviceAdapter')) {
            $this->register(new MqttDeviceAdapter(), [
                ['communication_mode' => 'mqtt'],
            ]);
        }

        // HTTP pull cihazlar (icerigi cihaz serverdan polling ile alir)
        if (class_exists('HttpPullAdapter')) {
            $this->register(new HttpPullAdapter(), [
                ['communication_mode' => 'http'],
            ]);
        }

        // PavoDisplay ESL (HTTP-SERVER, en yaygin)
        if (class_exists('PavoDisplayAdapter')) {
            $this->register(new PavoDisplayAdapter(), [
                ['model' => 'esl_android'],
                ['model' => 'PavoDisplay'],
                ['model' => 'esl_rtos'],
                ['type' => 'esl', 'communication_mode' => 'http-server'],
                ['type' => 'esl'],
            ]);
        }

        // PWA Player (pull-bazli, IP gerektirmez)
        if (class_exists('PwaPlayerAdapter')) {
            $this->register(new PwaPlayerAdapter(), [
                ['model' => 'pwa_player'],
            ]);
        }

        // NullAdapter (fallback)
        if (class_exists('NullAdapter')) {
            $this->register(new NullAdapter(), []);
        }
    }

    /**
     * NullAdapter yoksa olustur.
     */
    private function createNullAdapter(): DeviceAdapterInterface
    {
        $nullFile = __DIR__ . '/adapters/NullAdapter.php';
        if (file_exists($nullFile)) {
            require_once $nullFile;
            $adapter = new NullAdapter();
            $this->adapters['null'] = $adapter;
            return $adapter;
        }

        // Acil fallback: anonim sinif
        return new class extends AbstractDeviceAdapter {
            public function getAdapterId(): string { return 'null'; }
            public function getDisplayName(): string { return 'Unknown Device'; }
        };
    }
}
