# Hardcoded Turkce Metin ve Eksik Ceviri Raporu

**Tarih:** 2026-02-16
**Kapsam:** Frontend JS dosyalari (pages, components, core, layouts, utils)
**Amac:** i18n sistemine tasinmamis hardcoded Turkce metinlerin tespiti

---

## Ozet

| Metrik | Deger |
|--------|-------|
| Taranan dizin | pages/, components/, core/, layouts/, utils/, app.js |
| Hardcoded metin iceren dosya | **~25 dosya** |
| Toplam hardcoded Turkce string | **~190+ adet** |
| TR ceviri dosyasi kapsami | %100 (tum sayfalar icin dosya mevcut) |
| EN'de eksik ceviri dosyasi | 1 (notifications.json) |

---

## BOLUM 1: Dil Dosyasi Kapsam Durumu

### Mevcut TR Ceviri Dosyalari (16 adet)

- `locales/tr/common.json` (48 ust-seviye bolum)
- `locales/tr/pages/about.json`
- `locales/tr/pages/admin.json`
- `locales/tr/pages/auth.json`
- `locales/tr/pages/branches.json`
- `locales/tr/pages/dashboard.json`
- `locales/tr/pages/devices.json`
- `locales/tr/pages/media.json`
- `locales/tr/pages/notifications.json`
- `locales/tr/pages/payments.json`
- `locales/tr/pages/products.json`
- `locales/tr/pages/queue.json`
- `locales/tr/pages/settings.json`
- `locales/tr/pages/signage.json`
- `locales/tr/pages/templates.json`
- `locales/tr/pages/web-templates.json`

### Eksik EN Ceviri Dosyasi

| Dosya | Durum |
|-------|-------|
| `locales/en/pages/notifications.json` | **EKSIK** - TR'de var, EN'de yok |

### Sayfa-Ceviri Eslesmesi: %100

Tum 37 sayfa icin `loadPageTranslations()` cagrisi yapilan ceviri dosyalari TR'de mevcut.

---

## BOLUM 2: Hardcoded Turkce Metinler (Oncelik Sirasina Gore)

### YUKSEK ONCELIK - Kullaniciya Gorunen UI Metinleri

---

#### 1. `components/RenderProgressModal.js` (~20 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 53 | `'Render Islemi'` | Modal baslik |
| 62 | `'Baslatiliyor...'` | Durum metni |
| 75 | `'Toplam Cihaz'` | Etiket |
| 79 | `'Tamamlanan'` | Etiket |
| 83 | `'Basarisiz'` | Etiket |
| 87 | `'Bekleyen'` | Etiket |
| 99 | `'Hatalar'` | Bolum basligi |
| 119 | `'Iptal'` | Buton |
| 193 | `'Bekliyor...'` | Durum |
| 194 | `'Isleniyor...'` | Durum |
| 195 | `'Tamamlandi!'` | Durum |
| 196 | `'Basarisiz'` | Durum |
| 197 | `'Iptal Edildi'` | Durum |
| 224 | `'Cihaz bilgisi yukleniyor...'` | Bos durum |
| 253 | `'... ve ... cihaz daha'` | Tasma metni |
| 337 | `'... cihaza basariyla gonderildi'` | Toast.success |
| 357 | `'... cihazda hata olustu'` | Toast.error |
| 373 | `'Islem iptal edildi'` | Toast.info |
| 382 | `'Kapat'` | Buton |

---

#### 2. `components/NotificationDropdown.js` (~18 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 144 | `'az once'` | Zaman formati |
| 146 | `'dk once'` | Zaman formati |
| 148 | `'saat once'` | Zaman formati |
| 150 | `'dun'` | Zaman formati |
| 152 | `'gun once'` | Zaman formati |
| 210 | `'Bildirim bulunmuyor'` | Bos durum |
| 231 | `'Bildirimler'` | Buton title |
| 237 | `'Bildirimler'` | Dropdown basligi |
| 240 | `'Tumunu Okundu Isaretle'` | Buton |
| 250 | `'Tumunu Gor'` | Link |
| 372 | `'Tur'` | Detay etiketi |
| 376 | `'Durum'` | Detay etiketi |
| 379 | `'Okundu'` | Badge |
| 380 | `'Yeni'` | Badge |
| 390 | `'Detaylari Gor'` | Link |
| 398 | `'Bildirim Detayi'` | Modal basligi |
| 404 | `'Kapat'` | Buton |
| 427-431 | `'Bilgi','Basari','Uyari','Hata','Sistem'` | Tur etiketleri |

