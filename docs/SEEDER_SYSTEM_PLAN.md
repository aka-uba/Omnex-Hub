# Evrensel Seeder Sistemi - Uygulama Planı

**Versiyon:** 2.0
**Tarih:** 2026-01-25
**Durum:** UYGULAMASI TAMAMLANDI

---

## 📋 Genel Bakış

Bu doküman, multi-tenant mimari için evrensel seeder sisteminin tasarım ve uygulama planını içerir. Her yeni firma oluşturulduğunda varsayılan verilerin otomatik olarak eklenmesini sağlar.

### Hedefler
- Tüm dillere uyumlu evrensel seed yapısı
- Firma bazlı izole veri oluşturma
- CSV/JSON tabanlı veri kaynakları
- CLI ve Wizard üzerinden çalıştırılabilir
- Modüler ve genişletilebilir mimari
- **Demo/Default veri ayrımı** (is_demo, is_default bayrakları)
- **İdempotent upsert** desteği (key bazlı)
- **Dry-run modu** ile güvenli önizleme

### Kapsam
- Kategoriler
- Üretim tipleri
- Demo ürünler
- Şablonlar
- Varsayılan ayarlar
- Menü öğeleri
- Layout konfigürasyonu
- Etiket boyutları

---

## 📁 Dizin Yapısı (UYGULANMIŞ)

```
database/
└── seeders/                        # Evrensel Seeder Sistemi
    ├── seed.php                    # CLI çalıştırıcı (v2.0)
    ├── BaseSeeder.php              # Ana servis sınıfı
    ├── CategorySeeder.php          # Kategori seeder
    ├── ProductSeeder.php           # Ürün seeder
    ├── ProductionTypeSeeder.php    # Üretim tipi seeder
    ├── TemplateSeeder.php          # Şablon seeder
    ├── SettingsSeeder.php          # Ayarlar seeder
    ├── LabelSizeSeeder.php         # Etiket boyutu seeder
    ├── MenuItemSeeder.php          # Menü öğesi seeder
    ├── LayoutConfigSeeder.php      # Layout config seeder
    ├── CsvToJsonConverter.php      # CSV dönüştürücü
    │
    └── data/                       # Dil bazlı veri dosyaları
        ├── tr/                     # Türkçe
        │   ├── categories.json     # ✅ Tamamlandı
        │   ├── production_types.json # ✅ Tamamlandı
        │   ├── products.json       # ✅ Tamamlandı
        │   ├── templates.json      # ✅ Tamamlandı
        │   └── settings.json       # ✅ Tamamlandı
        │
        ├── en/                     # English
        │   ├── categories.json     # ✅ Tamamlandı
        │   ├── production_types.json # ✅ Tamamlandı
        │   ├── products.json       # ✅ Tamamlandı
        │   ├── templates.json      # ✅ Tamamlandı
        │   └── settings.json       # ✅ Tamamlandı
        │
        └── shared/                 # Dil bağımsız veriler
            ├── label_sizes.json    # ✅ Tamamlandı
            ├── units.json          # ✅ Tamamlandı
            ├── menu_items.json     # ✅ Tamamlandı
            └── layout_config.json  # ✅ Tamamlandı
```

---

## 🔄 Fazlar ve Durum

### FAZ 1: Temel Altyapı ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 1.1 | Dizin yapısını oluştur | ✅ Tamamlandı |
| 1.2 | BaseSeeder.php temel sınıf yapısı | ✅ Tamamlandı |
| 1.3 | JSON veri okuma helper metodları | ✅ Tamamlandı |
| 1.4 | Hata yönetimi ve loglama | ✅ Tamamlandı |
| 1.5 | CsvToJsonConverter.php implementasyonu | ✅ Tamamlandı |

**Çıktılar:**
- `database/seeders/` dizin yapısı oluşturuldu
- `BaseSeeder.php` tam fonksiyonel (~300 satır)
- Veri okuma ve yazma metodları çalışır durumda

---

