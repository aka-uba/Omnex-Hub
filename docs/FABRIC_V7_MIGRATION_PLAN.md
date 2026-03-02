# Fabric.js v5 → v7 Migration Plan

**Proje:** Omnex Display Hub - Market Etiket Sistemi
**Tarih:** 2026-01-30
**Mevcut Versiyon:** Fabric.js 5.3.1
**Hedef Versiyon:** Fabric.js 7.1.0

---

## Executive Summary

Bu dokuman, mevcut Fabric.js 5.3.1 tabanli sablon editorunun tamamen yeni bir Fabric.js 7.1.0 tabanli modular yapiya gecisini planlamaktadir. **Upgrade degil, sifirdan yeniden yazim** stratejisi benimsenecektir.

**Temel Prensipler:**
- Mevcut kodu yamalamak yerine temiz mimari
- Fabric.js sadece "render motoru" olacak, is mantigi bizde
- Gelecek surumler (v8+) icin hazir yapi
- Mevcut sablon JSON formati ile geriye uyumluluk (adapter pattern)
- **CDN KULLANILMAYACAK** - Tum paketler lokal olarak kurulacak

**Paket Kurulum Stratejisi:**
- Fabric.js 7.1.0 lokal `/public/assets/vendor/` klasorune yerlestirilecek
- JsBarcode ve qrcodejs kutuphaneleri de lokal olarak kurulacak
- Dis bagimliliklara internet erisimi gerekmeyecek

---

## 1. Mevcut Durum Analizi

### 1.1 Fabric.js 5.3.1 Kullanim Haritasi

#### Mevcut CDN Kullanimi (KALDIRILACAK)
```javascript
// Eski yontem (cdn kullanimi - KALDIRILACAK)
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
document.head.appendChild(script);
```

#### Yeni Lokal Kurulum
```javascript
// Yeni yontem (lokal paket)
// public/assets/vendor/fabric/fabric.min.js
import { Canvas, FabricImage, IText, Rect, ... } from './vendor/fabric/fabric.min.js';
// veya script tag ile
<script src="/assets/vendor/fabric/fabric.min.js"></script>
```

#### Canvas Initialization
```javascript
// Mevcut
new fabric.Canvas('template-canvas', {
    width: preset.width,
    height: preset.height,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true
});
```

#### Kullanilan Object Turleri
| Object Type | Kullanim Alani | v7 Karsiligi |
|-------------|----------------|--------------|
| `fabric.IText` | Duzenlenebilir metin | `IText` (ayni) |
| `fabric.Rect` | Dikdortgen, cerceve | `Rect` (ayni) |
| `fabric.Circle` | Daire | `Circle` (ayni) |
| `fabric.Line` | Cizgi | `Line` (ayni) |
| `fabric.Path` | Ikon, sekil | `Path` (ayni) |
| `fabric.Group` | Gruplama, multi-frame | `Group` (davranis degisti) |
| `fabric.Image` | Gorsel | `FabricImage` (isim degisti) |
| `fabric.Gradient` | Renk gecisleri | `Gradient` (opacity kaldirildi) |
| `fabric.ActiveSelection` | Coklu secim | `ActiveSelection` (ayni) |

#### Canvas Event'leri
| v5 Event | Kullanim | v7 Durumu |
|----------|----------|-----------|
| `selection:created` | Obje secildi | Ayni |
| `selection:updated` | Secim degisti | Ayni |
| `selection:cleared` | Secim kaldirildi | Ayni |
| `object:modified` | Obje degistirildi | Ayni |
| `object:added` | Obje eklendi | Ayni |
| `object:removed` | Obje silindi | Ayni |
| `object:moving` | Obje tasiniyor | Ayni |
| `object:scaling` | Obje olcekleniyor | Ayni |
| `mouse:down` | Mouse basildi | **pointer/viewportPoint** |
| `mouse:move` | Mouse hareket | **scenePoint** |
| `mouse:up` | Mouse birakildi | Ayni |

### 1.2 Custom Properties (CUSTOM_PROPS)

Mevcut kullanilan custom property'ler:
```javascript
[
    'customType',           // Ozel tip: barcode, qrcode, price, video, multi-product-frame
    'isDataField',          // Dinamik alan mi
    'dynamicField',         // Bagli urun alani: product_name, current_price, vb.
    'regionId',             // Grid bolge ID
    'isRegionOverlay',      // Grid overlay objesi (kaydedilmez)
    'isBackground',         // Arka plan objesi (kaydedilmez)
    'isVideoPlaceholder',   // Video placeholder
    'isMultipleVideos',     // Coklu video
    'slots',                // Multi-frame slot listesi
    'frameCols',            // Multi-frame sutun sayisi
    'frameRows',            // Multi-frame satir sayisi
    'activeSlotId',         // Aktif slot
    'slotId',               // Slot ID
    'inMultiFrame',         // Multi-frame icinde
    'parentFrameId',        // Ust frame ID
    'isSlotBackground',     // Slot arka plani
    'isSlotLabel',          // Slot etiketi
    'isSlotPlaceholder',    // Slot placeholder
    'barcodeValue',         // Barkod degeri
    'qrValue',              // QR kod degeri
    'originalBarcodeValue', // Orijinal barkod (terazi kodu)
    'barcodeFormat'         // Barkod formati
]
```

### 1.3 Mevcut Dosya Yapisi

```
public/assets/js/pages/templates/
├── TemplateEditor.js           # Ana editor (5000+ satir) - REFACTOR EDILECEK
├── TemplateList.js             # Liste sayfasi - ETKILENMEYECEK
└── editor/
    ├── DevicePresets.js        # Cihaz boyut presetleri - KORUNACAK
    ├── GridManager.js          # Grid layout yonetimi - YENIDEN YAZILACAK
    ├── PropertyPanel.js        # Eleman ozellikleri - YENIDEN YAZILACAK
    ├── DynamicFieldsPanel.js   # Dinamik alan secici - KORUNACAK
    ├── BackgroundManager.js    # Arka plan yonetimi - YENIDEN YAZILACAK
    ├── EditorHistory.js        # Undo/redo - YENIDEN YAZILACAK
    ├── TemplateIO.js           # Kaydet/yukle - YENIDEN YAZILACAK
    ├── EditorEventHandler.js   # Klavye kisayollari - YENIDEN YAZILACAK
    └── CanvasManager.js        # Zoom/pan - YENIDEN YAZILACAK

services/
├── TemplateRenderer.js         # Client-side render - ADAPTER EKLENECEK
└── RenderWorker.js             # Background render - ADAPTER EKLENECEK
```

---

## 2. Fabric.js v7 Breaking Changes

### 2.1 Kritik Degisiklikler

#### Origin Defaults (EN ONEMLI)
```javascript
// v5 (eski)
originX: 'left', originY: 'top'  // Varsayilan

// v7 (yeni)
originX: 'center', originY: 'center'  // Varsayilan

// Cozum: Canvas init'te explicit set et
const canvas = new Canvas('canvas-id', {
    // ...diger ayarlar
});

// Her obje olusturmada
const rect = new Rect({
    left: 100,
    top: 100,
    originX: 'left',  // Explicit!
    originY: 'top',   // Explicit!
    // ...
});
```

