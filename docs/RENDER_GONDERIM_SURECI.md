# Render ve Cihaz Gönderim Süreci Dokümantasyonu

Bu döküman, Omnex Display Hub sisteminde ürün etiketlerinin render edilmesi ve ESL/Signage cihazlarına gönderilmesi süreçlerini detaylı olarak açıklar.

**Son Güncelleme:** 2026-01-28

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Ürünler Sayfası - Tekli Gönderim](#ürünler-sayfası---tekli-gönderim)
3. [Ürünler Sayfası - Toplu Gönderim](#ürünler-sayfası---toplu-gönderim)
4. [Kuyruk Sayfası - Otomatik Gönderim](#kuyruk-sayfası---otomatik-gönderim)
5. [Render Süreci ve Görsel Kaynak Önceliği](#render-süreci-ve-görsel-kaynak-önceliği)
6. [Company Bazlı Depolama Yapısı](#company-bazlı-depolama-yapısı)
7. [Medya Yolu Çözümleme](#medya-yolu-çözümleme)
8. [PavoDisplay Cihaz Protokolü](#pavodisplay-cihaz-protokolü)
9. [Gateway Yönlendirme Mekanizması](#gateway-yönlendirme-mekanizması)
10. [Hata Yönetimi ve Retry Mekanizması](#hata-yönetimi-ve-retry-mekanizması)

---

## Genel Bakış

Omnex Display Hub, elektronik raf etiketleri (ESL) ve dijital tabela cihazlarına içerik gönderimi için iki ana yöntem sunar:

| Yöntem | Sayfa | Kullanım Senaryosu |
|--------|-------|-------------------|
| Tekli/Toplu Gönderim | Ürünler (#/products) | Manuel, anlık gönderim |
| Otomatik Kuyruk | Kuyruk (#/admin/queue) | Zamanlanmış, toplu gönderim |

### Mimari Genel Görünüm

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ProductList.js          │           QueueDashboard.js                  │
│  ├─ handleSendToDevice() │           ├─ showAutoSendWizard()            │
│  ├─ bulkSendToDevice()   │           ├─ triggerProcessing()             │
│  └─ showDeviceModal()    │           └─ startWorker()                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  api/templates/render.php         │  api/render-queue/                  │
│  ├─ Anlık render                  │  ├─ auto.php (kuyruk oluştur)       │
│  └─ Direkt cihaza gönderim        │  ├─ process.php (işle)              │
│                                   │  └─ status.php (durum)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVİSLER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  RenderQueueService.php           │  PavoDisplayGateway.php             │
│  ├─ enqueue()                     │  ├─ uploadFile()                    │
│  ├─ dequeue()                     │  ├─ triggerReplay()                 │
│  └─ updateProgress()              │  └─ syncProduct()                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CİHAZLAR                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  PavoDisplay ESL (HTTP-SERVER)    │  Hanshow ESL (ESL-Working)          │
│  ├─ /upload                       │  ├─ /api2/esls/{id}                 │
│  ├─ /replay                       │  └─ Layout/Image format             │
│  └─ /check                        │                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ürünler Sayfası - Tekli Gönderim

**Sayfa:** `#/products`
**Dosya:** `public/assets/js/pages/products/ProductList.js`

### İşlem Akışı

```
1. Kullanıcı ürün satırında "Cihaza Gönder" ikonuna tıklar
                    │
                    ▼
2. showDeviceSelectModal() - Cihaz seçim modalı açılır
   ├─ Online cihazlar listelenir
   ├─ Şablon seçimi yapılır
   └─ Hedef cihaz seçilir
                    │
                    ▼
3. handleSendToDevice(productId, deviceId, templateId)
   ├─ Ürün verisi API'den alınır
   ├─ Şablon bilgisi alınır
   └─ Canvas pre-render başlatılır (opsiyonel)
                    │
                    ▼
4. POST /api/templates/{templateId}/render
   {
     "product_id": "uuid",
     "device_id": "uuid",
     "format": "image"
   }
                    │
                    ▼
5. render.php işlemi:
   ├─ Şablon yüklenir (Fabric.js JSON)
   ├─ Ürün verileri dinamik alanlara yerleştirilir
   ├─ Görsel render edilir (GD/Imagick)
   ├─ Company dizinine kaydedilir
   └─ PavoDisplayGateway ile cihaza gönderilir
                    │
                    ▼
6. Cihaz işlemi:
   ├─ /upload ile görsel yüklenir
   ├─ Task JSON oluşturulur
   └─ /replay ile ekran güncellenir
                    │
                    ▼
7. Sonuç Toast ile kullanıcıya bildirilir
```

### API İsteği Örneği

```javascript
// ProductList.js - handleSendToDevice()
async handleSendToDevice(productId) {
    const modal = await this.showDeviceSelectModal(productId);

    // Modal onaylandığında
    const { deviceId, templateId } = modal.getData();

    const response = await this.app.api.post(`/templates/${templateId}/render`, {
        product_id: productId,
        device_id: deviceId,
        format: 'image'
    });

    if (response.success) {
        Toast.success('Etiket cihaza gönderildi');
    }
}
```

### Veritabanı Güncellmeleri

Başarılı gönderim sonrası güncellenen tablolar:

| Tablo | Alan | Açıklama |
|-------|------|----------|
| devices | last_sync_at | Son senkronizasyon zamanı |
| devices | current_content | Aktif içerik bilgisi (JSON) |
| products | assigned_device_id | Atanan cihaz ID'si |
| audit_logs | - | İşlem kaydı |

---

## Ürünler Sayfası - Toplu Gönderim

**Sayfa:** `#/products`
**Dosya:** `public/assets/js/pages/products/ProductList.js`

### Seçim Mekanizması

```javascript
// DataTable checkbox ile çoklu seçim
this.dataTable = new DataTable({
    container: '#products-table',
    selectable: true,
    onSelectionChange: (selectedIds) => {
        this.selectedProducts = selectedIds;
        this.updateBulkActionButtons();
    }
});
```

### İşlem Akışı

```
1. Kullanıcı birden fazla ürün seçer (checkbox)
                    │
                    ▼
2. "Toplu İşlemler" > "Cihaza Gönder" tıklanır
                    │
                    ▼
3. showBulkSendModal() - Toplu gönderim modalı
   ├─ Seçili ürün sayısı gösterilir
   ├─ Şablon seçimi (tüm ürünler için ortak)
   ├─ Cihaz seçimi (çoklu seçim mümkün)
   └─ Öncelik seçimi (urgent/high/normal/low)
                    │
                    ▼
4. bulkSendToDevice() başlatılır
   ├─ Progress modal açılır
   └─ Her ürün için sırayla gönderim yapılır
                    │
                    ▼
5. Seçenek A: Sıralı Gönderim (doğrudan)
   for (product of selectedProducts) {
       await sendToDevice(product, device, template);
       updateProgress(++completed, total);
   }
                    │
   VEYA             ▼

6. Seçenek B: Kuyruk Sistemi (önerilen)
   POST /api/render-queue
   {
       "products": ["uuid1", "uuid2", ...],
       "template_id": "uuid",
       "device_ids": ["uuid1", "uuid2"],
       "priority": "normal"
   }
                    │
                    ▼
7. RenderQueueService.enqueueBulk() çağrılır
   ├─ Her ürün-cihaz çifti için job oluşturulur
   ├─ Batch ID ile gruplandırılır
   └─ Öncelik ağırlığına göre sıralanır
                    │
                    ▼
8. Worker (process.php) işleri sırayla işler
                    │
                    ▼
9. Sonuç bildirimi ve progress güncelleme
```

### Toplu Gönderim API

```javascript
// ProductList.js - bulkSendToDevice()
async bulkSendToDevice() {
    const selectedProducts = this.dataTable.getSelectedIds();
    const { templateId, deviceIds, priority } = this.bulkSendModal.getData();

    // Kuyruk sistemine gönder
    const response = await this.app.api.post('/render-queue', {
        products: selectedProducts,
        template_id: templateId,
        device_ids: deviceIds,
        priority: priority,
        batch_name: `Toplu Gönderim - ${new Date().toLocaleString()}`
    });

    if (response.success) {
        Toast.success(`${selectedProducts.length} ürün kuyruğa eklendi`);
        // Kuyruk sayfasına yönlendir (opsiyonel)
        // this.app.router.navigate('/admin/queue');
    }
}
```

### Progress Modal Yapısı

```html
<div class="bulk-send-progress">
    <div class="progress-header">
        <span class="progress-title">Toplu Gönderim</span>
        <span class="progress-count">5 / 20</span>
    </div>
    <div class="progress-bar-container">
        <div class="progress-bar" style="width: 25%"></div>
    </div>
    <div class="progress-details">
        <div class="progress-item success">
            <i class="ti ti-check"></i> Ürün A - Cihaz 1
        </div>
        <div class="progress-item processing">
            <i class="ti ti-loader"></i> Ürün B - Cihaz 2
        </div>
        <div class="progress-item pending">
            <i class="ti ti-clock"></i> Ürün C - Cihaz 3
        </div>
    </div>
</div>
```

---

## Kuyruk Sayfası - Otomatik Gönderim

**Sayfa:** `#/admin/queue`
**Dosya:** `public/assets/js/pages/queue/QueueDashboard.js`

### Kuyruk Sistemi Mimarisi

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       KUYRUK SİSTEMİ                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │   URGENT    │     │    HIGH     │     │   NORMAL    │              │
│   │  (Ağırlık:  │     │  (Ağırlık:  │     │  (Ağırlık:  │              │
│   │    100)     │     │     75)     │     │     50)     │              │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘              │
│          │                   │                   │                      │
│          └───────────────────┼───────────────────┘                      │
│                              │                                          │
│                              ▼                                          │
│                     ┌─────────────────┐                                 │
│                     │  FIFO + Priority │                                │
│                     │     Sıralama     │                                │
│                     └────────┬────────┘                                 │
│                              │                                          │
│                              ▼                                          │
│                     ┌─────────────────┐                                 │
│                     │    dequeue()    │                                 │
│                     │   İşleme Al     │                                 │
│                     └────────┬────────┘                                 │
│                              │                                          │
│          ┌───────────────────┼───────────────────┐                      │
│          ▼                   ▼                   ▼                      │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │  COMPLETED  │     │  PROCESSING │     │   FAILED    │              │
│   │  Tamamlandı │     │  İşleniyor  │     │  Başarısız  │              │
│   └─────────────┘     └─────────────┘     └──────┬──────┘              │
│                                                   │                     │
│                                                   ▼                     │
│                                          ┌─────────────┐                │
│                                          │    RETRY    │                │
│                                          │  Kuyruguna  │                │
│                                          │    Ekle     │                │
│                                          └─────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Öncelik Ağırlıkları

```php
// RenderQueueService.php
private const PRIORITY_WEIGHTS = [
    'urgent' => 100,   // Acil - Hemen işlenir
    'high'   => 75,    // Yüksek - Öncelikli
    'normal' => 50,    // Normal - Standart sıra
    'low'    => 25     // Düşük - Boşta işlenir
];
```

### Otomatik Gönderim Wizard Akışı

```
1. "Otomatik Gönder" butonuna tıklanır
                    │
                    ▼
2. showAutoSendWizard() açılır
   ├─ Adım 1: Ürün seçimi (atanmış etiketli ürünler)
   ├─ Adım 2: Öncelik ve zamanlama
   └─ Onay butonu
                    │
                    ▼
3. checkRenderCacheStatus() - Cache kontrolü
   ├─ Tüm ürünlerin render cache'i var mı?
   ├─ Eksik render'lar tespit edilir
   └─ Seçenek sunulur:
      ├─ "Render Tamamlansın" - Worker bekle
      ├─ "Hazır Olanları Gönder" - Sadece cached
      └─ "Şimdi Render Et" - Eksikleri render et
                    │
                    ▼
4. POST /api/render-queue/auto
   {
       "product_ids": ["uuid1", "uuid2"],
       "priority": "normal",
       "scheduled_at": null,  // veya ISO tarih
       "pre_rendered_images": {
           "uuid1": "/storage/renders/xxx.jpg",
           "uuid2": "data:image/png;base64,..."
       }
   }
                    │
                    ▼
5. auto.php işlemi:
   ├─ productLabelsMap oluşturulur
   │   (product -> template -> devices eşleştirmesi)
   ├─ Pre-rendered görseller kaydedilir
   ├─ Her ürün-cihaz çifti için job oluşturulur
   └─ Batch ID ile gruplandırılır
                    │
                    ▼
6. triggerProcessing() otomatik başlatılır
   POST /api/render-queue/process
   { "max_jobs": 5 }
                    │
                    ▼
7. process.php worker döngüsü:
   while (pending_jobs > 0) {
       job = dequeue();
       processDeviceRender(job);
       updateProgress(job);
   }
                    │
                    ▼
8. Dashboard anlık güncellenir (polling)
```

### Kuyruk Veritabanı Tabloları

**render_queue tablosu:**

```sql
CREATE TABLE render_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    job_type TEXT DEFAULT 'render_send',
    priority TEXT DEFAULT 'normal',     -- urgent, high, normal, low
    template_id TEXT,
    product_id TEXT,
    device_ids TEXT,                    -- JSON array
    device_count INTEGER DEFAULT 0,
    render_params TEXT,                 -- JSON (ek parametreler)
    status TEXT DEFAULT 'pending',      -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,         -- 0-100
    devices_total INTEGER DEFAULT 0,
    devices_completed INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    devices_skipped INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_summary TEXT,
    scheduled_at TEXT,                  -- Zamanlama (ISO format)
    started_at TEXT,
    completed_at TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

**render_queue_items tablosu:**

```sql
CREATE TABLE render_queue_items (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',      -- pending, processing, completed, failed, skipped
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    error_type TEXT,                    -- timeout, connection, device_offline, upload_failed
    next_retry_at TEXT,                 -- Sonraki deneme zamanı
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT,
    FOREIGN KEY (queue_id) REFERENCES render_queue(id)
);
```

### RenderQueueService Temel Metodları

```php
// services/RenderQueueService.php

class RenderQueueService {

    /**
     * Kuyruğa yeni iş ekle
     */
    public function enqueue(array $params): array {
        // Validasyon
        // Job oluştur
        // Queue items oluştur (her cihaz için)
        // Return job info
    }

    /**
     * Toplu kuyruğa ekleme
     */
    public function enqueueBulk(array $items): array {
        // Her item için enqueue() çağır
        // Batch ID ile grupla
        // Return batch info
    }

    /**
     * Sıradaki işi al (FIFO + Priority)
     */
    public function dequeue(): ?array {
        $sql = "
            SELECT * FROM render_queue
            WHERE status = 'pending'
            AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
            ORDER BY
                CASE priority
                    WHEN 'urgent' THEN 100
                    WHEN 'high' THEN 75
                    WHEN 'normal' THEN 50
                    WHEN 'low' THEN 25
                END DESC,
                created_at ASC
            LIMIT 1
        ";
        // ...
    }

    /**
     * İş durumunu güncelle
     */
    public function updateQueueProgress(string $queueId): void {
        // Tamamlanan, başarısız, atlanan sayıları hesapla
        // Progress yüzdesini güncelle
        // Status'u güncelle (processing/completed/failed)
    }

    /**
     * Retry zamanla
     */
    public function scheduleRetry(string $itemId, string $errorType): array {
        // Exponential backoff hesapla
        // next_retry_at güncelle
        // retry_count artır
    }
}
```

### Dashboard Analitik Verileri

```javascript
// QueueDashboard.js - loadData()
async loadData() {
    // Kuyruk istatistikleri
    const analyticsResponse = await this.app.api.get('/render-queue/analytics');

    this.analytics = {
        queue_status: {
            pending: 5,
            processing: 2,
            completed: 150,
            failed: 3
        },
        priority_analysis: {
            urgent: { jobs: 1, pending_devices: 10 },
            high: { jobs: 2, pending_devices: 25 },
            normal: { jobs: 2, pending_devices: 15 },
            low: { jobs: 0, pending_devices: 0 }
        },
        performance_metrics: {
            avg_completion_seconds: 45.5,
            success_rate: 98.5,
            avg_seconds_per_device: 1.2
        },
        error_analysis: {
            types: [
                { type: 'timeout', count: 15, avg_retries: 2.3 },
                { type: 'connection', count: 8, avg_retries: 1.5 }
            ]
        }
    };
}
```

---

## Render Süreci ve Görsel Kaynak Önceliği

### Görsel Kaynak Öncelik Zinciri

Kuyruk işleme sırasında (process.php) görsel kaynağı şu öncelik sırasıyla belirlenir:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GÖRSEL KAYNAK ÖNCELİK ZİNCİRİ                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. preRenderedImagePath (Frontend Canvas Render)                       │
│     └─ Wizard'da kullanıcı onayından önce render edilen görsel          │
│     └─ storage/renders/{company_id}/queue/{hash}.jpg                    │
│                              │                                          │
│                              ▼ (yoksa)                                  │
│                                                                          │
│  2. render_cache (RenderWorker.js Cached Renders)                       │
│     └─ Arka planda önceden render edilmiş görseller                     │
│     └─ storage/renders/{company_id}/{device_type}/{locale}/{template}/  │
│                              │                                          │
│                              ▼ (yoksa)                                  │
│                                                                          │
│  3. render_image (Editor Static Render)                                 │
│     └─ Şablon editöründe kayıt sırasında oluşturulan                    │
│     └─ templates tablosu render_image alanı                             │
│                              │                                          │
│                              ▼ (yoksa)                                  │
│                                                                          │
│  4. Design Folder (screen.png)                                          │
│     └─ Şablon tasarım klasöründeki statik görsel                        │
│     └─ storage/templates/{template_id}/screen.png                       │
│                              │                                          │
│                              ▼ (yoksa)                                  │
│                                                                          │
│  5. preview_image (Şablon Önizleme)                                     │
│     └─ templates tablosu preview_image alanı                            │
│                              │                                          │
│                              ▼ (yoksa)                                  │
│                                                                          │
│  6. Product Images Fallback                                             │
│     └─ Ürün görseli (image_url, images[0])                              │
│     └─ Default placeholder görsel                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Kaynak Seçim Kodu

```php
// api/render-queue/process.php - processForPavoDisplay()

function processForPavoDisplay($device, $job, $template, $product) {
    $imageSource = null;
    $sourceType = 'unknown';

    // 1. Pre-rendered image (Frontend'den)
    if (!empty($job['rendered_image_path']) && file_exists($job['rendered_image_path'])) {
        $imageSource = $job['rendered_image_path'];
        $sourceType = 'preRenderedImagePath';
    }

    // 2. Render cache
    if (!$imageSource) {
        $cacheKey = generateCacheKey($template['id'], $product['id'], $device['type']);
        $cachePath = STORAGE_PATH . "/renders/{$job['company_id']}/cache/{$cacheKey}.jpg";
        if (file_exists($cachePath)) {
            $imageSource = $cachePath;
            $sourceType = 'render_cache';
        }
    }

    // 3. Template render_image
    if (!$imageSource && !empty($template['render_image'])) {
        $renderImagePath = resolveMediaPath($template['render_image'], $job['company_id']);
        if ($renderImagePath && file_exists($renderImagePath)) {
            $imageSource = $renderImagePath;
            $sourceType = 'render_image';
        }
    }

    // 4. Design folder screen.png
    if (!$imageSource) {
        $designPath = STORAGE_PATH . "/templates/{$template['id']}/screen.png";
        if (file_exists($designPath)) {
            $imageSource = $designPath;
            $sourceType = 'design_folder';
        }
    }

    // 5. Preview image
    if (!$imageSource && !empty($template['preview_image'])) {
        $previewPath = resolveMediaPath($template['preview_image'], $job['company_id']);
        if ($previewPath && file_exists($previewPath)) {
            $imageSource = $previewPath;
            $sourceType = 'preview_image';
        }
    }

    // 6. Product image fallback
    if (!$imageSource && !empty($product['image_url'])) {
        $productImagePath = resolveMediaPath($product['image_url'], $job['company_id']);
        if ($productImagePath && file_exists($productImagePath)) {
            $imageSource = $productImagePath;
            $sourceType = 'product_image';
        }
    }

    // Log source type for debugging
    logDebug("Image source: {$sourceType} - {$imageSource}");

    return $imageSource;
}
```

### Runtime Render Yapılmaz

**Önemli:** Kuyruk işleme sırasında (process.php) runtime render **yapılmaz**. Tüm görseller önceden hazırlanmış olmalıdır:

| Kaynak | Hazırlanma Zamanı | Açıklama |
|--------|-------------------|----------|
| preRenderedImagePath | Auto Wizard onay öncesi | Frontend canvas render |
| render_cache | RenderWorker.js arka plan | Periyodik ön-render |
| render_image | Şablon kaydetme | Editor'da generate |
| design_folder | Tasarım yükleme | Manuel upload |
| preview_image | Şablon oluşturma | Otomatik thumbnail |

---

## Company Bazlı Depolama Yapısı

### Multi-Tenant Dosya İzolasyonu

Her firma (company) için ayrı depolama dizini kullanılır:

```
storage/
├── companies/
│   ├── {company_id_1}/
│   │   ├── media/
│   │   │   ├── images/           # Yüklenen görseller
│   │   │   ├── videos/           # Yüklenen videolar
│   │   │   └── documents/        # Belgeler
│   │   ├── templates/
│   │   │   └── renders/          # Şablon render çıktıları
│   │   ├── exports/              # Dışa aktarılan dosyalar
│   │   ├── imports/              # İçe aktarma geçici dosyaları
│   │   └── avatars/              # Kullanıcı avatarları
│   │
│   └── {company_id_2}/
│       └── ... (aynı yapı)
│
├── renders/
│   └── {company_id}/
│       ├── queue/                # Kuyruk pre-render görselleri
│       └── cache/                # RenderWorker cache
│           └── {device_type}/
│               └── {locale}/
│                   └── {template_id}/
│                       └── {cache_key}.jpg
│
├── templates/
│   └── {template_id}/
│       ├── content.json          # Fabric.js JSON
│       ├── screen.png            # Statik render
│       └── thumbnail.jpg         # Önizleme
│
└── public/                       # Genel erişimli (sistem görselleri)
    └── defaults/
        ├── product-placeholder.jpg
        └── template-placeholder.jpg
```

### Yol Sabitleri

```php
// config.php

// Ana depolama dizini
define('STORAGE_PATH', BASE_PATH . '/storage');

// Company bazlı yollar
function getCompanyPath($companyId, $subPath = '') {
    $path = STORAGE_PATH . '/companies/' . $companyId;
    if ($subPath) {
        $path .= '/' . ltrim($subPath, '/');
    }
    return $path;
}

// Render cache yolu
function getRenderCachePath($companyId, $deviceType, $locale, $templateId) {
    return STORAGE_PATH . "/renders/{$companyId}/cache/{$deviceType}/{$locale}/{$templateId}";
}

// Kullanım örnekleri:
$mediaPath = getCompanyPath($companyId, 'media/images');
// => storage/companies/abc123/media/images

$cachePath = getRenderCachePath($companyId, 'esl', 'tr', $templateId);
// => storage/renders/abc123/cache/esl/tr/template456
```

### Veritabanı Yol Referansları

Veritabanında dosya yolları şu formatlarda saklanır:

| Format | Örnek | Açıklama |
|--------|-------|----------|
| Relative | `media/images/product.jpg` | Company base path'e göre |
| Absolute | `/storage/companies/xxx/media/...` | Tam yol |
| Serve URL | `/api/media/serve.php?path=...` | Proxy URL |
| External | `https://cdn.example.com/...` | Harici URL |

---

## Medya Yolu Çözümleme

### resolveMediaPath() Fonksiyonu

```php
// api/render-queue/process.php

function resolveMediaPath($mediaPath, $companyId) {
    if (empty($mediaPath)) {
        return null;
    }

    // 1. serve.php proxy URL'si mi?
    if (strpos($mediaPath, 'serve.php') !== false) {
        // URL'den path parametresini çıkar
        parse_str(parse_url($mediaPath, PHP_URL_QUERY), $params);
        if (!empty($params['path'])) {
            return $params['path'];
        }
    }

    // 2. Bilinen base path'leri temizle
    $cleanPath = $mediaPath;
    $basePaths = [
        '/market-etiket-sistemi',
        '/api/media/serve.php?path=',
        'storage/'
    ];
    foreach ($basePaths as $basePath) {
        if (strpos($cleanPath, $basePath) === 0) {
            $cleanPath = substr($cleanPath, strlen($basePath));
        }
    }

    // 3. /storage/ prefix'i varsa
    if (strpos($cleanPath, '/storage/') === 0) {
        $fullPath = STORAGE_PATH . substr($cleanPath, 8);
        if (file_exists($fullPath)) {
            return $fullPath;
        }
    }

    // 4. Company bazlı olası yolları dene
    $companyBase = STORAGE_PATH . '/companies/' . $companyId;
    $possiblePaths = [
        $companyBase . '/media/images/' . basename($cleanPath),
        $companyBase . '/media/videos/' . basename($cleanPath),
        $companyBase . '/templates/renders/' . basename($cleanPath),
        STORAGE_PATH . '/media/' . $cleanPath,
        STORAGE_PATH . '/' . $cleanPath
    ];

    foreach ($possiblePaths as $testPath) {
        if (file_exists($testPath)) {
            return $testPath;
        }
    }

    // 5. HTTP/HTTPS URL ise indir
    if (preg_match('/^https?:\/\//', $mediaPath)) {
        return downloadExternalFile($mediaPath, $companyId);
    }

    // 6. Bulunamadı
    logWarning("Media path not resolved: {$mediaPath}");
    return null;
}
```

### Harici Dosya İndirme

```php
function downloadExternalFile($url, $companyId) {
    $tempDir = STORAGE_PATH . "/companies/{$companyId}/temp";
    if (!is_dir($tempDir)) {
        mkdir($tempDir, 0755, true);
    }

    $filename = md5($url) . '_' . basename(parse_url($url, PHP_URL_PATH));
    $localPath = $tempDir . '/' . $filename;

    // Zaten indirilmiş mi?
    if (file_exists($localPath)) {
        return $localPath;
    }

    // cURL ile indir
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    $content = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $content) {
        file_put_contents($localPath, $content);
        return $localPath;
    }

    return null;
}
```

---

## PavoDisplay Cihaz Protokolü

### HTTP-SERVER Modu Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| /check | GET | Dosya varlık kontrolü |
| /upload | POST | Dosya yükleme |
| /replay | GET | Ekran güncelleme tetikleyici |
| /Iotags | GET | Cihaz bilgisi |
| /clear | GET | Depolama temizleme |

### Senkronizasyon Akışı

```php
// services/PavoDisplayGateway.php - syncProduct()

public function syncProduct($deviceIp, $product, $template, $imageData) {
    $clientId = $this->getClientId($deviceIp);

    // 1. Task klasörünü temizle (opsiyonel)
    if ($this->config['clear_before_sync']) {
        $this->clearSpace($deviceIp);
    }

    // 2. Görseli yükle
    $imageName = "{$clientId}.jpg";
    $uploadResult = $this->uploadFile(
        $deviceIp,
        $imageData,
        "files/task/{$imageName}"
    );

    if (!$uploadResult['success']) {
        return ['success' => false, 'error' => 'Upload failed'];
    }

    // 3. Video varsa yükle
    if (!empty($product['video_url'])) {
        $videoData = file_get_contents($product['video_url']);
        $videoName = "{$clientId}.mp4";
        $this->uploadFile($deviceIp, $videoData, "files/task/{$videoName}");
    }

    // 4. Task JSON oluştur
    $taskConfig = [
        'Id' => $clientId,
        'ItemCode' => $product['sku'],
        'ItemName' => $product['name'],
        'LabelPicture' => [
            'X' => 0,
            'Y' => $template['video_zone_height'] ?? 640,
            'Width' => $template['width'] ?? 800,
            'Height' => $template['height'] - ($template['video_zone_height'] ?? 640),
            'PictureName' => $imageName,
            'PicturePath' => "files/task/{$imageName}",
            'PictureMD5' => md5($imageData)
        ]
    ];

    // Video zone varsa
    if (!empty($product['video_url'])) {
        $taskConfig['LabelVideo'] = [
            'X' => 0,
            'Y' => 0,
            'Width' => $template['width'] ?? 800,
            'Height' => $template['video_zone_height'] ?? 640,
            'VideoList' => [[
                'VideoNo' => 1,
                'VideoName' => $videoName,
                'VideoPath' => "files/task/{$videoName}",
                'VideoMD5' => md5($videoData)
            ]]
        ];
    }

    // 5. Task dosyasını yükle
    $taskJson = json_encode($taskConfig, JSON_UNESCAPED_UNICODE);
    $this->uploadFile($deviceIp, $taskJson, "files/task/{$clientId}.js");

    // 6. Ekranı güncelle
    $replayResult = $this->triggerReplay($deviceIp, "files/task/{$clientId}.js");

    return [
        'success' => $replayResult['success'],
        'client_id' => $clientId,
        'task_file' => "files/task/{$clientId}.js"
    ];
}
```

### Task JSON Formatı

```json
{
    "Id": "2C0547E35BA5",
    "ItemCode": "SKU-001",
    "ItemName": "Kırmızı Elma",

    "LabelPicture": {
        "X": 0,
        "Y": 640,
        "Width": 800,
        "Height": 640,
        "PictureName": "2C0547E35BA5.jpg",
        "PicturePath": "files/task/2C0547E35BA5.jpg",
        "PictureMD5": "cf1a6bbdec30a1926f207d67b2fc4865"
    },

    "LabelVideo": {
        "X": 0,
        "Y": 0,
        "Width": 800,
        "Height": 640,
        "VideoList": [
            {
                "VideoNo": 1,
                "VideoName": "promo.mp4",
                "VideoPath": "files/task/promo.mp4",
                "VideoMD5": "41c0727e6817646042fc3a18667cf6fc"
            }
        ]
    },

    "LabelText": {
        "X": 10,
        "Y": 1200,
        "Width": 780,
        "Height": 60,
        "TextContent": "29.99 TL",
        "FontSize": 48,
        "FontColor": "#FF0000",
        "Alignment": "center"
    }
}
```

---

## Gateway Yönlendirme Mekanizması

### Doğrudan vs Gateway Gönderimi

```php
// api/render-queue/process.php - sendLabelViaGatewayQueue()

function sendLabelViaGatewayQueue($device, $imageData, $job) {
    $db = Database::getInstance();

    // Gateway aktif mi kontrol et
    $useGateway = false;
    $gatewayId = null;

    // 1. Cihazın gateway'i var mı?
    if (!empty($device['gateway_id'])) {
        $gateway = $db->fetch(
            "SELECT * FROM gateways WHERE id = ? AND status = 'online'",
            [$device['gateway_id']]
        );
        if ($gateway) {
            $useGateway = true;
            $gatewayId = $gateway['id'];
        }
    }

    // 2. Gateway ayarı kontrol et
    $settings = getCompanySettings($job['company_id']);
    if (isset($settings['gateway_enabled']) && !$settings['gateway_enabled']) {
        $useGateway = false;
    }

    if ($useGateway) {
        // Gateway komut kuyruğuna ekle
        return queueGatewayCommand($gatewayId, $device, $imageData, $job);
    } else {
        // Doğrudan HTTP gönderimi
        return sendDirectToDevice($device, $imageData, $job);
    }
}
```

### Gateway Komut Kuyruğu

```php
function queueGatewayCommand($gatewayId, $device, $imageData, $job) {
    $db = Database::getInstance();

    // Görseli geçici dosyaya kaydet
    $tempFile = STORAGE_PATH . "/temp/gateway_" . uniqid() . ".jpg";
    file_put_contents($tempFile, $imageData);

    // Komut oluştur
    $command = [
        'id' => $db->generateUuid(),
        'gateway_id' => $gatewayId,
        'device_id' => $device['id'],
        'device_ip' => $device['ip_address'],
        'command' => 'send_label',
        'params' => json_encode([
            'image_path' => $tempFile,
            'template_id' => $job['template_id'],
            'product_id' => $job['product_id'],
            'client_id' => $device['device_id']
        ]),
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s')
    ];

    $db->insert('gateway_commands', $command);

    return [
        'success' => true,
        'method' => 'gateway_queue',
        'command_id' => $command['id']
    ];
}
```

### Doğrudan Gönderim

```php
function sendDirectToDevice($device, $imageData, $job) {
    $gateway = new PavoDisplayGateway();

    // Cihaz online mı?
    $pingResult = $gateway->ping($device['ip_address']);
    if (!$pingResult['online']) {
        return [
            'success' => false,
            'error' => 'Device offline',
            'error_type' => 'device_offline'
        ];
    }

    // Senkronize et
    $result = $gateway->syncProduct(
        $device['ip_address'],
        getProduct($job['product_id']),
        getTemplate($job['template_id']),
        $imageData
    );

    return $result;
}
```

---

## Hata Yönetimi ve Retry Mekanizması

### Hata Tipleri

| Tip | Açıklama | Max Retry | Base Delay |
|-----|----------|-----------|------------|
| timeout | Zaman aşımı | 5 | 30s |
| connection | Bağlantı hatası | 5 | 10s |
| device_offline | Cihaz çevrimdışı | 3 | 60s |
| upload_failed | Yükleme başarısız | 3 | 15s |
| unknown | Bilinmeyen hata | 2 | 30s |

### Exponential Backoff Hesaplama

```php
// RenderQueueService.php - calculateBackoff()

public function calculateBackoff(int $retryCount, string $errorType = 'unknown'): int {
    $policies = [
        'timeout' => ['base' => 30, 'multiplier' => 2.0, 'max' => 300],
        'connection' => ['base' => 10, 'multiplier' => 1.5, 'max' => 120],
        'device_offline' => ['base' => 60, 'multiplier' => 2.0, 'max' => 600],
        'upload_failed' => ['base' => 15, 'multiplier' => 2.0, 'max' => 180],
        'unknown' => ['base' => 30, 'multiplier' => 2.0, 'max' => 120]
    ];

    $policy = $policies[$errorType] ?? $policies['unknown'];

    // delay = base * (multiplier ^ retryCount)
    $delay = $policy['base'] * pow($policy['multiplier'], $retryCount);

    // Max delay'i aşmasın
    return min((int)$delay, $policy['max']);
}

// Örnek hesaplamalar (timeout için):
// Retry 0: 30 * 2^0 = 30 saniye
// Retry 1: 30 * 2^1 = 60 saniye
// Retry 2: 30 * 2^2 = 120 saniye
// Retry 3: 30 * 2^3 = 240 saniye
// Retry 4: 30 * 2^4 = 300 saniye (max)
```

### Retry Zamanlama

```php
// RenderQueueService.php - scheduleRetry()

public function scheduleRetry(string $itemId, string $errorType): array {
    $db = Database::getInstance();

    // Mevcut retry sayısını al
    $item = $db->fetch("SELECT * FROM render_queue_items WHERE id = ?", [$itemId]);
    $retryCount = $item['retry_count'] + 1;

    // Max retry kontrolü
    $maxRetries = $this->getMaxRetries($errorType);
    if ($retryCount > $maxRetries) {
        // Kalıcı başarısız olarak işaretle
        $db->update('render_queue_items', [
            'status' => 'failed',
            'error_message' => "Max retries ({$maxRetries}) exceeded"
        ], 'id = ?', [$itemId]);

        return ['scheduled' => false, 'reason' => 'max_retries_exceeded'];
    }

    // Sonraki deneme zamanını hesapla
    $backoffSeconds = $this->calculateBackoff($retryCount, $errorType);
    $nextRetryAt = date('Y-m-d H:i:s', time() + $backoffSeconds);

    // Güncelle
    $db->update('render_queue_items', [
        'status' => 'pending',
        'retry_count' => $retryCount,
        'next_retry_at' => $nextRetryAt,
        'error_type' => $errorType
    ], 'id = ?', [$itemId]);

    return [
        'scheduled' => true,
        'retry_count' => $retryCount,
        'next_retry_at' => $nextRetryAt,
        'backoff_seconds' => $backoffSeconds
    ];
}
```

### Hata Tipi Tespiti

```php
// RenderQueueService.php - detectErrorType()

public function detectErrorType(string $errorMessage): string {
    $errorMessage = strtolower($errorMessage);

    $patterns = [
        'timeout' => ['timeout', 'timed out', 'deadline', 'exceeded time'],
        'connection' => ['connection', 'refused', 'reset', 'network', 'curl error'],
        'device_offline' => ['offline', 'unreachable', 'not found', 'no route'],
        'upload_failed' => ['upload', 'transfer', '413', 'too large', 'storage full']
    ];

    foreach ($patterns as $type => $keywords) {
        foreach ($keywords as $keyword) {
            if (strpos($errorMessage, $keyword) !== false) {
                return $type;
            }
        }
    }

    return 'unknown';
}
```

---

## Özet

### Tekli Gönderim Akışı

```
Ürün Seç → Cihaz Seç → Şablon Seç → render.php → PavoDisplayGateway → Cihaz
```

### Toplu Gönderim Akışı

```
Ürünleri Seç → Ayarları Belirle → render-queue API → Kuyruk DB → process.php → Cihazlar
```

### Otomatik Gönderim Akışı

```
Auto Wizard → Cache Kontrol → auto.php → Batch Jobs → process.php Worker → Cihazlar
```

### Kritik Noktalar

1. **Runtime render yapılmaz** - Tüm görseller önceden hazırlanmalı
2. **Company izolasyonu** - Her firma kendi dizininde
3. **Öncelik sıralaması** - FIFO + Priority weight
4. **Exponential backoff** - Akıllı retry mekanizması
5. **Gateway yönlendirme** - Merkezi veya dağıtık mimari

---

## İlgili Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `public/assets/js/pages/products/ProductList.js` | Ürünler sayfası UI |
| `public/assets/js/pages/queue/QueueDashboard.js` | Kuyruk dashboard UI |
| `api/templates/render.php` | Anlık render API |
| `api/render-queue/auto.php` | Otomatik kuyruk oluşturma |
| `api/render-queue/process.php` | Kuyruk işleme worker |
| `services/RenderQueueService.php` | Kuyruk yönetim servisi |
| `services/PavoDisplayGateway.php` | Cihaz iletişim servisi |
| `database/migrations/044_render_queue_system.sql` | Kuyruk tablo şeması |

---

*Bu döküman Omnex Display Hub v2.0.14 için hazırlanmıştır.*
