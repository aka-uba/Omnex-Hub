# Sablon Editoru Mimari Dokumantasyonu (Fabric.js v7)

**Proje:** Omnex Display Hub
**Versiyon:** 2.0.21
**Tarih:** 2026-02-10 (son guncelleme)
**Fabric.js:** v7.1.0 (CDN - dinamik yukleme)

---

## Icindekiler

1. [Genel Bakis](#1-genel-bakis)
2. [Dosya Yapisi ve Modul Haritasi](#2-dosya-yapisi-ve-modul-haritasi)
3. [Core Moduller](#3-core-moduller)
4. [Factory Katmani](#4-factory-katmani)
5. [Manager Siniflari](#5-manager-siniflari)
6. [Panel Bilesenleri](#6-panel-bilesenleri)
7. [Toolbar ve UI Bilesenleri](#7-toolbar-ve-ui-bilesenleri)
8. [Konfigurasyonlar](#8-konfigurasyonlar)
9. [Sayfa Sarmalayicilari](#9-sayfa-sarmalayicilari)
10. [Backend Render ve API](#10-backend-render-ve-api)
11. [Veri Akisi](#11-veri-akisi)
12. [CSS Yapisi](#12-css-yapisi)
13. [Bilinen Sorunlar ve Cozumleri](#13-bilinen-sorunlar-ve-cozumleri)
14. [Floating Inspector Panel](#14-floating-inspector-panel)
15. [Metin Scale Normalizasyonu ve Backend Word-Wrap](#15-metin-scale-normalizasyonu-ve-backend-word-wrap)

---

## 1. Genel Bakis

### 1.1 Mimari Ozet

Sablon editoru, Fabric.js v7.1.0 tabanli modul mimarisi ile calisir. Her sorumluluk alani ayri bir module ayrilmistir:

```
TemplateEditorV7 (Orkestrator)
    |
    +-- Core Moduller (FabricExports, EventBus, CustomProperties, LegacyAdapter)
    |
    +-- Factory (ObjectFactory, CanvasManager)
    |
    +-- Managers (HistoryManager, GridManager, SelectionManager, ClipboardManager)
    |
    +-- Panels (PropertyPanel, DynamicFieldsPanel, LayersPanel)
    |   |
    |   +-- Inspector Panel (ikincil PropertyPanel + LayersPanel instance'lari)
    |
    +-- Components (Toolbar)
    |
    +-- Config (DevicePresets, FeatureFlags)

EditorWrapper (Sayfa Sarmalayici)
    |
    +-- Floating Inspector Panel (suruklenebilir, fixed, daraltilabilir)
    |   +-- Sablon Ozellikleri tab (PropertyPanel: golge, kenarlik, konum, metin, vb.)
    |   +-- Katmanlar tab (LayersPanel: siralama, hizalama, dagitma)
    |
    +-- Multi-Frame Slot Panel (suruklenebilir, fixed, daraltilabilir)
    |   +-- Slot secici grid
    |   +-- Dinamik alan ekleme butonlari
    |
    +-- Sag Panel (sadece Elemanlar + Dinamik Alanlar)
    +-- Sol Panel (Sablon Adi, Cihaz Preset, Grid Layout, Arkaplan)
```

### 1.2 Giris Noktasi

Kullanici `#/templates/editor` rotasina gidince:
1. `app.js` -> `EditorWrapper.js` (sayfa bileseni) yuklenir
2. `EditorWrapper` -> `TemplateEditorV7` instance olusturur
3. `TemplateEditorV7` tum modulleri baslatir ve orkestre eder

### 1.3 Fabric.js v7 Farklar

| Ozellik | v5 (Eski) | v7 (Guncel) |
|---------|-----------|-------------|
| Origin | `originX/Y: 'left'/'top'` | `originX/Y: 'center'` |
| Constructor | Custom props otomatik set | `_extractCustomProps()` gerekli |
| toJSON | Varsayilan props yeterli | `SERIALIZABLE_PROPS` tanimlama zorunlu |
| Import | `loadFromJSON()` | `LegacyAdapter` ile v5->v7 donusum |

---

## 2. Dosya Yapisi ve Modul Haritasi

```
public/assets/js/
├── editor/                           # Ana editor modulleri
│   ├── index.js                      # Re-export: TemplateEditorV7
│   ├── TemplateEditorV7.js           # [3,078 satir] Ana orkestrator sinif
│   │
│   ├── core/                         # Cekirdek yardimcilar
│   │   ├── index.js                  # Re-export
│   │   ├── FabricExports.js          # [388 satir] Fabric.js CDN yukleyici
│   │   ├── EventBus.js               # [375 satir] Olay veriyolu sistemi
│   │   ├── CustomProperties.js       # [679 satir] Ozel prop sabitleri
│   │   └── LegacyAdapter.js          # [503 satir] v5 <-> v7 donusturucu
│   │
│   ├── factory/                      # Nesne ve canvas olusturma
│   │   ├── index.js                  # Re-export
│   │   ├── ObjectFactory.js          # [1,062 satir] Fabric nesne fabrikasi
│   │   └── CanvasManager.js          # [1,153 satir] Canvas yonetimi
│   │
│   ├── managers/                     # Is mantigi yoneticileri
│   │   ├── index.js                  # Re-export
│   │   ├── HistoryManager.js         # [590 satir] Undo/redo yigini
│   │   ├── GridManager.js            # [1,490 satir] Grid, snap, duzen
│   │   ├── SelectionManager.js       # [647 satir] Nesne secim mantigi
│   │   └── ClipboardManager.js       # [573 satir] Kopyala/yapistir
│   │
│   ├── panels/                       # Panel bilesenleri (sag panel + floating inspector)
│   │   ├── index.js                  # Re-export
│   │   ├── PanelBase.js              # Temel panel sinifi (collapsible, mount, refresh)
│   │   ├── PropertyPanel.js          # [~820 satir] Ozellik paneli (golge, kenarlik, konum, metin)
│   │   ├── DynamicFieldsPanel.js     # [495 satir] Dinamik alan esleme
│   │   └── LayersPanel.js            # [~900 satir] Katman agaci + hizalama/dagitma
│   │
│   ├── components/                   # UI bilesenleri
│   │   ├── index.js                  # Re-export
│   │   └── Toolbar.js                # [632 satir] Ust arac cubugu
│   │
│   └── config/                       # Yapilandirma dosyalari
│       ├── DevicePresets.js           # [490 satir] Cihaz boyut presetleri
│       └── FeatureFlags.js           # [181 satir] Ozellik bayraklari
│
├── pages/templates/
│   ├── EditorWrapper.js              # [3,518 satir] Sayfa sarmalayici
│   └── TemplateList.js               # [1,179 satir] Sablon liste sayfasi
│
└── pages/web-templates/
    ├── WebTemplateEditor.js          # [68 satir] Web sablon editoru (alternatif)
    └── WebTemplateList.js            # [422 satir] Web sablon listesi

public/assets/css/pages/
├── template-editor.css               # [4,164 satir] Editor stilleri
└── templates.css                     # [1,074 satir] Liste sayfasi stilleri
```

### Toplam Kod Buyuklugu

| Kategori | Dosya Sayisi | Satir |
|----------|-------------|-------|
| Frontend JS (Editor) | 16 dosya | ~13,900 |
| Frontend JS (Sayfa) | 4 dosya | ~5,200 |
| CSS | 3 dosya | ~5,600 |
| Backend API | 9 dosya | ~2,500 |
| Backend Servis | 4 dosya | ~2,300 |
| **Toplam** | **36 dosya** | **~29,500** |

---

## 3. Core Moduller

### 3.1 FabricExports.js

Fabric.js kutuphanesinin CDN'den dinamik yuklemesini yonetir.

**Ana Gorevler:**
- jsDelivr CDN'den Fabric.js v7.1.0 yukleme
- Fabric siniflarini re-export: `Canvas, FabricText, Rect, Circle, Triangle, Line, Path, Group, FabricImage, Polygon, ActiveSelection, Textbox, IText`
- `V7_ORIGIN` sabiti: `{ originX: 'center', originY: 'center' }`
- `isFabricLoaded()` ve `waitForFabric()` yardimci fonksiyonlari

**Kullanim:**
```javascript
import { Canvas, FabricText, Rect, V7_ORIGIN } from '../core/FabricExports.js';
```

### 3.2 EventBus.js

Moduller arasi iletisim icin global olay veriyolu.

**Ana Olaylar (EVENTS sabiti):**
```javascript
EVENTS = {
    // Canvas olaylari
    OBJECT_ADDED: 'object:added',
    OBJECT_MODIFIED: 'object:modified',
    OBJECT_REMOVED: 'object:removed',
    SELECTION_CHANGED: 'selection:changed',
    SELECTION_CLEARED: 'selection:cleared',

    // Kullanici eylemleri
    UNDO: 'history:undo',
    REDO: 'history:redo',
    SAVE: 'template:save',
    TEMPLATE_SAVED: 'template:saved',
    TEMPLATE_LOADED: 'template:loaded',

    // Panel olaylari
    PROPERTY_CHANGED: 'property:changed',
    LAYER_REORDER: 'layer:reorder',
    DYNAMIC_FIELD_ADDED: 'dynamic-field:added',

    // Gorunum
    ZOOM_CHANGED: 'zoom:changed',
    GRID_TOGGLED: 'grid:toggled',
    PRESET_CHANGED: 'preset:changed'
}
```

**Kullanim:**
```javascript
// Dinleme
eventBus.on(EVENTS.OBJECT_ADDED, (obj) => { ... });
// Tetikleme
eventBus.emit(EVENTS.TEMPLATE_SAVED, { id, name });
// Temizlik
eventBus.off(EVENTS.OBJECT_ADDED, handler);
```

### 3.3 CustomProperties.js

Fabric.js nesnelerine eklenen ozel ozelliklerin merkezi tanimi.

**Temel Sabitler:**
```javascript
CUSTOM_TYPE         // Nesne tipi: 'text', 'barcode', 'qrcode', 'dynamic-field', 'shape'
OBJECT_ID           // Benzersiz nesne ID'si
DYNAMIC_FIELD       // Dinamik alan adi: 'product_name', 'current_price', vb.
DYNAMIC_FIELD_TYPE  // Alan tipi: 'text', 'image', 'barcode', 'qrcode'
FIELD_LABEL         // Kullanicinin gordugu etiket
REGION_ID           // Grid bolgesi ID'si
IS_BACKGROUND       // Arkaplan nesnesi mi
IS_LOCKED           // Kilitli mi
```

**SERIALIZABLE_PROPS:**
v7 `toJSON()` cagrisinda dahil edilecek ekstra prop'larin listesi. Bu olmadan custom props kaybolur.

```javascript
SERIALIZABLE_PROPS = [
    'customType', 'objectId', 'dynamicField', 'dynamicFieldType',
    'fieldLabel', 'regionId', 'isBackground', 'isLocked',
    'placeholder', 'barcodeFormat', 'qrData', ...
]
```

### 3.4 LegacyAdapter.js

Fabric.js v5 formatinda kaydedilmis sablonlari v7'ye donusturur ve tersi.

**Ana Metodlar:**
- `detectVersion(templateJSON)` - Sablon versiyonunu tespit (v5/v7)
- `v5ToV7(templateJSON)` - v5 -> v7 donusum (origin normalizasyonu)
- `v7ToV5(templateJSON)` - v7 -> v5 donusum (geriye uyumluluk)
- Origin offset hesaplama: v5 `left/top` -> v7 `center` koordinat cevrimi

**Neden Gerekli:**
Onceki surumlerde v5 ile kaydedilen sablonlar hala mevcuttur. Bu adapter, eski sablonlarin v7 editorde dogru konumlandirilmasini saglar.

---

## 4. Factory Katmani

### 4.1 ObjectFactory.js

Tum Fabric.js nesnelerini olusturan merkezi fabrika sinifi.

**Desteklenen Nesne Tipleri:**

| Metod | Nesne | Aciklama |
|-------|-------|----------|
| `createText(options)` | FabricText/Textbox | Metin kutusu |
| `createDynamicField(fieldName, options)` | Textbox | Dinamik urun alani |
| `createBarcode(data, options)` | FabricImage | JsBarcode ile barkod |
| `createQRCode(data, options)` | FabricImage | qrcodejs ile QR kod |
| `createImage(url, options)` | FabricImage | Gorsel nesnesi |
| `createRect(options)` | Rect | Dikdortgen |
| `createCircle(options)` | Circle | Daire |
| `createTriangle(options)` | Triangle | Ucgen |
| `createLine(points, options)` | Line | Cizgi |
| `createGroup(objects, options)` | Group | Nesne grubu |

**v7 Ozel Islemler:**
- `_extractCustomProps(options)` - Constructor'da custom prop'lari ayiklar ve nesneye atar
- `_applyV7Origin(obj)` - v7 `center` origin'i uygular
- Tum nesne olusturma sonrasinda `obj.set()` ile custom props atanir

**Dinamik Alan Esleme:**
```javascript
const FIELD_DEFAULTS = {
    product_name: { text: '{Urun Adi}', fontSize: 24 },
    current_price: { text: '{Fiyat}', fontSize: 36, fontWeight: 'bold' },
    barcode: { width: 200, height: 80, format: 'CODE128' },
    image_url: { width: 150, height: 150 },
    // ... 25+ alan
};
```

### 4.2 CanvasManager.js

Fabric.js Canvas instance'ini yonetir.

**Sorumluluklar:**
- Canvas baslangic ayarlari (boyut, arka plan, secim renkleri)
- Yeniden boyutlandirma (preset degisiminde)
- Zoom yonetimi (tekerlek, butonlar, sığdir)
- Pan/kaydirma yonetimi (fare ortasi surukle)
- Viewport hesaplamalari
- Canvas'i JSON'a/JSON'dan kaydetme/yukleme
- Render optimizasyonu (`requestRenderAll()` vs `renderAll()`)
- **Metin scale normalizasyonu** (`_normalizeTextScale()` - orantisiz scale duzeltme)

**Canvas Ayarlari:**
```javascript
{
    width: preset.width,
    height: preset.height,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
    controlsAboveOverlay: true,
    centeredScaling: false,
    centeredRotation: true,
    snapAngle: 15,
    snapThreshold: 5
}
```

---

## 5. Manager Siniflari

### 5.1 HistoryManager.js

Undo/redo islevselligini saglar.

**Calisma Mantigi:**
- Canvas'in JSON anlk goruntusunu (snapshot) stack'e kaydeder
- Her nesne ekleme/silme/degistirme sonrasi `saveState()` cagirilir
- Maks 50 adim undo destegi (performans icin sinirli)
- `undo()` ve `redo()` canvas'i snapshot'tan geri yukler

**API:**
```javascript
historyManager.saveState()        // Mevcut durumu kaydet
historyManager.undo()             // Geri al
historyManager.redo()             // Yeniden yap
historyManager.clear()            // Gecmisi temizle
historyManager.canUndo()          // boolean
historyManager.canRedo()          // boolean
```

### 5.2 GridManager.js

Grid cizgileri, yapisma (snap) ve layout duzenlerini yonetir.

**Grid Ozellikleri:**
- Ayarlanabilir grid boyutu (10px, 20px, 50px)
- Nesne tasirken grid'e yapisma (snap-to-grid)
- Akilli kilavuzlar (smart guides) - diger nesnelere hizalama
- Merkez ve kenar hizalama cizgileri

**Layout Duzenleri:**
```javascript
LAYOUTS = {
    single: { zones: 1 },              // Tek bolge
    dual_vertical: { zones: 2 },       // Dikey ikili
    dual_horizontal: { zones: 2 },     // Yatay ikili
    grid_2x2: { zones: 4 },           // 2x2 grid
    header_content: { zones: 2 },      // Ust baslik + icerik
    sidebar_content: { zones: 2 },     // Yan cubuk + icerik
    triple_column: { zones: 3 },       // Uc sutun
    header_2col: { zones: 3 },         // Baslik + 2 sutun
    // ... ve daha fazla
}
```

**Multi-Product Frame:**
Tek sablonda birden fazla urunu gostermek icin bolge sistemi:
- `1x2` - Yatay 2 urun
- `2x1` - Dikey 2 urun
- `2x2` - 4 urun grid
- `3x1` - Dikey 3 urun
- `2x3` - 6 urun grid

### 5.3 SelectionManager.js

Nesne secim islemlerini yonetir.

**Ozellikler:**
- Tekli ve coklu nesne secimi
- Secim degisikliginde olay tetikleme (panels'i gunceller)
- Kilitli nesnelerin secilemez yapilmasi
- Arkaplan nesnelerinin secim disi birakilmasi
- Grup secimi ve grup ici secim

### 5.4 ClipboardManager.js

Kopyala/yapistir islemlerini yonetir.

**Desteklenen Islemler:**
- `copy()` - Secili nesneyi panoya kopyala
- `paste()` - Panodan yapistir (offset ile)
- `duplicate()` - Secili nesneyi cogalt
- `cut()` - Kes (kopyala + sil)
- Nesne serializasyonu/deserializasyonu (custom props korunur)

---

## 6. Panel Bilesenleri

### 6.1 PropertyPanel.js

Secili nesnenin ozelliklerini duzenleyen panel. Floating Inspector Panel ve sag panelde kullanilir.

**Gosterilen Ozellik Bolumleri (nesne tipine gore):**

| Bolum | Ozellikler | Gosterildigi Tipler |
|-------|-----------|---------------------|
| Konum & Boyut | x, y, width, height, angle (range+number) | Tum nesneler |
| Metin | fontSize, fontFamily, fontWeight, fontStyle, underline, linethrough, textAlign, lineHeight, charSpacing, fill (renk) | Text, IText, Textbox |
| Sekil | fill (dolgu rengi) | Rect, Circle, Ellipse, Triangle, Polygon, Line |
| Gorsel | opacity (range+number), gorsel degistir butonu | Image |
| Kenarlik | stroke (renk + temizle butonu), strokeWidth, cornerRadius/rx (sadece Rect - range+number) | Tum nesneler |
| Golge | etkinlestir checkbox, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur (range+number) | Tum nesneler |
| Genel | opacity (text/image disindakiler), visible checkbox | Tum nesneler |

**Golge Sistemi:**
- `_renderShadowSection()` - Tum nesne tipleri icin golge kontrolleri
- `_toggleShadow(enable)` - Golgeyi varsayilan degerlerle acar/kapatir (offset: 4, blur: 8, color: #00000066)
- `_updateShadowProperty(property, value)` - Shadow nesnesinin tek bir ozelligini gunceller
- `_shadowColorToHex(color)` - RGBA/named renkleri hex'e donusturur (color picker icin)
- `fabric.Shadow` (v7) veya plain object fallback ile shadow nesnesi olusturma

**Kenarlik Sistemi:**
- `_renderBorderSection()` - Stroke rengi, kalinligi ve kose yuvarlaklik kontrolleri
- `_clearStroke()` - Kenarligi temizler (stroke=null, strokeWidth=0)
- "Kenarlik Yok" butonu ile hizli temizleme
- Kose yuvarlaklik (rx/ry) sadece Rect nesnelerde gosterilir

**Range-Number Sync:**
Ayni `data-property` ile bagli range ve number input'lari otomatik senkronize edilir. Birini degistirince diger de guncellenir.

**Guncelleme Akisi:**
1. Kullanici panelde deger degistirir
2. `_handlePropertyChange()` cagirilir, `shadow-*` property'ler `_updateShadowProperty()`'ye yonlendirilir
3. Canvas nesnesi `set()` ile guncellenir, `requestRenderAll()` cagirilir
4. EventBus `CANVAS_MODIFIED` event'i yayar, HistoryManager durumu kaydeder

### 6.2 DynamicFieldsPanel.js

Urun alanlarini sablon nesnelerine eslestiren panel.

**Desteklenen Dinamik Alanlar (25+):**
```
product_name      - Urun adi
current_price     - Guncel fiyat
previous_price    - Onceki fiyat
barcode           - Barkod
sku               - Stok kodu
category          - Kategori
description       - Aciklama
unit              - Birim
weight            - Agirlik
stock             - Stok miktari
image_url         - Urun gorseli
video_url         - Urun videosu
shelf_location    - Raf konumu
brand             - Marka
origin            - Mensei
production_type   - Uretim sekli
discount_percent  - Indirim yuzdesi
campaign_text     - Kampanya metni
valid_from        - Gecerlilik baslangici
valid_until       - Gecerlilik bitisi
hal_kunye_no      - HAL kunye numarasi
hal_uretici       - HAL uretici adi
hal_uretim_yeri   - HAL uretim yeri
qr_code           - QR kod verisi
custom_field_1..5 - Ozel alanlar
```

### 6.3 LayersPanel.js

Canvas nesnelerinin hiyerarsik agac gorunumu. Floating Inspector Panel ve sag panelde kullanilir.

**Ozellikler:**
- Surkle-birak ile sira degistirme
- Nesne kilitleme/kilit acma
- Nesne gizleme/gosterme
- Nesne tipi ikonu gosterme (v7 buyuk harf tip destegi: Rect, Circle, Image, vb.)
- Tiklama ile nesneyi secme

**Toolbar Butonlari:**

| Grup | Butonlar | Aciklama |
|------|---------|----------|
| Siralama | En one, bir one, bir arkaya, en arkaya | Katman z-sirasi |
| Hizalama | Sola, yatay ortala, saga, uste, dikey ortala, alta | Coklu secimde aktif |
| Dagitma | Yatay esit dagit, dikey esit dagit | 3+ nesne seciminde aktif |

**Hizalama/Dagitma Sistemi:**
- `_getSelectedObjects()` - ActiveSelection icindeki nesneleri doner (2+ nesne gerekli)
- `_alignObjects(direction)` - Nesneleri grubun sinir kutusuna gore hizalar (getBoundingRect)
- `_distributeObjects(direction)` - Nesneleri esit aralikla dagitir (3+ nesne gerekli)
- `_updateAlignToolbarState()` - Secim degisikliginde butonlarin disabled/enabled durumunu gunceller
- Fabric.js v7 tip kontrolu: `activeselection`, `activeSelection`, `ActiveSelection` (uc varyant)

---

## 7. Toolbar ve UI Bilesenleri

### 7.1 Toolbar.js

Ust kisimdaki arac cubugu.

**Buton Gruplari:**

| Grup | Butonlar |
|------|---------|
| Ekleme | Metin, Gorsel, Sekil (dikdortgen, daire, ucgen, cizgi) |
| Ozel | Barkod, QR Kod, Dinamik Alan |
| Duzenleme | Undo, Redo, Sil, Cogalt |
| Hizalama | Sola, Ortala, Saga, Yukari, Orta, Asagi |
| Duzen | Grid acma/kapama, Snap toggle |
| Preset | Cihaz boyut secici dropdown |
| Layout | Grid layout secici |
| Zoom | Yaklas, Uzaklas, Sigidir |

---

## 8. Konfigurasyonlar

### 8.1 DevicePresets.js

Cihaz boyut preset tanimlari.

**ESL Presetleri:**
```javascript
{ name: 'ESL 10.1"',  width: 1872, height: 1404, type: 'esl' }
{ name: 'ESL 7.5"',   width: 800,  height: 480,  type: 'esl' }
{ name: 'ESL 4.2"',   width: 400,  height: 300,  type: 'esl' }
{ name: 'ESL 3.5"',   width: 384,  height: 168,  type: 'esl' }
{ name: 'ESL 2.9"',   width: 296,  height: 128,  type: 'esl' }
{ name: 'ESL 2.13"',  width: 250,  height: 122,  type: 'esl' }
{ name: 'ESL 1.54"',  width: 200,  height: 200,  type: 'esl' }
```

**Signage/TV Presetleri:**
```javascript
{ name: 'TV 32" HD',    width: 1366, height: 768,  type: 'signage' }
{ name: 'TV 43" FHD',   width: 1920, height: 1080, type: 'signage' }
{ name: 'TV 55" 4K',    width: 3840, height: 2160, type: 'signage' }
{ name: 'TV 65" 4K',    width: 3840, height: 2160, type: 'signage' }
```

**Poster Presetleri:**
```javascript
{ name: 'A4 Dikey',    width: 2480, height: 3508, type: 'poster' }
{ name: 'A4 Yatay',    width: 3508, height: 2480, type: 'poster' }
{ name: 'A3 Dikey',    width: 3508, height: 4961, type: 'poster' }
```

**Fonksiyonlar:**
- `getGroupedPresets()` - Tipe gore gruplanmis presetler
- `getAllGridLayouts()` - Tum grid layout tanimlari
- `getPresetById(id)` - ID ile preset getir

### 8.2 FeatureFlags.js

Deneysel ozellikleri acip kapatma.

---

## 9. Sayfa Sarmalayicilari

### 9.1 EditorWrapper.js (~3,500 satir)

Sablon editoru icin sayfa yasam dongusunu yoneten sarmalayici.

**Sorumluluklar:**
- i18n cevirilerini preload etme
- UI layout'u render etme (ust bar, yan paneller, canvas alani)
- TemplateEditorV7 instance'ini olusturma ve baslatma
- **Floating Inspector Panel** yonetimi (surukleme, tab gecisi, goster/gizle)
- MediaPicker entegrasyonu (gorsel/video secimi icin)
- Template CRUD islemleri (kaydet, guncelle, sil)
- Device preset degisim UI'i
- Grid layout secim UI'i
- Sablon export/import modal'lari
- Multi-Product Frame yapilandirmasi

**Sag Panel Yapisi (Guncellenmis):**
Sag panelde sadece **Elemanlar** ve **Dinamik Alanlar** card'lari kalir. Ozellikler ve Katmanlar panelleri Floating Inspector Panel'e tasinmistir. Sag paneldeki gizli container'lar (`#property-panel-container`, `#layers-panel-container`) hala mevcuttur (ana panel instance'lari mount edilir ama gorsel olarak gizlenmistir).

**Floating Inspector Panel:**
Canvas uzerinde suruklenen, `position: fixed` konumlu panel. Iki tab icerir:
1. **Sablon Ozellikleri** - PropertyPanel instance'i (secili nesne ozellikleri)
2. **Katmanlar** - LayersPanel instance'i (katman agaci + hizalama)

**Multi-Frame Slot Panel:**
Coklu urun cercevesi icin slot secimi ve alan ekleme paneli. `position: fixed` konumlu, suruklenebilir.

```javascript
// Inspector Panel
_renderFloatingInspector()     // Panel HTML olusturma (daralt butonu dahil)
_initFloatingInspector()       // Panel baslangic konumu (right→left donusum)
_bindInspectorEvents(panel)    // Tab degisimi, daralt/genislet, kapatma
_switchInspectorTab(panel, tabName)  // Tab icerigi goster/gizle
_toggleFloatingInspector()     // Toolbar butonu ile ac/kapat

// Slot Panel
_showMultiFrameSlotSelector(frame)  // Panel HTML olustur ve body'ye ekle
_bindSlotPanelEvents()              // Slot secimi, alan ekleme, daralt, kapatma
_hideMultiFrameSlotSelector()       // Panel'i kaldir

// Ortak
_makePanelDraggable(panel, handleSelector, closeSelector) // Yeniden kullanilabilir surukleme
_togglePanelCollapse(panel, bodyId, collapseBtnId)         // Daralt/genislet toggle
_makeSlotPanelDraggable(panel)                             // Slot panel icin wrapper
```

**Surukleme Sistemi (`_makePanelDraggable`):**
- `position: fixed` ve `position: absolute` destegi (isFixed() helper)
- `offsetLeft/offsetTop` kullanimi (getBoundingClientRect yerine)
- Ilk tiklamada `right: auto` + `left` donusumu (rAF ile)
- Panel genisligini mousedown'da yakala ve sabitle (resize onleme)
- Viewport sinirlari icerisinde sinir kontrolu (`window.innerWidth/Height`)
- `.panel-header-actions` icindeki butonlar (daralt, kapat) surukle tetiklemez
- Ayni metod hem slot-panel hem inspector icin kullanilir

**Daralt/Genislet Sistemi (`_togglePanelCollapse`):**
- Her iki floating panelde `.panel-collapse-btn` (chevron-up/down ikonu)
- Panel'e `.collapsed` class toggle eder
- Collapsed durumda `.floating-panel-body` → `max-height: 0, opacity: 0` (CSS transition)
- Ikon yonu degisir: chevron-up (acik) ↔ chevron-down (daraltilmis)
- Tooltip guncellenir: "Daralt" ↔ "Genislet"

**Panel HTML Yapisi (her iki panelde ortak pattern):**
```html
<div class="floating-inspector-panel | multi-frame-slot-panel">
    <div class="[panel]-header" id="[panel]-drag-handle">
        <div class="[panel]-header-content">
            <i class="ti ti-grip-vertical drag-grip"></i>
            ...baslik...
        </div>
        <div class="panel-header-actions">
            <button class="panel-collapse-btn" id="collapse-[panel]">
                <i class="ti ti-chevron-up"></i>
            </button>
            <button class="[panel]-close" id="close-[panel]">
                <i class="ti ti-x"></i>
            </button>
        </div>
    </div>
    <div class="floating-panel-body" id="[panel]-body">
        ...icerik (tab'lar, seciciler, vb.)...
    </div>
</div>
```

**Yasam Dongusu:**
```javascript
async preload() {
    await this.app.i18n.loadPageTranslations('template-editor');
}

render() {
    // Toolbar, canvas container, sag paneller, floating inspector iceren HTML
}

async init() {
    // TemplateEditorV7 olustur, event'leri bagla, veri yukle
    this.editor = new TemplateEditorV7({ ... });
    await this.editor.init();
    // Floating inspector panel baslat
    this._initFloatingInspector();
    // Eger URL'de template ID varsa, yukle
}

destroy() {
    this.editor?.destroy();
    this.app.i18n.clearPageTranslations();
}
```

**MediaPicker Entegrasyonu:**
```javascript
_initMediaPicker() {
    this.mediaPicker = initMediaPicker({
        container: document.getElementById('media-picker-container'),
        app: this.app,
        onSelect: (media) => this._handleMediaSelected(media)
    });
}
```

### 9.2 TemplateList.js (1,179 satir)

Sablon listesi sayfasi. DataTable bileseni ile grid/list gorunum, arama, filtreleme, toplu islemler.

---

## 10. Backend Render ve API

### 10.1 API Endpoint'leri

| Endpoint | Dosya | Satir | Aciklama |
|----------|-------|-------|----------|
| `GET /api/templates` | index.php | 114 | Listeleme (sayfalama, arama, filtre) |
| `GET /api/templates/:id` | show.php | 44 | Tekli goruntuleme |
| `POST /api/templates` | create.php | 143 | Yeni olusturma |
| `PUT /api/templates/:id` | update.php | 207 | Guncelleme |
| `DELETE /api/templates/:id` | delete.php | 77 | Silme |
| `POST /api/templates/:id/render` | render.php | 1,492 | Render + cihaza gonderim |
| `GET /api/templates/export` | export.php | 138 | JSON export |
| `POST /api/templates/import` | import.php | 257 | JSON import |
| `POST /api/templates/:id/fork` | fork.php | 114 | Sistem sablonunu kopyalama |

### 10.2 Backend Servisler

| Servis | Satir | Aciklama |
|--------|-------|----------|
| `TemplateRenderer.php` | 462 | Fabric.js JSON -> PNG/JPG donusumu |
| `RenderService.php` | 374 | Render + cihaz gonderim orkestrasyon |
| `RenderCacheService.php` | 708 | MD5 bazli render cache |
| `RenderQueueService.php` | 738 | Toplu render kuyrugu (FIFO + retry) |

### 10.3 Render Akisi

```
Frontend                          Backend
--------                          -------
ProductList                       render.php
  |                                  |
  +-- POST /render-queue/auto        +-- process.php
       |                                  |
       v                                  v
  Kuyruge eklenir               renderDynamicFields()
                                      |
                                      v
                                sendLabel()
                                      |
                          +-----------+-----------+
                          |                       |
                    PavoDisplay              Hanshow
                    Gateway                  Gateway
```

### 10.4 Dinamik Alan Degistirme (Backend)

`PavoDisplayGateway.php` icindeki `renderDynamicFields()` fonksiyonu:

1. Sablon JSON'undaki tum nesneleri tara
2. `dynamicField` prop'u olan veya `{{key}}` iceren nesneleri bul
3. Urun verisinden ilgili degeri al
4. **Nesne boyutlarini hesapla** (scaleX/scaleY dahil)
5. **Metin sarmalama (word-wrap)** uygula (genislige gore)
6. **Origin'e gore pozisyon duzeltmesi** (center, left, right)
7. **textAlign** destegi ile hizali cizim
8. `image_url` alanlari icin `renderProductImageOnLabel()` cagir

**Boyut Hesaplama:**
```php
$objScaleX = (float)($obj['scaleX'] ?? 1.0);
$objScaleY = (float)($obj['scaleY'] ?? 1.0);

// Efektif boyutlar (nesne kendi scale'i ile)
$effectiveWidth  = $obj['width'] * $objScaleX;
$effectiveHeight = $obj['height'] * $objScaleY;
$effectiveFontSize = $obj['fontSize'] * $objScaleY;

// Sablon → cihaz olcekleme
$scaledFontSize = max(8, $effectiveFontSize * min($scaleX, $scaleY));
$scaledWidth    = $effectiveWidth * $scaleX;
```

**Origin Duzeltmesi:**
Fabric.js v7 varsayilan olarak `originX: 'center', originY: 'center'` kullanir. Backend'de pozisyon hesaplanirken origin'e gore offset cikarilir:
```php
if ($originX === 'center') $adjLeft = $left - ($effectiveWidth / 2);
if ($originY === 'center') $adjTop  = $top  - ($effectiveHeight / 2);
```

**Metin Sarmalama (wrapText):**
```php
private function wrapText(string $text, int $fontSize, string $fontPath, int $maxWidth): array
// 1. Once tum metin sigiyorsa tek satir doner
// 2. Kelime bazli sarmalama (bosluktan bol)
// 3. Tek kelime genislikten buyukse karakter bazli bol (mb_str_split)
// Sonuc: string[] (satirlar dizisi)
```

**textAlign Destegi:**
Her satir `textAlign` degerine gore konumlandirilir:
- `left` → sola yasli (varsayilan)
- `center` → `scaledLeft + (scaledWidth - lineWidth) / 2`
- `right` → `scaledLeft + scaledWidth - lineWidth`

**Fallback Mekanizmasi:**
Eger nesne `dynamicField` prop'u yoksa, `labelToFieldMap` ile metin icerigine gore eslestirme yapilir:
```php
$labelToFieldMap = [
    '{Urun Adi}' => 'product_name',
    '{Fiyat}' => 'current_price',
    '{Barkod}' => 'barcode',
    // ...
];
```

---

## 11. Veri Akisi

### 11.1 Sablon Kaydetme

```
1. Kullanici "Kaydet" tiklar
2. EditorWrapper.save() cagirilir
3. TemplateEditorV7.exportJSON() cagirilir
   - Canvas JSON'a donusturulur
   - SERIALIZABLE_PROPS dahil edilir
   - LegacyAdapter.v7ToV5() geriye uyumluluk icin (opsiyonel)
4. POST /api/templates (yeni) veya PUT /api/templates/:id (guncelleme)
5. Backend: content alani JSON string olarak DB'ye kaydedilir
```

### 11.2 Sablon Yukleme

```
1. EditorWrapper.init() - URL'den template ID okunur
2. GET /api/templates/:id
3. Backend: templates tablosundan content JSON donulur
4. TemplateEditorV7.loadTemplate(json)
   - LegacyAdapter.detectVersion() ile versiyon tespit
   - Gerekirse v5->v7 donusum
   - _repairDynamicFieldProps() ile eksik prop'lar onarilir
   - Canvas'a yuklenir
5. Paneller guncellenir (PropertyPanel, LayersPanel, DynamicFieldsPanel)
```

### 11.3 Cihaza Gonderim

```
1. ProductList: Urun secilir, "Gonder" tiklenir
2. POST /api/render-queue/auto { product_id, template_id, device_ids }
3. process.php:
   - Sablon JSON yuklenir
   - renderDynamicFields() ile urun verisi yerlestirilir
   - Gorsel render edilir (PNG/JPG)
4. sendLabel():
   - Cihaz tipine gore gateway secilir
   - PavoDisplayGateway.uploadFile() veya HanshowGateway.sendToESL()
   - Sonuc kaydedilir (render_queue_items)
```

---

## 12. CSS Yapisi

### 12.1 template-editor.css (~4,500 satir)

Editor'un tum gorunumunu kontrol eder.

**Ana CSS Siniflari:**

| Sinif | Aciklama |
|-------|----------|
| `.template-editor-wrapper` | Ana sarmalayici (flex row) |
| `.editor-toolbar` | Ust arac cubugu |
| `.editor-canvas-area` | Canvas ortasi alani (position: relative) |
| `.editor-canvas-container` | Canvas wrapper (zoom/pan) |
| `.editor-right-panel` | Sag panel container'i |
| `.dynamic-fields-panel` | Dinamik alanlar paneli |
| `.editor-zoom-controls` | Zoom kontrolleri |
| `.editor-preset-selector` | Cihaz preset secici |
| `.editor-grid-overlay` | Grid cizgileri |
| `.snap-guide` | Snap/hizalama kilavuzlari |

**Floating Panel Ortak CSS (Inspector + Slot Panel):**

| Sinif | Aciklama |
|-------|----------|
| `.panel-header-actions` | Daralt + kapat buton container (flex, gap: 4px) |
| `.panel-collapse-btn` | Daralt/genislet butonu (chevron-up/down) |
| `.floating-panel-body` | Daraltilabilir icerik wrapper (flex, transition) |
| `.floating-inspector-panel.collapsed` | Inspector daraltilmis durumu |
| `.multi-frame-slot-panel.collapsed` | Slot panel daraltilmis durumu |
| `.collapsed .floating-panel-body` | max-height: 0, opacity: 0 |

**Floating Inspector Panel CSS:**

| Sinif | Aciklama |
|-------|----------|
| `.floating-inspector-panel` | Ana panel (position: fixed, z-index: 1001) |
| `.inspector-panel-header` | Suruklenebilir baslik alani |
| `.inspector-tabs` | Tab butonlari container |
| `.inspector-tab` | Tab butonu (active state) |
| `.inspector-tab-content` | Tab icerik alani (hidden toggle) |
| `.inspector-header-content` | Baslik ikonu ve metin |
| `.inspector-panel-close` | Kapatma butonu |

**Multi-Frame Slot Panel CSS:**

| Sinif | Aciklama |
|-------|----------|
| `.multi-frame-slot-panel` | Ana panel (position: fixed, z-index: 1000) |
| `.slot-panel-header` | Suruklenebilir baslik alani (mavi gradient) |
| `.slot-panel-header-content` | Baslik ikonu ve metin |
| `.slot-panel-close` | Kapatma butonu |
| `.slot-selector-grid` | Slot secim butonlari grid'i |
| `.slot-field-buttons` | Dinamik alan ekleme butonlari |

**Property Panel CSS (Yeni):**

| Sinif | Aciklama |
|-------|----------|
| `.property-color-row` | Renk picker + buton yan yana layout |
| `.btn-clear-stroke` | Kenarlik yok butonu (active state) |
| `.shadow-controls` | Golge kontrolleri wrapper |
| `.shadow-controls.hidden` | Golge kapali durumu |
| `.property-input-group` | Range + number + birim yan yana layout |
| `.property-input-group .form-range` | Slider (flex: 1) |

**Layers Panel CSS (Yeni):**

| Sinif | Aciklama |
|-------|----------|
| `.layers-toolbar` | Toolbar butonlari (flex-wrap) |
| `.layers-toolbar-separator` | Buton grubu ayirici cizgi |
| `.layers-toolbar .btn-icon.disabled` | Pasif buton (opacity: 0.35, pointer-events: none) |

### 12.2 templates.css (1,074 satir)

Sablon listesi sayfasi icin stiller.

---

## 13. Bilinen Sorunlar ve Cozumleri

### 13.1 v7 Custom Props Kaybolma

**Sorun:** Fabric.js v7'de constructor'a gecilen custom prop'lar (dynamicField, customType vb.) otomatik atanmiyor.
**Cozum:** `ObjectFactory._extractCustomProps()` ile nesne olusturulduktan sonra `obj.set()` ile atama yapilir. `toJSON()` icin `SERIALIZABLE_PROPS` tanimlanir.

### 13.2 Eski Sablonlarda Dinamik Alan Eksikligi

**Sorun:** v5->v7 gecis doneminde kaydedilen sablonlarda dynamic field marker'lari kaybolmus.
**Cozum:**
- `_repairDynamicFieldProps()` - yukleme sirasinda metin icerigine bakarak field esleme
- Backend `labelToFieldMap` fallback - `{Urun Adi}` gibi placeholder metinlerden alan tespiti

### 13.3 Origin Farki

**Sorun:** v5 `left/top` origin, v7 `center` origin. Koordinatlar farklilik gosteriyor.
**Cozum:** `LegacyAdapter` modulu ile otomatik donusum. Offset hesaplama: `x_v7 = x_v5 + width/2`, `y_v7 = y_v5 + height/2`

### 13.4 Pre-rendered Image Sorunu

**Sorun:** `isPreRendered=true` oldugunda `designData=[]` donuyor, dinamik alanlar bos kaliyor.
**Cozum:** `process.php` her zaman `designData` gonderir, `isPreRendered` flag'i sadece gorsel cache icin kullanilir.

### 13.5 Metin Orantisiz Scale Sorunu

**Sorun:** Kullanici metin nesnesini sadece sağa dogru genislettirdiginde (orantisiz scale):
- Editorde metin yatay gerilmis gorunur (`scaleX` artar, `scaleY` ayni kalir)
- Backend render'da `scaleX/scaleY` degerleri kullanilmiyordu → metin yanlis boyutta render ediliyordu
- Tasarimdaki genislik siniri yuzunden uzun dinamik veriler 2-3 satira tasiyor

**Cozum (iki tarafli):**

1. **Frontend** (`CanvasManager._normalizeTextScale()`):
   - `object:modified` event'inde scale, scaleX, scaleY action'larinda tetiklenir
   - `yeni width = width * scaleX`, `yeni fontSize = fontSize * scaleY`
   - `scaleX = 1`, `scaleY = 1` sifirlanir
   - `initDimensions()` ve `setCoords()` ile Fabric cache guncellenir
   - Sonuc: Tasarimda metin her zaman duzgun orantida gorunur

2. **Backend** (`PavoDisplayGateway.renderDynamicFields()`):
   - `obj['scaleX']` ve `obj['scaleY']` ile efektif boyutlar hesaplanir
   - `obj['width'] * scaleX` = gercek genislik (eski sablonlar icin de uyumlu)
   - `wrapText()` ile kelime/karakter bazli metin sarmalama
   - `originX/originY` (center) pozisyon duzeltmesi
   - `textAlign` (left/center/right) hizalama destegi

---

## 14. Floating Inspector Panel

### 14.1 Genel Bakis

Floating Inspector Panel, canvas uzerinde suruklenebilen `position: fixed` konumlu bir paneldir. Editor sagindaki Ozellikler ve Katmanlar card'larinin yerine gecmistir. Kullanici nesne sectiginde ozellikleri hemen gorunur - scroll yapmaya gerek kalmaz.

### 14.2 Mimari

```
EditorWrapper._renderFloatingInspector()
    |
    +-- #floating-inspector-panel (position: fixed, z-index: 1001)
        |
        +-- .inspector-panel-header (suruklenebilir, grip ikon)
        |   +-- .panel-header-actions
        |       +-- .panel-collapse-btn (daralt/genislet)
        |       +-- .inspector-panel-close (kapat)
        |
        +-- .floating-panel-body#inspector-panel-body (daraltilabilir)
            +-- .inspector-tabs
            |   +-- "Sablon Ozellikleri" tab (PropertyPanel)
            |   +-- "Katmanlar" tab (LayersPanel)
            |
            +-- #inspector-properties-tab
            |   +-- #inspector-properties-container
            |       +-- PropertyPanel instance (panelId: 'inspector-property-panel')
            |
            +-- #inspector-layers-tab
                +-- #inspector-layers-container
                    +-- LayersPanel instance (panelId: 'inspector-layers-panel')

EditorWrapper._showMultiFrameSlotSelector(frame)
    |
    +-- #multi-frame-slot-panel (position: fixed, z-index: 1000, body'ye eklenir)
        |
        +-- .slot-panel-header (suruklenebilir, grip ikon)
        |   +-- .panel-header-actions
        |       +-- .panel-collapse-btn (daralt/genislet)
        |       +-- .slot-panel-close (kapat)
        |
        +-- .floating-panel-body#slot-panel-body (daraltilabilir)
            +-- .slot-panel-section (Slot Sec grid)
            +-- .slot-panel-section (Alan Ekle butonlari)
```

### 14.3 Ikincil Panel Instance'lari

TemplateEditorV7._initInspectorBinding() iki ayri panel instance'i olusturur:

| Panel | panelId | Container | Canvas |
|-------|---------|-----------|--------|
| Ana PropertyPanel | `property-panel` | #property-panel-container (gizli) | Ayni canvas |
| Inspector PropertyPanel | `inspector-property-panel` | #inspector-properties-container | Ayni canvas |
| Ana LayersPanel | `layers-panel` | #layers-panel-container (gizli) | Ayni canvas |
| Inspector LayersPanel | `inspector-layers-panel` | #inspector-layers-container | Ayni canvas |

Her iki instance da ayni canvas'i paylasir ve canvas event'lerini dinler. Inspector instance'lari `collapsible: false` ile olusturulur (PanelBase header render etmez).

### 14.4 PanelId Onemi

Fabric.js v7'de ayni panelId kullanan iki panel instance'i DOM'da cakisir. Bu nedenle inspector panelleri farkli panelId kullanir:
- `'inspector-property-panel'` vs `'property-panel'`
- `'inspector-layers-panel'` vs `'layers-panel'`

PanelBase constructor'inda spread sirasi onemli: `super({ panelId: 'default', ...options })` - options icerisindeki panelId default'u override eder.

### 14.5 Dispose ve Cleanup

TemplateEditorV7.dispose() icinde inspector panelleri de temizlenir:
```javascript
this._inspectorPropertyPanel?.dispose();
this._inspectorLayersPanel?.dispose();
this._inspectorPropertyPanel = null;
this._inspectorLayersPanel = null;
```

---

## 15. Metin Scale Normalizasyonu ve Backend Word-Wrap

### 15.1 Problem

Fabric.js'de bir metin nesnesi orantisiz scale edildiginde (ornegin sadece saga dogru cekme):
- `scaleX` artar (orn. 2.5), `scaleY` ayni kalir (1.0)
- Editorde metin yatay gerilmis/bozuk gorunur
- Backend render'da `scaleX/scaleY` degerleri kullanilmiyordu
- Uzun dinamik veriler (orn. uzun urun adi) tasarimdaki dar alanda 2-3 satira tasiyor

### 15.2 Frontend Cozumu: _normalizeTextScale()

**Dosya:** `CanvasManager.js`

`object:modified` event'inde metin nesneleri icin otomatik calisir:

```
Kullanici metni genisletir:  scaleX=2.5, width=200, fontSize=24
                                    ↓ _normalizeTextScale()
Normalize edilir:            scaleX=1, width=500, fontSize=24
```

**Kurallar:**
- Sadece metin tipleri: `text`, `i-text`, `itext`, `textbox`
- Sadece `scale`, `scaleX`, `scaleY` action'larinda tetiklenir
- `newWidth = width * scaleX` → genislik gercek piksel degerine cevirilir
- `newFontSize = fontSize * scaleY` → font boyutu scale ile guncellenir
- `scaleX = 1, scaleY = 1` → scale sifirlanir
- `initDimensions()` + `setCoords()` → Fabric.js text cache guncellenir

**Sonuc:** Tasarimda metin her zaman dogru orantida gorunur, JSON'da `width` gercek genisligi yansitir.

### 15.3 Backend Cozumu: renderDynamicFields() Guncellemesi

**Dosya:** `PavoDisplayGateway.php`

**Eski davranis:** Sadece `fontSize` ve `left/top` kullaniliyordu. `width`, `scaleX`, `scaleY`, `originX/Y`, `textAlign` yok sayiliyordu.

**Yeni davranis:**

1. **Efektif boyut hesaplama:**
```php
$effectiveWidth = $obj['width'] * $obj['scaleX'];
$effectiveFontSize = $obj['fontSize'] * $obj['scaleY'];
```

2. **Origin duzeltmesi** (v7 center origin):
```php
if ($originX === 'center') $adjLeft = $left - ($effectiveWidth / 2);
if ($originY === 'center') $adjTop  = $top  - ($effectiveHeight / 2);
```

3. **wrapText()** - Metin sarmalama:
```php
private function wrapText(string $text, int $fontSize, string $fontPath, int $maxWidth): array
```
- Kelime bazli sarmalama (bosluktan bol)
- Tek kelime genislikten buyukse karakter bazli bol (`mb_str_split`)
- `imagettfbbox()` ile gercek piksel genislik olcumu

4. **textAlign** destegi:
- `left` → sola yasli (varsayilan)
- `center` → satir genisligi ile ortalama
- `right` → saga yasli

5. **lineHeight** destegi:
- Fabric.js `lineHeight` carpani (varsayilan 1.16)
- Satirlar arasi bosluk = `fontSize * lineHeight`

### 15.4 Uyumluluk

| Senaryo | Davranis |
|---------|----------|
| Yeni sablonlar (normalize edilmis) | `scaleX=1`, `width` gercek genisligi yansitir |
| Eski sablonlar (scale'li) | `width * scaleX` ile efektif genislik hesaplanir |
| Scale'siz nesneler | `scaleX=1, scaleY=1` varsayilan, width dogrudan kullanilir |
| Metin tek satira sigiyorsa | `wrapText()` tek elemanli dizi doner |

### 15.5 Akis Semas

```
EDITOR                            BACKEND
------                            -------
Kullanici metin genisletir
    ↓ object:modified
_normalizeTextScale()
    ↓ scaleX→width, scaleY→fontSize
JSON kaydedilir
    ↓ width=500, scaleX=1, fontSize=24

                                  renderDynamicFields()
                                      ↓ effectiveWidth = 500 * 1 = 500
                                      ↓ scaledWidth = 500 * (dstW/tplW)
                                  wrapText("Uzun Urun Adi...", fontSize, font, scaledWidth)
                                      ↓ ["Uzun Urun", "Adi..."]
                                  Her satir textAlign'a gore hizalanir
                                      ↓ imagettftext() ile cizdikten
                                  Sonuc: Metin dogru genislikte, gerekirse coklu satirda
```

---

## Ek: Modul Bagimliliklari

```
TemplateEditorV7
├── imports: core/* (FabricExports, EventBus, CustomProperties)
├── imports: factory/* (ObjectFactory, CanvasManager)
├── imports: managers/* (History, Grid, Selection, Clipboard)
├── imports: panels/* (Property, DynamicFields, Layers)
├── imports: components/* (Toolbar)
└── imports: config/* (DevicePresets, FeatureFlags)

EditorWrapper
├── imports: TemplateEditorV7
├── imports: MediaPicker (from products/form/)
├── imports: Modal, Toast (from components/)
├── imports: Logger (from core/)
├── renders: Floating Inspector Panel (HTML + drag + collapse + tab events)
└── renders: Multi-Frame Slot Panel (HTML + drag + collapse, body'ye eklenir)

TemplateEditorV7 (Inspector Binding)
├── creates: _inspectorPropertyPanel (PropertyPanel, panelId: 'inspector-property-panel')
├── creates: _inspectorLayersPanel (LayersPanel, panelId: 'inspector-layers-panel')
└── mounts into: #inspector-properties-container, #inspector-layers-container

ObjectFactory
├── imports: FabricExports (Canvas, FabricText, Rect, ...)
├── imports: CustomProperties (SERIALIZABLE_PROPS, ...)
└── imports: EventBus

CanvasManager
├── imports: FabricExports (Canvas)
├── imports: EventBus
└── provides: _normalizeTextScale() (object:modified event'inde metin scale duzeltme)

LegacyAdapter
├── imports: FabricExports
└── imports: CustomProperties

PavoDisplayGateway (Backend)
├── renderDynamicFields() (scaleX/scaleY + origin + textAlign + word-wrap)
├── wrapText() (kelime/karakter bazli metin sarmalama)
└── buildFieldValues() (urun verisi → alan degerleri esleme)
```
