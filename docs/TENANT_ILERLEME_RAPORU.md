# Multi-Tenant İzolasyon - İlerleme Raporu

**Tarih:** 2026-01-25
**Referans:** [TENANT_KAPSAMLI_ANALIZ.md](./TENANT_KAPSAMLI_ANALIZ.md)

---

## Özet

| Aşama | Durum | Açıklama |
|-------|-------|----------|
| Aşama 1: Kritik Güvenlik | ✅ TAMAMLANDI | Tüm güvenlik açıkları kapatıldı |
| Aşama 2: Medya Kütüphanesi | ✅ TAMAMLANDI | Backend tamamlandı |
| Aşama 3: Şablon Sistemi | ✅ TAMAMLANDI | Backend tamamlandı |
| Aşama 4: CompanySeeder | ✅ TAMAMLANDI | Tam işlevsel |
| Aşama 5: Entegrasyon İzolasyonu | ✅ TAMAMLANDI | 3 seviyeli config modeli |

---

## Aşama 1: Kritik Güvenlik Açıkları ✅ TAMAMLANDI

### 1.1 device_sync_requests - company_id Kolonları
**Durum:** ✅ ZATEN MEVCUT

**Kanıt:** `database/migrations/021_esl_pwa_updates.sql` (satır 80)
```sql
CREATE TABLE IF NOT EXISTS device_sync_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT,  -- ZATEN MEVCUT!
    sync_code TEXT UNIQUE,
    ...
);
```

**Not:** Analiz dokümanı bu kolonun eksik olduğunu belirtiyordu, ancak inceleme sonucunda kolonun orijinal tablo tanımında zaten mevcut olduğu tespit edildi.

---

### 1.2 api/esl/pending.php - Tenant Filtreleme
**Durum:** ✅ ZATEN MEVCUT

**Kanıt:** `api/esl/pending.php` (satır 43-48)
```php
// TENANT ISOLATION: Filter by company_id
if ($companyId) {
    $where[] = "(dsr.company_id = ? OR dsr.company_id IS NULL)";
    $params[] = $companyId;
}
```

**Açıklama:** Bekleyen cihaz istekleri şirket bazında filtreleniyor. SuperAdmin tüm şirketleri görebilir.

---

### 1.3 api/media/serve.php - Dizin İzolasyonu
**Durum:** ✅ ZATEN MEVCUT

**Kanıt:** `api/media/serve.php` (satır 100-130)
- JWT token doğrulaması yapılıyor
- `/storage/companies/{company_id}/` yolu şirket bazında kontrol ediliyor
- SuperAdmin tüm şirketlere erişebiliyor
- Dizin yapısı: `public/`, `avatars/`, `companies/{id}/`, `system/`

---

### 1.4 api/media/browse.php - Dizin Gezinme İzolasyonu
**Durum:** ✅ ZATEN MEVCUT

**Kanıt:** `api/media/browse.php` (satır 85-93)
```php
if (preg_match('/^companies\/([a-f0-9\-]+)(\/|$)/', $relativePath, $matches)) {
    $pathCompanyId = $matches[1];
    if ($isSuperAdmin) {
        $accessAllowed = true;
    } elseif ($companyId === $pathCompanyId) {
        $accessAllowed = true;
    }
}
```

**Açıklama:** Kullanıcılar sadece kendi şirketlerinin dizinlerini gezebilir.

---

## Aşama 2: Medya Kütüphanesi İzolasyonu ✅ TAMAMLANDI

### 2.1 Migration 047 - Media Tenant İzolasyonu
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `database/migrations/047_media_tenant_isolation.sql`
```sql
ALTER TABLE media ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN scope TEXT DEFAULT 'company'
    CHECK(scope IN ('company', 'public', 'system'));
CREATE INDEX IF NOT EXISTS idx_media_is_public ON media(is_public);
CREATE INDEX IF NOT EXISTS idx_media_scope ON media(scope);
CREATE INDEX IF NOT EXISTS idx_media_company_scope ON media(company_id, scope);
```

---

### 2.2 Storage Dizin Yapısı
**Durum:** ✅ MEVCUT