#### Mouse Event Pointer Degisikligi
```javascript
// v5 (eski)
canvas.on('mouse:down', (e) => {
    const pointer = e.pointer;           // KALDIRILDI
    const absPointer = e.absolutePointer; // KALDIRILDI
});

// v7 (yeni)
canvas.on('mouse:down', (e) => {
    const viewportPoint = e.viewportPoint;  // Viewport koordinatlari
    const scenePoint = e.scenePoint;        // Scene koordinatlari
});
```

#### Gradient ColorStop Opacity
```javascript
// v5 (eski)
new Gradient({
    colorStops: [
        { offset: 0, color: 'red', opacity: 0.5 },  // opacity DESTEKLENMEZ
        { offset: 1, color: 'blue', opacity: 1 }
    ]
});

// v7 (yeni)
new Gradient({
    colorStops: [
        { offset: 0, color: 'rgba(255, 0, 0, 0.5)' },  // Alpha renk icinde
        { offset: 1, color: 'rgba(0, 0, 255, 1)' }
    ]
});
```

#### Canvas Method Degisiklikleri
```javascript
// v5 (eski)                    // v7 (yeni)
canvas.getCenter()              → canvas.getCenterPoint()
canvas.setWidth(800)            → canvas.setDimensions({ width: 800 })
canvas.setHeight(600)           → canvas.setDimensions({ height: 600 })
canvas.getPointer(e)            → canvas.getScenePoint(e) / getViewportPoint(e)
```

#### Image Import Degisikligi
```javascript
// v5 (eski)
import { fabric } from 'fabric';
fabric.Image.fromURL(url, callback);

// v7 (yeni)
import { FabricImage, Canvas } from 'fabric';
FabricImage.fromURL(url).then(img => {
    canvas.add(img);
});
```

#### preserveObjectStacking
```javascript
// v5 (eski)
preserveObjectStacking: false  // Varsayilan

// v7 (yeni)
preserveObjectStacking: true   // Varsayilan
```

### 2.2 Mouse Button Event'leri
```javascript
// v7'de varsayilan olarak TRUE
fireMiddleClick: true,    // Orta tik eventi
fireRightClick: true,     // Sag tik eventi
stopContextMenu: true,    // Context menu engelle

// Sadece sol tik istiyorsan
canvas.on('mouse:down', (e) => {
    if (e.button !== 1) return;  // 1 = sol tik
    // ...
});
```

---

## 3. Yeni Mimari Tasarimi

### 3.0 Vendor Paket Yapisi (Lokal Kurulum)

```
public/assets/vendor/
├── fabric/
│   ├── fabric.min.js            # Fabric.js 7.1.0 minified build (~800KB)
│   ├── fabric.js                # Development build (debugging icin)
│   └── LICENSE                  # MIT License
│
├── jsbarcode/
│   ├── JsBarcode.all.min.js     # JsBarcode tum formatlar (~50KB)
│   └── LICENSE                  # MIT License
│
├── qrcode/
│   ├── qrcode.min.js            # qrcodejs library (~15KB)
│   └── LICENSE                  # MIT License
│
├── tabler-icons/
│   ├── tabler-icons.min.css     # Icon CSS (~200KB)
│   ├── fonts/
│   │   ├── tabler-icons.woff2   # WOFF2 font
│   │   ├── tabler-icons.woff    # WOFF font
│   │   └── tabler-icons.ttf     # TTF font
│   └── LICENSE                  # MIT License
│
├── hls/
│   ├── hls.min.js               # HLS.js (~250KB) - PWA Player icin
│   └── LICENSE                  # Apache 2.0
│
├── xlsx/
│   ├── xlsx.full.min.js         # SheetJS (~450KB) - Excel export
│   └── LICENSE                  # Apache 2.0
│
└── README.md                    # Vendor paketleri dokumantasyonu
```

**Toplam Tahmini Boyut:** ~1.8MB (gzip ile ~500KB)

**Vendor README.md Icerigi:**
```markdown
# Vendor Paketleri

Bu klasor, Omnex Display Hub'in kullandigi 3rd-party kutuphanelerini icerir.
CDN yerine lokal kurulum tercih edilmistir.

## Paket Listesi

| Paket | Versiyon | Lisans | Kaynak |
|-------|----------|--------|--------|
| Fabric.js | 7.1.0 | MIT | https://github.com/fabricjs/fabric.js |
| JsBarcode | 3.11.6 | MIT | https://github.com/lindell/JsBarcode |
| qrcodejs | 1.0.0 | MIT | https://github.com/davidshimjs/qrcodejs |
| Tabler Icons | 2.44.0 | MIT | https://github.com/tabler/tabler-icons |
| HLS.js | 1.4.12 | Apache 2.0 | https://github.com/video-dev/hls.js |
| SheetJS | 0.18.5 | Apache 2.0 | https://github.com/SheetJS/sheetjs |

## Guncelleme

Paketleri guncellemek icin:
1. Ilgili GitHub releases sayfasindan yeni surumu indirin
2. Eski dosyalari degistirin
3. Test edin
```

**Kurulum Adimlari:**
1. Fabric.js 7.1.0 indir: https://github.com/fabricjs/fabric.js/releases/tag/v7.1.0
2. `dist/fabric.min.js` dosyasini `public/assets/vendor/fabric/` klasorune kopyala
3. JsBarcode indir: https://github.com/lindell/JsBarcode/releases
4. qrcodejs indir: https://github.com/davidshimjs/qrcodejs
5. Tabler Icons webfont indir: https://github.com/tabler/tabler-icons
6. HLS.js indir (PWA Player icin): https://github.com/video-dev/hls.js
7. SheetJS (xlsx) indir (Excel export icin): https://github.com/SheetJS/sheetjs

**Mevcut CDN Kullanim Yerleri (DEGISTIRILECEK):**

| Dosya | CDN | Lokal Karsilik |
|-------|-----|----------------|
| `index.html` | Tabler Icons CDN | `/assets/vendor/tabler-icons/` |
| `index.html` | JsBarcode CDN | `/assets/vendor/jsbarcode/` |
| `index.html` | qrcodejs CDN | `/assets/vendor/qrcode/` |
| `player/index.html` | HLS.js CDN | `/assets/vendor/hls/` |
| `player/index.html` | qrcodejs CDN | `/assets/vendor/qrcode/` |
| `TemplateEditor.js` | Fabric.js CDN | `/assets/vendor/fabric/` |
| `TemplateRenderer.js` | Fabric.js CDN | `/assets/vendor/fabric/` |
| `RenderWorker.js` | Fabric.js CDN | `/assets/vendor/fabric/` |
| `ExportManager.js` | SheetJS CDN | `/assets/vendor/xlsx/` |
| `ExportManager.js` | Tabler Icons CDN | `/assets/vendor/tabler-icons/` |

**HTML'de Kullanim:**
```html
<!-- Lokal Vendor Paketleri -->
<script src="/assets/vendor/fabric/fabric.min.js"></script>
<script src="/assets/vendor/jsbarcode/JsBarcode.all.min.js"></script>
<script src="/assets/vendor/qrcode/qrcode.min.js"></script>
```

