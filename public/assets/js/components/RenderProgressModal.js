/**
 * Render Progress Modal Component
 * Real-time progress tracking for multi-device render operations
 *
 * @version 1.0.0
 */

import { Modal } from './Modal.js';
import { Toast } from './Toast.js';

export class RenderProgressModal {
    constructor(app) {
        this.app = app;
        this.modalId = null;
        this.queueId = null;
        this.pollingInterval = null;
        this.pollingRate = 2000; // 2 seconds
        this.isActive = false;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app?.i18n?.t(key, params) || key;
    }

    /**
     * Start tracking a render queue job
     * @param {string} queueId - The queue job ID to track
     * @param {Object} options - Configuration options
     */
    async start(queueId, options = {}) {
        this.queueId = queueId;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        this.isActive = true;

        // Show modal
        this.showModal(options);

        // Start polling
        await this.updateProgress();
        this.startPolling();
    }

    /**
     * Show the progress modal
     */
    showModal(options = {}) {
        const title = options.title || this.__('render.title');

        const content = `
            <div class="render-progress-container">
                <div class="render-progress-header">
                    <div class="render-progress-status" id="rp-status">
                        <div class="render-progress-spinner">
                            <div class="spinner"></div>
                        </div>
                        <span class="render-progress-status-text" id="rp-status-text">${this.__('render.modal.starting')}</span>
                    </div>
                </div>

                <div class="render-progress-main">
                    <div class="render-progress-bar-container">
                        <div class="render-progress-bar" id="rp-bar" style="width: 0%"></div>
                    </div>
                    <div class="render-progress-percent" id="rp-percent">0%</div>
                </div>

                <div class="render-progress-stats">
                    <div class="render-progress-stat">
                        <span class="render-progress-stat-label">${this.__('render.modal.totalDevices')}</span>
                        <span class="render-progress-stat-value" id="rp-total">0</span>
                    </div>
                    <div class="render-progress-stat">
                        <span class="render-progress-stat-label">${this.__('render.modal.completedDevices')}</span>
                        <span class="render-progress-stat-value text-success" id="rp-completed">0</span>
                    </div>
                    <div class="render-progress-stat">
                        <span class="render-progress-stat-label">${this.__('render.modal.failedDevices')}</span>
                        <span class="render-progress-stat-value text-danger" id="rp-failed">0</span>
                    </div>
                    <div class="render-progress-stat">
                        <span class="render-progress-stat-label">${this.__('render.modal.pendingDevices')}</span>
                        <span class="render-progress-stat-value" id="rp-pending">0</span>
                    </div>
                </div>

                <div class="render-progress-devices" id="rp-devices">
                    <!-- Device progress items will be rendered here -->
                </div>

                <div class="render-progress-errors" id="rp-errors" style="display: none;">
                    <div class="render-progress-errors-header">
                        <i class="ti ti-alert-triangle"></i>
                        <span>${this.__('render.modal.errors')}</span>
                    </div>
                    <div class="render-progress-errors-list" id="rp-errors-list">
                        <!-- Error items will be rendered here -->
                    </div>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: title,
            icon: 'ti-send',
            content: content,
            size: 'md',
            closable: false, // Prevent accidental close during operation
            closeOnEscape: false,
            closeOnBackdrop: false,
            showFooter: true,
            showConfirm: false,
            showCancel: true,
            cancelText: this.__('actions.cancel'),
            onClose: () => {
                this.stop();
            }
        });

        this.modalId = modal.id;
    }

    /**
     * Update progress from API
     */
    async updateProgress() {
        if (!this.isActive || !this.queueId) return;

        try {
            const response = await this.app.api.get(`/render-queue/${this.queueId}/status`);

            if (!response.success) {
                console.error('Failed to get queue status');
                return;
            }

            const data = response.data;
            this.renderProgress(data);

            // Check if completed or failed
            if (data.status === 'completed') {
                this.handleComplete(data);
            } else if (data.status === 'failed' && data.failed_devices >= data.total_devices) {
                this.handleError(data);
            } else if (data.status === 'cancelled') {
                this.handleCancelled(data);
            }

        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }

    /**
     * Render progress data to modal
     */
    renderProgress(data) {
        // Update stats
        const total = data.total_devices || 0;
        const completed = data.completed_devices || 0;
        const failed = data.failed_devices || 0;
        const pending = total - completed - failed;
        const percent = data.progress_percent || 0;

        document.getElementById('rp-total').textContent = total;
        document.getElementById('rp-completed').textContent = completed;
        document.getElementById('rp-failed').textContent = failed;
        document.getElementById('rp-pending').textContent = pending;
        document.getElementById('rp-percent').textContent = `${percent}%`;

        // Update progress bar
        const bar = document.getElementById('rp-bar');
        if (bar) {
            bar.style.width = `${percent}%`;
            bar.className = 'render-progress-bar';
            if (data.status === 'completed') {
                bar.classList.add('success');
            } else if (data.status === 'failed') {
                bar.classList.add('failed');
            } else if (data.status === 'processing') {
                bar.classList.add('processing');
            }
        }

        // Update status text
        const statusText = document.getElementById('rp-status-text');
        const statusMap = {
            pending: this.__('render.modal.statusPending'),
            processing: this.__('render.modal.statusProcessing', {completed, total}),
            completed: this.__('render.modal.statusCompleted'),
            failed: this.__('render.modal.statusFailed'),
            cancelled: this.__('render.modal.statusCancelled')
        };
        if (statusText) {
            statusText.textContent = statusMap[data.status] || data.status;
        }

        // Update spinner visibility
        const spinner = document.querySelector('.render-progress-spinner');
        if (spinner) {
            spinner.style.display = (data.status === 'processing' || data.status === 'pending') ? 'block' : 'none';
        }

        // Render device items
        this.renderDeviceItems(data.items || []);

        // Render errors if any
        this.renderErrors(data.items || []);
    }

    /**
     * Render device progress items
     */
    renderDeviceItems(items) {
        const container = document.getElementById('rp-devices');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<p class="text-secondary text-center">${this.__('render.modal.devicesLoading')}</p>`;
            return;
        }

