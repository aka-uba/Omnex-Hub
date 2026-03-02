# Signage PWA + APK Sistem Durumu

- Dokuman tarihi: `2026-02-12 16:11:00`
- Proje kok dizini: `C:\xampp\htdocs\market-etiket-sistemi`
- Kapsam: `signage`, `playlist`, `player`, `device` yonetimi ve Android APK/PWA birlikte calisma modeli

## 1. Mimari Ozet

1. Web Player (PWA): `public/player`
2. Android Native Player (WebView wrapper): `android-player/omnex-player-app`
3. API katmani: `api/player`, `api/devices`, `api/playlists` ve ilgili endpointler
4. Dagitim: Web/PWA + APK birlikte desteklenir

## 2. Bu Oturumda Yapilanlar

### 2.1 Player (Web/PWA) tarafi

1. APK icinde acilan cihazlarda PWA install modalinin zorunlu cikmasi kapatildi:
   - `showInstallPromptInAndroidApp: false`
2. PWA install modaline APK indirme secenegi eklendi:
   - PWA ve APK secenekleri birlikte sunulur
3. Sabit aksiyon alanina iki ikon eklendi:
   - `PWA yukle`
   - `APK indir`
4. Sag alt koseye yatay/dikey tercih butonu eklendi:
   - `orientation-toggle-btn`
5. Registration/aktivasyon ekrani responsive yapisi guclendirildi:
   - Kod satir kirilmasi engellendi
   - Mobil, yatay mobil, tablet, TV gorunumleri yeniden dengelendi
6. Cozunurluk etiketi netlestirildi:
   - `CSS px + fiziksel px + DPR` birlikte gosterilir
7. Yerel template URL sorunu icin localhost normalizasyonu eklendi:
   - `localhost/127.0.0.1` URL'ler, uzak cihazda aktif host'a cevrilir
   - Ozellikle PWA uygulama modunda local icerik acilmama sorununu azaltir
8. Service worker cache surumu arttirildi:
   - `v1.2.1`
   - Eski cache kaynakli stale icerik problemlerini azaltmak icin
9. Ekran yonu ikonu davranisi gercek donuse cevrildi:
   - Lock desteklenmeyen cihazlarda CSS rotation fallback ile ekran donusu uygulanir
10. Ekran yonu ile icerik yonu birbirinden ayrildi:
   - Toggle ekran yonunu etkiler
   - Icerik yerlesimi kendi orientation mantigini korur
11. Item bazli orientation sistemi eklendi:
   - Playlist genel orientation yerine her item icin orientation hesaplanir
   - Metadata varsa (`orientation`, `width/height`, `resolution`) kullanilir
   - Metadata yoksa image/video dogal boyutundan runtime tespit yapilir
12. Karsit yon durumlarinda germe kaldirildi:
   - Icerik ortada ve oran korunarak (`contain`) gosterilir
13. Chrome sekme/PWA kayit ekrani masaustu gorunumu iyilestirildi:
   - Genis ekranda grid dengesi ve panel yerlesimi yeniden duzenlendi
   - Standalone modda stretch etkisini azaltmak icin `object-fit: contain` kullanildi

### 2.2 Android APK tarafi

1. Splash -> Wizard yonlendirme guclendirildi:
   - `first_run` veya `server_url` eksikse wizard acilir
2. Wizard metinleri kaynak dosyaya tasindi:
   - Hardcoded metinler yerine `strings.xml`
3. Wizard mobil tasarimi yeniden duzenlendi:
   - Scroll garantisi (`NestedScrollView`)
   - Alt buton alaninin sabit ve erisilebilir olmasi
   - Kucuk ekranlarda tasmanin azaltilmasi
4. Mobil yatay gorunum icin ayri layout eklendi:
   - `layout-land/activity_wizard_mobile.xml`
5. TV wizard arayuzu iyilestirildi:
   - Sag panel `ScrollView`
   - Kart tabanli ve daha okunakli olculer
6. URL input odaginda klavye deneyimi modal hissine cekildi:
   - `keyboardDimOverlay` ile arka plan dimlenir
   - Input odagi kalkinca overlay kapanir
7. Wizard icon seti yenilendi:
   - Welcome / Server / Ready iconlari daha modern ve tutarli hale getirildi
8. Geri tusu davranisi guncellendi:
   - Player ekraninda 2 saniye icinde iki kez geri tusuna basildiginda uygulama kapanir
   - Ilk basista kullaniciya bilgilendirme toast'i gosterilir
