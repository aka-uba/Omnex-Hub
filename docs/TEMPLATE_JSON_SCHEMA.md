# Şablon JSON Yapısı - Tam Dokümantasyon

Bu döküman, Omnex Display Hub şablon editörünün desteklediği JSON yapısını ve canvas elemanlarını detaylı olarak açıklar.

**Versiyon:** 2.0.14
**Son Güncelleme:** 2026-01-30

---

## İçindekiler

1. [Üst Seviye Şablon Yapısı](#1-üst-seviye-şablon-yapısı)
2. [Canvas JSON Yapısı](#2-canvas-json-yapısı)
3. [Eleman Tipleri](#3-eleman-tipleri)
   - [Metin (Text/IText)](#31-metin-elemanı-text--itext)
   - [Dikdörtgen (Rect)](#32-dikdörtgen-rect)
   - [Daire (Circle)](#33-daire-circle)
   - [Çizgi (Line)](#34-çizgi-line)
   - [Görsel (Image)](#35-görsel-image)
   - [Barkod](#36-barkod-elemanı)
   - [QR Kod](#37-qr-kod-elemanı)
   - [Video Placeholder](#38-video-placeholder)
   - [Fiyat Elemanı](#39-fiyat-elemanı)
   - [Çoklu Ürün Çerçevesi](#310-çoklu-ürün-çerçevesi)
4. [Dinamik Alanlar](#4-dinamik-alanlar-placeholderlar)
5. [Custom Properties](#5-custom-properties-listesi)
6. [Cihaz Presetleri](#6-cihaz-presetleri)
7. [Grid Layout Seçenekleri](#7-grid-layout-seçenekleri)
8. [Import/Export Formatı](#8-importexport-formatı)
9. [Örnek Şablonlar](#9-örnek-şablonlar)

---

## 1. Üst Seviye Şablon Yapısı

API'ye gönderilen şablon verisi:

```json
{
  "name": "Manav Etiketi",
  "description": "Meyve sebze için dikey etiket",
  "type": "label",
  "width": 800,
  "height": 1280,
  "orientation": "portrait",
  "target_device_type": "esl_101_portrait",
  "grid_layout": "split-vertical",
  "regions_config": "[{...}]",
  "design_data": "{...canvas JSON...}",
  "preview_image": "data:image/png;base64,...",
  "render_image": "data:image/png;base64,..."
}
```

### Alan Açıklamaları

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `name` | string | ✅ | Şablon adı (max 255 karakter) |
| `description` | string | ❌ | Şablon açıklaması |
| `type` | string | ✅ | Şablon tipi: `label`, `signage`, `tv` |
| `width` | number | ✅ | Canvas genişliği (piksel) |
| `height` | number | ✅ | Canvas yüksekliği (piksel) |
| `orientation` | string | ✅ | `portrait` veya `landscape` |
| `target_device_type` | string | ✅ | Hedef cihaz preset ID'si |
| `grid_layout` | string | ❌ | Grid düzen ID'si |
| `regions_config` | string | ❌ | Bölge yapılandırması (JSON string) |
| `design_data` | string | ✅ | Canvas içeriği (JSON string) |
| `preview_image` | string | ❌ | Önizleme görseli (base64) |
| `render_image` | string | ❌ | Tam boyut render (base64) |

---

## 2. Canvas JSON Yapısı

`design_data` alanının içeriği (Fabric.js formatı):

```json
{
  "version": "5.3.0",
  "objects": [
    // Eleman listesi
  ],
  "background": "#ffffff",
  "backgroundImage": null
}
```

| Alan | Tip | Açıklama |
|------|-----|----------|
| `version` | string | Fabric.js versiyonu |
| `objects` | array | Canvas üzerindeki elemanlar |
| `background` | string | Arka plan rengi (hex) |
| `backgroundImage` | object/null | Arka plan görseli |

---

## 3. Eleman Tipleri

### 3.1 Metin Elemanı (Text / IText)

Düzenlenebilir metin elemanı. Dinamik alanlar için kullanılır.

```json
{
  "type": "i-text",
  "version": "5.3.0",
  "originX": "left",
  "originY": "top",
  "left": 50,
  "top": 100,
  "width": 200,
  "height": 30,
  "fill": "#000000",
  "stroke": null,
  "strokeWidth": 1,
  "opacity": 1,
  "angle": 0,
  "scaleX": 1,
  "scaleY": 1,
  "flipX": false,
  "flipY": false,
  "visible": true,
  "selectable": true,
  "evented": true,
  "hasControls": true,
  "hasBorders": true,
  "lockMovementX": false,
  "lockMovementY": false,

  "text": "{{product_name}}",
  "fontSize": 24,
  "fontWeight": "bold",
  "fontFamily": "Arial",
  "fontStyle": "normal",
  "underline": false,
  "overline": false,
  "linethrough": false,
  "textAlign": "left",
  "lineHeight": 1.16,
  "charSpacing": 0,
  "textBackgroundColor": "",
  "shadow": null,

  "customType": null,
  "dynamicField": "product_name",
  "isDataField": true
}
```

#### Metin Özellikleri

| Özellik | Tip | Açıklama | Varsayılan |
|---------|-----|----------|------------|
| `text` | string | Metin içeriği veya `{{placeholder}}` | - |
| `fontSize` | number | Font boyutu (px) | 16 |
| `fontWeight` | string | `normal`, `bold`, `100`-`900` | `normal` |
| `fontFamily` | string | Font ailesi | `Arial` |
| `fontStyle` | string | `normal`, `italic`, `oblique` | `normal` |
| `underline` | boolean | Alt çizgi | false |
| `linethrough` | boolean | Üstü çizili | false |
| `textAlign` | string | `left`, `center`, `right`, `justify` | `left` |
| `lineHeight` | number | Satır yüksekliği çarpanı | 1.16 |
| `charSpacing` | number | Harf aralığı (px) | 0 |
| `fill` | string | Metin rengi (hex) | `#000000` |
| `textBackgroundColor` | string | Metin arka planı | `""` |

#### Desteklenen Fontlar

```
Arial, Helvetica, Times New Roman, Georgia, Verdana,
Tahoma, Trebuchet MS, Impact, Comic Sans MS, Courier New,
Roboto, Open Sans, Lato, Montserrat, Poppins
```

---

### 3.2 Dikdörtgen (Rect)

```json
{
  "type": "rect",
  "version": "5.3.0",
  "originX": "left",
  "originY": "top",
  "left": 0,
  "top": 0,
  "width": 400,
  "height": 300,
  "fill": "#228be6",
  "stroke": "#1971c2",
  "strokeWidth": 2,
  "opacity": 1,
  "angle": 0,
  "scaleX": 1,
  "scaleY": 1,
  "rx": 8,
  "ry": 8,
  "visible": true,
  "selectable": true,

  "customType": null,
  "isBackground": false
}
```

#### Dikdörtgen Özellikleri

| Özellik | Tip | Açıklama | Varsayılan |
|---------|-----|----------|------------|
| `rx` | number | Yatay köşe yuvarlaklığı | 0 |
| `ry` | number | Dikey köşe yuvarlaklığı | 0 |
| `fill` | string | Dolgu rengi (hex veya `transparent`) | `#ffffff` |
| `stroke` | string | Kenar rengi | `null` |
| `strokeWidth` | number | Kenar kalınlığı | 1 |

---

### 3.3 Daire (Circle)

```json
{
  "type": "circle",
  "version": "5.3.0",
  "left": 100,
  "top": 100,
  "radius": 50,
  "fill": "#40c057",
  "stroke": "#2f9e44",
  "strokeWidth": 2,
  "opacity": 1,
  "angle": 0,
  "scaleX": 1,
  "scaleY": 1,
  "startAngle": 0,
  "endAngle": 360
}
```

| Özellik | Tip | Açıklama |
|---------|-----|----------|
| `radius` | number | Yarıçap (px) |
| `startAngle` | number | Başlangıç açısı (derece) |
| `endAngle` | number | Bitiş açısı (derece) |

---

### 3.4 Çizgi (Line)

```json
{
  "type": "line",
  "version": "5.3.0",
  "left": 50,
  "top": 200,
  "x1": 0,
  "y1": 0,
  "x2": 300,
  "y2": 0,
  "stroke": "#dee2e6",
  "strokeWidth": 2,
  "strokeDashArray": null
}
```

| Özellik | Tip | Açıklama |
|---------|-----|----------|
| `x1`, `y1` | number | Başlangıç noktası |
| `x2`, `y2` | number | Bitiş noktası |
| `strokeDashArray` | array | Kesikli çizgi: `[5, 5]` |

---

### 3.5 Görsel (Image)

```json
{
  "type": "image",
  "version": "5.3.0",
  "originX": "left",
  "originY": "top",
  "left": 50,
  "top": 50,
  "width": 200,
  "height": 200,
  "scaleX": 1,
  "scaleY": 1,
  "angle": 0,
  "opacity": 1,
  "visible": true,
  "selectable": true,
  "src": "data:image/png;base64,... veya URL",
  "crossOrigin": "anonymous",
  "filters": [],

  "customType": "dynamic-image",
  "dynamicField": "image_url"
}
```

| Özellik | Tip | Açıklama |
|---------|-----|----------|
| `src` | string | Görsel kaynağı (URL veya base64) |
| `crossOrigin` | string | CORS ayarı: `anonymous` |
| `filters` | array | Görsel filtreleri |

#### Dinamik Görsel

Ürün görseli için `customType: "dynamic-image"` ve `dynamicField: "image_url"` kullanın.

---

### 3.6 Barkod Elemanı

```json
{
  "type": "image",
  "version": "5.3.0",
  "left": 50,
  "top": 500,
  "width": 200,
  "height": 80,
  "scaleX": 1,
  "scaleY": 1,
  "angle": 0,
  "opacity": 1,
  "src": "data:image/svg+xml;base64,...",

  "customType": "barcode",
  "dynamicField": "barcode",
  "barcodeValue": "{{barcode}}",
  "barcodeFormat": "EAN13",
  "originalBarcodeValue": "8690000000001"
}
```

#### Barkod Formatları

| Format | Açıklama | Uzunluk |
|--------|----------|---------|
| `EAN13` | 13 haneli EAN | 13 |
| `EAN8` | 8 haneli EAN | 8 |
| `CODE128` | Code 128 (alfanümerik) | Değişken |
| `CODE39` | Code 39 | Değişken |
| `UPC` | UPC-A | 12 |
| `ITF14` | ITF-14 (koli) | 14 |

---

### 3.7 QR Kod Elemanı

```json
{
  "type": "image",
  "version": "5.3.0",
  "left": 50,
  "top": 600,
  "width": 100,
  "height": 100,
  "scaleX": 1,
  "scaleY": 1,
  "angle": 0,
  "opacity": 1,
  "src": "data:image/png;base64,...",

  "customType": "qrcode",
  "dynamicField": "kunye_no",
  "qrValue": "{{kunye_no}}"
}
```

| Özellik | Tip | Açıklama |
|---------|-----|----------|
| `qrValue` | string | QR kod içeriği veya placeholder |

---

### 3.8 Video Placeholder

Signage şablonlarında video gösterimi için placeholder:

```json
{
  "type": "group",
  "version": "5.3.0",
  "left": 0,
  "top": 0,
  "width": 320,
  "height": 240,
  "objects": [
    {
      "type": "rect",
      "fill": "#1a1a2e",
      "rx": 4,
      "ry": 4
    },
    {
      "type": "circle",
      "fill": "rgba(255,255,255,0.2)"
    },
    {
      "type": "path",
      "fill": "#ffffff"
    },
    {
      "type": "text",
      "text": "video.mp4"
    }
  ],

  "customType": "video",
  "videoUrl": "/storage/media/promo.mp4",
  "videoAutoplay": true,
  "videoLoop": true,
  "videoMuted": true,
  "isVideoPlaceholder": true,
  "dynamicField": "video_url"
}
```

#### Video Özellikleri

| Özellik | Tip | Açıklama | Varsayılan |
|---------|-----|----------|------------|
| `videoUrl` | string | Video dosya yolu | - |
| `videoAutoplay` | boolean | Otomatik oynat | true |
| `videoLoop` | boolean | Döngü | true |
| `videoMuted` | boolean | Sessiz | true |
| `isVideoPlaceholder` | boolean | Placeholder işareti | true |

---

### 3.9 Fiyat Elemanı

Özel stil ile fiyat gösterimi:

```json
{
  "type": "i-text",
  "version": "5.3.0",
  "left": 100,
  "top": 200,
  "text": "{{current_price}}",
  "fontSize": 48,
  "fontWeight": "bold",
  "fontFamily": "Arial",
  "fill": "#e03131",

  "customType": "price",
  "dynamicField": "current_price"
}
```

**Önerilen Fiyat Stilleri:**

| Alan | Font Size | Weight | Renk |
|------|-----------|--------|------|
| Güncel Fiyat | 36-72 | bold | `#e03131` (kırmızı) |
| Eski Fiyat | 18-28 | normal | `#868e96` (gri) + üstü çizili |
| İndirim % | 24-36 | bold | `#2f9e44` (yeşil) |

---

### 3.10 Çoklu Ürün Çerçevesi

Tek şablonda birden fazla ürün gösterimi:

```json
{
  "type": "group",
  "version": "5.3.0",
  "left": 0,
  "top": 0,
  "width": 800,
  "height": 1280,
  "objects": [
    // Slot arka planları ve içerikler
  ],

  "customType": "multi-product-frame",
  "frameCols": 2,
  "frameRows": 2,
  "activeSlotId": 1,
  "slots": [
    {
      "id": 1,
      "x": 0,
      "y": 0,
      "width": 400,
      "height": 640,
      "fields": ["product_name", "current_price", "barcode"]
    },
    {
      "id": 2,
      "x": 400,
      "y": 0,
      "width": 400,
      "height": 640,
      "fields": ["product_name", "current_price"]
    }
  ]
}
```

#### Desteklenen Layout'lar

| Layout | Grid | Slot Sayısı |
|--------|------|-------------|
| `1x2` | 1 sütun, 2 satır | 2 |
| `2x1` | 2 sütun, 1 satır | 2 |
| `2x2` | 2 sütun, 2 satır | 4 |
| `3x1` | 3 sütun, 1 satır | 3 |
| `2x3` | 2 sütun, 3 satır | 6 |

#### Slot İçi Eleman

```json
{
  "type": "i-text",
  "text": "{{product_name}}",
  "fontSize": 18,

  "slotId": 1,
  "inMultiFrame": true,
  "parentFrameId": "frame-uuid",
  "dynamicField": "product_name"
}
```

---

## 4. Dinamik Alanlar (Placeholder'lar)

Tüm dinamik alanlar `{{alan_adi}}` formatında kullanılır.

### Temel Bilgiler

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Ürün Adı | `{{product_name}}` | "Örnek Ürün Adı" | Ana ürün ismi |
| SKU | `{{sku}}` | "SKU-001" | Stok kodu |
| Barkod | `{{barcode}}` | "8690000000001" | EAN/UPC barkod |
| Açıklama | `{{description}}` | "Ürün açıklaması..." | Detaylı açıklama |
| Slug | `{{slug}}` | "ornek-urun-adi" | URL-friendly isim |

### Fiyat Bilgileri

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Güncel Fiyat | `{{current_price}}` | "29.99" | Satış fiyatı |
| Eski Fiyat | `{{previous_price}}` | "39.99" | İndirim öncesi |
| KDV Oranı | `{{vat_rate}}` | "%20" | Vergi oranı |
| İndirim % | `{{discount_percent}}` | "%25" | İndirim yüzdesi |
| Fiyat Güncelleme | `{{price_updated_at}}` | "14.01.2026" | Son değişiklik |
| Kampanya Metni | `{{campaign_text}}` | "SÜPER FIRSAT!" | Promosyon yazısı |
| Fiyat Geçerlilik | `{{price_valid_until}}` | "31.01.2026" | Geçerlilik tarihi |

### Kategori ve Marka

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Kategori | `{{category}}` | "Meyve & Sebze" | Ana kategori |
| Alt Kategori | `{{subcategory}}` | "Meyveler" | Alt kategori |
| Marka | `{{brand}}` | "MarkaAdı" | Ürün markası |

### Ürün Detayları

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Birim | `{{unit}}` | "kg" | Ölçü birimi |
| Ağırlık | `{{weight}}` | "500g" | Ürün ağırlığı |
| Stok | `{{stock}}` | "150" | Stok miktarı |
| Menşei | `{{origin}}` | "Türkiye" | Üretim yeri |
| Üretim Tipi | `{{production_type}}` | "Organik" | Üretim şekli |

### Konum ve Lojistik

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Raf Konumu | `{{shelf_location}}` | "A-12-3" | Mağaza konumu |
| Tedarikçi Kodu | `{{supplier_code}}` | "SUP-001" | Tedarikçi ref. |

### Künye (Tarımsal İzlenebilirlik)

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Künye No | `{{kunye_no}}` | "KNY-2026-001" | HAL künye numarası |

### Medya

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Ürün Görseli | `{{image_url}}` | [GÖRSEL] | Ana ürün fotoğrafı |
| Video URL | `{{video_url}}` | [VIDEO] | Tekli video |
| Video Listesi | `{{videos}}` | [VİDEO LİSTESİ] | Çoklu video |

### Özel Alanlar

| Alan | Placeholder | Önizleme | Açıklama |
|------|-------------|----------|----------|
| Bugünün Tarihi | `{{date_today}}` | "21.01.2026" | Güncel tarih |
| Tarih ve Saat | `{{date_time}}` | "21.01.2026 14:30" | Güncel tarih/saat |

---

## 5. Custom Properties Listesi

Canvas kaydedilirken korunan özel özellikler:

```javascript
const CUSTOM_PROPS = [
  // Temel
  'customType',        // Eleman tipi
  'isDataField',       // Dinamik alan mı?
  'dynamicField',      // Bağlı ürün alanı
  'regionId',          // Bölge ID'si

  // Görünüm kontrolü
  'isRegionOverlay',   // Grid overlay
  'isBackground',      // Arka plan
  'isVideoPlaceholder', // Video placeholder
  'isMultipleVideos',  // Çoklu video

  // Çoklu Ürün Çerçevesi
  'slots',             // Slot listesi
  'frameCols',         // Sütun sayısı
  'frameRows',         // Satır sayısı
  'activeSlotId',      // Aktif slot
  'slotId',            // Slot ID
  'inMultiFrame',      // Multi-frame içinde
  'parentFrameId',     // Üst frame ID
  'isSlotBackground',  // Slot arka planı
  'isSlotLabel',       // Slot etiketi
  'isSlotPlaceholder', // Slot placeholder

  // Barkod/QR
  'barcodeValue',      // Barkod değeri
  'qrValue',           // QR kod değeri
  'originalBarcodeValue', // Orijinal değer
  'barcodeFormat'      // Format (EAN13, CODE128)
];
```

### customType Değerleri

| Değer | Açıklama |
|-------|----------|
| `null` | Standart eleman |
| `barcode` | Barkod görseli |
| `qrcode` | QR kod görseli |
| `price` | Fiyat metni |
| `dynamic-image` | Dinamik görsel |
| `video` | Video placeholder |
| `multi-product-frame` | Çoklu ürün çerçevesi |

---

## 6. Cihaz Presetleri

### ESL (Elektronik Raf Etiketi)

| Preset ID | Boyut | Çözünürlük | Yön |
|-----------|-------|------------|-----|
| `esl_29` | 2.9" | 296x128 | Yatay |
| `esl_42` | 4.2" | 400x300 | Yatay |
| `esl_75` | 7.5" | 800x480 | Yatay |
| `esl_101_portrait` | 10.1" | 800x1280 | Dikey |
| `esl_101_landscape` | 10.1" | 1280x800 | Yatay |

### Signage (Dijital Tabela)

| Preset ID | Boyut | Çözünürlük | Yön |
|-----------|-------|------------|-----|
| `signage_hd` | HD | 1920x1080 | Yatay |
| `signage_hd_portrait` | HD | 1080x1920 | Dikey |
| `signage_4k` | 4K | 3840x2160 | Yatay |

### Poster

| Preset ID | Boyut | Çözünürlük | Yön |
|-----------|-------|------------|-----|
| `poster_a4` | A4 | 595x842 | Dikey |
| `poster_a3` | A3 | 842x1191 | Dikey |

---

## 7. Grid Layout Seçenekleri

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

---

## 8. Import/Export Formatı

### Dışa Aktarma (Export)

```json
{
  "exportVersion": "2.0.0",
  "exportDate": "2026-01-21T14:30:00Z",
  "templates": [
    {
      "name": "Şablon Adı",
      "description": "Açıklama",
      "type": "label",
      "width": 800,
      "height": 1280,
      "orientation": "portrait",
      "target_device_type": "esl_101_portrait",
      "grid_layout": "split-vertical",
      "regions_config": "...",
      "design_data": "...",
      "preview_image": "data:image/png;base64,..."
    }
  ]
}
```

### İçe Aktarma (Import)

Aynı format kullanılır. Aynı isimli şablon varsa:
- **Son ek ekle**: "Şablon Adı (1)"
- **Üzerine yaz**: Mevcut şablonu güncelle
- **Atla**: İçe aktarma

---

## 9. Örnek Şablonlar

### 9.1 Basit Manav Etiketi

```json
{
  "name": "Basit Manav Etiketi",
  "type": "label",
  "width": 800,
  "height": 1280,
  "orientation": "portrait",
  "target_device_type": "esl_101_portrait",
  "grid_layout": "single",
  "design_data": {
    "version": "5.3.0",
    "objects": [
      {
        "type": "i-text",
        "left": 50,
        "top": 50,
        "text": "{{product_name}}",
        "fontSize": 36,
        "fontWeight": "bold",
        "fill": "#1a1a2e",
        "dynamicField": "product_name",
        "isDataField": true
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 120,
        "text": "{{origin}}",
        "fontSize": 18,
        "fill": "#495057",
        "dynamicField": "origin"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 200,
        "text": "{{current_price}}",
        "fontSize": 72,
        "fontWeight": "bold",
        "fill": "#e03131",
        "customType": "price",
        "dynamicField": "current_price"
      },
      {
        "type": "i-text",
        "left": 350,
        "top": 230,
        "text": "₺/{{unit}}",
        "fontSize": 24,
        "fill": "#495057",
        "dynamicField": "unit"
      },
      {
        "type": "image",
        "left": 50,
        "top": 350,
        "width": 200,
        "height": 80,
        "customType": "barcode",
        "dynamicField": "barcode",
        "barcodeFormat": "EAN13"
      }
    ],
    "background": "#ffffff"
  }
}
```

### 9.2 Promosyon Etiketi (İndirimli)

```json
{
  "name": "Promosyon Etiketi",
  "type": "label",
  "width": 800,
  "height": 1280,
  "design_data": {
    "version": "5.3.0",
    "objects": [
      {
        "type": "rect",
        "left": 0,
        "top": 0,
        "width": 800,
        "height": 150,
        "fill": "#e03131"
      },
      {
        "type": "i-text",
        "left": 400,
        "top": 75,
        "originX": "center",
        "originY": "center",
        "text": "{{campaign_text}}",
        "fontSize": 48,
        "fontWeight": "bold",
        "fill": "#ffffff",
        "dynamicField": "campaign_text"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 200,
        "text": "{{product_name}}",
        "fontSize": 32,
        "fontWeight": "bold",
        "fill": "#1a1a2e",
        "dynamicField": "product_name"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 300,
        "text": "{{previous_price}} ₺",
        "fontSize": 28,
        "fill": "#868e96",
        "linethrough": true,
        "dynamicField": "previous_price"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 380,
        "text": "{{current_price}}",
        "fontSize": 96,
        "fontWeight": "bold",
        "fill": "#e03131",
        "customType": "price",
        "dynamicField": "current_price"
      },
      {
        "type": "i-text",
        "left": 400,
        "top": 420,
        "text": "₺",
        "fontSize": 48,
        "fill": "#e03131"
      },
      {
        "type": "rect",
        "left": 600,
        "top": 300,
        "width": 150,
        "height": 150,
        "fill": "#2f9e44",
        "rx": 75,
        "ry": 75
      },
      {
        "type": "i-text",
        "left": 675,
        "top": 375,
        "originX": "center",
        "originY": "center",
        "text": "{{discount_percent}}",
        "fontSize": 36,
        "fontWeight": "bold",
        "fill": "#ffffff",
        "dynamicField": "discount_percent"
      }
    ],
    "background": "#ffffff"
  }
}
```

### 9.3 Organik Ürün Etiketi

```json
{
  "name": "Organik Ürün Etiketi",
  "type": "label",
  "width": 800,
  "height": 1280,
  "design_data": {
    "version": "5.3.0",
    "objects": [
      {
        "type": "rect",
        "left": 0,
        "top": 0,
        "width": 800,
        "height": 100,
        "fill": "#2f9e44"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 50,
        "originY": "center",
        "text": "{{production_type}}",
        "fontSize": 32,
        "fontWeight": "bold",
        "fill": "#ffffff",
        "dynamicField": "production_type"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 150,
        "text": "{{product_name}}",
        "fontSize": 36,
        "fontWeight": "bold",
        "fill": "#1a1a2e",
        "dynamicField": "product_name"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 220,
        "text": "Menşei: {{origin}}",
        "fontSize": 18,
        "fill": "#495057",
        "dynamicField": "origin"
      },
      {
        "type": "i-text",
        "left": 50,
        "top": 300,
        "text": "{{current_price}}",
        "fontSize": 64,
        "fontWeight": "bold",
        "fill": "#2f9e44",
        "customType": "price",
        "dynamicField": "current_price"
      },
      {
        "type": "i-text",
        "left": 300,
        "top": 330,
        "text": "₺/{{unit}}",
        "fontSize": 24,
        "fill": "#495057",
        "dynamicField": "unit"
      },
      {
        "type": "image",
        "left": 550,
        "top": 150,
        "width": 200,
        "height": 200,
        "customType": "dynamic-image",
        "dynamicField": "image_url"
      },
      {
        "type": "image",
        "left": 50,
        "top": 450,
        "width": 180,
        "height": 70,
        "customType": "barcode",
        "dynamicField": "barcode",
        "barcodeFormat": "EAN13"
      },
      {
        "type": "image",
        "left": 650,
        "top": 400,
        "width": 120,
        "height": 120,
        "customType": "qrcode",
        "dynamicField": "kunye_no"
      },
      {
        "type": "i-text",
        "left": 650,
        "top": 530,
        "text": "Künye",
        "fontSize": 12,
        "fill": "#868e96",
        "textAlign": "center"
      }
    ],
    "background": "#f8f9fa"
  }
}
```

---

## Notlar

1. **Dinamik Alanlar**: Render sırasında `{{placeholder}}` değerleri gerçek ürün verileriyle değiştirilir.

2. **Barkod/QR**: Görsel olarak SVG veya PNG formatında render edilir. `barcodeValue` veya `qrValue` dinamik olabilir.

3. **Video**: ESL cihazlarında video desteklenmez, sadece placeholder gösterilir. Signage cihazlarında gerçek video oynatılır.

4. **Çoklu Ürün**: Her slot bağımsız ürün verisi alabilir. Render sırasında ürün dizisi gönderilir.

5. **Import/Export**: Şablonlar JSON formatında dışa/içe aktarılabilir. Görsel base64 olarak saklanır.
