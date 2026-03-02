# HALMIKROV16 vs Mevcut Sistem - Künye Sorgulama Karşılaştırması

**Tarih:** 2026-02-06  
**Amaç:** HALMIKROV16 yazılımındaki HAL entegrasyonu ve künye sorgulama işlemlerinin mevcut sistemimizle karşılaştırılması

---

## 1. Genel Bakış

### HALMIKROV16 Yapısı
- **Dil:** C# (.NET Framework 4.0)
- **SOAP Client:** WCF Service References (BildirimServiceReference, GenelServiceReference, UrunServiceReference)
- **Veritabanı:** SQL Server (HalDBEntities - Entity Framework)
- **Ayarlar:** Veritabanından (FirmaBilgileri tablosu)

### Mevcut Sistem Yapısı
- **Dil:** PHP
- **SOAP Client:** cURL SOAP (HAL WSDL hatası nedeniyle) + PHP SoapClient (fallback)
- **Veritabanı:** MySQL/MariaDB
- **Ayarlar:** `integration_settings` tablosu (SettingsResolver) veya `settings` tablosu (JSON)

---

## 2. Künye Sorgulama Metodları Karşılaştırması

### HALMIKROV16 - `TumKunyeSorgula()`

**Metod:** `BildirimServisBildirimciyeYapilanBildirimListesi`

**Parametreler:**
```csharp
BildirimSorguIstek istek = new BildirimSorguIstek()
{
    BaslangicTarihi = bsTarihi,              // Kullanıcı tarafından belirlenen başlangıç tarihi
    BitisTarihi = btTarih,                    // Kullanıcı tarafından belirlenen bitiş tarihi
    KunyeNo = kunye,                          // 0 = tüm künyeler, >0 = spesifik künye
    KunyeTuru = kunyeTuru,                    // Byte (0, 1, 2, ...)
    KalanMiktariSifirdanBuyukOlanlar = true,  // ✅ TRUE - Sadece kalan miktarı > 0 olanlar
    UniqueId = "",
    Sifat = Settings.Instance.SifatID         // ✅ ÖNEMLİ: Sifat ID gönderiliyor (Market = 7)
};

// Kimlik bilgileri
string password = Settings.Instance.Sifre;
string servicePassword = Settings.Instance.WbServiceSifre;
string userName = Settings.Instance.VgNo;     // Vergi No
```

**Kullanım Senaryosu:**
- Tarih aralığına göre tüm künyeleri listeleme
- Kalan miktarı sıfırdan büyük olan künyeleri filtreleme
- Bildirimciye yapılan bildirimleri sorgulama

---

### Mevcut Sistem - `queryByKunyeNo()`

**Metod:** `BildirimServisReferansKunyeler`

**Parametreler:**
```php
$soapBody = '<web:BaseRequestMessageOf_ReferansKunyeIstek>
    <web:Istek xmlns:a="' . $dcNs . '">
        <a:BaslangicTarihi>' . $startDate . '</a:BaslangicTarihi>  // Son 30 gün (sabit)
        <a:BitisTarihi>' . $endDate . '</a:BitisTarihi>            // Bugün (sabit)
        <a:KalanMiktariSifirdanBuyukOlanlar>false</a:KalanMiktariSifirdanBuyukOlanlar>  // ❌ FALSE
        <a:KisiSifat>0</a:KisiSifat>                               // ❌ 0 (sıfır)
        <a:KunyeNo>' . $kunyeNo . '</a:KunyeNo>                    // Sadece spesifik künye
        <a:MalinSahibiTcKimlikVergiNo>' . $vergiNo . '</a:MalinSahibiTcKimlikVergiNo>
        <a:UrunId>0</a:UrunId>
    </web:Istek>
    ...
</web:BaseRequestMessageOf_ReferansKunyeIstek>';
```

**Kullanım Senaryosu:**
- Tek bir künye numarası sorgulama
- Referans künyeleri sorgulama

---

## 3. Kritik Farklar ve Eksik Yapılandırmalar

### ❌ 1. SOAP Metodu Farkı

| Özellik | HALMIKROV16 | Mevcut Sistem |
|---------|-------------|---------------|
| **Metod** | `BildirimServisBildirimciyeYapilanBildirimListesi` | `BildirimServisReferansKunyeler` |
| **Amaç** | Bildirimciye yapılan bildirimleri listeleme | Referans künyeleri sorgulama |
| **Sonuç** | Bildirim listesi (DTOBildirimSorgu) | Referans künye bilgisi |

