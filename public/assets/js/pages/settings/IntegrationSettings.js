/**
 * Integration Settings Page Component
 * Modernized with top tabs and chart-card style (matching GeneralSettings)
 */

import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Logger } from '../../core/Logger.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class IntegrationSettingsPage {
    constructor(app) {
        this.app = app;
        this.activeTab = 'esl';
        this.hanshowSettings = {};
        this.hanshowConnection = {};
        this.halSettings = {};
        this.halConnection = {};
        this.paymentSettings = {};
        this.paymentPlans = [];
        this.isSuperAdmin = false;
        this.selectedPaymentProvider = 'iyzico'; // 'iyzico' or 'paynet'
        this.paynetSettings = {};
        this.iyzicoSettings = {};
        this.tamsoftSettings = {};
        this.tamsoftDepolar = [];
        this.mqttSettings = {};
        this.priceviewSettings = {};
        this.priceviewTemplates = [];
        this.importSettings = {};
        this.importHistory = [];
        this.importFiles = [];
        this.importHistoryPagination = { page: 1, per_page: 10, total: 0, total_pages: 1 };
        this.importFilesPagination = { page: 1, per_page: 10, total: 0, total_pages: 1 };
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n ? this.app.i18n.t(key, params) : key;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
        // Check if user is SuperAdmin
        const user = this.app.state.get('user');
        this.isSuperAdmin = user?.role === 'SuperAdmin';
    }

    render() {
        const halSifatOptions = this.getHalSifatOptions()
            .map((option) => `<option value="${option.value}">${option.label}</option>`)
            .join('');

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/settings">${this.__('title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('integrations.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon purple">
                            <i class="ti ti-plug-connected"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('integrations.title')}</h1>
                            <p class="page-subtitle">${this.__('integrations.subtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Integration Tab Navigation -->
            <div class="settings-tabs">
                <button class="settings-tab ${this.activeTab === 'esl' ? 'active' : ''}" data-tab="esl">
                    <i class="ti ti-tag"></i>
                    <span>${this.__('integrations.tabs.esl')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'erp' ? 'active' : ''}" data-tab="erp">
                    <i class="ti ti-building"></i>
                    <span>${this.__('integrations.tabs.erp')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'api' ? 'active' : ''}" data-tab="api">
                    <i class="ti ti-api"></i>
                    <span>${this.__('integrations.tabs.api')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'import' ? 'active' : ''}" data-tab="import">
                    <i class="ti ti-file-import"></i>
                    <span>${this.__('integrations.tabs.import')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'priceview' ? 'active' : ''}" data-tab="priceview">
                    <i class="ti ti-tag"></i>
                    <span>${this.__('integrations.tabs.priceview')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'mqtt' ? 'active' : ''}" data-tab="mqtt">
                    <i class="ti ti-broadcast"></i>
                    <span>${this.__('integrations.tabs.mqtt')}</span>
                </button>
                ${this.isSuperAdmin ? `
                <button class="settings-tab ${this.activeTab === 'payment' ? 'active' : ''}" data-tab="payment">
                    <i class="ti ti-credit-card"></i>
                    <span>${this.__('integrations.tabs.payment')}</span>
                </button>
                ` : ''}
            </div>

            <!-- ESL Systems Tab -->
            <div id="tab-esl" class="settings-tab-content ${this.activeTab === 'esl' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- Hanshow ESL Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-tag"></i>
                                ${this.__('integrations.hanshow.title')}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span id="hanshow-status-badge" class="badge badge-secondary">${this.__('integrations.hanshow.loading')}</span>
                            </div>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.hanshow.description')}</p>

                            <!-- Connection Status -->
                            <div id="hanshow-connection-status" class="alert alert-info mb-4">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-loader animate-spin"></i>
                                    <span>${this.__('integrations.hanshow.connectionStatus')}</span>
                                </div>
                            </div>

                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.eslworkingUrl')}</label>
                                    <input type="text" id="hanshow_eslworking_url" class="form-input"
                                        placeholder="http://127.0.0.1:9000">
                                    <small class="form-hint">${this.__('integrations.hanshow.hints.eslworkingUrl')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.userId')}</label>
                                    <input type="text" id="hanshow_user_id" class="form-input"
                                        placeholder="default">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.callbackUrl')}</label>
                                    <input type="text" id="hanshow_callback_url" class="form-input"
                                        placeholder="${this.__('integrations.hanshow.hints.callbackUrl')}">
                                    <small class="form-hint">${this.__('integrations.hanshow.hints.callbackUrl')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.defaultPriority')}</label>
                                    <input type="number" id="hanshow_default_priority" class="form-input"
                                        min="0" max="255" value="10">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.syncInterval')}</label>
                                    <input type="number" id="hanshow_sync_interval" class="form-input"
                                        min="10" value="60">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.ledColor')}</label>
                                    <select id="hanshow_led_color" class="form-select">
                                        <option value="green">${this.__('integrations.hanshow.ledColors.green')}</option>
                                        <option value="blue">${this.__('integrations.hanshow.ledColors.blue')}</option>
                                        <option value="red">${this.__('integrations.hanshow.ledColors.red')}</option>
                                        <option value="yellow">${this.__('integrations.hanshow.ledColors.yellow')}</option>
                                        <option value="white">${this.__('integrations.hanshow.ledColors.white')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.maxRetryAttempts')}</label>
                                    <input type="number" id="hanshow_max_retry_attempts" class="form-input"
                                        min="0" max="10" value="3">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.options')}</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="hanshow_led_flash_on_update" class="form-checkbox">
                                            <span>${this.__('integrations.hanshow.fields.ledFlashOnUpdate')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="hanshow_auto_retry" class="form-checkbox">
                                            <span>${this.__('integrations.hanshow.fields.autoRetry')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="hanshow_enabled" class="form-checkbox">
                                            <span>${this.__('integrations.hanshow.fields.enabled')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-2 mt-4">
                                <button type="button" id="test-hanshow-btn" class="btn btn-outline">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('integrations.hanshow.buttons.testConnection')}
                                </button>
                                <button type="button" id="save-hanshow-btn" class="btn btn-primary">
                                    <i class="ti ti-check"></i>
                                    ${this.__('integrations.hanshow.buttons.save')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- PavoDisplay Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-device-tablet"></i>
                                ${this.__('integrations.pavoDisplay.title')}
                            </h2>
                            <span class="badge badge-success">${this.__('integrations.pavoDisplay.active')}</span>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.pavoDisplay.description')}</p>
                            <div class="alert alert-success">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-circle-check"></i>
                                    <span>${this.__('integrations.pavoDisplay.integrated')}</span>
                                </div>
                            </div>
                            <p class="text-sm text-muted mt-3">
                                ${this.__('integrations.pavoDisplay.deviceManagement', { link: '<a href="#/devices" class="text-primary">' + this.__('integrations.pavoDisplay.devicesLink') + '</a>' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ERP Tab -->
            <div id="tab-erp" class="settings-tab-content ${this.activeTab === 'erp' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- TAMSOFT ERP Integration Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-database"></i>
                                ${this.__('integrations.tamsoft.title')}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span id="tamsoft-status-badge" class="badge badge-secondary">${this.__('integrations.hanshow.loading')}</span>
                            </div>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.tamsoft.description')}</p>

                            <!-- Connection Status -->
                            <div id="tamsoft-connection-status" class="alert alert-info mb-4">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-loader animate-spin"></i>
                                    <span>${this.__('integrations.tamsoft.connectionStatus')}</span>
                                </div>
                            </div>

                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.tamsoft.fields.apiUrl')}</label>
                                    <input type="text" id="tamsoft_api_url" class="form-input"
                                        placeholder="http://tamsoftintegration.camlica.com.tr">
                                    <small class="form-hint">${this.__('integrations.tamsoft.hints.apiUrl')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.tamsoft.fields.username')}</label>
                                    <input type="text" id="tamsoft_username" class="form-input"
                                        placeholder="${this.__('integrations.tamsoft.hints.username')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.tamsoft.fields.password')}</label>
                                    <input type="password" id="tamsoft_password" class="form-input"
                                        placeholder="••••••••">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.tamsoft.fields.defaultDepo')}</label>
                                    <select id="tamsoft_default_depo_id" class="form-select">
                                        <option value="1">${this.__('integrations.tamsoft.hints.loadDepos')}</option>
                                    </select>
                                    <small class="form-hint">${this.__('integrations.tamsoft.hints.defaultDepo')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.tamsoft.fields.syncInterval')}</label>
                                    <input type="number" id="tamsoft_sync_interval" class="form-input"
                                        min="5" value="30">
                                    <small class="form-hint">${this.__('integrations.tamsoft.hints.syncInterval')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.options')}</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="tamsoft_enabled" class="form-checkbox">
                                            <span>${this.__('integrations.hanshow.fields.enabled')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="tamsoft_auto_sync_enabled" class="form-checkbox">
                                            <span>${this.__('integrations.tamsoft.fields.autoSync')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="tamsoft_only_stock_positive" class="form-checkbox">
                                            <span>${this.__('integrations.tamsoft.fields.onlyStockPositive')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="tamsoft_only_ecommerce" class="form-checkbox">
                                            <span>${this.__('integrations.tamsoft.fields.onlyEcommerce')}</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="tamsoft_single_barcode" class="form-checkbox" checked>
                                            <span>${this.__('integrations.tamsoft.fields.singleBarcode')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Last Sync Info -->
                            <div id="tamsoft-last-sync" class="mt-4 p-3 bg-secondary rounded" style="display: none;">
                                <div class="flex items-center gap-2 text-sm">
                                    <i class="ti ti-clock"></i>
                                    <span>${this.__('integrations.tamsoft.lastSync')}: </span>
                                    <strong id="tamsoft-last-sync-date">-</strong>
                                </div>
                            </div>

                            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1rem;">
                                <button type="button" id="test-tamsoft-btn" class="btn btn-outline" style="flex:1;min-width:120px;">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('integrations.hanshow.buttons.testConnection')}
                                </button>
                                <button type="button" id="load-tamsoft-depolar-btn" class="btn btn-outline" style="flex:1;min-width:120px;">
                                    <i class="ti ti-building-warehouse"></i>
                                    ${this.__('integrations.tamsoft.buttons.loadDepolar')}
                                </button>
                                <button type="button" id="save-tamsoft-btn" class="btn btn-primary" style="flex:1;min-width:120px;">
                                    <i class="ti ti-check"></i>
                                    ${this.__('integrations.hanshow.buttons.save')}
                                </button>
                            </div>
                            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-top:0.5rem;">
                                <button type="button" id="sync-tamsoft-btn" class="btn btn-success" style="flex:1;min-width:120px;">
                                    <i class="ti ti-refresh"></i>
                                    ${this.__('integrations.tamsoft.buttons.syncNow')}
                                </button>
                                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;">
                                    <input type="checkbox" id="tamsoft-full-sync" style="accent-color:var(--color-success);cursor:pointer;">
                                    ${this.__('integrations.tamsoft.sync.fullSync') || 'Tam Senkronizasyon'}
                                </label>
                                <button type="button" id="debug-tamsoft-btn" class="btn btn-outline" style="flex:1;min-width:80px;" title="${this.__('integrations.tamsoft.debug.tooltip')}">
                                    <i class="ti ti-bug"></i>
                                    Debug
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- HAL Kayıt Sistemi Integration Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-leaf"></i>
                                ${this.__('integrations.hal.title')}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span id="hal-status-badge" class="badge badge-secondary">${this.__('integrations.hanshow.loading')}</span>
                            </div>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.hal.description')}</p>

                            <!-- Connection Status -->
                            <div id="hal-connection-status" class="alert alert-info mb-4">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-loader animate-spin"></i>
                                    <span>${this.__('integrations.hal.connectionStatus')}</span>
                                </div>
                            </div>

                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.username')}</label>
                                    <input type="text" id="hal_username" class="form-input"
                                        placeholder="${this.__('integrations.hal.hints.username')}">
                                    <small class="form-hint">${this.__('integrations.hal.hints.username')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.password')}</label>
                                    <input type="password" id="hal_password" class="form-input"
                                        placeholder="••••••••">
                                    <small class="form-hint">${this.__('integrations.hal.hints.password')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.servicePassword')}</label>
                                    <input type="password" id="hal_service_password" class="form-input"
                                        placeholder="••••••••">
                                    <small class="form-hint">${this.__('integrations.hal.hints.servicePassword')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.tcVergiNo')}</label>
                                    <input type="text" id="hal_tc_vergi_no" class="form-input"
                                        placeholder="${this.__('integrations.hal.hints.tcVergiNo')}">
                                    <small class="form-hint">${this.__('integrations.hal.hints.tcVergiNo')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.sifatId')}</label>
                                    <select id="hal_sifat_id" class="form-input">
                                        ${halSifatOptions}
                                    </select>
                                    <small class="form-hint">${this.__('integrations.hal.hints.sifatId')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hal.fields.sifat2Id')}</label>
                                    <select id="hal_sifat2_id" class="form-input">
                                        ${halSifatOptions}
                                    </select>
                                    <small class="form-hint">${this.__('integrations.hal.hints.sifat2Id')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.hanshow.fields.options')}</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="hal_enabled" class="form-checkbox">
                                            <span>${this.__('integrations.hanshow.fields.enabled')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-2 mt-4">
                                <button type="button" id="test-hal-btn" class="btn btn-outline">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('integrations.hanshow.buttons.testConnection')}
                                </button>
                                <button type="button" id="save-hal-btn" class="btn btn-primary">
                                    <i class="ti ti-check"></i>
                                    ${this.__('integrations.hanshow.buttons.save')}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- API Tab -->
            <div id="tab-api" class="settings-tab-content ${this.activeTab === 'api' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- API Access Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-api"></i>
                                ${this.__('integrations.types.api.title')}
                            </h2>
                            <span class="badge badge-success">${this.__('integrations.pavoDisplay.active')}</span>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.types.api.description')}</p>

                            <div class="form-grid">
                                <div class="form-group full-width">
                                    <label class="form-label">${this.__('integrations.types.api.fields.apiKey')}</label>
                                    <div class="flex gap-2">
                                        <input type="text" id="api_key" class="form-input flex-1" readonly>
                                        <button type="button" id="copy-api-key-btn" class="btn btn-outline" title="${this.__('actions.copy')}">
                                            <i class="ti ti-copy"></i>
                                        </button>
                                        <button type="button" id="regenerate-api-key-btn" class="btn btn-outline" title="${this.__('actions.refresh')}">
                                            <i class="ti ti-refresh"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.types.api.fields.rateLimit')}</label>
                                    <input type="number" id="api_rate_limit" class="form-input" value="60" min="10">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.types.api.fields.webhookUrl')}</label>
                                    <input type="text" id="api_webhook_url" class="form-input" placeholder="${this.__('integrations.types.api.placeholders.webhookUrl')}">
                                </div>
                            </div>

                            <div class="flex gap-2 mt-4">
                                <button type="button" id="save-api-btn" class="btn btn-primary">
                                    <i class="ti ti-check"></i>
                                    ${this.__('integrations.hanshow.buttons.save')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- API Documentation Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-book"></i>
                                ${this.__('integrations.types.api.docs.title')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.types.api.docs.subtitle')}</p>

                            <div class="integration-info-list">
                                <div class="integration-info-box">
                                    <h4>Base URL</h4>
                                    <code class="text-sm">${escapeHTML(window.location.origin)}${escapeHTML(window.OmnexConfig?.basePath || '')}/api</code>
                                </div>

                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.types.api.docs.auth')}</h4>
                                    <code class="text-sm" data-import-api-key-template="Authorization: Bearer __API_KEY__">Authorization: Bearer YOUR_API_KEY_HERE</code>
                                </div>

                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.types.api.docs.exampleRequest')}</h4>
                                    <pre class="text-sm overflow-x-auto"><code data-import-api-key-template="curl -X GET &quot;${escapeHTML(window.location.origin)}${escapeHTML(window.OmnexConfig?.basePath || '')}/api/products&quot; \\
  -H &quot;Authorization: Bearer __API_KEY__&quot; \\
  -H &quot;Content-Type: application/json&quot;">curl -X GET "${escapeHTML(window.location.origin)}${escapeHTML(window.OmnexConfig?.basePath || '')}/api/products" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json"</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${this.renderImportTab()}

            ${this.renderPriceviewTab()}

            ${this.renderMqttTab()}

            ${this.isSuperAdmin ? this.renderPaymentTab() : ''}
        `;
    }

    getHalSifatOptions() {
        return [
            { value: 0, label: this.__('integrations.hal.sifatOptions.select') },
            { value: 1, label: this.__('integrations.hal.sifatOptions.sanayici') },
            { value: 2, label: this.__('integrations.hal.sifatOptions.ihracat') },
            { value: 3, label: this.__('integrations.hal.sifatOptions.ithalat') },
            { value: 4, label: this.__('integrations.hal.sifatOptions.uretici') },
            { value: 5, label: this.__('integrations.hal.sifatOptions.komisyoncu') },
            { value: 6, label: this.__('integrations.hal.sifatOptions.tuccarHalIci') },
            { value: 7, label: this.__('integrations.hal.sifatOptions.market') },
            { value: 8, label: this.__('integrations.hal.sifatOptions.manav') },
            { value: 9, label: this.__('integrations.hal.sifatOptions.depoTasnif') },
            { value: 10, label: this.__('integrations.hal.sifatOptions.ureticiOrgutu') },
            { value: 11, label: this.__('integrations.hal.sifatOptions.pazarci') },
            { value: 12, label: this.__('integrations.hal.sifatOptions.otel') },
            { value: 13, label: this.__('integrations.hal.sifatOptions.lokanta') },
            { value: 14, label: this.__('integrations.hal.sifatOptions.yurt') },
            { value: 15, label: this.__('integrations.hal.sifatOptions.yemekFabrikasi') },
            { value: 19, label: this.__('integrations.hal.sifatOptions.hastane') },
            { value: 20, label: this.__('integrations.hal.sifatOptions.tuccarHalDisi') }
        ];
    }

    async init() {
        this.bindEvents();
        await this.loadHanshowSettings();
        await this.loadHalSettings();
        await this.loadTamsoftSettings();
        await this.loadIntegrationSettings(); // Load ERP/POS/WMS/API settings
        this.generateApiKeyIfNeeded();
        this.refreshImportApiDocumentation();
        await this.loadMqttSettings();
        await this.loadPriceviewSettings();
        await this.loadImportSettings();

        // Load payment settings if SuperAdmin
        if (this.isSuperAdmin) {
            await this.loadPaymentSettings();
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Hanshow events
        document.getElementById('test-hanshow-btn')?.addEventListener('click', () => {
            this.testHanshowConnection();
        });

        document.getElementById('save-hanshow-btn')?.addEventListener('click', () => {
            this.saveHanshowSettings();
        });

        // HAL events
        document.getElementById('test-hal-btn')?.addEventListener('click', () => {
            this.testHalConnection();
        });

        document.getElementById('save-hal-btn')?.addEventListener('click', () => {
            this.saveHalSettings();
        });

        // TAMSOFT events
        document.getElementById('test-tamsoft-btn')?.addEventListener('click', () => {
            this.testTamsoftConnection();
        });

        document.getElementById('load-tamsoft-depolar-btn')?.addEventListener('click', () => {
            this.loadTamsoftDepolar();
        });

        document.getElementById('save-tamsoft-btn')?.addEventListener('click', () => {
            this.saveTamsoftSettings();
        });

        document.getElementById('sync-tamsoft-btn')?.addEventListener('click', () => {
            this.syncTamsoft();
        });

        document.getElementById('debug-tamsoft-btn')?.addEventListener('click', () => {
            this.debugTamsoftStok();
        });

        // API events
        document.getElementById('copy-api-key-btn')?.addEventListener('click', () => {
            this.copyApiKey();
        });

        document.getElementById('regenerate-api-key-btn')?.addEventListener('click', () => {
            this.regenerateApiKey();
        });

        document.getElementById('save-api-btn')?.addEventListener('click', () => {
            this.saveIntegration('api');
        });

        // Import events
        document.getElementById('save-import-btn')?.addEventListener('click', () => {
            this.saveImportSettings();
        });

        document.getElementById('test-import-btn')?.addEventListener('click', () => {
            this.showTestImportModal();
        });

        document.getElementById('configure-mappings-btn')?.addEventListener('click', () => {
            this.showConfigureMappingsModal();
        });

        document.getElementById('refresh-import-history-btn')?.addEventListener('click', () => {
            this.loadImportHistory(1, this.importHistoryPagination.per_page || 10);
        });

        document.getElementById('refresh-import-files-btn')?.addEventListener('click', () => {
            this.loadImportFiles(1, this.importFilesPagination.per_page || 10);
        });

        // Upload zone toggle
        document.getElementById('import-upload-btn')?.addEventListener('click', () => {
            this.toggleImportUploadZone();
        });

        // File input change
        document.getElementById('import-file-input')?.addEventListener('change', (e) => {
            if (e.target.files?.length) {
                this.handleImportFileUpload(e.target.files);
            }
        });

        // Select files button
        document.getElementById('import-select-files-btn')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });

        // Drag & drop
        this.bindImportDropZoneEvents();

        document.getElementById('clear-import-history-btn')?.addEventListener('click', () => {
            this.clearImportHistory();
        });

        // Auto import toggle
        document.getElementById('import-auto-enabled')?.addEventListener('change', (e) => {
            const intervalGroup = document.getElementById('import-interval-group');
            if (intervalGroup) {
                intervalGroup.style.display = e.target.checked ? '' : 'none';
            }
        });

        // PriceView events
        document.getElementById('save-priceview-btn')?.addEventListener('click', () => {
            this.savePriceviewSettings();
        });

        document.getElementById('sync-priceview-btn')?.addEventListener('click', () => {
            this.syncPriceviewNow();
        });

        // MQTT events
        document.getElementById('test-mqtt-btn')?.addEventListener('click', () => {
            this.testMqttConnection();
        });

        document.getElementById('save-mqtt-btn')?.addEventListener('click', () => {
            this.saveMqttSettings();
        });

        // Toggle MQTT TLS
        document.getElementById('mqtt-use-tls')?.addEventListener('change', (e) => {
            const portInput = document.getElementById('mqtt-broker-port');
            if (portInput) {
                portInput.value = e.target.checked ? '8883' : '1883';
            }
        });

        // Payment events (SuperAdmin only)
        if (this.isSuperAdmin) {
            // Provider selection
            document.querySelectorAll('input[name="payment_provider"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.switchPaymentProvider(e.target.value);
                });
            });

            // Provider card clicks
            document.querySelectorAll('.provider-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('input')) return; // Don't double-trigger from radio
                    const radio = card.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        this.switchPaymentProvider(radio.value);
                    }
                });
            });

            document.getElementById('test-payment-btn')?.addEventListener('click', () => {
                this.testPaymentConnection();
            });

            document.getElementById('save-payment-btn')?.addEventListener('click', () => {
                this.savePaymentSettings();
            });

            // Toggle secret key visibility for both providers
            document.querySelectorAll('.toggle-secret-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetId = e.currentTarget.dataset.target;
                    this.toggleSecretKeyVisibility(targetId);
                });
            });

            // License plan management
            document.getElementById('add-license-plan-btn')?.addEventListener('click', () => {
                this.showCreatePlanModal();
            });
        }
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }

    async loadHanshowSettings() {
        try {
            const response = await this.app.api.get('/hanshow/settings');
            if (response.success && response.data) {
                this.hanshowSettings = response.data.settings || {};
                this.hanshowConnection = response.data.connection || {};
                this.populateHanshowForm();
                this.updateHanshowStatus();
            }
        } catch (error) {
            Logger.warn('Hanshow settings not available:', error);
            this.updateHanshowConnectionStatus(false, this.__('integrations.debug.apiNoResponse'));
        }
    }

    populateHanshowForm() {
        const s = this.hanshowSettings;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = value;
        };

        setValue('hanshow_eslworking_url', s.eslworking_url || 'http://127.0.0.1:9000');
        setValue('hanshow_user_id', s.user_id || 'default');
        setValue('hanshow_callback_url', s.callback_url);
        setValue('hanshow_default_priority', s.default_priority || 10);
        setValue('hanshow_sync_interval', s.sync_interval || 60);
        setValue('hanshow_led_color', s.led_color || 'green');
        setValue('hanshow_max_retry_attempts', s.max_retry_attempts || 3);

        setChecked('hanshow_led_flash_on_update', s.led_flash_on_update);
        setChecked('hanshow_auto_retry', s.auto_retry);
        setChecked('hanshow_enabled', s.enabled);
    }

    updateHanshowStatus() {
        const badge = document.getElementById('hanshow-status-badge');
        if (badge) {
            if (this.hanshowSettings.enabled) {
                badge.className = 'badge badge-success';
                badge.textContent = 'Aktif';
            } else {
                badge.className = 'badge badge-secondary';
                badge.textContent = 'Pasif';
            }
        }

        this.updateHanshowConnectionStatus(
            this.hanshowConnection.online,
            this.hanshowConnection.error,
            this.hanshowConnection.response_time,
            this.hanshowConnection.ap_list
        );
    }

    updateHanshowConnectionStatus(online, error = null, responseTime = null, apList = null) {
        const statusEl = document.getElementById('hanshow-connection-status');
        if (!statusEl) return;

        if (online) {
            // Count online APs
            let onlineAPs = [];
            if (apList) {
                for (const gen in apList) {
                    if (Array.isArray(apList[gen])) {
                        apList[gen].forEach(ap => {
                            if (ap.online) {
                                onlineAPs.push(ap);
                            }
                        });
                    }
                }
            }

            let apListHtml = '';
            if (onlineAPs.length > 0) {
                apListHtml = `
                    <div class="hanshow-gateways">
                        <div class="hanshow-gateways-header">
                            <i class="ti ti-router"></i>
                            <span>${this.__('integrations.hanshow.connection.connectedGateways', { count: onlineAPs.length })}</span>
                        </div>
                        <div class="hanshow-gateway-list">
                            ${onlineAPs.map(ap => `
                                <div class="hanshow-gateway-item">
                                    <div class="hanshow-gateway-main">
                                        <span class="hanshow-gateway-status"></span>
                                        <span class="hanshow-gateway-mac">${escapeHTML(ap.mac || 'N/A')}</span>
                                    </div>
                                    <div class="hanshow-gateway-details">
                                        <div class="hanshow-gateway-detail">
                                            <i class="ti ti-network"></i>
                                            <span>${escapeHTML(ap.ip)}:${escapeHTML(String(ap.port))}</span>
                                        </div>
                                        <div class="hanshow-gateway-detail">
                                            <i class="ti ti-tag"></i>
                                            <span>v${escapeHTML(ap.version)}</span>
                                        </div>
                                        <div class="hanshow-gateway-detail">
                                            <i class="ti ti-activity"></i>
                                            <span>${escapeHTML(ap.work_mode || 'standby')}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            statusEl.className = 'hanshow-connection-box hanshow-connection-online';
            statusEl.innerHTML = `
                <div class="hanshow-connection-header">
                    <div class="hanshow-connection-icon success">
                        <i class="ti ti-circle-check"></i>
                    </div>
                    <div class="hanshow-connection-info">
                        <div class="hanshow-connection-title">${this.__('integrations.hanshow.connection.online')}</div>
                        <div class="hanshow-connection-subtitle">${this.__('integrations.hanshow.connection.responseTime', { time: responseTime || '-' })}</div>
                    </div>
                </div>
                ${apListHtml}
            `;
        } else {
            statusEl.className = 'hanshow-connection-box hanshow-connection-offline';
            statusEl.innerHTML = `
                <div class="hanshow-connection-header">
                    <div class="hanshow-connection-icon warning">
                        <i class="ti ti-alert-triangle"></i>
                    </div>
                    <div class="hanshow-connection-info">
                        <div class="hanshow-connection-title">${this.__('integrations.hanshow.connection.offline')}</div>
                        ${error ? `<div class="hanshow-connection-subtitle">${escapeHTML(error)}</div>` : ''}
                    </div>
                </div>
                <div class="hanshow-connection-help">
                    <div class="hanshow-help-title">
                        <i class="ti ti-terminal"></i>
                        ${this.__('integrations.hanshow.connection.startCommand')}
                    </div>
                    <code class="hanshow-help-code">cd eslworking-2.5.3/bin && eslworking.bat</code>
                </div>
            `;
        }
    }

    async testHanshowConnection() {
        const btn = document.getElementById('test-hanshow-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Test ediliyor...';
        }

        try {
            const response = await this.app.api.get('/hanshow/ping');
            if (response.success && response.data?.online) {
                const apCount = response.data.connected_aps || 0;
                Toast.success(this.__('integrations.hanshow.connectionSuccess', { time: response.data.response_time, count: apCount }));
                this.updateHanshowConnectionStatus(true, null, response.data.response_time, response.data.ap_list);
            } else {
                Toast.error(this.__('integrations.hanshow.connectionFailed', { error: response.data?.error || this.__('messages.unknownError') }));
                this.updateHanshowConnectionStatus(false, response.data?.error);
            }
        } catch (error) {
            Toast.error(this.__('integrations.hanshow.testFailed', { error: error.message }));
            this.updateHanshowConnectionStatus(false, error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('integrations.hanshow.testConnection')}`;
            }
        }
    }

    async saveHanshowSettings() {
        const getValue = (id) => document.getElementById(id)?.value;
        const getChecked = (id) => document.getElementById(id)?.checked;

        const data = {
            eslworking_url: getValue('hanshow_eslworking_url') || 'http://127.0.0.1:9000',
            user_id: getValue('hanshow_user_id') || 'default',
            callback_url: getValue('hanshow_callback_url') || '',
            default_priority: parseInt(getValue('hanshow_default_priority')) || 10,
            sync_interval: parseInt(getValue('hanshow_sync_interval')) || 60,
            led_color: getValue('hanshow_led_color') || 'green',
            max_retry_attempts: parseInt(getValue('hanshow_max_retry_attempts')) || 3,
            led_flash_on_update: getChecked('hanshow_led_flash_on_update') ?? true,
            auto_retry: getChecked('hanshow_auto_retry') ?? true,
            enabled: getChecked('hanshow_enabled') ?? false
        };

        const btn = document.getElementById('save-hanshow-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            const response = await this.app.api.put('/hanshow/settings', data);
            if (response.success) {
                Toast.success(this.__('integrations.hanshow.saveSuccess'));
                this.hanshowSettings = data;
                this.hanshowConnection = response.data?.connection || {};
                this.updateHanshowStatus();
            } else {
                throw new Error(response.message || this.__('messages.saveFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.hanshow.saveFailed', { error: error.message }));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('actions.save')}`;
            }
        }
    }

    // =========================================
    // HAL Kayıt Sistemi Methods
    // =========================================

    async loadHalSettings() {
        try {
            const response = await this.app.api.get('/hal/settings');
            if (response.success && response.data) {
                this.halSettings = response.data.settings || {};
                this.populateHalForm();
                this.updateHalStatus();
            }
        } catch (error) {
            Logger.warn('HAL settings not available:', error);
            this.updateHalConnectionStatus(false, this.__('integrations.debug.apiNoResponse'));
        }
    }

    populateHalForm() {
        const s = this.halSettings;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = value;
        };

        setValue('hal_username', s.username);
        setValue('hal_password', s.password);
        setValue('hal_service_password', s.service_password);
        setValue('hal_tc_vergi_no', s.tc_vergi_no);
        setValue('hal_sifat_id', s.sifat_id ?? 0);
        setValue('hal_sifat2_id', s.sifat2_id ?? 0);
        setChecked('hal_enabled', s.enabled);
    }

    updateHalStatus() {
        const badge = document.getElementById('hal-status-badge');
        if (badge) {
            const configured = this.halSettings.username && this.halSettings.password_set;
            if (this.halSettings.enabled && configured) {
                badge.className = 'badge badge-success';
                badge.textContent = this.__('integrations.pavoDisplay.active');
            } else if (configured) {
                badge.className = 'badge badge-warning';
                badge.textContent = this.__('integrations.hal.configured');
            } else {
                badge.className = 'badge badge-secondary';
                badge.textContent = this.__('integrations.hanshow.inactive');
            }
        }

        // Update connection status based on configuration
        const configured = this.halSettings.username && this.halSettings.password_set;
        if (configured) {
            this.updateHalConnectionStatus(true, null, null);
        } else {
            this.updateHalConnectionStatus(false, this.__('integrations.hal.credentialsRequired'));
        }
    }

    updateHalConnectionStatus(configured, error = null, responseTime = null) {
        const statusEl = document.getElementById('hal-connection-status');
        if (!statusEl) return;

        if (configured && !error) {
            statusEl.className = 'alert alert-success mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-circle-check"></i>
                    <div>
                        <div class="font-medium">${this.__('integrations.hal.connectionConfigured')}</div>
                        ${responseTime ? `<div class="text-sm opacity-75">${this.__('integrations.hal.responseTime')}: ${escapeHTML(String(responseTime))}ms</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            statusEl.className = 'alert alert-warning mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-alert-triangle"></i>
                    <div>
                        <div class="font-medium">${this.__('integrations.hal.connectionNotConfigured')}</div>
                        ${error ? `<div class="text-sm opacity-75">${escapeHTML(error)}</div>` : `<div class="text-sm opacity-75">${this.__('integrations.hal.enterCredentials')}</div>`}
                    </div>
                </div>
            `;
        }
    }

    async testHalConnection() {
        const btn = document.getElementById('test-hal-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.hal.buttons.testing')}`;
        }

        try {
            const response = await this.app.api.get('/hal/test');
            if (response.success && response.data?.success) {
                Toast.success(this.__('integrations.hal.toast.connectionSuccess'));
                this.updateHalConnectionStatus(true, null, response.data.response_time);
            } else {
                // Translate error code if available
                const errorCode = response.data?.error_code;
                const errorDetail = response.data?.error_detail || '';
                const halErrorCode = response.data?.hal_error_code || '';
                let errorMsg;

                if (errorCode) {
                    // Try to get i18n translation for error code
                    const translationKey = `integrations.hal.errors.${errorCode}`;
                    errorMsg = this.__(translationKey, {
                        detail: errorDetail,
                        code: halErrorCode
                    });
                    // If translation key returns the same (not found), use raw error
                    if (errorMsg === translationKey) {
                        errorMsg = response.data?.error || response.message || this.__('integrations.hal.toast.connectionFailed');
                    }
                } else {
                    errorMsg = response.data?.error || response.message || this.__('integrations.hal.toast.connectionFailed');
                }

                Toast.error(errorMsg);
                this.updateHalConnectionStatus(false, errorMsg);
            }
        } catch (error) {
            const errorMsg = error.message || this.__('integrations.hal.toast.connectionFailed');
            Toast.error(this.__('integrations.hal.toast.connectionFailed') + ': ' + errorMsg);
            this.updateHalConnectionStatus(false, errorMsg);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('integrations.hal.buttons.testConnection')}`;
            }
        }
    }

    async saveHalSettings() {
        const getValue = (id) => document.getElementById(id)?.value;
        const getChecked = (id) => document.getElementById(id)?.checked;

        const data = {
            username: getValue('hal_username') || '',
            password: getValue('hal_password') || '',
            service_password: getValue('hal_service_password') || '',
            tc_vergi_no: getValue('hal_tc_vergi_no') || '',
            sifat_id: parseInt(getValue('hal_sifat_id') || '0', 10),
            sifat2_id: parseInt(getValue('hal_sifat2_id') || '0', 10),
            enabled: getChecked('hal_enabled') ?? false
        };

        const btn = document.getElementById('save-hal-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Kaydediliyor...';
        }

        try {
            const response = await this.app.api.put('/hal/settings', data);
            if (response.success) {
                Toast.success(this.__('integrations.hal.toast.saved'));
                // Update local settings (mask passwords like API does)
                this.halSettings = {
                    ...data,
                    password: data.password !== '' && data.password !== '********' ? '********' : this.halSettings.password,
                    service_password: data.service_password !== '' && data.service_password !== '********' ? '********' : this.halSettings.service_password,
                    password_set: !!data.password || this.halSettings.password_set,
                    service_password_set: !!data.service_password || this.halSettings.service_password_set
                };
                this.updateHalStatus();
                // HAL visibility affects sidebar menu - update menu without full page reload
                if (this.app.layout) {
                    const nav = document.getElementById('sidebar-nav');
                    if (nav) {
                        nav.innerHTML = this.app.layout.renderMenu();
                    }
                }
            } else {
                throw new Error(response.message || this.__('integrations.hal.toast.saveFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.hal.toast.saveFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('integrations.hanshow.buttons.save')}`;
            }
        }
    }

    async saveIntegration(type) {
        const validTypes = ['api'];
        if (!validTypes.includes(type)) {
            Toast.error(this.__('integrations.messages.invalidIntegrationType'));
            return;
        }

        const btn = document.getElementById(`save-${type}-btn`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader-2 ti-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            // Collect form data based on type
            const data = this.collectIntegrationData(type);
            data.type = type;

            // Save via API
            const response = await this.app.api.put('/integrations/settings', data);

            if (response.success) {
                Toast.success(`${type.toUpperCase()} ${this.__('integrations.messages.settingsSaved')}`);
            } else {
                Toast.error(response.message || this.__('integrations.messages.settingsSaveError'));
            }
        } catch (error) {
            console.error(`Error saving ${type} settings:`, error);
            Toast.error(error.message || this.__('integrations.messages.settingsSaveError'));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('actions.save')}`;
            }
        }
    }

    collectIntegrationData(type) {
        const data = {};

        switch (type) {
            case 'api':
                const apiKey = document.getElementById('api_key')?.value || '';
                if (apiKey && apiKey !== '********') {
                    data.api_key = apiKey;
                }
                data.rate_limit = parseInt(document.getElementById('api_rate_limit')?.value) || 60;
                data.webhook_url = document.getElementById('api_webhook_url')?.value || '';
                data.enabled = document.getElementById('api_enabled')?.checked ?? true;
                break;
        }

        return data;
    }

    async loadIntegrationSettings() {
        try {
            const response = await this.app.api.get('/integrations/settings');

            if (response.success && response.data) {
                // Load all integration types
                for (const type of ['api']) {
                    if (response.data[type]?.settings) {
                        this.populateIntegrationForm(type, response.data[type].settings, response.data[type].meta);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading integration settings:', error);
        }
    }

    populateIntegrationForm(type, settings, meta = {}) {
        switch (type) {
            case 'api':
                if (document.getElementById('api_key')) {
                    if (settings.api_key && settings.api_key !== '********') {
                        document.getElementById('api_key').value = settings.api_key;
                    } else if (settings.api_key_set) {
                        document.getElementById('api_key').value = '********';
                    }
                }
                if (document.getElementById('api_rate_limit')) {
                    document.getElementById('api_rate_limit').value = settings.rate_limit || 60;
                }
                if (document.getElementById('api_webhook_url')) {
                    document.getElementById('api_webhook_url').value = settings.webhook_url || '';
                }
                this.refreshImportApiDocumentation();
                break;
        }

        // Update meta info badge if exists
        const badge = document.getElementById(`${type}-source-badge`);
        if (badge && meta.source) {
            badge.textContent = meta.is_override ? this.__('integrations.companyOverride') : this.__('integrations.systemDefault');
            badge.className = `badge ${meta.is_override ? 'badge-primary' : 'badge-secondary'}`;
        }
    }

    generateApiKeyIfNeeded() {
        const apiKeyInput = document.getElementById('api_key');
        if (apiKeyInput && !apiKeyInput.value) {
            apiKeyInput.value = this.generateApiKey();
        }
        this.refreshImportApiDocumentation();
    }

    getImportApiDocKey() {
        const apiKeyInput = document.getElementById('api_key');
        const key = (apiKeyInput?.value || '').trim();
        if (!key || key === '********') {
            return 'YOUR_API_KEY_HERE';
        }
        return key;
    }

    refreshImportApiDocumentation() {
        const key = this.getImportApiDocKey();
        document.querySelectorAll('[data-import-api-key-template]').forEach((el) => {
            const template = el.getAttribute('data-import-api-key-template') || '';
            el.textContent = template.split('__API_KEY__').join(key);
        });
    }

    generateApiKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = 'omnex_';
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }

    copyApiKey() {
        const apiKeyInput = document.getElementById('api_key');
        if (apiKeyInput && apiKeyInput.value) {
            navigator.clipboard.writeText(apiKeyInput.value);
            Toast.success(this.__('integrations.messages.apiKeyCopied'));
        }
    }

    regenerateApiKey() {
        const apiKeyInput = document.getElementById('api_key');
        if (apiKeyInput) {
            apiKeyInput.value = this.generateApiKey();
            this.refreshImportApiDocumentation();
            Toast.info(this.__('integrations.messages.apiKeyGenerated'));
        }
    }

    // =========================================
    // TAMSOFT ERP Methods
    // =========================================

    async loadTamsoftSettings() {
        try {
            const response = await this.app.api.get('/tamsoft/settings');
            if (response.success && response.data) {
                this.tamsoftSettings = response.data;
                this.populateTamsoftForm();
                this.updateTamsoftStatus();

                // Show last sync info if available
                if (this.tamsoftSettings.last_sync_date) {
                    const lastSyncEl = document.getElementById('tamsoft-last-sync');
                    const lastSyncDateEl = document.getElementById('tamsoft-last-sync-date');
                    if (lastSyncEl && lastSyncDateEl) {
                        lastSyncEl.style.display = 'block';
                        lastSyncDateEl.textContent = new Date(this.tamsoftSettings.last_sync_date).toLocaleString();
                    }
                }
            }
        } catch (error) {
            Logger.error('TAMSOFT settings load error:', error);
            this.updateTamsoftConnectionStatus(false, error.message);
        }
    }

    populateTamsoftForm() {
        const s = this.tamsoftSettings;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!value;
        };

        setValue('tamsoft_api_url', s.api_url || 'http://tamsoftintegration.camlica.com.tr');
        setValue('tamsoft_username', s.username);
        setValue('tamsoft_password', s.password_set ? '********' : '');
        setValue('tamsoft_sync_interval', s.sync_interval || 30);

        setChecked('tamsoft_enabled', s.enabled);
        setChecked('tamsoft_auto_sync_enabled', s.auto_sync_enabled);
        setChecked('tamsoft_only_stock_positive', s.only_stock_positive);
        setChecked('tamsoft_only_ecommerce', s.only_ecommerce);
        setChecked('tamsoft_single_barcode', s.single_barcode ?? true);

        // Set default depo if we have depolar loaded
        if (s.default_depo_id && this.tamsoftDepolar.length > 0) {
            setValue('tamsoft_default_depo_id', s.default_depo_id);
        }
    }

    updateTamsoftStatus() {
        const badge = document.getElementById('tamsoft-status-badge');
        if (!badge) return;

        if (this.tamsoftSettings.enabled) {
            badge.className = 'badge badge-success';
            badge.textContent = this.__('integrations.hanshow.active');
        } else {
            badge.className = 'badge badge-secondary';
            badge.textContent = this.__('integrations.hanshow.inactive');
        }
    }

    updateTamsoftConnectionStatus(connected, error = null, responseTime = null) {
        const statusEl = document.getElementById('tamsoft-connection-status');
        if (!statusEl) return;

        if (connected) {
            statusEl.className = 'alert alert-success mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-circle-check"></i>
                    <span>${this.__('integrations.tamsoft.connectionSuccess')}</span>
                    ${responseTime ? `<span class="text-muted text-sm">(${responseTime}ms)</span>` : ''}
                </div>
            `;
        } else {
            statusEl.className = 'alert alert-danger mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-alert-circle"></i>
                    <span>${error || this.__('integrations.tamsoft.connectionFailed')}</span>
                </div>
            `;
        }
    }

    async testTamsoftConnection() {
        const btn = document.getElementById('test-tamsoft-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.hanshow.buttons.testing')}`;
        }

        try {
            const response = await this.app.api.get('/tamsoft/test');
            if (response.success && response.data?.connected) {
                Toast.success(this.__('integrations.tamsoft.toast.connectionSuccess'));
                this.updateTamsoftConnectionStatus(true, null, response.data.response_time);
            } else {
                const errorMsg = response.data?.error || response.message || this.__('integrations.tamsoft.toast.connectionFailed');
                Toast.error(errorMsg);
                this.updateTamsoftConnectionStatus(false, errorMsg);
            }
        } catch (error) {
            const errorMsg = error.message || this.__('integrations.tamsoft.toast.connectionFailed');
            Toast.error(this.__('integrations.tamsoft.toast.connectionFailed') + ': ' + errorMsg);
            this.updateTamsoftConnectionStatus(false, errorMsg);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('integrations.hanshow.buttons.testConnection')}`;
            }
        }
    }

    async loadTamsoftDepolar() {
        const btn = document.getElementById('load-tamsoft-depolar-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.debug.loading')}`;
        }

        try {
            const response = await this.app.api.get('/tamsoft/depolar');
            if (response.success && response.data?.depolar) {
                this.tamsoftDepolar = response.data.depolar;
                this.populateTamsoftDepoSelect();

                // D1: Branch mapping results
                const mapping = response.data.branch_mapping;
                if (mapping) {
                    const parts = [];
                    if (mapping.created > 0) parts.push(this.__('integrations.depotMapping.newBranches', { count: mapping.created }));
                    if (mapping.existing > 0) parts.push(this.__('integrations.depotMapping.existingMappings', { count: mapping.existing }));
                    if (parts.length > 0) {
                        Toast.success(this.__('integrations.depotMapping.mapped', { count: mapping.mapped || 0, details: parts.join(', ') }));
                    }
                }

                // Show depot selection modal
                this._showDepoSelectionModal();
            } else {
                Toast.error(response.message || this.__('integrations.tamsoft.toast.depoLoadFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.tamsoft.toast.depoLoadFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-building-warehouse"></i> ${this.__('integrations.tamsoft.buttons.loadDepolar')}`;
            }
        }
    }

    _showDepoSelectionModal() {
        const defaultDepoId = parseInt(document.getElementById('tamsoft_default_depo_id')?.value) || 0;

        const depoOptions = this.tamsoftDepolar.map(depo => {
            const depoId = depo.Depoid ?? depo.ID ?? depo.DepoID;
            const depoName = depo.Adi || depo.DepoAdi || depo.DepoAd || 'Depo ' + depoId;
            const selected = depoId == defaultDepoId ? 'selected' : '';
            return `<option value="${depoId}" ${selected}>${depoName}</option>`;
        }).join('');

        const modalContent = `
            <div style="padding: 0.5rem 0;">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label class="form-label" style="font-weight: 600; margin-bottom: 0.5rem;">
                        <i class="ti ti-building-warehouse" style="margin-right: 0.25rem;"></i>
                        ${this.__('integrations.tamsoft.fields.defaultDepo')}
                    </label>
                    <select id="sync-depo-select" class="form-select" style="width: 100%;">
                        <option value="all">${this.__('integrations.tamsoft.sync.allDepots')}</option>
                        ${depoOptions}
                    </select>
                    <small class="form-hint" style="color: var(--text-tertiary); margin-top: 0.25rem; display: block;">
                        ${this.__('integrations.tamsoft.sync.depoHint')}
                    </small>
                </div>

                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem; margin-top: 0.5rem;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <i class="ti ti-info-circle" style="color: var(--color-primary);"></i>
                        ${this.__('integrations.tamsoft.sync.infoTitle')}
                    </div>
                    <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6;">
                        <li>${this.__('integrations.tamsoft.sync.infoNew')}</li>
                        <li>${this.__('integrations.tamsoft.sync.infoUpdate')}</li>
                        <li>${this.__('integrations.tamsoft.sync.infoSafe')}</li>
                        <li>${this.__('integrations.tamsoft.sync.infoAllDepots')}</li>
                    </ul>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('integrations.tamsoft.sync.title'),
            icon: 'ti-building-warehouse',
            content: modalContent,
            size: 'sm',
            confirmText: this.__('integrations.tamsoft.sync.selectAndSave'),
            cancelText: this.__('actions.cancel'),
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                const selectedValue = document.getElementById('sync-depo-select')?.value;
                // Update dropdown (save as 0 if all)
                const mainSelect = document.getElementById('tamsoft_default_depo_id');
                if (mainSelect && selectedValue !== 'all') {
                    mainSelect.value = selectedValue;
                }
                Toast.success(`${this.tamsoftDepolar.length} ${this.__('integrations.tamsoft.toast.depoLoaded')}`);
            }
        });
    }

    populateTamsoftDepoSelect() {
        const select = document.getElementById('tamsoft_default_depo_id');
        if (!select || this.tamsoftDepolar.length === 0) return;

        const currentValue = select.value;
        const savedDefault = this.tamsoftSettings?.default_depo_id;

        // "All Depots" option + individual depots
        const allOption = `<option value="all">${this.__('integrations.tamsoft.sync.allDepots')}</option>`;
        const depoOptions = this.tamsoftDepolar.map(depo => {
            const id = depo.Depoid ?? depo.ID ?? depo.DepoID;
            return `<option value="${id}">${depo.Adi || depo.DepoAdi || depo.DepoAd || 'Depo ' + id}</option>`;
        }).join('');

        select.innerHTML = allOption + depoOptions;

        // Priority: 1) Current selection, 2) Saved default, 3) First depot
        const hasMatch = (val) => val === 'all' || (val && this.tamsoftDepolar.some(d => (d.Depoid ?? d.ID ?? d.DepoID) == val));

        if (hasMatch(currentValue)) {
            select.value = currentValue;
        } else if (hasMatch(savedDefault)) {
            select.value = savedDefault;
        } else {
            // If none match, select first depot
            const firstId = this.tamsoftDepolar[0]?.Depoid ?? this.tamsoftDepolar[0]?.ID ?? this.tamsoftDepolar[0]?.DepoID;
            if (firstId !== undefined) {
                select.value = firstId;
            }
        }
    }

    async saveTamsoftSettings() {
        const getValue = (id) => document.getElementById(id)?.value;
        const getChecked = (id) => document.getElementById(id)?.checked;

        const data = {
            api_url: getValue('tamsoft_api_url') || 'http://tamsoftintegration.camlica.com.tr',
            username: getValue('tamsoft_username') || '',
            password: getValue('tamsoft_password') || '',
            default_depo_id: parseInt(getValue('tamsoft_default_depo_id')) || 1,
            sync_interval: parseInt(getValue('tamsoft_sync_interval')) || 30,
            enabled: getChecked('tamsoft_enabled') ?? false,
            auto_sync_enabled: getChecked('tamsoft_auto_sync_enabled') ?? false,
            only_stock_positive: getChecked('tamsoft_only_stock_positive') ?? false,
            only_ecommerce: getChecked('tamsoft_only_ecommerce') ?? false,
            single_barcode: getChecked('tamsoft_single_barcode') ?? true
        };

        const btn = document.getElementById('save-tamsoft-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            const response = await this.app.api.put('/tamsoft/settings', data);
            if (response.success) {
                Toast.success(this.__('integrations.tamsoft.toast.saved'));
                this.tamsoftSettings = response.data;
                this.updateTamsoftStatus();
            } else {
                throw new Error(response.message || this.__('integrations.tamsoft.toast.saveFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.tamsoft.toast.saveFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('integrations.hanshow.buttons.save')}`;
            }
        }
    }

    async syncTamsoft() {
        // Get selected depot value
        const selectValue = document.getElementById('tamsoft_default_depo_id')?.value;
        const isAllDepots = selectValue === 'all';

        let depoId = 0;
        if (!isAllDepots) {
            depoId = parseInt(selectValue) || 0;

            // If not found in dropdown, use first loaded depot
            if (depoId === 0 && this.tamsoftDepolar.length > 0) {
                depoId = this.tamsoftDepolar[0]?.Depoid ?? this.tamsoftDepolar[0]?.ID ?? this.tamsoftDepolar[0]?.DepoID ?? 0;
            }
        }

        // Show warning if not all depots and no depot selected
        if (!isAllDepots && !depoId) {
            Toast.warning(this.__('integrations.tamsoft.sync.noDepoWarning'));
            return;
        }

        // Full sync checkbox state
        const fullSync = document.getElementById('tamsoft-full-sync')?.checked || false;

        // Start synchronization
        await this._executeTamsoftSync(depoId, isAllDepots, fullSync);
    }

    async _executeTamsoftSync(depoId, allDepots = false, fullSync = false) {
        const btn = document.getElementById('sync-tamsoft-btn');
        if (btn) {
            btn.disabled = true;
            const syncingText = allDepots
                ? this.__('integrations.tamsoft.sync.syncingAll')
                : this.__('integrations.tamsoft.sync.syncing');
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${syncingText}`;
        }

        try {
            const payload = allDepots
                ? { all_depots: true, full_sync: fullSync }
                : { depo_id: depoId, full_sync: fullSync };

            const response = await this.app.api.post('/tamsoft/sync', payload);
            if (response.success) {
                const summary = response.data?.summary || {};

                // D2: Render jobs info
                const renderInfo = summary.render_jobs_created ? `, ${summary.render_jobs_created} render` : '';

                // Detailed toast for all depots mode
                if (allDepots && summary.depo_count) {
                    Toast.success(this.__('integrations.tamsoft.toast.syncAllSuccess', {
                        depo_count: summary.depo_count,
                        inserted: summary.inserted || 0,
                        updated: summary.updated || 0,
                        failed: summary.failed || 0
                    }));
                } else {
                    Toast.success(this.__('integrations.tamsoft.toast.syncSuccess', {
                        inserted: summary.inserted || 0,
                        updated: summary.updated || 0,
                        failed: summary.failed || 0
                    }));
                }

                // Update last sync date
                const lastSyncEl = document.getElementById('tamsoft-last-sync');
                const lastSyncDateEl = document.getElementById('tamsoft-last-sync-date');
                if (lastSyncEl && lastSyncDateEl) {
                    lastSyncEl.style.display = 'block';
                    lastSyncDateEl.textContent = new Date().toLocaleString();
                }
            } else {
                throw new Error(response.message || this.__('integrations.tamsoft.toast.syncFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.tamsoft.toast.syncFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-refresh"></i> ${this.__('integrations.tamsoft.buttons.syncNow')}`;
            }
        }
    }

    /**
     * TAMSOFT Debug - StokListesi API yanıtını analiz et
     */
    async debugTamsoftStok() {
        const btn = document.getElementById('debug-tamsoft-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${this.__('integrations.debug.loading')}`;
        }

        try {
            // Get selected depot ID
            const depoSelect = document.getElementById('tamsoft-default-depo');
            const depoId = depoSelect?.value || 1;

            const response = await this.app.api.get(`/tamsoft/debug-stok?depoid=${depoId}&tarih=1900-01-01`);

            if (!response.success) {
                throw new Error(response.message || this.__('integrations.debug.debugRequestFailed'));
            }

            const data = response.data;

            // Modal içeriği oluştur
            let html = '<div style="max-height:70vh;overflow-y:auto;font-family:monospace;font-size:13px;">';

            // 1. Sorgu Bilgileri
            html += '<div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;">';
            html += '<h4 style="margin:0 0 8px 0;color:var(--color-primary);"><i class="ti ti-search"></i> Sorgu Bilgileri</h4>';
            html += `<div><strong>Depo ID:</strong> ${data.query?.depoId_requested || '?'}</div>`;
            html += `<div><strong>Tarih:</strong> ${data.query?.tarih || '?'}</div>`;
            html += '</div>';

            // 2. Ayarlar
            html += '<div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;">';
            html += '<h4 style="margin:0 0 8px 0;color:var(--color-warning);"><i class="ti ti-settings"></i> TAMSOFT Ayarları</h4>';
            if (data.settings) {
                html += `<div><strong>API URL:</strong> ${data.settings.api_url || '-'}</div>`;
                html += `<div><strong>Varsayılan Depo:</strong> ${data.settings.default_depo_id || '-'}</div>`;
                html += `<div><strong>Sadece Stokta:</strong> ${data.settings.only_stock_positive ?? '-'}</div>`;
                html += `<div><strong>Sadece E-Ticaret:</strong> ${data.settings.only_ecommerce ?? '-'}</div>`;
                html += `<div><strong>Tek Barkod:</strong> ${data.settings.single_barcode ?? '-'}</div>`;
                html += `<div><strong>Son Sync:</strong> ${data.settings.last_sync_date || 'Hiç yapılmadı'}</div>`;
            }
            html += '</div>';

            // 3. Ham API Yanıtı (en önemli bölüm)
            const raw = data.raw_api_response;
            html += '<div style="margin-bottom:16px;padding:12px;border:2px solid var(--color-primary);border-radius:8px;">';
            html += '<h4 style="margin:0 0 8px 0;color:var(--color-primary);"><i class="ti ti-code"></i> Ham API Yanıtı (cURL)</h4>';
            if (raw) {
                const httpColor = raw.http_code === 200 ? 'var(--color-success)' : 'var(--color-danger)';
                html += `<div><strong>URL:</strong> <span style="word-break:break-all;font-size:11px;">${raw.url || '?'}</span></div>`;
                html += `<div><strong>HTTP Kodu:</strong> <span style="color:${httpColor};font-weight:bold;">${raw.http_code}</span></div>`;
                html += `<div><strong>Content-Type:</strong> ${raw.content_type || '?'}</div>`;
                html += `<div><strong>Yanıt Boyutu:</strong> ${raw.response_length || 0} byte</div>`;
                html += `<div><strong>JSON Parse:</strong> ${raw.json_parse_success ? '✅ Başarılı' : '❌ Başarısız'} (${raw.json_error || 'OK'})</div>`;
                html += `<div><strong>Parsed Tip:</strong> ${raw.parsed_type || '?'}</div>`;
                html += `<div><strong>Array mı:</strong> ${raw.parsed_is_array ? '✅ Evet' : '❌ Hayır'}</div>`;
                html += `<div><strong>Eleman Sayısı:</strong> <span style="font-size:18px;font-weight:bold;color:${(raw.parsed_count || 0) > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${raw.parsed_count ?? 'N/A'}</span></div>`;
                html += `<div><strong>Numeric Array:</strong> ${raw.is_numeric_array ? '✅ Evet' : '❌ Hayır'}</div>`;

                if (raw.parsed_keys && raw.parsed_keys.length > 0) {
                    html += `<div><strong>İlk 10 Key:</strong> ${raw.parsed_keys.join(', ')}</div>`;
                }

                if (raw.curl_error) {
                    html += `<div style="color:var(--color-danger);"><strong>cURL Hata:</strong> ${raw.curl_error}</div>`;
                }

                // Çift JSON
                if (raw.double_decoded) {
                    html += '<div style="margin-top:8px;padding:8px;background:rgba(250,176,5,0.1);border-radius:4px;">';
                    html += '<strong>⚠️ Çift JSON Tespit Edildi!</strong>';
                    html += `<div>Double decoded tip: ${raw.double_decoded.type}, array: ${raw.double_decoded.is_array ? 'evet' : 'hayır'}, count: ${raw.double_decoded.count ?? 'N/A'}</div>`;
                    html += '</div>';
                }

                // Ham yanıt önizleme
                if (raw.response_first_500) {
                    html += '<div style="margin-top:8px;"><strong>Ham Yanıt (İlk 500 karakter):</strong></div>';
                    html += `<pre style="background:#1a1a2e;color:#e0e0e0;padding:8px;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow-y:auto;">${this._escapeHtml(raw.response_first_500)}</pre>`;
                }

                // İlk öğe
                if (raw.first_item) {
                    html += '<div style="margin-top:8px;"><strong>İlk Öğe:</strong></div>';
                    html += `<pre style="background:#1a1a2e;color:#e0e0e0;padding:8px;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;">${this._escapeHtml(JSON.stringify(raw.first_item, null, 2))}</pre>`;
                }
            }
            html += '</div>';

            // 4. Gateway getStokListesi Sonucu
            const gw = data.gateway_getStokListesi;
            html += '<div style="margin-bottom:16px;padding:12px;border:2px solid var(--color-success);border-radius:8px;">';
            html += '<h4 style="margin:0 0 8px 0;color:var(--color-success);"><i class="ti ti-gateway"></i> Gateway getStokListesi() Sonucu</h4>';
            if (gw) {
                if (gw.error) {
                    html += `<div style="color:var(--color-danger);"><strong>Hata:</strong> ${gw.error}</div>`;
                } else {
                    html += `<div><strong>Tip:</strong> ${gw.type || '?'}</div>`;
                    html += `<div><strong>Array mı:</strong> ${gw.is_array ? '✅ Evet' : '❌ Hayır'}</div>`;
                    html += `<div><strong>Eleman Sayısı:</strong> <span style="font-size:18px;font-weight:bold;color:${(gw.count || 0) > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${gw.count ?? 'N/A'}</span></div>`;
                    html += `<div><strong>Numeric Array:</strong> ${gw.is_numeric_array ? '✅ Evet' : '❌ Hayır'}</div>`;

                    if (gw.keys_sample && gw.keys_sample.length > 0) {
                        html += `<div><strong>Keys:</strong> ${gw.keys_sample.join(', ')}</div>`;
                    }

                    if (gw.first_item) {
                        html += '<div style="margin-top:8px;"><strong>İlk Öğe (unwrap sonrası):</strong></div>';
                        html += `<pre style="background:#1a1a2e;color:#e0e0e0;padding:8px;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;">${this._escapeHtml(JSON.stringify(gw.first_item, null, 2))}</pre>`;
                    }
                }
            }
            html += '</div>';

            // 5. Depo Bilgileri
            const depo = data.depo_info;
            html += '<div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;">';
            html += '<h4 style="margin:0 0 8px 0;color:var(--color-info);"><i class="ti ti-building-warehouse"></i> Depo Bilgileri</h4>';
            if (depo) {
                if (depo.error) {
                    html += `<div style="color:var(--color-danger);"><strong>Hata:</strong> ${depo.error}</div>`;
                } else {
                    html += `<div><strong>Depo Sayısı:</strong> ${depo.count ?? '?'}</div>`;
                    if (depo.available_depo_ids && depo.available_depo_ids.length > 0) {
                        html += '<div style="margin-top:8px;"><strong>Mevcut Depolar:</strong></div>';
                        html += '<table style="width:100%;border-collapse:collapse;margin-top:4px;">';
                        html += '<tr style="background:rgba(0,0,0,0.1);"><th style="padding:4px 8px;text-align:left;border:1px solid var(--border-color);">ID</th><th style="padding:4px 8px;text-align:left;border:1px solid var(--border-color);">Ad</th></tr>';
                        depo.available_depo_ids.forEach(d => {
                            const isSelected = String(d.id) === String(depoId);
                            const rowStyle = isSelected ? 'background:rgba(34,139,230,0.15);font-weight:bold;' : '';
                            html += `<tr style="${rowStyle}"><td style="padding:4px 8px;border:1px solid var(--border-color);">${d.id}${isSelected ? ' ← seçili' : ''}</td><td style="padding:4px 8px;border:1px solid var(--border-color);">${d.name}</td></tr>`;
                        });
                        html += '</table>';
                    }
                }
            }
            html += '</div>';

            html += '</div>';

            // Modal ile göster
            Modal.show({
                title: this.__('integrations.tamsoft.debug.modalTitle'),
                icon: 'ti-bug',
                content: html,
                size: 'lg',
                showConfirm: false,
                cancelText: 'Kapat'
            });

        } catch (error) {
            Toast.error(this.__('integrations.debug.debugError', { error: error.message }));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ti ti-bug"></i> Debug';
            }
        }
    }

    /**
     * HTML escape helper
     */
    _escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================
    // Import Settings Tab Methods
    // =========================================

    renderImportTab() {
        const basePath = window.OmnexConfig?.basePath || '';
        const origin = window.location.origin;
        const uploadUrl = `${origin}${basePath}/api/import/upload`;

        return `
            <!-- Import Settings Tab -->
            <div id="tab-import" class="settings-tab-content ${this.activeTab === 'import' ? 'active' : ''}">
                <div class="settings-grid import-grid-layout">
                    <!-- LEFT COLUMN: Settings + Pending Files -->
                    <div class="import-left-column">
                        <!-- Import Settings Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-file-import"></i>
                                    ${this.__('integrations.import.settingsTitle')}
                                </h2>
                                <span id="import-status-badge" class="badge badge-secondary">${this.__('integrations.import.loading')}</span>
                            </div>
                            <div class="chart-card-body">
                                <p class="text-muted mb-4">${this.__('integrations.import.settingsDescription')}</p>

                                <div class="form-grid">
                                    <!-- Enable Toggle -->
                                    <div class="form-group full-width">
                                        <div class="flex items-center gap-3">
                                            <label class="toggle-switch">
                                                <input type="checkbox" id="import-enabled">
                                                <span class="toggle-slider"></span>
                                            </label>
                                            <label class="form-label mb-0">${this.__('integrations.import.enabled')}</label>
                                        </div>
                                    </div>

                                    <!-- Auto Import -->
                                    <div class="form-group full-width">
                                        <div class="flex items-center gap-3">
                                            <label class="toggle-switch">
                                                <input type="checkbox" id="import-auto-enabled">
                                                <span class="toggle-slider"></span>
                                            </label>
                                            <label class="form-label mb-0">${this.__('integrations.import.autoImport')}</label>
                                        </div>
                                        <small class="text-muted">${this.__('integrations.import.autoImportHint')}</small>
                                    </div>

                                    <!-- Check Interval -->
                                    <div class="form-group" id="import-interval-group">
                                        <label class="form-label">${this.__('integrations.import.checkInterval')}</label>
                                        <div class="flex items-center gap-2">
                                            <input type="number" id="import-check-interval" class="form-input" value="30" min="5" max="1440" style="width: 100px">
                                            <span class="text-muted">${this.__('integrations.import.minutes')}</span>
                                        </div>
                                    </div>

                                    <!-- Max File Size -->
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.import.maxFileSize')}</label>
                                        <div class="flex items-center gap-2">
                                            <input type="number" id="import-max-file-size" class="form-input" value="10" min="1" max="50" style="width: 100px">
                                            <span class="text-muted">MB</span>
                                        </div>
                                    </div>

                                    <!-- Allowed Formats -->
                                    <div class="form-group full-width">
                                        <label class="form-label">${this.__('integrations.import.allowedFormats')}</label>
                                        <div class="flex gap-3 flex-wrap">
                                            ${['csv', 'txt', 'json', 'xml', 'xlsx'].map(fmt => `
                                                <label class="flex items-center gap-2">
                                                    <input type="checkbox" class="import-format-checkbox" value="${fmt}" checked>
                                                    <span>.${fmt.toUpperCase()}</span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Default Import Options -->
                                    <div class="form-group full-width">
                                        <label class="form-label">${this.__('integrations.import.defaultImportOptions')}</label>
                                        <small class="text-muted mb-2 block">${this.__('integrations.import.defaultImportOptionsHint')}</small>
                                        <div class="flex flex-col gap-2">
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="import-update-existing" checked>
                                                <span>${this.__('integrations.import.updateExisting')}</span>
                                            </label>
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="import-create-new" checked>
                                                <span>${this.__('integrations.import.createNew')}</span>
                                            </label>
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="import-skip-errors" checked>
                                                <span>${this.__('integrations.import.skipErrors')}</span>
                                            </label>
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="import-trigger-render" checked>
                                                <span>${this.__('integrations.import.triggerRender')}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <!-- Import Directory Info -->
                                    <div class="form-group full-width">
                                        <label class="form-label">${this.__('integrations.import.importDirectory')}</label>
                                        <div class="flex items-center gap-2">
                                            <input type="text" id="import-directory" class="form-input flex-1" readonly>
                                            <span id="import-pending-count" class="badge badge-warning" style="display:none">0</span>
                                        </div>
                                        <small class="text-muted">${this.__('integrations.import.importDirectoryHint')}</small>
                                    </div>

                                    <!-- Last Auto Import -->
                                    <div class="form-group full-width" id="import-last-info" style="display:none">
                                        <div class="alert alert-info">
                                            <i class="ti ti-clock"></i>
                                            <span id="import-last-text"></span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex gap-2 mt-4 flex-wrap">
                                    <button type="button" id="save-import-btn" class="btn btn-primary">
                                        <i class="ti ti-check"></i>
                                        ${this.__('actions.save')}
                                    </button>
                                    <button type="button" id="configure-mappings-btn" class="btn btn-outline">
                                        <i class="ti ti-arrows-exchange"></i>
                                        ${this.__('integrations.import.configureMappings')}
                                    </button>
                                    <button type="button" id="test-import-btn" class="btn btn-outline">
                                        <i class="ti ti-file-upload"></i>
                                        ${this.__('integrations.import.testImport')}
                                    </button>
                                </div>

                                <!-- Current Mappings Info -->
                                <div id="import-mappings-info" class="mt-3" style="display:none">
                                    <div class="alert alert-success">
                                        <i class="ti ti-arrows-exchange"></i>
                                        <span id="import-mappings-text"></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Pending Files Card (directly below settings) -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-folder-open"></i>
                                    ${this.__('integrations.import.pendingFilesTitle')}
                                </h2>
                                <div class="flex items-center gap-2">
                                    <button type="button" id="import-upload-btn" class="btn btn-sm btn-primary" title="${this.__('integrations.import.uploadFiles')}">
                                        <i class="ti ti-upload"></i>
                                        ${this.__('integrations.import.uploadFiles')}
                                    </button>
                                    <button type="button" id="refresh-import-files-btn" class="btn btn-sm btn-outline" title="${this.__('actions.refresh')}">
                                        <i class="ti ti-refresh"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-card-body">
                                <!-- Upload Drop Zone -->
                                <div id="import-upload-zone" class="import-upload-zone" style="display:none">
                                    <div class="import-upload-zone-inner">
                                        <i class="ti ti-cloud-upload" style="font-size: 2.5rem; color: var(--color-primary); margin-bottom: 8px"></i>
                                        <p class="text-lg font-medium mb-1">${this.__('integrations.import.uploadDropTitle')}</p>
                                        <p class="text-muted text-sm mb-3">${this.__('integrations.import.uploadDropHint')}</p>
                                        <div class="flex items-center gap-2 justify-center">
                                            <button type="button" id="import-select-files-btn" class="btn btn-sm btn-outline">
                                                <i class="ti ti-file-plus"></i>
                                                ${this.__('integrations.import.selectFiles')}
                                            </button>
                                            <span class="text-muted text-xs">.CSV, .TXT, .JSON, .XML, .XLSX</span>
                                        </div>
                                        <input type="file" id="import-file-input" multiple accept=".csv,.txt,.tsv,.json,.xml,.xlsx,.xls,.dat" style="display:none">
                                    </div>
                                    <div id="import-upload-progress" style="display:none">
                                        <div class="import-upload-file-list" id="import-upload-file-list"></div>
                                    </div>
                                </div>

                                <p class="text-muted mb-3">${this.__('integrations.import.pendingFilesDesc')}</p>
                                <div id="import-files-container">
                                    <p class="text-muted text-center">${this.__('integrations.import.loading')}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Import History Card (below files) -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-history"></i>
                                    ${this.__('integrations.import.historyTitle')}
                                </h2>
                                <div class="flex items-center gap-2">
                                    <button type="button" id="refresh-import-history-btn" class="btn btn-sm btn-outline" title="${this.__('actions.refresh')}">
                                        <i class="ti ti-refresh"></i>
                                    </button>
                                    <button type="button" id="clear-import-history-btn" class="btn btn-sm btn-outline" title="${this.__('actions.clear')}">
                                        <i class="ti ti-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-card-body">
                                <div id="import-history-container">
                                    <p class="text-muted text-center">${this.__('integrations.import.historyLoading')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: ERP Push API Documentation Card -->
                    <div class="import-right-column">
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-api-app"></i>
                                ${this.__('integrations.import.apiDocTitle')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.import.apiDocDescription')}</p>

                            <div class="integration-info-list">
                                <!-- Endpoint -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-send"></i> ${this.__('integrations.import.apiEndpoint')}</h4>
                                    <code class="text-sm" style="user-select: all">POST ${escapeHTML(uploadUrl)}</code>
                                    <br>
                                    <small class="text-muted">Content-Type: multipart/form-data</small>
                                </div>

                                <!-- Authentication -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-key"></i> ${this.__('integrations.import.apiAuth')}</h4>
                                    <p class="text-sm mb-2">${this.__('integrations.import.apiAuthHint')}</p>
                                    <div class="flex flex-col gap-1">
                                        <code class="text-sm" style="user-select: all" data-import-api-key-template="Authorization: Bearer __API_KEY__">Authorization: Bearer YOUR_API_KEY_HERE</code>
                                        <span class="text-muted text-xs">${this.__('integrations.import.apiAuthAlt')}</span>
                                        <code class="text-sm" style="user-select: all" data-import-api-key-template="X-Api-Key: __API_KEY__">X-Api-Key: YOUR_API_KEY_HERE</code>
                                    </div>
                                </div>

                                <!-- cURL Examples -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-terminal-2"></i> ${this.__('integrations.import.apiExample')}</h4>

                                    <p class="text-muted text-sm mb-2">${this.__('integrations.import.apiExampleCsv')}</p>
                                    <pre class="text-sm overflow-x-auto" style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 12px"><code data-import-api-key-template="curl -X POST &quot;${escapeHTML(uploadUrl)}&quot; \\
  -H &quot;Authorization: Bearer __API_KEY__&quot; \\
  -F &quot;file=@/path/to/products.csv&quot;">curl -X POST "${escapeHTML(uploadUrl)}" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -F "file=@/path/to/products.csv"</code></pre>

                                    <p class="text-muted text-sm mb-2">${this.__('integrations.import.apiExampleJson')}</p>
                                    <pre class="text-sm overflow-x-auto" style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 12px"><code data-import-api-key-template="curl -X POST &quot;${escapeHTML(uploadUrl)}&quot; \\
  -H &quot;X-Api-Key: __API_KEY__&quot; \\
  -F &quot;file=@/path/to/products.json&quot;">curl -X POST "${escapeHTML(uploadUrl)}" \\
  -H "X-Api-Key: YOUR_API_KEY_HERE" \\
  -F "file=@/path/to/products.json"</code></pre>

                                    <p class="text-muted text-sm mb-2">${this.__('integrations.import.apiExamplePowershell')}</p>
                                    <pre class="text-sm overflow-x-auto" style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 12px"><code data-import-api-key-template="Invoke-RestMethod -Uri &quot;${escapeHTML(uploadUrl)}&quot; \\
  -Method POST \\
  -Headers @{ &quot;Authorization&quot; = &quot;Bearer __API_KEY__&quot; } \\
  -Form @{ file = Get-Item &quot;C:\\path\\to\\products.xlsx&quot; }">Invoke-RestMethod -Uri "${escapeHTML(uploadUrl)}" \\
  -Method POST \\
  -Headers @{ "Authorization" = "Bearer YOUR_API_KEY_HERE" } \\
  -Form @{ file = Get-Item "C:\\path\\to\\products.xlsx" }</code></pre>
                                </div>

                                <!-- Success Response -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-check"></i> ${this.__('integrations.import.apiResponseSuccess')}</h4>
                                    <pre class="text-sm overflow-x-auto" style="background: var(--bg-secondary); padding: 12px; border-radius: 6px"><code>{
  "success": true,
  "message": "Dosya yüklendi",
  "data": {
    "id": "file-uuid",
    "filename": "20260227_143000_products.csv",
    "original_filename": "products.csv",
    "file_size": 15240,
    "file_format": "csv",
    "status": "pending"
  }
}</code></pre>
                                </div>

                                <!-- Error Responses -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-alert-triangle"></i> ${this.__('integrations.import.apiResponseErrors')}</h4>
                                    <div class="table-responsive">
                                        <table class="data-table text-sm">
                                            <thead>
                                                <tr>
                                                    <th>HTTP</th>
                                                    <th>${this.__('integrations.import.apiErrorDesc')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr><td><code>401</code></td><td>${this.__('integrations.import.apiError401')}</td></tr>
                                                <tr><td><code>400</code></td><td>${this.__('integrations.import.apiError400')}</td></tr>
                                                <tr><td><code>403</code></td><td>${this.__('integrations.import.apiError403')}</td></tr>
                                                <tr><td><code>200</code> <span class="badge badge-warning">dup</span></td><td>${this.__('integrations.import.apiErrorDup')}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Supported Formats -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-files"></i> ${this.__('integrations.import.apiFormats')}</h4>
                                    <div class="flex gap-2 flex-wrap">
                                        <span class="badge badge-outline">.CSV</span>
                                        <span class="badge badge-outline">.TXT / .TSV</span>
                                        <span class="badge badge-outline">.JSON</span>
                                        <span class="badge badge-outline">.XML</span>
                                        <span class="badge badge-outline">.XLSX</span>
                                    </div>
                                    <small class="text-muted mt-2 block">${this.__('integrations.import.apiFormatsHint')}</small>
                                </div>

                                <!-- File field mapping info -->
                                <div class="integration-info-box">
                                    <h4><i class="ti ti-columns"></i> ${this.__('integrations.import.apiFieldMapping')}</h4>
                                    <p class="text-sm text-muted mb-2">${this.__('integrations.import.apiFieldMappingDesc')}</p>
                                    <div class="table-responsive">
                                        <table class="data-table text-sm">
                                            <thead>
                                                <tr>
                                                    <th>${this.__('integrations.import.apiFieldTarget')}</th>
                                                    <th>${this.__('integrations.import.apiFieldSample')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr><td><code>sku</code></td><td>STOK_KODU, SKU, StockCode, Ürün Kodu</td></tr>
                                                <tr><td><code>barcode</code></td><td>BARKOD, Barcode, EAN</td></tr>
                                                <tr><td><code>name</code></td><td>URUN_ADI, ProductName, Ürün Adı</td></tr>
                                                <tr><td><code>current_price</code></td><td>SATIS_FIYATI, Price, Fiyat</td></tr>
                                                <tr><td><code>category</code></td><td>KATEGORI, Category, Grup</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <small class="text-muted mt-2 block">${this.__('integrations.import.apiFieldMappingAuto')}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div><!-- /import-right-column -->
                </div>
            </div>
        `;
    }

    async loadImportSettings() {
        try {
            const response = await this.app.api.get('/import/settings');

            if (response.success && response.data) {
                this.importSettings = response.data.settings || {};
                this.populateImportForm(response.data);
                this.updateImportStatus();
            }
        } catch (error) {
            Logger.warn('Import settings not available:', error);
        }

        // Also load files and history
        await this.loadImportFiles();
        await this.loadImportHistory();
    }

    populateImportForm(data) {
        const s = data.settings || {};

        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!value;
        };

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        setChecked('import-enabled', s.enabled);
        setChecked('import-auto-enabled', s.auto_import_enabled);
        setValue('import-check-interval', s.check_interval || 30);
        setValue('import-max-file-size', s.max_file_size_mb || 10);
        setChecked('import-update-existing', s.update_existing !== false);
        setChecked('import-create-new', s.create_new !== false);
        setChecked('import-skip-errors', s.skip_errors !== false);
        setChecked('import-trigger-render', s.trigger_render !== false);

        // Directory
        setValue('import-directory', data.import_directory || '');

        // Pending files
        const pendingBadge = document.getElementById('import-pending-count');
        if (pendingBadge) {
            if (data.pending_files > 0) {
                pendingBadge.textContent = data.pending_files;
                pendingBadge.style.display = '';
            } else {
                pendingBadge.textContent = '0';
                pendingBadge.style.display = 'none';
            }
        }

        // Allowed formats
        const formats = s.allowed_formats || ['csv', 'txt', 'json', 'xml', 'xlsx'];
        document.querySelectorAll('.import-format-checkbox').forEach(cb => {
            cb.checked = formats.includes(cb.value);
        });

        // Auto import interval visibility
        const intervalGroup = document.getElementById('import-interval-group');
        if (intervalGroup) {
            intervalGroup.style.display = s.auto_import_enabled ? '' : 'none';
        }

        // Last auto import info
        if (s.last_auto_import) {
            const lastInfo = document.getElementById('import-last-info');
            const lastText = document.getElementById('import-last-text');
            if (lastInfo && lastText) {
                lastInfo.style.display = '';
                lastText.textContent = `${this.__('integrations.import.lastAutoImport')}: ${s.last_auto_import}`;
            }
        }

        // Show current mappings info
        const mappingsInfo = document.getElementById('import-mappings-info');
        const mappingsText = document.getElementById('import-mappings-text');
        if (mappingsInfo && mappingsText) {
            const mappings = s.default_mappings || {};
            const count = Object.keys(mappings).length;
            if (count > 0) {
                const pairs = Object.entries(mappings)
                    .slice(0, 5)
                    .map(([target, source]) => `${source} → ${target}`)
                    .join(', ');
                const extra = count > 5 ? ` (+${count - 5})` : '';
                mappingsText.textContent = `${this.__('integrations.import.savedMappings', { count })}: ${pairs}${extra}`;
                mappingsInfo.style.display = '';
            } else {
                mappingsInfo.style.display = 'none';
            }
        }
    }

    updateImportStatus() {
        const badge = document.getElementById('import-status-badge');
        if (!badge) return;

        const s = this.importSettings;
        if (s.enabled) {
            if (s.auto_import_enabled) {
                badge.textContent = this.__('integrations.import.statusAutoActive');
                badge.className = 'badge badge-success';
            } else {
                badge.textContent = this.__('integrations.import.statusActive');
                badge.className = 'badge badge-primary';
            }
        } else {
            badge.textContent = this.__('integrations.import.statusInactive');
            badge.className = 'badge badge-secondary';
        }
    }

    collectImportData() {
        const data = {
            enabled: document.getElementById('import-enabled')?.checked || false,
            auto_import_enabled: document.getElementById('import-auto-enabled')?.checked || false,
            check_interval: parseInt(document.getElementById('import-check-interval')?.value) || 30,
            default_import_filename: null,
            max_file_size_mb: parseInt(document.getElementById('import-max-file-size')?.value) || 10,
            update_existing: document.getElementById('import-update-existing')?.checked || false,
            create_new: document.getElementById('import-create-new')?.checked || false,
            skip_errors: document.getElementById('import-skip-errors')?.checked || false,
            trigger_render: document.getElementById('import-trigger-render')?.checked || false,
            allowed_formats: []
        };

        document.querySelectorAll('.import-format-checkbox:checked').forEach(cb => {
            data.allowed_formats.push(cb.value);
        });

        if (data.allowed_formats.length === 0) {
            data.allowed_formats = ['csv'];
        }

        const selectedDefaultFile = document.querySelector('.default-import-file-radio:checked')?.value
            || this.importSettings.default_import_filename
            || null;
        data.default_import_filename = selectedDefaultFile || null;

        return data;
    }

    async saveImportSettings() {
        const btn = document.getElementById('save-import-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader-2 ti-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            const data = this.collectImportData();
            const response = await this.app.api.put('/import/settings', data);

            if (response.success) {
                this.importSettings = response.data?.settings || data;
                this.updateImportStatus();
                Toast.success(this.__('integrations.import.settingsSaved'));
            } else {
                Toast.error(response.message || this.__('integrations.import.settingsSaveError'));
            }
        } catch (error) {
            Logger.error('Error saving import settings:', error);
            Toast.error(error.message || this.__('integrations.import.settingsSaveError'));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('actions.save')}`;
            }
        }
    }

    getImportShowingText(pagination) {
        const total = Number(pagination?.total || 0);
        const page = Number(pagination?.page || 1);
        const perPage = Number(pagination?.per_page || 10);
        if (total <= 0) return '0 - 0 / 0';

        const start = ((page - 1) * perPage) + 1;
        const end = Math.min(total, start + perPage - 1);
        const translated = this.__('table.showing', { start, end, total });
        return translated === 'table.showing' ? `${start} - ${end} / ${total}` : translated;
    }

    renderImportPagination(kind, pagination) {
        const page = Number(pagination?.page || 1);
        const perPage = Number(pagination?.per_page || 10);
        const totalPages = Math.max(1, Number(pagination?.total_pages || 1));
        const showText = this.getImportShowingText(pagination);
        const pageLabel = this.__('table.page');
        const perPageLabelRaw = this.__('table.perPage');
        const perPageLabel = String(perPageLabelRaw || '').replace(/[\s:：]+$/, '');
        const prevLabel = this.__('table.prev') === 'table.prev' ? this.__('actions.previous') : this.__('table.prev');
        const nextLabel = this.__('table.next') === 'table.next' ? this.__('actions.next') : this.__('table.next');

        return `
            <div class="import-table-footer">
                <div class="import-table-footer-left">${escapeHTML(showText)}</div>
                <div class="import-table-footer-right">
                    <label class="import-table-per-page">
                        <span>${escapeHTML(perPageLabel)}:</span>
                        <select class="import-${kind}-per-page form-select form-select-sm">
                            ${[10, 20, 50].map(size => `<option value="${size}" ${perPage === size ? 'selected' : ''}>${size}</option>`).join('')}
                        </select>
                    </label>
                    <button type="button" class="btn btn-sm btn-outline import-${kind}-prev" ${page <= 1 ? 'disabled' : ''}>${escapeHTML(prevLabel)}</button>
                    <span class="import-table-page">${escapeHTML(pageLabel)} ${page} / ${totalPages}</span>
                    <button type="button" class="btn btn-sm btn-outline import-${kind}-next" ${page >= totalPages ? 'disabled' : ''}>${escapeHTML(nextLabel)}</button>
                </div>
            </div>
        `;
    }

    async loadImportHistory(page = this.importHistoryPagination.page || 1, perPage = this.importHistoryPagination.per_page || 10) {
        const container = document.getElementById('import-history-container');
        if (!container) return;

        try {
            const response = await this.app.api.get('/import/history', { page, per_page: perPage });
            if (response.success) {
                this.importHistory = response.data?.files || [];
                this.importHistoryPagination = response.data?.pagination || {
                    total: this.importHistory.length,
                    page,
                    per_page: perPage,
                    total_pages: 1
                };

                if (this.importHistory.length > 0) {
                    container.innerHTML = this.renderImportHistoryTable(this.importHistory, this.importHistoryPagination);
                    this.bindImportHistoryEvents();
                } else {
                    container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.historyEmpty')}</p>`;
                }
            } else {
                container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.historyEmpty')}</p>`;
            }
        } catch (error) {
            Logger.warn('Import history not available:', error);
            container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.historyEmpty')}</p>`;
        }
    }

    renderImportHistoryTable(files, pagination = this.importHistoryPagination) {
        const statusBadge = (status) => {
            const map = {
                'pending': 'badge-warning',
                'processing': 'badge-info',
                'completed': 'badge-success',
                'failed': 'badge-danger',
                'skipped': 'badge-secondary'
            };
            const cls = map[status] || 'badge-secondary';
            const label = this.__(`integrations.import.status.${status}`) || status;
            return `<span class="badge ${cls}">${label}</span>`;
        };

        const sourceBadge = (source) => {
            const map = {
                'api_push': { icon: 'ti-api', label: 'API' },
                'directory_scan': { icon: 'ti-folder-search', label: this.__('integrations.import.sourceAuto') },
                'manual': { icon: 'ti-upload', label: this.__('integrations.import.sourceManual') }
            };
            const s = map[source] || { icon: 'ti-file', label: source };
            return `<span class="badge badge-outline"><i class="ti ${s.icon}"></i> ${s.label}</span>`;
        };

        const sortedFiles = [...files].sort((a, b) => {
            const aDate = new Date(a?.created_at || a?.processed_at || 0).getTime();
            const bDate = new Date(b?.created_at || b?.processed_at || 0).getTime();
            return bDate - aDate;
        });

        const rows = sortedFiles.map(f => `
            <tr>
                <td title="${escapeHTML(f.original_filename || f.filename)}">${escapeHTML(f.original_filename || f.filename)}</td>
                <td>${sourceBadge(f.source)}</td>
                <td>${statusBadge(f.status)}</td>
                <td class="text-center">${f.total_rows || '-'}</td>
                <td class="text-center text-success">${f.inserted || 0}</td>
                <td class="text-center text-primary">${f.updated || 0}</td>
                <td class="text-center text-danger">${f.failed || 0}</td>
                <td>${f.processed_at || f.created_at || '-'}</td>
            </tr>
        `).join('');

        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>${this.__('integrations.import.historyFile')}</th>
                            <th>${this.__('integrations.import.historySource')}</th>
                            <th>${this.__('integrations.import.historyStatus')}</th>
                            <th class="text-center">${this.__('integrations.import.historyTotal')}</th>
                            <th class="text-center">${this.__('integrations.import.historyInserted')}</th>
                            <th class="text-center">${this.__('integrations.import.historyUpdated')}</th>
                            <th class="text-center">${this.__('integrations.import.historyFailed')}</th>
                            <th>${this.__('integrations.import.historyDate')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            ${this.renderImportPagination('history', pagination)}
        `;
    }

    async loadImportFiles(page = this.importFilesPagination.page || 1, perPage = this.importFilesPagination.per_page || 10) {
        const container = document.getElementById('import-files-container');
        if (!container) return;

        try {
            const response = await this.app.api.get('/import/files', { page, per_page: perPage });
            if (response.success) {
                this.importFiles = response.data?.files || [];
                this.importFilesPagination = response.data?.pagination || {
                    total: this.importFiles.length,
                    page,
                    per_page: perPage,
                    total_pages: 1
                };

                if (response.data?.default_import_filename) {
                    this.importSettings.default_import_filename = response.data.default_import_filename;
                }

                if (!this.importSettings.default_import_filename && this.importFiles.length > 0 && Number(page) === 1) {
                    this.importSettings.default_import_filename = this.importFiles[0].filename;
                    await this.persistDefaultImportFile(this.importSettings.default_import_filename, true);
                }

                if (this.importFiles.length > 0) {
                    container.innerHTML = this.renderImportFilesTable(this.importFiles, this.importFilesPagination);
                    this.bindImportFileEvents();
                } else {
                    container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.pendingFilesEmpty')}</p>`;
                }
            } else {
                container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.pendingFilesEmpty')}</p>`;
            }
        } catch (error) {
            Logger.warn('Import files not available:', error);
            container.innerHTML = `<p class="text-muted text-center">${this.__('integrations.import.pendingFilesEmpty')}</p>`;
        }
    }

    renderImportFilesTable(files, pagination = this.importFilesPagination) {
        const formatIcon = (ext) => {
            const map = {
                'csv': 'ti-file-type-csv',
                'txt': 'ti-file-type-txt',
                'tsv': 'ti-file-type-txt',
                'json': 'ti-braces',
                'xml': 'ti-file-type-xml',
                'xlsx': 'ti-file-type-xls',
                'xls': 'ti-file-type-xls',
                'dat': 'ti-file-text'
            };
            return map[ext] || 'ti-file';
        };
        const defaultFile = this.importSettings.default_import_filename || '';
        let selectedDefaultFilename = defaultFile;
        if (defaultFile && !files.some(f => f.filename === defaultFile)) {
            const candidate = files.find(f => f.filename.endsWith(`_${defaultFile}`));
            if (candidate) {
                selectedDefaultFilename = candidate.filename;
            }
        }

        const rows = files.map(f => `
            <tr>
                <td class="text-center">
                    <input type="checkbox" class="import-file-checkbox" value="${escapeHTML(f.filename)}">
                </td>
                <td class="text-center">
                    <input
                        type="radio"
                        class="default-import-file-radio"
                        name="default-import-file"
                        value="${escapeHTML(f.filename)}"
                        ${selectedDefaultFilename === f.filename ? 'checked' : ''}
                    >
                </td>
                <td>
                    <div class="flex items-center gap-2">
                        <i class="ti ${formatIcon(f.extension)} text-lg"></i>
                        <span title="${escapeHTML(f.filename)}">${escapeHTML(f.filename)}</span>
                    </div>
                </td>
                <td><span class="badge badge-outline">.${f.extension.toUpperCase()}</span></td>
                <td>${f.size_formatted}</td>
                <td>${f.modified}</td>
                <td>
                    <div class="flex items-center gap-1">
                        ${f.already_imported
                            ? `<span class="badge badge-secondary">${this.__('integrations.import.alreadyImported')}</span>`
                            : `<button class="btn btn-sm btn-primary import-file-btn" data-filename="${escapeHTML(f.filename)}">
                                <i class="ti ti-upload"></i> ${this.__('integrations.import.importFile')}
                               </button>`
                        }
                        <button class="btn btn-sm btn-outline text-danger delete-import-file-btn" data-filename="${escapeHTML(f.filename)}" title="${this.__('actions.delete')}">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="flex items-center gap-2 mb-2">
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="import-files-select-all">
                    ${this.__('integrations.import.selectAll')}
                </label>
                <button type="button" id="delete-selected-import-files-btn" class="btn btn-sm btn-outline text-danger" style="display:none">
                    <i class="ti ti-trash"></i>
                    ${this.__('integrations.import.deleteSelected')}
                </button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width:36px"></th>
                            <th class="text-center"><i class="ti ti-star"></i></th>
                            <th>${this.__('integrations.import.historyFile')}</th>
                            <th>${this.__('integrations.import.fileFormat')}</th>
                            <th>${this.__('integrations.import.fileSize')}</th>
                            <th>${this.__('integrations.import.fileModified')}</th>
                            <th>${this.__('integrations.import.fileAction')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            ${this.renderImportPagination('files', pagination)}
        `;
    }

    bindImportFileEvents() {
        document.querySelectorAll('.import-file-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const filename = e.currentTarget.dataset.filename;
                await this.importFileFromDirectory(filename, e.currentTarget);
            });
        });

        document.querySelectorAll('.default-import-file-radio').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                const selected = e.currentTarget.value || null;
                await this.persistDefaultImportFile(selected, true);
            });
        });

        // Tekli silme
        document.querySelectorAll('.delete-import-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.currentTarget.dataset.filename;
                this.deleteImportFiles([filename]);
            });
        });

        // Tümünü seç
        document.getElementById('import-files-select-all')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.import-file-checkbox').forEach(cb => { cb.checked = checked; });
            this.updateDeleteSelectedBtn();
        });

        // Checkbox değişikliği
        document.querySelectorAll('.import-file-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.updateDeleteSelectedBtn());
        });

        // Seçilenleri sil
        document.getElementById('delete-selected-import-files-btn')?.addEventListener('click', () => {
            const selected = Array.from(document.querySelectorAll('.import-file-checkbox:checked')).map(cb => cb.value);
            if (selected.length) this.deleteImportFiles(selected);
        });

        document.querySelector('.import-files-prev')?.addEventListener('click', () => {
            const nextPage = Math.max(1, (this.importFilesPagination.page || 1) - 1);
            this.loadImportFiles(nextPage, this.importFilesPagination.per_page || 10);
        });

        document.querySelector('.import-files-next')?.addEventListener('click', () => {
            const current = this.importFilesPagination.page || 1;
            const totalPages = this.importFilesPagination.total_pages || 1;
            const nextPage = Math.min(totalPages, current + 1);
            this.loadImportFiles(nextPage, this.importFilesPagination.per_page || 10);
        });

        document.querySelector('.import-files-per-page')?.addEventListener('change', (e) => {
            const perPage = parseInt(e.target.value, 10) || 10;
            this.loadImportFiles(1, perPage);
        });
    }

    updateDeleteSelectedBtn() {
        const selected = document.querySelectorAll('.import-file-checkbox:checked').length;
        const btn = document.getElementById('delete-selected-import-files-btn');
        if (btn) {
            btn.style.display = selected > 0 ? '' : 'none';
            btn.textContent = '';
            btn.innerHTML = `<i class="ti ti-trash"></i> ${this.__('integrations.import.deleteSelected')} (${selected})`;
        }
    }

    deleteImportFiles(filenames) {
        const count = filenames.length;
        Modal.confirm({
            title: this.__('actions.delete'),
            message: count === 1
                ? `"${filenames[0]}" ${this.__('integrations.import.deleteConfirmSingle')}`
                : `${count} ${this.__('integrations.import.deleteConfirmMulti')}`,
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete('/import/files', { filenames });
                    if (response.success) {
                        Toast.success(response.message || this.__('messages.deleteSuccess'));
                        await this.loadImportFiles(1, this.importFilesPagination.per_page || 10);
                    } else {
                        Toast.error(response.message || this.__('messages.deleteFailed'));
                    }
                } catch (error) {
                    Logger.error('Delete import files error:', error);
                    Toast.error(error.message || this.__('messages.deleteFailed'));
                }
            }
        });
    }

    toggleImportUploadZone() {
        const zone = document.getElementById('import-upload-zone');
        if (!zone) return;
        const isVisible = zone.style.display !== 'none';
        zone.style.display = isVisible ? 'none' : '';
        // Reset progress area
        if (!isVisible) {
            const progress = document.getElementById('import-upload-progress');
            if (progress) progress.style.display = 'none';
            const fileInput = document.getElementById('import-file-input');
            if (fileInput) fileInput.value = '';
        }
    }

    bindImportDropZoneEvents() {
        const zone = document.getElementById('import-upload-zone');
        if (!zone) return;

        ['dragenter', 'dragover'].forEach(evt => {
            zone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            zone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.remove('drag-over');
            });
        });

        zone.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files?.length) {
                // Show the zone if it was hidden (drop on the card area)
                zone.style.display = '';
                this.handleImportFileUpload(files);
            }
        });
    }

    async handleImportFileUpload(fileList) {
        const files = Array.from(fileList);
        if (!files.length) return;

        const progressContainer = document.getElementById('import-upload-progress');
        const fileListEl = document.getElementById('import-upload-file-list');
        if (!progressContainer || !fileListEl) return;

        progressContainer.style.display = '';

        // Show file list with pending status
        fileListEl.innerHTML = files.map((f, i) => `
            <div class="import-upload-file-item" id="upload-file-item-${i}">
                <div class="flex items-center gap-2 flex-1">
                    <i class="ti ti-file text-lg"></i>
                    <span class="text-sm">${escapeHTML(f.name)}</span>
                    <span class="text-muted text-xs">(${this.formatFileSize(f.size)})</span>
                </div>
                <span class="upload-file-status">
                    <i class="ti ti-loader ti-spin"></i>
                </span>
            </div>
        `).join('');

        // Build FormData
        const formData = new FormData();
        files.forEach(f => formData.append('files[]', f));

        try {
            const response = await this.app.api.upload('/import/web-upload', formData);

            if (response.success) {
                const data = response.data || {};
                const results = data.results || [];

                // Update each file status
                results.forEach((r, i) => {
                    const item = document.getElementById(`upload-file-item-${i}`);
                    if (!item) return;
                    const statusEl = item.querySelector('.upload-file-status');
                    if (!statusEl) return;

                    if (r.success) {
                        statusEl.innerHTML = `<span class="badge badge-success">${this.__('integrations.import.uploadSuccess')}</span>`;
                    } else {
                        statusEl.innerHTML = `<span class="badge badge-danger" title="${escapeHTML(r.error || '')}">${this.__('integrations.import.uploadFailed')}</span>`;
                    }
                });

                const msg = response.message || `${data.success_count}/${data.total_count}`;
                if (data.fail_count > 0) {
                    Toast.warning(msg);
                } else {
                    Toast.success(msg);
                }

                // Refresh files table
                await this.loadImportFiles(1, this.importFilesPagination.per_page || 10);
            } else {
                Toast.error(response.message || this.__('integrations.import.uploadError'));
                fileListEl.innerHTML = `<p class="text-danger text-sm">${escapeHTML(response.message || '')}</p>`;
            }
        } catch (error) {
            Logger.error('Import file upload error:', error);
            Toast.error(error.message || this.__('integrations.import.uploadError'));
            fileListEl.innerHTML = `<p class="text-danger text-sm">${escapeHTML(error.message || '')}</p>`;
        }

        // Reset file input
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) fileInput.value = '';
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    bindImportHistoryEvents() {
        document.querySelector('.import-history-prev')?.addEventListener('click', () => {
            const nextPage = Math.max(1, (this.importHistoryPagination.page || 1) - 1);
            this.loadImportHistory(nextPage, this.importHistoryPagination.per_page || 10);
        });

        document.querySelector('.import-history-next')?.addEventListener('click', () => {
            const current = this.importHistoryPagination.page || 1;
            const totalPages = this.importHistoryPagination.total_pages || 1;
            const nextPage = Math.min(totalPages, current + 1);
            this.loadImportHistory(nextPage, this.importHistoryPagination.per_page || 10);
        });

        document.querySelector('.import-history-per-page')?.addEventListener('change', (e) => {
            const perPage = parseInt(e.target.value, 10) || 10;
            this.loadImportHistory(1, perPage);
        });
    }

    async clearImportHistory() {
        Modal.confirm({
            title: this.__('actions.delete'),
            message: this.__('messages.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete('/import/history?mode=all');
                    if (response.success) {
                        Toast.success(response.message || this.__('messages.deleteSuccess'));
                        await this.loadImportHistory(1, this.importHistoryPagination.per_page || 10);
                    } else {
                        Toast.error(response.message || this.__('messages.deleteFailed'));
                    }
                } catch (error) {
                    Logger.error('Error clearing import history:', error);
                    Toast.error(error.message || this.__('messages.deleteFailed'));
                }
            }
        });
    }

    async persistDefaultImportFile(filename, silent = false) {
        const selected = filename || null;
        this.importSettings.default_import_filename = selected;

        try {
            const response = await this.app.api.put('/import/settings', {
                default_import_filename: selected
            });

            if (response.success && response.data?.settings) {
                this.importSettings = {
                    ...this.importSettings,
                    ...response.data.settings
                };
                if (!silent) {
                    Toast.success(this.__('integrations.import.settingsSaved'));
                }
            } else if (!silent) {
                Toast.error(response.message || this.__('integrations.import.settingsSaveError'));
            }
        } catch (error) {
            Logger.error('Error saving default import file:', error);
            if (!silent) {
                Toast.error(error.message || this.__('integrations.import.settingsSaveError'));
            }
        }
    }

    async importFileFromDirectory(filename, btn) {
        // Get current defaults from saved settings
        const s = this.importSettings || {};
        const updateExisting = s.update_existing !== false;
        const createNew = s.create_new !== false;
        const skipErrors = s.skip_errors !== false;
        const triggerRender = s.trigger_render !== false;

        // Saved mappings info
        const savedMappings = s.default_mappings || {};
        const mappingCount = Object.keys(savedMappings).length;

        // File extension for display
        const ext = filename.split('.').pop().toUpperCase();

        // Mapping status badge
        const mappingBadge = mappingCount > 0
            ? `<div class="alert alert-success mb-4">
                   <div class="flex items-center gap-2">
                       <i class="ti ti-arrows-exchange"></i>
                       <span>${this.__('integrations.import.savedMappingsWillBeUsed', { count: mappingCount })}</span>
                   </div>
               </div>`
            : `<div class="alert alert-warning mb-4">
                   <div class="flex items-center gap-2">
                       <i class="ti ti-info-circle"></i>
                       <span>${this.__('integrations.import.noSavedMappingsAutoDetect')}</span>
                   </div>
               </div>`;

        Modal.show({
            title: this.__('integrations.import.importModalTitle'),
            icon: 'ti-file-import',
            size: 'md',
            content: `
                <div class="import-modal-content">
                    <!-- File Info -->
                    <div class="alert alert-info mb-4">
                        <div class="flex items-center gap-3">
                            <i class="ti ti-file text-xl"></i>
                            <div>
                                <strong>${escapeHTML(filename)}</strong>
                                <div class="text-sm text-muted"><span class="badge badge-outline">.${ext}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Mapping Status -->
                    ${mappingBadge}

                    <!-- Import Options -->
                    <h4 class="mb-3">${this.__('integrations.import.importModalOptions')}</h4>
                    <div class="flex flex-col gap-3 mb-4">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="modal-update-existing" ${updateExisting ? 'checked' : ''}>
                            <span>${this.__('integrations.import.updateExisting')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="modal-create-new" ${createNew ? 'checked' : ''}>
                            <span>${this.__('integrations.import.createNew')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="modal-skip-errors" ${skipErrors ? 'checked' : ''}>
                            <span>${this.__('integrations.import.skipErrors')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="modal-trigger-render" ${triggerRender ? 'checked' : ''}>
                            <span>${this.__('integrations.import.triggerRender')}</span>
                        </label>
                    </div>

                    <small class="text-muted">${this.__('integrations.import.importModalDefaultsHint')}</small>
                </div>
            `,
            confirmText: this.__('integrations.import.startImport'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                // Collect options from modal
                const options = {
                    update_existing: document.getElementById('modal-update-existing')?.checked || false,
                    create_new: document.getElementById('modal-create-new')?.checked || false,
                    skip_errors: document.getElementById('modal-skip-errors')?.checked || false,
                    trigger_render: document.getElementById('modal-trigger-render')?.checked || false
                };

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = `<i class="ti ti-loader-2 ti-spin"></i> ${this.__('integrations.import.importing')}`;
                }

                try {
                    // Pass saved mappings explicitly along with options
                    const payload = { filename, options };
                    if (mappingCount > 0) {
                        payload.mappings = savedMappings;
                    }
                    const response = await this.app.api.post('/import/files/import', payload);

                    if (response.success) {
                        const d = response.data;

                        if (d.already_imported) {
                            Toast.warning(this.__('integrations.import.alreadyImported'));
                        } else {
                            const summaryText = `${this.__('integrations.import.historyInserted')}: ${d.summary?.inserted || 0}, ` +
                                `${this.__('integrations.import.historyUpdated')}: ${d.summary?.updated || 0}, ` +
                                `${this.__('integrations.import.historyFailed')}: ${d.summary?.failed || 0}`;

                            if (d.status === 'completed') {
                                Toast.success(`${response.message} - ${summaryText}`);
                            } else {
                                Toast.warning(`${response.message} - ${summaryText}`);
                            }

                            // Show detailed result modal
                            this.showImportResultModal(d, filename);
                        }

                        // Refresh files and history
                        await this.loadImportFiles();
                        await this.loadImportHistory();
                    } else {
                        Toast.error(response.message || this.__('integrations.import.importError'));
                    }
                } catch (error) {
                    Logger.error('Error importing file:', error);
                    Toast.error(error.message || this.__('integrations.import.importError'));
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<i class="ti ti-file-import"></i> ${this.__('integrations.import.importFile')}`;
                    }
                }
            }
        });
    }

    showImportResultModal(data, filename) {
        const summary = data.summary || {};
        const errors = data.errors || [];
        const statusClass = data.status === 'completed' ? 'text-success' : 'text-warning';
        const statusIcon = data.status === 'completed' ? 'ti-circle-check' : 'ti-alert-triangle';

        let errorHtml = '';
        if (errors.length > 0) {
            errorHtml = `
                <div class="mt-3">
                    <h4 class="text-danger">${this.__('integrations.import.importErrors')}</h4>
                    <ul class="text-sm text-muted">
                        ${errors.map(e => `<li>${escapeHTML(e)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        Modal.show({
            title: this.__('integrations.import.importResultTitle'),
            icon: statusIcon,
            size: 'md',
            content: `
                <div class="text-center mb-4">
                    <i class="ti ${statusIcon} ${statusClass}" style="font-size: 48px"></i>
                    <h3 class="${statusClass} mt-2">${escapeHTML(filename)}</h3>
                    <p class="text-muted">${this.__('integrations.import.mappingSource')}: ${data.mapping_source === 'saved' ? this.__('integrations.import.mappingSaved') : this.__('integrations.import.mappingAuto')}</p>
                </div>
                <div class="flex gap-3 justify-center flex-wrap">
                    <div class="text-center p-3" style="background: var(--bg-secondary); border-radius: 8px; min-width: 80px">
                        <div class="text-2xl font-bold">${summary.total_rows || 0}</div>
                        <div class="text-xs text-muted">${this.__('integrations.import.historyTotal')}</div>
                    </div>
                    <div class="text-center p-3" style="background: var(--bg-secondary); border-radius: 8px; min-width: 80px">
                        <div class="text-2xl font-bold text-success">${summary.inserted || 0}</div>
                        <div class="text-xs text-muted">${this.__('integrations.import.historyInserted')}</div>
                    </div>
                    <div class="text-center p-3" style="background: var(--bg-secondary); border-radius: 8px; min-width: 80px">
                        <div class="text-2xl font-bold text-primary">${summary.updated || 0}</div>
                        <div class="text-xs text-muted">${this.__('integrations.import.historyUpdated')}</div>
                    </div>
                    <div class="text-center p-3" style="background: var(--bg-secondary); border-radius: 8px; min-width: 80px">
                        <div class="text-2xl font-bold text-danger">${summary.failed || 0}</div>
                        <div class="text-xs text-muted">${this.__('integrations.import.historyFailed')}</div>
                    </div>
                </div>
                ${errorHtml}
            `,
            cancelText: this.__('actions.close'),
            showConfirm: false
        });
    }

    /**
     * Target fields for import mapping (same as ProductList)
     */
    getImportTargetFields() {
        return [
            // Temel Bilgiler
            { key: 'sku', label: this.__('integrations.import.fields.sku'), required: true },
            { key: 'name', label: this.__('integrations.import.fields.name'), required: true },
            { key: 'barcode', label: this.__('integrations.import.fields.barcode') },
            { key: 'slug', label: this.__('integrations.import.fields.slug') },
            { key: 'kunye_no', label: this.__('integrations.import.fields.kunyeNo') },
            { key: 'category', label: this.__('integrations.import.fields.category') },
            { key: 'subcategory', label: this.__('integrations.import.fields.subcategory') },
            { key: 'brand', label: this.__('integrations.import.fields.brand') },
            { key: 'origin', label: this.__('integrations.import.fields.origin') },
            { key: 'production_type', label: this.__('integrations.import.fields.productionType') },
            { key: 'description', label: this.__('integrations.import.fields.description') },
            // Fiyat
            { key: 'current_price', label: this.__('integrations.import.fields.currentPrice'), required: true },
            { key: 'previous_price', label: this.__('integrations.import.fields.previousPrice') },
            { key: 'price_valid_until', label: this.__('integrations.import.fields.priceValidUntil') },
            { key: 'price_updated_at', label: this.__('integrations.import.fields.priceUpdatedAt') },
            { key: 'previous_price_updated_at', label: this.__('integrations.import.fields.previousPriceUpdatedAt') },
            { key: 'vat_rate', label: this.__('integrations.import.fields.vatRate') },
            { key: 'discount_percent', label: this.__('integrations.import.fields.discountPercent') },
            { key: 'campaign_text', label: this.__('integrations.import.fields.campaignText') },
            // Stok
            { key: 'unit', label: this.__('integrations.import.fields.unit') },
            { key: 'stock', label: this.__('integrations.import.fields.stock') },
            { key: 'weight', label: this.__('integrations.import.fields.weight') },
            { key: 'shelf_location', label: this.__('integrations.import.fields.shelfLocation') },
            { key: 'supplier_code', label: this.__('integrations.import.fields.supplierCode') },
            // Geçerlilik
            { key: 'valid_from', label: this.__('integrations.import.fields.validFrom') },
            { key: 'valid_until', label: this.__('integrations.import.fields.validUntil') },
            // Durum
            { key: 'status', label: this.__('integrations.import.fields.status') },
            { key: 'is_featured', label: this.__('integrations.import.fields.isFeatured') },
            // Medya
            { key: 'image_url', label: this.__('integrations.import.fields.imageUrl') },
            { key: 'images', label: this.__('integrations.import.fields.images') },
            { key: 'videos', label: this.__('integrations.import.fields.videos') },
            { key: 'video_url', label: this.__('integrations.import.fields.videoUrl') },
            // Diğer
            { key: 'storage_info', label: this.__('integrations.import.fields.storageInfo') },
            { key: 'group', label: this.__('integrations.import.fields.group') },
            { key: 'erp_id', label: this.__('integrations.import.fields.erpId') }
        ];
    }

    showConfigureMappingsModal() {
        this._mappingPreviewData = null;
        this._mappingSampleFile = null;

        Modal.show({
            title: this.__('integrations.import.configureMappingsTitle'),
            icon: 'ti-arrows-exchange',
            size: 'xl',
            content: `
                <div class="space-y-4">
                    <p class="text-muted mb-2">${this.__('integrations.import.configureMappingsDesc')}</p>

                    <!-- File upload area -->
                    <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center"
                         id="mapping-dropzone">
                        <i class="ti ti-cloud-upload text-4xl text-gray-400 mb-2"></i>
                        <p class="text-gray-600 dark:text-gray-400 mb-2">
                            ${this.__('integrations.import.mappingDragDrop')}
                        </p>
                        <label class="btn btn-primary cursor-pointer">
                            <i class="ti ti-upload"></i>
                            ${this.__('integrations.import.uploadSampleFile')}
                            <input type="file" class="hidden" id="mapping-sample-file"
                                   accept=".txt,.csv,.json,.xml,.xlsx,.xls,.tsv">
                        </label>
                        <p class="text-xs text-gray-500 mt-2">
                            ${this.__('integrations.import.mappingFileHint')}
                        </p>
                    </div>

                    <!-- Preview area (hidden until file loaded) -->
                    <div class="hidden" id="mapping-preview-area">
                        <!-- File info -->
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-3">
                                <i class="ti ti-file text-2xl text-primary-600"></i>
                                <div>
                                    <p class="font-medium" id="mapping-filename"></p>
                                    <p class="text-sm text-gray-500" id="mapping-fileinfo"></p>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-ghost" id="mapping-remove-file">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>

                        <!-- Auto-detect info -->
                        <div id="mapping-auto-detect-result" style="display:none" class="mb-3">
                            <div class="alert alert-info">
                                <i class="ti ti-sparkles"></i>
                                <span id="mapping-auto-detect-text"></span>
                            </div>
                        </div>

                        <!-- Mapping grid (select dropdowns) -->
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="ti ti-arrows-exchange text-primary-600"></i>
                            ${this.__('integrations.import.mappingGridTitle')}
                        </h4>
                        <div class="grid grid-cols-3 gap-3 overflow-y-auto p-2" style="max-height: 400px;" id="mapping-select-grid">
                        </div>

                        <!-- Preview table -->
                        <div class="label-info-box mt-4">
                            <div style="flex: 1;">
                                <h4 class="font-medium mb-2">${this.__('integrations.import.mappingPreviewTitle')}</h4>
                                <div class="overflow-x-auto" id="mapping-preview-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.saveMappingsFromModal();
            }
        });

        // Init events after modal renders
        setTimeout(() => this._initMappingModalEvents(), 100);
    }

    _initMappingModalEvents() {
        const fileInput = document.getElementById('mapping-sample-file');
        const dropzone = document.getElementById('mapping-dropzone');
        const removeBtn = document.getElementById('mapping-remove-file');

        // File select
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) this._handleMappingFile(e.target.files[0]);
        });

        // Drag and drop
        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary-500', 'bg-primary-50');
        });
        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-primary-500', 'bg-primary-50');
        });
        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary-500', 'bg-primary-50');
            if (e.dataTransfer.files[0]) this._handleMappingFile(e.dataTransfer.files[0]);
        });

        // Remove file
        removeBtn?.addEventListener('click', () => {
            this._mappingPreviewData = null;
            this._mappingSampleFile = null;
            dropzone?.classList.remove('hidden');
            document.getElementById('mapping-preview-area')?.classList.add('hidden');
            if (fileInput) fileInput.value = '';
        });
    }

    async _handleMappingFile(file) {
        const dropzone = document.getElementById('mapping-dropzone');
        const previewArea = document.getElementById('mapping-preview-area');

        dropzone?.classList.add('hidden');
        previewArea?.classList.remove('hidden');

        document.getElementById('mapping-filename').textContent = file.name;
        document.getElementById('mapping-fileinfo').textContent = `${(file.size / 1024).toFixed(1)} KB`;

        this._mappingSampleFile = file;

        try {
            const response = await this.app.api.upload('/products/import/preview', file);

            if (response.success && response.data) {
                this._mappingPreviewData = response.data;
                this._renderMappingSelectGrid(response.data);
                this._renderMappingPreviewTable(response.data);
            } else {
                Toast.warning(this.__('integrations.import.noAutoDetect'));
            }
        } catch (error) {
            Logger.error('Mapping preview failed:', error);
            Toast.error(this.__('integrations.import.sampleFileFailed') + ': ' + error.message);
        }
    }

    _renderMappingSelectGrid(data) {
        const container = document.getElementById('mapping-select-grid');
        if (!container) return;

        const sourceFields = data.detected_fields || [];
        const autoDetected = data.detected_mappings || {};
        const savedMappings = this.importSettings?.default_mappings || {};
        // Priority: saved > auto-detected
        const mergedDefaults = { ...autoDetected, ...savedMappings };

        const targetFields = this.getImportTargetFields();

        // Auto-detect info
        const detectCount = Object.keys(autoDetected).length;
        const resultEl = document.getElementById('mapping-auto-detect-result');
        const resultText = document.getElementById('mapping-auto-detect-text');
        if (detectCount > 0 && resultEl && resultText) {
            resultText.textContent = this.__('integrations.import.autoDetectedMappings', { count: detectCount, total: sourceFields.length });
            resultEl.style.display = '';
        }

        container.innerHTML = targetFields.map(field => {
            const autoValue = mergedDefaults[field.key] || '';
            const isRequired = field.required ? '<span class="text-red-500">*</span>' : '';

            return `
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        ${field.label} ${isRequired}
                    </label>
                    <select class="form-select form-select-sm mapping-select-field"
                            data-target="${field.key}">
                        <option value="">${this.__('integrations.import.noMapping')}</option>
                        ${sourceFields.map(sf => `
                            <option value="${escapeHTML(sf)}" ${sf === autoValue ? 'selected' : ''}>
                                ${escapeHTML(sf)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }).join('');
    }

    _renderMappingPreviewTable(data) {
        const container = document.getElementById('mapping-preview-table');
        if (!container) return;

        const rows = data.mapped_data?.slice(0, 5) || data.sample_data?.slice(0, 5) || [];
        const fields = [
            { key: 'sku', label: this.__('integrations.import.fields.sku') },
            { key: 'name', label: this.__('integrations.import.fields.name') },
            { key: 'current_price', label: this.__('integrations.import.fields.currentPrice') },
            { key: 'category', label: this.__('integrations.import.fields.category') }
        ];

        if (rows.length === 0) {
            container.innerHTML = `<p class="text-muted text-sm">${this.__('integrations.import.noPreviewData')}</p>`;
            return;
        }

        container.innerHTML = `
            <table class="text-sm w-full">
                <thead>
                    <tr class="text-left border-b">
                        ${fields.map(f => `<th class="pb-2 pr-4">${escapeHTML(f.label)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr class="border-b border-gray-100">
                            ${fields.map(f => `<td class="py-1 pr-4">${escapeHTML(String(row[f.key] || '-'))}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async saveMappingsFromModal() {
        const mappings = {};

        document.querySelectorAll('.mapping-select-field').forEach(select => {
            const target = select.dataset.target;
            const source = select.value;
            if (source) {
                mappings[target] = source;
            }
        });

        // Save mappings as part of import settings
        try {
            const data = this.collectImportData();
            data.default_mappings = mappings;

            const response = await this.app.api.put('/import/settings', data);

            if (response.success) {
                this.importSettings = response.data?.settings || data;
                this.populateImportForm({ settings: this.importSettings, import_directory: '', pending_files: 0 });
                Toast.success(this.__('integrations.import.mappingsSaved', { count: Object.keys(mappings).length }));
            } else {
                Toast.error(response.message || this.__('integrations.import.settingsSaveError'));
            }
        } catch (error) {
            Logger.error('Error saving mappings:', error);
            Toast.error(error.message || this.__('integrations.import.settingsSaveError'));
        }
    }

    showTestImportModal() {
        const files = this.importFiles || [];
        let fileOptions = '';
        if (files.length > 0) {
            fileOptions = files.map(f => `<option value="${escapeHTML(f.filename)}">${escapeHTML(f.filename)} (${f.size_formatted})</option>`).join('');
        }

        Modal.show({
            title: this.__('integrations.import.testImportTitle'),
            icon: 'ti-file-upload',
            size: 'md',
            content: `
                <div class="space-y-4">
                    <p class="text-muted mb-3">${this.__('integrations.import.testImportDesc')}</p>
                    ${files.length > 0 ? `
                        <div class="form-group">
                            <label class="form-label">${this.__('integrations.import.testImportSelectFile')}</label>
                            <select id="test-import-file-select" class="form-select">
                                <option value="">-- ${this.__('integrations.import.testImportChoose')} --</option>
                                ${fileOptions}
                            </select>
                        </div>
                    ` : `
                        <div class="alert alert-warning">
                            <i class="ti ti-alert-triangle"></i>
                            ${this.__('integrations.import.pendingFilesEmpty')}
                        </div>
                    `}
                </div>
            `,
            confirmText: files.length > 0 ? this.__('integrations.import.configureMappings') : null,
            cancelText: this.__('actions.close'),
            onConfirm: files.length > 0 ? async () => {
                const select = document.getElementById('test-import-file-select');
                const filename = select?.value;
                if (!filename) {
                    Toast.warning(this.__('integrations.import.testImportChoose'));
                    return;
                }
                Modal.close();
                await this.showMappingModalForServerFile(filename);
            } : undefined
        });
    }

    async showMappingModalForServerFile(filename) {
        // Fetch preview data from server
        try {
            const response = await this.app.api.get('/import/files', { preview: filename });
            if (!response.success || !response.data) {
                Toast.error(response.message || this.__('integrations.import.sampleFileFailed'));
                return;
            }

            const previewData = response.data;
            this._mappingPreviewData = previewData;
            this._mappingImportFilename = filename;

            // Open mapping modal with server file data
            Modal.show({
                title: this.__('integrations.import.configureMappingsTitle'),
                icon: 'ti-arrows-exchange',
                size: 'xl',
                content: `
                    <div class="space-y-4">
                        <!-- File info -->
                        <div class="alert alert-info mb-3">
                            <div class="flex items-center gap-3">
                                <i class="ti ti-file text-xl"></i>
                                <div>
                                    <strong>${escapeHTML(filename)}</strong>
                                    <span class="text-sm text-muted ml-2">${previewData.total_rows || 0} ${this.__('integrations.import.testImportRows')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Auto-detect info -->
                        <div id="mapping-auto-detect-result" style="display:none" class="mb-3">
                            <div class="alert alert-success">
                                <i class="ti ti-sparkles"></i>
                                <span id="mapping-auto-detect-text"></span>
                            </div>
                        </div>

                        <!-- Mapping grid -->
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="ti ti-arrows-exchange text-primary-600"></i>
                            ${this.__('integrations.import.mappingGridTitle')}
                        </h4>
                        <div class="grid grid-cols-3 gap-3 overflow-y-auto p-2" style="max-height: 400px;" id="mapping-select-grid">
                        </div>

                        <!-- Preview table -->
                        <div class="label-info-box mt-4">
                            <div style="flex: 1;">
                                <h4 class="font-medium mb-2">${this.__('integrations.import.mappingPreviewTitle')}</h4>
                                <div class="overflow-x-auto" id="mapping-preview-table"></div>
                            </div>
                        </div>
                    </div>
                `,
                confirmText: this.__('integrations.import.startImport'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    await this._runImportWithModalMappings(filename);
                }
            });

            // Render grids after modal is shown
            setTimeout(() => {
                this._renderMappingSelectGrid(previewData);
                this._renderMappingPreviewTable(previewData);
            }, 100);

        } catch (error) {
            Logger.error('Server file preview failed:', error);
            Toast.error(error.message || this.__('integrations.import.sampleFileFailed'));
        }
    }

    async _runImportWithModalMappings(filename) {
        // Collect mappings from modal selects
        const mappings = {};
        document.querySelectorAll('.mapping-select-field').forEach(select => {
            const target = select.dataset.target;
            const source = select.value;
            if (target && source) {
                mappings[target] = source;
            }
        });

        if (Object.keys(mappings).length === 0) {
            Toast.warning(this.__('integrations.import.noMappingSelected'));
            return;
        }

        const s = this.importSettings || {};
        const options = {
            update_existing: s.update_existing !== false,
            create_new: s.create_new !== false,
            skip_errors: s.skip_errors !== false,
            trigger_render: s.trigger_render !== false
        };

        try {
            const response = await this.app.api.post('/import/files/import', {
                filename,
                mappings,
                options
            });

            if (response.success) {
                const d = response.data;
                const summaryText = `${this.__('integrations.import.historyInserted')}: ${d.summary?.inserted || 0}, ` +
                    `${this.__('integrations.import.historyUpdated')}: ${d.summary?.updated || 0}, ` +
                    `${this.__('integrations.import.historyFailed')}: ${d.summary?.failed || 0}`;

                if (d.status === 'completed') {
                    Toast.success(`${response.message} - ${summaryText}`);
                } else {
                    Toast.warning(`${response.message} - ${summaryText}`);
                }

                this.showImportResultModal(d, filename);
                await this.loadImportFiles();
                await this.loadImportHistory();
            } else {
                Toast.error(response.message || this.__('integrations.import.importError'));
            }
        } catch (error) {
            Logger.error('Import with mappings failed:', error);
            Toast.error(error.message || this.__('integrations.import.importError'));
        }
    }

    // =========================================
    // MQTT Broker Tab Methods
    // =========================================

    renderMqttTab() {
        const basePath = window.OmnexConfig?.basePath || '';
        const origin = window.location.origin;
        const hostname = window.location.hostname;
        const defaultBrokerUrl = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost' : hostname;
        const defaultContentUrl = `${origin}${basePath}/api/esl/mqtt/content`;
        const defaultReportUrl = `${origin}${basePath}/api/esl/mqtt/report`;

        return `
            <!-- MQTT Broker Tab -->
            <div id="tab-mqtt" class="settings-tab-content ${this.activeTab === 'mqtt' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- MQTT Broker Settings Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-broadcast"></i>
                                ${this.__('integrations.mqtt.title')}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span id="mqtt-status-badge" class="badge badge-secondary">${this.__('integrations.mqtt.loading')}</span>
                            </div>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.mqtt.description')}</p>

                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.brokerUrl')}</label>
                                    <input type="text" id="mqtt-broker-url" class="form-input" value="${this._escapeHtml(defaultBrokerUrl)}" placeholder="${this.__('integrations.mqtt.brokerUrlPlaceholder')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.brokerPort')}</label>
                                    <input type="number" id="mqtt-broker-port" class="form-input" value="1883" min="1" max="65535">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.useTls')}</label>
                                    <div class="flex items-center gap-2 mt-2">
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="mqtt-use-tls">
                                            <span class="toggle-slider"></span>
                                        </label>
                                        <span class="text-sm text-muted">${this.__('integrations.mqtt.useTlsHelp')}</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.provider')}</label>
                                    <select id="mqtt-provider" class="form-select">
                                        <option value="mosquitto">${this.__('integrations.mqtt.providers.mosquitto')}</option>
                                        <option value="emqx">${this.__('integrations.mqtt.providers.emqx')}</option>
                                        <option value="hivemq">${this.__('integrations.mqtt.providers.hivemq')}</option>
                                        <option value="custom">${this.__('integrations.mqtt.providers.custom')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.username')}</label>
                                    <input type="text" id="mqtt-username" class="form-input" placeholder="${this.__('integrations.mqtt.usernamePlaceholder')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.password')}</label>
                                    <input type="password" id="mqtt-password" class="form-input" placeholder="${this.__('integrations.mqtt.passwordPlaceholder')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.topicPrefix')}</label>
                                    <input type="text" id="mqtt-topic-prefix" class="form-input" value="omnex/esl" placeholder="${this.__('integrations.mqtt.topicPrefixPlaceholder')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.status')}</label>
                                    <select id="mqtt-status" class="form-select">
                                        <option value="active">${this.__('integrations.mqtt.statuses.active')}</option>
                                        <option value="testing">${this.__('integrations.mqtt.statuses.testing')}</option>
                                        <option value="inactive">${this.__('integrations.mqtt.statuses.disabled')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.appId')}</label>
                                    <input type="text" id="mqtt-app-id" class="form-input" placeholder="${this.__('integrations.mqtt.appIdPlaceholder')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.mqtt.appSecret')}</label>
                                    <input type="password" id="mqtt-app-secret" class="form-input" placeholder="${this.__('integrations.mqtt.appSecretPlaceholder')}">
                                </div>
                                <div class="form-group full-width">
                                    <label class="form-label">${this.__('integrations.mqtt.contentServerUrl')}</label>
                                    <input type="text" id="mqtt-content-server-url" class="form-input" value="${this._escapeHtml(defaultContentUrl)}" placeholder="${this.__('integrations.mqtt.contentServerUrlPlaceholder')}">
                                </div>
                                <div class="form-group full-width">
                                    <label class="form-label">${this.__('integrations.mqtt.reportServerUrl')}</label>
                                    <input type="text" id="mqtt-report-server-url" class="form-input" value="${this._escapeHtml(defaultReportUrl)}" placeholder="${this.__('integrations.mqtt.reportServerUrlPlaceholder')}">
                                </div>
                            </div>

                            <div class="flex gap-2 mt-4">
                                <button id="test-mqtt-btn" class="btn btn-outline">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('integrations.mqtt.testConnection')}
                                </button>
                                <button id="save-mqtt-btn" class="btn btn-primary">
                                    <i class="ti ti-device-floppy"></i>
                                    ${this.__('integrations.mqtt.save')}
                                </button>
                            </div>

                            <div id="mqtt-test-result" class="mt-3" style="display:none;"></div>
                        </div>
                    </div>

                    <!-- MQTT Info Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('integrations.mqtt.infoTitle')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-4">${this.__('integrations.mqtt.infoText')}</p>

                            <div class="integration-info-list">
                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.mqtt.setupSteps')}</h4>
                                    <div class="flex flex-col gap-2">
                                        <div class="flex items-center gap-2">
                                            <span class="badge badge-primary">1</span>
                                            <span class="text-sm">${this.__('integrations.mqtt.step1')}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="badge badge-primary">2</span>
                                            <span class="text-sm">${this.__('integrations.mqtt.step2')}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="badge badge-primary">3</span>
                                            <span class="text-sm">${this.__('integrations.mqtt.step3')}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="badge badge-primary">4</span>
                                            <span class="text-sm">${this.__('integrations.mqtt.step4')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="integration-info-box">
                                    <p>
                                        <strong>${this.__('integrations.mqtt.lastConnected')}:</strong>
                                        <span id="mqtt-last-connected">${this.__('integrations.mqtt.never')}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadMqttSettings() {
        try {
            const response = await this.app.api.get('/esl/mqtt/settings');
            if (response.success && response.data) {
                this.mqttSettings = response.data;
                this._populateMqttForm(response.data);
            } else {
                // Henüz ayar yok - badge güncelle
                const badge = document.getElementById('mqtt-status-badge');
                if (badge) {
                    badge.textContent = this.__('integrations.mqtt.notConfigured');
                    badge.className = 'badge badge-warning';
                }
            }
        } catch (error) {
            Logger.warn('Failed to load MQTT settings', error);
            const badge = document.getElementById('mqtt-status-badge');
            if (badge) {
                badge.textContent = this.__('integrations.mqtt.notConfigured');
                badge.className = 'badge badge-warning';
            }
        }
    }

    _populateMqttForm(settings) {
        // Bos string ile varsayilan degeri ezme — sadece dolu deger varsa set et
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null && val !== '') el.value = val;
        };
        // Maskeli sifreleri form'a yazma (kullanici degistirmek isterse kendisi yazar)
        const setValSkipMasked = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && val !== '********' && val !== '') el.value = val;
        };

        setVal('mqtt-broker-url', settings.broker_url);
        setVal('mqtt-broker-port', settings.broker_port);
        setVal('mqtt-username', settings.username);
        setValSkipMasked('mqtt-password', settings.password);
        setVal('mqtt-topic-prefix', settings.topic_prefix);
        setVal('mqtt-provider', settings.provider);
        setVal('mqtt-app-id', settings.app_id);
        setValSkipMasked('mqtt-app-secret', settings.app_secret);

        // Content/Report URL'leri: Mevcut origin'den dinamik olustur
        // DB'deki eski deger farkli bir host'a isaret ediyorsa guncel origin ile degistir
        const basePath = window.OmnexConfig?.basePath || '';
        const origin = window.location.origin;
        const currentContentUrl = `${origin}${basePath}/api/esl/mqtt/content`;
        const currentReportUrl = `${origin}${basePath}/api/esl/mqtt/report`;

        // DB'deki URL farkli bir host iceriyorsa mevcut sunucunun URL'ini kullan
        const dbContentUrl = settings.content_server_url || '';
        const dbReportUrl = settings.report_server_url || '';
        const contentUrlToUse = this._shouldUseCurrentOriginUrl(dbContentUrl, currentContentUrl) ? currentContentUrl : dbContentUrl;
        const reportUrlToUse = this._shouldUseCurrentOriginUrl(dbReportUrl, currentReportUrl) ? currentReportUrl : dbReportUrl;

        setVal('mqtt-content-server-url', contentUrlToUse);
        setVal('mqtt-report-server-url', reportUrlToUse);
        setVal('mqtt-status', settings.status);

        // Broker URL: Sadece localhost/127.0.0.1 gibi kesinlikle yanlis degerleri duzelt.
        // Kullanici IP adresi veya farkli domain girdiyse dokunma (cihaz IP ile baglanabilir).
        const currentHostname = window.location.hostname;
        const dbBrokerUrl = settings.broker_url || '';
        const isCurrentLocal = (currentHostname === 'localhost' || currentHostname === '127.0.0.1');
        const isDbLocal = (dbBrokerUrl === 'localhost' || dbBrokerUrl === '127.0.0.1');

        if (!isCurrentLocal && isDbLocal) {
            // Sunucuda acildi ama DB'de localhost var - otomatik duzelt
            const el = document.getElementById('mqtt-broker-url');
            if (el) {
                el.value = currentHostname;
                el.style.borderColor = 'var(--color-warning)';
                el.title = `${this.__('integrations.mqtt.brokerUrlAutoUpdated') || 'Otomatik guncellendi'}: ${dbBrokerUrl} → ${currentHostname}`;
            }
        }

        const tlsCheckbox = document.getElementById('mqtt-use-tls');
        if (tlsCheckbox) tlsCheckbox.checked = !!settings.use_tls;

        // Badge güncelle
        const badge = document.getElementById('mqtt-status-badge');
        if (badge) {
            const isActive = settings.status === 'active' || settings.status === 'testing';
            badge.textContent = isActive ? this.__('integrations.mqtt.configured') : this.__('integrations.mqtt.notConfigured');
            badge.className = isActive ? 'badge badge-success' : 'badge badge-warning';
        }

        // Son bağlantı
        const lastConnected = document.getElementById('mqtt-last-connected');
        if (lastConnected && settings.last_connected) {
            lastConnected.textContent = new Date(settings.last_connected).toLocaleString();
        }
    }

    /**
     * DB'deki URL sadece localhost/127.0.0.1 ise true doner (guncel origin ile degistir).
     * Kullanici IP adresi veya farkli domain girmisse dokunma.
     */
    _shouldUseCurrentOriginUrl(dbUrl, currentUrl) {
        if (!dbUrl) return true; // DB'de yok, mevcut origin kullan
        try {
            const dbHost = new URL(dbUrl).hostname;
            const currentHost = new URL(currentUrl).hostname;
            // Ayni host ise degistirme
            if (dbHost === currentHost) return false;
            // DB'de localhost/127.0.0.1 varsa ve sunucudaysak duzelt
            const isDbLocal = (dbHost === 'localhost' || dbHost === '127.0.0.1');
            const isCurrentLocal = (currentHost === 'localhost' || currentHost === '127.0.0.1');
            if (isDbLocal && !isCurrentLocal) return true;
            // Farkli host ama kullanici bilerek IP veya baska domain girmis, dokunma
            return false;
        } catch {
            return true; // URL parse edilemezse guncel origin kullan
        }
    }

    _getMqttFormData() {
        return {
            broker_url: document.getElementById('mqtt-broker-url')?.value?.trim() || window.location.hostname,
            broker_port: parseInt(document.getElementById('mqtt-broker-port')?.value) || 1883,
            use_tls: document.getElementById('mqtt-use-tls')?.checked ? 1 : 0,
            username: document.getElementById('mqtt-username')?.value?.trim() || '',
            password: document.getElementById('mqtt-password')?.value?.trim() || '',
            topic_prefix: document.getElementById('mqtt-topic-prefix')?.value?.trim() || 'omnex/esl',
            provider: document.getElementById('mqtt-provider')?.value || 'mosquitto',
            app_id: document.getElementById('mqtt-app-id')?.value?.trim() || '',
            app_secret: document.getElementById('mqtt-app-secret')?.value?.trim() || '',
            content_server_url: document.getElementById('mqtt-content-server-url')?.value?.trim() || '',
            report_server_url: document.getElementById('mqtt-report-server-url')?.value?.trim() || '',
            status: document.getElementById('mqtt-status')?.value || 'active'
        };
    }

    async saveMqttSettings() {
        const btn = document.getElementById('save-mqtt-btn');
        if (btn) btn.disabled = true;

        try {
            const data = this._getMqttFormData();
            const response = await this.app.api.put('/esl/mqtt/settings', data);

            if (response.success) {
                Toast.success(this.__('integrations.mqtt.saved'));
                this.mqttSettings = data;
                this._populateMqttForm(data);
            } else {
                Toast.error(response.message || this.__('integrations.mqtt.saveFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.mqtt.saveFailed'));
            Logger.error('Failed to save MQTT settings', error);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async testMqttConnection() {
        const btn = document.getElementById('test-mqtt-btn');
        const resultDiv = document.getElementById('mqtt-test-result');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.mqtt.testing')}`;
        }

        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `<div class="alert alert-info"><i class="ti ti-loader animate-spin"></i> ${this.__('integrations.mqtt.testing')}</div>`;
        }

        try {
            const response = await this.app.api.post('/esl/mqtt/test');

            if (response.success && response.data?.connected) {
                const time = response.data?.response_time || '?';
                const msg = this.__('integrations.mqtt.connectionSuccess', { time });
                if (resultDiv) {
                    resultDiv.innerHTML = `<div class="alert alert-success"><i class="ti ti-check"></i> ${msg}</div>`;
                }
                Toast.success(msg);

                // Badge güncelle
                const badge = document.getElementById('mqtt-status-badge');
                if (badge) {
                    badge.textContent = this.__('integrations.mqtt.configured');
                    badge.className = 'badge badge-success';
                }
            } else {
                const errMsg = response.data?.message || response.message || this.__('integrations.mqtt.connectionFailed');
                if (resultDiv) {
                    resultDiv.innerHTML = `<div class="alert alert-danger"><i class="ti ti-x"></i> ${errMsg}</div>`;
                }
                Toast.error(errMsg);
            }
        } catch (error) {
            const errMsg = this.__('integrations.mqtt.connectionFailed');
            if (resultDiv) {
                resultDiv.innerHTML = `<div class="alert alert-danger"><i class="ti ti-x"></i> ${errMsg}: ${error.message || ''}</div>`;
            }
            Toast.error(errMsg);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('integrations.mqtt.testConnection')}`;
            }
        }
    }

    // =========================================
    // Payment Tab Methods (SuperAdmin Only)
    // =========================================

    renderPaymentTab() {
        return `
            <!-- Payment Tab (SuperAdmin Only) -->
            <div id="tab-payment" class="settings-tab-content ${this.activeTab === 'payment' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- Payment Provider Selection Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-credit-card"></i>
                                ${this.__('integrations.payment.title')}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span id="payment-status-badge" class="badge badge-secondary">${this.__('integrations.payment.loading')}</span>
                            </div>
                        </div>
                        <div class="chart-card-body">
                            <div class="alert alert-warning mb-4">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-lock"></i>
                                    <span><strong>${this.__('actions.important')}:</strong> ${this.__('integrations.payment.adminOnly')}</span>
                                </div>
                            </div>

                            <!-- Provider Selection -->
                            <div class="payment-provider-selector mb-4">
                                <label class="form-label mb-2">${this.__('integrations.payment.selectProvider')}</label>
                                <div class="provider-cards">
                                    <label class="provider-card ${this.selectedPaymentProvider === 'iyzico' ? 'active' : ''}" data-provider="iyzico">
                                        <input type="radio" name="payment_provider" value="iyzico" ${this.selectedPaymentProvider === 'iyzico' ? 'checked' : ''}>
                                        <div class="provider-card-content">
                                            <div class="provider-logo">
                                                <i class="ti ti-credit-card text-2xl"></i>
                                            </div>
                                            <div class="provider-info">
                                                <h4>Iyzico</h4>
                                                <p class="text-sm text-muted">${this.__('integrations.payment.providers.iyzico.description')}</p>
                                                <div class="provider-status" id="iyzico-provider-status">
                                                    <span class="badge badge-secondary">-</span>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                    <label class="provider-card ${this.selectedPaymentProvider === 'paynet' ? 'active' : ''}" data-provider="paynet">
                                        <input type="radio" name="payment_provider" value="paynet" ${this.selectedPaymentProvider === 'paynet' ? 'checked' : ''}>
                                        <div class="provider-card-content">
                                            <div class="provider-logo">
                                                <i class="ti ti-wallet text-2xl"></i>
                                            </div>
                                            <div class="provider-info">
                                                <h4>Paynet</h4>
                                                <p class="text-sm text-muted">${this.__('integrations.payment.providers.paynet.description')}</p>
                                                <div class="provider-status" id="paynet-provider-status">
                                                    <span class="badge badge-secondary">-</span>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- Connection Status -->
                            <div id="payment-connection-status" class="alert alert-info mb-4">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-loader animate-spin"></i>
                                    <span>${this.__('integrations.payment.connectionStatus')}</span>
                                </div>
                            </div>

                            <!-- Iyzico Settings Form -->
                            <div id="iyzico-settings-form" class="provider-settings-form ${this.selectedPaymentProvider === 'iyzico' ? '' : 'hidden'}">
                                <h4 class="font-medium mb-3 flex items-center gap-2">
                                    <i class="ti ti-settings"></i>
                                    ${this.__('integrations.payment.fields.iyzicoSettings')}
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">API Key</label>
                                        <input type="text" id="iyzico_api_key" class="form-input"
                                            placeholder="sandbox-... veya production API key">
                                        <small class="form-hint">${this.__('integrations.payment.hints.iyzicoMerchant')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Secret Key</label>
                                        <div class="flex gap-2">
                                            <input type="password" id="iyzico_secret_key" class="form-input flex-1"
                                                placeholder="Secret key giriniz">
                                            <button type="button" class="btn btn-outline toggle-secret-btn" data-target="iyzico_secret_key">
                                                <i class="ti ti-eye"></i>
                                            </button>
                                        </div>
                                        <small class="form-hint">${this.__('integrations.payment.hints.secretKey')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.environment')}</label>
                                        <select id="iyzico_environment" class="form-select">
                                            <option value="sandbox">${this.__('integrations.payment.environments.sandbox')}</option>
                                            <option value="production">${this.__('integrations.payment.environments.production')}</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.currency')}</label>
                                        <select id="iyzico_currency" class="form-select">
                                            <option value="TRY">${this.__('integrations.payment.currencies.TRY')}</option>
                                            <option value="USD">${this.__('integrations.payment.currencies.USD')}</option>
                                            <option value="EUR">${this.__('integrations.payment.currencies.EUR')}</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Callback URL</label>
                                        <input type="text" id="iyzico_callback_url" class="form-input"
                                            value="${escapeHTML(window.location.origin)}${escapeHTML(window.OmnexConfig?.basePath || '')}/api/payments/callback-3d" readonly>
                                        <small class="form-hint">${this.__('integrations.payment.hints.callbackReadonly')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.installmentSettings')}</label>
                                        <div class="space-y-2">
                                            <label class="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" id="iyzico_installment_enabled" class="form-checkbox" checked>
                                                <span>${this.__('integrations.payment.fields.installmentActive')}</span>
                                            </label>
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm">${this.__('integrations.payment.fields.maxInstallment')}</span>
                                                <select id="iyzico_max_installments" class="form-select" style="width: auto;">
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="6">6</option>
                                                    <option value="9">9</option>
                                                    <option value="12" selected>12</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.status')}</label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="iyzico_status_active" class="form-checkbox">
                                            <span>${this.__('integrations.payment.fields.iyzicoActive')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Paynet Settings Form -->
                            <div id="paynet-settings-form" class="provider-settings-form ${this.selectedPaymentProvider === 'paynet' ? '' : 'hidden'}">
                                <h4 class="font-medium mb-3 flex items-center gap-2">
                                    <i class="ti ti-settings"></i>
                                    ${this.__('integrations.payment.fields.paynetSettings')}
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">Publishable Key</label>
                                        <input type="text" id="paynet_publishable_key" class="form-input"
                                            placeholder="pbk_...">
                                        <small class="form-hint">${this.__('integrations.payment.hints.paynetMerchant')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Secret Key</label>
                                        <div class="flex gap-2">
                                            <input type="password" id="paynet_secret_key" class="form-input flex-1"
                                                placeholder="sck_...">
                                            <button type="button" class="btn btn-outline toggle-secret-btn" data-target="paynet_secret_key">
                                                <i class="ti ti-eye"></i>
                                            </button>
                                        </div>
                                        <small class="form-hint">${this.__('integrations.payment.hints.secretKeyHint')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.testMode')}</label>
                                        <select id="paynet_test_mode" class="form-select">
                                            <option value="1">${this.__('integrations.payment.environments.testMode')}</option>
                                            <option value="0">${this.__('integrations.payment.environments.liveMode')}</option>
                                        </select>
                                        <small class="form-hint">${this.__('integrations.payment.hints.testModeHint')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">API URL</label>
                                        <input type="text" id="paynet_api_url" class="form-input"
                                            value="https://pts-api.paynet.com.tr" placeholder="https://pts-api.paynet.com.tr">
                                        <small class="form-hint">Paynet API adresi</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Callback URL</label>
                                        <input type="text" id="paynet_callback_url" class="form-input"
                                            value="${escapeHTML(window.location.origin)}${escapeHTML(window.OmnexConfig?.basePath || '')}/api/payments/callback" readonly>
                                        <small class="form-hint">${this.__('integrations.payment.hints.callbackReadonly')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.installmentSettings')}</label>
                                        <div class="space-y-2">
                                            <label class="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" id="paynet_installment_enabled" class="form-checkbox" checked>
                                                <span>${this.__('integrations.payment.fields.installmentActive')}</span>
                                            </label>
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm">${this.__('integrations.payment.fields.maxInstallment')}</span>
                                                <select id="paynet_max_installments" class="form-select" style="width: auto;">
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="6">6</option>
                                                    <option value="9">9</option>
                                                    <option value="12" selected>12</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('integrations.payment.fields.status')}</label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id="paynet_status_active" class="form-checkbox">
                                            <span>${this.__('integrations.payment.fields.paynetActive')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-2 mt-4">
                                <button type="button" id="test-payment-btn" class="btn btn-outline">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('integrations.payment.buttons.testConnection')}
                                </button>
                                <button type="button" id="save-payment-btn" class="btn btn-primary">
                                    <i class="ti ti-check"></i>
                                    ${this.__('integrations.payment.buttons.save')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Payment Info Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('integrations.paymentInfo.title')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="integration-info-list">
                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.paymentInfo.features.title')}</h4>
                                    <ul>
                                        <li>${this.__('integrations.paymentInfo.features.singlePayment')}</li>
                                        <li>${this.__('integrations.paymentInfo.features.installment')}</li>
                                        <li>${this.__('integrations.paymentInfo.features.secure3d')}</li>
                                        <li>${this.__('integrations.paymentInfo.features.refund')}</li>
                                        <li>${this.__('integrations.paymentInfo.features.cardSaving')}</li>
                                    </ul>
                                </div>

                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.paymentInfo.cards.title')}</h4>
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <span class="badge badge-primary">Visa</span>
                                        <span class="badge badge-primary">MasterCard</span>
                                        <span class="badge badge-primary">Troy</span>
                                        <span class="badge badge-primary">Amex</span>
                                    </div>
                                </div>

                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.paymentInfo.testCard.title')}</h4>
                                    <p><strong>${this.__('integrations.paymentInfo.testCard.cardNo')}</strong> 5528 7900 0000 0008</p>
                                    <p><strong>${this.__('integrations.paymentInfo.testCard.expiry')}</strong> 12/30</p>
                                    <p><strong>${this.__('integrations.paymentInfo.testCard.cvv')}</strong> 123</p>
                                </div>

                                <div class="integration-info-box">
                                    <h4>${this.__('integrations.paymentInfo.docs.title')}</h4>
                                    <a href="https://dev.iyzipay.com/" target="_blank">
                                        <i class="ti ti-external-link"></i>
                                        ${this.__('integrations.paymentInfo.docs.iyzicoLink')}
                                    </a>
                                    <a href="https://doc.paynet.com.tr/" target="_blank">
                                        <i class="ti ti-external-link"></i>
                                        ${this.__('integrations.paymentInfo.docs.paynetLink')}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadPaymentSettings() {
        try {
            // Load Iyzico settings
            const iyzicoResponse = await this.app.api.get('/payments/settings?provider=iyzico');
            if (iyzicoResponse.success && iyzicoResponse.data) {
                this.iyzicoSettings = iyzicoResponse.data.settings || {};
                this.paymentPlans = iyzicoResponse.data.plans || [];
            }

            // Load Paynet settings
            const paynetResponse = await this.app.api.get('/payments/settings?provider=paynet');
            if (paynetResponse.success && paynetResponse.data) {
                this.paynetSettings = paynetResponse.data.settings || {};
            }

            // Populate forms
            this.populatePaymentForm();
            this.updatePaymentStatus();
            this.renderLicensePlans();
        } catch (error) {
            Logger.warn('Payment settings not available:', error);
            this.updatePaymentConnectionStatus(false, this.__('integrations.messages.settingsLoadFailed'));
        }
    }

    populatePaymentForm() {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = value;
        };

        const setSelected = (id, value) => {
            const el = document.getElementById(id);
            if (el && value) el.value = value;
        };

        // Populate Iyzico form
        const iyzico = this.iyzicoSettings;
        setValue('iyzico_api_key', iyzico.api_key);
        setSelected('iyzico_environment', iyzico.environment || 'sandbox');
        setSelected('iyzico_currency', iyzico.currency || 'TRY');
        setChecked('iyzico_installment_enabled', iyzico.installment_enabled !== false);
        setSelected('iyzico_max_installments', iyzico.max_installments || 12);
        setChecked('iyzico_status_active', iyzico.status === 'active');

        // Secret key placeholder for Iyzico
        const iyzicoSecretInput = document.getElementById('iyzico_secret_key');
        if (iyzicoSecretInput && iyzico.has_secret_key) {
            iyzicoSecretInput.placeholder = '******** (Mevcut)';
        }

        // Populate Paynet form
        const paynet = this.paynetSettings;
        setValue('paynet_publishable_key', paynet.publishable_key || paynet.api_key);
        setSelected('paynet_test_mode', paynet.test_mode !== undefined ? (paynet.test_mode ? '1' : '0') : '1');
        setValue('paynet_api_url', paynet.api_url || 'https://pts-api.paynet.com.tr');
        setChecked('paynet_installment_enabled', paynet.installment_enabled !== false);
        setSelected('paynet_max_installments', paynet.max_installments || 12);
        setChecked('paynet_status_active', paynet.status === 'active');

        // Secret key placeholder for Paynet
        const paynetSecretInput = document.getElementById('paynet_secret_key');
        if (paynetSecretInput && paynet.has_secret_key) {
            paynetSecretInput.placeholder = '******** (Mevcut)';
        }
    }

    updatePaymentStatus() {
        const badge = document.getElementById('payment-status-badge');
        if (badge) {
            const iyzicoActive = this.iyzicoSettings.status === 'active';
            const paynetActive = this.paynetSettings.status === 'active';

            if (iyzicoActive || paynetActive) {
                badge.className = 'badge badge-success';
                const providers = [];
                if (iyzicoActive) providers.push('Iyzico');
                if (paynetActive) providers.push('Paynet');
                badge.textContent = providers.join(' + ') + ' Aktif';
            } else {
                badge.className = 'badge badge-secondary';
                badge.textContent = 'Pasif';
            }
        }

        // Update provider status badges
        this.updateProviderStatusBadge('iyzico', this.iyzicoSettings);
        this.updateProviderStatusBadge('paynet', this.paynetSettings);

        // Update connection status
        this.updatePaymentConnectionStatus();
    }

    updateProviderStatusBadge(provider, settings) {
        const statusEl = document.getElementById(`${provider}-provider-status`);
        if (!statusEl) return;

        const testLabel = this.__('integrations.payment.providerStatus.test');
        const liveLabel = this.__('integrations.payment.providerStatus.live');
        const inactiveLabel = this.__('integrations.payment.providerStatus.inactive');
        const notConfiguredLabel = this.__('integrations.payment.providerStatus.notConfigured');

        if (settings.status === 'active') {
            const isTest = provider === 'iyzico'
                ? settings.environment === 'sandbox'
                : settings.test_mode;
            statusEl.innerHTML = `<span class="badge badge-success">${isTest ? testLabel : liveLabel}</span>`;
        } else if (settings.api_key || settings.publishable_key || settings.has_secret_key) {
            statusEl.innerHTML = `<span class="badge badge-secondary">${inactiveLabel}</span>`;
        } else {
            statusEl.innerHTML = `<span class="badge badge-outline">${notConfiguredLabel}</span>`;
        }
    }

    updatePaymentConnectionStatus() {
        const statusEl = document.getElementById('payment-connection-status');
        if (!statusEl) return;

        const iyzicoConfigured = this.iyzicoSettings.has_secret_key && this.iyzicoSettings.api_key;
        const paynetConfigured = this.paynetSettings.has_secret_key && (this.paynetSettings.publishable_key || this.paynetSettings.api_key);

        if (iyzicoConfigured || paynetConfigured) {
            const providers = [];
            if (iyzicoConfigured) providers.push('Iyzico');
            if (paynetConfigured) providers.push('Paynet');

            statusEl.className = 'alert alert-success mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-circle-check"></i>
                    <span>${this.__('integrations.messages.paymentConfigured', { providers: providers.join(' ve ') })}</span>
                </div>
            `;
        } else {
            statusEl.className = 'alert alert-warning mb-4';
            statusEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="ti ti-alert-triangle"></i>
                    <span>${this.__('integrations.messages.noPaymentConfigured')}</span>
                </div>
            `;
        }
    }

    switchPaymentProvider(provider) {
        this.selectedPaymentProvider = provider;

        // Update provider cards
        document.querySelectorAll('.provider-card').forEach(card => {
            card.classList.toggle('active', card.dataset.provider === provider);
        });

        // Show/hide settings forms
        document.getElementById('iyzico-settings-form')?.classList.toggle('hidden', provider !== 'iyzico');
        document.getElementById('paynet-settings-form')?.classList.toggle('hidden', provider !== 'paynet');
    }

    renderLicensePlans() {
        const container = document.getElementById('license-plans-list');
        if (!container) return;

        if (!this.paymentPlans.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('integrations.licensePlans.empty')}
                </div>
            `;
            return;
        }

        container.innerHTML = this.paymentPlans.map(plan => `
            <div class="p-3 border rounded-lg ${plan.is_popular ? 'border-primary bg-primary bg-opacity-5' : ''}" data-plan-id="${escapeHTML(plan.id)}">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium flex items-center gap-2">
                            ${escapeHTML(plan.name)}
                            ${plan.is_popular ? `<span class="badge badge-primary text-xs">${this.__('integrations.licensePlans.recommended')}</span>` : ''}
                            ${plan.is_enterprise ? `<span class="badge badge-warning text-xs">${this.__('integrations.licensePlans.enterprise')}</span>` : ''}
                            ${!plan.is_active ? `<span class="badge badge-secondary text-xs">${this.__('integrations.licensePlans.inactive')}</span>` : ''}
                        </h4>
                        <p class="text-sm text-muted">${escapeHTML(plan.description || '')}</p>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="text-right">
                            <div class="font-bold text-lg">${this.formatPrice(plan.price, plan.currency)}</div>
                            <div class="text-xs text-muted">${plan.duration_months || 1} ${this.__('integrations.licensePlans.months')}</div>
                        </div>
                        <div class="flex gap-1">
                            <button type="button" class="btn btn-ghost btn-sm edit-plan-btn" data-plan-id="${escapeHTML(plan.id)}" title="${this.__('actions.edit')}">
                                <i class="ti ti-edit"></i>
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm text-danger delete-plan-btn" data-plan-id="${escapeHTML(plan.id)}" title="${this.__('actions.delete')}">
                                <i class="ti ti-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="license-plan-stats">
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_users === -1 || plan.max_users === 0 ? '∞' : plan.max_users}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.users')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_devices === -1 || plan.max_devices === 0 ? '∞' : plan.max_devices}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.devices')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_products === -1 || plan.max_products === 0 ? '∞' : plan.max_products}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.products')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_templates === -1 || plan.max_templates === 0 ? '∞' : plan.max_templates}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.templates')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_branches === -1 || plan.max_branches === 0 || plan.max_branches === undefined ? '∞' : plan.max_branches}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.branches')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${!plan.storage_limit || plan.storage_limit <= 0 ? '∞' : (plan.storage_limit >= 1024 ? Math.round(plan.storage_limit / 1024) + ' GB' : plan.storage_limit + ' MB')}</div>
                        <div class="stat-label">${this.__('integrations.licensePlans.limits.storage')}</div>
                    </div>
                </div>
                ${plan.features?.length ? `
                <div class="mt-2 flex flex-wrap gap-1">
                    ${plan.features.slice(0, 5).map(f => `<span class="badge badge-outline text-xs">${this.__('integrations.licensePlans.features.' + f) || escapeHTML(f)}</span>`).join('')}
                    ${plan.features.length > 5 ? `<span class="badge badge-outline text-xs">+${plan.features.length - 5}</span>` : ''}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Bind edit/delete button events
        container.querySelectorAll('.edit-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.currentTarget.dataset.planId;
                this.showEditPlanModal(planId);
            });
        });

        container.querySelectorAll('.delete-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.currentTarget.dataset.planId;
                this.deletePlan(planId);
            });
        });
    }

    formatPrice(price, currency = 'TRY') {
        const num = parseFloat(price) || 0;
        const symbols = { TRY: '₺', USD: '$', EUR: '€' };
        return `${symbols[currency] || ''}${num.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    }

    async testPaymentConnection() {
        const btn = document.getElementById('test-payment-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.payment.testing')}`;
        }

        const provider = this.selectedPaymentProvider;

        try {
            const response = await this.app.api.get(`/payments/ping?provider=${provider}`);
            if (response.success && response.data?.success) {
                const envLabel = provider === 'iyzico'
                    ? (response.data.environment === 'sandbox' ? 'Sandbox' : 'Production')
                    : (response.data.test_mode ? 'Test' : this.__('integrations.payment.providerStatus.live'));
                Toast.success(this.__('integrations.payment.connectionSuccess', { provider: provider.charAt(0).toUpperCase() + provider.slice(1), env: envLabel }));

                // Update the provider status badge
                if (provider === 'iyzico') {
                    this.iyzicoSettings.status = 'active';
                } else {
                    this.paynetSettings.status = 'active';
                }
                this.updateProviderStatusBadge(provider, provider === 'iyzico' ? this.iyzicoSettings : this.paynetSettings);
            } else {
                Toast.error(this.__('integrations.payment.connectionFailed', { provider: provider.charAt(0).toUpperCase() + provider.slice(1), error: response.data?.message || response.message || this.__('messages.unknownError') }));
            }
        } catch (error) {
            Toast.error(this.__('integrations.payment.connectionTestFailed', { error: error.message }));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-plug"></i> ${this.__('integrations.payment.buttons.testConnection')}`;
            }
        }
    }

    async savePaymentSettings() {
        const getValue = (id) => document.getElementById(id)?.value;
        const getChecked = (id) => document.getElementById(id)?.checked;

        const provider = this.selectedPaymentProvider;
        let data = { provider };

        if (provider === 'iyzico') {
            const apiKey = getValue('iyzico_api_key');
            const secretKey = getValue('iyzico_secret_key');
            const isActive = getChecked('iyzico_status_active');

            // Validate if activating
            if (isActive) {
                if (!apiKey) {
                    Toast.error(this.__('integrations.payment.validation.apiKeyRequired'));
                    return;
                }
                if (!secretKey && !this.iyzicoSettings.has_secret_key) {
                    Toast.error(this.__('integrations.payment.validation.secretKeyRequired'));
                    return;
                }
            }

            data = {
                ...data,
                api_key: apiKey || '',
                environment: getValue('iyzico_environment') || 'sandbox',
                currency: getValue('iyzico_currency') || 'TRY',
                installment_enabled: getChecked('iyzico_installment_enabled'),
                max_installments: parseInt(getValue('iyzico_max_installments')) || 12,
                status: isActive ? 'active' : 'inactive'
            };

            // Only include secret key if entered (not placeholder)
            if (secretKey && !secretKey.includes('*')) {
                data.secret_key = secretKey;
            }
        } else if (provider === 'paynet') {
            const publishableKey = getValue('paynet_publishable_key');
            const secretKey = getValue('paynet_secret_key');
            const isActive = getChecked('paynet_status_active');

            // Validate if activating
            if (isActive) {
                if (!publishableKey) {
                    Toast.error(this.__('integrations.payment.validation.publishableKeyRequired'));
                    return;
                }
                if (!secretKey && !this.paynetSettings.has_secret_key) {
                    Toast.error(this.__('integrations.payment.validation.secretKeyRequired'));
                    return;
                }
            }

            data = {
                ...data,
                publishable_key: publishableKey || '',
                api_url: getValue('paynet_api_url') || 'https://pts-api.paynet.com.tr',
                test_mode: getValue('paynet_test_mode') === '1',
                installment_enabled: getChecked('paynet_installment_enabled'),
                max_installments: parseInt(getValue('paynet_max_installments')) || 12,
                status: isActive ? 'active' : 'inactive'
            };

            // Only include secret key if entered (not placeholder)
            if (secretKey && !secretKey.includes('*')) {
                data.secret_key = secretKey;
            }
        }

        const btn = document.getElementById('save-payment-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            const response = await this.app.api.put('/payments/settings', data);
            if (response.success) {
                Toast.success(this.__('integrations.payment.saveSuccess', { provider: provider.charAt(0).toUpperCase() + provider.slice(1) }));
                // Reload settings to get updated state
                await this.loadPaymentSettings();
            } else {
                throw new Error(response.message || this.__('messages.saveFailed'));
            }
        } catch (error) {
            Toast.error(this.__('integrations.payment.saveFailed', { error: error.message }));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> ${this.__('actions.save')}`;
            }
        }
    }

    toggleSecretKeyVisibility(targetId = null) {
        // targetId can be 'iyzico_secret_key' or 'paynet_secret_key'
        const inputId = targetId || 'iyzico_secret_key';
        const input = document.getElementById(inputId);
        const btn = document.querySelector(`.toggle-secret-btn[data-target="${inputId}"]`);

        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.innerHTML = '<i class="ti ti-eye-off"></i>';
        } else {
            input.type = 'password';
            if (btn) btn.innerHTML = '<i class="ti ti-eye"></i>';
        }
    }

    // =====================
    // License Plan CRUD
    // =====================

    showCreatePlanModal() {
        this.showPlanModal(null);
    }

    async showEditPlanModal(planId) {
        const plan = this.paymentPlans.find(p => p.id === planId);
        if (!plan) {
            Toast.error(this.__('integrations.licensePlans.notFound'));
            return;
        }
        this.showPlanModal(plan);
    }

    showPlanModal(plan = null) {
        const isEdit = !!plan;
        const title = isEdit
            ? this.__('integrations.licensePlans.editPlan')
            : this.__('integrations.licensePlans.addPlan');

        const featuresValue = plan?.features ? plan.features.join('\n') : '';

        const content = `
            <form id="plan-form" class="space-y-4">
                <input type="hidden" id="plan-id" value="${escapeHTML(plan?.id || '')}">

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.name')} *</label>
                        <input type="text" id="plan-name" class="form-input" value="${escapeHTML(plan?.name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.slug')}</label>
                        <input type="text" id="plan-slug" class="form-input" value="${escapeHTML(plan?.slug || '')}" placeholder="${this.__('integrations.licensePlans.form.slugPlaceholder')}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('integrations.licensePlans.form.description')}</label>
                    <textarea id="plan-description" class="form-input" rows="2">${escapeHTML(plan?.description || '')}</textarea>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.price')} *</label>
                        <input type="number" id="plan-price" class="form-input" value="${plan?.price || 0}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.currency')}</label>
                        <select id="plan-currency" class="form-select">
                            <option value="TRY" ${plan?.currency === 'TRY' ? 'selected' : ''}>TRY (₺)</option>
                            <option value="USD" ${plan?.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="EUR" ${plan?.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.duration')}</label>
                        <input type="number" id="plan-duration" class="form-input" value="${plan?.duration_months || 1}" min="1" max="120">
                    </div>
                </div>

                <div class="grid grid-cols-5 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.maxUsers')}</label>
                        <input type="number" id="plan-max-users" class="form-input" value="${plan?.max_users ?? 1}" min="-1">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimited')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.maxDevices')}</label>
                        <input type="number" id="plan-max-devices" class="form-input" value="${plan?.max_devices ?? 10}" min="-1">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimited')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.maxProducts')}</label>
                        <input type="number" id="plan-max-products" class="form-input" value="${plan?.max_products ?? 100}" min="-1">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimited')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.maxTemplates')}</label>
                        <input type="number" id="plan-max-templates" class="form-input" value="${plan?.max_templates ?? 10}" min="-1">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimited')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.maxBranches')}</label>
                        <input type="number" id="plan-max-branches" class="form-input" value="${plan?.max_branches ?? 1}" min="-1">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimited')}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('integrations.licensePlans.form.storageLimit')}</label>
                        <input type="number" id="plan-storage-limit" class="form-input" value="${plan?.storage_limit ?? 1024}" min="0">
                        <small class="text-muted text-xs">${this.__('integrations.licensePlans.form.unlimitedZero')}</small>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('integrations.licensePlans.form.features')}</label>
                    <div class="features-checkbox-grid">
                        ${this.renderFeatureCheckboxes(plan?.features || [])}
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="form-group">
                        <label class="form-label flex items-center gap-2">
                            <input type="checkbox" id="plan-is-popular" class="form-checkbox" ${plan?.is_popular ? 'checked' : ''}>
                            ${this.__('integrations.licensePlans.form.isPopular')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label flex items-center gap-2">
                            <input type="checkbox" id="plan-is-enterprise" class="form-checkbox" ${plan?.is_enterprise ? 'checked' : ''}>
                            ${this.__('integrations.licensePlans.form.isEnterprise')}
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label flex items-center gap-2">
                            <input type="checkbox" id="plan-is-active" class="form-checkbox" ${plan?.is_active !== false ? 'checked' : ''}>
                            ${this.__('integrations.licensePlans.form.isActive')}
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('integrations.licensePlans.form.sortOrder')}</label>
                    <input type="number" id="plan-sort-order" class="form-input" value="${plan?.sort_order || 0}" min="0">
                </div>
            </form>
        `;

        Modal.show({
            title: title,
            icon: 'ti-license',
            content: content,
            size: 'lg',
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.savePlan();
            }
        });
    }

    async savePlan() {
        const planId = document.getElementById('plan-id')?.value;
        const name = document.getElementById('plan-name')?.value?.trim();
        const price = parseFloat(document.getElementById('plan-price')?.value) || 0;

        if (!name) {
            Toast.error(this.__('integrations.licensePlans.validation.nameRequired'));
            throw new Error('Validation failed');
        }

        // Collect selected features from checkboxes
        const featureCheckboxes = document.querySelectorAll('.feature-checkbox:checked');
        const features = Array.from(featureCheckboxes).map(cb => cb.value);

        // Helper function to parse int with proper 0 handling
        // 0 means "unlimited" for limit fields, so we must not replace it with default
        const parseIntSafe = (value, defaultValue) => {
            const parsed = parseInt(value);
            return isNaN(parsed) ? defaultValue : parsed;
        };

        const data = {
            name: name,
            slug: document.getElementById('plan-slug')?.value?.trim() || '',
            description: document.getElementById('plan-description')?.value?.trim() || '',
            price: price,
            currency: document.getElementById('plan-currency')?.value || 'TRY',
            duration_months: parseIntSafe(document.getElementById('plan-duration')?.value, 1),
            max_users: parseIntSafe(document.getElementById('plan-max-users')?.value, 1),
            max_devices: parseIntSafe(document.getElementById('plan-max-devices')?.value, 10),
            max_products: parseIntSafe(document.getElementById('plan-max-products')?.value, 100),
            max_templates: parseIntSafe(document.getElementById('plan-max-templates')?.value, 10),
            max_branches: parseIntSafe(document.getElementById('plan-max-branches')?.value, 1),
            storage_limit: parseIntSafe(document.getElementById('plan-storage-limit')?.value, 0),
            features: features,
            is_popular: document.getElementById('plan-is-popular')?.checked || false,
            is_enterprise: document.getElementById('plan-is-enterprise')?.checked || false,
            is_active: document.getElementById('plan-is-active')?.checked || false,
            sort_order: parseIntSafe(document.getElementById('plan-sort-order')?.value, 0)
        };

        try {
            let response;
            if (planId) {
                response = await this.app.api.put(`/payments/license-plans/${planId}`, data);
            } else {
                response = await this.app.api.post('/payments/license-plans', data);
            }

            if (response.success) {
                Toast.success(planId
                    ? this.__('integrations.licensePlans.updated')
                    : this.__('integrations.licensePlans.created'));
                await this.loadPaymentSettings();
                this.renderLicensePlans();
            } else {
                throw new Error(response.message || this.__('messages.operationFailed'));
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.error'));
            throw error;
        }
    }

    async deletePlan(planId) {
        const plan = this.paymentPlans.find(p => p.id === planId);
        if (!plan) return;

        Modal.confirm({
            title: this.__('integrations.licensePlans.deleteConfirm.title'),
            message: this.__('integrations.licensePlans.deleteConfirm.message', { name: plan.name }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete(`/payments/license-plans/${planId}`);
                    if (response.success) {
                        Toast.success(this.__('integrations.licensePlans.deleted'));
                        await this.loadPaymentSettings();
                        this.renderLicensePlans();
                    } else {
                        throw new Error(response.message || this.__('messages.deleteFailed'));
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                }
            }
        });
    }

    /**
     * Render feature checkboxes for license plan modal
     * @param {Array} selectedFeatures - Currently selected features
     * @returns {string} HTML string of feature checkboxes
     */
    renderFeatureCheckboxes(selectedFeatures = []) {
        // All available features from translations
        const allFeatures = [
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
            'unlimited_users',
            'unlimited_devices',
            'analytics',
            'export_reports',
            'bulk_import',
            'scheduler',
            'notifications'
        ];

        return allFeatures.map(feature => {
            const isChecked = selectedFeatures.includes(feature);
            const label = this.__(`integrations.licensePlans.features.${feature}`);
            return `
                <label class="feature-checkbox-item">
                    <input type="checkbox" class="feature-checkbox" value="${feature}" ${isChecked ? 'checked' : ''}>
                    <span class="feature-checkbox-label">${label}</span>
                </label>
            `;
        }).join('');
    }

    // ========== PriceView (FiyatGör) Tab ==========

    renderPriceviewTab() {
        const s = this.priceviewSettings;
        const templateOptions = this.priceviewTemplates.map(t =>
            `<option value="${t.id}" ${s.product_display_template === t.id ? 'selected' : ''}>${this._escapeHtml(t.name)}</option>`
        ).join('');
        const printTemplateOptions = this.priceviewTemplates.map(t =>
            `<option value="${t.id}" ${s.default_template === t.id ? 'selected' : ''}>${this._escapeHtml(t.name)}</option>`
        ).join('');

        return `
            <!-- PriceView Tab -->
            <div id="tab-priceview" class="settings-tab-content ${this.activeTab === 'priceview' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- Sync Settings Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-refresh"></i>
                                ${this.__('integrations.priceview.syncSettings')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.syncInterval')}</label>
                                    <input type="number" id="pv-sync-interval" class="form-input"
                                        min="1" max="1440" value="${s.sync_interval || 30}">
                                    <small class="form-hint">${this.__('integrations.priceview.hints.syncInterval')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.autoSync')}</label>
                                    <div class="flex items-center gap-2 mt-2">
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="pv-auto-sync" ${s.auto_sync !== false ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Display Settings Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-eye"></i>
                                ${this.__('integrations.priceview.displaySettings')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.overlayTimeout')}</label>
                                    <input type="number" id="pv-overlay-timeout" class="form-input"
                                        min="3" max="120" value="${s.overlay_timeout || 10}">
                                    <small class="form-hint">${this.__('integrations.priceview.hints.overlayTimeout')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.fontSize')}</label>
                                    <input type="number" id="pv-font-size" class="form-input"
                                        min="1.0" max="2.0" step="0.1" value="${s.font_size_multiplier || 1.0}">
                                    <small class="form-hint">${this.__('integrations.priceview.hints.fontSize')}</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.displayTemplate')}</label>
                                    <select id="pv-display-template" class="form-select">
                                        <option value="">${this.__('integrations.priceview.hints.displayTemplate')}</option>
                                        ${templateOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.signageEnabled')}</label>
                                    <div class="flex items-center gap-2 mt-2">
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="pv-signage-enabled" ${s.signage_enabled !== false ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Print Settings Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-printer"></i>
                                ${this.__('integrations.priceview.printSettings')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.printEnabled')}</label>
                                    <div class="flex items-center gap-2 mt-2">
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="pv-print-enabled" ${s.print_enabled !== false ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.fields.defaultPrintTemplate')}</label>
                                    <select id="pv-default-template" class="form-select">
                                        <option value="">${this.__('integrations.priceview.hints.displayTemplate')}</option>
                                        ${printTemplateOptions}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Status Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('integrations.priceview.statusInfo')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.status.lastSync')}</label>
                                    <p id="pv-last-sync" class="text-muted">-</p>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.status.productCount')}</label>
                                    <p id="pv-product-count" class="text-muted">-</p>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('integrations.priceview.status.deviceCount')}</label>
                                    <p id="pv-device-count" class="text-muted">-</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 mt-4">
                    <button id="sync-priceview-btn" class="btn btn-outline">
                        <i class="ti ti-refresh"></i>
                        ${this.__('integrations.priceview.buttons.syncNow')}
                    </button>
                    <button id="save-priceview-btn" class="btn btn-primary">
                        <i class="ti ti-device-floppy"></i>
                        ${this.__('integrations.priceview.buttons.save')}
                    </button>
                </div>
            </div>
        `;
    }

    async loadPriceviewSettings() {
        try {
            const response = await this.app.api.get('/settings');
            const data = response.data?.data || response.data || {};
            this.priceviewSettings = {
                sync_interval: data.priceview_sync_interval || 30,
                auto_sync: data.priceview_auto_sync !== false,
                overlay_timeout: data.priceview_overlay_timeout || 10,
                print_enabled: data.priceview_print_enabled !== false,
                signage_enabled: data.priceview_signage_enabled !== false,
                default_template: data.priceview_default_template || '',
                font_size_multiplier: data.priceview_font_size_multiplier || 1.0,
                product_display_template: data.priceview_product_display_template || ''
            };

            // Load templates for dropdowns
            try {
                const templatesRes = await this.app.api.get('/templates');
                const templates = templatesRes.data?.data || templatesRes.data || [];
                this.priceviewTemplates = Array.isArray(templates) ? templates : [];
            } catch (e) {
                Logger.warn('Failed to load templates for PriceView', e);
                this.priceviewTemplates = [];
            }

            // Populate form fields
            this._populatePriceviewForm();

            // Load status info
            this._loadPriceviewStatus(data);
        } catch (e) {
            Logger.warn('Failed to load PriceView settings', e);
        }
    }

    _populatePriceviewForm() {
        const s = this.priceviewSettings;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        setVal('pv-sync-interval', s.sync_interval);
        setVal('pv-overlay-timeout', s.overlay_timeout);
        setVal('pv-font-size', s.font_size_multiplier);
        setChecked('pv-auto-sync', s.auto_sync);
        setChecked('pv-print-enabled', s.print_enabled);
        setChecked('pv-signage-enabled', s.signage_enabled);

        // Populate template dropdowns
        const displaySelect = document.getElementById('pv-display-template');
        const printSelect = document.getElementById('pv-default-template');

        if (displaySelect && this.priceviewTemplates.length) {
            const defaultOpt = displaySelect.querySelector('option[value=""]');
            displaySelect.innerHTML = '';
            if (defaultOpt) displaySelect.appendChild(defaultOpt);
            this.priceviewTemplates.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                if (s.product_display_template === t.id) opt.selected = true;
                displaySelect.appendChild(opt);
            });
        }

        if (printSelect && this.priceviewTemplates.length) {
            const defaultOpt = printSelect.querySelector('option[value=""]');
            printSelect.innerHTML = '';
            if (defaultOpt) printSelect.appendChild(defaultOpt);
            this.priceviewTemplates.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                if (s.default_template === t.id) opt.selected = true;
                printSelect.appendChild(opt);
            });
        }
    }

    _loadPriceviewStatus(data) {
        const lastSyncEl = document.getElementById('pv-last-sync');
        const productCountEl = document.getElementById('pv-product-count');
        const deviceCountEl = document.getElementById('pv-device-count');

        if (lastSyncEl) {
            lastSyncEl.textContent = data.priceview_last_sync || '-';
        }
        if (productCountEl) {
            productCountEl.textContent = data.priceview_product_count ?? '-';
        }
        if (deviceCountEl) {
            deviceCountEl.textContent = data.priceview_device_count ?? '-';
        }
    }

    async savePriceviewSettings() {
        try {
            const settings = {
                priceview_sync_interval: parseInt(document.getElementById('pv-sync-interval')?.value) || 30,
                priceview_auto_sync: document.getElementById('pv-auto-sync')?.checked ?? true,
                priceview_overlay_timeout: parseInt(document.getElementById('pv-overlay-timeout')?.value) || 10,
                priceview_print_enabled: document.getElementById('pv-print-enabled')?.checked ?? true,
                priceview_signage_enabled: document.getElementById('pv-signage-enabled')?.checked ?? true,
                priceview_default_template: document.getElementById('pv-default-template')?.value || null,
                priceview_font_size_multiplier: parseFloat(document.getElementById('pv-font-size')?.value) || 1.0,
                priceview_product_display_template: document.getElementById('pv-display-template')?.value || null
            };

            await this.app.api.put('/settings', settings);
            Toast.success(this.__('integrations.priceview.saved'));
        } catch (error) {
            Logger.error('Failed to save PriceView settings', error);
            Toast.error(error.message || 'Failed to save PriceView settings');
        }
    }

    async syncPriceviewNow() {
        try {
            const btn = document.getElementById('sync-priceview-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('integrations.priceview.buttons.syncNow')}`;
            }

            await this.app.api.post('/priceview/sync');
            Toast.success(this.__('integrations.priceview.saved'));

            // Reload status
            await this.loadPriceviewSettings();
        } catch (error) {
            Logger.error('PriceView sync failed', error);
            Toast.error(error.message || 'Sync failed');
        } finally {
            const btn = document.getElementById('sync-priceview-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-refresh"></i> ${this.__('integrations.priceview.buttons.syncNow')}`;
            }
        }
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default IntegrationSettingsPage;
