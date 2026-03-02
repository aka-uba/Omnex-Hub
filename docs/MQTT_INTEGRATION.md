# MQTT Entegrasyonu - PavoDisplay ESL

> **Versiyon:** 2.4 | **Tarih:** 2026-02-22 | **Durum:** Guncel kod ile hizalandi (multi-protocol dispatch + tenant izolasyonu + MQTT payload + report command fallback + legacy appId/sign fallback + MQTT dynamic image parity + publish payload compatibility + Windows JSON payload quote fix + render cache reuse + grid top/bottom region fix + updatelabel trigger normalization + default image fallback + safe-left inset parity + LabelPicture X safe-left parity)

---

## Icindekiler

0. [2026-02-23 Guncelleme Notlari](#0-2026-02-23-guncelleme-notlari)
1. [Genel Bakis](#1-genel-bakis)
2. [Mimari](#2-mimari)
3. [Onkosuller](#3-onkosuller)
4. [Admin Kurulum Rehberi](#4-admin-kurulum-rehberi)
5. [Bluetooth ile Cihaz Yapilandirma](#5-bluetooth-ile-cihaz-yapilandirma)
6. [Cihaza Icerik Gonderim Akisi](#6-cihaza-icerik-gonderim-akisi)
7. [API Endpoint Referansi](#7-api-endpoint-referansi)
8. [Komut Kuyrugu (Command Queue)](#8-komut-kuyrugu)
9. [Sign Dogrulama Algoritmasi](#9-sign-dogrulama-algoritmasi)
10. [Veritabani Semasi (Detayli)](#10-veritabani-semasi-detayli)
11. [Localhost Test Sonuclari](#11-localhost-test-sonuclari)
12. [Bilinen Sorunlar ve Cozumler](#12-bilinen-sorunlar-ve-cozumler)
13. [Sorun Giderme](#13-sorun-giderme)
14. [Admin Panel: MQTT Ayarlar Sekmesi](#14-admin-panel-mqtt-ayarlar-sekmesi)
15. [Bluetooth Wizard: Cihaz Guncelleme Akisi](#15-bluetooth-wizard-cihaz-guncelleme-akisi)
16. [Mosquitto Kurulumu (Windows)](#16-mosquitto-kurulumu-windows)

---

## 0. 2026-02-23 Guncelleme Notlari

- `api/templates/render.php` MQTT cihazlari artik HTTP ile ayni `sendParams` akisini kullanir.
- Video + image region bilgisi MQTT yolunda da korunur (`queueContentUpdate`).
- `services/MqttBrokerService.php` MQTT `LabelPicture` olustururken HTTP `sendGridLabel` ile uyumlu on-isleme yapar: `image_region` kirpma/olcekleme + dynamic field render.
- MQTT icin uretilen optimize/kirpilan gorseller mevcut cache yapisina (`storage/renders/cache/{company_id}/`) yazilir.
- Ayri `mqtt-assets` klasoru kullanilmaz.
- Ayr? `mqtt-assets` klasoru kullanilmaz.
- Not (v2.2): Publish tarafinda `updatelabel` komutu minimal gonderilir (`action/push_id/clientid` + opsiyonel `clear-res`).
- Not (v2.2): Gorev verisi (`LabelPicture`, `LabelVideo`, `Nlast`) `storage/renders/{company_id}/esl/mqtt-payloads/{device_id}.json` dosyasina yazilir ve cihaz `content` endpointinden ceker.
- MQTT publish payload'i uyumluluk icin sadele?tirildi: varsayilan `Data:null` gonderilmez; `queueContentUpdate` tetiginde `Data` alanina task eklenir.
- MQTT publish `QoS 1` ile yapilir (anlik komut kacirma riskini azaltmak icin).
- Not (v2.2): Publish tetik komutu `updatelabel` minimaldir; gorev verisi `mqtt_payload` dosyasindan cekilir.
- Windows'ta `mosquitto_pub` publish tarafinda `-m` yerine `-f` (payload dosyasi) kullanilir; shell quote kirilmasi ile gecersiz JSON publish edilmesi ve cihazda `received message, no data` hatasi engellenir.
- MQTT akisinda `clear-res` artik varsayilan olarak gonderilmez; cihaz eski icerigi korur, yeni icerik indikten sonra gecis yapar.
- `clear-res` sadece acikca istenirse (`force_clear_resources` / `clear-res`) MQTT komutuna eklenir.
- MQTT gorselinde kaynak dosya zaten hedef `image_region` boyutundaysa yeni dosya uretilmez; mevcut render cache dosyasi dogrudan kullanilir.
- `queueContentUpdate` publish asamasinda `updatelabel` komutu `Data` tasimaz; cihaz gorevi `content` endpointinden ceker (firmware uyumlulugunu arttirir).
- `api/esl/mqtt/content.php` URL olan `PicturePath`/`VideoPath` alanlarini response'dan ayiklar ve `PictureUrl`/`VideoUrl` alanlarini tercih eder.
- `api/render-queue/process.php` grid yerlesiminde video ust/alt tespiti `videoY > 0` yerine video merkezine gore yapilir; `y=1` gibi ust bolgeler yanlislikla alta tasinmaz.
- MQTT `LabelPicture` olusamazsa `storage/defaults` altindaki (cihaz/gateway/firma/sistem) varsayilan gorseller otomatik fallback olarak kullanilir.
- `services/PavoDisplayGateway.php` icindeki ortak `renderDynamicFields` yolunda sol kenara dayali dinamik alanlar icin varsayilan `+10px` safe-left inset aktiflestirildi; HTTP ve MQTT tekli gonderim ciktilari hizalandi.
- HTTP `sendLabel/sendGridLabel` ve MQTT `buildPicturePayload` yollarinda `LabelPicture.X` degeri, sol kenara dayali static nesne tespitinde ayni safe-left kuraliyla ofsetlenir (gateway disi yol ile parity).
- Safe-left inset sadece sol dayali ve sol kenara yakin nesnelerde uygulanir (varsayilan threshold: `12px`); center/right hizalamalar etkilenmez. Gerekirse `safe_left_pad` / `safe_left_threshold` ile override edilebilir.
- Protokol yonlendirmesi cihaz bazlidir: `communication_mode` degerine gore HTTP-SERVER / HTTP / MQTT ayrilir.
- `api/devices/update.php` artik `communication_mode`, `mqtt_client_id`, `mqtt_topic` alanlarini gunceller.
- `api/esl/mqtt/register.php` strict `appId+sign` dogrulamasi yapar; gerekirse kayitli MQTT cihaz (clientId + IP) uzerinden legacy fallback uygular.
- `api/esl/mqtt/content.php` ve `api/esl/mqtt/report.php` strict dogrulamayi korur, kayitli cihazlar icin legacy fallback destekler.
- `app_secret` dolu ise strict akista public MQTT endpointlerinde `sign` zorunludur; legacy fallback sadece kayitli cihaz + IP eslesmesinde devreye girer.
- MQTT payload atamalarinda `device_content_assignments.content_type = mqtt_payload` desteklenir.
- Pavo topic formati standartlastirildi: `{topic_prefix}/p2p/GID_omnex@@@{CLIENT_ID}`.
- `api/esl/mqtt/report.php` bekleyen komutlari tekrar dondurur (queue fallback); `Data` alani komut varsa JSON STRING icerir.
- MQTT komut/payload `clientid` degeri normalize edilir (`20:51:F5:4F:50:59` -> `2051F54F5059`).
- Bluetooth Wizard secilen protokolu (`http-server` / `http` / `mqtt`) backend'e `communication_mode` olarak gonderir.

### Gecis Davranisi (v2.2)

- Varsayilan MQTT guncellemede `clear-res` gonderilmez; cihaz yeni icerik inerken eski icerigi gostermeye devam eder.
- Bu davranis, indirme aninda fabrika/default goruntuye dusme etkisini azaltir.
- Zorunlu bellek temizligi gereken durumda sadece acikca `force_clear_resources=1` (veya `clear-res=1`) kullanin.

---

## 1. Genel Bakis

### Problem

PavoDisplay PD1010-II ESL tabletler normalde **HTTP-SERVER** modunda calisir:
cihaz kendi uzerinde bir HTTP sunucusu acar, bizim sunucumuz dosyalari dogrudan
cihazin IP adresine push eder. Bu modda:

- Cihazlarin sabit yerel IP adresi olmali
- Ayni agda bir **Gateway PC** gerekli
- NAT/firewall arkasindaki cihazlara erisilemez

### Cozum

**MQTT modu** ile cihazlar bir MQTT broker uzerinden iletisim kurar:

- Cihaz internete cikabilen herhangi bir WiFi aginda olabilir
- Gateway PC'ye ihtiyac yok
- Cihaz periyodik olarak sunucuyu poll eder (icerik + komut)
- Mevcut HTTP-SERVER cihazlar aynen calismaya devam eder (hibrit mod)

### Iletisim Modlari Karsilastirmasi

| Ozellik | HTTP-SERVER | MQTT |
|---------|-------------|------|
| Cihaz rolu | HTTP sunucusu | MQTT client + HTTP poll |
| Ag gereksinimi | Ayni LAN | Internet erisimi yeterli |
| Gateway PC | Gerekli | Gereksiz |
| IP adresi | Sabit IP sart | IP onemli degil |
| Icerik gonderimi | Push (sunucu → cihaz) | Pull (cihaz â† sunucu) |
| Komut iletimi | Anlik HTTP cagri | MQTT publish (anlik) + kuyruk fallback |
| Gecikme suresi | < 1sn | Genelde < 1-3sn (poll araligina bagli) |

---

## 2. Mimari

### Akis Diyagrami

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     BLE Kurulum      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Admin       â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚  PavoDisplay     â”‚
â”‚  (Browser)   â”‚                      â”‚  PD1010-II       â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚                                       â”‚
       â”‚ HTTP (JWT Auth)                       â”‚ WiFi
       â”‚                                       â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”                      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Omnex       â”‚                      â”‚  MQTT Broker     â”‚
â”‚  Sunucu      â”‚ â—„â”€â”€ TCP test â”€â”€â”€â”€â”€â”€â–º â”‚  (Mosquitto vb.) â”‚
â”‚  (PHP)       â”‚                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚              â”‚                               â”‚
â”‚              â”‚ â—„â”€â”€â”€â”€ HTTP Poll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚              â”‚   /api/esl/mqtt/register      (PavoDisplay sunucuyu
â”‚              â”‚   /api/esl/mqtt/report         dogrudan poll eder)
â”‚              â”‚   /api/esl/mqtt/content
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Onemli Tasarim Karari

Sistem hibrit calisir:

v1.3 guncel davranis:

1. Komut once `device_commands` tablosuna yazilir (izlenebilirlik / fallback).
2. Sunucu broker'a `mosquitto_pub` ile anlik publish dener (`publishToMqttBroker`).
3. Publish basarisizsa komut kuyrukta kalir, cihaz sonraki dongude alir.
4. Icerik `content` endpointinden cekilir; cihaz bazli `mqtt_payload` atamasi desteklenir.
5. HTTP ve MQTT ayni render/send parametreleriyle calisir (video/image region korunur).


Bu yapi hem anlik iletim hem de kuyruk fallback saglar.

---

## 3. Onkosuller

### Sunucu Tarafi

- Omnex Display Hub kurulu ve calisiyor
- `096_esl_mqtt_support.sql` migration uygulanmis
  (Otomatik uygulanir - `Database::migrate()` her istekte calisir)

### MQTT Broker

Herhangi bir MQTT broker kullanilabilir:

- **Mosquitto** (onerilen, acik kaynak)
- **HiveMQ**
- **EMQX**
- **CloudMQTT** (bulut servis)

Broker gereksinimleri:
- TCP 1883 portu acik (TLS icin 8883)
- Opsiyonel: WebSocket destegiyle 8083 portu
- Username/password authentication (onerilen)

### Cihaz Tarafi

- PavoDisplay PD1010-II, firmware V3.36+
- Web Bluetooth destekleyen tarayici (Chrome 56+, Edge 79+)

---

## 4. Admin Kurulum Rehberi

### Adim 1: MQTT Broker Kurun

#### Ubuntu/Linux Kurulumu

```bash
sudo apt install mosquitto mosquitto-clients

# Sifre dosyasi olustur
sudo mosquitto_passwd -c /etc/mosquitto/passwd omnex_user

# Konfigurasyonu duzenle
sudo nano /etc/mosquitto/conf.d/omnex.conf
```

Ornek `omnex.conf`:

```
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd
```

#### Windows Kurulumu

Detayli adimlar icin bkz: [Bolum 16: Mosquitto Kurulumu (Windows)](#16-mosquitto-kurulumu-windows)

Kisa ozet:
1. https://mosquitto.org/download/ → Windows 64-bit installer indir ve kur
2. `C:\Program Files\mosquitto\mosquitto.conf` dosyasini duzenle
3. `net start mosquitto` ile servisi baslat
4. Firewall kurali ekle (TCP 1883)

### Adim 2: Omnex'te MQTT Ayarlarini Yapilandirin

Admin panelden **Ayarlar → Entegrasyonlar → MQTT Broker** sekmesinden (bkz: [Bolum 14](#14-admin-panel-mqtt-ayarlar-sekmesi)) veya dogrudan API ile:

**PUT** `/api/esl/mqtt/settings`

```json
{
    "broker_url": "mqtt.firmaniz.com",
    "broker_port": 1883,
    "use_tls": false,
    "username": "omnex_user",
    "password": "broker_sifresi",
    "topic_prefix": "omnex/esl",
    "provider": "mosquitto",
    "app_id": "omnex_firma123",
    "app_secret": "guclu_bir_secret_key",
    "content_server_url": "http://sunucu.firmaniz.com/market-etiket-sistemi/api/esl/mqtt/content",
    "report_server_url": "http://sunucu.firmaniz.com/market-etiket-sistemi/api/esl/mqtt/report"
}
```

#### Alan Aciklamalari

| Alan | Aciklama | Ornek |
|------|----------|-------|
| `broker_url` | MQTT broker adresi (hostname veya IP) | `mqtt.firmaniz.com` veya `192.168.1.50` |
| `broker_port` | MQTT port numarasi | `1883` (TCP), `8883` (TLS) |
| `use_tls` | SSL/TLS kullanimi | `false` (yerel ag), `true` (internet) |
| `username` | Broker kullanici adi | `omnex_user` |
| `password` | Broker sifresi | `guclu_sifre` |
| `topic_prefix` | MQTT topic on eki | `omnex/esl` |
| `provider` | Broker markasi (bilgi amacli) | `mosquitto` |
| `app_id` | Firma tanimlayicisi (cihaz bu ID ile gelir) | `omnex_firma123` |
| `app_secret` | Sign dogrulama anahtari (bos birak = dogrulama yapilmaz) | `secret123` |
| `content_server_url` | Cihazin icerik cekecegi URL | `http://sunucu/api/esl/mqtt/content` |
| `report_server_url` | Cihazin rapor gonderecegi URL | `http://sunucu/api/esl/mqtt/report` |

### Adim 3: Baglanti Testi

**POST** `/api/esl/mqtt/test`

```json
{}
```

Bos body gonderin - kaydedilmis ayarlari test eder. Veya kaydetmeden test icin:

```json
{
    "broker_url": "mqtt.firmaniz.com",
    "broker_port": 1883
}
```

Basarili yanit:
```json
{
    "success": true,
    "data": {
        "connected": true,
        "response_time": 45,
        "broker_url": "mqtt.firmaniz.com",
        "broker_port": 1883
    }
}
```

---

## 5. Bluetooth ile Cihaz Yapilandirma

### Bluetooth Wizard Adimlari

Cihazlar sayfasindan **"Cihaz Ekle"** → Bluetooth wizard acilir.

#### Adim 1-2: Tara ve Baglan

Standart BLE tarama. Cihaz `@B PavoDisplay_XXXX` veya `ESL_XXXX` olarak gorunur.

#### Adim 3: WiFi Ayarla

Cihazin baglanacagi WiFi agini secin. MQTT modunda cihazin internete cikabilmesi yeterlidir.

#### Adim 4: Protokol Sec → MQTT

Protokol olarak **MQTT** secildiginde ek alanlar gorunur:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Iletisim Protokolu:  [MQTT â–¾]              â”‚
â”‚                                             â”‚
â”‚  â”Œâ”€â”€â”€ MQTT Yapilandirma â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                                      â”‚   â”‚
â”‚  â”‚  MQTT Broker URL:                    â”‚   â”‚
â”‚  â”‚  [ mqtt://broker.firma.com:1883    ] â”‚   â”‚
â”‚  â”‚                                      â”‚   â”‚
â”‚  â”‚  Icerik Sunucusu (Remote-server):    â”‚   â”‚
â”‚  â”‚  [ http://sunucu/api/esl/mqtt/cont ] â”‚   â”‚
â”‚  â”‚                                      â”‚   â”‚
â”‚  â”‚  Rapor Sunucusu (itemInfo-server):   â”‚   â”‚
â”‚  â”‚  [ http://sunucu/api/esl/mqtt/repo ] â”‚   â”‚
â”‚  â”‚                                      â”‚   â”‚
â”‚  â”‚  App ID:        [ omnex_firma123   ] â”‚   â”‚
â”‚  â”‚  App Secret:    [ secret_key       ] â”‚   â”‚
â”‚  â”‚                                      â”‚   â”‚
â”‚  â”‚  [ğŸ”„ Sunucu ayarlarini yukle]        â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                             â”‚
â”‚         [ Protokolu Ayarla ]                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Sunucu Ayarlarini Yukle Butonu

Bu butona tiklandiginda:
1. `GET /api/esl/mqtt/settings` cagirilir
2. Broker URL, port, AppID otomatik doldurulur
3. Content ve Report URL'leri mevcut origin'den otomatik olusturulur:
   - Content: `{origin}/{basePath}/api/esl/mqtt/content`
   - Report: `{origin}/{basePath}/api/esl/mqtt/report`
4. AppSecret sunucu tarafinda uretilmis ise `app_secret_plain` ile otomatik doldurulur; bos ise elle girilir

#### Dogru URL Formatlari

| Alan | Format | Ornek |
|------|--------|-------|
| **MQTT Broker URL** | `mqtt://host:port` veya `ws://host:port` | `mqtt://192.168.1.50:1883` |
| **Icerik Sunucusu** | `http(s)://host/path/api/esl/mqtt/content` | `http://omnex.firma.com/market-etiket-sistemi/api/esl/mqtt/content` |
| **Rapor Sunucusu** | `http(s)://host/path/api/esl/mqtt/report` | `http://omnex.firma.com/market-etiket-sistemi/api/esl/mqtt/report` |

> **ONEMLI:** Content ve Report URL'lerinde:
> - Sunucunun tam adresi olmali (IP veya domain)
> - Projenin dizin yolu dahil olmali (`/market-etiket-sistemi`)
> - URL sonlari `/api/esl/mqtt/content` ve `/api/esl/mqtt/report` olmali
> - Cihaz bu URL'lere HTTP GET/POST yapacak, bu yuzden sunucu cihazdan erisilebilir olmali

#### Bluetooth ile Gonderilen Komutlar

"Protokolu Ayarla" butonuna tiklandiginda cihaza sirasiyla su BLE komutlari gonderilir:

```
1. +SET-DEVICE:{"Protocol":"MQTT", "Token":""}
2. +SET-DEVICE:{"mqtt-url":"mqtt://broker:1883", "Token":""}
3. +SET-DEVICE:{"mqtt-server":"http://sunucu/api/esl/mqtt/register", "Token":""}
4. +SET-DEVICE:{"Remote-server":"http://sunucu/api/esl/mqtt/content", "Token":""}
5. +SET-DEVICE:{"itemInfo-server":"http://sunucu/api/esl/mqtt/report", "Token":""}
6. +SET-DEVICE:{"appid":"omnex_firma123", "Token":""}
7. +SET-DEVICE:{"appsecret":"secret_key", "Token":""}
```

Her komut BLE GATT write ile gonderilir, aralarinda 300ms bekleme suresivardır.

#### Adim 5: Dogrula ve Kaydet

- Cihaz bilgileri okunur (IP, MAC, ekran boyutu)
- "Cihaz Ekle" tiklandiginda:
  - secilen protokole gore `communication_mode` (`mqtt` / `http-server` / `http`) ile kaydedilir
  - IP adresi MQTT icin **zorunlu degildir**

---

## 6. Cihaza Icerik Gonderim Akisi (Detayli)

Sistemde 3 farkli gonderim senaryosu vardir. Her senaryo MQTT ve HTTP-SERVER
icin farkli davranir.

---

### Senaryo A: Tek Cihaza Gonderim (Sablon Editoru → "Gonder")

**Tetikleyen:** Admin sablon editorunde "Cihaza Gonder" tiklar
**Endpoint:** `POST /api/templates/:id/render`

#### HTTP-SERVER Modu (Mevcut)

```
Admin → "Gonder" butonuna tiklar
  â”‚
  â”œâ”€ 1. POST /api/templates/:id/render
  â”‚     body: { device_id, product_id, render_image (base64) }
  â”‚
  â”œâ”€ 2. Gorsel kaynagi belirlenir (oncelik sirasi):
  â”‚     a) Client-side render (base64 gorsel - en yuksek oncelik)
  â”‚     b) Render cache (RenderCacheService)
  â”‚     c) template.render_image (editor kaydi)
  â”‚     d) Tasarim klasoru screen.png
  â”‚     e) template.preview_image
  â”‚     f) Urun gorselleri
  â”‚     g) GD fallback (basit metin render)
  â”‚
  â”œâ”€ 3. Gateway routing karari:
  â”‚     â”œâ”€ gateway_enabled = true?
  â”‚     â”œâ”€ device.gateway_id mevcut?
  â”‚     â”œâ”€ gateway.status = 'online'?
  â”‚     â””â”€ gateway heartbeat < 120sn?
  â”‚
  â”œâ”€ 4a. DOGRUDAN (gateway yok/kapalı):
  â”‚     â”œâ”€ PavoDisplayGateway::sendLabel()
  â”‚     â”œâ”€ HTTP POST → cihaz_ip/upload (binary gorsel)
  â”‚     â”œâ”€ GET → cihaz_ip/replay (task JSON ile ekran guncelleme)
  â”‚     â””â”€ Sonuc: Anlik (< 1sn)
  â”‚
  â””â”€ 4b. GATEWAY UZERINDEN:
        â”œâ”€ gateway_commands tablosuna INSERT
        â”œâ”€ Gateway agent tabloyu poll eder → cihaza HTTP push
        â””â”€ Sonuc: ~5-10sn (gateway poll suresi)
```

#### MQTT Modu (Yeni)

```
Admin → "Gonder" butonuna tiklar
  â”‚
  â”œâ”€ 1. POST /api/templates/:id/render
  â”‚     body: { device_id, product_id, render_image (base64) }
  â”‚
  â”œâ”€ 2. Cihaz communication_mode='mqtt' tespit edilir
  â”‚
  â”œâ”€ 3. Gorsel render edilir + dosyaya kaydedilir:
  â”‚     â”œâ”€ product_renders tablosuna kayit
  â”‚     â”‚   (company_id, product_id, template_id, device_type, file_path)
  â”‚     â””â”€ device_content_assignments tablosuna kayit
  â”‚         (device_id, content_type='image', content_id, status='active')
  â”‚
  â”œâ”€ 4. device_commands tablosuna 'updatelabel' komutu eklenir
  â”‚     (cihaza "yeni icerik var" sinyali)
  â”‚
  â””â”€ 5. Yanit: { success: true, delivery: 'queued', estimated: '~5dk' }

  ... Zaman gecer (0-5 dakika) ...

Cihaz tarafinda:
  â”‚
  â”œâ”€ 6. Cihaz periyodik report gonderir
  â”‚     POST /api/esl/mqtt/report { clientId, battery, version... }
  â”‚     â† Yanit: { commands: [{ action: "updatelabel" }] }
  â”‚
  â”œâ”€ 7. Cihaz content endpoint'ini cagirır
  â”‚     GET /api/esl/mqtt/content?clientId=XXX
  â”‚     â† Yanit: { files: [{url, md5, name}], task: {LabelPicture...} }
  â”‚
  â”œâ”€ 8. Cihaz dosyayi URL'den HTTP ile indirir
  â”‚     GET http://sunucu/storage/renders/company/esl/tr/tpl/hash.jpg
  â”‚
  â””â”€ 9. Cihaz ekrani gunceller
        Sonuc: ~5dk gecikme (report_interval'a bagli)
```

**Onemli Fark:**
- HTTP-SERVER: Sunucu → cihaza **push** (anlik)
- MQTT: Cihaz â† sunucudan **pull** (gecikmeli, ~5dk)

---

### Senaryo B: Coklu Cihaza Gonderim (render.php + paralel)

**Tetikleyen:** Admin birden fazla cihaz secer ve "Toplu Gonder" tiklar
**Mevcut Metod:** `PavoDisplayGateway::sendToMultipleDevicesParallel()`

#### HTTP-SERVER Modu (Mevcut)

```
Admin → Cihaz listesinden N cihaz secer → "Toplu Gonder"
  â”‚
  â”œâ”€ 1. Gorsel render edilir (bir kez)
  â”‚
  â”œâ”€ 2. Cihazlar tipe gore gruplanir (ESL, TV)
  â”‚     â””â”€ Her tip icin esanlamlilik limiti (ESL:2, TV:10)
  â”‚
  â”œâ”€ 3. Her batch icin paralel islem:
  â”‚     â”œâ”€ GET cihaz/check?file_path=X (MD5 kontrol - delta update)
  â”‚     â”œâ”€ MD5 eslesiyor → ATLA (ayni dosya zaten var)
  â”‚     â”œâ”€ MD5 farkli → POST cihaz/upload (dosya yukle)
  â”‚     â””â”€ GET cihaz/replay (ekrani guncelle)
  â”‚
  â””â”€ 4. Sonuclar toplanir:
        { sent: 8, skipped: 2, failed: 0 }
        Sonuc: Paralel, ~10-30sn (cihaz sayisina bagli)
```

#### MQTT Modu (Yeni - Hibrit)

```
Admin → N cihaz secer (karisik: 5 HTTP-SERVER + 3 MQTT)
  â”‚
  â”œâ”€ 1. Gorsel render edilir (bir kez)
  â”‚
  â”œâ”€ 2. Cihazlar communication_mode'a gore gruplanir:
  â”‚
  â”œâ”€ GRUP A: HTTP-SERVER Cihazlar (5 adet)
  â”‚  â”œâ”€ Mevcut paralel push akisi (yukarda)
  â”‚  â”œâ”€ Delta update + upload + replay
  â”‚  â””â”€ Sonuc: Anlik (~10-30sn)
  â”‚
  â””â”€ GRUP B: MQTT Cihazlar (3 adet)
     â”œâ”€ Her biri icin:
     â”‚  â”œâ”€ product_renders + device_content_assignments kaydi
     â”‚  â””â”€ device_commands'a 'updatelabel' eklenir
     â”œâ”€ Sonuc: Kuyruga eklendi
     â””â”€ Cihazlar sonraki report'larinda icerigi ceker (~5dk)

Toplam yanit:
{
  sent: 5,         // HTTP-SERVER: anlik gonderildi
  queued: 3,       // MQTT: kuyruga eklendi
  skipped: 0,
  failed: 0,
  mqttNote: "3 MQTT cihaz icerigi ~5dk icinde alacak"
}
```

---

### Senaryo C: Render Queue ile Toplu Gonderim (En Buyuk Olcek)

**Tetikleyen:** Kuyruk Paneli → Wizard ile urun, sablon, cihaz(lar) secimi
**Endpoint:** `POST /api/render-queue` → `POST /api/render-queue/process`

#### Mevcut Akis (HTTP-SERVER)

```
Adim 1 - Job Olusturma:
  Admin → Kuyruk Paneli → Wizard
    â”œâ”€ Sablon sec (veya birden fazla)
    â”œâ”€ Urun sec (veya birden fazla)
    â”œâ”€ Cihaz(lar) sec
    â””â”€ Oncelik sec (urgent/high/normal/low)
  â”‚
  â”œâ”€ POST /api/render-queue
  â”‚  â”œâ”€ render_queue tablosuna job INSERT (status='pending')
  â”‚  â””â”€ render_queue_items tablosuna N cihaz INSERT (her biri 'pending')
  â”‚
  â–¼
Adim 2 - Isleme:
  POST /api/render-queue/process (veya worker daemon)
    â”‚
    â”œâ”€ Priority sirasina gore job sec (urgent > high > normal > low)
    â”‚
    â”œâ”€ Her render_queue_item icin:
    â”‚  â”œâ”€ Gorsel kaynagini belirle (cache > pre-render > template > product)
    â”‚  â”œâ”€ Gateway routing karari
    â”‚  â”‚
    â”‚  â”œâ”€ Video var mi? (template design_data'da video_placeholder?)
    â”‚  â”‚  â”œâ”€ EVET → sendGridLabel() (gorsel + video bolgeleri)
    â”‚  â”‚  â””â”€ HAYIR → sendLabel() (sadece gorsel)
    â”‚  â”‚
    â”‚  â”œâ”€ Basarili → item.status = 'completed'
    â”‚  â”œâ”€ Basarisiz → item.status = 'failed', retry_count++
    â”‚  â””â”€ 3 retry sonrasi → kalici fail
    â”‚
    â””â”€ Job tamamlaninca:
       render_queue.status = 'completed'
       render_queue.progress = 100
```

#### Yeni Akis (MQTT Hibrit)

```
Adim 1 - Job Olusturma: (ayni)
  â”œâ”€ render_queue + render_queue_items olusturulur
  â””â”€ Karisik cihazlar olabilir (HTTP-SERVER + MQTT)

Adim 2 - Isleme:
  POST /api/render-queue/process
    â”‚
    â”œâ”€ Her render_queue_item icin:
    â”‚  â”‚
    â”‚  â”œâ”€ Cihaz bilgisi cekilir (communication_mode dahil)
    â”‚  â”‚
    â”‚  â”œâ”€ IF communication_mode = 'mqtt':
    â”‚  â”‚  â”‚
    â”‚  â”‚  â”œâ”€ Gorsel render edilir (ayni kaynak onceligi)
    â”‚  â”‚  â”œâ”€ product_renders tablosuna kaydedilir
    â”‚  â”‚  â”‚   (company_id, product_id, template_id, device_type, file_path)
    â”‚  â”‚  â”œâ”€ device_content_assignments tablosuna kaydedilir
    â”‚  â”‚  â”‚   (device_id, content_type='image', content_id)
    â”‚  â”‚  â”œâ”€ device_commands'a 'updatelabel' eklenir
    â”‚  â”‚  â”œâ”€ item.status = 'completed' (sunucu tarafi tamamlandi)
    â”‚  â”‚  â””â”€ NOT: Cihaz henuz almadi, ama sunucu isi bitti
    â”‚  â”‚
    â”‚  â””â”€ IF communication_mode = 'http-server':
    â”‚     â””â”€ Mevcut push akisi (HTTP upload + replay)
    â”‚
    â””â”€ Job tamamlaninca:
       render_queue.status = 'completed'
       NOT: MQTT cihazlar gercek teslimati ~5dk sonra yapar
```

---

### Ozet Karsilastirma Tablosu

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Senaryo        â”‚   HTTP-SERVER         â”‚   MQTT                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Tek cihaz       â”‚ render.php → HTTP     â”‚ render.php → DB kayit    â”‚
â”‚ gonderimi       â”‚ push (anlik)          â”‚ + komut kuyrugu (~5dk)   â”‚
â”‚                 â”‚                      â”‚                          â”‚
â”‚ Tetikleyen      â”‚ render.php            â”‚ render.php               â”‚
â”‚ Endpoint        â”‚ PavoDisplayGateway    â”‚ MqttBrokerService        â”‚
â”‚                 â”‚ ::sendLabel()         â”‚ ::publishCommand()       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Coklu cihaz     â”‚ sendToMultiple        â”‚ HTTP-SERVER → push       â”‚
â”‚ (paralel)       â”‚ DevicesParallel()     â”‚ MQTT → kuyruk            â”‚
â”‚                 â”‚ MD5 delta update      â”‚ Hibrit sonuc raporu      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Render Queue    â”‚ process.php →         â”‚ process.php →            â”‚
â”‚ (toplu)         â”‚ item bazli HTTP push  â”‚ item bazli:              â”‚
â”‚                 â”‚ retry + priority      â”‚   HTTP-SERVER → push     â”‚
â”‚                 â”‚                      â”‚   MQTT → DB + kuyruk     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Kontrol         â”‚ control.php →         â”‚ control.php →            â”‚
â”‚ (refresh,       â”‚ HTTP GET/POST         â”‚ device_commands          â”‚
â”‚ reboot vb.)     â”‚ dogrudan cihaza       â”‚ tablosuna INSERT         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Gecikme         â”‚ < 1sn (dogrudan)      â”‚ 0 - 5dk                  â”‚
â”‚                 â”‚ ~5sn (gateway)        â”‚ (report_interval'a bagli)â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ IP adresi       â”‚ ZORUNLU               â”‚ Gereksiz                 â”‚
â”‚                 â”‚                      â”‚                          â”‚
â”‚ Gateway PC      â”‚ Opsiyonel (onerilen)  â”‚ Gereksiz                 â”‚
â”‚                 â”‚                      â”‚                          â”‚
â”‚ Internet        â”‚ Gereksiz (LAN yeter)  â”‚ ZORUNLU                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### Kontrol Komutlari (control.php Hibrit Routing)

Admin panelden cihaz kontrolu gonderildiginde (`POST /api/devices/:id/control`):

```
control.php:
  â”‚
  â”œâ”€ Cihaz bilgisi cekilir (communication_mode dahil)
  â”‚
  â”œâ”€ IF communication_mode = 'mqtt':
  â”‚  â”‚
  â”‚  â”œâ”€ ping → last_seen timestamp kontrolu (< 360sn = online)
  â”‚  â”œâ”€ device_info → metadata JSON'dan cache'li bilgi
  â”‚  â””â”€ Diger aksiyonlar → device_commands tablosuna INSERT:
  â”‚     â”œâ”€ refresh    → 'updatelabel'    (oncelik: 5)
  â”‚     â”œâ”€ reboot     → 'deviceRestart'  (oncelik: 10)
  â”‚     â”œâ”€ clear      → 'clearspace'     (oncelik: 5)
  â”‚     â”œâ”€ brightness → 'backlight'      (oncelik: 5)
  â”‚     â””â”€ firmware   → 'deviceUpgrade'  (oncelik: 10)
  â”‚
  â””â”€ IF communication_mode = 'http-server':
     â””â”€ Mevcut HTTP akisi (dogrudan cihaz IP'sine istek)
```

### MQTT Icerik Teslim Dongusu (Detayli)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Omnex       â”‚                    â”‚  PavoDisplay     â”‚
â”‚  Sunucu      â”‚                    â”‚  (MQTT mod)      â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚                                     â”‚
       â”‚  â† POST /api/esl/mqtt/report â”€â”€â”€â”€â”€  â”‚  (her 5dk)
       â”‚    { clientId, battery, version }    â”‚
       â”‚                                     â”‚
       â”‚  â”€â”€ Yanit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€→   â”‚
       â”‚    { commands: ["updatelabel"] }     â”‚
       â”‚                                     â”‚
       â”‚  â† GET /api/esl/mqtt/content â”€â”€â”€â”€â”€  â”‚  (komut sonrasi)
       â”‚    ?clientId=XXX&version=YYY         â”‚
       â”‚                                     â”‚
       â”‚  â”€â”€ Yanit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€→   â”‚
       â”‚    { files: [{url, md5}],           â”‚
       â”‚      task: {LabelPicture...} }      â”‚
       â”‚                                     â”‚
       â”‚  â† GET /storage/renders/xxx.jpg â”€â”€  â”‚  (dosya indir)
       â”‚                                     â”‚
       â”‚  â”€â”€ Binary gorsel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€→   â”‚
       â”‚                                     â”‚
       â”‚                              [Ekran guncellenir]
       â”‚                                     â”‚
       â”‚  â† POST /api/esl/mqtt/report â”€â”€â”€â”€â”€  â”‚  (sonraki periyod)
       â”‚    { version: "yeni_md5_hash" }     â”‚
       â”‚                                     â”‚
       â”‚  â”€â”€ Yanit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€→   â”‚
       â”‚    { commands: [] }                  â”‚  (bos - guncel)
```

### Delta Update Mekanizmasi

```
Cihaz report gonderirken → version (son icerik MD5 hash)
Cihaz content sorgularken → version parametresi

Sunucu karsilastirir:
  IF cihazin version == sunucudaki content_version:
    → { up_to_date: true, files: [] }     // Icerik zaten guncel
  ELSE:
    → { up_to_date: false, files: [...] }  // Yeni dosyalari gonder

Bu mekanizma gereksiz veri transferini onler.
```

### Mevcut Durum

| Birim | HTTP-SERVER | MQTT | Durum |
|-------|-------------|------|-------|
| `control.php` | Calisiyor | Calisiyor (hibrit) | âœ… Tamamlandi |
| `register.php` | - | Calisiyor | âœ… Tamamlandi |
| `report.php` | - | Calisiyor | âœ… Tamamlandi |
| `content.php` | - | Calisiyor | âœ… Tamamlandi |
| `render.php` | Calisiyor | Calisiyor (hibrit) | âœ… Tamamlandi |
| `process.php` | Calisiyor | Calisiyor (hibrit) | âœ… Tamamlandi |
| BluetoothWizard | Calisiyor | Calisiyor | âœ… Tamamlandi |
| DeviceList | Calisiyor | Calisiyor (badge) | âœ… Tamamlandi |

Tum gonderim yollari protokol bazli calisir. `communication_mode = mqtt` ise IP kontrolu atlanir, ayni sendParams (video/image region dahil) ile `queueContentUpdate` kullanilir ve gerekli durumda `updatelabel` tetiklenir.

---

## 7. API Endpoint Referansi

### Guncel API Notlari (v1.3)

- Public MQTT endpointlerinde `appId` zorunludur.
- `app_secret` dolu tenantlarda `sign` zorunludur (`register`, `report`, `content`).
- `register` endpointinde fallback tenant secimi yoktur; sadece gelen `appId` tenanti kullanilir.
- `content` endpointi `mqtt_payload` atamasini da okur; `LabelPicture` + `LabelVideo` birlikte donebilir.
- Cihaz aramasi tenant scope ile yapilir; farkli firmalarin verisine erisim engellenir.
- Pavo cihaz yanitlari `State/Message/Number/Data/Level/ErrorColumn` formatindadir.
- `content` endpointinde `Data` alani JSON STRING olarak doner (obje degil).

### Cihaz Endpoint'leri (Public - Sign Auth)

Bu endpoint'ler JWT gerektirmez. Cihaz `appId` + `sign` ile kimlik dogrulaması yapar.

#### POST `/api/esl/mqtt/register`

Cihaz MQTT modunda ilk baslatidiginda cagirilir.

**Request:**
```json
{
    "clientId": "2051F54F500A",
    "appId": "omnex_firma123",
    "sign": "A1B2C3D4E5F6...",
    "firmware": "V3.36",
    "model": "PD1010-II",
    "screenWidth": 800,
    "screenHeight": 1280
}
```

**Response (kayitli cihaz):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "status": "registered",
        "device_id": "uuid-xxx",
        "mqtt_url": "mqtt://broker:1883",
        "mqtt_port": 1883,
        "mqtt_topic": "{topic_prefix}/p2p/GID_omnex@@@{CLIENT_ID}",
        "mqtt_username": "omnex_user",
        "mqtt_password": "sifre",
        "report_interval": 300,
        "content_url": "http://sunucu/api/esl/mqtt/content",
        "report_url": "http://sunucu/api/esl/mqtt/report"
    }
}
```

**Response (yeni cihaz - onay bekliyor):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "status": "pending",
        "message": "Cihaz kaydi olusturuldu, admin onayi bekleniyor",
        "syncCode": "482916",
        "expiresAt": "2026-02-22 12:15:00",
        "expiresIn": 900
    }
}
```

#### POST `/api/esl/mqtt/report`

Cihaz periyodik durum raporu gonderir. Komut dagitimi MQTT publish + queue fallback ile yonetilir.

**Request:**
```json
{
    "clientId": "2051F54F500A",
    "appId": "omnex_firma123",
    "sign": "A1B2C3D4...",
    "battery": 85,
    "wifi_signal": -60,
    "free_space": "27MB",
    "firmware": "V3.36",
    "uptime": 86400,
    "temperature": 32.5,
    "push_id": 123,
    "version": "md5_content_hash"
}
```

**Response:**
```json
{
    "State": "Done",
    "Message": "Success",
    "Number": "",
    "Data": "{\"commands\":[{\"action\":\"updatelabel\",\"push_id\":1708600000,\"clientid\":\"2051F54F500A\",\"data\":{\"action\":\"updatelabel\",\"push_id\":1708600000}}],\"commandCount\":1}",
    "Level": 0,
    "ErrorColumn": null
}
```

> Not: Bekleyen komut yoksa `Data` alani `"null"` doner.

#### GET `/api/esl/mqtt/content`

Cihaz icerik dosyalarini sorgular.

**Query Parameters:** `clientId`, `appId`, `sign`, `push_id`, `version`

**Response (yeni icerik var):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "push_id": 1708600000,
        "content_version": "abc123def456...",
        "up_to_date": false,
        "files": [
            {
                "name": "label_product1.jpg",
                "url": "http://sunucu/storage/renders/company1/esl/tr/tpl1/hash.jpg",
                "md5": "d41d8cd98f00b204e9800998ecf8427e",
                "size": 45000,
                "remote_path": "files/task/label_product1.jpg"
            }
        ],
        "task": {
            "Id": "2051F54F500A",
            "ItemCode": "product-uuid",
            "ItemName": "Urun Adi",
            "LabelPicture": {
                "X": 0,
                "Y": 0,
                "Width": 800,
                "Height": 1280,
                "PictureName": "label_product1.jpg",
                "PicturePath": "files/task/label_product1.jpg",
                "PictureMD5": "d41d8cd98f00b204e9800998ecf8427e"
            }
        },
        "fileCount": 1,
        "serverTime": "2026-02-22T12:00:00+03:00"
    }
}
```

**Response (icerik guncel - delta update):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "push_id": 1708600000,
        "content_version": "abc123def456...",
        "up_to_date": true,
        "files": [],
        "task": null
    }
}
```

### Admin Endpoint'leri (JWT Auth)

#### GET `/api/esl/mqtt/settings`

Firmanin MQTT ayarlarini getirir. Sifreler maskelenir.

#### PUT `/api/esl/mqtt/settings`

MQTT ayarlarini kaydeder/gunceller. Admin+ yetkisi gerekir.

#### POST `/api/esl/mqtt/test`

Broker baglanti testi. Admin+ yetkisi gerekir.

---

## 8. Komut Kuyrugu

### Desteklenen Komutlar

Admin panelden gonderilen kontrol komutlari, MQTT cihazlar icin kuyruge alinir:

| Admin Aksiyonu | Kuyruk Komutu | Oncelik | Aciklama |
|---------------|---------------|---------|----------|
| Ekrani Yenile | `updatelabel` | 5 | Cihaz content endpoint'ini cagirip icerigi gunceller |
| Yeniden Baslat | `deviceRestart` | 10 | Cihaz kendini yeniden baslatir |
| Bellegi Temizle | `clearspace` | 5 | Cihaz depolamasini temizler |
| Parlaklik Ayarla | `backlight` | 5 | Ekran parlakligi degistirir (`level` parametresi) |
| Firmware Guncelle | `deviceUpgrade` | 10 | OTA firmware guncellemesi |

### Ozel Durumlar (Kuyruksuz)

| Admin Aksiyonu | Davranis |
|---------------|----------|
| Baglanti Testi (ping) | `last_seen` timestamp kontrolu: < 360sn ise "online" |
| Cihaz Bilgisi | Metadata cache'den (son report verileri) aninda doner |

### Komut Yasam Dongusu

```
pending → sent → (cihaz tarafindan islenir)
   â”‚        â”‚
   â”‚        â””â”€â”€ Broker publish basarili ise sent durumuna cekilir (executed_at guncellenir)
   â””â”€â”€ Admin tarafindan olusturuldu (created_at)
```

**device_commands tablosu kolonlari:**
- `id`, `device_id`, `command`, `parameters` (JSON), `status`, `priority`
- `created_by`, `created_at`, `executed_at`, `result`
- **NOT:** `updated_at` kolonu **yoktur**, durum degisikligi `executed_at` ile izlenir

---

## 9. Sign Dogrulama Algoritmasi

Cihaz isteklerinin dogrulanmasi icin MD5 tabanli imza mekanizmasi:

### Hesaplama

```
1. Tum parametreleri al (sign parametresi haric)
2. Key'lere gore alfabetik sirala (ksort)
3. key1=value1&key2=value2 formatinda birlestir
4. Sonuna &key=AppSecret ekle
5. MD5 hash al
6. UPPERCASE yap
```

### Ornek

Parametreler:
```
clientId = 2051F54F500A
appId = omnex_firma123
firmware = V3.36
```

AppSecret: `my_secret_key`

```
Siralanmis: appId=omnex_firma123&clientId=2051F54F500A&firmware=V3.36
Eklenmis:   appId=omnex_firma123&clientId=2051F54F500A&firmware=V3.36&key=my_secret_key
MD5:        strtoupper(md5("appId=omnex_firma123&clientId=2051F54F500A&firmware=V3.36&key=my_secret_key"))
Sonuc:      "7F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C"
```

### Dogrulama Davranisi

- `app_secret` bos ise sign kontrolu atlanabilir.
- `app_secret` dolu ise public MQTT endpointlerinde `sign` zorunludur.
- Sign dogrulamasi basarisiz ise 403 doner.
- `appId` gecersizse tenant fallback yapilmaz, istek reddedilir.

---

## 10. Veritabani Semasi (Detayli)

### devices Tablosu (yeni kolonlar)

```sql
communication_mode  TEXT DEFAULT 'http-server'  -- 'http-server', 'mqtt', 'http'
mqtt_client_id      TEXT                        -- Cihaz MAC/ID (orn: 2051F54F500A)
mqtt_topic          TEXT                        -- {topic_prefix}/p2p/GID_omnex@@@{CLIENT_ID}
```

### mqtt_settings Tablosu

```sql
CREATE TABLE mqtt_settings (
    id                  TEXT PRIMARY KEY,
    company_id          TEXT NOT NULL UNIQUE,
    broker_url          TEXT NOT NULL,
    broker_port         INTEGER DEFAULT 1883,
    use_tls             INTEGER DEFAULT 0,
    username            TEXT,
    password            TEXT,
    topic_prefix        TEXT DEFAULT 'omnex/esl',
    provider            TEXT DEFAULT 'mosquitto',
    app_id              TEXT DEFAULT '',
    app_secret          TEXT DEFAULT '',
    content_server_url  TEXT,
    report_server_url   TEXT,
    status              TEXT DEFAULT 'active',
    last_connected      TEXT,
    created_at          TEXT,
    updated_at          TEXT
);
```

### device_content_assignments Tablosu (Gercek Sema)

```sql
-- DIKKAT: Bu tabloda sadece su kolonlar var:
id              TEXT PRIMARY KEY
device_id       TEXT NOT NULL
content_type    TEXT            -- 'image', 'template', vb.
content_id      TEXT            -- Iliskili kayit ID'si (media.id, template.id)
status          TEXT            -- 'active', 'inactive'
created_at      TEXT

-- BU KOLONLAR YOK: product_id, priority, valid_from, valid_until, synced_at, updated_at
```

### product_renders Tablosu (Gercek Sema)

```sql
-- DIKKAT: device_id kolonu YOK, company_id + device_type ile filtrelenir
id                  TEXT PRIMARY KEY
company_id          TEXT NOT NULL
product_id          TEXT
template_id         TEXT
device_type         TEXT            -- 'esl', 'android_tv', vb.
locale              TEXT
file_path           TEXT            -- 'storage/renders/...' (output_path DEGIL)
file_size           INTEGER
product_version     TEXT
template_version    TEXT
render_hash         TEXT
status              TEXT            -- 'completed', 'pending', 'failed'
error_message       TEXT
created_at          TEXT
completed_at        TEXT

-- BU KOLONLAR YOK: device_id, output_path, updated_at
```

### device_commands Tablosu (Gercek Sema)

```sql
id              TEXT PRIMARY KEY
device_id       TEXT NOT NULL
command         TEXT            -- 'updatelabel', 'deviceRestart', 'clearspace', vb.
parameters      TEXT            -- JSON formatinda komut detaylari
status          TEXT            -- 'pending', 'sent', 'completed', 'failed'
priority        INTEGER DEFAULT 0
created_by      TEXT
executed_at     TEXT            -- Komut iletildiginde guncellenir (updated_at DEGIL)
result          TEXT
created_at      TEXT

-- BU KOLONLAR YOK: updated_at
```

### device_heartbeats Tablosu

```sql
id              TEXT PRIMARY KEY
device_id       TEXT NOT NULL
status          TEXT
current_item    TEXT
battery_level   INTEGER
signal_strength INTEGER
ip_address      TEXT
memory_usage    TEXT
cpu_usage       TEXT
storage_free    TEXT
temperature     TEXT
uptime          TEXT
errors          TEXT
metadata        TEXT            -- JSON (firmware, free_space, wifi_signal vb.)
created_at      TEXT
```

---

## 11. Localhost Test Sonuclari

### Test Ortami

- **Sunucu:** localhost/market-etiket-sistemi (XAMPP, PHP 8.x, SQLite)
- **Cihazlar:** 3x PavoDisplay PD1010-II (IP: .158, .159, .160)
- **Firma:** Omnex Default (`8c156035-782a-476a-90cf-a50c757b61fb`)
- **Tarih:** 2026-02-22

### Test Sonuclari (19/19 Basarili)

| # | Test | Sonuc | Detay |
|---|------|-------|-------|
| 1 | MQTT Ayarlari Kaydet | PASS | `mqtt_settings` tablosuna kayit olusturuldu |
| 2 | MQTT Ayarlari Oku | PASS | Sifre maskelendi (`mos***`), diger alanlar dogru |
| 3 | Baglanti Testi | PASS | `fsockopen` ile broker port testi |
| 4 | Register (mevcut cihaz .158) | PASS | `status: registered`, MQTT bilgileri donduruldu |
| 5 | Register (yeni cihaz) | PASS | `status: pending`, sync_code olusturuldu |
| 6 | DB Dogrulama | PASS | `communication_mode='mqtt'`, `mqtt_client_id` set edildi |
| 7 | Report/Heartbeat | PASS | `device_heartbeats` kaydi, `last_seen` guncellendi |
| 8 | Content Sorgu | PASS | `content_version`, `files`, `task` JSON dogru formatta |
| 9 | Hibrit: ping | PASS | `last_seen` timestamp kontrolu ile online/offline tespiti |
| 10 | Hibrit: device_info | PASS | Metadata cache'den cihaz bilgisi donduruldu |
| 11 | Hibrit: refresh (MQTT) | PASS | `device_commands` tablosuna `updatelabel` eklendi |
| 12 | Komut Teslimi (report ile) | PASS | Bekleyen komut report yaniti ile iletildi, `status='sent'` |
| 13 | Sign Dogrulama (gecerli) | PASS | Dogru sign ile istek basarili |
| 14 | Sign Dogrulama (gecersiz) | PASS | Yanlis sign ile 403 hatasi |
| 15 | Delta Update | PASS | Ayni `content_version` gonderilince `up_to_date: true` |
| 16 | Register .158 | PASS | `2051F54F500A` → registered |
| 17 | Register .159 | PASS | `2051F54F5059` → registered |
| 18 | Register .160 | PASS | `2051F54F507F` → registered |
| 19 | Temizlik | PASS | Test verileri temizlendi, cihazlar `http-server`'a donduruldu |

### Ornek Test Ciktilari

**Register (mevcut cihaz):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "status": "registered",
        "device_id": "e1e74f58-xxx",
        "mqtt_url": "mqtt://test-broker.local",
        "mqtt_port": 1883,
        "mqtt_topic": "omnex/esl/8c156035-xxx/2051F54F500A",
        "report_interval": 300,
        "content_url": "http://localhost/market-etiket-sistemi/api/esl/mqtt/content",
        "report_url": "http://localhost/market-etiket-sistemi/api/esl/mqtt/report"
    }
}
```

**Hibrit Mod - Refresh Komutu:**
```json
{
    "success": true,
    "data": {
        "status": "queued",
        "message": "Komut kuyruga eklendi (MQTT cihaz)",
        "command_id": "cmd-xxx",
        "queue_position": 1,
        "estimated_delivery": "Cihazin sonraki report cagrisinda (~5dk)"
    }
}
```

**Komut Teslimi (Report ile):**
```json
{
    "success": true,
    "data": {
        "STATE": "SUCCEED",
        "commands": [{
            "action": "updatelabel",
            "push_id": 1740000000,
            "clientid": "2051F54F500A"
        }],
        "commandCount": 1
    }
}
```

---

## 12. Bilinen Sorunlar ve Cozumler

### Gelistirme Sirasinda Karsilasilan ve Duzeltilen Sorunlar

| # | Sorun | Neden | Cozum |
|---|-------|-------|-------|
| 1 | `SITE_URL` tanimsiz | config.php'de `SITE_URL` yok, `APP_URL` var | `content.php`'de `SITE_URL` → `APP_URL` |
| 2 | Role case mismatch (403) | DB'de `SuperAdmin`/`Admin` (PascalCase), kod `superadmin` bekliyor | `strtolower($user['role'])` ile karsilastirma |
| 3 | `device_commands.updated_at` yok | Tablo `executed_at` kullaniyor | `publishCommand()` ve `getPendingCommands()` duzeltildi |
| 4 | `product_renders.output_path` yok | Kolon adi `file_path` | `content.php` SQL sorguları duzeltildi |
| 5 | `product_renders.device_id` yok | Tablo `company_id + device_type` ile filtrelenir | Content sorgusu `company_id` + `device_type` ile yapildi |
| 6 | `device_content_assignments` eksik kolonlar | Tabloda `product_id`, `priority`, `synced_at` yok | Sorgu sadece mevcut kolonlari kullaniyor |
| 7 | `fsockopen` PHP warning | `@` operatoru framework error handler ile calismaz | `set_error_handler()` / `restore_error_handler()` pattern |
| 8 | `templates.content` yok | Kolon adi `design_data` | Content endpoint templates JOIN kaldirild, `width`/`height` kullanildi |
| 9 | MQTT test baglantisi hep basarisiz | `settings.php` default `inactive`, `getSettings()` sadece active/testing dondurur | `settings.php` default `active` yapildi |
| 10 | `test-connection.php` "ayarlar bulunamadi" | `$mqttService->testConnection()` status-filtered `getSettings()` null donuyor | Direkt DB okuma + inline fsockopen (status filtresi yok) |
| 11 | MQTT sekmesi form elemanlari dar/bozuk | `<label class="toggle">` (CSS'de yok) + nested `grid grid-cols-2` icinde `form-grid` | `toggle-switch` sinifi + duz `form-group` yapi |
| 12 | Mevcut cihaz MQTT'ye guncellenemiyor | `_saveDevice()` sadece POST, IP cakismasinda 409 | IP/seri ile arama + Modal.confirm + PUT guncelleme akisi |

### PHP fsockopen Duzeltme Pattern

```php
// YANLIS: @ operatoru framework error handler'i engellemez
$conn = @fsockopen($host, $port, $errno, $errstr, 5);

// DOGRU: Gecici olarak warning'leri engelle
set_error_handler(function() {}, E_WARNING);
$conn = fsockopen($host, $port, $errno, $errstr, 5);
restore_error_handler();
```

### Role Case Duzeltme Pattern

```php
// YANLIS: DB'de PascalCase saklanir
if (!in_array($user['role'], ['superadmin', 'admin'])) { ... }

// DOGRU: strtolower ile karsilastir
if (!in_array(strtolower($user['role'] ?? ''), ['superadmin', 'admin'])) { ... }
```

### Content Endpoint SQL Sorgu Yapisi

`content.php` iki kaynaktan icerik arar:

1. **product_renders** (render edilmis gorseller):
   - `company_id` + `device_type` + `status='completed'` ile filtrelenir
   - `device_id` kolonu **yok** - firma + cihaz tipi bazinda filtreleme yapilir
   - Dosya yolu `file_path` kolonundan okunur

2. **device_content_assignments** + **media** (icerik atamalari):
   - Sadece `device_id` + `status='active'` ile filtrelenir
   - `content_type='image'` ise `media` tablosundan dosya bilgisi cekilir
   - Render yoksa bu fallback kullanilir

---

## 13. Sorun Giderme

### Cihaz Kayit Olmuyor

| Kontrol | Cozum |
|---------|-------|
| MQTT ayarlari yapildi mi? | Admin panelden `/api/esl/mqtt/settings` kontrol edin |
| AppID eslesiyor mu? | Cihaza gonderilen `appId` ile `mqtt_settings.app_id` ayni olmali |
| Sign basarisiz mi? | Gecici olarak `app_secret`'i bos birakin, sonra ayarlayin |
| Sunucu erisilebilir mi? | Cihaz WiFi'dan `content_server_url`'e HTTP erisebilmeli |

### Icerik Guncellenmiyor

| Kontrol | Cozum |
|---------|-------|
| Atama yapildi mi? | `device_content_assignments` tablosunda `status='active'` kayit olmali |
| Render tamamlandi mi? | `product_renders` tablosunda `status='completed'` ve dosya mevcut olmali |
| Delta update | Cihaz ayni `content_version` gonderiyorsa bos yanit doner â€” normal |
| Report geliyor mu? | `device_heartbeats` tablosunda son 5dk icinde kayit olmali |

### Komutlar Iletilmiyor

| Kontrol | Cozum |
|---------|-------|
| Komut kuyrukta mi? | `device_commands` tablosunda `status='pending'` kayit olmali |
| Cihaz report yapiyor mu? | `devices.last_seen` 5dk'dan eski ise cihaz cevrimdisi |
| Komut sent mi? | `status='sent'` ise komut iletildi, cihaz islemeli |
| `clientid` formati tutarli mi? | MQTT tarafinda ayiracsiz format kullanin (`2051F54F5059`). Sistem normalize eder ama cihaz BLE ayariyla da ayni formati kullanmak daha guvenlidir. |

### HTTP-SERVER Cihaza Gonderim Timeout

| Belirti | Teshis | Cozum |
|---------|--------|-------|
| `Failed to connect to <IP> port 80 ... Timeout was reached` | Cihaz IP'si agdan ulasilamiyor veya cihaz HTTP-SERVER modunda degil | Cihazin agda gorunur oldugunu dogrulayin (ping), HTTP-SERVER protokolunu ve port 80 erisimini kontrol edin, gerekirse cihaz IP/protokol ayarini BLE ile tekrar yazin |

### Bluetooth Kurulum Sorunlari

| Sorun | Cozum |
|-------|-------|
| Cihaz bulunamadi | Chrome kullanin, Bluetooth acik olmali, cihaz yakininda olmali |
| BLE baglanti hatasi | Cihazi yeniden baslatin, tarayiciyi yenileyin |
| MQTT ayarlari gonderilemiyor | Her komut arasi 300ms bekleme yeterli mi kontrol edin |
| Sunucu ayarlari yuklenemiyor | Admin panelden MQTT ayarlarinin onceden kaydedilmis olmasi gerekli |

### Ornek cURL Test Komutlari

```bash
# Register testi
curl -X POST http://localhost/market-etiket-sistemi/api/esl/mqtt/register \
  -H "Content-Type: application/json" \
  -d '{"clientId":"TEST123456","appId":"omnex_firma123","firmware":"V3.36"}'

# Report testi
curl -X POST http://localhost/market-etiket-sistemi/api/esl/mqtt/report \
  -H "Content-Type: application/json" \
  -d '{"clientId":"TEST123456","appId":"omnex_firma123","battery":85,"wifi_signal":-60}'

# Content testi
curl "http://localhost/market-etiket-sistemi/api/esl/mqtt/content?clientId=TEST123456&appId=omnex_firma123"

# Baglanti testi (admin JWT gerekli)
curl -X POST http://localhost/market-etiket-sistemi/api/esl/mqtt/test \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"broker_url":"mqtt.firma.com","broker_port":1883}'
```

---

## Dosya Haritasi

| Dosya | Tur | Aciklama |
|-------|-----|----------|
| `services/MqttBrokerService.php` | Servis | Sign, topic, credentials, command queue |
| `api/esl/mqtt/register.php` | API | Cihaz kayit (public) |
| `api/esl/mqtt/report.php` | API | Durum raporu + komut teslimi (public) |
| `api/esl/mqtt/content.php` | API | Icerik sorgu + delta update (public) |
| `api/esl/mqtt/settings.php` | API | Ayar okuma (admin) |
| `api/esl/mqtt/settings-update.php` | API | Ayar kaydetme (admin) |
| `api/esl/mqtt/test-connection.php` | API | Broker baglanti testi (admin) |
| `api/devices/control.php` | API | Hibrit mod yonlendirme |
| `api/index.php` | Route | MQTT route tanimlari |
| `database/migrations/096_esl_mqtt_support.sql` | Migration | DB sema degisiklikleri |
| `public/assets/js/services/BluetoothService.js` | Frontend | BLE MQTT komutlari |
| `public/assets/js/pages/devices/list/BluetoothWizard.js` | Frontend | MQTT wizard UI |
| `public/assets/js/pages/devices/DeviceList.js` | Frontend | Iletisim modu kolonu |
| `public/assets/js/pages/settings/IntegrationSettings.js` | Frontend | MQTT Broker ayarlar sekmesi UI + API cagrilari |
| `locales/tr/pages/devices.json` | i18n | Turkce ceviriler (wizard guncelleme dialoglari dahil) |
| `locales/en/pages/devices.json` | i18n | Ingilizce ceviriler (wizard guncelleme dialoglari dahil) |
| `locales/tr/pages/settings.json` | i18n | MQTT tab + form alanlari Turkce ceviriler (~50 anahtar) |
| `locales/en/pages/settings.json` | i18n | MQTT tab + form alanlari Ingilizce ceviriler (~50 anahtar) |
| `api/esl/mqtt/test-connection.php` | API | Broker baglanti testi â€” direkt DB + fsockopen (admin) |

---

## 14. Admin Panel: MQTT Ayarlar Sekmesi

### Genel Bakis

**Ayarlar → Entegrasyonlar** sayfasinda (`#/settings/integrations`) MQTT Broker sekmesi
eklenmistir. Sekme sirasi:

```
ESL  |  ERP  |  API  |  MQTT  |  Odeme
```

Bu sekme uzerinden MQTT broker ayarlari yapilandirilir, baglanti test edilir ve kaydedilir.

**Dosya:** `public/assets/js/pages/settings/IntegrationSettings.js` (Satir 1800-2102)

### Sekme UI Yapisi

Sekme iki karttan olusur:

#### Kart 1: MQTT Broker Ayarlari

Tum form alanlari `form-grid` (2 kolonlu CSS grid) icinde duz `form-group` olarak dizilir.

| Alan | Input Tipi | Varsayilan | DB Kolon | CSS Notu |
|------|-----------|-----------|----------|----------|
| Broker URL | text | `localhost` | `broker_url` | |
| Port | number | `1883` | `broker_port` | |
| TLS Kullan | toggle-switch | `false` | `use_tls` | `toggle-switch` sinifi (toggle DEGIL) |
| Saglayici | select | `mosquitto` | `provider` | mosquitto/emqx/hivemq/custom |
| Kullanici Adi | text | (bos) | `username` | |
| Sifre | password | (bos) | `password` | Backend `********` doner |
| Topic Prefix | text | `omnex/esl` | `topic_prefix` | |
| Durum | select | `active` | `status` | active/testing/inactive |
| App ID | text | (bos) | `app_id` | |
| App Secret | password | (bos) | `app_secret` | Backend `********` doner |
| Icerik Sunucu URL | text | `{origin}/api/esl/mqtt/content` | `content_server_url` | `full-width` sinifi |
| Rapor Sunucu URL | text | `{origin}/api/esl/mqtt/report` | `report_server_url` | `full-width` sinifi |

**TLS Toggle Davranisi:**
- TLS acildiginda port otomatik `8883`'e gecer
- TLS kapatildiginda port otomatik `1883`'e doner
- Kullanici portu elle degistirmisse otomatik gecis uygulanmaz

**Sifre/Secret Maskeleme:**
- Backend `settings.php` sifre ve app_secret degerlerini `********` olarak doner
- Frontend kaydederken `********` veya bos string gonderilirse → backend mevcut degeri korur
- Sadece yeni deger girildiginde guncelleme yapilir

#### Kart 2: MQTT Bilgi

- 4 adimlik kurulum rehberi (badge numaralari ile)
- Son baglanti zamani (`last_connected` timestamp)

### Butonlar ve Akislari

#### Baglanti Testi
```
Kullanici "Baglantıyi Test Et" tiklar
  â”‚
  â”œâ”€ Buton disabled + spinner gosterilir
  â”œâ”€ POST /api/esl/mqtt/test (bos body → kayitli ayarlardan test)
  â”‚
  â”œâ”€ IF response.success && response.data.connected:
  â”‚    â”œâ”€ Yesil alert: "Baglanti basarili (XX ms)"
  â”‚    â”œâ”€ Toast.success
  â”‚    â””â”€ Badge → "Yapilandirildi" (yesil)
  â”‚
  â””â”€ ELSE:
       â”œâ”€ Kirmizi alert: hata mesaji
       â””â”€ Toast.error
```

#### Kaydet
```
Kullanici "Kaydet" tiklar
  â”‚
  â”œâ”€ Buton disabled
  â”œâ”€ _getMqttFormData() ile tum form degerleri toplanir
  â”œâ”€ PUT /api/esl/mqtt/settings
  â”‚
  â”œâ”€ IF response.success:
  â”‚    â”œâ”€ Toast.success("MQTT ayarlari kaydedildi")
  â”‚    â””â”€ Badge guncellenir
  â”‚
  â””â”€ ELSE:
       â””â”€ Toast.error(hata mesaji)
```

### Status Badge

| Durum | Badge | Renk |
|-------|-------|------|
| Ayar yok / yukleniyor | "Yukleniyor..." | Gri (secondary) |
| active veya testing | "Yapilandirildi" | Yesil (success) |
| inactive veya hata | "Yapilandirilmadi" | Sari (warning) |
| Test basarili | "Yapilandirildi" | Yesil (success) |

### CSS Onemli Notlari

```
DOGRU:                              YANLIS:
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
<div class="form-grid">             <div class="form-grid">
  <div class="form-group">            <div class="grid grid-cols-2 gap-4">
    <label>...</label>                   <div class="form-group">
    <input>                                <label>...</label>
  </div>                                   <input>
  <div class="form-group">              </div>
    ...                                </div>
  </div>                             </div>
</div>

form-grid zaten 2 kolonlu grid.     Nested grid form-group'lari daraldir.
form-group'lar dogrudan icine girer. Sonuc: cok dar input'lar.
```

```
DOGRU:                              YANLIS:
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
<label class="toggle-switch">       <label class="toggle">
  <input type="checkbox">             <input type="checkbox">
  <span class="toggle-slider">        <span class="toggle-slider">
  </span>                             </span>
</label>                            </label>

CSS'de .toggle-switch tanimli.      .toggle sinifi CSS'de yok,
                                    switch gorunmez.
```

### i18n Anahtarlari

Ceviriler `locales/{lang}/pages/settings.json` icinde:

```
integrations.tabs.mqtt              → "MQTT Broker"
integrations.mqtt.title             → "MQTT Broker Ayarlari"
integrations.mqtt.description       → Aciklama metni
integrations.mqtt.brokerUrl         → "Broker URL"
integrations.mqtt.brokerPort        → "Port"
integrations.mqtt.useTls            → "TLS/SSL Kullan"
integrations.mqtt.useTlsHelp       → Toggle yardim metni
integrations.mqtt.provider          → "Saglayici"
integrations.mqtt.username          → "Kullanici Adi"
integrations.mqtt.password          → "Sifre"
integrations.mqtt.topicPrefix       → "Topic Prefix"
integrations.mqtt.status            → "Durum"
integrations.mqtt.appId             → "App ID"
integrations.mqtt.appSecret         → "App Secret"
integrations.mqtt.contentServerUrl  → "Icerik Sunucu URL"
integrations.mqtt.reportServerUrl   → "Rapor Sunucu URL"
integrations.mqtt.testConnection    → "Baglantıyı Test Et"
integrations.mqtt.save              → "Kaydet"
integrations.mqtt.testing           → "Test ediliyor..."
integrations.mqtt.connectionSuccess → "Baglanti basarili ({time} ms)"
integrations.mqtt.connectionFailed  → "Baglanti basarisiz"
integrations.mqtt.saved             → "MQTT ayarlari kaydedildi"
integrations.mqtt.saveFailed        → "MQTT ayarlari kaydedilemedi"
integrations.mqtt.configured        → "Yapilandirildi"
integrations.mqtt.notConfigured     → "Yapilandirilmadi"
integrations.mqtt.loading           → "Yukleniyor..."
integrations.mqtt.infoTitle         → "MQTT Hakkinda"
integrations.mqtt.infoText          → Bilgi metni
integrations.mqtt.setupSteps        → "Kurulum Adimlari"
integrations.mqtt.step1-4           → Kurulum adimlari aciklamalari
integrations.mqtt.lastConnected     → "Son Baglanti"
integrations.mqtt.never             → "Henuz baglanti yok"
integrations.mqtt.statuses.*        → Durum secenekleri
integrations.mqtt.providers.*       → Saglayici secenekleri
integrations.mqtt.*Placeholder      → Input placeholder'lari
```

---

## 15. Bluetooth Wizard: Cihaz Guncelleme Akisi

### Problem

Bluetooth ile yeni bir cihaz eklenirken, ayni IP adresine veya ayni seri numarasina
sahip bir cihaz zaten kayitliysa `POST /api/devices` 409 (Conflict) hatasi donuyordu.
Bu durum ozellikle HTTP-SERVER modundan MQTT moduna gecis yapmak isteyen mevcut
cihazlarda sorun olusturuyordu.

### Cozum: Guncelleme-Once-Olustur Akisi

**Dosya:** `public/assets/js/pages/devices/list/BluetoothWizard.js` → `_saveDevice()`

```
_saveDevice(data) cagirilir
  â”‚
  â”œâ”€ 1. IP ile mevcut cihaz ara
  â”‚     GET /devices?search={ip_address}
  â”‚     → Sonuclarda IP eslesen cihaz var mi?
  â”‚
  â”œâ”€ 2. IP ile bulunamazsa → Seri no ile ara
  â”‚     _findExistingDeviceBySerial(serial_number)
  â”‚     → Normalize MAC karsilastirmasi ile ara
  â”‚
  â”œâ”€ IF mevcut cihaz bulundu:
  â”‚  â”‚
  â”‚  â”œâ”€ Modal.confirm goster:
  â”‚  â”‚   "Bu IP/seri numarasina sahip '{cihaz_adi}' adli bir cihaz zaten kayitli.
  â”‚  â”‚    Mevcut cihazi guncellemek ister misiniz?"
  â”‚  â”‚   [Guncelle]  [Iptal]
  â”‚  â”‚
  â”‚  â”œâ”€ "Guncelle" tiklanirsa:
  â”‚  â”‚   PUT /api/devices/{existing_id} (tum yeni verilerle)
  â”‚  â”‚   → communication_mode='mqtt' olarak guncellenir
  â”‚  â”‚   → Toast.success("Cihaz guncellendi")
  â”‚  â”‚
  â”‚  â””â”€ "Iptal" tiklanirsa:
  â”‚       → Islem durdurulur
  â”‚
  â””â”€ IF mevcut cihaz bulunamadi:
       POST /api/devices (yeni cihaz olustur)
       → communication_mode: data.communication_mode
       → mqtt_client_id: data.mqtt_client_id
       → mqtt_topic: data.mqtt_topic
```

### MAC Adresi Normalizasyonu

`_findExistingDeviceBySerial()` metodu MAC adreslerini karsilastirirken
ayraclari (`:`, `-`, `.`) kaldirir:

```javascript
// Ornek: "20:51:F5:4F:50:0A" → "2051F54F500A"
const normalize = (s) => s?.toUpperCase().replace(/[:\-.]/g, '');

// Karsilastirma
normalize(device.device_id) === normalize(serial)  ||
normalize(device.serial_number) === normalize(serial) ||
normalize(device.mqtt_client_id) === normalize(serial)
```

Bu sayede firmware'in gonderdigi `2051F54F500A` formatindaki MAC ile
DB'deki `20:51:F5:4F:50:0A` formatindaki kayit eslesir.

### i18n Anahtarlari

`locales/{lang}/pages/devices.json` → `bluetooth.wizard`:

```
deviceExists         → "Mevcut Cihaz Bulundu" / "Existing Device Found"
updateExistingDevice → "'{name}' cihazi zaten kayitli. Guncellemek ister misiniz?"
updateDevice         → "Guncelle" / "Update"
deviceUpdated        → "Cihaz basariyla guncellendi" / "Device updated successfully"
```

---

## 16. Mosquitto Kurulumu (Windows)

### Adim 1: Indirme ve Kurulum

1. https://mosquitto.org/download/ adresinden **Windows 64-bit** installer'i indirin
2. Installer'i calistirin:
   - Kurulum dizini: `C:\Program Files\mosquitto\`
   - **"Install as Windows Service"** secenegini isaretleyin
3. Kurulum tamamlaninca servis otomatik olusturulur (ama baslatilmaz)

### Adim 2: Konfigurasyon

**Dosya:** `C:\Program Files\mosquitto\mosquitto.conf`

Varsayilan konfigurasyon tamamen yorumlanmistir. LAN erisimi icin su satirlari
dosyanin **basina** ekleyin:

```conf
# ===== Omnex MQTT Broker Konfigurasyonu =====

# Tum arayuzlerden dinle (0.0.0.0 = LAN + localhost)
listener 1883

# Gelistirme icin anonim baglantiyi ac
# PRODUCTION'da false yapip password_file kullanin
allow_anonymous true

# Loglama
log_type all
log_dest file C:/Program Files/mosquitto/log/mosquitto.log
log_timestamp true
log_timestamp_format %Y-%m-%dT%H:%M:%S
```

> **NOT:** Varsayilan konfigurasyon (tum satirlar yorumlu) ile Mosquitto sadece
> `127.0.0.1:1883` uzerinden dinler. Ag uzerindeki ESL cihazlarinin broker'a
> baglanabilmesi icin `listener 1883` satirini acmaniz SART.

#### Production Konfigurasyonu (Onerilen)

```conf
listener 1883
allow_anonymous false
password_file C:/Program Files/mosquitto/passwd

# Sifre dosyasi olusturmak icin:
# mosquitto_passwd -c "C:\Program Files\mosquitto\passwd" omnex_user
```

### Adim 3: Windows Firewall Kurali

ESL cihazlarinin TCP 1883 portuna erisebilmesi icin:

```batch
netsh advfirewall firewall add rule name="Mosquitto MQTT" dir=in action=allow protocol=TCP localport=1883
```

### Adim 4: Servisi Baslat

```batch
:: Servisi baslat
net start mosquitto

:: Servisi durdur
net stop mosquitto

:: Servisi yeniden baslat
net stop mosquitto && net start mosquitto
```

Alternatif olarak `services.msc` (Windows Hizmetler) uzerinden de yonetilebilir.

### Adim 5: Test

Terminal 1 (subscriber):
```batch
"C:\Program Files\mosquitto\mosquitto_sub" -h localhost -t "omnex/esl/#" -v
```

Terminal 2 (publisher):
```batch
"C:\Program Files\mosquitto\mosquitto_pub" -h localhost -t "omnex/esl/test" -m "hello"
```

Terminal 1'de `omnex/esl/test hello` gorunmelidir.

### Adim 6: Omnex Admin Panelden Baglanti Testi

1. **Ayarlar → Entegrasyonlar → MQTT Broker** sekmesine gidin
2. Broker URL: `localhost` (veya PC'nin LAN IP adresi, orn: `192.168.1.50`)
3. Port: `1883`
4. **"Baglantıyı Test Et"** butonuna tiklayin
5. Yesil "Baglanti basarili" mesaji gorunmelidir

### Sorun Giderme

| Sorun | Cozum |
|-------|-------|
| `net start mosquitto` basarisiz | `mosquitto.conf` syntax hatasi kontrol edin. Log dosyasina bakin |
| Cihaz broker'a baglanamıyor | Firewall kurali eklendi mi? `listener 1883` (0.0.0.0) acik mi? |
| Port kullanilıyor hatasi | `netstat -an | findstr 1883` ile kullanan islemi bulun |
| "Baglanti basarisiz" (Admin panel) | `settings.php` default status `active` mi kontrol edin |
| Servis kendini kapatıyor | `mosquitto.conf`'da gecersiz satir var, log dosyasını inceleyin |

### Konfigurasyon Gecmisi

| Tarih | Degisiklik |
|-------|-----------|
| 2026-02-22 | Mosquitto kuruldu, varsayilan konfigurasyon (sadece localhost) |
| 2026-02-22 | `test-connection.php` status filtresi duzeltildi |
| 2026-02-22 | `settings.php` default status `inactive` → `active` |
