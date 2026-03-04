# PavoDisplay / Kexin BLE Cihaz Sifre Korumasi

**Tarih:** 2026-03-04
**Versiyon:** v1.0
**Durum:** Tamamlandi

---

## 1. Genel Bakis

PavoDisplay ve Kexin ESL cihazlari Bluetooth Low Energy (BLE) uzerinden admin/user sifre korumasi destekler. Sifre ayarlandiktan sonra tum BT komutlari JSON payload icinde `"Token":"PASSWORD"` alani gerektirir; aksi halde cihaz `"Token error"` yaniti doner.

### Problem

- BluetoothService.js'deki 35+ komut `token=''` parametresini kabul ediyordu ancak hicbiri gercek token gondermiyordu.
- Yakin mesafedeki yetkisiz APK'lar (ornegin magaza calisaninin kisisel telefonu) cihaza kolayca icerik gonderebiliyordu.

### Cozum

- Cihaz Bluetooth wizard ile eklenirken otomatik 16 karakterlik sifre uretilir.
- Sifre cihazin admin ve user password slotlarina yazilir.
- Sonraki tum BT komutlari bu token ile gonderilir.
- Sifre sunucuda AES-256-CBC ile sifrelenerek `devices.bt_password_encrypted` kolonunda saklanir.
- DeviceDetail sayfasinda koruma durumu badge ve sifre yonetim arayuzu gosterilir.

---

## 2. Teknik Mimari

### 2.1 Veri Akisi

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  BluetoothWizard │────>│  PavoDisplay │────>│   PostgreSQL    │
│   (Frontend JS)  │ BLE │   Cihaz      │     │   (Backend DB)  │
└────────┬────────┘     └──────────────┘     └────────┬────────┘
         │                                            │
         │  1. Sifre uret (crypto.getRandomValues)    │
         │  2. setAdminPassword(pw)  ──BLE──>         │
         │  3. setUserPassword(pw, pw) ──BLE──>       │
         │  4. Sonraki komutlar token=pw ile           │
         │  5. API POST /devices  ─────────────────>  │
         │     { bt_password: pw }                    │
         │                          Security::encrypt │
         │                          AES-256-CBC       │
         │                          ───> bt_password_ │
         │                               encrypted    │
         └────────────────────────────────────────────┘
```

### 2.2 Zamanlama (Kritik)

```
Adim 3 - WiFi:     token=''  (cihazda sifre yok, komutlar calisir)
Adim 4 - Protokol:  token=''  (cihazda sifre yok, komutlar calisir)
  └─> Protokol basarili ─> setAdminPassword(pw) + setUserPassword(pw, pw)
  └─> this._deviceToken = uretilen sifre
Adim 5 - Dogrula:   token=pw  (cihaz artik sifre istiyor, token geciriliyor)
Kaydet:             bt_password API'ye gonderilir -> DB'de sifreli saklanir
```

**Onemli:** Sifre, protokol adimi BASARILI olduktan sonra ve dogrulama adiminden ONCE ayarlanir. Boylece WiFi/protokol komutlari sifreye ihtiyac duymaz, ama dogrulama ve sonrasi tokenli calisir.

### 2.3 Sifreleme

| Katman | Yontem | Detay |
|--------|--------|-------|
| Cihaz BLE | Plaintext Token | JSON `"Token":"PASSWORD"` alani |
| Sunucu DB | AES-256-CBC | `Security::encrypt()` / `Security::decrypt()` |
| API Transport | HTTPS | Plaintext sadece HTTPS uzerinden tasinir |

Sifreleme anahtari: `JWT_SECRET` turevli (bkz. `core/Security.php`).

---

## 3. Veritabani

### 3.1 Kolon

```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS bt_password_encrypted TEXT DEFAULT NULL;
COMMENT ON COLUMN devices.bt_password_encrypted IS
    'AES-256-CBC encrypted Bluetooth admin password for device protection';
