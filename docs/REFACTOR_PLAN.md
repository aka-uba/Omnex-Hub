# OMNEX DISPLAY HUB - REFACTOR PLANI

**Plan Tarihi:** 2026-01-24
**Plan Versiyonu:** 1.1
**Son Güncelleme:** Kritik kurallar eklendi (container pattern, DOM-free metrics, çapraz import yasağı, immutability yasağı)
**Strateji:** Aşamalı, Kontrollü Sadeleşme

---

## TEMEL PRENSİPLER

### Altın Kurallar

```
1. TEK SEFERDE YAPILMAZ
   Her adım ayrı commit, ayrı test

2. DAVRANIŞI DEĞİŞTİRME
   Sadece organizasyonu iyileştir

3. BAĞIMLILIK GRAFİĞİNİ BOZMA
   Yeni dosyalar birbirini import ETMEZ

4. INIT() PATTERNİ KULLAN
   Her modül: export function init(context) {}
   Context dışarıdan verilir: { container, app, onSelect, ... }

5. ANA DOSYA SADECE ÇAĞIRIR
   Eski dosyada sadece orchestration kalır

6. CONTAINER DIŞARIDAN VERİLİR
   Modüller kendi DOM'larını oluşturmaz
   Container parent tarafından sağlanır
```

### Refactor Adım Şablonu

```
1. En büyük dosya seçilir
2. İçinden TEK BİR entegrasyon/iş akışı ayrılır
3. Yeni dosyaya taşınır
4. Eski dosyada sadece init() çağrısı bırakılır
5. Davranış değişmediği doğrulanır (test)
6. Commit yapılır
7. Sonraki entegrasyona geçilir
```

---

## REFACTOR SIRASI

Önerilen sıralama (kolaydan zora):

| Sıra | Dosya | Satır | Zorluk | Neden Bu Sıra |
|------|-------|-------|--------|---------------|
| 1 | ProductForm.js | 3457 | 🟢 Kolay | UI ağırlıklı, iş akışı net |
| 2 | QueueDashboard.js | 3473 | 🟢 Kolay | UI ağırlıklı, wizard'lar net |
| 3 | DeviceList.js | 4220 | 🟡 Orta | Çok entegrasyon ama net sınırlar |
| 4 | TemplateEditor.js | 4852 | 🔴 Zor | Canvas/State/Event bağımlı |

**Mantık:** Refactor kasını ısıt, sonra zor dosyalara geç.

---

## FAZ 1: ProductForm.js Refactor

### Mevcut Durum

```
ProductForm.js (146KB, 3457 satır)
├── Ürün CRUD formu
├── Barkod önizleme & doğrulama
├── QR kod (Künye) önizleme
├── HAL Künye sorgulama entegrasyonu
├── Medya kütüphanesi seçici
├── Üretim tipi seçici modalı
├── Kategori seçici modalı
├── Fiyat geçmişi görüntüleme
├── Ağırlık bazlı barkod sistemi
├── Import alan eşleme
├── Resim/Video yükleme
├── Tartı ayarları entegrasyonu
├── Çoklu sekme yönetimi
└── Form doğrulama (15+ alan)
```

### Hedef Yapı

```
pages/products/
├── ProductForm.js (~1200 satır)
│   └── Ana form, orchestration, init çağrıları
│
├── form/
│   ├── MediaPicker.js (~600 satır)
│   │   └── export function init(container, context)
│   │
│   ├── BarcodeSection.js (~400 satır)
│   │   └── export function init(container, context)
│   │
│   ├── HalKunyeSection.js (~250 satır)
│   │   └── export function init(container, context)
│   │
│   ├── PriceHistorySection.js (~200 satır)
│   │   └── export function init(container, context)
│   │
│   └── ProductValidator.js (~200 satır)
│       └── export function validate(formData)
```

### Adım Adım Plan

#### Adım 1.1: MediaPicker Ayırma

**Hedef:** Medya seçici mantığını ayır

**Taşınacak Kodlar:**
- `showMediaLibraryPicker()`
- `loadMediaLibrary()`
- `renderMediaGrid()`
- `handleMediaSelection()`
- `confirmMediaSelection()`
- İlgili event listener'lar

**Yeni Dosya:** `pages/products/form/MediaPicker.js`

```javascript
// MediaPicker.js yapısı
// ⚠️ KRİTİK: Container DIŞARIDAN verilmeli
export class MediaPicker {
    constructor(context) {
        this.container = context.container; // ← ZORUNLU
        this.app = context.app;
        this.onSelect = context.onSelect;
    }

    show() { /* modal açma - container içine render */ }
    loadMedia() { /* API çağrısı */ }
    renderGrid() { /* grid render - this.container kullan */ }
    handleSelect() { /* seçim işleme */ }
    destroy() { /* cleanup */ }
}

// ⚠️ init() signature: container MUTLAKA olmalı
export function init({ container, app, onSelect }) {
    if (!container) throw new Error('MediaPicker: container gerekli');
    return new MediaPicker({ container, app, onSelect });
}
```

