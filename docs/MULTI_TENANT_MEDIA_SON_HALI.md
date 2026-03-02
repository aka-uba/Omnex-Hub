# Multi-Tenant Media Sistemi - Son Hali (v2.0.14)

Bu dokümantasyon, OmnexDisplayHub'ın firma bazlı dosya yönetim sistemini, lisans bağımlılıklarını, dizin yapısını ve iş akışını detaylı olarak açıklar.

**Son Güncelleme:** 2026-01-27
**Versiyon:** v2.0.14

---

## 1. Genel Bakış

### 1.1 Amaç

Multi-tenant ortamda her firmanın:
- Kendi medya dosyalarına sahip olması
- Depolama kotasının lisans tipine göre belirlenmesi
- Render işlemlerinin firma bazlı izole edilmesi
- Ürün güncellemelerinde otomatik render invalidation

### 1.2 Temel Bileşenler

| Bileşen | Dosya | Görev |
|---------|-------|-------|
| StorageService | `services/StorageService.php` | Kota kontrolü ve kullanım takibi |
| RenderService | `services/RenderService.php` | Render invalidation ve dosya yönetimi |
| Migration 051 | `database/migrations/051_company_storage_usage.sql` | Kullanım takip tablosu |
| Migration 052 | `database/migrations/052_product_renders.sql` | Render kayıt tablosu |
| Migration 053 | `database/migrations/053_add_storage_limit_to_companies.sql` | Firma depolama limiti |
| Migration 054 | `database/migrations/054_add_storage_limit_to_licenses.sql` | Lisans depolama limiti |

---

## 2. Dizin Yapısı

### 2.1 Firma Bazlı Depolama

```
storage/
├── companies/
│   └── {company_id}/
│       ├── media/
│       │   ├── images/          # Resim dosyaları
│       │   │   ├── products/    # Ürün görselleri
│       │   │   ├── templates/   # Şablon görselleri
│       │   │   └── general/     # Genel görseller
│       │   └── videos/          # Video dosyaları
│       │       ├── products/    # Ürün videoları
│       │       └── signage/     # Digital signage videoları
│       ├── renders/
│       │   └── {device_type}/
│       │       └── {locale}/
│       │           └── {template_id}/
│       │               └── {render_hash}.jpg
│       └── exports/             # Export dosyaları (geçici)
├── avatars/                     # Kullanıcı avatarları (global)
├── logos/                       # Firma logoları (global)
└── temp/                        # Geçici dosyalar
```

### 2.2 Render Cache Yapısı

```
storage/companies/{company_id}/renders/{device_type}/{locale}/{template_id}/{cache_key}.jpg

Örnek:
storage/companies/abc123/renders/esl/tr/tmpl456/f8a3b2c1d4e5.jpg
```

**Cache Key Bileşenleri:**
- `template_id` + `template_version`
- `product_id` + `product_version`
- `locale` + `resolution` + `device_type`

### 2.3 Dizin Oluşturma

Dizinler otomatik olarak şu durumlarda oluşturulur:
- Firma oluşturulduğunda (`CompanySeeder`)
- İlk dosya yüklendiğinde (`media/upload.php`)
- İlk render yapıldığında (`RenderService`)

---

## 3. Veritabanı Şeması

### 3.1 company_storage_usage Tablosu

Firma depolama kullanımını takip eder.

```sql
CREATE TABLE company_storage_usage (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    media_bytes INTEGER DEFAULT 0,        -- Media klasörü toplam boyut
    templates_bytes INTEGER DEFAULT 0,    -- Template klasörü toplam boyut
    renders_bytes INTEGER DEFAULT 0,      -- Render klasörü toplam boyut
    total_bytes INTEGER DEFAULT 0,        -- Toplam kullanım
    last_calculated_at TEXT,              -- Son hesaplama zamanı
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX idx_storage_company ON company_storage_usage(company_id);
CREATE INDEX idx_storage_total ON company_storage_usage(total_bytes);
```

### 3.2 product_renders Tablosu

Ürün render kayıtlarını ve durumlarını takip eder.

