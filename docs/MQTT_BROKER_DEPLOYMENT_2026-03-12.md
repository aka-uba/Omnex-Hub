# MQTT Broker (Mosquitto) Kurulum ve Yapilandirma

> **Tarih:** 2026-03-12 | **Surum:** Eclipse Mosquitto 2.x (Docker) | **Durum:** Aktif

---

## Genel Bakis

Omnex Display Hub, ESL cihazlariyla gercek zamanli iletisim icin MQTT protokolunu kullanir. Mosquitto broker Docker container olarak calisir ve iki farkli kullanici profili ile erisim saglar.

---

## Mimari

```
+------------------+       +-------------------+       +------------------+
|  ESL Cihazlar    | <---> |  Mosquitto Broker  | <---> |  App Container   |
|  (omnex_device)  |  1883 |  (Docker: mqtt)    |  1883 |  (mosquitto_pub) |
+------------------+       +-------------------+       +------------------+
                                    ^
                                    | 9001 (WebSocket)
                                    v
                            +------------------+
                            |  Web Tarayici    |
                            |  (MQTT.js / WS)  |
                            +------------------+
```

### Adres Cozumleme

| Baglam | Host | Port | Aciklama |
|--------|------|------|----------|
| App container -> Broker | `mqtt` | 1883 | Docker internal hostname (env: OMNEX_MQTT_HOST) |
| Cihazlar -> Broker | Sunucu IP/domain | 1883 | External TCP (DB: mqtt_settings.broker_url) |
| Tarayici -> Broker | Sunucu IP/domain | 9001 | WebSocket (WS) |

---

## Sunucu Yapilandirmasi (Production)

### Container Bilgileri

| Bilgi | Deger |
|-------|-------|
| Image | `eclipse-mosquitto:2` |
| Container | `omnex-mqtt-1` |
| MQTT Port | 1883 (0.0.0.0) |
| WebSocket Port | 9001 (0.0.0.0) |
| Memory Limit | 256 MB |
| Restart Policy | unless-stopped |
| Health Check | mosquitto_pub ile 30sn aralik |
| Persistence | mqtt_data Docker volume |

### Kullanici ve Yetki Tablosu

| Kullanici | Sifre (env) | Yetki | Kullanim |
|-----------|-------------|-------|----------|
| omnex_server | MQTT_SERVER_PASS | readwrite # + read $SYS/# | App container (publish) |
| omnex_device | MQTT_DEVICE_PASS | readwrite omnex/esl/# + read $SYS/broker/version | ESL cihaz baglantilari |

### Env Degiskenleri (.env dosyasinda)

| Degisken | Varsayilan | Aciklama |
|----------|------------|----------|
| MQTT_SERVER_USER | omnex_server | Sunucu tarafinda publish kullanicisi |
| MQTT_SERVER_PASS | (zorunlu) | Sunucu kullanici sifresi |
| MQTT_DEVICE_USER | omnex_device | Cihaz baglanti kullanicisi |
| MQTT_DEVICE_PASS | (zorunlu) | Cihaz kullanici sifresi |
| MQTT_PORT | 1883 | MQTT TCP port |
| MQTT_WS_PORT | 9001 | MQTT WebSocket port |

### UFW Kurallari

```bash
sudo ufw allow 1883/tcp comment 'MQTT-Broker'
sudo ufw allow 9001/tcp comment 'MQTT-WebSocket'
```

---

## Dosya Yapisi

```
deploy/
  mosquitto/
    mosquitto.conf          # Broker ana yapilandirmasi
    acl                     # Erisim kontrol listesi (ACL)
    docker-entrypoint.sh    # Sifre dosyasi olusturma + broker baslatma
  docker-compose.yml        # MQTT servisi tanimli
  .env                      # MQTT_* env degiskenleri
```

### mosquitto.conf Ozet

