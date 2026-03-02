# Hanshow ESL Entegrasyon Dokumani

Bu dokuman, Omnex Display Hub sistemine Hanshow Elektronik Raf Etiketi (ESL) entegrasyonu icin teknik detaylari ve uygulama planini icerir.

## 1. Sistem Mimarisi

### 1.0 Mimari Seçenekleri

Sistem iki farklı mimaride çalışabilir:

#### Seçenek A: Doğrudan Bağlantı (Lokal Kurulum)
Web paneli ve ESL-Working aynı makinede çalıştığında.

```
+-------------------+        +------------------+        +------------------+
|   Omnex Display   |  HTTP  |   ESL-Working    |   RF   |    Gateway/AP    |
|      Hub (PHP)    | <----> |   Java Service   | <----> |  192.168.1.178   |
|   Port: 80/443    |        |    Port: 9000    |        |   Port: 37021    |
+-------------------+        +------------------+        +------------------+
                                                                   |
                                                              RF 2.4GHz
                                                                   |
                                                         +---------+---------+
                                                         |    ESL Devices    |
                                                         |  (E-Paper/LCD)    |
                                                         +-------------------+
```

#### Seçenek B: Gateway Agent Mimarisi (Dağıtık Kurulum)
Web paneli sunucuda, ESL-Working lokalde çalıştığında (önerilen).

```
+-------------------+        +------------------+        +------------------+
|   Omnex Display   |  HTTP  |  Gateway Agent   |  HTTP  |   ESL-Working    |
|   Hub (Sunucu)    | <----> | (gateway.php)    | <----> |   Java Service   |
|   example.com     |        |   Lokal PC       |        |   127.0.0.1:9000 |
+-------------------+        +------------------+        +------------------+
         ^                           |
         |                           v
         |                  +------------------+        +------------------+
         |                  |    Gateway/AP    |   RF   |    ESL Devices   |
         +------ Polling ---+  192.168.1.178   + <----> |  (E-Paper/LCD)   |
                            +------------------+        +------------------+
```

**Gateway Agent Avantajları:**
- Sunucu ESL-Working'e doğrudan erişemese bile çalışır
- Hem PavoDisplay hem Hanshow cihazları tek yerden yönetilir
- Güvenlik: ESL-Working internete açık olmak zorunda değil
- Polling tabanlı: NAT/Firewall arkasında çalışır

### 1.1 Bilesenler

| Bilesen | Aciklama | Konum |
|---------|----------|-------|
| **Omnex Display Hub** | Ana web uygulamasi (PHP + SQLite) | localhost:80 |
| **ESL-Working** | Hanshow Java servisi, REST API saglar | localhost:9000 |
| **Gateway/AP** | Etiketlerle RF iletisim saglar | 192.168.1.178:37021 |
| **ESL Devices** | Elektronik etiketler (E-Paper/LCD) | RF ile bagli |

### 1.2 Gateway Bilgileri

- **IP Adresi:** 192.168.1.178
- **AP MAC:** A4-56-02-7F-2B-2D
- **Yazilim Versiyonu:** 3.3.0-rc6
- **ESL-Working Port:** 37021 (UDP mode)
- **Web Arayuzu Sifresi:** admin

## 2. ESL-Working API

### 2.1 Base URL

**ESL-Working v2.5.3 için:**
```
http://127.0.0.1:9000/api2/{user}/
```

**Eski versiyonlar için (v2.x öncesi):**
```
http://127.0.0.1:9000/api3/{user}/
```

> **ÖNEMLİ:** ESL-Working v2.5.3'te API prefix'i `/api2/` olarak değişmiştir.
> Eski `/api3/` prefix'i artık kullanılmamaktadır.

`{user}` parametresi: Kullanici/magaza tanimlayicisi (ornegin: `default`, `customer.store1`)

