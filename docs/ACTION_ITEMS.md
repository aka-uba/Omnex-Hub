# Omnex Display Hub - Aksiyon Listesi

Son guncelleme: 2026-02-08
Mevcut surum: v2.0.19
CLAUDE.md referans tarihi: 2026-01-31

---

## 1. Kritik Guvenlik Aksiyonlari

### 1.1 SSL Dogrulama Production Ayari
- **Aciklama:** Gateway `security.ssl_verify` degeri `false` olarak ayarli. Production ortaminda mutlaka `true` yapilmali. Aksi halde MITM (Man-in-the-Middle) saldirilarina acik kalir.
- **Oncelik:** Kritik
- **Efor:** Kucuk
- **Ilgili dosyalar:** `gateway/gateway.config.json`, `services/PavoDisplayGateway.php`
- **Aksiyon:** Production deploy oncesi `ssl_verify: true` yapilmali, gecerli SSL sertifikasi saglanmali.

### 1.2 Varsayilan Test Kullanici Sifrelerinin Degistirilmesi
- **Aciklama:** CLAUDE.md'de acik metin olarak test kullanici bilgileri yer aliyor (`admin@omnex.local / OmnexAdmin2024!`, `company@omnex.local / CompanyAdmin2024!`). Production veritabaninda bu hesaplarin silinmesi veya sifrelerinin degistirilmesi gerekli.
- **Oncelik:** Kritik
- **Efor:** Kucuk
- **Ilgili dosyalar:** `database/seeds/`, `CLAUDE.md` (Test Kullanicilari bolumu)
- **Aksiyon:** Production deploy scriptine varsayilan hesaplari devre disi birakan adim ekle. `.production` dosyasi varken seed'ler calismasin.

### 1.3 Proxy Endpoint SSRF Riski
- **Aciklama:** `api/proxy/fetch.php` endpoint'i X-Frame-Options bypass icin server-side proxy gorevi goruyor. Yetersiz URL dogrulamasi varsa SSRF (Server-Side Request Forgery) saldirilarina yol acabilir. Internal servislere (127.0.0.1, 169.254.x.x, 10.x.x.x) erisimi engellenmelidir.
- **Oncelik:** Kritik
- **Efor:** Orta
- **Ilgili dosyalar:** `api/proxy/fetch.php`
- **Aksiyon:** URL whitelist/blacklist kontrolu ekle. Ozel IP aralik bloklari (RFC 1918, link-local, loopback) engellenmeli. DNS rebinding korumasina dikkat edilmeli.

### 1.4 Firmware Yukleme Endpoint Guvenlik Dogrulamasi
- **Aciklama:** `api/devices/control.php` firmware_upgrade aksiyonu cihaza firmware yukliyor. Dosya butunlugu dogrulamasi (checksum/signature) yapilmiyor. Kotu amacli firmware yuklenebilir.
- **Oncelik:** Kritik
- **Efor:** Orta
- **Ilgili dosyalar:** `api/devices/control.php`, `services/PavoDisplayGateway.php`
- **Aksiyon:** Firmware dosyasi icin SHA-256 checksum dogrulamasi ekle. Sadece bilinen firmware imzalarini kabul et. `firmware_updates` tablosundaki checksum alaniyla karsilastir.

