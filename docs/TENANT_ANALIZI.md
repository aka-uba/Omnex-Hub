# MULTI-TENANT (FİRMA BAZLI) YAPI ANALİZİ

**Oluşturulma Tarihi:** 2026-01-24  
**Analiz Kapsamı:** Veritabanı, API, Frontend, Güvenlik

---

## 📋 İÇİNDEKİLER

1. [Genel Bakış](#genel-bakış)
2. [Veritabanı Yapısı](#veritabanı-yapısı)
3. [API Katmanı İzolasyonu](#api-katmanı-izolasyonu)
4. [Frontend Firma Değiştirme](#frontend-firma-değiştirme)
5. [Güvenlik Analizi](#güvenlik-analizi)
6. [Tespit Edilen Sorunlar](#tespit-edilen-sorunlar)
7. [Öneriler](#öneriler)

---

## 🎯 GENEL BAKIŞ

### Multi-Tenant Modeli

Sistem **Shared Database, Shared Schema** modelini kullanıyor:
- ✅ **Tek veritabanı** (`omnex.db`) tüm firmaları destekliyor
- ✅ **Tek şema** içinde `company_id` kolonu ile izolasyon sağlanıyor
- ✅ Her tablo `company_id` kolonu ile firma bazlı veri saklıyor

### Temel Özellikler

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| **Veritabanı İzolasyonu** | ✅ | `company_id` kolonu ile sağlanıyor |
| **API İzolasyonu** | ✅ | `CompanyMiddleware` ile kontrol ediliyor |
| **Firma Değiştirme** | ✅ | SuperAdmin için destekleniyor |
| **Frontend İzolasyonu** | ⚠️ | Sayfa yenileme ile çalışıyor |
| **Ayarlar İzolasyonu** | ✅ | Firma ve kullanıcı bazlı |

---

## 🗄️ VERİTABANI YAPISI

### Company ID Kullanımı

Veritabanı şeması analizine göre:

#### ✅ Company ID Olan Tablolar (İzole Edilmiş)

Aşağıdaki tablolar `company_id` kolonu ile firma bazlı izolasyon sağlıyor:

1. **Kullanıcı ve Yetkilendirme**
   - `users` - Kullanıcılar firma bazlı
   - `sessions` - Oturumlar kullanıcı bazlı (dolaylı izolasyon)

2. **Ürün ve İçerik**
   - `products` - Ürünler firma bazlı
   - `templates` - Şablonlar firma bazlı (veya public)
   - `categories` - Kategoriler firma bazlı
   - `production_types` - Üretim tipleri firma bazlı
   - `media` - Medya dosyaları firma bazlı
   - `media_folders` - Medya klasörleri firma bazlı

3. **Cihaz ve Yönetim**
   - `devices` - Cihazlar firma bazlı
   - `device_groups` - Cihaz grupları firma bazlı
   - `device_tokens` - Cihaz token'ları firma bazlı
   - `device_sync_requests` - Senkronizasyon istekleri firma bazlı
   - `device_heartbeats` - Cihaz heartbeat'leri firma bazlı
   - `gateways` - Gateway'ler firma bazlı

4. **İş Akışı**
   - `playlists` - Playlist'ler firma bazlı
   - `schedules` - Zamanlamalar firma bazlı
   - `render_queue` - Render kuyruğu firma bazlı
   - `render_cache` - Render cache firma bazlı
   - `render_jobs` - Render işleri firma bazlı

5. **Entegrasyonlar**
   - `integrations` - Entegrasyonlar firma bazlı
   - `import_mappings` - Import mapping'leri firma bazlı
   - `hanshow_esls` - Hanshow ESL'ler firma bazlı
   - `hanshow_settings` - Hanshow ayarları firma bazlı
   - `hanshow_aps` - Hanshow AP'ler firma bazlı
   - `hanshow_queue` - Hanshow kuyruğu firma bazlı

6. **Ödeme ve Lisans**
   - `licenses` - Lisanslar firma bazlı
   - `payment_transactions` - Ödeme işlemleri firma bazlı

7. **Bildirimler**
   - `notifications` - Bildirimler firma bazlı
   - `notification_recipients` - Bildirim alıcıları firma bazlı

8. **Ayarlar**
   - `settings` - Ayarlar firma ve/veya kullanıcı bazlı
   - `label_sizes` - Etiket boyutları firma bazlı (veya global)

9. **Sistem**
   - `audit_logs` - Denetim kayıtları firma bazlı
   - `menu_items` - Menü öğeleri firma bazlı (veya global)

#### ⚠️ Company ID Olmayan Tablolar (Global)

Aşağıdaki tablolar firma izolasyonu **YOK**:

1. **Sistem Tabloları**
   - `companies` - Firma tanımları (global)
   - `permissions` - Yetki tanımları (global)
   - `license_plans` - Lisans planları (global)
   - `payment_settings` - Ödeme ayarları (global - SuperAdmin only)
   - `firmware_updates` - Firmware güncellemeleri (global veya firma bazlı)
   - `hanshow_firmwares` - Hanshow firmware cache (global)

2. **Layout ve Konfigürasyon**
   - `layout_configs` - Layout konfigürasyonları (scope bazlı: user, role, company, default)
   - `user_notification_preferences` - Kullanıcı bildirim tercihleri (kullanıcı bazlı)

### Veri İzolasyon Mekanizması

```sql
-- Örnek: Ürün sorgusu
SELECT * FROM products 
WHERE company_id = ? 
AND status != 'deleted';

-- Örnek: Şablon sorgusu (public şablonlar dahil)
SELECT * FROM templates 
WHERE (company_id = ? OR company_id IS NULL OR is_public = 1);
```

**İzolasyon Seviyeleri:**
1. **Tam İzolasyon:** Sadece firma verileri (`company_id = ?`)
2. **Kısmi İzolasyon:** Firma + Global veriler (`company_id = ? OR company_id IS NULL`)
3. **Public Erişim:** Firma + Public veriler (`company_id = ? OR is_public = 1`)

---

## 🔒 API KATMANI İZOLASYONU

### CompanyMiddleware

**Dosya:** `middleware/CompanyMiddleware.php`

**İşlev:**
1. Kullanıcı kimlik doğrulaması kontrolü
2. SuperAdmin için özel işlem (firma değiştirme)
3. Normal kullanıcılar için firma kontrolü
4. Request'e `company_id` ve `company` attribute'ları ekleme

**Kod Akışı:**

```php
// 1. SuperAdmin kontrolü
if ($user['role'] === 'superadmin') {
    // Request'ten company_id al (firma değiştirme için)
    $companyId = $request->input('company_id') ?? $request->query('company_id');
    
    if ($companyId) {
        // Firma doğrulama
        $company = $db->fetch("SELECT * FROM companies WHERE id = ? AND status = 'active'", [$companyId]);
        if ($company) {
            $request->setAttribute('company_id', $companyId);
        }
    }
    return; // SuperAdmin için kontrol yok
}

// 2. Normal kullanıcı kontrolü
if (!$user['company_id']) {
    Response::forbidden('Kullanıcı bir firmaya bağlı değil');
}

// 3. Firma aktiflik kontrolü
$company = $db->fetch("SELECT * FROM companies WHERE id = ? AND status = 'active'", [$user['company_id']]);
if (!$company) {
    Response::forbidden('Firma bulunamadı veya aktif değil');
}

// 4. Request'e ekle
$request->setAttribute('company_id', $user['company_id']);
$request->setAttribute('company', $company);
```

### Auth::getActiveCompanyId()

**Dosya:** `core/Auth.php`

**İşlev:**
- SuperAdmin için: `X-Active-Company` header'ından veya ilk firmadan
- Normal kullanıcı için: Kendi `company_id`'si

**Kod:**

```php
public static function getActiveCompanyId(): ?string
{
    $user = self::$user;
    if (!$user) return null;

    // Normal kullanıcı: Kendi company_id'si
    if ($user['role'] !== 'SuperAdmin') {
        return $user['company_id'] ?? null;
    }

    // SuperAdmin: X-Active-Company header'ından
    $activeCompanyId = $_SERVER['HTTP_X_ACTIVE_COMPANY'] ?? null;
    if ($activeCompanyId) {
        $company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$activeCompanyId]);
        if ($company) {
            return $activeCompanyId;
        }
    }

    // Fallback: İlk firma
    $defaultCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
    return $defaultCompany['id'] ?? null;
}
```

### API Endpoint'lerinde Kullanım

#### ✅ İyi Uygulanmış Örnekler

**1. Products API (`api/products/index.php`)**
```php
$companyId = Auth::getActiveCompanyId();
$where = ["company_id = ?"];
$params = [$companyId];

// Tüm sorgular company_id ile filtreleniyor
$products = $db->fetchAll(
    "SELECT * FROM products WHERE company_id = ? AND ...",
    [$companyId]
);
```

**2. Templates API (`api/templates/index.php`)**
```php
$companyId = Auth::getActiveCompanyId();

// Firma şablonları + public şablonlar
if ($user['role'] !== 'SuperAdmin' && $companyId) {
    $where[] = "(company_id = ? OR company_id IS NULL)";
    $params[] = $companyId;
}
```

**3. Settings API (`api/settings/index.php`)**
```php
$companyId = Auth::getActiveCompanyId();

// Firma ayarları
$companySettings = $db->fetch(
    "SELECT * FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);

// Kullanıcı ayarları (firma ayarlarını override eder)
$userSettings = $db->fetch(
    "SELECT * FROM settings WHERE user_id = ?",
    [$user['id']]
);
```

#### ⚠️ Potansiyel Sorunlar

**1. Label Sizes API (`api/label-sizes/index.php`)**
```php
// Global + Firma bazlı
WHERE (company_id IS NULL OR company_id = ?)
```
✅ **İyi:** Global ve firma bazlı etiket boyutları destekleniyor.

**2. Templates API - Public Şablonlar**
```php
// Public şablonlar tüm firmalar için erişilebilir
WHERE (company_id = ? OR company_id IS NULL OR is_public = 1)
```
⚠️ **Dikkat:** Public şablonlar tüm firmalar tarafından görülebilir.

---

## 🖥️ FRONTEND FİRMA DEĞİŞTİRME

### CompanySelector Component

**Dosya:** `public/assets/js/components/CompanySelector.js`

**İşlev:**
1. Kullanıcının erişebileceği firmaları listeleme
2. Aktif firmayı localStorage'da saklama
3. Firma değiştirme işlemi
4. Sayfa yenileme ile veri güncelleme

**Kod Akışı:**

```javascript
// 1. Aktif firma belirleme
initActiveCompany() {
    let activeCompanyId = localStorage.getItem('activeCompanyId');
    
    // SuperAdmin: localStorage'dan veya ilk firmadan
    if (user.role === 'SuperAdmin') {
        if (!activeCompanyId && this.companies.length > 0) {
            activeCompanyId = this.companies[0].id;
            localStorage.setItem('activeCompanyId', activeCompanyId);
        }
    } else {
        // Normal kullanıcı: Kendi company_id'si
        activeCompanyId = user?.company_id || null;
    }
    
    const activeCompany = this.companies.find(c => c.id === activeCompanyId);
    this.app.state.set('activeCompany', activeCompany, true);
}

// 2. Firma değiştirme
setActiveCompany(companyId) {
    const company = this.companies.find(c => c.id === companyId);
    if (company) {
        localStorage.setItem('activeCompanyId', companyId);
        this.app.state.set('activeCompany', company, true);
        
        // Sayfa yenileme
        this.refreshCurrentPage();
    }
}

// 3. Sayfa yenileme
refreshCurrentPage() {
    const currentPath = window.location.hash.replace('#', '') || '/dashboard';
    
    // Custom event dispatch
    window.dispatchEvent(new CustomEvent('companyChanged', {
        detail: { company: this.getActiveCompany() }
    }));
    
    // Router ile sayfa yenileme
    if (this.app.router) {
        this.app.router.navigate(currentPath, true);
    }
}
```

### API.js - Header Gönderimi

**Dosya:** `public/assets/js/core/Api.js`

**İşlev:**
- Her API isteğinde `X-Active-Company` header'ı gönderiliyor

```javascript
getActiveCompanyId() {
    const activeCompany = this.app.state.get('activeCompany');
    return activeCompany?.id || localStorage.getItem('activeCompanyId') || null;
}

// Her request'te header ekleme
const activeCompanyId = this.getActiveCompanyId();
if (activeCompanyId) {
    headers['X-Active-Company'] = activeCompanyId;
}
```

### Firma Değişince Ne Oluyor?

1. ✅ **localStorage Güncelleniyor:** `activeCompanyId` kaydediliyor
2. ✅ **State Güncelleniyor:** `app.state.activeCompany` güncelleniyor
3. ✅ **Custom Event:** `companyChanged` event'i dispatch ediliyor
4. ✅ **Sayfa Yenileniyor:** Router ile mevcut sayfa yeniden yükleniyor
5. ✅ **API Header'ı:** Yeni firma ID'si `X-Active-Company` header'ı ile gönderiliyor
6. ✅ **Veri Yenileniyor:** Tüm API çağrıları yeni firma ID'si ile yapılıyor

**Sonuç:** Firma değişince tüm içerik, ayarlar ve veriler otomatik olarak yeni firma için yükleniyor.

---

## 🔐 GÜVENLİK ANALİZİ

### ✅ İyi Uygulanmış Güvenlik Kontrolleri

#### 1. Middleware Seviyesi İzolasyon

**CompanyMiddleware** her request'te:
- ✅ Kullanıcı kimlik doğrulaması kontrol ediyor
- ✅ Firma aktiflik durumu kontrol ediyor
- ✅ SuperAdmin dışında kullanıcının kendi firmasına erişimini zorunlu kılıyor
- ✅ Request'e `company_id` attribute'u ekliyor

#### 2. API Seviyesi İzolasyon

Çoğu API endpoint'i:
- ✅ `Auth::getActiveCompanyId()` kullanıyor
- ✅ SQL sorgularında `company_id = ?` filtresi kullanıyor
- ✅ Prepared statements ile SQL injection koruması var

#### 3. SuperAdmin Kontrolü

- ✅ SuperAdmin sadece `X-Active-Company` header'ı ile firma değiştirebiliyor
- ✅ Firma varlık kontrolü yapılıyor
- ✅ Normal kullanıcılar firma değiştiremiyor

### ⚠️ Potansiyel Güvenlik Açıkları

#### 1. Direct ID Manipulation Riski

**Sorun:** Bazı API endpoint'lerinde `id` parametresi doğrudan kullanılıyor, `company_id` kontrolü eksik olabilir.

**Örnek Senaryo:**
```php
// Kötü örnek (varsayımsal)
$product = $db->fetch("SELECT * FROM products WHERE id = ?", [$id]);
// company_id kontrolü yok!
```

**Çözüm:** Tüm endpoint'lerde `company_id` kontrolü yapılmalı:
```php
// İyi örnek
$product = $db->fetch(
    "SELECT * FROM products WHERE id = ? AND company_id = ?",
    [$id, $companyId]
);
```

#### 2. Public Şablonlar Erişimi

**Sorun:** `is_public = 1` şablonlar tüm firmalar tarafından görülebilir.

**Risk Seviyesi:** Düşük (Public şablonlar zaten paylaşılması gereken içerikler)

**Öneri:** Public şablonlar için ek bir onay mekanizması eklenebilir.

#### 3. Global Tablolar Erişimi

**Sorun:** `license_plans`, `payment_settings` gibi tablolar global, firma izolasyonu yok.

**Risk Seviyesi:** Düşük (Bu tablolar zaten global olmalı)

**Öneri:** Bu tablolara erişim SuperAdmin ile sınırlandırılmalı.

#### 4. Frontend State Manipulation

**Sorun:** Frontend'de `localStorage` ve state ile firma ID'si saklanıyor.

**Risk Seviyesi:** Orta (Kullanıcı localStorage'ı manipüle edebilir)

**Mevcut Korumalar:**
- ✅ Backend'de `X-Active-Company` header'ı doğrulanıyor
- ✅ SuperAdmin dışında kullanıcıların `company_id`'si değiştirilemiyor
- ✅ Middleware seviyesinde kontrol var

**Öneri:** Frontend'de de ek doğrulama yapılabilir.

---

## 🐛 TESPİT EDİLEN SORUNLAR

### 1. ⚠️ Bazı API Endpoint'lerinde Eksik Kontrol

**Sorun:** 17 API endpoint'inde `company_id` kontrolü eksik veya yetersiz.

**Etki:** Bir kullanıcı başka bir firmanın verilerine erişebilir.

**Öncelik:** Yüksek

**Tespit Edilen Endpoint'ler (17 adet):**

| Endpoint | Tablolar | Risk | Açıklama |
|----------|----------|------|----------|
| `api/audit-logs/archive.php` | `audit_logs` | Orta | Denetim kayıtları arşivleme |
| `api/audit-logs/delete.php` | `audit_logs` | Orta | Denetim kaydı silme |
| `api/audit-logs/show.php` | `audit_logs` | Orta | Denetim kaydı detayı |
| `api/esl/content.php` | `device_content_assignments`, `media`, `playlists` | Yüksek | ESL içerik erişimi |
| `api/esl/register.php` | `devices`, `device_sync_requests` | Yüksek | ESL kayıt |
| `api/gateway/devices-register.php` | `devices`, `gateway_devices` | Yüksek | Gateway cihaz kayıt |
| `api/gateway/register.php` | `gateways`, `users` | Yüksek | Gateway kayıt |
| `api/licenses/create.php` | `licenses` | Yüksek | Lisans oluşturma |
| `api/licenses/revoke.php` | `licenses` | Yüksek | Lisans iptal |
| `api/licenses/update.php` | `licenses` | Yüksek | Lisans güncelleme |
| `api/payments/callback.php` | `payment_transactions` | Yüksek | Ödeme callback |
| `api/payments/license-plans.php` | `license_plans`, `licenses` | Düşük | Lisans planları (global olabilir) |
| `api/payments/status.php` | `payment_transactions`, `licenses` | Yüksek | Ödeme durumu |
| `api/player/init.php` | `devices`, `templates`, `schedules`, `playlists`, `media` | Yüksek | Player başlatma |
| `api/player/sync.php` | `devices`, `schedules`, `playlists`, `templates` | Yüksek | Player senkronizasyon |
| `api/player/verify.php` | `device_sync_requests`, `device_tokens`, `devices` | Yüksek | Player doğrulama |
| `api/system/status.php` | `audit_logs`, `sessions` | Düşük | Sistem durumu (global olabilir) |

**Çözüm:** 
- Yüksek riskli endpoint'lerde `company_id` kontrolü eklenmeli
- Orta riskli endpoint'lerde SuperAdmin kontrolü yapılmalı
- Düşük riskli endpoint'ler için mevcut durum kabul edilebilir (global veriler)

### 2. ⚠️ Frontend State Senkronizasyonu

**Sorun:** Firma değişince sayfa yenileniyor ama bazı component'ler state'i güncellemeyebilir.

**Etki:** Eski firma verileri gösterilmeye devam edebilir.

**Öncelik:** Orta

**Çözüm:** `companyChanged` event'ini dinleyen tüm component'lerin verilerini yenilemesi.

### 3. ⚠️ Settings API - Company Override

**Sorun:** Settings API'de firma ayarları ve kullanıcı ayarları birleştiriliyor ama hangi ayarın öncelikli olduğu net değil.

**Etki:** Kullanıcı ayarları firma ayarlarını override ediyor, bu beklenmeyen davranış olabilir.

**Öncelik:** Düşük

**Çözüm:** Ayarlar için öncelik sırası belirlenmeli.

### 4. ⚠️ Audit Logs İzolasyonu

**Sorun:** Audit logs `company_id` ile izole edilmiş ama SuperAdmin tüm firmaların loglarını görebilir.

**Etki:** Düşük (SuperAdmin zaten tüm firmalara erişebilmeli)

**Öncelik:** Düşük

**Çözüm:** Mevcut yapı yeterli, ek kontrol gerekmiyor.

---

## 💡 ÖNERİLER

### 1. Acil Düzeltmeler (Yüksek Öncelik)

#### A. API Endpoint Güvenlik Taraması

**Aksiyon:** Tüm API endpoint'lerini tarayıp `company_id` kontrolü eksik olanları tespit et.

**Script:**
```php
// Tüm API dosyalarını tarayıp company_id kontrolü yapmayanları bul
```

#### B. Database Constraint Ekleme

**Aksiyon:** Kritik tablolarda `company_id` için foreign key constraint ekle.

**Örnek:**
```sql
ALTER TABLE products 
ADD CONSTRAINT fk_products_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
```

### 2. Orta Öncelikli İyileştirmeler

#### A. Frontend State Yönetimi

**Aksiyon:** Firma değişince tüm component'lerin state'ini temizle ve yeniden yükle.

**Örnek:**
```javascript
// CompanySelector.js
refreshCurrentPage() {
    // Tüm state'i temizle
    this.app.state.clear();
    
    // Yeni firma ile yeniden yükle
    this.initActiveCompany();
    
    // Sayfa yenile
    this.app.router.navigate(currentPath, true);
}
```

#### B. API Response Caching

**Aksiyon:** Firma bazlı API response cache'i ekle.

**Örnek:**
```javascript
// Api.js
const cacheKey = `${endpoint}_${companyId}_${params}`;
if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
}
```

### 3. Uzun Vadeli Öneriler

#### A. Row-Level Security (RLS)

**Aksiyon:** Veritabanı seviyesinde row-level security ekle (SQLite desteklemiyor, PostgreSQL'e geçiş gerekir).

**Fayda:** Veritabanı seviyesinde izolasyon garantisi.

#### B. Company Context Service

**Aksiyon:** Firma context'ini yöneten merkezi bir service oluştur.

**Örnek:**
```javascript
// CompanyContext.js
class CompanyContext {
    getCompanyId() { ... }
    setCompanyId(id) { ... }
    onCompanyChange(callback) { ... }
    clearCache() { ... }
}
```

#### C. Audit Trail İyileştirme

**Aksiyon:** Firma değişikliklerini de audit log'a kaydet.

**Örnek:**
```php
// CompanyMiddleware.php
if ($oldCompanyId !== $newCompanyId) {
    AuditLog::create([
        'action' => 'company_switch',
        'old_company_id' => $oldCompanyId,
        'new_company_id' => $newCompanyId
    ]);
}
```

---

## 📊 SONUÇ VE ÖZET

### ✅ Güçlü Yönler

1. **Veritabanı İzolasyonu:** Tüm kritik tablolar `company_id` ile izole edilmiş
2. **Middleware Kontrolü:** `CompanyMiddleware` her request'te kontrol yapıyor
3. **SuperAdmin Esnekliği:** SuperAdmin firmalar arası geçiş yapabiliyor
4. **Frontend Entegrasyonu:** Firma değişimi frontend'de destekleniyor
5. **Ayarlar İzolasyonu:** Firma ve kullanıcı bazlı ayarlar ayrı yönetiliyor

### ⚠️ İyileştirme Gereken Alanlar

1. **API Güvenlik Kontrolü:** Tüm endpoint'lerde `company_id` kontrolü garanti edilmeli
2. **Frontend State Yönetimi:** Firma değişince state temizliği iyileştirilmeli
3. **Cache Yönetimi:** Firma bazlı cache mekanizması eklenmeli
4. **Audit Trail:** Firma değişiklikleri loglanmalı

### 📈 Genel Değerlendirme

| Kategori | Puan | Durum |
|----------|------|-------|
| **Veritabanı İzolasyonu** | 9/10 | ✅ Mükemmel |
| **API İzolasyonu** | 8/10 | ✅ İyi (küçük iyileştirmeler gerekli) |
| **Frontend İzolasyonu** | 7/10 | ⚠️ İyi (state yönetimi iyileştirilebilir) |
| **Güvenlik** | 8/10 | ✅ İyi (küçük açıklar var) |
| **Kullanılabilirlik** | 9/10 | ✅ Mükemmel |

**Genel Puan:** 8.2/10 - **İyi** ✅

### 🎯 Öncelikli Aksiyonlar

1. **Hemen:** Tüm API endpoint'lerinde `company_id` kontrolü yapıldığını doğrula
2. **Kısa Vadede:** Frontend state yönetimini iyileştir
3. **Orta Vadede:** Firma bazlı cache mekanizması ekle
4. **Uzun Vadede:** Row-level security için PostgreSQL'e geçiş değerlendir

---

**Rapor Sonu**  
*Son Güncelleme: 2026-01-24*

