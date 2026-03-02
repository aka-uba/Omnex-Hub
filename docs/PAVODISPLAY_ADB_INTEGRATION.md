# PavoDisplay ADB Entegrasyonu ve Online Durum İyileştirmeleri

## 📊 Analiz Özeti

### Mevcut Sorunlar

1. **Yanlış Online Durumu**: Cihazlar offline olsa bile bazen online gözüküyor
2. **Yavaş Cihaz Detay Modalı**: Ayarlar modalı çok geç açılıyor (10sn timeout)
3. **Disk Boyutu Gösterilmiyor**: Önceden görünen disk boyutu şimdi gösterilmiyor
4. **Sabit IP Atama Yok**: HTTP API üzerinden sabit IP atanamıyor

### Price Tag Uygulamasının Kullandığı Yöntem

Price Tag uygulaması (`com.pricetag.utility.neutral`) ADB (Android Debug Bridge) kullanarak:

- ✅ Gerçek zamanlı online/offline durumu görüntülüyor
- ✅ Sabit IP ataması yapabiliyor
- ✅ Cihaz bilgilerini hızlı alıyor (HTTP sunucusu olmadan)
- ✅ WiFi ayarlarını yönetebiliyor

## 🔧 Çözüm Önerileri

### Seçenek 1: HTTP API İyileştirmeleri (Kısa Vadeli)

**Uygulama:**

#### 1.1 Timeout Azaltma

```php
// services/PavoDisplayGateway.php

public function getDeviceDetails(string $ip, string $appId = '', string $appSecret = ''): array
{
    // Timeout'u 10sn'den 3sn'ye düşür
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,           // 10 -> 3
        CURLOPT_CONNECTTIMEOUT => 2,    // 5 -> 2
        CURLOPT_HTTPHEADER => [
            'Accept: application/json'
        ]
    ]);
}
```

#### 1.2 Arka Plan Heartbeat Sistemi

```php
// cron/device-heartbeat.php

<?php
require_once __DIR__ . '/../config.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

$db = Database::getInstance();
$gateway = new PavoDisplayGateway();

// Tüm ESL cihazları al
$devices = $db->fetchAll(
    "SELECT id, ip_address, device_id, company_id, status
     FROM devices
     WHERE type = 'esl' AND status != 'inactive'"
);

foreach ($devices as $device) {
    if (!$device['ip_address']) continue;

    // Ping (hızlı, sadece online kontrolü)
    $pingResult = $gateway->ping($device['ip_address']);

    $newStatus = $pingResult['online'] ? 'online' : 'offline';

    // Sadece durum değiştiyse güncelle
    if ($device['status'] !== $newStatus) {
        $db->update('devices', [
            'status' => $newStatus,
            'last_seen' => $pingResult['online'] ? date('Y-m-d H:i:s') : $device['last_seen'],
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$device['id']]);

        Logger::info("Device status changed: {$device['device_id']} -> {$newStatus}");
    }
}

Logger::info("Heartbeat completed for " . count($devices) . " devices");
```

**Windows Task Scheduler Ayarı:**

```xml
<!-- Windows 10/11 için Task Scheduler XML -->
<Task>
  <Triggers>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT30S</Interval>  <!-- 30 saniye -->
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </CalendarTrigger>
  </Triggers>
  <Actions>
    <Exec>
      <Command>C:\xampp\php\php.exe</Command>
      <Arguments>C:\xampp\htdocs\market-etiket-sistemi\cron\device-heartbeat.php</Arguments>
    </Exec>
  </Actions>
</Task>
```

#### 1.3 Frontend - Disk Boyutu Gösterimi

```javascript
// Frontend: DeviceList.js veya DeviceDetail.js

async loadDeviceInfo(deviceId) {
    try {
        const response = await this.app.api.post(`/devices/${deviceId}/control`, {
            action: 'device_info'
        });

        if (response.success && response.device_info) {
            const info = response.device_info;

            // Disk boyutu HTML
            const storageHtml = `
                <div class="storage-info">
                    <div class="storage-bar">
                        <div class="storage-used"
                             style="width: ${info.usage_percent}%"></div>
                    </div>
                    <div class="storage-text">
                        ${formatBytes(info.used_space)} / ${formatBytes(info.total_storage)}
                        (${info.usage_percent}% kullanılıyor)
                    </div>
                </div>
            `;

            document.getElementById('storage-container').innerHTML = storageHtml;
        }
    } catch (error) {
        console.error('Failed to load device info:', error);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```

