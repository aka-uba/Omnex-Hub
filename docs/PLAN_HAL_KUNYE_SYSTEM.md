# HAL Künye Sistemi - Kapsamlı Uygulama Planı

**Tarih:** 2026-01-31
**Seçenek:** C - Ayrı Tablo (En Kapsamlı)
**Versiyon:** v2.0.17
**İlişkili Döküman:** docs/BRANCH_SYSTEM_ARCHITECTURE.md

---

## 📋 Özet

HAL (Hal Kayıt Sistemi) künye verilerini ayrı bir tabloda saklayarak ürün kartlarının şişmesini önleyen, şablon editöründe kullanılabilir ve sadece Türkçe dilde görünür bir sistem.

**🏢 Şube Entegrasyonu:** HAL künye verileri şube bazlı override destekler. Master künye ürün seviyesinde saklanır, şubelere özel künye farklılıkları `product_branch_overrides` tablosunda tutulur.

---

## ✅ Tamamlanan Görevler (v2.0.17)

### Form Layout Değişiklikleri

Ürün formu kartları yeniden düzenlendi:

**Sol Sütun (lg:col-span-2):**
1. ✅ Temel Bilgiler kartı - Ürün adı, SKU, barkod, kategori, açıklama vb.
2. ✅ HAL Künye kartı - Künye no, üretim tipi, HAL sorgu sonuçları, HAL veri alanları
3. ✅ Fiyat Bilgileri kartı - Satış fiyatı, eski fiyat, KDV, indirim, kampanya, fiyat geçmişi

**Sağ Sütun - Sidebar (lg:col-span-1):**
1. ✅ Durum kartı - Aktif/Pasif, öne çıkan
2. ✅ Görseller kartı - Ürün görselleri yükleme
3. ✅ Video kartı - Video yükleme/URL ekleme
4. ✅ Stok ve Ölçü kartı - Birim, stok, ağırlık, raf konumu, tedarikçi kodu
5. ✅ Geçerlilik kartı - Geçerlilik başlangıç/bitiş tarihleri
6. ✅ Kaydet/İptal butonları

### Page Header Kaydet Butonu

- ✅ Sayfa başlığının sağ tarafına "Kaydet/Güncelle" butonu eklendi
- ✅ `form="product-form"` özelliği ile form dışında olsa bile formu submit edebiliyor
- ✅ Hem üstten (page header) hem alttan (sidebar) kayıt yapılabilir

### Değişen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `public/assets/js/pages/products/ProductForm.js` | Form layout tamamen yeniden düzenlendi, page header butonu eklendi |
| `CLAUDE.md` | v2.0.17 güncellendi, form düzeni ve page header butonu dokümante edildi |
| `PLAN_HAL_KUNYE_SYSTEM.md` | Tamamlanan görevler eklendi |

---

## 🗄️ Veritabanı Değişiklikleri

### Migration 057: product_hal_data Tablosu

```sql
-- HAL Künye Verileri Tablosu
-- Ürünlerle 1:1 ilişki (product_id UNIQUE)

CREATE TABLE IF NOT EXISTS product_hal_data (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL,
    kunye_no TEXT NOT NULL,

    -- Üretim Yeri Bilgileri
    uretici_adi TEXT,                    -- Üretici Ad Soyad
    malin_adi TEXT,                      -- Malın Adı
    malin_cinsi TEXT,                    -- Malın Cinsi (Meyve, Sebze vb.)
    malin_turu TEXT,                     -- Malın Türü (Geleneksel/Konvansiyonel, Organik vb.)
    ilk_bildirim_tarihi TEXT,            -- İlk Bildirim Tarihi
    uretim_yeri TEXT,                    -- Malın Üretim Yeri (İl/İlçe)

    -- Tüketim Yeri Bilgileri
    malin_sahibi TEXT,                   -- Malın Sahibi
    tuketim_bildirim_tarihi TEXT,        -- Tüketim Yeri Bildirim Tarihi
    tuketim_yeri TEXT,                   -- Tüketim Yeri İl/İlçe/Belde

    -- Etiket Özel Bilgileri
    gumruk_kapisi TEXT,                  -- Üretim Yeri / Gümrük Kapısı
    uretim_ithal_tarihi TEXT,            -- Üretim / İthal Tarihi
    miktar TEXT,                         -- Miktarı
    alis_fiyati REAL,                    -- Alış Fiyatı
    isletme_adi TEXT,                    -- İşletme Adı
    diger_bilgiler TEXT,                 -- Diğer Bilgileri

    -- Organik Ürün Bilgileri
    sertifikasyon_kurulusu TEXT,         -- Kontrol ve Sertifikasyon Kuruluşu
    sertifika_no TEXT,                   -- Ürünün Sertifika Numarası

    -- Geçmiş Bildirimler (JSON array)
    gecmis_bildirimler TEXT,             -- JSON: [{adi_soyadi, sifat, islem_turu, satis_fiyati}, ...]

    -- Meta
    hal_sorgu_tarihi TEXT,               -- Son HAL sorgulama tarihi
    hal_raw_data TEXT,                   -- Ham HAL API yanıtı (JSON)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_hal_data_product ON product_hal_data(product_id);
CREATE INDEX IF NOT EXISTS idx_hal_data_company ON product_hal_data(company_id);
CREATE INDEX IF NOT EXISTS idx_hal_data_kunye ON product_hal_data(kunye_no);
CREATE INDEX IF NOT EXISTS idx_hal_data_uretici ON product_hal_data(uretici_adi);
CREATE INDEX IF NOT EXISTS idx_hal_data_uretim_yeri ON product_hal_data(uretim_yeri);
```