**ProductForm.js'de Kalacak:**
```javascript
import { init as initMediaPicker } from './form/MediaPicker.js';

// init() içinde - container DIŞARIDAN verilir
const mediaPickerContainer = document.getElementById('media-picker-container');
this.mediaPicker = initMediaPicker({
    container: mediaPickerContainer,  // ← ZORUNLU
    app: this.app,
    onSelect: (media) => this.handleMediaSelected(media)
});
```

**Doğrulama:**
- [ ] Medya seçici açılıyor
- [ ] Medya listesi yükleniyor
- [ ] Seçim çalışıyor
- [ ] Form alanı dolduruluyor

---

#### Adım 1.2: BarcodeSection Ayırma

**Hedef:** Barkod önizleme ve doğrulama mantığını ayır

**Taşınacak Kodlar:**
- `previewBarcode()`
- `validateBarcode()`
- `isWeighingScaleCode()`
- `loadWeighingSettings()`
- `updateBarcodePreview()`
- Barkod ile ilgili event listener'lar

**Yeni Dosya:** `pages/products/form/BarcodeSection.js`

```javascript
// BarcodeSection.js yapısı
export class BarcodeSection {
    constructor(context) {
        this.app = context.app;
        this.inputElement = context.inputElement;
        this.previewElement = context.previewElement;
    }

    async loadSettings() { /* tartı ayarları */ }
    preview(value) { /* önizleme */ }
    validate(value) { /* doğrulama */ }
    isWeighingCode(value) { /* tartı kodu kontrolü */ }
    bindEvents() { /* event binding */ }
    destroy() { /* cleanup */ }
}

export function init(context) {
    return new BarcodeSection(context);
}
```

**Doğrulama:**
- [ ] Barkod önizleme çalışıyor
- [ ] Tartı barkodu tanınıyor
- [ ] Doğrulama mesajları görünüyor

---

#### Adım 1.3: HalKunyeSection Ayırma

**Hedef:** HAL künye sorgulama entegrasyonunu ayır

**Taşınacak Kodlar:**
- `queryHalKunye()`
- `showHalCaptchaWarning()`
- `applyHalData()`
- `renderKunyeResult()`
- Künye ile ilgili event listener'lar

**Yeni Dosya:** `pages/products/form/HalKunyeSection.js`

```javascript
// HalKunyeSection.js yapısı
export class HalKunyeSection {
    constructor(context) {
        this.app = context.app;
        this.onDataReceived = context.onDataReceived;
    }

    async query(kunyeNo) { /* API sorgu */ }
    showCaptchaWarning(kunyeNo) { /* CAPTCHA modal */ }
    renderResult(data) { /* sonuç göster */ }
    applyToForm(data) { /* form doldur */ }
    bindEvents() { /* event binding */ }
    destroy() { /* cleanup */ }
}

export function init(context) {
    return new HalKunyeSection(context);
}
```

**Doğrulama:**
- [ ] Künye sorgusu çalışıyor
- [ ] CAPTCHA uyarısı görünüyor
- [ ] Veriler forma uygulanıyor

---

#### Adım 1.4: PriceHistorySection Ayırma

**Hedef:** Fiyat geçmişi görüntülemeyi ayır

**Taşınacak Kodlar:**
- `loadPriceHistory()`
- `renderPriceHistory()`
- Fiyat geçmişi ile ilgili UI

**Yeni Dosya:** `pages/products/form/PriceHistorySection.js`

**Doğrulama:**
- [ ] Fiyat geçmişi yükleniyor
- [ ] Liste doğru görünüyor

---

#### Adım 1.5: ProductValidator Ayırma

**Hedef:** Form doğrulama kurallarını ayır

**Taşınacak Kodlar:**
- `validateForm()`
- `validateField()`
- Doğrulama kuralları
- Hata mesajları

**Yeni Dosya:** `pages/products/form/ProductValidator.js`

```javascript
// ProductValidator.js yapısı
export const rules = {
    name: { required: true, minLength: 2 },
    sku: { required: true, pattern: /^[A-Z0-9-]+$/ },
    current_price: { required: true, min: 0 },
    // ...
};

export function validate(formData) {
    const errors = {};
    // doğrulama mantığı
    return { valid: Object.keys(errors).length === 0, errors };
}

export function validateField(field, value) {
    // tek alan doğrulama
}
```

**Doğrulama:**
- [ ] Form submit'te doğrulama çalışıyor
- [ ] Hata mesajları görünüyor
- [ ] Geçerli form kaydedilebiliyor

---

### Faz 1 Tamamlanma Kontrol Listesi

```
[x] MediaPicker ayrıldı ve çalışıyor (36.7KB, 1100+ satır)
[x] BarcodeSection ayrıldı ve çalışıyor (8.3KB, ~260 satır)
[x] HalKunyeSection ayrıldı ve çalışıyor (13.4KB, ~378 satır)
[x] PriceHistorySection ayrıldı ve çalışıyor (4.8KB, ~167 satır - skeleton)
[x] ProductValidator ayrıldı ve çalışıyor (9.1KB, ~341 satır)
[ ] Ana ProductForm.js ~1200 satıra düştü (Şu an: 3532 satır - @deprecated ile işaretli metodlar kaldırıldığında düşecek)
[x] Tüm mevcut fonksiyonellik korundu
[x] Yeni dosyalar birbirini import ETMİYOR
[x] Sadece ProductForm.js diğerlerini çağırıyor
```

