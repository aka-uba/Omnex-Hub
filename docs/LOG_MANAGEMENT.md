# Log Yonetimi (Log Management) Dokumani

Bu dokuman, Omnex Display Hub sistemindeki Log Yonetimi modulunun teknik detaylarini icerir.

**Route:** `#/admin/logs`
**Erisim:** Sadece SuperAdmin
**Olusturma Tarihi:** 2026-02-17

---

## 1. Genel Bakis

Log Yonetimi sayfasi, sistem gunluk dosyalarini merkezi olarak yonetmek icin tasarlanmistir. SuperAdmin kullanicilarin log dosyalarini goruntulemesi, filtrelemesi, indirmesi, temizlemesi ve IT ekibine e-posta + uygulama ici bildirim ile rapor gondermesini saglar.

### Ozellikler

- Log dosyalarini listeleme (boyut, satir sayisi, seviye dagilimi)
- Dosya icerigi goruntuleme (sayfalama, seviye/metin filtreleme)
- Satir detay modali (ham icerik + JSON baglamkopyalama)
- Dosya indirme, icerik temizleme (truncate), silme
- Eski loglari yas bazli toplu temizleme
- IT ekibine log raporu gonderme (SMTP e-posta + uygulama ici bildirim)
- Bildirim ayarlari (tetikleyiciler, alicilar, esik degerleri)
- 8 dil destegi (tr, en, ar, az, de, nl, fr, ru)
- Dark mode uyumlu

---

## 2. Dosya Yapisi

### Backend

| Dosya | Islev |
|-------|-------|
| `api/logs/index.php` | Log dosyalarini listele (boyut, satir sayisi, seviye ornekleme) |
| `api/logs/read.php` | Log icerigi oku (sayfalama, seviye/metin filtre, log satiri parse) |
| `api/logs/download.php` | Log dosyasini indir (Content-Disposition header) |
| `api/logs/cleanup.php` | Dosya sil, toplu sil, eski log temizle, icerik bosalt (truncate) |
| `api/logs/send-report.php` | IT ekibine SMTP e-posta + bildirim gonder |
| `api/logs/notify-settings.php` | Bildirim ayarlarini oku/guncelle |
| `services/SmtpMailer.php` | SMTP e-posta gonderim servisi (TLS/SSL/none) |

### Frontend

| Dosya | Islev |
|-------|-------|
| `public/assets/js/pages/admin/LogManagement.js` | Ana sayfa bileseni (1225 satir) |
| `public/assets/css/pages/log-management.css` | Sayfaya ozel stiller (235 satir) |

### Ceviri Dosyalari

Log yonetimi cevirileri `locales/{lang}/pages/admin.json` dosyasindaki `logManagement` anahtari altinda yer alir.

| Dil | Dosya |
|-----|-------|
| Turkce | `locales/tr/pages/admin.json` |
| Ingilizce | `locales/en/pages/admin.json` |
| Arapca | `locales/ar/pages/admin.json` |
| Azerbaycanca | `locales/az/pages/admin.json` |
| Almanca | `locales/de/pages/admin.json` |
| Felemenkce | `locales/nl/pages/admin.json` |
| Fransizca | `locales/fr/pages/admin.json` |
| Rusca | `locales/ru/pages/admin.json` |

---

## 3. API Endpoint'leri

Tum endpoint'ler `auth` + `admin` middleware'i altinda calisir ve SuperAdmin kontrolu yapar.

### 3.1. Log Dosyalarini Listele

```
GET /api/logs
GET /api/logs?type=error
```

**Yanit:**
```json
{
    "success": true,
    "data": {
        "files": [
            {
                "filename": "error.log",
                "size": 524288,
                "size_formatted": "512.00 KB",
                "modified_at": "2026-02-17 14:30:00",
                "line_count": 1250,
                "type": "error",
                "levels": {
                    "debug": 0,
                    "info": 10,
                    "warning": 45,
                    "error": 120,
                    "critical": 5
                },
                "is_rotated": false
            }
        ],
        "total_size": 2097152,
        "total_size_formatted": "2.00 MB",
        "total_files": 8,
        "log_types": ["general", "error", "audit", "api", "debug", "integration", "render", "device"]
    }
}
```

**Log Tipi Algilama (dosya adindan):**

| Dosya Adi Icerigi | Tip |
|-------------------|-----|
| `error` | error |
| `audit` | audit |
| `api` | api |
| `debug` | debug |
| `gateway`, `pavo`, `hanshow` | integration |
| `render` | render |
| `send`, `upload` | device |
| Diger | general |

### 3.2. Log Icerigini Oku