### Migration 058: product_branch_hal_overrides Tablosu (Şube Künye Override)

```sql
-- Şube Bazlı HAL Künye Override Tablosu
-- product_hal_data ile N:1 ilişki
-- Sadece şubede farklı olan künye alanlarını saklar

CREATE TABLE IF NOT EXISTS product_branch_hal_overrides (
    id TEXT PRIMARY KEY,
    hal_data_id TEXT NOT NULL,            -- Master HAL verisine referans
    branch_id TEXT NOT NULL,

    -- ⚠️ OVERRIDE FELSEFESİ:
    -- NULL = Master'dan gelir (product_hal_data tablosundan)
    -- Değer = Bu şubede farklı

    -- Override edilebilir alanlar (en sık değişenler)
    kunye_no TEXT,                        -- Şubeye özel künye numarası
    malin_sahibi TEXT,                    -- Şubedeki mal sahibi (farklı olabilir)
    tuketim_yeri TEXT,                    -- Tüketim yeri (şube lokasyonu)
    tuketim_bildirim_tarihi TEXT,
    alis_fiyati REAL,                     -- Şubedeki alış fiyatı
    miktar TEXT,                          -- Şubedeki miktar

    -- Override kaynağı
    source TEXT DEFAULT 'manual',         -- 'manual', 'import', 'hal_query'
    source_reference TEXT,

    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    updated_by TEXT,

    -- Soft delete
    deleted_at TEXT,
    deleted_by TEXT,

    -- Kısıtlamalar
    UNIQUE(hal_data_id, branch_id),
    FOREIGN KEY (hal_data_id) REFERENCES product_hal_data(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_bho_hal_data ON product_branch_hal_overrides(hal_data_id);
CREATE INDEX IF NOT EXISTS idx_bho_branch ON product_branch_hal_overrides(branch_id);
CREATE INDEX IF NOT EXISTS idx_bho_kunye ON product_branch_hal_overrides(kunye_no);
CREATE INDEX IF NOT EXISTS idx_bho_deleted ON product_branch_hal_overrides(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bho_active ON product_branch_hal_overrides(hal_data_id, branch_id, deleted_at);
```

### Şube HAL Override Alanları Açıklaması

| Alan | Override Edilir Mi? | Açıklama |
|------|---------------------|----------|
| kunye_no | ✅ Evet | Her şubenin kendi künye numarası olabilir |
| malin_sahibi | ✅ Evet | Şube sahibi farklı olabilir |
| tuketim_yeri | ✅ Evet | Şube lokasyonuna göre değişir |
| tuketim_bildirim_tarihi | ✅ Evet | Şube bazlı bildirim tarihi |
| alis_fiyati | ✅ Evet | Şubeden şubeye değişebilir |
| miktar | ✅ Evet | Şubedeki stok miktarı |
| uretici_adi | ❌ Hayır | Master'da kalır |
| malin_adi | ❌ Hayır | Master'da kalır |
| malin_cinsi | ❌ Hayır | Master'da kalır |
| malin_turu | ❌ Hayır | Master'da kalır |
| uretim_yeri | ❌ Hayır | Master'da kalır |
| gecmis_bildirimler | ❌ Hayır | Master'da kalır |

---

## 📁 Dosya Değişiklikleri

### 1. Backend

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `database/migrations/057_create_product_hal_data.sql` | YENİ | HAL tablosu migration |
| `database/migrations/058_create_product_branch_hal_overrides.sql` | YENİ | Şube HAL override tablosu |
| `core/Database.php` | GÜNCELLE | product_hal_data, product_branch_hal_overrides whitelist'e ekle |
| `api/hal/query.php` | GÜNCELLE | Sorgu sonucunu tabloya kaydet |
| `api/hal/save.php` | YENİ | Manuel HAL verisi kaydetme |
| `api/hal/get.php` | YENİ | Ürüne ait HAL verisi getir (şube desteği) |
| `api/hal/delete.php` | YENİ | HAL verisini sil |
| `api/hal/branch-override.php` | YENİ | Şube HAL override CRUD |
| `api/products/show.php` | GÜNCELLE | HAL verisini JOIN ile getir |
| `api/index.php` | GÜNCELLE | Yeni route'ları ekle |
| `services/HalKunyeScraper.php` | GÜNCELLE | Tüm alanları parse et |
| `services/HalDataResolver.php` | YENİ | Şube → Master fallback çözümleyici |

