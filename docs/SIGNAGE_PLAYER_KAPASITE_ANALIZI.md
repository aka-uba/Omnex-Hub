## Omnex Signage Player – Kapasite ve Ölçeklenebilirlik Analizi

Bu doküman, `http://.../#/signage`, `#/signage/playlists/...` ve `http://.../player/` tarafındaki dijital signage sisteminin:

- **Mimarisini (özellikle player tarafını)**
- **Playlist / cihaz / içerik kapasite sınırlarını**
- **10 / 100 / 1000 / 10.000+ cihaz senaryolarında bant genişliği ve DB/CPU yükünü**
- **1000+ cihaz ve üstü için önerilen mimari iyileştirmeleri**

özetler.

---

## 1. Mevcut Signage Player Mimarisi (PWA)

Player tarafı `public/player` altında bağımsız bir PWA olarak çalışır:

- `public/player/assets/js/player.js` → Omnex Player ana uygulama
- `public/player/assets/js/api.js` → API istemcisi
- `public/player/assets/js/storage.js` → IndexedDB + localStorage cache
- `public/player/sw.js` → Service Worker (statik + medya cache’i ve offline destek)

### 1.1. Başlatma Akışı

- Player açılınca:
  - `storage.init()` ile IndexedDB açılır.
  - `api.init()` → cihaz için kayıtlı token/config alınır.
  - Token varsa `initializePlayer()` çalışır:
    - `/api/player/init` ile **cihazın aktif playlist’i** ve cihaz bilgileri alınır.
    - `this.playlist = data.playlist`
    - Playlist IndexedDB’ye yazılır (`storage.savePlaylist()`).
    - `precacheMedia()` ile playlist’teki tüm medya URL’leri SW’ye gönderilir.
    - SW `CACHE_MEDIA` mesajını alıp ilgili URL’leri önceden indirir ve `MEDIA_CACHE_NAME` içinde saklar.
    - Sonrasında `startPlayback()`, `startHeartbeat()`, `startSyncChecker()` başlar.

### 1.2. Heartbeat ve Komutlar

- Konfig:
  - `heartbeatSeconds = 5`
  - `syncSeconds = 60`
- **Heartbeat:**
  - Her **5 saniyede bir** `/api/player/heartbeat`:
    - Gönderilen alanlar:
      - `status` (playing / idle)
      - `currentItem` (çalan içerik id’si)
      - `battery`, `memory`, `uptime`
    - Dönen response:
      - `commands[]` → `processCommands()` ile `start/stop/refresh/sync/reboot/...`
      - `shouldSync` → `true` ise `syncContent()` tetiklenir.

### 1.3. İçerik Senkronizasyonu

- `syncSeconds = 60` → her **60 saniyede bir** `syncContent()`:
  - Yine `/api/player/init` çağrılır.
  - Yeni gelen playlist ile:
    - Playlist id,
    - Item sayısı,
    - Item’ların `media_id`/`id` hash’i
  karşılaştırılır.
  - Değişiklik varsa:
    - Yeni playlist IndexedDB’ye yazılır.
    - `precacheMedia()` ile yeni medya dosyaları SW’ye cache’lenir.
    - Playlist tamamen değiştiyse playback yeniden başlatılır; sadece içerik değişimi varsa kesinti olmadan güncelleme yapılabilir.

### 1.4. Service Worker ve Medya Cache

- `sw.js`:
  - Statik dosyaları (`index.html`, `player.js`, `api.js`, CSS, icon’lar) **install** sırasında cache’ler.
  - Fetch stratejileri:
    - `/api/player/...` ve `/api/media/...` → **network-first** (cache fallback).
    - Medya (`/storage/...`, `/media/...`, `.jpg/.png/.mp4/.m3u8`) → **cache-first + background revalidate**.
- Player’dan:
  - `precacheMedia()` → SW’ye `CACHE_MEDIA` mesajı gönderir:
    - `cacheMediaList(urls)` ile her URL bir kere indirilir (200 OK ise cache’e alınır).
  - Yayın sırasında medya **cache’ten oynar**, tekrar tekrar stream edilmez.

**Sonuç:** Yayın esnasında bant genişliğini tüketen şey stream değil, **özellikle ilk seferde ve değişiklik anlarında yapılan medya indirmeleri** ve küçük JSON tabanlı kontrol trafiğidir.

---

## 2. Playlist / Cihaz / İçerik Kapasitesi

### 2.1. Playlist Sayısı

- Yönetim paneli `/signage` altında:
  - `PlaylistListPage` `/api/playlists` ile çalışıyor.
  - Kodda sert bir sınır yok; limitler daha çok:
    - DB tasarımı,
    - İndeksler,
    - Yönetilebilirlik (UI/UX) tarafından belirlenir.