### Faz 1 Notları

**Tamamlanma Tarihi:** 2026-01-24

**Oluşturulan Modüller:**
- `form/MediaPicker.js` - Tam implementasyon, WordPress-like medya seçici
- `form/BarcodeSection.js` - Barkod önizleme, tartı kodu desteği
- `form/HalKunyeSection.js` - HAL künye sorgulama, CAPTCHA yönetimi
- `form/PriceHistorySection.js` - Skeleton (API desteklendiğinde genişletilecek)
- `form/ProductValidator.js` - Form doğrulama kuralları ve UI hata gösterimi

**Pattern:**
- Her modül `export function init({ container, app, ... })` ile başlatılır
- Container ZORUNLU, dışarıdan verilir
- Event'ler kendi `bindEvents()` metodunda bağlanır
- Callback ile parent'a bildirim (`onSelect`, `onDataApply` vb.)

**Sonraki Adım:**
- ProductForm.js'deki @deprecated metodları kaldırarak satır sayısını düşürmek (opsiyonel)
- Faz 2: QueueDashboard.js refactor'una geçiş

---

## FAZ 2: QueueDashboard.js Refactor

### Mevcut Durum

```
QueueDashboard.js (144KB, 3473 satır)
├── Kuyruk istatistikleri dashboard
├── Öncelik analizi
├── Hata analizi & trendler
├── Performans metrikleri
├── Worker durum izleme
├── Manuel gönderim sihirbazı (4 adım)
├── Otomatik gönderim sihirbazı (2 adım)
├── Render cache kontrolü
├── Gerçek zamanlı ilerleme
├── Job durum tablosu
├── Retry mantığı UI
└── Kuyruk temizleme
```

### Hedef Yapı

```
pages/queue/
├── QueueDashboard.js (~800 satır)
│   └── Ana dashboard, layout, orchestration
│
├── dashboard/
│   ├── QueueAnalytics.js (~500 satır)
│   │   └── export function init(container, context)
│   │
│   ├── SendWizard.js (~700 satır)
│   │   └── export function init(container, context)
│   │
│   ├── AutoSendWizard.js (~400 satır)
│   │   └── export function init(container, context)
│   │
│   ├── JobStatusTable.js (~300 satır)
│   │   └── export function init(container, context)
│   │
│   └── QueueMetrics.js (~300 satır)
│       └── export function calculate(data)
```

### Adım Adım Plan

#### Adım 2.1: QueueAnalytics Ayırma

**Hedef:** Analitik ve grafik mantığını ayır

**Taşınacak Kodlar:**
- `renderAnalytics()`
- `renderPriorityChart()`
- `renderErrorChart()`
- `renderTrendChart()`
- Grafik event listener'ları

**Doğrulama:**
- [ ] Analitik kartları görünüyor
- [ ] Grafikler çiziliyor
- [ ] Veriler doğru

---

#### Adım 2.2: SendWizard Ayırma

**Hedef:** Manuel gönderim sihirbazını ayır

**Taşınacak Kodlar:**
- `showNewSendWizard()`
- `wizardData` state
- 4 adım render fonksiyonları
- Wizard navigation
- Submit mantığı

**Doğrulama:**
- [ ] Wizard açılıyor
- [ ] 4 adım arası geçiş çalışıyor
- [ ] Submit başarılı

---

#### Adım 2.3: AutoSendWizard Ayırma

**Hedef:** Otomatik gönderim sihirbazını ayır

**Taşınacak Kodlar:**
- `showAutoSendWizard()`
- `autoWizardData` state
- 2 adım render fonksiyonları
- Cache kontrolü
- Submit mantığı

**Doğrulama:**
- [ ] Auto wizard açılıyor
- [ ] Adımlar çalışıyor
- [ ] Submit başarılı

---

#### Adım 2.4: JobStatusTable Ayırma

**Hedef:** Job listesi tablosunu ayır

**Taşınacak Kodlar:**
- `renderJobsTable()`
- Job action handler'ları (cancel, retry)
- DataTable konfigürasyonu

**Doğrulama:**
- [ ] Tablo görünüyor
- [ ] Cancel çalışıyor
- [ ] Retry çalışıyor

---

#### Adım 2.5: QueueMetrics Ayırma

**Hedef:** Metrik hesaplama mantığını ayır

### ⚠️ KRİTİK KURAL: SIFIR DOM

```
QueueMetrics.js içinde:
❌ document.querySelector()
❌ element.innerHTML
❌ DOM manipülasyonu
❌ Event listener

✅ Sadece: data → hesaplama → result
✅ Pure functions
✅ Input/Output net
```

**Taşınacak Kodlar:**
- Performans hesaplamaları
- Trend hesaplamaları
- Format fonksiyonları

