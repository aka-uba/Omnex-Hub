Önce tüm public/assets/js/pages dosyalarında Türkçe hardcoded metinleri sayfa bazlı toplayacağım, ardından locales/tr/*.json ile bu kullanımların key farklarını ve olası Türkçe karakter sorunlarını üç başlık altında özetleyeceğim. Şimdi taramayı genişletip raporu tamamlıyorum.
1. Hardcoded metinler (i18n kullanılmayanlar) – sayfa bazlı
Not: Aşağıda sadece __() / this.__() / __('...') KULLANMADAN yazılmış Türkçe metinleri listeliyorum. this.__('...') || 'Türkçe fallback' yapan satırları bu başlıkta “kabul edilebilir fallback” olarak ayrıca belirtiyorum.
1.1. public/assets/js/pages/products/ProductList.js
Üst alan / header
Ürünler (breadcrumb ve başlık)
Ürün kataloğunuzu yönetin (alt başlık)
Bu metinler aslında locales/tr/pages/products.json içinde var:
title: "Ürünler"
subtitle: "Ürün kataloğunu yönetin" (JS’te “kataloğunuzu” şeklinde küçük fark var).
Üst araç çubuğu / butonlar
İçe Aktar
Dışa Aktar
Yazdır
Yeni Ürün
Bu eylemler için common.actions.import/export/print ve pages.products.addProduct vb. key’ler zaten mevcut.
Toplu etiket / cihaza gönderim butonları
Toplu Etiket Yazdır
Cihaza Gönder
Etiket atama modalı
Etiket Düzenle: ${productName}
Etiket Ata: ${productName}
Güncelle / Ata
Şablon
Bu atamayı düzenle
Atamayı kaldır
Yeni bir atama eklemek veya mevcut atamayı değiştirmek için aşağıdan seçim yapın.
Cihaz Seç *
Cihaz seçin...
${devices.length} çevrimiçi cihaz bulundu
Şablon Seç *
Şablon seçin...
${templates.length} aktif şablon bulundu
Modal butonları:
İptal (footer’de direkt string)
Toast/metinler:
Etiket atama modalı yüklenemedi
Lütfen cihaz ve şablon seçin
Güncelleniyor... / Atanıyor...
Etiket başarıyla güncellendi
Etiket başarıyla atandı
Etiket atanamadı
Etiket Atamasını Kaldır
Bu etiket atamasını kaldırmak istediğinizden emin misiniz?
Kaldır
Etiket ataması kaldırıldı
Etiket ataması kaldırılamadı
Export konfigürasyonu
Kolon başlıkları:
SKU
Ürün Adı
Barkod
Son Güncelleme
Export metadata:
urunler
Ürün Listesi
> Öneri: Bu sayfanın tamamı locales/tr/pages/products.json ve locales/tr/common.json’daki mevcut key’lere taşınabilir; JS tarafında doğrudan string yerine sadece i18n key’leri kullanılmalı.
1.2. public/assets/js/pages/media/MediaLibrary.js
Hardcoded TR (fallback’ler haricinde)
exportFilename: 'medya-kutuphanesi'
this.__('title') || 'Medya Kütüphanesi' (fallback kısmı)
this.__('title') || 'Medya Kütüphanesi' (breadcrumb içinde tekrar)
typeOptions:
Tüm Dosyalar
Görseller
Videolar
Dökümanlar
Filtre modalı:
Label fallback’leri: 'Arama', 'Dosya adı ara...', 'Gelişmiş Filtreler', 'Uygula', 'İptal', 'Filtreler uygulandı'
Durum:
Bu metinlerin neredeyse hepsi locales/tr/pages/media.json içinde tanımlı (title, toolbar, filter, filters.* vb.).
Kod yapısı this.__('...') || 'Türkçe' şeklinde olduğundan i18n uyumlu ama fallback’li; yine de saf i18n için fallback stringler kaldırılıp tüm dil dosyalarının tamam olduğundan emin olunabilir.
1.3. public/assets/js/layouts/ThemeConfigurator.js
Tamamen hardcoded Türkçe UI metinleri (hiç i18n yok):
Tema Ayarları (buton title + panel başlığı)
Kapat
Yerleşim Tipi
Sidebar Ayarları
Sağ
Genişlik
Daraltılmış Başlat
Kenarlık
Kenarlık Kalınlığı
Kenarlık Rengi
Üst Navigasyon
Sayfa Kaydırma Davranışı
Sabit (Her Zaman Görünür)
Kaydırınca Gizle
Gizle, Üzerine Gelince Göster
Yükseklik
İçerik Alanı
Sekmeler: Masaüstü, Tablet
Padding label’ları: Üst, Sağ (ve benzerleri)
Footer Göster
Yönetici, Admin
Şirket Varsayılanı Olarak Kaydet
Açıklama paragrafı: Bu ayarlar tüm şirket kullanıcıları için varsayılan olarak uygulanır.
Renk paleti metinleri:
'Açık', 'Koyu'
Panel butonları:
Sıfırla, Kaydet
Toast’lar:
Tema ayarları kaydedildi
Ayarlar şirket varsayılanına sıfırlandı
Ayarlar sıfırlanamadı
Şirket varsayılan ayarları kaydedildi
> Öneri: locales/tr/pages/settings.json veya locales/tr/common.json içinde themeConfigurator.* altında yeni key seti açılıp tamamen i18n’e taşınmalı.
1.4. public/assets/js/layouts/LayoutManager.js
Header / menü butonları
Önbelleği Temizle (Dev) (header butonu ve tekrar edilen HTML içinde)
Tema Değiştir
Uygulamayı Yükle
Kullanıcı menüsü:
Çıkış Yap
Sidebar butonu:
Menüyü Aç/Kapat
> Bu metinlerin karşılıkları locales/tr/common.json içinde dolaylı olarak mevcut (auth.logout, settings.theme, vs.), ama bu dosyada doğrudan literal kullanılmış, i18n yok.
1.5. public/assets/js/components/DataTable.js
Varsayılan i18n fall‑back’leri (içeride __() var)
__('table.noData', 'Veri bulunamadı')
__('table.loading', 'Yükleniyor...')
__('table.actions', 'İşlemler')
title="${__('table.print', 'Yazdır')}"
__('table.perPage', 'Sayfa başına:')
Durum badge’leri:
__('status.pending', 'Beklemede')
__('status.suspended', 'Askıda')
Sayfalama bilgisi:
'{start} - {end} / {total} kayıt gösteriliyor'
Kayıt bulunamadı
Seçim sayacı:
'{count} seçili'
Export hatası:
Dışa aktarma sırasında hata oluştu
> Bunlar i18n fonksiyonuyla kullanılıyor; fallback Türkçe metinleri dil dosyaları tam olduğunda kaldırılabilir.
1.6. public/assets/js/components/RenderWorker.js
Bildirim ve Notification metinleri
Toast:
"\"${productName}\" render hatası: ${errorMessage}"
Web Notification:
Başlıklar:
'Render Tamamlandı'
'Render Hatası'
Mesajlar:
"\"${productName}\" başarıyla render edildi"
"\"${productName}\" render edilemedi: ${errorMessage}
> Bu metinler için locales/tr/pages/templates.json veya queue/render altına i18n karşılığı eklenmeli.
1.7. public/assets/js/components/RenderProgressModal.js
Modal başlığı & içerik metinleri
Varsayılan başlık: 'Render İşlemi'
Durum satırı:
Başlatılıyor...
İstatistik label:
Başarısız
Cancel:
this.__('actions.cancel') || 'İptal' (fallback)
Durum metinleri:
'Bekliyor...'
'İşleniyor... (${completed}/${total})'
'Tamamlandı!'
'Başarısız'
'İptal Edildi'
Cihaz bilgisi yüklenirken:
Cihaz bilgisi yükleniyor...
> Tümü doğrudan string; ilgili queue/render sayfasının tr JSON’una taşınmalı.
2. locales/tr key farkları ve kullanım tutarsızlıkları (yalnızca TR dosyasına göre)
Bu başlıkta, tr dosyalarında tanımlı olup kodda hardcoded kullanılan veya TR dosyaları içinde aynı kavram için iki farklı ifade görünen durumları özetliyorum.
2.1. Products sayfası (locales/tr/pages/products.json vs ProductList.js)
Başlık / alt başlık
TR dosyası:
title: "Ürünler"
subtitle: "Ürün kataloğunu yönetin"
JS:
<span class="breadcrumb-current">Ürünler</span>
<h1 class="page-title">Ürünler</h1>
<p class="page-subtitle">Ürün kataloğunuzu yönetin</p> (“kataloğunuzu” – ufak fark)
Durum: i18n key varken hardcoded kullanılıyor + metin küçük farklı.
Butonlar
TR:
addProduct: "Yeni Ürün"
import.title: "Ürün İçe Aktar" vb.
JS:
İçe Aktar, Dışa Aktar, Yeni Ürün, Toplu Etiket Yazdır, Cihaza Gönder gibi metinler i18n yerine literal; bir kısmı common.actions veya products.* altında zaten var.
2.2. Media sayfası (locales/tr/pages/media.json vs MediaLibrary.js)
Başlık
TR: "title": "Medya Kütüphanesi"
JS: this.__('title') || 'Medya Kütüphanesi' – key doğru, fallback aynı metin.
Filtreler
TR:
filter.all: "Tüm Dosyalar"
filter.images: "Görseller"
filter.videos: "Videolar"
filter.documents: "Dökümanlar"
JS: this.__('filter.all') || 'Tüm Dosyalar' vb. – key’ler bire bir aynı.
Gelişmiş filtreler
TR: filters.advancedFilters, filters.apply, filters.applied, filters.searchPlaceholder vb.
JS: hepsini this.__('filters.*') || 'Türkçe' şeklinde kullanıyor.
Durum: Key yapısı ile kullanım uyumlu; sadece fallback’ler fazladan.
2.3. Devices sayfası (locales/tr/pages/devices.json vs DeviceList.js / deploy versiyonu)
TR tarafında oldukça kapsamlı bir devices seti var (actions.refreshDevice, pendingDevices.*, toast.* vb.).
deploy/assets/js/pages/devices/DeviceList.js içinde çok sayıda şu pattern var:
this.__('actions.startBroadcast') || 'Yayını Başlat'
this.__('actions.stopBroadcast') || 'Yayını Durdur'
this.__('actions.refreshDevice') || 'Cihazı Yenile'
this.__('actions.rebootDevice') || 'Cihazı Yeniden Başlat'
this.__('actions.clearMemory') || 'Belleği Temizle'
this.__('actions.pingDevice') || 'Bağlantı Testi'
this.__('pendingDevices.title') || 'Bekleyen Cihaz Kayıtları'
this.__('toast.approved') || 'Cihaz onaylandı' vb.
locales/tr/pages/devices.json içeriği ile isimler uyumlu, yani:
actions.refreshDevice: "Ekranı Yenile"
actions.clearMemory: "Belleği Temizle" vs.
Durum:
Key isimleri ve tr içerik uyumlu, ama JS tarafında hala fallback Türkçe cümleler var (aynı veya benzer metinler).
Saf i18n için bu fallback stringler kaldırılıp TR dosyasına tamamen güvenilebilir.
2.4. Common / notifications / settings
locales/tr/common.json, locales/tr/pages/notifications.json, locales/tr/pages/settings.json:
Çok büyük oranda tüm metinler sadece JSON’da, JS tarafında çoğu yerde __(...) ile çağrılıyor.
Bazı JS dosyalarında (özellikle ThemeConfigurator.js, LayoutManager.js) ise bu key’lere uygun alanlar olduğu halde hiç i18n kullanılmamış (tamamen yeni, ayrı bir English/other locale gerektirecek).
> Genel olarak: TR dosyaları oldukça tutarlı; eksiklik daha çok JS tarafında hardcoded kalmış stringlerle ilgili.
3. Türkçe karakter / encoding sorun analizi
Bu başlıkta özellikle Türkçe karakter bozulmaları (Ã¼, Ã§, � vb.) ve yanlış charset’ten gelen izleri aradım.
3.1. Search sonuçları
Projede şu pattern’ler için tarama yapıldı:
grep "Ã|Â|¤|�" -g"*.*"
Bulunan dosyalar:
Çoğunlukla:
storage/logs/app.log, storage/logs/audit.log (ve backup / yedek altlarındaki log kopyaları)
Bazı tasarımlar/Hanshow - Elektronik Etiket/... altındaki HTML/JS vendor dosyaları
Uygulama çekirdek UI’sine ait JS veya locales/tr/*.json dosyalarında bu tip bozuk karakter bulunmadı.
3.2. locales/tr/*.json incelemesi
İncelediğim dosyalar:
locales/tr/common.json
locales/tr/pages/products.json
locales/tr/pages/dashboard.json
locales/tr/pages/media.json
locales/tr/pages/devices.json
locales/tr/pages/settings.json
locales/tr/pages/notifications.json
Hepsinde Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) doğru UTF‑8 olarak yazılmış:
Örnekler:
"Dijital Etiket ve Signage Yönetim Platformu"
"Görseller", "Dökümanlar", "Güncellenemedi", "Önizleme", "Eşleştirme Kodu" vb.
Yazım farklılıkları olsa da (örn. Dökümanlar vs. Dokümanlar), bunlar encoding sorunu değil, imla tercihi.
3.3. Sayfa bazlı özet (encoding açısından)
Products, Media, Devices, Settings, Notifications, Dashboard sayfaları:
TR locale dosyalarında Türkçe karakter bozukluğu yok.
JS tarafındaki hardcoded metinlerde de encoding hatası yok; hepsi normal UTF‑8.
Log ve tasarım/vendor klasörleri:
Eski veya farklı encoding’den gelen log/tasarım dosyalarında Ã vb. karakterler var; ancak bunlar:
Çalışan panel UI’sinde doğrudan kullanılmıyor.
Sadece log/döküman/vendor içeriği; i18n kapsamına girmiyor.
Kısa Özet
Hardcoded metinler: En yoğun problem ProductList.js, ThemeConfigurator.js, LayoutManager.js, RenderWorker.js, RenderProgressModal.js dosyalarında; bu sayfalarda buton/metin/notification cümleleri büyük oranda i18n dışında duruyor.
TR locale key farkları: locales/tr/common.json ve locales/tr/pages/*.json yapısı tutarlı; çoğu metin için key zaten var, fakat JS tarafı zaman zaman bunları kullanmak yerine literal yazmış veya __() || 'Türkçe' patterniyle fallback bırakmış.
Türkçe karakter / encoding: Uygulamanın ana JS ve locales/tr JSON’larında encoding sorunu yok; bozuk karakterler sadece log ve harici tasarım/vendor dosyalarında görülüyor ve UI’yi / i18n’i etkilemiyor.