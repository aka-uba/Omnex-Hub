# PostgreSQL Moduler Sema Plani (Canli Tablo Bazli Revizyon)

Tarih: 26 Subat 2026
Baglam: `market-etiket-sistemi` SQLite -> PostgreSQL gecisi
Temel kaynak: `database/omnex.db` canli semasi

## Revizyon Ozeti

- Onceki plan 43 tabloya dayaniyordu.
- Canli veritabaninda 89 tablo var.
- Onceki plana gore canli tarafta +46 tablo var.
- Bu plan migration dosyalarina degil, dogrudan canli tablo durumuna gore guncellendi.

## Uygulama Durumu (26 Subat 2026)

- Adim 1 (DB adapter): tamamlandi (`core/Database.php` dual driver + `config.php` DB ayarlari)
- Adim 2 (runtime SQL uyumluluk): tamamlandi (kritik SQLite kaliplari driver-aware hale getirildi)
- Adim 3 (runtime stabilizasyon/hotfix): tamamlandi (boolean, datetime, uuid/text join uyumsuzluklari kapatildi)
- Coklu ortam baglanti profilleri: tamamlandi (`local`, `docker`, `server`)
- Moduler PostgreSQL semasi: `database/postgresql/v2` altinda aktif
- Kritk endpoint smoke testi: 24/24 HTTP 200

## Kullanilan Referanslar

- `docs/DEEP_ANALYSIS_POSTGRESQL_PREP_2026-02-11.md`
- `docs/POSTGRESQL_LIVE_SCHEMA_INVENTORY_2026-02-26.md`
- `docs/POSTGRESQL_SQL_UYUMLULUK_ENVANTERI_2026-02-26.md`
- `docs/POSTGRESQL_SQL_UYUMLULUK_GUNCEL_DURUM_2026-02-26.md`
- `docs/POSTGRESQL_CONNECTION_PROFILES_2026-02-26.md`

## Son Hotfix Dalgasi (26 Subat 2026)

- Kapatilan hata siniflari:
  - `datetime('now')` ve timestamp karsilastirma farklari
  - `boolean = 1` tip uyumsuzluklari
  - `text = uuid` join hatalari
- Etkilenen moduller:
  - `render_queue`, `render_cache`, `web_templates`, `media`, `esl`, `playlists`
  - `payments`, `license`, `users`, `audit`, `notifications`
- Guncel teknik durum raporu:
  - `docs/POSTGRESQL_SQL_UYUMLULUK_GUNCEL_DURUM_2026-02-26.md`

## Canli Sema Snapshot (26 Subat 2026)

- Toplam tablo: 89
- Toplam satir: 8871
- `company_id` kolonu olan tablo: 52
- PK dagilimi: 84 text tabanli, 3 integer tabanli, 2 backup tablo PK'siz
- Buyuk tablolar: `audit_logs` (2057), `media` (1792), `device_heartbeats` (1349), `render_queue` (849), `render_jobs` (594)

## Migration Drift (Canli Dogrulama)

- `migrations` tablosu: 105 satir
- `database/migrations` dosya sayisi: 103 (102 SQL + 1 PHP)
- Calismis ama dosyasi repoda olmayan migrationlar:
- `026_add_video_to_products.sql`
- `066_normalize_media_paths.sql`

## Guncel Modul ve Schema Haritasi

Asagidaki siniflandirma PostgreSQL schema bazinda uygulanacaktir.

### `core` schema

- `companies`
- `users`
- `permissions`
- `sessions`
- `settings`
- `menu_items`
- `layout_configs`
- `rate_limits`
- `migrations` (opsiyonel, `ops.migrations` altina da alinabilir)

### `catalog` schema

- `products`
- `categories`
- `production_types`
- `price_history`
- `bundles`
- `bundle_items`
- `bundle_price_history`

### `branch` schema

- `branches`
- `user_branch_access`
- `branch_import_logs`
- `product_branch_overrides`
- `branch_price_history`
- `bundle_branch_overrides`
- `bundle_branch_price_history`

### `labels` schema