### 2. Frontend - Ürün Sayfaları

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `public/assets/js/pages/products/ProductForm.js` | ✅ TAMAMLANDI | HAL kartı bölümünü genişlet, form layout yeniden düzenlendi |
| `public/assets/js/pages/products/ProductDetail.js` | GÜNCELLE | HAL kartı ekle |
| `public/assets/js/pages/products/form/HalKunyeSection.js` | GÜNCELLE | Tüm alanları destekle |
| `public/assets/js/pages/products/form/HalKunyeCard.js` | YENİ | Ayrı HAL kart bileşeni |

### 3. Frontend - Şablon Editörü

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `public/assets/js/pages/templates/editor/DynamicFieldsPanel.js` | GÜNCELLE | HAL alanlarını ekle |
| `public/assets/js/pages/templates/TemplateEditor.js` | GÜNCELLE | HAL alanlarını render et |

### 4. CSS

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `public/assets/css/pages/products.css` | GÜNCELLE | HAL kartı stilleri |
| `public/assets/css/pages/hal-kunye.css` | YENİ | Ayrı HAL stilleri |

### 5. i18n (Sadece Türkçe)

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `locales/tr/pages/products.json` | GÜNCELLE | HAL alan çevirileri |

---

## 🎨 UI Tasarımı

### Ürün Formu - Güncel Layout (v2.0.17)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ PAGE HEADER                                                                          │
│ ─────────────────────────────────────────────────────────────────────────────────── │
│ [Geri] Ürün Oluştur / Düzenle                              [Kaydet/Güncelle]        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐ ┌─────────────────────────────────┐
│ SOL SÜTUN (lg:col-span-2)                       │ │ SAĞ SÜTUN (lg:col-span-1)       │
├─────────────────────────────────────────────────┤ ├─────────────────────────────────┤
│                                                 │ │                                 │
│ ┌─── Temel Bilgiler ──────────────────────────┐│ │ ┌─── Durum ──────────────────┐ │
│ │ • Ürün Adı                                  ││ │ │ • Aktif/Pasif toggle       │ │
│ │ • SKU                                       ││ │ │ • Öne Çıkan toggle         │ │
│ │ • Barkod [🔍]                               ││ │ └─────────────────────────────┘ │
│ │ • Slug                                      ││ │                                 │
│ │ • Kategori / Alt Kategori                   ││ │ ┌─── Görseller ─────────────┐ │
│ │ • Açıklama                                  ││ │ │ • Görsel yükleme alanı    │ │
│ │ • Menşei                                    ││ │ │ • Medya kütüphanesi       │ │
│ └─────────────────────────────────────────────┘│ │ └─────────────────────────────┘ │
│                                                 │ │                                 │
│ ┌─── HAL Künye Bilgileri [Sadece TR] ─────────┐│ │ ┌─── Video ─────────────────┐ │
│ │ • Künye No [🔍 Sorgula] [📷 QR]             ││ │ │ • Video yükleme           │ │
│ │ • Üretim Yeri Bilgileri                     ││ │ │ • Video URL               │ │
│ │   - Üretici Ad Soyad                        ││ │ └─────────────────────────────┘ │
│ │   - Malın Adı / Cinsi / Türü                ││ │                                 │
│ │   - İlk Bildirim Tarihi                     ││ │ ┌─── Stok ve Ölçü ──────────┐ │
│ │   - Üretim Yeri                             ││ │ │ • Birim                    │ │
│ │ • Tüketim Yeri Bilgileri                    ││ │ │ • Stok                     │ │
│ │   - Malın Sahibi                            ││ │ │ • Ağırlık                  │ │
│ │   - Bildirim Tarihi                         ││ │ │ • Raf Konumu               │ │
│ │   - Tüketim Yeri                            ││ │ │ • Tedarikçi Kodu           │ │
│ │ • Etiket Bilgileri                          ││ │ └─────────────────────────────┘ │
│ │ • Organik Ürün Bilgileri                    ││ │                                 │
│ │ • Geçmiş Bildirimler [Tablo]                ││ │ ┌─── Geçerlilik ─────────────┐ │
│ └─────────────────────────────────────────────┘│ │ │ • Geçerlilik Başlangıç    │ │
│                                                 │ │ │ • Geçerlilik Bitiş        │ │
│ ┌─── Fiyat Bilgileri ─────────────────────────┐│ │ └─────────────────────────────┘ │
│ │ • Satış Fiyatı                              ││ │                                 │
│ │ • Eski Fiyat                                ││ │ ┌─────────────────────────────┐ │
│ │ • KDV Oranı                                 ││ │ │ [İptal]  [Kaydet/Güncelle] │ │
│ │ • Fiyat Değişiklik Tarihi                   ││ │ └─────────────────────────────┘ │
│ │ • Eski Fiyat Değişiklik Tarihi              ││ │                                 │
│ │ • İndirim Oranı (%)                         ││ └─────────────────────────────────┘
│ │ • Kampanya Metni                            ││
│ │ • Fiyat Geçmişi [Badge + Tablo]             ││
│ └─────────────────────────────────────────────┘│
│                                                 │
└─────────────────────────────────────────────────┘
```

### Ürün Formu - HAL Künye Kartı Detay

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🌾 HAL Künye Bilgileri                     [Sadece TR'de görünür]      │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ Künye No: [___________________] [🔍 Sorgula] [📷 QR]                    │
│                                                                         │
│ ┌─── Üretim Yeri Bilgileri ─────────────────────────────────────────┐  │
│ │                                                                    │  │
│ │  Üretici Ad Soyad    [_______________________________]            │  │
│ │  Malın Adı           [_______________________________]            │  │
│ │  Malın Cinsi         [_______________________________]            │  │
│ │  Malın Türü          [▼ Geleneksel/Konvansiyonel    ]            │  │
│ │  İlk Bildirim Tarihi [_______________] 📅                         │  │
│ │  Üretim Yeri         [_______________________________]            │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─── Tüketim Yeri Bilgileri ────────────────────────────────────────┐  │
│ │                                                                    │  │
│ │  Malın Sahibi        [_______________________________]            │  │
│ │  Bildirim Tarihi     [_______________] 📅                         │  │
│ │  Tüketim Yeri        [_______________________________]            │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─── Etiket Bilgileri ──────────────────────────────────────────────┐  │
│ │                                                                    │  │
│ │  Gümrük Kapısı       [_______________________________]            │  │
│ │  Üretim/İthal Tarihi [_______________] 📅                         │  │
│ │  Miktar              [___________]                                │  │
│ │  Alış Fiyatı         [___________] ₺                              │  │
│ │  İşletme Adı         [_______________________________]            │  │
│ │  Diğer Bilgiler      [_______________________________]            │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─── Organik Ürün Bilgileri (Opsiyonel) ────────────────────────────┐  │
│ │                                                                    │  │
│ │  ☐ Organik Ürün                                                   │  │
│ │  Sertifikasyon Kuruluşu  [_______________________________]        │  │
│ │  Sertifika No            [_______________________________]        │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ ┌─── Geçmiş Bildirimler ────────────────────────────────────────────┐  │
│ │                                                                    │  │
│ │  ┌────────────────┬─────────────┬────────────┬─────────────┐      │  │
│ │  │ Adı Soyadı     │ Sıfat       │ İşlem Türü │ Satış Fiyatı│      │  │
│ │  ├────────────────┼─────────────┼────────────┼─────────────┤      │  │
│ │  │ ÇEKOK GIDA     │ Tüccar      │ Satın Alım │ 25          │      │  │
│ │  │ ÇEKOK GIDA     │ Tüccar      │ Sevk Etme  │ 0           │      │  │
│ │  │ İSO TARIM      │ Komisyoncu  │ Satış      │ 100         │      │  │
│ │  └────────────────┴─────────────┴────────────┴─────────────┘      │  │
│ │                                                                    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                                        [💾 HAL Verisini Kaydet]         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Ürün Detay Sayfası - HAL Kartı (Read-only)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🌾 HAL Künye Bilgileri                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────┐   ┌────────────────────────────────┐ │
│  │         QR KOD               │   │  Künye No: 2073079250202837944 │ │
│  │                              │   │  Mal Adı: AYVA                 │ │
│  │      [███████████]           │   │  Mal Cinsi: AYVA               │ │
│  │      [███████████]           │   │  Mal Türü: Geleneksel          │ │
│  │      [███████████]           │   │  Üretim Yeri: SAKARYA/KARASU   │ │
│  │                              │   │  Üretici: ÇEKOK GIDA SAN.      │ │
│  └──────────────────────────────┘   └────────────────────────────────┘ │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Tüketim Yeri: İSTANBUL/PENDİK/ESENYALI                                │
│  Bildirim Tarihi: 07.01.2026 04:19:57                                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📋 Geçmiş Bildirimler (4)                                    [Genişlet]│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🏷️ Şablon Editörü - HAL Dinamik Alanları

### Yeni Alan Grubu: "hal" (HAL Künye)

```javascript
// DynamicFieldsPanel.js - Yeni alanlar
const HAL_FIELDS = {
    'hal_kunye_no': {
        key: '{{hal_kunye_no}}',
        label: 'Künye No',
        icon: 'ti-id',
        preview: '2073079250202837944',
        group: 'hal',
        defaultStyle: { fontSize: 10, fontWeight: 'bold' }
    },
    'hal_uretici': {
        key: '{{hal_uretici}}',
        label: 'Üretici',
        icon: 'ti-user',
        preview: 'ÇEKOK GIDA SAN.TİC.A.Ş',
        group: 'hal'
    },
    'hal_malin_adi': {
        key: '{{hal_malin_adi}}',
        label: 'Malın Adı',
        icon: 'ti-apple',
        preview: 'AYVA',
        group: 'hal'
    },
    'hal_malin_cinsi': {
        key: '{{hal_malin_cinsi}}',
        label: 'Malın Cinsi',
        icon: 'ti-category',
        preview: 'AYVA',
        group: 'hal'
    },
    'hal_malin_turu': {
        key: '{{hal_malin_turu}}',
        label: 'Malın Türü',
        icon: 'ti-leaf',
        preview: 'Geleneksel(Konvansiyonel)',
        group: 'hal'
    },
    'hal_uretim_yeri': {
        key: '{{hal_uretim_yeri}}',
        label: 'Üretim Yeri',
        icon: 'ti-map-pin',
        preview: 'SAKARYA/KARASU',
        group: 'hal'
    },
    'hal_ilk_bildirim': {
        key: '{{hal_ilk_bildirim}}',
        label: 'İlk Bildirim Tarihi',
        icon: 'ti-calendar',
        preview: '30.11.2025',
        group: 'hal'
    },
    'hal_tuketim_yeri': {
        key: '{{hal_tuketim_yeri}}',
        label: 'Tüketim Yeri',
        icon: 'ti-building-store',
        preview: 'İSTANBUL/PENDİK',
        group: 'hal'
    },
    'hal_alis_fiyati': {
        key: '{{hal_alis_fiyati}}',
        label: 'Alış Fiyatı',
        icon: 'ti-currency-lira',
        preview: '25.00 ₺',
        group: 'hal'
    },
    'hal_miktar': {
        key: '{{hal_miktar}}',
        label: 'Miktar',
        icon: 'ti-scale',
        preview: '100 kg',
        group: 'hal'
    },
    'hal_isletme_adi': {
        key: '{{hal_isletme_adi}}',
        label: 'İşletme Adı',
        icon: 'ti-building',
        preview: 'ABDURRAHMAN YILDIRIM',
        group: 'hal'
    },
    'hal_sertifika_kurulusu': {
        key: '{{hal_sertifika_kurulusu}}',
        label: 'Sertifikasyon Kuruluşu',
        icon: 'ti-certificate',
        preview: 'ECOCERT',
        group: 'hal'
    },
    'hal_sertifika_no': {
        key: '{{hal_sertifika_no}}',
        label: 'Sertifika No',
        icon: 'ti-file-certificate',
        preview: 'TR-BIO-123',
        group: 'hal'
    },
    'hal_kunye_qr': {
        key: '{{hal_kunye_qr}}',
        label: 'Künye QR Kod',
        icon: 'ti-qrcode',
        preview: '[QR]',
        group: 'hal',
        isQRCode: true,
        defaultStyle: { width: 80, height: 80 }
    }
};
```

### Grup Tanımı

```javascript
// fieldGroups içine ekle
{
    id: 'hal',
    label: this.__('editor.dynamicFields.groups.hal') || 'HAL Künye',
    icon: 'ti-leaf',
    expanded: false,
    // Sadece TR dilinde göster
    visible: () => this.app?.i18n?.locale === 'tr'
}
```

---

## 🌐 Dil Kontrolü

### Türkçe Dışı Dillerde Gizleme

```javascript
// ProductForm.js
render() {
    const showHalSection = this.app.i18n.locale === 'tr';

    return `
        ...
        ${showHalSection ? this.renderHalKunyeSection() : ''}
        ...
    `;
}

