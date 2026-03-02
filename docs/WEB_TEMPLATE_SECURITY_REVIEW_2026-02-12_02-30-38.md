# Web Template Security Review
Tarih: 2026-02-12 02:30:38
Kapsam: `#/web-templates` ve `public/html-editor` entegrasyonu

## Ozet
Bu dokuman, web template/editor entegrasyonu icin yapilan guvenlik incelemesini ve uygulanan duzeltmeleri kaydeder.
Hedef: tenant izolasyonu, yetki kontrolu, CSRF kapsami, XSS yuzeyi ve html-editor yan endpoint guvenligini iyilestirmek.

## Tespit Edilen Kritik Riskler
1. `public/html-editor/save.php` uzerinden auth/tenant by-pass ve varsayilan firmaya yazma riski.
2. `public/html-editor/upload.php` uzerinden anonim ve yetersiz dogrulamali dosya yukleme riski.
3. `public/html-editor/scan.php` uzerinden anonim dizin tarama/bilgi sizdirma riski.
4. `api/web-templates` mutasyon endpointlerinde CSRF middleware eksikligi.
5. `api/web-templates/show.php` atama listesinde tenant filtre eksikligi.
6. Web template liste kartlarinda escape edilmemis alanlar nedeniyle stored XSS riski.
7. Role kontrolunde buyuk/kucuk harf farkina bagli yetki davranisi riski.
8. `public/html-editor/.htaccess` icinde wildcard CORS.

## Uygulanan Duzeltmeler

### 1) Web Templates API guvenlik sertlestirmesi
- `api/index.php`
  - `web-templates` route grubu middleware listesi `['auth', 'csrf']` olacak sekilde guncellendi.

- `api/web-templates/create.php`
  - Role bazli izin kontrolu eklendi.
  - Izinli roller: `superadmin`, `admin`, `manager`, `editor`.

- `api/web-templates/update.php`
  - Role bazli izin kontrolu eklendi.
  - `superadmin` kontrolu case-insensitive hale getirildi.

- `api/web-templates/delete.php`
  - Role bazli izin kontrolu eklendi.
  - `superadmin` kontrolu case-insensitive hale getirildi.

- `api/web-templates/show.php`
  - Cihaz atamalari sorgusuna tenant filtreleme eklendi:
    - Superadmin degilse `devices.company_id = active_company` kosulu uygulanir.

### 2) HTML Editor save endpoint guvenlik sertlestirmesi
- `public/html-editor/save.php`
  - Auth context cikarimi ve zorunlu login kontrolu eklendi.
  - Session kullanimli isteklerde CSRF dogrulamasi eklendi.
  - Varsayilan firmaya dusme (fallback company) kaldirildi.
  - Active company cikarimi superadmin icin `X-Active-Company` destekli ve dogrulamali hale getirildi.
  - Role bazli izin kontrolu eklendi (`superadmin/admin/manager/editor`).
  - Durum kodu yonetimi iyilestirildi (401/403/400/500).
  - Not: `oembedProxy` akisi whitelist ile sinirli oldugu icin public birakildi.

### 3) HTML Editor upload endpoint yeniden yazildi
- `public/html-editor/upload.php`
  - Endpoint sifirdan guvenli modelle yazildi.
  - Zorunlu auth + role kontrolu eklendi.
  - MIME bazli dosya tipi dogrulamasi eklendi.
  - Boyut limiti eklendi (10MB).
  - Yuklemeler company-izole dizine yonlendirildi:
    - `storage/companies/{company_id}/media/images`
  - Guvenli dosya adi uretimi uygulandi.

### 4) HTML Editor scan endpoint yeniden yazildi
- `public/html-editor/scan.php`
  - Endpoint sifirdan guvenli modelle yazildi.
  - Zorunlu auth + role kontrolu eklendi.
  - Sadece company media agaci icinde tarama izni verildi:
    - `storage/companies/{company_id}/media`
  - Path normalizasyonu ve traversal engelleme uygulandi.

