# HAL Kayıt Sistemi - Resmi Başvuru Maili

**Tarih:** 2026-02-06
**Kime:** Mehmet Dumanlı - M.Dumanli@gtb.gov.tr
**Gönderen:** Uğur Akagündüz - Çamlıca Barkod Yazılım Ekibi, Yazılım Uzmanı

---

## Mail İçeriği

**Konu:** HAL Künye Sorgulama Web Servisi Erişim Talebi - Çamlıca Barkod Yazılım Ekibi

---

Sayın Mehmet Bey,

Öncelikle iyi günler dilerim. Ben Uğur Akagündüz, Çamlıca Barkod Yazılım Ekibi'nde Yazılım Uzmanı olarak görev yapmaktayım.

Firmamız, perakende sektörüne yönelik elektronik raf etiketi (ESL) ve dijital tabela yönetim platformu geliştirmektedir. Bu platform kapsamında, manav ürünlerinin izlenebilirliğini sağlamak amacıyla HAL Kayıt Sistemi (HKS) ile entegrasyon çalışmalarımız bulunmaktadır.

### Mevcut Durum

HAL sisteminde hal.gov.tr üzerinden herkese açık olan künye sorgulama sayfasının varlığından haberdarız. Ancak bu sayfa CAPTCHA (robot doğrulama) koruması altında olduğu için, arka plan işlemlerimizde (backend) otomatik sorgulama yapılamamaktadır. Selenium veya benzeri tarayıcı otomasyon araçlarını etik ve teknik nedenlerle kullanmak istemiyoruz.

SOAP Web Servisleri (BildirimService.svc) tarafında ise WSDL dokümanını ayrıntılı olarak inceledik ve SOAP zarfımızı WCF DataContract serialization kurallarına uygun şekilde yapılandırdık. Teknik yapılandırmamız aşağıdaki gibidir:

- **Endpoint:** `https://hks.hal.gov.tr/WebServices/BildirimService.svc`
- **SOAP Versiyonu:** 1.1 (`text/xml; charset=utf-8`)
- **Namespace:** `http://www.gtb.gov.tr//WebServices`
- **Element Sırası:** WSDL xs:sequence sıralaması (Istek, Password, ServicePassword, UserName)
- **İşlem:** `BildirimServisBildirimTurleri`, `BildirimServisReferansKunyeler`

Sunucunuzdan HTTP 200 yanıtı alıyoruz, yani SOAP yapımız doğru şekilde işlenmektedir.

### Talebimiz: Geliştirici Dostu Erişim İmkânı

Platform kullanımında künye bilgilerinin otomatik sorgulanması büyük önem taşımaktadır. Bu kapsamda:

- CAPTCHA gerektirmeyen, backend sistemler için uygun bir API erişimi
- IP bazlı beyaz liste (whitelist) tanımlaması ile CAPTCHA muafiyeti
- Veya benzeri bir geliştirici erişim mekanizması

konusunda bilgi ve destek talep ediyoruz. Eğer bu tür bir erişim için resmi bir başvuru süreci gerekiyorsa, gerekli formları ve prosedürü öğrenmekten memnuniyet duyarız.

### Teknik Altyapımız Hakkında

- Platformumuz PHP + PostgreSQL tabanlı, multi-tenant mimariye sahiptir
- SOAP isteklerini cURL üzerinden göndermekteyiz
- SSL/TLS bağlantısı desteklenmektedir
- Sorgulama frekansı düşük seviyede tutulacaktır (rate limiting uygulanmaktadır)
- Elde edilen veriler yalnızca market raf etiketlerinde ürün izlenebilirlik bilgisi olarak kullanılacaktır

### Sonuç

Amacımız, tüketicilerin market raflarında gördüğü elektronik etiketlerde ürünlerin HAL künye bilgilerini (üretici, üretim yeri, bildirim tarihi vb.) göstererek tarımsal ürünlerin izlenebilirliğine katkı sağlamaktır. Bu, HAL sisteminin amaçlarıyla da özdeş bir hedeftir.

Zaman ayırdığınız için teşekkür eder, konuyla ilgili geri dönüş ve yönlendirmelerinizi bekleriz.

Saygılarımla,

**Uğur Akagündüz**
Yazılım Uzmanı
Çamlıca Barkod Yazılım Ekibi

---

## Notlar (Maile eklenmeyecek - iç kullanım)

### Teknik Detaylar (Gerekirse Ek Bilgi Olarak Gönderilebilir)

- WSDL boyutu: 47,082 byte, 63+ duplicate element içeriyor
- SOAP 1.2 denendiğinde HAL WAF tarafından engelleniyor ("İstek reddedildi")
- WS-Security Header yöntemi de denendi, başarısız
- 20+ farklı SOAP formatı test edildi, sadece SOAP 1.1 + Body credentials çalışıyor
- HataKodu referansları: 0=Başarılı, 12=ServicePassword hatalı, 13=Username/Password hatalı
- Hesap çok fazla başarısız deneme sonrası kilitlenmiş olabilir

### Gönderim Öncesi Kontrol Listesi

- [ ] Mail adresini doğrula: M.Dumanli@gtb.gov.tr
- [ ] Firma bilgilerini doğrula
- [ ] CC'ye yönetici eklenecek mi kontrol et