---

### Seçenek 2: ADB Bridge Servisi (Orta Vadeli)

**ADB Bridge Mimarisi:**

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Web UI     │   HTTP  │  PHP Server │   ADB   │  PavoDisplay│
│  (Browser)  │◄───────►│  AdbBridge  │◄───────►│   Devices   │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  ADB Server  │
                        │  (Port 5037) │
                        └──────────────┘
```

#### 2.1 ADB Bridge Servisi

```php
<?php
/**
 * ADB Bridge Service
 * Android Debug Bridge üzerinden PavoDisplay cihazlarını kontrol eder
 *
 * Gereksinimler:
 * - ADB binary (Android SDK Platform Tools)
 * - Cihazlarda USB Debugging veya WiFi ADB aktif
 * - Geliştirici seçenekleri açık
 */

class AdbBridge
{
    private $adbPath;
    private $timeout = 5;

    public function __construct(string $adbPath = null)
    {
        // Windows varsayılan ADB yolu
        $this->adbPath = $adbPath ?? 'C:/Users/test/AppData/Local/Android/Sdk/platform-tools/adb.exe';

        if (!file_exists($this->adbPath)) {
            throw new Exception("ADB binary not found at: {$this->adbPath}");
        }
    }

    /**
     * ADB sunucusunu başlat
     */
    public function startServer(): array
    {
        exec("\"{$this->adbPath}\" start-server 2>&1", $output, $returnCode);

        return [
            'success' => $returnCode === 0,
            'message' => implode("\n", $output)
        ];
    }

    /**
     * Bağlı cihazları listele
     */
    public function listDevices(): array
    {
        exec("\"{$this->adbPath}\" devices -l 2>&1", $output, $returnCode);

        $devices = [];
        foreach ($output as $line) {
            if (preg_match('/^([\w\d.:]+)\s+device\s+product:(\w+)\s+model:(\w+)/', $line, $matches)) {
                $devices[] = [
                    'serial' => $matches[1],
                    'product' => $matches[2],
                    'model' => $matches[3],
                    'status' => 'device'
                ];
            }
        }

        return [
            'success' => true,
            'devices' => $devices
        ];
    }

    /**
     * WiFi üzerinden ADB bağlantısı kur
     */
    public function connectWifi(string $ip, int $port = 5555): array
    {
        exec("\"{$this->adbPath}\" connect {$ip}:{$port} 2>&1", $output, $returnCode);

        $success = (strpos(implode(' ', $output), 'connected') !== false);

        return [
            'success' => $success,
            'message' => implode("\n", $output),
            'device_serial' => "{$ip}:{$port}"
        ];
    }

    /**
     * WiFi ADB bağlantısını kes
     */
    public function disconnect(string $deviceSerial): array
    {
        exec("\"{$this->adbPath}\" disconnect {$deviceSerial} 2>&1", $output, $returnCode);

        return [
            'success' => $returnCode === 0,
            'message' => implode("\n", $output)
        ];
    }

    /**
     * Cihaz online mı kontrol et
     */
    public function isOnline(string $deviceSerial): array
    {
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"dumpsys wifi | grep 'Wi-Fi is'\" 2>&1", $output, $returnCode);

        $online = (strpos(implode(' ', $output), 'enabled') !== false);

