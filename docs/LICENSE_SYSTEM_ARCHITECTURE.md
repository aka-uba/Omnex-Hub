# OMNEX DISPLAY HUB - LISANS SISTEMI MIMARISI

**Analiz Tarihi:** 2026-02-05
**Guncelleme Tarihi:** 2026-02-05
**Surum:** v2.0.17

---

## OZET

Omnex Display Hub lisans sistemi, plan bazli abonelik yonetimi saglar. Firma bazli kullanici, cihaz, depolama, sube ve sablon limitleri kontrol edilir.

**DURUM:** Kritik sorunlar duzeltildi. Odeme -> lisans aktivasyonu akisi artik calisiyor.

---

## 1. VERITABANI YAPISI

### 1.1 licenses Tablosu

```sql
CREATE TABLE licenses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    license_key TEXT UNIQUE,
    plan_id TEXT,                    -- license_plans.id referansi
    valid_from TEXT,                 -- Baslangic tarihi
    valid_until TEXT,                -- Bitis tarihi (NULL = sinirsiz)
    auto_renew INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',    -- active|expired|revoked|suspended
    features TEXT,                   -- JSON
    external_id TEXT,                -- Odeme transaction ID
    last_validated TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### 1.2 license_plans Tablosu

```sql
CREATE TABLE license_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    plan_type TEXT,                  -- free|starter|business|professional|enterprise|ultimate
    price INTEGER,                   -- Kurus cinsinden (TL * 100)
    duration_months INTEGER,
    max_users INTEGER DEFAULT -1,    -- -1 = sinirsiz
    max_devices INTEGER DEFAULT -1,
    max_products INTEGER DEFAULT -1,
    max_templates INTEGER DEFAULT -1,
    max_branches INTEGER DEFAULT -1,
    max_storage INTEGER DEFAULT -1,  -- MB cinsinden
    is_unlimited INTEGER DEFAULT 0,  -- Plan sinirsiz mi?
    features TEXT,                   -- JSON array
    is_active INTEGER DEFAULT 1,
    is_popular INTEGER DEFAULT 0,
    is_enterprise INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
```

### 1.3 payment_settings Tablosu

```sql
CREATE TABLE payment_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    provider TEXT,                   -- 'iyzico' veya 'paynet'
    is_active INTEGER DEFAULT 0,
    is_test_mode INTEGER DEFAULT 1,
    publishable_key TEXT,
    secret_key TEXT,
    api_key TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### 1.4 payment_transactions Tablosu

```sql
CREATE TABLE payment_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT,
    transaction_type TEXT,           -- license_purchase, renewal, upgrade
    reference_id TEXT,               -- Gateway transaction ID
    plan_id TEXT,                    -- Dogrudan plan referansi
    amount INTEGER,                  -- Kurus cinsinden
    currency TEXT DEFAULT 'TRY',
    payment_method TEXT,
    status TEXT,                     -- pending|success|failed|refunded
    provider TEXT,                   -- 'iyzico' veya 'paynet'
    metadata TEXT,                   -- JSON: { plan_name, duration_months, ... }
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (plan_id) REFERENCES license_plans(id)
);
```

---

## 2. API ENDPOINT'LERI

### 2.1 Lisans Yonetimi

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| /api/licenses | GET | Lisans listesi (plan bilgileri dahil) |
| /api/licenses | POST | Yeni lisans olustur |
| /api/licenses/:id | PUT | Lisans guncelle |
| /api/licenses/:id/revoke | POST | Lisans iptal et |

### 2.2 Lisans Planlari

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| /api/license-plans | GET | Plan listesi |
| /api/license-plans | POST | Yeni plan olustur |
| /api/license-plans/:id | PUT | Plan guncelle |
| /api/license-plans/:id | DELETE | Plan sil |

### 2.3 Odeme Islemleri

| Endpoint | Method | Aciklama |
|----------|--------|----------|
| /api/payments/plans | GET | Aktif planlar |
| /api/payments/settings | GET/PUT | Provider ayarlari |
| /api/payments/ping | GET | Baglanti testi |
| /api/payments/init | POST | Odeme baslat |
| /api/payments/callback | POST | Gateway callback |
| /api/payments/callback-3d | POST | 3D Secure callback |
| /api/payments/status/:id | GET | Islem durumu |
| /api/payments/history | GET | Islem gecmisi |

