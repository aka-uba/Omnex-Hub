# Omnex PriceView - Degisiklik Gunlugu (2026-03-20)

## Bugun Yapilan Tum Degisiklikler

---

### 1. Backend - Config Endpoint Duzeltmeleri

| Dosya | Degisiklik |
|-------|-----------|
| `api/priceview/config.php` | `AND key = 'general'` kaldirildi (settings tablosunda key kolonu yok) |
| `api/priceview/config.php` | `thumbnail` kolonu `preview_image, render_image` ile degistirildi (templates tablosunda thumbnail yok) |
| `api/priceview/config.php` | try-catch eklendi hata ayiklama icin |

### 2. Backend - Print Endpoint Duzeltmeleri

| Dosya | Degisiklik |
|-------|-----------|
| `api/priceview/print.php` | Font array nested handling (Array to string conversion hatasi) |
| `api/priceview/print.php` | `<base href>` eklendi (gorsel URL cozumleme) |
| `api/priceview/print.php` | Auto-detect basePath yerine absolute URL basePath |
| `api/priceview/print.php` | Barcode selector duzeltme: `.print-barcode` + `data-barcode` eslesmesi |
| `api/priceview/print.php` | Video elementleri print'te poster image ile degistirildi |

### 3. Backend - FabricToHtmlConverter Duzeltmeleri

| Dosya | Degisiklik |
|-------|-----------|
| `services/FabricToHtmlConverter.php` | JsBarcode CDN + render scripti `convert()` HTML'ine eklendi |
| `services/FabricToHtmlConverter.php` | Video print mode: video yerine poster image veya placeholder |

### 4. Backend - IntegrationSettings Fix

| Dosya | Degisiklik |
|-------|-----------|
| `public/assets/js/pages/settings/IntegrationSettings.js` | PriceView ayarlari `?scope=company` ile firma bazli kaydediliyor |
| `public/assets/js/pages/settings/IntegrationSettings.js` | Sync interval min 15dk validation + uyari notu |
| `public/assets/js/pages/settings/IntegrationSettings.js` | Durum bilgisi: urun sayisi dashboard-stats'dan |
| `locales/*/pages/settings.json` | 8 dilde `syncIntervalMin` cevirisi eklendi |

### 5. Android APK - Sync ve Config

| Dosya | Degisiklik |
|-------|-----------|
| `SyncWorker.kt` | Remote config fetch her sync'te `/api/priceview/config` cagirir |
| `SyncWorker.kt` | Config'den gelen sync_interval, overlay_timeout, default_template_id, print_enabled uygulanir |
| `SyncWorker.kt` | WorkManager `KEEP` → `UPDATE` policy (interval degisikligi uygulanir) |
| `SyncWorker.kt` | < 15dk interval icin immediate sync tetikleme |
| `SyncWorker.kt` | 401 token expired durumunda token bridge tetikleme |
| `PriceViewConfig.kt` | `printEnabled` property eklendi |
| `MainActivity.kt` | Startup'ta config fetch (blocking, 5sn timeout) |
| `MainActivity.kt` | Delta sync her baslatmada tetikleniyor (guncel fiyat icin) |

### 6. Android APK - Izin Yonetimi

| Dosya | Degisiklik |
|-------|-----------|
| `MainActivity.kt` | Tum izinler tek seferde isteniyor (Kamera + Bildirim + Medya) |
| `AndroidManifest.xml` | `READ_MEDIA_IMAGES` izni eklendi (Android 13+) |
| `MainActivity.kt` | Kamera butonunda izin isteme kaldirildi (startup'ta isteniyor) |

### 7. Android APK - Tarti Barkod Esleme

| Dosya | Degisiklik |
|-------|-----------|
| `MainActivity.kt` | Flag kodu 20-29 tespiti, 5 haneli terazi kodu cikarma |
| `MainActivity.kt` | Barkod `2700230` → terazi kodu `00230` ile urun arama |
| `MainActivity.kt` | Leading zero stripped arama da destekleniyor |

### 8. Android APK - Player Pause/Resume

| Dosya | Degisiklik |
|-------|-----------|
| `MainActivity.kt` | Barkod tarandiginda: ExoPlayer pause + HTML5 video/audio pause + playlist timer freeze |
| `MainActivity.kt` | Overlay kapandiginda: ExoPlayer resume + video/audio play + timer restart |
| `MainActivity.kt` | `window.OmnexPlayer` referansi ile dogru player instance |

### 9. Android APK - Galeri Barkod Fix

| Dosya | Degisiklik |
|-------|-----------|
| `MainActivity.kt` | Galeri seciminden once kamera durdurulur (overlay catismasi engellenir) |

### 10. OTA Update Sistemi

| Dosya | Degisiklik |
|-------|-----------|
| `MainActivity.kt` (both Player + PriceView) | `webView?.postDelayed` → `Handler.postDelayed` (null webView fix) |
| `public/downloads/update.json` | Player v2.9.22 (versionCode 51) + PriceView v1.0.2 (versionCode 3) |
| `downloads/omnex-player.apk` | Player v2.9.22 yuklu |
| `downloads/omnex-priceview.apk` | PriceView v1.0.2 yuklu |

### 11. Sunucu Bakimi

| Islem | Detay |
|-------|-------|
| Docker disk temizligi | 2.68GB builder cache + 527MB unused images temizlendi |
| SW cache | v21 → v22 |
| Docker rebuild | Tum yeni dosyalar container'a alindi |

---

## Bilinen Kalanlar (Yarin)

1. **Web sablon tasarim** - Barkod gorunuyor ama tasarim pozisyonlari birebir olmayabilir
2. **Son Senkronizasyon tarihi** - Entegrasyon durum bilgisinde gosterilmiyor (cihaz bazli veri)
3. **PriceView Cihaz Sayisi** - 0 gosteriyor, model filtresi duzeltilmeli
4. **Zombie islemler** - Sunucuda 2 zombie, temizlenmeli
5. **Sync interval 15dk siniri** - WorkManager limiti, kullaniciya acikca belirtildi

---

## Git Commit Gecmisi (Bugun)

```
b0021f3 fix: barcode selector match + video print poster + absolute media URLs
47780a0 fix(converter): add JsBarcode CDN + render script to convert() HTML output
3da0905 fix(priceview): let FabricToHtmlConverter auto-detect basePath
52da1e5 fix(priceview): add base href to print HTML for correct image/media URL resolution
e90d465 fix(priceview): print.php font array handling + remove debug log
c7daa3c fix(priceview): settings save to company level, 15min sync note, status card, print fix
86ed0c9 fix: bump SW cache v22 for priceview settings fixes
6059142 fix(priceview): config.php - thumbnail column doesn't exist, use preview_image
879e3e5 fix(priceview): add try-catch to config.php for error diagnosis
5c994ae fix(priceview): config.php settings query - remove nonexistent key column
4178c5d fix(player): v2.9.22 - OTA update check fix (Handler.postDelayed)
d8b0ea9 fix(update): PriceView v1.0.2 - OTA update check fix + config fetch
78a071e feat(priceview): v1.0.1 with remote config fetch + OTA update
```