### 2.2 Temel Endpoint'ler

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| PUT | `{user}/esls/{id}` | Tek ESL guncelle |
| PUT | `{user}/esls` | Toplu ESL guncelle |
| PUT | `{user}/esls/screen` | Toplu ekran guncelle |
| PUT | `{user}/esls/{id}/control` | LED/Sayfa kontrolu |
| GET | `/esls/firmwares` | Tum ESL tiplerini al |
| GET | `/users` | Kullanici ve AP listesi |
| PUT | `{user}/users/ap` | AP ata |

### 2.3 Response Format

**ESL-Working v2.5.3 için:**
```json
{
    "errno": 0,              // 0: Basarili, >0: Hata kodu
    "errmsg": "",            // Hata mesaji (varsa)
    "data": { }              // Veri icerigi
}
```

**Eski versiyonlar için:**
```json
{
    "status_no": 0,          // 0: Basarili, 1: Islemde, >1: Hata
    "user": "default",
    "errmsg": "",            // Hata mesaji (varsa)
    "data": { }              // Veri icerigi
}
```

> **NOT:** v2.5.3'te `status_no` yerine `errno` kullanılır. Kod yazarken her iki alanı da kontrol etmek tavsiye edilir.

### 2.4 Status Kodlari

| Kod | Anlam |
|-----|-------|
| 0 | Basarili |
| 1 | Islem devam ediyor |
| 100 | Bilinmeyen hata |
| 200 | ESL bulunamadi |
| 201 | ESL zaten guncellenmis |
| 202 | ESL desteklemiyor |
| 203 | Template hatasi |
| 300 | Parametre hatasi |

## 3. ESL Ekran Icerigi Formatlari

### 3.1 Layout (JSON Template)

Template formatinda dinamik icerik olusturulur:

```json
{
    "direction": 0,
    "screen_block": [
        {
            "start_x": 5,
            "start_y": 5,
            "end_x": 200,
            "end_y": 50,
            "font_type": "Arial Bold 24",
            "content_type": "CONTENT_TYPE_TEXT",
            "content_title": "product_name",
            "content_value": "Elma",
            "content_color": "BLACK",
            "content_alignment": "LEFT"
        },
        {
            "start_x": 5,
            "start_y": 60,
            "end_x": 150,
            "end_y": 120,
            "font_type": "Arial Bold 48",
            "content_type": "CONTENT_TYPE_NUMBER",
            "content_title": "price",
            "content_value": "12.99",
            "content_color": "RED",
            "content_alignment": "RIGHT",
            "number_script": "SUPER"
        }
    ]
}
```

### 3.2 Content Types

| Tip | Aciklama |
|-----|----------|
| CONTENT_TYPE_TEXT | Metin |
| CONTENT_TYPE_NUMBER | Sayi (ustu/altu yazi destekli) |
| CONTENT_TYPE_IMAGE | Gorsel (BMP/PNG/JPG) |
| CONTENT_TYPE_LINE | Cizgi |
| CONTENT_TYPE_RECTANGLE | Dikdortgen |
| CONTENT_TYPE_BARCODE | Barkod |
| CONTENT_TYPE_QRCODE | QR Kod |

### 3.3 Image (Base64)

Dogrudan gorsel gondermek icin:

```json
{
    "esl_id": "55-3D-5F-67",
    "sid": "unique_session_id",
    "back_url": "http://localhost/api/hanshow/callback",
    "screen": {
        "name": "product_label",
        "pages": [
            {
                "id": 0,
                "name": "main",
                "image": "iVBORw0KGgoAAAANSUhEUgAAA..."
            }
        ]
    }
}
```

**Desteklenen Formatlar:** BMP, PNG, JPG (Base64 encoded)

## 4. ESL Cihaz Tipleri (Firmware Config)

### 4.1 Mevcut Cihazlar

Sizin elimizdeki cihazlar:

| ID | Model | Boyut | Cozunurluk | Renk | Tip |
|----|-------|-------|------------|------|-----|
| 30 | Skyline-M@ | 2.13" | 300x100 | BWRY | LCD |
| 51 | Stellar-SLR | 1.54" | 152x152 | BW | EPD |
| 52 | Stellar-S3LR | 1.54" | 152x152 | BWR | EPD |

### 4.2 Renk Kodlari

