/**
 * Queue Dashboard Page
 * Render queue monitoring and management interface
 *
 * @version 1.0.0
 */

import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';
import { DataTable } from '../../components/DataTable.js';
import { getTemplateRenderer } from '../../services/TemplateRenderer.js?v=1.0.70';
import { getRenderWorker } from '../../components/RenderWorker.js?v=1.0.67';

// Modular components (Faz 2 refactor)
import { init as initQueueAnalytics } from './dashboard/QueueAnalytics.js';
import { init as initAutoSendWizard } from './dashboard/AutoSendWizard.js';
import { init as initJobStatusTable } from './dashboard/JobStatusTable.js';
import * as QueueMetrics from './dashboard/QueueMetrics.js';

export class QueueDashboardPage {
    constructor(app) {
        this.app = app;
        this.refreshInterval = null;
        this.autoRefreshEnabled = true;
        this.refreshRate = 10000; // 10 seconds
        this.analytics = null;
        this.jobs = [];
        this.currentFilter = 'all';
        this.currentTrendView = 'daily';
        this.dataTable = null;

        // Modular components (Faz 2)
        this._queueAnalytics = null;
        this._autoSendWizard = null;
        this._jobStatusTable = null;
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
        await this.app.i18n.loadPageTranslations('queue');
    }

    /**
     * Render page HTML
     */
    render() {
        return `
            <!-- Page Header -->
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/admin/users">${this.__('breadcrumb.admin')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.current')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon purple">
                            <i class="ti ti-list-check"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <div class="auto-refresh-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" id="auto-refresh-toggle" checked>
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="toggle-label">${this.__('autoRefresh')}</span>
                        </div>
                        <button id="refresh-btn" class="btn btn-outline">
                            <i class="ti ti-refresh"></i>
                            ${this.__('refresh')}
                        </button>
                        <button id="cleanup-btn" class="btn btn-outline text-warning">
                            <i class="ti ti-trash"></i>
                            ${this.__('actions.cleanup')}
                        </button>
                        <button id="auto-send-btn" class="btn btn-primary">
                            <i class="ti ti-bolt"></i>
                            ${this.__('actions.autoSend')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div id="loading-state" class="loading-container">
                <div class="loading-spinner"></div>
                <p>${this.__('messages.loading')}</p>
            </div>

            <!-- Content -->
            <div id="queue-content" style="display: none;">
                <!-- Last Update Info -->
                <div class="last-update-bar">
                    <span class="last-update-text">
                        <i class="ti ti-clock"></i>
                        ${this.__('lastUpdate')}: <span id="last-update-time">-</span>
                    </span>
                </div>

                <!-- Quick Stats -->
                <div class="queue-stats-grid">
                    <div class="queue-stat-card" id="stat-pending">
                        <div class="queue-stat-icon blue">
                            <i class="ti ti-clock"></i>
                        </div>
                        <div class="queue-stat-info">
                            <span class="queue-stat-value" id="pending-value">0</span>
                            <span class="queue-stat-label">${this.__('stats.pending')}</span>
                        </div>
                    </div>
                    <div class="queue-stat-card" id="stat-processing">
                        <div class="queue-stat-icon yellow">
                            <i class="ti ti-loader"></i>
                        </div>
                        <div class="queue-stat-info">
                            <span class="queue-stat-value" id="processing-value">0</span>
                            <span class="queue-stat-label">${this.__('stats.processing')}</span>
                        </div>
                    </div>
                    <div class="queue-stat-card" id="stat-completed">
                        <div class="queue-stat-icon green">
                            <i class="ti ti-check"></i>
                        </div>
                        <div class="queue-stat-info">
                            <span class="queue-stat-value" id="completed-value">0</span>
                            <span class="queue-stat-label">${this.__('stats.completed')}</span>
                        </div>
                    </div>
                    <div class="queue-stat-card" id="stat-failed">
                        <div class="queue-stat-icon red">
                            <i class="ti ti-x"></i>
                        </div>
                        <div class="queue-stat-info">
                            <span class="queue-stat-value" id="failed-value">0</span>
                            <span class="queue-stat-label">${this.__('stats.failed')}</span>
                        </div>
                    </div>
                </div>

                <!-- Analytics Grid -->
                <div class="queue-analytics-grid">
                    <!-- Priority Analysis -->
                    <div class="queue-analytics-card">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-flag"></i>
                                ${this.__('priority.title')}
                            </span>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="priority-list" id="priority-list">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Error Analysis -->
                    <div class="queue-analytics-card">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-alert-triangle"></i>
                                ${this.__('errors.title')}
                            </span>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="error-list" id="error-list">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Performance Metrics -->
                    <div class="queue-analytics-card">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-chart-line"></i>
                                ${this.__('performance.title')}
                            </span>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="performance-grid" id="performance-grid">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Bottom Row: Retry Analysis, Worker Status, Trends - 3 column grid -->
                <div class="queue-bottom-grid">
                    <!-- Retry Analysis -->
                    <div class="queue-analytics-card queue-card-compact">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-refresh-alert"></i>
                                ${this.__('retry.title')}
                            </span>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="retry-stats" id="retry-stats">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Worker Status -->
                    <div class="queue-analytics-card queue-card-compact">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-server"></i>
                                ${this.__('worker.title')}
                            </span>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="worker-status-card" id="worker-status">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Trends Chart -->
                    <div class="queue-analytics-card queue-card-trends">
                        <div class="queue-analytics-card-header">
                            <span class="queue-analytics-card-title">
                                <i class="ti ti-trending-up"></i>
                                ${this.__('trends.title')}
                            </span>
                            <div class="trends-tabs">
                                <button class="trend-tab active" data-view="daily">${this.__('trends.daily')}</button>
                                <button class="trend-tab" data-view="hourly">${this.__('trends.hourly')}</button>
                            </div>
                        </div>
                        <div class="queue-analytics-card-body">
                            <div class="trends-chart-container">
                                <div class="trends-chart" id="trends-chart">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                            <div class="trends-legend">
                                <div class="legend-item">
                                    <span class="legend-color jobs"></span>
                                    ${this.__('trends.jobs')}
                                </div>
                                <div class="legend-item">
                                    <span class="legend-color devices"></span>
                                    ${this.__('trends.devices')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Jobs Table -->
                <div class="card card-table">
                    <div class="card-header">
                        <div class="card-header-left">
                            <h3 class="card-title">
                                <i class="ti ti-list"></i>
                                ${this.__('jobs.title')}
                            </h3>
                        </div>
                        <div class="card-header-right">
                            <div class="jobs-filter-tabs">
                                <button class="filter-tab active" data-filter="all">
                                    ${this.__('filters.all')}
                                    <span class="count" id="filter-count-all">0</span>
                                </button>
                                <button class="filter-tab" data-filter="pending">
                                    ${this.__('filters.pending')}
                                    <span class="count" id="filter-count-pending">0</span>
                                </button>
                                <button class="filter-tab" data-filter="processing">
                                    ${this.__('filters.processing')}
                                    <span class="count" id="filter-count-processing">0</span>
                                </button>
                                <button class="filter-tab" data-filter="completed">
                                    ${this.__('filters.completed')}
                                    <span class="count" id="filter-count-completed">0</span>
                                </button>
                                <button class="filter-tab" data-filter="failed">
                                    ${this.__('filters.failed')}
                                    <span class="count" id="filter-count-failed">0</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="jobs-table"></div>
                </div>
            </div>

            <!-- Wizard Container for AutoSendWizard module -->
            <div id="auto-wizard-container"></div>
        `;
    }

