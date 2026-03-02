# VvvebJs Entegrasyon Planı - Omnex Display Hub

**Tarih:** 2026-02-03
**Versiyon:** 1.0
**Durum:** Planlama Aşaması

---

## 1. Yönetici Özeti

### 1.1 Amaç

Omnex Display Hub'a **VvvebJs** tabanlı bir HTML şablon editörü entegre ederek:
- Dijital tabela (signage) içerikleri
- TV/büyük ekran tasarımları
- PWA Player sayfaları
- Responsive web şablonları

oluşturma imkanı sağlamak.

### 1.2 Neden VvvebJs?

| Kriter | VvvebJs | Alternatifler |
|--------|---------|---------------|
| Lisans | Apache 2.0 ✅ | Çoğu ticari |
| Bağımlılık | Sıfır (Vanilla JS) ✅ | React/Vue/Angular |
| Öğrenme Eğrisi | Düşük ✅ | Orta-Yüksek |
| Genişletilebilirlik | Component sistemi ✅ | Değişken |
| Bootstrap Desteği | Native ✅ | Plugin gerekli |
| Responsive | Hazır ✅ | Ek çalışma |

### 1.3 Hibrit Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                    OMNEX DISPLAY HUB                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐      ┌─────────────────────┐       │
│  │   ŞABLON EDİTÖRÜ    │      │  WEB ŞABLON EDİTÖRÜ │       │
│  │    (Fabric.js)      │      │     (VvvebJs)       │       │
│  ├─────────────────────┤      ├─────────────────────┤       │
│  │ • ESL etiketler     │      │ • HTML Signage      │       │
│  │ • Küçük ekranlar    │      │ • TV ekranları      │       │
│  │ • Statik görsel     │      │ • PWA Player        │       │
│  │ • Barkod/QR         │      │ • Responsive web    │       │
│  │ • E-ink cihazlar    │      │ • Animasyonlu       │       │
│  └─────────────────────┘      └─────────────────────┘       │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌─────────────────────┐      ┌─────────────────────┐       │
│  │   PNG/JPG Çıktı     │      │    HTML Çıktı       │       │
│  │   (Render Server)   │      │  (Live / Static)    │       │
│  └─────────────────────┘      └─────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Teknik Analiz

### 2.1 VvvebJs Yapısı

```
VvvebJs/
├── editor.html                    # Ana editör arayüzü
├── save.php                       # PHP backend
├── libs/
│   ├── builder/
│   │   ├── builder.js             # Çekirdek motor (~3000 satır)
│   │   ├── undo.js                # Geri al/ileri al
│   │   ├── inputs.js              # Form input bileşenleri
│   │   ├── components-*.js        # Bileşen kütüphaneleri
│   │   └── plugin-*.js            # Eklentiler
│   ├── codemirror/                # Kod editörü
│   ├── jszip/                     # ZIP export
│   └── media/                     # Medya yöneticisi
├── css/
│   └── editor.css                 # Ana stil dosyası
└── resources/
    ├── google-fonts.json          # Font listesi
    └── svg/icons/                 # 50+ ikon paketi
```

### 2.2 Omnex Entegrasyon Noktaları