### 5) HTML Editor CORS sikilastirmasi
- `public/html-editor/.htaccess`
  - Wildcard CORS headerlari kaldirildi.
  - CORS politikasinin API tarafindaki kontrollu guard uzerinden yonetilmesi benimsendi.

### 6) Builder tarafinda auth header tamamlama
- `public/html-editor/libs/builder/builder.js`
  - `saveReusable`, `rename`, `delete` fetch cagrilarina `Authorization: Bearer <omnex_token>` eklendi.
  - Boylece backendde eklenen auth zorunlulugu ile uyum saglandi.

### 7) Web Template listeleme ekraninda XSS azaltimi
- `public/assets/js/pages/web-templates/WebTemplateList.js`
  - `escapeHtml()` yardimcisi eklendi.
  - Kartta kullanilan `name`, `status`, `type`, `id` escape edilerek render ediliyor.
  - Thumbnail URL icin `sanitizeImageUrl()` eklendi:
    - `javascript:` engelleniyor.
    - Sadece `http(s)://`, `/` ve `data:image/` kabul ediliyor.

## Dogrulama
Asagidaki syntax kontrolleri basariyla tamamlandi:
- `php -l api/index.php`
- `php -l api/web-templates/create.php`
- `php -l api/web-templates/show.php`
- `php -l api/web-templates/update.php`
- `php -l api/web-templates/delete.php`
- `php -l public/html-editor/save.php`
- `php -l public/html-editor/upload.php`
- `php -l public/html-editor/scan.php`
- `node --check public/assets/js/pages/web-templates/WebTemplateList.js`
- `node --check public/html-editor/libs/builder/builder.js`

## Acik Kalan / Sonraki Adimlar
1. `public/html-editor/save.php` altindaki `oembedProxy` icin ek rate-limit ve audit log eklenmesi.
2. `html-editor` akisinin tamamen `/api/web-templates` uzerine alinip legacy `save.php` bagimliliginin azaltilmasi.
3. Template onizleme/yayinlama akisinda CSP + sandbox iframe izolasyonunun standartlastirilmasi.

## Kalan Oneriler (Ek)
1. Tum state-changing API route gruplarina (`POST/PUT/DELETE/PATCH`) `csrf` middleware zorunlu hale getirilmeli; istisnalar net bir whitelist dosyasinda tutulmali.
2. Uzun vadede access token saklama modeli `localStorage` yerine HttpOnly + Secure cookie tabanli hale getirilmeli (XSS sonrasi token sizdirma riskini azaltmak icin).
3. `public/html-editor` altindaki tum endpointler (`save.php`, `upload.php`, `scan.php`) icin merkezi audit log eklenmeli:
   - `action`, `user_id`, `company_id`, `ip`, `user_agent`, `result`, `error`.
4. `public/html-editor` endpointlerine endpoint-bazli rate limit eklenmeli:
   - `save`: dusuk throughput + burst korumasi
   - `upload`: boyut + istek sayisi siniri
   - `scan`: dakika bazli limit
5. Template icerigi kayit edilirken server-side policy kontrolu eklenmeli:
   - yasakli tag/attribute listesi
   - inline event handler bloklama
   - `javascript:` URI bloklama
   - policy ihlalinde versiyon olusturmadan reject
6. Template preview/yayinlama katmaninda zorunlu `iframe sandbox` ve sikilastirilmis CSP profilleri ayrilmali:
   - `preview` CSP
   - `runtime player` CSP
7. `web_templates.js_content` kullanimi icin feature-flag ve rol bazli ayri izin tanimlanmali (ornegin sadece `admin/superadmin`).
8. Guvenlik regresyonu icin otomatik test seti eklenmeli:
   - auth bypass denemeleri
   - tenant cross-access denemeleri
   - XSS payload testleri
   - path traversal testleri