### 1.5 JWT Token Yenileme Mekanizmasi Guclendirme
- **Aciklama:** Device token'lari 365 gun gecerli. Bu sure cok uzun. Token calindiginda uzun sure kotu kullanimlara yol acabilir. Token rotation mekanizmasi yok.
- **Oncelik:** Yuksek (Kritik'e yakin)
- **Efor:** Orta
- **Ilgili dosyalar:** `middleware/DeviceAuthMiddleware.php`, `middleware/AuthMiddleware.php`
- **Aksiyon:** Device token suresini 30 gune dusur, heartbeat sirasinda otomatik token yenileme ekle. Kullanici token'lari icin refresh token mekanizmasi guclendir.

### 1.6 Rate Limiting Bypass Kontrolu
- **Aciklama:** Rate limiting IP bazli calisiyorsa, ayni IP'den farkli kullanicilar etkilenebilir (shared NAT). Reverse proxy (Cloudflare, nginx) arkasinda `X-Forwarded-For` header'i spoof edilebilir.
- **Oncelik:** Yuksek
- **Efor:** Kucuk
- **Ilgili dosyalar:** `middleware/RateLimitMiddleware.php`, `middleware/ApiGuardMiddleware.php`
- **Aksiyon:** Trusted proxy listesi tanimla. `X-Forwarded-For` sadece bilinen proxy'lerden kabul edilsin. Token bazli rate limiting de eklenebilir.

---

## 2. Yuksek Oncelikli Gelistirmeler

### 2.1 Sube/Bolge Yapisi Tamamlama
- **Aciklama:** Multi-branch firma destegi kismen mevcut. `branches` tablosu ve `product_branch_overrides` tablosu calisir durumda. Ancak 4 kritik bilesin eksik.
- **Oncelik:** Yuksek
- **Efor:** Buyuk
- **Ilgili dosyalar:** `docs/BRANCH_SYSTEM_ARCHITECTURE.md`, `services/TamsoftGateway.php`, `services/HalDataResolver.php`
- **Eksik parcalar:**

  **a) Kullanici Sube Erisimi (`user_branch_access` tablosu)**
  - Hangi kullanicinin hangi subelere erisimi oldugunu tanimlayan tablo ve API
  - AuthMiddleware'de sube bazli yetkilendirme
  - Efor: Orta
  - Ilgili dosya: `middleware/AuthMiddleware.php`, yeni `api/branches/access.php`

  **b) BranchSelector Komponenti (Header)**
  - CompanySelector gibi header'da sube secici dropdown
  - Secilen sube'ye gore verilerin filtrelenmesi
  - `X-Active-Branch` header'i ile API isteklerinde sube bilgisi
  - Efor: Orta
  - Ilgili dosya: yeni `public/assets/js/components/BranchSelector.js`

  **c) Sube Bazli Import/Export**
  - TAMSOFT sync zaten sube override yaziyor ama genel import/export sistemi sube desteklemiyor
  - ProductImport.js'de hedef sube secimi
  - Export'ta sube bazli fiyat/stok bilgisi
  - Efor: Orta
  - Ilgili dosyalar: `api/products/import.php`, `api/products/export.php`, `services/SmartFieldMapper.php`

  **d) Lisans Branch Limit**
  - Lisans planlarinda `branch_limit` alani
  - Yeni sube eklenirken limit kontrolu
  - Efor: Kucuk
  - Ilgili dosyalar: `api/branches/create.php`, `middleware/LicenseMiddleware.php`

### 2.2 Sablon Editoru - Video Arkaplan Gercek Oynatma
- **Aciklama:** BackgroundManager.js'de video arkaplan secenegi mevcut ama sadece placeholder gosteriyor. Gercek video oynatma entegrasyonu yapilmali (Fabric.js uzerinde veya overlay olarak).
- **Oncelik:** Yuksek
- **Efor:** Orta
- **Ilgili dosyalar:** `public/assets/js/pages/templates/editor/BackgroundManager.js`, `public/assets/js/pages/templates/TemplateEditor.js`
- **Aksiyon:** Fabric.js canvas uzerinde HTML5 video overlay veya canvas video render teknigi ile gercek video arkaplan destekmek.

### 2.3 Eksik API Endpoint'leri - BEKLEMEDE Tablolar
- **Aciklama:** Veritabaninda tanimli ama API endpoint'i yazilmamis 5 tablo var. Bunlar islevsel eksiklik olusturuyor.
- **Oncelik:** Yuksek
- **Efor:** Orta (toplam)
- **Detaylar:**

  | Tablo | Aciklama | Efor |
  |-------|----------|------|
  | `device_alerts` | Cihaz uyarilari (batarya dusuk, offline vb.) | Kucuk |
  | `device_content_assignments` | Cihaz-icerik eslemesi | Kucuk |
  | `device_logs` | Cihaz log kayitlari | Kucuk |
  | `price_history` | Urun fiyat degisiklik gecmisi | Kucuk |
  | `integrations` | Genel ERP/API entegrasyon yapilandirmasi | Orta |

- **Ilgili dosyalar:** `api/` altinda yeni endpoint dosyalari, `database/migrations/021_esl_pwa_updates.sql`

