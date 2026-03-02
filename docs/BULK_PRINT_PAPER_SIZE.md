# Toplu Yazdırma - Kağıt Boyutu ve Grid Düzeni

Bu dokümantasyon, toplu etiket yazdırma özelliğinin kağıt boyutu seçimi ve çoklu etiket grid düzeni işlevselliğini açıklar.

## Genel Bakış

Toplu yazdırma özelliği, seçilen ürünlerin etiketlerini standart kağıt boyutlarına (A4, A3, vb.) grid düzeninde yerleştirerek normal yazıcılardan yazdırmayı sağlar.

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| Kağıt Boyutu Seçimi | A4, A3, A5, Letter, Legal |
| Grid Hesaplama | Otomatik satır x sütun hesabı |
| Çoklu Sayfa | Etiketler sığmazsa birden fazla sayfa |
| Margin Desteği | 2mm kenar boşluğu |
| Şablon Desteği | Fabric.js şablonları ile render |

## Desteklenen Kağıt Boyutları

| Boyut | Genişlik (mm) | Yükseklik (mm) | Kullanım Alanı |
|-------|---------------|----------------|----------------|
| A4 | 210 | 297 | Standart ofis yazıcı |
| A3 | 297 | 420 | Büyük format yazıcı |
| A5 | 148 | 210 | Küçük etiketler |
| Letter | 216 | 279 | ABD standart |
| Legal | 216 | 356 | ABD legal |

## Grid Hesaplama Formülü

```javascript
// Margin değeri (mm)
const margin = 2;

// Kullanılabilir alan
const usableWidth = paperWidth - (margin * 2);
const usableHeight = paperHeight - (margin * 2);

// Sütun ve satır sayısı
const cols = Math.floor(usableWidth / labelWidth);
const rows = Math.floor(usableHeight / labelHeight);

// Sayfa başına etiket
const labelsPerPage = cols * rows;

// Toplam sayfa sayısı
const totalPages = Math.ceil(totalLabels / labelsPerPage);
```

## Kullanım

### 1. Ürün Seçimi
- Ürün listesinde yazdırılacak ürünleri checkbox ile seçin
- Toolbar'daki "Toplu Yazdır" butonuna tıklayın

### 2. Yazdırma Modalı
Modal açıldığında şu alanlar görünür:

```
┌─────────────────────────────────────┐
│ Toplu Etiket Yazdır                 │
├─────────────────────────────────────┤
│ Kağıt Boyutu: [A4 (210x297mm) ▼]   │
│ Hint: Seçerseniz etiketler grid    │
│       düzeninde dizilir            │
├─────────────────────────────────────┤
│ Grid Info: 3x4 = sayfa başına 12   │
│ etiket, toplam 24 etiket, 2 sayfa  │
├─────────────────────────────────────┤
│ Etiket Boyutu: [60x40mm ▼]         │
├─────────────────────────────────────┤
│ Kopya Sayısı: [1]                  │
├─────────────────────────────────────┤
│ Şablon: [Şablon seçin... ▼]        │
└─────────────────────────────────────┘
```

### 3. Kağıt Boyutu Seçenekleri

| Seçenek | Davranış |
|---------|----------|
| "Tekli etiket (kağıt seçme)" | Her etiket ayrı sayfaya (eski davranış) |
| A4, A3, vb. | Etiketler grid düzeninde kağıda dizilir |

### 4. Grid Bilgi Gösterimi

Kağıt ve etiket boyutu seçildiğinde otomatik hesaplanan bilgiler:
- **Sütun x Satır**: Örn. "3x4"
- **Sayfa Başına Etiket**: Örn. "12 etiket/sayfa"
- **Toplam Etiket**: Seçilen ürün sayısı × kopya sayısı
- **Toplam Sayfa**: Hesaplanan sayfa sayısı

### 5. Hata Durumları

| Durum | Mesaj |
|-------|-------|
| Etiket kağıda sığmıyor | "Etiket boyutu seçilen kağıda sığmıyor" |
| Boyut seçilmedi | "Lütfen etiket boyutu seçin" |

## Teknik Detaylar

### Dosya Yapısı

```
public/assets/js/pages/products/
└── ProductList.js
    ├── showBulkPrintModal()      # Modal HTML oluşturur
    ├── updateBulkPrintGridInfo() # Grid hesabı yapar
    ├── bulkPrintPreview()        # Tekli etiket önizleme (eski)
    └── bulkPrintPreviewGrid()    # Grid düzeni önizleme (yeni)
```

### Modal HTML Yapısı

```html
<!-- Kağıt Boyutu Seçici -->
<div class="form-group">
    <label class="form-label">Kağıt Boyutu</label>
    <select id="bulk-print-paper" class="form-select">
        <option value="" data-width="0" data-height="0">
            Tekli etiket (kağıt seçme)
        </option>
        <option value="a4" data-width="210" data-height="297">
            A4 (210 x 297 mm)
        </option>
        <!-- ... diğer boyutlar -->
    </select>
    <p class="form-hint">Hint metni</p>
</div>

<!-- Grid Bilgi Gösterimi -->
<div id="bulk-print-grid-info" class="form-group" style="display:none;">
    <div class="alert alert-info">
        <i class="ti ti-grid-dots"></i>
        <span id="grid-info-text"></span>
    </div>
</div>
```

### bulkPrintPreviewGrid() Metodu