### FAZ 2: Türkçe Veri Dosyaları ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 2.1 | CSV analizi ve veri çıkarımı | ✅ Tamamlandı |
| 2.2 | `categories.json` oluştur | ✅ Tamamlandı |
| 2.3 | `production_types.json` oluştur | ✅ Tamamlandı |
| 2.4 | `products.json` oluştur | ✅ Tamamlandı (127 ürün) |
| 2.5 | `settings.json` oluştur | ✅ Tamamlandı |
| 2.6 | `templates.json` oluştur | ✅ Tamamlandı (4 şablon) |

---

### FAZ 3: Shared (Dil Bağımsız) Veriler ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 3.1 | `label_sizes.json` oluştur | ✅ Tamamlandı |
| 3.2 | `menu_items.json` oluştur | ✅ Tamamlandı |
| 3.3 | `layout_config.json` oluştur | ✅ Tamamlandı |
| 3.4 | `units.json` oluştur | ✅ Tamamlandı (ek) |

---

### FAZ 4: Seed Metodları Implementasyonu ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 4.1 | `CategorySeeder.php` | ✅ Tamamlandı |
| 4.2 | `ProductionTypeSeeder.php` | ✅ Tamamlandı |
| 4.3 | `ProductSeeder.php` | ✅ Tamamlandı |
| 4.4 | `TemplateSeeder.php` | ✅ Tamamlandı |
| 4.5 | `SettingsSeeder.php` | ✅ Tamamlandı |
| 4.6 | `LabelSizeSeeder.php` | ✅ Tamamlandı |
| 4.7 | `MenuItemSeeder.php` | ✅ Tamamlandı |
| 4.8 | `LayoutConfigSeeder.php` | ✅ Tamamlandı |

---

### FAZ 5: CLI Çalıştırıcılar ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 5.1 | `seed.php` CLI scripti | ✅ Tamamlandı (v2.0) |
| 5.2 | Progress output ve hata raporlama | ✅ Tamamlandı |
| 5.3 | `--dry-run` parametresi | ✅ Tamamlandı |
| 5.4 | `--demo-only` parametresi | ✅ Tamamlandı |
| 5.5 | `--clear-demo` parametresi | ✅ Tamamlandı |
| 5.6 | `--verbose` parametresi | ✅ Tamamlandı |

**CLI Kullanım:**
```bash
# Türkçe tüm demo verilerini yükle
php database/seeders/seed.php --all --locale=tr --verbose

# İngilizce şablonları yükle
php database/seeders/seed.php --templates --locale=en --verbose

# Dry-run modu
php database/seeders/seed.php --all --locale=tr --dry-run

# Demo verilerini temizle
php database/seeders/seed.php --clear-demo --products --company=UUID
```

---

### FAZ 6: Diğer Diller ✅ İNGİLİZCE TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 6.1 | English (en) veri dosyaları | ✅ Tamamlandı |
| 6.2 | Deutsch (de) veri dosyaları | ⏳ Bekliyor |
| 6.3 | Nederlands (nl) veri dosyaları | ⏳ Bekliyor |
| 6.4 | Français (fr) veri dosyaları | ⏳ Bekliyor |
| 6.5 | Azərbaycan (az) veri dosyaları | ⏳ Bekliyor |
| 6.6 | Русский (ru) veri dosyaları | ⏳ Bekliyor |

---

### FAZ 7: Setup Wizard UI ✅ TAMAMLANDI

