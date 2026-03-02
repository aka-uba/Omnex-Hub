# Multi-Tenant Media System Refactoring Plan

**Tarih:** 2026-01-27
**Versiyon:** 1.0
**Durum:** Planlama Aşaması

---

## 1. Mevcut Durum Analizi

### 1.1 Tespit Edilen Kritik Sorunlar

| # | Sorun | Önem | Etki |
|---|-------|------|------|
| 1 | `storage_limit` tanımlı ama UYGULANMIYOR | KRİTİK | Sınırsız yükleme mümkün |
| 2 | Disk alanı kontrolü YOK | KRİTİK | Disk dolabilir |
| 3 | Legacy `/storage/media/` auth gerektirmiyor | GÜVENLİK | Yetkisiz erişim |
| 4 | `products.version` güncellenmemiyor | ORTA | Cache invalidation bozuk |
| 5 | Tarih bazlı dizin yapısı karmaşık | DÜŞÜK | Yönetim zorluğu |
| 6 | Render dosyaları kota dışı | ORTA | Gerçek kullanım takip edilmiyor |

### 1.2 Mevcut Dizin Yapısı (Sorunlu)

```
storage/
├── media/                          # ⚠️ LEGACY - Auth yok
├── public/                         # Ortak medya
├── avatars/                        # Profil fotoları
├── renders/                        # ⚠️ Firma bazlı DEĞİL
│   └── cache/
├── templates/
│   └── renders/                    # ⚠️ Firma bazlı DEĞİL
└── companies/
    └── {company_id}/
        └── media/
            └── {YYYY}/             # ⚠️ Tarih dizinleri
                └── {MM}/
```

---

## 2. Hedef Dizin Yapısı

### 2.1 Yeni Yapı

```
storage/
├── public/                         # Ortak medya (Admin only)
│   ├── images/
│   └── videos/
├── avatars/                        # Profil fotoları (değişmez)
├── system/                         # Sistem dosyaları (Admin only)
└── companies/
    └── {company_id}/
        ├── media/
        │   ├── images/             # Firma görselleri
        │   └── videos/             # Firma videoları
        ├── templates/              # Firma şablonları
        │   └── renders/            # Şablon preview görselleri
        └── renders/                # Ürün render çıktıları
            └── products/           # Ürün bazlı renderlar
```

### 2.2 Dizin Kuralları

| Dizin | Erişim | Kota Dahil | Açıklama |
|-------|--------|------------|----------|
| `/public/` | Tüm auth kullanıcılar | Hayır | Ortak görsel kütüphanesi |
| `/companies/{id}/media/` | Sadece firma | Evet | Firma medyaları |
| `/companies/{id}/templates/` | Sadece firma | Evet | Firma şablonları |
| `/companies/{id}/renders/` | Sadece firma | Evet | Ürün renderları |

---

## 3. Veritabanı Değişiklikleri

### 3.1 Migration 050: Media Refactor

```sql
-- media tablosu güncelleme
ALTER TABLE media ADD COLUMN media_type TEXT DEFAULT 'image'; -- 'image' | 'video'
ALTER TABLE media ADD COLUMN file_size INTEGER DEFAULT 0;     -- Byte cinsinden

-- Mevcut kayıtlar için type tespiti
UPDATE media SET media_type =
    CASE
        WHEN file_type IN ('mp4', 'webm', 'avi', 'mov', 'mkv') THEN 'video'
        ELSE 'image'
    END
WHERE media_type IS NULL;

-- file_size güncelleme trigger'ı için gerekli değil, upload sırasında set edilecek
```

### 3.2 Migration 051: Storage Tracking

```sql
-- Firma depolama kullanımı takip tablosu
CREATE TABLE IF NOT EXISTS company_storage_usage (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    media_bytes INTEGER DEFAULT 0,        -- Media klasörü
    templates_bytes INTEGER DEFAULT 0,    -- Template klasörü
    renders_bytes INTEGER DEFAULT 0,      -- Render klasörü
    total_bytes INTEGER DEFAULT 0,        -- Toplam
    last_calculated_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_storage_company ON company_storage_usage(company_id);
```