    /**
     * Initialize page
     */
    async init() {
        // Initialize modular components (Faz 2)
        this._initQueueAnalytics();
        this._initAutoSendWizard();
        this._initJobStatusTable();

        // Legacy fallback - yeni modül yoksa eskiyi kullan
        if (!this._jobStatusTable) {
            this.initJobsTable();
        }

        this.bindEvents();
        await this.loadData();
        this.startAutoRefresh();
    }

    /**
     * Initialize QueueAnalytics module
     * @private
     */
    _initQueueAnalytics() {
        // QueueAnalytics doğrudan DOM'daki elementlere eriştiğinden
        // container olarak queue-analytics-grid kullanılıyor
        const container = document.querySelector('.queue-analytics-grid');
        if (container) {
            this._queueAnalytics = initQueueAnalytics({
                container,
                app: this.app,
                onTrendViewChange: (view) => {
                    this.currentTrendView = view;
                },
                onWorkerStart: () => {
                    this.startWorker();
                },
                onWorkerStop: () => {
                    this.stopWorker();
                }
            });
            this._queueAnalytics.bindEvents();
        }
    }

    /**
     * Update worker UI - delegates to QueueAnalytics module or legacy method
     * @private
     */
    _updateWorkerUI() {
        if (this._queueAnalytics) {
            this._queueAnalytics.updateWorkerState({
                running: this._workerRunning,
                progress: this._workerProgress,
                processedJobs: this._workerProcessedJobs,
                processedDevices: this._workerProcessedDevices
            });
        } else {
            // Fallback to legacy method
            this.renderWorkerStatus();
        }
    }