| Görev | Açıklama | Durum |
|-------|----------|-------|
| 7.1 | Wizard sayfa tasarımı | ✅ Tamamlandı |
| 7.2 | Dil seçimi | ✅ Tamamlandı |
| 7.3 | Seed türü seçimi (checkbox'lar) | ✅ Tamamlandı |
| 7.4 | Progress göstergesi | ✅ Tamamlandı |
| 7.5 | API: `/api/setup/status` | ✅ Tamamlandı |
| 7.6 | API: `/api/setup/seed` | ✅ Tamamlandı |
| 7.7 | Demo temizle butonu | ✅ Tamamlandı |

**Erişim:** `http://localhost/market-etiket-sistemi/#/admin/setup-wizard`

---

## 🏗️ Teknik Detaylar

### Seeder Sınıf Yapısı

Her seeder `BaseSeeder` sınıfından türetilir:

```php
class CategorySeeder extends BaseSeeder
{
    protected function getTableName(): string { return 'categories'; }
    protected function getDataFileName(): string { return 'categories.json'; }
    public function run(): bool { /* ... */ }
}
```

### BaseSeeder Metodları

| Metod | Açıklama |
|-------|----------|
| `setLocale($locale)` | Dil kodu (tr, en, ...) |
| `setCompanyId($id)` | Firma ID |
| `setCreatedBy($id)` | Oluşturan kullanıcı ID |
| `setDemoOnly($bool)` | Sadece demo veriler |
| `setDefaultOnly($bool)` | Sadece varsayılan veriler |
| `setDryRun($bool)` | Simülasyon modu |
| `setVerbose($bool)` | Detaylı çıktı |
| `loadJsonData()` | JSON dosyasını yükle |
| `loadSharedData($file)` | Shared JSON yükle |
| `upsert($data, $keyField)` | Upsert işlemi (key bazlı) |
| `clearDemoData()` | Demo verilerini sil |
| `clearAllData()` | Tüm verileri sil |
| `getStats()` | İstatistikleri al |

### JSON Veri Formatı

```json
{
  "schema_version": "1.0",
  "data_version": "2026.01.tr",
  "locale": "tr",
  "description": "Dosya açıklaması",
  "data": [
    {
      "key": "demo.product.elma",
      "name": "Elma",
      "is_demo": true,
      "is_default": false
    }
  ]
}
```

### Veritabanı Kolonları (Migration)

Migration `053_add_seeder_columns.sql` ile eklendi:

| Tablo | Eklenen Kolonlar |
|-------|------------------|
| categories | is_demo, is_default, key |
| products | is_demo, is_default, key |
| production_types | is_demo, is_default, key |
| templates | is_demo, is_default, key |

---

## 📊 Mevcut Veri Durumu

| Veri Tipi | TR | EN | Shared |
|-----------|----|----|--------|
| Kategoriler | 4 | 4 | - |
| Üretim Tipleri | 5 | 5 | - |
| Ürünler | 127 | 3 (örnek) | - |
| Şablonlar | 4 | 3 | - |
| Ayarlar | 1 config | 1 config | - |
| Etiket Boyutları | - | - | 10 |
| Birimler | - | - | 4 |
| Menü Öğeleri | - | - | 10 |
| Layout Config | - | - | 1 |

---

## 📝 Değişiklik Geçmişi

| Tarih | Versiyon | Değişiklik |
|-------|----------|------------|
| 2026-01-25 | 1.0-1.5 | Tasarım ve planlama fazları |
| 2026-01-25 | 2.0 | **UYGULAMA TAMAMLANDI:** |
| | | - Faz 1-5 tam implementasyon |
| | | - Faz 6: İngilizce tamamlandı |
| | | - Faz 7: Setup Wizard UI tamamlandı |
| | | - 8 Seeder sınıfı oluşturuldu |
| | | - CLI v2.0 yayınlandı |
| | | - API endpoints çalışır durumda |
| | | - Migration 053 eklendi |

---

## ✅ Tamamlanan Özellikler

- [x] BaseSeeder temel sınıf
- [x] 8 adet Seeder sınıfı
- [x] TR veri dosyaları (categories, products, production_types, templates, settings)
- [x] EN veri dosyaları (categories, products, production_types, templates, settings)
- [x] Shared veri dosyaları (label_sizes, units, menu_items, layout_config)
- [x] CLI seed.php v2.0
- [x] API endpoints (status, seed)
- [x] Setup Wizard UI
- [x] is_demo, is_default, key kolonları
- [x] Dry-run modu
- [x] Demo temizleme

## ⏳ Gelecekte Yapılacaklar

- [ ] Diğer diller (de, nl, fr, az, ru)
- [ ] Import Mappings seeder
- [ ] seed_runs tablosu (audit trail)
- [ ] expires_at alanı (demo son kullanma tarihi)
- [ ] Fingerprint duplicate tespiti

---

## 📚 İlgili Dokümanlar

- [TENANT_KAPSAMLI_ANALIZ.md](./TENANT_KAPSAMLI_ANALIZ.md) - Tenant izolasyon planı
- [CLAUDE.md](../CLAUDE.md) - Proje genel rehberi
