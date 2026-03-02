# Yeni Cihaz Markasi / Protokolu Ekleme Rehberi

Bu dokuman, Omnex Display Hub'a yeni bir cihaz markasi veya protokolu eklemek icin gereken adimlari aciklar.

**Tarih:** 2026-02-25
**Ilgili Sistem:** Device Abstraction Layer (DAL)

---

## Onkosullar

- DAL altyapisi kurulu olmali (`services/dal/` dizini)
- Migration 067 calistirilmis olmali (`adapter_id`, `capabilities`, `device_brand` kolonlari)
- Feature flag `dal_enabled` test icin aktif edilebilir durumda olmali

---

## Genel Bakis

Yeni bir cihaz markasi eklemek icin **4-6 dosya** dokunulmasi yeterlidir. Mevcut PavoDisplay, Hanshow veya MQTT kodunda **hicbir degisiklik gerekmez**.

```
1. Adapter sinifi olustur           (services/dal/adapters/)
2. Registry'ye kayit et             (services/dal/DeviceAdapterRegistry.php)
3. Frontend tip tanimini ekle       (public/assets/js/core/DeviceRegistry.js)
4. Backend tip map'ine ekle         (api/devices/create.php)
5. Cevirileri ekle                  (locales/tr/ ve locales/en/)
6. (Opsiyonel) BLE profili ekle     (DeviceRegistry.js ble config)
```

---

## Adim 1: Adapter Sinifi Olustur

`services/dal/adapters/` dizininde yeni bir PHP dosyasi olusturun.

### Ornek: KexinAdapter.php

```php
<?php
/**
 * Kexin ESL Device Adapter
 *
 * Kexin SDK/API ile iletisim kurar.
 * Protokol: HTTP REST (ornekte)
 *
 * @package OmnexDisplayHub\DAL\Adapters
 */

require_once __DIR__ . '/../AbstractDeviceAdapter.php';

class KexinAdapter extends AbstractDeviceAdapter
{
    public function getAdapterId(): string
    {
        return 'kexin';
    }

    public function getDisplayName(): string
    {
        return 'Kexin ESL';
    }

    public function getCapabilities(): array
    {
        return array_merge(parent::getCapabilities(), [
            'ping'       => true,
            'send_image' => true,
            'batch_send' => true,
            // Desteklenen diger yetenekler:
            // 'send_video', 'led_flash', 'page_switch', 'reboot',
            // 'clear_storage', 'brightness', 'device_info',
            // 'firmware_update', 'bluetooth_provision', 'network_config',
            // 'delta_check', 'gateway_bridge'
        ]);
    }

    /**
     * Cihaza ping gonder.
     *
     * @return array ['online' => bool, 'response_time' => float|null, 'error' => string|null, 'method' => string]
     */
    public function ping(array $device): array
    {
        $ip = $device['ip_address'] ?? '';
        if (empty($ip)) {
            return ['online' => false, 'error' => 'IP address missing', 'method' => 'tcp'];
        }

        // Ornek: TCP socket ping
        $start = microtime(true);
        $socket = @fsockopen($ip, 80, $errno, $errstr, 2);
        $responseTime = round((microtime(true) - $start) * 1000, 1);

        if ($socket) {
            fclose($socket);
            return ['online' => true, 'response_time' => $responseTime, 'method' => 'tcp'];
        }

        return ['online' => false, 'error' => "Connection failed: $errstr", 'method' => 'tcp'];
    }

    /**
     * Cihaza gorsel icerik gonder.
     *
     * @param array  $device    Cihaz verisi (devices tablosundan)
     * @param string $imagePath Gonderilecek gorselin dosya yolu
     * @param array  $options   Opsiyonel parametreler (priority, format, vb.)
     * @return array ['success' => bool, 'error' => string|null, 'skipped' => bool]
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array
    {
        $ip = $device['ip_address'] ?? '';
        if (empty($ip)) {
            return ['success' => false, 'error' => 'IP address missing'];
        }

        if (!file_exists($imagePath)) {
            return ['success' => false, 'error' => 'Image file not found: ' . $imagePath];
        }

        try {
            // *** BURAYA KEXIN SDK/API CAGRISI GELECEK ***
            // Ornek:
            // $kexinApi = new KexinApi($ip);
            // $result = $kexinApi->uploadImage($imagePath);

            return [
                'success' => true,
                'error'   => null,
                'skipped' => false,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Cihaz kontrol komutu calistir.
     *
     * @param string $action Aksiyon adi: 'ping', 'refresh', 'reboot', 'clear_memory', vb.
     * @param array  $params Aksiyon parametreleri
     * @return array ['success' => bool, 'message' => string, 'data' => mixed]
     */
    public function control(array $device, string $action, array $params = []): array
    {
        switch ($action) {
            case 'ping':
                $pingResult = $this->ping($device);
                return [
                    'success' => $pingResult['online'],
                    'message' => $pingResult['online'] ? 'Device is online' : ($pingResult['error'] ?? 'Ping failed'),
                    'data'    => $pingResult,
                ];

            case 'refresh':
                // Ekrani yenile
                return ['success' => false, 'message' => 'Not implemented yet'];

            default:
                return parent::control($device, $action, $params);
        }
    }
}
```

