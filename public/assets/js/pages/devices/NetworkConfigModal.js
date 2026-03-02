/**
 * Network Configuration Modal for PavoDisplay Devices
 * Provides Bluetooth-based network configuration (Static IP, DHCP, WiFi)
 */

import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';
import { Logger } from '../../core/Logger.js';
import { bluetoothService } from '../../services/BluetoothService.js';

export class NetworkConfigModal {
    constructor(app, device) {
        this.app = app;
        this.device = device;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Show network configuration modal
     */
    async show() {
        const content = `
            <div class="network-config-modal">
                <div class="alert alert-info mb-4">
                    <i class="ti ti-info-circle"></i>
                    <div>
                        <strong>${this.__('networkConfig.bluetoothRequired')}</strong>
                        <p class="text-sm mt-1">${this.__('networkConfig.bluetoothDescription')}</p>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('networkConfig.configMode')}</label>
                    <select id="network-mode" class="form-control">
                        <option value="static_ip">${this.__('networkConfig.staticIp')}</option>
                        <option value="dhcp">${this.__('networkConfig.dhcp')}</option>
                        <option value="wifi">${this.__('networkConfig.changeWifi')}</option>
                    </select>
                </div>

                <!-- Static IP Fields -->
                <div id="static-ip-fields" class="network-mode-section">
                    <div class="form-group">
                        <label class="form-label">${this.__('networkConfig.ipAddress')}</label>
                        <input type="text" id="static-ip" class="form-control" placeholder="192.168.1.100" value="${this.device.ip_address || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('networkConfig.gateway')}</label>
                        <input type="text" id="gateway" class="form-control" placeholder="192.168.1.1" value="${this.getDefaultGateway()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('networkConfig.subnetMask')}</label>
                        <input type="text" id="netmask" class="form-control" value="255.255.255.0">
                    </div>
                </div>

                <!-- DHCP Info -->
                <div id="dhcp-info" class="network-mode-section" style="display:none">
                    <div class="alert alert-warning">
                        <i class="ti ti-alert-triangle"></i>
                        <div>
                            <strong>${this.__('networkConfig.dhcpMode')}</strong>
                            <p class="text-sm mt-1">${this.__('networkConfig.dhcpDescription')}</p>
                        </div>
                    </div>
                </div>

                <!-- WiFi Fields -->
                <div id="wifi-fields" class="network-mode-section" style="display:none">
                    <div class="form-group">
                        <label class="form-label">${this.__('networkConfig.wifiSsid')}</label>
                        <input type="text" id="wifi-ssid" class="form-control" placeholder="MyNetwork">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('networkConfig.wifiPassword')}</label>
                        <input type="password" id="wifi-password" class="form-control" placeholder="••••••••">
                    </div>
                    <div class="alert alert-warning">
                        <i class="ti ti-alert-triangle"></i>
                        <div>
                            <strong>${this.__('networkConfig.warning')}</strong>
                            <p class="text-sm mt-1">${this.__('networkConfig.wifiWarning')}</p>
                        </div>
                    </div>
                </div>

                <!-- Admin Token -->
                <div class="form-group">
                    <label class="form-label">${this.__('networkConfig.adminPassword')}</label>
                    <input type="password" id="admin-token" class="form-control" placeholder="${this.__('networkConfig.adminPasswordPlaceholder')}">
                    <small class="form-hint">${this.__('networkConfig.adminPasswordHint')}</small>
                </div>
            </div>
        `;

        Modal.show({
            title: `<i class="ti ti-network"></i> ${this.__('networkConfig.title', { name: this.device.name })}`,
            content,
            size: 'md',
            confirmText: `<i class="ti ti-send"></i> ${this.__('networkConfig.apply')}`,
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.applyConfiguration();
            },
            onOpen: () => {
                this.bindModalEvents();
            }
        });
    }

    /**
     * Get default gateway based on device IP
     */
    getDefaultGateway() {
        if (!this.device.ip_address) return '192.168.1.1';

        const parts = this.device.ip_address.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
        }