### 3.3 Migration 052: Product Version Fix

```sql
-- Products version trigger (SQLite)
-- Not: SQLite'da trigger yerine PHP'de yapılacak
-- Bu migration sadece documentation amaçlı

-- products.version her update'de artırılmalı
-- Bu işlem api/products/update.php'de yapılacak
```

### 3.4 Migration 053: Template Company Scope

```sql
-- Templates tablosu: company_id zorunlu hale getir (system dışındakiler için)
-- Mevcut scope='company' kayıtların company_id'si var mı kontrol et

-- Render kayıtları için tablo (opsiyonel - tracking için)
CREATE TABLE IF NOT EXISTS product_renders (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    device_type TEXT,
    locale TEXT DEFAULT 'tr',
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    product_version INTEGER,
    template_version INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE INDEX idx_renders_product ON product_renders(product_id);
CREATE INDEX idx_renders_company ON product_renders(company_id);
CREATE UNIQUE INDEX idx_renders_unique ON product_renders(product_id, template_id, device_type, locale);
```

---

## 4. API Değişiklikleri

### 4.1 api/media/upload.php Değişiklikleri

```php
// KALDIRILACAK
// $yearMonth = date('Y/m');
// $relativePath = 'companies/' . $companyId . '/media/' . $yearMonth;

// YENİ YAPILACAK
$fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
$mediaType = in_array($fileExt, $videoExtensions) ? 'videos' : 'images';

$relativePath = 'companies/' . $companyId . '/media/' . $mediaType;

// KOTA KONTROLÜ EKLENECEK
$storageService = new StorageService();
$quotaCheck = $storageService->checkQuota($companyId, $file['size']);
if (!$quotaCheck['allowed']) {
    Response::error($quotaCheck['message'], 413); // Payload Too Large
}
```

### 4.2 Yeni Servis: StorageService.php

