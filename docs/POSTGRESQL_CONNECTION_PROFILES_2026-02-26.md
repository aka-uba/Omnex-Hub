# PostgreSQL Connection Profiles (local / docker / server)

Tarih: 26 Subat 2026
Kapsam: `config.php` + `core/Database.php` coklu ortam baglanti yapilandirmasi

## Desteklenen ayarlar

- `OMNEX_DB_DRIVER`: `sqlite` veya `pgsql`
- `OMNEX_DB_PROFILE`: `local`, `docker`, `server`
- `DATABASE_URL` veya `OMNEX_DB_URL`: tam baglanti URL/DSN (oncelikli)
- Parcali ayarlar:
  - `OMNEX_DB_HOST`
  - `OMNEX_DB_PORT`
  - `OMNEX_DB_NAME`
  - `OMNEX_DB_USER`
  - `OMNEX_DB_PASS`
  - `OMNEX_DB_SSLMODE`
  - `OMNEX_DB_CONNECT_TIMEOUT`
  - `OMNEX_DB_APP_NAME`
  - `OMNEX_DB_SEARCH_PATH`

## Cozumleme sirasi

1. `DATABASE_URL` (varsa kullanilir)
2. `OMNEX_DB_URL` (varsa kullanilir)
3. `OMNEX_DB_*` parcali ayarlar

Notlar:
- URL formati hem `postgresql://...` hem `pgsql:...` DSN olarak desteklenir.
- `search_path`, `schema`, `currentschema` query parametreleri okunur.
- `OMNEX_DB_PROFILE=docker` ise host default `postgres` olur.
- `OMNEX_DB_PROFILE=local/server` ise host default `127.0.0.1` olur.

## Ornek dosyalar

- `/.env.postgresql.local.example`
- `/.env.postgresql.docker.example`
- `/.env.postgresql.server.example`

## Hizli test

PowerShell (gecici session env):

```powershell
$env:OMNEX_DB_DRIVER = "pgsql"
$env:OMNEX_DB_PROFILE = "local"
$env:OMNEX_DB_HOST = "127.0.0.1"
$env:OMNEX_DB_PORT = "5432"
$env:OMNEX_DB_NAME = "market_etiket"
$env:OMNEX_DB_USER = "postgres"
$env:OMNEX_DB_PASS = "postgres"
php tools/postgresql/check_connection.php
```

Beklenen:
- `PostgreSQL connection OK`
- DB versiyonu, aktif search_path, server adresi/port bilgisi

## Docker ornek env

```env
OMNEX_DB_DRIVER=pgsql
OMNEX_DB_PROFILE=docker
OMNEX_DB_HOST=postgres
OMNEX_DB_PORT=5432
OMNEX_DB_NAME=market_etiket
OMNEX_DB_USER=market_user
OMNEX_DB_PASS=market_pass
OMNEX_DB_SSLMODE=disable
```

## Server ornek env

```env
OMNEX_DB_DRIVER=pgsql
OMNEX_DB_PROFILE=server
OMNEX_DB_HOST=127.0.0.1
OMNEX_DB_PORT=5432
OMNEX_DB_NAME=market_etiket
OMNEX_DB_USER=market_app
OMNEX_DB_PASS=change_this_password
OMNEX_DB_SSLMODE=require
```

## Operasyonel kontrol listesi

- PHP tarafinda `pdo_pgsql` extension aktif.
- PostgreSQL tarafinda `core,license,catalog,branch,labels,media,devices,signage,integration,audit,legacy` schema'lari olusmus.
- Uygulama migration adimi `database/postgresql/v2` dosyalarini tamamliyor.
- Uretimde `OMNEX_DB_PASS` ve TLS politikasi zorunlu (`sslmode=require` veya daha siki).

## XAMPP (Windows) notu

`pdo_pgsql` aktif degilse:

1. `C:\xampp\php\php.ini` icinde satirlari aktif et:
   - `extension=pdo_pgsql`
   - `extension=pgsql`
2. Apache'yi yeniden baslat.
3. `php -m | rg pgsql` ile extension yuklu mu kontrol et.

## Tek komut kurulum (Windows)

- `scripts/setup-postgresql-local.bat`
  - `.env.local` degerlerini okur
  - DB yoksa olusturur
  - baglantiyi dogrular
  - migration + seed calistirir

## Local server baslatma (Windows)

- `scripts/start-postgresql-local.bat`
  - PHP built-in server'i `http://127.0.0.1:8080` adresinde baslatir

## Docker (app + postgres)

Hazir compose:
- `/docker-compose.postgresql.yml`
- `/docker/php/Dockerfile`

Windows komutlari:
- `scripts/docker-postgresql-up.bat`
  - image build + container up + migrate/seed
- `scripts/docker-postgresql-down.bat`
  - container stop/remove
- `scripts/docker-postgresql-reset.bat`
  - container + volume reset (temiz DB)

Portlar:
- App: `http://localhost:8081`
- PostgreSQL: `localhost:5433` (container ici 5432)

## 26 Subat 2026 Dogrulama Notu (Mevcut Durum)

- Yerel PostgreSQL + XAMPP ortaminda `pdo_pgsql` ile uygulama calisti.
- Moduler schema (`database/postgresql/v2`) ve seed sonrasi admin panel endpointleri 200 verdi.
- Docker profiline gore env ayrimi dogrulandi:
  - `local`: host `127.0.0.1`, port `5432`
  - `docker`: host `postgres`, container ici port `5432`
  - `server`: host/port TLS kurallarina gore dis ortam

Runtime stabilizasyon ozeti icin:
- `docs/POSTGRESQL_SQL_UYUMLULUK_GUNCEL_DURUM_2026-02-26.md`