        return '192.168.1.1';
    }

    /**
     * Bind modal events
     */
    bindModalEvents() {
        const modeSelect = document.getElementById('network-mode');
        if (!modeSelect) return;

        modeSelect.addEventListener('change', () => {
            this.updateVisibleSections(modeSelect.value);
        });
    }

    /**
     * Update visible sections based on selected mode
     */
    updateVisibleSections(mode) {
        document.getElementById('static-ip-fields').style.display = mode === 'static_ip' ? 'block' : 'none';
        document.getElementById('dhcp-info').style.display = mode === 'dhcp' ? 'block' : 'none';
        document.getElementById('wifi-fields').style.display = mode === 'wifi' ? 'block' : 'none';
    }

    /**
     * Apply network configuration
     */
    async applyConfiguration() {
        const mode = document.getElementById('network-mode').value;
        const token = document.getElementById('admin-token').value || '';

        try {
            let action, payload;

            if (mode === 'static_ip') {
                const ip = document.getElementById('static-ip').value.trim();
                const gateway = document.getElementById('gateway').value.trim();
                const netmask = document.getElementById('netmask').value.trim();

                if (!ip || !gateway) {
                    Toast.error(this.__('networkConfig.ipAndGatewayRequired'));
                    return false;
                }

                // Validate IP format
                if (!this.validateIP(ip) || !this.validateIP(gateway)) {
                    Toast.error(this.__('networkConfig.invalidIpFormat'));
                    return false;
                }

                action = 'prepare_static_ip';
                payload = { action, ip, gateway, netmask, token };

            } else if (mode === 'dhcp') {
                action = 'prepare_dhcp';
                payload = { action, token };

            } else if (mode === 'wifi') {
                const ssid = document.getElementById('wifi-ssid').value.trim();
                const password = document.getElementById('wifi-password').value;

                if (!ssid || !password) {
                    Toast.error(this.__('networkConfig.wifiAndPasswordRequired'));
                    return false;
                }

                action = 'prepare_wifi';
                payload = { action, ssid, password, token };
            }

            // Get Bluetooth command from backend
            Toast.info(this.__('networkConfig.preparingCommand'));

            const response = await this.app.api.post(`/devices/${this.device.id}/network-config`, payload);

            if (response.success && response.bluetooth_command) {
                await this.sendBluetoothCommand(response.bluetooth_command, mode);
                return true;
            } else {
                Toast.error(response.message || this.__('networkConfig.commandFailed'));
                return false;
            }

        } catch (error) {
            Logger.error('Network config error:', error);
            Toast.error(error.message || this.__('networkConfig.configFailed'));
            return false;
        }
    }

    /**
     * Send Bluetooth command to device
     */
    async sendBluetoothCommand(command, mode) {
        try {
            Toast.info(this.__('networkConfig.connectingBluetooth'));

            // Connect to device
            const connected = await bluetoothService.connect();

            if (!connected) {
                Toast.error(this.__('networkConfig.bluetoothFailed'));
                return;
            }

            Toast.info(this.__('networkConfig.sendingConfig'));

            // Send command
            const result = await bluetoothService.sendCommand(command);

            Logger.log('Bluetooth command sent:', { command, result });

            // Success feedback
            Toast.success(this.__('networkConfig.configSuccess'));

            // Show additional info based on mode
            if (mode === 'static_ip') {
                const ip = document.getElementById('static-ip').value;
                Modal.show({
                    title: this.__('networkConfig.configComplete'),
                    content: `
                        <div class="alert alert-success">
                            <i class="ti ti-check"></i>
                            <div>
                                <strong>${this.__('networkConfig.staticIpAssigned')}</strong>
                                <p class="text-sm mt-2">${this.__('networkConfig.deviceRestarting', { ip })}</p>
                                <p class="text-sm mt-2">${this.__('networkConfig.checkingNewIp')}</p>
                            </div>
                        </div>
                    `,
                    confirmText: this.__('actions.ok'),
                    showCancel: false
                });

                // Wait 10 seconds then try to ping new IP
                setTimeout(() => {
                    this.verifyNewIp(ip);
                }, 10000);

            } else if (mode === 'dhcp') {
                Modal.show({
                    title: this.__('networkConfig.dhcpEnabled'),
                    content: `
                        <div class="alert alert-info">
                            <i class="ti ti-info-circle"></i>
                            <div>
                                <strong>${this.__('networkConfig.dhcpSwitched')}</strong>
                                <p class="text-sm mt-2">${this.__('networkConfig.dhcpScanHint')}</p>
                            </div>
                        </div>
                    `,
                    confirmText: this.__('actions.ok'),
                    showCancel: false
                });

            } else if (mode === 'wifi') {
                Toast.info(this.__('networkConfig.wifiConnecting'));
            }

        } catch (error) {
            Logger.error('Bluetooth send error:', error);
            Toast.error(this.__('networkConfig.bluetoothSendFailed', { error: error.message }));
        }
    }

    /**
     * Verify new IP address
     */
    async verifyNewIp(newIp) {
        try {
            Toast.info(this.__('networkConfig.verifyingIp', { ip: newIp }));

            const response = await this.app.api.post('/devices/scan', {
                subnet: newIp.substring(0, newIp.lastIndexOf('.')),
                start_ip: parseInt(newIp.substring(newIp.lastIndexOf('.') + 1)),
                end_ip: parseInt(newIp.substring(newIp.lastIndexOf('.') + 1))
            });

            if (response.success && response.devices && response.devices.length > 0) {
                Toast.success(this.__('networkConfig.deviceReachable', { ip: newIp }));

                // Update device IP in database
                await this.app.api.put(`/devices/${this.device.id}`, {
                    ip_address: newIp
                });

                // Reload page to reflect new IP
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                Toast.warning(this.__('networkConfig.deviceNotFound', { ip: newIp }));
            }
        } catch (error) {
            Logger.error('IP verify error:', error);
            Toast.warning(this.__('networkConfig.ipVerifyFailed'));
        }
    }

    /**
     * Validate IP address format
     */
    validateIP(ip) {
        const pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(pattern);

        if (!match) return false;

        for (let i = 1; i <= 4; i++) {
            const octet = parseInt(match[i]);
            if (octet < 0 || octet > 255) return false;
        }

        return true;
    }
}

export default NetworkConfigModal;