```sql
CREATE TABLE product_renders (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    device_type TEXT DEFAULT 'default',   -- esl, android_tv, web_display, etc.
    locale TEXT DEFAULT 'tr',             -- Dil kodu
    file_path TEXT NOT NULL,              -- Relative path (storage/ altında)
    file_size INTEGER DEFAULT 0,          -- Byte cinsinden
    product_version INTEGER DEFAULT 1,    -- Render zamanındaki ürün versiyonu
    template_version INTEGER DEFAULT 1,   -- Render zamanındaki şablon versiyonu
    render_hash TEXT,                     -- İçerik hash'i (cache key)
    status TEXT DEFAULT 'pending',        -- pending, processing, done, failed
    error_message TEXT,                   -- Hata durumunda mesaj
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,                    -- Render tamamlanma zamanı
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_renders_product ON product_renders(product_id);
CREATE INDEX idx_renders_company ON product_renders(company_id);
CREATE INDEX idx_renders_template ON product_renders(template_id);
CREATE UNIQUE INDEX idx_renders_unique ON product_renders(product_id, template_id, device_type, locale);
CREATE INDEX idx_renders_versions ON product_renders(product_id, product_version, template_version);
```

### 3.3 Eklenen Kolonlar

#### companies tablosu
```sql
ALTER TABLE companies ADD COLUMN storage_limit INTEGER DEFAULT 1073741824;
-- Varsayılan: 1GB (bytes cinsinden)
```

#### licenses tablosu
```sql
ALTER TABLE licenses ADD COLUMN storage_limit INTEGER DEFAULT 1024;
-- Varsayılan: 1024 MB

ALTER TABLE licenses ADD COLUMN period TEXT DEFAULT 'monthly';
-- Değerler: monthly, yearly, lifetime
```

---

## 4. Lisans Bağımlılıkları

### 4.1 Depolama Limiti Hiyerarşisi

Depolama limiti şu sırayla belirlenir:

1. **Lisans Tipi Kontrolü**
   - `ultimate` veya `unlimited` tip → Sınırsız (0 döner)
   - `lifetime` periyot → Sınırsız (0 döner)

2. **Lisans storage_limit Değeri**
   - Lisansta tanımlı ise bu değer kullanılır (MB cinsinden)

3. **Varsayılan Değer**
   - Yukarıdakiler yoksa: 1024 MB (1GB)

### 4.2 Lisans Tipleri ve Limitler

| Lisans Tipi | Depolama Limiti | Açıklama |
|-------------|-----------------|----------|
| starter | 1 GB | Başlangıç paketi |
| business | 5 GB | İş paketi |
| enterprise | 20 GB | Kurumsal paket |
| ultimate | Sınırsız | Premium paket |
| unlimited | Sınırsız | Özel anlaşma |

### 4.3 Periyot Etkileri

| Periyot | Depolama Davranışı |
|---------|-------------------|
| monthly | Normal limit uygulanır |
| yearly | Normal limit uygulanır |
| lifetime | Sınırsız depolama |

---

## 5. StorageService API

### 5.1 Kota Kontrolü

```php
$service = new StorageService();

// Yükleme öncesi kota kontrolü
$result = $service->checkQuota($companyId, $fileSizeBytes);

// Sonuç yapısı
[
    'allowed' => true|false,           // Yükleme izni
    'unlimited' => true|false,         // Sınırsız mı?
    'usage' => [...],                  // Kullanım detayları
    'limit_mb' => 1024,                // Limit (MB)
    'remaining_bytes' => 512000000,    // Kalan alan (bytes)
    'remaining_mb' => 488.28,          // Kalan alan (MB)
    'message' => '...'                 // Hata mesajı (izin yoksa)
]
```

### 5.2 Kullanım Bilgisi

```php
// Mevcut kullanımı al
$usage = $service->getUsage($companyId);

// Sonuç yapısı
[
    'media_bytes' => 150000000,
    'templates_bytes' => 5000000,
    'renders_bytes' => 20000000,
    'total_bytes' => 175000000,
    'total_mb' => 166.89,
    'last_calculated_at' => '2026-01-27 10:30:00'
]

// Zorla yeniden hesapla
$usage = $service->getUsage($companyId, true);
```

### 5.3 Kullanım Güncelleme

```php
// Dosya yükleme sonrası artır
$service->incrementUsage($companyId, $bytes, 'media');
$service->incrementUsage($companyId, $bytes, 'renders');

// Dosya silme sonrası azalt
$service->decrementUsage($companyId, $bytes, 'media');

// Türler: 'media', 'templates', 'renders'
```

