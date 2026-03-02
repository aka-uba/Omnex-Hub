# ESL Tablet – Elektronik Fiyat Etiketi API ve Bluetooth Protokolü – Tek Doküman

**Kaynak:** [ShowDoc – demo.esltag.cc](http://demo.esltag.cc:4999/web/#/5/30)  
**Yerel kopya:** `kutuphane/esl tablet/` (ShowDoc MHTML/HTML)  
**Derleme tarihi:** 2026-02-22  
**Bu dosya:** Tüm ESL tablet (PavoDisplay / elektronik etiket) dökümanlarının tek MD’de eksiksiz birleştirilmiş hâli.

---

## İçindekiler

1. [Döküman Tanıtımı](#1-döküman-tanıtımı)
2. [Arayüz Kuralları](#2-arayüz-kuralları)
3. [API Arayüzü (WIFI)](#3-api-arayüzü-wifi)
4. [Ekipman Kontrolü (Bluetooth)](#4-ekipman-kontrolü-bluetooth)
5. [PavoDisplay PD1010-II – Araştırma ve Strateji Raporu](#5-pavodisplay-pd1010-ii--araştırma-ve-strateji-raporu)
6. [Proje İçi Ek Dokümanlar](#6-proje-içi-ek-dokümanlar)

---

## 1. Döküman Tanıtımı

### Açıklama

Bu doküman, elektronik fiyat etiketi yönetim arka ucu arayüz protokolünü ve Bluetooth iletişimi üzerinden elektronik fiyat etiketi parametre ayarlama protokolünü tanıtır.

### Okuyucu Kitlesi

Elektronik fiyat etiketi yönetim sistemi ve Bluetooth ayar araçlarıyla ilgili: teknik mimar, Ar-Ge mühendisi, test mühendisi, sistem operasyon ve bakım mühendisi.

### Güncelleme Günlüğü (Özet)

| Tarih       | Değişiklik |
|------------|------------|
| 2025-6-20  | Bluetooth [Read configuration information]: ekran yüksekliği ve genişliği eklendi. HTTP-SERVER [Get device information]: ekran yüksekliği ve genişliği eklendi. |
| 2025-5-7   | MQTT kontrol komutları: Parlaklık ayarı ve Cihaz yeniden başlatma eklendi. |
| 2025-3-27  | Bluetooth: WPA2-Enterprise WiFi ağ yapılandırması. HTTP Get price tag details: **version** (Firmware version) parametresi eklendi. |
| 2025-3-6   | MQTT alınan mesaj parametresi 'Power Plan Control' action değeri `power-ctrl` → `power_ctrl` olarak değiştirildi. |
| 2025-1-19  | MQTT: Set time zone – timezone alanı UTC formatında (örn. Asia/Shanghai → UTC+08:00). MQTT: Arka ışık aç/kapat eklendi. |
| 2025-1-18  | Bluetooth iletişimi için güvenlik özellikleri eklendi. |
| 2024-12-13 | Bluetooth: Medya kaynaklarını temizle, Cihazı yeniden başlat. |
| 2024-12-10 | (Firmware 3.26+) HTTP-SERVER modunda firmware güncelleme arayüzü. |
| 2024-12-9  | (Firmware 3.26+) Bluetooth: Statik IP, UI düzeni (üst mesaj çubuğu, alt durum çubuğu, cihaz QR’ı göster/gizle). |

---

## 2. Arayüz Kuralları

### 2.1 Anlaşma Kuralları (Agreement Rules)

| Konu | Değer |
|------|--------|
| Veri formatı | Dönen veri JSON (application/json) |
| Karakter kodlaması | UTF-8 |
| İçerik tipi | x-www-form-urlencoded |
| İmza gereksinimi | MD5 |
| İmza algoritması | İstek verisi kontrol imzası gerektirir |
| Diğer | Sunucu yanıtında Content-Length header belirtilir |

### 2.2 Güvenlik Özellikleri (Safety specifications) – İmza Algoritması

1. Gönderilen/alınan tüm veriyi M kümesi olarak al; **boş olmayan** parametreleri parametre adına göre **ASCII (sözlük)** sırasına diz; `key1=value1&key2=value2…` biçiminde **stringA** oluştur.
2. Kurallar:
   - Parametre adı ASCII sırası küçükten büyüğe (lexicographic).
   - Parametre değeri boşsa imzaya dahil etme.
   - Parametre adı büyük/küçük harfe duyarlı.
   - Doğrulama/geri bildirimde iletilen **sign** parametresi imzaya katılmaz; üretilen imza, gelen **sign** ile karşılaştırılır.
3. **stringSignTemp** = stringA + **"&key=" + AppSecret** (key 32 byte).
4. **sign** = MD5(stringSignTemp); sonucu **tüm karakterler BÜYÜK HARF**.

**Örnek (resmi dokümandan):**  
AppID: `d114c07a-24ed-41b2-9cc3-58ae5bb9ace1_2303065600000005`  
AppSecret: `2303065600000006`

---

## 3. API Arayüzü (WIFI)

Cihazlar üç modda çalışabilir: **HTTP-SERVER** (cihaz sunucu, dosya push), **HTTP** (cihaz istemci, sunucudan çeker), **MQTT** (bulut push).

### 3.1 HTTP-SERVER (Mevcut Mod – Port 80)

| Endpoint | Method | İşlev |
|----------|--------|--------|
| `GET /Iotags` | GET | Cihaz bilgileri (model, firmware, depolama, ekran) |
| `POST /upload?file_path=xxx` | POST | Dosya yükleme (binary body, senkron) |
| `GET /check?file_path=xxx` | GET | Dosya varlık kontrolü (MD5 + boyut) |
| `GET /replay?task=xxx` | GET | Oynatma görevi tetikleme |
| `GET /control?action=clearspace` | GET | Depolama temizleme (**/clear** değil) |
| `POST /upgrade?file_path=files/upgrade/update.pkg` | POST | Firmware güncelleme (FW 3.26+) |

### 3.2 MQTT API

**Cihaz kaydı (Device Registration):**

- **URL:** `POST http://demo.esltag.cc/openapi/mqttregister` (veya kendi sunucunuz)
- **İstek gövdesi (x-www-form-urlencoded):**

| Parametre | Zorunlu | Tip | Açıklama |
|-----------|---------|-----|----------|
| appid | Evet | string | Hesap AppID |
| sn | Evet | string | Fiyat etiketi seri numarası |
| ts | Evet | long | 13 bit zaman damgası |
| sign | Evet | string | İmza algoritmasıyla hesaplanan imza |

**Yanıt örneği (Data):**

- `mqtthost`, `mqttport`, `username`, `password`, `client_id`, `topic`

**MQTT komutları (sunucudan cihaza):**

- `pushdeviceinfo`, `updatelabel`, `updatelabelbydata`, `power_ctrl`, `set-timezone`, `clear-res`, `clear-config`, `force-hide`, `backlight-on/off`, `backlight-set`, `deviceRestart`

### 3.3 HTTP (Pull) API

- Cihaz, yapılandırılmış URL’den fiyat etiketi detaylarını çeker (Get price tag details). Parametre: Firmware **version** (2025-3-27).

---

## 4. Ekipman Kontrolü (Bluetooth)

### 4.1 Kısa Açıklama

Elektronik fiyat etiketlerinin parametre yapılandırması için iletişim yöntemleri ve protokoller.

### 4.2 İletişim Yöntemi

- **Bluetooth BLE**
  - Yazma: `ble.characteristic.property.Write`
  - Okuma/yanıt: `ble.characteristic.property.Notify`

### 4.3 Desteklenen Platformlar

- iOS, Android, WeChat Mini Program, Alipay Mini Program, Alipay Web App

### 4.4 Bluetooth Komutları (Özet)

| Komut | Format |
|-------|--------|
| WiFi ayarla | `+SET-DEVICE:{"WIFI":{"ssid":"xxx","passwd":"xxx"}, "Token":""}` |
| WPA2-Enterprise | `+SET-DEVICE:{"WIFI_Ent":{"ssid":"xxx","identity":"xxx","passwd":"xxx"}, "Token":""}` |
| Statik IP | `+SET-DEVICE:{"network":{"static-ip":"x.x.x.x","gateway":"x.x.x.x","Netmask":"255.255.255.0"}, "Token":""}` |
| DHCP | `+SET-DEVICE:{"network":{"static-ip":"","gateway":"","Netmask":""}, "Token":""}` |
| Protokol değiştir | `+SET-DEVICE:{"Protocol":"HTTP-SERVER \| MQTT \| HTTP"}, "Token":""}` |
| AppID/Secret | `+SET-DEVICE:{"Application":{"AppID":"xxx","AppSecret":"xxx"}, "Token":""}` |
| MQTT sunucu | `+SET-DEVICE:{"mqtt-server":"http://xxx/openapi/mqttregister", "Token":""}` |
| HTTP Pull URL | `+SET-DEVICE:{"Remote-server":"http://xxx/openapi/easylabel", "Token":""}` |
| Rapor URL | `+SET-DEVICE:{"itemInfo-server":"http://xxx/openapi/reportinfo", "Token":""}` |
| Parlaklık/Ses | `+SET-DEVICE:{"Hardware":{"volume":100,"brightness":100}, "Token":""}` |
| UI gizle | `+SET-DEVICE:{"force-hide":{"BottomStatusBar":1,"SystemStatusPanel":1,"TopMessageBar":1,"DeviceQR":1}, "Token":""}` |
| Yeniden başlat | `+SET-DEVICE:{"reboot":1, "Token":""}` |
| Fabrika ayarları | `+SET-DEVICE:{"Restore":0, "Token":""}` |
| Medya temizle | `+SET-RES:{"action":"delete", "Token":""}` |
| Firmware güncelle | `+SET-DEVICE:{"upgrade":"http://xxx/firmware.pkg", "Token":""}` |
| Config oku | `+GET-DEVICE:{"types":"ip|mac|Protocol|app_version|...", "Token":""}` |

### 4.5 Bluetooth Güvenlik

- Admin şifresi (`passwd-root`) ve kullanıcı şifresi (`passwd-user`).
- Her komutta Token alanı ile doğrulama.
- Fabrika ayarları admin şifresi ile yapılırsa her iki şifre de silinir.

### 4.6 Referanslar

- [Bluetooth geliştirme paketi (üretici)](http://demo.esltag.cc:4999/server/index.php?s=/api/attachment/visitFile&sign=7ad1d04d64688782a60c0863311e70f0)
- [Android Bluetooth ayar uygulaması](http://demo.esltag.cc/update/app/pricetag/utility/android/release/pavo/PriceTagSetup-release-1.9.apk)
- [Android ayar uygulaması kaynak kodu](http://demo.esltag.cc/update/app/pricetag/utility/android/release/pavo/PriceTagSetup-androidCode.zip)

---

## 5. PavoDisplay PD1010-II – Araştırma ve Strateji Raporu

*Aşağıdaki bölüm `docs/ESL_TABLET_ARASTIRMA_RAPORU.md` dosyasının tam içeriğidir.*

---

# PavoDisplay PD1010-II ESL Tablet - Kapsamli Arastirma ve Strateji Raporu

**Tarih:** 2026-02-22  
**Versiyon:** 1.0

---

## 1. CIHAZ ENVANTER VE DONANIM BILGILERI

### Tespit Edilen Cihazlar

| # | IP Adresi | BT Adi | Client ID | Model | Firmware | Bos Alan | Toplam |
|---|-----------|--------|-----------|-------|----------|----------|--------|
| 1 | 192.168.1.158 | @B2A401A959 | 2051F54F500A | PD1010-II | V3.36 | 27MB | 32MB |
| 2 | 192.168.1.159 | @B2A301AB37 | 2051F54F5059 | PD1010-II | V3.36 | 1.4MB | 32MB |
| 3 | 192.168.1.160 | @B2A401A977 | 2051F54F507F | PD1010-II | V3.36 | 13MB | 32MB |

### Donanim Ozellikleri

| Ozellik | Deger |
|---------|-------|
| Uretici | Pavo Display Technology Co., Ltd (Shenzhen, Cin) |
| Model | PD1010-II |
| Ekran | 10.1" TFT-LCD, 800x1280 piksel (dikey) |
| Depolama | 32MB kullanilabilir alan |
| WiFi Modul | Earda Technologies (MAC: 20:51:F5), Realtek RTL8822 tabanli |
| Baglanti | WiFi 2.4GHz + Bluetooth BLE |
| Isletim Sistemi | Ozel Android/Linux (RTOS degil) |
| Mevcut Firmware | V3.36 |
| HTTP Port | 80 (tek acik port) |
| ADB | Kapali (5555/5556 portlari aktif olarak reddediliyor) |

### Cihazdaki Mevcut Dosyalar (Device 158)

| Dosya | Boyut | MD5 |
|-------|-------|-----|
| files/task/2051F54F500A.js | 0.5KB | 763A99322BDF930344896D6DBA15400A |
| files/task/2051F54F500A.jpg | 23.3KB | B6456E4DEB86412C88D8BF33AC2CA3C7 |
| files/ | dizin | - |
| files/task/ | dizin | - |

---

## 2. ILETISIM PROTOKOLLERI VE API

### 3 Calisma Modu

| Mod | Aciklama | Mevcut Kullanim |
|-----|----------|-----------------|
| **HTTP-SERVER** | Cihaz HTTP sunucusu olarak calisir. Istemci (bizim sistem) dosyalari push eder | **MEVCUT MOD** |
| **HTTP** | Cihaz istemci olarak sunucudan veri ceker (poll) | Kullanilmiyor |
| **MQTT** | Pub/Sub modeli, bulut sunucusu push yapar | **GATEWAY OLMAYAN LOKASYONLAR ICIN COZUM** |

### HTTP-SERVER API (Mevcut Mod - Port 80)

| Endpoint | Method | Islev |
|----------|--------|-------|
| `GET /Iotags` | GET | Cihaz bilgileri (model, firmware, depolama, ekran) |
| `POST /upload?file_path=xxx` | POST | Dosya yukleme (binary body, SENKRON olmali) |
| `GET /check?file_path=xxx` | GET | Dosya varlik kontrolu (MD5 + boyut doner) |
| `GET /replay?task=xxx` | GET | Oynatma gorevi tetikleme |
| `GET /control?action=clearspace` | GET | Depolama temizleme |
| `POST /upgrade?file_path=files/upgrade/update.pkg` | POST | Firmware guncelleme (FW 3.26+) |

**Onemli:** `/clear` degil `/control?action=clearspace` kullanilmali!

### MQTT API (Uzak Lokasyonlar Icin)

| Endpoint | Islev |
|----------|-------|
| `POST /openapi/mqttregister` | MQTT baglanti bilgilerini al |
| `POST /openapi/reportinfo` | Cihaz durum raporu |
| `GET /openapi/easylabel` | Etiket icerigini cek |

### MQTT Komutlari (Sunucudan Cihaza Push)

| Action | Aciklama |
|--------|----------|
| `pushdeviceinfo` | Cihaz bilgisi raporla |
| `updatelabel` | Etiket sync tetikle (cihaz HTTP ile ceker) |
| `updatelabelbydata` | Etiket verisini dogrudan push et |
| `power_ctrl` | Acma/kapama zamanlama |
| `set-timezone` | Saat dilimi ayarla |
| `clear-res` | Kaynaklari temizle |
| `clear-config` | Fabrika ayarlarina don |
| `force-hide` | UI panellerini goster/gizle |
| `backlight-on/off` | Arka isigi ac/kapat |
| `backlight-set` | Parlaklik ayarla (0-100) |
| `deviceRestart` | Cihazi yeniden baslat |

### Bluetooth BLE Komutlari

*(Yukarıda “Ekipman Kontrolü (Bluetooth)” bölümünde aynı tablo verildi.)*

### Guvenlik

**Imza Algoritmasi:**  
1. Parametreleri ASCII sirasina gore sirala  
2. `key1=value1&key2=value2...` seklinde birlestir (`stringA`)  
3. `stringSignTemp = stringA + "&key=" + AppSecret`  
4. `sign = MD5(stringSignTemp).toUpperCase()`

**Bluetooth Sifre Sistemi:**  
Admin sifresi (`passwd-root`) ve Kullanici sifresi (`passwd-user`); Token ile her komutta dogrulama; fabrika ayarlari admin ile yapilirsa her iki sifre de silinir.

---

## 3. FIRMWARE DEGISTIRME VE GUNCELLEME

### Firmware Guncelleme Yontemleri

| Yontem | Detay | Gereksinim |
|--------|-------|------------|
| HTTP-SERVER | `POST /upgrade?file_path=files/upgrade/update.pkg` (binary body) | FW 3.26+ |
| Bluetooth OTA | `+SET-DEVICE:{"upgrade":"http://url/firmware.pkg", "Token":""}` | Her versiyon |
| HTTP Pull | Sunucu yaniti `Upgrade` alani icerirse otomatik guncelleme | HTTP modu |
| MQTT Push | Henuz dokumante edilmemis ama muhtemelen destekleniyor | MQTT modu |

### Firmware Degistirme Degerlendirmesi

**SORU: Firmware degistirebilir miyiz?**

| Kriter | Durum | Aciklama |
|--------|-------|----------|
| Guncelleme mekanizmasi | VAR | `/upgrade` endpoint ve BLE OTA mevcut |
| Firmware formati | `.pkg` | Ozel paketlenmis format, yapisi bilinmiyor |
| Imzalama/Dogrulama | MUHTEMEL | `libCheckDevicePavo.so` AES-128-CBC sifreleme iceriyor |
| Kaynak kodu | YOK | Uretici kaynak kodu paylasmaz |
| SDK | YOK | Halka acik SDK bulunmuyor |
| Geri donme riski | YUKSEK | Yanlis firmware cihazi kalici olarak bozabilir (brick) |

**Sonuc:** Firmware degistirmek **teknik olarak mumkun** (endpoint var) ama **pratik olarak cok zor ve riskli**. Uretici ile isbirligi olmadan ozel firmware gelistirmek icin: .pkg formatinin reverse-engineer edilmesi, AES anahtarlarinin cikarilmasi, SoC ve boot surecinin anlasilmasi, UART/JTAG erisimi icin fiziksel mudahale gerekir.

**ONERI:** Firmware degistirmek yerine, mevcut 3 calisma modunu kullanarak yazilimsal esneklik saglamak **cok daha mantikli ve guvenli**.

---

## 4. ESNEKLIK STRATEJISI: GATEWAY OLMAYAN LOKASYONLAR

### Problem

HTTP-SERVER modunda cihazlar lokal IP uzerinden HTTP sunucusu calistiriyor; gateway/PC olmayan lokasyonlarda bu model calismiyor.

### Cozum: MQTT Modu

Cihazlar internete baglanir, bulut MQTT broker’ina abone olur; sunucu MQTT uzerinden komut ve icerik gonderir.

```
MEVCUT MODEL (HTTP-SERVER):
[Omnex Sunucu] --HTTP--> [Lokal Gateway PC] --HTTP--> [ESL Cihaz @ 192.168.x.x]

ONERILEN MODEL (MQTT):
[Omnex Sunucu] --MQTT--> [MQTT Broker (Cloud)] --MQTT--> [ESL Cihaz @ herhangi ag]
```

### MQTT Gecis Adim Plani

**Adim 1: Cihaz Yapilandirma (Bluetooth ile, tek seferlik)**  
Protokol MQTT, mqtt-server, Remote-server, itemInfo-server, Application (AppID/AppSecret) ayarlari.

**Adim 2: Omnex Backend MQTT Entegrasyonu**  
`POST /api/esl/mqtt/register`, `POST /api/esl/report`, `GET /api/esl/content`.

**Adim 3: MQTT Broker Secimi**  
Kendi broker (Mosquitto), bulut (AWS IoT, Azure IoT Hub), veya PavoDisplay demo sunucu.

### Hibrit Model (Onerilen)

- Lokasyon 1 – Gateway PC var: HTTP-SERVER (mevcut yapi).
- Lokasyon 2 – Gateway yok, internet var: MQTT modu.
- Lokasyon 3 – Gateway yok, sinirli internet: HTTP pull modu.

---

## 5. SIGNAGE TARZINDA ESITLEME (SYNC) MODELI

PWA Player Sync ile ESL MQTT karsilastirmasi: kayit (Sync code vs MQTT register), icerik push (WebSocket/polling vs MQTT push), icerik cekme (fetch vs HTTP pull), offline (IndexedDB vs cihaz depolama), heartbeat vs reportinfo, komut (device_commands vs MQTT action).

ESL MQTT sync akisi: Cihaz kayit (mqttregister) → MQTT’e baglan → Icerik (updatelabelbydata / updatelabel) → Durum (reportinfo) → Uzaktan kontrol (backlight-set, deviceRestart, power_ctrl).

---

## 6. MEVCUT GATEWAY KODUNDA DUZELTILMESI GEREKEN NOKTALAR

| Konu | Mevcut Kod | Dokumantasyon | Oneri |
|------|-----------|---------------|-------|
| Depolama temizleme | `/clear` | `/control?action=clearspace` | Duzeltilmeli |
| Sign hesaplama | `md5(appId + timestamp + appSecret)` | Sorted params + `&key=AppSecret` MD5 uppercase | Kontrol edilmeli |
| Upload metodu | Bazi yerlerde GET + body | POST + binary body | POST olmali |
| Replay parametresi | `?Task=xxx` | `?task=xxx` | Buyuk/kucuk harf fark yaratabilir |

Production’da sign zorunlu hale getirilmeli.

---

## 7. SONUC VE ONERILER

### Kisa Vadeli

1. MQTT entegrasyonu (gateway olmayan lokasyonlar).
2. Bluetooth yapilandirma araci (Web Bluetooth API).
3. `/control?action=clearspace` duzeltmesi.
4. Sign mekanizmasini production’da etkinlestir.

### Orta Vadeli

5. Hibrit mod destegi (HTTP-SERVER + MQTT).
6. MQTT broker kurulumu.
7. Firmware guncelleme yonetimi.
8. Power scheduling (MQTT).

### Uzun Vadeli

9. Firmware ozellistirme arastirmasi (uretici ile gorusme).
10. LVBIN format destegi.
11. OTA firmware dagitim sistemi.

### Firmware Degistirme Cevabi

Kisa: Teknik olarak mumkun, pratik olarak zor, riskli ve gereksiz. Mevcut firmware 3 iletisim modu, Bluetooth, UI kontrolu, parlaklik/ses, power scheduling, OTA destegi ile yeterli esneklik sagliyor.

---

## EKLER

### A. PriceTag APK Analizi

Paket: com.pricetag.utility.neutral, Versiyon 1.1.7, Min SDK 21, Target SDK 33, 78.6MB. Native: libCheckDevicePavo.so (AES-128-CBC), FFmpeg, libscannative. DB: LitePal ORM. HMS: Huawei ML Kit, AGConnect, ScanKit.

### B. Bilinen Icerik Formatlari

JPG (800x1280), MP4 (720p), LVBIN (carousel), JSON (.js gorev yapilandirma).

### C. Dosya Konumlari (Cihaz)

`files/task/{clientId}.jpg`, `files/task/{clientId}.js`, `files/task/{clientId}_0.mp4`, `files/upgrade/update.pkg`.

---

## 6. Proje İçi Ek Dokümanlar

Bu bölüm, aynı projede ESL/PavoDisplay ile ilgili diğer dokümanlara kısa referanstır. Detay için ilgili dosyalara bakın.

| Dosya | İçerik özeti |
|-------|----------------|
| `docs/PAVODISPLAY_NETWORK_CONFIG.md` | ADB kullanmadan ağ yapılandırması: hafif TCP ping, heartbeat cron, Bluetooth ile sabit IP/DHCP/WiFi, `/api/devices/:id/network-config`, BluetoothService.js kullanımı. |
| `docs/PAVODISPLAY_ADB_INTEGRATION.md` | ADB bridge servisi önerisi, online durum iyileştirmeleri, timeout azaltma, heartbeat, disk boyutu gösterimi, hibrit HTTP+ADB yaklaşımı. |
| `docs/GATEWAY_DEVICE_MONITORING.md` | Gateway tabanlı cihaz izleme: 5 sn heartbeat, cihaz keşfi, hafif TCP ping, gateway_devices tablosu, `POST /api/gateway/heartbeat`. |

---

**Döküman sonu.**  
Web sürümü: [http://demo.esltag.cc:4999/web/#/5/30](http://demo.esltag.cc:4999/web/#/5/30)