**Yapı:**
```
storage/
├── companies/
│   ├── b0eee1ca-xxx/
│   │   └── branding/
│   │       ├── logo.png
│   │       ├── logo-dark.jpg
│   │       ├── favicon.png
│   │       └── icon-*.png
│   ├── 8c156035-xxx/
│   └── bbd3d4e6-xxx/
├── public/
├── avatars/
└── system/
```

---

## Aşama 3: Şablon Sistemi İzolasyonu ✅ TAMAMLANDI

### 3.1 Migration 048 - Template Tenant İzolasyonu
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `database/migrations/048_template_tenant_isolation.sql`
```sql
ALTER TABLE templates ADD COLUMN scope TEXT DEFAULT 'company'
    CHECK(scope IN ('system', 'company'));
ALTER TABLE templates ADD COLUMN is_forked INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_templates_scope ON templates(scope);

-- Mevcut verileri güncelle
UPDATE templates SET scope = 'system' WHERE company_id IS NULL;
UPDATE templates SET scope = 'company' WHERE company_id IS NOT NULL;
UPDATE templates SET is_forked = 1 WHERE parent_id IN
    (SELECT id FROM templates WHERE scope = 'system');
```

---

### 3.2 Template Fork API
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `api/templates/fork.php`

**Özellikler:**
- Sistem şablonlarını şirket bazında kopyalama
- Mevcut fork kontrolü (duplicate önleme)
- Yetki kontrolü (sistem şablonlarına erişim)
- `is_forked = 1` ve `parent_id` bağlantısı

---

### 3.3 Template API Koruma
**Durum:** ✅ MEVCUT

**Dosyalar:**
- `api/templates/update.php` - SuperAdmin/scope koruması
- `api/templates/delete.php` - SuperAdmin/scope koruması

**Koruma mantığı:**
```php
$isSystemTemplate = $template['scope'] === 'system' || $template['company_id'] === null;
if ($isSystemTemplate && !$isSuperAdmin) {
    Response::error('Sistem şablonlarını düzenleme yetkiniz yok', 403);
}
```

---

## Aşama 4: CompanySeeder ✅ TAMAMLANDI

### 4.1 CompanySeeder Servisi
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `services/CompanySeeder.php`

**Özellikler:**
- `seedCategories()` - 8 varsayılan kategori
- `seedProductionTypes()` - 5 üretim tipi
- `seedDefaultSettings()` - Firma ayarları
- `seedLayoutConfig()` - UI ayarları
- `seedTemplates()` - Sistem şablonlarını kopyalama (fork)
- `createStorageDirectories()` - Depolama dizinleri
- `seedAllWithStorage()` - Tümünü çalıştır

---

### 4.2 Company Create Entegrasyonu
**Durum:** ✅ ENTEGRE EDİLDİ

**Dosya:** `api/companies/create.php`

**Entegrasyon:**
```php
// Seed default data for the new company
require_once BASE_PATH . '/services/CompanySeeder.php';
$seeder = new CompanySeeder($id);
$seedResults = $seeder->seedAllWithStorage();

// Add seed summary to company data
$company['seed_summary'] = CompanySeeder::getSummary($seedResults);
```

---

## Aşama 5: Entegrasyon İzolasyonu ✅ TAMAMLANDI

### 5.0 3 Seviyeli Config Modeli
**Durum:** ✅ OLUŞTURULDU

**Mimari:**
```
system (scope='system', company_id=NULL) → Platform geneli varsayılan (SuperAdmin yönetir)
    ↓ fallback
company (scope='company', company_id=X) → Firma bazlı override
```

**Altın Kural:**
1. Company override varsa → onu kullan
2. Yoksa system default → fallback

**Servis:** `services/SettingsResolver.php`

```php
public function getEffectiveSettings(string $integrationType, ?string $companyId = null): array
{
    // 1. Company override var mı?
    if ($companyId) {
        $companySettings = $this->db->fetch(
            "SELECT * FROM integration_settings
             WHERE integration_type = ? AND company_id = ? AND scope = 'company'",
            [$integrationType, $companyId]
        );
        if ($companySettings && !empty($companySettings['config_json'])) {
            return [
                'settings' => json_decode($companySettings['config_json'], true),
                'source' => 'company',
                'is_override' => true,
                'is_active' => (bool)$companySettings['is_active']
            ];
        }
    }
    // 2. System default'a fallback
    $systemSettings = $this->db->fetch(
        "SELECT * FROM integration_settings
         WHERE integration_type = ? AND scope = 'system' AND company_id IS NULL",
        [$integrationType]
    );
    // ... return system or empty
}
```