---

#### 3. `core/Api.js` (~13 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 206 | `'Lisans hatasi'` | Hata mesaji |
| 234 | `'Baglanti hatasi. Internet baglantinizi kontrol edin.'` | Ag hatasi |
| 297 | `'Oturum sureniz doldu. Lutfen tekrar giris yapin.'` | Session expired |
| 302 | `'Oturum Sonlandi'` | Baslik |
| 425 | `'Cok Fazla Istek'` | Rate limit baslik |
| 428 | `'Cok fazla giris denemesi yaptiniz...'` | Rate limit mesaj |
| 455 | `'Lisans Hatasi'` | Baslik |
| 461 | `'Lisans Suresi Doldu'` | Mesaj |
| 465 | `'Lisans Iptal Edildi'` | Mesaj |
| 469 | `'Lisans Askiya Alindi'` | Mesaj |
| 473 | `'Lisans Bulunamadi'` | Mesaj |
| 502 | `'Lisans yenilemek icin sistem yoneticinize basvurun.'` | Mesaj |

**Not:** Cogu i18n fallback olarak kullaniliyor (`this.app?.i18n?.t() || 'hardcoded'`), ancak i18n yuklenmeden once calistiginda hardcoded metin gorunur.

---

#### 4. `pages/devices/NetworkConfigModal.js` (~33 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 33 | `'Bluetooth Gerekli'` | Uyari basligi |
| 34 | `'Bu islem cihaza Bluetooth ile baglanarak...'` | Aciklama |
| 39 | `'Yapilandirma Modu'` | Form etiketi |
| 41 | `'Sabit IP'` | Select option |
| 42 | `'DHCP (Otomatik)'` | Select option |
| 43 | `'WiFi Degistir'` | Select option |
| 50 | `'IP Adresi'` | Form etiketi |
| 68 | `'DHCP Moduna Gecilecek'` | Baslik |
| 77 | `'WiFi Agi (SSID)'` | Form etiketi |
| 81 | `'WiFi Sifresi'` | Form etiketi |
| 87 | `'Dikkat!'` | Uyari |
| 95 | `'Admin Sifresi (Istege Bagli)'` | Form etiketi |
| 103 | `'Network Yapilandirmasi - ${device.name}'` | Modal basligi |
| 106 | `'Uygula'` | Buton |
| 107 | `'Iptal'` | Buton |
| 168 | `'IP adresi ve gateway gereklidir'` | Toast.error |
| 174 | `'Gecersiz IP adresi formati'` | Toast.error |
| 190 | `'WiFi agi ve sifre gereklidir'` | Toast.error |
| 199 | `'Bluetooth komutu hazirlaniyor...'` | Toast.info |
| 223 | `'Cihaza Bluetooth ile baglaniiliyor...'` | Toast.info |
| 233 | `'Yapilandirma gonderiliyor...'` | Toast.info |
| 241 | `'Yapilandirma basariyla gonderildi!'` | Toast.success |
| 247 | `'Yapilandirma Tamamlandi'` | Modal basligi |
| 269 | `'DHCP Modu Etkin'` | Modal basligi |
| 284 | `'Cihaz yeni WiFi agina baglaniyor...'` | Toast.info |
| 298 | `'Yeni IP kontrol ediliyor...'` | Toast.info |
| 307 | `'Cihaz erisimde!'` | Toast.success |
| 319 | `'Cihaz bulunamadi. Manuel kontrol edin.'` | Toast.warning |

---

