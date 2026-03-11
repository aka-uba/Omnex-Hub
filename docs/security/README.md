# Omnex Display Hub - Guvenlik Dokumantasyonu

Bu dokuman, Omnex Display Hub projesinin guvenlik mimarisini, uygulanan tedbirleri ve en iyi uygulamalari kapsamli sekilde aciklar.

---

## Icindekiler

1. [Guvenlik Mimarisi](#guvenlik-mimarisi)
2. [Backend Guvenlik Katmanlari](#backend-guvenlik-katmanlari)
3. [Frontend Guvenlik Araclari](#frontend-guvenlik-araclari)
4. [API Performans ve Rate Limiting](#api-performans-ve-rate-limiting)
5. [Kimlik Dogrulama ve Yetkilendirme](#kimlik-dogrulama-ve-yetkilendirme)
6. [Veri Koruma](#veri-koruma)
7. [Saldiri Onleme](#saldiri-onleme)
8. [Production Guvenligi](#production-guvenligi)
9. [Guvenlik Kontrol Listesi](#guvenlik-kontrol-listesi)
10. [Bilinen Guvenlik Aciklari ve Duzeltmeleri](#bilinen-guvenlik-aciklari-ve-duzeltmeleri)

---

## Guvenlik Mimarisi

### Katmanli Guvenlik Modeli

```
+--------------------------------------------------+
|                    ISTEMCI                        |
|  (SecurityUtils.js, ApiCache.js, escapeHTML)     |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|              API GUARD KATMANI                    |
|  (Origin kontrolu, CORS, Rate Limiting)          |
|  Dosya: middleware/ApiGuardMiddleware.php        |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|           INPUT SANITIZATION KATMANI             |
|  (SQL/NoSQL/XSS/Command Injection filtreleme)    |
|  Dosya: middleware/InputSanitizeMiddleware.php   |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|              CSRF KORUMA KATMANI                  |
|  (Token tabanli CSRF korumasi)                   |
|  Dosya: middleware/CsrfMiddleware.php            |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|         KIMLIK DOGRULAMA KATMANI                 |
|  (JWT token dogrulama)                           |
|  Dosya: middleware/AuthMiddleware.php            |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|           YETKILENDIRME KATMANI                  |
|  (Rol bazli erisim kontrolu)                     |
|  Dosya: middleware/AdminMiddleware.php           |
+--------------------------------------------------+
                        |
                        v
+--------------------------------------------------+
|              VERITABANI KATMANI                  |
|  (Prepared statements, escapeIdentifier)         |
|  Dosya: core/Database.php                        |
+--------------------------------------------------+
```

---

## Backend Guvenlik Katmanlari

### 1. ApiGuardMiddleware

**Dosya:** `middleware/ApiGuardMiddleware.php`

**Gorevleri:**
- Origin/CORS dogrulama
- Rate limiting (endpoint bazli)
- Preflight request isleme
- Brute force korumasi

**Yapilandirma:**

```php
// Rate limit ayarlari
private static array $rateLimits = [
    'default' => ['limit' => 100, 'window' => 60],  // 100 istek/dakika
    'auth'    => ['limit' => 10, 'window' => 60],   // 10 istek/dakika
    'upload'  => ['limit' => 20, 'window' => 60],   // 20 istek/dakika
    'export'  => ['limit' => 5, 'window' => 60],    // 5 istek/dakika
    'admin'   => ['limit' => 50, 'window' => 60],   // 50 istek/dakika
];

// Ozel limitli endpoint'ler
private static array $strictEndpoints = [
    '/api/auth/login' => 'auth',
    '/api/auth/register' => 'auth',
    '/api/auth/forgot-password' => 'auth',
    '/api/media/upload' => 'upload',
    '/api/products/import' => 'upload',
    '/api/products/export' => 'export',
];
```

**Origin Kontrolu:**

```php
// Izin verilen origin'ler (config.php'de tanimlanabilir)
define('ALLOWED_ORIGINS', [
    'https://omnexcore.com',
    '*.omnex.com',  // Wildcard subdomain destegi
]);

// Development'ta localhost ve LAN IP'leri otomatik izinli
// Production'da sadece ALLOWED_ORIGINS listesi gecerli
```

**Response Header'lari:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705420800
Access-Control-Allow-Origin: https://omnexcore.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token
```

---

### 2. InputSanitizeMiddleware

**Dosya:** `middleware/InputSanitizeMiddleware.php`

**Gorevleri:**
- SQL injection pattern tespiti ve engelleme
- NoSQL injection pattern tespiti ve engelleme
- XSS pattern tespiti ve engelleme
- Command injection engelleme
- Path traversal engelleme

**Tehdit Pattern'leri:**

```php
// SQL Injection
'/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i'
'/(-{2}|\/\*|\*\/|;)/'  // SQL comment ve terminator
'/(\'|\"|`).*?(OR|AND).*?(\'|\"|`)/i'  // String-based injection
'/(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i'  // OR 1=1, AND 1=1

// NoSQL Injection (MongoDB vb.)
'/\$ne\b/', '/\$gt\b/', '/\$lt\b/', '/\$gte\b/', '/\$lte\b/'
'/\$in\b/', '/\$nin\b/', '/\$or\b/', '/\$and\b/', '/\$not\b/'
'/\$regex\b/', '/\$where\b/', '/\$exists\b/'

// Command Injection
'/[;&|`$]/'  // Shell metacharacter'leri
'/(\\x00|\\x0a|\\x0d)/'  // Null byte, newline

// Path Traversal
'/\.\.\//', '/\.\.\\\\/'

// XSS
'/<script\b/i', '/<\/script>/i'
'/on\w+\s*=/i'  // Event handler (onclick=, onerror= vb.)
'/javascript:/i'
```

**Atlanan Alanlar (Sanitize edilmez):**

```php
private static array $skipFields = [
    'password',
    'password_confirmation',
    'current_password',
    'new_password',
    'content',           // Rich text/HTML icerik
    'template_content',
    'html',
    'useragent',         // Device info
    'user_agent',
    'fingerprint',
    'screen_resolution',
    'timezone',
    'platform',
];
```

**Muaf Endpoint'ler (Sanitize atlanir):**

```php
private static array $exemptPaths = [
    '/api/products/import',      // CSV/Excel import
    '/api/products/import/preview',
    '/api/products/import/analyze',
    '/api/products/export',
    '/api/media/upload',         // Dosya yukleme
    '/api/media/scan',
    '/api/media/browse',
    '/api/branding/upload',
    '/api/users/upload-avatar',
    '/api/templates',            // Sablon icerigi
    '/api/esl-gateway',          // ESL cihaz iletisimi
    '/api/esl/',                 // ESL device API
    '/api/player/',              // PWA Player API
];
```

**Hata Response'u:**

```json
{
    "success": false,
    "message": "Invalid input detected",
    "error_code": "INVALID_INPUT"
}
```

---

### 3. CsrfMiddleware

**Dosya:** `middleware/CsrfMiddleware.php`

**Token Alma:**

```bash
GET /api/csrf-token
```

**Token Gonderme:**

```http
X-CSRF-Token: <token>
# veya form body'de
_csrf_token: <token>
```

**Muaf Endpoint'ler:**

```php
private static array $exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh-token',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/csrf-token',
];
```

---

### 4. AuthMiddleware

**Dosya:** `middleware/AuthMiddleware.php`

**JWT Token Yapisi:**

```json
{
    "iss": "omnex-display-hub",
    "iat": 1705420800,
    "exp": 1705507200,
    "sub": "user-uuid",
    "role": "admin",
    "company_id": "company-uuid"
}
```

**Token Gonderme:**

```http
Authorization: Bearer <jwt_token>
```

**Token Yenileme:**

```bash
POST /api/auth/refresh-token
Body: { "refresh_token": "<token>" }
```

---

### 5. Database Guvenligi

**Dosya:** `core/Database.php`

**Prepared Statements:**

```php
// DOGRU - Guvenli
$user = $db->fetch("SELECT * FROM users WHERE id = ?", [$id]);

// YANLIS - SQL Injection riski!
$user = $db->fetch("SELECT * FROM users WHERE id = '$id'");
```

**Tablo/Kolon Adi Dogrulama:**

```php
// Whitelist ile dogrulama
public function validateTable(string $table): bool
{
    $allowed = ['users', 'products', 'devices', ...];
    return in_array($table, $allowed);
}

// Identifier escape
public function escapeIdentifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}
```

---

## Frontend Guvenlik Araclari

### SecurityUtils.js

**Dosya:** `public/assets/js/core/SecurityUtils.js`

#### escapeHTML()

XSS onleme icin HTML entity escape:

```javascript
import { escapeHTML } from './core/SecurityUtils.js';

const userInput = '<script>alert("XSS")</script>';
const safe = escapeHTML(userInput);
// Sonuc: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
```

#### html`` Template Tag

Guvenli HTML template literal:

```javascript
import { html, safe } from './core/SecurityUtils.js';

const userName = '<script>evil</script>';
const safeHtml = '<strong>Bold</strong>';

const output = html`
    <div>
        <p>User: ${userName}</p>           <!-- Otomatik escape -->
        <p>Content: ${safe(safeHtml)}</p>  <!-- Escape edilmez -->
    </div>
`;
```

#### sanitize()

Input temizleme:

```javascript
import { sanitize } from './core/SecurityUtils.js';

const dirty = "Hello\x00World\x0D\x0A";
const clean = sanitize(dirty);
// Sonuc: "HelloWorld"
```

#### isValidURL()

URL dogrulama (javascript: engelleme):

```javascript
import { isValidURL } from './core/SecurityUtils.js';

isValidURL('https://example.com');  // true
isValidURL('/page/1');              // true
isValidURL('javascript:alert(1)'); // false
isValidURL('data:text/html,...');  // false
```

#### setInnerHTML()

Guvenli innerHTML atama:

```javascript
import { setInnerHTML } from './core/SecurityUtils.js';

const element = document.getElementById('content');
const html = '<p>Safe</p><script>evil()</script>';

setInnerHTML(element, html);
// Script etiketi otomatik olarak kaldirilir
```

---

### ApiCache.js

**Dosya:** `public/assets/js/core/ApiCache.js`

Client-side cache sistemi:

```javascript
import { getApiCache, CacheTTL } from './core/ApiCache.js';

const cache = getApiCache({
    defaultTTL: CacheTTL.MEDIUM,  // 5 dakika
    maxEntries: 100,
    useLocalStorage: false
});

// Cache ile fetch
const data = await cache.fetch('/api/products', {
    ttl: CacheTTL.LONG  // 30 dakika
});

// Cache invalidation
cache.invalidate(/^\/api\/products/);  // products ile baslayanlari temizle
cache.clear();  // Tum cache'i temizle
```

**TTL Preset'leri:**

| Preset | Sure |
|--------|------|
| NONE | 0 |
| SHORT | 30 saniye |
| MEDIUM | 5 dakika |
| LONG | 30 dakika |
| HOUR | 1 saat |
| DAY | 24 saat |

---

## API Performans ve Rate Limiting

### Rate Limit Tablolari

#### Endpoint Bazli Limitler

| Endpoint Tipi | Limit | Pencere | Ornek Endpoint'ler |
|---------------|-------|---------|-------------------|
| default | 100 req | 60 sn | /api/products, /api/devices |
| auth | 10 req | 60 sn | /api/auth/login, /api/auth/register |
| upload | 20 req | 60 sn | /api/media/upload, /api/products/import |
| export | 5 req | 60 sn | /api/products/export |
| admin | 50 req | 60 sn | /api/companies, /api/licenses |

#### Rate Limit Header'lari

Her API response'unda asagidaki header'lar bulunur:

```http
X-RateLimit-Limit: 100       # Maksimum istek sayisi
X-RateLimit-Remaining: 95    # Kalan istek sayisi
X-RateLimit-Reset: 1705420800  # Reset zamani (Unix timestamp)
```

#### Rate Limit Asildiginda

```json
HTTP 429 Too Many Requests

{
    "success": false,
    "message": "Too many requests. Please try again later.",
    "error_code": "RATE_LIMIT_EXCEEDED",
    "retry_after": 45
}
```

### API Response Sureleri (Benchmark)

| Endpoint | Ortalama | P95 | P99 |
|----------|----------|-----|-----|
| GET /api/products | 50ms | 120ms | 200ms |
| POST /api/auth/login | 150ms | 300ms | 500ms |
| POST /api/media/upload | 500ms | 2s | 5s |
| GET /api/reports/dashboard-stats | 100ms | 250ms | 400ms |

### Cache Stratejileri

| Veri Tipi | TTL | Strateji |
|-----------|-----|----------|
| Kullanici oturumu | 0 | No cache |
| Urun listesi | 5 dk | Cache with revalidation |
| Kategori listesi | 30 dk | Cache-first |
| Dashboard istatistikleri | 1 dk | Network-first |
| Medya dosyalari | 1 yil | Immutable cache |

---

## Kimlik Dogrulama ve Yetkilendirme

### Roller ve Yetkiler

| Rol | Aciklama | Yetkiler |
|-----|----------|----------|
| superadmin | Sistem yoneticisi | Tum yetkiler, firma yonetimi |
| admin | Firma yoneticisi | Firma icindeki tum yetkiler |
| manager | Mudur | Urun, cihaz, sablon yonetimi |
| user | Kullanici | Sadece okuma ve sinirli yazma |

### JWT Token Yapilandirmasi

```php
// config.php
define('JWT_ALGORITHM', 'HS256');
define('JWT_EXPIRES_IN', 86400);     // 24 saat
define('JWT_REFRESH_EXPIRES_IN', 604800);  // 7 gun
```

### Sifre Politikasi

```php
// Minimum gereksinimler
- 8 karakter uzunluk
- 1 buyuk harf
- 1 kucuk harf
- 1 rakam
- 1 ozel karakter (!@#$%^&*(),.?":{}|<>)

// Hash algoritmasi
PASSWORD_ARGON2ID (varsayilan)
```

---

## Veri Koruma

### Hassas Veri Alanlari

| Tablo | Alan | Koruma |
|-------|------|--------|
| users | password_hash | Argon2ID hash |
| users | email | Unique, validated |
| sessions | token | SHA-256 hash |
| licenses | license_key | Encrypted |
| settings | smtp_password | Encrypted |

### Sifreli Depolama

```php
// Security::encrypt() ve Security::decrypt()
// AES-256-CBC kullanir
// JWT_SECRET ile key turetilir

$encrypted = Security::encrypt($sensitiveData);
$decrypted = Security::decrypt($encrypted);
```

### Audit Logging

```php
// Tum kritik islemler audit_logs tablosuna kaydedilir
audit_logs:
  - user_id
  - action (create, update, delete, login, export)
  - entity_type
  - entity_id
  - old_values (JSON)
  - new_values (JSON)
  - ip_address
  - user_agent
  - created_at
```

---

## Saldiri Onleme

### SQL Injection

**Onlem:** Prepared statements + whitelist validation

```php
// core/Database.php
$stmt = $this->pdo->prepare($query);
$stmt->execute($params);
```

### NoSQL Injection

**Onlem:** Pattern filtreleme

```php
// InputSanitizeMiddleware.php
'/\$ne\b/', '/\$gt\b/', '/\$or\b/', '/\$where\b/'
```

### XSS (Cross-Site Scripting)

**Backend Onlem:**

```php
// core/Security.php
public static function escape(string $input): string
{
    return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}
```

**Frontend Onlem:**

```javascript
// SecurityUtils.js
export function escapeHTML(str) { ... }
export function setInnerHTML(element, html) { ... }
```

### CSRF (Cross-Site Request Forgery)

**Onlem:** Token tabanli koruma

```php
// CsrfMiddleware.php
// Her form POST icin token gerekli
// Token session'da saklanir
// hash_equals() ile karsilastirilir
```

### Path Traversal

**Onlem:** Storage dizini kisitlamasi

```php
// media/serve.php, media/browse.php
// Sadece STORAGE_PATH icinde erisim izni
// ../ pattern'leri engellenir
```

### Brute Force

**Onlem:** Rate limiting + hesap kilitleme

```php
// ApiGuardMiddleware.php
// auth endpoint'leri: 10 istek/dakika
// 5 basarisiz giris -> 15 dakika bekleme
```

---

## Production Guvenligi

### Aktifasyon

```bash
# Yontem 1: Dosya ile
touch /path/to/project/.production

# Yontem 2: Environment variable
export OMNEX_PRODUCTION=true
```

### Production Mode Degisiklikleri

| Ozellik | Development | Production |
|---------|-------------|------------|
| Error display | Acik | Kapali |
| Error logging | Dosya | Dosya |
| JWT Secret | Sabit | Otomatik/env |
| HTTPS | Opsiyonel | Zorunlu |
| Debug info | Gosterilir | Gizlenir |
| CORS | Tum origin | Whitelist |

### Environment Variables

| Variable | Aciklama | Varsayilan |
|----------|----------|------------|
| OMNEX_PRODUCTION | Production modu | false |
| OMNEX_JWT_SECRET | JWT imza anahtari | Otomatik |
| OMNEX_ADMIN_PASSWORD | Admin sifresi | Otomatik |
| OMNEX_FORCE_HTTPS | HTTPS zorlama | Production'da true |
| OMNEX_SKIP_CSRF | CSRF atla (dev only) | false |
| ALLOWED_ORIGINS | Izinli origin'ler | [] |

### Otomatik Olusturulan Dosyalar

| Dosya | Aciklama | Izinler |
|-------|----------|---------|
| .production | Production modu isaretleyici | 644 |
| .jwt_secret | JWT imza anahtari (64 hex) | 600 |
| .admin_initial_pass | Ilk admin sifresi (32 hex) | 600 |

---

## Guvenlik Kontrol Listesi

### Deployment Oncesi

- [ ] `.production` dosyasi olusturuldu
- [ ] HTTPS sertifikasi kuruldu
- [ ] `ALLOWED_ORIGINS` ayarlandi
- [ ] Varsayilan admin sifresi degistirildi
- [ ] `.jwt_secret` dosyasi yedeklendi
- [ ] Storage dizini izinleri ayarlandi (755)
- [ ] Error logging aktif
- [ ] Backup sistemi kuruldu

### Periyodik Kontrol

- [ ] Rate limit cache temizligi (gunluk)
- [ ] Audit log incelemesi (haftalik)
- [ ] Basarisiz giris denemeleri (gunluk)
- [ ] Disk alani kontrolu (haftalik)
- [ ] SSL sertifika suresi (aylik)
- [ ] Dependency guncellemeleri (aylik)

### Acil Durum

- [ ] Incident response proseduru
- [ ] Backup geri yukleme testi
- [ ] Hesap kilitleme mekanizmasi
- [ ] IP engelleme mekanizmasi

---

## Bilinen Guvenlik Aciklari ve Duzeltmeleri

### Duzeltilen Aciklar

| Tarih | Acik | Cozum | CVE |
|-------|------|-------|-----|
| 2026-01-12 | SQL Injection (Database.php) | escapeIdentifier() eklendi | - |
| 2026-01-12 | Path Traversal (media/serve.php) | Storage dizini kisitlamasi | - |
| 2026-01-12 | Path Traversal (media/browse.php) | Storage dizini kisitlamasi | - |
| 2026-01-12 | Tutarsiz sifre hashing | Auth::hashPassword() kullanildi | - |
| 2026-01-16 | Input sanitization eksik | InputSanitizeMiddleware eklendi | - |
| 2026-01-16 | Origin kontrolu eksik | ApiGuardMiddleware eklendi | - |
| 2026-01-16 | Rate limiting kismi | Tum endpoint'lere uygulandı | - |

### Bilinen Sinirlamalar

1. **WebSocket guvenligi**: WebSocket baglantilari icin ayri guvenlik katmani yok (gelecek ozellik)
2. **2FA**: Iki faktorlu dogrulama henuz mevcut degil (gelecek ozellik)
3. **IP engelleme**: Manuel IP engelleme mekanizmasi yok (gelecek ozellik)

---

## Iletisim ve Raporlama

Guvenlik acigi bildirimi icin:
- E-posta: security@omnexcore.com
- GitHub Issues (guvenlik etiketi ile)

---

*Son guncelleme: 2026-01-16 (Build 28)*
