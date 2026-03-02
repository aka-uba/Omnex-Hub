# Gateway Tabanlı Cihaz İzleme Sistemi

## 🎯 Amaç

Local gateway üzerinden PavoDisplay ve diğer ESL/TV cihazlarının online/offline durumunu **gerçek zamana yakın** takip etmek.

## 📋 Özellikler

- ✅ **5 saniye interval** - Gateway her 5 saniyede sunucuya heartbeat gönderir
- ✅ **Otomatik cihaz keşfi** - Sunucu gateway'e taranacak cihazları gönderir
- ✅ **Hafif TCP ping** - HTTP request yerine sadece port 80 bağlantı kontrolü
- ✅ **Sunucuya yük YOK** - Gateway lokal ağdaki cihazları tarar
- ✅ **Gateway durumu** - Gateway online/offline görünür
- ✅ **Merkezi yönetim** - Tüm gateway'lerden gelen veriler tek noktada

---

## 🔄 Sistem Akışı

```
┌─────────────────────────────────────────────────────────────┐
│  Local Gateway (local-gateway-manager)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Ana Loop (5 saniye interval)                          │ │
│  │  1. scanLocalDevices()                                 │ │
│  │     - known_devices listesindeki her cihaza ping       │ │
│  │     - fsockopen($ip, 80, 2sn timeout)                  │ │
│  │     - online/offline durumu tespit                     │ │
│  │  2. heartbeat()                                        │ │
│  │     - Cihaz durumlarını sunucuya gönder                │ │
│  │     - Sunucudan devices_to_monitor listesi al          │ │
│  │     - known_devices güncelle (runtime)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ POST /api/gateway/heartbeat
┌─────────────────────────────────────────────────────────────┐
│  Sunucu (api/gateway/heartbeat.php)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. gateway_devices tablosunu güncelle                 │ │
│  │     - status: active/inactive/unreachable              │ │
│  │     - last_seen: şimdiki zaman                         │ │
│  │  2. devices_to_monitor listesi oluştur                 │ │
│  │     - SELECT * FROM devices WHERE company_id=X         │ │
│  │     - Sadece ip_address olan cihazlar                  │ │
│  │  3. Gateway'e geri dön                                 │ │
│  │     - devices_to_monitor: [{id, ip, type, name}]       │ │
│  │     - commands: bekleyen komutlar                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend (DeviceList)                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/devices                                      │ │
│  │  - gateway_devices JOIN                                │ │
│  │  - gateway_status override device.status              │ │
│  │  - gateway_info: {name, status, last_seen}            │ │
│  │  - Cihaz listesinde gateway badge göster              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Veritabanı Yapısı

### `gateways` Tablosu
```sql
CREATE TABLE gateways (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'offline', -- online, offline, error
    last_heartbeat TEXT,
    ...
);
```

### `gateway_devices` Tablosu
```sql
CREATE TABLE gateway_devices (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    local_ip TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, inactive, unreachable
    last_seen TEXT,
    ...
);
```

---

## 📡 API Akışı

### Gateway → Sunucu: Heartbeat

**Request:**
```http
POST /api/gateway/heartbeat
Authorization: Bearer {gateway_token}
Content-Type: application/json

