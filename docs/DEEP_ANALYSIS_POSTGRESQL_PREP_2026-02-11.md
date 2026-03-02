# Market Etiket Sistemi Derin Analiz ve PostgreSQL Geçiş Ön Hazırlık

Tarih: 11 Şubat 2026
Kapsam: `C:\xampp\htdocs\market-etiket-sistemi`
Referans: `C:\xampp\htdocs\omnex-core-platform`

## Amaç
Bu doküman iki hedefi birlikte ele alır:
1. Mevcut projedeki tutarsızlıkları, hata risklerini ve mimari borçları doğrulanmış kanıtlarla listelemek.
2. SQLite -> PostgreSQL geçişi için modüler şema, izolasyon, güvenli sorgu, indeks ve cache yaklaşımını tasarlamak.

## 26 Subat 2026 Guncel Durum Notu

Bu dokuman tarihsel analiz kaydidir. Guncel PostgreSQL gecis/stabilizasyon durumu icin:

- `docs/POSTGRESQL_MODULER_SHEMA_PLANI.md`
- `docs/POSTGRESQL_SQL_UYUMLULUK_GUNCEL_DURUM_2026-02-26.md`
- `docs/POSTGRESQL_CONNECTION_PROFILES_2026-02-26.md`

## Proje Hakkında Geniş Bilgi
- Uygulama tipi: Vanilla JS SPA + PHP API + SQLite tabanlı çok kiracılı (shared DB/shared schema) sistem.
- API merkezi: `api/index.php` (tek dosyada çok sayıda route kaydı).
- Çekirdek katmanlar: `core`, `middleware`, `services`, `api`.
- Veritabanı: `database/omnex.db` (aktif), migration dosyaları `database/migrations`.
- Mevcut canlı/veri yoğunluğu göstergeleri:
- `media` 1792 kayıt, `render_queue` 482 kayıt, `render_jobs` 259 kayıt, `audit_logs` 1215 kayıt.
- `migrations` tablosunda 87 kayıt, migration dosyası sayısı 86.

## Doğrulanmış Kritik Bulgular

| Öncelik | Bulgu | Kanıt | Etki | Öneri |
|---|---|---|---|---|
| P0 | API dosyasında parse error | `api/media/folders.php:21` ve `php -l api/media/folders.php` | `/api/media/folders` endpoint’i çalışmaz, 500/fatal üretir | Dosya sözdizimi düzeltilmeli, CI lint zorunlu olmalı |
| P0 | Kullanıcı yönetiminde yetki/izolasyon açığı | `api/index.php:183`, `api/users/show.php:14`, `api/users/update.php:41`, `api/users/delete.php:20`, `api/users/create.php:23` | Sadece `auth` ile kullanıcı okuma/güncelleme/silme ve rol yükseltme yapılabilir | `users` CRUD için rol bazlı yetki (Admin/SuperAdmin), zorunlu company filtresi, self/tenant guard |
| P0 | Yanlış statik çağrılar runtime fatal riski | `api/device-groups/create.php:14`, `api/device-groups/update.php:14`, `api/devices/products.php:50`, `api/hanshow/register.php:29`, `api/esl-gateway/sync.php:24` | `Request::segment/json/body` ve `AuthMiddleware::handle()` çağrıları mevcut sınıf imzasıyla uyumsuz | Tüm çağrılar instance tabanlı `Request` ve middleware chain üzerinden normalize edilmeli |
| P0 | Router param sözdizimi tutarsız | `api/index.php:1183`, `api/index.php:1330`, `core/Router.php:171` | `:id` kullanılan rotalar eşleşmez (`{id}` bekleniyor) | Tüm route paramları tek standarda (`{id}`) çekilmeli |
| P0 | `Database::rowCount()` yok ama çağrılıyor | `api/audit-logs/archive.php:69`, `api/audit-logs/delete.php:61`, `services/LicenseService.php:190`, `core/Database.php` | İlgili akışlarda fatal error riski | Ya `Database::rowCount()` eklenmeli ya da `query()` dönüşündeki statement kullanılmalı |

## Yüksek Öncelikli Bulgular

