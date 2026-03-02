# Omnex Display Hub

Dijital Etiket (ESL) ve Digital Signage Yonetim Platformu

## Genel Bakis

Omnex Display Hub, perakende sektorunde kullanilan elektronik raf etiketleri (ESL) ve dijital tabela (signage) sistemlerini merkezi olarak yonetmek icin gelistirilmis bir web platformudur.

### Temel Ozellikler

- **Urun Yonetimi**: ERP entegrasyonu ile urun ve fiyat bilgilerini iceaktar (TXT, JSON, CSV, XML)
- **Sablon Editoru**: Drag & drop etiket tasarim araci
- **Cihaz Yonetimi**: ESL ve TV cihazlarini uzaktan yonet
- **Digital Signage**: Playlist ve zamanlama yonetimi
- **Multi-Tenant**: Coklu firma destegi
- **Coklu Dil**: Turkce, Ingilizce, Arapca (RTL destegi)
- **PWA**: Progressive Web App olarak mobil cihazlarda calisir

---

## Teknik Altyapi

### Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Vanilla JavaScript (ES6+ Modules) |
| CSS | Tailwind CSS (CDN) + Custom CSS |
| Icons | Tabler Icons |
| Backend | PHP 8.0+ |
| Veritabani | SQLite 3 |
| Auth | JWT (JSON Web Token) |
| Server | Apache (XAMPP) |

### Mimari Yaklasim

```
+------------------+     +------------------+     +------------------+
|   Frontend SPA   | --> |    REST API      | --> |    SQLite DB     |
|   (Hash Router)  |     |    (PHP)         |     |                  |
+------------------+     +------------------+     +------------------+
```

- **Frontend**: Hash-based SPA routing (`#/dashboard`, `#/products`)
- **Backend**: RESTful API tasarimi
- **Auth**: JWT access + refresh token sistemi
- **State**: Client-side state management

---

## Dizin Yapisi

```
market-etiket-sistemi/
├── api/                    # REST API endpoint'leri
│   ├── auth/              # Kimlik dogrulama (login, logout, register, forgot/reset-password)
│   ├── products/          # Urun islemleri
│   ├── templates/         # Sablon islemleri
│   ├── devices/           # Cihaz islemleri
│   ├── media/             # Medya islemleri
│   ├── categories/        # Kategori islemleri
│   ├── playlists/         # Playlist islemleri
│   ├── schedules/         # Zamanlama islemleri
│   ├── settings/          # Kullanici/sirket ayarlari
│   ├── users/             # Kullanici yonetimi
│   ├── companies/         # Sirket yonetimi (Admin)
│   ├── licenses/          # Lisans yonetimi (Admin)
│   ├── reports/           # Raporlar
│   ├── layout/            # Layout config ve menu
│   └── index.php          # API router
│
├── core/                   # PHP core siniflar
│   ├── Auth.php           # JWT authentication
│   ├── Database.php       # SQLite PDO wrapper
│   ├── Request.php        # HTTP request handler
│   ├── Response.php       # JSON response helper
│   ├── Router.php         # API routing
│   ├── Validator.php      # Input validation
│   ├── Logger.php         # Logging sistemi
│   └── Security.php       # Guvenlik islemleri
│
├── middleware/             # API middleware'leri
│   ├── AuthMiddleware.php  # JWT dogrulama
│   ├── AdminMiddleware.php # Admin yetki kontrolu
│   └── RateLimitMiddleware.php
│
├── database/
│   ├── migrations/        # SQL migration dosyalari (9 adet)
│   ├── seeds/             # Varsayilan veri
│   └── omnex.db           # SQLite veritabani
│
├── public/                 # Frontend (Web Root)
│   ├── assets/
│   │   ├── css/
│   │   │   └── app.css    # Ana stil dosyasi
│   │   ├── js/
│   │   │   ├── app.js     # Ana uygulama
│   │   │   ├── core/      # Core moduller (Router, Api, Auth, State, i18n)
│   │   │   ├── components/ # UI bilesenler (Toast, Modal, etc.)
│   │   │   ├── layouts/    # Layout yonetimi
│   │   │   └── pages/      # Sayfa bilesenleri
│   │   │       ├── auth/       # Login, Register, ForgotPassword, ResetPassword
│   │   │       ├── products/   # ProductList, ProductForm, ProductDetail
│   │   │       ├── templates/  # TemplateList, TemplateEditor
│   │   │       ├── devices/    # DeviceList, DeviceDetail
│   │   │       ├── media/      # MediaLibrary
│   │   │       ├── signage/    # PlaylistList, ScheduleList
│   │   │       ├── reports/    # DashboardAnalytics
│   │   │       ├── settings/   # GeneralSettings, UserSettings, IntegrationSettings
│   │   │       ├── admin/      # UserManagement, CompanyManagement, LicenseManagement
│   │   │       └── errors/     # NotFound (404)
│   │   └── images/
│   ├── index.html         # SPA giris noktasi
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service Worker
│
├── locales/                # Ceviri dosyalari (tr, en, ar)
├── storage/                # Yuklenen dosyalar
├── .htaccess              # Apache yapilandirma
├── config.php             # Uygulama ayarlari
├── install.php            # Kurulum scripti
├── README.md              # Bu dosya
├── CLAUDE.md              # AI gelistirme rehberi
├── CHANGELOG.md           # Degisiklik gecmisi
└── version.txt            # Surum bilgisi
```

