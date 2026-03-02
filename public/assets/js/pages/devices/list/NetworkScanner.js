/**
 * NetworkScanner.js
 * Ağ tarama ve cihaz keşfi modülü
 *
 * Bu modül DeviceList.js'den ayrılmıştır (Faz 3, Adım 3.2)
 * PavoDisplay ve Hanshow ESL cihazlarının ağ taramasını yönetir.
 *
 * Tarih: 2026-01-25
 */

import { Modal } from '../../../components/Modal.js';
import { Toast } from '../../../components/Toast.js';

/**
 * NetworkScanner sınıfı
 * Ağ tarama modalı ve tarama işlemlerini yönetir
 */
class NetworkScanner {
    /**
     * @param {Object} context - Bağlam nesnesi
     * @param {Object} context.app - Ana uygulama instance
     * @param {Function} context.__ - i18n çeviri fonksiyonu
     * @param {Array} context.deviceGroups - Cihaz grupları
     * @param {Function} context.onDeviceAdded - Cihaz eklendiğinde callback
     * @param {Function} context.refreshDevices - Cihaz listesini yenile
     */
    constructor(context) {
        this.app = context.app;
        this.__ = context.__;
        this.deviceGroups = context.deviceGroups || [];
        this.onDeviceAdded = context.onDeviceAdded;
        this.refreshDevices = context.refreshDevices;

        // State
        this.scanModal = null;
        this.currentScanMode = 'single';
        this.currentDeviceType = 'pavodisplay';
        this.currentHanshowMode = 'barcode';
        this.defaultSubnet = '192.168.1';
        this.isScanning = false;
        this.gatewayReadiness = {
            loading: false,
            ready: false,
            message: 'Gateway status bilinmiyor',
            details: ''
        };
    }

    /**
     * Ağ tarama modalını göster
     */
    show() {
        const scanContent = `
            <div id="scan-container">
                <!-- Cihaz Tipi Seçimi -->
                <div class="scan-device-types" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                    <button type="button" class="btn btn-sm scan-type-tab active" data-device-type="pavodisplay">
                        <i class="ti ti-device-tablet"></i> PavoDisplay
                    </button>
                    <button type="button" class="btn btn-sm scan-type-tab" data-device-type="hanshow">
                        <i class="ti ti-tag"></i> Hanshow ESL
                    </button>
                </div>

                <!-- PavoDisplay Tarama Sekmeleri -->
                <div id="pavodisplay-scan-section">
                    <div class="scan-tabs" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
                        <button type="button" class="btn btn-sm scan-tab" data-mode="gateway">
                            <i class="ti ti-network"></i> ${this.__('scan.viaGateway')}
                        </button>
                        <button type="button" class="btn btn-sm scan-tab active" data-mode="single">
                            <i class="ti ti-focus-2"></i> ${this.__('scan.singleIp')}
                        </button>
                        <button type="button" class="btn btn-sm scan-tab" data-mode="range">
                            <i class="ti ti-arrows-horizontal"></i> ${this.__('scan.ipRange')}
                        </button>
                        <button type="button" class="btn btn-sm scan-tab" data-mode="fast">
                            <i class="ti ti-radar-2"></i> ${this.__('scan.fastScan')}
                        </button>
                        <button type="button" class="btn btn-sm scan-tab" data-mode="advanced" style="border-color: var(--color-success); color: var(--color-success);">
                            <i class="ti ti-radar"></i> ${this.__('scan.advancedScan')}
                        </button>
                    </div>
                </div>

                <!-- Hanshow ESL Tarama Bölümü -->
                <div id="hanshow-scan-section" style="display: none;">
                    <div class="alert alert-info" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        <div>
                            <strong>${this.__('scan.hanshowInfo')}</strong>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                                ${this.__('scan.hanshowInfoDesc')}
                            </p>
                        </div>
                    </div>

                    <!-- Hanshow Tarama Modları -->
                    <div class="hanshow-scan-modes" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <button type="button" class="btn btn-sm hanshow-mode-tab active btn-primary" data-hanshow-mode="barcode">
                            <i class="ti ti-barcode"></i> ${this.__('scan.byBarcode')}
                        </button>
                        <button type="button" class="btn btn-sm hanshow-mode-tab btn-outline" data-hanshow-mode="discover">
                            <i class="ti ti-radar-2"></i> ${this.__('scan.discoverAll')}
                        </button>
                    </div>

                    <!-- Barkod ile Arama Formu -->
                    <div id="hanshow-barcode-form">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label">${this.__('scan.eslIdBarcode')}</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <input type="text" id="hanshow-esl-barcode" class="form-input" style="flex: 1;"
                                    placeholder="${this.__('scan.barcodeHint')}"
                                    onkeypress="if(event.key==='Enter'){document.getElementById('hanshow-lookup-btn').click();return false;}">
                                <button type="button" id="hanshow-lookup-btn" class="btn btn-primary">
                                    <i class="ti ti-search"></i> ${this.__('scan.lookup')}
                                </button>
                            </div>
                            <p class="form-hint" style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('scan.barcodeTip')}
                            </p>
                        </div>
                    </div>

                    <!-- Tümünü Keşfet Modu Bilgisi -->
                    <div id="hanshow-discover-info" style="display: none;">
                        <div class="alert alert-secondary" style="margin-bottom: 1rem;">
                            <i class="ti ti-radar-2"></i>
                            <div>
                                <strong>${this.__('scan.discoverAllInfo')}</strong>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                                    ${this.__('scan.discoverAllDesc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div id="hanshow-connection-status" class="alert alert-warning" style="margin-bottom: 1rem; display: none;">
                        <i class="ti ti-alert-circle"></i>
                        <span id="hanshow-status-text"></span>
                    </div>
                </div>

                <div id="scan-gateway-form" class="scan-form" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">${this.__('scan.subnet')}</label>
                        <input type="text" id="scan-gateway-subnet" class="form-input"
                            value="192.168.1" placeholder="192.168.1">
                    </div>
                    <div class="alert alert-info" style="margin-top: 0.5rem;">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('scan.gatewayHint')}
                    </div>
                    <div id="scan-gateway-status" class="alert alert-secondary" style="margin-top: 0.5rem;">
                        <i class="ti ti-loader-2 ti-spin"></i>
                        <span>Gateway status kontrol ediliyor...</span>
                    </div>
                </div>

                <div id="scan-single-form" class="scan-form">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                        <input type="text" id="scan-single-ip" class="form-input"
                            value="192.168.1.173" placeholder="192.168.1.xxx">
                        <p class="form-hint">${this.__('scan.singleIpHint')}</p>
                    </div>
                </div>

                <div id="scan-range-form" class="scan-form" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">${this.__('scan.subnet')}</label>
                        <input type="text" id="scan-subnet" class="form-input"
                            value="192.168.1" placeholder="192.168.1">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('scan.startIp')}</label>
                            <input type="number" id="scan-start-ip" class="form-input"
                                value="1" min="1" max="254">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('scan.endIp')}</label>
                            <input type="number" id="scan-end-ip" class="form-input"
                                value="254" min="1" max="254">
                        </div>
                    </div>
                    <p class="form-hint">${this.__('scan.rangeHint')}</p>
                </div>

                <div id="scan-fast-form" class="scan-form" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">${this.__('scan.subnet')}</label>
                        <input type="text" id="scan-fast-subnet" class="form-input"
                            value="192.168.1" placeholder="192.168.1">
                    </div>
                    <p class="form-hint">${this.__('scan.fastHint')}</p>
                </div>

                <!-- Gelişmiş Tarama Formu (Multi-Subnet + Profil + Ping Sweep) -->
                <div id="scan-advanced-form" class="scan-form" style="display: none;">
                    <div class="alert alert-info" style="margin-bottom: 1rem;">
                        <i class="ti ti-info-circle"></i>
                        <div>
                            <strong>${this.__('scan.advancedInfo')}</strong>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                                ${this.__('scan.advancedInfoDesc')}
                            </p>
                        </div>
                    </div>

                    <!-- Multi-Subnet Girişi -->
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label class="form-label">
                            <i class="ti ti-network"></i> ${this.__('scan.multiSubnet')}
                        </label>
                        <div id="subnet-list-container">
                            <div class="subnet-entry" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <input type="text" class="form-input subnet-input" value="192.168.1" placeholder="192.168.1" style="flex: 1;">
                                <button type="button" class="btn btn-sm btn-outline remove-subnet-btn" style="display: none;" title="${this.__('actions.delete')}">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" id="add-subnet-btn" class="btn btn-sm btn-outline" style="margin-top: 0.25rem;">
                            <i class="ti ti-plus"></i> ${this.__('scan.addSubnet')}
                        </button>
                        <p class="form-hint" style="margin-top: 0.25rem;">
                            ${this.__('scan.multiSubnetHint')}
                        </p>
                    </div>

                    <!-- IP Aralığı -->
                    <div class="grid grid-cols-2 gap-4" style="margin-bottom: 1rem;">
                        <div class="form-group">
                            <label class="form-label">${this.__('scan.startIp')}</label>
                            <input type="number" id="scan-adv-start-ip" class="form-input" value="1" min="1" max="254">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('scan.endIp')}</label>
                            <input type="number" id="scan-adv-end-ip" class="form-input" value="254" min="1" max="254">
                        </div>
                    </div>

                    <!-- Keşif Profilleri -->
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label class="form-label">
                            <i class="ti ti-fingerprint"></i> ${this.__('scan.discoveryProfiles')}
                        </label>
                        <div id="profile-checkboxes" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            <label class="scan-profile-chip active" style="
                                display: inline-flex; align-items: center; gap: 0.4rem;
                                padding: 0.4rem 0.75rem; border-radius: 20px;
                                border: 2px solid #228be6; background: rgba(34,139,230,0.1);
                                cursor: pointer; font-size: 0.875rem; user-select: none;
                                transition: all 0.2s;">
                                <input type="checkbox" class="profile-checkbox" value="pavodisplay" checked style="display: none;">
                                <i class="ti ti-device-tablet" style="color: #228be6;"></i>
                                <span>PavoDisplay</span>
                            </label>
                            <label class="scan-profile-chip" style="
                                display: inline-flex; align-items: center; gap: 0.4rem;
                                padding: 0.4rem 0.75rem; border-radius: 20px;
                                border: 2px solid var(--border-color); background: transparent;
                                cursor: pointer; font-size: 0.875rem; user-select: none;
                                transition: all 0.2s;">
                                <input type="checkbox" class="profile-checkbox" value="generic_android_esl" style="display: none;">
                                <i class="ti ti-device-mobile" style="color: #40c057;"></i>
                                <span>Android ESL</span>
                            </label>
                            <label class="scan-profile-chip" style="
                                display: inline-flex; align-items: center; gap: 0.4rem;
                                padding: 0.4rem 0.75rem; border-radius: 20px;
                                border: 2px solid var(--border-color); background: transparent;
                                cursor: pointer; font-size: 0.875rem; user-select: none;
                                transition: all 0.2s;">
                                <input type="checkbox" class="profile-checkbox" value="generic_signage" style="display: none;">
                                <i class="ti ti-device-tv" style="color: #fab005;"></i>
                                <span>Signage / TV</span>
                            </label>
                            <label class="scan-profile-chip" style="
                                display: inline-flex; align-items: center; gap: 0.4rem;
                                padding: 0.4rem 0.75rem; border-radius: 20px;
                                border: 2px solid var(--border-color); background: transparent;
                                cursor: pointer; font-size: 0.875rem; user-select: none;
                                transition: all 0.2s;">
                                <input type="checkbox" class="profile-checkbox" value="generic_http" style="display: none;">
                                <i class="ti ti-world" style="color: #868e96;"></i>
                                <span>HTTP (Tümü)</span>
                            </label>
                        </div>
                        <p class="form-hint" style="margin-top: 0.25rem;">
                            ${this.__('scan.profilesHint')}
                        </p>
                    </div>

                    <!-- Tarama Modu Seçimi -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="ti ti-scan"></i> ${this.__('scan.scanMethod')}
                        </label>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                <input type="radio" name="adv-scan-method" value="advanced" checked>
                                <span style="font-size: 0.875rem;">${this.__('scan.methodProfileBased')}</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                <input type="radio" name="adv-scan-method" value="ping_sweep">
                                <span style="font-size: 0.875rem;">${this.__('scan.methodPingSweep')}</span>
                            </label>
                        </div>
                        <p class="form-hint" style="margin-top: 0.25rem;">
                            ${this.__('scan.scanMethodHint')}
                        </p>
                    </div>
                </div>

                <div id="scan-progress" style="display: none; margin-top: 1rem;">
                    <div class="progress-bar-container" style="height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                        <div id="scan-progress-bar" style="height: 100%; width: 0%; background: var(--color-primary); transition: width 0.3s;"></div>
                    </div>
                    <p id="scan-progress-text" style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
                        ${this.__('scan.scanning')}
                    </p>
                </div>

                <div id="scan-results" style="display: none; margin-top: 1rem;">
                    <h4 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ti ti-device-tablet"></i>
                        ${this.__('scan.foundDevices')}
                        <span id="scan-results-count" class="badge badge-primary">0</span>
                    </h4>
                    <div id="scan-results-list" style="max-height: 300px; overflow-y: auto;"></div>
                </div>
            </div>
        `;

        this.scanModal = Modal.show({
            title: this.__('scanNetwork'),
            icon: 'ti-radar-2',
            content: scanContent,
            size: 'md',
            showFooter: false,
            onClose: () => {
                this.scanModal = null;
            }
        });

        // Tab switch events + subnet defaults
        setTimeout(async () => {
            this._bindEvents();
            await this._refreshSubnetDefaults();
            await this._refreshGatewayStatus();
        }, 100);
    }