**ES6 Module Import (opsiyonel):**
```javascript
// fabric.min.js UMD build oldugu icin global olarak yuklenir
// Import yapisi:
if (typeof fabric === 'undefined') {
    throw new Error('Fabric.js yuklu degil. Vendor paketini kontrol edin.');
}
const { Canvas, FabricImage, IText, Rect, Circle, Line, Path, Group, Gradient } = fabric;
```

### 3.1 Klasor Yapisi

```
public/assets/js/pages/templates-v7/
├── TemplateEditorV7.js              # Ana orchestrator (slimmed down)
│
├── core/                            # Cekirdek modüller
│   ├── CanvasCore.js                # Canvas init, lifecycle, base config
│   ├── ObjectFactory.js             # Nesne olusturma fabrikasi
│   ├── SelectionManager.js          # Secim yonetimi
│   └── EventBus.js                  # Dahili event sistemi
│
├── managers/                        # Is mantigi yoneticileri
│   ├── HistoryManager.js            # Undo/redo (yeniden yazildi)
│   ├── GridManager.js               # Grid/region yonetimi
│   ├── ZoomPanManager.js            # Zoom ve pan
│   ├── SnappingManager.js           # Snap-to-grid, guidelines
│   ├── KeyboardManager.js           # Klavye kisayollari
│   └── ClipboardManager.js          # Copy/paste
│
├── panels/                          # UI Panel modülleri (sürüklenebilir)
│   ├── PanelBase.js                 # Temel panel sinifi
│   ├── PropertyPanel.js             # Eleman ozellikleri
│   ├── DynamicFieldsPanel.js        # Dinamik alan secici
│   ├── LayersPanel.js               # Katman listesi
│   ├── MultiProductPanel.js         # Coklu urun cercevesi
│   └── BackgroundPanel.js           # Arka plan ayarlari
│
├── objects/                         # Ozel nesne turleri
│   ├── DynamicText.js               # Dinamik metin nesnesi
│   ├── BarcodeObject.js             # Barkod nesnesi
│   ├── QRCodeObject.js              # QR kod nesnesi
│   ├── VideoPlaceholder.js          # Video placeholder
│   └── MultiProductFrame.js         # Coklu urun cercevesi
│
├── serializers/                     # JSON islemleri
│   ├── CanvasSerializer.js          # Canvas -> JSON
│   ├── CanvasDeserializer.js        # JSON -> Canvas
│   ├── LegacyAdapter.js             # v5 JSON uyumluluk
│   └── ExportImportManager.js       # Dosya import/export
│
├── renderers/                       # Render islemleri
│   ├── TemplateRenderer.js          # Client-side render
│   ├── PreviewRenderer.js           # Thumbnail olusturma
│   └── DeviceSender.js              # Cihaza gonderim
│
├── config/                          # Yapilandirma
│   ├── DevicePresets.js             # Cihaz boyutlari (mevcut korunacak)
│   ├── GridLayouts.js               # Grid layout tanimlari
│   ├── DefaultStyles.js             # Varsayilan stiller
│   ├── CustomProperties.js          # Custom property tanimlari (TEK KAYNAK!)
│   └── FabricExports.js             # Fabric.js import alias'lari
│
└── utils/                           # Yardimci fonksiyonlar
    ├── CoordinateUtils.js           # Koordinat donusumleri
    ├── ColorUtils.js                # Renk islemleri
    ├── MathUtils.js                 # Matematiksel hesaplamalar
    └── ValidationUtils.js           # Dogrulama fonksiyonlari
```

### 3.2 Modül Sorumluluk Dagilimi

#### TemplateEditorV7.js (Orchestrator)
- Modülleri yukleme ve baslangic
- Modüller arasi iletisim (EventBus uzerinden)
- UI render (toolbar, layout)
- Route/lifecycle yonetimi

