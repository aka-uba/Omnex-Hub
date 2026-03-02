# Device Status Monitoring - Cihaz Durumu İzleme Sistemi

## 📊 Genel Bakış

PWA Player ve Android Player cihazlarının gerçek zamanlı online/offline durumunu izlemek için heartbeat tabanlı monitoring sistemi.

## 🔄 Sistem Bileşenleri

### 1. Heartbeat Mekanizması

**Player → Server**
- **Sıklık:** 30 saniyede bir
- **Endpoint:** `POST /api/player/heartbeat`
- **Auth:** X-DEVICE-TOKEN header

**Gönderilen Veriler:**
```javascript
{
  status: 'playing' | 'idle' | 'error',
  currentItem: 'item-uuid',
  battery: 85,                    // %
  memory: 145,                    // MB
  uptime: 3600,                   // seconds
  signal: 90                      // % (opsiyonel)
}
```

**Dönen Veriler:**
```javascript
{
  status: 'ok',
  serverTime: '2026-02-14 23:30:00',
  commands: [...],                // Bekleyen komutlar
  nextHeartbeat: 30,              // Sonraki heartbeat (saniye)
  shouldSync: false               // Sync gerekli mi?
}
```

### 2. Status Hesaplama

#### Backend - Realtime Calculation (`api/devices/index.php`)

**Timeout Threshold:** 120 saniye (2 dakika)

```php
// Son aktivite kontrolü
$lastActivity = $device['last_seen'] ?? $device['last_online'];
$secondsAgo = time() - strtotime($lastActivity);

// Status override
if ($secondsAgo > 120) {
    $device['status'] = 'offline';
} else {
    $device['status'] = 'online';
}

// Connection quality
if ($secondsAgo <= 60) {
    $device['connection_quality'] = 'excellent';  // < 1 min
} elseif ($secondsAgo <= 120) {
    $device['connection_quality'] = 'good';       // 1-2 min
} elseif ($secondsAgo <= 300) {
    $device['connection_quality'] = 'poor';       // 2-5 min
} else {
    $device['connection_quality'] = 'disconnected'; // > 5 min
}
```

#### Cron Job - Periodic Cleanup (`cron/check-device-status.php`)

**Sıklık:** Her 1 dakika
**Görev:** `online` ama 2dk+ heartbeat atmayan cihazları `offline` yap

```bash
# Linux/Mac Crontab
* * * * * php /path/to/check-device-status.php

# Windows Task Scheduler
Program: C:\xampp\php\php.exe
Arguments: C:\xampp\htdocs\market-etiket-sistemi\cron\check-device-status.php
Trigger: Every 1 minute
```

**Ek Özellikler:**
- ✅ Offline olan cihazlar için admin bildirim gönderimi
- ✅ 30 günden eski heartbeat kayıtlarını temizleme

### 3. Frontend Gösterimi

**DeviceList.js - Status Column**

```html
<!-- Online, mükemmel bağlantı -->
<span class="badge badge-success">Çevrimiçi</span>
<i class="ti ti-wifi" style="color: #40c057" title="Mükemmel bağlantı (< 1dk)"></i>
<span class="text-muted">(15sn)</span>

<!-- Online, zayıf bağlantı -->
<span class="badge badge-success">Çevrimiçi</span>
<i class="ti ti-wifi-off" style="color: #fa5252" title="Zayıf bağlantı (2-5dk)"></i>
<span class="text-muted">(3dk)</span>

<!-- Offline -->
<span class="badge badge-secondary">Çevrimdışı</span>
<i class="ti ti-wifi-off" style="color: #868e96" title="Bağlantı yok (> 5dk)"></i>
<span class="text-muted">(10dk)</span>
```

**Connection Quality Seviyeleri:**

| Seviye | Threshold | İkon Rengi | Durum |
|--------|-----------|-----------|-------|
| excellent | < 1 min | 🟢 Green | Mükemmel bağlantı |
| good | 1-2 min | 🟡 Yellow | İyi bağlantı |
| poor | 2-5 min | 🔴 Red | Zayıf bağlantı |
| disconnected | > 5 min | ⚪ Gray | Bağlantı yok |

## 🚀 Kurulum

### Windows Kurulumu

1. **Otomatik Kurulum:**
   ```cmd
   # Yönetici olarak çalıştır
   C:\xampp\htdocs\market-etiket-sistemi\cron\windows-setup-device-status-checker.bat
   ```

2. **Manuel Kurulum:**
   - Task Scheduler'ı aç (`taskschd.msc`)
   - Create Basic Task → "OmnexDeviceStatusChecker"
   - Trigger: Daily, Repeat every 1 minute
   - Action: Start a program
     - Program: `C:\xampp\php\php.exe`
     - Arguments: `C:\xampp\htdocs\market-etiket-sistemi\cron\check-device-status.php`
   - Finish

3. **Test:**
   ```cmd
   C:\xampp\htdocs\market-etiket-sistemi\cron\test-device-status.bat
   ```

### Linux/Mac Kurulumu

```bash
# Crontab'ı düzenle
crontab -e

# Her 1 dakikada bir çalıştır
* * * * * php /var/www/html/market-etiket-sistemi/cron/check-device-status.php >> /var/log/omnex-device-status.log 2>&1
```

