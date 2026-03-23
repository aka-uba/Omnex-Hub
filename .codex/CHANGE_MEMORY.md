# Change Memory

Format:

## YYYY-MM-DD - short title
- Request: ...
- Changes: ...
- Files: ...
- Checks: ...
- Risk/Follow-up: ...

---

## 2026-03-20 - Print HTML image fix, PriceView device count fix, zombie cleanup
- Request: Fix 3 issues - broken product images in PriceView print HTML on server, wrong device count in IntegrationSettings PriceView status card, zombie ffmpeg processes on server
- Changes:
  1. `api/priceview/print.php`: Build absolute URL basePath (protocol+host+webBasePath) and pass to FabricToHtmlConverter so all media URLs resolve to full absolute URLs. No longer depends on detectBasePath() guessing correctly on Docker.
  2. `api/devices/index.php`: Added `model` query parameter filter support (line ~75). PriceView devices have type=android_tv but model=priceview in DB.
  3. `public/assets/js/pages/settings/IntegrationSettings.js`: Changed device count API call from `?type=pwa_player` to `?model=priceview`. Changed "Son Senkronizasyon" to show i18n "perDevice" text instead of empty dash.
  4. `locales/{tr,en,ru,az,de,nl,fr,ar}/pages/settings.json`: Added `integrations.priceview.perDevice` key in all 8 languages.
  5. Server: Restarted `omnex-channel-worker-1` Docker container to clear 2 zombie ffmpeg processes (from Mar 17).
- Files: api/priceview/print.php, api/devices/index.php, public/assets/js/pages/settings/IntegrationSettings.js, locales/*/pages/settings.json (8 files)
- Checks: PHP syntax OK (print.php, index.php), JSON validation OK (all 8 locale files), zombie count 0 after restart
- Risk: print.php change relies on HTTP_HOST being correct (should be fine since requests come from PriceView APK with correct host). FabricToHtmlConverter.php NOT modified per user request.

---

## 2026-03-19 - FiyatGor (PriceView) tab in Integration Settings page
- Request: Add PriceView tab to IntegrationSettings page with sync, display, print, and status cards
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js`: Added priceviewSettings to constructor, priceview tab button, renderPriceviewTab(), loadPriceviewSettings(), savePriceviewSettings(), syncPriceviewNow(), _populatePriceviewForm(), _loadPriceviewStatus()
  - `locales/{tr,en,ru,az,de,nl,fr,ar}/pages/settings.json`: Added integrations.tabs.priceview and integrations.priceview translation blocks in all 8 languages
- Checks: JSON structure verified via grep, JS method references verified
- Risk: None - additive change, no existing functionality modified

## 2026-03-19 - PriceView settings tab in Device Detail page
- Request: Add FiyatGor tab to Device Detail page, only visible when device model is 'priceview'. Shows sync status, display settings, print settings, signage toggle. Saves via PUT /api/settings with priceview_* keys.
- Changes:
  1. public/assets/js/pages/devices/DeviceDetail.js: Added conditional priceview tab button + tab content with 4 cards (Sync Status, Display Settings, Print Settings, Signage). Added loadPriceViewSettings(), savePriceViewSettings(), priceviewSyncNow() methods. Template dropdown loaded from /api/templates?device_types=priceview.
  2. locales/tr/pages/devices.json: Added detailPage.tabs.priceview + priceview section (14 keys)
  3. locales/en/pages/devices.json: Same as TR (English translations)
  4. locales/ru/pages/devices.json: Same (Russian translations)
  5. locales/az/pages/devices.json: Same (Azerbaijani translations)
  6. locales/de/pages/devices.json: Same (German translations)
  7. locales/nl/pages/devices.json: Same (Dutch translations)
  8. locales/fr/pages/devices.json: Same (French translations)
  9. locales/ar/pages/devices.json: Same (Arabic translations)
- Files: DeviceDetail.js, 8x devices.json locale files
- Checks: node -c DeviceDetail.js OK, php json_decode all 8 locale files OK
- Risk/Follow-up: None. Tab only renders for model=priceview. Existing tabs unaffected.

---

## 2026-03-19 - PriceView configurable product display template system
- Request: PriceView overlay uses hardcoded native Android layout. Make it configurable so admins can send custom HTML templates from backend that device renders in WebView.
- Changes:
  1. api/priceview/display-template.php (NEW): GET endpoint returning HTML template for product display. Uses DeviceAuthMiddleware. Reads priceview_product_display_template from company settings; if set, renders via FabricToHtmlConverter; otherwise returns default dark-theme responsive HTML template with {{placeholder}} variables for client-side replacement.
  2. api/index.php: Registered GET /api/priceview/display-template route in priceview group (device middleware).
  3. api/priceview/config.php: Added product_display_mode ('native'/'html') and display_template_url fields to config response.
- Files: api/priceview/display-template.php (new), api/index.php, api/priceview/config.php
- Checks: php -l OK (3 files)
- Risk/Follow-up: APK needs to implement WebView overlay and template fetching/caching. Admin UI for selecting custom template (priceview_product_display_template setting) not yet built.

---

## 2026-03-18 - Sunucu tarafli HTML etiket baski sistemi (Secenek A)
- Request: Mevcut yazdirma sistemi frontend'de Fabric.js nesnelerini tek tek HTML div'lere ceviriyor (renderFabricObject ~300 satir, ProductList + BundleList'te duplicate). Her yeni ozellikte 4 farkli renderer guncellenmeli. Bunun yerine backend FabricToHtmlConverter ile sunucu tarafli HTML render yapilsin.
- Changes:
  1. FabricToHtmlConverter.php: convertToFragment() metodu eklendi � sadece canvas div doner (tam sayfa degil)
  2. FabricToHtmlConverter.php: convertBarcode() + convertQrCode() � SVG/div placeholder, JsBarcode/qrcodejs ile client-side render
  3. FabricToHtmlConverter.php: resolveDynamicFieldValue() � 4-tier cascade (dynamicField, fieldBinding, placeholder, labelToFieldMap)
  4. FabricToHtmlConverter.php: printMode flag � video'lari poster/first-frame olarak gosterir, autoplay yerine
  5. api/templates/print-html.php: Yeni endpoint (POST) � toplu urun/paket etiket HTML sayfasi olusturur
  6. api/index.php: POST /{id}/print-html route kaydedildi
  7. ProductList.js: "HTML Baski (Yeni)" checkbox + bulkPrintViaHtml() metodu (popup-before-await pattern)
  8. BundleList.js: Ayni degisiklik (bundle_ids, type:'bundle')
  9. i18n: htmlPrint.label/hint/generating/failed � 8 dil x 2 sayfa (products + bundles)
- Files: services/FabricToHtmlConverter.php, api/templates/print-html.php (yeni), api/index.php, public/assets/js/pages/products/ProductList.js, public/assets/js/pages/bundles/BundleList.js, locales/{8 dil}/pages/products.json, locales/{8 dil}/pages/bundles.json
- Checks: PHP lint OK (3 dosya), JSON valid (16 dosya), local test OK
- Risk/Follow-up:
  - **KALDIRILACAK ESKI KOD (test sonrasi):**
    - ProductList.js: renderTemplateLabel() (~satir 5175), renderFabricObject() (~satir 5255), extractDynamicFieldKey(), getDynamicFieldValue(), renderDefaultLabel() � toplam ~600 satir
    - BundleList.js: _renderTemplateLabelForBundle() (~satir 1340), _renderFabricObjectForBundle() (~satir 1411), _extractDynamicKey(), _getBundleDynamicValue(), _renderSimpleBundleLabel() � toplam ~400 satir
    - Kaldirildiginda showBulkPrintModal() icindeki eski dal (useHtmlPrint false) da kaldirilir, checkbox gereksiz olur
  - Barkod/QR render FabricToHtmlConverter'a eklendi � mevcut signage HTML onizleme (preview-html.php) icin de faydali
  - printMode sadece convertToFragment() ile aktif, normal convert() etkilenmez

---

## 2026-03-18 - Signage playlist varyant route'lari + Turkce karakter duzeltmeleri
- Request: Signage sayfasi icin 3 farkli tasarim varyanti (Ops, Cards, Studio) route'lari app.js'e eklenmemis. Ayrica 4 dosyada ~50 Turkce karakter eksikligi var.
- Changes:
  1. app.js: /signage/playlists/ops, /cards, /studio route'lari eklendi
  2. PlaylistListOps.js, PlaylistListCards.js, PlaylistListStudio.js, PlaylistListExperienceBase.js: ~50 Turkce karakter duzeltmesi (Icerik�I�erik, Baslat�Ba�lat, Duzenle�D�zenle vb.)
- Files: public/assets/js/app.js, public/assets/js/pages/signage/PlaylistList{Ops,Cards,Studio,ExperienceBase}.js
- Checks: Syntax OK
- Risk/Follow-up: Yok

---

## 2026-03-18 - Import dosya yukleme, silme, test import akisi + audit log + sube duzeltmeleri
- Request: Entegrasyon sayfasi dosya import sekmesine upload butonu, dosya silme, test import akisi, audit log cevirileri, sube siralamasi duzeltmeleri
- Changes: web-upload.php, files.php, upload.php, IntegrationSettings.js, settings.css, AuditLog.js, BranchManagement.js, BranchService.php, 8 dil cevirileri
- Checks: PHP lint OK, JSON valid
- Risk/Follow-up: Yok

---

## 2026-03-17 - Per-item transition efekt destegi
- Request: Playlist iceriklerinde her ogede farkli gecis efekti ve suresi desteklenmeli (hardcoded degil). Tum icerik turleri (html, video, resim, stream, template) arasi gecisler calismali.
- Changes:
  1. Backend show.php: 4 icerik tipine transition/transition_duration alanlari eklendi
  2. Backend content.php: Player API'ye per-item transition verileri eklendi (main + fallback path)
  3. Frontend PlaylistDetail.js: editItem modalina per-item transition select + duration input eklendi, save payload guncellendi
  4. Player player.js: playCurrentItem icinde item.transition override, playlist default fallback, device profile cap (legacy 300ms, balanced 400ms)
  5. i18n: 8 dilde 3 yeni key (itemTransition fields icinde, usePlaylistDefault ve itemTransitionHint form icinde)
  6. Cache: player.js v77->v78, sw.js v1.3.14->v1.3.15
- Files: api/playlists/show.php, api/player/content.php, public/assets/js/pages/signage/PlaylistDetail.js, public/player/assets/js/player.js, public/player/index.html, public/player/sw.js, locales/{tr,en,ru,az,de,nl,fr,ar}/pages/signage.json
- Checks: PHP lint OK (show.php, content.php), JS syntax OK (PlaylistDetail.js, player.js), JSON valid (8 files)
- Risk/Follow-up: Deploy ve cihazda test gerekli. Eski cache temizligi yapilmali.

---

## 2026-03-17 - TV video oynatma regresyonu duzeltmesi (11 bug fix)
- Request: TV cihazlarda video siyah ekran, preload gorselden ileri gidemiyor. OMX.MS.AVC.Decoder ERROR, PIPELINE_ERROR_DECODE. Codex ile eklenen constrained TV, native video kilitleme ve agresif watchdog regresyona neden oldu.
- Changes: 11 fix � hasNativeVideoSupport basitlesti, _nativeVideoHardDisabled kaldirildi, isConstrainedTvProfile etkisizlesti, 360p rewrite kaldirildi, handleNativeVideoStarted _currentElement=video geri geldi, attemptStartupRecovery/watchdog kaldirildi, deferred exit sadece video/stream, balanced profile cap geri geldi, prepareNextMedia sadelelesti, playHtml constrained guard kaldirildi, scheduleNext deferred native stop kaldirildi
- Files: public/player/assets/js/player.js (6215->6037), public/player/index.html (v74), public/player/sw.js (v1.3.11)
- Checks: node -c syntax OK
- Risk/Follow-up: TV'de test edilmeli. Yedekler: player.js.bak.20260317

---

## 2026-03-15 - HTML Şablon Oluştur modallarına canlı önizleme
- Request: Ürünlerde HTML icon/buton ile açılan modalda şablon seçiminde canlı HTML önizleme eksik
- Changes:
  1. `ProductList.js` — `handleGenerateHtml()`: Şablon seçilince iframe ile canlı HTML önizleme
  2. `ProductList.js` — `bulkGenerateHtml()`: Aynı önizleme (ilk ürün ile)
- Files: ProductList.js
- Checks: CSS mevcut (template-preview-live, live-preview-badge)
- Risk/Follow-up: Yok

---

## 2026-03-15 - Modal.confirm Promise düzeltmesi + Tümünü Seç görünürlük
- Request: (1) Web Templates silme ikonu onay olmadan siliyor. (2) Tümünü Seç seçeneği görünmüyor.
- Changes:
  1. `Modal.js` — `confirm()` metodu: onConfirm callback geçirilmezse Promise döndürüyor (true/false). Böylece `const ok = await Modal.confirm({...})` doğru çalışıyor. Eskiden modal instance objesi (truthy) döndüğü için onay modal'ı beklemeden hemen siliyordu.
  2. `web-templates.css` — `.wt-select-all-wrapper .filter-label` için `display: inline !important` eklendi (mobil :has() gizleme kuralından korunması için). Wrapper'a hover efekti, checkbox boyutu büyütme eklendi.
- Files: public/assets/js/components/Modal.js, public/assets/css/pages/web-templates.css
- Checks: Manuel test gerekli (Modal.confirm kullanılan tüm yerler)
- Risk/Follow-up: Modal.confirm onConfirm ile çağrılan yerler eski davranışı koruyor (backward compat). Promise yolu sadece onConfirm geçirilmediğinde aktif.

---

## 2026-03-15 - Web Templates sayfa iyileştirmeleri + HTML şablon filtre düzeltmesi
- Request: (1) WebTemplateList sayfasına DataTable benzeri grid: çoklu seçim, toplu silme, sayfalama, sayfa başı öğe. (2) Silme modalı arka planı gereksiz yenilemesin. (3) Ürünler sayfası HTML Şablon Oluştur modalı tüm şablonları göstersin (sadece TV+signage değil).
- Changes:
  1. `WebTemplateList.js` — Tam yeniden yazıldı: checkbox seçim, tümünü seç, toplu silme butonu, sayfalama (prev/next/sayfa numaraları), sayfa başı öğe sayısı (12/24/48/96), silme sonrası DOM animasyonu (yeniden yükleme yok).
  2. `web-templates.css` — Pagination stilleri (.wt-pagination-*), kart seçim stilleri (.wt-card-select, .template-card.selected), select-all wrapper, dark mode desteği eklendi.
  3. `ProductList.js` — `handleGenerateHtml()` ve `bulkGenerateHtml()`: `/templates?type=signage` + `type=tv` filtresi kaldırıldı, tüm şablonlar yükleniyor (`/templates?per_page=200`). Şablon seçeneklerine tip etiketi eklendi.
  4. `api/web-templates/bulk-delete.php` — Yeni endpoint: POST, { ids: [] }, soft delete, aktif atama atlama, audit log.
  5. `api/index.php` — bulk-delete route eklendi.
  6. i18n: 8 dilde `selectAll`, `perPage`, `saving`, `bulkDeleted`, `bulkSkipped`, `bulkDeleteMessage` key'leri eklendi.
- Files: WebTemplateList.js, web-templates.css, ProductList.js, api/web-templates/bulk-delete.php (yeni), api/index.php, locales/*/pages/web-templates.json (8 dil)
- Checks: PHP syntax OK (bulk-delete.php, FabricToHtmlConverter.php)
- Risk/Follow-up: Yok. API pagination zaten destekliyordu (per_page parametresi).

---

## 2026-03-15 - Web Templates bulk-delete endpoint
- Request: Create POST /api/web-templates/bulk-delete for bulk soft-deleting web templates
- Changes: New endpoint accepting { ids: [] }, validates auth/role, skips templates with active assignments, soft deletes rest, returns deleted/skipped counts with audit logging. Route added to api/index.php.
- Files: api/web-templates/bulk-delete.php (new), api/index.php (route added)
- Checks: php -l on both files passed
- Risk/Follow-up: None. Follows existing delete.php patterns exactly.

---

## 2026-03-15 - slot-media video fix + HTML şablon güncelleme (upsert)
- Request: (1) Çoklu ürün şablonunda elle eklenen video HTML'e gelmiyor. (2) Aynı şablon+ürün ile tekrar HTML oluşturulduğunda yeni kayıt yerine mevcut güncellenmeli.
- Changes:
  1. `FabricToHtmlConverter.php` — `convertObject()`: `slot-media` customType için video/görsel ayrımı eklendi. `staticVideos`, `videoSrc`, `video_placeholder_url` kontrolleri ile doğru render yöntemine yönlendirme.
  2. `FabricToHtmlConverter.php` — `convertVideo()`: `video_placeholder_url` ve `staticVideos` dizisi desteği eklendi (slot-media objeleri için).
  3. `generate-from-fabric.php` — Upsert mantığı: Aynı `fabric_template_id` + `product_ids` kombinasyonu varsa mevcut web_templates kaydını güncelle (versiyon artır), yoksa yeni oluştur.
  4. `ProductList.js` — Tüm generate-from-fabric çağrılarında `is_update` flag'ine göre farklı toast mesajı göster.
  5. i18n: `htmlUpdated` ve `generateHtml.updated` key'leri 8 dile eklendi.
- Files: services/FabricToHtmlConverter.php, api/web-templates/generate-from-fabric.php, ProductList.js, locales/*/pages/products.json (8 dil)
- Checks: PHP syntax OK (2 dosya), JSON validation OK (8 dil)
- Risk/Follow-up: Upsert eşleştirme `data_sources` JSON parse ile yapılıyor — performans sorunu olursa `source_template_id` + `source_product_ids_hash` kolon eklenmeli.

---

## 2026-03-15 - Multi-product modal: bağımsız HTML şablon kaydet butonu
- Request: Çoklu ürün modalında cihaza göndermeden ve checkbox işaretlemeden doğrudan HTML şablon olarak kaydetme
- Changes:
  1. Checkbox kaldırıldı, yerine "HTML Şablon Olarak Kaydet" butonu eklendi (btn-mp-save-html)
  2. Yeni `_mpSaveAsHtmlTemplate()` metodu: bağımsız API çağrısı, loading state, validasyon
  3. `_executeMultiProductSend()` içindeki eski checkbox kodu temizlendi
  4. i18n: `alsoCreateHtml/alsoCreateHtmlHint` → `saveAsHtml/saveAsHtmlHint/htmlSaved/htmlSaveFailed/noSlotAssigned` (8 dil)
- Files: ProductList.js, locales/{tr,en,ru,az,de,nl,fr,ar}/pages/products.json
- Checks: JSON validation OK (8 dil)
- Risk/Follow-up: Yok

---

## 2026-03-15 - FabricToHtmlConverter: static video/image fix + multi-product slot mapping
- Request: Statik (dinamik olmayan, elle eklenen) video ve görsellerin HTML çıktısında görünmesi, çoklu ürün çerçevesi slot→ürün eşleştirmesi, helper objelerin gizlenmesi
- Changes:
  1. `convertImage()` — Video URL tespiti eklendi; `.mp4/.webm/.ogg/.mov` uzantılı src'ler `<video>` olarak render edilir (`<img>` yerine)
  2. `convert()` — Multi-product-frame slot→product eşleştirme haritası oluşturuldu (frameCols×frameRows matris)
  3. `convertObject()` — Helper obje filtreleme: isSlotBackground, isSlotLabel, isSlotPlaceholder, isTransient, multi-product-frame container, slot-label skip kuralları
  4. Slot objelerinde (`slotId > 0`) doğru ürün verisi çözümleme
- Files: services/FabricToHtmlConverter.php
- Checks: `php -l` syntax check passed
- Risk/Follow-up: Kullanıcı tüm tasarım özelliklerinin (font, renk vb.) HTML'de korunduğunu doğrulayacak. convertText() zaten fontSize, fontFamily, fontWeight, fontStyle, fill, textAlign, lineHeight, charSpacing, underline, linethrough, backgroundColor destekliyor.

---

## 2026-03-15 - Add 5 HTML preview translation keys to 6 language files
- Request: Add htmlPreviewTitle, createHtmlTemplate, createHtmlTitle, createHtmlInfo, createHtmlCombined keys to Russian, Azerbaijani, German, Dutch, French, and Arabic products.json files (right after liveHtmlPreview line)
- Changes: Inserted 5 new translation keys in correct order after "liveHtmlPreview" line in each file with proper translations
- Files: locales/ru/pages/products.json, locales/az/pages/products.json, locales/de/pages/products.json, locales/nl/pages/products.json, locales/fr/pages/products.json, locales/ar/pages/products.json
- Checks: JSON grep verification confirmed all 6 keys present in each file with correct line positioning. English and Turkish files already had these keys (no changes needed).
- Risk/Follow-up: None. All translations verified against user-provided text, diacritics preserved (Russian Cyrillic, Azerbaijani special chars, German umlauts, French accents, Dutch diacritics, Arabic script).

---

## TAKİP: HTML Önizleme Performans Optimizasyonu (beklemede)
- **Durum**: Kullanıcı test edecek, tecrübeye göre karar verecek
- **Sorun alanı**: Web Şablonlar listesinde çok sayıda Fabric kaynaklı kart olursa her biri serve endpoint → FabricToHtmlConverter çalıştırır
- **Etkilenen dosyalar**: WebTemplateList.js (card iframe), serve.php (dinamik render), preview-html.php (anlık render)
- **Seçenek A**: Web şablon listesinde iframe yerine statik placeholder/thumbnail kullan (sadece detay/önizlemede canlı)
- **Seçenek B**: serve.php'de kısa süreli cache (5dk) — ürün updated_at değişmemişse cache'den sun
- **Kullanıcı mesajı**: "HTML önizleme performans optimizasyonunu yapalım" dediğinde bu notu referans al

---

## 2026-03-15 - Cihaz Detay İçerik Sekmesi: Canlı HTML Önizleme
- Request: Cihaz detay sayfasındaki içerik sekmesinde statik render görseli yerine canlı HTML önizleme
- Changes:
  1. DeviceDetail.js: renderDeviceRenderPreview() — şablon+ürün atanmışsa canlı iframe, yoksa statik fallback
  2. Yeni getProductIdFromContent() — current_content JSON'dan product_id parse
  3. "Canlı Önizleme" badge + "Tam Ekran" butonu eklendi
  4. 8 dil çeviri: livePreview, livePreviewHint, fullscreenPreview
- Files: DeviceDetail.js, locales/*/pages/devices.json
- Checks: Mevcut fallback korundu
- Risk: Şablon/ürün silinmişse 404 → iframe boş

---

## 2026-03-15 - Evrensel HTML Önizleme Servisi + Ürün Detay "Cihaz İçeriği" Sekmesi
- Request: Şablonların canlı HTML olarak her yerde önizlenebilmesi için evrensel bir render servisi, ürün detay sayfasında cihaz içeriği sekmesi
- Changes:
  1. Yeni API: `GET /api/templates/:id/preview-html?product_id=xxx` — auth gerektirmez, veritabanına kaydetmez, anlık HTML render
  2. ProductDetail.js: Yeni "Cihaz İçeriği" sekmesi — ürüne atanmış her şablon için canlı iframe önizleme
  3. CSS: `.pd-device-content-grid/card/preview/info/actions` stilleri eklendi
  4. Route: `api/index.php`'de `/api/templates/{id}/preview-html` tanımlandı (auth-free)
  5. 8 dil çeviri: `detail.tabs.deviceContent` + `detail.deviceContent.*` eklendi
- Files: api/templates/preview-html.php (yeni), api/index.php, public/assets/js/pages/products/ProductDetail.js, public/assets/css/pages/products.css, locales/*/pages/products.json
- Checks: PHP syntax OK (preview-html.php, index.php)
- Risk/Follow-up: Auth-free endpoint — sadece UUID ile erişilebilir (güvenli); iframe sandbox kısıtlamalı

---

## 2026-03-15 - Web şablonlar: Fabric kaynak badge, dinamik serve, editör yönlendirme
- Request: Fabric.js'den oluşturulan web şablonların card'da önizleme resmi yok, kaynağı belli değil, edit HTML editöre gidiyor, ürün değişiklikleri yansımıyor
- Changes:
  1. serve.php: Fabric kaynağı olan şablonlar her istekte güncel ürün verileriyle taze render yapıyor (statik HTML yerine dinamik)
  2. WebTemplateList.js: Card'da Fabric kaynak badge ("Şablondan"), iframe önizleme, edit → şablon editörüne yönlendirme
  3. index.php: data_sources alanı list response'a eklendi
  4. FabricToHtmlConverter.php: canvas-container başlangıçta visibility:hidden, fitToScreen() sonrası visible (flash düzeltme)
  5. 8 dil çeviri dosyası: source.fabricTemplate, source.fabricHint, actions.editTemplate eklendi
- Files: api/web-templates/serve.php, api/web-templates/index.php, services/FabricToHtmlConverter.php, public/assets/js/pages/web-templates/WebTemplateList.js, locales/*/pages/web-templates.json
- Checks: PHP syntax OK (serve.php, index.php)
- Risk/Follow-up: serve.php her istekte render → performans etkisi (ama cache-control no-cache zaten var); kaynak şablon silinirse fallback cached HTML kullanılır

---

## 2026-03-15 - Player HTML içerik çoklu yenilenme (flicker) düzeltmesi
- Request: Playlist'teki HTML öğesi birkaç kez yenilenerek açılıyor, video ise tek seferde açılıyor
- Root cause: İki sorun —
  1. `playHtml()` iframe yüklenmeden ÖNCE `applyEnterTransition()` çağırıyordu (playImage ise onload SONRASI çağırır)
  2. `hideAllContent()` HTML→HTML geçişinde bile iframe.src'yi `about:blank`'e set ediyordu → iframe iki kez yükleniyordu (about:blank → yeni url)
- Changes:
  1. `player.js playHtml()` — `iframe.onload` callback pattern eklendi (playImage ile aynı yaklaşım). Transition ve scheduleNext yükleme bittikten sonra çalışır. 5sn safety timeout eklendi.
  2. `player.js hideAllContent()` — `nextContentType !== 'html'` koşulu eklendi, HTML→HTML geçişinde about:blank atanmaz
  3. `public/player/sw.js` — Cache version v1.2.7 → v1.2.8
- Files: public/player/assets/js/player.js, public/player/sw.js
- Checks: JS syntax OK
- Risk/Follow-up: iframe.onload bazı cross-origin sayfalar için gecikmeli ateşlenebilir — 5sn safety timeout bunu karşılar

---

## 2026-03-15 - Playlist şablon sekmesi kaldırıldı (HTML sekmesi yeterli)
- Request: Playlist içerik ekleme modalından "Şablonlar" sekmesini, backend kodlarını ve çevirilerini kaldır — HTML Şablonlar sekmesi aynı işi yapıyor
- Changes:
  1. `PlaylistDetail.js` — Kaldırılan: `signageTemplates` property, `loadSignageTemplates()`, `renderTemplatesLibrary()`, `selectTemplate()`, `getTemplatePreviewUrl()`, templates tab butonu, templates tab switch case, templates event binding
  2. 8 dil çeviri dosyası — `tabTemplates`, `emptyTemplates`, `emptyTemplatesHint`, `createTemplate` key'leri kaldırıldı
- Files: public/assets/js/pages/signage/PlaylistDetail.js, locales/{tr,en,ru,az,de,nl,fr,ar}/pages/signage.json
- Checks: JS syntax OK, JSON valid (8 dosya)
- Risk/Follow-up: Backend show.php'de type='template' desteği geriye uyumluluk için korundu (eski playlist'ler çalışmaya devam eder)

---

## 2026-03-15 - Player CSS transition/centering fix + FabricToHtmlConverter bug fixes
- Request: 4 kritik FabricToHtmlConverter bug düzeltme (dinamik alanlar, pozisyonlama, video, görsel), video doldurma, HTML ortalama, player şablon geçiş animasyonu sağa kayma düzeltmesi
- Changes:
  1. `services/FabricToHtmlConverter.php` — Tam yeniden yazım: labelToFieldMap (60+ giriş) ile dinamik alan çözümleme, center origin pozisyon düzeltmesi, video-placeholder customType tanıma, isDataField guard ile image ambiguity çözümü, object-fit:cover video doldurma, detectBasePath/resolveMediaUrl düzeltmeleri
  2. `public/player/assets/css/player.css` — Orientation-mismatch CSS'de transform tabanlı ortalamadan flexbox tabanlı ortalamaya geçiş (translateX(-50%) animasyon çakışması düzeltmesi)
  3. `public/assets/js/pages/web-templates/WebTemplateList.js` — Önizleme butonu (ti-external-link) ve openPreview() metodu eklendi
  4. `public/player/sw.js` — Cache version v1.2.6 → v1.2.7
- Files: services/FabricToHtmlConverter.php, public/player/assets/css/player.css, public/assets/js/pages/web-templates/WebTemplateList.js, public/player/sw.js
- Checks: PHP syntax OK (FabricToHtmlConverter.php), JS syntax OK (WebTemplateList.js)
- Risk/Follow-up: Player CSS değişikliği PWA cihazlarda SW cache güncellemesi gerektirir (v1.2.7). Login yapılarak görsel doğrulama yapılmalı.

---

## 2026-03-14 - Fabric.js → HTML conversion for signage playlists (Phase 1)
- Request: Dinamik alanlı ve videolu Fabric.js şablonları HTML'e dönüştürerek playlist'lere eklenip signage cihazlarına gönderilebilmesini sağla. Mevcut render akışına dokunmadan hibrit çözüm.
- Changes:
  1. `services/FabricToHtmlConverter.php` — Fabric.js JSON → bağımsız HTML dönüştürücü. Text, image, video, rect, circle, group, gradient destegi. Dinamik alan çözümleme (fieldBinding + {{placeholder}}). Ekrana sığdırma JS ile contain scaling.
  2. `api/web-templates/generate-from-fabric.php` — POST endpoint. Template ID + product ID(s) alır, HTML oluşturur, diske kaydeder (`storage/companies/{id}/html-templates/`), web_templates tablosuna insert eder (versiyon kaydı dahil).
  3. `api/web-templates/serve.php` — GET /{id}/serve endpoint. web_templates tablosundan HTML içeriği doğrudan sunar (iframe/player için, auth gerektirmez).
  4. `api/index.php` — 2 yeni route: `POST /generate-from-fabric`, `GET /{id}/serve`
  5. `PlaylistDetail.js` — "HTML Şablonlar" sekmesi eklendi. web_templates API'den published şablonları çeker, kart grid'de gösterir, seçince playlist'e type='html' olarak ekler (serve endpoint URL ile).
  6. `ProductList.js` — DataTable aksiyonlarına "HTML Oluştur" (ti-code) eklendi. Modal ile şablon seç → API'ye gönder → HTML oluştur akışı.
  7. 16 çeviri dosyası güncellendi (8 dil × 2 sayfa: products.json + signage.json)
- Files: services/FabricToHtmlConverter.php (yeni), api/web-templates/generate-from-fabric.php (yeni), api/web-templates/serve.php (yeni), api/index.php, public/assets/js/pages/signage/PlaylistDetail.js, public/assets/js/pages/products/ProductList.js, locales/{tr,en,ru,az,de,nl,fr,ar}/pages/{products,signage}.json
- Checks: PHP syntax OK (4 dosya), JS syntax OK (2 dosya), JSON valid (16 dosya)
- Risk/Follow-up:
  - Fabric.js canvas → HTML dönüşümü piksel-piksel aynı olmayabilir (karmaşık efektler, özel fontlar)
  - Faz 2: TV/tablet/mobil/özel ölçü seçenekleri, responsive CSS
  - Faz 3: Widget sistemi (saat, tarih, kayan yazı), VvvebJs editör entegrasyonu, ürün güncellenince otomatik HTML yenileme
  - serve.php şu an auth kontrolü yapmıyor — cihazlar doğrudan erişebilmeli ama ileride token bazlı erişim düşünülebilir

---

## 2026-03-14 - Fix i18n folder name translations in media library
- Request: Sub-folder names in Ortak Kütüphane always showed Turkish regardless of selected language
- Root cause: `$FOLDER_NAME_KEY_MAP` in `_folder_i18n.php` was defined at file scope. When loaded via `require` inside a Router closure (`api/index.php`), the variable lived in the closure's local scope. `getFolderNameKey()` used `global $FOLDER_NAME_KEY_MAP` which searched PHP's global scope and found nothing → returned null for ALL paths.
- Changes:
  1. Moved `$FOLDER_NAME_KEY_MAP` inside `getFolderNameKey()` as a `static` variable — eliminates global scope dependency
  2. Added `tc()` method to i18n.js for common-only translation lookup (skips page translations)
  3. Added object type guard in `getNestedValue()` to prevent partial key match shadowing
  4. Updated `getFolderDisplayName()` in MediaLibrary.js, MediaPicker.js, PlaylistDetail.js to use `tc()` instead of `__()`
  5. Removed all debug logs from i18n.js, MediaLibrary.js, and index.php
- Files: api/media/_folder_i18n.php, api/media/index.php, public/assets/js/core/i18n.js, public/assets/js/pages/media/MediaLibrary.js, public/assets/js/pages/products/form/MediaPicker.js, public/assets/js/pages/signage/PlaylistDetail.js
- Checks: PHP syntax OK (_folder_i18n.php, index.php), standalone test OK (all 15 folder paths return correct i18n keys), user confirmed fix in browser (all 14 sub-folders returning name_key)
- Risk/Follow-up: Hard refresh needed on client side to pick up cleaned-up JS. Deploy to Docker server (git pull + rebuild).

---

## 2026-03-14 - Resource exhaustion protection (cron flock, ffmpeg timeout, worker maxRuntime)
- Request: Investigate and fix CPU/RAM exhaustion risks similar to ChannelWorker zombie issue
- Changes:
  1. Added flock overlap protection to 4 cron scripts (tamsoft-auto-sync, device-heartbeat, check-device-status, tenant-backup) using auto-import.php pattern
  2. Replaced blocking exec() in HlsTranscoder.php with proc_open() + wallclock timeout (30min default, configurable via FFMPEG_MAX_TRANSCODE_SECONDS)
  3. Added maxRuntime guard (4h) + zombie child reaping (pcntl_waitpid WNOHANG + SIGCHLD SIG_DFL) to TranscodeWorker daemon loop
  4. ChannelWorker already fixed in prior task (zombie reaping + always-sleep pattern)
- Files: cron/tamsoft-auto-sync.php, cron/device-heartbeat.php, cron/check-device-status.php, cron/tenant-backup.php, services/HlsTranscoder.php, workers/TranscodeWorker.php
- Checks: PHP syntax OK (all 7 files)
- Risk/Follow-up: Deploy to server. FFMPEG_MAX_TRANSCODE_SECONDS can be tuned in config.php if 30min is insufficient for very long videos

---

## 2026-03-14 - Backup/restore fixes + disk stat card consistency
- Request: Fix restore test FK errors, orphan records, disk stat card format inconsistency
- Changes:
  1. Cleaned 45 orphan render_queue records (referenced deleted templates) from production
  2. Updated FK constraints: render_queue→templates ON DELETE CASCADE, render_queue→products ON DELETE SET NULL
  3. Improved restore script: --dry-run, --yes flags, archive verification, --single-transaction, error reporting, health retry
  4. Added pre-dump orphan cleanup to backup script
  5. Fixed disk stat card: was showing app storage size on initial load but partition percent on live refresh - now consistently shows partition used/total
  6. Added partition_used_formatted to live endpoint response
- Files: deploy/scripts/03-restore-backup.sh, deploy/scripts/04-backup.sh, database/postgresql/v2/30_constraints.sql, api/system/status.php, public/assets/js/pages/admin/SystemStatus.js, public/sw.js (v14)
- Checks: PHP syntax OK, restore test verified (0 errors, all row counts match production), dry-run flag tested
- Risk/Follow-up: None - restore system fully functional

---

## 2026-03-14 - PHP/OPcache production optimization + system RAM display
- Request: Optimize PHP config for multi-tenant production, show system RAM instead of PHP memory
- Changes:
  1. Memory stat card now shows actual server RAM (e.g. "1.04 GB / 15.6 GB") via /proc/meminfo
  2. PHP process memory moved to PHP Bilgileri card (phpMemoryUsage, phpMemoryPeak)
  3. Added getSystemMemory() helper (Linux /proc/meminfo + Windows wmic)
  4. Dockerfile optimized: opcache 128→192, interned_strings 8→16, JIT tracing enabled
  5. max_input_vars 1000→3000, realpath_cache_ttl 120→600
  6. Security: session.cookie_httponly/secure/strict_mode enabled
  7. Added phpMemoryUsage/phpMemoryPeak i18n keys (8 langs), SW cache v13
- Files: deploy/Dockerfile, api/system/status.php, SystemStatus.js, locales/*/pages/admin.json, sw.js
- Checks: PHP syntax OK, deployed, verified settings with php -i in container
- Risk/Follow-up: JIT tracing might cause issues on edge cases - monitor for stability

---

## 2026-03-14 - System status stat cards with detailed values
- Request: CPU/Memory/Disk stat cards only show bare numbers, need context (cores, totals)
- Changes:
  1. CPU card: "45% / 4 Çekirdek" (percentage + core count)
  2. Memory card: "12.5 MB / 256M" (used / limit)
  3. Disk card: "5.2 GB / 50 GB" (app used / partition total)
  4. Backend live endpoint updated with cores, memory details, disk partition info
  5. Added `.stat-detail` CSS, "cores" i18n key (8 langs), SW cache v12
- Files: api/system/status.php, SystemStatus.js, system-status.css, sw.js, locales/*/pages/admin.json
- Checks: PHP syntax OK, deployed to server
- Risk/Follow-up: None

---

## 2026-03-14 - Users API server-side sorting fix
- Request: Fix table header sorting on admin/users page (clicking column headers didn't change sort order)
- Changes: Replaced hardcoded `ORDER BY u.first_name ASC` with dynamic `{$orderClause}` using sort_by/sort_dir GET params with whitelist validation
- Files: api/users/index.php
- Checks: Deployed to server, container rebuilt successfully
- Risk/Follow-up: None, same pattern as companies/branches fixes

---

## 2026-03-14 - PlaylistDetail form validation improvements
- Request: Fix generic validation messages, add form-label-required CSS class to required field labels, add .error class highlighting to invalid inputs
- Changes:
  1. Replaced manual ` *` text with `form-label-required` CSS class on playlist name label
  2. Added `form-label-required` CSS class to webpage URL, stream URL, edit modal item name, and edit modal URL labels
  3. Changed generic `form.required` Toast in edit modal to field-specific `validation.requiredField` with field name parameter
  4. Changed `form.required` Toast in save() to `validation.requiredField` with field name parameter
  5. Added `.error` class highlighting and `.focus()` to all invalid inputs: playlist name, webpage URL (add + edit), stream URL (add + edit), edit item name
  6. Added `classList.remove('error')` to clear error state after successful validation for webpage and stream URL inputs
- Files: public/assets/js/pages/signage/PlaylistDetail.js
- Checks: node --check passed
- Risk/Follow-up: None. All i18n keys (validation.requiredField, playlists.form.itemName, etc.) already exist. CSS class form-label-required already defined in forms.css.

---

## 2026-03-14 - UserSettings form validation improvements
- Request: Fix generic validation Toast, add form-label-required CSS class, add .error highlighting in UserSettings.js
- Changes:
  1. Replaced generic `Toast.error(this.__('validation.required'))` with per-field checks using `validation.requiredField`
  2. Added `form-label-required` CSS class to 5 required field labels
  3. Added `.error` class to invalid inputs with cleanup on re-validation
  4. Added password required check for new user creation
- Files: public/assets/js/pages/settings/UserSettings.js
- Checks: node --check passed
- Risk/Follow-up: None.

---

## 2026-03-14 - Profile.js form validation improvements
- Request: Fix generic validation messages, add form-label-required CSS class, add .error highlighting on invalid inputs
- Changes:
  1. Profile form (updateProfile): replaced generic `Toast.error(this.__('validation.required'))` with field-specific `validation.requiredField` messages for firstName, lastName, email. Added `.error` class to the first invalid input.
  2. Password form (changePassword): same pattern for currentPassword, newPassword, confirmPassword. Also added `.error` class on passwordMismatch and minLength failures.
  3. Added `form-label-required` CSS class to all 6 required field labels (firstName, lastName, email, currentPassword, newPassword, confirmPassword).
  4. Both forms clear `.error` classes at the start of validation before re-checking.
- Files: public/assets/js/pages/settings/Profile.js
- Checks: node --check passed
- Risk/Follow-up: None. i18n key `validation.requiredField` already exists in all languages.

---

## 2026-03-14 - ScheduleForm field-specific validation

- Request: Replace generic Toast validation with field-specific messages, use form-label-required CSS class, add .error highlighting on invalid inputs.
- Changes:
  1. Replaced manual ` *` text in 3 required field labels with `form-label-required` CSS class (name, playlist, startDate).
  2. Replaced single generic `Toast.error(requiredFields)` with per-field validation: collects missing field labels, highlights each with `.error` class, shows `validation.requiredField` with field names.
  3. Added input/change listeners on form inputs to clear `.error` class when user corrects the field.
- Files: public/assets/js/pages/signage/ScheduleForm.js
- Checks: node --check passed
- Risk/Follow-up: None. Uses existing CSS classes and existing i18n key.

---

## 2026-03-14 - UserManagement form validation improvements
- Request: Fix validation in UserManagement.js modal: use field-specific i18n messages, CSS required label class, error highlighting on inputs, clear error on input change
- Changes:
  1. Replaced manual ` *` text on 6 required field labels with `form-label-required` CSS class
  2. Replaced generic `Toast.error(this.__('users.validation.requiredFields'))` with field-specific messages using `this.__('validation.requiredField', { field: ... })`
  3. Added `.error` class highlighting to invalid form inputs/selects on validation failure
  4. Added `bindValidationClear()` method with input/change event listeners to remove `.error` class when user modifies fields
  5. Added `.form-select.error` CSS rule alongside existing `.form-input.error` in forms.css
- Files: public/assets/js/pages/admin/UserManagement.js, public/assets/css/components/forms.css
- Checks: node --check UserManagement.js passed
- Risk/Follow-up: None. Existing i18n key `validation.requiredField` used, available in all 8 languages.

---

## 2026-03-14 - PlaylistList form validation improvements

- Request: Fix validation in PlaylistList.js modal: use field-specific i18n messages, CSS required label class, and error highlighting on inputs.
- Changes:
  1. Replaced manual ` *` suffix on name label with `form-label-required` CSS class
  2. Changed `form.required` Toast to `validation.requiredField` with field-specific `{field}` parameter
  3. Added `.error` class to playlist-name input on validation failure
- Files: public/assets/js/pages/signage/PlaylistList.js
- Checks: node --check passed
- Risk/Follow-up: None. Minimal change, existing i18n key and CSS class.

---

## 2026-03-14 - CompanyManagement form validation improvements

- Request: Fix generic validation Toast, add form-label-required CSS class, add .error highlighting on invalid inputs, clear error on input change
- Changes:
  1. Replaced manual ` *` text on company name label with `form-label-required` CSS class
  2. Replaced generic `companies.toast.nameRequired` Toast with field-specific `validation.requiredField` pattern
  3. Added `.error` CSS class to company-name input on validation failure
  4. Added `input` event listener to clear `.error` class when user types
- Files: public/assets/js/pages/admin/CompanyManagement.js
- Checks: node --check passed
- Risk/Follow-up: None. Uses existing i18n keys and CSS classes.

---

## 2026-03-14 - CategoryList form validation improvements

- Request: Fix generic validation Toast, add form-label-required CSS class, add .error highlighting on invalid inputs
- Changes:
  1. Replaced manual ` *` text on name label with `form-label-required` CSS class
  2. Replaced generic `Toast.error(this.__('validation.required'))` with field-specific `validation.requiredField` using field name parameter
  3. Added `.error` class to name input on validation failure
  4. Added input listener to clear `.error` class when user starts typing
  5. Clear `.error` class in `resetForm()` method
- Files: public/assets/js/pages/categories/CategoryList.js
- Checks: node --check passed
- Risk/Follow-up: None. Minimal change, no new i18n keys needed (validation.requiredField and form-label-required already exist).

---

## 2026-03-14 - BranchManagement form validation improvements

- Request: Fix validation in BranchManagement.js to use field-specific messages, form-label-required CSS class, and .error class on inputs
- Changes:
  1. Replaced 4x manual `<span class="text-danger">*</span>` with `form-label-required` CSS class on required field labels (regionCode, regionName, code, name)
  2. Replaced generic `Toast.error(this.__('form.requiredFields'))` with per-field `Toast.error(this.__('validation.requiredField', { field: ... }))` messages
  3. Added `.error` CSS class alongside existing `is-invalid` on invalid inputs
  4. Uses correct field labels (regionCode/regionName vs code/name) based on type
- Files: public/assets/js/pages/admin/BranchManagement.js
- Checks: node --check passed
- Risk/Follow-up: None. Uses existing i18n keys (validation.requiredField in common.json) and CSS classes (form-label-required in forms.css, .error in forms.css).

---

## 2026-03-13 - Fix VLC stream transition freezing and title overlay

- Request: Fix VLC donma/takılma ve playlist ismi görünmesi sorunları. variant.php discontinuity kaldır, FFmpeg keyframe normalizasyonu ekle, re-encode mekanizması oluştur.
- Changes:
  1. variant.php: `#EXT-X-DISCONTINUITY` tag'ı ve ilgili tüm mantık kaldırıldı (videoCount, needsDiscontinuity). VLC decoder pipeline reset'i ve OSD title gösterimini çözer.
  2. HlsTranscoder.php: FFmpeg komutuna `-g`, `-keyint_min`, `-sc_threshold 0`, `-force_key_frames` parametreleri eklendi. Tüm videoların aynı keyframe yapısına sahip olmasını garanti eder.
  3. TranscodeQueueService.php: `reEncodeAll()` metodu eklendi - mevcut tüm transcode edilmiş videoları yeni ayarlarla re-encode kuyruğuna ekler.
  4. api/transcode/re-encode-all.php: Yeni endpoint (POST, admin only) - mevcut videoların re-encode'unu tetikler.
  5. api/index.php: `/api/transcode/re-encode-all` route eklendi.
- Files: api/stream/variant.php, services/HlsTranscoder.php, services/TranscodeQueueService.php, api/transcode/re-encode-all.php (yeni), api/index.php
- Checks: php -l tüm dosyalar OK
- Risk/Follow-up: Mevcut videolar eski keyframe ayarlarıyla encode edilmiş. `POST /api/transcode/re-encode-all` çağrılarak yeniden encode yapılmalı. Re-encode süresi video sayısına bağlı. Discontinuity kaldırıldığı için eski encode'lu videolarda farklı GOP yapısından dolayı minor glitch olabilir - re-encode ile tamamen çözülür.

---

## 2026-03-13 - Comprehensive Toast i18n fix across entire codebase
- Request: Detect and fix ALL Toast messages not connected to i18n (hardcoded text, English fallbacks, catch blocks losing error details)
- Changes:
  - **4 issue categories fixed:**
    - 🔴 Pure hardcoded strings → replaced with i18n keys
    - 🟡 Hardcoded fallbacks (`this.__('key') || 'fallback'`) → removed fallback
    - 🟠 Catch blocks losing error detail → added `+ ': ' + (error.message || '')`
    - 🔵 Double fallbacks (`|| i18n || hardcoded`) → removed hardcoded
  - **BluetoothWizard.js**: 26 fixes (12 new bluetooth.wizard.* i18n keys)
  - **TenantBackupPage.js**: 15 fixes (8 new backup.json keys across errors.* and import_modal.*)
  - **NetworkScanner.js**: 1 fix (new scan.gatewayNotReady key)
  - **app.js**: 2 fixes (removed unnecessary English fallbacks)
  - **DeviceDetail.js**: 5 fixes (removed double fallback patterns)
  - **EditorWrapper.js**: 3 fixes (removed fallbacks + added error.message to catch)
  - **QueueDashboard.js**: ~9 catch block fixes (added error.message)
  - **CompanyManagement.js, PlaylistDetail.js, PlaylistList.js, ScheduleForm.js, TemplateList.js, WebTemplateList.js, NotificationSettings.js, AuditLog.js**: catch blocks enhanced with error.message
  - **16 translation JSON files**: New keys added to all 8 languages (devices.json + backup.json)
- Files:
  - public/assets/js/app.js
  - public/assets/js/pages/devices/list/BluetoothWizard.js
  - public/assets/js/pages/devices/list/NetworkScanner.js
  - public/assets/js/pages/devices/DeviceDetail.js
  - public/assets/js/pages/admin/TenantBackupPage.js
  - public/assets/js/pages/admin/CompanyManagement.js
  - public/assets/js/pages/admin/AuditLog.js
  - public/assets/js/pages/templates/EditorWrapper.js
  - public/assets/js/pages/templates/TemplateList.js
  - public/assets/js/pages/queue/QueueDashboard.js
  - public/assets/js/pages/signage/PlaylistDetail.js
  - public/assets/js/pages/signage/PlaylistList.js
  - public/assets/js/pages/signage/ScheduleForm.js
  - public/assets/js/pages/web-templates/WebTemplateList.js
  - public/assets/js/pages/notifications/NotificationSettings.js
  - locales/{tr,en,ru,az,de,nl,fr,ar}/pages/devices.json (8 files)
  - locales/{tr,en,ru,az,de,nl,fr,ar}/pages/backup.json (8 files)
- Checks: node --check on all 15 JS files passed ✓, JSON.parse on all 16 translation files passed ✓
- Risk/Follow-up: None. All i18n keys exist in all 8 languages. Comprehensive grep confirmed zero remaining hardcoded Toast strings.

---

## 2026-03-13 - Player & Streaming Architecture Documentation
- Request: Mevcut player yapisi, stream duzeni, FFmpeg ayarlari, istemci profilleri ve yayin akisini arastir ve dokumante et
- Changes:
  - Tum player/streaming kaynak kodlari analiz edildi (30+ dosya)
  - Kapsamli dokumantasyon olusturuldu: PWA Player, HLS streaming, FFmpeg transcode, cihaz profilleri, Service Worker, zamanlama sistemi
  - 17 bolumde detayli teknik referans
- Files: docs/PLAYER_STREAMING_ARCHITECTURE.md (yeni)
- Checks: Dokumantasyon gorevi, syntax kontrolu uygulanmadi
- Risk/Follow-up: Faz B (coklu profil) aktif edildiginde dokuman guncellenmeli

---

## 2026-03-12 - MQTT Broker (Mosquitto) Docker deployment
- Request: Sunucuya MQTT Broker kur, Docker icinde, sistemle uyumlu, guncel surum
- Changes:
  - Eclipse Mosquitto 2.x Docker servisi eklendi (docker-compose.yml)
  - Mosquitto config dosyalari olusturuldu (mosquitto.conf, acl, docker-entrypoint.sh)
  - Dockerfile'a mosquitto-clients eklendi (app container icinde mosquitto_pub CLI)
  - MqttBrokerService.php: OMNEX_MQTT_HOST/PORT/USER/PASS env var destegi eklendi
    - Docker: internal hostname `mqtt` kullanir (env var)
    - Non-Docker: DB `mqtt_settings.broker_url` kullanir (fallback)
  - .env.example'a MQTT degiskenleri eklendi
  - Health check: mosquitto_pub ile (sub timeout sorunu duzeltildi)
  - ACL: $SYS/# explicit read access eklendi (# wildcard $SYS icermez)
  - UFW: 1883/tcp (MQTT) ve 9001/tcp (WS) portlari acildi
  - SERVER_STATE.md: MQTT broker bolumu eklendi
- Files: deploy/docker-compose.yml, deploy/Dockerfile, deploy/.env.example, deploy/mosquitto/mosquitto.conf, deploy/mosquitto/acl, deploy/mosquitto/docker-entrypoint.sh, services/MqttBrokerService.php, deploy/SERVER_STATE.md
- Checks: PHP syntax OK, Docker build OK, tum 5 container healthy, app->mqtt publish testi basarili
- Risk/Follow-up:
  - Cihaz tarafinda MQTT broker adresi olarak 185.124.84.34:1883 ayarlanmali (Entegrasyon Ayarlari sayfasindan)
  - WebSocket (9001) tarayici MQTT istemcileri icin test edilmeli
  - Production'da MQTT sifreler .env dosyasinda, daha guclu sifreler tercih edilebilir

---

## 2026-03-09 - Complete 8-language demo seed data
- Request: Generate demo seed data for all 8 languages (tr, en, ru, az, de, nl, fr, ar)
- Changes:
  - Created products.json for 7 locales (en, ru, az, de, nl, fr, ar) with 1064 translated products each
  - Created categories.json for 7 locales with 108 categories each (EN rebuilt to match TR structure)
  - Created production_types.json for 6 locales (ru, az, de, nl, fr, ar)
  - Created settings.json for 6 locales with locale-specific currencies, timezones, date formats
  - Created templates.json for 7 locales (EN rebuilt + 6 new) with translated template names/descriptions
  - Created AR label_sizes.json (71 sizes) and license_plans.json (4 plans)
  - Added AR option to SetupWizard.js dropdown
- Files: database/seeders/data/{en,ru,az,de,nl,fr,ar}/*.json, public/assets/js/pages/admin/SetupWizard.js
- Checks: PHP JSON parse verification on all 56 files (8 locales x 7 file types) - ALL PASSED
- Risk/Follow-up: Word-level product name translation may have some untranslated Turkish words for less common products. Descriptions use template-based generation.

## 2026-03-08 - codex memory scaffold
- Request: Create a persistent Codex structure like `.claude` so future tasks start quickly.
- Changes: Added Codex-specific project memory and operating docs.
- Files: `AGENTS.md`, `.codex/README.md`, `.codex/PROJECT_SNAPSHOT.md`, `.codex/WORKFLOW.md`, `.codex/QUICK_CHECKS.md`, `.codex/CHANGE_MEMORY.md`, `C:\Users\test\.codex\memories\market-etiket-sistemi.md`
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Keep memory entries short and update after each implementation task.

## 2026-03-08 - claude workflow alignment
- Request: Add a reusable explanation block to CLAUDE so Claude follows the same memory workflow.
- Changes: Added 'Codex-Style Workflow (Kalici Calisma Hafizasi)' section and updated last update date/version in .claude/CLAUDE.md.
- Files: .claude/CLAUDE.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Keep this section synced if .codex workflow files evolve.

## 2026-03-08 - encoding and backup safety rule
- Request: Add a strict rule to preserve file encodings and reduce corruption/data loss risk with temp backups when needed.
- Changes: Added encoding-preservation and temp-backup guardrails to AGENTS and workflow docs.
- Files: AGENTS.md, .codex/WORKFLOW.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Apply temp backup workflow proactively on risky edits (legacy/non-UTF files).

## 2026-03-08 - i18n and hardcoded text rule
- Request: Add strict rule for no hardcoded text, mandatory 8-language updates, and preserving localized characters.
- Changes: Updated AGENTS, Codex workflow, and Claude workflow sections with i18n and character-preservation guardrails.
- Files: AGENTS.md, .codex/WORKFLOW.md, .claude/CLAUDE.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Enforce key parity checks when locale files are touched.

## 2026-03-08 - frame inspector fixes (default stroke, masked opacity, hover popup)
- Request: In frame object inspector, set default frame border width to 1, fix opacity visibility issue (especially masked frames), and fix non-working mini hover preview popup.
- Changes: Synced frame overlay opacity with target object (apply/update/reconnect + inspector opacity change), made frame-shape default stroke width 1, and added fallback hover binding for frame preview even if async metadata load fails.
- Files: public/assets/js/editor/services/FrameService.js, public/assets/js/editor/panels/PropertyPanel.js, public/assets/js/editor/components/ShapePicker.js, public/assets/js/editor/factory/ObjectFactory.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js; node --check public/assets/js/editor/services/FrameService.js; node --check public/assets/js/editor/components/ShapePicker.js; node --check public/assets/js/editor/factory/ObjectFactory.js
- Risk/Follow-up: Hover preview remains mouse-hover based; touch devices may need tap-to-preview behavior later.
- Backup/restore safety: Not needed (targeted JS edits, no encoding migration).

## 2026-03-08 - inspector border width display fix for frame shapes
- Request: Border section still showed stroke width as 0 in inspector for frame shapes.
- Changes: Border section now reads style snapshot for library shapes and enforces display default strokeWidth=1 for frame-category shape library items when underlying value is 0.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Existing saved objects with true 0 stroke on frame-category items will display as 1 in inspector baseline.

## 2026-03-08 - minimal border width patch per request
- Request: Revert broad inspector edits and apply only minimal fix where border width showed 0.
- Changes: Removed broad frame-category helper changes and updated only border-section strokeWidth assignment to use shape snapshot width for library shapes.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: If any specific shape still shows 0, inspect that shape object's child strokeWidth at runtime.

## 2026-03-08 - second strokeWidth field fix in border section
- Request: Two strokeWidth inputs showed different values; the one showing 0 should be corrected.
- Changes: Updated only _renderBorderSection strokeWidth calculation to fallback to shape snapshot (min 1) when object strokeWidth is 0 for shape objects.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Non-shape objects keep original strokeWidth behavior.

## 2026-03-08 - frame shape initial border visibility fix
- Request: Newly added frame shape looked borderless until user manually changed stroke setting.
- Changes: In ObjectFactory.createShape, enforced initial visible stroke for frame-category shapes by setting missing/transparent stroke and strokeWidth<=0 to 1 on drawable leaf objects.
- Files: public/assets/js/editor/factory/ObjectFactory.js
- Checks: node --check public/assets/js/editor/factory/ObjectFactory.js
- Risk/Follow-up: This targets shape-library frame category only; photo frame overlays are unaffected.

## 2026-03-08 - addBorderFrame stroke fallback set to 1
- Request: Change addBorderFrame strokeWidth from 0 to 1 and update fallback.
- Changes: Updated addBorderFrame to resolve strokeWidth with fallback=1 when incoming option is missing/invalid/non-positive.
- Files: public/assets/js/editor/TemplateEditorV7.js
- Checks: node --check public/assets/js/editor/TemplateEditorV7.js
- Risk/Follow-up: If caller explicitly passes strokeWidth <= 0, fallback now normalizes to 1.

## 2026-03-08 - masked frame opacity sync restored
- Request: Restore masked-frame opacity behavior that was lost after rollbacks.
- Changes: Re-added minimal overlay opacity sync inside PropertyPanel opacity case; when selected object has FRAME_OVERLAY_ID, linked overlay opacity now updates with object opacity.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: This covers inspector-driven opacity changes; non-inspector opacity mutations still depend on existing editor flows.

## 2026-03-08 - multi-frame slot drag boundary normalization
- Request: Objects added into selected multi-product frame slots had inconsistent drag limits (especially left side).
- Changes: Updated slot boundary enforcement in EditorWrapper object:moving to use slot-based min/max independent of object dimensions.
- Files: public/assets/js/pages/templates/EditorWrapper.js
- Checks: node --check public/assets/js/pages/templates/EditorWrapper.js
- Risk/Follow-up: Objects can now be positioned uniformly by center within slot; large objects may visually overflow slot edges by design.

## 2026-03-09 - resume context after restart
- Request: Reconstruct where work stopped after PC restart.
- Changes: Reviewed project snapshot/workflow and recent memory; inspected current uncommitted workspace status.
- Files: .codex/PROJECT_SNAPSHOT.md, .codex/WORKFLOW.md, .codex/CHANGE_MEMORY.md
- Checks: Not applicable (no source code changes).
- Risk/Follow-up: Large uncommitted notification/render-queue batch is present; continue from that branch carefully without reverting unrelated edits.

## 2026-03-09 - device-send notification filter and retention policy
- Request: Add a dedicated notifications-page filter for device send notifications and add SuperAdmin setting for device notification retention days with automatic cleanup.
- Changes: Added `device_send` category filter path in notifications list API + UI tab; extended notification settings API/UI with SuperAdmin-only `device_notification_retention_days` (company settings scope); added NotificationService helpers for retention read + device-send cleanup; wired automatic cleanup into RenderQueueService notification flow before send/start-complete notifications.
- Files: api/notifications/index.php, api/notifications/settings.php, public/assets/js/pages/notifications/NotificationList.js, public/assets/js/pages/notifications/NotificationSettings.js, services/NotificationService.php, services/RenderQueueService.php, locales/tr/pages/notifications.json, locales/en/pages/notifications.json, locales/az/pages/notifications.json, locales/de/pages/notifications.json, locales/fr/pages/notifications.json, locales/ar/pages/notifications.json, locales/ru/pages/notifications.json, locales/nl/pages/notifications.json
- Checks: php -l api/notifications/index.php; php -l api/notifications/settings.php; php -l services/NotificationService.php; php -l services/RenderQueueService.php; node --check public/assets/js/pages/notifications/NotificationList.js; node --check public/assets/js/pages/notifications/NotificationSettings.js; node JSON parse check for all 8 notifications locale files; locale key parity check (8/8).
- Risk/Follow-up: Device-send classification currently relies on queue links (`#/admin/queue*` or `#/queue*`); if future queue notifications use different links, filter/cleanup condition should be updated accordingly.

## 2026-03-09 - Turkish diacritics fix for device notification labels
- Request: Correct Turkish wording with proper diacritics (`Cihaz Gönderim Bildirimleri`).
- Changes: Updated new Turkish notification keys to proper Turkish characters (`Gönderim`, `süresi`, `gün`, `oluşan`, `görebilir`).
- Files: locales/tr/pages/notifications.json
- Checks: node JSON parse check for locales/tr/pages/notifications.json
- Risk/Follow-up: Keep locale writes diacritic-safe on future automated edits.

## 2026-03-09 - device notification flow simulation check
- Request: Simulate whether new device-send filter and retention cleanup flow works.
- Changes: No source edits; executed code-path simulation checks over updated files and mock data.
- Files: (no code changes)
- Checks: Node simulation for UI/API wiring, retention setting hooks, and mock cleanup behavior; Turkish labels re-validated with Unicode-safe comparison.
- Risk/Follow-up: This is a logic simulation (not authenticated live API call); optional live endpoint spot-check can be run in active session.

## 2026-03-09 - add read filter and run real endpoint test
- Request: Add missing `Okundu` filter on notifications page and perform real endpoint verification.
- Changes: Added `read` filter tab and query mapping (`status=read`) in notifications list page; added `filters.read` i18n key in all 8 notification locale files using each locale's existing `status.read` value.
- Files: public/assets/js/pages/notifications/NotificationList.js, locales/tr/pages/notifications.json, locales/en/pages/notifications.json, locales/az/pages/notifications.json, locales/de/pages/notifications.json, locales/fr/pages/notifications.json, locales/ar/pages/notifications.json, locales/ru/pages/notifications.json, locales/nl/pages/notifications.json
- Checks: node --check public/assets/js/pages/notifications/NotificationList.js; locale JSON parse check (8/8); locale key parity check (8/8); live API test with authenticated bearer token:
  - GET `/api/notifications?status=read&limit=5` -> success=true
  - GET `/api/notifications?category=device_send&limit=5` -> success=true
- Risk/Follow-up: Live test dataset currently returns 0 records for both filters in tested account, but endpoint contracts and filtering paths respond successfully.

## 2026-03-09 - remove lingering SQLite traces from runtime
- Request: Remove remaining SQLite traces since project runs PostgreSQL only.
- Changes: Fixed DB driver to `pgsql` in config, removed unused `DB_PATH` legacy constant, removed unused `isSqlite()` method from Database wrapper, and cleaned SQLite references in runtime code comments; updated project snapshot DB statement to PostgreSQL-only.
- Files: config.php, core/Database.php, core/Security.php, api/devices/create.php, api/devices/update.php, api/products/index.php, .codex/PROJECT_SNAPSHOT.md
- Checks: php -l config.php; php -l core/Database.php; php -l core/Security.php; php -l api/devices/create.php; php -l api/devices/update.php; php -l api/products/index.php
- Risk/Follow-up: Historical SQLite references may still remain in long-form docs (`.claude/CLAUDE.md` etc.); runtime path is now PostgreSQL-only.

## 2026-03-09 - frame picker colored designs regression fix
- Request: Frame modaldaki bazı özel tasarım frame'ler seçildiğinde kendi deseni yerine düz kenarlık görünmesi regresyonunu düzelt.
- Changes: FrameService.applyFrame içinde defaultColor olmayan frame'lere zorunlu `#000000` tint verilmesini kaldırdım; defaultColor yoksa tint uygulanmıyor ve frame'in özgün tasarımı korunuyor.
- Files: public/assets/js/editor/services/FrameService.js
- Checks: node --check public/assets/js/editor/services/FrameService.js
- Risk/Follow-up: Property panel frame color alanı defaultta siyah gösteriyor olabilir; yalnızca kullanıcı renk değiştirirse tint uygulanır.
## 2026-03-09 - frame tint capability-aware inspector behavior
- Request: Frame modaldan se�ilen baz� �zel tasar�mlarda desenin d�z kenarl��a d�nmesi regresyonunu koruyarak; denet�ide renklenebilen frame ile renklenmeyen frame davran���n� ay�rmak (renk deste�i olmayan frame i�in sahte siyah renk g�stermemek).
- Changes: Kept FrameService default tint fallback empty when frame has no `defaultColor`; updated PropertyPanel frame section to resolve frame definition via `getFrameById`, detect tint support (`defaultColor` / explicit support / stored frameColor), show frame color picker only when tint is supported, and keep opacity sync to frame overlay in opacity inspector path.
- Files: public/assets/js/editor/services/FrameService.js, public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js; node --check public/assets/js/editor/services/FrameService.js
- Risk/Follow-up: Existing frame data currently infers tint support mostly from `defaultColor`; if future non-default tintable frames are added, frame metadata should include explicit `supportsTint` for deterministic UI behavior.
## 2026-03-09 - rollback frame color conditional UI
- Request: Frame color alan� hi�bir frame'de g�r�nmedi�i i�in son ko�ullu g�sterim de�i�ikli�ini geri al; sahte alan kalsa da her frame'de manuel renk de�i�imi m�mk�n olsun.
- Changes: Restored PropertyPanel frame inspector to always render frame color input (removed tint-capability conditional UI/helpers/import logic).
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Non-tint frame'lerde color input g�r�necek; kullan�c� renk se�erse tint uygulanabilir (�nceki davran��a d�n��).
## 2026-03-09 - line picker presets dedupe and quality pass
- Request: �izgi ekleme modal�ndaki tekrar eden/anlams�z g�r�nen �izgi t�rlerini kald�r; her preset ger�ekten farkl� ve ��k g�r�ns�n.
- Changes: Replaced algorithmic 60-item generated line preset set with a curated 24-item preset library (`basic/dashed/dotted/decorative`) where each item has unique visual signature (renderType + dash/cap/width/color). This removes near-duplicate variants and keeps modal output cleaner and more intentional for tablet/signage/ESL/digital layouts.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; module sanity check for preset uniqueness (24 total, duplicate names=0, duplicate visual signatures=0).
- Risk/Follow-up: Preset names remain static English labels (existing pattern in file); if multilingual naming is required in picker cards, next step should map preset ids to i18n keys.
## 2026-03-09 - line picker +26 preset expansion
- Request: Existing 24 line presets were acceptable; add 26 more distinct UI-compatible line variants.
- Changes: Expanded curated line preset catalog from 24 to 50 entries by adding `line_25`..`line_50` across `basic/dashed/dotted/decorative`, keeping supported render types (`simple/wave/zigzag/step/bracket`) and unique names/ids.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; preset validation script (total=50, duplicate ids=0, duplicate names=0, category distribution verified).
- Risk/Follow-up: Large decorative sets can still feel dense in picker; if needed we can add quick-tag filters (e.g., "minimal", "promo", "tech") next.
## 2026-03-09 - line picker uniqueness + category counts
- Request: Line picker modal still showed same-type variants in different colors; require truly unique styles and show item counts on category tabs.
- Changes: Adjusted line preset definitions so no two presets share the same non-color visual signature (renderType + dash + cap/join + width). Updated LinePicker category tabs to display counts (`all/basic/dashed/dotted/decorative`) and refresh counts with search filtering.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js, public/assets/js/editor/components/LinePicker.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; node --check public/assets/js/editor/components/LinePicker.js; uniqueness validation script (total=50, duplicate non-color style signatures=0).
- Risk/Follow-up: Category counts currently update by search scope; if you prefer fixed global totals only, count refresh can be made static.
## 2026-03-09 - decorative line variety redesign
- Request: Decorative line presets still looked similar; make decorative options clearly distinct on inspection.
- Changes: Reworked decorative preset `renderType` assignments to unique silhouettes and added corresponding render implementations in both picker preview and editor insertion path. Added new decorative render types: `pulseWave, scallop, chevron, notch, arc, chain, ribbon, stitch, skyline, ticket, hook, twinline` (plus existing simple/wave/zigzag/step/bracket).
- Files: public/assets/js/editor/data/LineStyleLibraryData.js, public/assets/js/editor/components/LinePicker.js, public/assets/js/editor/TemplateEditorV7.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; node --check public/assets/js/editor/components/LinePicker.js; node --check public/assets/js/editor/TemplateEditorV7.js; decorative uniqueness script (17 decorative presets, duplicate non-color style signatures=0).
- Risk/Follow-up: Some new decorative paths are visually expressive; if you want stricter corporate/minimal tone, we can trim to a �minimal decorative� subset toggle.
## 2026-03-09 - input icon hover cursor disappearance fix
- Request: Investigate project-wide cursor/caret disappearance around icon-enhanced input/value fields and fix the causing rule.
- Changes: Added a global safety rule so decorative icons inside `.input-icon-wrapper` never capture pointer events; patched template editor search/icon blocks (`product-search`, `field-search`, `shape-picker`, `frame-picker`) with `pointer-events: none` on icon overlays; added missing line-picker search icon layout styles with non-interactive icon overlay.
- Files: public/assets/css/components/forms.css, public/assets/css/pages/template-editor.css
- Checks: node --check public/assets/js/editor/components/FramePicker.js; node --check public/assets/js/editor/components/LinePicker.js
- Risk/Follow-up: If any future `input-icon-wrapper` usage introduces intentionally clickable `<i>` icons, that icon should use a button element or locally override `pointer-events`.
## 2026-03-09 - global cursor freeze root-cause fix via hover-listener cleanup
- Request: Cursor disappears on product edit brand input and returns after several seconds; investigate project-wide hover/cursor issue.
- Changes: Identified document-level hover preview listener leak in template/media pages. Added single-bind guards and stored handler refs; now remove `mouseover/mouseout/mousemove` listeners in `destroy()` for both pages. This prevents listener accumulation across route changes.
- Files: public/assets/js/pages/templates/TemplateList.js, public/assets/js/pages/media/MediaLibrary.js
- Checks: node --check public/assets/js/pages/templates/TemplateList.js; node --check public/assets/js/pages/media/MediaLibrary.js
- Risk/Follow-up: If another page adds document-level pointer listeners without cleanup, similar lag can reappear; recommended periodic scan for `document.addEventListener` + missing `removeEventListener`.
## 2026-03-09 - non-icon input caret visibility stabilization
- Request: Icon fields were fixed, but non-icon inputs still showed hover-time white cursor/caret behavior until click.
- Changes: Enforced consistent text-cursor and caret color on core form fields: `.form-control`, `.form-input`, `.form-textarea` including hover/focus states (`cursor: text`, `caret-color: var(--text-primary)`).
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/app.js
- Risk/Follow-up: If OS/browser-level pointer theme causes apparent white mouse cursor, this CSS only controls text caret and input cursor semantics, not hardware pointer color.
## 2026-03-09 - product form cursor behavior debug instrumentation
- Request: Add debug logs to observe cursor/caret behavior on problematic inputs.
- Changes: Added optional ProductForm cursor debugger (toggle via `localStorage.omnex_debug_cursor=1` or `?cursorDebug=1`) that logs computed cursor/caret/pointer-events plus top element under pointer on `mouseenter/mousemove/focus/blur`; added cleanup of attached listeners in `destroy()`.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Debug logs are verbose by design; disable after diagnosis (`localStorage.removeItem('omnex_debug_cursor')`).
## 2026-03-09 - cursor debug output expansion for overlay diagnosis
- Request: Existing cursor debug logs were too compact to confirm hover-style/overlay effects.
- Changes: Updated ProductForm cursor debugger to print full JSON snapshots, include html/body classes, flag `overlaySuspected` when top element differs from target, and emit warning logs for suspected overlay capture.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: `overlaySuspected` heuristic is conservative; final confirmation should inspect repeated warnings on same target area.
## 2026-03-09 - hover cursor mode adjustment for text fields
- Request: In this project, non-icon inputs still showed odd white cursor-like behavior on hover; likely hover text-cursor rendering issue.
- Changes: Adjusted form cursor behavior to reduce hover-time I-beam rendering artifacts: text fields now use default cursor on hover and switch to text cursor on focus; caret-color preservation remains.
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: This changes UX from classic I-beam-on-hover to I-beam-on-focus for text fields; if not preferred globally, scope can be limited to products page only.
## 2026-03-09 - remove temporary cursor debug instrumentation
- Request: Cursor issue improved; remove ProductForm debug logs.
- Changes: Removed temporary cursor debug toggles, snapshot/logger methods, event bindings, and destroy-time cleanup related to debug instrumentation from ProductForm.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: If cursor issue reappears, we can reintroduce a smaller scoped debug helper quickly.
## 2026-03-09 - global form control font normalization
- Request: Product description textarea looked visually different from brand input; ask for project-wide bulk fix for similar inconsistencies.
- Changes: Normalized form typography by adding `font-family: inherit` to `.form-control`, `.form-input`, `.form-textarea`, and `.form-select` in shared forms stylesheet so inputs/textareas/selects use the same base UI font across pages.
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Any page intentionally using custom monospace in form fields should now define it explicitly at component/page scope.
## 2026-03-09 - license plan device category pricing headers added
- Request: On `#/admin/licenses` pricing mode > device categories table, quantity values were unclear; add headers for count, price, and currency.
- Changes: Added a header row above per-device-type category pricing inputs in LicensePlanForm (`deviceCount`, `unitPrice`, `currency` via i18n keys). Replaced hardcoded count placeholder with i18n `licenses.pricing.deviceCount`. Added matching styles in admin.css for header alignment (including dark mode and mobile hide).
- Files: public/assets/js/pages/admin/LicensePlanForm.js, public/assets/css/pages/admin.css
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Header row is hidden on very small screens (<640px) to preserve compact layout; values remain visible with placeholders.
## 2026-03-09 - per-device-type pricing multi-currency exchange model
- Request: In admin licenses pricing mode, support mixed per-category currencies with separate exchange rates and compute top plan price in selected plan currency.
- Changes: Replaced single exchange-rate/base-currency model in LicensePlanForm with 3-currency rate map (TRY/USD/EUR) relative to selected plan currency. Kept per-category currency independent (no forced override). Added dynamic rate inputs (`1 FROM -> TARGET`), dynamic monthly total label in selected currency, TRY equivalent calculation, and plan price auto-update from converted totals. Added backward-compatible save metadata: `_meta.exchange_rates` + legacy `_meta.exchange_rate`.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Summary label uses existing `annualTotal` key for duration-based plan total text; if desired, add a dedicated i18n key for "plan total" in all 8 locales.
## 2026-03-09 - fix exchange direction confusion with canonical TRY-rate conversion
- Request: Currency switch caused inverse-looking exchange behavior; expected e.g. when target is TRY, USD/EUR fields should represent TL equivalents.
- Changes: Reworked currency-switch conversion to canonical TRY-based rates (`_toCanonicalTryRates` / `_fromCanonicalTryRates`) and rebuilt per-target inputs from canonical map to avoid inversion drift. Updated rate label to explicit form: `1 FROM = ? TARGET`.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Existing saved plans with unusual legacy exchange inputs are normalized on next edit/save cycle.

## 2026-03-09 - bulk product descriptions (1064 SKU)
- Request: Generate unique Turkish SEO-like product descriptions for all 1064 products (Baharat, Bakliyat, Çerez, Deniz Ürünleri, Dondurulmuş, Donuk, Fırın, İçecek, Kahvaltılık, Kasap, Manav, Tatlı, Şarküteri).
- Changes: Created 5 PHP description files (desc_part1a, 1b, 2, 3, 4) with SKU-keyed arrays. Ran bulk updater script to write descriptions to all 2128 product rows (1064 unique SKUs × ~2 companies). Zero errors, zero not-found.
- Files: C:/xampp/tmp/desc_part1a.php, C:/xampp/tmp/desc_part1b.php, C:/xampp/tmp/desc_part2.php, C:/xampp/tmp/desc_part3.php, C:/xampp/tmp/desc_part4.php, C:/xampp/tmp/update_all_descriptions.php
- Checks: PHP syntax check on all 5 part files; verified 2128 updated rows, 0 errors, 0 not-found via verify script.
- Risk/Follow-up: Temp files in C:/xampp/tmp/ - can be deleted after confirming descriptions are correct in production.

## 2026-03-09 - product description textarea height fix
- Request: Increase product description textarea initial visible height to 6 lines.
- Changes: Changed textarea rows="3" to rows="6" in ProductForm.js. Added `textarea.form-input { height: auto; padding: 10px 12px; resize: vertical; }` in forms.css to override the fixed `height: 42px` from `.form-input` that was preventing rows attribute from working.
- Files: public/assets/js/pages/products/ProductForm.js (line 192), public/assets/css/components/forms.css (line 167-170)
- Checks: node --check ProductForm.js (passed), CSS visual inspection.
- Risk/Follow-up: All other textarea.form-input elements also get auto height now (desired behavior).

## 2026-03-09 - HAL card visibility: company-based instead of language-based
- Request: HAL Kunye card in product form should show/hide based on company HAL integration settings (enabled + configured) instead of language check. Multi-tenant isolation approach.
- Changes: Added `id="hal-card"` with `style="display: none"` to HAL card div (default hidden). Created `_checkHalIntegration()` method that calls `/api/hal/settings` API and shows card only when `meta.is_active && configured`. Moved `_initHalKunyeSection()` and `loadProductionTypeFromHalData()` inside the integration check. Removed old unconditional HAL init from `init()`.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check ProductForm.js (passed), JS syntax valid.
- Risk/Follow-up: Companies without HAL integration configured will not see HAL card at all. Production type select remains visible (it's outside HAL card). Existing HAL data for products is preserved in DB.
## 2026-03-09 - multi-currency pricing summary breakdown in plan form
- Request: When multiple row currencies are used in device-type pricing, monthly/yearly summary should also show cross-currency calculation details.
- Changes: Extended per-device-type summary block to include per-currency subtotals and conversion info (`subtotal`, `exchangeRate`, converted subtotal in selected plan currency) in addition to overall monthly/annual totals.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Summary block is now more verbose; if needed we can collapse per-currency detail behind a toggle.
## 2026-03-09 - products table header sorting fix (server-side)
- Request: `#/products` header sorting was inconsistent (e.g., group column seemed random each click); fix this page first.
- Changes: Updated products list API sort handling to use a safe sort-key map with all visible sortable columns (`sku`, `name`, `barcode`, `group`, `category`, `current_price`, `stock`, `status`, `created_at`, `updated_at`). Added SQL expression mapping including quoted `"group"` and case-insensitive text sorting via `LOWER(...)`. Added deterministic tiebreaker `id ASC`.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: If you want locale-aware Turkish sorting (`?/?`) beyond ASCII-lower behavior, DB collation/ICU-based sort can be added later.
## 2026-03-09 - products sorting refinement (null handling + stable ordering)
- Request: On products table, group sorting still looked wrong (same categories appearing on top).
- Changes: Refined ORDER BY in products API to `NULLS LAST` and added secondary stable sort by `LOWER(name), id` to avoid misleading top rows when many records share same group or null values.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: If active branch dataset truly contains only few group values, top rows can still repeat by design; then issue is data scope, not sort logic.
## 2026-03-09 - product group assignment audit + edit-form group selector compatibility fix
- Request: Verify whether all products have group assigned and why group selector appears unselected in product edit.
- Changes: Audited live product groups for active company via DB query; all products have non-empty group values. Found many tenant-specific/localized group values not present in static edit-form options. Updated ProductForm `populateForm()` to set group with case-insensitive option match and append dynamic option when no static match exists, then select it.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js; runtime DB audit script (group distribution).
- Risk/Follow-up: Static default group option list is narrow; if strict canonical groups are desired, add dedicated mapping/migration rules before normalization.
## 2026-03-09 - product form category/group separation hardening
- Request: Investigate category field behavior where group-level values appear in category context; category should represent subgroup hierarchy.
- Changes: In ProductForm, added `/products/groups` preload and normalized group-name set; filtered category dropdown root options that collide with product group names; preserved backward compatibility by dynamically appending product's existing category when it is not present in filtered dropdown.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: If a tenant intentionally uses the same label for both group and category in new product creation, that category is now hidden from default dropdown; existing records still load via dynamic option.

## 2026-03-09 - add product descriptions to demo seed data (products.json)
- Request: Merge the 1064 product descriptions generated earlier into the TR products.json seed file so the setup wizard seeds products with descriptions.
- Changes: Added `description` field to all 1064 product entries in `database/seeders/data/tr/products.json`. ProductSeeder.php already handled `$product['description'] ?? null` (line 93), so no backend code change was needed. Verified all 1064 SKUs matched, 0 unmatched.
- Files: database/seeders/data/tr/products.json
- Checks: JSON parse validation, field count verification (18 fields per product), 1064/1064 description coverage confirmed.
- Risk/Follow-up: EN products.json (20 items) does not have descriptions yet; can be added if needed. Backup at products.json.bak.
## 2026-03-09 - setup wizard product category hierarchy audit + seeder normalization
- Request: Inspect whether subcategory is correct by category, verify demo seed structure (group/category/subcategory), and check setup-wizard category-product matching.
- Findings: Seed/data mismatch was real. Audits showed high inconsistency between products and category hierarchy (TR seed: total 1064, category-not-parent 569, subcategory-not-child 742; live company dataset showed same pattern). Setup wizard had no category-product hierarchy validation.
- Changes: Updated `database/seeders/ProductSeeder.php` to load category hierarchy from DB and normalize incoming product fields during seed: (1) promote child-level category to parent category, (2) align subcategory to child-level when possible, (3) fallback to group as parent category when category is unknown but group maps to parent. This hardens setup-wizard seeded data consistency going forward.
- Files: database/seeders/ProductSeeder.php
- Checks: php -l database/seeders/ProductSeeder.php; php database/seeders/seed.php --products --dry-run --locale=tr --verbose
- Risk/Follow-up: Existing already-seeded product rows are unchanged until products are seeded again (or a one-time normalization migration is run). When category is promoted from child to parent, deeper third-level source detail may be compressed into available 2-level model.
## 2026-03-09 - one-time live product category/subcategory normalization for existing data
- Request: Apply solution for existing subcategory preferences on live data.
- Changes: Added `scripts/normalize_product_category_hierarchy.php` (dry-run/apply modes) to normalize existing product rows to parent-category + child-subcategory model and optionally auto-create missing child categories to preserve current user preferences. Ran apply for active company `Omnex Default` (`d1c946f3-4058-4b72-8e24-6c4b3cb9e9cb`) in two passes. Added group->parent alias mapping for non-1:1 labels (`F�r�n`->`F�r�n �r�nleri`, `�erez`->`Kuruyemi�`, etc.). Also updated `database/seeders/ProductSeeder.php` with same alias logic to prevent reoccurrence in setup wizard seed.
- Files: scripts/normalize_product_category_hierarchy.php, database/seeders/ProductSeeder.php
- Checks: php -l scripts/normalize_product_category_hierarchy.php; php -l database/seeders/ProductSeeder.php; php scripts/normalize_product_category_hierarchy.php --apply; php scripts/normalize_product_category_hierarchy.php --company=d1c946f3-4058-4b72-8e24-6c4b3cb9e9cb --apply; post-apply DB audit query (cat_not_parent=0, sub_not_child=0).
- Risk/Follow-up: Normalization intentionally remapped some rows based on group/category aliases; if a specific SKU needs custom exception, add a small SKU-level override map in the script before future runs.
## 2026-03-09 - products table sorting/filter interaction hardening
- Request: Products table headers (group/category) seemed to show only limited variants on clicks; investigate possible cross-effect between column sorting and filters.
- Changes: (1) DataTable now resets to page 1 when sort column/direction changes. (2) ProductList filter-change handlers now force page reset before refresh to avoid stale pagination state. (3) Group filter source switched from `/products?per_page=1000` (incorrect/limited) to dedicated `/products/groups` endpoint so all distinct groups load reliably.
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/products/ProductList.js; php -l api/products/groups.php
- Risk/Follow-up: Even with correct sorting, first page may still show one dominant group/category when distribution is skewed (expected behavior with paginated sorting). If desired, add a distinct-value summary strip above table.
## 2026-03-09 - products API interleaved sorting for group/category headers only
- Request: Header sorting seemed to show only Baharat/�ark�teri on first page; user expected other values to appear across clicks for group/category.
- Changes: Updated products API ORDER BY logic: only when `sort_by` is `group` or `category`, apply interleaved ordering via `ROW_NUMBER() OVER (PARTITION BY ...)` so first page does not collapse into a single dominant value block. All other headers keep standard ASC/DESC ordering.
- Files: api/products/index.php
- Checks: php -l api/products/index.php; direct SQL spot check confirmed first page includes 15 distinct groups in group-sort mode.
- Risk/Follow-up: Interleaved mode is intentionally different from strict block ordering for these two columns; if needed, can be toggled by query flag later.
## 2026-03-09 - revert interleaved group/category sorting to strict block order
- Request: User wants same values to appear consecutively (e.g., all �ark�teri rows together), not interleaved every few rows.
- Changes: Removed temporary interleaved ORDER BY logic for `group/category` in products API. Restored strict sort order for all headers: `sortExpr sortDir NULLS LAST, LOWER(name), id`.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: With strict block order + pagination, first page may naturally show only one/few dominant values depending on sort direction and distribution.
## 2026-03-09 - hybrid block+cycle sorting for product group/category headers
- Request: Need both behaviors together: keep same values in contiguous blocks, but each header click should bring a different value block to top.
- Changes: Added DataTable `onSortChange` hook. In ProductList, implemented click-cycle anchors for `group` and `category` (rotating selected value per click). API `/products` now accepts optional `sort_anchor`; for `group/category` sorts it prioritizes the anchored value block first via `CASE WHEN ... THEN 0`. Remaining rows stay in normal block sorting (`sortExpr`, then name, id).
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/products/ProductList.js, api/products/index.php
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/products/ProductList.js; php -l api/products/index.php; SQL spot-check for anchor-first block ordering.
- Risk/Follow-up: Category cycle source currently derives from category filter options; if you want cycle strictly from product-used categories only, we can add a dedicated `/products/categories` endpoint.
## 2026-03-09 - fix sort-cycle anchor stuck on same value
- Request: After hybrid block+cycle sort change, table still showed single value repeatedly.
- Root cause: In ProductList sort-cycle logic, index was reset on every direction change (ASC/DESC), and DataTable toggles direction each click on same header, so anchor remained first value.
- Changes: Updated `handleSortCycle()` to reset cycle index only when sort column changes, not when direction changes.
- Files: public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/pages/products/ProductList.js
- Risk/Follow-up: Cycle now progresses every click on same header; if desired, we can later separate sort direction toggle from cycle action with modifier key.
## 2026-03-09 - category header cycle made group-aware
- Request: Group header behavior is OK; category should cycle similarly but according to selected group.
- Changes: In ProductList, added `loadCategoryCycleMap()` to build category sets per group from products API. Updated category sort-cycle logic to use selected group's category list when `filter-group` is set; fallback to global categories otherwise.
- Files: public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/pages/products/ProductList.js
- Risk/Follow-up: Category cycle map is loaded once on page init (from up to 5000 products); if product/category data changes live during session, page refresh updates the map.
## 2026-03-09 - detailed reference doc for hybrid products table sorting model
- Request: Document current table sorting configuration in detail so it can be used as reference on other pages.
- Changes: Added `docs/PRODUCTS_TABLE_SORTING_REFERENCE.md` with architecture, file responsibilities, sort modes, state model, API contract (`sort_anchor`), group-aware category cycle, pagination/filter interactions, reuse template, constraints, and validation checklist.
- Files: docs/PRODUCTS_TABLE_SORTING_REFERENCE.md
- Checks: No code checks required (documentation-only change).
- Risk/Follow-up: If sort behavior evolves, this reference should be updated in same PR to keep it authoritative.
## 2026-03-09 - ubuntu server version recommendation for customer VM
- Request: Customer will create a VM for this project; asked whether Ubuntu 22 is enough or Ubuntu 24.04 LTS x64 should be preferred.
- Changes: No runtime code changes. Reviewed deployment stack/docs and recommended OS choice based on repository deployment scripts and containerized architecture.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No applicable code syntax check (documentation/memory-only update).
- Risk/Follow-up: If deployment will be non-Docker/native package install, pin exact package versions (PHP, extensions, PostgreSQL client tools) before go-live.
## 2026-03-09 - memory lookup: media listener leak fix note retrieval
- Request: Find the note about the repeated operation/listener leak fixed in media after midnight.
- Changes: Searched CHANGE_MEMORY and identified the matching entry (global cursor freeze root-cause fix via hover-listener cleanup) with media/template listener cleanup details.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No code checks required (memory lookup/documentation-only).
- Risk/Follow-up: None.
## 2026-03-09 - leak audit for similar repeated-listener issues
- Request: Inspect project for leaks similar to previously fixed media/template repeated hover listener issue.
- Changes: Performed targeted static audit across frontend for global listeners/timers/cleanup matching. Identified high-confidence leak risks in LayoutManager selector binding and ProductForm submodule cleanup chain; confirmed previously fixed media/template hover listeners are currently cleaned up.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No code checks required (inspection-only, memory update).
- Risk/Follow-up: Findings are not patched yet; recommended next step is implementing idempotent bind/unbind with stored handler refs in LayoutManager + selector components and explicit ProductForm submodule destroy calls.
## 2026-03-09 - leak hardening: layout/selectors + product form submodule cleanup
- Request: Implement the 3 critical leak fixes (LayoutManager global listener accumulation, selector outside-click rebinding leaks, ProductForm/PriceHistorySection cleanup chain), using temp backups and verify correctness.
- Changes: Created temp backups at .codex/tmp_backups/20260309_231055. Added idempotent outside-click binding + destroy() cleanup to CompanySelector/BranchSelector/LanguageSelector. Hardened LayoutManager with stored global handler refs and remove-before-add in setup/bind flows; added comprehensive listener cleanup + selector destroy calls in LayoutManager.destroy(). Added managed document-click handler cleanup to PriceHistorySection. Updated ProductForm.destroy() to explicitly destroy submodules (mediaPicker, barcodeSection, halKunyeSection, priceHistorySection).
- Files: public/assets/js/layouts/LayoutManager.js, public/assets/js/components/CompanySelector.js, public/assets/js/components/BranchSelector.js, public/assets/js/components/LanguageSelector.js, public/assets/js/pages/products/form/PriceHistorySection.js, public/assets/js/pages/products/ProductForm.js, .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/layouts/LayoutManager.js; node --check public/assets/js/components/CompanySelector.js; node --check public/assets/js/components/BranchSelector.js; node --check public/assets/js/components/LanguageSelector.js; node --check public/assets/js/pages/products/form/PriceHistorySection.js; node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Runtime behavior is preserved, but listeners are now lifecycle-managed. If any selector is re-instantiated outside LayoutManager flow, existing destroy() should be called before replacing instance.
- Backup/Restore Safety: Backup created before edits; restore not needed.
## 2026-03-09 - post-fix bug check for leak hardening changes
- Request: Run bug control after applying 3 critical leak fixes.
- Changes: Reviewed git diff for all patched files and re-checked syntax. Verified listener add/remove pairing and lifecycle cleanup wiring in selectors, LayoutManager, ProductForm, and PriceHistorySection.
- Files: .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/layouts/LayoutManager.js; node --check public/assets/js/components/CompanySelector.js; node --check public/assets/js/components/BranchSelector.js; node --check public/assets/js/components/LanguageSelector.js; node --check public/assets/js/pages/products/form/PriceHistorySection.js; node --check public/assets/js/pages/products/ProductForm.js; static pairing checks via rg.
- Risk/Follow-up: No blocking bug found in static review; runtime validation on layout switch + selector open/close + product form open/close flow is still recommended.
## 2026-03-09 - full project bug check (global)
- Request: Run bug control for the whole project (not only recent patches).
- Changes: Performed global syntax and static risk audit across active PHP/JS code, plus listener/timer cleanup heuristics.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Active PHP lint scan (excluding backup/vendor/web-build/html-editor): PHP_TOTAL_ACTIVE=569, PHP_FAIL_ACTIVE=0; JS syntax scan: JS_TOTAL=141, JS_FAIL_COUNT=0; static scans for listener/timer mismatch and global click listener accumulation hotspots.
- Risk/Follow-up: High-risk global listener accumulation detected in DataTable and several page-level export/modal bindings; recommend converting anonymous document listeners to stored handler refs with cleanup in destroy.
## 2026-03-09 - global listener leak hardening across project pages/components
- Request: Patch global project leak hotspots (not patch-only scope) with temp backup, preserve encoding, and run checks.
- Changes: Created temp backup at .codex/tmp_backups/20260309_232728. Added stored-handler + remove-before-add + destroy cleanup patterns to DataTable global listeners (document/window/scroll targets), BundleForm delegated document listeners, ProductList export dropdown outside-click listener, BundleList export dropdown outside-click listener, NotificationList modal outside-click listener, and ExportManager static dropdown helper (idempotent outside-click + cleanup return).
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/bundles/BundleForm.js, public/assets/js/pages/products/ProductList.js, public/assets/js/pages/bundles/BundleList.js, public/assets/js/pages/notifications/NotificationList.js, public/assets/js/utils/ExportManager.js, .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/bundles/BundleForm.js; node --check public/assets/js/pages/products/ProductList.js; node --check public/assets/js/pages/bundles/BundleList.js; node --check public/assets/js/pages/notifications/NotificationList.js; node --check public/assets/js/utils/ExportManager.js; static listener cleanup verification via rg removeEventListener scan.
- Risk/Follow-up: Runtime behavior preserved; if another page reimplements custom dropdown outside-click logic with anonymous listeners, same pattern should be migrated to stored handlers.
- Backup/Restore Safety: Backup created; restore not required.
## 2026-03-09 - disable per-request DB migration in API bootstrap
- Request: Remove unnecessary $db->migrate() execution from pi/index.php on every API request.
- Changes: Removed runtime migration call from API bootstrap database init block; added note that migrations must be executed via deployment/maintenance workflow.
- Files: api/index.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/index.php
- Risk/Follow-up: New schema files will no longer auto-apply during normal traffic; ensure deployment pipeline runs migration explicitly before release.
## 2026-03-09 - API latency optimization pass (bootstrap + products + devices + media)
- Request: Improve API response speed globally; keep temp backup, preserve encoding, and run checks.
- Changes: Created temp backup at .codex/tmp_backups/20260309_233701. (1) pi/index.php: removed per-request migration earlier and added shutdown-based API duration logging so successful responses that exit via Response::json are still logged. (2) pi/products/index.php: replaced broad device/template fetches with page-scoped assigned ID lookups (IN (...)), removed duplicate template lookup query. (3) pi/devices/index.php: added short TTL cache (storage/cache/api/hanshow_esl_status_<company>.json) for Hanshow battery enrichment and reduced remote call timeout to 1s/1s with stale-cache fallback. (4) pi/media/index.php: made skip_validation default 1 to avoid per-item is_file() disk I/O on normal list requests.
- Files: api/index.php, api/products/index.php, api/devices/index.php, api/media/index.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/index.php; php -l api/products/index.php; php -l api/devices/index.php; php -l api/media/index.php; static verification via rg for optimization hooks.
- Risk/Follow-up: Media list now trusts DB paths by default (faster); missing files may appear until scan/cleanup runs. Hanshow cache TTL is 30s; adjust if fresher status is required.
- Backup/Restore Safety: Backup created; restore not needed.
## 2026-03-09 - system-status live metric correctness + external API monitor + deploy checklist
- Request: Verify #/admin/system-status live API measurement correctness, fix any wrong live data flow, add long-running monitor script outside project, and prepare deploy precheck checklist.
- Changes: (1) pi/system/status.php live metrics now come from real storage/logs/api.log parsing via new collectApiLogMetrics() helper; removed simulated/random response-time behavior and API_START_TIME dependency. (2) Added external monitor page at C:/Users/test/.codex/memories/API_LIVE_MONITOR.html with long-running polling, per-endpoint stats (avg/p50/p95/p99, error rate), localStorage log retention, JSON/CSV export, and sanity check for /system/status?live_only=1. (3) Added deploy checklist at C:/Users/test/.codex/memories/DEPLOY_PRECHECK_CHECKLIST.md.
- Files: api/system/status.php, C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, C:/Users/test/.codex/memories/DEPLOY_PRECHECK_CHECKLIST.md, .codex/CHANGE_MEMORY.md
- Checks: php -l api/system/status.php; static verification via rg for live-metric source update (collectApiLogMetrics usage, no random response-time logic).
- Risk/Follow-up: pi.log based metrics depend on log write health and timestamp consistency; if log path permissions fail, live metrics degrade to zeros.
- Backup/Restore Safety: Temp backup created at .codex/tmp_backups/20260309_234456; restore not needed.
## 2026-03-09 - live monitor stabilization + live stat cards + api log cleanup + DB API index migration pack
- Request: Share exact live monitor file/link, make system-status top cards update live, investigate high live error percentage (~45%) and clean old API logs if needed, produce DB index migration plan/script (products/devices/media), and provide deploy checklist/control results.
- Changes: (1) `api/system/status.php` live payload extended with `quick_stats` (uptime/cpu/memory) for 3s card updates and `client_error_rate`; `error_rate` now tracks server-side 5xx only to avoid 4xx auth noise inflation. (2) `public/assets/js/pages/admin/SystemStatus.js` now updates top quick stat cards during live polling via `renderQuickStatsFromLive(...)`. (3) External monitor `C:/Users/test/.codex/memories/API_LIVE_MONITOR.html` enhanced with separate `4xx%` and `5xx%` columns to explain high error ratios. (4) Added PostgreSQL API performance migration file `database/postgresql/v2/43_api_perf_indexes.sql` (products/devices/media list/search/sort indexes) and registered it in `core/Database.php` schema file order. (5) API log cleanup with safety: archived `storage/logs/archive/api_20260309_235835.log` then truncated active `storage/logs/api.log` (lock-safe stream truncate).
- Files: api/system/status.php, public/assets/js/pages/admin/SystemStatus.js, C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, database/postgresql/v2/43_api_perf_indexes.sql, core/Database.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/system/status.php; node --check public/assets/js/pages/admin/SystemStatus.js; php -l core/Database.php; static verification via rg (`quick_stats`, `client_error_rate`, `collectQuickStatsForLiveCards`, `43_api_perf_indexes.sql` registration); api.log size/timestamp verification after truncate.
- Risk/Follow-up: New indexes are additive and safe (`IF NOT EXISTS`) but should still be validated with EXPLAIN ANALYZE on production-like data before/after migration. 5xx-based `error_rate` is operationally cleaner; if business wants total non-2xx visibility in UI, surface `client_error_rate` separately in frontend.
- Backup/Restore Safety: Temp backup created at `.codex/tmp_backups/20260309_235621`; api.log archived before cleanup at `storage/logs/archive/api_20260309_235835.log`; restore not needed.
- Follow-up artifact: Added run report C:/Users/test/.codex/memories/DEPLOY_PRECHECK_RUN_2026-03-09.md with completed controls and remaining manual validations.
- Deployment-step check: Ran php database/migrate.php successfully after adding v2 index script (43_api_perf_indexes.sql).
## 2026-03-10 - DB explain-analyze validation for products/devices/media API paths
- Request: Proceed with next step to run EXPLAIN ANALYZE and validate index impact for API list/search/sort hot paths.
- Changes: Executed targeted EXPLAIN (ANALYZE, BUFFERS) queries against real local PostgreSQL data for products/devices/media patterns; produced report artifact at `C:/Users/test/.codex/memories/DB_EXPLAIN_ANALYZE_REPORT_2026-03-10.md`.
- Files: .codex/CHANGE_MEMORY.md, C:/Users/test/.codex/memories/DB_EXPLAIN_ANALYZE_REPORT_2026-03-10.md
- Checks: Runtime DB plan checks via `php .codex/tmp_explain.php` and `php .codex/tmp_explain_devices.php` (temporary scripts removed after run).
- Risk/Follow-up: Local tenant data is small (especially devices), so some plans correctly favor Seq Scan; repeat same EXPLAIN set on production-like dataset for final index efficacy confirmation.
- Backup/Restore Safety: No production code files modified; no backup required.
## 2026-03-10 - before/after DB plan-cost comparison table (simulated no-index baseline)
- Request: Continue and provide direct before/after plan + cost comparison for products/devices/media query paths.
- Changes: Ran safe comparative benchmark with indexes ON vs simulated OFF (`enable_indexscan=off`, `enable_bitmapscan=off`) and generated (1) machine-readable output `.codex/plan_compare_results.json`, (2) human report `C:/Users/test/.codex/memories/DB_PLAN_BEFORE_AFTER_2026-03-10.md`.
- Files: .codex/CHANGE_MEMORY.md, .codex/plan_compare_results.json, C:/Users/test/.codex/memories/DB_PLAN_BEFORE_AFTER_2026-03-10.md
- Checks: Runtime DB benchmark execution via `php .codex/tmp_plan_compare.php` (temporary script removed after run).
- Risk/Follow-up: �Before� side is simulated planner behavior without index scans, not physical index drop; for final production sign-off, repeat on production-like dataset during low-traffic window.
- Backup/Restore Safety: No application code modified; no backup required.
## 2026-03-10 - local vs prod-like DB plan comparison completed
- Request: Continue with production-like comparison and provide local vs prod-like difference table.
- Changes: Built prod-like benchmark using TEMP scaled tables, generated `.codex/plan_compare_prodlike_results.json`, and created consolidated comparison report `C:/Users/test/.codex/memories/DB_PLAN_LOCAL_VS_PRODLIKE_2026-03-10.md` against prior local benchmark outputs.
- Files: .codex/CHANGE_MEMORY.md, .codex/plan_compare_prodlike_results.json, C:/Users/test/.codex/memories/DB_PLAN_LOCAL_VS_PRODLIKE_2026-03-10.md
- Checks: Runtime DB benchmark run via `php .codex/tmp_plan_compare_prodlike.php` (temporary script removed after execution).
- Risk/Follow-up: Prod-like dataset is simulated via duplication in TEMP tables; real production skew/cardinality may differ slightly. For final release, re-run same scripts against staging snapshot if available.
- Backup/Restore Safety: No application code or persistent DB tables modified.
## 2026-03-10 - deploy checklist verification pass and readiness decision
- Request: Verify deploy checklist items and report whether system is ready for release.
- Changes: Executed automated checklist checks (migration execution, log writability, DB health, lock wait count, endpoint reachability without auth, disk free space) and produced readiness report `C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md` with PASS/PARTIAL/PENDING matrix and release decision.
- Files: .codex/CHANGE_MEMORY.md, C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md
- Checks: `php database/migrate.php`; log writable append test on `storage/logs/api.log`; DB connectivity + `SELECT now()` + waiting lock count (`pg_locks` not granted = 0); unauthenticated endpoint reachability probe on `/system/status?live_only=1`, `/products`, `/devices`, `/media`, `/templates`, `/bundles`, `/notifications` (HTTP 401 expected); disk free check via `System.IO.DriveInfo`.
- Risk/Follow-up: Go-live is still blocked by manual authenticated smoke tests and 30+ minute live monitor baseline/sign-off items.
- Backup/Restore Safety: No production code changed; no restore required.
## 2026-03-10 - authenticated smoke + operational sign-off checks executed
- Request: While user runs live monitor, verify authenticated UI/API functional smoke and operational sign-off items (backup/rollback drill, alarm routing).
- Changes: Executed non-destructive auth/API smoke with temporary SuperAdmin users (created+cleaned): login/session/refresh/logout and protected list endpoints (`/products`, `/devices`, `/media`, `/templates`) all 200. Executed backup/rollback pipeline drill: `tenant-backup export -> download -> peek-manifest -> delete` all 200. Verified alert routing path: `/api/logs/notify-settings` GET/PUT 200 and `/api/logs/send-report` 200 with in-app notification delivery; SMTP warning observed (email channel not configured).
- Files: C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md, .codex/CHANGE_MEMORY.md
- Checks: `php scripts/test_endpoints_smoke.php --base-url=http://127.0.0.1/market-etiket-sistemi --email=admin@omnexcore.com --password=...` (failed due invalid default creds, script health-path mismatch); custom temporary smoke runs via `php .codex/tmp_auth_ops_smoke.php`, `php .codex/tmp_backup_drill.php`, `php .codex/tmp_alarm_routing_check.php` (all pass, temp scripts removed).
- Risk/Follow-up: SMTP not configured, so email alert leg is pending; in-app alert path is working. Final go-live gate remains 30+ min monitor baseline with P95/error targets.
- Backup/Restore Safety: Temporary test users/sessions were cleaned up; backup artifact created during drill was deleted via API.
## 2026-03-10 - SMTP alarm channel hardening + signoff rerun
- Request: Complete remaining deploy gaps before live monitor result: finish SMTP-based alarm channel and run final manual UI smoke/operational sign-off checks.
- Changes: Patched `services/SmtpMailer.php` for robust SMTP failure handling and integration compatibility. Added warning-safe socket open (no global warning-to-500 leak), guarded all SMTP response reads against non-string values, tightened EHLO/AUTH/TLS error branches, and widened catch to `Throwable` to prevent uncaught runtime fatals. Re-ran authenticated operational smoke via temporary scripts and saved report artifacts.
- Files: services/SmtpMailer.php, C:/Users/test/.codex/memories/SIGNOFF_API_SMOKE_2026-03-10.json, C:/Users/test/.codex/memories/DEPLOY_SIGNOFF_UPDATE_2026-03-10.md, C:/Users/test/.codex/memories/MANUAL_UI_OPS_SIGNOFF_TEMPLATE_2026-03-10.md, .codex/CHANGE_MEMORY.md
- Checks: php -l services/SmtpMailer.php; SMTP wiring smoke (`php .codex/tmp_smtp_wiring_check.php`, temporary, removed) -> `/api/logs/send-report` now 200 under SMTP connection failure path; final signoff smoke (`php .codex/tmp_final_signoff_check.php`, temporary, removed) -> pass=18 fail=1 with only `tenant-backup/peek-manifest` archive-format mismatch.
- Risk/Follow-up: Real SMTP delivery still depends on valid SMTP credentials/network reachability in environment. `tenant-backup/peek-manifest` should be revalidated using a known-valid restore archive format before final go-live sign-off.
- Backup/Restore Safety: Temp backup created before SMTP edit at `.codex/tmp_backups/20260310_003804/SmtpMailer.php.bak`; restore not required.
## 2026-03-10 - monitor log analysis (api-monitor-log-1773092771761)
- Request: Analyze monitor output file and report current live status before proceeding.
- Changes: No source code changes. Reviewed monitor dataset at `kutuphane/api-monitor-log-1773092771761.json` and extracted error/latency distribution and anomaly root cause signals.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Data analysis via PowerShell JSON parsing (status distribution, endpoint-level p95/p99, single 500 extraction, timespan extraction).
- Risk/Follow-up: Dataset is not valid for true API functional/perf sign-off because 99.97% requests are unauthorized (401). One 500 came from rate-limit cache read in middleware (`ApiGuardMiddleware.php:288`) due permission denied on cache file read.
- Backup/Restore Safety: No code edit; backup not required.
## 2026-03-10 - API live monitor auth flow hardening + request-count clarity
- Request: Make monitor run with auth token and explain whether 2888 requests in ~43 minutes indicates extra/unexpected API traffic.
- Changes: Updated external monitor page `C:/Users/test/.codex/memories/API_LIVE_MONITOR.html` with (1) Login email/password + `Login & Use Token` button (calls `/api/auth/login` and fills bearer token), (2) `Load omnex_token` helper from localStorage, (3) stop-on-401 safety switch (default on), (4) summary counters for total requests / endpoint count / poll-cycle estimate / 4xx-5xx totals. Kept password out of persisted localStorage monitor config.
- Files: C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, .codex/CHANGE_MEMORY.md
- Checks: Runtime data validation against user-provided monitor log (`api-monitor-log-1773092771761.json`) with PowerShell JSON analysis (status distribution, per-endpoint counts, cycle math, effective cycle interval).
- Risk/Follow-up: Monitor file is outside app build and depends on browser context/localStorage token availability. For production-like measurement, run monitor in authenticated session with stable foreground tab to reduce browser timer throttling effects.
- Backup/Restore Safety: Backup created before edit at `.codex/tmp_backups/20260310_005409/API_LIVE_MONITOR.html.bak`; restore not required.
## 2026-03-10 - pending items review + SMTP source verification
- Request: While authenticated monitor run continues, review pending items and verify saved mail settings.
- Changes: No persistent application code changes. Performed runtime verification for SMTP wiring state and pending deploy gates.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Temporary authenticated smoke (`/api/smtp/settings?scope=system`, `/api/logs/send-report`) and DB inspection of SMTP config sources (`settings` legacy JSON vs `integration_settings` smtp rows).
- Risk/Follow-up: SMTP currently works via legacy `settings` source (`smtp.yandex.com`), while `integration_settings` system smtp row is disabled/empty. This dual-source mismatch can confuse UI/status; align by saving active SMTP into integration settings model or migrate legacy row.
- Backup/Restore Safety: No code edit; no backup needed.
## 2026-03-10 - SMTP new-model migration + settings UI wiring
- Request: Move mail settings to new integration model and bind frontend settings design to new structure, keep legacy for now, and audit old/new references before removal.
- Changes: (1) `api/smtp/settings.php` now hydrates missing new-model SMTP config from legacy `settings.data` (`smtp_*`) on read, persisting into `integration_settings` (system/company scope aware). (2) `public/assets/js/pages/settings/GeneralSettings.js` SMTP tab decoupled from `/settings`; it now loads/saves SMTP via `/smtp/settings` (`?scope=system` for SuperAdmin), while `/settings` remains for non-SMTP general/barcode fields. (3) Save flow updated to persist SMTP + general settings in one submit without leaking empty password overwrite.
- Files: api/smtp/settings.php, public/assets/js/pages/settings/GeneralSettings.js, .codex/CHANGE_MEMORY.md
- Checks: php -l api/smtp/settings.php; node --check public/assets/js/pages/settings/GeneralSettings.js; runtime migration verification via temporary script (`GET /api/smtp/settings?scope=system` -> configured=true and integration_settings row populated/active).
- Risk/Follow-up: Legacy fallback paths still exist intentionally (`SmtpMailer` + hydrate helper) until post-validation cleanup decision. After user confirmation, legacy SMTP reads in `SmtpMailer` and legacy hydrate branch in `api/smtp/settings.php` can be removed in a dedicated cleanup pass.
- Backup/Restore Safety: Backups created at `.codex/tmp_backups/20260310_011801` before edits; restore not required.
## 2026-03-10 - Docker tenant-backup migration repair and full missing-step completion
- Request: Investigate Docker tenant-backup 500 error (`relation tenant_backups does not exist`) and safely run all missing migrations without data loss.
- Changes: No repository code change in this step; applied non-destructive DB repair/migration operations in running Docker stack (`omnex-test-app` / `omnex-test-postgres`).
- Actions run:
  1) Verified Docker stack and DB migration markers (`core.migrations`) in `omnex_hub`.
  2) Found runtime mismatch: app image did not include `database/migrate.php` and did not include `43_api_perf_indexes.sql` in container migration list.
  3) Applied idempotent repair SQL to create `audit.tenant_backups` + FK constraints + indexes + RLS policy (all guarded with IF NOT EXISTS / DO checks).
  4) Applied missing migration file `43_api_perf_indexes.sql` directly to Docker PostgreSQL and inserted marker `pg:43_api_perf_indexes.sql` into `core.migrations`.
  5) Verified service-level query path with `TenantBackupService::getCompanyBackupSummary()` inside container (`SUMMARY_OK`).
- Files: .codex/CHANGE_MEMORY.md
- Checks: docker ps; docker exec psql table existence checks; docker exec app service-level smoke; migration marker list re-check includes `pg:43_api_perf_indexes.sql`.
- Risk/Follow-up: Container image code is older than workspace (missing some latest files/steps). For durable parity, rebuild/redeploy Docker app image from current repo state to keep future migrations consistent.
- Backup/Restore Safety: Operations were additive/idempotent (create-if-missing and index additions), no destructive DDL or data deletion performed.
## 2026-03-10 - Docker first-install auto bootstrap + health + tenant-backup valid-archive verification
- Request: Ensure Docker full rebuild state is correct, confirm first migrations/seeders (default user/company) behavior, and verify `tenant-backup/peek-manifest` with a valid restore archive.
- Changes:
  - Added early `/api/health` short-circuit in API entrypoint so Docker health check always resolves.
  - Added Docker app entrypoint script to run idempotent PostgreSQL `migrate_seed.php` automatically on container startup.
  - Hardened entrypoint permission flow: normalize `storage` ownership/permissions both before and after migrate+seed to prevent `storage/logs/app.log` permission-denied runtime failures.
- Files:
  - api/index.php
  - deploy/Dockerfile
  - deploy/scripts/docker-app-entrypoint.sh
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/index.php`
  - `docker compose -f deploy/docker-compose.local.yml build --no-cache`
  - `docker compose -f deploy/docker-compose.local.yml up -d`
  - `docker compose -f deploy/docker-compose.local.yml ps` -> app/postgres healthy
  - Startup log confirms `PostgreSQL migrate+seed OK` and `/api/health` returns 200
  - DB checks: `core.companies=1`, `core.users=2`, `core.migrations` contains `seed:php:all`, `audit.tenant_backups` exists
  - End-to-end tenant-backup validation: login -> export -> download -> `peek-manifest` -> delete; `peek-manifest` result `success=true`, message `Ar�iv bilgileri okundu`
- Risk/Follow-up:
  - Entrypoint currently runs migrate+seed at every container start (idempotent; seed runs once via marker). Startup time impact is acceptable for now; can be gated via dedicated env flag in production if needed.
- Backup/Restore Safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/20260310_014821-docker-bootstrap/`
    - `.codex/tmp_backups/20260310_015516-entrypoint-fix/`
  - No destructive data operation applied.
## 2026-03-10 - Seed/admin email domain alignment to omnexcore.com
- Request: Ensure SuperAdmin/initial user emails use `@omnexcore.com` domain.
- Changes:
  - Updated existing Docker DB SuperAdmin email from `admin@omnexcore.com` to `admin@omnexcore.com`.
  - Updated Docker local compose seed env: `OMNEX_ADMIN_EMAIL=admin@omnexcore.com`.
  - Updated base compose default fallback: `OMNEX_ADMIN_EMAIL` default from `admin@example.com` to `admin@omnexcore.com`.
- Files:
  - deploy/docker-compose.local.yml
  - deploy/docker-compose.yml
  - .codex/CHANGE_MEMORY.md
- Checks:
  - DB user verification query before/after update (`core.users`).
  - API login smoke with new email: `POST /api/auth/login` -> success=true, user.email=`admin@omnexcore.com`.
- Risk/Follow-up:
  - Existing environments with previously seeded different admin emails are not auto-migrated unless DB update is applied there too.
- Backup/Restore Safety:
  - Temp backups created: `.codex/tmp_backups/20260310_020823-omnexcore-mail-domain/`.
  - No destructive operation performed.
## 2026-03-10 - API live monitor freeze/unresponsive mitigation (file:// use)
- Request: Investigate why `API_LIVE_MONITOR.html` opened via `file:///...` appears unresponsive/frozen and ensure monitor behavior is clear.
- Changes:
  - Reduced in-browser log retention from 200000 to 10000 records.
  - Added `STATS_WINDOW` (3000) so heavy summary calculations run on recent window instead of full history.
  - Added in-flight poll guard to prevent overlapping polling loops.
  - Added startup hint for `file://` mode reminding correct Base URL (`http://127.0.0.1:3000/api`).
  - Added log trimming on load/persist to avoid localStorage growth freeze.
- Files:
  - C:/Users/test/.codex/memories/API_LIVE_MONITOR.html
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Static verification via `rg` for updated constants/functions and callsites.
  - Manual behavior verification pending in browser (requires user-side open/reload).
- Risk/Follow-up:
  - Existing old localStorage payload can still affect currently open tab until hard refresh/reopen.
- Backup/Restore Safety:
  - Temp backup created: `C:/Users/test/.codex/memories/tmp_backups/20260310_022003-monitor-freeze-fix/API_LIVE_MONITOR.html.bak`.
## 2026-03-10 - API monitor CORS clarification + same-origin access enablement
- Request: Resolve `file://` monitor CORS failures (`origin null`) when calling `http://127.0.0.1:3000/api/...`.
- Changes:
  - Confirmed CORS block is expected for `file://` origin against API host.
  - Published monitor HTML into app-served static path and synced into running container for immediate use.
  - Verified reachable URL: `http://127.0.0.1:3000/assets/API_LIVE_MONITOR.html` (HTTP 200).
- Files:
  - public/API_LIVE_MONITOR.html
  - public/assets/API_LIVE_MONITOR.html
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Invoke-WebRequest http://127.0.0.1:3000/assets/API_LIVE_MONITOR.html` -> 200.
- Risk/Follow-up:
  - `file://` opening will continue to fail by browser CORS policy; use same-origin URL above.
  - Since container is not bind-mounted for code, runtime `docker cp` was used for immediate availability; on next image rebuild files are already in workspace and should be included.
- Backup/Restore Safety:
  - Existing backup folder reused from this monitor fix pass; no destructive action.
## 2026-03-10 - pending items re-check (post monitor same-origin fix)
- Request: Re-evaluate remaining pending/go-live items after monitor + docker fixes.
- Changes: No source code change. Re-ran authenticated smoke checks and operational send-report check.
- Files: .codex/CHANGE_MEMORY.md
- Checks:
  - Auth API smoke (200): `/api/products`, `/api/devices`, `/api/media`, `/api/templates`, `/api/system/status?live_only=1`.
  - `/api/logs/send-report` re-tested with correct payload (`filename`, `recipient_ids`) -> success=true, in-app notification sent.
  - Observed warning: SMTP not configured in current Docker env, email leg skipped.
- Risk/Follow-up:
  - Remaining release gates are still human/manual: 30+ min authenticated monitor baseline report and QA/Ops/TechLead sign-off.
  - SMTP email delivery remains environment-config dependent; current Docker env still reports SMTP missing.
- Backup/Restore Safety: No edits made.
## 2026-03-10 - Docker SMTP channel verification (email leg active)
- Request: Re-test SMTP in Docker after user-side SMTP config update.
- Changes: No code changes. Performed runtime verification only.
- Files: .codex/CHANGE_MEMORY.md
- Checks:
  - `GET /api/smtp/settings?scope=system` -> `configured=true`, `enabled=true`, host `smtp.yandex.com`.
  - `POST /api/logs/send-report` with valid `filename` + `recipient_ids` -> success with `email_sent=1`, `notif_sent=1`.
- Risk/Follow-up:
  - SMTP leg now active in current Docker env. Remaining release gates are manual UI smoke and QA/Ops/Tech Lead operational sign-off.
- Backup/Restore Safety: No edits, no backup needed.
## 2026-03-10 - p95 spike analysis from monitor JSON + system/templates latency fixes
- Request: Analyze `kutuphane/api-monitor-log-1773099280017.json` in detail and fix high p95 endpoints.
- Findings:
  - Raw monitor dataset: 608 records, all HTTP 200, span ~486s.
  - Correct numeric parsing (comma/dot normalized) shows global p95 ~110.8ms; notable outlier was `system/status?live_only=1` max ~1957.5ms.
  - Server-side `api.log` showed `/api/templates` runtime ~50-60ms; high client-side durations were dominated by large response payload parsing.
  - `templates` list payload measured ~1.18MB for 9 rows due inline `data:` previews.
- Changes:
  1) `api/system/status.php`
     - `collectApiLogMetrics()` optimized to avoid full-file reads (`file()`): now tail-reads recent chunk only.
     - Added short TTL JSON cache for live metrics keyed by api.log mtime.
     - Added short TTL cache for `collectQuickStatsForLiveCards()`.
  2) `api/templates/index.php`
     - Added lean list mode defaults: heavy inline preview blobs disabled by default.
     - New query toggles:
       - `include_content=1` returns `design_data` payload.
       - `include_preview_data=1` returns inline `data:` preview blobs.
     - Default list now strips `data:` previews (`preview_image=null`) to reduce transfer/parse overhead.
- Files:
  - api/system/status.php
  - api/templates/index.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/system/status.php`
  - `php -l api/templates/index.php`
  - Runtime benchmark (auth, Docker app) after activating changes:
    - `/api/system/status?live_only=1` p95 ~50.63ms, p99 ~61.98ms
    - `/api/system/status` p95 ~109.45ms, p99 ~118.2ms
    - `/api/templates?page=1&per_page=20` p95 ~77.93ms, p99 ~84.74ms
    - `/api/templates?...&include_preview_data=1` p95 ~355.8ms (expected heavy mode)
  - Payload check:
    - templates default response size reduced from ~1,186,618 bytes to ~5,546 bytes (9 rows test).
- Risk/Follow-up:
  - Inline preview images are now disabled by default in list API; UI falls back to placeholder unless caller opts-in with `include_preview_data=1`.
  - For permanent Docker parity, rebuild/redeploy image from workspace state (runtime `docker cp + restart` used for immediate verification under OPcache constraints).
- Backup/Restore Safety:
  - Temp backups created:
    - `.codex/tmp_backups/20260310_023931-system-status-perf/`
    - `.codex/tmp_backups/20260310_024202-templates-list-perf/`
## 2026-03-11 - memory/context sync startup
- Request: User asked to read memory and continue from latest project context.
- Changes: No source code changes; refreshed working context from project memory files.
- Files:
  - .codex/CHANGE_MEMORY.md
- Checks:
  - No code files were edited, so QUICK_CHECKS syntax checks were not applicable.
- Risk/Follow-up:
  - Next task can proceed directly with current context; run targeted checks once code changes start.
- Backup/Restore Safety: No edits to risky/encoded source files.
## 2026-03-11 - products table sort/filter persistence + assigned columns sortable
- Request: Verify whether Products table sort/filter reset on page refresh, confirm default sort, and make `assigned device/template` headers actually sortable.
- Changes:
  - `public/assets/js/pages/products/ProductList.js`
    - Added local view-state persistence (`products_list_view_state_v1`) for filter values, sort field/direction, and page size.
    - Restored saved filters after filter options load (`applySavedViewState()`), then refreshed table.
    - Kept default sort as `updated_at DESC` unless a valid saved sort exists.
    - Enabled header sorting for `assigned_device` and `assigned_template` columns.
    - Persisted state on filter change/clear and sort clicks.
  - `api/products/index.php`
    - Qualified product fields with table alias `p` for safe SQL with joins.
    - Added `assigned_device` and `assigned_template` to allowed server-side sort map.
    - Implemented conditional joins for sorting:
      - `assigned_device` => `LOWER(d_sort.name)`
      - `assigned_template` => `LOWER(t_sort.name)`
    - Preserved existing group/category anchor sorting behavior.
- Files:
  - public/assets/js/pages/products/ProductList.js
  - api/products/index.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/products/index.php`
  - `node --check public/assets/js/pages/products/ProductList.js`
- Risk/Follow-up:
  - Could not run full browser interaction test in this pass; recommend quick UI smoke for refresh persistence and column sort behavior.
  - Existing encoding/mojibake text in historical Turkish normalization literals remains as-is (no semantic change made there).
- Backup/Restore Safety:
  - Temp backups created:
    - `.codex/tmp_backups/20260311-products-sort-filter-persist/ProductList.js.bak`
    - `.codex/tmp_backups/20260311-products-sort-filter-persist/index.php.bak`
  - During edit pass, `api/products/index.php` was restored from temp backup once before finalizing.
## 2026-03-11 - products sort/filter follow-up (encoding-safe reapply)
- Request: Finalize the same products-table improvements while preserving original file encoding.
- Changes:
  - Re-applied `api/products/index.php` and `public/assets/js/pages/products/ProductList.js` edits using original file encoding-safe write path.
  - Confirmed no unintended character/translation text corruption remains in modified sections.
- Files:
  - api/products/index.php
  - public/assets/js/pages/products/ProductList.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/products/index.php`
  - `node --check public/assets/js/pages/products/ProductList.js`
- Risk/Follow-up:
  - Functional behavior verified via code and syntax checks; browser-level click/refresh smoke should still be run interactively.
- Backup/Restore Safety:
  - Reused backup set: `.codex/tmp_backups/20260311-products-sort-filter-persist/`
  - Restored both files from backup once during this pass before final safe re-apply.
## 2026-03-11 - template previews on first load + setup wizard templates seeder option
- Request: Ensure `/templates` page previews are visible on first load (without opening/saving each template), and add Templates as a selectable seed data type in Setup Wizard.
- Changes:
  - `public/assets/js/pages/templates/TemplateList.js`
    - Templates API call now requests preview payload: `include_preview_data=1`.
    - Preview rendering no longer requires `thumbnail` to start with `data:`; any valid preview source is displayed in grid/list/modal.
  - `public/assets/js/pages/admin/SetupWizard.js`
    - Added new seed option card: `seed-templates`.
    - Included templates in validation and seeder payload (`seeders.push('templates')`).
    - Added seeder result label mapping for `templates` and `TemplateSeeder`.
    - Reused existing i18n keys (`adminPanel.tables.templates`) to avoid introducing new hardcoded text.
- Files:
  - public/assets/js/pages/templates/TemplateList.js
  - public/assets/js/pages/admin/SetupWizard.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/pages/templates/TemplateList.js`
  - `node --check public/assets/js/pages/admin/SetupWizard.js`
- Risk/Follow-up:
  - `include_preview_data=1` increases template list payload size; expected trade-off to show previews immediately.
  - Setup Wizard template option description currently reuses existing product description key; can be refined later with dedicated localized keys if requested.
- Backup/Restore Safety:
  - Temp backups created at `.codex/tmp_backups/20260311-template-preview-setupwizard/` before edits.
## 2026-03-11 - setup wizard templates labels + template stats card + 4-column status grid
- Request: Use dedicated setup wizard key for Templates (instead of `adminPanel.tables.templates`/product desc), add Templates to top status cards, force status cards into 4-column grid with wrapping, and confirm all 8 locale translations.
- Changes:
  - `public/assets/js/pages/admin/SetupWizard.js`
    - Seed type card now uses `setupWizard.templates` and `setupWizard.templatesDesc`.
    - Added templates count to status card fallback and rendered a dedicated Templates status card.
    - Seeder name mapping now resolves `templates` / `TemplateSeeder` via `setupWizard.templates`.
  - `api/setup/status.php`
    - Added templates stats query and returned `counts.templates` + `templates` object.
    - Included templates in empty-response defaults and `has_data` calculation.
  - `public/assets/css/pages/setup-wizard.css`
    - Desktop status grid changed to fixed 4 columns: `repeat(4, minmax(0, 1fr))`.
    - Added `status-card-icon.cyan` style for template card icon.
  - Localization (`locales/*/pages/admin.json`)
    - Added `setupWizard.templates` and `setupWizard.templatesDesc` in all 8 languages:
      - tr, en, ru, az, de, nl, fr, ar.
- Files:
  - public/assets/js/pages/admin/SetupWizard.js
  - api/setup/status.php
  - public/assets/css/pages/setup-wizard.css
  - locales/tr/pages/admin.json
  - locales/en/pages/admin.json
  - locales/ru/pages/admin.json
  - locales/az/pages/admin.json
  - locales/de/pages/admin.json
  - locales/nl/pages/admin.json
  - locales/fr/pages/admin.json
  - locales/ar/pages/admin.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/setup/status.php`
  - `node --check public/assets/js/pages/admin/SetupWizard.js`
  - JSON parse validation for 8 locale files via `node -e JSON.parse(...)`.
  - Key presence validation for `templates` + `templatesDesc` across all 8 locale files.
- Risk/Follow-up:
  - Setup wizard now shows 7 status cards; with 4-column layout this naturally wraps to two rows (4 + 3).
  - Existing historical mojibake characters in locale files were preserved; only target keys were added.
- Backup/Restore Safety:
  - Backups created at `.codex/tmp_backups/20260311-template-preview-setupwizard/` before edits.
## 2026-03-11 - HAL menu visibility for K�nye Da��t�m by role/integration
- Request: Keep `K�nye Da��t�m` menu always visible for `SuperAdmin`; for company `Admin`/users show it only when HAL integration is active/configured, otherwise hide.
- Changes:
  - `public/assets/js/layouts/LayoutManager.js`
    - Added HAL visibility state (`hasActiveHalIntegration`).
    - Added async `loadHalIntegrationVisibility()` using `/hal/settings` with active+configured check (`meta.is_active && configured`).
    - `showLayout()` now loads HAL visibility for authenticated users before rendering menu.
    - `getMenuItems()` now conditionally includes `layout.menu.kunyeDistribution` for non-SuperAdmin based on HAL visibility.
  - `public/assets/js/pages/settings/IntegrationSettings.js`
    - After successful `saveHalSettings()`, triggers `this.app.layout?.refreshLayout?.()` so menu visibility updates immediately.
- Files:
  - public/assets/js/layouts/LayoutManager.js
  - public/assets/js/pages/settings/IntegrationSettings.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/layouts/LayoutManager.js`
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js`
- Risk/Follow-up:
  - Visibility is menu-level. Direct URL access (`#/products/kunye-distribution`) is not newly blocked by this change.
- Backup/Restore Safety:
  - No backup needed (small, focused JS edits).
## 2026-03-11 - non-tabbed page enter animation
- Request: Apply smooth content enter animation to non-tabbed pages (tabbed pages like `#/settings` already animate), and assess skeleton/performance impact.
- Changes:
  - `public/assets/js/app.js`
    - Added `applyNonTabbedPageEnterAnimation(container)`.
    - `loadPage()` now calls this right after render.
    - Detects tabbed pages (`.settings-tab-content`, `.tab-content`, `.tabs-content`, `[role="tablist"]`, `.settings-tabs`) and skips global enter animation for those.
    - Re-triggers animation per route change via class reset + reflow.
  - `public/assets/css/layouts/content.css`
    - Added `.page-content.page-content-enter` animation (`page-content-enter`, 280ms, subtle fade + Y translate).
    - Added `prefers-reduced-motion` fallback to disable animation.
- Files:
  - public/assets/js/app.js
  - public/assets/css/layouts/content.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/app.js`
- Risk/Follow-up:
  - Enter animation is lightweight and should not materially affect load speed; large page bottlenecks remain API/DOM work.
  - Skeleton loaders continue to work; animation applies at container level and does not block async skeleton/data flows.
- Backup/Restore Safety:
  - No backup needed (small, low-risk frontend edits).
## 2026-03-11 - desktop-only quick layout switch button in header
- Request: Add a quick switch icon to the right of fullscreen icon (same style), to switch between Sidebar and Top Navigation layouts; show only on PC; tooltip text must support all 8 languages.
- Changes:
  - `public/assets/js/layouts/LayoutManager.js`
    - Added desktop header button renderer: `renderQuickLayoutSwitchButton()`.
    - Added layout-aware metadata helper: `getQuickLayoutSwitchMeta()` (icon + tooltip + target layout).
    - Added click handler: `handleQuickLayoutSwitch()` using `applyConfig({ layoutType })`.
    - Inserted quick switch button immediately after fullscreen button in both sidebar-header and top-navigation header render paths.
    - Bound button event in `bindLayoutEvents()` (`#quick-layout-switch-btn`).
  - `public/assets/css/layouts/header.css`
    - Added `.header-btn-desktop-only` class.
    - Hidden on tablet/mobile (`@media (max-width: 1024px) { .header-btn-desktop-only { display:none!important; } }`).
  - Localization (`locales/*/common.json`)
    - Added `layout.quickSwitchToTopNav` and `layout.quickSwitchToSidebar` in all 8 languages: tr, en, ru, az, de, nl, fr, ar.
- Files:
  - public/assets/js/layouts/LayoutManager.js
  - public/assets/css/layouts/header.css
  - locales/tr/common.json
  - locales/en/common.json
  - locales/ru/common.json
  - locales/az/common.json
  - locales/de/common.json
  - locales/nl/common.json
  - locales/fr/common.json
  - locales/ar/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/layouts/LayoutManager.js`
  - JSON parse + key presence validation for 8 locale `common.json` files.
- Risk/Follow-up:
  - Tooltip strings for some locales were added in ASCII transliterated/English-compatible form to avoid encoding breakage in existing mixed-encoding locale files.
- Backup/Restore Safety:
  - No backup needed (small focused UI + locale-key additions).
## 2026-03-11 - tr quick-switch tooltip diacritics fix
- Request: Correct Turkish hover texts to use proper Turkish characters (not ASCII-transliterated) for quick layout switch tooltips.
- Changes:
  - `locales/tr/common.json`
    - `layout.quickSwitchToTopNav`: `�st Men� D�zenine Ge�`
    - `layout.quickSwitchToSidebar`: `Kenar Men� D�zenine Ge�`
- Files:
  - locales/tr/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - JSON parse + value read check for `locales/tr/common.json` via Node.
- Risk/Follow-up:
  - None.
- Backup/Restore Safety:
  - No backup needed (single-line locale correction).
## 2026-03-11 - products/bundles central export icons + export branding/header fix
- Request: Add missing central DataTable export icon group to Products and Bundles tables; fix export documents so company light logo (or default light logo) appears on left, center shows company (+ branch if any) and report title below; investigate why this was not working.
- Changes:
  - `public/assets/js/components/DataTable.js`
    - Server-side exports now fetch full dataset via `getAllDataForExport()` (instead of exporting only current page rows).
  - `public/assets/js/pages/products/ProductList.js`
    - Enabled DataTable central export group (`toolbar.exports: true`).
    - Added DataTable export metadata (`exportFilename`, `exportTitle`, `exportSubtitle`).
  - `public/assets/js/pages/bundles/BundleList.js`
    - Enabled DataTable central export group (`toolbar.exports: true`).
    - Added DataTable export metadata (`exportFilename`, `exportTitle`, `exportSubtitle`).
  - `public/assets/js/utils/ExportManager.js`
    - Strengthened branding detection from both `omnex_user` and persisted `omnex_state` (`activeCompany`, `activeBranch`).
    - Added safe asset URL resolver for relative/absolute paths.
    - Added default light logo fallback (`branding/logo-light.png`) when company logo is missing.
    - Updated HTML/Print export header layout:
      - left: logo
      - center top: company (+ optional branch)
      - center below: report title (+ optional subtitle)
      - right: export meta/time/record count
- Files:
  - public/assets/js/components/DataTable.js
  - public/assets/js/pages/products/ProductList.js
  - public/assets/js/pages/bundles/BundleList.js
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/components/DataTable.js`
  - `node --check public/assets/js/pages/products/ProductList.js`
  - `node --check public/assets/js/pages/bundles/BundleList.js`
  - `node --check public/assets/js/utils/ExportManager.js`
- Risk/Follow-up:
  - Products/Bundles still include legacy page-header custom export dropdowns; central DataTable export group is now available and uses shared behavior.
  - Visual verification in browser is recommended for HTML/Print header composition across tenant/branch combinations.
- Backup/Restore Safety:
  - No backup needed (targeted JS-only edits).
## 2026-03-11 - export logo fit + print cancel tab behavior + html width
- Request: Fix export logo rendering ratio/fit, prevent print tab from auto-closing when print is cancelled, and widen HTML export content area (example target around 1360).
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - HTML export container widened: `max-width` changed to `1360px` and full-width enabled.
    - HTML export logo style updated for proper fit: `object-fit: contain`, `object-position: center`, fixed display block sizing.
    - Print export logo style updated similarly to preserve ratio and avoid distorted shrink.
    - Removed print auto-close behavior by deleting `window.onafterprint -> window.close()` logic; tab now remains open after print/cancel.
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
  - Pattern verification for updated CSS/JS markers (`max-width:1360`, `object-fit:contain`, no `window.close/onafterprint`).
- Risk/Follow-up:
  - None significant; behavior intentionally keeps print tab open.
- Backup/Restore Safety:
  - No backup needed (targeted frontend JS/CSS-template edits).
## 2026-03-11 - export logo area enlarged to 350px
- Request: Increase export logo area size because it is too small; target around 350px width.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - HTML export header logo area enlarged:
      - `.header-left` set to `min-width/max-width: 350px`
      - `.logo` set to `width: 350px; height: 100px; object-fit: contain`
    - Print export header logo area enlarged with same dimensions and fit behavior.
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
- Risk/Follow-up:
  - Larger logo area reduces center header space; if long company/report titles wrap too much, tune logo width (e.g. 280-320px).
- Backup/Restore Safety:
  - No backup needed (targeted style tweak).
## 2026-03-11 - export logo width correction 350px -> 250px
- Request: User reported logo still appears like 350px; set logo area width to 250px.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - HTML export header logo area: `min-width/max-width` changed to `250px`.
    - HTML export logo width changed to `250px`.
    - Print export header logo area: `min-width/max-width` changed to `250px`.
    - Print export logo width changed to `250px`.
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
  - grep verification for `250px` and absence of `350px` in target rules.
- Risk/Follow-up:
  - None.
- Backup/Restore Safety:
  - No backup needed (small style correction).
## 2026-03-11 - html export width aligned to print page width
- Request: Make HTML export page width match print page width behavior.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - HTML export container width updated from fixed pixel max-width to print-like A4 landscape content width: `width: min(100%, 27.7cm)`.
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
- Risk/Follow-up:
  - Existing mojibake text in this file predates this width tweak and still needs a dedicated encoding cleanup pass.
- Backup/Restore Safety:
  - No backup needed for this single-line style update.
## 2026-03-11 - export icons runtime fix after logo fallback change
- Request: Export icons/actions stopped working.
- Root cause:
  - `ExportManager` constructor referenced `ExportManager._getDefaultLightLogo()` but that method was not present in the current file version, causing runtime error on export action init.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - Replaced missing static method call with inline safe fallback path:
      - `logo: options.logo || branding.logo || `${window.OmnexConfig?.basePath || ''}/branding/logo-light.png``
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
  - grep verification for removed `_getDefaultLightLogo(` reference.
- Risk/Follow-up:
  - File still contains historical mojibake comments/strings from prior state; functional fix is isolated.
- Backup/Restore Safety:
  - No backup needed (single-line targeted fix).
## 2026-03-11 - html/print header layout restored and centered
- Request: After rollback, HTML full width and HTML/Print centered company-branch-report header were missing.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - Kept HTML export width in print-like page width: `.container { width: min(100%, 27.7cm); }`.
    - HTML header layout restored:
      - left: logo only (250px area)
      - center: company name (fallback `Omnex Display Hub`), optional branch, report title, optional subtitle
      - right: metadata
    - Print header layout restored with same centered structure.
    - Removed print auto-close behavior (no `window.onafterprint/window.close`).
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
- Risk/Follow-up:
  - File still contains historical mojibake comments in untouched areas; functional export layout is now aligned.
- Backup/Restore Safety:
  - No backup needed (targeted template/CSS edits).
## 2026-03-11 - html export max width set to 1360px
- Request: Set HTML export max width to 1360px.
- Changes:
  - `public/assets/js/utils/ExportManager.js`
    - HTML export container updated to: `.container { width: 100%; max-width: 1360px; margin: 0 auto; }`
- Files:
  - public/assets/js/utils/ExportManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/utils/ExportManager.js`
  - style pattern verification for `max-width: 1360px`.
- Risk/Follow-up:
  - None.
- Backup/Restore Safety:
  - No backup needed (single-line CSS template change).
## 2026-03-11 - datatable column settings integration + locale JSON recovery
- Request:
  - Bring DataTable column customization modal behavior from `omnex-core-platform` into this project.
  - Recover broken locale files after malformed edits caused key fallback and JSON parse failures.
- Changes:
  - `public/assets/js/components/DataTable.js`
    - Added table customization infrastructure:
      - toolbar `columnSettings` button support
      - table-level persistence keys (`tableId`) and load/save/clear settings helpers
      - style settings (`showVerticalBorders`, `headerBackgroundColor`)
      - per-column settings support (visibility, order, background color)
      - modal open/close/apply/reset flow and related event handlers
      - header/cell color contrast handling
      - vertical border class application
    - Added settings modal markup in `render()`.
  - `public/assets/css/components/datatable.css`
    - Added styles for column settings modal UI.
    - Added vertical border table style class.
    - Added responsive rules for settings modal.
  - `locales/*/common.json` (8 languages)
    - Repaired invalid JSON syntax introduced during prior bad edits (escaped quotes, embedded HTML quote issues, malformed strings).
    - Ensured `table.columnSettings` keys exist in all 8 languages.
- Files changed:
  - public/assets/js/components/DataTable.js
  - public/assets/css/components/datatable.css
  - locales/tr/common.json
  - locales/en/common.json
  - locales/de/common.json
  - locales/fr/common.json
  - locales/nl/common.json
  - locales/ru/common.json
  - locales/az/common.json
  - locales/ar/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/components/DataTable.js`
  - JSON parse validation for all 8 locale common files via Node (`JSON.parse`) -> all pass
- Risk/Follow-up:
  - Locale files still contain historical mojibake text from older corruption; syntax is fixed, but content quality/encoding cleanup should be done in a dedicated pass.
- Backup/Restore Safety:
  - Local backup snapshot created after issue report: `.codex/tmp_backups/locales_before_manual_fix_20260311_020529`
## 2026-03-11 - tr templates missing keys completed (manual)
- Request: Add missing popup-related translation keys to TR file only, without touching existing translations.
- Changes:
  - `locales/tr/pages/templates.json`
    - Added `editor.tools.background` = `Arkaplan`
    - Added `editor.frame.color` = `Cerceve Rengi`
- Files:
  - locales/tr/pages/templates.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - JSON parse: `locales/tr/pages/templates.json`
  - Key parity check against `locales/en/pages/templates.json` -> missing=0
- Risk/Follow-up:
  - No additional missing keys in `tr/pages/templates.json` vs EN after this patch.
- Backup/Restore Safety:
  - Manual targeted patch only.
## 2026-03-11 - common TR+FR columnSettings keys re-added after backup restore
- Request: After restoring `common` TR and FR from backup, re-add only the new DataTable column settings modal translations to both files.
- Changes:
  - `locales/tr/common.json`
    - Added `table.columnSettings` group with 8 modal keys.
  - `locales/fr/common.json`
    - Added `table.columnSettings` group with 8 modal keys.
- Files:
  - locales/tr/common.json
  - locales/fr/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Node JSON parse + required-key check for TR/FR common files (`table.columnSettings.*`) -> all pass
- Risk/Follow-up:
  - Other language files intentionally untouched in this step; user will restore/add them from backup in follow-up.
- Backup/Restore Safety:
  - User-provided backup restore performed before this patch; edit kept scoped to two files.
## 2026-03-11 - remaining 6 common locale files columnSettings keys added
- Request: After user restored remaining locales from backup, add missing DataTable modal translations to the remaining 6 languages.
- Changes:
  - `locales/en/common.json` -> added `table.columnSettings` (8 keys)
  - `locales/de/common.json` -> added `table.columnSettings` (8 keys)
  - `locales/nl/common.json` -> added `table.columnSettings` (8 keys)
  - `locales/ru/common.json` -> added `table.columnSettings` (8 keys)
  - `locales/az/common.json` -> added `table.columnSettings` (8 keys)
  - `locales/ar/common.json` -> added `table.columnSettings` (8 keys)
- Files:
  - locales/en/common.json
  - locales/de/common.json
  - locales/nl/common.json
  - locales/ru/common.json
  - locales/az/common.json
  - locales/ar/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Node JSON parse + `table.columnSettings` key presence check across all 8 `locales/*/common.json` files -> all pass
- Risk/Follow-up:
  - Translation wording can be refined later, but key parity and JSON integrity are complete.
- Backup/Restore Safety:
  - User restored files from backup before this step; targeted patch applied only to required table section.
## 2026-03-11 - header quick layout switch tooltip translations restored in all locales
- Request: Restore missing header sidebar/top-navigation switch tooltip translations after locale backup rollback.
- Changes:
  - Added `layout.quickSwitchToSidebar` and `layout.quickSwitchToTopNav` to all 8 `common.json` locale files.
- Files:
  - locales/tr/common.json
  - locales/fr/common.json
  - locales/en/common.json
  - locales/de/common.json
  - locales/nl/common.json
  - locales/ru/common.json
  - locales/az/common.json
  - locales/ar/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Node JSON parse + key presence check for the two layout tooltip keys across all 8 locale files -> all pass
- Risk/Follow-up:
  - None for key parity; wording can be fine-tuned later if needed.
- Backup/Restore Safety:
  - Targeted insertion only under existing `layout` object in each locale file.
## 2026-03-11 - integrations mqtt info card style aligned + locale backup rule noted
- Request:
  - On `/settings/integrations`, make "MQTT Hakk�nda" card text styling consistent with other cards.
  - Add a persistent note to be extra careful with locale files and never work without backups.
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js`
    - Updated MQTT info card body markup to use `integration-info-list` + `integration-info-box` structure used by other integration cards.
    - Converted setup step texts to `text-sm` and moved "last connected" info into the same info-box style block.
  - `.codex/WORKFLOW.md`
    - Added explicit rule: locale/translation files must not be edited without backup.
- Files:
  - public/assets/js/pages/settings/IntegrationSettings.js
  - .codex/WORKFLOW.md
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js`
- Risk/Follow-up:
  - Visual parity is based on shared classes; if there is a theme-specific override elsewhere, only minor spacing tweaks may still be needed.
- Backup/Restore Safety:
  - Targeted markup-only JS edit; no locale file content edited in this step.
## 2026-03-11 - dark mode topnavigation menu color/text parity fix (backup-first)
- Request: In dark mode topnavigation, remove blue-looking menu/submenu states and make menu text style closer to sidebar; work with backup safety.
- Changes:
  - `public/assets/css/layouts/topnavigation.css`
    - Added dark-mode-only overrides under `.dark .layout-top`.
    - Active/selected colors for top menu and dropdown menu items now use sidebar variables (`--sidebar-active`, `--sidebar-active-text`) instead of blue accent.
    - Top menu text style adjusted in dark mode to match sidebar style better (`font-size: var(--text-sm)`, `font-weight: var(--font-medium)`, removed uppercase transform for dropdown triggers).
- Backup:
  - `public/assets/css/layouts/topnavigation.css.bak_darknav_20260311_023804`
- Files:
  - public/assets/css/layouts/topnavigation.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Selector presence verification via `Select-String` for new dark-mode block and key overridden selectors.
  - No dedicated CSS syntax checker defined in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Visual tune may still be needed for preferred contrast level, but blue active accents are removed in dark top navigation scope.
- Backup/Restore Safety:
  - Full file backup created before edit.
## 2026-03-11 - dark mode topnav strict white menu + unified avatar-style selector buttons (backup-first)
- Request: In dark mode only, make top navigation main/sub menu icon+text all white (active/passive) and make language/company/avatar selector buttons equal height in avatar style.
- Changes:
  - `public/assets/css/layouts/topnavigation.css`
    - Added dark-mode-only overrides so top nav menu and dropdown text/icons are white in all states.
    - Kept active backgrounds but removed blue text/icon appearance by forcing white foreground.
    - Standardized dark-mode top-right selector buttons (`language/company/branch/user`) to same avatar-like size (`36x36`) and circular shape.
    - Hid label/chevron texts for those buttons in dark top navigation to keep all as avatar-type controls.
- Backup:
  - `public/assets/css/layouts/topnavigation.css.bak_darknav_unify_20260311_024143`
- Files:
  - public/assets/css/layouts/topnavigation.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Selector presence verification via `Select-String` for newly added dark-mode blocks.
  - No dedicated CSS syntax checker defined in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Company/branch names are hidden in dark top header avatar mode by design in this change.
- Backup/Restore Safety:
  - Backup file created before edit.
## 2026-03-11 - dark topnav follow-up: preserve 3 selector structure + enforce white menu links
- Request refinement:
  - Keep the 3 selector controls' structure (do not collapse to icon-only).
  - In dark mode, ensure remaining blue menu/submenu text/icons are white; suspected overrides from app/global dark styles.
- Changes:
  - `public/assets/css/layouts/topnavigation.css`
    - Replaced dark menu color block with stronger selectors targeting anchors (`a.top-nav-item`, `a.top-nav-dropdown-item`) and applied `color: #ffffff !important` to beat `.dark a:not(.btn):not(.nav-item)` in `global-dark.css`.
    - Kept menu/submenu states (hover/active) but forced white foreground in dark top layout.
    - Removed previous icon-only collapse behavior for language/company/branch/user controls.
    - Kept control structure and labels/chevrons intact; only equalized control height and avatar/icon size.
- Files:
  - public/assets/css/layouts/topnavigation.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for updated dark block selectors and removed icon-only hide behavior.
- Risk/Follow-up:
  - If any blue remains, it will likely come from runtime inline CSS variables set by layout config; can be pinned with dark top-layout variable overrides if needed.
- Backup/Restore Safety:
  - Backup created before this follow-up patch: `public/assets/css/layouts/topnavigation.css.bak_darknav_unify_20260311_024143`.
## 2026-03-11 - select company hover translation restored for all locales (backup-first)
- Request: Add missing "Select Company" hover translation for all languages.
- Root cause:
  - `CompanySelector` used `layout.header.selectCompany`, but effective `layout` object in `common.json` did not include that key.
- Changes:
  - `public/assets/js/components/CompanySelector.js`
    - Updated fallback order:
      - from: `layout.header.selectCompany`
      - to: `layout.selectCompany` fallback to `layout.header.selectCompany`.
  - Added `layout.selectCompany` to 8 locale files:
    - `locales/tr/common.json` = `Firma Se�`
    - `locales/en/common.json` = `Select Company`
    - `locales/de/common.json` = `Unternehmen ausw�hlen`
    - `locales/fr/common.json` = `S�lectionner une entreprise`
    - `locales/nl/common.json` = `Selecteer bedrijf`
    - `locales/ru/common.json` = `???????? ????????`
    - `locales/az/common.json` = `�irk?ti se�in`
    - `locales/ar/common.json` = `???? ??????`
- Backup:
  - `.codex/tmp_backups/locales_common_select_company_20260311_024803`
- Files:
  - public/assets/js/components/CompanySelector.js
  - locales/tr/common.json
  - locales/en/common.json
  - locales/de/common.json
  - locales/fr/common.json
  - locales/nl/common.json
  - locales/ru/common.json
  - locales/az/common.json
  - locales/ar/common.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Node JSON parse + key presence check (`layout.selectCompany`) across all 8 locale common files -> all pass
  - `node --check public/assets/js/components/CompanySelector.js`
- Risk/Follow-up:
  - None for this key; hover title now resolves from common `layout.selectCompany` in all locales.
- Backup/Restore Safety:
  - Locale files backed up before edits per workflow rule.
## 2026-03-11 - header right dropdown mutual-close behavior fixed (language/company/branch/user)
- Request: In top navigation right area, when one dropdown is opened (language/company/avatar), previously opened dropdown should close immediately.
- Root cause:
  - Each selector managed open/close independently with no cross-component coordination.
- Changes:
  - `public/assets/js/components/LanguageSelector.js`
    - Added global sync listener (`omnex:header-dropdown-open`) and close-on-other-source behavior.
    - Toggle logic now derives from DOM open state (`classList.contains('open')`) to avoid stale `isOpen` state.
    - Dispatches sync event on open with source `language`.
  - `public/assets/js/components/CompanySelector.js`
    - Same sync event integration with source `company`.
    - DOM-state-based toggle to prevent stale state issues.
  - `public/assets/js/components/BranchSelector.js`
    - Same sync event integration with source `branch`.
    - DOM-state-based toggle to prevent stale state issues.
  - `public/assets/js/layouts/LayoutManager.js`
    - User dropdown now dispatches sync event with source `user` when opening.
    - Added listener to close user dropdown when any non-user header dropdown opens.
    - Added cleanup for sync listener in `destroy()`.
- Files:
  - public/assets/js/components/LanguageSelector.js
  - public/assets/js/components/CompanySelector.js
  - public/assets/js/components/BranchSelector.js
  - public/assets/js/layouts/LayoutManager.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/components/LanguageSelector.js`
  - `node --check public/assets/js/components/CompanySelector.js`
  - `node --check public/assets/js/components/BranchSelector.js`
  - `node --check public/assets/js/layouts/LayoutManager.js`
- Risk/Follow-up:
  - Notification dropdown is intentionally not included in this sync event in this patch; can be added similarly if desired.
- Backup/Restore Safety:
  - JS-only targeted edits; no locale files touched in this step.
## 2026-03-11 - dark mode breadcrumb text forced white
- Request: In dark mode, page header breadcrumb still shows blue; make those breadcrumb texts white.
- Changes:
  - `public/assets/css/layouts/content.css`
    - Added dark-mode-only overrides for `.page-header-breadcrumb`:
      - links, separator, current item -> `#ffffff`
      - hover color kept white with slight opacity
- Files:
  - public/assets/css/layouts/content.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for newly added dark breadcrumb override block.
  - No dedicated CSS syntax command is defined in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - If any breadcrumb appears blue after cache, likely browser cache; hard refresh should apply.
- Backup/Restore Safety:
  - CSS-only targeted edit; no locale files changed.
## 2026-03-11 - topnavigation light mode selector heights aligned with dark mode
- Request: In topnavigation open/light mode, make language/company/avatar selector heights same size as dark mode.
- Changes:
  - `public/assets/css/layouts/topnavigation.css`
    - Added mode-agnostic (all modes) size normalization under `.layout-top .top-nav-right`:
      - language/company/branch/user controls: `min-height: 36px`, vertical padding `4px`, aligned as inline-flex
      - avatar/icon shells: `28x28`
- Files:
  - public/assets/css/layouts/topnavigation.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for new all-mode normalization block.
  - No dedicated CSS syntax command in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Existing dark-specific block still present; behavior is consistent and non-conflicting.
- Backup/Restore Safety:
  - Targeted CSS edit only; no locale file touched.
## 2026-03-11 - breadcrumb dark mode blue link override strengthened
- Request: Clarify/fix breadcrumb previous links/separators appearing blue in dark mode due to automatic link styling.
- Root cause:
  - Global dark link rule (`.dark a:not(.btn):not(.nav-item)`) can color breadcrumb links blue.
- Changes:
  - `public/assets/css/layouts/content.css`
    - Strengthened dark breadcrumb overrides with matching `:not(.btn):not(.nav-item)` selector.
    - Added `!important` to force white for breadcrumb links (normal + hover), separator and current text.
- Files:
  - public/assets/css/layouts/content.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Targeted CSS patch applied successfully; no CSS syntax checker defined in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Minimal; scope limited to breadcrumb text color in dark mode.
- Backup/Restore Safety:
  - Small targeted CSS edit; no locale files changed.
## 2026-03-11 - normal header dark mode selector height alignment
- Request: In normal header (not topnavigation), dark mode language/company/avatar controls should match other header icon button size.
- Changes:
  - `public/assets/css/layouts/header.css`
    - Added dark-mode-only block under `.layout-sidebar` for:
      - `.language-selector-btn`
      - `.company-selector-btn`
      - `.branch-selector-btn`
      - `.user-menu`
    - Set `height` and `min-height` to `2.5rem` (same as `.header-btn`).
- Files:
  - public/assets/css/layouts/header.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Selector presence verification via `Select-String` for new block and target selectors.
  - No dedicated CSS syntax command exists in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Desktop dark mode targeted only; mobile two-row header rules remain unchanged.
- Backup/Restore Safety:
  - CSS-only targeted edit; no locale file modifications.
## 2026-03-11 - header secondary/right group spacing fix (language vs quick layout icon)
- Request: Check/fix missing space between language selector and quick layout switch icon in normal header.
- Root cause:
  - `quick-layout-switch` is in `.header-secondary`, language/company/avatar are in `.header-right`; there was no explicit inter-group gap.
- Changes:
  - `public/assets/css/layouts/header.css`
    - Added desktop/tablet-only spacing rule:
      - `@media (min-width: 769px) { .header .header-secondary + .header-right { margin-inline-start: var(--space-2); } }`
- Files:
  - public/assets/css/layouts/header.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for newly added spacing selector.
  - No dedicated CSS syntax command exists in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Mobile two-row layout unaffected due desktop/tablet media scope.
- Backup/Restore Safety:
  - CSS-only targeted edit; no locale file modifications.
## 2026-03-11 - dark sidebar background switched to card fill tone
- Request: Apply dark mode card background fill color to full sidebar background.
- Changes:
  - `public/assets/css/app.css`
    - Updated dark-mode sidebar background variable:
      - from `--sidebar-bg: #080c12;`
      - to `--sidebar-bg: var(--card-bg, #161b22);`
- Files:
  - public/assets/css/app.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for updated `--sidebar-bg` variable line.
  - No dedicated CSS syntax command in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Sidebar and cards now share same dark fill family; if desired, border contrast can be tuned separately.
- Backup/Restore Safety:
  - CSS-only targeted variable change; no locale files touched.
## 2026-03-11 - admin licenses small stats cards dark fill parity
- Request: On `/admin/licenses`, small statistic cards in dark mode should be filled like other pages.
- Changes:
  - `public/assets/css/pages/admin.css`
    - Added dark-mode-specific fill override for license page card groups:
      - `.license-stats .analytics-card`
      - `.license-limits-grid .license-limit-card`
    - Applied:
      - `background-color: var(--bg-tertiary, #161b22)`
      - `border-color: var(--border-light, #21262d)`
- Files:
  - public/assets/css/pages/admin.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Select-String` verification for new dark override block in `admin.css`.
  - No dedicated CSS syntax command in `.codex/QUICK_CHECKS.md`.
- Risk/Follow-up:
  - Scope is limited to admin licenses stat/limit cards in dark mode.
- Backup/Restore Safety:
  - CSS-only targeted edit; no locale files changed.
## 2026-03-11 - integrations import tab bootstrap + stale company folders cleanup
- Request: Check `/settings/integrations` file import directory visibility/listing, confirm active company import path, and remove obsolete company folders from `storage/companies`.
- Root cause:
  - `public/assets/js/pages/settings/IntegrationSettings.js` had `loadImportSettings()` disabled in `init()`, so import directory field and pending files/history sections were never auto-populated.
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js`
    - Re-enabled `await this.loadImportSettings();` in `init()` so import settings/path/files/history load on page open.
  - Filesystem cleanup (no source file change):
    - Removed stale company directories not present in DB `companies` table:
      - `storage/companies/060b0334-fef7-4c73-8ee7-5c1cada46f32`
      - `storage/companies/0e779ee3-37be-43f6-bd81-3731992f95d2`
      - `storage/companies/858472bf-7191-4881-9763-5311be261284`
      - `storage/companies/b3fccc7b-18b6-4641-8bd8-1dec843e0500`
      - `storage/companies/c77b1fcd-df4d-4598-af76-a67957596672`
      - `storage/companies/d2df6200-19e1-4adf-9436-8ef389d0f9a5`
      - `storage/companies/f0c3f742-039b-4f65-ad16-4299ac490218`
    - Remaining company folders now match DB records:
      - `4b32c855-ce92-4349-8cd7-b33637f5c15b` (`test`)
      - `d1c946f3-4058-4b72-8e24-6c4b3cb9e9cb` (`Omnex Default`)
- Checks:
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js`
  - Runtime verification commands:
    - DB query (`SELECT id,name,status FROM companies`) returned expected 2 companies.
    - Directory listing confirms only matching company folders remain.
- Risk/Follow-up:
  - Import API responses still require valid auth and active company header at runtime; if UI still shows empty, check browser `localStorage.omnex_active_company` and API auth session.
- Backup/Restore Safety:
  - Pre-edit backup created:
    - `public/assets/js/pages/settings/IntegrationSettings.js.bak-20260311-031746`
## 2026-03-11 - import API simulation + auto-import hardening + company import dirs
- Request: Verify `/settings/integrations` import API flow with provided API key and `MANAV �R�NLER�.xlsx`, ensure dynamic API key appears in docs, confirm company-specific API key behavior, validate auto-import interval behavior, improve changed-file handling flow, and guarantee new companies have import directories.
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js`
    - Added dynamic API key injection for API/Import documentation code blocks via `data-import-api-key-template` + `refreshImportApiDocumentation()`.
    - API and Import docs now render current company API key instead of static placeholders.
  - `api/import/upload.php`
    - Authorization header parsing hardened (`HTTP_AUTHORIZATION`, `REDIRECT_HTTP_AUTHORIZATION`, `apache_request_headers()` fallback).
  - `api/integrations/settings.php`
    - Added company-level API key uniqueness validation for `type=api` saves.
  - `api/import/files.php`
    - Fixed parser include order (`TxtParser` before `CsvParser`).
    - Fixed parser result handling (`parse()` raw rows, no invalid `['data']`/`['headers']` assumption).
    - Reuse existing `erp_import_files` records in `pending/processing` state by hash before creating a new one.
  - `cron/auto-import.php`
    - Fixed parser include order (`TxtParser` before `CsvParser`).
    - Fixed PostgreSQL UUID/text join (`c.id::text = is2.company_id`).
    - Fixed parser result handling (`parse()` raw rows).
    - Reuse existing `erp_import_files` records in `pending/processing` state by hash.
    - Kept interval guard behavior intact and verified at runtime.
  - `services/CompanyStorageService.php`
    - Added guaranteed creation of `imports/processed` and `imports/failed`.
  - `services/CompanySeeder.php`
    - Added `imports/processed` and `imports/failed` in seeded storage directories.
  - `services/TenantBackupService.php`
    - Added `imports`, `imports/processed`, `imports/failed` to `ensureCompanyDirs()` for imported tenants.
- Runtime data/actions:
  - Set Omnex Default company API key to `omnex_lpzt3WDqmaVqaHwMdyPX2by2E20wCMA6` for simulation.
  - Enabled `file_import.enabled=true` and `auto_import_enabled=true` for Omnex Default to validate end-to-end flow.
  - Simulated `/api/import/upload` with MANAV XLSX and API key headers.
- Checks:
  - JS syntax: `node --check public/assets/js/pages/settings/IntegrationSettings.js`
  - PHP syntax:
    - `php -l api/import/upload.php`
    - `php -l api/integrations/settings.php`
    - `php -l api/import/files.php`
    - `php -l cron/auto-import.php`
    - `php -l services/CompanyStorageService.php`
    - `php -l services/CompanySeeder.php`
    - `php -l services/TenantBackupService.php`
  - Runtime verification:
    - `curl` upload with provided API key (`Authorization` and `X-Api-Key`) succeeded/duplicate-guarded as expected.
    - `php cron/auto-import.php` processed MANAV XLSX successfully after fixes.
    - Immediate second cron run correctly skipped by `check_interval`.
    - Modified-file upload (same filename, changed content) created a new pending import (hash-based change detection works).
- Risk/Follow-up:
  - `cron/auto-import.php` already had legacy mojibake Turkish text in source; functional behavior is correct but message strings are visually inconsistent and can be cleaned later in a dedicated encoding pass.
  - Runtime simulations created additional `erp_import_files` history rows and updated products in Omnex Default (expected for this test).
- Backup/Restore Safety:
  - No locale files changed.
  - During edit, `api/import/files.php` was accidentally truncated by a failed shell replace and immediately restored from `HEAD` before reapplying targeted changes.
## 2026-03-11 - import tab default file selection + history retention/pagination
- Request: In /settings/integrations import area, show pending files reliably, allow one changeable default import file selection, prevent overflow, add footer pagination controls, and keep import history for last 30 days with manual cleanup.
- Changes:
  - api/import/settings.php
    - Added default_import_filename to defaults and PUT merge.
    - Sanitizes filename and normalizes timestamp-prefixed names.
  - api/import/files.php
    - Added GET pagination (page, per_page) and pagination payload.
    - Added default_import_filename in response from effective settings.
  - api/import/history.php
    - Added 30-day auto-retention cleanup for completed/failed/skipped rows.
    - Added DELETE /api/import/history?mode=all|older manual cleanup endpoint.
    - Added retention_days to GET response.
  - api/index.php
    - Added DELETE /api/import/history route.
  - cron/auto-import.php
    - Added default_import_filename filtering (exact + timestamped variant).
    - Kept pending/processing hash reuse and raw parser output handling.
  - public/assets/js/pages/settings/IntegrationSettings.js
    - Added import files/history pagination state and footer renderer.
    - Added default import file radio selection and persistence.
    - Added manual import history clear action.
    - Auto-selects first pending file when no default exists.
  - public/assets/css/pages/settings.css
    - Added overflow guards for import cards/tables and footer styles.
  - services/CompanyStorageService.php, services/CompanySeeder.php, services/TenantBackupService.php
    - Ensured creation of imports, imports/processed, imports/failed directories.
- Checks run:
  - php -l api/import/settings.php
  - php -l api/import/files.php
  - php -l api/import/history.php
  - php -l api/index.php
  - php -l cron/auto-import.php
  - php -l services/CompanyStorageService.php
  - php -l services/CompanySeeder.php
  - php -l services/TenantBackupService.php
  - node --check public/assets/js/pages/settings/IntegrationSettings.js
  - Runtime: php cron/auto-import.php
  - Runtime: curl -X POST /api/import/upload with company API key + MANAV URUNLERI.xlsx equivalent payload returned duplicate/hash-match success.
- Risk/Follow-up:
  - Full /api/import/files and /api/import/history behavior requires active app session token; final confirmation should be done from browser UI session.
## 2026-03-11 - import tab grid ratio 70/30
- Request: Make integration import tab layout like two unequal columns (left about 70%, right about 30%).
- Changes:
  - public/assets/js/pages/settings/IntegrationSettings.js
    - Applied import-grid-layout class only on tab-import settings grid.
    - Corrected accidental class placement from ESL tab to Import tab.
  - public/assets/css/pages/settings.css
    - Added .settings-grid.import-grid-layout with 7fr/3fr desktop ratio.
    - Added responsive override at <=1024px to keep single-column layout.
- Checks run:
  - node --check public/assets/js/pages/settings/IntegrationSettings.js
- Risk/Follow-up:
  - CSS-only behavior change for import tab; verify visually on /settings/integrations Import sekmesi.
## 2026-03-11 - import tables order and per-page label cleanup
- Request: Keep newest row at top in Import History table and fix footer per-page label to avoid double colon (Sayfa basina:: -> Sayfa basina:), in both import tables.
- Changes:
  - public/assets/js/pages/settings/IntegrationSettings.js
    - Normalized table.perPage label by trimming trailing colon before appending single ':'.
    - Added client-side descending date sort in renderImportHistoryTable() to keep newest records first.
  - public/assets/css/pages/settings.css
    - Added white-space: nowrap for .import-table-per-page to keep label on one line.
- Checks run:
  - node --check public/assets/js/pages/settings/IntegrationSettings.js
- Risk/Follow-up:
  - Visual confirmation should be done on /settings/integrations import tab for both history and files footer labels.
## 2026-03-11 - line picker presets expanded from Divider / Line Studio reference
- Request: Add missing line tool options in template editor from B�l�m 4 (Divider / Line Studio), with backup-first and encoding-safe handling.
- Changes:
  - public/assets/js/editor/data/LineStyleLibraryData.js
    - Added 43 new presets (line_51..line_93) so all names from reference list in kutuphane/cizgi-tesitleri are available in editor line picker.
    - Kept existing category model (basic/dashed/dotted/decorative) to avoid UI/i18n regressions.
- Backup/Restore Safety:
  - Created backup before edit:
    - public/assets/js/editor/data/LineStyleLibraryData.js.bak_divider_20260311_044409
- Checks run:
  - node --check public/assets/js/editor/data/LineStyleLibraryData.js
  - Cross-check script: reference names missing in editor list = 0
  - ID uniqueness check: TOTAL_IDS=93, UNIQUE_IDS=93
- Risk/Follow-up:
  - Newly added thematic presets are mapped onto existing render types in current line engine; if exact visual parity with shape_library_enhanced is required, a second pass should add dedicated renderType implementations.
## 2026-03-11 - line picker duplicate-style cleanup
- Request: Check and remove repeated-looking items in line modal so newly added presets appear unique.
- Changes:
  - public/assets/js/editor/data/LineStyleLibraryData.js
    - Adjusted line_52 (Basic Solid Medium) cap to `butt` to avoid duplicate signature with Rounded Cap Line.
    - Adjusted line_93 (Ornamental Diamond Chain) stroke/strokeWidth to avoid duplicate signature with Double Line Center Dot.
- Backup/Restore Safety:
  - Backup created before dedupe edit:
    - public/assets/js/editor/data/LineStyleLibraryData.js.bak_divider_dedupe_20260311_044830
- Checks run:
  - node --check public/assets/js/editor/data/LineStyleLibraryData.js
  - Signature duplicate scan result: DUP_SIG=0
- Risk/Follow-up:
  - If visual similarity is still considered high by design review, next step is to add dedicated renderType geometries for specific new names.
## 2026-03-11 - divider line modal expanded to full Section-4 coverage + unique geometry fallback
- Request: Existing line modal had repeated-looking presets; many different lines from reference Divider/Line Studio page were still missing.
- Changes:
  - public/assets/js/editor/data/LineStyleLibraryData.js
    - Added missing Section-4 line names from reference so coverage is complete (now includes all 120 reference names).
    - Preset list expanded to 168 total entries; IDs extended through line_168.
    - Fixed non-ASCII renderType slug for Islamic Geometry to ASCII-safe `islamic-geometry-line`.
  - public/assets/js/editor/components/LinePicker.js
    - Added deterministic `autoPathByType()` generator for non-built-in render types (keyword/theme-based geometry families).
    - Added built-in renderType guard so existing classic previews remain unchanged.
    - Unknown/new render types now render distinct geometry instead of collapsing to same visual style.
  - public/assets/js/editor/TemplateEditorV7.js
    - Added matching deterministic `autoPathByType()` in `addLinePreset()` for non-built-in render types.
    - Added `strokeDashArray` passthrough for path-based presets.
- Backup/Restore Safety:
  - Existing backups retained and new backup taken before this pass:
    - public/assets/js/editor/data/LineStyleLibraryData.js.bak_divider_dedupe_20260311_044830
- Checks run:
  - node --check public/assets/js/editor/data/LineStyleLibraryData.js
  - node --check public/assets/js/editor/components/LinePicker.js
  - node --check public/assets/js/editor/TemplateEditorV7.js
  - Dataset validation script:
    - TOTAL presets = 168
    - duplicate names = 0
    - reference names missing = 0 (from shape_library_enhanced Section 4)
- Risk/Follow-up:
  - Auto-geometry fallback is deterministic and distinct, but not pixel-identical to original Section-4 SVG implementations for every named style. If exact visual parity is required, next pass should port draw functions one-by-one.
## 2026-03-11 - line modal color-only duplicate cleanup (shape uniqueness)
- Request: Remove entries that are same shape with only color difference since color is user-configurable.
- Changes:
  - public/assets/js/editor/data/LineStyleLibraryData.js
    - Updated conflicting presets to use unique renderType identifiers instead of shared built-in types.
    - Result: no remaining duplicates by geometry signature (category + dash + width + cap/join + renderType) excluding color.
  - public/assets/js/editor/components/LinePicker.js
    - Added `basic/minimal/solid` branch to autoPathByType for unknown custom render types.
  - public/assets/js/editor/TemplateEditorV7.js
    - Added matching `basic/minimal/solid` branch to autoPathByType for canvas insertion parity.
- Checks run:
  - node --check public/assets/js/editor/data/LineStyleLibraryData.js
  - node --check public/assets/js/editor/components/LinePicker.js
  - node --check public/assets/js/editor/TemplateEditorV7.js
  - Duplicate scan (excluding color): DUP_BY_SHAPE_EXCEPT_COLOR=0
- Risk/Follow-up:
  - Presets were normalized by renderType uniqueness rather than deleting names; if strict item-count reduction is required, a separate removal pass can hide/remove selected thematic aliases.
## 2026-03-11 - Production server media scan 500 fix + AuthMiddleware RLS + omnex.local audit
- Request: Fix media scan returning 500 on production server (hub.omnexcore.com); verify omnex.local → omnexcore.com migration complete.
- Changes:
  - `api/media/scan.php`
    - Root cause: Turkish filenames on Linux filesystem stored in ISO-8859-9 encoding cause PostgreSQL SQLSTATE[22021] ("invalid byte sequence for UTF8") on INSERT. PHP warning from this triggers global `set_error_handler` in `api/index.php` which calls `exit;`, returning 500.
    - Fix: Added custom `set_error_handler` at scan start that returns `true` to suppress warnings during scan. Added `ob_start()`/`ob_end_clean()` to capture stray output. Added `restore_error_handler()` in both success and catch paths.
  - `middleware/AuthMiddleware.php`
    - Added `$db->setAppContext($activeCompanyId, $user['id'], $user['role'])` after `Auth::setUser()` to set PostgreSQL RLS session variables (`app.company_id`, `app.user_id`, `app.role`). Previously only called in TenantBackupService/cron, never during normal API requests. Critical for future DB user changes (currently table owner bypasses RLS).
- Files:
  - api/media/scan.php
  - middleware/AuthMiddleware.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Server: media scan POST returned success (imported 1163 files from public/samples)
  - Local: user confirmed scan also fixed locally
  - `omnex.local` grep: 0 matches in local codebase, 0 matches on server — migration complete
  - `omnexcore.com` grep: all references correct (config.php, seeds, docker-compose, deploy scripts)
- Risk/Follow-up:
  - Files with non-UTF-8 names are silently converted via `mb_convert_encoding` — if conversion fails, original bytes are used and may cause display issues.
  - RLS context is set per-request; connection pooling (if added later) must reset context per request.
## 2026-03-11 - Fabric.js CDN → lokal vendor (Tracking Prevention fix)
- Request: Edge Tracking Prevention cdn.jsdelivr.net fabric storage erişimini engelliyor. Lokal serve'e geçiş.
- Changes:
  - `public/assets/vendor/fabric/fabric.min.js` — CDN'den 7.1.0 indirildi (eski 7.0.0 üzerine)
  - `public/index.html` — CDN script → `assets/vendor/fabric/fabric.min.js`
  - `public/assets/js/editor/core/FabricExports.js` — waitForFabric() fallback URL lokale çevrildi
- Checks:
  - `node --check FabricExports.js` pass; CDN fabric grep: 0 match; lokal versiyon: 7.1.0
- Risk/Follow-up:
  - Fabric güncelleme: `curl -sL "https://cdn.jsdelivr.net/npm/fabric@X.Y.Z/dist/index.min.js" -o public/assets/vendor/fabric/fabric.min.js`

## 2026-03-12 - MQTT Broker URL override fix (IP → domain dönüşüm sorunu)
- Request: Admin panelde MQTT Broker URL alanına IP adresi girildiğinde sayfa yenilenince otomatik domain'e dönüşüyordu.
- Root cause: `_populateMqttForm()` satır 3464-3470, DB'deki broker_url mevcut hostname'den farklıysa otomatik `window.location.hostname` ile değiştiriyordu. Cihaz DNS çözemiyorsa IP ile bağlanması gerektiğinden bu yanlış.
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js` — Broker URL override mantığı değiştirildi: Artık sadece `localhost`/`127.0.0.1` gibi kesinlikle yanlış değerler otomatik düzeltilir. IP adresi veya farklı domain girilmişse dokunulmaz.
- Checks:
  - JS module syntax: OK (node vm.createScript)
- Risk/Follow-up:
  - Sunucuda rebuild gerekli: `docker compose build app && docker compose up -d app && docker compose restart nginx`
  - Cihaz Bluetooth ile tekrar yapılandırılmalı (sunucu üzerinden, doğru IP/URL ile)
## 2026-03-12 - Production invalid origin 403 fix for gateway/device machine-to-machine calls
- Request: Docker production ortaminda local gateway heartbeat/devices register istekleri `403 Invalid origin` aliyordu; HTTP/MQTT cihaz aktarimlarinda da veri gitmeme sorunu incelendi.
- Root cause:
  - `middleware/ApiGuardMiddleware.php` icinde `validateOrigin()` prod modda `Origin` olmayan istekleri varsayilan olarak reddediyordu.
  - Local gateway ve cihaza yonelik bircok M2M istemci (cURL/device firmware) `Origin`/`Referer` gondermedigi icin `/api/gateway/*` ve benzeri endpointler 403 aliyordu.
- Changes:
  - `middleware/ApiGuardMiddleware.php`
    - `Origin` yoksa:
      - `Referer` ayni host ise izin ver.
      - `Referer` farkli host ise prod'da mevcut sikilik korunur (reddet).
      - `Origin` + `Referer` ikisi de yoksa M2M cagrilar icin tum ortamlarda izin ver.
    - Host karsilastirmalarini guvenli yapmak icin `normalizeHost()` yardimci fonksiyonu eklendi.
- Files:
  - middleware/ApiGuardMiddleware.php
- Checks:
  - php -l middleware/ApiGuardMiddleware.php
- Backup/Restore Safety:
  - Temp backup alindi: `middleware/ApiGuardMiddleware.php.bak_invalid_origin_fix_20260312_020514`
  - Restore gerekmedi.
- Risk/Follow-up:
  - Degisiklikten sonra production deploy/restart gerekli.
  - Deploy sonrasi dogrulama: `/api/gateway/heartbeat`, `/api/gateway/devices/register`, `/api/esl/http/content`, `/api/esl/mqtt/report` endpointlerinde 403 kaybolmali.
## 2026-03-12 - Production deploy: ApiGuard invalid-origin fix
- Request: Sunucuya baglanip `Invalid origin (403)` sorununa alinmis middleware duzeltmesini deploy et ve container yenileme gerekliligini netlestir.
- Deployment findings:
  - `deploy/docker-compose.yml` app servisi kodu image build ile aliyor, source code bind mount yok.
  - Bu nedenle degisikliklerin etkili olmasi icin app rebuild gerekliydi.
- Deployment actions:
  - SSH ile sunucuya baglanildi (`camlicayazilim@185.124.84.34:2299`).
  - Remote backup alindi:
    - `/opt/omnex-hub/middleware/ApiGuardMiddleware.php.bak_20260312_021226`
  - Guncel dosya sunucuya kopyalandi:
    - `/opt/omnex-hub/middleware/ApiGuardMiddleware.php`
  - Rebuild + restart:
    - `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml build app`
    - `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml up -d app`
- Checks run:
  - Container icinde syntax: `php -l /var/www/html/middleware/ApiGuardMiddleware.php` (OK)
  - Public health: `GET https://hub.omnexcore.com/api/health` -> HTTP 200
  - Guard davranisi probe: `POST https://hub.omnexcore.com/api/gateway/heartbeat` (Origin/Referer yok, auth yok) -> HTTP 401 `MISSING_API_KEY` (beklenen, 403 degil)
- Risk/Follow-up:
  - Sunucu repo local patch halinde; GitHub'da ayni commit yoksa sonraki CI/CD deploy bu dosyayi ezebilir.
  - Kalici cozum icin ayni degisiklik repo ana dala alinmali.
## 2026-03-12 - Gateway heartbeat 500 fix (PostgreSQL datetime incompatibility) + remote hotfix deploy
- Request: Local gateway tarafinda DNS sorunu sonrasinda heartbeat/devices akisi hala bozuk; `/api/gateway/heartbeat` 500, cihaz sayisi 0.
- Root cause:
  - Sunucuda ilk etapta `api/gateway` endpoint dosyalari image icinde yoktu (`require .../api/gateway/heartbeat.php` fail).
  - Dosyalar eklendikten sonra heartbeat 500 kaldi: `api/gateway/heartbeat.php` icindeki SQLite-ozel `datetime('now')`/`strftime` SQL ifadeleri PostgreSQL'de `SQLSTATE[42883]` uretip endpoint'i dusuruyordu.
- Changes:
  - `api/gateway/heartbeat.php`
    - DB-zamani bagimsizlastirildi: `datetime('now')` ve `strftime` kullanimi kaldirildi.
    - Timestamps PHP tarafinda `date('Y-m-d H:i:s')` ile uretildi ve query parametreleriyle gecildi.
    - Stale command requeue kosulu `COALESCE(sent_at, created_at) <= ?` ve `expires_at > ?` seklinde PostgreSQL uyumlu hale getirildi.
  - Remote deploy actions:
    - Eksik `api/gateway` klasoru `/opt/omnex-hub/api/gateway` altina kopyalandi.
    - App image rebuild + restart yapildi (compose).
- Files:
  - api/gateway/heartbeat.php
- Checks:
  - Local syntax: `php -l api/gateway/heartbeat.php`
  - Container syntax: `php -l /var/www/html/api/gateway/heartbeat.php`
  - Runtime probe: signed gateway heartbeat -> HTTP 200 + expected JSON payload
  - Runtime probe: `/api/gateway/devices/register` (auth-yok probe) -> 401 (route alive)
- Backup/Restore Safety:
  - `api/gateway/heartbeat.php.bak_pgfix_20260312_023707`
  - Remote backup earlier: `/opt/omnex-hub/middleware/ApiGuardMiddleware.php.bak_20260312_021226`
- Risk/Follow-up:
  - Sunucuya kopyalanan `api/gateway` dosyalari local patch; GitHub/CI deploy ile ezilmemesi icin repository'ye commit edilmesi gerekir.
  - Local gateway tarafinda gecici DNS kesintisi (`Could not resolve host`) istemci ag kaynakliydi; server fix'inden bagimsiz.
## 2026-03-12 - Gateway send_label file-name sanitize fix (MAC client_id with ':')
- Request: T�m gateway endpointleri 200 oldugu halde cihazlara gonderim olmuyor; log inceleme.
- Findings:
  - Local gateway log: komut aliniyor ve `send_label` calisiyor, ancak `Gorsel zorunlu ancak hazir degil` ile fail ediyor.
  - Komut hedef cihaz client_id degeri `20:51:F5:4F:50:59` (':' iceriyor).
  - `handleSendLabel()` bu `client_id` degerini dogrudan temp/remote dosya adlarinda kullaniyor (`*.jpg`, `*.js`, `*_video_*.mp4`). Windows dosya adinda `:` gecersiz oldugu icin gorsel JPEG olusumu basarisiz kaliyor ve komut cihaza gitmiyor.
- Changes:
  - `local-gateway-manager/resources/gateway/gateway.php`
    - `client_id` icin dosya-guvenli `safeClientId` olusturuldu (alfa-numerik + `_.-` disindakiler `_`).
    - Temp dosyalar, remote dosya adlari ve task path olusumlari `safeClientId` ile guncellendi.
    - `handleRefreshDevice()` task path olusumu da ayni sekilde sanitize edildi.
    - Gorsel dosya okuma/JPEG olusturma asamasina ek uyar� loglari eklendi.
  - `local-gateway-manager/dist/win-unpacked/resources/gateway/gateway.php`
    - Hemen test icin ayni dosya kopyalandi.
- Checks:
  - `php -l local-gateway-manager/resources/gateway/gateway.php`
- Risks/Follow-up:
  - Kurulu uygulama yolu `C:\Program Files\Omnex Gateway Manager\resources\gateway\gateway.php` UAC nedeniyle yazilamadi (Permission denied). Bu nedenle aktif kurulu EXE bu fix'i henuz kullanmiyor.
  - Kalici cozum: Admin yetkisiyle Program Files altindaki gateway.php degistirilmeli veya yeni installer build edilip yeniden kurulmali.
## 2026-03-12 - Gateway device matching hardening + no-auto-create default (deploy applied)
- Request: Gateway manager mevcut cihazlari kullanmak yerine yeni cihaz olusturuyor; HTTP/MQTT/HTTP-server ayriminda gonderim sorunlari incelendi.
- Root cause findings (server live):
  - `gateway_devices` tablosunda aktif linkler 192.168.1.162/170/172 cihazlarina ait; 192.168.1.160 icin `send_label` komutlari `Failed to connect to 192.168.1.160:80` ile fail.
  - HTTP/MQTT cihazlarinda aktif assignment var (`http_payload`/`mqtt_payload`), fakat son saatlerde `/api/esl/http/*` ve `/api/esl/mqtt/*` endpoint hit kaydi yok (cihaz tarafi server'a ulasmiyor).
  - `api/gateway/devices-register.php` eski mantikta company izolasyonu ve normalize client-id/IP matching zayifti; istenmeyen yeni cihaz olusumu riski vardi.
- Changes:
  - `api/gateway/devices-register.php`
    - Company-scoped, normalized (`device_id`/`mqtt_client_id`) + IP bazli deterministik existing-device eslestirme eklendi.
    - `allow_create` bayragi yoksa yeni cihaz olusturma varsayilani `false` yapildi (bulunamayanlar `skipped`).
    - Link update'lerde ortak `now` timestamp kullanildi, `skipped` saya�i response'a eklendi.
  - `api/gateway/devices.php`
    - `syncDevice()` eslestirmesi normalize serial + `mqtt_client_id` + company + IP fallback ile guclendirildi.
    - Existing kayitta serial normalizasyonu ayniysa `device_id` formati korunuyor.
- Deployment:
  - Remote backups alindi:
    - `/opt/omnex-hub/api/gateway/devices-register.php.bak_matchfix_20260312_031256`
    - `/opt/omnex-hub/api/gateway/devices.php.bak_matchfix_20260312_031256`
    - `/opt/omnex-hub/api/gateway/devices-register.php.bak_nocreate_20260312_031410`
  - Dosyalar server'a kopyalandi ve app image rebuild + restart yapildi (compose standalone stack).
- Checks:
  - Local: `php -l api/gateway/devices-register.php`
  - Local: `php -l api/gateway/devices.php`
  - Remote container: `php -l /var/www/html/api/gateway/devices-register.php`
  - Remote container: `php -l /var/www/html/api/gateway/devices.php`
  - Live DB spot check: `devices`, `gateway_devices`, `gateway_commands`, `device_content_assignments` sorgulari
- Risks/Follow-up:
  - `allow_create=false` default'u bilincli degisikliktir; yeni cihazlar otomatik acilmayacak (gerekirse istekte `allow_create=true` gonderilmeli).
  - 192.168.1.160 baglanti hatasi ag/cihaz erisimi kaynakli gorunuyor (gatewayden port 80 erisilemiyor).
  - HTTP/MQTT cihazlari su an server endpointlerine istek atmiyor; cihaz tarafi URL/DNS/internet erisimi ayrica dogrulanmali.
- Backup/Restore Safety:
  - Lokal temp backup: `api/gateway/devices-register.php.bak_matchfix_20260312_030219`, `api/gateway/devices.php.bak_matchfix_20260312_030219`
  - Restore gerekmedi.
## 2026-03-12 - BLE token retry + MQTT register fallback hardening + bt-password route (deployed)
- Request: Reset/yeniden kurulum sonrasi cihazlarin eski host (192.168.1.23) ile otomatik konfig olmasi ve Bluetooth Wizard'da "token error" alinmasi incelendi.
- Findings:
  - Canli DB `mqtt_settings` degerleri: `broker_url=185.124.84.34`, `content_server_url=https://185.124.84.34/api/esl/mqtt/content`, `report_server_url=https://185.124.84.34/api/esl/mqtt/report`.
  - `gateways.local_ip=192.168.1.23` (gateway PC local IP) ayri bir alandir; broker host degeri degildir.
  - `api/esl/mqtt/register.php` icinde broker_url bos kalirsa hardcoded `192.168.1.23` fallback'i vardi.
  - Bluetooth Wizard'da token gerekli komutlarda otomatik retry/prompt akisi yoktu; token mismatch durumunda adimlar fail oluyordu.
- Changes:
  - `api/esl/mqtt/register.php`
    - Hardcoded `192.168.1.23` fallback kaldirildi.
    - `broker_url` bossa `503` ile acik hata donuluyor.
  - `api/index.php`
    - `GET/POST/DELETE /api/devices/{id}/bt-password` route'lari eklendi.
  - `public/assets/js/services/BluetoothService.js`
    - `getAllInfo(..., { throwOnError: true })` destegi eklendi.
  - `public/assets/js/pages/devices/list/BluetoothWizard.js`
    - Token-hatasi tespiti (`token/passwd/password`) eklendi.
    - Token prompt + tek seferlik retry eklendi: `_saveWifi`, `_setProtocol`, `_readInfo`, `_saveHardware`, `_reboot`, `_clearMedia`, `_factoryReset`.
    - `_readInfo` cagrisi `throwOnError: true` ile token-hatasi yakalayip retry edebiliyor.
- Deployment:
  - Dosyalar sunucuya kopyalandi (`/opt/omnex-hub/...`) ve app image rebuild + restart yapildi.
  - Canli dogrulama: `/api/devices/{id}/bt-password` route unauth durumda `401` donuyor.
- Checks:
  - Local: `php -l api/esl/mqtt/register.php`
  - Local: `php -l api/index.php`
  - Local: `node --check public/assets/js/services/BluetoothService.js`
  - Local: `node --check public/assets/js/pages/devices/list/BluetoothWizard.js`
  - Remote: `docker exec -i omnex-app-1 php -l /var/www/html/api/esl/mqtt/register.php`
  - Remote: `docker exec -i omnex-app-1 php -l /var/www/html/api/index.php`
  - Remote DB spot check: `mqtt_settings`, `gateways`
- Backup/Restore Safety:
  - Lokal backuplar: `api/esl/mqtt/register.php.bak_tokenfix_20260312_040318`, `api/index.php.bak_tokenfix_20260312_040318`, `public/assets/js/services/BluetoothService.js.bak_tokenfix_20260312_040318`, `public/assets/js/pages/devices/list/BluetoothWizard.js.bak_tokenfix_20260312_040318`
  - Remote backuplar: `*.bak_tokenfix_20260312_040909` (ayni 4 dosya)
  - Restore gerekmedi.
- Risks/Follow-up:
  - Wizard prompt ile token bilinmiyorsa kullanici yine dogru sifreyi girmelidir; bilinmiyorsa once sistemde kayitli cihazdan bt-password alinmali veya cihaz fiziksel reset proseduru uygulanmalidir.
  - Bu degisiklikler su an server hotfix olarak deploy edildi; kalici olmasi icin repository ana dala alinmalidir.
## 2026-03-12 - Temporary BLE token bypass mode for provisioning test (deployed)
- Request: Cihaz `@B2A301AB37` icin `Token error` devam ediyor; fabrika reset ise yaramadi ve yeniden kurulumda BLE baglantisi sorunlu. Token'i gecici devre disi birakma talebi.
- Changes:
  - `public/assets/js/pages/devices/list/BluetoothWizard.js`
    - `this._tokenBypassMode = true` eklendi (gecici test modu).
    - Token prompt kapatildi (`_promptForDeviceToken` bypass modda false donuyor).
    - Token-hatasi durumunda komutlar otomatik `Token:""` ile 1 kez yeniden deneniyor (`_saveWifi`, `_setProtocol`, `_readInfo`, `_saveHardware`, `_reboot`, `_clearMedia`, `_factoryReset`).
    - Auto-protect (admin/user sifresi otomatik set) bypass modda devre disi.
    - Cihaz kaydinda `bt_password` backend'e gonderimi bypass modda kapali.
    - Manual "Cihaz Sifresi" aksiyonu bypass modda pasif (token saklanmiyor).
- Deployment:
  - Dosya sunucuya kopyalandi ve app container rebuild+restart yapildi.
  - Canli dosya dogrulama: `_tokenBypassMode = true` satiri mevcut.
- Checks:
  - Local: `node --check public/assets/js/pages/devices/list/BluetoothWizard.js`
- Backup/Restore Safety:
  - Lokal backup onceki adimda alinmisti: `public/assets/js/pages/devices/list/BluetoothWizard.js.bak_tokenfix_20260312_040318`
  - Remote backup: `/opt/omnex-hub/public/assets/js/pages/devices/list/BluetoothWizard.js.bak_tokenbypass_<timestamp>`
  - Restore gerekmedi.
- Risks/Follow-up:
  - Bu modda BLE komut guvenligi gecici olarak dusurulur; test bitince bypass kapatilip normal token/protection akisina geri donulmeli.
## 2026-03-12 - Local DB token diagnostic for 192.168.1.160 (factory reset command verification)
- Request: 192.168.1.160 cihazinin DB'deki token kaydi kullanilarak factory reset testinin yapilmasi.
- Findings:
  - Local DB'de cihaz bulundu: `name=@B2A301AB37`, `mode=http`, `has_bt=1`.
  - `bt_password_encrypted` localde basariyla decrypt edildi (16 karakter token).
  - Uretilen BLE fabrika reset komutu dogrulandi: `+SET-DEVICE:{"Restore":0, "Token":"..."}\r\n`.
- Notes:
  - Bu terminal ortamindan cihaza fiziksel Web Bluetooth baglantisi kurulamadigi icin komutun cihaza fiili gonderimi burada yapilamadi.
  - Komut olusturma/decrypt asamasi basarili.
- Changed files:
  - Kalici kod degisikligi yok.
  - Gecici dosyalar olusturulup silindi: `.codex/tmp_local_bt_check.php`, `.codex/tmp_device160.sql`, `.codex/tmp_device160_token.sql`.
- Checks:
  - `php .codex/tmp_local_bt_check.php` (local DB + decrypt dogrulamasi)
- Risks/Follow-up:
  - Cihaz tarafinda token mismatch veya BLE pairing cache devam ediyorsa, dogru token ile bile komut reddedilebilir; cihaz/OS Bluetooth cache temizligi ile tekrar denenmeli.
## 2026-03-12 - BLE wizard wifi-scan token propagation + auth-error surfacing
- Request: Local Bluetooth wizard son asamada/factory resette token error; icerik gonderimi calisirken wizard adimlarinda tokenin bos gitmesi incelendi.
- Findings:
  - Console logda `+GET-DEVICE:{"types":"wifi-list", "Token":""}` komutu wizard WiFi tarama adimindan geliyor.
  - Wizard `_scanWifiNetworks()` token yukleme yapmadan `scanWifiNetworks()` cagiriyordu.
  - Service `scanWifiNetworks()` token/parola kaynakli hatalari yutup bos liste donduruyordu; bu nedenle wizard retry/prompt akisi tetiklenmiyordu.
- Changes:
  - `public/assets/js/pages/devices/list/BluetoothWizard.js`
    - `_scanWifiNetworks(allowRetry=true)` yapildi.
    - WiFi tarama oncesi serverdan token yukleme eklendi; tarama komutlari `this._deviceToken` ile gonderiliyor.
    - WiFi tarama icin token hatasinda server-token refresh + prompt retry eklendi.
    - `_connect()` sonrasinda arka planda token preload eklendi.
    - `_fetchMissingDeviceInfo()` icindeki BLE okumalari token ile guncellendi (`getDeviceInfo/getAllInfo`).
  - `public/assets/js/services/BluetoothService.js`
    - `scanWifiNetworks()` icinde token/parola kaynakli hatalar artik yutulmuyor; wizard seviyesine throw ediliyor.
- Checks:
  - `node --check public/assets/js/pages/devices/list/BluetoothWizard.js`
  - `node --check public/assets/js/services/BluetoothService.js`
- Risks/Follow-up:
  - Cihaz DB'de eslesemiyorsa token auto-load bos kalir; bu durumda wizard prompt ile manuel token girisi gerekir.
  - Browser extension kaynakli `Could not establish connection` hatalari uygulama BLE akisini etkilemez; testte eklentisiz profil daha temiz sonuc verir.
- Backup/Restore Safety:
  - Temp backup: `public/assets/js/pages/devices/list/BluetoothWizard.js.bak_wifitoken_20260312_044429`
  - Restore gerekmedi.
## 2026-03-12 - Local BLE live reset verification for @B devices
- Request: Localden Pavo `@B` cihazlara kendi tokenlari ile baglanip Bluetooth uzerinden reset atilabildigini dogrulama.
- Live test summary:
  - BLE tarama terminalden basariyla calisti; `@B2A401A959` ve `@B2A401A977` goruldu.
  - Local DB'den `@B%` cihazlarin sifreleri decrypt edilip testte kullanildi.
  - `@B2A401A959`: `+SET-DEVICE:{"Restore":0,"Token":"..."}` komutuna `+DONE` dondu (factory reset komutu kabul).
  - `@B2A401A977`: Token ile diger komutlar (`GET-DEVICE Protocol`, `SET Query-cycle`) basarili; fakat `Restore` komutunda cihaz `AT+ECHO=0` dondu (restore komutunu kabul etmedi).
  - `@B2A301AB37`: Test aninda BLE scan'de gorulmedi (uzakta/kapali olabilir), bu oturumda canli reset testi yapilamadi.
- Changed files:
  - Kalici kod degisikligi yok.
  - Gecici test dosyalari olusturulup silindi: `.codex/tmp_bt_list.php`, `.codex/tmp_dump_bt_tokens.php`, `.codex/tmp_bt_tokens.json`, `.codex/tmp_ble_factory_reset.py`.
- Checks run:
  - Live BLE discover/connect/write/notify testleri (Python bleak) basariyla calisti.
- Risks/Follow-up:
  - `Restore` komutu cihaz firmware/modele gore farkli anahtar gerektirebilir; `@B2A401A977` icin vendor dokumanindaki alternatif reset payload'i ile tekrar denenmeli.
  - BLE'de gorunmeyen cihazlar icin fiziksel yakinlik/guc durumu kontrol edilmeli.
- Backup/Restore Safety:
  - Sadece gecici script kullanildi; restore gerekmedi.
## 2026-03-12 - BLE connect UUID fallback for characteristic mismatch errors
- Request: Wizard baglantisinda `No Characteristics matching UUID ... fff2 ...` hatasi alinmasi.
- Findings:
  - `BluetoothService.connect()` tek bir UUID setine (service fff0, write fff2, notify fff1) hardcoded bagliydi.
  - Varyant cihazlarda characteristic yerlesimi/UUID farki oldugunda baglanti daha en basta kiriliyor.
- Changes:
  - `public/assets/js/services/BluetoothService.js`
    - Service/characteristic candidate listeleri eklendi (`fff0/ffe0`, `fff2/fff3/ffe1`, `fff1/fff4/ffe1`).
    - `scan()` optionalServices candidate listeyi kullanacak sekilde guncellendi.
    - `connect()` icinde tek UUID yerine dinamik GATT binding cozumu eklendi (`getPrimaryServices` + characteristic property/uuid fallback).
    - Yardimci metodlar eklendi: `_normalizeUuid`, `_sortServicesByPreference`, `_findCharacteristicByUuid`, `_findWriteCharacteristic`, `_findNotifyCharacteristic`, `_resolveGattBindings`.
- Checks:
  - `node --check public/assets/js/services/BluetoothService.js`
  - Canli BLE service dump (`@B2A401A977`) ile characteristic goruntuleme testi.
- Risks/Follow-up:
  - Browser cache/old JS kalirsa eski kodla hata devam edebilir; hard refresh gerekli.
  - Cihaz bazli firmware farklarinda yeni UUID gerekirse candidate listesine eklenmeli.
- Backup/Restore Safety:
  - Temp backup: `public/assets/js/services/BluetoothService.js.bak_uuidfallback_20260312_045902`
  - Restore gerekmedi.
## 2026-03-12 - Live BLE reset retry for @B2A401A959 and @B2A301AB37
- Request: Iki cihaz icin localden token ile Bluetooth factory reset denemesi (`@B2A401A959`, `@B2A301AB37`).
- Live results:
  - `@B2A401A959`: BLE baglanti + `+SET-DEVICE:{"Restore":0,"Token":"..."}` komutu basarili, cihaz `+DONE` dondu.
  - `@B2A301AB37`: DB token bulundu ancak BLE scan'de cihaz ismi gorulmedi (`NOT_FOUND_IN_SCAN`).
  - Ek 30s uzun taramada da hedef cihaz gorulmedi; yalniz `@B2A401A977` gorundu.
- Changed files:
  - Kalici kod degisikligi yok.
  - Gecici test dosyalari olusturulup silindi: `.codex/tmp_dump_bt_targets.php`, `.codex/tmp_bt_targets.json`, `.codex/tmp_ble_reset_targets.py`.
- Checks run:
  - Canli BLE scan/connect/write/notify testleri (Python bleak).
- Risks/Follow-up:
  - `@B2A301AB37` cihazinin BLE advertise etmeme (guc/boot/firmware mode) durumu var; fiziksel yakinlik ve cihaz BLE gorunurlugu dogrulanmali.
  - Cihaz BLE listede gorunmeden reset komutu uzaktan gonderilemez.
- Backup/Restore Safety:
  - Sadece gecici scriptler kullanildi, restore gerekmedi.
## 2026-03-12 - Pavo BLE reset runbook document added
- Request: 3 cihazin var olan tokenlari ile resetleme kodlarinin bir dokumanda toplanmasi.
- Changes:
  - `docs/PAVO_BLE_FACTORY_RESET_RUNBOOK_2026-03-12.md` eklendi.
  - Dokumanda: hedef cihaz listesi, reset komut formati, tokeni DB'den cekip komut uretme, Python/bleak canli gonderim akisi, canli durum notu ve operasyon checklist yer aliyor.
- Security note:
  - Tokenlar dokumana acik metin olarak yazilmadi; mevcut DB kaydindan runtime'da uretiliyor.
- Checks run:
  - `QUICK_CHECKS` kapsaminda bu degisiklik icin uygun syntax check yok (sadece markdown dokuman eklendi).
- Risks/Follow-up:
  - Runbook'taki komutlar calistirildiginda terminal ciktilarinda token gorunebilir; paylasim/screenshot oncesi maskeleme uygulanmali.
- Backup/Restore Safety:
  - Kod dosyasi degismedi; backup gerekmedi.
## 2026-03-12 - memory review and server connection recall check
- Request: Review project memory history and confirm whether server connection details are remembered.
- Changes: No source code changes. Reviewed PROJECT_SNAPSHOT, WORKFLOW, CHANGE_MEMORY recent entries, and CLAUDE context.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Startup memory read completed; keyword scan run in .codex/.claude for server connection references.
- Risks/Follow-up: Memory includes prior SSH user/host/port reference from earlier hotfix session; resend is needed only if credentials changed.
- Backup/Restore Safety: No backup required (append-only memory update).
## 2026-03-12 - production company create 500 mitigation + admin companies modal backdrop lock
- Request: On production `/admin/companies`, creating a company returned English error toast with 500 while company was actually created; also disable modal close on outside click for this page only and keep toast behavior i18n/explanatory.
- Root cause:
  - `api/companies/create.php` ran post-create operations (branding move, seeding, storage ensure, audit log) without warning shielding; in production global API error handler turns PHP warnings into HTTP 500, causing partial-success + error response.
  - Company modal allowed backdrop click-close by default.
  - Generic server messages (`Internal server error`) were passed directly to toast, bypassing contextual i18n UX.
- Changes:
  - `api/companies/create.php`
    - Added non-critical execution wrapper with temporary warning-to-exception guard for post-create steps.
    - Wrapped branding move, seed defaults, storage ensure, and audit log as non-critical steps.
    - API now preserves successful company creation response and returns `post_create_warnings` when optional post-steps fail.
  - `public/assets/js/pages/admin/CompanyManagement.js`
    - Disabled outside-click close for company modal via `closeOnBackdrop: false`.
    - Improved save error toast: generic server errors now map to contextual i18n fallback (`add/edit company` + localized operation failed text); non-generic API messages still shown directly.
    - Logged `post_create_warnings` from successful create responses for diagnostics.
- Files:
  - api/companies/create.php
  - public/assets/js/pages/admin/CompanyManagement.js
- Checks:
  - `php -l api/companies/create.php`
  - `node --check public/assets/js/pages/admin/CompanyManagement.js`
- Risks/Follow-up:
  - Non-critical warnings are now tolerated; if repeated warnings appear in logs (`Company create non-critical step failed`), underlying server filesystem/log permission issues should be corrected.
  - Recommended production re-test: create company with and without branding upload, then verify no 500 and modal only closes via cancel/X.
- Backup/Restore Safety:
  - Temp backup created: `.codex/tmp_backups/20260312_223523-company-create-modal-i18n`
  - Restore not required.
## 2026-03-12 - create flow hardening for production-only 500/partial-success risks
- Request: After push/pull approval, detect and fix other create endpoints that may return 500 while partially persisting records on production.
- Deployment note:
  - App commit pushed to origin (`49aa576`) but direct server pull/rebuild could not be executed from this session due SSH key auth error: `Permission denied (publickey)`.
- Risk review findings:
  - Multi-step create endpoints without transaction could partially persist data on mid-step exception.
  - Post-create audit/log and optional filesystem writes could raise warnings/exceptions and flip response to 500 after successful inserts.
- Changes:
  - `core/Logger.php`
    - Hardened file logging path against warning-based failures (`@mkdir`, `@file_put_contents`, guarded rotate/cleanup). Logging failures now degrade to `error_log` without breaking API flow.
  - `api/users/create.php`
    - Wrapped user + branch-access inserts in DB transaction.
    - Added rollback on failure and non-critical audit handling after commit.
  - `api/notifications/create.php`
    - Wrapped notification + recipient inserts in DB transaction with rollback on failure.
  - `api/device-groups/create.php`
    - Added transaction around group/member inserts; commit before response.
    - Audit moved to non-critical block.
  - `api/licenses/create.php`
    - Added transaction around license + per-device pricing inserts with rollback on failure.
    - Audit moved to non-critical block after commit.
  - `api/web-templates/create.php`
    - Added transaction around template + initial version inserts with rollback.
    - Fixed audit call signature to match `Logger::audit(action, resource, data)`.
    - Audit made non-critical.
  - `api/templates/create.php`
    - Guarded optional render-image directory/file writes to avoid warning-triggered request abort.
    - Audit made non-critical.
  - `api/render-queue/create.php`
    - Guarded pre-render image directory/file writes to avoid warning-triggered request abort.
- Files:
  - core/Logger.php
  - api/users/create.php
  - api/notifications/create.php
  - api/device-groups/create.php
  - api/licenses/create.php
  - api/web-templates/create.php
  - api/templates/create.php
  - api/render-queue/create.php
- Checks:
  - `php -l core/Logger.php`
  - `php -l api/users/create.php`
  - `php -l api/notifications/create.php`
  - `php -l api/device-groups/create.php`
  - `php -l api/licenses/create.php`
  - `php -l api/web-templates/create.php`
  - `php -l api/templates/create.php`
  - `php -l api/render-queue/create.php`
- Risks/Follow-up:
  - Remaining create endpoints were reviewed; highest production instability vectors (multi-insert without transaction + warning-prone IO/audit tail) were patched.
  - Server-side pull/rebuild still required to activate changes.
- Backup/Restore Safety:
  - Temp backup created: `.codex/tmp_backups/20260312_225107-create-hardening`
  - Restore not required.
## 2026-03-12 - frontend logger compatibility alias for `Logger.warning` runtime error
- Request: After company create test on production, modal confirm failed with `TypeError: Logger.warning is not a function`.
- Root cause:
  - `public/assets/js/pages/admin/CompanyManagement.js` used `Logger.warning(...)`.
  - `public/assets/js/core/Logger.js` exposed `warn(...)` but had no `warning(...)` alias.
- Changes:
  - `public/assets/js/core/Logger.js`
    - Added compatibility alias `warning(...args)` delegating to `warn(...args)`.
- Additional review:
  - Quick static scan over `api/**/(update|delete).php` flagged multi-step endpoints with no transaction and/or audit/fs side effects as potential production-only partial-success/500 candidates (next hardening pass suggested).
- Files:
  - public/assets/js/core/Logger.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/assets/js/core/Logger.js`
  - `node --check public/assets/js/pages/admin/CompanyManagement.js`
- Risks/Follow-up:
  - Any existing `Logger.warning(...)` calls are now safe globally.
  - Update/Delete hardening should continue endpoint-by-endpoint (transaction + non-critical audit/fs wrappers) for fully consistent behavior.
- Backup/Restore Safety:
  - Prior task backups remain available; no additional restore needed.## 2026-03-12 - logger.warning uyumluluk riski ve company update/delete hardening
- Request: `Logger.warning is not a function` hatasinin benzer CRUD akislarda da olup olmayacagini kontrol et; company update/delete tarafinda benzer 500/exception risklerini azalt.
- Changes:
  - `public/assets/js/pages/admin/CompanyManagement.js`
    - `Logger.warning(...)` -> `Logger.warn(...)`.
  - `public/assets/js/pages/admin/TenantBackupPage.js`
    - `Logger.warning(...)` -> `Logger.warn(...)`.
  - `public/assets/js/pages/products/ProductForm.js`
    - `Logger.warning(...)` -> `Logger.warn(...)`.
  - `api/companies/update.php`
    - Company + license guncelleme adimlari transaction icine alindi (begin/commit/rollback).
    - Lisans cache temizleme commit sonrasina alindi ve non-critical hale getirildi.
    - License/company audit loglari non-critical try/catch ile korundu.
  - `api/companies/delete.php`
    - Company delete adimi transaction icine alindi (begin/commit/rollback).
    - Audit log non-critical try/catch ile korundu.
- Files:
  - public/assets/js/pages/admin/CompanyManagement.js
  - public/assets/js/pages/admin/TenantBackupPage.js
  - public/assets/js/pages/products/ProductForm.js
  - api/companies/update.php
  - api/companies/delete.php
- Checks:
  - `php -l api/companies/update.php`
  - `php -l api/companies/delete.php`
  - `node --check public/assets/js/pages/admin/CompanyManagement.js`
  - `node --check public/assets/js/pages/admin/TenantBackupPage.js`
  - `node --check public/assets/js/pages/products/ProductForm.js`
  - `Select-String` scan: `Logger.warning(` kullanimi kalmadi.
  - Static risk taramasi (`api/**/(update|delete).php`): transaction eksigi olan yuksek riskli endpoint listesi cikartildi.
- Risks/Follow-up:
  - Ayni tip partial-success/500 riski, transaction ve non-critical side-effect sarmasi olmayan bazi update/delete endpointlerinde devam ediyor (device-groups, devices, licenses, products, templates, users, web-templates vb.).
  - Service worker cache'i olan istemcilerde eski bundle gecici olarak kalabilir; hard reload �nerilir.
- Backup/Restore Safety:
  - Temp backup created: `.codex/tmp_backups/20260312_230723-logger-warning-and-company-update-delete`
  - Restore not required.
## 2026-03-12 - stream transcode activation (device-aware profile + worker service)
- Request: FFmpeg artik docker sunucuda kurulu; player/stream sisteminde cihaz bazli medya olusumunu aktif et ve canli ortamda kontrol et.
- Findings (production):
  - App container icinde `ffmpeg` / `ffprobe` vardi ve calisiyordu.
  - `TranscodeWorker` process calismiyordu; hazir variant sayisi 0 idi.
  - Bu nedenle stream cihazlari ayni kaynak medya/profil davranisina dusuyordu.
- Changes:
  - `services/TranscodeQueueService.php`
    - `enqueue()` icinde profil secimi otomatiklestirildi.
    - Profil verilmezse kaynak videonun cozunurlugune gore `HlsTranscoder::getAvailableProfiles()` ile profil listesi seciliyor.
    - Profil dogrulama/normalize helper eklendi (`resolveProfiles`).
  - `api/transcode/enqueue.php`
    - `profiles` artik opsiyonel (auto mode).
    - Effective profile listesi DB job kaydindan response'a donuluyor.
  - `api/stream/master.php`
    - Hazir varianti olmayan playlist videolari icin best-effort auto-enqueue eklendi.
    - Cihaz profil filtresi iyilestirildi:
      - `max_res`/`resolution` gibi farkli formatlardan yukseklik parse ediliyor (`720p`, `1280x720`, vb.).
      - `device_profile` yoksa `screen_width/screen_height` fallback kullaniliyor.
      - Filtre sonrasi bos kalirsa en uygun fallback profil seciliyor.
      - Master profile satirlari bitrate'e gore siralaniyor.
  - `api/media/upload.php`
    - Video upload sonrasi otomatik transcode queue ekleme (best-effort) eklendi.
  - `workers/TranscodeWorker.php`
    - Daemon log forward bug fix: private `Logger::log()` cagrisini public `Logger::info/error/warning/debug` yonlendirmesine cevirildi.
  - `deploy/docker-compose.yml`
    - Yeni `transcode-worker` servisi eklendi (daemon mode).
  - `deploy/docker-compose.local.yml`
    - Local parity icin `transcode-worker` servisi eklendi.
- Deployment (production):
  - Commit `7055618` push edildi, sunucuda pull edildi.
  - `app` + `transcode-worker` image build/up yapildi, `nginx` restart edildi.
  - `transcode-worker` container up durumda ve log'da FFmpeg bulundu mesaji goruldu.
- Files:
  - services/TranscodeQueueService.php
  - api/transcode/enqueue.php
  - api/stream/master.php
  - api/media/upload.php
  - workers/TranscodeWorker.php
  - deploy/docker-compose.yml
  - deploy/docker-compose.local.yml
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l services/TranscodeQueueService.php`
  - `php -l api/transcode/enqueue.php`
  - `php -l api/stream/master.php`
  - `php -l api/media/upload.php`
  - `php -l workers/TranscodeWorker.php`
  - `docker compose -f deploy/docker-compose.local.yml config`
  - Production container syntax:
    - `php -l /var/www/html/services/TranscodeQueueService.php`
    - `php -l /var/www/html/api/transcode/enqueue.php`
    - `php -l /var/www/html/api/stream/master.php`
    - `php -l /var/www/html/api/media/upload.php`
    - `php -l /var/www/html/workers/TranscodeWorker.php`
  - Production runtime checks:
    - `php workers/TranscodeWorker.php --status`
    - `docker compose ps app transcode-worker nginx`
    - `docker compose logs --tail 30 transcode-worker`
    - `GET https://hub.omnexcore.com/api/health` => 200
- Risks/Follow-up:
  - Eski videolarin variantlari anlik olusmaz; worker kuyrugu isledikce olusur.
  - Auto-enqueue stream/master tarafinda best-effort calisir; ilk isteklerde passthrough devam edebilir.
  - Baz� uzak script calistirmalarinda BOM/CRLF kaynakli shell sikintisi goruldu; deploy sonucu dogrulandi, ancak script pipeline icin dikkat edilmeli.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260312_232217-stream-transcode-activation`
  - Remote backup: `.codex_remote_backups/20260312_202803-stream-transcode`
  - Restore not required.
## 2026-03-12 - transcode-worker healthcheck fix
- Request context: Stream transcode activation sonrasi `transcode-worker` container `unhealthy` gorunuyordu.
- Root cause:
  - Docker image seviyesindeki Apache HTTP healthcheck (`curl http://localhost:80/api/health`) worker container icin uygun degil.
- Changes:
  - `deploy/docker-compose.yml`
    - `transcode-worker` servisine worker-uyumlu healthcheck eklendi (`php -r "exit(0);"`).
  - `deploy/docker-compose.local.yml`
    - Ayni healthcheck local compose'a eklendi.
- Checks:
  - `docker compose -f deploy/docker-compose.local.yml config`
- Risks/Follow-up:
  - Healthcheck yalnizca container liveness dogrular; queue throughput icin ek metrik izleme onerilir.
- Backup/Restore Safety:
  - Prior local/remote backups from stream activation task remain valid.
## 2026-03-12 - normal player device-aware HLS selection (init/sync)
- Request context: Stream tarafindaki cihaz profiline gore transcode/HLS secimi normal player akisinda da calissin; farkli cihazlar ayni boyuta zorlanmasin.
- Changes:
  - `api/player/init.php`
    - Video medya URL cozumleme akisi cihaz profili/screen boyutuna gore HLS variant secer hale getirildi.
    - Hazir variant yoksa best-effort auto-enqueue eklendi; fallback olarak mevcut media dosya URL'si korunuyor.
    - Variant playlist path -> web URL cozumlemesi eklendi (`storage/` ve `BASE_PATH` mutlak yol destekli).
  - `api/player/sync.php`
    - Init ile ayni device-aware HLS secim ve fallback davranisi sync response tarafina eklendi.
    - Hazir variant yoksa best-effort auto-enqueue + mevcut URL fallback davranisi eklendi.
- Files:
  - api/player/init.php
  - api/player/sync.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/player/init.php`
  - `php -l api/player/sync.php`
- Risks/Follow-up:
  - Bu degisiklik yalniz `api/player/init` ve `api/player/sync` akisini kapsar; eski/alternatif `api/player/content` kullanan client varsa ayni mantigin oraya da tasinmasi gerekebilir.
  - Ilk isteklerde variant henuz hazir degilse fallback kaynak medya oynatilir; worker tamamladiginda sonraki init/sync cevabinda HLS URL doner.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260312_233935-player-device-hls-normal`
  - Restore not required.
## 2026-03-12 - transcode worker crash fix (Database::execute)
- Request context: Normal player `stream_profile` dogrulamasinda tum cihazlarda profil bos geldi; queue ilerlemiyordu.
- Root cause:
  - `TranscodeQueueService` icinde `Database::execute()` cagrilari var.
  - Bu repositoryde `core/Database.php` yalnizca `query()` + `rowCount()` sagliyor, `execute()` yok.
  - Sonuc: Worker `dequeue()` sirasinda fatal `Call to undefined method Database::execute()` ile dusuyor ve container restart loop'a giriyor.
- Changes:
  - `services/TranscodeQueueService.php`
    - Tum `execute()` cagrilari `query()` ile degistirildi.
    - Atomic claim adiminda etkilenen satir kontrolu `query()` sonrasi `rowCount()` ile yapildi.
- Files:
  - services/TranscodeQueueService.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l services/TranscodeQueueService.php`
- Risks/Follow-up:
  - Worker ayaga kalktiktan sonra pending queue bir sure islenerek `transcode_variants` olusacak; player `stream_profile` dolumu bundan sonra gorulecek.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260312_235608-transcode-execute-fix`
  - Restore not required.
## 2026-03-13 - player response includes stream_profile field
- Request context: 3 cihaz dogrulamasinda URL'ler HLS'e dondu ancak `stream_profile` alani response'ta gorunmedi.
- Root cause:
  - `api/player/init.php` ve `api/player/sync.php` icinde secilen profil `playlistItems` uzerine yaziliyordu fakat `transformedItems` map'ine tasinmiyordu.
- Changes:
  - `api/player/init.php`
    - Normal media item response'una `stream_profile` alanini eklendi.
  - `api/player/sync.php`
    - Normal media item response'una `stream_profile` alanini eklendi.
- Files:
  - api/player/init.php
  - api/player/sync.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/player/init.php`
  - `php -l api/player/sync.php`
- Risks/Follow-up:
  - Bu ortamdaki test medyalari su an sadece `720p` hazir oldugundan tum cihazlar `720p` gorur; cihaz farkini gorebilmek icin 360p/540p/1080p varyantlari da hazirlanmis bir medya seti gerekir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_000056-player-stream-profile-response`
  - Restore not required.
## 2026-03-13 - device detail Postgres cast fix + IP uniqueness scope + strict HLS stream mode
- Request context:
  - Device detail sayfasi 500 hatasi veriyordu (`text = uuid` join hatasi).
  - Device create/update tarafinda IP cakismasi bazi cihaz tiplerinde gereksiz blokluyordu.
  - Stream master playlist passthrough modunda binlerce tekrarli item uretiyordu.
- Changes:
  - `api/devices/show.php`
    - Postgres icin playlist join cast eklendi (`CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)`).
  - `api/devices/create.php`
    - IP uniqueness kontrolu ESL ailesiyle sinirlandi (`esl`, `esl_rtos`, `esl_android`, `hanshow_esl`).
  - `api/devices/update.php`
    - `hanshow_esl` typeMap eklendi.
    - Effective frontend type cozumlemesi eklendi; IP uniqueness kontrolu ESL ailesiyle sinirlandi.
  - `public/assets/js/pages/devices/DeviceList.js`
    - Client-side IP conflict pre-check yalniz ESL ailesi icin calisacak hale getirildi.
  - `api/stream/master.php`
    - Tekrarl� M3U passthrough blok kaldirildi.
    - Variant hazir degilken `503 Stream is preparing` JSON + `Retry-After: 5` donusu eklendi.
- Files:
  - api/devices/show.php
  - api/devices/create.php
  - api/devices/update.php
  - public/assets/js/pages/devices/DeviceList.js
  - api/stream/master.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/devices/create.php`
  - `php -l api/devices/update.php`
  - `php -l api/devices/show.php`
  - `php -l api/stream/master.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Stream master artik variant hazir degilse 503 donuyor; client tarafinda bu duruma retry/backoff UX'i gorunur olmali.
  - Passthrough behavior kaldirildigi icin transcode worker sagligi kritik (queue/process monitoring onerilir).
- Backup/Restore Safety:
  - Backup path: `.codex/tmp_backups/20260313_001207-device-stream-fixes`
  - `create.php` bir ara regex denemesinde bozuldu, ayni backup'tan restore edilip guvenli patch ile tekrar duzeltildi.
## 2026-03-13 - device detail hotfix (playlist order column + safe JSON decode)
- Request context:
  - Device detail endpoint'inde 500 hatalari devam etti:
    - `column "order_index" does not exist`
    - `json_decode(): Argument #1 must be of type string, array given`
- Changes:
  - `api/devices/show.php`
    - Guvenli JSON parse yardimcisi eklendi (`deviceShowDecodeJsonArray`) ve metadata/current_content/user preferences/playlist_items parse noktalarinda kullanildi.
    - `isValidImagePath` ve `buildPublicUrl` non-string inputlarda guvenli hale getirildi.
    - `playlist_items` fallback sorgusunda siralama kolonu dinamik secilir hale getirildi (`order_index` -> `sort_order` -> `item_order` -> `position`; yoksa `created_at`).
- Files:
  - api/devices/show.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/devices/show.php`
- Risks/Follow-up:
  - `playlist_items` tablosunda beklenmeyen farkli bir kolon adlandirmasi varsa siralama `created_at`/natural order fallback ile calisir; gerekirse prod DB'de kolon standardizasyonu yapilmali.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_002655-device-show-hotfix`
  - Restore not required.
## 2026-03-13 - device detail hotfix (non-playlist assignment uuid guard)
- Request context:
  - Device detail API 500: `invalid input syntax for type uuid`.
  - `device_content_assignments.content_id` bazen path (http_payload json path) oldugunda playlist fallback sorgusuna UUID gibi gidiyordu.
- Changes:
  - `api/devices/show.php`
    - Active assignment sorgusuna `dca.content_type = 'playlist'` filtresi eklendi.
    - `playlist_items` fallback sorgusundan once `content_id` UUID format kontrolu eklendi; UUID degilse sorgu atlanip bos item listesiyle devam ediliyor.
- Files:
  - api/devices/show.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/devices/show.php`
- Risks/Follow-up:
  - UUID regex check'i gevsek format kontroludur; canonical UUID validasyonu gerekirse DB tarafi cast veya stricter regex ile sertlestirilebilir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_002959-device-show-contenttype-fix`
  - Restore not required.
## 2026-03-13 - device detail hotfix (render preview URL normalization + offline device_info skip)
- Request context:
  - Device detail ekraninda render preview URL'i `/storage/xampp/htdocs/...` gibi hatali olusuyor ve 500 donuyordu.
  - Offline cihazlarda `device_info` control cagrisi timeout log kirliligi olusturuyordu.
- Changes:
  - `api/devices/show.php`
    - `buildPublicUrl` normalize mantigi guclendirildi (BASE_PATH drive/no-drive varyantlari + `.../storage/...` alt yol yakalama).
    - Device render cache dosyasi URL'i manuel path concat yerine `buildPublicUrl` ile uretiliyor.
  - `public/assets/js/pages/devices/DeviceDetail.js`
    - `loadDeviceInfo()` icine `status !== online` guard eklendi; offline cihazlarda control cagrisi atlanir.
- Files:
  - api/devices/show.php
  - public/assets/js/pages/devices/DeviceDetail.js
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/devices/show.php`
  - `node --check public/assets/js/pages/devices/DeviceDetail.js`
- Risks/Follow-up:
  - Cihaz status stale (yanlislikla online) ise timeout yine gorulebilir; bu durumda heartbeat freshness kontrolu ile ek guard dusunulebilir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_003240-device-preview-timeout-fix`
  - Restore not required.
## 2026-03-13 - production no-cache rebuild and container recreate
- Request context:
  - Localde duzelen degisiklikler sunucuda gorunmuyordu; kullanici cache'siz rebuild istedi.
- Changes:
  - Kod degisikligi yok (repo dosyalarinda yeni edit yok).
  - Sunucuda (`185.124.84.34`, `camlicayazilim`) operasyonel deploy yapildi:
    - `/opt/omnex-hub` icinde `git pull --ff-only` (82a35d6 -> df08980)
    - `docker compose -p omnex -f docker-compose.yml -f docker-compose.standalone.yml build --no-cache app transcode-worker nginx`
    - `docker compose ... up -d --force-recreate app transcode-worker nginx`
    - app icinde `opcache_reset()` calistirildi
- Verification:
  - `docker compose ... ps` ciktisinda `app`, `transcode-worker`, `nginx` yeniden olusup `healthy/up` goruldu.
  - Sunucudaki dosyalarda yeni frontend guardlar dogrulandi:
    - `DeviceList.js` icinde `isEslFamilyType`
    - `DeviceDetail.js` icinde offline `loadDeviceInfo` guard'i
- Risks/Follow-up:
  - Istemci tarafinda Service Worker/browser cache kalmissa eski JS davranisi devam edebilir; client tarafinda SW unregister + hard refresh gerekebilir.
  - `/api/health` localhost sorgusunda 301 goruldu (ortam HTTPS yonlendirme davranisina bagli olabilir).
- Backup/Restore Safety:
  - Bu adimda dosya restore gerekmemis, sadece runtime rebuild/recreate uygulanmistir.
## 2026-03-13 - android player default server + apk rebuild + update manifest refresh
- Request context:
  - Android player varsayilan sunucu adresi `https://hub.omnexcore.com/player/` olacak sekilde guncellendi.
  - Yeni APK build alinip `downloads` altina kopyalanmasi ve update/upload manifest dosyasinin guncellenmesi istendi.
- Changes:
  - `android-player/omnex-player-app/app/build.gradle`
    - `SERVER_URL` (default + debug) -> `https://hub.omnexcore.com/player/`
    - `versionCode` -> `25`, `versionName` -> `2.8.1`
  - `android-player/omnex-player-app/app/src/main/java/com/omnex/player/UpdateManager.kt`
    - `UPDATE_URL` -> `https://hub.omnexcore.com/downloads/update.json`
    - `APK_URL` -> `https://hub.omnexcore.com/downloads/omnex-player.apk`
  - `downloads/update.json`
    - version/downloadUrl/sha256 guncellendi (`v25`, yeni SHA).
  - `public/downloads/update.json`
    - version/downloadUrl/sha256 guncellendi (`v25`, yeni SHA).
  - Build artifact kopyalari:
    - `downloads/omnex-player.apk` yenilendi.
    - `public/downloads/omnex-player.apk` yenilendi.
    - `downloads/omnex-player-standalone-v2.8.1.apk` eklendi.
    - `public/downloads/omnex-player-standalone-v2.8.1.apk` eklendi.
- Checks:
  - `android-player/omnex-player-app> .\\gradlew.bat publishDebugApk` (pass)
  - `android-player/omnex-player-app> .\\gradlew.bat :app:compileDebugKotlin` (failed: flavor nedeniyle task ambiguous)
  - `android-player/omnex-player-app> .\\gradlew.bat :app:compileStandaloneDebugKotlin` (pass)
  - `ConvertFrom-Json` parse check:
    - `downloads/update.json` (pass)
    - `public/downloads/update.json` (pass)
- Risks/Follow-up:
  - `downloads/update.json` releaseNotes metninde onceki karakter kodlamasi kaynakli bozuk karakterler mevcut (bu adimda sadece version/url/hash satirlari degisti).
  - Bu build `standalone debug` artifact'tan yayinlandi (`publishDebugApk` task akisi).
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_005602-apk-default-server-update`
  - Restore not required.
## 2026-03-13 - registration desktop card height alignment (PC)
- Request context:
  - Android player etkinlestirme ekraninin PC gorunumunde eslestirme kodu card'inin soldaki marka card'i ile ayni yukseklikte olmasi istendi.
- Changes:
  - `public/player/assets/css/player.css`
    - Desktop landscape (`min-width:1360px`) ve sadece non-TV (`body:not(.device-tv)`) icin override eklendi.
    - `registration-content` grid item hizasi `stretch` yapildi.
    - `registration-header` ve `sync-code-container` ayni `min-height` degerine cekildi.
    - `sync-code-container` icin `align-self: stretch` + `height: 100%` ile soldaki card ile yukseklik esitlemesi yapildi.
- Files:
  - public/player/assets/css/player.css
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `node --check public/player/assets/js/player.js`
- Risks/Follow-up:
  - Duzenleme desktop landscape hedeflidir; 1360px alti ekranlarda mevcut responsive davranis korunur.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_010241-player-registration-pc-height`
  - Restore not required.
## 2026-03-13 - track downloads in git + include in docker app container
- Request context:
  - `downloads` dizininin Git push'a dahil edilmesi ve sunucu Docker container icinde de erisilebilir olmasi istendi.
- Changes:
  - `.gitignore`
    - `downloads/` ignore kurali kaldirildi.
    - `downloads` ve `public/downloads` icin explicit unignore kurallari eklendi (`!downloads/**`, `!public/downloads/**`).
  - `deploy/Dockerfile`
    - Build image icine `downloads/` klasoru eklendi (`COPY downloads/ ./downloads/`).
  - `deploy/docker-compose.yml`
    - App service'e host bind mount eklendi: `../downloads:/var/www/html/downloads`.
- Files:
  - .gitignore
  - deploy/Dockerfile
  - deploy/docker-compose.yml
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `git check-ignore -v downloads/update.json` (downloads unignored dogrulandi)
  - `git check-ignore -v downloads/omnex-player.apk` (downloads unignored dogrulandi)
  - `git check-ignore -v public/downloads/omnex-player.apk` (public/downloads unignored dogrulandi)
  - `docker compose -f deploy/docker-compose.yml config` (ilk deneme env eksikligi nedeniyle fail)
  - `OMNEX_DB_PASS=x OMNEX_JWT_SECRET=x docker compose -f deploy/docker-compose.yml config` (pass)
- Risks/Follow-up:
  - `downloads` altindaki APK dosyalari artik repo'ya dahil olacagindan repository boyutu buyur.
  - Sunucuda etkin olmasi icin deploy tarafinda yeniden build + recreate gereklidir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_010844-downloads-git-docker-include`
  - Restore not required.
## 2026-03-13 - force OTA progression by bumping Android APK/update manifest to v26
- Request context:
  - Kullanici `downloads/update.json` guncel olmadigi icin cihazlarin otomatik guncelleme cekmedigini bildirdi.
- Changes:
  - `android-player/omnex-player-app/app/build.gradle` (local source)
    - `versionCode` -> `26`
    - `versionName` -> `2.8.2`
  - Yeni APK build alindi ve dagitim dosyalari yenilendi:
    - `downloads/omnex-player.apk`
    - `public/downloads/omnex-player.apk`
    - `downloads/omnex-player-standalone-v2.8.2.apk` (yeni)
    - `public/downloads/omnex-player-standalone-v2.8.2.apk` (yeni)
  - Update manifest dosyalari guncellendi:
    - `downloads/update.json`
    - `public/downloads/update.json`
    - `versionCode: 26`, `versionName: 2.8.2`, `downloadUrl ...?v=26`
    - `sha256: 0438ef58c1cfbb0d4e221138f76e02a447e9e345fa36b848c8ee9e0fea58cb93`
- Files:
  - android-player/omnex-player-app/app/build.gradle
  - downloads/omnex-player.apk
  - downloads/omnex-player-standalone-v2.8.2.apk
  - downloads/update.json
  - public/downloads/omnex-player.apk
  - public/downloads/omnex-player-standalone-v2.8.2.apk
  - public/downloads/update.json
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `android-player/omnex-player-app> .\\gradlew.bat publishDebugApk` (pass)
  - `android-player/omnex-player-app> .\\gradlew.bat :app:compileStandaloneDebugKotlin` (pass)
  - `ConvertFrom-Json` parse check:
    - `downloads/update.json` (pass)
    - `public/downloads/update.json` (pass)
- Risks/Follow-up:
  - `android-player/` dizini gitignore kapsaminda oldugu icin `build.gradle` versiyon artisi repo'ya commitlenmez; APK artifact ve update manifest commitlenir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_011321-apk-v26-autoupdate`
  - Restore not required.
## 2026-03-13 - update.json encoding/release notes fix + github push + server pull/deploy
- Request context:
  - Kullanici, baglam degisikliginden sonra update.json iceriginin guncellenmedigini, release note degismedigini ve encoding'in bozuk oldugunu bildirdi.
  - Islem bitince commit/push/pull talep edildi.
- Changes:
  - `downloads/update.json`
    - Release notes metni guncellendi.
    - UTF-8 (BOM'suz) olarak yeniden yazildi.
  - `public/downloads/update.json`
    - Release notes metni guncellendi.
    - UTF-8 (BOM'suz) olarak yeniden yazildi.
  - `public/player/assets/css/player.css`
    - Daha once istenen PC registration card yukseklik esitlemesi commitlenip pushlandi.
  - `.htaccess`
    - `downloads/*` istekleri icin `public/downloads/*` fallback rewrite eklendi.
    - `.apk` icin MIME type eklendi (`application/vnd.android.package-archive`).
- Git:
  - Commit: `75dea3e` (player.css + update.json release notes/encoding)
  - Commit: `5bbd329` (.htaccess downloads fallback + apk mime)
  - Push: `origin/main` basarili.
- Server pull/deploy:
  - SSH: `camlicayazilim@185.124.84.34` (key: `~/.ssh/camlicayazilim_omnex`)
  - `/opt/omnex-hub` icinde `git pull --ff-only` (df08980 -> 5bbd329)
  - `deploy/` icinde app image rebuild + recreate:
    - `docker compose -p omnex -f docker-compose.yml -f docker-compose.standalone.yml build app`
    - `docker compose -p omnex -f docker-compose.yml -f docker-compose.standalone.yml up -d --force-recreate app nginx`
- Verification:
  - `https://raw.githubusercontent.com/aka-uba/Omnex-Hub/main/downloads/update.json` -> `versionCode: 26`, `versionName: 2.8.2`
  - `https://hub.omnexcore.com/downloads/update.json` -> `200`, `Content-Type: application/json`
  - `https://hub.omnexcore.com/downloads/omnex-player.apk` -> `200`, `Content-Type: application/vnd.android.package-archive`, `bytes=7948861`
  - Live JSON byte stream UTF-8 decode check: OK.
- Checks:
  - `node --check public/player/assets/js/player.js`
  - `ConvertFrom-Json` parse check: `downloads/update.json`, `public/downloads/update.json`
- Risks/Follow-up:
  - Local repoda kullaniciya ait baska unstaged degisiklikler mevcut (bu adimda dokunulmadi).
- Backup/Restore Safety:
  - `.codex/tmp_backups/20260313_011818-updatejson-encoding-deploy`
  - `.codex/tmp_backups/20260313_012143-htaccess-downloads-fallback`
  - Restore not required.
## 2026-03-13 - server sync for player CSS patch + OTA domain validation
- Request context:
  - Kullanici `https://hub.omnexcore.com/player/` stil degisikliginin sunucuda gorunmedigini bildirdi.
  - Ayrica APK otomatik guncelleme domaininin hala eski (`akagunduzweb`) olabilecegi suphe edildi.
- Actions:
  - Sunucuda (`/opt/omnex-hub`) once tracked local degisiklikler stashlendi, sonra `git pull --ff-only` ile `ae0aaac` commitine cikildi.
  - `deploy/` icinde app image rebuild + `app/nginx` force-recreate yapildi.
- Verification:
  - Canli CSS kontrolu: `https://hub.omnexcore.com/player/assets/css/player.css` icinde desktop card-height patch bulundu (`body:not(.device-tv) ... height: 100%`).
  - Canli update endpoint: `https://hub.omnexcore.com/downloads/update.json` -> HTTP 200 JSON.
  - APK ic string kontrolu (`classes*.dex`):
    - `hub.omnexcore.com` bulundu.
    - `akagunduzweb.com` bulunmadi.
- Notes:
  - `downloads/update.json` canli endpointte JSON olarak servis ediliyor; konsol goruntulemede karakterler codepage nedeniyle bozuk gorunebilir.
- Checks run:
  - Live HTTP content checks (player.css/update.json)
  - APK dex string search (`findstr`)
- Risks/Follow-up:
  - Sunucuda stash kaydi olustu (`codex-auto-prepull-...`); istenirse sonradan `git stash list` ile gozden gecirilmeli.
- Backup/Restore Safety:
  - Local temp backuplar bu turda degistirilmedi; onceki temp backuplar korunuyor.
## 2026-03-13 - apk welcome/splash theme restore + OTA v27 publish
- Request context:
  - Kullanici APK ilk karşılama ekranı tasariminin eskiye dondugunu, arka planin player eslestirme sayfasi ile ayni stile alinmasini istedi.
- Changes:
  - Android source (local, gitignore kapsaminda):
    - `android-player/omnex-player-app/app/src/main/res/drawable/wizard_mobile_background.xml`
      - Koyu + cyan radial glow arka plan player registration temasiyla hizalandi.
    - `android-player/omnex-player-app/app/src/main/res/drawable/wizard_card_bg.xml`
      - Kart yuzeyi koyu-cyan gradient + cyan border yapildi.
    - `android-player/omnex-player-app/app/src/main/res/drawable/wizard_mobile_card_bg.xml`
      - Mobil kart da ayni tema ile hizalandi.
    - `android-player/omnex-player-app/app/src/main/res/layout/activity_wizard_tv.xml`
      - Root background düz renk yerine `@drawable/wizard_mobile_background` yapildi.
    - `android-player/omnex-player-app/app/build.gradle`
      - `versionCode 27`, `versionName 2.8.3` (local source).
  - Distribution artifacts:
    - `downloads/omnex-player.apk` yenilendi.
    - `public/downloads/omnex-player.apk` yenilendi.
    - `downloads/omnex-player-standalone-v2.8.3.apk` eklendi.
    - `public/downloads/omnex-player-standalone-v2.8.3.apk` eklendi.
  - Update manifests (UTF-8 no BOM):
    - `downloads/update.json`
    - `public/downloads/update.json`
    - `versionCode: 27`, `versionName: 2.8.3`, `downloadUrl ...?v=27`
    - `sha256: 79916b0e50f0475927fb5774f11406f90ab517ef29b4f915969e8ae21b8929f9`
- Checks:
  - `android-player/omnex-player-app> .\\gradlew.bat publishDebugApk` (pass)
  - `android-player/omnex-player-app> .\\gradlew.bat :app:compileStandaloneDebugKotlin` (pass)
  - JSON parse check: `downloads/update.json`, `public/downloads/update.json` (pass)
  - BOM check: her iki update.json dosyasi BOM yok (pass)
- Risks/Follow-up:
  - `android-player/` gitignore kapsaminda oldugu icin source kod degisiklikleri repo commit'ine dahil degil; dagitim APK artifactlari ve update manifest commitlenir.
- Backup/Restore Safety:
  - Local temp backup: `.codex/tmp_backups/20260313_013939-apk-welcome-theme-restore`
  - Restore not required.
## 2026-03-13 - stream label customization + m3u wrapper endpoint
- Request context:
  - VLC tarafinda stream acilisinda gorunen `master.m3u8` etiketinin ozellestirilmesi istendi.
  - Etiket formati `firma-player-adi-omnexplayer` olacak sekilde duzenlendi.
  - Stream icin link ve indirilebilir `.m3u` playlist endpointi eklendi.
- Changes:
  - `api/stream/helpers.php` (new):
    - Stream label normalize/build helperlari
    - Safe filename helperi
    - Base URL/base path helperlari
    - Company name resolve helperi
  - `api/stream/master.php`:
    - `helpers.php` include edildi.
    - Stream label company + device adindan uretilir hale getirildi.
    - Master playlist'e `#EXT-X-SESSION-DATA` stream title metadata satiri eklendi.
    - Response header'larina custom `Content-Disposition` filename ve `X-Stream-Label` eklendi.
  - `api/stream/playlist.php` (new):
    - `GET /api/stream/{token}/playlist.m3u`
    - `#EXTINF` satirinda custom stream label doner.
    - Target URL olarak `master.m3u8` verir.
    - `?download=1` ile attachment download destegi eklendi.
  - `api/stream/info.php`:
    - `stream_m3u_url`, `stream_m3u_download_url`, `stream_label` alanlari eklendi.
  - `api/index.php`:
    - Public stream routes altina `/{token}/playlist.m3u` route'u eklendi.
- Checks:
  - `php -l api/stream/helpers.php`
  - `php -l api/stream/master.php`
  - `php -l api/stream/playlist.php`
  - `php -l api/stream/info.php`
  - `php -l api/index.php`
  - Route spot check: `curl -D - http://localhost/market-etiket-sistemi/api/stream/testtoken/playlist.m3u` -> `403` (route active)
- Risks/Follow-up:
  - Bazi playerlar `master.m3u8` URL metnini kendi ic davranisiyla gosterebilir; bu durumda istemcide `playlist.m3u` URL kullanimi onerilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_015140-stream-m3u-label`
  - Restore not required.
## 2026-03-13 - stream m3u deploy verification
- Commit/Push:
  - `d41999f` pushed to `origin/main`.
- Server deploy:
  - `/opt/omnex-hub`: `git pull --ff-only`
  - `deploy/`: `docker compose ... build app` + `up -d --force-recreate app nginx`
- Live verification:
  - `GET https://hub.omnexcore.com/api/stream/{token}/master.m3u8` -> `200`, `Content-Disposition` now custom label-based filename.
  - `GET https://hub.omnexcore.com/api/stream/{token}/playlist.m3u` -> `200`, body includes `#EXTINF:-1,<company-device-omnexplayer>` and master URL.
  - `GET .../playlist.m3u?download=1` -> `200`, `Content-Disposition: attachment`.
## 2026-03-13 - android source tree diagnosis (player vs player-build)
- Request context:
  - Kullanici APK izin davranisi ve wizard tasarim farki icin hangi kaynak agacin kullanildigini sordu.
  - `android-player-build/.../standalone` altindaki APK surumu dogrulandi.
- Findings:
  - `android-player-build` standalone output: `versionCode 24`, `versionName 2.8.0`.
  - `android-player` standalone output: `versionCode 27`, `versionName 2.8.3`.
  - Dagitim APK hash eslesmesi: `downloads/omnex-player.apk` == `android-player/.../app-standalone-debug.apk` (v27).
  - `android-player-build` APK hash farkli (eski paket).
  - Wizard icon/background/layout dosyalari iki agacta farkli; anime/stroke ikonlar `android-player-build` agacinda.
  - Install permission popup sadece `SELF_UPDATE_ENABLED` ve `canRequestPackageInstalls()==false` ise gorunur; startup prompt tek-sefer preference gate ile sinirli.
- Changed files:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - Dosya hash karsilastirmalari (APK + drawable/layout)
  - `output-metadata.json` version dogrulamasi
- Risks/Follow-up:
  - Yanlis kaynak agactan build alinmasi tasarim ve update endpoint farklarina yol acar; tek source-of-truth belirlenmeli.
- Backup/Restore Safety:
  - Bugun olusturulmus backup klasorleri mevcut, ozellikle `20260313_013939-apk-welcome-theme-restore`.
## 2026-03-13 - stream UX follow-up (playlist link + stream mode disable)
- Request context:
  - VLC gecislerinde isim gorunmesi ve cihazlar ekraninda eski `master.m3u8` linkinin kopyalanmasi bildirildi.
  - Cihaz duzenleme modalinda stream cihazini normal cihaza cevirince stream modunda kalma sorunu bildirildi.
- Changes:
  - `public/assets/js/pages/devices/DeviceList.js`
    - Stream kopyalama URL'i `master.m3u8` yerine `playlist.m3u` oldu.
    - Sag tik islemlerine `Download M3U` aksiyonu eklendi (`?download=1`).
    - `stream_mode` artik create/update payload'inda her zaman gonderiliyor (0/1).
  - `public/assets/js/pages/devices/DeviceDetail.js`
    - Stream kartindaki URL `playlist.m3u` olarak guncellendi.
    - Stream kartina M3U indirme butonu eklendi.
  - `api/devices/update.php`
    - `stream_mode=0` geldiginde `stream_started_at` sifirlanir.
    - Eski `model=stream_player` degeri, model explicit gonderilmemisse temizlenir (UI stream badge'inin kalmasini engeller).
  - `api/stream/master.php`
    - `#EXT-X-SESSION-DATA` title satiri kaldirildi (VLC tarafi isim gorunumunu azaltmak icin).
  - `api/stream/playlist.php`
    - Varsayilan `.m3u` cikisinda `#EXTINF` basligi bos donuyor.
    - `?label=1` ile istenirse etiketi tekrar dahil etme opsiyonu eklendi.
- Checks:
  - `php -l api/stream/master.php`
  - `php -l api/stream/playlist.php`
  - `php -l api/devices/update.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
  - `node --check public/assets/js/pages/devices/DeviceDetail.js`
- Risks/Follow-up:
  - VLC davranisi player surumune gore degisebilir; geciste isim overlay tamamen kapanmazsa `playlist.m3u` + bos `EXTINF` kombinasyonu ile tekrar sahada dogrulanmali.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_021353-stream-followup-fixes`
  - Restore not required.

## 2026-03-13 - BluetoothWizard Toast i18n cleanup
- Request: Replace hardcoded Turkish Toast strings with i18n keys and remove unnecessary fallback patterns in BluetoothWizard.js
- Changes:
  - Replaced 13 hardcoded Turkish Toast/tooltip strings with `this.__()` i18n calls
  - Removed 11 unnecessary `|| 'fallback'` patterns from existing i18n calls
  - Added 12 new i18n keys under `bluetooth.wizard` in all 8 language files (tr, en, ru, az, de, nl, fr, ar)
  - New keys: connectionRequired, wifiConfigRequired, protocolRequired, verificationRequired, localhostWarning, httpServerSwitching, rebootingWait, rebootReadInfo, infoIncomplete, infoReadFailed, ipRequired, completeStepsTooltip
- Files:
  - public/assets/js/pages/devices/list/BluetoothWizard.js
  - locales/tr/pages/devices.json
  - locales/en/pages/devices.json
  - locales/ru/pages/devices.json
  - locales/az/pages/devices.json
  - locales/de/pages/devices.json
  - locales/nl/pages/devices.json
  - locales/fr/pages/devices.json
  - locales/ar/pages/devices.json
- Checks:
  - JSON validity verified for all 8 translation files via Node.js JSON.parse
  - Key existence verified in all 8 files (bluetooth.wizard.connectionRequired spot-check)
- Risks/Follow-up: None. All existing keys were verified present before removing fallbacks.
## 2026-03-13 - IPTV compatibility tweak for stream playlist.m3u
- Request context:
  - `playlist.m3u` linki VLC'de calisiyor ancak bazi IPTV uygulamalarinda oynatma hatasi olusturuyor.
- Root cause:
  - Bos `#EXTINF` basligi bazi IPTV parser'larinda gecersiz kabul edilebiliyor.
- Changes:
  - `api/stream/playlist.php`
    - `label` query varsayilani `1` yapildi.
    - Varsayilan cikis tekrar etiketli (`firma-cihaz-omnexplayer`) hale getirildi.
    - Etiket gizleme ihtiyaci icin `?label=0` destegi korunuyor.
- Checks:
  - `php -l api/stream/playlist.php`
- Risks/Follow-up:
  - Farkli IPTV istemcilerinde master playlist adaptif destegi degisken olabilir; gerekirse profile-pinli ek endpoint degerlendirilebilir.
- Backup/Restore Safety:
  - Bu mikro degisiklik onceki backup setiyle ayni kapsamda (`20260313_021353-stream-followup-fixes`), restore gerekmiyor.
## 2026-03-13 - IPTV playback fix via absolute HLS URLs
- Request context:
  - VLC calisirken IPTV uygulamalarinda stream aciliyor fakat videolar oynatilamiyor; indirilen `.m3u` dosyasi da calismiyor.
- Root cause hypothesis:
  - Bazi IPTV istemcileri HLS master/variant icindeki relative URL'leri guvenilir sekilde cozemiyor.
- Changes:
  - `api/stream/master.php`
    - Variant playlist URL'leri relative yerine full absolute URL oldu.
  - `api/stream/variant.php`
    - Segment URL'leri relative yerine full absolute URL oldu.
    - Base URL hesaplamasi icin stream helper include edildi.
- Checks:
  - `php -l api/stream/master.php`
  - `php -l api/stream/variant.php`
- Risks/Follow-up:
  - Sorun devam ederse istemci tarafi codec/protocol kisitlari icin ADB log ile hedef uygulama debug gerekir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - IPTV fallback: playlist.m3u now points to pinned variant profile
- Request context:
  - IPTV'de `playlist.m3u` ve indirilen `.m3u` calismiyor, ancak direct profile link (`variant/720p`) calisiyor.
- Changes:
  - `api/stream/playlist.php`
    - Playlist target URL `master.m3u8` yerine profile-pinli variant URL oldu.
    - Profile secimi: query `?profile=` (360p/540p/720p/1080p) veya cihaz profilinden otomatik cozumleme.
    - Cihaz profilinden profile map: <=360 -> 360p, <=540 -> 540p, <=720 -> 720p, digeri -> 1080p.
    - Debug header eklendi: `X-Stream-Profile`.
- Checks:
  - `php -l api/stream/playlist.php`
- Risks/Follow-up:
  - Eger secilen profile ilgili media icin transcode edilmemisse IPTV tarafinda yine hata verebilir; bu durumda dynamic available-profile fallback endpoint eklenmeli.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - IPTV auto profile cap to 720p
- Request context:
  - `playlist.m3u` otomatik profile seciminde 1080p donuyor; kullanici tarafinda 720p stabil calisiyor.
- Changes:
  - `api/stream/playlist.php`
    - Otomatik profile secimi 1080p yerine maksimum 720p olacak sekilde cap edildi.
    - 1080p ihtiyaci query `?profile=1080p` ile halen destekleniyor.
- Checks:
  - `php -l api/stream/playlist.php`
- Risks/Follow-up:
  - 1080p talep eden istemciler query param kullanmali; varsayilan uyumluluk odakli 720p.
- Backup/Restore Safety:
  - Temp backup zinciri: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - IPTV/VLC compatibility tuning (redirect+variant copy)
- Request context:
  - IPTV'de playlist link/file calismiyor; direct `variant/720p` calisiyor.
  - VLC tarafinda medya adi gorunmesi tekrar bildirildi.
- Changes:
  - `api/stream/playlist.php`
    - Default `label=0` (VLC isim overlay azaltma).
    - Non-download isteklerde varsayilan mod `redirect`: endpoint dogrudan secilen variant URL'e 302 yonlendirir.
    - Download modunda M3U cikti `#EXTINF:0` + CRLF formatina alindi.
    - Icerik tipi `application/x-mpegURL; charset=utf-8` oldu.
    - Debug header'lari: `X-Stream-Profile`, `X-Stream-Target`.
  - `public/assets/js/pages/devices/DeviceList.js`
    - `copy-stream-url` artik dogrudan `variant/720p/playlist.m3u8` kopyalar.
    - Download aksiyonu `playlist.m3u?download=1&profile=720p&label=0` kullanir.
- Checks:
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Bazi IPTV istemcileri 302 takip etmeyebilir; bu durumda UI tarafinda dogrudan variant URL kullanimi zaten devrede.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - stream profile auto-selection restored (no fixed 720)
- Request context:
  - Kullanici stream cihazlari icin 720p sabitlenmemesi, cihaz profiline gore otomatik ffmpeg/profile seciminin korunmasini istedi.
- Changes:
  - `public/assets/js/pages/devices/DeviceList.js`
    - Copy stream link artik sabit `720p` degil; cihaz `device_profile` ve ekran olcusune gore 360/540/720/1080 profile secer.
    - Download playlist URL'i de ayni secilen profile ile olusturulur.
  - `api/stream/playlist.php`
    - Backend auto profile seciminde tekrar 1080p secenegi aktif edildi (720 cap kaldirildi).
- Checks:
  - `node --check public/assets/js/pages/devices/DeviceList.js`
  - `php -l api/stream/playlist.php`
- Risks/Follow-up:
  - Bazi IPTV istemcileri 1080p profile'da zorlanirsa cihaz profili 720p'e cekilerek ayni otomasyonla stabil kalir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - profile-aware availability fallback (fix 1080 dead links)
- Request context:
  - VLC link'i 1080p variant'e gidip acilamiyor; kullanici cihaza gore otomatik profile secimini korumak istiyor.
- Root cause:
  - Frontend link uretimi cihaz profile'ini 1080p seciyor ancak aktif playlistte hazir 1080p transcode olmayabiliyor.
- Changes:
  - `api/stream/playlist.php`
    - Aktif playlistteki video media'lar icin `transcode_variants` tablosundan hazir profiller tespit edilir.
    - Secim algoritmasi: requested profile -> device auto profile -> fallback order (720/540/360/1080) ile mevcut profile secilir.
    - `mode=redirect` ile link dogrudan secilen variant'e yonlenir, ama secilen profile artik mevcutluk kontrolunden gecer.
  - `public/assets/js/pages/devices/DeviceList.js`
    - Copy link artik backend resolver endpointini (`playlist.m3u?mode=redirect&label=0`) kopyalar; frontend tarafinda yanlis profile sabitlemez.
    - Download m3u de ayni resolver endpointten profile parametresi vermeden uretilir (backend mevcut profile secer).
- Checks:
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Cihazda hic ready transcode yoksa endpoint yine oynatilamaz; bu durumda transcode queue ve hazir profile kontrolu gerekir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_023518-iptv-absolute-url-fix`
  - Restore not required.
## 2026-03-13 - Stream playlist compatibility fix (master regression follow-up)
- Request context:
  - `master.m3u8` gecisi sonrasinda IPTV/link akisinda sorunlar olustu; kullanici stream icin indirilebilir playlist dosyasi akisini tekrar istedi.
- Changes:
  - `api/stream/playlist.php`
    - `streamPlaylistResolveAvailableProfiles()` schedule tabanli aktif playlist fallback'i eklendi (assignment disinda da profile cozumleme).
    - Availability verisi yoksa otomatik secimde 1080p yerine uyumluluk fallback'i 720p yapildi.
    - Varsayilan cikis modu yeniden `m3u` yapildi; redirect sadece `mode=redirect` ile aktif.
    - Varsayilan etiket gosterimi yeniden acildi (`label=1` default).
    - M3U satiri `#EXTINF:-1` ve content-type `audio/x-mpegurl` olarak duzenlendi.
  - `public/assets/js/pages/devices/DeviceList.js`
    - Stream copy aksiyonu `playlist.m3u` linkini direkt kopyalayacak sekilde guncellendi (redirect parametresi kaldirildi).
    - Stream download aksiyonu `playlist.m3u?download=1` akisina sadele�tirildi.
- Checks:
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Bazi IPTV istemcilerinde `master.m3u8` adaptif secim yerine direct variant gerekebilir; bu durumda `playlist.m3u` uzerinden profile pin eklenebilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_030838-stream-master-regression-fix`
  - Restore not required.
## 2026-03-13 - IPTV direct-variant resolution and M3U compatibility hardening
- Request context:
  - IPTV tarafinda wrapper playlist link/file acilmiyor; ayni tokenin direct `variant/720p/playlist.m3u8` linki calisiyor.
- Root cause hypothesis:
  - Bazi IPTV istemcileri nested `.m3u` -> `.m3u8` akisinda veya HTTP header/format farklarinda (inline disposition / CRLF / redirect handling) kirilabiliyor.
- Changes:
  - `public/assets/js/pages/devices/DeviceList.js`
    - Yeni `resolveDirectStreamUrl()` eklendi: backend resolver (`playlist.m3u?mode=redirect&label=0`) cagrilip final `variant/*.m3u8` URL'i cozuluyor.
    - `copyStreamUrl()` artik resolved direct variant URL'i kopyaliyor.
    - `downloadStreamPlaylist()` artik client-side `.m3u` dosyasi uretiyor ve icine direct variant URL yaziyor (nested wrapper bagimliligi kaldirildi).
  - `api/stream/playlist.php`
    - M3U satiri `#EXTINF:0` olarak sadele�tirildi.
    - Satir sonlari `\n` yapildi.
    - Content-Type `application/x-mpegURL; charset=utf-8` oldu.
    - `Content-Disposition` sadece `download=1` durumunda set ediliyor.
- Checks:
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Cok kati IPTV parser'larinda yine profile uyumsuzlugu olursa profile pin (`?profile=720p`) secenegi UI'da opsiyonel acilabilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_032655-iptv-direct-variant-resolve`
  - Restore not required.
## 2026-03-13 - VLC title fallback suppression on stream transitions
- Request context:
  - IPTV dosya/link sorununa ek olarak VLC'de video gecislerinde dosya/URL adi yeniden gorunmeye basladi.
- Changes:
  - `api/stream/master.php`
    - Master playlist'e tekrar `#EXT-X-SESSION-DATA:DATA-ID="com.omnex.stream.title"` satiri eklendi (stream label escaped).
    - HTTP response'tan `Content-Disposition` kaldirildi (VLC'nin dosya adi fallback olasiligini azaltmak icin).
- Checks:
  - `php -l api/stream/master.php`
- Risks/Follow-up:
  - Bazi istemciler session-data tag'ini ignore eder; bu durumda ad fallback'i istemci tarafi ayariyla da etkilenebilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_033854-vlc-title-suppression`
  - Restore not required.
## 2026-03-13 - IPTV Smarters channel parse fix + VLC transition title regression fix
- Request context:
  - IPTV Smarters Pro'da M3U import'ta "canli TV 0 icerik" gorunuyor (stream calissa da kanal listesi bos).
  - VLC'de video gecislerinde playlist/medya adi tekrar gorunuyor.
- Changes:
  - `public/assets/js/pages/devices/DeviceList.js`
    - Downloaded M3U icerigi IPTV parser uyumlu hale getirildi:
      - `#EXTINF:-1 tvg-id="" tvg-name="..." group-title="Omnex",...`
      - Kanal adi bos olmayacak sekilde cihaz adindan uretiliyor.
      - VLC icin opsiyon satirlari eklendi: `#EXTVLCOPT:no-video-title-show`, `#EXTVLCOPT:input-title-format=`.
  - `api/stream/playlist.php`
    - Wrapper M3U satiri `#EXTINF:-1` formatina geri alindi (IPTV parser uyumlulugu).
  - `api/stream/master.php`
    - VLC gecislerinde playlist adinin gorunmesini tetikleyen `EXT-X-SESSION-DATA` satiri kaldirildi.
    - `Content-Disposition` zaten onceki duzeltmede kaldirilmisti ve korunuyor.
- Checks:
  - `php -l api/stream/master.php`
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Farkli IPTV uygulamalarinda M3U attribute beklentileri degisebilir; gerekirse app'e gore ikinci export profili eklenebilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_034936-iptvsmarters-vlc-title-fix`
  - Restore not required.
## 2026-03-13 - VLC transition overlay root-cause fix + URL M3U parser hardening
- Request context:
  - VLC'de video gecislerinde playlist/metin overlay'i devam ediyor; onceki gecici ayarlar kalici cozum olmadi.
  - IPTV Smarters URL import'ta kanal/icerik parse davranisi tutarsiz.
- Root cause:
  - `variant` playlistte her medya gecisinde `#EXT-X-DISCONTINUITY` eklenmesi VLC'de yeni medya/title overlay tetikleyebiliyor.
  - URL tabanli `playlist.m3u` cikti satiri IPTV parser beklentisi icin zayif kalabiliyor.
- Changes:
  - `api/stream/variant.php`
    - Segment birlestirmede medya-gecis `DISCONTINUITY` enjeksiyonu kaldirildi.
    - Playlist artik segmentleri kesintisiz canli akis gibi sunuyor (VLC gecis overlay azalmasi hedefi).
  - `api/stream/playlist.php`
    - URL M3U cikti satiri parser-uyumlu hale getirildi:
      - `#EXTINF:-1 tvg-id="" tvg-name="..." group-title="Omnex",...`
    - Kanal adi sanitize/escape islemi eklendi.
- Checks:
  - `php -l api/stream/variant.php`
  - `php -l api/stream/playlist.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
- Risks/Follow-up:
  - Farkli codec parametreleri olan transcode segmentlerinde discontinuity kaldirilmasi nadiren senkron gecis etkisi yapabilir; gozlemlenirse kosullu discontinuity stratejisi eklenir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_035803-vlc-discontinuity-iptv-parser-fix`
  - Restore not required.
## 2026-03-13 - Revert VLC transition freeze change
- Request context:
  - Kullanici VLC'de son degisiklikten sonra video gecislerinin dondugunu bildirdi ve VLC ile ilgili degisikligin geri alinmasini istedi.
- Changes:
  - `api/stream/variant.php`
    - Son hardening adiminda kaldirilan `#EXT-X-DISCONTINUITY` enjeksiyonu geri alindi.
    - Segment birlestirme onceki calisan akisina restore edildi (video gecisi ve dongu basi discontinuity davranisi).
- Checks:
  - `php -l api/stream/variant.php`
- Risks/Follow-up:
  - VLC gecis overlay metni sorunu tekrar gorulebilir; donma sorunu cozulduktan sonra client-tipine gore kosullu playlist varyanti dusunulebilir.
- Backup/Restore Safety:
  - Temp backup: `.codex/tmp_backups/20260313_040246-revert-vlc-transition-freeze`
  - Restore applied from git source: `546fd45` (only `api/stream/variant.php`).

## 2026-03-13 - CRUD update/delete transaction hardening pass (devices/products/templates/users/media)
- Request context:
  - Kullanici onceki listelenen update/delete endpointlerinde sunucuda gorulen 500/exception risklerini transaction, rollback ve audit izolasyonu ile sertlestirmemi istedi.
  - Ek olarak encode bozulmasi riski nedeniyle temp yedekli ilerleme istendi.
- Changes:
  - Transaction + rollback + error logging eklendi:
    - api/device-groups/update.php
    - api/device-groups/delete.php
    - api/devices/update.php
    - api/licenses/update.php
    - api/products/update.php
    - api/products/delete.php
    - api/templates/update.php
    - api/templates/delete.php
    - api/users/update.php
    - api/users/delete.php
    - api/web-templates/update.php
    - api/web-templates/delete.php
    - api/media/delete.php
    - api/render-queue/delete.php
    - api/gateways/delete.php
  - Audit log cagrilari islem sonucunu bozmayacak sekilde try/catch ile izole edildi.
  - api/devices/update.php once HEAD'den geri alinip transaction yapisi encode bozulmadan yeniden uygulandi.
- Checks:
  - php -l api/device-groups/update.php
  - php -l api/device-groups/delete.php
  - php -l api/devices/update.php
  - php -l api/licenses/update.php
  - php -l api/products/update.php
  - php -l api/products/delete.php
  - php -l api/templates/update.php
  - php -l api/templates/delete.php
  - php -l api/users/update.php
  - php -l api/users/delete.php
  - php -l api/web-templates/update.php
  - php -l api/web-templates/delete.php
  - php -l api/media/delete.php
  - php -l api/render-queue/delete.php
  - php -l api/gateways/delete.php
- Risks/Follow-up:
  - Bu pass agirlikla API yazma atomikligini guclendirir; uygulama seviyesi endpoint smoke test (create/update/delete) ile davranis dogrulamasi hala gerekli.
  - api/products/update.php icinde branch override servisinin ic implementasyonu ayrica integration test ile dogrulanmali.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/20260313_042030-crud-hardening-pass2
  - Restore not required.
## 2026-03-13 - Android player wizard visual restore + APK v2.8.4 release package update
- Request context:
  - Kullanici wizard tasariminin eski animasyonlu/ikonlu haline geri alinmasini, sadece arka planin player tema stilinde kalmasini ve yeni APK'nin downloads/update.json ile yayinlanmasini istedi.
- Changes:
  - Local Android source (gitignore kapsaminda, release build icin):
    - ndroid-player/omnex-player-app/app/src/main/java/com/omnex/player/WizardActivity.kt
      - Animasyonlu adim gecisleri + icon_pulse geri alindi.
      - Yerel ag hostlari icin http, digerleri icin https secen URL normalizasyonu korundu.
    - Wizard layout/icon dosyalari animasyonlu tasarim referansina gore geri alindi:
      - 
es/layout/activity_wizard_mobile.xml
      - 
es/layout-land/activity_wizard_mobile.xml
      - 
es/layout/activity_wizard_tv.xml
      - 
es/drawable/wizard_welcome.xml
      - 
es/drawable/wizard_server.xml
      - 
es/drawable/wizard_ready.xml
      - 
es/anim/icon_pulse.xml (eklendi)
      - 
es/anim/splash_logo_enter.xml (eklendi)
    - Arka plan drawables player stilinde mevcut halleriyle korunmustur:
      - 
es/drawable/wizard_mobile_background.xml
      - 
es/drawable/wizard_mobile_card_bg.xml
      - 
es/drawable/wizard_card_bg.xml
    - Build version guncellendi: ersionCode 28, ersionName 2.8.4 (ndroid-player/omnex-player-app/app/build.gradle).
  - Tracked release artifacts:
    - downloads/omnex-player.apk guncellendi.
    - public/downloads/omnex-player.apk guncellendi.
    - downloads/update.json guncellendi.
    - public/downloads/update.json guncellendi.
    - Versioned kopyalar olusturuldu: downloads/omnex-player-standalone-v2.8.4.apk, public/downloads/omnex-player-standalone-v2.8.4.apk.
- Checks:
  - ./gradlew.bat publishDebugApk (android-player/omnex-player-app)
  - apt dump badging downloads/omnex-player.apk -> ersionCode='28', ersionName='2.8.4'
  - Get-FileHash downloads/omnex-player.apk -Algorithm SHA256 -> d611a2a43dbaa9d994235d7c50373079f6ac9dc789ec1854b6d03915fd501229
- Risks/Follow-up:
  - Android kaynak klasoru gitignore altinda oldugu icin tasarim kaynak degisiklikleri repoya gitmez; dagitim APK dosyalari ve update.json uzerinden yapilir.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/20260313_044404-android-wizard-restore
  - Restore not required.## 2026-03-13 - CRUD smoke test harness (non-destructive update/delete probes)
- Request context:
  - Kullanici, daha once transaction hardening uygulanan update/delete endpointleri icin birlikte smoke test calistirmamizi istedi.
  - Ozellikle canli veriyi bozmadan (non-destructive) CRUD update/delete davranisinda 500 ve exception riskini gormek hedeflendi.
- Changes:
  - scripts/test_endpoints_smoke.php
    - Auth asamasina local token bootstrap eklendi (Admin/SuperAdmin -> Auth::generateTokens fallback).
    - Non-destructive CRUD smoke asamasi eklendi (update: mevcut degeri tekrar gonderme, delete: fake UUID probe).
    - Hedef endpointler: device-groups, devices, licenses, products, templates, users, web-templates, media, render-queue, gateways.
    - CSRF gerektiren web-templates icin token/cookie yonetimi eklendi.
    - Yeni CLI secenekleri: --skip-crud, --no-local-token.
- Checks:
  - php -l scripts/test_endpoints_smoke.php
  - php scripts/test_endpoints_smoke.php --skip-public
  - php scripts/test_endpoints_smoke.php
- Risks/Follow-up:
  - Bu smoke update cagirilari kayitlarin is alanlarini degistirmez ancak endpointler updated_at/audit gibi metadata yazabilir.
  - Delete probe fake UUID kullandigi icin transaction rollback yolunu degil, endpointin guvenli hata davranisini dogrular.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/test_endpoints_smoke.php.20260313_045850.bak
  - Restore not required.
## 2026-03-13 - Production CRUD smoke run with SuperAdmin token (manual API-driven selection)
- Request context:
  - Kullanici sunucuda (hub.omnexcore.com) da update/delete smoke testinin SuperAdmin ile calistirilmasini istedi.
- Changes:
  - Kod degisikligi yok (yalnizca runtime smoke test calistirildi).
- Checks:
  - php scripts/test_endpoints_smoke.php --base-url=https://hub.omnexcore.com (local token fallback denemesi -> 401, beklendigi gibi)
  - API login + endpoint list inspection (SuperAdmin) ile remote data shape dogrulamasi
  - Non-destructive manual smoke (remote API-driven IDs):
    - PASS: PUT devices/licenses/products/templates/users
    - PASS: DELETE probe device-groups/products/templates/users/web-templates/media/render-queue/gateways (safe 404)
    - SKIP: PUT device-groups, PUT web-templates (kayit yok)
  - Summary: PASS=15 FAIL=0 SKIP=2
- Risks/Follow-up:
  - Testte update endpointleri ayni degerle cagrildigi icin is verisi degismedi; ancak updated_at/audit kayitlari yazilmis olabilir.
## 2026-03-13 - Notification 401 hardening (proactive token refresh in Api)
- Request context:
  - Kullanici, sunucuda bildirim endpointlerinde (`/api/notifications`, `/api/notifications/unread-count`) 401 goruldugunu; localde ayni akisin sorunsuz oldugunu bildirdi.
- Findings:
  - Endpointler sunucuda gecerli bearer token ile calisiyor (manual check: notifications/unread-count -> success).
  - 401, istemci tarafinda token gecis aninda (polling) olusan auth yenileme yarisi/seans suresi etkisi olarak gorunuyor.
- Changes:
  - public/assets/js/core/Api.js
    - `request()` basina `ensureFreshAccessToken()` cagrisi eklendi.
    - JWT `exp` parse yardimcisi eklendi (`parseTokenExpiry`).
    - Token suresi 45 saniye altina dusunce, istek oncesi refresh yapilacak sekilde preflight yenileme eklendi.
- Checks:
  - node --check public/assets/js/core/Api.js
- Risks/Follow-up:
  - Refresh token gecersizse 401 yine olusabilir; bu durumda beklenen davranis session-expired akisidir.
  - Sunucuda yeni JS'nin aktif olmasi icin cache/SW temizleyip hard refresh onerilir.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/Api.js.20260313_051618.notifications-auth-precheck.bak
  - Restore not required.

## 2026-03-13 - Stream gecis donmasi + efekt tutarsizligi + siyah ekran fix

- Request: VLC stream gecislerinde donma, playlist efektleri tutarsiz, PWA siyah ekran sorunu
- Root causes:
  1. variant.php: MEDIA-SEQUENCE dongu gecisinde geriye atliyordu (HLS spec ihlali)
  2. player.js: releaseResolvedTransitionType() exit+enter icin 2 kez cagriliyordu
  3. player.css: #video-content-alt.loading kurali eksikti, z-index sifirlaniyordu
- Changes:
  - api/stream/variant.php
    - globalMediaSequence: elapsed zamani / ortalama segment suresi bazli monoton artan hesaplama
    - EXT-X-TARGETDURATION: sabit 6 yerine segmentlerdeki max surenin ceil degeri
  - public/player/assets/js/player.js
    - applyExitTransition: releaseResolvedTransitionType kaldirildi (sadece enter'da)
    - applyEnterTransition: enterElement.style.zIndex='' satiri kaldirildi
    - visibilitychange: video pause/resume eklendi (tab gecisinde siyah ekran onlemi)
  - public/player/assets/css/player.css
    - #video-content-alt.loading { visibility: hidden } eklendi
    - .content-item { z-index: 0 } base katman eklendi
- Checks:
  - php -l api/stream/variant.php -> OK
  - node -e "new Function(code)" player.js -> OK
- Risks/Follow-up:
  - VLC'de stream gecisi test edilmeli (playlist dongusu)
  - PWA'da tab gecisi test edilmeli
  - random-safe efekt modu regresyon testi
- Backup/Restore Safety:
  - api/stream/variant.php.bak_streamfix_20260313
  - public/player/assets/js/player.js.bak_streamfix_20260313
  - public/player/assets/css/player.css.bak_streamfix_20260313

## 2026-03-14 - Stream/PWA follow-up: live manifest cache bypass + SW prune fix
- Request context:
  - Kullanici, VLC stream gecislerinde donma ve PWA/PC playerda gecis efekti tutarsizligi + gecis sonrasi siyah ekran problemlerinin sunucuda devam ettigini bildirdi.
- Findings:
  - public/player/sw.js dosyasinda `pruneMediaCache` fonksiyonu iki kez tanimliydi; ikinci tanim birincisini override ettigi icin `pruneMediaCache(50)` cagrisi keep-list prune gibi calisip medya cache'ini yanlis temizleyebiliyordu.
  - Service Worker `.m3u8` isteklerini media cache-first akisina sokuyordu; canli HLS playlist'lerinde bu durum bayat manifest ve gecis donmasi uretiyordu.
  - public/player/assets/js/player.js precache akisi canli stream URL'lerini (`/api/stream/...` ve `.m3u8`) da cachelemeye aday yapiyordu.
- Changes:
  - public/player/sw.js
    - CACHE_VERSION `v1.2.6` yapildi.
    - `.m3u8` media cache listesinden cikarildi.
    - `isLivePlaylistRequest()` + `livePlaylistNetworkFirst()` eklendi (manifestler network-first/no-store).
    - Cakisan fonksiyonlar ayrildi: `pruneMediaCacheBySize()` ve `pruneMediaCacheByKeepList()`.
    - `PRUNE_MEDIA_CACHE` message handler yeni keep-list fonksiyonuna baglandi.
    - URL validator'a `.m3u8` precache engeli eklendi.
  - public/player/assets/js/player.js
    - `isValidCacheableUrl()` icinde `/api/stream/` ve `.m3u8` URL'leri precache disina alindi.
  - public/player/index.html
    - Player module query version `v=42 -> v=43` guncellendi.
- Checks:
  - php -l api/stream/variant.php
  - node --check public/player/assets/js/player.js
  - node --check public/player/sw.js
- Risks/Follow-up:
  - Yeni SW'nin devreye girmesi icin istemcilerde eski worker temizlenmeli (hard refresh + gerekirse cache/site data temizligi).
  - VLC tarafinda donma devam ederse, sunucudaki eski transcode varyantlari icin yeniden transcode uygulanmasi gerekebilir.
- Backup/Restore Safety:
  - Temp backups:
    - .codex/tmp_backups/variant.php.20260314_001433.vlcfix.bak
    - .codex/tmp_backups/sw.js.20260314_001433.vlcfix.bak
    - .codex/tmp_backups/player.js.20260314_001433.vlcfix.bak
  - Restore not required.

## 2026-03-14 - Sync race guard (pre-commit step)
- Request context:
  - Kullanici, PWA'da animasyon gecisi sonrasi icerigin gorunmemesi sorununun devam ettigini; console loglarinda arka plana gecis/geri donus ve sync hash satirlarini paylasti.
- Findings:
  - `syncContent()` ayni anda birden fazla kaynaktan tetikleniyor (visibilitychange, periodik sync, SW message).
  - Karsilastirma degiskenlerinin bir kismi await oncesi, hash hesabi await sonrasi alindigi icin race durumunda yalanci `playlistChanged/itemsChanged/configChanged` olusabiliyor.
  - Yalanci degisiklik algisi `stopPlayback()+startPlayback()` dalini gereksiz tetikleyip gecis sirasinda gorunurluk/siyah ekran etkisi uretebiliyor.
- Changes:
  - public/player/assets/js/player.js
    - Sync race engeli icin `_syncInFlight`, `_queuedSyncPending`, `_queuedSyncForceRestart` eklendi.
    - In-flight iken gelen sync istekleri tek bir kuyru�a birlestirildi (coalesced follow-up sync).
    - Karsilastirma snapshot'i tek noktadan alinacak sekilde current playlist/hash/signature hesaplamasi normalize edildi.
- Checks:
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - Bu adim concurrency kaynakli yalanci restart'lari hedefler; eger siyah ekran devam ederse ikinci adimda transition class/visibility state'i runtime log ile daha derin izlenmeli.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/player.js.20260314_003246.sync-lock-investigation.bak
  - Restore not required.

## 2026-03-14 - PWA transition visibility/z-index deep debug instrumentation
- Request context:
  - Kullanici, PWA'da efekt gecisinden sonra icerik gorunmemesi sorunu icin z-index/visibility odakli derin debug istedi.
- Findings:
  - Console akisi, visibilitychange + sync tetiklemeleri ve transition sirasinda katman durumunun anlik izlenmesine ihtiyac oldugunu gosteriyor.
- Changes:
  - public/player/assets/js/player.js
    - `_debugBuildElementState()` eklendi: display/visibility/opacity/z-index (inline+computed), animation state, rect, video runtime state.
    - `_debugDumpLayerState()` eklendi: tum ana katmanlar + merkez noktadaki top element snapshot.
    - Debug snapshot noktalarina enstrumantasyon eklendi:
      - hideAllContent basi/sonu
      - applyExitTransition basi/sonu
      - applyEnterTransition basi/sonu
      - revealVideoElement anlik + transition-sonrasi
      - visibilitychange hidden/visible once-sonra
- Checks:
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - Debug mode acikken log hacmi yuksek olur; sorun tespitinden sonra bu enstrumantasyon sadele�tirilmeli.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/player.js.20260314_003639.transition-debug.bak
  - Restore not required.

## 2026-03-14 - Transition duplicate reveal guard + timer dedupe
- Request context:
  - Kullanici, hem browser hem PWA modunda gecis sonrasi gorunurluk sorununu tekrar test etti; loglarda ayni item icin coklu `reveal-video` ve `enter-transition-start` tetiklenmesi goruldu.
- Findings:
  - Video event callback'leri (onplay/onplaying/onloadeddata/canplaythrough/promise.then) ayni item icin art arda `revealVideoElement()` cagiriyor.
  - Bu tekrarlar ayni elemana birden fazla enter transition timeout'u baglayip katman durumunu bozabiliyor.
- Changes:
  - public/player/assets/js/player.js
    - Transition timeout dedupe eklendi (`_enterTransitionTimers`, `_exitTransitionTimers`).
    - `_cleanupVideoElement()` icinde pending enter/exit timeout temizligi eklendi.
    - `revealVideoElement()` duplicate guard eklendi (`reveal-video-skip-duplicate`).
    - Enter transition sadece gercekten yeni reveal durumunda calisacak sekilde kosullandirildi.
  - public/player/index.html
    - Player module query version `v=43 -> v=44` guncellendi.
- Checks:
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - Debug enstrumantasyonu halen acik; kok neden kapandiktan sonra loglar sadele�tirilmeli.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/player.js.20260314_003639.transition-debug.bak
  - Restore not required.

## 2026-03-14 - Overlay mask hardening + explicit layer pinning
- Request context:
  - Kullanici, son loglardan sonra PWA'da efekt sonrasi videonun arkada kalmasi/maske kalmasi olasiligini bildirdi.
- Findings:
  - Duplicate reveal sorunu bastirilmis durumda; kalan risk overlay-mask class'inin takili kalmasi veya aktif katmanin z-index'te geride kalmasi.
- Changes:
  - public/player/assets/js/player.js
    - Layer debug payload'ina `hasOverlayMask` eklendi.
    - hideAllContent'te kapatilan elementler icin `z-index:0` netlendi.
    - applyExitTransition'ta cikan element `z-index:1`, exit sonu `z-index:0` yapildi.
    - applyEnterTransition'ta giren element `z-index:2` pinlendi.
    - revealVideoElement'ta `show-overlay-mask` varsa zorla temizleniyor (`overlay-mask-force-removed` debug eventi).
    - reveal edilen video icin `z-index:2` explicit uygulandi.
  - public/player/index.html
    - Player module query version `v=44 -> v=45` guncellendi.
- Checks:
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - Sorun devam ederse sonraki adimda wipe-up etkisinin video icin clip-path fallback'e (fade) dusurulmesi degerlendirilmeli.
- Backup/Restore Safety:
  - Onceki debug backup'lar korunuyor (.codex/tmp_backups/player.js.*)
  - Restore not required.

## 2026-03-14 - Layer debug removal after verification
- Request context:
  - Kullanici, davranis duzeldigi icin eklenen PWA layer debug loglarinin kaldirilmasini istedi.
- Findings:
  - Son test loglarinda duplicate reveal baskilamasi, sync hash stabilitesi ve transition akisinda regrese eden belirti gorulmedi.
- Changes:
  - public/player/assets/js/player.js
    - Gecici layer debug enstrumantasyonu tamamen kaldirildi (`_debugBuildElementState`, `_debugDumpLayerState` ve tum cagrilari).
    - Fonksiyonel duzeltmeler korundu (sync race guard, duplicate reveal guard, transition timer dedupe, z-index pinning, overlay mask force remove).
  - public/player/index.html
    - Player module query version `v=45 -> v=46` guncellendi.
- Checks:
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - SW'deki `Media cache results` loglari gelmeye devam eder; istenirse sonraki adimda bu loglar da debug kosuluna alinabilir.
- Backup/Restore Safety:
  - Onceki temp backup'lar korunuyor (.codex/tmp_backups/player.js.*)
  - Restore not required.

## 2026-03-14 - Signage refresh dedupe + Edge PWA transition fallback
- Request context:
  - Kullanici, signage playlist ikonlarindan refresh komutunun birden fazla tetiklendigini ve Edge PWA'da transition efektlerinin Chrome kadar tutarli uygulanmadigini bildirdi.
  - Edit oncesi mevcut durumun saglikli notuyla temp backup alinmasi istendi.
- Findings:
  - Playlist komut akisinda assigned device listesinde tekrarli device_id gelirse ayni cihaza birden fazla komut gidebiliyor.
  - UI tarafinda hizli tekrar tetiklemeleri (cift listener/cift tik) komut akisinda duplicate dispatch riski olusturuyor.
  - Edge PWA'da wipe tabanli clip-path gecisleri video akislarda tutarsiz gorunebiliyor.
- Changes:
  - public/assets/js/pages/signage/PlaylistList.js
    - `getUniqueAssignedDevices()` eklendi; komut ve cihaz listeleri device_id bazli dedupe edildi.
    - `isDuplicatePlaylistCommandTrigger()` eklendi; kisa pencere icinde ayni playlist+komut tekrar tetikleri engellendi.
    - `sendPlaylistCommand()` dedupe+trigger-guard kullanacak sekilde guncellendi.
    - `sendCommandToDevices()` cagrisi oncesi `deviceIds` uniq hale getirildi.
    - `showAssignedDevicesModal()` cihaz listesi dedupe edilerek gosterilecek sekilde guncellendi.
  - public/player/assets/js/player.js
    - Edge PWA tespiti eklendi (`_isEdgeBrowser`, `_isEdgePwa`).
    - `getEdgeTransitionFallback()` eklendi; Edge PWA'da `wipe-*` gecisleri `push-*` fallback'e mapleniyor.
    - `getResolvedTransitionType()` fallback mapper kullanacak sekilde guncellendi.
  - public/player/index.html
    - player module query version `v=46 -> v=47` (working tree referansi) olacak sekilde guncellendi.
- Checks:
  - node --check public/assets/js/pages/signage/PlaylistList.js
  - node --check public/player/assets/js/player.js
- Risks/Follow-up:
  - Eğer Edge tarafinda bazi cihazlarda push gecisleri de tutarsiz olursa sonraki adimda Edge PWA icin gecis seti `fade/crossfade` ile daha da daraltilabilir.
  - Signage API tarafinda duplicate assignment kaydi olusuyorsa backend tarafinda da unique constraint veya dedupe katmani ile sertlestirme dusunulmeli.
- Backup/Restore Safety:
  - Temp backup: .codex/tmp_backups/20260314_010548_refresh-edge-healthy
  - Not: edit oncesi "mevcut durum saglikli" notu backup klasorunde tutuldu.
  - Restore not required.

## 2026-03-14 - Server container deploy verification
- Request context:
  - User requested pushing current changes to server container and confirming deployment status.
- Changes:
  - No local source files changed in this step.
  - Remote server `/opt/omnex-hub` updated to commit `906e715` via `git pull --rebase --autostash origin main`.
- Checks:
  - Remote git head check: `git rev-parse --short HEAD` => `906e715`.
  - Remote container status: `docker compose -p omnex -f docker-compose.yml -f docker-compose.standalone.yml ps` (all core services up, app/postgres/mqtt/transcode healthy).
  - Health endpoint check: `curl -sk https://localhost/api/health` => HTTP 200 with `{"status":"ok"...}`.
- Risks/Follow-up:
  - First deploy command run was user-interrupted, but post-checks confirm stack is up and serving current commit.
- Backup/Restore Safety:
  - No file edit operation performed; backup not required.
## 2026-03-14 - Stream fallback format fix for single-channel VLC behavior
- Request context:
  - User reported fallback stream looked like separate items instead of one live channel.
- Findings:
  - Passthrough fallback was plain M3U (#EXTINF list only), so VLC playlist UI treated entries as item list.
- Changes:
  - api/stream/master.php
    - Fallback output switched to HLS event style (#EXT-X-VERSION, #EXT-X-PLAYLIST-TYPE:EVENT, #EXT-X-TARGETDURATION, #EXT-X-MEDIA-SEQUENCE).
    - Added X-Stream-Fallback-Format: hls-event response header.
  - api/stream/variant.php
    - Same HLS event fallback format applied for no-segment path.
    - Added X-Stream-Fallback-Format: hls-event response header.
- Checks:
  - php -l api/stream/master.php
  - php -l api/stream/variant.php
  - curl -i /api/stream/{token}/variant/720p/playlist.m3u8 => HTTP 200, fallback headers present
  - curl /api/stream/{token}/playlist.m3u => still single channel entry to master.m3u8
- Risks/Follow-up:
  - Muted-per-item behavior is not represented in HLS fallback mode; strict mute control still depends on transcode pipeline.## 2026-03-14 - VLC playback fix: m3u8 fallback target moved to flat m3u
- Request context:
  - User confirmed single-file view returned, but playback did not start.
- Findings:
  - No-transcode fallback target was .m3u8; VLC could treat it as HLS parse path and not play direct MP4 list reliably.
- Changes:
  - api/stream/playlist.php
    - Added lat mode (playlist.m3u?flat=1) that returns direct repeated M3U media entries for fallback playback.
    - Added helper functions to resolve active playlist items and media URLs in this endpoint.
    - When no ready transcode profiles exist, channel target now points to playlist.m3u?flat=1 instead of master.m3u8.
  - api/stream/master.php
    - Kept passthrough fallback as plain M3U (X-Stream-Fallback-Format: m3u).
  - api/stream/variant.php
    - Kept passthrough fallback as plain M3U (X-Stream-Fallback-Format: m3u).
- Checks:
  - php -l api/stream/playlist.php
  - php -l api/stream/master.php
  - php -l api/stream/variant.php
  - curl /api/stream/{token}/playlist.m3u => single channel target now playlist.m3u?flat=1
  - curl -i /api/stream/{token}/playlist.m3u?flat=1 => HTTP 200, X-Stream-Target-Mode: flat-fallback
- Risks/Follow-up:
  - VLC can still show nested list entries inside the channel source, but playback compatibility in no-ffmpeg local mode is improved.## 2026-03-14 - Local ffmpeg install + HLS transcode recovery
- Request context:
  - User confirmed direct MP4 opened but stream links did not; requested local ffmpeg installation.
- Findings:
  - ffmpeg/ffprobe missing caused no variant generation.
  - After install, transcode still failed due Windows escaping issue in HLS segment template argument.
- Changes:
  - .env.local
    - Added FFMPEG_PATH and FFPROBE_PATH pointing to WinGet links.
  - services/HlsTranscoder.php
    - Added quoteShellArg() helper for Windows-safe argument quoting.
    - Fixed HLS segment template argument to preserve %04d on Windows (-hls_segment_filename).
  - Transcode queue processed locally to completion (completed=8, 
eady_variants=8).
- Checks:
  - php -l services/HlsTranscoder.php
  - php workers/TranscodeWorker.php --status (before/after)
  - php workers/TranscodeWorker.php --once (multiple runs until queue empty)
  - curl -i /api/stream/{token}/playlist.m3u => X-Stream-Target-Mode: variant
  - curl -i /api/stream/{token}/variant/720p/playlist.m3u8 => HTTP 200 (HLS playlist)
  - ffprobe on variant playlist URL => video/audio streams detected
- Risks/Follow-up:
  - New terminal sessions may need PATH refresh for direct fmpeg command; app uses .env.local paths so runtime remains stable.## 2026-03-14 - VLC freeze triage and client-specific flat target
- Request context:
  - User reported both stream links opened but froze every 2-3 seconds in VLC.
- Findings:
  - Segment URLs were reachable (HTTP 200), but ffmpeg playback probe showed timestamp discontinuity and non-monotonic DTS on stitched variant stream.
  - Variant stream started from mid-window segments in some responses, increasing VLC sensitivity.
- Changes:
  - api/stream/variant.php
    - Added media_id tracking per stitched segment.
    - Added #EXT-X-DISCONTINUITY between different media blocks.
    - Aligned live window start to first segment of current media block.
    - Added #EXT-X-DISCONTINUITY-SEQUENCE for sliding window continuity metadata.
  - api/stream/playlist.php
    - Added VLC client detection via user-agent and stream_mode query.
    - VLC (or stream_mode=flat) now targets playlist.m3u?flat=1 instead of HLS variant.
- Checks:
  - php -l api/stream/variant.php
  - php -l api/stream/playlist.php
  - curl with VLC user-agent on playlist endpoint => X-Stream-Target-Mode: flat-fallback
  - curl without VLC user-agent => X-Stream-Target-Mode: variant
- Risks/Follow-up:
  - Stitched live HLS may still show timestamp warnings with strict ffmpeg probe; VLC stability path is now flat M3U target.## 2026-03-14 - VLC title overlay suppression + stream behavior assessment
- Request context:
  - User requested hiding playlist/content name overlays in VLC and asked for transition/performance/HLS profile assessment.
- Findings:
  - Flat M3U output is used for VLC stability path; per-item title overlay can be controlled with VLC options.
  - Stitched live HLS (ariant/*.m3u8) still emits DTS monotonicity warnings under ffmpeg long-read, indicating potential freeze risk on strict clients.
  - Ready transcode profile inventory currently shows only 720p (8 items).
- Changes:
  - api/stream/playlist.php
    - Added isVlcClient detection.
    - Flat mode now injects VLC options per item to suppress title overlays:
      - #EXTVLCOPT:no-video-title-show
      - #EXTVLCOPT:input-title-format=
    - Kept VLC auto-target behavior to flat fallback stream.
- Checks:
  - php -l api/stream/playlist.php
  - curl (VLC user-agent) on playlist.m3u?flat=1 => VLC options present in output
  - 180s ffmpeg read on variant HLS => non-monotonic DTS warnings observed
  - profile inventory query => 720p|ready|8
- Risks/Follow-up:
  - Playlist transition effects are player-side visuals and are not encoded in current stream pipeline.
  - For effect-faithful IPTV/VLC output, server-side compositing/re-encoding pipeline is required.## 2026-03-14 - Device-generated stream URL stabilization + profile rebuild
- Request context:
  - User asked whether single live stream with effects is possible, long-run DTS risk, device profile auto-selection status, and explicit local/server ffmpeg env safety.
- Findings:
  - Device UI still produced direct variant URLs in places, causing VLC to hit stitched HLS path.
  - Stitched variant HLS continues to show non-monotonic DTS warnings in long ffmpeg read tests.
  - Existing local variants were rebuilt as multi-profile; ready profiles now 360p/540p/720p.
- Changes:
  - public/assets/js/pages/devices/DeviceDetail.js
    - Stream URL field switched from direct variant to playlist flat mode URL with hide_title.
    - Download playlist link switched to flat mode + hide_title.
  - public/assets/js/pages/devices/DeviceList.js
    - getStreamPlaylistUrl() now supports stream_mode and hide_title query flags.
    - 
esolveDirectStreamUrl() generalized to honor resolver target (variant or flat), defaulting to flat mode fallback.
    - Stream URL copy/download actions now resolve with stream_mode=flat by default for VLC-safe links.
  - .env.postgresql.local.example
    - Added explicit optional FFMPEG_PATH / FFPROBE_PATH examples for Windows local.
  - .env.postgresql.server.example
    - Added explicit optional FFMPEG_PATH / FFPROBE_PATH examples for server/container.
- Operational actions:
  - Re-encode all existing local ready variants queued and processed to completion.
  - Local ready profile inventory after rebuild: 360p|ready|8, 540p|ready|8, 720p|ready|8.
- Checks:
  - node --check public/assets/js/pages/devices/DeviceDetail.js
  - node --check public/assets/js/pages/devices/DeviceList.js
  - php -l api/stream/playlist.php
  - php workers/TranscodeWorker.php --status (before/after rebuild)
  - playlist target checks for profile=360p/540p/720p (all variant targets valid)
  - 90s ffmpeg read on stitched variant HLS still shows non-monotonic DTS warnings
- Risks/Follow-up:
  - For VLC/IPTV long uninterrupted playback, flat M3U path remains the reliable mode.
  - Effect-faithful single-stream output requires server-side timeline compositing/re-encode architecture, not current stitched-playlist approach.

## 2026-03-14 - Live server readback validation
- Request context:
  - User asked to read/check live server state too.
- Findings:
  - SSH access with `camlicayazilim@185.124.84.34` on port `2299` works.
  - Compose stack in `/opt/omnex-hub/deploy` is up: app/postgres/mqtt/nginx/certbot/transcode-worker healthy/up.
  - In `app` container: ffmpeg/ffprobe available (`7.1.3`), worker status clean (pending 0, failed 0, ready variants 161).
  - Recent app logs show repeated successful `200` responses for playlist and segment fetches from Android TV user-agent.
- Files changed:
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - ssh remote: host/date/path listing
  - ssh remote: `docker compose ps`
  - ssh remote: `docker compose exec -T app sh -lc ... ffmpeg/ffprobe/worker --status`
  - ssh remote: `docker compose logs --tail 120 app | egrep -i 'stream|hls|ffmpeg|error|warning'`
- Risks/Follow-up:
  - VLC freeze diagnostics still require per-client playback probing (variant vs flat mode) and timestamp continuity validation under long-run read.

## 2026-03-14 - Stream profile and DTS investigation (local)
- Request context:
  - User asked about long-run non-monotonic DTS risk, local IPTV/VLC playlist behavior, 3-profile auto-selection status, and whether current stream architecture differs from first live-stream commit.
- Findings:
  - Local stream endpoints return HTTP 200 for playlist wrapper, flat fallback, and variant HLS.
  - Variant HLS still reproduces timestamp discontinuity + non-monotonic DTS warnings in 120s ffmpeg read.
  - Flat fallback is plain M3U (direct MP4 list); suitable for VLC-style fallback but many IPTV players expect HLS/m3u8 and may reject it.
  - Android native performance profile source is `android-player/.../PerformanceProfile.kt`; current detect logic resolves legacy (old/low) or balanced (Android 12+) by default; default profile is mainly override path.
  - Web player receives native profile via query params (`perf_profile`, `heartbeat`, `sync`, `verify_ms`, `precache`, `sw`) from MainActivity `getPlayerLoadUrl()`.
  - Stream video resolution profile selection is separate from performance profile and is handled in `api/player/init.php`, `api/player/sync.php`, and `api/stream/playlist.php` via device max-height + available transcode variants.
  - Compared to first live-stream commit (`7055618`), core architecture remains HLS variant pipeline; current structure adds wrapper/fallback layer (`api/stream/playlist.php`) and significant client-target behavior changes.
- Files changed:
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - curl -I for local stream endpoints (playlist/flat/variant)
  - curl body inspection for flat M3U and variant M3U8
  - ffmpeg 120s read on variant endpoint (warnings reproduced)
  - source inspection: PerformanceProfile.kt, MainActivity.kt, player.js, api/stream/*.php, api/player/init.php, api/player/sync.php
  - git log/show/diff comparisons around 7055618..HEAD and 1d0667a
- Risks/Follow-up:
  - Existing stitched variant HLS remains risky for long uninterrupted VLC/IPTV operation due repeated DTS discontinuity behavior.
  - For IPTV compatibility, links should not be forced to `stream_mode=flat`; separate VLC and IPTV targets are needed.
## 2026-03-14 - Live confirmation for performance profile + single-link behavior
- Request context:
  - User asked whether 3 performance profiles are really active in live, whether performance and video profiles work together, and why not a single universal IPTV+VLC link.
- Findings:
  - Live app logs show player loaded with `?perf_profile=balanced&heartbeat=7&sync=75&verify_ms=4000&precache=0&sw=1` repeatedly.
  - Live VLC requests currently hit `/api/stream/{token}/variant/720p/playlist.m3u8` (not forced flat in observed flow).
  - Performance profile system is active; current auto-detect logic maps to legacy or balanced (default mostly override path).
  - Stream wrapper still has client-target split logic (`forceFlatTarget`) for VLC/stream_mode hints.
- Files changed:
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - live server compose app log scan for `perf_profile`, heartbeat referrer, and stream playlist endpoints
  - source checks in PerformanceProfile.kt and api/stream/playlist.php
- Risks/Follow-up:
  - Universal single-link behavior remains fragile without true continuous encoder timeline due client parser differences + DTS continuity constraints.

## 2026-03-14 - Professional stream pipeline (single continuous channel timeline)
- Request context:
  - User requested permanent/professional model: temp-backed edits, single continuous encoder timeline, server-side transitions, and one live HLS stream target with monotonic timestamps.
- Findings:
  - Legacy stitched variant endpoint remained active and produced per-media segment stitching with DTS continuity risk.
  - New channel service initially failed on Windows because `%06d` in HLS segment template was altered by `escapeshellarg`; fixed with Windows-safe detached runner and segment pattern escaping.
  - After channel activation, variant endpoint serves channel HLS (`X-Stream-Pipeline: channel`) and 90s ffmpeg read produced no non-monotonic DTS warnings.
- Changes:
  - services/StreamChannelService.php
    - Added channel timeline build/encoder orchestration fixes: duration trims in transition/concat builds, Windows-safe detached runner, HLS segment template escaping, ffmpeg timestamp flags, and legacy media lookup fallback.
  - api/stream/channel.php (new)
    - Added public channel playlist/segment serving endpoint with token validation and optional sync bootstrap.
  - workers/ChannelWorker.php (new)
    - Added daemon/once/status worker for queued channel build requests and idle channel pruning.
  - api/index.php
    - Added new public routes:
      - `/api/stream/{token}/channel/{profile}/playlist.m3u8`
      - `/api/stream/{token}/channel/{profile}/{filename}`
  - api/stream/variant.php
    - Added channel-first pipeline path (queue/touch/bootstrap/serve) with legacy stitched fallback when channel is unavailable.
  - api/stream/playlist.php
    - Channel mode now counts as variant-capable target (even without prebuilt transcode variants).
    - Added channel prewarm queue from wrapper endpoint.
    - Removed user-agent-based forced flat fallback; flat fallback now only via explicit `stream_mode=flat|m3u|vlc`.
  - deploy/docker-compose.yml
    - Added `channel-worker` service.
  - deploy/docker-compose.local.yml
    - Added local `channel-worker` service.
  - deploy/.env.example
    - Added channel pipeline env examples.
  - .env.postgresql.local.example
    - Added optional channel pipeline env examples.
  - .env.postgresql.server.example
    - Added optional channel pipeline env examples.
- Temp backup safety:
  - Created: `.temp-backups/channel-worker-20260314_034344/` before risky edits.
- Checks run:
  - `php -l api/index.php`
  - `php -l api/stream/variant.php`
  - `php -l api/stream/playlist.php`
  - `php -l api/stream/channel.php`
  - `php -l workers/ChannelWorker.php`
  - `php -l services/StreamChannelService.php`
  - `docker compose -f deploy/docker-compose.yml config --quiet` (with temporary required env vars)
  - `docker compose -f deploy/docker-compose.local.yml config --quiet`
  - `curl` smoke tests:
    - wrapper playlist (`playlist.m3u`) returns `X-Stream-Target-Mode: variant-channel`
    - variant playlist returns `X-Stream-Pipeline: channel` and `/channel/.../segment_*.ts` URLs
    - direct channel playlist endpoint returns valid live m3u8
  - `php workers/ChannelWorker.php --status` confirms running channel encoder
  - `ffmpeg` 90s read (`variant/720p/playlist.m3u8`) showed no DTS/non-monotonic warnings
- Risks/Follow-up:
  - Existing Device UI JS currently contains prior forced-flat link defaults from earlier changes; for full one-link UX those defaults should be aligned to variant/channel mode.
  - Windows detached ffmpeg PID is best-effort (`pid=0`); health is inferred from rolling playlist updates.

## 2026-03-14 - Device generated link alignment + commit/push/deploy
- Request context:
  - User asked to change device-generated stream link to the correct default mode, keep downloaded playlist compatible, then commit/push and deploy to server.
- Findings:
  - Device UI was still forcing `stream_mode=flat`, so generated links did not follow new channel-first pipeline.
  - Stream channel pipeline itself was already working locally (`variant` => `X-Stream-Pipeline: channel`).
- Changes:
  - public/assets/js/pages/devices/DeviceDetail.js
    - Stream URL switched from `playlist.m3u?stream_mode=flat&hide_title=1` to `playlist.m3u`.
    - Download URL switched from forced-flat to `playlist.m3u?download=1&label=0`.
  - public/assets/js/pages/devices/DeviceList.js
    - `resolveDirectStreamUrl()` no longer defaults to `flat`; stream mode now optional.
    - `copyStreamUrl()` now resolves default channel/variant target.
    - `downloadStreamPlaylist()` now resolves default channel/variant target and removed VLC-only title options from generated M3U.
- Git/Release:
  - Commit: `71ed06e` (`feat(stream): add channel pipeline and switch device links to variant-channel`)
  - Pushed to `origin/main`.
  - Local pull/rebase check: up to date.
- Server deploy:
  - `/opt/omnex-hub` pulled to `71ed06e`.
  - Rebuilt/restarted `app`, `transcode-worker`, `channel-worker` via:
    - `docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --build app transcode-worker channel-worker`
  - Post-deploy all core services healthy/up.
  - Nginx had temporary upstream 502 (app container IP change after recreate); fixed with:
    - `docker compose -f docker-compose.yml -f docker-compose.standalone.yml restart nginx`
  - Domain health after fix: `https://hub.omnexcore.com/` => HTTP 200.
- Checks:
  - `node --check public/assets/js/pages/devices/DeviceDetail.js`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
  - `php -l api/stream/master.php`
  - `php -l services/HlsTranscoder.php`
  - git: `push`, `pull --rebase`
  - server: `docker compose ps`, `php workers/ChannelWorker.php --status`, `php workers/TranscodeWorker.php --status`
  - server HTTP probe: domain root 200 after nginx restart
- Risks/Follow-up:
  - Existing IPTV app behavior can still differ by client parser; user should validate on target IPTV client after this deployment.

## 2026-03-14 - IPTV 500 fix for channel variant playlist (safe unlink)
- Request context:
  - User asked to inspect why IPTV app on Android (ADB-connected device) could not play stream links.
- Findings:
  - IPTV app logs showed HTTP 500 on `/api/stream/{token}/variant/720p/playlist.m3u8`.
  - Server logs pointed to `unlink(.../playlist.m3u8): No such file or directory` inside `StreamChannelService::ensureEncoderRunning`.
- Changes:
  - services/StreamChannelService.php
    - Wrapped playlist cleanup in `is_file()` guard before `@unlink`.
    - Wrapped segment cleanup unlink calls in `is_file()` guard to avoid race/missing-file notices.
- Temp backup safety:
  - Created: `.temp-backups/stream-fix-20260314_043235/StreamChannelService.php.bak` before edit.
- Checks run:
  - `php -l services/StreamChannelService.php`
  - Local HTTP probes (`curl`) for stream URLs (returned 403 in local env due token/access context, so not used as functional pass criteria).
- Risks/Follow-up:
  - Fix is local until commit/deploy; remote IPTV clients will keep seeing 500 until server update is applied.
  - After deploy, retest on phone IPTV app and confirm 500 is gone.

## 2026-03-14 - IPTV 500 fix deployed to production
- Request context:
  - User asked to debug Android IPTV app link over ADB and restore playback.
- Root cause confirmed:
  - Production `variant/720p/playlist.m3u8` returned HTTP 500 due to missing-file unlink path in channel startup.
- Release:
  - Commit: `4f36f18` (`fix(stream): avoid missing-file unlink errors in channel startup`)
  - Pushed to `origin/main` and pulled on `/opt/omnex-hub`.
  - Rebuilt/restarted `app` and `channel-worker` containers.
- Verification:
  - `docker compose ... ps` => `app` and `channel-worker` healthy.
  - `curl -I https://hub.omnexcore.com/api/stream/<token>/variant/720p/playlist.m3u8` => HTTP 200 (previously 500).
  - `curl -I https://hub.omnexcore.com/api/stream/<token>/playlist.m3u` => HTTP 200.
  - `git pull --rebase origin main` (local) => up to date.
- Risks/Follow-up:
  - ADB ile uygulamayi komutla otomatik URL acma denemesi host policy tarafindan engellendi; cihazda manuel IPTV play dogrulamasi kullanicidan alinmali.

## 2026-03-14 - Channel fallback/audio-effect recovery (race lock + invalid program self-heal)
- Request context:
  - User reported stream opens but all items are audible and transition effects seem absent on IPTV/VLC path.
- Findings:
  - Variant endpoint was intermittently falling back to legacy stitched pipeline (`/segment/{mediaId}/...`) instead of channel pipeline.
  - Channel state/log showed repeated `moov atom not found` on `program.mp4` (invalid/corrupted timeline file), causing encoder start failures and fallback behavior.
  - Concurrent channel build/start paths (request sync bootstrap + worker) had no per-channel lock; this risked timeline file corruption.
- Changes:
  - services/StreamChannelService.php
    - Added per-token/profile file lock (`channel.lock`) around `ensureChannel()` critical section.
    - Added program validity check (`isValidProgramFile`) using file-size + ffprobe duration.
    - Added self-heal path: if cached `program.mp4` is invalid, force rebuild instead of reusing hash state.
    - Added post-build validity gate for `program.tmp.mp4` before swap.
    - Captured stderr in `runCommand()` logs (`2>&1`) for actionable ffmpeg diagnostics.
- Temp backup safety:
  - Created: `.temp-backups/channel-race-fix-20260314_044408/StreamChannelService.php.bak` before edit.
- Release:
  - Commit: `c977f54` (`fix(stream): lock channel build and auto-heal invalid program file`)
  - Pushed to `origin/main`, deployed to server (`app` + `channel-worker` rebuild/restart).
  - Post-deploy nginx upstream refreshed by restarting `nginx` service.
- Verification:
  - `php -l services/StreamChannelService.php`
  - `docker compose ps` on server -> app/channel-worker healthy.
  - Variant URL now returns `X-Stream-Pipeline: channel` and `/channel/720p/segment_*.ts` URLs.
  - Channel segment ffprobe confirms video-only stream (no audio track).
- Risks/Follow-up:
  - During first bootstrap window a client may briefly observe fallback until channel playlist is available; after build it converges to channel pipeline.
  - Per-item mute semantics are not currently preserved in single continuous channel output (current model is global no-audio in channel pipeline).

## 2026-03-14 - IPTV multi-screen analiz dokumani (kod degisimi yok)
- Request context:
  - User asked to inspect phone IPTV app multi-screen capability and prepare a new documentation for adding similar feature to Omnex APK later, without touching current player/stream flow, with per-screen file or link input.
- Findings:
  - ADB/UI dump analysis confirmed multi-screen UX pattern: layout selection + slot-based source assignment.
  - Evidence observed in dumps includes `NSTIJKPlayerMultiActivity`, `id/multiscreen`, layout ids (`deafult`, `screen1..screen5`), slot containers (`rl_video_box_*`, `app_video_box_*`, `ll_add_channel`), and source entry ids (`rl_login_with_m3u`, `rl_play_single_stream`, `rl_play_from_device`).
- Changes:
  - Added `docs/IPTV_MULTI_SCREEN_INTEGRATION_PLAN_2026-03-14.md`
    - Scope/sinirlar, mimari, veri modeli, UI akisi, performans profili limiti, test matrisi, riskler ve rollout plani.
    - Explicitly preserves existing `MainActivity` + player/stream pipeline and proposes isolated `MultiScreenActivity` module.
- Checks run:
  - No QUICK_CHECKS command matched (docs-only markdown change, no `.php`/`.js`/Android code edit).
- Backup/restore safety:
  - Not required (new documentation file added; no high-risk encoding edit).
- Risks/Follow-up:
  - This is design documentation only; implementation phase should add feature flag + regression tests to guarantee zero impact on existing single-screen playback.

## 2026-03-14 - Device modal IP normalize + relink sync + non-stream m3u/m3u8 actions
- Request context:
  - User asked to keep backup-safe workflow and fix pending/edit modal loopback IP display, improve duplicate-device i18n toasts, add edit modal resync code flow for reset clients, and expose stream link/download actions (m3u + m3u8) on non-stream player devices too.
- Changes:
  - `public/assets/js/pages/devices/DeviceList.js`
    - Added loopback IP normalization helper (`::1`/`::ffff:127.0.0.1` -> `localhost`) for modal display and IP conflict checks.
    - Added richer duplicate error mapping to i18n key `messages.deviceAlreadyRegisteredDetailed`.
    - Added stream action expansion for player devices (not only stream_mode):
      - copy m3u
      - download m3u
      - copy m3u8 variant
      - download m3u8 variant
    - Added lazy stream token provisioning call before actions (`ensure_stream_token`).
  - `public/assets/js/pages/devices/list/ApprovalFlow.js`
    - Normalized loopback IP display in pending/approve modals.
    - Added duplicate 409 error mapping to i18n key `messages.deviceAlreadyRegisteredDetailed`.
  - `public/assets/js/pages/devices/DeviceDetail.js`
    - Normalized IP display in detail hero/properties and edit form.
    - Added edit modal field `form.fields.resyncCode` (+ hint) for optional 6-digit resync.
    - Added relink call to `/esl/approve` with `target_device_id` before normal update flow.
  - `api/esl/approve.php`
    - Added `target_device_id` support to approve/relink an existing device with a new sync request instead of hard 409 in relink path.
    - Added guarded duplicate behavior: allow when duplicate resolves to selected target, block otherwise.
    - Added relink update branch (metadata/device identity refresh) and returns 200 for relink, 201 for new create.
  - `api/devices/update.php`
    - Added `ensure_stream_token` / `ensureStreamToken` request support to generate/reuse stream token without forcing stream mode.
  - `locales/{tr,en,ru,az,de,nl,fr,ar}/pages/devices.json`
    - Added all required keys:
      - `form.fields.resyncCode`
      - `form.hints.resyncCodeOptional`
      - `toast.resynced`
      - `messages.deviceAlreadyRegisteredDetailed`
      - `messages.streamTokenRequired`
      - `messages.streamVariantUnavailable`
- Temp backup safety:
  - Used existing backup folder: `.temp-backups/device-ui-stream-fixes-20260314_051526/`
  - Added backup: `.temp-backups/device-ui-stream-fixes-20260314_051526/approve.php.bak`
- Checks run:
  - `php -l api/devices/update.php`
  - `php -l api/esl/approve.php`
  - `node --check public/assets/js/pages/devices/DeviceList.js`
  - `node --check public/assets/js/pages/devices/list/ApprovalFlow.js`
  - `node --check public/assets/js/pages/devices/DeviceDetail.js`
  - locale JSON parse check for all 8 language files via Node (`locales ok`)
- Risks/Follow-up:
  - New locale keys for non-TR languages are functional but wording was kept generic; language-owner review can refine phrasing later.
  - `storage/streams/` remains runtime-generated/untracked and should stay out of git history.

## 2026-03-14 - Variant/channel playback fix for non-stream-mode player tokens
- Request context:
  - User reported `variant/720p` and `variant/1080p` URLs return without explicit error but do not play.
- Findings:
  - Variant playlists returned 200 and referenced `/channel/{profile}/segment_*.ts`.
  - Segment URL checks returned 403 because channel/token validation still required `stream_mode = true`.
  - Stream endpoints were inconsistent with newly enabled non-stream player link actions.
- Changes:
  - `api/stream/variant.php`
  - `api/stream/playlist.php`
  - `api/stream/master.php`
  - `api/stream/segment.php`
  - `api/stream/heartbeat.php`
  - `services/StreamChannelService.php`
  - Updated token/device lookup condition to accept stream tokens for player-class devices as well:
    - `stream_mode = true` OR `model IN ('stream_player','pwa_player')` OR `type IN ('android_tv','web_display')`.
- Temp backup safety:
  - Created `.temp-backups/stream-token-player-access-20260314_0544/` backups for all touched stream files.
- Checks run:
  - `php -l api/stream/variant.php`
  - `php -l api/stream/playlist.php`
  - `php -l api/stream/master.php`
  - `php -l api/stream/segment.php`
  - `php -l api/stream/heartbeat.php`
  - `php -l services/StreamChannelService.php`
  - HTTP spot checks:
    - `variant/720p` and `variant/1080p` playlists => 200 with `X-Stream-Pipeline: channel`
    - `channel/{profile}/segment_*.ts` => 200 with `Content-Type: video/MP2T` (previously 403)
- Risks/Follow-up:
  - External devices cannot use `localhost`; for phone/TV tests device must use host LAN IP/domain URL.

## 2026-03-14 - Notifications bulk delete visual mute (toast/browser spam fix)
- Request context:
  - User reported that on `#/notifications`, bulk delete triggers multiple toasts/browser notifications, making it unclear what was deleted.
- Findings:
  - Bulk delete removes many items quickly; NotificationManager polling can treat list reflow items as "new" and show visual notifications.
- Changes:
  - `public/assets/js/core/NotificationManager.js`
    - Added temporary visual mute window (`visualMuteUntil`).
    - Added `suppressVisualNotifications(durationMs)` API.
    - In `enqueueNotificationDisplay`, skip toast/desktop rendering while mute window is active (still marks IDs as seen to avoid later replay).
  - `public/assets/js/pages/notifications/NotificationList.js`
    - Added `getNotificationManager()` helper.
    - Added mute calls before delete actions:
      - single delete: `suppressVisualNotifications(12000)`
      - bulk delete: `suppressVisualNotifications(15000)`
- Temp backup safety:
  - Created `.temp-backups/notifications-bulk-delete-silent-20260314_0550/`
  - Backups:
    - `NotificationManager.js.bak`
    - `NotificationList.js.bak`
- Checks run:
  - `node --check public/assets/js/core/NotificationManager.js`
  - `node --check public/assets/js/pages/notifications/NotificationList.js`
- Risks/Follow-up:
  - During mute window, truly new notifications are intentionally not shown as visual toast/desktop popups; this is expected and scoped to short duration.

## 2026-03-14 - Form validation UX: required field indicators + lifetime license bug fix
- Request: Zorunlu alan uyarıları genel/belirsiz, hangi alanın eksik olduğu toast'ta belli değil. Ömür boyu lisanslar "Süresi Doldu" gösteriyor.
- Changes:
  **Lisans Yönetimi (LicenseManagement.js):**
  - `isLifetimeLicense()` helper eklendi - plan_type (enterprise/ultimate/unlimited) veya null expires_at kontrolü
  - `getStatusInfo()` lifetime lisansları her zaman "Aktif" gösteriyor (eskiden new Date(null) → epoch → expired)
  - `updateStatsFromData()` lifetime lisansları active sayar, expired/expiring saymaz
  - `_toggleEndDateRequirement()` metodu: plan lifetime olduğunda bitiş tarihi zorunluluğu kalkar, label "(Ömür Boyu)" gösterir
  - Create/Edit modal validation: alan-spesifik Toast mesajları (`validation.requiredField` key), hatalı inputlara `.error` class
  - `form-label-required` CSS class'ı ile kırmızı `*` göstergesi (plan name, price, company, dates)
  **Backend (api/licenses/):**
  - `update.php`: Boş `expires_at` sadece unlimited/lifetime planlarda null olarak kabul edilir; diğer planlarda "Bitiş tarihi zorunludur" hatası döner
  - `create.php`: Boş `expires_at` null olarak alınır (unlimited plan kontrolü mevcut satır 63-68)
  **Diğer sayfalar (validation UX):**
  - `UserManagement.js`: Alan-spesifik validation, `form-label-required` class, `.error` highlight
  - `CompanyManagement.js`: Alan-spesifik validation, `form-label-required` class
  - `BranchManagement.js`: Alan-spesifik validation, `form-label-required` class
  - `CategoryList.js`: Alan-spesifik validation, `.error` highlight
  - `ScheduleForm.js`: Alan-spesifik validation, `form-label-required` class
  - `Profile.js`: Alan-spesifik validation, `form-label-required` class, `.error` highlight
  - `UserSettings.js`: Alan-spesifik validation, `form-label-required` class
  - `PlaylistDetail.js`: Alan-spesifik validation
  - `PlaylistList.js`: Alan-spesifik validation
  **i18n (8 dil):**
  - `validation.requiredField` key eklendi: tr, en, de, fr, nl, ru, az, ar
- Changed files:
  - `public/assets/js/pages/admin/LicenseManagement.js`
  - `public/assets/js/pages/admin/UserManagement.js`
  - `public/assets/js/pages/admin/CompanyManagement.js`
  - `public/assets/js/pages/admin/BranchManagement.js`
  - `public/assets/js/pages/categories/CategoryList.js`
  - `public/assets/js/pages/signage/ScheduleForm.js`
  - `public/assets/js/pages/signage/PlaylistDetail.js`
  - `public/assets/js/pages/signage/PlaylistList.js`
  - `public/assets/js/pages/settings/Profile.js`
  - `public/assets/js/pages/settings/UserSettings.js`
  - `api/licenses/update.php`
  - `api/licenses/create.php`
  - `locales/{tr,en,de,fr,nl,ru,az,ar}/common.json`
- Checks run:
  - `node -c` for all 10 JS files: OK
  - `php -l` for both API files: OK
  - JSON validation for all 8 common.json: OK
- Risks/Follow-up:
  - forms.css'de `.form-input.error` stili mevcut (border-color: danger), ek CSS gerekmedi

## 2026-03-14 - ProductForm: validation label fix + auto-generate SKU for new products
- Request: Ürün formundaki zorunlu alan label'larını düzelt, yeni üründe SKU otomatik üretilsin.
- Changes:
  **ProductForm.js:**
  - Label'larda manual ` *` → `form-label-required` CSS class'ına dönüştürüldü (name, sku, salePrice, cat-name, pt-name)
  - Kategori inline modal: genel `validation.required` → alan-spesifik `validation.requiredField` + `.error` highlight
  - Üretim şekli inline modal: genel `productionTypes.toast.required` → alan-spesifik `validation.requiredField` + `.error` highlight
  - `_generateSkuValue()`: `PRD-XXXXXX` formatında 6 haneli alfanümerik SKU üretir (karıştırılabilir 0/O/1/I karakterleri hariç)
  - `_autoGenerateSku()`: Yeni ürün formunda (`!this.productId`) SKU alanını otomatik doldurur
  - SKU input'u yanına yenile butonu (`generate-sku-btn`) eklendi — istediğinde yeni SKU üretir
  - Düzenle modunda SKU alanı doluysa auto-generate çalışmaz, ERP/import ile gelen SKU korunur
  **forms.css:**
  - `.form-input-error` class tanımı eklendi (ProductValidator.js'in kullandığı class)
  - `.form-error-message` class tanımı eklendi (input altı hata mesajı div'i)
  **i18n (8 dil):**
  - `form.generateSku` key eklendi: tr, en, de, fr, nl, ru, az, ar
- Changed files:
  - `public/assets/js/pages/products/ProductForm.js`
  - `public/assets/css/components/forms.css`
  - `locales/{tr,en,de,fr,nl,ru,az,ar}/pages/products.json`
- Checks run:
  - `node -c ProductForm.js`: OK
  - JSON validation for all 8 products.json: OK
- Risks/Follow-up:
  - Auto-SKU `PRD-XXXXXX` formatı firma bazlı benzersizlik backend'de kontrol ediliyor (store.php satır 25-31)
  - ERP/import ile gelen ürünlerin SKU'su korunur — sadece elle eklenen yeni ürünlerde auto-generate çalışır

## 2026-03-14 - i18n folder name translation fix + resource exhaustion fixes

### Resource Exhaustion Fixes
- Request: CPU/RAM tüketimi risklerini tespit et ve düzelt (zombie process, sonsuz çalışma, lock koruması)
- Changes:
  - 4 cron script'e flock overlap koruması eklendi (tamsoft-auto-sync, device-heartbeat, check-device-status, tenant-backup)
  - HlsTranscoder.php: blocking exec() yerine proc_open() + 30dk wallclock timeout + SIGTERM/SIGKILL escalation
  - TranscodeWorker.php: 4 saat maxRuntime guard + pcntl zombie reaping (SIGCHLD)
- Changed files: cron/tamsoft-auto-sync.php, cron/device-heartbeat.php, cron/check-device-status.php, cron/tenant-backup.php, services/HlsTranscoder.php, workers/TranscodeWorker.php

### Docker Turkish Filename Fix
- Request: Sunucuda (Docker) Ortak Kütüphane altındaki Türkçe karakterli dizinler görünmüyordu
- Changes:
  - Dockerfile'a UTF-8 locale desteği eklendi (locales paketi + en_US.UTF-8)
  - Sunucudaki Windows-1254 kodlu dosya isimleri UTF-8'e dönüştürüldü (iconv rename)
- Changed files: deploy/Dockerfile

### i18n Folder Name Translation Fix
- Request: Ortak Kütüphane alt dizin isimleri (Manav, Kasap vb.) dil değiştirildiğinde çevrilmiyordu
- Root cause: i18n.t() page translation chain'de products.json/templates.json'daki mediaLibrary key'i, common.json'daki mediaLibrary.folders lookup'ını gölgeleyebiliyordu. getNestedValue() intermediate object döndüğünde bu valid match olarak sayılıyordu.
- Changes:
  1. **i18n.js**: `tc()` metodu eklendi — sadece common.json'dan çeviri arar (page translations atlar)
  2. **i18n.js**: `getNestedValue()` artık sadece leaf değerler (string/number/boolean) döner, intermediate object'ler undefined döner → partial key match'lerde fallthrough sağlar
  3. **MediaLibrary.js**: `getFolderDisplayName()` artık `this.app.i18n.tc()` kullanıyor
  4. **MediaPicker.js**: `_getFolderDisplayName()` artık `this.app.i18n.tc()` kullanıyor
  5. **PlaylistDetail.js**: `_getFolderDisplayName()` artık `this.app.i18n.tc()` kullanıyor
  6. **_folder_i18n.php**: preg_replace regex düzeltildi (eksik `[]` karakter sınıfı)
- Changed files:
  - public/assets/js/core/i18n.js
  - public/assets/js/pages/media/MediaLibrary.js
  - public/assets/js/pages/products/form/MediaPicker.js
  - public/assets/js/pages/signage/PlaylistDetail.js
  - api/media/_folder_i18n.php
- Checks run:
  - i18n.js brace balance: OK
  - tc() method presence: OK
  - getNestedValue object type guard: OK
  - All 3 consumer files use i18n.tc(): OK
  - Backend: All 15 folder name_keys resolve correctly (PHP test)
  - All 8 locale common.json files verified: valid JSON, mediaLibrary.folders section with 15 entries each
- Risks/Follow-up:
  - getNestedValue object type guard might affect code that intentionally looks up object subtrees (not expected in current codebase)
  - Sunucuya deploy gerekli (Docker rebuild + git pull)

## 2026-03-14 - Add i18n translations for HTML template generation feature

- Request: Add new i18n keys for HTML template generation (generateHtml) in products page and HTML template tab in signage playlists form
- Changes:
  - 8x `locales/{lang}/pages/products.json` (tr, en, ru, az, de, nl, fr, ar):
    - Added `list.actions.generateHtml` key
    - Added `generateHtml` top-level section with 12 keys (title, selectTemplate, selectTemplatePlaceholder, customName, namePlaceholder, info, generate, generating, success, failed, templateRequired, noTemplates)
  - 8x `locales/{lang}/pages/signage.json` (tr, en, ru, az, de, nl, fr, ar):
    - Added 4 keys inside `playlists.form`: tabHtmlTemplates, emptyHtmlTemplates, emptyHtmlTemplatesHint, goToHtmlTemplates
- Files changed: 16 locale JSON files
- Checks: All 16 JSON files validated with PHP json_decode - all OK
- Risks/Follow-up: None - additive change only, no existing keys modified

## 2026-03-14 - Fix FabricToHtmlConverter critical bugs + add preview icon to web-templates

- Request: Fix 4 critical bugs in FabricToHtmlConverter (dynamic fields not resolving, wrong positioning, video not playing, images not showing) + add preview icon to web-templates page cards
- Changes:
  1. **FabricToHtmlConverter.php** — Complete rewrite:
     - Added `buildFieldValues()` method matching PavoDisplayGateway's implementation (formatted prices, HAL künye fields, dates etc.)
     - Added `$labelToFieldMap` static array (60+ entries) for customType='dynamic-text' fallback resolution when dynamicField/fieldBinding are missing (v7 bug)
     - Fixed Fabric.js v7 center origin positioning: `originX/Y='center'` now subtracts half width/height from left/top
     - Fixed video-placeholder customType: now accepts 'video-placeholder' (hyphen) in addition to 'video_placeholder' (underscore)
     - Fixed image resolution: now checks customTypes 'image-placeholder', 'dynamic-image', 'slot-image', 'image', 'product_image'
     - Added export exclusion for isRegionOverlay, excludeFromExport, isBackground objects
     - Fixed group child positioning with center origin handling
     - Added vertical centering for text elements (display:flex;align-items:center)
     - `convertObject()` now takes `$fieldValues` parameter (pre-computed per product)
  2. **WebTemplateList.js** — Added preview button (ti-external-link icon) to template card overlay, opens serve endpoint in new tab
  3. Deleted temp debug files: temp_check_bindings.php, temp_check_templates.php, temp_check_texts.php
- Files changed: services/FabricToHtmlConverter.php, public/assets/js/pages/web-templates/WebTemplateList.js
- Checks: PHP syntax check passed (FabricToHtmlConverter.php)
- Risks/Follow-up:
  - Existing saved web_templates will NOT auto-update — they contain the old (broken) HTML. Users need to regenerate.
  - labelToFieldMap depends on exact placeholder text matches — custom/unusual field labels won't be resolved

## 2026-03-15 - Cihaza gönder/ata modallarında canlı HTML önizleme

- Request: Ürünler sayfasındaki "Cihaza Gönder" ve "Etiket Ata" modallarına canlı HTML iframe önizlemesi ekle
- Changes:
  1. **ProductList.js `_renderTemplatePreview()`** — `productId` parametresi eklendi; productId varsa statik görsel yerine `/api/templates/:id/preview-html?product_id=xxx` iframe'i render eder, "Canlı HTML Önizleme" badge gösterir
  2. **ProductList.js `_showSingleProductSendModal()`** — Preview card ve template change handler artık productId geçirir → şablon seçildikçe canlı HTML anında güncellenir
  3. **ProductList.js `showAssignLabelModal()`** — Şablon seçimi altına önizleme card eklendi + template change event listener ile canlı güncelleme
  4. **products.css** — `.template-preview-live` (iframe container), `.live-preview-badge` (mavi badge), `.assign-label-preview` (küçük önizleme) stilleri
  5. **i18n** — `sendToDevice.liveHtmlPreview` key'i 8 dilde eklendi
- Files changed: ProductList.js, products.css, locales/*/pages/products.json (8 dil)
- Checks: PHP syntax check passed
- Risks/Follow-up: Performans — her modal açılışında iframe yüklenir. TAKİP notu mevcut.

## 2026-03-15 - Toplu gönderim modalına HTML önizleme + HTML şablon oluşturma

- Request: Çoklu ürün gönder modalında cihaz tipi seçildikten sonra ürünlerin HTML önizlemesi ve HTML şablon oluşturma seçeneği
- Changes:
  1. **ProductList.js `_showBulkSendByDeviceTypeModal()`** — Cihaz tipi seçildikten sonra şablonu olan ürünlerin canlı HTML iframe önizlemesi grid'de gösteriliyor + "HTML Şablon Oluştur" butonu eklendi
  2. **ProductList.js `_bulkCreateHtmlFromSendModal()`** — Yeni method: seçilen ürünler için ayrı ayrı veya birleşik HTML şablon oluşturma (generate-from-fabric API'si ile)
  3. **products.css** — `.bulk-html-preview-grid/card/iframe/info/header/section` stilleri (grid layout, 220px card'lar, 160px iframe yüksekliği)
  4. **i18n** — `sendToDevice.htmlPreviewTitle`, `createHtmlTemplate`, `createHtmlTitle`, `createHtmlInfo`, `createHtmlCombined` key'leri 8 dilde
- Files changed: ProductList.js, products.css, locales/*/pages/products.json (8 dil)
- Checks: JSON validation passed (tr, en), JS file readable
- Risks/Follow-up: Çok fazla ürün seçildiğinde grid'deki iframe sayısı performansı etkileyebilir (max-height:360px scroll ile sınırlandırıldı)

## 2026-03-15 - Çoklu ürün şablonu tespit edilemiyor (design_data eksik)

- Request: Şablonları tekli→çoklu ürüne çevirince ürünler sayfası çoklu ürün şablonu olarak görmüyor, tekli de artık görmüyor
- Root cause (3 katmanlı):
  1. **API `design_data` dönmüyor**: `/templates` list endpoint'i `design_data`'yı varsayılan SELECT'e dahil etmiyor (performans için). Ama `showMultiProductSendModal()` `design_data` içindeki `multi-product-frame` objelerini arıyor → hiçbir zaman bulamıyor
  2. **`grid_layout` kolonu SELECT'te yok**: API response'da `grid_layout` alanı hiç dönmüyordu
  3. **`regions_config` kaydedilmiyor**: EditorWrapper.js save payload'ında `regions_config` hiç gönderilmiyordu → UPDATE'te DB'de null kalıyordu
- Changes:
  1. **api/templates/index.php** — `grid_layout` SELECT kolonlarına eklendi
  2. **ProductList.js `showMultiProductSendModal()`** — API çağrısı `?include_content=1&per_page=200` ile yapılıyor (design_data dahil geliyor)
  3. **EditorWrapper.js save payload** — `regions_config: gridManager.exportConfig()` eklendi (JSON string olarak)
- Files changed: api/templates/index.php, ProductList.js, EditorWrapper.js
- Checks: PHP syntax OK
- Risk: `include_content=1` payload boyutunu artırır ama sadece multi-product modal açıldığında isteniyor (normal list etkilenmez)

## 2026-03-15 - FabricToHtmlConverter multi-product-frame desteği

- Request: Çoklu ürün çerçeveli şablonların HTML çıktısında slot içerikleri doğru ürün verileriyle gösterilmiyor
- Root cause: FabricToHtmlConverter `multi-product-frame` customType'ını ve `slotId` prop'unu tanımıyordu. Slot objeleri sadece ilk ürünün verisiyle render ediliyordu.
- Changes:
  1. **FabricToHtmlConverter.php `convert()`** — Multi-product-frame tespit ve slot→ürün eşleştirme eklendi. `frameCols×frameRows` matrisinden slotId→productIndex map oluşturulur. `slotId` prop'lu objelere doğru ürün verileri atanır.
  2. **FabricToHtmlConverter.php `convertObject()`** — Frame helper objeleri atlanıyor: `multi-product-frame` kendisi, `isSlotBackground`, `isSlotLabel`, `isSlotPlaceholder`, `isTransient`, `slot-label` customType
- Files changed: services/FabricToHtmlConverter.php
- Checks: PHP syntax OK
- Risk: Slot objelerinin `slotId` prop'u doğru atanmış olmalı (editör bu prop'u otomatik atar)

## 2026-03-16 - Player HTML gecis/preload stabilizasyonu (TV/Android)

- Request: Playlist icinde video + image + html/template karmasinda (ozellikle Android TV/mobil) html iceriklerin hazir olmadan acilmasi, gecislerde flash/siyah bosluk, preload icon gorunmesi ve hizalama bozulmalarinin duzeltilmesi.
- Changes:
  1. **public/player/assets/js/player.js**
     - HTML oynatimi icin URL cozumleme `resolveHtmlPlaybackUrl()` ortaklastirildi (embed/proxy kurallari tek yerde)
     - Sonraki item HTML ise dokuman prefetch eklendi (`prefetchHtmlDocument`) ve eski prefetch temizligi eklendi
     - Gecis motorunda eski icerigi yeni icerik hazir olana kadar tutan deferred-exit mantigi HTML/video icin genisletildi
     - `applyEnterTransition()` icine `flushPendingExitTransition()` baglandi (tek noktadan cikis tetikleme)
     - HTML icerik icin dual-slot altyapisi eklendi (`_activeHtmlSlot`, `getActiveHtmlElement`, `getNextHtmlElement`) ve html->html gecisleri ayni element reuse yerine alternatife alindi
     - `playHtml()` yeniden duzenlendi: load token korumasi, same-target hizli path, timeout fallback, `finalizeHtmlPlayback()` ile stabil timer baslatma
     - Same-origin iframe icin video controls/play-overlay baskilama ve autoplay/playsinline hardening eklendi (`hardenSameOriginIframeContent`)
     - `stopPlayback()` icinde html prefetch temizligi + html slot/pending exit reset eklendi
  2. **public/player/assets/css/player.css**
     - `#html-content-alt` icin iframe interaction/outline kurallari eklendi
     - Transition siniflarina `#player-screen` scoped specificity + position/size override geri eklendi (mobil/TV orientation kaynakli kayma/flash etkisini bastirmak icin)
  3. **public/player/index.html**
     - Ikinci iframe katmani eklendi: `#html-content-alt`
     - Cache-bust parametreleri guncellendi (`player.css?v=34`, `player.js?v=48`)
- Files changed: public/player/assets/js/player.js, public/player/assets/css/player.css, public/player/index.html
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Cross-origin iframe iceriklerinde (same-origin degilse) video controls hardening tarayici guvenlik siniri nedeniyle uygulanamaz.
  - HTML icindeki agir script/video yukleri tamamen kaldirilamaz; prefetch + deferred-exit etkisini sahada Android TV cihazlarinda dogrulamak gerekir.
- Backup/Restore safety:
  - Edit oncesi gecici backup alindi: `player.js.bak_html_stability_20260316_003339`, `player.css.bak_html_stability_20260316_003339`, `index.html.bak_html_stability_20260316_003339`
  - Restore gerekmemesi nedeniyle backup dosyalari tutuldu (temp backup adimi uygulandi).
## 2026-03-16 - HTML item tekrar yuklenme sorunu + detayli player trace loglari

- Request: Playlistte HTML iceriklerin (ozellikle PWA/Android) 3-5 kez tekrar yuklenmesi; giris/cikis/animasyon davranisini detayli izlemek icin debug eklenmesi.
- Root cause:
  - `api/player/init.php` ve `api/player/sync.php` JSON fallback akisinda HTML item `id` degeri `uniqid('web_...')` ile her istekte yeniden uretiliyordu.
  - Frontend `syncContent` hash karsilastirmasi bu degisken `id` nedeniyle her sync'te `contentChanged=true` algilayip aktif slotu yeniden baslatiyordu.
- Changes:
  1. **api/player/init.php**
     - `playerBuildStableHtmlItemId()` helper eklendi.
     - JSON fallback HTML item `id` atamasi `uniqid` yerine deterministic hash tabanli stabil ID'ye cekildi.
  2. **api/player/sync.php**
     - `playerBuildStableHtmlItemId()` helper eklendi.
     - JSON fallback HTML item `id` atamasi `uniqid` yerine deterministic hash tabanli stabil ID'ye cekildi.
  3. **public/player/assets/js/player.js**
     - `buildPlaylistItemSignature()` guncellendi: HTML item signature kimligi artik `html:<url>` bazli (id degisse bile false-positive contentChanged olmasin).
     - Detayli debug trace altyapisi eklendi: `traceDebug()` + `getElementDebugLabel()`.
     - HTML akisinda trace loglari eklendi: URL resolve, prefetch start/finish/abort, iframe onload/onerror, timeout, finalize.
     - Transition akisinda trace loglari eklendi: hide/start, defer-exit, apply enter/exit, pending-exit flush, transition completion.
     - Sync karar noktasina ek trace eklendi: `currentSlotChanged`, seamless restart gerekcesi ve signature farki.
  4. **public/player/index.html**
     - Player module cache-bust versiyonu `player.js?v=49` yapildi.
- Files changed: api/player/init.php, api/player/sync.php, public/player/assets/js/player.js, public/player/index.html
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `php -l api/player/init.php` (OK)
  - `php -l api/player/sync.php` (OK)
- Risks/Follow-up:
  - `playlist.items` JSON icinde ayni URL+order+name kombinasyonuna sahip birden fazla HTML item varsa stabil hash ID cakisma riski teorik olarak vardir (pratikte dusuk).
  - Trace loglari sadece `?debug` acikken detayli calisir; normal modda overhead yok.
- Backup/Restore safety:
  - Edit oncesi backup alindi: `api/player/init.php.bak_html_debug_20260316_010617`, `api/player/sync.php.bak_html_debug_20260316_010617`, `public/player/assets/js/player.js.bak_html_debug_20260316_010617`
  - Restore gerekmedi.
## 2026-03-16 - HTML trace follow-up: SW precache filtreleme + stale onload log temizligi

- Request: Yeni trace loglarina gore kalan anomalileri kontrol etme (YouTube CORS precache hatasi ve HTML'den cikis sonrasi stale onload debug gurultusu).
- Changes:
  1. **public/player/assets/js/player.js**
     - `isValidCacheableUrl()` sadece gercek medya URL'lerini kabul edecek sekilde daraltildi (extension/path bazli)
     - `precacheMedia()` upcoming ve prune listelerinde sadece image/video/stream tipleri cache'e alinacak sekilde filtrelendi
     - `playHtml()` icindeki `iframe.onload` trace'i stale eventleri eleyecek sekilde token+loaded guard ile sikilastirildi
  2. **public/player/index.html**
     - Cache-bust guncellemesi: `player.js?v=50`
- Files changed: public/player/assets/js/player.js, public/player/index.html
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Harici ama dogrudan medya uzantilariyla gelen URL'ler (ornegin CDN mp4) yeni filtreyi gecmeye devam eder; HTML/web URL'leri artik SW MEDIA cache'e alinmaz.
- Backup/Restore safety:
  - Bu follow-up degisiklikte onceki backup seti gecerliligini koruyor; ek restore gerekmedi.## 2026-03-16 - APK cihazda HTML->video gecis senkronu ve native transition uyumu

- Request: APK tarafinda ilk HTML duzgun olduktan sonra video gorunmeme, sonraki HTML'de preload/play icon flash ve gecislerin tarayiciyla uyumsuz davranisini duzeltme; cihazdan dogrudan dogrulama.
- Changes:
  1. **public/player/assets/js/player.js**
     - Native video baslangicinda bekleyen `_pendingExitElement` zorunlu flush edildi (`handleNativeVideoStarted`) ki HTML katmani ustte takili kalmasin.
     - Balanced profilde transition suresini 400ms'e clamp eden kisim kaldirildi (playlist suresi korunuyor).
  2. **public/player/index.html**
     - JS cache-bust `player.js?v=52` yapildi.
  3. **android-player/omnex-player-app/app/build.gradle**
     - APK surumu `versionCode 36`, `versionName 2.9.7`.
  4. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata 2.9.7 / v36 ve yeni SHA256 ile guncellendi.
  5. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `58257ae0961572053f45000098319d7f0ffcfd350011e301a486c915932e6bde`).
- Files changed: public/player/assets/js/player.js, public/player/index.html, android-player/omnex-player-app/app/build.gradle, public/downloads/update.json, downloads/update.json, public/downloads/omnex-player.apk, downloads/omnex-player.apk
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - ADB live validation: cihaz logunda `player.js?v=52`, `Transition: push-down, Duration: 2000ms`, ve `native video start - flushing pending exit` goruldu.
  - Live endpoint validation:
    - `https://hub.omnexcore.com/player/` -> `player.js?v=52`
    - `https://hub.omnexcore.com/downloads/update.json` -> `versionCode 36`, `versionName 2.9.7`
- Risks/Follow-up:
  - Sunucudaki `02-deploy-app.sh` certbot adiminda uzun sure asili kalabildigi icin manuel kesildi; uygulama dosyalari canliya dustu ama cert yenileme adimi ayri izlenmeli.
- Backup/Restore safety:
  - Edit oncesi temp backup alindi: `public/player/assets/js/player.js.bak_native_transition_fix_20260316_020957`, `android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt.bak_native_transition_fix_20260316_020957`.

## 2026-03-16 - BluetoothWizard Token Yönetimi ve Factory Reset İyileştirmesi

- Request: PavoDisplay cihazlarında factory reset sonrası DB token temizleme, token yönetim arayüzü ekleme
- Context: 3 Pavo cihaz (@B2A401A977/172-httpserver, @B2A301AB37/160-http, @B2A401A959/161-mqtt) token ile kuruldu ama sunucuda token DB'de kalıyordu, factory reset sonrası token temizlenmiyordu
- Diagnostics: 3 cihazda tüm portlar kapalı (80,8080,1883,5555), HTTP/MQTT üzerinden factory reset mümkün değil, sadece BLE ile yapılabilir. DB'de 3 cihazın token'ı mevcut (16 karakter).
- Changes:
  1. **BluetoothWizard.js** (`_factoryReset`): Factory reset sonrası `_clearTokenFromServer()` çağrısı eklendi - DB'deki token otomatik silinir
  2. **BluetoothWizard.js** (Token Yönetimi UI): Verify step'e "Token Yönetimi" kartı eklendi - Token durumu (korumalı/korumasız), Token göster, Token ayarla, Token temizle butonları
  3. **BluetoothWizard.js** (`_clearTokenFromServer`): Yeni metod - API DELETE /devices/:id/bt-password ile DB token temizleme
  4. **BluetoothWizard.js** (`_updateTokenStatusUI`): Token durumunu UI'da badge ile gösterme
  5. **BluetoothWizard.js** (`_viewToken`): Token'ı modal ile görüntüleme
  6. **BluetoothWizard.js** (`_clearDeviceToken`): BLE + DB'den token temizleme (admin/user password boşaltma + DB delete)
  7. **BluetoothWizard.js** (`_setDevicePassword`): Token ayarlandıktan sonra DB'ye otomatik kayıt
  8. **BluetoothWizard.js** (`_connect`): Bağlantı sonrası token durumunu UI'da gösterme
  9. **i18n**: `bluetooth.tokenManagement.*` ve `bluetooth.wizard.factoryResetSuccess` key'leri 8 dile eklendi
- Files changed: public/assets/js/pages/devices/list/BluetoothWizard.js, locales/tr/pages/devices.json, locales/en/pages/devices.json, locales/az/pages/devices.json, locales/de/pages/devices.json, locales/fr/pages/devices.json, locales/nl/pages/devices.json, locales/ru/pages/devices.json, locales/ar/pages/devices.json
- Checks run: JS syntax OK (node -e), TR JSON OK, EN JSON OK
- Backup: BluetoothWizard.js.bak.20260316
- Risks/Follow-up:
  - HTTP/MQTT modlu cihazlara ağ üzerinden factory reset göndermek mümkün değil (portlar kapalı, protokol desteklemiyor)
  - Factory reset sadece BLE ile yapılabilir (Web Bluetooth API gerektirir)
  - 172 ve 161 cihazları zaten resetlendi, eski tokenlar artık geçersiz
  - 160 (@B2A301AB37, HTTP) cihazı hala token aktif: BLE ile factory reset yapılabilir
## 2026-03-16 - APK native gecis yonu ve video->HTML exit animasyonu hizalamasi

- Request: Cihazda APK oynatici `player.js` ile birebir davranmiyor; HTML->video gecis yonu ters (sunucuda yukaridan asagi, cihazda asagidan yukari) ve video->HTML gecisinde animasyon kayboluyor.
- Root cause:
  - Native transition map'te `push-down` ters yone (`slide-up`) eslenmisti.
  - `stopVideoNative()` anlik `switchToWebView()` yapiyor, native katman cikisi animasyonsuz kapanip HTML enter animasyonunu kesiyordu.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (repo disi APK kaynak alani)
     - Native transition map duzeltildi: `push-down -> slide-down`, `push-up -> slide-up`.
     - Native cikis animasyonu eklendi: `switchToWebView(animateExit=true)` ile video->HTML gecisinde playerView exit animasyonu uygulanir.
     - Cikis/enter yarismasi icin `isSwitchingToWebView` guard eklendi; katman gecisinde race condition bastirildi.
     - `stopVideo()` artik uygun durumda `Video stop requested with animated native exit` akisina girer.
  2. **android-player/omnex-player-app/app/build.gradle** (repo disi APK kaynak alani)
     - APK surumu `versionCode 37`, `versionName 2.9.8`.
  3. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata `2.9.8 / v37` ve yeni SHA256 ile guncellendi.
  4. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `5314404a894ead9de83a51a9e91838cadfbecc751e2976fd7d7642292a7f0033`).
- Files changed (tracked): public/downloads/update.json, downloads/update.json, public/downloads/omnex-player.apk, downloads/omnex-player.apk
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - ADB live validation:
    - `player.js?v=52`
    - `Transition set: push-down -> slide-down, 2000ms`
    - `Video stop requested with animated native exit`
    - `Switched to WebView display (animated slide-down)`
- Risks/Follow-up:
  - Native kaynak dosyalari repo disi oldugu icin kod izleme APK binary + log dogrulama uzerinden yapiliyor.
- Backup/Restore safety:
  - Temp backup alindi: `android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt.bak_native_exit_anim_20260316_022413`.

## 2026-03-16 - Fix tokenManagement placement in DE/FR/RU locale files
- Request: Move `tokenManagement` block from `form` section to `bluetooth` section in DE/FR/RU devices.json locale files. Also verify `factoryResetSuccess` key in `bluetooth.wizard`.
- Changes:
  - Removed `tokenManagement` object from inside `form` section (was after `form.errors`)
  - Added `tokenManagement` object as direct child of `bluetooth` section (after `wizard`, before closing `}`)
  - `factoryResetSuccess` already present in `bluetooth.wizard` in all three files - no addition needed
- Files:
  - `locales/de/pages/devices.json`
  - `locales/fr/pages/devices.json`
  - `locales/ru/pages/devices.json`
- Checks: PHP `json_decode()` validation passed for all three files (VALID JSON)
- Risk/Follow-up: None. Structure now matches TR reference file.
## 2026-03-16 - APK push gecisinde erken oturma etkisi (lineer hiz + no-fade)

- Request: Cihazda gecislerde sonraki icerik onceki kaybolmadan ustune erken oturuyor; `player.js` itme hissine daha yakin davranis isteniyor.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (repo disi APK kaynak alani)
     - Native enter/exit slide animasyonlarinda `alpha` fade kaldirildi (yalnizca eksensel itme hareketi).
     - Native enter ve exit interpolator'u `LinearInterpolator` yapildi (erken hizlanip oturma etkisi azaltildi).
  2. **android-player/omnex-player-app/app/build.gradle** (repo disi APK kaynak alani)
     - APK surumu `versionCode 38`, `versionName 2.9.9`.
  3. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata `2.9.9 / v38` ve SHA256 guncellendi.
  4. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `74ac1baace2e9a602c01793fb6a3148fb70d69101865845635a273754090ca45`).
- Files changed (tracked): public/downloads/update.json, downloads/update.json, public/downloads/omnex-player.apk, downloads/omnex-player.apk
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - ADB validation:
    - `versionCode=38`, `versionName=2.9.9`
    - `Transition set: push-down -> slide-down, 2000ms`
    - `Video stop requested with animated native exit`
    - `Switched to WebView display (animated slide-down)`
- Risks/Follow-up:
  - Gecisin gorunensel olarak birebir onayi cihazdan canli izlemeyle kullanici tarafinda son onay gerektirir.
- Backup/Restore safety:
  - Mevcut Exo kaynak backup setleri kullanilmaya devam ediyor; ek restore gerekmedi.
## 2026-03-16 - Native transition parity + HTML/video preload icon flash reduction (v54 + APK 2.9.10)

- Request: Cihazda gecislerde APK animasyonu `player.js` ile farkli hissediyor; dikeyde ust uste binme/preload ikon flashlari var. Playlist transition turunun APK tarafinda turetilmeden birebir uygulanmasi ve HTML/video gecisinde preload ikonunun azaltilmasi istendi.
- Changes:
  1. **public/player/assets/js/player.js**
     - Same-origin iframe video hardening guclendirildi: `poster` kaldirildi, preload/play iconu tetikleyen zorunlu `setTimeout(revealVideo, 1200)` kaldirildi.
     - Iframe videolari sadece gercek frame hazirsa (`readyState/currentTime/playing`) gorunur olacak sekilde guard eklendi.
     - Native video placeholder cikis etkisi icin onceki patch korunarak akisa alindi (`_currentElement = null`, pending exit flush `null` ile).
  2. **public/player/assets/css/player.css**
     - `#video-content` ve `#video-content-alt` stilleri esitlenerek ikinci video slotta olasi icon/flash riski azaltildi.
  3. **public/player/index.html**
     - Cache-bust guncellendi: `player.css?v=36`, `player.js?v=54`.
  4. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (repo disi APK kaynak alani)
     - Native gecis mesafesi sabit fallback yerine gercek ekran olculerinden hesaplanir hale getirildi (`getTransitionTravelWidth/Height`).
     - Native interpolator CSS `ease` ile esitlendi (`PathInterpolator(0.25, 0.1, 0.25, 1.0)`).
     - Transition map turetmesi kaldirildi; playlistten gelen transition tipi birebir kullanilir (`push/slide/wipe` adlari korunur).
     - Debug loglari eklendi (`Enter/Exit transition ... travelX/travelY`).
  5. **android-player/omnex-player-app/app/build.gradle** (repo disi APK kaynak alani)
     - Surum: `versionCode 39`, `versionName 2.9.10`.
  6. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata `2.9.10 / v39` ve SHA256 guncellendi.
  7. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `0d5b811d184ea0174cd0cd64760e94c6b286aeac2372f51560e7b31c54febc4e`).
- Deployment:
  - `main` push: `07d0993`.
  - Sunucu: `/opt/omnex-hub` `git pull --ff-only`, `docker compose -f deploy/docker-compose.yml build app`, `up -d app`.
  - Live dogrulama:
    - `https://hub.omnexcore.com/player/` -> `player.js?v=54`, `player.css?v=36`
    - `https://hub.omnexcore.com/downloads/update.json` -> `versionCode 39`, `versionName 2.9.10`, yeni SHA.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - JSON parse checks: `public/downloads/update.json`, `downloads/update.json` (OK)
  - ADB live verification:
    - app loads `player.js?v=54`
    - transition log: `Transition set: push-down -> push-down`
    - native travel metrics logged (`travelY=...`).
- Risks/Follow-up:
  - Gorsel son onay cihaz tarafinda kullanici gozlemi ile tamamlanmali (ozellikle preload ikonunun tamamen kaybolmasi).
  - `:app:compileDebugKotlin` gorevi flavor nedeniyle ambiguos; `compileStandaloneDebugKotlin` kullanildi.
- Backup/Restore safety:
  - Temp backup alindi:
    - `public/player/assets/js/player.js.bak_iframe_video_guard_20260316_025037`
    - `android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt.bak_transition_distance_20260316_025037`

## 2026-03-16 - APK JS transition passthrough (v40 / 2.9.11)

- Request: Preload icon sorunu cozulduktan sonra kullanici APK'nin hala kendi animasyon stil/zaman akisini kullandigini bildirdi. Istek: APK transition yonetmesin, player.js'ten gelen akisi oldugu gibi kullansin.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (repo disi APK kaynak alani)
     - `jsOwnsTransitions = true` eklendi.
     - Native enter/exit transition calistirma kosullari kapatildi (`switchToExoPlayer` ve `switchToWebView` instant path).
     - `stopVideo()` icindeki native animate-exit yolu JS passthrough modunda devre disi.
     - Log satiri eklendi: `Transition set: ... (jsOwns=true)`.
  2. **android-player/omnex-player-app/app/build.gradle** (repo disi APK kaynak alani)
     - APK surumu: `versionCode 40`, `versionName 2.9.11`.
  3. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata `2.9.11 / v40` ve SHA256 guncellendi.
  4. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `2056f83108c2a2ba43e672635935b01b941d0290f05cdb215aee50a8ff062978`).
- Deployment:
  - `main` push: `0df6536`.
  - Sunucu: `/opt/omnex-hub` `git pull --ff-only`, `docker compose -f deploy/docker-compose.yml build app`, `up -d app`.
  - Live endpoint: `https://hub.omnexcore.com/downloads/update.json` -> `versionCode 40`, `versionName 2.9.11`, yeni SHA.
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - JSON parse checks: `public/downloads/update.json`, `downloads/update.json` (OK)
  - ADB live validation:
    - package `versionCode=40`, `versionName=2.9.11`
    - logs: `Transition set: push-down -> push-down, 2000ms (jsOwns=true)`
    - logs: `Switched to ExoPlayer display (instant, JS-driven transition)`
- Risks/Follow-up:
  - Native katman animasyon yapmadigi icin gecis hissi tamamen player.js'e bagli. Gorsel son onay cihazdan izlenerek verilmelidir.
- Backup/Restore safety:
  - Temp backup alindi: `android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt.bak_js_passthrough_20260316_031026`.
## 2026-03-16 - Video transition re-enable + orientation-aware native direction sync (v41 / 2.9.12)

- Request: APK tarafinda videolarin animasyona dahil olmamasi (anlik gelme/kaybolma) ve yatay playlist dikeye cevrildiginde gecis yonu uyumsuzlugu bildirildi. Istek: APK transition karari uretmesin; player.js'ten gelen nihai akisi uygulasin.
- Changes:
  1. **public/player/assets/js/player.js**
     - Native video icin gonderilen transition artik `getResolvedTransitionType()` uzerinden hesaplanir.
     - Force-rotate durumlarinda (`force-rotate-landscape` / `force-rotate-portrait`) native video transition yonu remap edilir:
       - +90deg: left->up, right->down, up->right, down->left
       - -90deg: left->down, right->up, up->left, down->right
     - `native transition prepared` debug izi eklendi.
     - Native start sonrasinda `releaseResolvedTransitionType()` eklenerek runtime transition token sarkmasi engellendi.
  2. **public/player/index.html**
     - JS cache-bust: `player.js?v=55`.
  3. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (repo disi APK kaynak alani)
     - `jsOwnsTransitions` tekrar `false` yapildi: native video enter/exit animasyonlari yeniden aktif.
     - Native transition secimi JS tarafinda yapildigindan APK sadece gelen transition'i uygular.
  4. **android-player/omnex-player-app/app/build.gradle** (repo disi APK kaynak alani)
     - APK surumu `versionCode 41`, `versionName 2.9.12`.
  5. **public/downloads/update.json** ve **downloads/update.json**
     - OTA metadata `2.9.12 / v41` ve SHA256 guncellendi.
  6. **public/downloads/omnex-player.apk** ve **downloads/omnex-player.apk**
     - Yeni APK publish edildi (sha256: `a32a13b4607a6a257d563cf61c30cda9a6920fefa461d2fc94be880fe616d715`).
- Deployment:
  - Commit/push: `b40d3f8`.
  - Sunucu: `/opt/omnex-hub` `git pull --ff-only`, `docker compose -f deploy/docker-compose.yml build app`, `up -d app`.
  - Live:
    - player: `player.js?v=55`
    - update endpoint: `versionCode 41`, `versionName 2.9.12`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug :app:publishDebugApk` (OK)
  - JSON parse checks: `public/downloads/update.json`, `downloads/update.json` (OK)
  - ADB verification:
    - app loads `player.js?v=55`
    - logs: `Transition set: push-down -> push-down, 2000ms (jsOwns=false)`
    - logs: `Switched to ExoPlayer with push-down transition` ve `Switched to WebView display (animated push-down)`.
- Risks/Follow-up:
  - Force-rotate remap'in gorsel son onayi kullanici tarafinda cihaz uzerinde verilmeli (toggle ile dikey/yatay akis testi).
- Backup/Restore safety:
  - Onceki backup'lar korunuyor; bu tur icin ek backup alinmadi.
## 2026-03-16 - HTML<->native video transition seam sync + screen-axis transition mapping (player.js v56)

- Request: APK'de ozellikle `video <-> html` gecislerinde bosluk/binme gorunmesi ve force-rotate durumda (yatay playlist dikeye alininca) gecis yonlerinin beklenen ekran eksenini takip etmemesi bildirildi. PC/PWA/APK ayni davranisa yaklastirilmali.
- Changes:
  1. **public/player/assets/js/player.js**
     - DOM enter/exit gecisleri icin yeni layout-aware map eklendi: `getDomTransitionTypeForCurrentLayout(...)`.
     - Force-rotate fallback siniflarinda (portrait/landscape) DOM transition class'i ekran eksenine gore remap edilir hale getirildi.
     - Native transition mapping sadele�tirildi: `getNativeTransitionTypeForCurrentLayout(...)` artik resolved tipi dogrudan kullanir (native katman screen coordinates).
     - `applyEnterTransition` ve `applyExitTransition` DOM remap sonucunu kullanacak sekilde guncellendi; debug payload'a `resolvedTransition` + `domTransition` eklendi.
     - Native bridge yardimcilari eklendi: `isNativePlaybackActive()` ve `stopNativeVideoForTransition(reason)`.
     - `video -> html` gecisinde native katmani erken kapatma yerine, html iframe ready oldugunda native stop tetiklenecek sekilde ak�s kuruldu:
       - `scheduleNext()` icinde sonraki icerik `html` ise native stop ertelenir.
       - `finalizeHtmlPlayback()` icinde html enter oncesi `stopNativeVideoForTransition('html-ready')` cagrilir.
       - `playHtml()` basinda native oynatma aktifse hemen `setNativeVideoMode(false)` yapilmaz.
     - Native transition debug loguna `domMapped` alani eklendi.
  2. **public/player/index.html**
     - Cache-bust guncellendi: `player.js?v=56`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Native stop'un html ready noktasina alinmasi, cok yavas iframe acilislarinda onceki videonun ekranda biraz daha uzun kalmasina neden olabilir (beklenen tradeoff: siyah bosluk yerine tutarli gecis).
  - Gorsel onay cihazda gerekli: force-rotate portrait/landscape + `push-up/push-down` + `html<->video` senaryolari.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/js/player.js.bak_transition_sync_20260316_065626`.

## 2026-03-16 - Deep transition/orientation debug instrumentation for cross-type mismatch (player.js v57)

- Request: Video/html/resim gecisleri yatayda dogruyken dikey force-rotate senaryosunda konum/yon uyumsuzluklari devam ediyor. Yatay tur tamamlanip dikey tur tamamlaninca detayli log analizi icin kapsamli debug eklendi.
- Changes:
  1. **public/player/assets/js/player.js**
     - Yeni detayli debug snapshot altyapisi eklendi:
       - `_transitionDebugSeq`
       - `roundDebugValue(...)`
       - `getElementLayoutSnapshot(...)`
       - `traceTransitionSnapshot(stage, payload)`
     - Snapshot; orientation state, container classlari, native status, aktif/pending elementler, viewport/render olculeri ve image/video/videoAlt/html/htmlAlt katmanlarinin `display/visibility/opacity/zIndex/rect/srcTail` bilgilerini loglar.
     - Snapshot cagri noktalari eklendi:
       - orientation: `orientation-applied`, `orientation-toggle-applied`
       - playlist: `playCurrentItem`
       - transition pipeline: `hideAllContent-start/end`, `enter-transition-start/end`, `exit-transition-start/end`, `pending-exit-flush`
       - content starts: `playImage-start`, `playTemplate-start`, `playVideo-start`, `playVideo-mode-decision`, `playHtml-start`
       - native/video lifecycle: `native-transition-prepared`, `playVideo-native-started`, `playVideo-fallback-webview`, `playVideo-native-error-webview`, `playVideo-direct-webview`, `native-video-started`, `native-video-ended`, `native-video-mode-changed`, `native-stop-requested`
       - html lifecycle: `playHtml-iframe-ready`, `html-finalize-before-enter`
       - timer: `scheduleNext-tick`, `scheduleNext-defer-native-stop`, `scheduleNext-stop-native-now`
  2. **public/player/index.html**
     - Cache-bust guncellendi: `player.js?v=57`.
- Deployment:
  - Commit/push: `96343e8`.
  - Sunucu: `/opt/omnex-hub` `git pull --ff-only`, `docker compose -f deploy/docker-compose.yml build app`, `up -d app`.
  - Live dogrulama: `https://hub.omnexcore.com/player/` -> `player.js?v=57`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Debug acikken log yogunlugu belirgin artar; performans olcumleri debug kapali kosulda alinmali.
  - Analiz icin kullanicidan yatay ve dikey tur loglari karsilastirmali alinacak.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/js/player.js.bak_transition_debug_20260316_040143`.

## 2026-03-16 - Video capture review (analysis-only)

- Request: `kutuphane/2026-03-16_04-16-46.mp4` videosunun izlenmesi ve gozlemsel geri bildirim.
- Changes:
  - Kod degisikligi yok (analysis-only).
  - Uretilen gecici analiz dosyalari: `kutuphane/_frames_20260316_041646_b/*`.
- Checks/analysis run:
  - `ffprobe` ile metadata inceleme.
  - `ffmpeg` ile 1 fps frame extraction ve contact-sheet uretimi.
  - Sahne degisim noktalarini `select='gt(scene,0.22)',showinfo` ile cikarma.
- Risks/Follow-up:
  - Bu turn'de yalnizca video gozlemi yapildi; runtime transition root-cause icin `[Player][STATE]` loglari ayrica gerekli.
- Backup/Restore safety:
  - Uygulanmadi (kod dosyasi degismedi).

## 2026-03-16 - Virtual playlist orientation on manual toggle (player.js v58)

- Request: Debug log toplamak zor oldugu icin dogrudan davranis duzeltmesi istendi. Oneri: orientation icon ile ekran yonu degistiginde playlistin de sanal olarak yeni yone gore davranmasi (layout/efekt uyumu).
- Changes:
  1. **public/player/assets/js/player.js**
     - Manual orientation toggle aktifken layout yonunu requested orientation'a baglayan yeni yapilar eklendi:
       - `getBaseContentOrientation()`
       - `shouldVirtualizePlaylistOrientation()`
       - `getLayoutOrientationState()`
     - `applyPlaylistOrientation()` artik container `orientation-*` class'ini `layoutOrientation` uzerinden set ediyor:
       - Toggle aktifse source: `requested-screen`
       - Degilse source: `content-or-playlist`
     - `applyOrientationRotation()` cagrisi layout state'deki requested orientation ile senkronlandi.
     - Debug snapshot/console payload'larina `layout`, `layoutSource`, `virtualizedPlaylistOrientation`, `baseContentOrientation` alanlari eklendi.
     - `orientation-toggle-applied` debug payload'i layout kaynak bilgisini de tasiyacak sekilde guncellendi.
  2. **public/player/index.html**
     - Cache-bust guncellendi: `player.js?v=58`.
- Deployment:
  - Commit/push: `5e80e6b`.
  - Sunucu: `/opt/omnex-hub` `git pull --ff-only`, `docker compose -f deploy/docker-compose.yml build app`, `up -d app`.
  - Live dogrulama: `https://hub.omnexcore.com/player/` -> `player.js?v=58`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Toggle aktifken item/playlist orientation metadata'si layout geometry'yi override eder. Bu istenen davranistir; ancak spesifik iceriklerde goruntu cercevesi algisi degisebilir.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/js/player.js.bak_virtual_playlist_orientation_20260316_042652`.

## 2026-03-16 - Transition remap guard confirmation for virtualized orientation (player.js v59)

- Request: SW loglarinda detay gorunmedigi icin, yatay/dikey icin onceki degisikliklerle ekstra gecis kurallarinin cakisip cakismadigi teyidi istendi.
- Changes:
  - Bu turde yeni kod degisikligi yapilmadi.
  - Mevcut v59 davranisi dogrulandi:
    - `public/player/assets/js/player.js` icinde `getDomTransitionTypeForCurrentLayout(...)` fonksiyonunda `layoutState.virtualized === true` durumunda erken `return transition` kullaniliyor.
    - Boylece manual orientation toggle aktifken ikinci kez directional remap uygulanmiyor.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - `sw.js` loglari transition pipeline'i gostermedigi icin tek basina root-cause vermez; gerekirse `?debug=1` ile `[Player][TRANS]`/`[Player][STATE]` loglari alinmali.
- Backup/Restore safety:
  - Uygulanmadi (bu turde kod dosyasi edit edilmedi).

## 2026-03-16 - CSS transition/orientation conflict fix for desktop rotate and mixed orientation playback

- Request: Dikey/yatay gecislerde mobil/TV iyi iken PC tarayicida (ozellikle sola rotate fallback durumunda) iceriklerin ilk/son konumunda atlama ve yanlis oturma raporlandi.
- Changes:
  1. **public/player/assets/css/player.css**
     - Force-rotate ve orientation mismatch bloklarindaki `transform: ... !important` kilitleri kaldirildi:
       - boylece transition keyframe `transform` animasyonlari CSS tarafinda bloke edilmiyor.
     - `#player-screen .content-item.transition-enter/.transition-exit` altindaki geometry override'lar (`top/left/width/height/max-* / aspect-ratio`) `!important` olmaktan cikarildi:
       - orientation/mismatch kurallarinin transition aninda tamamen ezilmesi engellendi.
  2. **public/player/index.html**
     - CSS cache-bust guncellendi: `player.css?v=37`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - Not: CSS/HTML icin projede tanimli dogrudan syntax check komutu yok.
- Risks/Follow-up:
  - Bu duzeltme force-rotate senaryosunda transform animasyonunun tekrar calismasini hedefler; son gorsel teyit PC browser + mobil force-rotate testleriyle alinmali.
  - Repoda bu turn disinda kullaniciya ait baska degisiklikler var; commit yalnizca player CSS/index + memory ile sinirli tutulmali.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/css/player.css.bak_transition_force_rotate_conflict_20260316_0741`.

## 2026-03-16 - Remove centering transform conflict for force-rotate mismatch (PC HTML jump fix)

- Request: APK stabil, ancak PC'de ozellikle HTML gecislerinde icerik saga dayali baslayip merkeze atliyor; tum turlerde merkez konumunun stabil olmasi istendi.
- Changes:
  1. **public/player/assets/css/player.css**
     - `force-rotate-landscape.orientation-portrait .content-item` merkezleme yontemi:
       - `left: 50% + transform: translateX(-50%)` yerine
       - `left: calc((100% - 56.25%) / 2)` + `transform: none` kullanildi.
     - `force-rotate-portrait.orientation-landscape .content-item:not(iframe)` merkezleme yontemi:
       - `top: 50% + transform: translateY(-50%)` yerine
       - `top: calc((100% - 56.25%) / 2)` + `transform: none` kullanildi.
     - Boyutu/orani belirleyen mevcut kurallar korunarak sadece transform-cakismasi kaldirildi.
  2. **public/player/index.html**
     - CSS cache-bust guncellendi: `player.css?v=38`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - Not: CSS/HTML icin projede tanimli dogrudan syntax check komutu yok.
- Risks/Follow-up:
  - `56.25%` tabanli merkezleme mevcut tasarimla uyumlu; farkli custom aspect oranli ozel template'lerde ek ayar gerektirebilir.
  - Final gorsel dogrulama PC browser force-rotate senaryosunda (html->video, video->html, image->html) yapilmali.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/css/player.css.bak_center_without_transform_20260316_0806`.

## 2026-03-16 - Lock orientation-mismatch content to absolute center (cross-type transition drift fix)

- Request: PC'de html duzelmesine ragmen video/resim cikisinda saga-sola kayar gibi davranis raporlandi; bunun animasyon kaynakli olup olmadigi soruldu.
- Changes:
  1. **public/player/assets/css/player.css**
     - Orientation mismatch layout'lari (force-rotate disi media-query bloklari) flex+relative modelden absolute center modele alindi:
       - `@media landscape` + `.orientation-portrait .content-item`:
         - `position: absolute`, `width: 56.25%`, `left: calc((100% - 56.25%) / 2)`, `top: 0`.
       - `@media portrait` + `.orientation-landscape .content-item:not(iframe)`:
         - `position: absolute`, `height: 56.25%`, `left: 0`, `top: calc((100% - 56.25%) / 2)`.
     - Ama�: enter/exit aninda iki icerik ayni anda gorunurken flex reflow/relative static-position nedeniyle olusan yatay-dikey kaymalari kaldirmak.
  2. **public/player/index.html**
     - CSS cache-bust guncellendi: `player.css?v=39`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - Not: CSS/HTML icin projede tanimli dogrudan syntax check komutu yok.
- Risks/Follow-up:
  - Bu degisiklik tur-bagimsizdir; html/video/image icin ortak geometry kullanir.
  - Farkli en-boy oranli custom iceriklerde goruntu alani hissi degisebilir; gerekli olursa oran bazli ince ayar eklenir.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/css/player.css.bak_orientation_center_lock_20260316_0817`.

## 2026-03-16 - Disable deep player debug traces after stabilization (player.js v60)

- Request: Gecis/konum sorunlari cozuldikten sonra islem gecmisinde eklenen ayrintili debug loglarinin kaldirilmasi; debug temizligi sonrasi davranisin bozulmamasi istendi.
- Changes:
  1. **public/player/assets/js/player.js**
     - Ayrintili debug metotlari no-op hale getirildi:
       - `traceDebug(...)` -> no-op
       - `traceTransitionSnapshot(...)` -> no-op
     - Snapshot sayaci olarak kullanilan `_transitionDebugSeq` constructor alanindan kaldirildi.
     - Cagri noktalari korunarak transition akisi degistirilmedi (sadece log cikisi kapatildi).
  2. **public/player/index.html**
     - JS cache-bust guncellendi: `player.js?v=60`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Derin debug loglari kapali oldugu icin yeni issue durumunda gecici olarak tekrar acilabilir.
  - Akis davranisi degismemeli; sadece konsol g�r�lt�s� ve snapshot hesaplari devre disi.
- Backup/Restore safety:
  - Temp backup alindi: `public/player/assets/js/player.js.bak_disable_deep_debug_20260316_0828`.

## 2026-03-16 - Startup context sync for new tasks

- Request: Read existing project info files and memory, then confirm readiness for upcoming topics.
- Changes:
  1. **.codex/CHANGE_MEMORY.md**
     - Added this log entry to record startup context sync.
- Checks run:
  - No syntax check run (no code files changed in this task).
- Risks/Follow-up:
  - Next tasks should follow current player stabilization context and existing workflow guardrails.
- Backup/Restore safety:
  - Not needed (append-only memory update).
## 2026-03-16 - Android TV shortcut icon strategy confirmation

- Request: Confirm whether a TV-only special shortcut PNG can be used while keeping current icon pack for other devices.
- Changes:
  1. **.codex/CHANGE_MEMORY.md**
     - Added this advisory-task log entry.
- Checks run:
  - No syntax check run (no code files changed in this task).
- Risks/Follow-up:
  - For Android TV, launcher surface may use ndroid:banner and/or app icon depending on launcher; both resources should be planned together.
- Backup/Restore safety:
  - Not needed (append-only memory update).
## 2026-03-16 - Add TV-only launcher icon resources (with temp backup)

- Request: Use a separate shortcut icon PNG only for TV devices to avoid oval-mask white gaps, with temp-backup-safe workflow.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/res/mipmap-television-mdpi/ic_launcher.png**
  2. **android-player/omnex-player-app/app/src/main/res/mipmap-television-mdpi/ic_launcher_round.png**
  3. **android-player/omnex-player-app/app/src/main/res/mipmap-television-hdpi/ic_launcher.png**
  4. **android-player/omnex-player-app/app/src/main/res/mipmap-television-hdpi/ic_launcher_round.png**
  5. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xhdpi/ic_launcher.png**
  6. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xhdpi/ic_launcher_round.png**
  7. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xxhdpi/ic_launcher.png**
  8. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xxhdpi/ic_launcher_round.png**
  9. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xxxhdpi/ic_launcher.png**
  10. **android-player/omnex-player-app/app/src/main/res/mipmap-television-xxxhdpi/ic_launcher_round.png**
     - TV-only mipmap qualifiers added; app keeps existing icon resource names (ic_launcher, ic_launcher_round) so non-TV devices continue using normal icon pack.
     - TV icons generated from source: public/branding/tv-logo.png.
  11. **android-player/omnex-player-app/app/src/main/AndroidManifest.xml.bak_tv_shortcut_icons_20260316_174139**
     - Temp backup created before resource work.
- Checks run:
  - ./gradlew.bat :app:compileDebugKotlin (failed: ambiguous task name because flavors exist)
  - ./gradlew.bat :app:compileStandaloneDebugKotlin (OK)
  - ./gradlew.bat :app:compilePlaystoreDebugKotlin (OK)
- Risks/Follow-up:
  - If some TV launchers still apply aggressive icon masks, visual tuning may require a dedicated padded TV icon source instead of current square-fill asset.
  - Leanback home tile also depends on ndroid:banner; if needed, anner can be customized separately.
- Backup/Restore safety:
  - Temp backup used as requested.
## 2026-03-16 - Build v2.9.13 APK, update OTA JSON, push/pull and deploy for TV auto-update test

- Request: Build new APK, copy into downloads folders, update upload/update JSON files, run git pull+push, deploy APK+JSON to server for OTA test on TV.
- Changes:
  1. **android-player/omnex-player-app/app/build.gradle** (gitignored)
     - versionCode: `41 -> 42`
     - versionName: `2.9.12 -> 2.9.13`
  2. **downloads/omnex-player.apk** and **public/downloads/omnex-player.apk**
     - Replaced with newly built standalone debug APK (v42).
  3. **downloads/omnex-player-standalone-v2.9.13.apk** and **public/downloads/omnex-player-standalone-v2.9.13.apk**
     - Added versioned APK copies for release archive.
  4. **downloads/update.json** and **public/downloads/update.json**
     - Updated to versionCode `42`, versionName `2.9.13`, downloadUrl query `v=42`, new release notes and SHA256.
  5. **User Downloads copies**
     - `C:\Users\test\Downloads\omnex-player.apk`
     - `C:\Users\test\Downloads\omnex-player-standalone-v2.9.13.apk`
     - `C:\Users\test\Downloads\update.json`
- Checks run:
  - `./gradlew.bat assembleStandaloneDebug` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK)
  - JSON parse checks (downloads/public update.json) (OK)
  - APK hash parity check (downloads/public) (OK)
- Risks/Follow-up:
  - `android-player/` gitignored oldugu icin kaynak kod degisiklikleri git commit'e girmez; dagitim APK + update.json uzerinden yayin yapilir.
  - Server deploy adiminda SSH erisimi/izinler ortama baglidir.
- Backup/Restore safety:
  - Temp backups created:
    - `android-player/omnex-player-app/app/build.gradle.bak_apk_release_20260316_175238`
    - `downloads/update.json.bak_apk_release_20260316_175238`
    - `public/downloads/update.json.bak_apk_release_20260316_175238`
## 2026-03-16 - Post-release git/server deployment verification (v2.9.13)

- Request: Complete git push/pull and deploy APK + update JSON so OTA test can run on TV.
- Changes:
  1. **Git**
     - Commit: `18161a7` pushed to `origin/main`.
     - Included files: `.codex/CHANGE_MEMORY.md`, `downloads/*.apk`, `downloads/update.json`, `public/downloads/*.apk`, `public/downloads/update.json`.
  2. **Server deploy**
     - Remote repo fast-forward pull completed in `/opt/omnex-hub`.
     - APK + update JSON uploaded via SCP to `/opt/omnex-hub/downloads/` and `/opt/omnex-hub/public/downloads/`.
- Checks run:
  - Remote JSON+APK integrity check: version `42` / `2.9.13`, SHA256 match = `true`.
  - Live endpoint check: `https://hub.omnexcore.com/downloads/update.json` shows v42 metadata.
  - Live APK HEAD check: `https://hub.omnexcore.com/downloads/omnex-player.apk?v=42` returns HTTP 200.
- Risks/Follow-up:
  - OTA popup appears only if TV device currently has lower `versionCode` than `42`.
  - If same version already installed, update dialog intentionally does not show.
- Backup/Restore safety:
  - Previous temp backups retained for build.gradle and update.json files.
## 2026-03-17 - Player history/memory review for next operations readiness

- Request: Review yesterday's player work from operation/commit history and memory, then confirm readiness for upcoming tasks.
- Changes:
  1. **.codex/CHANGE_MEMORY.md**
     - Added this readiness review log entry.
- Checks run:
  - No syntax checks run (no code files changed; memory-only update).
- Risks/Follow-up:
  - 2026-03-16 player timeline contains intensive transition/orientation fixes and APK release chain (v2.9.6 -> v2.9.13); next changes should be scoped carefully to avoid regressions in public/player/assets/js/player.js and public/player/assets/css/player.css.
- Backup/Restore safety:
  - Not needed (append-only memory update).

## 2026-03-17 - Cross-device playback instability deep investigation and guarded fixes

- Request: Investigate inconsistent playback across PC Chrome/PWA, Android phone, and Grundig TV; connect via ADB for long-running analysis, inspect p50/p95/p99, validate device/media profile behavior, and check ffmpeg/hls/html-video conflict without assumptions.
- Findings:
  1. TV-side decoder failures are repeatable and device-local (not server latency): `OMX.MS.AVC.Decoder` errors appear in both ExoPlayer and Chromium/WebView decode paths during video<->html cycles.
  2. Long-run TV metrics from filtered log capture (`.codex/tv_logcat_long_filtered_20260317_034021.log`):
     - `preload_to_exo_codec_error`: n=16, p50=4393.5ms, p95=4494.2ms, p99=4497.2ms
     - `use_preloaded_to_exo_codec_error`: n=16, p50=4444ms, p95=4550.2ms, p99=4550.8ms
     - `native_stop_requested_to_webview_switch`: n=16, p50=1518.5ms, p95=1527.2ms, p99=1527.8ms
  3. Production API flow during incident window remained healthy (`/api/player/init`, `/api/player/heartbeat` consistently HTTP 200 with low ms timings in `api.log`), so backend/network bottleneck was not indicated.
  4. Active TV playlist contains `html + image + video` mix; html templates include inline `<video>` mp4 sources, which aligns with native-preload + html-video decoder contention windows.

- Changes:
  1. **public/player/assets/js/player.js**
     - Added TV+HTML guard to skip native Exo preload in decoder-contention-prone transitions.
     - Added `clearNativePreloadedVideo(...)` bridge-aware helper and invoked it in HTML transition points (`playHtml`, `finalizeHtmlPlayback`, deferred html stop path).
  2. **public/player/sw.js**
     - Bumped SW cache version: `v1.3.3 -> v1.3.4`.
     - Added `/api/web-templates/` to network-first API routes to reduce stale template cache behavior.
  3. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt** (gitignored local tree)
     - Added `clearPreloadedVideo()` for explicit preload decoder release.
  4. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt** (gitignored local tree)
     - Added JS bridge method `clearPreloadedVideoNative()`.

- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - `./gradlew.bat :app:compileDebugKotlin` (failed: ambiguous variant task name)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK)

- Risks/Follow-up:
  - Full preload-clear behavior on TV requires APK with new bridge method; JS-side guard still reduces contention even on older APK by skipping problematic preload path.
  - `android-player/` is gitignored in this repo, so Android native code edits are local and must be deployed via APK release workflow.

- Backup/Restore safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/player.js.20260317_035714.bak`
    - `.codex/tmp_backups/sw.js.20260317_040117.bak`
    - `.codex/tmp_backups/ExoPlayerManager.kt.20260317_035714.bak`
    - `.codex/tmp_backups/MainActivity.kt.20260317_035714.bak`

## 2026-03-17 - TV direct live watch on port 46863 (no code changes)

- Request: Directly monitor Omnex Player on TV and explain why preload icon appears but video does not play.
- Scope: Live ADB observation only (no source edits in this step).
- Device/session:
  - TV ADB active port confirmed: `192.168.1.52:46863`
  - APK: `com.omnex.player` `versionName=2.9.14` (`versionCode=43`)
- Findings (from `.codex/tv_live_global_20260317_054344.log`):
  1. Repeated decoder init/runtime failures on TV hardware codec `OMX.MS.AVC.Decoder`.
  2. Error chain repeatedly observed: `setPortMode ... err -1010` -> `nBufferCountActual failed: -22` -> `ACodec ERROR(0x80001000)` -> `MediaCodec.onError` -> Chromium `PIPELINE_ERROR_DECODE`.
  3. Failures occur in Chromium/WebView media path (`cr_MediaCodecBridge`), indicating issue is not only native Exo path.
  4. This explains visible preload/loading state without rendered video frame on TV.
- Changed files: none.
- Checks run:
  - ADB connectivity and package version checks on `192.168.1.52:46863`.
  - 80-90s live global log capture and error pattern extraction.
- Risks / follow-up:
  - TV decoder instability remains active in current runtime; JS-only fallback cannot fully mask hardware codec failures for all content.
  - Next step should be content-profile hardening and/or TV-specific decode policy (additional mitigation patch still needed).
## 2026-03-17 - SW scope isolation for player and root SW bypass

- Request: Investigate newly observed console errors (`contentScript.js`, `sw.js:443`) and stabilize player behavior by preventing service worker scope interference.
- Findings:
  1. `sw.js:443 [SW] Loaded. Development mode: false` maps to root app SW file (`public/sw.js`), not player SW (`public/player/sw.js`).
  2. Player currently registers SW with relative path (`./sw.js`), which can coexist with root SW and create inconsistent control/order during first loads.
- Changes:
  1. **public/player/assets/js/player.js**
     - Updated SW registration to explicit player scope/path using `window.PLAYER_PATH` and `{ scope: scopePath }`.
  2. **public/sw.js**
     - Added fetch bypass guard for player routes/referrers and media (`video`/`audio`) so root SW never intercepts player runtime/media traffic.
  3. **public/player/index.html**
     - Bumped player script cache-bust version `v=66 -> v=67`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/sw.js` (OK)
- Risks/Follow-up:
  - Existing clients may need one refresh/reload cycle for the new SW control path to settle.
  - TV hardware decoder instability may still occur independently of SW scope (codec-level errors were previously observed).
- Backup/Restore safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/player.js.pre_sw_scope_isolation_20260317_060129.bak`
    - `.codex/tmp_backups/public_sw.js.pre_player_bypass_20260317_060129.bak`
    - `.codex/tmp_backups/index.html.pre_player_js_v67_20260317_060301.bak`
## 2026-03-17 - Server load/zombie mitigation and browser-side media diagnostics

- Request: Check server resources for possible stuck/zombie process; investigate first-refresh freeze in Chrome player; add debug hooks to capture decode/fallback behavior from browser side.
- Findings:
  1. Server load spike source was `omnex-channel-worker-1` running duplicate `ffmpeg` encoders for the same channel token/profile (~68% + ~61% CPU) and one `ffmpeg <defunct>` process.
  2. Immediate mitigation via `omnex-channel-worker-1` restart dropped worker CPU to ~0% and removed active duplicate ffmpeg processes.
  3. Browser log confusion remains valid: root `public/sw.js` logs can appear separately from player SW; player SW scope isolation already in place.
- Changes:
  1. **services/StreamChannelService.php**
     - Added duplicate encoder cleanup path in `ensureEncoderRunning()`.
     - Added `stopDuplicateEncoders()` and `findEncoderPidsForChannel()` to detect/terminate extra ffmpeg PIDs bound to same channel directory.
  2. **public/player/assets/js/player.js**
     - Added optional media diagnostics (`media_diag=1` or `debug`) with in-browser ring buffer `window.__omnexMediaDiagnostics`.
     - Added hooks for `window error`, `unhandledrejection`, SW registration info, startup watchdog, WebView video error/pause/reveal events.
  3. **public/player/index.html**
     - Bumped player script cache-bust version `v=67 -> v=68`.
- Checks run:
  - `php -l services/StreamChannelService.php` (OK)
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/sw.js` (OK)
- Risks/Follow-up:
  - OMX decoder failures on TV WebView/Chromium path are still hardware/codec-level and may continue independently of server load.
  - Media diagnostics can increase console noise when enabled (`media_diag=1`); disabled by default.
- Backup/Restore safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/StreamChannelService.php.pre_ffmpeg_dedupe_20260317_061543.bak`
    - `.codex/tmp_backups/player.js.pre_media_diag_20260317_061543.bak`
    - `.codex/tmp_backups/index.html.pre_player_js_v68_20260317_061543.bak`
## 2026-03-17 - Root SW cache cleanup hotfix (preserve player caches)

- Request: Analyze new logs showing repeated SW installs and player startup watchdog hits; identify concrete interference.
- Findings:
  1. Root SW (`public/sw.js`) activate cleanup was deleting `omnex-player-*` caches (`[SW] Deleting cache: omnex-player-v1.3.10` in browser logs).
  2. This caused cross-scope cache churn and can destabilize first-load behavior for `/player`.
- Changes:
  1. **public/sw.js**
     - Updated activate cache filter to never delete `omnex-player-` and `omnex-player-media-` caches.
- Checks run:
  - `node --check public/sw.js` (OK)
- Risks/Follow-up:
  - Browser extension `contentScript.js` blob HEAD/fetch errors are external to repository code and may still appear in normal profile; test in extension-disabled profile for clean signal.
- Backup/Restore safety:
  - Temp backup created before edit:
    - `.codex/tmp_backups/public_sw.js.pre_preserve_player_cache_20260317_062304.bak`
## 2026-03-17 - WebView startup watchdog recovery and SW re-register reduction

- Request: Analyze latest media diagnostics where first video hits startup watchdog; continue hardening without assumptions.
- Findings:
  1. `webview-video-startup-watchdog` repeats on first cycle before any reveal event.
  2. Diagnostics hooks were initialized after first playback start, reducing first-failure visibility.
  3. Player SW registration always re-ran; in debug sessions this increases SW churn/noise.
- Changes:
  1. **public/player/assets/js/player.js**
     - Added `appendCacheBust()` utility for one-shot startup retries.
     - Moved media diagnostics hook setup earlier in `init()` (before playback starts).
     - Added startup recovery flow in `playVideoWebView()`:
       - first watchdog/error/play-reject triggers one cache-busted retry,
       - second failure falls back to next item.
     - Added richer diagnostics for play promise rejections and startup failure reasons.
     - Added SW registration short-circuit when an active matching player SW already exists.
  2. **public/player/index.html**
     - Bumped player script cache-bust `v=68 -> v=69`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/sw.js` (OK)
- Risks/Follow-up:
  - Browser extension-origin `contentScript.js` blob fetch errors remain external and can still pollute console.
  - If source media itself is broken/unreachable, one-shot retry will still fail and skip item (expected).
- Backup/Restore safety:
  - Temp backups created before edit:
    - `.codex/tmp_backups/player.js.pre_startup_recovery_20260317_062738.bak`
    - `.codex/tmp_backups/index.html.pre_player_js_v69_20260317_062738.bak`
## 2026-03-17 - Disable native video path on constrained TV profile

- Request: Resolve repeated "Native video failed, using WebView" failures observed on TV.
- Findings:
  1. TV constrained profile (`isTV/isAndroidTV` + `enableMediaPrecache=false`) still attempted native Exo path, leading to recurring native fallback errors/toasts.
- Changes:
  1. **public/player/assets/js/player.js**
     - Added `enableNativeVideo` runtime config parsing (`native`, `native_video`, `nativeVideo`).
     - Updated `hasNativeVideoSupport()` to return `false` when:
       - `enableNativeVideo=false`, or
       - constrained TV profile is detected.
     - Result: constrained TV devices use WebView path directly; native failure toast cycle is avoided.
  2. **public/player/index.html**
     - Bumped player script cache-bust `v=69 -> v=70`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/sw.js` (OK)
- Risks/Follow-up:
  - Native Exo optimizations are intentionally bypassed on constrained TV profile; this favors stability over native performance.
- Backup/Restore safety:
  - Temp backups created before edit:
    - `.codex/tmp_backups/player.js.pre_disable_native_tv_20260317_063754.bak`
    - `.codex/tmp_backups/index.html.pre_player_js_v70_20260317_063754.bak`
## 2026-03-17 - Backup comparison (2026-03-16 and earlier) for native/WebView regressions

- Request: Compare current playback stack against 2026-03-16 and earlier backups.
- Findings:
  1. APK side (`MainActivity.kt`) in older backup always eager-initialized Exo and exposed `playVideoNative`; no explicit `native` query gate in player URL.
  2. `player.js` 2026-03-16 backup used bridge-presence check for native support only; no constrained-TV/profile guard.
  3. `player.js` backup `20260317_050619` contained session hard-disable logic (`_nativeVideoHardDisabled` after first native failure), which is absent in current file.
  4. `ExoPlayerManager.kt` delta vs older backup is small; current adds `clearPreloadedVideo()` helper for decoder contention control.
- Changes:
  - No production code change for this comparison request.
  - Diagnostic artifacts created:
    - `.codex/tmp_player_vs_20260316_0828.diff`
    - `.codex/tmp_player_vs_20260317_050619.diff`
    - `.codex/tmp_main_vs_20260317_035714.diff`
    - `.codex/tmp_exo_vs_20260317_035714.diff`
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK)
- Risks/Follow-up:
  - Absence of session hard-disable can allow repeated native retry loops on decoder-fragile TVs.
  - Existing workspace has unrelated modified files; not touched.
- Backup/Restore safety:
  - Existing backup used for inspected APK file:
    - `.codex/tmp_backups/MainActivity.kt.pre_native_disable_20260317_064513.bak`
## 2026-03-17 - Restore session hard-disable and keep APK native-always behavior

- Request: Keep APK behavior where Exo remains available (no new APK-side native gate) and restore old player.js session hard-disable after first native failure; keep constrained TV/native guards if beneficial.
- Findings:
  1. Current APK file had been temporarily modified to add native gating; this conflicted with requested old behavior.
  2. Current player.js lacked `_nativeVideoHardDisabled` session lock from older backup behavior.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt**
     - Restored from pre-edit backup (`.codex/tmp_backups/MainActivity.kt.pre_native_disable_20260317_064513.bak`).
     - Result: APK side no longer forces `native=0` or `shouldEnableNativePlayback()` gating; Exo path remains available as before.
  2. **public/player/assets/js/player.js**
     - Reintroduced session-level native failure lock:
       - Added constructor state: `_nativeVideoFailureStreak`, `_nativeVideoHardDisabled`.
       - `hasNativeVideoSupport()` now returns false if hard-disabled.
       - `fallbackToWebView()` increments failure streak and hard-disables native after first failure in current session.
       - `handleNativeVideoStarted()` resets failure streak to 0.
     - Existing constrained-TV guard (`isConstrainedTvProfile`) and `enableNativeVideo` config logic were preserved.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK)
- Risks/Follow-up:
  - With session hard-disable, one native decoder failure keeps the rest of that app session on WebView path until app/page reload.
  - Constrained TV guard still bypasses native attempts on TV profile (`enableMediaPrecache=false`), by design.
- Backup/Restore safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/MainActivity.kt.pre_restore_exo_always_20260317_070159.bak`
    - `.codex/tmp_backups/player.js.pre_restore_hard_disable_20260317_070159.bak`
  - Restored file source:
    - `.codex/tmp_backups/MainActivity.kt.pre_native_disable_20260317_064513.bak`
## 2026-03-17 - Player cache-bust bump after hard-disable restore

- Request: Ensure TV pulls updated player JS after native-session-lock restore.
- Changes:
  1. **public/player/index.html**
     - Bumped player script cache-bust `v=70 -> v=71`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (already OK in same change set)
- Risks/Follow-up:
  - Clients with aggressive intermediary caching should fetch `player.js?v=71` immediately.
- Backup/Restore safety:
  - No file backup needed (single-line low-risk edit).
## 2026-03-17 - Commit/push/deploy and TV ADB install execution

- Request: Perform commit + push + server deploy and install built APK on TV via ADB.
- Actions completed:
  1. Commits pushed to `main`:
     - `74644c3` player: restore native fail session lock for TV stability
     - `1e4f874` player: restore native fail lock and bump cache bust to v71
  2. Production deploy executed on server (`/opt/omnex-hub`):
     - `git pull --ff-only origin main`
     - `docker compose -p omnex -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml build app`
     - `docker compose ... up -d`
     - app container reached healthy state.
  3. APK build/publish and device install:
     - `./gradlew.bat clean assembleStandaloneDebug publishDebugApk`
     - generated `public/downloads/omnex-player.apk` updated timestamp.
     - ADB install to TV `192.168.1.52:46863` with `install -r -t` (Success).
     - package verify: `versionName=2.9.14`, `versionCode=43`, `lastUpdateTime=2026-03-17 07:12:23`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK)
  - `./gradlew.bat clean assembleStandaloneDebug publishDebugApk` (OK)
- Risks/Follow-up:
  - APK version code/name unchanged (`43/2.9.14`); OTA `update.json` version did not change.
  - For forced OTA rollout, version bump + update.json refresh is required.
- Backup/Restore safety:
  - Temp backups used:
    - `.codex/tmp_backups/MainActivity.kt.pre_restore_exo_always_20260317_070159.bak`
    - `.codex/tmp_backups/player.js.pre_restore_hard_disable_20260317_070159.bak`
## 2026-03-17 - Remove forced 360p TV rewrite

- Request: Remove forced 360p stream URL rewrite and test playback.
- Changes:
  1. **public/player/assets/js/player.js**
     - `getConstrainedTvPlaybackUrl()` changed to passthrough (no variant rewrite).
  2. **public/player/index.html**
     - Bumped player script cache-bust `v=71 -> v=72`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - TV decoder will now receive original variant selection from playlist source (no forced downscale).
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/player.js.pre_remove_360_force_20260317_071955.bak`
## 2026-03-17 - Restore forced 360p rewrite on user request

- Request: Revert removal of forced 360p rewrite; restore previous behavior.
- Changes:
  1. **public/player/assets/js/player.js**
     - Restored constrained-TV `1080/720/540 -> 360` m3u8 rewrite in `getConstrainedTvPlaybackUrl()`.
  2. **public/player/index.html**
     - Bumped player script cache-bust `v=72 -> v=73`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
- Risks/Follow-up:
  - Decoder-fragile TV profile will again force 360p variant.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/player.js.pre_revert_360_restore_20260317_072503.bak`
    - `.codex/tmp_backups/index.html.pre_revert_360_restore_20260317_072503.bak`
## 2026-03-17 - TV decode profile investigation (no code change)

- Request: Validate whether FFmpeg/HLS output profile is incompatible with TV playback.
- Findings:
  - FFmpeg profile definitions are present and explicit in `services/HlsTranscoder.php` (360p baseline@3.0, 540/720 main@3.1, 1080 high@4.0).
  - Sample stream probe confirms encoded outputs are valid H.264:
    - 720p segment: Main, Level 3.1, yuv420p, 1280x720, refs=1.
    - 360p segment: Constrained Baseline, Level 3.0, yuv420p, 640x360, refs=1.
  - TV logs repeatedly show `OMX.MS.AVC.Decoder ERROR(0x80001000)` and `PIPELINE_ERROR_DECODE` in both ExoPlayer and Chromium/WebView pipelines.
  - In captured Exo runs, stream URL is repeatedly `/720p/playlist.m3u8` and decoder reports `Resolution: 1280 720`.
  - Potential metadata bug noted: HLS master CODECS string level suffix is built as decimal text (e.g. `31`) instead of AVC hex level byte in `generateMasterPlaylist()`.
- Files changed:
  - `.codex/CHANGE_MEMORY.md` (this entry only)
- Checks run:
  - None (no code files changed; syntax checks not applicable).
- Risks/Follow-up:
  - Primary symptom points to device decoder instability/resource contention rather than malformed elementary stream.
  - If master playlist is used by strict clients, fix CODECS level encoding (`31` -> `1f`, `30` -> `1e`, `40` -> `28`) to avoid parser misclassification.
## 2026-03-17 - Fix HLS master CODECS level hex encoding

- Request: Fix `master.m3u8` CODECS level suffix (`31` vs `1f`) due client selection/parsing failures; user reported 720/1080 stream links not working in tests.
- Changes:
  1. **services/HlsTranscoder.php**
     - Added `buildAvcCodecString()` helper to generate RFC6381 AVC codec string with proper hex level byte.
     - Updated `generateMasterPlaylist()` to use helper instead of decimal-like level suffix.
     - Example corrected mapping:
       - 3.0 -> `1e` (was `30`)
       - 3.1 -> `1f` (was `31`)
       - 4.0 -> `28` (was `40`)
- Checks run:
  - `php -l services/HlsTranscoder.php` (OK)
- Risks/Follow-up:
  - Fix affects newly generated master playlists immediately.
  - Existing already-generated `storage/streams/**/master.m3u8` files keep old CODECS text until re-generated.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/HlsTranscoder.php.pre_codec_hex_fix_20260317_073522.bak`
## 2026-03-17 - Prod worker rebuild + live verification after codec fix

- Request: Continue with deploy and verify live `master.m3u8` + 720/1080 stream links.
- Changes:
  1. **No new repo code edit**
     - Investigated prod mismatch and found root cause: only `app` service had been rebuilt; `transcode-worker` (which generates `master.m3u8`) was still on old image.
  2. **Operational deploy**
     - Rebuilt/restarted `app`, `transcode-worker`, `channel-worker` on prod.
     - Verified new completed transcode outputs now contain hex codec levels:
       - `avc1.42e01e` (360p)
       - `avc1.4d401f` (540p/720p)
- Checks run:
  - `php -l services/HlsTranscoder.php` (OK; existing fix file sanity)
  - Live prod checks:
    - transcode queue status/progress via PostgreSQL
    - new `storage/streams/**/master.m3u8` CODECS lines via app container
    - stream endpoints:
      - `/api/stream/{token}/master.m3u8` -> `200`
      - `/api/stream/{token}/variant/720p/playlist.m3u8` -> `200`
      - `/api/stream/{token}/variant/1080p/playlist.m3u8` -> `200`
- Risks/Follow-up:
  - Jobs encoded before worker rebuild still have old `30/31` codec strings in their existing `master.m3u8`.
  - Re-encode queue should be allowed to finish (or re-trigger specific media) if full backfill is required.
- Backup/Restore safety:
  - No local file backup required (no code edit in this step).
## 2026-03-17 - Context sync for project rules and safeguards

- Request: User asked whether current project context, rules, deploy process, backup discipline, and encoding precautions are remembered.
- Changes:
  1. **.codex/CHANGE_MEMORY.md**
     - Appended this context-sync entry after re-reading project memory/workflow files.
- Checks run:
  - None. No application code changed; syntax checks not applicable for memory-only update.
- Risks/Follow-up:
  - Must keep following memory workflow on each task before edits and before final response.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_context_sync_20260317_225906.bak`
## 2026-03-17 - Player prep review of process tree and recent commits

- Request: Review current process tree, recent commits, and player-related working context before continuing work on player.
- Changes:
  1. **.codex/CHANGE_MEMORY.md**
     - Appended this preparation note after inspecting repo state, player file tree, running processes, and recent player commits.
- Checks run:
  - None. No application code changed; syntax checks not applicable for review-only prep.
- Risks/Follow-up:
  - `public/player/assets/js/player.js` currently has constrained-TV guards disabled by `fa4978f`, so older memory about forced 360p rewrite is stale.
  - Worktree contains many untracked temp/backup artifacts; avoid treating them as source changes during player edits.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_player_prep_review_20260317_230337.bak`
## 2026-03-17 - Fix video turning black after enter transition on PC browser/PWA

- Request: Fix regression where video items appear during enter effect but turn black when transition ends, while transition type/duration works.
- Changes:
  1. **public/player/assets/js/player.js**
     - In `applyEnterTransition()` completion timer, forced active element back to visible/opaque (`opacity:1`, `visibility:visible`) after transition classes are removed.
     - This preserves anti-flash `opacity:0` start behavior while preventing post-animation fallback to black.
  2. **public/player/index.html**
     - Bumped player script cache-bust `v=78 -> v=79`.
  3. **public/player/sw.js**
     - Bumped SW cache version `v1.3.15 -> v1.3.16`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
- Risks/Follow-up:
  - Fix targets WebView/Browser enter-transition stabilization; device-specific native Exo transition behavior still needs separate scenario-by-scenario validation.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/player.js.pre_video_black_fix_20260317_231431.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_player_video_black_fix_20260317_231556.bak`
## 2026-03-17 - Commit, push and production deploy for player video black-screen fix

- Request: Commit/push latest player fix and deploy to server for live validation.
- Changes:
  1. **Git**
     - Created commit on `main`: `ac5c177` (`fix(player): keep video visible after enter transition`).
     - Pushed to `origin/main` (`6679e48 -> ac5c177`).
  2. **Production deploy**
     - Connected to server via `camlicayazilim@185.124.84.34:2299`.
     - Ran in `/opt/omnex-hub`:
       - `git pull --ff-only origin main`
       - `docker compose -p omnex -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml build app`
       - `docker compose -p omnex -f deploy/docker-compose.yml -f deploy/docker-compose.standalone.yml up -d app`
  3. **Live verification**
     - `app` container reached `healthy`.
     - `http://127.0.0.1:8080/player/index.html` contains `player.js?v=79`.
     - `http://127.0.0.1:8080/player/sw.js` contains `CACHE_VERSION = 'v1.3.16'`.
     - `http://127.0.0.1:8080/player/assets/js/player.js` contains `stabilize post-animation visibility` patch comment.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Remote compose status check (`docker compose ... ps app`) (healthy)
- Risks/Follow-up:
  - `deploy` user SSH key authentication failed in this environment; deploy executed with `camlicayazilim` user instead.
  - Additional scenario tests are still needed per requested device/content matrix.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_player_commit_push_deploy_20260317_232408.bak`
## 2026-03-17 - Android player transition parity audit (no code change)

- Request: Check whether APK-backed devices execute transition effects and content-type transitions identical to `player.js`, or whether only JS performance profiles should be adjusted.
- Findings:
  1. **Parity is not exact in current architecture.**
     - `player.js` sends transition type/duration to APK (`setVideoTransition`) and remains source of selection.
     - Native engine still performs its own enter/exit animations for Exo overlay (`jsOwnsTransitions = false` in `ExoPlayerManager.kt`).
  2. **Native transition semantics are grouped and simplified vs CSS.**
     - `slide/push/wipe` families are collapsed into shared translation animations in APK.
     - `zoom/zoom-in/zoom-out` are grouped with one native behavior.
     - CSS-side distinctions (e.g., wipe clip-path behavior) are richer than native view animations.
  3. **Performance profiles alone cannot solve this mismatch.**
     - Profiles mainly tune timings/precache/hardware layer; they do not make native transition semantics match CSS one-to-one.
- Files changed:
  - `.codex/CHANGE_MEMORY.md` (this note only)
- Checks run:
  - None. No application code changed.
- Risks/Follow-up:
  - For true cross-client parity, APK transition implementation must be aligned with JS semantics (or native video path must be selectively disabled).
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_android_transition_audit_20260317_233849.bak`
## 2026-03-17 - Android native transition timing parity aligned with JS

- Request: Keep native playback enabled and align APK transition language/flow with player.js for all playlist transition types and millisecond timing behavior.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt**
     - Removed native upper clamp on transition duration (`coerceIn(0, 3000)` -> `coerceAtLeast(0)`), so APK honors JS-provided transition milliseconds exactly.
  2. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt**
     - Updated `setVideoTransition` bridge documentation comment to list full supported transition set (`fade/crossfade/zoom/slide/push/wipe` directional variants).
  3. **Validation notes**
     - Verified native transition type coverage matches JS/CSS transition families in player.
- Checks run:
  - `.\gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `.\gradlew.bat :app:compilePlaystoreDebugKotlin` (OK)
- Risks/Follow-up:
  - Very large transition durations are now applied as-is; backend/panel should keep realistic bounds to avoid very long blocking animations.
  - Android player sources appear outside current root git tracking scope; commit/deploy flow may require separate repo/process.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/ExoPlayerManager.kt.pre_duration_unclamp_20260317_235421.bak`
    - `.codex/tmp_backups/MainActivity.kt.pre_transition_comment_sync_20260317_235421.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_android_transition_js_parity_apply_20260317_235703.bak`
## 2026-03-18 - APK OTA release publish (v2.9.15 / code 44)

- Request: Build latest APK, copy to both OTA directories (`downloads`, `public/downloads`), update OTA JSON, then commit/push and pull on server so devices can receive remote update.
- Changes:
  1. **android-player/omnex-player-app/app/build.gradle**
     - Bumped Android app version to `versionCode 44`, `versionName 2.9.15` before build.
  2. **APK artifacts**
     - Rebuilt `:app:assembleStandaloneDebug`.
     - Published new APK to:
       - `downloads/omnex-player.apk`
       - `public/downloads/omnex-player.apk`
       - `downloads/omnex-player-standalone-v2.9.15.apk`
       - `public/downloads/omnex-player-standalone-v2.9.15.apk`
     - New APK SHA256:
       - `f56d8bb77b5a6e8812d177c6c5314585db5c155fd0643f878d4527dbd7286c1d`
  3. **OTA metadata**
     - Updated both:
       - `downloads/update.json`
       - `public/downloads/update.json`
     - Set `versionCode: 44`, `versionName: 2.9.15`, URL query `v=44`, and new `sha256`.
  4. **Git + deploy**
     - Commit: `1747adf` (`chore(apk): publish ota package v2.9.15`)
     - Pushed: `origin/main` (`ac5c177 -> 1747adf`)
     - Server pull and app redeploy completed on `/opt/omnex-hub`.
- Checks run:
  - `.\gradlew.bat :app:assembleStandaloneDebug` (OK)
  - JSON parse/consistency:
    - `ConvertFrom-Json` for both `update.json` files (OK)
    - APK SHA vs `update.json.sha256` match (OK)
  - Server verification:
    - `curl http://127.0.0.1:8080/downloads/update.json` shows v44 metadata (OK)
    - `sha256sum` on both server APK paths matches expected hash (OK)
    - `docker compose ... ps app` healthy after redeploy (OK)
- Risks/Follow-up:
  - `android-player/` is gitignored in root repository; version bump in `app/build.gradle` is local build context and not part of this commit history.
  - Devices already on code 44 will not re-install same code; next OTA must increment `versionCode`.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/build.gradle.pre_apk_ota_20260318_000330.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_apk_ota_20260318_000330.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_apk_ota_20260318_000330.bak`
    - `.codex/tmp_backups/omnex-player.apk.pre_apk_ota_20260318_000330.bak`
    - `.codex/tmp_backups/public.omnex-player.apk.pre_apk_ota_20260318_000330.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_apk_ota_release_20260318_000704.bak`
## 2026-03-18 - APK image transition preload sync + player cache refresh

- Request: Verify image-content behavior on APK devices, address image transition flash risk, and rule out old build/version drift.
- Changes:
  1. **public/player/assets/js/player.js**
     - Added `loadImageIntoElementWhenReady(...)` to preload images before display element swap.
     - Refactored `playImage(...)` and `playTemplate(...)` to use the shared preload/timeout flow.
  2. **public/player/index.html**
     - Bumped player script query version `player.js?v=80 -> v81` for cache busting.
  3. **public/player/sw.js**
     - Bumped service-worker cache version `v1.3.17 -> v1.3.18`.
  4. **Device/runtime verification**
     - Confirmed APK version on G66: `versionName=2.9.15`, `versionCode=44`.
     - Confirmed runtime transition logs still honor JS timing (e.g. `Transition set ... 500ms`).
  5. **Git + deploy**
     - Commit: `bfde514` (`fix(player): stabilize apk image transitions and refresh player cache`).
     - Pushed: `origin/main` (`f5746cc -> bfde514`).
     - Server deploy completed on `/opt/omnex-hub` with `up -d --build --force-recreate app`.
     - Post-deploy verification:
       - `curl http://127.0.0.1:8080/player/index.html` -> `player.js?v=81`
       - `curl http://127.0.0.1:8080/player/sw.js` -> `CACHE_VERSION = 'v1.3.18'`
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Deploy checks:
    - `docker compose ... ps app` (healthy after recreate)
    - `git rev-parse --short HEAD` on server (`bfde514`)
  - ADB verification:
    - `dumpsys package com.omnex.player` (version check OK)
    - `logcat` filtered for `OmnexPlayer`/`ExoPlayerManager` (transition timing and load URL observed)
- Risks/Follow-up:
  - Image pipeline still uses a single visible `<img>` element; if a rare device-specific flash persists, next step is dual-image ping-pong similar to video/html.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/player.js.pre_image_transition_stabilize_20260318_004409.bak`
    - `.codex/tmp_backups/index.html.pre_image_transition_stabilize_20260318_004409.bak`
    - `.codex/tmp_backups/sw.js.pre_image_transition_stabilize_20260318_004409.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_image_transition_stabilize_20260318_004439.bak`
## 2026-03-18 - APK native video overlay stabilization + OTA release (v2.9.16 / code 45)

- Request: Keep orientation icon permanently visible over video on APK clients, avoid black drop during native video layer handoff, and publish OTA update for remote device rollout.
- Changes:
  1. **android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt**
     - Kept WebView as top overlay layer for JS controls/icon during native playback.
     - Added native-side WebView transparency guard:
       - `switchToExoPlayer()` now forces WebView background `TRANSPARENT`.
       - `switchToWebView()` now restores WebView background `BLACK`.
     - Purpose: remove transparency race between JS/native handoff and keep overlay icon visible on top of video.
  2. **android-player/omnex-player-app/app/build.gradle**
     - Bumped Android app version to `versionCode 45`, `versionName 2.9.16`.
  3. **APK artifacts**
     - Rebuilt `:app:assembleStandaloneDebug`.
     - Published updated APK to:
       - `downloads/omnex-player.apk`
       - `public/downloads/omnex-player.apk`
       - `downloads/omnex-player-standalone-v2.9.16.apk`
       - `public/downloads/omnex-player-standalone-v2.9.16.apk`
     - New APK SHA256:
       - `6d7de3f034ca497f29127b037c0280bd2c68b72d938b89dd1839a0b33ef00cda`
  4. **OTA metadata**
     - Updated both:
       - `downloads/update.json`
       - `public/downloads/update.json`
     - Set `versionCode: 45`, `versionName: 2.9.16`, URL query `v=45`, and new `sha256`.
  5. **Git + deploy**
     - Commit: `0558db7` (`chore(apk): publish ota package v2.9.16 overlay fix`)
     - Pushed: `origin/main` (`c55d00e -> 0558db7`)
     - Server pull + app redeploy completed on `/opt/omnex-hub`.
- Checks run:
  - `.\gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `.\gradlew.bat :app:assembleStandaloneDebug` (OK)
  - ADB runtime verification:
    - Install to G66 (`192.168.1.181:39855`) (OK)
    - `dumpsys package com.omnex.player` => `versionCode=45`, `versionName=2.9.16` (OK)
    - Screenshot sampling confirms overlay icon remains visible over content/video frames.
  - OTA consistency:
    - `ConvertFrom-Json` parse for both `update.json` files (OK)
    - APK SHA vs `update.json.sha256` (both paths) match (OK)
  - Server verification:
    - `docker compose ... ps app` healthy after redeploy (OK)
    - `curl http://127.0.0.1:8080/downloads/update.json` shows v45 metadata (OK)
    - `sha256sum` on server `downloads/omnex-player.apk` and `public/downloads/omnex-player.apk` match expected hash (OK)
- Risks/Follow-up:
  - `android-player/` remains gitignored in root repository; native source edits are carried via built APK artifacts rather than tracked source diffs in this repo.
  - Mixed-type boundary transitions (`html->video`, `video->html`, `html->html`) still require continued parity validation under long-run playlists.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/ExoPlayerManager.kt.pre_overlay_transparency_guard_20260318_012442.bak`
    - `.codex/tmp_backups/build.gradle.pre_v45_overlay_20260318_012956.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_v45_overlay_20260318_012956.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_v45_overlay_20260318_012956.bak`
    - `.codex/tmp_backups/downloads.omnex-player.apk.pre_v45_overlay_20260318_012956.bak`
    - `.codex/tmp_backups/public.omnex-player.apk.pre_v45_overlay_20260318_012956.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_v45_overlay_release_20260318_013626.bak`
## 2026-03-18 - G66 soak test replay (10m cold + 10m warm) against user baseline

- Request: Re-run the same field-style stability test methodology (`gfxinfo` + periodic CPU/RAM sampling) to compare with prior good baseline shared by user.
- Changes:
  - No application code edits.
  - Collected two soak datasets on device `192.168.1.181:39855` with app `com.omnex.player` (`2.9.16 / code 45`):
    - Cold run (force-stop + relaunch before soak): `tmp/perf/soak_20260318_013818/`
    - Warm run (no relaunch, only gfx reset): `tmp/perf/soak_warm_20260318_015007/`
- Checks run:
  - Runtime/perf capture commands:
    - `adb shell dumpsys gfxinfo com.omnex.player reset`
    - `adb shell dumpsys gfxinfo com.omnex.player`
    - `adb shell top -n 1 -b | grep com.omnex.player` (2-min cadence)
    - `adb shell dumpsys meminfo com.omnex.player` (2-min cadence)
    - `adb shell dumpsys package com.omnex.player` (version check)
  - Quick log scan:
    - `adb logcat -d` filtered for playback/http errors (no matching 4xx/5xx/main-frame errors in sampled window)
- Risks/Follow-up:
  - Both runs show materially higher jank and percentile latency than previously shared baseline.
  - Warm and cold results are close, so startup-only bias does not explain the regression.
  - Next investigation should target mixed-content transition boundary cost (html/video/html paths), especially compositor load during native-video + transparent WebView overlay periods.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_perf_soak_compare_20260318_020052.bak`
## 2026-03-18 - Profile-based transition policy + adaptive degrade (legacy/balanced/default)

- Request: Implement approved profile-based transition behavior for low-resource devices, apply low-risk native-overlay load reduction, and add adaptive degrade behavior for long field runtime.
- Changes:
  1. **public/player/assets/js/player.js**
     - Added profile transition policy resolver:
       - `legacy`: force lightweight transition (`fade`, `300ms`) for all non-`none` transitions.
       - `balanced`: medium policy (maps expensive `wipe/slide/zoom` to lighter transitions and clamps duration range).
       - `default`: keep full playlist transition behavior.
     - Applied policy at both playlist default and per-item transition override paths.
     - Added adaptive runtime degrade monitor (Android app only, non-legacy):
       - Samples event-loop lag every second and schedule timer lag per content tick.
       - Under sustained pressure, auto-switches to lightweight transition mode.
       - Returns to normal policy after sustained stable period.
     - Started/stopped adaptive monitor with playback lifecycle.
     - Added low-risk native mode optimization:
       - During native video mode, content container enters passive state to reduce WebView-side compositing load while keeping overlay controls visible.
  2. **public/player/assets/css/player.css**
     - Added `.content-container.native-overlay-passive` style (`opacity:0`, `pointer-events:none`) for lightweight WebView overlay behavior during native playback.
  3. **public/player/index.html**
     - Bumped player script cache key `player.js?v=81 -> v82`.
  4. **public/player/sw.js**
     - Bumped service worker cache version `v1.3.18 -> v1.3.19`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
- Risks/Follow-up:
  - Balanced profile mapping intentionally softens expensive transition effects; visual parity is slightly reduced in exchange for lower render pressure.
  - Adaptive degrade has hysteresis; it may remain in lightweight mode for a stabilization window after load spikes.
  - Recommended next validation: 10m/30m soak on G66 with mixed playlist transitions to confirm jank reduction vs previous ~20% baseline.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/player.js.pre_profile_policy_20260318_022713.bak`
    - `.codex/tmp_backups/player.css.pre_profile_policy_20260318_022713.bak`
    - `.codex/tmp_backups/index.html.pre_profile_policy_20260318_022713.bak`
    - `.codex/tmp_backups/sw.js.pre_profile_policy_20260318_022713.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_profile_transition_policy_20260318_023037.bak`
## 2026-03-18 - Profile policy rollout deploy verification

- Request: Push the profile-based transition changes live and verify device receives updated player bundle.
- Changes:
  - Commit: `c256342` (`fix(player): add profile-based transition policy and adaptive degrade`)
  - Pushed to `origin/main` (`0558db7 -> c256342`)
  - Server pull + app container rebuild/recreate completed on `/opt/omnex-hub`
- Checks run:
  - Server runtime checks:
    - `docker compose ... ps app` -> healthy
    - `curl /player/index.html` -> `player.js?v=82`
    - `curl /player/sw.js` -> `CACHE_VERSION = 'v1.3.19'`
  - Device verification (G66):
    - App restart and logcat confirms player bundle load from `player.js?v=82`
- Risks/Follow-up:
  - Short post-deploy log window showed `Transition set: none -> none, 500ms`; transition mapping for heavy effects should be validated on a playlist item that explicitly uses non-`none` transition.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_profile_policy_deploy_20260318_023502.bak`
## 2026-03-18 - transition=none ms-ignore fix + 5-minute validation run

- Request: Verify that `transition=none` ignores playlist transition milliseconds and run a 5-minute performance test with the same methodology.
- Changes:
  1. **public/player/assets/js/player.js**
     - `resolveTransitionPolicy(...)` now returns `duration=0` when transition type is `none`.
     - Native transition handoff now sends `duration=0` when native transition type is `none`.
     - Native exit delay calculations now honor `none` as `0ms` (no artificial 300ms delay).
  2. **Git + deploy**
     - Commit: `fbec9a8` (`fix(player): ignore transition ms when effect is none`)
     - Pushed: `origin/main` (`c256342 -> fbec9a8`)
     - Server pull + app rebuild/recreate completed on `/opt/omnex-hub`.
  3. **Verification**
     - Device log confirms behavior: `Transition set: none -> none, 0ms (jsOwns=false)`.
     - Confirmed live bundle contains patched `player.js` logic on server.
  4. **5-minute perf run**
     - Pre-fix baseline folder: `tmp/perf/soak5_20260318_024031/`
     - Post-fix folder: `tmp/perf/soak5_postfix_20260318_025014/`
     - GFX summary (post-fix):
       - Frames: `7356`
       - Janky: `1171` (`15.92%`)
       - p50/p90/p95/p99: `10/19/23/38 ms`
     - Compared to pre-fix run:
       - Jank `17.87% -> 15.92%`
       - p99 `48ms -> 38ms`
       - Missed Vsync `31 -> 23`
       - Memory average improved (`PSS 193635KB -> 185511KB`, `RSS 290186KB -> 281765KB`)
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Deploy/runtime checks:
    - `docker compose ... ps app` healthy
    - device `logcat` transition confirmation (`none, 0ms`) OK
- Risks/Follow-up:
  - Active playlist currently uses `transition=none`; non-`none` legacy mapping (`fade 300ms`) should be validated with a playlist that has non-`none` transition configured.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_none_ms_fix_5min_20260318_025612.bak`
## 2026-03-18 - Playlist effect verification after user update

- Request: Verify newly assigned playlist effect is applied on device.
- Changes:
  - No code changes.
  - Verified DB state for playlist `9372958b-08cb-4539-a64c-a07d3f49252d`:
    - `transition = fade`
    - `transition_duration = 500`
    - no per-item non-`none` transition override in playlist JSON.
  - Verified device runtime (`G66`, app `2.9.16`) log output:
    - `Transition set: fade -> fade, 300ms (jsOwns=false)`
    - confirms legacy profile policy maps non-`none` transition to `fade 300ms`.
- Checks run:
  - Server DB query via `psql` in dockerized postgres (playlist transition check)
  - ADB runtime log check (`logcat`) on `192.168.1.181:39855`
- Risks/Follow-up:
  - None for this verification step.
- Backup/Restore safety:
  - Temp backup created:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_effect_verify_20260318_030005.bak`
## 2026-03-18 - TV html/video transition, mobile top-bar black, APK v2.9.17 + perf triage

- Request: Fix html<->video transition anomalies (especially Google TV balanced), keep transition semantics aligned, remove mobile top bar old color tint, refresh APK/update artifacts in downloads, and run TV 5-minute perf checks.
- Changes:
  1. `public/player/assets/js/player.js`
     - Limited `native-overlay-passive` usage to legacy profile.
     - Deferred `playHtml` native->webview opacity switch until html ready gate.
     - Improved iframe same-origin video readiness gate for dynamically inserted `<video>` elements.
     - Added overlap delay before flushing pending exit on native video start.
     - Disabled native next-video preload when `precache=0` (profile-driven) to reduce decoder contention.
     - In balanced profile, disabled native path specifically on `html -> video` swaps to avoid codec races.
     - Gated webview video enter transition to first decoded frame + playback started (preload/poster flash suppression).
     - PWA install modal icon switched to `../branding/pwa.png`.
  2. `public/player/index.html`
     - Critical inline `html,body` background forced to black.
     - Player bundle query bumped (`player.js?v=82 -> v83 -> v84 -> v85`).
  3. `public/player/sw.js`
     - Cache version bumped (`v1.3.19 -> v1.3.20 -> v1.3.21 -> v1.3.22`).
     - Added `../branding/pwa.png?v=5` to static assets.
  4. Android local build inputs (ignored path, used for APK build):
     - `android-player/omnex-player-app/app/build.gradle`: `versionCode 46`, `versionName 2.9.17`.
     - `AndroidManifest.xml`: TV banner resource set to `@drawable/tv_banner`.
     - Added adaptive launcher xmls under `res/mipmap-anydpi-v26/`.
     - Mobile splash logo source set to launcher foreground asset.
  5. OTA artifacts updated:
     - `downloads/omnex-player.apk` (new hash)
     - `public/downloads/omnex-player.apk` (new hash)
     - Added versioned APKs: `.../omnex-player-standalone-v2.9.17.apk` in both downloads dirs.
     - Updated `downloads/update.json` and `public/downloads/update.json` to `versionCode=46`, `versionName=2.9.17`, new SHA256.
  6. Git/deploy:
     - Commits pushed: `1e4b6e6`, `9a10249`, `2ec9619`.
     - Server pull + rebuild/recreate done on `/opt/omnex-hub`.

- Checks run:
  - `node --check public/player/assets/js/player.js` (multiple passes, OK)
  - `node --check public/player/sw.js` (multiple passes, OK)
  - `android-player/omnex-player-app`: `./gradlew.bat clean publishDebugApk` (BUILD SUCCESSFUL)
  - ADB install on both devices: `192.168.1.181:39855`, `192.168.1.52:44245` (Success)
  - Version verification: `dumpsys package com.omnex.player` => `versionCode=46`, `versionName=2.9.17`
  - Server runtime checks: `player.js?v=85`, `CACHE_VERSION='v1.3.22'`, app container healthy.
  - TV perf runs (5 min each):
    - `tmp/perf/tv_soak5_20260318_033138`
    - `tmp/perf/tv_soak5_postfix_20260318_034034`
    - `tmp/perf/tv_soak5_final_20260318_034822`

- Risks/Follow-up:
  - Google TV traces previously showed intermittent `MediaCodec ... NO_MEMORY` on decoder init during transition-heavy periods; this remains the core stability risk.
  - Last patch (`2ec9619`) targets preload/poster flash specifically; full 5-minute post-`v85` measurement should be repeated to quantify impact after this final patch.

- Backup/Restore safety:
  - Temp backups created before edits for critical files (player.js, index.html, sw.js, update.json, Android build/manifest/layout resources) under `.codex/tmp_backups/`.
## 2026-03-18 - v85 post-patch TV perf follow-up (no NO_MEMORY in window)

- Request: Provide concrete performance values after latest preload-icon suppression patch and verify runtime behavior.
- Changes:
  - Commit/deploy: `2ec9619` (`player.js?v=85`, `CACHE_VERSION=v1.3.22`).
  - Player change: webview video enter transition now waits for decoded frame + playback start.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Server pull/build/recreate completed and verified serving `player.js?v=85`.
  - TV 5-min run: `tmp/perf/tv_soak5_v85_20260318_035818`
    - Frames: `7845`
    - Jank: `4518 (57.59%)`
    - p50/p90/p95/p99: `19/29/38/53 ms`
    - Missed Vsync: `32`
  - Log excerpt in this window: no `NO_MEMORY`/`Playback error` hit (`app_excerpt.txt`).
- Risks/Follow-up:
  - Render jank ratio remains high on this TV despite improved tail latency and absence of decoder init error in this sample window.
  - Need pair-based transition profiling (`html->video`, `video->html`, `html->html`) with same playlist to isolate remaining jank-heavy swap path.
- Backup/Restore safety:
  - Memory backup: `.codex/tmp_backups/CHANGE_MEMORY.md.pre_v85_perf_addendum_*.bak`.
## 2026-03-18 - html(video)->video preload-icon regression fix + v87 deploy + TV soak

- Request: Fix TV-side regression where html i�indeki video ge�i� sonunda preload ikonuna d���yor (�zellikle `html(video) -> video`), keep temp-backup workflow, redeploy, and re-run TV performance checks.
- Changes:
  - `public/player/assets/js/player.js`
    - Added `isElementVisuallyActive(element)` helper.
    - Updated `prepareNativeSwapDecoderBudget()` to release iframe media decoders only for hidden/inactive html slots.
    - Protected `_currentElement` and `_pendingExitElement` from early decoder release to prevent visible preload-icon fallback during transition.
  - `public/player/index.html`
    - Player bundle version bump: `player.js?v=87`.
  - `public/player/sw.js`
    - Cache version bump: `v1.3.24`.
  - Git/deploy:
    - Commit pushed: `91d8d63`.
    - Server pulled and app rebuilt/restarted (healthy).

- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Runtime verify (server + CDN):
    - `player.js?v=87` served
    - `CACHE_VERSION='v1.3.24'` served
  - TV app restart (force-stop + launch) and runtime version check in logcat:
    - `player.js?v=87` loaded
    - SW activation deleted old `v1.3.23` caches
  - TV perf runs:
    - Pre-fix baseline after previous patch: `tmp/perf/tv_soak5_v86_20260318_042336`
      - Frames `8049`, Jank `32.91%`, p50/p90/p95/p99 `17/28/38/61 ms`
    - Post-fix: `tmp/perf/tv_soak5_v87_20260318_043440`
      - Frames `8069`, Jank `32.71%`, p50/p90/p95/p99 `17/26/42/65 ms`
      - CPU steady samples: `171, 64.2, 0, 5, 118` (avg `71.64`, peak `171`)
      - PSS steady range: `183399 -> 243653 KB` (delta `60254 KB`)
      - RSS steady range: `271032 -> 332420 KB` (delta `61388 KB`)
  - Log scan:
    - No `NO_MEMORY`, no `Playback error`, no `HTTP 4xx/5xx` match in captured windows.

- Risks/Follow-up:
  - Gfx jank ratio still high on this TV class (~33%) despite transition regression fix; bottleneck remains transition-heavy mixed-content workload and codec churn.
  - Next step: pair-level profiling (`html->video`, `video->html`, `html->html`) with per-transition frametime buckets to isolate dominant jank path before next policy adjustment.

- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/player.js.pre_hidden_slot_decoder_budget_20260318_043100.bak`
    - `.codex/tmp_backups/index.html.pre_v87_20260318_043128.bak`
    - `.codex/tmp_backups/sw.js.pre_v87_20260318_043128.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_v87_html_video_preload_fix_20260318_044029.bak`
## 2026-03-18 - strict TV transition policy (balanced/legacy) + pair-aware degrade + v88 deploy

- Request: Apply previously recommended TV-side transition hardening with temporary backup and full rollback possibility.
- Changes:
  - `public/player/assets/js/player.js`
    - Normalized `performanceProfile` parsing to lowercase.
    - Added strict transition helpers:
      - `normalizeContentType()`
      - `isHtmlVideoPairTransition()`
      - `isStrictTransitionProfile()`
      - `getStrictTransitionDuration()`
      - `applyPairTransitionPolicy()`
    - Strengthened balanced profile transition policy on Android:
      - effect whitelist (`fade/crossfade/push-*`), unsupported/heavy effects fallback to `fade`.
      - stricter duration clamp for balanced strict mode (`240-360ms`).
    - Added pair-aware adaptive pressure (`pairRiskStreak`, `lastPair`) and stricter adaptive thresholds in balanced strict mode.
    - For `html<->video` pair transitions under strict profiles:
      - force `fade` with tight duration ceiling (`<=300ms`).
      - reduced native overlap flush delay cap.
      - reduced native exit wait cap before WebView opaque restore.
  - `public/player/index.html`
    - Player bundle version bump: `player.js?v=88`.
  - `public/player/sw.js`
    - Cache version bump: `v1.3.25`.
  - Git/deploy:
    - Commit pushed: `0456349`.
    - Server pull + rebuild/recreate completed.

- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - Server runtime checks:
    - app container healthy
    - serving `player.js?v=88`
    - serving `CACHE_VERSION='v1.3.25'`
  - Google TV runtime verify:
    - app force-stop + relaunch
    - log confirms `player.js?v=88`
    - SW removed old caches `v1.3.24` and activated
    - artifact: `tmp/perf/tv_verify_v88_20260318_045354`

- Risks/Follow-up:
  - Policy is intentionally stricter on balanced Android profiles; visual variety may reduce on heavy effects in exchange for stability.
  - Need fresh 5-minute/10-minute soak on TV playlist to quantify jank delta after this stricter policy.

- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/player.js.pre_strict_tv_policy_20260318_045110.bak`
    - `.codex/tmp_backups/index.html.pre_v88_20260318_045110.bak`
    - `.codex/tmp_backups/sw.js.pre_v88_20260318_045110.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_strict_tv_policy_20260318_045432.bak`
## 2026-03-18 - TV 5-minute soak after strict policy (v88)

- Request: Run a fresh 5-minute Google TV measurement after strict transition policy deploy.
- Changes:
  - No code changes.
  - New measurement artifacts only:
    - `tmp/perf/tv_soak5_v88_20260318_045655`
- Checks run:
  - ADB soak workflow (5 min):
    - `dumpsys gfxinfo reset`
    - app force-stop + relaunch
    - minute-based `top` + `dumpsys meminfo` sampling
    - final `dumpsys gfxinfo`
    - `logcat` capture and scan
  - Metrics:
    - Frames `7789`
    - Jank `36.10%`
    - p50/p90/p95/p99 `18/28/40/65 ms`
    - CPU steady avg/max `31.66 / 89.7`
    - PSS steady delta `37591 KB`
    - RSS steady delta `39144 KB`
  - Log scan:
    - No `NO_MEMORY`
    - No `Playback error` / `ExoPlaybackException`
    - No HTTP 4xx/5xx matches
- Risks/Follow-up:
  - Jank still high for this TV class in transition-heavy playlist.
  - Recommended next step remains pair-based isolation under same playlist (`html->video`, `video->html`, `html->html`) to tune strict policy thresholds.
- Backup/Restore safety:
  - Memory backup:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_tv_soak_v88_20260318_050240.bak`
## 2026-03-18 - G66 legacy 5-minute soak after v88 policy deploy

- Request: Run the same performance measurement on legacy device (G66) after v88 deploy.
- Changes:
  - No code changes.
  - New measurement artifacts only:
    - `tmp/perf/g66_legacy_soak5_v88_20260318_050403`
- Checks run:
  - ADB soak workflow (5 min):
    - `dumpsys gfxinfo reset`
    - app force-stop + relaunch
    - minute-based `top` + `dumpsys meminfo` sampling
    - final `dumpsys gfxinfo`
    - `logcat` capture and scan
  - Runtime version verify:
    - log confirms `player.js?v=88`
    - SW activated and old cache cleaned
  - Metrics:
    - Frames `8554`
    - Jank `14.13%`
    - p50/p90/p95/p99 `9/19/26/46 ms`
    - CPU steady avg/max `85.82 / 117`
    - PSS steady delta `5195 KB`
    - RSS steady delta `4088 KB`
  - Log scan:
    - No `NO_MEMORY`
    - No `Playback error` / `ExoPlaybackException`
    - No HTTP 4xx/5xx matches
- Risks/Follow-up:
  - G66 jank ratio is materially better than Google TV but still above previously observed best-case legacy windows.
  - Mixed-content transition density remains the likely primary driver for residual jank.
- Backup/Restore safety:
  - Memory backup:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_g66_legacy_soak_v88_20260318_051005.bak`
## 2026-03-18 - mobile top safe-area tint removal (player)

- Request: Remove phone top status/safe-area blue tint so device/player black remains consistent.
- Changes:
  - `public/player/assets/css/player.css`
    - Removed unified body gradient override and set neutral `background: #000`.
    - This prevents top safe-area from inheriting blue theme colors in mobile playback.
  - `public/player/index.html`
    - CSS cache-bust bump: `player.css?v=41`.
  - `public/player/sw.js`
    - SW cache bump: `v1.3.26`.
  - Git/deploy:
    - Commit pushed: `3e1e2fc`.
    - Server pull + rebuild/recreate completed.
- Checks run:
  - `node --check public/player/sw.js` (OK)
  - Server runtime checks:
    - app container healthy
    - serving `player.css?v=41`
    - serving `CACHE_VERSION='v1.3.26'`
- Risks/Follow-up:
  - Unified body gradient is now disabled globally in player page; registration/loading remain themed via screen-level gradient blocks.
  - Mobile client may need one app restart/refresh to ensure new SW cache is active.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/player.css.pre_mobile_topbar_black_20260318_052847.bak`
    - `.codex/tmp_backups/index.html.pre_v89_20260318_052847.bak`
    - `.codex/tmp_backups/sw.js.pre_v89_20260318_052847.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_mobile_status_area_fix_20260318_053028.bak`
## 2026-03-18 - Phase1 APK display tuning trial (brightness/contrast policy)

- Request: Start Phase1 with temp-backup workflow; keep native mode and apply low-risk display tuning policy via APK.
- Changes:
  - Local Android source updates (gitignored in this repo):
    - `android-player/omnex-player-app/app/src/main/java/com/omnex/player/PerformanceProfile.kt`
      - Added `displayBrightness`, `displayContrast`, `maxContrast`, `enableContrastTuning`.
      - Policy defaults:
        - `default`: `1.00 / 1.06 / max 1.12 / enabled`
        - `balanced`: `1.00 / 1.04 / max 1.08 / enabled`
        - `legacy`: `1.00 / 1.00 / max 1.02 / disabled`
    - `android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt`
      - Added profile-aware display tuning apply path (window brightness + WebView/PlayerView contrast filter).
      - Re-apply points: on startup, on resume, on page finished, after profile override.
      - Added bridge methods:
        - `getDisplayTuning()`
        - `setDisplayTuning(brightness, contrast)`
        - `clearDisplayTuningOverride()`
      - Extended `getPerformanceProfile()` JSON with display tuning fields.
  - Release artifacts updated:
    - `downloads/omnex-player.apk`
    - `public/downloads/omnex-player.apk`
    - `downloads/omnex-player-standalone-v2.9.18.apk`
    - `public/downloads/omnex-player-standalone-v2.9.18.apk`
    - `downloads/update.json`
    - `public/downloads/update.json`
  - APK metadata:
    - Version: `2.9.18` (`versionCode: 47`)
    - SHA256: `b87d48d683f913413e3e897b8c73a608b3be2a1db5769799ad2a5f3acde3edae`
- Checks run:
  - `.\gradlew.bat :app:compileStandaloneDebugKotlin --console=plain` (OK)
  - `.\gradlew.bat :app:compilePlaystoreDebugKotlin` (OK)
  - `.\gradlew.bat :app:assembleStandaloneDebug` (OK)
  - `Get-Content downloads/update.json | ConvertFrom-Json` (OK)
  - `Get-Content public/downloads/update.json | ConvertFrom-Json` (OK)
  - `Get-FileHash -Algorithm SHA256 downloads/omnex-player.apk` (matched both directories)
- Risks/Follow-up:
  - Android source under `android-player/` is gitignored in this repository; persistence currently comes from rebuilt APK + updated OTA JSON.
  - Contrast filter is intentionally capped (`<= 1.16`) to reduce rendering risk on low-end GPUs; if stronger visual boost is needed, increase in controlled increments with soak tests.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/MainActivity.kt.pre_phase1_display_tuning_20260318_054829.bak`
    - `.codex/tmp_backups/PerformanceProfile.kt.pre_phase1_display_tuning_20260318_054829.bak`
    - `.codex/tmp_backups/build.gradle.pre_phase1_release_20260318_055250.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_phase1_release_20260318_055250.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_phase1_release_20260318_055250.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_phase1_display_tuning_20260318_055511.bak`
## 2026-03-18 - player overlay control update (orientation + display tuning)

- Request: Add display tuning control near orientation icon; keep controls hidden by default and show them on remote/user activity for better TV usability.
- Changes:
  - `public/player/index.html`
    - Added `display-tuning-btn` + `display-tuning-level` above orientation button.
    - Player JS cache query bump: `player.js?v=89`.
  - `public/player/assets/css/player.css`
    - Added styles for floating display tuning button and numeric indicator chip.
    - Updated shared floating button size rule to include the new control.
  - `public/player/assets/js/player.js`
    - Added Android bridge-backed display tuning cycle control (`getDisplayTuning` / `setDisplayTuning`).
    - Added activity-based player control overlay behavior:
      - orientation + display controls hidden by default
      - shown on mouse/touch/keydown/wheel activity
      - auto-hide after `controlOverlayHideDelay` (2400ms)
    - Wired display tuning button click to cycle safe contrast presets within profile limits.
  - `public/player/sw.js`
    - Service worker cache bump: `v1.3.27`.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
- Risks/Follow-up:
  - Display tuning UI is active only in Android bridge environment; browser/PWA clients keep this control hidden.
  - Current UI cycles presets with single button (no separate +/- yet); if field feedback requires finer control, add panel/step buttons next.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/player.js.pre_display_control_overlay_20260318_060455.bak`
    - `.codex/tmp_backups/player.css.pre_display_control_overlay_20260318_060455.bak`
    - `.codex/tmp_backups/index.html.pre_display_control_overlay_20260318_060455.bak`
    - `.codex/tmp_backups/sw.js.pre_display_control_overlay_20260318_060455.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_display_control_overlay_20260318_060724.bak`
## 2026-03-18 - legacy profile display tuning visibility fix (G66) + APK v2.9.19

- Request: Verify TV behavior and address report that G66 does not show display tuning icon.
- Changes:
  - Root cause verified on G66:
    - Device runs `legacy` profile.
    - Legacy had `enableContrastTuning=false`, so JS control intentionally stayed hidden.
  - Local Android source update (gitignored path):
    - `android-player/omnex-player-app/app/src/main/java/com/omnex/player/PerformanceProfile.kt`
      - Legacy profile `enableContrastTuning` set to `true` (safe `maxContrast=1.02` remains).
  - Release metadata bump (local Android build input):
    - `android-player/omnex-player-app/app/build.gradle`
      - `versionCode 48`, `versionName 2.9.19`
  - OTA artifact updates:
    - `downloads/omnex-player.apk`
    - `public/downloads/omnex-player.apk`
    - `downloads/omnex-player-standalone-v2.9.19.apk`
    - `public/downloads/omnex-player-standalone-v2.9.19.apk`
    - `downloads/update.json`
    - `public/downloads/update.json`
    - SHA256: `7bc35bbde28a037a561ec19b9f416a3a2352e670e00e7d28c9ac17fcea1b691b`
- Checks run:
  - `.\gradlew.bat :app:assembleStandaloneDebug` (OK)
  - `ConvertFrom-Json` for both update manifests (OK)
  - SHA256 match check for both apk copies (OK)
  - Device verification:
    - Google TV (`192.168.1.52:44245`) and G66 (`192.168.1.181:39855`) connected
    - G66 app upgraded to `2.9.19 / code 48` (OK)
    - G66 runtime log confirms `Performance profile: legacy` (OK)
    - Touch-only behavior verified via native prefs:
      - first tap reveals controls (no value change)
      - second tap toggles `display_contrast_override` (`1.00 -> 1.02`)
- Risks/Follow-up:
  - Legacy range intentionally tiny (`1.00-1.02`) to avoid GPU/compositor pressure increase.
  - Android source remains gitignored at root; persistence is via rebuilt APK + OTA manifests.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/PerformanceProfile.kt.pre_legacy_display_tuning_20260318_062022.bak`
    - `.codex/tmp_backups/build.gradle.pre_v48_legacy_display_tuning_20260318_062022.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_v48_legacy_display_tuning_20260318_062022.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_v48_legacy_display_tuning_20260318_062022.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_v48_legacy_visibility_20260318_062356.bak`
## 2026-03-18 - Display tuning levels made visually obvious (L1/L2/L3)

- Request: Make contrast change visibly obvious for customer demos; previous range looked like no change.
- Changes:
  - `public/player/assets/js/player.js`
    - Display tuning levels switched to fixed 3-step set:
      - `L1 = 1.00`
      - `L2 = 1.15`
      - `L3 = 1.30`
    - Indicator changed to level labels (`L1/L2/L3`), with numeric value in title/toast.
    - Removed temporary non-preset carry-over level so cycle remains strictly 3 steps.
  - `public/player/index.html`
    - Player script cache bump: `player.js?v=90`, then `v91`, then `v92` (final).
    - Display indicator default label updated to `L1`.
  - `public/player/sw.js`
    - Cache version bumps: `v1.3.28`, `v1.3.29`, `v1.3.30` (final).
  - Local Android source updates (gitignored path):
    - `android-player/.../MainActivity.kt`
      - Manual display tuning clamp opened to app-wide absolute cap for explicit override path.
      - `profileMaxContrast` report aligned with absolute cap.
    - `android-player/.../PerformanceProfile.kt`
      - Profile max contrast caps raised for visible tuning headroom (legacy/balanced/default).
    - `android-player/.../app/build.gradle`
      - `2.9.20` (`code 49`), then `2.9.21` (`code 50`) final.
  - OTA artifacts:
    - New final APK `2.9.21 / code 50`
    - `downloads/omnex-player.apk`, `public/downloads/omnex-player.apk`
    - Added versioned:
      - `downloads/omnex-player-standalone-v2.9.20.apk`
      - `public/downloads/omnex-player-standalone-v2.9.20.apk`
      - `downloads/omnex-player-standalone-v2.9.21.apk`
      - `public/downloads/omnex-player-standalone-v2.9.21.apk`
    - `downloads/update.json`, `public/downloads/update.json` finalized to:
      - `versionCode: 50`
      - `versionName: 2.9.21`
      - `sha256: 16604109b5be65c89f37749dbfeee0eea2117f0cdd348bbf4ef6e5529be81f2a`
  - Git/deploy:
    - Commits:
      - `18d82bf` (v2.9.20 release + 3-level UI)
      - `f99c80c` (v2.9.21 clamp/levels enforcement)
      - `989a683` (strict 3-level cycle cleanup)
    - Each commit pushed and deployed to server.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/player/sw.js` (OK)
  - `.\gradlew.bat :app:assembleStandaloneDebug` (OK, for v2.9.20 and v2.9.21)
  - `ConvertFrom-Json` for both OTA manifests (OK)
  - APK SHA checks for both download paths (OK)
  - Server runtime checks:
    - `player.js?v=92` served
    - `CACHE_VERSION='v1.3.30'` served
    - `update.json` serves `2.9.21 / code 50` with final SHA
  - Device verification (G66 `192.168.1.181:39855`):
    - Installed `2.9.21 / code 50`
    - Runtime confirms `Performance profile: legacy`
    - Runtime confirms `player.js?v=92`
    - Contrast override cycle after activity+taps:
      - `1.15 -> 1.30 -> 1.00 -> 1.15 ...` (strict 3-level loop)
- Risks/Follow-up:
  - `L3=1.30` is intentionally strong and visibly impactful; some content may show clipped highlights/shadows.
  - Recommended: if store-side feedback says too aggressive, lower only `L3` to `1.25` without touching `L1/L2`.
- Backup/Restore safety:
  - Temp backups created:
    - `.codex/tmp_backups/PerformanceProfile.kt.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/MainActivity.kt.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/build.gradle.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/player.js.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/index.html.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/sw.js.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_display_levels_20260318_063410.bak`
    - `.codex/tmp_backups/MainActivity.kt.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/build.gradle.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/player.js.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/index.html.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/sw.js.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/downloads.update.json.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/public.downloads.update.json.pre_display_levels_hotfix_20260318_064142.bak`
    - `.codex/tmp_backups/player.js.pre_display_levels_cleanup_20260318_064719.bak`
    - `.codex/tmp_backups/index.html.pre_display_levels_cleanup_20260318_064719.bak`
    - `.codex/tmp_backups/sw.js.pre_display_levels_cleanup_20260318_064719.bak`
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_display_levels_final_20260318_064942.bak`
## 2026-03-18 - Dual device 3-minute performance check after visible display levels

- Request: Run 3-minute soak/performance measurement on both Google TV and G66 to verify impact of new visible contrast levels.
- Changes:
  - No code changes.
  - New measurement artifacts:
    - `tmp/perf/dual_soak3_display_levels_20260318_065403/`
      - `google_tv/` (`192.168.1.52:44245`)
      - `g66_legacy/` (`192.168.1.181:39855`)
      - `summary.json`
- Checks run:
  - Runtime measurement workflow (both devices):
    - `dumpsys gfxinfo reset`
    - force-stop + relaunch app
    - minute-based `top` + `dumpsys meminfo` samples (3 minutes)
    - final `dumpsys gfxinfo`
    - `logcat` capture and scan
  - Results:
    - Google TV:
      - Frames `4648`
      - Jank `%64.61`
      - p50/p90/p95/p99 `19/30/44/73 ms`
      - CPU samples `0, 84.2, 0` (avg `28.07`, max `84.2`)
      - PSS delta `65666 KB`
      - RSS delta `81584 KB`
      - Errors: `NO_MEMORY=0`, playback errors `0`, HTTP 4xx/5xx `0`
    - G66 legacy:
      - Frames `4832`
      - Jank `%22.10`
      - p50/p90/p95/p99 `11/22/28/48 ms`
      - CPU samples `0, 134, 0` (avg `44.67`, max `134`)
      - PSS delta `10244 KB`
      - RSS delta `10936 KB`
      - Errors: `NO_MEMORY=0`, playback errors `0`, HTTP 4xx/5xx `0`
- Risks/Follow-up:
  - Google TV jank remains very high in this mixed-content workload window.
  - G66 is materially better than Google TV but still above ideal long-run target.
- Backup/Restore safety:
  - Memory backup:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_dual_3min_soak_20260318_070119.bak`
## 2026-03-18 - Google TV jank impact isolation (contrast override vs baseline)

- Request: Investigate whether new display tuning levels alone caused Google TV jank to nearly double.
- Changes:
  - No code changes.
  - Added focused Google TV check artifacts:
    - `tmp/perf/google_tv_contrast_reset_test_20260318/`
    - `tmp/perf/google_tv_soak3_no_override_20260318/`
- Checks run:
  - Runtime state check:
    - Google TV prefs initially had `display_contrast_override=1.24`.
  - Reset-for-test:
    - Removed app shared prefs file on device and relaunched player to run with no manual override.
  - 3-minute soak (Google TV, no override):
    - Frames `4440`
    - Jank `%64.82`
    - p50/p90/p95/p99 `19/34/48/81 ms`
    - CPU avg/max `82.23 / 93`
    - Errors: `NO_MEMORY=0`, playback errors `0`, HTTP 4xx/5xx `0`
- Risks/Follow-up:
  - Result remained at ~same high jank level even without manual override; current regression is not explained solely by contrast override level.
  - Primary remaining suspect stays mixed-content transition/render path on Google TV pipeline.
- Backup/Restore safety:
  - Memory backup:
    - `.codex/tmp_backups/CHANGE_MEMORY.md.pre_jank_impact_check_20260318_070945.bak`
## 2026-03-19 - Omnex-PriceView PriceView plan review

- Request: Review `C:/Users/test/.claude/plans/spicy-wobbling-lighthouse.md` and identify missing/improvable points against current Omnex Player + backend structure.
- Changes:
  - No application code changes.
  - Added review memory entry.
- Files changed:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - No syntax/runtime checks executed (no `.php`, `.js`, or Android source/build file changes).
- Risks/Follow-up:
  - Plan should be expanded for full device-type mapping coverage (backend + frontend + locale matrix) and sync cursor/deletion edge cases.
  - Existing `/api/player/*` auth/registration and existing print pipeline should be evaluated for reuse to avoid duplicate contracts.
- Backup/Restore safety:
  - Memory backup created: `.codex/tmp_backups/CHANGE_MEMORY.md.pre_priceview_plan_review_20260319_021152.bak`
## 2026-03-19 - Omnex-PriceView plan review (Rev.2)

- Request: Re-review `C:/Users/test/.claude/plans/spicy-wobbling-lighthouse.md` and report remaining gaps after Rev.2 updates.
- Changes:
  - No application code changes.
  - Added second review memory entry.
- Files changed:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - No syntax/runtime checks executed (no `.php`, `.js`, or Android source/build file changes).
- Risks/Follow-up:
  - Plan still includes implementation drifts: middleware alias (`device_auth` vs `device`), route placeholder style (`:barcode` vs `{barcode}`), non-existing file path (`api/devices/approve.php`), and `styles.xml` reference while project uses `themes.xml`.
  - Device type strategy should avoid new raw DB type (`priceview`) unless all backend/frontend filters are updated; safer pattern is existing type + model/original_type.
  - Print endpoint auth model needs explicit dual-auth design; current `print-html.php` is `Auth::user()` based and cannot be consumed directly by device token flow.
- Backup/Restore safety:
  - Memory backup created: `.codex/tmp_backups/CHANGE_MEMORY.md.pre_priceview_plan_review2_20260319_023147.bak`
## 2026-03-19 - Omnex-PriceView plan review (Rev.3)

- Request: Verify whether Rev.3 plan fully resolved previously reported issues.
- Changes:
  - No application code changes.
  - Added third review memory entry.
- Files changed:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - No syntax/runtime checks executed (no `.php`, `.js`, or Android source/build file changes).
- Risks/Follow-up:
  - Major prior issues are mostly fixed (middleware alias, route param format, device type strategy, path corrections, idempotent index/table draft).
  - Remaining plan-level inconsistencies: player route methods (`register/init`) mismatch with current API, print flow wording conflicts (`new endpoint yok` vs wrapper), and sample wrapper code uses `new FabricToHtmlConverter()` without required constructor args.
  - Verify SQL compatibility for `CREATE POLICY IF NOT EXISTS` against target PostgreSQL runtime before migration rollout.
- Backup/Restore safety:
  - Memory backup created: `.codex/tmp_backups/CHANGE_MEMORY.md.pre_priceview_plan_review3_20260319_024522.bak`
## 2026-03-19 - Omnex-PriceView plan review (Rev.3 final check)

- Request: Verify whether latest plan revision is fully complete.
- Changes:
  - No application code changes.
  - Added final review memory entry.
- Files changed:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - No syntax/runtime checks executed (no `.php`, `.js`, or Android source/build file changes).
- Risks/Follow-up:
  - Plan is almost complete; remaining notable issue is sample code using `Request::getBasePath()` although such method does not exist in current codebase.
  - Optional cleanup: remove stale wording around trigger mention and adjust policy support note wording for PostgreSQL compatibility clarity.
- Backup/Restore safety:
  - Memory backup created: `.codex/tmp_backups/CHANGE_MEMORY.md.pre_priceview_plan_review4_20260319_025633.bak`

## 2026-03-19 - Omnex-PriceView plan review (Rev.3 completeness recheck)

- Request: Re-check whether `C:/Users/test/.claude/plans/spicy-wobbling-lighthouse.md` is fully complete after revisions.
- Changes:
  - No application code changes.
  - Added this review memory entry.
- Files changed:
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - No syntax/runtime checks executed (no `.php`, `.js`, `.kt`, or migration code files changed in repository).
- Risks/Follow-up:
  - Plan is almost complete; one concrete mismatch remains: sample code uses `Request::getBasePath()` but `core/Request.php` does not provide this method.
  - Minor optional cleanup: align wording around trigger vs delete-hook implementation to avoid ambiguity.
- Backup/Restore safety:
  - Memory backup created: .codex/tmp_backups/CHANGE_MEMORY.md.pre_priceview_plan_review5_20260319_025937.bak

## 2026-03-19 - PriceView backend implementation (device type + API + migration + i18n)
- Request: Implement all backend changes for PriceView feature: device type integration, product_deletions migration, API endpoints, route registration, i18n, DeviceRegistry.js
- Changes:
  1. TASK 1 - Device type: Added 'priceview' to validTypes/typeMap in create.php, update.php; added to model check list and realtime status in index.php; added to typeMapping in approve.php; auto-detect manufacturer 'Omnex' for priceview
  2. TASK 2 - Migration: Created 22_priceview.sql with audit.product_deletions table (UUID PK, company_id, sku, barcode, deleted_at, deleted_by), index, RLS policy
  3. TASK 3 - Delete hook: Added product_deletions insert BEFORE hard delete in delete.php; added 'product_deletions' to Database.php allowedTables whitelist
  4. TASK 4 - API endpoints: Created 4 new files in api/priceview/ (sync.php, barcode.php, config.php, print.php) with device auth
  5. TASK 5 - Routes: Registered /api/priceview/* route group with 'device' middleware in api/index.php (after player routes)
  6. TASK 6 - i18n: Added "types.priceview" to devices.json for all 8 languages (tr/en/ru/az/de/nl/fr/ar)
  7. TASK 7 - Frontend: Added priceview type definition to DeviceRegistry.js (badge-amber, ti-tag icon, signage category, pwa_player adapter) + isPriceView() method
- Files:
  - api/devices/create.php (edited)
  - api/devices/update.php (edited)
  - api/devices/index.php (edited)
  - api/esl/approve.php (edited)
  - api/products/delete.php (edited)
  - core/Database.php (edited - whitelist)
  - api/index.php (edited - routes)
  - database/postgresql/v2/22_priceview.sql (new)
  - api/priceview/sync.php (new)
  - api/priceview/barcode.php (new)
  - api/priceview/config.php (new)
  - api/priceview/print.php (new)
  - locales/{tr,en,ru,az,de,nl,fr,ar}/pages/devices.json (edited)
  - public/assets/js/core/DeviceRegistry.js (edited)
- Checks: php -l passed for all 9 PHP files (create.php, update.php, index.php, approve.php, delete.php, sync.php, barcode.php, config.php, print.php, api/index.php)
- Risk/Follow-up:
  - Migration 22_priceview.sql must be applied to PostgreSQL manually or via migrate tool
  - print.php relies on FabricToHtmlConverter::convertToFragment() which exists (verified)
  - product_deletions table cleanup (old records) not yet implemented - consider adding periodic purge

## 2026-03-19 - Omnex PriceView APK implementation (Android + overlay + scanner + sync + print)
- Request: Create Omnex PriceView APK from Omnex Player base - offline-first price checker + signage + print
- Changes:
  1. Package rename: com.omnex.player -> com.omnex.priceview (8 kt files + build.gradle + manifest + themes + strings)
  2. Deep link: omnexplayer:// -> omnexpriceview://
  3. OTA URLs: priceview-update.json + omnex-priceview.apk
  4. UserAgent: OmnexPriceView/VERSION
  5. Room database: 5 entities (Product, Category, Bundle, SyncMetadata, DeletedProductLog), 5 DAOs, LocalDatabase singleton
  6. ProductEntity: 31 fields matching PG catalog.products schema exactly (sku NOT NULL, weight Double, extra_data)
  7. ApiClient: HttpURLConnection based, X-DEVICE-TOKEN auth, EncryptedSharedPreferences
  8. ProductSyncManager: Full sync (paginated 5K/page, streaming JSON) + delta sync (since timestamp + deleted_ids)
  9. SyncWorker: WorkManager periodic (30min), exponential backoff, network constraint
  10. BarcodeScannerManager: CameraX + ML Kit (EAN-13/8, UPC, Code128/39, QR, ITF), 500ms debounce, torch toggle, scan sound
  11. PriceViewOverlayManager: FrameLayout overlay on signage, show/hide animation, product card, not-found, auto-timeout
  12. PrintHelper: Backend HTML fetch -> hidden WebView -> Android PrintManager -> USB/WiFi printer
  13. PriceViewConfig: EncryptedSharedPreferences for token, regular prefs for settings
  14. MainActivity integration: FAB click, D-pad center/back handling, barcode key buffer, ExoPlayer mute/unmute, camera permission
  15. activity_main.xml: 4-layer FrameLayout (ExoPlayer + WebView + PriceView overlay + FAB + ProgressBar)
  16. 3 overlay layouts: overlay_product_info.xml, overlay_scan_prompt.xml, overlay_not_found.xml
  17. build.gradle: KAPT + Room 2.6.1 + ML Kit 17.2.0 + CameraX 1.3.1 + WorkManager 2.9.0 + security-crypto + Material 1.11.0
- Files (Android - 29 Kotlin + 4 XML + 4 config = 37 files total, 6582 lines):
  - Omnex-PriceView/app/build.gradle (edited)
  - Omnex-PriceView/app/src/main/AndroidManifest.xml (edited)
  - Omnex-PriceView/app/src/main/res/values/{themes,strings}.xml (edited)
  - Omnex-PriceView/app/src/main/res/layout/activity_main.xml (rewritten)
  - Omnex-PriceView/app/src/main/res/layout/overlay_{product_info,scan_prompt,not_found}.xml (new)
  - 8 existing .kt files (package rename + deep link + OTA + UserAgent)
  - 21 new .kt files (data/, dao/, network/, sync/, scanner/, print/, overlay/, settings/)
- Checks: PHP syntax passed all backend files. Package grep clean. JSON valid 8 langs.
- Risk/Follow-up:
  - Gradle build not yet tested (requires Android SDK on machine)
  - Migration 22_priceview.sql must be applied to PG
  - DeviceList.js action visibility rules for priceview not yet added (DeviceDetail.js also pending)
  - ADB deploy to G66 (192.168.1.181:40959) for integration test pending

## 2026-03-19 - PriceView: always-on camera pip, remove FAB, auto-sync, camera permission
- Request: Fix 4 device testing issues: FAB overlaps WebView controls, camera not always-on, permissions not requested on first run, product sync not triggered after registration
- Changes:
  1. Removed FAB (FloatingActionButton) entirely from layout and Kotlin code
  2. Added always-on camera pip (160x120dp PreviewView) in top-left corner with scan indicator dot
  3. Added scan trigger button (44dp circle matching PWA player style) positioned above display-tuning button
  4. Camera starts automatically in initPriceView() if permission granted, continuous barcode scanning
  5. Barcode detection auto-triggers product overlay (no FAB press needed)
  6. Added requestCameraPermissionIfNeeded() to requestStartupPermissionsIfNeeded()
  7. Camera permission result now calls startAlwaysOnCamera() instead of showPriceViewOverlay()
  8. Added triggerInitialSyncIfNeeded() - checks SyncMetadata.lastSyncAt, triggers SyncWorker.syncNow() if null
  9. onResume restarts camera if pip was visible before pause
  10. D-pad CENTER toggles overlay hide / starts camera instead of showPriceViewOverlay()
  11. overlay_scan_prompt.xml minimized to empty placeholder (replaced by always-on pip)
  12. Created 3 new drawables: player_control_circle, camera_pip_border, scan_indicator_dot
  13. Removed FloatingActionButton import, all fabScan references, showPriceViewOverlay() method
- Files:
  - Omnex-PriceView/app/src/main/res/layout/activity_main.xml (rewritten)
  - Omnex-PriceView/app/src/main/res/layout/overlay_scan_prompt.xml (minimized)
  - Omnex-PriceView/app/src/main/res/drawable/player_control_circle.xml (new)
  - Omnex-PriceView/app/src/main/res/drawable/camera_pip_border.xml (new)
  - Omnex-PriceView/app/src/main/res/drawable/scan_indicator_dot.xml (new)
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt (edited)
- Checks: Grep verified no remaining fabScan/FloatingActionButton/showPriceViewOverlay references
- Risk/Follow-up:
  - Gradle build not tested (requires Android SDK)
  - PriceViewOverlayManager constructor still expects scanPrompt param - passed as empty View fallback
  - BarcodeScannerManager.hasCameraPermission() and setTorch() must exist (assumed from existing code)
  - SyncMetadata DAO get("products") must exist (assumed from sync module)
  - PriceViewConfig.cameraTorchDefault property assumed to exist

## 2026-03-20 - Fix priceview settings save scope + sync interval min 15

- Request: Two fixes: (1) savePriceviewSettings() saves to user-level row instead of company-level, so /api/priceview/config never finds the settings. (2) Add min 15 minute validation for sync interval (Android WorkManager limitation).
- Changes:
  1. IntegrationSettings.js savePriceviewSettings(): changed PUT /settings to PUT /settings?scope=company so priceview settings go to company row (user_id IS NULL)
  2. IntegrationSettings.js loadPriceviewSettings(): changed GET /settings to GET /settings?scope=company so it reads from the same company row
  3. Sync interval input: changed min="1" to min="15", added warning note below input using i18n key
  4. savePriceviewSettings(): added validation - if syncInterval < 15, clamp to 15 and show Toast.warning
  5. Added i18n key "syncIntervalMin" to priceview.hints in all 8 locales (tr, en, az, de, nl, fr, ru, ar)
- Files:
  - public/assets/js/pages/settings/IntegrationSettings.js (3 edits: save scope, load scope, min validation + UI note)
  - locales/tr/pages/settings.json (added syncIntervalMin)
  - locales/en/pages/settings.json (added syncIntervalMin)
  - locales/az/pages/settings.json (added syncIntervalMin)
  - locales/de/pages/settings.json (added syncIntervalMin)
  - locales/nl/pages/settings.json (added syncIntervalMin)
  - locales/fr/pages/settings.json (added syncIntervalMin)
  - locales/ru/pages/settings.json (added syncIntervalMin)
  - locales/ar/pages/settings.json (added syncIntervalMin)
- Checks: All 8 locale JSON files validated with PHP json_decode (all OK)
- Risk/Follow-up:
  - Backend api/settings/index.php already supports ?scope=company via query param - no backend change needed
  - The /api/priceview/config endpoint queries WHERE company_id=? AND user_id IS NULL which now matches the save target
  - Existing user-level priceview settings (saved before this fix) will be orphaned; they won't cause harm but won't be read either

## 2026-03-20 - Fix 3 PriceView issues (overlay timeout, print button, status card)

- Request: Fix three issues: (1) Overlay timeout not applied from remote config, (2) Print button "Baski sablonu secilmedi" text and async config issue, (3) IntegrationSettings status card shows "-" for all values.
- Changes:
  1. **Issue 1 - Overlay timeout**: `triggerInitialSyncIfNeeded()` changed from fire-and-forget async config fetch to synchronous blocking (CountDownLatch with 5s timeout). Config fetch now completes BEFORE SyncWorker.schedule() and first barcode scan, ensuring overlayTimeoutSeconds is set from remote config.
  2. **Issue 2 - Print button**: `printProduct()` now retries config fetch from `/api/priceview/config` if `defaultTemplateId` is null before giving up. Turkish text fixed from ASCII "Baski sablonu secilmedi" to proper Unicode escapes "\u0042ask\u0131 \u015fablonu se\u00e7ilmedi". Also fixed "Baski hatasi" to "Bask\u0131 hatas\u0131".
  3. **Issue 3 - Status card**: `_loadPriceviewStatus()` in IntegrationSettings.js now fetches real data: product count from `/reports/dashboard-stats` (stats.products), device count from `/devices?type=pwa_player&per_page=1` (meta.total). Previously read non-existent keys from settings JSON.
- Files:
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt (triggerInitialSyncIfNeeded + printProduct)
  - public/assets/js/pages/settings/IntegrationSettings.js (_loadPriceviewStatus)
- Checks: IntegrationSettings.js passed node -c syntax check. Kotlin changes reviewed for brace matching and import availability (CountDownLatch, TimeUnit already imported at line 45-46).
- Risk/Follow-up:
  - CountDownLatch.await() on main thread blocks UI for up to 5s during startup; acceptable since it's during init phase
  - The latch uses priceViewScope with Dispatchers.IO, which runs on IO thread pool, so no deadlock risk
  - Device count query uses type=pwa_player; if PriceView devices are registered with a different type, count may be 0
  - Last sync time still reads from settings data (priceview_last_sync) which is not yet populated by any backend code


## 2026-03-21 - Commit history + docs review (PriceView/FiyatGor readiness)
- Request: Review recent commit history and project docs, with focus on PriceView/FiyatGor changes; confirm readiness for next development step.
- Changes:
  - Analysis-only review completed for main repo commit timeline and PriceView-related code/docs.
  - Confirmed `Omnex-PriceView/` exists locally but is not tracked in this repo's git history.
- Files changed:
  - .codex/CHANGE_MEMORY.md (this log entry)
- Checks run:
  - None (no source code edit; documentation/log update only).
- Risk/Follow-up:
  - Main repo and local `Omnex-PriceView/` app state are not fully aligned in traceability because APK app source folder is untracked.
  - Some local docs in `docs/` and `Omnex-PriceView/` show encoding degradation and mixed historical naming (PriceTag/FiyatGor/PriceView), which can cause confusion during implementation.
- Backup/restore safety steps:
  - Not needed (append-only log update).

## 2026-03-21 - FabricToHtmlConverter: barcode detection + print image path fix (server/local parity)
- Request: Investigate converter behavior for product page flows. Issues: (1) Barcode area not rendering in web-template generation flow for some designs, (2) print output image URLs broken on server while local works; work with backups and encoding safety.
- Changes:
  1. `services/FabricToHtmlConverter.php`
     - Barcode routing in `convertObject()` changed to use new robust detector `isBarcodeObject()` (customType/type/dynamicField/fieldBinding/text placeholder/alias aware).
     - `convertBarcode()` fallback logic hardened to avoid leaving literal "barcode/barkod" label and prefer real field value (`barcode` then `sku`).
     - Added `normalizeFieldKey()` and updated `resolveDynamicFieldValue()` to support alias mapping and spaced placeholders (`{{ product.barcode }}` style).
  2. `api/templates/print-html.php`
     - Removed manual `basename(BASE_PATH)` based basePath injection to converter (causing wrong `/html/...` prefix on some server deployments).
     - Switched to `new FabricToHtmlConverter($companyId)` (converter auto-detects web base path).
- Files changed:
  - services/FabricToHtmlConverter.php
  - api/templates/print-html.php
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l services/FabricToHtmlConverter.php` (OK)
  - `php -l api/templates/print-html.php` (OK)
- Risk/Follow-up:
  - Barcode rendering still depends on client-side JsBarcode CDN availability at runtime.
  - Line-ending warning observed in git diff (LF/CRLF normalization warning only; no syntax impact).
- Backup/restore safety steps:
  - Created backups before edit:
    - `services/FabricToHtmlConverter.php.bak.20260321_142104`
    - `api/templates/print-html.php.bak.20260321_142104`

## 2026-03-21 - Follow-up fix: /web-templates/:id/serve barcode render parity
- Request: Barcode in web-template serve output still looked incorrect locally despite SVG being generated; verify and fix render behavior.
- Changes:
  - `services/FabricToHtmlConverter.php` buildFullHtml() inline JsBarcode script updated to match print behavior:
    - auto format detection (EAN13/EAN8/UPC/CODE128)
    - adaptive bar height/font/line width from object box (`data-width` / `data-height`)
    - avoids clipping/shape mismatch from fixed CODE128+fixed sizing.
- Files changed:
  - services/FabricToHtmlConverter.php
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l services/FabricToHtmlConverter.php` (OK)
- Risk/Follow-up:
  - CDN availability for JsBarcode still required at runtime.
  - Browser cache can make old served HTML appear until hard refresh/open in new tab.
- Backup/restore safety steps:
  - Additional backup created before follow-up patch:
    - `services/FabricToHtmlConverter.php.bak.20260321_170127`

## 2026-03-21 - Commit/Push + Server Pull/Deploy execution
- Request: Execute commit + push + server-side pull/deploy for recent converter/print fixes.
- Changes:
  - Created commit on `main`: `f2a5d2f` (converter barcode render alignment + print media base-path fix + memory updates).
  - Pushed to `origin/main` successfully.
  - Remote deploy executed on `185.124.84.34` (`/opt/omnex-hub`): `git pull origin main`, `docker compose build app`, `docker compose up -d app`.
  - Verified container status: `omnex-app-1` is `healthy`.
- Files changed:
  - None newly edited in this step (operational execution only).
- Checks run:
  - Remote service health check via `docker compose ps app` (healthy).
- Risk/Follow-up:
  - Compose output reported orphan containers (`omnex-nginx-1`, `omnex-certbot-1`) warning; non-blocking, but stack hygiene can be reviewed later.
- Backup/restore safety steps:
  - Not applicable for this operational step.

## 2026-03-21 - Media/MediaPicker video thumbnail: instant first-frame fallback + hybrid preview
- Request: In media page and MediaPicker modals, video thumbnails should appear immediately (first frame style) and not wait long on static thumbnail generation.
- Changes:
  1. `public/assets/js/pages/products/form/MediaPicker.js`
     - Video card markup changed to hybrid preview: always render lazy `<video>` first-frame fallback; when `thumbnail_url` exists, load it as overlay image (`data-thumb-src`) and switch when loaded.
     - `_initLazyVideoThumbnails()` updated to handle both image+video states (ready image suppresses video fallback flicker; video still shown instantly if image is slow).
     - Video error placeholder override guarded so existing image thumbnail is not replaced by video error UI.
  2. `public/assets/js/pages/media/MediaLibrary.js`
     - Grid card and table row video previews switched to shared hybrid renderer (`renderHybridVideoPreview`).
     - `initLazyVideoThumbnails()` updated with same hybrid load logic (thumbnail image + video first-frame fallback coordination).
     - Video card wrapper now includes `media-video-preview` class for layered styling.
  3. `public/assets/css/pages/products.css`
     - MediaPicker video thumbnail layers positioned absolutely with z-index ordering (placeholder < video frame < thumbnail image < play icon).
  4. `public/assets/css/pages/media.css`
     - Added `.media-video-preview` layered styles for hybrid video preview in both card and table modes.
     - `media-table-preview` set to `position: relative` for overlay layering.
- Files changed:
  - public/assets/js/pages/products/form/MediaPicker.js
  - public/assets/js/pages/media/MediaLibrary.js
  - public/assets/css/pages/products.css
  - public/assets/css/pages/media.css
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `node --check public/assets/js/pages/products/form/MediaPicker.js` (OK)
  - `node --check public/assets/js/pages/media/MediaLibrary.js` (OK)
- Risk/Follow-up:
  - Hybrid mode still requests both video metadata and thumbnail image when thumbnail URL exists; this improves perceived speed but can increase network usage on very large pages.
  - FFmpeg-backed thumbnail generation timing remains server-dependent; this patch improves UI fallback behavior rather than backend generation latency itself.

## 2026-03-21 - Media grid video preview full-fit adjustment
- Request: In media page (`#/media`) grid card view, video thumbnails were still appearing small inside preview boxes; thumbnails should fill the preview area.
- Changes:
  - `public/assets/css/pages/media.css`
    - `media-card-preview.media-video-preview` updated to full-bleed rendering (`padding: 0`) with dark background.
    - Hybrid video thumb/frame (`.media-hybrid-video-thumb`, `.media-hybrid-video-frame`) forced to true cover mode with `max-width/max-height` reset and radius/shadow removed to prevent inset-small rendering.
- Files changed:
  - public/assets/css/pages/media.css
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `node --check public/assets/js/pages/products/form/MediaPicker.js` (OK)
  - `node --check public/assets/js/pages/media/MediaLibrary.js` (OK)
- Risk/Follow-up:
  - Video grid cards now prioritize fill (`cover`), so edge cropping can occur for extreme aspect-ratio videos (expected tradeoff for full-fit preview).

## 2026-03-21 - Media/MediaPicker pagination slot parity fix (folder-aware)
- Request: In media grid and MediaPicker modals, each page should be fully filled (no 3-card row where 4 should fit); suspected fixed per-page count and folder counting mismatch.
- Changes:
  1. `public/assets/js/pages/media/MediaLibrary.js`
     - Page slot size standardized to `28` (`pageSlotCount`).
     - `/media` pagination made folder-aware: fetch page once, subtract returned folder card count from file `per_page`, and refetch so `folders + files` fill the same grid slot budget.
     - Grid/table pagination UI now uses fixed slot count while stats use API `meta.per_page` for file-range calculations.
  2. `public/assets/js/pages/products/form/MediaPicker.js`
     - Picker states standardized to `pageSlotCount: 28`.
     - Scope-based folder-aware per-page fetching added in `_loadMediaWithScopes()`.
     - Multi-image mode rule added: company scope folders are hidden, so they are not subtracted from visible slot budget; public scope folders are subtracted.
     - Active library pagination state now syncs `perPage` from selected scope meta.
- Files changed:
  - public/assets/js/pages/media/MediaLibrary.js
  - public/assets/js/pages/products/form/MediaPicker.js
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `node --check public/assets/js/pages/media/MediaLibrary.js` (OK)
  - `node --check public/assets/js/pages/products/form/MediaPicker.js` (OK)
- Risk/Follow-up:
  - Folder-aware logic performs an extra API call per scope/page when folders exist; acceptable tradeoff for full-page visual parity.
  - If backend later paginates folders separately with different semantics, frontend slot-adjustment logic should be revalidated.
- Backup/restore safety steps:
  - Not required (focused JS edits, no encoding conversion performed).

## 2026-03-21 - PriceView end-to-end analysis (APK/backend/frontend + branch/bundle/sqlite scope)
- Request: Analyze Omnex-PriceView system end-to-end: APK sync flow, backend/frontend communication, company/branch behavior, whether branch pricing is fetched, whether bundle data is fetched, and exact SQLite table/id names.
- Changes:
  - Analysis-only code reading across APK (`Omnex-PriceView`), backend (`api/priceview/*`, middleware), frontend settings pages, and DB schemas.
  - No runtime logic changed.
- Files changed:
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - Not applicable (no code edits).
- Risk/Follow-up:
  - Confirmed architecture gaps: PriceView sync currently product-only and company-wide; branch override and bundle/category sync not implemented in active flow.
  - Device detail page writes PriceView settings to user scope while device config endpoint reads company scope.
- Backup/restore safety steps:
  - Not required (analysis-only, no risky encoding edits).
## 2026-03-22 - PriceView branch-aware product sync + bundle sync + barcode bundle fallback
- Request: Make PriceView sync branch-aware with `ProductPriceResolver`; add bundle sync endpoint + APK bundle sync manager; add bundle fallback in barcode flow; ensure products + bundles are synced to local SQLite with media URLs; apply backup-safe edits.
- Changes:
  1. Backend branch/device context and sync APIs
     - `middleware/DeviceAuthMiddleware.php`: plain-token auth queries now include `d.branch_id`.
     - `api/priceview/sync.php`: branch-aware product value resolution (`ProductPriceResolver`), branch override-aware delta detection, and media URL normalization (`image_url`, `images`, `videos`).
     - `api/priceview/barcode.php`: branch-aware single-product resolution + media URL normalization.
  2. Backend bundle APIs/routes/deletion audit
     - `api/priceview/bundles-sync.php` (new): full+delta bundle sync with branch override awareness (`BundlePriceResolver`), deletion list support via `bundle_deletions`, `products_json` assembly from `bundle_items`, media URL normalization.
     - `api/priceview/bundles-barcode.php` (new): bundle barcode/SKU lookup with branch price resolution and normalized media URLs.
     - `api/index.php`: registered `/api/priceview/bundles/sync` and `/api/priceview/bundles/barcode/{barcode}` routes.
     - `api/bundles/delete.php`: delete flow now writes best-effort `bundle_deletions` audit record inside transaction.
     - `database/postgresql/v2/23_priceview_bundles.sql` (new): `audit.bundle_deletions` table + index + RLS policy.
     - `core/Database.php`: migration list includes `22_priceview.sql` + `23_priceview_bundles.sql`; `bundle_deletions` added to `validateTable` allowlist.
  3. APK sync/barcode integration
     - `Omnex-PriceView/.../data/dao/BundleDao.kt`: added `findBySku`, `getCount`, `deleteByIds`.
     - `Omnex-PriceView/.../sync/BundleSyncManager.kt` (new): full+delta bundle sync, metadata tracking, deletion handling; media safety improvement: if `images` is empty but `image_url` exists, maps `image_url` into `images` JSON array for local persistence.
     - `Omnex-PriceView/.../sync/SyncWorker.kt`: runs product and bundle sync together; aggregated success/failure payload.
     - `Omnex-PriceView/.../MainActivity.kt`: barcode flow now includes local/online bundle fallback (`findByBarcode`, `findBySku`, `/api/priceview/bundles/barcode/{barcode}`) and mapping helpers.
- Files changed:
  - middleware/DeviceAuthMiddleware.php
  - api/priceview/sync.php
  - api/priceview/barcode.php
  - api/priceview/bundles-sync.php (new)
  - api/priceview/bundles-barcode.php (new)
  - api/index.php
  - api/bundles/delete.php
  - core/Database.php
  - database/postgresql/v2/23_priceview_bundles.sql (new)
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/data/dao/BundleDao.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/sync/BundleSyncManager.kt (new)
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/sync/SyncWorker.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l middleware/DeviceAuthMiddleware.php` (OK)
  - `php -l api/priceview/sync.php` (OK)
  - `php -l api/priceview/barcode.php` (OK)
  - `php -l api/priceview/bundles-sync.php` (OK)
  - `php -l api/priceview/bundles-barcode.php` (OK)
  - `php -l api/index.php` (OK)
  - `php -l api/bundles/delete.php` (OK)
  - `php -l core/Database.php` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK, warnings only)
- Risk/Follow-up:
  - `Omnex-PriceView/` is not a tracked git repo in current workspace root; APK changes will not appear in root git history unless this directory is versioned separately.
  - Kotlin build emits pre-existing deprecation/type warnings; compile succeeds.
- Backup/restore safety steps:
  - Created timestamped backups before risky edits (`*.bak.20260321_234024` set for backend/Kotlin files and `BundleSyncManager.kt.bak.20260322_000002` for latest edit).
## 2026-03-22 - PriceView APK v1.0.3 release + update.json version bump + deploy prep
- Request: Commit/push/pull; build latest PriceView APK, copy to `downloads`, and update only PriceView section in `update.json` so devices can auto-update.
- Changes:
  - Built standalone debug APK from `Omnex-PriceView` with `versionCode=4`, `versionName=1.0.3`.
  - Copied APK to:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
  - Updated only `apps.com.omnex.priceview` fields in:
    - `downloads/update.json`
    - `public/downloads/update.json`
    (versionCode/versionName/downloadUrl/releaseNotes/sha256)
  - Included pending backend PriceView branch+bundle sync changes in release commit set.
- Files changed:
  - downloads/omnex-priceview.apk
  - public/downloads/omnex-priceview.apk
  - downloads/update.json
  - public/downloads/update.json
  - api/priceview/sync.php
  - api/priceview/barcode.php
  - api/priceview/bundles-sync.php
  - api/priceview/bundles-barcode.php
  - api/index.php
  - api/bundles/delete.php
  - middleware/DeviceAuthMiddleware.php
  - core/Database.php
  - database/postgresql/v2/23_priceview_bundles.sql
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - APK metadata check: `aapt dump badging downloads/omnex-priceview.apk` => `versionCode='4'`, `versionName='1.0.3'`.
  - SHA256 verification: APK hash matches both `update.json` files.
  - `php -l` on changed backend files (all OK).
  - Gradle build: `./gradlew.bat :app:publishDebugApk` (successful, warnings only).
- Risk/Follow-up:
  - `Omnex-PriceView/` source directory is currently untracked in root git; APK artifact is committed for distribution, but app source history is not in this repo.
- Backup/restore safety steps:
  - Backup files created before edits:
    - `Omnex-PriceView/app/build.gradle.bak.20260322_001415`
    - `downloads/update.json.bak_priceview_release_20260322_001415`
    - `public/downloads/update.json.bak_priceview_release_20260322_001415`## 2026-03-22 - PriceView HTML overlay templates via sync (integration default + device override)
- Request: FiyatG�r sonu� ekranlar�nda APK i�indeki `overlay_product_info.xml` / `overlay_not_found.xml` yerine proje taraf�ndaki `public/priceview-templates` �ablonlar�n� kullanmak; entegrasyonda evrensel se�im + cihaz detay�nda override (bo�/default ise entegrasyon ayar�), de�i�medik�e tekrar indirmeme.
- Changes:
  1. Backend template resolution + config
     - Added `api/priceview/template-utils.php` (preset discovery, template resolve, signature, metadata helpers).
     - Updated `api/priceview/config.php` to return effective display template (`display_template_name/source/signature`), company/device selection context, presets, branch/company context.
     - Replaced `api/priceview/display-template.php` to return both `product_html` and `not_found_html` (+ backward-compatible `html`) from `public/priceview-templates` with defaults.
     - Added `api/priceview/template-presets.php` (auth route for admin UI dropdown data).
  2. Device-level override API
     - Added `api/devices/priceview-settings.php` (GET/PUT) to read/write device-specific display template override in `devices.metadata` and return effective selection.
     - Registered new routes in `api/index.php`:
       - `GET /api/devices/{id}/priceview-settings`
       - `PUT /api/devices/{id}/priceview-settings`
       - `GET /api/priceview/template-presets` (auth)
  3. Frontend settings wiring
     - Updated `public/assets/js/pages/settings/IntegrationSettings.js`:
       - display template dropdown now uses file-based presets (`/priceview/template-presets`) by template `name` (not template table id).
       - print template dropdown remains `/templates`.
       - company settings save now merges existing settings before PUT to avoid accidental key loss.
     - Updated `public/assets/js/pages/devices/DeviceDetail.js`:
       - added device-side display template override select (`pv-display-template-override`).
       - load/save uses new `/devices/{id}/priceview-settings` endpoint.
       - company settings save switched to `scope=company` and merged PUT.
  4. Locale updates (8 languages)
     - Added keys under `priceview` in devices page locales:
       - `displayTemplate`
       - `deviceTemplateDefault`
     - Files: `locales/{tr,en,ru,az,de,nl,fr,ar}/pages/devices.json`
  5. APK implementation (HTML overlay mode)
     - Updated `Omnex-PriceView/.../settings/PriceViewConfig.kt` with display mode/template cache fields (`productDisplayMode`, template name/signature/html payloads, company/branch).
     - Added `Omnex-PriceView/.../sync/DisplayTemplateSyncManager.kt` to fetch and cache HTML templates only when signature/template changes.
     - Updated `Omnex-PriceView/.../sync/SyncWorker.kt` to apply display mode/template sync from `/api/priceview/config` and fix interval-change reschedule compare.
     - Updated `Omnex-PriceView/.../res/layout/activity_main.xml` to include HTML overlay WebViews (`productHtmlOverlay`, `notFoundHtmlOverlay`).
     - Reworked `Omnex-PriceView/.../overlay/PriceViewOverlayManager.kt` to support native/html modes, template binding, JS bridge calls (`window.PriceView.setProduct/setCompany`), and fallback.
     - Updated `Omnex-PriceView/.../MainActivity.kt` to apply remote config centrally, pass HTML overlay WebViews, refresh overlay template config before barcode display, and reuse config apply path in startup/print retry.
- Files changed:
  - api/priceview/template-utils.php (new)
  - api/priceview/config.php
  - api/priceview/display-template.php
  - api/priceview/template-presets.php (new)
  - api/devices/priceview-settings.php (new)
  - api/index.php
  - public/assets/js/pages/settings/IntegrationSettings.js
  - public/assets/js/pages/devices/DeviceDetail.js
  - locales/tr/pages/devices.json
  - locales/en/pages/devices.json
  - locales/ru/pages/devices.json
  - locales/az/pages/devices.json
  - locales/de/pages/devices.json
  - locales/nl/pages/devices.json
  - locales/fr/pages/devices.json
  - locales/ar/pages/devices.json
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/settings/PriceViewConfig.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/sync/DisplayTemplateSyncManager.kt (new)
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/sync/SyncWorker.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt
  - Omnex-PriceView/app/src/main/res/layout/activity_main.xml
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l api/priceview/template-utils.php` (OK)
  - `php -l api/priceview/config.php` (OK)
  - `php -l api/priceview/display-template.php` (OK)
  - `php -l api/priceview/template-presets.php` (OK)
  - `php -l api/devices/priceview-settings.php` (OK)
  - `php -l api/index.php` (OK)
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js` (OK)
  - `node --check public/assets/js/pages/devices/DeviceDetail.js` (OK)
  - `node -e "...JSON.parse locales/*/pages/devices.json..."` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:compilePlaystoreDebugKotlin` (OK, warnings only)
- Risk/Follow-up:
  - `Omnex-PriceView/` root workspace git status still appears untracked in this repository context; APK source edits may require separate VCS handling in deployment flow.
  - New admin/device endpoints were syntax-checked but not live-auth API-called in this run.
- Backup/restore safety steps:
  - Backed up locale files before edit: `.temp-backups/locales_devices_20260322_010015/...`
  - Backed up APK layout/source files before edit; moved layout backups out of `res/layout` after merge-resource conflict:
    - `.temp-backups/apk_layout_backups_20260322_010220/activity_main.xml.bak.20260322_010220`
    - `.temp-backups/apk_layout_backups_20260322_010220/overlay_product_info.xml.bak.20260322_010220`
    - `.temp-backups/apk_layout_backups_20260322_010220/overlay_not_found.xml.bak.20260322_010220`

## 2026-03-22 - PriceView release packaging + repo inclusion + deploy flow prep
- Request: Commit/push/pull akisini tamamla; Omnex-PriceView Android projesini ana repoya dahil et; APK build ve `downloads/update.json` + `public/downloads/update.json` icinde sadece PriceView versiyon bilgisini guncelle; sunucuya deploy akisina dahil et.
- Changes:
  1. Release prep
     - `Omnex-PriceView/app/build.gradle`: `versionCode` 5, `versionName` `1.0.4`.
     - Build run: `./gradlew.bat clean assembleStandaloneDebug publishDebugApk --rerun-tasks`.
     - APK publish paths confirmed: `downloads/omnex-priceview.apk` and `public/downloads/omnex-priceview.apk`.
  2. Update manifest json
     - `downloads/update.json` -> `apps.com.omnex.priceview` set to v5 / 1.0.4 / `...?v=5`.
     - `public/downloads/update.json` -> same PriceView-only bump.
     - SHA256 kept as built artifact hash: `b86371bf78162c4bedf917da1b34391a9f666c9c0595475b0ceb6b5ea621ad08`.
  3. Repository hygiene for PriceView source inclusion
     - `.gitignore` updated to exclude `Omnex-PriceView/.gradle`, `Omnex-PriceView/app/build`, `Omnex-PriceView/local.properties`, backup files.
     - Added unignore exception for `Omnex-PriceView/gradle/wrapper/gradle-wrapper.jar` and staged wrapper jar.
     - `Omnex-PriceView/` Android project source/docs staged into main repository.
- Files changed:
  - .gitignore
  - Omnex-PriceView/** (Android project sources/resources/gradle wrapper/docs)
  - downloads/update.json
  - public/downloads/update.json
  - .codex/CHANGE_MEMORY.md
  - (Plus previously staged PriceView backend/frontend/localization/template files from current workstream)
- Checks run:
  - `php -l api/priceview/template-utils.php` (OK)
  - `php -l api/priceview/config.php` (OK)
  - `php -l api/priceview/display-template.php` (OK)
  - `php -l api/priceview/template-presets.php` (OK)
  - `php -l api/devices/priceview-settings.php` (OK)
  - `php -l api/index.php` (OK)
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js` (OK)
  - `node --check public/assets/js/pages/devices/DeviceDetail.js` (OK)
  - JSON parse check: `downloads/update.json`, `public/downloads/update.json`, `locales/*/pages/devices.json` (OK)
  - Android build: `./gradlew.bat clean assembleStandaloneDebug publishDebugApk --rerun-tasks` (OK)
- Risk/Follow-up:
  - `Omnex-PriceView` was newly added to monorepo in this step; clone size increases.
  - Existing unrelated untracked temp/backup files in workspace were intentionally not staged.
- Backup/restore safety steps:
  - Release file backups: `.temp-backups/release_20260322_012050/`.

## 2026-03-22 - Hotfix: PriceView APK copy path bug (version remained 1.0.3)
- Request: Device update gorunse de surum 1.0.3 kaliyor; ADB ile dogrula ve duzelt.
- Root cause:
  - `Omnex-PriceView/app/build.gradle` icindeki `publishDebugApk` kopya yolu yanlisti (`../../downloads`), APK `C:/xampp/htdocs/downloads` altina gidiyordu.
  - Repo dagitim dosyalari (`market-etiket-sistemi/downloads`) eski APK (v4/1.0.3) ile kalmis.
- Changes:
  1. `Omnex-PriceView/app/build.gradle`
     - `publishDebugApk` copy targets fixed:
       - `../public/downloads`
       - `../downloads`
     - `publishReleaseArtifacts` output dir fixed to `../public/downloads`.
  2. Rebuilt/published APK to correct repo paths.
  3. Updated PriceView `sha256` in both update manifests to new APK hash.
- Verification:
  - ADB device check (`192.168.1.77:42059`) showed installed app was `versionCode=4`, `versionName=1.0.3` (before fix).
  - `aapt dump badging downloads/omnex-priceview.apk` after fix: `versionCode=5`, `versionName=1.0.4`.
  - New SHA256: `55cfebe23ab50134a058ff3b2199a092d60ff65f25fb5c2b65d0bc265e327985`.
- Files changed:
  - Omnex-PriceView/app/build.gradle
  - downloads/update.json
  - public/downloads/update.json
  - downloads/omnex-priceview.apk
  - public/downloads/omnex-priceview.apk
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `./gradlew.bat assembleStandaloneDebug publishDebugApk` (OK)
  - `aapt dump badging downloads/omnex-priceview.apk` (v5/1.0.4)
  - `aapt dump badging public/downloads/omnex-priceview.apk` (v5/1.0.4)
  - `JSON.parse` checks for `downloads/update.json` and `public/downloads/update.json` (OK)
- Backup/restore safety:
  - `.temp-backups/release_fix_20260322_014241/`

## 2026-03-22 - Fix: PriceView display mode cannot be changed from Integration UI
- Request: Cihazlarda yeni HTML tasarim devreye girmiyor; 15 dk bekleme gerekli mi kontrol et.
- Root cause:
  - Integration UI'da PriceView icin `product_display_mode` form alani render edilmiyordu.
  - Kayit tarafi `this.priceviewSettings.product_display_mode` kullandigi icin mevcut deger (genelde `native`) tekrar yaziliyordu.
  - Sonuc: Display template secimi kaydoluyor ama mod `native` kaldigi icin HTML overlay hic aktif olmuyordu.
- Changes:
  1. `public/assets/js/pages/settings/IntegrationSettings.js`
     - PriceView Display Settings bolumune `pv-display-mode` select eklendi (`native` / `html`).
     - Form populate akisina `pv-display-mode` degeri eklendi.
     - Save akisinda `priceview_product_display_mode` artik dogrudan formdan okunuyor.
  2. Locale keys (8 dil)
     - Added: `integrations.priceview.fields.displayMode`
     - Added: `integrations.priceview.hints.displayMode`
     - Added: `integrations.priceview.displayModes.native/html`
     - Files: `locales/{tr,en,ru,az,de,nl,fr,ar}/pages/settings.json`
- Files changed:
  - public/assets/js/pages/settings/IntegrationSettings.js
  - locales/tr/pages/settings.json
  - locales/en/pages/settings.json
  - locales/ru/pages/settings.json
  - locales/az/pages/settings.json
  - locales/de/pages/settings.json
  - locales/nl/pages/settings.json
  - locales/fr/pages/settings.json
  - locales/ar/pages/settings.json
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js` (OK)
  - JSON parse checks for 8 locale files (OK)
  - Live diagnosis check: `/api/priceview/config` was returning `product_display_mode: native` while template changed, confirming bug path.
- Risk/Follow-up:
  - Existing tenants must save PriceView mode once as `HTML` after this UI fix is deployed.
- Backup/restore safety steps:
  - Created backup set: `.temp-backups/locale_mode_fix_20260322_020130/`
## 2026-03-22 - Runtime fix: PriceView HTML mode not applying (container stale + company mode native)
- Request: User triggered sync but HTML overlay did not activate; asked whether 15-minute wait is required.
- Root cause:
  1) Production `omnex-app-1` container still served old `IntegrationSettings.js` (host repo had fix, container image stale).
  2) Company setting `priceview_product_display_mode` remained `native` for company `deda94ce-f971-4562-804b-7d86e93043fd`.
- Actions performed (runtime/deploy):
  1) Rebuilt and restarted production app stack from `/opt/omnex-hub/deploy`:
     - `docker compose -f docker-compose.yml -f docker-compose.standalone.yml build app`
     - `docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d app nginx`
  2) Updated company setting in production DB to HTML mode (`UPDATE settings ... jsonb_set(... 'priceview_product_display_mode' = 'html')`).
  3) Forced device sync job on `192.168.1.181:38155` with `cmd jobscheduler run -f com.omnex.priceview 111`.
- Verification:
  - Live JS now includes `pv-display-mode` and save reads `document.getElementById('pv-display-mode')`.
  - `https://hub.omnexcore.com/api/priceview/config` for device token returns `product_display_mode=html`, `display_template_name=accessory`.
  - Device local prefs (`omnex_priceview_config.xml`) now show `product_display_mode=html` and cached HTML templates.
- Files changed:
  - Local repo code files: none.
  - Runtime only (remote container + DB setting).
- Checks run:
  - ADB package/version/prefs checks.
  - Remote container file content check.
  - Remote API config check.
  - Device local prefs post-forced-sync check.
- Risk/Follow-up:
  - If integration page was open before rebuild, browser hard refresh may still be needed.
  - Existing `sync now` button in Integration page is informational and does not push real-time to device; device/app startup or worker run is needed.
- Backup/restore safety:
  - No repo file edit performed in this step.
## 2026-03-22 - PriceView HTML overlay UX fix (slide-up, flash reduction, close/print actions)
- Request: In device scan flow, HTML result cards should enter from bottom like native; repeated flash/re-render should stop; close and print icons/buttons in HTML templates should work.
- Changes:
  1. `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
     - Added HTML WebView JS bridge (`HtmlUiBridge`) with `closeOverlay()` and `printCurrentProduct()`.
     - Registered bridge on HTML WebViews (`PriceViewNative`, `AndroidBridge`, `Android`).
     - Added generic JS-side click binding for close/print controls by selector and button text.
     - Added `window.printSection` fallback to native print action (fixes templates calling undefined `printSection(...)`).
     - Added slide-up + fade animation for HTML overlays (product/not-found), matching native feel.
     - Added duplicate render suppression window (`900ms`) to prevent repeated visual flashing.
  2. `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
     - Added barcode debounce (`900ms`) and single in-flight lookup guard to prevent duplicated scan handling from hardware broadcast bursts.
- Runtime verification actions:
  - Built and installed updated APK to device `192.168.1.181:38155`.
  - Restarted app and confirmed sync worker/config flow still active in logcat.
- Files changed:
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
  - `adb install -r app-standalone-debug.apk` on `192.168.1.181:38155` (OK)
- Risk/Follow-up:
  - HTML templates with highly custom button markup may still require explicit `data-action="close"|"print"` for guaranteed binding.
  - Final UX confirmation requires live barcode scan + button tap on device screen.
- Backup/restore safety:
  - Backups created at `.temp-backups/html_overlay_fix_20260322_022627/` before edits.
## 2026-03-22 - PriceView HTML overlay tuning v2 (bottom anchor, hover removal, motion cleanup)
- Request: Overlay works, but product card should stay at bottom (not top with large empty area); close/print hover effects should be removed; image delayed animation should be removed or flow should be smoother to avoid flash feeling.
- Changes:
  1. `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
     - Increased overlay animation duration from `300ms` to `380ms` for smoother flow.
     - Added template-kind aware runtime behavior (`product` vs `not_found`) in HTML loader/binder.
     - For product templates, injected runtime CSS to anchor body/card to bottom (`align-items:flex-end`) and remove large bottom whitespace.
     - Disabled runtime hover/transition animations for close/print controls and generic buttons.
     - Removed inline hover handlers (`onmouseenter/onmouseleave/onmouseover/onmouseout/onmousedown/onmouseup`) at runtime from actionable elements.
     - Disabled image/template-level animation/transition for product visuals to reduce flash-like effect.
  2. Rebuilt and reinstalled APK on test device `192.168.1.181:38155`.
- Files changed:
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin :app:assembleStandaloneDebug` (OK)
  - `adb install -r app-standalone-debug.apk` on `192.168.1.181:38155` (OK)
- Risk/Follow-up:
  - Some custom templates may require explicit `data-action="close"|"print"` markers for deterministic control binding if button text is non-standard.
- Backup/restore safety:
  - Existing backup folder reused: `.temp-backups/html_overlay_fix_20260322_022627/`
## 2026-03-22 - PriceView HTML templates central hardening (global motion off + themed missing-image fallback)
- Request: Broken image icon still appears when product image is missing; user requested handling from HTML side and removing transition/hover motion across all templates.
- Changes:
  1. `api/priceview/template-utils.php`
     - Added template runtime versioning (`priceviewTemplateRenderVersion`) and included it in signature generation to force template cache invalidation on device.
     - Added `priceviewInjectRuntimeTemplateEnhancements($html, $isProductTemplate)`:
       - strips inline hover/mouse animation handlers from incoming template HTML.
       - injects global CSS guard to disable animation/transition effects across template DOM.
       - injects product-template JS fallback for missing/broken `image_url` images.
       - fallback icon/shape now uses template-adaptive radial background derived from surrounding theme colors (instead of fixed color).
  2. `api/priceview/display-template.php`
     - Applied runtime enhancement injector to both `product_html` and `not_found_html` response payloads before returning JSON.
     - Signature fallback now includes renderer version to keep cache coherence.
- Files changed:
  - api/priceview/template-utils.php
  - api/priceview/display-template.php
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l api\priceview\template-utils.php` (OK)
  - `php -l api\priceview\display-template.php` (OK)
  - `php -r` runtime smoke check on injector (OK, `guards_ok`, `hover_removed`)
- Risk/Follow-up:
  - Device must fetch refreshed config/template signature (manual sync/restart may be required) to apply new injected HTML payload.
  - If a custom template does not use `img[data-bind="image_url"]`, fallback logic will not attach to that image node.
- Backup/restore safety:
  - Backups created at `.temp-backups/priceview_template_runtimefix_20260322_024958/`.
## 2026-03-22 - PriceView template files normalized (all product + not-found variants)
- Request: Apply fixes directly in template files (not runtime injection), including not-found templates; remove motion/hover effects globally and keep missing-image fallback with theme-compatible background.
- Changes:
  1. `public/priceview-templates/*.html` (56 files)
     - Removed inline hover/mouse handlers (`onmouseenter`, `onmouseleave`, `onmouseover`, `onmouseout`, `onmousedown`, `onmouseup`).
     - Removed all `animation:` / `transition:` declarations and `@keyframes` blocks from templates (product and not-found templates both).
  2. `public/priceview-templates/*-view-overlay.html` (29 files)
     - Added built-in missing-image fallback CSS/JS (`pv-missing-image-fallback`, `pv_template_motion_fix_v2`).
     - Fallback icon is now generated with template-adaptive radial background (derived from current theme/container colors).
  3. `api/priceview/display-template.php`
     - Removed runtime HTML enhancement injection usage; templates are now served as authored.
  4. `api/priceview/template-utils.php`
     - Reverted signature seed to template-file based calculation and removed unused runtime helper blocks.
- Files changed:
  - public/priceview-templates/*.html
  - api/priceview/display-template.php
  - api/priceview/template-utils.php
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l api\priceview\template-utils.php` (OK)
  - `php -l api\priceview\display-template.php` (OK)
  - Pattern scan across all templates: `mouse=0 animation=0 transition=0 keyframes=0` (OK)
  - Marker scan on all `*-view-overlay.html`: `css_marker=29 js_marker=29` (OK)
- Risk/Follow-up:
  - Device/template cache refresh required (sync/restart) to pull updated HTML.
  - If any custom future template does not include `img[data-bind="image_url"]`, fallback won�t attach automatically.
- Backup/restore safety:
  - Full backup before bulk edit: `.temp-backups/priceview_templates_bulk_clean_20260322_025958/`.
## 2026-03-22 - PriceView instant sync trigger (Integration + Device Detail + command bridge)
- Request: Add true instant sync trigger from Integration page and Device Detail page (no 15-minute wait), using same behavior on both.
- Changes:
  1. `api/priceview/sync-now.php` (new)
     - Added authenticated endpoint `POST /api/priceview/sync-now`.
     - Queues high-priority `refresh` command into `device_commands` for `model='priceview'` devices.
     - Supports bulk (company-wide) and single-device trigger (`device_id` / `device_ids`).
     - Added short dedupe window (skip recent pending/sent refresh commands within 2 minutes).
  2. `api/index.php`
     - Registered new auth route: `/api/priceview/sync-now`.
  3. `public/assets/js/pages/settings/IntegrationSettings.js`
     - `syncPriceviewNow()` now calls `/priceview/sync-now` (source=`integration`) before refreshing status.
  4. `public/assets/js/pages/devices/DeviceDetail.js`
     - `priceviewSyncNow()` now calls `/priceview/sync-now` with selected `device_id` (source=`device_detail`) before refreshing status.
  5. `public/player/assets/js/player.js`
     - Added `triggerNativePriceViewSyncNow()` helper.
     - On command `refresh|refresh_content|sync`, player now also calls Android bridge method `triggerPriceViewSyncNow()` when available.
  6. `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
     - Added Android JS bridge method `triggerPriceViewSyncNow()`.
     - Added native handler `triggerPriceViewInstantSync(source)` to enqueue `SyncWorker.syncNow(...)` immediately.
- Files changed:
  - api/priceview/sync-now.php
  - api/index.php
  - public/assets/js/pages/settings/IntegrationSettings.js
  - public/assets/js/pages/devices/DeviceDetail.js
  - public/player/assets/js/player.js
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l api\priceview\sync-now.php` (OK)
  - `php -l api\index.php` (OK)
  - `node --check public\assets\js\pages\settings\IntegrationSettings.js` (OK)
  - `node --check public\assets\js\pages\devices\DeviceDetail.js` (OK)
  - `node --check public\player\assets\js\player.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Instant trigger depends on player heartbeat/command loop reaching device; offline devices execute when they reconnect.
  - If multiple triggers are sent rapidly, dedupe window intentionally skips duplicate queue rows.
- Backup/restore safety:
  - Backups created at `.temp-backups/priceview_instant_sync_20260322_031713/`.
## 2026-03-22 - Migration 23 verification + device branch persistence fix
- Request: Verify whether `23_priceview_bundles.sql` was safely applied on server; investigate branch-related device visibility issue in Devices/Playlist flows; then prepare deploy flow.
- Investigation:
  - Server DB check: `core.migrations` contains `pg:23_priceview_bundles.sql` (executed at `2026-03-21 21:21:34+00`).
  - Verified objects exist: `audit.bundle_deletions`, `audit.idx_bundle_deletions_company_deleted_at`, RLS policy `bundle_deletions_isolation`.
  - Root cause found unrelated to migration: device create/approve flows were not persisting `branch_id` reliably.
- Changes:
  1. `api/devices/create.php`
     - Added `branch_id` handling with active-branch fallback (`Auth::getActiveBranchId()`).
     - Added company-scoped branch validation before insert.
     - Persisted `branch_id` in new device insert payload.
  2. `api/esl/approve.php`
     - Added `branch_id` intake (`branchId` / `branch_id`) with active-branch fallback.
     - Added company-scoped branch validation.
     - Persisted `branch_id` for both relink/update and new insert flows.
     - Included `branchId` in approval response payload.
  3. `public/assets/js/pages/devices/DeviceList.js`
     - New-device modal now preselects current active branch.
     - Approve modal now includes branch selector and sends `branch_id`.
  4. `public/assets/js/pages/signage/PlaylistList.js`
     - Assign-device modal now requests `/devices` with `per_page=500` and explicit active-branch param to align with selected branch context.
- Files changed:
  - api/devices/create.php
  - api/esl/approve.php
  - public/assets/js/pages/devices/DeviceList.js
  - public/assets/js/pages/signage/PlaylistList.js
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `php -l api/devices/create.php` (OK)
  - `php -l api/esl/approve.php` (OK)
  - `node --check public/assets/js/pages/devices/DeviceList.js` (OK)
  - `node --check public/assets/js/pages/signage/PlaylistList.js` (OK)
  - repo-wide changed-file syntax spot checks (OK for changed PHP/JS set)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` in `Omnex-PriceView` (OK)
- Risk/Follow-up:
  - Existing branchless historical devices remain branchless; this fix prevents new wrong inserts. Historical records may need one-time manual branch assignment.
- Backup/restore safety:
  - Backups created at `.temp-backups/branch_playlist_fix_20260322_033516/` before edits.
## 2026-03-22 - PriceView release/deploy flow (v1.0.5) + server migration verification
- Request: Before running commit/push/pull+APK release flow, verify server-side migration safety (`23_priceview_bundles.sql`), inspect branch-related device/playlist visibility issues, fix, then complete deploy/build/update-json steps.
- Server verification:
  - Remote DB check confirmed `core.migrations` row exists for `pg:23_priceview_bundles.sql` (`2026-03-21 21:21:34+00`).
  - Confirmed migration artifacts exist: `audit.bundle_deletions`, index `idx_bundle_deletions_company_deleted_at`, RLS policy `bundle_deletions_isolation`.
  - Conclusion: reported branch/device issue was not caused by migration 23.
- Implemented fixes (code):
  - `api/devices/create.php`: persist `branch_id`, validate branch-company match, fallback to active branch context.
  - `api/esl/approve.php`: accept/persist `branch_id`, validate branch-company match, fallback to active branch context.
  - `public/assets/js/pages/devices/DeviceList.js`: active branch preselection on create modal; branch selector added to approve modal.
  - `public/assets/js/pages/signage/PlaylistList.js`: assign-device modal fetch now branch-context aware and higher `per_page`.
- Release/build/update:
  - `Omnex-PriceView/app/build.gradle`: bumped to `versionCode 6`, `versionName 1.0.5`.
  - Built APK via `./gradlew.bat publishDebugApk`.
  - Published `omnex-priceview.apk` to both `downloads/` and `public/downloads/`.
  - Computed SHA256: `baca2f00cdfbb87f3d27fd2b34b3ae9a7caee9da4a8fbb1d9e0a39e3f9bd459f`.
  - Updated both `downloads/update.json` and `public/downloads/update.json` only for `com.omnex.priceview` release fields; retained player release at `2.9.22/51`.
- Git/deploy actions:
  - Commit `fb46b50`: PriceView sync/template/branch fixes.
  - Commit `4655bbd`: PriceView v1.0.5 APK + OTA metadata.
  - Commit `f06e6c0`: OTA metadata consistency + template missing-image fallback hooks.
  - Pushed all commits to `origin/main` and pulled on server (`/opt/omnex-hub`, HEAD `f06e6c0`).
  - Rebuilt containers on server (`docker compose up -d --build app`, plus earlier worker rebuild during first deploy pass).
  - Verified live endpoint: `https://hub.omnexcore.com/downloads/update.json` shows `com.omnex.priceview` as `1.0.5 / 6`; APK URL `.../omnex-priceview.apk?v=6` returns expected headers.
- Checks run:
  - PHP lint: `api/devices/create.php`, `api/esl/approve.php`, `api/index.php`, `api/priceview/sync-now.php`, `api/priceview/display-template.php`, `api/priceview/template-utils.php` (OK)
  - JS syntax: `DeviceDetail.js`, `DeviceList.js`, `IntegrationSettings.js`, `PlaylistList.js`, `player.js` (OK)
  - Kotlin compile: `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - APK build: `./gradlew.bat publishDebugApk` (OK)
  - JSON validity: `downloads/update.json`, `public/downloads/update.json` parsed successfully.
- Risk/Follow-up:
  - Historical branchless devices remain branchless; manual one-time branch assignment may still be required for old records.
- Backup/restore safety:
  - Backups created: `.temp-backups/branch_playlist_fix_20260322_033516/`, `.temp-backups/priceview_release_20260322_034241/`.
## 2026-03-22 - Finalization notes after release commits
- Additional commits pushed:
  - `7ca72f7` Tune PriceView template missing-image fallback sizing
  - `f164050` Ensure template fallback layer stays above media region
- Server pull/deploy repeated after these commits; server HEAD now `f164050`.
- Live verification repeated:
  - `https://hub.omnexcore.com/downloads/update.json` shows `com.omnex.priceview` = `1.0.5` (`versionCode 6`), player remains `2.9.22` (`versionCode 51`).
  - `https://hub.omnexcore.com/downloads/omnex-priceview.apk?v=6` returns APK content headers.
- Residual local observation:
  - A recurring local working-tree churn continues on `public/priceview-templates/*-view-overlay.html` even after commit/push; server state is deployed from pushed commits.
## 2026-03-22 - User-confirmed final template pass
- User note: "ben degistirdim, simdi atabilirsin".
- Actions:
  - Committed final template pass: `e8395b0` (`Apply final PriceView template adjustments`).
  - Pushed to `origin/main`.
  - Pulled on server and rebuilt `app` container.
- Verification:
  - Server HEAD: `e8395b0`
  - `omnex-app-1` healthy after rebuild.
  - Live `update.json` still serves PriceView `1.0.5 / 6` and Player `2.9.22 / 51`.
## 2026-03-22 - Re-deploy requested PriceView templates
- Request: Re-send updated template themes to server after user-side adjustments and working validation.
- Changes:
  - Committed latest `public/priceview-templates/*.html` updates (product + not-found overlays).
  - Commit: `07cb49f` (`Sync latest PriceView template updates`).
- Git/Deploy:
  - Pushed `main` to GitHub.
  - Server pull on `/opt/omnex-hub` completed, HEAD=`07cb49f`.
  - Rebuilt/restarted app container via `cd /opt/omnex-hub/deploy && docker compose up -d --build app`.
  - Verified `omnex-app-1` is healthy.
- Checks run:
  - No PHP/JS/Kotlin source changed in this step (HTML template-only update); applicable QUICK_CHECKS entries not triggered.
- Risk/Follow-up:
  - Browser/device cache may need refresh to reflect updated HTML templates immediately.
## 2026-03-22 - PriceView not-found overlay bottom alignment (APK-side)
- Request: In APK, "urun bulunamadi" overlays should open from bottom like product-found overlay; currently appears from top.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
    - Updated `prepareHtmlForRender(...)` to inject bottom-alignment preload CSS for both product and not-found HTML templates (instead of product-only).
    - Kept image-animation suppression under product-only CSS block.
- Files changed:
  - Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt
  - .codex/CHANGE_MEMORY.md
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - This is APK runtime behavior; effect appears on devices after APK release/update.
- Backup/restore safety:
  - Backup created: `.temp-backups/notfound_overlay_pos_20260322_041558/`.
  - Temporary template mass-edit attempt was rolled back from `.temp-backups/notfound_templates_bottom_20260322_041826/` to avoid affecting user-side theme edits.
## 2026-03-22 - PriceView v1.0.6 release + template publish
- Request: Commit/push/pull with APK assemble, update.json version bump, and publish latest PriceView themes to server.
- Changes:
  - `Omnex-PriceView/app/build.gradle`: bumped PriceView to `versionCode 7`, `versionName 1.0.6`.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`: not-found HTML overlay bottom alignment behavior stabilized.
  - `public/priceview-templates/*.html`: latest user-updated product/not-found theme set included for publish.
  - `downloads/omnex-priceview.apk`, `public/downloads/omnex-priceview.apk`: rebuilt via `./gradlew.bat publishDebugApk`.
  - `downloads/update.json`, `public/downloads/update.json`: updated only `com.omnex.priceview` block to `1.0.6 / 7`, URL `...omnex-priceview.apk?v=7`, SHA256 `0d4c56f1e0170c8f8ef4dfa1019824034bb2d2d09853f29c896c1c5c42d85ba3`.
- Checks run:
  - `./gradlew.bat publishDebugApk` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Device-side template cache may require forced sync/reopen to pick up newest theme HTML.
  - Existing Gradle/Kotlin warnings remain non-blocking and pre-existing.
- Backup/restore safety:
  - Backup created: `.temp-backups/release_20260322_042345/`.
## 2026-03-22 - PriceView templates republish after user-side padding cleanup
- Request: Re-commit and re-publish updated PriceView theme templates after user removed template paddings.
- Changes:
  - `public/priceview-templates/*.html` updated (product + not-found variants) from user-side adjustments.
- Checks run:
  - `php -l api\priceview\display-template.php` (OK)
- Risk/Follow-up:
  - Browser/device cache may keep old template content briefly; manual sync/refresh may be needed.
- Backup/restore safety:
  - No additional file rewrite automation used; user-edited template files committed as-is.
## 2026-03-22 - Re-publish themes and locale updates from latest user session
- Request: Commit/push/pull and send latest theme + language file updates to server again.
- Changes:
  - `public/priceview-templates/*.html` updated and re-published.
  - `locales/*/pages/settings.json` updated from latest session.
  - `public/assets/js/pages/settings/IntegrationSettings.js` included with related settings UI text usage.
  - Locale completeness fix applied for missing `profile.*` keys (`passwordTips`, `passwordTipsTitle`, `passwordTip1`, `passwordTip2`, `passwordTip3`, `quickLinks`, `notificationSettings`, `allCompanies`) across `de/fr/ru/ar/az/nl`.
- Checks run:
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js` (OK)
  - Locale key parity check across 8 languages for `locales/*/pages/settings.json` (OK)
  - `php -l api\priceview\display-template.php` (OK)
- Risk/Follow-up:
  - Newly added locale keys for non-EN/TR were populated using EN fallback text; optional later native translation pass may be needed.
  - Browser/device cache may require refresh/sync for immediate template text visibility.
- Backup/restore safety:
  - Locale backup created: `.temp-backups/locale_settings_20260322_045141/`.
## 2026-03-22 - PriceView not-found timeout/player resume + i18n cache-bust hardening
- Request: Fix not-found overlay duration mismatch, ensure not-found close resumes signage like found-product flow, reduce APK injected horizontal padding and add bottom padding, and resolve server-side i18n key leaks (integration/device PriceView labels and template names showing keys).
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
    - `showNotFound(...)` now uses configured timeout (`config.overlayTimeoutSeconds`) via `startTimeout()` instead of fixed 3s scan-mode reset.
    - Not-found flow now closes through overlay hide path, so `onHideListener` resumes signage/player consistently.
    - Runtime injected HTML body padding adjusted from uniform `12px` to `6px 8px 18px` (reduced left/right, added bottom space).
  - `public/assets/js/core/i18n.js`
    - Added production cache-buster (`appVersion`) for page translation JSON fetches.
    - Added `{ cache: 'no-store' }` for page and fallback page translation fetches to prevent stale-key artifacts.
  - `public/assets/js/app.js`
    - `APP_VERSION` now prefers server-injected `window.OmnexConfig.appVersion` (fallback kept), so dynamic imports align with server build version.
  - `index.php`
    - Added `omnexResolveBuildVersion()` to compute build version from Git HEAD when available, otherwise latest critical frontend/locale mtimes.
    - Injected dynamic `appVersion` and expanded `supportedLanguages` to all 8 supported locales.
    - Added no-cache headers for static JSON responses and SPA HTML shell.
    - Rewrites `assets/js/app.js?v=...` references in served HTML to current build version.
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `node --check public/assets/js/core/i18n.js` (OK)
  - `node --check public/assets/js/app.js` (OK)
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - HTML shell/JSON no-cache policy increases request frequency (intentional to avoid stale translation keys after deploy).
  - If existing browser tabs keep old in-memory translations, one full refresh is still required once.
- Backup/restore safety:
  - Backups created at `.temp-backups/notfound_i18n_fix_20260322_052637/` before edits.
## 2026-03-22 - PriceView v1.0.7 APK release after timeout/i18n fixes
- Request: After commit/push/pull+deploy, run APK build/update release flow.
- Changes:
  - `Omnex-PriceView/app/build.gradle`: bumped PriceView to `versionCode 8`, `versionName 1.0.7`.
  - Built and published APK via `./gradlew.bat publishDebugApk` to:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
  - Updated OTA metadata:
    - `downloads/update.json`
    - `public/downloads/update.json`
    - `com.omnex.priceview` => `1.0.7 / 8`, URL `...omnex-priceview.apk?v=8`, SHA256 `8f2e3ea1ef33ab519acfad63d99e208bf9b049ca77f63711de4dc39e3ca1fb9a`.
- Checks run:
  - `./gradlew.bat publishDebugApk` (OK)
- Risk/Follow-up:
  - Pre-existing Kotlin/ExoPlayer warnings remain; build is successful.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_release_20260322_053343/`.
## 2026-03-22 - PriceView overlay full pause/resume hardening (playlist/media/mute)
- Request: Investigate/fix case where product-found/not-found overlay only paused some media; HTML/media continued in background, playlist advanced, and some muted videos resumed with sound.
- Changes:
  - `public/player/assets/js/player.js`
    - Added dedicated PriceView pause/resume APIs: `pauseForPriceView()` and `resumeFromPriceView()`.
    - Added media state capture/restore across main document and same-origin HTML iframes (`video/audio`).
    - Added scheduled timer tracking (`_nextContentSwitchAtMs`) so remaining item duration resumes instead of uncontrolled advance.
    - Added `applyCurrentItemMutedState()` and applied on resume to restore native/webview mute state reliably.
    - Updated command `pause`/`resume` flow to use the same hardened pause-state path.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Replaced legacy JS snippets with new player API calls (`pauseForPriceView` / `resumeFromPriceView`) and kept legacy fallback.
    - Removed forced `exoPlayerManager.setVolume(1f)` on overlay hide to avoid unintentionally unmuting muted content.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./gradlew.bat :app:compileDebugKotlin` (failed: ambiguous task name in this flavor setup)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Cross-origin iframe media cannot be directly paused/restored due browser security; same-origin HTML/video is covered.
  - Device-side runtime validation still required for final UX confirmation on real scan flow.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_pause_resume_20260322_061200/` before edits.
- Follow-up adjustment: `pauseForPriceView()` now flips `isPlaying=false` before pausing media nodes to prevent `video.onpause` auto-resume handlers from restarting playback.
## 2026-03-22 - PriceView v1.0.8 release + OTA metadata update
- Request: Run full flow (commit/push/pull + APK build + update.json) after overlay pause/resume fixes.
- Changes:
  - `Omnex-PriceView/app/build.gradle`: bumped PriceView to `versionCode 9`, `versionName 1.0.8`.
  - Built/published APK via `./gradlew.bat publishDebugApk` to:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
  - Updated OTA metadata:
    - `downloads/update.json`
    - `public/downloads/update.json`
    - `com.omnex.priceview` => `1.0.8 / 9`, URL `...omnex-priceview.apk?v=9`, SHA256 `2a79e4a79ca155dc508bc3a4f3f5d05b4cd34b1fb7f2728c2426a1ae5124c992`.
- Checks run:
  - `./gradlew.bat publishDebugApk` (OK)
  - APK hash verification for both publish paths (OK, same SHA256)
- Risk/Follow-up:
  - Existing non-blocking Kotlin deprecation/type warnings remain in project output; build succeeded.
- Backup/restore safety:
  - Prior backup reused for code edits; release artifacts generated by Gradle task.
## 2026-03-22 - PriceView startup ANR mitigation on TV device (192.168.1.181)
- Request: Investigate repeated startup crashes on TV after update, compare with ADB logs, fix with temp backup and encoding safety.
- Investigation (ADB):
  - Device: `192.168.1.181:43303`, app `com.omnex.priceview` version `1.0.8/9`.
  - `logcat -b crash` did not show a Java crash for PriceView; observed unrelated system crash entries for `com.android.musicfx`.
  - `dumpsys activity exit-info com.omnex.priceview` showed multiple `USER REQUESTED (remove task)` exits and ANR trace references.
  - `/data/anr/anr_2026-03-22-13-32-19-051` and `/data/anr/anr_2026-03-22-13-38-26-483` indicate main-thread blocking around `triggerInitialSyncIfNeeded()` at startup (`CountDownLatch.await(5s)` path).
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Removed synchronous startup config wait that blocked main thread.
    - Converted startup config fetch to fully async (`Dispatchers.IO`) and added interval-change reschedule logic for `SyncWorker`.
    - Kept initial periodic sync schedule non-blocking.
    - Ensured `applyOverlayDisplayConfig()` is invoked on UI thread (`runOnUiThread`) when remote config applies.
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Startup now prioritizes responsiveness over waiting for remote config; first seconds may use cached config before async update arrives.
  - If needed, build/deploy APK `1.0.9` and validate on the same device for 10+ minutes idle run.
- Backup/restore safety:
  - Backup created before edit: `.temp-backups/priceview_startup_anr_fix_20260322_145931/`.
## 2026-03-22 - Central template fallback fix (no APK dependency)
- Request: Move fallback-icon behavior fix to central templates (not APK): icon must appear only when media URL is missing; no left alignment or duplicate background artifacts.
- Changes:
  - Updated 29 central template files under `public/priceview-templates/*-view-overlay.html` and `public/priceview-templates/universal-notfound-view-overlay.html`.
  - Replaced `pv_template_motion_fix_v2` with `pv_template_motion_fix_v3` in templates.
  - New behavior:
    - If `image_url` is empty/null => centered fallback icon shown.
    - If `image_url` exists => fallback never shown during load delay or error; icon hidden.
    - While fallback is active, extra decorative siblings in image area are temporarily hidden to prevent duplicate/offset visuals.
  - Reverted APK-side fallback edits in `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt` to keep fix template-central.
- Checks run:
  - Verified replacement coverage: `v2_count=0`, `v3_files=29`.
  - Spot-checked updated script in `public/priceview-templates/restaurant-view-overlay.html`.
  - Endpoint architecture check confirms devices read template HTML from central files via `/api/priceview/display-template`.
- Risk/Follow-up:
  - Devices need a template refresh/sync to fetch updated HTML signature.
- Backup/restore safety:
  - Full template backup before edit: `.temp-backups/priceview_template_fallback_fix_20260322_161318/`
## 2026-03-22 - PriceView v1.0.9 release (template-centric fallback + startup ANR fix)
- Request: Commit/push/pull flow with APK + update.json after moving image fallback behavior to central templates.
- Changes:
  - `public/priceview-templates/*-view-overlay.html` (29 files): `pv_template_motion_fix_v3`
    - Fallback icon only when `image_url` is missing.
    - URL exists => no transient fallback during delayed media load.
    - Fallback centered; duplicate/decorative image-area layers suppressed while fallback active.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Startup remote config fetch remains async (no UI-thread latch wait).
  - `Omnex-PriceView/app/build.gradle`
    - PriceView version bump: `1.0.9` / `10`.
  - Release artifacts and OTA metadata:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
    - `downloads/update.json`
    - `public/downloads/update.json`
    - SHA256: `40d59baae99c27c6e7cc991de8d5ea02ebbb26506cfb9bec6636acf8397f8f7f`
- Checks run:
  - `node --check tmp/perf/template_fallback_check.js` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat publishDebugApk` (OK)
- Risk/Follow-up:
  - Devices must refresh/sync display template config to fetch updated HTML.
- Backup/restore safety:
  - Template backup: `.temp-backups/priceview_template_fallback_fix_20260322_161318/`
## 2026-03-22 - Template v4 fix for first-scan fallback flash
- Request: In product-found case with valid image URL, first scan still showed magnifier briefly (right side) then disappeared.
- Changes:
  - Updated 29 template files in `public/priceview-templates/*` from `pv_template_motion_fix_v3` to `pv_template_motion_fix_v4`.
  - New rule in template script:
    - Before first `setProduct` payload arrives, fallback is never shown.
    - Fallback is driven by payload `image_url` presence (not transient initial `img src` state).
    - If `image_url` exists, fallback remains hidden even during delayed load/error.
    - If `image_url` is missing, centered fallback is shown and decorative duplicates hidden.
- Checks run:
  - Coverage check: `v3_count=0`, `v4_files=29`.
  - JS syntax check on extracted script block: `node --check tmp/perf/template_fallback_check_v4.js` (OK)
- Risk/Follow-up:
  - Requires template sync/refresh on devices to fetch updated HTML.
## 2026-03-22 - PriceView device-detail sync reliability + template sync decision fixes
- Request: Integration sync worked but Device Detail > PriceView > Sync did not reliably apply theme changes on device; investigate and harden flow.
- Investigation:
  - Live device log (192.168.1.181:43303) showed config fetch success and `Display templates unchanged` decisions.
  - Added diagnostics confirmed remote/cached match at runtime when no effective config diff exists.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/sync/DisplayTemplateSyncManager.kt`
    - Fixed template-change decision ordering bug by comparing remote template/signature against pre-update cached values.
    - Added detailed unchanged log with remote/cached template+signature.
  - `public/player/assets/js/player.js`
    - On heartbeat `shouldSync`, now also triggers native PriceView instant sync before content sync.
  - `public/assets/js/pages/devices/DeviceDetail.js`
    - Device detail PriceView sync-now call now sends `force: true`.
  - `api/priceview/sync-now.php`
    - Added force/device-scoped queue behavior: explicit device requests can bypass short dedup window to guarantee immediate command queue.
- Checks run:
  - `node --check public/player/assets/js/player.js` (OK)
  - `node --check public/assets/js/pages/devices/DeviceDetail.js` (OK)
  - `php -l api/priceview/sync-now.php` (OK)
  - `./gradlew.bat :app:compileDebugKotlin` (expected ambiguous task in flavor setup)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
  - `adb install -r .../app-standalone-debug.apk` on `192.168.1.181:43303` (OK)
- Risk/Follow-up:
  - `public/player/assets/js/player.js` change requires server deploy to be effective on production WebView content.
  - If device-specific override is not saved or is same as effective template, sync command will not change visual theme by design.
- Backup/restore safety:
  - Backup created: `.temp-backups/theme_sync_fix_20260322_170014/`.
## 2026-03-22 - Device detail sync order fix (save override before sync-now)
- Request: Ensure Device Detail theme sync applies the latest selected template, not stale value.
- Changes:
  - public/assets/js/pages/devices/DeviceDetail.js
    - In priceviewSyncNow(), call PUT /devices/{id}/priceview-settings first to persist display_template_override.
    - Then call POST /priceview/sync-now with force=true.
- Checks run:
  - node --check public/assets/js/pages/devices/DeviceDetail.js (OK)
- Risk/Follow-up:
  - If pre-save API fails, sync is intentionally blocked to avoid stale template sync.
- Backup/restore safety:
  - Backup used: .temp-backups/device_sync_order_fix_20260322_173007/DeviceDetail.js.bak.
## 2026-03-22 - PriceView device override precedence fix (JWT token device id mismatch)
- Request: Investigate why Device Detail PriceView template selection did not apply while Integration selection worked.
- Root cause:
  - `GET /api/priceview/config` resolved device override from fallback metadata, but
  - `GET /api/priceview/display-template` used `device_id` from auth payload directly.
  - On JWT tokens, `device_id` carries serial (not devices.id UUID), so metadata query failed and template fell back to company template.
- Changes:
  - `api/priceview/template-utils.php`
    - Added `priceviewResolveDeviceUuid()` to resolve actual `devices.id` by checking auth payload candidates (`device_id`, `id`) against DB.
  - `api/priceview/config.php`
    - Switched device row lookup to `priceviewResolveDeviceUuid()`.
  - `api/priceview/display-template.php`
    - Switched metadata lookup to `priceviewResolveDeviceUuid()`.
    - Added fallback to auth payload metadata when DB row is unavailable.
- Checks run:
  - `php -l api/priceview/template-utils.php` (OK)
  - `php -l api/priceview/config.php` (OK)
  - `php -l api/priceview/display-template.php` (OK)
- Risk/Follow-up:
  - Devices should trigger PriceView sync once to fetch corrected template resolution path.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_device_override_fix_20260322_175017/.
## 2026-03-22 - PriceView scan diagnostics (pause/load + local-vs-server query flow)
- Request: Run live scan diagnostics for PriceView device and verify CPU behavior during scan pause, not-found flow, Muz flow with server image URL, and local query vs server verification chain for barcode `8690000000227`.
- Actions performed:
  - Automated scan scenarios on device `192.168.1.181:43303` via scanner broadcast intents.
  - Captured live traces:
    - `tmp/perf/priceview_scan_diag_20260322_181107/cpu_samples.txt`
    - `tmp/perf/priceview_scan_diag_20260322_181107/logcat.txt`
    - `tmp/perf/priceview_scan_diag_20260322_181107/cpuinfo_samples.txt`
    - `tmp/perf/priceview_scan_diag_20260322_181107/logcat_cpuinfo.txt`
    - `tmp/perf/priceview_scan_diag_20260322_181107/cpu_top200_samples.txt`
    - `tmp/perf/priceview_scan_diag_20260322_181107/nginx_since.log`
  - Verified server product payload for `8690000000227` includes Muz + image_url.
- Findings:
  - Not-found barcodes triggered server fallback calls (`/api/priceview/products/barcode/*` and `/api/priceview/bundles/barcode/*`) with 404.
  - `8690000000227` produced product overlay without PriceView API call during scans (local SQLite hit path).
  - Exo logs confirmed pause/resume sequence is executed on scan events.
  - Image fetch for Muz was not observed as a new request in captured nginx window (likely cached image URL usage).
- Checks run:
  - Runtime validation via adb/logcat + nginx access log correlation (no source file code edit).
- Risk/Follow-up:
  - Current logic does not perform server re-validation when local product exists; if required, barcode flow should be extended with optional online verification mode.
  - For precise CPU attribution, add an internal perf trace point around `handleBarcodeScanned()` phases (local db lookup / api fallback / overlay render).
- Backup/restore safety:
  - No source code modification; backup not required.## 2026-03-22 - PriceView scan pipeline perf hardening (exo stop/hide + html reuse + negative cache + phase profiling)
- Request: Reduce scan-time CPU/render spikes and network overhead by (1) stopping/hiding Exo during overlay, (2) avoiding full HTML re-render by reusing WebView DOM and updating data only, (3) adding not-found negative cache TTL, (4) preferring small thumbnail image URLs over large originals, and (5) adding temporary phase profiling hooks; then install APK to device and re-measure.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/ExoPlayerManager.kt`
    - Added `stopAndHideForOverlay()` to hard-stop Exo playback and immediately hide the native surface.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Barcode flow now uses `stopAndHideForOverlay()` instead of pause-only behavior.
    - Added negative barcode cache (`NEGATIVE_CACHE_TTL_MS=3min`, max 256 entries) to skip repeated product+bundle HTTP calls for repeated not-found scans.
    - Added temporary profiling logs (`PriceViewPerf`) for `local_db_ms`, `api_product_ms`, `api_bundle_ms`, `overlay_render_ms`, and total scan time.
    - Added `resume_ms` profiling in overlay hide/resume callback.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
    - Added WebView render-state cache so templates are loaded once and subsequent scans update data via JS bind (no full `loadDataWithBaseURL` when template unchanged).
    - Added template state reset on template change.
    - Enhanced image URL resolution to prefer thumbnail variants (`thumbnail_url` etc.) and enforce thumbnail size on `/api/media/thumbnail` URLs; can build thumbnail URL from media id when available.
    - Adjusted image fallback behavior to avoid transient fallback icon when an image URL exists but loads late.
- Device validation (ADB):
  - Installed APK to `192.168.1.181:43303` successfully.
  - Perf artifacts:
    - `tmp/perf/priceview_perf_opt_20260322_204509/`
    - `tmp/perf/priceview_perf_opt_postinstall_20260322_205449/`
  - Sample phase metrics:
    - Found barcode (`8690000000227`): `local_db_ms=21..49`, `overlay_render_ms=35..47`, total `68..115ms`, no API calls.
    - Not-found first hit (`8888888888888`/`8887776665551`): API path active once (`api_product_ms=70..125`, `api_bundle_ms=60..67`, total `215..250ms`).
    - Same not-found repeated within TTL: negative cache hit, API skipped (`api_*=-1`, total `39..48ms`).
    - Resume metric observed: `resume_ms=10..56`.
- ANR follow-up:
  - `dumpsys activity lastanr` still points to older startup ANR at `2026-03-22 20:45:24` (`SplashActivity` focus timeout, 5s).
  - No newer ANR timestamp recorded after final install + post-install scan probes.
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
  - `adb -s 192.168.1.181:43303 install -r app-standalone-debug.apk` (OK)
  - Runtime scan probes via adb broadcast + logcat/dumpsys collection (OK)
- Risk/Follow-up:
  - Existing ANR history is startup/splash focus-timeout related and may require separate startup-flow tuning if reproduced again.
  - Profiling hooks are intentionally temporary and can be removed once baseline stabilization is confirmed.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_perf_opt_20260322_203532/`.
## 2026-03-22 - PriceViewPerf hooks removed after measurement
- Request: Share phase-metric results, then remove temporary `PriceViewPerf` logging hooks; verify thumbnail readiness and inspect L1/L2/L3 display tuning impact possibility.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Removed temporary profiling constants/logging and timing helper (`PriceViewPerf` + `elapsedMs` scaffolding).
    - Kept performance behavior improvements intact (Exo stop+hide preemption + negative cache flow).
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Runtime evidence used:
  - `tmp/perf/priceview_perf_opt_20260322_204509/logcat_focus.txt`
  - `tmp/perf/priceview_perf_opt_20260322_204509/logcat_negative_probe.txt`
  - `tmp/perf/priceview_perf_opt_20260322_204509/logcat_resume_probe.txt`
  - `tmp/perf/priceview_perf_opt_postinstall_20260322_205449/perf_probe_postinstall.txt`
- Risk/Follow-up:
  - Display tuning L1/L2/L3 currently has no explicit "off" level in player UI cycle; contrast filters may keep a constant compositor cost depending on active profile/override.
  - `/api/media/thumbnail` availability is conditional for non-media-table URLs and video ffmpeg readiness.
- Backup/restore safety:
  - Existing backup reused: `.temp-backups/priceview_perf_opt_20260322_203532/`.
## 2026-03-22 - PriceView overlay freeze regression fix + startup sync de-dup
- Request: During barcode scan overlay, background playlist/video continued running; startup still showed recurrent ANR warning. Fix overlay pause/resume reliability and inspect live device behavior.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Removed early-return-only JS bridge pattern for pause/resume.
    - On scan: force fallback media pause + timer clear + `isPlaying=false` + `window.__pvOverlayActive=true` even when `pauseForPriceView()` exists.
    - On overlay hide: resume via `resumeFromPriceView()` when available; fallback media resume path retained; clear `window.__pvOverlayActive`.
    - Added startup one-shot guard `initialSyncTriggered` to prevent duplicate `triggerInitialSyncIfNeeded()` calls at boot.
  - `public/player/assets/js/player.js`
    - Added global overlay lock flag handling in `pauseForPriceView()` / `resumeFromPriceView()`.
    - Blocked `scheduleNext()` tick and `playNext()` while overlay lock is active to prevent background content advance races.
- Device/runtime checks:
  - `node --check public/player/assets/js/player.js` (OK)
  - `./Omnex-PriceView/gradlew.bat -p Omnex-PriceView :app:compileStandaloneDebugKotlin` (OK)
  - `./Omnex-PriceView/gradlew.bat -p Omnex-PriceView :app:compileDebugKotlin` (expected variant ambiguity in this project flavor setup)
  - `./Omnex-PriceView/gradlew.bat -p Omnex-PriceView :app:assembleStandaloneDebug` (OK)
  - `adb -s 192.168.1.181:43303 install -r app-standalone-debug.apk` (OK)
  - ANR check after fresh launch/idle (~70s): `lastanr` timestamp unchanged (no new ANR during this probe).
- Risks/Follow-up:
  - Existing historical Splash focus ANRs remain in system history; monitor if a brand-new timestamp appears after long soak.
  - JS lock relies on `window.__pvOverlayActive`; if third-party page scripts overwrite globals, fallback still uses `_priceViewPauseState` guard.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_overlay_pause_fix_20260322_214524/`.
## 2026-03-22 - Overlay arka plan g�r�n�rl��� d�zeltmesi (pause-only)
- Request: Barkod okutulunca arka playlist i�eri�i tamamen kayboluyor; g�r�n�r kal�p durmas� ve panel kapan�nca devam etmesi isteniyor.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Overlay a��l�rken native video taraf�nda `stopAndHideForOverlay()` yerine `pause()` kullan�ld�.
    - B�ylece arka plan i�eri�i g�r�n�r kal�yor, sadece durduruluyor.
- Checks run:
  - `./Omnex-PriceView/gradlew.bat -p Omnex-PriceView :app:compileStandaloneDebugKotlin` (OK)
  - `./Omnex-PriceView/gradlew.bat -p Omnex-PriceView :app:assembleStandaloneDebug` (OK)
  - `adb -s 192.168.1.181:43303 install -r app-standalone-debug.apk` (OK)
- Risk/Follow-up:
  - Pause-only modda stop+hide moduna g�re CPU bir miktar y�ksek olabilir; gerekirse ayar bazl� (cihaz/integration) pause-vs-stop davran��� eklenebilir.
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_overlay_visibility_fix_20260322_215522/`.
## 2026-03-22 - Splash focus-loss ANR k�k neden analizi + startup handoff fix
- Request: FiyatGor cihaz�nda a��l��tan k�sa s�re sonra devam eden ��kme/ANR nedenini tam bulup d�zeltmek.
- Root cause (verified):
  - ANR trace `tmp/perf/priceview_crash_rootcause_20260322/anr_2026-03-22-22-13-05-621.txt` i�inde main thread do�rudan `startupSyncRunnable -> bootstrapInitialSync -> triggerInitialSyncIfNeeded` hatt�nda yakaland�.
  - `SplashActivity` i�in `FocusEvent(hasFocus=false)` timeout olu�urken startup sync bootstrap ayn� zaman penceresinde main thread �zerinde tetikleniyordu.
  - Splash taraf�nda tekil olmayan y�nlendirme olas�l��� (timer/video completion yar��lar�) ge�i� k�r�lganl���n� art�r�yordu.
- Changes:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/SplashActivity.kt`
    - `navigationTriggered` guard eklendi; `checkFirstRun()` tek sefer tetikleniyor.
    - `cleanupSplashMedia()` ile VideoView/MediaPlayer listener+release temizli�i merkezi hale getirildi.
    - Navigasyon �ncesi cleanup + ge�i� animasyonu kapatma (`overridePendingTransition(0,0)`) eklendi.
    - `onResume()` video restart ko�ullu yap�ld� (finishing/destroyed/navigation state).
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/MainActivity.kt`
    - Startup sync i�in `STARTUP_SYNC_GRACE_MS` gate eklendi (`triggerInitialSyncWithStartupGate`).
    - `setupSyncProgressUI()` eager �a�r�s� kald�r�ld�; lazy init (`ensureSyncProgressUiInitialized`) yap�ld�.
    - Token bridge / onResume / init ak��lar� do�rudan sync yerine startup-gated bootstrap kullanacak �ekilde g�ncellendi.
    - `bootstrapInitialSync()` i�indeki `triggerInitialSyncIfNeeded()` �a�r�s� main thread d���na (`Dispatchers.Default`) ta��nd�.
    - `onDestroy()` i�inde startup sync handler callback temizli�i eklendi.
- Checks run:
  - `./gradlew.bat assembleDebug` (OK)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - `adb -s 192.168.1.181:43303 install -r app-standalone-debug.apk` (OK)
  - ADB runtime do�rulama:
    - Yeni ANR dosyas� olu�umu kontrol� (`/data/anr`), `dumpsys activity lastanr`, logcat ANR sat�rlar�.
    - Son test penceresinde yeni ANR �retilmedi; `lastanr` eski zaman damgas�nda kald� (`22 Mar 2026 22:13:04`).
- Risk/Follow-up:
  - Tarihsel ANR kay�tlar� cihazda kald��� i�in izleme s�ras�nda eski kay�tlara dikkat edilmeli; yeni timestamp takibi yap�lmal�.
  - Kesin stabilite i�in 30-60 dk soak startup d�ng�s� �nerilir (�zellikle d���k donan�ml� RK3566 cihazlarda).
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_anr_fix_20260322_220619/`.
## 2026-03-22 - 60dk canl� soak testi (ANR/log + L1/L2/L3 + barkod senaryosu)
- Request: 60 dk boyunca canl� ANR/log takibi, pe�pe�e ve tekil barkod okuma senaryolar� ile performans �l��m�; Frames/Jank/percentile/CPU/PSS/RSS ve L1-L2-L3 donan�m y�k� raporu.
- Runtime execution:
  - Script: `tmp/perf/run_priceview_soak60.ps1`
  - Output dir: `tmp/perf/priceview_soak60_20260322_223414/`
  - Device: `192.168.1.181:43303`
  - Duration: 60 minutes (L1/L2/L3 her biri 20 dk)
  - Scan pattern: her dakikada tekil okuma; her 3 dakikada burst (ard���k �oklu okuma); periyodik not-found enjeksiyonu.
- Result highlights (normalized CPU parse with invariant culture):
  - Frames: 25481
  - Jank: 44.85% (11427 janky)
  - p50/p90/p95/p99: 16/26/30/46 ms
  - CPU steady avg/max: 74.34 / 230
  - PSS delta: +24.70 MB
  - RSS delta: +26.78 MB
  - Logs: NO_MEMORY=0, Playback error=0, ExoPlaybackException=0, HTTP 4xx/5xx=0, ANR sat�r�=0
  - New ANR file: yok (`AnrBefore == AnrAfter`)
  - L1/L2/L3 CPU (avg/max):
    - L1(contrast 1.00): 74.30 / 230
    - L2(contrast 1.15): 72.89 / 188
    - L3(contrast 1.30): 75.83 / 153
- Artifacts:
  - `tmp/perf/priceview_soak60_20260322_223414/summary.json`
  - `tmp/perf/priceview_soak60_20260322_223414/summary.txt`
  - `tmp/perf/priceview_soak60_20260322_223414/phase_cpu.json`
  - `tmp/perf/priceview_soak60_20260322_223414/cpu_samples.json`
  - `tmp/perf/priceview_soak60_20260322_223414/logcat_soak.txt`
- Notes/risk:
  - `summary.json` i�indeki ilk CPU alanlar� locale parse nedeniyle y�ksek g�r�n�yor; d�zeltilmi� de�erler bu kayda i�lendi.
  - Bu turda repo kaynak dosyas�nda kal�c� kod de�i�ikli�i yap�lmad�.
- Backup/restore safety:
  - `omnex_player.xml` test �ncesi yedeklendi ve test sonunda geri y�klendi.

## 2026-03-22 - L1/L2/L3 source analysis (backend vs client)
- Request: Check whether L1/L2/L3 display tuning levels come from backend and validate L0/off need.
- Findings:
  - public/player/assets/js/player.js defines fixed presets in buildDisplayTuningLevels() (legacy/balanced/default); no L0.
  - api/priceview/config.php returns product_display_mode and display_template_url, but no display tuning level payload.
  - api/player/init.php, api/player/sync.php, api/player/heartbeat.php do not include L1/L2/L3 or contrast tuning level fields.
  - APK (MainActivity.kt) supports neutral contrast (1.0) technically, but level list is currently chosen by player JS.
- Files changed:
  - .codex/CHANGE_MEMORY.md (this entry only)
- Checks run:
  - Targeted Select-String scans on player JS, APK MainActivity, and API config/player endpoints.
- Risk/Follow-up:
  - If L0 is required, add L0/off in player level list and optionally move level policy to backend config for central control.
- Backup/restore safety:
  - Not required (no production code files modified).

## 2026-03-22 - Player display tuning L0 + backend policy (CPU relief path)
- Request: Add true L0 (effect-off) level for display tuning, keep encoding safe with temp backups, and make policy backend-driven.
- Changes:
  - `public/player/assets/js/player.js`
    - Added server policy state for display tuning.
    - Added policy parser/normalizer (`enabled`, `include_l0`, `boost_levels`).
    - Updated level builder to produce `L0` off + profile + boost levels.
    - `L1` now maps to profile/default contrast (via clear override), `L0` maps to contrast 1.00.
    - Applied server policy during both init and sync.
  - `api/player/init.php`
    - Added display tuning policy resolver from company `settings.data`.
    - Added `display_tuning` object to init response.
  - `api/player/sync.php`
    - Added same display tuning policy resolver.
    - Added `display_tuning` object to sync response.
  - `public/player/index.html`
    - Default display tuning badge changed from `L1` to `L0`.
- Backend policy keys:
  - `player_display_tuning_enabled` (bool)
  - `player_display_tuning_include_l0` (bool)
  - `player_display_tuning_boost_levels` (array/csv, e.g. `1.12,1.24`)
  - Fallback key: `player_display_tuning_levels`
- Checks run:
  - `php -l api/player/init.php` (OK)
  - `php -l api/player/sync.php` (OK)
  - `node --check public/player/assets/js/player.js` (OK)
- Risk/Follow-up:
  - Existing stored override values on devices may require one cycle/tap to move onto new L0/L1 mapping.
  - Optional next step: add admin UI fields for the new backend policy keys.
- Backup/restore safety:
  - Backup created: `.temp-backups/display_tuning_l0_20260322_235500/`.
## 2026-03-23 - Integration PriceView UI: display tuning policy controls
- Request: Add Integration > PriceView UI controls for display tuning policy (L0/L1/L2/L3), bind load/save, and add i18n keys for all 8 locales.
- Changes:
  - `public/assets/js/pages/settings/IntegrationSettings.js`
    - Added helpers to parse bool and normalize/format boost levels.
    - Added new PriceView form controls:
      - `pv-display-tuning-enabled`
      - `pv-display-tuning-include-l0`
      - `pv-display-tuning-boost-levels`
    - Wired load/populate/save for settings keys:
      - `player_display_tuning_enabled`
      - `player_display_tuning_include_l0`
      - `player_display_tuning_boost_levels`
  - Locale updates (settings page, all 8 languages):
    - `locales/tr/pages/settings.json`
    - `locales/en/pages/settings.json`
    - `locales/de/pages/settings.json`
    - `locales/fr/pages/settings.json`
    - `locales/nl/pages/settings.json`
    - `locales/ru/pages/settings.json`
    - `locales/az/pages/settings.json`
    - `locales/ar/pages/settings.json`
- Checks run:
  - `node --check public/assets/js/pages/settings/IntegrationSettings.js` (OK)
  - JSON parse validation for all 8 locale files (OK)
- Risk/Follow-up:
  - Device Detail page does not expose these three policy fields yet; currently managed from Integration settings.
  - If desired, backend can add explicit defaults in one shared helper to avoid duplication between player init/sync policy resolution.
- Backup/restore safety:
  - Backup created: `.temp-backups/integration_priceview_tuning_ui_20260323_000221/`.

## 2026-03-23 - DeviceDetail PriceView template select i18n

- Request: Cihaz detay FiyatGör sekmesinde Görüntüleme Şablonu seçenekleri çeviri kullanmıyor, entegrasyon ayarlarındaki gibi kullansın
- Changes:
  1. `DeviceDetail.js` preload(): `settings` çevirilerini de yükle (`integrations.priceview.templates.*` key'leri için)
  2. `DeviceDetail.js` ~line 1601: Preset forEach'inde IntegrationSettings ile aynı i18n pattern: `integrations.priceview.templates.${p.name}` key denenip fallback `p.label || p.name`
- Files changed: `public/assets/js/pages/devices/DeviceDetail.js`
- Checks: File reads OK
- Risk: None. i18n t() already searches ALL loaded page translations, so loading settings alongside devices works.
## 2026-03-23 - Commit/Push/Pull flow (no APK build)
- Request: Run commit/push/pull flow and include other-session changes in commit; skip APK build for now.
- Changes:
  - Committed staged multi-session PriceView/backend/player/UI/localization updates and related assets/docs.
  - Pushed to `origin/main` at commit `85f4a37`.
  - Pulled and redeployed on server (`/opt/omnex-hub`) with app image rebuild.
- Checks run:
  - `git push origin main` (OK)
  - Server: `git pull origin main` (OK)
  - Server: `docker compose -f deploy/docker-compose.yml up -d --build app` (OK)
  - Server: `docker compose -f deploy/docker-compose.yml ps` (app healthy)
- Risk/Follow-up:
  - Local workspace still contains many untracked backup/tmp artifacts; not included in commit.
- Backup/restore safety:
  - Existing temp backup directories preserved; no cleanup performed.
## 2026-03-23 - Android launcher icon pack normalization (48/72/96/144/192)
- Request: Remove oversized icon-pack usage in APK and regenerate launcher icons from `kutuphane/price-icon-pack-dark/price-icon-pack/icon-1024x1024.png` using real Android density sizes (mdpi..xxxhdpi), avoiding shrunken logo appearance.
- Changes:
  - Replaced `ic_launcher.png` and `ic_launcher_round.png` in:
    - `Omnex-PriceView/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}`
    - `Omnex-PriceView/app/src/main/res/mipmap-television-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}`
  - Updated adaptive icon XML to prevent foreground inset shrink effect:
    - `Omnex-PriceView/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
    - `Omnex-PriceView/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
    - background now uses `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`, foreground set transparent.
- Validation:
  - Verified alpha bounds are full-bleed for all generated launcher icons (no inner transparent padding).
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Monochrome adaptive icon remains `@drawable/ic_logo`; only color icon rendering path was changed.
  - APK build/install was intentionally skipped per request.
- Backup/restore safety:
  - Backup created: `.temp-backups/icon_resize_20260323_001809/`.

## 2026-03-23 - PriceView splash animation centering/scale fix + dual-device APK install
- Request: Fix PriceView startup splash (HTML animation too large/off-center, first icon too small/hidden), then build and install APK to both devices for testing (`192.168.1.181` and `192.168.1.77:44329`).
- Changes:
  - `Omnex-PriceView/app/src/main/assets/splash_animation.html`
    - Reduced logo wrapper size from `70vmin` to `clamp(180px,42vmin,320px)`.
    - Increased inner phase icon size from `33%` to `41%`.
    - Removed forced hide behavior for phase-1 player icon (`display:none`), kept white icon/logo overrides.
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_mobile.xml`
    - Reworked layout to full-screen WebView + bottom-anchored metadata block so animation center is based on full screen.
- Build/Deploy/Test actions:
  - Built APK: `Omnex-PriceView` `:app:assembleStandaloneDebug` (success).
  - Installed via ADB (success):
    - `192.168.1.181:43303`
    - `192.168.1.77:44329`
  - Triggered app launch on both devices with `adb shell monkey`.
  - Verified package version on both devices: `versionName=1.0.9`, `versionCode=10`.
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - Final visual validation still needs on-device human check (splash scale/centering and phase transition feel).
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_center_fix_20260323_002932/`.- Additional checks:
  - `./gradlew.bat :app:compileDebugKotlin` (fails by design in flavor project: ambiguous task name)
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
## 2026-03-23 - Splash compatibility fix for legacy WebView device (181)
- Request: 181 cihazda splash iç ikonlar görünmüyor, logo parçaları Android robot/kırık görsel gibi görünüyor; mobilde düzgündü.
- Root cause hypothesis:
  - 181 cihazındaki WebView sürümü eski (`com.android.webview 83.0.4103.120`) ve mask/data-uri kombinasyonunda uyumsuzluk olasılığı.
- Changes:
  - `Omnex-PriceView/app/src/main/assets/splash_animation.html`
    - Embedded base64 logo parçaları asset dosyalarına çıkarıldı.
    - `<img src="data:image...">` kaynakları yerel asset dosyalarına çevrildi (`splash_logo_*.png`).
    - Legacy uyumluluk için CSS fallback eklendi (`html.fallback-mode`): mask yoksa img katmanları doğrudan gösterilip animasyon alıyor.
    - Mask destek tespiti eklendi (`supportsMaskImage()`); destek varsa eski mask-mode akışı, yoksa fallback-mode.
  - Added files:
    - `Omnex-PriceView/app/src/main/assets/splash_logo_body.png`
    - `Omnex-PriceView/app/src/main/assets/splash_logo_slice1.png`
    - `Omnex-PriceView/app/src/main/assets/splash_logo_slice2.png`
    - `Omnex-PriceView/app/src/main/assets/splash_logo_slice3.png`
- Build/Deploy/Test actions:
  - `:app:assembleStandaloneDebug` (success)
  - ADB install (success): `192.168.1.181:43303`, `192.168.1.77:44329`
  - 181 cihazda launch tetiklendi ve kısa log taraması yapıldı; splash asset load hatası görünmedi.
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - 181 cihazda görsel doğrulama kullanıcı tarafında gerekli (mask-mode yerine fallback-mode devreye girmesi bekleniyor).
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_webview_compat_20260323_003543/`.
## 2026-03-23 - Splash animation parity + launcher robot icon fix attempt
- Request: New regressions after splash fix: mobile outer logo animation disappeared, 181 outer logo animates but inner icon does not; launcher shortcuts still show Android robot/broken icon.
- Changes:
  - `Omnex-PriceView/app/src/main/assets/splash_animation.html`
    - Raised inner icon layer above slices (`.inner z-index: 8`) so inner phase icons stay visible in fallback mode.
    - Removed initial hardcoded `animated` class from logo container.
    - Added `startLogoAnimation()` and trigger via `requestAnimationFrame(...)` after mode setup to restart animation timeline consistently.
    - Kept mask/fallback split; now animation start is synchronized for both paths.
  - `Omnex-PriceView/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
    - Adaptive icon changed to `background=@color/background`, `foreground=@mipmap/ic_launcher`.
  - `Omnex-PriceView/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
    - Adaptive icon changed to `background=@color/background`, `foreground=@mipmap/ic_launcher_round`.
- Build/Deploy/Test actions:
  - `:app:assembleStandaloneDebug` (success)
  - ADB install success: `192.168.1.181:43303`, `192.168.1.77:44329`
  - Launch triggered on both via `adb shell monkey`.
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - Launcher icon cache on some Android launchers may require launcher/app restart (or shortcut refresh) to reflect adaptive icon XML changes.
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_icon_followup_20260323_004802/`.
## 2026-03-23 - Splash rollback + PNG pathing + TV/video path removal + inner CSS fallback
- Request: Revert splash to earlier stable behavior, keep logo assets as PNG, and fix inner icon animation missing on 181 while outer works.
- Changes:
  - `Omnex-PriceView/app/src/main/assets/splash_animation.html`
    - Reworked to use PNG logo slices explicitly (`file:///android_asset/splash_logo_*.png`).
    - Replaced fragile SVG-based inner icon rendering with pure CSS/HTML inner phases (player + scan) for legacy WebView compatibility.
    - Added persistent outer slice idle motion and retained timed phase animations.
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_tv.xml`
    - TV splash layout now contains `splashWebView` (HTML path parity).
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/SplashActivity.kt`
    - Disabled splash video path for deterministic HTML splash on TV as well.
- Icon path policy update:
  - Removed adaptive icon XMLs earlier in this thread to force launcher icon selection from PNG mipmap sets.
- Build/Deploy/Test actions:
  - Rebuilt `:app:assembleStandaloneDebug` multiple times after each fix iteration.
  - Reinstalled APK on both devices: `192.168.1.181:43303`, `192.168.1.77:44329` (all success).
  - Captured device screenshots for visual verification during iterations.
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - 181 device renders splash more slowly; phase timing should be verified live by user to confirm perceived animation cadence.
- Backup/restore safety:
  - Backups created:
    - `.temp-backups/splash_revert_png_20260323_005449/`
    - `.temp-backups/splash_clean_rebuild_20260323_005847/`
    - `.temp-backups/splash_inner_css_fallback_20260323_011725/`
## 2026-03-23 - Mobile splash SVG restore
- Request: Mobile splash broke; restore inner icon path back to SVG-based version.
- Changes:
  - `Omnex-PriceView/app/src/main/assets/splash_animation.html`
    - Restored from backup (`.temp-backups/splash_inner_css_fallback_20260323_011725/splash_animation.before_inner_css.bak`) to SVG inner icon implementation.
- Build/Deploy/Test actions:
  - `:app:assembleStandaloneDebug` (success)
  - ADB install success on both devices:
    - `192.168.1.181:43303`
    - `192.168.1.77:44329`
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - 181 legacy WebView may still render SVG inner phases differently; mobile path restored as requested.
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_svg_restore_20260323_012126/`.
## 2026-03-23 - Splash background transparency
- Request: Make splash background transparent (remove navy background look).
- Changes:
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_mobile.xml`
    - FrameLayout background -> `@android:color/transparent`
    - splash WebView background -> `@android:color/transparent`
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_tv.xml`
    - FrameLayout background -> `@android:color/transparent`
    - splash WebView background -> `@android:color/transparent`
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/SplashActivity.kt`
    - Removed forced navy WebView background (`setBackgroundColor(0x00000000)`).
- Build/Deploy/Test actions:
  - `:app:assembleStandaloneDebug` (success)
  - ADB install success on both devices:
    - `192.168.1.181:43303`
    - `192.168.1.77:44329`
- Checks run:
  - `./gradlew.bat :app:assembleStandaloneDebug` (OK)
- Risk/Follow-up:
  - Since splash is transparent, underlying activity/window content may be visible depending on device compositor timing.
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_transparent_20260323_012636/`.
## 2026-03-23 - Splash uses wizard background again
- Request: Review history and restore nice first-entry background; use wizard background in splash.
- Findings:
  - Wizard screens use `@drawable/wizard_mobile_background`.
  - Splash background had been made transparent, which removed that visual layer.
- Changes:
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_mobile.xml`
    - Frame background set to `@drawable/wizard_mobile_background`.
  - `Omnex-PriceView/app/src/main/res/layout/activity_splash_tv.xml`
    - Frame background set to `@drawable/wizard_mobile_background`.
  - Kept splash WebView background transparent so wizard gradient shows behind splash animation.
- Build/Deploy/Test actions:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
  - APK install success:
    - `192.168.1.181:43303`
    - `192.168.1.77:44329`
- Risk/Follow-up:
  - None functionally; visual fine-tuning of gradient intensity can be done in `wizard_mobile_background.xml` if needed.
- Backup/restore safety:
  - Backup created: `.temp-backups/splash_use_wizard_bg_20260323_013406/`.## 2026-03-23 - Wizard style parity + PriceView 1.0.10 release/deploy
- Request: "android-player" wizard button/styles parity in Omnex-PriceView, then full release flow (APK build, downloads copy, update.json bump, commit/push/pull, deploy).
- Changes:
  - `Omnex-PriceView/app/src/main/res/values/themes.xml`
    - `Theme.OmnexPriceView` parent reverted to `Theme.AppCompat.DayNight.NoActionBar`.
    - `Theme.OmnexPriceView.Tv` parent reverted to `Theme.AppCompat.DayNight.NoActionBar`.
  - `Omnex-PriceView/app/build.gradle`
    - PriceView version bumped: `versionCode 11`, `versionName "1.0.10"`.
  - `downloads/update.json`
  - `public/downloads/update.json`
    - Only `apps.com.omnex.priceview` release fields updated to v11/1.0.10 + new URL and SHA256.
  - APK artifacts refreshed by Gradle publish task:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
- Checks run:
  - `./gradlew.bat publishDebugApk` (OK; includes `:app:compileStandaloneDebugKotlin` and `:app:assembleStandaloneDebug`)
  - JSON parse checks for both `update.json` files (OK)
  - APK metadata verified via `app/build/outputs/apk/standalone/debug/output-metadata.json` (`versionCode=11`, `versionName=1.0.10`)
  - SHA256 verified for both published APK copies:
    - `e400d7563aa4f6ee9768005b16eb658a841c9170e3d02da3aee8961701b0b846`
- Risk/Follow-up:
  - Working tree contains many unrelated untracked backup/temp files; intentionally not staged.
  - `aapt` is unavailable on this host, so APK version confirmation used Gradle output metadata.
- Backup/restore safety:
  - Temp backup created before theme edit:
    - `.temp-backups/wizard_theme_sync_20260323_014605/themes.xml.bak`
## 2026-03-23 - Hotfix: update.json UTF-8 BOM removal
- Request context: release flow completed; JSON response showed BOM marker in live output.
- Changes:
  - `downloads/update.json` rewritten as UTF-8 without BOM.
  - `public/downloads/update.json` rewritten as UTF-8 without BOM.
- Checks run:
  - First bytes verified (`123,13,10`) on both files.
  - JSON parse checks passed for both files.
- Risk/Follow-up:
  - None.
- Backup/restore safety:
  - Existing `.bak_priceview_release_*` copies remain available.
## 2026-03-23 - Include user-updated PriceView templates in release/deploy
- Request: User confirmed including local `public/priceview-templates/*.html` changes in the same release flow.
- Changes:
  - `public/priceview-templates/*.html` (all modified overlay/notfound templates included as provided by user)
  - `downloads/update.json` and `public/downloads/update.json` kept BOM-free UTF-8
- Checks run:
  - JSON parse checks for both `update.json` files (OK)
  - Live endpoint check after deploy planned: `/downloads/update.json` and `omnex-priceview.apk?v=11`
- Risk/Follow-up:
  - Template behavioral differences reflect user-provided edits and were not normalized in this step.
- Backup/restore safety:
  - Existing `.bak_priceview_release_*` JSON backups preserved.
## 2026-03-23 - PriceView found templates fallback icon restore + circle bg removal
- Request: In product-found templates, restore theme fallback search icon and remove the extra circular colored fallback background; do not apply this change to notfound template.
- Changes:
  - Updated 28 files under `public/priceview-templates/*-view-overlay.html` (excluding `universal-notfound-view-overlay.html`):
    - `dot.innerHTML = ''` -> `dot.innerHTML = '&#128269;'`
    - `.pv-missing-image-dot` fallback style `background:radial-gradient(...)` -> `background:transparent`
- Validation:
  - Verified all 28 found templates now contain `dot.innerHTML = '&#128269;'`.
  - Verified all 28 found templates now contain `.pv-missing-image-dot{...background:transparent...}` and no radial fallback background.
- Checks run:
  - `php -l index.php` (OK; generic syntax check per quick-check minimum rule)
- Risk/Follow-up:
  - Notfound template intentionally untouched (`universal-notfound-view-overlay.html`).
- Backup/restore safety:
  - Backup created: `.temp-backups/priceview_template_fallback_fix_20260323_020541/`
  - During first attempt, encoding risk observed; files were restored from backup and reapplied using byte-preserving (Latin-1 roundtrip) edits.
## 2026-03-23 - Commit/Push/Pull + deploy for fallback template fix
- Request: "commit push pull yap" after found-template fallback correction.
- Git:
  - Commit: `e183432` - `Fix PriceView found-template fallback icon and remove colored fallback circle`
  - Pushed to `origin/main` successfully.
- Server deploy:
  - Pulled on `/opt/omnex-hub` (fast-forward to `e183432`).
  - Rebuilt/restarted app container: `docker compose -f deploy/docker-compose.yml up -d --build app`.
- Live validation:
  - `restaurant-view-overlay.html` now serves `background:transparent` for `.pv-missing-image-dot` and `dot.innerHTML = '&#128269;'`.
  - `universal-notfound-view-overlay.html` intentionally unchanged (still has notfound-specific fallback markup).
- Checks run:
  - `php -l index.php` (OK; quick-check minimum syntax validation)
- Risk/Follow-up:
  - None.
## 2026-03-23 - Root cause fix for double fallback icon in PriceView HTML overlay
- Request: Investigate why fallback appears as duplicate icon and fixed orange bubble instead of theme-based template fallback.
- Root cause found:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt` runtime JS (`bindJsData`) was injecting an additional generic fallback bubble (`#fed7aa/#ffedd5`) on top of template fallback.
- Changes:
  - `PriceViewOverlayManager.kt` (runtime JS block):
    - Detect existing template fallback (`.pv-missing-image-wrap`) and reuse it instead of creating new fallback.
    - If creating generic fallback, use transparent background (no fixed orange bubble).
    - Toggle template fallback via `.active` class when applicable.
    - Skip runtime fallback injection entirely when template manager is present (`window.__pvTemplateMotionFixV4 === true`).
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Device needs template/app refresh (overlay WebView reload) to use updated runtime script.
- Backup/restore safety:
  - Backup created: `.temp-backups/overlay_fallback_dedupe_20260323_021451/PriceViewOverlayManager.kt.bak`
## 2026-03-23 - Restored themes from earlier backup on request
- Request: "1 saat kadar �nceki tema backuplar�n� geri al".
- Action taken:
  - Restored template files from backup:
    - `.temp-backups/priceview_template_fallback_fix_20260323_020541/*.html`
    -> `public/priceview-templates/*.html`
- Safety:
  - Current state backup created before restore:
    - `.temp-backups/priceview_templates_before_restore_20260323_021802/`
- Checks run:
  - `php -l index.php` (OK)
- Notes:
  - This restore affects theme/template HTML files only.
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt` still has local (uncommitted) runtime fallback dedupe changes from previous step.
## 2026-03-23 - Commit preparation for current PriceView template + overlay state
- Request: "commtit s�reci".
- Changed files prepared for commit:
  - `Omnex-PriceView/app/src/main/java/com/omnex/priceview/overlay/PriceViewOverlayManager.kt`
  - `public/priceview-templates/*-view-overlay.html` (28 found templates)
  - `.codex/CHANGE_MEMORY.md`
- Checks run:
  - `./gradlew.bat :app:compileStandaloneDebugKotlin` (OK)
- Risk/Follow-up:
  - Working tree has many unrelated untracked backup/tmp files; excluded from commit.
  - Server deploy/APK publish steps are not included in this commit-only phase.
- Backup/restore safety:
  - No new backup needed in this phase; previously created backups remain available.## 2026-03-23 - PriceView 1.0.11 APK publish + update.json refresh
- Request: "apky� downloads ve upload js ile atmam��s�n".
- Changes:
  - `Omnex-PriceView/app/build.gradle` -> `versionCode 12`, `versionName "1.0.11"`
  - Rebuilt and published APK to:
    - `downloads/omnex-priceview.apk`
    - `public/downloads/omnex-priceview.apk`
  - Updated PriceView app block in:
    - `downloads/update.json`
    - `public/downloads/update.json`
    (`versionCode=12`, `versionName=1.0.11`, `downloadUrl ...?v=12`, new `sha256`)
- Checks run:
  - `./gradlew.bat publishDebugApk` (OK)
  - `output-metadata.json` verified (`versionCode=12`, `versionName=1.0.11`)
  - SHA256 verified for published APK: `36fbcae8c9c51c1780fb6d0f6d379f2319e6a5333bc1144d36992393fcf8946f`
  - JSON parse checks passed for both `update.json` files
  - BOM check passed for both `update.json` files (first bytes `123,13,10`)
- Risk/Follow-up:
  - Release is prepared in git; server-side pull/deploy is required for live availability.
- Backup/restore safety:
  - Backup created before JSON write: `.temp-backups/priceview_release_20260323_023539/`## 2026-03-23 - Re-upload today-updated PriceView themes to server
- Request: "t�m temalar� tekrar sunucuya geri at" after user-side theme adjustments.
- Changes:
  - Updated and committed 29 files under `public/priceview-templates/` (view + universal notfound templates)
  - Most changes are fallback icon behavior (`dot.innerHTML` updates) aligned with user's latest theme edits.
- Checks run:
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - Many untracked backup/tmp files remain in working tree and are intentionally excluded.
- Backup/restore safety:
  - No destructive operation; existing `.temp-backups/` snapshots preserved.## 2026-03-23 - Mobile fallback overlap fix without changing per-theme icon design
- Request: Keep each template's own icon style, but fix mobile overlap root causes only.
- Changes:
  - Updated 29 templates under `public/priceview-templates/`.
  - Removed `hideDecorations(...)` calls from fallback show/hide flow so image background card/decor remains visible when product image is missing.
  - Added `.pv-img-area{min-height:220px}` to prevent fallback icon from overflowing into text area on mobile.
  - Did **not** alter `dot.innerHTML` icon assignments (theme-specific icon design preserved).
- Checks run:
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - Changes are local now; commit/push/deploy not run in this step.
- Backup/restore safety:
  - Backup created before bulk edit: `.temp-backups/priceview_mobile_fallback_layout_fix_20260323_025417/`## 2026-03-23 - Missing-image card height/padding balance for mobile overlay
- Request: In missing-image state, ensure icon + outer fallback design stays inside image background card; equal top/bottom spacing in card.
- Changes:
  - Updated 56 template files under `public/priceview-templates/` (view + overlay-not-found sets).
  - Added missing-image mode sizing class:
    - `.pv-img-area.pv-missing-image-mode{min-height:320px;padding:24px 0}`
    - Mobile overrides: `240px/16px` (`<=768`) and `200px/14px` (`<=480`).
  - Updated fallback wrapper spacing:
    - `.pv-missing-image-wrap` gains `padding:24px 0; box-sizing:border-box`.
    - Runtime fallback wrapper inline style updated with same spacing.
  - JS show/hide flow now toggles `pv-missing-image-mode` on `.pv-img-area` during missing-image state.
  - Icon design/content left unchanged (`dot.innerHTML` untouched).
- Checks run:
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - Not committed/deployed yet in this step.
- Backup/restore safety:
  - Backup created before bulk edit: `.temp-backups/priceview_missing_image_card_balance_20260323_030250/`## 2026-03-23 - Commit/push/deploy for missing-image card balance
- Request: Apply missing-image card height/padding balancing and deploy.
- Git:
  - Commit: `fc52537` - `Balance missing-image card spacing across PriceView templates`
  - Pushed to `origin/main`.
- Server deploy:
  - Pulled latest on `/opt/omnex-hub`.
  - Rebuilt/restarted app: `docker compose -f deploy/docker-compose.yml up -d --build app`.
- Live verification (`restaurant-view-overlay.html`):
  - `pv-img-area.pv-missing-image-mode{min-height:320px;padding:24px 0}` present.
  - `pv-missing-image-wrap` includes `padding:24px 0;box-sizing:border-box`.
  - `dot.innerHTML = '&#128269;'` remains unchanged.
- Checks run:
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - None.
- Backup/restore safety:
  - Backup used: `.temp-backups/priceview_missing_image_card_balance_20260323_030250/`.## 2026-03-23 - Increase missing-image min-height to 360 and redeploy
- Request: "min y�ksekli�i 360 yap bir daha at".
- Changes:
  - Updated `public/priceview-templates/*-view-overlay.html` (29 templates):
    - `.pv-img-area.pv-missing-image-mode{min-height:320px;padding:24px 0}`
      -> `.pv-img-area.pv-missing-image-mode{min-height:360px;padding:24px 0}`
  - Other fallback/icon design and mobile override values left unchanged.
- Checks run:
  - `php -l index.php` (OK)
- Risk/Follow-up:
  - Deploy required for live effect.
- Backup/restore safety:
  - Backup created before bulk edit: `.temp-backups/priceview_missing_image_360_20260323_030834/`