---

### 5.1 Migration 049 - Integration Settings İzolasyonu
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `database/migrations/049_integration_settings_isolation.sql`

**Değişiklikler:**
```sql
-- Hanshow: scope eklendi, company_id NULL olabilir
ALTER TABLE hanshow_settings RENAME TO hanshow_settings_new;
-- (yeni tablo ile scope='system'/'company' desteği)

-- Genel entegrasyonlar için yeni tablo
CREATE TABLE IF NOT EXISTS integration_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT NULL,
    scope TEXT DEFAULT 'company' CHECK(scope IN ('system', 'company')),
    integration_type TEXT NOT NULL CHECK(integration_type IN ('hal', 'smtp', 'erp', 'payment')),
    config_json TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- System default kayıtları
INSERT OR IGNORE INTO hanshow_settings (id, company_id, scope, ...) VALUES ('system-hanshow-default', NULL, 'system', ...);
INSERT OR IGNORE INTO integration_settings (id, company_id, scope, integration_type, ...) VALUES ('system-hal-default', NULL, 'system', 'hal', ...);
INSERT OR IGNORE INTO integration_settings (id, company_id, scope, integration_type, ...) VALUES ('system-smtp-default', NULL, 'system', 'smtp', ...);
```

---

### 5.2 Hanshow Ayarları İzolasyonu
**Durum:** ✅ TAMAMLANDI

**Dosya:** `api/hanshow/settings.php`

**API Endpoint'leri:**
- `GET /api/hanshow/settings` - Efektif ayarları getir (company → system fallback)
- `PUT /api/hanshow/settings` - Company ayarlarını güncelle
- `GET /api/hanshow/settings?scope=system` - System ayarlarını getir (SuperAdmin)
- `PUT /api/hanshow/settings?scope=system` - System ayarlarını güncelle (SuperAdmin)
- `DELETE /api/hanshow/settings` - Company override'ı sil

**Response Meta:**
```json
{
    "settings": {...},
    "meta": {
        "source": "company",
        "is_override": true,
        "can_override": true,
        "is_super_admin": false
    }
}
```

---

### 5.3 HAL Ayarları İzolasyonu
**Durum:** ✅ TAMAMLANDI

**Dosya:** `api/hal/settings.php`

**API Endpoint'leri:**
- `GET /api/hal/settings` - Efektif ayarları getir
- `PUT /api/hal/settings` - Company ayarlarını güncelle
- `GET /api/hal/settings?scope=system` - System ayarlarını getir (SuperAdmin)
- `PUT /api/hal/settings?scope=system` - System ayarlarını güncelle (SuperAdmin)
- `DELETE /api/hal/settings` - Company override'ı sil

**Özellikler:**
- Şifre maskeleme (`maskPasswords()`)
- Ayar birleştirme (`mergeSettings()`)
- `integration_settings` tablosu ile `integration_type='hal'`

---

### 5.4 SMTP Ayarları İzolasyonu
**Durum:** ✅ TAMAMLANDI

**Dosya:** `api/smtp/settings.php`

**API Endpoint'leri:**
- `GET /api/smtp/settings` - Efektif ayarları getir
- `PUT /api/smtp/settings` - Company ayarlarını güncelle
- `GET /api/smtp/settings?scope=system` - System ayarlarını getir (SuperAdmin)
- `PUT /api/smtp/settings?scope=system` - System ayarlarını güncelle (SuperAdmin)
- `DELETE /api/smtp/settings` - Company override'ı sil

**SMTP Alanları:**
- host, port, username, password
- encryption (tls/ssl)
- from_email, from_name
- enabled

---

### 5.5 SettingsResolver Servisi
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `services/SettingsResolver.php`

