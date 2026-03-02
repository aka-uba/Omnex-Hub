/**
 * QueueAnalytics - Kuyruk Analitik Modülü
 *
 * QueueDashboard'dan ayrılmış bağımsız modül.
 * Analitik kartları, öncelik analizi, hata analizi, performans metrikleri ve trendleri render eder.
 *
 * @version 1.0.0
 * @example
 * import { init as initQueueAnalytics } from './dashboard/QueueAnalytics.js';
 *
 * const analytics = initQueueAnalytics({
 *     container: document.getElementById('analytics-container'),
 *     app: this.app,
 *     onTrendViewChange: (view) => { ... }
 * });
 *
 * analytics.render(analyticsData);
 */

import { Logger } from '../../../core/Logger.js';
import * as QueueMetrics from './QueueMetrics.js';

/**
 * QueueAnalytics init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Function} params.onTrendViewChange - Trend görünüm değişikliği callback
 * @param {Function} params.onWorkerStart - Worker başlatma callback
 * @param {Function} params.onWorkerStop - Worker durdurma callback
 * @returns {QueueAnalytics} QueueAnalytics instance
 */
export function init({ container, app, onTrendViewChange, onWorkerStart, onWorkerStop }) {
    if (!container) {
        throw new Error('QueueAnalytics: container parametresi zorunludur');
    }
    return new QueueAnalytics({ container, app, onTrendViewChange, onWorkerStart, onWorkerStop });
}