    _extractSubnetFromIp(ipAddress) {
        const value = String(ipAddress || '').trim();
        const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
        if (!match) return null;

        const octets = [match[1], match[2], match[3]].map(Number);
        if (octets.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
            return null;
        }

        return `${octets[0]}.${octets[1]}.${octets[2]}`;
    }

    _isValidSubnet(subnet) {
        const value = String(subnet || '').trim();
        const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (!match) return false;
        return [match[1], match[2], match[3]].every(part => {
            const octet = Number(part);
            return Number.isInteger(octet) && octet >= 0 && octet <= 255;
        });
    }

    _normalizeSubnet(rawSubnet) {
        const value = String(rawSubnet || '').trim();
        return this._isValidSubnet(value) ? value : null;
    }

    async _detectSuggestedSubnet() {
        let subnet = this.defaultSubnet;

        const hostSubnet = this._extractSubnetFromIp(window.location.hostname);
        if (hostSubnet) {
            subnet = hostSubnet;
        }

        try {
            const response = await this.app.api.get('/gateways');
            const gateways = Array.isArray(response?.data) ? response.data : [];
            const onlineGateway = gateways.find(g => g?.status === 'online') || gateways[0];
            const gatewaySubnet = this._extractSubnetFromIp(onlineGateway?.local_ip);
            if (gatewaySubnet) {
                subnet = gatewaySubnet;
            }
        } catch (_) {
            // Gateway listesi yoksa host subnet fallback'i kullan.
        }

        return subnet;
    }

