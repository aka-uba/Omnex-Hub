# Gateway End-to-End Workflow and Optimizations (2026-02-13)

Bu dokuman, bu dialog boyunca yapilan tum teknik duzenlemeleri tek yerde toplar:

- Render/gonderim dogrulugu (tasarim + medya + path)
- Queue ve gateway arasinda asenkron calisma
- Local ve gateway modlari arasindaki farklar
- Performans iyilestirmeleri (batch, cache, md5 skip, keep-alive)
- Log bazli once/sonra olcumleri

## 1. Problemin Baslangic Durumu

Sahada gorulen ana semptomlar:

1. Sunucudan gelen gonderimlerde tasarimin bir kismi eksik/siyah/beyaz gorunuyordu.
2. Bazi cihazlarda `Resource check failed` goruluyordu.
3. Cihazdan cihaza gecis suresi uzundu.
4. Ilk asamada 401 ve `no such table: gateways` gibi operasyonel hatalar goruldu (ortam/migration/auth kaynakli).

## 2. Bu Surecte Yapilan Kod Degisiklikleri

### 2.1 Render ve gonderim dogrulugu

Dosya: `api/render-queue/process.php`

Yapilanlar:

1. Gateway komut parametrelerine dosya yolu yerine signed URL destekli medya referanslari eklendi.
2. Komut payload'ina `image_url`, `video_paths[].url`, `image_md5`, `video md5` gibi dogrulama alanlari eklendi.
3. `queue_id` ve `queue_item_id` komuta eklendi (komut sonucu queue item ile birebir baglansin diye).
4. Region/layout akisi korunarak cihaza giden task olusumu duzenlendi (gorsel + video alanlari birlikte).

Etkisi:

- Sunucu -> gateway -> cihaz zincirinde path uyumsuzlugu azaldi.
- Tasarim + video birlikte gonderim daha tutarli hale geldi.

### 2.2 Asenkron queue modeli (sunucu tarafi)

Dosyalar:

- `api/render-queue/process.php`
- `api/gateway/command-result.php`

Yapilanlar:

1. `sendLabelViaGatewayQueue` artik varsayilan olarak komut sonucunu bloklayarak beklemiyor, komutu kuyruga yazip donuyor.
2. `process.php` tarafinda gateway kuyruga alinmis item'lar `completed` yerine `processing` olarak isaretleniyor.
3. `command-result.php`, komut sonucunu alip dogrudan `render_queue_items` kaydini guncelliyor:
   - `completed -> completed`
   - `failed/timeout -> failed`
   - `executing -> processing`
4. `command-result.php` queue progress'i (`RenderQueueService::updateQueueProgress`) anlik guncelliyor.

Ek ayarlar:

- `gateway_wait_for_completion` (true ise eski senkron davranis)
- `gateway_async_queue` (true ise asenkron davranis)

Etkisi:

- Sunucu worker cihazi tek tek bekleyip bloklamiyor.
- Cihazlarin komuta alinma hizi belirgin artti.

### 2.3 Gateway heartbeat ve batch tuning

Dosyalar:

- `api/gateway/heartbeat.php`
- `api/gateway/register.php`
- `public/assets/js/pages/queue/QueueDashboard.js`

Yapilanlar:

1. Heartbeat response runtime config donduruyor:
   - `polling_interval_ms`
   - `burst_sleep_ms`
   - `command_batch_size`
2. Heartbeat command batch varsayilani `20` yapildi.
3. Gateway register default config tarafinda batch `25` degeri korunuyor.
4. Queue dashboard worker `max_jobs` degeri `1 -> 5` yapildi.

Etkisi:

- Queue uretim/tuketim hizi artti.
- Tek heartbeat'te birden fazla komut alinabilir hale geldi.

### 2.4 Gateway tarafi cache ve md5 skip iyilestirmeleri

Dosya: `local-gateway-manager/resources/gateway/gateway.php`

Yapilanlar:

1. Medya cache key stabil hale getirildi:
   - signed URL degisse bile ayni kaynak icin stabil identity
   - MD5 varsa cache key dogrudan MD5 tabanli
2. In-memory remote file hint eklendi:
   - Ayni cihaz + ayni remote path + ayni md5 ise upload skip
3. Upload skip loglari detaylandi (`source: memory_hint` vb.).
4. Gecici dosya temizliginde cache dosyalarinin korunmasi duzenlendi.

Etkisi:

- Ayni urun/sablon tekrar gonderimlerinde upload maliyeti ciddi azaldi.
- `upload atlandi (MD5 ayni)` davranisi logda gorulur hale geldi.

### 2.5 Son performans paketi (keep-alive + resolve cache)

Dosyalar:

- `local-gateway-manager/resources/gateway/gateway.php`
- `local-gateway-manager/resources/gateway/gateway.config.example.json`

Yapilanlar:

1. Shared cURL handle altyapisi eklendi:
   - `getSharedCurlHandle`
   - `applyKeepAliveOptions`
2. Server API ve media download cagrilarinda keep-alive/reuse aktif edildi.
3. Yeni config parametresi:
   - `server_connect_timeout` (default 5s)