**Doğru Yapı:**
```javascript
// QueueMetrics.js - SIFIR DOM
export function calculateStats(rawData) {
    return {
        pending: rawData.filter(x => x.status === 'pending').length,
        completed: rawData.filter(x => x.status === 'completed').length,
        // ...
    };
}

export function formatDuration(seconds) {
    // Pure string dönüşümü
    return `${Math.floor(seconds / 60)}dk ${seconds % 60}sn`;
}

export function calculateTrends(data, period) {
    // Pure hesaplama
    return { daily: [...], weekly: [...] };
}
```

**Doğrulama:**
- [ ] Metrikler doğru hesaplanıyor
- [ ] Formatlar doğru
- [ ] Dosyada document/window referansı YOK

---

### Faz 2 Tamamlanma Kontrol Listesi

```
[ ] QueueAnalytics ayrıldı ve çalışıyor
[ ] SendWizard ayrıldı ve çalışıyor
[ ] AutoSendWizard ayrıldı ve çalışıyor
[ ] JobStatusTable ayrıldı ve çalışıyor
[ ] QueueMetrics ayrıldı ve çalışıyor
[ ] Ana QueueDashboard.js ~800 satıra düştü
[ ] Tüm mevcut fonksiyonellik korundu
```

---

## FAZ 3: DeviceList.js Refactor

### ⚠️⚠️⚠️ ALTIN KURAL: ÇAPRAZ IMPORT YASAK ⚠️⚠️⚠️

```
list/ klasörü içindeki dosyalar BİRBİRİNİ IMPORT ETMEZ!

❌ YANLIŞ:
list/BluetoothWizard.js içinden:
import { scanNetwork } from './NetworkScanner.js';

❌ YANLIŞ:
list/DeviceControl.js içinden:
import { showApproval } from './ApprovalFlow.js';

❌ YANLIŞ:
Ortak util/shared.js yaratma refleksi

✅ DOĞRU:
Her modül sadece DeviceList.js'e bağlı
DeviceList.js hepsini çağırır (orchestration)
Ortak ihtiyaç varsa → DeviceList.js'de çöz
```

**Neden Bu Kural:**
- Cross-import = Spaghetti başlangıcı
- Ortak util = Gizli bağımlılık
- Tek yön = Test edilebilir, anlaşılır

### Mevcut Durum

```
DeviceList.js (201KB, 4220 satır)
├── Cihaz DataTable listesi
├── Cihaz CRUD modal formları
├── PavoDisplay ağ tarama UI
├── Bluetooth ESL kurulum sihirbazı
├── Cihaz onay workflow'u
├── Hızlı aksiyon butonları
├── Cihaz kontrol modalı
├── Firmware güncelleme UI
├── Cihaz gruplama yönetimi
├── Toplu operasyonlar
├── Cihaz detay modalı
├── Gateway cihaz yönetimi
└── Export işlevselliği
```

### Hedef Yapı

```
pages/devices/
├── DeviceList.js (~1200 satır)
│   └── Tablo, CRUD, orchestration
│
├── list/
│   ├── BluetoothWizard.js (~600 satır)
│   │   └── export function init(context)
│   │
│   ├── NetworkScanner.js (~400 satır)
│   │   └── export function init(context)
│   │
│   ├── DeviceControl.js (~300 satır)
│   │   └── export function init(context)
│   │
│   ├── ApprovalFlow.js (~250 satır)
│   │   └── export function init(context)
│   │
│   ├── FirmwareUpdate.js (~250 satır)
│   │   └── export function init(context)
│   │
│   └── BulkActions.js (~300 satır)
│       └── export function init(context)
```

### Adım Adım Plan

#### Adım 3.1: BluetoothWizard Ayırma (ÖNCELİKLİ)

**Neden Öncelikli:**
- En bağımsız modül
- BLE protokolü tamamen izole
- ~600 satır tek sorumluluk

**Taşınacak Kodlar:**
- `showBluetoothModal()`
- BLE bağlantı mantığı
- 5 adımlı wizard UI
- WiFi/protokol ayarları
- BluetoothService entegrasyonu

**Doğrulama:**
- [x] Bluetooth modal açılıyor
- [x] Cihaz tarama çalışıyor
- [x] WiFi ayarlama çalışıyor
- [x] Protokol ayarlama çalışıyor

---

#### Adım 3.2: NetworkScanner Ayırma

**Taşınacak Kodlar:**
- `showNetworkScanModal()`
- Tek IP / IP aralığı / Hızlı tarama
- Tarama sonuç listesi
- Cihaz ekleme

**Doğrulama:**
- [x] Tarama modal açılıyor
- [x] 3 mod çalışıyor
- [x] Bulunan cihaz eklenebiliyor

---

#### Adım 3.3: DeviceControl Ayırma

**Taşınacak Kodlar:**
- `showDeviceSettingsModal()`
- Ping, refresh, clear, reboot
- Cihaz bilgisi görüntüleme
- Parlaklık kontrolü

