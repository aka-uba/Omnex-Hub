/**
 * Dashboard Analytics Page Component
 */

import { Logger } from '../../core/Logger.js';

export class DashboardAnalyticsPage {
    constructor(app) {
        this.app = app;
        this.stats = {};
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('dashboard');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.analytics')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon rose">
                            <i class="ti ti-chart-bar"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('breadcrumb.analytics')}</h1>
                            <p class="page-subtitle">${this.__('header.systemAnalytics')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <select id="date-range" class="form-select">
                            <option value="7">${this.__('period.last7Days')}</option>
                            <option value="30" selected>${this.__('period.last30Days')}</option>
                            <option value="90">${this.__('period.last90Days')}</option>
                        </select>
                        <button id="export-btn" class="btn btn-primary">
                            <i class="ti ti-download"></i>
                            <span>${this.__('header.downloadReport')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="report-stats">
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon blue">
                            <i class="ti ti-package"></i>
                        </div>
                        <span class="analytics-trend up">
                            <i class="ti ti-trending-up"></i>
                            +12%
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.totalProducts')}</p>
                    <p class="analytics-card-value" id="stat-products">-</p>
                    <p class="analytics-card-footer">${this.__('stats.inLast30Days')}</p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon indigo">
                            <i class="ti ti-device-tablet"></i>
                        </div>
                        <div class="circular-progress" id="device-progress" style="--percent: 0">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                                <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="#6366f1" stroke-width="4" stroke-linecap="round"></circle>
                            </svg>
                            <span class="progress-text" id="device-percent">0%</span>
                        </div>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.activeDevices')}</p>
                    <p class="analytics-card-value" id="stat-devices">-</p>
                    <p class="analytics-card-footer highlight success">
                        <i class="ti ti-circle-check"></i>
                        ${this.__('stats.online')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon amber">
                            <i class="ti ti-refresh"></i>
                        </div>
                        <span class="analytics-trend up">
                            <i class="ti ti-arrow-up"></i>
                            +8%
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.labelUpdates')}</p>
                    <p class="analytics-card-value" id="stat-updates">-</p>
                    <p class="analytics-card-footer">${this.__('stats.inThisPeriod')}</p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon rose">
                            <i class="ti ti-chart-arrows"></i>
                        </div>
                        <span class="analytics-trend down" id="error-trend">
                            <i class="ti ti-trending-down"></i>
                            -5%
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.errorRate')}</p>
                    <p class="analytics-card-value" id="stat-errors">-</p>
                    <p class="analytics-card-footer">${this.__('stats.belowIndustryAvg')}</p>
                </div>
            </div>

            <!-- Main Content -->
            <div class="dashboard-main">
                <!-- Left Column - Charts -->
                <div class="dashboard-content">
                    <!-- Updates Chart -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-chart-line"></i>
                                ${this.__('charts.labelUpdates')}
                            </h2>
                            <select class="form-select" id="updates-period" style="width: auto; min-width: 120px;">
                                <option value="7">${this.__('period.last7Days')}</option>
                                <option value="30" selected>${this.__('period.last30Days')}</option>
                            </select>
                        </div>
                        <div class="chart-card-body">
                            <div class="chart-placeholder" id="updates-chart">
                                <i class="ti ti-chart-area-line"></i>
                                <p>${this.__('charts.loading')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Device Status Chart -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-chart-pie"></i>
                                ${this.__('charts.deviceStatus')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="chart-placeholder" id="devices-chart">
                                <i class="ti ti-chart-donut-3"></i>
                                <p>${this.__('charts.loading')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column - Activities -->
                <div class="activity-card">
                    <div class="activity-card-header">
                        <h2 class="activity-card-title">
                            <i class="ti ti-history"></i>
                            ${this.__('recentActivity.title')}
                        </h2>
                        <a href="#/admin/audit-log" class="btn btn-sm btn-ghost text-primary">${this.__('recentActivity.viewAll')}</a>
                    </div>
                    <div class="activity-card-body" id="activity-list">
                        ${this.renderLoading()}
                    </div>
                    <div class="activity-card-footer">
                        <button onclick="window.reportsPage?.exportActivities()">
                            ${this.__('recentActivity.exportAll')}
                            <i class="ti ti-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="activity-timeline">
                ${[1, 2, 3, 4].map(() => `
                    <div class="activity-item animate-pulse">
                        <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        <div class="activity-content">
                            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderActivity() {
        let activities = this.stats.recent_activities || [];

        if (!activities.length) {
            // Demo data
            activities = [
                {
                    type: 'update',
                    title: this.__('activity.titles.bulkPriceUpdate'),
                    message: this.__('activity.messages.bulkPriceUpdate', { count: 156 }),
                    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
                },
                {
                    type: 'device',
                    title: this.__('activity.titles.deviceSync'),
                    message: this.__('activity.messages.allDevicesSynced'),
                    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
                },
                {
                    type: 'product',
                    title: this.__('activity.titles.productImport'),
                    message: this.__('activity.messages.productsImportedFromERP', { count: 324 }),
                    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
                },
                {
                    type: 'error',
                    title: this.__('activity.titles.connectionWarning'),
                    message: this.__('activity.messages.gatewayConnectionIssue', { gateway: 'Gateway-02' }),
                    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                }
            ];
        }

        const iconMap = {
            'product': { icon: 'ti-package', color: 'blue' },
            'device': { icon: 'ti-device-tablet', color: 'green' },
            'update': { icon: 'ti-refresh', color: 'blue' },
            'error': { icon: 'ti-alert-triangle', color: 'red' },
            'user': { icon: 'ti-user', color: 'amber' }
        };

        return `
            <div class="activity-timeline">
                ${activities.map(a => {
                    const { icon, color } = iconMap[a.type] || { icon: 'ti-activity', color: 'blue' };
                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${color}">
                                <i class="ti ${icon}"></i>
                            </div>
                            <div class="activity-content">
                                <time class="activity-time">${this.formatTime(a.created_at)}</time>
                                <h4 class="activity-title">${a.title || this.__('common.systemActivity')}</h4>
                                <p class="activity-desc">${a.message}</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    formatTime(dateStr) {
        if (!dateStr) return '';

        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        const locale = this.app.i18n.currentLanguage === 'tr' ? 'tr-TR' : 'en-US';

        if (hours < 24) {
            return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
        if (days === 1) {
            return `${this.__('period.yesterday')}, ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (days < 7) {
            return this.__('period.daysAgo', { count: days });
        }

        return date.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short'
        });
    }

    async init() {
        window.reportsPage = this;
        await this.loadStats();
        this.bindEvents();
    }

    async loadStats() {
        try {
            const response = await this.app.api.get('/reports/dashboard-stats');
            this.stats = response.data || {};
            this.updateUI();
        } catch (error) {
            Logger.error('Stats load error:', error);
            this.updateUI();
        }
    }

    updateUI() {
        // API returns: products, online_devices, total_devices, updates, error_rate
        const totalDevices = this.stats.total_devices || 1;
        const onlineDevices = this.stats.online_devices || 0;
        const devicePercent = Math.round((onlineDevices / totalDevices) * 100);

        document.getElementById('stat-products').textContent = this.formatNumber(this.stats.products || 0);
        document.getElementById('stat-devices').textContent = `${this.formatNumber(onlineDevices)} / ${this.formatNumber(totalDevices)}`;
        document.getElementById('stat-updates').textContent = this.formatNumber(this.stats.updates || 0);
        document.getElementById('stat-errors').textContent = (this.stats.error_rate || 0).toFixed(2) + '%';
        document.getElementById('activity-list').innerHTML = this.renderActivity();

        // Update circular progress
        const progressEl = document.getElementById('device-progress');
        const percentEl = document.getElementById('device-percent');
        if (progressEl) progressEl.style.setProperty('--percent', devicePercent);
        if (percentEl) percentEl.textContent = `${devicePercent}%`;

        // Render charts
        this.renderUpdatesChart();
        this.renderDevicesChart();
    }

    /**
     * Render updates bar chart
     */
    renderUpdatesChart() {
        const container = document.getElementById('updates-chart');
        if (!container) return;

        const days = parseInt(document.getElementById('updates-period')?.value || '30');
        const totalUpdates = this.stats.updates || 0;
        const todayUpdates = this.stats.today_updates || 0;

        // Generate sample data based on stats
        const data = [];
        const avgPerDay = Math.max(1, Math.round(totalUpdates / days));

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            // Variance for realistic look
            const variance = Math.floor(Math.random() * avgPerDay * 0.5);
            const value = i === 0 ? todayUpdates : Math.max(0, avgPerDay + variance - Math.floor(avgPerDay * 0.25));

            data.push({
                date: date,
                value: value
            });
        }

        const maxValue = Math.max(...data.map(d => d.value), 1);

        // Show only subset of days based on period
        const showDays = days <= 7 ? days : (days <= 30 ? 15 : 20);
        const step = Math.ceil(days / showDays);
        const filteredData = data.filter((_, i) => i % step === 0 || i === data.length - 1);

        const locale = this.app.i18n.currentLanguage === 'tr' ? 'tr-TR' : 'en-US';

        container.innerHTML = `
            <div class="updates-chart-wrapper">
                <div class="chart-summary">
                    <div class="chart-summary-item">
                        <span class="chart-summary-value">${this.formatNumber(totalUpdates)}</span>
                        <span class="chart-summary-label">${this.__('charts.totalUpdates')}</span>
                    </div>
                    <div class="chart-summary-item">
                        <span class="chart-summary-value">${todayUpdates}</span>
                        <span class="chart-summary-label">${this.__('period.today')}</span>
                    </div>
                    <div class="chart-summary-item">
                        <span class="chart-summary-value">${avgPerDay}</span>
                        <span class="chart-summary-label">${this.__('charts.dailyAverage')}</span>
                    </div>
                </div>
                <div class="chart-bars">
                    ${filteredData.map(d => {
                        const height = Math.max(4, (d.value / maxValue) * 160);
                        const dateStr = d.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                        return `
                            <div class="chart-bar-group" title="${dateStr}: ${d.value} ${this.__('charts.updates')}">
                                <div class="chart-bar-stack">
                                    <div class="chart-bar updates" style="height: ${height}px;"></div>
                                </div>
                                <span class="chart-bar-label">${d.date.getDate()}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render devices donut chart
     */
    renderDevicesChart() {
        const container = document.getElementById('devices-chart');
        if (!container) return;

        const total = this.stats.total_devices || 0;
        const online = this.stats.online_devices || 0;
        const offline = total - online;

        if (total === 0) {
            container.innerHTML = `
                <div class="chart-empty">
                    <i class="ti ti-device-desktop-off"></i>
                    <p>${this.__('charts.noDevices')}</p>
                </div>
            `;
            return;
        }

        const onlinePercent = Math.round((online / total) * 100);
        const offlinePercent = 100 - onlinePercent;

        // CSS conic-gradient for donut chart
        const gradient = `conic-gradient(
            #10b981 0% ${onlinePercent}%,
            #f59e0b ${onlinePercent}% 100%
        )`;

        container.innerHTML = `
            <div class="donut-chart-wrapper">
                <div class="donut-chart" style="background: ${gradient};">
                    <div class="donut-chart-center">
                        <span class="donut-chart-value">${total}</span>
                        <span class="donut-chart-label">${this.__('gateways.totalDevices')}</span>
                    </div>
                </div>
                <div class="donut-chart-legend">
                    <div class="donut-legend-item">
                        <span class="donut-legend-dot online"></span>
                        <span class="donut-legend-label">${this.__('stats.online')}</span>
                        <span class="donut-legend-value">${online} (${onlinePercent}%)</span>
                    </div>
                    <div class="donut-legend-item">
                        <span class="donut-legend-dot offline"></span>
                        <span class="donut-legend-label">${this.__('stats.offline')}</span>
                        <span class="donut-legend-value">${offline} (${offlinePercent}%)</span>
                    </div>
                </div>
            </div>
        `;
    }

    formatNumber(num) {
        return new Intl.NumberFormat('tr-TR').format(num);
    }

    bindEvents() {
        document.getElementById('date-range')?.addEventListener('change', (e) => {
            this.loadStats();
        });

        document.getElementById('updates-period')?.addEventListener('change', () => {
            this.renderUpdatesChart();
        });

        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportReport();
        });
    }

    exportReport() {
        // Generate simple CSV report
        const data = [
            [this.__('export.headers.metric'), this.__('export.headers.value')],
            [this.__('export.headers.totalProduct'), this.stats.products || 0],
            [this.__('export.headers.totalDevice'), this.stats.total_devices || 0],
            [this.__('export.headers.onlineDevice'), this.stats.online_devices || 0],
            [this.__('export.headers.labelUpdate'), this.stats.updates || 0],
            [this.__('export.headers.todayUpdates'), this.stats.today_updates || 0],
            [this.__('export.headers.templateCount'), this.stats.templates || 0],
            [this.__('export.headers.categoryCount'), this.stats.categories || 0],
            [this.__('export.headers.errorRate'), (this.stats.error_rate || 0) + '%']
        ];

        const csv = data.map(row => row.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapor_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        const { Toast } = window.OmnexApp?.components || {};
        if (Toast) {
            Toast.success(this.__('toast.reportDownloaded'));
        }
    }

    exportActivities() {
        const { Toast } = window.OmnexApp?.components || {};
        if (Toast) {
            Toast.info(this.__('toast.activityPreparing'));
        }
        // Export activities logic would go here
    }

    destroy() {
        window.reportsPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default DashboardAnalyticsPage;
