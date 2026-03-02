# TENANT (MULTI-TENANT) KAPSAMLI ANALİZ VE ÖNERİLER

**Oluşturulma Tarihi:** 2026-01-25
**Analiz Türü:** Mevcut Durum + Yeni Gereksinimler

---

## İÇİNDEKİLER

1. [Mevcut Durum Özeti](#mevcut-durum-özeti)
2. [Kritik Güvenlik Açıkları](#kritik-güvenlik-açıkları)
3. [Veri Kategorileri](#veri-kategorileri)
4. [Medya Kütüphanesi Mimarisi](#medya-kütüphanesi-mimarisi)
5. [Şablon Paylaşım Mimarisi](#şablon-paylaşım-mimarisi)
6. [Entegrasyon Ayarları](#entegrasyon-ayarları)
7. [Firma Kurulum Seed Sistemi](#firma-kurulum-seed-sistemi)
8. [Uygulama Planı](#uygulama-planı)

---

## MEVCUT DURUM ÖZETİ

### Taranan Endpoint'ler

| Kategori | Toplam | İzole | Sorunlu | Oran |
|----------|--------|-------|---------|------|
| Tüm API | 165 | 106 | 17 | %64 |
| Products | 12 | 12 | 0 | %100 |
| Templates | 8 | 8 | 0 | %100 |
| Media | 7 | 4 | 3 | %57 |
| Devices | 10 | 10 | 0 | %100 |
| ESL/Player | 12 | 5 | 7 | %42 |
| Settings | 2 | 2 | 0 | %100 |
| Licenses | 4 | 0 | 4 | %0 |

### İzolasyon Modeli

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED DATABASE                          │
│                    (omnex.db)                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Firma A  │  │ Firma B  │  │ Firma C  │  │  Global  │    │
│  │company_id│  │company_id│  │company_id│  │   NULL   │    │
│  │  =uuid1  │  │  =uuid2  │  │  =uuid3  │  │          │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## KRİTİK GÜVENLİK AÇIKLARI

### 🔴 ACIL (Hemen Düzeltilmeli)

#### 1. device_sync_requests Tablosu - company_id YOK

**Sorun:** Tablo tanımında `company_id` kolonu mevcut değil.

**Etki:** ESL/PWA cihaz kayıtları firma izolasyonu olmadan yapılıyor.

**Çözüm:**
```sql
-- Migration eklenmeli
ALTER TABLE device_sync_requests ADD COLUMN company_id TEXT;
CREATE INDEX idx_sync_requests_company ON device_sync_requests(company_id);
```

#### 2. esl/pending.php - Tüm Firmalar Görünür

**Sorun:** Bekleyen cihazlar listelenirken `company_id` filtresi yok.

**Mevcut Kod:**
```php
$requests = $db->fetchAll(
    "SELECT * FROM device_sync_requests WHERE status = 'pending'"
);
// company_id filtresi YOK!
```

**Çözüm:**
```php
$companyId = Auth::getActiveCompanyId();
$requests = $db->fetchAll(
    "SELECT * FROM device_sync_requests
     WHERE status = 'pending' AND company_id = ?",
    [$companyId]
);
```

#### 3. media/serve.php - Cross-Tenant Dosya Erişimi

**Sorun:** Dosya sunumu sırasında `company_id` kontrolü yok.

**Risk:** Firma A, Firma B'nin dosyasına URL ile erişebilir.

**Çözüm:**
```php
// Veritabanından medya kaydını doğrula
$media = $db->fetch(
    "SELECT * FROM media WHERE file_path = ? AND (company_id = ? OR company_id IS NULL)",
    [$filePath, $companyId]
);
if (!$media) {
    http_response_code(403);
    exit('Erişim reddedildi');
}
```

#### 4. media/browse.php - Dizin Gezinme Açığı

**Sorun:** Storage içinde tüm dizinler gezinilebilir.

**Çözüm:** Firma bazlı dizin kısıtlaması ekle.

### 🟡 ORTA ÖNCELİK

| Endpoint | Sorun | Çözüm |
|----------|-------|-------|
| licenses/create.php | company_id kontrolü yok | SuperAdmin kontrolü + firma atama |
| licenses/update.php | company_id kontrolü yok | SuperAdmin kontrolü |
| licenses/revoke.php | company_id kontrolü yok | SuperAdmin kontrolü |
| payments/callback.php | Firma doğrulama eksik | Transaction'dan firma al |
| payments/status.php | company_id filtresi yok | Filtre ekle |
| player/init.php | Cihaz firması doğrulanmıyor | Device token'dan firma al |
| player/sync.php | company_id kontrolü eksik | Device token validasyonu |
| audit-logs/show.php | company_id filtresi yok | Filtre ekle |

### 🟢 GLOBAL OLMASI DOĞRU

| Endpoint/Tablo | Neden Global? |
|----------------|---------------|
| license_plans | Tüm firmalar aynı planları görür |
| permissions | Sistem geneli yetki tanımları |
| payment_settings | Ödeme sağlayıcı konfigürasyonu |
| firmware_updates | Cihaz firmware'leri ortak |
| system/status.php | Sistem durumu admin için |
| about.php | Uygulama bilgisi |

---

## VERİ KATEGORİLERİ

### Kategori 1: Tamamen Global (company_id = NULL)

Tüm firmalar tarafından görülebilir, **sadece SuperAdmin değiştirebilir**.

```
┌─────────────────────────────────────────────┐
│              GLOBAL VERİLER                 │
├─────────────────────────────────────────────┤
│ • companies (firma tanımları)               │
│ • permissions (yetki tanımları)             │
│ • license_plans (lisans planları)           │
│ • payment_settings (ödeme ayarları)         │
│ • firmware_updates (firmware güncellemeleri)│
│ • hanshow_firmwares (ESL firmware cache)    │
│ • menu_items (varsayılan menü - scope=null) │
│ • layout_configs (varsayılan - scope=null)  │
└─────────────────────────────────────────────┘
```

### Kategori 2: Ortak + Firma Bazlı (company_id = NULL veya UUID)

Firmalar hem global hem kendi verilerini görür, **sadece kendi verilerini değiştirebilir**.

```
┌─────────────────────────────────────────────┐
│         ORTAK + FİRMA BAZLI                 │
├─────────────────────────────────────────────┤
│ • templates (is_public=1 veya company_id)   │
│ • media (company_id=NULL: ortak kütüphane)  │
│ • label_sizes (varsayılan + firma özel)     │
│ • import_mappings (varsayılan + firma özel) │
│ • categories (varsayılan + firma özel)      │
│ • production_types (varsayılan + firma özel)│
└─────────────────────────────────────────────┘
```

### Kategori 3: Tamamen Firma Bazlı (company_id = UUID)

Sadece kendi firmasının verilerini görür ve değiştirir.

```
┌─────────────────────────────────────────────┐
│           TAM FİRMA İZOLASYONU              │
├─────────────────────────────────────────────┤
│ • users (SuperAdmin hariç)                  │
│ • products                                  │
│ • devices / device_groups                   │
│ • playlists / schedules                     │
│ • render_queue / render_cache               │
│ • notifications                             │
│ • audit_logs                                │
│ • settings (firma + kullanıcı ayarları)     │
│ • licenses (firma lisansı)                  │
│ • payment_transactions                      │
│ • integrations (entegrasyon ayarları)       │
│ • hanshow_esls / hanshow_settings           │
│ • gateways                                  │
└─────────────────────────────────────────────┘
```

---

## MEDYA KÜTÜPHANESİ MİMARİSİ

### Mevcut Durum

```
storage/
├── uploads/          # Tüm dosyalar karışık
│   ├── image1.jpg
│   ├── image2.png
│   └── ...
```

### Önerilen Yapı

```
storage/
├── public/                    # ORTAK KÜTÜPHANE (herkes görür, kimse değiştiremez)
│   ├── icons/                 # Sistem ikonları
│   ├── backgrounds/           # Hazır arka planlar
│   ├── templates/             # Şablon görselleri
│   └── samples/               # Örnek medyalar
│
├── companies/                 # FİRMA BAZLI (sadece kendi firması görür)
│   ├── {company_id_1}/
│   │   ├── products/          # Ürün görselleri
│   │   ├── uploads/           # Genel yüklemeler
│   │   └── renders/           # Render cache
│   │
│   ├── {company_id_2}/
│   │   └── ...
│   │
│   └── {company_id_3}/
│       └── ...
│
└── system/                    # SİSTEM DOSYALARI (sadece SuperAdmin)
    ├── backups/
    ├── logs/
    └── temp/
```

### Veritabanı Değişiklikleri

```sql
-- media tablosuna eklenecek alanlar
ALTER TABLE media ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN scope TEXT DEFAULT 'company'; -- 'public', 'company', 'system'

-- Örnek sorgu: Firma medyalarını listele
SELECT * FROM media
WHERE scope = 'public'
   OR (scope = 'company' AND company_id = ?)
ORDER BY created_at DESC;
```

### API Değişiklikleri

**media/index.php:**
```php
$companyId = Auth::getActiveCompanyId();

// Public + Firma medyaları
$media = $db->fetchAll(
    "SELECT m.*,
            CASE WHEN m.scope = 'public' THEN 1 ELSE 0 END as is_readonly
     FROM media m
     WHERE m.scope = 'public'
        OR (m.scope = 'company' AND m.company_id = ?)
     ORDER BY m.scope DESC, m.created_at DESC",
    [$companyId]
);
```

**media/upload.php:**
```php
$scope = $request->input('scope', 'company');
$companyId = Auth::getActiveCompanyId();

// Public yükleme sadece SuperAdmin
if ($scope === 'public' && $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Ortak kütüphaneye sadece SuperAdmin yükleyebilir');
}

// Dizin belirleme
if ($scope === 'public') {
    $uploadDir = STORAGE_PATH . '/public/' . $folder;
} else {
    $uploadDir = STORAGE_PATH . '/companies/' . $companyId . '/' . $folder;
}
```

**media/delete.php:**
```php
$media = $db->fetch("SELECT * FROM media WHERE id = ?", [$id]);

// Public medya silinemez (sadece SuperAdmin)
if ($media['scope'] === 'public' && $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Ortak kütüphane medyaları silinemez');
}

// Başka firma medyası silinemez
if ($media['scope'] === 'company' && $media['company_id'] !== $companyId) {
    Response::forbidden('Bu medyayı silme yetkiniz yok');
}
```

### Frontend Değişiklikleri

**MediaLibrary.js:**
```javascript
// Tab'lar ekle
renderTabs() {
    return `
        <div class="media-tabs">
            <button class="tab active" data-scope="all">Tümü</button>
            <button class="tab" data-scope="company">Firmam</button>
            <button class="tab" data-scope="public">Ortak Kütüphane</button>
        </div>
    `;
}

// Public medya için readonly badge
renderMediaItem(item) {
    const isReadonly = item.scope === 'public';
    return `
        <div class="media-item ${isReadonly ? 'readonly' : ''}">
            ${isReadonly ? '<span class="badge">Ortak</span>' : ''}
            <img src="${item.url}" />
            ${!isReadonly ? '<button class="delete-btn">Sil</button>' : ''}
        </div>
    `;
}
```

---

## ŞABLON PAYLAŞIM MİMARİSİ

### Mevcut Durum

```sql
-- Şu anki sorgu
SELECT * FROM templates
WHERE company_id = ? OR company_id IS NULL OR is_public = 1;
```

### Önerilen Yapı

```sql
-- templates tablosu güncelleme
ALTER TABLE templates ADD COLUMN scope TEXT DEFAULT 'company';
-- scope: 'system' (varsayılan şablonlar), 'public' (paylaşılan), 'company' (firma)

ALTER TABLE templates ADD COLUMN source_template_id TEXT;
-- Kopyalandığı şablonun ID'si (varsa)

ALTER TABLE templates ADD COLUMN is_editable INTEGER DEFAULT 1;
-- Düzenlenebilir mi? (sistem şablonları için 0)
```

### Şablon Kategorileri

| Scope | Görünürlük | Düzenleme | Silme |
|-------|------------|-----------|-------|
| system | Herkes | Kimse (kopyalanabilir) | Sadece SuperAdmin |
| public | Herkes | Sadece sahibi | Sadece sahibi |
| company | Sadece firma | Firma kullanıcıları | Firma Admin |

### Şablon Kopyalama (Fork) Sistemi

```php
// templates/fork.php
$sourceTemplate = $db->fetch(
    "SELECT * FROM templates WHERE id = ? AND (scope IN ('system', 'public') OR company_id = ?)",
    [$templateId, $companyId]
);

if (!$sourceTemplate) {
    Response::notFound('Şablon bulunamadı');
}

// Kopyala
$newId = $db->generateUuid();
$db->insert('templates', [
    'id' => $newId,
    'company_id' => $companyId,
    'name' => $sourceTemplate['name'] . ' (Kopya)',
    'scope' => 'company',
    'source_template_id' => $templateId,
    'design_data' => $sourceTemplate['design_data'],
    // ... diğer alanlar
]);

Response::success(['id' => $newId], 'Şablon kopyalandı');
```

---

## ENTEGRASYON AYARLARI

### Mevcut Durum

Entegrasyon ayarları `settings` tablosunda JSON olarak saklanıyor. Bu yapı korunmalı ama firma izolasyonu güçlendirilmeli.

### Entegrasyon Türleri ve İzolasyon

| Entegrasyon | Kapsam | Açıklama |
|-------------|--------|----------|
| HAL Kunye | Firma | Her firma kendi HAL hesabını kullanır |
| Hanshow ESL | Firma | ESL-Working bağlantısı firma bazlı |
| Iyzico/Paynet | Global | Ödeme sağlayıcı SuperAdmin yönetir |
| SMTP | Firma | Her firma kendi mail sunucusunu kullanabilir |
| ERP | Firma | ERP entegrasyonu firma bazlı |

### Settings Tablosu Yapısı

```sql
-- Mevcut yapı iyi, ek alan önermiyorum
-- Firma ayarları: company_id = X, user_id = NULL
-- Kullanıcı ayarları: company_id = X, user_id = Y
-- Global ayarlar: company_id = NULL, user_id = NULL
```

### Entegrasyon Ayarları JSON Yapısı

```json
{
    "hal_integration": {
        "username": "firma_hal_user",
        "password": "***",
        "enabled": true
    },
    "hanshow_settings": {
        "eslworking_url": "http://192.168.1.100:9000",
        "user_id": "default",
        "enabled": true
    },
    "smtp_settings": {
        "host": "smtp.firma.com",
        "port": 587,
        "username": "noreply@firma.com",
        "password": "***"
    },
    "erp_settings": {
        "type": "custom",
        "api_url": "https://erp.firma.com/api",
        "api_key": "***"
    }
}
```

### API Güvenlik Kontrolü

```php
// api/settings/index.php - Mevcut yapı iyi
// Sadece kendi firma/kullanıcı ayarlarını görebilir

// GET - Ayarları getir
$companyId = Auth::getActiveCompanyId();
$companySettings = $db->fetch(
    "SELECT * FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);
```

---

## FİRMA KURULUM SEED SİSTEMİ

### Mevcut Durum

`001_default_data.php` sadece ilk kurulumda çalışıyor. Yeni firma eklendiğinde varsayılan veriler oluşturulmuyor.

### Önerilen: CompanySeeder Servisi

**services/CompanySeeder.php:**
```php
<?php
class CompanySeeder
{
    private $db;
    private $companyId;

    public function __construct(string $companyId)
    {
        $this->db = Database::getInstance();
        $this->companyId = $companyId;
    }

    /**
     * Yeni firma için tüm varsayılan verileri oluştur
     */
    public function seedAll(): void
    {
        $this->seedCategories();
        $this->seedProductionTypes();
        $this->seedLabelSizes();
        $this->seedImportMappings();
        $this->seedTemplates();
        $this->seedDefaultSettings();
        $this->seedMenuItems();
        $this->seedLayoutConfig();
    }

    /**
     * Varsayılan kategoriler
     */
    public function seedCategories(): void
    {
        $categories = [
            ['name' => 'Meyve-Sebze', 'slug' => 'meyve-sebze', 'color' => '#4CAF50'],
            ['name' => 'Et-Tavuk-Balık', 'slug' => 'et-tavuk-balik', 'color' => '#F44336'],
            ['name' => 'Süt Ürünleri', 'slug' => 'sut-urunleri', 'color' => '#2196F3'],
            ['name' => 'Temel Gıda', 'slug' => 'temel-gida', 'color' => '#FF9800'],
            ['name' => 'İçecekler', 'slug' => 'icecekler', 'color' => '#9C27B0'],
            ['name' => 'Atıştırmalıklar', 'slug' => 'atistirmaliklar', 'color' => '#795548'],
            ['name' => 'Temizlik', 'slug' => 'temizlik', 'color' => '#00BCD4'],
            ['name' => 'Kişisel Bakım', 'slug' => 'kisisel-bakim', 'color' => '#E91E63'],
        ];

        foreach ($categories as $cat) {
            $existing = $this->db->fetch(
                "SELECT 1 FROM categories WHERE company_id = ? AND slug = ?",
                [$this->companyId, $cat['slug']]
            );

            if (!$existing) {
                $this->db->insert('categories', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'name' => $cat['name'],
                    'slug' => $cat['slug'],
                    'color' => $cat['color'],
                    'status' => 'active'
                ]);
            }
        }
    }

    /**
     * Varsayılan üretim tipleri
     */
    public function seedProductionTypes(): void
    {
        $types = [
            ['name' => 'Konvansiyonel', 'slug' => 'konvansiyonel', 'color' => '#9E9E9E'],
            ['name' => 'Organik', 'slug' => 'organik', 'color' => '#4CAF50'],
            ['name' => 'Naturel', 'slug' => 'naturel', 'color' => '#8BC34A'],
            ['name' => 'İyi Tarım', 'slug' => 'iyi-tarim', 'color' => '#CDDC39'],
            ['name' => 'Geleneksel', 'slug' => 'geleneksel', 'color' => '#795548'],
        ];

        foreach ($types as $type) {
            $existing = $this->db->fetch(
                "SELECT 1 FROM production_types WHERE company_id = ? AND slug = ?",
                [$this->companyId, $type['slug']]
            );

            if (!$existing) {
                $this->db->insert('production_types', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'name' => $type['name'],
                    'slug' => $type['slug'],
                    'color' => $type['color'],
                    'status' => 'active'
                ]);
            }
        }
    }

    /**
     * Varsayılan etiket boyutları
     */
    public function seedLabelSizes(): void
    {
        // Global varsayılanlar zaten mevcut
        // Firma özel boyutları burada eklenebilir
    }

    /**
     * Varsayılan import mapping
     */
    public function seedImportMappings(): void
    {
        // Global varsayılan mapping zaten var
        // Firma özel mapping gerekirse burada eklenebilir
    }

    /**
     * Sistem şablonlarını firmaya kopyala
     */
    public function seedTemplates(): void
    {
        // Sistem şablonlarından kopyala
        $systemTemplates = $this->db->fetchAll(
            "SELECT * FROM templates WHERE scope = 'system' AND status = 'active'"
        );

        foreach ($systemTemplates as $template) {
            // Aynı isimde varsa atla
            $existing = $this->db->fetch(
                "SELECT 1 FROM templates WHERE company_id = ? AND name = ?",
                [$this->companyId, $template['name']]
            );

            if (!$existing) {
                $newId = $this->db->generateUuid();
                $this->db->insert('templates', [
                    'id' => $newId,
                    'company_id' => $this->companyId,
                    'name' => $template['name'],
                    'description' => $template['description'],
                    'type' => $template['type'],
                    'category' => $template['category'],
                    'width' => $template['width'],
                    'height' => $template['height'],
                    'orientation' => $template['orientation'],
                    'target_device_type' => $template['target_device_type'],
                    'grid_layout' => $template['grid_layout'],
                    'design_data' => $template['design_data'],
                    'scope' => 'company',
                    'source_template_id' => $template['id'],
                    'status' => 'active',
                    'is_public' => 0
                ]);
            }
        }
    }

    /**
     * Varsayılan ayarlar
     */
    public function seedDefaultSettings(): void
    {
        $existing = $this->db->fetch(
            "SELECT 1 FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$this->companyId]
        );

        if (!$existing) {
            $this->db->insert('settings', [
                'id' => $this->db->generateUuid(),
                'company_id' => $this->companyId,
                'user_id' => null,
                'data' => json_encode([
                    'language' => 'tr',
                    'timezone' => 'Europe/Istanbul',
                    'date_format' => 'DD.MM.YYYY',
                    'currency' => 'TRY',
                    'currency_symbol' => '₺',
                    'gateway_enabled' => true,
                    'notify_email' => true,
                    'weighing_flag_code' => '27',
                    'weighing_barcode_format' => 'CODE128'
                ])
            ]);
        }
    }

    /**
     * Varsayılan menü öğeleri (firma özel gerekirse)
     */
    public function seedMenuItems(): void
    {
        // Global menü öğeleri zaten var
        // Firma özel menü gerekirse burada eklenebilir
    }

    /**
     * Varsayılan layout config
     */
    public function seedLayoutConfig(): void
    {
        $existing = $this->db->fetch(
            "SELECT 1 FROM layout_configs WHERE scope = 'company' AND scope_id = ?",
            [$this->companyId]
        );

        if (!$existing) {
            $this->db->insert('layout_configs', [
                'id' => $this->db->generateUuid(),
                'scope' => 'company',
                'scope_id' => $this->companyId,
                'config' => json_encode([
                    'themeMode' => 'light',
                    'direction' => 'ltr',
                    'language' => 'tr',
                    'sidebar' => [
                        'collapsed' => false,
                        'position' => 'left'
                    ]
                ])
            ]);
        }
    }
}
```

### Firma Oluşturma Entegrasyonu

**api/companies/create.php:**
```php
// Firma oluştur
$companyId = $db->generateUuid();
$db->insert('companies', [
    'id' => $companyId,
    'name' => $data['name'],
    // ... diğer alanlar
]);

// Varsayılan verileri oluştur
require_once BASE_PATH . '/services/CompanySeeder.php';
$seeder = new CompanySeeder($companyId);
$seeder->seedAll();

Response::success(['id' => $companyId], 'Firma oluşturuldu');
```

---

## UYGULAMA PLANI

### Aşama 1: Kritik Güvenlik (Hemen)

| Görev | Dosya | Süre |
|-------|-------|------|
| device_sync_requests'e company_id ekle | Migration 046 | 15 dk |
| esl/pending.php company_id filtresi | api/esl/pending.php | 15 dk |
| esl/register.php company atama | api/esl/register.php | 30 dk |
| media/serve.php izolasyon | api/media/serve.php | 30 dk |
| media/browse.php izolasyon | api/media/browse.php | 30 dk |

**Toplam:** ~2 saat

### Aşama 2: Medya Kütüphanesi (Kısa Vade)

| Görev | Dosya | Süre |
|-------|-------|------|
| media tablosu scope alanı | Migration 047 | 15 dk |
| Storage dizin yapısı oluştur | Bash script | 30 dk |
| media/index.php güncelle | API | 45 dk |
| media/upload.php güncelle | API | 45 dk |
| media/delete.php güncelle | API | 30 dk |
| MediaLibrary.js tab sistemi | Frontend | 1 saat |

**Toplam:** ~4 saat

### Aşama 3: Şablon Sistemi (Kısa Vade)

| Görev | Dosya | Süre |
|-------|-------|------|
| templates tablosu scope alanı | Migration 048 | 15 dk |
| templates/fork.php endpoint | API | 45 dk |
| Sistem şablonları seed | Seed dosyası | 1 saat |
| TemplateList.js güncelle | Frontend | 1 saat |

**Toplam:** ~3 saat

### Aşama 4: CompanySeeder (Orta Vade)

| Görev | Dosya | Süre |
|-------|-------|------|
| CompanySeeder servisi | services/CompanySeeder.php | 2 saat |
| companies/create.php entegrasyonu | API | 30 dk |
| Test ve doğrulama | Test | 1 saat |

**Toplam:** ~3.5 saat

### Aşama 5: Entegrasyon İzolasyonu (Orta Vade)

| Görev | Dosya | Süre |
|-------|-------|------|
| Hanshow ayarları firma bazlı | API/Frontend | 1 saat |
| HAL ayarları firma bazlı | Mevcut, doğrula | 30 dk |
| SMTP ayarları firma bazlı | API/Frontend | 1 saat |

**Toplam:** ~2.5 saat

---

## TOPLAM TAHMİNİ ÇALIŞMA

| Aşama | Süre | Öncelik |
|-------|------|---------|
| Aşama 1: Kritik Güvenlik | 2 saat | 🔴 ACİL |
| Aşama 2: Medya Kütüphanesi | 4 saat | 🟡 KISA VADE |
| Aşama 3: Şablon Sistemi | 3 saat | 🟡 KISA VADE |
| Aşama 4: CompanySeeder | 3.5 saat | 🟢 ORTA VADE |
| Aşama 5: Entegrasyon | 2.5 saat | 🟢 ORTA VADE |
| **TOPLAM** | **~15 saat** | |

---

## SONUÇ

### ✅ İyi Durumda Olan Alanlar
- Products API (%100 izole)
- Templates API (%100 izole)
- Devices API (%100 izole)
- Settings API (%100 izole)
- Render Queue (%100 izole)

### ⚠️ İyileştirme Gereken Alanlar
- Media API (serve/browse açıkları)
- ESL/Player API (pending, register açıkları)
- Licenses API (SuperAdmin kontrolü eksik)

### 🎯 Öncelikli Aksiyonlar
1. **Hemen:** device_sync_requests ve media serve güvenlik açıkları
2. **Bu Hafta:** Medya kütüphanesi ortak/firma yapısı
3. **Bu Ay:** CompanySeeder ve şablon fork sistemi

---

**Rapor Sonu**
*Oluşturulma: 2026-01-25*
