/**
 * SetupWizard.js - Setup Wizard
 *
 * Admin page to load demo/default data.
 * Runs seed operations for categories, production types and products.
 *
 * @version 1.0.0
 * @since 2026-01-25
 */

import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';

export class SetupWizard {
    constructor(app) {
        this.app = app;
        this.status = null;
        this.isLoading = false;
        this.seedProgress = null;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Load translations before page render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('admin');
    }

    /**
     * Sayfa HTML'i
     */
    render() {
        return `
                <!-- Page Header -->
                <div class="page-header">
                    <div class="page-header-breadcrumb">
                        <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                        <span class="breadcrumb-separator">&rsaquo;</span>
                        <span class="breadcrumb-current">${this.__('setupWizard.title')}</span>
                    </div>
                    <div class="page-header-main">
                        <div class="page-header-left">
                            <div class="page-header-icon">
                                <i class="ti ti-wand"></i>
                            </div>
                            <div class="page-header-info">
                                <h1 class="page-title">${this.__('setupWizard.title')}</h1>
                                <p class="page-subtitle">${this.__('setupWizard.subtitle')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Status Cards -->
                <div class="setup-status-grid" id="status-grid">
                    <div class="setup-status-card loading">
                        <div class="status-card-icon">
                            <i class="ti ti-loader-2 spin"></i>
                        </div>
                        <div class="status-card-info">
                            <span class="status-card-label">${this.__('messages.loading')}</span>
                        </div>
                    </div>
                </div>

                <!-- Seed Options -->
                <div class="card mt-4">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-database-import"></i>
                            ${this.__('setupWizard.seedOptions')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <!-- Language Selection -->
                        <div class="form-group">
                            <label class="form-label">${this.__('setupWizard.language')}</label>
                            <select id="seed-locale" class="form-select" style="max-width: 300px;">
                                <option value="tr">${this.__('languages.tr')}</option>
                                <option value="en">${this.__('languages.en')}</option>
                                <option value="ru">${this.__('languages.ru')}</option>
                                <option value="az">${this.__('languages.az')}</option>
                                <option value="de">${this.__('languages.de')}</option>
                                <option value="nl">${this.__('languages.nl')}</option>
                                <option value="fr">${this.__('languages.fr')}</option>
                                <option value="ar">${this.__('languages.ar')}</option>
                            </select>
                            <small class="form-hint">${this.__('setupWizard.languageHint')}</small>
                        </div>

                        <!-- Seed Types -->
                        <div class="form-group mt-4">
                            <label class="form-label">${this.__('setupWizard.dataTypes')}</label>
                            <div class="seed-type-grid">
                                <label class="seed-type-card">
                                    <input type="checkbox" id="seed-categories" checked>
                                    <div class="seed-type-icon">
                                        <i class="ti ti-category"></i>
                                    </div>
                                    <div class="seed-type-info">
                                        <span class="seed-type-name">${this.__('setupWizard.categories')}</span>
                                        <span class="seed-type-desc">${this.__('setupWizard.categoriesDesc')}</span>
                                    </div>
                                </label>
                                <label class="seed-type-card">
                                    <input type="checkbox" id="seed-production-types" checked>
                                    <div class="seed-type-icon">
                                        <i class="ti ti-leaf"></i>
                                    </div>
                                    <div class="seed-type-info">
                                        <span class="seed-type-name">${this.__('setupWizard.productionTypes')}</span>
                                        <span class="seed-type-desc">${this.__('setupWizard.productionTypesDesc')}</span>
                                    </div>
                                </label>
                                <label class="seed-type-card">
                                    <input type="checkbox" id="seed-products" checked>
                                    <div class="seed-type-icon">
                                        <i class="ti ti-package"></i>
                                    </div>
                                    <div class="seed-type-info">
                                        <span class="seed-type-name">${this.__('setupWizard.products')}</span>
                                        <span class="seed-type-desc">${this.__('setupWizard.productsDesc')}</span>
                                    </div>
                                </label>
                                <label class="seed-type-card">
                                    <input type="checkbox" id="seed-license-plans" checked>
                                    <div class="seed-type-icon">
                                        <i class="ti ti-certificate"></i>
                                    </div>
                                    <div class="seed-type-info">
                                        <span class="seed-type-name">${this.__('setupWizard.licensePlans')}</span>
                                        <span class="seed-type-desc">${this.__('setupWizard.licensePlansDesc')}</span>
                                    </div>
                                </label>
                                <label class="seed-type-card">
                                    <input type="checkbox" id="seed-label-sizes" checked>
                                    <div class="seed-type-icon">
                                        <i class="ti ti-ruler-2"></i>
                                    </div>
                                    <div class="seed-type-info">
                                        <span class="seed-type-name">${this.__('setupWizard.labelSizes')}</span>
                                        <span class="seed-type-desc">${this.__('setupWizard.labelSizesDesc')}</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Options -->
                        <div class="form-group mt-4">
                            <label class="form-label">${this.__('setupWizard.options')}</label>
                            <div class="seed-options-grid">
                                <label class="seed-option">
                                    <input type="checkbox" id="seed-demo-only">
                                    <span>${this.__('setupWizard.demoOnly')}</span>
                                </label>
                                <label class="seed-option">
                                    <input type="checkbox" id="seed-default-only">
                                    <span>${this.__('setupWizard.defaultOnly')}</span>
                                </label>
                            </div>
                        </div>

                        <!-- Progress -->
                        <div id="seed-progress" class="seed-progress hidden">
                            <div class="progress-header">
                                <span id="progress-text">${this.__('setupWizard.seeding')}</span>
                                <span id="progress-percent">0%</span>
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
                            </div>
                            <div id="progress-details" class="progress-details"></div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="form-actions mt-4">
                            <button type="button" id="btn-seed" class="btn btn-primary btn-lg">
                                <i class="ti ti-database-import"></i>
                                ${this.__('setupWizard.startSeed')}
                            </button>
                            <button type="button" id="btn-clear-demo" class="btn btn-outline-warning btn-lg">
                                <i class="ti ti-trash"></i>
                                ${this.__('setupWizard.clearDemo')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Bilgi Kutusu -->
                <div class="info-box info-box-blue mt-4">
                    <div class="info-box-icon">
                        <i class="ti ti-info-circle"></i>
                    </div>
                    <div class="info-box-content">
                        <h4>${this.__('setupWizard.infoTitle')}</h4>
                        <p>${this.__('setupWizard.infoText')}</p>
                        <ul class="info-list">
                            <li>${this.__('setupWizard.infoItem1')}</li>
                            <li>${this.__('setupWizard.infoItem2')}</li>
                            <li>${this.__('setupWizard.infoItem3')}</li>
                        </ul>
                    </div>
                </div>
        `;
    }

