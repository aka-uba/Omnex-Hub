# Render Cache Sistemi

Bu dokümantasyon, dijital etiket tasarımlarının render edilmesi, cache'lenmesi ve cihazlara gönderilmesi süreçlerini açıklar.

## Genel Bakış

Render Cache Sistemi, ürün-şablon kombinasyonları için dijital etiket görsellerini oluşturur, saklar ve cihazlara gönderir. Sistem, frontend'de Fabric.js canvas render'ı ve backend'de dosya cache yönetimi kullanır.

## Mimari

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend       │     │   Storage       │
│   (Fabric.js)   │────▶│   (PHP)         │────▶│   (Files)       │
│   Canvas Render │     │   Cache Service │     │   /renders/     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       ▼                       │
        │               ┌─────────────────┐            │
        │               │   render_jobs   │            │
        │               │   (SQLite)      │            │
        │               └─────────────────┘            │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    ESL / Signage Cihazları                   │
└─────────────────────────────────────────────────────────────────┘
```

## Veritabanı Tabloları

### render_jobs

Render işlerini takip eden ana tablo.

```sql
CREATE TABLE render_jobs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    job_type TEXT DEFAULT 'render',      -- assign, update, bulk, import, erp_sync
    source TEXT,                          -- assign_label, device_products, queue, etc.
    priority TEXT DEFAULT 'normal',       -- low, normal, high, urgent
    status TEXT DEFAULT 'pending',        -- pending, processing, completed, failed
    batch_id TEXT,                        -- Toplu işlemler için grup ID
    batch_index INTEGER,
    batch_total INTEGER,
    image_path TEXT,                      -- Render sonucu dosya yolu
    image_md5 TEXT,
    image_size INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (template_id) REFERENCES templates(id)
);
```

### render_cache

Render edilmiş görsellerin cache metadata'sı.

```sql
CREATE TABLE render_cache (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_md5 TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'valid',          -- valid, stale, orphan
    created_at TEXT,
    updated_at TEXT,
    expires_at TEXT,
    UNIQUE(company_id, product_id, template_id)
);
```

## Dosya Yapısı

### Storage Dizini

```
storage/
└── renders/
    └── {company_id}/
        ├── cache/
        │   └── {product_id}_{template_id}.png
        └── queue/
            └── {product_id}.png
```

### Servis Dosyaları

```
services/
├── RenderCacheService.php        # Ana cache yönetim servisi
├── RenderCacheCleanupService.php # Temizlik servisi (planlanan)
└── NotificationTriggers.php      # Bildirim tetikleyicileri
```

### API Endpoint'leri

```
api/render-cache/
├── process.php     # Job işleme (GET: sonraki job, POST: sonuç kaydet)
├── status.php      # Cache durumu sorgulama
├── analyze.php     # Temizlik analizi (planlanan)
└── cleanup.php     # Temizlik işlemi (planlanan)
```

## RenderCacheService

Ana cache yönetim servisi.

### Metodlar

| Metod | Açıklama |
|-------|----------|
| `createRenderJob($params)` | Yeni render job oluştur |
| `getNextJob($companyId)` | Sonraki bekleyen job'u al |
| `completeJob($jobId, $path, $md5, $size)` | Job'u tamamla |
| `failJob($jobId, $error)` | Job'u başarısız işaretle |
| `getPendingJobCount($companyId)` | Bekleyen job sayısı |
| `getBatchStatus($batchId)` | Batch durumunu al |
| `getCacheStatus($productId, $templateId)` | Cache durumunu kontrol et |

### Örnek Kullanım

```php
require_once BASE_PATH . '/services/RenderCacheService.php';

$cacheService = new RenderCacheService();

// Yeni job oluştur
$jobId = $cacheService->createRenderJob([
    'product_id' => $productId,
    'template_id' => $templateId,
    'company_id' => $companyId,
    'job_type' => 'assign',
    'source' => 'assign_label',
    'priority' => 'high',
    'created_by' => $userId
]);

