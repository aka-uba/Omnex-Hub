# Omnex Player APK - Build Rehberi

**Güncel Sürüm:** 2.1.0 (versionCode: 2)

## Gereksinimler

1. **Android Studio** (2023.1.1 veya üzeri)
   - İndir: https://developer.android.com/studio

2. **JDK 17**
   - Android Studio ile birlikte gelir

## Projeyi Derleme

### Adım 1: Projeyi Android Studio ile Açın

1. Android Studio'yu açın
2. "Open an existing project" seçin
3. `android-player/omnex-player-app` klasörünü seçin
4. Gradle sync tamamlanana kadar bekleyin

### Adım 2: Sunucu URL'sini Ayarlayın

`app/build.gradle` dosyasında sunucu URL'sini değiştirin:

```gradle
defaultConfig {
    // Production URL
    buildConfigField "String", "SERVER_URL", '"https://your-server.com/market-etiket-sistemi/player/"'
}

buildTypes {
    debug {
        // Debug/Test URL (yerel ağ IP'si)
        buildConfigField "String", "SERVER_URL", '"http://192.168.1.100/market-etiket-sistemi/player/"'
    }
}
```

### Adım 3: APK İmzalama (Release için)

#### Keystore Oluşturma

Android Studio'da:
1. Build > Generate Signed Bundle / APK
2. "APK" seçin
3. "Create new..." tıklayın
4. Keystore bilgilerini doldurun:
   - Key store path: `signing/omnex-player.jks`
   - Password: Güçlü bir şifre
   - Alias: `omnex-player`
   - Key password: Aynı veya farklı şifre

#### signing/keystore.properties oluşturun:

```properties
storeFile=../signing/omnex-player.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=omnex-player
keyPassword=YOUR_KEY_PASSWORD
```

### Adım 4: APK Oluşturma

#### Debug APK (Test için):

```bash
cd omnex-player-app
./gradlew assembleDebug
```

APK konumu: `app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (Dağıtım için):

```bash
cd omnex-player-app
./gradlew assembleRelease
```

APK konumu: `app/build/outputs/apk/release/app-release.apk`

## Cihaza Yükleme

### ADB ile:

```bash
adb install app-release.apk
```

### Android TV'ye:

1. TV'de Geliştirici seçeneklerini açın
2. ADB debugging'i etkinleştirin
3. TV'nin IP adresini bulun
4. Bağlanın ve yükleyin:

```bash
adb connect 192.168.1.X:5555
adb install app-release.apk
```

### Dosya ile:

APK'yı USB bellek veya dosya paylaşımı ile cihaza kopyalayın ve dosya yöneticisinden yükleyin.

## Özellikler

### Desteklenen Cihazlar

- ✅ Android TV (Leanback launcher ile)
- ✅ Google TV
- ✅ Android Mobil (5.0+)
- ✅ Android Tablet
- ✅ Amazon Fire TV
- ✅ Xiaomi Mi Box
- ✅ NVIDIA Shield

### Özellikler

- 🌐 WebView tabanlı (tarayıcı bağımsız)
- 📺 Tam ekran mod
- 🔄 Otomatik yeniden bağlanma
- 💾 IndexedDB/LocalStorage desteği
- 🎥 Video autoplay
- 📱 D-pad navigasyonu (TV için)
- 🔒 SSL/HTTPS desteği

### JavaScript Bridge

Player'dan Android fonksiyonlarını çağırabilirsiniz:

```javascript
// Cihaz bilgisi al
if (window.AndroidBridge) {
    const deviceInfo = JSON.parse(AndroidBridge.getDeviceInfo());
    console.log(deviceInfo.model, deviceInfo.manufacturer);
}

// Toast göster
AndroidBridge.showToast("Mesaj");

// Ekranı açık tut
AndroidBridge.keepScreenOn(true);

// Sayfayı yeniden yükle
AndroidBridge.reloadPage();

// Sürüm bilgisi al (v2.1.0+)
const version = AndroidBridge.getAppVersion(); // "2.1.0"
const versionCode = AndroidBridge.getAppVersionCode(); // 2

// Hakkında dialog göster (v2.1.0+)
AndroidBridge.showAbout();
```

## Sorun Giderme

### "Cleartext HTTP traffic not permitted"

`network_security_config.xml` dosyasına yerel IP'nizi ekleyin:

```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.1.X</domain>
</domain-config>
```

### Video otomatik oynatılmıyor

Manifest'te `mediaPlaybackRequiresUserGesture="false"` ayarlandı, ancak bazı cihazlarda sorun olabilir. Player.js'de kullanıcı etkileşimi sonrası video başlatmayı deneyin.

### Android TV'de uygulama görünmüyor

`TvActivity` Leanback launcher kategorisinde tanımlı. TV'nin app drawer'ını kontrol edin.

## Güncelleme

### Manuel Güncelleme

Yeni versiyon için:

1. `app/build.gradle`'da `versionCode` ve `versionName`'i artırın
2. Release APK oluşturun
3. Cihazlara yükleyin (eski sürüm otomatik güncellenir)

### Otomatik Güncelleme (v2.1.0+)

Uzaktan APK güncelleme sistemi ile:

1. `app/build.gradle`'da sürümü artırın:
   ```gradle
   versionCode 3
   versionName "2.2.0"
   ```

2. APK derleyin:
   ```bash
   ./gradlew.bat clean assembleDebug publishDebugApk
   # veya
   ./gradlew.bat clean assembleRelease
   ```

3. `update.json` dosyasını güncelleyin:
   ```json
   {
     "versionCode": 3,
     "versionName": "2.2.0",
     "downloadUrl": "https://akagunduzweb.com/signage/downloads/omnex-player.apk",
     "releaseNotes": "Yenilikler buraya...",
     "mandatory": false
   }
   ```

4. Sunucuya yükleyin:
   ```bash
   # APK yükle
   scp public/downloads/omnex-player.apk user@server:/path/to/signage/downloads/

   # update.json yükle
   scp update.json user@server:/path/to/signage/downloads/
   ```

5. Cihazlar otomatik kontrol eder ve güncelleme teklifi gösterir

**Detaylı bilgi:** [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md)

## Güvenlik

- Production'da sadece HTTPS kullanın
- `onReceivedSslError` handler'ını production'da kaldırın
- Keystore dosyasını git'e eklemeyin
- Şifreleri güvenli saklayın