```
GET /api/logs/read?file=error.log&page=1&per_page=100&level=error&search=timeout&order=desc
```

**Parametreler:**

| Parametre | Tip | Varsayilan | Aciklama |
|-----------|-----|------------|----------|
| `file` | string | - | Zorunlu. Log dosyasi adi |
| `page` | int | 1 | Sayfa numarasi |
| `per_page` | int | 100 | Sayfa basi satir (10-500) |
| `level` | string | all | Seviye filtresi (debug/info/warning/error/critical/all) |
| `search` | string | - | Metin arama (case-insensitive) |
| `order` | string | desc | Siralama (asc/desc) |

**Log Satiri Parse Formatlari:**

1. **JSON formati** (audit log): `{"timestamp":"...","action":"...","resource":"..."}`
2. **Standart format**: `[2026-01-10 22:01:16] [INFO] Mesaj {json_context}`
3. **API format**: `[2026-01-10 22:01:16] GET /api/products - 200 (12.34ms) - 127.0.0.1`
4. **Sadece timestamp**: `2026-01-18 17:34:42 - mesaj`
5. **Koseli timestamp**: `[2026-01-19 22:17:24] mesaj`

**Yanit:**
```json
{
    "success": true,
    "data": {
        "lines": [
            {
                "line_number": 42,
                "timestamp": "2026-02-17 14:30:00",
                "level": "ERROR",
                "message": "Database connection timeout",
                "context": {"host": "localhost", "port": 3306},
                "raw": "[2026-02-17 14:30:00] [ERROR] Database connection timeout {\"host\":\"localhost\"}"
            }
        ],
        "total": 1250,
        "page": 1,
        "per_page": 100,
        "total_pages": 13,
        "filename": "error.log",
        "file_size": 524288,
        "level_stats": {
            "DEBUG": 0,
            "INFO": 100,
            "WARNING": 45,
            "ERROR": 120,
            "CRITICAL": 5,
            "UNKNOWN": 0
        }
    }
}
```

### 3.3. Log Dosyasi Indir

```
GET /api/logs/download?file=error.log
```

Tarayicida dosya indirme baslatir (`Content-Disposition: attachment`).

**Guvenlik:** `basename()` ile path traversal engellenir, `realpath()` ile dizin dogrulamasi yapilir.

### 3.4. Log Temizleme / Silme

```
POST /api/logs/cleanup
```

**Islemler:**

| Action | Body | Aciklama |
|--------|------|----------|
| `delete_file` | `{ "action": "delete_file", "filename": "debug.log" }` | Tek dosya sil |
| `delete_bulk` | `{ "action": "delete_bulk", "filenames": ["a.log", "b.log"] }` | Toplu silme |
| `cleanup_old` | `{ "action": "cleanup_old", "days": 30 }` | Eski loglari temizle |
| `truncate` | `{ "action": "truncate", "filename": "error.log" }` | Icerik bosalt, dosyayi koru |

**Korunan Dosyalar (cleanup_old):** `app.log`, `error.log`, `audit.log` ana dosyalari otomatik temizlemeden muaftir. Sadece rotated versiyonlari (`.log.*`) temizlenir.

### 3.5. Log Raporu Gonder

```
POST /api/logs/send-report
```

**Body:**
```json
{
    "filename": "error.log",
    "recipient_ids": ["user-uuid-1", "user-uuid-2"],
    "note": "Bu hatalari incelemenizi rica ederim",
    "include_context": true,
    "line_numbers": [42, 55, 78]
}
```

**Isleyis:**
1. Log dosyasindan belirtilen satirlari veya son 50 satiri okur
2. Sistem bilgilerini toplar (sunucu, PHP surumu, IP, uygulama surumu)
3. HTML e-posta olusturur (`SmtpMailer::buildHtmlEmail()`)
4. Her aliciya SMTP ile e-posta gonderir
5. Her aliciya uygulama ici bildirim olusturur (`notifications` + `notification_recipients`)
6. Audit log kaydeder

**Yanit:**
```json
{
    "success": true,
    "data": {
        "message": "2 kisiye e-posta gonderildi, 2 kisiye bildirim olusturuldu",
        "sent_count": 2,
        "email_sent": 2,
        "notif_sent": 2,
        "total_recipients": 2,
        "errors": []
    }
}
```

**SuperAdmin company_id = NULL Sorunu:**
SuperAdmin kullanicinin `company_id` alani NULL oldugu icin `notifications` tablosunun `company_id NOT NULL` kisitlamasina takilir. Cozum: Alicinin `company_id` degeri kullanilir, o da NULL ise ilk aktif firma ID'si fallback olarak kullanilir.

