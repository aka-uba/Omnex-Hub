/**
 * DeviceControl Module
 * PavoDisplay/ESL cihaz kontrol ve ayar işlemleri
 *
 * Faz 3, Adım 3.3 - DeviceList.js'den ayrıldı
 * Tarih: 2026-01-25
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';
import { init as initFirmwareUpdate } from './FirmwareUpdate.js';

/**
 * DeviceControl class - Cihaz kontrol ve ayar işlemleri
 */
export class DeviceControl {
    constructor(context) {
        this.app = context.app;
        this.__ = context.__;
        this.refreshDevices = context.refreshDevices;
        this.formatFileSize = context.formatFileSize;

        // Firmware update modülü (Faz 3.5)
        this.firmwareModule = initFirmwareUpdate({
            app: this.app,
            __: this.__,
            formatFileSize: this.formatFileSize
        });
    }

    /**
     * ESL/PavoDisplay cihaz ayarları modali
     */
    async show(device) {
        // First, get device info
        let deviceInfo = null;
        const isPavoDisplay = device.db_type === 'esl' || device.type === 'esl' ||
                              device.original_type === 'esl' || device.original_type === 'esl_android' ||
                              device.model === 'esl_android' || device.model === 'PavoDisplay';

        if (isPavoDisplay && device.ip_address) {
            try {
                Toast.info(this.__('settings.loadingInfo'));
                const response = await this.app.api.post(`/devices/${device.id}/control`, { action: 'device_info' });
                if (response.success && response.data?.device_info) {
                    deviceInfo = response.data.device_info;
                }
            } catch (error) {
                Logger.warn('Failed to get device info:', error);
            }
        }

        const formatBytes = (bytes) => {
            if (!bytes) return '-';
            const mb = bytes / (1024 * 1024);
            return mb.toFixed(1) + ' MB';
        };

        const modalContent = `
            <div class="device-settings-modal">
                <!-- Device Info Section -->
                <div class="settings-section">
                    <h4 class="settings-section-title">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('settings.deviceInfo')}
                    </h4>
                    <div class="settings-info-grid">
                        <div class="info-item">
                            <span class="info-label">${this.__('columns.name')}</span>
                            <span class="info-value">${device.name || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('columns.ipAddress')}</span>
                            <span class="info-value">${device.ip_address || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('columns.type')}</span>
                            <span class="info-value">${device.original_type || device.type || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('columns.status')}</span>
                            <span class="info-value badge ${device.status === 'online' ? 'badge-success' : 'badge-secondary'}">${device.status || '-'}</span>
                        </div>
                        ${deviceInfo ? `
                        <div class="info-item">
                            <span class="info-label">${this.__('settings.model')}</span>
                            <span class="info-value">${deviceInfo.model || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('settings.firmware')}</span>
                            <span class="info-value">${deviceInfo.firmware || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('settings.screenSize')}</span>
                            <span class="info-value">${deviceInfo.screen_width}x${deviceInfo.screen_height}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${this.__('settings.clientId')}</span>
                            <span class="info-value">${deviceInfo.client_id || '-'}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                ${deviceInfo?.total_storage ? `
                <!-- Storage Section -->
                <div class="settings-section">
                    <h4 class="settings-section-title">
                        <i class="ti ti-database"></i>
                        ${this.__('settings.storage')}
                    </h4>
                    <div class="storage-info">
                        <div class="storage-bar-container">
                            <div class="storage-bar" style="width: ${deviceInfo.usage_percent || 0}%"></div>
                        </div>
                        <div class="storage-text">
                            ${formatBytes(deviceInfo.used_space)} / ${formatBytes(deviceInfo.total_storage)}
                            (${deviceInfo.usage_percent || 0}% ${this.__('settings.used')})
                        </div>
                    </div>
                </div>
                ` : ''}

                ${isPavoDisplay && device.ip_address ? `
                <!-- Brightness Control -->
                <div class="settings-section">
                    <h4 class="settings-section-title">
                        <i class="ti ti-sun"></i>
                        ${this.__('settings.brightness')}
                    </h4>
                    <div class="brightness-controls">
                        <div class="brightness-slider-container">
                            <input type="range" id="brightness-slider" min="0" max="100" value="100" class="brightness-slider">
                            <span id="brightness-value" class="brightness-value">100%</span>
                        </div>
                        <div class="brightness-buttons">
                            <button type="button" class="btn btn-sm btn-outline" id="brightness-off-btn">
                                <i class="ti ti-sun-off"></i> ${this.__('settings.backlightOff')}
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" id="brightness-on-btn">
                                <i class="ti ti-sun"></i> ${this.__('settings.backlightOn')}
                            </button>
                            <button type="button" class="btn btn-sm btn-primary" id="brightness-apply-btn">
                                <i class="ti ti-check"></i> ${this.__('settings.apply')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- File Check -->
                <div class="settings-section">
                    <h4 class="settings-section-title">
                        <i class="ti ti-file-search"></i>
                        ${this.__('settings.fileCheck')}
                    </h4>
                    <div class="file-check-controls">
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <input type="text" id="file-check-path" class="form-input"
                                   value="files/task/${device.device_id || 'test'}.js"
                                   placeholder="files/task/filename.js">
                        </div>
                        <button type="button" class="btn btn-sm btn-outline" id="file-check-btn">
                            <i class="ti ti-search"></i> ${this.__('settings.checkFile')}
                        </button>
                        <div id="file-check-result" class="file-check-result" style="display: none;"></div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="settings-section">
                    <h4 class="settings-section-title">
                        <i class="ti ti-bolt"></i>
                        ${this.__('settings.quickActions')}
                    </h4>
                    <div class="quick-actions-grid">
                        <button type="button" class="btn btn-outline quick-action-btn" data-action="refresh">
                            <i class="ti ti-refresh"></i>
                            <span>${this.__('actions.refreshDevice')}</span>
                        </button>
                        <button type="button" class="btn btn-outline quick-action-btn" data-action="clear_memory">
                            <i class="ti ti-trash-x"></i>
                            <span>${this.__('actions.clearMemory')}</span>
                        </button>
                        <button type="button" class="btn btn-outline quick-action-btn" data-action="reboot">
                            <i class="ti ti-power"></i>
                            <span>${this.__('actions.rebootDevice')}</span>
                        </button>
                        <button type="button" class="btn btn-outline quick-action-btn" data-action="ping">
                            <i class="ti ti-wifi"></i>
                            <span>${this.__('actions.pingDevice')}</span>
                        </button>
                    </div>
                </div>

                <!-- Firmware Update Section (FirmwareUpdate modülünden) -->
                ${this.firmwareModule.renderSection()}
                ` : `
                <div class="settings-section">
                    <div class="alert alert-info">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('settings.noIpAddress')}
                    </div>
                </div>
                `}
            </div>
        `;

        const modal = Modal.show({
            title: `${this.__('settings.title')} - ${device.name}`,
            icon: 'ti-settings',
            content: modalContent,
            size: 'lg',
            showFooter: false
        });

        // Bind events after modal opens
        setTimeout(() => {
            this._bindModalEvents(device);
        }, 100);

        return modal;
    }

    /**
     * Modal içindeki event listener'ları bağla
     */
    _bindModalEvents(device) {
        // Brightness slider
        const slider = document.getElementById('brightness-slider');
        const valueDisplay = document.getElementById('brightness-value');
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value + '%';
            });
        }

        // Brightness buttons
        document.getElementById('brightness-off-btn')?.addEventListener('click', async () => {
            await this.setBrightness(device.id, 'off');
        });

        document.getElementById('brightness-on-btn')?.addEventListener('click', async () => {
            await this.setBrightness(device.id, 'on');
        });

        document.getElementById('brightness-apply-btn')?.addEventListener('click', async () => {
            const level = parseInt(slider?.value || 100);
            await this.setBrightness(device.id, 'set', level);
        });

        // File check
        document.getElementById('file-check-btn')?.addEventListener('click', async () => {
            const path = document.getElementById('file-check-path')?.value;
            if (path) {
                await this.checkDeviceFile(device.id, path);
            }
        });

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                if (action) {
                    await this.executeQuickAction(device, action);
                }
            });
        });

        // Firmware update events (FirmwareUpdate modülüne delege edildi)
        this.firmwareModule.bindEvents(device);
    }

    // =========================================================================
    // DEPRECATED: Firmware işlemleri FirmwareUpdate modülüne taşındı
    // Tarih: 2026-01-25 | Faz 3, Adım 3.5
    // Metodlar: _bindFirmwareEvents, _updateFirmwareButtonState, formatFileSize
    // =========================================================================
    /*
    **
     * Firmware update event listener'ları
     *
    _bindFirmwareEvents(device) {
        const firmwareFile = document.getElementById('firmware-file');
        const firmwareConfirm = document.getElementById('firmware-confirm-checkbox');
        const firmwareUploadBtn = document.getElementById('firmware-upload-btn');
        const firmwareFileInfo = document.getElementById('firmware-file-info');

        // File selection
        firmwareFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('firmware-file-name').textContent = file.name;
                document.getElementById('firmware-file-size').textContent = `(${this.formatFileSize(file.size)})`;
                firmwareFileInfo.style.display = 'flex';
                this._updateFirmwareButtonState();
            } else {
                firmwareFileInfo.style.display = 'none';
                this._updateFirmwareButtonState();
            }
        });

        // Confirm checkbox
        firmwareConfirm?.addEventListener('change', () => {
            this._updateFirmwareButtonState();
        });

        // Upload button
        firmwareUploadBtn?.addEventListener('click', async () => {
            await this.uploadFirmware(device);
        });
    }

    **
     * Firmware upload butonu durumunu güncelle
     *
    _updateFirmwareButtonState() {
        const firmwareFile = document.getElementById('firmware-file');
        const firmwareConfirm = document.getElementById('firmware-confirm-checkbox');
        const firmwareUploadBtn = document.getElementById('firmware-upload-btn');

        if (firmwareUploadBtn) {
            const hasFile = firmwareFile?.files?.length > 0;
            const isConfirmed = firmwareConfirm?.checked;
            firmwareUploadBtn.disabled = !(hasFile && isConfirmed);
        }
    }

    **
     * Dosya boyutunu formatla
     *
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    **
     * Firmware yükle
     *
    async uploadFirmware(device) {
        const fileInput = document.getElementById('firmware-file');
        const file = fileInput?.files?.[0];

        if (!file) {
            Toast.error(this.__('settings.firmwareNoFile'));
            return;
        }

        // Final confirmation dialog
        const confirmed = await new Promise(resolve => {
            Modal.confirm({
                title: this.__('settings.firmwareConfirmTitle'),
                message: `
                    <div class="firmware-final-confirm">
                        <div class="alert alert-danger" style="margin-bottom: 1rem;">
                            <i class="ti ti-alert-octagon"></i>
                            <strong>${this.__('settings.firmwareFinalWarning')}</strong>
                        </div>
                        <p><strong>${this.__('settings.firmwareDevice')}:</strong> ${device.name}</p>
                        <p><strong>${this.__('settings.firmwareFileLabel')}:</strong> ${file.name}</p>
                        <p><strong>${this.__('settings.firmwareSize')}:</strong> ${this.formatFileSize(file.size)}</p>
                        <p style="margin-top: 1rem; color: var(--color-danger);">
                            ${this.__('settings.firmwareContinueQuestion')}
                        </p>
                    </div>
                `,
                type: 'danger',
                confirmText: this.__('settings.firmwareConfirmButton'),
                cancelText: this.__('modal.cancel'),
                onConfirm: () => resolve(true),
                onClose: () => resolve(false)
            });
        });

        if (!confirmed) return;

        // Show progress
        const progressDiv = document.getElementById('firmware-progress');
        const progressFill = document.getElementById('firmware-progress-fill');
        const progressText = document.getElementById('firmware-progress-text');
        const uploadBtn = document.getElementById('firmware-upload-btn');

        if (progressDiv) progressDiv.style.display = 'block';
        if (uploadBtn) uploadBtn.disabled = true;

        try {
            Toast.info(this.__('settings.firmwareUploading'));

            // FormData ile dosya yükle
            const formData = new FormData();
            formData.append('action', 'firmware_upgrade');
            formData.append('file', file);

            const response = await this.app.api.upload(`/devices/${device.id}/control`, formData);

            // Simüle progress (gerçek progress için XHR kullanılmalı)
            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = '100%';

            if (response.success && response.data?.success) {
                Toast.success(response.data.message || this.__('settings.firmwareSuccess'));
            } else {
                const errorData = response.data || response;
                Toast.error(errorData.message || this.__('settings.firmwareFailed'));
            }
        } catch (error) {
            Logger.error('Firmware upload error:', error);
            const errorData = error.data || {};
            Toast.error(errorData.message || this.__('settings.firmwareFailed'));

            // Reset progress on error
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
        } finally {
            if (uploadBtn) uploadBtn.disabled = false;
        }
    }
    */
    // =========================================================================
    // DEPRECATED Firmware metodları SONU
    // =========================================================================

    /**
     * Parlaklık ayarla
     */
    async setBrightness(deviceId, action, level = 100) {
        try {
            const response = await this.app.api.post(`/devices/${deviceId}/control`, {
                action: 'set_brightness',
                brightness_action: action,
                level: level
            });

            if (response.success && response.data?.success) {
                Toast.success(response.data.message || this.__('toast.brightnessSet'));
            } else {
                // Check if not supported in HTTP-SERVER mode
                const data = response.data || response;
                if (data.not_supported) {
                    Toast.warning(
                        this.__('toast.brightnessNotSupported'),
                        { duration: 5000 }
                    );
                    // Show hint in console for developers
                    if (data.bluetooth_command) {
                        Logger.info('Bluetooth command:', data.bluetooth_command);
                    }
                    if (data.mqtt_command) {
                        Logger.info('MQTT command:', data.mqtt_command);
                    }
                } else {
                    Toast.error(data.message || this.__('toast.brightnessFailed'));
                }
            }
        } catch (error) {
            Logger.error('Brightness error:', error);
            // API error.data contains the response data (not error.response.data)
            const errorData = error.data || {};

            if (errorData.not_supported) {
                // Show detailed warning with hint from API
                const message = errorData.message ||
                    this.__('toast.brightnessNotSupported');
                Toast.warning(message, { duration: 5000 });

                // Log commands for developers
                if (errorData.bluetooth_command) {
                    Logger.info('Bluetooth command:', errorData.bluetooth_command);
                }
                if (errorData.mqtt_command) {
                    Logger.info('MQTT command:', errorData.mqtt_command);
                }
            } else {
                // Show the actual error message from API
                const message = errorData.message ||
                    this.__('toast.brightnessFailed');
                Toast.error(message);
            }
        }
    }

    /**
     * Cihazda dosya kontrol et
     */
    async checkDeviceFile(deviceId, filePath) {
        const resultDiv = document.getElementById('file-check-result');
        if (!resultDiv) return;

        try {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('settings.checking')}`;

            const response = await this.app.api.post(`/devices/${deviceId}/control`, {
                action: 'check_file',
                file_path: filePath
            });

            if (response.data?.file_exists) {
                resultDiv.innerHTML = `
                    <span class="text-success">
                        <i class="ti ti-circle-check"></i> ${this.__('settings.fileExists')}
                        ${response.data.file_md5 ? `<br><small>MD5: ${response.data.file_md5}</small>` : ''}
                    </span>
                `;
            } else {
                resultDiv.innerHTML = `
                    <span class="text-danger">
                        <i class="ti ti-circle-x"></i> ${this.__('settings.fileNotFound')}
                    </span>
                `;
            }
        } catch (error) {
            Logger.error('File check error:', error);
            resultDiv.innerHTML = `<span class="text-danger"><i class="ti ti-alert-circle"></i> ${this.__('settings.checkFailed')}</span>`;
        }
    }

    /**
     * Hızlı işlem çalıştır
     */
    async executeQuickAction(device, action) {
        try {
            Toast.info(this.__('toast.executing'));
            const response = await this.app.api.post(`/devices/${device.id}/control`, { action });

            if (response.success && response.data?.success) {
                Toast.success(response.data.message || this.__('toast.actionSuccess'));
                this.refreshDevices?.();
            } else {
                // Check if not supported in HTTP-SERVER mode
                const data = response.data || response;
                if (data.not_supported) {
                    const actionName = action === 'reboot' ? this.__('actions.reboot') : action;
                    Toast.warning(
                        this.__('toast.actionNotSupported', { action: actionName }),
                        { duration: 5000 }
                    );
                    // Show hint in console for developers
                    if (data.bluetooth_command) {
                        Logger.info('Bluetooth command:', data.bluetooth_command);
                    }
                    if (data.mqtt_command) {
                        Logger.info('MQTT command:', data.mqtt_command);
                    }
                } else {
                    Toast.error(data.message || this.__('toast.actionFailed'));
                }
            }
        } catch (error) {
            Logger.error('Quick action error:', error);
            // API error.data contains the response data (not error.response.data)
            const errorData = error.data || {};

            if (errorData.not_supported) {
                // Show detailed message from API with action name
                const actionName = action === 'reboot' ? this.__('actions.reboot') : action;
                const message = errorData.message ||
                    this.__('toast.actionNotSupported', { action: actionName });
                Toast.warning(message, { duration: 5000 });

                // Log commands for developers
                if (errorData.bluetooth_command) {
                    Logger.info('Bluetooth command:', errorData.bluetooth_command);
                }
                if (errorData.mqtt_command) {
                    Logger.info('MQTT command:', errorData.mqtt_command);
                }
            } else {
                // Show actual error message from API
                const message = errorData.message ||
                    this.__('toast.actionFailed');
                Toast.error(message);
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        // Cleanup if needed
    }
}

/**
 * Modül başlatma fonksiyonu
 * @param {Object} context - { app, __, refreshDevices }
 * @returns {DeviceControl}
 */
export function init(context) {
    return new DeviceControl(context);
}