- Pratik:
  - **Yüzlerce playlist** → Sorunsuz.
  - **Binlerce playlist** → Teknik olarak mümkün; organizasyon ve filtreleme önemli hale gelir.

### 2.2. Playlist Başına Cihaz Sayısı

- UI’de playlist başına:
  - `assigned_devices` listesi üzerinden çalışılıyor.
  - Cihaz atama:
    - `/devices` ile cihazlar çekilip,
    - `/playlists/{id}/assign-devices` endpoint’i ile **tek JSON gövdede** `device_ids[]` gönderiliyor.
- Backend doğru indeksliyse:
  - `playlist_device` benzeri ilişki tablosuyla:
    - **1000+ cihaz / playlist** ölçeklenebilir.
    - 10.000+ cihaz seviyesinde CPU/DB ve komut fan-out için özel tasarım gerekse de, model buna engel değil.

### 2.3. Playlist Başına İçerik Sayısı

- Player tarafında `playlist.items` için sert bir limit yok:
  - Sadece `items.length === 0` kontrolü var.
  - Her item tip, url, duration, mime_type vb. içeriyor.
- Bir item JSON’ının boyutu tipik olarak:
  - ~**300–800 byte** (gerçek yapıya göre).
- Pratik öneri:
  - **20–100 içerik / playlist**:
    - JSON boyutu rahat (10–80 KB),
    - Yönetilebilirlik güçlü.
  - 200–300 içerik:
    - Teknik olarak çalışır; UI ve içerik yönetimi zorlaşır.
  - 500+ içerik:
    - Önerilmez, ama sistemsel limit yok; JSON büyür, edit/preview zorlaşır.

---

## 3. Kontrol Trafiği Analizi (Heartbeat + Init/Sync)

Bu bölümde medya indirmeyi değil; sadece **JSON tabanlı kontrol trafiğini** (heartbeat + init/sync) hesaplıyoruz.

### 3.1. Varsayımlar

- Heartbeat:
  - Sıklık: `heartbeatSeconds = 5`
  - Gövde (status, currentItem, battery, memory, uptime):
    - Header + JSON toplam ≈ **~2 KB** (gidiş + dönüş birlikte kabaca).
- Sync (`/api/player/init`):
  - Sıklık: `syncSeconds = 60`
  - Dönen JSON:
    - Cihaz bilgisi + şirket + playlist meta + 50–100 item:
    - ≈ **~30–50 KB** (biz **40 KB** kabul ediyoruz).

### 3.2. Tek Cihaz İçin Ortalama Kontrol Trafiği

Formül (cihaz başına, byte/sn):

\[
\text{Byte/sn} \approx \frac{B_h}{T_h} + \frac{B_s}{T_s}
\]

- \( B_h \) = heartbeat boyutu ≈ 2000 B  
- \( T_h \) = heartbeat periyodu = 5 sn  
- \( B_s \) = sync/init cevabı ≈ 40000 B  
- \( T_s \) = sync periyodu = 60 sn  

\[
\approx \frac{2000}{5} + \frac{40000}{60} \approx 400 + 667 \approx 1067 \text{ B/sn}
\]

- ≈ **1–1.5 KB/sn ≈ 8–12 kbps / cihaz**

### 3.3. 10 / 100 / 1000 / 10.000 Cihaz Senaryoları (Sadece Kontrol Trafiği)

- **10 cihaz**:
  - ≈ 10 × 1.1 KB/sn ≈ **11 KB/sn ≈ 88 kbps** (≈ 0.1 Mbps)
  - Günlük toplam veri: ≈ **~0.9–1 GB/gün**.

- **100 cihaz**:
  - ≈ 110 KB/sn ≈ **0.88 Mbps** (~1 Mbps)
  - Günlük: ≈ **~9–10 GB/gün**.

- **1000 cihaz**:
  - ≈ 1100 KB/sn ≈ **8.8 Mbps** (~10 Mbps)
  - Günlük: ≈ **~90–100 GB/gün**.

- **10.000 cihaz**:
  - ≈ 11.000 KB/sn ≈ **~88 Mbps** (~100 Mbps mertebesi)
  - Günlük: ≈ **~900 GB – 1 TB/gün**.

Notlar:

- Bunlar “her cihaz 5 sn heartbeat + 60 sn’de bir full `/player/init`” varsayımıyla yapılmış kaba hesaplar.
- Playlist versiyonlama + delta update ile `/player/init` boyutu azaldıkça bu trafik ciddi şekilde düşürülebilir.

---

