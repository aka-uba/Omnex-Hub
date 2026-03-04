# Deploy, Backup ve Multi-Project Analizi

Tarih: 2026-03-04
Kapsam: `deploy/` altindaki mevcut Docker, script ve reverse proxy yapisinin; backup, restore, multi-tenant ve ayni sunucuda coklu proje calistirma acisindan degerlendirilmesi.

## Incelenen Dosyalar

- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `deploy/scripts/02-deploy-app.sh`
- `deploy/scripts/03-restore-backup.sh`
- `deploy/nginx/nginx.conf`
- `deploy/nginx/conf.d/default.conf`
- `deploy/DEPLOYMENT.md`

## Mevcut Yapi Ozeti

Mevcut production stack tek kurulum mantigi ile tasarlanmis:

- 1 adet PostgreSQL container
- 1 adet uygulama container
- 1 adet Nginx reverse proxy
- 1 adet Certbot container

Bu yapi tek domain, tek app stack ve tek veritabani icin yeterli. Ancak ayni host uzerinde birden fazla bagimsiz proje veya birden fazla bagimsiz musteri stack'i calistirmak icin dogrudan uygun degildir.

## Tespit Edilen Kritik Noktalar

### 1. Tek stack varsayimi

`docker-compose.yml` icinde sabit `container_name` kullaniliyor:

- `omnex-postgres`
- `omnex-app`
- `omnex-nginx`
- `omnex-certbot`

Bu nedenle ikinci bir compose stack ayni hostta ayni dosya yapisi ile ayaga kalkarsa container isimleri cakisir.

### 2. Sabit port kullanimi

Host port baglamalari sabit:

- `80:80`
- `443:443`
- `127.0.0.1:8080:80`
- `127.0.0.1:5432:5432`

Bu da ikinci bagimsiz stack icin port cakismasi uretir.

### 3. Deploy script parametrik degil

`02-deploy-app.sh` icinde:

- `APP_DIR="/opt/omnex-hub"`

Sabit tanimli. Script tek uygulama dizinini hedefliyor. Coklu proje senaryosunda ayni script'i guvenli sekilde tekrar kullanmak mumkun degil.

### 4. Nginx tek upstream mantiginda

`default.conf` icinde:

- tek `upstream app_backend`
- `server_name _;`

Yani domain bazli birden fazla farkli app stack route etme mantigi yok. Su anki kurgu tek uygulama icin wildcard reverse proxy mantiginda.

### 5. Backup script yok, restore script tum sistemi geri yukluyor

`deploy/` altinda hazir bir backup alma script'i yok. Sadece `03-restore-backup.sh` var.

Bu restore script:

- mevcut DB'yi `DROP DATABASE` ile siliyor
- veritabanini bastan olusturuyor
- tum `storage` dosyalarini geri yukluyor

Bu yaklasim sadece "tam sistem geri donus" icin uygun. Tek bir firmayi secip geri getirmek icin uygun degil.

## Backup Konusu: Firma Bazli Yedek Mumkun mu?

### Kisa cevap

Evet, fakat Docker volume seviyesinde degil; uygulama/veri modeli seviyesinde.

### Neden?

Tek PostgreSQL veritabani icinde birden fazla firma tutuldugunda:

- volume backup = tum veritabaninin yedegi
- `pg_dump` full dump = tum tenantlarin yedegi

Dolayisiyla Docker veya volume snapshot mantigi ile "sadece firma X" yedegi alinmaz.

### Firma bazli yedek nasil olur?

Firma bazli yedek ancak `company_id` uzerinden iliskili tum tablolar secilip mantiksal export yapilarak alinabilir.

Ornek kapsam:

- `companies`
- `users`
- `devices`
- `licenses`
- `playlists`
- `products`
- ilgili `company_id` kolonlu diger tablolar

Bu, ayri bir "tenant export/import" araci gerektirir.

## Restore Riski

Su anki restore mantiginda tek full dump geri yuklenirse tum firmalar etkilenir. Bu nedenle:

- full restore sadece felaket kurtarma senaryosunda kullanilmali
- tek firma geri yuklemesi icin ayri araca ihtiyac var

