# Player & Streaming Mimarisi - Omnex Display Hub

Bu dokuman, projenin dijital tabela (signage) player yapisi, HLS streaming duzeni, FFmpeg transcode is akisi, istemci profilleri ve tum yayin akisini detayli olarak aciklar.

Son guncelleme: 2026-03-13

---

## Icindekiler

1. [Genel Bakis](#1-genel-bakis)
2. [PWA Player Yapisi](#2-pwa-player-yapisi)
3. [Cihaz Kayit Akisi](#3-cihaz-kayit-akisi)
4. [Player API Endpoint'leri](#4-player-api-endpointleri)
5. [Playlist ve Icerik Yonetimi](#5-playlist-ve-icerik-yonetimi)
6. [HLS Streaming Mimarisi](#6-hls-streaming-mimarisi)
7. [FFmpeg Transcode Sistemi](#7-ffmpeg-transcode-sistemi)
8. [TranscodeWorker (Arka Plan Isci)](#8-transcodeworker-arka-plan-isci)
9. [Stream API Endpoint'leri](#9-stream-api-endpointleri)
10. [Cihaz Profili ve Adaptif Kalite](#10-cihaz-profili-ve-adaptif-kalite)
11. [Service Worker ve Offline Destek](#11-service-worker-ve-offline-destek)
12. [Zamanlama (Schedule) Sistemi](#12-zamanlama-schedule-sistemi)
13. [Veritabani Tablolari](#13-veritabani-tablolari)
14. [Yapilandirma Sabitleri](#14-yapilandirma-sabitleri)
15. [Dosya ve Dizin Haritalari](#15-dosya-ve-dizin-haritalari)
16. [Is Akisi Diyagramlari](#16-is-akisi-diyagramlari)
17. [Bilinen Sinirlamalar](#17-bilinen-sinirlamalar)

---

## 1. Genel Bakis

Omnex Display Hub signage sistemi iki ana istemci tipini destekler:

| Istemci | Protokol | Kullanim |
|---------|----------|----------|
| **PWA Player** | REST API + IndexedDB | TV, tablet, web tarayici uzerinde tam oynatma |
| **VLC / IPTV** | HLS (M3U8 + TS segment) | IPTV uygulamalari, VLC, medya kutulari |

**Ust Duzey Akis:**

```
Admin Panel                           Sunucu                               Istemci
-----------                           ------                               -------
Playlist olustur  ─────────────>  playlists tablosu
Cihaza ata        ─────────────>  device_content_assignments
Video yukle       ─────────────>  media tablosu + dosya sistemi
                                       │
                                       ▼
                                  TranscodeWorker         (FFmpeg ile HLS segmentleri olusturur)
                                       │
                                       ▼
                                  transcode_variants      (profil bazli HLS sonuclari)
                                       │
                 ┌─────────────────────┼────────────────────────┐
                 ▼                     ▼                        ▼
           PWA Player            VLC/IPTV Player          Web Tarayici
         POST /api/player/init   GET /api/stream/TOKEN/    HLS.js ile
         GET /api/player/sync      master.m3u8              M3U8 oynatma
```

---

## 2. PWA Player Yapisi

### Dosya Yapisi

```
public/player/
├── index.html               # PWA shell (4 ekran: loading, registration, player, error)
├── manifest.json            # PWA manifest (standalone, any orientation)
├── sw.js                    # Service Worker v1.2.4
└── assets/
    ├── css/
    │   └── player.css       # Responsive player stilleri (Android TV/iOS uyumlulugu)
    └── js/
        ├── player.js        # Ana OmnexPlayer sinifi (~2000+ satir)
        ├── api.js           # HTTP istemcisi (X-DEVICE-TOKEN header)
        └── storage.js       # IndexedDB wrapper (offline cache)
```

### OmnexPlayer Sinifi

**Durum Makinesi:**
```
loading ──> registration ──> playing ──> error
               ↑                           │
               └───────────────────────────┘
```

**Yapilandirma (URL query veya PLAYER_CONFIG):**

| Parametre | Varsayilan | Aciklama |
|-----------|------------|----------|
| `heartbeat` / `heartbeatSeconds` | 5 sn | Cihaz canlilik sinyali araligi |
| `sync` / `syncSeconds` | 60 sn | Icerik senkronizasyon araligi |
| `verify_ms` / `verifyMs` | 3000 ms | Kayit onay polling araligi |
| `sw` | true | Service Worker aktif/pasif |
| `precache` | true | Medya on-bellekleme |
| `perf_profile` | 'default' | Performans profili: `default`, `balanced`, `legacy`, `constrained` |
| `apk_url` | - | APK indirme URL'si |

**Icerik Turleri:**

| Tur | DOM Elemani | Ozellikler |
|-----|-------------|------------|
| `image` | `<img>` | Sureli gosterim, gecis efekti |
| `video` | `<video>` (cift slot) | HLS.js destegi, autoplay+muted, dongu |
| `template` | `<img>` veya `<div>` | Render edilmis sablon gorseli |
| `html` | `<iframe>` | Harici URL, sandbox korumasiyla |

**Video Gecis Teknigi (Dual Video Slot):**
```
video-content (birincil)  <──>  video-content-alt (ikincil)
        │                               │
        └───── _activeVideoSlot ────────┘
              ('primary' veya 'alt')
```
- Video → video gecisinde her iki `<video>` elemani kullanilir
- Yeni video ikincil slot'a yuklenir, hazir olunca crossfade yapilir
- Siyah ekran gorulmez

### Storage.js (IndexedDB)

**Veritabani: `omnex-player-db` v1**

| Store | Key | Amac |
|-------|-----|------|
| `config` | key | Cihaz ayarlari, token bilgileri |
| `content` | id | Onbelleklenmis playlist ve sablonlar |
| `media` | id | Medya metadata (dosyalar SW cache'de) |
| `logs` | autoincrement | Oynatma ve hata loglari |

**iOS PWA Ozel Durum:**
- Fingerprint `localStorage`'da saklanir (tarayici ve PWA arasi paylasim)
- Cihaz config hem IndexedDB hem localStorage'a yazilir
- Okumada once IndexedDB, fallback localStorage

### Api.js (HTTP Istemcisi)

**Base URL Otomatik Tespiti:**
```
Player URL: http://example.com/market-etiket-sistemi/player/
API Base:   http://example.com/market-etiket-sistemi/api
```

**Header'lar:**
- `X-DEVICE-TOKEN`: JWT cihaz token'i (tum korunmali endpoint'ler)
- `Content-Type: application/json`

**401 Unauthorized Isleme:** Token temizle → sayfayi yenile → kayit akisina don

---

## 3. Cihaz Kayit Akisi

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Player Acilir  │     │   Admin Panel     │     │   Sunucu         │
│   (TV/Tablet)    │     │   (Tarayici)      │     │   (PHP API)      │
└───────┬──────────┘     └───────┬──────────┘     └───────┬──────────┘
        │                        │                        │
        │  POST /api/player/register                      │
        │  {fingerprint, screen, os, brand, model}        │
        │ ──────────────────────────────────────────────> │
        │                        │                        │
        │  {syncCode: "123456", expiresIn: 900}           │
        │ <────────────────────────────────────────────── │
        │                        │                        │
        │  Ekranda 6 haneli      │                        │
        │  sync code gosterilir  │                        │
        │                        │                        │
        │  GET /api/player/verify?syncCode=123456         │
        │  (3 saniyede bir polling)                       │
        │ ──────────────────────────────────────────────> │
        │                        │                        │
        │  {status: "pending"}   │                        │
        │ <────────────────────────────────────────────── │
        │                        │                        │
        │                        │  Admin cihazi onaylar  │
        │                        │  POST /api/devices/:id/approve
        │                        │ ─────────────────────> │
        │                        │                        │
        │                        │  devices tablosuna     │
        │                        │  kayit olusturulur     │
        │                        │  JWT token uretilir    │
        │                        │                        │
        │  GET /api/player/verify?syncCode=123456         │
        │ ──────────────────────────────────────────────> │
        │                        │                        │
        │  {status: "approved", token: "eyJ...",          │
        │   deviceId: "uuid"}                             │
        │ <────────────────────────────────────────────── │
        │                        │                        │
        │  Token kaydedilir      │                        │
        │  (IndexedDB + LS)      │                        │
        │                        │                        │
        │  POST /api/player/init                          │
        │ ──────────────────────────────────────────────> │
        │                        │                        │
        │  {playlist, template, device, serverTime}       │
        │ <────────────────────────────────────────────── │
        │                        │                        │
        │  Oynatma baslar ▶      │                        │
```

**Kayit Istegi:**

```json
{
    "fingerprint": "a1b2c3d4...32char_hex",
    "userAgent": "Mozilla/5.0...",
    "screen": "1920x1080",
    "os": "Android",
    "osVersion": "13.0",
    "browser": "Chrome",
    "browserVersion": "120.0",
    "deviceType": "android_tv",
    "brand": "Samsung",
    "model": "TV55",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "cores": 4,
    "memory": 2.0,
    "touchSupport": false,
    "connectionType": "wifi",
    "companyId": "uuid",
    "companySlug": "company-slug"
}
```

**Veritabani Akisi:**
- `device_sync_requests` tablosuna INSERT (status='pending', 15dk gecerlilik)
- Admin onayinda `devices` tablosuna INSERT + `device_tokens`'a JWT
- Sync code: 6 haneli rastgele sayi (cakisma kontrolu, 10 deneme)

---

## 4. Player API Endpoint'leri

Tumu `DeviceAuthMiddleware` ile korunur (`X-DEVICE-TOKEN` header).

### POST /api/player/init

Cihaz baslatma: aktif playlist, sablon, ayarlar doner.

**Playlist Oncelik Sirasi:**
1. `device_content_assignments` (dogrudan atama, en yuksek oncelik)
2. `schedules` + `schedule_devices` (zamanlama bazli)
3. `devices.current_playlist_id` (fallback)

**Yanit:**
```json
{
    "status": "ok",
    "device": {
        "id": "uuid", "name": "TV-01", "type": "android_tv",
        "orientation": "landscape", "screenWidth": 1920, "screenHeight": 1080
    },
    "playlist": {
        "id": "uuid", "name": "Ana Yayin",
        "transition": "fade", "transition_duration": 500,
        "default_duration": 10,
        "items": [
            {
                "id": "uuid", "type": "video", "name": "Tanitim",
                "url": "https://.../promo.mp4",
                "stream_profile": "720p",
                "duration": 30, "muted": 1, "loop": 1, "order": 0
            },
            {
                "id": "uuid", "type": "image", "name": "Banner",
                "url": "https://.../banner.jpg",
                "duration": 10, "loop": 0, "order": 1
            }
        ]
    },
    "rotation": 45,
    "serverTime": "2026-03-13 10:00:00",
    "timezone": "Europe/Istanbul"
}
```

### POST /api/player/sync

Degisiklik kontrolu. `since` parametresi ile son senkronizasyondan beri degisen bilesenler doner.

```json
{
    "hasUpdate": true,
    "changes": {
        "schedule": true, "assignment": true, "playlist": true,
        "template": false, "device": false, "commands": true
    },
    "playlist": { "...guncellenmis playlist..." },
    "commands": [
        { "id": "uuid", "command": "reload", "parameters": null }
    ]
}
```

### POST /api/player/heartbeat

Cihaz durum raporu + komut alimi.

**Istek:**
```json
{
    "status": "playing",
    "currentItem": { "id": "uuid", "name": "Banner", "index": 1 },
    "battery": 85, "memory": 1500, "cpu": 25,
    "temperature": 42.5, "uptime": 3600,
    "playlist": {
        "playlist_id": "uuid", "current_index": 1,
        "total_items": 5, "last_sync": "2026-03-13 10:00:00"
    },
    "completedCommands": [
        { "id": "uuid", "result": { "status": "success" } }
    ]
}
```

**Yanit:**
```json
{
    "status": "ok",
    "commands": [ { "id": "uuid", "command": "reload" } ],
    "nextHeartbeat": 30,
    "shouldSync": true
}
```

### POST /api/player/command-ack

Komut tamamlama bildirimi.

### GET /api/player/verify

Kayit dogrulama (sync code polling).

---

## 5. Playlist ve Icerik Yonetimi

### Playlist Yapisi

```
playlists tablosu
├── id (uuid)
├── company_id
├── name, description
├── status: 'active' | 'draft' | 'archived'
├── orientation: 'landscape' | 'portrait'
├── layout_type: 'full'
├── transition: 'fade' | 'slide' | 'dissolve' | 'wipe' | 'none'
├── transition_duration: 500 (ms)
├── default_duration: 10 (sn)
├── template_id (bagli sablon, opsiyonel)
└── items: JSON TEXT (playlist item dizisi)
```

### Playlist Item Tipleri

| Tip | Kaynak | Aciklama |
|-----|--------|----------|
| `video` | `media_id` | Video dosyasi, HLS transcode ile sunulur |
| `image` | `media_id` | Gorsel dosyasi, dogrudan URL ile sunulur |
| `template` | `template_id` | Sablon render sonucu (base64 gorsel) |
| `html` | `url` | Web sayfasi (iframe ile gosterim) |
| `stream` | `url` | Harici stream URL (HLS/RTSP) |

### Item JSON Ornegi

```json
{
    "id": "uuid",
    "type": "video",
    "media_id": "uuid",
    "name": "Tanitim Videosu",
    "url": "https://example.com/storage/companies/uuid/media/promo.mp4",
    "stream_profile": "720p",
    "duration": 30,
    "loop": 1,
    "muted": 1,
    "order": 0,
    "transition": "fade",
    "transition_duration": 500
}
```

### Icerik Atama Yontemleri

| Yontem | Tablo | Oncelik | Aciklama |
|--------|-------|---------|----------|
| Dogrudan Atama | `device_content_assignments` | 1 (en yuksek) | Admin cihaza playlist atar |
| Zamanlama | `schedules` + `schedule_devices` | 2 | Zaman dilimi bazli otomatik |
| Varsayilan | `devices.current_playlist_id` | 3 (en dusuk) | Fallback playlist |

---

## 6. HLS Streaming Mimarisi

### Genel Akis

```
Video Upload                    Transcode Worker                 Istemci
────────────                    ────────────────                 ───────
media tablosu ──> transcode_queue ──> FFmpeg ──> HLS Segment'leri
                   (pending)          │              │
                                      ▼              ▼
                               transcode_variants    storage/streams/
                               (profile: 720p,       {company}/{media}/
                                status: ready)       {profile}/
                                                     ├── playlist.m3u8
                                                     ├── segment_0001.ts
                                                     ├── segment_0002.ts
                                                     └── ...
```

### Stream Endpointleri

```
VLC / IPTV Uygulamasi
        │
        ▼
GET /api/stream/{TOKEN}/master.m3u8
        │
        │  #EXTM3U
        │  #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
        │  /api/stream/{TOKEN}/variant/720p/playlist.m3u8
        │
        ▼
GET /api/stream/{TOKEN}/variant/{PROFILE}/playlist.m3u8
        │
        │  #EXTM3U  (LIVE mod - EXT-X-ENDLIST yok)
        │  #EXT-X-MEDIA-SEQUENCE:12345
        │  #EXTINF:6.006,
        │  /api/stream/{TOKEN}/segment/{MEDIA_ID}/720p/segment_0001.ts
        │  ...
        │
        ▼
GET /api/stream/{TOKEN}/segment/{MEDIA_ID}/{PROFILE}/{FILENAME}
        │
        └── .ts dosyasi dogrudan disk'ten okunur
```

### Live HLS Modu (Sliding Window)

IPTV istemciler icin sonsuz dongu simulasyonu:

1. Playlist'teki tum video item'larinin segment'leri birlestirilir (global segment listesi)
2. `stream_started_at` referans zamani ile gecen sure hesaplanir
3. `elapsed % total_duration` = dongudeki pozisyon
4. Pozisyon etrafinda 60 segment'lik kayan pencere olusturulur (~6 dakika)
5. `EXT-X-MEDIA-SEQUENCE` surekli artar (VOD degil, LIVE gibi gorunur)
6. `#EXT-X-ENDLIST` eklenmez → istemci canli yayin olarak algilar
7. Cache: 3 saniye (istemci bu aralikla yeniden cekmelidir)

**Discontinuity:** Farkli videolar arasi geciste `#EXT-X-DISCONTINUITY` etiketi eklenir.

### Stream Token

- 32 byte rastgele → 64 hex karakter
- `devices.stream_token` kolonunda saklanir
- `stream_mode = true` olan cihazlar icin gecerli
- Sureleri dolmaz (kalici, manuel iptal edilmezse)
- `random_bytes(32)` ile olusturulur

---

## 7. FFmpeg Transcode Sistemi

### FFmpeg Bulma Sirasi (config.php)

```
1. FFMPEG_PATH environment variable
2. {BASE_PATH}/tools/ffmpeg/bin/ffmpeg[.exe]    (proje icine gomulu)
3. /usr/bin/ffmpeg                                (Linux)
4. /usr/local/bin/ffmpeg                          (macOS)
5. /opt/homebrew/bin/ffmpeg                       (macOS Homebrew)
6. /usr/local/cpanel/3rdparty/bin/ffmpeg          (cPanel)
7. PATH'deki 'ffmpeg' komutu                      (son care)
```

**Not:** FFmpeg lokalde (Windows/XAMPP) yuklenmemis olabilir. Sunucuda Docker container'inda veya sistem paketlerinden yuklenmis olarak calisir.

### Transcode Profilleri (HlsTranscoder::PROFILES)

| Profil | Cozunurluk | Video Bitrate | Max Bitrate | Buffer | Audio | H.264 Profil | Level | Etiket |
|--------|------------|---------------|-------------|--------|-------|-------------|-------|--------|
| 360p | 640x360 | 500 kbps | 600 kbps | 1000 kbps | 64 kbps | baseline | 3.0 | Low |
| 540p | 960x540 | 1000 kbps | 1200 kbps | 2000 kbps | 96 kbps | main | 3.1 | Medium |
| **720p** | 1280x720 | 2500 kbps | 3000 kbps | 5000 kbps | 128 kbps | main | 3.1 | High |
| 1080p | 1920x1080 | 5000 kbps | 6000 kbps | 10000 kbps | 192 kbps | high | 4.0 | Full HD |

**Varsayilan profil:** 720p (Faz A'da sadece bu profil aktif, Faz B'de coklu profil destegi hazir)

### FFmpeg Komutu

```bash
ffmpeg -y -i {INPUT} \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
    -c:v libx264 -preset medium -profile:v main -level 3.1 \
    -b:v 2500k -maxrate 3000k -bufsize 5000k \
    -c:a aac -b:a 128k -ar 44100 -ac 2 \
    -f hls -hls_time 6 -hls_list_size 0 \
    -hls_segment_type mpegts \
    -hls_segment_filename "{OUTPUT_DIR}/720p/segment_%04d.ts" \
    -hls_flags delete_segments+independent_segments \
    "{OUTPUT_DIR}/720p/playlist.m3u8"
```

**Onemli FFmpeg Parametreleri:**

| Parametre | Deger | Aciklama |
|-----------|-------|----------|
| `-preset medium` | medium | Hiz/kalite dengesi |
| `-hls_time 6` | 6 sn | Her segment 6 saniye |
| `-hls_list_size 0` | 0 | Tum segment'leri playlist'e ekle (VOD mod) |
| `-hls_segment_type mpegts` | mpegts | MPEG-TS format (en genis uyumluluk) |
| `-hls_flags independent_segments` | - | Her segment bagimsiz decode edilebilir |
| `force_original_aspect_ratio=decrease` | - | En-boy oranini koru |
| `pad=W:H:(ow-iw)/2:(oh-ih)/2` | - | Bosluk varsa siyah dolgu ekle |

### Kaynak Cozunurluk Kontrolu

- Kaynak video daha dusuk cozunurluge sahipse o profil atlanir
- Varsayilan profil (720p) her zaman denenir (kaynak daha dusuk olsa bile)
- Ornek: 480p kaynak → sadece 360p + 720p (540p ve 1080p atlanir)

### Master Playlist Olusturma

Tum basarili profiller icin adaptive HLS master playlist'i olusturulur:

```
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360,CODECS="avc1.42e030,mp4a.40.2",NAME="360p"
360p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.4d4031,mp4a.40.2",NAME="720p"
720p/playlist.m3u8
```

### HlsTranscoder.php Metodlari

| Metod | Amac |
|-------|------|
| `detectFfmpeg()` | FFmpeg/ffprobe mevcut mu kontrol et |
| `getVideoInfo($path)` | ffprobe ile video bilgisi al (sure, boyut, codec, fps) |
| `transcode($input, $output, $profiles, $callback)` | Video'yu HLS'e cevir |
| `generateMasterPlaylist($dir, $variants)` | Adaptive master.m3u8 olustur |
| `cleanup($dir)` | Tum HLS dosyalarini sil |
| `getAvailableProfiles($height, $deviceProfile)` | Uygun profilleri filtrele |
| `estimateOutputSize($duration, $profiles)` | Tahmini cikti boyutu hesapla |

---

## 8. TranscodeWorker (Arka Plan Isci)

### Kullanim

```bash
# Surekli calis (daemon)
php workers/TranscodeWorker.php --daemon

# Tek is isle
php workers/TranscodeWorker.php --once

# Kuyruk durumu
php workers/TranscodeWorker.php --status
```

### Is Akisi

```
1. FFmpeg kontrolu (yoksa exit 1)
2. Kuyruktan is al (dequeue - atomic claim)
   ├── Esanlamli islem limiti kontrolu (varsayilan: 2)
   ├── status: pending → processing (atomic UPDATE)
   └── priority DESC, created_at ASC siralamayla
3. Storage quota kontrolu (yeterli alan var mi?)
4. Transcode basla (progress: 5%)
   ├── FFmpeg her profil icin calistirilir
   ├── Progress callback: 5-95% arasi
   └── Segment dosyalari olusturulur
5. Master playlist olustur (progress: 98%)
6. Variant kayitlari olustur (transcode_variants)
7. Is tamamla (progress: 100%)

HATA DURUMUNDA:
├── retry_count < max_retries (3) → pending'e geri al
└── retry_count >= max_retries → kalici hata (failed)
```

### TranscodeQueueService.php Metodlari

| Metod | Amac |
|-------|------|
| `enqueue($mediaId, $companyId, $profiles)` | Kuyruge is ekle |
| `dequeue($companyId)` | Sonraki isi al (atomic claim) |
| `updateProgress($id, $progress)` | Ilerleme guncelle |
| `markCompleted($id, $results)` | Basarili tamamla + variant kayitlari |
| `markFailed($id, $error)` | Basarisiz isaretle (retry veya kalici) |
| `getStatus($mediaId)` | Media icin transcode durumu |
| `getReadyVariants($mediaId)` | Hazir HLS variant'lari getir |
| `getQueueStats($companyId)` | Kuyruk istatistikleri |
| `autoEnqueueOnUpload($mediaId, $companyId)` | Upload sonrasi otomatik ekle |
| `retryFailed($id)` | Basarisiz isi yeniden dene |
| `cleanupMedia($mediaId)` | Tum transcode verilerini temizle |

---

## 9. Stream API Endpoint'leri

### Kimlik Dogrulama

Tum stream endpoint'leri `stream_token` ile korunur. Bu token, `devices` tablosundaki `stream_token` kolonunda saklanir ve `stream_mode = true` olan cihazlar icin gecerlidir.

### GET /api/stream/{token}/master.m3u8

**Amac:** Adaptive HLS master playlist

**Akis:**
1. Token ile cihazi bul
2. Aktif playlist'i belirle (atama → zamanlama → fallback)
3. Video item'lari filtrele
4. Her video icin hazir HLS variant'lari sorgula
5. Eksik variant'lar icin otomatik transcode kuyruge ekle
6. Cihaz profili/ekran cozunurlugune gore variant filtrele
7. `stream_started_at` referans zamanini set et (ilk istekte)
8. M3U8 cikti uret

**Variant bulunamazsa:**
```
HTTP 503 Service Unavailable
Retry-After: 5
{ "error": "Stream is preparing", "retry_after_seconds": 5, "pending_media_ids": [...] }
```

### GET /api/stream/{token}/variant/{profile}/playlist.m3u8

**Amac:** Profil bazli live HLS playlist (kayan pencere)

**Live Mod Mantigi:**
```
toplam_sure = tum_segmentlerin_suresi
gecen_sure = simdi - stream_started_at
dongu_pozisyonu = gecen_sure % toplam_sure
pencere_boyutu = 60 segment (~360 saniye)
media_sequence = tamamlanan_dongu * toplam_segment + pencere_baslangici
```

**Cache:** `max-age=3` (istemci 3 saniyede bir yeniden cekmeli)

### GET /api/stream/{token}/segment/{mediaId}/{profile}/{filename}

**Amac:** .ts segment dosyasini sun

- Path traversal korumasi (`..` ve `/` engellenir)
- Hafif token dogrulama (sadece varlik kontrolu)
- `Content-Type: video/MP2T`
- `Cache-Control: public, max-age=86400, immutable` (degismez icerik)
- Cihaz `last_seen` guncellemesi: 10 saniyede bir (performans icin)

### POST /api/stream/heartbeat

Cihaz canlilik sinyali (stream modu icin).

### GET /api/stream/info

Stream oturum bilgileri.

---

## 10. Cihaz Profili ve Adaptif Kalite

### device_profile JSON Yapisi

```json
{
    "max_res": "720p",
    "max_resolution": "1280x720",
    "capabilities": ["video", "image", "template"],
    "color_space": "srgb",
    "refresh_rate": 60
}
```

### Maksimum Oynatma Yuksekligi Hesaplama

Oncelik sirasina gore kontrol edilir:

1. `device_profile` JSON icindeki alanlar: `max_res`, `max_resolution`, `resolution`, `max_profile`, `max_height`
2. Cihaz ekrani: `max(screen_width, screen_height)`
3. Deger cikarma pattern'leri:
   - `"1280x720"` → 1280 (max deger)
   - `"720p"` → 720
   - `"1080"` → 1080

### Variant Secimi

```php
// master.php icinde:
1. Tum hazir variant'lari topla
2. deviceMaxHeight'a gore filtrele (daha buyuk profiller cikarilir)
3. Filtreleme sonucu bos kalirsa:
   a. Cihaz yuksekligine en yakin (dusuk) profili sec
   b. O da yoksa en dusuk bitrate profili sec
4. Bitrate'e gore sirala (dusukten yuksege)
5. M3U8 ciktiya ekle
```

### Player Tarafinda HLS Destegi

```javascript
// player.js icinde:
if (Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
    hls.loadSource(url);
    hls.attachMedia(videoElement);
} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // iOS Safari - native HLS destegi
    videoElement.src = url;
}
```

---

## 11. Service Worker ve Offline Destek

### sw.js v1.2.4

**Cache Isimleri:**
- `omnex-player-v1.2.4` - Statik assets + API yaniti
- `omnex-player-media-v1.2.4` - Medya dosyalari

**Onbellekleme Stratejileri:**

| Kaynak Tipi | Strateji | Aciklama |
|-------------|----------|----------|
| API route'lari (`/api/player/`, `/api/media/`) | Network-first | Her zaman sunucudan dene, offline'da cache'den |
| HTML/navigasyon | Network-first | Guncel icerik oncelikli |
| Medya (jpg, png, mp4, m3u8) | Cache-first | Onbellekten sun, arka planda guncelle |
| Statik assets (CSS, JS) | Stale-while-revalidate | Hizli sunum, arka planda guncelle |

**Medya Cache Siniri:**
- Maksimum 50 MB
- `pruneMediaCache()` en eski medyayi siler
- Kismi yanit (206 status) onbelleklenmez (video streaming)
- 500ms throttle (bant genisligi korumasi)

**Mesaj API (main thread → SW):**

| Mesaj Tipi | Amac |
|------------|------|
| `SKIP_WAITING` | SW guncelleme beklemeden aktif ol |
| `CACHE_MEDIA` | Belirtilen URL'leri onbellekle |
| `PRUNE_MEDIA_CACHE` | Belirtilen URL'ler disindakileri sil |

---

## 12. Zamanlama (Schedule) Sistemi

### Tablo Yapisi

```
schedules
├── id (uuid)
├── company_id
├── name
├── playlist_id (iliskili playlist)
├── start_date / end_date (tarih araligi, opsiyonel)
├── start_time / end_time (saat araligi, opsiyonel)
├── days_of_week (JSON: [1,2,3,4,5] = Pazartesi-Cuma)
├── status: 'active' | 'inactive'
├── priority (yuksek = oncelikli)
└── schedule_devices (ara tablo: schedule_id + device_id)
```

### Zamanlama Kontrol Mantigi

```sql
-- Aktif zamanlamayi bul
SELECT s.*, p.items
FROM schedules s
JOIN schedule_devices sd ON s.id = sd.schedule_id
JOIN playlists p ON s.playlist_id = p.id
WHERE sd.device_id = ?
  AND s.status = 'active'
  AND (s.start_date IS NULL OR s.start_date <= NOW())
  AND (s.end_date IS NULL OR s.end_date >= NOW())
  AND (s.start_time IS NULL OR s.start_time <= CURRENT_TIME)
  AND (s.end_time IS NULL OR s.end_time >= CURRENT_TIME)
ORDER BY s.priority DESC
LIMIT 1
```

---

## 13. Veritabani Tablolari

Tum tablolar `signage` ve `devices` schema'larinda yer alir.

### signage Schema

| Tablo | Amac | Onemli Kolonlar |
|-------|------|-----------------|
| `playlists` | Playlist tanimlari | id, company_id, name, items (JSON), status, transition, orientation |
| `playlist_items` | Normalize item listesi | playlist_id, media_id, template_id, sort_order, duration, muted |
| `schedules` | Zamanlama kurallari | playlist_id, start_date/end_date, start_time/end_time, days_of_week, priority |
| `schedule_devices` | Zamanlama-cihaz eslestirme | schedule_id, device_id |
| `transcode_queue` | Video transcode kuyrugu | media_id, status, profiles (JSON), progress, retry_count |
| `transcode_variants` | HLS profil sonuclari | media_id, profile, resolution, bitrate, playlist_path, status |
| `stream_access_logs` | Stream erisim loglari | device_id, stream_token, request_type, profile, response_status |
| `web_templates` | Web tabela sablonlari | html_content, css_content, js_content, template_type, data_sources |
| `web_template_versions` | Sablon versiyon gecmisi | template_id, version_number, html/css/js_content |
| `web_template_widgets` | Yeniden kullanilabilir widget'lar | slug, html_template, css_styles, js_code, properties |
| `web_template_assignments` | Sablon-cihaz atamalari | template_id, device_id, priority, schedule_config |

### devices Schema (streaming ile ilgili kolonlar)

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| `stream_mode` | BOOLEAN DEFAULT false | Stream API erisimi aktif mi |
| `stream_token` | TEXT | 64 hex karakter stream tokeni |
| `device_profile` | TEXT (JSON) | Cihaz yetenek ve cozunurluk bilgisi |
| `screen_width` | INTEGER | Fiziksel ekran genisligi (piksel) |
| `screen_height` | INTEGER | Fiziksel ekran yuksekligi (piksel) |
| `last_stream_request_at` | TIMESTAMPTZ | Son stream API cagrisi |
| `stream_started_at` | TIMESTAMPTZ | Live window referans zamani |
| `current_playlist_id` | TEXT | Varsayilan playlist (fallback) |
| `current_playlist_index` | INTEGER | Oynatma pozisyonu |

### device_content_assignments

| Kolon | Aciklama |
|-------|----------|
| `device_id` | Cihaz UUID |
| `content_id` | Playlist veya template UUID |
| `content_type` | 'playlist' veya 'template' |
| `status` | 'active' veya 'inactive' |

---

## 14. Yapilandirma Sabitleri

`config.php` icinde tanimli:

| Sabit | Deger | Aciklama |
|-------|-------|----------|
| `STREAM_SEGMENT_DURATION` | 6 | HLS segment suresi (saniye) |
| `STREAM_DEFAULT_PROFILE` | '720p' | Varsayilan transcode profili |
| `STREAM_PLAYLIST_TTL` | 60 | Playlist cache suresi (saniye) |
| `STREAM_TOKEN_LENGTH` | 32 | Token uzunlugu (byte, hex=64 char) |
| `STREAM_STORAGE_PATH` | `{STORAGE_PATH}/streams` | HLS cikti dizini |
| `STREAM_MAX_CONCURRENT_TRANSCODE` | 2 | Paralel transcode limiti |
| `FFMPEG_PATH` | Otomatik tespit | FFmpeg binary yolu |
| `FFMPEG_PROBE_PATH` | Otomatik tespit | ffprobe binary yolu |

---

## 15. Dosya ve Dizin Haritalari

### Kaynak Kodlari

| Islem | Dosya |
|-------|-------|
| **PWA Player Shell** | `public/player/index.html` |
| **Player JS** | `public/player/assets/js/player.js` |
| **Player API Client** | `public/player/assets/js/api.js` |
| **Player Storage** | `public/player/assets/js/storage.js` |
| **Player CSS** | `public/player/assets/css/player.css` |
| **Player Service Worker** | `public/player/sw.js` |
| **Player PWA Manifest** | `public/player/manifest.json` |
| **HLS Transcoder** | `services/HlsTranscoder.php` |
| **Transcode Queue Service** | `services/TranscodeQueueService.php` |
| **Transcode Worker** | `workers/TranscodeWorker.php` |
| **Stream Master** | `api/stream/master.php` |
| **Stream Variant** | `api/stream/variant.php` |
| **Stream Segment** | `api/stream/segment.php` |
| **Stream Heartbeat** | `api/stream/heartbeat.php` |
| **Stream Info** | `api/stream/info.php` |
| **Player Init API** | `api/player/init.php` |
| **Player Sync API** | `api/player/sync.php` |
| **Player Heartbeat API** | `api/player/heartbeat.php` |
| **Player Register API** | `api/player/register.php` |
| **Player Verify API** | `api/player/verify.php` |
| **Player Command ACK** | `api/player/command-ack.php` |
| **Player Content** | `api/player/content.php` |
| **Playlist CRUD** | `api/playlists/*.php` |
| **Schedule CRUD** | `api/schedules/*.php` |
| **Signage Frontend** | `public/assets/js/pages/signage/*.js` |
| **DB Schema** | `database/postgresql/v2/17_signage.sql` |
| **FFmpeg Config** | `config.php` (satirlar 218-275) |

### Depolama Dizini

```
storage/
└── streams/
    └── {company_id}/
        └── {media_id}/
            ├── master.m3u8                (adaptive master playlist)
            ├── 360p/
            │   ├── playlist.m3u8
            │   ├── segment_0001.ts
            │   ├── segment_0002.ts
            │   └── ...
            ├── 540p/
            │   ├── playlist.m3u8
            │   └── segment_*.ts
            ├── 720p/
            │   ├── playlist.m3u8
            │   └── segment_*.ts
            └── 1080p/
                ├── playlist.m3u8
                └── segment_*.ts
```

---

## 16. Is Akisi Diyagramlari

### Video Yukleme → Oynatma

```
1. Admin video yukler
   POST /api/media/upload → media tablosu + dosya sistemi

2. Otomatik transcode kuyruge ekleme
   TranscodeQueueService::autoEnqueueOnUpload()
   → INSERT transcode_queue (status: pending)

3. TranscodeWorker daemon isi alir
   → dequeue() (atomic claim: pending → processing)
   → FFmpeg calistirilir (profil bazli)
   → Segment dosyalari olusturulur
   → Master playlist olusturulur
   → transcode_variants kayitlari olusturulur (status: ready)

4. Admin playlist'e video ekler + cihaza atar
   → playlists.items guncellenir
   → device_content_assignments olusturulur

5. Player init/sync cagrisi yapar
   → Aktif playlist belirlenir
   → Video item'lar icin hazir variant sorgulanir
   → Uygun profil secilir (cihaz max yuksekligine gore)
   → HLS URL veya dogrudan video URL donulur

6. Player icerik gosterir
   a) PWA Player: HLS.js ile oynatma veya dogrudan <video>
   b) VLC/IPTV: master.m3u8 → variant → segment
```

### Istemci Senkronizasyon Dongusu

```
PWA Player Calisirken:
─────────────────────

Her 5 sn:   POST /api/player/heartbeat
            → Cihaz durumu bildir (battery, cpu, memory)
            → Bekleyen komutlari al
            → Tamamlanan komutlari bildir

Her 60 sn:  POST /api/player/sync?since=...
            → Degisiklikleri kontrol et
            → Guncellenmis playlist/sablon/komutlari al
            → Degisiklik varsa icerigi yenile

Surekli:    Icerik oynatma dongusu
            → Item suresi dolunca → sonraki item
            → Gecis efekti uygula (fade/slide/dissolve)
            → Video → video: dual slot ile kesintisiz gecis
```

---

## 17. Bilinen Sinirlamalar

| Sinir | Deger | Not |
|-------|-------|-----|
| Segment suresi | 6 sn (sabit) | config.php'de degistirilebilir |
| Paralel transcode | 2 | Sunucu CPU'suna gore ayarlanabilir |
| Medya cache (SW) | 50 MB | Player cihaz depolamasina gore |
| Heartbeat araligi | 5 sn | Query param ile degistirilebilir |
| Sync araligi | 60 sn | Query param ile degistirilebilir |
| Sync code suresi | 15 dk | Hardcoded |
| Stream token suresi | Suresiz | Manuel iptal gerekir |
| Kayan pencere | 60 segment (~360 sn) | variant.php'de hardcoded |
| Variant playlist cache | 3 sn | variant.php'de hardcoded |
| Segment cache | 86400 sn (1 gun) | segment.php'de immutable |
| Max retry | 3 deneme | Transcode kuyrugunde |
| Faz A aktif profil | Sadece 720p | Faz B'de coklu profil aktif olacak |
| FFmpeg lokalde | Yuklenmemis olabilir | Sunucuda Docker/sistem paketi ile calisir |

### Faz Durumu

| Faz | Durum | Icerik |
|-----|-------|--------|
| **Faz A** | Aktif | Tek profil (720p), temel HLS, live kayan pencere |
| **Faz B** | Hazir (kod mevcut, aktif degil) | Coklu profil (360p-1080p), cihaz bazli adaptif kalite |

---

*Bu dokuman, projedeki tum player ve streaming bilesenlerinin kaynak kod analizi ile olusturulmustur.*
