# Vendor Paketleri

Bu klasör, Omnex Display Hub projesinde kullanılan üçüncü parti JavaScript kütüphanelerini içerir.
**CDN bağımlılığı yoktur** - tüm paketler lokal olarak sunulur.

> ⚠️ **ÖNEMLİ UYARI**
>
> **Runtime'da CDN KULLANILMAZ.** Bu dokümandaki CDN URL'leri yalnızca güncelleme/indirme referansıdır.
> Tüm kütüphaneler `vendor/` klasöründen lokal olarak yüklenir.

## Global Scope Değişkenleri

Tüm vendor kütüphaneleri global scope'da tek instance olarak bulunmalıdır:

| Global | Kütüphane | Kontrol |
|--------|-----------|---------|
| `window.fabric` | Fabric.js | `typeof fabric !== 'undefined'` |
| `window.JsBarcode` | JsBarcode | `typeof JsBarcode !== 'undefined'` |
| `window.QRCode` | qrcodejs | `typeof QRCode !== 'undefined'` |
| `window.XLSX` | SheetJS | `typeof XLSX !== 'undefined'` |
| `window.Hls` | HLS.js | `typeof Hls !== 'undefined'` |

Tarayıcı konsolunda doğrulama:
```javascript
// Tümü tanımlı ve tek instance olmalı
console.log('fabric:', typeof window.fabric);
console.log('JsBarcode:', typeof window.JsBarcode);
console.log('QRCode:', typeof window.QRCode);
console.log('XLSX:', typeof window.XLSX);
console.log('Hls:', typeof window.Hls);
```

## Paket Listesi

| Paket | Versiyon | Boyut | Lisans | Kullanım |
|-------|----------|-------|--------|----------|
| Fabric.js | 7.0.0 | 309 KB | MIT | Canvas/template editor |
| JsBarcode | 3.11.6 | 60 KB | MIT | Barkod oluşturma |
| qrcodejs | 1.0.0 | 19 KB | MIT | QR kod oluşturma |
| Tabler Icons | 3.3.0 | 4.3 MB* | MIT | UI ikonları |
| HLS.js | 1.5.7 | 402 KB | Apache 2.0 | Video streaming |
| SheetJS (xlsx) | 0.18.5 | 861 KB | Apache 2.0 | Excel import/export |

*Tabler Icons: CSS (219KB) + Fontlar (4.1MB toplam)

## Klasör Yapısı

```
vendor/
├── fabric/
│   ├── fabric.min.js        # Fabric.js 7.0.0 minified
│   └── LICENSE
├── jsbarcode/
│   ├── JsBarcode.all.min.js # Tüm barkod formatları
│   └── LICENSE
├── qrcode/
│   ├── qrcode.min.js        # qrcodejs (davidshimjs)
│   └── LICENSE
├── tabler-icons/
│   ├── tabler-icons.min.css # Tabler Icons CSS
│   ├── fonts/
│   │   ├── tabler-icons.woff2
│   │   ├── tabler-icons.woff
│   │   └── tabler-icons.ttf
│   └── LICENSE
├── hls/
│   ├── hls.min.js           # HLS.js streaming
│   └── LICENSE
├── xlsx/
│   ├── xlsx.full.min.js     # SheetJS full build
│   └── LICENSE
└── README.md                # Bu dosya
```

## HTML'de Kullanım

### Template Editor (Fabric.js + Barcode + QRCode)

```html
<!-- Vendor kütüphaneleri -->
<script src="assets/vendor/fabric/fabric.min.js"></script>
<script src="assets/vendor/jsbarcode/JsBarcode.all.min.js"></script>
<script src="assets/vendor/qrcode/qrcode.min.js"></script>
```

### PWA Player (HLS.js)

```html
<script src="assets/vendor/hls/hls.min.js"></script>
```

### Export Manager (SheetJS)

```html
<!-- Dinamik yükleme tercih edilir -->
<script>
async function loadSheetJS() {
    if (typeof XLSX === 'undefined') {
        await import('./assets/vendor/xlsx/xlsx.full.min.js');
    }
    return window.XLSX;
}
</script>
```

