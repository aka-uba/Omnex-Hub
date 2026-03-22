# PavoDisplay ESL Tablet - Token Yönetimi ve Factory Reset Kılavuzu

**Tarih:** 2026-03-16
**Proje:** Omnex Display Hub
**Hedef Cihazlar:** PavoDisplay 10.1" Android ESL Tablet (PD1010-II)

---

## 1. Genel Bakış

Bu döküman, PavoDisplay ESL tablet cihazlarında token (şifre) güvenlik sistemi ve fabrika ayarlarına sıfırlama (factory reset) işlemlerinin üç farklı iletişim protokolü (HTTP-SERVER, HTTP Pull, MQTT) üzerinden nasıl çalıştığını, yapılan testleri ve sonuçları kapsar.

### Test Edilen Cihazlar

| Bluetooth Adı | MAC Adresi | IP Adresi | Protokol | Durum |
|---------------|-----------|-----------|----------|-------|
| @B2A401A977 | 20:51:F5:4F:50:7F | 192.168.1.172 | HTTP-SERVER | Token ile kuruldu |
| @B2A301AB37 | 20:51:F5:4F:50:59 | 192.168.1.160 | HTTP (Pull) | Token ile kuruldu |
| @B2A401A959 | 20:51:F5:4F:50:0A | 192.168.1.161 | MQTT | Token ile kuruldu |

---

## 2. Token (Şifre) Güvenlik Sistemi

### 2.1 Şifre Hiyerarşisi

PavoDisplay cihazlarında Bluetooth üzerinden iki seviye şifre mevcuttur:

| Şifre Tipi | Bluetooth Komutu | Açıklama |
|------------|-----------------|----------|
| **Yönetici Şifresi** (Admin/Root) | `passwd-root` | En yüksek yetki. Değiştirilmesi eski yönetici şifresini gerektirir |
| **Kullanıcı Şifresi** (User) | `passwd-user` | Normal yetki. Yönetici veya eski kullanıcı şifresiyle değiştirilebilir |

### 2.2 Şifre Doğrulama Matrisi

| Yönetici Şifresi | Kullanıcı Şifresi | Komut Gönderme Davranışı |
|-------------------|-------------------|--------------------------|
| Yok | Yok | Şifre doğrulaması gerekmez, `"Token":""` ile çalışır |
| Yok | Var | Kullanıcı şifresi gerekli: `"Token":"user_pass"` |
| Var | Yok | Şifre doğrulaması gerekmez (yönetici şifresi değişimi hariç) |
| Var | Var | Herhangi biri kabul edilir: `"Token":"admin_pass"` veya `"Token":"user_pass"` |

### 2.3 Şifre Ayarlama Komutları (Bluetooth)

```
// İlk kez yönetici şifresi ayarlama (Token boş)
+SET-DEVICE:{"passwd-root":{"passwd":"root111"},"Token":""}

// Yönetici şifresi değiştirme (eski şifre ile doğrulama)
+SET-DEVICE:{"passwd-root":{"passwd":"root222"},"Token":"root111"}

// İlk kez kullanıcı şifresi ayarlama (Token boş)
+SET-DEVICE:{"passwd-user":{"passwd":"user333"},"Token":""}

// Kullanıcı şifresi değiştirme (eski kullanıcı veya yönetici şifresiyle)
+SET-DEVICE:{"passwd-user":{"passwd":"user444"},"Token":"user333"}
+SET-DEVICE:{"passwd-user":{"passwd":"user444"},"Token":"root111"}
```

### 2.4 API Seviyesi Güvenlik (HTTP/MQTT)

WiFi API arayüzlerinde Token yerine **MD5 imza doğrulaması** kullanılır:
- Her cihaza `AppID` ve `AppSecret` (32 bayt) atanır
- İmza algoritması: Parametreler ASCII sırasıyla sıralanır → `key1=value1&key2=value2...&key=AppSecret` → MD5 → UPPERCASE = `sign`
- Bu imza HTTP ve MQTT kayıt isteklerinde zorunludur

---

## 3. Protokol Bazında Factory Reset Yöntemleri

### 3.1 Bluetooth ile Factory Reset (Tüm Protokoller)

Üretici dökümanına göre birincil ve en güvenilir sıfırlama yöntemi:

