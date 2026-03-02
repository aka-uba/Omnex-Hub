/**
 * General Settings Page Component
 * Modernized with top tabs and chart-card style
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class GeneralSettingsPage {
    constructor(app) {
        this.app = app;
        this.settings = {};
        this.activeTab = 'general';
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon slate">
                            <i class="ti ti-settings"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('general.title')}</h1>
                            <p class="page-subtitle">${this.__('general.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/settings/labels" class="btn btn-outline">
                            <i class="ti ti-ruler-2"></i>
                            ${this.__('labels.title')}
                        </a>
                    </div>
                </div>
            </div>

            <!-- Settings Tab Navigation -->
            <div class="settings-tabs">
                <button class="settings-tab ${this.activeTab === 'general' ? 'active' : ''}" data-tab="general">
                    <i class="ti ti-settings"></i>
                    <span>${this.__('tabs.general')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'branding' ? 'active' : ''}" data-tab="branding">
                    <i class="ti ti-palette"></i>
                    <span>${this.__('tabs.branding')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'email' ? 'active' : ''}" data-tab="email">
                    <i class="ti ti-mail"></i>
                    <span>${this.__('tabs.email')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'barcode' ? 'active' : ''}" data-tab="barcode">
                    <i class="ti ti-barcode"></i>
                    <span>${this.__('tabs.barcode')}</span>
                </button>
            </div>

            <form id="settings-form">
                <!-- General Settings Tab -->
                <div id="tab-general" class="settings-tab-content ${this.activeTab === 'general' ? 'active' : ''}">
                    <div class="settings-grid">
                        <!-- Company Info Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-building"></i>
                                    ${this.__('general.sections.company')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.companyName')}</label>
                                        <input type="text" id="company_name" class="form-input" placeholder="${this.__('general.placeholders.companyName')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.companyPhone')}</label>
                                        <input type="tel" id="company_phone" class="form-input" placeholder="${this.__('general.placeholders.companyPhone')}">
                                    </div>
                                    <div class="form-group full-width">
                                        <label class="form-label">${this.__('general.fields.companyAddress')}</label>
                                        <textarea id="company_address" class="form-input" rows="2" placeholder="${this.__('general.placeholders.companyAddress')}"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- System Settings Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-adjustments"></i>
                                    ${this.__('general.sections.system')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.language')}</label>
                                        <select id="language" class="form-select">
                                            <option value="tr">${this.__('general.languages.tr')}</option>
                                            <option value="en">${this.__('general.languages.en')}</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.timezone')}</label>
                                        <select id="timezone" class="form-select">
                                            <option value="Europe/Istanbul">Istanbul (UTC+3)</option>
                                            <option value="Europe/London">London (UTC+0)</option>
                                            <option value="America/New_York">New York (UTC-5)</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.dateFormat')}</label>
                                        <select id="date_format" class="form-select">
                                            <option value="DD.MM.YYYY">31.12.2024</option>
                                            <option value="MM/DD/YYYY">12/31/2024</option>
                                            <option value="YYYY-MM-DD">2024-12-31</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('general.fields.currency')}</label>
                                        <select id="currency" class="form-select">
                                            <option value="TRY">${this.__('general.currencies.TRY')}</option>
                                            <option value="USD">${this.__('general.currencies.USD')}</option>
                                            <option value="EUR">${this.__('general.currencies.EUR')}</option>
                                            <option value="GBP">${this.__('general.currencies.GBP')}</option>
                                            <option value="RUB">${this.__('general.currencies.RUB')}</option>
                                            <option value="AZN">${this.__('general.currencies.AZN')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Branding Tab -->
                <div id="tab-branding" class="settings-tab-content ${this.activeTab === 'branding' ? 'active' : ''}">
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-photo"></i>
                                ${this.__('branding.title')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <p class="text-muted mb-6">${this.__('branding.description')}</p>
                            <div class="branding-grid">
                                <!-- Logo Light -->
                                <div class="branding-item">
                                    <div class="branding-preview light-bg" id="preview-logo">
                                        <img src="" alt="Logo" id="img-logo">
                                    </div>
                                    <div class="branding-info">
                                        <h4>${this.__('branding.logoLight')}</h4>
                                        <p class="text-muted">${this.__('branding.file')}: <code>logo.svg</code> / <code>logo.png</code></p>
                                    </div>
                                </div>

                                <!-- Logo Dark -->
                                <div class="branding-item">
                                    <div class="branding-preview dark-bg" id="preview-logo-dark">
                                        <img src="" alt="Logo Dark" id="img-logo-dark">
                                    </div>
                                    <div class="branding-info">
                                        <h4>${this.__('branding.logoDark')}</h4>
                                        <p class="text-muted">${this.__('branding.file')}: <code>logo-dark.svg</code> / <code>logo-dark.png</code></p>
                                    </div>
                                </div>

                                <!-- Favicon -->
                                <div class="branding-item">
                                    <div class="branding-preview light-bg small" id="preview-favicon">
                                        <img src="" alt="Favicon" id="img-favicon">
                                    </div>
                                    <div class="branding-info">
                                        <h4>${this.__('branding.favicon')}</h4>
                                        <p class="text-muted">${this.__('branding.file')}: <code>favicon.svg</code> / <code>favicon.ico</code></p>
                                    </div>
                                </div>

                                <!-- PWA Icon -->
                                <div class="branding-item">
                                    <div class="branding-preview light-bg medium" id="preview-pwa-icon">
                                        <img src="" alt="PWA Icon" id="img-pwa-icon">
                                    </div>
                                    <div class="branding-info">
                                        <h4>${this.__('branding.pwaIcon')}</h4>
                                        <p class="text-muted">${this.__('branding.file')}: <code>icon-192.png</code> / <code>icon-512.png</code></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Barcode Settings Tab -->
                <div id="tab-barcode" class="settings-tab-content ${this.activeTab === 'barcode' ? 'active' : ''}">
                    <div class="settings-grid">
                        <!-- Weighing Product Barcode Settings -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-scale"></i>
                                    ${this.__('barcode.weighing.title')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <p class="text-muted mb-4">${this.__('barcode.weighing.description')}</p>

                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('barcode.weighing.flagCode')}</label>
                                        <select id="weighing_flag_code" class="form-select">
                                            <option value="20">20</option>
                                            <option value="21">21</option>
                                            <option value="22">22</option>
                                            <option value="23">23</option>
                                            <option value="24">24</option>
                                            <option value="25">25</option>
                                            <option value="26">26</option>
                                            <option value="27">27</option>
                                            <option value="28">28</option>
                                            <option value="29">29</option>
                                        </select>
                                        <small class="form-hint">${this.__('barcode.weighing.flagCodeHint')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('barcode.weighing.barcodeFormat')}</label>
                                        <select id="weighing_barcode_format" class="form-select">
                                            <option value="CODE128">Code 128</option>
                                            <option value="EAN13">EAN-13</option>
                                        </select>
                                        <small class="form-hint">${this.__('barcode.weighing.formatHint')}</small>
                                    </div>
                                </div>

                                <!-- Preview Section -->
                                <div class="barcode-preview-section mt-6">
                                    <h4 class="text-sm font-medium mb-3">${this.__('barcode.weighing.preview')}</h4>
                                    <div class="barcode-preview-card">
                                        <div class="barcode-preview-info">
                                            <div class="barcode-preview-row">
                                                <span class="barcode-preview-label">${this.__('barcode.weighing.scaleCode')}:</span>
                                                <span class="barcode-preview-value" id="preview-scale-code">09337</span>
                                            </div>
                                            <div class="barcode-preview-row">
                                                <span class="barcode-preview-label">${this.__('barcode.weighing.resultBarcode')}:</span>
                                                <span class="barcode-preview-value font-mono font-bold" id="preview-result-barcode">2709337</span>
                                            </div>
                                        </div>
                                        <div class="barcode-preview-visual" id="barcode-preview-container">
                                            <!-- Barcode SVG will be rendered here -->
                                        </div>
                                    </div>
                                    <p class="text-xs text-muted mt-2">${this.__('barcode.weighing.previewHint')}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Barcode Info Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-info-circle"></i>
                                    ${this.__('barcode.info.title')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="info-box info-box-blue mb-4">
                                    <i class="ti ti-bulb"></i>
                                    <div>
                                        <strong>${this.__('barcode.info.howItWorks')}</strong>
                                        <p class="text-sm mt-1">${this.__('barcode.info.description')}</p>
                                    </div>
                                </div>

                                <div class="barcode-formula">
                                    <div class="formula-item">
                                        <span class="formula-badge flag">${this.__('barcode.info.flag')}</span>
                                        <span class="formula-value">27</span>
                                    </div>
                                    <span class="formula-operator">+</span>
                                    <div class="formula-item">
                                        <span class="formula-badge scale">${this.__('barcode.info.scaleCode')}</span>
                                        <span class="formula-value">09337</span>
                                    </div>
                                    <span class="formula-operator">=</span>
                                    <div class="formula-item">
                                        <span class="formula-badge result">${this.__('barcode.info.result')}</span>
                                        <span class="formula-value font-bold">2709337</span>
                                    </div>
                                </div>

                                <p class="text-xs text-muted mt-4">${this.__('barcode.info.note')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Email/SMTP Tab -->
                <div id="tab-email" class="settings-tab-content ${this.activeTab === 'email' ? 'active' : ''}">
                    <div class="settings-grid">
                        <!-- SMTP Settings Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-mail-cog"></i>
                                    ${this.__('email.smtp.title')}
                                </h2>
                                <button type="button" id="test-smtp-btn" class="btn btn-sm btn-outline">
                                    <i class="ti ti-send"></i>
                                    ${this.__('email.smtp.testButton')}
                                </button>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.host')}</label>
                                        <input type="text" id="smtp_host" class="form-input" placeholder="${this.__('email.smtp.placeholders.host')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.port')}</label>
                                        <input type="number" id="smtp_port" class="form-input" placeholder="${this.__('email.smtp.placeholders.port')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.username')}</label>
                                        <input type="text" id="smtp_username" class="form-input" placeholder="${this.__('email.smtp.placeholders.username')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.password')}</label>
                                        <input type="password" id="smtp_password" class="form-input" placeholder="${this.__('email.smtp.placeholders.password')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.encryption')}</label>
                                        <select id="smtp_encryption" class="form-select">
                                            <option value="tls">${this.__('email.smtp.encryption.tls')}</option>
                                            <option value="ssl">${this.__('email.smtp.encryption.ssl')}</option>
                                            <option value="none">${this.__('email.smtp.encryption.none')}</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.fromName')}</label>
                                        <input type="text" id="smtp_from_name" class="form-input" placeholder="${this.__('email.smtp.placeholders.fromName')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.fromEmail')}</label>
                                        <input type="email" id="smtp_from_email" class="form-input" placeholder="${this.__('email.smtp.placeholders.fromEmail')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('email.smtp.fields.testEmail')}</label>
                                        <input type="email" id="smtp_test_email" class="form-input" placeholder="${this.__('email.smtp.placeholders.testEmail')}">
                                        <small class="form-hint">${this.__('email.smtp.hints.testEmail')}</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Email Templates Card -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-template"></i>
                                    ${this.__('email.templates.title')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="email-templates-list">
                                    <div class="email-template-item">
                                        <div class="email-template-icon">
                                            <i class="ti ti-user-plus"></i>
                                        </div>
                                        <div class="email-template-info">
                                            <h4>${this.__('email.templates.welcome.title')}</h4>
                                            <p>${this.__('email.templates.welcome.description')}</p>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-ghost" data-template="welcome">
                                            <i class="ti ti-edit"></i>
                                        </button>
                                    </div>
                                    <div class="email-template-item">
                                        <div class="email-template-icon">
                                            <i class="ti ti-key"></i>
                                        </div>
                                        <div class="email-template-info">
                                            <h4>${this.__('email.templates.passwordReset.title')}</h4>
                                            <p>${this.__('email.templates.passwordReset.description')}</p>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-ghost" data-template="passwordReset">
                                            <i class="ti ti-edit"></i>
                                        </button>
                                    </div>
                                    <div class="email-template-item">
                                        <div class="email-template-icon">
                                            <i class="ti ti-alert-triangle"></i>
                                        </div>
                                        <div class="email-template-info">
                                            <h4>${this.__('email.templates.errorNotification.title')}</h4>
                                            <p>${this.__('email.templates.errorNotification.description')}</p>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-ghost" data-template="errorNotification">
                                            <i class="ti ti-edit"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <div class="settings-footer">
                    <button type="submit" class="btn btn-primary btn-lg">
                        <i class="ti ti-check"></i>
                        ${this.__('saveChanges')}
                    </button>
                </div>
            </form>
        `;
    }

    async init() {
        await this.loadSettings();
        this.loadBrandingImages();
        this.bindEvents();
    }

    /**
     * Load existing branding images
     */
    loadBrandingImages() {
        const basePath = window.OmnexConfig?.basePath || '';
        const timestamp = Date.now();

        const brandingImages = [
            { id: 'img-logo', files: ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp', 'logo.svg'] },
            { id: 'img-logo-dark', files: ['logo-dark.jpg', 'logo-dark.png', 'logo-dark.jpeg', 'logo-dark.webp', 'logo-dark.svg'] },
            { id: 'img-favicon', files: ['favicon.png', 'favicon.ico', 'favicon.svg'] },
            { id: 'img-pwa-icon', files: ['icon-192.png', 'icon-192.svg'] }
        ];

        brandingImages.forEach(({ id, files }) => {
            const img = document.getElementById(id);
            if (!img) return;

            // Try each file extension until one works
            this.tryLoadImage(img, files, basePath, timestamp, 0);
        });
    }

    /**
     * Try loading image with different extensions
     */
    tryLoadImage(img, files, basePath, timestamp, index) {
        if (index >= files.length) {
            // No image found, hide it
            img.style.display = 'none';
            return;
        }

        const testImg = new Image();
        testImg.onload = () => {
            img.src = `${basePath}/branding/${files[index]}?t=${timestamp}`;
            img.style.display = '';
        };
        testImg.onerror = () => {
            // Try next extension
            this.tryLoadImage(img, files, basePath, timestamp, index + 1);
        };
        testImg.src = `${basePath}/branding/${files[index]}?t=${timestamp}`;
    }

    async loadSettings() {
        try {
            const response = await this.app.api.get('/settings');
            this.settings = response.data || {};
            this.app?.state?.set('settings', this.settings, true);
            localStorage.setItem('omnex_settings', JSON.stringify(this.settings));
            this.populateForm();
        } catch (error) {
            Logger.error('Settings load error:', error);
        }
    }

    populateForm() {
        // Text/Select fields
        const fields = [
            'company_name', 'company_phone', 'company_address',
            'language', 'timezone', 'date_format', 'currency',
            'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_encryption', 'smtp_from_name', 'smtp_from_email',
            'weighing_flag_code', 'weighing_barcode_format'
        ];

        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && this.settings[field]) {
                el.value = this.settings[field];
            }
        });

        // Set default values for barcode settings if not set
        if (!this.settings.weighing_flag_code) {
            const flagEl = document.getElementById('weighing_flag_code');
            if (flagEl) flagEl.value = '27';
        }
        if (!this.settings.weighing_barcode_format) {
            const formatEl = document.getElementById('weighing_barcode_format');
            if (formatEl) formatEl.value = 'CODE128';
        }

        // Update barcode preview
        this.updateBarcodePreview();
    }

    bindEvents() {
        // Form submission
        document.getElementById('settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // SMTP Test
        document.getElementById('test-smtp-btn')?.addEventListener('click', () => {
            this.testSmtp();
        });

        // Email template edit buttons
        document.querySelectorAll('.email-template-item .btn-ghost').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showTemplateComingSoon();
            });
        });

        // Barcode settings change events
        document.getElementById('weighing_flag_code')?.addEventListener('change', () => {
            this.updateBarcodePreview();
        });
        document.getElementById('weighing_barcode_format')?.addEventListener('change', () => {
            this.updateBarcodePreview();
        });
    }

    /**
     * Show coming soon message for email templates
     */
    showTemplateComingSoon() {
        Toast.info(this.__('email.templates.comingSoon'));
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

    async testSmtp() {
        const btn = document.getElementById('test-smtp-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('email.smtp.testing')}`;
        btn.disabled = true;

        try {
            const response = await this.app.api.post('/settings/test-smtp', {
                host: document.getElementById('smtp_host')?.value,
                port: document.getElementById('smtp_port')?.value,
                username: document.getElementById('smtp_username')?.value,
                password: document.getElementById('smtp_password')?.value,
                encryption: document.getElementById('smtp_encryption')?.value,
                from_email: document.getElementById('smtp_from_email')?.value,
                from_name: document.getElementById('smtp_from_name')?.value,
                test_email: document.getElementById('smtp_test_email')?.value
            });

            const testEmail = response.data?.test_email || '';
            Toast.success(this.__('toast.smtpSuccess', { email: testEmail }));
        } catch (error) {
            Toast.error(this.__('toast.smtpFailed') + ': ' + (error.message || ''));
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    async saveSettings() {
        const data = {
            company_name: document.getElementById('company_name')?.value,
            company_phone: document.getElementById('company_phone')?.value,
            company_address: document.getElementById('company_address')?.value,
            language: document.getElementById('language')?.value,
            timezone: document.getElementById('timezone')?.value,
            date_format: document.getElementById('date_format')?.value,
            currency: document.getElementById('currency')?.value,
            smtp_host: document.getElementById('smtp_host')?.value,
            smtp_port: document.getElementById('smtp_port')?.value,
            smtp_username: document.getElementById('smtp_username')?.value,
            smtp_password: document.getElementById('smtp_password')?.value,
            smtp_encryption: document.getElementById('smtp_encryption')?.value,
            smtp_from_name: document.getElementById('smtp_from_name')?.value,
            smtp_from_email: document.getElementById('smtp_from_email')?.value,
            weighing_flag_code: document.getElementById('weighing_flag_code')?.value,
            weighing_barcode_format: document.getElementById('weighing_barcode_format')?.value
        };

        try {
            await this.app.api.put('/settings', data);
            this.app?.state?.set('settings', data, true);
            localStorage.setItem('omnex_settings', JSON.stringify(data));
            Toast.success(this.__('toast.saved'));
        } catch (error) {
            Toast.error(this.__('toast.saveFailed'));
        }
    }

    /**
     * Update barcode preview based on selected settings
     */
    updateBarcodePreview() {
        const flagCode = document.getElementById('weighing_flag_code')?.value || '27';
        const format = document.getElementById('weighing_barcode_format')?.value || 'CODE128';
        const scaleCode = '09337'; // Example scale code

        const resultBarcode = flagCode + scaleCode;

        // Update preview text
        const previewResult = document.getElementById('preview-result-barcode');
        if (previewResult) {
            previewResult.textContent = resultBarcode;
        }

        // Update barcode visual
        const container = document.getElementById('barcode-preview-container');
        if (container && typeof JsBarcode !== 'undefined') {
            container.innerHTML = '<svg id="barcode-preview-svg"></svg>';
            try {
                JsBarcode('#barcode-preview-svg', resultBarcode, {
                    format: format,
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    margin: 10,
                    background: '#ffffff'
                });
            } catch (error) {
                container.innerHTML = `<div class="text-muted text-center py-4">${escapeHTML(resultBarcode)}</div>`;
            }
        } else if (container) {
            container.innerHTML = `<div class="text-muted text-center py-4 font-mono">${escapeHTML(resultBarcode)}</div>`;
        }
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default GeneralSettingsPage;
