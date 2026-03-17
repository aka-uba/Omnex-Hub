/**
 * Bluetooth Wizard Module
 * PavoDisplay cihazlarını Bluetooth ile yapılandırma sihirbazı
 *
 * @module list/BluetoothWizard
 * @requires services/BluetoothService
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';
import { BluetoothService } from '../../../services/BluetoothService.js';

/**
 * Bluetooth Wizard Class
 */
export class BluetoothWizard {
    /**
     * @param {Object} context - Context objesi
     * @param {Object} context.app - App instance
     * @param {Function} context.__ - Translation helper
     * @param {Array} context.deviceGroups - Cihaz grupları listesi
     * @param {Function} context.onDeviceAdded - Cihaz eklendiğinde callback
     * @param {Function} context.refreshDevices - Cihaz listesini yenile callback
     */
    constructor(context) {
        if (!context.app) throw new Error('BluetoothWizard: app gerekli');

        this.app = context.app;
        this.__ = context.__ || ((key) => key);
        this.deviceGroups = context.deviceGroups || [];
        this.onDeviceAdded = context.onDeviceAdded || (() => {});
        this.refreshDevices = context.refreshDevices || (() => {});

        this.bluetoothService = new BluetoothService();
        this.modal = null;
        this.btDeviceInfo = null;
        this.btNormalizedDeviceInfo = null;
        this.savedWifiSsids = this._loadSavedWifiSsids();
        this.workflowState = this._createWorkflowState();
        this._selectedCommunicationMode = 'http-server';
        this._isKexinDevice = false;
        this._pendingWifiConfig = null;
        this._isReadingInfo = false;
        this._deviceToken = ''; // BT protection password (set during protocol step)
        // Keep false in normal flow; can be toggled for emergency field tests.
        this._tokenBypassMode = false;
        this._currentStep = 1;
        this._highestReachedStep = 1;
    }

    /**
     * Bluetooth wizard'ı göster
     */
    show() {
        this._resetWorkflowState();

        // Check if Bluetooth is supported
        if (!this.bluetoothService.isSupported()) {
            Toast.error(this.__('bluetooth.notSupported'));
            return;
        }

        const modalContent = this._renderModalContent();

        this.modal = Modal.show({
            title: this.__('bluetooth.title'),
            icon: 'ti-bluetooth',
            content: modalContent,
            size: 'lg',
            showFooter: true,
            showConfirm: false,
            cancelText: this.__('bluetooth.wizard.close'),
            onClose: () => {
                // Disconnect on modal close
                if (this.bluetoothService.connected) {
                    this.bluetoothService.disconnect();
                }
                this.modal = null;
            }
        });

        // Bind Bluetooth events
        setTimeout(() => this._bindEvents(), 100);
    }

    _createWorkflowState() {
        return {
            scanned: false,
            connected: false,
            wifiConfigured: false,
            protocolConfigured: false,
            verified: false
        };
    }

    _resetWorkflowState() {
        this.workflowState = this._createWorkflowState();
        this.btDeviceInfo = null;
        this.btNormalizedDeviceInfo = null;
        this._selectedCommunicationMode = 'http-server';
        this._mqttProtocolSelected = false;
        this._isKexinDevice = false;
        this._pendingWifiConfig = null;
        this._currentStep = 1;
        this._highestReachedStep = 1;
        this._deviceToken = '';
    }

    _isWorkflowReadyForDeviceAdd() {
        if (!this.workflowState.connected) {
            Toast.warning(this.__('bluetooth.wizard.connectionRequired'));
            return false;
        }

        if (!this.workflowState.wifiConfigured) {
            Toast.warning(this.__('bluetooth.wizard.wifiConfigRequired'));
            return false;
        }

        if (!this.workflowState.protocolConfigured) {
            Toast.warning(this.__('bluetooth.wizard.protocolRequired'));
            return false;
        }

        if (!this.workflowState.verified) {
            Toast.warning(this.__('bluetooth.wizard.verificationRequired'));
            return false;
        }

        return true;
    }

    _updateAddDeviceButtonState() {
        const addBtn = document.getElementById('bt-add-device-btn');
        if (!addBtn) return;

        const canAdd = this.workflowState.connected
            && this.workflowState.wifiConfigured
            && this.workflowState.protocolConfigured
            && this.workflowState.verified;

        addBtn.disabled = !canAdd;
        addBtn.title = canAdd
            ? ''
            : this.__('bluetooth.wizard.completeStepsTooltip');
    }

    /**
     * Bağlı cihazın markasını tespit et (PavoDisplay vs Kexin)
     * PavoDisplay: BLE adı @B ile başlar (örn: @B2A401A959)
     * Kexin: BLE adı @ ile başlar ama B yok (örn: @2309128946)
     * @returns {boolean} true ise Kexin cihazı
     * @private
     */
    _detectDeviceBrand() {
        const name = this.bluetoothService.device?.name || '';
        if (name.startsWith('@B')) {
            this._isKexinDevice = false;
        } else if (name.startsWith('@')) {
            this._isKexinDevice = true;
        } else {
            // Bilinmeyen prefix — PavoDisplay varsay (güvenli yol)
            this._isKexinDevice = false;
        }
        return this._isKexinDevice;
    }

    /**
     * Sistem base URL'ini hesapla (cihazın erişebileceği adres)
     * @returns {string}
     * @private
     */
    _getSystemBaseUrl() {
        const basePath = String(window.OmnexConfig?.basePath || '').replace(/\/+$/, '');
        return `${window.location.origin}${basePath}`;
    }

    /**
     * HTTP sunucu URL alanlarını otomatik doldur (tüm cihaz tipleri için)
     * localhost/127.0.0.1 ise uyarı gösterir
     * @private
     */
    _fillHttpServerUrls() {
        const baseUrl = this._getSystemBaseUrl();
        const remoteServerInput = document.getElementById('bt-kexin-remote-server');
        const infoServerInput = document.getElementById('bt-kexin-info-server');
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl);