    /**
     * Initialize AutoSendWizard module
     * @private
     */
    _initAutoSendWizard() {
        const container = document.getElementById('auto-wizard-container');
        if (container) {
            this._autoSendWizard = initAutoSendWizard({
                container,
                app: this.app,
                onSubmit: async (autoWizardData, preRenderedImages) => {
                    await this._handleAutoSendWizardSubmit(autoWizardData, preRenderedImages);
                },
                onClose: () => {
                    // Wizard kapandığında bir işlem gerekirse
                },
                onStartWorker: () => {
                    this.startWorker();
                }
            });
        }
    }

    /**
     * Handle AutoSendWizard submit - called after module completes API call
     * Note: API call and Toast are already handled in AutoSendWizard module
     * This callback only refreshes data (no duplicate API call!)
     * @private
     */
    async _handleAutoSendWizardSubmit(autoWizardData, preRenderedImages) {
        // Modül zaten API çağrısı yaptı ve Toast gösterdi
        // Sadece verileri yenile
        await this.loadData();
    }

    /**
     * Initialize JobStatusTable module
     * @private
     */
    _initJobStatusTable() {
        const container = document.getElementById('jobs-table');
        if (container) {
            this._jobStatusTable = initJobStatusTable({
                container,
                app: this.app,
                onJobAction: async (action, job) => {
                    await this._handleJobAction(action, job);
                },
                onSelectionChange: (selectedIds) => {
                    this._handleJobSelectionChange(selectedIds);
                },
                onDataRequest: async () => {
                    await this.loadData();
                }
            });
            this._jobStatusTable.init();
        }
    }

    /**
     * Handle job action from JobStatusTable module
     * @private
     */
    async _handleJobAction(action, job) {
        switch (action) {
            case 'retry':
                await this.retryJob(job.id);
                break;
            case 'cancel':
                await this.cancelJob(job.id);
                break;
            case 'delete':
                await this.deleteJob(job.id);
                break;
            case 'start-now':
                await this.startJobNow(job.id);
                break;
            case 'reschedule':
                await this.rescheduleJob(job.id, job.newScheduledAt);
                break;
        }
    }

    /**
     * Handle job selection change from JobStatusTable module
     * @private
     */
    _handleJobSelectionChange(selectedIds) {
        // Bulk action butonlarını güncelle
        const bulkActionBar = document.getElementById('bulk-action-bar');
        if (bulkActionBar) {
            bulkActionBar.style.display = selectedIds.length > 0 ? 'flex' : 'none';
            const countSpan = bulkActionBar.querySelector('.selected-count');
            if (countSpan) {
                countSpan.textContent = selectedIds.length;
            }
        }
    }

    
    /**
     * Add bulk action buttons to DataTable toolbar
     */
    addBulkJobActions() {
        const toolbarActions = document.querySelector('#jobs-table [data-table-toolbar-actions]');
        if (!toolbarActions) return;

        // Bulk cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-bulk-cancel';
        cancelBtn.className = 'btn btn-sm btn-warning hidden';
        cancelBtn.innerHTML = `<i class="ti ti-x"></i> <span>${this.__('jobs.bulkCancel')}</span>`;
        cancelBtn.addEventListener('click', () => this.bulkCancelJobs());
        toolbarActions.appendChild(cancelBtn);

        // Bulk delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'btn-bulk-delete';
        deleteBtn.className = 'btn btn-sm btn-danger hidden';
        deleteBtn.innerHTML = `<i class="ti ti-trash"></i> <span>${this.__('jobs.bulkDelete')}</span>`;
        deleteBtn.addEventListener('click', () => this.confirmBulkDelete());
        toolbarActions.appendChild(deleteBtn);
    }

    /**
     * Confirm bulk delete
     */
    confirmBulkDelete() {
        const deletableJobs = this.selectedJobs.filter(j =>
            j.status === 'completed' || j.status === 'cancelled' || j.status === 'failed'
        );

        if (deletableJobs.length === 0) {
            Toast.warning(this.__('toast.noDeletableJobs'));
            return;
        }

        Modal.confirm({
            title: this.__('jobs.bulkDeleteTitle'),
            message: this.__('jobs.bulkDeleteConfirm', { count: deletableJobs.length }),
            type: 'danger',
            confirmText: this.__('jobs.bulkDelete'),
            onConfirm: async () => {
                const jobIds = deletableJobs.map(j => j.id);
                await this.bulkDeleteJobs(jobIds);
            }
        });
    }