    /**
     * Initialize page
     */
    async init() {
        this.bindEvents();
        await this.loadStatus();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Seed butonu
        document.getElementById('btn-seed')?.addEventListener('click', () => {
            this.startSeed();
        });

        // Demo temizle butonu
        document.getElementById('btn-clear-demo')?.addEventListener('click', () => {
            this.confirmClearDemo();
        });
    }

    /**
     * Load setup status
     */
    async loadStatus() {
        try {
            const response = await this.app.api.get('/setup/status');

            if (response.success) {
                this.status = response.data;
                this.renderStatusCards();
            }
        } catch (error) {
            console.error('Status load failed:', error);
            this.renderStatusError();
        }
    }

    /**
     * Render status cards
     */
        renderStatusCards() {
        const grid = document.getElementById('status-grid');
        if (!grid || !this.status) return;

        const counts = this.status.counts || {
            categories: this.status?.categories?.total || 0,
            production_types: this.status?.production_types?.total || 0,
            products: this.status?.products?.total || 0,
            label_sizes: this.status?.label_sizes?.total || 0,
            license_plans: this.status?.license_plans?.total || 0
        };
        const locales = this.status.available_locales || [];

        grid.innerHTML = `
            <div class="setup-status-card">
                <div class="status-card-icon blue">
                    <i class="ti ti-category"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${counts.categories || 0}</span>
                    <span class="status-card-label">${this.__('setupWizard.categories')}</span>
                </div>
            </div>
            <div class="setup-status-card">
                <div class="status-card-icon green">
                    <i class="ti ti-leaf"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${counts.production_types || 0}</span>
                    <span class="status-card-label">${this.__('setupWizard.productionTypes')}</span>
                </div>
            </div>
            <div class="setup-status-card">
                <div class="status-card-icon orange">
                    <i class="ti ti-package"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${counts.products || 0}</span>
                    <span class="status-card-label">${this.__('setupWizard.products')}</span>
                </div>
            </div>
            <div class="setup-status-card">
                <div class="status-card-icon purple">
                    <i class="ti ti-ruler-2"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${counts.label_sizes || 0}</span>
                    <span class="status-card-label">${this.__('setupWizard.labelSizes')}</span>
                </div>
            </div>
            <div class="setup-status-card">
                <div class="status-card-icon indigo">
                    <i class="ti ti-world"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${locales.length}</span>
                    <span class="status-card-label">${this.__('setupWizard.availableLocales')}</span>
                </div>
            </div>
            <div class="setup-status-card">
                <div class="status-card-icon teal">
                    <i class="ti ti-license"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-value">${counts.license_plans || 0}</span>
                    <span class="status-card-label">${this.__('setupWizard.licensePlans')}</span>
                </div>
            </div>
        `;
    }
    /**
     * Hata durumunda kart render et
     */
    renderStatusError() {
        const grid = document.getElementById('status-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="setup-status-card error">
                <div class="status-card-icon red">
                    <i class="ti ti-alert-circle"></i>
                </div>
                <div class="status-card-info">
                    <span class="status-card-label">${this.__('messages.error')}</span>
                </div>
            </div>
        `;
    }

    /**
     * Start seed operation
     */
    async startSeed() {
        if (this.isLoading) return;

        // Collect options
        const locale = document.getElementById('seed-locale')?.value || 'tr';
        const seedCategories = document.getElementById('seed-categories')?.checked;
        const seedProductionTypes = document.getElementById('seed-production-types')?.checked;
        const seedProducts = document.getElementById('seed-products')?.checked;
        const seedLicensePlans = document.getElementById('seed-license-plans')?.checked;
        const seedLabelSizes = document.getElementById('seed-label-sizes')?.checked;
        const demoOnly = document.getElementById('seed-demo-only')?.checked;
        const defaultOnly = document.getElementById('seed-default-only')?.checked;

        // At least one type must be selected
        if (!seedCategories && !seedProductionTypes && !seedProducts && !seedLicensePlans && !seedLabelSizes) {
            Toast.warning(this.__('setupWizard.selectAtLeastOne'));
            return;
        }

        // Build seeder list (API format)
        const seeders = [];
        if (seedCategories) seeders.push('categories');
        if (seedProductionTypes) seeders.push('production_types');
        if (seedProducts) seeders.push('products');
        if (seedLicensePlans) seeders.push('license_plans');
        if (seedLabelSizes) seeders.push('label_sizes');

        this.isLoading = true;
        this.showProgress();

        try {
            const response = await this.app.api.post('/setup/seed', {
                locale,
                seeders,
                demo_only: demoOnly,
                default_only: defaultOnly
            });

            if (response.success) {
                this.updateProgress(100, this.__('setupWizard.completed'));
                this.showResults(response.data);
                Toast.success(this.__('setupWizard.seedSuccess'));

                // Durumu yenile
                await this.loadStatus();
            } else {
                Toast.error(response.message || this.__('setupWizard.seedError'));
            }
        } catch (error) {
            console.error('Seed error:', error);
            Toast.error(error?.message || this.__('setupWizard.seedError'));
        } finally {
            this.isLoading = false;
            setTimeout(() => this.hideProgress(), 2000);
        }
    }

    /**
     * Confirm demo data cleanup
     */
    confirmClearDemo() {
        Modal.confirm({
            title: this.__('setupWizard.clearDemoTitle'),
            message: this.__('setupWizard.clearDemoConfirm'),
            type: 'warning',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: () => this.clearDemo()
        });
    }

    /**
     * Demo verileri temizle
     */
    async clearDemo() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showProgress();

        try {
            const response = await this.app.api.post('/setup/seed', {
                clear_demo: true
            });

            if (response.success) {
                this.updateProgress(100, this.__('setupWizard.cleared'));
                Toast.success(this.__('setupWizard.clearSuccess'));

                // Durumu yenile
                await this.loadStatus();
            } else {
                Toast.error(response.message || this.__('setupWizard.clearError'));
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            Toast.error(error?.message || this.__('setupWizard.clearError'));
        } finally {
            this.isLoading = false;
            setTimeout(() => this.hideProgress(), 2000);
        }
    }

    /**
     * Show progress
     */
    showProgress() {
        const progress = document.getElementById('seed-progress');
        if (progress) {
            progress.classList.remove('hidden');
        }
        this.updateProgress(0, this.__('setupWizard.starting'));

        // Disable buttons
        document.getElementById('btn-seed')?.setAttribute('disabled', 'disabled');
        document.getElementById('btn-clear-demo')?.setAttribute('disabled', 'disabled');
    }

    /**
     * Progress gizle
     */
    hideProgress() {
        const progress = document.getElementById('seed-progress');
        if (progress) {
            progress.classList.add('hidden');
        }

        // Enable buttons
        document.getElementById('btn-seed')?.removeAttribute('disabled');
        document.getElementById('btn-clear-demo')?.removeAttribute('disabled');
    }

    /**
     * Update progress
     */
    updateProgress(percent, text) {
        const bar = document.getElementById('progress-bar');
        const percentText = document.getElementById('progress-percent');
        const progressText = document.getElementById('progress-text');

        if (bar) bar.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (progressText) progressText.textContent = text;
    }

    /**
     * Show results
     */
    showResults(data) {
        const details = document.getElementById('progress-details');
        // API response returns results in 'seeders'
        const results = data.seeders || data.results;
        if (!details || !results) return;

        let html = '<div class="seed-results">';

        for (const [seeder, stats] of Object.entries(results)) {
            const name = this.getSeederName(seeder);
            html += `
                <div class="seed-result-item">
                    <span class="result-name">${name}</span>
                    <span class="result-stats">
                        <span class="stat created">+${stats.created || 0}</span>
                        <span class="stat updated">~${stats.updated || 0}</span>
                        <span class="stat skipped">=${stats.skipped || 0}</span>
                        ${stats.errors > 0 ? `<span class="stat errors">!${stats.errors}</span>` : ''}
                    </span>
                </div>
            `;
        }

        html += '</div>';
        details.innerHTML = html;
    }

    /**
     * Get display name for seeder
     */
        getSeederName(seeder) {
        const names = {
            // API'den gelen anahtarlar (kucuk harf, alt cizgi)
            'categories': this.__('setupWizard.categories'),
            'production_types': this.__('setupWizard.productionTypes'),
            'products': this.__('setupWizard.products'),
            'license_plans': this.__('setupWizard.licensePlans'),
            'label_sizes': this.__('setupWizard.labelSizes'),
            // Geriye uyumluluk icin eski isimler
            'CategorySeeder': this.__('setupWizard.categories'),
            'ProductionTypeSeeder': this.__('setupWizard.productionTypes'),
            'ProductSeeder': this.__('setupWizard.products'),
            'LicensePlanSeeder': this.__('setupWizard.licensePlans'),
            'LabelSizeSeeder': this.__('setupWizard.labelSizes')
        };
        return names[seeder] || seeder;
    }
    /**
     * Sayfa temizleme
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default SetupWizard;