```php
<?php
/**
 * StorageService - Firma depolama yönetimi
 */
class StorageService
{
    private $db;

    // Varsayılan limitler (MB cinsinden)
    const DEFAULT_LIMIT_MB = 1024; // 1GB

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Kota kontrolü
     */
    public function checkQuota(string $companyId, int $additionalBytes): array
    {
        $usage = $this->getUsage($companyId);
        $limit = $this->getLimit($companyId);

        $limitBytes = $limit * 1024 * 1024; // MB -> Bytes
        $newTotal = $usage['total_bytes'] + $additionalBytes;

        if ($limitBytes > 0 && $newTotal > $limitBytes) {
            $usedMB = round($usage['total_bytes'] / 1024 / 1024, 2);
            $limitMB = $limit;
            $additionalMB = round($additionalBytes / 1024 / 1024, 2);

            return [
                'allowed' => false,
                'message' => "Depolama kotası aşıldı. Kullanılan: {$usedMB}MB / {$limitMB}MB. Yüklemek istediğiniz dosya: {$additionalMB}MB",
                'usage' => $usage,
                'limit_mb' => $limit
            ];
        }

        return [
            'allowed' => true,
            'remaining_bytes' => $limitBytes - $usage['total_bytes'],
            'usage' => $usage,
            'limit_mb' => $limit
        ];
    }

    /**
     * Kullanım bilgisi al veya hesapla
     */
    public function getUsage(string $companyId, bool $forceRecalculate = false): array
    {
        $cached = $this->db->fetch(
            "SELECT * FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        // 1 saatten eski veya yoksa yeniden hesapla
        $shouldRecalculate = $forceRecalculate || !$cached ||
            (strtotime($cached['last_calculated_at'] ?? '2000-01-01') < strtotime('-1 hour'));

        if ($shouldRecalculate) {
            return $this->recalculateUsage($companyId);
        }

        return [
            'media_bytes' => (int)$cached['media_bytes'],
            'templates_bytes' => (int)$cached['templates_bytes'],
            'renders_bytes' => (int)$cached['renders_bytes'],
            'total_bytes' => (int)$cached['total_bytes'],
            'last_calculated_at' => $cached['last_calculated_at']
        ];
    }

    /**
     * Kullanımı yeniden hesapla
     */
    public function recalculateUsage(string $companyId): array
    {
        $basePath = STORAGE_PATH . '/companies/' . $companyId;

        $mediaBytes = $this->calculateDirectorySize($basePath . '/media');
        $templatesBytes = $this->calculateDirectorySize($basePath . '/templates');
        $rendersBytes = $this->calculateDirectorySize($basePath . '/renders');
        $totalBytes = $mediaBytes + $templatesBytes + $rendersBytes;

        // Veritabanına kaydet
        $existing = $this->db->fetch(
            "SELECT id FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        $data = [
            'company_id' => $companyId,
            'media_bytes' => $mediaBytes,
            'templates_bytes' => $templatesBytes,
            'renders_bytes' => $rendersBytes,
            'total_bytes' => $totalBytes,
            'last_calculated_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            $this->db->update('company_storage_usage', $data, 'company_id = ?', [$companyId]);
        } else {
            $data['id'] = $this->db->generateUuid();
            $data['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('company_storage_usage', $data);
        }

        return [
            'media_bytes' => $mediaBytes,
            'templates_bytes' => $templatesBytes,
            'renders_bytes' => $rendersBytes,
            'total_bytes' => $totalBytes,
            'last_calculated_at' => $data['last_calculated_at']
        ];
    }

    /**
     * Dizin boyutunu hesapla
     */
    private function calculateDirectorySize(string $path): int
    {
        if (!is_dir($path)) return 0;

        $size = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }

        return $size;
    }

    /**
     * Firma depolama limitini al
     */
    public function getLimit(string $companyId): int
    {
        $license = $this->db->fetch(
            "SELECT storage_limit FROM licenses WHERE company_id = ? ORDER BY created_at DESC LIMIT 1",
            [$companyId]
        );

        return (int)($license['storage_limit'] ?? self::DEFAULT_LIMIT_MB);
    }

    /**
     * Kullanımı artır (hızlı güncelleme)
     */
    public function incrementUsage(string $companyId, int $bytes, string $type = 'media'): void
    {
        $column = $type . '_bytes';

        $this->db->query(
            "UPDATE company_storage_usage
             SET {$column} = {$column} + ?,
                 total_bytes = total_bytes + ?,
                 updated_at = datetime('now')
             WHERE company_id = ?",
            [$bytes, $bytes, $companyId]
        );
    }

    /**
     * Kullanımı azalt
     */
    public function decrementUsage(string $companyId, int $bytes, string $type = 'media'): void
    {
        $column = $type . '_bytes';

        $this->db->query(
            "UPDATE company_storage_usage
             SET {$column} = MAX(0, {$column} - ?),
                 total_bytes = MAX(0, total_bytes - ?),
                 updated_at = datetime('now')
             WHERE company_id = ?",
            [$bytes, $bytes, $companyId]
        );
    }
}
```

### 4.3 api/products/update.php - Version Artırma

```php
// MEVCUT KODA EKLENECEK (update işleminden önce)

// Version artır
$currentProduct = $db->fetch("SELECT version FROM products WHERE id = ?", [$id]);
$newVersion = ((int)($currentProduct['version'] ?? 0)) + 1;

// Update data'ya ekle
$updateData['version'] = $newVersion;
$updateData['updated_at'] = date('Y-m-d H:i:s');

// Ürün render'larını temizle (version değişti)
$renderService = new RenderService();
$renderService->invalidateProductRenders($id, $companyId);
```

### 4.4 Yeni Servis: RenderService.php