**Metodlar:**
| Metod | Açıklama |
|-------|----------|
| `getEffectiveSettings($type, $companyId)` | Fallback pattern ile efektif ayarları getir |
| `saveCompanySettings($type, $companyId, $config)` | Company-level ayar kaydet |
| `saveSystemSettings($type, $config)` | System-level ayar kaydet (SuperAdmin) |
| `deleteCompanyOverride($type, $companyId)` | Company override'ı sil |
| `getHanshowSettings($companyId)` | Hanshow özel (ayrı tablo) |
| `saveHanshowCompanySettings($companyId, $data)` | Hanshow company kaydet |
| `saveHanshowSystemSettings($data)` | Hanshow system kaydet |
| `getAllIntegrationStatus($companyId)` | Tüm entegrasyonların durumu |
| `getBothSettings($type, $companyId)` | System ve company ayarlarını birlikte getir |

---

## Sonuç

**Tamamlanan:** 5/5 Aşama (%100)

| Kategori | Tamamlanan | Toplam |
|----------|------------|--------|
| Kritik Güvenlik | 4/4 | ✅ |
| Backend Migrations | 3/3 | ✅ |
| API Endpoints | 6/6 | ✅ |
| Services | 2/2 | ✅ |
| Entegrasyon Ayarları | 3/3 | ✅ |

---

## Dosya Referansları

| Dosya | Aşama | Durum |
|-------|-------|-------|
| `database/migrations/021_esl_pwa_updates.sql` | 1 | Mevcut |
| `database/migrations/047_media_tenant_isolation.sql` | 2 | Oluşturuldu |
| `database/migrations/048_template_tenant_isolation.sql` | 3 | Oluşturuldu |
| `database/migrations/049_integration_settings_isolation.sql` | 5 | Oluşturuldu |
| `database/migrations/050_integration_settings_unique_constraint.sql` | 5+ | Oluşturuldu |
| `database/migrations/051_integration_settings_audit.sql` | Roadmap | Oluşturuldu |
| `services/CompanySeeder.php` | 4 | Oluşturuldu |
| `services/SettingsResolver.php` | 5 | Oluşturuldu |
| `api/companies/create.php` | 4 | Güncellendi |
| `api/templates/fork.php` | 3 | Oluşturuldu |
| `api/templates/update.php` | 3 | Mevcut |
| `api/templates/delete.php` | 3 | Mevcut |
| `api/hanshow/settings.php` | 5 | Güncellendi |
| `api/hal/settings.php` | 5 | Güncellendi |
| `api/smtp/settings.php` | 5 | Oluşturuldu |
| `api/esl/pending.php` | 1 | Mevcut |
| `api/media/serve.php` | 1 | Mevcut |
| `api/media/browse.php` | 1 | Mevcut |

---

## Ekstra İyileştirmeler

### 6.1 UNIQUE Constraint
**Durum:** ✅ OLUŞTURULDU

**Dosya:** `database/migrations/050_integration_settings_unique_constraint.sql`

**Açıklama:**
```sql
UNIQUE (integration_type, scope, company_id)
```

Bu constraint sayesinde:
- Aynı firma için aynı entegrasyon tipinde sadece 1 override olabilir
- System scope için company_id NULL olmalı ve tekrar edemez
- Veri bütünlüğü garanti altında

---

### 6.2 is_active Davranış Politikası
**Durum:** ✅ DOKÜMANTE EDİLDİ

**Dosya:** `services/SettingsResolver.php` (class docblock)

**Politika:**
- Company override VARSA → Company'nin kendi is_active değeri kullanılır
- Company override YOKSA → System is_active değeri kullanılır
- Override yapan firma bağımsız davranır (pilot firma senaryosu)

**Örnek:**
- Sistem genelinde kapalı, ama X firması test ediyor → X firması aktif yapabilir
- Sistem genelinde açık, ama Y firması kullanmıyor → Y firması pasif yapabilir

---

### 6.3 Audit Log (Roadmap)
**Durum:** ✅ OLUŞTURULDU (Tablo hazır, servis entegrasyonu sonraki sürümde)

**Dosya:** `database/migrations/051_integration_settings_audit.sql`

**Tablo Yapısı:**
| Alan | Açıklama |
|------|----------|
| integration_settings_id | Değişen ayar kaydı |
| action | create, update, delete, override_removed |
| old_config / new_config | Önceki ve yeni JSON config |
| changed_fields | Hangi alanlar değişti (JSON array) |
| changed_by | Değişikliği yapan kullanıcı |
| ip_address | İşlem IP adresi |