| Ayar | Deger | Aciklama |
|------|-------|----------|
| listener 1883 | 0.0.0.0 | TCP dinleyici |
| listener 9001 | 0.0.0.0, protocol websockets | WebSocket dinleyici |
| allow_anonymous | false | Anonim erisim kapali |
| password_file | /mosquitto/config/passwd | Hashli sifre dosyasi |
| acl_file | /mosquitto/config/acl | Erisim kontrol listesi |
| persistence | true | Mesaj kaliciligi |
| max_connections | -1 | Sinirsiz baglanti |
| max_inflight_messages | 200 | Eslesen mesaj siniri |
| max_queued_messages | 1000 | Kuyruk siniri |
| message_size_limit | 262144 | 256 KB maks mesaj boyutu |
| max_keepalive | 120 | 2 dk keep-alive |

### ACL (Erisim Kontrol Listesi)

```
# omnex_server: Tam erisim (app container)
user omnex_server
topic readwrite #
topic read $SYS/#

# omnex_device: Sadece ESL topic'leri
user omnex_device
topic readwrite omnex/esl/#
topic read $SYS/broker/version
```

### docker-entrypoint.sh Akisi

1. Env degiskenlerinden sifre dosyasi olusturur (`mosquitto_passwd -b`)
2. omnex_server + omnex_device kullanicilarini ekler
3. Data ve log dizinlerini olusturur
4. Mosquitto broker'i baslatir

---

## Lokal Gelistirme Yapilandirmasi (XAMPP / Windows)

### Secenekler

**Secenek 1: Docker Compose (Onerilen)**
```bash
cd deploy
docker compose -f docker-compose.local.yml up -d mqtt
```

**Secenek 2: Yerel Mosquitto Kurulumu (Windows)**
1. https://mosquitto.org/download/ adresinden indir
2. Kur: `C:\Program Files\mosquitto\`
3. Config dosyasini duzenle veya `deploy/mosquitto/mosquitto.conf` kullan
4. Servis olarak baslat

### Lokal Baglanti Ayarlari

| Ayar | Deger |
|------|-------|
| Broker URL | localhost |
| Port | 1883 |
| Username | (bos veya test kullanici) |
| Password | (bos veya test sifre) |
| Topic Prefix | omnex/esl |

### Env Degiskeni Yok (Lokal)

Lokal ortamda `OMNEX_MQTT_HOST` env degiskeni set edilmez. Bu durumda `MqttBrokerService.php` otomatik olarak DB `mqtt_settings.broker_url` degerini (veya varsayilan `127.0.0.1`) kullanir.

---

## Admin Panel MQTT Broker Ayarlari

Entegrasyon Ayarlari sayfasindan (`#/settings/integrations` > MQTT Broker sekmesi) asagidaki ayarlar yapilir:

### Sunucu Icin Olmasi Gereken Ayarlar

| Alan | Deger | Aciklama |
|------|-------|----------|
| Broker URL | `hub.omnexcore.com` veya `185.124.84.34` | Sunucu domain/IP (dinamik varsayilan) |
| Port | `1883` | MQTT TCP port |
| TLS | Kapali | (TLS gerekirse ayri sertifika lazim) |
| Provider | Mosquitto | Broker tipi |
| Username | `omnex_device` | Cihaz baglanti kullanicisi |
| Password | (MQTT_DEVICE_PASS degeri) | Cihaz sifresi |
| Topic Prefix | `omnex/esl` | Varsayilan topic on eki |
| Durum | Aktif | Etkin/test/pasif |
| Content Server URL | `https://hub.omnexcore.com/api/esl/mqtt/content` | Otomatik olusur |
| Report Server URL | `https://hub.omnexcore.com/api/esl/mqtt/report` | Otomatik olusur |

> **ONEMLI**: Broker URL alani cihazlarin disaridan baglanacagi adresi gosterir. Bu, sunucu IP veya domain adi olmalidir. App container ici iletisim icin `OMNEX_MQTT_HOST=mqtt` env degiskeni ayri kullanilir.

### Lokal Icin Olmasi Gereken Ayarlar

| Alan | Deger |
|------|-------|
| Broker URL | `localhost` |
| Port | `1883` |
| TLS | Kapali |
| Provider | Mosquitto |
| Username | (bos veya lokal kullanici) |
| Password | (bos veya lokal sifre) |
| Topic Prefix | `omnex/esl` |
| Durum | Aktif |

---