```php
<?php
/**
 * RenderService - Ürün render yönetimi
 */
class RenderService
{
    private $db;
    private $storageService;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->storageService = new StorageService();
    }

    /**
     * Ürün render'larını geçersiz kıl ve sil
     */
    public function invalidateProductRenders(string $productId, string $companyId): int
    {
        // Render dosyalarını bul
        $basePath = STORAGE_PATH . '/companies/' . $companyId . '/renders/products/' . $productId;

        $deletedBytes = 0;
        $deletedCount = 0;

        if (is_dir($basePath)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $deletedBytes += $file->getSize();
                    @unlink($file->getPathname());
                    $deletedCount++;
                } elseif ($file->isDir()) {
                    @rmdir($file->getPathname());
                }
            }
            @rmdir($basePath);
        }

        // Veritabanından kayıtları sil
        $this->db->delete('product_renders', 'product_id = ?', [$productId]);

        // Storage kullanımını güncelle
        if ($deletedBytes > 0) {
            $this->storageService->decrementUsage($companyId, $deletedBytes, 'renders');
        }

        Logger::audit('render_invalidation', 'product', [
            'product_id' => $productId,
            'deleted_files' => $deletedCount,
            'freed_bytes' => $deletedBytes
        ]);

        return $deletedCount;
    }

    /**
     * Yeni render kaydet
     */
    public function saveRender(array $params): string
    {
        $id = $this->db->generateUuid();

        $this->db->insert('product_renders', [
            'id' => $id,
            'company_id' => $params['company_id'],
            'product_id' => $params['product_id'],
            'template_id' => $params['template_id'],
            'device_type' => $params['device_type'] ?? null,
            'locale' => $params['locale'] ?? 'tr',
            'file_path' => $params['file_path'],
            'file_size' => $params['file_size'] ?? 0,
            'product_version' => $params['product_version'] ?? 1,
            'template_version' => $params['template_version'] ?? 1
        ]);

        // Storage kullanımını artır
        if (!empty($params['file_size'])) {
            $this->storageService->incrementUsage($params['company_id'], $params['file_size'], 'renders');
        }

        return $id;
    }

    /**
     * Render yolu oluştur
     */
    public function getRenderPath(string $companyId, string $productId, string $templateId, string $deviceType = 'default', string $locale = 'tr'): string
    {
        $hash = substr(md5($templateId . $deviceType . $locale), 0, 8);
        return "companies/{$companyId}/renders/products/{$productId}/{$hash}.jpg";
    }

    /**
     * Render var mı ve güncel mi kontrol et
     */
    public function isRenderValid(string $productId, string $templateId, int $productVersion, int $templateVersion): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM product_renders
             WHERE product_id = ? AND template_id = ?
             AND product_version = ? AND template_version = ?",
            [$productId, $templateId, $productVersion, $templateVersion]
        );
    }
}
```

### 4.5 api/media/index.php - Filtre Desteği

```php
// MEVCUT KODA EKLENECEK

$mediaType = $request->input('media_type'); // 'image' | 'video' | null (all)

if ($mediaType) {
    $where[] = "media_type = ?";
    $params[] = $mediaType;
}

// Sıralama seçenekleri
$sortField = $request->input('sort', 'created_at');
$sortDir = strtoupper($request->input('dir', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

$allowedSortFields = ['created_at', 'file_size', 'original_name', 'media_type'];
if (!in_array($sortField, $allowedSortFields)) {
    $sortField = 'created_at';
}

$orderBy = "ORDER BY {$sortField} {$sortDir}";
```

### 4.6 api/templates/render.php Değişiklikleri