Tek full SQL dump icinden bir firmayi manuel ayiklayip geri yuklemek teorik olarak mumkun olsa da operasyonel olarak risklidir.

## Onerilen Backup Stratejisi

### 1. Gunluk tam backup

Her gun:

- PostgreSQL full dump
- `storage` volume kopyasi
- tercihen `deploy/.env` ve aktif Nginx config snapshot

### 2. Retention

En az 5 gunluk saklama:

- son 5 gun tutulur
- daha eski arsivler silinir veya soguk depoya tasinir

### 3. Off-site kopya

Yedekler sadece ayni sunucuda tutulmamalidir. Munkunse:

- S3 uyumlu object storage
- farkli disk
- farkli sunucu

kullanilmalidir.

### 4. Tenant export/import

Multi-tenant yapi icin full backup'a ek olarak:

- firma bazli export
- firma bazli import

araci yazilmalidir.

Bu olmadan tek firma restore guvenli kabul edilmemelidir.

## Kucuk ve Buyuk Musteri Icın Onerilen Mimari

### Kucuk olcekli firmalar

Tek multi-tenant proje:

- tek app
- tek DB
- uygulama icinde firma izolasyonu

Bu model maliyet ve operasyon acisindan verimlidir.

### Buyuk firmalar

Dedicated stack:

- ayri app
- ayri DB
- ayri storage
- ayri domain veya subdomain

Bu modelde restore, performans ve izolasyon daha kontrolludur.

## Ayni Sunucuda Coklu Proje Calistirma

### Mevcut haliyle

Dogrudan uygun degil.

### Gerekli duzenlemeler

1. `container_name` kullanimi kaldirilmali
2. Host portlari stack bazli parametrik hale getirilmeli veya tamamen internal yapilmali
3. `02-deploy-app.sh` parametre kabul etmeli:
   - `APP_DIR`
   - `COMPOSE_FILE`
   - `ENV_FILE`
   - `PROJECT_NAME`
   - `DOMAIN`
4. Her stack ayri compose project olarak calismali
5. Ortak bir reverse proxy katmani olusturulmali

## Domain / Subdomain Senaryosu

Tek bulut sunucuda su model uygundur:

- `panel.ornek.com` -> kucuk musterilerin paylastigi multi-tenant stack
- `buyuk-a.ornek.com` -> buyuk musteri icin ayri stack
- `buyuk-b.ornek.com` -> diger buyuk musteri icin ayri stack

Alternatif olarak tam ayri domainler de ayni mantikla route edilebilir.

Mevcut `deploy/nginx` ayari tek upstream oldugu icin bu senaryo icin yeterli degildir. Domain bazli birden fazla upstream yonetimi gerekir.

## Reverse Proxy Onerisi

Coklu stack icin en temiz cozum:

- ortak host-level Nginx
veya
- Traefik
veya
- Caddy

Bu proxy:

- domain/subdomain'e gore ilgili stack'e yonlendirir
- SSL sertifikalarini merkezi yonetir

Her uygulama stack'i ise:

- sadece internal portta
veya
- `127.0.0.1` ustunde benzersiz local portta

calisir.

## Odeme Para Birimi Notu

Kod seviyesi incelemesine gore sistem sadece TL tahsilata tamamen kilitli degil:

- Iyzico tarafinda request currency kullanilacak sekilde guncellenmis durumda
- Paynet tarafinda da currency field destekleniyor

Ancak gercek hayatta USD/EUR tahsilat alinabilmesi su kosullara baglidir:

- odeme saglayici hesabinda ilgili currency aktif olmali
- settlement kurallari tanimli olmali
- muhasebe ve raporlama akisi buna uygun olmali

Yani kod destegi tek basina yeterli degildir; saglayici hesap konfigrasyonu da dogrulanmalidir.

## Sonuc

Mevcut deploy yapisi:

- tek stack icin yeterli
- tam sistem backup/restore icin temel seviyede yeterli

Ancak su konularda eksiktir:

- 5 gun retention'li otomatik backup
- firma bazli mantiksal yedek / restore
- ayni sunucuda coklu bagimsiz proje
- domain/subdomain bazli coklu stack reverse proxy