### 2.4 TAMSOFT ERP Sync - Bilinen Desensizlik
- **Aciklama:** MEMORY.md'de belgelenmis: Ilk basarili sync sonrasi `last_sync_date` guncelleniyor. Kullanici tum urunleri silip tekrar sync yaptiginda, API son tarihten bu yana degisiklik olmadigi icin 0 sonuc donuyor. Duzeltme yapildi ama kenar durumlari test edilmeli.
- **Oncelik:** Yuksek
- **Efor:** Kucuk
- **Ilgili dosyalar:** `services/TamsoftGateway.php` (satir ~571-590, ~695-702)
- **Aksiyon:** Otomatik `full_sync=true` retry mekanizmasini kapsamli test et. Edge case'leri icin unit test yaz.

### 2.5 i18n - Eksik Dil Cevirileri
- **Aciklama:** 7 dil destegi tanimli ama sadece TR ve EN tamamen cevrilmis. RU, AZ, DE, NL, FR dilleri eksik cevirilere sahip. Ozellikle `common.json` dosyasi TR'de 767 satir iken RU/DE'de 343 satir.
- **Oncelik:** Yuksek (cok dilli musteriler icin)
- **Efor:** Buyuk
- **Ilgili dosyalar:** `locales/` dizini
- **Detay:**

  | Dil | common.json | Eksik Sayfa Dosyalari |
  |-----|-------------|----------------------|
  | RU | 343/767 satir | notifications, queue, payments, about, branches, web-templates |
  | AZ | 343/767 satir | notifications, queue, payments, about, branches, web-templates |
  | DE | 343/767 satir | notifications, queue, payments, about, branches, web-templates |
  | NL | Kontrol edilmeli | Buyuk ihtimalle ayni |
  | FR | Kontrol edilmeli | Buyuk ihtimalle ayni |

- **Aksiyon:** Her dil icin eksik anahtarlari tespit eden script yaz. Oncelikle RU ve DE tamamlanmali.

### 2.6 Eski Bildirim Tablosunun Temizlenmesi
- **Aciklama:** `notification_settings` tablosu (migration 009) eski ve devre disi. Yeni sistem `user_notification_preferences` kullaniyor. Eski tablo veritabaninda yer kapliyor ve karisikliga yol acabilir.
- **Oncelik:** Orta-Yuksek
- **Efor:** Kucuk
- **Ilgili dosyalar:** `database/migrations/009_create_system.sql`
- **Aksiyon:** Migration ile eski `notification_settings` tablosunu drop et veya deprecated olarak isaretle.

---

## 3. Orta Oncelikli Iyilestirmeler

### 3.1 WebSocket ile Gercek Zamanli Cihaz Durumu
- **Aciklama:** Cihaz durum takibi su an polling tabanli (heartbeat). WebSocket ile gercek zamanli guncelleme saglanabilir. Cihaz online/offline gecisleri aninda gorunur.
- **Oncelik:** Orta
- **Efor:** Buyuk
- **Ilgili dosyalar:** `api/player/heartbeat.php`, `api/esl/heartbeat.php`, `public/assets/js/pages/devices/DeviceList.js`
- **Aksiyon:** PHP WebSocket sunucusu (Ratchet veya Swoole) veya harici WebSocket servisi (Pusher, Soketi) entegrasyonu. Fallback olarak mevcut polling sistemi korunmali.

### 3.2 Yayin Takvimi Sayfasi
- **Aciklama:** Zamanlanmis yayinlar icin takvim gorunumu. `schedules` tablosu mevcut ama takvim UI'i yok.
- **Oncelik:** Orta
- **Efor:** Orta
- **Ilgili dosyalar:** `public/assets/js/pages/signage/ScheduleList.js`, yeni `signage/ScheduleCalendar.js`
- **Aksiyon:** FullCalendar.js veya benzer bir kutuphane ile aylik/haftalik/gunluk gorunum. Surukle-birak ile zamanlama olusturma/duzenleme.

### 3.3 PWA Offline Destegi Iyilestirmesi
- **Aciklama:** Service Worker mevcut ama offline destek sinirli. Icerikler onceden cache'lenmeli, offline modda son bilinen icerik oynatilmali.
- **Oncelik:** Orta
- **Efor:** Orta
- **Ilgili dosyalar:** `public/player/sw.js`, `public/player/assets/js/storage.js`, `public/player/assets/js/player.js`
- **Aksiyon:** Background Sync API ile offline sirasindaki heartbeat ve komut yanlarini kuyruga al. IndexedDB'deki icerik cache'ini guclendir. Cache boyut limiti ve temizleme stratejisi ekle.

