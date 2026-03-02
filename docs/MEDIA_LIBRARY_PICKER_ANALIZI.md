# Media Kütüphanesi ve MediaPicker Analizi (v2.0.14)

**Amaç:** Ortak kütüphane (public), firma kütüphanesi (company) ve bunları kullanan `MediaPicker` modülünün mevcut mimarisini, medya yükleme/yenileme/indexleme davranışını ve performans etkilerini özetlemek, iyileştirme önerileri sunmak.

İlgili önceki dokümanlar:
- `MULTI_TENANT_MEDIA_SON_HALI.md` → storage yapısı, kota, tenant izolasyonu
- `TEMPLATE_EDITOR_ARCHITECTURE-fabric-v7-son.md` → Template editor + MediaPicker entegrasyonu

---

## 1. Genel Mimari

### 1.1. Temel Bileşenler

| Katman | Dosya | Görev |
|--------|-------|-------|
| Backend API | `api/media/index.php` | Veritabanı üzerinden medya listeleme (sayfalama, scope, klasör) |
| Backend API | `api/media/upload.php` | Medya yükleme (tenant/kota kontrollü) |
| Backend API | `api/media/scan.php` | Dosya sistemini tarayıp `media` tablosuna indexleme |
| Backend API | `api/media/browse.php` | Doğrudan storage dizinlerinde gezinti (FS tabanlı) |
| Frontend | `public/assets/js/pages/products/form/MediaPicker.js` | MediaPicker UI + kütüphane/yükleme modalları |
| Frontend | `public/assets/js/pages/products/ProductForm.js` | Ürün formu içinde MediaPicker entegrasyonu |
| Frontend | `public/assets/js/pages/templates/EditorWrapper.js` | Template editor içinde MediaPicker entegrasyonu |

---

## 2. Kütüphane Yapısı: Firma vs Ortak Kütüphane

### 2.1. Depolama ve Veritabanı Seviyesi

- **Firma kütüphanesi (company):**
  - Fiziksel dizin: `storage/companies/{company_id}/media/images` ve `storage/companies/{company_id}/media/videos`
  - Veritabanı: `media.company_id = aktif firma`, `scope = 'company'`, `is_public = 0`
  - Klasör yapısı: `media_folders` tablosu üzerinden (`company_id = aktif firma`)

- **Ortak kütüphane (public / Ortak Kütüphane):**
  - Fiziksel dizin: `storage/public/samples` (ve alt klasörleri)
  - Veritabanı:
    - `media.company_id IS NULL`, `scope = 'public'` ve/veya `is_public = 1`
    - Klasörler: `media_folders.company_id IS NULL`
  - `api/media/index.php`, hem firma hem ortak medya için **aynı `media` tablosunu** kullanır, `scope` ve `is_public` ile ayrıştırır.

İlgili migration özetleri:
- `005_create_media.sql` → `media` ve `media_folders` tabloları, indeksler (`company_id`, `folder_id`, `file_type`, `status`)
- `047_media_tenant_isolation.sql` → `is_public`, `scope`, ek indeksler (`idx_media_is_public`, `idx_media_scope`, `idx_media_company_scope`)

### 2.2. API Katmanı (`api/media/index.php`)

- **Amaç:** Medya listeleme için **FS taraması yapmadan**, sadece veritabanı üzerinden sonuç döndürmek.
- Temel parametreler:
  - `page`, `per_page` → sayfalama (varsayılan `per_page = 50`)
  - `search` → isim bazlı arama (opsiyonel)
  - `type` → `file_type` filtresi (`image`, `video`, `document`)
  - `folder_id` → klasör bazlı filtre
  - `scope` → `'company'`, `'public'` veya boş (her ikisi)
  - `skip_validation` → `1` ise dosya varlık kontrolü (`is_file`) yapılmaz, daha hızlı çalışır.