### 3.6. Bildirim Ayarlari

```
GET /api/logs/notify-settings
PUT /api/logs/notify-settings
```

**Ayar Alanlari:**

| Alan | Tip | Varsayilan | Aciklama |
|------|-----|------------|----------|
| `enabled` | bool | false | Bildirimleri etkinlestir |
| `notify_on_critical` | bool | true | CRITICAL seviye log bildirimi |
| `notify_on_error` | bool | false | ERROR seviye log bildirimi |
| `notify_on_size_threshold` | bool | true | Boyut esigi asim bildirimi |
| `size_threshold_mb` | int | 50 | Boyut esigi (MB) |
| `cooldown_minutes` | int | 60 | Bildirimler arasi bekleme (5-1440 dk) |
| `notify_users` | array | [] | Alici kullanici ID'leri |
| `monitored_files` | array | ["error.log", "app.log", "audit.log"] | Izlenen dosyalar |
| `include_system_info` | bool | true | Bildirime sistem bilgileri ekle |
| `include_context` | bool | true | Bildirime log baglam verisini ekle |

**Depolama:** `settings` tablosunda sabit ID `__log_notify_settings__` ile saklanir (JSON).

**GET yaniti:** Ayarlara ek olarak `available_users` listesi doner (Admin ve SuperAdmin roller).

---

## 4. SMTP E-posta Sistemi

### SmtpMailer Servisi

`services/SmtpMailer.php` - Framework bagimliligina ihtiyac duymadan PHP raw socket uzerinden SMTP e-posta gonderir.

**Ozellikler:**
- TLS (STARTTLS), SSL, ve sifrelamesiz (none) baglanti destegi
- AUTH LOGIN kimlik dogrulama
- UTF-8 kodlama (Subject + From adi Base64 encoded)
- Multipart/alternative (HTML + plain text)
- Singleton pattern (bir istekte tek baglanti)
- Settings tablosundan SMTP yapilandirmasini otomatik yukler

**Yapilandirma Yukleme Sirasi:**
1. Aktif firmanin ayarlari (`company_id` + `user_id IS NULL`)
2. Herhangi bir ayar satiri (`user_id` veya `company_id` farketmez) icinde `smtp_host` aranir

**SMTP Ayar Alanlari (settings tablosu JSON):**

| Alan | Ornek |
|------|-------|
| `smtp_host` | `smtp.gmail.com` |
| `smtp_port` | `587` |
| `smtp_username` | `user@gmail.com` |
| `smtp_password` | `app_password` |
| `smtp_encryption` | `tls` / `ssl` / `none` |
| `smtp_from_name` | `Omnex Display Hub` |
| `smtp_from_email` | `noreply@omnex.com` |

**Onemli Not:** `GeneralSettings.js` SMTP ayarlarini `scope=company` parametresi olmadan kaydeder, dolayisiyla ayarlar `user_id` ile iliskilendirilir. SmtpMailer her iki scope'u da arar.

### E-posta Sablonu

`SmtpMailer::buildHtmlEmail($title, $bodyHtml)` metodu responsive HTML e-posta sablonu olusturur:

- Gradient header (mavi ton)
- Beyaz icerik alani
- `detail-table` stili (anahtar-deger satirlari)
- `info-box` stili (mavi kenarli bilgi kutusu)
- `code-block` stili (koyu arkaplan, monospace yazi tipi)
- Footer (otomatik bildirim notu + telif hakki)

---

## 5. Frontend Mimarisi

### Sayfa Sinifi: LogManagementPage

**Yasam Dongusu:**
1. `preload()` - `admin` sayfa cevirilerini yukler
2. `render()` - HTML iskeletini olusturur (header, stats, tabs, table)
3. `init()` - Event listener'lari baglar, log dosyalarini yukler
4. `destroy()` - DataTable'i temizler, sayfa cevirilerini kaldirir

### Sekme Yapisi

| Sekme | Icerik |
|-------|--------|
| **Dosyalar** | DataTable ile log dosyalari listesi + tip filtresi |
| **Goruntuliyici** | Secilen dosyanin icerigi (sayfalama, seviye/metin filtre) |
| **Bildirimler** | Toggle switch'ler ile bildirim ayarlari |

### DataTable Aksiyonlari

| Aksiyon | Ikon | Islem |
|---------|------|-------|
| Goruntule | `ti-eye` | Dosya icerigini goruntuluyici sekmesinde ac |
| Indir | `ti-download` | Dosyayi bilgisayara indir |
| Temizle | `ti-eraser` | Dosya icerigini bosalt (truncate) |
| Daha Fazla | `ti-dots-vertical` | Rapor gonder + Sil secenekleri modali |

