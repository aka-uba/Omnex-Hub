# Queue System Current State (2026-02-12)

Bu dokuman `#/admin/queue` sayfasinin bugunku (guncel) calisma modelini tek yerde toplar.
Kapsam: queue olusturma, isleme, ileri tarih, retry, analytics, worker ve render/cache iliskisi.

## 1) Kisa Ozet

- Queue sistemi `render_queue` (job) + `render_queue_items` (cihaz bazli item) uzerinden calisir.
- Isleme tetigi frontend tarafinda `QueueDashboard` icinden `POST /api/render-queue/process` ile yapilir.
- Job secimi server tarafinda `RenderQueueService::dequeue()` ile priority + zaman + retry penceresine gore yapilir.
- Her item cihaz bazinda islenir; sonuc `completed/failed/skipped` olur.
- Job sonu `updateQueueProgress()` ile hesaplanir; failed item varsa otomatik `scheduleRetry()` devreye girer.
- Analytics ekrani `GET /api/render-queue/analytics` ile durum, trend, retry ve performans metriklerini gosterir.

## 2) Ana Bilesenler

### Frontend

- `public/assets/js/pages/queue/QueueDashboard.js`
  - Dashboard UI, tablo, refresh dongusu, process tetigi.
  - `ready_to_process` > 0 ise worker dongusunu baslatir.
- `public/assets/js/pages/queue/dashboard/AutoSendWizard.js`
  - Otomatik toplu gonderim sihirbazi.
- `public/assets/js/pages/queue/dashboard/JobStatusTable.js`
  - Job aksiyonlari: retry, cancel, reschedule, delete, bulk islemler.
- `public/assets/js/pages/queue/dashboard/QueueAnalytics.js`
  - KPI ve analitik kartlari.

### API

- `api/render-queue/index.php` -> queue listesi + basit stats
- `api/render-queue/create.php` -> manuel queue olusturma
- `api/render-queue/auto.php` -> otomatik/batch queue olusturma
- `api/render-queue/process.php` -> job isleme motoru (ana runtime)
- `api/render-queue/retry.php` -> failed veya partial-failed retry
- `api/render-queue/reschedule.php` -> ileri tarih / hemen baslat
- `api/render-queue/cancel.php` -> aktif job iptal
- `api/render-queue/delete.php` -> terminal durumdaki job silme
- `api/render-queue/cleanup.php` -> eski job temizligi
- `api/render-queue/analytics.php` -> operasyonel metrikler
- `api/render-queue/status.php` -> tek job detay durumu

### Servisler

- `services/RenderQueueService.php`
  - enqueue/dequeue, item secimi, progress hesaplama, retry/backoff politikasi.
- `services/PavoDisplayGateway.php`
  - cihaza upload/replay/gonderim tarafi.
- `services/RenderCacheService.php`
  - render cache (render_jobs) akisi; queue ile iliskili ama ayri pipeline.

### Opsiyonel CLI worker

- `workers/RenderQueueWorker.php`
  - daemon/once modlari var.
  - Not: web dashboard su an dogrudan `api/render-queue/process.php` tetikleyerek calisir.

## 3) Veri Modeli (Queue)

Kaynak migration: `database/migrations/044_render_queue_system.sql`

### `render_queue`

Temel alanlar:
- Kimlik: `id`, `company_id`
- Is tanimi: `job_type`, `priority`
- Baglam: `template_id`, `product_id`, `device_ids`, `render_params`
- Durum: `status`, `progress`
- Cihaz sayaçlari: `devices_total/completed/failed/skipped`
- Retry: `retry_count`, `max_retries`, `last_retry_at`, `next_retry_at`
- Sonuc/hata: `result`, `error_message`, `failed_devices`
- Zamanlama: `scheduled_at`, `started_at`, `completed_at`
- Audit: `created_by`, `created_at`, `updated_at`

### `render_queue_items`

- `queue_id`, `device_id`
- `status` (`pending/processing/completed/failed/skipped`)
- `retry_count`, `last_error`, `error_type`, `next_retry_at`
- `started_at`, `completed_at`, `duration_ms`, `file_md5`

## 4) Durum Makinesi

### Job seviyesinde

- `pending` -> `processing` -> (`completed` | `failed` | `cancelled`)
- `failed` -> `pending` (scheduleRetry ile, backoff sonrasi)

### Item seviyesinde

- `pending` -> `processing` -> (`completed` | `failed` | `skipped`)
- `failed` -> `pending` (retry planinda)

## 5) Is Akislari

### A) Manuel queue olusturma

1. Frontend cihaz/template/urun secer.
2. `POST /api/render-queue` (`create.php`) cagirilir.
3. API firma cihazi/urunu dogrular.
4. `RenderQueueService::enqueue()` ile job + itemlar yazilir.

### B) Otomatik queue (Wizard)

1. `POST /api/render-queue/auto` cagirilir.
2. `product_ids` veya `products+labels` kabul edilir.
3. Gerekirse `pre_rendered_images` / `cached_images` pathleri alinip joba baglanir.
4. Her urun/label kombinasyonu icin job yaratilir (batch_id ile gruplanir).

### C) Isleme dongusu (`process.php`)