### Adapter Kontrati (Zorunlu Metodlar)

| Metod | Donus | Aciklama |
|-------|-------|----------|
| `getAdapterId()` | `string` | Benzersiz adapter ID ('kexin', 'hanshow', vb.) |
| `getDisplayName()` | `string` | Goruntuleme adi |
| `getCapabilities()` | `array` | Desteklenen yetenekler (key => bool) |
| `ping(array $device)` | `array` | Cihaz erisilebilirlik testi |
| `sendContent(array $device, string $imagePath, array $options)` | `array` | Icerik gonderimi |
| `control(array $device, string $action, array $params)` | `array` | Kontrol komutu |

### Mevcut Yetenek Listesi

| Yetenek | Aciklama |
|---------|----------|
| `ping` | Cihaz erisilebilirlik testi |
| `send_image` | Gorsel icerik gonderimi |
| `send_video` | Video icerik gonderimi |
| `batch_send` | Toplu gonderim optimizasyonu |
| `led_flash` | LED isik kontrolu (Hanshow) |
| `page_switch` | Sayfa degistirme (Hanshow) |
| `reboot` | Cihazi yeniden baslatma |
| `clear_storage` | Depolamayi temizleme |
| `brightness` | Parlaklik ayari |
| `device_info` | Cihaz bilgisi sorgulama |
| `firmware_update` | Firmware guncelleme |
| `bluetooth_provision` | BLE ile kurulum |
| `network_config` | Ag yapilandirmasi |
| `delta_check` | MD5 ile degisiklik kontrolu |
| `gateway_bridge` | Gateway uzerinden iletisim |
| `playlist_assign` | Playlist atama (Signage) |

---

## Adim 2: Registry'ye Kayit Et

`services/dal/DeviceAdapterRegistry.php` dosyasinda `registerDefaults()` metoduna ekleyin:

```php
protected function registerDefaults(): void
{
    // ... mevcut kayitlar ...

    // Kexin ESL
    $this->register(new KexinAdapter(), [
        ['model' => 'kexin_esl'],
        ['device_brand' => 'Kexin'],
        ['manufacturer' => '%Kexin%'],  // LIKE esleme
    ]);
}
```

**Kural Onceligi:** Spesifik kurallar once, genel kurallar sonra. `model` eslesmesi `manufacturer` LIKE'dan onceliklidir.

**Onemli:** NullAdapter her zaman EN SONA kayit edilir (fallback).

---

## Adim 3: Frontend DeviceRegistry.js Girisi

`public/assets/js/core/DeviceRegistry.js` dosyasinda `types` objesine ekleyin:

```javascript
types: {
    // ... mevcut tipler ...

    kexin_esl: {
        id: 'kexin_esl',
        dbType: 'esl',              // SQLite CHECK constraint'e uygun DB tipi
        label: 'Kexin ESL',
        icon: 'ti-device-tablet',   // Tabler icon sinifi
        badge: 'badge-lime',        // Badge renk sinifi
        category: 'esl',            // 'esl' veya 'signage' veya 'panel'
        adapter: 'kexin',           // Backend adapter ID
        capabilities: ['ping', 'send_image', 'batch_send'],
        requiresIp: true,           // IP adresi gerekli mi?
        // Opsiyonel BLE profili:
        // ble: {
        //     namePrefix: 'KX',
        //     serviceUuid: '0000fff0-0000-1000-8000-00805f9b34fb',
        //     writeUuid: '0000fff2-0000-1000-8000-00805f9b34fb',
        //     notifyUuid: '0000fff1-0000-1000-8000-00805f9b34fb',
        // },
    },
},
```

### Mevcut Badge Renkleri

| Sinif | Renk | Kullanan Tip |
|-------|------|-------------|
| `badge-warning` | Sari | ESL |
| `badge-cyan` | Cyan | ESL Tablet |
| `badge-info` | Mavi | ESL RTOS |
| `badge-teal` | Teal | Hanshow ESL |
| `badge-purple` | Mor | Android TV / TV |
| `badge-blue` | Mavi | PWA Player |
| `badge-indigo` | Indigo | Stream Player |
| `badge-grape` | Uzum | Tablet |
| `badge-orange` | Turuncu | Mobile |
| `badge-secondary` | Gri | Web Display |
| `badge-dark` | Koyu | Panel |

### Kategori Sistemi

| Kategori | Aciklama | Cihaz Tipleri |
|----------|----------|--------------|
| `esl` | Elektronik raf etiketi | esl, esl_android, esl_rtos, hanshow_esl |
| `signage` | Dijital tabela | android_tv, tv, pwa_player, stream_player, tablet, mobile, web_display |
| `panel` | Panel | panel |

---

## Adim 4: Backend Tip Map'ine Ekle