    _parseTimestamp(rawTimestamp) {
        const value = String(rawTimestamp || '').trim();
        if (!value) return null;
        const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    _formatSecondsAgo(rawTimestamp) {
        const parsed = this._parseTimestamp(rawTimestamp);
        if (!parsed) return null;

        let seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;

        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}dk`;
        return `${Math.floor(seconds / 3600)}sa`;
    }

    _syncStartButtonState() {
        const startBtn = document.getElementById('start-scan-btn');
        if (!startBtn) return;

        if (this.isScanning) {
            startBtn.disabled = true;
            return;
        }

        const gatewayBlocked = this.currentDeviceType === 'pavodisplay'
            && this.currentScanMode === 'gateway'
            && !this.gatewayReadiness.ready;

        startBtn.disabled = gatewayBlocked;
        startBtn.title = gatewayBlocked
            ? (this.gatewayReadiness.message || 'Gateway hazir degil')
            : '';
    }

    _renderGatewayStatus() {
        const statusEl = document.getElementById('scan-gateway-status');
        if (!statusEl) {
            this._syncStartButtonState();
            return;
        }

        let cssClass = 'alert alert-secondary';
        let icon = 'ti ti-info-circle';

        if (this.gatewayReadiness.loading) {
            cssClass = 'alert alert-secondary';
            icon = 'ti ti-loader-2 ti-spin';
        } else if (this.gatewayReadiness.ready) {
            cssClass = 'alert alert-success';
            icon = 'ti ti-circle-check';
        } else {
            cssClass = 'alert alert-warning';
            icon = 'ti ti-alert-triangle';
        }

        const details = this.gatewayReadiness.details
            ? `<small style="display:block; margin-top:0.25rem; opacity:0.8;">${this.gatewayReadiness.details}</small>`
            : '';

        statusEl.className = cssClass;
        statusEl.innerHTML = `
            <i class="${icon}"></i>
            <span>${this.gatewayReadiness.message || 'Gateway status bilinmiyor'}${details}</span>
        `;

        this._syncStartButtonState();
    }

    async _refreshGatewayStatus() {
        this.gatewayReadiness = {
            loading: true,
            ready: false,
            message: 'Gateway status kontrol ediliyor...',
            details: ''
        };
        this._renderGatewayStatus();

        try {
            const response = await this.app.api.get('/gateways');
            const gateways = Array.isArray(response?.data) ? response.data : [];

            if (gateways.length === 0) {
                this.gatewayReadiness = {
                    loading: false,
                    ready: false,
                    message: 'Kayitli gateway bulunamadi.',
                    details: 'Gateway mode icin once local gateway kaydi yapin.'
                };
                this._renderGatewayStatus();
                return this.gatewayReadiness;
            }

            const onlineGateway = gateways.find(gw => gw?.status === 'online');
            if (!onlineGateway) {
                this.gatewayReadiness = {
                    loading: false,
                    ready: false,
                    message: 'Gateway hazir degil (offline).',
                    details: `Toplam gateway: ${gateways.length}`
                };
                this._renderGatewayStatus();
                return this.gatewayReadiness;
            }

            const heartbeatText = this._formatSecondsAgo(onlineGateway.last_heartbeat);
            const heartbeatFresh = (() => {
                const dt = this._parseTimestamp(onlineGateway.last_heartbeat);
                if (!dt) return false;
                return ((Date.now() - dt.getTime()) / 1000) <= 120;
            })();

            this.gatewayReadiness = {
                loading: false,
                ready: heartbeatFresh,
                message: heartbeatFresh
                    ? 'Gateway hazir.'
                    : 'Gateway online ama heartbeat eski.',
                details: `${onlineGateway.name || 'Gateway'} - ${onlineGateway.local_ip || 'IP yok'}${heartbeatText ? ` - son heartbeat ${heartbeatText} once` : ''}`
            };
            this._renderGatewayStatus();
            return this.gatewayReadiness;
        } catch (_) {
            this.gatewayReadiness = {
                loading: false,
                ready: false,
                message: 'Gateway status alinamadi.',
                details: 'Gateway listesi okunurken baglanti hatasi olustu.'
            };
            this._renderGatewayStatus();
            return this.gatewayReadiness;
        }
    }

    _getEstimatedTargetCount(mode) {
        if (mode === 'single') return 1;
        if (mode === 'range') {
            const startIp = parseInt(document.getElementById('scan-start-ip')?.value, 10) || 1;
            const endIp = parseInt(document.getElementById('scan-end-ip')?.value, 10) || 254;
            return Math.max(1, Math.min(254, Math.abs(endIp - startIp) + 1));
        }
        return 254;
    }

    _startProgressEstimator(mode) {
        const progressBar = document.getElementById('scan-progress-bar');
        const progressText = document.getElementById('scan-progress-text');
        const totalTargets = this._getEstimatedTargetCount(mode);
        const maxBeforeDone = 88;
        const tickMs = 500;
        let progress = mode === 'single' ? 15 : 4;

        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) {
            progressText.textContent = mode === 'gateway'
                ? `Gateway uzerinden taraniyor... 0/${totalTargets} IP`
                : `Taraniyor... 0/${totalTargets} IP`;
        }

        const timer = setInterval(() => {
            const step = mode === 'single' ? 28 : 4;
            progress = Math.min(maxBeforeDone, progress + step);

            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) {
                const estimatedScanned = Math.min(
                    totalTargets,
                    Math.max(1, Math.floor((progress / maxBeforeDone) * totalTargets))
                );
                if (progress >= 80) {
                    progressText.textContent = 'Tarama tamamlanmak uzere, cihaz listesi hazirlaniyor...';
                } else {
                    progressText.textContent = mode === 'gateway'
                        ? `Gateway uzerinden taraniyor... ${estimatedScanned}/${totalTargets} IP`
                        : `Taraniyor... ${estimatedScanned}/${totalTargets} IP`;
                }
            }
        }, tickMs);

        return () => clearInterval(timer);
    }

    _applySubnetDefaults(subnet) {
        if (!this._isValidSubnet(subnet)) return;
        this.defaultSubnet = subnet;

        // Advanced formun ilk subnet inputunu da güncelle
        const firstAdvSubnet = document.querySelector('#subnet-list-container .subnet-input');
        if (firstAdvSubnet) {
            const current = firstAdvSubnet.value?.trim();
            if (!current || current === '192.168.1') {
                firstAdvSubnet.value = subnet;
            }
        }

        const subnetFields = ['scan-gateway-subnet', 'scan-subnet', 'scan-fast-subnet'];
        subnetFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (!input) return;
            const current = input.value?.trim();
            if (!current || current === '192.168.1') {
                input.value = subnet;
            }
            input.placeholder = subnet;
        });

        const singleInput = document.getElementById('scan-single-ip');
        if (singleInput) {
            const current = singleInput.value?.trim();
            if (!current || current === '192.168.1.173') {
                singleInput.value = `${subnet}.173`;
            }
            singleInput.placeholder = `${subnet}.x`;
        }
    }

    /**
     * Advanced forma yeni subnet girişi ekle
     */
    _addSubnetEntry() {
        const container = document.getElementById('subnet-list-container');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'subnet-entry';
        entry.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
        entry.innerHTML = `
            <input type="text" class="form-input subnet-input" value="" placeholder="192.168.x" style="flex: 1;">
            <button type="button" class="btn btn-sm btn-outline remove-subnet-btn" title="${this.__('actions.delete')}" style="color: var(--color-danger);">
                <i class="ti ti-x"></i>
            </button>
        `;

        entry.querySelector('.remove-subnet-btn')?.addEventListener('click', () => {
            entry.remove();
            this._updateRemoveButtons();
        });

        container.appendChild(entry);
        this._updateRemoveButtons();

        // Focus the new input
        entry.querySelector('.subnet-input')?.focus();
    }

    /**
     * Kaldır butonlarının görünürlüğünü güncelle (en az 1 subnet kalmalı)
     */
    _updateRemoveButtons() {
        const entries = document.querySelectorAll('#subnet-list-container .subnet-entry');
        entries.forEach((entry, idx) => {
            const btn = entry.querySelector('.remove-subnet-btn');
            if (btn) {
                btn.style.display = entries.length > 1 ? 'inline-flex' : 'none';
            }
        });

        // İlk entry'deki remove butonuna da event bağla
        entries.forEach(entry => {
            const btn = entry.querySelector('.remove-subnet-btn');
            if (btn && !btn._bound) {
                btn._bound = true;
                btn.addEventListener('click', () => {
                    if (entries.length > 1) {
                        entry.remove();
                        this._updateRemoveButtons();
                    }
                });
            }
        });
    }

    /**
     * Advanced formdan subnet listesini al
     */
    _getSubnetsFromForm() {
        const inputs = document.querySelectorAll('#subnet-list-container .subnet-input');
        const subnets = [];
        inputs.forEach(input => {
            const val = this._normalizeSubnet(input.value?.trim());
            if (val) subnets.push(val);
        });
        return subnets.length > 0 ? subnets : [this.defaultSubnet];
    }

    /**
     * Advanced formdan seçili profilleri al
     */
    _getSelectedProfiles() {
        const checkboxes = document.querySelectorAll('.profile-checkbox:checked');
        const profiles = [];
        checkboxes.forEach(cb => profiles.push(cb.value));
        return profiles.length > 0 ? profiles : ['pavodisplay'];
    }

    async _refreshSubnetDefaults() {
        const subnet = await this._detectSuggestedSubnet();
        this._applySubnetDefaults(subnet);
    }

    /**
     * Modal event'lerini bağla
     * @private
     */
    _bindEvents() {
        // Device type tabs (PavoDisplay / Hanshow)
        document.querySelectorAll('.scan-type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const deviceType = e.currentTarget.dataset.deviceType;
                this.switchScanDeviceType(deviceType);
            });
        });

        // PavoDisplay scan mode tabs
        document.querySelectorAll('.scan-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchScanTab(mode);
            });
        });

        // Add scan button to modal footer
        const modalFooter = this.scanModal.element.querySelector('.modal-footer');
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button type="button" class="btn btn-outline" data-modal-close>
                    ${this.__('modal.cancel')}
                </button>
                <button type="button" id="start-scan-btn" class="btn btn-primary">
                    <i class="ti ti-search"></i>
                    ${this.__('scan.startScan')}
                </button>
            `;
            modalFooter.style.display = 'flex';
        } else {
            // Fallback: add button inside content
            const container = document.getElementById('scan-container');
            if (container) {
                const btnDiv = document.createElement('div');
                btnDiv.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;';
                btnDiv.innerHTML = `
                    <button type="button" id="start-scan-btn" class="btn btn-primary">
                        <i class="ti ti-search"></i>
                        ${this.__('scan.startScan')}
                    </button>
                `;
                container.appendChild(btnDiv);
            }
        }