**Scope davranışı:**
- `scope=company` → sadece ilgili firmanın medyaları (`company_id = aktif firma`)
- `scope=public` → sadece ortak medyalar (`is_public = 1` veya `scope = 'public'` veya `company_id IS NULL`)
- boş/diğer durum → firma + ortak birlikte, rol bazlı filtre ile

**Klasör davranışı:**
- `folder_id` dolu ise:
  - İlgili `media_folders` kaydı okunur, ortak klasör ise company filtresi yeniden yazılır ve sadece public medya döner.
- `folder_id` boş, `scope=public` ise:
  - Tüm public medya (tüm klasörlerden) döner; root seviyedeki ortak kütüphane klasör kaydı ayrıca eklenir.
- Aksi halde (root, firma scope):
  - `folder_id IS NULL` şartı ile klasörsüz kayıtlar listelenir.

**Çıktı yapısı:**
- `files` → filtrelenmiş medya kayıtları (DB'den gelen satırlar; `url`, `thumbnail_url`, `filename`, `size` gibi sanal alanlar eklenerek)
- `folders` → aynı seviyedeki klasörler (firma + uygun durumlarda ortak klasörler)
- `meta` → `total`, `page`, `per_page`, `total_pages`

### 2.3. Ortak Kütüphane Sanal Klasörü

`api/media/index.php`, public medya görüntülenirken `storage/public/samples` dizini için `media_folders` içinde bir **"Ortak Kütüphane"** klasörü oluşturur (yoksa insert eder) ve:

- Root seviyede (`folder_id` olmadan) bu klasörü `folders` listesine ekler.
- Alt klasörler için public `media_folders` kayıtlarını `type='public'`, `is_public=1` şeklinde işaretleyerek UI tarafında ayırt etmeyi kolaylaştırır.

---

## 3. MediaPicker ve UI Katmanı

### 3.1. MediaPicker Modülü (`public/assets/js/pages/products/form/MediaPicker.js`)

**Genel:**
- Tek bir JS sınıfı, üç senaryo için tekrar kullanılıyor:
  - `showImagePicker()` → tek görsel seçimi (single image)
  - `showMultiImagePicker()` → çoklu görsel seçimi (multi image)
  - `showVideoPicker()` → çoklu video seçimi (multi video)
- Ortak state alanları:
  - `activeLibrary`: `'company'` veya `'public'`
  - `companyMedia`, `publicMedia`
  - `companyFolders`, `publicFolders`
  - `currentPage`, `perPage`, `totalPages`, `totalItems`
  - `currentFolderId`, `breadcrumb`

**UI Özeti (Single Image):**
- Ana tablar:
  - **Kütüphane** ↔ **Yükle** (upload)
- Kütüphane sekmesi alt-tabları:
  - **Firma Kütüphanesi** (`data-library="company"`)
  - **Ortak Kütüphane** (`data-library="public"`)
- Özellikler:
  - Grid/list görünümü
  - Klasör yapısı + breadcrumb
  - Lazy image yükleme (`loading="lazy"`)
  - Sayfalama bileşeni (`_renderPagination`, `_bindPaginationEvents`)

**Veri Yükleme:**
- Tüm modlarda ortak helper: `_loadMediaWithScopes(type, page = 1, folderId = null)`
  - Aynı anda iki API çağrısı yapar:
    - Firma: `GET /media?type={image|video}&scope=company&page={page}&per_page={perPage}&folder_id={optional}`
    - Ortak: `GET /media?type={image|video}&scope=public&page={page}&per_page={perPage}&folder_id={optional}`
  - Gelen cevaplar:
    - `companyMedia`, `publicMedia`, `companyFolders`, `publicFolders`
    - `companyMeta`, `publicMeta` (toplamlar ve sayfa bilgisi)
  - Sonrasında `_setActiveLibraryMedia()`:
    - `activeLibrary` durumuna göre `allMedia`, `folders`, `totalPages`, `totalItems` alanlarını günceller.

**Arama ve Filtreleme:**
- Frontend tarafında, sadece **mevcut sayfadaki** sonuçlar üzerinde:
  - `_filterMedia()`, `_filterMultiMedia()`, `_filterVideoMedia()`
  - `filename` içeren basit `includes` filtresi
  - API’ye `search` parametresi gönderilmiyor → arama sayfalar arası değil, sayfa içi.

### 3.2. Entegrasyon Noktaları

- **Ürün Formu (`ProductForm.js`):**
  - `init()` içinde: `this._initMediaPicker();`
  - `_initMediaPicker()`:
    - Sanal bir container (`<div id="media-picker-container">`) oluşturur.
    - `initMediaPicker({ container, app, onSelect: (result) => this._handleMediaSelection(result) })`
  - `_handleMediaSelection(result)`:
    - `mode='single'` → `image_url` alanına URL yazılır + preview güncellenir.
    - `mode='multi-image'` → seçilen her görsel için `addImage(url, filename)`
    - `mode='multi-video'` → seçilen her video için `addVideo(url, filename)`

- **Template Editor (`EditorWrapper.js`):**
  - Lazy init: `_initMediaPicker()` sadece ilk çağrıda `initMediaPicker(...)` oluşturur.
  - `_openMediaPicker(type)`:
    - `type='video'` ise `showVideoPicker()`, aksi halde `showImagePicker()`
  - `_handleMediaSelect(result)`:
    - Görseller için `editor.addImage(...)`
    - Videolar için `editor.addRect({ ..., videoUrl, customType: 'video' })` ile placeholder dikdörtgen ekleme.

### 3.3. Yükleme Modalları ve Upload Akışı

- Yükleme sekmeleri:
  - Single image → `#media-upload-zone`, `#media-upload-input`
  - Multi image → `#multi-image-upload-zone`, `#multi-image-upload-input`
  - Video → `#video-upload-zone`, `#video-upload-input`

- Ortak upload helper: `_bindUploadEvents(zoneId, inputId, type, multiple = false)`
  - Tıklama + drag&drop + `change` event’leri ile dosyaları `_uploadMedia(file, type)` fonksiyonuna gönderir.

- `_uploadMedia(file, type)`:
  - `FormData` ile `file` ve `type` alanlarını hazırlayıp:
    - `this.app.api.upload('/media/upload', formData)` çağrısı yapar.
  - Backend dönüşü başarılı ise:
    - Yeni medya kaydını `this.state.allMedia.unshift(response.data)` ile en başa ekler.
    - `filteredMedia` yeniden set edilir ve ilgili grid/list görünümü yeniden render edilir.
    - Mod’a göre:
      - `single` → yeni yüklenen medya otomatik seçilir ve UI güncellenir.
      - `multi-image` → `selectedImages` dizisine eklenir ve grid yenilenir.

---

## 4. Yükleme, Yenileme ve Index Hızı Analizi

### 4.1. Listeleme / Index Hızı

**Güçlü Noktalar:**
- `api/media/index.php` **sadece veritabanı** kullanır:
  - Gerçek zamanlı dizin taraması yok → büyük dizinlerde bile FS tabanlı gecikme yaşanmaz.
  - Sayfalama (`LIMIT + OFFSET`) kullanır; sayfa başına kayıt sayısı sınırlı.
  - Public ve company ayrımı `scope` / `is_public` kolonları ve indeksler ile yapılır.
- `MediaPicker`:
  - Varsayılan `perPage = 27` → UI tarafında bir sayfada az sayıda öğe render eder (DOM yükü düşük).
  - Firma ve Ortak kütüphane tek bir `_loadMediaWithScopes()` ile birlikte yüklenir; sekme geçişleri API çağrısı yapmadan, sadece state değiştirerek hızlıdır.

**Potansiyel Darboğazlar:**
- Her istek için iki DB sorgusu:
  - Firma medyası (`scope=company`) ve ortak medya (`scope=public`) için ayrı çağrılar.
  - Özellikle çok kullanıcı + çok büyük `media` tablosu kombinasyonunda DB yükünü ikiye katlar.
- `COUNT(*)` + `ORDER BY created_at DESC`:
  - `media` tablosunda `created_at` kolonu için özel bir indeks yok; kayıt sayısı çok büyük olduğunda sayım ve sıralama yavaşlayabilir.
- `skip_validation` parametresi kullanılmıyorsa:
  - Her sonuç için `is_file($fullPath)` kontrolü yapılır → storage disk’ine fazladan IO.
  - Bu kontrol büyük listelerde hissedilir derecede gecikme yaratabilir.

### 4.2. Yükleme Hızı

- `api/media/upload.php`:
  - Yükleme öncesi:
    - MIME tipi validasyonu (`finfo_file`)
    - Tenant kota kontrolü (`StorageService::checkQuota`)
  - Yükleme sonrası:
    - Dosya fiziksel dizine yazılır.
    - Boyut ve (görsel ise) width/height okunur.
    - `media` tablosuna insert yapılır ve gerekirse `company_storage_usage` güncellenir.
- `MediaPicker` tarafında:
  - Yükleme bittiğinde server’dan dönen medya kaydı, mevcut listeye **tek satır** olarak eklenir; tüm listeyi yeniden yüklemez.
  - Bu sayede yeni yüklenen medya UI’ye neredeyse anında yansır (index yenilemesi için ekstra API çağrısı gerekmiyor).

### 4.3. Yenileme Davranışı

- Sekme değişimi (Firma ↔ Ortak kütüphane):
  - `_switchLibrary(library)` sadece state’i günceller ve DOM’u yeniden render eder; yeni API çağrısı yok.
  - İlk `_loadMediaWithScopes` çağrısı her iki scope’u da önceden doldurduğu için sekme geçişi hızlıdır.

- Sayfa değiştirme:
  - `_goToPage(page)` → `_loadMediaWithScopes(type, page, currentFolderId)` çağırır.
  - Hem firma hem public sonuçları için ilgili sayfa verisi yeniden çekilir, pagination ve info alanları güncellenir.

- Klasör gezinimi:
  - `_navigateToFolder(folderId, folderName)`:
    - Breadcrumb güncellenir.
    - İlgili klasör için tekrar `_loadMediaWithScopes` çağrılır.

- Arama:
  - Sadece mevcut `allMedia` listesi üzerinde client-side filtre:
    - Küçük sayfalarda çok hızlı.
    - Ancak tüm sayfalar üzerinde global arama yapmaz; bunun için API `search` parametresinin kullanılması gerekir (şu an MediaPicker bunu göndermiyor).

### 4.4. FS Tabanlı Indexleme (`api/media/scan.php`)

- Amaç: Özellikle `storage/public/samples` ve benzeri dizinlerdeki dosyaları `media` tablosuna çekerek **ilk indexleme** veya **senkronizasyon** yapmak.
- Çalışma şekli:
  - Rekürsif `scandir` ile tüm alt klasörler taranır.
  - Her dosya için:
    - Public sample mı, firma klasörü mü tespit edilir.
    - Uygun `media_folders` kaydı (Ortak Kütüphane + alt klasörler) oluşturulur veya bulunur.
    - `media` tablosuna insert yapılır (varsa atlanır).
- Performans:
  - Çok sayıda dosya içeren dizinlerde, **bilinçli ve arka planda** (cron/script) çalıştırılması gereken ağır bir işlem.
  - Normal MediaPicker isteklerinde kullanılmıyor; sadece admin/ilk kurulum senaryolarında devreye giriyor.

---

## 5. Öneriler

### 5.1. API Çağrısı ve Index Performansı

1. **MediaPicker → `skip_validation=1` kullanımı:**
   - `MediaPicker`’ın `/media` çağrılarına `&skip_validation=1` parametresi eklenebilir.
   - Avantaj:
     - Her listede dosya varlık kontrolü yapılmaz; özellikle uzak/yoğun storage sistemlerinde önemli IO tasarrufu sağlar.
   - Eksik dosyaların tespiti için:
     - Periyodik bir arka plan job’ı veya admin aracı ile bozuk kayıtlar taranabilir.

2. **`created_at` için ek indeks:**
   - Büyük `media` tablolarında `ORDER BY created_at DESC` performansını iyileştirmek için:
     - Önerilen indeks örneği:
       - `CREATE INDEX idx_media_company_created_at ON media(company_id, created_at DESC);`
       - `CREATE INDEX idx_media_public_created_at ON media(is_public, created_at DESC);`
   - Bu indeksler, sayfalı sorgularda sıralama maliyetini ciddi şekilde düşürür.

3. **Public kütüphane root sorgusu optimizasyonu:**
   - `scope=public` + `folder_id` boş iken **tüm public medyanın** dönmesi uzun vadede tablo büyüdükçe ağırlaşabilir.
   - Öneri:
     - Root seviyede, varsayılan olarak sadece belirli bir `folder_id` (örn. "Ortak Kütüphane" kök klasörü) ile filtreleme yapmak.
     - MediaPicker tarafında, public root açıldığında otomatik olarak bu kök klasör id’si ile istek atmak.

### 5.2. MediaPicker UX / Davranış İyileştirmeleri

1. **Lazy Scope Yükleme:**
   - Şu an `_loadMediaWithScopes` hem firma hem public medyayı aynı anda yüklüyor.
   - Alternatif tasarım:
     - İlk açılışta sadece aktif sekmenin (örn. Firma) verilerini çekmek.
     - Kullanıcı Ortak kütüphane sekmesine ilk kez geçtiğinde public veriyi yüklemek.
   - Yüksek concurrency ortamında DB yükünü azaltabilir.

2. **Global Arama Desteği:**
   - Mevcut client-side arama sadece açık sayfadaki kayıtları filtreliyor.
   - İyileştirme:
     - Arama kutusuna yazıldığında, belirli bir debounce sonrası `/media?search=...` parametresi ile backend araması yapmak.
     - Böylece çok sayıda medya içeren kütüphanelerde arama deneyimi ciddi şekilde iyileşir.

3. **Public/Firma Medyalarını Mantıksal Olarak Ayırma:**
   - Çok büyük kurulumlarda:
     - Firma medyası ve ortak medyanın ayrı tab’larda **farklı sayfalama/filtreleme ayarları** ile yönetilmesi düşünülebilir (örn. farklı `perPage` değerleri).

### 5.3. Indexleme ve Bakım Süreçleri

1. **FS → DB Senkronizasyonu için Planlı Job:**
   - `api/media/scan.php`, CLI/cron script’ine çevrilerek:
     - Belirli aralıklarla `storage/public/samples` ve kritik dizinler taranabilir.
     - Eksik `media` kayıtları tamamlanır, bozuk path’ler raporlanır.

2. **Bozuk Kayıt Temizliği:**
   - Eğer `skip_validation=1` kullanılacaksa:
     - Arka planda çalışan bir bakım job’ı:
       - `media` tablosundaki kayıtları parça parça tarayıp `is_file` ile kontrol eder.
       - Eksik dosyalara ait kayıtları `status='deleted'` yapar veya ayrı bir tabloya taşır.

---

## 6. Sonuç

- Mevcut sistem:
  - **Multi-tenant medya depolama** + **firma/ortak kütüphane ayrımı** için güçlü bir temel sağlıyor.
  - `MediaPicker` bileşeni, tek bir modülle ürün formu ve template editor gibi farklı UI’lerde tekrar kullanılabilir şekilde kurgulanmış.
  - Listeleme tarafında veritabanı tabanlı indexleme ve sayfalama kullanıldığı için, makul tablo boyutlarında performans yeterli.
- Orta/uzun vadede:
  - `skip_validation` kullanımı, ek indeksler ve public root sorgusunun daraltılması ile **indexleme ve listeleme hızı** belirgin şekilde iyileştirilebilir.
  - Arama ve lazy scope yükleme gibi iyileştirmeler, büyük medya kütüphanelerinde kullanıcı deneyimini güçlendirecektir.