#### core/CanvasCore.js
- Fabric.js v7 Canvas instance olusturma
- Varsayilan ayarlar (origin'ler dahil)
- Canvas resize/dimensions
- Base event binding

#### core/ObjectFactory.js
- Tum nesne turleri icin factory pattern
- Custom property otomatik atama
- Origin normalizasyonu
- Default style uygulama

#### managers/HistoryManager.js
- Undo/redo stack
- State snapshot (sadece icerik objeleri)
- Debounced save
- Memory limit yonetimi

```javascript
// History boyut limiti - dengeli deger
const MAX_HISTORY = 50; // 50 snapshot ≈ yeterli geri alma kapasitesi
```

#### panels/PanelBase.js
- Surukleme (draggable)
- Daraltma/genisletme (collapsible)
- Pozisyon hafiza (localStorage)
- Z-index yonetimi

### 3.3 Event Bus Sistemi (WeakMap ile Memory Leak Onleme)

```javascript
// EventBus.js - WeakMap ile memory leak onleme
class EventBus {
    constructor() {
        this.events = new Map();
        // Context bazli listener'lar icin WeakMap
        // Uzun sure acik kalan editorlerde memory leak riskini azaltir
        this.contextListeners = new WeakMap();
    }

    /**
     * Event dinleyici ekle
     * @param {string} event - Event adi
     * @param {Function} callback - Callback fonksiyonu
     * @param {Object} context - Opsiyonel context (WeakMap ile izlenir)
     */
    on(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = { callback, context };
        this.events.get(event).push(listener);

        // Context varsa WeakMap'e kaydet (garbage collection icin)
        if (context) {
            if (!this.contextListeners.has(context)) {
                this.contextListeners.set(context, []);
            }
            this.contextListeners.get(context).push({ event, callback });
        }
    }

    /**
     * Event dinleyici kaldir
     */
    off(event, callback) {
        if (!this.events.has(event)) return;

        const listeners = this.events.get(event);
        const index = listeners.findIndex(l => l.callback === callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Bir context'e ait tum listener'lari kaldir
     * Panel/manager destroy edildiginde cagirilmali
     */
    offContext(context) {
        const contextEvents = this.contextListeners.get(context);
        if (!contextEvents) return;

        contextEvents.forEach(({ event, callback }) => {
            this.off(event, callback);
        });

        // WeakMap'ten silmeye gerek yok, GC halleder
    }

    /**
     * Event emit et
     * NOT: Listener listesini KOPYALAYARAK iterate et
     * Emit sirasinda listener eklenirse/cikarilirsa sorun olmaz
     */
    emit(event, data) {
        if (!this.events.has(event)) return;

        // ONEMLI: Listeyi kopyala - emit sirasinda mutation guvenli
        [...this.events.get(event)].forEach(({ callback, context }) => {
            try {
                callback.call(context, data);
            } catch (error) {
                console.error(`EventBus error in ${event}:`, error);
            }
        });
    }

    /**
     * Tek seferlik event dinleyici
     */
    once(event, callback, context = null) {
        const wrapper = (data) => {
            callback.call(context, data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper, context);
    }

    /**
     * Tum event'leri temizle (editor destroy'da cagirilir)
     */
    destroy() {
        this.events.clear();
        // WeakMap otomatik temizlenir
    }
}

// Kullanim ornegi
eventBus.on('object:selected', (obj) => {
    propertyPanel.updateForObject(obj);
    layersPanel.highlightObject(obj);
}, this); // context ile

// Destroy'da
eventBus.offContext(this); // Bu panel'in tum listener'lari temizlenir
```

### 3.4 CustomProperties.js - TEK KAYNAK PRENSIBI

String tekrarlarini bitirmek icin tum custom property'ler tek dosyada tanimlanir:

```javascript
// config/CustomProperties.js
// TEK KAYNAK - Tum moduller buradan import etmeli!

/**
 * Fabric.js object'lerine eklenen custom property'ler
 * toJSON ve loadFromJSON'da korunmasi gereken alanlar
 */
export const CUSTOM_PROPS = Object.freeze({
    // Temel tipler
    CUSTOM_TYPE: 'customType',
    IS_DATA_FIELD: 'isDataField',
    DYNAMIC_FIELD: 'dynamicField',
    REGION_ID: 'regionId',

    // Transient (kaydedilmeyecek) objeler
    IS_REGION_OVERLAY: 'isRegionOverlay',
    IS_BACKGROUND: 'isBackground',

    // Video
    IS_VIDEO_PLACEHOLDER: 'isVideoPlaceholder',
    IS_MULTIPLE_VIDEOS: 'isMultipleVideos',

    // Multi-frame
    SLOTS: 'slots',
    FRAME_COLS: 'frameCols',
    FRAME_ROWS: 'frameRows',
    ACTIVE_SLOT_ID: 'activeSlotId',
    SLOT_ID: 'slotId',
    IN_MULTI_FRAME: 'inMultiFrame',
    PARENT_FRAME_ID: 'parentFrameId',
    IS_SLOT_BACKGROUND: 'isSlotBackground',
    IS_SLOT_LABEL: 'isSlotLabel',
    IS_SLOT_PLACEHOLDER: 'isSlotPlaceholder',

    // Barkod/QR
    BARCODE_VALUE: 'barcodeValue',
    QR_VALUE: 'qrValue',
    ORIGINAL_BARCODE_VALUE: 'originalBarcodeValue',
    BARCODE_FORMAT: 'barcodeFormat'
});

/**
 * toJSON ve loadFromJSON icin property listesi (dizi olarak)
 */
export const EXPORT_PROPS = Object.freeze(Object.values(CUSTOM_PROPS));

/**
 * Transient objeler - History ve kaydetmede haric tutulacak
 */
export const TRANSIENT_PROPS = Object.freeze([
    CUSTOM_PROPS.IS_REGION_OVERLAY,
    CUSTOM_PROPS.IS_BACKGROUND,
    CUSTOM_PROPS.IS_SLOT_PLACEHOLDER
]);

/**
 * Objenin transient olup olmadigini kontrol et
 */
export function isTransient(obj) {
    return TRANSIENT_PROPS.some(prop => obj[prop] === true);
}

/**
 * Custom type kontrolleri
 */
export const CUSTOM_TYPES = Object.freeze({
    DYNAMIC_TEXT: 'dynamic-text',
    BARCODE: 'barcode',
    QRCODE: 'qrcode',
    VIDEO: 'video',
    MULTI_PRODUCT_FRAME: 'multi-product-frame',
    PRICE: 'price',
    IMAGE: 'image'
});
```

**Kullanim:**
```javascript
import { CUSTOM_PROPS, EXPORT_PROPS, isTransient, CUSTOM_TYPES } from '../config/CustomProperties.js';

// Obje olusturmada
const obj = new IText('Metin', {
    [CUSTOM_PROPS.CUSTOM_TYPE]: CUSTOM_TYPES.DYNAMIC_TEXT,
    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
    [CUSTOM_PROPS.DYNAMIC_FIELD]: 'product_name'
});

// Kaydetmede
canvas.toJSON(EXPORT_PROPS);

// History'de filtreleme
const historyObjects = canvas.getObjects().filter(obj => !isTransient(obj));
```

### 3.5 FabricExports.js - Import Alias Dosyasi

Fabric v7 importlari verbose olabilir. Tek dosyadan sadeslestirilmis export:

```javascript
// config/FabricExports.js
// Fabric.js v7 siniflarini tek noktadan export et

// ============================================================
// ONEMLI NOT: fabric.min.js UMD build oldugu icin global'den aliyoruz
// ESM build KULLANILMIYOR (bilincli karar - browser uyumlulugu icin)
// Ileride biri "neden import etmiyoruz?" diye sorarsa: UMD = global
// ============================================================

// Global fabric objesi kontrolu
if (typeof fabric === 'undefined') {
    throw new Error('Fabric.js yuklu degil. Vendor paketini kontrol edin.');
}

// Canvas
export const Canvas = fabric.Canvas;
export const StaticCanvas = fabric.StaticCanvas;

// Temel objeler
export const FabricObject = fabric.FabricObject;
export const FabricImage = fabric.FabricImage;
export const IText = fabric.IText;
export const Textbox = fabric.Textbox;

// Sekiller
export const Rect = fabric.Rect;
export const Circle = fabric.Circle;
export const Ellipse = fabric.Ellipse;
export const Line = fabric.Line;
export const Polyline = fabric.Polyline;
export const Polygon = fabric.Polygon;
export const Triangle = fabric.Triangle;
export const Path = fabric.Path;

// Gruplama
export const Group = fabric.Group;
export const ActiveSelection = fabric.ActiveSelection;

// Gradientler
export const Gradient = fabric.Gradient;
export const Pattern = fabric.Pattern;

// Utilities
export const util = fabric.util;
export const Point = fabric.Point;
export const Color = fabric.Color;

// Tum fabric objesi (nadiren gerekli)
export { fabric };

// Versiyon kontrolu
export const FABRIC_VERSION = fabric.version || '7.1.0';
console.log(`Fabric.js v${FABRIC_VERSION} yuklendi`);
```

**Kullanim:**
```javascript
// Onceki (verbose)
if (typeof fabric === 'undefined') throw new Error('...');
const { Canvas, IText, Rect, Circle, FabricImage, Group, Gradient } = fabric;

// Sonraki (temiz)
import { Canvas, IText, Rect, Circle, FabricImage, Group, Gradient } from '../config/FabricExports.js';
```

---

## 4. Surukleneblir Panel Sistemi

### 4.1 Panel Ozellikleri

Her panel asagidaki ozelliklere sahip olacak:
- **Surukleme:** Tasarim alaninda istenen yere tasima
- **Daraltma:** Sadece baslik gorunsun (collapse)
- **Genisletme:** Tam icerik gorunsun (expand)
- **Sabitleme:** Kenara yapistirma (dock)
- **Pozisyon Hafiza:** Sayfa yenilendiginde son konum

### 4.2 PanelBase.js

```javascript
export class PanelBase {
    constructor(options) {
        this.id = options.id;
        this.title = options.title;
        this.icon = options.icon;
        this.defaultPosition = options.position || { x: 100, y: 100 };
        this.collapsible = options.collapsible !== false;
        this.draggable = options.draggable !== false;
        this.minWidth = options.minWidth || 250;
        this.maxWidth = options.maxWidth || 400;

        this.isCollapsed = false;
        this.isDragging = false;
        this.element = null;
    }

    render() {
        return `
            <div class="editor-panel" id="${this.id}"
                 style="left: ${this.defaultPosition.x}px; top: ${this.defaultPosition.y}px;">
                <div class="panel-header" data-draggable="true">
                    <div class="panel-title">
                        <i class="ti ti-${this.icon}"></i>
                        <span>${this.title}</span>
                    </div>
                    <div class="panel-controls">
                        ${this.collapsible ? `
                            <button class="panel-toggle" title="Daralt/Genislet">
                                <i class="ti ti-chevron-up"></i>
                            </button>
                        ` : ''}
                        <button class="panel-close" title="Kapat">
                            <i class="ti ti-x"></i>
                        </button>
                    </div>
                </div>
                <div class="panel-body">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    renderContent() {
        // Alt siniflar override edecek
        return '';
    }

    bindEvents() {
        // Surukleme
        // Daraltma/genisletme
        // Pozisyon kaydetme
    }

    savePosition() {
        const rect = this.element.getBoundingClientRect();
        localStorage.setItem(`panel_${this.id}_pos`, JSON.stringify({
            x: rect.left,
            y: rect.top,
            collapsed: this.isCollapsed
        }));
    }

    loadPosition() {
        const saved = localStorage.getItem(`panel_${this.id}_pos`);
        if (saved) {
            const pos = JSON.parse(saved);
            this.element.style.left = `${pos.x}px`;
            this.element.style.top = `${pos.y}px`;
            if (pos.collapsed) this.collapse();
        }
    }
}
```

### 4.3 Panel CSS

```css
.editor-panel {
    position: absolute;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 250px;
    max-width: 400px;
    z-index: 100;
    overflow: hidden;
    transition: height 0.2s ease;
}