    /**
     * Handle job selection change
     */
    onJobSelectionChange(selectedRows) {
        this.selectedJobs = selectedRows;
        const cancelBtn = document.getElementById('btn-bulk-cancel');
        const deleteBtn = document.getElementById('btn-bulk-delete');

        if (selectedRows.length > 0) {
            // Show cancel button if any selected job is pending/processing
            const hasCancellable = selectedRows.some(j => j.status === 'pending' || j.status === 'processing');
            if (cancelBtn) {
                cancelBtn.classList.toggle('hidden', !hasCancellable);
            }

            // Show delete button if any selected job is completed/cancelled/failed
            const hasDeletable = selectedRows.some(j => j.status === 'completed' || j.status === 'cancelled' || j.status === 'failed');
            if (deleteBtn) {
                deleteBtn.classList.toggle('hidden', !hasDeletable);
            }
        } else {
            cancelBtn?.classList.add('hidden');
            deleteBtn?.classList.add('hidden');
        }
    }

    /**
     * Bulk cancel selected jobs
     */
    async bulkCancelJobs() {
        const cancellable = this.selectedJobs.filter(j => j.status === 'pending' || j.status === 'processing');
        if (cancellable.length === 0) return;

        Modal.confirm({
            title: this.__('jobs.bulkCancelTitle'),
            message: this.__('jobs.bulkCancelConfirm', { count: cancellable.length }),
            type: 'warning',
            confirmText: this.__('jobs.cancel'),
            onConfirm: async () => {
                let successCount = 0;
                for (const job of cancellable) {
                    try {
                        const response = await this.app.api.post(`/render-queue/${job.id}/cancel`);
                        if (response.success) successCount++;
                    } catch (e) {
                        console.error('Failed to cancel job:', job.id, e);
                    }
                }
                Toast.success(this.__('jobs.bulkCancelSuccess', { count: successCount }));
                await this.loadData();
            }
        });
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.loadData();
        });

        // Auto-refresh toggle
        document.getElementById('auto-refresh-toggle')?.addEventListener('change', (e) => {
            this.autoRefreshEnabled = e.target.checked;
            if (this.autoRefreshEnabled) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        // Cleanup button
        document.getElementById('cleanup-btn')?.addEventListener('click', () => {
            this.showCleanupConfirm();
        });

        // Auto send button
        document.getElementById('auto-send-btn')?.addEventListener('click', () => {
            this.showAutoSendWizard();
        });

        // Trend tabs
        document.querySelectorAll('.trend-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.trend-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTrendView = e.target.dataset.view;
                this.renderTrends();
            });
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderJobsTable();
            });
        });

        // Job action buttons (event delegation for DataTable)
        document.getElementById('jobs-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (btn) {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action && id) {
                    this.handleJobAction(action, id);
                }
            }
        });
    }

    /**
     * Load all data
     */
    async loadData() {
        try {
            // Load analytics and jobs in parallel
            const [analyticsResponse, jobsResponse] = await Promise.all([
                this.app.api.get('/render-queue/analytics'),
                this.app.api.get('/render-queue')
            ]);

            if (analyticsResponse.success) {
                this.analytics = analyticsResponse.data;

                // Use QueueAnalytics module if available (Faz 2)
                if (this._queueAnalytics) {
                    this._queueAnalytics.render(this.analytics);
                } else {
                    // Fallback to legacy methods
                    this.renderAnalytics();
                }

                // İşlenmeye hazır iş varsa worker'ı otomatik başlat veya devam ettir
                const readyCount = this.analytics.queue_status?.ready_to_process || 0;
                if (readyCount > 0 && !this._isProcessing) {
                    if (this._workerRunning) {
                        // Worker zaten çalışıyorsa devam et
                        this.triggerProcessing();
                    } else if (this.autoRefreshEnabled) {
                        // Worker çalışmıyorsa ve auto-refresh açıksa otomatik başlat
                        this.startWorker();
                    }
                }
            }

            if (jobsResponse.success) {
                this.jobs = jobsResponse.data?.queues || [];

                // Seçimleri temizle
                this.selectedJobs = [];
                if (this.jobsTable) {
                    this.jobsTable.clearSelection();
                }

                this.renderJobsTable();
                this.updateFilterCounts();
            }

            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('queue-content').style.display = 'block';
            document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString('tr-TR');

        } catch (error) {
            console.error('Failed to load queue data:', error);
            Toast.error(this.__('toast.loadError'));
        }
    }

    /**
     * Bekleyen işleri işlemeye başla
     */
    async triggerProcessing() {
        // Zaten işleniyor mu kontrol et
        if (this._isProcessing || !this._workerRunning) return;
        this._isProcessing = true;

        // Sonsuz döngü koruması
        this._emptyProcessCount = this._emptyProcessCount || 0;
        this._stalledProcessingCount = this._stalledProcessingCount || 0;

        console.log('DEBUG triggerProcessing - Starting... (empty count:', this._emptyProcessCount, ')');

        try {
            // Her seferinde 1 iş işle (modal anlık güncelleme için)
            const response = await this.app.api.post('/render-queue/process', {
                max_jobs: 5
            });

            console.log('DEBUG triggerProcessing - Full Response:', JSON.stringify(response, null, 2));

            if (response.success) {
                const data = response.data || {};

                // Debug bilgilerini konsola yaz
                console.log('DEBUG - jobs_processed:', data.jobs_processed);
                console.log('DEBUG - devices_sent:', data.devices_sent);
                console.log('DEBUG - devices_failed:', data.devices_failed);
                console.log('DEBUG - devices_skipped:', data.devices_skipped);
                console.log('DEBUG - has_more:', data.has_more);
                console.log('DEBUG - pending_count:', data.pending_count);

                if (data.results && data.results.length > 0) {
                    console.log('DEBUG - Job Results:', JSON.stringify(data.results, null, 2));
                }

                if (data.debug) {
                    console.log('DEBUG - Server Debug Info:', JSON.stringify(data.debug, null, 2));

                    // Job processing detaylarını göster
                    if (data.debug.job_processing_details && data.debug.job_processing_details.length > 0) {
                        console.group('=== JOB PROCESSING DETAILS ===');
                        data.debug.job_processing_details.forEach((jobDebug, idx) => {
                            console.group(`Job #${idx + 1}: ${jobDebug.job_id}`);
                            console.log('Raw items count:', jobDebug.raw_items_count);
                            console.log('Pending items (after JOIN):', jobDebug.pending_items_count);
                            console.log('Item status counts:', jobDebug.item_status_counts);
                            console.log('Result:', jobDebug.result);
                            if (jobDebug.reason) {
                                console.warn('Reason:', jobDebug.reason);
                            }
                            if (jobDebug.raw_items && jobDebug.raw_items.length > 0) {
                                console.table(jobDebug.raw_items);
                            }
                            if (Object.keys(jobDebug.device_checks || {}).length > 0) {
                                console.log('Device checks:');
                                Object.entries(jobDebug.device_checks).forEach(([deviceId, check]) => {
                                    if (check.found) {
                                        console.log(`  ✓ ${deviceId}: Found - ${check.name} (${check.type})`);
                                    } else {
                                        console.error(`  ✗ ${deviceId}: NOT FOUND IN DEVICES TABLE!`);
                                    }
                                });
                            }
                            console.groupEnd();
                        });
                        console.groupEnd();
                    }
                }

                const processedDeviceOps = (data.devices_sent || 0) + (data.devices_failed || 0) + (data.devices_skipped || 0);

                // İstatistikleri güncelle
                this._workerProcessedJobs = (this._workerProcessedJobs || 0) + (data.jobs_processed || 0);
                this._workerProcessedDevices = (this._workerProcessedDevices || 0) + processedDeviceOps;

                // Progress hesapla
                const totalPending = this._workerTotalJobs || 1;
                const processed = this._workerProcessedJobs || 0;
                this._workerProgress = Math.min(100, Math.round((processed / totalPending) * 100));

                // UI güncelle - Use QueueAnalytics module if available (Faz 2)
                this._updateWorkerUI();

                // Sonsuz döngü koruması: İş işlendi ama cihaz gönderilmediyse
                if (data.jobs_processed > 0 && processedDeviceOps === 0) {
                    this._emptyProcessCount++;
                    this._stalledProcessingCount = 0;
                    console.warn('DEBUG - Jobs processed but no devices sent! Count:', this._emptyProcessCount);

                    // Debug bilgisinden sorunu tespit et
                    let issueFound = '';
                    if (data.debug?.job_processing_details?.length > 0) {
                        const detail = data.debug.job_processing_details[0];
                        if (detail.raw_items_count > 0 && detail.pending_items_count === 0) {
                            // Device JOIN failed
                            const failedDevices = Object.entries(detail.device_checks || {})
                                .filter(([, check]) => !check.found)
                                .map(([id]) => id);
                            if (failedDevices.length > 0) {
                                issueFound = `device_id eşleşmiyor: ${failedDevices.join(', ')}`;
                                console.error('CRITICAL: device_id in render_queue_items does not match devices.id!');
                                console.error('Failed device IDs:', failedDevices);
                            } else if (detail.item_status_counts?.pending === 0) {
                                issueFound = this.__('toast.allItemsProcessed');
                            }
                        } else if (detail.raw_items_count === 0) {
                            issueFound = this.__('toast.noQueueItems');
                        }
                    }

                    // 3 kez üst üste boş sonuç gelirse dur
                    if (this._emptyProcessCount >= 3) {
                        console.error('DEBUG - Stopping worker: Too many empty process cycles.');
                        const msg = issueFound
                            ? this.__('toast.processingIssue', { issue: issueFound })
                            : this.__('toast.processingStuck');
                        Toast.warning(msg);
                        this.stopWorker(true);
                        await this.loadData();
                        return;
                    }
                } else {
                    this._emptyProcessCount = 0;
                }

                // Stalled guard: backend "processing_count" var ama hiç iş ilerlemiyor.
                if ((data.jobs_processed || 0) === 0 && (data.pending_count || 0) === 0 && (data.processing_count || 0) > 0) {
                    this._stalledProcessingCount++;
                    if (this._stalledProcessingCount >= 12) { // ~12s
                        Toast.warning(this.__('toast.processingStuck'));
                        this.stopWorker(true);
                        await this.loadData();
                        return;
                    }
                } else {
                    this._stalledProcessingCount = 0;
                }

                // Hala bekleyen iş varsa devam et
                if (data.has_more && this._workerRunning) {
                    setTimeout(() => this.triggerProcessing(), 300); // 300ms bekle (hızlı işlem)
                } else if ((data.processing_count || 0) > 0 && this._workerRunning) {
                    // Başka işleyen job varsa modalı açık tut, tamamlanmayı bekle
                    setTimeout(() => this.triggerProcessing(), 1000);
                } else {
                    // İşlem tamamlandı
                    this._emptyProcessCount = 0;
                    this.stopWorker(true);
                    await this.loadData();
                }
            }
        } catch (error) {
            console.error('Process error:', error);
            Toast.error(this.__('toast.processError'));
            this._emptyProcessCount = 0;
            this._stalledProcessingCount = 0;
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * Worker'ı başlat
     */
    async startWorker() {
        if (this._workerRunning) return;

        const pendingCount = this.analytics.queue_status?.pending || 0;
        if (pendingCount === 0) {
            Toast.info(this.__('toast.noPendingJobs'));
            return;
        }

        // Worker durumunu ayarla
        this._workerRunning = true;
        this._workerProgress = 0;
        this._workerProcessedJobs = 0;
        this._workerProcessedDevices = 0;
        this._workerTotalJobs = pendingCount;
        this._stalledProcessingCount = 0;

        // UI güncelle - Use QueueAnalytics module if available (Faz 2)
        this._updateWorkerUI();
        Toast.success(this.__('toast.workerStarted'));

        // İşlemeye başla
        this.triggerProcessing();

        // Processing modal göster
        this.showProcessingModal();
    }

    /**
     * Worker'ı durdur
     */
    stopWorker(autoStop = false) {
        if (!this._workerRunning && !autoStop) return;

        this._workerRunning = false;
        this._isProcessing = false;

        // UI güncelle - Use QueueAnalytics module if available (Faz 2)
        this._updateWorkerUI();

        if (!autoStop) {
            Toast.info(this.__('toast.workerStopped'));
        } else {
            Toast.success(this.__('toast.processingComplete'));
        }

        // Modal'ı kapat
        this.closeProcessingModal();
    }

    /**
     * İşleme modal'ını göster
     */
    showProcessingModal() {
        // Mevcut bir modal varsa kapat
        this.closeProcessingModal();

        const content = `
            <div class="processing-modal-content">
                <div class="processing-animation">
                    <div class="processing-spinner"></div>
                </div>
                <h3 class="processing-title">${this.__('modal.processingTitle')}</h3>
                <p class="processing-desc">${this.__('modal.processingDesc')}</p>
                <div class="processing-stats" id="processing-modal-stats">
                    <div class="processing-stat">
                        <span class="processing-stat-value" id="modal-processed-jobs">0</span>
                        <span class="processing-stat-label">${this.__('worker.jobsProcessed')}</span>
                    </div>
                    <div class="processing-stat">
                        <span class="processing-stat-value" id="modal-processed-devices">0</span>
                        <span class="processing-stat-label">${this.__('worker.devicesProcessed')}</span>
                    </div>
                </div>
                <div class="processing-progress-bar">
                    <div class="processing-progress-fill" id="modal-progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `;

        this._processingModal = Modal.show({
            title: this.__('modal.processing'),
            icon: 'ti-loader',
            content: content,
            size: 'sm',
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false,
            showFooter: true,
            showConfirm: false,
            cancelText: this.__('worker.stop'),
            onClose: () => {
                this.stopWorker();
            }
        });

        // Modal stats update interval
        this._modalUpdateInterval = setInterval(() => {
            this.updateProcessingModal();
        }, 500);
    }

    /**
     * İşleme modal'ını güncelle
     */
    updateProcessingModal() {
        const jobsEl = document.getElementById('modal-processed-jobs');
        const devicesEl = document.getElementById('modal-processed-devices');
        const progressEl = document.getElementById('modal-progress-fill');

        if (jobsEl) jobsEl.textContent = this._workerProcessedJobs || 0;
        if (devicesEl) devicesEl.textContent = this._workerProcessedDevices || 0;
        if (progressEl) progressEl.style.width = (this._workerProgress || 0) + '%';
    }

    /**
     * İşleme modal'ını kapat
     */
    closeProcessingModal() {
        if (this._modalUpdateInterval) {
            clearInterval(this._modalUpdateInterval);
            this._modalUpdateInterval = null;
        }
        if (this._processingModal) {
            Modal.close(this._processingModal.id);
            this._processingModal = null;
        }
    }

    /**
     * Show auto send wizard - delegates to AutoSendWizard module
     */
    showAutoSendWizard() {
        if (this._autoSendWizard) {
            this._autoSendWizard.show();
        }
    }

    /**
     * Render jobs table - delegates to JobStatusTable module or legacy
     */
    renderJobsTable() {
        if (this._jobStatusTable) {
            this._jobStatusTable.setData(this.jobs);
            this._jobStatusTable.setFilter(this.currentFilter);
        } else if (this.dataTable) {
            // Legacy fallback
            const filteredJobs = this.currentFilter === 'all'
                ? this.jobs
                : this.jobs.filter(j => j.status === this.currentFilter);
            this.dataTable.setData(filteredJobs);
        }
    }

    /**
     * Render analytics - legacy fallback (delegates to QueueAnalytics if available)
     */
    renderAnalytics() {
        if (this._queueAnalytics && this.analytics) {
            this._queueAnalytics.render(this.analytics);
        }
    }

    /**
     * Render trends - delegates to QueueAnalytics module
     */
    renderTrends() {
        if (this._queueAnalytics) {
            this._queueAnalytics.renderTrends();
        }
    }

    /**
     * Render worker status - legacy fallback
     */
    renderWorkerStatus() {
        if (this._queueAnalytics) {
            this._queueAnalytics.renderWorkerStatus();
        }
    }

    /**
     * Initialize jobs table - legacy fallback
     */
    initJobsTable() {
        const container = document.getElementById('jobs-table');
        if (!container) return;

        this.dataTable = new DataTable({
            container,
            columns: [
                { key: 'id', label: this.__('jobs.id'), width: '100px' },
                { key: 'product_name', label: this.__('jobs.product') },
                { key: 'status', label: this.__('jobs.status'), width: '120px' },
                { key: 'priority', label: this.__('jobs.priority'), width: '100px' },
                { key: 'created_at', label: this.__('jobs.created'), width: '130px' }
            ],
            selectable: true,
            searchable: true,
            pagination: true,
            pageSize: 20,
            emptyText: this.__('jobs.noJobs'),
            onSelectionChange: (rows) => this.onJobSelectionChange(rows)
        });
    }

    /**
     * Update filter counts in UI
     */
    updateFilterCounts() {
        const counts = {
            all: this.jobs.length,
            pending: this.jobs.filter(j => j.status === 'pending').length,
            processing: this.jobs.filter(j => j.status === 'processing').length,
            completed: this.jobs.filter(j => j.status === 'completed').length,
            failed: this.jobs.filter(j => j.status === 'failed').length
        };

        Object.entries(counts).forEach(([filter, count]) => {
            const el = document.getElementById(`filter-count-${filter}`);
            if (el) el.textContent = count;
        });
    }

    /**
     * Show cleanup confirmation
     */
    showCleanupConfirm() {
        Modal.confirm({
            title: this.__('modal.cleanupTitle'),
            message: this.__('modal.cleanupMessage'),
            type: 'warning',
            confirmText: this.__('actions.cleanup'),
            onConfirm: async () => {
                await this.cleanupJobs();
            }
        });
    }

    /**
     * Cleanup completed/failed jobs
     */
    async cleanupJobs() {
        try {
            const response = await this.app.api.post('/render-queue/cleanup');
            if (response.success) {
                Toast.success(this.__('toast.cleanupSuccess'));
                await this.loadData();
            } else {
                Toast.error(response.message || this.__('toast.cleanupError'));
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
            Toast.error(this.__('toast.cleanupError'));
        }
    }

    /**
     * Handle job action from table
     */
    handleJobAction(action, jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        this._handleJobAction(action, job);
    }

    /**
     * Retry a failed job
     */
    async retryJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/retry`);
            if (response.success) {
                Toast.success(this.__('toast.retrySuccess'));
                await this.loadData();
            } else {
                Toast.error(this.__('toast.retryError'));
            }
        } catch (error) {
            console.error('Retry failed:', error);
            Toast.error(this.__('toast.retryError'));
        }
    }

    /**
     * Cancel a job
     */
    async cancelJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/cancel`);
            if (response.success) {
                Toast.success(this.__('toast.cancelSuccess'));
                await this.loadData();
            } else {
                Toast.error(this.__('toast.cancelError'));
            }
        } catch (error) {
            console.error('Cancel failed:', error);
            Toast.error(this.__('toast.cancelError'));
        }
    }

    /**
     * Delete a job
     */
    async deleteJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/delete`);
            if (response.success) {
                Toast.success(this.__('toast.deleteSuccess'));
                await this.loadData();
            } else {
                Toast.error(response.message || this.__('toast.deleteError'));
            }
        } catch (error) {
            console.error('Delete failed:', error);
            Toast.error(this.__('toast.deleteError'));
        }
    }

    /**
     * Start a scheduled job immediately
     */
    async startJobNow(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/reschedule`, {
                scheduled_at: null
            });
            if (response.success) {
                Toast.success(this.__('toast.startNowSuccess'));
                await this.loadData();
            } else {
                Toast.error(response.message || this.__('toast.startNowError'));
            }
        } catch (error) {
            console.error('Start now failed:', error);
            Toast.error(this.__('toast.startNowError'));
        }
    }

    /**
     * Reschedule a job
     */
    async rescheduleJob(jobId, newScheduledAt) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/reschedule`, {
                scheduled_at: newScheduledAt
            });
            if (response.success) {
                Toast.success(this.__('toast.rescheduleSuccess'));
                await this.loadData();
            } else {
                Toast.error(response.message || this.__('toast.rescheduleError'));
            }
        } catch (error) {
            console.error('Reschedule failed:', error);
            Toast.error(this.__('toast.rescheduleError'));
        }
    }

    /**
     * Bulk delete jobs
     */
    async bulkDeleteJobs(jobIds) {
        try {
            const response = await this.app.api.post('/render-queue/bulk-delete', {
                ids: jobIds
            });
            if (response.success) {
                const count = response.data?.deleted || 0;
                Toast.success(this.__('jobs.bulkDeleteSuccess', { count }));
                await this.loadData();
            } else {
                Toast.error(response.message || this.__('toast.deleteError'));
            }
        } catch (error) {
            console.error('Bulk delete failed:', error);
            Toast.error(this.__('toast.deleteError'));
        }
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => {
            if (this.autoRefreshEnabled) {
                this.loadData();
            }
        }, this.refreshRate);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Cleanup on page destroy
     */
    destroy() {
        this.stopAutoRefresh();
        this.stopWorker();

        if (this._queueAnalytics) {
            this._queueAnalytics.destroy();
            this._queueAnalytics = null;
        }
        if (this._autoSendWizard) {
            this._autoSendWizard.destroy();
            this._autoSendWizard = null;
        }
        if (this._jobStatusTable) {
            this._jobStatusTable.destroy();
            this._jobStatusTable = null;
        }
    }
}

export default QueueDashboardPage;