        return [
            'success' => true,
            'online' => $online,
            'device_serial' => $deviceSerial
        ];
    }

    /**
     * Cihaz IP adresini al
     */
    public function getIpAddress(string $deviceSerial): array
    {
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"ip addr show wlan0 | grep 'inet '\" 2>&1", $output, $returnCode);

        $ipAddress = null;
        foreach ($output as $line) {
            if (preg_match('/inet\s+([\d.]+)\//', $line, $matches)) {
                $ipAddress = $matches[1];
                break;
            }
        }

        return [
            'success' => $ipAddress !== null,
            'ip_address' => $ipAddress,
            'device_serial' => $deviceSerial
        ];
    }

    /**
     * Sabit IP ata
     *
     * UYARI: Bu işlem root gerektirir veya WiFi konfigürasyonunu değiştirir
     */
    public function setStaticIp(string $deviceSerial, string $ip, string $gateway, string $subnet = '255.255.255.0'): array
    {
        // Önce mevcut WiFi SSID'yi al
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"dumpsys wifi | grep 'mWifiInfo SSID'\" 2>&1", $ssidOutput);

        $ssid = null;
        foreach ($ssidOutput as $line) {
            if (preg_match('/SSID:\s+"([^"]+)"/', $line, $matches)) {
                $ssid = $matches[1];
                break;
            }
        }

        if (!$ssid) {
            return [
                'success' => false,
                'message' => 'WiFi SSID bulunamadı'
            ];
        }

        // WiFi konfigürasyonunu değiştir (Android Settings.Global API)
        $commands = [
            "settings put global wifi_static_ip {$ip}",
            "settings put global wifi_static_gateway {$gateway}",
            "settings put global wifi_static_netmask {$subnet}",
            "settings put global wifi_static_dns1 8.8.8.8",
            "settings put global wifi_static_dns2 8.8.4.4"
        ];

        $results = [];
        foreach ($commands as $cmd) {
            exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"{$cmd}\" 2>&1", $output, $returnCode);
            $results[] = [
                'command' => $cmd,
                'output' => implode("\n", $output),
                'success' => $returnCode === 0
            ];
        }

        // WiFi'yi yeniden bağlan
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"svc wifi disable\" 2>&1");
        sleep(2);
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"svc wifi enable\" 2>&1");

        return [
            'success' => true,
            'message' => 'Sabit IP ayarları uygulandı',
            'ssid' => $ssid,
            'ip' => $ip,
            'gateway' => $gateway,
            'subnet' => $subnet,
            'commands' => $results
        ];
    }

    /**
     * Cihaz bilgilerini al (hızlı)
     */
    public function getDeviceInfo(string $deviceSerial): array
    {
        $info = [];

        // RAM bilgisi
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"cat /proc/meminfo | grep MemTotal\" 2>&1", $memOutput);
        if (preg_match('/MemTotal:\s+(\d+)\s+kB/', $memOutput[0] ?? '', $matches)) {
            $info['total_memory'] = (int)$matches[1] * 1024; // Bytes
        }

        // Disk boyutu
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"df -h /data\" 2>&1", $storageOutput);
        if (preg_match('/(\d+G)\s+(\d+G)\s+(\d+G)\s+(\d+)%/', $storageOutput[1] ?? '', $matches)) {
            $info['total_storage'] = $matches[1];
            $info['used_storage'] = $matches[2];
            $info['free_storage'] = $matches[3];
            $info['usage_percent'] = (int)$matches[4];
        }

        // Model bilgisi
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"getprop ro.product.model\" 2>&1", $modelOutput);
        $info['model'] = trim($modelOutput[0] ?? '');

        // Android sürümü
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"getprop ro.build.version.release\" 2>&1", $androidOutput);
        $info['android_version'] = trim($androidOutput[0] ?? '');

        // Batarya seviyesi
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"dumpsys battery | grep level\" 2>&1", $batteryOutput);
        if (preg_match('/level:\s+(\d+)/', $batteryOutput[0] ?? '', $matches)) {
            $info['battery_level'] = (int)$matches[1];
        }

        return [
            'success' => true,
            'device_serial' => $deviceSerial,
            'info' => $info
        ];
    }

    /**
     * Shell komutu çalıştır
     */
    public function shell(string $deviceSerial, string $command): array
    {
        exec("\"{$this->adbPath}\" -s {$deviceSerial} shell \"{$command}\" 2>&1", $output, $returnCode);

        return [
            'success' => $returnCode === 0,
            'output' => implode("\n", $output),
            'device_serial' => $deviceSerial
        ];
    }
}
```

#### 2.2 Backend API Endpoint

```php
<?php
/**
 * ADB Control API
 * POST /api/devices/:id/adb-control
 */

