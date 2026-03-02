# Şablon Sistemi Mimari Dokümantasyonu

**Proje:** Omnex Display Hub - Market Etiket Sistemi  
**Versiyon:** 2.0.14  
**Tarih:** 2026-01-30  
**Fabric.js Versiyonu:** 5.3.0

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Fabric.js Canvas Yapısı](#2-fabricjs-canvas-yapısı)
3. [Veritabanı Şeması](#3-veritabanı-şeması)
4. [API Endpoint'leri](#4-api-endpointleri)
5. [JSON Export/Import Sistemi](#5-json-exportimport-sistemi)
6. [Render Sistemi](#6-render-sistemi)
7. [Custom Properties](#7-custom-properties)
8. [Dinamik Alanlar ve Placeholder'lar](#8-dinamik-alanlar-ve-placeholderlar)
9. [Grid Layout ve Regions](#9-grid-layout-ve-regions)
10. [Veri Akışı Diyagramları](#10-veri-akışı-diyagramları)

---

## 1. Genel Bakış

### 1.1 Sistem Mimarisi

Omnex Display Hub şablon sistemi, Fabric.js 5.3.0 tabanlı bir canvas editörü kullanarak etiket ve signage şablonları oluşturma, düzenleme ve render etme imkanı sunar.

**Ana Bileşenler:**
- **Frontend:** JavaScript (ES6+), Fabric.js 5.3.0
- **Backend:** PHP (RESTful API)
- **Veritabanı:** SQLite
- **Render Engine:** Client-side (Fabric.js) + Server-side (PHP/GD)

### 1.2 Temel Özellikler

- ✅ Fabric.js 5.3.0 canvas editörü
- ✅ Dinamik alan desteği (placeholder'lar)
- ✅ Grid layout sistemi (çoklu bölge)
- ✅ Barkod ve QR kod desteği
- ✅ Video placeholder desteği
- ✅ JSON export/import
- ✅ Client-side ve server-side render
- ✅ Cihaza doğrudan gönderim

---

## 2. Fabric.js Canvas Yapısı

### 2.1 Canvas İnisiyalizasyonu

**Dosya:** `public/assets/js/pages/templates/TemplateEditor.js`

```javascript
this.canvas = new fabric.Canvas('template-canvas', {
    width: preset.width,
    height: preset.height,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true
});

// Orijinal boyutları sakla (zoom için)
this.canvas.originalWidth = preset.width;
this.canvas.originalHeight = preset.height;
```

### 2.2 Canvas Event'leri

```javascript
// Selection events
this.canvas.on('selection:created', (e) => this._onObjectSelected(e.selected[0]));
this.canvas.on('selection:updated', (e) => this._onObjectSelected(e.selected[0]));
this.canvas.on('selection:cleared', () => this._onObjectDeselected());
this.canvas.on('object:modified', () => this._onObjectModified());
this.canvas.on('object:added', () => this._saveHistory());
this.canvas.on('object:removed', () => this._saveHistory());
this.canvas.on('object:moving', () => this._updateSelectionInfo());
this.canvas.on('object:scaling', () => this._updateSelectionInfo());
```

### 2.3 Canvas JSON Yapısı

**Fabric.js 5.3.0 Formatı:**

```json
{
    "version": "5.3.0",
    "objects": [
        {
            "type": "i-text",
            "version": "5.3.0",
            "left": 100,
            "top": 100,
            "width": 200,
            "height": 50,
            "text": "{{product_name}}",
            "fontSize": 40,
            "fill": "#000000",
            "customType": "dynamic-text",
            "dynamicField": "product_name",
            "isDataField": true,
            "styles": []
        }
    ],
    "background": "#ffffff",
    "backgroundImage": null
}
```

### 2.4 Canvas Kaydetme

**Dosya:** `public/assets/js/pages/templates/editor/TemplateIO.js`

```javascript
// Custom properties ile JSON'a export
const canvasJson = this.canvas.toJSON(CUSTOM_PROPS);

// Region overlay ve background objelerini filtrele
canvasJson.objects = canvasJson.objects.filter(obj =>
    !obj.isRegionOverlay && !obj.isBackground
);
```

### 2.5 Canvas Yükleme

```javascript
this.canvas.loadFromJSON(content, () => {
    // Custom properties'i geri yükle
    this._restoreCustomProperties(customProps);
    this.canvas.renderAll();
}, (jsonObj, fabricObj) => {
    // Reviver: Her obje yüklendiğinde custom properties'i kopyala
    if (jsonObj && fabricObj) {
        CUSTOM_PROPS.forEach(prop => {
            if (jsonObj[prop] !== undefined) {
                fabricObj[prop] = jsonObj[prop];
            }
        });
    }
});
```

---

## 3. Veritabanı Şeması

### 3.1 Templates Tablosu

**Dosya:** `database/migrations/004_create_templates.sql`

```sql
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('label', 'signage', 'tv')),
    category TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    orientation TEXT DEFAULT 'landscape' CHECK(orientation IN ('landscape', 'portrait')),
    design_data TEXT NOT NULL,              -- Fabric.js JSON (string)
    preview_image TEXT,                     -- Base64 veya dosya yolu
    render_image TEXT,                      -- Tam boyutlu render (dosya yolu)
    version INTEGER DEFAULT 1,
    parent_id TEXT,
    is_default INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Migration 021: Çoklu ürün desteği
    layout_type TEXT DEFAULT 'full',
    template_file TEXT,
    slots TEXT,                             -- JSON string
    
    -- Migration 025: Grid layout
    grid_layout TEXT DEFAULT 'single',
    regions_config TEXT,                    -- JSON string
    target_device_type TEXT,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 3.2 Önemli Alanlar

| Alan | Tip | Açıklama |
|------|-----|----------|
| `design_data` | TEXT | Fabric.js canvas JSON (string formatında) |
| `preview_image` | TEXT | Küçük önizleme görseli (base64 veya dosya yolu) |
| `render_image` | TEXT | Tam boyutlu render görseli (dosya yolu) |
| `grid_layout` | TEXT | Grid layout ID (single, split-vertical, vb.) |
| `regions_config` | TEXT | Bölge yapılandırması (JSON string) |
| `target_device_type` | TEXT | Hedef cihaz preset ID (esl_101_portrait, vb.) |

### 3.3 İndeksler

```sql
CREATE INDEX IF NOT EXISTS idx_templates_company ON templates(company_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_public ON templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_layout_type ON templates(layout_type);
CREATE INDEX IF NOT EXISTS idx_templates_target_device ON templates(target_device_type);
CREATE INDEX IF NOT EXISTS idx_templates_grid_layout ON templates(grid_layout);
```

---

## 4. API Endpoint'leri

### 4.1 Endpoint Listesi

**Base URL:** `/api/templates`

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/templates` | Şablon listesi (pagination, search, filter) |
| GET | `/api/templates/{id}` | Şablon detayı |
| POST | `/api/templates` | Yeni şablon oluştur |
| PUT | `/api/templates/{id}` | Şablon güncelle |
| DELETE | `/api/templates/{id}` | Şablon sil |
| GET | `/api/templates/export` | Şablon export (JSON) |
| POST | `/api/templates/import` | Şablon import (JSON) |
| POST | `/api/templates/{id}/render` | Şablonu render et |
| POST | `/api/templates/{id}/fork` | Sistem şablonunu kopyala |

### 4.2 GET /api/templates

**Dosya:** `api/templates/index.php`

**Query Parametreleri:**
- `page` (int): Sayfa numarası (varsayılan: 1)
- `per_page` (int): Sayfa başına kayıt (varsayılan: 20)
- `search` (string): Arama terimi (name, description)
- `type` (string): Şablon tipi (esl, signage, tv, label_printer)
- `scope` (string): Kapsam (system, company, all)

**Response:**
```json
{
    "data": [
        {
            "id": "uuid",
            "name": "Şablon Adı",
            "type": "esl",
            "width": 800,
            "height": 1280,
            "preview_image": "data:image/png;base64,...",
            "content": "{...canvas JSON...}",
            "grid_layout": "single",
            "target_device_type": "esl_101_portrait"
        }
    ],
    "pagination": {
        "total": 100,
        "page": 1,
        "per_page": 20,
        "total_pages": 5
    }
}
```

### 4.3 POST /api/templates

**Dosya:** `api/templates/create.php`

**Request Body:**
```json
{
    "name": "Yeni Şablon",
    "description": "Açıklama",
    "type": "esl",
    "width": 800,
    "height": 1280,
    "orientation": "portrait",
    "target_device_type": "esl_101_portrait",
    "grid_layout": "single",
    "regions_config": "[{...}]",
    "design_data": "{...canvas JSON...}",
    "preview_image": "data:image/png;base64,...",
    "render_image": "data:image/png;base64,..."
}
```

**Önemli Notlar:**
- `design_data` Fabric.js JSON formatında (string)
- `preview_image` ve `render_image` base64 data URL formatında
- `render_image` dosyaya kaydedilir: `storage/companies/{company_id}/templates/renders/{filename}.png`
- Type mapping: `esl` → `label`, `label_printer` → `label` (category: `label_printer`)

### 4.4 PUT /api/templates/{id}

**Dosya:** `api/templates/update.php`

**Güvenlik:**
- SuperAdmin: Tüm şablonları düzenleyebilir
- Normal kullanıcı: Sadece kendi firma şablonlarını düzenleyebilir
- Sistem şablonları: Sadece SuperAdmin düzenleyebilir

**Request Body:** (POST ile aynı, tüm alanlar opsiyonel)

### 4.5 GET /api/templates/export

**Dosya:** `api/templates/export.php`

**Query Parametreleri:**
- `id` (string): Tek şablon export
- `ids` (string): Çoklu şablon export (virgülle ayrılmış)
- `all` (boolean): Tüm şablonları export et
- `format` (string): `json` (response) veya `file` (download)

**Response Formatı:**
```json
{
    "version": "2.0.0",
    "export_date": "2026-01-30 14:30:00",
    "export_by": "Kullanıcı Adı",
    "template_count": 5,
    "templates": [
        {
            "name": "Şablon Adı",
            "description": "Açıklama",
            "type": "esl",
            "width": 800,
            "height": 1280,
            "design_data": "{...canvas JSON...}",
            "preview_image": "data:image/png;base64,...",
            "grid_layout": "single",
            "regions_config": "[{...}]",
            "target_device_type": "esl_101_portrait"
        }
    ]
}
```

### 4.6 POST /api/templates/import

**Dosya:** `api/templates/import.php`

**Request:**
- **Dosya upload:** `multipart/form-data` ile `.json` dosyası
- **JSON body:** `application/json` ile doğrudan JSON

**Query Parametreleri:**
- `skip_existing` (boolean): Mevcut şablonları atla
- `overwrite` (boolean): Mevcut şablonları üzerine yaz
- `add_suffix` (boolean): İsme suffix ekle (varsayılan: true)

**Response:**
```json
{
    "results": {
        "total": 5,
        "imported": 4,
        "skipped": 1,
        "failed": 0,
        "details": [
            {
                "name": "Şablon Adı",
                "status": "created",
                "id": "uuid",
                "message": "Şablon başarıyla oluşturuldu"
            }
        ]
    },
    "message": "4 şablon içe aktarıldı, 1 atlandı, 0 başarısız"
}
```

### 4.7 POST /api/templates/{id}/render

**Dosya:** `api/templates/render.php`

**Request Body:**
```json
{
    "product_id": "uuid",
    "product": {
        "name": "Ürün Adı",
        "current_price": 29.99,
        "barcode": "8690000000001"
    },
    "device_id": "uuid",
    "format": "html|image|both"
}
```

**Response:**
```json
{
    "template_id": "uuid",
    "template_name": "Şablon Adı",
    "width": 800,
    "height": 1280,
    "html": "<html>...</html>",
    "image": "data:image/png;base64,...",
    "design_data": "{...canvas JSON...}",
    "device_sent": true,
    "device_id": "uuid",
    "device_name": "Cihaz Adı"
}
```

**Render Stratejisi:**
1. Client-rendered image varsa (canvas'tan alınan): Tam ekran gönder
2. Video varsa + regions_config'de video bölgesi: Grid gönderimi
3. Sadece görsel: Tam ekran gönder

---

## 5. JSON Export/Import Sistemi

### 5.1 Export Formatı

**Versiyon:** 2.0.0

```json
{
    "version": "2.0.0",
    "export_date": "2026-01-30T14:30:00Z",
    "export_by": "Kullanıcı Adı",
    "template_count": 1,
    "templates": [
        {
            "name": "Şablon Adı",
            "description": "Açıklama",
            "type": "esl",
            "orientation": "portrait",
            "width": 800,
            "height": 1280,
            "design_data": "{...Fabric.js JSON...}",
            "preview_image": "data:image/png;base64,...",
            "render_image": "data:image/png;base64,...",
            "target_device_type": "esl_101_portrait",
            "grid_layout": "single",
            "regions_config": "[{...}]",
            "layout_type": "full",
            "template_file": null,
            "slots": null,
            "status": "active",
            "created_at": "2026-01-30 10:00:00",
            "updated_at": "2026-01-30 14:30:00"
        }
    ]
}
```

### 5.2 Import İşlemi

**Adımlar:**
1. JSON dosyası veya body parse edilir
2. `templates` dizisi kontrol edilir
3. Her şablon için:
   - Zorunlu alanlar kontrol edilir (`design_data`)
   - Aynı isimde şablon var mı kontrol edilir
   - Import seçeneklerine göre işlem yapılır:
     - `skip_existing`: Mevcut şablonlar atlanır
     - `overwrite`: Mevcut şablonlar güncellenir
     - `add_suffix`: İsme "(İçe Aktarıldı)" eklenir
4. Yeni şablonlar oluşturulur veya mevcutlar güncellenir

### 5.3 Export/Import Akışı

```
[Frontend]                    [Backend]                    [Database]
    |                              |                            |
    |-- GET /export?id=xxx ------->|                            |
    |                              |-- SELECT * FROM templates  |
    |                              |<-- Template data -----------|
    |                              |-- Format export JSON        |
    |<-- JSON response ------------|                            |
    |                              |                            |
    |-- POST /import (file) ------>|                            |
    |                              |-- Parse JSON                |
    |                              |-- Validate data             |
    |                              |-- INSERT/UPDATE templates   |
    |                              |<-- Success/Error -----------|
    |<-- Import results -----------|                            |
```

---

## 6. Render Sistemi

### 6.1 Client-Side Render

**Dosya:** `public/assets/js/services/TemplateRenderer.js`

**Sınıf:** `TemplateRenderer`

**Metod:** `render(template, product)`

**İşlem Adımları:**
1. Fabric.js yüklenir (CDN'den)
2. Off-screen canvas oluşturulur
3. `design_data` parse edilir
4. Canvas'a yüklenir (custom properties korunur)
5. Dinamik alanlar ürün verileriyle değiştirilir
6. Canvas PNG olarak export edilir (base64)

**Örnek Kullanım:**
```javascript
const renderer = new TemplateRenderer();
const dataUrl = await renderer.render(template, product);
// dataUrl: "data:image/png;base64,..."
```

### 6.2 Server-Side Render

**Dosya:** `api/templates/render.php`

**Render Stratejileri:**

#### 6.2.1 HTML Render
- Eski sistem: `template_file` varsa HTML şablonu kullanılır
- Yeni sistem: `design_data` JSON olarak döndürülür (client-side render için)

#### 6.2.2 Image Render
- Basit GD render: `TemplateRenderer::renderSimpleImage()`
- Chrome headless render: `TemplateRenderer::renderToImage()` (opsiyonel)

### 6.3 Cihaza Gönderim

**Render → Cihaz Akışı:**

```
[Template] → [Product Data] → [Render] → [Device]
     |              |              |          |
     |              |              |          |
  design_data   product obj    PNG/HTML   PavoDisplay
     |              |              |          |
     |              |              |          |
  Fabric.js    Placeholder    Base64     HTTP POST
  JSON          Replace        Image      Gateway
```

**Gönderim Parametreleri:**
```php
$sendParams = [
    'layout' => 'single|custom|fullscreen_video',
    'width' => 800,
    'height' => 1280,
    'image' => '/path/to/image.png',
    'videos' => ['/path/to/video.mp4'],
    'product' => $productInfo,
    'design_data' => $templateDesignData,
    'image_region' => ['x' => 0, 'y' => 0, 'width' => 800, 'height' => 640],
    'video_region' => ['x' => 0, 'y' => 640, 'width' => 800, 'height' => 640]
];
```

### 6.4 Video Placeholder İşleme

**Kaydetme Sırasında:**
- Video placeholder'lar gizlenir (`visible: false`)
- Render görseli alınır (video olmadan)
- Video placeholder'lar geri açılır

**Render Sırasında:**
- Video placeholder'lar tespit edilir
- Ürün videoları çözümlenir
- Grid layout'a göre video ve görsel bölgeleri belirlenir
- Cihaza gönderilir

---

## 7. Custom Properties

### 7.1 CUSTOM_PROPS Listesi

**Dosya:** `public/assets/js/pages/templates/editor/TemplateIO.js`

```javascript
export const CUSTOM_PROPS = [
    // Temel özellikler
    'customType',           // Özel tip (barcode, qrcode, price, vb.)
    'isDataField',          // Dinamik alan mı?
    'dynamicField',         // Bağlı ürün alanı (product_name, vb.)
    'regionId',             // Bölge ID'si
    
    // Görünüm kontrolü
    'isRegionOverlay',      // Grid overlay objesi
    'isBackground',         // Arka plan objesi
    'isVideoPlaceholder',   // Video placeholder
    'isMultipleVideos',     // Çoklu video
    
    // Çoklu ürün çerçevesi
    'slots',                // Slot listesi
    'frameCols',            // Sütun sayısı
    'frameRows',            // Satır sayısı
    'activeSlotId',         // Aktif slot
    'slotId',               // Slot ID
    'inMultiFrame',         // Multi-frame içinde
    'parentFrameId',        // Üst frame ID
    'isSlotBackground',     // Slot arka planı
    'isSlotLabel',          // Slot etiketi
    'isSlotPlaceholder',    // Slot placeholder
    
    // Barkod/QR
    'barcodeValue',         // Barkod değeri
    'qrValue',              // QR kod değeri
    'originalBarcodeValue', // Orijinal barkod (terazi kodu)
    'barcodeFormat'         // Format (EAN13, CODE128, vb.)
];
```

### 7.2 Custom Properties Kullanımı

**Kaydetme:**
```javascript
const canvasJson = this.canvas.toJSON(CUSTOM_PROPS);
// Sadece CUSTOM_PROPS listesindeki özellikler JSON'a eklenir
```

**Yükleme:**
```javascript
this.canvas.loadFromJSON(json, callback, (jsonObj, fabricObj) => {
    // Reviver: Custom properties'i geri yükle
    CUSTOM_PROPS.forEach(prop => {
        if (jsonObj[prop] !== undefined) {
            fabricObj[prop] = jsonObj[prop];
        }
    });
});
```

### 7.3 Custom Type Değerleri

| customType | Açıklama | Tip |
|------------|----------|-----|
| `null` | Standart eleman | - |
| `barcode` | Barkod görseli | image |
| `qrcode` | QR kod görseli | image |
| `price` | Fiyat metni | i-text |
| `dynamic-image` | Dinamik görsel | image |
| `video` | Video placeholder | group |
| `multi-product-frame` | Çoklu ürün çerçevesi | group |

---

## 8. Dinamik Alanlar ve Placeholder'lar

### 8.1 Placeholder Formatı

**Format:** `{{alan_adi}}`

**Örnekler:**
- `{{product_name}}` → Ürün adı
- `{{current_price}}` → Güncel fiyat
- `{{barcode}}` → Barkod numarası

### 8.2 Desteklenen Alanlar

**Temel Bilgiler:**
- `product_name`, `sku`, `barcode`, `description`, `slug`

**Fiyat Bilgileri:**
- `current_price`, `previous_price`, `vat_rate`, `discount_percent`, `campaign_text`

**Kategori ve Marka:**
- `category`, `subcategory`, `brand`

**Ürün Detayları:**
- `unit`, `weight`, `stock`, `origin`, `production_type`

**Konum ve Lojistik:**
- `shelf_location`, `supplier_code`

**Künye:**
- `kunye_no`

**Medya:**
- `image_url`, `video_url`, `videos`

### 8.3 Dinamik Alan İşleme

**Editörde:**
```javascript
// Placeholder'ı gerçek değerle değiştir
obj.set('text', product.product_name);

// Kaydetmeden önce placeholder'a geri çevir
obj.set('text', '{{product_name}}');
```

**Render'da:**
```javascript
// TemplateRenderer.js
_replaceDynamicFieldsAsync(product) {
    objects.forEach(obj => {
        if (obj.dynamicField) {
            const fieldKey = obj.dynamicField.replace(/\{\{|\}\}/g, '');
            const value = this._getProductValue(product, fieldKey);
            obj.set('text', String(value));
        }
    });
}
```

### 8.4 Önizleme Değerleri

**Dosya:** `public/assets/js/pages/templates/editor/DynamicFieldsPanel.js`

```javascript
function getFieldPreview(fieldName) {
    const previews = {
        'product_name': 'Örnek Ürün Adı',
        'current_price': '29.99',
        'barcode': '8690000000001',
        // ...
    };
    return previews[fieldName] || '{{' + fieldName + '}}';
}
```

---

## 9. Grid Layout ve Regions

### 9.1 Grid Layout Tipleri

| Layout ID | Ad | Bölge Sayısı | Açıklama |
|-----------|-----|--------------|----------|
| `single` | Tek Alan | 1 | Tüm canvas tek bölge |
| `split-horizontal` | Yatay İkili | 2 | Sol / Sağ |
| `split-vertical` | Dikey İkili | 2 | Üst / Alt |
| `top-two-bottom-one` | Üst 2 Alt 1 | 3 | İki küçük üstte, bir büyük altta |
| `top-one-bottom-two` | Üst 1 Alt 2 | 3 | Bir büyük üstte, iki küçük altta |
| `grid-2x2` | 2x2 Grid | 4 | 4 eşit bölge |
| `grid-3x1` | 3 Sütun | 3 | 3 dikey sütun |
| `header-content` | Başlık + İçerik | 2 | Üst başlık, alt içerik |
| `header-content-footer` | Başlık + İçerik + Alt | 3 | 3 yatay bölge |
| `sidebar-content` | Kenar + İçerik | 2 | Sol kenar, sağ içerik |

### 9.2 Regions Config Yapısı

**Veritabanı:** `regions_config` (TEXT, JSON string)

```json
[
    {
        "id": "region_1",
        "type": "label",
        "x": 0,
        "y": 0,
        "width": 800,
        "height": 640,
        "videoPlaceholder": {
            "x": 0,
            "y": 0,
            "width": 800,
            "height": 400
        }
    },
    {
        "id": "region_2",
        "type": "video",
        "x": 0,
        "y": 640,
        "width": 800,
        "height": 640
    }
]
```

### 9.3 Region Overlay Objeleri

**Özellikler:**
- `isRegionOverlay: true`
- `selectable: false`
- `evented: false`
- `hasControls: false`
- `hasBorders: false`

**Kaydetme:**
- Region overlay objeleri `design_data`'ya **eklenmez**
- Sadece görsel düzenleme için kullanılır

### 9.4 Video Bölgesi İşleme

**Render Sırasında:**
1. `regions_config` parse edilir
2. Video placeholder pozisyonu bulunur
3. Ürün videoları çözümlenir
4. Grid layout'a göre video ve görsel bölgeleri belirlenir
5. Cihaza gönderilir

**Özel Durumlar:**
- **Tek grid + video:** Video overlay modunda (görsel tam ekran, video üstte)
- **Çoklu grid + video:** Video ve görsel ayrı bölgelerde
- **Tam ekran video:** Sadece video gönderilir

---

## 10. Veri Akışı Diyagramları

### 10.1 Şablon Oluşturma Akışı

```
[Kullanıcı]                    [Frontend]                    [Backend]                    [Database]
    |                              |                              |                            |
    |-- Canvas düzenleme --------->|                              |                            |
    |                              |-- Fabric.js canvas           |                            |
    |                              |-- Custom properties          |                            |
    |                              |                              |                            |
    |-- Kaydet butonu ------------>|                              |                            |
    |                              |-- toJSON(CUSTOM_PROPS)       |                            |
    |                              |-- Filter overlays            |                            |
    |                              |-- Generate preview/render    |                            |
    |                              |                              |                            |
    |                              |-- POST /templates ---------->|                            |
    |                              |                              |-- Validate data             |
    |                              |                              |-- Save render_image file    |
    |                              |                              |-- INSERT templates          |
    |                              |                              |<-- Template ID -------------|
    |                              |<-- Template data -------------|                            |
    |<-- Success message ----------|                              |                            |
```

### 10.2 Şablon Render Akışı

```
[Kullanıcı]                    [Frontend]                    [Backend]                    [Device]
    |                              |                              |                            |
    |-- Render butonu ----------->|                              |                            |
    |                              |-- POST /templates/{id}/render|                            |
    |                              |                              |-- Load template            |
    |                              |                              |-- Load product             |
    |                              |                              |-- Resolve media            |
    |                              |                              |-- Prepare render data      |
    |                              |<-- design_data + product ----|                            |
    |                              |                              |                            |
    |                              |-- TemplateRenderer.render()  |                            |
    |                              |-- Load Fabric.js             |                            |
    |                              |-- Create off-screen canvas   |                            |
    |                              |-- Replace placeholders       |                            |
    |                              |-- toDataURL()                |                            |
    |                              |                              |                            |
    |                              |-- POST /templates/{id}/render|                            |
    |                              |   (with rendered_image)      |                            |
    |                              |                              |-- Send to device           |
    |                              |                              |-- HTTP POST to gateway     |
    |                              |                              |                            |
    |                              |<-- Success response ---------|                            |
    |<-- Success message ----------|                              |                            |
```

### 10.3 Export/Import Akışı

```
[Kullanıcı]                    [Frontend]                    [Backend]                    [Database]
    |                              |                              |                            |
    |-- Export butonu ------------>|                              |                            |
    |                              |-- GET /templates/export ----->|                            |
    |                              |                              |-- SELECT templates         |
    |                              |                              |<-- Template data ----------|
    |                              |                              |-- Format export JSON       |
    |                              |<-- Export JSON --------------|                            |
    |<-- Download JSON file -------|                              |                            |
    |                              |                              |                            |
    |-- Import butonu ------------>|                              |                            |
    |-- Select JSON file --------->|                              |                            |
    |                              |-- POST /templates/import ---->|                            |
    |                              |   (file upload)              |-- Parse JSON               |
    |                              |                              |-- Validate data             |
    |                              |                              |-- Check existing           |
    |                              |                              |-- INSERT/UPDATE templates  |
    |                              |                              |<-- Results ----------------|
    |                              |<-- Import results ------------|                            |
    |<-- Success/Error message ----|                              |                            |
```

---

## Ek Bilgiler

### Versiyon Geçmişi

| Tarih | Versiyon | Değişiklik |
|-------|----------|------------|
| 2026-01-30 | 2.0.14 | İlk kapsamlı dokümantasyon |

### İlgili Dokümanlar

- `docs/FABRIC_JS_OBJECT_SCHEMA.md` - Fabric.js obje şema referansı
- `docs/TEMPLATE_JSON_SCHEMA.md` - Şablon JSON yapısı dokümantasyonu

### Notlar

1. **Fabric.js Versiyonu:** Sistem Fabric.js 5.3.0 kullanır. Yükseltme yapılırken dikkatli olunmalıdır.

2. **Custom Properties:** `CUSTOM_PROPS` listesi genişletilirken hem frontend hem backend'de güncellenmelidir.

3. **Render Görselleri:** `render_image` dosyaları firma bazlı izole edilmiştir: `storage/companies/{company_id}/templates/renders/`

4. **Video Placeholder:** Render sırasında video placeholder'lar gizlenir, cihaza gönderimde ayrı bölge olarak işlenir.

5. **Grid Overlay:** Editörde görsel düzenleme için kullanılır, `design_data`'ya kaydedilmez.

---

*Bu doküman Omnex Display Hub v2.0.14 için oluşturulmuştur.*