## Uygulanan Degisiklikler (2026-03-04)

Analizde tespit edilen 4 maddeden 3'u ayni gun uygulanmistir:

### 1. Backup Scripti — TAMAMLANDI

`deploy/scripts/04-backup.sh` olusturuldu.

Icerdigi ozellikler:
- PostgreSQL full dump (`pg_dump --clean --if-exists`)
- Storage volume kopyasi (`docker cp`)
- `.env` snapshot (sifreler maskelenmis)
- Nginx config snapshot
- `backup-info.json` metadata dosyasi
- 5 gun retention (configurable `--retention N`)
- Archive integrity dogrulamasi (`tar -tzf`)
- Cron uyumlu (timestamped log ciktisi)
- `--project-dir`, `--backup-dir` parametreleri ile herhangi bir stack'i yedekleyebilir

Yedek dizin yapisi:
```
/opt/omnex-backups/
├── omnex/                    # Standalone stack
│   └── omnex_20260304_030000.tar.gz
├── panel/                    # Multi-project: panel
└── customer-a/               # Multi-project: customer-a
```

Cron ornegi:
```
0 3 * * * /opt/omnex-hub/deploy/scripts/04-backup.sh >> /var/log/omnex-backup.log 2>&1
```

### 2. Parametrik Deploy Altyapisi — TAMAMLANDI

Yapilan degisiklikler:

**docker-compose.yml** yeniden yapilandirildi:
- Tum `container_name` satirlari kaldirildi
- `COMPOSE_PROJECT_NAME` ile Docker seviyesinde stack izolasyonu saglandi
- `APP_PORT` env degiskeni ile her stack'e benzersiz localhost portu atanabiliyor
- `nginx` ve `certbot` servisleri ayri overlay dosyasina tasindi
- PostgreSQL portu host'a expose edilmiyor (sadece internal)
- Network mapping formatina gecirildi (compose merge uyumlulugu)

**docker-compose.standalone.yml** olusturuldu:
- Nginx reverse proxy + Certbot SSL servisleri
- Tek sunucu kurulumu icin kullanilir
- Kullanim: `docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d`

**docker-compose.proxy.yml** olusturuldu:
- Traefik labels (router, service, middleware)
- Rate limiting middleware (100 req/s, burst 50)
- Security headers middleware (HSTS, X-Frame-Options, nosniff, XSS filter)
- `omnex-proxy` shared external network baglantisi
- Kullanim: `docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d`

**.env.example** guncellendi:
- `COMPOSE_PROJECT_NAME` — stack izolasyon ismi
- `DEPLOY_MODE` — `standalone` veya `multi`
- `APP_PORT` — her stack icin benzersiz localhost portu