        if (isLocalhost) {
            // localhost ise otomatik doldurma! Kullanıcı gerçek IP'yi elle girsin
            this._log('Sunucu adresi localhost - URL alanlarını sunucunuzun gerçek LAN IP adresi ile doldurun (ör: http://192.168.1.X/...)', 'error');
            // Alanları boş bırak, placeholder zaten örnek IP gösteriyor
        } else {
            // Gerçek IP ile otomatik doldur
            if (remoteServerInput && !remoteServerInput.value) {
                remoteServerInput.value = `${baseUrl}/api/esl/http/content`;
            }
            if (infoServerInput && !infoServerInput.value) {
                infoServerInput.value = `${baseUrl}/api/esl/http/report-info`;
            }
        }
    }

    /**
     * Kexin cihazı için protokol varsayılanlarını ayarla
     * HTTP-SERVER varsayılan (APK ile aynı davranış — cihaz port 80 açar, sunucu push yapar)
     * @private
     */
    _applyKexinProtocolDefaults() {
        const protocolSelect = document.getElementById('bt-protocol');
        if (!protocolSelect) return;

        // Kexin APK analizi: APK "Protocol":"HTTP-SERVER" gönderiyor
        // HTTP-SERVER = cihaz port 80 HTTP server çalıştırır, PavoDisplayGateway push ile görsel gönderir
        // HTTP = cihaz sunucuya periyodik bağlanır (PULL) — Remote-server/Query-cycle gerektirir
        // Kexin cihazlarında HTTP-SERVER varsayılan ve önerilen mod
        const httpServerOption = protocolSelect.querySelector('option[value="HTTP-SERVER"]');
        if (httpServerOption) {
            httpServerOption.textContent = (this.__('bluetooth.httpServer') || 'HTTP-SERVER') + ' ★ (Önerilen)';
        }

        // HTTP-SERVER'ı varsayılan yap (APK ile aynı)
        protocolSelect.value = 'HTTP-SERVER';

        // HTTP-SERVER modunda sunucu URL alanları gerekmez (push mode)
        // HTTP config bölümünü GİZLE
        const httpConfig = document.getElementById('bt-kexin-http-config');
        if (httpConfig) {
            httpConfig.style.display = 'none';
        }
    }

    /**
     * Generate cryptographically secure random password
     * @param {number} length - Password length
     * @returns {string}
     * @private
     */
    _generateSecurePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => chars[byte % chars.length]).join('');
    }

    /**
     * Cihaza BLE admin şifresi ayarla (güvenlik)
     * @private
     */
    async _setDevicePassword() {
        if (this._tokenBypassMode) {
            this._deviceToken = '';
            return;
        }
        const currentPassword = this._deviceToken || '';
        const newPassword = prompt(
            'Cihaz BLE şifresi belirleyin:\n(Bu şifre olmadan kimse Bluetooth ile bağlanamaz)\n\n'
            + (currentPassword ? `Mevcut şifre: ${currentPassword}` : 'Henüz şifre yok')
        );
        if (!newPassword || !newPassword.trim()) return;

        try {
            this._log('Admin şifresi ayarlanıyor...');
            await this.bluetoothService.setAdminPassword(newPassword.trim(), currentPassword);
            await new Promise(r => setTimeout(r, 300));
            await this.bluetoothService.setUserPassword(newPassword.trim(), newPassword.trim());
            this._deviceToken = newPassword.trim();
            this._log('Admin + User şifresi ayarlandı', 'success');
            Toast.success(this.__('bluetooth.toast.passwordSet'));

            // Token'ı DB'ye de kaydet
            try {
                const existing = await this._resolveKnownDeviceForToken();
                if (existing?.id) {
                    await this.app.api.post(`/devices/${existing.id}/bt-password`, {
                        password: this._deviceToken
                    });
                    this._log(this.__('bluetooth.tokenManagement.tokenSavedToDb'), 'success');
                }
            } catch (dbErr) {
                this._log(`DB token kayıt hatası: ${dbErr.message}`, 'error');
            }
            this._updateTokenStatusUI();
        } catch (error) {
            this._log(`Şifre ayarlanamadı: ${error.message}`, 'error');
            Toast.error(error.message);
        }
    }

    /**
     * Modal içeriğini render et
     * @private
     */
    _renderModalContent() {
        return `
            <div id="bluetooth-container">
                <!-- Steps indicator (clickable for back navigation) -->
                <div class="bluetooth-steps">
                    <div class="bt-step active" data-step="1">
                        <span class="bt-step-num"><span>1</span></span>
                        <span class="bt-step-label">${this.__('bluetooth.steps.scan')}</span>
                    </div>
                    <div class="bt-step" data-step="2">
                        <span class="bt-step-num"><span>2</span></span>
                        <span class="bt-step-label">${this.__('bluetooth.steps.connect')}</span>
                    </div>
                    <div class="bt-step" data-step="3">
                        <span class="bt-step-num"><span>3</span></span>
                        <span class="bt-step-label">${this.__('bluetooth.steps.wifi')}</span>
                    </div>
                    <div class="bt-step" data-step="4">
                        <span class="bt-step-num"><span>4</span></span>
                        <span class="bt-step-label">${this.__('bluetooth.steps.protocol')}</span>
                    </div>
                    <div class="bt-step" data-step="5">
                        <span class="bt-step-num"><span>5</span></span>
                        <span class="bt-step-label">${this.__('bluetooth.steps.verify')}</span>
                    </div>
                </div>

                <!-- Connection status -->
                <div id="bt-connection-status" class="alert alert-secondary" style="margin-bottom: 1rem;">
                    <i class="ti ti-bluetooth-off"></i>
                    <span>${this.__('bluetooth.disconnected')}</span>
                </div>

                <!-- Step 1: Scan -->
                <div id="bt-step-1" class="bt-step-content">
                    <p class="form-hint" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('bluetooth.hints.scan')}
                    </p>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" id="bt-scan-btn" class="btn btn-primary" style="flex: 1;">
                            <i class="ti ti-bluetooth"></i>
                            ${this.__('bluetooth.scan')}
                        </button>
                        <button type="button" id="bt-scan-all-btn" class="btn btn-outline" title="${this.__('bluetooth.scanAll')}">
                            <i class="ti ti-list-search"></i>
                            ${this.__('bluetooth.scanAll')}
                        </button>
                    </div>
                    <div id="bt-device-info" style="display: none; margin-top: 1rem;">
                        <div class="alert alert-info">
                            <i class="ti ti-device-tablet"></i>
                            <div>
                                <strong id="bt-device-name">-</strong>
                                <p id="bt-device-id" style="font-size: 0.875rem; opacity: 0.8;">-</p>
                            </div>
                        </div>
                        <button type="button" id="bt-connect-btn" class="btn btn-success btn-block" style="margin-top: 0.5rem;">
                            <i class="ti ti-plug"></i>
                            ${this.__('bluetooth.connect')}
                        </button>
                    </div>
                </div>

                <!-- Step 2: WiFi Configuration -->
                <div id="bt-step-2" class="bt-step-content" style="display: none;">
                    <p class="form-hint" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('bluetooth.hints.wifi')}
                    </p>
                    <div class="form-group">
                        <label class="form-label">${this.__('bluetooth.wifiSsid')}</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="bt-wifi-ssid-select" class="form-select" style="flex: 1;">
                                <option value="">${this.__('bluetooth.wizard.selectWifi')}</option>
                            </select>
                            <button type="button" id="bt-scan-wifi-btn" class="btn btn-outline" style="white-space: nowrap;">
                                <i class="ti ti-refresh"></i>
                                ${this.__('bluetooth.wizard.scanNetwork')}
                            </button>
                        </div>
                        <input type="text" id="bt-wifi-ssid" class="form-input" placeholder="${this.__('bluetooth.wizard.manualSsid')}" style="margin-top: 0.5rem;">
                        <small class="form-hint">${this.__('bluetooth.wizard.manualSsidHint')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('bluetooth.wifiPassword')}</label>
                        <div style="position: relative;">
                            <input type="password" id="bt-wifi-password" class="form-input" placeholder="••••••••">
                            <button type="button" id="bt-toggle-password" class="btn btn-ghost" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); padding: 0.25rem;">
                                <i class="ti ti-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('bluetooth.wizard.ipConfiguration')}</label>
                        <select id="bt-ip-mode" class="form-select">
                            <option value="dhcp" selected>${this.__('bluetooth.wizard.dhcpAuto')}</option>
                            <option value="static">${this.__('bluetooth.useStaticIp')}</option>
                        </select>
                        <small class="form-hint">${this.__('bluetooth.wizard.staticIpHint')}</small>
                    </div>
                    <div id="bt-static-ip-fields" style="display: none;">
                        <div class="form-group">
                            <label class="form-label">${this.__('bluetooth.staticIp')}</label>
                            <input type="text" id="bt-static-ip" class="form-input" placeholder="192.168.1.100">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">${this.__('bluetooth.gateway')}</label>
                                <input type="text" id="bt-gateway" class="form-input" placeholder="192.168.1.1">
                            </div>
                            <div class="form-group">
                                <label class="form-label">${this.__('bluetooth.netmask')}</label>
                                <input type="text" id="bt-netmask" class="form-input" placeholder="255.255.255.0" value="255.255.255.0">
                            </div>
                        </div>
                    </div>
                    <button type="button" id="bt-save-wifi-btn" class="btn btn-primary btn-block">
                        <i class="ti ti-wifi"></i>
                        ${this.__('bluetooth.configureWifi')}
                    </button>
                </div>

                <!-- Step 3: Protocol Selection -->
                <div id="bt-step-3" class="bt-step-content" style="display: none;">
                    <p class="form-hint" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('bluetooth.hints.protocol')}
                    </p>
                    <div class="form-group">
                        <label class="form-label">${this.__('bluetooth.protocol')}</label>
                        <select id="bt-protocol" class="form-select">
                            <option value="HTTP-SERVER" selected>${this.__('bluetooth.httpServer')}</option>
                            <option value="HTTP">${this.__('bluetooth.http')}</option>
                            <option value="MQTT">${this.__('bluetooth.mqtt')}</option>
                        </select>
                    </div>

                    <!-- MQTT Configuration Fields (shown when MQTT selected) -->
                    <div id="bt-mqtt-config" style="display: none;">
                        <div class="alert alert-info" style="margin-bottom: 0.75rem; font-size: 0.8125rem;">
                            <i class="ti ti-info-circle"></i>
                            <span>${this.__('bluetooth.mqttConfigHint') || 'MQTT modunda cihaz broker uzerinden iletisim kurar. Gateway PC gerekmez.'}</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('bluetooth.mqttServerUrl') || 'MQTT Broker URL'}</label>
                            <input type="text" id="bt-mqtt-url" class="form-input" placeholder="mqtt://broker.example.com:1883">
                            <small class="form-hint">${this.__('bluetooth.mqttServerUrlHint') || 'MQTT broker adresi (ornek: mqtt://192.168.1.100:1883)'}</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('bluetooth.mqttRegisterServer') || 'Kayit Sunucusu URL'}</label>
                            <input type="text" id="bt-mqtt-register-server" class="form-input"
                                   placeholder="http://sunucu.com/api/esl/mqtt/register" readonly
                                   style="background: var(--color-bg-secondary); opacity: 0.8;">
                            <small class="form-hint">${this.__('bluetooth.mqttRegisterServerHint') || 'Cihaz bu adrese kayit olur (otomatik olusturulur)'}</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('bluetooth.mqttRemoteServer') || 'Icerik Sunucusu URL'}</label>
                            <input type="text" id="bt-mqtt-remote-server" class="form-input" placeholder="http://sunucu.com/api/esl/mqtt/content">
                            <small class="form-hint">${this.__('bluetooth.mqttRemoteServerHint') || 'Cihaz goruntulenecek icerikleri bu adres uzerinden alir'}</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('bluetooth.mqttReportServer') || 'Rapor Sunucusu URL'}</label>
                            <input type="text" id="bt-mqtt-report-server" class="form-input" placeholder="http://sunucu.com/api/esl/mqtt/report">
                            <small class="form-hint">${this.__('bluetooth.mqttReportServerHint') || 'Cihaz durum raporlarini bu adrese gonderir'}</small>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">${this.__('bluetooth.appId') || 'AppID'}</label>
                                <input type="text" id="bt-mqtt-app-id" class="form-input" placeholder="omnex_abc123">
                            </div>
                            <div class="form-group">
                                <label class="form-label">${this.__('bluetooth.appSecret') || 'AppSecret'}</label>
                                <input type="password" id="bt-mqtt-app-secret" class="form-input" placeholder="••••••••">
                            </div>
                        </div>
                        <button type="button" id="bt-load-mqtt-settings-btn" class="btn btn-outline btn-sm" style="margin-bottom: 0.75rem;">
                            <i class="ti ti-download"></i>
                            ${this.__('bluetooth.loadMqttSettings') || 'Sunucu ayarlarini yukle'}
                        </button>
                    </div>

                    <!-- HTTP Client Configuration (shown when HTTP selected - all device types) -->
                    <div id="bt-kexin-http-config" style="display: none;">
                        <div class="alert alert-info" style="margin-bottom: 0.75rem; font-size: 0.8125rem;">
                            <i class="ti ti-info-circle"></i>
                            <span>HTTP modunda cihaz sunucunuza periyodik olarak bağlanarak içerik çeker (PULL). <strong>Sunucunuzun LAN IP adresini kullanın (ör: 192.168.1.x). localhost/127.0.0.1 cihazdan erişilemez!</strong></span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">İçerik Sunucusu (Remote-server)</label>
                            <input type="text" id="bt-kexin-remote-server" class="form-input" placeholder="http://192.168.1.100/market-etiket-sistemi/api/esl/http/content">
                            <small class="form-hint">Cihaz görselleri bu adresten çeker (PULL)</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kayıt Sunucusu (info-server)</label>
                            <input type="text" id="bt-kexin-info-server" class="form-input" placeholder="http://192.168.1.100/market-etiket-sistemi/api/esl/http/report-info">
                            <small class="form-hint">Cihaz açılışta bu adrese kendini kaydeder</small>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">Yoklama Aralığı (sn)</label>
                                <input type="number" id="bt-kexin-query-cycle" class="form-input" value="30" min="5" max="3600">
                                <small class="form-hint">Sunucuyu kontrol sıklığı</small>
                            </div>
                        </div>
                    </div>

                    <button type="button" id="bt-set-protocol-btn" class="btn btn-primary btn-block">
                        <i class="ti ti-settings"></i>
                        ${this.__('bluetooth.setProtocol')}
                    </button>
                </div>

                <!-- Step 4: Verify & Additional Settings -->
                <div id="bt-step-4" class="bt-step-content" style="display: none;">
                    <p class="form-hint" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('bluetooth.hints.verify')}
                    </p>

                    <div id="bt-device-details" class="card" style="margin-bottom: 1rem; padding: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ti ti-device-tablet"></i>
                            ${this.__('bluetooth.deviceInfo')}
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.875rem;">
                            <div><strong>${this.__('bluetooth.ipAddress')}:</strong> <span id="bt-info-ip">-</span></div>
                            <div><strong>${this.__('bluetooth.macAddress')}:</strong> <span id="bt-info-mac">-</span></div>
                            <div><strong>${this.__('bluetooth.currentProtocol')}:</strong> <span id="bt-info-protocol">-</span></div>
                            <div><strong>${this.__('bluetooth.screenSize')}:</strong> <span id="bt-info-screen">-</span></div>
                        </div>
                        <button type="button" id="bt-read-info-btn" class="btn btn-outline btn-sm" style="margin-top: 0.75rem;">
                            <i class="ti ti-refresh"></i>
                            ${this.__('bluetooth.readInfo')}
                        </button>
                    </div>

                    <!-- Hardware Settings -->
                    <div class="card" style="margin-bottom: 1rem; padding: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ti ti-adjustments"></i>
                            ${this.__('bluetooth.hardware')}
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label class="form-label">${this.__('bluetooth.volume')}</label>
                                <input type="range" id="bt-volume" class="form-range" min="0" max="100" value="100">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label class="form-label">${this.__('bluetooth.brightness')}</label>
                                <input type="range" id="bt-brightness" class="form-range" min="0" max="100" value="100">
                            </div>
                        </div>
                        <button type="button" id="bt-save-hardware-btn" class="btn btn-outline btn-sm" style="margin-top: 0.75rem;">
                            <i class="ti ti-device-floppy"></i>
                            ${this.__('modal.save')}
                        </button>
                    </div>

                    <!-- Token Management -->
                    <div class="card" style="margin-bottom: 1rem; padding: 1rem;">
                        <h4 style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ti ti-shield-lock"></i>
                            ${this.__('bluetooth.tokenManagement.title')}
                        </h4>
                        <div style="margin-bottom: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="font-size: 0.8125rem; font-weight: 500;">${this.__('bluetooth.tokenManagement.status')}:</span>
                                <span id="bt-token-status">
                                    <span class="badge badge-secondary" style="font-size: 0.75rem;">
                                        <i class="ti ti-loader"></i> ${this.__('bluetooth.tokenManagement.checking')}
                                    </span>
                                </span>
                            </div>
                            <p class="form-hint" style="font-size: 0.75rem; margin: 0;">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('bluetooth.tokenManagement.description')}
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button type="button" id="bt-view-token-btn" class="btn btn-outline btn-sm">
                                <i class="ti ti-eye"></i>
                                ${this.__('bluetooth.tokenManagement.viewToken')}
                            </button>
                            <button type="button" id="bt-set-password-btn" class="btn btn-outline btn-sm">
                                <i class="ti ti-lock"></i>
                                ${this.__('bluetooth.tokenManagement.setToken')}
                            </button>
                            <button type="button" id="bt-clear-token-btn" class="btn btn-outline btn-sm text-warning">
                                <i class="ti ti-lock-open"></i>
                                ${this.__('bluetooth.tokenManagement.clearToken')}
                            </button>
                        </div>
                    </div>

                    <!-- Control Buttons -->
                    <div class="card" style="padding: 1rem;">
                        <h4 style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ti ti-tool"></i>
                            ${this.__('bluetooth.wizard.control')}
                        </h4>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button type="button" id="bt-reboot-btn" class="btn btn-outline btn-sm">
                                <i class="ti ti-refresh"></i>
                                ${this.__('bluetooth.reboot')}
                            </button>
                            <button type="button" id="bt-clear-media-btn" class="btn btn-outline btn-sm">
                                <i class="ti ti-trash"></i>
                                ${this.__('bluetooth.clearMedia')}
                            </button>
                            <button type="button" id="bt-factory-reset-btn" class="btn btn-outline btn-sm text-danger">
                                <i class="ti ti-restore"></i>
                                ${this.__('bluetooth.factoryReset')}
                            </button>
                        </div>
                    </div>

                    <!-- Add to System Button -->
                    <button type="button" id="bt-add-device-btn" class="btn btn-success btn-block" style="margin-top: 1rem;">
                        <i class="ti ti-plus"></i>
                        ${this.__('addDevice')}
                    </button>
                </div>

                <!-- Log output -->
                <div id="bt-log" style="margin-top: 1rem; max-height: 100px; overflow-y: auto; font-family: monospace; font-size: 0.75rem; background: var(--bg-secondary); padding: 0.5rem; border-radius: 4px; display: none;">
                </div>
            </div>

            <style>
                .bluetooth-steps {
                    display: flex;
                    gap: 0.25rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .bt-step {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    background: var(--bg-secondary);
                    font-size: 0.75rem;
                    opacity: 0.5;
                    transition: all 0.2s;
                    user-select: none;
                }
                .bt-step.active {
                    background: var(--color-primary);
                    color: white;
                    opacity: 1;
                }
                .bt-step.completed {
                    background: var(--color-success);
                    color: white;
                    opacity: 1;
                    cursor: pointer;
                }
                .bt-step.completed:hover {
                    filter: brightness(1.1);
                    transform: translateY(-1px);
                }
                .bt-step.reachable {
                    cursor: pointer;
                    opacity: 0.7;
                }
                .bt-step.reachable:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .bt-step-num {
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    font-weight: 600;
                }
                .bt-step.completed .bt-step-num::after {
                    content: '✓';
                    font-size: 10px;
                }
                .bt-step.completed .bt-step-num span {
                    display: none;
                }
                .bt-step-label {
                    display: none;
                }
                @media (min-width: 480px) {
                    .bt-step-label {
                        display: inline;
                    }
                }
                .form-range {
                    width: 100%;
                    height: 8px;
                    border-radius: 4px;
                    background: var(--bg-secondary);
                    outline: none;
                    -webkit-appearance: none;
                }
                .form-range::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: var(--color-primary);
                    cursor: pointer;
                }
            </style>
        `;
    }

    /**
     * Event listener'ları bağla
     * @private
     */
    _bindEvents() {
        // Step tab click navigation (back to completed/reachable steps)
        document.querySelectorAll('.bt-step[data-step]').forEach(el => {
            el.addEventListener('click', () => {
                const targetStep = parseInt(el.dataset.step, 10);
                if (!isNaN(targetStep)) {
                    this._navigateToStep(targetStep);
                }
            });
        });

        // Scan button (filtered)
        document.getElementById('bt-scan-btn')?.addEventListener('click', () => this._scanDevice(false));

        // Scan all button (show all BLE devices)
        document.getElementById('bt-scan-all-btn')?.addEventListener('click', () => this._scanDevice(true));

        // Connect button
        document.getElementById('bt-connect-btn')?.addEventListener('click', () => this._connect());

        // WiFi toggle password visibility
        document.getElementById('bt-toggle-password')?.addEventListener('click', () => {
            const input = document.getElementById('bt-wifi-password');
            const icon = document.querySelector('#bt-toggle-password i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'ti ti-eye-off';
            } else {
                input.type = 'password';
                icon.className = 'ti ti-eye';
            }
        });

        // WiFi scan and selection
        document.getElementById('bt-scan-wifi-btn')?.addEventListener('click', () => this._scanWifiNetworks());
        document.getElementById('bt-wifi-ssid-select')?.addEventListener('change', (e) => {
            const ssidInput = document.getElementById('bt-wifi-ssid');
            if (ssidInput && e.target.value) {
                ssidInput.value = e.target.value;
            }
        });

        // Static IP mode toggle
        document.getElementById('bt-ip-mode')?.addEventListener('change', (e) => {
            const isStatic = e.target.value === 'static';
            document.getElementById('bt-static-ip-fields').style.display = isStatic ? 'block' : 'none';
            if (isStatic) {
                this._ensureStaticIpDefaults();
            }
        });

        // Keep gateway in sync when IP changes manually
        document.getElementById('bt-static-ip')?.addEventListener('blur', () => this._ensureStaticIpDefaults());

        // Save WiFi button
        document.getElementById('bt-save-wifi-btn')?.addEventListener('click', () => this._saveWifi());

        // Protocol change handler - show/hide MQTT config and HTTP config
        document.getElementById('bt-protocol')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const mqttConfig = document.getElementById('bt-mqtt-config');
            const httpConfig = document.getElementById('bt-kexin-http-config');
            if (mqttConfig) {
                mqttConfig.style.display = val === 'MQTT' ? 'block' : 'none';
            }
            // HTTP config bölümünü sadece HTTP (PULL) modunda göster
            // HTTP-SERVER modunda sunucu URL'leri gerekmez (push mode — PavoDisplayGateway kullanır)
            if (httpConfig) {
                httpConfig.style.display = val === 'HTTP' ? 'block' : 'none';
                // URL alanlarını otomatik doldur
                if (val === 'HTTP') {
                    this._fillHttpServerUrls();
                }
            }
        });

        // Load MQTT settings from server
        document.getElementById('bt-load-mqtt-settings-btn')?.addEventListener('click', () => this._loadMqttSettings());

        // Set Protocol button
        document.getElementById('bt-set-protocol-btn')?.addEventListener('click', () => this._setProtocol());

        // Read Info button
        document.getElementById('bt-read-info-btn')?.addEventListener('click', () => this._readInfo());

        // Save Hardware button
        document.getElementById('bt-save-hardware-btn')?.addEventListener('click', () => this._saveHardware());

        // Control buttons
        document.getElementById('bt-reboot-btn')?.addEventListener('click', () => this._reboot());
        document.getElementById('bt-clear-media-btn')?.addEventListener('click', () => this._clearMedia());
        document.getElementById('bt-factory-reset-btn')?.addEventListener('click', () => this._factoryReset());

        // Token management buttons
        document.getElementById('bt-set-password-btn')?.addEventListener('click', () => this._setDevicePassword());
        document.getElementById('bt-view-token-btn')?.addEventListener('click', () => this._viewToken());
        document.getElementById('bt-clear-token-btn')?.addEventListener('click', () => this._clearDeviceToken());

        // Add device button
        document.getElementById('bt-add-device-btn')?.addEventListener('click', () => this._addDevice());

        // Initial WiFi options (cached list + previously used SSID)
        this._updateWifiNetworkOptions(this.savedWifiSsids);
        this._updateAddDeviceButtonState();
    }

    /**
     * Son kullanılan SSID listesini localStorage'dan oku
     * @private
     */
    _loadSavedWifiSsids() {
        try {
            const raw = localStorage.getItem('omnex_bt_wifi_ssids');
            const parsed = raw ? JSON.parse(raw) : [];
            const invalid = new Set(['null', 'undefined', '-', 'n/a', 'unknown']);
            return Array.isArray(parsed)
                ? parsed.filter(item => {
                    if (typeof item !== 'string') return false;
                    const value = item.trim();
                    if (!value) return false;
                    return !invalid.has(value.toLowerCase());
                })
                : [];
        } catch {
            return [];
        }
    }

    _isValidSsidValue(value) {
        const text = String(value || '').trim();
        if (!text) return false;

        const lower = text.toLowerCase();
        const invalid = new Set(['null', 'undefined', '-', 'n/a', 'unknown']);
        if (invalid.has(lower)) return false;

        // Filter malformed values like {"wifi-list":"null"} or array dumps
        if (text.startsWith('{') || text.startsWith('[')) return false;
        if (lower.includes('wifi-list') || lower.includes('wifi_list')) return false;
        if (lower.includes('"null"') || lower.includes(':null')) return false;

        return true;
    }

    /**
     * Kullanılan SSID bilgisini önbelleğe al
     * @param {string} ssid
     * @private
     */
    _rememberWifiSsid(ssid) {
        const value = (ssid || '').trim();
        if (!this._isValidSsidValue(value)) return;

        const merged = [value, ...this.savedWifiSsids.filter(item => item !== value)].slice(0, 15);
        this.savedWifiSsids = merged;
        localStorage.setItem('omnex_bt_wifi_ssids', JSON.stringify(merged));
    }

    /**
     * WiFi seçici listesini güncelle
     * @param {string[]} networks
     * @private
     */
    _updateWifiNetworkOptions(networks = []) {
        const select = document.getElementById('bt-wifi-ssid-select');
        if (!select) return;

        const currentInput = document.getElementById('bt-wifi-ssid')?.value?.trim() || '';
        const currentWifi = this.btDeviceInfo?.['wifi-ssid'] || '';
        const merged = [];
        const seen = new Set();

        [...networks, ...this.savedWifiSsids, currentWifi].forEach(item => {
            const value = String(item || '').trim();
            if (!this._isValidSsidValue(value)) return;
            if (seen.has(value)) return;
            seen.add(value);
            merged.push(value);
        });

        const emptyLabel = merged.length > 0
            ? this.__('bluetooth.wizard.selectWifi')
            : this.__('bluetooth.wizard.noNetworkList');
        select.innerHTML = `<option value="">${emptyLabel}</option>`;
        merged.forEach(ssid => {
            const option = document.createElement('option');
            option.value = ssid;
            option.textContent = ssid;
            select.appendChild(option);
        });

        if (currentInput && seen.has(currentInput)) {
            select.value = currentInput;
        }
    }

    /**
     * Cihazdan WiFi ağlarını tara ve listele
     * @private
     */
    async _scanWifiNetworks(allowRetry = true) {
        const btn = document.getElementById('bt-scan-wifi-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${this.__('bluetooth.wizard.scanning')}`;
        }

        try {
            if (!this._tokenBypassMode) {
                await this._loadDeviceTokenFromServer();
            }
            this._log(this.__('bluetooth.wizard.scanningNetworks'));
            const scanned = await this.bluetoothService.scanWifiNetworks(this._deviceToken);
            const networks = Array.isArray(scanned) ? scanned : [];
            this._updateWifiNetworkOptions(networks);

            if (networks.length > 0) {
                const ssidInput = document.getElementById('bt-wifi-ssid');
                if (ssidInput && !ssidInput.value.trim()) {
                    ssidInput.value = networks[0];
                }
                this._log(this.__('bluetooth.wizard.networksListed', { count: networks.length }), 'success');
            } else {
                this._log(this.__('bluetooth.wizard.scanEmptyInfo'), 'info');
                Toast.warning(this.__('bluetooth.wizard.scanEmptyWarning'));
            }
        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._scanWifiNetworks(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._scanWifiNetworks(false);
                }
            }
            this._log(this.__('bluetooth.wizard.scanError', { error: error.message }), 'error');
            Toast.warning(this.__('bluetooth.wizard.scanFailedWarning'));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-refresh"></i> ${this.__('bluetooth.wizard.scanNetwork')}`;
            }
        }
    }

    _getMqttApiBaseUrl() {
        const basePath = String(window.OmnexConfig?.basePath || '').replace(/\/+$/, '');
        return `${window.location.origin}${basePath}/api/esl/mqtt`;
    }

    _buildMqttEndpointUrl(endpoint) {
        const safeEndpoint = String(endpoint || '').replace(/^\/+/, '');
        return `${this._getMqttApiBaseUrl()}/${safeEndpoint}`;
    }

    /**
     * Statik IP alanları için varsayılan değerleri doldur
     * @private
     */
    _ensureStaticIpDefaults() {
        const ipInput = document.getElementById('bt-static-ip');
        const gatewayInput = document.getElementById('bt-gateway');
        const netmaskInput = document.getElementById('bt-netmask');

        if (!ipInput || !gatewayInput || !netmaskInput) return;
        if (!netmaskInput.value.trim()) {
            netmaskInput.value = '255.255.255.0';
        }

        const ip = ipInput.value.trim();
        if (!this._isValidIpAddress(ip)) return;

        const octets = ip.split('.');
        const expectedGateway = `${octets[0]}.${octets[1]}.${octets[2]}.1`;
        if (!gatewayInput.value.trim()) {
            gatewayInput.value = expectedGateway;
        }
    }

    /**
     * Basit IPv4 doğrulama
     * @param {string} ip
     * @returns {boolean}
     * @private
     */
    _isValidIpAddress(ip) {
        const value = String(ip || '').trim();
        const match = value.match(/^(\d{1,3}\.){3}\d{1,3}$/);
        if (!match) return false;
        return value.split('.').every(part => {
            const octet = Number(part);
            return Number.isInteger(octet) && octet >= 0 && octet <= 255;
        });
    }

    _isValidMacAddress(mac) {
        const value = String(mac || '').trim();
        if (!value) return false;
        const normalized = value.includes(':')
            ? value
            : value.match(/^[0-9A-Fa-f]{12}$/) ? value.match(/.{1,2}/g).join(':') : value;
        return /^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(normalized);
    }

    _extractByKeyFromText(text, preferredKey) {
        if (!preferredKey) return '';

        const escapedKey = preferredKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re1 = new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]*)"`, 'i');
        const re2 = new RegExp(`'${escapedKey}'\\s*:\\s*'([^']*)'`, 'i');
        const re3 = new RegExp(`"${escapedKey}"\\s*:\\s*([^,}\\]]+)`, 'i');
        const re4 = new RegExp(`'${escapedKey}'\\s*:\\s*([^,}\\]]+)`, 'i');

        const m1 = text.match(re1);
        if (m1) return m1[1].trim();

        const m2 = text.match(re2);
        if (m2) return m2[1].trim();

        const m3 = text.match(re3);
        if (m3) {
            const valueText = m3[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
            if (valueText && valueText.toLowerCase() !== 'null' && valueText.toLowerCase() !== 'undefined') {
                return valueText;
            }
        }

        const m4 = text.match(re4);
        if (m4) {
            const valueText = m4[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
            if (valueText && valueText.toLowerCase() !== 'null' && valueText.toLowerCase() !== 'undefined') {
                return valueText;
            }
        }

        return '';
    }

    _extractIpAddress(value) {
        const text = String(value ?? '').trim();
        if (!text) return '';

        const matches = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
        for (const candidate of matches) {
            if (this._isValidIpAddress(candidate)) {
                return candidate;
            }
        }
        return '';
    }

    _extractMacAddress(value) {
        const text = String(value ?? '').trim();
        if (!text) return '';

        const match = text.match(/\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b|\b[0-9A-Fa-f]{12}\b/);
        if (!match) return '';

        const raw = match[0].toUpperCase();
        return raw.includes(':') ? raw : raw.match(/.{1,2}/g).join(':');
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _extractPrimitive(value, preferredKey = '') {
        if (value == null) return '';

        if (typeof value === 'string') {
            const text = value.trim();
            if (!text) return '';

            const lower = text.toLowerCase();
            if (lower === 'null' || lower === 'undefined') return '';

            if (text.startsWith('+DONE:')) {
                const parsed = this.bluetoothService.parseResponse(text, preferredKey || undefined);
                if (parsed !== text) {
                    return this._extractPrimitive(parsed, preferredKey);
                }
            }

            if (text.startsWith('{') || text.startsWith('[')) {
                try {
                    const parsed = JSON.parse(text);
                    return this._extractPrimitive(parsed, preferredKey);
                } catch {
                    if (preferredKey) {
                        const byKey = this._extractByKeyFromText(text, preferredKey);
                        if (byKey) return byKey;
                    }
                }
            }

            if (preferredKey) {
                const byKey = this._extractByKeyFromText(text, preferredKey);
                if (byKey) return byKey;
            }

            if (preferredKey === 'ip') {
                const ip = this._extractIpAddress(text);
                if (ip) return ip;
            }

            if (preferredKey === 'mac') {
                const mac = this._extractMacAddress(text);
                if (mac) return mac;
            }

            return text;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (Array.isArray(value)) {
            return '';
        }

        if (typeof value === 'object') {
            if (preferredKey && Object.prototype.hasOwnProperty.call(value, preferredKey)) {
                return this._extractPrimitive(value[preferredKey], preferredKey);
            }

            if (preferredKey) {
                const normalizedPreferred = preferredKey.toLowerCase().replace(/[-_]/g, '');
                for (const candidate of Object.keys(value)) {
                    const normalizedCandidate = String(candidate).toLowerCase().replace(/[-_]/g, '');
                    if (normalizedCandidate === normalizedPreferred) {
                        return this._extractPrimitive(value[candidate], preferredKey);
                    }
                }
            }

            const keys = Object.keys(value);
            if (keys.length === 1) {
                return this._extractPrimitive(value[keys[0]], preferredKey);
            }

            const dump = JSON.stringify(value);
            if (preferredKey === 'ip') {
                return this._extractIpAddress(dump);
            }
            if (preferredKey === 'mac') {
                return this._extractMacAddress(dump);
            }
        }

        return '';
    }

    _extractDimension(value, fallback) {
        const text = this._extractPrimitive(value);
        const num = parseInt(text, 10);
        if (Number.isFinite(num) && num > 0) {
            return num;
        }

        const match = String(text || '').match(/\d+/);
        if (match) {
            const parsed = parseInt(match[0], 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }

        return fallback;
    }

    _normalizeBtDeviceInfo(info = {}) {
        const normalized = {
            ip: this._extractIpAddress(this._extractPrimitive(info.ip ?? info.ip_address ?? info.address, 'ip')),
            mac: this._extractMacAddress(this._extractPrimitive(info.mac ?? info.mac_address ?? info.serial ?? info.device_id, 'mac')),
            Protocol: this._extractPrimitive(info.Protocol ?? info.protocol, 'Protocol'),
            lcd_screen_width: this._extractDimension(
                info.lcd_screen_width ?? info.screen_width ?? info.width,
                0
            ),
            lcd_screen_height: this._extractDimension(
                info.lcd_screen_height ?? info.screen_height ?? info.height,
                0
            )
        };

        // Last chance fallback: extract from full object dump if any field is empty
        const dump = (() => {
            try {
                return JSON.stringify(info);
            } catch {
                return '';
            }
        })();

        if (!normalized.ip && dump) {
            normalized.ip = this._extractIpAddress(dump);
        }

        if (!normalized.mac && dump) {
            normalized.mac = this._extractMacAddress(dump);
        }

        return normalized;
    }

    _parseScreenText(text) {
        const value = String(text || '').trim();
        const match = value.match(/(\d+)\s*x\s*(\d+)/i);
        if (!match) {
            return { width: 0, height: 0 };
        }

        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        return {
            width: Number.isFinite(width) && width > 0 ? width : 800,
            height: Number.isFinite(height) && height > 0 ? height : 1280
        };
    }

    _readInfoValueFromUi(id) {
        const value = document.getElementById(id)?.textContent?.trim() || '';
        if (!value || value === '-' || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') {
            return '';
        }
        return value;
    }

    _buildDeviceInfoForForm() {
        const normalized = this._normalizeBtDeviceInfo(this.btNormalizedDeviceInfo || this.btDeviceInfo || {});
        const ipFromUi = this._readInfoValueFromUi('bt-info-ip');
        const macFromUi = this._readInfoValueFromUi('bt-info-mac');
        const protocolFromUi = this._readInfoValueFromUi('bt-info-protocol');
        const screenFromUi = this._parseScreenText(this._readInfoValueFromUi('bt-info-screen'));
        const width = this._extractDimension(normalized.lcd_screen_width, screenFromUi.width || 0);
        const height = this._extractDimension(normalized.lcd_screen_height, screenFromUi.height || 0);

        return {
            ip: this._extractIpAddress(normalized.ip || ipFromUi),
            mac: this._extractMacAddress(normalized.mac || macFromUi),
            Protocol: normalized.Protocol || protocolFromUi,
            lcd_screen_width: width,
            lcd_screen_height: height
        };
    }

    async _fetchMissingDeviceInfo(deviceInfo) {
        const result = { ...deviceInfo };
        result.ip = this._extractIpAddress(result.ip);
        result.mac = this._extractMacAddress(result.mac);
        result.lcd_screen_width = this._extractDimension(result.lcd_screen_width, 0);
        result.lcd_screen_height = this._extractDimension(result.lcd_screen_height, 0);

        if (!this.bluetoothService?.connected) return result;
        let token = this._deviceToken || '';

        if (!this._tokenBypassMode) {
            try {
                token = await this._loadDeviceTokenFromServer();
            } catch (error) {
                Logger.debug('BluetoothWizard: token preload skipped while fetching device info', {
                    error: error?.message || String(error)
                });
            }
        }

        try {
            if (!this._isValidIpAddress(result.ip)) {
                const rawIp = await this.bluetoothService.getDeviceInfo('ip', token);
                const parsedIp = this.bluetoothService.parseResponse(rawIp, 'ip');
                result.ip = this._extractIpAddress(this._extractPrimitive(parsedIp, 'ip') || rawIp);
            }
        } catch (error) {
            this._log(this.__('bluetooth.wizard.ipReadFailed', { error: error.message }), 'error');
        }

        try {
            if (!this._isValidMacAddress(result.mac)) {
                const rawMac = await this.bluetoothService.getDeviceInfo('mac', token);
                const parsedMac = this.bluetoothService.parseResponse(rawMac, 'mac');
                result.mac = this._extractMacAddress(this._extractPrimitive(parsedMac, 'mac') || rawMac);
            }
        } catch (error) {
            this._log(this.__('bluetooth.wizard.macReadFailed', { error: error.message }), 'error');
        }

        try {
            if (!result.lcd_screen_width || !result.lcd_screen_height) {
                const rawW = await this.bluetoothService.getDeviceInfo('lcd_screen_width', token);
                const rawH = await this.bluetoothService.getDeviceInfo('lcd_screen_height', token);
                const parsedW = this.bluetoothService.parseResponse(rawW, 'lcd_screen_width');
                const parsedH = this.bluetoothService.parseResponse(rawH, 'lcd_screen_height');
                const width = this._extractDimension(parsedW, result.lcd_screen_width || 800);
                const height = this._extractDimension(parsedH, result.lcd_screen_height || 1280);
                result.lcd_screen_width = width;
                result.lcd_screen_height = height;
            }
        } catch (error) {
            this._log(this.__('bluetooth.wizard.screenReadFailed', { error: error.message }), 'error');
        }

        if (!this._isValidIpAddress(result.ip) || !this._isValidMacAddress(result.mac)) {
            try {
                const allInfo = await this.bluetoothService.getAllInfo(token);
                const normalized = this._normalizeBtDeviceInfo(allInfo);
                if (!this._isValidIpAddress(result.ip)) {
                    result.ip = normalized.ip || result.ip;
                }
                if (!this._isValidMacAddress(result.mac)) {
                    result.mac = normalized.mac || result.mac;
                }
                result.lcd_screen_width = this._extractDimension(
                    normalized.lcd_screen_width || result.lcd_screen_width,
                    result.lcd_screen_width || 800
                );
                result.lcd_screen_height = this._extractDimension(
                    normalized.lcd_screen_height || result.lcd_screen_height,
                    result.lcd_screen_height || 1280
                );
            } catch (error) {
                this._log(this.__('bluetooth.wizard.extraInfoReadFailed', { error: error.message }), 'error');
            }
        }

        return result;
    }

    /**
     * Aynı IP ile kayıtlı cihazı bul
     * @param {string} ipAddress
     * @returns {Promise<Object|null>}
     * @private
     */
    async _findExistingDeviceByIp(ipAddress) {
        const ip = String(ipAddress || '').trim();
        if (!ip) return null;

        try {
            const response = await this.app.api.get('/devices', {
                search: ip,
                per_page: 50
            });
            const devices = Array.isArray(response?.data) ? response.data : [];
            return devices.find(device => String(device?.ip_address || '').trim() === ip) || null;
        } catch (error) {
            Logger.warn('IP conflict check failed in Bluetooth wizard', error);
            return null;
        }
    }

    /**
     * Serial/device_id ile mevcut cihaz ara
     * @param {string} serial - MAC veya serial number
     * @returns {Object|null}
     * @private
     */
    async _findExistingDeviceBySerial(serial) {
        const s = String(serial || '').trim();
        if (!s) return null;

        try {
            const response = await this.app.api.get('/devices', {
                search: s,
                per_page: 50
            });
            const devices = Array.isArray(response?.data) ? response.data : [];

            // Exact match veya normalized MAC match
            const normalized = s.toUpperCase().replace(/[:\-.]/g, '');
            return devices.find(device => {
                const did = String(device?.device_id || '').toUpperCase().replace(/[:\-.]/g, '');
                const mid = String(device?.mqtt_client_id || '').toUpperCase().replace(/[:\-.]/g, '');
                return did === normalized || mid === normalized
                    || device?.device_id === s || device?.mqtt_client_id === s;
            }) || null;
        } catch (error) {
            Logger.warn('Serial conflict check failed in Bluetooth wizard', error);
            return null;
        }
    }

    _log(message, type = 'info') {
        const log = document.getElementById('bt-log');
        if (log) {
            log.style.display = 'block';
            const color = type === 'error' ? '#fa5252' : type === 'success' ? '#40c057' : '#868e96';
            log.innerHTML += `<div style="color: ${color};">[${new Date().toLocaleTimeString()}] ${message}</div>`;
            log.scrollTop = log.scrollHeight;
        }
        Logger.log(`[Bluetooth] ${message}`);
    }

    _extractApiErrorMessage(response, fallbackMessage) {
        const fallback = fallbackMessage || 'Islem basarisiz';

        if (!response) return fallback;

        if (typeof response === 'string') {
            const text = response.trim();
            if (!text) return fallback;
            if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
                return 'API JSON yerine HTML dondurdu. /api yonlendirmesini ve oturumu kontrol edin.';
            }
            return text.slice(0, 200);
        }

        if (typeof response === 'object') {
            const directMessage = response.message || response.error || response?.data?.message;
            if (directMessage) return String(directMessage);

            const errors = response.errors || response?.data?.errors;
            if (Array.isArray(errors) && errors.length > 0) {
                return String(errors[0]);
            }
            if (errors && typeof errors === 'object') {
                const first = Object.values(errors)[0];
                if (Array.isArray(first) && first.length > 0) {
                    return String(first[0]);
                }
                if (first) {
                    return String(first);
                }
            }
        }

        return fallback;
    }

    _isTokenError(error) {
        const message = String(error?.message || error || '').toLowerCase();
        if (!message) return false;
        return message.includes('token') || message.includes('passwd') || message.includes('password');
    }

    _promptForDeviceToken() {
        if (this._tokenBypassMode) {
            return false;
        }
        const promptText = this.__('networkConfig.adminPasswordPlaceholder');
        const current = this._deviceToken || '';
        const entered = window.prompt(promptText, current);
        if (entered === null) {
            return false;
        }
        const normalized = String(entered).trim();
        if (!normalized) {
            return false;
        }
        this._deviceToken = normalized;
        return true;
    }

    async _resolveKnownDeviceForToken() {
        const normalized = this._normalizeBtDeviceInfo(this.btNormalizedDeviceInfo || this.btDeviceInfo || {});
        const ipCandidates = [
            normalized.ip,
            this._readInfoValueFromUi('bt-info-ip')
        ].map(v => String(v || '').trim()).filter(Boolean);

        for (const ip of ipCandidates) {
            if (!this._isValidIpAddress(ip)) continue;
            const byIp = await this._findExistingDeviceByIp(ip);
            if (byIp?.id) return byIp;
        }

        const serialCandidates = [
            normalized.mac,
            this._readInfoValueFromUi('bt-info-mac'),
            this.bluetoothService?.device?.id,
            this.bluetoothService?.device?.name
        ].map(v => String(v || '').trim()).filter(Boolean);

        const seen = new Set();
        for (const serial of serialCandidates) {
            if (seen.has(serial)) continue;
            seen.add(serial);
            const bySerial = await this._findExistingDeviceBySerial(serial);
            if (bySerial?.id) return bySerial;
        }

        return null;
    }

    async _loadDeviceTokenFromServer(force = false) {
        if (!force && this._deviceToken) {
            return this._deviceToken;
        }

        try {
            const existing = await this._resolveKnownDeviceForToken();
            if (!existing?.id) {
                return '';
            }

            const response = await this.app.api.get(`/devices/${existing.id}/bt-password`);
            const password = String(response?.data?.password || '').trim();
            if (password) {
                this._deviceToken = password;
                return password;
            }
        } catch (error) {
            Logger.debug('BluetoothWizard: stored token fetch failed', {
                error: error?.message || String(error)
            });
        }

        return '';
    }

    /**
     * Bağlantı durumunu güncelle
     * @private
     */
    _updateStatus(connected, deviceName = '') {
        const status = document.getElementById('bt-connection-status');
        if (status) {
            if (connected) {
                status.className = 'alert alert-success';
                const brandBadge = this._isKexinDevice
                    ? ' <span style="font-size:0.7rem;background:#ff922b;color:#fff;padding:0.1rem 0.4rem;border-radius:3px;margin-left:0.25rem;">Kexin</span>'
                    : '';
                status.innerHTML = `<i class="ti ti-bluetooth-connected"></i><span>${this.__('bluetooth.connected')}: ${deviceName}${brandBadge}</span>`;
            } else {
                status.className = 'alert alert-secondary';
                status.innerHTML = `<i class="ti ti-bluetooth-off"></i><span>${this.__('bluetooth.disconnected')}</span>`;
            }
        }
        this._updateAddDeviceButtonState();
    }

    /**
     * Adım göstergesini güncelle
     * @private
     */
    _setStep(step) {
        this._currentStep = step;
        if (step > this._highestReachedStep) {
            this._highestReachedStep = step;
        }

        const isConnected = this.workflowState.connected;

        // Update step indicators
        document.querySelectorAll('.bt-step').forEach((el, idx) => {
            const stepNum = idx + 1;
            el.classList.remove('active', 'completed', 'reachable');
            if (stepNum < step) {
                el.classList.add('completed');
            } else if (stepNum === step) {
                el.classList.add('active');
            } else if (isConnected || stepNum <= this._highestReachedStep) {
                // After BLE connection: all tabs clickable
                // Before connection: only previously visited steps
                el.classList.add('reachable');
            }
        });

        // Show/hide step content - Map steps to content divs
        // Step 1 = scan (bt-step-1)
        // Step 2 = connect (still bt-step-1, just show connect button)
        // Step 3 = wifi (bt-step-2)
        // Step 4 = protocol (bt-step-3)
        // Step 5 = verify (bt-step-4)
        const contentMap = {
            1: 'bt-step-1',
            2: 'bt-step-1',
            3: 'bt-step-2',
            4: 'bt-step-3',
            5: 'bt-step-4'
        };

        document.querySelectorAll('.bt-step-content').forEach(el => {
            el.style.display = 'none';
        });

        const activeContent = document.getElementById(contentMap[step]);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
    }

    /**
     * Navigate to a step by clicking on its tab
     * After BLE connection, all steps become accessible (user may need factory reset, reboot etc.)
     * Before connection, only reached steps are clickable
     * @param {number} targetStep - Step number to navigate to
     * @private
     */
    _navigateToStep(targetStep) {
        // Can't navigate to current step
        if (targetStep === this._currentStep) return;

        // After BLE connection, all steps are accessible (non-sequential workflow)
        if (this.workflowState.connected) {
            this._setStep(targetStep);
            this._updateAddDeviceButtonState();
            return;
        }

        // Before connection, only reached steps are clickable
        if (targetStep > this._highestReachedStep) return;

        this._setStep(targetStep);
        this._updateAddDeviceButtonState();
    }

    /**
     * Cihaz tara
     * @private
     */
    async _scanDevice(showAll = false) {
        const scanBtn = document.getElementById('bt-scan-btn');
        const scanAllBtn = document.getElementById('bt-scan-all-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${this.__('bluetooth.scanning')}`;
        }
        if (scanAllBtn) scanAllBtn.disabled = true;

        try {
            this._log(showAll
                ? this.__('bluetooth.wizard.scanningAllDevices')
                : this.__('bluetooth.wizard.scanningDevice'));
            const device = await this.bluetoothService.scan(showAll);

            // Show device info
            document.getElementById('bt-device-info').style.display = 'block';
            document.getElementById('bt-device-name').textContent = device.name || 'PavoDisplay';
            document.getElementById('bt-device-id').textContent = device.id || '-';

            this.workflowState.scanned = true;
            this.workflowState.connected = false;
            this.workflowState.wifiConfigured = false;
            this.workflowState.protocolConfigured = false;
            this.workflowState.verified = false;
            // Reset step navigation for new device — user must go through all steps again
            this._highestReachedStep = 1;
            this._log(this.__('bluetooth.wizard.deviceFound', { name: device.name }), 'success');

            // Cihaz markası tespiti
            this._detectDeviceBrand();
            if (this._isKexinDevice) {
                this._log('Kexin cihazı tespit edildi — birleşik yapılandırma kullanılacak', 'info');
            }

            this._setStep(2);
            this._updateAddDeviceButtonState();

        } catch (error) {
            this._log(this.__('bluetooth.wizard.scanDeviceError', { error: error.message }), 'error');
            Toast.error(error.message);
        } finally {
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = `<i class="ti ti-bluetooth"></i> ${this.__('bluetooth.scan')}`;
            }
            if (scanAllBtn) scanAllBtn.disabled = false;
        }
    }

    /**
     * Cihaza bağlan
     * @private
     */
    async _connect() {
        const connectBtn = document.getElementById('bt-connect-btn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${this.__('bluetooth.connecting')}`;
        }

        try {
            this._log(this.__('bluetooth.wizard.connecting'));
            await this.bluetoothService.connect();

            this.workflowState.connected = true;
            this._updateStatus(true, this.bluetoothService.device?.name);
            this._log(this.__('bluetooth.wizard.connected'), 'success');
            Toast.success(this.__('bluetooth.toast.connected'));

            // BLE bağlantı kopuşunu dinle (reboot dahil)
            this.bluetoothService.device?.addEventListener('gattserverdisconnected', () => {
                this._log('BLE bağlantısı koptu', 'info');
                this.workflowState.connected = false;
                this._updateStatus(false);
                this._updateAddDeviceButtonState();
            });

            // Cihaz markası doğrulama
            this._detectDeviceBrand();
            if (this._isKexinDevice) {
                this._log('Kexin modu: WiFi + Protokol birleşik gönderilecek', 'info');
                // Kexin varsayılanlarını ayarla (HTTP-SERVER devre dışı, HTTP varsayılan, URL'ler doldur)
                this._applyKexinProtocolDefaults();
            }

            // Move to WiFi step
            this._setStep(3);
            this._ensureStaticIpDefaults();

            if (!this._tokenBypassMode) {
                this._loadDeviceTokenFromServer().then(() => {
                    this._updateTokenStatusUI();
                }).catch((error) => {
                    Logger.debug('BluetoothWizard: token preload after connect failed', {
                        error: error?.message || String(error)
                    });
                    this._updateTokenStatusUI();
                });
            }

            // Auto-fetch WiFi list after connection
            setTimeout(() => this._scanWifiNetworks(), 250);

        } catch (error) {
            this.workflowState.connected = false;
            this._log(this.__('bluetooth.wizard.connectError', { error: error.message }), 'error');
            Toast.error(error.message);
        } finally {
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('bluetooth.connect')}`;
            }
            this._updateAddDeviceButtonState();
        }
    }

    /**
     * WiFi ayarlarını kaydet
     * @private
     */
    async _saveWifi(allowRetry = true) {
        const ssid = document.getElementById('bt-wifi-ssid')?.value?.trim();
        const password = document.getElementById('bt-wifi-password')?.value;
        const useStatic = document.getElementById('bt-ip-mode')?.value === 'static';

        if (!ssid) {
            Toast.error(this.__('bluetooth.wizard.wifiRequired'));
            return;
        }

        const btn = document.getElementById('bt-save-wifi-btn');
        if (btn) btn.disabled = true;

        try {
            await this._loadDeviceTokenFromServer();
            this._log(this.__('bluetooth.wizard.configuringWifi', { ssid }));

            if (this._isKexinDevice) {
                // ── Kexin: WiFi ayarlarını sakla, protokol adımında birleşik gönderilecek ──
                this._pendingWifiConfig = { ssid, password };

                if (useStatic) {
                    const ip = document.getElementById('bt-static-ip')?.value?.trim();
                    const gateway = document.getElementById('bt-gateway')?.value?.trim();
                    const netmask = document.getElementById('bt-netmask')?.value?.trim() || '255.255.255.0';

                    if (!ip || !gateway) {
                        Toast.error(this.__('bluetooth.wizard.staticIpRequired'));
                        return;
                    }
                    if (!this._isValidIpAddress(ip) || !this._isValidIpAddress(gateway) || !this._isValidIpAddress(netmask)) {
                        Toast.error(this.__('bluetooth.wizard.invalidIpFormat'));
                        return;
                    }
                    this._pendingWifiConfig.staticIp = { ip, gateway, netmask };
                }

                this._rememberWifiSsid(ssid);
                this._updateWifiNetworkOptions();
                this._log('WiFi ayarları kaydedildi (protokol adımında birleşik gönderilecek)', 'success');
            } else {
                // ── PavoDisplay: Mevcut akış — WiFi ayrı gönder ──
                await this.bluetoothService.setWifi(ssid, password, this._deviceToken);
                this._rememberWifiSsid(ssid);
                this._updateWifiNetworkOptions();
                this._log(this.__('bluetooth.wizard.wifiSet'), 'success');

                // Set static IP if enabled
                if (useStatic) {
                    const ip = document.getElementById('bt-static-ip')?.value?.trim();
                    const gateway = document.getElementById('bt-gateway')?.value?.trim();
                    const netmask = document.getElementById('bt-netmask')?.value?.trim() || '255.255.255.0';

                    if (!ip || !gateway) {
                        Toast.error(this.__('bluetooth.wizard.staticIpRequired'));
                        return;
                    }

                    if (!this._isValidIpAddress(ip) || !this._isValidIpAddress(gateway) || !this._isValidIpAddress(netmask)) {
                        Toast.error(this.__('bluetooth.wizard.invalidIpFormat'));
                        return;
                    }

                    this._log(this.__('bluetooth.wizard.settingStaticIp', { ip }));
                    await this.bluetoothService.setStaticIp(ip, gateway, netmask, this._deviceToken);
                    this._log(this.__('bluetooth.wizard.staticIpSet'), 'success');
                } else {
                    // Set DHCP
                    await this.bluetoothService.setDhcp(this._deviceToken);
                    this._log(this.__('bluetooth.wizard.dhcpSet'), 'success');
                }
            }

            this.workflowState.wifiConfigured = true;
            this.workflowState.protocolConfigured = false;
            this.workflowState.verified = false;
            Toast.success(this.__('bluetooth.toast.wifiConfigured'));

            // Move to protocol step
            this._setStep(4);
            this._updateAddDeviceButtonState();

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._saveWifi(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._saveWifi(false);
                }
            }
            this.workflowState.wifiConfigured = false;
            this._log(this.__('bluetooth.wizard.wifiError', { error: error.message }), 'error');
            Toast.error(error.message);
        } finally {
            if (btn) btn.disabled = false;
            this._updateAddDeviceButtonState();
        }
    }

    /**
     * Protokol ayarla
     * @private
     */
    async _setProtocol(allowRetry = true) {
        const protocol = document.getElementById('bt-protocol')?.value || 'HTTP-SERVER';
        const btn = document.getElementById('bt-set-protocol-btn');
        if (btn) btn.disabled = true;

        try {
            await this._loadDeviceTokenFromServer();
            // Arka planda çalışan WiFi tarama komutlarını iptal et ve mevcut komutun bitmesini bekle
            this._log('Kuyruk temizleniyor ve mevcut BLE komutu bekleniyor...');
            await this.bluetoothService.cancelPendingCommands('Protokol ayarı için kuyruk temizlendi');
            // GATT stabilizasyonu için ek bekleme
            await new Promise(r => setTimeout(r, 300));

            this._log(this.__('bluetooth.wizard.settingProtocol', { protocol }));

            if (protocol === 'MQTT') {
                // Kexin: Bekleyen WiFi ayarlarını önce gönder (MQTT sıralı komut kullanır)
                if (this._isKexinDevice && this._pendingWifiConfig) {
                    this._log('Kexin: Bekleyen WiFi ayarları gönderiliyor...');
                    await this.bluetoothService.setWifi(this._pendingWifiConfig.ssid, this._pendingWifiConfig.password, this._deviceToken);
                    if (this._pendingWifiConfig.staticIp) {
                        await this.bluetoothService.setStaticIp(
                            this._pendingWifiConfig.staticIp.ip,
                            this._pendingWifiConfig.staticIp.gateway,
                            this._pendingWifiConfig.staticIp.netmask,
                            this._deviceToken
                        );
                    }
                    this._log('WiFi ayarları gönderildi', 'success');
                }

                // MQTT secilmisse tum ayarlari topla ve gonder
                const mqttUrl = document.getElementById('bt-mqtt-url')?.value?.trim() || '';
                const registerServer = document.getElementById('bt-mqtt-register-server')?.value?.trim() || '';
                const remoteServer = document.getElementById('bt-mqtt-remote-server')?.value?.trim() || '';
                const reportServer = document.getElementById('bt-mqtt-report-server')?.value?.trim() || '';
                const appId = document.getElementById('bt-mqtt-app-id')?.value?.trim() || '';
                const appSecret = document.getElementById('bt-mqtt-app-secret')?.value?.trim() || '';

                if (!mqttUrl) {
                    Toast.warning(this.__('bluetooth.mqttUrlRequired'));
                    if (btn) btn.disabled = false;
                    return;
                }

                this._log('MQTT yapilandirmasi gonderiliyor...');

                // configureMqtt toplu olarak tum ayarlari sirayla gonderir
                const results = await this.bluetoothService.configureMqtt({
                    mqttUrl,
                    registrationServer: registerServer,
                    remoteServer,
                    reportServer,
                    appId,
                    appSecret
                }, this._deviceToken);

                // Sonuclari logla
                let hasError = false;
                for (const [key, result] of Object.entries(results)) {
                    if (result?.error) {
                        this._log(`MQTT ${key}: ${result.error}`, 'error');
                        hasError = true;
                    } else {
                        this._log(`MQTT ${key}: OK`, 'success');
                    }
                }

                if (hasError) {
                    const partialConfigMsg = this.__('bluetooth.mqttPartialConfig');
                    Toast.warning(
                        partialConfigMsg && partialConfigMsg !== 'bluetooth.mqttPartialConfig'
                            ? partialConfigMsg
                            : 'MQTT yapilandirmasi kismi olarak tamamlandi'
                    );
                } else {
                    const configuredMsg = this.__('bluetooth.mqttConfigured');
                    Toast.success(
                        configuredMsg && configuredMsg !== 'bluetooth.mqttConfigured'
                            ? configuredMsg
                            : 'MQTT yapilandirmasi tamamlandi'
                    );
                }

                // Bu cihaz MQTT olarak kaydedilecek
                this._mqttProtocolSelected = true;
                this._selectedCommunicationMode = 'mqtt';
            } else {
                if (this._isKexinDevice) {
                    // ── Kexin: Ayrı kısa komutlarla gönder (kuyruk seri çalışmayı garantiler) ──
                    // DEX analizi: Kexin PriceTag APK sırası:
                    //   WiFi → Protocol("HTTP-SERVER") → Reboot
                    // HTTP-SERVER = cihaz port 80 HTTP server açar → PavoDisplayGateway push yapar
                    // HTTP = cihaz sunucuya PULL yapar → Remote-server/Query-cycle gerekir

                    // 1) WiFi ayarları (beklemede ise)
                    if (this._pendingWifiConfig) {
                        this._log(`WiFi ayarlanıyor: ${this._pendingWifiConfig.ssid}`);
                        await this.bluetoothService.setWifi(this._pendingWifiConfig.ssid, this._pendingWifiConfig.password, this._deviceToken);
                        this._log('WiFi gönderildi ✓', 'success');

                        if (this._pendingWifiConfig.staticIp) {
                            this._log(`Statik IP ayarlanıyor: ${this._pendingWifiConfig.staticIp.ip}`);
                            await this.bluetoothService.setStaticIp(
                                this._pendingWifiConfig.staticIp.ip,
                                this._pendingWifiConfig.staticIp.gateway,
                                this._pendingWifiConfig.staticIp.netmask,
                                this._deviceToken
                            );
                            this._log('Statik IP gönderildi ✓', 'success');
                        }
                    }

                    // 2) Protokol
                    this._log(`Protokol ayarlanıyor: ${protocol}`);
                    await this.bluetoothService.setProtocol(protocol, this._deviceToken);
                    this._log('Protokol gönderildi ✓', 'success');

                    // 3) HTTP-SERVER modunda URL gerekmez (push mode)
                    //    HTTP modunda sunucu URL'lerini gönder (pull mode)
                    if (protocol === 'HTTP') {
                        const remoteServer = document.getElementById('bt-kexin-remote-server')?.value?.trim() || '';
                        const infoServer = document.getElementById('bt-kexin-info-server')?.value?.trim() || '';
                        const queryCycle = document.getElementById('bt-kexin-query-cycle')?.value?.trim() || '30';

                        if (remoteServer) {
                            if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(remoteServer)) {
                                this._log('UYARI: Remote-server localhost! Cihaz erişemez, gerçek IP kullanın!', 'error');
                                Toast.warning(this.__('bluetooth.wizard.localhostWarning'));
                            }
                            this._log(`Remote-server: ${remoteServer}`);
                            await this.bluetoothService.setRemoteServer(remoteServer, this._deviceToken);
                            this._log('Remote-server gönderildi ✓', 'success');
                        } else {
                            this._log('Remote-server boş! Cihaz içerik çekemez.', 'error');
                        }

                        if (infoServer) {
                            this._log(`Info-server: ${infoServer}`);
                            await this.bluetoothService.setInfoServer(infoServer, this._deviceToken);
                            this._log('Info-server gönderildi ✓', 'success');
                        }

                        this._log(`Query-cycle: ${queryCycle}sn`);
                        await this.bluetoothService.setQueryCycle(queryCycle, this._deviceToken);
                        this._log('Query-cycle gönderildi ✓', 'success');
                    } else if (protocol === 'HTTP-SERVER') {
                        this._log('HTTP-SERVER modu: URL/appId gerekmez — cihaz port 80 açacak', 'info');
                    }

                    // 4) HTTP-SERVER: APK analizi → reboot YOK
                    // APK sırası: WiFi(138b) → Protocol(51b) → 74b komut → cihaz okumaları → WiFi+Protocol tekrar
                    // 74 byte komutu Application olabilir — ama yanlış AppID fabrika ayarını bozuyor!
                    // Strateji: Önce mevcut AppID'yi OKU, Application GÖNDERME, sadece double send yap
                    if (protocol === 'HTTP-SERVER') {
                        // 4a) Cihazın mevcut Application bilgisini oku (fabrika değerini öğren)
                        this._log('Cihaz Application bilgisi okunuyor...');
                        let deviceAppId = null;
                        let deviceAppSecret = null;
                        try {
                            const appResp = await this.bluetoothService.getDeviceInfo('Application', this._deviceToken);
                            this._log(`Application okuma: ${appResp}`, 'info');
                            // +DONE:{"Application":{"AppID":"xxx","AppSecret":"yyy"}} formatı
                            const parsed = this.bluetoothService.safeJsonParse(
                                String(appResp).replace(/^\+DONE:/, '').trim()
                            );
                            if (parsed?.Application) {
                                deviceAppId = parsed.Application.AppID || '';
                                deviceAppSecret = parsed.Application.AppSecret || '';
                                this._log(`Cihaz AppID: "${deviceAppId}", AppSecret: "${deviceAppSecret ? '***' : '(boş)'}"`, 'info');
                            }
                        } catch (readErr) {
                            this._log(`Application okunamadı: ${readErr.message}`, 'info');
                        }

                        // 4b) Kısa bekleme + cihaz bilgilerini oku (APK de okuma yapıyor)
                        this._log('Cihaz bilgileri okunuyor (ayar doğrulama)...');
                        await new Promise(r => setTimeout(r, 1500));
                        try {
                            const info = await this.bluetoothService.getAllInfo(this._deviceToken);
                            this._log(`Cihaz: IP=${info.ip}, Proto=${info.Protocol}, MAC=${info.mac}`, 'info');
                        } catch (readErr) {
                            this._log(`Bilgi okuma: ${readErr.message}`, 'info');
                        }

                        // 4c) WiFi + Protocol tekrar gönder (APK'nın 2. gönderimi — confirmation)
                        this._log('WiFi + Protocol tekrar gönderiliyor (APK double-send)...');
                        await new Promise(r => setTimeout(r, 500));
                        if (this._pendingWifiConfig) {
                            try {
                                await this.bluetoothService.setWifi(this._pendingWifiConfig.ssid, this._pendingWifiConfig.password, this._deviceToken);
                                this._log('WiFi (2. gönderim) ✓', 'success');
                            } catch (e) { this._log(`WiFi 2: ${e.message}`, 'info'); }
                        }
                        try {
                            await this.bluetoothService.setProtocol(protocol, this._deviceToken);
                            this._log('Protocol (2. gönderim) ✓', 'success');
                        } catch (e) { this._log(`Protocol 2: ${e.message}`, 'info'); }

                        // 4d) Mevcut AppID'yi geri yaz (cihazın kendi değeri, bozulmaz)
                        if (deviceAppId !== null) {
                            this._log(`Application geri yazılıyor: AppID="${deviceAppId}"...`);
                            try {
                                await this.bluetoothService.setApplication(deviceAppId, deviceAppSecret || '', this._deviceToken);
                                this._log('Application (orijinal değer) geri yazıldı ✓', 'success');
                            } catch (e) { this._log(`Application geri yazma: ${e.message}`, 'info'); }
                        }

                        Toast.info(this.__('bluetooth.wizard.httpServerSwitching'));
                    } else {
                        // HTTP PULL modunda reboot gerekli (ayarların uygulanması için)
                        this._log('Cihaz yeniden başlatılıyor...');
                        try {
                            await this.bluetoothService.reboot(this._deviceToken);
                            this._log('Reboot gönderildi. Cihaz ~20sn sonra sunucuya bağlanacak.', 'info');
                            Toast.info(this.__('bluetooth.wizard.rebootingWait'));
                        } catch (rebootErr) {
                            this._log(`Reboot gönderildi (bağlantı kopabilir): ${rebootErr.message}`, 'info');
                        }
                    }
                    this._log('Otomatik doğrulama bekliyor...');
                } else {
                    // ── PavoDisplay: Protokol + sunucu URL'lerini ayrı komutlarla gönder ──
                    await this.bluetoothService.setProtocol(protocol, this._deviceToken);

                    // HTTP modunda sunucu URL'lerini gönder
                    // NOT: appId/appSecret GÖNDERİLMEZ — cihaz fabrika appId'si ile çalışır,
                    // sunucu tarafında legacy fallback (MAC adresi ile) kimlik doğrulama yapar.
                    // BLE ile appId göndermek fabrika ayarını bozar ve "app in not set" hatasına neden olur.
                    // GATT çakışmasını önlemek için komutlar arası 500ms bekleme
                    if (protocol === 'HTTP') {
                        const remoteServer = document.getElementById('bt-kexin-remote-server')?.value?.trim() || '';
                        const infoServer = document.getElementById('bt-kexin-info-server')?.value?.trim() || '';
                        const queryCycle = document.getElementById('bt-kexin-query-cycle')?.value?.trim() || '30';
                        const bleDelay = () => new Promise(r => setTimeout(r, 500));

                        // localhost uyarısı
                        if (remoteServer && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(remoteServer)) {
                            this._log('UYARI: Remote-server localhost! Cihaz erişemez, gerçek IP kullanın!', 'error');
                            Toast.warning(this.__('bluetooth.wizard.localhostWarning'));
                        }

                        if (remoteServer) {
                            await bleDelay();
                            this._log(`Remote-server: ${remoteServer}`);
                            await this.bluetoothService.setRemoteServer(remoteServer, this._deviceToken);
                            this._log('Remote-server ayarlandı', 'success');
                        } else {
                            this._log('Remote-server boş! Cihaz içerik çekemez.', 'error');
                        }

                        if (infoServer) {
                            await bleDelay();
                            this._log(`Info-server: ${infoServer}`);
                            await this.bluetoothService.setInfoServer(infoServer, this._deviceToken);
                            this._log('Info-server ayarlandı', 'success');
                        }

                        await bleDelay();
                        this._log(`Query-cycle: ${queryCycle}sn`);
                        await this.bluetoothService.setQueryCycle(queryCycle, this._deviceToken);
                        this._log('Query-cycle ayarlandı', 'success');
                    }
                }
                this._mqttProtocolSelected = false;
                this._selectedCommunicationMode = protocol === 'HTTP' ? 'http' : 'http-server';
            }

            this.workflowState.protocolConfigured = true;
            this.workflowState.verified = false;

            // ── Auto-protect: Set BT admin+user password after protocol is configured ──
            if (!this._tokenBypassMode && !this._deviceToken && this.bluetoothService.connected) {
                try {
                    const autoPassword = this._generateSecurePassword(16);
                    this._log(this.__('bluetooth.protection.settingPassword') || 'BLE koruma şifresi ayarlanıyor...');
                    await new Promise(r => setTimeout(r, 300)); // GATT stabilization
                    await this.bluetoothService.setAdminPassword(autoPassword);
                    await new Promise(r => setTimeout(r, 300));
                    await this.bluetoothService.setUserPassword(autoPassword, autoPassword);
                    this._deviceToken = autoPassword;
                    this._log(this.__('bluetooth.protection.passwordSet') || 'BLE koruma şifresi ayarlandı ✓', 'success');
                } catch (pwdErr) {
                    this._log(`BLE koruma şifresi atanamadı: ${pwdErr.message}`, 'error');
                    // Don't block wizard — device just won't be protected
                }
            }

            this._log(this.__('bluetooth.wizard.protocolSet'), 'success');
            if (protocol !== 'MQTT') {
                Toast.success(this.__('bluetooth.toast.protocolSet'));
            }

            // Move to verify step
            this._setStep(5);

            if (this._isKexinDevice && protocol === 'HTTP-SERVER') {
                // Kexin HTTP-SERVER: Reboot YOK — cihaz canlı geçiş yapıyor
                // Port 80 açılması ~60-90sn sürebilir
                this._log('⏳ Cihaz HTTP-SERVER moduna geçiyor...', 'info');
                this._log('Port 80 açılması ~60-90 saniye sürebilir.', 'info');
                this._log('Bilgi barı kaybolup cihaz beyaz ekrana geçerse başarılı!', 'info');
                setTimeout(async () => {
                    if (this.bluetoothService.connected) {
                        this._log('Otomatik doğrulama başlatılıyor...');
                        try {
                            await this._readInfo();
                        } catch (readErr) {
                            this._log('Bilgiler okunamadı — "Bilgileri Oku" ile tekrar deneyin.', 'info');
                        }
                    } else {
                        this._log('BLE bağlantısı kopmuş — "Bilgileri Oku" ile tekrar deneyin.', 'info');
                    }
                    this._updateAddDeviceButtonState();
                }, 8000);
            } else if (this._isKexinDevice && protocol === 'HTTP') {
                // Kexin HTTP PULL: Reboot yaptı — kullanıcı beklemeli
                if (this.bluetoothService.connected) {
                    this._log('Reboot öncesi son doğrulama...');
                    try {
                        await this._readInfo();
                    } catch (readErr) {
                        this._log('Reboot başladı, bilgiler okunamadı — "Bilgileri Oku" ile deneyin.', 'info');
                    }
                } else {
                    this._log('Cihaz yeniden başlıyor. ~20sn bekleyip "Bilgileri Oku" butonuna tıklayın.', 'info');
                    Toast.info(this.__('bluetooth.wizard.rebootReadInfo'));
                }
            } else {
                // PavoDisplay veya MQTT — reboot yok, hemen oku
                setTimeout(() => {
                    if (this.bluetoothService.connected) {
                        this._log('Otomatik doğrulama başlatılıyor...');
                        this._readInfo();
                    } else {
                        this._log('BLE bağlantısı kopmuş — "Bilgileri Oku" ile tekrar deneyin.', 'info');
                    }
                }, 1000);
            }
            this._updateAddDeviceButtonState();

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._setProtocol(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._setProtocol(false);
                }
            }
            this.workflowState.protocolConfigured = false;
            this._log(this.__('bluetooth.wizard.protocolError', { error: error.message }), 'error');
            Toast.error(error.message);
        } finally {
            if (btn) btn.disabled = false;
            this._updateAddDeviceButtonState();
        }
    }

    /**
     * Sunucudan MQTT ayarlarini yukle ve formu doldur
     * @private
     */
    async _loadMqttSettings() {
        const btn = document.getElementById('bt-load-mqtt-settings-btn');
        if (btn) btn.disabled = true;

        try {
            this._log('Sunucu MQTT ayarlari yukleniyor...');
            const response = await this.app.api.get('/esl/mqtt/settings');

            if (response?.data) {
                const data = response.data;
                const dynamicContentUrl = this._buildMqttEndpointUrl('content');
                const dynamicReportUrl = this._buildMqttEndpointUrl('report');
                const dynamicRegisterUrl = this._buildMqttEndpointUrl('register');
                const resolvedContentUrl = (data.content_server_url || '').trim() || dynamicContentUrl;
                const resolvedReportUrl = (data.report_server_url || '').trim() || dynamicReportUrl;
                const resolvedRegisterUrl = (data.register_url || '').trim() || dynamicRegisterUrl;

                // MQTT URL form field
                const mqttUrlInput = document.getElementById('bt-mqtt-url');
                if (mqttUrlInput && data.broker_url) {
                    const protocol = data.use_tls ? 'mqtts' : 'mqtt';
                    mqttUrlInput.value = `${protocol}://${data.broker_url}:${data.broker_port || 1883}`;
                }

                // Content server URL
                const remoteServerInput = document.getElementById('bt-mqtt-remote-server');
                if (remoteServerInput) {
                    remoteServerInput.value = resolvedContentUrl;
                }

                // Report server URL
                const reportServerInput = document.getElementById('bt-mqtt-report-server');
                if (reportServerInput) {
                    reportServerInput.value = resolvedReportUrl;
                }

                // Registration server URL
                const registerServerInput = document.getElementById('bt-mqtt-register-server');
                if (registerServerInput) {
                    registerServerInput.value = resolvedRegisterUrl;
                }

                // AppID
                const appIdInput = document.getElementById('bt-mqtt-app-id');
                if (appIdInput && data.app_id) {
                    appIdInput.value = data.app_id;
                }

                // AppSecret (tenant bazli otomatik uretilmis olabilir)
                const appSecretInput = document.getElementById('bt-mqtt-app-secret');
                if (appSecretInput) {
                    const secretValue = data.app_secret_plain || '';
                    if (secretValue) {
                        appSecretInput.value = secretValue;
                    }
                }

                this._log('MQTT ayarlari yuklendi', 'success');
                Toast.success(this.__('bluetooth.mqttSettingsLoaded'));
            } else {
                this._log('Sunucuda MQTT ayari bulunamadi', 'error');
                Toast.warning(this.__('bluetooth.mqttNoSettings'));
            }
        } catch (error) {
            this._log(`MQTT ayarlari yuklenemedi: ${error.message}`, 'error');
            Toast.error(error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Cihaz bilgilerini oku
     * @private
     */
    async _readInfo(allowRetry = true) {
        const btn = document.getElementById('bt-read-info-btn');
        if (this._isReadingInfo) {
            this._log('Cihaz bilgileri okuma islemi zaten devam ediyor.', 'info');
            return;
        }

        this._isReadingInfo = true;
        const originalBtnHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${(this.__('modal.processing') || 'Isleniyor...')}`;
        }

        try {
            if (!this.bluetoothService?.connected) {
                throw new Error(this.__('bluetooth.disconnected') || 'Bluetooth baglantisi yok');
            }

            await this.bluetoothService.cancelPendingCommands('Cihaz bilgisi okuma oncesi kuyruk temizligi');
            await new Promise(resolve => setTimeout(resolve, 200));

            await this._loadDeviceTokenFromServer();
            this._log(this.__('bluetooth.wizard.readingInfo'));
            const info = await Promise.race([
                this.bluetoothService.getAllInfo(this._deviceToken, {
                    types: ['ip', 'mac', 'Protocol', 'lcd_screen_width', 'lcd_screen_height'],
                    timeoutMs: 2500,
                    throwOnError: true
                }),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Cihaz bilgileri okunurken zaman asimi olustu'));
                    }, 15000);
                })
            ]);
            const normalized = this._normalizeBtDeviceInfo(info);

            // Update UI
            document.getElementById('bt-info-ip').textContent = normalized.ip || '-';
            document.getElementById('bt-info-mac').textContent = normalized.mac || '-';
            document.getElementById('bt-info-protocol').textContent = normalized.Protocol || '-';
            document.getElementById('bt-info-screen').textContent =
                normalized.lcd_screen_width && normalized.lcd_screen_height
                    ? `${normalized.lcd_screen_width}x${normalized.lcd_screen_height}`
                    : '-';

            // Store raw + normalized for later form fill
            this.btDeviceInfo = info;
            this.btNormalizedDeviceInfo = normalized;

            const hasVerificationData = Boolean(
                normalized.ip
                || normalized.mac
                || this.bluetoothService.device?.id
            );
            this.workflowState.verified = hasVerificationData;

            // BLE üzerinden bilgi okuyabildiyse bağlantı aktif demektir
            // (Kexin reboot sonrası connected=false kalıyordu, bu düzeltir)
            if (!this.workflowState.connected && this.bluetoothService.connected) {
                this.workflowState.connected = true;
                this._updateStatus(true, this.bluetoothService.device?.name);
                this._log('BLE bağlantısı tekrar doğrulandı ✓', 'success');
            }

            if (hasVerificationData) {
                this._log(this.__('bluetooth.wizard.infoRead'), 'success');
                Toast.success(this.__('bluetooth.toast.infoRead'));
            } else {
                this._log('Cihaz bilgileri eksik geldi. Son adimi tekrar okuyun.', 'error');
                Toast.warning(this.__('bluetooth.wizard.infoIncomplete'));
            }

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    this._isReadingInfo = false;
                    return this._readInfo(false);
                }
                if (this._promptForDeviceToken()) {
                    this._isReadingInfo = false;
                    return this._readInfo(false);
                }
            }
            this.workflowState.verified = false;
            this._log(this.__('bluetooth.wizard.readInfoError', { error: error.message }), 'error');
            Toast.warning(error.message || this.__('bluetooth.wizard.infoReadFailed'));
        } finally {
            this._isReadingInfo = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml || `<i class="ti ti-refresh"></i> ${this.__('bluetooth.readInfo')}`;
            }
            this._updateAddDeviceButtonState();
        }
    }

    /**
     * Donanım ayarlarını kaydet
     * @private
     */
    async _saveHardware(allowRetry = true) {
        const volume = parseInt(document.getElementById('bt-volume')?.value) || 100;
        const brightness = parseInt(document.getElementById('bt-brightness')?.value) || 100;
        const btn = document.getElementById('bt-save-hardware-btn');

        if (btn) btn.disabled = true;

        try {
            await this._loadDeviceTokenFromServer();
            this._log(this.__('bluetooth.wizard.hardwareSettings', { volume, brightness }));
            await this.bluetoothService.setHardware(volume, brightness, this._deviceToken);

            this._log(this.__('bluetooth.wizard.hardwareSaved'), 'success');
            Toast.success(this.__('bluetooth.success'));

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._saveHardware(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._saveHardware(false);
                }
            }
            this._log(this.__('bluetooth.wizard.hardwareError', { error: error.message }), 'error');
            Toast.error(error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Cihazı yeniden başlat
     * @private
     */
    async _reboot(allowRetry = true) {
        if (!confirm(this.__('bluetooth.confirm.reboot'))) {
            return;
        }

        try {
            await this._loadDeviceTokenFromServer();
            this._log(this.__('bluetooth.wizard.rebooting'));
            await this.bluetoothService.reboot(this._deviceToken);

            Toast.info(this.__('bluetooth.toast.rebooting'));

            // Disconnect as device will reboot
            this.bluetoothService.disconnect();
            this.workflowState.connected = false;
            this.workflowState.verified = false;
            this._updateStatus(false);

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._reboot(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._reboot(false);
                }
            }
            this._log(this.__('bluetooth.wizard.rebootError', { error: error.message }), 'error');
            Toast.error(error.message);
        }
    }

    /**
     * Token'ı görüntüle
     * @private
     */
    async _viewToken() {
        try {
            await this._loadDeviceTokenFromServer(true);
            if (this._deviceToken) {
                Modal.show({
                    title: this.__('bluetooth.tokenManagement.viewToken'),
                    icon: 'ti-eye',
                    content: `
                        <div style="text-align: center; padding: 1rem;">
                            <p style="margin-bottom: 0.5rem; font-size: 0.875rem;">${this.__('bluetooth.tokenManagement.currentToken')}:</p>
                            <code style="font-size: 1.25rem; background: var(--bg-secondary); padding: 0.5rem 1rem; border-radius: 6px; display: inline-block; letter-spacing: 2px; user-select: all;">${this._escapeHtml(this._deviceToken)}</code>
                            <p class="form-hint" style="margin-top: 0.75rem; font-size: 0.75rem;">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('bluetooth.tokenManagement.tokenUsageHint')}
                            </p>
                        </div>`,
                    size: 'sm',
                    showConfirm: false,
                    cancelText: this.__('bluetooth.wizard.close')
                });
            } else {
                Toast.info(this.__('bluetooth.tokenManagement.noTokenFound'));
            }
        } catch (error) {
            Toast.error(error.message);
        }
        this._updateTokenStatusUI();
    }

    /**
     * Cihaz token'ını temizle (BLE + DB)
     * @private
     */
    async _clearDeviceToken() {
        if (!this._deviceToken) {
            Toast.info(this.__('bluetooth.tokenManagement.noTokenFound'));
            return;
        }

        if (!confirm(this.__('bluetooth.tokenManagement.clearTokenConfirm'))) {
            return;
        }

        try {
            // 1. BLE ile admin ve user şifresini temizle
            if (this.bluetoothService.connected) {
                this._log(this.__('bluetooth.tokenManagement.clearingBleToken'));
                // Admin şifresini boşalt (mevcut token ile doğrulama)
                await this.bluetoothService.setAdminPassword('', this._deviceToken);
                await new Promise(r => setTimeout(r, 300));
                // User şifresini boşalt
                await this.bluetoothService.setUserPassword('', this._deviceToken);
                this._log(this.__('bluetooth.tokenManagement.bleTokenCleared'), 'success');
            }

            // 2. DB'den token'ı sil
            await this._clearTokenFromServer();
            this._deviceToken = '';
            this._updateTokenStatusUI();
            Toast.success(this.__('bluetooth.tokenManagement.tokenCleared'));
        } catch (error) {
            this._log(`Token temizleme hatası: ${error.message}`, 'error');
            Toast.error(error.message);
        }
    }

    /**
     * Medya dosyalarını temizle
     * @private
     */
    async _clearMedia(allowRetry = true) {
        if (!confirm(this.__('bluetooth.confirm.clearMedia'))) {
            return;
        }

        try {
            await this._loadDeviceTokenFromServer();
            this._log(this.__('bluetooth.wizard.clearingMedia'));
            await this.bluetoothService.clearMedia(this._deviceToken);

            this._log(this.__('bluetooth.wizard.mediaCleared'), 'success');
            Toast.success(this.__('bluetooth.toast.mediaCleared'));

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._clearMedia(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._clearMedia(false);
                }
            }
            this._log(this.__('bluetooth.wizard.clearMediaError', { error: error.message }), 'error');
            Toast.error(error.message);
        }
    }

    /**
     * Fabrika ayarlarına sıfırla
     * @private
     */
    async _factoryReset(allowRetry = true) {
        // Enhanced confirmation with token status info
        const tokenStatus = this._deviceToken
            ? this.__('bluetooth.tokenManagement.protected')
            : this.__('bluetooth.tokenManagement.notProtected');
        const confirmMsg = `${this.__('bluetooth.confirm.factoryReset')}\n\n`
            + `${this.__('bluetooth.tokenManagement.status')}: ${tokenStatus}\n`
            + `${this.__('bluetooth.tokenManagement.factoryResetWarning')}`;
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            await this._loadDeviceTokenFromServer();
            const usedToken = this._deviceToken || '';
            this._log(this.__('bluetooth.wizard.resetting') + (usedToken ? ` (Token: ${usedToken.substring(0, 4)}****)` : ' (Token yok)'));
            await this.bluetoothService.factoryReset(usedToken);

            this._log(this.__('bluetooth.wizard.factoryResetSuccess'), 'success');

            // Factory reset clears device password — clear DB token too
            await this._clearTokenFromServer();
            this._deviceToken = '';

            Toast.success(this.__('bluetooth.toast.factoryResetDone'));

            // Disconnect as device will reset
            this.bluetoothService.disconnect();
            this.workflowState.connected = false;
            this.workflowState.verified = false;
            this._updateStatus(false);
            this._updateTokenStatusUI();

        } catch (error) {
            if (allowRetry && this._isTokenError(error)) {
                const serverToken = await this._loadDeviceTokenFromServer(true);
                if (serverToken) {
                    return this._factoryReset(false);
                }
                if (this._promptForDeviceToken()) {
                    return this._factoryReset(false);
                }
            }
            this._log(this.__('bluetooth.wizard.resetError', { error: error.message }), 'error');
            Toast.error(error.message);
        }
    }

    /**
     * DB'deki BT token'ı sil (factory reset sonrası)
     * @private
     */
    async _clearTokenFromServer() {
        try {
            const existing = await this._resolveKnownDeviceForToken();
            if (!existing?.id) {
                this._log('DB\'de cihaz kaydı bulunamadı, token temizleme atlandı', 'info');
                return;
            }
            await this.app.api.delete(`/devices/${existing.id}/bt-password`);
            this._log(this.__('bluetooth.tokenManagement.tokenCleared'), 'success');
        } catch (error) {
            this._log(`DB token temizleme hatası: ${error.message}`, 'error');
        }
    }

    /**
     * Token durumunu UI'da güncelle
     * @private
     */
    _updateTokenStatusUI() {
        const statusEl = document.getElementById('bt-token-status');
        if (!statusEl) return;

        if (this._deviceToken) {
            statusEl.innerHTML = `
                <span class="badge badge-success" style="font-size: 0.75rem;">
                    <i class="ti ti-lock"></i> ${this.__('bluetooth.tokenManagement.protected')}
                </span>
                <code style="font-size: 0.7rem; margin-left: 0.5rem; background: var(--bg-secondary); padding: 0.15rem 0.4rem; border-radius: 3px;">
                    ${this._deviceToken.substring(0, 4)}${'*'.repeat(Math.max(0, this._deviceToken.length - 4))}
                </code>`;
        } else {
            statusEl.innerHTML = `
                <span class="badge badge-warning" style="font-size: 0.75rem;">
                    <i class="ti ti-lock-open"></i> ${this.__('bluetooth.tokenManagement.notProtected')}
                </span>`;
        }
    }

    /**
     * Cihazı sisteme ekle
     * @private
     */
    async _addDevice() {
        if (!this._isWorkflowReadyForDeviceAdd()) {
            return;
        }

        // Collect info before closing current modal
        let deviceInfo = this._buildDeviceInfoForForm();
        deviceInfo = await this._fetchMissingDeviceInfo(deviceInfo);
        deviceInfo = this._normalizeBtDeviceInfo(deviceInfo);

        const serialFallback = deviceInfo.mac
            || this.bluetoothService.device?.id
            || this.bluetoothService.device?.name
            || '';
        const deviceName = this.bluetoothService.device?.name || 'PavoDisplay';
        const screenWidth = this._extractDimension(deviceInfo.lcd_screen_width, 800);
        const screenHeight = this._extractDimension(deviceInfo.lcd_screen_height, 1280);

        // Close bluetooth modal
        if (this.modal) {
            Modal.close(this.modal.id);
        }

        // Open add device form with pre-filled data
        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${this._escapeHtml(g.id)}">${this._escapeHtml(g.name)}</option>`
        ).join('');

        const formContent = `
            <form id="device-form" class="space-y-4">
                <div class="alert alert-success" style="margin-bottom: 1rem;">
                    <i class="ti ti-bluetooth-connected"></i>
                    <div>
                        <strong>${this._escapeHtml(this.__('bluetooth.wizard.configuredViaBluetooth'))}</strong>
                        <p>IP: ${this._escapeHtml(deviceInfo.ip || '-')} | MAC: ${this._escapeHtml(deviceInfo.mac || '-')}</p>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="device-name" class="form-input" required
                        value="${this._escapeHtml(deviceName)}" placeholder="${this._escapeHtml(this.__('form.placeholders.name'))}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.type')} *</label>
                        <select id="device-type" class="form-select" required>
                            <option value="esl_android" selected>${this.__('types.esl_android')}</option>
                            <option value="esl">${this.__('types.esl')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.status')}</label>
                        <select id="device-status" class="form-select">
                            <option value="online" selected>${this.__('statuses.online')}</option>
                            <option value="offline">${this.__('statuses.offline')}</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.serialNumber')}</label>
                        <input type="text" id="device-serial" class="form-input" value="${this._escapeHtml(serialFallback)}" placeholder="MAC/Serial">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                        <input type="text" id="device-ip" class="form-input" value="${this._escapeHtml(deviceInfo.ip || '')}" placeholder="192.168.1.x">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenWidth')}</label>
                        <input type="number" id="device-screen-width" class="form-input" value="${screenWidth}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenHeight')}</label>
                        <input type="number" id="device-screen-height" class="form-input" value="${screenHeight}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="device-group" class="form-select">
                        <option value="">${this._escapeHtml(this.__('form.placeholders.selectGroup'))}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="device-location" class="form-input" placeholder="${this._escapeHtml(this.__('form.placeholders.location'))}">
                </div>
            </form>
        `;

        Modal.show({
            title: this.__('addDevice'),
            icon: 'ti-device-desktop-plus',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this._saveDevice();
            }
        });
    }

    /**
     * Cihazı kaydet
     * @private
     */
    async _saveDevice() {
        const form = document.getElementById('device-form');
        if (!form) return;

        const data = {
            name: document.getElementById('device-name')?.value?.trim(),
            type: document.getElementById('device-type')?.value,
            status: document.getElementById('device-status')?.value,
            serial_number: document.getElementById('device-serial')?.value?.trim(),
            ip_address: document.getElementById('device-ip')?.value?.trim(),
            screen_width: parseInt(document.getElementById('device-screen-width')?.value) || null,
            screen_height: parseInt(document.getElementById('device-screen-height')?.value) || null,
            group_id: document.getElementById('device-group')?.value || null,
            location: document.getElementById('device-location')?.value?.trim(),
            communication_mode: this._selectedCommunicationMode || (this._mqttProtocolSelected ? 'mqtt' : 'http-server')
        };

        // MQTT modunda ise communication_mode ekle
        if (this._mqttProtocolSelected) {
            data.mqtt_client_id = data.serial_number || '';
        }

        // Include BT password for server-side encrypted storage
        if (!this._tokenBypassMode && this._deviceToken) {
            data.bt_password = this._deviceToken;
        }

        // Validation
        if (!data.name) {
            Toast.error(this.__('form.errors.nameRequired'));
            throw new Error('Validation failed');
        }

        // MQTT modunda IP zorunlu degil
        if (!data.ip_address && !this._mqttProtocolSelected) {
            Toast.error(this.__('bluetooth.wizard.ipRequired'));
            throw new Error('Validation failed');
        }

        if (data.ip_address && !this._isValidIpAddress(data.ip_address)) {
            Toast.error(this.__('bluetooth.wizard.invalidIpFormat'));
            throw new Error('Validation failed');
        }

        try {
            // Mevcut cihaz kontrolü - IP veya serial ile
            let existingDevice = null;

            if (data.ip_address) {
                existingDevice = await this._findExistingDeviceByIp(data.ip_address);
            }

            if (!existingDevice && data.serial_number) {
                existingDevice = await this._findExistingDeviceBySerial(data.serial_number);
            }

            if (existingDevice) {
                // Mevcut cihaz bulundu — güncelleme öner
                const existingName = existingDevice.name || existingDevice.id || 'Bilinmeyen';
                const confirmed = await new Promise(resolve => {
                    Modal.confirm({
                        title: this.__('bluetooth.wizard.deviceExists') || 'Cihaz Zaten Kayıtlı',
                        message: (this.__('bluetooth.wizard.updateExistingDevice', { name: existingName }) || `"${existingName}" cihazı zaten kayıtlı. Bilgilerini güncellemek ister misiniz?`),
                        type: 'warning',
                        confirmText: this.__('bluetooth.wizard.updateDevice') || 'Güncelle',
                        cancelText: this.__('modal.cancel') || 'İptal',
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false)
                    });
                });

                if (!confirmed) return;

                // Mevcut cihazı güncelle (PUT)
                const updateResponse = await this.app.api.put(`/devices/${existingDevice.id}`, data);
                if (updateResponse.success) {
                    Toast.success(this.__('bluetooth.wizard.deviceUpdated'));
                    if (this.onDeviceAdded) this.onDeviceAdded(updateResponse.data);
                    this.refreshDevices();
                } else {
                    Logger.error('BluetoothWizard: update device failed response', updateResponse);
                    throw new Error(this._extractApiErrorMessage(updateResponse, this.__('bluetooth.wizard.saveFailed')));
                }
                return;
            }

            // Yeni cihaz oluştur (POST)
            const response = await this.app.api.post('/devices', data);

            if (response.success) {
                Toast.success(this.__('bluetooth.wizard.deviceSaved'));

                // Callback to parent
                this.onDeviceAdded(response.data);
                this.refreshDevices();
            } else {
                Logger.error('BluetoothWizard: create device failed response', response);
                throw new Error(this._extractApiErrorMessage(response, this.__('bluetooth.wizard.saveFailed')));
            }
        } catch (error) {
            Toast.error(error.message || this.__('bluetooth.wizard.saveFailed'));
            throw error;
        }
    }

    /**
     * Temizlik
     */
    destroy() {
        // Disconnect Bluetooth if connected
        if (this.bluetoothService?.connected) {
            this.bluetoothService.disconnect();
        }

        // Close modal if open
        if (this.modal) {
            Modal.close(this.modal.id);
            this.modal = null;
        }
    }
}

/**
 * Module initializer
 * @param {Object} context - Context objesi
 * @returns {BluetoothWizard}
 */
export function init(context) {
    return new BluetoothWizard(context);
}