// DynamicFieldsPanel.js
getFieldGroups() {
    const groups = [...];

    // HAL grubunu sadece TR'de göster
    if (this.app?.i18n?.locale !== 'tr') {
        return groups.filter(g => g.id !== 'hal');
    }

    return groups;
}
```

---

## 📊 API Endpoint'leri

### GET /api/hal/data/:product_id
Ürüne ait HAL verisini getirir.

```json
// Response
{
    "success": true,
    "data": {
        "id": "uuid",
        "product_id": "product_uuid",
        "kunye_no": "2073079250202837944",
        "uretici_adi": "ÇEKOK GIDA SAN.TİC.A.Ş",
        "malin_adi": "AYVA",
        "malin_cinsi": "AYVA",
        "malin_turu": "Geleneksel(Konvansiyonel)",
        "uretim_yeri": "SAKARYA/KARASU/MERKEZ KÖYLER",
        "ilk_bildirim_tarihi": "30.11.2025 06:27:09",
        "malin_sahibi": "ABDURRAHMAN YILDIRIM",
        "tuketim_yeri": "İSTANBUL/PENDİK/ESENYALI",
        "tuketim_bildirim_tarihi": "07.01.2026 04:19:57",
        "gecmis_bildirimler": [
            {
                "adi_soyadi": "ÇEKOK GIDA SAN.TİC.A.Ş",
                "sifat": "Tüccar (Hal İçi)",
                "islem_turu": "Satın Alım",
                "satis_fiyati": 25
            }
        ],
        "hal_sorgu_tarihi": "2026-01-31 10:30:00"
    }
}
```

### POST /api/hal/save
HAL verisini kaydet/güncelle.

```json
// Request
{
    "product_id": "product_uuid",
    "kunye_no": "2073079250202837944",
    "uretici_adi": "...",
    "malin_adi": "...",
    // ... diğer alanlar
}

