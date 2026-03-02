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

Cihazlar 3 farkli modda calisabilir:

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

| Komut | Format |
|-------|--------|
| WiFi Ayarla | `+SET-DEVICE:{"WIFI":{"ssid":"xxx","passwd":"xxx"}, "Token":""}` |
| WPA2-Enterprise | `+SET-DEVICE:{"WIFI_Ent":{"ssid":"xxx","identity":"xxx","passwd":"xxx"}, "Token":""}` |
| Statik IP | `+SET-DEVICE:{"network":{"static-ip":"x.x.x.x","gateway":"x.x.x.x","Netmask":"255.255.255.0"}, "Token":""}` |
| DHCP | `+SET-DEVICE:{"network":{"static-ip":"","gateway":"","Netmask":""}, "Token":""}` |
| Protokol Degistir | `+SET-DEVICE:{"Protocol":"HTTP-SERVER \| MQTT \| HTTP"}, "Token":""}` |
| AppID/Secret | `+SET-DEVICE:{"Application":{"AppID":"xxx","AppSecret":"xxx"}, "Token":""}` |
| MQTT Sunucu | `+SET-DEVICE:{"mqtt-server":"http://xxx/openapi/mqttregister", "Token":""}` |
| HTTP Pull URL | `+SET-DEVICE:{"Remote-server":"http://xxx/openapi/easylabel", "Token":""}` |
| Rapor URL | `+SET-DEVICE:{"itemInfo-server":"http://xxx/openapi/reportinfo", "Token":""}` |
| Parlaklik/Ses | `+SET-DEVICE:{"Hardware":{"volume":100,"brightness":100}, "Token":""}` |
| UI Gizle | `+SET-DEVICE:{"force-hide":{"BottomStatusBar":1,"SystemStatusPanel":1,"TopMessageBar":1,"DeviceQR":1}, "Token":""}` |
| Yeniden Baslat | `+SET-DEVICE:{"reboot":1, "Token":""}` |
| Fabrika Ayarlari | `+SET-DEVICE:{"Restore":0, "Token":""}` |
| Medya Temizle | `+SET-RES:{"action":"delete", "Token":""}` |
| Firmware Guncelle | `+SET-DEVICE:{"upgrade":"http://xxx/firmware.pkg", "Token":""}` |
| Config Oku | `+GET-DEVICE:{"types":"ip\|mac\|Protocol\|app_version\|...", "Token":""}` |

### Guvenlik

**Imza Algoritmasi:**
1. Parametreleri ASCII sirasina gore sirala
2. `key1=value1&key2=value2...` seklinde birlestir (`stringA`)
3. `stringSignTemp = stringA + "&key=" + AppSecret`
4. `sign = MD5(stringSignTemp).toUpperCase()`

**Bluetooth Sifre Sistemi:**
- Admin sifresi (`passwd-root`) ve Kullanici sifresi (`passwd-user`)
- Token alani ile her komutta dogrulama
- Fabrika ayarlari: Admin sifresi ile yapilirsa her iki sifre de silinir

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

**Sonuc:** Firmware degistirmek **teknik olarak mumkun** (endpoint var) ama **pratik olarak cok zor ve riskli**. Uretici ile isbirligi olmadan ozel firmware gelistirmek icin:
1. `.pkg` dosya formatinin reverse-engineer edilmesi gerekir
2. AES sifreleme anahtarlarinin cikarilmasi gerekir
3. Cihazin SoC'sinin ve boot sureci nin anlasilmasi gerekir
4. UART/JTAG erisimi icin fiziksel mudahale gerekir

**ONERI:** Firmware degistirmek yerine, mevcut 3 calisma modunu kullanarak yazilimsal esneklik saglamak **cok daha mantikli ve guvenli**.

---

## 4. ESNEKLIK STRATEJISI: GATEWAY OLMAYAN LOKASYONLAR

### Problem
PavoDisplay cihazlari HTTP-SERVER modunda calisiyor. Bu modda cihazlar lokal IP uzerinden HTTP sunucusu calistiriyor ve bir "gateway" (bizim sunucu veya PC) dosyalari dogrudan cihaza push ediyor. **Lokal gateway/PC olmayan lokasyonlarda bu model calismiyor.**

### Cozum: MQTT Modu

**MQTT modu tam olarak bu sorunu cozer!** Cihazlar internete baglanir ve bulut MQTT broker'ina abone olur. Sunucu, MQTT uzerinden cihazlara komut ve icerik gonderir.