### 3.4 Performans Optimizasyonlari
- **Aciklama:** Cesitli performans iyilestirme firsatlari mevcut.
- **Oncelik:** Orta
- **Efor:** Orta (toplam)
- **Detaylar:**

  **a) SQLite Sorgu Optimizasyonu**
  - `audit_logs` tablosu buyudukce sorgular yavaslar
  - Composite index'ler ekleneli (migration 043) ama EXPLAIN QUERY PLAN ile dogrulama yapilmali
  - Efor: Kucuk
  - Ilgili dosya: `core/Database.php`, `api/audit-logs/index.php`

  **b) Frontend Bundle Boyutu**
  - Tum sayfa modulleri tek tek import ediliyor (dynamic import). Ancak shared utility'ler (BarcodeUtils, ExportManager) her kullanimda tekrar yukleniyor olabilir.
  - Code splitting analizi yapilmali
  - Efor: Kucuk
  - Ilgili dosya: `public/assets/js/app.js`

  **c) Medya Gorsel Optimizasyonu**
  - Upload sirasinda gorsel boyutlandirma ve sikistirma yok
  - Thumbnail olusturma mevcut degil
  - Efor: Orta
  - Ilgili dosya: `api/media/upload.php`

  **d) API Response Cache**
  - Sik degismeyen veriler (kategoriler, uretim tipleri, etiket boyutlari) icin server-side cache
  - Efor: Kucuk
  - Ilgili dosya: `core/` altina yeni `Cache.php` (zaten basit bir versiyonu mevcut)

### 3.5 Render Queue Dashboard - Grafik Gorsellestime
- **Aciklama:** Queue analytics endpoint'i (`/api/render-queue/analytics`) kapsamli veri donuyor ama frontend'de grafik gorsellestime (chart) yok. Trend verileri sadece metin/tablo olarak gosteriliyor.
- **Oncelik:** Orta
- **Efor:** Orta
- **Ilgili dosyalar:** `public/assets/js/pages/queue/QueueDashboard.js`, `api/render-queue/analytics.php`
- **Aksiyon:** Chart.js veya benzer hafif kutuphane ile: gunluk is/cihaz trendi, hata tipi dagilimi pasta grafigi, basari orani zaman serisi.

### 3.6 Cihaz Detay Sayfasi Gelistirme
- **Aciklama:** DeviceDetail.js "UI hazir" olarak isaretlenmis ama icerik sinirli. Cihaz gecmisi, gonderim loglar, heartbeat grafikleri, son gonderilen tasarim onizlemesi eksik.
- **Oncelik:** Orta
- **Efor:** Orta
- **Ilgili dosyalar:** `public/assets/js/pages/devices/DeviceDetail.js`
- **Aksiyon:** Heartbeat verilerinden cihaz uptime grafigi. Son gonderilen icerik onizlemesi (simulated preview - HTTP-SERVER API screenshot desteklemiyor). Cihaz komut gecmisi.

### 3.7 Urun Detay Sayfasi Gelistirme
- **Aciklama:** ProductDetail.js "UI hazir" olarak isaretlenmis ama detay sayfasi islevsel degil. Fiyat gecmisi grafigi, atanan cihazlar, HAL kunye bilgileri, sube bazli fiyatlar goruntulenmeli.
- **Oncelik:** Orta
- **Efor:** Orta
- **Ilgili dosyalar:** `public/assets/js/pages/products/ProductDetail.js`, `api/hal/data.php`
- **Aksiyon:** `price_history` tablosu icin API endpoint yaz (madde 2.3). Fiyat degisim grafigi ekle. HAL kunye bilgilerini goruntule. Sube override'larini listele.

### 3.8 Fabric.js v7 Gecis Plani
- **Aciklama:** `docs/FABRIC_V7_MIGRATION_PLAN.md` dosyasi mevcut. Fabric.js v5'ten v7'ye gecis planlanmis ama uygulanmamis. Major API degisiklikleri var.
- **Oncelik:** Orta
- **Efor:** Buyuk
- **Ilgili dosyalar:** `docs/FABRIC_V7_MIGRATION_PLAN.md`, `public/assets/js/pages/templates/TemplateEditor.js`, `public/assets/js/pages/templates/editor/*.js`
- **Aksiyon:** Mevcut Fabric.js surumunu kontrol et. v7'deki breaking change'leri degerlendir. Gecis stratejisi belirle (buyuk patlama vs. tedricen).