### Tabler Icons (CSS)

```html
<link rel="stylesheet" href="assets/vendor/tabler-icons/tabler-icons.min.css">
```

## JavaScript Module Import

### Fabric.js (UMD Global)

```javascript
// Fabric.js UMD olarak global'e yüklenir
// Script tag'den sonra window.fabric olarak erişilir

// FabricExports.js wrapper ile:
const { Canvas, FabricImage, FabricText, Rect, Circle, Group } = fabric;
```

### JsBarcode

```javascript
// Script tag'den sonra window.JsBarcode olarak erişilir
JsBarcode('#barcode', '8690000000001', {
    format: 'EAN13',
    displayValue: true
});
```

### qrcodejs

```javascript
// Script tag'den sonra window.QRCode olarak erişilir
// NOT: node-qrcode (QRCode.toCanvas) DEĞİL, qrcodejs (new QRCode) API'si

new QRCode(element, {
    text: 'https://example.com',
    width: 128,
    height: 128,
    colorDark: '#000000',
    colorLight: '#ffffff'
});
```

### HLS.js

```javascript
// Video streaming için
if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource('https://example.com/stream.m3u8');
    hls.attachMedia(videoElement);
}
```

### SheetJS

```javascript
// Excel export
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
XLSX.writeFile(workbook, 'export.xlsx');
```

## Güncelleme Prosedürü

Paketleri güncellerken:

1. **Yedek Al**: Mevcut vendor klasörünü yedekle
2. **İndir**: jsdelivr veya unpkg'den yeni versiyonu indir
3. **Test Et**: Template editor ve tüm özelliklerin çalıştığını doğrula
4. **Dokümante Et**: Bu README'yi güncelle

### İndirme Kaynakları

```bash
# Fabric.js
curl -sL "https://cdn.jsdelivr.net/npm/fabric@7.0.0/dist/fabric.min.js" -o fabric/fabric.min.js

# JsBarcode
curl -sL "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" -o jsbarcode/JsBarcode.all.min.js

# qrcodejs
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" -o qrcode/qrcode.min.js

# Tabler Icons
curl -sL "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.3.0/dist/tabler-icons.min.css" -o tabler-icons/tabler-icons.min.css

# HLS.js
curl -sL "https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js" -o hls/hls.min.js

# SheetJS
curl -sL "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" -o xlsx/xlsx.full.min.js
```

## Önemli Notlar

### Fabric.js v7 Breaking Changes

- `FabricImage` (eskiden `Image`)
- `originX/originY` varsayılan değeri `'center'` (eskiden `'left'/'top'`)
- Event pointer'ları: `e.scenePoint`, `e.viewportPoint` (eskiden `e.pointer`)
- Detaylı bilgi: `docs/FABRIC_V7_MIGRATION_PLAN.md`

### qrcodejs vs node-qrcode

Bu projede **qrcodejs** (davidshimjs) kullanılıyor:
- API: `new QRCode(element, options)`
- Browser uyumlu
- CDN: cdnjs.cloudflare.com

**node-qrcode** (soldair) kullanılmıyor:
- API: `QRCode.toCanvas()` - tarayıcıda 404 verir
- Node.js odaklı

### Tabler Icons Font Yolları

CSS dosyasında font yolları `./fonts/` olarak tanımlı:
```css
@font-face {
    font-family: 'tabler-icons';
    src: url('./fonts/tabler-icons.woff2') format('woff2'),
         url('./fonts/tabler-icons.woff') format('woff'),
         url('./fonts/tabler-icons.ttf') format('truetype');
}
```

Klasör yapısı bu yollara uygun olmalı.

## Lisanslar

Tüm paketler açık kaynak lisanslarla dağıtılmaktadır:
- **MIT License**: Fabric.js, JsBarcode, qrcodejs, Tabler Icons
- **Apache 2.0**: HLS.js, SheetJS

Detaylı lisans bilgileri için her paketin LICENSE dosyasına bakınız.

---

Son Güncelleme: 2026-01-30