| Öncelik | Bulgu | Kanıt | Etki | Öneri |
|---|---|---|---|---|
| P1 | Media scan yolu kısıtlaması zayıf | `api/media/scan.php:34`, `api/media/scan.php:57` | Auth kullanıcıları sunucu dizinlerinden dosya taratıp DB’ye import deneyebilir | Scan sadece izinli storage alt path whitelist ile sınırlandırılmalı |
| P1 | Media browse/serve izolasyon zafiyeti ve path sızıntısı | `api/media/browse.php:102`, `api/media/browse.php:188`, `api/media/browse.php:211`, `api/media/serve.php:232`, `api/media/serve.php:236` | Legacy klasörlerde tenant ayrımı gevşek, istemciye absolute path sızıyor | Absolute path response kaldırılmalı, legacy path’ler company-verified olmalı |
| P1 | Test/debug endpointleri üretimde açık | `api/index.php:1013`, `api/index.php:1043`, `api/index.php:1264`, `api/tamsoft/debug-stok.php:6` | Yetkisiz ağ işlemleri/ifşa yüzeyi artar | Feature flag veya env bazlı kapatma, prod route whitelist |
| P1 | Çalıştır-at scripti repoda kalmış | `run-migrations.php:5` | Üretimde yanlışlıkla tetiklenebilir | Bu dosya kaldırılmalı veya sadece CLI’ye kilitlenmeli |
| P1 | CompanyMiddleware fiilen devre dışı ve API ile uyumsuz | `api/index.php:104`, `middleware/CompanyMiddleware.php:15`, `middleware/CompanyMiddleware.php:22` | Döküman-kod uyumsuzluğu, yanlış güvenlik varsayımı | Ya middleware tamamen entegre edilmeli ya da kaldırılıp dokümantasyon güncellenmeli |
| P1 | CORS konfigürasyonu çelişkili | `.htaccess:127`, `api/.htaccess:36`, `core/Response.php:217`, `middleware/ApiGuardMiddleware.php:336` | `Access-Control-Allow-Origin: *` + credentials kombinasyonu tutarsız | Tek CORS kaynağına indir, prod’da explicit origin listesi + credentials |
| P1 | Kategori global modeli ile şema çelişkili | `database/migrations/011_create_categories.sql`, `api/categories/index.php:21` | Kod global kategori beklerken şema `company_id NOT NULL` | Veri modeli kararı netleştirilmeli (global desteklenecekse nullable + policy) |

## Orta Öncelikli Bulgular

| Öncelik | Bulgu | Kanıt | Etki | Öneri |
|---|---|---|---|---|
| P2 | Migration drift | Dosya sayısı 86, `migrations` satırı 87, DB-only kayıt: `026_add_video_to_products.sql` | Yeni ortamda deterministik kurulum riski | Tek migration manifest’i oluştur, eksik migration dosyasını geri ekle veya squash et |
| P2 | Migration numara çakışmaları | `database/migrations` içinde `010`, `032`, `045`, `049`, `050`, `060`, `076` çoğul | Sıra/bağımlılık takibi zorlaşıyor | Timestamp tabanlı migration isimlendirmesine geç |
| P2 | Debug veri üretimde response’a dönüyor | `api/playlists/show.php:161`, `api/render-queue/process.php:334` | Gereksiz payload/ifşa, performans kaybı | Debug blokları env guard ile kapat |
| P2 | Yardımcı script parse hatası | `check_products_cols.php:6` | Operasyon script güvenilirliği düşük | Scriptleri ayrı `tools/` altında lint/test sürecine al |
| P2 | Repo/çalışma alanı çok büyük ve operasyonel yük yüksek | Top klasörler: `kutuphane`, `backup`, `tasarımlar`, `local-gateway-manager` (çok büyük) | Backup/artifact gürültüsü, bakım maliyeti artar | Arşiv, runtime, source ayrımı yapılmalı; deploy paketi daraltılmalı |

## Hızlı Aksiyon Planı

### 0-48 Saat (Kritik Stabilizasyon)
1. `api/media/folders.php` parse hatasını düzelt.
2. `users` endpointlerine zorunlu yetki ve tenant filtreleri ekle.
3. `Request::segment/json/body` ve `AuthMiddleware::handle()` statik çağrılarını kaldır.
4. `:id` route tanımlarını `{id}` standardına çevir.
5. `$db->rowCount()` çağrılarını statement tabanlı hale getir.
6. Test/debug endpointlerini production’da kapat.

### 3-7 Gün (Güvenlik ve Tutarlılık)
1. Media browse/serve/scan için path policy’yi whitelist + company doğrulama ile sıkılaştır.
2. CORS yönetimini tek katmana indir.
3. Migration drift temizliği: eksik dosya/manifest/sıralama standardı.
4. Dokümantasyon düzeltmesi: CompanyMiddleware, gerçek izolasyon akışı.

