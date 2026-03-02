# Bluetooth Sync Yakalama Notları

## 🔍 Sorun

Telefondan Bluetooth ile sync yapılıyor ama script değişiklikleri yakalayamıyor.

## 💡 Olası Nedenler

1. **Çok Hızlı Değişiklikler:**
   - Bluetooth sync çok hızlı olabilir
   - Dosya değişiklikleri kontrol aralığında kaçırılıyor olabilir

2. **Farklı Dosya İsimleri:**
   - Bluetooth sync farklı dosya isimleri kullanıyor olabilir
   - APK assets'lerinde olmayan dosyalar yükleniyor olabilir

3. **Farklı Endpoint:**
   - Bluetooth sync farklı bir HTTP endpoint kullanıyor olabilir
   - WiFi yerine Bluetooth üzerinden direkt iletişim olabilir

4. **Dosya Yolu Farklılığı:**
   - Dosyalar farklı bir klasöre yükleniyor olabilir
   - `files/task/` yerine başka bir yol kullanılıyor olabilir

## 🚀 Çözümler

### 1. Ultra Fast Sniffer
**Script:** `ultra_fast_sniffer.php`

**Özellikler:**
- Her 50ms'de bir kontrol eder (çok hızlı)
- Sadece kritik dosyaları izler
- Daha az dosya = daha hızlı kontrol

**Kullanım:**
```bash
php ultra_fast_sniffer.php
```

### 2. Bluetooth Sync Monitor
**Script:** `tasarımlar/cihazlar/bluetooth_sync_monitor.php`

**Özellikler:**
- Hem dosya izleme hem ADB logcat
- HTTP isteklerini yakalar
- Bluetooth sync'i daha iyi anlar

**Kullanım:**
```bash
php tasarımlar/cihazlar/bluetooth_sync_monitor.php
```

### 3. Enhanced Sniffer (Güncellenmiş)
**Script:** `tasarımlar/cihazlar/enhanced_sniffer.php`

**Güncellemeler:**
- Kontrol sıklığı: 200ms → 100ms
- Durum raporu: 10s → 5s
- `.clear` dosyası özel işaretleme

## 📊 Test Senaryosu

### Senaryo 1: Ultra Fast Sniffer
```bash
php ultra_fast_sniffer.php
```
- Bluetooth sync yapın
- 50ms kontrol ile yakalayacak

### Senaryo 2: ADB + Dosya İzleme
```bash
# ADB bağlantısı kur
adb connect 192.168.1.173:5555

# Bluetooth sync monitor başlat
php tasarımlar/cihazlar/bluetooth_sync_monitor.php
```
- Hem dosya değişikliklerini hem HTTP isteklerini görürsünüz

### Senaryo 3: Tüm Dosyaları Listele
```bash
php check_all_files.php
```
- Sync öncesi ve sonrası çalıştırın
- Hangi dosyaların değiştiğini görün

## 🔧 Alternatif Yaklaşımlar

### 1. Dosya Listesi Genişlet
Bluetooth sync farklı dosya isimleri kullanıyor olabilir. Script'e daha fazla dosya ekleyin:
- `files/task/*.mp4`
- `files/task/*.png`
- `files/task/*.jpg`
- `files/config/*.json`

### 2. ADB Logcat Kullan
Bluetooth sync HTTP istekleri gönderiyorsa logcat'te görünür:
```bash
adb logcat -v time | grep -iE 'http|upload|sync|bluetooth'
```

### 3. Cihazın Tüm Dosyalarını Listele
Sync sonrası cihazda hangi dosyalar var kontrol edin:
```bash
php check_all_files.php
```

## 📝 Notlar

- Bluetooth sync WiFi'den farklı çalışıyor olabilir
- Dosya yükleme sırası farklı olabilir
- Sync tetikleme yöntemi farklı olabilir
- ADB logcat ile HTTP isteklerini görmek en iyi yöntem

## 🎯 Sonraki Adımlar

1. **Ultra Fast Sniffer çalıştırın:**
   ```bash
   php ultra_fast_sniffer.php
   ```
   Bluetooth sync yapın, yakalayacak mı test edin.

2. **ADB logcat ile HTTP isteklerini yakalayın:**
   ```bash
   adb logcat -v time | grep -iE 'http|upload|sync'
   ```
   Bluetooth sync yapın, hangi endpoint'lerin çağrıldığını görün.

3. **Sync öncesi/sonrası dosya listesi:**
   ```bash
   php check_all_files.php
   ```
   Hangi dosyaların değiştiğini görün.