### 5.4 Tam Hesaplama

```php
// Disk taraması ile hesapla (yavaş, doğru)
$usage = $service->recalculateUsage($companyId);
```

---

## 6. RenderService API

### 6.1 Render Invalidation

```php
$service = new RenderService();

// Ürün render'larını geçersiz kıl
$result = $service->invalidateProductRenders($productId, $companyId);

// Sonuç yapısı
[
    'deleted_files' => 5,      // Silinen dosya sayısı
    'freed_bytes' => 2500000,  // Boşaltılan alan (bytes)
    'freed_mb' => 2.38,        // Boşaltılan alan (MB)
    'errors' => []             // Hatalar (varsa)
]
```

### 6.2 Şablon Invalidation

```php
// Şablon render'larını geçersiz kıl
$result = $service->invalidateTemplateRenders($templateId, $companyId);
```

### 6.3 Firma Render Temizliği

```php
// Tüm firma render'larını sil
$result = $service->clearCompanyRenders($companyId);
```

---

## 7. API Endpoint'leri

### 7.1 Storage API

| Endpoint | Method | Auth | Açıklama |
|----------|--------|------|----------|
| `/api/storage/usage` | GET | User | Firma depolama kullanımı |
| `/api/storage/recalculate` | POST | Admin | Kullanımı yeniden hesapla |
| `/api/storage/all` | GET | Admin | Tüm firmaların kullanımı |

#### GET /api/storage/usage

```json
// Response
{
    "success": true,
    "data": {
        "usage": {
            "media_bytes": 150000000,
            "templates_bytes": 5000000,
            "renders_bytes": 20000000,
            "total_bytes": 175000000,
            "total_mb": 166.89
        },
        "limit": {
            "limit_mb": 1024,
            "limit_bytes": 1073741824,
            "unlimited": false
        },
        "remaining": {
            "remaining_bytes": 898741824,
            "remaining_mb": 857.11,
            "usage_percent": 16.3
        }
    }
}
```

#### POST /api/storage/recalculate

```json
// Response
{
    "success": true,
    "data": {
        "previous": { "total_bytes": 170000000 },
        "current": { "total_bytes": 175000000 },
        "difference_bytes": 5000000
    },
    "message": "Depolama kullanımı yeniden hesaplandı"
}
```

### 7.2 Media API Değişiklikleri

#### POST /api/media/upload

Kota kontrolü eklendi:

```php
// Kota kontrolü
$storageService = new StorageService();
$quotaCheck = $storageService->checkQuota($companyId, $fileSize);

if (!$quotaCheck['allowed']) {
    Response::error($quotaCheck['message'], 413);
}

// ... yükleme işlemi ...

// Kullanımı güncelle
$storageService->incrementUsage($companyId, $fileSize, 'media');
```

#### DELETE /api/media/:id

Kullanım azaltma eklendi:

```php
// Dosya bilgisi al
$media = $db->fetch("SELECT * FROM media WHERE id = ?", [$id]);
$fileSize = $media['file_size'] ?? 0;

// ... silme işlemi ...

// Kullanımı azalt
$storageService->decrementUsage($companyId, $fileSize, 'media');
```

#### GET /api/media

media_type filtresi eklendi:

```
GET /api/media?media_type=image   # Sadece resimler
GET /api/media?media_type=video   # Sadece videolar
```

### 7.3 Products API Değişiklikleri

#### PUT /api/products/:id

Version artırma ve render invalidation eklendi:

```php
// Version artır
$data['version'] = ($product['version'] ?? 0) + 1;

// Render'ları geçersiz kıl
$renderService = new RenderService();
$invalidationResult = $renderService->invalidateProductRenders($productId, $companyId);
```

---

## 8. İş Akışı

### 8.1 Dosya Yükleme Akışı

```
1. Kullanıcı dosya yükler
   ↓
2. StorageService.checkQuota() çağrılır
   ↓
3. Kota kontrolü:
   - Sınırsız lisans? → İzin ver
   - Limit altında mı? → İzin ver
   - Limit aşılacak mı? → 413 hatası dön
   ↓
4. Dosya kaydedilir:
   /storage/companies/{company_id}/media/{type}/{subdir}/{filename}
   ↓
5. StorageService.incrementUsage() çağrılır
   ↓
6. company_storage_usage tablosu güncellenir
   ↓
7. Başarı yanıtı döner
```