```
+SET-DEVICE:{"Restore":0, "Token":"<mevcut_şifre>"}\r\n
```

**Başarılı yanıt:** `+DONE`
**Şifre hatası:** `Token error` (cihaz bildirim çubuğunda)

**Şifre sıfırlama davranışı:**
- **Yönetici şifresiyle** factory reset: Hem yönetici hem kullanıcı şifresi temizlenir
- **Kullanıcı şifresiyle** factory reset: Sadece kullanıcı şifresi temizlenir, yönetici şifresi kalır

### 3.2 MQTT Üzerinden Factory Reset

MQTT broker üzerinden cihaza push mesajı gönderilerek:

```json
{
  "action": "clear-config",
  "push_id": 0,
  "clientid": "lcd_device_sn"
}
```

**Ön Koşullar:**
- Cihaz MQTT broker'a bağlı olmalı
- Cihaz doğru topic'e abone olmuş olmalı
- MQTT kayıt (`/openapi/mqttregister`) başarılı tamamlanmış olmalı

**Diğer MQTT Komutları:**
| Aksiyon | Açıklama |
|---------|----------|
| `clear-res` | Sadece medya dosyalarını temizle (konfigürasyon kalır) |
| `clear-config` | Fabrika ayarlarına sıfırla |
| `deviceRestart` | Cihazı yeniden başlat |

### 3.3 HTTP Pull Protokolünde Factory Reset

**ÖNEMLİ:** HTTP Pull protokolünde doğrudan factory reset komutu **YOKTUR**.

HTTP Pull modeli:
- Cihaz periyodik olarak `Remote-server` URL'sine GET isteği atar
- Sunucu cevap olarak görüntülenecek içeriği döner
- Cihazdan sunucuya tek yönlü istek modeli (PULL)
- Sunucudan cihaza komut gönderme mekanizması bulunmaz

**Sıfırlama yolu:** Bluetooth BLE üzerinden `+SET-DEVICE:{"Restore":0, "Token":"..."}` komutu

### 3.4 HTTP-SERVER Protokolünde Factory Reset

**ÖNEMLİ:** HTTP-SERVER (doğrudan IP erişimi) protokolünde de factory reset API'si **dökümente edilmemiştir**.

Mevcut HTTP-SERVER endpointleri:
| Endpoint | Açıklama |
|----------|----------|
| `GET /Iotags` | Cihaz bilgisi sorgulama |
| `POST /upload` | Dosya yükleme |
| `GET /check` | Dosya MD5 kontrolü |
| `GET /replay` | Ekran yenileme/görev tetikleme |
| `GET /clear` | Depolama temizleme (medya, konfigürasyon değil) |

**Sıfırlama yolu:** Bluetooth BLE üzerinden `+SET-DEVICE:{"Restore":0, "Token":"..."}` komutu

### 3.5 Donanımsal Reset

**Üretici dökümanlarında hiçbir donanımsal sıfırlama yöntemi (fiziksel buton, pin deliği, ekran basma kombinasyonu) belirtilmemiştir.** Tüm sıfırlama işlemleri yazılım tabanlıdır.

---

## 4. Yapılan Testler ve Sonuçlar

### 4.1 Test Senaryosu

**Başlangıç durumu:** 3 cihaz yerel (local) ortamda token ile yapılandırıldı ve Omnex Display Hub projesine eklendi. HTTP-SERVER, HTTP Pull ve MQTT protokollerinde sorunsuz çalışıyordu.

**Sorun:** Proje sunucuya deploy edildikten sonra bu cihazlar sunucu ortamına eklenmeye çalışıldığında, tokenlar sunucu veritabanında olmadığı için hiçbir işlem yapılamadı.

**Üretici APK testleri:** PriceTag ve PriceTag Setup APK'ları ile Bluetooth bağlantısı denendi. Cihazlar tokenlu olduğu için APK'lar üzerinden de erişim mümkün olmadı - **güvenlik sistemi doğru çalışıyor.**

### 4.2 Factory Reset Denemeleri

#### Test 1: Bluetooth BLE ile Factory Reset

```
+SET-DEVICE:{"Restore":0, "Token":"<kayıtlı_token>"}\r\n
```