// Sonraki job'u al
$job = $cacheService->getNextJob($companyId);

// Job'u tamamla
$cacheService->completeJob($jobId, $filePath, $imageMd5, $imageSize);
```

## Render Job Tetikleme Noktaları

### 1. Etiket Atama (assign-label.php)

Ürüne etiket ve şablon atandığında otomatik render job oluşturulur.

```php
// api/products/assign-label.php

// Ürünü cihaza ve şablona ata
$db->update('products', [
    'assigned_device_id' => $deviceId,
    'assigned_template_id' => $templateId,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$productId]);

// Şablon atandıysa render cache job oluştur
if ($templateId) {
    require_once BASE_PATH . '/services/RenderCacheService.php';
    $cacheService = new RenderCacheService();

    $jobId = $cacheService->createRenderJob([
        'product_id' => $productId,
        'template_id' => $templateId,
        'company_id' => $companyId,
        'job_type' => 'assign',
        'source' => 'assign_label',
        'priority' => 'high',
        'created_by' => $user['id']
    ]);

    $renderJobCreated = !empty($jobId);
}
```

### 2. Cihaz Ürün Atama (devices/products.php)

Cihaza ürün atandığında render job oluşturulur.

```php
// api/devices/products.php - POST

// Ürünü cihaza ata
$db->update('products', [
    'assigned_device_id' => $deviceId,
    'assigned_template_id' => $templateId,
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$productId]);

// Şablon atandıysa render cache job oluştur
if ($templateId) {
    require_once BASE_PATH . '/services/RenderCacheService.php';
    $cacheService = new RenderCacheService();

    $jobId = $cacheService->createRenderJob([
        'product_id' => $productId,
        'template_id' => $templateId,
        'company_id' => $companyId,
        'job_type' => 'assign',
        'source' => 'device_products',
        'priority' => 'high',
        'created_by' => $user['id']
    ]);
}
```

### 3. Toplu Gönderim (render-queue/auto.php)

Otomatik toplu gönderimde pre-rendered görseller kaydedilir.

```php
// api/render-queue/auto.php

function savePreRenderedImage(string $base64Image, string $productId, string $companyId): ?string
{
    // Base64 decode
    $parts = explode(',', $base64Image);
    $imageData = base64_decode($parts[1]);

    // Multi-tenant dizin yapısı
    $renderDir = STORAGE_PATH . '/renders/' . $companyId . '/queue';
    if (!is_dir($renderDir)) {
        mkdir($renderDir, 0755, true);
    }

    // Dosya kaydet (aynı ürün için üzerine yazar)
    $filename = $productId . '.png';
    $filePath = $renderDir . '/' . $filename;
    file_put_contents($filePath, $imageData);

    return $filePath;
}
```

## Frontend Render Worker

Frontend'de çalışan render worker, bekleyen job'ları işler.

### RenderWorker.js

```javascript
class RenderWorker {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.pollInterval = 2000; // 2 saniye
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.poll();
    }

    async poll() {
        while (this.isRunning) {
            try {
                // Sonraki job'u al
                const response = await this.app.api.get('/render-cache/process');

                if (response.data?.has_job) {
                    await this.processJob(response.data);
                } else {
                    // Bekleyen job yok, bekle
                    await this.sleep(this.pollInterval);
                }
            } catch (error) {
                console.error('Render worker error:', error);
                await this.sleep(5000);
            }
        }
    }

    async processJob(jobData) {
        const { job, product, template } = jobData;

        try {
            // Fabric.js ile render
            const canvas = await this.renderTemplate(template, product);
            const imageBase64 = canvas.toDataURL('image/png');

            // Sonucu backend'e gönder
            await this.app.api.post('/render-cache/process', {
                job_id: job.id,
                success: true,
                image_base64: imageBase64
            });
        } catch (error) {
            // Hatayı bildir
            await this.app.api.post('/render-cache/process', {
                job_id: job.id,
                success: false,
                error_message: error.message
            });
        }
    }
}
```

## Bildirim Sistemi Entegrasyonu

Render işlemleri tamamlandığında kullanıcıya bildirim gönderilir.

### NotificationTriggers

```php
// services/NotificationTriggers.php