### 8.2 Ürün Güncelleme Akışı

```
1. Kullanıcı ürün günceller
   ↓
2. products.version kolonu artırılır
   ↓
3. RenderService.invalidateProductRenders() çağrılır
   ↓
4. product_renders tablosundan ilgili kayıtlar bulunur
   ↓
5. Her kayıt için:
   - Dosya silinir (disk)
   - Kayıt silinir (DB)
   - StorageService.decrementUsage() çağrılır
   ↓
6. Sonraki render isteğinde yeni görsel oluşturulur
```

### 8.3 Render Oluşturma Akışı

```
1. Render isteği gelir (ürün + şablon + cihaz tipi)
   ↓
2. product_renders tablosunda mevcut kayıt aranır:
   - product_id + template_id + device_type + locale
   ↓
3. Kayıt varsa ve güncel ise:
   - Mevcut dosya döner (cache hit)
   ↓
4. Kayıt yoksa veya eskiyse:
   - Yeni render oluşturulur
   - product_renders'a kayıt eklenir (status: pending)
   - Render işlemi yapılır
   - Status güncellenir (done veya failed)
   - StorageService.incrementUsage() çağrılır
   ↓
5. Render dosyası döner
```

### 8.4 Render Versiyon Kontrolü

```
Ürün versiyonu (products.version) değiştiğinde:
1. Render invalidation tetiklenir
2. Eski render dosyaları silinir
3. product_renders kayıtları silinir
4. Sonraki istekte yeni render oluşturulur

Bu sayede:
- Eski/güncel olmayan cache'ler temizlenir
- Disk alanı boşaltılır
- Kullanıcı her zaman güncel görsel görür
```

---

## 9. Performans Optimizasyonları

### 9.1 Cache Stratejileri

| Veri | Cache Süresi | Güncelleme |
|------|--------------|------------|
| Depolama kullanımı | 1 saat | Artımlı güncelleme (increment/decrement) |
| Render dosyaları | Sınırsız | Version değişince invalidation |
| Kota bilgisi | İstek bazlı | Her istek kontrol |

### 9.2 Artımlı Güncelleme

Disk taraması yerine artımlı güncelleme:

```php
// Yavaş (tam tarama)
$service->recalculateUsage($companyId);

// Hızlı (artımlı)
$service->incrementUsage($companyId, $bytes, 'media');
$service->decrementUsage($companyId, $bytes, 'media');
```

### 9.3 Batch İşlemler

Toplu silme işlemlerinde tek transaction:

```php
// RenderService.invalidateProductRenders() içinde
$db->beginTransaction();
try {
    // Tüm dosyaları sil
    // Tüm kayıtları sil
    // Kullanımı güncelle
    $db->commit();
} catch (Exception $e) {
    $db->rollback();
}
```

---

## 10. Güvenlik

### 10.1 Yetkilendirme

| Endpoint | Gerekli Yetki |
|----------|---------------|
| `/api/storage/usage` | Authenticated user (kendi firması) |
| `/api/storage/recalculate` | Admin |
| `/api/storage/all` | Admin |
| `/api/media/upload` | Authenticated user (kendi firması) |
| `/api/media/delete` | Authenticated user (kendi medyası) |

### 10.2 Firma İzolasyonu

Her sorgu `company_id` ile filtrelenir:

```php
$companyId = Auth::getActiveCompanyId();

// Medya sorgusu
$media = $db->fetch(
    "SELECT * FROM media WHERE id = ? AND company_id = ?",
    [$id, $companyId]
);

// Render sorgusu
$renders = $db->fetchAll(
    "SELECT * FROM product_renders WHERE product_id = ? AND company_id = ?",
    [$productId, $companyId]
);
```

### 10.3 Dosya Erişim Kontrolü

```php
// media/serve.php
$media = $db->fetch(
    "SELECT * FROM media WHERE id = ? AND company_id = ?",
    [$id, $companyId]
);

if (!$media) {
    Response::notFound('Dosya bulunamadı');
}
```

---