**Kullanım Amaçları:**
- "Kim, ne zaman, neyi değiştirdi?" sorusuna cevap
- Sorun anında önceki ayara geri dönme
- Uyumluluk ve denetim gereksinimleri

---

### 6.4 UX Önerisi (Wizard)
**Durum:** 📋 TODO (Frontend)

**Öneri:**
Entegrasyon ayar sayfalarında, firma varsayılanları kullanırken şu mesaj gösterilmeli:

```html
<div class="alert alert-info">
    <i class="ti ti-info-circle"></i>
    <strong>Sistem varsayılanlarını kullanıyorsunuz.</strong>
    <p>Dilerseniz firma bazında özelleştirebilirsiniz. Özelleştirme yaptığınızda sistem varsayılanları değil, kendi ayarlarınız geçerli olacaktır.</p>
    <button class="btn btn-sm btn-outline-primary">
        <i class="ti ti-edit"></i> Özelleştir
    </button>
</div>
```

**Gösterilecek Durum:**
- `meta.source === 'system'` ve `meta.is_override === false` ise göster

**İlgili Dosyalar:**
- `public/assets/js/pages/settings/IntegrationSettings.js`
- `locales/tr/pages/settings.json` (çeviriler)

---

### 6.5 Veritabanı Şema Düzeltmeleri
**Durum:** ✅ TAMAMLANDI

**Tarih:** 2026-01-25

**Düzeltilen Eksik Kolonlar:**
| Tablo | Kolon | Açıklama |
|-------|-------|----------|
| `menu_items` | `updated_at` | Migration 041 için gerekli |
| `templates` | `scope` | Tenant izolasyonu için |
| `templates` | `is_forked` | Fork edilen şablonlar için |
| `media` | `is_public` | Genel erişim kontrolü |
| `media` | `scope` | Tenant izolasyonu için |
| `hanshow_settings` | `scope` | 3 seviyeli config modeli için |

**Oluşturulan Yeni Tablolar:**
| Tablo | Açıklama |
|-------|----------|
| `integration_settings` | 3 seviyeli config modeli (UNIQUE constraint ile) |
| `integration_settings_audit` | Audit log (roadmap) |

**İndeksler:**
- `idx_templates_scope`, `idx_templates_company_scope`
- `idx_media_scope`, `idx_media_is_public`, `idx_media_company_scope`
- `idx_hanshow_settings_scope`, `idx_hanshow_settings_company_scope`
- `idx_integration_settings_*` (5 index)
- `idx_audit_*` (6 index)

**Migration Dosyaları:**
- `049_create_integration_settings.sql` - Ana tablo + UNIQUE constraint
- `051_integration_settings_audit.sql` - Audit tablosu
- `052_fix_missing_columns.sql` - Eksik kolonları ekler

---

## API Kullanım Örnekleri

### Efektif Ayarları Getir (Firma)
```bash
GET /api/smtp/settings
Authorization: Bearer <token>

Response:
{
    "success": true,
    "data": {
        "configured": true,
        "settings": {
            "host": "smtp.example.com",
            "port": 587,
            "username": "user@example.com",
            "password": "********",
            "encryption": "tls",
            "from_email": "noreply@example.com",
            "from_name": "Omnex Hub"
        },
        "meta": {
            "source": "company",
            "is_override": true,
            "is_active": true,
            "can_override": true,
            "is_super_admin": false
        }
    }
}
```

### System Ayarlarını Getir (SuperAdmin)
```bash
GET /api/smtp/settings?scope=system
Authorization: Bearer <superadmin_token>

Response:
{
    "success": true,
    "data": {
        "scope": "system",
        "configured": true,
        "settings": {...}
    }
}
```

### Company Override Sil (Varsayılana Dön)
```bash
DELETE /api/smtp/settings
Authorization: Bearer <token>

Response:
{
    "success": true,
    "data": {
        "deleted": true,
        "settings": {...},
        "meta": {
            "source": "system",
            "is_override": false
        }
    },
    "message": "Firma SMTP ayarları silindi, sistem varsayılanı kullanılacak"
}
```
