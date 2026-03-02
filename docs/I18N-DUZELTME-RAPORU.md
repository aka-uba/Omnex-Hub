# i18n Düzeltme Raporu

**Tarih:** 2026-01-27
**Kapsam:** Türkçe (tr) dil dosyaları
**Durum:** ✅ Tamamlandı

---

## Özet

Türkçe dil dosyalarında eksik olan namespace'ler ve çeviri anahtarları eklendi. Tüm dosyalar JSON formatı açısından doğrulandı.

---

## Yapılan Değişiklikler

### 1. common.json

**Eklenen Namespace'ler:**

| Namespace | Anahtar Sayısı | Açıklama |
|-----------|----------------|----------|
| `themeConfigurator` | 17 | Tema yapılandırıcı paneli |
| `layout` | 3 (header, sidebar, footer) | Sayfa düzeni bileşenleri |
| `render` | 22 (+ modal, worker) | Render işlemi mesajları |
| `dataTable` | 25 | Veri tablosu bileşeni |

**Eklenen Anahtarlar:**

```json
"themeConfigurator": {
    "title": "Tema Yapılandırıcı",
    "colorMode": "Renk Modu",
    "light": "Aydınlık",
    "dark": "Karanlık",
    "system": "Sistem",
    "primaryColor": "Ana Renk",
    "sidebarStyle": "Kenar Çubuğu Stili",
    "headerStyle": "Başlık Stili",
    "sidebarCollapsed": "Kenar Çubuğu Daralt",
    "compactMode": "Kompakt Mod",
    "borderRadius": "Köşe Yuvarlaklığı",
    "fontSize": "Yazı Boyutu",
    "reset": "Varsayılana Sıfırla",
    "apply": "Uygula",
    "saved": "Tema ayarları kaydedildi",
    "resetConfirm": "Tema ayarlarını varsayılana sıfırlamak istiyor musunuz?"
}

"layout": {
    "header": { /* 14 anahtar */ },
    "sidebar": { /* 7 anahtar */ },
    "footer": { /* 4 anahtar */ }
}

"render": {
    /* 18 temel anahtar */
    "modal": { /* 12 anahtar */ },
    "worker": { /* 8 anahtar */ }
}

"dataTable": {
    /* 25 anahtar: noData, loading, search, pagination, selection vb. */
}
```

---

### 2. products.json

**Eklenen Namespace'ler:**

| Namespace | Anahtar Sayısı | Açıklama |
|-----------|----------------|----------|
| `breadcrumb` | 7 | Sayfa navigasyonu |
| `actions` | 15 | Ürün işlemleri |
| `kunye` | 11 | HAL künye sorgusu |
| `barcode` | 8 | Barkod işlemleri |

**Eklenen Anahtarlar:**

```json
"breadcrumb": {
    "panel": "Panel",
    "products": "Ürünler",
    "new": "Yeni Ürün",
    "edit": "Düzenle",
    "detail": "Detay",
    "import": "İçe Aktar",
    "categories": "Kategoriler"
}

"actions": {
    "add": "Yeni Ürün",
    "edit": "Düzenle",
    "delete": "Sil",
    "duplicate": "Çoğalt",
    "import": "İçe Aktar",
    "export": "Dışa Aktar",
    "print": "Yazdır",
    "sendToDevice": "Cihaza Gönder",
    "assignLabel": "Etiket Ata",
    "removeLabel": "Etiketi Kaldır",
    "refresh": "Yenile",
    "filter": "Filtrele",
    "selectAll": "Tümünü Seç",
    "deselectAll": "Seçimi Kaldır",
    "bulkDelete": "Toplu Sil"
}

"kunye": {
    "title": "HAL Künye Sorgu",
    "query": "Künye Sorgula",
    "querying": "Sorgulanıyor...",
    "success": "Künye bilgisi alındı",
    "failed": "Künye sorgulanamadı",
    "notFound": "Künye bulunamadı",
    "applyData": "Verileri Uygula",
    "fields": { /* 5 anahtar */ },
    "captchaRequired": "CAPTCHA doğrulaması gerekiyor",
    "manualQuery": "Manuel Sorgulama",
    "apiIntegration": "API Entegrasyonu"
}

"barcode": {
    "title": "Barkod",
    "preview": "Barkod Önizleme",
    "type": "Barkod Tipi",
    "value": "Barkod Değeri",
    "invalid": "Geçersiz barkod",
    "weighingBarcode": "Tartı Barkodu",
    "flagCode": "Bayrak Kodu",
    "scaleCode": "Terazi Kodu"
}
```

---

### 3. devices.json

**Eklenen Namespace'ler:**

| Namespace | Anahtar Sayısı | Açıklama |
|-----------|----------------|----------|
| `breadcrumb` | 6 | Sayfa navigasyonu |
| `control` | 11 | Cihaz kontrolü |
| `hanshow` | 11 | Hanshow ESL |

**Eklenen Anahtarlar:**

