# Responsive Template Rendering

Tek bir sablon tasariminin farkli cihaz boyutlarina (ESL 2.9" - 10.1", tablet, TV) otomatik uyum saglamasi icin olcekleme sistemi.

**Tarih:** 2026-02-25
**Versiyon:** 1.0.0
**Migration:** 068_responsive_template_support.sql

---

## Ozet

Normalde her cihaz boyutu icin ayri sablon tasarlamak gerekir. Bu sistem sayesinde tek bir tasarim, farkli cihaz cozunurluklerine render sirasinda otomatik olarak olceklenir.

**Temel Prensipler:**
- Grid bolgeleri yuzde bazli (`widthPercent`, `heightPercent`) → cozunurlukten bagimsiz
- Objeler bolge-ici **relative koordinatlar** ile saklanir (% cinsinden)
- Render aninda `ResponsiveScaler` kaynak boyuttan hedef boyuta donusum yapar
- Mevcut sablonlar etkilenmez (`responsive_mode='off'` varsayilan)

---

## Mimari

```
┌──────────────────────────────────────────────────────────────┐
│                        EDITOR (Frontend)                      │
│                                                                │
│  TemplateEditorV7.js                                          │
│    save() → _computeRelativeCoords()                          │
│    Her objenin bolge-ici % konumunu hesaplar                  │
│                                                                │
│  GridManager.js                                                │
│    object:modified → _autoAssignRegion()                      │
│    Obje hangi bolgeye aitse regionId atar                     │
│                                                                │
│  PropertyPanel.js                                              │
│    Anchor (left/center/right x top/center/bottom)             │
│    TextFit (none/shrink/ellipsis)                             │
│                                                                │
│  EditorWrapper.js                                              │
│    Responsive Ayarlari karti (mode + scale policy)            │
│    Responsive Onizleme butonu → ResponsivePreview.js          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ save → API
┌──────────────────────────────────────────────────────────────┐
│                     DATABASE (templates tablosu)               │
│                                                                │
│  responsive_mode   TEXT  'off' | 'proportional'               │
│  scale_policy      TEXT  'contain' | 'cover' | 'stretch'      │
│  design_width      INT   (canvas boyutu kayit aninda)         │
│  design_height     INT                                        │
│  design_data       JSON  (objeler relativeLeft/Top/W/H ile)   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ render sirasinda
┌──────────────────────────────────────────────────────────────┐
│                      RENDER (Backend)                          │
│                                                                │
│  process.php                                                   │
│    responsive_mode != 'off' ise ResponsiveScaler cagrilir     │
│                                                                │
│  ResponsiveScaler.php                                          │
│    scale(designData, srcW, srcH, dstW, dstH, policy)          │
│    → Her obje icin:                                           │
│      relativeCoords varsa → bolge bazli olcekleme             │
│      yoksa → lineer olcekleme (legacy fallback)               │
│                                                                │
│  RenderQueueWorker.php                                         │
│    Cache key'e device resolution eklenir                      │
│    (ayni sablon, farkli cihaz = farkli cache)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Veritabani

### Migration 068

```sql
ALTER TABLE templates ADD COLUMN responsive_mode TEXT DEFAULT 'off'
    CHECK(responsive_mode IN ('off', 'proportional'));

ALTER TABLE templates ADD COLUMN scale_policy TEXT DEFAULT 'contain'
    CHECK(scale_policy IN ('contain', 'cover', 'stretch'));

