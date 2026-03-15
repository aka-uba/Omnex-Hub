# Android Player - Build & Deploy Sureci

Bu belge, Omnex Player Android uygulamasinin build, deploy ve guncelleme surecini tanimlar.

---

## Dizin Yapisi

```
android-player/omnex-player-app/     # Android Studio projesi
downloads/omnex-player.apk           # Ana APK (sunucu + git)
downloads/update.json                # OTA guncelleme manifest'i
public/downloads/omnex-player.apk    # Web uzerinden indirme kopya
```

---

## 1. Versiyon Yukseltme

`android-player/omnex-player-app/app/build.gradle` dosyasinda:

```groovy
defaultConfig {
    versionCode XX      // Her build'de 1 artir (integer)
    versionName "X.Y.Z" // Semantic versioning
}
```

**Kural:** Her APK degisikliginde `versionCode` mutlaka arttirilmali. OTA guncelleme bu degere bakar.

---

## 2. Build

### Gereksinimler
- Java 17+ (JAVA_HOME set edilmis olmali)
- Android SDK (ANDROID_HOME set edilmis olmali)
- Gradle wrapper projeye dahil (`gradlew.bat`)

### Build Komutu (Windows)

```bash
cd android-player/omnex-player-app
./gradlew assembleStandaloneDebug
```

### Build Ciktisi

```
app/build/outputs/apk/standalone/debug/app-standalone-debug.apk
```

---

## 3. APK Kopyalama

Build basariyla tamamlandiktan sonra:

```bash
# Ana downloads dizini (sunucu ve git icin)
cp app/build/outputs/apk/standalone/debug/app-standalone-debug.apk \
   ../../downloads/omnex-player.apk

# Public downloads dizini (web indirme icin)
cp app/build/outputs/apk/standalone/debug/app-standalone-debug.apk \
   ../../public/downloads/omnex-player.apk
```

---

## 4. update.json Guncelleme

`downloads/update.json` dosyasini guncelle:

```json
{
  "versionCode": 31,
  "versionName": "2.9.2",
  "downloadUrl": "https://hub.omnexcore.com/downloads/omnex-player.apk?v=31",
  "releaseNotes": "- Degisiklik ozeti buraya",
  "mandatory": false,
  "sha256": "<APK SHA256 HASH>"
}
```

### SHA256 Hesaplama

```bash
sha256sum downloads/omnex-player.apk | awk '{print $1}'
```

---

## 5. Git Commit & Push

```bash
# Sadece APK ve update.json stage et
git add downloads/omnex-player.apk downloads/update.json public/downloads/omnex-player.apk

# Commit
git commit -m "chore(player): vX.Y.Z - degisiklik ozeti"

# Push
git push origin main
```

---

## 6. Sunucu Deploy

### Otomatik (git pull ile)

```bash
ssh -i ~/.ssh/camlicayazilim_omnex -p 2299 camlicayazilim@185.124.84.34 \
  "cd /opt/omnex-hub && git pull origin main"
```

### Manuel (SCP ile - buyuk APK icin hizli)

```bash
# APK kopyala
scp -i ~/.ssh/camlicayazilim_omnex -P 2299 \
  downloads/omnex-player.apk \
  camlicayazilim@185.124.84.34:/opt/omnex-hub/downloads/

# update.json kopyala
scp -i ~/.ssh/camlicayazilim_omnex -P 2299 \
  downloads/update.json \
  camlicayazilim@185.124.84.34:/opt/omnex-hub/downloads/
```

### Dogrulama

```bash
ssh -i ~/.ssh/camlicayazilim_omnex -p 2299 camlicayazilim@185.124.84.34 \
  "cat /opt/omnex-hub/downloads/update.json"
```

---

## 7. OTA Guncelleme Akisi

1. Player uygulama acildiginda `/downloads/update.json` kontrol eder
2. `versionCode > mevcut` ise guncelleme bildirimi gosterir
3. `mandatory: true` ise kullanici atlayamaz
4. APK indirilir, `sha256` dogrulanir, kurulum baslatilir

---

## Hizli Referans (Tek Satirda)

```bash
# Tum surec
cd android-player/omnex-player-app && \
./gradlew assembleStandaloneDebug && \
cp app/build/outputs/apk/standalone/debug/app-standalone-debug.apk ../../downloads/omnex-player.apk && \
cp app/build/outputs/apk/standalone/debug/app-standalone-debug.apk ../../public/downloads/omnex-player.apk && \
cd ../.. && \
sha256sum downloads/omnex-player.apk
# -> update.json guncelle -> git add/commit/push -> sunucu pull
```

---

## Notlar

- `.gitignore`'da `android-player/` ve `*.apk` ignore edilir, ama `downloads/` ve `public/downloads/` ozel olarak dahil edilir
- Debug build imza icin `.android-env/.android/debug.keystore` kullanir
- Release build icin `keystore.properties` gerekir
- Sunucu: Ubuntu 24.04, SSH port 2299, key-based auth
- Sunucu path: `/opt/omnex-hub/downloads/`