```

- **NULL** = Cihaz korumasiz (sifre yok)
- **Dolu** = AES-256-CBC ile sifrelenmis BLE admin sifresi

### 3.2 Sanal Alan

API response'larinda `bt_password_encrypted` kolonu **asla** frontend'e gonderilmez. Yerine:

```json
{
    "bt_protected": true
}
```

boolean degeri hesaplanir ve eklenir.

---

## 4. API Endpoint'leri

### 4.1 BLE Sifre Yonetimi

**Base:** `/api/devices/:id/bt-password`

| Method | Islem | Yetki |
|--------|-------|-------|
| GET | Sifre coz ve plaintext dondur | SuperAdmin, Admin, Manager |
| POST | Sifre sifrele ve kaydet | SuperAdmin, Admin, Manager |
| DELETE | Sifreyi kaldir (NULL yap) | SuperAdmin, Admin, Manager |

#### GET /api/devices/:id/bt-password

Cihazin BLE sifresini cozumleyip plaintext olarak dondurur.

**Response (korumali):**
```json
{
    "success": true,
    "data": {
        "device_id": "uuid",
        "bt_protected": true,
        "password": "aBcDeFgHiJkLmNoP"
    }
}
```

**Response (korumasiz):**
```json
{
    "success": true,
    "data": {
        "device_id": "uuid",
        "bt_protected": false,
        "password": null
    }
}
```

#### POST /api/devices/:id/bt-password

Yeni sifre kaydeder (mevcut varsa ustune yazar).

**Request:**
```json
{
    "password": "yeniSifre123"
}
```

**Kurallar:** Sifre 4-64 karakter arasi olmalidir.

#### DELETE /api/devices/:id/bt-password

Sunucu kaydindaki sifreyi siler (`bt_password_encrypted = NULL`).

> **Not:** Bu islem sadece sunucu kaydini temizler. Cihaz uzerindeki sifre ancak factory reset ile kaldirilabilir.

### 4.2 Mevcut Endpoint Degisiklikleri

| Endpoint | Degisiklik |
|----------|-----------|
| `POST /api/devices` (create) | `bt_password` alani kabul edilir, `Security::encrypt()` ile kaydedilir |
| `PUT /api/devices/:id` (update) | `bt_password` alani kabul edilir; bos string sifreyi kaldirir |
| `GET /api/devices` (index) | Her cihaza `bt_protected` (boolean) eklenir, `bt_password_encrypted` cikarilir |
| `GET /api/devices/:id` (show) | Ayni: `bt_protected` eklenir, `bt_password_encrypted` cikarilir |
| `POST /api/devices/:id/network-config` | Token bossa DB'den otomatik cozumlenir |

### 4.3 Network Config Otomatik Token

`network-config.php` endpoint'inde Bluetooth komutu hazirlama isteklerinde (`prepare_static_ip`, `prepare_dhcp`, `prepare_wifi`) token bos gonderildiyse, sunucu otomatik olarak DB'deki sifreyi cozer ve komuta ekler:

```php
$requestToken = $body['token'] ?? '';
if (empty($requestToken) && !empty($device['bt_password_encrypted'])) {
    $requestToken = Security::decrypt($device['bt_password_encrypted']) ?? '';
}
```

---

## 5. Frontend

### 5.1 BluetoothWizard.js

#### Otomatik Sifre Uretimi

```javascript
_generateSecurePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

- `crypto.getRandomValues()` kullanilir (kriptografik guvenli)
- 16 karakter, buyuk/kucuk harf + rakam (62^16 kombinasyon)

#### Token Gecirilen Komutlar

Asagidaki tum BLE komutlari `this._deviceToken` parametresi ile cagrilir:

| Metod | Komutlar |
|-------|----------|
| `_saveWifi()` | `setWifi`, `setStaticIp`, `setDhcp` |
| `_setProtocol()` | `setWifi`, `setStaticIp`, `setProtocol`, `configureMqtt`, `setRemoteServer`, `setInfoServer`, `setQueryCycle`, `getDeviceInfo`, `getAllInfo`, `setApplication`, `reboot` |
| `_readInfo()` | `getAllInfo` |
| `_saveHardware()` | `setHardware` |
| `_reboot()` | `reboot` |
| `_clearMedia()` | `clearMedia` |
| `_factoryReset()` | `factoryReset` (+ sonra `_deviceToken = ''`) |

