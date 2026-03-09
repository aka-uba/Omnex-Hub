# CLAUDE.md - Omnex Display Hub Gelistirme Rehberi

Bu dosya, Claude AI asistaninin projeyi anlamasi ve devam ettirmesi icin olusturulmustur.
Son guncelleme: 2026-03-08 (v2.0.24)

---

## Codex-Style Workflow (Kalici Calisma Hafizasi)

Bu proje, her gorevde hizli ve tutarli ilerlemek icin kalici hafiza dosyalari kullanir.

### Proje yolu

`C:\xampp\htdocs\market-etiket-sistemi`

### Zorunlu baslangic adimlari (her gorevde)

1. `AGENTS.md` dosyasini oku.
2. `.codex/PROJECT_SNAPSHOT.md` dosyasini oku.
3. `.codex/WORKFLOW.md` dosyasini oku.
4. `.codex/CHANGE_MEMORY.md` dosyasinin son kayitlarini (en az son 80 satir) oku.
5. Gerekirse derin baglam icin `.claude/CLAUDE.md` icerigini referans al.

### Calisma yontemi

- Istek geldiginde once ilgili dosyalari analiz et, sonra minimum gerekli degisikligi yap.
- Mevcut kod stilini koru.
- Gereksiz refactor yapma.
- Cok dosyali buyuk degisiklik yerine kontrollu, kucuk adimlarla ilerle.
- Hardcoded kullanici metni ekleme; i18n key kullan.
- Eklenen/guncellenen her kullanici metni icin desteklenen 8 dilin tamamina ceviri ekle.
- Yerel dil karakterlerini koru; ceviri metinlerinde diakritikleri/asli karakterleri ASCII'ye indirgeyip bozma.

### Dogrulama (zorunlu)

- Degisen dosya tipine gore `.codex/QUICK_CHECKS.md` icindeki komutlari calistir.
- En az bir sozdizimi/dogrulama kontrolu yap.
- Kontrol yapilmadiysa sebebini acikca yaz.

### Hafiza guncelleme (zorunlu, her gorev sonunda)

`.codex/CHANGE_MEMORY.md` dosyasina yeni kayit ekle:

- Tarih
- Istek ozeti
- Yapilan degisiklik
- Degisen dosyalar
- Calistirilan kontroller
- Risk / takip aksiyonu

### Guvenlik kurallari

- Hafiza dosyalarina asla secret/token/parola/private key yazma.
- Loglari kisa, pratik ve gorev odakli tut.
- Her final yanitta neyin degistigi ve hangi kontrollerin calistigi net belirtilmeli.
- Dosya encoding'ini koru; yazim sirasinda encoding donusumu yapma.
- Bozulma/kayip riski olan dosyalarda temp yedekle calis ve gerekirse yedekten geri don.

---

## Proje Ozeti

**Omnex Display Hub**, market ve perakende sektorunde kullanilan:
- Elektronik Raf Etiketleri (ESL - Electronic Shelf Labels)
- Dijital Tabela Sistemleri (Digital Signage / TV)

icin merkezi yonetim platformudur.

**Teknik Tercih**: Framework kullanilmadan saf Vanilla JS + PHP + PostgreSQL ile gelistirilmistir.
**Not**: Proje baslangicta SQLite kullaniyordu, 2026-02 itibariyle PostgreSQL'e migrate edilmistir.

**Proje Hedefleri:**
- Surkle-birak etiket tasarim editoru (Fabric.js ile)
- ERP entegrasyonu (JSON, TXT, CSV, XML, XLSX)
- Multi-tenant yapi (Firma bazli izolasyon)
- Cihaz gruplari ve toplu gonderim
- Zamanlama ve otomasyon
- Lisans yonetimi
- Digital signage (TV/buyuk ekran) yayinlari
- WordPress benzeri medya kutuphanesi

---

## Mimari Kararlar