---

## 4. Dusuk Oncelikli / Gelecek

### 4.1 SMTP/WhatsApp/Telegram Entegrasyonu
- **Aciklama:** Bildirim sistemi mevcut ama sadece web panel uzerinden calisiyor. E-posta, WhatsApp ve Telegram kanallari planlanmis.
- **Oncelik:** Dusuk
- **Efor:** Buyuk
- **Ilgili dosyalar:** `services/NotificationService.php`, `services/NotificationTriggers.php`
- **Detay:**
  - SMTP: PHPMailer veya SwiftMailer ile e-posta gonderimi
  - WhatsApp: WhatsApp Business API entegrasyonu (Meta onay sureci gerekli)
  - Telegram: Telegram Bot API ile bildirim (daha basit, once bu yapilabilir)
- **Oneri:** Telegram ile basla (API erisilir, onay sureci yok), sonra SMTP, en son WhatsApp.

### 4.2 Unit Test Altyapisi
- **Aciklama:** Test dosyalari mevcut (`tests/phase1_test.php`, `tests/phase2_test.php`) ama bunlar entegrasyon testleri. Birim test altyapisi yok.
- **Oncelik:** Dusuk
- **Efor:** Buyuk (altyapi kurma + testleri yazma)
- **Ilgili dosyalar:** `tests/` dizini
- **Aksiyon:**
  - PHPUnit kurulumu ve yapilandirmasi
  - Frontend icin Vitest veya Jest (ES modules destegi)
  - Oncelikli test hedefleri: `core/Auth.php`, `core/Database.php`, `services/SmartFieldMapper.php`, `services/RenderQueueService.php`
  - Minimum %60 code coverage hedefi

### 4.3 E2E Test Altyapisi
- **Aciklama:** Uçtan uca test altyapisi yok. Kullanici akislari (login, urun ekleme, sablon olusturma, cihaza gonderim) otomatize edilmeli.
- **Oncelik:** Dusuk
- **Efor:** Buyuk
- **Ilgili dosyalar:** Yeni `tests/e2e/` dizini
- **Aksiyon:**
  - Playwright veya Cypress kurulumu
  - Kritik akilar: Login -> Dashboard, Urun CRUD, Sablon Editoru, Cihaz Tarama
  - CI/CD pipeline entegrasyonu (opsiyonel)

### 4.4 VvvebJs HTML Sablon Editoru Entegrasyonu
- **Aciklama:** HTML tabanli dijital tabela sablonlari icin VvvebJs entegrasyonu planlanmis. Detayli plan dokumani mevcut.
- **Oncelik:** Dusuk
- **Efor:** Cok Buyuk (7-10 hafta tahmini)
- **Ilgili dosyalar:** `docs/VVVEBJS_INTEGRATION_PLAN.md`, `web-build/VvvebJs/`
- **Detay:**
  - Faz 1: Temel entegrasyon (1-2 hafta)
  - Faz 2: Tema ve ceviri (1 hafta)
  - Faz 3: Ozel widget'lar (2-3 hafta)
  - Faz 4: Cihaz entegrasyonu (1-2 hafta)
  - Faz 5: Gelismis ozellikler (2 hafta)
- **Oneri:** Sube sistemi ve mevcut eksiklikler tamamlandiktan sonra baslama.

### 4.5 PostgreSQL Gecis Yolu
- **Aciklama:** SQLite kucuk-orta olcek icin yeterli ama buyuk muteri tabaninda (1000+ firma, 100K+ urun) performans sorunu yasanabilir. PostgreSQL gecisi icin hazirlik yapilmali.
- **Oncelik:** Dusuk
- **Efor:** Buyuk
- **Ilgili dosyalar:** `core/Database.php`, `database/migrations/*.sql`
- **Aksiyon:**
  - `Database.php`'deki SQLite-spesifik syntax'lari (datetime fonksiyonlari, AUTOINCREMENT, GROUP_CONCAT) belirle
  - Migration dosyalarindaki SQLite-only komutlari listele
  - PostgreSQL uyumlu migration seti hazirla
  - `config.php`'de veritabani driver secimi ekle (sqlite/pgsql)
  - Connection pooling destegi