| VvvebJs Bileşeni | Omnex Karşılığı | Entegrasyon |
|------------------|-----------------|-------------|
| save.php | /api/web-templates/* | API adapter |
| Media manager | /api/media/* | Mevcut API kullan |
| Components | Özel Omnex widget'ları | Yeni geliştirme |
| editor.html | /web-templates/editor | Route ekleme |
| CSS theme | Omnex design system | Özelleştirme |

### 2.3 Veritabanı Şeması

```sql
-- Migration: 060_create_web_templates.sql

-- Ana web şablon tablosu
CREATE TABLE web_templates (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,

    -- İçerik
    html_content TEXT,              -- Tam HTML içerik
    css_content TEXT,               -- Özel CSS
    js_content TEXT,                -- Özel JavaScript
    vvveb_data TEXT,                -- VvvebJs JSON state

    -- Layout bilgisi
    layout_type TEXT DEFAULT 'full-width',  -- full-width, boxed, sidebar-left, sidebar-right
    width INTEGER,                  -- Piksel genişlik (boxed için)
    height INTEGER,                 -- Piksel yükseklik (opsiyonel)

    -- Hedef cihazlar
    target_devices TEXT,            -- JSON: ["tv", "tablet", "signage"]
    responsive_breakpoints TEXT,    -- JSON: {"mobile": 480, "tablet": 768, "desktop": 1200}

    -- Meta
    thumbnail TEXT,                 -- Önizleme görseli yolu
    category TEXT,                  -- Kategori (signage, menu, promo, info)
    tags TEXT,                      -- JSON: ["kampanya", "fiyat", "duyuru"]

    -- Durum
    status TEXT DEFAULT 'draft',    -- draft, published, archived
    is_template BOOLEAN DEFAULT 0,  -- Başlangıç şablonu mu?
    is_system BOOLEAN DEFAULT 0,    -- Sistem şablonu mu?

    -- Versiyon
    version INTEGER DEFAULT 1,
    parent_id TEXT,                 -- Fork edilmişse orijinal

    -- Zaman damgaları
    created_by TEXT,
    updated_by TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Web şablon versiyonları (otomatik yedekleme)
CREATE TABLE web_template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    html_content TEXT,
    css_content TEXT,
    js_content TEXT,
    vvveb_data TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (template_id) REFERENCES web_templates(id) ON DELETE CASCADE
);

-- Web şablon - Cihaz atamaları
CREATE TABLE web_template_assignments (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    company_id TEXT NOT NULL,

    -- Zamanlama
    start_date TEXT,
    end_date TEXT,
    schedule_config TEXT,           -- JSON: cron-like schedule

    -- Öncelik
    priority INTEGER DEFAULT 0,

    -- Durum
    status TEXT DEFAULT 'active',   -- active, paused, expired

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (template_id) REFERENCES web_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(template_id, device_id)
);

-- Web şablon widget'ları (özel bileşenler)
CREATE TABLE web_template_widgets (
    id TEXT PRIMARY KEY,
    company_id TEXT,                -- NULL = sistem widget'ı
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,

    -- İçerik
    html_template TEXT,             -- Widget HTML şablonu
    css_content TEXT,               -- Widget CSS
    js_content TEXT,                -- Widget JavaScript
    default_config TEXT,            -- JSON: varsayılan ayarlar

    -- VvvebJs entegrasyonu
    vvveb_component TEXT,           -- VvvebJs component tanımı (JSON)
    icon TEXT,                      -- İkon sınıfı
    category TEXT,                  -- Widget kategorisi

    -- Durum
    status TEXT DEFAULT 'active',
    is_system BOOLEAN DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- İndeksler
CREATE INDEX idx_web_templates_company ON web_templates(company_id);
CREATE INDEX idx_web_templates_status ON web_templates(status);
CREATE INDEX idx_web_templates_category ON web_templates(category);
CREATE INDEX idx_web_template_assignments_device ON web_template_assignments(device_id);
CREATE INDEX idx_web_template_assignments_template ON web_template_assignments(template_id);
CREATE INDEX idx_web_template_widgets_slug ON web_template_widgets(slug);

-- Varsayılan sistem widget'ları
INSERT INTO web_template_widgets (id, name, slug, description, category, icon, is_system, vvveb_component) VALUES
('widget-product-card', 'Ürün Kartı', 'product-card', 'Dinamik ürün bilgisi gösteren kart', 'data', 'ti-package', 1, '{}'),
('widget-price-list', 'Fiyat Listesi', 'price-list', 'Ürün fiyat listesi tablosu', 'data', 'ti-list', 1, '{}'),
('widget-ticker', 'Kayan Yazı', 'ticker', 'Yatay kayan metin', 'media', 'ti-marquee-2', 1, '{}'),
('widget-clock', 'Saat', 'clock', 'Dijital/analog saat', 'utility', 'ti-clock', 1, '{}'),
('widget-weather', 'Hava Durumu', 'weather', 'Hava durumu widget''ı', 'utility', 'ti-cloud', 1, '{}'),
('widget-qr-code', 'QR Kod', 'qr-code', 'Dinamik QR kod', 'utility', 'ti-qrcode', 1, '{}'),
('widget-countdown', 'Geri Sayım', 'countdown', 'Kampanya geri sayım', 'utility', 'ti-hourglass', 1, '{}'),
('widget-social-feed', 'Sosyal Medya', 'social-feed', 'Sosyal medya akışı', 'media', 'ti-brand-instagram', 1, '{}');
```

---

## 3. Dosya Yapısı

### 3.1 Yeni Dizin Yapısı

```
market-etiket-sistemi/
├── public/
│   └── html-editor/                      # VvvebJs ana dizini
│       ├── index.html                    # Özelleştirilmiş editör
│       ├── libs/
│       │   ├── builder/
│       │   │   ├── builder.js
│       │   │   ├── components-omnex.js   # ⭐ Özel Omnex widget'ları
│       │   │   └── ...
│       │   └── ...
│       ├── css/
│       │   ├── editor.css
│       │   └── omnex-theme.css           # ⭐ Omnex tema override
│       └── locales/
│           └── tr.json                   # ⭐ Türkçe çeviriler
│
├── api/
│   └── web-templates/                    # ⭐ Yeni API endpoint'leri
│       ├── index.php                     # Liste
│       ├── show.php                      # Tek şablon
│       ├── create.php                    # Oluştur
│       ├── update.php                    # Güncelle
│       ├── delete.php                    # Sil
│       ├── publish.php                   # Yayınla
│       ├── duplicate.php                 # Kopyala
│       ├── versions.php                  # Versiyon geçmişi
│       ├── assignments.php               # Cihaz atamaları
│       └── widgets.php                   # Widget yönetimi
│
├── public/assets/js/pages/
│   └── web-templates/                    # ⭐ Frontend sayfaları
│       ├── WebTemplateList.js            # Liste sayfası
│       ├── WebTemplateEditor.js          # Editör wrapper
│       └── WebTemplateAssign.js          # Cihaz atama
│
├── locales/
│   ├── tr/pages/
│   │   └── web-templates.json            # ⭐ Türkçe çeviriler
│   └── en/pages/
│       └── web-templates.json            # ⭐ İngilizce çeviriler
│
└── database/migrations/
    └── 060_create_web_templates.sql      # ⭐ Veritabanı şeması
```

### 3.2 VvvebJs'den Alınacak Dosyalar

```
VvvebJs/ → public/html-editor/

ALINACAKLAR:
├── libs/
│   ├── builder/
│   │   ├── builder.js              ✅ Çekirdek (gerekli)
│   │   ├── undo.js                 ✅ Geri al (gerekli)
│   │   ├── inputs.js               ✅ Form inputs (gerekli)
│   │   ├── section.js              ✅ Section yönetimi (gerekli)
│   │   ├── components-bootstrap5.js ✅ Bootstrap 5 (gerekli)
│   │   ├── components-html.js      ✅ HTML elementleri (gerekli)
│   │   ├── components-elements.js  ✅ Temel elementler (gerekli)
│   │   ├── plugin-codemirror.js    ✅ Kod editörü (gerekli)
│   │   ├── plugin-media.js         ✅ Medya yönetimi (gerekli)
│   │   └── plugin-jszip.js         ✅ ZIP export (opsiyonel)
│   ├── codemirror/                 ✅ Syntax highlighting
│   ├── jszip/                      ✅ ZIP desteği
│   └── media/                      ✅ Medya kütüphanesi
├── css/
│   └── editor.css                  ✅ Ana stiller
├── js/
│   ├── bootstrap.min.js            ✅ Bootstrap JS
│   └── popper.min.js               ✅ Popper (dropdown için)
└── resources/
    ├── google-fonts.json           ✅ Font listesi
    └── svg/icons/
        ├── tabler-icons/           ✅ Mevcut ikon seti
        ├── font-awesome/           ✅ Popüler ikonlar
        └── material-design/        ✅ Material ikonlar

ALINMAYACAKLAR:
├── demo/                           ❌ Demo sayfaları (gereksiz)
├── libs/builder/
│   ├── components-bootstrap4.js    ❌ Bootstrap 4 (eski)
│   ├── blocks-bootstrap4.js        ❌ Bootstrap 4 blokları
│   ├── plugin-tinymce.js           ❌ TinyMCE (CodeMirror yeterli)
│   ├── plugin-ckeditor.js          ❌ CKEditor (CodeMirror yeterli)
│   ├── plugin-ai-assistant.js      ❌ AI (şimdilik gereksiz)
│   └── plugin-aos.js               ❌ AOS (sonra eklenebilir)
└── resources/svg/icons/
    └── (40+ diğer ikon paketi)     ❌ Çok fazla (3 paket yeterli)
```

**Tahmini Boyut:** ~15-20 MB (110 MB'dan düşürülmüş)

---

## 4. Özel Omnex Widget'ları

### 4.1 Widget Listesi

| Widget | Açıklama | Veri Kaynağı | Öncelik |
|--------|----------|--------------|---------|
| **Ürün Kartı** | Tek ürün bilgisi | Ürün API | Yüksek |
| **Ürün Grid** | Çoklu ürün listesi | Ürün API | Yüksek |
| **Fiyat Listesi** | Tablo formatında fiyatlar | Ürün API | Yüksek |
| **Kayan Yazı** | Horizontal ticker | Manuel/API | Yüksek |
| **Kampanya Banner** | Promosyon görseli | Medya | Orta |
| **Saat/Tarih** | Dijital saat | Sistem | Orta |
| **Hava Durumu** | Anlık hava | Harici API | Düşük |
| **QR Kod** | Dinamik QR | Ürün/URL | Orta |
| **Geri Sayım** | Kampanya sayacı | Manuel | Orta |
| **Video Player** | Video/Playlist | Medya | Orta |
| **Sosyal Medya** | Feed embed | Harici API | Düşük |

### 4.2 Widget Yapısı (Örnek: Ürün Kartı)

```javascript
// libs/builder/components-omnex.js

Vvveb.Components.extend("_base", "omnex/product-card", {
    name: "Ürün Kartı",
    image: "icons/product.svg",
    dragHtml: '<div class="omnex-product-card"><span>Ürün Kartı</span></div>',

    html: `
        <div class="omnex-product-card" data-component="product-card" data-product-id="">
            <div class="product-image">
                <img src="" alt="">
            </div>
            <div class="product-info">
                <h3 class="product-name">Ürün Adı</h3>
                <p class="product-description">Açıklama</p>
                <div class="product-price">
                    <span class="current-price">0.00 ₺</span>
                    <span class="old-price">0.00 ₺</span>
                </div>
            </div>
        </div>
    `,

    properties: [
        {
            name: "Veri Kaynağı",
            key: "data-source",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "manual", text: "Manuel" },
                    { value: "product", text: "Ürün Seç" },
                    { value: "api", text: "API" }
                ]
            }
        },
        {
            name: "Ürün",
            key: "data-product-id",
            inputtype: ProductSelectInput, // Özel input
            data: {
                url: "/api/products"
            }
        },
        {
            name: "Görsel Göster",
            key: "data-show-image",
            inputtype: ToggleInput,
            data: { default: true }
        },
        {
            name: "Fiyat Göster",
            key: "data-show-price",
            inputtype: ToggleInput,
            data: { default: true }
        },
        {
            name: "Eski Fiyat Göster",
            key: "data-show-old-price",
            inputtype: ToggleInput,
            data: { default: false }
        },
        {
            name: "Kart Stili",
            key: "data-style",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "default", text: "Varsayılan" },
                    { value: "compact", text: "Kompakt" },
                    { value: "large", text: "Büyük" },
                    { value: "horizontal", text: "Yatay" }
                ]
            }
        }
    ],

    // Ürün verisi yüklendiğinde
    onProductLoad: function(product) {
        const element = this.node;
        element.querySelector('.product-name').textContent = product.name;
        element.querySelector('.product-description').textContent = product.description;
        element.querySelector('.current-price').textContent = product.current_price + ' ₺';
        if (product.previous_price) {
            element.querySelector('.old-price').textContent = product.previous_price + ' ₺';
        }
        if (product.image_url) {
            element.querySelector('.product-image img').src = product.image_url;
        }
    }
});
```

### 4.3 Özel Input Tipleri

```javascript
// Ürün seçici input
Vvveb.Inputs.ProductSelectInput = {
    init: function(data) {
        return `
            <div class="product-select-input">
                <input type="hidden" name="${data.key}" value="">
                <div class="selected-product">
                    <span class="product-name">Ürün seçilmedi</span>
                    <button type="button" class="btn btn-sm btn-primary select-product">
                        Seç
                    </button>
                </div>
            </div>
        `;
    },

    events: {
        'click .select-product': function() {
            // Ürün seçim modalı aç
            OmnexProductPicker.open({
                onSelect: (product) => {
                    this.setValue(product.id);
                    this.updateDisplay(product);
                }
            });
        }
    }
};

// Medya seçici input (mevcut MediaLibrary ile entegre)
Vvveb.Inputs.MediaSelectInput = {
    init: function(data) {
        return `
            <div class="media-select-input">
                <input type="hidden" name="${data.key}" value="">
                <div class="media-preview">
                    <img src="" alt="">
                </div>
                <button type="button" class="btn btn-sm btn-primary select-media">
                    Medya Seç
                </button>
            </div>
        `;
    }
};
```

---

## 5. API Endpoint'leri

### 5.1 Web Şablon API'leri

```
GET    /api/web-templates                    # Liste
GET    /api/web-templates/:id                # Tek şablon
POST   /api/web-templates                    # Oluştur
PUT    /api/web-templates/:id                # Güncelle
DELETE /api/web-templates/:id                # Sil
POST   /api/web-templates/:id/publish        # Yayınla
POST   /api/web-templates/:id/unpublish      # Yayından kaldır
POST   /api/web-templates/:id/duplicate      # Kopyala
GET    /api/web-templates/:id/versions       # Versiyon geçmişi
POST   /api/web-templates/:id/restore/:v     # Versiyona geri dön
GET    /api/web-templates/:id/preview        # HTML önizleme
POST   /api/web-templates/:id/render         # Statik render (PNG/PDF)
```

### 5.2 Cihaz Atama API'leri

```
GET    /api/web-templates/:id/assignments    # Atama listesi
POST   /api/web-templates/:id/assign         # Cihaza ata
DELETE /api/web-templates/:id/unassign/:did  # Atamayı kaldır
PUT    /api/web-templates/:id/assignments/:aid # Atama güncelle
```

### 5.3 Widget API'leri

```
GET    /api/web-templates/widgets            # Widget listesi
GET    /api/web-templates/widgets/:slug      # Widget detayı
POST   /api/web-templates/widgets            # Widget oluştur (admin)
PUT    /api/web-templates/widgets/:id        # Widget güncelle (admin)
DELETE /api/web-templates/widgets/:id        # Widget sil (admin)
```

### 5.4 VvvebJs Entegrasyon API'leri

```
POST   /api/web-templates/vvveb/save         # VvvebJs kaydetme
POST   /api/web-templates/vvveb/upload       # Medya yükleme
GET    /api/web-templates/vvveb/files        # Dosya listesi
DELETE /api/web-templates/vvveb/files/:path  # Dosya sil
```

---

## 6. Frontend Sayfaları

### 6.1 Sayfa Listesi

| Sayfa | Route | Dosya | Açıklama |
|-------|-------|-------|----------|
| Liste | /web-templates | WebTemplateList.js | Şablon listesi ve yönetimi |
| Editör | /web-templates/editor/:id? | WebTemplateEditor.js | VvvebJs editör wrapper |
| Önizleme | /web-templates/:id/preview | WebTemplatePreview.js | Tam ekran önizleme |
| Atama | /web-templates/:id/assign | WebTemplateAssign.js | Cihaz atama |

### 6.2 Sidebar Menü Yapısı

```
📁 Şablonlar (mevcut - Fabric.js)
   ├── Şablon Listesi
   └── Yeni Şablon

📁 Web Şablonları (yeni - VvvebJs)
   ├── Şablon Listesi
   ├── Yeni Web Şablonu
   └── Widget Yönetimi (admin)
```

### 6.3 WebTemplateList.js Yapısı

```javascript
export class WebTemplateList {
    constructor(app) {
        this.app = app;
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('web-templates');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <div class="page-header-icon">
                        <i class="ti ti-layout-dashboard"></i>
                    </div>
                    <div class="page-header-info">
                        <h1 class="page-title">${this.__('list.title')}</h1>
                        <p class="page-subtitle">${this.__('list.subtitle')}</p>
                    </div>
                </div>
                <div class="page-header-right">
                    <button class="btn btn-primary" id="btn-new-template">
                        <i class="ti ti-plus"></i>
                        ${this.__('actions.new')}
                    </button>
                </div>
            </div>

            <!-- Layout Seçim Kartları -->
            <div class="card mb-4">
                <div class="card-header">
                    <h3>${this.__('layouts.title')}</h3>
                </div>
                <div class="card-body">
                    <div class="layout-grid" id="layout-cards">
                        <!-- Dinamik layout kartları -->
                    </div>
                </div>
            </div>

            <!-- Şablon Listesi -->
            <div class="card">
                <div class="card-body">
                    <div id="templates-table"></div>
                </div>
            </div>
        `;
    }

    async init() {
        this.renderLayoutCards();
        await this.loadTemplates();
        this.bindEvents();
    }

    renderLayoutCards() {
        const layouts = [
            { id: 'full-width', name: 'Tam Genişlik', icon: 'ti-layout-distribute-horizontal' },
            { id: 'boxed', name: 'Kutu', icon: 'ti-layout-align-center' },
            { id: 'sidebar-left', name: 'Sol Sidebar', icon: 'ti-layout-sidebar' },
            { id: 'sidebar-right', name: 'Sağ Sidebar', icon: 'ti-layout-sidebar-right' },
            { id: 'two-sidebar', name: 'İki Sidebar', icon: 'ti-layout-columns' },
            { id: 'grid', name: 'Grid Layout', icon: 'ti-grid-dots' }
        ];

        // Render layout cards...
    }
}
```

---

## 7. Uygulama Planı

### 7.1 Fazlar ve Zaman Çizelgesi

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UYGULAMA PLANI                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FAZ 1: TEMEL ENTEGRASYON (1-2 Hafta)                               │
│  ├── VvvebJs dosyalarını kopyala ve düzenle                         │
│  ├── Veritabanı migration oluştur                                   │
│  ├── Temel API endpoint'leri yaz                                    │
│  ├── WebTemplateList sayfası oluştur                                │
│  └── Basit editör wrapper oluştur                                   │
│                                                                      │
│  FAZ 2: TEMA VE ÇEVİRİ (1 Hafta)                                    │
│  ├── Omnex CSS teması uygula                                        │
│  ├── Türkçe çeviriler ekle                                          │
│  ├── Header/sidebar entegrasyonu                                    │
│  └── Auth ve yetki kontrolü                                         │
│                                                                      │
│  FAZ 3: ÖZEL WİDGET'LAR (2-3 Hafta)                                 │
│  ├── Ürün Kartı widget'ı                                            │
│  ├── Fiyat Listesi widget'ı                                         │
│  ├── Kayan Yazı widget'ı                                            │
│  ├── Medya entegrasyonu                                             │
│  └── Dinamik veri bağlama                                           │
│                                                                      │
│  FAZ 4: CİHAZ ENTEGRASYONU (1-2 Hafta)                              │
│  ├── Cihaz atama UI                                                 │
│  ├── PWA Player entegrasyonu                                        │
│  ├── Zamanlama sistemi                                              │
│  └── Önizleme modu                                                  │
│                                                                      │
│  FAZ 5: GELİŞMİŞ ÖZELLİKLER (2 Hafta)                               │
│  ├── Versiyon yönetimi                                              │
│  ├── Şablon fork/kopyalama                                          │
│  ├── Import/Export                                                  │
│  └── Render sistemi (PNG/PDF)                                       │
│                                                                      │
│  TOPLAM TAHMİNİ SÜRE: 7-10 Hafta                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Faz 1 Detayları

**Görevler:**

1. **VvvebJs Dosya Kopyalama**
   - Gerekli dosyaları `public/html-editor/` dizinine kopyala
   - Gereksiz dosyaları çıkar (demo, eski bootstrap, vb.)
   - Dosya yollarını düzenle

2. **Veritabanı Migration**
   - `060_create_web_templates.sql` oluştur
   - Tablolar: web_templates, web_template_versions, web_template_assignments, web_template_widgets
   - Varsayılan widget kayıtları ekle

3. **API Endpoint'leri**
   - CRUD işlemleri (index, show, create, update, delete)
   - VvvebJs save entegrasyonu
   - Medya API bağlantısı

4. **Frontend Sayfaları**
   - WebTemplateList.js - Liste ve layout seçimi
   - Basit editör wrapper (iframe ile VvvebJs yükle)
   - Route tanımlamaları

---

## 8. Teknik Detaylar

### 8.1 VvvebJs - Omnex API Adaptörü

```javascript
// public/html-editor/js/omnex-adapter.js

const OmnexAdapter = {
    baseUrl: '/api/web-templates',
    token: null,

    init() {
        // Token'ı localStorage'dan al
        this.token = localStorage.getItem('omnex_token');

        // VvvebJs save fonksiyonunu override et
        Vvveb.Builder.saveUrl = this.baseUrl + '/vvveb/save';
        Vvveb.Builder.saveMethod = 'POST';

        // Save callback'ini ayarla
        Vvveb.Builder.onSave = this.onSave.bind(this);
    },

    async onSave(html, data) {
        try {
            const templateId = this.getTemplateId();
            const endpoint = templateId
                ? `${this.baseUrl}/${templateId}`
                : this.baseUrl;

            const response = await fetch(endpoint, {
                method: templateId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    html_content: html,
                    vvveb_data: JSON.stringify(data),
                    name: this.getTemplateName(),
                    status: 'draft'
                })
            });

            const result = await response.json();

            if (result.success) {
                Vvveb.Builder.showMessage('success', 'Şablon kaydedildi');
                if (!templateId) {
                    // Yeni şablon - URL'i güncelle
                    window.history.pushState({}, '',
                        `#/web-templates/editor/${result.data.id}`);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Vvveb.Builder.showMessage('error', 'Kaydetme hatası: ' + error.message);
        }
    },

    getTemplateId() {
        const hash = window.location.hash;
        const match = hash.match(/\/editor\/([a-f0-9-]+)/);
        return match ? match[1] : null;
    },

    getTemplateName() {
        return document.getElementById('template-name')?.value || 'Adsız Şablon';
    },

    // Medya yükleme
    async uploadMedia(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/media/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        const result = await response.json();
        return result.data.url;
    }
};

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    OmnexAdapter.init();
});
```

### 8.2 Özelleştirilmiş editor.html

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Web Şablon Editörü - Omnex Display Hub</title>

    <!-- Omnex Tema -->
    <link href="../assets/css/main.css" rel="stylesheet">

    <!-- VvvebJs Stilleri -->
    <link href="css/editor.css" rel="stylesheet">
    <link href="css/omnex-theme.css" rel="stylesheet">

    <!-- CodeMirror -->
    <link href="libs/codemirror/codemirror.css" rel="stylesheet">
</head>
<body>

<!-- Omnex Header (iframe dışında kalacak) -->
<div id="omnex-editor-header">
    <div class="editor-header-left">
        <a href="#/web-templates" class="btn btn-icon">
            <i class="ti ti-arrow-left"></i>
        </a>
        <input type="text" id="template-name" placeholder="Şablon Adı" class="form-input">
    </div>
    <div class="editor-header-right">
        <button id="btn-preview" class="btn btn-outline">
            <i class="ti ti-eye"></i>
            Önizleme
        </button>
        <button id="btn-save" class="btn btn-primary">
            <i class="ti ti-device-floppy"></i>
            Kaydet
        </button>
        <button id="btn-publish" class="btn btn-success">
            <i class="ti ti-send"></i>
            Yayınla
        </button>
    </div>
</div>

<!-- VvvebJs Editör Alanı -->
<div id="vvveb-editor">
    <!-- Sol Panel -->
    <div id="left-panel">
        <!-- Dosya yöneticisi, bileşenler, vb. -->
    </div>

    <!-- Canvas Alanı -->
    <div id="canvas-panel">
        <iframe id="iframeId"></iframe>
    </div>

    <!-- Sağ Panel -->
    <div id="right-panel">
        <!-- Özellik paneli -->
    </div>
</div>

<!-- VvvebJs Scripts -->
<script src="js/popper.min.js"></script>
<script src="js/bootstrap.min.js"></script>
<script src="libs/builder/builder.js"></script>
<script src="libs/builder/undo.js"></script>
<script src="libs/builder/inputs.js"></script>
<script src="libs/builder/components-bootstrap5.js"></script>
<script src="libs/builder/components-html.js"></script>
<script src="libs/builder/components-omnex.js"></script>

<!-- CodeMirror -->
<script src="libs/codemirror/codemirror.js"></script>
<script src="libs/codemirror/xml.js"></script>
<script src="libs/codemirror/css.js"></script>
<script src="libs/codemirror/javascript.js"></script>

<!-- Omnex Adaptör -->
<script src="js/omnex-adapter.js"></script>

<!-- Türkçe Dil Dosyası -->
<script src="locales/tr.js"></script>

<script>
    // Editörü başlat
    Vvveb.Builder.init('iframeId', function() {
        // Şablon ID'si varsa yükle
        const templateId = OmnexAdapter.getTemplateId();
        if (templateId) {
            OmnexAdapter.loadTemplate(templateId);
        } else {
            // Yeni şablon - boş sayfa
            Vvveb.Builder.loadNewPage();
        }
    });
</script>

</body>
</html>
```

### 8.3 Türkçe Çeviri Dosyası

```javascript
// public/html-editor/locales/tr.js

Vvveb.I18n = {
    // Genel
    "Save": "Kaydet",
    "Preview": "Önizleme",
    "Download": "İndir",
    "Export": "Dışa Aktar",
    "Undo": "Geri Al",
    "Redo": "İleri Al",
    "Designer mode": "Tasarımcı modu",
    "File manager": "Dosya yöneticisi",

    // Sol Panel
    "Components": "Bileşenler",
    "Sections": "Bölümler",
    "Blocks": "Bloklar",
    "Search components": "Bileşen ara...",

    // Bileşen Kategorileri
    "Content": "İçerik",
    "Typography": "Tipografi",
    "Media": "Medya",
    "Forms": "Formlar",
    "Components": "Bileşenler",
    "Widgets": "Widget'lar",
    "Omnex": "Omnex",

    // Omnex Widget'ları
    "Product Card": "Ürün Kartı",
    "Price List": "Fiyat Listesi",
    "Ticker": "Kayan Yazı",
    "Clock": "Saat",
    "Weather": "Hava Durumu",
    "QR Code": "QR Kod",
    "Countdown": "Geri Sayım",

    // Sağ Panel
    "Properties": "Özellikler",
    "Styles": "Stiller",
    "Advanced": "Gelişmiş",

    // Özellik Adları
    "Background": "Arka Plan",
    "Background color": "Arka plan rengi",
    "Background image": "Arka plan görseli",
    "Margin": "Dış Boşluk",
    "Padding": "İç Boşluk",
    "Border": "Kenarlık",
    "Border radius": "Köşe yuvarlaklığı",
    "Shadow": "Gölge",
    "Width": "Genişlik",
    "Height": "Yükseklik",
    "Font family": "Yazı tipi",
    "Font size": "Yazı boyutu",
    "Font weight": "Yazı kalınlığı",
    "Text color": "Metin rengi",
    "Text align": "Metin hizalama",

    // Responsive
    "Desktop": "Masaüstü",
    "Tablet": "Tablet",
    "Mobile": "Mobil",

    // Mesajlar
    "Page saved successfully": "Sayfa başarıyla kaydedildi",
    "Error saving page": "Sayfa kaydedilirken hata oluştu",
    "Are you sure you want to delete this element?": "Bu öğeyi silmek istediğinizden emin misiniz?",

    // Butonlar
    "Add": "Ekle",
    "Edit": "Düzenle",
    "Delete": "Sil",
    "Duplicate": "Kopyala",
    "Move up": "Yukarı taşı",
    "Move down": "Aşağı taşı",
    "Select parent": "Üst öğeyi seç",

    // Bootstrap Bileşenleri
    "Container": "Kapsayıcı",
    "Row": "Satır",
    "Column": "Sütun",
    "Button": "Buton",
    "Image": "Görsel",
    "Video": "Video",
    "Heading": "Başlık",
    "Paragraph": "Paragraf",
    "Link": "Bağlantı",
    "List": "Liste",
    "Table": "Tablo",
    "Form": "Form",
    "Input": "Giriş alanı",
    "Textarea": "Metin alanı",
    "Select": "Seçim kutusu",
    "Checkbox": "Onay kutusu",
    "Radio": "Radyo butonu",
    "Card": "Kart",
    "Alert": "Uyarı",
    "Badge": "Rozet",
    "Progress": "İlerleme çubuğu",
    "Carousel": "Slider",
    "Accordion": "Akordeon",
    "Tabs": "Sekmeler",
    "Modal": "Modal",
    "Navbar": "Navigasyon",
    "Footer": "Altbilgi"
};
```

---

## 9. PWA Player Entegrasyonu

### 9.1 HTML Şablon Render

```javascript
// public/player/assets/js/player.js

// Web şablonu render metodu
async renderWebTemplate(template) {
    // HTML içeriği al
    const html = template.html_content;
    const css = template.css_content || '';
    const js = template.js_content || '';

    // Dinamik verileri yerleştir
    const renderedHtml = await this.processTemplateData(html, template.data_config);

    // İçerik container'ına yerleştir
    const container = document.getElementById('content-container');
    container.innerHTML = `
        <style>${css}</style>
        ${renderedHtml}
        <script>${js}</script>
    `;

    // Widget'ları başlat
    this.initializeWidgets(container);
}

// Dinamik veri işleme
async processTemplateData(html, dataConfig) {
    let processedHtml = html;

    // Ürün verilerini al
    if (dataConfig?.products) {
        const products = await this.fetchProducts(dataConfig.products);
        processedHtml = this.replaceProductPlaceholders(processedHtml, products);
    }

    // Diğer dinamik veriler
    // ...

    return processedHtml;
}

// Widget'ları başlat
initializeWidgets(container) {
    // Kayan yazı
    container.querySelectorAll('.omnex-ticker').forEach(ticker => {
        new OmnexTicker(ticker);
    });

    // Saat
    container.querySelectorAll('.omnex-clock').forEach(clock => {
        new OmnexClock(clock);
    });

    // Geri sayım
    container.querySelectorAll('.omnex-countdown').forEach(countdown => {
        new OmnexCountdown(countdown);
    });
}
```

### 9.2 Content API Güncellemesi

```php
// api/player/content.php

// Web şablonu içeriğini döndür
if ($assignment['content_type'] === 'web_template') {
    $template = $db->fetch(
        "SELECT * FROM web_templates WHERE id = ? AND status = 'published'",
        [$assignment['template_id']]
    );

    if ($template) {
        $response['content'][] = [
            'type' => 'web_template',
            'id' => $template['id'],
            'name' => $template['name'],
            'html_content' => $template['html_content'],
            'css_content' => $template['css_content'],
            'js_content' => $template['js_content'],
            'data_config' => json_decode($template['data_config'], true),
            'responsive_breakpoints' => json_decode($template['responsive_breakpoints'], true)
        ];
    }
}
```

---

## 10. Güvenlik Önlemleri

### 10.1 XSS Koruması

```php
// api/web-templates/create.php

// HTML sanitization
$allowedTags = [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'img', 'video', 'audio', 'iframe',
    'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
    'form', 'input', 'textarea', 'select', 'option', 'button',
    'header', 'footer', 'nav', 'section', 'article', 'aside',
    'br', 'hr', 'strong', 'em', 'i', 'b', 'u'
];

$allowedAttributes = [
    'class', 'id', 'style', 'src', 'href', 'alt', 'title',
    'width', 'height', 'data-*', 'role', 'aria-*',
    'type', 'name', 'value', 'placeholder'
];

// JavaScript içeriğini sandbox'la
function sandboxJavaScript($js) {
    // Tehlikeli fonksiyonları engelle
    $dangerous = ['eval', 'Function', 'document.cookie', 'localStorage', 'sessionStorage'];
    foreach ($dangerous as $func) {
        if (stripos($js, $func) !== false) {
            throw new Exception("Güvenlik hatası: $func kullanılamaz");
        }
    }
    return $js;
}
```

### 10.2 Yetki Kontrolü

```php
// middleware/WebTemplateMiddleware.php

class WebTemplateMiddleware {
    public static function canEdit($templateId, $userId) {
        $db = Database::getInstance();
        $user = Auth::user();

        // SuperAdmin her şeyi düzenleyebilir
        if ($user['role'] === 'superadmin') {
            return true;
        }

        // Admin kendi firmasının şablonlarını düzenleyebilir
        $template = $db->fetch(
            "SELECT company_id, created_by FROM web_templates WHERE id = ?",
            [$templateId]
        );

        if (!$template) {
            return false;
        }

        return $template['company_id'] === $user['company_id'];
    }

    public static function canPublish($templateId, $userId) {
        $user = Auth::user();

        // Sadece admin ve superadmin yayınlayabilir
        return in_array($user['role'], ['admin', 'superadmin']);
    }
}
```

---

## 11. Test Planı

### 11.1 Unit Testler

```php
// tests/WebTemplateTest.php

class WebTemplateTest extends TestCase {

    public function testCreateTemplate() {
        $response = $this->post('/api/web-templates', [
            'name' => 'Test Şablon',
            'html_content' => '<div>Test</div>',
            'layout_type' => 'full-width'
        ]);

        $this->assertEquals(201, $response->status);
        $this->assertArrayHasKey('id', $response->data);
    }

    public function testPublishTemplate() {
        $template = $this->createTemplate();

        $response = $this->post("/api/web-templates/{$template->id}/publish");

        $this->assertEquals(200, $response->status);
        $this->assertEquals('published', $response->data['status']);
    }

    public function testVersioning() {
        $template = $this->createTemplate();

        // İlk güncelleme
        $this->put("/api/web-templates/{$template->id}", [
            'html_content' => '<div>Güncel</div>'
        ]);

        // Versiyon kontrolü
        $versions = $this->get("/api/web-templates/{$template->id}/versions");

        $this->assertCount(2, $versions->data);
    }
}
```

### 11.2 E2E Testler

```javascript
// tests/e2e/web-template-editor.spec.js

describe('Web Şablon Editörü', () => {

    it('yeni şablon oluşturabilmeli', () => {
        cy.visit('/web-templates');
        cy.get('#btn-new-template').click();
        cy.get('.layout-card[data-layout="full-width"]').click();

        // Editör yüklenmeli
        cy.url().should('include', '/web-templates/editor');
        cy.get('#vvveb-editor').should('be.visible');
    });

    it('bileşen sürükle-bırak çalışmalı', () => {
        cy.visit('/web-templates/editor');

        // Bileşen sürükle
        cy.get('[data-component="container"]').drag('#canvas-panel');

        // Canvas'ta görünmeli
        cy.get('#iframeId').its('contentDocument')
            .find('.container').should('exist');
    });

    it('kaydetme çalışmalı', () => {
        cy.visit('/web-templates/editor');
        cy.get('#template-name').type('E2E Test Şablon');
        cy.get('#btn-save').click();

        // Başarı mesajı
        cy.get('.toast-success').should('contain', 'kaydedildi');
    });
});
```

---

## 12. Performans Optimizasyonu

### 12.1 Lazy Loading

```javascript
// Bileşenleri lazy load et
const componentModules = {
    'omnex/product-card': () => import('./components/product-card.js'),
    'omnex/price-list': () => import('./components/price-list.js'),
    'omnex/ticker': () => import('./components/ticker.js')
};

async function loadComponent(type) {
    if (componentModules[type]) {
        const module = await componentModules[type]();
        return module.default;
    }
    return null;
}
```

### 12.2 Asset Minification

```javascript
// gulpfile.js - Build optimizasyonu

const gulp = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const cleanCSS = require('gulp-clean-css');

gulp.task('build-js', function() {
    return gulp.src([
        'libs/builder/builder.js',
        'libs/builder/undo.js',
        'libs/builder/inputs.js',
        'libs/builder/components-bootstrap5.js',
        'libs/builder/components-omnex.js'
    ])
    .pipe(concat('editor.bundle.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist/'));
});

gulp.task('build-css', function() {
    return gulp.src([
        'css/editor.css',
        'css/omnex-theme.css'
    ])
    .pipe(concat('editor.bundle.min.css'))
    .pipe(cleanCSS())
    .pipe(gulp.dest('dist/'));
});
```

---

## 13. Bakım ve Güncelleme

### 13.1 VvvebJs Güncellemeleri

VvvebJs güncellemelerini takip etmek için:

1. GitHub repository'yi izle: https://github.com/givanz/VvvebJs
2. Changelog'u kontrol et
3. Önemli güvenlik yamalarını uygula
4. Özel değişiklikleri koruyarak merge et

### 13.2 Widget Geliştirme Rehberi

Yeni widget eklemek için:

1. `libs/builder/components-omnex.js` dosyasına component tanımı ekle
2. CSS stillerini `css/omnex-theme.css` dosyasına ekle
3. Türkçe çevirilerini `locales/tr.js` dosyasına ekle
4. `web_template_widgets` tablosuna kayıt ekle
5. Test yaz ve belgele

---

## 14. Sonuç

### 14.1 Özet

VvvebJs entegrasyonu, Omnex Display Hub'a güçlü bir HTML şablon editörü kazandıracaktır. Bu entegrasyon:

- **Mevcut Fabric.js editörünü tamamlar** (değiştirmez)
- **Signage ve TV içerikleri için ideal**
- **Responsive tasarım desteği sağlar**
- **Sıfır dış bağımlılık** (Vanilla JS)
- **Apache 2.0 lisansı** (ticari kullanıma uygun)

### 14.2 Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Öğrenme eğrisi | Düşük | Orta | Kapsamlı dokümantasyon |
| Performans | Düşük | Orta | Lazy loading, minification |
| Güvenlik | Orta | Yüksek | XSS koruması, sandbox |
| Bakım yükü | Orta | Orta | Modüler yapı |

### 14.3 Sonraki Adımlar

1. ✅ Plan onayı
2. ⏳ Faz 1 başlangıç
3. ⏳ Temel entegrasyon
4. ⏳ Test ve doğrulama
5. ⏳ Production deployment

---

**Hazırlayan:** Claude AI
**Tarih:** 2026-02-03
**Versiyon:** 1.0