## 4. Medya Trafiği (Asıl Büyük Yük)

Medya trafiği:

- Player mimarisi gereği:
  - Playlist geldiğinde `precacheMedia()` ile SW’ye URL listesi gönderilir.
  - SW her medya URL’sini **bir kere indirip cache’e yazar**.
  - Yayın sırasında video/görseller **cache’ten okunur**, stream yapılmaz.
- Dolayısıyla bant genişliği yükü:
  - **İlk kurulumda** (cihazın ilk kez tüm içerikleri çekmesi),
  - **Kampanya değişikliklerinde** (yeni medya seti),
  - **Cache temizleme / reset durumlarında**
  patlar.

### 4.1. İçerik Profili Örnekleri

- **Hafif playlist (sadece görsel)**:
  - 30 görsel, ~300 KB:
  - ≈ **9 MB / cihaz / playlist**.

- **Orta playlist (görsel + kısa video)**:
  - 20 görsel × 300 KB ≈ 6 MB
  - 3 video (20–30 sn, ~3–4 Mbps) ≈ 10 MB / video → 3 × 10 = 30 MB
  - Toplam ≈ **36 MB / cihaz / playlist**.

- **Ağır playlist (daha uzun videolar)**:
  - 10 video × 30 MB ≈ **300 MB / cihaz / playlist**.

### 4.2. Örnek Hesaplar (Tek Playlist, Hepsi Aynı Playlist’i Alıyor)

#### 10 Cihaz – Orta Playlist (~36 MB)

- Toplam veri:
  - 10 × 36 MB = **360 MB**
- 100 Mbps hat (12.5 MB/sn):
  - 360 / 12.5 ≈ **~29 sn** (teorik alt sınır).

#### 100 Cihaz – Orta Playlist (~36 MB)

- Toplam veri:
  - 100 × 36 MB = **3.6 GB**
- 100 Mbps:
  - 3.6 GB ≈ 3600 MB
  - 3600 / 12.5 ≈ **~288 sn (~5 dk)**
- 1 Gbps (125 MB/sn):
  - 3600 / 125 ≈ **~29 sn**.

#### 1000 Cihaz – Orta Playlist (~36 MB)

- Toplam veri:
  - 1000 × 36 MB = **36 GB**
- 1 Gbps:
  - 36.000 / 125 ≈ **~288 sn (~5 dk)**
- 100 Mbps:
  - 36.000 / 12.5 ≈ **~2880 sn (~48 dk)**.

#### 10.000 Cihaz – Orta Playlist (~36 MB)

- Toplam veri:
  - 10.000 × 36 MB = **360 GB**
- 1 Gbps:
  - 360.000 / 125 ≈ **~2880 sn (~48 dk)**
- 10 Gbps:
  - 360.000 / 1250 ≈ **~288 sn (~5 dk)**.

**Önemli:** Bunlar “her cihaz aynı anda, maksimum hızda indiriyor” varsayımıyla idealize edilmiş; gerçek hayatta disk I/O, eşzamanlı bağlantı sınırlamaları ve rate limitler sebebiyle daha uzun sürelere yayılır.

### 4.3. Çok Playlist’li / Çok Cihazlı Genel Formül

Bir playlist için:

- \( A_p \) = playlist’in medya seti boyutu (MB)
- \( N_p \) = o playlist’e atanmış cihaz sayısı

Toplam veri:

\[
\text{Toplam MB} = \sum_p (A_p \times N_p)
\]

Örneğin:

- 5 farklı playlist, her biri ~40 MB, her biri 2000 cihaza atanmış:
  - Her playlist için: 40 × 2000 = 80.000 MB = 80 GB
  - Toplam: 5 × 80 GB = **400 GB**.

Bu hacimler tipik olarak:

- **Merkezi veri merkezine WAN üzerinden** gidiyorsa:
  - Kampanyaların dağıtımını zamana yaymak (ör. gece), mağaza/ülke bazlı batch rollout.
- **Mağaza içi LAN**’da çalışıyorsa:
  - Mağaza içinde tek bir local cache / edge sunucudan dağıtım gibi stratejilerle yönetilir.

---

## 5. 1000 Cihaz Seviyesi İçin Değerlendirme

### 5.1. Kontrol Trafiği

- 1000 cihazda:
  - Sürekli kontrol trafiği ≈ **~10 Mbps** mertebesinde.
  - Modern veri merkezi / şirket hattı için **oldukça makul**.
- Gerekirse:
  - `heartbeatSeconds` → 5 → **10–15 sn** aralığına,
  - `syncSeconds` → 60 → **120 sn** civarına çekilerek
  - trafik **~%40–60 azaltılabilir**.