4. `resolveLocalMediaPath` icin RAM icinde resolved path cache eklendi:
   - ayni kaynak tekrar cozulurken ek maliyet azalir.

Etkisi:

- Ozellikle ardarda ayni hosta yapilan isteklerde baglanti maliyeti dusuruldu.
- Tekrar eden medya cozumlemelerinde CPU/IO maliyeti azaldi.

## 3. Local vs Gateway Is Akisi

## 3.1 Local (direct) mod

Akis:

1. Queue/process cihazi alir.
2. `processForPavoDisplay` dogrudan cihaz IP'sine gider.
3. Upload + replay ayni worker cagrisi icinde tamamlanir.
4. Sonuc hemen queue item'a yazilir.

Ozellik:

- Basit ve dogrudan.
- Sunucu ile local ag ayni segmentte ise cok hizli olabilir.

## 3.2 Gateway mod (sunucu -> gateway -> cihaz)

Akis:

1. Queue/process `gateway_commands` tablosuna komut yazar.
2. Gateway agent heartbeat ile komutlari alir.
3. Gateway medya/path cozumler, md5 kontrol eder, gerekli upload/replay yapar.
4. Gateway `command-result` endpoint'ine sonucu raporlar.
5. Sunucu queue item/progress'i bu sonuca gore gunceller.

Ozellik:

- Ayrik ag topolojilerinde guvenli ve yonetilebilir.
- Asenkron modelle server worker bloklanmaz.

## 3.3 Temel farklar

1. Direct modda worker cihaz sonucunu aninda alir.
2. Gateway modda worker komutu kuyruga verir, sonuc `command-result` ile sonradan kapanir.
3. Gateway modda md5 skip + media cache + runtime tuning ile tekrarli islerde daha verimli davranir.

## 4. Log Bazli Once/Sonra Olcum (2026-02-13)

Kaynak: `local-gateway-manager/resources/gateway/gateway.log`

### 4.1 Once (batch alma zayif, cihazlar arasi bosluk)

Ornek pencere:

- `16:16:14` komut-1 baslangic
- `16:16:24` komut-2 baslangic
- `16:16:33` komut-3 baslangic

Yorum:

- Komutlar arasi yaklasik `10s` ve `9s` bosluk var.
- Sunucudan komut alinmasi ardiskik heartbeat'lere yayiliyor.

### 4.2 Sonra (batch + async + md5 skip)

Ornek pencere:

- `16:25:11` heartbeat `command_count:3`
- Ayni saniyede 3 komut da calismaya basliyor.
- `upload atlandi (MD5 ayni)` loglari goruluyor.
- Son replay `16:25:12` civarinda tamam.

Yorum:

- Komut alinma gecikmesi pratikte sifira yakinlandi.
- Tekrarli gonderimde network yukleri belirgin azaldi.

### 4.3 Son tur (batch 20 aktif)

Ornek pencere:

- `16:31:00` runtime: `command_batch_size:20`
- `16:31:40` heartbeat `command_count:3`
- Komutlar tek heartbeat'te aliniyor.

Yorum:

- Batch tarafi dogru calisiyor.
- Cihaz icindeki isleme suresi hala toplam sureyi etkileyebilir (ozellikle video olan cihazda).

## 5. Konfigurasyon Ozetleri

Sunucu tarafi:

1. `api/gateway/heartbeat.php`:
   - default `commandBatchSize = 20`
2. `api/gateway/register.php`:
   - yeni gateway config icinde `command_batch_size = 25`

Gateway tarafi:

1. `polling_interval_ms` (default 500)
2. `burst_sleep_ms` (default 80)
3. `server_connect_timeout` (default 5)
4. `enable_media_cache` (default true)
5. `enable_remote_md5_skip` (default true)

Queue davranisi:

1. `gateway_async_queue` -> true ise non-blocking
2. `gateway_wait_for_completion` -> true ise blocking fallback

## 6. Dosya Bazli Degisiklik Listesi

Bu dialogdaki ana degisikliklerin kod dosyalari:

1. `api/render-queue/process.php`
2. `api/gateway/command-result.php`
3. `api/gateway/heartbeat.php`
4. `api/gateway/register.php` (runtime config defaults)
5. `public/assets/js/pages/queue/QueueDashboard.js`
6. `local-gateway-manager/resources/gateway/gateway.php`
7. `local-gateway-manager/resources/gateway/gateway.config.example.json`

## 7. Operasyonel Notlar

1. `401 invalid API key` ve `no such table: gateways` turu hatalar koddan cok deploy/migration/auth sirasi ile ilgilidir.
2. Gateway modunda dogru migration + dogru gateway key olmadan performans tuning etkisi gorunmez.
3. En iyi sonuc icin:
   - gateway daimi acik
   - heartbeat runtime ayarlari aktif
   - md5 skip + media cache acik
   - queue worker paralel/batch ayarlari yuksek

## 8. Sonuc

Bu surecte iki kritik hedef saglandi:

1. Dogruluk: Tasarim + medya gonderimi stabil hale getirildi (path/render/cache zinciri duzeltildi).
2. Hiz: Komutlarin sunucudan cihaza ulasma yolu asenkron ve batch odakli hale getirildi; tekrarli gonderimlerde md5 skip ile sure ciddi azaldi.

