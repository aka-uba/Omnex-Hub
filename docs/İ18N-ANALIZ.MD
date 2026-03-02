## İ18N Analizi – Türkçe (`tr`) Dosyaları ve Hardcoded Metinler

Bu doküman, panel arayüzündeki **i18n uyumluluğunu** inceler. Odak noktası:

- `locales/tr/*.json` dosyalarındaki **Türkçe çeviriler**
- JS tarafındaki **hardcoded metinler**
- **Türkçe karakter / encoding** problemleri

---

## 1. Hardcoded Metinler – Sayfa Bazlı Analiz

Bu bölümde `__()` / `this.__()` / `__('...')` **kullanmadan** yazılmış Türkçe metinler listelenir.  
`this.__('...') || 'Türkçe fallback'` pattern’i **i18n + fallback** olarak değerlendirilmiştir.

### 1.1. `public/assets/js/pages/products/ProductList.js`

**Üst alan / header**

- Hardcoded:
  - `Ürünler` (breadcrumb + başlık)
  - `Ürün kataloğunuzu yönetin` (alt başlık)
- TR locale karşılığı (`locales/tr/pages/products.json`):
  - `title`: `"Ürünler"`
  - `subtitle`: `"Ürün kataloğunu yönetin"`  
    (JS’te “kataloğunuzu” – küçük anlam farkı)

**Üst araç çubuğu / butonlar**

- Hardcoded:
  - `İçe Aktar`
  - `Dışa Aktar`
  - `Yazdır`
  - `Yeni Ürün`
- İlgili i18n key’ler:
  - `common.actions.import`, `common.actions.export`, `common.actions.print`
  - `pages.products.addProduct`

**Toplu etiket / cihaza gönderim**

- Hardcoded:
  - `Toplu Etiket Yazdır`
  - `Cihaza Gönder`
- Öneri:
  - `products.printLabel.bulkPrint`, `products.sendToDevice.*` benzeri alanlara taşınmalı.

**Etiket atama modalı**

- Başlıklar:
  - `Etiket Düzenle: ${productName}`
  - `Etiket Ata: ${productName}`
- Buton metinleri:
  - `Güncelle` / `Ata`
  - `Şablon`
- Açıklama:
  - `Bu atamayı düzenle`
  - `Atamayı kaldır`
  - `Yeni bir atama eklemek veya mevcut atamayı değiştirmek için aşağıdan seçim yapın.`
- Form alanları:
  - `Cihaz Seç *`
  - `Cihaz seçin...`
  - `${devices.length} çevrimiçi cihaz bulundu`
  - `Şablon Seç *`
  - `Şablon seçin...`
  - `${templates.length} aktif şablon bulundu`
- Modal butonları:
  - `İptal` (footer’de literal)
- Toast / hata metinleri:
  - `Etiket atama modalı yüklenemedi`
  - `Lütfen cihaz ve şablon seçin`
  - `Güncelleniyor...` / `Atanıyor...`
  - `Etiket başarıyla güncellendi`
  - `Etiket başarıyla atandı`
  - `Etiket atanamadı`
  - `Etiket Atamasını Kaldır`
  - `Bu etiket atamasını kaldırmak istediğinizden emin misiniz?`
  - `Kaldır`
  - `Etiket ataması kaldırıldı`
  - `Etiket ataması kaldırılamadı`

**Export konfigürasyonu**

- Kolon başlıkları:
  - `SKU`
  - `Ürün Adı`
  - `Barkod`
  - `Son Güncelleme`
- Export metadata:
  - `urunler`
  - `Ürün Listesi`

**Özet / öneri**

- Bu sayfadaki tüm Türkçe metinler:
  - `locales/tr/pages/products.json`
  - `locales/tr/common.json`
  içine taşınmalı.
- JS tarafı yalnızca i18n key’lerini kullanacak şekilde refactor edilmelidir.

---

### 1.2. `public/assets/js/pages/media/MediaLibrary.js`

**Hardcoded + fallback yapısı**