#### 5. `pages/settings/IntegrationSettings.js` (~24 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 1077 | `'Gecersiz entegrasyon tipi'` | Toast.error |
| 1193 | `'API anahtari panoya kopyalandi'` | Toast.success |
| 1201 | `'Yeni API anahtari olusturuldu'` | Toast.info |
| 1349 | `'... depo -> sube eslestirildi'` | Toast.success |
| 1625 | `'TAMSOFT Ayarlari'` | HTML basligi |
| 1628 | `'Varsayilan Depo:'` | HTML icerik |
| 1632 | `'Son Sync:'` / `'Hic yapilmadi'` | HTML icerik |
| 1646 | `'JSON Parse:'` / `'Basarili'` / `'Basarisiz'` | Debug bilgi |
| 1648 | `'Array mi:'` / `'Evet'` / `'Hayir'` | Debug bilgi |
| 1649 | `'Eleman Sayisi:'` | Debug bilgi |
| 1653 | `'Ilk 10 Key:'` | Debug bilgi |
| 1663 | `'Cift JSON Tespit Edildi!'` | Uyari |
| 1670 | `'Ham Yanit (Ilk 500 karakter):'` | Debug bilgi |
| 1676 | `'Ilk Oge:'` | Debug bilgi |
| 1700 | `'Ilk Oge (unwrap sonrasi):'` | Debug bilgi |
| 1715 | `'Depo Sayisi:'` | Debug bilgi |
| 1744 | `'Debug hatasi: '` | Hata mesaji |

---

#### 6. `pages/templates/EditorWrapper.js` (~12 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 2225 | `'Lutfen barkod degeri girin'` | Toast.warning |
| 2347 | `'Kontrol hanesi hatali olabilir'` | Uyari |
| 2382 | `'Algilanan tur: ...'` | HTML ipucu |
| 3114 | `'Sablon adi gereklidir'` | Toast.error |
| 3120 | `'Sablon adi en fazla 255 karakter olabilir'` | Toast.error |
| 3206 | `'Sablon kaydedildi'` | Toast.success |
| 3210 | `'Kaydetme sirasinda hata olustu'` | Toast.error |
| 3406 | `'Genislik'` | Placeholder |
| 3408 | `'Yukseklik'` | Placeholder |
| 3780 | `'Sablon adi gereklidir'` | Toast.error |
| 3789 | `'Sablon adi en fazla 255 karakter'` | Toast.error |
| 3904 | `'Medya eklenirken hata olustu'` | Toast.error |

---

#### 7. `pages/products/ProductImport.js` (~8 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 801 | `'Lutfen bir dosya secin'` | Toast.error |
| 834 | `'... satir tespit edildi'` | Toast.success |
| 845 | `'Lutfen zorunlu alanlari eslestirin (SKU, Urun Adi, Fiyat)'` | Toast.error |
| 906 | `'Alanlar otomatik eslestirildi'` | Toast.success |
| 914 | `'Eslestirmeler temizlendi'` | Toast.info |
| 1077 | `'... urun aktarildi, ... hata olustu'` | Toast.warning |
| 1079 | `'... urun basariyla aktarildi'` | Toast.success |
| 1096 | `'Import basarisiz: '` | Hata mesaji |

---

#### 8. `app.js` (~6 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 181 | `'Uygulama baslatilirken bir hata olustu'` | Toast.error |
| 317 | `'Sayfa yuklenirken bir hata olustu'` | showError |
| 367 | `'Sayfa yuklenirken bir hata olustu'` | showError |
| 397 | `'Bu sayfaya erisim yetkiniz bulunmuyor'` | Toast.error |
| 427 | `'Bir Hata Olustu'` | Hata ekrani basligi |
| 430 | `'Sayfayi Yenile'` | Buton |

---

### ORTA ONCELIK

---