9. Play guvenlik uyumu icin SSL davranisi sertlestirildi:
   - DEBUG: yerel/self-signed ortamlarda uyumluluk icin `proceed`
   - RELEASE: SSL hatasinda istek iptal edilir (`cancel`) ve kullaniciya hata mesaji gosterilir

### 2.3 APK adlandirma ve dagitim

1. Debug build cikisi yayin adina cevriliyor:
   - `omnex-player.apk`
2. Yayin hedefleri:
   - `public/downloads/omnex-player.apk`
   - `downloads/omnex-player.apk`
3. Gradle gorevi:
   - `publishDebugApk`
   - Dosya: `android-player/omnex-player-app/app/build.gradle`

## 3. IP Erisim Durumu (192.168.1.23)

Son kontrolde erisim dogrulandi:

1. `http://192.168.1.23/market-etiket-sistemi/` -> `200`
2. `http://192.168.1.23/market-etiket-sistemi/player/` -> `200`
3. `Test-NetConnection 192.168.1.23 -Port 80` -> `TcpTestSucceeded: True`

Not:

1. Bu oturumda `192.168.1.23` erisimini kapatan bir kod degisikligi yapilmadi.
2. Gecici erisim kesintileri gorulurse ag/firewall veya servis gecikmesi kontrol edilmelidir.

## 4. Dosya Bazli Guncel Degisiklikler

1. `public/player/index.html`
   - Asset versiyonlari guncellendi (`player.css?v=21`, `player.js?v=27`)
   - APK/PWA aksiyon konfigurasyonu korundu
2. `public/player/assets/js/player.js`
   - `normalizeLocalhostUrl()` eklendi
   - `formatDisplayMetrics()` CSS+fiziksel piksel formatiyla guncellendi
   - Item bazli orientation cozumu eklendi
   - Runtime image/video boyutundan orientation fallback eklendi
   - Ekran donusu fallback davranisi guclendirildi
3. `public/player/assets/css/player.css`
   - Rotation fallback ve karsit yon iceriklerde oran koruyan merkezleme eklendi
   - Chrome sekme/PWA masaustu gorunumu ve standalone `contain` davranisi iyilestirildi
4. `public/player/sw.js`
   - `CACHE_VERSION = v1.2.1`
5. `android-player/omnex-player-app/app/src/main/java/com/omnex/player/WizardActivity.kt`
   - Wizard adimlari `strings.xml` kaynaklariyla calisiyor
   - Buton ve hata metinleri lokalize edildi
6. `android-player/omnex-player-app/app/src/main/res/values/strings.xml`
   - Wizard metin seti temiz ve merkezilesmis hale getirildi
7. `android-player/omnex-player-app/app/src/main/res/layout/activity_wizard_mobile.xml`
   - Mobil portrait wizard yeniden tasarlandi
8. `android-player/omnex-player-app/app/src/main/res/layout-land/activity_wizard_mobile.xml`
   - Mobil landscape wizard yeni responsive layout olarak eklendi
9. `android-player/omnex-player-app/app/src/main/res/layout/activity_wizard_tv.xml`
   - TV wizard duzeni okunabilirlik ve scroll icin iyilestirildi
10. `android-player/omnex-player-app/app/src/main/res/drawable/wizard_welcome.xml`
    - Wizard 1. adim ikonu yenilendi
11. `android-player/omnex-player-app/app/src/main/res/drawable/wizard_server.xml`
    - Wizard 2. adim ikonu yenilendi
12. `android-player/omnex-player-app/app/src/main/res/drawable/wizard_ready.xml`
   - Wizard 3. adim ikonu yenilendi
13. `android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt`
   - Cift geri-basma cikis akisi eklendi
   - Release icin SSL error bypass kaldirildi
14. `android-player/omnex-player-app/app/src/main/res/values/strings.xml`
   - Geri tusu bilgilendirme ve SSL hata metinleri eklendi

## 5. Build / Test Komutlari

```powershell
cd C:\xampp\htdocs\market-etiket-sistemi\android-player\omnex-player-app
.\gradlew.bat clean assembleDebug --stacktrace
.\gradlew.bat publishDebugApk --stacktrace
```

Beklenen cikti:

1. `android-player/omnex-player-app/app/build/outputs/apk/debug/app-debug.apk`
2. `public/downloads/omnex-player.apk`
3. `downloads/omnex-player.apk`

## 6. Orientation Sistemi (Son Guncelleme)

1. Toggle butonu ekrani dondurur:
   - Destek varsa `screen.orientation.lock` kullanilir
   - Destek yoksa CSS fallback ile donus uygulanir