class QueueAnalytics {
    constructor({ container, app, onTrendViewChange, onWorkerStart, onWorkerStop }) {
        this.container = container;
        this.app = app;
        this.onTrendViewChange = onTrendViewChange;
        this.onWorkerStart = onWorkerStart;
        this.onWorkerStop = onWorkerStop;

        // State
        this._analytics = null;
        this._currentTrendView = 'daily';
        this._workerRunning = false;
        this._workerProgress = 0;
        this._workerProcessedJobs = 0;
        this._workerProcessedDevices = 0;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Analitik verilerini güncelle ve render et
     * @param {Object} analytics - Analitik verileri
     */
    render(analytics) {
        this._analytics = analytics;
        if (!this._analytics) return;

        this.renderQuickStats();
        this.renderPriorityAnalysis();
        this.renderErrorAnalysis();
        this.renderPerformanceMetrics();
        this.renderRetryAnalysis();
        this.renderWorkerStatus();
        this.renderTrends();
    }

    /**
     * Worker durumunu güncelle
     * @param {Object} workerState - Worker state objesi
     */
    updateWorkerState(workerState) {
        this._workerRunning = workerState.running || false;
        this._workerProgress = workerState.progress || 0;
        this._workerProcessedJobs = workerState.processedJobs || 0;
        this._workerProcessedDevices = workerState.processedDevices || 0;

        // Sadece worker status bölümünü yeniden render et
        this.renderWorkerStatus();
    }

    /**
     * Trend görünümünü değiştir
     * @param {string} view - 'daily' veya 'hourly'
     */
    setTrendView(view) {
        this._currentTrendView = view;
        this.renderTrends();

        if (this.onTrendViewChange) {
            this.onTrendViewChange(view);
        }
    }

    /**
     * Hızlı istatistikleri render et
     */
    renderQuickStats() {
        const qs = this._analytics.queue_status || {};

        const pendingEl = document.getElementById('pending-value');
        const processingEl = document.getElementById('processing-value');
        const completedEl = document.getElementById('completed-value');
        const failedEl = document.getElementById('failed-value');

        if (pendingEl) pendingEl.textContent = this.formatNumber(qs.pending || 0);
        if (processingEl) processingEl.textContent = this.formatNumber(qs.processing || 0);
        if (completedEl) completedEl.textContent = this.formatNumber(qs.completed || 0);
        if (failedEl) failedEl.textContent = this.formatNumber(qs.failed || 0);
    }

    /**
     * Öncelik analizini render et
     */
    renderPriorityAnalysis() {
        const pa = this._analytics.priority_analysis || {};
        const container = document.getElementById('priority-list');
        if (!container) return;

        const priorities = ['urgent', 'high', 'normal', 'low'];
        let html = '';
        let hasAnyData = false;

        priorities.forEach(p => {
            const data = pa[p] || { jobs: 0, pending_devices: 0, total_jobs: 0, completed_jobs: 0, failed_jobs: 0 };
            const totalJobs = data.total_jobs || 0;
            if (totalJobs > 0) hasAnyData = true;

            html += `
                <div class="priority-item">
                    <span class="priority-badge ${p}" title="${this.__(`wizard.priority.${p}Desc`)}">${this.__(`priority.${p}`)}</span>
                    <div class="priority-stats">
                        <span>${this.__('priority.totalJobs')}: <strong>${totalJobs}</strong></span>
                        ${data.jobs > 0 ? `<span>${this.__('priority.activeJobs')}: <strong>${data.jobs}</strong></span>` : ''}
                        ${data.completed_jobs > 0 ? `<span class="text-success">${this.__('priority.completedJobs')}: <strong>${data.completed_jobs}</strong></span>` : ''}
                        ${data.failed_jobs > 0 ? `<span class="text-danger">${this.__('priority.failedJobs')}: <strong>${data.failed_jobs}</strong></span>` : ''}
                    </div>
                </div>
            `;
        });

        if (!hasAnyData) {
            html = `<div class="text-secondary text-center py-3">${this.__('jobs.noJobs')}</div>`;
        }

        // Most waiting (active jobs)
        if (pa.most_waiting) {
            html += `
                <div style="margin-top: 0.75rem;">
                    <span class="most-waiting-badge">
                        <i class="ti ti-alert-circle"></i>
                        ${this.__('priority.mostWaiting')}: ${this.__(`priority.${pa.most_waiting.priority}`)} (${this.__('priority.deviceCount', { count: pa.most_waiting.pending_devices })})
                    </span>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Hata analizini render et
     */
    renderErrorAnalysis() {
        const ea = this._analytics.error_analysis || {};
        const container = document.getElementById('error-list');
        if (!container) return;

        const types = ea.types || [];
        let html = '';

        if (types.length === 0) {
            html = `<div class="text-secondary text-center py-3">${this.__('jobs.noJobs')}</div>`;
        } else {
            types.forEach(err => {
                const typeLabel = this.__(`errors.${err.type}`) || err.type;
                html += `
                    <div class="error-item">
                        <span class="error-type">${typeLabel}</span>
                        <span class="error-count">${err.count}</span>
                        <span class="error-avg-retries">${this.__('errors.avgRetriesFormat', { count: err.avg_retries?.toFixed(1) || 0 })}</span>
                    </div>
                `;
            });

            // Summary
            if (ea.most_common) {
                html += `
                    <div class="error-summary">
                        <span class="error-summary-label">${this.__('errors.mostCommon')}</span>
                        <span class="error-summary-value">${this.__(`errors.${ea.most_common.type}`)} (${ea.most_common.count})</span>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    }

    /**
     * Performans metriklerini render et
     */
    renderPerformanceMetrics() {
        const pm = this._analytics.performance_metrics || {};
        const container = document.getElementById('performance-grid');
        if (!container) return;

        const hasAvg = pm.avg_completion_seconds !== null && pm.avg_completion_seconds !== undefined && !Number.isNaN(Number(pm.avg_completion_seconds));
        const hasMin = pm.min_completion_seconds !== null && pm.min_completion_seconds !== undefined;
        const hasMax = pm.max_completion_seconds !== null && pm.max_completion_seconds !== undefined;
        const hasPerDevice = pm.avg_seconds_per_device !== null && pm.avg_seconds_per_device !== undefined && !Number.isNaN(Number(pm.avg_seconds_per_device));
        const hasSuccessRate = pm.success_rate !== null && pm.success_rate !== undefined && !Number.isNaN(Number(pm.success_rate));

        const avgText = pm.avg_completion_formatted || (hasAvg ? `${Number(pm.avg_completion_seconds).toFixed(1)}s` : '-');
        const minText = hasMin ? `${Number(pm.min_completion_seconds)}s` : '-';
        const maxText = hasMax ? `${Number(pm.max_completion_seconds)}s` : '-';
        const perDeviceText = hasPerDevice ? `${Number(pm.avg_seconds_per_device).toFixed(1)}s` : '-';
        const successRateText = hasSuccessRate ? `${Number(pm.success_rate).toFixed(1)}%` : '-';

        container.innerHTML = `
            <div class="performance-item">
                <div class="performance-value">${avgText}</div>
                <div class="performance-label">${this.__('performance.avgCompletion')}</div>
            </div>
            <div class="performance-item">
                <div class="performance-value">${minText}</div>
                <div class="performance-label">${this.__('performance.minCompletion')}</div>
            </div>
            <div class="performance-item">
                <div class="performance-value">${maxText}</div>
                <div class="performance-label">${this.__('performance.maxCompletion')}</div>
            </div>
            <div class="performance-item">
                <div class="performance-value">${perDeviceText}</div>
                <div class="performance-label">${this.__('performance.perDevice')}</div>
            </div>
            <div class="performance-item">
                <div class="performance-value success">${successRateText}</div>
                <div class="performance-label">${this.__('performance.successRate')}</div>
            </div>
            <div class="performance-item">
                <div class="performance-value">${pm.sample_size || 0}</div>
                <div class="performance-label">${this.__('performance.sampleSize')}</div>
            </div>
        `;
    }

    /**
     * Retry analizini render et
     */
    renderRetryAnalysis() {
        const ra = this._analytics.retry_analysis || {};
        const container = document.getElementById('retry-stats');
        if (!container) return;

        // Distribution
        const dist = ra.distribution || [];
        let distHtml = dist.map(d => `
            <span class="retry-dist-item">
                <span>Retry ${d.retry_count}:</span>
                <strong>${d.count}</strong>
            </span>
        `).join('');

        const totalItems = ra.total_items || 0;
        const totalFailed = ra.total_failed || 0;

        container.innerHTML = `
            <div class="retry-stat-row">
                <span class="retry-stat-label">
                    <i class="ti ti-list-check"></i>
                    ${this.__('retry.totalItems')}
                </span>
                <span class="retry-stat-value">${totalItems}</span>
            </div>
            <div class="retry-stat-row">
                <span class="retry-stat-label">
                    <i class="ti ti-x"></i>
                    ${this.__('retry.totalFailed')}
                </span>
                <span class="retry-stat-value ${totalFailed > 0 ? 'text-danger' : ''}">${totalFailed}</span>
            </div>
            <div class="retry-stat-row">
                <span class="retry-stat-label">
                    <i class="ti ti-clock-pause"></i>
                    ${this.__('retry.pending')}
                </span>
                <span class="retry-stat-value">${ra.pending_retries || 0}</span>
            </div>
            <div class="retry-stat-row">
                <span class="retry-stat-label">
                    <i class="ti ti-alert-octagon"></i>
                    ${this.__('retry.maxReached')}
                </span>
                <span class="retry-stat-value">${ra.max_retry_reached || 0}</span>
            </div>
            ${dist.length > 0 ? `
                <div class="retry-stat-row">
                    <span class="retry-stat-label">${this.__('retry.distribution')}</span>
                </div>
                <div class="retry-distribution">${distHtml}</div>
            ` : ''}
        `;
    }

    /**
     * Worker durumunu render et
     */
    renderWorkerStatus() {
        const ws = this._analytics?.worker_status || {};
        const container = document.getElementById('worker-status');
        if (!container) return;

        const isActive = this._workerRunning || ws.is_active;
        const statusClass = isActive ? 'active' : 'inactive';
        const statusText = isActive ? this.__('worker.active') : this.__('worker.inactive');
        const pendingCount = this._analytics?.queue_status?.pending || 0;

        container.innerHTML = `
            <div class="worker-status-header">
                <span class="worker-status-indicator ${statusClass}">
                    <span class="pulse"></span>
                    ${statusText}
                </span>
                <div class="worker-controls">
                    ${isActive ? `
                        <button class="btn btn-sm btn-outline-danger" id="stop-worker-btn" title="${this.__('worker.stop')}">
                            <i class="ti ti-player-stop"></i>
                            ${this.__('worker.stop')}
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-primary" id="start-worker-btn" title="${this.__('worker.start')}" ${pendingCount === 0 ? 'disabled' : ''}>
                            <i class="ti ti-player-play"></i>
                            ${this.__('worker.start')}
                        </button>
                    `}
                </div>
            </div>
            ${this._workerRunning ? `
                <div class="worker-progress-section">
                    <div class="worker-progress-bar">
                        <div class="worker-progress-fill" id="worker-progress-fill" style="width: ${this._workerProgress || 0}%"></div>
                    </div>
                    <div class="worker-progress-text">
                        <span>${this._workerProcessedJobs || 0} ${this.__('worker.jobsProcessed')}</span>
                        <span>${this._workerProcessedDevices || 0} ${this.__('worker.devicesProcessed')}</span>
                    </div>
                </div>
            ` : ''}
            <div class="worker-times">
                <div class="worker-time-row">
                    <span class="worker-time-label">${this.__('worker.lastProcessing')}</span>
                    <span class="worker-time-value">${this.formatTime(ws.last_processing)}</span>
                </div>
                <div class="worker-time-row">
                    <span class="worker-time-label">${this.__('worker.lastCompleted')}</span>
                    <span class="worker-time-value">${this.formatTime(ws.last_completed)}</span>
                </div>
                <div class="worker-time-row">
                    <span class="worker-time-label">${this.__('worker.lastCreated')}</span>
                    <span class="worker-time-value">${this.formatTime(ws.last_job_created)}</span>
                </div>
            </div>
        `;

        // Bind worker control buttons
        this._bindWorkerControls();
    }

    /**
     * Worker kontrol butonlarını bağla
     * @private
     */
    _bindWorkerControls() {
        const startBtn = document.getElementById('start-worker-btn');
        const stopBtn = document.getElementById('stop-worker-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.onWorkerStart) this.onWorkerStart();
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (this.onWorkerStop) this.onWorkerStop();
            });
        }
    }