/**
 * Render işleri tamamlandığında bildirim gönder
 */
public static function onRenderJobsComplete(
    string $userId,
    string $source,
    int $designCount,
    int $productCount = 0,
    array $extra = []
): void {
    $service = NotificationService::getInstance();

    // Kaynağa göre mesaj oluştur
    $sourceNames = [
        'erp' => 'ERP senkronizasyonu',
        'tamsoft' => 'TAMSOFT ERP',
        'import' => 'ürün içe aktarma',
        'api' => 'API güncelleme',
        'manual' => 'manuel işlem',
        'queue' => 'gönderim kuyruğu',
        'bulk_send' => 'toplu gönderim'
    ];

    // Bildirim gönder
    $service->sendToUser($userId, $title, $message, [
        'type' => NotificationService::TYPE_SUCCESS,
        'icon' => $icon,
        'link' => '#/queue',
        'priority' => NotificationService::PRIORITY_NORMAL
    ]);
}

/**
 * Render işleri başarısız olduğunda bildirim gönder
 */
public static function onRenderJobsFailed(
    string $userId,
    string $source,
    int $failedCount,
    ?string $errorMessage = null
): void {
    // Hata bildirimi gönder
}
```

### Batch Tamamlanma Bildirimi

Batch işlemler tamamlandığında `process.php` otomatik bildirim tetikler:

```php
// api/render-cache/process.php

// Batch durumu
if (!empty($job['batch_id'])) {
    $batchStatus = $cacheService->getBatchStatus($job['batch_id']);

    // Batch tamamlandıysa bildirim gönder
    if (!empty($batchStatus['is_complete']) && $batchStatus['is_complete'] === true) {
        require_once BASE_PATH . '/services/NotificationTriggers.php';

        $completedCount = $batchStatus['completed'] ?? 0;
        $failedCount = $batchStatus['failed'] ?? 0;

        // Başarılı olanlar için bildirim
        if ($completedCount > 0) {
            NotificationTriggers::onRenderJobsComplete(
                $user['id'],
                $source,
                $completedCount,
                $batchStatus['total'] ?? $completedCount
            );
        }

        // Başarısız olanlar için bildirim
        if ($failedCount > 0) {
            NotificationTriggers::onRenderJobsFailed(
                $user['id'],
                $source,
                $failedCount,
                'Bazı tasarımlar render edilemedi'
            );
        }
    }
}
```

## Job Tipleri ve Kaynaklar

### Job Type (job_type)

| Tip | Açıklama |
|-----|----------|
| `assign` | Etiket atama sonrası |
| `update` | Ürün/şablon güncelleme sonrası |
| `bulk` | Toplu işlem |
| `bulk_send` | Toplu gönderim |
| `import` | İçe aktarma sonrası |
| `erp_sync` | ERP senkronizasyonu sonrası |

### Source (source)

| Kaynak | Açıklama |
|--------|----------|
| `assign_label` | Etiket atama API'si |
| `device_products` | Cihaz ürün API'si |
| `queue` | Gönderim kuyruğu |
| `product_update` | Ürün güncelleme |
| `template_update` | Şablon güncelleme |

### Priority (priority)

| Öncelik | Açıklama |
|---------|----------|
| `urgent` | Hemen işle |
| `high` | Yüksek öncelik |
| `normal` | Normal sıra |
| `low` | Düşük öncelik |

## API Endpoint'leri

### GET /api/render-cache/process

Sonraki bekleyen job'u alır.

**Response (job varsa):**
```json
{
    "success": true,
    "has_job": true,
    "job": {
        "id": "uuid",
        "product_id": "uuid",
        "template_id": "uuid",
        "job_type": "assign",
        "priority": "high",
        "batch_id": "uuid",
        "batch_index": 1,
        "batch_total": 10
    },
    "product": { ... },
    "template": { ... },
    "pending_count": 9,
    "batch_status": { ... }
}
```

**Response (job yoksa):**
```json
{
    "success": true,
    "has_job": false,
    "pending_count": 0,
    "message": "Bekleyen render job yok"
}
```

### POST /api/render-cache/process

Render sonucunu kaydeder.

**Request (başarılı):**
```json
{
    "job_id": "uuid",
    "success": true,
    "image_base64": "data:image/png;base64,..."
}
```

**Request (başarısız):**
```json
{
    "job_id": "uuid",
    "success": false,
    "error_message": "Template render failed"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Render başarıyla kaydedildi",
    "image_path": "/storage/renders/company-id/cache/product_template.png",
    "image_md5": "abc123...",
    "image_size": 45678,
    "pending_count": 8,
    "batch_status": {
        "is_complete": false,
        "total": 10,
        "completed": 2,
        "failed": 0,
        "pending": 8
    }
}
```

## Cache Temizleme (Planlanan)

### Orphan Dosya Türleri

| Tür | Açıklama |
|-----|----------|
| Root Orphans | `/storage/renders/` dizinindeki eski PAVO_*.png dosyaları |
| Stale Cache | DB'de `status='stale'` ama diskte mevcut |
| DB'siz Dosyalar | Diskte var, `render_cache` tablosunda kayıt yok |

### Temizlik API'leri (Planlanan)

```
GET  /api/render-cache/analyze  # Analiz raporu
POST /api/render-cache/cleanup  # Temizlik işlemi
```

## Performans Optimizasyonları

### 1. Batch İşleme

Toplu işlemler tek batch altında gruplandığında:
- Progress tracking kolaylaşır
- Tek bildirim gönderilir
- Veritabanı yükü azalır

### 2. Priority Sıralaması

```sql
SELECT * FROM render_jobs
WHERE company_id = ? AND status = 'pending'
ORDER BY
    CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    created_at ASC