**Doğrulama:**
- [x] Kontrol modal açılıyor
- [x] Quick actions çalışıyor
- [x] Cihaz bilgisi görünüyor

---

#### Adım 3.4: ApprovalFlow Ayırma

**Taşınacak Kodlar:**
- `showPendingSyncRequestsModal()`
- Onay/Red işlemleri
- Bekleyen cihaz listesi

**Doğrulama:**
- [x] Bekleyen modal açılıyor
- [x] Onay çalışıyor
- [x] Red çalışıyor

---

#### Adım 3.5: FirmwareUpdate Ayırma

**Taşınacak Kodlar:**
- Firmware yükleme UI
- Uyarı kutusu
- Dosya doğrulama
- Yükleme ilerleme

**Doğrulama:**
- [x] Firmware section görünüyor
- [x] Dosya seçilebiliyor
- [x] Yükleme çalışıyor

---

#### Adım 3.6: BulkActions Ayırma

**Taşınacak Kodlar:**
- Toplu seçim mantığı
- Toplu playlist atama
- Toplu komut gönderme
- Export işlevi

**Doğrulama:**
- [x] Toplu seçim çalışıyor
- [x] Toplu işlemler çalışıyor
- [x] Export çalışıyor

---

### Faz 3 Tamamlanma Kontrol Listesi

```
[x] BluetoothWizard ayrıldı ve çalışıyor (2026-01-25)
[x] NetworkScanner ayrıldı ve çalışıyor (2026-01-25)
[x] DeviceControl ayrıldı ve çalışıyor (2026-01-25)
[x] ApprovalFlow ayrıldı ve çalışıyor (2026-01-25)
[x] FirmwareUpdate ayrıldı ve çalışıyor (2026-01-25)
[x] BulkActions ayrıldı ve çalışıyor (2026-01-25)
[ ] Ana DeviceList.js ~1200 satıra düştü (henüz yorum satırları var)
[x] Tüm mevcut fonksiyonellik korundu

⚠️ ALTIN KURAL KONTROLÜ:
[x] list/ içindeki dosyalar BİRBİRİNİ import ETMİYOR
[x] Ortak shared.js / utils.js OLUŞTURULMADI
[x] Tüm modüller sadece DeviceList.js'e bağlı
```

### Faz 3 Oluşturulan Modüller

| Modül | Dosya | Satır | Sorumluluk |
|-------|-------|-------|------------|
| BluetoothWizard | list/BluetoothWizard.js | ~600 | Bluetooth cihaz kurulum sihirbazı |
| NetworkScanner | list/NetworkScanner.js | ~450 | Ağ tarama ve cihaz keşfi |
| DeviceControl | list/DeviceControl.js | ~500 | Cihaz ayarları modal, quick actions |
| ApprovalFlow | list/ApprovalFlow.js | ~350 | Onay/red işlemleri |
| FirmwareUpdate | list/FirmwareUpdate.js | ~275 | Firmware güncelleme bölümü |
| BulkActions | list/BulkActions.js | ~500 | Toplu işlemler, playlist atama, filtreler |

### DEPRECATED Metodlar (DeviceList.js içinde yorum olarak)

| Metod | Eski Konum | Yeni Modül | Tarih |
|-------|------------|------------|-------|
| showBluetoothWizard, scanBluetooth, connectBluetooth, ... | 1487-2000 | BluetoothWizard | 2026-01-25 |
| showNetworkScanModal, scanNetwork, ... | 2000-2350 | NetworkScanner | 2026-01-25 |
| showDeviceSettingsModal, executeQuickAction, ... | 2350-2750 | DeviceControl | 2026-01-25 |
| handleApproveDevice, handleRejectDevice, ... | 2750-3050 | ApprovalFlow | 2026-01-25 |
| sendDeviceCommand, controlDevice | 1490-1602 | BulkActions | 2026-01-25 |
| showAssignPlaylistModal, assignPlaylist, showFilterModal, applyFilters | 4088-4308 | BulkActions | 2026-01-25 |

### Faz 3 Notları

**Tamamlanma Tarihi:** 2026-01-25

**Oluşturulan Modüller:**
- `list/BluetoothWizard.js` - BLE cihaz kurulum sihirbazı (5 adım)
- `list/NetworkScanner.js` - Ağ tarama (tek IP, aralık, hızlı), PavoDisplay ve Hanshow ESL
- `list/DeviceControl.js` - Cihaz ayarları modal, quick actions, brightness, device info
- `list/ApprovalFlow.js` - Bekleyen cihaz onay/red işlemleri
- `list/FirmwareUpdate.js` - Firmware güncelleme bölümü, uyarı kutusu
- `list/BulkActions.js` - Toplu işlemler, playlist atama, filtreler

**Pattern:**
- Her modül `export function init(context)` ile başlatılır
- Context: `{ app, __, deviceGroups, refreshDevices, ... }`
- Callback ile parent'a bildirim (`onDeviceAdded`, `refreshDevices` vb.)
- destroy() metodu ile cleanup

