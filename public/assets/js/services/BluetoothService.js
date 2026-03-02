/**
 * PavoDisplay Bluetooth Service
 * Web Bluetooth API kullanarak ESL cihazlarıyla BLE iletişimi
 *
 * @version 2.1.0 — Serial Queue + GATT Retry + Await WriteValue
 * @author Omnex Display Hub
 */
console.log('%c[BLE] BluetoothService v2.1 (Queue+Retry) yüklendi', 'color: #00bcd4; font-weight: bold');

export class BluetoothService {
    constructor() {
        this.device = null;
        this.server = null;
        this.writeCharacteristic = null;
        this.notifyCharacteristic = null;
        this.connected = false;
        this.responseCallbacks = [];

        // ── Seri komut kuyruğu (GATT çakışmasını önler) ──
        this._commandQueue = [];
        this._isProcessingQueue = false;
        this._abortController = null; // Kuyruk iptal mekanizması

        // PavoDisplay BLE UUIDs (cihazdan alınmalı)
        this.SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
        this.WRITE_CHARACTERISTIC_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
        this.NOTIFY_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
    }

    /**
     * Web Bluetooth API desteğini kontrol et
     */
    isSupported() {
        return 'bluetooth' in navigator;
    }

    /**
     * PavoDisplay cihazlarını tara ve seç
     * @param {boolean} showAll - true ise tüm BLE cihazları gösterilir
     * @returns {Promise<BluetoothDevice>}
     */
    async scan(showAll = false) {
        if (!this.isSupported()) {
            throw new Error('Tarayıcınız Bluetooth desteklemiyor');
        }

        try {
            const requestOptions = showAll
                ? {
                    acceptAllDevices: true,
                    optionalServices: [this.SERVICE_UUID, 'battery_service']
                }
                : {
                    filters: [
                        { namePrefix: '@' },
                        { namePrefix: 'PavoDisplay' },
                        { namePrefix: 'ESL_' }
                    ],
                    optionalServices: [this.SERVICE_UUID, 'battery_service']
                };

            this.device = await navigator.bluetooth.requestDevice(requestOptions);

            return this.device;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                throw new Error('Cihaz bulunamadı veya seçim iptal edildi');
            }
            throw error;
        }
    }

    /**
     * Seçilen cihaza bağlan
     * @returns {Promise<boolean>}
     */
    async connect() {
        if (!this.device) {
            throw new Error('Önce cihaz taraması yapın');
        }

        try {
            // GATT Server'a bağlan
            this.server = await this.device.gatt.connect();

            // Primary Service'i al
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);

            // Write Characteristic'i al
            this.writeCharacteristic = await service.getCharacteristic(this.WRITE_CHARACTERISTIC_UUID);

            // Notify Characteristic'i al ve dinlemeye başla
            this.notifyCharacteristic = await service.getCharacteristic(this.NOTIFY_CHARACTERISTIC_UUID);
            await this.notifyCharacteristic.startNotifications();
            this.notifyCharacteristic.addEventListener('characteristicvaluechanged',
                this.handleNotification.bind(this));

            this.connected = true;

            // Bağlantı koptuğunda
            this.device.addEventListener('gattserverdisconnected', () => {
                this.connected = false;
                // Bekleyen komutları iptal et (reboot sonrası bağlantı koptuğunda)
                this._drainQueue('GATT bağlantı koptu');
                this._isProcessingQueue = false;
            });

            return true;
        } catch (error) {
            console.error('Bağlantı hatası:', error);
            this.connected = false;
            throw error;
        }
    }

    /**
     * Bağlantıyı kes
     */
    disconnect() {
        // Bekleyen komutları iptal et
        this._drainQueue('Bağlantı kesildi');
        this._isProcessingQueue = false;

        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.connected = false;
        this.device = null;
        this.server = null;
        this.writeCharacteristic = null;
        this.notifyCharacteristic = null;
    }

    /**
     * Notify yanıtlarını işle
     * @param {Event} event
     */
    handleNotification(event) {
        const decoder = new TextDecoder();
        const value = decoder.decode(event.target.value);
        console.log(`%c[BLE-Q] ◀ NOTIFICATION: ${value.substring(0, 100)}`, 'color: #e91e63',
            `(callback sayısı: ${this.responseCallbacks.length})`);

        // Bekleyen callback'leri çağır
        this.responseCallbacks.forEach(cb => cb(value));
        this.responseCallbacks = [];
    }

    /**
     * Komut gönder ve yanıt bekle (kuyruk tabanlı — GATT çakışmasını önler)
     * Tüm BLE yazmaları sırayla yapılır, eşzamanlı writeValue() çağrısı engellenir.
     * @param {string} command
     * @param {number} timeout
     * @returns {Promise<string>}
     */
    async sendCommand(command, timeout = 5000) {
        if (!this.connected || !this.writeCharacteristic) {
            throw new Error('Cihaza bağlı değil');
        }

        const cmdShort = command.length > 60 ? command.substring(0, 60) + '...' : command;
        console.log(`%c[BLE-Q] sendCommand → kuyruğa ekleniyor: ${cmdShort}`, 'color: #2196f3',
            `(kuyruk: ${this._commandQueue.length}, işleniyor: ${this._isProcessingQueue})`);

        // Kuyruğa ekle ve sırasını bekle
        return new Promise((resolve, reject) => {
            this._commandQueue.push({ command, timeout, resolve, reject });
            this._processQueue();
        });
    }

    /**
     * Kuyruktan sıradaki komutu gönder (tek seferde bir komut)
     * @private
     */
    async _processQueue() {
        if (this._isProcessingQueue) {
            console.log(`%c[BLE-Q] _processQueue → SKIP (başka komut işleniyor)`, 'color: #ff9800');
            return;
        }
        if (this._commandQueue.length === 0) {
            return;
        }

        this._isProcessingQueue = true;
        const { command, timeout, resolve, reject } = this._commandQueue.shift();
        const cmdShort = command.length > 60 ? command.substring(0, 60) + '...' : command;

        console.log(`%c[BLE-Q] ▶ İŞLENİYOR: ${cmdShort}`, 'color: #4caf50; font-weight: bold',
            `(kalan kuyruk: ${this._commandQueue.length})`);

        try {
            const result = await this._sendCommandDirect(command, timeout);
            console.log(`%c[BLE-Q] ✓ BAŞARILI: ${cmdShort}`, 'color: #4caf50');
            resolve(result);
        } catch (err) {
            console.log(`%c[BLE-Q] ✗ HATA: ${cmdShort} → ${err.message}`, 'color: #f44336');
            reject(err);
        } finally {
            this._isProcessingQueue = false;
            // Kuyrukte başka komut varsa devam et
            if (this._commandQueue.length > 0) {
                console.log(`%c[BLE-Q] Kuyrukta ${this._commandQueue.length} komut bekliyor, 250ms sonra devam...`, 'color: #ff9800');
                setTimeout(() => this._processQueue(), 250);
            }
        }
    }

    /**
     * Doğrudan BLE yazma — GATT meşgulse otomatik retry
     * writeValue() tamamlanmasını açıkça bekler, sonra notification yanıtını bekler
     * @param {string} command
     * @param {number} timeout
     * @param {number} _retryCount - dahili retry sayacı
     * @returns {Promise<string>}
     * @private
     */
    async _sendCommandDirect(command, timeout, _retryCount = 0) {
        const MAX_RETRIES = 3;
        const cmdShort = command.length > 60 ? command.substring(0, 60) + '...' : command;

        // 1) writeValue — GATT meşgulse retry
        const encoder = new TextEncoder();
        const fullCommand = command.endsWith('\r\n') ? command : command + '\r\n';
        const data = encoder.encode(fullCommand);

        try {
            console.log(`%c[BLE-Q] → writeValue: ${cmdShort}`, 'color: #607d8b',
                _retryCount > 0 ? `(retry ${_retryCount}/${MAX_RETRIES})` : '');
            await this.writeCharacteristic.writeValue(data);
            console.log(`%c[BLE-Q] → writeValue tamamlandı ✓`, 'color: #607d8b');
        } catch (writeErr) {
            // GATT meşgul — retry
            if (writeErr.message && writeErr.message.includes('GATT operation already in progress') && _retryCount < MAX_RETRIES) {
                const delay = 500 * (_retryCount + 1); // 500ms, 1000ms, 1500ms
                console.log(`%c[BLE-Q] ⚠ GATT meşgul, ${delay}ms sonra tekrar denenecek (${_retryCount + 1}/${MAX_RETRIES})`, 'color: #ff9800; font-weight: bold');
                await new Promise(r => setTimeout(r, delay));
                return this._sendCommandDirect(command, timeout, _retryCount + 1);
            }
            console.log(`%c[BLE-Q] → writeValue HATA: ${writeErr.message}`, 'color: #f44336; font-weight: bold');
            throw writeErr;
        }

        // 2) Notification yanıtını bekle
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                console.log(`%c[BLE-Q] ⏱ TIMEOUT: ${cmdShort}`, 'color: #ff5722');
                this.responseCallbacks = [];
                reject(new Error('Komut zaman aşımı'));
            }, timeout);

            // Önceki callback'leri temizle
            this.responseCallbacks = [];

            this.responseCallbacks.push((response) => {
                clearTimeout(timeoutId);
                console.log(`%c[BLE-Q] ← YANIT: ${response.substring(0, 80)}`, 'color: #9c27b0');
                if (response.includes('+DONE')) {
                    resolve(response);
                } else if (response.includes('+ERROR')) {
                    reject(new Error(response));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Kuyruktaki tüm bekleyen komutları iptal et
     * @param {string} reason - İptal nedeni
     */
    /**
     * Kuyruktaki tüm bekleyen komutları iptal et ve mevcut komutun bitmesini bekle
     * @param {string} reason - İptal nedeni
     * @returns {Promise<void>} - Mevcut komut bittiğinde resolve olur
     */
    async cancelPendingCommands(reason = 'İptal edildi') {
        console.log(`%c[BLE-Q] cancelPendingCommands: ${reason} (kuyrukta ${this._commandQueue.length}, işleniyor: ${this._isProcessingQueue})`, 'color: #ff5722; font-weight: bold');
        // WiFi tarama döngüsünü de kes
        this._wifiScanCancelled = true;
        this._drainQueue(reason);

        // Eğer şu an bir komut işleniyorsa, bitmesini bekle
        if (this._isProcessingQueue) {
            console.log(`%c[BLE-Q] Mevcut komutun bitmesi bekleniyor...`, 'color: #ff9800');
            await this._waitForCurrentCommand();
            console.log(`%c[BLE-Q] Mevcut komut bitti, kuyruk temiz`, 'color: #4caf50');
        }
    }

    /**
     * Şu an işlenen komutun bitmesini bekle (polling)
     * @returns {Promise<void>}
     * @private
     */
    _waitForCurrentCommand() {
        return new Promise((resolve) => {
            const check = () => {
                if (!this._isProcessingQueue) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            // Max 12sn bekle (10s command timeout + buffer)
            const maxWait = setTimeout(() => {
                console.log(`%c[BLE-Q] _waitForCurrentCommand: max süre aşıldı, devam ediliyor`, 'color: #f44336');
                resolve();
            }, 12000);
            const originalCheck = check;
            const wrappedCheck = () => {
                if (!this._isProcessingQueue) {
                    clearTimeout(maxWait);
                    resolve();
                } else {
                    setTimeout(wrappedCheck, 50);
                }
            };
            wrappedCheck();
        });
    }

    /**
     * Kuyruğu boşalt ve tüm bekleyen komutları hata ile sonlandır
     * @param {string} reason
     * @private
     */
    _drainQueue(reason) {
        let count = 0;
        while (this._commandQueue.length > 0) {
            const { reject } = this._commandQueue.shift();
            reject(new Error(reason));
            count++;
        }
        if (count > 0) {
            console.log(`%c[BLE-Q] ${count} komut kuyruktan temizlendi`, 'color: #ff5722');
        }
    }

    // ==================== WiFi Komutları ====================

    /**
     * WiFi ayarlarını yapılandır
     * @param {string} ssid
     * @param {string} password
     * @param {string} token - Cihaz şifresi (varsa)
     */
    async setWifi(ssid, password, token = '') {
        const command = `+SET-DEVICE:{"WIFI":{"ssid":"${ssid}","passwd":"${password}"}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * WPA2-Enterprise WiFi ayarlarını yapılandır
     * @param {string} ssid
     * @param {string} identity
     * @param {string} password
     * @param {string} token
     */
    async setWifiEnterprise(ssid, identity, password, token = '') {
        const command = `+SET-DEVICE:{"WIFI_Ent":{"ssid":"${ssid}","identity":"${identity}","passwd":"${password}"}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Statik IP ayarla
     * @param {string} ip
     * @param {string} gateway
     * @param {string} netmask
     * @param {string} token
     */
    async setStaticIp(ip, gateway, netmask, token = '') {
        const command = `+SET-DEVICE:{"network":{"static-ip":"${ip}","gateway":"${gateway}","Netmask":"${netmask}"}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * DHCP modunu etkinleştir
     * @param {string} token
     */
    async setDhcp(token = '') {
        const command = `+SET-DEVICE:{"network":{"static-ip":"","gateway":"","Netmask":""}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    // ==================== Protokol Komutları ====================

    /**
     * İletişim protokolünü ayarla
     * @param {'HTTP'|'MQTT'|'HTTP-SERVER'} protocol
     * @param {string} token
     */
    async setProtocol(protocol, token = '') {
        const command = `+SET-DEVICE:{"Protocol":"${protocol}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Cihaz durum çubuklarını gizle/göster
     * Kexin PriceTag APK analizi: HTTP-SERVER geçişinde BottomStatusBar + TopBar gizleniyor
     * Bu komut cihazın "hazırlanıyor" durumuna geçmesini tetikler (reboot gerekmez)
     * @param {boolean} hideBottom - Alt durum çubuğunu gizle
     * @param {boolean|number} hideTop - Üst çubuğu gizle (1 veya true)
     * @param {string} token
     */
    async hideStatusBars(hideBottom = true, hideTop = 1, token = '') {
        const command = `+SET-DEVICE:{"force-hide":{"BottomStatusBar":${hideBottom},"TopBar":${hideTop}}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    // ==================== Donanım Komutları ====================

    /**
     * Ses ve parlaklık ayarla
     * @param {number} volume 0-100
     * @param {number} brightness 0-100
     * @param {string} token
     */
    async setHardware(volume, brightness, token = '') {
        const command = `+SET-DEVICE:{"Hardware":{"volume":${volume},"brightness":${brightness}}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    // ==================== Bilgi Okuma ====================

    /**
     * Cihaz bilgisi oku
     * @param {string} type - ip, mac, Protocol, wifi-ssid, etc.
     * @param {string} token
     */
    async getDeviceInfo(type, token = '', timeout = 5000) {
        const command = `+GET-DEVICE:{"types":"${type}", "Token":"${token}"}`;
        return await this.sendCommand(command, timeout);
    }

    /**
     * Cihazdan yakındaki WiFi ağlarını okumayı dener.
     * Firmware sürümüne göre farklı yanıt formatlarını normalize eder.
     * @param {string} token
     * @returns {Promise<string[]>}
     */
    async scanWifiNetworks(token = '') {
        this._wifiScanCancelled = false;
        const commands = [
            `+GET-DEVICE:{"types":"wifi-list", "Token":"${token}"}`,
            `+GET-DEVICE:{"types":"wifi_list", "Token":"${token}"}`,
            `+GET-DEVICE:{"types":"ssids", "Token":"${token}"}`,
            `+GET-DEVICE:{"types":"networks", "Token":"${token}"}`
        ];

        for (const command of commands) {
            // İptal kontrolü — cancelPendingCommands çağrıldıysa döngüden çık
            if (this._wifiScanCancelled) {
                console.log('%c[BLE-Q] WiFi tarama iptal edildi, döngüden çıkılıyor', 'color: #ff9800');
                return [];
            }
            try {
                const response = await this.sendCommand(command, 10000);
                const networks = this.normalizeWifiList(this.parseResponse(response, 'wifi-list'));
                if (networks.length > 0) {
                    return networks;
                }
            } catch (error) {
                // İptal hatası ise döngüden çık (yeni komut ekleme)
                if (this._wifiScanCancelled) {
                    console.log('%c[BLE-Q] WiFi tarama iptal hatası yakalandı, döngüden çıkılıyor', 'color: #ff9800');
                    return [];
                }
                // Diğer hatalar: bir sonraki komutu dene
            }
        }

        // İptal kontrolü
        if (this._wifiScanCancelled) return [];

        // Fallback: mevcut bağlı SSID
        try {
            const response = await this.getDeviceInfo('wifi-ssid', token);
            const currentSsid = this.parseResponse(response, 'wifi-ssid');
            const normalized = this.normalizeWifiList(currentSsid);
            if (normalized.length > 0) {
                return normalized;
            }
        } catch (error) {
            // Ignore fallback errors
        }

        return [];
    }

    /**
     * Tüm önemli bilgileri oku
     * @param {string} token
     */
    async getAllInfo(token = '', options = {}) {
        const defaultTypes = ['ip', 'mac', 'wifi-ssid', 'Protocol', 'app_version', 'lcd_screen_width', 'lcd_screen_height'];
        const types = Array.isArray(options?.types) && options.types.length > 0
            ? options.types
            : defaultTypes;
        const timeout = Number.isFinite(options?.timeoutMs) && options.timeoutMs > 0
            ? options.timeoutMs
            : 5000;
        const info = {};

        for (const type of types) {
            try {
                const response = await this.getDeviceInfo(type, token, timeout);
                info[type] = this.parseResponse(response, type);
            } catch (e) {
                info[type] = null;
            }
        }

        return info;
    }

    /**
     * Yanıtı parse et
     * @param {string} response
     * @param {string} key
     */
    parseResponse(response, key) {
        // +DONE:{"ip":"192.168.1.100"} ve benzeri formatları normalize eder
        const text = String(response ?? '').trim();
        if (!text) return null;

        // 1) Ham JSON ise direkt parse et
        const direct = this.safeJsonParse(text);
        if (direct !== null) {
            return this.extractFromParsedResponse(direct, key);
        }

        // 2) +DONE: payload parse
        const doneIndex = text.lastIndexOf('+DONE:');
        if (doneIndex >= 0) {
            const payload = text.substring(doneIndex + 6).trim();
            const parsedPayload = this.parsePayload(payload);
            if (parsedPayload !== null) {
                return this.extractFromParsedResponse(parsedPayload, key);
            }
        }

        // 3) Fallback: string içinde key:value regex extraction
        if (key) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const reQuoted = new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]*)"`, 'i');
            const reRaw = new RegExp(`"${escapedKey}"\\s*:\\s*([^,}\\]]+)`, 'i');

            const quotedMatch = text.match(reQuoted);
            if (quotedMatch) return quotedMatch[1].trim();

            const rawMatch = text.match(reRaw);
            if (rawMatch) {
                const rawValue = rawMatch[1].trim().replace(/^"|"$/g, '');
                if (rawValue && rawValue.toLowerCase() !== 'null' && rawValue.toLowerCase() !== 'undefined') {
                    return rawValue;
                }
            }
        }

        return text;
    }

    /**
     * Güvenli JSON parse
     * @param {string} text
     * @returns {any|null}
     */
    safeJsonParse(text) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    /**
     * +DONE payload parse
     * @param {string} payload
     * @returns {any|null}
     */
    parsePayload(payload) {
        if (!payload) return null;

        // First line often contains full payload
        const firstLine = payload.split(/\r?\n/).find(line => line.trim())?.trim() || '';
        const firstLineParsed = this.safeJsonParse(firstLine);
        if (firstLineParsed !== null) return firstLineParsed;

        // Try bracket-clipped object/array payload
        const objStart = payload.indexOf('{');
        const objEnd = payload.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
            const objText = payload.substring(objStart, objEnd + 1);
            const objParsed = this.safeJsonParse(objText);
            if (objParsed !== null) return objParsed;
        }

        const arrStart = payload.indexOf('[');
        const arrEnd = payload.lastIndexOf(']');
        if (arrStart >= 0 && arrEnd > arrStart) {
            const arrText = payload.substring(arrStart, arrEnd + 1);
            const arrParsed = this.safeJsonParse(arrText);
            if (arrParsed !== null) return arrParsed;
        }

        return null;
    }

    /**
     * Parse edilmiş yanıttan alanı çek
     * @param {any} data
     * @param {string} key
     * @returns {any}
     */
    extractFromParsedResponse(data, key) {
        if (data == null) return null;

        if (Array.isArray(data)) {
            return data;
        }

        if (typeof data !== 'object') {
            return data;
        }

        if (!key) return data;

        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }

        const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
        for (const candidate of Object.keys(data)) {
            const normalizedCandidate = String(candidate).toLowerCase().replace(/[-_]/g, '');
            if (normalizedCandidate === normalizedKey) {
                return data[candidate];
            }
        }

        const values = Object.values(data);
        if (values.length === 1) {
            return values[0];
        }

        return data;
    }

    // ==================== Kontrol Komutları ====================

    /**
     * Farklı firmware yanıtlarından SSID listesini normalize et
     * @param {unknown} raw
     * @returns {string[]}
     */
    normalizeWifiList(raw) {
        if (raw == null) return [];

        if (Array.isArray(raw)) {
            return this.normalizeWifiArray(raw);
        }

        if (typeof raw === 'string') {
            const split = raw
                .split(/[,\n;]+/)
                .map(item => item.trim())
                .filter(Boolean);
            return this.normalizeWifiArray(split);
        }

        if (typeof raw === 'object') {
            const data = raw;
            const keys = ['wifi-list', 'wifi_list', 'wifiList', 'ssids', 'ssid_list', 'networks'];

            for (const key of keys) {
                if (data[key] != null) {
                    return this.normalizeWifiList(data[key]);
                }
            }

            if (data.wifi != null) {
                return this.normalizeWifiList(data.wifi);
            }

            if (data.list != null) {
                return this.normalizeWifiList(data.list);
            }

            if (typeof data.ssid === 'string') {
                return this.normalizeWifiArray([data.ssid]);
            }
        }

        return [];
    }

    /**
     * SSID dizisini temizle ve tekilleştir
     * @param {unknown[]} list
     * @returns {string[]}
     */
    normalizeWifiArray(list) {
        const invalid = new Set(['', '-', 'n/a', 'null', 'undefined', 'unknown']);
        const unique = new Set();

        list.forEach(item => {
            let ssid = '';
            if (typeof item === 'string') {
                ssid = item.trim();
            } else if (item && typeof item === 'object') {
                ssid = String(item.ssid || item.name || item.SSID || '').trim();
            }

            if (!ssid) return;
            if (ssid.startsWith('"') && ssid.endsWith('"')) {
                ssid = ssid.slice(1, -1).trim();
            }

            const lower = ssid.toLowerCase();
            if (ssid.startsWith('{') || ssid.startsWith('[')) return;
            if (lower.includes('wifi-list') || lower.includes('wifi_list')) return;
            if (lower.includes('"null"') || lower.includes(':null')) return;

            if (!ssid || invalid.has(ssid.toLowerCase())) return;
            unique.add(ssid);
        });

        return Array.from(unique);
    }

    /**
     * Cihazı yeniden başlat
     * @param {string} token
     */
    async reboot(token = '') {
        const command = `+SET-DEVICE:{"reboot":1, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Medya dosyalarını temizle
     * @param {string} token
     */
    async clearMedia(token = '') {
        const command = `+SET-RES:{"action":"delete", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Fabrika ayarlarına sıfırla
     * @param {string} token
     */
    async factoryReset(token = '') {
        const command = `+SET-DEVICE:{"Restore":0, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    // ==================== MQTT Yapilandirma ====================

    /**
     * MQTT sunucu URL ayarla
     * Cihaz bu URL'e MQTT uzerinden baglanir
     * @param {string} url - MQTT broker URL (ornek: mqtt://broker.example.com:1883)
     * @param {string} token
     */
    async setMqttServer(url, token = '') {
        const command = `+SET-DEVICE:{"mqtt-url":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Remote server (icerik sunucusu) URL ayarla
     * Cihaz goruntulenecek icerikleri bu URL'den ceker
     * @param {string} url - Icerik sunucusu URL
     * @param {string} token
     */
    async setRemoteServer(url, token = '') {
        const command = `+SET-DEVICE:{"Remote-server":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Report server (durum raporu sunucusu) URL ayarla
     * Cihaz periyodik durum raporlarini bu URL'e gonderir
     * @param {string} url - Rapor sunucusu URL
     * @param {string} token
     */
    async setReportServer(url, token = '') {
        const command = `+SET-DEVICE:{"itemInfo-server":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * AppID ayarla (MQTT sign dogrulama icin)
     * @param {string} appId
     * @param {string} token
     */
    async setAppId(appId, token = '') {
        const command = `+SET-DEVICE:{"appid":"${appId}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * AppSecret ayarla (MQTT sign dogrulama icin)
     * @param {string} appSecret
     * @param {string} token
     */
    async setAppSecret(appSecret, token = '') {
        const command = `+SET-DEVICE:{"appsecret":"${appSecret}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * MQTT kayit (register) sunucusu URL ayarla
     * Cihaz ilk acilista bu URL'e POST ile kayit olur
     * PavoDisplay BLE komutu: +SET-DEVICE:{"mqtt-server":"url"}
     * @param {string} url - Kayit sunucu URL (ornek: http://server/api/esl/mqtt/register)
     * @param {string} token
     */
    async setMqttRegistrationServer(url, token = '') {
        const command = `+SET-DEVICE:{"mqtt-server":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * MQTT tum ayarlari tek seferde gonder
     * @param {Object} config
     * @param {string} config.mqttUrl - MQTT broker URL
     * @param {string} config.registrationServer - MQTT kayit sunucusu URL (mqtt-server)
     * @param {string} config.remoteServer - Icerik sunucusu URL
     * @param {string} config.reportServer - Rapor sunucusu URL
     * @param {string} config.appId - AppID
     * @param {string} config.appSecret - AppSecret
     * @param {string} token
     * @returns {Promise<Object>} Her komutun sonucu
     */
    async configureMqtt(config, token = '') {
        const results = {};

        // 1. Protokolu MQTT olarak ayarla
        try {
            results.protocol = await this.setProtocol('MQTT', token);
        } catch (e) {
            results.protocol = { error: e.message };
        }

        // 2. MQTT broker URL
        if (config.mqttUrl) {
            try {
                results.mqttUrl = await this.setMqttServer(config.mqttUrl, token);
            } catch (e) {
                results.mqttUrl = { error: e.message };
            }
        }

        // 2.5. MQTT kayit sunucusu (mqtt-server — cihaz register icin kullanir)
        if (config.registrationServer) {
            try {
                results.registrationServer = await this.setMqttRegistrationServer(config.registrationServer, token);
            } catch (e) {
                results.registrationServer = { error: e.message };
            }
        }

        // 3. Remote server (icerik)
        if (config.remoteServer) {
            try {
                results.remoteServer = await this.setRemoteServer(config.remoteServer, token);
            } catch (e) {
                results.remoteServer = { error: e.message };
            }
        }

        // 4. Report server (durum raporu)
        if (config.reportServer) {
            try {
                results.reportServer = await this.setReportServer(config.reportServer, token);
            } catch (e) {
                results.reportServer = { error: e.message };
            }
        }

        // 5. AppID
        if (config.appId) {
            try {
                results.appId = await this.setAppId(config.appId, token);
            } catch (e) {
                results.appId = { error: e.message };
            }
        }

        // 6. AppSecret
        if (config.appSecret) {
            try {
                results.appSecret = await this.setAppSecret(config.appSecret, token);
            } catch (e) {
                results.appSecret = { error: e.message };
            }
        }

        return results;
    }

    // ==================== Sorgu ve Panel Kontrol ====================

    /**
     * Sorgu döngüsü aralığını ayarla (cihaz bu aralıkta sunucuya bağlanır)
     * @param {number} seconds - Saniye cinsinden aralık
     * @param {string} token
     */
    async setQueryCycle(seconds, token = '') {
        const command = `+SET-DEVICE:{"Query-cycle":"${seconds}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Info server URL ayarla (cihaz bilgi/kayıt sunucusu)
     * @param {string} url
     * @param {string} token
     */
    async setInfoServer(url, token = '') {
        const command = `+SET-DEVICE:{"info-server":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Application bilgilerini tek komutla ayarla (AppID + AppSecret)
     * @param {string} appId
     * @param {string} appSecret
     * @param {string} token
     */
    async setApplication(appId, appSecret, token = '') {
        const command = `+SET-DEVICE:{"Application":{"AppID":"${appId}","AppSecret":"${appSecret}"}, "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Cihaz ekran panellerini gizle/göster
     * @param {Object} panels
     * @param {number} [panels.BottomStatusBar] - 0=gizle, 1=göster
     * @param {number} [panels.TopMessageBar] - 0=gizle, 1=göster
     * @param {number} [panels.SystemStatusPanel] - 0=gizle, 1=göster
     * @param {number} [panels.DeviceQR] - 0=gizle, 1=göster
     * @param {string} token
     */
    async setPanelDisplay(panels, token = '') {
        const payload = { "Token": token };
        if (panels.BottomStatusBar !== undefined) payload["force-hide"] = { "BottomStatusBar": panels.BottomStatusBar };
        if (panels.TopMessageBar !== undefined) payload["TopMessageBar"] = panels.TopMessageBar;
        if (panels.SystemStatusPanel !== undefined) payload["SystemStatusPanel"] = panels.SystemStatusPanel;
        if (panels.DeviceQR !== undefined) payload["DeviceQR"] = panels.DeviceQR;
        const command = `+SET-DEVICE:${JSON.stringify(payload)}`;
        return await this.sendCommand(command);
    }

    /**
     * Firmware güncelleme URL'si gönder
     * @param {string} url - Firmware dosya URL'si
     * @param {string} token
     */
    async setFirmwareUpgrade(url, token = '') {
        const command = `+SET-DEVICE:{"upgrade":"${url}", "Token":"${token}"}`;
        return await this.sendCommand(command);
    }

    // ==================== Birlesik Yapilandirma ====================

    /**
     * Birden fazla ayarı TEK bir SET-DEVICE komutuyla gönder.
     * APK'nın Person sınıflarından dinamik JSON oluşturma yaklaşımını taklit eder.
     * Kexin gibi bazı firmware'ler ayarları tek JSON'da bekleyebilir.
     *
     * @param {Object} config - Gönderilecek ayarlar
     * @param {Object} [config.wifi] - {ssid, passwd}
     * @param {string} [config.protocol] - HTTP-SERVER, HTTP, MQTT
     * @param {Object} [config.hardware] - {volume, brightness}
     * @param {Object} [config.network] - {static-ip, gateway, Netmask}
     * @param {Object} [config.application] - {AppID, AppSecret}
     * @param {string} [config.remoteServer]
     * @param {string} [config.infoServer]
     * @param {string} [config.itemInfoServer]
     * @param {string} [config.mqttServer]
     * @param {string} [config.mqttUrl]
     * @param {string} [config.queryCycle]
     * @param {string} [config.upgrade]
     * @param {Object} [config.panels] - force-hide, TopMessageBar, vb.
     * @param {string} [config.token]
     * @returns {Promise<string>}
     */
    async setCombinedConfig(config) {
        const payload = {};

        if (config.wifi) payload["WIFI"] = { "ssid": config.wifi.ssid, "passwd": config.wifi.passwd || config.wifi.password || '' };
        if (config.protocol) payload["Protocol"] = config.protocol;
        if (config.hardware) payload["Hardware"] = config.hardware;
        if (config.network) payload["network"] = config.network;
        if (config.application) payload["Application"] = config.application;
        if (config.remoteServer) payload["Remote-server"] = config.remoteServer;
        if (config.infoServer) payload["info-server"] = config.infoServer;
        if (config.itemInfoServer) payload["itemInfo-server"] = config.itemInfoServer;
        if (config.mqttServer) payload["mqtt-server"] = config.mqttServer;
        if (config.mqttUrl) payload["mqtt-url"] = config.mqttUrl;
        if (config.queryCycle) payload["Query-cycle"] = config.queryCycle;
        if (config.upgrade) payload["upgrade"] = config.upgrade;
        if (config.panels) {
            if (config.panels.BottomStatusBar !== undefined) payload["force-hide"] = { "BottomStatusBar": config.panels.BottomStatusBar };
            if (config.panels.TopMessageBar !== undefined) payload["TopMessageBar"] = config.panels.TopMessageBar;
            if (config.panels.SystemStatusPanel !== undefined) payload["SystemStatusPanel"] = config.panels.SystemStatusPanel;
            if (config.panels.DeviceQR !== undefined) payload["DeviceQR"] = config.panels.DeviceQR;
        }

        payload["Token"] = config.token || '';

        const command = `+SET-DEVICE:${JSON.stringify(payload)}`;
        return await this.sendCommand(command);
    }

    // ==================== Güvenlik ====================

    /**
     * Admin şifresi belirle
     * @param {string} password
     * @param {string} currentToken - Mevcut şifre (varsa)
     */
    async setAdminPassword(password, currentToken = '') {
        const command = `+SET-DEVICE:{"passwd-root":{"passwd":"${password}"},"Token":"${currentToken}"}`;
        return await this.sendCommand(command);
    }

    /**
     * Kullanıcı şifresi belirle
     * @param {string} password
     * @param {string} token
     */
    async setUserPassword(password, token = '') {
        const command = `+SET-DEVICE:{"passwd-user":{"passwd":"${password}"},"Token":"${token}"}`;
        return await this.sendCommand(command);
    }
}

// Singleton instance
export const bluetoothService = new BluetoothService();
export default BluetoothService;