### 4.6 Toplu Kagit Etiket Yazdirilma
- **Aciklama:** `docs/BULK_PRINT_PAPER_SIZE.md` dokumani mevcut. A4 kagida coklu etiket basimi icin layout sistemi planlanmis.
- **Oncelik:** Dusuk
- **Efor:** Orta
- **Ilgili dosyalar:** `docs/BULK_PRINT_PAPER_SIZE.md`, `api/templates/render.php`
- **Aksiyon:** PDF olusturma (TCPDF veya mPDF) ile A4/A5 kagida grid layout. Etiket boyutu secimi (mevcut `label_sizes` tablosu kullanilabilir).

### 4.7 Cihaz Icerik Atama API'leri
- **Aciklama:** `device_content_assignments` tablosu tanimli ama API endpoint'i yok. Bu tablo ile hangi cihaza hangi icerik atandiginin resmi takibi yapilabilir.
- **Oncelik:** Dusuk
- **Efor:** Kucuk
- **Ilgili dosyalar:** `database/migrations/021_esl_pwa_updates.sql`
- **Aksiyon:** CRUD API endpoint'leri yaz. Sablon render sirasinda otomatik atama kaydi olustur.

---

## 5. CLAUDE.md Bakim Notlari

### 5.1 Mevcut Durum

CLAUDE.md dosyasi su an **8.974 satir** uzunlugunda. Bu boyut Claude'un context window'unun onemli bir kismini kapliyor ve okuma surelerini uzatiyor.

**Onerilen maksimum boyut:** ~1.500 satir (temel mimari + aktif gelistirme notlari)

### 5.2 Ayrilabilecek Bolumlerin Onceligi

Asagidaki bolumler ayri dokumanlara tasinabilir (en buyukten en kucuge):

| Bolum | Tahmini Satir | Onerilen Hedef Dosya | Oncelik |
|-------|---------------|---------------------|---------|
| PavoDisplay ESL Entegrasyonu (Build 22-35) | ~800 satir | `docs/PAVODISPLAY_INTEGRATION.md` | Yuksek |
| PWA Signage Player (Build 29+) | ~600 satir | `docs/PWA_PLAYER.md` | Yuksek |
| Hanshow ESL Entegrasyonu | ~400 satir | `docs/HANSHOW_ESL_INTEGRATION.md` (zaten mevcut) | Yuksek |
| PavoDisplay Bluetooth Protokolu | ~300 satir | `docs/BLUETOOTH_PROTOCOL.md` | Yuksek |
| PavoDisplay HTTP-SERVER API | ~250 satir | `docs/PAVODISPLAY_HTTP_API.md` | Yuksek |
| MQTT Kontrol Komutlari | ~100 satir | `docs/MQTT_COMMANDS.md` | Orta |
| Tamamlanan Ozellikler Listesi (madde 1-93) | ~450 satir | `docs/CHANGELOG.md` | Orta |
| Bilinen Sorunlar ve Cozumleri (madde 1-34) | ~300 satir | `docs/KNOWN_ISSUES_RESOLVED.md` | Orta |
| Template Editor Revizyonu | ~200 satir | `docs/TEMPLATE_EDITOR.md` | Orta |
| Render Queue & Multi-Device Sistem | ~400 satir | `docs/RENDER_QUEUE_SYSTEM.md` | Orta |
| Barkod ve QR Kod Sistemi | ~250 satir | `docs/BARCODE_SYSTEM.md` | Dusuk |
| Cache Yonetim Sistemi | ~150 satir | `docs/CACHE_MANAGEMENT.md` | Dusuk |

### 5.3 CLAUDE.md'de Kalmasi Gereken Bolumler

Asagidaki bolumler ana CLAUDE.md'de kalmali (toplam ~1.200-1.500 satir hedefi):