**Önemli Düzeltmeler:**
- Nested `/* */` comment sorunu çözüldü (JSDoc `/** */` → `// //` dönüşümü)
- `formatFileSize` metodu aktif kod bölümüne taşındı
- FirmwareUpdate modülü import ve init eklendi

**Sonraki Adım:**
- Faz 4: TemplateEditor.js refactor'una geçiş (en riskli)

---

## FAZ 4: TemplateEditor.js Refactor (İKİ AŞAMALI)

### ⚠️ UYARI: En Riskli Refactor

Bu dosya neden özel dikkat gerektiriyor:
- Canvas, State, Event, Render birlikte çalışmalı
- Fabric.js lifecycle'a bağımlı
- Tek hata tüm editörü bozabilir

### ⚠️⚠️⚠️ KRİTİK YASAK: IMMUTABILITY DENEME ⚠️⚠️⚠️

```
TemplateEditor'da aşağıdakiler YASAK:

❌ Proxy kullanımı
❌ Immer.js veya benzeri kütüphane
❌ Object.freeze()
❌ Spread ile kopyalama (...state)
❌ Deep clone işlemleri
❌ Immutable state pattern

✅ Mevcut mutable state AYNEN kalmalı
✅ Referanslar korunmalı
✅ Fabric.js'in beklediği mutability sürmeli
```

**Neden Bu Yasak:**
- Fabric.js mutable state bekler
- Canvas objeler referansla güncellenir
- Kopyalama = Performans kaybı + Referans kopması
- "Daha iyi" yapmaya çalışmak = Editörü bozmak

### Strateji: İki Aşamalı Refactor

```
AŞAMA 4A: Dosya Ayır, State Paylaş
- Dosyalar ayrılır
- Ama aynı state objesini kullanır
- Risk: Düşük

AŞAMA 4B: State İzolasyonu (İLERİDE)
- State ayrı modül olur
- Event bus ile iletişim
- Risk: Orta
```

### Mevcut Durum

```
TemplateEditor.js (184KB, 4852 satır)
├── Fabric.js canvas başlatma
├── DevicePresets entegrasyonu
├── GridManager entegrasyonu
├── PropertyPanel entegrasyonu
├── DynamicFieldsPanel entegrasyonu
├── BackgroundManager entegrasyonu
├── Canvas manipülasyonu
├── Export/import JSON
├── Render önizleme
├── Keyboard shortcuts
├── Undo/redo
├── Dosya yükleme
├── i18n entegrasyonu
└── Event delegation
```

### Hedef Yapı (Aşama 4A)

```
pages/templates/
├── TemplateEditor.js (~1500 satır)
│   └── Orchestration, state tutma, init çağrıları
│
├── editor/
│   ├── CanvasManager.js (~800 satır)
│   │   └── export function init(canvas, state)
│   │   └── Fabric.js operasyonları
│   │
│   ├── EditorEventHandler.js (~500 satır)
│   │   └── export function init(canvas, state)
│   │   └── Keyboard, mouse, hotkeys
│   │
│   ├── EditorHistory.js (~300 satır)
│   │   └── export function init(state)
│   │   └── Undo/redo stack
│   │
│   └── TemplateIO.js (~300 satır)
│       └── export function init(state)
│       └── Import/export JSON
│
│   # Mevcut dosyalar (zaten ayrı):
│   ├── DevicePresets.js ✅
│   ├── GridManager.js ✅
│   ├── PropertyPanel.js ✅
│   ├── DynamicFieldsPanel.js ✅
│   └── BackgroundManager.js ✅
```

### Kritik Kural: Shared State

```javascript
// TemplateEditor.js - STATE BURADA TANIMLANIYOR
class TemplateEditor {
    constructor(app) {
        this.app = app;

        // Paylaşılan state objesi
        this.editorState = {
            canvas: null,
            selectedObject: null,
            history: [],
            historyIndex: -1,
            isDirty: false,
            template: null
        };
    }

    async init() {
        // Canvas oluştur
        this.editorState.canvas = new fabric.Canvas('editor-canvas');

        // Modülleri başlat - AYNI STATE İLE
        this.canvasManager = initCanvasManager(this.editorState.canvas, this.editorState);
        this.eventHandler = initEventHandler(this.editorState.canvas, this.editorState);
        this.history = initHistory(this.editorState);
        this.io = initTemplateIO(this.editorState);
    }
}
```

```javascript
// CanvasManager.js - STATE REFERANSI ALIYOR
export function init(canvas, state) {
    return new CanvasManager(canvas, state);
}

class CanvasManager {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state; // Referans, kopya değil
    }

    addElement(type, options) {
        // canvas'a ekle
        // state.selectedObject güncelle
        this.state.isDirty = true;
    }
}
```

### Adım Adım Plan (Aşama 4A)

#### Adım 4A.1: EditorHistory Ayırma (EN GÜVENLİ BAŞLANGIÇ)

**Neden İlk:**
- En izole fonksiyonellik
- Canvas'a doğrudan bağımlı değil
- Test etmesi kolay

**Taşınacak Kodlar:**
- `_saveHistory()`
- `undo()`
- `redo()`
- History stack yönetimi