```
MEVCUT MODEL (HTTP-SERVER):
[Omnex Sunucu] --HTTP--> [Lokal Gateway PC] --HTTP--> [ESL Cihaz @ 192.168.x.x]
                                                       (Lokal ag gerekli!)

ONERILEN MODEL (MQTT):
[Omnex Sunucu] --MQTT--> [MQTT Broker (Cloud)] --MQTT--> [ESL Cihaz @ herhangi ag]
                                                          (Internet yeterli!)
```

### MQTT Gecis Adim Plani

**Adim 1: Cihaz Yapilandirma (Bluetooth ile, tek seferlik)**

```
// 1. Protokolu MQTT olarak degistir
+SET-DEVICE:{"Protocol":"MQTT", "Token":""}

// 2. MQTT kayit sunucusunu ayarla
+SET-DEVICE:{"mqtt-server":"https://omnex.example.com/api/esl/mqtt/register", "Token":""}

// 3. HTTP pull sunucusunu ayarla (cihaz icerik cekecek)
+SET-DEVICE:{"Remote-server":"https://omnex.example.com/api/esl/content", "Token":""}

// 4. Rapor sunucusunu ayarla
+SET-DEVICE:{"itemInfo-server":"https://omnex.example.com/api/esl/report", "Token":""}

// 5. AppID ve AppSecret ayarla
+SET-DEVICE:{"Application":{"AppID":"omnex_xxx","AppSecret":"xxx"}, "Token":""}
```

**Adim 2: Omnex Backend MQTT Entegrasyonu**

Omnex sunucusuna 3 yeni API endpoint eklenmeli:

| Endpoint | Islev |
|----------|-------|
| `POST /api/esl/mqtt/register` | MQTT broker bilgilerini don |
| `POST /api/esl/report` | Cihaz durum raporunu al |
| `GET /api/esl/content` | Cihaz icin icerik/gorev don |

**Adim 3: MQTT Broker Secimi**

| Secenek | Avantaj | Dezavantaj |
|---------|---------|------------|
| **Kendi MQTT Broker** (Mosquitto) | Tam kontrol, ucretsiz | Yonetim yukudu |
| **Bulut MQTT** (AWS IoT, Azure IoT Hub) | Olceklenebilir, guvenilir | Maliyet |
| **PavoDisplay Demo Sunucu** (demo.esltag.cc) | Hazir altyapi | Bagimsizlik yok, guvenilirlik? |

### Hibrit Model (Onerilen)

```
LOKASYON TIPI 1 - Gateway PC mevcut:
  -> HTTP-SERVER modu (mevcut yapi, degisiklik yok)
  -> Dusuk gecikme, anlik guncelleme

LOKASYON TIPI 2 - Gateway PC yok, internet var:
  -> MQTT modu
  -> Cihaz internete baglanir, sunucu MQTT ile push yapar
  -> Gecikme biraz daha fazla ama tamamen fonksiyonel

LOKASYON TIPI 3 - Gateway PC yok, sinirli internet:
  -> HTTP pull modu
  -> Cihaz periyodik olarak sunucudan guncelleme ceker
  -> En az bant genisligi kullanan model
```

---

## 5. SIGNAGE TARZINDA ESITLEME (SYNC) MODELI

Kullanicinin istegi: "Signage cihazlari gibi esitleyerek gondermek"

### PWA Player Sync Modeli vs ESL Sync Modeli Karsilastirma

| Ozellik | PWA Player (Mevcut) | ESL MQTT (Onerilen) |
|---------|---------------------|---------------------|
| Kayit | Sync code ile | MQTT register ile |
| Icerik Push | WebSocket/polling | MQTT push |
| Icerik Cekme | fetch API | HTTP pull |
| Offline | IndexedDB cache | Cihaz dahili depolama (32MB) |
| Heartbeat | POST /heartbeat | reportinfo API |
| Komut | device_commands tablo | MQTT action mesajlari |

### ESL Icin Sync Akisi (MQTT Mod)

```
1. CIHAZ KAYIT (Tek seferlik)
   Cihaz -> POST /openapi/mqttregister -> MQTT bilgilerini al
   Cihaz -> MQTT broker'a baglan ve topic'e abone ol

2. ICERIK GONDERIMI
   Omnex -> MQTT push {"action":"updatelabelbydata", "Data":{...}} -> Cihaz
   VEYA
   Omnex -> MQTT push {"action":"updatelabel"} -> Cihaz HTTP ile icerigi ceker

3. DURUM TAKIBI
   Cihaz -> POST /openapi/reportinfo -> Omnex (version, push_id, durum)

4. UZAKTAN KONTROL
   Omnex -> MQTT push {"action":"backlight-set", "backlight":50} -> Cihaz
   Omnex -> MQTT push {"action":"deviceRestart"} -> Cihaz
   Omnex -> MQTT push {"action":"power_ctrl", "power-on":[...]} -> Cihaz
```

