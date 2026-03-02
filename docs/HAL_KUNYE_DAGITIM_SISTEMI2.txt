# HAL Künye Dağıtım Sistemi - Teknik Dokümantasyon

Bu doküman, Omnex Display Hub sistemindeki **HAL Künye Dağıtım Merkezi** özelliğinin iş akışını, teknik mimarisini ve çalışma süreçlerinin tamamını kapsar.

**Oluşturulma Tarihi:** 2026-02-17
**Versiyon:** 1.0.0

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Eski vs Yeni Sistem Karşılaştırması](#2-eski-vs-yeni-sistem-karşılaştırması)
3. [Sistem Mimarisi](#3-sistem-mimarisi)
4. [İş Akışı (End-to-End)](#4-iş-akışı-end-to-end)
5. [SOAP API Detayları](#5-soap-api-detayları)
6. [Backend Bileşenler](#6-backend-bileşenler)
7. [API Endpoint'leri](#7-api-endpointleri)
8. [Frontend Sayfa (Wizard)](#8-frontend-sayfa-wizard)
9. [Veritabanı Şeması](#9-veritabanı-şeması)
10. [Ayarlar ve Yapılandırma](#10-ayarlar-ve-yapılandırma)
11. [Dağıtım Tipleri (1'li / 2'li)](#11-dağıtım-tipleri-1li--2li)
12. [Ürün Eşleştirme Mantığı](#12-ürün-eşleştirme-mantığı)
13. [Hata Yönetimi](#13-hata-yönetimi)
14. [i18n (Çoklu Dil Desteği)](#14-i18n-çoklu-dil-desteği)
15. [Güvenlik](#15-güvenlik)
16. [Kapsam Dışı (İleri Aşama)](#16-kapsam-dışı-i̇leri-aşama)
17. [Dosya Haritası](#17-dosya-haritası)

---

## 1. Genel Bakış

### Problem

Mevcut HAL entegrasyonu yalnızca **tek künye numarası** ile sorgulama yapabiliyordu (`BildirimServisReferansKunyeler`). Ancak gerçek iş akışı şudur:

1. Firma, HAL'dan tarih aralığı + sıfat ile **tüm bildirimlerini** toplu çeker
2. Bu bildirimler fatura/irsaliye bazlı gruplanır
3. Her faturadaki ürünler, sistemdeki ürünlerle eşleştirilir
4. Künye numaraları ürünlere dağıtılır
5. Dağıtım sonuçları kaydedilir

### Çözüm

**Künye Dağıtım Merkezi** — 4 adımlı wizard arayüzü ile toplu bildirim sorgulama, belge bazlı seçim, ürün eşleştirme ve dağıtım yapabilen web sayfası.

### HALMIKROV16 İlişkisi

Bu özellik, **HALMIKROV16** adlı C# masaüstü programın `TumKunyeSorgula()` işlevinin web karşılığıdır. HALMIKROV16 aynı akışı Mikro ERP + HAL SOAP entegrasyonu ile yapıyordu; biz aynı SOAP metodunu (`BildirimciyeYapilanBildirimListesi`) kullanarak web arayüzü olarak uyguladık.

---

## 2. Eski vs Yeni Sistem Karşılaştırması

| Özellik | Eski (Tek Künye Sorgulama) | Yeni (Künye Dağıtım Merkezi) |
|---------|---------------------------|------------------------------|
| SOAP Metodu | `BildirimServisReferansKunyeler` | `BildirimciyeYapilanBildirimListesi` |
| Sorgulama | Tek künye no ile | Tarih aralığı + sıfat ile toplu |
| Sonuç | Tek `ReferansKunyeDTO` | Çoklu `BildirimSorguDTO[]` |
| Gruplama | Yok | BelgeNo + AracPlakaNo bazlı |
| Ürün Eşleştirme | Manuel (ürün formunda) | Otomatik + Manuel (wizard) |
| Dağıtım | Tek ürüne | Toplu dağıtım |
| Log | Yok | `hal_distribution_logs` tablosu |
| Servis | `HalKunyeService.php` | `HalBildirimService.php` |
| Sayfa | Ürün formu içi panel | Bağımsız wizard sayfası |

---

## 3. Sistem Mimarisi

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │            KunyeDistribution.js (4 Adımlı Wizard)           │    │
│  │                                                              │    │
│  │  Adım 1: Sorgula ──► Adım 2: Seç ──► Adım 3: Eşleştir    │    │
│  │                                              │              │    │
│  │                                         Adım 4: Sonuç      │    │
│  └──────────────┬──────────────────────────────┬───────────────┘    │
│                 │                              │                     │
│          GET /hal/bildirimler          POST /hal/distribute          │
│          GET /hal/settings             GET /products?search=         │
└─────────────────┬──────────────────────────────┬────────────────────┘
                  │              API              │
┌─────────────────▼──────────────────────────────▼────────────────────┐
│                          BACKEND (PHP)                               │
│                                                                      │
│  ┌──────────────────────┐  ┌───────────────────────┐                │
│  │  bildirimler.php     │  │  distribute.php        │                │
│  │  (Sorgulama API)     │  │  (Dağıtım API)         │                │
│  └──────────┬───────────┘  └──────────┬────────────┘                │
│             │                         │                              │
│  ┌──────────▼───────────┐  ┌──────────▼────────────┐                │
│  │ HalBildirimService   │  │  Database (SQLite)     │                │
│  │ - fetchBildirimler() │  │  - product_hal_data    │                │
│  │ - parseBildirimler() │  │  - hal_distribution_   │                │
│  │ - groupByBelge()     │  │    logs                │                │
│  └──────────┬───────────┘  └────────────────────────┘                │
│             │                                                        │
│     SOAP/HTTPS (cURL)                                                │
└─────────────┬────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│   HAL Web Service           │
│   hks.hal.gov.tr            │
│   BildirimService.svc       │
│                             │
│   BildirimciyeYapilan       │
│   BildirimListesi           │
└─────────────────────────────┘
```

---

## 4. İş Akışı (End-to-End)

### Ön Koşullar

1. **HAL ayarları yapılandırılmış olmalı:** Ayarlar > Entegrasyonlar > HAL bölümünden:
   - Kullanıcı adı (Vergi No)
   - Şifre
   - Servis şifresi
   - Bildirimci sıfatı (Market=7, Manav=8, vb.)
   - İkinci kişi sıfatı (opsiyonel)
2. **Ürünler sisteme tanımlı olmalı:** Eşleştirme yapılabilmesi için ürün veritabanında kayıtlar bulunmalı

### Adım Adım Akış

```
Kullanıcı                   Frontend                    Backend                     HAL Servisi
   │                           │                           │                            │
   │  Sayfayı aç               │                           │                            │
   │ ─────────────────────────►│                           │                            │
   │                           │  GET /hal/settings        │                            │
   │                           │──────────────────────────►│                            │
   │                           │  { sifat_id: 7, ... }     │                            │
   │                           │◄──────────────────────────│                            │
   │                           │                           │                            │
   │  Sıfat=7 önceden seçili   │                           │                            │
   │◄─────────────────────────│                           │                            │
   │                           │                           │                            │
   │  Tarih gir + "Sorgula"    │                           │                            │
   │ ─────────────────────────►│                           │                            │
   │                           │  GET /hal/bildirimler     │                            │
   │                           │  ?start_date=...          │                            │
   │                           │  &end_date=...            │                            │
   │                           │  &sifat_id=7              │                            │
   │                           │──────────────────────────►│                            │
   │                           │                           │  SOAP Request              │
   │                           │                           │  BildirimciyeYapilan...    │
   │                           │                           │───────────────────────────►│
   │                           │                           │                            │
   │                           │                           │  SOAP Response             │
   │                           │                           │  BildirimSorguDTO[]        │
   │                           │                           │◄───────────────────────────│
   │                           │                           │                            │
   │                           │                           │  XML Parse + Gruplama      │
   │                           │                           │  (BelgeNo bazlı)           │
   │                           │                           │                            │
   │                           │  { bildirimler, grouped } │                            │
   │                           │◄──────────────────────────│                            │
   │                           │                           │                            │
   │  Belge/Fatura kartları    │                           │                            │
   │  görüntülenir             │                           │                            │
   │◄─────────────────────────│                           │                            │
   │                           │                           │                            │
   │  Künyeleri seç (checkbox)  │                           │                            │
   │  "Eşleştirmeye Geç"       │                           │                            │
   │ ─────────────────────────►│                           │                            │
   │                           │                           │                            │
   │  Eşleştirme tablosu       │                           │                            │
   │  "Otomatik Eşleştir"      │                           │                            │
   │ ─────────────────────────►│                           │                            │
   │                           │  GET /products?search=    │                            │
   │                           │  (her künye için)         │                            │
   │                           │──────────────────────────►│                            │
   │                           │  { products[] }           │                            │
   │                           │◄──────────────────────────│                            │
   │                           │                           │                            │
   │  Eşleşen ürünler gösterilir│                          │                            │
   │  (Manuel düzeltme yapılabilir)                        │                            │
   │◄─────────────────────────│                           │                            │
   │                           │                           │                            │
   │  "Dağıt" butonuna bas     │                           │                            │
   │ ─────────────────────────►│                           │                            │
   │                           │  POST /hal/distribute     │                            │
   │                           │  { assignments: [...] }   │                            │
   │                           │──────────────────────────►│                            │
   │                           │                           │  product_hal_data INSERT   │
   │                           │                           │  hal_distribution_logs     │
   │                           │                           │  INSERT                    │
   │                           │                           │                            │
   │                           │  { distributed: N }       │                            │
   │                           │◄──────────────────────────│                            │
   │                           │                           │                            │
   │  Sonuç ekranı             │                           │                            │
   │  ✓ 5 künye dağıtıldı     │                           │                            │
   │◄─────────────────────────│                           │                            │
```

---

## 5. SOAP API Detayları

### Kullanılan Metod

| Alan | Değer |
|------|-------|
| **Servis** | BildirimService |
| **Endpoint** | `https://hks.hal.gov.tr/WebServices/BildirimService.svc` |
| **SOAP Action** | `http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisBildirimciyeYapilanBildirimListesi` |
| **Request Wrapper** | `BaseRequestMessageOf_BildirimSorguIstek` |
| **DataContract NS** | `http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract` |

### SOAP İstek Yapısı

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:web="http://www.gtb.gov.tr//WebServices">
    <soap:Body>
        <web:BaseRequestMessageOf_BildirimSorguIstek>
            <web:Istek xmlns:a="http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract">
                <a:BaslangicTarihi>2026-02-01T00:00:00</a:BaslangicTarihi>
                <a:BitisTarihi>2026-02-17T23:59:59</a:BitisTarihi>
                <a:KalanMiktariSifirdanBuyukOlanlar>true</a:KalanMiktariSifirdanBuyukOlanlar>
                <a:KunyeNo>0</a:KunyeNo>
                <a:KunyeTuru>1</a:KunyeTuru>
                <a:Sifat>7</a:Sifat>
                <a:UniqueId></a:UniqueId>
            </web:Istek>
            <web:Password>HAL_SIFRE</web:Password>
            <web:ServicePassword>SERVIS_SIFRESI</web:ServicePassword>
            <web:UserName>VERGI_NO</web:UserName>
        </web:BaseRequestMessageOf_BildirimSorguIstek>
    </soap:Body>
</soap:Envelope>
```

### İstek Parametreleri

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `BaslangicTarihi` | DateTime | Sorgulama başlangıç tarihi |
| `BitisTarihi` | DateTime | Sorgulama bitiş tarihi (max 31 gün aralık) |
| `KalanMiktariSifirdanBuyukOlanlar` | Boolean | `true` = sadece kalan miktarı > 0 olanlar |
| `KunyeNo` | Long | `0` = tarih aralığı ile tüm künyeler, `>0` = spesifik künye |
| `KunyeTuru` | Byte | Künye türü: `1` (varsayılan) veya `2` |
| `Sifat` | Integer | Bildirimci sıfatı ID (7=Market, 8=Manav vb.) |
| `UniqueId` | String | Boş gönderilir |
| `Password` | String | HAL kullanıcı şifresi |
| `ServicePassword` | String | HAL web servis şifresi |
| `UserName` | String | HAL kullanıcı adı (Vergi No) |

### SOAP Yanıt (BildirimSorguDTO)

Her bildirim kaydı şu alanları içerir:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `KunyeNo` | String | 19 haneli künye numarası |
| `MalinAdi` | String | Ürün adı (ör: "Elma Starking") |
| `MalinCinsi` | String | Ürün cinsi (ör: "Elma") |
| `MalinTuru` | String | Ürün türü (ör: "Taze Meyve") |
| `MalinMiktari` | Decimal | Toplam miktar |
| `KalanMiktar` | Decimal | Kalan miktar |
| `MiktarBirimiAd` | String | Birim adı (ör: "Kilogram") |
| `MiktarBirimId` | Integer | Birim ID |
| `BildirimTarihi` | DateTime | Bildirim tarihi |
| `BelgeNo` | String | Fatura/irsaliye belge numarası |
| `BelgeTipi` | String | Belge tipi |
| `AracPlakaNo` | String | Araç plaka numarası |
| `MalinSahibiTcKimlikVergiNo` | String | Mal sahibi TC/Vergi No |
| `UreticiTcKimlikVergiNo` | String | Üretici TC/Vergi No |
| `BildirimciTcKimlikVergiNo` | String | Bildirimci TC/Vergi No |
| `MalinCinsKodNo` | Integer | HAL ürün cins kodu |
| `MalinKodNo` | Integer | HAL ürün kodu |
| `MalinTuruKodNo` | Integer | HAL ürün türü kodu |
| `MalinSatisFiyati` | Decimal | Satış fiyatı |
| `Sifat` | Integer | Sıfat ID |
| `UniqueId` | String | Benzersiz tanımlayıcı |
| `GidecekIsyeriId` | Integer | Hedef işyeri ID |
| `GidecekYerTuruId` | Integer | Hedef yer türü ID |
| `AnalizStatus` | Integer | Analiz durumu |
| `RusumMiktari` | Decimal | Rüsum miktarı |
| `BildirimTuru` | Integer | Bildirim türü |

---

## 6. Backend Bileşenler

### HalBildirimService.php

**Konum:** `services/HalBildirimService.php`

Toplu bildirim sorgulama servisi. `HalKunyeService.php`'deki `sendCurlSoapRequest()` pattern'ini kullanır.

```php
class HalBildirimService
{
    // Ayar yükleme (HalKunyeService ile aynı SettingsResolver pattern)
    private function loadSettings(): void;

    // Kimlik bilgisi kontrolü
    public function hasCredentials(): bool;

    // cURL ile raw SOAP request
    private function sendCurlSoapRequest(string $soapAction, string $soapBody): array;

    // Ana sorgulama metodu
    public function fetchBildirimler(
        string $startDate,     // "2026-02-01"
        string $endDate,       // "2026-02-17"
        int $sifatId = 0,      // 7 = Market
        bool $onlyRemaining = true,
        int $kunyeTuru = 1
    ): array;

    // XML parse - Çoklu BildirimSorguDTO çıkarma
    public function parseBildirimlerResponse(string $xmlResponse): array;

    // BelgeNo + AracPlakaNo bazlı gruplama
    public function groupByBelge(array $bildirimler): array;
}
```

### Ayar Yükleme Hiyerarşisi

```
1. SettingsResolver → integration_settings tablosu (YENİ SİSTEM)
                      ↓ (bulunamazsa)
2. settings tablosu → hal_integration JSON key (ESKİ SİSTEM - fallback)
```

Bu sayede hem eski hem yeni ayar formatı desteklenir. `HalKunyeService.php` (tek künye sorgulama) ve `HalBildirimService.php` (toplu bildirim sorgulama) **aynı kimlik bilgilerini** kullanır.

---

## 7. API Endpoint'leri

### GET /api/hal/bildirimler

Tarih aralığı ve sıfat bazlı bildirim sorgulama.

**Query Parametreleri:**

| Parametre | Zorunlu | Tip | Açıklama |
|-----------|---------|-----|----------|
| `start_date` | Evet | String (YYYY-MM-DD) | Başlangıç tarihi |
| `end_date` | Evet | String (YYYY-MM-DD) | Bitiş tarihi |
| `sifat_id` | Hayır | Integer | Sıfat ID (varsayılan: 0) |
| `only_remaining` | Hayır | String | "true"/"false" (varsayılan: "true") |
| `kunye_turu` | Hayır | Integer | 1 veya 2 (varsayılan: 1) |

**Örnek İstek:**

```
GET /api/hal/bildirimler?start_date=2026-02-01&end_date=2026-02-17&sifat_id=7&only_remaining=true
Authorization: Bearer <JWT_TOKEN>
```

**Başarılı Yanıt:**

```json
{
    "success": true,
    "data": {
        "bildirimler": [
            {
                "KunyeNo": "2073079250202837944",
                "MalinAdi": "Elma Starking",
                "MalinCinsi": "Elma",
                "MalinTuru": "Taze Meyve",
                "MalinMiktari": "500.0",
                "KalanMiktar": "300.0",
                "MiktarBirimiAd": "Kilogram",
                "BelgeNo": "FAT-2026-001",
                "AracPlakaNo": "34ABC123",
                "BildirimTarihi": "2026-02-10T08:30:00"
            }
        ],
        "grouped": {
            "FAT-2026-001 (34ABC123)": {
                "belge_no": "FAT-2026-001",
                "plaka": "34ABC123",
                "items": [...],
                "total_miktar": 700.0,
                "total_kalan": 500.0
            }
        },
        "total": 5,
        "params": {
            "start_date": "2026-02-01",
            "end_date": "2026-02-17",
            "sifat_id": 7,
            "only_remaining": true,
            "kunye_turu": 1
        }
    }
}
```

**Validasyonlar:**
- Tarih formatı: `YYYY-MM-DD`
- Tarih aralığı: max 31 gün (HAL limiti)
- Başlangıç < Bitiş kontrolü
- HAL kimlik bilgileri yapılandırılmış olmalı

---

### POST /api/hal/distribute

Seçili künyeleri ürünlere dağıtır.

**İstek Body:**

```json
{
    "assignments": [
        {
            "kunye_no": "2073079250202837944",
            "product_id": "uuid-abc-123",
            "miktar": 500.0,
            "kalan_miktar": 300.0,
            "type": "full",
            "malin_adi": "Elma Starking",
            "malin_cinsi": "Elma",
            "belge_no": "FAT-2026-001",
            "sifat_id": 7,
            "bildirim_tarihi": "2026-02-10T08:30:00"
        }
    ]
}
```

**Her Assignment İçin Yapılan İşlemler:**

1. **Ürün varlık kontrolü:** `products` tablosunda `id` + `company_id` eşleşmesi
2. **product_hal_data INSERT/UPDATE:** Künye-ürün bağlantısı
3. **hal_distribution_logs INSERT:** Dağıtım geçmişi kaydı

**Başarılı Yanıt:**

```json
{
    "success": true,
    "data": {
        "distributed": 3,
        "skipped": 0,
        "errors": [],
        "total": 3
    },
    "message": "3 künye başarıyla dağıtıldı"
}
```

---

## 8. Frontend Sayfa (Wizard)

### Konum

- **Route:** `#/products/kunye-distribution`
- **Dosya:** `public/assets/js/pages/hal/KunyeDistribution.js`
- **Menü:** Sidebar > Yönetim > Künye Dağıtım (ti-leaf ikonu)

### Yaşam Döngüsü

```javascript
preload()  → i18n çevirileri yüklenir (hal-distribution)
render()   → 4 adımlı wizard HTML oluşturulur
init()     → Event binding + HAL ayarları yüklenir (sıfat önceden seçilir)
destroy()  → Çeviriler temizlenir
```

### Adım 1: Bildirim Sorgulama

```
┌─────────────────────────────────────────────────────────┐
│ Başlangıç Tarihi │ Bitiş Tarihi │ Sıfat   │ Sadece   │
│ [2026-02-10]     │ [2026-02-17] │ [Market]│ ☑ Kalan  │
│                                             │ [Sorgula]│
└─────────────────────────────────────────────────────────┘
```

- Tarihler varsayılan olarak son 7 gün gelir
- Sıfat, HAL ayarlarındaki `sifat_id` ile önceden seçilir
- "Sadece kalan miktarı > 0" varsayılan olarak aktif
- `GET /api/hal/bildirimler` çağrılır

### Adım 2: Belge Seçimi (Accordion)

```
┌─ Belge: FAT-2026-001 (Plaka: 34ABC123) ──────────────┐
│  ☑ Tümünü Seç                           Kalan: 500 kg │
│  ──────────────────────────────────────────────────────│
│  ☑ Elma Starking  │ Elma / Taze │ 500 kg │ Kalan:300  │
│  ☑ Portakal       │ Narenciye   │ 200 kg │ Kalan:200  │
└────────────────────────────────────────────────────────┘
┌─ Belge: FAT-2026-002 ────────────────────────────────┐
│  ☐ Tümünü Seç                          Kalan: 1000 kg │
│  ──────────────────────────────────────────────────────│
│  ☐ Domates        │ Sebze       │ 1000kg │ Kalan:1000 │
└────────────────────────────────────────────────────────┘
```

- Bildirimler `BelgeNo + AracPlakaNo` bazlı accordion kartları olarak gösterilir
- Her belge grubu içinde ürünler checkbox ile seçilebilir
- "Tümünü Seç" ile gruptaki tüm ürünler seçilir
- Seçilen künyeler Adım 3'e taşınır

### Adım 3: Ürün Eşleştirme & Dağıtım

```
┌──────────────────────────────────────────────────────┐
│ HAL Ürün       │ Belge  │ Miktar│ Kalan│ Tip   │ Ürün│
│────────────────│────────│───────│──────│───────│─────│
│ Elma Starking  │FAT-001 │ 500  │ 300  │[1'li] │ [✓] │
│ 20730792502... │        │      │      │       │Elma │
│────────────────│────────│───────│──────│───────│─────│
│ Portakal       │FAT-001 │ 200  │ 200  │[2'li] │ [?] │
│ 20840312506... │        │      │      │       │Seç..│
└──────────────────────────────────────────────────────┘
                                    [Otomatik Eşleştir]
                                              [Dağıt]
```

**Otomatik Eşleştir:** Her künye için `MalinAdi` ile `GET /products?search={malinAdi}&limit=1` sorgusu yapılır. İlk eşleşen ürün otomatik atanır.

**Manuel Eşleştirme:** Ürün seçme butonuna tıklanınca modal açılır. Modal içinde ürün arama yapılır ve sonuçlardan biri seçilir.

**Dağıtım Tipi:** Her satır için 1'li (tam) veya 2'li (bölünmüş) seçilebilir.

### Adım 4: Sonuç

```
┌──────────────────────────────────────┐
│ ✓ 3 künye başarıyla dağıtıldı       │
│ ⚠ 1 künye atlandı                   │
│ ✗ 0 künye hata verdi                │
│                                      │
│ [Ürünlere Git]  [Yeni Dağıtım]      │
└──────────────────────────────────────┘
```

---

## 9. Veritabanı Şeması

### hal_distribution_logs (YENİ)

Künye dağıtım geçmişi tablosu.

```sql
CREATE TABLE hal_distribution_logs (
    id                TEXT PRIMARY KEY,
    company_id        TEXT NOT NULL,        -- Firma ID (multi-tenant)
    kunye_no          TEXT NOT NULL,        -- 19 haneli künye numarası
    product_id        TEXT NOT NULL,        -- Eşleştirilen ürün ID
    belge_no          TEXT,                 -- Fatura/irsaliye no
    distribution_type TEXT DEFAULT 'full',  -- 'full' veya 'split'
    assigned_miktar   REAL,                 -- Atanan miktar
    kalan_miktar      REAL,                 -- Kalan miktar
    sifat_id          INTEGER,             -- Sorgulama sıfatı
    bildirim_tarihi   TEXT,                 -- HAL bildirim tarihi
    malin_adi         TEXT,                 -- HAL ürün adı
    malin_cinsi       TEXT,                 -- HAL ürün cinsi
    distributed_by    TEXT,                 -- Dağıtımı yapan kullanıcı ID
    created_at        TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX idx_hal_dist_company ON hal_distribution_logs(company_id);
CREATE INDEX idx_hal_dist_product ON hal_distribution_logs(product_id);
CREATE INDEX idx_hal_dist_kunye   ON hal_distribution_logs(kunye_no);
```

### product_hal_data (MEVCUT)

Ürün-künye bağlantı tablosu. Dağıtım sırasında INSERT/UPDATE yapılır.

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | TEXT | UUID |
| product_id | TEXT | Ürün FK |
| kunye_no | TEXT | 19 haneli künye no |
| malin_adi | TEXT | HAL ürün adı |
| malin_cinsi | TEXT | HAL ürün cinsi |
| created_at | TEXT | Oluşturulma zamanı |
| updated_at | TEXT | Güncellenme zamanı |

### İlişki Diyagramı

```
products (1) ──── (N) product_hal_data ──── (N) hal_distribution_logs
    │                     │                         │
    │ id                  │ product_id              │ product_id
    │ name                │ kunye_no                │ kunye_no
    │ company_id          │ malin_adi               │ company_id
    │                     │                         │ belge_no
    │                     │                         │ distributed_by → users.id
```

---

## 10. Ayarlar ve Yapılandırma

### HAL Entegrasyon Ayarları

**Konum:** Ayarlar > Entegrasyonlar > HAL Kayıt Sistemi

| Alan | Açıklama | Künye Dağıtımda Kullanım |
|------|----------|--------------------------|
| `username` | HAL kullanıcı adı (Vergi No) | SOAP `<web:UserName>` |
| `password` | HAL şifresi | SOAP `<web:Password>` |
| `service_password` | HAL web servis şifresi | SOAP `<web:ServicePassword>` |
| `tc_vergi_no` | TC/Vergi No (opsiyonel) | Kullanılmaz (bildirim sorgulamada vergi no gerekmiyor) |
| `sifat_id` | Birinci sıfat ID | Sayfa açılışında varsayılan sıfat seçimi |
| `sifat2_id` | İkinci sıfat ID (YENİ) | İkinci kişi sıfatı (opsiyonel) |
| `enabled` | Entegrasyon aktif mi | Sayfa açılışında uyarı kontrolü |

### Sıfat (Kişi Tipi) Referansı

| ID | Sıfat |
|----|-------|
| 0 | Seçiniz |
| 1 | Sanayici |
| 2 | İhracatçı |
| 3 | İthalatçı |
| 4 | Üretici |
| 5 | Komisyoncu |
| 6 | Tüccar |
| 7 | **Market** (en yaygın) |
| 8 | Manav |
| 9 | Depo/Tasnif |
| 10 | Üretici Örgütü |
| 11 | Pazarcı |
| 12 | Otel |
| 13 | Lokanta |
| 14 | Yurt |
| 15 | Yemek Fabrikası |
| 16 | Hastane |
| 17 | Tüccar (Hal Dışı) |

---

## 11. Dağıtım Tipleri (1'li / 2'li)

### 1'li (Tam) Dağıtım - `type: "full"`

Bir künye numarası **tek bir ürüne** bütün olarak atanır.

```
Künye: 2073079250202837944 (Elma 500 kg, Kalan: 300 kg)
  └──► Ürün: "Elma Starking" → product_hal_data kaydı oluşturulur
```

### 2'li (Bölünmüş) Dağıtım - `type: "split"`

Bir künye numarası **iki ürüne** miktar bazlı bölünerek atanır. Bu durum, aynı parti malın farklı ürün kartlarına dağıtılması gerektiğinde kullanılır.

```
Künye: 2073079250202837944 (Portakal 200 kg, Kalan: 200 kg)
  ├──► Ürün A: "Portakal (1. Kalite)" → 150 kg
  └──► Ürün B: "Portakal (2. Kalite)" → 50 kg
```

> **Not:** Mevcut implementasyonda 2'li dağıtım seçeneği frontend'de sunulur ancak miktar bölme UI'ı henüz detaylı uygulanmamıştır. Bu ileri aşamada geliştirilebilir.

---

## 12. Ürün Eşleştirme Mantığı

### Otomatik Eşleştirme

1. Her seçili künye için `MalinAdi` alınır (ör: "Elma Starking")
2. `GET /products?search=Elma Starking&limit=1` sorgusu yapılır
3. İlk sonuç (en iyi eşleşme) otomatik atanır
4. Eşleşme bulunamazsa boş bırakılır (kullanıcı manuel seçer)

### Manuel Eşleştirme

1. "Ürün Seç" butonuna tıklanır
2. Modal açılır, `MalinAdi` ile ön doldurulmuş arama yapılır
3. Kullanıcı arama terimini değiştirebilir
4. Sonuçlar listesinden ürün seçilir (ad, SKU, barkod gösterilir)

### Eşleştirme Önceliği

```
1. Ürün adı eşleşmesi (case-insensitive, contains)
2. Kullanıcı manuel seçimi
3. Eşleşme yok → Dağıtım yapılamaz (tüm satırlar eşleştirilmeli)
```

---

## 13. Hata Yönetimi

### Backend Hataları

| Hata | HTTP | Açıklama | Çözüm |
|------|------|----------|-------|
| Tarih eksik | 400 | start_date/end_date boş | Tarih alanlarını doldurun |
| Tarih format hatası | 400 | YYYY-MM-DD formatında değil | Doğru format girin |
| Tarih aralığı aşımı | 400 | 31 günden fazla | Aralığı daraltın |
| HAL ayarları eksik | 400 | Credentials yapılandırılmamış | Entegrasyon ayarlarını yapın |
| SOAP hatası | 500 | HAL sunucusu erişilemez | HAL durumunu kontrol edin |
| HAL HataKodu ≠ 0 | 500 | HAL servis hatası | Hata koduna göre işlem yapın |

### Frontend Hataları

| Durum | Mesaj | Çözüm |
|-------|-------|-------|
| Sayfa açıldığında HAL yapılandırılmamış | Toast uyarı | Entegrasyon ayarlarına git |
| Sorguda sonuç yok | "Bildirim bulunamadı" | Tarih aralığını/sıfatı değiştir |
| Künye seçilmeden 3. adıma geçiş | "En az bir künye seçin" | Checkbox'ları işaretle |
| Ürün eşleştirmesi eksik | "Tüm eşleştirmeleri tamamlayın" | Manuel eşleştir |
| Dağıtım hatası | Detaylı hata listesi | Hata kayıtlarını kontrol et |

---

## 14. i18n (Çoklu Dil Desteği)

### Desteklenen Diller

| Dil | Dosya | Sayfa Çevirisi | Menü Çevirisi |
|-----|-------|----------------|---------------|
| Türkçe | `locales/tr/` | `pages/hal-distribution.json` | `common.json` |
| English | `locales/en/` | `pages/hal-distribution.json` | `common.json` |
| العربية | `locales/ar/` | `pages/hal-distribution.json` | `common.json` |
| Azərbaycanca | `locales/az/` | `pages/hal-distribution.json` | `common.json` |
| Deutsch | `locales/de/` | `pages/hal-distribution.json` | `common.json` |
| Nederlands | `locales/nl/` | `pages/hal-distribution.json` | `common.json` |
| Français | `locales/fr/` | `pages/hal-distribution.json` | `common.json` |
| Русский | `locales/ru/` | `pages/hal-distribution.json` | `common.json` |

### Çeviri Yapısı (hal-distribution.json)

```
title, subtitle           → Sayfa başlığı
breadcrumb.*              → Breadcrumb navigasyonu
steps.*                   → Wizard adım etiketleri
form.*                    → Sorgulama formu alanları
belge.*                   → Belge seçimi bölümü
assign.*                  → Ürün eşleştirme bölümü
result.*                  → Sonuç bölümü ({count} parametreli)
errors.*                  → Hata mesajları
sifat.{0-17}              → Sıfat dropdown seçenekleri
```

### Ayarlar Sayfası Çevirileri (settings.json)

`sifat2_id` alanı için eklenen key'ler:
- `integrations.hal.fields.sifat2Id` → "İkinci Kişi Sıfatı"
- `integrations.hal.hints.sifat2Id` → "İkinci kişi sıfatını seçin (opsiyonel)"

---

## 15. Güvenlik

| Katman | Kontrol |
|--------|---------|
| **Auth** | JWT token zorunlu (AuthMiddleware) |
| **Multi-Tenant** | `Auth::getActiveCompanyId()` ile firma izolasyonu |
| **SOAP Credentials** | Şifreler DB'de saklanır, API yanıtında maskelenir |
| **Input Validation** | Tarih formatı regex, aralık kontrolü, ürün varlık kontrolü |
| **SQL Injection** | PDO prepared statements, tablo whitelist |
| **XSS** | Frontend `escapeHtml()` ile HTML encode |
| **CSRF** | CsrfMiddleware (API route grubunda) |
| **Rate Limiting** | ApiGuardMiddleware (100 req/60sn) |

---

## 16. Kapsam Dışı (İleri Aşama)

Bu implementasyonda **yapılmayan** ancak ileride eklenebilecek özellikler:

| Özellik | Açıklama | HAL Metodu |
|---------|----------|------------|
| HAL'a bildirim gönderme | Yeni bildirim oluşturma | `BildirimServisBildirimKaydet` |
| Künye oluşturma | Yeni künye numarası alma | `BildirimServisKunyeOlustur` |
| Ürün/Cins/Tür listeleri | HAL'dan ürün kodları çekme | `GenelService` metodları |
| CloneItem / ROW_CLONE | ERP satır kopyalama | Stored procedure |
| 2'li dağıtım miktar bölme UI | Detaylı miktar girişi | Frontend geliştirme |
| Dağıtım geri alma | Yapılan dağıtımı iptal etme | DB rollback |
| Toplu dağıtım raporu | Excel/PDF export | ExportManager |

---

## 17. Dosya Haritası

### Yeni Oluşturulan Dosyalar

| Dosya | Tür | Açıklama |
|-------|-----|----------|
| `services/HalBildirimService.php` | PHP Service | SOAP sorgulama servisi |
| `api/hal/bildirimler.php` | PHP API | Bildirim sorgulama endpoint |
| `api/hal/distribute.php` | PHP API | Künye dağıtım endpoint |
| `database/migrations/092_create_hal_distribution_tables.sql` | SQL | Migration dosyası |
| `public/assets/js/pages/hal/KunyeDistribution.js` | JS Page | 4 adımlı wizard sayfası |
| `locales/{8 dil}/pages/hal-distribution.json` | JSON | Sayfa çevirileri (8 dosya) |

### Düzenlenen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `core/Database.php` | `hal_distribution_logs` whitelist eklendi |
| `api/index.php` | 2 yeni route: `/bildirimler`, `/distribute` |
| `api/hal/settings.php` | `sifat2_id` PUT desteği |
| `public/assets/js/pages/settings/IntegrationSettings.js` | sifat2 dropdown (render + populate + save) |
| `public/assets/js/app.js` | `/products/kunye-distribution` route |
| `public/assets/js/layouts/LayoutManager.js` | Sidebar menü öğesi |
| `locales/{8 dil}/pages/settings.json` | `sifat2Id` field + hint |
| `locales/{8 dil}/common.json` | `layout.menu.kunyeDistribution` key |
