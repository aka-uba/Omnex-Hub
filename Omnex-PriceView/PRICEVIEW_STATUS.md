# Omnex PriceView - Durum Raporu ve Konfigurasyon Rehberi

> Son guncelleme: 2026-03-19
> Surum: 1.0.0 (versionCode 1)
> Build: assembleStandaloneDebug

---

## 1. Proje Ozeti

Omnex PriceView, Omnex Player APK'si uzerinden genisletilmis profesyonel fiyat sorgulama (price checker) uygulamasidir. Signage yayini + barkod sorgulama + yazici ciktisi tek APK'da birlestirilmistir.

**Mimari:**
- WebView: PWA signage player yukler (mevcut Omnex Player islevi korunur)
- Harici barkod okuyucu: Keyboard event + BroadcastReceiver ile yakalama
- WebView JS enjeksiyonu: Barkod scanner keyboard event'leri yakalayip native'e gonderir
- Lokal SQLite (Room): Offline-first urun katalogu
- Delta sync: Sunucudan periyodik urun guncelleme
- Android PrintManager: HTML sablon baski

---

## 2. Cihaz Bilgileri (Test Cihazi)

| Bilgi | Deger |
|-------|-------|
| Model | G66 (RK3566 cipset) |
| ADB | 192.168.1.181:40959 |
| Kamera | YOK (Camera HAL 0 device raporluyor) |
| Barkod okuyucu | Harici USB webcam-scanner (keyboard event modu) |
| Android | 11 (API 30) |

**Onemli:** Bu cihazda dahili kamera yok. CameraX/Camera2 API calismaz. Barkod okuma tamamen harici scanner uzerinden olur (FiyatGor ile ayni yontem).

---

## 3. Barkod Yakalama Mekanizmasi (3 Katman)

### Katman 1: WebView JS Enjeksiyonu (Ana Yontem)
- WebView yuklendiginde `injectBarcodeScannerScript()` cagirilir
- document.addEventListener('keydown') ile keyboard event'ler yakalanir
- Hizli gelen tuslamalar (200ms icinde) barkod olarak algilanir
- Enter veya 300ms timeout ile barkod tamamlanir (min 4 karakter)
- `AndroidBridge.onBarcodeScanned(barcode)` ile Kotlin'e gonderilir

### Katman 2: BroadcastReceiver (Profesyonel Scanner Destegi)
4 marka harici scanner intent'i dinlenir:
- Symbol SE4500: `com.se4500.onDecodeComplete` → `e.se4500`
- Newland NLS: `nlscan.action.SCANNER_RESULT` → `e.SCAN_BARCODE1`
- Unitech: `android.intent.ACTION_DECODE_DATA` → `e.barcode_string`
- Moby Data: `com.android.decodewedge.decode_action` → `e.barcode_string`

### Katman 3: Android onKeyDown (Fallback)
- Native keyboard event'leri de yakalanir
- Numerik + alfanumerik tuslar buffer'a eklenir
- 300ms sessizlik sonrasi buffer islenir

---

## 4. Device Token Akisi

1. Cihaz acilir → PWA player WebView'da yukler
2. Player sync code ile sunucuya kayit olur
3. Admin panelden cihaz onaylanir → token alinir
4. Token WebView localStorage'da saklanir (`omnex_device_token`, `omnex_device_id`)
5. `injectDeviceTokenBridge()` JS ile localStorage'dan token'i okur
6. `AndroidBridge.setDeviceToken(token, deviceId, companyId)` ile native'e aktarir
7. PriceViewConfig'e kaydedilir
8. `triggerInitialSyncIfNeeded()` tetiklenir → ilk full sync baslar

---

## 5. Urun Sync Akisi

### Ilk Sync (Full)
- `GET /api/priceview/products/sync?full=true&page=1&limit=5000`
- Firma urunleri paginated olarak indirilir
- Room SQLite'a 500'lik batch'ler halinde yazilir
- Test: 1.7MB veri, basarili

### Delta Sync (Periyodik)
- `GET /api/priceview/products/sync?since=ISO8601`
- Sadece degisen + silinen urunler gelir
- WorkManager ile 30dk aralikla calisir
- Exponential backoff: 1dk → 5dk → 15dk → 60dk

### Hard Delete Takibi
- Backend'de urun silindiginde `audit.product_deletions` tablosuna log atilir
- Delta sync bu tablodan `deleted_ids` alir ve lokal DB'den siler

---

## 6. Backend Degisiklikleri (Sunucu)

### Yeni API Endpoint'leri

