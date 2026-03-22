# Üreticiye Gönderilecek Mesaj / Message to Manufacturer / 致制造商的消息

---

## 🇹🇷 TÜRKÇE

### Konu: PavoDisplay ESL Tablet - Token Güvenlik Sistemi ve Factory Reset Sorunu

Sayın PavoDisplay Teknik Destek Ekibi,

Biz Omnex Display Hub projesini geliştiren bir yazılım ekibiyiz. PavoDisplay 10.1" ESL tablet cihazlarınızı (PD1010-II modeli) elektronik raf etiketi ve dijital tabela yönetim platformumuza entegre ettik.

#### Elimizdeki Cihazlar ve Kurulum

Elimizdeki 3 adet PavoDisplay cihazı, dökümanlarınızda belirtilen Token (passwd-root / passwd-user) güvenlik yapılandırması ile kurulmuştur. Her biri farklı bir iletişim protokolünde çalışmaktadır:

| Cihaz | Protokol | IP |
|-------|----------|-----|
| @B2A401A977 | HTTP-SERVER | 192.168.1.172 |
| @B2A301AB37 | HTTP (Pull) | 192.168.1.160 |
| @B2A401A959 | MQTT | 192.168.1.161 |

#### Başarılı Çalışma Süreci

Yerel (local) geliştirme ortamımızda her üç protokolde de cihazlar sorunsuz çalışmaktaydı:
- HTTP-SERVER: Doğrudan IP üzerinden dosya yükleme ve ekran güncelleme
- HTTP Pull: İçerik sunucusundan periyodik çekme
- MQTT: Broker üzerinden iki yönlü iletişim

Token güvenliği başarıyla uygulandı ve cihazlar güvenli bir şekilde yönetilmekteydi.

#### Karşılaşılan Sorun

Projemizi sunucuya deploy ettikten sonra bu cihazları sunucu ortamına eklemek istediğimizde, token bilgileri sunucu veritabanında bulunmadığı için hiçbir işlem yapamadık. **Güvenlik sisteminiz doğru şekilde çalıştı** - yetkisiz erişim engellendi.

PriceTag ve PriceTag Setup APK'larınız ile de Bluetooth üzerinden cihazlara erişmeye çalıştık ancak tokenlar ayarlandığı için APK'lar da bağlantıyı reddetti. Bu da güvenliğin doğru çalıştığını teyit etti.

#### Factory Reset Denemeleri

Dökümanlarınızdaki yöntemlerle yerel veritabanımızdaki kayıtlı tokenları kullanarak factory reset denedik:

**1. Bluetooth BLE ile:**
```
+SET-DEVICE:{"Restore":0, "Token":"<kayıtlı_token>"}\r\n
```
- MQTT cihazı (@B2A401A959): `+DONE` yanıtı aldı, ekranda fabrika QR banner'ı göründü
- HTTP-SERVER cihazı (@B2A401A977): `AT+ECHO=0` yanıtı aldı, ekranda kısmi değişiklik
- HTTP Pull cihazı (@B2A301AB37): BLE taramada bulunamadı

**2. MQTT üzerinden:**
```json
{"action": "clear-config", "push_id": 0, "clientid": "..."}
```
Cihaz broker'a bağlı olmadığı için mesaj iletilemedi.

#### Sorunun Özeti