- `templates`
- `label_sizes`
- `render_cache`
- `render_jobs`
- `render_queue`
- `render_queue_items`
- `render_priority_weights`
- `render_retry_policies`
- `product_renders`
- `templates_backup` (legacy)

### `media` schema

- `media`
- `media_folders`
- `company_storage_usage`

### `devices` schema

- `devices`
- `device_groups`
- `device_group_members`
- `device_logs`
- `device_sync_requests`
- `device_tokens`
- `device_commands`
- `device_heartbeats`
- `device_content_assignments`
- `device_alerts`
- `firmware_updates`
- `gateways`
- `gateway_devices`
- `gateway_commands`
- `hanshow_esls`
- `hanshow_queue`
- `hanshow_settings`
- `hanshow_aps`
- `hanshow_firmwares`
- `mqtt_settings`

### `signage` schema

- `playlists`
- `playlist_items`
- `schedules`
- `schedule_devices`
- `web_templates`
- `web_template_versions`
- `web_template_assignments`
- `web_template_widgets`
- `transcode_queue`
- `transcode_variants`
- `stream_access_logs`

### `integration` schema

- `integrations`
- `integration_settings`
- `integration_settings_audit`
- `import_mappings`
- `import_logs`
- `tamsoft_settings`
- `tamsoft_tokens`
- `tamsoft_sync_logs`
- `tamsoft_depo_mapping`
- `product_hal_data`
- `product_branch_hal_overrides`
- `hal_distribution_logs`

### `license` schema

- `licenses`
- `license_plans`
- `license_device_pricing`
- `payment_settings`
- `payment_transactions`

### `audit` schema

- `audit_logs`
- `notifications`
- `notification_recipients`
- `notification_settings`
- `user_notification_preferences`

### `legacy` schema

- `settings_backup` (sadece arsiv; uygulama query akisina dahil edilmemeli)

## ID ve Veri Tipi Stratejisi

## UUID olacak tablolar

- Cogu `id TEXT` alanini `uuid` tipine tasiyin.
- Ornek: `companies`, `users`, `products`, `devices`, `templates`, `render_queue`, `render_jobs`, `media`.

## Text PK kalacak tablolar (dogal anahtar / karisik format)

- `label_sizes.id` (`ls-*`)
- `web_template_widgets.id` (`widget-*`)
- `render_priority_weights.priority` (dogal anahtar)
- `render_retry_policies.id` (dogal anahtar)
- `integration_settings.id` (`system-*` kayitlari var)
- `license_plans.id` (`default-starter-plan` kaydi var)
- `settings.id` (`__log_notify_settings__` kaydi var)
- `menu_items.id` ve `hanshow_settings.id` icinde UUID disi formatli satir var

## Integer PK kalacak tablolar

- `stream_access_logs.id` -> `bigint generated always as identity`
- `hanshow_firmwares.id` -> `integer` (vendor firmware id)
- `migrations.id` -> `bigint` veya tamamen `ops` semasina alinacak

## Dikkat: Canli veride UUID disi kayit

- `products.id` icinde 1 adet UUID disi kayit var: `test-hal-1769857508`
- Cutover oncesi bu kayit UUID'ye normalize edilmeli.

## Tenant Izolasyon Kurallari

## `company_id` zorunlu olacak tablolar

- Islem verisi ureten tum tenant tablolari (`products`, `devices`, `render_*`, `branches`, `licenses`, vb.)
- `NOT NULL` + FK + RLS politikasi zorunlu.

## `company_id` nullable kalmasi gereken tablolar

- Global/public veriler:
- `label_sizes`, `menu_items`, `payment_settings`, `web_template_widgets`, `media_folders`
- Scope karmasi olan tablolar:
- `media`, `templates`, `integration_settings`, `layout_configs`
- Operasyonel istisnalar:
- `audit_logs`, `device_sync_requests`, `settings`

## Scope tutarliligi

- Scope kolonu olan tablolarda CHECK standardi uygulanmali:
- `scope='company'` ise `company_id IS NOT NULL`
- `scope IN ('system','public','default','user')` ise `company_id` nullable