    /**
     * Trend grafiğini render et
     */
    renderTrends() {
        const trends = this._analytics?.trends || {};
        const container = document.getElementById('trends-chart');
        if (!container) return;

        const data = this._currentTrendView === 'daily' ? trends.daily : trends.hourly;
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="queue-empty-state"><p>${this.__('jobs.noJobs')}</p></div>`;
            return;
        }

        // Find max values for scaling
        const maxJobs = Math.max(...data.map(d => d.total_jobs || 0), 1);
        const maxDevices = Math.max(...data.map(d => d.total_devices || 0), 1);
        const maxValue = Math.max(maxJobs, maxDevices);

        let html = '';
        data.forEach(item => {
            const label = this._currentTrendView === 'daily'
                ? this.formatDateShort(item.date)
                : item.hour + ':00';

            const jobsHeight = Math.max(4, (item.total_jobs || 0) / maxValue * 140);
            const devicesHeight = Math.max(4, (item.total_devices || 0) / maxValue * 140);

            html += `
                <div class="trend-bar-group">
                    <div class="trend-bars">
                        <div class="trend-bar jobs" style="height: ${jobsHeight}px" title="${this.__('trends.jobs')}: ${item.total_jobs || 0}"></div>
                        <div class="trend-bar devices" style="height: ${devicesHeight}px" title="${this.__('trends.devices')}: ${item.total_devices || 0}"></div>
                    </div>
                    <span class="trend-label">${label}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Event listener'ları bağla
     */
    bindEvents() {
        // Trend view toggle buttons
        const dailyBtn = document.getElementById('trend-daily-btn');
        const hourlyBtn = document.getElementById('trend-hourly-btn');

        if (dailyBtn) {
            dailyBtn.addEventListener('click', () => this.setTrendView('daily'));
        }
        if (hourlyBtn) {
            hourlyBtn.addEventListener('click', () => this.setTrendView('hourly'));
        }
    }

    // ==================== Utility Fonksiyonlar (QueueMetrics'e delege) ====================

    /**
     * Sayı formatlama
     * @deprecated QueueMetrics.formatNumber() kullanın
     */
    formatNumber(num) {
        return QueueMetrics.formatNumber(num);
    }

    /**
     * Zaman formatlama
     * @deprecated QueueMetrics.formatTime() kullanın
     */
    formatTime(dateStr) {
        return QueueMetrics.formatTime(dateStr);
    }

    /**
     * Kısa tarih formatlama
     * @deprecated QueueMetrics.formatDateShort() kullanın
     */
    formatDateShort(dateStr) {
        return QueueMetrics.formatDateShort(dateStr);
    }

    /**
     * Mevcut trend görünümünü al
     */
    getTrendView() {
        return this._currentTrendView;
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        this._analytics = null;
    }
}

export { QueueAnalytics };
