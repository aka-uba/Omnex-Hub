# Encoding Bozulma Raporu V2

**Tarih:** 2026-02-27
**Sorun:** Codex ile yapilan degisikliklerde Turkce karakter encoding bozulmasi (UTF-8 double encoding)
**Onceki Rapor:** ENCODING_BOZULMA_RAPORU.md (2026-02-16)
**Durum:** Tespit edildi, duzeltme yapilacak

---

## Sorun Aciklamasi

Bazi dosyalardaki Turkce yorum satirlarinda ve string literallerinde UTF-8 karakter encoding bozulmasi mevcut.
UTF-8 olarak kaydedilmis Turkce karakterler, Latin-1 (ISO-8859-1) olarak okunup tekrar UTF-8'e
donusturulmus gorunuyor (double encoding / mojibake).

### Bozulma Tablosu

| Dogru | Bozuk | Unicode |
|-------|-------|---------|
| ü | `Ã¼` | U+00FC |
| ö | `Ã¶` | U+00F6 |
| ç | `Ã§` | U+00E7 |
| ı | `Ä±` | U+0131 |
| ş | `ÅŸ` | U+015F |
| ğ | `Äž` / `ÄŸ` | U+011E / U+011F |
| İ | `Ä°` | U+0130 |
| Ç | `Ã‡` | U+00C7 |
| Ü | `Ãœ` | U+00DC |
| Ö | `Ã–` | U+00D6 |
| Ş | `Å` | U+015E |
| â | `Ã¢` | U+00E2 |
| → | `â†'` | U+2192 |

---

## Etkilenen Dosyalar (14 dosya, backup haric)

### 1. api/devices/control.php
**Bozuk satir sayisi:** ~70+
**Tur:** Yorum + string literal (kullaniciya gosterilen mesajlar)
**Ornek satirlar:**
- Satir 25: `// FormData (multipart) ile gelen action kontrolÃ¼` → `kontrolü`
- Satir 43: `Response::badRequest('GeÃ§ersiz iÅŸlem: '` → `Geçersiz işlem`
- Satir 60: `Response::notFound('Cihaz bulunamadÄ±')` → `bulunamadı`
- Satir 304: `'Cihazda IP adresi yapÄ±landÄ±rÄ±lmamÄ±ÅŸ'` → `yapılandırılmamış`
- Satir 356: `'LED sinyal gÃ¶nderildi, iÅŸleniyor...'` → `gönderildi, işleniyor`
- Satir 385: `'Bu ESL\'e henÃ¼z Ã¼rÃ¼n/ÅŸablon atanmamÄ±ÅŸ'` → `henüz ürün/şablon atanmamış`
- Satir 691-706: Gateway komut mesajlari
- Satir 723-764: PavoDisplay kontrol mesajlari
- Satir 816-821: Parlaklik ayar mesajlari
- Satir 851-909: Firmware guncelleme mesajlari
- Satir 931-1052: Varsayilan gorsel mesajlari

### 2. workers/RenderQueueWorker.php
**Bozuk satir sayisi:** 2
**Tur:** Yorum
- Satir 334: `// Cache key oluÅŸtur` → `oluştur`
- Satir 335: `// Responsive modda: cihaz boyutu bazlÄ± cache` → `bazlı`

### 3. api/gateway/heartbeat.php
**Bozuk satir sayisi:** 2
**Tur:** Yorum
- Satir 248: `// Gateway'in taramasÄ± gereken cihazlarÄ± dÃ¶ndÃ¼r` → `taraması gereken cihazları döndür`
- Satir 261: `// CihazlarÄ± gateway format'Ä±na dÃ¶nÃ¼ÅŸtÃ¼r` → `Cihazları ... dönüştür`

### 4. api/gateway/command-result.php
**Bozuk satir sayisi:** 4
**Tur:** String literal + yorum
- Satir 26: `'GeÃ§ersiz status. GeÃ§erli deÄŸerler:'` → `Geçersiz status. Geçerli değerler`
- Satir 36: `'Komut bulunamadÄ± veya bu gateway\'e ait deÄŸil'` → `bulunamadı ... değil`
- Satir 39: `// Komutu gÃ¼ncelle` → `güncelle`
- Satir 113: `// EÄŸer cihaz komutu ise` → `Eğer`

### 5. api/esl/mqtt/register.php
**Bozuk satir sayisi:** ~15
**Tur:** Yorum + docblock + string literal
- Satir 6: `* PavoDisplay cihazÄ± MQTT modunda baÅŸlatÄ±ldÄ±ÄŸÄ±nda Ã§aÄŸrÄ±lÄ±r` → `çağrılır`
- Satir 8-9: `dÃ¶ner`, `gerekir`
- Satir 15: `// Ä°mza` → `İmza`
- Satir 83: `// MqttBrokerService yÃ¼kle` → `yükle`
- Satir 117: `'GeÃ§ersiz AppID veya MQTT ayarÄ± bulunamadÄ±'` → `Geçersiz AppID veya MQTT ayarı bulunamadı`
- Satir 126-215: Kayit islem yorumlari

### 6. api/devices/send-command.php
**Bozuk satir sayisi:** 1
**Tur:** String literal
- Satir 89: `'Komut cihaza gÃ¶nderildi'` → `gönderildi`

### 7. api/devices/assign-playlist.php
**Bozuk satir sayisi:** 1
**Tur:** String literal
- Satir 67: `'Bu playlist boÅŸ! Cihazda iÃ§erik gÃ¶rÃ¼ntÃ¼lenmeyecek'` → `boş! Cihazda içerik görüntülenmeyecek`

