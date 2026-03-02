# Omnex Display Hub - Guvenlik Denetim Raporu

**Tarih:** 2026-01-27
**Surum:** v2.0.13
**Kapsam:** Tum backend API, frontend JS, middleware, core siniflar
**Yontem:** Statik kod analizi (4 paralel audit ajani)

---

## Icindekiler

1. [Yonetici Ozeti](#1-yonetici-ozeti)
2. [SQL Injection (SQLi)](#2-sql-injection-sqli)
3. [XSS (Cross-Site Scripting)](#3-xss-cross-site-scripting)
4. [CSRF (Cross-Site Request Forgery)](#4-csrf-cross-site-request-forgery)
5. [Rate Limiting](#5-rate-limiting)
6. [Input Validation & Sanitization](#6-input-validation--sanitization)
7. [Kimlik Dogrulama & Oturum](#7-kimlik-dogrulama--oturum)
8. [CORS & Ag Guvenligi](#8-cors--ag-guvenligi)
9. [Logging & Monitoring](#9-logging--monitoring)
10. [Ozet Tablo](#10-ozet-tablo)

---

## 1. Yonetici Ozeti

| Seviye | Sayi | Aciklama |
|--------|------|----------|
| **KRITIK** | 2 | Validator SQLi, DataTable sistemik XSS |
| **YUKSEK** | 8 | CSRF devre disi, JWT localStorage, session cookie, sanitization bypass, rate limit race, CORS, XSS noktalari |
| **ORTA** | 10 | JWT alg, dev secret, reset token, account lockout, SSRF, error leak, ESL gateway auth, regex bypass |
| **DUSUK** | 3 | SVG upload, CSRF prefix, failed auth logging |

**En kritik risk:** `SecurityUtils.js` mevcut ama hicbir sayfa/bilesen tarafindan import edilmiyor. 60+ XSS noktasi tespit edildi. Herhangi bir XSS istismari ile `localStorage`'daki JWT token calinabilir ve tam hesap ele gecirme mumkun.

---

## 2. SQL Injection (SQLi)

### 2.1 Core Veritabani Katmani

**Degerlendirme: Iyi korunuyor.**

- `escapeIdentifier()` (Database.php:182): Regex `^[a-zA-Z_][a-zA-Z0-9_]*$` ile dogrulama + backtick. **Guvenli.**
- `validateTable()` (Database.php:194): Izin verilen tablo adlari whitelist'i. **Guvenli.**
- `insert()` / `update()` / `delete()`: `validateTable()` ve `escapeIdentifier()` kullanir, parametrize degerler. **Guvenli.**
- `PDO::ATTR_EMULATE_PREPARES => false` (Database.php:27): Gercek prepared statement kullaniliyor. **Guvenli.**

### 2.2 Bulgular

#### S1 - KRITIK: Validator unique/exists Kurallarinda SQL Injection

**Dosya:** `core/Validator.php:194-221`

```php
case 'unique':
    [$table, $column, $exceptId] = array_pad(explode(',', $param), 3, null);
    $sql = "SELECT 1 FROM $table WHERE $column = ?";  // TEHLIKE
```

**Aciklama:** `unique` ve `exists` dogrulama kurallari tablo ve kolon adlarini dogrudan SQL'e interpole ediyor. `escapeIdentifier()` veya `validateTable()` kullanilmamis. Dinamik dogrulama kurallari kullanici girdisinden olusturulursa SQL injection mumkun.

**Ornek Payload:** Dogrulama kurali `unique:users;DROP TABLE users--,email` seklinde olusturulursa SQL injection gerceklesir.

**Risk:** Dogrudan kullanici girdisinden kural olusturma olasiligi dusuk olsa da, kod kalitesi acisindan kritik.

#### S2 - BILGI: ORDER BY Interpolasyonu (Korunuyor)

**Dosyalar:**
- `api/products/index.php:73` - whitelist ile korunuyor
- `api/audit-logs/index.php:165` - `$sortColumnMap` ile korunuyor
- `api/devices/index.php:91` - whitelist map ile korunuyor

**Durum:** Tum ORDER BY kullanmlari whitelist dogrulamasi ile korunuyor. **Guvenli.**

#### S3 - BILGI: $companyFilter Concat Deseni (Guvenli)

**Dosyalar:** `api/reports/dashboard-stats.php`, `api/reports/export.php`, `api/reports/device-activity.php`

```php
$companyFilter = $companyId ? ' AND company_id = ?' : '';
$params[] = $companyId;
```

**Durum:** Her zaman literal SQL + parametrize deger. **Guvenli.**

#### S4 - BILGI: LIKE Wildcard Injection

**Etkilenen:** Tum arama endpoint'leri

```php
$searchTerm = "%$search%";
$params[] = $searchTerm;
```

**Durum:** Kullanici `%` veya `_` enjekte edebilir. Guvenlik riski dusuk, sadece arama sonuclarini genisletir.

---

## 3. XSS (Cross-Site Scripting)

### 3.1 Sistemik Sorun

`SecurityUtils.js` dosyasi (`public/assets/js/core/SecurityUtils.js`) asagidaki fonksiyonlari saglar:
- `escapeHTML()` - HTML entity encoding
- `html` tagged template literal - guvenli HTML olusturma
- `safe()` - guvenli deger sarmalama
- `sanitize()` - input temizleme
- `isValidURL()` - URL dogrulama
- `safeLink()` - guvenli link olusturma

**ANCAK:** Denetlenen 10 dosyanin **hicbiri** SecurityUtils.js'i import etmiyor. Tum HTML olusturma islemleri template literal + `innerHTML` ile escape'siz yapiliyor.

### 3.2 Bulgular

#### X1 - KRITIK: DataTable.js - Tum Liste Sayfalarini Etkiler

**Dosya:** `public/assets/js/components/DataTable.js`

DataTable tum liste sayfalari tarafindan kullanildigi icin en kritik bulgu. `formatValue()` metodundaki tum tur handler'lari escape'siz:

| Satir | Tur | Savunmasiz Kod | Payload |
|-------|-----|----------------|---------|
| ~545 | badge | `<span class="badge">${value}</span>` | `<img src=x onerror=alert(1)>` |
| ~549 | image | `<img src="${value}">` | `" onerror="alert(document.cookie)` |
| ~566 | link | `<a href="${value}">${value}</a>` | `javascript:alert(1)` |
| ~570 | email | `<a href="mailto:${value}">${value}</a>` | `"><script>alert(1)</script>` |
| ~576 | phone | `<a href="tel:${value}">${value}</a>` | `"><script>alert(1)</script>` |
| ~591 | tags | `<span class="badge">${tag}</span>` | Array icinde script |
| ~385 | cell | `<td>${cellContent}</td>` | Tum kolon render ciktilari |
| ~436 | card | `${this.getNestedValue(row, titleCol.key)}` | Kart baslik alani |

#### X2 - YUKSEK: Modal.js - Merkezi Modal Bileseni

**Dosya:** `public/assets/js/components/Modal.js`

| Satir | Parametre | Savunmasiz Kod |
|-------|-----------|----------------|
| ~97 | title | `<h3 class="modal-title">${title}</h3>` |
| ~148 | content | `innerHTML = ...${content}...` |
| ~397 | message | `<p>${message}</p>` |
| ~453 | defaultValue | `value="${defaultValue}"` (attribute injection) |

#### X3 - YUKSEK: Toast.js - Bildirim Bileseni

**Dosya:** `public/assets/js/components/Toast.js`

| Satir | Parametre | Savunmasiz Kod |
|-------|-----------|----------------|
| ~105 | title | `<div class="toast-title">${title}</div>` |
| ~106 | message | `<div class="toast-message">${message}</div>` |
| ~189-217 | notification | API'den gelen bildirim verileri escape'siz (Stored XSS) |

#### X4 - YUKSEK: UserManagement.js

**Dosya:** `public/assets/js/pages/admin/UserManagement.js`

7+ enjeksiyon noktasi: kullanici adi, email, rol, sirket adi, avatar alt attribute. Ornek:

```javascript
// Satir ~107 - Stored XSS
`<span class="font-medium">${name || '-'}</span>`
// Payload: Kullanici adi "<script>alert(1)</script>" olarak kaydedilirse calisir
```

#### X5 - YUKSEK: CompanyManagement.js

**Dosya:** `public/assets/js/pages/admin/CompanyManagement.js`

8+ enjeksiyon noktasi: firma adi, kodu, email, telefon, adres. Tum detay modali alanlari escape'siz.

#### X6 - YUKSEK: ProductList.js

**Dosya:** `public/assets/js/pages/products/ProductList.js`

10+ enjeksiyon noktasi:
- Urun adi render (satir ~202)
- Barkod render (satir ~208)
- Import preview (satir ~1128) - **CSV dosyasindan XSS**
- Cover image (satir ~1481-1484) - attribute injection
- Cihaz/sablon adlari assign label modalinda (satir ~647-701)

#### X7 - ORTA: DeviceList.js

**Dosya:** `public/assets/js/pages/devices/DeviceList.js`

Kendi `escapeHtml()` metodu var (satir ~791) ancak tutarsiz kullaniliyor. Cihaz adi, grup adlari, form value attribute'lari korunmasiz.

#### X8 - ORTA: TemplateEditor.js

**Dosya:** `public/assets/js/pages/templates/TemplateEditor.js`

Sablon adi/aciklama attribute injection. Ancak `textContent` kullanan yerler **guvenli** (satir ~599-613).

### 3.3 Saldiri Senaryolari

1. **CSV Import ile Stored XSS:** Urun adi `<img src=x onerror=alert(document.cookie)>` iceren CSV yukle. Tum urun listesini goruntuleyenler etkilenir.

2. **Bildirim Sistemi ile Stored XSS:** Kotu amacli bildirim title/message API uzerinden olustur. Toast/NotificationDropdown ile tum kullanicilara yayilir.

3. **Firma Yonetimi:** Admin firma adina script enjekte et. Tum company selector dropdown'larinda calisir.

4. **Cihaz Kaydi:** ESL/PWA kayit sirasinda cihaz adina script enjekte et. DeviceList'te goruntulendiginde calisir.

---

## 4. CSRF (Cross-Site Request Forgery)

### 4.1 Bulgular

#### C1 - YUKSEK: Frontend CSRF Token Gondermiyor

**Dosya:** `public/assets/js/core/Api.js:68-102`

`Api.js` `request()` metodu hicbir istekte `X-CSRF-Token` header'i eklemiyor. `CsrfMiddleware` bu header'i bekliyor ancak frontend gondermediginden CSRF korumasinin fiilen calismadigi anlasilmaktadir.

#### C2 - YUKSEK: Session Cookie Guvenlik Flag'leri Eksik

**Dosya:** `config.php:182-185`

`session_set_cookie_params()` cagirilmiyor:
- `HttpOnly` garanti degil (PHP varsayilanlarina bagli)
- `Secure` flag yok (session cookie HTTP uzerinden gonderilir)
- `SameSite` acikca ayarlanmamis

#### C3 - DUSUK: CSRF Muaf Path'ler Prefix Matching

**Dosya:** `middleware/CsrfMiddleware.php:41-46`

```php
if (strpos($path, $exemptPath) === 0) {
```

`/api/auth/login-admin-panel` gibi yeni route'lar da muaf olur. Simdiki route'larda sorun yok ama kirilgan desen.

---

## 5. Rate Limiting

### 5.1 Bulgular

#### R1 - YUKSEK: Dosya Tabanli Rate Limit Race Condition

**Dosyalar:** `middleware/ApiGuardMiddleware.php:247-275`, `core/Security.php:84-110`

Rate limiting JSON dosyalari ile `file_get_contents` + `file_put_contents` kullanir. `LOCK_EX` sadece write'da, read'de kilit yok. TOCTOU (time-of-check-time-of-use) race condition:

1. Istek A dosyayi okur: count=99
2. Istek B dosyayi okur: count=99
3. Istek A yazma: count=100, gecir
4. Istek B yazma: count=100, gecir
5. Limit 100 iken 101 istek gecti

**Ek sorunlar:**
- Dosya tabanli depolama yuk altinda yavas
- Her IP+tip icin ayri dosya, disk doldurmasi riski
- Coklu web sunucu orneginde calismaz

#### R2 - ORTA: Hesap Bazli Lockout Yok

**Dosya:** `api/auth/login.php:21-24`

Rate limiting sadece IP bazli. Birden fazla IP kullanan saldirgan (botnet/proxy) sifre brute-force yapabilir. Hesap bazli kilit mekanizmasi (ornegin 10 basarisiz denemeden sonra hesabi kilitle) bulunmuyor.

---

## 6. Input Validation & Sanitization

### 6.1 Bulgular

#### I1 - YUKSEK: Genis Sanitization Muafiyetleri

**Dosya:** `middleware/InputSanitizeMiddleware.php:91-110`

Asagidaki route prefix'leri `strpos` ile tamamen muaf tutuluyor:

```php
$exemptPaths = [
    '/api/templates',      // Tum template endpoint'leri (list, create, update, delete)
    '/api/playlists',      // Tum playlist endpoint'leri
    '/api/schedules',      // Tum schedule endpoint'leri
    '/api/esl/',           // Public ESL endpoint'leri (register dahil!)
    '/api/player/',        // Public player endpoint'leri
    '/api/proxy/',         // SSRF riski olan proxy
    '/api/render-cache/',
    '/api/render-queue/',
];
```

`/api/esl/register` ve `/api/player/init` auth gerektirmeyen public endpoint'ler olup tamamen sanitization'dan muaf. Saldirgan bu endpoint'ler uzerinden SQL/XSS payload'lari gonderebilir.

#### I2 - ORTA: Genis skipFields Listesi

**Dosya:** `middleware/InputSanitizeMiddleware.php:45-80`

`content`, `html`, `template_content`, `url`, `file_path`, `items`, `image_base64` gibi alanlar tehdit tespitinden tamamen muaf. Saldirgan bu alan adlarini kullanarak payload gonderebilir.

#### I3 - ORTA: Regex Bypass Vektorleri

**Dosya:** `middleware/InputSanitizeMiddleware.php:16-39`

- Null byte (`%00`) ile SQL keyword tespiti atlatilabilir
- Unicode homoglyph'ler ile keyword tespiti atlatilabilir
- `%0a` (newline) ile komut enjeksiyonu mumkun
- `onload%09=` (tab) ile event handler tespiti atlatilabilir

#### I4 - DUSUK: SVG Upload Izni

**Dosya:** `api/media/upload.php:46`

`image/svg+xml` MIME tipi izinli. SVG dosyalari embedded JavaScript icerebilir. Orijinal MIME tipi ile sunulursa stored XSS.

---

## 7. Kimlik Dogrulama & Oturum

### 7.1 Bulgular

#### A1 - YUKSEK: JWT Token localStorage'da

**Dosya:** `public/assets/js/core/Api.js:23-47`

Erisim ve yenileme token'lari `localStorage`'da saklanir. Herhangi bir XSS acigi ile `localStorage.getItem()` cagrilarak her iki token da calinabilir. Refresh token 30 gun gecerli, saldirgana uzun sureli erisim saglar.

#### A2 - ORTA: Development JWT Secret Zayif

**Dosya:** `config.php:60`

```php
$jwtSecret = 'dev-only-secret-' . md5(__DIR__);
```

Dizin yolu bilinirse (tipik: `C:\xampp\htdocs\market-etiket-sistemi`) secret hesaplanabilir ve token forge edilebilir. Development ortami internete acilirsa tum kimlik dogrulama gecersiz.

#### A3 - ORTA: JWT Algorithm Dogrulanmiyor

**Dosya:** `core/Auth.php:73-98`

`validateToken()` JWT header'indaki `alg` alanini kontrol etmiyor. Mevcut custom implementasyon her zaman HMAC-SHA256 hesapladigi icin `none` algorithm saldirisi mumkun degil, ancak kutuphaneye geciste risk.

#### A4 - ORTA: Reset Token Plaintext Log

**Dosya:** `api/auth/forgot-password.php:29-33`

```php
Logger::info('Password reset requested', [
    'token' => $token   // Plaintext reset token log dosyasinda!
]);
```

Log dosyasina erisimi olan herkes herhangi bir kullanicinin sifresini sifirlayabilir.

#### A5 - ORTA: Reset Token Hash'lenmeden Saklanir

**Dosya:** `api/auth/forgot-password.php:22-25`

Reset token `users` tablosunda plaintext saklanir. Veritabani sizintisinda suresi dolmamis token'lar kullanilabilir.

### 7.2 Olumlu Bulgular

- **Kullanici enumeration korunuyor:** Login'de "Gecersiz e-posta veya sifre" mesaji hem gecersiz kullanici hem yanlis sifre icin ayni (login.php:34-42)
- **Forgot password enumeration yok:** Her zaman basari doner (forgot-password.php:36)
- **Password hashing tutarli:** Argon2ID (memory: 64MB, time: 4, threads: 3) tum dosyalarda `Auth::hashPassword()` ile (Auth.php:286-291)
- **Refresh token rotation:** Eski session siliniyor, yeni token olusturuluyor (Auth.php:104-140)

---

## 8. CORS & Ag Guvenligi

### 8.1 Bulgular

#### N1 - ORTA: CORS Preflight Herhangi Bir Origin Kabul Ediyor

**Dosya:** `middleware/ApiGuardMiddleware.php:289-295`

```php
public static function handlePreflight(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    self::setCorsHeaders($origin);  // Herhangi bir origin reflect ediliyor
    // + Access-Control-Allow-Credentials: true
}
```

Preflight response'u `ApiGuardMiddleware::handle()` cagrilmadan ONCE dondurulur. Kotu amacli site cross-origin credentialed istek yapabilir.

#### N2 - ORTA: X-Forwarded-Proto Guvensiz

**Dosya:** `api/index.php:72`

`HTTP_X_FORWARDED_PROTO` dogrulanmadan kabul ediliyor. Reverse proxy arkasinda degilse saldirgan `X-Forwarded-Proto: https` header'i ile HTTPS redirect'i atlayabilir.

#### N3 - ORTA: ESL Gateway Route'lari Auth'suz

**Dosya:** `api/index.php:910-955`

`/api/esl-gateway/*` route grubu hicbir middleware uygulanmadan acik:
- `/scan` - Dahili ag taramasi
- `/upload` - ESL cihazlarina dosya yukleme
- `/sync` - Senkronizasyon islemleri

#### N4 - ORTA: Proxy Endpoint SSRF

**Dosya:** `api/index.php:1308-1313`

`/api/proxy/fetch` auth middleware olmadan acik. Sunucu uzerinden dahili servislere, cloud metadata endpoint'lerine (169.254.169.254) istek gonderme mumkun.

#### N5 - ORTA: Error Catch Bilgi Sizintisi

**Dosya:** `api/index.php:1386-1396`

```php
} catch (Error $e) {
    echo json_encode([
        'message' => 'Fatal error: ' . $e->getMessage(),
        'file' => $e->getFile(),   // Production'da bile sizdirilir!
        'line' => $e->getLine()
    ]);
}
```

`Error` catch blogu PRODUCTION_MODE kontrolu yapmiyor. Windows'ta `C:\xampp\htdocs\market-etiket-sistemi\...` gibi tam dosya yolunu ifsa eder.

---

## 9. Logging & Monitoring

### 9.1 Bulgular

#### L1 - DUSUK: Basarisiz Login Audit Log'a Yazilmiyor

**Dosya:** `api/auth/login.php:35,41`, `core/Logger.php`

Basarisiz login denemeleri `Logger::warning()` ile dosyaya loglaniyor ancak `audit_logs` tablosuna yazilmiyor. Admin paneldeki Islem Gecmisi sayfasindan gorunmez. Brute-force tespiti icin log dosyalarinin manuel incelenmesi gerekir.

---

## 10. Ozet Tablo

| # | Bulgu | Seviye | Dosya | Durum |
|---|-------|--------|-------|-------|
| S1 | Validator unique/exists SQLi | KRITIK | core/Validator.php | ACIK |
| X1 | DataTable sistemik XSS (60+ nokta) | KRITIK | components/DataTable.js | ACIK |
| X2 | Modal.js XSS | YUKSEK | components/Modal.js | ACIK |
| X3 | Toast.js Stored XSS | YUKSEK | components/Toast.js | ACIK |
| X4 | UserManagement XSS | YUKSEK | admin/UserManagement.js | ACIK |
| X5 | CompanyManagement XSS | YUKSEK | admin/CompanyManagement.js | ACIK |
| X6 | ProductList XSS (CSV import dahil) | YUKSEK | products/ProductList.js | ACIK |
| C1 | CSRF token frontend'de yok | YUKSEK | core/Api.js | ACIK |
| C2 | Session cookie flag'leri eksik | YUKSEK | config.php | ACIK |
| A1 | JWT localStorage (XSS ile theft) | YUKSEK | core/Api.js | ACIK |
| I1 | Sanitization muafiyetleri genis | YUKSEK | InputSanitizeMiddleware.php | ACIK |
| R1 | Rate limit race condition | YUKSEK | ApiGuardMiddleware.php | ACIK |
| N1 | CORS preflight bypass | ORTA | ApiGuardMiddleware.php | ACIK |
| N2 | X-Forwarded-Proto trust | ORTA | api/index.php | ACIK |
| N3 | ESL Gateway auth'suz | ORTA | api/index.php | ACIK |
| N4 | Proxy SSRF | ORTA | api/index.php | ACIK |
| N5 | Error info leak (production) | ORTA | api/index.php | ACIK |
| A2 | Dev JWT secret zayif | ORTA | config.php | ACIK |
| A3 | JWT alg dogrulanmiyor | ORTA | core/Auth.php | ACIK |
| A4 | Reset token plaintext log | ORTA | forgot-password.php | ACIK |
| A5 | Reset token unhashed DB | ORTA | forgot-password.php | ACIK |
| R2 | Hesap bazli lockout yok | ORTA | login.php | ACIK |
| I2 | skipFields listesi genis | ORTA | InputSanitizeMiddleware.php | ACIK |
| I3 | Regex bypass vektorleri | ORTA | InputSanitizeMiddleware.php | ACIK |
| X7 | DeviceList tutarsiz escaping | ORTA | devices/DeviceList.js | ACIK |
| X8 | TemplateEditor attribute injection | ORTA | templates/TemplateEditor.js | ACIK |
| C3 | CSRF prefix matching | DUSUK | CsrfMiddleware.php | ACIK |
| I4 | SVG upload XSS | DUSUK | media/upload.php | ACIK |
| L1 | Failed auth audit log eksik | DUSUK | login.php | ACIK |