**Doğrulama:**
- [ ] Undo çalışıyor
- [ ] Redo çalışıyor
- [ ] History stack doğru

---

#### Adım 4A.2: TemplateIO Ayırma

**Taşınacak Kodlar:**
- `_saveToDatabase()`
- `_loadFromDatabase()`
- JSON export
- JSON import

**Doğrulama:**
- [ ] Kaydet çalışıyor
- [ ] Yükle çalışıyor
- [ ] Export çalışıyor
- [ ] Import çalışıyor

---

#### Adım 4A.3: EditorEventHandler Ayırma

**Taşınacak Kodlar:**
- Keyboard event listeners
- Mouse event handlers
- Hotkey tanımları
- Clipboard işlemleri

**Doğrulama:**
- [ ] Kısayollar çalışıyor
- [ ] Mouse olayları çalışıyor
- [ ] Copy/paste çalışıyor

---

#### Adım 4A.4: CanvasManager Ayırma (EN SON)

**Neden En Son:**
- En karmaşık
- Diğerleri hazır olmalı
- Test kapsamı geniş

**Taşınacak Kodlar:**
- Element ekleme fonksiyonları
- Element silme
- Element güncelleme
- Selection yönetimi
- Layer yönetimi

**Doğrulama:**
- [ ] Element ekleme çalışıyor
- [ ] Silme çalışıyor
- [ ] Seçim çalışıyor
- [ ] Layer sıralaması çalışıyor

---

### Faz 4A Tamamlanma Kontrol Listesi

```
[x] EditorHistory ayrıldı ve çalışıyor (2026-01-25)
[x] TemplateIO ayrıldı ve çalışıyor (2026-01-25)
[x] EditorEventHandler ayrıldı ve çalışıyor (2026-01-25)
[x] CanvasManager ayrıldı ve çalışıyor (2026-01-25)
[ ] Ana TemplateEditor.js ~1500 satıra düştü (henüz @deprecated metodlar var)
[x] Tüm mevcut fonksiyonellik korundu
[x] State doğru paylaşılıyor
[x] Editör stabil çalışıyor

⚠️ IMMUTABILITY YASAK KONTROLÜ:
[x] Proxy KULLANILMADI
[x] Immer.js EKLENMEDI
[x] Spread kopyalama (...state) YAPILMADI
[x] Mevcut mutable state KORUNDU
[x] Fabric.js referansları BOZULMADI
```

### Faz 4 Oluşturulan Modüller

| Modül | Dosya | Satır | Sorumluluk |
|-------|-------|-------|------------|
| EditorHistory | editor/EditorHistory.js | ~230 | Undo/redo stack yönetimi |
| TemplateIO | editor/TemplateIO.js | ~450 | Şablon kaydet/yükle, JSON export/import |
| EditorEventHandler | editor/EditorEventHandler.js | ~255 | Klavye kısayolları, event binding |
| CanvasManager | editor/CanvasManager.js | ~300 | Zoom, pan, canvas boyut yönetimi |

### Faz 4 Notları

**Tamamlanma Tarihi:** 2026-01-25

**Oluşturulan Modüller:**
- `editor/EditorHistory.js` - Undo/redo stack, state geri yükleme
- `editor/TemplateIO.js` - Şablon CRUD, JSON serialization, render için zoom reset
- `editor/EditorEventHandler.js` - Keyboard shortcuts, ok tuşlarıyla hareket
- `editor/CanvasManager.js` - Zoom in/out/fit/reset, canvas boyutlandırma

**Pattern:**
- Her modül `export function init(context)` ile başlatılır
- Context: `{ canvas, state, getZoom, setZoom, onHistoryChange, ... }`
- State DIŞARIDAN verilir, modül state'i DEĞİŞTİRİR (mutable)
- Callback ile parent'a bildirim
- destroy() metodu ile cleanup

**Kritik Kurallar Uygulandı:**
- ❌ Immutability KULLANILMADI (Proxy, Immer, Object.freeze yasak)
- ✅ Mutable shared state pattern (`this.editorState`)
- ✅ Fallback pattern: Modül varsa kullan, yoksa eski kod çalışır
- ✅ @deprecated JSDoc annotation ile eski metodlar işaretlendi

**Ek Düzeltmeler:**
- Fabric.js 5.3.1 'alphabetical' textBaseline uyarısı filtrelendi (_loadFabricJs)

**Sonraki Adım:**
- TemplateEditor.js'deki @deprecated metodları kaldırarak satır sayısını düşürmek (opsiyonel)
- Faz 5: Optimizasyonlar (i18n lazy load, auth paralel, vb.)

---

## FAZ 5: Optimizasyonlar (SON AŞAMA)

### ⚠️ Not: Bunlar REFACTOR değil, OPTİMİZASYON

Bu aşama refactor tamamlandıktan sonra yapılmalıdır.

### 5.1 i18n.load() Optimizasyonu ✅

**Mevcut Sorun:**
- İlk render'da TÜM çeviriler yükleniyor
- 200-300ms bloklama

