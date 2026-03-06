/**
 * AutoSendWizard - Otomatik Gönderim Sihirbazı Modülü
 *
 * QueueDashboard'dan ayrılmış bağımsız modül.
 * Önceden atanmış etiketleri olan ürünler için 2 adımlı otomatik gönderim sağlar:
 * 1. Ürün Seçimi (sadece atanmış etiketli ürünler)
 * 2. Öncelik ve Zamanlama
 *
 * @version 1.0.0
 * @example
 * import { init as initAutoSendWizard } from './dashboard/AutoSendWizard.js';
 *
 * const autoSendWizard = initAutoSendWizard({
 *     container: document.getElementById('wizard-container'),
 *     app: this.app,
 *     onSubmit: async (data) => { ... },
 *     onClose: () => { ... }
 * });
 *
 * autoSendWizard.show();
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';
import { getTemplateRenderer, shouldPreserveHelperObjectsForTemplate } from '../../../services/TemplateRenderer.js?v=1.0.73';
import { getRenderWorker } from '../../../components/RenderWorker.js?v=1.0.69';

/**
 * AutoSendWizard init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Function} params.onSubmit - Submit callback (data) => Promise
 * @param {Function} params.onClose - Wizard kapatıldığında callback
 * @param {Function} params.onStartWorker - Worker başlatma callback
 * @returns {AutoSendWizard} AutoSendWizard instance
 */
export function init({ container, app, onSubmit, onClose, onStartWorker }) {
    if (!container) {
        throw new Error('AutoSendWizard: container parametresi zorunludur');
    }
    return new AutoSendWizard({ container, app, onSubmit, onClose, onStartWorker });
}