### 5.2. Medya Trafiği

- 1000 cihaz, cihaz başına ~36 MB yeni medya:
  - Toplam ≈ **36 GB**.
  - 1 Gbps hat ile teorik ≈ 5 dk’da indirilebiliyor; pratikte 10–20 dk aralığı makul.
- Öneriler:
  - Büyük kampanya değişikliklerini:
    - **Gece saatlerine** veya düşük trafik zamanlarına planlamak.
    - Cihaz gruplarını (mağaza/şehir/ülke) batch halinde güncellemek (**örn. her 5–10 dakikada 200–300 cihaz**).

### 5.3. Playlist / Cihaz / İçerik Sınırları (1000 Cihaz Perspektifi)

- Playlist sayısı:
  - Yüzlerce playlist teknik olarak sorun değil; organizasyon ve yetkilendirme önemli.
- Playlist başına cihaz:
  - 1000 cihaz / playlist gayet makul.
- Playlist başına içerik:
  - Hedef:
    - **20–100 item / playlist**.
  - Çok istisnai durumlar dışında 200+ item tek playlist’te tutulmamalı.

---

## 6. 10.000+ Cihaz ve 1000+ Cihaz İçin Özel Ölçek Tasarımı Önerileri

Bu bölümde özellikle:

- **1000+ cihaz** seviyesinde yapılabilecek iyileştirmeler
- **10.000+ cihaz** ve üstü için gerekli mimari adımlar

özetlenmiştir.

### 6.1. Heartbeat ve Sync Yükünü Yumuşatma

**Yapılabilecekler:**

- **Parametre ayarı:**
  - `heartbeatSeconds`:
    - 5 sn → **10–15 sn** (özellikle 1000+ cihazda).
  - `syncSeconds`:
    - 60 sn → **120–180 sn** (içerik değişikliklerinin sıklığına göre).

- **Jitter (rastgele kaydırma):**
  - Player tarafında heartbeat başlatırken:
    - `setTimeout(startHeartbeat, random(0, heartbeatSeconds * 1000))`
  - Böylece 10k cihaz aynı anda değil, **saniyelere yayılmış** şekilde heartbeat atar; CPU/DB spike’ları azalır.

- **Heartbeat verisini hafif store’a yazma:**
  - “Kim online/offline?” bilgisini:
    - **Redis key/value** ile tutmak (örn. `device:{id}:status`),
    - ya da hafif bir “append-only log” tablosu ile saklayıp arka planda analitik DB’ye akıtmak.

### 6.2. Komut Dağıtımı İçin Mesaj Kuyruğu

1000+ cihazda playlist başlat/durdur gibi işlemler için:

- **Mevcut yaklaşım:** Panel `send-command` endpoint’ine cihaz cihaz HTTP çağrıları yaparsa ölçeklenmez.

**Önerilen yaklaşım:**

- **Batch komut kaydı:**
  - Panel tarafında:
    - `/playlists/{id}/broadcast-command` gibi bir endpoint:
      - Playlist’e atanmış tüm cihaz id’lerini **DB’den bir kere** çıkarır.
      - “CommandBatch” tablosuna:
        - `id`, `type` (`start/stop/refresh/...`),
        - `target_device_ids` veya ayrı `command_targets` tablosu,
        - `status` (pending/running/completed)
      - yazar.
      - Aynı anda mesaj kuyruğuna (RabbitMQ / Redis Streams / SQS / Kafka) `batch_id` gönderir.

- **Worker’lar ile fan-out:**
  - Arka planda çalışan N worker:
    - Kuyruktan `batch_id` alır.
    - Her cihaz için:
      - `player_commands` benzeri bir tabloya veya Redis listesine **tek satır/entry** yazar.
  - Player’ın `/api/player/commands` / heartbeat cevabındaki `commands[]` çıktısı bu tablodan/Redis’ten okunur → çok hafif sorgular.

**Kazanımlar:**

- Panel işlemi:
  - 10.000 HTTP çağrısı yerine **1 batch kaydı** + 1 queue mesajı üretir.
- Komut dağıtımı:
  - Yatay ölçeklenebilir worker’lar tarafından yönetilir.

### 6.3. DB Tarafında İndeksleme, Partition ve Replika

**Kritik tablolar:**

- `devices`:
  - İndeksler: `id`, `company_id`, `status`.
- `playlists`:
  - İndeksler: `id`, `company_id`, `status`.
- `playlist_device` (ilişki tablosu):
  - İndeksler: `(playlist_id)`, `(device_id)`, gerekirse `(playlist_id, device_id)`.
- `player_commands`:
  - İndeksler: `(device_id, status)`, `(created_at)`.

