/**
 * HalKunyeSection - HAL Künye Sorgulama Modülü
 *
 * ProductForm'dan ayrılmış bağımsız modül.
 * HAL API üzerinden künye sorgulama ve QR kod önizleme sağlar.
 *
 * @version 1.0.0
 * @example
 * import { init as initHalKunyeSection } from './form/HalKunyeSection.js';
 *
 * const kunyeSection = initHalKunyeSection({
 *     container: document.getElementById('kunye-section'),
 *     app: this.app,
 *     onDataApply: (data) => { ... }
 * });
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';

/**
 * HalKunyeSection init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Function} params.onDataApply - Veri uygulama callback'i
 * @returns {HalKunyeSection} HalKunyeSection instance
 */
export function init({ container, app, onDataApply }) {
    if (!container) {
        throw new Error('HalKunyeSection: container parametresi zorunludur');
    }
    return new HalKunyeSection({ container, app, onDataApply });
}

class HalKunyeSection {
    constructor({ container, app, onDataApply }) {
        this.container = container;
        this.app = app;
        this.onDataApply = onDataApply;

        // Stored künye data
        this._halKunyeData = null;

        // Debounce timer
        this._debounceTimer = null;
    }

    /**
     * i18n helper method
     */
    __(key, params = {}) {
        return this.app?.i18n?.t(key, params) || key;
    }

