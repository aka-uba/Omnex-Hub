# Lisans Kontrol Sistemi Dokümantasyonu

**Versiyon:** 2.0.13
**Son Güncelleme:** 2026-01-27
**Durum:** Aktif

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mimari Yapı](#mimari-yapı)
3. [Lisans Tipleri](#lisans-tipleri)
4. [Lisans Durumları](#lisans-durumları)
5. [Lisans Periyotları](#lisans-periyotları)
6. [Veritabanı Yapısı](#veritabanı-yapısı)
7. [LicenseMiddleware](#licensemiddleware)
8. [Entegrasyon Akışı](#entegrasyon-akışı)
9. [API Endpoint'leri](#api-endpointleri)
10. [Cron Job](#cron-job)
11. [Frontend Entegrasyonu](#frontend-entegrasyonu)
12. [Hata Kodları](#hata-kodları)
13. [Test Senaryoları](#test-senaryoları)
14. [Güvenlik Notları](#güvenlik-notları)
15. [Sık Sorulan Sorular](#sık-sorulan-sorular)

---

## Genel Bakış

Omnex Display Hub lisans sistemi, multi-tenant (çoklu firma) mimarisinde her firmanın kullanım haklarını yönetir. Sistem aşağıdaki özellikleri sağlar:

- ✅ Firma bazlı lisans ataması
- ✅ Farklı lisans tipleri (starter, business, enterprise, ultimate, unlimited)
- ✅ Farklı periyotlar (monthly, yearly, lifetime)
- ✅ Otomatik süre kontrolü
- ✅ Süresi dolmadan bildirim
- ✅ Sınırsız lisanslar için tarih kontrolü yapılmaz
- ✅ SuperAdmin kullanıcıları muaf

---

## Mimari Yapı

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP İSTEĞİ                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ApiGuardMiddleware                           │
│                   (CORS, Rate Limiting)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  InputSanitizeMiddleware                         │
│                    (XSS, SQL Injection)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AuthMiddleware                              │
│                    (JWT Token Doğrulama)                         │
│                            │                                     │
│                            ▼                                     │
│              ┌─────────────────────────┐                        │
│              │   LicenseMiddleware     │                        │
│              │   (Lisans Kontrolü)     │                        │
│              └─────────────────────────┘                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Handler                               │
│                    (İş Mantığı)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lisans Tipleri

| Tip | Açıklama | ESL Limiti | TV Limiti | Kullanıcı Limiti | Depolama |
|-----|----------|------------|-----------|------------------|----------|
| `trial` | Deneme | 10 | 1 | 2 | 100 MB |
| `starter` | Başlangıç | 100 | 5 | 5 | 1 GB |
| `business` | İş | 500 | 20 | 20 | 5 GB |
| `enterprise` | Kurumsal | 2000 | 100 | 100 | 20 GB |
| `ultimate` | Sınırsız | ∞ | ∞ | ∞ | ∞ |
| `unlimited` | Sınırsız | ∞ | ∞ | ∞ | ∞ |

### Sınırsız Tipler

`ultimate` ve `unlimited` tipleri **tarih kontrolü yapılmadan** her zaman geçerli kabul edilir. Bu tipler:

- Geliştirme ortamları için
- Özel anlaşmalı müşteriler için
- Demo hesapları için

kullanılabilir.

---

## Lisans Durumları

| Durum | Kod | Açıklama | Erişim |
|-------|-----|----------|--------|
| Aktif | `active` | Normal çalışır | ✅ İzin verilir |
| Süresi Dolmuş | `expired` | Tarihi geçmiş | ❌ Engellenir |
| Askıya Alınmış | `suspended` | Geçici durdurma | ❌ Engellenir |
| İptal Edilmiş | `cancelled` | Kalıcı iptal | ❌ Engellenir |

---

## Lisans Periyotları

| Periyot | Kod | Süre | Tarih Kontrolü |
|---------|-----|------|----------------|
| Aylık | `monthly` | 30 gün | ✅ Yapılır |
| Yıllık | `yearly` | 365 gün | ✅ Yapılır |
| Ömür Boyu | `lifetime` | Sınırsız | ❌ Yapılmaz |

---

## Veritabanı Yapısı

### licenses Tablosu

```sql
CREATE TABLE licenses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    license_key TEXT UNIQUE,
    type TEXT DEFAULT 'starter',
    period TEXT DEFAULT 'monthly',
    valid_from TEXT,
    valid_until TEXT,
    status TEXT DEFAULT 'active',
    max_devices INTEGER DEFAULT 100,
    esl_limit INTEGER DEFAULT 100,
    tv_limit INTEGER DEFAULT 5,
    user_limit INTEGER DEFAULT 5,
    storage_limit INTEGER DEFAULT 1024,
    features TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,

    FOREIGN KEY (company_id) REFERENCES companies(id),

    CHECK (type IN ('trial', 'starter', 'business', 'enterprise', 'ultimate', 'unlimited')),
    CHECK (period IN ('monthly', 'yearly', 'lifetime')),
    CHECK (status IN ('active', 'expired', 'suspended', 'cancelled'))
);
```

### Örnek Kayıtlar

```sql
-- Sınırsız lisans (geliştirme için)
INSERT INTO licenses (id, company_id, type, period, status, valid_from)
VALUES ('uuid', 'company-uuid', 'ultimate', 'lifetime', 'active', '2026-01-01');

-- Yıllık business lisans
INSERT INTO licenses (id, company_id, type, period, status, valid_from, valid_until)
VALUES ('uuid', 'company-uuid', 'business', 'yearly', 'active', '2026-01-01', '2027-01-01');

-- Aylık starter lisans
INSERT INTO licenses (id, company_id, type, period, status, valid_from, valid_until)
VALUES ('uuid', 'company-uuid', 'starter', 'monthly', 'active', '2026-01-01', '2026-02-01');
```

---

## LicenseMiddleware

### Dosya Konumu

```
middleware/LicenseMiddleware.php
```

### Sınıf Yapısı

```php
class LicenseMiddleware
{
    // Sınırsız lisans tipleri - tarih kontrolü yapılmaz
    private static array $unlimitedTypes = ['ultimate', 'unlimited'];

    // Sınırsız periyotlar - tarih kontrolü yapılmaz
    private static array $unlimitedPeriods = ['lifetime'];

    // Lisans kontrolü yapılmayacak route'lar
    private static array $exemptRoutes = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/auth/refresh-token',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/csrf-token',
        '/api/payments',
        '/api/licenses'
    ];

    // Ana kontrol metodu
    public static function handle(Request $request): bool;

    // Lisans doğrulama metodu
    public static function checkLicense(string $companyId): array;

    // Süresi dolacak lisansları kontrol et (cron için)
    public static function checkExpiringLicenses(): void;
}
```

### handle() Metodu

```php
public static function handle(Request $request): bool
{
    // 1. Muaf route kontrolü
    // 2. Kullanıcı ve firma kontrolü
    // 3. SuperAdmin muafiyeti
    // 4. Lisans doğrulama
    // 5. Sonuç dönüşü (true/false)
}
```

### checkLicense() Metodu

```php
public static function checkLicense(string $companyId): array
{
    // Dönüş formatı:
    return [
        'valid' => bool,        // Geçerli mi?
        'message' => string,    // Açıklama mesajı
        'license' => array,     // Lisans bilgileri
        'days_left' => int|null // Kalan gün (sınırsız için null)
    ];
}
```

### Kontrol Akışı

```
┌─────────────────────┐
│   İstek Geldi       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     Evet    ┌─────────────────────┐
│ Muaf Route mu?      │────────────▶│ Kontrolsüz Geç      │
└──────────┬──────────┘             └─────────────────────┘
           │ Hayır
           ▼
┌─────────────────────┐     Evet    ┌─────────────────────┐
│ SuperAdmin mi?      │────────────▶│ Kontrolsüz Geç      │
└──────────┬──────────┘             └─────────────────────┘
           │ Hayır
           ▼
┌─────────────────────┐
│ Lisans Bul          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     Hayır   ┌─────────────────────┐
│ Lisans Var mı?      │────────────▶│ 403 Forbidden       │
└──────────┬──────────┘             └─────────────────────┘
           │ Evet
           ▼
┌─────────────────────┐     Evet    ┌─────────────────────┐
│ Sınırsız Tip/Period?│────────────▶│ Her Zaman Geçerli   │
└──────────┬──────────┘             └─────────────────────┘
           │ Hayır
           ▼
┌─────────────────────┐     Hayır   ┌─────────────────────┐
│ Durum Aktif mi?     │────────────▶│ 403 Forbidden       │
└──────────┬──────────┘             └─────────────────────┘
           │ Evet
           ▼
┌─────────────────────┐     Evet    ┌─────────────────────┐
│ Tarihi Geçmiş mi?   │────────────▶│ 403 Forbidden       │
└──────────┬──────────┘             └─────────────────────┘
           │ Hayır
           ▼
┌─────────────────────┐     Evet    ┌─────────────────────┐
│ 7 Gün veya Az mı?   │────────────▶│ Uyarı Header Ekle   │
└──────────┬──────────┘             └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Erişime İzin Ver    │
└─────────────────────┘
```

---

## Entegrasyon Akışı

### AuthMiddleware Entegrasyonu

`AuthMiddleware.php` dosyasında, kullanıcı doğrulamasından sonra lisans kontrolü eklenir:

```php
// Auth::setUser() çağrısından sonra
if ($user['role'] !== 'SuperAdmin' && $user['company_id']) {
    if (!LicenseMiddleware::handle($request)) {
        return; // Response zaten gönderildi
    }
}
```

### api/index.php Kaydı

```php
$router->registerMiddleware('license', 'LicenseMiddleware');
```

---

## API Endpoint'leri

### Lisans Listesi (Admin)

```http
GET /api/licenses
Authorization: Bearer <token>
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "company_id": "uuid",
            "company_name": "Firma Adı",
            "type": "business",
            "period": "yearly",
            "status": "active",
            "valid_from": "2026-01-01",
            "valid_until": "2027-01-01",
            "days_left": 339
        }
    ]
}
```

### Lisans Oluştur (Admin)

```http
POST /api/licenses
Authorization: Bearer <token>
Content-Type: application/json

{
    "company_id": "uuid",
    "type": "business",
    "period": "yearly"
}
```

### Lisans Güncelle (Admin)

```http
PUT /api/licenses/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
    "type": "enterprise",
    "valid_until": "2028-01-01",
    "status": "active"
}
```

### Lisans İptal (Admin)

```http
POST /api/licenses/{id}/revoke
Authorization: Bearer <token>
```

---

## Cron Job

### Dosya Konumu

```
cron/check-licenses.php
```

### Kurulum

**Linux/macOS (crontab):**
```bash
# Günde bir kez, sabah 08:00'de çalıştır
0 8 * * * /usr/bin/php /path/to/project/cron/check-licenses.php >> /var/log/omnex-license-cron.log 2>&1
```

**Windows (Görev Zamanlayıcı):**
```
Program: C:\php\php.exe
Arguments: C:\xampp\htdocs\market-etiket-sistemi\cron\check-licenses.php
Schedule: Daily at 08:00
```

### Bildirim Zamanlaması

| Kalan Gün | Bildirim Tipi | Öncelik |
|-----------|---------------|---------|
| 30 | Ön uyarı | Normal |
| 14 | Uyarı | Normal |
| 7 | Acil uyarı | High |
| 3 | Kritik | Urgent |
| 1 | Son gün | Urgent |
| 0 | Süresi doldu | Urgent |

### Bildirim İçeriği

```php
NotificationService::sendToRole(
    title: "Lisans Süresi Dolmak Üzere",
    message: "Firmanızın lisansı {$daysLeft} gün içinde sona erecek.",
    type: 'warning',
    role: 'Admin',
    companyId: $license['company_id'],
    actionUrl: '/admin/licenses'
);
```

---

## Frontend Entegrasyonu

### Lisans Hatası Yakalama (Api.js)

API yanıtlarında lisans hataları otomatik olarak yakalanır ve kullanıcıya bilgilendirici modal gösterilir:

```javascript
// Api.js - request() metodu içinde
if (response.status === 403 && result.license_error) {
    this.handleLicenseError(result);
    const error = new Error(result.message || 'Lisans hatası');
    error.status = response.status;
    error.data = result;
    error.isLicenseError = true;
    throw error;
}
```

### handleLicenseError() Metodu

Lisans hatası durumunda kullanıcıya bilgilendirici modal gösterir:

```javascript
handleLicenseError(result) {
    const { Modal } = window.OmnexComponents || {};
    const __ = window.__ || ((k) => k);

    // Hata koduna göre ikon ve başlık
    let icon = 'ti-license-off';
    let title = __('license.error.title');

    switch (result.code) {
        case 'LICENSE_EXPIRED':
            icon = 'ti-clock-off';
            title = __('license.error.expired');
            break;
        case 'LICENSE_CANCELLED':
            icon = 'ti-ban';
            title = __('license.error.cancelled');
            break;
        case 'LICENSE_SUSPENDED':
            icon = 'ti-lock';
            title = __('license.error.suspended');
            break;
        case 'LICENSE_NOT_FOUND':
            icon = 'ti-file-off';
            title = __('license.error.notFound');
            break;
    }

    // Modal içeriği: ikon, mesaj, lisans bilgileri
    // Admin kullanıcılara "Lisansı Yenile" butonu gösterilir
    // Normal kullanıcılara "Yöneticinize başvurun" mesajı gösterilir

    Modal.show({
        title: title,
        content: content,
        closable: false,           // Kapatılamaz
        closeOnBackdrop: false,    // Dışına tıklayarak kapatılamaz
        closeOnEscape: false,      // ESC ile kapatılamaz
        showCancel: false,
        confirmText: result.can_renew ? 'Lisansı Yenile' : 'Tamam',
        onConfirm: () => {
            if (result.redirect_url) {
                window.location.hash = result.redirect_url;
            }
        }
    });
}
```

### Lisans Uyarısı (Süre Dolmak Üzere)

API yanıtlarında `X-License-Warning` header'ı kontrol edilir. Lisans 7 gün içinde dolacaksa toast bildirimi gösterilir:

```javascript
// Api.js - request() metodu içinde
const licenseWarning = response.headers.get('X-License-Warning');
if (licenseWarning && !this._licenseWarningShown) {
    this._licenseWarningShown = true;
    this.showLicenseWarning(licenseWarning);
    // 1 saat sonra tekrar gösterebilir
    setTimeout(() => { this._licenseWarningShown = false; }, 60 * 60 * 1000);
}

showLicenseWarning(warningText) {
    Toast.warning(`Lisansınız yakında dolacak: ${warningText}`, {
        duration: 10000,
        action: {
            text: 'Yenile',
            onClick: () => window.location.hash = '#/admin/licenses'
        }
    });
}
```

### i18n Çeviri Anahtarları

Lisans ile ilgili tüm metinler `locales/{lang}/common.json` dosyasında tanımlıdır:

```json
{
    "license": {
        "title": "Lisans",
        "error": {
            "title": "Lisans Hatası",
            "expired": "Lisansınızın süresi dolmuş",
            "cancelled": "Lisansınız iptal edilmiş",
            "suspended": "Lisansınız askıya alınmış",
            "notFound": "Firmanıza tanımlı lisans bulunamadı"
        },
        "type": "Lisans Türü",
        "status": "Durum",
        "expiredAt": "Bitiş Tarihi",
        "daysOverdue": "Gecikme (Gün)",
        "canRenew": "Lisansınızı yenilemek için Lisans Yönetimi sayfasına gidebilirsiniz.",
        "contactAdmin": "Lütfen yöneticinize başvurun.",
        "renewButton": "Lisansı Yenile",
        "warning": {
            "expiringSoon": "Lisansınızın süresi {days} gün içinde dolacak!",
            "renew": "Yenile"
        }
    }
}
```

### LicenseManagement Sayfası

Admin panelinde lisans yönetimi için `admin/LicenseManagement.js` sayfası kullanılır. SuperAdmin ve Admin rolleri bu sayfaya erişebilir.

---

## Hata Kodları

| HTTP Kodu | Kod | Mesaj | Açıklama |
|-----------|-----|-------|----------|
| 403 | `LICENSE_NOT_FOUND` | Lisans bulunamadı | Firmaya lisans atanmamış |
| 403 | `LICENSE_EXPIRED` | Lisans süresi doldu | valid_until tarihi geçmiş |
| 403 | `LICENSE_SUSPENDED` | Lisans askıya alındı | status = suspended |
| 403 | `LICENSE_CANCELLED` | Lisans iptal edildi | status = cancelled |

### Hata Response Formatı

```json
{
    "success": false,
    "message": "Lisans süresi doldu",
    "code": "LICENSE_EXPIRED",
    "license_error": true,
    "redirect_url": "#/admin/licenses",
    "can_renew": true,
    "contact_admin": false,
    "license_info": {
        "type": "business",
        "status": "expired",
        "expired_at": "2026-01-15",
        "days_overdue": 12
    }
}
```

### Response Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `success` | boolean | Her zaman `false` |
| `message` | string | Kullanıcıya gösterilecek mesaj |
| `code` | string | Hata kodu (LICENSE_EXPIRED, LICENSE_CANCELLED, vb.) |
| `license_error` | boolean | Lisans hatası olduğunu belirtir (frontend için) |
| `redirect_url` | string/null | Admin ise lisans sayfası URL'i, değilse null |
| `can_renew` | boolean | Kullanıcı lisans yenileyebilir mi (Admin/SuperAdmin) |
| `contact_admin` | boolean | Kullanıcı yöneticiye başvurmalı mı (normal kullanıcı) |
| `license_info` | object | Lisans detay bilgileri |

---

## Test Senaryoları

### Test Çalıştırma

```bash
cd /path/to/project
php tests/license_system_test.php
```

### Manuel Test Senaryoları

#### Senaryo 1: Sınırsız Lisans

1. Lisans tipi `ultimate` veya `unlimited` olarak ayarla
2. Herhangi bir API çağrısı yap
3. **Beklenen:** Başarılı yanıt (tarih kontrolü yapılmaz)

#### Senaryo 2: Lifetime Periyot

1. Lisans periyotu `lifetime` olarak ayarla
2. Herhangi bir API çağrısı yap
3. **Beklenen:** Başarılı yanıt (tarih kontrolü yapılmaz)

#### Senaryo 3: Aktif ve Geçerli Lisans

1. Lisans tipi `business`, durum `active`, valid_until > bugün
2. API çağrısı yap
3. **Beklenen:** Başarılı yanıt

#### Senaryo 4: 7 Günden Az Kalan

1. valid_until = bugün + 5 gün
2. API çağrısı yap
3. **Beklenen:** Başarılı yanıt + `X-License-Warning: 5` header'ı

#### Senaryo 5: Süresi Dolmuş

1. valid_until = dün
2. API çağrısı yap
3. **Beklenen:** 403 Forbidden, code: `LICENSE_EXPIRED`

#### Senaryo 6: İptal Edilmiş

1. status = `cancelled`
2. API çağrısı yap
3. **Beklenen:** 403 Forbidden, code: `LICENSE_CANCELLED`

#### Senaryo 7: SuperAdmin Muafiyeti

1. SuperAdmin rolüyle giriş yap
2. Herhangi bir firmanın süresi dolmuş lisansı olsun
3. O firma adına işlem yap
4. **Beklenen:** Başarılı yanıt (SuperAdmin muaf)

---

## Güvenlik Notları

### 1. Token Güvenliği

Lisans kontrolü JWT token doğrulamasından **sonra** yapılır. Token geçersizse lisans kontrolüne ulaşılmaz.

### 2. Firma İzolasyonu

Her kullanıcı sadece kendi firmasının lisansından etkilenir. Multi-tenant izolasyon korunur.

### 3. Admin Yetkileri

Lisans yönetimi sadece `SuperAdmin` ve `Admin` rolleri tarafından yapılabilir.

### 4. Rate Limiting

Lisans kontrol API'leri rate limiting'e tabidir (varsayılan: 50 istek/dakika).

### 5. Muaf Route'lar

Aşağıdaki route'lar lisans kontrolünden muaftır (güvenlik riski oluşturmaz):

- `/api/auth/*` - Kimlik doğrulama
- `/api/csrf-token` - CSRF token
- `/api/payments/*` - Ödeme işlemleri (lisans yenilemek için)
- `/api/licenses/*` - Lisans yönetimi (admin)

---

## Sık Sorulan Sorular

### S1: Geliştirme ortamında lisans kontrolü nasıl devre dışı bırakılır?

Lisans tipini `ultimate` veya `unlimited` olarak ayarlayın. Bu tipler tarih kontrolünden muaftır.

```sql
UPDATE licenses SET type = 'ultimate' WHERE company_id = 'your-company-id';
```

### S2: SuperAdmin neden lisans kontrolünden muaf?

SuperAdmin, platform yöneticisidir ve tüm firmaları yönetebilmelidir. Lisans sorunu olan bir firmayı düzeltebilmesi için erişimi olmalıdır.

### S3: Lisans süresi dolunca ne olur?

Kullanıcı API'ye erişemez (403 hatası alır). Frontend'de uygun bir mesaj gösterilir ve yenileme seçeneği sunulur.

### S4: Cron job çalışmazsa ne olur?

Bildirimler gönderilmez ama lisans kontrolü yine de çalışır. Kullanıcılar süresi dolunca erişim kaybeder.

### S5: Lisans limitleri (ESL, TV, kullanıcı) nasıl kontrol ediliyor?

Bu kontroller ilgili API endpoint'lerinde yapılır:

- Cihaz ekleme: `api/devices/create.php`
- Kullanıcı ekleme: `api/users/create.php`
- Medya yükleme: `api/media/upload.php`

### S6: Birden fazla lisans olabilir mi?

Hayır, her firma için aktif bir lisans olmalıdır. Yeni lisans atanınca eski lisans `cancelled` olarak işaretlenir.

---

## Değişiklik Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 2.0.13 | 2026-01-27 | İlk sürüm - Lisans kontrol sistemi eklendi |

---

## İletişim

Sorularınız için:
- **E-posta:** support@omnex.com
- **Dokümantasyon:** https://docs.omnex.com/license-system
