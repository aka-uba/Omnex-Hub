/**
 * Dashboard Page Component
 * CRM-style System Analytics Dashboard
 *
 * @package OmnexDisplayHub
 */

import { Toast } from '../components/Toast.js';
import { Logger } from '../core/Logger.js';
import { escapeHTML } from '../core/SecurityUtils.js';

export class DashboardPage {
    constructor(app) {
        this.app = app;
        this.stats = null;
        this.recentActivities = [];
        this.deviceGroups = [];
        this.isLoading = true;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('dashboard');
    }

    /**
     * Render dashboard page
     */
    render() {
        const user = this.app.state.get('user') || {};
        const userName = user.first_name || this.__('welcomeDefault');

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.analytics')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon indigo">
                            <i class="ti ti-chart-dots-3"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('header.systemAnalytics')}</h1>
                            <p class="page-subtitle">${this.__('welcome', { name: escapeHTML(userName) })}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-outline" onclick="window.dashboardPage?.exportReport()">
                            <i class="ti ti-download"></i>
                            ${this.__('header.downloadReport')}
                        </button>
                        <button class="btn btn-primary" onclick="window.dashboardPage?.refresh()">
                            <i class="ti ti-refresh"></i>
                            ${this.__('header.refresh')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Top Stats Cards -->
            <div class="dashboard-stats" id="stats-container">
                ${this.renderStatsLoading()}
            </div>

            <!-- CRM Grid -->
            <div class="dashboard-crm-grid" id="crm-grid-container">
                ${this._renderCrmGridLoading()}
            </div>
        `;
    }

    // =========================================
    // TOP STATS (MEVCUT - AYNEN KALACAK)
    // =========================================

    renderStatsLoading() {
        return [1, 2, 3, 4, 5].map(() => `
            <div class="analytics-card animate-pulse">
                <div class="analytics-card-header">
                    <div class="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                    <div class="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
        `).join('');
    }

    renderStats() {
        const stats = this.stats || {};
        const onlinePercent = stats.total_devices > 0
            ? Math.round((stats.online_devices / stats.total_devices) * 100)
            : 0;

        return `
            <!-- Total Products -->
            <a href="#/products" class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon blue">
                        <i class="ti ti-package"></i>
                    </div>
                    <span class="analytics-trend up">
                        <i class="ti ti-trending-up"></i>
                        +${stats.product_trend || 0}%
                    </span>
                </div>
                <p class="analytics-card-label">${this.__('stats.totalProducts')}</p>
                <p class="analytics-card-value">${this.formatNumber(stats.products || 0)}</p>
                <p class="analytics-card-footer">${this.__('stats.updatedIn24h')}</p>
            </a>

            <!-- Active Devices -->
            <a href="#/devices" class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon indigo">
                        <i class="ti ti-device-desktop"></i>
                    </div>
                    <div class="circular-progress" style="--percent: ${onlinePercent}">
                        <svg viewBox="0 0 40 40" width="40" height="40">
                            <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                            <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="#6366f1" stroke-width="4" stroke-linecap="round"></circle>
                        </svg>
                        <span class="progress-text">${onlinePercent}%</span>
                    </div>
                </div>
                <p class="analytics-card-label">${this.__('stats.activeDevices')}</p>
                <p class="analytics-card-value">${this.formatNumber(stats.devices || 0)}</p>
                <p class="analytics-card-footer highlight success">
                    <i class="ti ti-circle-check"></i>
                    ${stats.online_devices || 0} ${this.__('stats.online')}
                </p>
            </a>

            <!-- License Status -->
            <a href="#/admin/licenses" class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon amber">
                        <i class="ti ti-license"></i>
                    </div>
                    ${stats.expiring_licenses > 0
                        ? `<span class="analytics-trend critical">${this.__('stats.critical')}</span>`
                        : `<span class="analytics-trend up"><i class="ti ti-check"></i> OK</span>`
                    }
                </div>
                <p class="analytics-card-label">${this.__('stats.licenseStatus')}</p>
                <p class="analytics-card-value">${this.formatNumber(stats.active_licenses || 0)}</p>
                <p class="analytics-card-footer highlight ${stats.expiring_licenses > 0 ? 'warning' : 'success'}">
                    <i class="ti ti-${stats.expiring_licenses > 0 ? 'alert-triangle' : 'check'}"></i>
                    ${stats.expiring_licenses > 0
                        ? this.__('stats.licensesExpiring', { count: stats.expiring_licenses })
                        : this.__('stats.allLicensesActive')
                    }
                </p>
            </a>

            <!-- Storage Usage -->
            <a href="#/settings" class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon ${this._storageIconColor(stats)}">
                        <i class="ti ti-database"></i>
                    </div>
                    ${stats.storage_unlimited
                        ? `<span class="analytics-trend up"><i class="ti ti-infinity"></i> ${this.__('stats.unlimited')}</span>`
                        : `<div class="circular-progress" style="--percent: ${this._storagePercent(stats)}">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                                <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="${this._storageStrokeColor(stats)}" stroke-width="4" stroke-linecap="round"></circle>
                            </svg>
                            <span class="progress-text">${this._storagePercent(stats)}%</span>
                        </div>`
                    }
                </div>
                <p class="analytics-card-label">${this.__('stats.storage')}</p>
                <p class="analytics-card-value">
                    ${this._formatStorage(stats.storage_used_mb || 0)}
                    ${!stats.storage_unlimited && stats.storage_limit_mb ? `<span class="unit">/ ${this._formatStorage(stats.storage_limit_mb)}</span>` : ''}
                </p>
                <p class="analytics-card-footer highlight ${this._storageFooterClass(stats)}">
                    <i class="ti ti-${this._storageFooterIcon(stats)}"></i>
                    ${this._storageFooterText(stats)}
                </p>
            </a>

            <!-- Error Rate -->
            <a href="#/reports" class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon rose">
                        <i class="ti ti-chart-arrows"></i>
                    </div>
                    <span class="analytics-trend ${(stats.error_trend || 0) <= 0 ? 'down' : 'up'}">
                        ${(stats.error_trend || 0) > 0 ? '+' : ''}${stats.error_trend || 0}%
                    </span>
                </div>
                <p class="analytics-card-label">${this.__('stats.errorRate')}</p>
                <p class="analytics-card-value">
                    ${(stats.error_rate || 0).toFixed(2)}
                    <span class="unit">%</span>
                </p>
                <p class="analytics-card-footer">${this.__('stats.belowIndustryAvg')}</p>
            </a>
        `;
    }

    // =========================================
    // CRM GRID
    // =========================================

    _renderCrmGridLoading() {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => `
            <div class="chart-card animate-pulse">
                <div class="chart-card-header">
                    <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
                <div class="chart-card-body">
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-3"></div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
            </div>
        `).join('') + `
            <div class="chart-card crm-full-width animate-pulse">
                <div class="chart-card-header">
                    <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
                <div class="chart-card-body">
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                </div>
            </div>
        `;
    }

    _renderCrmGrid() {
        return `
            ${this._renderDeviceStatusCard()}
            ${this._renderRecentActivitiesCard()}
            ${this._renderRenderQueueCard()}
            ${this._renderProductsCard()}
            ${this._renderTemplatesCard()}
            ${this._renderMediaLibraryCard()}
            ${this._renderDetailedDeviceCard()}
            ${this._renderSignageCard()}
            ${this._renderCompanyLicenseCard()}
            ${this._renderIntegrationsCard()}
        `;
    }

    // =========================================
    // CARD 1: DEVICE STATUS
    // =========================================

    _renderDeviceStatusCard() {
        const stats = this.stats || {};
        const total = stats.total_devices || 0;
        const online = stats.online_devices || 0;
        const offline = total - online;
        const onlinePct = total > 0 ? (online / total * 100) : 0;
        const offlinePct = total > 0 ? (offline / total * 100) : 0;
        const offlineDevices = stats.offline_devices || [];

        if (total === 0) {
            return `
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h2 class="chart-card-title"><i class="ti ti-device-desktop"></i> ${this.__('cards.deviceStatus.title')}</h2>
                    </div>
                    <div class="chart-card-body">
                        <div class="crm-empty-state">
                            <i class="ti ti-device-desktop-off"></i>
                            <p>${this.__('cards.deviceStatus.noDevices')}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-device-desktop"></i> ${this.__('cards.deviceStatus.title')}</h2>
                    <a href="#/devices" class="btn btn-sm btn-ghost text-primary">${this.__('cards.deviceStatus.viewAll')}</a>
                </div>
                <div class="chart-card-body">
                    <div class="device-status-bar">
                        <div class="device-status-bar-segment online" style="width: ${onlinePct}%"></div>
                        <div class="device-status-bar-segment offline" style="width: ${offlinePct}%"></div>
                    </div>
                    <div class="device-status-legend">
                        <div class="device-status-legend-item">
                            <div class="device-status-legend-dot online"></div>
                            <span class="device-status-legend-count">${online}</span>
                            <span>${this.__('cards.deviceStatus.online')}</span>
                        </div>
                        <div class="device-status-legend-item">
                            <div class="device-status-legend-dot offline"></div>
                            <span class="device-status-legend-count">${offline}</span>
                            <span>${this.__('cards.deviceStatus.offline')}</span>
                        </div>
                    </div>
                    ${offline > 0 && offlineDevices.length > 0 ? `
                        <div class="crm-section-label">${this.__('cards.deviceStatus.offlineDevices')}</div>
                        <div class="device-offline-list">
                            ${offlineDevices.slice(0, 8).map(d => `
                                <div class="device-list-item">
                                    <div class="device-list-item-info">
                                        <div class="device-list-item-dot"></div>
                                        <span class="device-list-item-name">${escapeHTML(d.name || d.id)}</span>
                                        ${d.ip_address ? `<span class="device-list-item-ip">${escapeHTML(d.ip_address)}</span>` : ''}
                                    </div>
                                    <span class="device-list-item-time">${d.last_online ? this._formatTimeAgo(d.last_online) : '-'}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : offline === 0 ? `
                        <p style="text-align:center; color: var(--color-success); font-size: var(--text-sm); margin-top: var(--space-2);">
                            <i class="ti ti-circle-check"></i> ${this.__('cards.deviceStatus.noOffline')}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 2: RECENT ACTIVITIES (COMPACT)
    // =========================================

    _renderRecentActivitiesCard() {
        const iconMap = {
            'login': { icon: 'ti-login', color: 'green' },
            'logout': { icon: 'ti-logout', color: 'amber' },
            'create': { icon: 'ti-plus', color: 'amber' },
            'update': { icon: 'ti-edit', color: 'blue' },
            'delete': { icon: 'ti-trash', color: 'red' },
            'import': { icon: 'ti-file-import', color: 'blue' },
            'export': { icon: 'ti-file-export', color: 'blue' },
            'send': { icon: 'ti-send', color: 'green' },
            'sync': { icon: 'ti-refresh', color: 'green' },
            'error': { icon: 'ti-alert-triangle', color: 'red' },
            'view': { icon: 'ti-eye', color: 'gray' },
            'approve': { icon: 'ti-check', color: 'green' },
            'reject': { icon: 'ti-x', color: 'red' }
        };

        const activities = this.recentActivities || [];

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-history"></i> ${this.__('cards.recentActivities.title')}</h2>
                    <a href="#/admin/audit-log" class="btn btn-sm btn-ghost text-primary">${this.__('cards.recentActivities.viewAll')}</a>
                </div>
                <div class="chart-card-body" style="padding: 0;">
                    ${activities.length === 0 ? `
                        <div class="crm-empty-state">
                            <i class="ti ti-history"></i>
                            <p>${this.__('cards.recentActivities.empty')}</p>
                        </div>
                    ` : `
                        <div class="activity-compact-list">
                            ${activities.slice(0, 15).map(activity => {
                                const { icon, color } = iconMap[activity.action] || { icon: 'ti-activity', color: 'blue' };
                                const title = this.getActivityTitle(activity);
                                const desc = this.getActivityDescription(activity);
                                return `
                                    <div class="activity-compact-item">
                                        <div class="activity-compact-icon ${color}">
                                            <i class="ti ${icon}"></i>
                                        </div>
                                        <span class="activity-compact-text" title="${escapeHTML(desc)}">${escapeHTML(title)} - ${escapeHTML(desc)}</span>
                                        <span class="activity-compact-time">${this.formatTime(activity.created_at)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
                <div class="crm-card-footer">
                    <a href="#" onclick="window.dashboardPage?.exportActivities(); return false;">
                        ${this.__('recentActivity.exportAll')} <i class="ti ti-chevron-right"></i>
                    </a>
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 3: RENDER QUEUE
    // =========================================

    _renderRenderQueueCard() {
        const rq = this.stats?.render_queue_summary || {};
        const total = rq.total || 0;
        const byPriority = rq.by_priority || [];

        const maxPriorityCount = Math.max(...byPriority.map(p => p.count || 0), 1);

        const priorityLabels = {
            'urgent': this.__('cards.renderQueue.urgent'),
            'high': this.__('cards.renderQueue.high'),
            'normal': this.__('cards.renderQueue.normal'),
            'low': this.__('cards.renderQueue.low')
        };

        const priorityOrder = ['urgent', 'high', 'normal', 'low'];
        const priorityMap = {};
        byPriority.forEach(p => { priorityMap[p.priority] = p.count || 0; });

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-list-check"></i> ${this.__('cards.renderQueue.title')}</h2>
                    <a href="#/queue" class="btn btn-sm btn-ghost text-primary">${this.__('cards.renderQueue.detail')}</a>
                </div>
                <div class="chart-card-body">
                    ${total === 0 ? `
                        <div class="crm-empty-state">
                            <i class="ti ti-list-check"></i>
                            <p>${this.__('cards.renderQueue.noData')}</p>
                        </div>
                    ` : `
                        <div class="crm-mini-stats">
                            <div class="crm-mini-stat">
                                <div class="crm-mini-stat-value ${rq.success_rate >= 90 ? 'success' : rq.success_rate >= 70 ? 'warning' : 'danger'}">
                                    ${rq.success_rate || 0}%
                                </div>
                                <div class="crm-mini-stat-label">${this.__('cards.renderQueue.successRate')}</div>
                            </div>
                            <div class="crm-mini-stat">
                                <div class="crm-mini-stat-value primary">
                                    ${rq.avg_completion_seconds ? Math.round(rq.avg_completion_seconds) : 0}${this.__('cards.renderQueue.seconds')}
                                </div>
                                <div class="crm-mini-stat-label">${this.__('cards.renderQueue.avgTime')}</div>
                            </div>
                            <div class="crm-mini-stat">
                                <div class="crm-mini-stat-value warning">
                                    ${rq.pending || 0}
                                </div>
                                <div class="crm-mini-stat-label">${this.__('cards.renderQueue.pending')}</div>
                            </div>
                        </div>
                        <div class="crm-section-label">${this.__('cards.renderQueue.priorityDistribution')}</div>
                        <div class="crm-priority-bars">
                            ${priorityOrder.map(p => {
                                const count = priorityMap[p] || 0;
                                const pct = maxPriorityCount > 0 ? (count / maxPriorityCount * 100) : 0;
                                return `
                                    <div class="crm-priority-row">
                                        <span class="crm-priority-label">${priorityLabels[p] || p}</span>
                                        <div class="crm-priority-bar-bg">
                                            <div class="crm-priority-bar-fill ${p}" style="width: ${pct}%"></div>
                                        </div>
                                        <span class="crm-priority-count">${count}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 4: PRODUCTS
    // =========================================

    _renderProductsCard() {
        const stats = this.stats || {};
        const lastProduct = stats.last_updated_product;

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-package"></i> ${this.__('cards.products.title')}</h2>
                    <a href="#/products" class="btn btn-sm btn-ghost text-primary">${this.__('cards.products.viewAll')}</a>
                </div>
                <div class="chart-card-body">
                    <div class="crm-stat-list">
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-package"></i> ${this.__('cards.products.total')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.products || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-device-desktop"></i> ${this.__('cards.products.deviceAssigned')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.product_device_assigned || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-layout"></i> ${this.__('cards.products.templateAssigned')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.product_template_assigned || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-category"></i> ${this.__('cards.products.categories')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.categories || 0)}</span>
                        </div>
                        ${lastProduct ? `
                            <div class="crm-stat-row">
                                <span class="crm-stat-label"><i class="ti ti-clock"></i> ${this.__('cards.products.lastUpdated')}</span>
                                <span class="crm-stat-value muted">${escapeHTML(lastProduct.name || '-')} (${this._formatTimeAgo(lastProduct.updated_at)})</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 5: TEMPLATES
    // =========================================

    _renderTemplatesCard() {
        const stats = this.stats || {};
        const templatesByType = stats.templates_by_type || [];

        const typeLabels = {
            'label': this.__('cards.templates.label'),
            'signage': this.__('cards.templates.signage'),
            'tv': this.__('cards.templates.tv'),
            'poster': this.__('cards.templates.poster')
        };

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-layout"></i> ${this.__('cards.templates.title')}</h2>
                    <a href="#/templates" class="btn btn-sm btn-ghost text-primary">${this.__('cards.templates.manage')}</a>
                </div>
                <div class="chart-card-body">
                    <div class="crm-stat-list">
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-layout"></i> ${this.__('cards.templates.total')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.templates || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-star"></i> ${this.__('cards.templates.system')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.system_templates || 0)}</span>
                        </div>
                    </div>
                    ${templatesByType.length > 0 ? `
                        <div class="crm-section-label">${this.__('cards.templates.byType')}</div>
                        <div class="crm-stat-list">
                            ${templatesByType.map(t => `
                                <div class="crm-stat-row">
                                    <span class="crm-stat-label">${typeLabels[t.type] || escapeHTML(t.type)}</span>
                                    <span class="crm-stat-value">${t.count}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 6: MEDIA LIBRARY
    // =========================================

    _renderMediaLibraryCard() {
        const stats = this.stats || {};
        const usedMb = stats.storage_used_mb || 0;
        const limitMb = stats.storage_limit_mb || 0;
        const unlimited = stats.storage_unlimited || false;
        const pct = !unlimited && limitMb > 0 ? Math.min(100, Math.round(usedMb / limitMb * 100)) : 0;

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-photo"></i> ${this.__('cards.media.title')}</h2>
                    <a href="#/media" class="btn btn-sm btn-ghost text-primary">${this.__('cards.media.browse')}</a>
                </div>
                <div class="chart-card-body">
                    <div class="crm-stat-list">
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-files"></i> ${this.__('cards.media.totalFiles')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.media || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-world"></i> ${this.__('cards.media.shared')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.public_media || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-lock"></i> ${this.__('cards.media.companyOnly')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.company_media || 0)}</span>
                        </div>
                    </div>
                    <div class="crm-storage-progress">
                        <div class="crm-section-label">${this.__('cards.media.storageUsage')}</div>
                        <div class="crm-storage-bar">
                            <div class="crm-storage-fill" style="width: ${unlimited ? 10 : pct}%"></div>
                        </div>
                        <div class="crm-storage-text">
                            ${this._formatStorage(usedMb)}${!unlimited && limitMb ? ` / ${this._formatStorage(limitMb)}` : unlimited ? ` (${this.__('stats.unlimited')})` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 7: DETAILED DEVICE INFO
    // =========================================

    _renderDetailedDeviceCard() {
        const stats = this.stats || {};
        const devicesByType = stats.devices_by_type || [];
        const devicesByBranch = stats.devices_by_branch || [];

        const typeLabels = {
            'esl': { label: this.__('cards.detailedDevice.esl'), icon: 'ti-tag' },
            'esl_android': { label: this.__('cards.detailedDevice.eslAndroid'), icon: 'ti-device-mobile' },
            'esl_rtos': { label: this.__('cards.detailedDevice.eslRtos'), icon: 'ti-cpu' },
            'android_tv': { label: this.__('cards.detailedDevice.androidTv'), icon: 'ti-device-tv' },
            'tablet': { label: this.__('cards.detailedDevice.tablet'), icon: 'ti-device-tablet' },
            'web_display': { label: this.__('cards.detailedDevice.webDisplay'), icon: 'ti-browser' },
            'pwa_player': { label: this.__('cards.detailedDevice.pwaPlayer'), icon: 'ti-player-play' }
        };

        // Aggregate by model (since type can be generic 'esl')
        const typeAgg = {};
        devicesByType.forEach(d => {
            const key = d.model || d.type;
            if (!typeAgg[key]) typeAgg[key] = 0;
            typeAgg[key] += d.count;
        });

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-devices-2"></i> ${this.__('cards.detailedDevice.title')}</h2>
                    <a href="#/devices" class="btn btn-sm btn-ghost text-primary">${this.__('cards.detailedDevice.manage')}</a>
                </div>
                <div class="chart-card-body">
                    ${Object.keys(typeAgg).length > 0 ? `
                        <div class="crm-section-label">${this.__('cards.detailedDevice.byType')}</div>
                        <div class="crm-device-type-grid">
                            ${Object.entries(typeAgg).map(([type, count]) => {
                                const info = typeLabels[type] || { label: type, icon: 'ti-device-desktop' };
                                return `
                                    <div class="crm-device-type-card">
                                        <div class="crm-device-type-count">${count}</div>
                                        <div class="crm-device-type-label">${info.label}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                    ${devicesByBranch.length > 0 ? `
                        <div class="crm-section-label">${this.__('cards.detailedDevice.byBranch')}</div>
                        <div class="crm-stat-list">
                            ${devicesByBranch.map(b => `
                                <div class="crm-stat-row">
                                    <span class="crm-stat-label">${escapeHTML(b.branch_name)}</span>
                                    <span class="crm-stat-value">${b.count}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="crm-section-label">${this.__('cards.detailedDevice.byBranch')}</div>
                        <p style="font-size: var(--text-xs); color: var(--text-muted); text-align: center; padding: var(--space-2);">
                            ${this.__('cards.detailedDevice.noBranch')}
                        </p>
                    `}
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 8: SIGNAGE
    // =========================================

    _renderSignageCard() {
        const stats = this.stats || {};
        const playlists = stats.playlists || {};
        const signageDevices = stats.signage_devices || [];
        const totalSignageDevices = signageDevices.reduce((sum, d) => sum + (d.count || 0), 0);

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-device-tv"></i> ${this.__('cards.signage.title')}</h2>
                    <a href="#/signage/playlists" class="btn btn-sm btn-ghost text-primary">${this.__('cards.signage.manage')}</a>
                </div>
                <div class="chart-card-body">
                    <div class="crm-stat-list">
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-device-tv"></i> ${this.__('cards.signage.connectedDevices')}</span>
                            <span class="crm-stat-value">${totalSignageDevices}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-playlist"></i> ${this.__('cards.signage.totalPlaylists')}</span>
                            <span class="crm-stat-value">
                                ${playlists.total || 0}
                                ${playlists.active > 0 ? `<span class="crm-badge success" style="margin-left: var(--space-2);">${playlists.active} ${this.__('cards.signage.active')}</span>` : ''}
                                ${playlists.inactive > 0 ? `<span class="crm-badge warning" style="margin-left: var(--space-1);">${playlists.inactive} ${this.__('cards.signage.inactive')}</span>` : ''}
                            </span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-photo"></i> ${this.__('cards.signage.playlistItems')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.playlist_item_count || 0)}</span>
                        </div>
                        <div class="crm-stat-row">
                            <span class="crm-stat-label"><i class="ti ti-link"></i> ${this.__('cards.signage.assignedDevices')}</span>
                            <span class="crm-stat-value">${this.formatNumber(stats.playlist_device_count || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 9: COMPANY & LICENSE
    // =========================================

    _renderCompanyLicenseCard() {
        const stats = this.stats || {};
        const company = stats.company_info || {};
        const license = stats.license_info || {};
        const hasCompany = company.name;
        const hasLicense = license.type || license.status;

        const daysRemaining = license.end_date ? this._calcDaysRemaining(license.end_date) : null;
        const isUnlimited = license.is_unlimited == 1 || ['ultimate', 'unlimited', 'lifetime'].includes((license.type || '').toLowerCase());
        const isExpired = daysRemaining !== null && daysRemaining <= 0 && !isUnlimited;

        let licenseBadgeClass = 'active';
        let licenseBadgeText = license.type || '-';
        if (isExpired) {
            licenseBadgeClass = 'expired';
            licenseBadgeText = this.__('cards.companyLicense.expired');
        } else if (isUnlimited) {
            licenseBadgeClass = 'unlimited';
            licenseBadgeText = license.type?.toUpperCase() || 'UNLIMITED';
        }

        // Progress bar for license time
        let licenseProgressPct = 100;
        let licenseProgressClass = '';
        if (daysRemaining !== null && !isUnlimited) {
            // Assume 365-day license cycle for visual
            licenseProgressPct = Math.max(0, Math.min(100, (daysRemaining / 365) * 100));
            if (daysRemaining <= 7) licenseProgressClass = 'danger';
            else if (daysRemaining <= 30) licenseProgressClass = 'warning';
        }

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-building"></i> ${this.__('cards.companyLicense.title')}</h2>
                </div>
                <div class="chart-card-body">
                    ${!hasCompany ? `
                        <div class="crm-empty-state">
                            <i class="ti ti-building"></i>
                            <p>${this.__('cards.companyLicense.noCompany')}</p>
                        </div>
                    ` : `
                        <div class="crm-company-header">
                            <span class="crm-company-name">${escapeHTML(company.name)}</span>
                            ${hasLicense ? `<span class="crm-license-badge ${licenseBadgeClass}">${escapeHTML(licenseBadgeText)}</span>` : ''}
                        </div>
                        <div class="crm-info-grid">
                            <div class="crm-info-item blue">
                                <div class="crm-info-item-value">${stats.branch_count || 0}</div>
                                <div class="crm-info-item-label">${this.__('cards.companyLicense.branches')}</div>
                            </div>
                            <div class="crm-info-item green">
                                <div class="crm-info-item-value">${stats.user_count || 0}</div>
                                <div class="crm-info-item-label">${this.__('cards.companyLicense.users')}</div>
                                <div class="crm-info-item-sub">${stats.active_sessions || 0} ${this.__('cards.companyLicense.activeSessions')}</div>
                            </div>
                            <div class="crm-info-item indigo">
                                <div class="crm-info-item-value">${isUnlimited ? this.__('cards.companyLicense.noLimit') : (license.device_limit || this.__('cards.companyLicense.noLimit'))}</div>
                                <div class="crm-info-item-label">${this.__('cards.companyLicense.deviceLimit')}</div>
                            </div>
                            <div class="crm-info-item amber">
                                <div class="crm-info-item-value">${isUnlimited ? this.__('cards.companyLicense.noLimit') : (license.storage_limit ? this._formatStorage(license.storage_limit) : this.__('cards.companyLicense.noLimit'))}</div>
                                <div class="crm-info-item-label">${this.__('cards.companyLicense.storageLimit')}</div>
                            </div>
                        </div>
                        ${hasLicense ? `
                            <div class="crm-license-timer">
                                <div class="crm-license-timer-header">
                                    <span class="crm-license-timer-label">${this.__('cards.companyLicense.license')}</span>
                                    <span class="crm-license-timer-value">
                                        ${isUnlimited
                                            ? this.__('cards.companyLicense.unlimited')
                                            : isExpired
                                                ? this.__('cards.companyLicense.expired')
                                                : this.__('cards.companyLicense.daysRemaining', { count: daysRemaining })
                                        }
                                    </span>
                                </div>
                                ${!isUnlimited ? `
                                    <div class="license-progress-bar">
                                        <div class="license-progress-fill ${licenseProgressClass}" style="width: ${licenseProgressPct}%"></div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <p style="text-align: center; color: var(--text-muted); font-size: var(--text-sm); margin-top: var(--space-3);">
                                ${this.__('cards.companyLicense.noLicense')}
                            </p>
                        `}
                    `}
                </div>
            </div>
        `;
    }

    // =========================================
    // CARD 10: INTEGRATIONS (full-width)
    // =========================================

    _renderIntegrationsCard() {
        const integrations = this.stats?.integrations || {};

        const items = [
            {
                key: 'tamsoft',
                icon: 'ti-database',
                name: this.__('cards.integrations.tamsoft'),
                data: integrations.tamsoft || {}
            },
            {
                key: 'hal',
                icon: 'ti-leaf',
                name: this.__('cards.integrations.hal'),
                data: integrations.hal || {}
            },
            {
                key: 'hanshow',
                icon: 'ti-tag',
                name: this.__('cards.integrations.hanshow'),
                data: integrations.hanshow || {}
            },
            {
                key: 'payment',
                icon: 'ti-credit-card',
                name: this.__('cards.integrations.payment'),
                data: integrations.payment || {}
            }
        ];

        return `
            <div class="chart-card crm-full-width">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-plug"></i> ${this.__('cards.integrations.title')}</h2>
                </div>
                <div class="chart-card-body">
                    <div class="crm-integration-grid">
                        ${items.map(item => {
                            let statusText, dotClass;
                            if (item.data.active) {
                                statusText = this.__('cards.integrations.active');
                                dotClass = 'active';
                            } else if (item.data.configured) {
                                statusText = this.__('cards.integrations.configured');
                                dotClass = 'configured';
                            } else {
                                statusText = this.__('cards.integrations.notConfigured');
                                dotClass = 'inactive';
                            }
                            return `
                                <div class="crm-integration-item">
                                    <div class="crm-integration-icon ${item.key}">
                                        <i class="ti ${item.icon}"></i>
                                    </div>
                                    <div class="crm-integration-name">${item.name}</div>
                                    <div class="crm-integration-status">
                                        <div class="crm-integration-dot ${dotClass}"></div>
                                        <span>${statusText}</span>
                                    </div>
                                    ${item.data.last_sync ? `
                                        <div class="crm-integration-meta">${this.__('cards.integrations.lastSync')}: ${this._formatTimeAgo(item.data.last_sync)}</div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // DATA LOADING
    // =========================================

    async init() {
        window.dashboardPage = this;
        await this.loadData();
    }

    async loadData() {
        try {
            const [statsResponse, activitiesResponse] = await Promise.all([
                this.app.api.get('/reports/dashboard-stats').catch(() => ({ data: {} })),
                this.app.api.get('/reports/recent-activities').catch(() => ({ data: [] }))
            ]);

            this.stats = statsResponse.data || {};
            this.recentActivities = activitiesResponse.data || [];

            // Update UI
            const statsContainer = document.getElementById('stats-container');
            if (statsContainer) statsContainer.innerHTML = this.renderStats();

            const crmContainer = document.getElementById('crm-grid-container');
            if (crmContainer) crmContainer.innerHTML = this._renderCrmGrid();

        } catch (error) {
            Logger.error('Dashboard data load error:', error);

            this.stats = {};
            this.recentActivities = [];

            const statsContainer = document.getElementById('stats-container');
            if (statsContainer) statsContainer.innerHTML = this.renderStats();

            const crmContainer = document.getElementById('crm-grid-container');
            if (crmContainer) crmContainer.innerHTML = this._renderCrmGrid();

            Toast.error(this.__('toast.loadError'));
        }

        this.isLoading = false;
    }

    async refresh() {
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) statsContainer.innerHTML = this.renderStatsLoading();

        const crmContainer = document.getElementById('crm-grid-container');
        if (crmContainer) crmContainer.innerHTML = this._renderCrmGridLoading();

        await this.loadData();
        Toast.success(this.__('toast.refreshed'));
    }

    // =========================================
    // ACTIVITY HELPERS (kept from original)
    // =========================================

    getActivityTitle(activity) {
        const titles = {
            'login': this.__('activity.titles.login'),
            'logout': this.__('activity.titles.logout'),
            'create': this.__('activity.titles.create'),
            'update': this.__('activity.titles.update'),
            'delete': this.__('activity.titles.delete'),
            'import': this.__('activity.titles.import'),
            'export': this.__('activity.titles.export'),
            'send': this.__('activity.titles.send'),
            'sync': this.__('activity.titles.sync'),
            'error': this.__('activity.titles.error')
        };
        return activity.user_name || titles[activity.action] || this.__('activity.titles.system');
    }

    getActivityDescription(activity) {
        const resource = activity.entity_type || '';
        const action = activity.action || '';
        const userName = activity.user_name || this.__('export.system');

        const resourceNames = {
            'products': this.__('activity.resources.products'),
            'devices': this.__('activity.resources.devices'),
            'templates': this.__('activity.resources.templates'),
            'users': this.__('activity.resources.users'),
            'companies': this.__('activity.resources.companies'),
            'media': this.__('activity.resources.media'),
            'playlists': this.__('activity.resources.playlists'),
            'categories': this.__('activity.resources.categories')
        };

        const resourceName = resourceNames[resource] || resource;

        if (action === 'login') return this.__('activity.descriptions.login', { user: userName });
        if (action === 'logout') return this.__('activity.descriptions.logout', { user: userName });
        if (action === 'create') return this.__('activity.descriptions.create', { user: userName, resource: resourceName });
        if (action === 'update') return this.__('activity.descriptions.update', { user: userName, resource: resourceName });
        if (action === 'delete') return this.__('activity.descriptions.delete', { user: userName, resource: resourceName });
        if (action === 'import') return this.__('activity.descriptions.import', { user: userName, resource: resourceName });
        if (action === 'send') return this.__('activity.descriptions.send', { user: userName });
        if (action === 'export') return this.__('activity.descriptions.export', { user: userName });
        if (action === 'sync') return this.__('activity.descriptions.sync', { user: userName });

        return activity.details || `${userName} - ${action}`;
    }

    // =========================================
    // EXPORT (kept from original)
    // =========================================

    async exportReport() {
        const btn = document.querySelector('.page-header-right .btn-outline');
        const originalContent = btn?.innerHTML;

        try {
            if (btn) {
                btn.innerHTML = `<i class="ti ti-loader-2 spin"></i> ${this.__('toast.downloading')}`;
                btn.disabled = true;
            }

            Toast.info(this.__('toast.reportPreparing'));

            const apiUrl = this.app.config?.apiUrl || '/api';
            const token = localStorage.getItem('omnex_token');

            const response = await fetch(`${apiUrl}/reports/export?format=csv`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Active-Company': localStorage.getItem('omnex_active_company') || ''
                }
            });

            if (!response.ok) throw new Error(this.__('toast.reportError'));

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `dashboard_raporu_${new Date().toISOString().slice(0, 10)}.csv`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) filename = match[1].replace(/['"]/g, '');
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Toast.success(this.__('toast.reportDownloaded'));
        } catch (error) {
            Logger.error('Report export error:', error);
            Toast.error(this.__('toast.reportError'));
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    }

    async exportActivities() {
        try {
            Toast.info(this.__('toast.activityPreparing'));

            const apiUrl = this.app.config?.apiUrl || '/api';
            const token = localStorage.getItem('omnex_token');

            const response = await fetch(`${apiUrl}/audit-logs?limit=1000`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Active-Company': localStorage.getItem('omnex_active_company') || ''
                }
            });

            if (!response.ok) throw new Error(this.__('toast.activityExportError'));

            const result = await response.json();
            const activities = result.data || [];

            if (activities.length === 0) {
                Toast.warning(this.__('toast.noActivityToExport'));
                return;
            }

            const headers = [
                this.__('export.headers.date'),
                this.__('export.headers.user'),
                this.__('export.headers.action'),
                this.__('export.headers.resource'),
                this.__('export.headers.details'),
                this.__('export.headers.ipAddress')
            ];
            const rows = activities.map(a => [
                new Date(a.created_at).toLocaleString('tr-TR'),
                a.user_name || this.__('export.system'),
                a.action || '',
                a.resource_type || '',
                (a.details || '').replace(/"/g, '""'),
                a.ip_address || ''
            ]);

            let csvContent = '\uFEFF';
            csvContent += headers.join(';') + '\n';
            csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(';')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aktivite_kayitlari_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Toast.success(this.__('toast.activityExported', { count: activities.length }));
        } catch (error) {
            Logger.error('Activities export error:', error);
            Toast.error(this.__('toast.activityExportError'));
        }
    }

    // =========================================
    // STORAGE HELPERS (kept from original)
    // =========================================

    _storagePercent(stats) {
        if (stats.storage_unlimited || !stats.storage_limit_mb) return 0;
        return Math.min(100, Math.round((stats.storage_used_mb / stats.storage_limit_mb) * 100));
    }

    _storageIconColor(stats) {
        const pct = this._storagePercent(stats);
        if (stats.storage_unlimited || pct < 70) return 'teal';
        if (pct < 90) return 'amber';
        return 'rose';
    }

    _storageStrokeColor(stats) {
        const pct = this._storagePercent(stats);
        if (pct < 70) return '#12b886';
        if (pct < 90) return '#fab005';
        return '#fa5252';
    }

    _storageFooterClass(stats) {
        if (stats.storage_unlimited) return 'success';
        const pct = this._storagePercent(stats);
        if (pct < 70) return 'success';
        if (pct < 90) return 'warning';
        return 'danger';
    }

    _storageFooterIcon(stats) {
        if (stats.storage_unlimited) return 'infinity';
        const pct = this._storagePercent(stats);
        if (pct >= 90) return 'alert-triangle';
        return 'circle-check';
    }

    _storageFooterText(stats) {
        if (stats.storage_unlimited) return this.__('stats.unlimitedStorage');
        if (!stats.storage_limit_mb) return `${this._formatStorage(stats.storage_used_mb || 0)} ${this.__('stats.used')}`;
        const remaining = Math.max(0, stats.storage_limit_mb - (stats.storage_used_mb || 0));
        return `${this._formatStorage(remaining)} ${this.__('stats.remaining')}`;
    }

    _formatStorage(mb) {
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${Math.round(mb)} MB`;
    }

    // =========================================
    // NEW HELPER METHODS
    // =========================================

    _formatTimeAgo(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return this.__('period.today');
        if (minutes < 60) return `${minutes} dk`;
        if (hours < 24) return `${hours} ${this.__('period.today').toLowerCase() === 'bugün' ? 'saat' : 'h'}`;
        if (days === 1) return this.__('period.yesterday');
        if (days < 30) return this.__('period.daysAgo', { count: days });

        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    }

    _calcDaysRemaining(endDate) {
        if (!endDate) return null;
        const end = new Date(endDate);
        const now = new Date();
        return Math.ceil((end - now) / 86400000);
    }

    formatNumber(num) {
        return new Intl.NumberFormat('tr-TR').format(num);
    }

    formatTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (hours < 24) {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }
        if (days === 1) {
            return `${this.__('period.yesterday')}, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (days < 7) {
            return this.__('period.daysAgo', { count: days });
        }

        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    }

    destroy() {
        window.dashboardPage = null;
    }
}

export default DashboardPage;
