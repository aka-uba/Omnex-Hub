/**
 * FirmwareUpdate Module
 * Firmware yükleme ve güncelleme işlemlerini yönetir
 *
 * @module list/FirmwareUpdate
 * @requires Modal, Toast, Logger
 */

import { Modal } from '../../../components/Modal.js';
import { Toast } from '../../../components/Toast.js';
import { Logger } from '../../../core/Logger.js';

/**
 * FirmwareUpdate sınıfı
 * Cihaz firmware güncelleme işlemlerini yönetir
 */
class FirmwareUpdate {
    /**
     * @param {Object} context - Modül bağlamı
     * @param {Object} context.app - Ana uygulama instance
     * @param {Function} context.__ - i18n çeviri fonksiyonu
     * @param {Function} context.formatFileSize - Dosya boyutu formatlama fonksiyonu
     */
    constructor(context) {
        this.app = context.app;
        this.__ = context.__;
        this.formatFileSize = context.formatFileSize;

        // State
        this._currentDevice = null;
        this._boundEvents = [];
    }

    /**
     * Firmware section HTML'ini render et
     * @returns {string} HTML içeriği
     */
    renderSection() {
        return `
            <!-- Firmware Update Section -->
            <div class="settings-section firmware-section">
                <div class="settings-section-header">
                    <i class="ti ti-upload"></i>
                    ${this.__('settings.firmwareUpdate')}
                </div>

                <div class="firmware-warning">
                    <div class="firmware-warning-icon">
                        <i class="ti ti-alert-triangle"></i>
                    </div>
                    <div class="firmware-warning-content">
                        <h5 class="firmware-warning-title">${this.__('settings.firmwareWarningTitle')}</h5>
                        <ul class="firmware-warning-list">
                            <li><i class="ti ti-point-filled"></i> ${this.__('settings.firmwareWarning1')}</li>
                            <li><i class="ti ti-point-filled"></i> ${this.__('settings.firmwareWarning2')}</li>
                            <li><i class="ti ti-point-filled"></i> ${this.__('settings.firmwareWarning3')}</li>
                            <li><i class="ti ti-point-filled"></i> ${this.__('settings.firmwareWarning4')}</li>
                        </ul>
                    </div>
                </div>

                <!-- Firmware Upload -->
                <div class="firmware-upload-section">
                    <div class="form-group">
                        <label class="form-label">${this.__('settings.firmwareFile')}</label>
                        <input type="file" id="firmware-file" class="form-input" accept=".pkg,.bin,.zip,.apk">
                    </div>
                    <div class="firmware-file-info" id="firmware-file-info" style="display: none;">
                        <i class="ti ti-file"></i>
                        <span id="firmware-file-name"></span>
                        <span id="firmware-file-size" class="text-muted"></span>
                    </div>
                    <div class="firmware-actions">
                        <label class="firmware-confirm-checkbox">
                            <input type="checkbox" id="firmware-confirm-checkbox">
                            <span>${this.__('settings.firmwareConfirmText')}</span>
                        </label>
                        <button type="button" class="btn btn-danger" id="firmware-upload-btn" disabled>
                            <i class="ti ti-upload"></i>
                            ${this.__('settings.firmwareUpload')}
                        </button>
                    </div>
                    <div id="firmware-progress" class="firmware-progress" style="display: none;">
                        <div class="firmware-progress-bar">
                            <div class="firmware-progress-fill" id="firmware-progress-fill"></div>
                        </div>
                        <div class="firmware-progress-text" id="firmware-progress-text">0%</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Event listener'ları bağla
     * @param {Object} device - Hedef cihaz
     */
    bindEvents(device) {
        this._currentDevice = device;

        const firmwareFile = document.getElementById('firmware-file');
        const firmwareConfirm = document.getElementById('firmware-confirm-checkbox');
        const firmwareUploadBtn = document.getElementById('firmware-upload-btn');
        const firmwareFileInfo = document.getElementById('firmware-file-info');

        // Dosya seçimi
        if (firmwareFile) {
            const fileHandler = (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('firmware-file-name').textContent = file.name;
                    document.getElementById('firmware-file-size').textContent = `(${this.formatFileSize(file.size)})`;
                    firmwareFileInfo.style.display = 'flex';
                    this._updateButtonState();
                } else {
                    firmwareFileInfo.style.display = 'none';
                    this._updateButtonState();
                }
            };
            firmwareFile.addEventListener('change', fileHandler);
            this._boundEvents.push({ el: firmwareFile, type: 'change', handler: fileHandler });
        }

        // Checkbox değişimi
        if (firmwareConfirm) {
            const confirmHandler = () => {
                this._updateButtonState();
            };
            firmwareConfirm.addEventListener('change', confirmHandler);
            this._boundEvents.push({ el: firmwareConfirm, type: 'change', handler: confirmHandler });
        }

        // Yükleme butonu
        if (firmwareUploadBtn) {
            const uploadHandler = async () => {
                await this.upload(device);
            };
            firmwareUploadBtn.addEventListener('click', uploadHandler);
            this._boundEvents.push({ el: firmwareUploadBtn, type: 'click', handler: uploadHandler });
        }
    }

    /**
     * Yükleme butonu durumunu güncelle
     * @private
     */
    _updateButtonState() {
        const firmwareFile = document.getElementById('firmware-file');
        const firmwareConfirm = document.getElementById('firmware-confirm-checkbox');
        const firmwareUploadBtn = document.getElementById('firmware-upload-btn');

        if (firmwareUploadBtn) {
            const hasFile = firmwareFile?.files?.length > 0;
            const isConfirmed = firmwareConfirm?.checked;
            firmwareUploadBtn.disabled = !(hasFile && isConfirmed);
        }
    }

    /**
     * Firmware yükle
     * @param {Object} device - Hedef cihaz
     */
    async upload(device) {
        const fileInput = document.getElementById('firmware-file');
        const file = fileInput?.files?.[0];

        if (!file) {
            Toast.error(this.__('settings.firmwareNoFile'));
            return;
        }

        // Çift onay dialog'u
        Modal.confirm({
            title: this.__('settings.firmwareConfirmTitle'),
            content: `
                <div class="firmware-final-confirm">
                    <div class="alert alert-danger">
                        <i class="ti ti-alert-triangle"></i>
                        <strong>${this.__('settings.firmwareFinalWarning')}</strong>
                    </div>
                    <p><strong>${this.__('settings.firmwareDevice')}:</strong> ${device.name}</p>
                    <p><strong>${this.__('settings.firmwareFileLabel')}:</strong> ${file.name}</p>
                    <p><strong>${this.__('settings.firmwareSize')}:</strong> ${this.formatFileSize(file.size)}</p>
                    <p class="text-danger">
                        ${this.__('settings.firmwareContinueQuestion')}
                    </p>
                </div>
            `,
            type: 'danger',
            confirmText: this.__('settings.firmwareConfirmButton'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this._performUpload(device, file);
            }
        });
    }

    /**
     * Yükleme işlemini gerçekleştir
     * @private
     * @param {Object} device - Hedef cihaz
     * @param {File} file - Yüklenecek dosya
     */
    async _performUpload(device, file) {
        const progressDiv = document.getElementById('firmware-progress');
        const progressFill = document.getElementById('firmware-progress-fill');
        const progressText = document.getElementById('firmware-progress-text');
        const uploadBtn = document.getElementById('firmware-upload-btn');

        try {
            // Progress göster
            progressDiv.style.display = 'block';
            uploadBtn.disabled = true;

            Toast.info(this.__('settings.firmwareUploading'));

            const formData = new FormData();
            formData.append('file', file);
            formData.append('action', 'firmware_upgrade');

            // Progress callback ile API çağrısı
            const response = await this.app.api.upload(`/devices/${device.id}/control`, formData, {
                onProgress: (percent) => {
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = `${percent}%`;
                }
            });

            if (response.success) {
                Toast.success(response.data.message || this.__('settings.firmwareSuccess'));
            } else {
                const errorData = response.data || response;
                Toast.error(errorData.message || this.__('settings.firmwareFailed'));
            }
        } catch (error) {
            Logger.error('Firmware upload error:', error);
            const errorData = error.data || error;
            Toast.error(errorData.message || this.__('settings.firmwareFailed'));
        } finally {
            progressDiv.style.display = 'none';
            uploadBtn.disabled = false;
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
        }
    }

    /**
     * Event listener'ları temizle
     */
    unbindEvents() {
        this._boundEvents.forEach(({ el, type, handler }) => {
            el.removeEventListener(type, handler);
        });
        this._boundEvents = [];
        this._currentDevice = null;
    }

    /**
     * Kaynakları temizle
     */
    destroy() {
        this.unbindEvents();
    }
}

/**
 * Modül başlatma fonksiyonu
 * @param {Object} context - Modül bağlamı
 * @returns {FirmwareUpdate} Modül instance
 */
export function init(context) {
    return new FirmwareUpdate(context);
}

export default FirmwareUpdate;