require_once BASE_PATH . '/services/AdbBridge.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');
$body = $request->body();

$action = $body['action'] ?? '';

// Get device
$device = $db->fetch(
    "SELECT * FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// ADB servisini başlat
try {
    $adb = new AdbBridge();

    // Cihaz serial numarası (IP:PORT formatında)
    $deviceSerial = "{$device['ip_address']}:5555";

    switch ($action) {
        case 'connect':
            // WiFi ADB bağlantısı kur
            $result = $adb->connectWifi($device['ip_address']);
            break;

        case 'disconnect':
            $result = $adb->disconnect($deviceSerial);
            break;

        case 'check_online':
            $result = $adb->isOnline($deviceSerial);
            break;

        case 'get_info':
            $result = $adb->getDeviceInfo($deviceSerial);
            break;

        case 'set_static_ip':
            $ip = $body['ip'] ?? null;
            $gateway = $body['gateway'] ?? null;
            $subnet = $body['subnet'] ?? '255.255.255.0';

            if (!$ip || !$gateway) {
                Response::badRequest('IP ve gateway gerekli');
            }

            $result = $adb->setStaticIp($deviceSerial, $ip, $gateway, $subnet);
            break;

        default:
            Response::badRequest('Geçersiz işlem: ' . $action);
    }

    if ($result['success']) {
        Response::success($result);
    } else {
        Response::json(['success' => false, 'message' => $result['message'], 'data' => $result], 400);
    }

} catch (Exception $e) {
    Logger::error('ADB control error', [
        'device_id' => $deviceId,
        'action' => $action,
        'error' => $e->getMessage()
    ]);
    Response::error('ADB kontrol hatası: ' . $e->getMessage());
}
```

---

### Seçenek 3: Hibrit Yaklaşım (Uzun Vadeli - ÖNERİLEN)

**Avantajları:**
- En esnek çözüm
- Hem HTTP hem ADB desteği
- Fallback mekanizması
- Geriye dönük uyumluluk

**Uygulama:**

```php
// services/DeviceController.php

class DeviceController
{
    private $httpGateway;
    private $adbBridge;
    private $useAdb = false;

    public function __construct()
    {
        $this->httpGateway = new PavoDisplayGateway();

        // ADB etkinse
        if ($this->isAdbEnabled()) {
            try {
                $this->adbBridge = new AdbBridge();
                $this->useAdb = true;
            } catch (Exception $e) {
                Logger::warning('ADB Bridge başlatılamadı, HTTP kullanılacak', [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    /**
     * Cihaz online mı kontrol et (hibrit)
     */
    public function checkOnline(array $device): array
    {
        // Önce ADB dene (hızlı ve güvenilir)
        if ($this->useAdb && $device['ip_address']) {
            try {
                $deviceSerial = "{$device['ip_address']}:5555";
                $result = $this->adbBridge->isOnline($deviceSerial);

                if ($result['success']) {
                    return [
                        'online' => $result['online'],
                        'method' => 'adb'
                    ];
                }
            } catch (Exception $e) {
                Logger::debug('ADB check failed, falling back to HTTP', [
                    'device_id' => $device['id'],
                    'error' => $e->getMessage()
                ]);
            }
        }

        // Fallback: HTTP ping
        if ($device['ip_address']) {
            $pingResult = $this->httpGateway->ping($device['ip_address']);
            return [
                'online' => $pingResult['online'],
                'method' => 'http'
            ];
        }

        return [
            'online' => false,
            'method' => 'none'
        ];
    }

    /**
     * Cihaz bilgilerini al (hibrit)
     */
    public function getDeviceInfo(array $device): array
    {
        // ADB ile hızlı bilgi al
        if ($this->useAdb && $device['ip_address']) {
            try {
                $deviceSerial = "{$device['ip_address']}:5555";
                $result = $this->adbBridge->getDeviceInfo($deviceSerial);

                if ($result['success']) {
                    return array_merge($result, ['method' => 'adb']);
                }
            } catch (Exception $e) {
                // Fallback to HTTP
            }
        }

        // HTTP ile detaylı bilgi al
        if ($device['ip_address']) {
            $result = $this->httpGateway->getDeviceDetails($device['ip_address']);
            return array_merge($result, ['method' => 'http']);
        }

        return [
            'success' => false,
            'error' => 'No connection method available'
        ];
    }

    private function isAdbEnabled(): bool
    {
        // Settings'den kontrol et
        $db = Database::getInstance();
        $settings = $db->fetch(
            "SELECT data FROM settings WHERE user_id IS NULL"
        );

        if ($settings && !empty($settings['data'])) {
            $data = json_decode($settings['data'], true);
            return ($data['adb_enabled'] ?? false);
        }

        return false;
    }
}
```

---

## 📋 Uygulama Adımları

### Faz 1: Hızlı İyileştirmeler (1-2 Saat)

- [x] Timeout azaltma (10sn → 3sn)
- [ ] Frontend disk boyutu gösterimi
- [ ] Heartbeat cron job oluşturma
- [ ] Windows Task Scheduler ayarı

### Faz 2: ADB Bridge Prototipi (4-8 Saat)

- [ ] AdbBridge.php servisi oluşturma
- [ ] API endpoint ekleme (`/api/devices/:id/adb-control`)
- [ ] Frontend ADB kontrol paneli
- [ ] Sabit IP ataması testi

### Faz 3: Hibrit Sistem (8-16 Saat)

- [ ] DeviceController servisi
- [ ] Ayarlar sayfasında ADB toggle
- [ ] Fallback mekanizması
- [ ] Performans testleri

---

## ⚠️ Güvenlik Uyarıları

### ADB Güvenlik Riskleri

1. **ADB Bağlantısı Sürekli Açık**: Yerel ağda güvenlik riski
2. **Root İşlemleri**: Bazı komutlar root gerektirir
3. **WiFi ADB**: Şifreli değil, Man-in-the-Middle saldırısına açık

### Öneriler

- ADB'yi sadece güvenilir ağlarda kullanın
- Firewall kuralları ile ADB portunu (5037, 5555) koruyun
- ADB komutlarını loglayın ve audit edin
- Production ortamında ADB'yi varsayılan olarak kapalı tutun

---

## 🧪 Test Senaryoları

### 1. Online/Offline Doğrulama

```bash
# Cihazı network'ten çıkar
# Heartbeat cron çalıştır
# Veritabanında status'un 'offline' olduğunu kontrol et

# Cihazı network'e al
# Heartbeat cron çalıştır
# Veritabanında status'un 'online' olduğunu kontrol et
```

### 2. Sabit IP Ataması

```bash
# ADB ile bağlan
adb connect 192.168.1.77:5555

# Mevcut IP'yi kontrol et
adb shell ip addr show wlan0

# Sabit IP ata (API üzerinden)
POST /api/devices/{id}/adb-control
{
  "action": "set_static_ip",
  "ip": "192.168.1.100",
  "gateway": "192.168.1.1",
  "subnet": "255.255.255.0"
}

# WiFi'yi yeniden başlat
# Yeni IP'yi kontrol et
```

### 3. Disk Boyutu Gösterimi

```javascript
// Frontend konsolda
const response = await app.api.post('/devices/{id}/control', {
    action: 'device_info'
});
console.log(response.device_info);
// Beklenen: { total_storage: 240000000000, used_space: 102000000000, ... }
```

---

## 📚 Kaynaklar

- [Android ADB Dokümantasyonu](https://developer.android.com/tools/adb)
- [PavoDisplay HTTP API Referansı](internal)
- [Android Settings.Global API](https://developer.android.com/reference/android/provider/Settings.Global)

---

## 🎯 Sonuç

**Kısa vadede (bugün):**
- Timeout azalt
- Heartbeat cron ekle
- Disk boyutunu göster

**Orta vadede (bu hafta):**
- ADB Bridge prototipi yap
- Sabit IP atamasını test et

**Uzun vadede (gelecek sprint):**
- Hibrit sistemi tamamla
- Production'a deploy et
- Dokümantasyonu güncelle