ALTER TABLE templates ADD COLUMN design_width INTEGER;
ALTER TABLE templates ADD COLUMN design_height INTEGER;
```

### Yeni Custom Properties (CustomProperties.js)

| Property | Tip | Aciklama |
|----------|-----|----------|
| `relativeLeft` | float (%) | Objenin bolge-ici yatay konumu |
| `relativeTop` | float (%) | Objenin bolge-ici dikey konumu |
| `relativeWidth` | float (%) | Objenin bolge genisligine orani |
| `relativeHeight` | float (%) | Objenin bolge yuksekligine orani |
| `anchorX` | string | Yatay capa: `left` / `center` / `right` |
| `anchorY` | string | Dikey capa: `top` / `center` / `bottom` |
| `textFit` | string | Metin uyumu: `none` / `shrink` / `ellipsis` |
| `minFontSize` | int | Shrink modunda minimum font boyutu (px) |
| `maxLines` | int | Ellipsis modunda maksimum satir sayisi |

---

## Olcek Politikalari (Scale Policy)

| Politika | Davranis | Kullanim |
|----------|----------|----------|
| **contain** | Orani koruyarak sigdirir, bos alanlar kalabilir (letterbox) | Varsayilan, en guvenli |
| **cover** | Orani koruyarak kaplar, tasan kisimlar kesilir | Tam ekran istenen durumlar |
| **stretch** | Bagimsiz X/Y olcekleme, orani bozabilir | Tam yerlestirme gereken durumlar |

### Contain Ornegi
```
Kaynak: 800x1280 (dikey ESL)
Hedef:  1920x1080 (yatay TV)