- **Vanilla JS**: Framework bagimsiz, hafif, tam kontrol
- **PostgreSQL 18**: Production veritabani (SQLite'tan migrate edildi, 2026-02-26)
- **Multi-Schema Mimari**: 11 ozel schema ile domain bazli tablo organizasyonu
- **Row Level Security (RLS)**: Veritabani seviyesinde multi-tenant izolasyon (39 policy)
- **Hash-Based Routing**: XAMPP/Apache'de ek yapilandirma gerektirmez (`#/dashboard` formati)
- **Dual DB Driver**: `Database.php` hem SQLite hem PostgreSQL destekler (`.env.local` ile secilir)

---

## Proje Yapisi

```
market-etiket-sistemi/
├── api/                    # Backend API endpoint'leri
│   ├── auth/               # Login, logout, register, session
│   ├── products/           # Urun CRUD + import
│   ├── templates/          # Sablon CRUD + export/import
│   ├── devices/            # Cihaz CRUD + scan + control
│   ├── media/              # Medya upload, browse, scan, serve
│   ├── categories/         # Kategori CRUD
│   ├── playlists/          # Playlist CRUD
│   ├── schedules/          # Zamanlama CRUD
│   ├── users/              # Kullanici CRUD
│   ├── companies/          # Firma CRUD (Admin)
│   ├── licenses/           # Lisans yonetimi (Admin)
│   ├── device-groups/      # Cihaz gruplari
│   ├── audit-logs/         # Islem gecmisi (Admin) + arsivleme
│   ├── notifications/      # Bildirim sistemi
│   ├── settings/           # Ayarlar
│   ├── reports/            # Dashboard stats
│   ├── layout/             # Menu ve config
│   ├── branding/           # Logo/favicon upload
│   ├── esl/                # ESL cihaz entegrasyonu
│   ├── player/             # PWA Player API
│   ├── hanshow/            # Hanshow ESL entegrasyonu
│   ├── hal/                # HAL Kunye verileri
│   ├── tamsoft/            # TAMSOFT ERP entegrasyonu
│   ├── render-queue/       # Render kuyruk yonetimi
│   ├── payments/           # Iyzico/Paynet odeme
│   ├── label-sizes/        # Etiket boyutlari
│   ├── production-types/   # Uretim sekilleri
│   └── proxy/              # Web sayfasi proxy
├── core/                   # PHP core siniflar
│   ├── Auth.php            # JWT islemleri
│   ├── Database.php        # PDO wrapper + migrations
│   ├── Router.php          # API route eslestirme
│   ├── Request.php         # HTTP istek parsing
│   ├── Response.php        # JSON response helper
│   ├── Security.php        # Guvenlik fonksiyonlari
│   ├── Validator.php       # Veri dogrulama
│   ├── Logger.php          # Log islemleri
│   └── Cache.php           # Dosya versiyon hash
├── middleware/             # API middleware
│   ├── AuthMiddleware.php  # JWT dogrulama
│   ├── AdminMiddleware.php # Admin yetkisi kontrolu
│   ├── LicenseMiddleware.php # Lisans kontrolu
│   ├── CsrfMiddleware.php  # CSRF token dogrulama
│   ├── RateLimitMiddleware.php
│   ├── InputSanitizeMiddleware.php # SQL/XSS filtreleme
│   ├── ApiGuardMiddleware.php      # Origin/CORS kontrolu
│   └── DeviceAuthMiddleware.php    # Cihaz JWT dogrulama
├── services/               # Servis siniflari
│   ├── PavoDisplayGateway.php    # PavoDisplay ESL iletisim
│   ├── HanshowGateway.php       # Hanshow ESL iletisim
│   ├── TamsoftGateway.php        # TAMSOFT ERP entegrasyonu
│   ├── HalKunyeScraper.php       # HAL kunye sorgulama
│   ├── HalKunyeService.php       # HAL SOAP API
│   ├── HalDataResolver.php       # Sube bazli HAL veri cozumleme
│   ├── IyzicoGateway.php         # Iyzico odeme
│   ├── PaynetGateway.php         # Paynet odeme
│   ├── RenderQueueService.php    # Render kuyruk yonetimi
│   ├── NotificationService.php   # Bildirim gonderimi
│   ├── NotificationTriggers.php  # Otomatik tetikleyiciler
│   ├── CompanySeeder.php         # Yeni firma varsayilan verileri
│   ├── TemplateRenderer.php      # HTML sablon render
│   ├── SmartFieldMapper.php      # Import alan eslestirme
│   └── dal/                      # Device Abstraction Layer (DAL)
│       ├── DeviceAdapterInterface.php  # Adapter kontrati
│       ├── AbstractDeviceAdapter.php   # Temel adapter sinifi
│       ├── DeviceAdapterRegistry.php   # Singleton adapter registry
│       ├── GatewayBridgeDecorator.php  # Gateway kopruleme decorator
│       └── adapters/                   # Adapter uygulamalari
│           ├── PavoDisplayAdapter.php  # PavoDisplayGateway sarici
│           ├── HanshowAdapter.php      # HanshowGateway sarici
│           ├── MqttDeviceAdapter.php   # MQTT adapter
│           ├── PwaPlayerAdapter.php    # PWA Player adapter
│           └── NullAdapter.php         # Fallback adapter
├── database/
│   ├── migrations/         # SQLite migration dosyalari (001-101, sadece SQLite icin)
│   ├── postgresql/v2/      # PostgreSQL modular schema dosyalari (aktif)
│   │   ├── 00_extensions.sql    # pgcrypto, citext, pg_trgm
│   │   ├── 01_schemas.sql      # 11 schema tanimlari
│   │   ├── 10_core.sql         # companies, users, sessions, settings
│   │   ├── 11_license.sql      # licenses, plans, payments
│   │   ├── 12_catalog.sql      # products, categories, bundles
│   │   ├── 13_branch.sql       # branches, overrides
│   │   ├── 14_labels.sql       # templates, render_queue, label_sizes
│   │   ├── 15_media.sql        # media, folders, storage
│   │   ├── 16_devices.sql      # devices, groups, gateways, hanshow
│   │   ├── 17_signage.sql      # playlists, schedules, streaming
│   │   ├── 18_integration.sql  # tamsoft, hal, integrations
│   │   ├── 19_audit.sql        # audit_logs, notifications
│   │   ├── 20_legacy.sql       # Eski veri yedekleri
│   │   ├── 30_constraints.sql  # FK constraints (44 adet)
│   │   ├── 40_indexes.sql      # Indexes (320+ adet)
│   │   ├── 41_perf_indexes.sql # Performance indexes
│   │   ├── 42_devices_branch_indexes.sql
│   │   └── 70_rls.sql          # Row Level Security (39 policy)
│   ├── seeds/              # Seed dosyalari
│   └── omnex.db            # Eski SQLite DB (artik kullanilmiyor)
├── public/
│   ├── index.html          # SPA shell
│   ├── sw.js               # Service Worker
│   └── assets/
│       ├── js/
│       │   ├── app.js      # Ana uygulama
│       │   ├── core/       # Router, Api, Auth, State, i18n, Logger, CacheManager, DeviceRegistry
│       │   ├── pages/      # Sayfa bilesenleri
│       │   ├── components/ # UI bilesenleri (Modal, DataTable, Toast, vb.)
│       │   ├── layouts/    # LayoutManager
│       │   ├── utils/      # ExportManager, BarcodeUtils
│       │   └── services/   # BluetoothService
│       └── css/
│           ├── main.css        # Master CSS import
│           ├── global.css      # Base styles, variables, utilities
│           ├── global-dark.css # Dark mode overrides
│           ├── components/     # UI component styles
│           ├── layouts/        # Layout styles (sidebar, header, content)
│           └── pages/          # Page-specific styles
├── public/player/          # PWA Signage Player
│   ├── index.html          # Player shell
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Player Service Worker
│   └── assets/             # Player JS/CSS
├── gateway/                # Lokal gateway agent
│   └── gateway.php         # PavoDisplay + Hanshow kopruleme
├── workers/                # Arka plan worker'lari
│   └── RenderQueueWorker.php
├── storage/                # Yuklemeler ve loglar
├── locales/                # Dil dosyalari (tr, en, ru, az, de, nl, fr)
│   ├── {lang}/common.json
│   └── {lang}/pages/*.json
├── parsers/                # Import parser'lari
├── mappings/               # Field mapping dosyalari
├── config.php              # Yapilandirma sabitleri
└── docs/                   # Dokumantasyon
```

---

## Kritik Dosyalar

### Backend Core

| Dosya | Islev |
|-------|-------|
| `config.php` | Yapilandirma sabitleri, PRODUCTION_MODE, JWT_SECRET, DB ayarlari |
| `.env.local` | PostgreSQL baglanti bilgileri (OMNEX_DB_DRIVER=pgsql) |
| `core/Database.php` | Dual SQLite/PostgreSQL PDO wrapper, migration runner, RLS setAppContext(), generateUuid() |
| `core/Auth.php` | JWT token olusturma/dogrulama, hashPassword() |
| `core/Router.php` | API route eslestirme |
| `core/Request.php` | HTTP istek parsing, getRouteParam() |
| `core/Response.php` | JSON response helper (success, error, unauthorized) |
| `api/index.php` | API giris noktasi ve route tanimlari |
| `services/dal/DeviceAdapterRegistry.php` | DAL adapter cozumleme (singleton) |
| `services/dal/DeviceAdapterInterface.php` | DAL adapter kontrati |

### Frontend Core

| Dosya | Islev |
|-------|-------|
| `public/index.html` | SPA shell, CSS/JS imports |
| `public/assets/js/app.js` | Ana uygulama, route tanimlari, sayfa yukleyici |
| `public/assets/js/core/Router.js` | Hash-based SPA router |
| `public/assets/js/core/Api.js` | HTTP client, token yonetimi, X-Active-Company header |
| `public/assets/js/core/Auth.js` | Kimlik dogrulama state |
| `public/assets/js/core/State.js` | Global state yonetimi |
| `public/assets/js/core/i18n.js` | Coklu dil destegi, loadPageTranslations() |
| `public/assets/js/core/Logger.js` | Production-aware console loglama |
| `public/assets/js/core/DeviceRegistry.js` | Merkezi cihaz tipi tanimlari ve yetenek kontrolu |
| `public/assets/js/layouts/LayoutManager.js` | Sidebar, header, tema, company selector |

---

## Mevcut Sayfalar ve Route'lari

### Ana Sayfalar

| Route | Dosya | Durum |
|-------|-------|-------|
| `/login` | auth/Login.js | Calisir |
| `/register` | auth/Register.js | Calisir |
| `/forgot-password` | auth/ForgotPassword.js | UI hazir |
| `/dashboard` | Dashboard.js | Calisir |
| `/products` | products/ProductList.js | Calisir |
| `/products/new`, `/products/:id/edit` | products/ProductForm.js | Calisir |
| `/products/import` | products/ProductImport.js | Calisir |
| `/products/:id` | products/ProductDetail.js | UI hazir |
| `/templates` | templates/TemplateList.js | Calisir |
| `/templates/editor` | templates/TemplateEditor.js | Calisir (Fabric.js) |
| `/devices` | devices/DeviceList.js | Calisir |
| `/devices/groups` | devices/DeviceGroups.js | Calisir |
| `/devices/:id` | devices/DeviceDetail.js | UI hazir |
| `/media` | media/MediaLibrary.js | Calisir |
| `/signage/playlists` | signage/PlaylistList.js | Calisir |
| `/signage/playlists/:id` | signage/PlaylistDetail.js | Calisir |
| `/signage/schedules` | signage/ScheduleList.js | UI hazir |
| `/signage/schedules/:id` | signage/ScheduleForm.js | Calisir |
| `/categories` | categories/CategoryList.js | Calisir |
| `/reports` | reports/DashboardAnalytics.js | UI hazir |
| `/settings` | settings/GeneralSettings.js | Calisir |
| `/settings/users` | settings/UserSettings.js | UI hazir |
| `/settings/integrations` | settings/IntegrationSettings.js | Calisir |
| `/profile` | settings/Profile.js | UI hazir |
| `/notifications` | notifications/NotificationList.js | Calisir |
| `/notifications/settings` | notifications/NotificationSettings.js | Calisir |
| `/queue` | queue/QueueDashboard.js | Calisir |

### Admin Sayfalari (SuperAdmin/Admin)

| Route | Dosya |
|-------|-------|
| `/admin/users` | admin/UserManagement.js |
| `/admin/companies` | admin/CompanyManagement.js |
| `/admin/licenses` | admin/LicenseManagement.js |
| `/admin/audit-log` | admin/AuditLog.js |
| `/admin/system-status` | admin/SystemStatus.js |

---

## Onemli Desenler

### 1. Sayfa Yasam Dongusu ve preload() Pattern

```javascript
// app.js - Sayfa yuklemesi
async loadPage(pageName) {
    const module = await import(`./pages/${pageName}.js`);
    const PageClass = module.default;
    const page = new PageClass(this);  // app instance gecirilir

    // 1. preload() - Ceviriler yuklenir (render'dan ONCE)
    if (page.preload) {
        await page.preload();
    }

    // 2. render() - HTML olusturulur
    container.innerHTML = page.render();

    // 3. init() - Event listener'lar baglanir, veri yuklenir
    page.init();
}
```

**KRITIK**: Sayfalar i18n cevirilerini `preload()` metodunda yuklemeli, `init()` metodunda DEGIL!
Aksi halde `render()` cagrildiginda ceviriler henuz yuklenmemis olur ve key'ler gorunur.

**Dogru sayfa sinifi yapisi:**

```javascript
export class MyPage {
    constructor(app) {
        this.app = app;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('mypage');
    }

    render() {
        return `<h1>${this.__('list.title')}</h1>`;
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}
```

### 2. API Cagrilari

```javascript
// Sayfa icinden (this.app uzerinden)
await this.app.api.get('/products');
await this.app.api.post('/products', data);
await this.app.api.put('/products/123', data);
await this.app.api.delete('/products/123');
await this.app.api.upload('/media/upload', formData);
await this.app.api.download('/products/export', 'products.csv', { format: 'csv' });

// YANLIS (static cagri):
await Api.get('/products');  // CALISMAZ!
```

### 3. State Erisimi

```javascript
const user = this.app.state.get('user');
this.app.state.set('key', value);

// YANLIS:
State.get('user');  // CALISMAZ!
```

### 4. Routing

```javascript
// Hash-based navigation
window.location.hash = '#/dashboard';
this.app.router.navigate('/products');

// Link'lerde
<a href="#/products">Urunler</a>
```

### 5. Backend Auth Erisimi

```php
$user = Auth::user();           // AuthMiddleware tarafindan set edilir
$companyId = $user['company_id'];
$role = $user['role'];

// SuperAdmin aktif firma (Company Selector ile secilen)
$companyId = Auth::getActiveCompanyId();
```

### 6. Veritabani Kullanimi

```php
$db = Database::getInstance();

// Schema prefix GEREKMEZ - search_path otomatik cozumler
$user = $db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
$products = $db->fetchAll("SELECT * FROM products WHERE company_id = ?", [$companyId]);

// Insert - UUID otomatik atanir (NON_UUID_ID_TABLES haricinde)
$db->insert('products', [
    'name' => 'Test',
    'price' => 100
]);

$db->update('products', ['price' => 150], 'id = ?', [$id]);
$db->delete('products', 'id = ?', [$id]);

// PostgreSQL boolean kullanimi
$db->fetchAll("SELECT * FROM media WHERE is_public = true");  // DOGRU
// $db->fetchAll("SELECT * FROM media WHERE is_public = 1");  // YANLIS - PostgreSQL'de calismaz!

// Tablo/kolon var mi kontrolu
$db->tableExists('products');     // true
$db->columnExists('products', 'sku');  // true
$db->isPostgres();  // true
```

### 7. i18n Ceviri Kullanimi

```javascript
// Sayfa icinden
const title = this.__('list.title');           // Sayfa cevirisi
const btn = this.__('actions.save');           // Common cevirisi
const msg = this.__('form.saved', { name: 'Test' }); // Parametre ile

// Global helper (bilesenler icin)
const text = __('actions.save');
```

**Ceviri arama sirasi:** Sayfa cevirileri -> Common cevirileri -> Fallback dil (en) -> Key

**Dil dosyalari:** `locales/{lang}/common.json` + `locales/{lang}/pages/{page}.json`

### 8. Modal Kullanimi

```javascript
import { Modal } from '../../components/Modal.js';

Modal.show({
    title: 'Baslik',
    icon: 'ti-info-circle',
    content: '<p>Icerik HTML</p>',
    size: 'md',  // sm, md, lg
    confirmText: 'Kaydet',
    cancelText: 'Iptal',
    onConfirm: async () => { await this.save(); }
});

Modal.confirm({
    title: 'Silme Onayi',
    message: 'Bu kaydi silmek istiyor musunuz?',
    type: 'danger',
    onConfirm: async () => { await this.delete(); }
});
```

### 9. DataTable Kullanimi

```javascript
import { DataTable } from '../../components/DataTable.js';

this.dataTable = new DataTable({
    container: '#products-table',
    columns: [
        { key: 'name', label: 'Urun Adi', sortable: true },
        { key: 'price', label: 'Fiyat', sortable: true, render: (val) => `${val} TL` },
    ],
    actions: [
        { name: 'edit', icon: 'ti-edit', label: 'Duzenle', onClick: (row) => this.edit(row.id) },
        { name: 'delete', icon: 'ti-trash', label: 'Sil', onClick: (row) => this.delete(row.id), class: 'text-red-500' }
    ],
    pagination: true,
    pageSize: 20,
    searchable: true,
    selectable: true,
    onSelectionChange: (selected) => this.handleSelection(selected)
});

this.dataTable.setData(products);
this.dataTable.setData(products, { total: 100, page: 1, perPage: 20 });
```

**Not:** DataTable dual constructor destekler: `new DataTable('#container', opts)` ve `new DataTable({ container: '#container', ...opts })`. Her action icin `name` property zorunludur.

### 10. Page Header Yapisi

```html
<div class="page-header">
    <div class="page-header-breadcrumb">
        <a href="#/dashboard">Panel</a>
        <span class="breadcrumb-separator">></span>
        <span class="breadcrumb-current">Urunler</span>
    </div>
    <div class="page-header-main">
        <div class="page-header-left">
            <div class="page-header-icon"><i class="ti ti-package"></i></div>
            <div class="page-header-info">
                <h1 class="page-title">Urun Listesi</h1>
                <p class="page-subtitle">Urunlerinizi yonetin</p>
            </div>
        </div>
        <div class="page-header-right">
            <button class="btn btn-primary"><i class="ti ti-plus"></i> Yeni</button>
        </div>
    </div>
</div>
```

### 11. Toast Bildirimleri

```javascript
import { Toast } from '../../components/Toast.js';

Toast.success('Islem basarili');
Toast.error('Hata olustu');
Toast.warning('Dikkat');
Toast.info('Bilgi');
```

---

## Veritabani Yapisi (PostgreSQL 18)

### PostgreSQL Multi-Schema Mimarisi

Veritabani 11 ozel schema ile domain bazli organize edilmistir:

| Schema | Amac | Ana Tablolar |
|--------|------|-------------|
| `core` | Temel sistem | companies, users, sessions, permissions, settings, rate_limits, migrations |
| `license` | Lisans/odeme | licenses, license_plans, payment_settings, payment_transactions, device_pricing |
| `catalog` | Urun katalogu | products, categories, production_types, bundles, price_history |
| `branch` | Sube yonetimi | branches, product_branch_overrides, bundle_branch_overrides, user_branch_access |
| `labels` | Etiket/render | templates, render_queue, render_queue_items, render_jobs, label_sizes, render_cache |
| `media` | Medya yonetimi | media, media_folders, company_storage_usage |
| `devices` | Cihaz yonetimi | devices, device_groups, device_heartbeats, device_commands, gateways, hanshow_esls/queue/settings |
| `signage` | Dijital tabela | playlists, playlist_items, schedules, web_templates, transcode_queue, stream_access_logs |
| `integration` | Entegrasyonlar | tamsoft_settings/tokens/sync_logs, hal_data, integration_settings |
| `audit` | Denetim/bildirim | audit_logs, notifications, notification_recipients |
| `legacy` | Eski veri yedekleri | settings_backup |

**Toplam:** 89 tablo, 412 index, 44 FK constraint, 39 RLS policy

**PostgreSQL Extensions:**
- `pgcrypto` - UUID olusturma (`gen_random_uuid()`)
- `citext` - Case-insensitive text
- `pg_trgm` - Trigram benzerlik aramalari

### Search Path ve Schema Cozumleme

```php
// Database.php otomatik set eder:
SET search_path TO core, license, catalog, branch, labels, media, devices, signage, integration, audit, legacy, public
```

**ONEMLI**: SQL sorgularinda schema prefix GEREKMEZ. `search_path` sayesinde `SELECT * FROM products` otomatik olarak `catalog.products` tablosunu bulur. Tablo whitelist'i (`Database.php`) unqualified isimler kullanir.

### Row Level Security (RLS)

Multi-tenant izolasyon veritabani seviyesinde saglanir:

```php
// AuthMiddleware.php'de set edilir:
Database::getInstance()->setAppContext($companyId, $userId, $role);

// PostgreSQL session degiskenleri:
// current_setting('app.company_id') - RLS policy'lerde kullanilir
// current_setting('app.user_id')
// current_setting('app.role')
```

RLS policy ornegi: SuperAdmin tum kayitlari gorur, diger roller sadece kendi `company_id`'sine ait kayitlari gorur.

### Ana Tablolar (Schema Bazli)

**core schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| companies | Firmalar (multi-tenant) | id (uuid), name, code, status |
| users | Kullanicilar | id (uuid), company_id, first_name, last_name, email, role, avatar |
| sessions | JWT oturumlari | user_id, token, expires_at |
| permissions | Rol bazli izinler | role, resource, action |
| settings | Kullanici/sirket ayarlari | key, data (JSON), company_id, user_id |

**catalog schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| products | Urunler | id (uuid), company_id, sku, barcode, name, current_price, previous_price, category, group, images, videos |
| categories | Kategoriler | company_id, name, parent_id |
| production_types | Uretim sekilleri | company_id, name, color, status |
| bundles | Urun paketleri | company_id, name, products |

**labels schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| templates | Etiket sablonlari | id (uuid), company_id, content (Fabric.js JSON), device_types, grid_layout, scope |
| render_queue | Render kuyrugu | template_id, product_id, device_ids, priority, status |
| render_queue_items | Kuyruk cihaz itemlari | queue_id, device_id, status, retry_count |
| label_sizes | Etiket boyutlari | name, width, height, is_system, is_active |

**devices schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| devices | ESL/TV cihazlari | id (uuid), company_id, name, type, ip_address, status, adapter_id, device_brand |
| device_groups | Cihaz gruplari | id (uuid), company_id, name |
| device_tokens | Cihaz JWT token'lari | device_id, token, token_hash |
| device_sync_requests | Cihaz kayit istekleri | fingerprint, sync_code, status |
| device_heartbeats | Canli sinyaller | device_id, battery_level, uptime |
| gateways | Gateway agent'lari | company_id, name, status |
| hanshow_esls | Hanshow ESL | esl_id, company_id, status |

**media schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| media | Medya dosyalari | id (uuid), company_id, file_path, file_type, scope, is_public (boolean) |
| media_folders | Medya klasorleri | company_id, name, parent_id |
| company_storage_usage | Depolama kullanimi | company_id, used_bytes |

**integration schema:**

| Tablo | Aciklama | Onemli Alanlar |
|-------|----------|----------------|
| tamsoft_settings | TAMSOFT ERP ayarlari | company_id, api_url, username |
| tamsoft_tokens | OAuth2 token cache | company_id, access_token, expires_at |
| tamsoft_sync_logs | Sync gecmisi | company_id, total_items, inserted, updated, failed |

### Migration Sistemi (Dual-Track)

**PostgreSQL (aktif):** `database/postgresql/v2/` dizininde 17 modular SQL dosyasi. `Database::migratePostgresql()` ile calistirilir. `core.migrations` tablosunda `pg:` prefix ile takip edilir.

**SQLite (eski):** `database/migrations/` dizininde 101 incremental SQL dosyasi (001-101). Sadece SQLite driver aktifken calisir.

**Driver secimi:** `.env.local` dosyasinda `OMNEX_DB_DRIVER=pgsql` ile belirlenir.

### PostgreSQL Onemli Kurallar

| Kural | Aciklama |
|-------|----------|
| Boolean tipler | `is_public = true/false` kullanilmali (`= 1/0` calismaz!) |
| PRAGMA yok | `information_schema.columns` kullanilmali |
| UUID primary key | Cogu tablo `uuid DEFAULT gen_random_uuid()` kullanir |
| AUTOINCREMENT yok | `bigint GENERATED ALWAYS AS IDENTITY` kullanilir |
| datetime('now') yok | `now()` veya `CURRENT_TIMESTAMP` kullanilir |
| INSERT OR IGNORE yok | `INSERT ... ON CONFLICT DO NOTHING` kullanilir |
| Schema prefix gereksiz | `search_path` otomatik cozumler |

---

## Tam API Route Listesi

```php
// CSRF Token (Public)
GET  /api/csrf-token

// Auth (Public)
POST /api/auth/login
POST /api/auth/register
POST /api/auth/refresh-token
POST /api/auth/forgot-password
POST /api/auth/reset-password

// Auth (Protected)
GET  /api/auth/session
POST /api/auth/logout
POST /api/auth/change-password

// Products
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
POST   /api/products/import
POST   /api/products/import/preview
GET    /api/products/export
POST   /api/products/:id/assign-label

// Templates
GET    /api/templates
GET    /api/templates/:id
GET    /api/templates/export
POST   /api/templates/import
POST   /api/templates
PUT    /api/templates/:id
DELETE /api/templates/:id

// Devices
GET    /api/devices
GET    /api/devices/:id
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id
POST   /api/devices/scan
POST   /api/devices/:id/control
GET    /api/devices/pending
POST   /api/devices/:id/approve
POST   /api/devices/:id/reject

// Media
GET    /api/media
POST   /api/media/upload
POST   /api/media/scan
POST   /api/media/browse
POST   /api/media/folders
DELETE /api/media/:id

// Categories
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

// Production Types
GET    /api/production-types
GET    /api/production-types/:id
POST   /api/production-types
PUT    /api/production-types/:id
DELETE /api/production-types/:id

// Playlists
GET    /api/playlists
GET    /api/playlists/:id
POST   /api/playlists
PUT    /api/playlists/:id
DELETE /api/playlists/:id

// Schedules
GET    /api/schedules
GET    /api/schedules/:id
POST   /api/schedules
PUT    /api/schedules/:id
DELETE /api/schedules/:id

// Users
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
PUT    /api/users/profile
POST   /api/users/upload-avatar
DELETE /api/users/:id

// Settings
GET    /api/settings
PUT    /api/settings
POST   /api/settings/test-smtp

// Label Sizes
GET    /api/label-sizes
GET    /api/label-sizes/:id
POST   /api/label-sizes
PUT    /api/label-sizes/:id
DELETE /api/label-sizes/:id

// Layout
GET    /api/layout/config
PUT    /api/layout/config
GET    /api/layout/menu

// Branding
POST   /api/branding/upload

// Reports
GET    /api/reports/dashboard-stats
GET    /api/reports/recent-activities

// Admin Only
GET    /api/companies
GET    /api/companies/:id
POST   /api/companies
PUT    /api/companies/:id
DELETE /api/companies/:id

GET    /api/licenses
POST   /api/licenses
PUT    /api/licenses/:id
POST   /api/licenses/:id/revoke

// Device Groups
GET    /api/device-groups
GET    /api/device-groups/:id
POST   /api/device-groups
PUT    /api/device-groups/:id
DELETE /api/device-groups/:id
POST   /api/device-groups/:id/bulk-action

// Audit Logs (Admin)
GET    /api/audit-logs
GET    /api/audit-logs/:id
GET    /api/audit-logs/archive/stats
POST   /api/audit-logs/archive
POST   /api/audit-logs/delete
DELETE /api/audit-logs/delete

// System Status (Admin)
GET    /api/system/status

// Notifications
GET    /api/notifications
GET    /api/notifications/:id
GET    /api/notifications/unread-count
POST   /api/notifications/create
POST   /api/notifications/mark-read
PUT    /api/notifications/archive
DELETE /api/notifications/delete
GET    /api/notifications/settings
PUT    /api/notifications/settings

// ESL Device Integration (Device Token Auth)
POST   /api/esl/register
POST   /api/esl/heartbeat
POST   /api/esl/sync
GET    /api/esl/content/:id
POST   /api/esl/ack

// PWA Player API (Device Token Auth)
POST   /api/player/init
GET    /api/player/content
POST   /api/player/sync
GET    /api/player/commands
POST   /api/player/command-ack
POST   /api/player/heartbeat

// Hanshow ESL Integration
POST   /api/hanshow/callback
GET    /api/hanshow/ping
GET    /api/hanshow/settings
PUT    /api/hanshow/settings
GET    /api/hanshow/esls
GET    /api/hanshow/esls/:id
POST   /api/hanshow/esls
PUT    /api/hanshow/esls/:id
DELETE /api/hanshow/esls/:id
POST   /api/hanshow/send
GET    /api/hanshow/firmwares
POST   /api/hanshow/control/led
POST   /api/hanshow/control/page

// HAL Kunye
GET    /api/hal/settings
PUT    /api/hal/settings
GET    /api/hal/test
GET    /api/hal/query
POST   /api/hal/query
POST   /api/hal/bulk-query
GET    /api/hal/data
POST   /api/hal/data
DELETE /api/hal/data

// TAMSOFT ERP
GET    /api/tamsoft/settings
PUT    /api/tamsoft/settings
GET    /api/tamsoft/test
GET    /api/tamsoft/depolar
GET    /api/tamsoft/sync
POST   /api/tamsoft/sync
GET    /api/tamsoft/stok-detay

// Render Queue
GET    /api/render-queue
POST   /api/render-queue
GET    /api/render-queue/analytics
POST   /api/render-queue/auto
POST   /api/render-queue/process
GET    /api/render-queue/{id}/status
POST   /api/render-queue/{id}/cancel
POST   /api/render-queue/{id}/retry
POST   /api/render-queue/{id}/reschedule
POST   /api/render-queue/cleanup

// Payments
GET    /api/payments/plans
GET    /api/payments/settings
PUT    /api/payments/settings
GET    /api/payments/ping
POST   /api/payments/init
GET    /api/payments/installments
GET    /api/payments/status/:id
GET    /api/payments/history
POST   /api/payments/callback
POST   /api/payments/callback-3d

// Proxy
GET    /api/proxy/fetch.php
```

---

## Guvenlik

### Middleware Zincirleri

| Middleware | Islev |
|------------|-------|
| ApiGuardMiddleware | Origin/CORS kontrolu, rate limiting |
| InputSanitizeMiddleware | SQL/NoSQL/XSS injection filtreleme |
| AuthMiddleware | JWT token dogrulama |
| LicenseMiddleware | Lisans suresi kontrolu |
| CsrfMiddleware | CSRF token dogrulama |
| AdminMiddleware | Admin yetkisi kontrolu |

### Rate Limiting

| Endpoint Tipi | Limit |
|---------------|-------|
| default | 100 req/60sn |
| auth (login, register) | 10 req/60sn |
| upload | 20 req/60sn |
| export | 5 req/60sn |

### Onemli Guvenlik Kurallari

- SQL injection: `Database.php`'de kolon/tablo whitelist dogrulama
- Path traversal: `media/serve.php` sadece storage dizininde calisir
- Sifre hash: Tum sifreler `Auth::hashPassword()` ile `PASSWORD_ARGON2ID`
- JWT: `JWT_SECRET` production'da otomatik olusturulur (`.jwt_secret` dosyasi)
- XSS: Frontend'de `SecurityUtils.js` - `escapeHTML()`, `html` tagged template
- Gateway: IP subnet dogrulama (sadece yerel ag IP'leri)
- InputSanitize: `skipFields` listesinde media URL alanlari (image_url, images, videos vb.)

### Production Modu

`.production` dosyasi veya `OMNEX_PRODUCTION=true` ile aktif edilir. Detaylar icin bkz: `config.php`

---

## Bilinen Sorunlar ve Ogrenilenler

### Sik Karsilasilan Hatalar ve Cozumleri

| Hata Pattern | Cozum |
|--------------|-------|
| `State.get is not a function` | `this.app.state.get()` kullanilmali (static cagri yapilmamali) |
| `Auth.login is not a function` | `this.app.auth.login()` kullanilmali |
| i18n key'leri gorunuyor | `preload()` metodunda `loadPageTranslations()` cagirilmali |
| API 404 hatasi | Route `api/index.php`'de tanimlanmali |
| `json_decode null` hatasi | Null check eklenmeli: `$data = !empty($val) ? json_decode($val, true) ?: [] : []` |
| DataTable `querySelector not a function` | Dual constructor destegi mevcut, her iki format calisir |
| Medya gorselleri gorunmuyor | `api/media/serve.php` proxy kullanilmali |
| Header ustunde bosluk | header.css'de `position: sticky` kullanilmali |
| Toast modal arkasinda | toast.css z-index: 9999, modal z-index: 1000 |
| `!empty(0)` = false | PHP'de `!empty(0)` false doner, `is_numeric()` veya `!== null` kullanilmali |
| `is_public = 1` PostgreSQL hatasi | PostgreSQL boolean kolon: `is_public = true/false` kullanilmali (`= 1/0` calismaz) |
| `PRAGMA table_info` hatasi | PostgreSQL'de PRAGMA yok, `information_schema.columns` kullanilmali |
| UNION sorgu tamamen 0 doner | UNION icindeki tek bir SQL hatasi tum sorguyu kirar, catch icinde sessiz kalir |

### TAMSOFT ERP Sync Pattern

- `last_sync_date` guncellendikten sonra tum urunler silinip yeniden sync yapilirsa, API 0 sonuc doner (incremental sync mantigi)
- Cozum: 0 sonuc + 0 yerel urun = otomatik `full_sync=true` ile tekrar dene
- `last_sync_date` sadece gercekten urun insert/update yapildiginda guncellenmeli

### Oturum Suresi Dolma Bildirimi (Session Expiry)

- JWT token 1 saat (3600sn), refresh token 30 gun gecerli
- Token expire olunca `Api.js` otomatik refresh dener
- Refresh basarisiz olursa `handleSessionExpired()` cagirilir:
  - Toast.warning ile "Oturum Sonlandi" bildirimi gosterilir
  - localStorage'dan user verisi temizlenir
  - 1 saniye sonra `#/login` sayfasina yonlendirilir
  - `_sessionExpiredHandled` flag ile coklu bildirim engellenir
- `window.OmnexComponents = { Toast, Modal }` app.js'de set edilir - Api.js burada Toast'a erisir
- i18n key'leri: `auth.sessionExpired`, `auth.sessionExpiredTitle` (common.json)

### PHP Windows Notlari

- `php -r` karmasik kodlarda Windows'ta calismaz, `.php` dosyasi olusturup calistir
- Windows path'lerinde `rm "path"` cift tirnak kullan

94 ozellik/duzeltme tamamlandi. Tam versiyon gecmisi icin bkz: CLAUDE.md arsiv veya commit gecmisi.

---

## Gelistirme Rehberi

### Yeni Sayfa Ekleme

1. `public/assets/js/pages/` altina dosya olustur:

```javascript
export class MyPage {
    constructor(app) {
        this.app = app;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('mypage');
    }

    render() {
        return `<div class="page-header">...</div><div class="card">...</div>`;
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default MyPage;
```

2. `app.js`'de route ekle:

```javascript
this.router.addRoute('/my-page', () => this.loadProtectedPage('MyPage'));
```

3. Ceviri dosyalari olustur: `locales/tr/pages/mypage.json`, `locales/en/pages/mypage.json`

### Yeni API Endpoint Ekleme

1. `api/` altina klasor ve dosya olustur:

```php
// api/myresource/index.php
$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$items = $db->fetchAll("SELECT * FROM mytable WHERE company_id = ?", [$companyId]);
Response::success($items);
```

2. `api/index.php`'de route ekle:

```php
$router->group(['prefix' => '/api/myresource', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/myresource/index.php';
    });
    $router->post('', function($request) {
        require API_PATH . '/myresource/create.php';
    });
});
```

3. Yeni tablo gerekiyorsa `database/migrations/` altina migration ekle ve `Database.php`'de tablo adini whitelist'e ekle.

---

## Test Kullanicilari

| Rol | E-posta | Sifre |
|-----|---------|-------|
| SuperAdmin | admin@omnex.local | OmnexAdmin2024! |
| Admin | company@omnex.local | CompanyAdmin2024! |

---

## CSS Mimarisi

```
css/
├── main.css              # Master import dosyasi
├── global.css            # CSS Variables, base styles, utility classes
├── global-dark.css       # Dark mode overrides (.dark class)
├── components/           # buttons, cards, forms, tables, modals, toast, badges
├── layouts/              # sidebar, header (sticky), content
└── pages/                # auth, dashboard, products, devices, settings, template-editor, vb.
```

**Onemli CSS Variables (global.css):**

```css
:root {
    --color-primary: #228be6;
    --color-success: #40c057;
    --color-warning: #fab005;
    --color-danger: #fa5252;
    --sidebar-width: 260px;
    --sidebar-collapsed-width: 70px;
    --header-height: 60px;
}
```

**Ikon:** Tabler Icons (`ti ti-xxx`) kullaniliyor.
**Tema:** Dark mode `.dark` class ile. RTL destegi `[dir="rtl"]` ile.

---

## Import/Export Sistemi

### Urun Import

Desteklenen formatlar: CSV, TXT, JSON, XML, XLSX

```php
// Backend akisi
POST /api/products/import/preview   // Dosya onizleme + field detection
POST /api/products/import           // Asil import

// SmartFieldMapper otomatik eslestirme
$mappings = SmartFieldMapper::detectMappings($headers, $sampleData);
// Sonuc: ['sku' => 'STOK_KODU', 'name' => 'URUN_ADI', 'current_price' => 'SATIS_FIYATI']
```

**Frontend Import Akisi (ProductList.js):**
1. Dosya secimi -> `/import/preview` API cagrisi
2. Mapping modu secimi: Otomatik (SmartFieldMapper) veya Manuel (kullanici her alan icin kaynak secer)
3. Import baslat -> sonuc raporu (inserted, updated, skipped, failed)

### Urun Export

```javascript
// 7 format destegi (ExportManager.js)
await this.app.api.download('/products/export', 'products.csv', { format: 'csv' });
// Formatlar: csv, txt, json, xml + client-side: excel, html, md, print
```

### Sablon Export/Import

```
GET  /api/templates/export?id=X       // Tek sablon JSON olarak
GET  /api/templates/export?ids=X,Y,Z  // Toplu export
GET  /api/templates/export?all=1      // Tum sablonlar
POST /api/templates/import            // JSON dosyasindan ice aktar
```

---

## Settings Tablosu Kullanimi

Ayarlar `settings` tablosunda JSON formatinda saklanir:

```php
// Okuma
$settings = $db->fetch("SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL", [$companyId]);
$data = json_decode($settings['data'] ?? '{}', true);

// Yazma
$db->update('settings', ['data' => json_encode($newData)], 'company_id = ? AND user_id IS NULL', [$companyId]);
```

**Ornek ayarlar JSON:**
```json
{
    "language": "tr",
    "timezone": "Europe/Istanbul",
    "currency": "TRY",
    "gateway_enabled": true,
    "weighing_flag_code": "27",
    "weighing_barcode_format": "CODE128",
    "hal_integration": {
        "username": "...",
        "enabled": true
    }
}
```

**Hiyerarsi:** Kullanici ayari (user_id set) > Firma ayari (user_id NULL) > Varsayilan

---

## Cihaz Tipi Sistemi

### Cihaz Tipleri ve Mapping

Frontend tipleri DB'ye kaydedilirken map edilir:

| Frontend Tipi | DB type | DB model | Aciklama |
|---------------|---------|----------|----------|
| esl | esl | esl | Standart ESL |
| esl_android | esl | esl_android | PavoDisplay Android |
| esl_rtos | esl | esl_rtos | RTOS ESL |
| tv / android_tv | android_tv | android_tv | TV/Signage |
| tablet | android_tv | tablet | Tablet |
| web_display | web_display | web_display | Web ekranlar |
| pwa_player | android_tv | pwa_player | PWA Player |

### Cihaz Kayit Akislari

**ESL (PavoDisplay):** Ag tarama -> Cihaz bulunur -> "Ekle" -> devices tablosuna kayit
**PWA Player:** Player acilir -> Sync code gosterilir -> Admin onaylar -> devices tablosuna kayit
**Hanshow ESL:** Admin panelden manuel ESL ekleme -> hanshow_esls tablosuna kayit

### Cihaz Onay Akisi

```
device_sync_requests tablosu     -->  ONAY  -->     devices tablosu
(Bekleyen kayitlar)                                (Onaylanmis cihazlar)
sync_code, fingerprint                             name, type, status
```

**Onemli:** Bekleyen cihazlar `device_sync_requests`, onaylanmis cihazlar `devices` tablosunda - iki FARKLI tablo.

---

## Device Abstraction Layer (DAL)

Coklu cihaz markasi/protokol destegi icin adapter tabanli soyutlama katmani. Mevcut gateway siniflarini **sarar** (wrap), ic kodlarina dokunmaz.

### Mimari

```
DeviceAdapterInterface          # Kontrat (ping, sendContent, control)
  └── AbstractDeviceAdapter     # Varsayilan uygulamalar
      ├── PavoDisplayAdapter    # PavoDisplayGateway sarici (HTTP-SERVER)
      ├── HanshowAdapter        # HanshowGateway sarici (RF/REST)
      ├── MqttDeviceAdapter     # MqttBrokerService sarici
      ├── PwaPlayerAdapter      # DB-tabanli pull model
      └── NullAdapter           # Fallback (hata doner)

DeviceAdapterRegistry           # Singleton, cihaz -> adapter cozumleme
GatewayBridgeDecorator          # Gateway uzerinden yonlendirme decorator
```

### Adapter Cozumleme Sirasi

1. `device.adapter_id` kolonu (acik override) - en yuksek oncelik
2. Kural esleme: `(model, communication_mode, manufacturer)` bazli
3. `type` kolonu bazli fallback
4. `NullAdapter` (son care)

### Feature Flag

`dal_enabled` (varsayilan: false) - Firma ayarlarinda aktif edilir.

```php
// RenderQueueWorker: DAL veya eski yol
if ($dalEnabled) {
    $result = $this->sendToDevicesBatchDAL($items, $imagePath, $job);
} else {
    $result = $this->sendToDevicesBatch($items, $imagePath, $job);
}

// control.php: DAL yolu eklendi (eski kod fallback)
$registry = DeviceAdapterRegistry::getInstance();
$adapter = $registry->resolveWithGateway($device);
$result = $adapter->control($device, $action, $params);
```

### Frontend DeviceRegistry.js

Merkezi cihaz tipi tanimlari (`public/assets/js/core/DeviceRegistry.js`):

```javascript
import { DeviceRegistry } from '../../core/DeviceRegistry.js';

// Tip cozumleme
const def = DeviceRegistry.resolve(device);     // { id, label, icon, badge, capabilities, ... }

// Yetenek kontrolu
DeviceRegistry.hasCapability(device, 'send_image');   // boolean
DeviceRegistry.hasAnyCapability(device, ['ping', 'led_flash']);

// Gorunum
DeviceRegistry.getIcon(device);     // 'ti-device-tablet'
DeviceRegistry.getBadge(device);    // { label: 'ESL Tablet', class: 'badge-cyan' }
DeviceRegistry.getBadgeHtml(device); // '<span class="badge badge-cyan">ESL Tablet</span>'

// Kategori
DeviceRegistry.isEsl(device);       // true/false
DeviceRegistry.isSignage(device);   // true/false
DeviceRegistry.getDbType('esl_android'); // 'esl'
```

### Database Kolonlari (Migration 067)

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| `adapter_id` | TEXT | Acik adapter override ('pavodisplay', 'hanshow', 'mqtt', 'pwa_player') |
| `capabilities` | TEXT | JSON capability cache |
| `device_brand` | TEXT | Uretici/marka ('PavoDisplay', 'Hanshow', 'Kexin') |

### Yeni Cihaz Markasi Ekleme

Detayli rehber: `docs/ADDING_NEW_DEVICE.md`

| # | Dosya | Islem |
|---|-------|-------|
| 1 | `services/dal/adapters/XyzAdapter.php` | Adapter sinifi yaz |
| 2 | `services/dal/DeviceAdapterRegistry.php` | `registerDefaults()` icine kural ekle |
| 3 | `public/assets/js/core/DeviceRegistry.js` | `types` objesine giris ekle |
| 4 | `api/devices/create.php` | `$typeMap` ve `$validTypes`'a ekle |
| 5 | `locales/tr/pages/devices.json` | Ceviri ekle |
| 6 | `locales/en/pages/devices.json` | Ceviri ekle |

---

## Bildirim Tetikleyicileri

Backend'de otomatik bildirim gonderimi icin hazir tetikleyiciler:

```php
NotificationTriggers::onUserRegistered($user);
NotificationTriggers::onUserApproved($userId);
NotificationTriggers::onPasswordChanged($userId);
NotificationTriggers::onImportComplete($userId, $result);
NotificationTriggers::onSyncComplete($userId, $result);
NotificationTriggers::onLicenseExpiring($companyId, $days);
NotificationTriggers::onDeviceOffline($device);
NotificationTriggers::systemAnnouncement($title, $message, $type);
```

---

## Kutuphane Bagimliliklari (CDN)

| Kutuphane | Kullanim | CDN |
|-----------|----------|-----|
| Fabric.js | Sablon editoru canvas | jsdelivr |
| JsBarcode | Barkod olusturma | jsdelivr |
| qrcodejs | QR kod olusturma | cdnjs.cloudflare.com |
| SheetJS (xlsx) | Excel export | jsdelivr (dinamik yukleme) |
| hls.js | HLS video streaming | jsdelivr |
| Tabler Icons | UI ikonlari | jsdelivr |

**Onemli:** `qrcode` (node-qrcode) ve `qrcodejs` farkli kutuphanelerdir:
- `qrcodejs` (browser uyumlu): `new QRCode(element, { text, width, height, ... })` API
- `qrcode` (node): `QRCode.toCanvas()` API - browser'da 404 verir, KULLANILMAMALI

---

## Render ve Cihaza Gonderim Akisi

### Tek Cihaza Gonderim

```
1. Urun secilir + sablon belirlenir
2. POST /api/templates/:id/render cagirilir
3. Sablon Fabric.js canvas veya HTML olarak render edilir (JPG/PNG)
4. PavoDisplayGateway veya HanshowGateway ile cihaza gonderilir
5. Sonuc kaydedilir
```

### Toplu Gonderim (Render Queue)

```
1. QueueDashboard'dan wizard ile urun, sablon, cihaz secimi
2. POST /api/render-queue ile job olusturulur
3. POST /api/render-queue/process ile isler islenir (veya worker)
4. Paralel gonderim (device-type bazli esanlamlilik: ESL:2, TV:10)
5. Delta update: checkFile() ile MD5 kontrolu, ayni dosya yukleme atlanir
6. Basarisiz gonderimler exponential backoff ile tekrar denenir
```

### 2026-02-11 Stabil Durum (SQLite Donemi)

- Multi-product frame yardimci cizgileri/slot arkaplanlari render export'ta gizlenir (cihaza gitmez).
- Multi-product slot icinde medya ekleme akisinda image + video secimi desteklenir.
- Editor medya modalinda sekme gecisi (Firma Kutuphanesi <-> Ortak Kutuphane) modal kapatmadan dogru icerigi yeniler.
- Ortak kutuphane tarama/path normalize duzeltmeleri ile `storage/public/samples/Video` kaynaklari gorunurluk kazandi.
- Multi-product render queue akisinda sablondaki `staticVideos` toplanir ve cihaza gorsel + video birlikte gonderilir.
- TemplateRenderer export asamasinda video placeholder/icon objeleri gizlenir; ikonun PNG'ye yanmasi engellenir.
- PavoDisplay tarafinda guvenli inset ayari sadece multi-product frame senaryosuna sinirli tutulur.

### 2026-02-26 PostgreSQL Gecisi

- SQLite'tan PostgreSQL 18'e tam gecis tamamlandi
- 11 schema ile domain bazli tablo organizasyonu
- 89 tablo, 412 index, 44 FK constraint, 39 RLS policy
- `database/postgresql/v2/` altinda 17 modular schema dosyasi
- `tools/postgresql/` altinda setup/migration/kontrol scriptleri
- Docker destegi: `docker-compose.postgresql.yml`
- Tum testler basarili (2026-02-27)

### Kalan Mini Isler

1. Media modalinde sekme/dizin gecisleri icin regresyon checklist (image/video, firma/ortak, liste/grid gorunumu).
2. Multi-product slot tasarim vs cihaz gorunumu icin kenar/daralma smoke test senaryolari.
3. Medya tarama sonrasi DB'de yetim kayit (dosya yok, kayit var) ve diskte yetim dosya (dosya var, kayit yok) raporu.
4. Kod tabaninda kalan SQLite-specific syntax taramasi (is_public=1/0, datetime('now'), INSERT OR IGNORE vb.).

### Render Cache

```
storage/renders/{company_id}/{device_type}/{locale}/{template_id}/{cache_key}.jpg
Cache key: template_id + template_version + product_id + product_version + locale + resolution
```

---

## Urun Formu Kart Duzeni (ProductForm.js)

**Sol taraf (lg:col-span-2):**
1. Temel Bilgiler karti - Urun adi, SKU, barkod, kategori, aciklama
2. HAL Kunye karti - Kunye no, sorgu sonuclari, HAL veri alanlari
3. Fiyat Bilgileri karti - Satis fiyati, eski fiyat, KDV, indirim, kampanya

**Sag taraf - Sidebar (lg:col-span-1):**
1. Durum karti - Aktif/Pasif toggle
2. Gorseller karti - Medya kutuphanesi picker
3. Video karti - Video yukleme/URL
4. Stok ve Olcu karti - Birim, stok, agirlik, raf konumu
5. Gecerlilik karti - Baslangic/bitis tarihleri
6. Kaydet/Iptal butonlari

**Page Header'da da Kaydet butonu var** (`form="product-form"` ozelligi ile form disinda calisiyor).

---

## Entegrasyon Ozetleri

### PavoDisplay ESL

10.1" Android ESL cihazlari. HTTP-SERVER modunda calisir (IP uzerinden HTTP REST).

**Ana Endpoint'ler (cihaz tarafinda):**
- `GET /Iotags` - Cihaz bilgisi (model, firmware, ekran, depolama)
- `POST /upload` - Dosya yukleme (binary body)
- `GET /check` - Dosya varlik kontrolu (MD5)
- `GET /replay` - Ekran yenileme (task JSON ile)
- `GET /clear` - Depolama temizleme

**Servis:** `services/PavoDisplayGateway.php`
- `ping()`, `uploadFile()`, `triggerReplay()`, `checkFile()`, `getDeviceDetails()`
- `scanNetworkFast()` - Paralel ag tarama
- `sendToMultipleDevicesParallel()` - Toplu gonderim (Phase 1)
- Bluetooth kurulum: `BluetoothService.js` (Web Bluetooth API, `@B` prefix tarama)

Detaylar icin bkz: ilgili servis dosyalari ve PavoDisplay dokumantasyonu.

### Hanshow ESL

Profesyonel ESL cihazlari. ESL-Working v2.5.3 REST API (`/api2/` prefix) ile iletisim.

**Servis:** `services/HanshowGateway.php`
- `ping()`, `sendToESL()`, `batchUpdate()`, `flashLight()`, `switchPage()`
- Layout (JSON tabanli) ve Image (Base64) icerik formati
- LED kontrol (7 renk), sayfa degistirme
- Async callback mekanizmasi (`/api/hanshow/callback`)

**Gateway Agent Destegi:** `gateway/gateway.php` ile lokal ESL-Working'e kopruleme (sunucu uzaktaysa).

Detaylar icin bkz: `docs/HANSHOW_ESL_INTEGRATION.md`

### TAMSOFT ERP

Urun, stok ve fiyat senkronizasyonu. `services/TamsoftGateway.php`

**Temel Metodlar:**
- `ping()`, `getDepolar()`, `getStokListesi()`, `getStokDetay()`
- `syncProducts()` - Urun senkronizasyonu (insert/update)
- `mapDepotsToBranches()` - Depo-sube otomatik eslestirme
- `syncBranchOverride()` - Depo bazli fiyat/stok override

**Fiyat Mantigi:**
- `IndirimliTutar < Tutar` ise: current_price = IndirimliTutar, previous_price = Tutar (kampanya)
- Aksi halde: current_price = Tutar, previous_price = null

**Bilinen Bug:** `!empty(0)` = false, depoId=0 olan depolar sync'te atlaniyordu. `is_numeric()` ile duzeltildi.

**Ayarlar:** `tamsoft_settings` tablosu (firma bazli, api_url, username, password, default_depo_id, sync_interval)

### HAL Kunye

Tarimsal urunler icin HAL Kayit Sistemi kunye sorgulama.
- 19 haneli kunye numarasi ile sorgulama
- SOAP API (kimlik bilgisi ile) veya web scraper (fallback)
- CAPTCHA korumasi: Scraper basarisiz olursa kullaniciya uyari modali gosterilir
- `services/HalKunyeScraper.php`, `services/HalKunyeService.php`, `services/HalDataResolver.php`

### PWA Signage Player

Digital Signage icin PWA oynatici. `public/player/` dizininde.
- Sync code ile cihaz eslestirme (6 haneli kod, 15 dk gecerli)
- IndexedDB ile offline cache
- Fingerprint ile cihaz kimlik dogrulama
- Image, video, HLS, webpage, template icerik turleri
- iOS PWA ozel duzeltmeler (autoplay, fingerprint, fullscreen)

### Render Queue Sistemi

Toplu cihaz gonderimi icin kuyruk ve retry mekanizmasi.
- Priority (urgent/high/normal/low) bazli FIFO siralama
- Exponential backoff ile tekrar deneme
- `services/RenderQueueService.php`, `workers/RenderQueueWorker.php`
- Frontend: `queue/QueueDashboard.js` - analitik, wizard, otomatik isleme

### Odeme Sistemi

Iyzico ve Paynet dual provider destegi.
- 3D Secure odeme akisi
- Lisans planlari ve otomatik lisans uzatma
- `services/IyzicoGateway.php`, `services/PaynetGateway.php`

### Template Editor

Fabric.js tabanli surkle-birak etiket tasarimcisi.
- Cihaz presetleri (ESL, Signage, Poster boyutlari)
- Grid duzenleri (tek, ikili, 2x2, header-content vb.)
- 25+ dinamik alan destegi
- Bolge arkaplan yonetimi (renk, gradient, gorsel, video)
- Multi-Product Frame: Tek sablonda coklu urun gosterimi (1x2, 2x1, 2x2, 3x1, 2x3)
- Sablon disa/ice aktarma (JSON formati)

### Bildirim Sistemi

Merkezi bildirim altyapisi.
- `NotificationService` / `NotificationTriggers` (backend)
- `NotificationManager` (30sn polling), `NotificationDropdown` (header)
- Turler: info, success, warning, error, system
- Otomatik tetikleyiciler: kullanici kayit, import, sync, lisans uyari vb.

### Export Sistemi

`ExportManager.js` ile 7 format: Excel (.xlsx), CSV, HTML, JSON, Markdown, TXT, Print.
DataTable toolbar'da otomatik dropdown olarak gorunur.

### Barkod/QR Kod Sistemi

`BarcodeUtils.js` ile barkod tipi tespit, check digit dogrulama, gorsel olusturma.
- JsBarcode: EAN-13, EAN-8, UPC, Code 128, Code 39, ITF-14
- qrcodejs: QR kod olusturma (`new QRCode(element, options)` API)
- Tarti barkod: Bayrak kodu (20-29) + 5 haneli terazi kodu

### Gateway Agent

`gateway/gateway.php` - Lokal agda PavoDisplay ve Hanshow ESL-Working ile kopruleme.
- IP subnet dogrulama, SSL ayari, log rotation
- CLI komutlari: `--hanshow-config`, `--hanshow-test`, `--hanshow-aps`

### Cache Sistemi

- Development: no-cache headers, SW devre disi
- Production: SW aktif (network-first API, cache-first media), versiyonlu dosyalar
- `core/Cache.php`: Dosya degisiklik zamanina gore versiyon hash
- `CacheManager.js`: Client-side cache temizleme

### Lisans Kontrolu

`LicenseMiddleware.php`: Suresi dolan lisanslar icin 403 engelleme.
- ultimate/unlimited/lifetime tipler tarih kontrolu yapilmaz
- SuperAdmin muaf
- 7 gun kala header uyarisi

### Multi-Tenant Izolasyon

- Medya: Firma bazli depolama (`/storage/companies/{id}/media/`)
- Template: Scope (system/company), fork destegi
- CompanySeeder: Yeni firma icin varsayilan veriler otomatik olusturulur

### Audit Log Arsivleme

- 1 aydan eski kayitlari arsivleme (Admin+)
- Arsivlenmis kayitlari kalici silme (SuperAdmin only)
- Son 1 aylik veriler korunur

---

## Dinamik API URL Yapisi

Proje farkli dizin adlariyla calisabilir (`/market-etiket-sistemi`, `/signage`, `/omnex`).

**Frontend:** `window.OmnexConfig.apiUrl` dinamik hesaplanir.
**Backend:** `core/Request.php` BASE_PATH ile dinamik path tespiti.
**Medya URL:** Windows absolute path ise `serve.php` proxy kullanilir.

```javascript
// Frontend medya URL hesaplama
getFileUrl(filePath) {
    const basePath = window.OmnexConfig?.basePath || '';
    if (/^[A-Za-z]:[\\\/]/.test(filePath)) {
        return `${basePath}/api/media/serve.php?path=${encodeURIComponent(filePath)}`;
    }
    return `${basePath}/storage/${filePath}`;
}
```

---

## Company Selector (SuperAdmin)

SuperAdmin kullanicilari header'daki firma secici ile farkli firmalar adina islem yapabilir.

```javascript
// Frontend: localStorage'da saklanir
localStorage.getItem('omnex_active_company');

// Api.js otomatik header ekler
headers['X-Active-Company'] = localStorage.getItem('omnex_active_company');

// Backend: Aktif firma ID
$companyId = Auth::getActiveCompanyId();
```

---

## Gateway Aktif/Pasif Toggle

Lokal gelistirme ortaminda gateway devre disi birakilabilir.

```php
// Backend kontrolu (render.php, control.php)
$gatewayEnabled = true; // Varsayilan
// settings tablosundan firma/kullanici ayari okunur
// gateway_enabled = false ise gateway kullanilmaz
```

Ayarlar > Gateway sayfasinda toggle switch ile yonetilir.

---

## Sik Kullanilan Tabler Icon Referansi

| Sayfa | Ikon |
|-------|------|
| Dashboard | `ti-dashboard` |
| Urunler | `ti-package` |
| Cihazlar | `ti-device-desktop` |
| Sablonlar | `ti-layout` |
| Medya | `ti-photo` |
| Kategoriler | `ti-category` |
| Kullanicilar | `ti-users` |
| Ayarlar | `ti-settings` |
| Raporlar | `ti-chart-bar` |
| Entegrasyonlar | `ti-plug` |
| Islem Gecmisi | `ti-history` |
| Playlist | `ti-playlist` |
| Zamanlama | `ti-calendar-event` |
| Ekleme | `ti-plus` |
| Duzenleme | `ti-edit` |
| Silme | `ti-trash` |
| Arama | `ti-search` |
| Filtre | `ti-filter` |
| Export | `ti-download` |
| Import | `ti-upload` |
| Bildirim | `ti-bell` |
| Kuyruk | `ti-list-check` |

---

## CLI Komutlari

```bash
# PostgreSQL setup (ilk kurulum)
scripts/setup-postgresql-local.bat

# PostgreSQL baglanti kontrolu
php tools/postgresql/check_connection.php

# PostgreSQL migration + seed
php tools/postgresql/migrate_seed.php

# SQLite'tan PostgreSQL'e veri aktarimi
php tools/postgresql/migrate_integration_from_sqlite.php

# Schema karsilastirma (SQLite vs PostgreSQL)
php tools/postgresql/compare_sqlite_pg_schema.php

# Migration calistir (otomatik driver tespiti)
php -r "require 'config.php'; Database::getInstance()->migrate();"

# TAMSOFT sync (cron icin)
php cron/tamsoft-auto-sync.php

# Render queue worker
php workers/RenderQueueWorker.php --daemon
php workers/RenderQueueWorker.php --once
php workers/RenderQueueWorker.php --status

# Gateway agent
php gateway/gateway.php
php gateway/gateway.php --hanshow-config
php gateway/gateway.php --hanshow-test

# Lisans kontrol cron
php cron/check-licenses.php
```

---

## Sonraki Gelistirmeler

### Yuksek Oncelik
1. [ ] Sablon editoru - Video arkaplan gercek oynatma
2. [ ] Sube/Bolge Yapisi - Multi-branch firma destegi (user_branch_access, BranchSelector, sube bazli import/export)
3. [x] ~~PostgreSQL gecisi~~ (Tamamlandi, 2026-02-26 - 89 tablo, 11 schema, RLS)
4. [ ] Kod tabaninda kalan SQLite syntax temizligi (boolean, datetime, INSERT OR IGNORE)

### Orta Oncelik
3. [ ] Yayin takvimi sayfasi (takvim gorunumu)
4. [ ] WebSocket ile gercek zamanli cihaz durumu
5. [ ] PWA offline destegi

### Dusuk Oncelik
6. [ ] SMTP/WhatsApp/Telegram entegrasyonu
7. [ ] Unit testler / E2E testler

---

## Onemli Notlar

- **VERITABANI: PostgreSQL 18** (2026-02-26 itibariyle SQLite'tan migrate edildi)
- **Multi-Schema**: 11 schema (core, license, catalog, branch, labels, media, devices, signage, integration, audit, legacy)
- **RLS aktif**: `Database::setAppContext()` ile company_id/user_id/role session degiskenleri set edilir
- **Boolean syntax**: `is_public = true/false` kullanilmali (`= 1/0` PostgreSQL'de calismaz!)
- **PRAGMA yok**: `information_schema.columns` kullanilmali
- **Schema prefix gereksiz**: `search_path` otomatik cozumler
- **Driver secimi**: `.env.local` dosyasinda `OMNEX_DB_DRIVER=pgsql` (dual SQLite/PG destegi devam ediyor)
- JWT_SECRET production'da otomatik olusturulur (`.jwt_secret` dosyasi)
- Console.log'lar Logger utility ile degistirildi - production'da otomatik gizlenir
- Medya kutuphanesi hem veritabani modunda hem disk gezgini modunda calisabilir
- Production modu icin `.production` dosyasi olusturun veya `OMNEX_PRODUCTION=true` set edin
- `api/.htaccess` tum istekleri `index.php`'ye yonlendirir (serve.php haric)
- Cihaz tipi mapping: Frontend `esl_android` -> DB `esl` (orijinal tip `model` alaninda saklanir)
- Products tablosunda `group > category > subcategory` hiyerarsisi vardir
- Tabler Icons kullanilir: `ti ti-{icon-name}` formati
- API hata yapisi: `{ success: false, message: "...", errors: { ... } }` - hatalar `errors` alaninda doner, `data` degil
- `product_branch_overrides` tablosunda `company_id` kolonu YOK, `branches` tablosu uzerinden JOIN yapilmali
- `tamsoft_sync_logs` kolonlari: `total_items`, `inserted`, `updated`, `failed` (NOT `inserted_items`)
- Settings tablosu JSON formatinda `data` kolonunda saklanir
- Medya kutuphanesinde `scope` alani: company (firma ozel), public (genel), all (hepsi)
- Template `scope` alani: system (sistem sablonu), company (firma sablonu)
- CompanySeeder yeni firma olusturulunca varsayilan verileri otomatik olusturur
- `window.OmnexComponents` = { Toast, Modal } app.js'de set edilir, Api.js ve diger non-import baglamlarinda kullanilir
- Oturum suresi dolunca Toast bildirimi gosterilir ve login'e yonlendirilir (`Api.js handleSessionExpired()`)
- DAL (Device Abstraction Layer): `dal_enabled` feature flag ile aktif edilir, varsayilan kapalı. Yeni cihaz markasi icin sadece adapter + registry girisi + DeviceRegistry.js girisi yeterli
- `DeviceRegistry.js` frontend'de merkezi cihaz tipi tanimlari saglar - tip kontrolu icin hardcoded if/else yerine `DeviceRegistry.hasCapability()` kullanilmali
- `DeviceAdapterRegistry::getInstance()->resolve($device)` backend'de cihaz icin dogru adapter'i doner

---

## Rol ve Yetki Sistemi

| Rol | Aciklama | Ozel Yetkiler |
|-----|----------|---------------|
| superadmin | Sistem yoneticisi | Tum firmalara erisim, firma secici, lisans yonetimi |
| admin | Firma yoneticisi | Firma ici tam yetki, kullanici yonetimi |
| manager | Magaza muduru | Urun, cihaz, medya yonetimi |
| editor | Icerik editoru | Sablon duzenleme, medya yukleme |
| viewer | Goruntuleme | Salt okunur erisim |

**Backend Yetki Kontrolu:**

```php
// AdminMiddleware - Admin veya SuperAdmin kontrolu
$user = Auth::user();
if (!in_array($user['role'], ['superadmin', 'admin'])) {
    Response::forbidden('Bu islem icin yetkiniz yok');
}

// SuperAdmin kontrolu
if ($user['role'] !== 'superadmin') {
    Response::forbidden('Sadece SuperAdmin');
}
```

---

## Sube/Bolge Sistemi (Mevcut ve Planlanan)

### Mevcut Tablolar

| Tablo | Durum | Aciklama |
|-------|-------|----------|
| branches | Mevcut | Sube tanimi (type: region/store) |
| product_branch_overrides | Mevcut | Sube bazli fiyat/stok/kampanya override |
| product_branch_hal_overrides | Mevcut | Sube bazli HAL kunye override |
| tamsoft_depo_mapping | Mevcut | TAMSOFT depo -> branch eslestirme |
| user_branch_access | Planlanan | Kullanici sube erisim kontrolu |

### product_branch_overrides Kullanimi

```php
// Sube bazli fiyat override kaydi
$db->insert('product_branch_overrides', [
    'id' => $db->generateUuid(),
    'product_id' => $productId,
    'branch_id' => $branchId,
    'current_price' => $price,
    'stock' => $stock,
    'is_campaign_active' => $isCampaign ? 1 : 0,
    'source' => 'sync',           // 'manual' veya 'sync'
    'override_scope' => 'full',
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
]);
```

### Planlanan Ozellikler

- `user_branch_access` tablosu ile kullanici sube erisimi
- Header'da BranchSelector bileseni
- Sube bazli import/export
- Lisansta `branch_limit` kontrolu

Detaylar icin bkz: `docs/BRANCH_SYSTEM_ARCHITECTURE.md`

---

## Avatar Sistemi

```php
// Backend: POST /api/users/upload-avatar
// Maks 500KB, JPG/PNG/WEBP/GIF
// Kaydedilir: storage/avatars/{user_id}.{ext}
// DB: users.avatar alani guncellenir
```

```javascript
// Frontend goruntuleme
const basePath = window.OmnexConfig?.basePath || '';
const avatarUrl = `${basePath}/${user.avatar}`;
```

---

## Environment Variables

| Variable | Aciklama | Varsayilan |
|----------|----------|------------|
| OMNEX_DB_DRIVER | Veritabani surucusu | sqlite (pgsql icin `.env.local`) |
| OMNEX_DB_HOST | PostgreSQL host | localhost |
| OMNEX_DB_PORT | PostgreSQL port | 5432 |
| OMNEX_DB_NAME | PostgreSQL veritabani adi | market_etiket |
| OMNEX_DB_USER | PostgreSQL kullanici | postgres |
| OMNEX_DB_PASSWORD | PostgreSQL sifre | - |
| DATABASE_URL | PostgreSQL URL formati (alternatif) | - |
| OMNEX_PRODUCTION | Production modu | false |
| OMNEX_JWT_SECRET | JWT imza anahtari | Otomatik |
| OMNEX_ADMIN_EMAIL | Admin email | admin@omnex.local |
| OMNEX_ADMIN_PASSWORD | Admin sifre | Otomatik |
| OMNEX_FORCE_HTTPS | HTTPS zorla | Production'da true |
| OMNEX_SKIP_CSRF | CSRF atla (dev) | false |

**PostgreSQL env dosyalari:**
- `.env.local` - Yerel gelistirme (aktif)
- `.env.postgresql.local.example` - Yerel ornek
- `.env.postgresql.docker.example` - Docker ornek
- `.env.postgresql.server.example` - Production ornek (sslmode=require)

---

## Dosya Depolama Yapisi

```
storage/
├── companies/{company_id}/
│   ├── media/              # Firma medya dosyalari
│   ├── avatars/            # Kullanici profil fotograflari
│   ├── templates/          # Sablon gorselleri
│   ├── exports/            # Export dosyalari
│   └── logs/               # Firma loglari
├── avatars/                # Genel avatar dizini
├── renders/                # Render cache
│   └── {company_id}/{device_type}/{locale}/{template_id}/
├── templates/              # HTML sablon dosyalari
│   ├── portrait/
│   └── landscape/
└── logs/                   # Sistem loglari
```