### 8. api/categories/delete.php
**Bozuk satir sayisi:** 2
**Tur:** String literal
- Satir 20: `'Kategori bulunamadÄ±'` → `bulunamadı`
- Satir 25: `'Bu kategoriye eriÅŸim yetkiniz yok'` → `erişim`

### 9. api/auth/reset-password.php
**Bozuk satir sayisi:** 5
**Tur:** String literal
- Satir 13: `'Token ve ÅŸifre gerekli'` → `şifre`
- Satir 17: `'Åifreler eÅŸleÅŸmiyor'` → `Şifreler eşleşmiyor`
- Satir 21: `'Åifre en az 8 karakter olmalÄ±'` → `Şifre ... olmalı`
- Satir 33: `'GeÃ§ersiz veya sÃ¼resi dolmuÅŸ token'` → `Geçersiz veya süresi dolmuş`
- Satir 42: `'Åifreniz baÅŸarÄ±yla deÄŸiÅŸtirildi'` → `Şifreniz başarıyla değiştirildi`

### 10. services/MqttBrokerService.php
**Bozuk satir sayisi:** ~60+
**Tur:** Docblock + yorum + string literal
- Tum dosya boyunca Turkce docblock ve yorum satirlari bozuk
- Satir 5-10: Sinif docblock
- Satir 32-40: Metod docblock'lari
- Satir 60-95: sign dogrulama yorumlari
- Satir 146-148: Legacy auth yorumlari
- Satir 169-299: MQTT ayar/topic/broker metodlari
- Satir 639-921: HTTP PULL, asset yorumlari
- Satir 1354-1480: Komut kuyrugu metodlari

### 11. services/RenderCacheService.php
**Bozuk satir sayisi:** ~100+
**Tur:** Docblock + yorum + string literal
- Tum dosya boyunca agir encoding bozulmasi
- Satir 5-6: Sinif aciklamasi
- Satir 15-53: Oncelik, urun guncelleme yorumlari
- Satir 94-165: Toplu islem docblock'lari
- Satir 263-902: Cache yonetim metod yorumlari
- Satir 984-1050: Istatistik ve temizleme

### 12. services/StorageService.php
**Bozuk satir sayisi:** ~70+
**Tur:** Docblock + yorum + string literal
- Tum dosya boyunca encoding bozulmasi
- Satir 3-6: Sinif docblock
- Satir 16-80: Kota kontrol docblock'lari
- Satir 111-219: Kullanim hesaplama, limit yorumlari
- Satir 265-444: Bildirim ve dizin yapisalma yorumlari

### 13. services/BranchService.php
**Bozuk satir sayisi:** ~50+
**Tur:** Docblock + yorum + string literal
- Satir 3-6: Sinif docblock
- Satir 17-122: Erisim kontrol metod yorumlari
- Satir 166-354: Sube CRUD metod yorumlari

### 14. services/TamsoftGateway.php
**Bozuk satir sayisi:** ~120+
**Tur:** Docblock + yorum + string literal
- Tum dosya boyunca agir encoding bozulmasi
- Satir 5-59: Sinif docblock ve ayar yorumlari
- Satir 98-164: API yardimci metod yorumlari
- Satir 231-395: API istek/baglanti yorumlari
- Satir 411-565: Urun donusturme yorumlari
- Satir 573-934: Senkronizasyon yorumlari
- Satir 1021-1259: Depo-sube eslestirme yorumlari

---

## Etkilenen Dokumantasyon Dosyalari

### 15. docs/MQTT_INTEGRATION.md
**Bozuk satir sayisi:** ~15
- Satir 362, 408, 449, 745, 1192, 1392, 1485, 1676, 1684-1687

### 16. docs/kalaniş.md
**Bozuk satir sayisi:** ~10
- Satir 79, 100, 135, 151, 179-180, 191, 225

---

## Haric Tutulan Dosyalar

| Dosya | Sebep |
|-------|-------|
| `public/assets/vendor/xlsx/xlsx.full.min.js` | 3. parti kutuphane, dokunulmamali |
| `backup/**` | Yedek dosyalar, orijinal durumda korunmali |
| `docs/ENCODING_BOZULMA_RAPORU.md` | Onceki rapor dosyasi |

---

## Toplam Etki

| Metrik | Deger |
|--------|-------|
| Etkilenen dosya sayisi | 16 (backup haric) |
| Etkilenen PHP dosyasi | 12 |
| Etkilenen MD dosyasi | 2 |
| Etkilenen JS dosyasi | 0 (vendor haric) |
| Tahmini bozuk satir | ~520+ |
| Kullaniciya gosterilen bozuk mesaj | ~50+ (Response string'leri) |

---

## Duzeltme Plani

Her dosya icin:
1. Dosyanin mevcut encoding'ini tespit et
2. Bozuk UTF-8 double-encoded bytelari dogru UTF-8 karakterlere cevir
3. Dosya kodunu degistirmeden sadece encoding'i duzelt
4. Her dosyayi kaydettikten sonra dogru gorunumu dogrula

### Duzeltme Mapping

```
Ã¼ → ü     Ãœ → Ü     Ã¶ → ö     Ã– → Ö
Ã§ → ç     Ã‡ → Ç     ÅŸ → ş     Å → Ş
Ä± → ı     Ä° → İ     ÄŸ → ğ     Äž → Ğ
Ã¢ → â     â†' → →    â€" → —     â€˜ → '
â€™ → '     â€œ → "     â€ → "
```