#### 9. `pages/devices/DeviceList.js` (~10 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 1367 | `'IP adresi formati gecersiz'` | Toast.error |
| 1375 | `'Bilinmeyen cihaz'` | Fallback isim |
| 1376 | `'Bu IP adresi zaten kullanimda'` | Uyari |
| 1558 | `'Gecersiz cihaz verisi'` | Toast.error |
| 1564 | `'Cihazi Sil'` | Modal basligi |
| 1565 | `'... cihazini silmek istediginize emin misiniz?'` | Onay mesaji |
| 1567 | `'Sil'` | Buton |
| 1568 | `'Iptal'` | Buton |
| 1572 | `'Cihaz silindi'` | Toast.success |
| 1576 | `'Silme islemi basarisiz'` | Hata mesaji |

---

#### 10. `pages/devices/list/BluetoothWizard.js` (~6 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 542 | `'Ag listesi alinamadi...'` | Toast.warning |
| 546 | `'WiFi agi taranamadi...'` | Toast.warning |
| 1094 | `'WiFi adi gerekli'` | Toast.error |
| 1117 | `'Statik IP icin IP adresi ve gateway gereklidir'` | Toast.error |
| 1122 | `'IP/Gateway/Netmask formati gecersiz'` | Toast.error |
| 1444 | `'IP adresi formati gecersiz'` | Toast.error |

---

#### 11. `pages/errors/NotFound.js` (~4 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 21 | `'Sayfa Bulunamadi'` | Baslik |
| 24 | `'Aradiginiz sayfa mevcut degil veya tasinmis olabilir.'` | Aciklama |
| 29 | `'Ana Sayfa'` | Buton |
| 33 | `'Geri Don'` | Buton |

---

#### 12. `pages/reports/DashboardAnalytics.js` (~5 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 200 | `'Toplu Fiyat Guncellemesi'` | Modal basligi |
| 212 | `'Urun Ice Aktarma'` | Modal basligi |
| 218 | `'Baglanti Uyarisi'` | Modal basligi |
| 486 | `'Rapor basariyla indirildi'` | Toast.success |
| 493 | `'Aktivite kayitlari disa aktariliyor...'` | Toast.info |

---

#### 13. `pages/admin/BranchManagement.js` (~5 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 262 | `'Subeler yuklenemedi'` | Toast.error |
| 542 | `'Kaydetme hatasi'` | Toast.error |
| 553 | `'Silme Onayi'` | Modal basligi |
| 554 | `'... silmek istediginize emin misiniz?'` | Onay mesaji |
| 571 | `'Silme hatasi'` | Toast.error |

---

#### 14. `pages/settings/GatewaySettings.js` (~3 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 395 | `'Firma ayari yetkisi bulunamadi...'` | Toast.warning |
| 960 | `'Once bir gateway eklemelisiniz'` | Toast.warning |
| 1023 | `'Gateway secin'` | Toast.error |

---

#### 15. `pages/products/ProductList.js` (~4 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 1034 | `'Sube: <strong>...</strong>'` | HTML icerik |
| 3655 | `'Yazdirma onizlemesi acildi'` | Toast.success |
| 3733 | `'Popup engellendi. Lutfen popup izni verin.'` | Toast.error |
| 4061 | `'Yazdirma onizlemesi acildi'` | Toast.success |

---

#### 16. `pages/products/ProductForm.js` (~2 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 642 | `'Sube: <strong>...</strong>'` | HTML icerik |
| 1289 | `'Sube: <strong>...</strong>'` | HTML icerik |

---

#### 17. `pages/products/ProductDetail.js` (~4 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 1034 | `'Sube: <strong>...</strong>'` | HTML icerik |
| 1035 | `'Sube verisi'` / `'Master verisi'` | Badge metni |
| 1439 | `'Lutfen bir urun secin'` | Toast.error |

---

### DUSUK ONCELIK

---

#### 18. `core/CacheManager.js` (~4 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 201 | `'Onbellegi Temizle (Development)'` | Buton title |
| 242 | `'Onbellek yok'` | Bos durum |
| 246 | `'Cache Bilgisi'` | Modal basligi |
| 272 | `'Tumunu Temizle'` | Buton |

---

#### 19. `components/Modal.js` (~2 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 37 | `'Onayla'` | Varsayilan onay butonu |
| 38 | `'Iptal'` | Varsayilan iptal butonu |