### Istatistik Kartlari (setup-wizard stili)

| Kart | Ikon | Renk | Veri |
|------|------|------|------|
| Toplam Dosya | `ti-files` | Mavi | `total_files` |
| Toplam Boyut | `ti-database` | Turuncu | `total_size_formatted` |
| Hata Logu | `ti-alert-triangle` | Kirmizi | `error.log` boyutu |
| Son Aktivite | `ti-clock` | Yesil | En yeni dosyanin degistirilme zamani |

### Log Goruntuluyici

- Seviye filtresi (dropdown + chip'ler)
- Metin arama (Enter ile veya Uygula butonu)
- Sayfalama (100 satir/sayfa, ileri/geri)
- Satira tiklaninca detay modali acilir:
  - Satir numarasi, zaman damgasi, seviye, mesaj
  - Ham icerik (monospace code block + kopyala butonu)
  - JSON baglam verisi (varsa, ayri code block + kopyala)

### Rapor Gonderim Modali

1. Dosya adi (readonly)
2. Alici secimi (checkbox listesi - Admin/SuperAdmin kullanicilar)
3. Not alani (textarea)
4. Sistem bilgileri dahil et (checkbox, varsayilan: acik)
5. "Rapor Gonder" butonu

### Bildirim Ayarlari Sekmesi

**Sol Panel - Tetikleyiciler:**
- CRITICAL seviye bildirimi (toggle)
- ERROR seviye bildirimi (toggle)
- Boyut esigi bildirimi (toggle + MB degeri)
- Bildirim araligi (dakika)
- Izlenen dosyalar (checkbox listesi)

**Sag Panel - Alicilar & Secenekler:**
- Alici kullanici secimi (checkbox listesi)
- Sistem bilgilerini dahil et (toggle)
- Log baglam verisini dahil et (toggle)

---

## 6. CSS Yapisi

`public/assets/css/pages/log-management.css` - 235 satir

**Yeniden Kullanilan Stiller:**
- `.setup-status-grid`, `.setup-status-card` - Istatistik kartlari (setup-wizard.css)
- `.page-tabs`, `.page-tab` - Sekme navigasyonu
- `.audit-filters-inline` - Filtre cizgisi (audit-log.css)
- `.archive-action-item` - Islem kartlari (audit-log.css)
- `.branch-checkbox-item`, `.branch-checkbox-list` - Checkbox listesi (branches.css)
- `.notification-setting-item` - Toggle switch satirlari (notification-settings.css)

**Sayfaya Ozel Stiller:**

| Sinif | Islem |
|-------|-------|
| `.log-file-icon` | Dosya tipi ikonu (renk varyantlari: blue, rose, teal, gray, amber, purple, indigo) |
| `.log-tab-close` | Goruntuluyici sekmesi kapatma butonu |
| `.log-viewer-lines` | Log satirlari container (monospace, max-height: 600px, scroll) |
| `.log-line-row` | Tek log satiri (flex, hover efekti, seviye border-left) |
| `.log-level-badge` | Seviye etiketi (CRITICAL, ERROR, WARNING, INFO, DEBUG, AUDIT, UNKNOWN) |
| `.log-code-block` | Ham icerik / JSON gosterim alani (dark theme) |
| `.log-viewer-pagination` | Sayfalama container |
| `.log-card-title` | Bildirim ayarlari kart basligi |

**Dark Mode:** `.dark` prefix ile log viewer, satir, badge ve ayar bilesenlerine ozel override'lar.

**Responsive (768px alti):** Zaman damgasi gizlenir, badge'ler kucultulur, pagination dikey hizalanir.

---

## 7. i18n Ceviri Yapisi

Toplam ~110 ceviri anahtari, `logManagement` blogu altinda:

| Alt Grup | Anahtar Sayisi | Aciklama |
|----------|----------------|----------|
| breadcrumb | 3 | Sayfa yol izleme |
| tabs | 3 | Sekme etiketleri |
| stats | 4 | Istatistik kart etiketleri |
| columns | 5 | DataTable sutun etiketleri |
| types | 9 | Log tipi etiketleri |
| labels | 1 | Genel etiketler (rotated) |
| levels | 4 | Seviye badge etiketleri (CRITICAL, ERROR, WARN, INFO) |
| actions | 12 | Aksiyon buton/aciklama metinleri |
| viewer | 15 | Goruntuluyici etiketleri |
| confirm | 4 | Onay diyalogu metinleri |
| cleanup | 6 | Temizleme diyalogu |
| report | 9 | Rapor gonderim diyalogu |
| notifications | 20 | Bildirim ayarlari |
| toast | 12 | Bildirim mesajlari |
| time | 4 | Goreceli zaman ifadeleri |

**Parametre Kullanan Anahtarlar:**
- `viewer.showing`: `{from}`, `{to}`, `{total}`
- `confirm.deleteMessage`: `{filename}`
- `confirm.truncateMessage`: `{filename}`
- `toast.cleanupSuccess`: `{count}`
- `toast.reportSent`: `{count}`
- `time.minutesAgo`: `{count}`
- `time.hoursAgo`: `{count}`
- `time.daysAgo`: `{count}`

---

## 8. Guvenlik

### Path Traversal Korumalari

- `basename()` ile dosya adinda dizin gecisi engellenir
- `realpath()` ile gercek yolun `STORAGE_PATH/logs` icinde oldugu dogrulanir
- Sadece `.log` ve `.log.*` uzantili dosyalar listelenir

### Yetki Kontrolu

- Tum endpoint'ler `auth` + `admin` middleware'i altinda
- Her endpoint ayrica `$user['role'] !== 'SuperAdmin'` kontrolu yapar
- Bildirim ayarlari global (firma bagimsiz) - sabit ID ile saklanir

### SMTP Guvenlik

- SMTP parolasi settings tablosunda sifrelenmemis JSON icinde saklanir
- TLS/SSL ile sunucu baglantisi sifrelenir
- E-posta icerigi `htmlspecialchars()` ile XSS'e karsi korunur

---

## 9. Veritabani Etkilesimi

### Kullanilan Tablolar

| Tablo | Kullanim |
|-------|----------|
| `settings` | Bildirim ayarlari (`id = __log_notify_settings__`) ve SMTP yapilandirmasi |
| `users` | Alici listesi (Admin/SuperAdmin roller) |
| `notifications` | Rapor gonderiminde bildirim kaydi |
| `notification_recipients` | Bildirim alici kaydi |
| `companies` | SuperAdmin fallback company_id icin |

### Bilinen Kisitlamalar

1. **notifications.company_id NOT NULL:** SuperAdmin'in company_id'si NULL. Alicinin company_id'si veya ilk aktif firma fallback olarak kullanilir.
2. **notification_recipients.created_at:** `DEFAULT CURRENT_TIMESTAMP` ile otomatik dolar, INSERT'te belirtilmez.
3. **Settings user/company scope:** SMTP ayarlari user-scope veya company-scope olarak kaydedilebilir, SmtpMailer her ikisini de arar.

---

## 10. Audit Log Kayitlari

Tum islemler `Logger::audit()` ile kaydedilir:

| Islem | Entity Type | Ek Veriler |
|-------|-------------|------------|
| Dosya silme | `system_logs` | filename, size |
| Toplu silme | `system_logs` | action, deleted_count, filenames |
| Eski log temizleme | `system_logs` | days_threshold, deleted_count, files |
| Icerik bosaltma | `system_logs` | filename, old_size |
| Rapor gonderme | `system_logs` | filename, recipients, email_sent, notif_sent, note |
| Bildirim ayari guncelleme | `log_notification_settings` | new (tum ayarlar) |

---

## 11. Bilinen Sorunlar ve Notlar

### SMTP Ayarlari

- `GeneralSettings.js` SMTP ayarlarini `scope` parametresi olmadan kaydeder (user-scope)
- `SmtpMailer::loadConfig()` once company-scope, sonra tum satirlardan `smtp_host` arar
- Test-SMTP butonu sadece baglanti test eder, ayarlari kaydetmez
- SMTP ayarlarini kaydetmek icin Ayarlar sayfasinda "Kaydet" butonuna basilmalidir

### Log Dosya Yonetimi

- `storage/logs/` dizinindeki `.log` ve `.log.*` dosyalari taranir
- Seviye orneklemesi ilk 500 satirdan yapilir (buyuk dosyalar icin yaklasik deger)
- Tum dosya icerigi okuma sunucu bellegini etkileyebilir (buyuk dosyalarda sayfalama kullanin)

### Performans

- Dosya listeleme: Her dosya icin satir sayimi ve seviye orneklemesi yapilir (buyuk dizinlerde yavas olabilir)
- Log okuma: Tum dosya bellige okunur, sonra sayfalanir (cok buyuk dosyalarda optimizasyon gerekebilir)
- SMTP: Her alici icin ayri baglanti acilir (toplu gonderimde socket reuse eklenebilir)
