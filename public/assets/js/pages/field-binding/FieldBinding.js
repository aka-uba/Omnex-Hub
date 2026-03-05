/**
 * Field Binding Page - Barcode-driven device-product-template binding workflow
 *
 * Provides a step-by-step flow:
 *   1. Scan/enter device barcode -> lookup device
 *   2. Scan/enter product barcode -> lookup product
 *   3. Select template -> confirm -> bind (assign label) -> optionally send to device
 *
 * State machine:
 *   IDLE -> SCANNING_DEVICE -> DEVICE_FOUND -> SCANNING_PRODUCT -> PRODUCT_FOUND
 *        -> SELECTING_TEMPLATE -> CONFIRMING -> BINDING -> SUCCESS
 *
 * @package OmnexDisplayHub
 */

import { BarcodeScanner } from '../../components/BarcodeScanner.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Logger } from '../../core/Logger.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

/** localStorage key for binding history */
const HISTORY_KEY = 'omnex_field_binding_history';

/** Maximum history entries to keep */
const MAX_HISTORY = 50;

/** Valid state transitions */
const STATES = [
    'IDLE',
    'SCANNING_DEVICE',
    'DEVICE_FOUND',
    'SCANNING_PRODUCT',
    'PRODUCT_FOUND',
    'SELECTING_TEMPLATE',
    'CONFIRMING',
    'BINDING',
    'SUCCESS'
];

export class FieldBinding {
    constructor(app) {
        this.app = app;

        // State
        this.state = 'IDLE';
        this.selectedDevice = null;
        this.selectedProduct = null;
        this.selectedTemplate = null;
        this.templates = [];
        this.scanner = null;
        this.history = [];

        // Scanning context: 'device' or 'product'
        this._scanTarget = null;
        this._manualVisible = false;

        // Bound handlers for cleanup
        this._boundKeydown = this._onKeydown.bind(this);
    }

    // ─── i18n Helper ───────────────────────────────────────────────

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    // ─── Lifecycle ─────────────────────────────────────────────────