// Response
{
    "success": true,
    "data": { "id": "hal_data_uuid" },
    "message": "HAL verisi kaydedildi"
}
```

### DELETE /api/hal/data/:product_id
HAL verisini sil.

---

## 🏢 Şube HAL Override API'leri

### GET /api/hal/data/:product_id?branch_id={branch_id}
Ürüne ait HAL verisini şube override'ları ile birlikte getirir.

```json
// Response (branch_id belirtilmişse)
{
    "success": true,
    "data": {
        "id": "hal_data_uuid",
        "product_id": "product_uuid",
        "kunye_no": "2073079250202837944",           // Master
        "uretici_adi": "ÇEKOK GIDA SAN.TİC.A.Ş",    // Master
        "malin_adi": "AYVA",                         // Master
        "effective_kunye_no": "2073079250202837999", // Branch override (farklıysa)
        "effective_tuketim_yeri": "İSTANBUL/KADIKÖY", // Branch override
        "effective_alis_fiyati": 28.50,              // Branch override
        "has_branch_override": true,
        "override_source": "branch"                   // 'branch', 'region', 'master'
    }
}
```

### GET /api/hal/branch-overrides/:product_id
Ürünün tüm şube HAL override'larını listele.

```json
// Response
{
    "success": true,
    "data": [
        {
            "branch_id": "branch_uuid_1",
            "branch_name": "İstanbul Kadıköy",
            "kunye_no": "2073079250202837999",
            "tuketim_yeri": "İSTANBUL/KADIKÖY",
            "alis_fiyati": 28.50,
            "source": "manual"
        },
        {
            "branch_id": "branch_uuid_2",
            "branch_name": "İzmir Alsancak",
            "kunye_no": null,                      // Master'dan gelir
            "tuketim_yeri": "İZMİR/KONAK",
            "alis_fiyati": 26.00,
            "source": "import"
        }
    ]
}
```

### PUT /api/hal/branch-override/:product_id/:branch_id
Şube HAL override'ı oluştur/güncelle.

```json
// Request
{
    "kunye_no": "2073079250202837999",
    "tuketim_yeri": "İSTANBUL/KADIKÖY",
    "alis_fiyati": 28.50
}

