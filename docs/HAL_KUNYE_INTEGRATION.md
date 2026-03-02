# HAL Künye Entegrasyonu - Teknik Dokümantasyon

Bu doküman, Omnex Display Hub sisteminin HAL (Hal Kayıt Sistemi) entegrasyonunun teknik detaylarını içerir.

**Son Güncelleme:** 2026-02-05
**Versiyon:** 2.0.17

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Sistem Mimarisi](#sistem-mimarisi)
3. [HAL SOAP API Entegrasyonu](#hal-soap-api-entegrasyonu)
4. [Hata Kodları Referansı](#hata-kodları-referansı)
5. [Veritabanı Şeması](#veritabanı-şeması)
6. [API Endpoint'leri](#api-endpointleri)
7. [Frontend Entegrasyonu](#frontend-entegrasyonu)
8. [Yapılandırma ve Ayarlar](#yapılandırma-ve-ayarlar)
9. [Sorun Giderme](#sorun-giderme)

---

## Genel Bakış

### HAL Kayıt Sistemi Nedir?

HAL (Hal Kayıt Sistemi), Türkiye'de tarımsal ürünlerin üretimden tüketiciye kadar izlenmesini sağlayan T.C. Ticaret Bakanlığı tarafından yönetilen devlet sistemidir.

### Künye Numarası

- **Format:** 19 haneli sayısal değer
- **Örnek:** `2073079250202837944`
- **Amaç:** Her ürün partisinin benzersiz tanımlanması

### Entegrasyon Amacı

- Ürünlerin HAL künye bilgilerinin otomatik sorgulanması
- Üretici, menşei, ürün cinsi gibi bilgilerin alınması
- Etiket tasarımlarında künye bilgilerinin kullanılması
- İzlenebilirlik ve yasal uyumluluk

---

## Sistem Mimarisi

```
┌─────────────────────┐     SOAP/HTTPS      ┌─────────────────────┐
│   Omnex Hub         │ ─────────────────►  │   HAL Web Service   │
│   (PHP Backend)     │ ◄─────────────────  │   (hks.hal.gov.tr)  │
└─────────────────────┘                     └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   product_hal_data  │
│   (SQLite)          │
└─────────────────────┘
```

### Bileşenler

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| HAL Service | `services/HalKunyeService.php` | SOAP API entegrasyonu |
| HAL Scraper | `services/HalKunyeScraper.php` | Web scraping fallback |
| HAL Data Resolver | `services/HalDataResolver.php` | Şube bazlı veri çözümleme |
| Settings Resolver | `services/SettingsResolver.php` | Multi-tenant ayar yönetimi |
| API Endpoint'leri | `api/hal/*.php` | REST API katmanı |

---

## HAL SOAP API Entegrasyonu

### Endpoint Bilgileri

| Özellik | Değer |
|---------|-------|
| WSDL URL | `https://hks.hal.gov.tr/WebServices/BildirimService.svc?singleWsdl` |
| Endpoint | `https://hks.hal.gov.tr/WebServices/BildirimService.svc` |
| Protokol | SOAP 1.1 / SOAP 1.2 |
| Güvenlik | WS-Security (UsernameToken) |

### WSDL Sorunu ve Çözümü

HAL'in WSDL dosyası **63+ adet duplicate element** içermektedir. Bu durum PHP'nin native `SoapClient` sınıfının WSDL'i parse etmesini engeller:

```
PHP Fatal error: SOAP-ERROR: Parsing Schema: element 'guid' already defined
```

**Çözüm:** cURL tabanlı raw SOAP istekleri kullanılmaktadır.

### SOAP İstek Yapısı

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
    xmlns:tem="http://tempuri.org/"
    xmlns:hal="http://schemas.datacontract.org/2004/07/Hal.Kapasite.Services.Models.Bildirim">
    <soap:Header>
        <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
            <wsse:UsernameToken>
                <wsse:Username>{KULLANICI_ADI}</wsse:Username>
                <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{SIFRE}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soap:Header>
    <soap:Body>
        <tem:KunyeBilgisiGetir>
            <tem:kunyeNo>{KUNYE_NO}</tem:kunyeNo>
        </tem:KunyeBilgisiGetir>
    </soap:Body>
</soap:Envelope>
```

### SOAP Yanıt Yapısı

**Başarılı Yanıt:**
```xml
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    <s:Body>
        <KunyeBilgisiGetirResponse xmlns="http://tempuri.org/">
            <KunyeBilgisiGetirResult xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
                <HataDurumu xmlns="...">false</HataDurumu>
                <HataKodu xmlns="...">0</HataKodu>
                <HataMesaji xmlns="..."></HataMesaji>
                <Sonuc xmlns="..." i:type="a:KunyeBilgisi">
                    <a:KunyeNo>2073079250202837944</a:KunyeNo>
                    <a:MalinAdi>ELMA</a:MalinAdi>
                    <a:MalinCinsi>MEYVE</a:MalinCinsi>
                    <a:UreticiAdi>AHMET YILMAZ</a:UreticiAdi>
                    <a:UretimYeri>ISPARTA / EĞİRDİR</a:UretimYeri>
                    <!-- ... diğer alanlar -->
                </Sonuc>
            </KunyeBilgisiGetirResult>
        </KunyeBilgisiGetirResponse>
    </s:Body>
</s:Envelope>
```

**Hatalı Yanıt:**
```xml
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    <s:Body>
        <KunyeBilgisiGetirResponse xmlns="http://tempuri.org/">
            <KunyeBilgisiGetirResult xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
                <HataDurumu xmlns="...">true</HataDurumu>
                <HataKodu xmlns="...">13</HataKodu>
                <HataMesaji xmlns="...">Kimlik doğrulama başarısız</HataMesaji>
                <Sonuc i:nil="true" xmlns="..."/>
            </KunyeBilgisiGetirResult>
        </KunyeBilgisiGetirResponse>
    </s:Body>
</s:Envelope>
```

---

## Hata Kodları Referansı

### HAL Servis Hata Kodları

HAL Web Servisi iki farklı formatta hata kodu döndürebilir:

1. **Sayısal Format:** `0`, `1`, `11`, `13`
2. **String Format:** `GTBWSRV0000001`, `GTBGLB00000011`

### Tam Hata Kodu Listesi

| Hata Kodu | String Karşılığı | Açıklama | Frontend Kodu |
|-----------|------------------|----------|---------------|
| `0` | - | Başarılı (hata yok) | `null` |
| `1` | `GTBWSRV0000002` | İşlem başarısız. Servis isteği işleyemedi. | `HAL_ERROR_1` |
| `11` | `GTBGLB00000011` | Kullanıcı bilgileri yanlış. Kullanıcı adı veya şifre hatalı. | `HAL_ERROR_11` |
| `13` | - | Kimlik doğrulama başarısız. Kullanıcı adı veya şifre hatalı. | `HAL_ERROR_13` |
| - | `GTBGLB00000001` | Beklenmeyen bir hata oluştu. | `HAL_ERROR_UNEXPECTED` |
| Diğer | Diğer | Bilinmeyen hata kodu | `HAL_ERROR_GENERIC` |

### GTB Hata Kod Prefixleri

| Prefix | Açıklama |
|--------|----------|
| `GTBWSRV` | Web Servis Hataları |
| `GTBGLB` | Genel Sistem Hataları |
| `GTBBLDRM` | Bildirim Hataları |
| `GTBKPC` | Kapasite Hataları |

### PHP Hata Kodu Eşleştirmesi

```php
// services/HalKunyeService.php - Satır 303-310
$frontendErrorCode = match($errorCode) {
    '0' => null, // Başarılı, hata yok
    '1', 'GTBWSRV0000002' => 'HAL_ERROR_1',
    '11', 'GTBGLB00000011' => 'HAL_ERROR_11',
    '13' => 'HAL_ERROR_13',
    'GTBGLB00000001' => 'HAL_ERROR_UNEXPECTED',
    default => 'HAL_ERROR_GENERIC'
};
```

### i18n Çevirileri

**Türkçe (locales/tr/pages/settings.json):**
```json
{
    "hal": {
        "errors": {
            "HAL_ERROR_1": "İşlem başarısız. HAL servisi isteği işleyemedi.",
            "HAL_ERROR_11": "Kullanıcı bilgileri yanlış. Kullanıcı adı veya şifre hatalı.",
            "HAL_ERROR_13": "Kimlik doğrulama başarısız. Kullanıcı adı veya şifre hatalı.",
            "HAL_ERROR_UNEXPECTED": "Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
            "HAL_ERROR_GENERIC": "HAL servisi hata döndürdü (Kod: {code})"
        }
    }
}
```

**İngilizce (locales/en/pages/settings.json):**
```json
{
    "hal": {
        "errors": {
            "HAL_ERROR_1": "Operation failed. HAL service could not process the request.",
            "HAL_ERROR_11": "User information is incorrect. Username or password is wrong.",
            "HAL_ERROR_13": "Authentication failed. Username or password is incorrect.",
            "HAL_ERROR_UNEXPECTED": "An unexpected error occurred. Please try again later.",
            "HAL_ERROR_GENERIC": "HAL service returned an error (Code: {code})"
        }
    }
}
```

### Uygulama İçi Hata Kodları

| Kod | Açıklama | Çözüm |
|-----|----------|-------|
| `SETTINGS_NOT_CONFIGURED` | HAL ayarları yapılandırılmamış | Ayarlar > Entegrasyonlar'dan HAL ayarlarını kaydedin |
| `MISSING_CREDENTIALS` | Kullanıcı adı veya şifre eksik | Kimlik bilgilerini kontrol edin |
| `SOAP_NOT_AVAILABLE` | PHP SOAP eklentisi yüklü değil | `php_soap` eklentisini etkinleştirin |
| `SOAP_CONNECTION_FAILED` | HAL sunucusuna bağlanılamadı | Ağ bağlantısını ve firewall ayarlarını kontrol edin |
| `AUTH_ERROR` | Kimlik doğrulama hatası | Kullanıcı adı/şifre kontrolü |
| `UNEXPECTED_RESPONSE` | Beklenmeyen yanıt | HAL servisi geçici olarak sorunlu olabilir |
| `SOAP_FAULT` | SOAP protokol hatası | İstek formatını kontrol edin |
| `CONNECTION_ERROR` | Bağlantı hatası | Ağ bağlantısını kontrol edin |

---

## Veritabanı Şeması

### product_hal_data Tablosu (Migration 057)

Ana HAL künye verileri tablosu. Her ürün için 1:1 ilişki.

```sql
CREATE TABLE product_hal_data (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL UNIQUE,     -- Ürün ID (1:1 ilişki)
    company_id TEXT NOT NULL,            -- Firma ID
    kunye_no TEXT,                       -- 19 haneli künye numarası

    -- Üretim Yeri Bilgileri
    uretici_adi TEXT,                    -- Üretici adı/soyadı
    malin_adi TEXT,                      -- Malın adı (Elma, Domates vb.)
    malin_cinsi TEXT,                    -- Malın cinsi (Meyve, Sebze vb.)
    malin_turu TEXT,                     -- Malın türü (detay)
    ilk_bildirim_tarihi TEXT,            -- İlk bildirim tarihi
    uretim_yeri TEXT,                    -- İl/İlçe
    malin_sahibi TEXT,                   -- Malın sahibi

    -- Tüketim Yeri Bilgileri
    tuketim_bildirim_tarihi TEXT,
    tuketim_yeri TEXT,
    gumruk_kapisi TEXT,
    uretim_ithal_tarihi TEXT,
    miktar TEXT,
    alis_fiyati TEXT,
    isletme_adi TEXT,
    diger_bilgiler TEXT,

    -- Organik/Sertifika Bilgileri
    sertifikasyon_kurulusu TEXT,
    sertifika_no TEXT,

    -- Geçmiş Bildirimler
    gecmis_bildirimler TEXT,             -- JSON formatında

    -- Meta Bilgiler
    hal_sorgu_tarihi TEXT,               -- Son HAL sorgu zamanı
    hal_raw_data TEXT,                   -- Ham JSON verisi (debug için)
    created_at TEXT,
    updated_at TEXT,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- İndeksler
CREATE INDEX idx_product_hal_data_product ON product_hal_data(product_id);
CREATE INDEX idx_product_hal_data_company ON product_hal_data(company_id);
CREATE INDEX idx_product_hal_data_kunye ON product_hal_data(kunye_no);
```

### product_branch_hal_overrides Tablosu (Migration 058)

Şube bazlı HAL veri override'ları için.

```sql
CREATE TABLE product_branch_hal_overrides (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    company_id TEXT NOT NULL,

    -- Override edilebilir alanlar (NULL = master'dan devral)
    kunye_no TEXT,
    uretici_adi TEXT,
    malin_adi TEXT,
    malin_cinsi TEXT,
    malin_turu TEXT,
    uretim_yeri TEXT,
    malin_sahibi TEXT,
    tuketim_yeri TEXT,
    miktar TEXT,
    alis_fiyati TEXT,

    -- Soft delete
    deleted_at TEXT,
    created_at TEXT,
    updated_at TEXT,

    UNIQUE(product_id, branch_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### HAL Alanları ve Etiket Tasarımı Eşleştirmesi

| HAL Alanı | Veritabanı Alanı | Etiket Değişkeni | Açıklama |
|-----------|------------------|------------------|----------|
| MalinAdi | malin_adi | `{{hal_malin_adi}}` | Ürün adı |
| MalinCinsi | malin_cinsi | `{{hal_malin_cinsi}}` | Ürün cinsi |
| MalinTuru | malin_turu | `{{hal_malin_turu}}` | Ürün türü |
| UreticiAdi | uretici_adi | `{{hal_uretici}}` | Üretici |
| UretimYeri | uretim_yeri | `{{hal_uretim_yeri}}` | Menşei |
| IlkBildirimTarihi | ilk_bildirim_tarihi | `{{hal_tarih}}` | Bildirim tarihi |
| KunyeNo | kunye_no | `{{kunye_no}}` | Künye numarası |

---

## API Endpoint'leri

### HAL Ayarları

#### GET /api/hal/settings

HAL entegrasyon ayarlarını getirir.

**Response:**
```json
{
    "success": true,
    "data": {
        "username": "kullanici",
        "password": "********",
        "service_password": "********",
        "tc_vergi_no": "12345678901",
        "enabled": true
    }
}
```

#### PUT /api/hal/settings

HAL ayarlarını günceller.

**Request:**
```json
{
    "username": "kullanici",
    "password": "yeni_sifre",
    "service_password": "servis_sifresi",
    "tc_vergi_no": "12345678901",
    "enabled": true
}
```

### HAL Bağlantı Testi

#### GET /api/hal/test

HAL servisine bağlantı testi yapar.

**Response (Başarılı):**
```json
{
    "success": true,
    "message": "HAL bağlantısı başarılı",
    "data": {
        "response_time": 450,
        "server_status": "online"
    }
}
```

**Response (Hatalı):**
```json
{
    "success": false,
    "message": "HAL bağlantı hatası",
    "error_code": "HAL_ERROR_13",
    "errors": {
        "detail": "Kimlik doğrulama başarısız"
    }
}
```

### Künye Sorgulama

#### GET /api/hal/query?kunye_no={kunye}

Tek künye sorgular.

**Response (Başarılı):**
```json
{
    "success": true,
    "data": {
        "kunye_no": "2073079250202837944",
        "malin_adi": "ELMA",
        "malin_cinsi": "MEYVE",
        "malin_turu": "KIRMIZI ELMA",
        "uretici_adi": "AHMET YILMAZ",
        "uretim_yeri": "ISPARTA / EĞİRDİR",
        "ilk_bildirim_tarihi": "15.01.2026",
        "malin_sahibi": "AHMET YILMAZ",
        "sertifikasyon_kurulusu": null,
        "sertifika_no": null
    },
    "message": "Künye bilgisi başarıyla alındı"
}
```

**Response (CAPTCHA Gerekli):**
```json
{
    "success": false,
    "message": "Künye sorgulanamadı. HAL sistemi CAPTCHA gerektiriyor.",
    "errors": {
        "requires_captcha": true,
        "manual_query_url": "https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx",
        "hint": "HAL kimlik bilgilerinizi Ayarlar > Entegrasyonlar bölümünden girerek SOAP API ile sorgulama yapabilirsiniz.",
        "has_credentials": false
    }
}
```

#### POST /api/hal/bulk-query

Toplu künye sorgulama (maksimum 10 künye).

**Request:**
```json
{
    "kunye_numbers": [
        "2073079250202837944",
        "2073079250202837945"
    ]
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "2073079250202837944": {
            "success": true,
            "data": { ... }
        },
        "2073079250202837945": {
            "success": false,
            "error": "Künye bulunamadı"
        }
    },
    "summary": {
        "total": 2,
        "success": 1,
        "failed": 1
    }
}
```

### HAL Veri Yönetimi

#### GET /api/hal/data?product_id={id}

Ürünün HAL verisini getirir.

#### POST /api/hal/data

HAL verisi kaydeder veya günceller.

**Request:**
```json
{
    "product_id": "uuid",
    "kunye_no": "2073079250202837944",
    "uretici_adi": "AHMET YILMAZ",
    "malin_adi": "ELMA",
    "malin_cinsi": "MEYVE",
    "uretim_yeri": "ISPARTA / EĞİRDİR"
}
```

#### DELETE /api/hal/data?product_id={id}

HAL verisini siler.

---

## Frontend Entegrasyonu

### Ürün Formu (ProductForm.js)

HAL künye sorgulaması ürün formuna entegre edilmiştir:

1. **Künye Alanı:** `kunye_no` input alanı
2. **Sorgula Butonu:** Künye numarasının solundaki tarama ikonu
3. **Sonuç Gösterimi:** Yeşil kutu içinde HAL bilgileri
4. **Verileri Uygula:** Form alanlarını HAL verileriyle doldurma

### Kullanım Akışı

```
1. Künye No alanına 19 haneli numara girin
2. Tarama ikonuna tıklayın (ti-scan)
3. HAL API sorgulanır:
   a. SOAP API (kimlik bilgileri varsa)
   b. Web Scraper (fallback)
4. Sonuç yeşil kutuda gösterilir
5. "Verileri Uygula" ile form doldurulur
```

### CAPTCHA Uyarı Modalı

HAL web sitesi CAPTCHA istediğinde gösterilen modal:

- Robot doğrulama gerektiği bilgisi
- Manuel sorgulama linki (HAL sitesine)
- API entegrasyonu linki (Ayarlar sayfasına)
- Sorgulanan künye numarası

### Form Kart Düzeni (v2.0.17)

```
Sol Taraf (lg:col-span-2):
├── Temel Bilgiler kartı
├── HAL Künye kartı ← HAL sorgu ve verileri burada
└── Fiyat Bilgileri kartı

Sağ Taraf (lg:col-span-1):
├── Durum kartı
├── Görseller kartı
├── Video kartı
├── Stok ve Ölçü kartı
└── Geçerlilik kartı
```

---

## Yapılandırma ve Ayarlar

### HAL Ayarları Saklama

HAL ayarları `settings` tablosunda JSON formatında saklanır:

```json
{
    "hal_integration": {
        "username": "hal_kullanici",
        "password": "********",
        "service_password": "********",
        "tc_vergi_no": "12345678901",
        "enabled": true
    }
}
```

### Multi-Tenant Ayar Hiyerarşisi

1. **Kullanıcı Ayarı** (en öncelikli): `settings WHERE user_id = ?`
2. **Firma Ayarı** (fallback): `settings WHERE company_id = ? AND user_id IS NULL`
3. **Sistem Varsayılanı**: Kod içindeki varsayılan değerler

### SettingsResolver Servisi

```php
$resolver = new SettingsResolver($companyId, $userId);

// HAL ayarlarını al
$halSettings = $resolver->get('hal_integration', [
    'username' => '',
    'password' => '',
    'service_password' => '',
    'tc_vergi_no' => '',
    'enabled' => false
]);
```

---

## Sorun Giderme

### Sık Karşılaşılan Hatalar

#### 1. "Kullanıcı bilgileri yanlış" (HAL_ERROR_11)

**Sebep:** HAL kullanıcı adı veya şifresi hatalı.

**Çözüm:**
- Ayarlar > Entegrasyonlar > HAL bölümünü kontrol edin
- HAL portalından kullanıcı bilgilerinizi doğrulayın
- Şifrenizde özel karakter varsa doğru girildiğinden emin olun

#### 2. "Kimlik doğrulama başarısız" (HAL_ERROR_13)

**Sebep:** HAL servisine kimlik doğrulama yapılamadı.

**Çözüm:**
- Kullanıcı adı ve şifreyi kontrol edin
- HAL hesabınızın aktif olduğundan emin olun
- HAL portalına giriş yaparak hesabı test edin

#### 3. "CAPTCHA gerektiriyor"

**Sebep:** Web scraper kullanılıyor ve HAL sitesi CAPTCHA istiyor.

**Çözüm:**
- HAL kimlik bilgilerinizi girerek SOAP API kullanın
- Veya manuel olarak HAL sitesinden sorgulayın

#### 4. "HAL sunucusuna bağlanılamadı"

**Sebep:** Ağ sorunu veya HAL servisi geçici olarak çalışmıyor.

**Çözüm:**
- İnternet bağlantınızı kontrol edin
- HAL sitesine (`hal.gov.tr`) erişebildiğinizi doğrulayın
- Firewall ayarlarını kontrol edin (port 443)
- Bir süre bekleyip tekrar deneyin

#### 5. "PHP SOAP eklentisi yüklü değil"

**Sebep:** Sunucuda `php_soap` eklentisi etkin değil.

**Çözüm:**
```bash
# Ubuntu/Debian
sudo apt-get install php-soap
sudo service apache2 restart

# CentOS/RHEL
sudo yum install php-soap
sudo systemctl restart httpd

# XAMPP (Windows)
php.ini dosyasında extension=soap satırını etkinleştirin
```

### Log Dosyaları

HAL sorgu logları:
```
storage/logs/hal_queries.log
```

### Debug Modu

Geliştirme ortamında detaylı hata mesajları için:

```php
// config.php
define('HAL_DEBUG', true);
```

---

## İlgili Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `services/HalKunyeService.php` | Ana SOAP API servisi |
| `services/HalKunyeScraper.php` | Web scraping fallback |
| `services/HalDataResolver.php` | Şube bazlı veri çözümleme |
| `services/SettingsResolver.php` | Multi-tenant ayar yönetimi |
| `api/hal/settings.php` | Ayarlar endpoint |
| `api/hal/test.php` | Bağlantı testi endpoint |
| `api/hal/query.php` | Tek künye sorgulama |
| `api/hal/bulk-query.php` | Toplu sorgulama |
| `api/hal/data.php` | HAL veri CRUD |
| `public/assets/js/pages/products/ProductForm.js` | Frontend künye sorgu UI |
| `public/assets/js/pages/products/form/HalKunyeSection.js` | Künye sorgulama modülü |
| `public/assets/js/pages/settings/IntegrationSettings.js` | HAL ayarları UI |
| `database/migrations/057_create_product_hal_data.sql` | HAL veri tablosu |
| `database/migrations/058_create_product_branch_hal_overrides.sql` | Şube override tablosu |
| `locales/tr/pages/settings.json` | Türkçe çeviriler |
| `locales/en/pages/settings.json` | İngilizce çeviriler |

---

## Referanslar

- [HAL Kayıt Sistemi Resmi Sitesi](https://hal.gov.tr)
- [GTB HAL Kayıt Sistemi Servis Geliştirici Kılavuzu](tasarimlar/GTB%20Hal%20Kayıt%20Sistemi%20Servis%20Geliştirici%20Klavuzu.pdf)
- [T.C. Ticaret Bakanlığı](https://ticaret.gov.tr)