.editor-panel.collapsed {
    height: auto;
}

.editor-panel.collapsed .panel-body {
    display: none;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    cursor: grab;
    user-select: none;
}

.panel-header:active {
    cursor: grabbing;
}

.panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.875rem;
}

.panel-controls {
    display: flex;
    gap: 4px;
}

.panel-controls button {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 0.15s;
}

.panel-controls button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.panel-body {
    padding: 12px;
    max-height: 60vh;
    overflow-y: auto;
}

/* Drag overlay */
.editor-panel.dragging {
    opacity: 0.8;
    z-index: 1000;
}
```

---

## 5. Object Factory Pattern

### 5.1 ObjectFactory.js

```javascript
import { IText, Rect, Circle, Line, Path, Group, FabricImage, Gradient } from 'fabric';
import { CUSTOM_DEFAULTS, ORIGIN_DEFAULTS } from '../config/DefaultStyles.js';

export class ObjectFactory {
    constructor(canvas) {
        this.canvas = canvas;
    }

    /**
     * Temel object olusturma
     */
    _applyDefaults(options) {
        return {
            // v7 icin kritik: origin'leri explicit set et
            originX: ORIGIN_DEFAULTS.originX,
            originY: ORIGIN_DEFAULTS.originY,
            // Secilebilirlik
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            // Custom props
            customType: null,
            isDataField: false,
            dynamicField: null,
            regionId: null,
            ...options
        };
    }

    /**
     * Metin olustur
     */
    createText(text, options = {}) {
        const mergedOptions = this._applyDefaults({
            text,
            fontSize: 24,
            fill: '#000000',
            fontFamily: 'Arial',
            ...options
        });

        const textObj = new IText(text, mergedOptions);
        return textObj;
    }

    /**
     * Dinamik metin olustur
     */
    createDynamicText(fieldKey, options = {}) {
        const placeholder = this._getFieldPlaceholder(fieldKey);
        const obj = this.createText(placeholder, {
            ...options,
            customType: 'dynamic-text',
            isDataField: true,
            dynamicField: fieldKey,
            _originalPlaceholder: placeholder
        });
        return obj;
    }

    /**
     * Dikdortgen olustur
     */
    createRect(options = {}) {
        const mergedOptions = this._applyDefaults({
            width: 100,
            height: 100,
            fill: '#228be6',
            stroke: null,
            strokeWidth: 0,
            ...options
        });

        return new Rect(mergedOptions);
    }

    /**
     * Daire olustur
     */
    createCircle(options = {}) {
        const mergedOptions = this._applyDefaults({
            radius: 50,
            fill: '#228be6',
            stroke: null,
            strokeWidth: 0,
            ...options
        });

        return new Circle(mergedOptions);
    }

    /**
     * Gorsel olustur (async)
     * ONEMLI: Canvas destroy edilmisse image resolve oldugunda crash onlenir
     */
    async createImage(url, options = {}) {
        const img = await FabricImage.fromURL(url);

        // Lifecycle guard: Canvas destroy edilmis olabilir
        if (!this.canvas || this.canvas._disposed) {
            console.warn('ObjectFactory: Canvas disposed, image not added');
            return null;
        }

        const mergedOptions = this._applyDefaults(options);

        Object.keys(mergedOptions).forEach(key => {
            img.set(key, mergedOptions[key]);
        });

        return img;
    }

    /**
     * Barkod olustur (async)
     */
    async createBarcode(value, options = {}) {
        // JsBarcode ile SVG olustur
        const svgData = this._generateBarcodeSVG(value, options.format || 'EAN13');
        const img = await this.createImage(svgData, {
            ...options,
            customType: 'barcode',
            barcodeValue: value,
            barcodeFormat: options.format || 'EAN13'
        });
        return img;
    }

    /**
     * QR kod olustur (async)
     */
    async createQRCode(value, options = {}) {
        const dataUrl = await this._generateQRCodeDataUrl(value, options);
        const img = await this.createImage(dataUrl, {
            ...options,
            customType: 'qrcode',
            qrValue: value
        });
        return img;
    }

    /**
     * Video placeholder olustur
     */
    createVideoPlaceholder(options = {}) {
        const width = options.width || 400;
        const height = options.height || 300;

        // Grup olarak olustur
        const bg = new Rect({
            width,
            height,
            fill: '#1a1a2e',
            originX: 'center',
            originY: 'center'
        });

        // Play ikonu
        const playIcon = new Path('M8 5v14l11-7z', {
            fill: '#ffffff',
            scaleX: 3,
            scaleY: 3,
            originX: 'center',
            originY: 'center'
        });

        const group = new Group([bg, playIcon], this._applyDefaults({
            ...options,
            customType: 'video',
            isVideoPlaceholder: true,
            width,
            height
        }));

        return group;
    }