// Response
{
    "success": true,
    "data": { "id": "override_uuid" },
    "message": "Şube HAL override'ı kaydedildi"
}
```

### DELETE /api/hal/branch-override/:product_id/:branch_id
Şube HAL override'ı sil (soft delete).

---

## 🔄 HalDataResolver Servisi

**Dosya:** `services/HalDataResolver.php`

HAL verilerini şube bazlı çözümleyen servis. ProductPriceResolver ile aynı mantık.

```php
class HalDataResolver {

    /**
     * Ürünün efektif HAL değerlerini getir (branch → region → master fallback)
     *
     * @param string $productId
     * @param string|null $branchId - null = master değerler
     * @return array
     */
    public static function resolve(string $productId, ?string $branchId = null): array
    {
        // Master HAL verisini al
        $masterHal = self::getMasterHalData($productId);
        if (!$masterHal) {
            return ['success' => false, 'error' => 'HAL verisi bulunamadı'];
        }

        // Şube belirtilmemişse master dön
        if (!$branchId) {
            return [
                'success' => true,
                'data' => $masterHal,
                'source' => 'master'
            ];
        }

        // Şube override'ı kontrol et
        $branchOverride = self::getBranchOverride($masterHal['id'], $branchId);

        // Bölge override'ı kontrol et (fallback)
        $regionId = self::getRegionId($branchId);
        $regionOverride = $regionId ? self::getBranchOverride($masterHal['id'], $regionId) : null;

        // Effective değerleri hesapla
        $effectiveData = self::mergeWithFallback($masterHal, $branchOverride, $regionOverride);

        return [
            'success' => true,
            'data' => $effectiveData,
            'has_branch_override' => $branchOverride !== null,
            'has_region_override' => $regionOverride !== null,
            'source' => $branchOverride ? 'branch' : ($regionOverride ? 'region' : 'master')
        ];
    }