| Cihaz | Protokol | BLE Yanıtı | Gözlemlenen Değişiklik | Tam Reset? |
|-------|----------|-----------|----------------------|------------|
| @B2A401A959 | MQTT | `+DONE` | Fabrika QR banner alanı geldi | ❌ Hayır - APK eski protokolü gösteriyor |
| @B2A401A977 | HTTP-SERVER | `AT+ECHO=0` | Fabrika QR banner alanı geldi | ⚠️ Belirsiz - HTTP server tam açılmadı |
| @B2A301AB37 | HTTP Pull | BLE scan'de görülmedi | Değişiklik yok | ❌ Reset yapılamadı |

#### Test 2: MQTT Broker Üzerinden Factory Reset

```json
{"action": "clear-config", "push_id": 0, "clientid": "..."}
```

**Sonuç:** Cihaz MQTT broker'a bağlı olmadığı için mesaj iletilemedi.

#### Test 3: HTTP Üzerinden Factory Reset

HTTP Pull ve HTTP-SERVER protokollerinde factory reset API'si olmadığı için doğrudan test yapılamadı.

#### Test 4: ADB ile Erişim

```
adb connect 192.168.1.160:5555
adb connect 192.168.1.161:5555
adb connect 192.168.1.172:5555
```

**Sonuç:** Cihazlar ADB bağlantısını kabul etti ama "offline" statüsünde kaldı (yetkilendirme yok, developer mode kapalı).

### 4.3 Mevcut Durum Özeti

| Cihaz | Mevcut Ekran | APK ile Durum | Faktory Reset |
|-------|-------------|--------------|---------------|
| @B2A401A977 (172) | Fabrika QR banner | HTTP-SERVER olarak görünüyor | Kısmen - HTTP server yanıt vermiyor |
| @B2A301AB37 (160) | Önceki içerik kaldı | Eski ayarlar görünüyor | Başarısız |
| @B2A401A959 (161) | Fabrika QR + eski içerik | Eski MQTT ayarları görünüyor | Kısmen - konfigürasyon silinmedi |

---

## 5. Analiz ve Çıkarımlar

### 5.1 Bluetooth Factory Reset'in Sınırları