2. Icerik orientation item bazlidir:
   - Ayni playlist icinde landscape ve portrait item birlikte calisabilir
   - Her item kendi orientation degerine gore merkezlenir
3. Karsit yon eslesmelerinde germe yapilmaz:
   - Portrait icerik landscape ekranda pillarbox olarak ortalanir
   - Landscape icerik portrait ekranda letterbox olarak ortalanir
4. Tespit sirasi:
   - Explicit orientation metadata
   - Width/height ve resolution metadata
   - Runtime image/video dogal boyutu fallback

## 7. Sonraki Adimlar (Operasyonel)

1. Release imzali dagitim hattini eklemek (`assembleRelease` + `publishReleaseApk`)
2. PWA cache temizleme adimini saha kurulum checklist'ine eklemek
3. APK kurulum ikonunu panel tarafinda da merkezi olarak gostermek (cihaz turune gore)

## 8. 2026-02-12 16:44:32 Sonrasi Ek Guncellemeler

1. Aktivasyon ekrani responsive kirilimlari tekrar ayrildi:
   - Mobilde (`max-width:980` veya portrait): sol/sag padding eklendi, ekran ortalama guclendirildi, ustte yapisma kaldirildi.
   - TV benzeri yatay dar yukseklikte (`min-width:1100`, `landscape`, `max-height:860`): ust/yan bosluklar optimize edildi, kirpilma azaltildi, alt satirda bilgi + QR dengeleyen grid duzeni tanimlandi.
2. TV gorunumunde alt bolum gorunurlugu iyilestirildi:
   - Sync kod boyutu ve harf araligi dusuruldu.
   - Timer tam genislikte ortalandi.
   - QR kutusu kontrollu boyuta cekildi.
3. Yeni playlist geldiginde eski medya birikimini azaltmak icin otomatik budama eklendi:
   - Player, guncel playlist URL listesini Service Worker'a gonderir.
   - Service Worker `PRUNE_MEDIA_CACHE` ile listede olmayan eski medya cache girdilerini temizler.
   - Sonra sadece guncel medya `CACHE_MEDIA` ile yeniden onbellege alinir.
4. Versiyonlar guncellendi:
   - `public/player/sw.js` -> `CACHE_VERSION = v1.2.2`
   - `public/player/index.html` -> `player.css?v=23`, `player.js?v=28`

Not:

1. Bu degisiklikler mevcut oynatim akisini bozmaz; sadece aktivasyon ekraninin yerlesimi ve media cache yasam dongusu iyilestirildi.

## 9. 2026-02-12 16:54 Sonrasi Ince Ayar

1. PC ve TV ayrimi yapildi:
   - `player.js` icinde body'ye cihaz profili siniflari eklendi (`device-tv`, `device-mobile`, `device-tablet`, `device-desktop`).
   - Dusuk yukseklikli landscape optimizasyonu sadece `body.device-tv` icin calisacak sekilde sinirlandi.
2. PC tarayici aktivasyon ekraninda dikey ortalama geri getirildi:
   - TV odakli "uste yapis" davranisinin desktopa tasmasi engellendi.
3. Mobilde yatay bosluk zorunlu hale getirildi:
   - `#registration-screen` padding degerleri `!important` ile guvenceye alindi.
   - Mobil/portrait kiriliminda minimum `15px` yan padding ayarlandi.
4. TV'de info + QR bolgesi iki kart olarak iyilestirildi:
   - Cihaz bilgi karti ve QR karti ayni satirda, yan yana ve tasmayi azaltacak olculerde duzenlendi.
   - QR alani kart gorunumlu ve merkezli render olacak sekilde guncellendi.
5. Asset versiyonlari:
   - `player.css?v=24`
   - `player.js?v=29`

## 10. 2026-02-12 17:00 TV Card Yerlesim Revizyonu

1. TV tespiti guclendirildi:
   - UA disinda `pointer/hover` ve ekran genisligi heuristigi eklendi.
   - `isLikelyTvDisplay` ile `device-tv` sinifinin daha tutarli atanmasi saglandi.
2. TV aktivasyon duzeni netlestirildi:
   - Cihaz bilgi karti (`device-info`) ve QR karti (`qr-container`) ayni satirda zorunlu hale getirildi.
   - QR icin dis kart stili (arka plan, border, radius, padding) standartlastirildi.
3. PC davranisi korunurken TV override ayrildi:
   - TV grid override yalnizca `body.device-tv` altinda calisir.
4. Cache bust icin asset versiyonlari tekrar artirildi:
   - `player.css?v=25`
   - `player.js?v=30`