## Canli Veri Kalitesi Bulgulari (Geciste patlayabilecek alanlar)

- `company_id` bos/NULL satirlar:
- `audit_logs` 287
- `device_sync_requests` 81
- `integration_settings` 4
- `label_sizes` 61
- `media` 1161
- `media_folders` 18
- `menu_items` 8
- `payment_settings` 2
- `settings` 1
- `templates` 2
- `web_template_widgets` 6

- FK orphan kontrolu: kritik orphan bulunmadi.
- Datetime parse kontrolu: kritik bozuk tarih bulunmadi.
- Boolean outlier:
- `hanshow_esls.has_led` ve `hanshow_esls.has_magnet` kolonlarinda bos string deger var, `NULL/false` normalize edilmeli.

## SQLite -> PostgreSQL SQL Uyumluluk Backlog'u

Canli kod tarama bulgulari:

- `datetime('now')`: 229 satir / 84 dosya
- `strftime(...)`: 7 satir / 3 dosya
- `INSERT OR IGNORE`: 16 satir / 11 dosya
- `PRAGMA`: 5 satir / 3 dosya
- `sqlite_master`: 1 satir / 1 dosya
- `GROUP_CONCAT`: 2 satir / 1 dosya

Detayli dosya listesi:

- `docs/POSTGRESQL_SQL_UYUMLULUK_ENVANTERI_2026-02-26.md`

Kodda zorunlu refactor noktalarinin bir kismi:

- `core/Database.php`
- `api/products/store.php` (`PRAGMA table_info`)
- `api/products/update.php` (`PRAGMA table_info`)
- `api/companies/index.php` (`sqlite_master`)
- `api/users/index.php` (`GROUP_CONCAT`)
- `api/gateway/heartbeat.php` (`strftime`, `datetime('now')`)
- `api/system/status.php` (`sqlite_version`, `strftime`, DB type hardcoded)
- `api/render-queue/analytics.php` (`strftime`)
- `core/Security.php` (`INSERT OR IGNORE`)

## Fonksiyon Donusum Haritasi

- `datetime('now')` -> `now()`
- `strftime('%Y-%m', ts)` -> `to_char(ts, 'YYYY-MM')`
- `strftime('%H', ts)` -> `to_char(ts, 'HH24')`
- `strftime('%Y-%m-%d %H:00', ts)` -> `date_trunc('hour', ts)`
- `INSERT OR IGNORE` -> `INSERT ... ON CONFLICT DO NOTHING`
- `GROUP_CONCAT(x, ',')` -> `string_agg(x::text, ',')`
- `PRAGMA table_info(tbl)` -> `information_schema.columns`
- `sqlite_master` -> `information_schema.tables` / `pg_catalog.pg_class`
- `AUTOINCREMENT` -> `generated always as identity`

## Uygulama Katmani (Zorunlu Mimari Degisiklik)

## `core/Database.php` icin zorunlu degisiklikler

- DSN driver secimi: `sqlite` ve `pgsql` destekli hale getirilmesi
- `escapeIdentifier()` backtick yerine PostgreSQL uyumlu cift tirnak kullanimi
- SQLite PRAGMA bloklarinin driver'a gore kosullanmasi
- Migration parser'in `;` ile naive split yerine dosya bazli calismasi
- `insert()` fonksiyonunda tablo PK kurali metadata ile belirlenmeli, her tabloya otomatik `id` basilmamali
- RLS context set fonksiyonu eklenmeli:
- `set_config('app.company_id', ..., true)`
- `set_config('app.user_id', ..., true)`
- `set_config('app.role', ..., true)`

## Onerilen PostgreSQL Dizin Yapisi (V2)

`database/postgresql/v2/`

- `00_extensions.sql`
- `01_schemas.sql`
- `10_core.sql`
- `11_catalog.sql`
- `12_branch.sql`
- `13_labels.sql`
- `14_media.sql`
- `15_devices.sql`
- `16_signage.sql`
- `17_integration.sql`
- `18_license.sql`
- `19_audit.sql`
- `20_legacy.sql`
- `30_constraints.sql`
- `40_indexes.sql`
- `50_views.sql`
- `60_functions.sql`
- `70_rls.sql`
- `80_seed_system.sql`
- `90_post_migrate_checks.sql`