    /**
     * Coklu urun cercevesi olustur
     */
    createMultiProductFrame(cols, rows, options = {}) {
        const width = options.width || 400;
        const height = options.height || 600;
        const slotWidth = width / cols;
        const slotHeight = height / rows;

        const slots = [];
        const objects = [];

        // Her slot icin
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotId = row * cols + col + 1;
                const x = col * slotWidth - width / 2 + slotWidth / 2;
                const y = row * slotHeight - height / 2 + slotHeight / 2;

                // Slot arka plani
                const slotBg = new Rect({
                    width: slotWidth - 4,
                    height: slotHeight - 4,
                    fill: '#f8f9fa',
                    stroke: '#dee2e6',
                    strokeWidth: 1,
                    left: x,
                    top: y,
                    originX: 'center',
                    originY: 'center',
                    isSlotBackground: true,
                    slotId
                });
                objects.push(slotBg);

                // Slot bilgisi
                slots.push({
                    id: slotId,
                    col, row,
                    x, y,
                    width: slotWidth - 4,
                    height: slotHeight - 4,
                    fields: []
                });
            }
        }

        const group = new Group(objects, this._applyDefaults({
            ...options,
            customType: 'multi-product-frame',
            frameCols: cols,
            frameRows: rows,
            slots,
            activeSlotId: 1,
            width,
            height
        }));

        return group;
    }

    // Private helpers
    _getFieldPlaceholder(fieldKey) {
        const previews = {
            'product_name': 'Ornek Urun Adi',
            'current_price': '29.99',
            'previous_price': '39.99',
            'barcode': '8690000000001',
            'sku': 'SKU-001',
            'unit': 'kg',
            'origin': 'Turkiye',
            'category': 'Meyve-Sebze',
            'brand': 'Marka',
            'kunye_no': 'HAL-XXXXX'
        };
        return previews[fieldKey] || `{{${fieldKey}}}`;
    }

    _generateBarcodeSVG(value, format) {
        // JsBarcode entegrasyonu
        // ...
    }

    async _generateQRCodeDataUrl(value, options) {
        // qrcodejs entegrasyonu
        // ...
    }
}
```

---

## 6. Legacy JSON Adapter

### 6.1 LegacyAdapter.js

Mevcut Fabric v5 JSON'larini v7 formatina donusturur.

```javascript
export class LegacyAdapter {
    /**
     * v5 JSON'u v7 formatina donustur
     */
    static adapt(json) {
        if (!json || !json.objects) return json;

        // Versiyon kontrolu
        const version = json.version || '5.0.0';
        const majorVersion = parseInt(version.split('.')[0]);

        if (majorVersion >= 7) {
            // Zaten v7+, degisiklik gerekmez
            return json;
        }

        // v5 -> v7 donusumu
        const adapted = {
            ...json,
            version: '7.1.0',
            objects: json.objects.map(obj => this._adaptObject(obj))
        };

        return adapted;
    }

    /**
     * Tek bir objeyi adapt et
     */
    static _adaptObject(obj) {
        const adapted = { ...obj };

        // Origin kontrolu - v5'te explicit degilse varsayilan left/top idi
        if (adapted.originX === undefined) {
            adapted.originX = 'left';
        }
        if (adapted.originY === undefined) {
            adapted.originY = 'top';
        }

        // Image type kontrolu
        if (adapted.type === 'image') {
            adapted.type = 'image'; // v7'de de 'image' kaldi
        }

        // Gradient colorStop opacity kontrolu
        if (adapted.fill && typeof adapted.fill === 'object' && adapted.fill.colorStops) {
            adapted.fill.colorStops = adapted.fill.colorStops.map(stop => {
                if (stop.opacity !== undefined && stop.opacity < 1) {
                    // Opacity'i renk alpha'sina cevir
                    return {
                        ...stop,
                        color: this._addAlphaToColor(stop.color, stop.opacity)
                    };
                }
                return stop;
            });
        }

        // Grup icindeki objeler
        if (adapted.objects && Array.isArray(adapted.objects)) {
            adapted.objects = adapted.objects.map(child => this._adaptObject(child));
        }

        return adapted;
    }

    /**
     * Renge alpha ekle
     */
    static _addAlphaToColor(color, opacity) {
        // Hex'i rgba'ya cevir
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        // rgb'yi rgba'ya cevir
        if (color.startsWith('rgb(')) {
            return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
        }
        return color;
    }