## 11. 2026-02-12 17:10 TV Stacking/Scroll Duzeltmesi

1. TV'de alt alta dusme ve scroll sorununa karsi `device-tv` icin baskin layout eklendi:
   - Aktivasyon ekrani TV profilinde `overflow: hidden` ve tam-ekran grid ile calisir.
   - Header/code ustte, `device-info` + `QR` alt satirda yan yana zorunludur.
2. Kucuk yukseklik fallback kurali TV disina alindi:
   - `max-height:520` landscape kurali artik sadece `body:not(.device-tv)` icin gecerlidir.
   - Boylece TV'de logo/header ve QR gizlenmez.
3. Dar TV genisliklerinde ikinci fallback:
   - `max-width:1200` altinda TV gridi `header+code` ustte, `side+qr` altta 2 kolon olarak korunur.
4. Asset versiyonlari:
   - `player.css?v=26`
   - `player.js?v=31`

## 12. 2026-02-12 17:20 Play Release Hazirliklari

1. Cleartext politikasi build tipe gore ayrildi:
   - Main manifestten `usesCleartextTraffic` ve `networkSecurityConfig` kaldirildi.
   - `debug` manifestte HTTP izinli ayar korunur.
   - `release` manifestte `usesCleartextTraffic=false` zorunlu.
2. Release signing şablonu eklendi:
   - `app/build.gradle` icinde `keystore.properties` tabanli `signingConfigs.release` akisi.
   - Dosya mevcut degilse build bozulmadan devam eder (sadece auto-sign uygulanmaz).
3. Release artifact task eklendi:
   - `publishReleaseArtifacts` -> `omnex-player-release.apk` ve `omnex-player-release.aab`
   - hedef: `public/downloads/`
4. Operasyonel checklist dosyasi eklendi:
   - `docs/android-play-release-checklist.md`

## 13. 2026-02-12 17:30 Ortak Marka Logo Entegrasyonu

1. Kaynak logo:
   - `tasarımlar/logo/logo-player.png`
2. Web player logo alanlari guncellendi:
   - Loading, registration header ve fallback logo alanlari ayni marka logosunu kullanir.
   - Dosya: `public/player/index.html`
3. Web gorunurluk iyilestirmesi:
   - Logo kontrast/filter ayarlari ve yavas "breath" animasyonu eklendi.
   - Dosya: `public/player/assets/css/player.css`
4. Android logo alanlari guncellendi:
   - `brand_logo.png` eklendi/guncellendi.
   - Splash mobile, splash TV, wizard mobile/landscape brand alanlari yeni logoyu kullanir.
   - Hafif animasyon: `res/anim/logo_breath.xml`
5. Dagitim:
   - `publishDebugApk` calistirildi.
   - Guncel APK: `public/downloads/omnex-player.apk` ve `downloads/omnex-player.apk`

## 14. 2026-02-12 18:47 Tenant Izolasyon Sertlestirmesi (Pairing Akisi)

1. Player API istemcisine tenant context tasima eklendi:
   - URL parametreleri destekleniyor: `companyId`, `company_id`, `cid`, `companySlug`, `company_slug`
   - Register istegine context body icinde otomatik ekleniyor.
   - Verify istegine `fingerprint` + tenant parametreleri query olarak ekleniyor.
   - Dosya: `public/player/assets/js/api.js`

2. Public register endpointleri company baglayabilir hale getirildi:
   - `api/player/register.php` ve `api/esl/register.php`:
     - Opsiyonel companyId/companySlug dogrulama
     - `companies` tablosundan aktif sirket kontrolu
     - `device_sync_requests.company_id` alanina yazma
     - Pending request tekrar kullanimi company scope'a alindi

3. Verify endpoint scope-aware hale getirildi:
   - `api/player/verify.php`:
     - Opsiyonel tenant context dogrulama
     - Opsiyonel `fingerprint` eslestirmesi
     - Sync code poll islemi sirket/fingerprint baglaminda daraltildi

4. Approve/Reject endpointlerinde tenant claim ve kontrol eklendi:
   - `api/esl/approve.php`:
     - Aktif company context zorunlu
     - Pending secimi `(company_id = active OR NULL)` kisitli
     - NULL request company'ye atomik claim edilir
     - Farkli company'ye ait kayitlar reddedilir
   - `api/esl/reject.php`:
     - Ayni company scope kurallari reject akisina da uygulandi

5. Pending listelemede varsayilan izolasyon sikilastirildi:
   - `api/esl/pending.php`:
     - Varsayilan: sadece aktif company kayitlari
     - `include_unbound=1` verilirse `company_id IS NULL` kayitlar da gorunur