    async preload() {
        await this.app.i18n.loadPageTranslations('fieldbinding');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon"><i class="ti ti-scan"></i></div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="field-binding-page">
                <!-- Step Indicator -->
                <div class="fb-steps">
                    <div class="fb-step active" data-step="device">
                        <div class="fb-step-number">1</div>
                        <div class="fb-step-label">${this.__('steps.device')}</div>
                    </div>
                    <div class="fb-step-line"></div>
                    <div class="fb-step" data-step="product">
                        <div class="fb-step-number">2</div>
                        <div class="fb-step-label">${this.__('steps.product')}</div>
                    </div>
                    <div class="fb-step-line"></div>
                    <div class="fb-step" data-step="confirm">
                        <div class="fb-step-number">3</div>
                        <div class="fb-step-label">${this.__('steps.confirm')}</div>
                    </div>
                </div>

                <!-- Scanner Viewport (visible in step 1 & 2) -->
                <div class="fb-scanner-section" id="fb-scanner-section">
                    <div class="fb-scanner-header">
                        <span class="fb-scanner-instruction" id="fb-scan-instruction"></span>
                        <div class="fb-scanner-controls">
                            <button class="btn" id="fb-switch-camera" title="${this.__('scanner.switchCamera')}">
                                <i class="ti ti-camera-rotate"></i>
                            </button>
                            <button class="btn" id="fb-toggle-torch" title="${this.__('scanner.toggleTorch')}">
                                <i class="ti ti-bolt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="fb-scanner-viewport" id="fb-scanner-container">
                        <!-- BarcodeScanner or tap-to-scan placeholder mounts here -->
                    </div>
                    <!-- Tap-to-scan overlay (shown when camera is not active) -->
                    <div class="fb-tap-to-scan" id="fb-tap-to-scan">
                        <div class="fb-tap-to-scan-inner">
                            <i class="ti ti-scan"></i>
                            <span>${this.__('scanner.tapToScan')}</span>
                        </div>
                    </div>
                    <div class="fb-manual-entry">
                        <button class="btn btn-sm btn-outline" id="fb-manual-toggle">
                            <i class="ti ti-keyboard"></i> ${this.__('scanner.manualEntry')}
                        </button>
                        <div class="fb-manual-input-row" id="fb-manual-row" style="display:none">
                            <input type="text" class="form-input" id="fb-manual-input"
                                placeholder="${this.__('scanner.manualPlaceholder')}" inputmode="text">
                            <button class="btn btn-primary btn-sm" id="fb-manual-search">
                                <i class="ti ti-search"></i> ${this.__('scanner.manualSearch')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Result Cards (shown when device/product found) -->
                <div class="fb-result-section" id="fb-result-section" style="display:none">
                    <div class="fb-result-card" id="fb-result-card">
                        <!-- Dynamic content -->
                    </div>
                </div>

                <!-- Template Selector (shown in step 3) -->
                <div class="fb-template-section" id="fb-template-section" style="display:none">
                    <h3 class="fb-section-title">${this.__('template.title')}</h3>
                    <div class="fb-template-list" id="fb-template-list">
                        <!-- Dynamic template cards -->
                    </div>
                </div>

                <!-- Confirmation Summary (shown before binding) -->
                <div class="fb-confirm-section" id="fb-confirm-section" style="display:none">
                    <h3 class="fb-section-title">${this.__('confirm.title')}</h3>
                    <div class="fb-confirm-summary" id="fb-confirm-summary">
                        <!-- Dynamic summary -->
                    </div>
                </div>

                <!-- Success Screen -->
                <div class="fb-success-section" id="fb-success-section" style="display:none">
                    <!-- Dynamic success content -->
                </div>

                <!-- Action Bar (sticky bottom) -->
                <div class="fb-action-bar" id="fb-action-bar">
                    <!-- Dynamic buttons based on state -->
                </div>

                <!-- Recent Bindings History -->
                <div class="fb-history-section">
                    <div class="fb-history-header">
                        <h3 class="fb-section-title">${this.__('history.title')}</h3>
                        <button class="btn btn-sm btn-ghost" id="fb-clear-history">
                            <i class="ti ti-trash"></i> ${this.__('history.clear')}
                        </button>
                    </div>
                    <div class="fb-history-list" id="fb-history-list">
                        <!-- Dynamic history items -->
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        // Create scanner instance (continuous=false: we handle flow manually)
        this.scanner = new BarcodeScanner({
            continuous: false,
            beepOnScan: true,
            vibrateOnScan: true,
            deduplicateMs: 3000
        });

        // Scanner callbacks
        this.scanner.onDetected((result) => this.handleScanResult(result));
        this.scanner.onError((err) => {
            Logger.error('[FieldBinding] Scanner error:', err);
            // Don't show toast if scanner already fell back to manual input mode
            // (camera permission denied, not found etc. are handled internally by BarcodeScanner)
            const method = this.scanner?._detectionMethod;
            if (method === 'manual') {
                Logger.debug('[FieldBinding] Scanner fell back to manual mode, suppressing error toast');
                return;
            }
            Toast.error(this.__('error.cameraError'));
        });

        // Load history from localStorage
        this._loadHistory();
        this.renderHistory();

        // Bind events
        this.bindEvents();

        // Start in SCANNING_DEVICE state
        this.setState('SCANNING_DEVICE');
    }

    destroy() {
        // Stop and destroy scanner
        if (this.scanner) {
            this.scanner.destroy();
            this.scanner = null;
        }

        // Remove keyboard listener
        document.removeEventListener('keydown', this._boundKeydown);

        // Clear page translations
        this.app.i18n.clearPageTranslations();
    }

    // ─── Event Binding ─────────────────────────────────────────────

    bindEvents() {
        // Tap-to-scan overlay: user taps to activate camera
        const tapToScan = document.getElementById('fb-tap-to-scan');
        if (tapToScan) {
            tapToScan.addEventListener('click', () => this._handleTapToScan());
        }

        // Camera controls
        const switchBtn = document.getElementById('fb-switch-camera');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                if (this.scanner) this.scanner.switchCamera();
            });
        }

        const torchBtn = document.getElementById('fb-toggle-torch');
        if (torchBtn) {
            torchBtn.addEventListener('click', async () => {
                if (this.scanner) {
                    const isOn = await this.scanner.toggleTorch();
                    torchBtn.classList.toggle('active', isOn);
                }
            });
        }

        // Manual entry toggle
        const manualToggle = document.getElementById('fb-manual-toggle');
        if (manualToggle) {
            manualToggle.addEventListener('click', () => this._toggleManualEntry());
        }

        // Manual search
        const manualSearch = document.getElementById('fb-manual-search');
        if (manualSearch) {
            manualSearch.addEventListener('click', () => this._handleManualSearch());
        }

        const manualInput = document.getElementById('fb-manual-input');
        if (manualInput) {
            manualInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._handleManualSearch();
                }
            });
        }

        // Clear history
        const clearHistoryBtn = document.getElementById('fb-clear-history');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }

        // Action bar delegation (buttons are rendered dynamically)
        const actionBar = document.getElementById('fb-action-bar');
        if (actionBar) {
            actionBar.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                this._handleAction(btn.dataset.action);
            });
        }

        // Template selection delegation
        const templateSection = document.getElementById('fb-template-section');
        if (templateSection) {
            templateSection.addEventListener('click', (e) => {
                const card = e.target.closest('.fb-template-card');
                if (!card) return;
                this.selectTemplate(card.dataset.templateId);
            });
        }

        // Keyboard shortcut (Escape to go back)
        document.addEventListener('keydown', this._boundKeydown);
    }

    // ─── State Machine ─────────────────────────────────────────────

    /**
     * Transition to a new state, updating all UI sections accordingly.
     * @param {string} newState
     */
    setState(newState) {
        if (!STATES.includes(newState)) {
            Logger.warn('[FieldBinding] Invalid state:', newState);
            return;
        }

        const prevState = this.state;
        this.state = newState;
        Logger.debug(`[FieldBinding] State: ${prevState} -> ${newState}`);

        // Update step indicator
        this._updateStepIndicator();

        // Show/hide sections
        this._updateSections();

        // Update action bar
        this.renderActionBar();

        // For scanning states: show tap-to-scan placeholder (camera NOT auto-started)
        // Camera only activates when user explicitly taps the scan area
        if (newState === 'SCANNING_DEVICE') {
            this._scanTarget = 'device';
            this._updateScanInstruction();
            this._showTapToScan();
        } else if (newState === 'SCANNING_PRODUCT') {
            this._scanTarget = 'product';
            this._updateScanInstruction();
            this._showTapToScan();
        } else {
            // Non-scanning state: ensure camera is stopped
            this.stopScanning();
        }

        if (newState === 'SELECTING_TEMPLATE') {
            this.loadTemplates();
        } else if (newState === 'CONFIRMING') {
            this._renderConfirmSection();
        } else if (newState === 'SUCCESS') {
            this._renderSuccessSection();
        }
    }

    /**
     * Update the step indicator to reflect the current state.
     * @private
     */
    _updateStepIndicator() {
        const steps = document.querySelectorAll('.fb-step');
        const lines = document.querySelectorAll('.fb-step-line');

        // Determine active step index
        let activeIdx = 0;
        if (['SCANNING_DEVICE', 'DEVICE_FOUND'].includes(this.state)) {
            activeIdx = 0;
        } else if (['SCANNING_PRODUCT', 'PRODUCT_FOUND'].includes(this.state)) {
            activeIdx = 1;
        } else {
            activeIdx = 2;
        }

        steps.forEach((step, i) => {
            step.classList.remove('active', 'completed');
            if (i < activeIdx) {
                step.classList.add('completed');
            } else if (i === activeIdx) {
                step.classList.add('active');
            }
        });

        lines.forEach((line, i) => {
            line.classList.toggle('completed', i < activeIdx);
        });
    }

    /**
     * Show/hide page sections based on current state.
     * @private
     */
    _updateSections() {
        const scannerSection = document.getElementById('fb-scanner-section');
        const resultSection = document.getElementById('fb-result-section');
        const templateSection = document.getElementById('fb-template-section');
        const confirmSection = document.getElementById('fb-confirm-section');
        const successSection = document.getElementById('fb-success-section');

        // Hide all first
        [resultSection, templateSection, confirmSection, successSection].forEach(el => {
            if (el) el.style.display = 'none';
        });

        switch (this.state) {
            case 'SCANNING_DEVICE':
                if (scannerSection) scannerSection.style.display = '';
                break;

            case 'DEVICE_FOUND':
                if (scannerSection) scannerSection.style.display = 'none';
                if (resultSection) {
                    resultSection.style.display = '';
                    const card = document.getElementById('fb-result-card');
                    if (card) card.innerHTML = this.renderDeviceCard(this.selectedDevice);
                }
                break;

            case 'SCANNING_PRODUCT':
                if (scannerSection) scannerSection.style.display = '';
                // Also show device card above scanner
                if (resultSection) {
                    resultSection.style.display = '';
                    const card = document.getElementById('fb-result-card');
                    if (card) card.innerHTML = this.renderDeviceCard(this.selectedDevice);
                }
                break;

            case 'PRODUCT_FOUND':
                if (scannerSection) scannerSection.style.display = 'none';
                if (resultSection) {
                    resultSection.style.display = '';
                    const card = document.getElementById('fb-result-card');
                    if (card) {
                        card.innerHTML = this.renderDeviceCard(this.selectedDevice)
                            + this.renderProductCard(this.selectedProduct);
                    }
                }
                break;

            case 'SELECTING_TEMPLATE':
                if (scannerSection) scannerSection.style.display = 'none';
                if (resultSection) {
                    resultSection.style.display = '';
                    const card = document.getElementById('fb-result-card');
                    if (card) {
                        card.innerHTML = this.renderDeviceCard(this.selectedDevice)
                            + this.renderProductCard(this.selectedProduct);
                    }
                }
                if (templateSection) templateSection.style.display = '';
                break;

            case 'CONFIRMING':
            case 'BINDING':
                if (scannerSection) scannerSection.style.display = 'none';
                if (confirmSection) confirmSection.style.display = '';
                break;

            case 'SUCCESS':
                if (scannerSection) scannerSection.style.display = 'none';
                if (successSection) successSection.style.display = '';
                break;

            default:
                break;
        }
    }

    /**
     * Update the scanner instruction text based on scan target.
     * @private
     */
    _updateScanInstruction() {
        const el = document.getElementById('fb-scan-instruction');
        if (!el) return;

        if (this._scanTarget === 'device') {
            el.textContent = this.__('scanner.scanDevice');
        } else {
            el.textContent = this.__('scanner.scanProduct');
        }
    }

    // ─── Scanner Control ───────────────────────────────────────────

    /**
     * Show the "Tap to scan" overlay instead of auto-starting the camera.
     * Camera will only activate when the user taps this area.
     * @private
     */
    _showTapToScan() {
        const overlay = document.getElementById('fb-tap-to-scan');
        const viewport = document.getElementById('fb-scanner-container');
        if (overlay) {
            overlay.style.display = '';
            overlay.classList.remove('scanning');
        }
        // Hide the camera viewport and clear its content
        if (viewport) {
            viewport.style.display = 'none';
            viewport.innerHTML = '';
        }
        // Hide scanner header (camera controls not needed yet)
        const header = document.querySelector('.fb-scanner-header');
        if (header) header.style.display = 'none';
    }

    /**
     * Hide the "Tap to scan" overlay and show the camera viewport.
     * @private
     */
    _hideTapToScan() {
        const overlay = document.getElementById('fb-tap-to-scan');
        const viewport = document.getElementById('fb-scanner-container');
        if (overlay) {
            overlay.style.display = 'none';
        }
        if (viewport) {
            viewport.style.display = '';
        }
        // Show scanner header (camera controls)
        const header = document.querySelector('.fb-scanner-header');
        if (header) header.style.display = '';
    }

    /**
     * Handle the tap-to-scan overlay click: activate the camera.
     * @private
     */
    async _handleTapToScan() {
        // Prevent double taps
        const overlay = document.getElementById('fb-tap-to-scan');
        if (overlay) overlay.classList.add('scanning');

        this._hideTapToScan();
        await this.startScanning(this._scanTarget || 'device');
    }

    /**
     * Start the barcode scanner for the given target type.
     * @param {'device'|'product'} type
     */
    async startScanning(type) {
        this._scanTarget = type;

        // Reset manual entry
        this._manualVisible = false;
        const manualRow = document.getElementById('fb-manual-row');
        if (manualRow) manualRow.style.display = 'none';
        const manualInput = document.getElementById('fb-manual-input');
        if (manualInput) manualInput.value = '';

        // Stop previous scanner session if any
        await this.stopScanning();

        const container = document.getElementById('fb-scanner-container');
        if (!container) return;

        try {
            await this.scanner.start(container);
        } catch (err) {
            Logger.debug('[FieldBinding] Scanner start error (handled internally):', err?.message || err);
        }

        // If scanner fell back to manual mode, hide the redundant manual entry toggle
        // and the scanner header (camera/flash buttons are useless without camera)
        // Note: _detectionMethod is an instance property, not a method
        const method = this.scanner?._detectionMethod;
        if (method === 'manual') {
            const manualEntry = document.querySelector('.fb-manual-entry');
            if (manualEntry) manualEntry.style.display = 'none';
            const scannerHeader = document.querySelector('.fb-scanner-header');
            if (scannerHeader) scannerHeader.style.display = 'none';
        }
    }

    /**
     * Stop the barcode scanner.
     */
    async stopScanning() {
        if (this.scanner && this.scanner.getState() !== 'idle') {
            try {
                await this.scanner.stop();
            } catch (err) {
                Logger.debug('[FieldBinding] Scanner stop error (safe):', err);
            }
        }
    }

    // ─── Scan Result Handling ──────────────────────────────────────

    /**
     * Process a scanned or manually entered barcode result.
     * @param {{ rawValue: string, format: string }} result
     */
    async handleScanResult(result) {
        if (!result || !result.rawValue) return;

        const code = result.rawValue.trim();
        Logger.debug('[FieldBinding] Scan result:', code, 'target:', this._scanTarget);

        await this.stopScanning();

        if (this._scanTarget === 'device') {
            await this.lookupDevice(code);
        } else if (this._scanTarget === 'product') {
            await this.lookupProduct(code);
        }
    }

    /**
     * Lookup a device by scanned code (barcode, serial, name, etc.)
     * @param {string} code
     */
    async lookupDevice(code) {
        // Show loading in result section
        const resultSection = document.getElementById('fb-result-section');
        const resultCard = document.getElementById('fb-result-card');
        if (resultSection) resultSection.style.display = '';
        if (resultCard) {
            resultCard.innerHTML = `
                <div class="fb-card fb-card-loading">
                    <div class="fb-card-icon"><i class="ti ti-loader animate-spin"></i></div>
                    <div class="fb-card-info">
                        <h4 class="fb-card-title">${this.__('scanner.searching')}</h4>
                        <div class="fb-card-details"><span>${escapeHTML(code)}</span></div>
                    </div>
                </div>
            `;
        }

        try {
            const res = await this.app.api.post('/field-binding/lookup', {
                code: code,
                type: 'device'
            });

            if (res.success && res.data) {
                this.selectedDevice = res.data;
                this.setState('DEVICE_FOUND');
            } else {
                this._showNotFound('device', code);
            }
        } catch (err) {
            Logger.error('[FieldBinding] Device lookup failed:', err);
            this._showNotFound('device', code, err.message || this.__('error.lookupFailed'));
        }
    }

    /**
     * Lookup a product by scanned barcode/SKU.
     * @param {string} code
     */
    async lookupProduct(code) {
        const resultSection = document.getElementById('fb-result-section');
        const resultCard = document.getElementById('fb-result-card');
        if (resultSection) resultSection.style.display = '';
        if (resultCard) {
            resultCard.innerHTML = this.renderDeviceCard(this.selectedDevice) + `
                <div class="fb-card fb-card-loading">
                    <div class="fb-card-icon"><i class="ti ti-loader animate-spin"></i></div>
                    <div class="fb-card-info">
                        <h4 class="fb-card-title">${this.__('scanner.searching')}</h4>
                        <div class="fb-card-details"><span>${escapeHTML(code)}</span></div>
                    </div>
                </div>
            `;
        }

        try {
            const res = await this.app.api.post('/field-binding/lookup', {
                code: code,
                type: 'product'
            });

            if (res.success && res.data) {
                this.selectedProduct = res.data;
                this.setState('PRODUCT_FOUND');
            } else {
                this._showNotFound('product', code);
            }
        } catch (err) {
            Logger.error('[FieldBinding] Product lookup failed:', err);
            this._showNotFound('product', code, err.message || this.__('error.lookupFailed'));
        }
    }

    /**
     * Show a "not found" card with retry option.
     * @param {'device'|'product'} type
     * @param {string} code
     * @param {string} [errorMessage]
     * @private
     */
    _showNotFound(type, code, errorMessage) {
        const resultCard = document.getElementById('fb-result-card');
        if (!resultCard) return;

        const prefix = type === 'device' ? this.renderDeviceCard(this.selectedDevice) : '';
        const devicePrefix = type === 'product' && this.selectedDevice
            ? this.renderDeviceCard(this.selectedDevice)
            : '';

        const icon = type === 'device' ? 'ti-device-tablet-off' : 'ti-package-off';
        const message = errorMessage || this.__(`error.${type}NotFound`);

        resultCard.innerHTML = devicePrefix + `
            <div class="fb-card fb-card-error">
                <div class="fb-card-icon"><i class="ti ${icon}"></i></div>
                <div class="fb-card-info">
                    <h4 class="fb-card-title">${message}</h4>
                    <div class="fb-card-details">
                        <span><i class="ti ti-barcode"></i> ${escapeHTML(code)}</span>
                    </div>
                </div>
            </div>
        `;

        // Show action bar with retry
        const actionBar = document.getElementById('fb-action-bar');
        if (actionBar) {
            actionBar.innerHTML = `
                <button class="btn btn-outline" data-action="retry-scan">
                    <i class="ti ti-refresh"></i> ${this.__('actions.retryScan')}
                </button>
                ${type === 'product' ? `
                    <button class="btn btn-ghost" data-action="back-to-device">
                        <i class="ti ti-arrow-left"></i> ${this.__('actions.back')}
                    </button>
                ` : ''}
            `;
        }
    }

    // ─── Template Loading & Selection ──────────────────────────────

    /**
     * Load templates compatible with the selected device type.
     */
    async loadTemplates() {
        const templateList = document.getElementById('fb-template-list');
        if (!templateList) return;

        // Show loading
        templateList.innerHTML = `
            <div class="fb-template-loading">
                <i class="ti ti-loader animate-spin"></i>
                <span>${this.__('template.loading')}</span>
            </div>
        `;

        try {
            const deviceType = this.selectedDevice?.type || 'esl';
            const res = await this.app.api.get(`/field-binding/templates?device_type=${encodeURIComponent(deviceType)}`);

            if (res.success && res.data && res.data.length > 0) {
                this.templates = res.data;
                templateList.innerHTML = this.renderTemplateList(this.templates);

                // Auto-select if only one template or if there is a recommended one
                if (this.templates.length === 1) {
                    this.selectTemplate(this.templates[0].id);
                }
            } else {
                this.templates = [];
                templateList.innerHTML = `
                    <div class="fb-template-empty">
                        <i class="ti ti-layout-off"></i>
                        <span>${this.__('template.noTemplates')}</span>
                    </div>
                `;
            }
        } catch (err) {
            Logger.error('[FieldBinding] Failed to load templates:', err);
            templateList.innerHTML = `
                <div class="fb-template-empty fb-template-error">
                    <i class="ti ti-alert-circle"></i>
                    <span>${this.__('error.templateLoadFailed')}</span>
                </div>
            `;
        }
    }

    /**
     * Select a template by ID.
     * @param {string} templateId
     */
    selectTemplate(templateId) {
        const template = this.templates.find(t => String(t.id) === String(templateId));
        if (!template) return;

        this.selectedTemplate = template;

        // Update UI: highlight selected card
        const cards = document.querySelectorAll('.fb-template-card');
        cards.forEach(card => {
            card.classList.toggle('selected', String(card.dataset.templateId) === String(templateId));
        });

        // Enable continue button in action bar
        this.renderActionBar();
    }

    // ─── Binding ───────────────────────────────────────────────────

    /**
     * Perform the label assignment binding.
     * Handles conflict detection with force-reassign modal.
     */
    async performBinding() {
        this.setState('BINDING');

        try {
            const res = await this.app.api.post(`/products/${this.selectedProduct.id}/assign-label`, {
                device_id: this.selectedDevice.id,
                template_id: this.selectedTemplate.id,
                force: false
            });

            if (res.conflict) {
                // Conflict: device is already assigned to another product
                const existingName = res.existing_product?.name || '?';
                const existingSku = res.existing_product?.sku || '';

                Modal.confirm({
                    title: this.__('device.alreadyAssigned'),
                    message: `${escapeHTML(existingName)} (${escapeHTML(existingSku)}) ${this.__('confirm.reassignQuestion')} ${escapeHTML(this.selectedProduct.name)}?`,
                    type: 'warning',
                    confirmText: this.__('device.reassign'),
                    onConfirm: async () => {
                        try {
                            const forceRes = await this.app.api.post(
                                `/products/${this.selectedProduct.id}/assign-label`,
                                {
                                    device_id: this.selectedDevice.id,
                                    template_id: this.selectedTemplate.id,
                                    force: true
                                }
                            );
                            this.handleBindingSuccess(forceRes);
                        } catch (forceErr) {
                            Logger.error('[FieldBinding] Force binding failed:', forceErr);
                            Toast.error(this.__('error.bindingFailed'));
                            this.setState('CONFIRMING');
                        }
                    }
                });
                // Go back to confirming while modal is open
                this.setState('CONFIRMING');
                return;
            }

            this.handleBindingSuccess(res);
        } catch (err) {
            Logger.error('[FieldBinding] Binding failed:', err);
            Toast.error(this.__('error.bindingFailed'));
            this.setState('CONFIRMING');
        }
    }

    /**
     * Handle a successful binding response.
     * @param {Object} res - API response
     */
    handleBindingSuccess(res) {
        // Add to history
        this.addToHistory({
            deviceId: this.selectedDevice.id,
            deviceName: this.selectedDevice.name,
            productId: this.selectedProduct.id,
            productName: this.selectedProduct.name,
            templateId: this.selectedTemplate.id,
            templateName: this.selectedTemplate.name,
            timestamp: new Date().toISOString()
        });

        Toast.success(this.__('success.title'));
        this.setState('SUCCESS');
    }

    /**
     * Send the bound content to the device via render queue.
     */
    async sendToDevice() {
        const btn = document.getElementById('fb-send-btn');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('confirm.sending')}`;
            }

            await this.app.api.post('/render-queue/auto', {
                product_ids: [this.selectedProduct.id],
                priority: 'high'
            });

            if (btn) {
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('success.sent')}`;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-success');
            }

            Toast.success(this.__('success.sent'));
        } catch (err) {
            Logger.error('[FieldBinding] Send to device failed:', err);
            Toast.error(this.__('error.sendFailed'));

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-send"></i> ${this.__('success.sendNow')}`;
            }
        }
    }

    // ─── Rendering Methods ─────────────────────────────────────────

    /**
     * Render the device info card HTML.
     * @param {Object} device
     * @returns {string}
     */
    renderDeviceCard(device) {
        if (!device) return '';

        const statusBadge = device.status === 'online'
            ? 'badge-success'
            : 'badge-secondary';

        const warningHtml = device.current_assignment ? `
            <div class="fb-card-warning">
                <i class="ti ti-alert-triangle"></i>
                <span>${this.__('device.alreadyAssigned')}: <strong>${escapeHTML(device.current_assignment.product_name || '')}</strong></span>
            </div>
        ` : '';

        return `
            <div class="fb-card">
                <div class="fb-card-icon"><i class="ti ti-device-tablet"></i></div>
                <div class="fb-card-info">
                    <h4 class="fb-card-title">${escapeHTML(device.name || '')}</h4>
                    <div class="fb-card-details">
                        <span><i class="ti ti-tag"></i> ${escapeHTML(device.type || '')}</span>
                        <span><i class="ti ti-network"></i> ${escapeHTML(device.ip_address || '-')}</span>
                        <span class="badge ${statusBadge}">${escapeHTML(device.status || 'unknown')}</span>
                    </div>
                    ${warningHtml}
                </div>
            </div>
        `;
    }

    /**
     * Render the product info card HTML.
     * @param {Object} product
     * @returns {string}
     */
    renderProductCard(product) {
        if (!product) return '';

        const imageUrl = this.getImageUrl(product.images);
        const imageHtml = imageUrl
            ? `<img src="${escapeHTML(imageUrl)}" alt="" loading="lazy">`
            : `<i class="ti ti-package"></i>`;

        const priceText = product.current_price
            ? `${product.current_price} \u20BA`
            : '-';

        return `
            <div class="fb-card">
                <div class="fb-card-image">${imageHtml}</div>
                <div class="fb-card-info">
                    <h4 class="fb-card-title">${escapeHTML(product.name || '')}</h4>
                    <div class="fb-card-details">
                        <span><i class="ti ti-barcode"></i> ${escapeHTML(product.barcode || product.sku || '')}</span>
                        <span><i class="ti ti-tag"></i> ${priceText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the template list HTML (horizontal scroll carousel).
     * @param {Object[]} templates
     * @returns {string}
     */
    renderTemplateList(templates) {
        if (!templates || templates.length === 0) return '';

        return templates.map(t => {
            const isSelected = this.selectedTemplate && String(this.selectedTemplate.id) === String(t.id);
            const isRecommended = t.is_recommended || t.recommended;
            const thumbHtml = t.thumbnail
                ? `<img src="${escapeHTML(t.thumbnail)}" alt="" loading="lazy">`
                : `<i class="ti ti-layout"></i>`;
            const badgeHtml = isRecommended
                ? `<span class="fb-template-badge">${this.__('template.recommended')}</span>`
                : '';

            return `
                <div class="fb-template-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}"
                     data-template-id="${escapeHTML(String(t.id))}">
                    <div class="fb-template-thumb">${thumbHtml}</div>
                    <div class="fb-template-name">${escapeHTML(t.name || '')}</div>
                    ${badgeHtml}
                </div>
            `;
        }).join('');
    }

    /**
     * Render the confirmation summary section.
     * @private
     */
    _renderConfirmSection() {
        const summaryEl = document.getElementById('fb-confirm-summary');
        if (!summaryEl) return;

        summaryEl.innerHTML = this.renderConfirmSummary();
    }

    /**
     * Build the confirmation summary HTML.
     * @returns {string}
     */
    renderConfirmSummary() {
        const deviceName = this.selectedDevice ? escapeHTML(this.selectedDevice.name || '') : '-';
        const productName = this.selectedProduct ? escapeHTML(this.selectedProduct.name || '') : '-';
        const templateName = this.selectedTemplate ? escapeHTML(this.selectedTemplate.name || '') : '-';

        const productBarcode = this.selectedProduct
            ? escapeHTML(this.selectedProduct.barcode || this.selectedProduct.sku || '')
            : '';
        const deviceType = this.selectedDevice ? escapeHTML(this.selectedDevice.type || '') : '';

        return `
            <div class="fb-summary-grid">
                <div class="fb-summary-item">
                    <div class="fb-summary-icon"><i class="ti ti-device-tablet"></i></div>
                    <div class="fb-summary-content">
                        <div class="fb-summary-label">${this.__('steps.device')}</div>
                        <div class="fb-summary-value">${deviceName}</div>
                        <div class="fb-summary-meta">${deviceType}</div>
                    </div>
                </div>
                <div class="fb-summary-arrow"><i class="ti ti-arrow-right"></i></div>
                <div class="fb-summary-item">
                    <div class="fb-summary-icon"><i class="ti ti-package"></i></div>
                    <div class="fb-summary-content">
                        <div class="fb-summary-label">${this.__('steps.product')}</div>
                        <div class="fb-summary-value">${productName}</div>
                        <div class="fb-summary-meta">${productBarcode}</div>
                    </div>
                </div>
                <div class="fb-summary-arrow"><i class="ti ti-arrow-right"></i></div>
                <div class="fb-summary-item">
                    <div class="fb-summary-icon"><i class="ti ti-layout"></i></div>
                    <div class="fb-summary-content">
                        <div class="fb-summary-label">${this.__('template.title')}</div>
                        <div class="fb-summary-value">${templateName}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the success screen section.
     * @private
     */
    _renderSuccessSection() {
        const successEl = document.getElementById('fb-success-section');
        if (!successEl) return;

        successEl.innerHTML = this.renderSuccessScreen();
    }

    /**
     * Build the success screen HTML.
     * @returns {string}
     */
    renderSuccessScreen() {
        const deviceName = this.selectedDevice ? escapeHTML(this.selectedDevice.name || '') : '-';
        const productName = this.selectedProduct ? escapeHTML(this.selectedProduct.name || '') : '-';

        return `
            <div class="fb-success-content">
                <div class="fb-success-icon">
                    <i class="ti ti-circle-check"></i>
                </div>
                <h3 class="fb-success-title">${this.__('success.title')}</h3>
                <p class="fb-success-message">
                    <strong>${productName}</strong> ${this.__('success.assignedTo')} <strong>${deviceName}</strong>
                </p>
                <div class="fb-success-actions">
                    <button class="btn btn-primary" id="fb-send-btn" data-action="send-to-device">
                        <i class="ti ti-send"></i> ${this.__('success.sendNow')}
                    </button>
                    <button class="btn btn-outline" data-action="new-scan">
                        <i class="ti ti-scan"></i> ${this.__('success.newScan')}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render the action bar buttons based on current state.
     */
    renderActionBar() {
        const actionBar = document.getElementById('fb-action-bar');
        if (!actionBar) return;

        let html = '';

        switch (this.state) {
            case 'SCANNING_DEVICE':
            case 'SCANNING_PRODUCT':
                // No action buttons during scanning (scanner is active)
                actionBar.style.display = 'none';
                return;

            case 'DEVICE_FOUND':
                html = `
                    <button class="btn btn-primary" data-action="continue-to-product">
                        <i class="ti ti-arrow-right"></i> ${this.__('actions.continue')}
                    </button>
                    <button class="btn btn-outline" data-action="retry-scan">
                        <i class="ti ti-refresh"></i> ${this.__('actions.retryScan')}
                    </button>
                `;
                break;

            case 'PRODUCT_FOUND':
                html = `
                    <button class="btn btn-primary" data-action="continue-to-template">
                        <i class="ti ti-arrow-right"></i> ${this.__('actions.continue')}
                    </button>
                    <button class="btn btn-outline" data-action="retry-product-scan">
                        <i class="ti ti-refresh"></i> ${this.__('actions.retryScan')}
                    </button>
                `;
                break;

            case 'SELECTING_TEMPLATE':
                html = `
                    <button class="btn btn-primary" data-action="continue-to-confirm"
                        ${!this.selectedTemplate ? 'disabled' : ''}>
                        <i class="ti ti-arrow-right"></i> ${this.__('actions.continue')}
                    </button>
                    <button class="btn btn-ghost" data-action="back-to-product">
                        <i class="ti ti-arrow-left"></i> ${this.__('actions.back')}
                    </button>
                `;
                break;

            case 'CONFIRMING':
                html = `
                    <button class="btn btn-primary" data-action="bind">
                        <i class="ti ti-link"></i> ${this.__('confirm.bind')}
                    </button>
                    <button class="btn btn-ghost" data-action="back-to-template">
                        <i class="ti ti-arrow-left"></i> ${this.__('actions.back')}
                    </button>
                `;
                break;

            case 'BINDING':
                html = `
                    <button class="btn btn-primary" disabled>
                        <i class="ti ti-loader animate-spin"></i> ${this.__('confirm.binding')}
                    </button>
                `;
                break;

            case 'SUCCESS':
                // Actions are inside the success screen itself
                html = '';
                break;
        }

        // Show action bar when it has content, hide when empty
        actionBar.style.display = html.trim() ? '' : 'none';
        actionBar.innerHTML = html;
    }

    // ─── History ───────────────────────────────────────────────────

    /**
     * Load binding history from localStorage.
     * @private
     */
    _loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            this.history = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(this.history)) this.history = [];
        } catch (e) {
            Logger.debug('[FieldBinding] Failed to load history:', e);
            this.history = [];
        }
    }

    /**
     * Save current history to localStorage.
     * @private
     */
    _saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
        } catch (e) {
            Logger.debug('[FieldBinding] Failed to save history:', e);
        }
    }

    /**
     * Add a new binding entry to the history.
     * @param {Object} binding
     */
    addToHistory(binding) {
        this.history.unshift(binding);

        // Trim to max
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(0, MAX_HISTORY);
        }

        this._saveHistory();
        this.renderHistory();
    }

    /**
     * Render the history list.
     */
    renderHistory() {
        const listEl = document.getElementById('fb-history-list');
        if (!listEl) return;

        if (!this.history || this.history.length === 0) {
            listEl.innerHTML = `
                <div class="fb-history-empty">
                    <i class="ti ti-history-off"></i>
                    <span>${this.__('history.empty')}</span>
                </div>
            `;
            return;
        }

        listEl.innerHTML = this.history.map(item => `
            <div class="fb-history-item">
                <div class="fb-history-icon"><i class="ti ti-link"></i></div>
                <div class="fb-history-info">
                    <div class="fb-history-title">${escapeHTML(item.deviceName || '')} &rarr; ${escapeHTML(item.productName || '')}</div>
                    <div class="fb-history-meta">${escapeHTML(item.templateName || '')} &middot; ${this.formatTimeAgo(item.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Clear the entire binding history.
     */
    clearHistory() {
        Modal.confirm({
            title: this.__('history.clearTitle'),
            message: this.__('history.clearMessage'),
            type: 'warning',
            confirmText: this.__('history.clear'),
            onConfirm: () => {
                this.history = [];
                this._saveHistory();
                this.renderHistory();
                Toast.success(this.__('history.cleared'));
            }
        });
    }

    // ─── Reset ─────────────────────────────────────────────────────

    /**
     * Reset all state and go back to device scanning.
     */
    resetToStart() {
        this.selectedDevice = null;
        this.selectedProduct = null;
        this.selectedTemplate = null;
        this.templates = [];
        this._scanTarget = null;
        this._manualVisible = false;

        this.setState('SCANNING_DEVICE');
    }

    // ─── Helpers ───────────────────────────────────────────────────

    /**
     * Get the display URL for a product image.
     * @param {*} images - Product images (JSON string or array)
     * @returns {string}
     */
    getImageUrl(images) {
        try {
            const parsed = typeof images === 'string' ? JSON.parse(images) : images;
            const first = Array.isArray(parsed) ? parsed[0] : parsed;
            if (!first) return '';
            const basePath = window.OmnexConfig?.basePath || '';
            if (/^[A-Za-z]:[\\\/]/.test(first)) {
                return `${basePath}/api/media/serve.php?path=${encodeURIComponent(first)}`;
            }
            return `${basePath}/storage/${first}`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Format a timestamp as a relative time string (e.g. "2 minutes ago").
     * @param {string} dateStr - ISO 8601 date string
     * @returns {string}
     */
    formatTimeAgo(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) {
                return this.__('time.justNow');
            } else if (diffMin < 60) {
                return this.__('time.minutesAgo', { count: diffMin });
            } else if (diffHour < 24) {
                return this.__('time.hoursAgo', { count: diffHour });
            } else if (diffDay < 7) {
                return this.__('time.daysAgo', { count: diffDay });
            } else {
                return date.toLocaleDateString();
            }
        } catch (e) {
            return dateStr;
        }
    }

    // ─── Private Helpers ───────────────────────────────────────────

    /**
     * Toggle the manual entry input row visibility.
     * @private
     */
    _toggleManualEntry() {
        this._manualVisible = !this._manualVisible;
        const row = document.getElementById('fb-manual-row');
        if (row) {
            row.style.display = this._manualVisible ? 'flex' : 'none';
            if (this._manualVisible) {
                const input = document.getElementById('fb-manual-input');
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }
        }
    }

    /**
     * Handle manual search button click or Enter key.
     * @private
     */
    _handleManualSearch() {
        const input = document.getElementById('fb-manual-input');
        if (!input) return;

        const code = input.value.trim();
        if (!code) {
            Toast.warning(this.__('scanner.enterCode'));
            input.focus();
            return;
        }

        // Simulate a scan result
        this.handleScanResult({ rawValue: code, format: 'manual' });
    }

    /**
     * Handle action bar button clicks via data-action attribute delegation.
     * @param {string} action
     * @private
     */
    _handleAction(action) {
        switch (action) {
            case 'continue-to-product':
                this.setState('SCANNING_PRODUCT');
                break;

            case 'continue-to-template':
                this.setState('SELECTING_TEMPLATE');
                break;

            case 'continue-to-confirm':
                if (this.selectedTemplate) {
                    this.setState('CONFIRMING');
                }
                break;

            case 'bind':
                this.performBinding();
                break;

            case 'send-to-device':
                this.sendToDevice();
                break;

            case 'new-scan':
                this.resetToStart();
                break;

            case 'retry-scan':
                if (this._scanTarget === 'product') {
                    this.setState('SCANNING_PRODUCT');
                } else {
                    this.setState('SCANNING_DEVICE');
                }
                break;

            case 'retry-product-scan':
                this.setState('SCANNING_PRODUCT');
                break;

            case 'back-to-device':
                this.setState('SCANNING_DEVICE');
                break;

            case 'back-to-product':
                this.setState('SCANNING_PRODUCT');
                break;

            case 'back-to-template':
                this.setState('SELECTING_TEMPLATE');
                break;

            default:
                Logger.warn('[FieldBinding] Unknown action:', action);
        }
    }

    /**
     * Handle keyboard shortcuts.
     * @param {KeyboardEvent} e
     * @private
     */
    _onKeydown(e) {
        // Escape: go back one step
        if (e.key === 'Escape') {
            // Do not intercept if a modal is open
            if (document.querySelector('.modal-overlay')) return;

            switch (this.state) {
                case 'SCANNING_PRODUCT':
                case 'DEVICE_FOUND':
                    this.setState('SCANNING_DEVICE');
                    break;
                case 'PRODUCT_FOUND':
                    this.setState('SCANNING_PRODUCT');
                    break;
                case 'SELECTING_TEMPLATE':
                    this.setState('SCANNING_PRODUCT');
                    break;
                case 'CONFIRMING':
                    this.setState('SELECTING_TEMPLATE');
                    break;
                case 'SUCCESS':
                    this.resetToStart();
                    break;
            }
        }
    }
}

export default FieldBinding;
