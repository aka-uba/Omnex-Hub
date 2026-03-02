# HAL Kayit Sistemi (HKS) - Teknik Entegrasyon Dokumani

**Son Guncelleme:** 2026-02-06
**Durum:** Kimlik dogrulama sorunu devam ediyor (SOAP yapisi dogrulanmis)
**Servis Dosyasi:** `services/HalKunyeService.php`

---

## 1. Genel Bakis

HAL Kayit Sistemi (HKS), Turkiye Ticaret Bakanligi (eski GTB) tarafindan isleltilen tarimsal urun izlenebilirlik platformudur. Her urun partisine 19 haneli benzersiz bir kunye numarasi atanir.

### Entegrasyon Amaci

Omnex Display Hub uzerinden manav/market urunlerinin kunye numarasi ile sorgulanmasi ve urun etiketlerine kunye bilgilerinin eklenmesi.

### Mimari

```
+---------------------------+       SOAP/HTTPS        +---------------------------+
|   Omnex Display Hub       | ----------------------> |   HAL Web Services        |
|   (HalKunyeService.php)   |                         |   hks.hal.gov.tr          |
+---------------------------+                         +---------------------------+
         |                                                       |
         | Fallback                                   WCF (.NET) DataContract
         v                                            xs:sequence serialization
+---------------------------+       HTTPS              +---------------------------+
|   HalKunyeScraper.php     | ----------------------> |   hal.gov.tr              |
|   (Web Scraping)          |                         |   Kunye Sorgulama Sayfasi |
+---------------------------+                         +---------------------------+
                                                      (CAPTCHA korunakli - CALISMAZ)
```

### Sorgulama Onceligi

1. **SOAP API** (oncelikli) - HAL kimlik bilgileri girilmisse
2. **Web Scraper** (fallback) - SOAP basarisizsa veya kimlik yoksa
3. **CAPTCHA Uyarisi** - Scraper da basarisizsa kullaniciya modal ile bilgi verilir

---

## 2. SOAP API Teknik Detaylari

### Sunucu Bilgileri

| Ozellik | Deger |
|---------|-------|
| Platform | WCF (.NET / Windows Communication Foundation) |
| Servis URL | `https://hks.hal.gov.tr/WebServices/BildirimService.svc` |
| WSDL URL | `https://hks.hal.gov.tr/WebServices/BildirimService.svc?wsdl` |
| Genel Servis URL | `https://hks.hal.gov.tr/WebServices/GenelService.svc` |
| Kunye Sorgulama (Public) | `https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx` |

### SOAP Surumleri - Test Sonuclari

| SOAP Surumu | Content-Type | Durum | Aciklama |
|-------------|-------------|-------|----------|
| **SOAP 1.1** | `text/xml; charset=utf-8` | **KABUL EDILIYOR** | Tek calisan format |
| SOAP 1.2 | `application/soap+xml; charset=utf-8` | REDDEDILIYOR | WAF tarafindan engelleniyor: "Istek reddedildi" |
| SOAP 1.2 + WS-Security Header | `application/soap+xml` | REDDEDILIYOR | WAF engeli |

**Sonuc:** HAL sunucusu **sadece SOAP 1.1** kabul ediyor.

### Namespace