**Öneriler:**

- **Partitioning / sharding:**
  - 10k–100k cihaz ölçeğinde:
    - Cihazları şirket / bölge / ülke bazında partition etmek (ör. PostgreSQL partition).
    - Telemetri/log tablolarını zaman bazlı partition yapmak (gün/hafta).

- **Read replica:**
  - Primary:
    - Yazma + kritik transactionlar için.
  - Read replica(lar):
    - Dashboard, rapor, listeleme gibi **ağır SELECT** yükleri için.

### 6.4. `/player/init` Yanıtını Hafifletme (Playlist JSON Optimizasyonu)

**Öneriler:**

- **Derlenmiş playlist JSON cache’i:**
  - Playlist veya item’leri değiştikçe:
    - Playlist + items + template verisini tek JSON olarak **önceden derle**.
    - Bunu Redis’te veya `playlists_compiled` gibi bir tabloda sakla.
  - `/api/player/init`:
    - Cihazın hangi playlist’i alacağını bulup **hazır JSON’u direkt döner**.
  - Böylece her init/sync çağrısında ağır JOIN ve hesaplama yapılmaz.

- **Versiyonlama ve ETag:**
  - Playlist’lere `version` alanı ekle.
  - Player:
    - `/player/init`’ten aldığı versiyonu saklar.
    - Sonraki çağrıda `If-None-Match` ya da `?version=...` ile gelir.
  - Playlist değişmediyse:
    - 304 Not Modified veya küçük bir “değişiklik yok” cevabı dönebilirsin.

### 6.5. Medya Dağıtım Stratejileri (1000+ Cihaz)

**Pratik öneriler:**

- **Zamanlama:**
  - Büyük playlist/medya değişikliklerini:
    - Gece / düşük trafik pencerelerine planla.
    - “Deployment window” kavramı kullan.

- **Batch rollout:**
  - Örn. 10.000 cihazı:
    - 10 × 1000 ya da 20 × 500’lük gruplara böl,
    - Her 5–10 dakikada bir gruba yeni playlist’i ata (komut batch).

- **Yerel cache / edge sunucu:**
  - Büyük zincir mağazalarda:
    - Her mağazada veya bölgede:
      - Medya dosyalarının tutulduğu **lokal Nginx cache / mini edge sunucu**.
    - Cihazlar medyayı internet yerine bu lokal sunucudan çeker:
      - WAN yükü ciddi şekilde azalır.

---

## 7. Özet ve Önerilen Yol Haritası

### 7.1. Bugünkü Durum

- Player mimarisi:
  - İçerikleri önceden indirip cache’ten oynattığı için,
  - 10–1000+ cihaz seviyesinde **bant genişliği ve CPU açısından sağlıklı**.
- Sürekli bant tüketimi:
  - Neredeyse tamamen JSON tabanlı kontrol trafiğinden (heartbeat + init/sync) oluşuyor.

### 7.2. 1000+ Cihaz İçin Önerilen Minimum Değişiklikler

**Kısa vadede yapılabilecekler:**

1. **Heartbeat ve sync periyotlarını ayarla:**
   - `heartbeatSeconds` → 5 → **10–15 sn**,
   - `syncSeconds` → 60 → **120 sn**.
2. **Jitter ekle:**
   - Heartbeat ve sync timer’larını ilk başlatırken 0–N sn arası rastgele gecikme.
3. **Playlist başına içerik sayısını yönetilebilir tut:**
   - Hedef **20–100 item**, mümkünse 200+ item’lerden kaçın.

**Orta vadede (1000–10.000 cihaz ve üstü için):**

4. **Komut dağıtımı için mesaj kuyruğu ve batch sistemi ekle:**
   - Panel tarafında tek bir “command batch” oluşturarak,
   - Worker’lar ile `player_commands` kayıtlarını fan-out yöntemiyle üret.
5. **`/player/init` cevabını optimize et:**
   - Derlenmiş playlist JSON cache’i (Redis veya ayrı tablo),
   - Playlist versiyonlama ve 304 / delta update mantığı.
6. **DB tarafında indeks ve (gerekirse) partition/read replica:**
   - `devices`, `playlists`, `playlist_device`, `player_commands` için doğru indeksler,
   - Yük arttıkça read replica ve partitioning planı.

Bu adımlar uygulandığında:

- **1000+ cihaz** seviyesinde sistem rahat çalışmaya devam eder.
- **10.000+ cihaz** için de:
  - Ana darboğazlar (komut fan-out, ağır `/player/init` sorguları, ani heartbeat spike’ları) büyük ölçüde ortadan kalkmış olur.











