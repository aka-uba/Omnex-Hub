# Omnex Player - Hızlı Başvuru Kartı

## 🚨 Acil Sorun Giderme

### "Video Açılmıyor / Donuyor"

**Olası Nedenler:**
1. ❌ Hardware acceleration kapalı
2. ❌ Video format uyumsuz (H.265, yüksek bitrate)
3. ❌ Memory leak (HLS.js listeners)
4. ❌ WebView versiyon eski

**Hızlı Çözüm:**
```kotlin
// MainActivity.kt
webView?.setLayerType(View.LAYER_TYPE_HARDWARE, null)
```

```bash
# Server-side video transcode
ffmpeg -i input.mp4 -vcodec libx264 -profile:v baseline -level 3.0 output.mp4
```

---

### "iOS'ta İçerik Oynamıyor, Diğer Cihazlar da Kesiliyor"

**Kök Neden:**
iOS PWA background'a gidince heartbeat timeout → server tüm playlist'i yeniden assign ediyor

**Çözüm:**
```javascript
// player.js
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseHeartbeat();
    else { resumeHeartbeat(); syncPlaylist(); }
});
```

```php
// api/player/content.php - Grace period ekle
if ($now - $lastHeartbeat < 300) {
    return getLastKnownPlaylist($deviceId);  // 5 dk grace period
}
```

---

## 📊 Performans Metrikleri

| Metrik | Baseline | Faz 1 | Faz 2 | Faz 3 |
|--------|----------|-------|-------|-------|
| **Memory** | 800MB | 500MB | 300MB | <250MB |
| **CPU** | %90 | %60 | %40 | %30 |
| **Donma** | 5-10/saat | 2-3/saat | <1/saat | ~0 |
| **1080p** | Stutter | Stutter | Smooth | Smooth |
| **iOS Kesinti** | %100 | %0 | %0 | %0 |

---

## 🔧 Hızlı Debug Komutları

### Android Logcat (Cihazda)
```bash
adb logcat | grep -E "OmnexPlayer|Watchdog|WebView"
```

### Chrome DevTools Remote Debug
```
chrome://inspect
→ "Inspect" → Console
```

### Memory Snapshot
```bash
adb shell dumpsys meminfo com.omnex.player
```

### WebView Versiyon Kontrolü
```kotlin
val webViewPackageInfo = WebView.getCurrentWebViewPackage()
Log.i("WebView", "Version: ${webViewPackageInfo?.versionName}")
```

---

## 📁 Kritik Dosyalar

| Dosya | Rol | Sorun Alanı |
|-------|-----|-------------|
| `MainActivity.kt` | WebView container | Hardware acceleration |
| `player.js` | Player logic | Memory leaks, HLS |
| `sw.js` | Service Worker | Cache overflow |
| `api/player/content.php` | Playlist delivery | iOS cascade |

---

## 🎯 Öncelik Matrisi

| P0 (Zorunlu) | P1 (Önerilir) | P2 (Opsiyonel) |
|--------------|---------------|----------------|
| Hardware acceleration | ExoPlayer overlay | Store-and-forward |
| Memory leak fixes | HLS.js fallback | Policy-driven DL |
| Watchdog | Telemetry | Advanced analytics |
| Video format std | Device profiling | - |
| iOS playlist fix | - | - |

---

## 🔗 Hızlı Linkler

- **Detaylı Analiz:** [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md)
- **Uygulama Planı:** [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- **Build Rehberi:** [BUILD.md](BUILD.md)
- **Güncelleme Sistemi:** [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md)

---

**Güncel Sürüm:** 2.1.0
**Son Güncelleme:** 2024-02-14