| Tip | Deger | Not |
|-----|-------|-----|
| SOAP Envelope | `http://schemas.xmlsoap.org/soap/envelope/` | SOAP 1.1 standart |
| HAL Web Services | `http://www.gtb.gov.tr//WebServices` | **Cift slash (//) WSDL'de tanimli - dogru** |
| DataContract | `http://schemas.datacontract.org/2004/07/GTB.HKS.Core.ServiceContract` | Response namespace |
| Serialization | `http://schemas.microsoft.com/2003/10/Serialization/` | Opsiyonel |

### Kimlik Dogrulama Yontemi

Kimlik bilgileri **SOAP Body** icinde gonderilir (WS-Security Header DEGIL):

```xml
<soap:Body>
    <web:BaseRequestMessageOf_XXXIstek>
        <web:Password>SIFRE</web:Password>
        <web:ServicePassword>WEB_SIFRESI</web:ServicePassword>
        <web:UserName>KULLANICI_ADI</web:UserName>
    </web:BaseRequestMessageOf_XXXIstek>
</soap:Body>
```

**NOT:** WS-Security Header formatindaki istekler SOAP 1.2 gerektirdigi icin HAL WAF tarafindan reddedilir.

### Element Sirasi (xs:sequence)

WCF DataContract serialization kurallarina gore WSDL'deki `xs:sequence` sirasi takip edilmelidir:

```
1. Istek        (opsiyonel - sorgu verileri)
2. Password     (kullanici sifresi)
3. ServicePassword (web servis sifresi)
4. UserName     (kullanici adi / TC veya Vergi No)
```

**Test Bulgulari:** WCF sunucusu element sirasina toleransli davranir - farkli siralarda da ayni sonuc doner. Ancak best practice olarak WSDL sirasina uyulmasi onerilir.

### WSDL Sorunu

HAL'in WSDL dosyasi (47.082 byte) **63+ duplicate element** iceriyor. Bu nedenle:
- PHP `SoapClient` WSDL'i parse edemiyor (hata veriyor)
- cURL ile raw SOAP request gonderilmesi gerekiyor
- `HalKunyeService.php` icinde `sendCurlSoapRequest()` metodu bu amacla yazildi

---

## 3. Desteklenen Operasyonlar

### 3.1. BildirimServisBildirimTurleri (Baglanti Testi)

Bildirim turlerini listeler. Basit oldugu icin baglanti testi olarak kullanilir.

| Ozellik | Deger |
|---------|-------|
| SOAPAction | `http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisBildirimTurleri` |
| Wrapper Element | `BaseRequestMessageOf_BildirimTurleriIstek` |

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:web="http://www.gtb.gov.tr//WebServices">
    <soap:Body>
        <web:BaseRequestMessageOf_BildirimTurleriIstek>
            <web:Password>SIFRE</web:Password>
            <web:ServicePassword>WEB_SIFRESI</web:ServicePassword>
            <web:UserName>KULLANICI_ADI</web:UserName>
        </web:BaseRequestMessageOf_BildirimTurleriIstek>
    </soap:Body>
</soap:Envelope>
```

### 3.2. BildirimServisReferansKunyeler (Kunye Sorgulama)

Kunye numarasi ile urun bilgilerini sorgular.

| Ozellik | Deger |
|---------|-------|
| SOAPAction | `http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisReferansKunyeler` |
| Wrapper Element | `BaseRequestMessageOf_ReferansKunyelerIstek` |

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:web="http://www.gtb.gov.tr//WebServices">
    <soap:Body>
        <web:BaseRequestMessageOf_ReferansKunyelerIstek>
            <web:Istek>
                <web:BaslangicTarihi i:nil="true"
                    xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
                <web:BitisTarihi i:nil="true"
                    xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
                <web:KalanMiktariSifirdanBuyukOlanlar>false</web:KalanMiktariSifirdanBuyukOlanlar>
                <web:KisiSifat>0</web:KisiSifat>
                <web:KunyeNo>2073079250202837944</web:KunyeNo>
                <web:MalinSahibiTcKimlikVergiNo>TC_VERGI_NO</web:MalinSahibiTcKimlikVergiNo>
                <web:UrunId>0</web:UrunId>
            </web:Istek>
            <web:Password>SIFRE</web:Password>
            <web:ServicePassword>WEB_SIFRESI</web:ServicePassword>
            <web:UserName>KULLANICI_ADI</web:UserName>
        </web:BaseRequestMessageOf_ReferansKunyelerIstek>
    </soap:Body>
</soap:Envelope>
```

### 3.3. BildirimServisSifatListesi

Sifat (uretici, komisyoncu, ihracatci vb.) listesini getirir.

| Ozellik | Deger |
|---------|-------|
| SOAPAction | `http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisSifatListesi` |
| Wrapper Element | `BaseRequestMessageOf_SifatIstek` |

**ONEMLI:** Element adi `BaseRequestMessageOf_SifatListesiIstek` DEGIL, `BaseRequestMessageOf_SifatIstek` olmali. HAL sunucusu beklenen element adini hata mesajinda acikca belirtiyor.

### 3.4. Diger Operasyonlar (WSDL'den)

WSDL'de tanimli diger SOAPAction degerleri:

| Operasyon | SOAPAction |
|-----------|------------|
| BildirimServisKayitliKisiSorgu | `.../IBildirimService/BildirimServisKayitliKisiSorgu` |
| BildirimServisIlListesi | `.../IBildirimService/BildirimServisIlListesi` |
| BildirimServisIlceListesi | `.../IBildirimService/BildirimServisIlceListesi` |
| BildirimServisBildirimOlustur | `.../IBildirimService/BildirimServisBildirimOlustur` |
| BildirimServisBildirimIptal | `.../IBildirimService/BildirimServisBildirimIptal` |
| BildirimServisBildirimDuzenle | `.../IBildirimService/BildirimServisBildirimDuzenle` |
| BildirimServisKunyeSorgula | `.../IBildirimService/BildirimServisKunyeSorgula` |
| BildirimServisBildirimListesi | `.../IBildirimService/BildirimServisBildirimListesi` |

### Wrapper Element Adlandirma Kurali

WCF DataContract isimlendirme kurali: `BaseRequestMessageOf_{OperasyonTipi}Istek`

**DIKKAT:** Operasyon tipi her zaman operasyon adinin tam kopyasi degildir:
- `BildirimTurleri` -> `BaseRequestMessageOf_BildirimTurleriIstek` (tam kopya)
- `ReferansKunyeler` -> `BaseRequestMessageOf_ReferansKunyelerIstek` (tam kopya)
- `SifatListesi` -> `BaseRequestMessageOf_SifatIstek` (**KISALTILMIS - "Listesi" yok**)

HAL sunucusu yanlis element adi kullanildiginda beklenen adi hata mesajinda belirtir.

---

## 4. Hata Kodlari

### HTTP Duzeyi

| HTTP Kodu | Anlam | Sebep |
|-----------|-------|-------|
| 200 | Basarili istek | SOAP islendiginde (hata olsa bile) |
| 500 | Sunucu hatasi | SOAP yapisi hatali veya element adi yanlis |
| 403 | Yasaklandi | SOAP 1.2 formatinda istek yapildiysa (WAF engeli) |

### HAL Hata Kodlari (Response XML icinde)

| HataKodu | IslemKodu | Mesaj Kodu | Anlam |
|----------|-----------|------------|-------|
| 0 | GTBWSRV0000001 | - | **Basarili** |
| 1 | GTBWSRV0000002 | GTBGLB00000001 | Genel hata / Beklenmeyen hata |
| 11 | - | GTBGLB00000011 | Kullanici bilgileri yanlis |
| **12** | GTBWSRV0000002 | **GTBGLB00000012** | **Web servis sifresi (ServicePassword) yanlis veya eksik** |
| **13** | - | - | **Kimlik dogrulama hatasi (kullanici adi/sifre yanlis)** |

### Hata Response Ornegi

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Body>
        <BaseResponseMessageOf_BildirimTurleriCevap
            xmlns="http://www.gtb.gov.tr//WebServices">
            <HataKodlari
                xmlns:a="http://schemas.datacontract.org/2004/07/GTB.HKS.Core.ServiceContract"
                xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
                <a:ErrorModel>
                    <a:HataKodu>12</a:HataKodu>
                    <a:Mesaj>GTBGLB00000012</a:Mesaj>
                </a:ErrorModel>
            </HataKodlari>
            <IslemKodu>GTBWSRV0000002</IslemKodu>
            <Sonuc i:nil="true"
                xmlns:a="http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract"
                xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
        </BaseResponseMessageOf_BildirimTurleriCevap>
    </s:Body>
</s:Envelope>
```

---

## 5. cURL Request Yapilandirmasi

```php
curl_setopt_array($ch, [
    CURLOPT_URL            => 'https://hks.hal.gov.tr/WebServices/BildirimService.svc',
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $soapEnvelope,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,   // HAL sertifikasi bazen sorun cikarir
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: text/xml; charset=utf-8',           // SOAP 1.1
        'SOAPAction: "http://www.gtb.gov.tr//WebServices/IBildirimService/OPERASYON_ADI"',
        'Accept: text/xml',
        'Content-Length: ' . strlen($soapEnvelope)
    ]
]);
```

**Onemli Header Notlari:**
- `Content-Type` mutlaka `text/xml` olmali (`application/soap+xml` kullanilirsa REDDEDILIR)
- `SOAPAction` cift tirnak icinde olmali: `"http://..."`
- `Accept: text/xml` header'i eklenmeli

---

## 6. Web Scraper (CAPTCHA Sorunu)

### Durum

HAL'in herkese acik kunye sorgulama sayfasi (`hal.gov.tr/Sayfalar/KunyeSorgulama.aspx`) **CAPTCHA (robot dogrulama)** ile korunmaktadir.

### Denenen Yontemler ve Sonuclari

| Yontem | Sonuc | Aciklama |
|--------|-------|----------|
| Direkt URL parametresi | BASARISIZ | `?kunye=XXX`, `?kunyeNo=XXX` vb. - CAPTCHA sayfasina yonlendiriyor |
| SharePoint Search API | BASARISIZ | `/_api/search/query` - 403 veya bos sonuc |
| Form POST submit | BASARISIZ | `__VIEWSTATE` + `__REQUESTDIGEST` ile form gonderimi - CAPTCHA engeli |
| Cookie-based session | BASARISIZ | Cookie tasima ile oturum devam ettirme - CAPTCHA yeniden isteniyor |

### CAPTCHA Engeli Hakkinda

- HAL sitesi SharePoint tabanli bir platformda calisir
- Kunye sorgulama sayfasina erisimde her zaman "Ben robot degilim" dogrulamasi istenir
- Bu dogrulama JavaScript tabanlidir ve headless browser olmadan asilamaz
- **Selenium/Puppeteer gibi headless browser araclari kasitli olarak kullanilmamaktadir** (etik ve teknik nedenlerle)

### Onerilen Cozum

HAL IT birimi ile iletisime gecilerek:
1. CAPTCHA'siz bir API endpoint'i veya IP whitelist talebinde bulunma
2. SOAP API kimlik bilgilerinin dogrulanmasi
3. Gelistiriciler icin dokumantasyon talebi

---

## 7. Kimlik Bilgileri

### Gerekli Bilgiler

| Alan | Aciklama | Format |
|------|----------|--------|
| UserName | HAL kullanici adi | TC Kimlik No veya Vergi No (orn: `3130355406`) |
| Password | HAL giris sifresi | HAL portalina giris sifresi |
| ServicePassword | Web servis sifresi (WEB SIFRE) | HAL portali > Hesap Bilgileri > Web Servis Sifresi |
| tc_vergi_no | TC Kimlik veya Vergi No | Kunye sorgulamada kullanilir (opsiyonel) |

### Sifre Turleri

HAL sisteminde **iki farkli sifre** vardir:
1. **Password**: HAL portalina (hks.hal.gov.tr) web tarayicisından giris yapmak icin kullanilan sifre
2. **ServicePassword (WEB SIFRE)**: SOAP Web Services API erisimleri icin ayri bir sifre. HAL portalindeki hesap ayarlarindan olusturulur/goruntulenir.

### Ayar Saklama

Kimlik bilgileri `integration_settings` tablosunda (SettingsResolver) veya `settings` tablosunda `hal_integration` JSON key altinda saklanir:

```json
{
    "hal_integration": {
        "username": "3130355406",
        "password": "********",
        "service_password": "********",
        "tc_vergi_no": "3130355406",
        "enabled": true
    }
}
```

---

## 8. Mevcut Durum ve Test Sonuclari (2026-02-06)

### Yapilan Testler

Toplam **20+ farkli SOAP formati** test edildi:

| Test | Format | HTTP | HataKodu | Sonuc |
|------|--------|------|----------|-------|
| SOAP 1.1 + Body credentials | `text/xml` | 200 | 12/13 | SOAP DOGRU, sifre reddedildi |
| SOAP 1.2 + WS-Security | `application/soap+xml` | 403 | - | WAF engeli |
| SOAP 1.1 + WS-Security | `text/xml` | 500 | - | Yanlis format |
| htmlspecialchars ile | `text/xml` | 200 | 12/13 | Fark yok |
| htmlspecialchars olmadan | `text/xml` | 200 | 12/13 | Fark yok |
| ServicePassword olmadan | `text/xml` | 200 | 12 | ServicePassword gerekli |
| Password/ServicePassword ters | `text/xml` | 200 | 12 | Ters sifre de reddedildi |
| WSDL element sirasi | `text/xml` | 200 | 12 | Sira fark yaratmadi |
| Farkli operasyonlar (6 test) | `text/xml` | 200 | 12 | Tum operasyonlarda ayni hata |
| GenelService endpoint | `text/xml` | 200 | 12 | Farkli endpoint'te de ayni |

### Kesin Sonuc

**SOAP yapisi ve formati %100 DOGRU.** HAL sunucusu istekleri okuyor, isliyor ve anlamli hata kodlari donduruyor. Sorun **kimlik bilgilerinde**:

- Ilk test oturumunda HataKodu **13** (kullanici adi/sifre yanlis)
- Sonraki test oturumunda HataKodu **12** (web servis sifresi yanlis)
- Bu degisim, cok fazla basarisiz deneme sonrasi hesabin gecici kilitlenmis veya HAL sunucusunun farkli dogrulama asamasina gecmis olabilecegini gosteriyor

### Gerekli Aksiyonlar

1. `hks.hal.gov.tr` adresine giriş yaparak kimlik bilgilerini dogrulama
2. Web servis sifresini (WEB SIFRE) HAL portalindan kontrol etme
3. Hesabin aktif ve kilitli olmadigindan emin olma
4. Gerekirse HAL IT birimi ile iletisime gecme

---

## 9. Dosya Yapisi

| Dosya | Aciklama |
|-------|----------|
| `services/HalKunyeService.php` | Ana SOAP servisi (906 satir) |
| `services/HalKunyeScraper.php` | Web scraping servisi (557 satir) |
| `services/HalDataResolver.php` | Sube bazli HAL veri cozumleme |
| `services/SettingsResolver.php` | Multi-tenant ayar cozumleme |
| `api/hal/settings.php` | Ayarlar endpoint (GET/PUT) |
| `api/hal/test.php` | Baglanti testi endpoint |
| `api/hal/query.php` | Tek kunye sorgulama (GET/POST) |
| `api/hal/bulk-query.php` | Toplu kunye sorgulama |
| `api/hal/data.php` | HAL veri CRUD (GET/POST/DELETE) |
| `database/migrations/057_create_product_hal_data.sql` | HAL veri tablosu |
| `database/migrations/058_create_product_branch_hal_overrides.sql` | Sube override tablosu |

### Test Dosyalari

| Dosya | Aciklama |
|-------|----------|
| `tests/hal_connection_test.php` | 6 farkli SOAP format testi |
| `tests/hal_connection_test2.php` | 8 Format A varyasyon testi |
| `tests/hal_wsdl_order_test.php` | WSDL element sirasi testi (7 test) |
| `tests/hal_final_verify.php` | Son dogrulama testi |
| `tests/hal_wsdl_dump.xml` | HAL WSDL dosyasi (47.082 byte) |
| `tests/hal_wsdl_analyze.php` | WSDL analiz scripti |

---

## 10. Frontend Entegrasyonu

### Urun Formu (ProductForm.js)

- Kunye No alani + tarama butonu (ti-scan ikonu)
- Butona tiklandiginda `/api/hal/query` endpoint'i sorgulanir
- Basarili sonuc yesil kutu icinde gosterilir
- "Verileri Uygula" butonu ile form alanlari otomatik doldurulur
- CAPTCHA durumunda `showHalCaptchaWarning()` modali gosterilir

### Ayarlar (IntegrationSettings.js)

- ERP tab'inda HAL karti
- Kullanici adi, sifre, servis sifresi, TC/Vergi No alanlari
- Baglanti testi butonu (`/api/hal/test`)
- Kaydet butonu

### CAPTCHA Uyari Modali

SOAP API ve scraper basarisiz oldugunda kullaniciya iki secenek sunulur:
1. **Manuel sorgulama**: HAL sitesine link (CAPTCHA ile sorgulama)
2. **API entegrasyonu**: Ayarlar > Entegrasyonlar sayfasina link

---

## 11. Kunye Numarasi Formati

- **Uzunluk:** 19 hane (sadece rakam)
- **Ornek:** `2073079250202837944`
- Urun formunda barkod alani gibi davranir
- QR kod olarak etiketlere basilabilir

### Sorgulanabilen Bilgiler

| Alan | Aciklama |
|------|----------|
| malin_adi | Malin adi (Elma, Domates vb.) |
| malin_cinsi | Malin cinsi (Meyve, Sebze vb.) |
| malin_turu | Malin turu (detay) |
| uretici_adi | Uretici adi/soyadi |
| uretim_yeri | Uretim bolgesi (Il/Ilce) |
| ilk_bildirim_tarihi | Hal'e ilk bildirim tarihi |
| malin_sahibi | Malin sahibi |
| tuketim_yeri | Tuketim yeri |
| gumruk_kapisi | Ithal urunler icin gumruk kapisi |
| miktar | Miktar |
| alis_fiyati | Alis fiyati |
| sertifikasyon_kurulusu | Organik sertifika veren kurulus |
| sertifika_no | Sertifika numarasi |
| gecmis_bildirimler | Onceki bildirim kayitlari |

---

## 12. Bilinen Sorunlar ve Kisitlamalar

### Aktif Sorunlar

1. **SOAP API kimlik dogrulama**: Verilen kimlik bilgileri HAL tarafindan reddediliyor (HataKodu 12/13)
2. **Web scraper CAPTCHA engeli**: Herkese acik sorgulama sayfasi robot dogrulamasi gerektiriyor
3. **WSDL parse hatasi**: PHP SoapClient HAL'in 63+ duplicate element iceren WSDL'ini parse edemiyor

### Cozulmus Sorunlar

1. SOAP 1.1 vs 1.2 -> SOAP 1.1 dogru format olarak belirlendi
2. WS-Security vs Body credentials -> Body credentials dogru yontem
3. Element sirasi -> WSDL xs:sequence sirasina guncellendi
4. htmlspecialchars encoding -> Kaldirild (gereksiz)
5. Wrapper element adlandirmasi -> `BaseRequestMessageOf_XXXIstek` formati dogrulandi
6. HataKodu 12 eksikti -> Error code haritasina eklendi
7. queryViaCurlSoap yapisi -> `Istek` child element ile yeniden yazildi