```php
// MEVCUT KODA EKLENECEK

// Render yolu firma bazlı olacak
$renderService = new RenderService();
$renderPath = $renderService->getRenderPath($companyId, $productId, $templateId, $deviceType, $locale);
$fullPath = STORAGE_PATH . '/' . $renderPath;

// Dizin yoksa oluştur
$dir = dirname($fullPath);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

// Render sonrası kaydet
$renderService->saveRender([
    'company_id' => $companyId,
    'product_id' => $productId,
    'template_id' => $templateId,
    'device_type' => $deviceType,
    'locale' => $locale,
    'file_path' => $renderPath,
    'file_size' => filesize($fullPath),
    'product_version' => $product['version'] ?? 1,
    'template_version' => $template['version'] ?? 1
]);
```

---

## 5. Frontend Değişiklikleri

### 5.1 MediaLibrary.js - Filtre UI

```javascript
// Toolbar'a filtre ekle
renderToolbar() {
    return `
        <div class="media-toolbar">
            <div class="media-filters">
                <select id="media-type-filter" class="form-select">
                    <option value="">${this.__('media.filter.all')}</option>
                    <option value="image">${this.__('media.filter.images')}</option>
                    <option value="video">${this.__('media.filter.videos')}</option>
                </select>
                <select id="media-sort" class="form-select">
                    <option value="created_at">${this.__('media.sort.newest')}</option>
                    <option value="file_size">${this.__('media.sort.size')}</option>
                    <option value="original_name">${this.__('media.sort.name')}</option>
                </select>
            </div>
            <div class="media-actions">
                <button class="btn btn-primary" id="upload-btn">
                    <i class="ti ti-upload"></i>
                    ${this.__('media.upload')}
                </button>
            </div>
        </div>
    `;
}

// Filtre değişikliğinde yeniden yükle
bindFilterEvents() {
    document.getElementById('media-type-filter')?.addEventListener('change', (e) => {
        this.currentFilter.media_type = e.target.value;
        this.loadMedia();
    });

    document.getElementById('media-sort')?.addEventListener('change', (e) => {
        this.currentFilter.sort = e.target.value;
        this.loadMedia();
    });
}

// API çağrısına filtreler ekle
async loadMedia() {
    const params = new URLSearchParams();
    if (this.currentFilter.media_type) {
        params.append('media_type', this.currentFilter.media_type);
    }
    params.append('sort', this.currentFilter.sort || 'created_at');

    const response = await this.app.api.get(`/media?${params}`);
    // ...
}
```

### 5.2 Kota Gösterimi - Header veya Sidebar

```javascript
// StorageIndicator.js
export class StorageIndicator {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const response = await this.app.api.get('/storage/usage');
        if (!response.success) return '';

        const { usage, limit_mb } = response.data;
        const usedMB = Math.round(usage.total_bytes / 1024 / 1024);
        const percent = limit_mb > 0 ? Math.min(100, (usedMB / limit_mb) * 100) : 0;

        const colorClass = percent > 90 ? 'danger' : percent > 70 ? 'warning' : 'primary';

        return `
            <div class="storage-indicator">
                <div class="storage-label">
                    <i class="ti ti-database"></i>
                    <span>${usedMB}MB / ${limit_mb}MB</span>
                </div>
                <div class="storage-bar">
                    <div class="storage-bar-fill ${colorClass}" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }
}
```

### 5.3 Upload Hata Mesajı

```javascript
// MediaLibrary.js - upload fonksiyonunda
async uploadFile(file) {
    try {
        // ...existing code...
    } catch (error) {
        if (error.status === 413) {
            // Kota aşıldı
            Toast.error(this.__('media.errors.quotaExceeded'));
            this.showQuotaWarning(error.data);
        } else {
            Toast.error(error.message || this.__('media.errors.uploadFailed'));
        }
    }
}

