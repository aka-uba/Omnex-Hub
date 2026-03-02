# TAMSOFT ERP Entegrasyonu

Bu dokuman, Omnex Display Hub ile TAMSOFT ERP sistemi arasindaki entegrasyonu detayli olarak aciklamaktadir.

## Genel Bakis

TAMSOFT ERP entegrasyonu, perakende sektorunde kullanilan TAMSOFT ERP sisteminden urun verilerini (stok, fiyat, barkod, kategori vb.) otomatik olarak cekerek Omnex Display Hub'a aktarmayi saglar.

### Ozellikler

- OAuth2 tabanli kimlik dogrulama
- Token cache mekanizmasi (1 saatlik gecerlilik)
- Coklu depo destegi
- Otomatik senkronizasyon
- Kampanya/indirim fiyati destegi
- Coklu barkod destegi

## Teknik Detaylar

### API Bilgileri

| Ozellik | Deger |
|---------|-------|
| Base URL | `http://tamsoftintegration.camlica.com.tr` |
| Auth Endpoint | `/token` |
| API Prefix | `/api/Integration/` |
| Auth Method | OAuth2 Password Grant |
| Token Suresi | 1 saat |

### API Endpoint'leri

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| `/token` | POST | OAuth2 token al |
| `/api/Integration/DepoListesi` | GET | Depo listesi |
| `/api/Integration/StokListesi` | GET | Urun/stok listesi |

### StokListesi Parametreleri

| Parametre | Tip | Aciklama |
|-----------|-----|----------|
| tarih | string | Senkronizasyon tarihi (YYYY-MM-DD) |
| depoid | int | Depo ID |
| miktarsifirdanbuyukstoklarlistelensin | bool | Sadece stok > 0 |
| urununsonbarkodulistelensin | bool | Tek barkod dondur |
| sadeceeticaretstoklarigetir | bool | Sadece e-ticaret urunleri |

### API Yanit Yapisi

TAMSOFT API'si urunleri su formatta dondurur:

```json
{
  "ID": 2,
  "UrunKodu": "01002",
  "UrunAdi": "DOMATES SALCALIK",
  "KDVOrani": 20,
  "IndirimliTutar": 0,
  "Tutar": 33,
  "Envanter": 42,
  "UreticiFirmaAdi": "MANAV",
  "Resimler": ["https://...jpg"],
  "Barkodlar": [
    {
      "Barkodu": "01002",
      "Birim": "Kilogram",
      "Fiyat": 33
    }
  ],
  "Gruplar": [
    {
      "ID": 1,
      "Tanim": "manav"
    }
  ],
  "Kategori": "KMANAV"
}
```

### Alan Eslestirmesi (Field Mapping)

TAMSOFT alanlari Omnex Display Hub alanlarına su sekilde eslestirilir:

| TAMSOFT Alani | Omnex Alani | Aciklama |
|---------------|-------------|----------|
| UrunKodu | sku | Stok kodu |
| UrunAdi | name | Urun adi |
| Tutar | current_price | Guncel satis fiyati |
| IndirimliTutar | previous_price | Kampanyasiz fiyat (IndirimliTutar < Tutar ise) |
| Barkodlar[0].Barkodu | barcode | Birincil barkod |
| Resimler[0] | image_url | Urun gorseli |
| Gruplar[0].Tanim | category | Kategori |
| UreticiFirmaAdi | brand | Marka/uretici |
| Envanter | stock | Stok miktari |
| KDVOrani | vat_rate | KDV orani |
| Barkodlar[0].Birim | unit | Satis birimi |

### Kampanya/Indirim Mantigi

TAMSOFT'ta kampanya durumu su kuralla belirlenir:

- `IndirimliTutar < Tutar` ise: Kampanya AKTIF
  - `current_price` = IndirimliTutar (indirimli fiyat)
  - `previous_price` = Tutar (eski fiyat, ustu cizili gosterilir)
- `IndirimliTutar >= Tutar` veya `IndirimliTutar = 0` ise: Kampanya YOK
  - `current_price` = Tutar
  - `previous_price` = null

## Veritabani Tablolari

### tamsoft_settings

Firma bazli TAMSOFT ayarlarini saklar.