    /**
     * Event listener'ları bağla
     */
    bindEvents() {
        // QR Preview button
        document.getElementById('preview-kunye-btn')?.addEventListener('click', () => {
            this.previewKunyeQR();
        });

        // Auto preview on input change (debounced)
        const kunyeInput = document.getElementById('kunye_no');
        kunyeInput?.addEventListener('input', (e) => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                if (e.target.value.length >= 3) {
                    this.previewKunyeQR();
                } else {
                    this.hidePreview();
                }
            }, 500);
        });

        // HAL Query button
        document.getElementById('query-kunye-btn')?.addEventListener('click', () => {
            this.queryHalKunye();
        });

        // Close result button
        document.getElementById('close-kunye-result')?.addEventListener('click', () => {
            this.hideResult();
        });

        // Apply data button
        document.getElementById('apply-kunye-data')?.addEventListener('click', () => {
            this.applyKunyeData();
        });
    }

    /**
     * Preview container'ı gizle
     */
    hidePreview() {
        const previewContainer = document.getElementById('kunye-preview');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    /**
     * Result container'ı gizle
     */
    hideResult() {
        const resultContainer = document.getElementById('hal-kunye-result');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
    }

    /**
     * Preview künye QR code
     */
    previewKunyeQR() {
        const kunyeInput = document.getElementById('kunye_no');
        const previewContainer = document.getElementById('kunye-preview');
        const statusText = document.getElementById('kunye-status');
        const canvasContainer = document.getElementById('kunye-canvas-container');

        if (!kunyeInput || !previewContainer) return;

        const content = kunyeInput.value.trim();
        if (!content) {
            this.hidePreview();
            return;
        }

        // Show preview container
        previewContainer.style.display = 'block';
        if (statusText) {
            statusText.textContent = `${content.length} ${this.__('kunye.characters')}`;
        }

        // Clear container
        canvasContainer.innerHTML = '';

        // Generate QR code using qrcodejs library
        if (typeof QRCode !== 'undefined') {
            try {
                const qrDiv = document.createElement('div');
                qrDiv.style.display = 'inline-block';
                canvasContainer.appendChild(qrDiv);

                new QRCode(qrDiv, {
                    text: content,
                    width: 150,
                    height: 150,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                Logger.warn('QR code error:', e);
                canvasContainer.innerHTML = `<p class="text-sm text-muted">${this.__('kunye.qrGenerationFailed')}</p>`;
            }
        } else {
            canvasContainer.innerHTML = `<p class="text-sm text-muted">${this.__('kunye.qrLibraryNotLoaded')}</p>`;
        }
    }

    /**
     * HAL Künye sorgulama
     */
    async queryHalKunye() {
        const kunyeInput = document.getElementById('kunye_no');
        const queryBtn = document.getElementById('query-kunye-btn');
        const resultContainer = document.getElementById('hal-kunye-result');

        if (!kunyeInput) return;

        const kunyeNo = kunyeInput.value.trim().replace(/[^0-9]/g, '');

        if (!kunyeNo) {
            Toast.warning(this.__('hal.enterKunyeNo'));
            kunyeInput.focus();
            return;
        }

        if (kunyeNo.length !== 19) {
            Toast.warning(this.__('hal.kunyeMustBe19Digits'));
            kunyeInput.focus();
            return;
        }

        // Disable button and show loading
        if (queryBtn) {
            queryBtn.disabled = true;
            queryBtn.innerHTML = '<i class="ti ti-loader-2 animate-spin"></i>';
        }

        try {
            const response = await this.app.api.get(`/hal/query?kunye_no=${kunyeNo}`);

            if (response.success && response.data) {
                // Store künye data
                this._halKunyeData = response.data;

                // Display result
                this._displayResult(response.data);

                // Show result container
                if (resultContainer) {
                    resultContainer.style.display = 'block';
                }

                Toast.success(this.__('hal.querySuccess'));
            } else {
                // CAPTCHA check
                const errorData = response.errors || response.data || {};
                if (errorData.requires_captcha) {
                    this.showHalCaptchaWarning(kunyeNo, errorData.manual_query_url, errorData.hint);
                } else {
                    Toast.error(response.message || this.__('kunye.failed'));
                }
                this.hideResult();
            }
        } catch (error) {
            Logger.error('HAL künye sorgu hatası:', error);
            const errorData = error?.data?.errors || error?.data || {};
            if (errorData.requires_captcha) {
                this.showHalCaptchaWarning(kunyeNo, errorData.manual_query_url, errorData.hint);
            } else {
                Toast.error(error?.data?.message || this.__('kunye.failed'));
            }
            this.hideResult();
        } finally {
            // Re-enable button
            if (queryBtn) {
                queryBtn.disabled = false;
                queryBtn.innerHTML = '<i class="ti ti-scan"></i>';
            }
        }
    }

    /**
     * Display künye result
     * @private
     */
    _displayResult(data) {
        // Yeni alan adları öncelikli, geriye uyumluluk için eski alanlar fallback
        document.getElementById('hal-urun-adi').textContent = data.malin_adi || data.urun_adi || '-';
        document.getElementById('hal-urun-cinsi').textContent = data.malin_cinsi || data.urun_cinsi || '-';
        document.getElementById('hal-uretici').textContent = data.uretici_adi || data.uretici || '-';
        document.getElementById('hal-uretim-yeri').textContent = data.uretim_yeri || '-';
        document.getElementById('hal-bildirim-tarihi').textContent = data.ilk_bildirim_tarihi || data.bildirim_tarihi || '-';
    }

    /**
     * HAL künye verilerini form alanlarına uygula
     */
    applyKunyeData() {
        if (!this._halKunyeData) {
            Toast.warning(this.__('hal.noDataToApply'));
            return;
        }

        const data = this._halKunyeData;
        let appliedFields = [];

        // ========================================
        // HAL Veri Alanlarını Doldur (Yeni)
        // ========================================

        // Malın Adı
        const malinAdi = data.malin_adi || data.urun_adi;
        if (malinAdi) {
            const input = document.getElementById('hal_malin_adi');
            if (input) {
                input.value = malinAdi;
                appliedFields.push(this.__('hal.fields.malinAdi'));
            }
        }

        // Malın Cinsi
        const malinCinsi = data.malin_cinsi || data.urun_cinsi;
        if (malinCinsi) {
            const input = document.getElementById('hal_malin_cinsi');
            if (input) {
                input.value = malinCinsi;
                appliedFields.push(this.__('hal.fields.malinCinsi'));
            }
        }

        // Malın Türü
        const malinTuru = data.malin_turu || data.urun_turu;
        if (malinTuru) {
            const input = document.getElementById('hal_malin_turu');
            if (input) {
                input.value = malinTuru;
                appliedFields.push(this.__('hal.fields.malinTuru'));
            }
        }

        // Üretici Adı
        const ureticiAdi = data.uretici_adi || data.uretici;
        if (ureticiAdi) {
            const input = document.getElementById('hal_uretici_adi');
            if (input) {
                input.value = ureticiAdi;
                appliedFields.push(this.__('hal.fields.ureticiAdi'));
            }
        }

        // Üretim Yeri
        if (data.uretim_yeri) {
            const input = document.getElementById('hal_uretim_yeri');
            if (input) {
                input.value = data.uretim_yeri;
                appliedFields.push(this.__('hal.fields.uretimYeri'));
            }
        }

        // İlk Bildirim Tarihi
        const bildirimTarihi = data.ilk_bildirim_tarihi || data.bildirim_tarihi;
        if (bildirimTarihi) {
            const input = document.getElementById('hal_ilk_bildirim_tarihi');
            if (input) {
                input.value = bildirimTarihi;
                appliedFields.push(this.__('hal.fields.ilkBildirimTarihi'));
            }
        }

        // Malın Sahibi
        if (data.malin_sahibi) {
            const input = document.getElementById('hal_malin_sahibi');
            if (input) {
                input.value = data.malin_sahibi;
                appliedFields.push(this.__('hal.fields.malinSahibi'));
            }
        }

        // Tüketim Yeri
        if (data.tuketim_yeri) {
            const input = document.getElementById('hal_tuketim_yeri');
            if (input) {
                input.value = data.tuketim_yeri;
                appliedFields.push(this.__('hal.fields.tuketimYeri'));
            }
        }

        // Miktar
        if (data.miktar) {
            const input = document.getElementById('hal_miktar');
            if (input) {
                input.value = data.miktar;
                appliedFields.push(this.__('hal.fields.miktar'));
            }
        }

        // Alış Fiyatı
        if (data.alis_fiyati) {
            const input = document.getElementById('hal_alis_fiyati');
            if (input) {
                input.value = data.alis_fiyati;
                appliedFields.push(this.__('hal.fields.alisFiyati'));
            }
        }

        // ========================================
        // Temel Bilgi Alanlarını Doldur (Eski)
        // ========================================

        // Ürün adı - sadece boşsa doldur
        if (malinAdi) {
            const nameInput = document.getElementById('name');
            if (nameInput && !nameInput.value.trim()) {
                nameInput.value = malinAdi;
                appliedFields.push(this.__('form.fields.name'));
            }
        }

        // Menşei / Üretim Yeri - sadece boşsa doldur
        if (data.uretim_yeri) {
            const originInput = document.getElementById('origin');
            if (originInput && !originInput.value.trim()) {
                originInput.value = data.uretim_yeri;
                appliedFields.push(this.__('form.fields.origin'));
            }
        }

        // Ürün cinsi -> Açıklama - sadece boşsa doldur
        if (malinCinsi) {
            const descInput = document.getElementById('description');
            if (descInput && !descInput.value.trim()) {
                descInput.value = `${malinCinsi}${malinTuru ? ' - ' + malinTuru : ''}`;
                appliedFields.push(this.__('form.fields.description'));
            }
        }

        if (appliedFields.length > 0) {
            Toast.success(this.__('hal.fieldsApplied', { count: appliedFields.length }));
            this.hideResult();

            // Callback
            if (this.onDataApply) {
                this.onDataApply(data);
            }
        } else {
            Toast.info(this.__('hal.allFieldsFilled'));
        }
    }

    /**
     * HAL CAPTCHA uyarısını göster
     */
    showHalCaptchaWarning(kunyeNo, manualQueryUrl, hint) {
        const halUrl = manualQueryUrl || 'https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx';

        Modal.show({
            title: this.__('hal.captchaWarning.title'),
            icon: 'ti-alert-triangle',
            size: 'md',
            content: `
                <div class="hal-captcha-warning">
                    <div class="warning-icon">
                        <i class="ti ti-robot text-warning" style="font-size: 48px;"></i>
                    </div>
                    <p class="warning-text" style="margin: 1rem 0; text-align: center;">
                        ${this.__('hal.captchaWarning.message')}
                    </p>

                    <div class="hal-options" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
                        <div class="hal-option" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                            <strong><i class="ti ti-external-link"></i> ${this.__('hal.captchaWarning.manualQuery')}</strong>
                            <p style="margin: 0.5rem 0 1rem; font-size: 0.9rem; color: var(--text-muted);">
                                ${this.__('hal.captchaWarning.manualQueryDesc')}
                            </p>
                            <a href="${halUrl}" target="_blank" class="btn btn-primary btn-sm">
                                <i class="ti ti-external-link"></i> ${this.__('hal.captchaWarning.queryOnHal')}
                            </a>
                        </div>

                        <div class="hal-option" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                            <strong><i class="ti ti-key"></i> ${this.__('hal.captchaWarning.apiIntegration')}</strong>
                            <p style="margin: 0.5rem 0 1rem; font-size: 0.9rem; color: var(--text-muted);">
                                ${this.__('hal.captchaWarning.apiIntegrationDesc')}
                            </p>
                            <a href="#/settings/integrations" class="btn btn-outline btn-sm">
                                <i class="ti ti-settings"></i> ${this.__('hal.captchaWarning.configureHal')}
                            </a>
                        </div>
                    </div>

                    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(34, 139, 230, 0.1); border-radius: 6px; font-size: 0.85rem;">
                        <i class="ti ti-info-circle text-info"></i>
                        <strong>${this.__('hal.kunyeNo')}:</strong> ${kunyeNo}
                    </div>
                </div>
            `,
            showConfirm: false,
            cancelText: this.__('actions.close')
        });
    }

    /**
     * Get stored künye data
     */
    getKunyeData() {
        return this._halKunyeData;
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        clearTimeout(this._debounceTimer);
        this._halKunyeData = null;
    }
}

export { HalKunyeSection };
