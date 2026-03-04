/**
 * License Plan Form Page (Admin)
 * Full-page form for creating/editing license plans
 * Replaces the old modal-based plan editor
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

const DEVICE_CATEGORIES = [
    { key: 'esl_rf', icon: 'ti-antenna' },
    { key: 'esl_tablet', icon: 'ti-device-tablet' },
    { key: 'esl_pos', icon: 'ti-receipt' },
    { key: 'signage_fiyatgor', icon: 'ti-price-tag' },
    { key: 'signage_tv', icon: 'ti-device-tv' }
];

const FEATURE_LIST = [
    'esl_support',
    'basic_templates',
    'email_support',
    'signage_support',
    'advanced_templates',
    'priority_support',
    'api_access',
    'custom_branding',
    'multi_location',
    'dedicated_support',
    'sla_guarantee',
    'custom_integration',
    'white_label',
    'analytics',
    'export_reports',
    'bulk_import',
    'scheduler',
    'notifications'
];

export class LicensePlanFormPage {
    constructor(app) {
        this.app = app;
        this.plan = null;
        this.isEdit = false;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('admin');

        // Check if editing existing plan
        const hash = window.location.hash;
        const editMatch = hash.match(/\/admin\/licenses\/plans\/([^/]+)\/edit/);
        if (editMatch) {
            const planId = editMatch[1];
            try {
                const response = await this.app.api.get(`/payments/license-plans/${planId}`);
                if (response.success && response.data) {
                    this.plan = response.data;
                    this.isEdit = true;
                }
            } catch (error) {
                Logger.error('Plan load error:', error);
            }
        }
    }

    render() {
        const plan = this.plan;
        const title = this.isEdit
            ? this.__('licenses.plans.editPlan')
            : this.__('licenses.plans.addPlan');

        const pricingMode = plan?.pricing_mode || 'flat';
        const isPerDeviceType = pricingMode === 'per_device_type';
        const isPerDevice = pricingMode === 'per_device';

        // Parse device_categories and default_device_pricing from plan
        const deviceCategories = Array.isArray(plan?.device_categories) ? plan.device_categories : [];
        const defaultPricing = (typeof plan?.default_device_pricing === 'object' && plan?.default_device_pricing !== null)
            ? plan.default_device_pricing : {};
        const pricingMeta = (typeof defaultPricing._meta === 'object' && defaultPricing._meta !== null)
            ? defaultPricing._meta : {};

        const durationMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        const perDeviceUnitPrice = this._getPerDeviceUnitPrice(plan);
        const perDeviceTypeExchangeRate = Math.max(0.01, parseFloat(pricingMeta.exchange_rate) || 1);
        const perDeviceTypeBaseCurrency = pricingMeta.base_currency || 'USD';

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">&rsaquo;</span>
                    <a href="#/admin/licenses">${this.__('licenses.title')}</a>
                    <span class="breadcrumb-separator">&rsaquo;</span>
                    <span class="breadcrumb-current">${title}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon amber">
                            <i class="ti ti-list-details"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${title}</h1>
                            <p class="page-subtitle">${this.isEdit ? escapeHTML(plan?.name || '') : this.__('licenses.plans.description')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/admin/licenses" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button type="submit" form="plan-page-form" class="btn btn-primary" id="save-plan-btn">
                            <i class="ti ti-device-floppy"></i>
                            ${this.__('actions.save')}
                        </button>
                    </div>
                </div>
            </div>

            <form id="plan-page-form" class="plan-form-layout">
                <input type="hidden" id="plan-id" value="${escapeHTML(plan?.id || '')}">

                <!-- Left Column -->
                <div class="plan-form-main">

                    <!-- Basic Info Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ti ti-info-circle"></i> ${this.__('licenses.plans.form.name')}</h3>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.name')} *</label>
                                    <input type="text" id="plan-name" class="form-input" value="${escapeHTML(plan?.name || '')}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.slug')}</label>
                                    <input type="text" id="plan-slug" class="form-input" value="${escapeHTML(plan?.slug || '')}" placeholder="${this.__('licenses.plans.form.slugPlaceholder')}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">${this.__('licenses.plans.form.description')}</label>
                                <textarea id="plan-description" class="form-input" rows="2">${escapeHTML(plan?.description || '')}</textarea>
                            </div>
                            <div class="grid grid-cols-3 gap-4">
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.planType')}</label>
                                    <select id="plan-type" class="form-select">
                                        <option value="subscription" ${plan?.plan_type === 'subscription' ? 'selected' : ''}>${this.__('licenses.plans.form.planTypeSubscription')}</option>
                                        <option value="standard" ${plan?.plan_type === 'standard' ? 'selected' : ''}>${this.__('licenses.plans.form.planTypeStandard')}</option>
                                        <option value="professional" ${plan?.plan_type === 'professional' ? 'selected' : ''}>${this.__('licenses.plans.form.planTypePro')}</option>
                                        <option value="enterprise" ${plan?.plan_type === 'enterprise' ? 'selected' : ''}>${this.__('licenses.plans.form.planTypeEnterprise')}</option>
                                        <option value="free" ${plan?.plan_type === 'free' ? 'selected' : ''}>${this.__('licenses.plans.form.planTypeFree')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.duration')}</label>
                                    <input type="number" id="plan-duration" class="form-input" value="${durationMonths}" min="1" max="120">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.sortOrder')}</label>
                                    <input type="number" id="plan-sort-order" class="form-input" value="${plan?.sort_order || 0}" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pricing Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ti ti-currency-lira"></i> ${this.__('licenses.plans.form.pricingMode')}</h3>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-3 gap-4">
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.pricingMode')}</label>
                                    <select id="plan-pricing-mode" class="form-select">
                                        <option value="flat" ${pricingMode === 'flat' ? 'selected' : ''}>${this.__('licenses.plans.form.pricingModeFlat')}</option>
                                        <option value="per_device" ${pricingMode === 'per_device' ? 'selected' : ''}>${this.__('licenses.plans.form.pricingModePerDevice')}</option>
                                        <option value="per_device_type" ${pricingMode === 'per_device_type' ? 'selected' : ''}>${this.__('licenses.plans.form.pricingModePerDeviceType')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.price')} *</label>
                                    <input type="number" id="plan-price" class="form-input" value="${plan?.price || 0}" step="0.01" min="0" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.currency')}</label>
                                    <select id="plan-currency" class="form-select">
                                        <option value="TRY" ${plan?.currency === 'TRY' || !plan?.currency ? 'selected' : ''}>TRY (\u20ba)</option>
                                        <option value="USD" ${plan?.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                        <option value="EUR" ${plan?.currency === 'EUR' ? 'selected' : ''}>EUR (\u20ac)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Per-device unit price (only for per_device mode) -->
                            <div class="form-group" id="per-device-price-group" style="${isPerDevice ? '' : 'display:none;'}">
                                <label class="form-label">${this.__('licenses.plans.form.deviceUnitPrice')}</label>
                                <input type="number" id="plan-device-unit-price" class="form-input" value="${Number.isFinite(perDeviceUnitPrice) ? perDeviceUnitPrice.toFixed(2) : '0.00'}" step="0.01" min="0">
                                <small class="text-muted text-xs">${this.__('licenses.plans.form.deviceUnitPriceHint')}</small>
                            </div>

                            <!-- Per-device-type default pricing (only for per_device_type mode) -->
                            <div id="device-type-pricing-section" style="${isPerDeviceType ? '' : 'display:none;'}">
                                <h4 class="form-section-title mt-4 mb-3">
                                    <i class="ti ti-category"></i> ${this.__('licenses.plans.form.deviceCategories')}
                                </h4>
                                <p class="text-muted text-xs mb-3">${this.__('licenses.plans.form.deviceCategoriesHint')}</p>
                                <div class="device-category-pricing-grid">
                                    ${DEVICE_CATEGORIES.map(cat => {
                                        const isChecked = deviceCategories.includes(cat.key);
                                        const defaultPrice = defaultPricing[cat.key]?.unit_price || 0;
                                        const defaultCurrency = defaultPricing[cat.key]?.currency || perDeviceTypeBaseCurrency;
                                        const defaultCount = parseInt(defaultPricing[cat.key]?.device_count ?? defaultPricing[cat.key]?.default_count ?? 0, 10) || 0;
                                        return `
                                            <div class="device-category-row">
                                                <label class="device-category-check">
                                                    <input type="checkbox" class="form-checkbox device-cat-checkbox" value="${cat.key}" ${isChecked ? 'checked' : ''}>
                                                    <i class="ti ${cat.icon}"></i>
                                                    <span>${this.__('licenses.deviceCategories.' + cat.key)}</span>
                                                </label>
                                                <div class="device-category-price-inputs">
                                                    <input type="number" class="form-input form-input-sm device-cat-count" data-category="${cat.key}" value="${defaultCount}" step="1" min="0" placeholder="Adet" ${!isChecked ? 'disabled' : ''}>
                                                    <input type="number" class="form-input form-input-sm device-cat-price" data-category="${cat.key}" value="${defaultPrice}" step="0.01" min="0" placeholder="${this.__('licenses.pricing.unitPrice')}" ${!isChecked ? 'disabled' : ''}>
                                                    <select class="form-select form-select-sm device-cat-currency" data-category="${cat.key}" ${!isChecked ? 'disabled' : ''}>
                                                        <option value="USD" ${defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                                                        <option value="EUR" ${defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                                                        <option value="TRY" ${defaultCurrency === 'TRY' ? 'selected' : ''}>TRY</option>
                                                    </select>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <div class="grid grid-cols-4 gap-4 mt-4">
                                    <div class="form-group">
                                        <label class="form-label">Kur</label>
                                        <input type="number" id="plan-exchange-rate" class="form-input" value="${perDeviceTypeExchangeRate}" step="0.01" min="0.01">
                                        <small class="text-muted text-xs">Secili baz para birimi icin manuel kur.</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Baz Para Birimi</label>
                                        <input type="text" id="plan-base-currency" class="form-input" value="${escapeHTML(perDeviceTypeBaseCurrency)}" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Aylik Toplam</label>
                                        <input type="text" id="plan-device-type-monthly-total" class="form-input" value="0.00" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Aylik TL Karsiligi</label>
                                        <input type="text" id="plan-device-type-monthly-try-total" class="form-input" value="0.00" readonly>
                                    </div>
                                </div>
                                <div class="alert alert-info mt-3" id="plan-device-type-summary"></div>
                                <small class="text-muted text-xs mt-2 d-block">${this.__('licenses.plans.form.defaultUnitPricesHint')}</small>
                            </div>
                        </div>
                    </div>

                    <!-- Limits Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ti ti-adjustments"></i> ${this.__('licenses.plans.form.limits') || 'Limitler'}</h3>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-3 gap-4">
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxUsers')}</label>
                                    <input type="number" id="plan-max-users" class="form-input" value="${plan?.max_users ?? 1}" min="-1">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxDevices')}</label>
                                    <input type="number" id="plan-max-devices" class="form-input" value="${plan?.max_devices ?? 10}" min="-1">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxProducts')}</label>
                                    <input type="number" id="plan-max-products" class="form-input" value="${plan?.max_products ?? 100}" min="-1">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxTemplates')}</label>
                                    <input type="number" id="plan-max-templates" class="form-input" value="${plan?.max_templates ?? 10}" min="-1">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxBranches')}</label>
                                    <input type="number" id="plan-max-branches" class="form-input" value="${plan?.max_branches ?? 1}" min="-1">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('licenses.plans.form.maxStorage')}</label>
                                    <input type="number" id="plan-storage-limit" class="form-input" value="${plan?.storage_limit ?? 1024}" min="0">
                                    <small class="text-muted text-xs">${this.__('licenses.plans.form.unlimitedHint')}</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Features Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ti ti-list-check"></i> ${this.__('licenses.plans.form.features')}</h3>
                        </div>
                        <div class="card-body">
                            <p class="text-muted text-xs mb-3">${this.__('licenses.plans.form.selectFeatures')}</p>
                            <div class="features-checkbox-grid">
                                ${this._renderFeatureCheckboxes(plan?.features || [])}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Sidebar -->
                <div class="plan-form-sidebar">

                    <!-- Status Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ti ti-toggle-left"></i> ${this.__('licenses.plans.form.status')}</h3>
                        </div>
                        <div class="card-body">
                            <div class="form-group mb-3">
                                <label class="form-label flex items-center gap-2">
                                    <input type="checkbox" id="plan-is-active" class="form-checkbox" ${plan?.is_active !== false ? 'checked' : ''}>
                                    ${this.__('licenses.plans.form.isActive')}
                                </label>
                            </div>
                            <div class="form-group mb-3">
                                <label class="form-label flex items-center gap-2">
                                    <input type="checkbox" id="plan-is-popular" class="form-checkbox" ${plan?.is_popular ? 'checked' : ''}>
                                    ${this.__('licenses.plans.form.isPopular')}
                                </label>
                            </div>
                            <div class="form-group">
                                <label class="form-label flex items-center gap-2">
                                    <input type="checkbox" id="plan-is-enterprise" class="form-checkbox" ${plan?.is_enterprise ? 'checked' : ''}>
                                    ${this.__('licenses.plans.form.isEnterprise')}
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Save Button (Mobile) -->
                    <div class="card d-block d-lg-none">
                        <div class="card-body">
                            <button type="submit" class="btn btn-primary btn-block">
                                <i class="ti ti-device-floppy"></i>
                                ${this.__('actions.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    async init() {
        this.bindEvents();
    }

    bindEvents() {
        // Form submit
        const form = document.getElementById('plan-page-form');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePlan();
        });

        // Pricing mode change
        const modeSelect = document.getElementById('plan-pricing-mode');
        modeSelect?.addEventListener('change', () => this._syncPricingMode());

        // Per-device unit price sync
        const unitPriceInput = document.getElementById('plan-device-unit-price');
        const durationInput = document.getElementById('plan-duration');
        const priceInput = document.getElementById('plan-price');

        unitPriceInput?.addEventListener('input', () => this._syncPerDevicePrice());
        durationInput?.addEventListener('input', () => {
            this._syncPerDevicePrice();
            this._syncPerDeviceTypePrice();
        });

        // Device category checkboxes
        document.querySelectorAll('.device-cat-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const row = e.target.closest('.device-category-row');
                const inputs = row?.querySelectorAll('input[type="number"], select');
                inputs?.forEach(input => {
                    if (input !== e.target) {
                        input.disabled = !e.target.checked;
                    }
                });
                if (e.target.checked) {
                    const rowCurrency = row?.querySelector('.device-cat-currency');
                    if (rowCurrency) {
                        rowCurrency.value = document.getElementById('plan-currency')?.value || rowCurrency.value;
                    }
                }
                this._syncPerDeviceTypePrice();
            });
        });

        document.querySelectorAll('.device-cat-count, .device-cat-price, .device-cat-currency').forEach((input) => {
            input.addEventListener('input', () => this._syncPerDeviceTypePrice());
            input.addEventListener('change', () => this._syncPerDeviceTypePrice());
        });

        document.getElementById('plan-exchange-rate')?.addEventListener('input', () => this._syncPerDeviceTypePrice());
        document.getElementById('plan-currency')?.addEventListener('change', () => {
            this._syncPerDeviceTypeCurrency();
            this._syncPerDeviceTypePrice();
        });

        // Auto-generate slug from name
        const nameInput = document.getElementById('plan-name');
        const slugInput = document.getElementById('plan-slug');
        if (nameInput && slugInput && !this.isEdit) {
            nameInput.addEventListener('input', () => {
                if (!slugInput.dataset.userEdited) {
                    slugInput.value = nameInput.value
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')
                        .trim();
                }
            });
            slugInput.addEventListener('input', () => {
                slugInput.dataset.userEdited = '1';
            });
        }

        // Initial sync
        this._syncPricingMode();
        this._syncPerDeviceTypeCurrency();
        this._syncPerDeviceTypePrice();
    }

    _syncPricingMode() {
        const mode = document.getElementById('plan-pricing-mode')?.value;
        const perDeviceGroup = document.getElementById('per-device-price-group');
        const perDeviceTypeSection = document.getElementById('device-type-pricing-section');
        const priceInput = document.getElementById('plan-price');
        const currencyInput = document.getElementById('plan-currency');

        if (perDeviceGroup) {
            perDeviceGroup.style.display = mode === 'per_device' ? '' : 'none';
        }
        if (perDeviceTypeSection) {
            perDeviceTypeSection.style.display = mode === 'per_device_type' ? '' : 'none';
        }
        if (priceInput) {
            priceInput.readOnly = mode === 'per_device' || mode === 'per_device_type';
        }

        if (mode === 'per_device') {
            this._syncPerDevicePrice();
        } else if (mode === 'per_device_type') {
            this._syncPerDeviceTypeCurrency();
            this._syncPerDeviceTypePrice();
        }
    }

    _syncPerDevicePrice() {
        const mode = document.getElementById('plan-pricing-mode')?.value;
        if (mode !== 'per_device') return;

        const unitPriceInput = document.getElementById('plan-device-unit-price');
        const durationInput = document.getElementById('plan-duration');
        const priceInput = document.getElementById('plan-price');

        if (!unitPriceInput || !durationInput || !priceInput) return;

        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        const duration = Math.max(1, parseInt(durationInput.value, 10) || 1);
        priceInput.value = (unitPrice * duration).toFixed(2);
    }

    _syncPerDeviceTypePrice() {
        const mode = document.getElementById('plan-pricing-mode')?.value;
        if (mode !== 'per_device_type') return;

        const duration = Math.max(1, parseInt(document.getElementById('plan-duration')?.value, 10) || 1);
        const exchangeRate = Math.max(0.01, parseFloat(document.getElementById('plan-exchange-rate')?.value) || 1);
        const selectedCurrency = document.getElementById('plan-currency')?.value || 'TRY';
        const priceInput = document.getElementById('plan-price');
        const monthlyTotalInput = document.getElementById('plan-device-type-monthly-total');
        const monthlyTryTotalInput = document.getElementById('plan-device-type-monthly-try-total');
        const baseCurrencyInput = document.getElementById('plan-base-currency');
        const summaryEl = document.getElementById('plan-device-type-summary');

        const checkedRows = Array.from(document.querySelectorAll('.device-cat-checkbox:checked')).map((checkbox) => {
            const category = checkbox.value;
            const count = parseInt(document.querySelector(`.device-cat-count[data-category="${category}"]`)?.value, 10) || 0;
            const unitPrice = parseFloat(document.querySelector(`.device-cat-price[data-category="${category}"]`)?.value) || 0;
            const currency = document.querySelector(`.device-cat-currency[data-category="${category}"]`)?.value || 'USD';

            return { category, count, unitPrice, currency, subtotal: count * unitPrice };
        });

        const currencies = [...new Set(checkedRows.map((row) => row.currency).filter(Boolean))];
        const baseCurrency = selectedCurrency || currencies[0] || 'USD';
        const monthlyBaseTotal = checkedRows.reduce((sum, row) => sum + row.subtotal, 0);
        const monthlyTryTotal = baseCurrency === 'TRY'
            ? monthlyBaseTotal
            : (monthlyBaseTotal * exchangeRate);
        const planTotal = monthlyBaseTotal * duration;

        if (baseCurrencyInput) {
            baseCurrencyInput.value = baseCurrency;
        }
        if (monthlyTotalInput) {
            monthlyTotalInput.value = monthlyBaseTotal.toFixed(2);
        }
        if (monthlyTryTotalInput) {
            monthlyTryTotalInput.value = monthlyTryTotal.toFixed(2);
        }
        if (priceInput) {
            priceInput.value = planTotal.toFixed(2);
        }
        if (summaryEl) {
            const warning = currencies.length > 1
                ? '<div class="mt-2 text-warning">Birden fazla para birimi secili. Kur tek baz para birimine gore uygulanir.</div>'
                : '';
            summaryEl.innerHTML = `
                <div>Aylik toplam (${escapeHTML(baseCurrency)}): <strong>${monthlyBaseTotal.toFixed(2)}</strong></div>
                <div>Aylik toplam (TRY): <strong>${monthlyTryTotal.toFixed(2)}</strong></div>
                <div>Plan toplam (${escapeHTML(selectedCurrency)}): <strong>${planTotal.toFixed(2)}</strong></div>
                ${warning}
            `;
        }
    }

    _syncPerDeviceTypeCurrency() {
        const mode = document.getElementById('plan-pricing-mode')?.value;
        if (mode !== 'per_device_type') return;

        const selectedCurrency = document.getElementById('plan-currency')?.value || 'TRY';
        const baseCurrencyInput = document.getElementById('plan-base-currency');

        if (baseCurrencyInput) {
            baseCurrencyInput.value = selectedCurrency;
        }

        document.querySelectorAll('.device-cat-currency').forEach((select) => {
            if (!select.disabled) {
                select.value = selectedCurrency;
            }
        });
    }

    _getPerDeviceUnitPrice(plan) {
        const apiUnitPrice = parseFloat(plan?.device_unit_price);
        if (!Number.isNaN(apiUnitPrice) && apiUnitPrice > 0) {
            return apiUnitPrice;
        }
        const planPrice = parseFloat(plan?.price) || 0;
        const durationMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        return planPrice / durationMonths;
    }

    _renderFeatureCheckboxes(selectedFeatures = []) {
        return FEATURE_LIST.map(feature => {
            const isChecked = selectedFeatures.includes(feature);
            const label = this.__(`licenses.plans.features.${feature}`);
            return `
                <label class="feature-checkbox-item">
                    <input type="checkbox" class="feature-checkbox" value="${feature}" ${isChecked ? 'checked' : ''}>
                    <span class="feature-checkbox-label">${label}</span>
                </label>
            `;
        }).join('');
    }

    async savePlan() {
        const planId = document.getElementById('plan-id')?.value;
        const name = document.getElementById('plan-name')?.value?.trim();
        const pricingMode = document.getElementById('plan-pricing-mode')?.value || 'flat';
        const price = parseFloat(document.getElementById('plan-price')?.value) || 0;
        const durationMonths = parseInt(document.getElementById('plan-duration')?.value, 10) || 1;

        if (!name) {
            Toast.error(this.__('licenses.plans.validation.nameRequired'));
            return;
        }

        // Collect features
        const featureCheckboxes = document.querySelectorAll('.feature-checkbox:checked');
        const features = Array.from(featureCheckboxes).map(cb => cb.value);

        // Helper to parse int safely (0 = unlimited for limit fields)
        const parseIntSafe = (value, defaultValue) => {
            const parsed = parseInt(value);
            return isNaN(parsed) ? defaultValue : parsed;
        };

        // Per-device unit price handling
        let normalizedPrice = price;
        const perDeviceUnitPriceInput = parseFloat(document.getElementById('plan-device-unit-price')?.value) || 0;
        if (pricingMode === 'per_device') {
            if (perDeviceUnitPriceInput <= 0) {
                Toast.error(this.__('licenses.plans.validation.unitPriceRequired'));
                return;
            }
            normalizedPrice = perDeviceUnitPriceInput * Math.max(1, durationMonths);
        }

        // Per-device-type: collect device categories and default pricing
        let deviceCategories = [];
        let defaultDevicePricing = {};

        if (pricingMode === 'per_device_type') {
            const exchangeRate = Math.max(0.01, parseFloat(document.getElementById('plan-exchange-rate')?.value) || 1);
            const baseCurrency = document.getElementById('plan-currency')?.value || document.getElementById('plan-base-currency')?.value || 'USD';
            const monthlyBaseTotal = Math.max(0, parseFloat(document.getElementById('plan-device-type-monthly-total')?.value) || 0);

            document.querySelectorAll('.device-cat-checkbox:checked').forEach(cb => {
                const cat = cb.value;
                deviceCategories.push(cat);
                const countInput = document.querySelector(`.device-cat-count[data-category="${cat}"]`);
                const priceInput = document.querySelector(`.device-cat-price[data-category="${cat}"]`);
                const currencyInput = document.querySelector(`.device-cat-currency[data-category="${cat}"]`);
                defaultDevicePricing[cat] = {
                    device_count: parseInt(countInput?.value, 10) || 0,
                    unit_price: parseFloat(priceInput?.value) || 0,
                    currency: currencyInput?.value || 'USD'
                };
            });

            if (deviceCategories.length === 0) {
                Toast.error(this.__('licenses.plans.validation.nameRequired')); // TODO: better message
                return;
            }

            if (monthlyBaseTotal <= 0) {
                Toast.error('Cihaz bazli toplam sifirdan buyuk olmali');
                return;
            }

            defaultDevicePricing._meta = {
                exchange_rate: exchangeRate,
                base_currency: baseCurrency
            };
            normalizedPrice = monthlyBaseTotal * Math.max(1, durationMonths);
        }

        const data = {
            name,
            slug: document.getElementById('plan-slug')?.value?.trim() || '',
            description: document.getElementById('plan-description')?.value?.trim() || '',
            plan_type: document.getElementById('plan-type')?.value || 'standard',
            price: Math.max(0, normalizedPrice),
            price_in_tl: true,
            currency: document.getElementById('plan-currency')?.value || 'TRY',
            duration_months: Math.max(1, durationMonths),
            pricing_mode: pricingMode,
            device_unit_price: pricingMode === 'per_device' ? perDeviceUnitPriceInput : null,
            device_categories: pricingMode === 'per_device_type' ? deviceCategories : null,
            default_device_pricing: pricingMode === 'per_device_type' ? defaultDevicePricing : null,
            max_users: parseIntSafe(document.getElementById('plan-max-users')?.value, 1),
            max_devices: parseIntSafe(document.getElementById('plan-max-devices')?.value, 10),
            max_products: parseIntSafe(document.getElementById('plan-max-products')?.value, 100),
            max_templates: parseIntSafe(document.getElementById('plan-max-templates')?.value, 10),
            max_branches: parseIntSafe(document.getElementById('plan-max-branches')?.value, 1),
            storage_limit: parseIntSafe(document.getElementById('plan-storage-limit')?.value, 0),
            features,
            is_popular: document.getElementById('plan-is-popular')?.checked || false,
            is_enterprise: document.getElementById('plan-is-enterprise')?.checked || false,
            is_active: document.getElementById('plan-is-active')?.checked || false,
            sort_order: parseIntSafe(document.getElementById('plan-sort-order')?.value, 0)
        };

        try {
            const saveBtn = document.getElementById('save-plan-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> ' + this.__('messages.loading');
            }

            let response;
            if (planId) {
                response = await this.app.api.put(`/payments/license-plans/${planId}`, data);
            } else {
                response = await this.app.api.post('/payments/license-plans', data);
            }

            if (response.success) {
                Toast.success(planId
                    ? this.__('licenses.plans.updated')
                    : this.__('licenses.plans.created'));
                // Navigate back to licenses page, plans tab
                window.location.hash = '#/admin/licenses';
            } else {
                throw new Error(response.message || this.__('messages.operationFailed'));
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.error'));
        } finally {
            const saveBtn = document.getElementById('save-plan-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + this.__('actions.save');
            }
        }
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default LicensePlanFormPage;
