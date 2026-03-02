# Encoding Bozulma Raporu

**Tarih:** 2026-02-16
**Sorun:** Codex ile yapilan degisikliklerde Turkce karakter encoding bozulmasi (UTF-8 double encoding)
**Durum:** Tespit edildi, duzeltme bekleniyor

---

## Sorun Aciklamasi

Bazi dosyalardaki Turkce yorum satirlarinda UTF-8 karakter encoding bozulmasi mevcut.
UTF-8 olarak kaydedilmis Turkce karakterler, Latin-1 (ISO-8859-1) olarak okunup tekrar UTF-8'e
donusturulmus gorunuyor (double encoding).

### Bozulma Ornekleri

| Dogru Karakter | Bozuk Gorunum |
|----------------|---------------|
| i (buyuk I nokta) | `Ä°` |
| s (cedilla) | `ÅŸ` |
| c (cedilla) | `Ã§` |
| i (noktasiz) | `Ä±` |
| u (umlaut) | `Ã¼` |
| o (umlaut) | `Ã¶` |
| G (breve) | `Äž` |
| C (cedilla) | `Ã‡` |
| U (umlaut) | `Ãœ` |
| O (umlaut) | `Ã–` |

**Ornek bozuk satir:**
```
// Ä°ÅŸlem Ã§alÄ±ÅŸÄ±yor mu?
```
**Olmasi gereken:**
```
// Islem calisiyor mu?
```

---

## Etkilenen Dosyalar

### 1. `api/index.php`
- **Etkilenen satir sayisi:** ~24 satir
- **Icerik turu:** PHP yorum satirlari (route aciklamalari)
- **Ornek bozuk satirlar:**
  - Satir 318: `// Template render - Ã¼rÃ¼n verileriyle ÅŸablonu render et`
  - Satir 323: `// Template fork - sistem ÅŸablonunu firmaya kopyala`
  - Satir 330: `// Web Template Routes (VvvebJs HTML ÅablonlarÄ±)`
  - Satir 458: `// Alias: /command -> /send-command (DeviceDetail.js uyumluluÄŸu iÃ§in)`
  - Satir 1392: `// Toplu gÃ¶nderim Ã¶ncesi cache durumu kontrolÃ¼`
  - Satir 1495: `// Branch Routes (v2.0.18 - Åube/BÃ¶lge Sistemi)`
  - Satir 1576: `// HAL KÃ¼nye Sorgulama Routes`
  - Satir 1627: `// Sistem durumu - kategori, Ã¼rÃ¼n, Ã¼retim tipi sayÄ±larÄ±`

---

### 2. `api/render-queue/process.php`
- **Etkilenen satir sayisi:** ~190+ satir (dosyanin buyuk cogunlugu)
- **Icerik turu:** PHP yorum satirlari ve string literaller
- **En cok etkilenen dosya**
- **Ornek bozuk satirlar:**
  - Satir 3: `* Render Queue API - Ä°ÅŸleri Ä°ÅŸle`
  - Satir 7: `* Bekleyen iÅŸleri iÅŸler. Frontend'den periyodik olarak Ã§aÄŸrÄ±labilir.`
  - Satir 142: `// PavoDisplayGateway ile gÃ¶nder (gateway ayarÄ±ndan baÄŸÄ±msÄ±z)`
  - Satir 175: `throw new Exception('Cihaz bulunamadÄ± veya IP adresi yok');`
  - Satir 400: `'message' => 'SimÃ¼le edildi (desteklenmeyen cihaz tipi)'`
  - Satir 647: `* PavoDisplay iÃ§in iÅŸlem (Video + Image destekli)`
  - Satir 875: `// 2a. PRE-RENDERED IMAGE (Frontend canvas render - EN KALÄ°TELÄ°)`
  - Satir 1053: `'error' => 'GÃ¶rsel kaynaÄŸÄ± bulunamadÄ±...'`
  - Satir 1397: `'ItemName' => $product['name'] ?? 'ÃœrÃ¼n'`
- **DIKKAT:** Bu dosyada string literaller de bozuk (throw Exception, Response mesajlari).
  Sadece yorum degil, kullaniciya gosterilen hata mesajlari da etkilenmis.

---

### 3. `api/playlists/index.php`
- **Etkilenen satir sayisi:** ~3 satir
- **Icerik turu:** PHP yorum satirlari
- **Ornek bozuk satirlar:**
  - Satir 44: `// TÃ¼m atanan cihazlarÄ± getir`
  - Satir 58: `// Tek cihaz - direkt bilgileri gÃ¶ster`
  - Satir 64: `// Ã‡oklu cihaz - listeyi de gÃ¶nder (modal iÃ§in)`

---