## 11. Hata Yönetimi

### 11.1 Kota Aşımı

```php
// HTTP 413 Payload Too Large
{
    "success": false,
    "message": "Depolama kotası aşıldı. Kullanılan: 950MB / 1024MB. Yüklemek istediğiniz dosya: 100MB"
}
```

### 11.2 Dosya Bulunamadı

```php
// HTTP 404 Not Found
{
    "success": false,
    "message": "Dosya bulunamadı"
}
```

### 11.3 Render Hatası

```sql
-- product_renders tablosunda
status = 'failed'
error_message = 'Template rendering failed: Invalid product data'
```

---

## 12. Bakım ve İzleme

### 12.1 Kullanım Raporu

```sql
-- Firma bazlı kullanım özeti
SELECT
    c.name as company_name,
    csu.total_bytes,
    csu.total_bytes / 1024 / 1024 as total_mb,
    l.storage_limit as limit_mb,
    ROUND((csu.total_bytes * 100.0) / (l.storage_limit * 1024 * 1024), 2) as usage_percent
FROM company_storage_usage csu
JOIN companies c ON csu.company_id = c.id
LEFT JOIN licenses l ON l.company_id = c.id
ORDER BY usage_percent DESC;
```

### 12.2 Render Durumu

```sql
-- Bekleyen render'lar
SELECT COUNT(*) FROM product_renders WHERE status = 'pending';

-- Başarısız render'lar
SELECT * FROM product_renders WHERE status = 'failed' ORDER BY created_at DESC;
```

### 12.3 Temizlik Scriptleri

```bash
# Eski render'ları temizle (30 günden eski)
php scripts/cleanup_old_renders.php --days=30

# Kullanımı yeniden hesapla (tüm firmalar)
php scripts/recalculate_all_storage.php
```

---

## 13. Test Senaryoları

### 13.1 Test Dosyası

`tests/v2014_integration_test.php` dosyası 27 test içerir:

| Bölüm | Test Sayısı | Açıklama |
|-------|-------------|----------|
| File Existence | 7 | Servis ve API dosyaları |
| Service Classes | 7 | Sınıf ve metod varlığı |
| Database Tables | 4 | Tablo ve kolon varlığı |
| Quota Simulation | 2 | Kota kontrolü |
| Integration | 7 | API entegrasyonu |

### 13.2 Test Çalıştırma

```bash
php tests/v2014_integration_test.php

# Beklenen çıktı:
# Total Tests: 27
# Passed: 27
# Failed: 0
# Success Rate: 100%
```

---

## 14. Versiyon Geçmişi

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| v2.0.14 | 2026-01-27 | İlk sürüm - Multi-tenant media sistemi |

---

## 15. İlgili Dosyalar

### 15.1 Servisler

| Dosya | Açıklama |
|-------|----------|
| `services/StorageService.php` | Depolama yönetimi |
| `services/RenderService.php` | Render yönetimi |

### 15.2 API Endpoint'leri

| Dosya | Açıklama |
|-------|----------|
| `api/storage/usage.php` | Kullanım bilgisi |
| `api/storage/recalculate.php` | Yeniden hesaplama |
| `api/storage/all.php` | Tüm firmalar özeti |
| `api/media/upload.php` | Dosya yükleme (kota kontrolü) |
| `api/media/delete.php` | Dosya silme (kullanım azaltma) |
| `api/media/index.php` | Dosya listesi (media_type filtresi) |
| `api/products/update.php` | Ürün güncelleme (render invalidation) |

### 15.3 Migration Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `database/migrations/051_company_storage_usage.sql` | Kullanım tablosu |
| `database/migrations/052_product_renders.sql` | Render tablosu |
| `database/migrations/053_add_storage_limit_to_companies.sql` | Firma limit kolonu |
| `database/migrations/054_add_storage_limit_to_licenses.sql` | Lisans limit kolonları |

### 15.4 Test Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `tests/v2014_integration_test.php` | Entegrasyon testleri |
| `tests/check_table.php` | Tablo yapısı kontrolü |

---

## 16. Sık Sorulan Sorular

### S: Kota aşıldığında ne olur?
**C:** Yükleme işlemi HTTP 413 hatası ile reddedilir. Kullanıcıya mevcut kullanım ve limit bilgisi gösterilir.