| Kod | Anlam |
|-----|-------|
| BW | Siyah-Beyaz |
| BWR | Siyah-Beyaz-Kirmizi |
| BWRY | Siyah-Beyaz-Kirmizi-Sari |

## 5. LED ve Sayfa Kontrolu

### 5.1 LED Yanip Sonme

```json
{
    "flash_light": {
        "colors": ["red", "green", "blue"],
        "on_time": 100,      // 30ms birimi
        "off_time": 100,
        "flash_count": 2,
        "sleep_time": 200,
        "loop_count": 2
    }
}
```

**Desteklenen Renkler:** blue, red, violet, green, indigo, yellow, white

### 5.2 Sayfa Gecisi

```json
{
    "switch_page": {
        "page_id": 1,
        "stay_time": 10     // Saniye
    }
}
```

## 6. Omnex Entegrasyon Plani

### 6.1 Veritabani Degisiklikleri

```sql
-- Migration: 040_hanshow_esl_integration.sql

-- Hanshow ESL cihazlari tablosu
CREATE TABLE IF NOT EXISTS hanshow_esls (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    esl_id TEXT NOT NULL UNIQUE,      -- Hanshow ESL ID (XX-XX-XX-XX)
    firmware_id INTEGER,
    model_name TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    screen_color TEXT,                 -- BW, BWR, BWRY
    screen_type TEXT,                  -- EPD, LCD
    max_pages INTEGER DEFAULT 1,
    has_led BOOLEAN DEFAULT 0,
    has_magnet BOOLEAN DEFAULT 0,
    current_template_id TEXT,
    current_product_id TEXT,
    last_sync_at TEXT,
    last_heartbeat_at TEXT,
    status TEXT DEFAULT 'unknown',     -- online, offline, updating
    battery_level INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (current_template_id) REFERENCES templates(id),
    FOREIGN KEY (current_product_id) REFERENCES products(id)
);

-- Hanshow gonderim kuyrugu
CREATE TABLE IF NOT EXISTS hanshow_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    esl_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,   -- Hanshow sid
    product_id TEXT,
    template_id TEXT,
    content_type TEXT,                  -- template, image
    content_data TEXT,                  -- JSON template veya Base64 image
    priority INTEGER DEFAULT 10,
    status TEXT DEFAULT 'pending',      -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    callback_data TEXT,                 -- Async callback response
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Hanshow ayarlari
CREATE TABLE IF NOT EXISTS hanshow_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    eslworking_url TEXT DEFAULT 'http://127.0.0.1:9000',
    user_id TEXT DEFAULT 'default',
    callback_url TEXT,
    default_priority INTEGER DEFAULT 10,
    sync_interval INTEGER DEFAULT 60,
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_hanshow_esls_company ON hanshow_esls(company_id);
CREATE INDEX idx_hanshow_esls_esl_id ON hanshow_esls(esl_id);
CREATE INDEX idx_hanshow_queue_status ON hanshow_queue(status);
CREATE INDEX idx_hanshow_queue_esl ON hanshow_queue(esl_id);
```

### 6.2 PHP Service Dosyalari

```
services/
└── HanshowGateway.php       # Ana entegrasyon servisi
api/
└── hanshow/
    ├── esls.php             # ESL listesi ve CRUD
    ├── send.php             # Etiket gonderimi
    ├── control.php          # LED/Sayfa kontrolu
    ├── callback.php         # Async callback endpoint
    ├── sync.php             # Senkronizasyon
    └── settings.php         # Ayarlar
```

### 6.3 HanshowGateway Servisi