    /**
     * v7 JSON'u v5 formatina donustur (geriye uyumluluk)
     */
    static convertToLegacy(json) {
        // Eger eski sistemlerle uyumluluk gerekirse
        // ...
    }
}
```

---

## 7. Migration Adimlari

### ✅ Phase 0: Vendor Paketleri Kurulumu (TAMAMLANDI - 2026-01-30)

0. **Lokal paketleri indir ve yerles** ✅
   - ✅ `public/assets/vendor/` klasorunu olustur
   - ✅ Fabric.js 7.1.0 indir ve yerles
   - ✅ JsBarcode indir ve yerles
   - ✅ qrcodejs indir ve yerles
   - ✅ LICENSE dosyalarini ekle
   - ✅ Vendor README.md dokumantasyonu yaz
   - ✅ Global scope değişkenleri tablosu eklendi
   - ✅ CDN uyarısı eklendi

**Phase 0 Kontrol Sonuçları:**
- Runtime'da CDN kullanılmıyor - tüm kütüphaneler vendor/ klasöründen
- RenderWorker.js, TemplateRenderer.js, TemplateEditor.js vendor path kullanıyor
- Service Worker vendor dosyalarını dinamik olarak cache'e alıyor
- Global scope: window.fabric, window.JsBarcode, window.QRCode, window.XLSX, window.Hls

### ✅ Phase 1: Core Modüller (TAMAMLANDI - 2026-01-30)

1. **Yeni klasor yapisi** ✅
   - ✅ `editor-v7/` klasorunu olustur
   - ✅ Modüler dosya yapısı oluşturuldu

2. **EventBus ve Core modulleri** ✅
   - ✅ `core/EventBus.js` - WeakMap ile memory leak önleme
   - ✅ `core/CustomProperties.js` - CUSTOM_PROPS enum + helper fonksiyonlar
   - ✅ `core/FabricExports.js` - Fabric.js v7 class exports
   - ✅ `core/LegacyAdapter.js` - v5→v7 format dönüşümü
   - ✅ `core/index.js` - Core modül exports

### ✅ Phase 2: Factory Modülleri (TAMAMLANDI - 2026-01-30)

3. **Factory modulleri** ✅
   - ✅ `factory/ObjectFactory.js` - Nesne oluşturma fabrikası
   - ✅ `factory/CanvasManager.js` - Canvas init, zoom, pan
   - ✅ `factory/index.js` - Factory exports

### ✅ Phase 3: Manager Modülleri (TAMAMLANDI - 2026-01-30)

4. **Temel manager'lar** ✅
   - ✅ `managers/SelectionManager.js` - Seçim yönetimi
   - ✅ `managers/HistoryManager.js` - Undo/redo stack
   - ✅ `managers/ClipboardManager.js` - Copy/cut/paste
   - ✅ `managers/GridManager.js` - Grid ve snap-to-grid
   - ✅ `managers/index.js` - Manager exports

### ✅ Phase 4: Panel Modülleri (TAMAMLANDI - 2026-01-30)

5. **Panel sistemi** ✅
   - ✅ `panels/PanelBase.js` - Sürüklenebilir panel base class
   - ✅ `panels/PropertyPanel.js` - Eleman özellikleri paneli
   - ✅ `panels/LayersPanel.js` - Katman yönetimi paneli
   - ✅ `panels/DynamicFieldsPanel.js` - Dinamik alan seçici
   - ✅ `panels/index.js` - Panel exports

### ✅ Phase 5: Main Editor (TAMAMLANDI - 2026-01-30)

6. **Ana Editor ve Bileşenler** ✅
   - ✅ `TemplateEditorV7.js` - Ana orchestrator sınıfı
   - ✅ `components/Toolbar.js` - Araç çubuğu bileşeni
   - ✅ `components/index.js` - Component exports
   - ✅ `index.js` - Ana export dosyası (tüm modüller)
   - ✅ `README.md` - Editor v7 dokümantasyonu
   - ✅ `test-imports.js` - Import doğrulama testi

7. **Export/Import Hizalaması** ✅
   - ✅ FabricExports export isimleri düzeltildi
   - ✅ CustomProperties helper fonksiyonları eklendi
   - ✅ LegacyAdapter default + named exports düzeltildi
   - ✅ TemplateEditorV7.js import'ları düzeltildi

### ✅ Phase 6: Entegrasyon ve Test (TAMAMLANDI - 2026-01-30)

8. **Route Entegrasyonu**
   - ✅ app.js'de loadProtectedPage ve loadPage metodlarına options parametresi eklendi
   - ✅ EditorWrapper.js oluşturuldu (v5/v7 geçiş wrapper'ı)
   - ✅ Feature flag sistemi eklendi (config/FeatureFlags.js)
   - ✅ v7-specific route'lar eklendi (/templates/editor-v7, /templates/:id/edit-v7)
   - ✅ i18n entegrasyonu (editor.loading, editor.loadError çevirileri)
   - ✅ CSS stilleri eklendi (.editor-wrapper, .editor-loading, .editor-error)

9. **Feature Flag Mekanizması**
   - ✅ localStorage: 'omnex_editor_v7' = 'true'/'false'
   - ✅ URL param: ?editor=v7 veya ?editor=v5
   - ✅ Config default: FeatureFlags.EDITOR_V7_ENABLED
   - ✅ forceV7 option ile route-based bypass

### 🔲 Phase 7: Test ve Production (BEKLEMEDE)

10. **Mevcut Şablon Testleri**
    - [ ] v5 formatındaki şablonları LegacyAdapter ile yükle
    - [ ] Kaydet/yükle döngüsü testi
    - [ ] Cihaza gönderim testi

11. **Production Geçişi**
    - [ ] Feature flag aktifleştirme (FeatureFlags.EDITOR_V7_ENABLED = true)
    - [ ] Eski editor devre dışı bırakma
    - [ ] Temizlik

---

## 8. Geriye Uyumluluk

### 8.1 Mevcut Sablonlar

- LegacyAdapter ile v5 JSON otomatik v7'ye cevirilecek
- Kaydetme sirasinda v7 formati kullanilacak
- Eski render API'leri calismaya devam edecek

### 8.2 API Uyumlulugu

- `/api/templates` endpoint'leri degismeyecek
- `design_data` alani JSON string olarak kalacak
- `preview_image` ve `render_image` ayni formatta

### 8.3 Render Servisleri

- `TemplateRenderer.js` v7 ile guncellenecek
- `RenderWorker.js` adapter ile calismaya devam edecek
- Server-side render etkilenmeyecek

---

## 9. Risk Analizi

### 9.1 Yuksek Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| Origin degisikligi | Mevcut sablonlar bozuk gorunur | LegacyAdapter ile explicit origin |
| Group davranis degisikligi | Multi-frame bozulabilir | Kapsamli test |
| Event data yapisi | Mouse islemleri bozulur | Erken refactor |

### 9.2 Orta Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| Gradient opacity | Renkler farkli gorunur | ColorStop adapter |
| Canvas method'lar | Eski kod patlar | Wrapper functions |
| Performance | v7 daha agir olabilir | Profiling |

### 9.3 Dusuk Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| Browser uyumlulugu | Eski browser'lar | Zaten modern browser'lar destekleniyor |
| Node.js version | Server-side render | Node 20+ zaten kullaniliyor |

---

## 9.4 KRITIK UYARILAR ⚠️

### ⚠️ HistoryManager = EN RISKLI MODUL

Undo/redo Fabric 7'de hala "pain point". Dikkat edilmesi gerekenler:

**Onerilen Yaklasim:**
```javascript
// Object clone YERINE JSON snapshot kullan
history.push({
    type: 'object:modified',
    payload: canvas.toDatalessJSON(EXPORT_PROPS),
    timestamp: Date.now()
});
```

**Transient Objeler ASLA History'ye Alinmamali:**
```javascript
// Bu objeler history'den haric tutulmali:
const TRANSIENT_TYPES = [
    'isRegionOverlay',  // Grid overlay
    'isBackground',     // Arka plan
    'isSlotPlaceholder' // Slot placeholder
];

// History kaydetmeden once filtrele
const filteredObjects = canvas.getObjects().filter(obj =>
    !TRANSIENT_TYPES.some(prop => obj[prop] === true)
);
```

**Debounce Ayari Kritik:**
```javascript
// Cok kisa = gereksiz kayit
// Cok uzun = ara adimlar kaybolur
// Onerilen: 150-250ms
const HISTORY_DEBOUNCE = 200;
```

**Group Icindeki Child Degisiklikleri:**
```javascript
// Group.on('object:modified') calismayabilir!
// Alternatif: canvas seviyesinde izle
canvas.on('object:modified', (e) => {
    const target = e.target;
    if (target.group) {
        // Parent group'u da dirty olarak isaretle
        this._markGroupDirty(target.group);
    }
});
```

### ⚠️ Group + MultiProductFrame UYARISI

Fabric 7'de Group davranisi farkli:
- Transform davranisi degisti
- Child'larin left/top anlami farkli olabilir

**Onerilen Strateji:**

1. **CustomClass Dusunulmeli:**
```javascript
// Ileride MultiProductFrame icin ozel sinif
class MultiProductFrame extends fabric.Group {
    // Slot bazli hareket kontrolu
    // Child transform override
}
```

2. **Slot Bazli Hareket Kisitlamasi:**
```javascript
// Group icindeki objeleri ASLA serbest birakma
// Sadece slot bazli hareket izni ver
slotObject.set({
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    hasControls: false
});
```

3. **Test Onceligi:**
   - Bu kisim testte en cok patlayan yer olur
   - Multi-frame + barcode + text kombinasyonlarini ozellikle test et

4. **CustomClass Gecis Notu:**
   - Phase 4 sonrasi stabilizasyon tamamlaninca CustomClass'a refactor edilebilir
   - Ilk surum Group + custom props ile calisacak, kanitlanmis stabilite sonrasi CustomClass'a gecis planlanabilir

### ⚠️ Performance Hedefleri - GERCEKCI BEKLENTILER

**Orijinal Hedef:** Canvas render < 16ms (60fps)

**Gercekci Durum:**
- Cok objeli sahnelerde zor
- Multi-frame + barcode + text varken hedef tutulamayabilir

**Optimizasyon Stratejileri:**
```javascript
// 1. renderOnAddRemove = false
canvas.renderOnAddRemove = false;

