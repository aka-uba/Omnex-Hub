# Stream Mode - Detayli Dokumantasyon

**Versiyon:** 1.0
**Tarih:** 2026-02-23
**Durum:** Aktif (Passthrough + HLS Adaptive)

---

## 1. Genel Bakis

Stream Mode, Omnex Display Hub'a ucuncu bir cihaz calisma modu olarak eklenmistir:

| Mod | Aciklama | Cihaz Gereksinimleri |
|-----|----------|---------------------|
| **APK** | Android APK uzerinden cihaz kontrolu | Android cihaz |
| **Browser/PWA** | Tarayici veya PWA ile icerik gosterimi | Modern tarayici |
| **Stream (Yeni)** | VLC/IPTV uyumlu HLS stream yayini | HLS uyumlu player (VLC, ffplay, IPTV kutulari) |

Stream Mode, cihaza fiziksel erisim veya yazilim kurulumu gerektirmeden, sadece bir URL ile icerik dagitimi saglar.

---

## 2. Mimari

```
                                    +------------------+
                                    |  Admin Paneli    |
                                    |  (Cihaz & Playlist) |
                                    +--------+---------+
                                             |
                                     API (JWT Auth)
                                             |
+----------------+              +------------+------------+
|  VLC / IPTV    |  -- HTTP --> |  Stream API (Token)     |
|  Player        |              |  /api/stream/{token}/   |
+----------------+              +------------+------------+
                                             |
                               +-------------+-------------+
                               |                           |
                    +----------+----------+    +-----------+-----------+
                    |  Passthrough Mode   |    |   HLS Adaptive Mode   |
                    |  (Orijinal MP4)     |    |   (Transcode .ts)     |
                    +---------------------+    +-----------------------+
```

### Iki Calisma Modu

**Passthrough Mode (Varsayilan):**
- Transcode gerektirmez, aninda calisir
- Orijinal video dosyalarini M3U playlist olarak sunar
- VLC dogrudan MP4 dosyalarini oynatir
- `#EXTVLCOPT:no-audio` ile playlist'teki ses ayarlari korunur

**HLS Adaptive Mode (Ileri):**
- FFmpeg ile video transcode gerektirir
- Coklu kalite profili (360p/540p/720p/1080p)
- Adaptive bitrate switching
- `.ts` segment dosyalari ile akici oynatma

---

## 3. Veritabani Yapisi

### 3.1 Devices Tablosu (Yeni Kolonlar)

```sql
ALTER TABLE devices ADD COLUMN stream_mode INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN stream_token TEXT;
ALTER TABLE devices ADD COLUMN device_profile TEXT;       -- JSON: {"max_res":"1280x720","max_bitrate":3000}
ALTER TABLE devices ADD COLUMN last_stream_request_at TEXT;
```

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| `stream_mode` | INTEGER | 0=Pasif, 1=Aktif |
| `stream_token` | TEXT | Benzersiz erisim token'i (64 hex karakter) |
| `device_profile` | TEXT | JSON - Cihaz kalite profili |
| `last_stream_request_at` | TEXT | Son stream istegi zamani |

### 3.2 Transcode Queue (transcode_queue)

