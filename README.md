# Omnex Display Hub - Teknik Dokümantasyon

**Versiyon:** 2.1.0 (Phase 2 Complete)
**Son Güncelleme:** 2026-02-14
**Lisans:** Ticari Lisans

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Teknik Altyapı](#teknik-altyapı)
3. [Mimari Yapı](#mimari-yapı)
4. [Multi-Tenant (Çok Kiracılı) Sistem](#multi-tenant-çok-kiracılı-sistem)
5. [Güvenlik](#güvenlik)
6. [Performans Optimizasyonları](#performans-optimizasyonları)
7. [Veritabanı Yapısı](#veritabanı-yapısı)
8. [API Yapısı](#api-yapısı)
9. [Frontend Yapısı](#frontend-yapısı)
10. [Core Bileşenler](#core-bileşenler)
11. [Middleware Sistemi](#middleware-sistemi)
12. [Servisler](#servisler)
13. [Kurulum ve Dağıtım](#kurulum-ve-dağıtım)
14. [Geliştirme Rehberi](#geliştirme-rehberi)

---

## 🎯 Genel Bakış

**Omnex Display Hub**, perakende sektöründe kullanılan elektronik raf etiketleri (ESL) ve dijital tabela (signage) sistemlerini merkezi olarak yönetmek için geliştirilmiş kurumsal bir web platformudur.

### Temel Özellikler

- ✅ **Ürün Yönetimi**: ERP entegrasyonu ile ürün ve fiyat bilgilerini içe aktar (TXT, JSON, CSV, XML)
- ✅ **Şablon Editörü**: Drag & drop etiket tasarım aracı (Fabric.js tabanlı)
- ✅ **Cihaz Yönetimi**: ESL ve TV cihazlarını uzaktan yönet
- ✅ **Digital Signage**: Playlist ve zamanlama yönetimi
- ✅ **Multi-Tenant**: Çoklu firma desteği (Shared Database, Shared Schema)
- ✅ **Çoklu Dil**: Türkçe, İngilizce, Arapça (RTL desteği)
- ✅ **PWA**: Progressive Web App olarak mobil cihazlarda çalışır
- ✅ **Render Sistemi**: Asenkron şablon render kuyruğu
- ✅ **Gateway Entegrasyonu**: Hanshow ESL-Working entegrasyonu
- ✅ **Ödeme Sistemi**: Lisans ve ödeme yönetimi

---

## 🛠 Teknik Altyapı

### Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| **Frontend** | Vanilla JavaScript (ES6+ Modules) | ES2020+ |
| **CSS Framework** | Tailwind CSS (CDN) + Custom CSS | 3.x |
| **Icons** | Tabler Icons | Latest |
| **Backend** | PHP | 8.0+ |
| **Veritabanı** | SQLite 3 | 3.x |
| **Auth** | JWT (JSON Web Token) | HS256 |
| **Password Hashing** | Argon2ID | PHP Native |
| **Server** | Apache (mod_rewrite) | 2.4+ |
| **Gateway** | Java (ESL-Working) | 11+ |

### Sistem Gereksinimleri

**Minimum:**
- PHP 8.0+
- Apache 2.4+ (mod_rewrite aktif)
- SQLite 3 PDO extension
- OpenSSL extension
- JSON extension
- GD/ImageMagick extension (resim işleme)

**Önerilen:**
- PHP 8.1+
- 2GB+ RAM
- 10GB+ disk alanı
- HTTPS desteği (production)

---

## 🏗 Mimari Yapı

### Genel Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   SPA App    │  │  PWA Player  │  │  ESL Device  │   │
│  │  (Hash Router)│  │  (Service   │  │  (Gateway)   │   │
│  │              │  │   Worker)   │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          │ HTTPS/REST API   │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (PHP Backend)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Router     │  │  Middleware   │  │   Services   │   │
│  │  (REST API)  │  │  (Auth, CSRF, │  │  (Render,    │   │
│  │              │  │   Company)    │  │   Import)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Core Data  │  │  Multi-Tenant│  │   Cache &    │   │
│  │  (Products,  │  │  (company_id) │  │   Logs       │   │
│  │   Templates) │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Dizin Yapısı

```
market-etiket-sistemi/
├── api/                          # REST API endpoint'leri (191 dosya)
│   ├── auth/                     # Kimlik doğrulama (8 endpoint)
│   ├── products/                 # Ürün işlemleri (12 endpoint)
│   ├── templates/                # Şablon yönetimi (8 endpoint)
│   ├── devices/                  # Cihaz yönetimi (11 endpoint)
│   ├── media/                    # Medya kütüphanesi (7 endpoint)
│   ├── categories/               # Kategori işlemleri (4 endpoint)
│   ├── playlists/                # Playlist yönetimi (5 endpoint)
│   ├── schedules/                # Zamanlama yönetimi (5 endpoint)
│   ├── users/                    # Kullanıcı yönetimi (7 endpoint)
│   ├── companies/                # Şirket yönetimi (7 endpoint)
│   ├── licenses/                 # Lisans yönetimi (4 endpoint)
│   ├── reports/                  # Raporlar (4 endpoint)
│   ├── notifications/            # Bildirimler (8 endpoint)
│   ├── hanshow/                  # Hanshow ESL entegrasyonu (12 endpoint)
│   ├── esl/                      # ESL cihaz API (10 endpoint)
│   ├── player/                   # PWA Player API (7 endpoint)
│   ├── gateway/                  # Gateway yönetimi (5 endpoint)
│   ├── render-queue/             # Render kuyruğu (11 endpoint)
│   ├── render-cache/             # Render cache (3 endpoint)
│   └── index.php                 # API router (1400+ satır)
│
├── core/                         # PHP core sınıflar
│   ├── Auth.php                  # JWT authentication (364 satır)
│   ├── Database.php              # SQLite PDO wrapper (326 satır)
│   ├── Request.php               # HTTP request handler
│   ├── Response.php              # JSON response helper
│   ├── Router.php                # API routing
│   ├── Validator.php             # Input validation
│   ├── Logger.php                # Logging sistemi
│   ├── Security.php              # Güvenlik işlemleri (365 satır)
│   ├── Cache.php                 # Cache helper (209 satır)
│   └── SecureHandler.php         # Güvenli endpoint wrapper
│
├── middleware/                   # API middleware'leri (10 dosya)
│   ├── AuthMiddleware.php         # JWT doğrulama
│   ├── CompanyMiddleware.php     # Multi-tenant izolasyon
│   ├── AdminMiddleware.php       # Admin yetki kontrolü
│   ├── SuperAdminMiddleware.php  # SuperAdmin kontrolü
│   ├── CsrfMiddleware.php        # CSRF koruması
│   ├── DeviceAuthMiddleware.php  # Cihaz token doğrulama
│   ├── GatewayAuthMiddleware.php # Gateway API key doğrulama
│   ├── LicenseMiddleware.php     # Lisans kontrolü
│   ├── InputSanitizeMiddleware.php # Input temizleme
│   └── ApiGuardMiddleware.php    # API guard
│
├── services/                     # İş mantığı servisleri (18 dosya)
│   ├── RenderService.php         # Şablon render servisi
│   ├── RenderQueueService.php    # Render kuyruğu yönetimi
│   ├── RenderCacheService.php    # Render cache yönetimi
│   ├── TemplateRenderer.php      # Template render motoru
│   ├── ImportService.php          # Veri içe aktarma
│   ├── SmartFieldMapper.php      # Akıllı alan eşleştirme
│   ├── StorageService.php         # Dosya depolama yönetimi
│   ├── NotificationService.php   # Bildirim servisi
│   ├── NotificationTriggers.php # Bildirim tetikleyicileri
│   ├── SettingsResolver.php      # Ayarlar çözümleyici
│   ├── CompanySeeder.php         # Firma seed servisi
│   ├── DemoProductSeeder.php      # Demo ürün seed
│   ├── HalKunyeService.php       # HAL Künye entegrasyonu
│   ├── HalKunyeScraper.php       # HAL Künye scraper
│   ├── HanshowGateway.php         # Hanshow gateway servisi
│   ├── IyzicoGateway.php          # İyzico ödeme gateway
│   ├── PaynetGateway.php          # Paynet ödeme gateway
│   └── PavoDisplayGateway.php     # Pavo Display gateway
│
├── database/
│   ├── migrations/                # SQL migration dosyaları (60 adet)
│   ├── seeders/                   # Varsayılan veri seed'leri (25 dosya)
│   └── omnex.db                   # SQLite veritabanı
│
├── public/                        # Frontend (Web Root)
│   ├── assets/
│   │   ├── css/
│   │   │   └── main.css          # Ana stil dosyası (modüler)
│   │   ├── js/
│   │   │   ├── app.js            # Ana uygulama entry point
│   │   │   ├── core/             # Core modüller
│   │   │   │   ├── Router.js     # Hash-based routing
│   │   │   │   ├── Api.js        # API client
│   │   │   │   ├── Auth.js       # Authentication
│   │   │   │   ├── State.js      # State management
│   │   │   │   ├── i18n.js       # Internationalization
│   │   │   │   ├── ApiCache.js   # API cache manager
│   │   │   │   └── CacheManager.js # Cache yönetimi
│   │   │   ├── components/       # UI bileşenler
│   │   │   │   ├── Toast.js
│   │   │   │   ├── Modal.js
│   │   │   │   ├── DataTable.js
│   │   │   │   └── ...
│   │   │   ├── layouts/          # Layout yönetimi
│   │   │   │   ├── SidebarLayout.js
│   │   │   │   └── TopbarLayout.js
│   │   │   └── pages/            # Sayfa bileşenleri (30+ sayfa)
│   │   │       ├── auth/         # Login, Register, ForgotPassword
│   │   │       ├── products/     # ProductList, ProductForm, ProductDetail
│   │   │       ├── templates/    # TemplateList, TemplateEditor
│   │   │       ├── devices/      # DeviceList, DeviceDetail, DeviceGroups
│   │   │       ├── media/        # MediaLibrary
│   │   │       ├── signage/      # PlaylistList, ScheduleList
│   │   │       ├── reports/      # DashboardAnalytics
│   │   │       ├── settings/    # GeneralSettings, UserSettings
│   │   │       ├── admin/        # UserManagement, CompanyManagement
│   │   │       └── queue/       # QueueDashboard, QueueAnalytics
│   │   └── images/
│   ├── player/                    # PWA Player (ayrı SPA)
│   │   ├── index.html
│   │   ├── sw.js                  # Service Worker
│   │   └── assets/
│   ├── index.html                 # SPA giriş noktası
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service Worker
│
├── locales/                       # Çeviri dosyaları (8 dil)
│   ├── tr/                        # Türkçe (14 dosya)
│   ├── en/                        # İngilizce (13 dosya)
│   ├── ar/                        # Arapça (RTL)
│   ├── az/                        # Azerbaycan Türkçesi
│   ├── de/                        # Almanca
│   ├── fr/                        # Fransızca
│   ├── nl/                        # Flemenkçe
│   └── ru/                        # Rusça
│
├── storage/                       # Yüklenen dosyalar
│   ├── uploads/                   # Kullanıcı yüklemeleri
│   ├── cache/                     # Cache dosyaları
│   ├── logs/                      # Log dosyaları
│   └── renders/                  # Render edilmiş görseller
│
├── gateway/                       # Gateway yapılandırması
│   ├── gateway.config.json        # Gateway config
│   └── ...
│
├── local-gateway-manager/         # Gateway manager (Electron)
│   └── ...
│
├── config.php                     # Uygulama ayarları (194 satır)
├── index.php                      # Ana entry point (202 satır)
├── install.php                    # Kurulum scripti
└── version.txt                    # Versiyon bilgisi
```

---

## 🏢 Multi-Tenant (Çok Kiracılı) Sistem

### Mimari Model

Sistem **Shared Database, Shared Schema** modelini kullanır:

- ✅ **Tek veritabanı** (`omnex.db`) tüm firmaları destekler
- ✅ **Tek şema** içinde `company_id` kolonu ile izolasyon sağlanır
- ✅ Her tablo `company_id` kolonu ile firma bazlı veri saklar

### İzolasyon Mekanizması

#### 1. Veritabanı Seviyesi

**Tam İzolasyon (company_id = UUID):**
- `users` (SuperAdmin hariç)
- `products`
- `devices` / `device_groups`
- `playlists` / `schedules`
- `render_queue` / `render_cache`
- `notifications`
- `audit_logs`
- `settings` (firma + kullanıcı ayarları)

**Kısmi İzolasyon (company_id = NULL veya UUID):**
- `templates` (is_public=1 veya company_id)
- `media` (company_id=NULL: ortak kütüphane)
- `label_sizes` (varsayılan + firma özel)
- `import_mappings` (varsayılan + firma özel)
- `categories` (varsayılan + firma özel)
- `production_types` (varsayılan + firma özel)

**Global Veriler (company_id = NULL):**
- `companies`
- `licenses`
- `gateways`
- `hanshow_aps` / `hanshow_firmwares`

#### 2. API Seviyesi

**CompanyMiddleware** ile otomatik izolasyon:

```php
// SuperAdmin: Tüm firmalara erişim (X-Active-Company header ile)
if ($user['role'] === 'superadmin') {
    $companyId = $request->header('X-Active-Company');
    // Firma değiştirme desteği
}

// Normal kullanıcılar: Sadece kendi firmalarına erişim
$request->setAttribute('company_id', $user['company_id']);
```

**Tüm API sorguları otomatik olarak company_id filtresi ile çalışır:**

```php
// Örnek: Ürün sorgusu
SELECT * FROM products 
WHERE company_id = ? 
AND status != 'deleted';
```

#### 3. Dosya Sistemi Seviyesi

**Multi-tenant storage yapısı:**

```
storage/
├── uploads/
│   ├── {company_id}/
│   │   ├── media/          # Firma medya dosyaları
│   │   ├── templates/      # Firma şablonları
│   │   └── renders/       # Render edilmiş görseller
│   └── shared/            # Ortak medya kütüphanesi
```

#### 4. Storage Kullanım Takibi

**company_storage_usage** tablosu ile firma bazlı depolama takibi:

```sql
CREATE TABLE company_storage_usage (
    company_id TEXT NOT NULL,
    total_bytes INTEGER DEFAULT 0,
    media_bytes INTEGER DEFAULT 0,
    render_bytes INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (company_id)
);
```

### Firma Değiştirme (SuperAdmin)

SuperAdmin kullanıcıları `X-Active-Company` header'ı ile aktif firmayı değiştirebilir:

```javascript
// Frontend'de firma değiştirme
api.setHeader('X-Active-Company', companyId);
```

---

## 🔒 Güvenlik

### Kimlik Doğrulama ve Yetkilendirme

#### 1. JWT Token Sistemi

**Token Yapısı:**
- **Access Token**: 1 saat geçerlilik (JWT_EXPIRY)
- **Refresh Token**: 30 gün geçerlilik (REFRESH_TOKEN_EXPIRY)
- **Algoritma**: HS256 (HMAC SHA-256)
- **Secret**: Environment variable veya `.jwt_secret` dosyası

**Token İçeriği:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "Admin",
  "company_id": "uuid",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Güvenlik Özellikleri:**
- ✅ Algorithm confusion attack koruması (sadece HS256 kabul edilir)
- ✅ Token signature doğrulama (hash_equals ile timing-safe)
- ✅ Token expiry kontrolü
- ✅ Refresh token ayrımı (access token olarak kullanılamaz)
- ✅ Session tablosunda token hash saklama

#### 2. Şifre Güvenliği

**Argon2ID Hashing:**
```php
password_hash($password, PASSWORD_ARGON2ID, [
    'memory_cost' => 65536,  // 64 MB
    'time_cost' => 4,         // 4 iterasyon
    'threads' => 3            // 3 thread
]);
```

**Şifre Gereksinimleri:**
- Minimum 8 karakter
- En az 1 büyük harf
- En az 1 küçük harf
- En az 1 rakam
- En az 1 özel karakter

#### 3. CSRF Koruması

**CSRF Token Sistemi:**
- Session tabanlı CSRF token üretimi
- Her form gönderiminde token kontrolü
- Token yenileme mekanizması
- `CsrfMiddleware` ile otomatik kontrol

#### 4. XSS Koruması

**Output Escaping:**
```php
Security::escape($input);  // HTML özel karakterleri escape eder
Security::escapeArray($data);  // Dizi içindeki tüm stringleri escape eder
```

**Input Sanitization:**
```php
Security::sanitize($input);  // Null byte, control karakterleri temizler
Security::sanitizeFilename($filename);  // Dosya adı güvenliği
```

#### 5. SQL Injection Koruması

**PDO Prepared Statements:**
- Tüm sorgular prepared statement kullanır
- Parametre binding ile güvenli sorgu
- Table/column name whitelist kontrolü

**Database.php Güvenlik:**
```php
// Table name whitelist kontrolü
private function validateTable(string $table): string {
    $allowedTables = ['products', 'users', ...];
    if (!in_array($table, $allowedTables)) {
        throw new Exception("Invalid table name");
    }
    return $this->escapeIdentifier($table);
}
```

#### 6. Rate Limiting

**Genel Rate Limit:**
- 100 istek / 60 saniye (RATE_LIMIT_REQUESTS)

**Login Rate Limit:**
- 5 deneme / 5 dakika (LOGIN_RATE_LIMIT)

**Atomic Rate Limiting:**
```php
Security::checkRateLimitAtomic($key, $limit, $windowSeconds);
// SQLite tabanlı atomic counter
```

#### 7. Dosya Yükleme Güvenliği

**Dosya Tipi Kontrolü:**
- MIME type kontrolü (magic bytes ile)
- Dosya uzantısı kontrolü
- Dosya boyutu limiti (50MB)

**İzin Verilen Tipler:**
- **Resimler**: JPEG, PNG, GIF, WebP, SVG
- **Videolar**: MP4, WebM, OGG
- **Dökümanlar**: PDF, JSON, TXT, CSV

**Dosya Adı Güvenliği:**
- Path traversal koruması
- Özel karakter temizleme
- Uzunluk limiti (200 karakter)

#### 8. Path Traversal Koruması

**Dosya Erişim Kontrolü:**
```php
// Storage path kontrolü
$realPath = realpath($storagePath . $userPath);
$basePath = realpath($storagePath);
if (strpos($realPath, $basePath) !== 0) {
    throw new Exception("Path traversal detected");
}
```

#### 9. CORS Ayarları

**CORS Konfigürasyonu:**
```php
define('CORS_ALLOWED_ORIGINS', [
    'http://localhost',
    'http://127.0.0.1',
    'http://192.168.1.*'  // Local network
]);
define('CORS_ALLOW_LOCAL_NETWORK', true);
```

#### 10. HTTPS Zorlama

**Production Modunda:**
```php
define('FORCE_HTTPS', PRODUCTION_MODE);
// Otomatik HTTPS yönlendirmesi
```

#### 11. Session Güvenliği

**Session Cookie Ayarları:**
```php
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => PRODUCTION_MODE,      // HTTPS only in production
    'httponly' => true,               // JavaScript erişimi yok
    'samesite' => 'Strict'            // CSRF koruması
]);
```

#### 12. Audit Logging

**Tüm kritik işlemler loglanır:**
- Kullanıcı giriş/çıkış
- Veri değişiklikleri (CRUD)
- Yetki değişiklikleri
- Sistem ayarları değişiklikleri

**audit_logs Tablosu:**
```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_id TEXT,
    action TEXT,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## ⚡ Performans Optimizasyonları

### 🎬 Android Player - Hybrid ExoPlayer (Phase 2 - Yeni!)

**v2.1.0 (2026-02-14) ile eklendi:**

#### Native Video Decode
- **ExoPlayer 2.19.1** entegrasyonu
- Hardware-accelerated video playback
- Hybrid mimari: WebView (UI) + ExoPlayer (video)
- HLS adaptive streaming desteği
- Otomatik codec detection ve fallback

**Performans İyileştirmeleri:**

| Metrik | Öncesi (v2.0.x) | Sonrası (v2.1.0) | İyileşme |
|--------|-----------------|------------------|----------|
| CPU Kullanımı | %45-60 | %15-25 | **%60-72 ↓** |
| Bellek | 180-220 MB | 120-160 MB | **%33 ↓** |
| Frame Drop | Sık | Hiç | **%100 ↓** |
| Video Yükleme | 2-3s | <1s | **%66 ↓** |
| Loop Akıcılığı | Takıltılı | Kesintisiz | ✅ |

**Yeni Özellikler:**
- ✅ Öğe-bazlı ses kontrolü (muted/unmuted per item)
- ✅ Hardware codec detection (H.264, H.265, VP8, VP9)
- ✅ Automatic WebView fallback on errors
- ✅ Seamless loop playback

**Teknik Detaylar:**
```kotlin
// ExoPlayerManager - Native video decode
class ExoPlayerManager {
    fun playVideo(url: String, muted: Boolean = true): Boolean {
        player.volume = if (muted) 0f else 1f
        player.setMediaSource(mediaSource)
        player.prepare()
        player.play()
    }
}
```

**Daha fazla bilgi:** [Android Player Implementation Roadmap](android-player/IMPLEMENTATION_ROADMAP.md)

---

### 1. Veritabanı Optimizasyonları

**SQLite WAL Mode:**
```php
PRAGMA journal_mode = WAL;        // Write-Ahead Logging
PRAGMA synchronous = NORMAL;       // Güvenlik/performans dengesi
PRAGMA foreign_keys = ON;          // Veri bütünlüğü
```

**WAL Mode Avantajları:**
- ✅ Okuma işlemleri yazma işlemlerini engellemez
- ✅ Daha iyi eşzamanlılık
- ✅ Daha hızlı yazma performansı

**İndeksler:**
- `company_id` kolonlarında indeksler
- `status` kolonlarında indeksler
- Foreign key indeksleri
- Composite indeksler (company_id + status)

### 2. Cache Sistemi

#### Backend Cache (PHP)

**Cache.php Özellikleri:**
- Dosya modification time bazlı versioning
- Development modunda timestamp (no-cache)
- Production modunda hash (cache-friendly)
- Build hash bazlı cache invalidation

```php
Cache::url('assets/js/app.js');
// Sonuç: assets/js/app.js?v=1.0.27.abc12345
```

#### Frontend Cache (JavaScript)

**ApiCache.js Özellikleri:**
- TTL-based expiration (varsayılan 5 dakika)
- Memory cache (Map)
- Optional localStorage persistence
- Request deduplication
- Cache invalidation patterns

```javascript
const cache = new ApiCache({
    defaultTTL: 5 * 60 * 1000,  // 5 dakika
    maxEntries: 100,
    useLocalStorage: false
});

// Cache ile fetch
const data = await cache.fetch('/api/products');
```

**Cache İstatistikleri:**
- Cache hits/misses takibi
- Cache size limiti
- Otomatik temizleme (LRU)

#### Service Worker Cache

**sw.js Stratejileri:**
- **Network First**: API istekleri için
- **Cache First**: Statik assets için
- **Stale While Revalidate**: Locale dosyaları için
- Development modunda cache devre dışı

### 3. Render Optimizasyonu

**Render Queue Sistemi:**
- Asenkron şablon render
- Öncelik bazlı kuyruk
- Batch processing
- Retry mekanizması
- Cache ile tekrar render önleme

**Render Cache:**
```sql
CREATE TABLE render_cache (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    product_id TEXT,
    cache_key TEXT UNIQUE,
    image_path TEXT,
    created_at TEXT,
    expires_at TEXT
);
```

**Cache Key Oluşturma:**
```php
$cacheKey = md5($templateId . $productId . $templateVersion);
// Template veya product değişirse cache invalid olur
```

### 4. API Optimizasyonları

**Pagination:**
- Tüm listeleme endpoint'leri pagination destekler
- Varsayılan: 20 kayıt/sayfa
- Maksimum: 100 kayıt/sayfa

**Lazy Loading:**
- İlişkili veriler lazy load edilir
- `?include=relations` parametresi ile eager loading

**Response Compression:**
- Gzip compression (Apache mod_deflate)
- JSON response minification

### 5. Frontend Optimizasyonları

**Code Splitting:**
- Sayfa bazlı lazy loading
- Component bazlı code splitting
- Dynamic imports

**Asset Optimization:**
- CSS minification
- JavaScript minification (production)
- Image optimization
- Font subsetting

**Bundle Size:**
- Vanilla JS (framework yok)
- Modüler yapı
- Tree shaking uyumlu

---

## 🗄️ Veritabanı Yapısı

### SQLite Kapasite Analizi

**Teknik Limitler:**
- **Maksimum Veritabanı Boyutu**: 281 TB (teorik)
- **Pratik Limit**: 100-200 GB
- **Maksimum Satır Boyutu**: 1 GB
- **Maksimum Kolon Sayısı**: 2000

**Mevcut Optimizasyonlar:**
- WAL mode aktif
- Foreign keys aktif
- İndeksler optimize edilmiş

### Ana Tablolar

#### 1. Kullanıcı ve Yetkilendirme

**companies:**
```sql
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    storage_limit_bytes INTEGER DEFAULT 1073741824,  -- 1GB
    created_at TEXT DEFAULT (datetime('now'))
);
```

**users:**
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'Viewer',
    status TEXT DEFAULT 'active',
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**sessions:**
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**permissions:**
```sql
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    actions TEXT NOT NULL  -- JSON array
);
```

#### 2. Ürün ve İçerik

**products:**
```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    price REAL,
    category_id TEXT,
    template_id TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**templates:**
```sql
CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    company_id TEXT,  -- NULL = public template
    name TEXT NOT NULL,
    content TEXT NOT NULL,  -- Fabric.js JSON
    is_public INTEGER DEFAULT 0,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**categories:**
```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    company_id TEXT,  -- NULL = default category
    name TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

#### 3. Cihaz ve Yönetim

**devices:**
```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    device_type TEXT,  -- 'esl', 'signage', 'player'
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**device_groups:**
```sql
CREATE TABLE device_groups (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

#### 4. Render Sistemi

**render_queue:**
```sql
CREATE TABLE render_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    product_id TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    batch_id TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**render_cache:**
```sql
CREATE TABLE render_cache (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    product_id TEXT,
    cache_key TEXT UNIQUE,
    image_path TEXT,
    created_at TEXT,
    expires_at TEXT
);
```

#### 5. Storage Takibi

**company_storage_usage:**
```sql
CREATE TABLE company_storage_usage (
    company_id TEXT PRIMARY KEY,
    total_bytes INTEGER DEFAULT 0,
    media_bytes INTEGER DEFAULT 0,
    render_bytes INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### Migration Sistemi

**60 Migration Dosyası:**
- Sıralı migration (001_*.sql, 002_*.sql, ...)
- Otomatik migration çalıştırma
- Migration geçmişi (`migrations` tablosu)
- Hata toleransı (duplicate column/table)

**Migration Çalıştırma:**
```php
$db = Database::getInstance();
$db->migrate();  // Otomatik migration
```

---

## 🔌 API Yapısı

### API Endpoint Kategorileri

#### 1. Authentication (8 endpoint)

```
POST   /api/auth/login           # Giriş
POST   /api/auth/logout          # Çıkış
POST   /api/auth/register        # Kayıt
POST   /api/auth/refresh-token   # Token yenile
GET    /api/auth/session         # Oturum kontrol
POST   /api/auth/forgot-password # Şifremi unuttum
POST   /api/auth/reset-password  # Şifre sıfırla
POST   /api/auth/change-password # Şifre değiştir
```

#### 2. Products (12 endpoint)

```
GET    /api/products              # Liste
POST   /api/products              # Oluştur
GET    /api/products/:id          # Detay
PUT    /api/products/:id          # Güncelle
DELETE /api/products/:id          # Sil
POST   /api/products/import        # Toplu içe aktar
GET    /api/products/import-preview # İçe aktarma önizleme
POST   /api/products/export       # Dışa aktar
POST   /api/products/bulk-delete  # Toplu sil
POST   /api/products/:id/assign-label  # Etiket ata
POST   /api/products/:id/remove-label  # Etiket kaldır
GET    /api/products/:id/price-history # Fiyat geçmişi
```

#### 3. Templates (8 endpoint)

```
GET    /api/templates             # Liste
POST   /api/templates             # Oluştur
GET    /api/templates/:id         # Detay
PUT    /api/templates/:id         # Güncelle
DELETE /api/templates/:id         # Sil
POST   /api/templates/export      # Dışa aktar
POST   /api/templates/import      # İçe aktar
POST   /api/templates/:id/render  # Render et
```

#### 4. Devices (11 endpoint)

```
GET    /api/devices               # Liste
POST   /api/devices               # Oluştur
GET    /api/devices/:id           # Detay
PUT    /api/devices/:id           # Güncelle
DELETE /api/devices/:id           # Sil
POST   /api/devices/scan          # Tarama
POST   /api/devices/:id/assign-playlist  # Playlist ata
POST   /api/devices/:id/send-command     # Komut gönder
POST   /api/devices/:id/control          # Kontrol
GET    /api/devices/pending       # Bekleyen cihazlar
POST   /api/devices/:id/approve  # Onayla
POST   /api/devices/:id/reject   # Reddet
```

#### 5. Media (7 endpoint)

```
GET    /api/media                 # Liste
POST   /api/media/upload          # Yükle
GET    /api/media/browse          # Klasör tarama
GET    /api/media/folders         # Klasör listesi
POST   /api/media/scan            # Otomatik tarama
DELETE /api/media/:id             # Sil
GET    /api/media/:id/serve       # Dosya servis et
```

#### 6. Render Queue (11 endpoint)

```
GET    /api/render-queue          # Kuyruk listesi
POST   /api/render-queue          # İş ekle
GET    /api/render-queue/:id     # İş detayı
PUT    /api/render-queue/:id     # İş güncelle
DELETE /api/render-queue/:id     # İş sil
POST   /api/render-queue/batch   # Toplu iş ekle
GET    /api/render-queue/stats   # İstatistikler
POST   /api/render-queue/:id/retry  # Yeniden dene
POST   /api/render-queue/:id/cancel # İptal et
GET    /api/render-queue/pending    # Bekleyen işler
GET    /api/render-queue/completed  # Tamamlanan işler
```

#### 7. Hanshow ESL (12 endpoint)

```
GET    /api/hanshow/ping          # ESL-Working bağlantı testi
GET    /api/hanshow/aps           # AP (Gateway) listesi
GET    /api/hanshow/scan          # ESL tarama
GET    /api/hanshow/lookup        # ESL arama
POST   /api/hanshow/register      # ESL kayıt
GET    /api/hanshow/esls          # ESL listesi
GET    /api/hanshow/esls/:id      # ESL detayı
POST   /api/hanshow/esls          # ESL ekle
PUT    /api/hanshow/esls/:id      # ESL güncelle
DELETE /api/hanshow/esls/:id     # ESL sil
POST   /api/hanshow/send          # ESL'e tasarım gönder
GET    /api/hanshow/firmwares     # Firmware listesi
POST   /api/hanshow/control/led   # LED kontrol
POST   /api/hanshow/control/page  # Sayfa değiştirme
```

### API Response Formatı

**Başarılı Response:**
```json
{
  "success": true,
  "message": "İşlem başarılı",
  "data": { ... }
}
```

**Hata Response:**
```json
{
  "success": false,
  "message": "Hata mesajı",
  "errors": { ... }  // Validation errors
}
```

**HTTP Status Kodları:**
- `200` - Başarılı
- `201` - Oluşturuldu
- `400` - Geçersiz istek
- `401` - Yetkisiz erişim
- `403` - Yasak
- `404` - Bulunamadı
- `422` - Validation hatası
- `429` - Rate limit aşıldı
- `500` - Sunucu hatası

### API Middleware Zinciri

```
Request
  ↓
CorsMiddleware (CORS headers)
  ↓
ErrorHandlerMiddleware (Hata yakalama)
  ↓
AuthMiddleware (JWT doğrulama)
  ↓
CompanyMiddleware (Multi-tenant izolasyon)
  ↓
CsrfMiddleware (CSRF koruması - POST/PUT/DELETE)
  ↓
InputSanitizeMiddleware (Input temizleme)
  ↓
RateLimitMiddleware (Rate limiting)
  ↓
Handler (Endpoint logic)
```

---

## 🎨 Frontend Yapısı

### Sayfa Yapısı

#### 1. Authentication Sayfaları

- **Login.js** - Giriş sayfası
- **Register.js** - Kayıt sayfası
- **ForgotPassword.js** - Şifremi unuttum
- **ResetPassword.js** - Şifre sıfırlama

#### 2. Ana Sayfalar

- **Dashboard.js** - Ana panel
- **About.js** - Hakkında sayfası

#### 3. Ürün Yönetimi

- **ProductList.js** - Ürün listesi (DataTable)
- **ProductForm.js** - Ürün formu (create/edit)
- **ProductDetail.js** - Ürün detay sayfası
- **ProductImport.js** - Toplu içe aktarma

**Alt Bileşenler:**
- `form/BarcodeSection.js` - Barkod bölümü
- `form/HalKunyeSection.js` - HAL Künye entegrasyonu
- `form/MediaPicker.js` - Medya seçici
- `form/PriceHistorySection.js` - Fiyat geçmişi
- `form/ProductValidator.js` - Form validasyonu

#### 4. Şablon Yönetimi

- **TemplateList.js** - Şablon listesi
- **TemplateEditor.js** - Şablon editörü (Fabric.js)

**Editor Alt Bileşenler:**
- `editor/CanvasManager.js` - Canvas yönetimi
- `editor/PropertyPanel.js` - Özellik paneli
- `editor/DynamicFieldsPanel.js` - Dinamik alanlar
- `editor/BackgroundManager.js` - Arka plan yönetimi
- `editor/GridManager.js` - Grid yönetimi
- `editor/EditorHistory.js` - Undo/Redo
- `editor/TemplateIO.js` - Import/Export

#### 5. Cihaz Yönetimi

- **DeviceList.js** - Cihaz listesi
- **DeviceDetail.js** - Cihaz detayı
- **DeviceGroups.js** - Cihaz grupları

**Alt Bileşenler:**
- `list/NetworkScanner.js` - Ağ tarayıcı
- `list/BluetoothWizard.js` - Bluetooth sihirbazı
- `list/ApprovalFlow.js` - Onay akışı
- `list/BulkActions.js` - Toplu işlemler
- `list/DeviceControl.js` - Cihaz kontrolü
- `list/FirmwareUpdate.js` - Firmware güncelleme

#### 6. Medya Kütüphanesi

- **MediaLibrary.js** - Medya kütüphanesi (WordPress benzeri)

#### 7. Digital Signage

- **PlaylistList.js** - Playlist listesi
- **PlaylistDetail.js** - Playlist detayı
- **ScheduleList.js** - Zamanlama listesi
- **ScheduleForm.js** - Zamanlama formu

#### 8. Render Kuyruğu

- **QueueDashboard.js** - Kuyruk dashboard'u

**Alt Bileşenler:**
- `dashboard/QueueMetrics.js` - Metrikler
- `dashboard/QueueAnalytics.js` - Analitik
- `dashboard/JobStatusTable.js` - İş durumu tablosu
- `dashboard/AutoSendWizard.js` - Otomatik gönderim sihirbazı

#### 9. Raporlar

- **DashboardAnalytics.js** - Dashboard analitikleri

#### 10. Ayarlar

- **GeneralSettings.js** - Genel ayarlar
- **UserSettings.js** - Kullanıcı ayarları
- **IntegrationSettings.js** - Entegrasyon ayarları
- **GatewaySettings.js** - Gateway ayarları
- **LabelSettings.js** - Etiket ayarları
- **Profile.js** - Profil sayfası

#### 11. Bildirimler

- **NotificationList.js** - Bildirim listesi
- **NotificationSettings.js** - Bildirim ayarları

#### 12. Admin Paneli

- **UserManagement.js** - Kullanıcı yönetimi
- **CompanyManagement.js** - Firma yönetimi
- **LicenseManagement.js** - Lisans yönetimi
- **AuditLog.js** - Denetim kayıtları
- **SystemStatus.js** - Sistem durumu
- **SetupWizard.js** - Kurulum sihirbazı

#### 13. Hata Sayfaları

- **NotFound.js** - 404 sayfası

### Routing Sistemi

**Hash-based SPA Routing:**

```javascript
// Router.js
const routes = {
    '/login': Login,
    '/dashboard': Dashboard,
    '/products': ProductList,
    '/products/new': ProductForm,
    '/products/:id': ProductDetail,
    '/templates': TemplateList,
    '/templates/editor': TemplateEditor,
    // ...
};
```

**Route Parametreleri:**
- `:id` - Dinamik ID parametresi
- Query string desteği (`?page=1&limit=20`)

### State Management

**State.js - Merkezi State Yönetimi:**

```javascript
// State yönetimi
State.set('user', userData);
State.get('user');
State.subscribe('user', callback);
```

**State Yapısı:**
- `user` - Kullanıcı bilgileri
- `company` - Aktif firma
- `theme` - Tema ayarları
- `language` - Dil ayarları
- `layout` - Layout ayarları

### Internationalization (i18n)

**Sayfa Bazlı Çeviri Sistemi:**

```javascript
// i18n.js
i18n.t('products.title');  // "Ürünler"
i18n.setLanguage('en');     // Dil değiştir
```

**Çeviri Dosya Yapısı:**
```
locales/
├── tr/
│   ├── common.json
│   ├── products.json
│   ├── templates.json
│   └── ...
├── en/
└── ar/  (RTL desteği)
```

**RTL Desteği:**
- Arapça için otomatik RTL layout
- CSS `direction: rtl` otomatik uygulanır

---

## 🔧 Core Bileşenler

### 1. Database.php

**SQLite PDO Wrapper:**

**Özellikler:**
- Singleton pattern
- Prepared statements
- Transaction desteği
- Migration sistemi
- Seed sistemi
- UUID generation
- Table/column whitelist

**Kullanım:**
```php
$db = Database::getInstance();

// Query
$products = $db->fetchAll("SELECT * FROM products WHERE company_id = ?", [$companyId]);

// Insert
$id = $db->insert('products', [
    'company_id' => $companyId,
    'name' => 'Ürün Adı',
    'price' => 100.00
]);

// Update
$db->update('products', ['price' => 150.00], 'id = ?', [$id]);

// Transaction
$db->beginTransaction();
try {
    // İşlemler
    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
}
```

### 2. Auth.php

**JWT Authentication:**

**Özellikler:**
- Token generation (access + refresh)
- Token validation
- Token refresh
- Token revocation
- User context management
- Multi-tenant company context

**Kullanım:**
```php
// Token oluştur
$tokens = Auth::generateTokens($user);

// Token doğrula
$payload = Auth::validateToken($token);

// Kullanıcı bilgisi
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
```

### 3. Security.php

**Güvenlik Yardımcıları:**

**Özellikler:**
- CSRF token yönetimi
- XSS koruması (escape)
- Input sanitization
- Rate limiting
- Password validation
- File upload validation
- Encryption/Decryption (AES-256-CBC)

**Kullanım:**
```php
// CSRF token
$token = Security::generateCsrfToken();
Security::validateCsrfToken($token);

// XSS koruması
echo Security::escape($userInput);

// Rate limiting
if (!Security::checkRateLimit($key, 100, 60)) {
    Response::rateLimitExceeded();
}
```

### 4. Router.php

**API Routing:**

**Özellikler:**
- RESTful routing
- Middleware desteği
- Route groups
- Parameter extraction
- Request/Response handling

**Kullanım:**
```php
$router = new Router();

// GET route
$router->get('/api/products', function($request) {
    require API_PATH . '/products/index.php';
});

// POST route
$router->post('/api/products', function($request) {
    require API_PATH . '/products/create.php';
});

// Route group with middleware
$router->group(['prefix' => '/api/products', 'middleware' => ['auth', 'company']], function($router) {
    $router->get('/', function($request) {
        require API_PATH . '/products/index.php';
    });
});
```

### 5. Request.php

**HTTP Request Handler:**

**Özellikler:**
- Request body parsing (JSON)
- Query parameter extraction
- Header access
- File upload handling
- Attribute storage (middleware için)

**Kullanım:**
```php
$request = Request::getInstance();

// Body
$data = $request->getBody();
$input = $request->input('field');

// Query
$page = $request->query('page', 1);

// Header
$token = $request->bearerToken();
$header = $request->header('X-Custom-Header');

// Attribute (middleware'den)
$user = $request->getAttribute('user');
$companyId = $request->getAttribute('company_id');
```

### 6. Response.php

**JSON Response Helper:**

**Özellikler:**
- Standart response formatı
- HTTP status kodları
- Error handling
- Validation error formatı

**Kullanım:**
```php
// Başarılı response
Response::success($data, 'İşlem başarılı');

// Hata response
Response::error('Hata mesajı', 400);

// Validation error
Response::validationError($errors);

// Unauthorized
Response::unauthorized('Yetkisiz erişim');

// Not found
Response::notFound('Kayıt bulunamadı');
```

### 7. Logger.php

**Logging Sistemi:**

**Özellikler:**
- Log seviyeleri (debug, info, warning, error)
- Dosya bazlı logging
- Audit logging
- Error logging

**Kullanım:**
```php
Logger::debug('Debug mesajı', $context);
Logger::info('Bilgi mesajı', $context);
Logger::warning('Uyarı mesajı', $context);
Logger::error('Hata mesajı', $context);
```

### 8. Validator.php

**Input Validation:**

**Özellikler:**
- Rule-based validation
- Custom validators
- Error message formatting

**Kullanım:**
```php
$rules = [
    'email' => ['required', 'email'],
    'password' => ['required', 'min:8', 'regex:/[A-Z]/']
];

$errors = Validator::validate($data, $rules);
if (!empty($errors)) {
    Response::validationError($errors);
}
```

### 9. Cache.php

**Cache Helper:**

**Özellikler:**
- File versioning
- Build hash generation
- Cache busting
- Development/Production modları

**Kullanım:**
```php
// Versioned URL
$url = Cache::url('assets/js/app.js');
// Sonuç: assets/js/app.js?v=1.0.27.abc12345

// Build hash
$hash = Cache::getBuildHash();
```

---

## 🛡️ Middleware Sistemi

### Middleware Listesi

#### 1. AuthMiddleware

**JWT Authentication:**
- Token doğrulama
- User loading
- Permission loading
- Session validation

#### 2. CompanyMiddleware

**Multi-Tenant İzolasyon:**
- Company context ayarlama
- SuperAdmin firma değiştirme
- Company aktiflik kontrolü

#### 3. AdminMiddleware

**Admin Yetki Kontrolü:**
- Admin/SuperAdmin kontrolü
- Yetkisiz erişim engelleme

#### 4. SuperAdminMiddleware

**SuperAdmin Kontrolü:**
- Sadece SuperAdmin erişimi
- Diğer roller için 403

#### 5. CsrfMiddleware

**CSRF Koruması:**
- POST/PUT/DELETE için CSRF kontrolü
- Token doğrulama

#### 6. DeviceAuthMiddleware

**Cihaz Token Doğrulama:**
- Device token authentication
- ESL/Player cihazları için

#### 7. GatewayAuthMiddleware

**Gateway API Key Doğrulama:**
- API key authentication
- Gateway istekleri için

#### 8. LicenseMiddleware

**Lisans Kontrolü:**
- Firma lisans kontrolü
- Lisans süresi kontrolü
- Özellik erişim kontrolü

#### 9. InputSanitizeMiddleware

**Input Temizleme:**
- XSS koruması
- SQL injection koruması
- Path traversal koruması

#### 10. ApiGuardMiddleware

**API Guard:**
- Genel API koruması
- Rate limiting
- IP whitelist

---

## 🔌 Servisler

### 1. RenderService

**Şablon Render Servisi:**
- Template rendering
- Product data binding
- Image generation
- Cache management

### 2. RenderQueueService

**Render Kuyruğu Yönetimi:**
- Queue management
- Priority handling
- Batch processing
- Retry mechanism

### 3. RenderCacheService

**Render Cache Yönetimi:**
- Cache lookup
- Cache storage
- Cache invalidation
- Cache cleanup

### 4. ImportService

**Veri İçe Aktarma:**
- CSV/JSON/XML parsing
- Field mapping
- Data validation
- Bulk import

### 5. SmartFieldMapper

**Akıllı Alan Eşleştirme:**
- Auto field detection
- Field mapping
- Data transformation

### 6. StorageService

**Dosya Depolama:**
- File upload
- Storage quota management
- File organization
- Multi-tenant storage

### 7. NotificationService

**Bildirim Servisi:**
- Notification creation
- Notification delivery
- Notification preferences
- Notification triggers

### 8. SettingsResolver

**Ayarlar Çözümleyici:**
- Settings hierarchy (user > company > default)
- Settings caching
- Settings validation

### 9. HanshowGateway

**Hanshow ESL Entegrasyonu:**
- ESL-Working API client
- ESL management
- Design sending
- Device control

### 10. Payment Gateways

**Ödeme Gateway'leri:**
- IyzicoGateway
- PaynetGateway
- License management
- Transaction handling

---

## 🚀 Kurulum ve Dağıtım

### Gereksinimler

**Sunucu:**
- PHP 8.0+
- Apache 2.4+ (mod_rewrite)
- SQLite 3 PDO extension
- OpenSSL extension
- JSON extension
- GD/ImageMagick extension

**İstemci:**
- Modern tarayıcı (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- LocalStorage support (PWA için)

### Kurulum Adımları

#### 1. Dosyaları Kopyalama

```bash
# XAMPP için
cp -r market-etiket-sistemi /xampp/htdocs/
```

#### 2. Kurulum Scripti

Tarayıcıda açın:
```
http://localhost/market-etiket-sistemi/install.php
```

"Kurulumu Başlat" butonuna tıklayın.

#### 3. Varsayılan Giriş Bilgileri

Kurulum sonrası:
- **E-posta**: admin@omnexcore.com
- **Şifre**: OmnexAdmin2024!

**ÖNEMLİ:** Production'da ilk girişten sonra şifreyi değiştirin!

### Production Kurulumu

#### 1. Environment Variables

```bash
export OMNEX_PRODUCTION=true
export OMNEX_JWT_SECRET="your-secret-key-here"
export OMNEX_ADMIN_EMAIL="admin@yourdomain.com"
export OMNEX_ADMIN_PASSWORD="secure-password"
export OMNEX_FORCE_HTTPS=true
```

#### 2. Production Mode Aktifleştirme

```bash
touch .production
```

Veya environment variable:
```bash
export OMNEX_PRODUCTION=true
```

#### 3. Güvenlik Dosyaları

Production modunda otomatik oluşturulur:
- `.jwt_secret` - JWT imza anahtarı (chmod 0600)
- `.admin_initial_pass` - İlk admin şifresi (chmod 0600)

**ÖNEMLİ:** Bu dosyaları yedekleyin ve Git'e eklemeyin!

#### 4. Apache Konfigürasyonu

**.htaccess** dosyası otomatik yapılandırılır:
- URL rewriting
- Cache headers
- CORS headers
- HTTPS redirect (production)

#### 5. Veritabanı Yedekleme

```bash
# SQLite veritabanı yedekleme
cp database/omnex.db database/omnex.db.backup
```

### Güncelleme

#### 1. Dosyaları Güncelleme

```bash
# Yedek al
cp -r market-etiket-sistemi backup/

# Yeni dosyaları kopyala
cp -r new-version/* market-etiket-sistemi/
```

#### 2. Migration Çalıştırma

Migration'lar otomatik çalışır. Manuel çalıştırmak için:

```php
php -r "require 'config.php'; Database::getInstance()->migrate();"
```

#### 3. Cache Temizleme

```bash
# Storage cache temizleme
rm -rf storage/cache/*

# Browser cache temizleme (frontend'de)
# Otomatik olarak yeni build hash ile temizlenir
```

---

## 💻 Geliştirme Rehberi

### Geliştirme Ortamı

**Localhost Kurulumu:**
```bash
# XAMPP kullanarak
http://localhost/market-etiket-sistemi/
```

**Development Mode:**
- Otomatik tespit (localhost, 127.0.0.1, 192.168.*)
- Cache devre dışı
- Error display aktif
- Service Worker devre dışı

### Kod Standartları

**PHP:**
- PSR-12 coding standard
- Type hints kullanımı
- DocBlock comments
- Error handling (try-catch)

**JavaScript:**
- ES6+ modules
- Async/await
- Arrow functions
- Template literals

### API Geliştirme

**Yeni Endpoint Ekleme:**

1. **API Dosyası Oluştur:**
```php
// api/products/custom-action.php
<?php
require_once __DIR__ . '/../../config.php';

SecureHandler::handle(function() {
    $user = Auth::user();
    $companyId = Auth::getActiveCompanyId();
    
    // İş mantığı
    $data = ['result' => 'success'];
    
    Response::success($data);
}, [
    'auth' => true,
    'validate' => [
        'field' => ['required', 'string']
    ]
]);
```

2. **Router'a Ekle:**
```php
// api/index.php
$router->post('/api/products/custom-action', function($request) {
    require API_PATH . '/products/custom-action.php';
});
```

### Frontend Geliştirme

**Yeni Sayfa Ekleme:**

1. **Sayfa Bileşeni Oluştur:**
```javascript
// public/assets/js/pages/custom/CustomPage.js
export default function CustomPage() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        api.get('/api/custom-endpoint').then(setData);
    }, []);
    
    return html`
        <div class="page">
            <h1>Custom Page</h1>
            ${data && html`<p>${data.message}</p>`}
        </div>
    `;
}
```

2. **Router'a Ekle:**
```javascript
// public/assets/js/core/Router.js
routes['/custom'] = CustomPage;
```

3. **Menüye Ekle:**
```json
// locales/tr/menu.json
{
    "custom": {
        "title": "Özel Sayfa",
        "icon": "custom-icon",
        "route": "/custom"
    }
}
```

### Test

**Manuel Test:**
- API endpoint'leri Postman ile test edin
- Frontend sayfaları tarayıcıda test edin
- Multi-tenant izolasyonu test edin

**Test Senaryoları:**
- Authentication flow
- CRUD operations
- Multi-tenant isolation
- File uploads
- Render queue
- Error handling

### Debugging

**PHP Debugging:**
```php
// Logger kullanımı
Logger::debug('Debug mesajı', ['context' => $data]);

// Error logging
error_log('Error mesajı');
```

**JavaScript Debugging:**
```javascript
// Console logging
console.log('Debug:', data);

// API debugging
api.setDebug(true);  // Tüm istekleri logla
```

**Browser DevTools:**
- Network tab (API istekleri)
- Console tab (JavaScript hataları)
- Application tab (LocalStorage, Cache)

---

## 📚 Ek Kaynaklar

### Dokümantasyon Dosyaları

- `docs/README.md` - Genel dokümantasyon
- `docs/TENANT_ANALIZI.md` - Multi-tenant analizi
- `docs/TENANT_KAPSAMLI_ANALIZ.md` - Kapsamlı tenant analizi
- `docs/PROJECT_ANALYSIS.md` - Proje analizi
- `docs/İ18N-ANALIZ.MD` - Internationalization analizi
- `DATABASE_CAPACITY_ANALYSIS.md` - Veritabanı kapasite analizi
- `CLAUDE.md` - AI geliştirme rehberi
- `CHANGELOG.md` - Değişiklik geçmişi

### API Dokümantasyonu

Tüm API endpoint'leri için `CLAUDE.md` dosyasına bakın.

### Versiyon Bilgisi

`version.txt` dosyasında versiyon geçmişi bulunur.

---

## 📞 İletişim ve Destek

**Omnex Display Hub** - Dijital Etiket ve Signage Yönetim Platformu

**Lisans:** Ticari Lisans - Tüm hakları saklıdır.

---

**Son Güncelleme:** 2026-01-27  
**Versiyon:** 1.0.51

