uniformScale = min(1920/800, 1080/1280) = min(2.4, 0.84) = 0.84
effectiveW = 800 * 0.84 = 672
effectiveH = 1280 * 0.84 = 1075
offsetX = (1920 - 672) / 2 = 624  (sol/sag bosluk)
offsetY = (1080 - 1075) / 2 = 2.5
```

---

## Dosya Listesi

### Yeni Dosyalar

| Dosya | Aciklama | Satir |
|-------|----------|-------|
| `services/ResponsiveScaler.php` | Backend olcekleme motoru | ~380 |
| `public/assets/js/editor/utils/ResponsivePreview.js` | Frontend wireframe onizleme | ~260 |
| `database/migrations/068_responsive_template_support.sql` | DB migration | 8 |

### Degistirilen Dosyalar

| Dosya | Degisiklik |
|-------|------------|
| `public/assets/js/editor/core/CustomProperties.js` | 9 yeni property (CUSTOM_PROPS + SERIALIZABLE_PROPS) |
| `public/assets/js/editor/TemplateEditorV7.js` | `save()` icinde `_computeRelativeCoords()` cagrisi |
| `public/assets/js/editor/managers/GridManager.js` | `object:modified` → `_autoAssignRegion()` |
| `public/assets/js/editor/panels/PropertyPanel.js` | `_renderResponsiveSection()` (anchor + textFit UI) |
| `public/assets/js/pages/templates/EditorWrapper.js` | Responsive karti + toolbar butonu + onizleme |
| `api/render-queue/process.php` | ResponsiveScaler entegrasyonu |
| `workers/RenderQueueWorker.php` | Cache key'e device resolution ekleme |
| `api/templates/create.php` | 4 yeni alan kaydi |
| `api/templates/update.php` | 4 yeni alan guncelleme + cache invalidation |
| `public/assets/css/pages/template-editor.css` | `.property-section-responsive` stilleri |
| `locales/*/pages/templates.json` | 8 dilde ceviri (tr, en, ar, az, de, fr, nl, ru) |

---

## ResponsiveScaler.php API

### `scale()`

Ana metod. Design data dizisini kaynak boyuttan hedef boyuta olcekler.

```php
$scaler = new ResponsiveScaler();

$scaledObjects = $scaler->scale(
    $designData,        // array  - Canvas JSON objects dizisi
    $srcW,              // int    - Tasarim canvas genisligi (px)
    $srcH,              // int    - Tasarim canvas yuksekligi (px)
    $dstW,              // int    - Hedef cihaz genisligi (px)
    $dstH,              // int    - Hedef cihaz yuksekligi (px)
    'contain',          // string - Scale policy
    'header-content',   // string - Grid layout ID (opsiyonel)
    $regionsConfig      // array  - Ozel regions (opsiyonel, layoutId'yi override eder)
);
```

### Obje Olcekleme Mantigi

```
IF obje.relativeLeft && obje.relativeTop VARSA:
    → Bolge bazli olcekleme (responsive obje)
    1. Hedef boyutta bolge piksel sinirlarini hesapla
    2. Relative yuzdeleri → piksel konumuna cevir
    3. scaleX/scaleY'yi bolge oranina gore guncelle
    4. Font boyutunu olcekle (textFit kuralina gore)
    5. Anchor offset uygula

ELSE:
    → Lineer olcekleme (legacy obje)
    1. left = left * scaleX + offsetX
    2. top = top * scaleY + offsetY
    3. scaleX/scaleY carpani uygula
    4. Font boyutunu uniform olcekle
```

### Grid Layout Tanimlari

ResponsiveScaler 13 standart grid layout icerir. Frontend `header-content` tire kullanir, backend `header_content` alt cizgi kullanir (otomatik donusum yapilir).

| Layout ID | Bolge Sayisi | Aciklama |
|-----------|-------------|----------|
| single | 1 | Tek alan (%100) |
| split_horizontal | 2 | Sol %50 + Sag %50 |
| split_vertical | 2 | Ust %50 + Alt %50 |
| grid_2x2 | 4 | 2x2 grid (%25 her bolge) |
| header_content | 2 | Baslik %20 + Icerik %80 |
| header_content_footer | 3 | Ust %15 + Icerik %70 + Alt %15 |
| sidebar_content | 2 | Kenar %30 + Icerik %70 |
| content_sidebar | 2 | Icerik %70 + Kenar %30 |
| media_labels | 2 | Medya %40 + Etiket %60 |
| labels_media | 2 | Etiket %60 + Medya %40 |
| triple_column | 3 | 3 sutun (%33.33) |
| triple_row | 3 | 3 satir (%33.33) |
| featured_grid | 3 | Feature %60 + Sag ust/alt %40 |

---

## Anchor Sistemi

Her objeye yatay ve dikey capa atanabilir. Olcekleme sirasinda obje bolge icinde capa noktasina gore konumlandirilir.

### Yatay (anchorX)

| Deger | Davranis |
|-------|----------|
| `left` | Bolgenin soluna yapisir (varsayilan) |
| `center` | Bolge ortasina hizalanir |
| `right` | Bolgenin sagina yapisir |

### Dikey (anchorY)

| Deger | Davranis |
|-------|----------|
| `top` | Bolgenin ustune yapisir (varsayilan) |
| `center` | Bolge ortasina hizalanir |
| `bottom` | Bolgenin altina yapisir |

### Ornek

```
Bir fiyat etiketi sag alt koseye sabitlenmis olsun:
  anchorX = 'right'
  anchorY = 'bottom'

800x1280 → 400x300 olceklendiginde:
  Obje her zaman bolgenin sag alt kosesinde kalir
  (margin orani korunarak)
```

---

## Text Fit

Metin objeleri icin iki otomatik uyum modu:

### shrink (Kucult)

Font boyutunu `minFontSize`'a kadar kucultebilir. Metin tamamen gorunur kalir.

```
Ornek: fontSize=24, minFontSize=10
Olcekleme sonrasi fontSize hesaplandi: 8
→ minFontSize=10 uygulanir (8 < 10)
```

### ellipsis (Uc Nokta)

`maxLines` satirdan fazla icerigi `...` ile keser.

```
Ornek: maxLines=2
"Bu cok uzun bir urun aciklamasi metni burada devam ediyor..."
→ "Bu cok uzun bir urun
   aciklamasi metni..."
```

---

## Frontend Editor UI

### Responsive Ayarlari Karti (Sag Panel)

EditorWrapper'da "Grid Duzeni" kartinin altinda gorunur:

- **Responsive Mod** dropdown: Kapali / Oransal Olcekleme
- **Olcek Politikasi** dropdown: Sigdir / Kapla / Esnet (sadece mod aktifken gorunur)

### PropertyPanel Responsive Bolumu

Herhangi bir obje secildiginde gorunur:

- **Yatay Capa** buton grubu: Sol / Orta / Sag
- **Dikey Capa** buton grubu: Ust / Orta / Alt
- **Metin Uyumu** dropdown (sadece metin objeleri): Yok / Kucult / Uc Nokta
  - Kucult secilince: Min Font inputu gorunur
  - Uc Nokta secilince: Max Satir inputu gorunur

### Responsive Onizleme

Toolbar'daki "Responsive" butonuna tiklaninca modal acilir. 7 preset boyut:

| Preset | Boyut |
|--------|-------|
| 2.9" ESL | 296x128 |
| 4.2" ESL | 400x300 |
| 7.5" ESL | 800x480 |
| 10.1" ESL Dikey | 800x1280 |
| 10.1" ESL Yatay | 1280x800 |
| HD Signage | 1920x1080 |
| 4K Signage | 3840x2160 |

Modal icinde Canvas 2D wireframe render:
- Mavi kutular = metin objeleri (icerik gosterilir)
- Yesil kutular = gorsel objeleri
- Gri kutular = sekil objeleri
- Kesikli mavi cizgiler = grid bolge sinirlari

---

## Render Entegrasyonu

### process.php

```php
// Sablon sorgusu (responsive alanlar dahil)
"SELECT id, name, design_data, ...,
        responsive_mode, scale_policy, design_width, design_height
 FROM templates WHERE id = ?"

// Design data parse edildikten sonra
$responsiveMode = $template['responsive_mode'] ?? 'off';
$designW = (int)($template['design_width'] ?? $template['width'] ?? 800);
$designH = (int)($template['design_height'] ?? $template['height'] ?? 1280);

if ($responsiveMode !== 'off' &&
    ($deviceWidth !== $designW || $deviceHeight !== $designH)) {
    require_once BASE_PATH . '/services/ResponsiveScaler.php';
    $scaler = new ResponsiveScaler();
    $designData['objects'] = $scaler->scale(
        $designData['objects'],
        $designW, $designH,
        $deviceWidth, $deviceHeight,
        $template['scale_policy'] ?? 'contain',
        $template['grid_layout'] ?? null,
        $regionsConfig
    );
}
```

### Cache Key

Responsive sablonlarda cache key'e device resolution eklenir:

```
// responsive_mode='off' (eski davranis)
cache_key = template_id + version + product_id + locale

// responsive_mode='proportional'
cache_key = template_id + version + product_id + locale + "800x480"
                                                           ^^^^^^^^^
                                                           device resolution
```

Bu sayede ayni sablon farkli cihaz boyutlari icin ayri cache'lenir.

---

## Relative Koordinat Hesaplama

Editor'da `save()` sirasinda her obje icin bolge-ici yuzde hesaplanir:

```javascript
// TemplateEditorV7.js - _computeRelativeCoords()

// Bolge piksel sinirlari
const rx = (region.config.x / 100) * canvasW;
const ry = (region.config.y / 100) * canvasH;
const rw = (region.config.widthPercent / 100) * canvasW;
const rh = (region.config.heightPercent / 100) * canvasH;

// Obje pozisyonunu bolge-ici yuzdeye cevir
obj.relativeLeft   = ((obj.left - rx) / rw) * 100;
obj.relativeTop    = ((obj.top - ry) / rh) * 100;

// Obje boyutunu bolge oranina cevir
const effectiveW = obj.width * obj.scaleX;
const effectiveH = obj.height * obj.scaleY;
obj.relativeWidth  = (effectiveW / rw) * 100;
obj.relativeHeight = (effectiveH / rh) * 100;
```

### Auto Region Assignment

GridManager'da obje tasindiktan sonra (`object:modified`), objenin merkez noktasinin hangi bolgeye dustugu tespit edilir ve `regionId` otomatik atanir:

```javascript
// GridManager.js - _autoAssignRegion()
const cx = obj.left;   // Fabric.js v7: center-origin
const cy = obj.top;

for (const region of this._regions) {
    const bounds = this.getRegionBounds(region);
    if (cx >= bounds.x && cx < bounds.x + bounds.width &&
        cy >= bounds.y && cy < bounds.y + bounds.height) {
        obj[CUSTOM_PROPS.REGION_ID] = region.id;
        return;
    }
}
```

---

## Geriye Uyumluluk

| Durum | Davranis |
|-------|----------|
| `responsive_mode='off'` (varsayilan) | Hicbir degisiklik yok, eski akis aynen calisir |
| Eski sablonlar (migration oncesi) | `responsive_mode` NULL → 'off' gibi davranir |
| Objelerde `relativeCoords` yok | Lineer olcekleme uygulanir (legacy fallback) |
| Cache key | responsive_mode='off' ise resolution eklenmez |
| Design data | Ekstra alanlar mevcut ama zarar vermez |

---

## i18n Anahtarlari

### EditorWrapper (editor.responsive.*)

| Anahtar | TR | EN |
|---------|----|----|
| `title` | Responsive Ayarlari | Responsive Settings |
| `mode` | Responsive Mod | Responsive Mode |
| `modeOff` | Kapali | Off |
| `modeProportional` | Oransal Olcekleme | Proportional Scaling |
| `modeHint` | Aktifken sablon farkli cihaz boyutlarina otomatik uyum saglar | When active, template automatically adapts to different device sizes |
| `scalePolicy` | Olcek Politikasi | Scale Policy |
| `policyContain` | Sigdir (Contain) | Fit (Contain) |
| `policyCover` | Kapla (Cover) | Cover |
| `policyStretch` | Esnet (Stretch) | Stretch |
| `preview` | Responsive | Responsive |
| `previewTitle` | Responsive Onizleme | Responsive Preview |

### PropertyPanel (editor.properties.*)

| Anahtar | TR | EN |
|---------|----|----|
| `responsive` | Responsive | Responsive |
| `anchorX` | Yatay Capa | Horizontal Anchor |
| `anchorY` | Dikey Capa | Vertical Anchor |
| `textFit` | Metin Uyumu | Text Fit |
| `textFitNone` | Yok | None |
| `textFitShrink` | Kucult | Shrink |
| `textFitEllipsis` | Uc Nokta (...) | Ellipsis (...) |
| `minFontSize` | Min Font | Min Font |
| `maxLines` | Max Satir | Max Lines |

**Desteklenen Diller:** TR, EN, AR, AZ, DE, FR, NL, RU

---

## Bilinen Sinirlamalar

1. **Sadece `proportional` modu** mevcut. Gelecekte `breakpoint` modu eklenebilir (farkli boyut araliklarinda farkli layout)
2. **Font olcekleme** uniform scale kullanir (scaleX/scaleY'nin minimumu). Cok farkli en-boy oranlarinda font cok kucuk kalabilir
3. **Grid layout tanimlari** hem PHP hem JS'de duplicate. Degisiklik yapilirsa ikisi de guncellenmelidir
4. **Anchor offset** basit margin hesabi yapar, complex layout senaryolarinda test edilmeli
5. **Text ellipsis** backend'de karakter bazli (`...` ekleme). Gercek font metrics'e bagli degil

---

## Test Senaryolari

### Temel Akis

1. Editor'da yeni sablon olustur (10.1" ESL Dikey, 800x1280)
2. Grid layout sec (ornegin "Baslik + Icerik")
3. Obje ekle: metin, gorsel, sekil
4. Responsive modunu "Oransal Olcekleme" yap
5. Kaydet → API'de `responsive_mode='proportional'`, `design_width=800`, `design_height=1280` saklanmali
6. Design data'da objelerin `relativeLeft/Top/Width/Height` dolmali

### Render Testi

1. Responsive sablonu bir 4.2" ESL cihazina (400x300) gonder
2. process.php'de ResponsiveScaler devreye girmeli
3. Render edilen gorsel 400x300 boyutunda olmali
4. Objeler oransal olarak kuculmeli

### Onizleme Testi

1. Editor toolbar'da "Responsive" butonuna tikla
2. Modal'da 7 preset boyut gorunmeli
3. Her preset'e tiklandiginda wireframe guncellenmeli
4. Grid bolge sinirlari kesikli cizgiyle gorunmeli

### Geriye Uyumluluk

1. Eski bir sablonu ac → responsive_mode bos/off olmali
2. Normal render akisi degismemeli
3. Cache key'de resolution eklenmemeli
