# Fabric.js 5.3.0 Obje Şema Referansı

Bu doküman, Omnex Display Hub şablon sistemi için Fabric.js objelerinin beklenen yapısını ve varsayılan değerlerini tanımlar.

## İçindekiler

1. [Genel Bilgiler](#genel-bilgiler)
2. [Ortak Özellikler (Base Object)](#ortak-özellikler-base-object)
3. [Text / I-Text Objesi](#text--i-text-objesi)
4. [Rect (Dikdörtgen) Objesi](#rect-dikdörtgen-objesi)
5. [Circle (Daire) Objesi](#circle-daire-objesi)
6. [Line (Çizgi) Objesi](#line-çizgi-objesi)
7. [Image (Görsel) Objesi](#image-görsel-objesi)
8. [Group (Grup) Objesi](#group-grup-objesi)
9. [Özel Tipler (customType)](#özel-tipler-customtype)
10. [Canvas JSON Yapısı](#canvas-json-yapısı)
11. [Enum Değerleri](#enum-değerleri)
12. [PHP Helper Fonksiyonları](#php-helper-fonksiyonları)

---

## Genel Bilgiler

### Fabric.js Versiyonu
```
5.3.0
```

### Kritik Notlar

1. **textBaseline Değerleri**: Canvas2D API için geçerli değerler:
   - `top`, `hanging`, `middle`, `alphabetic`, `ideographic`, `bottom`
   - ⚠️ `alphabetical` GEÇERSİZ! `alphabetic` kullanın.

2. **styles Özelliği**: i-text için `styles` MUTLAKA tanımlanmalı, boş bile olsa `[]` olmalı.

3. **version Özelliği**: Her obje `"version": "5.3.0"` içermeli.

4. **Renk Formatları**: HEX (`#ffffff`), RGB (`rgb(255,255,255)`), RGBA (`rgba(0,0,0,0.5)`)

---

## Ortak Özellikler (Base Object)

Tüm Fabric.js objeleri bu temel özellikleri paylaşır:

```json
{
    "type": "rect",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 100,
    "height": 100,
    "fill": "#000000",
    "stroke": null,
    "strokeWidth": 1,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0
}
```

### Özellik Açıklamaları

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `type` | string | - | Obje tipi (zorunlu) |
| `version` | string | "5.3.0" | Fabric.js versiyonu |
| `originX` | string | "left" | Yatay orijin noktası |
| `originY` | string | "top" | Dikey orijin noktası |
| `left` | number | 0 | X koordinatı (piksel) |
| `top` | number | 0 | Y koordinatı (piksel) |
| `width` | number | 0 | Genişlik (piksel) |
| `height` | number | 0 | Yükseklik (piksel) |
| `fill` | string/null | "#000000" | Dolgu rengi |
| `stroke` | string/null | null | Kenar rengi |
| `strokeWidth` | number | 1 | Kenar kalınlığı |
| `strokeDashArray` | array/null | null | Kesikli çizgi deseni |
| `strokeLineCap` | string | "butt" | Çizgi ucu stili |
| `strokeDashOffset` | number | 0 | Kesikli çizgi offset |
| `strokeLineJoin` | string | "miter" | Çizgi birleşim stili |
| `strokeUniform` | boolean | false | Uniform stroke scale |
| `strokeMiterLimit` | number | 4 | Miter limit |
| `scaleX` | number | 1 | Yatay ölçek |
| `scaleY` | number | 1 | Dikey ölçek |
| `angle` | number | 0 | Döndürme açısı (derece) |
| `flipX` | boolean | false | Yatay çevirme |
| `flipY` | boolean | false | Dikey çevirme |
| `opacity` | number | 1 | Saydamlık (0-1) |
| `shadow` | object/null | null | Gölge ayarları |
| `visible` | boolean | true | Görünürlük |
| `backgroundColor` | string | "" | Arka plan rengi |
| `fillRule` | string | "nonzero" | Dolgu kuralı |
| `paintFirst` | string | "fill" | Önce dolgu mu kenar mı |
| `globalCompositeOperation` | string | "source-over" | Kompozit işlem |
| `skewX` | number | 0 | Yatay eğrilik |
| `skewY` | number | 0 | Dikey eğrilik |

---

## Text / I-Text Objesi

Interactive text objesi. Editörde düzenlenebilir metin.

```json
{
    "type": "i-text",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 100,
    "top": 100,
    "width": 200,
    "height": 50,
    "fill": "#000000",
    "stroke": null,
    "strokeWidth": 1,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "text": "Sample Text",
    "fontSize": 40,
    "fontWeight": "normal",
    "fontFamily": "Arial",
    "fontStyle": "normal",
    "lineHeight": 1.16,
    "underline": false,
    "overline": false,
    "linethrough": false,
    "textAlign": "left",
    "textBackgroundColor": "",
    "charSpacing": 0,
    "styles": [],
    "direction": "ltr",
    "path": null,
    "pathStartOffset": 0,
    "pathSide": "left",
    "pathAlign": "baseline"
}
```

### Text Özellik Açıklamaları

| Özellik | Tip | Varsayılan | Geçerli Değerler | Açıklama |
|---------|-----|------------|------------------|----------|
| `text` | string | "" | - | Metin içeriği |
| `fontSize` | number | 40 | > 0 | Font boyutu (piksel) |
| `fontWeight` | string/number | "normal" | "normal", "bold", 100-900 | Font kalınlığı |
| `fontFamily` | string | "Arial" | - | Font ailesi |
| `fontStyle` | string | "normal" | "normal", "italic", "oblique" | Font stili |
| `lineHeight` | number | 1.16 | > 0 | Satır yüksekliği çarpanı |
| `underline` | boolean | false | true, false | Alt çizgi |
| `overline` | boolean | false | true, false | Üst çizgi |
| `linethrough` | boolean | false | true, false | Üstü çizili |
| `textAlign` | string | "left" | "left", "center", "right", "justify" | Metin hizalama |
| `textBackgroundColor` | string | "" | Renk kodu | Metin arka plan rengi |
| `charSpacing` | number | 0 | - | Karakter aralığı |
| `styles` | array | [] | - | Karakter bazlı stiller (ZORUNLU!) |
| `direction` | string | "ltr" | "ltr", "rtl" | Metin yönü |
| `path` | object/null | null | - | Metin yolu |
| `pathStartOffset` | number | 0 | - | Yol başlangıç offset |
| `pathSide` | string | "left" | "left", "right" | Yol tarafı |
| `pathAlign` | string | "baseline" | "baseline", "center" | Yol hizalama |

### ⚠️ Kritik: styles Özelliği

`styles` özelliği **MUTLAKA** tanımlanmalıdır. Boş bile olsa `[]` olmalı:

```json
{
    "styles": []
}
```

Karakter bazlı stil için:
```json
{
    "styles": [
        {
            "0": { "fill": "#ff0000", "fontWeight": "bold" },
            "1": { "fill": "#00ff00" }
        }
    ]
}
```

---

## Rect (Dikdörtgen) Objesi

```json
{
    "type": "rect",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 100,
    "height": 100,
    "fill": "#ffffff",
    "stroke": "#000000",
    "strokeWidth": 1,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "rx": 0,
    "ry": 0
}
```

### Rect Özel Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `rx` | number | 0 | Yatay köşe yuvarlaklığı |
| `ry` | number | 0 | Dikey köşe yuvarlaklığı |

---

## Circle (Daire) Objesi

```json
{
    "type": "circle",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 100,
    "height": 100,
    "fill": "#ffffff",
    "stroke": "#000000",
    "strokeWidth": 1,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "radius": 50,
    "startAngle": 0,
    "endAngle": 360
}
```

### Circle Özel Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `radius` | number | 50 | Yarıçap (piksel) |
| `startAngle` | number | 0 | Başlangıç açısı (derece) |
| `endAngle` | number | 360 | Bitiş açısı (derece) |

---

## Line (Çizgi) Objesi

```json
{
    "type": "line",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 100,
    "height": 0,
    "fill": "#000000",
    "stroke": "#000000",
    "strokeWidth": 1,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "x1": 0,
    "y1": 0,
    "x2": 100,
    "y2": 0
}
```

### Line Özel Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `x1` | number | 0 | Başlangıç X koordinatı |
| `y1` | number | 0 | Başlangıç Y koordinatı |
| `x2` | number | 100 | Bitiş X koordinatı |
| `y2` | number | 0 | Bitiş Y koordinatı |

---

## Image (Görsel) Objesi

```json
{
    "type": "image",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 100,
    "height": 100,
    "fill": "rgb(0,0,0)",
    "stroke": null,
    "strokeWidth": 0,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "cropX": 0,
    "cropY": 0,
    "src": "",
    "crossOrigin": null,
    "filters": []
}
```

### Image Özel Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `src` | string | "" | Görsel URL veya base64 |
| `cropX` | number | 0 | Kırpma X offset |
| `cropY` | number | 0 | Kırpma Y offset |
| `crossOrigin` | string/null | null | CORS ayarı ("", "anonymous", "use-credentials") |
| `filters` | array | [] | Görsel filtreleri |

---

## Group (Grup) Objesi

```json
{
    "type": "group",
    "version": "5.3.0",
    "originX": "left",
    "originY": "top",
    "left": 0,
    "top": 0,
    "width": 200,
    "height": 200,
    "fill": "rgb(0,0,0)",
    "stroke": null,
    "strokeWidth": 0,
    "strokeDashArray": null,
    "strokeLineCap": "butt",
    "strokeDashOffset": 0,
    "strokeLineJoin": "miter",
    "strokeUniform": false,
    "strokeMiterLimit": 4,
    "scaleX": 1,
    "scaleY": 1,
    "angle": 0,
    "flipX": false,
    "flipY": false,
    "opacity": 1,
    "shadow": null,
    "visible": true,
    "backgroundColor": "",
    "fillRule": "nonzero",
    "paintFirst": "fill",
    "globalCompositeOperation": "source-over",
    "skewX": 0,
    "skewY": 0,
    "objects": []
}
```

### Group Özel Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `objects` | array | [] | Grup içindeki objeler |

---

## Özel Tipler (customType)

Omnex Display Hub'a özel objeler için `customType` özelliği kullanılır:

### Dinamik Metin Alanı
```json
{
    "type": "i-text",
    "customType": "dynamic-text",
    "dynamicField": "product_name",
    "isDataField": true,
    "text": "{{product_name}}"
}
```

### Fiyat Alanı
```json
{
    "type": "i-text",
    "customType": "price",
    "dynamicField": "current_price",
    "isDataField": true,
    "text": "{{current_price}}"
}
```

### Barkod
```json
{
    "type": "image",
    "customType": "barcode",
    "dynamicField": "barcode",
    "isDataField": true,
    "barcodeFormat": "EAN13",
    "barcodeValue": "{{barcode}}"
}
```

### QR Kod
```json
{
    "type": "image",
    "customType": "qrcode",
    "dynamicField": "kunye_no",
    "isDataField": true,
    "qrValue": "{{kunye_no}}"
}
```

### Dinamik Görsel
```json
{
    "type": "image",
    "customType": "dynamic-image",
    "dynamicField": "image_url",
    "isDataField": true,
    "src": "{{image_url}}"
}
```

### Slot (Çoklu Ürün)
```json
{
    "type": "i-text",
    "customType": "slot-text",
    "slotId": 1,
    "inMultiFrame": true,
    "parentFrameId": "frame-uuid",
    "dynamicField": "product_name"
}
```

### Desteklenen customType Değerleri

| customType | Açıklama |
|------------|----------|
| `dynamic-text` | Dinamik metin alanı |
| `price` | Fiyat alanı |
| `barcode` | Barkod görseli |
| `qrcode` | QR kod görseli |
| `dynamic-image` | Dinamik görsel |
| `slot-text` | Slot içi metin |
| `slot-barcode` | Slot içi barkod |
| `slot-qrcode` | Slot içi QR kod |
| `slot-image` | Slot içi görsel |
| `multi-product-frame` | Çoklu ürün çerçevesi |
| `region-background` | Bölge arka planı |

### Desteklenen dynamicField Değerleri

| Alan | Açıklama |
|------|----------|
| `product_name` | Ürün adı |
| `sku` | Stok kodu |
| `barcode` | Barkod numarası |
| `description` | Ürün açıklaması |
| `slug` | URL-safe isim |
| `current_price` | Güncel fiyat |
| `previous_price` | Eski fiyat |
| `vat_rate` | KDV oranı |
| `discount_percent` | İndirim yüzdesi |
| `campaign_text` | Kampanya metni |
| `price_updated_at` | Fiyat güncelleme tarihi |
| `price_valid_until` | Fiyat geçerlilik tarihi |
| `category` | Kategori |
| `subcategory` | Alt kategori |
| `brand` | Marka |
| `unit` | Birim (kg, adet, lt) |
| `weight` | Ağırlık |
| `stock` | Stok miktarı |
| `origin` | Menşei |
| `production_type` | Üretim tipi |
| `shelf_location` | Raf konumu |
| `supplier_code` | Tedarikçi kodu |
| `kunye_no` | HAL künye numarası |
| `image_url` | Ürün görseli URL |

---

## Canvas JSON Yapısı

Tam bir şablon için canvas JSON yapısı:

```json
{
    "version": "5.3.0",
    "objects": [
        {
            "type": "rect",
            "...": "..."
        },
        {
            "type": "i-text",
            "...": "..."
        }
    ],
    "background": "#ffffff",
    "backgroundImage": null
}
```

### Canvas Özellikleri

| Özellik | Tip | Varsayılan | Açıklama |
|---------|-----|------------|----------|
| `version` | string | "5.3.0" | Fabric.js versiyonu |
| `objects` | array | [] | Canvas üzerindeki objeler |
| `background` | string | "#ffffff" | Arka plan rengi |
| `backgroundImage` | object/null | null | Arka plan görseli |

---

## Enum Değerleri

### originX / originY
```
"left", "center", "right"  (originX)
"top", "center", "bottom"  (originY)
```

### textAlign
```
"left", "center", "right", "justify", "justify-left", "justify-center", "justify-right"
```

### fontStyle
```
"normal", "italic", "oblique"
```

### fontWeight
```
"normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"
```

### strokeLineCap
```
"butt", "round", "square"
```

### strokeLineJoin
```
"miter", "round", "bevel"
```

### fillRule
```
"nonzero", "evenodd"
```

### direction
```
"ltr", "rtl"
```

### globalCompositeOperation
```
"source-over", "source-in", "source-out", "source-atop",
"destination-over", "destination-in", "destination-out", "destination-atop",
"lighter", "copy", "xor", "multiply", "screen", "overlay", "darken", "lighten",
"color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion",
"hue", "saturation", "color", "luminosity"
```

---

## PHP Helper Fonksiyonları

Şablon oluştururken kullanılacak PHP helper fonksiyonları:

### createTextObject()

```php
function createTextObject($props) {
    $defaults = [
        'type' => 'i-text',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => 0,
        'top' => 0,
        'width' => 100,
        'height' => 50,
        'fill' => '#000000',
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeUniform' => false,
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'text' => '',
        'fontSize' => 40,
        'fontWeight' => 'normal',
        'fontFamily' => 'Arial',
        'fontStyle' => 'normal',
        'lineHeight' => 1.16,
        'underline' => false,
        'overline' => false,
        'linethrough' => false,
        'textAlign' => 'left',
        'textBackgroundColor' => '',
        'charSpacing' => 0,
        'styles' => [],
        'direction' => 'ltr',
        'path' => null,
        'pathStartOffset' => 0,
        'pathSide' => 'left',
        'pathAlign' => 'baseline'
    ];

    return array_merge($defaults, $props);
}
```

### createRectObject()

```php
function createRectObject($props) {
    $defaults = [
        'type' => 'rect',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => 0,
        'top' => 0,
        'width' => 100,
        'height' => 100,
        'fill' => '#ffffff',
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeUniform' => false,
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'rx' => 0,
        'ry' => 0
    ];

    return array_merge($defaults, $props);
}
```

### createCircleObject()

```php
function createCircleObject($props) {
    $defaults = [
        'type' => 'circle',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => 0,
        'top' => 0,
        'width' => 100,
        'height' => 100,
        'fill' => '#ffffff',
        'stroke' => null,
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeUniform' => false,
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'radius' => 50,
        'startAngle' => 0,
        'endAngle' => 360
    ];

    return array_merge($defaults, $props);
}
```

### createLineObject()

```php
function createLineObject($props) {
    $defaults = [
        'type' => 'line',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => 0,
        'top' => 0,
        'width' => 100,
        'height' => 0,
        'fill' => '#000000',
        'stroke' => '#000000',
        'strokeWidth' => 1,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeUniform' => false,
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'x1' => 0,
        'y1' => 0,
        'x2' => 100,
        'y2' => 0
    ];

    return array_merge($defaults, $props);
}
```

### createImageObject()

```php
function createImageObject($props) {
    $defaults = [
        'type' => 'image',
        'version' => '5.3.0',
        'originX' => 'left',
        'originY' => 'top',
        'left' => 0,
        'top' => 0,
        'width' => 100,
        'height' => 100,
        'fill' => 'rgb(0,0,0)',
        'stroke' => null,
        'strokeWidth' => 0,
        'strokeDashArray' => null,
        'strokeLineCap' => 'butt',
        'strokeDashOffset' => 0,
        'strokeLineJoin' => 'miter',
        'strokeUniform' => false,
        'strokeMiterLimit' => 4,
        'scaleX' => 1,
        'scaleY' => 1,
        'angle' => 0,
        'flipX' => false,
        'flipY' => false,
        'opacity' => 1,
        'shadow' => null,
        'visible' => true,
        'backgroundColor' => '',
        'fillRule' => 'nonzero',
        'paintFirst' => 'fill',
        'globalCompositeOperation' => 'source-over',
        'skewX' => 0,
        'skewY' => 0,
        'cropX' => 0,
        'cropY' => 0,
        'src' => '',
        'crossOrigin' => null,
        'filters' => []
    ];

    return array_merge($defaults, $props);
}
```

---

## Örnek Şablon Oluşturma

### Basit Fiyat Etiketi

```php
$template = [
    'version' => '5.3.0',
    'objects' => [
        // Arka plan
        createRectObject([
            'left' => 0,
            'top' => 0,
            'width' => 800,
            'height' => 1280,
            'fill' => '#ffffff'
        ]),

        // Ürün Adı
        createTextObject([
            'left' => 50,
            'top' => 100,
            'text' => '{{product_name}}',
            'fontSize' => 60,
            'fontWeight' => 'bold',
            'fill' => '#000000',
            'customType' => 'dynamic-text',
            'dynamicField' => 'product_name',
            'isDataField' => true
        ]),

        // Fiyat
        createTextObject([
            'left' => 50,
            'top' => 200,
            'text' => '{{current_price}} ₺',
            'fontSize' => 120,
            'fontWeight' => 'bold',
            'fill' => '#e63946',
            'customType' => 'price',
            'dynamicField' => 'current_price',
            'isDataField' => true
        ]),

        // Barkod placeholder
        createImageObject([
            'left' => 50,
            'top' => 400,
            'width' => 300,
            'height' => 100,
            'customType' => 'barcode',
            'dynamicField' => 'barcode',
            'isDataField' => true,
            'barcodeFormat' => 'EAN13',
            'barcodeValue' => '{{barcode}}'
        ])
    ],
    'background' => '#ffffff'
];
```

---

## Sık Yapılan Hatalar

### 1. styles Eksik
```json
// ❌ YANLIŞ
{ "type": "i-text", "text": "Hello" }

// ✅ DOĞRU
{ "type": "i-text", "text": "Hello", "styles": [] }
```

### 2. textBaseline Yanlış Değer
```json
// ❌ YANLIŞ (alphabetical geçersiz)
{ "textBaseline": "alphabetical" }

// ✅ DOĞRU
{ "textBaseline": "alphabetic" }
```

### 3. version Eksik
```json
// ❌ YANLIŞ
{ "type": "rect", "left": 0 }

// ✅ DOĞRU
{ "type": "rect", "version": "5.3.0", "left": 0 }
```

### 4. Null yerine Boş String
```json
// ❌ YANLIŞ (some contexts)
{ "stroke": "" }

// ✅ DOĞRU
{ "stroke": null }
```

---

## Versiyon Geçmişi

| Tarih | Versiyon | Değişiklik |
|-------|----------|------------|
| 2026-01-30 | 1.0.0 | İlk sürüm |

---

*Bu doküman Omnex Display Hub v2.0.14 için oluşturulmuştur.*