```php
<?php
// services/HanshowGateway.php

class HanshowGateway
{
    private $baseUrl;
    private $userId;
    private $callbackUrl;

    public function __construct($settings = null)
    {
        $this->baseUrl = $settings['eslworking_url'] ?? 'http://127.0.0.1:9000';
        $this->userId = $settings['user_id'] ?? 'default';
        $this->callbackUrl = $settings['callback_url'] ?? '';
    }

    /**
     * ESL'e tasarim gonder
     */
    public function sendToESL($eslId, $content, $options = [])
    {
        $sid = $this->generateSid();
        $priority = $options['priority'] ?? 10;

        $payload = [
            'sid' => $sid,
            'priority' => $priority,
            'back_url' => $this->callbackUrl,
            'screen' => $content
        ];

        return $this->request('PUT', "/esls/{$eslId}", $payload);
    }

    /**
     * Toplu ESL guncelleme
     */
    public function batchUpdate($updates)
    {
        $data = [];
        foreach ($updates as $update) {
            $data[] = [
                'esl_id' => $update['esl_id'],
                'sid' => $this->generateSid(),
                'priority' => $update['priority'] ?? 10,
                'back_url' => $this->callbackUrl,
                'screen' => $update['content']
            ];
        }

        return $this->request('PUT', '/esls', ['data' => $data]);
    }

    /**
     * LED kontrolu
     */
    public function flashLight($eslId, $colors, $options = [])
    {
        $payload = [
            'sid' => $this->generateSid(),
            'back_url' => $this->callbackUrl,
            'flash_light' => [
                'colors' => $colors,
                'on_time' => $options['on_time'] ?? 100,
                'off_time' => $options['off_time'] ?? 100,
                'flash_count' => $options['flash_count'] ?? 2,
                'sleep_time' => $options['sleep_time'] ?? 200,
                'loop_count' => $options['loop_count'] ?? 2
            ]
        ];

        return $this->request('PUT', "/esls/{$eslId}/control", $payload);
    }

    /**
     * Sayfa degistir
     */
    public function switchPage($eslId, $pageId, $stayTime = 10)
    {
        $payload = [
            'sid' => $this->generateSid(),
            'back_url' => $this->callbackUrl,
            'switch_page' => [
                'page_id' => $pageId,
                'stay_time' => $stayTime
            ]
        ];

        return $this->request('PUT', "/esls/{$eslId}/control", $payload);
    }

    /**
     * Tum ESL tiplerini al
     */
    public function getFirmwares()
    {
        return $this->request('GET', '/esls/firmwares');
    }

    /**
     * Kullanicilari ve AP'leri al
     */
    public function getUsers()
    {
        return $this->request('GET', '/users');
    }

    /**
     * Gorsel olustur (Base64)
     */
    public function renderImage($product, $template, $width, $height)
    {
        // GD veya Imagick ile gorsel olustur
        $img = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        $red = imagecolorallocate($img, 255, 0, 0);

        // Arkaplan
        imagefilledrectangle($img, 0, 0, $width, $height, $white);

        // Urun adi
        $fontPath = __DIR__ . '/../fonts/arial.ttf';
        imagettftext($img, 14, 0, 10, 30, $black, $fontPath, $product['name']);

        // Fiyat
        $price = number_format($product['current_price'], 2);
        imagettftext($img, 28, 0, 10, 80, $red, $fontPath, $price . ' TL');

        // Base64'e donustur
        ob_start();
        imagepng($img);
        $imageData = ob_get_clean();
        imagedestroy($img);

        return base64_encode($imageData);
    }

    /**
     * Template layout olustur
     */
    public function createLayout($product, $template)
    {
        $layout = [
            'direction' => 0,
            'screen_block' => []
        ];

        // Fabric.js template'i Hanshow layout'a cevir
        $content = json_decode($template['content'], true);

        foreach ($content['objects'] ?? [] as $obj) {
            $block = $this->convertFabricObject($obj, $product);
            if ($block) {
                $layout['screen_block'][] = $block;
            }
        }

        return json_encode($layout);
    }

    private function convertFabricObject($obj, $product)
    {
        // Fabric.js objesini Hanshow block'a donustur
        $block = [
            'start_x' => (int)$obj['left'],
            'start_y' => (int)$obj['top'],
            'end_x' => (int)($obj['left'] + ($obj['width'] * ($obj['scaleX'] ?? 1))),
            'end_y' => (int)($obj['top'] + ($obj['height'] * ($obj['scaleY'] ?? 1))),
            'content_color' => $this->convertColor($obj['fill'] ?? '#000000')
        ];

        switch ($obj['type']) {
            case 'textbox':
            case 'i-text':
                $block['content_type'] = 'CONTENT_TYPE_TEXT';
                $block['font_type'] = ($obj['fontFamily'] ?? 'Arial') . ' ' . ($obj['fontSize'] ?? 12);
                $block['content_title'] = $obj['dynamicField'] ?? 'text';
                $block['content_value'] = $this->replaceDynamicValue($obj['text'] ?? '', $product);
                $block['content_alignment'] = strtoupper($obj['textAlign'] ?? 'left');
                break;

            case 'rect':
                $block['content_type'] = 'CONTENT_TYPE_RECTANGLE';
                break;

            case 'image':
                $block['content_type'] = 'CONTENT_TYPE_IMAGE';
                $block['content_value'] = $obj['src'] ?? '';
                break;
        }

        return $block;
    }

    private function convertColor($hex)
    {
        $hex = ltrim($hex, '#');
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));

        // Basit renk eslestirme
        if ($r > 200 && $g < 100 && $b < 100) return 'RED';
        if ($r < 100 && $g < 100 && $b < 100) return 'BLACK';
        if ($r > 200 && $g > 200 && $b < 100) return 'YELLOW';

        return 'BLACK';
    }

    private function replaceDynamicValue($text, $product)
    {
        $replacements = [
            '{{product_name}}' => $product['name'] ?? '',
            '{{sku}}' => $product['sku'] ?? '',
            '{{barcode}}' => $product['barcode'] ?? '',
            '{{current_price}}' => number_format($product['current_price'] ?? 0, 2),
            '{{previous_price}}' => number_format($product['previous_price'] ?? 0, 2),
            '{{unit}}' => $product['unit'] ?? '',
            '{{origin}}' => $product['origin'] ?? '',
            '{{category}}' => $product['category'] ?? ''
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $text);
    }

    private function request($method, $endpoint, $data = null)
    {
        // ESL-Working v2.5.3 için /api2/ kullanılır
        $url = $this->baseUrl . '/api2/' . $this->userId . $endpoint;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json']
        ]);

        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'error' => $error];
        }

        return json_decode($response, true);
    }

    private function generateSid()
    {
        return uniqid('omnex_', true) . '_' . time();
    }
}
```

