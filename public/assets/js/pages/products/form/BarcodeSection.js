/**
 * BarcodeSection - Barkod Önizleme Modülü
 *
 * ProductForm'dan ayrılmış bağımsız modül.
 * Barkod tipi tespiti, önizleme ve terazi barkodu desteği sağlar.
 *
 * @version 1.0.0
 * @example
 * import { init as initBarcodeSection } from './form/BarcodeSection.js';
 *
 * const barcodeSection = initBarcodeSection({
 *     container: document.getElementById('barcode-section'),
 *     app: this.app,
 *     weighingSettings: { flagCode: '27', barcodeFormat: 'CODE128' }
 * });
 */

import { Logger } from '../../../core/Logger.js';
import { BarcodeUtils } from '../../../utils/BarcodeUtils.js';

/**
 * BarcodeSection init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Object} params.weighingSettings - Terazi barkod ayarları
 * @returns {BarcodeSection} BarcodeSection instance
 */
export function init({ container, app, weighingSettings = {} }) {
    if (!container) {
        throw new Error('BarcodeSection: container parametresi zorunludur');
    }
    return new BarcodeSection({ container, app, weighingSettings });
}

class BarcodeSection {
    constructor({ container, app, weighingSettings }) {
        this.container = container;
        this.app = app;
        this.weighingSettings = {
            flagCode: weighingSettings.flagCode || '27',
            barcodeFormat: weighingSettings.barcodeFormat || 'CODE128'
        };

        // DOM element references
        this.elements = {
            input: null,
            previewContainer: null,
            typeBadge: null,
            statusText: null,
            canvasContainer: null
        };

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
     * Terazi ayarlarını güncelle
     */
    updateWeighingSettings(settings) {
        this.weighingSettings = {
            ...this.weighingSettings,
            ...settings
        };
    }

    /**
     * DOM elementlerini bağla
     */
    bindElements() {
        this.elements.input = document.getElementById('barcode');
        this.elements.previewContainer = document.getElementById('barcode-preview');
        this.elements.typeBadge = document.getElementById('barcode-type-badge');
        this.elements.statusText = document.getElementById('barcode-status');
        this.elements.canvasContainer = document.getElementById('barcode-canvas-container');
    }

    /**
     * Event listener'ları bağla
     */
    bindEvents() {
        this.bindElements();

        // Preview button click
        document.getElementById('preview-barcode-btn')?.addEventListener('click', () => {
            this.previewBarcode();
        });

        // Auto preview on input change (debounced)
        this.elements.input?.addEventListener('input', (e) => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                if (e.target.value.trim()) {
                    this.previewBarcode();
                } else {
                    this.hidePreview();
                }
            }, 300);
        });
    }

    /**
     * Check if input is a 5-digit weighing scale code
     */
    isWeighingScaleCode(content) {
        return /^\d{5}$/.test(content);
    }

    /**
     * Preview container'ı gizle
     */
    hidePreview() {
        if (this.elements.previewContainer) {
            this.elements.previewContainer.style.display = 'none';
        }
    }

    /**
     * Preview barcode from input
     */
    previewBarcode() {
        this.bindElements();

        const { input, previewContainer, typeBadge, statusText, canvasContainer } = this.elements;

        if (!input || !previewContainer) return;

        const content = input.value.trim();
        if (!content) {
            this.hidePreview();
            return;
        }

        // Check if this is a 5-digit weighing scale code
        const isWeighingCode = this.isWeighingScaleCode(content);

        let displayContent = content;
        let barcodeFormat = null;
        let badgeText = '';
        let statusMessage = '';

        if (isWeighingCode) {
            // Combine flag code + scale code for weighing products
            const flagCode = this.weighingSettings.flagCode || '27';
            displayContent = flagCode + content;
            barcodeFormat = this.weighingSettings.barcodeFormat || 'CODE128';
            badgeText = `${this.__('barcode.weighingBarcode')} (${barcodeFormat})`;
            statusMessage = `${this.__('barcode.flagCode')}: ${flagCode} + ${this.__('barcode.scaleCode')}: ${content} = ${displayContent}`;
        } else {
            // Standard barcode detection
            const detection = BarcodeUtils.detectType(content);
            displayContent = detection.formattedContent;
            badgeText = BarcodeUtils.getTypeName(detection.type);
            statusMessage = detection.message;

            // Map detection type to JsBarcode format
            const formatMap = {
                'ean13': 'EAN13',
                'ean8': 'EAN8',
                'upca': 'UPC',
                'upce': 'UPCE',
                'itf14': 'ITF14',
                'code39': 'CODE39',
                'code128': 'CODE128'
            };
            barcodeFormat = formatMap[detection.type] || 'CODE128';
        }

        // Show preview container
        previewContainer.style.display = 'block';

        // Update badge and status
        if (typeBadge) {
            typeBadge.textContent = badgeText;
            typeBadge.className = `badge ${isWeighingCode ? 'badge-info' : 'badge-success'}`;
        }
        if (statusText) {
            statusText.textContent = statusMessage;
        }

        // Clear and create new canvas
        canvasContainer.innerHTML = '';

        // Check if QR code is needed (only for non-weighing, detected qrcode type)
        const detection = BarcodeUtils.detectType(content);
        if (!isWeighingCode && detection.type === 'qrcode') {
            this._renderQRCode(canvasContainer, detection.formattedContent);
        } else {
            this._renderBarcode(canvasContainer, displayContent, barcodeFormat);
        }
    }

    /**
     * Render QR code using qrcodejs library
     * @private
     */
    _renderQRCode(container, content) {
        if (typeof QRCode !== 'undefined') {
            try {
                const qrDiv = document.createElement('div');
                qrDiv.style.display = 'inline-block';
                container.appendChild(qrDiv);

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
                container.innerHTML = `<p class="text-sm text-muted">${this.__('barcode.qrError')}</p>`;
            }
        } else {
            container.innerHTML = `<p class="text-sm text-muted">${this.__('barcode.qrLibraryError')}</p>`;
        }
    }

    /**
     * Render barcode using JsBarcode library
     * @private
     */
    _renderBarcode(container, content, format) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        container.appendChild(svg);

        if (typeof JsBarcode !== 'undefined') {
            try {
                JsBarcode(svg, content, {
                    format: format,
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 12,
                    margin: 5
                });
            } catch (e) {
                container.innerHTML = `<p class="text-sm text-danger">${this.__('barcode.generationFailed')}: ${e.message}</p>`;
            }
        } else {
            container.innerHTML = `<p class="text-sm text-muted">${this.__('barcode.libraryNotLoaded')}</p>`;
        }
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        clearTimeout(this._debounceTimer);
        this.elements = {};
    }
}

export { BarcodeSection };