### S: Render'lar ne zaman güncellenir?
**C:** Ürün güncellendiğinde otomatik olarak eski render'lar silinir. Sonraki istekte yeni render oluşturulur.

### S: Sınırsız lisans nasıl belirlenir?
**C:** Lisans tipi `ultimate` veya `unlimited` ise, ya da periyot `lifetime` ise sınırsız kabul edilir.

### S: Kullanım bilgisi ne sıklıkla güncellenir?
**C:** Her dosya yükleme/silme işleminde artımlı güncellenir. Tam hesaplama için admin `recalculate` endpoint'ini kullanabilir.

### S: Eski render'lar otomatik silinir mi?
**C:** Hayır, sadece ürün güncellendiğinde ilgili render'lar silinir. Periyodik temizlik için cron job kurulabilir.

---

## 17. Dashboard Depolama Kartı (v2.0.14)

Dashboard sayfasına eklenen 5. analitik kart, firma bazlı depolama kullanımını görsel olarak gösterir.

### API Değişiklikleri (dashboard-stats.php)

Response'a eklenen yeni alanlar:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `storage_used_mb` | float | Kullanılan alan (MB) |
| `storage_limit_mb` | int | Limit (MB, 0=sınırsız) |
| `storage_unlimited` | bool | Sınırsız mı |
| `storage_breakdown` | object | Kategorik dağılım |
| `storage_breakdown.media_mb` | float | Medya dosyaları (MB) |
| `storage_breakdown.templates_mb` | float | Şablonlar (MB) |
| `storage_breakdown.renders_mb` | float | Render dosyaları (MB) |

### Dashboard.js Yardımcı Metodları

| Metod | Açıklama |
|-------|----------|
| `_storagePercent(stats)` | Kullanım yüzdesi (0-100) |
| `_storageIconColor(stats)` | İkon rengi (teal/amber/rose) |
| `_storageStrokeColor(stats)` | SVG çember rengi |
| `_storageFooterClass(stats)` | Footer CSS sınıfı |
| `_storageFooterIcon(stats)` | Footer ikon sınıfı |
| `_storageFooterText(stats)` | Footer metin (kalan/sınırsız) |
| `_formatStorage(mb)` | MB/GB formatlama |

### Renk Eşikleri

| Kullanım | İkon | Çember | Footer |
|----------|------|--------|--------|
| < %70 | teal | #14b8a6 | highlight |
| %70-%90 | amber | #f59e0b | highlight |
| > %90 | rose | #f43f5e | danger |

### CSS Değişiklikleri (dashboard.css)

- Grid: `repeat(4, 1fr)` → `repeat(5, 1fr)`
- 1400px breakpoint: 3 kolon
- Eklenen sınıflar: `.analytics-card-icon.teal`, `.analytics-card-footer.highlight.danger`

---

## 18. Depolama Bildirim Sistemi (v2.0.14)

Depolama kotası belirli eşiklere ulaştığında otomatik bildirim gönderilir.

### Eşikler ve Bildirim Tipleri

| Eşik | Tip | Öncelik | Başlık |
|------|-----|---------|--------|
| %75 | warning | high | Depolama Alanı Azalıyor |
| %90 | error | urgent | Depolama Alanı Kritik |

### Tetiklenme Noktaları

Bildirimler `StorageService::checkStorageNotification()` metodu ile tetiklenir:
- Her dosya yükleme sonrası (`incrementUsage()`)
- Dashboard verileri yüklendiğinde (`dashboard-stats.php`)

### Deduplikasyon

Aynı eşik seviyesinde günde 1'den fazla bildirim gönderilmez. `notifications` tablosunda son 24 saat içinde aynı company_id + title kombinasyonu kontrol edilir.

### NotificationTriggers Metodu

```php
NotificationTriggers::onStorageLimitWarning($companyId, $usedMB, $limitMB);
```

- Admin ve SuperAdmin rollerine bildirim gönderir
- `#/settings` linkiyle ayarlar sayfasına yönlendirir
- İkon: `ti-database`

### Bildirim Görüntüleme

Bildirimler aşağıdaki yerlerde görüntülenir:
- Header dropdown (zil ikonu)
- `/notifications` sayfası (tam liste)
- Toast bildirimi (ilk görüntülemede)