`api/devices/create.php` dosyasinda `$typeMap` ve `$validTypes` dizilerine ekleyin:

```php
$typeMap = [
    // ... mevcut tipler ...
    'kexin_esl' => 'esl',   // Frontend tipi -> DB tipi
];

$validTypes = ['esl', 'android_tv', 'web_display', 'panel'];
// Not: 'kexin_esl' frontend'de gonderilir, 'esl' olarak DB'ye yazilir
// Orijinal tip 'model' kolonunda saklanir
```

---

## Adim 5: Cevirileri Ekle

### locales/tr/pages/devices.json

```json
{
    "types": {
        "kexin_esl": "Kexin ESL"
    }
}
```

### locales/en/pages/devices.json

```json
{
    "types": {
        "kexin_esl": "Kexin ESL"
    }
}
```

---

## Adim 6 (Opsiyonel): BLE Profili

Eger cihaz Bluetooth Low Energy (BLE) ile kurulum destekliyorsa, DeviceRegistry.js'deki tip tanimi icine `ble` objesi ekleyin:

```javascript
ble: {
    namePrefix: 'KX',          // BLE taramada cihaz adi prefiksi
    serviceUuid: '0000fff0-...', // BLE servis UUID
    writeUuid: '0000fff2-...',   // Yazma karakteristik UUID
    notifyUuid: '0000fff1-...',  // Bildirim karakteristik UUID
},
```

`BluetoothWizard.js` otomatik olarak `DeviceRegistry.getBleTypes()` ve `DeviceRegistry.getBleProfile()` kullanarak BLE profilini bulur.

---

## Dogrulama Kontrol Listesi

Yeni cihaz eklendikten sonra su testleri yapin:

### Backend

- [ ] `DeviceAdapterRegistry::getInstance()->resolve($device)` dogru adapter'i donuyor mu?
- [ ] `$adapter->ping($device)` basarili/basarisiz dogru sonuc donuyor mu?
- [ ] `$adapter->sendContent($device, $imagePath)` icerik gonderiyor mu?
- [ ] `$adapter->control($device, 'ping')` calistiriyor mu?
- [ ] `api/devices/create.php` yeni tip ile cihaz olusturabiliyor mu?

### Frontend

- [ ] `DeviceRegistry.resolve({model: 'kexin_esl'})` dogru tip tanimi donuyor mu?
- [ ] Cihaz listesinde dogru ikon ve badge gorunuyor mu?
- [ ] Cihaz detayinda yeteneklere gore butonlar gorunuyor mu?
- [ ] `DeviceRegistry.hasCapability(device, 'send_image')` dogru donuyor mu?

### Render Queue

- [ ] `dal_enabled = true` ile render queue'dan gonderim calisiyor mu?
- [ ] Adapter'in `sendContent()` metodu kuyruk icinden dogru cagriliyor mu?
- [ ] Basarisiz gonderimde retry mekanizmasi calisiyor mu?

---

## Mevcut Adapter'lara Referans

| Adapter | Dosya | Protokol | Anahtar Ozellik |
|---------|-------|----------|-----------------|
| PavoDisplayAdapter | `adapters/PavoDisplayAdapter.php` | HTTP-SERVER | Delta check (MD5), batch send, reboot, brightness |
| HanshowAdapter | `adapters/HanshowAdapter.php` | RF/REST API | LED flash, page switch, ESL ID normalizasyonu |
| MqttDeviceAdapter | `adapters/MqttDeviceAdapter.php` | MQTT | Topic-based pub/sub, heartbeat kontrolu |
| PwaPlayerAdapter | `adapters/PwaPlayerAdapter.php` | DB Pull | Cihaz DB'den icerik ceker, komut kuyrugu |
| NullAdapter | `adapters/NullAdapter.php` | Yok | Hata doner, fallback |

---

## Sik Sorulan Sorular

### Mevcut gateway siniflarimi degistirmem gerekiyor mu?

**HAYIR.** Adapter'lar mevcut gateway siniflarini sararlar (wrap). `PavoDisplayGateway.php`, `HanshowGateway.php` gibi dosyalara dokunmaniza gerek yok.

### Yeni protokol (ornegin CoAP, Zigbee) nasil eklenir?

Ayni adimlar. Adapter sinifinda ilgili SDK/kutuphane kullanilir. Adapter kontrati protokolden bagimsizdir.

### Feature flag nedir ve nasil kullanilir?

`dal_enabled` firmanin ayarlarinda saklanir. `true` yapildiginda RenderQueueWorker ve control.php DAL yolunu kullanir. `false` oldugunda eski kod (if/else zincirleri) calisir. Yeni cihazlari test etmek icin sadece ilgili firmanin `dal_enabled` ayarini `true` yapin.

### Batch send nasil calisir?

Adapter'in `getCapabilities()['batch_send']` true donerse, RenderQueueWorker ayni adapter'a ait cihazlari gruplar ve tek seferde gonderir. Adapter'da `sendBatch()` metodu varsa o kullanilir, yoksa tek tek `sendContent()` cagirilir.