showQuotaWarning(data) {
    Modal.show({
        title: this.__('media.quota.title'),
        icon: 'ti-alert-triangle',
        content: `
            <div class="quota-warning">
                <p>${data.message}</p>
                <div class="quota-stats">
                    <div>Kullanılan: ${Math.round(data.usage.total_bytes / 1024 / 1024)}MB</div>
                    <div>Limit: ${data.limit_mb}MB</div>
                </div>
                <p class="text-muted">${this.__('media.quota.hint')}</p>
            </div>
        `,
        showCancel: false,
        confirmText: this.__('actions.ok')
    });
}
```

---

## 6. Yeni API Endpoint'leri

### 6.1 GET /api/storage/usage

Firma depolama kullanım bilgisi.

```php
<?php
// api/storage/usage.php

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$storageService = new StorageService();

$usage = $storageService->getUsage($companyId);
$limit = $storageService->getLimit($companyId);

Response::success([
    'usage' => $usage,
    'limit_mb' => $limit,
    'usage_mb' => [
        'media' => round($usage['media_bytes'] / 1024 / 1024, 2),
        'templates' => round($usage['templates_bytes'] / 1024 / 1024, 2),
        'renders' => round($usage['renders_bytes'] / 1024 / 1024, 2),
        'total' => round($usage['total_bytes'] / 1024 / 1024, 2)
    ],
    'percent_used' => $limit > 0 ? round(($usage['total_bytes'] / 1024 / 1024 / $limit) * 100, 1) : 0
]);
```

### 6.2 POST /api/storage/recalculate

Depolama kullanımını yeniden hesapla (Admin).

```php
<?php
// api/storage/recalculate.php

$db = Database::getInstance();
$user = Auth::user();

if (!$user || !in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

$companyId = Auth::getActiveCompanyId();
$storageService = new StorageService();

$usage = $storageService->recalculateUsage($companyId);

Response::success($usage, 'Depolama kullanımı yeniden hesaplandı');
```

---

## 7. Migrasyon Stratejisi

### 7.1 Veri Göçü Scripti

```php
<?php
// scripts/migrate_media_structure.php

require_once dirname(__DIR__) . '/config.php';

$db = Database::getInstance();

echo "=== Media Structure Migration ===\n\n";

// 1. Tüm firmaları al
$companies = $db->fetchAll("SELECT id, name FROM companies");
echo "Firma sayısı: " . count($companies) . "\n\n";

foreach ($companies as $company) {
    echo "Firma: {$company['name']} ({$company['id']})\n";

    $basePath = STORAGE_PATH . '/companies/' . $company['id'];
    $mediaPath = $basePath . '/media';

    // 2. Yeni dizin yapısını oluştur
    @mkdir($mediaPath . '/images', 0755, true);
    @mkdir($mediaPath . '/videos', 0755, true);
    @mkdir($basePath . '/templates/renders', 0755, true);
    @mkdir($basePath . '/renders/products', 0755, true);

    // 3. Eski tarih bazlı dizinlerden dosyaları taşı
    $movedFiles = 0;

    if (is_dir($mediaPath)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($mediaPath, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;

            $ext = strtolower(pathinfo($file->getFilename(), PATHINFO_EXTENSION));
            $videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];

            $targetDir = in_array($ext, $videoExts) ? 'videos' : 'images';
            $newPath = $mediaPath . '/' . $targetDir . '/' . $file->getFilename();

            // Dosya zaten hedef dizinde mi?
            if (strpos($file->getPathname(), "/{$targetDir}/") !== false) {
                continue;
            }

            // Aynı isimde dosya varsa benzersiz isim oluştur
            if (file_exists($newPath)) {
                $name = pathinfo($file->getFilename(), PATHINFO_FILENAME);
                $newPath = $mediaPath . '/' . $targetDir . '/' . $name . '_' . uniqid() . '.' . $ext;
            }

            if (rename($file->getPathname(), $newPath)) {
                $movedFiles++;

                // Veritabanındaki file_path'i güncelle
                $oldRelPath = str_replace(STORAGE_PATH . '/', '', $file->getPathname());
                $newRelPath = str_replace(STORAGE_PATH . '/', '', $newPath);

                $db->query(
                    "UPDATE media SET file_path = ? WHERE file_path = ?",
                    [$newRelPath, $oldRelPath]
                );
            }
        }
    }

    echo "  Taşınan dosya: {$movedFiles}\n";

    // 4. Boş tarih dizinlerini temizle
    cleanEmptyDirs($mediaPath);
}