{
  "local_ip": "192.168.1.100",
  "hostname": "gateway-pc",
  "devices": [
    {
      "device_id": "abc-123",
      "status": "online",
      "local_ip": "192.168.1.77"
    },
    {
      "device_id": "def-456",
      "status": "offline",
      "local_ip": "192.168.1.78"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "gateway_id": "xyz",
    "status": "online",
    "commands": [],
    "devices_to_monitor": [
      {
        "id": "uuid-1",
        "device_id": "abc-123",
        "ip": "192.168.1.77",
        "type": "esl",
        "model": "esl_android",
        "name": "ESL Device 1"
      },
      {
        "id": "uuid-2",
        "device_id": "def-456",
        "ip": "192.168.1.78",
        "type": "android_tv",
        "model": "pwa_player",
        "name": "TV Display 1"
      }
    ],
    "runtime": {
      "polling_interval_ms": 500,
      "burst_sleep_ms": 80,
      "command_batch_size": 20
    },
    "server_time": "2026-02-15 00:30:00"
  }
}
```

### Frontend → Sunucu: Device List

**Request:**
```http
GET /api/devices?page=1&per_page=20
Authorization: Bearer {user_token}
```

**Response (Partial):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "ESL Device 1",
      "ip_address": "192.168.1.77",
      "status": "online",  // Gateway override edilmiş
      "gateway_info": {
        "gateway_name": "Gateway Ana",
        "gateway_status": "active",
        "gateway_online": true,
        "last_seen": "2026-02-15 00:30:05"
      },
      "last_activity": "2026-02-15 00:30:05"
    }
  ]
}
```

---

## 🔧 Kurulum ve Yapılandırma

### 1. Gateway Kurulumu

Gateway zaten `local-gateway-manager` dizininde kurulu. Çalıştırmak için:

```bash
# Development
cd C:\xampp\htdocs\market-etiket-sistemi\local-gateway-manager
npm start

# Production (Electron app)
# Windows installer ile kurulmuş Gateway Manager uygulamasını çalıştır
```

### 2. Gateway Config

`gateway/gateway.config.json` dosyasında:

```json
{
  "server_url": "https://yourdomain.com/signage",
  "gateway_id": "uuid-from-server",
  "gateway_name": "Ana Gateway",
  "api_key": "your-api-key",
  "api_secret": "your-api-secret",
  "polling_interval": 5
}
```

**NOT**: `known_devices` listesi artık sunucudan otomatik geliyor, config'e manuel eklemeye gerek YOK!

### 3. Sunucu Migration

Migration zaten mevcut (`032_create_gateways.sql`). Kontrol:

```bash
php -r "require 'config.php'; Database::getInstance()->migrate();"
```

---

## 🚀 Kullanım

### Gateway Başlatma

**Manuel:**
```bash
php gateway/gateway.php
```

**Daemon (arka plan):**
```bash
php gateway/gateway.php --daemon
```

**Electron App:**
- Local Gateway Manager uygulamasını aç
- Dashboard → PHP Gateway → "Başlat"

### Frontend'de Görüntüleme

1. **Cihaz Listesi** (`#/devices`):
   - Online/Offline durumu gateway'den gelir
   - Gateway badge gösterilir
   - Son görülme zamanı

2. **Dashboard** (`#/dashboard`):
   - Gateway online/offline sayısı
   - Toplam gateway sayısı

3. **Gateway Yönetimi** (`#/settings/gateways`):
   - Tüm gateway'leri listele
   - Her gateway için bağlı cihazlar
   - Gateway config düzenleme

---

## 📊 Performans

| Metrik | Değer | Açıklama |
|--------|-------|----------|
| **Heartbeat Interval** | 5 saniye | Gateway her 5sn heartbeat gönderir |
| **Ping Timeout** | 2 saniye | fsockopen timeout süresi |
| **Cihaz Tarama** | ~50ms/cihaz | Hafif TCP socket kontrolü |
| **50 Cihaz** | ~2.5 saniye | 50 cihazı tarama süresi |
| **Gerçek Zamanlılık** | 5-10 saniye | Cihaz kapandıktan sonra max gecikme |
| **Sunucu Yükü** | Minimal | Sadece veri güncellemesi |

---

## 🐛 Sorun Giderme

### Gateway heartbeat göndermiyor

**Kontrol:**
```bash
# Gateway loglarını kontrol et
tail -f gateway/gateway.log

# Gateway çalışıyor mu?
php gateway/gateway.php --status
```

**Çözüm:**
- `gateway.config.json` içinde `server_url`, `api_key`, `api_secret` doğru mu?
- Sunucu erişilebilir mi?
- Gateway auth middleware çalışıyor mu?

### Cihazlar hala offline görünüyor

**Kontrol:**
```bash
# Heartbeat response'u kontrol et
# gateway.log dosyasında "devices_to_monitor" var mı?
```

**Çözüm:**
- Gateway heartbeat'i sunucuya ulaşıyor mu?
- `devices_to_monitor` listesi dolu mu?
- Cihazların `ip_address` alanı dolu mu?

### Cihaz ping başarısız

**Kontrol:**
```bash
# Gateway log'unda ping hataları var mı?
grep "ping" gateway/gateway.log
```

**Çözüm:**
- Cihaz IP'si doğru mu?
- Cihaz aynı ağda mı?
- Port 80 açık mı?
- Firewall engelliyor mu?

### Gateway'ler dashboard'da görünmüyor

**Kontrol:**
```sql
-- SQLite
SELECT * FROM gateways;
SELECT * FROM gateway_devices;
```

**Çözüm:**
- Migration çalıştı mı?
- Gateway kayıtlı mı?
- Dashboard stats API gateway bilgisini dönüyor mu?

---

## 🔐 Güvenlik

### Gateway Authentication

Gateway JWT token ile kimlik doğrulaması yapar:

```http
Authorization: Bearer {gateway_jwt_token}
```

Token `GatewayAuthMiddleware` tarafından doğrulanır.

### IP Whitelist

Gateway sadece belirli subnet'lerden cihazlara ping atar:

```json
"security": {
  "allowed_subnets": [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8"
  ]
}
```

---

## 📚 İlgili Dosyalar

### Backend
- `api/gateway/heartbeat.php` - Gateway heartbeat endpoint
- `api/devices/index.php` - Device list with gateway JOIN
- `api/reports/dashboard-stats.php` - Dashboard gateway stats
- `middleware/GatewayAuthMiddleware.php` - Gateway auth

### Gateway
- `gateway/gateway.php` - Gateway ana dosyası
- `gateway/gateway.config.json` - Gateway config

### Frontend
- `public/assets/js/pages/devices/DeviceList.js` - Device list page
- `public/assets/js/pages/Dashboard.js` - Dashboard page
- `public/assets/js/pages/settings/GatewaySettings.js` - Gateway management

### Database
- `database/migrations/032_create_gateways.sql` - Gateway tables

---

## 🎯 Sonraki Adımlar

### Kısa Vade
- [ ] DeviceList'te gateway badge gösterimi
- [ ] Dashboard'da gateway online/offline kartı
- [ ] Gateway detay modal

### Orta Vade
- [ ] Gateway WebSocket real-time status
- [ ] Multi-gateway load balancing
- [ ] Gateway failover mekanizması

### Uzun Vade
- [ ] Gateway cluster management
- [ ] Distributed device monitoring
- [ ] Cross-gateway device migration

---

## 📞 Destek

Sorun yaşıyorsanız:
1. Gateway loglarını kontrol edin: `gateway/gateway.log`
2. Sunucu loglarını kontrol edin: `storage/logs/app.log`
3. Database'i kontrol edin: `gateways`, `gateway_devices` tabloları

---

**Son Güncelleme:** 2026-02-15
**Versiyon:** 1.0.0