## Gecis Yontemi (Tam ve Sorunsuz Cutover Icin)

## Faz 0 - Freeze ve Hazirlik

- Yeni migration girisini dondur.
- `omnex.db` full backup al.
- Canli satir sayisi ve checksum snapshot al.
- UUID disi kritik kayitlari normalize et (`products.id` gibi).

## Faz 1 - PostgreSQL Semasini Kur

- V2 DDL dosyalarini olustur.
- Tum FK, CHECK, UNIQUE, partial indexleri ekle.
- RLS policy'leri sadece company-bound tablolarda aktif et.

## Faz 2 - Veri Tasima Pipeline

- SQLite export: tablo bazli CSV/NDJSON.
- PostgreSQL import: `COPY` + staging tablolar.
- FK sirasina gore yukleme:
- `core` -> `license` -> `catalog/branch` -> `labels/media` -> `devices/signage` -> `integration` -> `audit`

## Faz 3 - DQ ve Dogrulama

- Tablo satir sayilari birebir kontrol.
- PK/FK mismatch kontrol.
- `company_id` policy kontrol.
- Json parse kontrol (`jsonb` cast testleri).
- Tarih cast kontrol (`timestamptz`).

## Faz 4 - Uygulama SQL Refactor

- SQLite specific fonksiyonlari kaldir.
- `Database` adapter'i driver-aware hale getir.
- `api/system/status.php` DB metadata logic'i PostgreSQL'e cek.
- Uygulama testlerini PostgreSQL ile green hale getir.

## Faz 5 - Staging Dry-Run

- Uctan uca staging gecisi en az 2 kez tekrar et.
- Her dry-run icin:
- Migration suresi
- Import suresi
- API smoke test sonucu
- Veri tutarliligi raporu kaydet.

## Faz 6 - Uretim Cutover

- Bakim penceresi ac.
- Yazma trafiklerini durdur.
- Son delta export/import al.
- App config'i PostgreSQL'e cek.
- Smoke testler:
- Login
- Product CRUD
- Render queue
- Device heartbeat
- Media browse
- Lisans akislari

## Faz 7 - Post-Cutover Go/No-Go

- 60 dakika yakin izleme.
- Kritik hata yoksa cutover kalici olur.
- Kritik hata varsa rollback uygulanir.

## Rollback Plani

- Cutover oncesi SQLite snapshot zorunlu.
- Uygulama DB driver geri `sqlite` moduna alinabilir olmali.
- Rollback kriteri:
- Login/API temel akislarda kritik hata
- Veri kaybi / FK ihlali
- Tenant izolasyon bozulmasi
- Rollback adimlari:
- PostgreSQL baglantisini kapat
- App config'i SQLite'a geri al
- Son stabil `omnex.db` yedegini aktif et
- Servisi yeniden baslat

## Kabul Kriterleri (Definition of Done)

- Canli 89 tablonun tamaminin PostgreSQL karsiligi var.
- Canli verideki tum satirlar beklenen tabloya tasindi.
- Kritik API endpoint smoke testleri sorunsuz.
- RLS policy'leri tenant izolasyonunu dogruluyor.
- SQLite-ozel SQL kalmadi (`datetime('now')`, `strftime`, `PRAGMA`, `sqlite_master`, `GROUP_CONCAT`, `INSERT OR IGNORE`).
- Cutover ve rollback runbook'u dokumante ve en az 1 staging dry-run ile denenmis.

## Bu Revizyonla Birlikte Uretilen Dokumanlar

- `docs/POSTGRESQL_LIVE_SCHEMA_INVENTORY_2026-02-26.md`
- `docs/POSTGRESQL_SQL_UYUMLULUK_ENVANTERI_2026-02-26.md`

Bu iki dokuman bu planin teknik dayanaklaridir.