        document.getElementById('start-scan-btn')?.addEventListener('click', () => {
            this.startNetworkScan();
        });

        // Advanced form: Subnet ekle/kaldır
        document.getElementById('add-subnet-btn')?.addEventListener('click', () => {
            this._addSubnetEntry();
        });

        // Profile checkbox toggle styling
        document.querySelectorAll('.profile-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const label = e.target.closest('.scan-profile-chip');
                if (!label) return;
                const colorMap = {
                    pavodisplay: '#228be6',
                    generic_android_esl: '#40c057',
                    generic_signage: '#fab005',
                    generic_http: '#868e96'
                };
                const color = colorMap[e.target.value] || 'var(--border-color)';
                if (e.target.checked) {
                    label.classList.add('active');
                    label.style.borderColor = color;
                    label.style.background = `${color}15`;
                } else {
                    label.classList.remove('active');
                    label.style.borderColor = 'var(--border-color)';
                    label.style.background = 'transparent';
                }
            });
        });

        // Hanshow mode tabs (barcode / discover)
        document.querySelectorAll('.hanshow-mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.hanshowMode;
                this.switchHanshowMode(mode);
            });
        });

        // Hanshow barcode lookup button
        document.getElementById('hanshow-lookup-btn')?.addEventListener('click', () => {
            this.lookupHanshowEsl();
        });

        this._syncStartButtonState();
    }

    /**
     * Hanshow tarama modunu değiştir (barcode / discover)
     * @param {string} mode - 'barcode' veya 'discover'
     */
    switchHanshowMode(mode) {
        this.currentHanshowMode = mode;

        // Update tabs
        document.querySelectorAll('.hanshow-mode-tab').forEach(tab => {
            const isActive = tab.dataset.hanshowMode === mode;
            tab.classList.toggle('active', isActive);
            tab.classList.toggle('btn-primary', isActive);
            tab.classList.toggle('btn-outline', !isActive);
        });

        // Show/hide forms
        const barcodeForm = document.getElementById('hanshow-barcode-form');
        const discoverInfo = document.getElementById('hanshow-discover-info');

        if (mode === 'barcode') {
            if (barcodeForm) barcodeForm.style.display = 'block';
            if (discoverInfo) discoverInfo.style.display = 'none';
        } else {
            if (barcodeForm) barcodeForm.style.display = 'none';
            if (discoverInfo) discoverInfo.style.display = 'block';
        }
    }

    /**
     * Cihaz tipi sekmesini değiştir (PavoDisplay / Hanshow)
     * @param {string} deviceType - 'pavodisplay' veya 'hanshow'
     */
    switchScanDeviceType(deviceType) {
        this.currentDeviceType = deviceType;

        // Update tabs
        document.querySelectorAll('.scan-type-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.deviceType === deviceType);
        });

        // Show/hide sections
        const pavoSection = document.getElementById('pavodisplay-scan-section');
        const hanshowSection = document.getElementById('hanshow-scan-section');
        const scanForms = document.querySelectorAll('.scan-form');

        if (deviceType === 'pavodisplay') {
            if (pavoSection) pavoSection.style.display = 'block';
            if (hanshowSection) hanshowSection.style.display = 'none';
            // Show appropriate scan form
            this.switchScanTab(this.currentScanMode || 'single');
        } else {
            if (pavoSection) pavoSection.style.display = 'none';
            if (hanshowSection) hanshowSection.style.display = 'block';
            // Hide all scan forms for PavoDisplay
            scanForms.forEach(form => form.style.display = 'none');
        }

        // Clear results
        const resultsEl = document.getElementById('scan-results');
        if (resultsEl) resultsEl.style.display = 'none';

        this._syncStartButtonState();
    }

    /**
     * PavoDisplay tarama sekmesini değiştir
     * @param {string} mode - 'gateway', 'single', 'range', 'fast'
     */
    switchScanTab(mode) {
        this.currentScanMode = mode;

        // Update tab buttons
        document.querySelectorAll('.scan-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Show/hide forms
        document.querySelectorAll('.scan-form').forEach(form => {
            form.style.display = 'none';
        });
        document.getElementById(`scan-${mode}-form`)?.style.setProperty('display', 'block');

        if (mode === 'gateway') {
            this._refreshGatewayStatus();
        } else {
            this._syncStartButtonState();
        }
    }

    /**
     * Ağ taramasını başlat
     */
    async startNetworkScan() {
        // Hanshow modu
        if (this.currentDeviceType === 'hanshow') {
            return this.startHanshowScan();
        }

        // PavoDisplay modu
        const progressEl = document.getElementById('scan-progress');
        const progressBar = document.getElementById('scan-progress-bar');
        const progressText = document.getElementById('scan-progress-text');
        const resultsEl = document.getElementById('scan-results');

        if (progressEl) progressEl.style.display = 'block';
        if (resultsEl) resultsEl.style.display = 'none';
        this.isScanning = true;
        this._syncStartButtonState();
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = this.__('scan.scanning');

        let stopEstimator = () => {};
        try {
            let devices = [];
            const mode = this.currentScanMode;
            stopEstimator = this._startProgressEstimator(mode);

            if (mode === 'gateway') {
                const gatewayStatus = await this._refreshGatewayStatus();
                if (!gatewayStatus.ready) {
                    Toast.error(gatewayStatus.message || 'Gateway hazir degil');
                    return;
                }

                const subnet = this._normalizeSubnet(
                    document.getElementById('scan-gateway-subnet')?.value?.trim()
                ) || this.defaultSubnet;
                const response = await this.app.api.post('/devices/scan', {
                    mode: 'gateway',
                    subnet: subnet
                });
                if (response.success) {
                    devices = response.data?.devices || [];
                }
            } else if (mode === 'single') {
                const ip = document.getElementById('scan-single-ip')?.value?.trim();
                if (!ip) {
                    Toast.error(this.__('scan.ipRequired'));
                    return;
                }
                const response = await this.app.api.post('/devices/scan', {
                    mode: 'single',
                    ip: ip
                });
                if (response.success && response.data) {
                    devices = response.data.devices || (response.data.found ? [response.data] : []);
                }
            } else if (mode === 'range') {
                const subnet = this._normalizeSubnet(
                    document.getElementById('scan-subnet')?.value?.trim()
                ) || this.defaultSubnet;
                const startIp = parseInt(document.getElementById('scan-start-ip')?.value) || 1;
                const endIp = parseInt(document.getElementById('scan-end-ip')?.value) || 254;
                const response = await this.app.api.post('/devices/scan', {
                    mode: 'range',
                    subnet: subnet,
                    start_ip: startIp,
                    end_ip: endIp
                });
                if (response.success) {
                    devices = response.data?.devices || [];
                }
            } else if (mode === 'fast') {
                const subnet = this._normalizeSubnet(
                    document.getElementById('scan-fast-subnet')?.value?.trim()
                ) || this.defaultSubnet;
                const response = await this.app.api.post('/devices/scan', {
                    mode: 'fast',
                    subnet: subnet
                });
                if (response.success) {
                    devices = response.data?.devices || [];
                }
            } else if (mode === 'advanced') {
                const subnets = this._getSubnetsFromForm();
                const profiles = this._getSelectedProfiles();
                const scanMethod = document.querySelector('input[name="adv-scan-method"]:checked')?.value || 'advanced';
                const startIp = parseInt(document.getElementById('scan-adv-start-ip')?.value) || 1;
                const endIp = parseInt(document.getElementById('scan-adv-end-ip')?.value) || 254;

                if (progressText) {
                    const subnetText = subnets.join(', ');
                    progressText.innerHTML = `<strong>${subnets.length}</strong> subnet taraniyor: ${subnetText}<br>` +
                        `<small>Profiller: ${profiles.join(', ')} | Mod: ${scanMethod}</small>`;
                }

                const response = await this.app.api.post('/devices/scan', {
                    mode: scanMethod,
                    subnets: subnets,
                    profiles: profiles,
                    start_ip: startIp,
                    end_ip: endIp,
                });
                if (response.success) {
                    devices = response.data?.devices || [];
                }
            }

            stopEstimator();
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) {
                progressText.textContent = `Tarama tamamlandi. ${devices.length} cihaz bulundu.`;
            }
            this.showScanResults(devices);

        } catch (error) {
            stopEstimator();
            if (progressText) {
                progressText.textContent = 'Tarama hatasi olustu.';
            }
            Toast.error(error.message || this.__('scan.failed'));
        } finally {
            this.isScanning = false;
            this._syncStartButtonState();
            if (progressEl) progressEl.style.display = 'none';
        }
    }

    /**
     * Tarama sonuçlarını göster (PavoDisplay)
     * @param {Array} devices - Bulunan cihazlar
     */
    showScanResults(devices) {
        const resultsEl = document.getElementById('scan-results');
        const resultsList = document.getElementById('scan-results-list');
        const countEl = document.getElementById('scan-results-count');

        if (!resultsEl || !resultsList) return;

        resultsEl.style.display = 'block';
        if (countEl) countEl.textContent = devices.length;

        if (devices.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <i class="ti ti-device-tablet-off" style="font-size: 3rem; opacity: 0.5;"></i>
                    <p style="margin-top: 0.5rem;">${this.__('scan.noDevices')}</p>
                </div>
            `;
            return;
        }

        resultsList.innerHTML = devices.map(device => {
            const profileIcon = device.profile_icon || 'ti-device-tablet';
            const profileColor = device.profile_color || '#228be6';
            const profileName = device.profile_name || 'PavoDisplay';
            const subnetBadge = device.subnet ? `<span class="badge badge-outline" style="font-size: 0.7rem; margin-left: 0.25rem;">${device.subnet}.x</span>` : '';
            const manufacturer = device.manufacturer && device.manufacturer !== 'Unknown' ? device.manufacturer : '';
            const portInfo = device.port && device.port !== 80 ? `:${device.port}` : '';
            const responseTime = device.response_time ? `${Math.round(device.response_time)}ms` : '';

            return `
            <div class="scan-result-item" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                background: ${device.is_registered ? 'var(--bg-secondary)' : 'var(--bg-primary)'};
            ">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 8px;
                        background: linear-gradient(135deg, ${profileColor}, ${profileColor}cc);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                    ">
                        <i class="ti ${profileIcon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500;">
                            ${device.ip}${portInfo}
                            ${subnetBadge}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-muted);">
                            ${device.client_id || 'Unknown'}
                            ${device.screen_width && device.screen_height && device.screen_width > 0 ? ` (${device.screen_width}x${device.screen_height})` : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.15rem;">
                            <span style="
                                display: inline-flex; align-items: center; gap: 0.2rem;
                                padding: 0.1rem 0.4rem; border-radius: 10px;
                                background: ${profileColor}15; color: ${profileColor};
                                font-size: 0.7rem; font-weight: 500;">
                                <i class="ti ${profileIcon}" style="font-size: 0.7rem;"></i>
                                ${profileName}
                            </span>
                            ${manufacturer ? `<span style="opacity: 0.7;">${manufacturer}</span>` : ''}
                            ${device.firmware ? `<span style="opacity: 0.7;">v${device.firmware}</span>` : ''}
                            ${responseTime ? `<span style="opacity: 0.7;"><i class="ti ti-clock" style="font-size: 0.7rem;"></i> ${responseTime}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div>
                    ${device.is_registered
                        ? `<span class="badge badge-secondary">${this.__('scan.registered')}</span>`
                        : `<button type="button" class="btn btn-sm btn-primary add-scanned-device"
                            data-ip="${device.ip}"
                            data-client-id="${device.client_id || ''}"
                            data-screen-width="${device.screen_width || 800}"
                            data-screen-height="${device.screen_height || 1280}"
                            data-profile="${device.profile || 'pavodisplay'}"
                            data-manufacturer="${device.manufacturer || ''}"
                            data-type="${device.type || 'esl_android'}">
                            <i class="ti ti-plus"></i>
                            ${this.__('scan.addDevice')}
                        </button>`
                    }
                </div>
            </div>
        `}).join('');

        // Bind add button events
        resultsList.querySelectorAll('.add-scanned-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = e.currentTarget.dataset;
                this.addScannedDevice({
                    ip: data.ip,
                    client_id: data.clientId,
                    screen_width: parseInt(data.screenWidth),
                    screen_height: parseInt(data.screenHeight),
                    profile: data.profile || 'pavodisplay',
                    manufacturer: data.manufacturer || '',
                    type: data.type || 'esl_android',
                });
            });
        });
    }

    /**
     * Taranan PavoDisplay cihazını ekle
     * @param {Object} deviceData - Cihaz verileri
     */
    async addScannedDevice(deviceData) {
        // Close scan modal
        if (this.scanModal) {
            Modal.close(this.scanModal.id);
        }

        // Open device form with pre-filled data
        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${g.id}">${g.name}</option>`
        ).join('');

        const profileLabel = deviceData.manufacturer || deviceData.profile || 'PavoDisplay';
        const defaultName = `${profileLabel} ${deviceData.client_id || deviceData.ip}`;
        const isSignage = deviceData.type === 'android_tv';
        const defaultType = isSignage ? 'android_tv' : (deviceData.type === 'esl_android' ? 'esl' : 'esl');

        const formContent = `
            <form id="device-form" class="space-y-4">
                <div class="alert alert-info" style="margin-bottom: 1rem;">
                    <i class="ti ti-device-tablet"></i>
                    <div>
                        <strong>${this.__('scan.deviceFound')}</strong>
                        <p>IP: ${deviceData.ip}</p>
                        ${deviceData.client_id ? `<p>Client ID: ${deviceData.client_id}</p>` : ''}
                        ${deviceData.screen_width > 0 ? `<p>${this.__('scan.screenSize')}: ${deviceData.screen_width}x${deviceData.screen_height}</p>` : ''}
                        ${deviceData.manufacturer ? `<p>${this.__('scan.manufacturer')}: ${deviceData.manufacturer}</p>` : ''}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="device-name" class="form-input" required
                        value="${defaultName}" placeholder="${this.__('form.placeholders.name')}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.type')} *</label>
                        <select id="device-type" class="form-select" required>
                            <option value="esl" ${defaultType === 'esl' ? 'selected' : ''}>ESL</option>
                            <option value="esl_android" ${defaultType === 'esl_android' ? 'selected' : ''}>ESL Tablet</option>
                            <option value="android_tv" ${defaultType === 'android_tv' ? 'selected' : ''}>Signage / TV</option>
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
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="device-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.serialNumber')}</label>
                    <input type="text" id="device-serial" class="form-input"
                        value="${deviceData.client_id || ''}" placeholder="${this.__('form.placeholders.serialNumber')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                    <input type="text" id="device-ip" class="form-input"
                        value="${deviceData.ip}" placeholder="${this.__('form.placeholders.ipAddress')}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="device-location" class="form-input"
                        value="" placeholder="${this.__('form.placeholders.location')}">
                </div>
                <input type="hidden" id="device-id" value="">
                <input type="hidden" id="device-screen-width" value="${deviceData.screen_width}">
                <input type="hidden" id="device-screen-height" value="${deviceData.screen_height}">
            </form>
        `;

        Modal.show({
            title: this.__('addDevice'),
            icon: 'ti-device-tablet',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this._saveDevice(deviceData);
            }
        });
    }

    /**
     * PavoDisplay cihazını kaydet
     * @param {Object} deviceData - Orijinal cihaz verileri
     * @private
     */
    async _saveDevice(deviceData) {
        const name = document.getElementById('device-name')?.value?.trim();
        const type = document.getElementById('device-type')?.value;
        const status = document.getElementById('device-status')?.value;
        const groupId = document.getElementById('device-group')?.value;
        const serial = document.getElementById('device-serial')?.value?.trim();
        const location = document.getElementById('device-location')?.value?.trim();
        const screenWidth = document.getElementById('device-screen-width')?.value;
        const screenHeight = document.getElementById('device-screen-height')?.value;

        if (!name) {
            Toast.error(this.__('form.errors.nameRequired'));
            throw new Error('Name required');
        }

        try {
            const response = await this.app.api.post('/devices', {
                name: name,
                type: type || 'esl',
                model: 'esl_android',
                serial_number: serial || deviceData.client_id || '',
                ip_address: deviceData.ip,
                status: status || 'online',
                group_id: groupId || null,
                location: location || null,
                screen_width: parseInt(screenWidth) || deviceData.screen_width,
                screen_height: parseInt(screenHeight) || deviceData.screen_height,
                manufacturer: deviceData.manufacturer || 'PavoDisplay'
            });

            if (response.success) {
                Toast.success(this.__('messages.deviceCreated'));
                if (this.onDeviceAdded) this.onDeviceAdded();
                if (this.refreshDevices) this.refreshDevices();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.saveFailed'));
            throw error;
        }
    }

    // ==========================================
    // HANSHOW ESL SCAN METHODS
    // ==========================================

    /**
     * Barkod/ESL ID ile tek bir ESL cihazını ara
     */
    async lookupHanshowEsl() {
        const barcodeInput = document.getElementById('hanshow-esl-barcode');
        const lookupBtn = document.getElementById('hanshow-lookup-btn');
        const resultsEl = document.getElementById('scan-results');
        const resultsList = document.getElementById('scan-results-list');

        const barcode = barcodeInput?.value?.trim();

        if (!barcode) {
            Toast.error(this.__('scan.barcodeRequired'));
            barcodeInput?.focus();
            return;
        }

        // Disable button and show loading
        if (lookupBtn) {
            lookupBtn.disabled = true;
            lookupBtn.innerHTML = `<i class="ti ti-loader-2 ti-spin"></i> ${this.__('scan.searching')}`;
        }

        try {
            const response = await this.app.api.get(`/hanshow/lookup?esl_id=${encodeURIComponent(barcode)}`);

            if (response.success && response.data?.found) {
                const esl = response.data.esl;
                this.showSingleEslResult(esl);
            } else {
                // ESL bulunamadı - ESL-Working'e kaydet seçeneği sun
                if (resultsEl) resultsEl.style.display = 'block';
                if (resultsList) {
                    resultsList.innerHTML = `
                        <div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                            <i class="ti ti-tag-off" style="font-size: 3rem; opacity: 0.5; color: var(--color-warning);"></i>
                            <p style="margin-top: 0.5rem; font-weight: 500;">${this.__('scan.eslNotFound')}</p>
                            <p style="font-size: 0.875rem; opacity: 0.7;">
                                <code style="background: var(--bg-secondary); padding: 0.25rem 0.5rem; border-radius: 4px;">${barcode}</code>
                            </p>
                            <p style="font-size: 0.75rem; opacity: 0.6; margin-top: 0.5rem;">
                                ${this.__('scan.eslNotInEslWorking')}
                            </p>
                            <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                                <button type="button" class="btn btn-primary register-esl-btn" data-esl-id="${barcode}">
                                    <i class="ti ti-plus"></i>
                                    ${this.__('scan.registerToEslWorking')}
                                </button>
                                <button type="button" class="btn btn-outline add-esl-direct-btn" data-esl-id="${barcode}">
                                    <i class="ti ti-device-floppy"></i>
                                    ${this.__('scan.addDirectly')}
                                </button>
                            </div>
                        </div>
                    `;

                    // ESL-Working'e kaydet butonu
                    resultsList.querySelector('.register-esl-btn')?.addEventListener('click', async (e) => {
                        const eslId = e.currentTarget.dataset.eslId;
                        await this.registerEslToEslWorking(eslId);
                    });

                    // Doğrudan sisteme ekle butonu
                    resultsList.querySelector('.add-esl-direct-btn')?.addEventListener('click', (e) => {
                        const eslId = e.currentTarget.dataset.eslId;
                        this.addScannedHanshowDevice({
                            esl_id: eslId,
                            model: 'Unknown',
                            screen_width: 152,
                            screen_height: 152,
                            screen_color: 'BWR',
                            online: false
                        });
                    });
                }
            }

        } catch (error) {
            Toast.error(error.message || this.__('scan.lookupFailed'));
        } finally {
            if (lookupBtn) {
                lookupBtn.disabled = false;
                lookupBtn.innerHTML = `<i class="ti ti-search"></i> ${this.__('scan.lookup')}`;
            }
        }
    }

    /**
     * ESL'i ESL-Working'e kaydet
     * @param {string} eslId - ESL ID
     */
    async registerEslToEslWorking(eslId) {
        const registerBtn = document.querySelector('.register-esl-btn');
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.innerHTML = `<i class="ti ti-loader-2 ti-spin"></i> ${this.__('scan.registering')}`;
        }

        try {
            const response = await this.app.api.post('/hanshow/register', { esl_id: eslId });

            if (response.success && response.data?.registered) {
                Toast.success(response.data.message || this.__('scan.eslRegistered'));

                // Kayıt sonrası ESL bilgilerini göster
                if (response.data.esl) {
                    this.showSingleEslResult(response.data.esl);
                } else {
                    // Tekrar arama yap
                    await this.lookupHanshowEsl();
                }
            } else {
                Toast.error(response.message || this.__('scan.registerFailed'));
            }
        } catch (error) {
            Toast.error(error.message || this.__('scan.registerFailed'));
        } finally {
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = `<i class="ti ti-plus"></i> ${this.__('scan.registerToEslWorking')}`;
            }
        }
    }

    /**
     * Tek ESL sonucunu göster
     * @param {Object} esl - ESL verisi
     */
    showSingleEslResult(esl) {
        const resultsEl = document.getElementById('scan-results');
        const resultsList = document.getElementById('scan-results-list');
        const countEl = document.getElementById('scan-results-count');

        if (!resultsEl || !resultsList) return;

        resultsEl.style.display = 'block';
        if (countEl) countEl.textContent = '1';

        const isRegistered = esl.is_registered;
        const isOnline = esl.online;

        resultsList.innerHTML = `
            <div class="scan-result-item" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem;
                border: 2px solid ${isOnline ? 'var(--color-success)' : 'var(--color-secondary)'};
                border-radius: 12px;
                margin-bottom: 0.5rem;
                background: ${isRegistered ? 'var(--bg-secondary)' : 'var(--bg-primary)'};
            ">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="
                        width: 56px;
                        height: 56px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, ${isOnline ? 'var(--color-success)' : 'var(--color-secondary)'}, ${isOnline ? '#2f9e44' : '#6c757d'});
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 1.5rem;
                        position: relative;
                    ">
                        <i class="ti ti-tag"></i>
                        ${isOnline ? '<span style="position: absolute; top: -4px; right: -4px; width: 14px; height: 14px; background: var(--color-success); border-radius: 50%; border: 3px solid var(--bg-primary);"></span>' : ''}
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 1.1rem;">
                            <span style="font-family: monospace; letter-spacing: 1px;">${esl.esl_id}</span>
                            ${isOnline
                                ? `<span class="badge badge-success" style="margin-left: 0.5rem;">${this.__('scan.online')}</span>`
                                : `<span class="badge badge-secondary" style="margin-left: 0.5rem;">${this.__('scan.offline')}</span>`
                            }
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem;">
                            <strong>${esl.model_name || 'Unknown Model'}</strong>
                            ${esl.screen_width && esl.screen_height ? ` • ${esl.screen_width}×${esl.screen_height}px` : ''}
                            ${esl.screen_color ? ` • ${esl.screen_color}` : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                            ${esl.battery != null ? `<span title="${esl.battery_voltage ? esl.battery_voltage + 'V' : ''}"><i class="ti ti-battery${esl.battery > 70 ? '-4' : esl.battery > 40 ? '-3' : esl.battery > 15 ? '-2' : '-1'}"></i> ${esl.battery}%${esl.battery_voltage ? ' (' + esl.battery_voltage + 'V)' : ''}</span>` : ''}
                            ${esl.rssi ? `<span><i class="ti ti-antenna"></i> ${esl.rssi}dBm</span>` : ''}
                            ${esl.temperature ? `<span><i class="ti ti-temperature"></i> ${esl.temperature}°C</span>` : ''}
                            ${esl.version ? `<span><i class="ti ti-versions"></i> v${esl.version}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div>
                    ${isRegistered
                        ? `<div style="text-align: right;">
                               <span class="badge badge-secondary" style="margin-bottom: 0.5rem;">${this.__('scan.registered')}</span>
                               <br>
                               <small style="color: var(--text-muted);">${esl.db_status || ''}</small>
                           </div>`
                        : `<button type="button" class="btn btn-primary add-scanned-hanshow"
                            data-esl-id="${esl.esl_id}"
                            data-model="${esl.model_name || ''}"
                            data-screen-width="${esl.screen_width || 152}"
                            data-screen-height="${esl.screen_height || 152}"
                            data-screen-color="${esl.screen_color || 'BWR'}"
                            data-online="${esl.online ? '1' : '0'}"
                            data-firmware-id="${esl.firmware_id || ''}"
                            data-has-led="${esl.has_led ? '1' : '0'}"
                            data-max-pages="${esl.max_pages || 1}">
                            <i class="ti ti-plus"></i>
                            ${this.__('scan.addDevice')}
                        </button>`
                    }
                </div>
            </div>
        `;

        // Bind add button event
        resultsList.querySelectorAll('.add-scanned-hanshow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = e.currentTarget.dataset;
                this.addScannedHanshowDevice({
                    esl_id: data.eslId,
                    model: data.model,
                    screen_width: parseInt(data.screenWidth),
                    screen_height: parseInt(data.screenHeight),
                    screen_color: data.screenColor,
                    online: data.online === '1',
                    firmware_id: data.firmwareId || null,
                    has_led: data.hasLed === '1',
                    max_pages: parseInt(data.maxPages) || 1
                });
            });
        });

        // Clear input for next search
        const barcodeInput = document.getElementById('hanshow-esl-barcode');
        if (barcodeInput) barcodeInput.value = '';
    }

    /**
     * Hanshow ESL tarama - ESL-Working'den ESL cihazlarını keşfet
     */
    async startHanshowScan() {
        // Show progress
        const progressEl = document.getElementById('scan-progress');
        const progressBar = document.getElementById('scan-progress-bar');
        const progressText = document.getElementById('scan-progress-text');
        const resultsEl = document.getElementById('scan-results');
        const startBtn = document.getElementById('start-scan-btn');

        if (progressEl) progressEl.style.display = 'block';
        if (resultsEl) resultsEl.style.display = 'none';
        if (startBtn) startBtn.disabled = true;
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerHTML = `${this.__('scan.discoveringEsls')}<br><small>${this.__('scan.queryingEslWorking')}</small>`;

        try {
            // Simulate progress
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress > 90) progress = 90;
                if (progressBar) progressBar.style.width = progress + '%';
            }, 200);

            const response = await this.app.api.get('/hanshow/scan');

            clearInterval(progressInterval);
            if (progressBar) progressBar.style.width = '100%';

            if (response.success) {
                this.showHanshowScanResults(response.data);
            } else {
                throw new Error(response.message);
            }

        } catch (error) {
            Toast.error(error.message || this.__('scan.hanshowFailed'));
        } finally {
            if (startBtn) startBtn.disabled = false;
            if (progressEl) progressEl.style.display = 'none';
        }
    }

    /**
     * Hanshow ESL tarama sonuçlarını göster
     * @param {Object} data - Tarama sonuç verisi
     */
    showHanshowScanResults(data) {
        const resultsEl = document.getElementById('scan-results');
        const resultsList = document.getElementById('scan-results-list');
        const countEl = document.getElementById('scan-results-count');

        if (!resultsEl || !resultsList) return;

        resultsEl.style.display = 'block';

        const allDevices = data.discovered || [];

        // Update count - show new devices count
        if (countEl) countEl.textContent = allDevices.length;

        // Show stats
        const statsHtml = `
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <div class="badge badge-primary" style="padding: 0.5rem 0.75rem;">
                    <i class="ti ti-tag"></i> ${this.__('scan.total')}: ${data.total_count || 0}
                </div>
                <div class="badge badge-success" style="padding: 0.5rem 0.75rem;">
                    <i class="ti ti-wifi"></i> ${this.__('scan.online')}: ${data.online_count || 0}
                </div>
                <div class="badge badge-secondary" style="padding: 0.5rem 0.75rem;">
                    <i class="ti ti-wifi-off"></i> ${this.__('scan.offline')}: ${data.offline_count || 0}
                </div>
                <div class="badge badge-warning" style="padding: 0.5rem 0.75rem;">
                    <i class="ti ti-plus"></i> ${this.__('scan.new')}: ${data.new_count || 0}
                </div>
            </div>
        `;

        if (allDevices.length === 0) {
            resultsList.innerHTML = statsHtml + `
                <div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <i class="ti ti-tag-off" style="font-size: 3rem; opacity: 0.5;"></i>
                    <p style="margin-top: 0.5rem;">${this.__('scan.noEslsFound')}</p>
                    <p style="font-size: 0.875rem; opacity: 0.7;">${this.__('scan.checkEslWorking')}</p>
                </div>
            `;
            return;
        }

        resultsList.innerHTML = statsHtml + allDevices.map(esl => {
            const isRegistered = esl.is_registered;
            const isOnline = esl.online;

            return `
            <div class="scan-result-item" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                background: ${isRegistered ? 'var(--bg-secondary)' : 'var(--bg-primary)'};
            ">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 8px;
                        background: linear-gradient(135deg, ${isOnline ? 'var(--color-success)' : 'var(--color-secondary)'}, ${isOnline ? '#2f9e44' : '#6c757d'});
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        position: relative;
                    ">
                        <i class="ti ti-tag"></i>
                        ${isOnline ? '<span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: var(--color-success); border-radius: 50%; border: 2px solid var(--bg-primary);"></span>' : ''}
                    </div>
                    <div>
                        <div style="font-weight: 500;">
                            ${isRegistered ? `<span style="color: var(--text-muted);">${esl.db_status}</span> - ` : ''}
                            <span style="font-family: monospace;">${esl.esl_id}</span>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-muted);">
                            ${esl.model_name || 'Unknown'}
                            ${esl.screen_width && esl.screen_height ? `(${esl.screen_width}x${esl.screen_height})` : ''}
                            ${esl.battery != null ? `<span style="margin-left: 0.5rem;" title="${esl.battery_voltage ? esl.battery_voltage + 'V' : ''}"><i class="ti ti-battery${esl.battery > 70 ? '-4' : esl.battery > 40 ? '-3' : esl.battery > 15 ? '-2' : '-1'}"></i> ${esl.battery}%${esl.battery_voltage ? ' (' + esl.battery_voltage + 'V)' : ''}</span>` : ''}
                            ${esl.rssi ? `<span style="margin-left: 0.5rem;"><i class="ti ti-antenna"></i> ${esl.rssi}dBm</span>` : ''}
                        </div>
                    </div>
                </div>
                <div>
                    ${isRegistered
                        ? `<span class="badge badge-secondary">${this.__('scan.registered')}</span>`
                        : `<button type="button" class="btn btn-sm btn-primary add-scanned-hanshow"
                            data-esl-id="${esl.esl_id}"
                            data-model="${esl.model_name || ''}"
                            data-screen-width="${esl.screen_width || 152}"
                            data-screen-height="${esl.screen_height || 152}"
                            data-screen-color="${esl.screen_color || 'BWR'}"
                            data-online="${esl.online ? '1' : '0'}"
                            data-firmware-id="${esl.firmware_id || ''}"
                            data-has-led="${esl.has_led ? '1' : '0'}"
                            data-max-pages="${esl.max_pages || 1}">
                            <i class="ti ti-plus"></i>
                            ${this.__('scan.addDevice')}
                        </button>`
                    }
                </div>
            </div>
        `}).join('');

        // Bind add button events for Hanshow devices
        resultsList.querySelectorAll('.add-scanned-hanshow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = e.currentTarget.dataset;
                this.addScannedHanshowDevice({
                    esl_id: data.eslId,
                    model: data.model,
                    screen_width: parseInt(data.screenWidth),
                    screen_height: parseInt(data.screenHeight),
                    screen_color: data.screenColor,
                    online: data.online === '1',
                    firmware_id: data.firmwareId || null,
                    has_led: data.hasLed === '1',
                    max_pages: parseInt(data.maxPages) || 1
                });
            });
        });
    }

    /**
     * Taranan Hanshow ESL cihazını ekle
     * @param {Object} eslData - ESL verileri
     */
    async addScannedHanshowDevice(eslData) {
        // Close scan modal
        if (this.scanModal) {
            Modal.close(this.scanModal.id);
        }

        // Open device form with pre-filled data
        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${g.id}">${g.name}</option>`
        ).join('');

        const formContent = `
            <form id="device-form" class="space-y-4">
                <div class="alert alert-info" style="margin-bottom: 1rem;">
                    <i class="ti ti-tag"></i>
                    <div>
                        <strong>${this.__('scan.eslFound')}</strong>
                        <p>ESL ID: <code>${eslData.esl_id}</code></p>
                        <p>Model: ${eslData.model || 'Unknown'}</p>
                        <p>${this.__('scan.screenSize')}: ${eslData.screen_width}x${eslData.screen_height} (${eslData.screen_color})</p>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="device-name" class="form-input" required
                        value="Hanshow ESL ${eslData.esl_id}" placeholder="${this.__('form.placeholders.name')}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.type')} *</label>
                        <select id="device-type" class="form-select" required>
                            <option value="esl" selected>${this.__('types.esl')}</option>
                            <option value="hanshow_esl">${this.__('types.hanshow_esl')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.status')}</label>
                        <select id="device-status" class="form-select">
                            <option value="online" ${eslData.online ? 'selected' : ''}>${this.__('statuses.online')}</option>
                            <option value="offline" ${!eslData.online ? 'selected' : ''}>${this.__('statuses.offline')}</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="device-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.serialNumber')}</label>
                    <input type="text" id="device-serial" class="form-input"
                        value="${eslData.esl_id}" placeholder="ESL ID" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="device-location" class="form-input"
                        value="" placeholder="${this.__('form.placeholders.location')}">
                </div>
                <input type="hidden" id="device-id" value="">
                <input type="hidden" id="device-screen-width" value="${eslData.screen_width}">
                <input type="hidden" id="device-screen-height" value="${eslData.screen_height}">
                <input type="hidden" id="device-screen-color" value="${eslData.screen_color}">
                <input type="hidden" id="device-esl-id" value="${eslData.esl_id}">
                <input type="hidden" id="device-ip" value="">
            </form>
        `;

        Modal.show({
            title: this.__('addHanshowDevice'),
            icon: 'ti-tag',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this._saveHanshowDevice(eslData);
            }
        });
    }

    /**
     * Hanshow ESL cihazını kaydet
     * @param {Object} eslData - ESL verileri
     * @private
     */
    async _saveHanshowDevice(eslData) {
        const name = document.getElementById('device-name')?.value?.trim();
        const type = document.getElementById('device-type')?.value;
        const status = document.getElementById('device-status')?.value;
        const groupId = document.getElementById('device-group')?.value;
        const location = document.getElementById('device-location')?.value?.trim();

        if (!name) {
            Toast.error(this.__('form.errors.nameRequired'));
            throw new Error('Name required');
        }

        try {
            // Create device via API
            const response = await this.app.api.post('/devices', {
                name: name,
                type: type || 'esl',
                model: 'hanshow_esl',
                serial_number: eslData.esl_id,
                device_id: eslData.esl_id,
                status: status || 'online',
                group_id: groupId || null,
                location: location || null,
                screen_width: eslData.screen_width,
                screen_height: eslData.screen_height,
                screen_color: eslData.screen_color,
                manufacturer: 'Hanshow'
            });

            if (response.success) {
                // hanshow_esls tablosuna da kaydet (taramada "kayıtlı" görünsün)
                try {
                    await this.app.api.post('/hanshow/esls', {
                        esl_id: eslData.esl_id,
                        model_name: eslData.model || null,
                        screen_width: eslData.screen_width || 152,
                        screen_height: eslData.screen_height || 152,
                        screen_color: eslData.screen_color || 'BW',
                        firmware_id: eslData.firmware_id || null,
                        has_led: eslData.has_led || false,
                        max_pages: eslData.max_pages || 1
                    });
                } catch (e) {
                    // Zaten kayıtlıysa (409 conflict) sorun değil
                }

                Toast.success(this.__('messages.deviceCreated'));
                if (this.onDeviceAdded) this.onDeviceAdded();
                if (this.refreshDevices) this.refreshDevices();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.saveFailed'));
            throw error;
        }
    }

    /**
     * Modülü temizle
     */
    destroy() {
        if (this.scanModal) {
            Modal.close(this.scanModal.id);
            this.scanModal = null;
        }
    }
}

/**
 * NetworkScanner modülünü başlat
 * @param {Object} context - Bağlam nesnesi
 * @returns {NetworkScanner} NetworkScanner instance
 */
export function init(context) {
    return new NetworkScanner(context);
}

export { NetworkScanner };