1. `dequeue(company)` ile uygun job secilir:
   - `status='pending'`
   - `scheduled_at <= now` veya null
   - `next_retry_at <= now` veya null
   - priority weight sirasi
2. Job atomik claim ile `processing`e cekilir.
3. `getPendingItems(job, limit=100)` ile cihaz itemlari okunur.
4. Her item atomik claim (`id AND status='pending'`) ile alinir.
5. Cihaz bilgisi cekilir, render/gonderim yapilir.
6. Item `completed` veya `failed` yazilir.
7. `updateQueueProgress()` job durumunu hesaplar.
8. Failed item var ve pending kalmadiysa `scheduleRetry()` ile backoff planlanir.

### D) Retry / Reschedule / Cancel / Delete

- Retry: `POST /api/render-queue/{id}/retry`
  - `failed` ve `completed + failed item` joblari desteklenir.
- Reschedule: `POST /api/render-queue/{id}/reschedule`
  - sadece `pending` job.
  - `scheduled_at=null` ise hemen baslat, `next_retry_at` da temizlenir.
- Cancel: `POST /api/render-queue/{id}/cancel`
  - `completed/cancelled` harici aktif joblar iptal edilir.
- Delete: `POST /api/render-queue/{id}/delete` veya bulk delete
  - sadece terminal (`completed/cancelled/failed`) joblar silinir.

## 6) Analytics ve KPI

Kaynak: `api/render-queue/analytics.php` + `QueueAnalytics.js`

Uretilen ana metrikler:
- queue status dagilimi + `ready_to_process`
- priority analizi
- error type analizi
- performans: avg/min/max completion, per-device ortalama, success rate
- retry analizi: pending retries, distribution, max-retry-reached
- trendler: saatlik/gunluk

Not: Frontend KPI kartlarinda `0` degerlerinin `-` gorunmesi duzeltildi.

## 7) Render/Cache/Worker Iliskisi

- Queue runtime akisi: ana olarak `api/render-queue/process.php`.
- Render cache pipeline: `RenderCacheService` + `render_jobs` + `RenderWorker.js`/`/render-cache/process`.
- Bu iki sistem birbiriyle iliskili olsa da runtime olarak ayri sorumluluklar tasir.

## 8) Son Stabilizasyonlar (Bu Fazda)

- Atomik job claim (`dequeue`) ve atomik item claim (process loop) ile yarismali cift isleme riski azaltildi.
- `next_retry_at` kapilari hem dequeue hem pending item seciminde aktif hale getirildi.
- Progress sonu failed item kaldiginda otomatik retry planlama netlestirildi.
- Retry planinda job terminal alanlari temizlenip itemlar tekrar pendinge alinacak sekilde duzeltildi.
- Queue analytics zaman hesaplari tek zaman referansi ile normalize edildi.
- Dashboard worker baslangici `ready_to_process` bazli hale getirildi.
- Retry aksiyonu partial-failed (completed ama failed itemli) joblar icin acildi.
- Queue tarafinda gecici debug loglari temizlendi.

## 9) Canli Smoke Test Checklist

1. `#/admin/queue` ac -> analytics ve tablo ayni anda doluyor mu?
2. Auto send ile 2-3 urun, 2 cihaz queue olustur.
3. Worker baslat -> process dongusu tamamlanana kadar ilerliyor mu?
4. Bilerek offline cihazla failed item uret -> retry butonu cikiyor mu?
5. Retry tetikle -> `next_retry_at` zamani dolunca job tekrar isleniyor mu?
6. Reschedule ile gelecege at -> zamani gelmeden islenmiyor mu?
7. `scheduled_at=null` yap -> hemen ready_to_process gorunuyor mu?
8. Cleanup -> sadece eski ve uygun kayitlar siliniyor mu?

## 10) Acik Iyilestirme Basliklari (PostgreSQL oncesi)

- Queue ve render-cache pipeline sinirlarini kod ve UI tarafinda daha net ayrimlamak.
- `process.php` icindeki buyuk fonksiyonlarin moduler servis katmanina parcali alinmasi.
- Retry policy ve queue status degisimi icin tekil domain event/log formati olusturulmasi.
- Scheduled/retry tarih alanlarinda tek format standardi (ISO + timezone stratejisi) netlestirilmesi.
- Queue metrikleri icin hafif health endpoint eklenmesi (`lag`, `oldest_pending_age`, `retry_backlog`).

## 11) Referans Dosyalar

- `api/index.php`
- `api/render-queue/create.php`
- `api/render-queue/auto.php`
- `api/render-queue/process.php`
- `api/render-queue/analytics.php`
- `api/render-queue/retry.php`
- `api/render-queue/reschedule.php`
- `api/render-queue/cancel.php`
- `api/render-queue/delete.php`
- `services/RenderQueueService.php`
- `workers/RenderQueueWorker.php`
- `public/assets/js/pages/queue/QueueDashboard.js`
- `public/assets/js/pages/queue/dashboard/JobStatusTable.js`
- `public/assets/js/pages/queue/dashboard/AutoSendWizard.js`
- `public/assets/js/pages/queue/dashboard/QueueAnalytics.js`
- `database/migrations/044_render_queue_system.sql`