**Çözüm (Uygulandı - 2026-01-25):**
```javascript
// Sadece aktif dil yükle
await i18n.load(currentLang);

// Diğer diller idle'da (opsiyonel preload)
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
        i18n.preloadOtherLanguages();
    });
}
```

**Yapılan Değişiklikler:**
- `i18n.js`: `preloadOtherLanguages()` metodu eklendi
- `requestIdleCallback` ile boş zamanda diğer diller yükleniyor
- Fallback: `setTimeout` ile 500ms aralıklarla yükleme

### 5.2 auth.check() Optimizasyonu ✅

**Mevcut Sorun:**
- 500ms ağ gecikmesi
- Sayfa render'ı bekliyor

**Çözüm (Uygulandı - 2026-01-25):**
```javascript
// Paralel çalıştır
const [authResult, i18nResult] = await Promise.all([
    auth.check(),
    i18n.load(lang)
]);
```

**Yapılan Değişiklikler:**
- `app.js`: `Promise.all()` ile i18n ve auth paralel çalıştırılıyor
- Her biri ayrı timeout ile korunuyor
- Tahmini kazanç: ~500ms ilk yükleme süresi

### 5.3 Büyük Sayfa Lazy Loading ✅

**Mevcut Sorun:**
- 150KB+ sayfalar yüklenirken gecikme

**Çözüm:**
- Refactor sonrası doğal olarak çözüldü
- Her alt modül ayrı yüklenebilir
- Faz 1-4'te modüller ayrıldı

### Faz 5 Tamamlanma Kontrol Listesi

```
[x] i18n.preloadOtherLanguages() metodu eklendi
[x] app.js'de i18n + auth paralel çalıştırılıyor
[x] requestIdleCallback ile arka planda dil yükleme
[x] Lazy loading refactor ile doğal olarak sağlandı
```

### Faz 5 Notları

**Tamamlanma Tarihi:** 2026-01-25

**Değiştirilen Dosyalar:**
- `public/assets/js/app.js` - Paralel init optimizasyonu
- `public/assets/js/core/i18n.js` - preloadOtherLanguages() metodu

**Performans Kazanımları:**
- İlk yükleme: ~500ms daha hızlı (paralel init)
- Dil değiştirme: Anında (preloaded)
- Sayfa geçişleri: Daha hızlı (modüler yapı)

---

## TAKVİM ÖNERİSİ

```
HAFTA 1-2: Faz 1 (ProductForm)
├── Adım 1.1-1.5
└── Test ve stabilizasyon

HAFTA 3-4: Faz 2 (QueueDashboard)
├── Adım 2.1-2.5
└── Test ve stabilizasyon

HAFTA 5-7: Faz 3 (DeviceList)
├── Adım 3.1-3.6
└── Test ve stabilizasyon

HAFTA 8-10: Faz 4A (TemplateEditor)
├── Adım 4A.1-4A.4
└── Kapsamlı test

HAFTA 11+: Faz 5 (Optimizasyonlar)
└── Performans iyileştirmeleri
```

---

## RİSK YÖNETİMİ

### Her Adımda

```
1. Git branch oluştur: feature/refactor-{dosya}-{adım}
2. Değişiklik yap
3. Manuel test
4. Commit
5. Main'e merge (veya PR)
6. Production'da doğrula
7. Sonraki adıma geç
```

### Geri Alma Planı

```
Her adım ayrı commit olduğu için:
- Sorun varsa: git revert {commit}
- Tüm faz sorunluysa: git revert {first-commit}..{last-commit}
```

### Test Kontrol Listesi (Her Adım)

```
[ ] Sayfa yükleniyor
[ ] Ana fonksiyonellik çalışıyor
[ ] Modal'lar açılıyor
[ ] Form submit çalışıyor
[ ] API çağrıları başarılı
[ ] Console'da hata yok
[ ] Network tab'da gereksiz istek yok
```

---

## BAŞARI KRİTERLERİ

### Faz Tamamlanma Kriterleri

| Faz | Ana Dosya Hedef | Fonksiyonellik | Performans |
|-----|-----------------|----------------|------------|
| 1 | ~1200 satır | %100 korundu | Aynı/daha iyi |
| 2 | ~800 satır | %100 korundu | Aynı/daha iyi |
| 3 | ~1200 satır | %100 korundu | Aynı/daha iyi |
| 4A | ~1500 satır | %100 korundu | Aynı/daha iyi |

### Genel Başarı Kriterleri

```
[ ] Toplam 4 şişmiş dosya sadeleştirildi
[ ] Hiçbir mevcut fonksiyonellik kaybolmadı
[ ] Sayfa yükleme süreleri azaldı
[ ] Kod okunabilirliği arttı
[ ] Bağımlılık grafiği bozulmadı
[ ] Yeni dosyalar tek sorumluluk ilkesine uyuyor
```

---

**Plan Sonu**

*Bu plan, kontrollü sadeleşme stratejisi ile hazırlanmıştır. Amaç %100 modülerlik değil, yönetilebilir kod organizasyonudur.*