**Etki:** Farklı SOAP metodları farklı veri setleri döndürür. HALMIKROV16 bildirim listesi alırken, mevcut sistem referans künye bilgisi alıyor.

**Öneri:** İki metodun da desteklenmesi gerekebilir:
- Tek künye sorgulama: `BildirimServisReferansKunyeler` (mevcut)
- Tarih aralığına göre liste: `BildirimServisBildirimciyeYapilanBildirimListesi` (eksik)

---

### ❌ 2. Sifat Parametresi Eksik

**HALMIKROV16:**
```csharp
Sifat = Settings.Instance.SifatID  // Market = 7, Manav = 8, vb.
```

**Mevcut Sistem:**
```php
<a:KisiSifat>0</a:KisiSifat>  // ❌ Her zaman 0
```

**HAL Sifat Kodları (HALMIKROV16'dan):**
- 0 = Seçiniz
- 1 = Sanayici
- 2 = İhracat
- 3 = İthalat
- 4 = Üretici
- 5 = Komisyoncu
- 6 = Tüccar (Hal İçi)
- 7 = **Market** ⭐
- 8 = **Manav** ⭐
- 9 = Depo/Tasnif ve Ambalaj
- 10 = Üretici Örgütü
- 11 = Pazarcı
- 12 = Otel
- 13 = Lokanta
- 14 = Yurt
- 15 = Yemek Fabrikası
- 19 = Hastane
- 20 = Tüccar (Hal Dışı)

**Etki:** HAL sistemi, kullanıcının sıfatına göre farklı künyeleri döndürebilir. `Sifat=0` gönderildiğinde bazı künyeler görünmeyebilir.

**Öneri:** HAL entegrasyon ayarlarına `sifat_id` alanı eklenmeli ve sorgulama sırasında bu değer gönderilmeli.

---

### ❌ 3. KalanMiktariSifirdanBuyukOlanlar Parametresi

**HALMIKROV16:**
```csharp
KalanMiktariSifirdanBuyukOlanlar = true  // ✅ Sadece kalan miktarı > 0 olanlar
```

**Mevcut Sistem:**
```php
<a:KalanMiktariSifirdanBuyukOlanlar>false</a:KalanMiktariSifirdanBuyukOlanlar>  // ❌ Tüm künyeler
```

**Etki:** Mevcut sistem tükenmiş künyeleri de döndürebilir. HALMIKROV16 sadece kalan miktarı olan künyeleri getiriyor.

**Öneri:** Varsayılan olarak `true` yapılmalı veya kullanıcı tercihine bırakılmalı.

---

### ❌ 4. Tarih Aralığı Esnekliği

**HALMIKROV16:**
- Kullanıcı başlangıç ve bitiş tarihi seçebiliyor
- Tarih aralığı sorguya göre değişebiliyor

**Mevcut Sistem:**
- Sabit son 30 gün kullanılıyor
- Kullanıcı tarih aralığı seçemiyor

**Etki:** Eski künyeler sorgulanamayabilir (30 günden eski).

**Öneri:** Tarih aralığı parametresi eklenmeli veya daha geniş bir aralık kullanılmalı (örn. son 1 yıl).

---

### ❌ 5. KunyeNo Parametresi

**HALMIKROV16:**
```csharp
KunyeNo = kunye  // 0 = tüm künyeler, >0 = spesifik künye
```

**Mevcut Sistem:**
```php
<a:KunyeNo>' . $kunyeNo . '</a:KunyeNo>  // Sadece spesifik künye
```

**Etki:** Mevcut sistem sadece tek künye sorgulayabiliyor. HALMIKROV16 tarih aralığına göre tüm künyeleri listeleyebiliyor.

---

### ❌ 6. MalinSahibiTcKimlikVergiNo vs UserName

**HALMIKROV16:**
- `MalinSahibiTcKimlikVergiNo` parametresi kullanılmıyor (sadece `ReferansKunyeIstek` metodunda)
- `BildirimServisBildirimciyeYapilanBildirimListesi` metodunda sadece `UserName` (VgNo) kullanılıyor

**Mevcut Sistem:**
```php
<a:MalinSahibiTcKimlikVergiNo>' . $vergiNo . '</a:MalinSahibiTcKimlikVergiNo>
```

**Etki:** HALMIKROV16 bildirimciye ait tüm künyeleri getirirken, mevcut sistem sadece belirli bir vergi numarasına ait künyeleri getiriyor.

---

## 4. Ayarlar Karşılaştırması

### HALMIKROV16 Ayarları (FirmaBilgileri Tablosu)

| Alan | Açıklama | Örnek |
|------|----------|-------|
| `TcVgNo` | Vergi No / TC Kimlik | `3130355406` |
| `Sifre` | HAL kullanıcı şifresi (encrypted) | `********` |
| `ServisSifresi` | HAL web servis şifresi (encrypted) | `********` |
| `Sifati` | Bildirimci sıfatı (SifatID) | `7` (Market) |
| `Sifat2` | İkinci kişi sıfatı (opsiyonel) | `8` (Manav) |
| `Unvani` | Firma unvanı | `ABC Market` |
| `EPosta` | E-posta | `info@abc.com` |
| `GsmNo` | Cep telefonu | `5551234567` |

### Mevcut Sistem Ayarları (integration_settings / settings)

| Alan | Açıklama | Durum |
|------|----------|-------|
| `username` | HAL kullanıcı adı (Vergi No) | ✅ Var |
| `password` | HAL kullanıcı şifresi | ✅ Var |
| `service_password` | HAL web servis şifresi | ✅ Var |
| `tc_vergi_no` | TC Kimlik / Vergi No | ✅ Var |
| `enabled` | Entegrasyon aktif/pasif | ✅ Var |
| **`sifat_id`** | **Bildirimci sıfatı** | ❌ **EKSİK** |

---

## 5. Önerilen İyileştirmeler

### 1. Sifat ID Yapılandırması Ekle

**Dosya:** `api/hal/settings.php`, `services/HalKunyeService.php`, `public/assets/js/pages/settings/IntegrationSettings.js`

**Değişiklikler:**
1. HAL ayarlarına `sifat_id` alanı ekle
2. Frontend'de sıfat seçimi dropdown'ı ekle
3. Künye sorgulama sırasında `Sifat` parametresini gönder

**Kod Örneği:**
```php
// services/HalKunyeService.php
private function queryViaCurlSoap(string $kunyeNo): array
{
    // ...
    $sifatId = $this->settings['sifat_id'] ?? 0;  // Varsayılan 0
    
    $soapBody = '<web:BaseRequestMessageOf_ReferansKunyeIstek>
        <web:Istek xmlns:a="' . $dcNs . '">
            ...
            <a:KisiSifat>' . $sifatId . '</a:KisiSifat>  // ✅ Sifat ID gönder
            ...
        </web:Istek>
        ...
    </web:BaseRequestMessageOf_ReferansKunyeIstek>';
}
```

---

### 2. KalanMiktariSifirdanBuyukOlanlar Parametresini Düzelt

**Dosya:** `services/HalKunyeService.php`

**Değişiklik:**
```php
<a:KalanMiktariSifirdanBuyukOlanlar>true</a:KalanMiktariSifirdanBuyukOlanlar>  // ✅ true yap
```

---

### 3. BildirimServisBildirimciyeYapilanBildirimListesi Metodunu Ekle

**Dosya:** `services/HalKunyeService.php`

**Yeni Metod:**
```php
/**
 * Tarih aralığına göre bildirimciye yapılan bildirimleri listele
 * (HALMIKROV16'daki TumKunyeSorgula metoduna benzer)
 *
 * @param DateTime $startDate Başlangıç tarihi
 * @param DateTime $endDate Bitiş tarihi
 * @param int $kunyeTuru Künye türü (0 = tümü)
 * @param int $kunyeNo Künye numarası (0 = tümü)
 * @return array Bildirim listesi
 */
public function queryBildirimciyeYapilanBildirimler(
    DateTime $startDate,
    DateTime $endDate,
    int $kunyeTuru = 0,
    int $kunyeNo = 0
): array {
    // SOAP Action: BildirimServisBildirimciyeYapilanBildirimListesi
    // Implementasyon...
}
```

---

### 4. Tarih Aralığı Parametresi Ekle

**Dosya:** `api/hal/query.php`, `services/HalKunyeService.php`

**Değişiklik:**
- API endpoint'ine `start_date` ve `end_date` parametreleri ekle
- Varsayılan olarak son 30 gün kullan, ama kullanıcı özelleştirebilsin

---

### 5. Ayarlar UI'ına Sifat Seçimi Ekle

**Dosya:** `public/assets/js/pages/settings/IntegrationSettings.js`, `locales/tr/pages/settings.json`

**Değişiklik:**
```javascript
// Sifat dropdown ekle
<div class="form-group">
    <label class="form-label">${this.__('integrations.hal.fields.sifatId')}</label>
    <select id="hal_sifat_id" class="form-input">
        <option value="0">Seçiniz...</option>
        <option value="7">Market</option>
        <option value="8">Manav</option>
        <option value="6">Tüccar (Hal İçi)</option>
        <option value="20">Tüccar (Hal Dışı)</option>
        <!-- Diğer sıfatlar... -->
    </select>
    <small class="form-hint">${this.__('integrations.hal.hints.sifatId')}</small>
</div>
```

---

## 6. Ürün Sayfası Künye Sorgulama - Parametre Etkisi

### Bağlantı Testi vs. Gerçek Sorgu

**Bağlantı testi** yalnızca kimlik doğrulama yapar.  
**Künye sorgusu** ise HAL tarafında ekstra filtreler ile çalışır:

- `UserName/Password/ServicePassword`: Bağlantının kurulması için yeterlidir.
- `tc_vergi_no` / `MalinSahibiTcKimlikVergiNo`: Künye sahibini sınırlar.
- `KisiSifat`: İşletme sıfatına göre filtre uygular.

Bu nedenle **bağlantı testi başarılı olup** ürün sayfasındaki künye sorgusu **0 sonuç** döndürebilir.

### Parametreler Belirlenmezse Ne Olur?

- `tc_vergi_no` boşsa sistem **username** değerini kullanır (yine vergi no gerekli olur).
- `sifat_id` yoksa **0** gönderilir ve bazı künyelerde sonuç **bulunamayabilir**.
- Yani “sadece künye numarası” her zaman yeterli değildir.

### Önerilen Davranış

1. **Künye hangi firmaya aitse**, `tc_vergi_no` o firmaya set edilmeli.
2. **Bildirimci Sıfatı** doğru seçilmeli (örn. Komisyoncu=5, Tüccar Hal İçi=6).

### Opsiyonel İyileştirme (İleride)

Kullanıcı konforu için şu otomasyonlar eklenebilir:

- `sifat_id` boşsa `KisiSifat` alanını **hiç göndermemek**
- `sifat_id = 0` ise **farklı sıfatlar ile otomatik deneme**
- `tc_vergi_no` boşsa sadece `KunyeNo` ile deneme (HAL izin verirse)

---

## 7. Test Senaryoları

### Senaryo 1: Sifat ID ile Sorgulama
1. HAL ayarlarına `sifat_id = 7` (Market) ekle
2. Künye sorgula
3. Sonuçların sadece Market sıfatına ait künyeleri içerdiğini doğrula

### Senaryo 2: KalanMiktariSifirdanBuyukOlanlar = true
1. Künye sorgula
2. Sonuçlarda sadece `kalan_miktar > 0` olan künyelerin geldiğini doğrula

### Senaryo 3: Tarih Aralığı Sorgulama
1. `start_date = 2025-01-01`, `end_date = 2025-12-31` gönder
2. Bu tarih aralığındaki tüm künyelerin geldiğini doğrula

---

## 8. Sonuç ve Öncelikler

### Yüksek Öncelik
1. ✅ **Sifat ID yapılandırması ekle** - Bazı künyeler görünmüyor olabilir
2. ✅ **KalanMiktariSifirdanBuyukOlanlar = true** - Tükenmiş künyeler filtrelenmeli

### Orta Öncelik
3. ⚠️ **BildirimServisBildirimciyeYapilanBildirimListesi metodu ekle** - Tarih aralığına göre liste sorgulama
4. ⚠️ **Tarih aralığı parametresi ekle** - Daha esnek sorgulama

### Düşük Öncelik
5. ℹ️ **KunyeNo = 0 desteği** - Tüm künyeleri listeleme (performans riski)

---

## 9. Referanslar

- HALMIKROV16 Kaynak Kodu: `tasarımlar/HALMIKROV16/Hal/HalYonetim/`
- Mevcut Sistem: `services/HalKunyeService.php`
- HAL SOAP WSDL: `https://hks.hal.gov.tr/WebServices/BildirimService.svc?wsdl`
- HAL Sifat Kodları: HALMIKROV16 `FrmFirmaAyarlari.cs` (satır 117)

---

**Hazırlayan:** AI Assistant  
**Tarih:** 2026-02-06