6. Dogrulama:
   - PHP syntax: `api/player/register.php`, `api/player/verify.php`, `api/esl/register.php`, `api/esl/approve.php`, `api/esl/reject.php`, `api/esl/pending.php` -> temiz
   - JS syntax: `public/player/assets/js/api.js` -> temiz

## 15. 2026-02-12 19:00 APK Dinamik Player URL (Deeplink/QR)

1. Android player deeplink ile URL guncelleme eklendi:
   - Uygulama `ACTION_VIEW` intent geldiginde URL'yi parse eder.
   - Yeni URL `SharedPreferences` icine (`server_url`) kaydedilir.
   - `first_run=false` yapilip wizard bypass edilir.
   - Dosya: `android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt`

2. Desteklenen deeplink formatlari:
   - `omnexplayer://open?url=https%3A%2F%2Falanadiniz.com%2Fmarket-etiket-sistemi%2Fplayer%2F`
   - `omnexplayer://open?path=%2Fmarket-etiket-sistemi%2Fplayer%2F`
   - Direkt `url` query paraminda tam player URL

3. Relatif path fallback:
   - Girilen deger `/player` veya `/market-etiket-sistemi/player/` gibi relatifse
   - Kayitli mevcut server origin'i kullanilarak tam URL'ye cevrilir.

4. Runtime davranisi:
   - Uygulama acikken yeni deeplink gelirse `onNewIntent` ile URL guncellenir ve player yeniden yuklenir.

5. Build dogrulamasi:
   - `android-player/omnex-player-app` icinde `gradlew assembleDebug` basarili.

## 16. 2026-02-12 19:17 Cihaz Onayinda Opsiyonel Playlist Atamasi

1. Admin onay modalina playlist secimi eklendi:
   - Dosya: public/assets/js/pages/devices/list/ApprovalFlow.js
   - Onay modalinda yeni alan: approve-req-playlist
   - Liste kaynagi: GET /api/playlists
   - Secim bos birakilabilir (opsiyonel).

2. Onay API payloadi genislatildi:
   - Frontend artik playlist_id de gonderiyor.
   - Backende giden alanlar: request_id, sync_code, name, type, group_id, playlist_id, location

3. Backend approve akisi guncellendi:
   - Dosya: api/esl/approve.php
   - Yeni kabul edilen alan: playlistId / playlist_id
   - Playlist company scope icinde dogrulaniyor.
   - Cihaz olusturulduktan hemen sonra secili playlist otomatik atanabiliyor.
   - Atama sonrasi device_commands tablosuna refresh_content komutu ekleniyor.

4. Bos playlist uyarisi:
   - Secilen playlistin ogesi yoksa islem bloklanmiyor.
   - API response icinde warning donuyor.
   - Frontend bu uyarayi toast ile gosteriyor.

5. Dogrulama:
   - node --check public/assets/js/pages/devices/list/ApprovalFlow.js -> temiz
   - php -l api/esl/approve.php -> temiz

## 17. 2026-02-12 19:30 Bekleyen Cihaz ve Sync Code Iyilestirmesi

1. Bekleyen cihazlar listesinde unbound kayitlar tekrar gorunur hale getirildi:
   - Dosya: public/assets/js/pages/devices/list/ApprovalFlow.js
   - Cagri guncellendi: /esl/pending?status=pending&include_unbound=1

2. Dashboard bekleyen sayaci ayni filtreye cekildi:
   - Dosya: public/assets/js/pages/devices/DeviceList.js
   - Cagri guncellendi: /esl/pending?status=pending&include_unbound=1

3. Android TV otomatik tespit sirasi duzeltildi:
   - Dosya: public/player/assets/js/player.js
   - TV User-Agent kontrolu tablet kontrolunden once calisiyor.

4. Sync code ile onayda yanlis "expired" donus riski azaltildi:
   - Dosya: api/esl/approve.php
   - sync_code aramasinda en guncel pending kayit seciliyor (ORDER BY created_at DESC LIMIT 1).
   - Farkli company kaydi varsa net olarak forbidden donuyor.
   - Durum kontrolunde de en guncel kayit baz aliniyor.

5. Dogrulama:
   - node --check public/assets/js/pages/devices/list/ApprovalFlow.js -> temiz
   - node --check public/assets/js/pages/devices/DeviceList.js -> temiz
   - node --check public/player/assets/js/player.js -> temiz
   - php -l api/esl/approve.php -> temiz