- Export dosya adı:
  - `exportFilename: 'medya-kutuphanesi'`
- Başlık:
  - `this.__('title') || 'Medya Kütüphanesi'`
- Breadcrumb:
  - `this.__('title') || 'Medya Kütüphanesi'`
- Tür filtreleri:
  - `this.__('filter.all') || 'Tüm Dosyalar'`
  - `this.__('filter.images') || 'Görseller'`
  - `this.__('filter.videos') || 'Videolar'`
  - `this.__('filter.documents') || 'Dökümanlar'`
- Gelişmiş filtre modalı fallback’leri:
  - `Arama`
  - `Dosya adı ara...`
  - `Gelişmiş Filtreler`
  - `Uygula`
  - `İptal`
  - `Filtreler uygulandı`

**TR locale karşılıkları** (`locales/tr/pages/media.json`)

- `title`: `"Medya Kütüphanesi"`
- `filter.*`: `"Tüm Dosyalar"`, `"Görseller"`, `"Videolar"`, `"Dökümanlar"`
- `filters.*`: `advancedFilters`, `apply`, `applied`, `searchPlaceholder` vb.

**Özet / öneri**

- Kullanılan key’ler doğru; fallback Türkçe metinler gereksiz.
- Strateji:
  - Tüm dillerde ilgili key’ler tamamlandıktan sonra
  - `|| 'Türkçe...'` fallback’leri sistematik olarak kaldırmak.

---

### 1.3. `public/assets/js/layouts/ThemeConfigurator.js`

Bu dosya, neredeyse tamamen **hardcoded Türkçe UI metinleri** ile çalışıyor; i18n fonksiyonu hiç kullanılmıyor.

**Başlıklar ve butonlar**

- `Tema Ayarları` (floating buton `title` + panel başlığı)
- `Kapat`
- `Sıfırla`
- `Kaydet`
- `Şirket Varsayılanı Olarak Kaydet`

**Bölüm başlıkları / etiketler**

- `Yerleşim Tipi`
- `Sidebar Ayarları`
- `Üst Navigasyon`
- `İçerik Alanı`
- `Footer Göster`
- `Yönetici`
- `Sağ`
- `Genişlik`
- `Daraltılmış Başlat`
- `Kenarlık`
- `Kenarlık Kalınlığı`
- `Kenarlık Rengi`
- `Sayfa Kaydırma Davranışı`
- `Sabit (Her Zaman Görünür)`
- `Kaydırınca Gizle`
- `Gizle, Üzerine Gelince Göster`
- Sekmeler: `Masaüstü`, `Tablet`
- Padding label’ları: `Üst`, `Sağ` vb.
- Renk isimleri: `Açık`, `Koyu`

**Açıklama paragrafı**

- `Bu ayarlar tüm şirket kullanıcıları için varsayılan olarak uygulanır.`

**Toast mesajları**

- `Tema ayarları kaydedildi`
- `Ayarlar şirket varsayılanına sıfırlandı`
- `Ayarlar sıfırlanamadı`
- `Şirket varsayılan ayarları kaydedildi`

**Öneri**

- `locales/tr/pages/settings.json` veya `locales/tr/common.json` içinde:
  - `themeConfigurator.*` namespace’i açılmalı.
- Tüm bu stringler o namespace’e taşınmalı ve:
  - JS tarafında `this.__('themeConfigurator.xxx')` şeklinde kullanılmalıdır.

---

### 1.4. `public/assets/js/layouts/LayoutManager.js`

**Header / menü butonları (hardcoded)**

- `Önbelleği Temizle (Dev)`
- `Tema Değiştir`
- `Uygulamayı Yükle`
- Kullanıcı menüsü:
  - `Çıkış Yap`
- Sidebar:
  - `Menüyü Aç/Kapat`

**TR locale ile ilişkisi**

- `locales/tr/common.json` içinde dolaylı karşılıklar mevcut:
  - Örneğin `auth.logout`, `settings.theme` vb.
