# Omnex Player - Uzaktan Güncelleme Sistemi

## 📦 Yeni Özellikler (v2.1.0)

### 1. ✅ Wizard Buton Hover Efektleri
- Tüm butonlarda `state_hovered` ve `state_focused` desteği
- Mobil (mouse/touchpad) ve TV (D-pad) uyumlu
- Görsel geri bildirim iyileştirmesi

### 2. 🔄 Otomatik Güncelleme Sistemi
- Uygulama başlangıcında (5 saniye sonra) otomatik güncelleme kontrolü
- `https://akagunduzweb.com/signage/downloads/update.json` üzerinden sürüm kontrolü
- APK indirme ve otomatik kurulum
- Zorunlu (mandatory) ve opsiyonel güncelleme desteği
- Sürüm notları gösterimi

### 3. 📱 Sürüm Bilgisi
- AndroidManifest.xml'de otomatik sürüm kaydı
- JavaScript'ten erişilebilir: `AndroidBridge.getAppVersion()`, `AndroidBridge.getAppVersionCode()`
- "Hakkında" dialog: `AndroidBridge.showAbout()` - sürüm, cihaz bilgileri ve güncelleme kontrolü
- Sistem ayarlarında görünür (Android Settings > Apps > Omnex Player)

---

## 🚀 Sunucuya Yükleme Talimatları

### Adım 1: Gerekli Dosyalar

Sunucunuzda `https://akagunduzweb.com/signage/downloads/` dizinine şu dosyaları yükleyin:

1. **omnex-player.apk** - Derlenen APK dosyası
   - Konum: `public/downloads/omnex-player.apk`

2. **update.json** - Güncelleme bilgileri
   - Örnek: `android-player/update.json.example`

### Adım 2: update.json Oluşturma

```json
{
  "versionCode": 2,
  "versionName": "2.1.0",
  "downloadUrl": "https://akagunduzweb.com/signage/downloads/omnex-player.apk",
  "releaseNotes": "- Wizard ekranı hover efektleri eklendi\n- Otomatik güncelleme sistemi eklendi\n- Performans iyileştirmeleri",
  "mandatory": false
}
```

**Alan Açıklamaları:**
- `versionCode` (int): Sürüm numarası (her sürümde artırılmalı, build.gradle ile eşleşmeli)
- `versionName` (string): Kullanıcı dostu sürüm ismi (ör: "2.1.0")
- `downloadUrl` (string): APK indirme URL'si
- `releaseNotes` (string): Yenilikler listesi (opsiyonel, `\n` ile satır atlatma)
- `mandatory` (boolean): Zorunlu güncelleme mi? (`true` = kullanıcı atlayamaz)

### Adım 3: Dosya İzinleri

```bash
# SSH ile sunucuya bağlanın
cd /path/to/signage/downloads/

# İzinleri ayarlayın
chmod 644 update.json
chmod 644 omnex-player.apk

# Dizin izni
chmod 755 .
```

### Adım 4: CORS Ayarları (Nginx)

Eğer API ve APK farklı domain'lerdeyse:

```nginx
location /signage/downloads/ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

### Adım 5: Test

```bash
# update.json erişim testi
curl https://akagunduzweb.com/signage/downloads/update.json

# APK indirme testi
curl -I https://akagunduzweb.com/signage/downloads/omnex-player.apk
```

---

## 🔄 Güncelleme Akışı

```
1. Uygulama başlatılır (MainActivity)
   ↓
2. 5 saniye sonra UpdateManager.checkForUpdates() çağrılır
   ↓
3. update.json indirilir ve parse edilir
   ↓
4. versionCode > BuildConfig.VERSION_CODE ?
   ├─ EVET → Güncelleme dialog gösterilir
   └─ HAYIR → Sessizce atlanır
   ↓
5. Kullanıcı "Şimdi Güncelle" tıklarsa
   ↓
6. DownloadManager ile APK indirilir
   ↓
7. İndirme tamamlanınca kurulum ekranı açılır
   ↓
8. Kullanıcı "Yükle" tıklarsa güncelleme yapılır
```

---

## 📋 JavaScript API Kullanımı

Web player'dan (PWA) sürüm bilgisi alın:

```javascript
// Sürüm bilgisi al
if (window.AndroidBridge) {
    const version = AndroidBridge.getAppVersion(); // "2.1.0"
    const versionCode = AndroidBridge.getAppVersionCode(); // 2

    console.log(`Omnex Player v${version} (${versionCode})`);
}

// Hakkında dialog göster
if (window.AndroidBridge) {
    AndroidBridge.showAbout();
}

// Cihaz bilgisi (sürüm dahil)
if (window.AndroidBridge) {
    const info = JSON.parse(AndroidBridge.getDeviceInfo());
    console.log(info.appVersion); // "2.1.0"
}
```

---

## 🔧 Sürüm Yükseltme Prosedürü

Her yeni sürüm için:

1. **build.gradle güncelle:**
   ```gradle
   versionCode 3  // Bir artır
   versionName "2.2.0"  // Semantic versioning
   ```

2. **APK derle:**
   ```bash
   cd android-player/omnex-player-app
   ./gradlew.bat clean assembleDebug publishDebugApk
   ```

3. **update.json güncelle:**
   ```json
   {
     "versionCode": 3,
     "versionName": "2.2.0",
     ...
   }
   ```

4. **Sunucuya yükle:**
   ```bash
   scp public/downloads/omnex-player.apk user@server:/path/to/signage/downloads/
   scp update.json user@server:/path/to/signage/downloads/
   ```

---

## 🛡️ Güvenlik Notları

### İzinler (AndroidManifest.xml)
- `REQUEST_INSTALL_PACKAGES` - APK kurulumu için gerekli
- `WRITE_EXTERNAL_STORAGE` - APK indirilmesi için (Android 9 ve altı)
- `READ_EXTERNAL_STORAGE` - APK okunması için (Android 12 ve altı)

### Android 8.0+ Gereksinimi
Kullanıcı "Bilinmeyen kaynaklardan yükleme" iznini manuel olarak vermelidir:
- Ayarlar > Güvenlik > Bilinmeyen Kaynaklar > Omnex Player ✅

### FileProvider
APK kurulumu için güvenli URI kullanılır (`file_paths.xml`):
```xml
<external-path name="downloads" path="Download/" />
```

---

## 🐛 Sorun Giderme

### Güncelleme diyalogu çıkmıyor
- `update.json` URL'sine erişim kontrolü: `curl https://akagunduzweb.com/signage/downloads/update.json`
- Logcat kontrolü: `adb logcat | grep UpdateManager`
- versionCode değerlerini kontrol et (JSON > APK mevcut sürümü)

### APK indirilemedi
- Internet izni var mı? (AndroidManifest.xml)
- DownloadManager servisi çalışıyor mu?
- Depolama izni verildi mi?

### Kurulum başlamıyor
- Bilinmeyen kaynak izni verildi mi?
- FileProvider doğru yapılandırıldı mı?
- APK dosyası bozuk değil mi? (MD5 kontrol)

---

## 📊 Sürüm Geçmişi

| Sürüm | Kod | Tarih | Açıklama |
|-------|-----|-------|----------|
| 2.1.0 | 2 | 2024-02-14 | Hover efektleri, otomatik güncelleme, sürüm bilgisi |
| 2.0.0 | 1 | 2024-01-19 | İlk stabil sürüm |

---

## 📞 Destek

Sorunlarınız için:
- GitHub Issues: [Proje repo linki]
- Email: support@omnex.com
- Dokümantasyon: `android-player/BUILD.md`