---

## 6. MEVCUT GATEWAY KODUNDA DUZELTILMESI GEREKEN NOKTALAR

Dokumantasyonu inceledikten sonra `PavoDisplayGateway.php`'de su farklar goruldu:

| Konu | Mevcut Kod | Dokumantasyon | Oneri |
|------|-----------|---------------|-------|
| Depolama temizleme | `/clear` endpoint | `/control?action=clearspace` | Duzeltilmeli |
| Sign hesaplama | `md5(appId + timestamp + appSecret)` | Sorted params + `&key=AppSecret` MD5 uppercase | Kontrol edilmeli |
| Upload metodu | Bazi yerlerde GET + body | POST + binary body | POST olmali |
| Replay parametresi | `?Task=xxx` (buyuk T) | `?task=xxx` (kucuk t) | Buyuk/kucuk harf fark yaratabilir |

**Not:** Mevcut kodumuz sign olmadan da calisiyor cunku cihazlarda AppID/AppSecret ayarlanmamis. Production'da guvenlik icin sign zorunlu hale getirilmeli.

---

## 7. SONUC VE ONERILER

### Kisa Vadeli (Hemen Uygulanabilir)

1. **MQTT entegrasyonu gelistir** - Gateway PC olmayan lokasyonlar icin
2. **Bluetooth yapilandirma araci** - Web Bluetooth API ile cihaz setup sayfasi (mevcut BluetoothService.js uzerine)
3. **`/control?action=clearspace`** duzeltmesi yapilmali
4. **Sign mekanizmasini** production'da etkinlestir

### Orta Vadeli

5. **Hibrit mod destegi** - Ayni firma icerisinde HTTP-SERVER + MQTT cihazlarin birlikte yonetimi
6. **MQTT broker kurulumu** - Mosquitto veya AWS IoT Core
7. **Firmware guncelleme yonetimi** - Admin panelden toplu firmware guncelleme
8. **Power scheduling** - MQTT ile calisma zamanlari belirle

### Uzun Vadeli

9. **Firmware ozellistirme arastirmasi** - Uretici ile gorusme
10. **LVBIN format destegi** - Media carousel icin gorsel-video karisik oynatma
11. **OTA firmware dagitim sistemi** - Merkezi firmware yonetimi

### Firmware Degistirme Sorusu Cevabi

**Kisa cevap:** Firmware degistirmek teknik olarak mumkun ama pratik olarak cok zor, riskli ve gereksiz.

**Uzun cevap:** Cihazlar zaten 3 farkli iletisim modu, Bluetooth yapilandirma, UI kontrolu, parlaklik/ses ayari, power scheduling, firmware OTA guncelleme destekliyor. Bu ozellikler, istenen esnekligi **mevcut firmware uzerinde** sagliyor. MQTT modu ile cihazlar dunyanin her yerinden internet uzerinden yonetilebilir.

Firmware degistirmek ancak su durumlarda mantikli olabilir:
- Ozel bir donanim ozelligine erisim gerekiyorsa (GPIO, sensarler vb.)
- Cihaz uzerinde islem yapilmasi gerekiyorsa (edge computing)
- Tamamen farkli bir uygulama calistirilmak isteniyorsa

Bu durumlarin hicbiri mevcut kullanim senaryosunda gecerli degil.

---

## EKLER

### A. PriceTag APK Analizi

| Bilgi | Deger |
|-------|-------|
| Paket | com.pricetag.utility.neutral |
| Versiyon | 1.1.7 (code: 117) |
| Min SDK | 21 (Android 5.0) |
| Target SDK | 33 (Android 13) |
| Boyut | 78.6MB |
| Native Libs | libCheckDevicePavo.so (AES-128-CBC), FFmpeg, libscannative |
| DB | LitePal ORM (SysParam, Style, Template, Device, Media, Good, WifiInfo) |
| HMS | Huawei ML Kit, AGConnect, ScanKit |

### B. Bilinen Icerik Formatlari

| Format | Kullanim |
|--------|----------|
| JPG (800x1280) | Statik etiket gorseli (LabelPicture) |
| MP4 (720p) | Video oynatma (LabelVideo/VideoList) |
| LVBIN | Carousel icin gorsel formati (Media/MediaList) |
| JSON (.js) | Gorev yapilandirma dosyasi |

### C. Dosya Konumlari (Cihaz Uzerinde)

| Yol | Aciklama |
|-----|----------|
| `files/task/{clientId}.jpg` | Etiket gorseli |
| `files/task/{clientId}.js` | Gorev yapilandirmasi |
| `files/task/{clientId}_0.mp4` | Video dosyasi |
| `files/upgrade/update.pkg` | Firmware paketi |