Bluetooth `Restore` komutu sonrasında cihazlarda görsel değişiklikler gözlemlendi (fabrika QR banner'ı geldi) ancak PriceTag Setup APK'nızla kontrol edildiğinde **eski protokol konfigürasyonları hâlâ görünmektedir**. Bu durum, `Restore` komutunun WiFi ayarları, sunucu URL'leri ve protokol seçimi gibi konfigürasyonları tam olarak sıfırlamadığını düşündürmektedir.

#### Sorularımız

1. **Bluetooth `Restore` komutu** WiFi, sunucu URL, protokol, AppID/AppSecret gibi tüm konfigürasyonları da sıfırlıyor mu, yoksa sadece ekran içeriğini ve token/şifreyi mi sıfırlıyor?

2. **MQTT `clear-config`** ile Bluetooth `Restore` arasında kapsam farkı var mıdır? `clear-config` daha kapsamlı bir sıfırlama yapıyor mu?

3. **Donanımsal factory reset** yöntemi var mıdır? Örneğin:
   - Ekranda belirli bir noktaya uzun basma
   - Fiziksel buton/pin deliği kombinasyonu
   - Güç tuşu + belirli bir zamanlama ile sıfırlama

4. **SuperAdmin / Master Reset kodu** kavramı var mıdır? Token ile korunan bir cihazı kesin olarak sıfırlamak için kullanılabilecek bir üst düzey kod?

5. Token ayarlı bir cihaz **hiçbir yöntemle sıfırlanamadığında** önerilen prosedür nedir?

6. **HTTP Pull** ve **HTTP-SERVER** protokollerinde ağ üzerinden (Bluetooth dışında) factory reset komutu göndermek mümkün müdür? Dökümanlarınızda bu protokoller için factory reset API'si bulamadık.

#### Bizim İçin Önemi

Bu cihazların kurulumu ve olası sorun durumlarında yeniden yapılandırılabilmesi platformumuz için kritik öneme sahiptir. Token güvenliğini hem güvenli bir şekilde uygulayabilmeli, hem de gerektiğinde cihazları tutarlı bir şekilde sıfırlayarak yeniden kurabilmeliyiz. Bu iki ihtiyaç arasında dengeli bir yönetim mekanizması oluşturmak istiyoruz.

Detaylı teknik dökümanımızı ekte paylaşıyoruz.

Yanıtınız için şimdiden teşekkür ederiz.

Saygılarımızla,
Omnex Display Hub Geliştirme Ekibi

---

## 🇬🇧 ENGLISH

### Subject: PavoDisplay ESL Tablet - Token Security System & Factory Reset Issue

Dear PavoDisplay Technical Support Team,

We are a software development team building **Omnex Display Hub**, an electronic shelf label (ESL) and digital signage management platform. We have integrated your PavoDisplay 10.1" ESL tablet devices (model PD1010-II) into our platform.

#### Our Devices and Setup

We configured 3 PavoDisplay devices with the Token security system (passwd-root / passwd-user) as described in your documentation. Each device operates on a different communication protocol:

| Device | Protocol | IP |
|--------|----------|-----|
| @B2A401A977 | HTTP-SERVER | 192.168.1.172 |
| @B2A301AB37 | HTTP (Pull) | 192.168.1.160 |
| @B2A401A959 | MQTT | 192.168.1.161 |

#### Successful Operation

In our local development environment, all three devices worked flawlessly across all protocols:
- HTTP-SERVER: Direct IP file upload and screen update
- HTTP Pull: Periodic content fetching from content server
- MQTT: Bidirectional communication via broker

Token security was successfully implemented and devices were securely managed.

#### The Problem

After deploying our project to a production server, we attempted to add these devices to the server environment. Since the token information was not in the server database, no operations could be performed. **Your security system worked correctly** — unauthorized access was blocked.

We also tried accessing the devices via Bluetooth using your PriceTag and PriceTag Setup APKs, but because tokens were already set, the APKs also rejected the connection. This confirmed that the security is working as designed.

#### Factory Reset Attempts

Using the tokens stored in our local database, we attempted factory reset using the methods described in your documentation:

**1. Via Bluetooth BLE:**
```
+SET-DEVICE:{"Restore":0, "Token":"<stored_token>"}\r\n
```
- MQTT device (@B2A401A959): Received `+DONE` response, factory QR banner appeared on screen
- HTTP-SERVER device (@B2A401A977): Received `AT+ECHO=0` response, partial screen change
- HTTP Pull device (@B2A301AB37): Not found during BLE scan

**2. Via MQTT:**
```json
{"action": "clear-config", "push_id": 0, "clientid": "..."}
```
Message could not be delivered as the device was not connected to the MQTT broker.

#### Summary of the Issue

After the Bluetooth `Restore` command, we observed visual changes on the devices (factory QR banner appeared). However, when checking with your PriceTag Setup APK, **the old protocol configurations were still visible**. This suggests that the `Restore` command may not fully clear configurations such as WiFi settings, server URLs, and protocol selection.

#### Our Questions

1. **Does the Bluetooth `Restore` command** reset ALL configurations (WiFi, server URLs, protocol, AppID/AppSecret), or does it only reset screen content and token/password?

2. **Is there a scope difference** between MQTT `clear-config` and Bluetooth `Restore`? Does `clear-config` perform a more comprehensive reset?

3. **Is there a hardware factory reset method?** For example:
   - Long-press on a specific screen area
   - Physical button / pinhole combination
   - Power button + specific timing sequence for reset

4. **Is there a SuperAdmin / Master Reset code** that can definitively reset a token-protected device?

5. What is the **recommended procedure** when a token-protected device cannot be reset by any available method?

6. Is it possible to send a factory reset command **over the network** (without Bluetooth) for **HTTP Pull** and **HTTP-SERVER** protocols? We could not find a factory reset API for these protocols in your documentation.

#### Why This Matters

The ability to set up these devices and reconfigure them in case of issues is critical for our platform. We need to be able to **both securely apply token security AND reliably reset devices** when necessary. We want to establish a balanced management mechanism between these two requirements.

We are attaching our detailed technical documentation for your reference.

Thank you in advance for your response.

Best regards,
Omnex Display Hub Development Team

---

## 🇨🇳 中文

### 主题：PavoDisplay ESL 平板 - 令牌安全系统与恢复出厂设置问题

尊敬的 PavoDisplay 技术支持团队：

我们是 **Omnex Display Hub** 的软件开发团队，正在构建一个电子货架标签（ESL）和数字标牌管理平台。我们已将贵公司的 PavoDisplay 10.1英寸 ESL 平板设备（型号 PD1010-II）集成到我们的平台中。

#### 我们的设备与配置

我们按照贵公司文档中描述的令牌安全系统（passwd-root / passwd-user）配置了3台 PavoDisplay 设备。每台设备运行在不同的通信协议上：

| 设备 | 协议 | IP |
|------|------|-----|
| @B2A401A977 | HTTP-SERVER | 192.168.1.172 |
| @B2A301AB37 | HTTP (Pull) | 192.168.1.160 |
| @B2A401A959 | MQTT | 192.168.1.161 |

#### 成功运行阶段

在我们的本地开发环境中，所有三台设备在各自协议下均正常运行：
- HTTP-SERVER：通过直接 IP 进行文件上传和屏幕更新
- HTTP Pull：从内容服务器定期拉取内容
- MQTT：通过 Broker 进行双向通信

令牌安全功能已成功实施，设备在安全管理下正常运行。

#### 遇到的问题

将项目部署到生产服务器后，我们尝试将这些设备添加到服务器环境中。由于令牌信息不在服务器数据库中，无法执行任何操作。**贵公司的安全系统正确运行** — 未授权访问被成功阻止。

我们还尝试通过蓝牙使用贵公司的 PriceTag 和 PriceTag Setup APK 访问设备，但由于令牌已设置，APK 也拒绝了连接。这再次确认了安全机制运行正常。

#### 恢复出厂设置尝试

使用存储在本地数据库中的令牌，我们按照贵公司文档中描述的方法尝试了恢复出厂设置：

**1. 通过蓝牙 BLE：**
```
+SET-DEVICE:{"Restore":0, "Token":"<已存储的令牌>"}\r\n
```
- MQTT 设备（@B2A401A959）：收到 `+DONE` 响应，屏幕出现出厂 QR 横幅
- HTTP-SERVER 设备（@B2A401A977）：收到 `AT+ECHO=0` 响应，屏幕部分变化
- HTTP Pull 设备（@B2A301AB37）：BLE 扫描中未发现

**2. 通过 MQTT：**
```json
{"action": "clear-config", "push_id": 0, "clientid": "..."}
```
由于设备未连接到 MQTT Broker，消息无法送达。

#### 问题总结

蓝牙 `Restore` 命令执行后，我们观察到设备上的视觉变化（出现了出厂 QR 横幅）。但是，使用贵公司的 PriceTag Setup APK 检查时，**旧的协议配置仍然可见**。这表明 `Restore` 命令可能没有完全清除 WiFi 设置、服务器 URL 和协议选择等配置。

#### 我们的问题

1. **蓝牙 `Restore` 命令**是否会重置所有配置（WiFi、服务器 URL、协议、AppID/AppSecret），还是仅重置屏幕内容和令牌/密码？

2. MQTT `clear-config` 与蓝牙 `Restore` 之间**是否存在范围差异**？`clear-config` 是否执行更全面的重置？

3. **是否存在硬件恢复出厂设置方法？** 例如：
   - 长按屏幕特定区域
   - 物理按钮/针孔组合
   - 电源键 + 特定时间序列重置

4. **是否存在超级管理员/主重置代码**，可以确定性地重置受令牌保护的设备？

5. 当受令牌保护的设备**无法通过任何可用方法重置时**，建议的处理步骤是什么？

6. 对于 **HTTP Pull** 和 **HTTP-SERVER** 协议，是否可以**通过网络**（不使用蓝牙）发送恢复出厂设置命令？我们在贵公司文档中未找到这些协议的恢复出厂设置 API。

#### 重要性说明

设备的安装和在出现问题时的重新配置能力对我们的平台至关重要。我们需要能够**既安全地应用令牌安全，又能在必要时可靠地重置设备**。我们希望在这两个需求之间建立平衡的管理机制。

随信附上我们的详细技术文档供参考。

提前感谢您的回复。

此致敬礼，
Omnex Display Hub 开发团队

---

*文档附件：PAVO_TOKEN_FACTORY_RESET_GUIDE.md（包含完整测试记录和协议对比）*
