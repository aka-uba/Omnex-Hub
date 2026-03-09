/**
 * JobStatusTable - İş Durumu Tablo Modülü
 *
 * QueueDashboard'dan ayrılmış bağımsız modül.
 * Render kuyruğu işlerinin tablo görünümü, filtreleme, bulk işlemler ve aksiyonları yönetir.
 *
 * @version 1.0.0
 * @example
 * import { init as initJobStatusTable } from './dashboard/JobStatusTable.js';
 *
 * const jobsTable = initJobStatusTable({
 *     container: document.getElementById('jobs-table-container'),
 *     app: this.app,
 *     onJobAction: (action, jobId) => { ... },
 *     onSelectionChange: (selectedJobs) => { ... },
 *     onDataRequest: () => this.loadData()
 * });
 *
 * jobsTable.setData(jobs);
 * jobsTable.setFilter('pending');
 */

import { DataTable } from '../../../components/DataTable.js';
import { Modal } from '../../../components/Modal.js';
import { Toast } from '../../../components/Toast.js';
import * as QueueMetrics from './QueueMetrics.js';

/**
 * JobStatusTable init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Function} params.onJobAction - Job aksiyonu callback (view, retry, cancel, delete, start-now, reschedule)
 * @param {Function} params.onSelectionChange - Seçim değişikliği callback
 * @param {Function} params.onDataRequest - Veri yenileme isteği callback
 * @returns {JobStatusTable} JobStatusTable instance
 */
export function init({ container, app, onJobAction, onSelectionChange, onDataRequest }) {
    if (!container) {
        throw new Error('JobStatusTable: container parametresi zorunludur');
    }
    return new JobStatusTable({ container, app, onJobAction, onSelectionChange, onDataRequest });
}