class AutoSendWizard {
    constructor({ container, app, onSubmit, onClose, onStartWorker }) {
        this.container = container;
        this.app = app;
        this.onSubmit = onSubmit;
        this.onClose = onClose;
        this.onStartWorker = onStartWorker;

        // Wizard state
        this.currentStep = 1;
        this.maxSteps = 2;
        this.wizardData = {
            products: [],
            priority: 'normal',
            scheduleType: 'now',
            scheduled_at: null
        };

        // Assigned products (loaded when wizard opens)
        this.assignedProducts = [];

        // Modal ID
        this.modalId = 'auto-send-wizard';
        this._renderRetryCount = 0;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Show wizard - loads data and renders first step
     */
    async show() {
        this.currentStep = 1;
        this.wizardData = {
            products: [],
            priority: 'normal',
            scheduleType: 'now',
            scheduled_at: null
        };
        this._renderRetryCount = 0;

        try {
            // Load products with their labels (assigned devices/templates)
            const response = await this.app.api.get('/products?limit=500&with_labels=1');
            const allProducts = response.data?.products || response.data?.data || response.data || [];

            // Filter products that have labels (device/template assignments)
            this.assignedProducts = allProducts.filter(p => {
                const labels = p.labels || [];
                return labels.length > 0;
            });

            if (this.assignedProducts.length === 0) {
                Modal.show({
                    title: this.__('autoWizard.title'),
                    icon: 'ti-bolt',
                    content: `
                        <div class="wizard-empty-state">
                            <i class="ti ti-package-off" style="font-size: 48px; color: var(--text-tertiary);"></i>
                            <h3>${this.__('autoWizard.noAssignedProducts')}</h3>
                            <p style="color: var(--text-secondary);">${this.__('autoWizard.noAssignedProductsHint')}</p>
                        </div>
                    `,
                    size: 'md',
                    showConfirm: false,
                    cancelText: this.__('modal.close')
                });
                return;
            }

            this._renderStep();
        } catch (error) {
            Logger.error('Failed to load assigned products:', error);
            Toast.error(this.__('toast.loadError'));
        }
    }

    /**
     * Close wizard
     */
    close() {
        Modal.close(this.modalId);
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * Render current wizard step
     * @private
     */
    _renderStep() {
        let stepContent = '';
        let confirmText = '';
        let showBack = false;

        switch (this.currentStep) {
            case 1:
                stepContent = this._renderProductSelectionStep();
                confirmText = this.__('wizard.next');
                break;
            case 2:
                stepContent = this._renderPriorityStep();
                confirmText = this.__('wizard.startSend');
                showBack = true;
                break;
        }

        // Step indicator (2 steps only)
        const stepIndicator = `
            <div class="wizard-steps">
                <div class="wizard-step ${this.currentStep >= 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
                    <span class="wizard-step-number">1</span>
                    <span class="wizard-step-label">${this.__('autoWizard.step1')}</span>
                </div>
                <div class="wizard-step-line ${this.currentStep > 1 ? 'active' : ''}"></div>
                <div class="wizard-step ${this.currentStep >= 2 ? 'active' : ''}">
                    <span class="wizard-step-number">2</span>
                    <span class="wizard-step-label">${this.__('autoWizard.step2')}</span>
                </div>
            </div>
        `;

        const fullContent = stepIndicator + stepContent;

        // Build footer with back button if needed
        const footerHtml = showBack ? `
            <button type="button" class="btn btn-outline" id="auto-wizard-back-btn">
                <i class="ti ti-arrow-left"></i>
                ${this.__('wizard.back')}
            </button>
        ` : '';

        Modal.show({
            id: this.modalId,
            title: this.__('autoWizard.title'),
            icon: 'ti-bolt',
            content: fullContent,
            size: 'lg',
            confirmText: confirmText,
            cancelText: this.__('modal.cancel'),
            customFooterLeft: footerHtml,
            onConfirm: async () => {
                await this._handleNext();
            }
        });

        // Bind back button after modal is shown
        this._bindEventsWithRetry();
    }

    /**
     * Bind events with retry mechanism
     * @private
     */
    _bindEventsWithRetry(retries = 5) {
        const modalEl = document.getElementById(this.modalId);
        if (!modalEl && retries > 0) {
            setTimeout(() => this._bindEventsWithRetry(retries - 1), 50);
            return;
        }

        document.getElementById('auto-wizard-back-btn')?.addEventListener('click', () => {
            this.currentStep--;
            Modal.close(this.modalId);
            this._renderStep();
        });

        this._bindStepEvents();
    }

    /**
     * Handle wizard next/submit
     * @private
     */
    async _handleNext() {
        // Validate current step
        if (this.currentStep === 1 && this.wizardData.products.length === 0) {
            Toast.warning(this.__('wizard.validationError.noProducts'));
            throw new Error('validation_failed');
        }

        if (this.currentStep < this.maxSteps) {
            this.currentStep++;
            Modal.close(this.modalId);
            this._renderStep();
        } else {
            // Submit the automatic jobs
            await this._submit();
        }
    }

    /**
     * Render product selection step (Step 1)
     * @private
     */
    _renderProductSelectionStep() {
        const products = this.assignedProducts || [];

        return `
            <div class="wizard-step-content">
                <p class="wizard-subtitle" style="margin-bottom: 1rem; color: var(--text-secondary);">
                    ${this.__('autoWizard.subtitle')}
                </p>
                <div class="wizard-search">
                    <i class="ti ti-search"></i>
                    <input type="text" id="auto-product-search" placeholder="${this.__('autoWizard.searchProducts')}" class="form-input">
                </div>
                <div class="wizard-selection-info">
                    <span id="auto-product-selection-count">${this.wizardData.products.length}</span> ${this.__('autoWizard.productsSelected', { count: '' }).replace('{count}', '').trim()}
                    <button type="button" class="btn btn-sm btn-ghost" id="auto-select-all-products">
                        ${this.__('autoWizard.selectAll')}
                    </button>
                </div>
                <div class="wizard-item-list" id="auto-product-list">
                    ${products.map(product => {
                        const labels = product.labels || [];
                        const templateNames = [...new Set(labels.map(l => l.template_name).filter(Boolean))];
                        const deviceCount = labels.length;

                        return `
                            <label class="wizard-item-checkbox auto-product-item">
                                <input type="checkbox" name="auto-product" value="${product.id}"
                                    ${this.wizardData.products.includes(product.id) ? 'checked' : ''}>
                                <div class="wizard-item-content">
                                    <div class="wizard-item-image">
                                        ${product.image_url
                                            ? `<img src="${product.image_url}" alt="${product.name}">`
                                            : `<i class="ti ti-package"></i>`
                                        }
                                    </div>
                                    <div class="wizard-item-info">
                                        <span class="wizard-item-name">${product.name}</span>
                                        <span class="wizard-item-meta">${product.sku || ''} ${product.current_price ? '- ' + product.current_price + ' ₺' : ''}</span>
                                        <div class="wizard-item-assignments">
                                            <span class="assignment-badge template">
                                                <i class="ti ti-layout"></i>
                                                ${templateNames.length > 0 ? templateNames.join(', ') : '-'}
                                            </span>
                                            <span class="assignment-badge device">
                                                <i class="ti ti-device-desktop"></i>
                                                ${deviceCount} ${this.__('autoWizard.assignedDevices').toLowerCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render priority and schedule step (Step 2)
     * @private
     */
    _renderPriorityStep() {
        const selectedProducts = this.assignedProducts.filter(p => this.wizardData.products.includes(p.id));
        const totalDevices = selectedProducts.reduce((sum, p) => sum + (p.labels?.length || 0), 0);
        const priorities = ['urgent', 'high', 'normal', 'low'];

        return `
            <div class="wizard-step-content">
                <div class="wizard-summary">
                    <h4>${this.__('autoWizard.summary')}</h4>
                    <div class="wizard-summary-grid auto-summary">
                        <div class="wizard-summary-item">
                            <span class="wizard-summary-label">${this.__('autoWizard.totalProducts')}</span>
                            <span class="wizard-summary-value">${selectedProducts.length}</span>
                        </div>
                        <div class="wizard-summary-item">
                            <span class="wizard-summary-label">${this.__('autoWizard.totalDevices')}</span>
                            <span class="wizard-summary-value">${totalDevices}</span>
                        </div>
                        <div class="wizard-summary-item">
                            <span class="wizard-summary-label">${this.__('autoWizard.totalJobs')}</span>
                            <span class="wizard-summary-value">${selectedProducts.length}</span>
                        </div>
                    </div>
                </div>

                <div class="wizard-product-details">
                    <h4 style="margin-bottom: 0.75rem;">${this.__('autoWizard.totalProducts')}</h4>
                    <div class="auto-product-summary-list">
                        ${selectedProducts.map(product => {
                            const labels = product.labels || [];
                            const templateNames = [...new Set(labels.map(l => l.template_name).filter(Boolean))];
                            return `
                                <div class="auto-product-summary-item">
                                    <span class="product-name">${product.name}</span>
                                    <span class="product-assignments">
                                        <i class="ti ti-layout"></i> ${templateNames[0] || '-'}
                                        <i class="ti ti-device-desktop" style="margin-left: 8px;"></i> ${labels.length}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="wizard-priority-section">
                    <h4>${this.__('autoWizard.selectPriority')}</h4>
                    <div class="wizard-priority-grid">
                        ${priorities.map(p => `
                            <label class="wizard-priority-card ${this.wizardData.priority === p ? 'selected' : ''}">
                                <input type="radio" name="auto-priority" value="${p}"
                                    ${this.wizardData.priority === p ? 'checked' : ''}>
                                <span class="priority-badge ${p}">${this.__(`priority.${p}`)}</span>
                                <span class="wizard-priority-desc">${this.__(`wizard.priority.${p}Desc`)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="wizard-schedule-section">
                    <h4>${this.__('autoWizard.selectSchedule')}</h4>
                    <div class="wizard-schedule-options">
                        <label class="wizard-schedule-card ${this.wizardData.scheduleType === 'now' ? 'selected' : ''}">
                            <input type="radio" name="auto-schedule" value="now"
                                ${this.wizardData.scheduleType === 'now' ? 'checked' : ''}>
                            <i class="ti ti-bolt"></i>
                            <div class="schedule-card-content">
                                <span class="schedule-card-title">${this.__('autoWizard.scheduleNow')}</span>
                                <span class="schedule-card-desc">${this.__('autoWizard.scheduleNowDesc')}</span>
                            </div>
                        </label>
                        <label class="wizard-schedule-card ${this.wizardData.scheduleType === 'later' ? 'selected' : ''}">
                            <input type="radio" name="auto-schedule" value="later"
                                ${this.wizardData.scheduleType === 'later' ? 'checked' : ''}>
                            <i class="ti ti-calendar-time"></i>
                            <div class="schedule-card-content">
                                <span class="schedule-card-title">${this.__('autoWizard.scheduleLater')}</span>
                                <span class="schedule-card-desc">${this.__('autoWizard.scheduleLaterDesc')}</span>
                            </div>
                        </label>
                    </div>
                    <div class="wizard-schedule-datetime ${this.wizardData.scheduleType === 'later' ? '' : 'hidden'}" id="schedule-datetime-picker">
                        <div class="form-row">
                            <div class="form-group">
                                <label>${this.__('autoWizard.scheduleDate')}</label>
                                <input type="date" class="form-input" id="schedule-date"
                                    min="${new Date().toISOString().split('T')[0]}"
                                    value="${this.wizardData.scheduled_at ? this.wizardData.scheduled_at.split('T')[0] : ''}">
                            </div>
                            <div class="form-group">
                                <label>${this.__('autoWizard.scheduleTime')}</label>
                                <input type="time" class="form-input" id="schedule-time"
                                    value="${this.wizardData.scheduled_at ? this.wizardData.scheduled_at.split('T')[1]?.substring(0, 5) : ''}">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Bind events for current wizard step
     * @private
     */
    _bindStepEvents() {
        switch (this.currentStep) {
            case 1:
                this._bindProductSelectionEvents();
                break;
            case 2:
                this._bindPriorityStepEvents();
                break;
        }
    }

    /**
     * Bind product selection step events
     * @private
     */
    _bindProductSelectionEvents() {
        // Product checkboxes
        document.querySelectorAll('input[name="auto-product"]').forEach(cb => {
            cb.addEventListener('change', () => {
                this._updateProductSelection();
            });
        });

        // Search
        document.getElementById('auto-product-search')?.addEventListener('input', (e) => {
            this._filterItems(e.target.value);
        });

        // Select all
        document.getElementById('auto-select-all-products')?.addEventListener('click', () => {
            this._selectAllProducts();
        });

        this._updateProductSelection();
    }

    /**
     * Bind priority step events
     * @private
     */
    _bindPriorityStepEvents() {
        // Priority radios - use event delegation for reliability
        const priorityContainer = document.querySelector('.wizard-priority-grid');
        if (priorityContainer) {
            priorityContainer.addEventListener('change', (e) => {
                if (e.target.name === 'auto-priority') {
                    this.wizardData.priority = e.target.value;
                    document.querySelectorAll('.wizard-priority-card').forEach(card => {
                        card.classList.remove('selected');
                    });
                    e.target.closest('.wizard-priority-card')?.classList.add('selected');
                }
            });
        }

        // Schedule radios
        document.querySelectorAll('input[name="auto-schedule"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.wizardData.scheduleType = e.target.value;
                document.querySelectorAll('.wizard-schedule-card').forEach(card => {
                    card.classList.remove('selected');
                });
                e.target.closest('.wizard-schedule-card').classList.add('selected');

                // Show/hide datetime picker
                const datetimePicker = document.getElementById('schedule-datetime-picker');
                if (datetimePicker) {
                    datetimePicker.classList.toggle('hidden', e.target.value !== 'later');
                }

                // Reset scheduled_at if "now" selected
                if (e.target.value === 'now') {
                    this.wizardData.scheduled_at = null;
                }
            });
        });

        // Schedule date/time inputs
        const scheduleDate = document.getElementById('schedule-date');
        const scheduleTime = document.getElementById('schedule-time');

        const updateScheduledAt = () => {
            if (scheduleDate?.value && scheduleTime?.value) {
                this.wizardData.scheduled_at = `${scheduleDate.value}T${scheduleTime.value}:00`;
            } else if (scheduleDate?.value) {
                this.wizardData.scheduled_at = `${scheduleDate.value}T00:00:00`;
            } else {
                this.wizardData.scheduled_at = null;
            }
        };

        scheduleDate?.addEventListener('change', updateScheduledAt);
        scheduleTime?.addEventListener('change', updateScheduledAt);
    }

    /**
     * Update product selection count
     * @private
     */
    _updateProductSelection() {
        const checked = document.querySelectorAll('input[name="auto-product"]:checked');
        this.wizardData.products = Array.from(checked).map(cb => cb.value);
        const countEl = document.getElementById('auto-product-selection-count');
        if (countEl) countEl.textContent = this.wizardData.products.length;
    }

    /**
     * Filter items by search text
     * @private
     */
    _filterItems(searchText) {
        const list = document.getElementById('auto-product-list');
        if (!list) return;

        const items = list.querySelectorAll('.auto-product-item');
        const search = searchText.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('.wizard-item-name')?.textContent?.toLowerCase() || '';
            const meta = item.querySelector('.wizard-item-meta')?.textContent?.toLowerCase() || '';
            const visible = name.includes(search) || meta.includes(search);
            item.style.display = visible ? '' : 'none';
        });
    }

    /**
     * Select all visible products
     * @private
     */
    _selectAllProducts() {
        const checkboxes = document.querySelectorAll('input[name="auto-product"]:not(:checked)');
        checkboxes.forEach(cb => {
            if (cb.closest('.auto-product-item').style.display !== 'none') {
                cb.checked = true;
            }
        });
        this._updateProductSelection();
    }

    /**
     * Submit wizard - check cache and send
     * @private
     */
    async _submit() {
        try {
            Modal.close(this.modalId);

            // First, check render cache status
            const cacheStatus = await this._checkRenderCacheStatus(this.wizardData.products);

            if (cacheStatus && cacheStatus.all_ready) {
                // All products have cached renders, use them
                await this._submitWithCache(cacheStatus.ready);
                return;
            }

            if (cacheStatus && (cacheStatus.pending_count > 0 || cacheStatus.not_cached_count > 0)) {
                // Some products don't have cached renders, show warning
                this._showRenderCacheWarning(cacheStatus);
                return;
            }

            // Fallback: Cache check failed or returned null, use original pre-render method
            await this._submitWithPreRender();

        } catch (error) {
            Logger.error('Failed to submit auto send:', error);
            Modal.close('auto-send-progress-modal');
            Toast.error(this.__('autoWizard.sendError'));
        }
    }

    /**
     * Check render cache status for selected products
     * @private
     */
    async _checkRenderCacheStatus(productIds) {
        try {
            // Build products array with template_ids
            const products = [];
            for (const productId of productIds) {
                const product = this.assignedProducts.find(p => p.id === productId);
                if (product) {
                    const templateId = product.labels?.[0]?.template_id ||
                                       product.labels_grouped?.[0]?.template_id;
                    if (templateId) {
                        products.push({ id: productId, template_id: templateId });
                    }
                }
            }

            const response = await this.app.api.post('/render-cache/check', {
                products: products,
                create_jobs_for_missing: true
            });

            if (response.success) {
                return response.data;
            }

            return {
                all_ready: false,
                ready_count: 0,
                pending_count: 0,
                not_cached_count: products.length,
                ready: [],
                pending: [],
                not_cached: products.map(p => ({ product_id: p.id, template_id: p.template_id }))
            };
        } catch (error) {
            Logger.error('Failed to check render cache status:', error);
            return null;
        }
    }

    /**
     * Show render cache status warning modal
     * @private
     */
    _showRenderCacheWarning(cacheStatus) {
        const { all_ready, ready_count, pending_count, not_cached_count, progress_percent } = cacheStatus;

        Modal.show({
            id: 'render-cache-warning',
            title: this.__('renderCache.warningTitle') || 'Render Durumu',
            icon: 'ti-alert-triangle',
            content: `
                <div class="render-cache-warning-content">
                    <div class="render-cache-status-icon warning">
                        <i class="ti ti-loader"></i>
                    </div>
                    <p class="render-cache-message">
                        ${this.__('renderCache.pendingMessage')}
                    </p>

                    <div class="render-cache-stats">
                        <div class="render-cache-stat ready">
                            <i class="ti ti-check"></i>
                            <span>${ready_count}</span>
                            <small>${this.__('renderCache.ready')}</small>
                        </div>
                        <div class="render-cache-stat pending">
                            <i class="ti ti-clock"></i>
                            <span>${pending_count + not_cached_count}</span>
                            <small>${this.__('renderCache.pending')}</small>
                        </div>
                    </div>

                    <div class="render-cache-progress">
                        <div class="render-cache-progress-bar">
                            <div class="render-cache-progress-fill" style="width: ${progress_percent || 0}%"></div>
                        </div>
                        <span class="render-cache-progress-text">${progress_percent || 0}%</span>
                    </div>

                    <div class="render-cache-options">
                        <p class="render-cache-options-title">${this.__('renderCache.optionsTitle')}</p>

                        <button type="button" class="render-cache-option-btn wait" id="render-cache-wait">
                            <i class="ti ti-clock-play"></i>
                            <div>
                                <span class="option-title">${this.__('renderCache.waitOption')}</span>
                                <span class="option-desc">${this.__('renderCache.waitOptionDesc')}</span>
                            </div>
                        </button>

                        <button type="button" class="render-cache-option-btn continue" id="render-cache-continue">
                            <i class="ti ti-send"></i>
                            <div>
                                <span class="option-title">${this.__('renderCache.continueOption')}</span>
                                <span class="option-desc">${this.__('renderCache.continueOptionDesc')}</span>
                            </div>
                        </button>

                        <button type="button" class="render-cache-option-btn render-now" id="render-cache-render-now">
                            <i class="ti ti-refresh"></i>
                            <div>
                                <span class="option-title">${this.__('renderCache.renderNowOption')}</span>
                                <span class="option-desc">${this.__('renderCache.renderNowOptionDesc')}</span>
                            </div>
                        </button>
                    </div>
                </div>
            `,
            showFooter: false,
            size: 'md'
        });

        // Bind option buttons
        setTimeout(() => {
            document.getElementById('render-cache-wait')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                this._renderAndSend(cacheStatus);
            });
            document.getElementById('render-cache-continue')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                if (cacheStatus.ready && cacheStatus.ready.length > 0) {
                    this._submitWithCache(cacheStatus.ready);
                } else {
                    Toast.warning(this.__('renderCache.noReadyProducts'));
                }
            });
            document.getElementById('render-cache-render-now')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                this._renderAndSend(cacheStatus);
            });
        }, 100);
    }

    /**
     * Start RenderWorker and wait for completion, then send
     * @private
     */
    async _renderAndSend(cacheStatus) {
        const notReady = [...(cacheStatus.pending || []), ...(cacheStatus.not_cached || [])];

        if (notReady.length === 0) {
            // All ready, proceed with send
            await this._submitWithCache(cacheStatus.ready);
            return;
        }

        const makeRenderKey = (productId, templateId) => `${String(productId || '').trim()}::${String(templateId || '').trim()}`;
        const expectedKeys = new Set(
            notReady
                .map(n => makeRenderKey(n.product_id, n.template_id))
                .filter(k => !k.startsWith('::'))
        );
        const expectedCount = Math.max(expectedKeys.size, 1);

        // Show progress modal
        Modal.show({
            id: 'render-progress-modal',
            title: this.__('renderCache.renderingTitle'),
            icon: 'ti-loader',
            content: `
                <div class="render-progress-container">
                    <div class="render-progress-info">
                        <p>${this.__('renderCache.renderingMessage')}</p>
                        <p class="render-progress-count">
                            <span id="render-completed-count">0</span> / ${expectedCount}
                        </p>
                    </div>
                    <div class="render-progress-bar">
                        <div class="render-progress-fill" id="render-progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        // Start RenderWorker
        const worker = getRenderWorker(this.app);
        const expectedProducts = new Set(notReady.map(n => String(n.product_id)));
        const expectedTemplateIds = [...new Set(
            notReady
                .map(n => String(n.template_id || '').trim())
                .filter(Boolean)
        )];
        const completedKeys = new Set();

        const focusContext = {
            batchId: cacheStatus.batch_id || null,
            productIds: [...expectedProducts],
            templateIds: expectedTemplateIds,
            notifications: false
        };

        if (typeof worker.setFocusContext === 'function') {
            worker.setFocusContext(focusContext);
        }

        const previousNotificationMode = typeof worker.getNotificationsEnabled === 'function'
            ? worker.getNotificationsEnabled()
            : true;
        if (typeof worker.setNotificationsEnabled === 'function') {
            worker.setNotificationsEnabled(false);
        }

        let failSafeTimer = null;
        const cleanup = () => {
            if (failSafeTimer) {
                clearTimeout(failSafeTimer);
                failSafeTimer = null;
            }
            worker.off('jobCompleted', onJobCompleted);
            worker.off('jobFailed', onJobFailed);
            worker.off('focusCompleted', onFocusCompleted);
            if (typeof worker.setNotificationsEnabled === 'function') {
                worker.setNotificationsEnabled(previousNotificationMode);
            }
        };

        const resolveJobKey = (data) => {
            const productId = String(data?.job?.product_id || data?.product?.id || '').trim();
            const templateId = String(data?.job?.template_id || '').trim();
            let key = makeRenderKey(productId, templateId);
            if (expectedKeys.has(key)) {
                return key;
            }
            if (!productId) return '';
            const fallback = [...expectedKeys].find(k => k.startsWith(`${productId}::`) && !completedKeys.has(k));
            return fallback || '';
        };

        // Listen for job completions
        const onJobCompleted = (data) => {
            const key = resolveJobKey(data);
            if (!key || completedKeys.has(key)) {
                return;
            }

            completedKeys.add(key);
            const progressFill = document.getElementById('render-progress-fill');
            const countEl = document.getElementById('render-completed-count');
            const completedCount = completedKeys.size;

            if (progressFill) progressFill.style.width = `${(completedCount / expectedCount) * 100}%`;
            if (countEl) countEl.textContent = completedCount;

            if (completedCount >= expectedCount) {
                // All renders complete, proceed with send
                cleanup();
                this._renderRetryCount = 0;

                setTimeout(() => {
                    Modal.close('render-progress-modal');
                    Toast.success(this.__('renderCache.renderComplete'));

                    // Re-check cache and send
                    this._submit();
                }, 500);
            }
        };

        const onJobFailed = (data) => {
            const key = resolveJobKey(data);
            if (!key || completedKeys.has(key)) {
                return;
            }

            completedKeys.add(key);
            const progressFill = document.getElementById('render-progress-fill');
            const countEl = document.getElementById('render-completed-count');
            const completedCount = completedKeys.size;
            if (progressFill) progressFill.style.width = `${(completedCount / expectedCount) * 100}%`;
            if (countEl) countEl.textContent = completedCount;

            if (completedCount >= expectedCount) {
                cleanup();
                this._renderRetryCount = 0;
                setTimeout(() => {
                    Modal.close('render-progress-modal');
                    this._submit();
                }, 500);
            }
        };

        const onFocusCompleted = () => {
            cleanup();
            this._renderRetryCount = 0;
            setTimeout(() => {
                Modal.close('render-progress-modal');
                this._submit();
            }, 300);
        };

        worker.on('jobCompleted', onJobCompleted);
        worker.on('jobFailed', onJobFailed);
        worker.on('focusCompleted', onFocusCompleted);

        // Start the worker if not running
        if (!worker.isRunning) {
            worker.start(focusContext);
        } else if (worker.isPaused) {
            worker.resume();
        }

        failSafeTimer = setTimeout(() => {
            cleanup();
            Modal.close('render-progress-modal');
            this._renderRetryCount = (this._renderRetryCount || 0) + 1;
            if (this._renderRetryCount > 1) {
                Toast.error(this.__('autoWizard.sendError'));
                return;
            }
            Toast.warning(this.__('renderCache.pendingMessage'));
            this._submit();
        }, 90000);
    }

    /**
     * Submit with cached images
     * @private
     */
    async _submitWithCache(readyProducts) {
        try {
            // Get cached images from the ready products
            const cachedImages = {};
            for (const item of readyProducts) {
                if (item.image_path) {
                    cachedImages[item.product_id] = item.image_path;
                }
            }

            // Only send products that have cached images
            const productIdsToSend = readyProducts.map(r => r.product_id);

            if (productIdsToSend.length === 0) {
                Toast.warning(this.__('renderCache.noReadyProducts'));
                return;
            }

            // Show progress modal
            Modal.show({
                id: 'auto-send-progress-modal',
                title: this.__('wizard.sending'),
                icon: 'ti-loader',
                content: `
                    <div class="send-progress-container">
                        <div class="send-progress-info">
                            <p>${this.__('wizard.sendingInfo')}</p>
                        </div>
                        <div class="send-progress-bar">
                            <div class="send-progress-fill" id="auto-send-progress-fill" style="width: 50%"></div>
                        </div>
                        <div class="send-progress-text">
                            <span id="auto-send-progress-text">${this.__('renderCache.usingCachedImages')}</span>
                        </div>
                    </div>
                `,
                showFooter: false,
                closable: false,
                closeOnEscape: false,
                closeOnBackdrop: false
            });

            const response = await this.app.api.post('/render-queue/auto', {
                product_ids: productIdsToSend,
                use_cache: true,
                cached_images: cachedImages,
                priority: this.wizardData.priority,
                scheduled_at: this.wizardData.scheduled_at
            });

            setTimeout(() => {
                Modal.close('auto-send-progress-modal');
            }, 500);

            if (response.success) {
                Toast.success(this.__('autoWizard.sendSuccess'));

                // Notify parent to reload and start worker
                if (this.onSubmit) {
                    await this.onSubmit(this.wizardData);
                }

                if (!this.wizardData.scheduled_at && this.onStartWorker) {
                    setTimeout(() => {
                        this.onStartWorker();
                    }, 500);
                }
            } else {
                Toast.error(response.message || this.__('autoWizard.sendError'));
            }
        } catch (error) {
            Logger.error('Failed to submit cached send:', error);
            Modal.close('auto-send-progress-modal');
            Toast.error(this.__('autoWizard.sendError'));
        }
    }

    /**
     * Submit with pre-rendering (fallback method)
     * @private
     */
    async _submitWithPreRender() {
        // Show progress modal
        const totalProducts = this.wizardData.products.length;
        const selectedProducts = this.assignedProducts.filter(p => this.wizardData.products.includes(p.id));
        const totalDevices = selectedProducts.reduce((sum, p) => sum + (p.labels?.length || 0), 0);

        Modal.show({
            id: 'auto-send-progress-modal',
            title: this.__('wizard.sending'),
            icon: 'ti-loader',
            content: `
                <div class="send-progress-container">
                    <div class="send-progress-info">
                        <p>${this.__('wizard.sendingInfo')}</p>
                    </div>
                    <div class="send-progress-bar">
                        <div class="send-progress-fill" id="auto-send-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="send-progress-text">
                        <span id="auto-send-progress-text">${this.__('wizard.preparing')}</span>
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        // Pre-render images for each product using Fabric.js (frontend canvas)
        const preRenderedImages = {};
        const renderer = getTemplateRenderer();
        const templateCache = {}; // Cache templates to avoid repeated API calls

        const updateProgress = (current, total, status) => {
            const progressFill = document.getElementById('auto-send-progress-fill');
            const progressText = document.getElementById('auto-send-progress-text');
            if (progressFill) progressFill.style.width = `${(current / total) * 100}%`;
            if (progressText) progressText.textContent = status;
        };

        for (let i = 0; i < selectedProducts.length; i++) {
            const product = selectedProducts[i];
            const productId = product.id;

            // Get template_id from product's labels
            const templateId = product.labels?.[0]?.template_id ||
                               product.labels_grouped?.[0]?.template_id;

            if (!templateId) {
                Logger.warn(`Product ${productId} has no template assigned, skipping pre-render`);
                continue;
            }

            updateProgress(i + 1, totalProducts, `${this.__('wizard.rendering')} (${i + 1}/${totalProducts})`);

            try {
                // Get template data (from cache or API)
                let template = templateCache[templateId];
                if (!template) {
                    const templateRes = await this.app.api.get(`/templates/${templateId}`);
                    if (templateRes.success && templateRes.data) {
                        template = templateRes.data;
                        templateCache[templateId] = template;
                    } else {
                        Logger.warn(`Template ${templateId} not found, skipping pre-render for product ${productId}`);
                        continue;
                    }
                }

                // Render the template with product data
                const renderOptions = {
                    preserveHelpers: shouldPreserveHelperObjectsForTemplate(template)
                };
                const renderedImage = await renderer.render(template, product, renderOptions);

                if (renderedImage) {
                    preRenderedImages[productId] = renderedImage;
                }
            } catch (renderError) {
                Logger.error(`Failed to pre-render product ${productId}:`, renderError);
                // Continue with other products even if one fails
            }
        }

        updateProgress(totalProducts, totalProducts, this.__('wizard.sendingToQueue'));

        // Create jobs with pre-rendered images
        const response = await this.app.api.post('/render-queue/auto', {
            product_ids: this.wizardData.products,
            pre_rendered_images: preRenderedImages,
            priority: this.wizardData.priority,
            scheduled_at: this.wizardData.scheduled_at
        });

        setTimeout(() => {
            Modal.close('auto-send-progress-modal');
        }, 1500);

        if (response.success) {
            Toast.success(this.__('autoWizard.sendSuccess'));

            // Notify parent to reload and start worker
            if (this.onSubmit) {
                await this.onSubmit(this.wizardData);
            }

            // Zamanlanmış değilse otomatik olarak worker'ı başlat
            if (!this.wizardData.scheduled_at && this.onStartWorker) {
                setTimeout(() => {
                    this.onStartWorker();
                }, 500);
            }
        } else {
            Toast.error(response.message || this.__('autoWizard.sendError'));
        }
    }

    /**
     * Get assigned products data
     */
    getAssignedProducts() {
        return this.assignedProducts;
    }

    /**
     * Get wizard data
     */
    getWizardData() {
        return this.wizardData;
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        this.assignedProducts = [];
        this.wizardData = {
            products: [],
            priority: 'normal',
            scheduleType: 'now',
            scheduled_at: null
        };
    }
}

export { AutoSendWizard };