---

## Kurulum

### Gereksinimler

- PHP 8.0+
- Apache (mod_rewrite aktif)
- PDO SQLite extension
- OpenSSL extension

### Adimlar

1. Dosyalari `htdocs/market-etiket-sistemi/` klasorune kopyalayin

2. Apache'yi baslatin (XAMPP)

3. Tarayicida kurulum sayfasini acin:
   ```
   http://localhost/market-etiket-sistemi/install.php
   ```

4. "Kurulumu Baslat" butonuna tiklayin

5. Kurulum tamamlandiginda varsayilan giris bilgileri:
   - **E-posta**: admin@omnex.local
   - **Sifre**: OmnexAdmin2024!

---

## API Yapisi

### Authentication

```
POST /api/auth/login           # Giris
POST /api/auth/logout          # Cikis
POST /api/auth/register        # Kayit
POST /api/auth/refresh-token   # Token yenile
GET  /api/auth/session         # Oturum kontrol
POST /api/auth/forgot-password # Sifremi unuttum
POST /api/auth/reset-password  # Sifre sifirla
```

### Resources

```
# Products
GET    /api/products           # Urun listesi
POST   /api/products           # Urun ekle
GET    /api/products/:id       # Urun detay
PUT    /api/products/:id       # Urun guncelle
DELETE /api/products/:id       # Urun sil
POST   /api/products/import    # Toplu ice aktar

# Benzer yapilar:
/api/templates     # Sablonlar
/api/devices       # Cihazlar
/api/media         # Medya
/api/categories    # Kategoriler
/api/playlists     # Playlistler
/api/schedules     # Zamanlamalar
/api/users         # Kullanicilar
/api/settings      # Ayarlar

# Admin (SuperAdmin/Admin only)
/api/companies     # Sirket yonetimi
/api/licenses      # Lisans yonetimi

# Reports
/api/reports/dashboard-stats    # Dashboard istatistikleri
/api/reports/recent-activities  # Son aktiviteler
```

### Response Format

```json
{
  "success": true,
  "message": "Islem basarili",
  "data": { ... }
}
```

---

## Frontend Routing

Hash-based SPA routing kullanilir:

| Route | Sayfa |
|-------|-------|
| `#/login` | Giris |
| `#/register` | Kayit |
| `#/forgot-password` | Sifremi Unuttum |
| `#/dashboard` | Ana panel |
| `#/products` | Urunler |
| `#/products/new` | Yeni Urun |
| `#/products/:id` | Urun Detay |
| `#/templates` | Sablonlar |
| `#/templates/editor` | Sablon Editoru |
| `#/devices` | Cihazlar |
| `#/media` | Medya Kutuphanesi |
| `#/signage` | Digital Signage |
| `#/signage/playlists` | Playlistler |
| `#/signage/schedules` | Zamanlamalar |
| `#/reports` | Raporlar |
| `#/settings` | Genel Ayarlar |
| `#/settings/users` | Kullanici Ayarlari |
| `#/settings/integrations` | Entegrasyonlar |
| `#/admin/users` | Kullanici Yonetimi (Admin) |
| `#/admin/companies` | Sirket Yonetimi (Admin) |
| `#/admin/licenses` | Lisans Yonetimi (Admin) |

---

## Kullanici Rolleri

| Rol | Yetki |
|-----|-------|
| SuperAdmin | Tum sistem erisimi, firma yonetimi |
| Admin | Firma icinde tam yetki |
| Editor | Icerik olusturma ve duzenleme |
| Viewer | Salt okunur erisim |

---

## Guvenlik

- JWT token authentication
- Password hashing (Argon2ID)
- CSRF protection
- XSS prevention
- SQL injection protection (PDO prepared statements)
- Rate limiting
- Input validation

---

## Lisans

Tum haklar saklidir. Bu yazilim ticari lisans altindadir.

---

## Iletisim

Omnex Display Hub - Dijital Etiket ve Signage Yonetim Platformu