    /**
     * Override edilebilir alanlar için fallback uygula
     */
    private static function mergeWithFallback(
        array $master,
        ?array $branchOverride,
        ?array $regionOverride
    ): array {
        $overrideFields = ['kunye_no', 'malin_sahibi', 'tuketim_yeri',
                          'tuketim_bildirim_tarihi', 'alis_fiyati', 'miktar'];

        $result = $master;

        foreach ($overrideFields as $field) {
            // 1. Şube override
            if ($branchOverride && $branchOverride[$field] !== null) {
                $result['effective_' . $field] = $branchOverride[$field];
                $result[$field . '_source'] = 'branch';
                continue;
            }
            // 2. Bölge override
            if ($regionOverride && $regionOverride[$field] !== null) {
                $result['effective_' . $field] = $regionOverride[$field];
                $result[$field . '_source'] = 'region';
                continue;
            }
            // 3. Master
            $result['effective_' . $field] = $master[$field] ?? null;
            $result[$field . '_source'] = 'master';
        }

        return $result;
    }
}
```

---

## 📝 i18n Çevirileri (Sadece TR)

### locales/tr/pages/products.json

```json
{
    "hal": {
        "title": "HAL Künye Bilgileri",
        "subtitle": "Hal Kayıt Sistemi künye verileri",
        "query": "HAL'den Sorgula",
        "save": "HAL Verisini Kaydet",
        "clear": "HAL Verisini Temizle",

        "sections": {
            "production": "Üretim Yeri Bilgileri",
            "consumption": "Tüketim Yeri Bilgileri",
            "label": "Etiket Bilgileri",
            "organic": "Organik Ürün Bilgileri",
            "history": "Geçmiş Bildirimler"
        },

        "fields": {
            "kunyeNo": "Künye No",
            "ureticiAdi": "Üretici Ad Soyad",
            "malinAdi": "Malın Adı",
            "malinCinsi": "Malın Cinsi",
            "malinTuru": "Malın Türü",
            "ilkBildirimTarihi": "İlk Bildirim Tarihi",
            "uretimYeri": "Malın Üretim Yeri",
            "malinSahibi": "Malın Sahibi",
            "tuketimBildirimTarihi": "Bildirim Tarihi",
            "tuketimYeri": "Tüketim Yeri İl/İlçe",
            "gumrukKapisi": "Üretim Yeri / Gümrük Kapısı",
            "uretimIthalTarihi": "Üretim / İthal Tarihi",
            "miktar": "Miktarı",
            "alisFiyati": "Alış Fiyatı",
            "isletmeAdi": "İşletme Adı",
            "digerBilgiler": "Diğer Bilgileri",
            "sertifikasyonKurulusu": "Kontrol ve Sertifikasyon Kuruluşu",
            "sertifikaNo": "Ürünün Sertifika Numarası",
            "isOrganik": "Organik Ürün"
        },

        "history": {
            "adiSoyadi": "Adı Soyadı",
            "sifat": "Sıfat",
            "islemTuru": "İşlem Türü",
            "satisFiyati": "Satış Fiyatı",
            "empty": "Geçmiş bildirim bulunamadı"
        },

        "malinTuruOptions": {
            "geleneksel": "Geleneksel(Konvansiyonel)",
            "organik": "Organik Tarım",
            "iyiTarim": "İyi Tarım",
            "cografi": "Coğrafi İşaretli"
        },

        "messages": {
            "querySuccess": "HAL künye bilgileri başarıyla alındı",
            "saveSuccess": "HAL verisi kaydedildi",
            "deleteSuccess": "HAL verisi silindi",
            "noData": "Bu ürün için HAL verisi bulunamadı",
            "confirmDelete": "HAL verisini silmek istediğinize emin misiniz?"
        }
    }
}
```

---

## 🔄 Uygulama Adımları

### Faz 1: Veritabanı (Migration)
1. [ ] Migration 057 dosyası oluştur (product_hal_data)
2. [ ] Migration 058 dosyası oluştur (product_branch_hal_overrides)
3. [ ] Database.php whitelist'e ekle (her iki tablo)
4. [ ] Migration çalıştır

### Faz 2: Backend API - Master HAL
5. [ ] api/hal/data.php (GET - tek ürün HAL verisi, branch_id query param destekli)
6. [ ] api/hal/save.php (POST - kaydet/güncelle)
7. [ ] api/hal/delete.php (DELETE - sil)
8. [ ] api/index.php route'ları ekle
9. [ ] HalKunyeScraper.php tüm alanları parse et
10. [ ] api/hal/query.php otomatik kaydetme

### Faz 2.5: Backend API - Şube Override
11. [ ] services/HalDataResolver.php oluştur
12. [ ] api/hal/branch-overrides.php (GET - tüm şube override'ları)
13. [ ] api/hal/branch-override.php (PUT/DELETE - şube override CRUD)
14. [ ] api/index.php şube route'ları ekle

### Faz 3: Frontend - Ürün Formu
15. [x] ✅ HalKunyeCard.js yeni bileşen
16. [x] ✅ ProductForm.js HAL kartı entegrasyonu (layout yeniden düzenlendi)
17. [x] ✅ HalKunyeSection.js genişletme
18. [x] ✅ Dil kontrolü (sadece TR)
19. [x] ✅ Page header kaydet butonu

### Faz 4: Frontend - Ürün Detay
20. [ ] ProductDetail.js HAL kartı

### Faz 5: Şablon Editörü
21. [ ] DynamicFieldsPanel.js HAL alanları
22. [ ] TemplateEditor.js HAL render

### Faz 6: Frontend - Şube HAL Override UI
23. [ ] HalKunyeCard.js şube override sekmesi/modu
24. [ ] Şube seçiliyse override değerlerini göster (efektif değerler)
25. [ ] Şube override düzenleme modalı
26. [ ] "Tüm şubeler" görünümünde override tablosu

### Faz 7: CSS & i18n
27. [ ] hal-kunye.css stilleri
28. [ ] products.css güncellemeleri
29. [ ] products.json TR çevirileri (şube override çevirileri dahil)

### Faz 8: Test & Dokümantasyon
30. [ ] API testleri (master + şube)
31. [ ] UI testleri
32. [x] ✅ CLAUDE.md güncelleme

---

## ⚠️ Önemli Notlar

1. **Dil Kontrolü**: HAL sistemi SADECE Türkçe'de görünür. Diğer dillerde tamamen gizlenir.

2. **1:1 İlişki**: Her ürünün en fazla 1 master HAL kaydı olabilir (product_id UNIQUE).

3. **Cascade Delete**: Ürün silindiğinde HAL verisi ve şube override'ları da silinir.

4. **HAL Sorgusu**: Künye sorgulandığında otomatik olarak tabloya kaydedilir.

5. **Şablon Render**: HAL alanları `{{hal_*}}` prefix'i ile kullanılır. Şube seçiliyse efektif değerler kullanılır.

6. **Geçmiş Bildirimler**: JSON array olarak saklanır, UI'da tablo olarak gösterilir.

7. **🏢 Şube Override Felsefesi**:
   - Master HAL verisi `product_hal_data` tablosunda
   - Şube farklılıkları `product_branch_hal_overrides` tablosunda
   - NULL = Master'dan gelir, Değer = Şubede farklı
   - Fallback zinciri: Şube → Bölge → Master

8. **Override Edilebilir Alanlar**:
   - ✅ kunye_no, malin_sahibi, tuketim_yeri, tuketim_bildirim_tarihi, alis_fiyati, miktar
   - ❌ uretici_adi, malin_adi, malin_cinsi, malin_turu, uretim_yeri (master'da kalır)

9. **Soft Delete**: Şube override'ları soft delete destekler (audit trail için).

10. **Page Header Kaydet Butonu (v2.0.17)**: Form dışından kayıt yapılabilmesi için `form="product-form"` attribute'u kullanılır.

---

## 📐 Dosya Yapısı (Sonuç)

```
market-etiket-sistemi/
├── database/migrations/
│   ├── 057_create_product_hal_data.sql           # YENİ
│   └── 058_create_product_branch_hal_overrides.sql # YENİ (Şube desteği)
├── services/
│   └── HalDataResolver.php                       # YENİ (Şube fallback)
├── api/hal/
│   ├── query.php                                 # GÜNCELLE
│   ├── data.php                                  # YENİ (GET - branch_id destekli)
│   ├── save.php                                  # YENİ (POST)
│   ├── delete.php                                # YENİ (DELETE)
│   ├── branch-overrides.php                      # YENİ (GET - tüm şube override'ları)
│   └── branch-override.php                       # YENİ (PUT/DELETE - tek şube)
├── public/assets/
│   ├── js/pages/products/
│   │   ├── ProductForm.js                        # ✅ TAMAMLANDI (layout + page header)
│   │   ├── ProductDetail.js                      # GÜNCELLE
│   │   └── form/
│   │       ├── HalKunyeSection.js                # GÜNCELLE
│   │       └── HalKunyeCard.js                   # YENİ (şube override UI)
│   ├── js/pages/templates/editor/
│   │   └── DynamicFieldsPanel.js                 # GÜNCELLE
│   └── css/pages/
│       ├── products.css                          # GÜNCELLE
│       └── hal-kunye.css                         # YENİ
└── locales/tr/pages/
    └── products.json                             # GÜNCELLE (şube çevirileri dahil)
```

---

**Plan Hazır!** Onayınızla uygulamaya başlayabiliriz.