class JobStatusTable {
    constructor({ container, app, onJobAction, onSelectionChange, onDataRequest }) {
        this.container = container;
        this.app = app;
        this.onJobAction = onJobAction;
        this.onSelectionChange = onSelectionChange;
        this.onDataRequest = onDataRequest;

        // State
        this._jobs = [];
        this._selectedJobs = [];
        this._currentFilter = 'all';
        this._dataTable = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Tabloyu başlat
     */
    init() {
        this._initDataTable();
        this._bindEvents();
    }

    /**
     * DataTable'ı başlat
     * @private
     */
    _initDataTable() {
        this._dataTable = new DataTable({
            container: this.container,
            columns: this._getColumns(),
            selectable: true,
            searchable: true,
            pagination: true,
            pageSize: 20,
            pageSizes: [10, 20, 50, 100],
            emptyText: this.__('jobs.noJobs'),
            onSelectionChange: (rows) => this._handleSelectionChange(rows),
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            exportFilename: 'render-queue',
            exportTitle: this.__('jobs.title')
        });

        // Add bulk actions after DataTable renders
        setTimeout(() => {
            this._addBulkActions();
        }, 100);
    }

    /**
     * Tablo kolonlarını döndür
     * @private
     */
    _getColumns() {
        return [
            {
                key: 'id',
                label: this.__('jobs.id'),
                width: '100px',
                render: (value, row) => {
                    if (row._isBatchRow) {
                        return `<span class="batch-id-badge" title="${this.__('batch.title')}"><i class="ti ti-stack-2"></i> ${this.__('batch.label')}</span>`;
                    }
                    return `<code class="job-id-code">${value?.substring(0, 8) || '-'}</code>`;
                }
            },
            {
                key: 'product_name',
                label: this.__('jobs.product'),
                render: (value, row) => {
                    if (row._isBatchRow) {
                        return `<span class="text-medium batch-product-label"><i class="ti ti-packages"></i> ${row._productCount} ${this.__('batch.products')}</span>`;
                    }
                    const name = value || row.product?.name || '-';
                    return `<span class="text-medium">${name}</span>`;
                }
            },
            {
                key: 'devices',
                label: this.__('jobs.devices'),
                width: '100px',
                sortable: false,
                render: (_, row) => `${row.completed_devices || 0} / ${row.total_devices || 0}`
            },
            {
                key: 'progress',
                label: this.__('jobs.progress'),
                width: '140px',
                sortable: false,
                render: (_, row) => {
                    const progress = row.total_devices > 0
                        ? Math.round((row.completed_devices / row.total_devices) * 100)
                        : 0;
                    return `
                        <div class="job-progress">
                            <div class="job-progress-bar">
                                <div class="job-progress-fill ${row.status}" style="width: ${progress}%"></div>
                            </div>
                            <span class="job-progress-text">${progress}%</span>
                        </div>
                    `;
                }
            },
            {
                key: 'status',
                label: this.__('jobs.status'),
                width: '120px',
                render: (value) => this._renderStatusBadge(value)
            },
            {
                key: 'priority',
                label: this.__('jobs.priority'),
                width: '100px',
                render: (value) => `<span class="priority-badge ${value}">${this.__(`priority.${value}`)}</span>`
            },
            {
                key: 'scheduled_at',
                label: this.__('jobs.scheduled'),
                width: '150px',
                render: (value) => value
                    ? this._formatScheduledTime(value)
                    : `<span class="scheduled-badge now"><i class="ti ti-bolt"></i> ${this.__('jobs.immediate')}</span>`
            },
            {
                key: 'created_at',
                label: this.__('jobs.created'),
                width: '130px',
                render: (value) => this._formatTime(value)
            },
            {
                key: 'actions',
                label: this.__('jobs.actions'),
                width: '140px',
                sortable: false,
                render: (_, row) => this._renderJobActions(row)
            }
        ];
    }

    /**
     * Event listener'ları bağla
     * @private
     */
    _bindEvents() {
        // Job action buttons (event delegation)
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (btn) {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action && id) {
                    this._handleJobAction(action, id);
                }
            }
        });
    }

    /**
     * Bulk aksiyon butonlarını ekle
     * @private
     */
    _addBulkActions() {
        const toolbarActions = this.container.querySelector('[data-table-toolbar-actions]');
        if (!toolbarActions) return;

        // Bulk cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-bulk-cancel';
        cancelBtn.className = 'btn btn-sm btn-warning hidden';
        cancelBtn.innerHTML = `<i class="ti ti-x"></i> <span>${this.__('jobs.bulkCancel')}</span>`;
        cancelBtn.addEventListener('click', () => this._confirmBulkCancel());
        toolbarActions.appendChild(cancelBtn);

        // Bulk delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'btn-bulk-delete';
        deleteBtn.className = 'btn btn-sm btn-danger hidden';
        deleteBtn.innerHTML = `<i class="ti ti-trash"></i> <span>${this.__('jobs.bulkDelete')}</span>`;
        deleteBtn.addEventListener('click', () => this._confirmBulkDelete());
        toolbarActions.appendChild(deleteBtn);
    }

    /**
     * İş verilerini ayarla
     * @param {Array} jobs - İş listesi
     */
    setData(jobs) {
        this._jobs = jobs || [];
        this._render();
    }

    /**
     * Filtreyi ayarla
     * @param {string} filter - Filtre değeri (all, pending, processing, completed, failed)
     */
    setFilter(filter) {
        this._currentFilter = filter;
        this._render();
    }

    /**
     * Mevcut filtreyi al
     */
    getFilter() {
        return this._currentFilter;
    }

    /**
     * Seçimleri temizle
     */
    clearSelection() {
        this._selectedJobs = [];
        if (this._dataTable) {
            this._dataTable.clearSelection();
        }
    }

    /**
     * Filtre sayılarını hesapla
     */
    getFilterCounts() {
        return {
            all: this._jobs.length,
            pending: this._jobs.filter(j => j.status === 'pending').length,
            processing: this._jobs.filter(j => j.status === 'processing').length,
            completed: this._jobs.filter(j => j.status === 'completed').length,
            failed: this._jobs.filter(j => j.status === 'failed').length
        };
    }

    /**
     * Open detail modal from deep-link query (job or batch)
     * @param {{job?: string, batch?: string}} query
     * @returns {boolean}
     */
    openLinkedDetail(query = {}) {
        const jobId = query.job ? String(query.job).trim() : '';
        const batchId = query.batch ? String(query.batch).trim() : '';

        if (jobId) {
            this._showJobDetails(jobId);
            return true;
        }

        if (batchId) {
            const batchJobs = (this._jobs || []).filter(job => String(job.batch_id || '') === batchId);
            if (batchJobs.length <= 1) {
                const single = batchJobs[0];
                if (single?.id) {
                    this._showJobDetails(single.id);
                    return true;
                }
            }
            this._showBatchDetails(batchId);
            return true;
        }

        return false;
    }

    /**
     * Tabloyu render et
     * @private
     */
    _render() {
        if (!this._dataTable) return;

        // Filter jobs
        let filteredJobs = this._jobs;
        if (this._currentFilter !== 'all') {
            filteredJobs = this._jobs.filter(j => j.status === this._currentFilter);
        }

        // Group jobs by batch_id
        const displayRows = this._groupByBatch(filteredJobs);

        // Update DataTable with grouped data - preservePage: true ile mevcut sayfayı koru
        this._dataTable.setData(displayRows, { preservePage: true });
    }

    /**
     * Batch ID'ye göre işleri grupla
     * Aynı batch_id'ye sahip işler tek bir özet satırda gösterilir.
     * batch_id olmayan işler bireysel satır olarak kalır.
     * @private
     */
    _groupByBatch(jobs) {
        const batches = {};
        const standalone = [];

        for (const job of jobs) {
            if (job.batch_id) {
                if (!batches[job.batch_id]) {
                    batches[job.batch_id] = [];
                }
                batches[job.batch_id].push(job);
            } else {
                standalone.push(job);
            }
        }

        const result = [];

        // Batch grupları için özet satır oluştur
        for (const [batchId, batchJobs] of Object.entries(batches)) {
            if (batchJobs.length === 1) {
                // Tek iş varsa bireysel göster
                standalone.push(batchJobs[0]);
                continue;
            }

            // Aggregate row
            const totalDevices = batchJobs.reduce((s, j) => s + (j.total_devices || 0), 0);
            const completedDevices = batchJobs.reduce((s, j) => s + (j.completed_devices || 0), 0);
            const failedDevices = batchJobs.reduce((s, j) => s + (j.failed_devices || 0), 0);

            // Batch durumunu belirle
            const statuses = batchJobs.map(j => j.status);
            let batchStatus = 'completed';
            if (statuses.includes('processing')) batchStatus = 'processing';
            else if (statuses.includes('pending')) batchStatus = 'pending';
            else if (statuses.every(s => s === 'failed')) batchStatus = 'failed';
            else if (statuses.every(s => s === 'cancelled')) batchStatus = 'cancelled';
            else if (statuses.includes('failed')) batchStatus = 'completed'; // kısmi başarı

            const productNames = batchJobs
                .map(j => j.product_name || j.product?.name || '')
                .filter(Boolean);

            result.push({
                id: batchId,
                batch_id: batchId,
                _isBatchRow: true,
                _batchJobs: batchJobs,
                _productCount: batchJobs.length,
                product_name: productNames.length > 0
                    ? `${productNames[0]} (+${batchJobs.length - 1})`
                    : `${batchJobs.length} ${this.__('batch.products')}`,
                total_devices: totalDevices,
                completed_devices: completedDevices,
                failed_devices: failedDevices,
                status: batchStatus,
                priority: batchJobs[0].priority,
                scheduled_at: batchJobs[0].scheduled_at,
                created_at: batchJobs[0].created_at
            });
        }

        // Standalone işleri ekle ve tarihe göre sırala
        result.push(...standalone);
        result.sort((a, b) => {
            const dateA = a.created_at || '';
            const dateB = b.created_at || '';
            return dateB.localeCompare(dateA);
        });

        return result;
    }

    /**
     * Seçim değişikliğini işle
     * @private
     */
    _handleSelectionChange(selectedRows) {
        this._selectedJobs = selectedRows;
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

        // Notify parent
        if (this.onSelectionChange) {
            this.onSelectionChange(selectedRows);
        }
    }

    /**
     * Job aksiyonunu işle
     * @private
     */
    _handleJobAction(action, jobId) {
        switch (action) {
            case 'view':
                this._showJobDetails(jobId);
                break;
            case 'view-batch':
                this._showBatchDetails(jobId);
                break;
            case 'retry-batch':
                this._confirmBatchRetry(jobId);
                break;
            case 'retry':
                this._confirmRetry(jobId);
                break;
            case 'cancel':
                this._confirmCancel(jobId);
                break;
            case 'delete':
                this._confirmDelete(jobId);
                break;
            case 'start-now':
                this._confirmStartNow(jobId);
                break;
            case 'reschedule':
                this._showRescheduleModal(jobId);
                break;
            default:
                // Notify parent for custom actions
                if (this.onJobAction) {
                    this.onJobAction(action, jobId);
                }
        }
    }

    /**
     * Status badge render et
     * @private
     */
    _renderStatusBadge(status) {
        const icons = {
            pending: 'ti-clock',
            processing: 'ti-loader',
            completed: 'ti-check',
            failed: 'ti-x',
            cancelled: 'ti-ban'
        };

        return `
            <span class="job-status-badge ${status}">
                <i class="ti ${icons[status] || 'ti-help'}"></i>
                ${this.__(`status.${status}`)}
            </span>
        `;
    }
    /**
     * Job retry uygunlugu
     * @private
     */
    _isJobRetryable(job) {
        const failedDeviceCount = Number(job?.failed_devices ?? job?.devices_failed ?? 0);
        return job?.status === 'failed' || (job?.status === 'completed' && failedDeviceCount > 0);
    }

    /**
     * Job aksiyon butonlarını render et
     * @private
     */
    _renderJobActions(job) {
        // Batch row: show expand button to view individual jobs
        if (job._isBatchRow) {
            const hasRetryableBatchJobs = (job._batchJobs || []).some(j => this._isJobRetryable(j));
            return `<div class="queue-actions-cell">
                <button class="queue-action-btn view" data-action="view-batch" data-id="${job.id}" title="${this.__('batch.viewJobs')}">
                    <i class="ti ti-list-details"></i>
                </button>
                ${hasRetryableBatchJobs ? `
                    <button class="queue-action-btn retry" data-action="retry-batch" data-id="${job.id}" title="${this.__('jobs.retry')}">
                        <i class="ti ti-refresh"></i>
                    </button>
                ` : ''}
            </div>`;
        }

        const isScheduled = job.scheduled_at && new Date(job.scheduled_at) > new Date();
        let actions = '';

        // View button - always visible
        actions += `
            <button class="queue-action-btn view" data-action="view" data-id="${job.id}" title="${this.__('jobs.viewDetails')}">
                <i class="ti ti-eye"></i>
            </button>
        `;

        // Scheduled job actions
        if (isScheduled && job.status === 'pending') {
            actions += `
                <button class="queue-action-btn start-now" data-action="start-now" data-id="${job.id}" title="${this.__('jobs.startNow')}">
                    <i class="ti ti-player-play"></i>
                </button>
                <button class="queue-action-btn reschedule" data-action="reschedule" data-id="${job.id}" title="${this.__('jobs.reschedule')}">
                    <i class="ti ti-calendar-event"></i>
                </button>
            `;
        }

        // Retry for failed or partially failed jobs
        if (this._isJobRetryable(job)) {
            actions += `
                <button class="queue-action-btn retry" data-action="retry" data-id="${job.id}" title="${this.__('jobs.retry')}">
                    <i class="ti ti-refresh"></i>
                </button>
            `;
        }

        // Cancel for pending/processing
        if (job.status === 'pending' || job.status === 'processing') {
            actions += `
                <button class="queue-action-btn cancel" data-action="cancel" data-id="${job.id}" title="${this.__('jobs.cancel')}">
                    <i class="ti ti-x"></i>
                </button>
            `;
        }

        // Delete for completed/cancelled/failed
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
            actions += `
                <button class="queue-action-btn delete" data-action="delete" data-id="${job.id}" title="${this.__('jobs.delete')}">
                    <i class="ti ti-trash"></i>
                </button>
            `;
        }

        return `<div class="queue-actions-cell">${actions}</div>`;
    }

    /**
     * Zamanlanmış zamanı formatla
     * @private
     */
    _formatScheduledTime(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();

            if (isToday) {
                return `<span class="scheduled-badge today"><i class="ti ti-clock"></i> ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>`;
            }

            return `<span class="scheduled-badge"><i class="ti ti-calendar"></i> ${date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>`;
        } catch {
            return dateStr;
        }
    }

    /**
     * Zamanı formatla
     * @private
     * @deprecated QueueMetrics.formatTime() kullanılır
     */
    _formatTime(dateStr) {
        return QueueMetrics.formatTime(dateStr);
    }

    // ==================== Job Actions ====================

    /**
     * İş detaylarını göster
     * @private
     */
    async _showJobDetails(jobId) {
        try {
            const response = await this.app.api.get(`/render-queue/${jobId}/status`);
            if (!response.success) {
                Toast.error(this.__('toast.loadError'));
                return;
            }

            const job = response.data;
            const items = job.items || [];

            const content = `
                <div class="job-detail-grid">
                    <div class="job-detail-item">
                        <div class="job-detail-label">${this.__('jobs.id')}</div>
                        <div class="job-detail-value"><code>${job.id}</code></div>
                    </div>
                    <div class="job-detail-item">
                        <div class="job-detail-label">${this.__('jobs.status')}</div>
                        <div class="job-detail-value">${this._renderStatusBadge(job.status)}</div>
                    </div>
                    <div class="job-detail-item">
                        <div class="job-detail-label">${this.__('jobs.priority')}</div>
                        <div class="job-detail-value">
                            <span class="priority-badge ${job.priority}">${this.__(`priority.${job.priority}`)}</span>
                            <span class="priority-desc">${this.__(`wizard.priority.${job.priority}Desc`)}</span>
                        </div>
                    </div>
                    <div class="job-detail-item">
                        <div class="job-detail-label">${this.__('jobs.progress')}</div>
                        <div class="job-detail-value">${job.completed_devices || 0} / ${job.total_devices || 0} (${job.progress_percent || 0}%)</div>
                    </div>
                    <div class="job-detail-item">
                        <div class="job-detail-label">${this.__('jobs.created')}</div>
                        <div class="job-detail-value">${this._formatTime(job.created_at)}</div>
                    </div>
                    ${job.completed_at ? `
                        <div class="job-detail-item">
                            <div class="job-detail-label">${this.__('worker.lastCompleted')}</div>
                            <div class="job-detail-value">${this._formatTime(job.completed_at)}</div>
                        </div>
                    ` : ''}
                </div>
                <h4 style="margin: 1rem 0 0.5rem;">${this.__('modal.deviceProgress')}</h4>
                <div class="device-progress-list">
                    ${items.map(item => `
                        <div class="device-progress-item">
                            <div class="device-progress-icon ${item.status}">
                                <i class="ti ${item.status === 'completed' ? 'ti-check' : item.status === 'failed' ? 'ti-x' : 'ti-clock'}"></i>
                            </div>
                            <div class="device-progress-info">
                                <div class="device-progress-name">${item.device_id?.substring(0, 8) || 'Cihaz'}</div>
                                <div class="device-progress-status">${this.__(`status.${item.status}`)}</div>
                                ${item.last_error ? `<div class="device-progress-error">${item.last_error}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            Modal.show({
                title: this.__('modal.jobDetails'),
                icon: 'ti-list-details',
                content: content,
                size: 'lg',
                showFooter: false
            });

        } catch (error) {
            console.error('Failed to load job details:', error);
            Toast.error(this.__('toast.loadError'));
        }
    }

    /**
     * Batch detaylarını göster
     * @private
     */
    _showBatchDetails(batchId) {
        // _groupByBatch sonucu üzerinden batch row'u bul
        const displayRows = this._groupByBatch(this._jobs);
        const batchRow = displayRows.find(r => r._isBatchRow && r.id === batchId);
        if (!batchRow || !batchRow._batchJobs) {
            Toast.error(this.__('toast.loadError'));
            return;
        }

        const jobs = batchRow._batchJobs;
        const content = `
            <div class="batch-detail-summary">
                <div class="batch-detail-stat">
                    <span class="batch-detail-stat-label">${this.__('batch.totalProducts')}</span>
                    <span class="batch-detail-stat-value">${jobs.length}</span>
                </div>
                <div class="batch-detail-stat">
                    <span class="batch-detail-stat-label">${this.__('jobs.devices')}</span>
                    <span class="batch-detail-stat-value">${batchRow.completed_devices} / ${batchRow.total_devices}</span>
                </div>
                <div class="batch-detail-stat">
                    <span class="batch-detail-stat-label">${this.__('jobs.status')}</span>
                    <span class="batch-detail-stat-value">${this._renderStatusBadge(batchRow.status)}</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem;">${this.__('batch.jobList')}</h4>
            <div class="batch-jobs-list">
                ${jobs.map(job => `
                    <div class="batch-job-item">
                        <div class="batch-job-info">
                            <span class="batch-job-name">${job.product_name || job.product?.name || '-'}</span>
                            <span class="batch-job-devices">${job.completed_devices || 0} / ${job.total_devices || 0}</span>
                        </div>
                        <div class="batch-job-status">
                            ${this._renderStatusBadge(job.status)}
                        </div>
                        <div class="batch-job-actions">
                            <button class="queue-action-btn view" data-action="view" data-id="${job.id}" title="${this.__('jobs.viewDetails')}">
                                <i class="ti ti-eye"></i>
                            </button>
                            ${this._isJobRetryable(job) ? `
                                <button class="queue-action-btn retry" data-action="retry" data-id="${job.id}" title="${this.__('jobs.retry')}">
                                    <i class="ti ti-refresh"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const modal = Modal.show({
            title: this.__('batch.detailTitle'),
            icon: 'ti-stack-2',
            content: content,
            size: 'lg',
            showFooter: false
        });

        // Bind view actions inside modal
        const modalEl = document.getElementById(modal.id);
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="view"]');
                if (btn) {
                    Modal.close(modal.id);
                    this._showJobDetails(btn.dataset.id);
                    return;
                }

                const retryBtn = e.target.closest('[data-action="retry"]');
                if (retryBtn) {
                    this._confirmRetry(retryBtn.dataset.id);
                }
            });
        }
    }

    /**
     * Tekrar deneme onayı
     * @private
     */
    _confirmBatchRetry(batchId) {
        const displayRows = this._groupByBatch(this._jobs);
        const batchRow = displayRows.find(r => r._isBatchRow && r.id === batchId);
        const retryableCount = (batchRow?._batchJobs || []).filter(job => this._isJobRetryable(job)).length;

        if (retryableCount === 0) {
            Toast.warning(this.__('toast.retryError'));
            return;
        }

        Modal.confirm({
            title: this.__('modal.confirmRetry'),
            message: `${retryableCount} job icin retry uygulanacak.`,
            type: 'warning',
            confirmText: this.__('jobs.retry'),
            onConfirm: async () => {
                await this._retryBatch(batchId);
            }
        });
    }

    async _retryBatch(batchId) {
        try {
            const response = await this.app.api.post(`/render-queue/batch/${batchId}/retry`);
            if (response.success) {
                Toast.success(this.__('toast.retrySuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(response.message || this.__('toast.retryError'));
            }
        } catch (error) {
            console.error('Failed to retry batch:', error);
            Toast.error(this.__('toast.retryError'));
        }
    }

    _confirmRetry(jobId) {
        Modal.confirm({
            title: this.__('modal.confirmRetry'),
            message: this.__('modal.confirmRetryMsg'),
            type: 'warning',
            confirmText: this.__('jobs.retry'),
            onConfirm: async () => {
                await this._retryJob(jobId);
            }
        });
    }

    /**
     * İşi tekrar dene
     * @private
     */
    async _retryJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/retry`);
            if (response.success) {
                Toast.success(this.__('toast.retrySuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(this.__('toast.retryError'));
            }
        } catch (error) {
            console.error('Failed to retry job:', error);
            Toast.error(this.__('toast.retryError'));
        }
    }

    /**
     * İptal onayı
     * @private
     */
    _confirmCancel(jobId) {
        Modal.confirm({
            title: this.__('modal.confirmCancel'),
            message: this.__('modal.confirmCancelMsg'),
            type: 'warning',
            confirmText: this.__('jobs.cancel'),
            onConfirm: async () => {
                await this._cancelJob(jobId);
            }
        });
    }

    /**
     * İşi iptal et
     * @private
     */
    async _cancelJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/cancel`);
            if (response.success) {
                Toast.success(this.__('toast.cancelSuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(this.__('toast.cancelError'));
            }
        } catch (error) {
            console.error('Failed to cancel job:', error);
            Toast.error(this.__('toast.cancelError'));
        }
    }

    /**
     * Silme onayı
     * @private
     */
    _confirmDelete(jobId) {
        Modal.confirm({
            title: this.__('modal.confirmDelete'),
            message: this.__('modal.confirmDeleteMsg'),
            type: 'danger',
            confirmText: this.__('jobs.delete'),
            onConfirm: async () => {
                await this._deleteJob(jobId);
            }
        });
    }

    /**
     * İşi sil
     * @private
     */
    async _deleteJob(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/delete`);
            if (response.success) {
                Toast.success(this.__('toast.deleteSuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(response.message || this.__('toast.deleteError'));
            }
        } catch (error) {
            console.error('Failed to delete job:', error);
            Toast.error(this.__('toast.deleteError'));
        }
    }

    /**
     * Hemen başlat onayı
     * @private
     */
    _confirmStartNow(jobId) {
        Modal.confirm({
            title: this.__('modal.confirmStartNow'),
            message: this.__('modal.confirmStartNowMsg'),
            type: 'info',
            confirmText: this.__('jobs.startNow'),
            onConfirm: async () => {
                await this._startJobNow(jobId);
            }
        });
    }

    /**
     * İşi hemen başlat
     * @private
     */
    async _startJobNow(jobId) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/reschedule`, {
                scheduled_at: null // null = hemen
            });
            if (response.success) {
                Toast.success(this.__('toast.startNowSuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(response.message || this.__('toast.startNowError'));
            }
        } catch (error) {
            console.error('Failed to start job now:', error);
            Toast.error(this.__('toast.startNowError'));
        }
    }

    /**
     * Yeniden zamanlama modalını göster
     * @private
     */
    _showRescheduleModal(jobId) {
        const now = new Date();
        const defaultDate = now.toISOString().split('T')[0];
        const defaultTime = now.toTimeString().substring(0, 5);

        const content = `
            <div class="reschedule-form">
                <div class="form-group">
                    <label class="form-label">${this.__('jobs.newSchedule')}</label>
                    <div class="reschedule-datetime">
                        <input type="date" id="reschedule-date" class="form-input" value="${defaultDate}" min="${defaultDate}">
                        <input type="time" id="reschedule-time" class="form-input" value="${defaultTime}">
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            id: 'reschedule-modal',
            title: this.__('jobs.reschedule'),
            icon: 'ti-calendar-event',
            content: content,
            confirmText: this.__('actions.save'),
            onConfirm: async () => {
                const date = document.getElementById('reschedule-date').value;
                const time = document.getElementById('reschedule-time').value;

                if (!date || !time) {
                    Toast.warning(this.__('jobs.rescheduleRequired'));
                    throw new Error('Validation failed');
                }

                const scheduledAt = `${date}T${time}:00`;
                await this._rescheduleJob(jobId, scheduledAt);
            }
        });
    }

    /**
     * İşi yeniden zamanla
     * @private
     */
    async _rescheduleJob(jobId, scheduledAt) {
        try {
            const response = await this.app.api.post(`/render-queue/${jobId}/reschedule`, {
                scheduled_at: scheduledAt
            });
            if (response.success) {
                Toast.success(this.__('toast.rescheduleSuccess'));
                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(response.message || this.__('toast.rescheduleError'));
            }
        } catch (error) {
            console.error('Failed to reschedule job:', error);
            Toast.error(this.__('toast.rescheduleError'));
        }
    }

    // ==================== Bulk Actions ====================

    /**
     * Toplu iptal onayı
     * @private
     */
    _confirmBulkCancel() {
        const cancellable = this._selectedJobs.filter(j => j.status === 'pending' || j.status === 'processing');
        if (cancellable.length === 0) return;

        Modal.confirm({
            title: this.__('jobs.bulkCancelTitle'),
            message: this.__('jobs.bulkCancelConfirm', { count: cancellable.length }),
            type: 'warning',
            confirmText: this.__('jobs.cancel'),
            onConfirm: async () => {
                await this._bulkCancelJobs(cancellable);
            }
        });
    }

    /**
     * Toplu iptal
     * @private
     */
    async _bulkCancelJobs(jobs) {
        let successCount = 0;
        for (const job of jobs) {
            try {
                const response = await this.app.api.post(`/render-queue/${job.id}/cancel`);
                if (response.success) successCount++;
            } catch (e) {
                console.error('Failed to cancel job:', job.id, e);
            }
        }
        Toast.success(this.__('jobs.bulkCancelSuccess', { count: successCount }));
        if (this.onDataRequest) this.onDataRequest();
    }

    /**
     * Toplu silme onayı
     * @private
     */
    _confirmBulkDelete() {
        const deletable = this._selectedJobs.filter(j =>
            j.status === 'completed' || j.status === 'cancelled' || j.status === 'failed'
        );

        if (deletable.length === 0) {
            Toast.warning(this.__('toast.noDeletableJobs'));
            return;
        }

        Modal.confirm({
            title: this.__('jobs.bulkDeleteTitle'),
            message: this.__('jobs.bulkDeleteConfirm', { count: deletable.length }),
            type: 'danger',
            confirmText: this.__('jobs.bulkDelete'),
            onConfirm: async () => {
                await this._bulkDeleteJobs(deletable);
            }
        });
    }

    /**
     * Toplu silme
     * @private
     */
    async _bulkDeleteJobs(jobs) {
        try {
            const jobIds = jobs.map(j => j.id);
            const response = await this.app.api.post('/render-queue/bulk-delete', {
                ids: jobIds
            });
            if (response.success) {
                const count = response.data?.deleted || 0;
                const errors = response.data?.errors || [];

                if (count > 0) {
                    Toast.success(this.__('jobs.bulkDeleteSuccess', { count }));
                }

                if (errors.length > 0) {
                    Toast.warning(this.__('toast.bulkDeletePartialError', { count: errors.length }));
                }

                if (this.onDataRequest) this.onDataRequest();
            } else {
                Toast.error(response.message || this.__('toast.deleteError'));
            }
        } catch (error) {
            console.error('Failed to bulk delete jobs:', error);
            Toast.error(this.__('toast.deleteError'));
        }
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        this._jobs = [];
        this._selectedJobs = [];
        this._dataTable = null;
    }
}

export { JobStatusTable };

