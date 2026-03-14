/**
 * Company Management Page Component (Admin)
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class CompanyManagementPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.stats = { total: 0, active: 0, trial: 0, expired: 0 };
        this.tempCompanyId = null; // Temporary ID for new company branding uploads
        this.licensePlans = []; // Lisans planları
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('admin');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('companies.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon purple">
                            <i class="ti ti-building"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('companies.title')}</h1>
                            <p class="page-subtitle">${this.__('companies.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/admin" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button id="add-company-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('companies.addCompany')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="company-stats">
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon blue">
                            <i class="ti ti-building"></i>
                        </div>
                        <span class="analytics-trend up" id="trend-total">
                            <i class="ti ti-users"></i>
                            ${this.__('companies.stats.all')}
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('companies.stats.total')}</p>
                    <p class="analytics-card-value" id="stat-total">-</p>
                    <p class="analytics-card-footer">${this.__('companies.stats.totalDesc')}</p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981;">
                            <i class="ti ti-circle-check"></i>
                        </div>
                        <div class="circular-progress" id="ring-active" style="--percent: 0">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                                <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="#10b981" stroke-width="4" stroke-linecap="round"></circle>
                            </svg>
                            <span class="progress-text" id="percent-active">0%</span>
                        </div>
                    </div>
                    <p class="analytics-card-label">${this.__('companies.stats.active')}</p>
                    <p class="analytics-card-value" id="stat-active">-</p>
                    <p class="analytics-card-footer highlight" style="color: #10b981;">
                        <i class="ti ti-check"></i>
                        ${this.__('companies.stats.activeDesc')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon amber">
                            <i class="ti ti-hourglass"></i>
                        </div>
                        <div class="circular-progress" id="ring-trial" style="--percent: 0">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                                <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"></circle>
                            </svg>
                            <span class="progress-text" id="percent-trial">0%</span>
                        </div>
                    </div>
                    <p class="analytics-card-label">${this.__('companies.stats.trial')}</p>
                    <p class="analytics-card-value" id="stat-trial">-</p>
                    <p class="analytics-card-footer highlight warning">
                        <i class="ti ti-clock"></i>
                        ${this.__('companies.stats.trialDesc')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon rose">
                            <i class="ti ti-alert-triangle"></i>
                        </div>
                        <span class="analytics-trend critical" id="trend-expired" style="display: none;">
                            ${this.__('companies.stats.critical')}
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('companies.stats.expired')}</p>
                    <p class="analytics-card-value" id="stat-expired">-</p>
                    <p class="analytics-card-footer">${this.__('companies.stats.expiredDesc')}</p>
                </div>
            </div>

            <!-- Companies Table -->
            <div class="card card-table">
                <div id="companies-table"></div>
            </div>
        `;
    }

    async init() {
        await this.loadLicensePlans();
        this.initDataTable();
        this.bindEvents();
        await this.loadStats();
    }

    /**
     * Lisans planlarını API'den yükle
     */
    async loadLicensePlans() {
        try {
            const response = await this.app.api.get('/payments/license-plans');
            this.licensePlans = response.data || [];
        } catch (error) {
            Logger.error('License plans fetch error:', error);
            this.licensePlans = [];
        }
    }

    /**
     * Plan seçeneklerini render et
     */
    renderPlanOptions(selectedPlanId = null) {
        if (!this.licensePlans.length) {
            return `<option value="">${this.__('companies.plans.noPlan')}</option>`;
        }

        return this.licensePlans.map(plan => {
            const selected = plan.id === selectedPlanId ? 'selected' : '';
            const unlimited = plan.max_branches === 0 || plan.max_branches === -1;
            const badge = unlimited ? ' (∞)' : ` (${plan.max_branches || 1} ${this.__('companies.plans.branches')})`;
            // i18n lookup by slug, fallback to DB name
            const slugKey = `licenses.plans.names.${(plan.slug || '').toLowerCase()}`;
            const localizedName = this.__(slugKey);
            const displayName = (localizedName && localizedName !== slugKey) ? localizedName : plan.name;
            return `<option value="${plan.id}" ${selected}>${escapeHTML(displayName)}${badge}</option>`;
        }).join('');
    }

    initDataTable() {
        const container = document.getElementById('companies-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchCompanies(params),
            columns: [
                {
                    key: 'icon',
                    label: this.__('companies.columns.preview'),
                    sortable: false,
                    preview: true,
                    render: (value, row) => {
                        const basePath = window.OmnexConfig?.basePath || '';
                        // Use icon (PWA icon-192) for table preview
                        const iconPath = row.icon || row.logo;
                        if (iconPath) {
                            return `<img src="${basePath}/${iconPath}" class="data-table-image" alt="${escapeHTML(row.name)}">`;
                        }
                        return `
                            <div class="data-table-icon-cell">
                                <i class="ti ti-building"></i>
                            </div>
                        `;
                    }
                },
                {
                    key: 'name',
                    label: this.__('companies.columns.company'),
                    title: true,
                    render: (value, row) => `
                        <div>
                            <p class="font-medium">${escapeHTML(value)}</p>
                            <p class="text-xs text-muted">${escapeHTML(row.code || '')}</p>
                        </div>
                    `
                },
                {
                    key: 'plan_name',
                    label: this.__('companies.columns.plan'),
                    render: (value, row) => {
                        const planType = row.plan_type || '';
                        const planSlug = row.plan_slug || '';
                        const badges = {
                            'ultimate': 'badge-danger',
                            'unlimited': 'badge-danger',
                            'enterprise': 'badge-warning',
                            'business': 'badge-warning',
                            'starter': 'badge-info',
                            'subscription': 'badge-info',
                            'trial': 'badge-secondary',
                            'free': 'badge-secondary'
                        };
                        const badgeClass = badges[planType] || badges[planSlug] || 'badge-secondary';
                        // i18n lookup by slug first, then plan_type, then raw DB name
                        const slugKey = `companies.plans.${planSlug}`;
                        const typeKey = `companies.plans.${planType}`;
                        const slugLabel = planSlug ? this.__(slugKey) : '';
                        const typeLabel = planType ? this.__(typeKey) : '';
                        const planLabel = (slugLabel && slugLabel !== slugKey) ? slugLabel
                            : (typeLabel && typeLabel !== typeKey) ? typeLabel
                            : value || this.__('companies.plans.free');
                        return `<span class="badge ${badgeClass}">${escapeHTML(planLabel)}</span>`;
                    }
                },
                {
                    key: 'user_count',
                    label: this.__('companies.columns.user'),
                    render: (value) => value || 0
                },
                {
                    key: 'device_count',
                    label: this.__('companies.columns.device'),
                    render: (value) => value || 0
                },
                {
                    key: 'region_count',
                    label: this.__('companies.columns.region'),
                    render: (value) => value || 0
                },
                {
                    key: 'branch_count',
                    label: this.__('companies.columns.branch'),
                    render: (value) => value || 0
                },
                {
                    key: 'status',
                    label: this.__('companies.columns.status'),
                    type: 'status',
                    statusConfig: {
                        active: { label: this.__('companies.statuses.active'), class: 'badge-success' },
                        trial: { label: this.__('companies.statuses.trial'), class: 'badge-warning' },
                        inactive: { label: this.__('companies.statuses.inactive'), class: 'badge-secondary' },
                        expired: { label: this.__('companies.statuses.expired'), class: 'badge-danger' }
                    }
                },
                {
                    key: 'created_at',
                    label: this.__('companies.columns.createdAt'),
                    type: 'date'
                },
                {
                    key: 'license_expires_at',
                    label: this.__('companies.columns.licenseExpiry'),
                    type: 'date'
                }
            ],
            actions: [
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('companies.actions.history'),
                    onClick: (row) => this.showHistory(row)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('companies.actions.view'),
                    onClick: (row) => this.viewDetails(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('companies.actions.edit'),
                    onClick: (row) => this.edit(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('companies.actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            searchPlaceholder: this.__('companies.searchPlaceholder'),
            emptyText: this.__('companies.emptyText'),
            emptyIcon: 'ti-building-off'
        });
    }

    async fetchCompanies(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            const response = await this.app.api.get(`/companies?${queryParams}`);
            const data = response.data || [];

            // Update stats from fetched data
            this.updateStatsFromData(data);

            return {
                data: data,
                total: response.meta?.total || data.length
            };
        } catch (error) {
            Logger.error('Companies fetch error:', error);
            return { data: [], total: 0 };
        }
    }

    async loadStats() {
        try {
            const response = await this.app.api.get('/companies?per_page=1000');
            const companies = response.data || [];
            this.updateStatsFromData(companies);
        } catch (error) {
            Logger.error('Stats load error:', error);
        }
    }

    updateStatsFromData(companies) {
        this.stats = {
            total: companies.length,
            active: companies.filter(c => c.status === 'active').length,
            trial: companies.filter(c => c.status === 'trial').length,
            expired: companies.filter(c => c.status === 'expired').length
        };

        const total = this.stats.total || 1;
        const activePercent = Math.round((this.stats.active / total) * 100);
        const trialPercent = Math.round((this.stats.trial / total) * 100);

        document.getElementById('stat-total').textContent = this.stats.total;
        document.getElementById('stat-active').textContent = this.stats.active;
        document.getElementById('stat-trial').textContent = this.stats.trial;
        document.getElementById('stat-expired').textContent = this.stats.expired;

        // Update circular progress
        const ringActive = document.getElementById('ring-active');
        const ringTrial = document.getElementById('ring-trial');

        if (ringActive) ringActive.style.setProperty('--percent', activePercent);
        if (ringTrial) ringTrial.style.setProperty('--percent', trialPercent);

        // Update percentage texts
        const percentActive = document.getElementById('percent-active');
        const percentTrial = document.getElementById('percent-trial');

        if (percentActive) percentActive.textContent = `${activePercent}%`;
        if (percentTrial) percentTrial.textContent = `${trialPercent}%`;

        // Show critical badge if expired > 0
        const trendExpired = document.getElementById('trend-expired');
        if (trendExpired) {
            trendExpired.style.display = this.stats.expired > 0 ? 'inline-flex' : 'none';
        }
    }

    bindEvents() {
        document.getElementById('add-company-btn')?.addEventListener('click', () => {
            this.showCompanyModal();
        });
    }

    edit(company) {
        this.showCompanyModal(company);
    }

    showHistory(company) {
        Toast.info(this.__('companies.toast.historyComingSoon'));
    }

    viewDetails(company) {
        const getStatusLabel = (status) => {
            const statusMap = {
                'active': this.__('companies.statuses.active'),
                'trial': this.__('companies.statuses.trial'),
                'inactive': this.__('companies.statuses.inactive'),
                'expired': this.__('companies.statuses.expired')
            };
            return statusMap[status] || this.__('companies.statuses.inactive');
        };

        const _slugKey = `companies.plans.${company.plan_slug || ''}`;
        const _typeKey = `companies.plans.${company.plan_type || ''}`;
        const _slugLabel = company.plan_slug ? this.__(_slugKey) : '';
        const _typeLabel = company.plan_type ? this.__(_typeKey) : '';
        const planLabel = (_slugLabel && _slugLabel !== _slugKey) ? _slugLabel
            : (_typeLabel && _typeLabel !== _typeKey) ? _typeLabel
            : company.plan_name || this.__('companies.plans.free');

        Modal.show({
            title: this.__('companies.detail'),
            icon: 'ti-building',
            size: 'md',
            content: `
                <div class="space-y-4">
                    <div class="flex items-center gap-4 pb-4 border-b">
                        <div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                            ${company.logo
                                ? `<img src="${company.logo}" class="w-full h-full object-cover rounded-lg">`
                                : `<i class="ti ti-building text-2xl text-gray-400"></i>`
                            }
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">${escapeHTML(company.name)}</h3>
                            <p class="text-muted">${escapeHTML(company.code || '-')}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.plan')}</label>
                            <p class="font-medium">${planLabel}</p>
                        </div>
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.status')}</label>
                            <p class="font-medium">${getStatusLabel(company.status)}</p>
                        </div>
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.userCount')}</label>
                            <p class="font-medium">${company.user_count || 0}</p>
                        </div>
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.deviceCount')}</label>
                            <p class="font-medium">${company.device_count || 0}</p>
                        </div>
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.email')}</label>
                            <p class="font-medium">${escapeHTML(company.email || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm text-muted">${this.__('companies.fields.phone')}</label>
                            <p class="font-medium">${escapeHTML(company.phone || '-')}</p>
                        </div>
                        <div class="col-span-2">
                            <label class="text-sm text-muted">${this.__('companies.fields.licenseExpiry')}</label>
                            <p class="font-medium">${company.license_expires_at ? new Date(company.license_expires_at).toLocaleDateString('tr-TR') : '-'}</p>
                        </div>
                    </div>
                </div>
            `,
            showConfirm: false,
            cancelText: this.__('modal.close')
        });
    }

    showCompanyModal(company = null) {
        const isEdit = !!company;
        const title = isEdit ? this.__('companies.editCompany') : this.__('companies.addCompany');
        const basePath = window.OmnexConfig?.basePath || '';

        // Generate temporary ID for new company branding uploads
        if (!isEdit) {
            this.tempCompanyId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        } else {
            this.tempCompanyId = null;
        }

        // Use company ID for edit, temp ID for new
        const brandingCompanyId = isEdit ? company.id : this.tempCompanyId;

        const formContent = `
            <form id="company-form" class="space-y-4">
                <!-- Modal Tabs -->
                <div class="modal-tabs">
                    <button type="button" class="modal-tab active" data-tab="info">
                        <i class="ti ti-info-circle"></i> ${this.__('companies.tabs.info')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="branding">
                        <i class="ti ti-photo"></i> ${this.__('companies.tabs.branding')}
                    </button>
                </div>

                <!-- Info Tab -->
                <div id="modal-tab-info" class="modal-tab-content active">
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('companies.fields.name')}</label>
                        <input type="text" id="company-name" class="form-input" required
                            value="${escapeHTML(company?.name || '')}" placeholder="${this.__('companies.placeholders.name')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('companies.fields.code')}</label>
                        <input type="text" id="company-code" class="form-input"
                            value="${escapeHTML(company?.code || '')}" placeholder="${this.__('companies.placeholders.code')}">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('companies.fields.plan')}</label>
                            <select id="company-plan" class="form-select">
                                ${this.renderPlanOptions(company?.plan_id)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('companies.fields.status')}</label>
                            <select id="company-status" class="form-select">
                                <option value="active" ${company?.status === 'active' ? 'selected' : ''}>${this.__('companies.statuses.active')}</option>
                                <option value="trial" ${company?.status === 'trial' ? 'selected' : ''}>${this.__('companies.statuses.trial')}</option>
                                <option value="inactive" ${company?.status === 'inactive' ? 'selected' : ''}>${this.__('companies.statuses.inactive')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('companies.fields.email')}</label>
                        <input type="email" id="company-email" class="form-input"
                            value="${escapeHTML(company?.email || '')}" placeholder="${this.__('companies.placeholders.email')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('companies.fields.phone')}</label>
                        <input type="tel" id="company-phone" class="form-input"
                            value="${escapeHTML(company?.phone || '')}" placeholder="${this.__('companies.placeholders.phone')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('companies.fields.address')}</label>
                        <textarea id="company-address" class="form-input" rows="2"
                            placeholder="${this.__('companies.placeholders.address')}">${escapeHTML(company?.address || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('companies.fields.licenseExpiry')}</label>
                        <input type="date" id="company-license-expires" class="form-input"
                            value="${company?.license_expires_at?.split('T')[0] || ''}">
                    </div>
                </div>

                <!-- Branding Tab -->
                <div id="modal-tab-branding" class="modal-tab-content" style="display: none;">
                    ${!isEdit ? `<div class="branding-new-notice">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('companies.branding.newCompanyHint')}</span>
                    </div>` : ''}
                    <p class="text-muted mb-4">${this.__('companies.branding.description')}</p>
                    <div class="branding-grid compact">
                        <!-- Logo Light -->
                        <div class="branding-item">
                            <div class="branding-preview light-bg" id="preview-company-logo">
                                <img src="${isEdit ? basePath + '/storage/companies/' + company.id + '/branding/logo.png' : ''}" alt="Logo" id="img-company-logo" style="${!isEdit ? 'display:none' : ''}" onerror="this.style.display='none'">
                            </div>
                            <div class="branding-info">
                                <h4>${this.__('companies.branding.logoLight')}</h4>
                                <p class="text-xs text-muted">${this.__('companies.branding.hints.logo')}</p>
                                <label class="btn btn-sm btn-outline">
                                    <i class="ti ti-upload"></i>
                                    <span>${this.__('companies.branding.upload')}</span>
                                    <input type="file" id="upload-company-logo" accept=".svg,.png,.jpg,.jpeg,.webp" hidden data-target="logo">
                                </label>
                            </div>
                        </div>

                        <!-- Logo Dark -->
                        <div class="branding-item">
                            <div class="branding-preview dark-bg" id="preview-company-logo-dark">
                                <img src="${isEdit ? basePath + '/storage/companies/' + company.id + '/branding/logo-dark.png' : ''}" alt="Logo Dark" id="img-company-logo-dark" style="${!isEdit ? 'display:none' : ''}" onerror="this.style.display='none'">
                            </div>
                            <div class="branding-info">
                                <h4>${this.__('companies.branding.logoDark')}</h4>
                                <p class="text-xs text-muted">${this.__('companies.branding.hints.logo')}</p>
                                <label class="btn btn-sm btn-outline">
                                    <i class="ti ti-upload"></i>
                                    <span>${this.__('companies.branding.upload')}</span>
                                    <input type="file" id="upload-company-logo-dark" accept=".svg,.png,.jpg,.jpeg,.webp" hidden data-target="logo-dark">
                                </label>
                            </div>
                        </div>

                        <!-- Favicon -->
                        <div class="branding-item">
                            <div class="branding-preview light-bg small" id="preview-company-favicon">
                                <img src="${isEdit ? basePath + '/storage/companies/' + company.id + '/branding/favicon.png' : ''}" alt="Favicon" id="img-company-favicon" style="${!isEdit ? 'display:none' : ''}" onerror="this.style.display='none'">
                            </div>
                            <div class="branding-info">
                                <h4>${this.__('companies.branding.favicon')}</h4>
                                <p class="text-xs text-muted">${this.__('companies.branding.hints.favicon')}</p>
                                <label class="btn btn-sm btn-outline">
                                    <i class="ti ti-upload"></i>
                                    <span>${this.__('companies.branding.upload')}</span>
                                    <input type="file" id="upload-company-favicon" accept=".svg,.ico,.png" hidden data-target="favicon">
                                </label>
                            </div>
                        </div>

                        <!-- Icon -->
                        <div class="branding-item">
                            <div class="branding-preview light-bg medium" id="preview-company-icon">
                                <img src="${isEdit ? basePath + '/storage/companies/' + company.id + '/branding/icon-192.png' : ''}" alt="Icon" id="img-company-icon" style="${!isEdit ? 'display:none' : ''}" onerror="this.style.display='none'">
                            </div>
                            <div class="branding-info">
                                <h4>${this.__('companies.branding.appIcon')}</h4>
                                <p class="text-xs text-muted">${this.__('companies.branding.hints.appIcon')}</p>
                                <label class="btn btn-sm btn-outline">
                                    <i class="ti ti-upload"></i>
                                    <span>${this.__('companies.branding.upload')}</span>
                                    <input type="file" id="upload-company-icon" accept=".svg,.png" hidden data-target="icon">
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <input type="hidden" id="company-id" value="${company?.id || ''}">
            </form>
        `;

        Modal.show({
            title: title,
            icon: isEdit ? 'ti-building-cog' : 'ti-building-plus',
            content: formContent,
            size: 'lg',
            closeOnBackdrop: false,
            confirmText: isEdit ? this.__('modal.update') : this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.saveCompany();
            },
            onClose: () => {
                // Cleanup temp files if modal is cancelled (only for new company)
                if (this.tempCompanyId) {
                    this.cleanupTempFiles(this.tempCompanyId);
                    this.tempCompanyId = null;
                }
            }
        });

        // Bind modal tabs and branding uploads
        setTimeout(() => {
            this.bindModalTabs();
            // Bind branding uploads for both new and edit modes
            this.bindBrandingUploads(brandingCompanyId);
            if (isEdit) {
                this.loadCompanyBranding(company.id);
            }
            // Clear error highlight on input change
            const nameInput = document.getElementById('company-name');
            if (nameInput) {
                nameInput.addEventListener('input', () => nameInput.classList.remove('error'));
            }
        }, 100);
    }

    bindModalTabs() {
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update tab content
                document.querySelectorAll('.modal-tab-content').forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                const targetContent = document.getElementById(`modal-tab-${tabId}`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                    targetContent.classList.add('active');
                }
            });
        });
    }

    bindBrandingUploads(companyId) {
        const uploads = [
            { input: 'upload-company-logo', preview: 'img-company-logo', target: 'logo' },
            { input: 'upload-company-logo-dark', preview: 'img-company-logo-dark', target: 'logo-dark' },
            { input: 'upload-company-favicon', preview: 'img-company-favicon', target: 'favicon' },
            { input: 'upload-company-icon', preview: 'img-company-icon', target: 'icon' }
        ];

        uploads.forEach(({ input, preview, target }) => {
            const inputEl = document.getElementById(input);
            if (inputEl) {
                inputEl.addEventListener('change', (e) => {
                    this.handleCompanyBrandingUpload(e.target.files[0], target, preview, companyId);
                });
            }
        });
    }

    loadCompanyBranding(companyId) {
        const basePath = window.OmnexConfig?.basePath || '';
        const timestamp = Date.now();
        const extensions = ['svg', 'png', 'jpg', 'jpeg', 'webp'];

        const brandingImages = [
            { id: 'img-company-logo', base: 'logo' },
            { id: 'img-company-logo-dark', base: 'logo-dark' },
            { id: 'img-company-favicon', base: 'favicon' },
            { id: 'img-company-icon', base: 'icon-192' }
        ];

        brandingImages.forEach(({ id, base }) => {
            const img = document.getElementById(id);
            if (!img) return;

            // Try each extension
            this.tryLoadCompanyImage(img, companyId, base, extensions, basePath, timestamp, 0);
        });
    }

    tryLoadCompanyImage(img, companyId, base, extensions, basePath, timestamp, index) {
        if (index >= extensions.length) {
            img.style.display = 'none';
            return;
        }

        const ext = extensions[index];
        const testImg = new Image();
        testImg.onload = () => {
            img.src = `${basePath}/storage/companies/${companyId}/branding/${base}.${ext}?t=${timestamp}`;
            img.style.display = '';
        };
        testImg.onerror = () => {
            this.tryLoadCompanyImage(img, companyId, base, extensions, basePath, timestamp, index + 1);
        };
        testImg.src = `${basePath}/storage/companies/${companyId}/branding/${base}.${ext}?t=${timestamp}`;
    }

    async handleCompanyBrandingUpload(file, target, previewId, companyId) {
        if (!file) return;

        if (file.size > 500 * 1024) {
            Toast.error(this.__('companies.toast.fileTooLarge'));
            return;
        }

        const validTypes = ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg', 'image/webp'];
        const validExtensions = ['.svg', '.png', '.ico', '.jpg', '.jpeg', '.webp'];
        const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!validTypes.includes(file.type) && !hasValidExt) {
            Toast.error(this.__('companies.toast.invalidFormat'));
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('target', target);
            formData.append('company_id', companyId);

            const response = await fetch(`${this.app.config.apiUrl}/companies/upload-branding`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(this.app.config.storageKeys.token)}`
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                Toast.success(this.__('companies.toast.imageUploaded'));

                // Update preview image
                const basePath = window.OmnexConfig?.basePath || '';
                const previewImg = document.getElementById(previewId);
                if (previewImg) {
                    previewImg.src = `${basePath}/${result.data.path}?t=${Date.now()}`;
                    previewImg.style.display = '';
                }

                // Refresh table to show updated logo
                this.dataTable?.refresh();
            } else {
                Toast.error(result.message || this.__('companies.toast.uploadError'));
            }
        } catch (error) {
            Logger.error('Company branding upload error:', error);
            Toast.error(this.__('companies.toast.uploadError') + ': ' + (error.message || ''));
        }
    }

    async saveCompany() {
        const id = document.getElementById('company-id')?.value;
        const name = document.getElementById('company-name')?.value?.trim();
        const code = document.getElementById('company-code')?.value?.trim();
        const plan_id = document.getElementById('company-plan')?.value;
        const status = document.getElementById('company-status')?.value;
        const email = document.getElementById('company-email')?.value?.trim();
        const phone = document.getElementById('company-phone')?.value?.trim();
        const address = document.getElementById('company-address')?.value?.trim();
        const license_expires_at = document.getElementById('company-license-expires')?.value;

        if (!name) {
            const nameInput = document.getElementById('company-name');
            if (nameInput) nameInput.classList.add('error');
            Toast.error(this.__('validation.requiredField', { field: this.__('companies.fields.name') }));
            throw new Error('Validation failed');
        }

        const data = { name, code, plan_id, status, email, phone, address, license_expires_at };

        // Include temp_id for new company to move branding files
        if (!id && this.tempCompanyId) {
            data.temp_id = this.tempCompanyId;
        }

        try {
            if (id) {
                await this.app.api.put(`/companies/${id}`, data);
                Toast.success(this.__('companies.toast.updated'));
            } else {
                const createResponse = await this.app.api.post('/companies', data);
                Toast.success(this.__('companies.toast.created'));
                if (Array.isArray(createResponse?.data?.post_create_warnings) && createResponse.data.post_create_warnings.length > 0) {
                    Logger.warn('Company created with non-critical post-create warnings', {
                        warnings: createResponse.data.post_create_warnings
                    });
                }
            }
            // Clear temp ID after save
            this.tempCompanyId = null;
            this.dataTable?.refresh();
            await this.loadStats();
        } catch (error) {
            const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
            const normalized = rawMessage.toLowerCase();
            const isGenericServerMessage = normalized === '' ||
                normalized === 'internal server error' ||
                normalized === 'request failed';
            const actionLabel = id ? this.__('companies.editCompany') : this.__('companies.addCompany');
            const fallbackMessage = `${actionLabel}: ${this.__('companies.toast.operationFailed')}`;

            Toast.error(isGenericServerMessage ? fallbackMessage : rawMessage);
            throw error;
        }
    }

    async delete(company) {
        Modal.confirm({
            title: this.__('companies.deleteCompany'),
            message: this.__('companies.deleteConfirm', { name: company.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/companies/${company.id}`);
                    Toast.success(this.__('companies.toast.deleted'));
                    this.dataTable?.refresh();
                    await this.loadStats();
                } catch (error) {
                    Toast.error(this.__('companies.toast.deleteError') + ': ' + (error.message || ''));
                    throw error;
                }
            }
        });
    }

    /**
     * Geçici branding dosyalarını temizle
     * Modal iptal edildiğinde veya hata oluştuğunda çağrılır
     */
    async cleanupTempFiles(tempId) {
        if (!tempId) return;

        try {
            await this.app.api.post('/companies/cleanup-temp', { temp_id: tempId });
        } catch (error) {
            // Sessiz hata - temizleme en iyi çaba prensibiyle çalışır
            console.warn('Geçici dosyalar temizlenemedi:', error);
        }
    }

    destroy() {
        // Sayfa yok edilirken de temp dosyaları temizle
        if (this.tempCompanyId) {
            this.cleanupTempFiles(this.tempCompanyId);
            this.tempCompanyId = null;
        }

        this.app.i18n.clearPageTranslations();
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
    }
}

export default CompanyManagementPage;