```javascript
async bulkPrintPreviewGrid(copies, labelWidthMm, labelHeightMm, paperWidthMm, paperHeightMm, template) {
    // 1. Grid hesaplama
    const margin = 2; // mm
    const cols = Math.floor((paperWidthMm - margin * 2) / labelWidthMm);
    const rows = Math.floor((paperHeightMm - margin * 2) / labelHeightMm);
    const labelsPerPage = cols * rows;

    // 2. Etiket listesi oluştur (ürün × kopya)
    const allLabels = [];
    for (const product of this.selectedProducts) {
        for (let c = 0; c < copies; c++) {
            allLabels.push(product);
        }
    }

    // 3. Sayfalara böl
    const pages = [];
    for (let i = 0; i < allLabels.length; i += labelsPerPage) {
        pages.push(allLabels.slice(i, i + labelsPerPage));
    }

    // 4. HTML oluştur
    // - Her sayfa için @page CSS
    // - CSS Grid ile etiket düzeni
    // - Print media queries

    // 5. Yeni pencerede aç
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
}
```

### CSS Grid Yapısı

```css
/* Sayfa stili */
@page {
    size: ${paperWidthMm}mm ${paperHeightMm}mm;
    margin: ${margin}mm;
}

/* Sayfa container */
.print-page {
    width: ${paperWidthMm - margin * 2}mm;
    height: ${paperHeightMm - margin * 2}mm;
    page-break-after: always;
    display: grid;
    grid-template-columns: repeat(${cols}, ${labelWidthMm}mm);
    grid-template-rows: repeat(${rows}, ${labelHeightMm}mm);
    gap: 0;
}

/* Etiket hücresi */
.label-cell {
    width: ${labelWidthMm}mm;
    height: ${labelHeightMm}mm;
    box-sizing: border-box;
    overflow: hidden;
}
```

## i18n Çeviri Anahtarları

### Türkçe (products.json)

```json
{
    "bulkPrint": {
        "paperSize": "Kağıt Boyutu",
        "paperSizeNone": "Tekli etiket (kağıt seçme)",
        "paperSizeHint": "Seçerseniz etiketler kağıda grid düzeninde dizilir",
        "gridInfo": "{cols}x{rows} = sayfa başına {labelsPerPage} etiket, toplam {totalLabels} etiket, {pages} sayfa",
        "labelTooLarge": "Etiket boyutu seçilen kağıda sığmıyor",
        "pages": "Sayfa",
        "labelsPerPage": "Sayfa Başına",
        "labelsPerPageSuffix": "etiket/sayfa"
    }
}
```

### İngilizce (products.json)

```json
{
    "bulkPrint": {
        "paperSize": "Paper Size",
        "paperSizeNone": "Single label (no paper)",
        "paperSizeHint": "If selected, labels will be arranged in a grid layout on the paper",
        "gridInfo": "{cols}x{rows} = {labelsPerPage} labels per page, {totalLabels} total labels, {pages} pages",
        "labelTooLarge": "Label size doesn't fit on selected paper",
        "pages": "Pages",
        "labelsPerPage": "Per Page",
        "labelsPerPageSuffix": "labels/page"
    }
}
```

## Örnek Senaryolar

### Senaryo 1: A4 Kağıda 60x40mm Etiketler

```
Kağıt: A4 (210x297mm)
Etiket: 60x40mm
Margin: 2mm

Kullanılabilir alan: 206x293mm
Sütun: floor(206/60) = 3
Satır: floor(293/40) = 7
Sayfa başına: 3 × 7 = 21 etiket

Seçilen ürün: 50 adet, Kopya: 1
Toplam etiket: 50
Toplam sayfa: ceil(50/21) = 3 sayfa
```

### Senaryo 2: A3 Kağıda 100x60mm Etiketler

```
Kağıt: A3 (297x420mm)
Etiket: 100x60mm
Margin: 2mm

Kullanılabilir alan: 293x416mm
Sütun: floor(293/100) = 2
Satır: floor(416/60) = 6
Sayfa başına: 2 × 6 = 12 etiket

Seçilen ürün: 10 adet, Kopya: 3
Toplam etiket: 30
Toplam sayfa: ceil(30/12) = 3 sayfa
```

## Yazıcı Ayarları

Doğru yazdırma için yazıcı ayarlarında dikkat edilmesi gerekenler:

1. **Kağıt Boyutu**: Seçilen kağıt boyutuyla eşleşmeli (A4, A3, vb.)
2. **Ölçekleme**: "Gerçek Boyut" veya "%100" olarak ayarlanmalı
3. **Kenar Boşlukları**: Minimum veya "Yok" olarak ayarlanmalı
4. **Yönlendirme**: Kağıt boyutuna göre dikey veya yatay

## Sınırlamalar

| Sınırlama | Açıklama |
|-----------|----------|
| Tarayıcı popup | Tarayıcı popup engelleyici kapatılmalı |
| Etiket boyutu | Seçilen kağıda en az 1 etiket sığmalı |
| Şablon render | Fabric.js şablonları canvas ile render edilir |

## Gelecek Geliştirmeler

- [ ] Özel kağıt boyutu girişi
- [ ] Etiket hizalama seçenekleri (ortala, sola yasla)
- [ ] Kesim çizgileri (crop marks)
- [ ] PDF export seçeneği
- [ ] Etiket aralığı (gap) ayarı

## Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 2.0.18 | 2026-02 | İlk versiyon - Kağıt boyutu seçimi ve grid düzeni |