        // Show only last 10 items to avoid overflow
        const displayItems = items.slice(-10);

        let html = '';
        displayItems.forEach(item => {
            const statusIcon = this.getStatusIcon(item.status);
            const statusClass = item.status || 'pending';

            html += `
                <div class="render-device-item ${statusClass}">
                    <div class="render-device-icon ${statusClass}">
                        <i class="ti ${statusIcon}"></i>
                    </div>
                    <div class="render-device-info">
                        <span class="render-device-id">${item.device_id?.substring(0, 8) || this.__('render.device')}</span>
                        ${item.retry_count > 0 ? `<span class="render-device-retry">Retry: ${item.retry_count}</span>` : ''}
                    </div>
                    <div class="render-device-status">
                        ${this.getStatusText(item.status)}
                    </div>
                </div>
            `;
        });

        if (items.length > 10) {
            html += `<p class="text-secondary text-center mt-2">${this.__('render.modal.moreDevices', {count: items.length - 10})}</p>`;
        }

        container.innerHTML = html;
    }

    /**
     * Render error details
     */
    renderErrors(items) {
        const errorItems = items.filter(item => item.status === 'failed' && item.error_message);
        const container = document.getElementById('rp-errors');
        const list = document.getElementById('rp-errors-list');

        if (!container || !list) return;

        if (errorItems.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        let html = '';
        errorItems.forEach(item => {
            html += `
                <div class="render-error-item">
                    <span class="render-error-device">${item.device_id?.substring(0, 8) || this.__('render.device')}</span>
                    <span class="render-error-message">${item.error_message}</span>
                </div>
            `;
        });

        list.innerHTML = html;
    }

    /**
     * Get status icon
     */
    getStatusIcon(status) {
        const icons = {
            pending: 'ti-clock',
            processing: 'ti-loader',
            completed: 'ti-check',
            failed: 'ti-x',
            retrying: 'ti-refresh'
        };
        return icons[status] || 'ti-help';
    }

    /**
     * Get status text
     */
    getStatusText(status) {
        const texts = {
            pending: this.__('render.modal.deviceStatusPending'),
            processing: this.__('render.modal.deviceStatusProcessing'),
            completed: this.__('render.modal.deviceStatusCompleted'),
            failed: this.__('render.modal.deviceStatusFailed'),
            retrying: this.__('render.modal.deviceStatusRetrying')
        };
        return texts[status] || status;
    }

    /**
     * Handle completion
     */
    handleComplete(data) {
        this.stopPolling();

        // Update modal to show success
        const statusText = document.getElementById('rp-status-text');
        if (statusText) {
            statusText.innerHTML = `<i class="ti ti-check text-success"></i> ${this.__('render.modal.statusCompleted')}`;
        }

        // Enable close button
        this.enableCloseButton();

        // Callback
        if (this.onComplete) {
            this.onComplete(data);
        }

        Toast.success(this.__('render.modal.sentSuccess', {count: data.completed_devices}));
    }

    /**
     * Handle error
     */
    handleError(data) {
        this.stopPolling();

        const statusText = document.getElementById('rp-status-text');
        if (statusText) {
            statusText.innerHTML = `<i class="ti ti-alert-circle text-danger"></i> ${this.__('render.modal.statusFailed')}`;
        }

        this.enableCloseButton();

        if (this.onError) {
            this.onError(data);
        }

        Toast.error(this.__('render.modal.sentFailed', {count: data.failed_devices}));
    }

    /**
     * Handle cancelled
     */
    handleCancelled(data) {
        this.stopPolling();

        const statusText = document.getElementById('rp-status-text');
        if (statusText) {
            statusText.innerHTML = `<i class="ti ti-ban text-secondary"></i> ${this.__('render.modal.statusCancelled')}`;
        }

        this.enableCloseButton();

        Toast.info(this.__('render.modal.operationCancelled'));
    }

    /**
     * Enable close button after completion
     */
    enableCloseButton() {
        const cancelBtn = document.querySelector('.modal-container .btn-secondary');
        if (cancelBtn) {
            cancelBtn.textContent = this.__('modal.close');
            cancelBtn.classList.remove('btn-secondary');
            cancelBtn.classList.add('btn-primary');
        }
    }

    /**
     * Start polling for updates
     */
    startPolling() {
        this.pollingInterval = setInterval(() => {
            this.updateProgress();
        }, this.pollingRate);
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Stop tracking and close modal
     */
    stop() {
        this.isActive = false;
        this.stopPolling();

        if (this.modalId) {
            Modal.close(this.modalId);
            this.modalId = null;
        }
    }

    /**
     * Cancel the current job
     */
    async cancel() {
        if (!this.queueId) return;

        try {
            await this.app.api.post(`/render-queue/${this.queueId}/cancel`);
            Toast.info(this.__('render.modal.operationCancelled'));
            this.stop();
        } catch (error) {
            console.error('Failed to cancel job:', error);
            Toast.error(this.__('render.modal.cancelFailed'));
        }
    }
}

// CSS styles for the progress modal
const style = document.createElement('style');
style.textContent = `
    .render-progress-container {
        padding: 0.5rem;
    }

    .render-progress-header {
        text-align: center;
        margin-bottom: 1.5rem;
    }

    .render-progress-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
    }

    .render-progress-spinner {
        width: 24px;
        height: 24px;
    }

    .render-progress-spinner .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid var(--border-color);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .render-progress-status-text {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .render-progress-main {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .render-progress-bar-container {
        flex: 1;
        height: 12px;
        background: var(--bg-tertiary);
        border-radius: 6px;
        overflow: hidden;
    }

    .render-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #228be6, #1971c2);
        border-radius: 6px;
        transition: width 0.3s ease;
    }

    .render-progress-bar.success {
        background: linear-gradient(90deg, #40c057, #2f9e44);
    }

    .render-progress-bar.failed {
        background: linear-gradient(90deg, #fa5252, #e03131);
    }

    .render-progress-bar.processing {
        animation: progress-pulse 1.5s infinite;
    }

    @keyframes progress-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .render-progress-percent {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
        min-width: 50px;
        text-align: right;
    }

    .render-progress-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .render-progress-stat {
        text-align: center;
        padding: 0.75rem;
        background: var(--bg-secondary);
        border-radius: 8px;
    }

    .render-progress-stat-label {
        display: block;
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-bottom: 0.25rem;
    }

    .render-progress-stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .render-progress-stat-value.text-success {
        color: var(--color-success);
    }

    .render-progress-stat-value.text-danger {
        color: var(--color-danger);
    }

    .render-progress-devices {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        border-radius: 8px;
    }

    .render-device-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.75rem;
        border-bottom: 1px solid var(--border-color);
    }

    .render-device-item:last-child {
        border-bottom: none;
    }

    .render-device-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        font-size: 0.875rem;
    }

    .render-device-icon.pending {
        background: rgba(134, 142, 150, 0.15);
        color: #868e96;
    }

    .render-device-icon.processing {
        background: rgba(34, 139, 230, 0.15);
        color: #228be6;
    }

    .render-device-icon.completed {
        background: rgba(64, 192, 87, 0.15);
        color: #40c057;
    }

    .render-device-icon.failed {
        background: rgba(250, 82, 82, 0.15);
        color: #fa5252;
    }

    .render-device-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .render-device-id {
        font-family: monospace;
        font-size: 0.875rem;
        color: var(--text-primary);
    }

    .render-device-retry {
        font-size: 0.6875rem;
        padding: 0.125rem 0.375rem;
        background: rgba(250, 176, 5, 0.15);
        color: #e67700;
        border-radius: 4px;
    }

    .render-device-status {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .render-progress-errors {
        margin-top: 1rem;
        padding: 0.75rem;
        background: rgba(250, 82, 82, 0.08);
        border: 1px solid rgba(250, 82, 82, 0.2);
        border-radius: 8px;
    }

    .render-progress-errors-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: var(--color-danger);
        margin-bottom: 0.5rem;
    }

    .render-error-item {
        display: flex;
        justify-content: space-between;
        padding: 0.375rem 0;
        border-bottom: 1px solid rgba(250, 82, 82, 0.1);
        font-size: 0.8125rem;
    }

    .render-error-item:last-child {
        border-bottom: none;
    }

    .render-error-device {
        font-family: monospace;
        color: var(--text-primary);
    }

    .render-error-message {
        color: var(--color-danger);
    }

    @media (max-width: 640px) {
        .render-progress-stats {
            grid-template-columns: repeat(2, 1fr);
        }
    }
`;
document.head.appendChild(style);

export default RenderProgressModal;
