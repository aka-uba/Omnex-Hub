# PostgreSQL SQL Uyumluluk Guncel Durum (Adim 3 - Runtime Stabilizasyon)

Tarih: 26 Subat 2026
Kapsam: `api`, `core`, `services`, `middleware`, `workers` runtime SQL uyumlulugu + ortam dogrulama

## Ozet

- PostgreSQL'e gecis sonrasi kullanici tarafinda raporlanan 500 hatalari kapatildi.
- SQLite'e ozel runtime kaliplari PostgreSQL icin driver-aware hale getirildi:
  - `datetime('now')` fonksiyon cagri farklari
  - `REPLACE(timestamp, ...)` kullanimlari
  - `boolean = 1` kosullari
  - `text = uuid` / `uuid = text` join uyumsuzluklari
- Kritik endpoint smoke testi tamamlandi: 24/24 endpoint HTTP 200.

## Bu Adimda Kapatilan Hata Siniflari

1. Datetime/timestamp uyumsuzluklari
- `datetime('now')` -> `CURRENT_TIMESTAMP` veya driver-aware kosul
- `REPLACE(scheduled_at, 'T', ' ')` -> PostgreSQL'de dogrudan timestamp karsilastirma

2. Boolean uyumsuzluklari
- `is_active = 1`, `is_public = 1`, `is_default = 1` -> PostgreSQL'de `IS TRUE`

3. Tip uyumsuz joinler
- `LEFT JOIN ... ON text_col = uuid_col` -> `CAST(... AS TEXT)` ile normalize

## Guncellenen Ana Dosya Gruplari

- Queue/Render:
  - `api/render-queue/analytics.php`
  - `api/render-queue/process.php`
  - `api/render-cache/index.php`
  - `services/RenderCacheService.php`
  - `services/RenderService.php`
- Auth/Session etkisi olan endpoint akislari:
  - `middleware/AuthMiddleware.php` (onceki adimda)
  - `middleware/DeviceAuthMiddleware.php` (onceki adimda)
- Payments/Licensing:
  - `api/payments/settings.php`
  - `api/payments/plans.php`
  - `api/payments/init.php`
  - `api/payments/history.php`
  - `services/IyzicoGateway.php`
  - `services/PaynetGateway.php`
  - `services/LicenseService.php`
- Users/Audit/Notifications:
  - `api/users/index.php`
  - `api/audit-logs/index.php`
  - `api/audit-logs/show.php`
  - `api/notifications/read.php`
  - `services/NotificationService.php`
- Media/WebTemplate/Playlist/ESL:
  - `api/media/index.php`
  - `api/media/fix-paths.php`
  - `api/media/scan.php`
  - `api/web-templates/index.php`
  - `api/web-templates/show.php`
  - `api/web-templates/delete.php`
  - `api/playlists/index.php`
  - `api/playlists/create.php`
  - `api/playlists/show.php`
  - `api/playlists/update.php`
  - `api/esl/pending.php`
  - `api/esl/content.php`
  - `api/esl/alert.php`
  - `api/esl/mqtt/settings.php`

## Smoke Test Sonucu (26 Subat 2026)

Asagidaki endpointler PostgreSQL ile 200 dondu:

- `/api/auth/session`
- `/api/settings`
- `/api/companies`
- `/api/branches?hierarchy=1`
- `/api/notifications?limit=10&status=active`
- `/api/notifications/unread-count`
- `/api/setup/status`
- `/api/render-queue/analytics`
- `/api/web-templates`
- `/api/media?page=1&per_page=27&skip_validation=1`
- `/api/esl/pending?status=pending&include_unbound=1`
- `/api/playlists`
- `/api/payments/settings?provider=iyzico`
- `/api/users?page=1&per_page=25&sort_dir=ASC`
- `/api/payments/plans`
- `/api/audit-logs?page=1&per_page=25&sort_by=created_at&sort_dir=DESC`
- `/api/reports/dashboard-stats`
- `/api/reports/recent-activities?limit=10`
- `/api/layout/config`
- `/api/label-sizes`
- `/api/media/fix-paths?scope=public`
- `/api/esl/mqtt/settings`
- `/api/render-cache?pending=1`
- `/api/hanshow/esls`

## Ortam ve Docker Durumu

- Coklu profil yapisi aktif: `local`, `docker`, `server`.
- Docker dosyalari ve scriptleri hazir:
  - `docker-compose.postgresql.yml`
  - `scripts/docker-postgresql-up.bat`
  - `scripts/docker-postgresql-down.bat`
  - `scripts/docker-postgresql-reset.bat`
- Port haritasi:
  - App: `localhost:8081`
  - PostgreSQL: `localhost:5433`

Detay baglanti profilleri: `docs/POSTGRESQL_CONNECTION_PROFILES_2026-02-26.md`

## Mevcut Durum Degerlendirmesi

- Runtime gecis durumu: calisabilir ve stabil.
- Kritik login/session + admin panel akislari PostgreSQL'de sorunsuz.
- Kalan SQLite referanslarinin cogu legacy migration veya SQLite fallback dallarinda (runtime blocker degil).

## Kalan Isler (Temizlik / Hardening)

- Device token isteyen endpointler (`/api/esl/content`, `/api/esl/alert`, `/api/player/content`) fiziksel cihazla E2E dogrulanmali.
- `database/migrations` altindaki SQLite odakli eski dosyalar legacy klasore alinarak ayristirilmali.
- PG-only uretim modunda, yeni kodlar icin SQLite pattern lint kurali CI'da zorunlu hale getirilmeli.

## Son Duzeltme Notu (26 Subat 2026 - Setup Seeder)

Gozlenen hata:
- `/api/setup/seed` 500: `BaseSeeder::setCompanyId()` null `company_id` aldiginda TypeError.
- `SetupWizard.js` runtime: `Toast is not defined`.

Uygulanan duzeltmeler:
- `api/setup/seed.php`
- `company_id` belirleme akisi guncellendi:
  - SuperAdmin icin `input.company_id` > `Auth::getActiveCompanyId()` fallback
  - normal admin icin `user.company_id` yoksa `Auth::getActiveCompanyId()` fallback
- `company_id` hala yoksa endpoint artik 400 donuyor (kontrollu hata), fatal olmuyor.
- Seeder konfigurasyonunda `setCompanyId((string) $companyId)` kullaniliyor.

- `public/assets/js/pages/admin/SetupWizard.js`
- Eksik importlar eklendi:
  - `import { Toast } from '../../components/Toast.js';`
  - `import { Modal } from '../../components/Modal.js';`

Notlar:
- Bu degisiklikle setup wizard'da seed/clear demo adimlarinda null-company kaynakli hard crash engellenmistir.
- Auth gerektiren canli endpoint E2E testi bu oturumda token uretilmeden tam otomatik kosulamadi; syntax kontrolleri basarili (`php -l`, `node --check`).