## 📝 Log Çıktısı

**Normal Durum:**
```
[2026-02-14 23:30:00] Checking device status...
✅ All devices are healthy (no timeout detected)
[2026-02-14 23:30:00] Device status check completed
```

**Timeout Tespit Edildiğinde:**
```
[2026-02-14 23:31:00] Checking device status...
⚠️  Found 2 device(s) with timeout:
  - [Samsung TV Lobby] (Type: android_tv) - Last seen: 3.2 min ago
  - [Web Display 01] (Type: web_display) - Last seen: 5.8 min ago
✅ Updated 2 device(s) to offline status
🧹 Cleaned up 45 old heartbeat record(s)
[2026-02-14 23:31:00] Device status check completed
```

## 🐛 Debug & Troubleshooting

### Cihaz Hala Online Görünüyor

1. **Heartbeat kontrolü:**
   ```sql
   SELECT
       d.name,
       d.status,
       d.last_seen,
       (strftime('%s', 'now') - strftime('%s', d.last_seen)) as seconds_ago
   FROM devices d
   WHERE d.type IN ('android_tv', 'web_display')
   ORDER BY seconds_ago DESC;
   ```

2. **Son heartbeat kayıtları:**
   ```sql
   SELECT
       d.name,
       h.status,
       h.created_at,
       h.battery_level,
       h.memory_usage
   FROM device_heartbeats h
   JOIN devices d ON h.device_id = d.id
   ORDER BY h.created_at DESC
   LIMIT 20;
   ```

3. **Cron job çalışıyor mu?**
   ```cmd
   # Windows
   schtasks /query /tn "OmnexDeviceStatusChecker"

   # Linux/Mac
   tail -f /var/log/omnex-device-status.log
   ```

### Player Heartbeat Göndermiyor

1. **Browser Console:**
   ```javascript
   // Player debug modu
   player.config.debug = true;

   // Manuel heartbeat test
   player.sendHeartbeat();
   ```

2. **Network Tab:**
   - POST `/api/player/heartbeat` - 200 OK mı?
   - Response `commands` array dönüyor mu?

3. **Token kontrolü:**
   ```javascript
   localStorage.getItem('omnex_player_token');
   ```

### API Response Yavaş

- **Heartbeat timeout:** Default 30sn uygun
- **Cleanup:** 30 günlük heartbeat verisi tutulur
- **Index kontrolü:**
  ```sql
  -- Index'ler mevcut mu?
  SELECT name FROM sqlite_master
  WHERE type='index' AND tbl_name='device_heartbeats';
  ```

## 📊 Veritabani Şeması

```sql
-- Device status fields
devices:
  - status TEXT ('online', 'offline', 'error')
  - last_seen TEXT (ISO 8601)
  - last_online TEXT (ISO 8601)

-- Heartbeat records
device_heartbeats:
  - id TEXT PRIMARY KEY
  - device_id TEXT (FK)
  - status TEXT
  - battery_level INTEGER
  - memory_usage INTEGER
  - uptime INTEGER
  - created_at TEXT
```

## 🔧 Configuration

**Backend (`api/player/heartbeat.php`):**
```php
// Heartbeat update
$deviceUpdate = [
    'status' => 'online',
    'last_online' => date('Y-m-d H:i:s'),
    'last_seen' => date('Y-m-d H:i:s')
];
```

**Frontend (`player.js`):**
```javascript
// Heartbeat interval
this.config.heartbeatSeconds = 30;  // 30 seconds

// Auto-adjust on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        this.pauseHeartbeat();  // iOS PWA fix
    } else {
        this.resumeHeartbeat();
    }
});
```

**Cron (`check-device-status.php`):**
```php
// Offline threshold
$offlineThreshold = 120; // 2 minutes (4 missed heartbeats)

// Cleanup threshold
$cleanupSql = "DELETE FROM device_heartbeats
               WHERE created_at < datetime('now', '-30 days')";
```

## 📈 Performans

| Metrik | Değer |
|--------|-------|
| Heartbeat interval | 30 saniye |
| Offline threshold | 120 saniye (2 dakika) |
| Cron frequency | 1 dakika |
| Heartbeat retention | 30 gün |
| API response time | < 100ms |

## 🎯 Gelecek İyileştirmeler

- [ ] WebSocket ile real-time status (polling yerine)
- [ ] Dashboard'da live device map
- [ ] Offline alertler için Telegram/WhatsApp entegrasyonu
- [ ] Device health score (uptime %, avg response time)
- [ ] Historical status charts (uptime graphs)

## 📚 İlgili Dosyalar

**Backend:**
- `api/player/heartbeat.php` - Heartbeat endpoint
- `api/devices/index.php` - Device list with realtime status
- `cron/check-device-status.php` - Cron job

**Frontend:**
- `public/player/assets/js/player.js` - Heartbeat client
- `public/assets/js/pages/devices/DeviceList.js` - Status display

**Database:**
- `database/migrations/055_add_device_heartbeats.sql`
- `database/migrations/089_add_telemetry_tables.sql` (telemetry için)