Bluetooth `Restore` komutu:
1. **Ekranı** fabrika varsayılan QR banner'ına döndürüyor (görsel sıfırlama) ✅
2. **Token/şifreyi** sıfırlıyor (yönetici şifresiyle gönderildiğinde) ✅
3. **Protokol konfigürasyonunu** (WiFi, sunucu URL'leri, MQTT ayarları) tam olarak sıfırlayıp sıfırlamadığı **belirsiz** ⚠️
4. **APK'lar eski konfigürasyonu** görmeye devam ediyor → konfigürasyon tam silinmemiş olabilir ❌

### 5.2 MQTT clear-config Potansiyeli

MQTT üzerinden `clear-config` komutu tam factory reset yapabilir, ancak:
- Cihaz MQTT broker'a bağlı olmalı
- Token değişikliği nedeniyle broker bağlantısı kopmuş olabilir
- Broker yeniden yapılandırılmalı

### 5.3 Üreticiye Sorulması Gerekenler

1. Bluetooth `Restore` komutu WiFi, sunucu URL, protokol gibi konfigürasyonları da sıfırlıyor mu?
2. MQTT `clear-config` ile Bluetooth `Restore` arasındaki fark nedir?
3. Donanımsal (fiziksel buton, ekran basma, pin) factory reset yöntemi var mı?
4. SuperAdmin şifresi veya master reset kodu kavramı var mı?
5. Token ayarlı bir cihaz hiçbir yöntemle sıfırlanamadığında ne yapılmalı?

---

## 6. Önerilen Çözüm Mimarisi

### 6.1 Token Yaşam Döngüsü Yönetimi

```
Token Oluştur → DB'ye Kaydet → Cihaza Gönder (BLE) → Şifrele (DB)
     ↓
Token ile İşlem Yap → Doğrula (DB'den decrypt) → Komut Gönder
     ↓
Factory Reset → Token ile Reset Komutu → DB'den Token Sil → Cihaz Temiz
     ↓
Yeniden Kurulum → Yeni Token Oluştur → Döngü Başa Döner
```

### 6.2 BluetoothWizard Entegrasyonu

Mevcut Omnex Display Hub BluetoothWizard'ına eklenen özellikler:
- **Token Yönetim Kartı:** Token ayarlama, değiştirme, silme
- **Factory Reset:** Token ile sıfırlama komutu gönderme + DB temizleme
- **Token Yedekleme:** Sıfırlama öncesi otomatik token yedekleme

---

## 7. Protokol Karşılaştırma Tablosu

| Özellik | HTTP-SERVER | HTTP (Pull) | MQTT |
|---------|------------|-------------|------|
| İletişim Yönü | Sunucu → Cihaz (Push) | Cihaz → Sunucu (Pull) | İki yönlü |
| Bağlantı | Doğrudan IP | Periyodik Polling | Broker üzerinden |
| İçerik Gönderimi | `/upload` + `/replay` | Content server response | `updatelabel` / `updatelabelbydata` |
| Factory Reset API | ❌ Yok | ❌ Yok | ✅ `clear-config` |
| Cihaz Bilgisi | `/Iotags` GET | `reportinfo` POST | `pushdeviceinfo` |
| Kaynak Temizleme | `/clear` GET | ❌ Yok | `clear-res` |
| Güvenlik | AppID + MD5 Sign | AppID + MD5 Sign | AppID + MD5 Sign |
| BLE ile Reset | ✅ `Restore` komutu | ✅ `Restore` komutu | ✅ `Restore` komutu |

---

*Bu döküman Omnex Display Hub geliştirme ekibi tarafından hazırlanmıştır.*
*Son güncelleme: 2026-03-16*


---
---
---


# PavoDisplay ESL 平板 - 令牌管理与恢复出厂设置指南

**日期：** 2026年3月16日
**项目：** Omnex Display Hub
**目标设备：** PavoDisplay 10.1英寸 Android ESL 平板 (PD1010-II)

---

## 1. 概述

本文档涵盖 PavoDisplay ESL 平板设备中令牌（密码）安全系统和恢复出厂设置（Factory Reset）操作在三种不同通信协议（HTTP-SERVER、HTTP Pull、MQTT）下的工作方式、测试过程和结果。

### 测试设备

| 蓝牙名称 | MAC 地址 | IP 地址 | 协议 | 状态 |
|----------|---------|---------|------|------|
| @B2A401A977 | 20:51:F5:4F:50:7F | 192.168.1.172 | HTTP-SERVER | 已设置令牌 |
| @B2A301AB37 | 20:51:F5:4F:50:59 | 192.168.1.160 | HTTP (Pull) | 已设置令牌 |
| @B2A401A959 | 20:51:F5:4F:50:0A | 192.168.1.161 | MQTT | 已设置令牌 |

---

## 2. 令牌（密码）安全系统

### 2.1 密码层次

PavoDisplay 设备通过蓝牙支持两级密码：

| 密码类型 | 蓝牙命令 | 说明 |
|---------|---------|------|
| **管理员密码** (Admin/Root) | `passwd-root` | 最高权限。修改需要原管理员密码验证 |
| **用户密码** (User) | `passwd-user` | 普通权限。可通过管理员密码或原用户密码修改 |

### 2.2 密码验证矩阵

| 管理员密码 | 用户密码 | 命令发送行为 |
|-----------|---------|------------|
| 未设置 | 未设置 | 无需密码验证，`"Token":""` 即可执行 |
| 未设置 | 已设置 | 需要用户密码：`"Token":"user_pass"` |
| 已设置 | 未设置 | 无需密码验证（修改管理员密码除外） |
| 已设置 | 已设置 | 两者均可接受：`"Token":"admin_pass"` 或 `"Token":"user_pass"` |

### 2.3 密码设置命令（蓝牙）

```
// 首次设置管理员密码（Token 为空）
+SET-DEVICE:{"passwd-root":{"passwd":"root111"},"Token":""}

// 修改管理员密码（用旧密码验证）
+SET-DEVICE:{"passwd-root":{"passwd":"root222"},"Token":"root111"}

// 首次设置用户密码（Token 为空）
+SET-DEVICE:{"passwd-user":{"passwd":"user333"},"Token":""}

// 修改用户密码（用旧用户密码或管理员密码）
+SET-DEVICE:{"passwd-user":{"passwd":"user444"},"Token":"user333"}
+SET-DEVICE:{"passwd-user":{"passwd":"user444"},"Token":"root111"}
```

### 2.4 API 级安全性（HTTP/MQTT）

WiFi API 接口使用 **MD5 签名验证**（非蓝牙 Token）：
- 每个设备分配 `AppID` 和 `AppSecret`（32字节密钥）
- 签名算法：参数按 ASCII 排序 → `key1=value1&key2=value2...&key=AppSecret` → MD5 → 大写 = `sign`

---

## 3. 各协议恢复出厂设置方法

### 3.1 蓝牙恢复出厂设置（适用于所有协议）

```
+SET-DEVICE:{"Restore":0, "Token":"<当前密码>"}\r\n
```

**成功响应：** `+DONE`
**密码错误：** `Token error`

**密码重置行为：**
- 使用**管理员密码**恢复：清除管理员密码和用户密码
- 使用**用户密码**恢复：仅清除用户密码，管理员密码保留

### 3.2 MQTT 恢复出厂设置

```json
{
  "action": "clear-config",
  "push_id": 0,
  "clientid": "设备序列号"
}
```

**前提条件：** 设备必须连接到 MQTT Broker 并订阅了正确的 topic

### 3.3 HTTP Pull 协议

**重要：** HTTP Pull 协议中**没有**恢复出厂设置命令。只能通过蓝牙 BLE 进行重置。

### 3.4 HTTP-SERVER 协议

**重要：** HTTP-SERVER 协议中也**没有**文档记载的恢复出厂设置 API。只能通过蓝牙 BLE 进行重置。

### 3.5 硬件重置

**制造商文档中未提及任何硬件重置方法**（物理按钮、针孔、屏幕按压组合）。所有重置操作均基于软件。

---

## 4. 测试与结果

### 4.1 测试场景

**初始状态：** 3台设备在本地（local）环境中通过令牌配置并添加到 Omnex Display Hub 项目中。三种协议均正常工作。

**问题：** 项目部署到服务器后，尝试将设备添加到服务器环境时，由于令牌不在服务器数据库中，无法执行任何操作。

**制造商 APK 测试：** PriceTag 和 PriceTag Setup APK 通过蓝牙连接测试。由于设备已设置令牌，APK 也无法访问 - **安全系统正常工作。**

### 4.2 恢复出厂设置尝试

| 设备 | 协议 | BLE 响应 | 观察到的变化 | 完全重置？ |
|------|------|---------|------------|----------|
| @B2A401A959 | MQTT | `+DONE` | 出厂 QR 横幅出现 | ❌ 否 - APK 显示旧协议 |
| @B2A401A977 | HTTP-SERVER | `AT+ECHO=0` | 出厂 QR 横幅出现 | ⚠️ 不确定 |
| @B2A301AB37 | HTTP Pull | BLE 扫描未发现 | 无变化 | ❌ 重置失败 |

### 4.3 当前状态总结

所有设备在蓝牙 `Restore` 命令后出现了出厂 QR 横幅界面变化，但通过 APK 检查时仍显示旧配置，表明**配置未完全清除**。

---

## 5. 需要向制造商确认的问题

1. 蓝牙 `Restore` 命令是否也会重置 WiFi、服务器 URL、协议等配置？
2. MQTT `clear-config` 与蓝牙 `Restore` 之间有何区别？
3. 是否存在硬件恢复出厂设置方法（物理按钮、屏幕按压、针孔）？
4. 是否存在超级管理员密码或主重置代码？
5. 当令牌设置的设备无法通过任何方式重置时，应如何处理？

---

## 6. 协议对比表

| 功能 | HTTP-SERVER | HTTP (Pull) | MQTT |
|------|------------|-------------|------|
| 通信方向 | 服务器→设备 (Push) | 设备→服务器 (Pull) | 双向 |
| 连接方式 | 直接 IP | 定期轮询 | 通过 Broker |
| 恢复出厂 API | ❌ 无 | ❌ 无 | ✅ `clear-config` |
| 设备信息 | `/Iotags` GET | `reportinfo` POST | `pushdeviceinfo` |
| BLE 重置 | ✅ `Restore` 命令 | ✅ `Restore` 命令 | ✅ `Restore` 命令 |

---

*本文档由 Omnex Display Hub 开发团队编写。*
*最后更新：2026年3月16日*