// 5. Legacy /storage/media/ dizininden firma bazlı taşıma
$legacyPath = STORAGE_PATH . '/media';
if (is_dir($legacyPath)) {
    echo "\n=== Legacy Media Migration ===\n";

    // Veritabanındaki kayıtlara göre taşı
    $legacyMedia = $db->fetchAll(
        "SELECT m.*, c.id as company_id FROM media m
         LEFT JOIN companies c ON m.company_id = c.id
         WHERE m.file_path LIKE 'media/%' OR m.file_path LIKE '/media/%'"
    );

    foreach ($legacyMedia as $media) {
        $oldPath = STORAGE_PATH . '/' . ltrim($media['file_path'], '/');
        if (!file_exists($oldPath)) continue;

        $companyId = $media['company_id'];
        if (!$companyId) {
            echo "  UYARI: company_id yok, atlanıyor: {$media['file_path']}\n";
            continue;
        }

        $ext = strtolower(pathinfo($media['file_path'], PATHINFO_EXTENSION));
        $videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
        $targetDir = in_array($ext, $videoExts) ? 'videos' : 'images';

        $newRelPath = "companies/{$companyId}/media/{$targetDir}/" . basename($media['file_path']);
        $newFullPath = STORAGE_PATH . '/' . $newRelPath;

        @mkdir(dirname($newFullPath), 0755, true);

        if (rename($oldPath, $newFullPath)) {
            $db->update('media', ['file_path' => $newRelPath], 'id = ?', [$media['id']]);
            echo "  Taşındı: {$media['file_path']} -> {$newRelPath}\n";
        }
    }
}

echo "\n=== Migration Complete ===\n";

function cleanEmptyDirs($path) {
    if (!is_dir($path)) return;

    $files = array_diff(scandir($path), ['.', '..']);

    foreach ($files as $file) {
        $fullPath = $path . '/' . $file;
        if (is_dir($fullPath)) {
            cleanEmptyDirs($fullPath);
        }
    }

    // Yeniden kontrol et
    $files = array_diff(scandir($path), ['.', '..']);
    if (empty($files) && !in_array(basename($path), ['images', 'videos', 'renders', 'templates', 'media'])) {
        @rmdir($path);
    }
}
```

### 7.2 Göç Planı Adımları

| Adım | İşlem | Risk | Geri Alma |
|------|-------|------|-----------|
| 1 | Veritabanı migration'ları çalıştır | Düşük | Tablolar geri alınabilir |
| 2 | Yeni servisleri deploy et | Düşük | Eski kod çalışır |
| 3 | Yeni dizin yapısını oluştur | Düşük | Dizinler silinebilir |
| 4 | Dosya göçü scriptini çalıştır | ORTA | Backup'tan geri yükle |
| 5 | API'leri güncelle | ORTA | Eski koda dön |
| 6 | Frontend'i güncelle | Düşük | Eski sürüme dön |
| 7 | Legacy path'leri devre dışı bırak | Düşük | Tekrar aç |

---

## 8. Test Planı

### 8.1 Unit Testler

```php
// tests/StorageServiceTest.php
class StorageServiceTest extends TestCase
{
    public function testCheckQuotaAllowed()
    {
        // Kota altında yükleme izni
    }

    public function testCheckQuotaExceeded()
    {
        // Kota aşımında engelleme
    }

    public function testRecalculateUsage()
    {
        // Kullanım hesaplaması doğruluğu
    }
}

// tests/RenderServiceTest.php
class RenderServiceTest extends TestCase
{
    public function testInvalidateProductRenders()
    {
        // Ürün render temizliği
    }

    public function testSaveRender()
    {
        // Render kaydetme
    }