- Ancak bu dosya i18n fonksiyonu kullanmak yerine **literral string** kullanıyor.

**Öneri**

- Header & layout için ortak bir namespace önerisi:
  - `common.layout.header.*`
  - `common.layout.sidebar.*`
- Tüm bu metinler ilgili key’lere taşınmalı.

---

### 1.5. `public/assets/js/components/DataTable.js`

Bu bileşen i18n fonksiyonunu kullanıyor, fakat çoğu yerde **Türkçe fallback** bırakılmış.

**Durum / boş veri metinleri**

- `__('table.noData', 'Veri bulunamadı')`
- `__('table.loading', 'Yükleniyor...')`

**Aksiyon & yazdırma**

- `__('table.actions', 'İşlemler')`
- `title="${__('table.print', 'Yazdır')}"`

**Sayfalama ve seçili kayıt bilgisi**

- `__('table.perPage', 'Sayfa başına:')`
- Bilgi metni:
  - `'{start} - {end} / {total} kayıt gösteriliyor'`
- Seçili sayacı:
  - `'{count} seçili'`
- Kayıt yok:
  - `Kayıt bulunamadı`

**Durum badge’leri**

- `__('status.pending', 'Beklemede')`
- `__('status.suspended', 'Askıda')`

**Export hata mesajı**

- `Dışa aktarma sırasında hata oluştu`

**Öneri**

- `locales/tr/common.json` içindeki:
  - `table.*`
  - `status.*`
  key’leri doldurulduktan sonra:
  - Tüm fallback Türkçe stringler kaldırılmalı.

---

### 1.6. `public/assets/js/components/RenderWorker.js`

**Toast ve Web Notification metinleri (tamamen hardcoded)**:

- Toast:
  - `"\"${productName}\" render hatası: ${errorMessage}"`
- Web Notification başlıkları:
  - `Render Tamamlandı`
  - `Render Hatası`
- Web Notification gövde metinleri:
  - `"\"${productName}\" başarıyla render edildi"`
  - `"\"${productName}\" render edilemedi: ${errorMessage}`

**Öneri**

- Uygun bir namespace önerisi:
  - `queue.render.notification.*` veya `templates.render.*`
- Örnek key’ler:
  - `queue.render.notification.successTitle`
  - `queue.render.notification.errorTitle`
  - `queue.render.notification.successBody`
  - `queue.render.notification.errorBody`

---

### 1.7. `public/assets/js/components/RenderProgressModal.js`

**Modal başlığı ve durum metinleri**

- Varsayılan başlık:
  - `Render İşlemi`
- Durum satırı:
  - `Başlatılıyor...`
- İstatistik label:
  - `Başarısız`
- Cancel:
  - `this.__('actions.cancel') || 'İptal'`
- Durum metinleri:
  - `Bekliyor...`
  - `İşleniyor... (${completed}/${total})`
  - `Tamamlandı!`
  - `Başarısız`
  - `İptal Edildi`
- Cihaz bilgisi yüklenirken:
  - `Cihaz bilgisi yükleniyor...`

**Öneri**

- Render/queue ile ilişkili bir TR JSON’a taşınmalı:
  - Örneğin `locales/tr/pages/queue.json` içinde `modal.progress.*`.

---

## 2. `locales/tr` Key Farkları ve Kullanım Tutarsızlıkları

Bu bölüm, **TR locale dosyalarında tanımlı olup kodda hardcoded kullanılan** veya **aynı kavram için farklı metin kullanılan** alanları özetler.

### 2.1. Products Sayfası  
Kaynaklar: `locales/tr/pages/products.json` vs `public/assets/js/pages/products/ProductList.js`

**Başlık / alt başlık**

- TR:
  - `title`: `"Ürünler"`
  - `subtitle`: `"Ürün kataloğunu yönetin"`
- JS:
  - `<span class="breadcrumb-current">Ürünler</span>`
  - `<h1 class="page-title">Ürünler</h1>`
  - `<p class="page-subtitle">Ürün kataloğunuzu yönetin</p>`