### 6.4 Frontend Sayfalari

```
public/assets/js/pages/
└── hanshow/
    ├── HanshowEslList.js      # ESL listesi ve yonetimi
    ├── HanshowSendDesign.js   # Tasarim gonderme modal
    └── HanshowSettings.js     # Ayarlar sayfasi
```

### 6.5 UI Ozellikleri

1. **ESL Listesi**
   - Tum kayitli ESL cihazlarini listele
   - Durum gostergeleri (online/offline/updating)
   - Pil seviyesi
   - Son guncelleme zamani

2. **Tasarim Gonderme**
   - Urun sec
   - Template sec
   - ESL sec (tekli/coklu)
   - Onizleme
   - Gonder

3. **LED/Sayfa Kontrolu**
   - Renk secimi
   - Yanip sonme ayarlari
   - Sayfa degistirme

4. **Ayarlar**
   - ESL-Working URL
   - Kullanici ID
   - Callback URL
   - Varsayilan oncelik

## 7. Kurulum ve Baslatma

### 7.1 ESL-Working Baslatma

```batch
cd "C:\xampp\htdocs\market-etiket-sistemi\tasarımlar\Hanshow - Elektronik Etiket\eslworking-2.5.3\bin"
eslworking.bat
```

### 7.2 Gateway Yapilandirmasi