## MqttBrokerService.php - Host Cozumleme

```php
// Docker ortaminda env var ile internal hostname kullan (mqtt),
// yoksa DB ayarlarindan broker_url kullan (non-Docker / XAMPP)
$envHost = getenv('OMNEX_MQTT_HOST');
$envPort = getenv('OMNEX_MQTT_PORT');
$envUser = getenv('OMNEX_MQTT_USER');
$envPass = getenv('OMNEX_MQTT_PASS');

if ($envHost !== false && $envHost !== '') {
    // Docker: internal hostname
    $brokerHost = $envHost;  // 'mqtt'
    $brokerPort = (int)($envPort ?: 1883);
} else {
    // Non-Docker: DB ayarlari
    $brokerHost = $settings['broker_url'] ?? '127.0.0.1';
    $brokerPort = (int)($settings['broker_port'] ?? 1883);
}
```

### Oncelik Sirasi

1. **Env vars** (Docker): `OMNEX_MQTT_HOST`, `OMNEX_MQTT_PORT`, `OMNEX_MQTT_USER`, `OMNEX_MQTT_PASS`
2. **DB ayarlari**: `mqtt_settings` tablosundaki `broker_url`, `broker_port`, `username`, `password`
3. **Varsayilan**: `127.0.0.1:1883` (kullanici/sifre yok)

---

## Topic Yapisi

```
omnex/esl/                              # ESL ana prefix
omnex/esl/p2p/GID_omnex@@@{client_id}  # Cihaza ozel topic (publish)
omnex/esl/{client_id}/report            # Cihazdan rapor (subscribe)
omnex/healthcheck                        # Health check topic
$SYS/broker/version                     # Broker sistem bilgisi
```

---

## Sorun Giderme

### Broker calisiyor mu?
```bash
docker inspect omnex-mqtt-1 --format='{{.State.Health.Status}}'
# Beklenen: healthy
```

### Broker loglari
```bash
docker logs omnex-mqtt-1 --tail 30
```

### App container -> Broker testi
```bash
docker exec omnex-app-1 mosquitto_pub -h mqtt -p 1883 \
  -u omnex_server -P <MQTT_SERVER_PASS> \
  -t 'omnex/test' -m 'test mesaji'
```

### Port kontrolu
```bash
ss -tlnp | grep -E '1883|9001'
```

### Nginx 502 Bad Gateway
App container yeniden baslatildiginda nginx eski IP'yi onbellege alir:
```bash
docker compose -f docker-compose.yml -f docker-compose.standalone.yml restart nginx
```

### Sifre dosyasi hatasi
Container icinde sifre dosyasini kontrol et:
```bash
docker exec omnex-mqtt-1 cat /mosquitto/config/passwd
```

---

## Guvenlik Notlari

- Anonim erisim **kapali** (`allow_anonymous false`)
- Sifre dosyasi hashli saklanir (`mosquitto_passwd -b`)
- ACL ile topic bazli yetki kontrolu
- `omnex_device` kullanicisi sadece `omnex/esl/#` altinda islem yapabilir
- Sunucu sifreler `.env` dosyasinda, GitHub'a gitmez
- Production'da guclu sifreler kullanilmali (32+ karakter)
- TLS aktif edilecekse Mosquitto'ya sertifika mount edilmeli

---

## Iliskili Dosyalar

| Dosya | Aciklama |
|-------|----------|
| `deploy/docker-compose.yml` | MQTT servisi tanimi |
| `deploy/mosquitto/mosquitto.conf` | Broker yapilandirmasi |
| `deploy/mosquitto/acl` | Erisim kontrol listesi |
| `deploy/mosquitto/docker-entrypoint.sh` | Container baslatma scripti |
| `deploy/Dockerfile` | App container (mosquitto-clients dahil) |
| `deploy/.env.example` | Env degisken ornekleri |
| `services/MqttBrokerService.php` | PHP MQTT servis sinifi |
| `public/assets/js/pages/settings/IntegrationSettings.js` | Admin MQTT ayar formu |
| `docs/MQTT_INTEGRATION.md` | MQTT entegrasyon detayli dokumani |