**Tespit**

- i18n key varken hardcoded kullanılmış.
- Alt başlıkta minör metin farkı var (siz / biz vurgusu).

**Butonlar**

- TR:
  - `addProduct`: `"Yeni Ürün"`
  - `import.title`: `"Ürün İçe Aktar"`
- JS:
  - `İçe Aktar`, `Dışa Aktar`, `Yeni Ürün`, `Toplu Etiket Yazdır`, `Cihaza Gönder`
- Tespit:
  - Bir kısmının `common.actions.*` veya `products.*` altında karşılığı mevcut olmasına rağmen literal kullanılmış.

---

### 2.2. Media Sayfası  
Kaynaklar: `locales/tr/pages/media.json` vs `public/assets/js/pages/media/MediaLibrary.js`

**Başlık**

- TR: `"title": "Medya Kütüphanesi"`
- JS: `this.__('title') || 'Medya Kütüphanesi'`
- Tespit:
  - Key doğru, fallback aynı metni tekrar ediyor.

**Filtreler**

- TR:
  - `filter.all`: `"Tüm Dosyalar"`
  - `filter.images`: `"Görseller"`
  - `filter.videos`: `"Videolar"`
  - `filter.documents`: `"Dökümanlar"`
- JS:
  - `this.__('filter.all') || 'Tüm Dosyalar'` vb.

**Gelişmiş filtreler**

- TR: `filters.advancedFilters`, `filters.apply`, `filters.applied`, `filters.searchPlaceholder` vb.
- JS: `this.__('filters.*') || 'Türkçe...'`

**Sonuç**

- Key yapısı ile kullanım uyumlu; yalnızca fallback’ler kaldırılmalıdır.

---

### 2.3. Devices Sayfası  
Kaynaklar: `locales/tr/pages/devices.json` vs `deploy/assets/js/pages/devices/DeviceList.js`

**TR tarafı**

- `devices.actions.*`, `devices.pendingDevices.*`, `devices.toast.*` altında geniş kapsamlı key seti var.

**JS tarafı (örnekler)**

- `this.__('actions.startBroadcast') || 'Yayını Başlat'`
- `this.__('actions.stopBroadcast') || 'Yayını Durdur'`
- `this.__('actions.refreshDevice') || 'Cihazı Yenile'`
- `this.__('actions.rebootDevice') || 'Cihazı Yeniden Başlat'`
- `this.__('actions.clearMemory') || 'Belleği Temizle'`
- `this.__('actions.pingDevice') || 'Bağlantı Testi'`
- `this.__('pendingDevices.title') || 'Bekleyen Cihaz Kayıtları'`
- `this.__('toast.approved') || 'Cihaz onaylandı'`

**Uyum durumu**

- Örneğin:
  - `actions.refreshDevice`: `"Ekranı Yenile"`
  - `actions.clearMemory`: `"Belleği Temizle"`
- Key isimleri ve TR içerik uyumlu; JS’teki fark yalnızca fallback stringler.

**Sonuç**

- Fallback Türkçe cümleler kaldırılıp yalnızca i18n değeri kullanılmalıdır.

---

### 2.4. Common / Notifications / Settings

**TR dosyaları**

- `locales/tr/common.json`
- `locales/tr/pages/notifications.json`
- `locales/tr/pages/settings.json`

**Durum**

- Büyük oranda:
  - Metinler sadece JSON’da tanımlı.
  - JS tarafında `__()` ile çağrılıyor.
- İstisna:
  - `ThemeConfigurator.js`, `LayoutManager.js` gibi layout dosyalarında:
    - Mevcut key’lere uyabilecek alanlar olmasına rağmen hiç i18n kullanılmamış.

**Genel yorum**

- TR dosyaları tutarlı.
- Eksiklik ağırlıklı olarak:
  - JS tarafındaki hardcoded stringler
  - `__() || 'Türkçe'` pattern’inin fazlaca kullanılması.

---