### 4. `public/player/assets/js/player.js`
- **Etkilenen satir sayisi:** ~87+ satir
- **Icerik turu:** JavaScript yorum satirlari ve UI string literaller
- **Ornek bozuk satirlar:**
  - Satir 241: `this.showError('BaÅŸlatma hatasÄ±: ' + ...)`
  - Satir 314: `APK Ä°ndir (Android)`
  - Satir 325: `PWA Olarak YÃ¼kle`
  - Satir 336: `1. TarayÄ±cÄ± menÃ¼sÃ¼nÃ¼ aÃ§Ä±n`
  - Satir 417: `Ã‡evrimdÄ±ÅŸÄ± Ã§alÄ±ÅŸma`
  - Satir 1618: `this.showRegistrationScreen(null, 'OluÅŸturuluyor...');`
  - Satir 1882: `this.setLoadingMessage('Ä°Ã§erik yÃ¼kleniyor...');`
  - Satir 2062: `Oynatmak iÃ§in Dokunun`
  - Satir 3569: `this.showNotification('YayÄ±n BaÅŸlatÄ±ldÄ±', ...)`
- **DIKKAT:** Kullaniciya gorunen UI metinleri (PWA kurulum ekrani, hata mesajlari,
  bildirimler) bozuk. Player kullanicilari bozuk Turkce gorecektir.

---

### 5. `gateway/gateway.php`
- **Etkilenen satir sayisi:** ~273+ satir (dosyanin buyuk cogunlugu)
- **Icerik turu:** PHP yorum satirlari, CLI ciktilari, string literaller
- **Ornek bozuk satirlar:**
  - Satir 5-13: Dosya basligi yorum blogu tamamen bozuk
  - Satir 64: `* YapÄ±landÄ±rmayÄ± yÃ¼kle`
  - Satir 177: `* IP adresinin izin verilen subnet'lerde olup olmadÄ±ÄŸÄ±nÄ± kontrol et`
  - Satir 340: `"   Omnex Local Gateway KayÄ±t SihirbazÄ±\n"`
  - Satir 440: `echo "âœ" Gateway baÅŸarÄ±yla kaydedildi!\n";`
  - Satir 2199: `echo "Hata: Gateway yapÄ±landÄ±rÄ±lmamÄ±ÅŸ!\n";`
  - Satir 2852-2882: Help/kullanim metni tamamen bozuk
- **DIKKAT:** CLI ciktilari (echo satirlari) bozuk. Gateway kullanicilari terminalde
  bozuk Turkce gorecektir.

---

### 6. `local-gateway-manager/resources/gateway/gateway.php`
- **Etkilenen satir sayisi:** ~292+ satir
- **Icerik turu:** `gateway/gateway.php` dosyasinin kopyasi (Electron paket icerigi)
- **Durum:** `gateway/gateway.php` ile ayni bozulma mevcut. Ana dosya duzeltildiginde
  bu kopyanin da guncellenmesi gerekir.

---

## Ozet Tablo

| Dosya | Bozuk Satir (yaklasik) | Oncelik | Kullanici Etkisi |
|-------|------------------------|---------|------------------|
| `api/render-queue/process.php` | ~190 | **YUKSEK** | Hata mesajlari bozuk gorunur |
| `gateway/gateway.php` | ~273 | **YUKSEK** | CLI ciktilari bozuk gorunur |
| `local-gateway-manager/resources/gateway/gateway.php` | ~292 | ORTA | gateway.php kopyasi |
| `public/player/assets/js/player.js` | ~87 | **YUKSEK** | PWA Player UI bozuk gorunur |
| `api/index.php` | ~24 | DUSUK | Sadece yorum satirlari |
| `api/playlists/index.php` | ~3 | DUSUK | Sadece yorum satirlari |

**Toplam etkilenen dosya:** 6 (backup dizini haric)
**Toplam bozuk satir (yaklasik):** ~869

---

## Onerilen Duzeltme Yontemi

1. Her dosyanin encoding'ini kontrol et (`file --mime-encoding <dosya>`)
2. Bozuk dosyalari dogru UTF-8 encoding ile yeniden kaydet
3. Alternatif: `iconv` veya Python ile double-encoded UTF-8'i duzelt:
   ```python
   # Python ile duzeltme ornegi
   with open('dosya.php', 'rb') as f:
       content = f.read()
   # Double-encoded UTF-8'i duzelt
   fixed = content.decode('utf-8').encode('latin-1').decode('utf-8')
   with open('dosya.php', 'w', encoding='utf-8') as f:
       f.write(fixed)
   ```
4. `local-gateway-manager/resources/gateway/gateway.php` dosyasini
   `gateway/gateway.php` duzeltildikten sonra kopyala

---

## Notlar

- Bozulma sadece Turkce karakter iceren yorum satirlari ve string literallerde gorunuyor
- Kod mantigi (degisken adlari, fonksiyon adlari, syntax) etkilenmemis
- `core/`, `middleware/`, `services/`, `public/assets/js/` (player haric) dizinleri temiz
- `backup/` dizinindeki dosyalar bu rapora dahil edilmemistir
- Codex'in dosyalari kaydederken encoding donusumu yaptigi dusunulmektedir
