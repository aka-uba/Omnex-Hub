# Editor v7 - Fabric.js v7.1.0 Template Editor

Omnex Display Hub için Fabric.js v7.1.0 tabanlı modüler template editor.

> ⚠️ **CDN KULLANILMAZ**
>
> Runtime'da CDN kullanılmaz. Fabric.js `vendor/fabric/fabric.min.js` dosyasından lokal olarak yüklenir.
> Tüm kütüphaneler `public/assets/vendor/` klasöründen sunulur.

## Versiyon

- **Editor**: 7.0.0
- **Fabric.js**: 7.1.0 (lokal: `vendor/fabric/fabric.min.js`)
- **Tarih**: 2026-01-30

## Özellikler

- ✅ Modüler mimari (Core, Factory, Managers, Panels, Components)
- ✅ EventBus tabanlı modüller arası iletişim
- ✅ v5 format geriye uyumluluk (LegacyAdapter)
- ✅ Undo/Redo desteği (HistoryManager)
- ✅ Kopyala/Kes/Yapıştır (ClipboardManager)
- ✅ Grid ve Snap-to-Grid (GridManager)
- ✅ Smart Guides (akıllı hizalama çizgileri)
- ✅ Dinamik alanlar (25+ ürün alanı)
- ✅ Katman yönetimi (LayersPanel)
- ✅ Özellik paneli (PropertyPanel)
- ✅ i18n desteği

## Kurulum

```javascript
// Ana editor import
import { TemplateEditorV7 } from './editor/index.js';

// Editor oluştur
const editor = new TemplateEditorV7({
    container: '#editor-container',
    canvasId: 'template-canvas',
    width: 800,
    height: 1280,
    i18n: (key) => window.__(key),
    onSave: async (data) => {
        // Kaydetme işlemi
        return await api.post('/templates', data);
    }
});

// Başlat
await editor.init();
```

## Dosya Yapısı

```
editor/
├── index.js                    # Ana export dosyası
├── TemplateEditorV7.js         # Ana editor sınıfı
├── README.md                   # Bu dosya
│
├── core/                       # Temel modüller
│   ├── index.js
│   ├── EventBus.js            # Event sistemi
│   ├── CustomProperties.js    # Özel Fabric.js özellikleri
│   ├── FabricExports.js       # Fabric.js class exportları
│   └── LegacyAdapter.js       # v5 format dönüştürücü
│
├── factory/                    # Factory modülleri
│   ├── index.js
│   ├── ObjectFactory.js       # Nesne oluşturucu
│   └── CanvasManager.js       # Canvas yönetimi
│
├── managers/                   # Manager modülleri
│   ├── index.js
│   ├── SelectionManager.js    # Seçim işlemleri
│   ├── HistoryManager.js      # Undo/Redo
│   ├── ClipboardManager.js    # Kopyala/Yapıştır
│   └── GridManager.js         # Grid ve snap
│
├── panels/                     # Panel modülleri
│   ├── index.js
│   ├── PanelBase.js           # Panel temel sınıfı
│   ├── PropertyPanel.js       # Özellik paneli
│   ├── LayersPanel.js         # Katman paneli
│   └── DynamicFieldsPanel.js  # Dinamik alanlar
│
└── components/                 # UI bileşenleri
    ├── index.js
    └── Toolbar.js             # Araç çubuğu
```

## Modül Açıklamaları

### Core Modüller

#### EventBus
```javascript
import { eventBus, EVENTS } from './editor/core/EventBus.js';

// Event dinle
eventBus.on(EVENTS.SELECTION_CREATED, (data) => {
    console.log('Seçim:', data.selected);
});

// Event emit et
eventBus.emit(EVENTS.OBJECT_MODIFIED, { target: object });
```

#### CustomProperties
```javascript
import { CUSTOM_PROPS, setCustomProperty } from './editor/core/CustomProperties.js';

// Özel özellik ekle
setCustomProperty(object, CUSTOM_PROPS.DYNAMIC_FIELD, 'product_name');
```

#### LegacyAdapter
```javascript
import { convertCanvasJSON, loadCanvasWithAdapter, detectVersion } from './editor/core/LegacyAdapter.js';

// JSON formatını tespit et
const { version, isV5, isV7 } = detectVersion(templateData);

// v5 formatını v7'ye dönüştür
const v7Content = convertCanvasJSON(v5Content);

// Canvas'a v7 formatında yükle
await loadCanvasWithAdapter(canvas, v5Content);
```

### Factory Modüller

#### ObjectFactory
```javascript
import { ObjectFactory } from './editor/factory/ObjectFactory.js';

const factory = new ObjectFactory({ canvas });

// Metin oluştur
const text = factory.createText('Merhaba', { fontSize: 24 });

// Dikdörtgen oluştur
const rect = factory.createRect({ width: 100, height: 50 });
```

#### CanvasManager
```javascript
import { CanvasManager } from './editor/factory/CanvasManager.js';

const canvasManager = new CanvasManager({
    canvasId: 'my-canvas',
    width: 800,
    height: 600
});

await canvasManager.init();
const canvas = canvasManager.getCanvas();
```

### Manager Modüller

#### HistoryManager
```javascript
import { HistoryManager } from './editor/managers/HistoryManager.js';

const history = new HistoryManager({ canvas, maxSize: 50 });

// Durumu kaydet
history.saveState();

// Geri al
history.undo();

// İleri al
history.redo();
```

#### ClipboardManager
```javascript
import { ClipboardManager } from './editor/managers/ClipboardManager.js';

const clipboard = new ClipboardManager({ canvas });

clipboard.copy();
clipboard.paste();
clipboard.duplicate();
```