## 3. Türkçe Karakter / Encoding Analizi

Bu bölüm, **Türkçe karakter bozulmalarını** (ör. `Ã¼`, `Ã§`, `�`) ve yanlış charset kalıntılarını inceler.

### 3.1. Global Arama

- Kullanılan arama pattern’i:
  - `"Ã|Â|¤|�"` (tüm uzantılar)

**Bulunan dosyalar**

- `storage/logs/app.log`, `storage/logs/audit.log` ve bunların `backup` / `yedek` altındaki kopyaları
- `tasarımlar/Hanshow - Elektronik Etiket/...` altındaki bazı HTML/JS vendor dosyaları

**Önemli not**

- Uygulamanın:
  - Ana JS dosyalarında
  - `locales/tr/*.json` içinde  
  bu tip karakter bozulması **tespit edilmemiştir**.

---

### 3.2. `locales/tr/*.json` Kontrolü

**İncelenen dosyalar**

- `locales/tr/common.json`
- `locales/tr/pages/products.json`
- `locales/tr/pages/dashboard.json`
- `locales/tr/pages/media.json`
- `locales/tr/pages/devices.json`
- `locales/tr/pages/settings.json`
- `locales/tr/pages/notifications.json`

**Durum**

- Tümünde Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) doğru **UTF‑8** olarak yazılmıştır.
- Örnekler:
  - `"Dijital Etiket ve Signage Yönetim Platformu"`
  - `"Görseller"`, `"Dökümanlar"`, `"Güncellenemedi"`, `"Önizleme"`, `"Eşleştirme Kodu"` vb.

**İmla farklılıkları**

- `Dökümanlar` vs `Dokümanlar` gibi örnekler mevcut; bunlar:
  - Encoding problemi değil,
  - Sadece yazım tercihi farkıdır.

---

### 3.3. Sayfa Bazlı Encoding Özeti

**Products, Media, Devices, Settings, Notifications, Dashboard**

- TR locale dosyalarında:
  - Türkçe karakter bozulması yok.
- Bu sayfaların JS tarafındaki hardcoded metinlerde:
  - Encoding hatası yok, hepsi normal UTF‑8.

**Log ve tasarım/vendor klasörleri**

- Eski veya farklı encoding’den gelen bazı dosyalarda:
  - `Ã` vb. karakterler görülüyor.
- Ancak:
  - Bunlar panel UI’sinde doğrudan kullanılmıyor.
  - Genellikle log / vendor / tasarım çıktıları; i18n kapsamını doğrudan etkilemiyor.

---

## 4. Sonuç ve Önerilen Refactor Adımları

1. **Hardcoded metinlerin temizlenmesi**
   - Öncelik: `ProductList.js`, `ThemeConfigurator.js`, `LayoutManager.js`, `RenderWorker.js`, `RenderProgressModal.js`.
   - Adım:
     - Tüm Türkçe stringleri ilgili `locales/tr` dosyalarına taşı.
     - JS tarafında yalnızca `__()` / `this.__()` ile key kullan.

2. **Fallback’lerin kaldırılması**
   - Pattern: `__ ('key', 'Türkçe fallback')` veya `this.__('key') || 'Türkçe'`
   - Strateji:
     - Önce tüm dillerde gerekli key’leri eksiksiz hale getir.
     - Sonra bu fallback stringleri kademeli olarak temizle.

3. **Yeni namespace tasarımı**
   - `themeConfigurator.*`
   - `layout.header.*`, `layout.sidebar.*`
   - `queue.render.*`, `queue.modal.*`
   - Böylece:
     - Layout ve sistem genelinde kullanılan metinler tekrar kullanılabilir,
     - Diğer dillere çeviri süreci netleşir.

4. **Encoding açısından ek aksiyon gerekmez**
   - Uygulamanın aktif i18n dosyalarında encoding sorunu yok.
   - Log/vendor dosyalarındaki bozulmalar, UI’yi etkilemediği sürece sadece izleme amaçlı bırakılabilir.



