    public function testIsRenderValid()
    {
        // Versiyon kontrolü
    }
}
```

### 8.2 Entegrasyon Testleri

| Test | Senaryo | Beklenen Sonuç |
|------|---------|----------------|
| T1 | Kota altında upload | Başarılı |
| T2 | Kota aşımında upload | 413 hatası + mesaj |
| T3 | Ürün güncelleme | Render'lar silinir |
| T4 | Farklı firma medya erişimi | 403 hatası |
| T5 | Filtre ile listeleme | Doğru sonuçlar |
| T6 | Göç sonrası dosya erişimi | Başarılı |

---

## 9. Uygulama Takvimi

### Faz 1: Altyapı (1-2 gün)
- [ ] Migration dosyaları oluştur
- [ ] StorageService.php yaz
- [ ] RenderService.php yaz
- [ ] Unit testler

### Faz 2: API Güncellemeleri (2-3 gün)
- [ ] upload.php kota kontrolü
- [ ] index.php filtre desteği
- [ ] products/update.php versiyon artırma
- [ ] templates/render.php firma bazlı path
- [ ] Yeni endpoint'ler

### Faz 3: Frontend (1-2 gün)
- [ ] MediaLibrary.js filtreler
- [ ] StorageIndicator.js
- [ ] Kota uyarı modal
- [ ] i18n çevirileri

### Faz 4: Göç (1 gün)
- [ ] Backup al
- [ ] Göç scriptini test ortamında çalıştır
- [ ] Production'da çalıştır
- [ ] Doğrulama

### Faz 5: Legacy Temizlik (1 gün)
- [ ] Legacy path'leri devre dışı bırak
- [ ] serve.php güvenlik güncellemesi
- [ ] Dokümantasyon güncelle

**Toplam Süre: 6-9 iş günü**

---

## 10. Kontrol Listesi

### Uygulama Öncesi
- [ ] Tam veritabanı backup
- [ ] Dosya sistemi backup
- [ ] Test ortamında doğrulama
- [ ] Rollback planı hazır

### Uygulama Sırası
- [ ] Migration'lar başarılı
- [ ] Servisler çalışıyor
- [ ] API'ler doğru çalışıyor
- [ ] Frontend sorunsuz

### Uygulama Sonrası
- [ ] Tüm firmalar dosyalarına erişebiliyor
- [ ] Kota kontrolü çalışıyor
- [ ] Render invalidation çalışıyor
- [ ] Legacy path'ler kapalı
- [ ] Performans normal

---

## Ekler

### A. i18n Çevirileri

```json
// locales/tr/pages/media.json
{
    "filter": {
        "all": "Tümü",
        "images": "Görseller",
        "videos": "Videolar"
    },
    "sort": {
        "newest": "En Yeni",
        "oldest": "En Eski",
        "size": "Boyut",
        "name": "İsim"
    },
    "quota": {
        "title": "Depolama Kotası Aşıldı",
        "hint": "Yer açmak için kullanılmayan dosyaları silebilirsiniz."
    },
    "errors": {
        "quotaExceeded": "Depolama kotası aşıldı. Lütfen yer açın.",
        "uploadFailed": "Yükleme başarısız oldu."
    }
}
```

### B. CSS Stilleri

```css
/* Storage Indicator */
.storage-indicator {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.storage-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
}

.storage-bar {
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
}

.storage-bar-fill {
    height: 100%;
    transition: width 0.3s ease;
}

.storage-bar-fill.primary { background: var(--color-primary); }
.storage-bar-fill.warning { background: var(--color-warning); }
.storage-bar-fill.danger { background: var(--color-danger); }

/* Quota Warning Modal */
.quota-warning {
    text-align: center;
    padding: 1rem;
}

.quota-stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin: 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
}
```

---

**Hazırlayan:** Claude AI
**Tarih:** 2026-01-27
**Durum:** Onay Bekliyor