#### GridManager
```javascript
import { GridManager } from './editor/managers/GridManager.js';

const grid = new GridManager({ canvas, gridSize: 20 });

grid.showGrid();
grid.enableSnap();
grid.enableSmartGuides();
```

### Panel Modüller

#### PropertyPanel
```javascript
import { PropertyPanel } from './editor/panels/PropertyPanel.js';

const propertyPanel = new PropertyPanel({
    container: '#property-container',
    canvas: canvas,
    i18n: (key) => translate(key)
});

propertyPanel.mount();
```

#### LayersPanel
```javascript
import { LayersPanel } from './editor/panels/LayersPanel.js';

const layersPanel = new LayersPanel({
    container: '#layers-container',
    canvas: canvas
});

layersPanel.mount();
```

## Keyboard Shortcuts

| Kısayol | İşlem |
|---------|-------|
| Ctrl+Z | Geri Al |
| Ctrl+Y / Ctrl+Shift+Z | İleri Al |
| Ctrl+C | Kopyala |
| Ctrl+X | Kes |
| Ctrl+V | Yapıştır |
| Ctrl+D | Çoğalt |
| Ctrl+A | Tümünü Seç |
| Ctrl+S | Kaydet |
| Ctrl+G | Grid Aç/Kapa |
| Delete | Seçili Sil |
| Escape | Seçimi Temizle |

## Event Listesi

```javascript
// Canvas Events
EVENTS.CANVAS_READY       // Canvas hazır
EVENTS.CANVAS_CLEAR       // Canvas temizlendi
EVENTS.CANVAS_RESIZE      // Canvas boyutu değişti
EVENTS.CANVAS_ZOOM        // Zoom değişti

// Selection Events
EVENTS.SELECTION_CREATED  // Seçim oluşturuldu
EVENTS.SELECTION_UPDATED  // Seçim güncellendi
EVENTS.SELECTION_CLEARED  // Seçim temizlendi

// Object Events
EVENTS.OBJECT_ADDED       // Nesne eklendi
EVENTS.OBJECT_REMOVED     // Nesne silindi
EVENTS.OBJECT_MODIFIED    // Nesne değiştirildi
EVENTS.OBJECT_SCALED      // Nesne ölçeklendi
EVENTS.OBJECT_ROTATED     // Nesne döndürüldü
EVENTS.OBJECT_MOVED       // Nesne taşındı

// History Events
EVENTS.HISTORY_CHANGE     // History değişti
EVENTS.HISTORY_UNDO       // Geri alındı
EVENTS.HISTORY_REDO       // İleri alındı

// Clipboard Events
EVENTS.CLIPBOARD_COPY     // Kopyalandı
EVENTS.CLIPBOARD_CUT      // Kesildi
EVENTS.CLIPBOARD_PASTE    // Yapıştırıldı

// Grid Events
EVENTS.GRID_TOGGLE        // Grid açıldı/kapandı
EVENTS.SNAP_TOGGLE        // Snap açıldı/kapandı

// Template Events
EVENTS.TEMPLATE_LOAD      // Şablon yüklendi
EVENTS.TEMPLATE_SAVE      // Şablon kaydedildi

// Dynamic Field Events
EVENTS.DYNAMIC_FIELD_SELECT // Dinamik alan seçildi
EVENTS.DYNAMIC_FIELD_ADD    // Dinamik alan eklendi
```

## Legacy Format Desteği

v5 formatındaki şablonlar otomatik olarak v7 formatına dönüştürülür:

```javascript
// v5 format (originX: 'left', originY: 'top')
{
    "objects": [{
        "type": "rect",
        "left": 100,
        "top": 100,
        "originX": "left",
        "originY": "top"
    }]
}

// v7 format (originX: 'center', originY: 'center')
{
    "objects": [{
        "type": "Rect",
        "left": 150,  // Merkeze göre hesaplandı
        "top": 125,
        "originX": "center",
        "originY": "center"
    }]
}
```

## Özel Özellikler (Custom Properties)

Her Fabric.js nesnesine eklenebilen özel özellikler:

| Özellik | Açıklama |
|---------|----------|
| `customType` | Nesne tipi (text, rect, barcode, price vb.) |
| `isDataField` | Dinamik alan mı? |
| `dynamicField` | Bağlı dinamik alan (product_name, current_price vb.) |
| `regionId` | Bölge ID'si |
| `slotId` | Slot ID'si (multi-frame için) |
| `inMultiFrame` | Multi-frame içinde mi? |
| `parentFrameId` | Üst frame ID'si |
| `barcodeValue` | Barkod değeri |
| `qrValue` | QR kod değeri |

## Dinamik Alanlar

Desteklenen dinamik alanlar:

**Temel:**
- `product_name` - Ürün adı
- `sku` - Stok kodu
- `barcode` - Barkod
- `description` - Açıklama
- `slug` - URL slug

**Fiyat:**
- `current_price` - Güncel fiyat
- `previous_price` - Eski fiyat
- `vat_rate` - KDV oranı
- `discount_percent` - İndirim yüzdesi
- `campaign_text` - Kampanya metni
- `price_updated_at` - Fiyat güncelleme tarihi
- `price_valid_until` - Fiyat geçerlilik tarihi

**Kategori:**
- `category` - Kategori
- `subcategory` - Alt kategori
- `brand` - Marka

**Detay:**
- `unit` - Birim
- `weight` - Ağırlık
- `stock` - Stok
- `origin` - Menşei
- `production_type` - Üretim tipi

**Konum:**
- `shelf_location` - Raf konumu
- `supplier_code` - Tedarikçi kodu

**Künye:**
- `kunye_no` - HAL künye numarası

**Medya:**
- `image_url` - Ürün görseli

## Lisans

Omnex Display Hub - Tüm hakları saklıdır.