LIMIT 1
```

### 3. Dosya Üzerine Yazma

Aynı ürün için tekrar render yapıldığında eski dosya üzerine yazılır:

```php
// Dosya adı: product_template.png
$filename = $job['product_id'] . '_' . $job['template_id'] . '.png';
```

Bu yaklaşım:
- Disk alanı tasarrufu sağlar
- Orphan dosya oluşumunu önler
- Cache tutarlılığını korur

## Hata Yönetimi

### Retry Mekanizması

```php
// Job başarısızsa retry_count artır
$db->query(
    "UPDATE render_jobs SET
        status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
        retry_count = retry_count + 1,
        error_message = ?
    WHERE id = ?",
    [$errorMessage, $jobId]
);
```

### Hata Tipleri

| Hata | Açıklama | Çözüm |
|------|----------|-------|
| Template not found | Şablon silinmiş | Job'u başarısız işaretle |
| Product not found | Ürün silinmiş | Job'u başarısız işaretle |
| Base64 decode failed | Geçersiz görsel verisi | Retry |
| File write failed | Disk hatası | Retry |

## İzleme ve Debug

### Log Mesajları

```php
Logger::info('Assign-label: Render job created', [
    'product_id' => $productId,
    'template_id' => $templateId,
    'job_id' => $jobId
]);

Logger::info('NotificationTriggers: Render jobs complete notification sent', [
    'user_id' => $userId,
    'source' => $source,
    'design_count' => $designCount,
    'product_count' => $productCount
]);
```

### Debug Endpoint'leri

```
GET /api/render-cache/status?product_id=X&template_id=Y
```

## Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 2.0.5 | 2026-01 | Phase 1 - Paralel gönderim, delta update, binary DB'den çıkarma |
| 2.0.6 | 2026-01 | Phase 2 - Queue sistemi, exponential backoff, retry |
| 2.0.18 | 2026-02 | Render job auto-trigger on assign-label and device-products |
| 2.0.18 | 2026-02 | Batch completion notifications integration |