| Endpoint | Method | Auth | Islev |
|----------|--------|------|-------|
| `/api/priceview/products/sync` | GET | device | Full/delta urun sync |
| `/api/priceview/products/barcode/{barcode}` | GET | device | Online barkod arama (fallback) |
| `/api/priceview/config` | GET | device | Cihaz konfigurasyonu |
| `/api/priceview/print/{id}` | POST | device | Sablon HTML render (baski icin) |

### Yeni/Degisen Dosyalar

| Dosya | Tip | Aciklama |
|-------|-----|----------|
| `api/priceview/sync.php` | Yeni | Full + delta sync |
| `api/priceview/barcode.php` | Yeni | Barkod lookup |
| `api/priceview/config.php` | Yeni | Cihaz config |
| `api/priceview/print.php` | Yeni | Print HTML (FabricToHtmlConverter) |
| `api/index.php` | Degisti | PriceView route grubu (middleware: 'device') |
| `api/devices/create.php` | Degisti | priceview → android_tv type map |
| `api/devices/update.php` | Degisti | priceview type map |
| `api/devices/index.php` | Degisti | priceview model check + status check |
| `api/esl/approve.php` | Degisti | priceview → android_tv type map |
| `api/products/delete.php` | Degisti | Silme oncesi product_deletions log |
| `core/Database.php` | Degisti | product_deletions whitelist |
| `database/postgresql/v2/22_priceview.sql` | Yeni | product_deletions tablosu + RLS |
| `public/assets/js/core/DeviceRegistry.js` | Degisti | priceview tip + isPriceView() |
| `public/assets/js/pages/devices/DeviceList.js` | Degisti | stats, form, actions |
| `public/assets/js/pages/devices/DeviceDetail.js` | Degisti | hero icon, signage detect, form |
| `locales/{8 dil}/pages/devices.json` | Degisti | priceview ceviri |

### PostgreSQL Migration (Uygulanmis)

```sql
-- audit.product_deletions tablosu
-- idx_product_deletions_company_deleted_at index
-- product_deletions_isolation RLS policy
```

Status: ✅ Hem lokal hem sunucu PG'ye uygulanmis

### Docker Rebuild

```bash
cd /opt/omnex-hub/deploy
docker compose build app --no-cache
docker compose up -d app
```

Status: ✅ Sunucuda rebuild + restart yapilmis

---

## 7. Android APK Dosya Yapisi

### Paket Bilgileri

| Bilgi | Deger |
|-------|-------|
| Package | `com.omnex.priceview` |
| applicationId | `com.omnex.priceview` |
| versionCode | 1 |
| versionName | 1.0.0 |
| minSdk | 21 |
| targetSdk | 34 |
| Deep link | `omnexpriceview://open` |
| OTA Update URL | `https://hub.omnexcore.com/downloads/priceview-update.json` |
| OTA APK URL | `https://hub.omnexcore.com/downloads/omnex-priceview.apk` |

### Yeni Kotlin Dosyalari (21 adet)

```
data/LocalDatabase.kt
data/entities/ProductEntity.kt, CategoryEntity.kt, BundleEntity.kt, SyncMetadata.kt, DeletedProductLog.kt
data/dao/ProductDao.kt, CategoryDao.kt, BundleDao.kt, SyncMetadataDao.kt, DeletedProductLogDao.kt
network/ApiClient.kt
sync/ProductSyncManager.kt, SyncWorker.kt, SyncStatus.kt
scanner/BarcodeScannerManager.kt, BarcodeAnalyzer.kt, ScanResult.kt
print/PrintHelper.kt
overlay/PriceViewOverlayManager.kt
settings/PriceViewConfig.kt
```

### Yeni Layout/Drawable Dosyalari

```
res/layout/overlay_product_info.xml
res/layout/overlay_not_found.xml
res/layout/overlay_scan_prompt.xml (minimal placeholder)
res/drawable/camera_pip_border.xml
res/drawable/player_control_circle.xml
res/drawable/scan_indicator_dot.xml
```

### Dependencies (build.gradle'a eklenen)

```gradle
// Room Database
androidx.room:room-runtime:2.6.1
androidx.room:room-ktx:2.6.1
androidx.room:room-compiler:2.6.1 (kapt)

// ML Kit Barcode (kamerali cihazlar icin)
com.google.mlkit:barcode-scanning:17.2.0

// CameraX (kamerali cihazlar icin)
androidx.camera:camera-core:1.3.1
androidx.camera:camera-camera2:1.3.1
androidx.camera:camera-lifecycle:1.3.1
androidx.camera:camera-view:1.3.1

// WorkManager (background sync)
androidx.work:work-runtime-ktx:2.9.0

// Encrypted SharedPreferences
androidx.security:security-crypto:1.1.0-alpha06

// Material Components
com.google.android.material:material:1.11.0
```