```sql
CREATE TABLE transcode_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    profile TEXT NOT NULL DEFAULT '720p',
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/processing/completed/failed
    priority INTEGER DEFAULT 0,
    progress REAL DEFAULT 0,
    output_path TEXT,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### 3.3 Transcode Variants (transcode_variants)

```sql
CREATE TABLE transcode_variants (
    id TEXT PRIMARY KEY,
    media_id TEXT NOT NULL,
    profile TEXT NOT NULL,
    output_path TEXT NOT NULL,
    playlist_path TEXT,
    segment_count INTEGER DEFAULT 0,
    total_duration REAL DEFAULT 0,
    bitrate INTEGER,
    resolution TEXT,
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ready',
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.4 Stream Access Logs (stream_access_logs)

```sql
CREATE TABLE stream_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    stream_token TEXT,
    request_type TEXT,           -- master/master_passthrough/variant/segment/heartbeat
    request_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    response_status INTEGER,
    bytes_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. Yapilandirma (config.php)

```php
// HLS Stream Sabitleri
define('STREAM_SEGMENT_DURATION', 6);           // Segment suresi (saniye)
define('STREAM_DEFAULT_PROFILE', '720p');        // Varsayilan profil
define('STREAM_PLAYLIST_TTL', 60);              // Playlist cache suresi
define('STREAM_TOKEN_LENGTH', 32);              // Token uzunlugu (byte -> 64 hex char)
define('STREAM_STORAGE_PATH', STORAGE_PATH . '/streams');
define('STREAM_MAX_CONCURRENT_TRANSCODE', 2);   // Paralel transcode limiti

// FFmpeg
define('FFMPEG_PATH', getenv('FFMPEG_PATH') ?: 'ffmpeg');
define('FFMPEG_PROBE_PATH', getenv('FFPROBE_PATH') ?: 'ffprobe');
```

---

## 5. API Endpoint'leri

### 5.1 Stream API (Token Auth - Public)

Bu endpoint'ler JWT gerektirmez, `stream_token` ile dogrulanir.

#### `GET /api/stream/{token}/master.m3u8`

Ana playlist. VLC/IPTV player bu URL'yi acar.

**Passthrough Mode Ciktisi (transcode yoksa):**
```
#EXTM3U
#EXTINF:5,
#EXTVLCOPT:no-audio
http://host/storage/companies/.../video1.mp4
#EXTINF:10,
http://host/storage/public/samples/Video/video2.mp4
```

- Video isimleri gizlenir (bos title)
- Playlist'teki `muted` ayari `#EXTVLCOPT:no-audio` ile uygulanir
- `muted=false` olan videoların sesi acik kalir

**HLS Adaptive Mode Ciktisi (transcode varsa):**
```
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
/api/stream/{token}/variant/720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=960x540,NAME="540p"
/api/stream/{token}/variant/540p/playlist.m3u8
```

**Playlist Kaynagi Oncelik Sirasi:**
1. `device_content_assignments` (dogrudan atanmis playlist)
2. `schedules` + `schedule_devices` (zamanlama bazli)
3. `devices.current_playlist_id` (fallback)

**Hata Kodlari:**
| HTTP | Aciklama |
|------|----------|
| 200 | Basarili - M3U/M3U8 icerik |
| 400 | Token eksik |
| 403 | Gecersiz veya pasif token |
| 404 | Playlist yok / Video bulunamadi |

---

#### `GET /api/stream/{token}/variant/{profile}/playlist.m3u8`

Belirli kalite profilinin HLS variant playlist'i. Sadece HLS Adaptive modda kullanilir.

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0

#EXTINF:6.000,
/api/stream/{token}/segment/{mediaId}/720p/segment_000.ts
#EXTINF:6.000,
/api/stream/{token}/segment/{mediaId}/720p/segment_001.ts

#EXT-X-DISCONTINUITY

#EXTINF:6.000,
/api/stream/{token}/segment/{mediaId2}/720p/segment_000.ts

#EXT-X-ENDLIST
```

---

#### `GET /api/stream/{token}/segment/{mediaId}/{profile}/{filename}`

Tek bir HLS `.ts` segment dosyasi. Agresif cache header'lari:
```
Cache-Control: public, max-age=86400, immutable
```

---

#### `GET /api/stream/{token}/heartbeat`

Opsiyonel heartbeat. Player durumunu raporlar, cihaz `last_seen` gunceller.

**Response:**
```json
{
    "status": "ok",
    "server_time": "2026-02-23T12:00:00Z",
    "device_id": "...",
    "next_heartbeat": 30
}
```

---

### 5.2 Stream Yonetim API (JWT Auth - Admin Panel)

#### `GET /api/stream/{deviceId}/info`

Stream cihazinin detayli metriklerini dondurur. Admin panelden cagirilir.

**Response:**
```json
{
    "device": { "id": "...", "name": "...", "status": "online" },
    "stream": {
        "status": "online",
        "last_request_at": "2026-02-23T12:00:00Z",
        "seconds_since_last": 15,
        "total_requests_1h": 245,
        "unique_ips_1h": 1,
        "master_requests": 5,
        "variant_requests": 10,
        "segment_requests": 230,
        "estimated_bandwidth_mbps": 2.5,
        "avg_segments_per_min": 12.5
    },
    "playlist": { "id": "...", "name": "...", "video_count": 16 },
    "transcode": { "total_variants": 0, "ready_variants": 0 }
}
```

**Stream Durum Hesaplama:**
| Durum | Kosul |
|-------|-------|
| `online` | Son istek < 60 saniye |
| `weak` | Son istek 60-300 saniye |
| `offline` | Son istek > 300 saniye veya hic istek yok |

---

### 5.3 Transcode API (JWT Auth)

#### `GET /api/transcode`

Transcode kuyrugunu listeler. Sayfalama ve filtreleme destekli.

**Query Params:** `page`, `per_page`, `status`, `media_id`

---

#### `POST /api/transcode`

Yeni transcode isi olusturur.

**Body:**
```json
{
    "media_id": "uuid",
    "profile": "720p",
    "priority": 5
}
```

---

#### `GET /api/transcode/{id}/status`

Tek bir transcode isinin durumunu dondurur (progress, error_message, output_path).

---

## 6. Cihaz Tipi Mapping

SQLite CHECK constraint nedeniyle `stream_player` tipi DB'de `android_tv` olarak saklanir:

```
Frontend: stream_player  ->  DB: type=android_tv, model=stream_player, stream_mode=1
```

| Katman | type | model | stream_mode |
|--------|------|-------|-------------|
| Frontend (secim) | `stream_player` | - | - |
| API Request | `stream_player` | `stream_player` | `1` |
| DB (devices) | `android_tv` | `stream_player` | `1` |
| API Response | `stream_player` | `stream_player` | `1` |

**Cihaz Olusturma:**
- Frontend `stream_player` secildiginde otomatik olarak:
  - `type` -> `android_tv` (DB)
  - `model` -> `stream_player`
  - `stream_mode` -> `1`
  - `stream_token` -> otomatik uretilir (64 hex karakter)

**Mevcut Cihazi Stream'e Cevirme:**
- Duzenleme modalindan tip `Stream (VLC/IPTV)` secildiginde:
  - `stream_mode=1` ve `model=stream_player` gonderilir
  - Backend token yoksa otomatik olusturur

---

## 7. Frontend Bilesenleri

### 7.1 DeviceList.js Degisiklikleri

- **Tip secenegi:** `<option value="stream_player">Stream (VLC/IPTV)</option>`
- **Badge:** Mor renk `.badge-stream` ile "Stream" etiketi
- **Ikon:** `ti-broadcast`
- **Aksiyon:** "URL Kopyala" butonu (`copy-stream-url`) - token varsa gorunur
- **IP Validasyonu:** IPv6 (`::1`) ve `localhost` destegi eklendi

### 7.2 DeviceDetail.js Degisiklikleri

- **Stream Mode Karti:** `renderStreamModeCard()` - Durum, URL, profil bilgisi
- **Stream Badge:** Hero alaninda mor "Stream" badge'i
- **Durum Gostergesi:** online (yesil pulse), weak (sari), offline (gri)
- **VLC Ipucu:** Stream URL'nin nasil kullanilacagi bilgisi

### 7.3 devices.css Degisiklikleri

```css
.badge-stream           /* Mor tema: #7c3aed */
.stream-mode-card       /* Kart header border */
.stream-status-indicator /* online/weak/offline varyantlari */
.stream-status-dot      /* Pulse animasyonu (online) */
.stream-url-box         /* URL gosterim kutusu */
.stream-vlc-hint        /* VLC kullanim ipucu */
```

---

## 8. HLS Transcoder (services/HlsTranscoder.php)

### Kalite Profilleri

```php
const PROFILES = [
    '360p'  => ['width' => 640,  'height' => 360,  'bitrate' => 600,  'audio_bitrate' => 64],
    '540p'  => ['width' => 960,  'height' => 540,  'bitrate' => 1200, 'audio_bitrate' => 96],
    '720p'  => ['width' => 1280, 'height' => 720,  'bitrate' => 3000, 'audio_bitrate' => 128],
    '1080p' => ['width' => 1920, 'height' => 1080, 'bitrate' => 6000, 'audio_bitrate' => 192],
];
```

### Temel Metodlar

| Metod | Aciklama |
|-------|----------|
| `detectFfmpeg()` | FFmpeg kurulumunu kontrol eder |
| `getVideoInfo($path)` | ffprobe ile video bilgisi (sure, cozunurluk, bitrate, codec) |
| `transcode($inputPath, $outputDir, $profile)` | Tek profil transcode |
| `generateMasterPlaylist($outputDir, $profiles)` | Adaptive master.m3u8 olusturur |
| `cleanup($outputDir)` | Eski segment dosyalarini temizler |

### FFmpeg Komut Ornegi

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset medium -b:v 3000k -maxrate 3600k -bufsize 6000k \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -c:a aac -b:a 128k -ar 44100 -ac 2 \
  -hls_time 6 -hls_list_size 0 -hls_segment_filename "segment_%03d.ts" \
  -f hls playlist.m3u8
```

---

## 9. Transcode Queue (services/TranscodeQueueService.php)

### Kuyruk Akisi

```
enqueue() -> dequeue() -> updateProgress() -> markCompleted() / markFailed()
    |                                              |
    v                                              v
 transcode_queue (pending)              transcode_variants (ready)
```

### Temel Metodlar

| Metod | Aciklama |
|-------|----------|
| `enqueue($companyId, $mediaId, $profile, $priority)` | Is olusturur |
| `dequeue()` | Siradaki isi atomik olarak alir (race condition guvenli) |
| `updateProgress($jobId, $progress)` | Ilerleme gunceller |
| `markCompleted($jobId, $result)` | Is tamamlandi, variant kaydeder |
| `markFailed($jobId, $error)` | Hata kaydeder, retry sayacini arttirir |
| `getReadyVariants($mediaId)` | Medya icin hazir variant'lari dondurur |
| `getQueueStats()` | Kuyruk istatistikleri |

### Retry Mekanizmasi

- Maksimum 3 deneme (`max_attempts`)
- Basarisiz islerde sonraki deneme icin bekleme suresi artar
- `attempts` kolonu her denemede increment edilir

---

## 10. Transcode Worker (workers/TranscodeWorker.php)

### CLI Kullanimi

```bash
# Daemon modu (surekli calisir)
php workers/TranscodeWorker.php --daemon

# Tek is isle ve cik
php workers/TranscodeWorker.php --once

# Kuyruk durumunu goster
php workers/TranscodeWorker.php --status
```

### Calisma Mantigi

1. `dequeue()` ile siradaki isi al
2. FFmpeg ile transcode baslat
3. Ilerlemeyi periyodik guncelle
4. Tamamlaninca `markCompleted()` ile variant kaydi olustur
5. Hata durumunda `markFailed()` ile kaydet
6. Sonraki ise gec

### Paralel Islem Limiti

`STREAM_MAX_CONCURRENT_TRANSCODE = 2` - Ayni anda en fazla 2 transcode isi islenir.

---

## 11. Kullanim Rehberi

### 11.1 Stream Cihazi Olusturma

1. **Cihazlar** sayfasina git
2. **"+ Cihaz Ekle"** butonuna tikla
3. Tip olarak **"Stream (VLC/IPTV)"** sec
4. Cihaz adini gir ve kaydet
5. Otomatik olarak `stream_token` olusturulur

### 11.2 Mevcut Cihazi Stream'e Cevirme

1. Cihaz listesinde **"Duzenle"** ikonuna tikla
2. Tip alanini **"Stream (VLC/IPTV)"** olarak degistir
3. Kaydet - Token otomatik olusturulur

### 11.3 VLC'de Oynatma

1. Cihaz listesinde **"URL Kopyala"** butonuna tikla veya cihaz detayinda URL'yi kopyala
2. VLC'yi ac: **Medya > Ag Akisi Ac** (Ctrl+N)
3. URL'yi yapistir:
   ```
   http://sunucu-ip/market-etiket-sistemi/api/stream/{token}/master.m3u8
   ```
4. "Oynat" butonuna tikla

### 11.4 Playlist Atama

Stream cihazi normal signage cihazi gibi playlist alir:
1. **Signage > Playlist'ler** sayfasindan playlist olustur/sec
2. Playlist detayinda **"Cihaza Ata"** ile stream cihazini sec
3. VLC otomatik olarak yeni playlist'i alir (sonraki istekte)

### 11.5 Ses Kontrolu

- Playlist detayinda her video icin **ses ikonu** ile mute/unmute yap
- Ses kapali videolar M3U'da `#EXTVLCOPT:no-audio` ile isaretlenir
- VLC bu direktifi otomatik tanir ve sesin acik/kapali olmasini saglar

---

## 12. Guvenlik

### Token Guvenligi

- Her cihaz icin benzersiz 64 karakter hex token
- Token sadece `stream_mode=1` olan cihazlarda gecerli
- Token URL'de acik tasindigi icin HTTPS kullanimi onerilir (production)

### Erisim Loglama

Her istek `stream_access_logs` tablosuna kaydedilir:
- IP adresi
- User agent
- Istek tipi (master/variant/segment/heartbeat)
- HTTP durum kodu
- Gonderilen byte miktari

### Rate Limiting

Stream endpoint'leri `ApiGuardMiddleware` kapsaminda:
- default: 300 req/60sn (segment istekleri icin yeterli)

---

## 13. Performans

### Cache Stratejisi

| Endpoint | Cache | Aciklama |
|----------|-------|----------|
| master.m3u8 | no-cache | Her zaman guncel playlist |
| variant playlist | no-cache | Guncel segment listesi |
| .ts segment | 86400s, immutable | Degismez, agresif cache |

### Cihaz Durum Guncelleme

- `last_stream_request_at` her master istegiyle guncellenir
- Segment isteklerinde 10 saniye throttle (her istekte guncelleme yapilmaz)
- Heartbeat endpoint ile ek durum bilgisi

---

## 14. Dosya Yapisi

```
api/
├── stream/
│   ├── master.php          # Ana M3U/M3U8 playlist endpoint
│   ├── variant.php         # HLS variant playlist (profil bazli)
│   ├── segment.php         # .ts segment dosya sunucu
│   ├── heartbeat.php       # Opsiyonel heartbeat
│   └── info.php            # Admin metrik endpoint (JWT auth)
├── transcode/
│   ├── index.php           # Kuyruk listesi
│   ├── enqueue.php         # Yeni transcode isi
│   └── status.php          # Is durumu
services/
├── HlsTranscoder.php       # FFmpeg wrapper
└── TranscodeQueueService.php # Kuyruk yonetimi
workers/
└── TranscodeWorker.php      # CLI transcode worker
database/migrations/
└── 098_stream_mode_support.sql
storage/
└── streams/                 # HLS segment cikti dizini
    └── {company_id}/
        └── {media_id}/
            └── {profile}/
                ├── playlist.m3u8
                ├── segment_000.ts
                ├── segment_001.ts
                └── ...
```

---

## 15. i18n Anahtarlari

Ceviri dosyalari: `locales/{lang}/pages/devices.json`

```json
{
    "stream": {
        "title": "Stream Modu",
        "subtitle": "HLS stream ayarlari ve durumu",
        "enabled": "Stream Modu Aktif",
        "disabled": "Stream Modu Pasif",
        "url": "Stream URL",
        "copyUrl": "URL'yi Kopyala",
        "copied": "URL kopyalandi",
        "urlHint": "Bu URL'yi VLC, IPTV veya herhangi bir HLS uyumlu player'da acin",
        "profile": "Cihaz Profili",
        "status": "Stream Durumu",
        "statusOnline": "Yayin Aktif",
        "statusWeak": "Zayif Baglanti",
        "statusOffline": "Cevrimdisi",
        "mode": "Cihaz Modu",
        "modeApk": "APK",
        "modeBrowser": "Tarayici/PWA",
        "modeStream": "Stream (VLC/IPTV)",
        "tokenGenerated": "Stream token olusturuldu",
        "regenerateToken": "Token Yenile"
    }
}
```

---

## 16. Bilinen Sinirlamalar

| Sinir | Aciklama | Gelecek Cozum |
|-------|----------|---------------|
| Passthrough'da adaptive yok | Orijinal video kalitesi degistirilmez | FFmpeg transcode |
| VLC-only ses kontrolu | `#EXTVLCOPT` sadece VLC'de calisir | HLS transcode ile cozulur |
| Tek playlist | Ayni anda tek aktif playlist | Zamanlama sistemi ile destekleniyor |
| Token URL'de acik | HTTPS olmadan guvenli degil | Production'da HTTPS zorunlu |
| `localhost` IP sorunlari | `::1` ve `localhost` icin ozel handling gerekti | IPv4/IPv6 dual-stack destek eklendi |

---

## 17. Sorun Giderme

| Sorun | Cozum |
|-------|-------|
| VLC "MRL acilamadi" | Token'in gecerli oldugundan emin ol, URL'yi tarayicida test et |
| 403 Invalid token | Cihazda `stream_mode=1` ve `stream_token` dolu mu kontrol et |
| 404 No playlist | Cihaza aktif playlist atanmis mi kontrol et |
| 404 No video files | Playlist'te video turunde medya var mi kontrol et |
| Ses kapatilmiyor | `#EXTVLCOPT` sadece VLC'de calisir, diger player'larda etki etmez |
| IP validasyon hatasi | `localhost` ve `::1` (IPv6) artik destekleniyor |
| i18n key gorunuyor | `stream.modeStream` dogru key, `stream.mode.stream` YANLIS |