### 1-3 Hafta (Mimari Temizlik)
1. API route tanımlarını modüler route dosyalarına böl.
2. Query policy helper ekle: company scoped zorunlu builder.
3. Debug/log davranışını env tabanlı hale getir.
4. CI pipeline: `php -l`, route lint, migration lint, güvenlik smoke test.

## Uygulanan Kritik Düzeltmeler (11 Şubat 2026)

Bu bölümde, analiz sonrası doğrudan kodda kapatılan kritikler listelenmiştir.

### Kapatılan P0 Alanları
1. Parse hataları düzeltildi:
- `api/media/folders.php`
- `check_products_cols.php`

2. Runtime kırığı giderildi:
- `core/Database.php` içine `lastRowCount` takibi ve `rowCount()` metodu eklendi.

3. Request/Auth kullanım uyumsuzlukları giderildi:
- `Request::segment/json/body` statik çağrıları, endpointlerde instance tabanlı kullanıma çekildi.
- `AuthMiddleware::handle()` statik çağrıları kaldırıldı.

4. Router param uyumsuzlukları düzeltildi:
- `:id` kullanan route’lar `{id}` standardına çevrildi (`hanshow esls`, `payments/status`).

5. `users` endpointleri güvenlik sertleştirildi:
- `api/users/index.php`: sadece `Admin/SuperAdmin`.
- `api/users/show.php`: self/admin erişim + company izolasyonu.
- `api/users/create.php`: role whitelist + non-superadmin için rol/company kısıtları.
- `api/users/update.php`: company boundary, superadmin role/company değişikliği guard’ları.
- `api/users/delete.php`: self-delete engeli + company/role guard.

### Kapatılan P1 Alanları
1. Açık test/debug yüzeyi daraltıldı:
- `api/index.php` içinde `esl-gateway` route grubu auth middleware altına alındı.
- `api/tamsoft/debug-stok.php` sadece `SuperAdmin` erişimine indirildi.

2. Media güvenlik izolasyonu sıkılaştırıldı:
- `api/media/browse.php`: sadece `storage` altı path, role/tenant bazlı dizin erişimi, legacy dizinler admin-only.
- `api/media/scan.php`: admin zorunlu, sadece `storage` altında tarama, non-superadmin için company/public-samples scope kısıtı.
- `api/media/serve.php`: storage dışı erişim engeli, legacy dizinlerde auth + DB ownership/public kontrolü.

### Doğrulama
1. Hedefli lint sonuçları: `PHP LINT TARGETED: OK`, `PHP LINT SECURITY FIXES: OK`.
2. Geniş lint sonucu (hariç tutulan büyük klasörler dışında): `PHP LINT: OK`, `PHP LINT (BROAD): OK`.
3. Route/pattern kontrolleri:
- `/:id` kalıbı temizlendi (`api/index.php`).
- statik `AuthMiddleware::handle()` çağrısı temizlendi.

### Kalan Yüksek Öncelikli Maddeler
1. `run-migrations.php` dosyası hâlâ repoda; kaldırma/CLI lock önerisi geçerli.
2. CORS tekilleştirme (`.htaccess`, `api/.htaccess`, `ApiGuard/Response`) henüz uygulanmadı.
3. CompanyMiddleware tasarımı ile fiili auth/company akışı arasındaki mimari sadeleştirme işi devam ediyor.

## SQLite -> PostgreSQL Geçiş Ön Hazırlık

## Neden şimdi hazırlık gerekli
- Kod tabanında SQLite’a özel ifadeler yoğun: `PRAGMA`, `sqlite_master`, `datetime('now')`, `INSERT OR IGNORE`, `json_extract`, `GROUP_CONCAT`, `strftime`.
- Geçiş sadece driver değişimi değildir; SQL fonksiyonları, veri tipleri, index ve izolasyon stratejisi yeniden tasarlanmalıdır.

## Fonksiyon/Eşdeğer Haritası
- `datetime('now')` -> `now()` / `CURRENT_TIMESTAMP` (`timestamptz` önerilir)
- `INSERT OR IGNORE` -> `INSERT ... ON CONFLICT DO NOTHING`
- `GROUP_CONCAT` -> `string_agg`
- `json_extract(col, '$.x')` -> `col::jsonb ->> 'x'`
- `sqlite_master` kontrolleri -> `information_schema` / `pg_catalog`
- `PRAGMA table_info` -> `information_schema.columns`

## Veri Tipi Dönüşüm Prensipleri
- UUID: `TEXT` yerine `uuid`.
- Tarih/saat: `TEXT` yerine `timestamptz`.
- Boolean alanlar: `INTEGER(0/1)` yerine `boolean`.
- JSON metinleri: `TEXT` yerine `jsonb`.
- Büyük sayaçlar: gerekli yerlerde `bigint`.