```sql
CREATE TABLE tamsoft_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    api_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    default_depo_id INTEGER DEFAULT 1,
    sync_interval INTEGER DEFAULT 30,
    enabled INTEGER DEFAULT 0,
    auto_sync_enabled INTEGER DEFAULT 0,
    only_stock_positive INTEGER DEFAULT 0,
    only_ecommerce INTEGER DEFAULT 0,
    single_barcode INTEGER DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### tamsoft_tokens

OAuth2 token'larini cache'ler (her istek icin yeni token almamak icin).

```sql
CREATE TABLE tamsoft_tokens (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'bearer',
    expires_at TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### tamsoft_sync_logs

Senkronizasyon gecmisini tutar.

```sql
CREATE TABLE tamsoft_sync_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    sync_type TEXT DEFAULT 'full',
    status TEXT DEFAULT 'pending',
    total_products INTEGER DEFAULT 0,
    inserted_products INTEGER DEFAULT 0,
    updated_products INTEGER DEFAULT 0,
    failed_products INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

## Backend Servisi

### TamsoftGateway.php

Ana gateway servisi `services/TamsoftGateway.php` dosyasinda bulunur.

#### Temel Metodlar

```php
$gateway = new TamsoftGateway($companyId);

// Depo listesi al
$depolar = $gateway->getDepolar();

// Urun listesi al
$urunler = $gateway->getStokListesi([
    'depoId' => 1,
    'onlyStockPositive' => true,
    'singleBarcode' => true
]);

// Urunleri senkronize et
$result = $gateway->syncProducts([
    'depoId' => 1,
    'onlyStockPositive' => true
]);
```

#### Cift JSON Kodlama Sorunu

**ONEMLI:** TAMSOFT API'si standart olmayan bir sekilde yanit dondurur. JSON verisi, baska bir JSON string'i icinde gonderilir:

```
Normal REST API Yaniti:    [{"UrunKodu": "001", ...}]
TAMSOFT API Yaniti:        "[{\"UrunKodu\": \"001\", ...}]"
```

Bu sorun TAMSOFT tarafinda kaynaklaniyor. Bizim tarafimizda asagidaki duzeltme ile handle edilmektedir:

```php
// services/TamsoftGateway.php - request() metodu
$data = json_decode($response, true);

// Cift JSON kodlama durumunu handle et
// TAMSOFT API bazen JSON stringi icinde JSON dondurur
if (is_string($data)) {
    $innerData = json_decode($data, true);
    if ($innerData !== null) {
        $data = $innerData;
    }
}
```

## API Endpoint'leri

### GET /api/tamsoft/settings

TAMSOFT ayarlarini getirir.

**Response:**
```json
{
    "success": true,
    "data": {
        "api_url": "http://tamsoftintegration.camlica.com.tr",
        "username": "DEMONEF",
        "password": "••••••••",
        "default_depo_id": 1,
        "sync_interval": 30,
        "enabled": true,
        "auto_sync_enabled": false,
        "only_stock_positive": true,
        "only_ecommerce": false,
        "single_barcode": true,
        "last_sync_at": "2026-02-05 14:30:00"
    }
}
```

### PUT /api/tamsoft/settings

TAMSOFT ayarlarini gunceller.

**Request:**
```json
{
    "api_url": "http://tamsoftintegration.camlica.com.tr",
    "username": "DEMONEF",
    "password": "demonef88",
    "default_depo_id": 1,
    "sync_interval": 30,
    "enabled": true
}
```

### GET /api/tamsoft/test

Baglanti testi yapar.

**Response (Basarili):**
```json
{
    "success": true,
    "message": "TAMSOFT baglantisi basarili",
    "data": {
        "token_valid": true,
        "depo_count": 8,
        "response_time_ms": 245
    }
}
```

### GET /api/tamsoft/depolar

Depo listesini getirir.

**Response:**
```json
{
    "success": true,
    "data": [
        {"ID": 1, "DepoAdi": "ANA DEPO"},
        {"ID": 2, "DepoAdi": "SUBELER"},
        {"ID": 3, "DepoAdi": "MANAV"}
    ]
}
```

### POST /api/tamsoft/sync

Manuel senkronizasyon baslatir.

**Request:**
```json
{
    "depo_id": 1
}
```

**Response:**
```json
{
    "success": true,
    "message": "Senkronizasyon tamamlandi",
    "data": {
        "total": 11,
        "inserted": 8,
        "updated": 3,
        "failed": 0,
        "sync_time_seconds": 2.5
    }
}
```

## Frontend Kullanimi

### Ayarlar Sayfasi

1. **Ayarlar > Entegrasyonlar > ERP** sekmesine gidin
2. **TAMSOFT ERP** kartini bulun (en ustte)
3. Gerekli bilgileri doldurun:
   - API URL: `http://tamsoftintegration.camlica.com.tr`
   - Kullanici Adi: TAMSOFT kullanici adiniz
   - Sifre: TAMSOFT sifreniz
4. **Baglanti Testi** butonuna tiklayin
5. Basarili ise **Depolari Yukle** butonuna tiklayin
6. Varsayilan depoyu secin
7. **Kaydet** butonuna tiklayin
8. Otomatik senkronizasyon icin ilgili secenegi isaretleyin

### Secenekler

| Secenek | Aciklama |
|---------|----------|
| Entegrasyon Aktif | TAMSOFT entegrasyonunu etkinlestirir |
| Otomatik Senkronizasyon | Belirlenen aralikta otomatik sync yapar |
| Sadece Stoklu Urunler | Stok > 0 olan urunleri getirir |
| Sadece E-Ticaret Urunleri | E-ticaret isaretli urunleri getirir |
| Tek Barkod | Her urun icin sadece ana barkodu getirir |

### Manuel Senkronizasyon

1. TAMSOFT kartinda **Simdi Senkronize Et** butonuna tiklayin
2. Senkronizasyon tamamlaninca ozet bilgi gosterilir:
   - Toplam urun sayisi
   - Eklenen urun sayisi
   - Guncellenen urun sayisi
   - Basarisiz urun sayisi

## Sorun Giderme

### Sik Karsilasilan Hatalar

| Hata | Sebep | Cozum |
|------|-------|-------|
| "Token alinamadi" | Yanlis kullanici adi/sifre | Bilgileri kontrol edin |
| "Baglanti zaman asimi" | Sunucu erisilemez | API URL'i ve ag baglantisini kontrol edin |
| "Depo bulunamadi" | Gecersiz depo ID | Depolari tekrar yukleyin |
| "JSON parse hatasi" | API yanit sorunu | Loglari kontrol edin |

### Log Dosyalari

TAMSOFT entegrasyon loglari:
- `storage/logs/tamsoft.log` - Genel loglar
- `storage/logs/tamsoft-sync.log` - Senkronizasyon loglari
- `storage/logs/tamsoft-errors.log` - Hata loglari

### Debug Modu

Detayli loglama icin `tamsoft_settings` tablosunda `debug_mode` alanini `1` yapin.

## Guvenlik Notlari

- Sifreler veritabaninda sifrelenmis olarak saklanir
- API isteklerinde HTTPS kullanilmasi onerilir
- Token'lar 1 saat sonra otomatik olarak yenilenir
- Hassas veriler loglarda maskelenir

## Ilgili Dosyalar

| Dosya | Aciklama |
|-------|----------|
| services/TamsoftGateway.php | Ana gateway servisi |
| api/tamsoft/settings.php | Ayarlar API |
| api/tamsoft/test.php | Baglanti testi API |
| api/tamsoft/depolar.php | Depo listesi API |
| api/tamsoft/sync.php | Senkronizasyon API |
| database/migrations/046_tamsoft_erp_integration.sql | Veritabani semasi |
| public/assets/js/pages/settings/IntegrationSettings.js | Frontend UI |
| locales/tr/pages/settings.json | Turkce ceviriler |
| locales/en/pages/settings.json | Ingilizce ceviriler |

## Versiyon Gecmisi

| Versiyon | Tarih | Degisiklikler |
|----------|-------|---------------|
| 1.0.0 | 2026-02-05 | Ilk surum - Temel entegrasyon |

---

*Son guncelleme: 2026-02-05*
