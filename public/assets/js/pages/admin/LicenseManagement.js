/**
 * License Management Page Component (Admin)
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class LicenseManagementPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.companies = [];
        this.stats = { active: 0, expiring: 0, expired: 0 };
        this.paymentSettings = null;
        this.licensePlans = [];
        this.activeTab = 'licenses'; // 'licenses' or 'plans'
    }

    /**
     * i18n helper function
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Check if current user is SuperAdmin
     */
    isSuperAdmin() {
        const user = this.app.state.get('user');
        if (!user || !user.role) return false;
        return user.role.toLowerCase() === 'superadmin';
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
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('licenses.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon amber">
                            <i class="ti ti-license"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('licenses.title')}</h1>
                            <p class="page-subtitle">${this.__('licenses.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/admin" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        ${this.isSuperAdmin() ? `
                        <button id="generate-license-btn" class="btn btn-primary">
                            <i class="ti ti-key"></i>
                            ${this.__('licenses.createLicense')}
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Page Tabs -->
            <div class="page-tabs">
                <button class="page-tab ${this.activeTab === 'licenses' ? 'active' : ''}" data-tab="licenses">
                    <i class="ti ti-license"></i>
                    ${this.__('licenses.pageTabs.licenses')}
                </button>
                <button class="page-tab ${this.activeTab === 'plans' ? 'active' : ''}" data-tab="plans">
                    <i class="ti ti-list-details"></i>
                    ${this.__('licenses.pageTabs.plans')}
                </button>
            </div>

            <!-- Licenses Tab Content -->
            <div id="licenses-tab-content" class="tab-content ${this.activeTab === 'licenses' ? '' : 'hidden'}">

            <!-- License Stats -->
            <div class="license-stats">
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981;">
                            <i class="ti ti-license"></i>
                        </div>
                        <span class="analytics-trend up">
                            <i class="ti ti-check"></i>
                            ${this.__('licenses.stats.valid')}
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('licenses.stats.active')}</p>
                    <p class="analytics-card-value" id="stat-active">-</p>
                    <p class="analytics-card-footer highlight" style="color: #10b981;">
                        <i class="ti ti-shield-check"></i>
                        ${this.__('licenses.stats.fullAccess')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon amber">
                            <i class="ti ti-clock"></i>
                        </div>
                        <span class="analytics-trend critical" id="expiring-badge" style="display: none;">
                            ${this.__('licenses.stats.warning')}
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('licenses.stats.expiringSoon')}</p>
                    <p class="analytics-card-value" id="stat-expiring">-</p>
                    <p class="analytics-card-footer highlight warning">
                        <i class="ti ti-alert-circle"></i>
                        ${this.__('licenses.stats.within30Days')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon rose">
                            <i class="ti ti-license-off"></i>
                        </div>
                        <span class="analytics-trend down" id="expired-badge" style="display: none;">
                            <i class="ti ti-x"></i>
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('licenses.stats.expired')}</p>
                    <p class="analytics-card-value" id="stat-expired">-</p>
                    <p class="analytics-card-footer">${this.__('licenses.stats.renewalRequired')}</p>
                </div>
            </div>

            <!-- License Limits -->
            <div class="license-limits-grid">
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-users"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-users">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.users')}</span>
                    </div>
                </div>
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-device-tv"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-devices">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.devices')}</span>
                    </div>
                </div>
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-package"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-products">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.products')}</span>
                    </div>
                </div>
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-layout"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-templates">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.templates')}</span>
                    </div>
                </div>
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-building-store"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-branches">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.branches')}</span>
                    </div>
                </div>
                <div class="license-limit-card">
                    <div class="license-limit-icon">
                        <i class="ti ti-database"></i>
                    </div>
                    <div class="license-limit-info">
                        <span class="license-limit-value" id="limit-storage">∞</span>
                        <span class="license-limit-label">${this.__('licenses.limits.storage')}</span>
                    </div>
                </div>
            </div>

            <!-- Licenses Table -->
            <div class="card card-table">
                <div id="licenses-table"></div>
            </div>

            </div><!-- End Licenses Tab Content -->

            <!-- Plans Tab Content -->
            <div id="plans-tab-content" class="tab-content ${this.activeTab === 'plans' ? '' : 'hidden'}">
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h2 class="chart-card-title">
                            <i class="ti ti-list-details"></i>
                            ${this.__('licenses.plans.title')}
                        </h2>
                        ${this.isSuperAdmin() ? `
                        <button type="button" class="btn btn-primary btn-sm" id="add-license-plan-btn">
                            <i class="ti ti-plus"></i>
                            ${this.__('licenses.plans.addPlan')}
                        </button>
                        ` : ''}
                    </div>
                    <div class="chart-card-body">
                        <p class="text-muted mb-4">${this.__('licenses.plans.description')}</p>
                        <div id="license-plans-list" class="space-y-3">
                            <div class="text-center text-muted py-4">
                                <i class="ti ti-loader animate-spin"></i>
                                ${this.__('messages.loading')}
                            </div>
                        </div>
                    </div>
                </div>
            </div><!-- End Plans Tab Content -->
        `;
    }

    async init() {
        await Promise.all([
            this.loadCompanies(),
            this.loadPaymentInfo()
        ]);
        this.initDataTable();
        this.bindEvents();
        this.bindTabEvents();

        // If plans tab is active, render plans
        if (this.activeTab === 'plans') {
            this.renderLicensePlans();
        }
    }

    initDataTable() {
        const container = document.getElementById('licenses-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchLicenses(params),
            columns: [
                {
                    key: 'icon',
                    label: this.__('actions.preview'),
                    sortable: false,
                    preview: true,
                    render: () => `
                        <div class="data-table-icon-cell">
                            <i class="ti ti-key"></i>
                        </div>
                    `
                },
                {
                    key: 'license_key',
                    label: this.__('licenses.fields.code'),
                    title: true,
                    render: (value) => `<code class="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">${escapeHTML(value || '-')}</code>`
                },
                {
                    key: 'company_name',
                    label: this.__('licenses.fields.company'),
                    render: (value) => escapeHTML(value || '-')
                },
                {
                    key: 'plan',
                    label: this.__('licenses.fields.plan'),
                    render: (value, row) => {
                        // API returns 'type' field, not 'plan'
                        const planValue = row.type || row.plan || value;
                        const badges = {
                            'Enterprise': 'badge-danger',
                            'enterprise': 'badge-danger',
                            'Professional': 'badge-warning',
                            'professional': 'badge-warning',
                            'Standard': 'badge-info',
                            'standard': 'badge-info',
                            'Free': 'badge-secondary',
                            'free': 'badge-secondary'
                        };
                        const slug = (planValue || '').toLowerCase();
                        const i18nKey = `licenses.plans.names.${slug}`;
                        const localized = this.__(i18nKey);
                        const displayName = (localized && localized !== i18nKey) ? localized : (planValue ? planValue.charAt(0).toUpperCase() + planValue.slice(1).toLowerCase() : '-');
                        return `<span class="badge ${badges[planValue] || 'badge-secondary'}">${escapeHTML(displayName)}</span>`;
                    }
                },
                {
                    key: 'max_devices',
                    label: this.__('licenses.fields.deviceLimit'),
                    render: (value, row) => {
                        // Per-device-type pricing shows badge instead of flat count
                        if (row.pricing_mode === 'per_device_type') {
                            return `<span class="badge badge-info">${this.__('licenses.plans.form.pricingModePerDeviceType')}</span>`;
                        }
                        // Plan bazlı limit: max_devices from license_plans
                        const limit = row.max_devices ?? row.device_limit;
                        const isUnlimited = limit === null || limit === 0 || limit === -1 ||
                            ['enterprise', 'ultimate', 'unlimited'].includes(row.plan_type?.toLowerCase());
                        if (isUnlimited) {
                            return `<span class="badge badge-success">${this.__('licenses.fields.unlimited')}</span>`;
                        }
                        return limit?.toLocaleString('tr-TR') || '-';
                    }
                },
                {
                    key: 'starts_at',
                    label: this.__('licenses.fields.startDate'),
                    type: 'date',
                    render: (value, row) => {
                        const date = row.starts_at || row.valid_from;
                        if (!date) return '-';
                        return new Date(date).toLocaleDateString('tr-TR');
                    }
                },
                {
                    key: 'expires_at',
                    label: this.__('licenses.fields.endDate'),
                    type: 'date',
                    render: (value, row) => {
                        const date = row.expires_at || row.valid_until;
                        if (!date) return `<span class="badge badge-success">${this.__('licenses.plans.lifetime')}</span>`;
                        return new Date(date).toLocaleDateString('tr-TR');
                    }
                },
                {
                    key: 'status',
                    label: this.__('licenses.fields.status'),
                    render: (value, row) => {
                        const { badge, text } = this.getStatusInfo(row);
                        return `<span class="badge ${badge}">${text}</span>`;
                    }
                }
            ],
            actions: [
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('auditLog.title'),
                    onClick: (row) => this.showHistory(row)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('actions.preview'),
                    onClick: (row) => this.viewDetails(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    condition: () => this.isSuperAdmin(),
                    onClick: (row) => this.showEditModal(row)
                },
                {
                    name: 'payment',
                    icon: 'ti-credit-card',
                    label: this.__('licenses.payment.renewWithPayment'),
                    class: 'btn-ghost text-success',
                    condition: () => this.paymentSettings?.is_active,
                    onClick: (row) => this.showPaymentModal(row)
                },
                {
                    name: 'extend',
                    icon: 'ti-calendar-plus',
                    label: this.__('licenses.buttons.extend'),
                    condition: () => this.isSuperAdmin(),
                    onClick: (row) => this.extend(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-ban',
                    label: this.__('licenses.buttons.revoke'),
                    class: 'btn-ghost text-danger',
                    condition: () => this.isSuperAdmin(),
                    onClick: (row) => this.revoke(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            searchPlaceholder: this.__('licenses.placeholders.search'),
            emptyText: this.__('licenses.empty'),
            emptyIcon: 'ti-license-off'
        });
    }

    async fetchLicenses(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            const response = await this.app.api.get(`/licenses?${queryParams}`);

            // Handle both response formats:
            // Old: response.data is array directly
            // New: response.data is {licenses: [], limits: {}}
            let licenses = [];
            let limits = null;

            if (response.data) {
                if (Array.isArray(response.data)) {
                    // Old format - direct array
                    licenses = response.data;
                } else if (response.data.licenses) {
                    // New format - object with licenses and limits
                    licenses = response.data.licenses || [];
                    limits = response.data.limits || null;
                } else {
                    // Fallback
                    licenses = [];
                }
            }

            this.updateStatsFromData(licenses);

            // Update license limits display
            if (limits) {
                this.updateLimitsDisplay(limits);
            }

            return {
                data: licenses,
                total: response.meta?.total || licenses.length
            };
        } catch (error) {
            Logger.error('Licenses fetch error:', error);
            return { data: [], total: 0 };
        }
    }

    /**
     * Update license limits display cards
     */
    updateLimitsDisplay(limits) {
        const formatLimit = (value) => {
            if (value === -1 || value === null || value === undefined) {
                return '∞';
            }
            return value.toLocaleString('tr-TR');
        };

        const formatStorage = (value) => {
            if (value === -1 || value === null || value === undefined) {
                return '∞';
            }
            // Assume value is in MB
            if (value >= 1024) {
                return (value / 1024).toFixed(0) + ' GB';
            }
            return value + ' MB';
        };

        // Update each limit card
        const userEl = document.getElementById('limit-users');
        const deviceEl = document.getElementById('limit-devices');
        const productEl = document.getElementById('limit-products');
        const templateEl = document.getElementById('limit-templates');
        const branchEl = document.getElementById('limit-branches');
        const storageEl = document.getElementById('limit-storage');

        if (userEl) userEl.textContent = formatLimit(limits.max_users);
        if (deviceEl) deviceEl.textContent = formatLimit(limits.max_devices);
        if (productEl) productEl.textContent = formatLimit(limits.max_products);
        if (templateEl) templateEl.textContent = formatLimit(limits.max_templates);
        if (branchEl) branchEl.textContent = formatLimit(limits.max_branches);
        if (storageEl) storageEl.textContent = formatStorage(limits.max_storage);
    }

    async loadCompanies() {
        try {
            const response = await this.app.api.get('/companies');
            this.companies = response.data || [];
        } catch (error) {
            Logger.error('Companies load error:', error);
        }
    }

    updateStatsFromData(licenses) {
        const now = new Date();
        const isRevoked = (l) => l.status === 'revoked' || l.status === 'cancelled';

        const active = licenses.filter(l => {
            const expires = new Date(l.expires_at);
            return expires > now && !isRevoked(l);
        });

        const expiring = active.filter(l => {
            const expires = new Date(l.expires_at);
            const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
            return daysLeft < 30 && daysLeft >= 0;
        });

        const expired = licenses.filter(l => {
            const expires = new Date(l.expires_at);
            return expires < now || isRevoked(l);
        });

        this.stats = {
            active: active.length,
            expiring: expiring.length,
            expired: expired.length
        };

        document.getElementById('stat-active').textContent = this.stats.active;
        document.getElementById('stat-expiring').textContent = this.stats.expiring;
        document.getElementById('stat-expired').textContent = this.stats.expired;

        // Show/hide warning badges
        const expiringBadge = document.getElementById('expiring-badge');
        const expiredBadge = document.getElementById('expired-badge');

        if (expiringBadge) {
            expiringBadge.style.display = this.stats.expiring > 0 ? 'inline-flex' : 'none';
        }
        if (expiredBadge) {
            expiredBadge.style.display = this.stats.expired > 0 ? 'inline-flex' : 'none';
        }
    }

    getStatusInfo(license) {
        const now = new Date();
        const expires = new Date(license.expires_at);
        const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

        // Check for revoked or cancelled status (backward compatibility)
        if (license.status === 'revoked' || license.status === 'cancelled') {
            return { badge: 'badge-danger', text: this.__('licenses.statuses.revoked') };
        }
        if (daysLeft < 0) return { badge: 'badge-danger', text: this.__('licenses.statuses.expired') };
        if (daysLeft < 30) return { badge: 'badge-warning', text: this.__('licenses.statuses.daysLeft', { count: daysLeft }) };
        return { badge: 'badge-success', text: this.__('licenses.statuses.active') };
    }

    bindEvents() {
        document.getElementById('generate-license-btn')?.addEventListener('click', () => {
            this.showGenerateModal();
        });
    }

    showHistory(license) {
        Toast.info(this.__('licenses.featureComingSoon'));
    }

    async viewDetails(license) {
        const { badge, text } = this.getStatusInfo(license);

        // Fetch additional license details and usage data
        let usageData = null;
        let historyData = [];
        try {
            const response = await this.app.api.get(`/licenses/${license.id}`);
            if (response.success && response.data) {
                usageData = response.data.usage || null;
                historyData = response.data.history || [];
            }
        } catch (error) {
            Logger.debug('Could not load license details:', error);
        }

        const modalContent = `
            <div class="license-detail-modal">
                <!-- Modal Tabs -->
                <div class="modal-tabs">
                    <button type="button" class="modal-tab active" data-tab="info">
                        <i class="ti ti-info-circle"></i> ${this.__('licenses.tabs.info')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="usage">
                        <i class="ti ti-chart-bar"></i> ${this.__('licenses.tabs.usage')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="limits">
                        <i class="ti ti-adjustments"></i> ${this.__('licenses.tabs.limits')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="history">
                        <i class="ti ti-history"></i> ${this.__('licenses.tabs.history')}
                    </button>
                </div>

                <!-- Info Tab -->
                <div id="modal-tab-info" class="modal-tab-content active">
                    <div class="license-key-card">
                        <p class="text-sm text-muted mb-1">${this.__('licenses.fields.code')}</p>
                        <code class="license-key-code">${escapeHTML(license.license_key || '-')}</code>
                    </div>
                    <div class="license-info-grid">
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.company')}</label>
                            <p class="font-medium">${escapeHTML(license.company_name || '-')}</p>
                        </div>
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.plan')}</label>
                            <p class="font-medium">
                                <span class="badge ${this.getPlanBadgeClass(license.plan)}">${escapeHTML(this.getLocalizedPlanName({ slug: (license.plan || '').toLowerCase(), name: license.plan }))}</span>
                            </p>
                        </div>
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.status')}</label>
                            <p><span class="badge ${badge}">${text}</span></p>
                        </div>
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.deviceLimit')}</label>
                            <p class="font-medium">${license.device_limit || this.__('licenses.fields.unlimited')}</p>
                        </div>
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.startDate')}</label>
                            <p class="font-medium">${license.starts_at ? new Date(license.starts_at).toLocaleDateString('tr-TR') : '-'}</p>
                        </div>
                        <div class="license-info-item">
                            <label class="text-sm text-muted">${this.__('licenses.fields.endDate')}</label>
                            <p class="font-medium">${license.expires_at ? new Date(license.expires_at).toLocaleDateString('tr-TR') : '-'}</p>
                        </div>
                    </div>
                    ${license.note ? `
                    <div class="license-note-section">
                        <label class="text-sm text-muted">${this.__('licenses.fields.note')}</label>
                        <p class="license-note-text">${escapeHTML(license.note)}</p>
                    </div>
                    ` : ''}
                </div>

                <!-- Usage Tab -->
                <div id="modal-tab-usage" class="modal-tab-content" style="display: none;">
                    ${this.renderUsageTab(usageData, license)}
                </div>

                <!-- Limits Tab -->
                <div id="modal-tab-limits" class="modal-tab-content" style="display: none;">
                    ${this.renderLimitsTab(license)}
                </div>

                <!-- History Tab -->
                <div id="modal-tab-history" class="modal-tab-content" style="display: none;">
                    ${this.renderHistoryTab(historyData)}
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('licenses.detail'),
            icon: 'ti-key',
            size: 'lg',
            content: modalContent,
            showConfirm: false,
            cancelText: this.__('modal.close')
        });

        // Bind tab events after modal is shown
        setTimeout(() => this.bindLicenseDetailTabs(), 100);
    }

    renderUsageTab(usageData, license) {
        const usage = usageData || {
            activeDevices: license.device_count || 0,
            activeUsers: license.user_count || 0,
            storageUsed: 0,
            apiCalls: 0
        };

        return `
            <div class="license-usage-section">
                <div class="usage-stats-grid">
                    <div class="usage-stat-card">
                        <div class="usage-stat-icon" style="background: rgba(34, 139, 230, 0.1); color: #228be6;">
                            <i class="ti ti-device-desktop"></i>
                        </div>
                        <div class="usage-stat-info">
                            <p class="usage-stat-value">${usage.activeDevices}</p>
                            <p class="usage-stat-label">${this.__('licenses.usage.activeDevices')}</p>
                        </div>
                    </div>
                    <div class="usage-stat-card">
                        <div class="usage-stat-icon" style="background: rgba(64, 192, 87, 0.1); color: #40c057;">
                            <i class="ti ti-users"></i>
                        </div>
                        <div class="usage-stat-info">
                            <p class="usage-stat-value">${usage.activeUsers}</p>
                            <p class="usage-stat-label">${this.__('licenses.usage.activeUsers')}</p>
                        </div>
                    </div>
                    <div class="usage-stat-card">
                        <div class="usage-stat-icon" style="background: rgba(250, 176, 5, 0.1); color: #fab005;">
                            <i class="ti ti-database"></i>
                        </div>
                        <div class="usage-stat-info">
                            <p class="usage-stat-value">${this.formatStorage(usage.storageUsed)}</p>
                            <p class="usage-stat-label">${this.__('licenses.usage.storageUsed')}</p>
                        </div>
                    </div>
                    <div class="usage-stat-card">
                        <div class="usage-stat-icon" style="background: rgba(190, 75, 219, 0.1); color: #be4bdb;">
                            <i class="ti ti-api"></i>
                        </div>
                        <div class="usage-stat-info">
                            <p class="usage-stat-value">${this.formatNumber(usage.apiCalls)}</p>
                            <p class="usage-stat-label">${this.__('licenses.usage.apiCalls')} (${this.__('licenses.usage.thisMonth')})</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLimitsTab(license) {
        // Plan bazlı limitler - license_plans tablosundan gelen değerler kullanılır
        // Sınırsız plan tipleri kontrol edilir: enterprise, ultimate, unlimited
        const isUnlimitedPlan = ['enterprise', 'ultimate', 'unlimited'].includes(license.plan_type?.toLowerCase());

        // Helper: Sınırsız değer kontrolü
        const isUnlimitedValue = (val) => val === null || val === undefined || val === 0 || val === -1 || isUnlimitedPlan;

        const limits = [
            { key: 'max_devices', label: this.__('licenses.fields.deviceLimit'), icon: 'ti-device-desktop', used: license.device_count || 0 },
            { key: 'max_users', label: this.__('licenses.limits.userLimit'), icon: 'ti-users', used: license.user_count || 0 },
            { key: 'max_branches', label: this.__('licenses.limits.branchLimit'), icon: 'ti-building-store', used: license.branch_count || 0 },
            { key: 'max_storage', label: this.__('licenses.limits.storageLimit'), icon: 'ti-database', used: license.storage_used || 0, isStorage: true },
            { key: 'max_templates', label: this.__('licenses.limits.templateLimit'), icon: 'ti-layout', used: license.template_count || 0 },
            { key: 'max_products', label: this.__('licenses.limits.productLimit'), icon: 'ti-package', used: license.product_count || 0 }
        ];

        return `
            <div class="license-limits-section">
                <div class="limits-list">
                    ${limits.map(limit => {
                        const max = license[limit.key];
                        const isUnlimited = isUnlimitedValue(max);
                        const percentage = isUnlimited ? 0 : Math.min(100, (limit.used / max) * 100);
                        const usedText = limit.isStorage ? this.formatStorage(limit.used) : limit.used;
                        const maxText = limit.isStorage ? this.formatStorage(max) : max;

                        return `
                            <div class="limit-item">
                                <div class="limit-header">
                                    <div class="limit-label">
                                        <i class="${limit.icon}"></i>
                                        <span>${limit.label}</span>
                                    </div>
                                    <div class="limit-value">
                                        ${isUnlimited
                                            ? `<span class="badge badge-success">${this.__('licenses.limits.unlimitedLabel')}</span>`
                                            : `<span class="font-medium">${usedText}</span> / <span>${maxText}</span>`
                                        }
                                    </div>
                                </div>
                                ${!isUnlimited ? `
                                <div class="limit-progress">
                                    <div class="limit-progress-bar ${percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : ''}" style="width: ${percentage}%"></div>
                                </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderHistoryTab(historyData) {
        if (!historyData || historyData.length === 0) {
            return `
                <div class="license-history-empty">
                    <i class="ti ti-history"></i>
                    <p>${this.__('licenses.historyTable.noHistory')}</p>
                </div>
            `;
        }

        return `
            <div class="license-history-section">
                <table class="license-history-table">
                    <thead>
                        <tr>
                            <th>${this.__('licenses.historyTable.date')}</th>
                            <th>${this.__('licenses.historyTable.action')}</th>
                            <th>${this.__('licenses.historyTable.details')}</th>
                            <th>${this.__('licenses.historyTable.user')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historyData.map(item => `
                            <tr>
                                <td>${new Date(item.created_at).toLocaleString('tr-TR')}</td>
                                <td><span class="badge badge-${this.getActionBadgeClass(item.action)}">${escapeHTML(item.action)}</span></td>
                                <td>${escapeHTML(item.details || '-')}</td>
                                <td>${escapeHTML(item.user_name || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    bindLicenseDetailTabs() {
        document.querySelectorAll('.license-detail-modal .modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.license-detail-modal .modal-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update tab content
                document.querySelectorAll('.license-detail-modal .modal-tab-content').forEach(content => {
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

    getPlanBadgeClass(plan) {
        const badges = {
            'Enterprise': 'badge-danger',
            'Professional': 'badge-warning',
            'Standard': 'badge-info',
            'Free': 'badge-secondary'
        };
        return badges[plan] || 'badge-secondary';
    }

    getActionBadgeClass(action) {
        const badges = {
            'create': 'info',
            'extend': 'success',
            'revoke': 'danger',
            'update': 'warning'
        };
        return badges[action] || 'secondary';
    }

    formatStorage(bytes) {
        if (!bytes) return '0 MB';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(1)} GB`;
        }
        return `${mb.toFixed(0)} MB`;
    }

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    }

    showGenerateModal() {
        const today = new Date().toISOString().split('T')[0];
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        const companyOptions = this.companies.map(c =>
            `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`
        ).join('');

        // Dinamik plan seçenekleri - API'den yüklenen planları kullan
        const planOptions = this.licensePlans && this.licensePlans.length > 0
            ? this.licensePlans.map(p => {
                const price = p.pricing?.formatted || (p.price ? `₺${p.price}` : '');
                return `<option value="${escapeHTML(p.slug || p.name)}" ${p.is_popular ? 'selected' : ''}>${escapeHTML(this.getLocalizedPlanName(p))}${price ? ' - ' + escapeHTML(price) : ''}</option>`;
            }).join('')
            : `<option value="Free">${escapeHTML(this.__('licenses.plans.names.free') || 'Free')}</option>
               <option value="Standard">${escapeHTML(this.__('licenses.plans.names.starter') || 'Standard')}</option>
               <option value="Professional" selected>${escapeHTML(this.__('licenses.plans.names.professional') || 'Professional')}</option>
               <option value="Enterprise">${escapeHTML(this.__('licenses.plans.names.enterprise') || 'Enterprise')}</option>`;

        const formContent = `
            <form id="license-form" class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.company')} *</label>
                    <select id="license-company" class="form-select" required>
                        <option value="">${this.__('licenses.placeholders.selectCompany')}</option>
                        ${companyOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.plan')} *</label>
                    <select id="license-plan" class="form-select" required>
                        ${planOptions}
                    </select>
                </div>
                <div id="plan-limits-info" class="plan-limits-info-card" style="display: none;"></div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.fields.startDate')} *</label>
                        <input type="date" id="license-starts" class="form-input" required
                            value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.fields.endDate')} *</label>
                        <input type="date" id="license-expires" class="form-input" required
                            value="${oneYearLater.toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.note')}</label>
                    <textarea id="license-note" class="form-input" rows="2"
                        placeholder="${this.__('licenses.placeholders.note')}"></textarea>
                </div>

                <!-- Per-Device-Type Pricing Section (shown when plan supports it) -->
                <div id="create-device-pricing-section" class="license-device-pricing-section" style="display:none;">
                    <h4><i class="ti ti-category"></i> ${this.__('licenses.pricing.title')}</h4>
                    <div id="create-device-pricing-rows"></div>
                    <div class="exchange-rate-group mt-3">
                        <label class="form-label mb-0">${this.__('licenses.pricing.exchangeRate')}:</label>
                        <input type="number" id="create-exchange-rate" class="form-input form-input-sm" value="1.0" step="0.01" min="0.01">
                        <span class="rate-label">USD \u2192 TRY</span>
                    </div>
                    <div class="pricing-summary-card" id="create-pricing-summary"></div>
                </div>
            </form>
        `;

        // Plan seçildiğinde plan limitlerini göster ve device pricing
        setTimeout(() => {
            const planSelect = document.getElementById('license-plan');
            if (planSelect) {
                planSelect.addEventListener('change', (e) => {
                    this.showPlanLimitsInfo(e.target.value, 'plan-limits-info');
                    this._showDevicePricingForPlan(e.target.value, 'create');
                });
                // İlk yüklemede de göster
                if (planSelect.value) {
                    this.showPlanLimitsInfo(planSelect.value, 'plan-limits-info');
                    this._showDevicePricingForPlan(planSelect.value, 'create');
                }
            }
        }, 100);

        Modal.show({
            title: this.__('licenses.addLicense'),
            icon: 'ti-key',
            content: formContent,
            size: 'lg',
            confirmText: this.__('licenses.buttons.create'),
            cancelText: this.__('licenses.buttons.cancel'),
            onConfirm: async () => {
                await this.createLicense();
            }
        });
    }

    async createLicense() {
        const company_id = document.getElementById('license-company')?.value;
        const planSlug = document.getElementById('license-plan')?.value;
        const starts_at = document.getElementById('license-starts')?.value;
        const expires_at = document.getElementById('license-expires')?.value;
        const note = document.getElementById('license-note')?.value?.trim();

        if (!company_id) {
            Toast.error(this.__('validation.required'));
            throw new Error('Validation failed');
        }
        if (!starts_at || !expires_at) {
            Toast.error(this.__('validation.required'));
            throw new Error('Validation failed');
        }

        // Plan slug'dan plan_id bul
        const selectedPlan = this.licensePlans?.find(p => p.slug === planSlug || p.name === planSlug);
        const plan_id = selectedPlan?.id || null;

        // Collect per-device-type pricing data if available
        const devicePricing = this._collectDevicePricingData('create');
        const exchangeRate = parseFloat(document.getElementById('create-exchange-rate')?.value) || 1.0;

        const payload = {
            company_id,
            plan: planSlug,
            plan_id: plan_id,
            type: selectedPlan?.plan_type || planSlug,
            starts_at,
            expires_at,
            note
        };

        // Add per-device-type pricing if present
        if (devicePricing && devicePricing.length > 0) {
            payload.pricing_mode = 'per_device_type';
            payload.device_pricing = devicePricing;
            payload.exchange_rate = exchangeRate;
            payload.base_currency = devicePricing[0]?.currency || 'USD';
        }

        try {
            await this.app.api.post('/licenses', payload);
            Toast.success(this.__('licenses.toast.created'));
            this.dataTable?.refresh();
        } catch (error) {
            Toast.error(error.message || this.__('messages.saveFailed'));
            throw error;
        }
    }

    showEditModal(license) {
        // Dinamik plan seçenekleri
        const planOptions = this.licensePlans && this.licensePlans.length > 0
            ? this.licensePlans.map(p => {
                const isSelected = (license.plan === p.name || license.plan === p.slug || license.type === p.name || license.type === p.slug);
                return `<option value="${escapeHTML(p.slug || p.name)}" ${isSelected ? 'selected' : ''}>${escapeHTML(this.getLocalizedPlanName(p))}</option>`;
            }).join('')
            : `<option value="Free" ${license.plan === 'Free' || license.type === 'Free' ? 'selected' : ''}>${escapeHTML(this.__('licenses.plans.names.free') || 'Free')}</option>
               <option value="Standard" ${license.plan === 'Standard' || license.type === 'Standard' ? 'selected' : ''}>${escapeHTML(this.__('licenses.plans.names.starter') || 'Standard')}</option>
               <option value="Professional" ${license.plan === 'Professional' || license.type === 'Professional' ? 'selected' : ''}>${escapeHTML(this.__('licenses.plans.names.professional') || 'Professional')}</option>
               <option value="Enterprise" ${license.plan === 'Enterprise' || license.type === 'Enterprise' ? 'selected' : ''}>${escapeHTML(this.__('licenses.plans.names.enterprise') || 'Enterprise')}</option>`;

        const companyOptions = this.companies.map(c =>
            `<option value="${escapeHTML(c.id)}" ${c.id === license.company_id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
        ).join('');

        const formContent = `
            <form id="edit-license-form" class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.company')} *</label>
                    <select id="edit-license-company" class="form-select" required>
                        <option value="">${this.__('licenses.placeholders.selectCompany')}</option>
                        ${companyOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.plan')} *</label>
                    <select id="edit-license-plan" class="form-select" required>
                        ${planOptions}
                    </select>
                </div>
                <div id="edit-plan-limits-info" class="plan-limits-info-card" style="display: none;"></div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.fields.startDate')} *</label>
                        <input type="date" id="edit-license-starts" class="form-input" required
                            value="${license.starts_at ? license.starts_at.split('T')[0].split(' ')[0] : (license.valid_from ? license.valid_from.split('T')[0].split(' ')[0] : '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.fields.endDate')} *</label>
                        <input type="date" id="edit-license-expires" class="form-input" required
                            value="${license.expires_at ? license.expires_at.split('T')[0].split(' ')[0] : (license.valid_until ? license.valid_until.split('T')[0].split(' ')[0] : '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.status')}</label>
                    <select id="edit-license-status" class="form-select">
                        <option value="active" ${license.status === 'active' ? 'selected' : ''}>${this.__('licenses.statuses.active')}</option>
                        <option value="expired" ${license.status === 'expired' ? 'selected' : ''}>${this.__('licenses.statuses.expired')}</option>
                        <option value="revoked" ${(license.status === 'revoked' || license.status === 'cancelled') ? 'selected' : ''}>${this.__('licenses.statuses.revoked')}</option>
                    </select>
                </div>

                <!-- Per-Device-Type Pricing Section -->
                <div id="edit-device-pricing-section" class="license-device-pricing-section" style="display:none;">
                    <h4><i class="ti ti-category"></i> ${this.__('licenses.pricing.title')}</h4>
                    <div id="edit-device-pricing-rows"></div>
                    <div class="exchange-rate-group mt-3">
                        <label class="form-label mb-0">${this.__('licenses.pricing.exchangeRate')}:</label>
                        <input type="number" id="edit-exchange-rate" class="form-input form-input-sm" value="${license.exchange_rate || 1.0}" step="0.01" min="0.01">
                        <span class="rate-label">USD \u2192 TRY</span>
                    </div>
                    <div class="pricing-summary-card" id="edit-pricing-summary"></div>
                </div>
            </form>
        `;

        // Plan seçildiğinde plan limitlerini göster ve device pricing
        setTimeout(() => {
            const planSelect = document.getElementById('edit-license-plan');
            if (planSelect) {
                planSelect.addEventListener('change', (e) => {
                    this.showPlanLimitsInfo(e.target.value, 'edit-plan-limits-info');
                    this._showDevicePricingForPlan(e.target.value, 'edit');
                });
                // İlk yüklemede de göster
                if (planSelect.value) {
                    this.showPlanLimitsInfo(planSelect.value, 'edit-plan-limits-info');
                    this._showDevicePricingForPlan(planSelect.value, 'edit', license);
                }
            }
        }, 100);

        Modal.show({
            title: this.__('licenses.editLicense'),
            icon: 'ti-edit',
            content: formContent,
            size: 'lg',
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.updateLicense(license.id);
            }
        });
    }

    async updateLicense(licenseId) {
        const company_id = document.getElementById('edit-license-company')?.value;
        const planSlug = document.getElementById('edit-license-plan')?.value;
        const starts_at = document.getElementById('edit-license-starts')?.value;
        const expires_at = document.getElementById('edit-license-expires')?.value;
        const status = document.getElementById('edit-license-status')?.value;

        if (!company_id) {
            Toast.error(this.__('validation.required'));
            throw new Error('Validation failed');
        }
        if (!starts_at || !expires_at) {
            Toast.error(this.__('validation.required'));
            throw new Error('Validation failed');
        }

        // Plan slug'dan plan_id bul
        const selectedPlan = this.licensePlans?.find(p => p.slug === planSlug || p.name === planSlug);
        const plan_id = selectedPlan?.id || null;

        // Collect per-device-type pricing data if available
        const devicePricing = this._collectDevicePricingData('edit');
        const exchangeRate = parseFloat(document.getElementById('edit-exchange-rate')?.value) || 1.0;

        const payload = {
            company_id,
            plan: planSlug,
            plan_id: plan_id,
            type: selectedPlan?.plan_type || planSlug,
            starts_at,
            valid_from: starts_at,
            expires_at,
            valid_until: expires_at,
            status
        };

        // Add per-device-type pricing if present
        if (devicePricing && devicePricing.length > 0) {
            payload.pricing_mode = 'per_device_type';
            payload.device_pricing = devicePricing;
            payload.exchange_rate = exchangeRate;
            payload.base_currency = devicePricing[0]?.currency || 'USD';
        }

        try {
            await this.app.api.put(`/licenses/${licenseId}`, payload);
            Toast.success(this.__('licenses.toast.updated'));
            this.dataTable?.refresh();
        } catch (error) {
            Toast.error(error.message || this.__('messages.updateFailed'));
            throw error;
        }
    }

    extend(license) {
        // Handle null/invalid expires_at - default to today
        const currentExpiry = license.expires_at ? new Date(license.expires_at) : new Date();
        // Check if date is valid, if not use today
        const validCurrentExpiry = isNaN(currentExpiry.getTime()) ? new Date() : currentExpiry;
        const newExpiry = new Date(validCurrentExpiry);
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        const formContent = `
            <div class="space-y-4">
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p class="text-sm text-muted">${this.__('licenses.fields.currentExpiry')}</p>
                    <p class="font-medium">${license.expires_at ? new Date(license.expires_at).toLocaleDateString('tr-TR') : '-'}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('licenses.fields.newExpiry')} *</label>
                    <input type="date" id="new-expiry-date" class="form-input" required
                        value="${newExpiry.toISOString().split('T')[0]}">
                </div>
                <div class="flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline flex-1" data-months="1">${this.__('licenses.quickAdd.month1')}</button>
                    <button type="button" class="btn btn-sm btn-outline flex-1" data-months="3">${this.__('licenses.quickAdd.month3')}</button>
                    <button type="button" class="btn btn-sm btn-outline flex-1" data-months="6">${this.__('licenses.quickAdd.month6')}</button>
                    <button type="button" class="btn btn-sm btn-outline flex-1" data-months="12">${this.__('licenses.quickAdd.year1')}</button>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: this.__('licenses.extendLicense'),
            icon: 'ti-calendar-plus',
            content: formContent,
            size: 'sm',
            confirmText: this.__('licenses.buttons.extend'),
            cancelText: this.__('licenses.buttons.cancel'),
            onConfirm: async () => {
                const newExpiryDate = document.getElementById('new-expiry-date')?.value;
                if (!newExpiryDate) {
                    Toast.error(this.__('validation.required'));
                    throw new Error('Validation failed');
                }
                try {
                    await this.app.api.put(`/licenses/${license.id}`, { expires_at: newExpiryDate });
                    Toast.success(this.__('licenses.toast.extended'));
                    this.dataTable?.refresh();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.updateFailed'));
                    throw error;
                }
            }
        });

        // Quick add buttons
        setTimeout(() => {
            const quickAddBtns = modal.element.querySelectorAll('[data-months]');
            quickAddBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active state from all buttons
                    quickAddBtns.forEach(b => {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-outline');
                    });
                    // Add active state to clicked button
                    btn.classList.remove('btn-outline');
                    btn.classList.add('btn-primary');

                    const months = parseInt(btn.dataset.months);
                    const inputValue = document.getElementById('new-expiry-date').value;
                    let current = inputValue ? new Date(inputValue) : new Date(validCurrentExpiry);
                    // Validate date
                    if (isNaN(current.getTime())) {
                        current = new Date();
                    }
                    current.setMonth(current.getMonth() + months);
                    document.getElementById('new-expiry-date').value = current.toISOString().split('T')[0];
                });
            });
        }, 100);
    }

    revoke(license) {
        Modal.confirm({
            title: this.__('licenses.revokeLicense'),
            message: this.__('licenses.revokeConfirm'),
            type: 'danger',
            confirmText: this.__('licenses.buttons.revoke'),
            cancelText: this.__('licenses.buttons.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.post(`/licenses/${license.id}/revoke`);
                    Toast.success(this.__('licenses.toast.revoked'));
                    this.dataTable?.refresh();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    // =========================================
    // Payment Methods
    // =========================================

    async loadPaymentInfo() {
        try {
            // Load license plans (public endpoint - also returns payment status)
            const plansResponse = await this.app.api.get('/payments/plans?include_inactive=1');

            if (plansResponse.success) {
                // New format: { plans: [...], payment_active: bool, provider: string }
                const data = plansResponse.data || {};
                this.licensePlans = Array.isArray(data.plans)
                    ? data.plans
                    : (Array.isArray(data) ? data : []);

                // Set payment settings based on plans response
                this.paymentSettings = {
                    is_active: data.payment_active === true && this.licensePlans.length > 0,
                    provider: data.provider || null
                };
            }

            // SuperAdmin can also fetch detailed settings
            try {
                const provider = this.paymentSettings?.provider;
                const query = provider
                    ? `/payments/settings?provider=${encodeURIComponent(provider)}`
                    : '/payments/settings';
                const settingsResponse = await this.app.api.get(query);

                if (settingsResponse.success) {
                    const settings = settingsResponse.data?.settings || null;

                    if (settings) {
                        // Normalize: API may return status, is_active or both
                        const isActive = settings.status === 'active'
                            || settings.is_active === true
                            || settings.is_active === 1;
                        this.paymentSettings = {
                            ...this.paymentSettings,
                            ...settings,
                            is_active: isActive,
                            provider: settings.provider || this.paymentSettings?.provider || null
                        };
                    }
                }
            } catch (e) {
                // Non-SuperAdmin can't access settings - that's ok, we already have status from plans
            }
        } catch (error) {
            Logger.warn('Payment info load error:', error);
            this.paymentSettings = null;
        }
    }

    resolvePlanByValue(planValue) {
        return this.licensePlans.find(p =>
            p.slug === planValue || p.name === planValue
        );
    }

    getLocalizedPlanName(plan) {
        if (!plan) return '';
        const slug = (plan.slug || '').toLowerCase();
        const i18nKey = `licenses.plans.names.${slug}`;
        const localized = this.__(i18nKey);
        return (localized && localized !== i18nKey) ? localized : (plan.name || plan.slug || '');
    }

    getLocalizedPlanDescription(plan) {
        if (!plan) return '';
        const slug = (plan.slug || '').toLowerCase();
        const i18nKey = `licenses.plans.descriptions.${slug}`;
        const localized = this.__(i18nKey);
        return (localized && localized !== i18nKey) ? localized : (plan.description || '');
    }

    isPerDevicePricing(plan) {
        const features = Array.isArray(plan?.features) ? plan.features : [];
        return plan?.pricing_mode === 'per_device'
            || features.includes('per_device_pricing')
            || plan?.plan_type === 'per_device';
    }

    isPerDeviceTypePricing(plan, license = null) {
        return plan?.pricing_mode === 'per_device_type'
            || license?.pricing_mode === 'per_device_type';
    }

    getPeriodMonths(period, plan) {
        const defaultMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        if (period === 'monthly') return 1;
        if (period === 'yearly') return 12;
        if (period === 'lifetime') return 1200;
        return defaultMonths;
    }

    getPerDeviceUnitPrice(plan) {
        const apiUnitPrice = parseFloat(plan?.device_unit_price);
        if (!Number.isNaN(apiUnitPrice) && apiUnitPrice > 0) {
            return apiUnitPrice;
        }

        const planPrice = parseFloat(plan?.price) || 0;
        const durationMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        return planPrice / durationMonths;
    }

    getPerDeviceTypeMonthlyTotal(license) {
        const monthlyTotal = parseFloat(license?.total_monthly_price);
        return Number.isFinite(monthlyTotal) && monthlyTotal > 0 ? monthlyTotal : 0;
    }

    getBillableDeviceCount(license, plan, requestedCount = null) {
        const fromLicense = parseInt(license?.assigned_devices ?? license?.device_count ?? 0, 10) || 0;
        const maxDevices = parseInt(plan?.max_devices, 10);
        let billable = requestedCount !== null
            ? (parseInt(requestedCount, 10) || 0)
            : fromLicense;

        if (billable <= 0) {
            billable = fromLicense;
        }

        if (!Number.isNaN(maxDevices) && maxDevices > 0 && billable > maxDevices) {
            billable = maxDevices;
        }

        return Math.max(1, billable);
    }

    calculatePlanAmount(plan, license, period, requestedDeviceCount = null) {
        const planPrice = parseFloat(plan?.price) || 0; // TL
        const durationMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        const periodMonths = this.getPeriodMonths(period, plan);
        const monthlyEquivalent = planPrice / durationMonths;

        let amount = monthlyEquivalent * periodMonths;
        if (this.isPerDeviceTypePricing(plan, license)) {
            amount = this.getPerDeviceTypeMonthlyTotal(license) * periodMonths;
        } else if (this.isPerDevicePricing(plan)) {
            const billableDeviceCount = this.getBillableDeviceCount(license, plan, requestedDeviceCount);
            amount = this.getPerDeviceUnitPrice(plan) * periodMonths * billableDeviceCount;
        }

        return Math.max(0, amount);
    }

    formatPaymentAmount(amount, currency = 'TRY') {
        if (!amount || amount <= 0) return '-';
        try {
            return new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency
            }).format(amount);
        } catch (e) {
            return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`;
        }
    }

    showPaymentModal(license) {
        if (!this.paymentSettings?.is_active) {
            Toast.error(this.__('licenses.payment.systemNotActive'));
            return;
        }

        // Find current plan
        const currentPlan = this.licensePlans.find(p =>
            p.id === license.plan_id
            || p.slug === license.plan_slug
            || p.name === license.plan
            || p.slug === license.plan?.toLowerCase()
        );

        const planOptions = this.licensePlans
            .filter((p) => {
                if (!p.is_active) {
                    return false;
                }

                if (license?.pricing_mode === 'per_device_type' && currentPlan?.id && p.id !== currentPlan.id) {
                    return false;
                }

                return this.calculatePlanAmount(p, license, 'yearly') > 0;
            })
            .map(p => `
                <option value="${escapeHTML(p.slug || p.name)}" ${(p.id === currentPlan?.id || p.name === license.plan) ? 'selected' : ''}>
                    ${escapeHTML(this.getLocalizedPlanName(p))} ${p.is_featured ? `(${this.__('actions.recommended')})` : ''}
                </option>
            `).join('');

        const formContent = `
            <div class="space-y-4">
                <div class="alert alert-info">
                    <div class="flex items-center gap-2">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('licenses.payment.autoExtendInfo')}</span>
                    </div>
                </div>

                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p class="text-sm text-muted">${this.__('licenses.payment.currentLicense')}</p>
                    <p class="font-medium">${escapeHTML(license.company_name || '-')}</p>
                    <p class="text-sm text-muted mt-1">${this.__('licenses.payment.expires')}: ${license.expires_at ? new Date(license.expires_at).toLocaleDateString('tr-TR') : '-'}</p>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.payment.plan')} *</label>
                    <select id="payment-plan" class="form-select" required>
                        ${planOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.payment.period')} *</label>
                    <div class="grid grid-cols-3 gap-2" id="payment-period-options">
                        <label class="payment-period-option">
                            <input type="radio" name="payment-period" value="monthly" class="sr-only">
                            <div class="payment-period-card">
                                <span class="payment-period-label">${this.__('licenses.payment.monthly')}</span>
                                <span class="payment-period-price" id="price-monthly">-</span>
                            </div>
                        </label>
                        <label class="payment-period-option">
                            <input type="radio" name="payment-period" value="yearly" checked class="sr-only">
                            <div class="payment-period-card active">
                                <span class="payment-period-label">${this.__('licenses.payment.yearly')}</span>
                                <span class="payment-period-price" id="price-yearly">-</span>
                                <span class="payment-period-discount">${this.__('licenses.payment.twoMonthsFree')}</span>
                            </div>
                        </label>
                        <label class="payment-period-option">
                            <input type="radio" name="payment-period" value="lifetime" class="sr-only">
                            <div class="payment-period-card">
                                <span class="payment-period-label">${this.__('licenses.payment.lifetime')}</span>
                                <span class="payment-period-price" id="price-lifetime">-</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.payment.installment')}</label>
                    <select id="payment-installment" class="form-select">
                        <option value="1">${this.__('licenses.payment.singlePayment')}</option>
                        <option value="2">${this.__('licenses.payment.installments', { count: 2 })}</option>
                        <option value="3">${this.__('licenses.payment.installments', { count: 3 })}</option>
                        <option value="6">${this.__('licenses.payment.installments', { count: 6 })}</option>
                        <option value="9">${this.__('licenses.payment.installments', { count: 9 })}</option>
                        <option value="12">${this.__('licenses.payment.installments', { count: 12 })}</option>
                    </select>
                </div>

                <div class="form-group" id="payment-device-count-group" style="display:none;">
                    <label class="form-label">${this.__('licenses.payment.deviceCount')}</label>
                    <input
                        type="number"
                        id="payment-device-count"
                        class="form-input"
                        min="1"
                        step="1"
                        value="${Math.max(1, parseInt(license.assigned_devices ?? license.device_count ?? 1, 10) || 1)}"
                    >
                    <small class="text-muted text-xs">${this.__('licenses.payment.deviceCountHint')}</small>
                </div>

                <div class="bg-primary bg-opacity-10 rounded-lg p-4">
                    <div class="flex justify-between items-center">
                        <span class="font-medium">${this.__('licenses.payment.totalAmount')}:</span>
                        <span class="text-xl font-bold text-primary" id="payment-total">-</span>
                    </div>
                    <div class="text-sm text-muted mt-1" id="payment-device-info"></div>
                </div>
            </div>

            <style>
                .payment-period-option { cursor: pointer; }
                .payment-period-card {
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    transition: all 0.2s;
                }
                .payment-period-card.active {
                    border-color: var(--color-primary);
                    background: rgba(34, 139, 230, 0.05);
                }
                .payment-period-label {
                    display: block;
                    font-size: 0.875rem;
                    color: var(--text-muted);
                }
                .payment-period-price {
                    display: block;
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin-top: 4px;
                }
                .payment-period-discount {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--color-success);
                    margin-top: 4px;
                }
            </style>
        `;

        const modal = Modal.show({
            title: this.__('licenses.payment.title'),
            icon: 'ti-credit-card',
            content: formContent,
            size: 'md',
            confirmText: this.__('licenses.payment.proceedToPayment'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.processPayment(license);
            }
        });

        // Bind events after modal is shown
        setTimeout(() => {
            this.bindPaymentModalEvents(license, modal);
        }, 100);
    }

    bindPaymentModalEvents(license, modal) {
        const planSelect = document.getElementById('payment-plan');
        const periodOptions = document.querySelectorAll('input[name="payment-period"]');
        const deviceCountGroup = document.getElementById('payment-device-count-group');
        const deviceCountInput = document.getElementById('payment-device-count');

        const updatePrices = () => {
            const selectedPlanSlug = planSelect?.value;
            const plan = this.resolvePlanByValue(selectedPlanSlug);

            if (!plan) return;

            const billableDevices = this.getBillableDeviceCount(license, plan, deviceCountInput?.value);
            const monthly = this.calculatePlanAmount(plan, license, 'monthly', billableDevices);
            const yearly = this.calculatePlanAmount(plan, license, 'yearly', billableDevices);
            const lifetime = this.calculatePlanAmount(plan, license, 'lifetime', billableDevices);

            document.getElementById('price-monthly').textContent = this.formatPaymentAmount(monthly, plan.currency || 'TRY');
            document.getElementById('price-yearly').textContent = this.formatPaymentAmount(yearly, plan.currency || 'TRY');
            document.getElementById('price-lifetime').textContent = this.formatPaymentAmount(lifetime, plan.currency || 'TRY');

            // Update total
            const selectedPeriod = document.querySelector('input[name="payment-period"]:checked')?.value;
            const total = this.calculatePlanAmount(plan, license, selectedPeriod || 'yearly', billableDevices);
            document.getElementById('payment-total').textContent = this.formatPaymentAmount(total, plan.currency || 'TRY');

            const deviceInfoEl = document.getElementById('payment-device-info');
            if (deviceInfoEl) {
                if (this.isPerDeviceTypePricing(plan, license)) {
                    if (deviceCountGroup) {
                        deviceCountGroup.style.display = 'none';
                    }
                    const fixedMonthly = this.getPerDeviceTypeMonthlyTotal(license);
                    deviceInfoEl.textContent = fixedMonthly > 0
                        ? `${this.__('licenses.pricing.monthlyTotal')}: ${this.formatPaymentAmount(fixedMonthly, plan.currency || 'TRY')}`
                        : '';
                } else if (this.isPerDevicePricing(plan)) {
                    if (deviceCountGroup) {
                        deviceCountGroup.style.display = '';
                    }
                    if (deviceCountInput) {
                        const maxDevices = parseInt(plan?.max_devices, 10);
                        if (!Number.isNaN(maxDevices) && maxDevices > 0) {
                            deviceCountInput.max = `${maxDevices}`;
                        } else {
                            deviceCountInput.removeAttribute('max');
                        }
                    }

                    const unitMonthly = this.getPerDeviceUnitPrice(plan);
                    deviceInfoEl.textContent = `${this.__('licenses.payment.billedDevices')}: ${billableDevices} (${this.formatPaymentAmount(unitMonthly, plan.currency || 'TRY')} ${this.__('licenses.pricing.perMonth')})`;
                } else {
                    if (deviceCountGroup) {
                        deviceCountGroup.style.display = 'none';
                    }
                    deviceInfoEl.textContent = '';
                }
            }
        };

        // Plan change
        planSelect?.addEventListener('change', updatePrices);

        // Period selection
        periodOptions.forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.payment-period-card').forEach(card => {
                    card.classList.remove('active');
                });
                radio.closest('.payment-period-option').querySelector('.payment-period-card').classList.add('active');
                updatePrices();
            });
        });

        deviceCountInput?.addEventListener('input', updatePrices);

        // Initial update
        updatePrices();
    }

    async processPayment(license) {
        const plan = document.getElementById('payment-plan')?.value;
        const period = document.querySelector('input[name="payment-period"]:checked')?.value;
        const installment = document.getElementById('payment-installment')?.value || 1;

        if (!plan || !period) {
            Toast.error(this.__('licenses.payment.selectPlanAndPeriod'));
            throw new Error('Validation failed');
        }

        // Get plan details for amount
        const selectedPlan = this.resolvePlanByValue(plan);

        if (!selectedPlan) {
            Toast.error(this.__('licenses.payment.planNotFound'));
            throw new Error('Plan not found');
        }

        const billableDevices = this.getBillableDeviceCount(
            license,
            selectedPlan,
            document.getElementById('payment-device-count')?.value
        );
        const amount = this.calculatePlanAmount(selectedPlan, license, period, billableDevices);

        if (amount <= 0) {
            Toast.error(this.__('licenses.payment.noPaymentRequired'));
            throw new Error('No payment required');
        }

        this.showPaymentFormModal({
            amount,
            currency: selectedPlan.currency || 'TRY',
            period,
            installment: parseInt(installment, 10) || 1,
            plan: selectedPlan,
            billable_devices: billableDevices
        }, license);
    }

    showPaymentFormModal(paymentData, license) {
        const formContent = `
            <div class="space-y-4">
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div class="flex justify-between items-center">
                        <span class="text-muted">${this.__('licenses.payment.plan')}:</span>
                        <code class="text-sm">${escapeHTML(this.getLocalizedPlanName(paymentData.plan) || '-')}</code>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-muted">${this.__('licenses.payment.amount')}:</span>
                        <span class="font-bold">${this.formatPaymentAmount(paymentData.amount, paymentData.currency)}</span>
                    </div>
                    ${this.isPerDevicePricing(paymentData.plan) ? `
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-muted">${this.__('licenses.payment.billedDevices')}:</span>
                        <span class="font-medium">${paymentData.billable_devices}</span>
                    </div>` : ''}
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.payment.cardHolderName')} *</label>
                    <input type="text" id="card-holder-name" class="form-input" placeholder="${this.__('licenses.payment.cardHolderNamePlaceholder')}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.payment.cardNumber')} *</label>
                    <input type="text" id="card-number" class="form-input" placeholder="0000 0000 0000 0000" maxlength="19" required>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.payment.expiryDate')} *</label>
                        <div class="flex gap-2">
                            <input type="text" id="card-expire-month" class="form-input" placeholder="${this.__('licenses.payment.month')}" maxlength="2" style="width: 60px;" required>
                            <span class="flex items-center">/</span>
                            <input type="text" id="card-expire-year" class="form-input" placeholder="${this.__('licenses.payment.year')}" maxlength="2" style="width: 60px;" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">CVV *</label>
                        <input type="text" id="card-cvv" class="form-input" placeholder="000" maxlength="4" style="width: 80px;" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="use-3d-secure" class="form-checkbox" checked>
                        <span>${this.__('licenses.payment.use3DSecure')}</span>
                    </label>
                    <small class="form-hint">${this.__('licenses.payment.securePaymentHint')}</small>
                </div>

                <div class="text-xs text-muted">
                    ${this.__('licenses.payment.securePaymentHint')}
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('licenses.payment.cardInfo'),
            icon: 'ti-credit-card',
            content: formContent,
            size: 'sm',
            confirmText: this.__('licenses.payment.completePayment'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.submitPayment(paymentData, license);
            }
        });

        // Format card number
        setTimeout(() => {
            const cardInput = document.getElementById('card-number');
            cardInput?.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/(\d{4})/g, '$1 ').trim();
                e.target.value = value.substring(0, 19);
            });

            // Only numbers for other fields
            ['card-expire-month', 'card-expire-year', 'card-cvv'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '');
                });
            });
        }, 100);
    }

    async submitPayment(paymentData, license) {
        const cardHolderName = document.getElementById('card-holder-name')?.value?.trim();
        const cardNumber = document.getElementById('card-number')?.value?.replace(/\s/g, '');
        const expireMonth = document.getElementById('card-expire-month')?.value;
        const expireYear = document.getElementById('card-expire-year')?.value;
        const cvv = document.getElementById('card-cvv')?.value;
        const use3D = document.getElementById('use-3d-secure')?.checked;

        // Validation
        if (!cardHolderName || !cardNumber || !expireMonth || !expireYear || !cvv) {
            Toast.error(this.__('licenses.payment.fillAllCardInfo'));
            throw new Error('Validation failed');
        }

        if (cardNumber.length < 15) {
            Toast.error(this.__('licenses.payment.invalidCardNumber'));
            throw new Error('Invalid card number');
        }

        try {
            const user = this.app.state.get('user') || {};
            const [firstName, ...surnameParts] = cardHolderName.split(' ');
            const buyerSurname = surnameParts.join(' ').trim();

            const initResponse = await this.app.api.post('/payments/init', {
                plan_id: paymentData.plan?.id,
                license_plan: paymentData.plan?.slug || paymentData.plan?.name,
                license_period: paymentData.period,
                installment: parseInt(paymentData.installment, 10) || 1,
                license_id: license.id,
                company_id: license.company_id,
                billable_devices: parseInt(paymentData.billable_devices, 10) || 1,
                buyer: {
                    name: user.first_name || firstName || cardHolderName,
                    surname: user.last_name || buyerSurname || '',
                    email: user.email || 'odeme@example.com',
                    phone: user.phone || ''
                },
                billing_address: {
                    city: 'Istanbul',
                    country: 'Turkey',
                    address: 'Adres bilgisi girilmedi',
                    zip_code: '34000'
                },
                payment_card: {
                    card_holder_name: cardHolderName,
                    card_number: cardNumber,
                    expire_month: expireMonth.padStart(2, '0'),
                    expire_year: (expireYear.length === 4 ? expireYear.slice(-2) : expireYear),
                    cvc: cvv
                },
                use_3d: use3D
            });

            if (initResponse.success) {
                const threeDSHtml = initResponse.data?.threeDSHtmlContent;
                if (threeDSHtml) {
                    let htmlToRender = threeDSHtml;
                    try {
                        if (!/<(html|form|script)/i.test(threeDSHtml)) {
                            htmlToRender = atob(threeDSHtml);
                        }
                    } catch (decodeError) {
                        htmlToRender = threeDSHtml;
                    }

                    Toast.info(this.__('licenses.payment.redirecting3D'));
                    document.open();
                    document.write(htmlToRender);
                    document.close();
                    return;
                }

                Toast.success(this.__('licenses.payment.success'));
                this.dataTable?.refresh();
            } else {
                throw new Error(initResponse.message || this.__('licenses.payment.failed'));
            }
        } catch (error) {
            Toast.error(error.message || this.__('licenses.payment.transactionFailed'));
            throw error;
        }
    }

    /**
     * Plan seçildiğinde plan limitlerini gösteren info kartı
     * @param {string} planSlug - Seçilen plan slug'ı
     * @param {string} containerId - Info kartının yerleştirileceği container ID
     */
    showPlanLimitsInfo(planSlug, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Plan bul
        const plan = this.licensePlans?.find(p => p.slug === planSlug || p.name === planSlug);
        if (!plan) {
            container.style.display = 'none';
            return;
        }

        // Sınırsız plan kontrolü
        const isUnlimitedPlan = ['enterprise', 'ultimate', 'unlimited'].includes(plan.plan_type?.toLowerCase());
        const formatLimit = (val) => {
            if (val === null || val === undefined || val === 0 || val === -1 || isUnlimitedPlan) {
                return `<span class="badge badge-success badge-sm">${this.__('licenses.limits.unlimitedLabel')}</span>`;
            }
            return val.toLocaleString('tr-TR');
        };

        const formatStorage = (mb) => {
            if (mb === null || mb === undefined || mb === 0 || mb === -1 || isUnlimitedPlan) {
                return `<span class="badge badge-success badge-sm">${this.__('licenses.limits.unlimitedLabel')}</span>`;
            }
            if (mb >= 1024) {
                return `${(mb / 1024).toFixed(0)} GB`;
            }
            return `${mb} MB`;
        };

        container.innerHTML = `
            <div class="plan-limits-card">
                <div class="plan-limits-header">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('licenses.planLimits.title')}</span>
                    <span class="badge badge-${this.getPlanBadgeClass(plan.name || plan.slug)}">${escapeHTML(this.getLocalizedPlanName(plan))}</span>
                </div>
                <div class="plan-limits-grid">
                    <div class="plan-limit-item">
                        <i class="ti ti-device-desktop"></i>
                        <span class="plan-limit-label">${this.__('licenses.fields.deviceLimit')}</span>
                        <span class="plan-limit-value">${formatLimit(plan.max_devices)}</span>
                    </div>
                    <div class="plan-limit-item">
                        <i class="ti ti-users"></i>
                        <span class="plan-limit-label">${this.__('licenses.limits.userLimit')}</span>
                        <span class="plan-limit-value">${formatLimit(plan.max_users)}</span>
                    </div>
                    <div class="plan-limit-item">
                        <i class="ti ti-building-store"></i>
                        <span class="plan-limit-label">${this.__('licenses.limits.branchLimit')}</span>
                        <span class="plan-limit-value">${formatLimit(plan.max_branches)}</span>
                    </div>
                    <div class="plan-limit-item">
                        <i class="ti ti-database"></i>
                        <span class="plan-limit-label">${this.__('licenses.limits.storageLimit')}</span>
                        <span class="plan-limit-value">${formatStorage(plan.storage_limit ?? plan.max_storage)}</span>
                    </div>
                </div>
            </div>
        `;
        container.style.display = 'block';
    }

    /**
     * Bind tab switching events
     */
    bindTabEvents() {
        document.querySelectorAll('.page-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Add plan button - navigates to full page form
        document.getElementById('add-license-plan-btn')?.addEventListener('click', () => {
            window.location.hash = '#/admin/licenses/plans/new';
        });
    }

    /**
     * Switch between tabs
     */
    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        document.querySelectorAll('.page-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const activeContent = document.getElementById(`${tabId}-tab-content`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }

        // Load content for the active tab
        if (tabId === 'plans') {
            this.renderLicensePlans();
        }
    }

    // =====================
    // License Plan CRUD
    // =====================

    /**
     * Render license plans list
     */
    renderLicensePlans() {
        const container = document.getElementById('license-plans-list');
        if (!container) return;

        if (!this.licensePlans.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('licenses.plans.empty')}
                </div>
            `;
            return;
        }

        container.innerHTML = this.licensePlans.map(plan => `
            <div class="license-plan-card ${plan.is_popular ? 'popular' : ''}" data-plan-id="${escapeHTML(plan.id)}">
                <div class="license-plan-header">
                    <div class="license-plan-info">
                        <h4 class="license-plan-name">
                            ${escapeHTML(this.getLocalizedPlanName(plan))}
                            ${plan.is_popular ? `<span class="badge badge-primary text-xs">${this.__('licenses.plans.recommended')}</span>` : ''}
                            ${plan.is_enterprise ? `<span class="badge badge-warning text-xs">${this.__('licenses.plans.enterprise')}</span>` : ''}
                            ${!plan.is_active ? `<span class="badge badge-secondary text-xs">${this.__('licenses.plans.inactive')}</span>` : ''}
                        </h4>
                        <p class="license-plan-description">${escapeHTML(this.getLocalizedPlanDescription(plan))}</p>
                    </div>
                    <div class="license-plan-actions">
                        <div class="license-plan-price">
                            <div class="price-value">${this.formatPrice(plan.price, plan.currency)}</div>
                            <div class="price-period">${plan.duration_months || 1} ${this.__('licenses.plans.months')}</div>
                        </div>
                        ${this.isSuperAdmin() ? `
                        <div class="plan-buttons">
                            <button type="button" class="btn btn-ghost btn-sm edit-plan-btn" data-plan-id="${escapeHTML(plan.id)}" title="${this.__('actions.edit')}">
                                <i class="ti ti-edit"></i>
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm text-danger delete-plan-btn" data-plan-id="${escapeHTML(plan.id)}" title="${this.__('actions.delete')}">
                                <i class="ti ti-trash"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="license-plan-stats">
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_users === -1 || plan.max_users === 0 ? '∞' : plan.max_users}</div>
                        <div class="stat-label">${this.__('licenses.limits.users')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_devices === -1 || plan.max_devices === 0 ? '∞' : plan.max_devices}</div>
                        <div class="stat-label">${this.__('licenses.limits.devices')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_products === -1 || plan.max_products === 0 ? '∞' : plan.max_products}</div>
                        <div class="stat-label">${this.__('licenses.limits.products')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_templates === -1 || plan.max_templates === 0 ? '∞' : plan.max_templates}</div>
                        <div class="stat-label">${this.__('licenses.limits.templates')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${plan.max_branches === -1 || plan.max_branches === 0 || plan.max_branches === undefined ? '∞' : plan.max_branches}</div>
                        <div class="stat-label">${this.__('licenses.limits.branches')}</div>
                    </div>
                    <div class="license-plan-stat">
                        <div class="stat-value">${!plan.storage_limit || plan.storage_limit <= 0 ? '∞' : (plan.storage_limit >= 1024 ? Math.round(plan.storage_limit / 1024) + ' GB' : plan.storage_limit + ' MB')}</div>
                        <div class="stat-label">${this.__('licenses.limits.storage')}</div>
                    </div>
                </div>
                ${plan.device_categories?.length ? `
                <div class="license-plan-features">
                    <span class="badge badge-info text-xs">${this.__('licenses.plans.form.pricingModePerDeviceType')}</span>
                    ${plan.device_categories.map(cat => `<span class="badge badge-outline text-xs">${this.__('licenses.deviceCategories.' + cat) || escapeHTML(cat)}</span>`).join('')}
                </div>
                ` : ''}
                ${plan.features?.length ? `
                <div class="license-plan-features">
                    ${plan.features.filter(f => !['per_device_pricing', 'unlimited_users', 'unlimited_devices'].includes(f)).map(f => `<span class="badge badge-outline text-xs">${this.__('licenses.plans.features.' + f) || escapeHTML(f)}</span>`).join('')}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Bind edit/delete button events - edit navigates to full page
        container.querySelectorAll('.edit-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.currentTarget.dataset.planId;
                window.location.hash = `#/admin/licenses/plans/${planId}/edit`;
            });
        });

        container.querySelectorAll('.delete-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.currentTarget.dataset.planId;
                this.deletePlan(planId);
            });
        });
    }

    /**
     * Format price with currency symbol
     */
    formatPrice(price, currency = 'TRY') {
        const num = parseFloat(price) || 0;
        const symbols = { TRY: '₺', USD: '$', EUR: '€' };
        return `${symbols[currency] || ''}${num.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    }

    /**
     * Show create plan - redirects to full page
     */
    showCreatePlanModal() {
        window.location.hash = '#/admin/licenses/plans/new';
    }

    /**
     * Show edit plan - redirects to full page
     */
    async showEditPlanModal(planId) {
        window.location.hash = `#/admin/licenses/plans/${planId}/edit`;
    }

    /**
     * Show plan modal (create or edit)
     */
    showPlanModal(plan = null) {
        const isEdit = !!plan;
        const title = isEdit
            ? this.__('licenses.plans.editPlan')
            : this.__('licenses.plans.addPlan');
        const isPerDeviceMode = this.isPerDevicePricing(plan);
        const durationMonths = Math.max(1, parseInt(plan?.duration_months, 10) || 1);
        const perDeviceUnitPrice = this.getPerDeviceUnitPrice({
            ...(plan || {}),
            duration_months: durationMonths,
            price: parseFloat(plan?.price) || 0
        });

        const content = `
            <form id="plan-form" class="space-y-4">
                <input type="hidden" id="plan-id" value="${escapeHTML(plan?.id || '')}">

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

                <div class="grid grid-cols-4 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.plans.form.price')} *</label>
                        <input type="number" id="plan-price" class="form-input" value="${plan?.price || 0}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.plans.form.currency')}</label>
                        <select id="plan-currency" class="form-select">
                            <option value="TRY" ${plan?.currency === 'TRY' ? 'selected' : ''}>TRY (₺)</option>
                            <option value="USD" ${plan?.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="EUR" ${plan?.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.plans.form.duration')}</label>
                        <input type="number" id="plan-duration" class="form-input" value="${durationMonths}" min="1" max="120">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('licenses.plans.form.pricingMode')}</label>
                        <select id="plan-pricing-mode" class="form-select">
                            <option value="flat" ${isPerDeviceMode ? '' : 'selected'}>Flat</option>
                            <option value="per_device" ${isPerDeviceMode ? 'selected' : ''}>${this.__('licenses.plans.features.per_device_pricing')}</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group" id="plan-device-unit-price-group" style="${isPerDeviceMode ? '' : 'display:none;'}">
                        <label class="form-label">${this.__('licenses.plans.form.deviceUnitPrice')}</label>
                        <input
                            type="number"
                            id="plan-device-unit-price"
                            class="form-input"
                            value="${Number.isFinite(perDeviceUnitPrice) ? perDeviceUnitPrice.toFixed(2) : '0.00'}"
                            step="0.01"
                            min="0"
                        >
                        <small class="text-muted text-xs">${this.__('licenses.plans.form.deviceUnitPriceHint')}</small>
                    </div>
                </div>

                <div class="grid grid-cols-6 gap-3">
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

                <div class="form-group">
                    <label class="form-label">${this.__('licenses.plans.form.features')}</label>
                    <div class="features-checkbox-grid">
                        ${this.renderFeatureCheckboxes(plan?.features || [])}
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="form-group">
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
                    <div class="form-group">
                        <label class="form-label flex items-center gap-2">
                            <input type="checkbox" id="plan-is-active" class="form-checkbox" ${plan?.is_active !== false ? 'checked' : ''}>
                            ${this.__('licenses.plans.form.isActive')}
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('categories.fields.order')}</label>
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

        setTimeout(() => this.bindPlanPricingModeEvents(), 50);
    }

    bindPlanPricingModeEvents() {
        const modeSelect = document.getElementById('plan-pricing-mode');
        const unitPriceGroup = document.getElementById('plan-device-unit-price-group');
        const unitPriceInput = document.getElementById('plan-device-unit-price');
        const durationInput = document.getElementById('plan-duration');
        const priceInput = document.getElementById('plan-price');
        const perDeviceFeatureCheckbox = document.querySelector('.feature-checkbox[value="per_device_pricing"]');

        if (!modeSelect || !priceInput || !durationInput) {
            return;
        }

        const syncPriceFields = () => {
            const isPerDevice = modeSelect.value === 'per_device';
            if (unitPriceGroup) {
                unitPriceGroup.style.display = isPerDevice ? '' : 'none';
            }
            if (perDeviceFeatureCheckbox) {
                perDeviceFeatureCheckbox.checked = isPerDevice;
            }

            priceInput.readOnly = isPerDevice;
            if (!isPerDevice || !unitPriceInput) {
                return;
            }

            const durationMonths = Math.max(1, parseInt(durationInput.value, 10) || 1);
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            priceInput.value = (unitPrice * durationMonths).toFixed(2);
        };

        modeSelect.addEventListener('change', syncPriceFields);
        durationInput.addEventListener('input', syncPriceFields);
        unitPriceInput?.addEventListener('input', syncPriceFields);
        perDeviceFeatureCheckbox?.addEventListener('change', (e) => {
            modeSelect.value = e.target.checked ? 'per_device' : 'flat';
            syncPriceFields();
        });
        syncPriceFields();
    }

    /**
     * Save plan (create or update)
     */
    async savePlan() {
        const planId = document.getElementById('plan-id')?.value;
        const name = document.getElementById('plan-name')?.value?.trim();
        const price = parseFloat(document.getElementById('plan-price')?.value) || 0;
        const pricingMode = document.getElementById('plan-pricing-mode')?.value === 'per_device'
            ? 'per_device'
            : 'flat';
        const durationMonths = parseInt(document.getElementById('plan-duration')?.value, 10) || 1;
        const perDeviceUnitPriceInput = parseFloat(document.getElementById('plan-device-unit-price')?.value) || 0;

        if (!name) {
            Toast.error(this.__('licenses.plans.validation.nameRequired'));
            throw new Error('Validation failed');
        }

        // Collect selected features from checkboxes
        const featureCheckboxes = document.querySelectorAll('.feature-checkbox:checked');
        const features = Array.from(featureCheckboxes).map(cb => cb.value);
        const featureSet = new Set(features);

        // Helper function to parse int with proper 0 handling
        // 0 means "unlimited" for limit fields, so we must not replace it with default
        const parseIntSafe = (value, defaultValue) => {
            const parsed = parseInt(value);
            return isNaN(parsed) ? defaultValue : parsed;
        };

        let normalizedPrice = price;
        if (pricingMode === 'per_device') {
            if (perDeviceUnitPriceInput <= 0) {
                Toast.error(this.__('licenses.plans.validation.unitPriceRequired'));
                throw new Error('Validation failed');
            }
            normalizedPrice = perDeviceUnitPriceInput * Math.max(1, durationMonths);
            featureSet.add('per_device_pricing');
        } else {
            featureSet.delete('per_device_pricing');
        }

        const normalizedFeatures = Array.from(featureSet);

        const data = {
            name: name,
            slug: document.getElementById('plan-slug')?.value?.trim() || '',
            description: document.getElementById('plan-description')?.value?.trim() || '',
            plan_type: pricingMode === 'per_device' ? 'per_device' : 'standard',
            price: Math.max(0, normalizedPrice),
            price_in_tl: true,
            currency: document.getElementById('plan-currency')?.value || 'TRY',
            duration_months: Math.max(1, durationMonths),
            max_users: parseIntSafe(document.getElementById('plan-max-users')?.value, 1),
            max_devices: parseIntSafe(document.getElementById('plan-max-devices')?.value, 10),
            max_products: parseIntSafe(document.getElementById('plan-max-products')?.value, 100),
            max_templates: parseIntSafe(document.getElementById('plan-max-templates')?.value, 10),
            max_branches: parseIntSafe(document.getElementById('plan-max-branches')?.value, 1),
            storage_limit: parseIntSafe(document.getElementById('plan-storage-limit')?.value, 0),
            features: normalizedFeatures,
            device_unit_price: pricingMode === 'per_device' ? perDeviceUnitPriceInput : null,
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
                    ? this.__('licenses.plans.updated')
                    : this.__('licenses.plans.created'));
                await this.loadPaymentInfo();
                this.renderLicensePlans();
            } else {
                throw new Error(response.message || this.__('messages.operationFailed'));
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.error'));
            throw error;
        }
    }

    /**
     * Delete plan
     */
    async deletePlan(planId) {
        const plan = this.licensePlans.find(p => p.id === planId);
        if (!plan) return;

        Modal.confirm({
            title: this.__('licenses.plans.deleteConfirm.title'),
            message: this.__('licenses.plans.deleteConfirm.message', { name: this.getLocalizedPlanName(plan) }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete(`/payments/license-plans/${planId}`);
                    if (response.success) {
                        Toast.success(this.__('licenses.plans.deleted'));
                        await this.loadPaymentInfo();
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

    // =========================================
    // Per-Device-Type Pricing Helpers
    // =========================================

    /**
     * Show device pricing inputs when a plan with per_device_type is selected
     * @param {string} planSlug - Selected plan slug
     * @param {string} prefix - 'create' or 'edit'
     * @param {object} license - Existing license data (for edit mode)
     */
    _showDevicePricingForPlan(planSlug, prefix, license = null) {
        const plan = this.licensePlans?.find(p => p.slug === planSlug || p.name === planSlug);
        const section = document.getElementById(`${prefix}-device-pricing-section`);
        const rowsContainer = document.getElementById(`${prefix}-device-pricing-rows`);

        if (!section || !rowsContainer) return;

        // Check if plan supports per_device_type
        const hasCategories = plan?.device_categories && Array.isArray(plan.device_categories) && plan.device_categories.length > 0;

        if (!hasCategories) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        // Build pricing table
        const categories = plan.device_categories;
        const defaultPricing = (typeof plan.default_device_pricing === 'object' && plan.default_device_pricing !== null)
            ? plan.default_device_pricing : {};
        const pricingMeta = (typeof defaultPricing._meta === 'object' && defaultPricing._meta !== null)
            ? defaultPricing._meta : {};

        // If editing, load existing device pricing from license
        const existingPricing = {};
        if (license?.device_pricing && Array.isArray(license.device_pricing)) {
            license.device_pricing.forEach(dp => {
                existingPricing[dp.device_category] = {
                    device_count: dp.device_count || 0,
                    unit_price: dp.unit_price || 0,
                    currency: dp.currency || 'USD'
                };
            });
        }

        const categoryIcons = {
            esl_rf: 'ti-antenna',
            esl_tablet: 'ti-device-tablet',
            esl_pos: 'ti-receipt',
            signage_fiyatgor: 'ti-price-tag',
            signage_tv: 'ti-device-tv'
        };

        rowsContainer.innerHTML = `
            <table class="device-pricing-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>${this.__('licenses.pricing.deviceCategory')}</th>
                        <th>${this.__('licenses.pricing.deviceCount')}</th>
                        <th>${this.__('licenses.pricing.unitPrice')}</th>
                        <th>${this.__('licenses.plans.form.currency')}</th>
                        <th>${this.__('licenses.pricing.subtotal')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(cat => {
                        const existing = existingPricing[cat];
                        const defaults = defaultPricing[cat] || {};
                        const count = existing?.device_count ?? defaults.device_count ?? defaults.default_count ?? 0;
                        const unitPrice = existing?.unit_price ?? defaults.unit_price ?? 0;
                        const currency = existing?.currency ?? defaults.currency ?? 'USD';
                        const subtotal = count * unitPrice;
                        return `
                            <tr data-category="${cat}" data-currency="${escapeHTML(currency)}">
                                <td class="category-icon"><i class="ti ${categoryIcons[cat] || 'ti-device-desktop'}"></i></td>
                                <td>${this.__('licenses.deviceCategories.' + cat)}</td>
                                <td><input type="number" class="form-input form-input-sm dp-count" data-cat="${cat}" value="${count}" min="0" step="1"></td>
                                <td><input type="number" class="form-input form-input-sm dp-price" data-cat="${cat}" value="${unitPrice}" min="0" step="0.01"></td>
                                <td class="currency-cell">${escapeHTML(currency)}</td>
                                <td class="subtotal-cell" data-cat="${cat}">${this._formatCurrency(subtotal, currency)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Bind input events for live calculation
        rowsContainer.querySelectorAll('.dp-count, .dp-price').forEach(input => {
            input.addEventListener('input', () => this._updatePricingSummary(prefix, categories));
        });

        // Exchange rate change
        const exchangeInput = document.getElementById(`${prefix}-exchange-rate`);
        if (exchangeInput && !license) {
            exchangeInput.value = `${Math.max(0.01, parseFloat(pricingMeta.exchange_rate) || 1)}`;
        }
        exchangeInput?.addEventListener('input', () => this._updatePricingSummary(prefix, categories));

        // Initial summary
        this._updatePricingSummary(prefix, categories);
    }

    /**
     * Update pricing summary with calculated totals
     */
    _updatePricingSummary(prefix, categories) {
        const summaryEl = document.getElementById(`${prefix}-pricing-summary`);
        if (!summaryEl) return;

        const exchangeRate = parseFloat(document.getElementById(`${prefix}-exchange-rate`)?.value) || 1.0;
        let totalBase = 0;
        const currencies = new Set();

        categories.forEach(cat => {
            const countInput = document.querySelector(`#${prefix}-device-pricing-rows .dp-count[data-cat="${cat}"]`);
            const priceInput = document.querySelector(`#${prefix}-device-pricing-rows .dp-price[data-cat="${cat}"]`);
            const subtotalCell = document.querySelector(`#${prefix}-device-pricing-rows .subtotal-cell[data-cat="${cat}"]`);
            const row = countInput?.closest('tr[data-category]');
            const rowCurrency = row?.dataset.currency || 'USD';

            const count = parseInt(countInput?.value) || 0;
            const unitPrice = parseFloat(priceInput?.value) || 0;
            const subtotal = count * unitPrice;

            if (subtotalCell) {
                subtotalCell.textContent = this._formatCurrency(subtotal, rowCurrency);
            }

            totalBase += subtotal;
            currencies.add(rowCurrency);
        });

        const baseCurrency = currencies.values().next().value || 'USD';
        const totalTRY = totalBase * exchangeRate;
        const rateLabel = document.querySelector(`#${prefix}-device-pricing-section .rate-label`);
        if (rateLabel) {
            rateLabel.textContent = `${baseCurrency} \u2192 TRY`;
        }

        const mixedCurrencyNote = currencies.size > 1
            ? `<div class="text-xs text-warning mt-2">Karisik para birimi kullaniliyor; toplam ilk para birimine gore hesaplandi.</div>`
            : '';

        summaryEl.innerHTML = `
            <div class="pricing-summary-row">
                <span class="label">${this.__('licenses.pricing.monthlyTotal')} (${escapeHTML(baseCurrency)})</span>
                <span class="value">${this._formatCurrency(totalBase, baseCurrency)}</span>
            </div>
            <div class="pricing-summary-row">
                <span class="label">${this.__('licenses.pricing.annualTotal')} (${escapeHTML(baseCurrency)})</span>
                <span class="value">${this._formatCurrency(totalBase * 12, baseCurrency)}</span>
            </div>
            <div class="pricing-summary-row total">
                <span class="label">${this.__('licenses.pricing.monthlyTotal')} (TRY)</span>
                <span class="value">${this._formatCurrency(totalTRY, 'TRY')}</span>
            </div>
            <div class="pricing-summary-row">
                <span class="label">${this.__('licenses.pricing.annualTotal')} (TRY)</span>
                <span class="value">${this._formatCurrency(totalTRY * 12, 'TRY')}</span>
            </div>
            ${mixedCurrencyNote}
        `;
    }

    /**
     * Collect device pricing data from form inputs
     */
    _collectDevicePricingData(prefix) {
        const rows = document.querySelectorAll(`#${prefix}-device-pricing-rows tr[data-category]`);
        if (!rows.length) return null;

        const pricing = [];
        rows.forEach(row => {
            const cat = row.dataset.category;
            const count = parseInt(row.querySelector('.dp-count')?.value) || 0;
            const unitPrice = parseFloat(row.querySelector('.dp-price')?.value) || 0;
            const currency = row.dataset.currency || 'USD';

            if (count > 0 || unitPrice > 0) {
                pricing.push({
                    device_category: cat,
                    device_count: count,
                    unit_price: unitPrice,
                    currency
                });
            }
        });

        return pricing.length > 0 ? pricing : null;
    }

    /**
     * Format currency value
     */
    _formatCurrency(amount, currency = 'USD') {
        const symbols = { TRY: '\u20ba', USD: '$', EUR: '\u20ac' };
        const symbol = symbols[currency] || '';
        return `${symbol}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    destroy() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default LicenseManagementPage;