Gateway web arayuzunden (http://192.168.1.178):
1. ESL-Working IP: 127.0.0.1 veya bilgisayar IP
2. ESL-Working Port: 37021
3. Mode: UDP AUTO SEARCH

### 7.3 Omnex Yapilandirmasi

1. Migration calistir: `040_hanshow_esl_integration.sql`
2. Ayarlar sayfasindan ESL-Working baglantisini yapilandir
3. AP'yi kullaniciya ata

## 8. Test Adimlari

1. **ESL-Working Baglantisi**
   ```
   curl http://127.0.0.1:9000/api2/default/esls/firmwares
   ```

2. **Gateway Durumu (AP Listesi)**
   ```
   curl http://127.0.0.1:9000/api2/users
   ```

3. **Etiket Gonderimi**
   - Urun sec
   - Template sec
   - ESL ID gir
   - Gonder
   - Async callback bekle

## 9. Sorun Giderme

| Sorun | Sebep | Cozum |
|-------|-------|-------|
| ESL-Working baglanamadi | Servis calismiyor | eslworking.bat ile baslat |
| Gateway gorunmuyor | Yanlis IP/Port | Gateway ayarlarini kontrol et |
| Etiket guncellenmiyor | RF iletisim sorunu | Gateway ve etiket arasindaki mesafeyi kontrol et |
| Async callback gelmiyor | Yanlis URL | Callback URL'i kontrol et |

## 10. Gateway Agent Entegrasyonu

Web paneli sunucuda, ESL-Working lokalde çalıştığında Gateway Agent kullanılır.

### 10.1 Gateway Agent Yapılandırması

Gateway agent'ı Hanshow desteğiyle yapılandırmak için:

```bash
cd gateway
php gateway.php --hanshow-config
```

Bu komut aşağıdaki ayarları sorar:
- **ESL-Working URL:** (varsayılan: http://127.0.0.1:9000)
- **User ID:** (varsayılan: default)
- **Timeout:** (varsayılan: 30 saniye)
- **Etkinleştir:** (varsayılan: evet)

### 10.2 Gateway Config Dosyası (gateway.config.json)

```json
{
    "server_url": "https://example.com/api/gateway",
    "api_secret": "your_secret_key",
    "poll_interval": 5,
    "pavo_display": {
        "enabled": true,
        "timeout": 30
    },
    "hanshow": {
        "enabled": true,
        "eslworking_url": "http://127.0.0.1:9000",
        "user_id": "default",
        "timeout": 30
    },
    "security": {
        "ssl_verify": false,
        "allowed_subnets": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"]
    }
}
```

### 10.3 Hanshow CLI Komutları

| Komut | Açıklama |
|-------|----------|
| `--hanshow-config` | Hanshow ayarlarını yapılandır |
| `--hanshow-test` | ESL-Working bağlantısını test et |
| `--hanshow-aps` | Bağlı AP'leri listele |
| `--hanshow-esls` | Bağlı ESL'leri listele |

### 10.4 Hanshow Bağlantı Testi

```bash
php gateway.php --hanshow-test
```

Başarılı çıktı:
```
[INFO] Hanshow ESL-Working Bağlantı Testi
[INFO] URL: http://127.0.0.1:9000
[INFO] User: default
[SUCCESS] ESL-Working bağlantısı başarılı!
[INFO] AP Sayısı: 1
[INFO] AP: DC:07:C1:01:A8:96 (192.168.1.178) - Online
```

### 10.5 AP ve ESL Listesi

```bash
# AP'leri listele
php gateway.php --hanshow-aps

# ESL'leri listele
php gateway.php --hanshow-esls
```

### 10.6 Gateway Handler Komutları

Gateway agent aşağıdaki Hanshow komutlarını destekler:

| Komut | Parametreler | Açıklama |
|-------|--------------|----------|
| `hanshow_ping` | - | ESL-Working bağlantı testi |
| `hanshow_get_aps` | - | AP listesini al |
| `hanshow_get_esls` | `ap_mac` (opsiyonel) | ESL listesini al |
| `hanshow_get_esl` | `esl_id` | Tek ESL bilgisi |
| `hanshow_send_image` | `esl_id`, `image_base64`, `options` | Görsel gönder |
| `hanshow_flash_led` | `esl_id`, `colors`, `options` | LED yakıp söndür |

### 10.7 Örnek API İstekleri (Gateway Üzerinden)

```php
// Gateway'e komut gönderme
$command = [
    'id' => uniqid(),
    'type' => 'hanshow_send_image',
    'parameters' => [
        'esl_id' => '55-3D-5F-67',
        'image_base64' => 'iVBORw0KGgo...',
        'options' => [
            'priority' => 10,
            'flash_light' => [
                'colors' => ['green'],
                'flash_count' => 2
            ]
        ]
    ]
];
```

### 10.8 Hata Durumları

| Hata Kodu | Açıklama |
|-----------|----------|
| `HANSHOW_NOT_ENABLED` | Hanshow entegrasyonu devre dışı |
| `ESLWORKING_CONNECTION_FAILED` | ESL-Working'e bağlanılamadı |
| `ESL_NOT_FOUND` | ESL bulunamadı |
| `INVALID_IMAGE` | Geçersiz görsel verisi |

## 11. Sonraki Adimlar

1. [ ] ESL-Working servisini baslat ve test et
2. [ ] Migration dosyasini olustur ve calistir
3. [ ] HanshowGateway.php servisini implement et
4. [ ] API endpoint'lerini olustur
5. [ ] Frontend sayfalarini olustur
6. [ ] Callback handler'i implement et
7. [ ] Entegrasyonu test et

---

**Son Guncelleme:** 2026-01-18
**Versiyon:** 1.1.0

### Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 1.1.0 | 2026-01-18 | Gateway Agent entegrasyonu, API prefix /api2/ güncellemesi |
| 1.0.0 | 2026-01-17 | İlk sürüm |



● Mevcut kurulumunuza göre önerilen ayarlar:

  Hanshow ESL Ayarları                                                                                                   ┌────────────────────────┬───────────────────────┬─────────────────────────────────────────────────────────────────┐
  │          Alan          │    Önerilen Değer     │                            Açıklama                             │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ ESL-Working API URL    │ http://127.0.0.1:9000 │ ✅ Doğru - ESL-Working lokalda çalışıyor                        │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ Kullanıcı ID           │ default               │ ✅ Doğru - Varsayılan kullanıcı                                 │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ Callback URL           │ Boş bırakın           │ Otomatik oluşturulacak                                          │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ Varsayılan Öncelik     │ 10                    │ ✅ Doğru - Normal öncelik (0-255 arası, düşük = yüksek öncelik) │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ Senkronizasyon Aralığı │ 60                    │ ✅ Doğru - 60 saniyede bir kontrol                              │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ LED Rengi              │ Yeşil                 │ ✅ Güncelleme sonrası yeşil LED yanar                           │ 
  ├────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────┤ 
  │ Maks Tekrar Deneme     │ 3                     │ ✅ Başarısız gönderimde 3 kez dene                              │ 
  └────────────────────────┴───────────────────────┴─────────────────────────────────────────────────────────────────┘ 
  Seçenekler
  ┌───────────────────────────┬───────┬────────────────────────────────────────────────────────────────────┐
  │          Seçenek          │ Öneri │                              Açıklama                              │
  ├───────────────────────────┼───────┼────────────────────────────────────────────────────────────────────┤
  │ ☑️ Güncellemede LED yak   │ Aktif │ Etiket güncellenince LED yanıp söner (ürünü bulmayı kolaylaştırır) │
  ├───────────────────────────┼───────┼────────────────────────────────────────────────────────────────────┤
  │ ☑️ Otomatik tekrar deneme │ Aktif │ Bağlantı koparsa otomatik tekrar dener                             │
  ├───────────────────────────┼───────┼────────────────────────────────────────────────────────────────────┤
  │ ☑️ Entegrasyon aktif      │ Aktif │ Hanshow entegrasyonunu etkinleştirir                               │
  └───────────────────────────┴───────┴────────────────────────────────────────────────────────────────────┘
  Özet

  Tüm değerleri varsayılan bırakabilirsiniz, sadece:

  1. 3 checkbox'ı da işaretleyin ✅
  2. "Kaydet" butonuna tıklayın
  3. "Bağlantı Testi" butonuna tıklayın

  Bağlantı başarılıysa yeşil kutuda gateway bilgilerini göreceksiniz:
  - MAC: DC:07:C1:01:A8:96
  - IP: 192.168.1.178
  - Version: 3.3.0