#### Factory Reset Davranisi

Factory reset sonrasi cihaz uzerindeki sifre kalkar. Bu nedenle:
1. `this._deviceToken = ''` yapilir (wizard icindeki token temizlenir)
2. Sunucudaki `bt_password_encrypted` kaydi hala durur (kullanici DeviceDetail'dan manuel kaldirabilir)

#### Cihaz Kaydi

`_saveDevice()` metodu API'ye gonderilen data objesine `bt_password` ekler:

```javascript
if (this._deviceToken) {
    data.bt_password = this._deviceToken;
}
```

### 5.2 DeviceDetail.js

#### Koruma Badge (Hero)

Cihaz detay sayfasinin ust kismindaki badge grubunda BLE koruma durumu gosterilir:

- **Korumali:** Yesil badge, kilit ikonu, "BLE Korumali" / "Protected"
- **Korumasiz:** Turuncu badge, acik kilit ikonu, "BLE Korumasiz" / "Unprotected"

Sadece PavoDisplay/Kexin cihazlarinda gorunur (`isPavoDisplayDevice()` kontrolu).

#### BLE Guvenlik Karti

Genel sekmesinde sagdaki teknik detaylar kartindan sonra gosterilir:

| Durum | Gorunum |
|-------|---------|
| Korumali | Koruma durumu badge + "Sifreyi Goster" + "Sifreyi Kaldir" butonlari |
| Korumasiz | Bilgi metni: "Bluetooth wizard ile eklerken sifre otomatik atanir" |

#### Sifre Goster Modali

"Sifreyi Goster" butonuna tiklandiginda:
1. `GET /api/devices/:id/bt-password` API cagrisi
2. Plaintext sifre `<code>` blogu icinde gosterilir
3. Yanindaki kopyala butonu ile panoya kopyalanabilir

#### Sifre Kaldirma

"Sifreyi Kaldir" butonuna tiklandiginda:
1. Onay modali gosterilir (dikkat: sadece sunucu kaydini siler)
2. `DELETE /api/devices/:id/bt-password` API cagrisi
3. Sayfa yenilenir, badge "Korumasiz" olur

---

## 6. Guvenlik

### 6.1 Sifre Guvenligi

| Tehdit | Koruma |
|--------|--------|
| Yakin mesafe BLE erisimi | Admin+User sifre korumasi, token olmadan komut reddedilir |
| DB sizdirma | AES-256-CBC sifreleme, plaintext saklanmaz |
| API erisimi | JWT auth + rol kontrolu (SuperAdmin/Admin/Manager) |
| Frontend sizdirma | `bt_password_encrypted` asla frontend'e gonderilmez |
| Brute-force | 16 karakter, 62^16 kombinasyon (~95 bit entropi) |

### 6.2 Yetki Matrisi

| Islem | SuperAdmin | Admin | Manager | Editor | Viewer |
|-------|:----------:|:-----:|:-------:|:------:|:------:|
| Koruma durumunu gorme | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sifre gosterme (plaintext) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Sifre degistirme | ✓ | ✓ | ✓ | ✗ | ✗ |
| Sifre kaldirma | ✓ | ✓ | ✓ | ✗ | ✗ |

### 6.3 Token Error Handling

BLE komutu basarisiz olursa ve hata mesaji "Token" iceriyorsa, kullaniciya mevcut sifreyi sorma mekanizmasi ongorulebilir (gelecek gelistirme).

---

## 7. i18n Destegi

Tum kullanici arayuzu metinleri 8 dilde cevrilmistir:

| Dil | Kod | Dosya |
|-----|-----|-------|
| Turkce | tr | `locales/tr/pages/devices.json` |
| Ingilizce | en | `locales/en/pages/devices.json` |
| Rusca | ru | `locales/ru/pages/devices.json` |
| Azerice | az | `locales/az/pages/devices.json` |
| Almanca | de | `locales/de/pages/devices.json` |
| Felemenkce | nl | `locales/nl/pages/devices.json` |
| Fransizca | fr | `locales/fr/pages/devices.json` |
| Arapca | ar | `locales/ar/pages/devices.json` |

Tum key'ler `bluetooth.protection.*` altindadir (18 key).

---

## 8. Degisiklik Ozeti

| # | Dosya | Islem | Aciklama |
|---|-------|-------|----------|
| 1 | `database/postgresql/v2/16_devices.sql` | Guncellendi | `bt_password_encrypted TEXT` kolonu |
| 2 | `api/devices/bt-password.php` | Yeni | GET/POST/DELETE sifre yonetimi |
| 3 | `api/index.php` | Guncellendi | 3 yeni route |
| 4 | `api/devices/create.php` | Guncellendi | `bt_password` kabul + sifrele |
| 5 | `api/devices/update.php` | Guncellendi | `bt_password` kabul + guncelle |
| 6 | `api/devices/index.php` | Guncellendi | `bt_protected` sanal alan |
| 7 | `api/devices/show.php` | Guncellendi | `bt_protected` sanal alan |
| 8 | `api/devices/network-config.php` | Guncellendi | Otomatik token cozumleme |
| 9 | `BluetoothWizard.js` | Guncellendi | Otomatik koruma + token gecirme |
| 10 | `DeviceDetail.js` | Guncellendi | Koruma badge + sifre yonetimi |
| 11-18 | `locales/*/pages/devices.json` | Guncellendi | 8 dilde 18 i18n key |

**Degismeyen:** `BluetoothService.js` — 35+ metod zaten token parametresini destekliyordu.

---

## 9. Test Senaryolari

### 9.1 Otomatik Koruma (Wizard)

1. Bluetooth wizard ile yeni cihaz ekle
2. WiFi adiminda komutlarin `token=''` ile calistigini dogrula
3. Protokol adimi basarili olduktan sonra "BLE koruma sifresi ayarlandi" logunu gor
4. Dogrulama adiminda `getAllInfo` cagrisinin token ile gittigini dogrula
5. Cihaz kaydedildikten sonra DB'de `bt_password_encrypted` dolu olmali
6. DeviceDetail'da "BLE Korumali" badge'i gorunmeli

### 9.2 Sifre Goruntuleme

1. Korumali cihazin detay sayfasina git
2. "Sifreyi Goster" butonuna tikla
3. Modal'da plaintext sifre gosterilmeli
4. "Kopyala" butonuyla panoya kopyalanmali

### 9.3 Sifre Kaldirma

1. "Sifreyi Kaldir" butonuna tikla
2. Onay modali gosterilmeli
3. Onayladiktan sonra badge "Korumasiz" olmali
4. DB'de `bt_password_encrypted = NULL` olmali

### 9.4 Yetkisiz Erisim

1. Farkli bir BLE uygulamasi ile cihaza baglan
2. Token olmadan komut gonder
3. Cihaz "Token error" dondurmeli

### 9.5 Network Config

1. Korumali cihaz icin network config modalini ac
2. "Prepare Static IP" komutu gonder (token bos)
3. Backend otomatik olarak DB'den token cozumlemeli
4. Hazirlanan komutta `"Token":"PASSWORD"` olmali

### 9.6 Factory Reset

1. Wizard icinde "Fabrika Ayarlari" butonuna tikla
2. Cihaz sifirlandiktan sonra `_deviceToken = ''` olmali
3. Sonraki komutlar tokensiz gitmeli (cihaz artik sifresiz)

---

## 10. Bilinen Limitasyonlar

1. **Cihaz sifre degisikligi BLE baglantisi gerektirir.** Sadece sunucu kaydini silmek (`DELETE /bt-password`) cihazdaki sifreyi kaldirmaz.
2. **Factory reset sonrasi sunucu kaydi kalmaya devam eder.** Kullanici manuel olarak DeviceDetail'dan sifreyi kaldirmalidir.
3. **Token error recovery henuz uygulanmadi.** Gelecekte BLE komutu "Token error" dondurdugunde kullanicidan mevcut sifreyi soran bir mekanizma eklenebilir.
4. **Cihaz uzerinde sifre degistirme (BLE uzerinden)** su an sadece wizard icerisinde yapilabilir. DeviceDetail'dan BLE baglantisi kurarak sifre degistirme gelecek gelistirmedir.