## Geçiş Stratejisi (Önerilen)
1. Şema freeze: yeni migration kabulünü kısa süreli dondur.
2. Şema çıkarımı: mevcut tablo/index/constraint envanterini otomatik çıkar.
3. PostgreSQL modüler DDL oluştur.
4. Veri taşıma denemesi: staging’de tam dump/import + doğrulama scriptleri.
5. Uygulama uyumluluğu: SQLite-spesifik SQL’lerin PostgreSQL karşılıklarına refactor.
6. Kademeli cutover: bakım penceresi + geri dönüş planı.
7. Post-cutover: query plan (`EXPLAIN ANALYZE`), index tuning, cache tuning.

## Modüler PostgreSQL Şema Önerisi
Detay dosya planı için: `docs/POSTGRESQL_MODULER_SHEMA_PLANI.md`

Önerilen namespace grupları:
- `core`: companies, users, permissions, settings
- `catalog`: products, categories, production_types, price_history
- `labels`: templates, label_sizes, render_cache, render_jobs, render_queue
- `media`: media, media_folders, storage usage
- `devices`: devices, device_groups, device_commands, heartbeats, gateway
- `signage`: playlists, playlist_items, schedules, assignments
- `integration`: tamsoft/hanshow/hal/integration_settings
- `license`: license_plans, licenses, payments
- `branch`: branches, overrides, import logs
- `audit`: audit_logs, notification/audit yan tabloları

## Güvenli İzolasyon (PostgreSQL)
- Uygulama context zorunluluğu: her request’te `app.company_id`, `app.user_id`, `app.role` set edilsin.
- RLS (Row Level Security): company-bound tablolarda policy zorunlu olsun.
- SuperAdmin bypass politikası explicit ve auditlenebilir olsun.

Örnek policy yaklaşımı:
- `USING (company_id = current_setting('app.company_id', true)::uuid)`
- Admin rolleri için ek policy blokları.

## İndeks Stratejisi
- Her kritik tabloda en az bir composite tenant index: `(company_id, status)` veya `(company_id, updated_at DESC)`.
- Sık filtrelenen alanlar için partial index: örn. `WHERE status = 'active'`.
- Queue tabloları için iş akış indexleri: `(company_id, status, priority DESC, scheduled_at)`.
- JSONB erişiminde gerekli ise GIN index.

## Cache Stratejisi
- L1: request-scope ve kısa süreli in-memory cache.
- L2: Redis (tenant/company scoped key).
- Key formatı: `{module}:{entity}:{company_id}:{id_or_filter_hash}`.
- Mutation sonrası tag/pattern invalidation zorunlu.

## `omnex-core-platform` Referansından Uyarlanabilir Desenler
İncelenen referans dosyalar:
- `C:\xampp\htdocs\omnex-core-platform\prisma\tenant.schema.prisma`
- `C:\xampp\htdocs\omnex-core-platform\src\lib\api\withTenant.ts`
- `C:\xampp\htdocs\omnex-core-platform\src\lib\api\tenantContext.ts`
- `C:\xampp\htdocs\omnex-core-platform\prisma\docs\cache-index-strategy.md`

Bu projeye uyarlanacak temel fikirler:
1. Modüler şema kaynakları + tekleştirilmiş build çıktısı yaklaşımı.
2. Tenant/company context helper zorunluluğu.
3. Tenant-bound cache key standardı.
4. İndeks kural seti (tenant/company öncelikli composite index).

## Sonuç
Kod tabanı işlevsel olarak geniş, ancak kritik seviyede güvenlik/tutarlılık borçları mevcut. PostgreSQL geçişine başlamadan önce P0/P1 bulguların temizlenmesi zorunlu. Aksi halde veri taşıma sonrası aynı problemler yeni DB’de de devam eder.

## Guncelleme Eki (26 Subat 2026)
- Setup wizard seeder akisinda PostgreSQL gecisi sonrasi tespit edilen null `company_id` kaynakli fatal hata kapatildi.
- `api/setup/seed.php` icin aktif company fallback (`Auth::getActiveCompanyId`) standartlastirildi ve company yoksa kontrollu 400 cevabi eklendi.
- `public/assets/js/pages/admin/SetupWizard.js` icin eksik `Toast` ve `Modal` importlari eklendi.
- Ayrintili durum ve smoke test listesi: `docs/POSTGRESQL_SQL_UYUMLULUK_GUNCEL_DURUM_2026-02-26.md`.