---

#### 20. `components/RenderWorker.js` (~4 adet)

| Satir | Hardcoded Metin | Tur |
|-------|----------------|-----|
| 353 | `'render edildi'` | Toast.success |
| 355 | `'render hatasi'` | Toast.error |
| 360 | `'Render Tamamlandi'` | Bildirim basligi |
| 362-363 | Bildirim govde metinleri | Bildirim |

---

#### 21. Diger Dosyalar (az sayida)

| Dosya | Adet | Ornek |
|-------|------|-------|
| `pages/media/MediaLibrary.js` | 2 | `'Ortak Kutuphanei Tara'` |
| `pages/devices/list/BulkActions.js` | 2 | `'Cihaz'` fallback |
| `pages/devices/list/DeviceControl.js` | 3 | `'Cihaz bilgileri yukleniyor...'` |
| `pages/devices/list/FirmwareUpdate.js` | 1 | `'Bu islem geri alinamaz!'` |
| `pages/admin/UserManagement.js` | 1 | `'Sube Erisimi'` |
| `pages/signage/PlaylistList.js` | 1 | Hardcoded fallback metin |
| `components/DataTable.js` | 1 | `'Disa aktarma sirasinda hata olustu'` |
| `pages/products/form/HalKunyeSection.js` | 2 | Debug/hata mesajlari |

---

## BOLUM 3: Kategori Bazli Dagalim

| Kategori | Adet | Aciklama |
|----------|------|----------|
| Toast mesajlari (error/success/warning/info) | ~70 | En yogun alan |
| Modal baslik ve icerik | ~25 | Onay dialoglari, bilgi modallari |
| Form etiketleri ve placeholder'lar | ~20 | Input alanlari, select option'lari |
| HTML icerik (badge, etiket, bilgi) | ~20 | Template literal icerisindeki metinler |
| Durum ve zaman metinleri | ~15 | Status label, relative time |
| Buton metinleri | ~15 | Kaydet, Iptal, Sil, Kapat, Uygula |
| Hata mesajlari ve fallback'ler | ~15 | Exception, error fallback |
| Debug/gelistirici metinleri | ~10 | Console, debug bilgisi |

---

## BOLUM 4: Oneriler

### Hizli Kazanimlar (Quick Wins)

1. **Modal.js varsayilan buton metinleri** -> `common.json` key'lerine bagla
2. **NotFound.js** -> Tamamen i18n'e tasimali (4 string)
3. **app.js hata mesajlari** -> `common.json` messages bolumune ekle

### Orta Vadeli

4. **RenderProgressModal.js** -> Yeni `render` bolumu icin key'ler ekle
5. **NotificationDropdown.js** -> `notifications` bolumune key'ler ekle
6. **Api.js fallback mesajlari** -> Cogu zaten fallback, i18n yuklenmeden once gosteriliyor. common.json'daki mevcut key'lerle eslestirilmeli.

### Uzun Vadeli

7. **NetworkConfigModal.js** -> Tamamen yeni `devices.networkConfig` bolumu olustur (33 string)
8. **IntegrationSettings.js** -> Debug paneli icin `settings.integration.debug` bolumu (24 string)
9. **BluetoothWizard.js** -> `devices.bluetooth` bolumu (6 string)
10. **ProductImport.js** -> `products.import` bolumu genislet (8 string)

### EN Dil Dosyasi Eksigi

- `locales/en/pages/notifications.json` olusturulmali (TR'de mevcut, EN'de eksik)

---

## BOLUM 5: Uyari

- `IntegrationSettings.js`'deki debug panel metinleri (TAMSOFT debug, raw response) teknik/gelistirici icerigi oldugundan dusuk oncelikli
- `Api.js`'deki fallback metinler, i18n sistemi yuklenmeden once cagrilabilecegi icin tamamen kaldirilmamali, ancak i18n yuklendiginde dogru key kullanilmali
- Bazi dosyalarda `this.__('key') || 'Hardcoded'` patterni kullanilmis - bu key eksikliginden kaynaklanabilir