---

## 3. SERVIS KATMANI

### 3.1 LicenseService.php

**Konum:** `services/LicenseService.php`

**Temel Metodlar:**

| Metod | Aciklama |
|-------|----------|
| `getCompanyLicense($companyId)` | Firma lisansini getir (plan dahil, cache'li) |
| `isLicenseValid($companyId)` | Lisans gecerli mi? (salt-okunur) |
| `checkLimit($companyId, $limitType)` | Limit kontrolu (users, devices, vb.) |
| `getLimit($companyId, $limitType)` | Belirli bir limit degerini al |
| `getAllLimitsWithUsage($companyId)` | Tum limitler ve kullanim (optimize edilmis) |
| `isUnlimitedValue($value)` | Sinirsiz mi? (-1, 0, null) |
| `markExpiredLicenses()` | Suresi dolmus lisanslari expired yap (cron) |
| `canCreateBranch($companyId)` | Sube limiti kontrolu |
| `canCreateUser($companyId)` | Kullanici limiti kontrolu |
| `canCreateDevice($companyId)` | Cihaz limiti kontrolu |
| `canUseStorage($companyId, $requestedMB)` | Depolama limiti kontrolu |

**Sinirsiz Plan Kontrolu:**
```php
// DB'den is_unlimited veya plan_type fallback
$dbUnlimited = isset($result['plan_is_unlimited']) && (int)$result['plan_is_unlimited'] === 1;
$typeUnlimited = in_array($result['plan_type'], ['enterprise', 'ultimate', 'unlimited']);
$result['is_unlimited'] = $dbUnlimited || $typeUnlimited;
```

### 3.2 LicenseMiddleware.php

**Konum:** `middleware/LicenseMiddleware.php`

**Isleyis:**
1. AuthMiddleware'den sonra calisir
2. SuperAdmin kontrolu atlar
3. Firma lisansini sorgular
4. Sinirsiz plan tipi kontrolu (enterprise, ultimate, unlimited, lifetime)
5. Tarih kontrolu (valid_until)
6. Suresi dolmussa 403 dondurur
7. 7 gun ve alti kaldiginda X-License-Warning header ekler

**Muaf Route'lar:**
- `/api/auth/*`
- `/api/licenses`
- `/api/companies`
- `/api/payments`
- `/api/system/about`

### 3.3 IyzicoGateway.php

**Konum:** `services/IyzicoGateway.php`

**Metodlar:**
- `ping()` - Baglanti testi
- `initPayment()` - Odeme baslat
- `verify3DPayment()` - 3D Secure dogrulama
- `getInstallments()` - Taksit secenekleri
- `refund()` - Iade
- `saveTransaction()` - Transaction kaydet
- `updateTransaction()` - Transaction guncelle

### 3.4 PaynetGateway.php

**Konum:** `services/PaynetGateway.php`

**Metodlar:**
- `ping()` - Baglanti testi
- `initPayment()` - Odeme baslat
- `verify3DPayment()` - 3D Secure dogrulama
- `refund()` - Iade

### 3.5 StorageService.php

**Konum:** `services/StorageService.php`

**LicenseService Entegrasyonu:**
```php
public function getLimit(string $companyId): int
{
    // LicenseService uzerinden merkezi limit kontrolu
    $limitInfo = LicenseService::getLimit($companyId, 'storage');
    if ($limitInfo['unlimited']) {
        return 0;  // 0 = sinirsiz
    }
    return $limitInfo['limit'] > 0 ? (int)$limitInfo['limit'] : self::DEFAULT_LIMIT_MB;
}
```

---

## 4. ODEME AKISI

### 4.1 Guncel Akis (DUZELTILDI)

```
1. Musteri plan secer
   |
2. POST /api/payments/init
   |- Plan dogrulama
   |- payment_transactions olustur (status=pending, plan_id kaydet)
   |- Gateway'e gonder
   \- 3D form dondur
   |
3. Musteri kart bilgisi girer (3D Secure)
   |
4. Odeme basarili
   |
5. Gateway POST /api/payments/callback veya /callback-3d gonderir
   |- Transaction bul (reference_id ile)
   |- Transaction guncelle (status=success)
   |- plan_id'yi transaction'dan cek
   |- Plan surasini hesapla (duration_months)
   |- Lisans olustur veya uzat (processLicenseExtension)
   |- Audit log kaydi
   \- Bildirim gonder
   |
6. Musteri basariyla erisir
   |- LicenseMiddleware lisans sorgular
   |- Lisans bulunur (yeni olusturuldu)
   \- 200 OK
```

### 4.2 Lisans Uzatma Fonksiyonu (callback-3d.php)

```php
function processLicenseExtension($db, $transaction, $planId) {
    // Plan bilgilerini al
    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

    // Sinirsiz plan kontrolu
    $isUnlimited = (int)($plan['is_unlimited'] ?? 0) === 1 ||
                   in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited']);

    // Mevcut lisansi kontrol et
    $existingLicense = $db->fetch(
        "SELECT * FROM licenses WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [$transaction['company_id']]
    );

    if ($existingLicense) {
        // Mevcut lisansi uzat
        $currentEnd = $existingLicense['valid_until'] ?? date('Y-m-d');
        $newEnd = $isUnlimited ? null : date('Y-m-d', strtotime("+{$plan['duration_months']} months", strtotime($currentEnd)));

        $db->update('licenses', [
            'plan_id' => $planId,
            'valid_until' => $newEnd,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$existingLicense['id']]);
    } else {
        // Yeni lisans olustur
        $db->insert('licenses', [
            'id' => $db->generateUuid(),
            'company_id' => $transaction['company_id'],
            'plan_id' => $planId,
            'license_key' => strtoupper(bin2hex(random_bytes(16))),
            'valid_from' => date('Y-m-d'),
            'valid_until' => $isUnlimited ? null : date('Y-m-d', strtotime("+{$plan['duration_months']} months")),
            'status' => 'active',
            'external_id' => $transaction['id'],
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    }
}
```

---

## 5. LIMIT KONTROLU

### 5.1 Limit Turleri

| Limit | Veritabani Alani | Kontrol Edilenler |
|-------|------------------|-------------------|
| Kullanici | max_users | users tablosu (active) |
| Cihaz | max_devices | devices tablosu |
| Urun | max_products | products tablosu |
| Sablon | max_templates | templates tablosu |
| Sube | max_branches | branches tablosu |
| Depolama | max_storage | media dosya boyutlari (MB) |

### 5.2 Sinirsiz Deger Gosterimi

**Standart:** -1, 0 veya NULL sinirsiz kabul edilir

```php
public static function isUnlimitedValue($value): bool
{
    return $value === null || $value === 0 || $value === -1 || $value === '0' || $value === '-1';
}
```

### 5.3 Sinirsiz Plan Tipleri

**Yontem 1 - DB Kolonu (Oncelikli):**
```sql
-- license_plans.is_unlimited = 1 ise sinirsiz
```

**Yontem 2 - Plan Type Fallback:**
```php
private static array $unlimitedPlanTypes = ['enterprise', 'ultimate', 'unlimited'];
```

### 5.4 Optimize Edilmis Kullanim Sorgusu

```php
// Tek sorgu ile tum kullanim sayilari (N+1 problemi cozumu)
$usage = $db->fetch(
    "SELECT
        (SELECT COUNT(*) FROM users WHERE company_id = ? AND status = 'active') as user_count,
        (SELECT COUNT(*) FROM devices WHERE company_id = ?) as device_count,
        (SELECT COUNT(*) FROM branches WHERE company_id = ? AND type != 'region') as branch_count,
        (SELECT COUNT(*) FROM branches WHERE company_id = ? AND type = 'region') as region_count,
        (SELECT COALESCE(SUM(file_size), 0) FROM media WHERE company_id = ?) as storage_bytes",
    [$companyId, $companyId, $companyId, $companyId, $companyId]
);
```

---

## 6. BILDIRIM SISTEMI

### 6.1 Lisans Bildirimleri

**NotificationTriggers.php:**

| Trigger | Aciklama |
|---------|----------|
| `onLicenseExpiring($companyId, $days)` | X gun kala bildirim |
| `onLicenseExpired($companyId)` | Sure doldu bildirimi |
| `onPaymentSuccess($companyId)` | Odeme basarili |
| `onPaymentFailed($companyId)` | Odeme basarisiz |

### 6.2 Cron Job

**Dosya:** `cron/check-licenses.php`

**Calisma:** Her gun 09:00

**Islemler:**
1. `LicenseService::markExpiredLicenses()` cagir
2. Yaklaşan bitiş tarihli lisanslar için bildirim gönder

**Bildirim Gunleri:** 30, 14, 7, 3, 1, 0 gun kala

---

## 7. TESPIT EDILEN VE DUZELTILEN SORUNLAR

### 7.1 ✅ DUZELTILDI: Odeme Callback Lisans Olusturmuyor

**Sorun:** `payments/callback.php` odeme basarili olunca lisans olusturmuyordu.

**Cozum:** Hem `callback.php` hem `callback-3d.php`'ye `processLicenseExtension()` fonksiyonu eklendi.

**Durum:** Tamamlandi

### 7.2 ✅ DUZELTILDI: 3D Secure Callback Lisans Olusturmuyor

**Sorun:** `payments/callback-3d.php` odeme basarili olunca lisans olusturmuyordu.

**Cozum:** `processLicenseExtension()` fonksiyonu eklendi ve PAYMENT_APPROVAL case'inde cagriliyor.

**Durum:** Tamamlandi

### 7.3 ✅ DUZELTILDI: Read Metodunda Update

**Sorun:** `isLicenseValid()` expired bulunca DB'yi guncelliyordu.

**Cozum:** `isLicenseValid()` artik salt-okunur. DB guncellemesi `markExpiredLicenses()` ile cron job tarafindan yapiliyor.

**Durum:** Tamamlandi

### 7.4 ✅ DUZELTILDI: N+1 Query Problemi

**Sorun:** `getAllLimitsWithUsage()` 5 ayri COUNT sorgusu yapiyordu.

**Cozum:** Tek sorgu ile subquery kullanarak tum sayilar aliyor.

**Durum:** Tamamlandi

### 7.5 ✅ DUZELTILDI: plan_id Validasyonu Yok

**Sorun:** Lisans olusturulurken/guncellenirken plan_id'nin var olup olmadigi kontrol edilmiyordu.

**Cozum:** `api/licenses/create.php` ve `api/licenses/update.php`'ye plan dogrulama eklendi.

**Durum:** Tamamlandi

### 7.6 ✅ DUZELTILDI: Depolama Limiti LicenseService Entegrasyonu

**Sorun:** StorageService eski tablo yapisini kullaniyordu.

**Cozum:** `StorageService::getLimit()` artik `LicenseService::getLimit()` uzerinden calisiyor.

**Durum:** Tamamlandi

### 7.7 ✅ DUZELTILDI: plan_id Transaction'da Eksik

**Sorun:** `payments/init.php` plan_id'yi sadece metadata'da sakliyordu.

**Cozum:** `plan_id` artik dogrudan transaction kolonuna da kaydediliyor.

**Durum:** Tamamlandi

### 7.8 ✅ DUZELTILDI: Foreign Key Constraint

**Sorun:** `licenses.plan_id` -> `license_plans.id` FK yok.

**Sebep:** SQLite ALTER TABLE ile FK eklemeyi desteklemiyor.

**Cozum:** Trigger-based FK validation eklendi (5 trigger):
- `trg_licenses_plan_id_insert` - INSERT'te plan_id dogrulama
- `trg_licenses_plan_id_update` - UPDATE'te plan_id dogrulama
- `trg_license_plans_delete_check` - Aktif lisansi olan planin silinmesini engelle
- `trg_payment_transactions_plan_id_insert` - Transaction INSERT'te plan_id dogrulama
- `trg_payment_transactions_plan_id_update` - Transaction UPDATE'te plan_id dogrulama

**Script:** `scripts/add_fk_triggers.php`

**Durum:** Tamamlandi (DB seviyesinde trigger ile)

### 7.9 BILGI: Odeme Ayarlari Alan Uyumsuzlugu

**Sorun:** Frontend/API ve veritabani arasinda alan adi farkliliklari vardi.

**Cozum:** Gateway siniflarinda field mapping yapildi:
- `status` ↔ `is_active`
- `environment` ↔ `is_test_mode`

**Durum:** Cozuldu

---

## 8. ALAN ESLESTIRME REFERANSI

### Lisans Alanlari

| Ozellik | Veritabani | API | Frontend |
|---------|------------|-----|----------|
| Bitis Tarihi | licenses.valid_until | expires_at | expiresAt |
| Baslangic Tarihi | licenses.valid_from | starts_at | startsAt |
| Durum | licenses.status | status | status |
| Plan Referansi | licenses.plan_id | plan_id | planId |
| Plan Adi | license_plans.name | plan | plan |
| Plan Tipi | license_plans.plan_type | plan_type | planType |
| Fiyat | license_plans.price | price | price |
| Sure | license_plans.duration_months | duration_months | durationMonths |

### Odeme Ayarlari Alanlari

| Ozellik | Veritabani | API/Frontend |
|---------|------------|--------------|
| Aktif | is_active | status |
| Test Modu | is_test_mode | environment |
| API Anahtari | api_key | api_key |
| Gizli Anahtar | secret_key | secret_key |

---

## 9. DOSYA REFERANSI

### Backend

| Dosya | Aciklama |
|-------|----------|
| services/LicenseService.php | Merkezi lisans islemleri |
| middleware/LicenseMiddleware.php | Lisans kontrol middleware |
| services/IyzicoGateway.php | Iyzico odeme gateway |
| services/PaynetGateway.php | Paynet odeme gateway |
| services/StorageService.php | Depolama yonetimi (LicenseService entegreli) |
| services/NotificationTriggers.php | Bildirim tetikleyicileri |
| api/licenses/create.php | Lisans olusturma (plan validasyonlu) |
| api/licenses/update.php | Lisans guncelleme (plan validasyonlu) |
| api/payments/init.php | Odeme baslatma (plan_id kayitli) |
| api/payments/callback.php | Gateway callback (lisans olusturma) |
| api/payments/callback-3d.php | 3D Secure callback (lisans olusturma) |
| cron/check-licenses.php | Lisans kontrol cron |

### Frontend

| Dosya | Aciklama |
|-------|----------|
| pages/admin/LicenseManagement.js | Lisans yonetim sayfasi |
| pages/settings/IntegrationSettings.js | Odeme ayarlari |

### Migrations

| Migration | Aciklama |
|-----------|----------|
| 042 | payment_settings, payment_transactions, license_plans |
| 076 | Plan schema guncellemesi |
| 079 | max_storage ekleme |
| 080 | licenses.plan_id ekleme |
| 081 | Varsayilan plan atama |
| 082 | licenses tablosu temizleme |
| 083 | payment_transactions.plan_id ekleme |
| 084 | FK validation trigger'lari (DROP only - script ile eklenir) |

### Scripts

| Script | Aciklama |
|--------|----------|
| scripts/add_fk_triggers.php | FK validation trigger'larini ekler (SQLite) |

---

## 10. VERITABANI KONTROL SORGULARI

**Yetim lisanslar (plan bulunamadi):**
```sql
SELECT l.* FROM licenses l
LEFT JOIN license_plans p ON l.plan_id = p.id
WHERE l.plan_id IS NOT NULL AND p.id IS NULL;
```

**Tamamlanmamis odemeler (islem var, lisans yok):**
```sql
SELECT pt.* FROM payment_transactions pt
LEFT JOIN licenses l ON pt.company_id = l.company_id
WHERE pt.status = 'success'
AND l.id IS NULL
AND pt.created_at > datetime('now', '-7 days');
```

**Sinirsiz planlar:**
```sql
SELECT * FROM license_plans
WHERE is_unlimited = 1
   OR plan_type IN ('enterprise', 'ultimate', 'unlimited');
```

**Suresi dolmak uzere olan lisanslar (7 gun):**
```sql
SELECT l.*, p.name as plan_name, c.name as company_name
FROM licenses l
JOIN license_plans p ON l.plan_id = p.id
JOIN companies c ON l.company_id = c.id
WHERE l.status = 'active'
AND l.valid_until IS NOT NULL
AND l.valid_until <= date('now', '+7 days')
AND l.valid_until > date('now');
```

---

## 11. SONUC

Lisans sistemi artik tam islevsel durumdadir. Kritik sorunlar (odeme -> lisans aktivasyonu) duzeltilmistir.

### Tamamlanan Duzeltmeler

| # | Sorun | Oncelik | Durum |
|---|-------|---------|-------|
| 1 | Callback lisans olusturmuyor | Kritik | ✅ Tamamlandi |
| 2 | 3D Callback lisans olusturmuyor | Kritik | ✅ Tamamlandi |
| 3 | Read metodunda update | Orta | ✅ Tamamlandi |
| 4 | N+1 query problemi | Orta | ✅ Tamamlandi |
| 5 | plan_id validasyonu | Dusuk | ✅ Tamamlandi |
| 6 | StorageService entegrasyonu | Orta | ✅ Tamamlandi |
| 7 | Transaction plan_id | Dusuk | ✅ Tamamlandi |
| 8 | FK constraint | Yuksek | ✅ Tamamlandi (Trigger) |

### Kalan Isler

1. **Test:** Tum odeme akisinin uçtan uca test edilmesi onerilir.

2. **PostgreSQL Migration:** Asagidaki bolume bakiniz.

---

## 12. POSTGRESQL MIGRATION NOTU

SQLite'dan PostgreSQL'e gecerken FK validation trigger'lari kaldirilmali ve native FK constraint'ler eklenmelidir.

### 12.1 Kaldirilacak SQLite Trigger'lari

```sql
-- PostgreSQL'e geciste bu trigger'lari kaldirin
DROP TRIGGER IF EXISTS trg_licenses_plan_id_insert;
DROP TRIGGER IF EXISTS trg_licenses_plan_id_update;
DROP TRIGGER IF EXISTS trg_license_plans_delete_check;
DROP TRIGGER IF EXISTS trg_payment_transactions_plan_id_insert;
DROP TRIGGER IF EXISTS trg_payment_transactions_plan_id_update;
```

### 12.2 Eklenecek PostgreSQL FK Constraint'leri

```sql
-- licenses.plan_id -> license_plans.id
ALTER TABLE licenses
ADD CONSTRAINT fk_licenses_plan_id
FOREIGN KEY (plan_id) REFERENCES license_plans(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- payment_transactions.plan_id -> license_plans.id
ALTER TABLE payment_transactions
ADD CONSTRAINT fk_payment_transactions_plan_id
FOREIGN KEY (plan_id) REFERENCES license_plans(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;
```

### 12.3 Migration Script Ornegi

```sql
-- PostgreSQL Migration: FK Constraints
-- Dosya: database/migrations/xxx_postgresql_fk_constraints.sql

BEGIN;

-- 1. SQLite trigger'larini kaldir (PostgreSQL'de zaten yok, guvenlik icin)
DROP TRIGGER IF EXISTS trg_licenses_plan_id_insert ON licenses;
DROP TRIGGER IF EXISTS trg_licenses_plan_id_update ON licenses;
DROP TRIGGER IF EXISTS trg_license_plans_delete_check ON license_plans;
DROP TRIGGER IF EXISTS trg_payment_transactions_plan_id_insert ON payment_transactions;
DROP TRIGGER IF EXISTS trg_payment_transactions_plan_id_update ON payment_transactions;

-- 2. Yetim kayitlari temizle (FK eklemeden once)
UPDATE licenses SET plan_id = NULL
WHERE plan_id IS NOT NULL
AND plan_id NOT IN (SELECT id FROM license_plans);

UPDATE payment_transactions SET plan_id = NULL
WHERE plan_id IS NOT NULL
AND plan_id NOT IN (SELECT id FROM license_plans);

-- 3. Native FK constraint'leri ekle
ALTER TABLE licenses
ADD CONSTRAINT fk_licenses_plan_id
FOREIGN KEY (plan_id) REFERENCES license_plans(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE payment_transactions
ADD CONSTRAINT fk_payment_transactions_plan_id
FOREIGN KEY (plan_id) REFERENCES license_plans(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Index ekle (performans icin)
CREATE INDEX IF NOT EXISTS idx_licenses_plan_id ON licenses(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_plan_id ON payment_transactions(plan_id);

COMMIT;
```

### 12.4 ON DELETE Davranisi

| Secenek | Aciklama | Onerilen |
|---------|----------|----------|
| RESTRICT | Referans varsa silmeyi engelle | ✅ Varsayilan |
| CASCADE | Referans olan kayitlari da sil | ❌ Tehlikeli |
| SET NULL | Referansi NULL yap | ⚠️ Dikkatli kullan |

**Not:** `ON DELETE RESTRICT` secildi cunku aktif lisansi olan bir planin silinmesi engellenmeli.

---

**Son Guncelleme:** 2026-02-05
**Guncelleyen:** Claude AI