```json
"breadcrumb": {
    "panel": "Panel",
    "devices": "Cihazlar",
    "groups": "Gruplar",
    "detail": "Detay",
    "new": "Yeni Cihaz",
    "edit": "Düzenle"
}

"control": {
    "title": "Cihaz Kontrolü",
    "ping": "Bağlantı Testi",
    "refresh": "Ekranı Yenile",
    "clearMemory": "Belleği Temizle",
    "reboot": "Yeniden Başlat",
    "deviceInfo": "Cihaz Bilgisi",
    "setBrightness": "Parlaklık Ayarla",
    "checkFile": "Dosya Kontrol",
    "firmwareUpgrade": "Firmware Güncelle",
    "ledFlash": "LED Test",
    "sendContent": "İçerik Gönder"
}

"hanshow": {
    "title": "Hanshow ESL",
    "eslId": "ESL ID",
    "apMac": "Gateway MAC",
    "screenType": "Ekran Tipi",
    "screenSize": "Ekran Boyutu",
    "battery": "Batarya",
    "signal": "Sinyal Gücü",
    "lastUpdate": "Son Güncelleme",
    "sendDesign": "Tasarım Gönder",
    "ledControl": "LED Kontrol",
    "pageSwitch": "Sayfa Değiştir"
}
```

---

### 4. templates.json

**Eklenen Namespace'ler:**

| Namespace | Anahtar Sayısı | Açıklama |
|-----------|----------------|----------|
| `breadcrumb` | 5 | Sayfa navigasyonu |

**Eklenen Anahtarlar:**

```json
"breadcrumb": {
    "panel": "Panel",
    "templates": "Şablonlar",
    "editor": "Editör",
    "new": "Yeni Şablon",
    "edit": "Düzenle"
}
```

---

### 5. media.json

**Düzeltilen Namespace'ler:**

| Namespace | Değişiklik |
|-----------|------------|
| `breadcrumb` | `media` anahtarı eklendi |

**Güncellenmiş İçerik:**

```json
"breadcrumb": {
    "panel": "Panel",
    "media": "Medya Kütüphanesi"
}
```

---

### 6. settings.json

**Eklenen Namespace'ler:**

| Namespace | Anahtar Sayısı | Açıklama |
|-----------|----------------|----------|
| `breadcrumb` | 6 | Sayfa navigasyonu |

**Eklenen Anahtarlar:**

```json
"breadcrumb": {
    "panel": "Panel",
    "settings": "Ayarlar",
    "general": "Genel Ayarlar",
    "users": "Kullanıcı Ayarları",
    "integrations": "Entegrasyonlar",
    "labels": "Etiket Boyutları"
}
```

---

## Değişiklik Gerektirmeyen Dosyalar

| Dosya | Durum | Açıklama |
|-------|-------|----------|
| `queue.json` | ✅ Kapsamlı | 277 satır, tüm gerekli namespace'ler mevcut |
| `admin.json` | ✅ Kapsamlı | 489 satır, tüm gerekli namespace'ler mevcut |

---

## Test Sonuçları

```
=== JSON DOĞRULAMA ===
locales/tr/common.json ............... OK
locales/tr/pages/about.json .......... OK
locales/tr/pages/admin.json .......... OK
locales/tr/pages/auth.json ........... OK
locales/tr/pages/dashboard.json ...... OK
locales/tr/pages/devices.json ........ OK
locales/tr/pages/media.json .......... OK
locales/tr/pages/notifications.json .. OK
locales/tr/pages/payments.json ....... OK
locales/tr/pages/products.json ....... OK
locales/tr/pages/queue.json .......... OK
locales/tr/pages/settings.json ....... OK
locales/tr/pages/signage.json ........ OK
locales/tr/pages/templates.json ...... OK

Toplam: 14 dosya, 14 geçerli, 0 hatalı
```

```
=== NAMESPACE DOĞRULAMA ===
common.json:
  [OK] themeConfigurator (17 anahtar)
  [OK] layout (3 anahtar)
  [OK] render (22 anahtar)
  [OK] dataTable (25 anahtar)

products.json:
  [OK] breadcrumb (7 anahtar)
  [OK] actions (15 anahtar)
  [OK] kunye (11 anahtar)
  [OK] barcode (8 anahtar)

devices.json:
  [OK] breadcrumb (6 anahtar)
  [OK] control (11 anahtar)
  [OK] hanshow (11 anahtar)

templates.json:
  [OK] breadcrumb (5 anahtar)

media.json:
  [OK] breadcrumb (2 anahtar)

settings.json:
  [OK] breadcrumb (6 anahtar)
```

---

## Özet İstatistikler

| Metrik | Değer |
|--------|-------|
| Toplam düzenlenen dosya | 6 |
| Değişiklik gerektirmeyen dosya | 2 |
| Eklenen namespace sayısı | 12 |
| Eklenen anahtar sayısı | ~150 |
| JSON doğrulama | %100 başarılı |

---

## Notlar

1. Tüm Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) doğru şekilde kodlanmıştır.
2. Tüm dosyalar UTF-8 formatındadır.
3. JSON syntax hataları bulunmamaktadır.
4. Breadcrumb yapısı tüm sayfalarda tutarlı hale getirilmiştir.

---

*Bu rapor otomatik olarak oluşturulmuştur.*
