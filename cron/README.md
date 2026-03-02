# Heartbeat Cron Kurulum Rehberi

## 🎯 Amaç

PavoDisplay cihazlarının online/offline durumunu otomatik olarak kontrol eder ve veritabanını günceller.

## 📋 Özellikler

- ✅ 30 saniye interval
- ✅ Hafif TCP ping (HTTP request yok)
- ✅ Sadece durum değişenleri günceller
- ✅ Detaylı loglama
- ✅ Performans ölçümü

## 🚀 Hızlı Başlangıç

### Manuel Test

```bash
# Windows CMD
C:\xampp\php\php.exe C:\xampp\htdocs\market-etiket-sistemi\cron\device-heartbeat.php

# Veya batch script ile
C:\xampp\htdocs\market-etiket-sistemi\cron\run-heartbeat.bat
```

**Beklenen Çıktı**:
```
[2026-02-15 00:19:51] Heartbeat completed: 12 online, 3 offline, 2 changed (1456ms)
```

## 🔧 Windows Task Scheduler Kurulumu

### Yöntem 1: GUI ile (Kolay)

1. **Task Scheduler**'ı açın:
   - Windows + R → `taskschd.msc` → Enter

2. **Create Task** (Gelişmiş Ayarlar):
   - Name: `PavoDisplay Heartbeat`
   - Description: `Cihaz durumu kontrolü (30sn)`
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges (opsiyonel)

3. **Triggers** sekmesi:
   - New → "At startup"
   - Advanced settings:
     - ✅ Repeat task every: **30 seconds**
     - For a duration of: **Indefinitely**
     - ✅ Enabled

4. **Actions** sekmesi:
   - New → "Start a program"
   - Program/script: `C:\xampp\htdocs\market-etiket-sistemi\cron\run-heartbeat.bat`
   - Start in: `C:\xampp\htdocs\market-etiket-sistemi\cron`

5. **Conditions** sekmesi:
   - ❌ Start the task only if the computer is on AC power
   - ❌ Stop if the computer switches to battery power
   - ❌ Start only if the following network connection is available

6. **Settings** sekmesi:
   - ✅ Allow task to be run on demand
   - ✅ Run task as soon as possible after a scheduled start is missed
   - If the task fails, restart every: **1 minute** (opsiyonel)
   - Stop the task if it runs longer than: **1 minute**
   - If the running task does not end when requested: **Stop the existing instance**

7. **OK** tıklayın ve şifrenizi girin (gerekirse)

### Yöntem 2: XML Import ile (Hızlı)

1. Task Scheduler'ı açın: `taskschd.msc`
2. Action → **Import Task**
3. Dosya seç: `C:\xampp\htdocs\market-etiket-sistemi\cron\heartbeat-task.xml`
4. **OK** tıklayın

### Yöntem 3: PowerShell ile (Otomatik)

```powershell
# PowerShell'i Administrator olarak çalıştırın

$action = New-ScheduledTaskAction -Execute "C:\xampp\htdocs\market-etiket-sistemi\cron\run-heartbeat.bat" -WorkingDirectory "C:\xampp\htdocs\market-etiket-sistemi\cron"

$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Seconds 30) -RepetitionDuration ([TimeSpan]::MaxValue)).Repetition

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "PavoDisplay Heartbeat" -Action $action -Trigger $trigger -Settings $settings -Description "Cihaz durumu kontrolü (30sn)" -User "SYSTEM" -RunLevel Highest
```

## ✅ Kurulum Doğrulama

### Task Çalışıyor mu?

```powershell
# PowerShell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*Heartbeat*"}

# Çıktı:
# TaskPath  TaskName               State
# --------  --------               -----
# \         PavoDisplay Heartbeat  Ready
```

### Manuel Çalıştırma

Task Scheduler'da task'a sağ tık → **Run**

### Log Kontrolü

```bash
# Logs klasöründe en son log dosyasını kontrol edin
type C:\xampp\htdocs\market-etiket-sistemi\storage\logs\app.log | findstr "Heartbeat"
```

**Beklenen**:
```
[2026-02-15 00:19:51] INFO: Heartbeat completed {"total_devices":15,"online":12,"offline":3,...}
```

## 🐛 Sorun Giderme

### Task çalışmıyor

1. **Task History** kontrol edin:
   - Task Scheduler → View → ✅ Show All Running Tasks
   - Task'a çift tık → History sekmesi

2. **Last Run Result** kontrol edin:
   - `0x0` = Başarılı
   - `0x1` = Hata var

3. **Manuel çalıştırın**:
   ```bash
   C:\xampp\htdocs\market-etiket-sistemi\cron\run-heartbeat.bat
   ```

### PHP bulunamıyor hatası

Batch dosyasında PHP yolunu güncelleyin:
```batch
@echo off
"C:\xampp\php\php.exe" "C:\xampp\htdocs\market-etiket-sistemi\cron\device-heartbeat.php"
```

### Permission denied

Task Scheduler'da:
- ✅ Run with highest privileges
- User: SYSTEM veya kendi kullanıcınız

### Çok yavaş çalışıyor

Heartbeat log'unda duration kontrol edin:
```
[2026-02-15 00:19:51] Heartbeat completed: ... (6045ms)
```

**6 saniyeden uzunsa**:
- Cihaz sayısını azaltın veya
- Timeout'u düşürün (`PavoDisplayGateway.php` → `connectTimeout`)

## 📊 Performans

| Cihaz Sayısı | Beklenen Süre |
|--------------|---------------|
| 10 cihaz | ~1-2 saniye |
| 50 cihaz | ~4-6 saniye |
| 100 cihaz | ~8-12 saniye |

**Not**: 30 saniyeden uzun sürerse Task Scheduler kill eder (timeout ayarı)

## 🔄 Task'ı Güncelleme

Task'ı değiştirmek için:

1. Task Scheduler'da task'a sağ tık → **Properties**
2. Ayarları değiştirin
3. **OK** tıklayın

Veya task'ı silip yeniden oluşturun:
```powershell
Unregister-ScheduledTask -TaskName "PavoDisplay Heartbeat" -Confirm:$false
# Sonra tekrar Register-ScheduledTask...
```

## 🛑 Task'ı Durdurma

### Geçici Durdurma
Task Scheduler'da task'a sağ tık → **Disable**

### Kalıcı Silme
```powershell
Unregister-ScheduledTask -TaskName "PavoDisplay Heartbeat" -Confirm:$false
```

## 📝 Notlar

- Task **bilgisayar başladığında** otomatik başlar
- 30 saniye interval **çok sık** geliyorsa trigger'ı değiştirebilirsiniz (örn: 1 dakika)
- Log dosyaları `storage/logs/app.log` altında
- Heartbeat sadece **ESL cihazları** kontrol eder (type='esl')

## 💡 İpuçları

1. **Test Önce**: Manuel çalıştırıp hata olmadığını kontrol edin
2. **Log İzle**: İlk 5 dakika log dosyasını takip edin
3. **Performans**: 100+ cihaz varsa interval'ı 1 dakikaya çıkarın
4. **Backup**: Task'ı export edip XML dosyasını saklayın

## 🎯 Sonraki Adımlar

Task kurulduktan sonra:

1. ✅ Cihazları kapatın/açın
2. ✅ 30 saniye bekleyin
3. ✅ Cihaz listesini yenileyin
4. ✅ Durum değişimlerini kontrol edin

**Başarılı kurulum = Otomatik durum güncellemesi! 🚀**