1. **Proje Ozeti** (~30 satir) - Kisa ve oz
2. **Mimari Kararlar** (~20 satir) - Neden Vanilla JS, SQLite, Hash Routing
3. **Proje Yapisi** (~50 satir) - Dizin agaci
4. **Kritik Dosyalar ve Islevleri** (~40 satir) - Backend/Frontend core tablosu
5. **Mevcut Sayfalar ve Durumlari** (~60 satir) - Route/dosya/durum tablosu
6. **Onemli Desenler** (~100 satir) - Sayfa yasam dongusu, API, State, Routing, Auth
7. **Veritabani Yapisi** (~150 satir) - Tablo listesi (kisaltilmis) + ornek sorgular
8. **API Route Listesi** (~120 satir) - Tum endpoint'ler
9. **Guvenlik Notlari** (~80 satir) - Middleware tablosu + rate limiting + kritik onlemler
10. **Gelistirme Rehberi** (~60 satir) - Yeni sayfa/API ekleme pattern'leri
11. **CSS Mimarisi** (~60 satir) - Dosya yapisi + variables + bilesen tablosu
12. **i18n Sistemi** (~80 satir) - Dil dosya yapisi + kullanim + helper
13. **Sonraki Gelistirmeler** (~40 satir) - Sadece ACIK maddeler (tamamlananlar CHANGELOG'a tasinir)
14. **Bilinen Aktif Sorunlar** (~20 satir) - Sadece cozulmemis sorunlar
15. **Referans Linkleri** (~30 satir) - Ayri dokueman dosyalarina linkler

### 5.4 Guncelleme Kurallari

1. **Yeni ozellik eklediginde:** CLAUDE.md'de sadece "Sonraki Gelistirmeler" maddesini `[x]` ile isaretle. Detayli aciklamayi ilgili `docs/` dosyasina yaz.
2. **Bug duzelttiginde:** CLAUDE.md'de "Bilinen Sorunlar" bolumune ekleme. Cozulen sorunlar periyodik olarak `docs/KNOWN_ISSUES_RESOLVED.md`'ye tasinir.
3. **Ayda bir bakimi:** Tamamlanan gelistirmeleri `docs/CHANGELOG.md`'ye tasi. CLAUDE.md boyutunu kontrol et.
4. **Yeni entegrasyon eklediginde:** Ayri dokuman dosyasi olustur (`docs/ENTEGRASYON_ADI.md`). CLAUDE.md'de sadece 5-10 satirlik ozet ve link birak.

### 5.5 Referans Dokumanlar (Mevcut)

Asagidaki dosyalar zaten docs/ dizininde bulunuyor ve detayli bilgi iceriyor:

| Dosya | Icerik |
|-------|--------|
| `docs/BRANCH_SYSTEM_ARCHITECTURE.md` | Sube/bolge mimari plani (v2.4) |
| `docs/VVVEBJS_INTEGRATION_PLAN.md` | VvvebJs HTML editor entegrasyon plani |
| `docs/HANSHOW_ESL_INTEGRATION.md` | Hanshow ESL detayli dokumantasyon |
| `docs/SECURITY_AUDIT_REPORT.md` | Guvenlik denetim raporu (29 bulgu) |
| `docs/SECURITY_ACTION_PLAN.md` | Guvenlik duzeltme eylem plani (tamamlandi) |
| `docs/TAMSOFT_ERP_INTEGRATION.md` | TAMSOFT ERP entegrasyon detaylari |
| `docs/HAL_KUNYE_INTEGRATION.md` | HAL kunye entegrasyon detaylari |
| `docs/FABRIC_V7_MIGRATION_PLAN.md` | Fabric.js v7 gecis plani |
| `docs/RENDER_CACHE_SYSTEM.md` | Render cache sistemi |
| `docs/TEMPLATE_JSON_SCHEMA.md` | Sablon JSON semasi |
| `docs/BULK_PRINT_PAPER_SIZE.md` | Toplu etiket basim plani |
| `docs/LICENSE_SYSTEM_ARCHITECTURE.md` | Lisans sistemi mimarisi |

---

## Ozet Tablosu

| Kategori | Toplam Madde | Kritik | Yuksek | Orta | Dusuk |
|----------|-------------|--------|--------|------|------|
| 1. Guvenlik | 6 | 4 | 2 | - | - |
| 2. Yuksek Oncelik | 6 | - | 6 | - | - |
| 3. Orta Oncelik | 8 | - | - | 8 | - |
| 4. Dusuk/Gelecek | 7 | - | - | - | 7 |
| **Toplam** | **27** | **4** | **8** | **8** | **7** |

### Onerilen Calisma Sirasi

1. Guvenlik aksiyonlari 1.1-1.4 (hemen, production oncesi)
2. Sube/Bolge yapisi tamamlama (2.1)
3. Eksik API endpoint'leri (2.3) + Urun Detay sayfasi (3.7)
4. i18n eksik ceviriler (2.5)
5. Sablon editoru video arkaplan (2.2)
6. CLAUDE.md sadelesk (5.2-5.3)
7. Diger orta oncelikli maddeler
8. Dusuk oncelikli maddeler (proje olgunlastikca)
