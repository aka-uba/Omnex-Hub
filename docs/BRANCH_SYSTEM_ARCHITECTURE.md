# 🏢 Şube/Bölge Yapısı Mimari Planı

**Versiyon:** 2.4
**Tarih:** 2026-01-31
**Durum:** PLAN AŞAMASINDA - Onay bekliyor
**Son Güncelleme:** Cihazlar sistemi şube entegrasyonu eklendi

---

## 📋 İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Mimari Kararlar](#2-mimari-kararlar)
3. [Veritabanı Şeması](#3-veritabanı-şeması)
4. [Servis Katmanı](#4-servis-katmanı)
5. [API Tasarımı](#5-api-tasarımı)
6. [Frontend Değişiklikleri](#6-frontend-değişiklikleri)
7. [Import/Export Sistemi](#7-importexport-sistemi)
8. [Erişim Kontrolü](#8-erişim-kontrolü)
9. [Lisanslama](#9-lisanslama)
10. [Implementasyon Planı](#10-implementasyon-planı)
11. [Revizyon Notları](#11-revizyon-notları)

---

## 1. Genel Bakış

### 1.1 Amaç

Omnex Display Hub'a çok şubeli firma desteği eklemek. Mevcut tenant (company) yapısını bozmadan, şube bazlı fiyat, kampanya, stok ve uyumluluk (HAL künye vb.) farklılıklarını desteklemek.

### 1.2 Mevcut Durum

```
Firma (Company) ─── Tenant Root
├── Ürünler (products) ─── company_id ile izole
├── Cihazlar (devices) ─── company_id + group_id
├── Şablonlar (templates) ─── company_id + scope
├── Medya (media) ─── company_id
├── Kategoriler (categories) ─── company_id
├── Kullanıcılar (users) ─── company_id + role
└── Lisans (license) ─── company_id (1:1)
```

**Mevcut Eksiklikler:**
- ❌ Şube/lokasyon kavramı yok
- ❌ Ürün fiyatları şubeye göre değişmiyor
- ❌ Kampanya/indirimler şubeye özel değil
- ❌ HAL künye şubeye özel değil
- ❌ Kullanıcılar şubeye atanmıyor
- ❌ Stok şube bazlı takip edilmiyor

### 1.3 Hedef Durum

```
Firma (Company) ─── Tenant Root
├── Şubeler (branches) ─── YENİ
│   ├── Bölge: Marmara (type: region)
│   │   ├── Şube: İstanbul Kadıköy (type: store)
│   │   └── Şube: İstanbul Beşiktaş (type: store)
│   └── Bölge: Ege (type: region)
│       └── Şube: İzmir Alsancak (type: store)
│
├── Ürünler (products) ─── Master veriler (tek kaynak)
│   └── Override'lar (product_branch_overrides) ─── Şube farklılıkları
│
├── Cihazlar (devices) ─── branch_id ile şube bağlantısı
│   └── device_groups ─── Toplu gönderim için (şube organizasyonu DEĞİL)
├── Şablonlar (templates) ─── Firma bazlı kalacak
├── Medya (media) ─── Firma bazlı kalacak
├── Kategoriler (categories) ─── Firma bazlı kalacak
└── Kullanıcılar (users) ─── Şube erişim tablosu ile
```

---

## 2. Mimari Kararlar

### 2.1 Seçilen Strateji: Override Pattern

**Neden Override Pattern?**

| Alternatif | Dezavantaj |
|------------|------------|
| Şube ürünü (ayrı entity) | Data duplication, senkronizasyon kabusu |
| Her şube için ürün kopyası | 1000 ürün × 10 şube = 10.000 kayıt |
| Şube alt-tenant | Lisans, yetki, rapor karmaşıklığı |

**Override Pattern Avantajları:**
- ✅ Master ürün tek gerçek kaynak kalır
- ✅ Şube farklılığı istisna, kural değil
- ✅ Veritabanı şişmez
- ✅ Mevcut kod minimum değişir
- ✅ Geriye uyumluluk tam

### 2.2 Kırmızı Çizgiler (Asla Yapılmayacak)

```
❌ "Şube ürünü" diye ayrı entity YARATILMAYACAK
❌ Ürün tablosuna branch_id EKLENMEYECEK
❌ Her şube için ürün kopyası OLUŞTURULMAYACAK
❌ Medya şubeye özel YAPILMAYACAK
❌ Şablonlar şubeye özel YAPILMAYACAK
❌ Kategoriler şubeye özel YAPILMAYACAK
```

### 2.3 Override Felsefesi

```
⚠️ KRİTİK KURAL:
   NULL = Master'dan gelir (override yok)
   Değer = Branch override (bu şubede farklı)

Bu kuralı tüm ekip üyelerinin bilmesi şart!
6 ay sonra biri 0 ile NULL'ı karıştırabilir.
```

### 2.4 Kesinleşmiş Kararlar

| Karar | Seçim | Notlar |
|-------|-------|--------|
| Strateji | Override Pattern | Master ürün tek kaynak |
| Medya | Firma bazlı | Şubeye özel medya YOK |
| Şablonlar | Firma bazlı | Şubeye özel şablon YOK |
| Kategoriler | Firma bazlı | Şubeye özel kategori YOK |
| Lisans | Firma + branch_limit | Opsiyon A |
| ERP Import | Şube kodlu + mod seçimi | Manuel + Otomatik |
| Bölge (region) | Ücretsiz | Sadece organizasyonel |

---

## 3. Veritabanı Şeması

### 3.1 Şubeler Tablosu (branches)

```sql
-- Migration: 060_create_branches.sql

CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    parent_id TEXT,                      -- Bölge hiyerarşisi için (region → store)

    -- Tanımlama
    code TEXT NOT NULL,                  -- İç şube kodu (örn: IST-001)
    external_code TEXT,                  -- ERP / SAP / Logo kodu (farklı olabilir)
    name TEXT NOT NULL,                  -- Şube adı
    type TEXT DEFAULT 'store',           -- 'region', 'store', 'warehouse', 'online'

    -- İletişim
    address TEXT,
    city TEXT,
    district TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'TR',
    phone TEXT,
    email TEXT,

    -- Konum (harita için)
    latitude REAL,
    longitude REAL,

    -- Yönetim
    manager_user_id TEXT,                -- Şube müdürü
    timezone TEXT DEFAULT 'Europe/Istanbul',
    currency TEXT DEFAULT 'TRY',

    -- Durum
    is_active INTEGER DEFAULT 1,
    is_virtual INTEGER DEFAULT 0,        -- Online satış / sanal depo / merkez fiyat

    -- Ayarlar
    settings TEXT,                       -- JSON: özel ayarlar

    -- Sıralama
    sort_order INTEGER DEFAULT 0,

    -- Zaman damgaları
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    -- Kısıtlamalar
    UNIQUE(company_id, code),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_branches_parent ON branches(parent_id);
CREATE INDEX idx_branches_type ON branches(type);
CREATE INDEX idx_branches_external_code ON branches(company_id, external_code);
CREATE INDEX idx_branches_active ON branches(company_id, is_active);
```

**Şube Tipleri:**

| Tip | Açıklama | Lisans Sayılır | Örnek |
|-----|----------|----------------|-------|
| `region` | Bölge (organizasyonel) | ❌ Hayır | Marmara Bölgesi |
| `store` | Fiziksel mağaza | ✅ Evet | İstanbul Kadıköy |
| `warehouse` | Depo | ✅ Evet | Merkez Depo |
| `online` | Online/sanal şube | ✅ Evet | E-Ticaret |

**external_code Kullanım Senaryosu:**
```
Omnex Kodu: IST-001
ERP Kodu: 34001
SAP Kodu: TR_IST_KADIKOY
Logo Kodu: 001

Import sırasında herhangi biriyle eşleşme yapılabilir.
```

**is_virtual Kullanım Senaryosu:**
```
- Online satış kanalı (merkez fiyat)
- Toplu satış / B2B
- Raporlama amaçlı sanal şube
- Merkez fiyat listesi
```

### 3.2 Ürün Şube Override Tablosu (product_branch_overrides)

```sql
-- Migration: 061_create_product_branch_overrides.sql

CREATE TABLE product_branch_overrides (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,

    -- ⚠️ OVERRIDE FELSEFESİ:
    -- NULL = Master'dan gelir (override yok)
    -- Değer = Branch override (bu şubede farklı)

    -- Override kapsamı (raporlama ve UI için kritik)
    override_scope TEXT DEFAULT 'price',  -- 'price', 'campaign', 'stock', 'compliance', 'full'

    -- Fiyat override'ları
    current_price REAL,                   -- NULL = master fiyat
    previous_price REAL,                  -- NULL = master önceki fiyat
    price_updated_at TEXT,
    price_valid_until TEXT,               -- Fiyat geçerlilik bitiş

    -- Kampanya/indirim override'ları
    discount_percent REAL,
    discount_amount REAL,                 -- Sabit tutar indirimi
    campaign_text TEXT,
    campaign_start TEXT,
    campaign_end TEXT,

    -- HAL künye override (genişletilebilir)
    kunye_no TEXT,
    kunye_data TEXT,                      -- JSON: ek künye bilgileri

    -- Stok bilgisi
    stock_quantity INTEGER,
    min_stock_level INTEGER,
    max_stock_level INTEGER,
    reorder_point INTEGER,

    -- Raf/konum bilgisi
    shelf_location TEXT,
    aisle TEXT,
    shelf_number TEXT,

    -- Durum
    is_available INTEGER DEFAULT 1,       -- Bu şubede satışta mı
    availability_reason TEXT,             -- Neden satışta değil

    -- Override kaynağı (audit için kritik)
    source TEXT DEFAULT 'manual',         -- 'manual', 'import', 'api', 'sync'
    source_reference TEXT,                -- Import batch ID, API request ID vb.

    -- Zaman damgaları
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    updated_by TEXT,

    -- Soft delete (audit trail için)
    deleted_at TEXT,                      -- NULL = aktif, timestamp = silinmiş
    deleted_by TEXT,

    -- Kısıtlamalar
    UNIQUE(product_id, branch_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_pbo_product ON product_branch_overrides(product_id);
CREATE INDEX idx_pbo_branch ON product_branch_overrides(branch_id);
CREATE INDEX idx_pbo_scope ON product_branch_overrides(override_scope);
CREATE INDEX idx_pbo_source ON product_branch_overrides(source);
CREATE INDEX idx_pbo_available ON product_branch_overrides(branch_id, is_available);
CREATE INDEX idx_pbo_campaign ON product_branch_overrides(branch_id, campaign_start, campaign_end);
CREATE INDEX idx_pbo_deleted ON product_branch_overrides(deleted_at);
CREATE INDEX idx_pbo_active ON product_branch_overrides(product_id, branch_id, deleted_at);
```

**override_scope Değerleri:**

| Scope | Açıklama | Kullanım |
|-------|----------|----------|
| `price` | Sadece fiyat farklı | ERP fiyat güncellemesi |
| `campaign` | Kampanya/indirim | Pazarlama aksiyonları |
| `stock` | Stok bilgisi | Depo/envanter |
| `compliance` | HAL künye vb. | Yasal zorunluluklar |
| `full` | Tüm alanlar | Tam override |

**source Değerleri:**

| Source | Açıklama | Önem |
|--------|----------|------|
| `manual` | Manuel UI girişi | Import ile ezilmemeli (mod'a göre) |
| `import` | Dosya import | Batch işlem |
| `api` | API entegrasyonu | Harici sistem |
| `sync` | Otomatik senkronizasyon | ERP sync |

### 3.3 Şube Fiyat Geçmişi Tablosu (branch_price_history)

```sql
-- Migration: 062_create_branch_price_history.sql

CREATE TABLE branch_price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,

    -- Fiyat bilgileri
    old_price REAL,
    new_price REAL,
    price_type TEXT DEFAULT 'current',   -- 'current', 'previous', 'campaign'

    -- Değişiklik bilgileri
    change_reason TEXT,                   -- 'import', 'manual', 'campaign', 'sync'
    change_source TEXT,                   -- Import batch ID, user ID vb.
    change_percent REAL,                  -- Yüzdesel değişim

    -- Zaman damgaları
    changed_at TEXT DEFAULT (datetime('now')),
    changed_by TEXT,

    -- Meta
    metadata TEXT,                        -- JSON: ek bilgiler

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_bph_product_branch ON branch_price_history(product_id, branch_id);
CREATE INDEX idx_bph_branch_date ON branch_price_history(branch_id, changed_at DESC);
CREATE INDEX idx_bph_product_date ON branch_price_history(product_id, changed_at DESC);
CREATE INDEX idx_bph_reason ON branch_price_history(change_reason);
```

### 3.4 Kullanıcı Şube Erişimi Tablosu (user_branch_access)

```sql
-- Migration: 063_create_user_branch_access.sql

CREATE TABLE user_branch_access (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,

    -- Erişim seviyesi
    access_level TEXT DEFAULT 'full',     -- 'manager', 'full', 'readonly'

    -- Varsayılan şube mi (login sonrası)
    is_default INTEGER DEFAULT 0,

    -- İzin detayları (granüler kontrol için)
    permissions TEXT,                      -- JSON: {'can_edit_price': true, 'can_import': false}

    -- Zaman damgaları
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    expires_at TEXT,                       -- Geçici erişim için

    -- Kısıtlamalar
    UNIQUE(user_id, branch_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_uba_user ON user_branch_access(user_id);
CREATE INDEX idx_uba_branch ON user_branch_access(branch_id);
CREATE INDEX idx_uba_default ON user_branch_access(user_id, is_default);
```

**access_level Değerleri:**

| Level | Açıklama | Yetkiler |
|-------|----------|----------|
| `manager` | Şube müdürü | Fiyat, kampanya, stok, kullanıcı yönetimi |
| `full` | Tam erişim | Fiyat, kampanya, stok düzenleme |
| `readonly` | Salt okunur | Sadece görüntüleme |

### 3.5 Şube Import Logları Tablosu (branch_import_logs)

```sql
-- Migration: 064_create_branch_import_logs.sql

CREATE TABLE branch_import_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    branch_id TEXT,                        -- NULL = tüm şubeler / dosyadan

    -- Import bilgileri
    import_type TEXT NOT NULL,             -- 'price', 'stock', 'campaign', 'full'
    import_mode TEXT NOT NULL,             -- 'overwrite', 'skip_if_manual', 'merge'
    source_type TEXT,                      -- 'file', 'api', 'erp_sync'
    source_name TEXT,                      -- Dosya adı veya API endpoint

    -- Sonuç
    status TEXT DEFAULT 'pending',         -- 'pending', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled'
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    inserted_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,

    -- Detaylar
    changes_log TEXT,                      -- JSON: [{sku, branch, field, old, new}, ...]
    errors_log TEXT,                       -- JSON: [{row, error}, ...]
    warnings_log TEXT,                     -- JSON: [{row, warning}, ...]

    -- Zaman damgaları
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_bil_company ON branch_import_logs(company_id);
CREATE INDEX idx_bil_branch ON branch_import_logs(branch_id);
CREATE INDEX idx_bil_status ON branch_import_logs(status);
CREATE INDEX idx_bil_date ON branch_import_logs(created_at DESC);
```

### 3.6 Lisans Tablosu Güncelleme

```sql
-- Migration: 065_add_branch_limit_to_licenses.sql

ALTER TABLE licenses ADD COLUMN branch_limit INTEGER DEFAULT 1;
ALTER TABLE licenses ADD COLUMN region_limit INTEGER DEFAULT 0;  -- 0 = sınırsız bölge
```

---

## 4. Servis Katmanı

### 4.1 BranchService

**Dosya:** `services/BranchService.php`

```php
class BranchService {

    /**
     * Kullanıcının şubeye erişimi var mı?
     */
    public static function userHasAccess(string $userId, string $branchId): bool;

    /**
     * Kullanıcının erişebildiği şubeleri getir
     */
    public static function getUserBranches(string $userId): array;

    /**
     * Şube hiyerarşisini getir (bölge → şube)
     */
    public static function getBranchHierarchy(string $companyId): array;

    /**
     * Firma şube limitini kontrol et
     */
    public static function canCreateBranch(string $companyId): array;

    /**
     * Şube oluştur
     */
    public static function create(array $data): array;

    /**
     * Şube güncelle
     */
    public static function update(string $branchId, array $data): array;

    /**
     * Şube sil (soft delete önerilir)
     */
    public static function delete(string $branchId): bool;
}
```

### 4.2 ProductPriceResolver

**Dosya:** `services/ProductPriceResolver.php`

**Fiyat Çözümleme Zinciri:**
```
Şube Override → Bölge Override → Master Ürün
```

```php
class ProductPriceResolver {

    /**
     * Ürünün efektif değerlerini getir (branch → region → master fallback)
     *
     * @param string $productId
     * @param string|null $branchId - null = master değerler
     * @param array $fields - İstenen alanlar
     * @return array
     */
    public static function resolve(
        string $productId,
        ?string $branchId = null,
        array $fields = ['price', 'campaign', 'kunye', 'stock']
    ): array;

    /**
     * Toplu resolve (liste görünümü için optimize)
     */
    public static function resolveMultiple(
        array $productIds,
        ?string $branchId = null
    ): array;
}
```

**Fallback Mantığı:**
```php
$getValue = function($field) use ($product, $branchOverride, $regionOverride) {
    // 1. Önce branch override
    if ($branchOverride && $branchOverride[$field] !== null) {
        return ['value' => $branchOverride[$field], 'source' => 'branch'];
    }
    // 2. Sonra region override
    if ($regionOverride && $regionOverride[$field] !== null) {
        return ['value' => $regionOverride[$field], 'source' => 'region'];
    }
    // 3. Son olarak master
    return ['value' => $product[$field] ?? null, 'source' => 'master'];
};
```

**Availability (Satışa Uygunluk) Fallback Mantığı:**
```php
/**
 * is_available alanı için özel fallback:
 * Şube → Bölge → 1 (varsayılan satışta)
 *
 * NULL = üst seviyeden miras al
 * 0 = satışta değil
 * 1 = satışta
 */
$getAvailability = function() use ($branchOverride, $regionOverride) {
    // 1. Şube override'da explicit değer var mı?
    if ($branchOverride && $branchOverride['is_available'] !== null) {
        return [
            'value' => (bool)$branchOverride['is_available'],
            'source' => 'branch',
            'reason' => $branchOverride['availability_reason']
        ];
    }
    // 2. Bölge override'da explicit değer var mı?
    if ($regionOverride && $regionOverride['is_available'] !== null) {
        return [
            'value' => (bool)$regionOverride['is_available'],
            'source' => 'region',
            'reason' => $regionOverride['availability_reason']
        ];
    }
    // 3. Varsayılan: satışta (is_available = 1)
    return ['value' => true, 'source' => 'default', 'reason' => null];
};
```

⚠️ **Availability Kuralı:** Şube veya bölge seviyesinde `is_available = 0` konmuşsa ürün o şubede satılmaz. Override yoksa varsayılan olarak satışa açıktır (`1`).

### 4.3 BranchImportService

**Dosya:** `services/BranchImportService.php`

**Import Modları:**

| Mod | Davranış | Kullanım |
|-----|----------|----------|
| `overwrite` | Her şeyi üzerine yaz | Tam senkronizasyon |
| `skip_if_manual` | Manuel override varsa atla | Güvenli import |
| `merge` | Sadece boş alanları doldur | Kısmi güncelleme |

```php
class BranchImportService {

    const MODE_OVERWRITE = 'overwrite';
    const MODE_SKIP_IF_MANUAL = 'skip_if_manual';
    const MODE_MERGE = 'merge';

    /**
     * Şube bazlı fiyat/stok import
     *
     * @param array $data - [{sku, branch_code, price, ...}, ...]
     * @param string $mode - Import modu
     * @param string $importType - 'price', 'stock', 'campaign', 'full'
     * @return array
     */
    public function import(
        array $data,
        string $mode = self::MODE_SKIP_IF_MANUAL,
        string $importType = 'price'
    ): array;
}
```

**Import Log Örneği:**
```
PRD001 / IST-001
├── Field: current_price
├── Old: 29.99 (source: manual)
├── New: 27.99 (source: import)
├── Action: SKIPPED (mode: skip_if_manual)
└── Warning: "Manuel override var, atlandı"
```

---

## 5. API Tasarımı

### 5.1 Header Tasarımı

```
X-Active-Company: <company_id>           (mevcut)
X-Active-Branch: <branch_id | null | all>  (YENİ)
```

**Branch Header Değerleri:**

| Değer | Anlamı | Kullanım |
|-------|--------|----------|
| `null` / eksik | Tüm şubeler | Admin dashboard, merkez rapor |
| `all` | Açıkça tüm şubeler | API'de explicit belirtme |
| `<branch_id>` | Belirli şube | Şube context'inde çalışma |

⚠️ **Önemli:** Branch header opsiyonel OLMALI. Yoksa admin dashboard, tüm şubeler raporu, merkez fiyat listesi bozulur.

### 5.2 Yeni API Endpoint'leri

#### Şube Yönetimi

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/branches` | GET | Şube listesi |
| `/api/branches/:id` | GET | Şube detay |
| `/api/branches` | POST | Yeni şube |
| `/api/branches/:id` | PUT | Şube güncelle |
| `/api/branches/:id` | DELETE | Şube sil |
| `/api/branches/hierarchy` | GET | Hiyerarşik yapı |
| `/api/branches/my-access` | GET | Kullanıcının erişebildiği şubeler |

#### Şube Override'ları

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/products/:id/branch-prices` | GET | Ürünün tüm şube fiyatları |
| `/api/products/:id/branch-prices/:branchId` | PUT | Şube fiyatı güncelle |
| `/api/products/:id/branch-prices/:branchId` | DELETE | Şube override sil |

#### Şube Import

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/branches/import/prices` | POST | Şube fiyat import |
| `/api/branches/import/preview` | POST | Import önizleme |
| `/api/branches/import/logs` | GET | Import geçmişi |
| `/api/branches/import/logs/:id` | GET | Import detay |

#### Kullanıcı Şube Erişimi

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/users/:id/branches` | GET | Kullanıcının şubeleri |
| `/api/users/:id/branches` | PUT | Şube erişimi güncelle |

### 5.3 Mevcut API Değişiklikleri

#### GET /api/products

```php
// Mevcut parametreler + şube desteği
$branchId = $request->getHeader('X-Active-Branch');

// Şube belirtilmişse override'larla birlikte getir
if ($branchId && $branchId !== 'all') {
    // COALESCE ile fallback: branch → region → master
    $sql = "
        SELECT
            p.*,
            COALESCE(pbo.current_price, rbo.current_price, p.current_price) as effective_price,
            COALESCE(pbo.kunye_no, rbo.kunye_no, p.kunye_no) as effective_kunye_no,
            pbo.stock_quantity,
            CASE WHEN pbo.id IS NOT NULL THEN 'branch'
                 WHEN rbo.id IS NOT NULL THEN 'region'
                 ELSE 'master' END as price_source,
            CASE WHEN pbo.id IS NOT NULL OR rbo.id IS NOT NULL THEN 1 ELSE 0 END as has_override
        FROM products p
        LEFT JOIN product_branch_overrides pbo ON p.id = pbo.product_id AND pbo.branch_id = ?
        LEFT JOIN product_branch_overrides rbo ON p.id = rbo.product_id AND rbo.branch_id = (
            SELECT parent_id FROM branches WHERE id = ?
        )
        WHERE p.company_id = ?
    ";
}
```

---

## 6. Frontend Değişiklikleri

### 6.1 BranchSelector Komponenti

**Dosya:** `public/assets/js/components/BranchSelector.js`

**Davranış Kuralları:**

| Rol | Şube Seçici | "Tümü" Seçebilir | Kilitli |
|-----|-------------|------------------|---------|
| SuperAdmin | Açık | ✅ | ❌ |
| Admin | Açık | ✅ | ❌ |
| BranchManager | Açık (kısıtlı) | ❌ | ❌ |
| Editor | Kilitli | ❌ | ✅ |
| Viewer | Kilitli | ❌ | ✅ |

⚠️ **Kritik:** Kullanıcıyı branch context'te kilitle. "Ben fiyatı Beşiktaş'ta değiştirdim sanıyordum" ticket'larını önle.

**Gelecek Geliştirme: Bölge Seçimi**
```
┌─────────────────────────────────────┐
│ Şube Seçin                      [X] │
├─────────────────────────────────────┤
│ ▼ Marmara Bölgesi                   │  ← Bölge tıklanırsa tüm alt şubeleri seç
│   ☑ İstanbul Kadıköy               │
│   ☑ İstanbul Beşiktaş              │
│ ▼ Ege Bölgesi                       │
│   ☐ İzmir Alsancak                  │
└─────────────────────────────────────┘
```

Bu özellik Faz 2 veya 3'te eklenebilir. Şu an için tek şube seçimi yeterli.

### 6.2 Header Yerleşimi

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo  │ Arama │ [Firma: ABC A.Ş. ▼] [Şube: Kadıköy ▼] │ 🔔 👤 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Ürün Listesi Güncellemesi

```
┌────────────────────────────────────────────────────────────────────┐
│ Ürünler                              [Şube: Kadıköy ▼] [+ Yeni]   │
├────────────────────────────────────────────────────────────────────┤
│ SKU     │ Ürün Adı    │ Ana Fiyat │ Şube Fiyat │ Stok │ Durum │🔧│
│─────────┼─────────────┼───────────┼────────────┼──────┼───────┼──│
│ PRD001  │ Elma        │ ₺29.99    │ ₺27.99 ⚡  │ 150  │ ✓     │✎│
│ PRD002  │ Domates     │ ₺15.00    │ -          │ 200  │ ✓     │✎│
│ PRD003  │ Muz         │ ₺45.00    │ ₺42.00 📍  │ 80   │ ✓     │✎│
└────────────────────────────────────────────────────────────────────┘

⚡ = Şube override
📍 = Bölge override
```

### 6.4 Şube/Bölge Yönetim Sayfası

**Route:** `/admin/branches`
**Dosya:** `pages/admin/BranchManagement.js`
**Erişim:** Admin, SuperAdmin

#### Ana Sayfa Görünümü

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏢 Şube ve Bölge Yönetimi                    [+ Bölge Ekle] [+ Şube] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📊 Özet: 3 Bölge, 8 Şube (Lisans: 10/10 şube kullanılıyor)          │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ▼ 🗺️ Marmara Bölgesi                                    [✎] [🗑️]   │
│ ├──────────────────────────────────────────────────────────────────│
│ │  🏪 İstanbul Kadıköy (IST-001)     │ Aktif  │ 25 cihaz │ [✎][🗑️]│
│ │  🏪 İstanbul Beşiktaş (IST-002)    │ Aktif  │ 18 cihaz │ [✎][🗑️]│
│ │  🏪 Bursa Nilüfer (BRS-001)        │ Pasif  │ 0 cihaz  │ [✎][🗑️]│
│ │                                                                  │
│ │  [+ Bu Bölgeye Şube Ekle]                                       │
│ └──────────────────────────────────────────────────────────────────│
│                                                                      │
│ ▼ 🗺️ Ege Bölgesi                                        [✎] [🗑️]   │
│ ├──────────────────────────────────────────────────────────────────│
│ │  🏪 İzmir Alsancak (IZM-001)       │ Aktif  │ 32 cihaz │ [✎][🗑️]│
│ │  🏪 İzmir Karşıyaka (IZM-002)      │ Aktif  │ 15 cihaz │ [✎][🗑️]│
│ │                                                                  │
│ │  [+ Bu Bölgeye Şube Ekle]                                       │
│ └──────────────────────────────────────────────────────────────────│
│                                                                      │
│ ▶ 🗺️ Akdeniz Bölgesi (3 şube)                           [✎] [🗑️]   │
│                                                                      │
│ ── Bölgesiz Şubeler ─────────────────────────────────────────────── │
│ │  🏪 Online Mağaza (ONL-001)        │ Aktif  │ 0 cihaz  │ [✎][🗑️]│
│ │  📦 Merkez Depo (DEP-001)          │ Aktif  │ 5 cihaz  │ [✎][🗑️]│
│ └──────────────────────────────────────────────────────────────────│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Bölge Ekle/Düzenle Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ 🗺️ Bölge Ekle                                                [X] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Bölge Adı *        [Marmara Bölgesi________________]           │
│                                                                  │
│  Bölge Kodu *       [MAR_____] (benzersiz, değiştirilemez)      │
│                                                                  │
│  Açıklama           [İstanbul, Bursa, Kocaeli_______]           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  ℹ️ Bölgeler organizasyonel amaçlıdır ve lisans sayılmaz.        │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                                    [İptal]    [Kaydet]           │
└──────────────────────────────────────────────────────────────────┘
```

#### Şube Ekle/Düzenle Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ 🏪 Şube Ekle                                                 [X] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ Temel Bilgiler  │  │ İletişim        │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
│  ── Temel Bilgiler ───────────────────────────────────────────  │
│                                                                  │
│  Şube Adı *         [İstanbul Kadıköy_______________]           │
│                                                                  │
│  Şube Kodu *        [IST-001_] (benzersiz)                      │
│                                                                  │
│  ERP/Harici Kod     [34001___] (opsiyonel, ERP eşleşmesi için)  │
│                                                                  │
│  Şube Tipi *        [🏪 Mağaza (store) ▼]                       │
│                      ├── 🏪 Mağaza (store)                      │
│                      ├── 📦 Depo (warehouse)                    │
│                      └── 🌐 Online (online)                     │
│                                                                  │
│  Bağlı Bölge        [🗺️ Marmara Bölgesi ▼]                      │
│                      ├── Marmara Bölgesi                        │
│                      ├── Ege Bölgesi                            │
│                      ├── Akdeniz Bölgesi                        │
│                      └── ── Bölgesiz ──                         │
│                                                                  │
│  Şube Müdürü        [Ahmet Yılmaz ▼] (opsiyonel)                │
│                                                                  │
│  Durum              [● Aktif  ○ Pasif]                          │
│                                                                  │
│  ── İletişim Bilgileri ───────────────────────────────────────  │
│                                                                  │
│  Adres              [Caferağa Mah. Moda Cad. No:15__]           │
│                                                                  │
│  İl *               [İstanbul ▼]                                │
│                                                                  │
│  İlçe               [Kadıköy__]                                 │
│                                                                  │
│  Posta Kodu         [34710___]                                  │
│                                                                  │
│  Telefon            [0216 XXX XX XX]                            │
│                                                                  │
│  E-posta            [kadikoy@firma.com_____________]            │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  ⚠️ Lisans Durumu: 8/10 şube kullanılıyor. 2 şube daha          │
│     ekleyebilirsiniz.                                            │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                                    [İptal]    [Kaydet]           │
└──────────────────────────────────────────────────────────────────┘
```

#### Şube Silme Onay Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ Şube Silme Onayı                                          [X] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "İstanbul Kadıköy (IST-001)" şubesini silmek üzeresiniz.       │
│                                                                  │
│  Bu işlem:                                                       │
│  • 25 cihazın şube bağlantısını kaldıracak                      │
│  • 142 ürün override'ını silecek                                │
│  • 3 kullanıcının şube erişimini kaldıracak                     │
│                                                                  │
│  ⚠️ Bu işlem geri alınamaz!                                      │
│                                                                  │
│  Onaylamak için şube kodunu yazın: [IST-001___]                 │
│                                                                  │
│                         [İptal]    [🗑️ Şubeyi Sil]              │
└──────────────────────────────────────────────────────────────────┘
```

#### Sidebar Menü Konumu

```
Yönetim
├── 👥 Kullanıcılar        (/admin/users)
├── 🏢 Firmalar            (/admin/companies)
├── 🏪 Şubeler             (/admin/branches)  ← YENİ
├── 📜 Lisanslar           (/admin/licenses)
├── 📋 İşlem Geçmişi       (/admin/audit-log)
└── ⚙️ Sistem Durumu       (/admin/system-status)
```

#### Şube Tipi İkonları

| Tip | İkon | Renk |
|-----|------|------|
| region | 🗺️ ti-map-2 | Mavi |
| store | 🏪 ti-building-store | Yeşil |
| warehouse | 📦 ti-box | Turuncu |
| online | 🌐 ti-world | Mor |

### 6.5 Import Modal Güncellemesi

```
┌─────────────────────────────────────────────────────────────┐
│ Ürün Import                                            [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Import Tipi:                                                │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ○ Ürünler (master)                                      ││
│ │ ● Şube Fiyatları                                        ││
│ │ ○ Şube Stokları                                         ││
│ │ ○ Şube Kampanyaları                                     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Hedef Şube:                                                 │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ▼ Dosyadan oku (branch_code kolonu)                     ││
│ │   İstanbul Kadıköy (IST-001)                            ││
│ │   İstanbul Beşiktaş (IST-002)                           ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Import Modu:                                                │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ● Manuel override varsa atla (Önerilen)                 ││
│ │   Daha önce manuel girilen değerler korunur             ││
│ │                                                         ││
│ │ ○ Her şeyi üzerine yaz                                  ││
│ │   Tüm değerler import'tan gelir                         ││
│ │                                                         ││
│ │ ○ Sadece boş alanları doldur                            ││
│ │   Mevcut değerler korunur, eksikler doldurulur          ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Dosya Seç]  [Önizle]  [Import Et]                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Import/Export Sistemi

### 7.1 Import Dosya Formatları

#### Şube Fiyat Import (CSV)

```csv
SKU;SUBE_KODU;FIYAT;ONCEKI_FIYAT;INDIRIM;KAMPANYA;KAMPANYA_BASLANGIC;KAMPANYA_BITIS
PRD001;IST-001;29.99;32.99;10;Hafta Sonu İndirimi;2026-02-01;2026-02-03
PRD001;IST-002;32.99;;;
PRD001;ANK-001;28.99;30.00;15;Bölge Kampanyası;2026-02-01;2026-02-28
PRD002;IST-001;15.00;;;
```

#### Şube Stok Import (CSV)

```csv
SKU;SUBE_KODU;STOK;MIN_STOK;RAF_KONUM
PRD001;IST-001;150;20;A-12-3
PRD001;IST-002;200;25;B-05-1
PRD002;IST-001;80;10;A-08-2
```

### 7.2 Import Modu Davranışları

| Mod | Manuel Override | Import Değer | Sonuç |
|-----|-----------------|--------------|-------|
| `overwrite` | 29.99 | 27.99 | 27.99 (import kazanır) |
| `skip_if_manual` | 29.99 | 27.99 | 29.99 (manuel korunur) |
| `merge` | 29.99 | 27.99 | 29.99 (mevcut korunur) |
| `merge` | NULL | 27.99 | 27.99 (boş doldurulur) |

### 7.3 Import Sonuç Raporu

```json
{
    "success": true,
    "import_log_id": "uuid",
    "summary": {
        "total": 150,
        "processed": 145,
        "inserted": 80,
        "updated": 50,
        "skipped": 15,
        "failed": 5
    },
    "changes": [
        {
            "sku": "PRD001",
            "branch": "IST-001",
            "field": "current_price",
            "old": 29.99,
            "new": 27.99,
            "old_source": "manual"
        }
    ],
    "warnings": [
        {
            "row": 12,
            "sku": "PRD003",
            "branch": "IST-001",
            "warning": "Manuel override var, atlandı"
        }
    ],
    "errors": [
        {
            "row": 25,
            "sku": "PRD999",
            "error": "Ürün bulunamadı"
        }
    ]
}
```

---

## 8. Erişim Kontrolü

### 8.1 Rol Bazlı Erişim Matrisi

| Rol | Şube Seçici | Tüm Şubeler | Override Düzenleme | Import |
|-----|-------------|-------------|--------------------|---------|
| SuperAdmin | ✅ Açık | ✅ | ✅ | ✅ |
| Admin | ✅ Açık | ✅ | ✅ | ✅ |
| BranchManager | ✅ Kısıtlı | ❌ | ✅ (kendi şubesi) | ✅ (kendi şubesi) |
| Editor | 🔒 Kilitli | ❌ | ❌ | ❌ |
| Viewer | 🔒 Kilitli | ❌ | ❌ | ❌ |

### 8.2 Şube Erişim Kontrol Akışı

```
1. Request gelir
2. Auth::user() ile kullanıcı alınır
3. X-Active-Branch header kontrol edilir
4. BranchService::userHasAccess() çağrılır
   - SuperAdmin → her yere erişir
   - Admin → firmasının tüm şubelerine erişir
   - Diğer → user_branch_access tablosu kontrol edilir
5. Erişim yoksa 403 Forbidden
6. Erişim varsa işlem devam eder
```

---

## 9. Lisanslama

### 9.1 Lisans Yapısı

| Alan | Açıklama |
|------|----------|
| `branch_limit` | Maksimum şube sayısı (store + warehouse + online) |
| `region_limit` | Maksimum bölge sayısı (0 = sınırsız) |

**Bölgeler (region) lisans sayılmaz!** Sadece organizasyonel amaçlıdır.

### 9.2 Lisans Paketleri (Öneri)

| Paket | Şube Limiti | Bölge | Fiyat |
|-------|-------------|-------|-------|
| Starter | 1 | Sınırsız | Temel |
| Professional | 5 | Sınırsız | +%50 |
| Enterprise | 25 | Sınırsız | +%100 |
| Ultimate | Sınırsız | Sınırsız | Özel |

### 9.3 Satış Dili

```
✅ Temel lisans: X kullanıcı, 1 şube dahil
✅ Ek şube: +₺Y / ay / şube
✅ Bölge tanımlama: Ücretsiz (organizasyonel)

❌ "Şube başına lisans" deme
❌ "Bölge ücretli" deme
```

---

## 10. Implementasyon Planı

### 10.1 Faz 1: Veritabanı ve Temel Servisler

| Görev | Dosya | Öncelik |
|-------|-------|---------|
| branches tablosu | migrations/060_create_branches.sql | P0 |
| product_branch_overrides tablosu | migrations/061_create_product_branch_overrides.sql | P0 |
| branch_price_history tablosu | migrations/062_create_branch_price_history.sql | P0 |
| user_branch_access tablosu | migrations/063_create_user_branch_access.sql | P0 |
| branch_import_logs tablosu | migrations/064_create_branch_import_logs.sql | P0 |
| licenses tablosu güncelleme | migrations/065_add_branch_limit_to_licenses.sql | P0 |
| devices tablosu güncelleme | migrations/066_add_branch_to_devices.sql | P0 |
| BranchService | services/BranchService.php | P0 |
| ProductPriceResolver | services/ProductPriceResolver.php | P0 |
| BranchImportService | services/BranchImportService.php | P1 |

### 10.2 Faz 2: API Endpoint'leri

| Görev | Dosya | Öncelik |
|-------|-------|---------|
| Şube CRUD | api/branches/*.php | P0 |
| Şube erişim | api/branches/my-access.php | P0 |
| Şube hiyerarşi | api/branches/hierarchy.php | P1 |
| Ürün override'ları | api/products/branch-prices.php | P0 |
| Şube import | api/branches/import/*.php | P1 |
| Kullanıcı şubeleri | api/users/branches.php | P1 |
| Cihaz şube filtresi | api/devices/index.php (güncelleme) | P0 |
| Cihaz şube ataması | api/devices/create.php, update.php (güncelleme) | P0 |

### 10.3 Faz 3: Frontend

| Görev | Dosya | Öncelik |
|-------|-------|---------|
| BranchSelector | components/BranchSelector.js | P0 |
| Api.js header | core/Api.js | P0 |
| LayoutManager entegrasyonu | layouts/LayoutManager.js | P0 |
| ProductList güncelleme | pages/products/ProductList.js | P0 |
| ProductForm güncelleme | pages/products/ProductForm.js | P1 |
| ProductImport güncelleme | pages/products/ProductImport.js | P1 |
| BranchManagement sayfası | pages/admin/BranchManagement.js | P0 |
| BranchManagement bölge modal | pages/admin/BranchManagement.js (region CRUD) | P0 |
| BranchManagement şube modal | pages/admin/BranchManagement.js (branch CRUD) | P0 |
| Sidebar menü güncelleme | layouts/LayoutManager.js (Şubeler linki) | P0 |
| Dashboard güncelleme | pages/Dashboard.js | P2 |
| DeviceList şube/bölge filtresi | pages/devices/DeviceList.js | P0 |
| DeviceList ekle/düzenle modalı | pages/devices/DeviceList.js (şube seçimi) | P0 |
| DeviceGroups şube filtresi | pages/devices/DeviceGroups.js | P1 |

### 10.4 Faz 4: i18n ve Test

| Görev | Dosya | Öncelik |
|-------|-------|---------|
| TR çeviriler | locales/tr/pages/branches.json | P1 |
| EN çeviriler | locales/en/pages/branches.json | P1 |
| Common çeviriler | locales/*/common.json | P1 |
| Unit testler | tests/branch_*.php | P2 |
| Entegrasyon testleri | tests/integration/*.php | P2 |

---

## 11. Revizyon Notları

### 11.1 Bekleyen Revizyonlar

| Tarih | Konu | Durum |
|-------|------|-------|
| 2026-01-31 | HAL sistemi değişiklikleri | ✅ Planlandı (v2.0.17) |
| 2026-01-31 | HAL Frontend (ProductForm.js) | ✅ Tamamlandı (v2.0.17) |
| 2026-01-31 | Cihazlar sistemi şube entegrasyonu | ✅ Planlandı (v2.4) |

### 11.2 Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 1.0 | 2026-01-31 | İlk taslak |
| 2.0 | 2026-01-31 | Geri bildirimler entegre edildi |
| 2.1 | 2026-01-31 | Enterprise öneriler eklendi: soft delete, availability fallback, extended status enum, region selection note |
| 2.2 | 2026-01-31 | HAL sistemi şube entegrasyonu planlandı, 11.3 bölümü güncellendi |
| 2.3 | 2026-01-31 | HAL Frontend tamamlandı: ProductForm.js layout, page header kaydet butonu, HalKunyeCard/Section, dil kontrolü |
| 2.4 | 2026-01-31 | Cihazlar sistemi şube entegrasyonu: store_id → branch_id rename, DeviceList şube/bölge filtreleri, ekle/düzenle modallarına şube seçimi |

### 11.3 HAL Sistemi Entegrasyonu Notları

```
✅ HAL sistemi şube desteği planlandı (PLAN_HAL_KUNYE_SYSTEM.md v2.0.17)

Karar: Ayrı Tablo Yaklaşımı
─────────────────────────────────────────────────────────────────

HAL künye verileri product_branch_overrides tablosunda DEĞİL,
ayrı bir override tablosunda saklanacak.

Neden?
- product_hal_data tablosu çok fazla alan içeriyor (15+ alan)
- product_branch_overrides'a eklemek tabloyu şişirir
- HAL verisi sadece Türkiye'de ve belirli sektörlerde kullanılır

Yapı:
┌─────────────────────┐
│ product_hal_data    │ ← Master HAL verisi (1:1 ürün)
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────────────────┐
│ product_branch_hal_overrides    │ ← Şube farklılıkları
└─────────────────────────────────┘

Override Edilebilir HAL Alanları:
✅ kunye_no, malin_sahibi, tuketim_yeri, tuketim_bildirim_tarihi, alis_fiyati, miktar
❌ uretici_adi, malin_adi, malin_cinsi, malin_turu, uretim_yeri (master'da kalır)

Fallback Zinciri:
Şube → Bölge → Master (HalDataResolver servisi ile)

Detaylar: PLAN_HAL_KUNYE_SYSTEM.md dosyasına bakınız.
```

### 11.4 HAL Frontend Tamamlandı (v2.0.17)

```
✅ TAMAMLANAN GÖREVLER (2026-01-31)
───────────────────────────────────────────────────────────────

Frontend - Ürün Formu (Faz 3):
├── ✅ HalKunyeCard.js yeni bileşen oluşturuldu
├── ✅ ProductForm.js layout tamamen yeniden düzenlendi
│       Sol Sütun: Temel Bilgiler, HAL Künye, Fiyat Bilgileri
│       Sağ Sütun: Durum, Görseller, Video, Stok ve Ölçü, Geçerlilik
├── ✅ HalKunyeSection.js genişletildi
├── ✅ Dil kontrolü eklendi (HAL kartı sadece TR'de görünür)
└── ✅ Page header kaydet butonu (form="product-form" ile form dışından submit)

Dokümantasyon (Faz 8):
└── ✅ CLAUDE.md v2.0.17 güncellendi

BEKLEYEN GÖREVLER:
───────────────────────────────────────────────────────────────

Faz 1: Veritabanı
├── [ ] Migration 057: product_hal_data tablosu
└── [ ] Migration 058: product_branch_hal_overrides tablosu

Faz 2: Backend API (Master HAL)
├── [ ] api/hal/data.php (GET - branch_id destekli)
├── [ ] api/hal/save.php (POST)
├── [ ] api/hal/delete.php (DELETE)
├── [ ] HalKunyeScraper.php tüm alanları parse
└── [ ] api/hal/query.php otomatik kaydetme

Faz 2.5: Backend API (Şube Override)
├── [ ] services/HalDataResolver.php
├── [ ] api/hal/branch-overrides.php (GET)
└── [ ] api/hal/branch-override.php (PUT/DELETE)

Faz 4: Frontend - Ürün Detay
└── [ ] ProductDetail.js HAL kartı

Faz 5: Şablon Editörü
├── [ ] DynamicFieldsPanel.js HAL alanları
└── [ ] TemplateEditor.js HAL render

Faz 6: Şube HAL Override UI
├── [ ] HalKunyeCard.js şube override sekmesi
├── [ ] Efektif değer gösterimi
└── [ ] Şube override düzenleme modalı

Faz 7: CSS & i18n
├── [ ] hal-kunye.css stilleri
├── [ ] products.css güncellemeleri
└── [ ] products.json TR çevirileri (şube override dahil)
```

### 11.5 Cihazlar Sistemi Şube Entegrasyonu (v2.4)

```
📊 MEVCUT DURUM ANALİZİ
───────────────────────────────────────────────────────────────

Veritabanı:
├── devices tablosu
│   ├── store_id TEXT → KULLANILMIYOR (dead code)
│   ├── group_id TEXT → Toplu gönderim grupları için (şube DEĞİL)
│   └── branch_id YOK
│
├── device_groups tablosu
│   ├── Migration 006'da parent_id var
│   └── Migration 012'de parent_id YOK (tutarsızlık)
│
└── Sonuç: Şube kavramı yok, group_id farklı amaç için

API Endpoint'leri:
├── api/devices/index.php → Şube filtresi YOK
├── api/devices/create.php → branch_id alanı YOK
└── api/devices/update.php → branch_id alanı YOK

Frontend:
├── DeviceList.js → Şube seçici YOK
├── DeviceGroups.js → Toplu işlem amaçlı, şube DEĞİL
└── Modal'larda şube seçimi YOK

🔧 YAPILACAK DEĞİŞİKLİKLER
───────────────────────────────────────────────────────────────

Migration 066: devices.branch_id Ekleme
─────────────────────────────────────────────────────────────────
-- Migration: 066_add_branch_to_devices.sql

-- store_id'yi branch_id olarak yeniden adlandır
ALTER TABLE devices RENAME COLUMN store_id TO branch_id;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_devices_branch ON devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_devices_company_branch ON devices(company_id, branch_id);

-- Foreign key (SQLite'da sonradan eklenemez, yeni tabloda olacak)
-- FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL


API Değişiklikleri:
─────────────────────────────────────────────────────────────────

api/devices/index.php:
├── X-Active-Branch header desteği
├── ?branch_id=X query param desteği
├── ?region_id=X query param desteği (bölgedeki tüm şubeler)
└── Şube null ise tüm cihazlar (admin görünümü)

api/devices/create.php:
├── branch_id alanı kabul et
├── Kullanıcının şubeye erişim kontrolü
└── Header'dan gelen branch_id otomatik atama

api/devices/update.php:
├── branch_id güncellenebilir
└── Şube değişikliği audit log'a yazılsın


Frontend Değişiklikleri:
─────────────────────────────────────────────────────────────────

DeviceList.js - Tablo Üstü Filtreler:
┌──────────────────────────────────────────────────────────────┐
│ Cihazlar                                                     │
├──────────────────────────────────────────────────────────────┤
│ [Bölge: Tümü ▼] [Şube: Tümü ▼] [Tip: Tümü ▼] [🔍 Ara...]   │
├──────────────────────────────────────────────────────────────┤
│ Cihaz Adı    │ Tip  │ Şube        │ Bölge     │ Durum │ 🔧 │
│──────────────┼──────┼─────────────┼───────────┼───────┼────│
│ ESL-001      │ ESL  │ Kadıköy     │ Marmara   │ ✓     │ ✎  │
│ TV-002       │ TV   │ Beşiktaş    │ Marmara   │ ✓     │ ✎  │
│ ESL-003      │ ESL  │ Alsancak    │ Ege       │ ✓     │ ✎  │
└──────────────────────────────────────────────────────────────┘

DeviceList.js - Ekle/Düzenle Modal:
┌──────────────────────────────────────────────────────────────┐
│ Cihaz Ekle / Düzenle                                     [X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Cihaz Adı:    [________________________]                     │
│                                                              │
│ Tip:          [ESL ▼]                                        │
│                                                              │
│ Şube:         [İstanbul Kadıköy (IST-001) ▼]                │
│               ↳ Bölge: Marmara otomatik gösterilir           │
│                                                              │
│ Cihaz Grubu:  [Raf Grubu A ▼]  (opsiyonel, toplu gönderim)  │
│                                                              │
│ IP Adresi:    [192.168.1.___]                               │
│                                                              │
│                              [İptal]  [Kaydet]               │
└──────────────────────────────────────────────────────────────┘

⚠️ ÖNEMLİ: device_groups ≠ şube organizasyonu
device_groups toplu gönderim (batch send) için kullanılır.
Bir cihaz hem "Kadıköy şubesine" ait olup hem de
"Kasap Reyonu Grubu"nda olabilir.


DeviceGroups.js Değişiklikleri:
─────────────────────────────────────────────────────────────────
├── Grup listesinde şube filtresi (hangi şubenin grupları)
├── Grup oluştururken varsayılan şube (aktif şube)
└── Gruba cihaz eklerken sadece aynı şubedeki cihazlar


GÖREV LİSTESİ (Öncelik Sırasıyla):
─────────────────────────────────────────────────────────────────

Faz 1: Veritabanı
├── [P0] Migration 066: store_id → branch_id rename
├── [P0] Index ekleme (branch, company_branch)
└── [P1] Migration 006/012 tutarsızlığı düzeltme (opsiyonel)

Faz 2: Backend API
├── [P0] api/devices/index.php: branch_id ve region_id filtresi
├── [P0] api/devices/create.php: branch_id alanı ekleme
├── [P0] api/devices/update.php: branch_id güncellenebilir
└── [P1] Audit log: Şube değişikliği kaydı

Faz 3: Frontend
├── [P0] DeviceList.js: Bölge dropdown filtresi
├── [P0] DeviceList.js: Şube dropdown filtresi (bölgeye bağlı)
├── [P0] DeviceList.js: Tabloya Şube ve Bölge kolonları
├── [P0] DeviceList.js: Ekle modalına şube seçimi
├── [P0] DeviceList.js: Düzenle modalına şube seçimi
├── [P1] DeviceGroups.js: Şube filtresi
└── [P2] DeviceDetail.js: Şube bilgisi gösterimi

Faz 4: i18n
├── [P1] devices.json TR: şube/bölge filtreleri
└── [P1] devices.json EN: branch/region filters
```

---

## 12. Ek: Şema Diyagramları

### 12.1 Veri İlişkileri

```
┌─────────────┐
│  companies  │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐      ┌─────────────────────────────┐
│  branches   │◄────►│    user_branch_access       │
└──────┬──────┘      └─────────────────────────────┘
       │                          │
       │                          │
       │ N:1                      │ N:1
       ▼                          ▼
┌─────────────┐             ┌─────────────┐
│  products   │             │    users    │
└──────┬──────┘             └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────────────────────┐
│ product_branch_overrides    │
└──────┬──────────────────────┘
       │
       │ 1:N
       ▼
┌─────────────────────────────┐
│    branch_price_history     │
└─────────────────────────────┘
```

### 12.2 Fiyat Çözümleme Akışı

```
┌─────────────────────────────────────────────────────────┐
│                    ProductPriceResolver                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  resolve(productId, branchId)                           │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────────┐                                    │
│  │ Branch Override │ ──── NULL? ────┐                   │
│  │    (pbo)        │                │                   │
│  └────────┬────────┘                │                   │
│           │ değer var               │                   │
│           ▼                         ▼                   │
│  ┌─────────────────┐       ┌─────────────────┐         │
│  │ return 'branch' │       │ Region Override │ ── NULL?│
│  └─────────────────┘       │    (rbo)        │    │    │
│                            └────────┬────────┘    │    │
│                                     │ değer var   │    │
│                                     ▼             │    │
│                            ┌─────────────────┐    │    │
│                            │ return 'region' │    │    │
│                            └─────────────────┘    │    │
│                                                   │    │
│                                                   ▼    │
│                                          ┌─────────────┐
│                                          │return master│
│                                          └─────────────┘
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Döküman Sonu**

*Bu döküman implementasyon başlamadan önce onaylanmalıdır. HAL sistemi değişiklikleri sonrası revize edilecektir.*
