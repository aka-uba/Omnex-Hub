1️⃣ CİHAZ AKTİVASYON & İLK KURULUM DENEYİMİ
Mevcut Durum:

Cihazlar doğrulama kodu ile eşleştiriliyor.

PWA indirme ikonu ilk eşitlemeden sonra modal olarak gösteriliyor.

İlk kurulum ekranı görsel olarak basit ve profesyonellikten uzak.

PWA indirme seçeneği sürekli erişilebilir değil.

İstenen:

İlk kurulum (eşleştirme) ekranı tamamen yeniden tasarlanmalı.

Profesyonel, kurumsal, minimal ama güçlü bir tasarım.

TV, mobil, tablet ve masaüstü için responsive UX.

PWA indirme seçeneği:

Sadece ilk eşitlemede değil, her zaman erişilebilir olmalı.

Üst sabit bir alan, ayarlar menüsü veya ikon alanı önerilmeli.

Eşleştirme yapılmadan da indirilebilir olmalı.

Playlist görüntüsünü bozmayacak konumlandırma çözümü geliştirilmeli.

Android TV, WebOS (LG), Tizen (Samsung), Chrome tabanlı tarayıcılar için PWA davranışları analiz edilmeli.

"Add to Home Screen" farklı platformlarda nasıl çalışıyor?

PWA fallback senaryosu oluşturulmalı.

2️⃣ EKRAN ÇÖZÜNÜRLÜĞÜ TESPİT PROBLEMİ
Sorun:

Bilgisayarda doğru çözünürlük alınırken,

65” 4K TV’de düşük çerçeve genişliği algılanıyor.

TV ve mobil cihazlarda viewport yanlış ölçülüyor.

Analiz Edilecek:

window.innerWidth vs screen.width farkı

devicePixelRatio etkisi

TV tarayıcılarının user-agent davranışları

CSS viewport meta ayarları

4K TV’lerde scaling / overscan problemi

İstenen:

Tüm cihaz tiplerinde doğru fiziksel çözünürlük tespiti

Gerçek render alanına göre layout hesaplama

Cihaz tipi bazlı adaptive rendering mimarisi

Gerekirse manuel çözünürlük override sistemi

3️⃣ BÜYÜK ÖLÇEK PERFORMANS OPTİMİZASYONU
Mevcut:

Az sayıda cihaz için optimize edildi.

1000+ cihaz senaryosunda zaman aşımı oluşuyor.

İncelenecek:

Playlist dağıtım modeli (polling mi push mu?)

Cache stratejisi

WebSocket / SSE altyapısı

Cihaz başına istek yoğunluğu

CDN / edge cache ihtiyacı

Database indeksleme

Playlist diff güncelleme sistemi (tam veri yerine fark gönderme)

İstenen:

1 → 10.000 cihaz ölçeklenebilir mimari planı

Timeout risklerinin ortadan kaldırılması

Network ve veri transfer optimizasyonu

Hafif cihaz client yapısı

4️⃣ IFRAME / PROXY YAPISI DENETİMİ
Mevcut:

iframe engeli olan siteler için proxy kullanıldı.

Çalışıp çalışmadığı net değil.

Kontrol Edilecek:

X-Frame-Options

CSP header

Proxy header rewrite doğru mu?

HTTPS / mixed content problemi var mı?

Streaming içeriklerde sorun var mı?

İstenen:

Proxy’nin güvenli ve stabil hale getirilmesi

Gereksiz proxy kullanımının kaldırılması

Alternatif çözüm önerileri:

Snapshot render

Headless capture

Static clone

Server-side rendering

5️⃣ TÜM CİHAZ & TARAYICI UYUMLULUĞU

Desteklenmesi gerekenler:

Android TV (Chrome tabanlı)

LG WebOS tarayıcı

Samsung Tizen tarayıcı

Windows Chrome / Edge

Mac Safari

iPhone Safari

Android Chrome

Problem:

iPhone ve TV farklı aktivasyon yapısı istiyor.

Dizinsel farklılıklar nedeniyle bazı yapılar açılamıyor.

İstenen:

Unified activation mimarisi

Platforma özel fallback yapısı

Tarayıcı feature-detection sistemi

User-agent bağımlılığının minimize edilmesi

6️⃣ LOCAL WEB TEMPLATE GÖRÜNTÜLEME
Senaryo:

Kendi web editörümüzde oluşturduğumuz local web template linki playlist'e ekleniyor.

Sorun:

Proxy gereksinimi olmadan görüntülenmeli.

Lokal içerik remote cihazda nasıl çalışacak?

İncelenecek:

Public static serve çözümü

Secure tunnel yapısı

CDN push mekanizması

Web bundle sistemi

Offline cache manifest

İstenen:

Proxy gereksinimi olmadan local template yayınlama çözümü

Güvenli ve performanslı dağıtım yapısı

7️⃣ GENEL MİMARİ DENETİM

Tam sistem şu başlıklarda incelenecek:

Playlist mimarisi

Cihaz eşleştirme süreci

PWA davranışı

Proxy altyapısı

Büyük ölçek performans

UI/UX profesyonellik seviyesi

Çoklu platform uyumluluğu

Cache ve veri akışı

Güvenlik başlıkları

🎯 Nihai Hedef

Signage sisteminin:

Kurumsal seviyede UI/UX’e sahip,

10.000+ cihaz destekleyebilen,

Tüm TV ve mobil platformlarda sorunsuz çalışan,

PWA ve tarayıcı bazlı erişimi güçlü,

Proxy ve iframe sorunlarını çözmüş,

Performanslı ve sürdürülebilir,

Profesyonel dağıtım mimarisine sahip

bir yapıya dönüştürülmesi.