// 2. Batch update + requestRenderAll
canvas.renderOnAddRemove = false;
objects.forEach(obj => canvas.add(obj));
canvas.requestRenderAll();

// 3. Zoom sirasinda selection kapatma
canvas.on('mouse:wheel', () => {
    canvas.discardActiveObject();
    canvas.selection = false;
    // Zoom tamamlandiktan sonra geri ac
    clearTimeout(this._zoomTimeout);
    this._zoomTimeout = setTimeout(() => {
        canvas.selection = true;
    }, 100);
});

// 4. Object caching
const obj = new Rect({
    objectCaching: true,  // Default true in v7
    statefullCache: false // Performans icin false
});
```

**Performans Hedefleri (Revize):**
- Basit sahneler (<20 obje): < 16ms (60fps) ✅
- Orta sahneler (20-50 obje): < 33ms (30fps) ✅
- Karmasik sahneler (50+ obje): < 50ms (20fps) - kabul edilebilir
- Multi-frame + barkod: < 100ms - beklenen

---

## 10. Basari Kriterleri

### Fonksiyonel
- [ ] Mevcut tum sablonlar yuklenir
- [ ] Yeni sablon olusturulabilir
- [ ] Tum nesne turleri calisiyor
- [ ] Kaydet/yukle dongusu sorunsuz
- [ ] Undo/redo calisiyor
- [ ] Cihaza gonderim calisiyor

### Performans (Revize Hedefler)
- [ ] Basit sahneler (<20 obje): Canvas render < 16ms (60fps)
- [ ] Orta sahneler (20-50 obje): Canvas render < 33ms (30fps)
- [ ] Karmasik sahneler (50+ obje): Canvas render < 50ms (kabul edilebilir)
- [ ] Undo/redo < 100ms
- [ ] Sablon yukleme < 500ms
- [ ] Kaydetme < 1s
- [ ] Multi-frame + barkod render < 100ms

### Kullanici Deneyimi
- [ ] Paneller suruklenebilir
- [ ] Paneller daraltilabilir
- [ ] Pozisyon hafizasi calisiyor
- [ ] Klavye kisayollari calisiyor

---

## Ek: v5 → v7 Property Mapping

| v5 Property | v7 Property | Notlar |
|-------------|-------------|--------|
| `originX: 'left'` | `originX: 'left'` | Explicit gerekli |
| `originY: 'top'` | `originY: 'top'` | Explicit gerekli |
| `fabric.Image` | `FabricImage` | Import ismi degisti |
| `canvas.getCenter()` | `canvas.getCenterPoint()` | Method ismi |
| `canvas.setWidth(w)` | `canvas.setDimensions({width:w})` | Method degisti |
| `e.pointer` | `e.viewportPoint` | Event data |
| `e.absolutePointer` | `e.scenePoint` | Event data |
| `colorStop.opacity` | Alpha in color | Gradient yapisi |
| `preserveObjectStacking: false` | `preserveObjectStacking: true` | Varsayilan degisti |
| `fireRightClick: false` | `fireRightClick: true` | Varsayilan degisti |

---

## 11. Zaman Cizelgesi Ozeti

```
HAFTA 0: Vendor Paketleri Kurulumu (1 gün)
├─ Fabric.js 7.1.0 indir ve yerles
├─ Diger vendor paketleri kur
└─ CDN referanslarini kaldir

HAFTA 1: Hazirlik ve Core Moduller
├─ Klasor yapisi olustur
├─ EventBus.js, CanvasCore.js, ObjectFactory.js
└─ Config dosyalari

HAFTA 2-3: Manager Moduller
├─ HistoryManager.js
├─ ZoomPanManager.js
├─ SelectionManager.js
├─ KeyboardManager.js
└─ ClipboardManager.js

HAFTA 4: Object Turleri
├─ DynamicText.js
├─ BarcodeObject.js
├─ QRCodeObject.js
├─ VideoPlaceholder.js
└─ MultiProductFrame.js

HAFTA 5: UI Paneller
├─ PanelBase.js (surukleme/daraltma)
├─ PropertyPanel.js
├─ DynamicFieldsPanel.js
├─ LayersPanel.js
└─ MultiProductPanel.js

HAFTA 6: Serializer ve Render
├─ CanvasSerializer.js
├─ CanvasDeserializer.js
├─ LegacyAdapter.js (v5 uyumluluk)
└─ TemplateRenderer.js v7

HAFTA 7: Entegrasyon
├─ TemplateEditorV7.js orchestrator
├─ Route entegrasyonu
├─ i18n entegrasyonu
└─ Sablon listesi entegrasyonu

HAFTA 8: Test ve Gecis
├─ Mevcut sablonlari test et
├─ Yeni sablon olusturma testi
├─ Cihaza gonderim testi
└─ Production gecisi
```

**Toplam Sure:** 8 hafta (2 ay)

---

## 12. Hizli Baslangiç Kontrol Listesi

### Gun 1: Vendor Kurulumu
- [ ] `public/assets/vendor/` klasorunu olustur
- [ ] Fabric.js 7.1.0 indir ve yerles
- [ ] JsBarcode indir ve yerles
- [ ] qrcodejs indir ve yerles
- [ ] Tabler Icons indir ve yerles
- [ ] HLS.js indir ve yerles
- [ ] SheetJS indir ve yerles
- [ ] Vendor README.md yaz

### Gun 2: CDN Referanslarini Kaldir
- [ ] `public/index.html` CDN'leri lokal path'lere cevir
- [ ] `public/index.php` CDN'leri lokal path'lere cevir
- [ ] `public/player/index.html` CDN'leri lokal path'lere cevir
- [ ] `TemplateEditor.js` fabric CDN yuklemesini kaldir
- [ ] `TemplateRenderer.js` fabric CDN yuklemesini kaldir
- [ ] `RenderWorker.js` fabric CDN yuklemesini kaldir
- [ ] `ExportManager.js` xlsx CDN yuklemesini kaldir

### Gun 3: Temel v7 Canvas Testi
- [ ] Basit bir test sayfasi olustur
- [ ] Fabric v7 ile canvas init
- [ ] Origin varsayilanlarini test et
- [ ] Temel obje olusturma testi
- [ ] Event binding testi

---

## 13. Kaynaklar

- Fabric.js v7 Dokumantasyonu: https://fabricjs.com/docs/
- Fabric.js v7 Upgrade Guide: https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/
- Fabric.js GitHub Releases: https://github.com/fabricjs/fabric.js/releases
- JsBarcode Dokumantasyonu: https://github.com/lindell/JsBarcode
- qrcodejs Dokumantasyonu: https://github.com/davidshimjs/qrcodejs

---

*Bu dokuman Omnex Display Hub Fabric.js v7 migrasyonu icin hazirlanmistir.*
*Tarih: 2026-01-30*
*Guncelleme: CDN kullanilmayacak, tum paketler lokal kurulacak*