---

## 8. Bilinen Sorunlar ve Workaround'lar

### G66 Cihaz Ozel

| Sorun | Workaround |
|-------|-----------|
| Camera HAL 0 device | CameraX calismaz, harici scanner kullanilir |
| EncryptedSharedPreferences Keystore hatasi | Fallback: normal SharedPreferences kullanilir |
| UTF-8 encoding bozuk (kaynak dosyalar) | XML'de HTML entity kullanimi (&#220; gibi) |

### Genel

| Sorun | Durum |
|-------|-------|
| Kamerali cihazlarda ML Kit barcode | Kod hazir, CameraX fallback mevcut (back→front→default) |
| Admin panel PriceView ayarlari | Henuz yok (sync interval, timeout, sablon secimi) |
| Sablon secimi UI | Henuz yok - default_template_id config'den okunur |

---

## 9. Yarin Yapilacaklar (Sunucu Konfigurasyon)

### 9.1 Admin Panel PriceView Ayarlari
- [ ] PriceView cihaz detay sayfasinda sync/timeout/sablon ayarlari
- [ ] Varsayilan baski sablonu secimi
- [ ] Sync interval ayari (dakika)
- [ ] Overlay timeout ayari (saniye)

### 9.2 Baski Sistemi Test
- [ ] Sablon secip print test (USB yazici baglayarak)
- [ ] `POST /api/priceview/print/{templateId}` endpoint test
- [ ] Android PrintManager dialog gorunumu

### 9.3 Cihaz Yonetimi
- [ ] Admin panelde PriceView cihazlarini filtreleme
- [ ] Cihaz bazli sync durum gosterimi
- [ ] product_deletions temizleme cron'u

### 9.4 Test Senaryolari
- [ ] 50K urun full sync performans testi
- [ ] Delta sync dogrulama (urun guncelle → cihazda kontrol)
- [ ] Urun sil → cihazda silindi mi kontrol (product_deletions)
- [ ] Offline mod: WiFi kapat → barkod okut → lokal sonuc
- [ ] Coklu barkod formati: EAN-13, Code 128, QR

---

## 10. CLI Komutlari

### Build
```bash
cd C:/xampp/htdocs/market-etiket-sistemi/Omnex-PriceView
./gradlew.bat assembleStandaloneDebug
```

### ADB Deploy
```bash
adb connect 192.168.1.181:40959
adb -s 192.168.1.181:40959 install -r app/build/outputs/apk/standalone/debug/app-standalone-debug.apk
adb -s 192.168.1.181:40959 shell am start -n com.omnex.priceview/.SplashActivity
```

### Logcat
```bash
adb -s 192.168.1.181:40959 logcat -d | grep -E "PriceView|ProductSync|SyncWorker|Barcode"
```

### Sunucu Deploy
```bash
ssh -i ~/.ssh/camlicayazilim_omnex -p 2299 camlicayazilim@185.124.84.34
cd /opt/omnex-hub && git pull origin main
cd deploy && docker compose build app --no-cache && docker compose up -d app
```

### PostgreSQL Migration
```bash
cd /opt/omnex-hub/deploy
docker compose exec -T postgres psql -U omnex -d omnex_hub -f /dev/stdin < ../database/postgresql/v2/22_priceview.sql
```

---

## 11. Git Commit Gecmisi

```
377c51e feat(priceview): add PriceView backend - device type, API endpoints, migration, i18n
```

APK degisiklikleri henuz commit edilmedi (Omnex-PriceView dizini git'te izlenmiyor).

---

## 12. Cihaz Tipi Entegrasyonu

PriceView cihaz tipi mevcut CHECK constraint'e uyumlu olarak android_tv'ye map edilir:

| Frontend Type | DB type | DB model | Aciklama |
|---------------|---------|----------|----------|
| priceview | android_tv | priceview | Fiyat sorgulama cihazi |

Bu sayede dashboard istatistikleri, signage playlist atamasi ve rapor sorgulari kirilmaz.

DeviceRegistry.js'de:
```javascript
priceview: {
    id: 'priceview',
    dbType: 'android_tv',
    label: 'PriceView',
    icon: 'ti-tag',
    badge: { label: 'PriceView', class: 'badge-amber' },
    category: 'signage',
    capabilities: ['ping', 'send_image', 'send_video', 'product_sync', 'barcode_scan', 'print']
}
```