**02-deploy-app.sh** tamamen yeniden yazildi:
- `--mode standalone|multi` parametresi
- `--project-dir` parametresi (sabit `/opt/omnex-hub` yerine)
- Otomatik compose file kombinasyonu (mode'a gore)
- Multi modda `omnex-proxy` network varlik kontrolu
- Parametrik health check (`APP_PORT` kullanir)

**03-restore-backup.sh** tamamen yeniden yazildi:
- `--project-dir` ve `--mode` parametreleri
- `COMPOSE_PROJECT_NAME` ile dogru stack'i hedefler
- `backup-info.json` varsa gosterir
- Parametrik health check

**init-db/01-init.sql** parametrik hale getirildi:
- `ALTER DATABASE omnex_hub` → `current_database()` (DO block ile)
- `GRANT ... TO omnex` → `current_user` (DO block ile)
- Herhangi bir `POSTGRES_DB` / `POSTGRES_USER` degeri ile calisir

**01-initial-setup.sh** guncellendi:
- `/opt/omnex-backups` dizini olusturma eklendi
- `docker network create omnex-proxy` (shared network) eklendi

### 3. Tenant Export/Import — ERTELENDI

Firma bazli mantiksal yedek/restore araci henuz yazilmadi.
Bu is uygulama/veri modeli seviyesinde ayri bir gelistirme gerektirir.
Acil degil, ihtiyac duyuldugunda ayri bir gelistirme olarak planlanacak.

### 4. Ortak Reverse Proxy — TAMAMLANDI

**Tercih edilen teknoloji:** Traefik v3.3

Neden Traefik:
- Docker label'lari ile otomatik servis kesfi (yeni stack ekleyince manuel config gerekmiyor)
- Let's Encrypt otomatik SSL yonetimi
- Dashboard ile gorunurluk
- Nginx'e gore coklu stack senaryosunda operasyonel olarak daha basit

Olusturulan dosyalar:

**deploy/proxy/docker-compose.yml** — Shared Traefik servisi:
- Traefik v3.3 image
- Docker provider (auto-discovery, `exposedbydefault=false`)
- Let's Encrypt ACME (HTTP challenge)
- HTTP → HTTPS otomatik redirect
- Dashboard (basic auth korumalı, `traefik.PROXY_DOMAIN` adresinde)
- File provider (opsiyonel manuel override icin `dynamic/` dizini)
- 512MB memory limit
- Access log ve error log (configurable level)

**deploy/proxy/.env.example** — Proxy ayarlari:
- `ACME_EMAIL` — Let's Encrypt bildirim emaili
- `PROXY_DOMAIN` — Base domain
- `DASHBOARD_AUTH` — htpasswd hash

**deploy/proxy/dynamic/.gitkeep** — Opsiyonel manuel Traefik kuralları icin dizin

**deploy/scripts/05-proxy-setup.sh** — Proxy yonetim scripti:
- `start` — Traefik'i baslat (shared network olusturma dahil)
- `stop` — Traefik'i durdur
- `status` — Container durumu + bagli stack listesi
- `logs` — Canli log takibi
- `restart` — Yeniden baslat

### Mimari Sonuc

Iki deploy modu destekleniyor:

**Standalone (tek sunucu):**
```
Internet → Nginx:443 → App:80 → PostgreSQL
```

**Multi-project (coklu stack):**
```
Internet → Traefik:443
              ├→ panel.ornek.com      → Stack "panel"      (app + postgres)
              ├→ buyuk-a.ornek.com    → Stack "customer-a"  (app + postgres)
              └→ buyuk-b.ornek.com    → Stack "customer-b"  (app + postgres)
```

### Dosya Envanteri

| Dosya | Durum | Aciklama |
|-------|-------|----------|
| `docker-compose.yml` | Degistirildi | Base stack (postgres + app), container_name kaldirildi |
| `docker-compose.standalone.yml` | Yeni | Nginx + Certbot overlay |
| `docker-compose.proxy.yml` | Yeni | Traefik labels + shared network overlay |
| `docker-compose.local.yml` | Degismedi | Lokal test (bagimsiz) |
| `.env.example` | Degistirildi | COMPOSE_PROJECT_NAME, DEPLOY_MODE, APP_PORT eklendi |
| `Dockerfile` | Degismedi | PHP 8.4 Apache image |
| `init-db/01-init.sql` | Degistirildi | current_database() / current_user ile parametrik |
| `nginx/*` | Degismedi | Standalone mod icin korundu |
| `proxy/docker-compose.yml` | Yeni | Shared Traefik reverse proxy |
| `proxy/.env.example` | Yeni | Proxy ayarlari |
| `proxy/dynamic/.gitkeep` | Yeni | Opsiyonel manuel kurallar dizini |
| `scripts/01-initial-setup.sh` | Degistirildi | Backup dizini + shared network eklendi |
| `scripts/02-deploy-app.sh` | Degistirildi | Parametrik, standalone/multi mod destegi |
| `scripts/03-restore-backup.sh` | Degistirildi | Parametrik, project-dir/mode destegi |
| `scripts/04-backup.sh` | Yeni | Otomatik yedek, 5 gun retention |
| `scripts/05-proxy-setup.sh` | Yeni | Traefik proxy yonetimi |
| `DEPLOYMENT.md` | Degistirildi | Her iki mod icin tam rehber |

---

Bu dokuman, 2026-03-04 tarihinde yapilan mevcut durum analizini ve ayni gun uygulanan degisiklikleri kayda gecirmek icin olusturulmustur.
