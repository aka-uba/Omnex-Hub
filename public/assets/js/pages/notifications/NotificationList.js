/**
 * Notification List Page Component
 * Displays all notifications with filtering, bulk actions, and detail view
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML, isValidURL } from '../../core/SecurityUtils.js';

export class NotificationListPage {
    constructor(app) {
        this.app = app;
        this.table = null;
        this.selectedNotifications = [];
        this.activeFilter = 'all';
        this.showArchived = false;
        this.userSearchTimeout = null;
        this.userSearchResults = [];
        this._createModalOutsideClickHandler = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload resources before rendering
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('notifications');
    }

    /**
     * Render page
     */
    render() {
        return `
            <div class="notification-list-page">
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.__('list.breadcrumb')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon yellow">
                            <i class="ti ti-bell"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('list.title')}</h1>
                            <p class="page-subtitle">${this.__('list.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-outline" id="btn-toggle-archived">
                            <i class="ti ti-archive"></i>
                            <span>${this.__('actions.showArchived')}</span>
                        </button>
                        <button class="btn btn-primary" id="btn-mark-all-read">
                            <i class="ti ti-checks"></i>
                            <span>${this.__('actions.markAllRead')}</span>
                        </button>
                        ${this.canCreateNotification() ? `
                        <button class="btn btn-primary" id="btn-create-notification">
                            <i class="ti ti-bell-plus"></i>
                            <span>${this.__('actions.createNotification')}</span>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div class="card mb-6">
                <div class="card-body py-3">
                    <div class="flex items-center gap-2">
                        <button class="btn btn-sm filter-tab active" data-filter="all">
                            <i class="ti ti-list"></i>
                            <span>${this.__('filters.all')}</span>
                        </button>
                        <button class="btn btn-sm filter-tab" data-filter="unread">
                            <i class="ti ti-mail"></i>
                            <span>${this.__('filters.unread')}</span>
                        </button>
                        <button class="btn btn-sm filter-tab" data-filter="read">
                            <i class="ti ti-mail-opened"></i>
                            <span>${this.__('filters.read')}</span>
                        </button>
                        <button class="btn btn-sm filter-tab" data-filter="system">
                            <i class="ti ti-settings"></i>
                            <span>${this.__('filters.system')}</span>
                        </button>
                        <button class="btn btn-sm filter-tab" data-filter="device_send">
                            <i class="ti ti-send"></i>
                            <span>${this.__('filters.deviceSend')}</span>
                        </button>
                        <button class="btn btn-sm filter-tab" data-filter="archived">
                            <i class="ti ti-archive"></i>
                            <span>${this.__('filters.archived')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bulk Actions Bar (hidden by default) -->
            <div class="card mb-4 hidden" id="bulk-actions-bar">
                <div class="card-body py-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-muted" id="selection-count">0 ${this.__('bulk.selected', { count: 0 })}</span>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-sm btn-outline" id="btn-bulk-read">
                                <i class="ti ti-check"></i>
                                <span>${this.__('bulk.markRead')}</span>
                            </button>
                            <button class="btn btn-sm btn-outline" id="btn-bulk-archive">
                                <i class="ti ti-archive"></i>
                                <span>${this.__('bulk.archive')}</span>
                            </button>
                            <button class="btn btn-sm btn-danger" id="btn-bulk-delete">
                                <i class="ti ti-trash"></i>
                                <span>${this.__('bulk.delete')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Notifications Table -->
            <div class="card card-table">
                <div id="notifications-table"></div>
            </div>
            </div>
        `;
    }

    /**
     * Initialize page
     */
    async init() {
        this.initTable();
        this.bindEvents();
    }

    /**
     * Initialize data table
     */
    initTable() {
        this.table = new DataTable('#notifications-table', {
            columns: [
                {
                    key: 'type_icon',
                    label: '',
                    width: '50px',
                    sortable: false,
                    preview: true,
                    render: (_, row) => {
                        const icon = this.getTypeIcon(row.type);
                        const typeClass = row.type || 'info';
                        return `
                            <div class="data-table-icon-cell type-${typeClass}">
                                <i class="ti ti-${icon}"></i>
                            </div>
                        `;
                    }
                },
                {
                    key: 'title',
                    label: this.__('table.notification'),
                    title: true,
                    render: (value, row) => {
                        const unreadClass = row.is_read ? '' : 'font-bold';
                        const unreadDot = row.is_read ? '' : '<span class="notification-unread-dot"></span>';
                        return `
                            <div class="notification-cell">
                                <p class="notification-title ${unreadClass}">
                                    ${unreadDot}${escapeHTML(value)}
                                </p>
                                <p class="notification-message">
                                    ${escapeHTML(row.message || '')}
                                </p>
                            </div>
                        `;
                    }
                },
                {
                    key: 'created_at',
                    label: this.__('table.date'),
                    width: '150px',
                    render: (value) => {
                        if (!value) return '-';
                        return this.formatRelativeDate(value);
                    }
                },
                {
                    key: 'is_read',
                    label: this.__('table.status'),
                    width: '100px',
                    render: (value) => {
                        if (value) {
                            return `<span class="badge badge-secondary">${this.__('status.read')}</span>`;
                        }
                        return `<span class="badge badge-primary">${this.__('status.new')}</span>`;
                    }
                }
            ],
            actions: [
                {
                    name: 'mark-read',
                    icon: 'ti-check',
                    label: this.__('actions.markRead'),
                    class: 'btn-ghost text-success',
                    visible: (row) => !row.is_read,
                    onClick: (row) => this.markAsRead(row.id)
                },
                {
                    name: 'archive',
                    icon: 'ti-archive',
                    label: this.__('actions.archive'),
                    class: 'btn-ghost text-warning',
                    visible: (row) => !row.is_archived,
                    onClick: (row) => this.toggleArchive(row.id, false)
                },
                {
                    name: 'unarchive',
                    icon: 'ti-archive-off',
                    label: this.__('modal.unarchive'),
                    class: 'btn-ghost text-warning',
                    visible: (row) => row.is_archived,
                    onClick: (row) => this.toggleArchive(row.id, true)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.deleteNotification(row.id)
                }
            ],
            serverSide: true,
            fetchData: (params) => this.fetchNotifications(params),
            selectable: true,
            onRowClick: (row) => this.showNotificationDetail(row),
            onSelectionChange: (rows) => this.onSelectionChange(rows),
            pageSize: 20,
            searchPlaceholder: this.__('table.search'),
            emptyText: this.__('empty.title'),
            emptyIcon: 'ti-bell-off',
            toolbar: {
                show: true,
                exports: true
            },
            exportFilename: 'notifications',
            exportTitle: this.__('list.title'),
            defaultSort: {
                key: 'created_at',
                direction: 'desc'
            }
        });
    }

    /**
     * Fetch notifications from API
     */
    async fetchNotifications(params) {
        try {
            const queryParams = {
                ...params,
                sort_by: params.sort_by || 'created_at',
                sort_dir: params.sort_dir || 'DESC'
            };

            if (this.activeFilter === 'unread') {
                queryParams.status = 'unread';
            } else if (this.activeFilter === 'read') {
                queryParams.status = 'read';
            } else if (this.activeFilter === 'system') {
                queryParams.type = 'system';
            } else if (this.activeFilter === 'device_send') {
                queryParams.category = 'device_send';
            } else if (this.activeFilter === 'archived') {
                queryParams.status = 'archived';
            } else if (this.activeFilter === 'all') {
                queryParams.status = this.showArchived ? 'all' : 'active';
            }

            const response = await this.app.api.get('/notifications', queryParams);
            const notifications = response.data || [];

            // Map API response to expected format
            const mappedData = notifications.map(n => ({
                id: n.id,
                type: n.type || 'info',
                title: n.title,
                message: n.message,
                is_read: n.status === 'read' || n.read_at !== null,
                is_archived: n.status === 'archived',
                created_at: n.created_at,
                sender: n.created_by_name || this.__('common.system'),
                action_url: this.normalizeNotificationLink(n.link)
            }));

            return {
                data: mappedData,
                total: response.meta?.total || mappedData.length
            };

        } catch (error) {
            Logger.error('Error fetching notifications:', error);
            return {
                data: [],
                total: 0
            };
        }
    }

    normalizeNotificationLink(link) {
        if (!link || typeof link !== 'string') return link;
        const trimmed = link.trim();
        if (trimmed.startsWith('#/queue')) {
            return trimmed.replace('#/queue', '#/admin/queue');
        }
        return trimmed;
    }

    getNotificationManager() {
        return this.app?.layout?.notificationManager || null;
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Create notification (Admin/SuperAdmin only)
        document.getElementById('btn-create-notification')?.addEventListener('click', () => {
            this.showCreateNotificationModal();
        });

        // Mark all as read
        document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
            this.markAllAsRead();
        });

        // Toggle archived
        document.getElementById('btn-toggle-archived')?.addEventListener('click', () => {
            this.toggleArchivedView();
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setActiveFilter(e.currentTarget.dataset.filter);
            });
        });

        // Bulk actions
        document.getElementById('btn-bulk-read')?.addEventListener('click', () => {
            this.bulkMarkAsRead();
        });

        document.getElementById('btn-bulk-archive')?.addEventListener('click', () => {
            this.bulkArchive();
        });

        document.getElementById('btn-bulk-delete')?.addEventListener('click', () => {
            this.bulkDelete();
        });
    }

    /**
     * Set active filter tab
     */
    setActiveFilter(filter) {
        this.activeFilter = filter;

        // Update tab UI
        document.querySelectorAll('.filter-tab').forEach(tab => {
            if (tab.dataset.filter === filter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Refresh table
        this.table?.refresh();
    }

    /**
     * Toggle archived view
     */
    toggleArchivedView() {
        this.showArchived = !this.showArchived;
        const btn = document.getElementById('btn-toggle-archived');
        if (btn) {
            const icon = btn.querySelector('i');
            const span = btn.querySelector('span');
            if (this.showArchived) {
                icon.className = 'ti ti-archive-off';
                span.textContent = this.__('actions.hideArchived');
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-outline');
            } else {
                icon.className = 'ti ti-archive';
                span.textContent = this.__('actions.showArchived');
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            }
        }
        this.table?.refresh();
    }

    /**
     * Handle selection change
     */
    onSelectionChange(rows) {
        this.selectedNotifications = rows;
        const bulkBar = document.getElementById('bulk-actions-bar');
        const countEl = document.getElementById('selection-count');

        if (rows.length > 0) {
            bulkBar?.classList.remove('hidden');
            if (countEl) {
                countEl.textContent = this.__('bulk.selected', { count: rows.length });
            }
        } else {
            bulkBar?.classList.add('hidden');
        }
    }

    /**
     * Show notification detail modal
     */
    showNotificationDetail(notification) {
        const icon = this.getTypeIcon(notification.type);
        const color = this.getTypeColor(notification.type);
        const formattedDate = this.formatDate(notification.created_at);

        const content = `
            <div class="space-y-4">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                         style="background: ${color}20; color: ${color}">
                        <i class="ti ti-${icon} text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="font-medium text-lg">${escapeHTML(notification.title)}</h4>
                        <p class="text-sm text-muted mt-1">${escapeHTML(formattedDate)}</p>
                    </div>
                    <span class="badge ${notification.is_read ? 'badge-secondary' : 'badge-primary'}">
                        ${notification.is_read ? this.__('status.read') : this.__('status.new')}
                    </span>
                </div>

                <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p class="text-gray-700 dark:text-gray-300">${escapeHTML(notification.message)}</p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-muted">${this.__('modal.type')}</p>
                        <p class="font-medium">${this.getTypeLabel(notification.type)}</p>
                    </div>
                    <div>
                        <p class="text-muted">${this.__('modal.sender')}</p>
                        <p class="font-medium">${escapeHTML(notification.sender || this.__('modal.systemSender'))}</p>
                    </div>
                </div>

                ${notification.action_url && isValidURL(notification.action_url) ? `
                    <div class="pt-2">
                        <button type="button" class="btn btn-outline btn-sm" id="modal-view-action">
                            <i class="ti ti-external-link"></i>
                            <span>${this.__('modal.viewDetails')}</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        const footerButtons = [];

        if (!notification.is_read) {
            footerButtons.push(`
                <button class="btn btn-outline" id="modal-mark-read">
                    <i class="ti ti-check"></i>
                    ${this.__('actions.markRead')}
                </button>
            `);
        }

        footerButtons.push(`
            <button class="btn btn-outline" id="modal-archive">
                <i class="ti ti-${notification.is_archived ? 'archive-off' : 'archive'}"></i>
                ${notification.is_archived ? this.__('modal.unarchive') : this.__('actions.archive')}
            </button>
        `);

        footerButtons.push(`
            <button class="btn btn-danger" id="modal-delete">
                <i class="ti ti-trash"></i>
                ${this.__('actions.delete')}
            </button>
        `);

        const modal = Modal.show({
            title: this.__('modal.detailTitle'),
            icon: 'ti-bell',
            content: content,
            size: 'md',
            showFooter: true,
            footer: `
                <button class="btn btn-outline" data-modal-close>${this.__('modal.close')}</button>
                ${footerButtons.join('')}
            `
        });

        // Mark as read when viewing
        if (!notification.is_read) {
            this.markAsRead(notification.id, false);
        }

        // Modal action handlers
        setTimeout(() => {
            document.getElementById('modal-mark-read')?.addEventListener('click', () => {
                this.markAsRead(notification.id);
                Modal.close(modal.id);
            });

            document.getElementById('modal-archive')?.addEventListener('click', () => {
                this.toggleArchive(notification.id, Boolean(notification.is_archived));
                Modal.close(modal.id);
            });

            document.getElementById('modal-delete')?.addEventListener('click', () => {
                Modal.close(modal.id);
                this.deleteNotification(notification.id);
            });

            document.getElementById('modal-view-action')?.addEventListener('click', async (e) => {
                e.preventDefault();
                const openedInline = await this.openQueueDetailInline(notification.action_url);
                if (!openedInline && notification.action_url) {
                    window.location.hash = notification.action_url;
                }
            });
        }, 100);
    }

    parseQueueDeepLink(actionUrl) {
        if (!actionUrl || typeof actionUrl !== 'string') return null;
        const trimmed = actionUrl.trim();
        let queryString = '';
        if (trimmed.startsWith('#/admin/queue?')) {
            queryString = trimmed.slice('#/admin/queue?'.length);
        } else if (trimmed.startsWith('#/queue?')) {
            queryString = trimmed.slice('#/queue?'.length);
        } else {
            return null;
        }
        const params = new URLSearchParams(queryString);
        const job = params.get('job') || '';
        const batch = params.get('batch') || '';

        if (!job && !batch) return null;
        return { job: job.trim(), batch: batch.trim() };
    }

    async openQueueDetailInline(actionUrl) {
        const deepLink = this.parseQueueDeepLink(actionUrl);
        if (!deepLink) return false;

        if (deepLink.job) {
            return await this.showQueueJobDetailModal(deepLink.job);
        }

        if (deepLink.batch) {
            return await this.showQueueBatchDetailModal(deepLink.batch);
        }

        return false;
    }

    async showQueueJobDetailModal(jobId) {
        try {
            const response = await this.app.api.get(`/render-queue/${encodeURIComponent(jobId)}/status`);
            if (!response.success || !response.data) {
                Toast.error(this.__('toast.loadError'));
                return false;
            }

            const job = response.data;
            const items = Array.isArray(job.items) ? job.items : [];
            const progressPercent = Number(job.progress ?? job.progress_percent ?? 0);

            const content = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><p class="text-muted">${this.__('jobs.id')}</p><p class="font-medium"><code>${escapeHTML(job.id || '')}</code></p></div>
                        <div><p class="text-muted">${this.__('jobs.status')}</p><p class="font-medium">${escapeHTML(job.status || '-')}</p></div>
                        <div><p class="text-muted">${this.__('jobs.progress')}</p><p class="font-medium">${progressPercent}%</p></div>
                        <div><p class="text-muted">${this.__('jobs.devices')}</p><p class="font-medium">${Number(job.devices_completed || 0)} / ${Number(job.devices_total || 0)}</p></div>
                    </div>
                    <div>
                        <p class="text-muted text-sm mb-2">${this.__('modal.deviceProgress')}</p>
                        <div class="space-y-2" style="max-height: 280px; overflow:auto;">
                            ${items.map(item => `
                                <div class="flex items-center justify-between text-sm p-2 border rounded">
                                    <span>${escapeHTML(item.device_name || item.device_id || 'Cihaz')}</span>
                                    <span class="badge ${item.status === 'completed' ? 'badge-success' : item.status === 'failed' ? 'badge-danger' : 'badge-secondary'}">${escapeHTML(item.status || '-')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('modal.viewDetails'),
                icon: 'ti-list-details',
                content,
                size: 'lg',
                showFooter: true,
                showConfirm: false,
                cancelText: this.__('modal.close')
            });
            return true;
        } catch (error) {
            Logger.error('Failed to load queue job detail inline:', error);
            Toast.error(this.__('toast.loadError'));
            return false;
        }
    }

    async loadBatchJobs(batchId) {
        const maxPages = 30;
        const limit = 100;
        let offset = 0;
        const allRows = [];

        for (let page = 0; page < maxPages; page += 1) {
            const response = await this.app.api.get('/render-queue', {
                status: 'all',
                limit,
                offset
            });
            const rows = response.success ? (response.data?.queues || []) : [];
            allRows.push(...rows);

            const pagination = response.data?.pagination || {};
            const hasMore = Boolean(pagination.has_more);
            if (!hasMore || rows.length === 0) {
                break;
            }
            offset += limit;
        }

        return allRows.filter(job => String(job.batch_id || '') === String(batchId));
    }

    async showQueueBatchDetailModal(batchId) {
        try {
            const batchJobs = await this.loadBatchJobs(batchId);

            if (batchJobs.length === 0) {
                Toast.warning(this.__('empty.noData'));
                return false;
            }

            if (batchJobs.length === 1) {
                return await this.showQueueJobDetailModal(batchJobs[0].id);
            }

            const totalDevices = batchJobs.reduce((sum, job) => sum + Number(job.devices_total || 0), 0);
            const completedDevices = batchJobs.reduce((sum, job) => sum + Number(job.devices_completed || 0), 0);
            const failedDevices = batchJobs.reduce((sum, job) => sum + Number(job.devices_failed || 0), 0);

            const content = `
                <div class="space-y-4">
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div><p class="text-muted">${this.__('batch.totalProducts')}</p><p class="font-medium">${batchJobs.length}</p></div>
                        <div><p class="text-muted">${this.__('jobs.devices')}</p><p class="font-medium">${completedDevices} / ${totalDevices}</p></div>
                        <div><p class="text-muted">${this.__('status.failed')}</p><p class="font-medium">${failedDevices}</p></div>
                    </div>
                    <div class="space-y-2" style="max-height: 320px; overflow:auto;">
                        ${batchJobs.map(job => `
                            <div class="flex items-center justify-between p-2 border rounded">
                                <div>
                                    <p class="font-medium text-sm">${escapeHTML(job.product_name || '-')}</p>
                                    <p class="text-xs text-muted"><code>${escapeHTML(job.id || '')}</code></p>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline inline-open-job" data-job-id="${escapeHTML(job.id || '')}">
                                    <i class="ti ti-eye"></i>
                                    <span>${this.__('modal.viewDetails')}</span>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            const modal = Modal.show({
                title: this.__('batch.detailTitle'),
                icon: 'ti-stack-2',
                content,
                size: 'lg',
                showFooter: true,
                showConfirm: false,
                cancelText: this.__('modal.close')
            });

            setTimeout(() => {
                const modalEl = document.getElementById(modal.id);
                modalEl?.querySelectorAll('.inline-open-job')?.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const selectedJobId = btn.getAttribute('data-job-id') || '';
                        if (!selectedJobId) return;
                        this.showQueueJobDetailModal(selectedJobId);
                    });
                });
            }, 50);
            return true;
        } catch (error) {
            Logger.error('Failed to load queue batch detail inline:', error);
            Toast.error(this.__('toast.loadError'));
            return false;
        }
    }

    /**
     * Mark single notification as read
     */
    async markAsRead(id, showToast = true) {
        try {
            await this.app.api.put(`/notifications/${encodeURIComponent(id)}/read`);
            if (showToast) {
                Toast.success(this.__('messages.markedRead'));
            }
            this.table?.refresh();
        } catch (error) {
            Logger.error('Error marking notification as read:', error);
            if (showToast) {
                Toast.error(this.__('messages.operationFailed'));
            }
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        Modal.confirm({
            title: this.__('confirm.markAllReadTitle'),
            message: this.__('confirm.markAllReadMessage'),
            type: 'info',
            confirmText: this.__('confirm.markAllReadBtn'),
            onConfirm: async () => {
                try {
                    await this.app.api.put('/notifications/mark-all-read');
                    Toast.success(this.__('messages.allMarkedRead'));
                    this.table?.refresh();
                } catch (error) {
                    Logger.error('Error marking all as read:', error);
                    Toast.error(this.__('messages.operationFailed'));
                }
            }
        });
    }

    /**
     * Toggle archive status
     */
    async toggleArchive(id, isArchived = false) {
        try {
            await this.app.api.put(`/notifications/${encodeURIComponent(id)}/archive`, {
                archived: !isArchived
            });
            Toast.success(this.__('messages.archived'));
            this.table?.refresh();
        } catch (error) {
            Logger.error('Error toggling archive:', error);
            Toast.error(this.__('messages.operationFailed'));
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(id) {
        Modal.confirm({
            title: this.__('confirm.deleteTitle'),
            message: this.__('confirm.deleteMessage'),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            onConfirm: async () => {
                try {
                    this.getNotificationManager()?.suppressVisualNotifications?.(12000);
                    await this.app.api.delete(`/notifications/${encodeURIComponent(id)}`);
                    Toast.success(this.__('messages.deleted'));
                    this.table?.refresh();
                } catch (error) {
                    Logger.error('Error deleting notification:', error);
                    Toast.error(this.__('messages.deleteFailed'));
                }
            }
        });
    }

    /**
     * Bulk mark as read
     */
    async bulkMarkAsRead() {
        if (this.selectedNotifications.length === 0) {
            Toast.warning(this.__('messages.selectAtLeastOne'));
            return;
        }

        try {
            const ids = this.selectedNotifications.map(n => n.id);
            const results = await Promise.allSettled(
                ids.map(id => this.app.api.put(`/notifications/${encodeURIComponent(id)}/read`))
            );
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            if (successCount > 0) {
                Toast.success(this.__('messages.bulkMarkedRead', { count: successCount }));
            } else {
                Toast.error(this.__('messages.operationFailed'));
            }
            this.selectedNotifications = [];
            this.table?.clearSelection();
            this.table?.refresh();
        } catch (error) {
            Logger.error('Error bulk marking as read:', error);
            Toast.error(this.__('messages.operationFailed'));
        }
    }

    /**
     * Bulk archive
     */
    async bulkArchive() {
        if (this.selectedNotifications.length === 0) {
            Toast.warning(this.__('messages.selectAtLeastOne'));
            return;
        }

        try {
            const ids = this.selectedNotifications.map(n => n.id);
            const results = await Promise.allSettled(
                ids.map(id => this.app.api.put(`/notifications/${encodeURIComponent(id)}/archive`, { archived: true }))
            );
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            if (successCount > 0) {
                Toast.success(this.__('messages.bulkArchived', { count: successCount }));
            } else {
                Toast.error(this.__('messages.operationFailed'));
            }
            this.selectedNotifications = [];
            this.table?.clearSelection();
            this.table?.refresh();
        } catch (error) {
            Logger.error('Error bulk archiving:', error);
            Toast.error(this.__('messages.operationFailed'));
        }
    }

    /**
     * Bulk delete
     */
    async bulkDelete() {
        if (this.selectedNotifications.length === 0) {
            Toast.warning(this.__('messages.selectAtLeastOne'));
            return;
        }

        const count = this.selectedNotifications.length;

        Modal.confirm({
            title: this.__('confirm.bulkDeleteTitle'),
            message: this.__('confirm.bulkDeleteMessage', { count }),
            type: 'danger',
            confirmText: this.__('confirm.bulkDeleteBtn', { count }),
            onConfirm: async () => {
                try {
                    this.getNotificationManager()?.suppressVisualNotifications?.(15000);
                    const ids = this.selectedNotifications.map(n => n.id);
                    const results = await Promise.allSettled(
                        ids.map(id => this.app.api.delete(`/notifications/${encodeURIComponent(id)}`))
                    );
                    const successCount = results.filter(r => r.status === 'fulfilled').length;
                    if (successCount > 0) {
                        Toast.success(this.__('messages.bulkDeleted', { count: successCount }));
                    } else {
                        Toast.error(this.__('messages.deleteFailed'));
                    }
                    this.selectedNotifications = [];
                    this.table?.clearSelection();
                    this.table?.refresh();
                } catch (error) {
                    Logger.error('Error bulk deleting:', error);
                    Toast.error(this.__('messages.deleteFailed'));
                }
            }
        });
    }

    /**
     * Get type icon
     */
    getTypeIcon(type) {
        const icons = {
            system: 'settings',
            info: 'info-circle',
            warning: 'alert-triangle',
            error: 'alert-circle',
            success: 'circle-check',
            product: 'package',
            device: 'device-desktop',
            user: 'user',
            template: 'template',
            schedule: 'calendar-event'
        };
        return icons[type] || 'bell';
    }

    /**
     * Get type color
     */
    getTypeColor(type) {
        const colors = {
            system: '#228be6',
            info: '#228be6',
            warning: '#fab005',
            error: '#fa5252',
            success: '#40c057',
            product: '#7950f2',
            device: '#20c997',
            user: '#e64980',
            template: '#fd7e14',
            schedule: '#845ef7'
        };
        return colors[type] || '#868e96';
    }

    /**
     * Get type label
     */
    getTypeLabel(type) {
        return this.__(`types.${type}`) || type;
    }

    /**
     * Format relative date
     */
    formatRelativeDate(dateStr) {
        if (!dateStr) return '-';

        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return this.__('time.justNow');
        } else if (diffMins < 60) {
            return this.__('time.minutesAgo', { count: diffMins });
        } else if (diffHours < 24) {
            return this.__('time.hoursAgo', { count: diffHours });
        } else if (diffDays === 1) {
            return this.__('time.yesterday');
        } else if (diffDays < 7) {
            return this.__('time.daysAgo', { count: diffDays });
        } else {
            return date.toLocaleDateString('tr-TR');
        }
    }

    /**
     * Format date
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    /**
     * Check if current user can create notifications
     */
    canCreateNotification() {
        const user = this.app.state.get('user');
        if (!user || !user.role) return false;
        const role = user.role.toLowerCase();
        return ['admin', 'superadmin'].includes(role);
    }

    /**
     * Check if current user is superadmin
     */
    isSuperAdmin() {
        const user = this.app.state.get('user');
        if (!user || !user.role) return false;
        return user.role.toLowerCase() === 'superadmin';
    }

    /**
     * Show create notification modal
     */
    async showCreateNotificationModal() {
        // Load companies for SuperAdmin
        let companiesHtml = '';
        if (this.isSuperAdmin()) {
            try {
                const response = await this.app.api.get('/companies');
                const companies = response.data || [];
                companiesHtml = companies.map(c =>
                    `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`
                ).join('');
            } catch (error) {
                Logger.error('Error loading companies:', error);
            }
        }

        const content = `
            <form id="create-notification-form" class="space-y-4">
                <!-- Baslik -->
                <div class="form-group">
                    <label class="form-label">
                        ${this.__('create.notificationTitle')} <span class="text-red-500">*</span>
                    </label>
                    <input type="text"
                           id="notification-title"
                           class="form-input"
                           placeholder="${this.__('create.titlePlaceholder')}"
                           maxlength="100"
                           required />
                    <p class="form-hint text-xs text-gray-500 mt-1">${this.__('create.titleHint')}</p>
                </div>

                <!-- Mesaj -->
                <div class="form-group">
                    <label class="form-label">
                        ${this.__('create.message')} <span class="text-red-500">*</span>
                    </label>
                    <textarea id="notification-message"
                              class="form-input"
                              rows="4"
                              placeholder="${this.__('create.messagePlaceholder')}"
                              maxlength="500"
                              required></textarea>
                    <p class="form-hint text-xs text-gray-500 mt-1">${this.__('create.messageHint')}</p>
                </div>

                <!-- Tur -->
                <div class="form-group">
                    <label class="form-label">${this.__('create.type')}</label>
                    <select id="notification-type" class="form-select">
                        <option value="info">${this.__('types.info')}</option>
                        <option value="success">${this.__('types.success')}</option>
                        <option value="warning">${this.__('types.warning')}</option>
                        <option value="error">${this.__('types.error')}</option>
                        <option value="system">${this.__('types.system')}</option>
                    </select>
                </div>

                <!-- Hedef -->
                <div class="form-group">
                    <label class="form-label">${this.__('create.targetType')}</label>
                    <div class="space-y-2">
                        <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                            <input type="radio" name="target_type" value="all" class="form-radio" checked />
                            <i class="ti ti-users text-gray-500"></i>
                            <span>${this.__('create.targetAll')}</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                            <input type="radio" name="target_type" value="role" class="form-radio" />
                            <i class="ti ti-shield text-gray-500"></i>
                            <span>${this.__('create.targetRole')}</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                            <input type="radio" name="target_type" value="user" class="form-radio" />
                            <i class="ti ti-user text-gray-500"></i>
                            <span>${this.__('create.targetUser')}</span>
                        </label>
                        ${this.isSuperAdmin() ? `
                        <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                            <input type="radio" name="target_type" value="company" class="form-radio" />
                            <i class="ti ti-building text-gray-500"></i>
                            <span>${this.__('create.targetCompany')}</span>
                        </label>
                        ` : ''}
                    </div>
                </div>

                <!-- Rol Secimi (gizli) -->
                <div class="form-group hidden" id="role-select-group">
                    <label class="form-label">${this.__('create.selectRole')}</label>
                    <select id="target-role" class="form-select">
                        <option value="">${this.__('create.selectRolePlaceholder')}</option>
                        <option value="admin">Admin</option>
                        <option value="user">${this.__('types.user')}</option>
                        <option value="viewer">Viewer</option>
                    </select>
                </div>

                <!-- Kullanici Arama (gizli) -->
                <div class="form-group hidden" id="user-search-group">
                    <label class="form-label">${this.__('create.selectUser')}</label>
                    <div class="relative">
                        <input type="text"
                               id="user-search-input"
                               class="form-input"
                               placeholder="${this.__('create.searchUserPlaceholder')}"
                               autocomplete="off" />
                        <input type="hidden" id="target-user-id" />
                        <div id="user-search-results"
                             class="user-search-dropdown hidden">
                        </div>
                    </div>
                    <div id="selected-user-display" class="selected-user-badge hidden">
                        <div class="selected-user-info">
                            <i class="ti ti-user"></i>
                            <span id="selected-user-name"></span>
                        </div>
                        <button type="button" id="clear-selected-user" class="btn btn-sm btn-ghost btn-danger">
                            <i class="ti ti-x"></i>
                        </button>
                    </div>
                </div>

                <!-- Firma Secimi (gizli, sadece SuperAdmin) -->
                ${this.isSuperAdmin() ? `
                <div class="form-group hidden" id="company-select-group">
                    <label class="form-label">${this.__('create.selectCompany')}</label>
                    <select id="target-company" class="form-select">
                        <option value="">${this.__('create.selectCompanyPlaceholder')}</option>
                        ${companiesHtml}
                    </select>
                </div>
                ` : ''}

                <!-- Link (opsiyonel) -->
                <div class="form-group">
                    <label class="form-label">
                        ${this.__('create.linkLabel')} <span class="text-gray-400">${this.__('create.linkOptional')}</span>
                    </label>
                    <input type="text"
                           id="notification-link"
                           class="form-input"
                           placeholder="${this.__('create.linkPlaceholder')}" />
                    <p class="form-hint text-xs text-gray-500 mt-1">${this.__('create.linkHint')}</p>
                </div>
            </form>
        `;

        Modal.show({
            id: 'create-notification-modal',
            title: this.__('create.title'),
            icon: 'ti-bell-plus',
            content: content,
            size: 'md',
            showFooter: true,
            confirmText: this.__('create.send'),
            cancelText: this.__('modal.close'),
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                await this.handleCreateNotification();
            }
        });

        // Bind modal events after render
        setTimeout(() => {
            this.bindCreateNotificationModalEvents();
        }, 100);
    }

    /**
     * Bind events for create notification modal
     */
    bindCreateNotificationModalEvents() {
        // Target type change
        document.querySelectorAll('input[name="target_type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleTargetTypeChange(e.target.value);
            });
        });

        // User search input
        const userSearchInput = document.getElementById('user-search-input');
        userSearchInput?.addEventListener('input', (e) => {
            this.handleUserSearchInput(e.target.value);
        });

        // Clear selected user
        document.getElementById('clear-selected-user')?.addEventListener('click', () => {
            this.clearSelectedUser();
        });

        // Close search results when clicking outside
        if (this._createModalOutsideClickHandler) {
            document.removeEventListener('click', this._createModalOutsideClickHandler);
        }
        this._createModalOutsideClickHandler = (e) => {
            const searchGroup = document.getElementById('user-search-group');
            const resultsEl = document.getElementById('user-search-results');
            if (searchGroup && resultsEl && !searchGroup.contains(e.target)) {
                resultsEl.classList.add('hidden');
            }
        };
        document.addEventListener('click', this._createModalOutsideClickHandler);
    }

    /**
     * Handle target type change
     */
    handleTargetTypeChange(targetType) {
        // Hide all conditional groups
        document.getElementById('role-select-group')?.classList.add('hidden');
        document.getElementById('user-search-group')?.classList.add('hidden');
        document.getElementById('company-select-group')?.classList.add('hidden');

        // Show relevant group
        switch (targetType) {
            case 'role':
                document.getElementById('role-select-group')?.classList.remove('hidden');
                break;
            case 'user':
                document.getElementById('user-search-group')?.classList.remove('hidden');
                break;
            case 'company':
                document.getElementById('company-select-group')?.classList.remove('hidden');
                break;
        }
    }

    /**
     * Handle user search input
     */
    handleUserSearchInput(term) {
        // Clear previous timeout
        if (this.userSearchTimeout) {
            clearTimeout(this.userSearchTimeout);
        }

        const resultsEl = document.getElementById('user-search-results');

        // Minimum 2 characters
        if (term.length < 2) {
            resultsEl?.classList.add('hidden');
            return;
        }

        // Debounce search
        this.userSearchTimeout = setTimeout(async () => {
            await this.searchUsers(term);
        }, 300);
    }

    /**
     * Search users by term
     */
    async searchUsers(term) {
        const resultsEl = document.getElementById('user-search-results');
        if (!resultsEl) return;

        try {
            const response = await this.app.api.get('/users', {
                search: term,
                limit: 10
            });

            const users = response.data?.users || response.data || [];
            this.userSearchResults = users;

            if (users.length === 0) {
                resultsEl.innerHTML = `
                    <div class="p-3 text-center text-gray-500">
                        <i class="ti ti-user-off mr-1"></i>
                        ${this.__('create.userNotFound')}
                    </div>
                `;
            } else {
                resultsEl.innerHTML = users.map(user => `
                    <div class="user-search-item"
                         data-user-id="${escapeHTML(user.id)}"
                         data-user-name="${escapeHTML(user.first_name)} ${escapeHTML(user.last_name)}">
                        ${user.avatar ?
                            `<img src="${window.OmnexConfig?.basePath || ''}/${escapeHTML(user.avatar)}"
                                  class="user-search-avatar" alt="" />` :
                            `<div class="user-search-avatar-placeholder">
                                <i class="ti ti-user"></i>
                            </div>`
                        }
                        <div class="user-search-item-info">
                            <p class="user-search-item-name">${escapeHTML(user.first_name)} ${escapeHTML(user.last_name)}</p>
                            <p class="user-search-item-email">${escapeHTML(user.email)}</p>
                        </div>
                        <span class="badge badge-secondary">${escapeHTML(user.role)}</span>
                    </div>
                `).join('');

                // Bind click events for results
                resultsEl.querySelectorAll('.user-search-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.selectUser(item.dataset.userId, item.dataset.userName);
                    });
                });
            }

            resultsEl.classList.remove('hidden');

        } catch (error) {
            Logger.error('Error searching users:', error);
            resultsEl.innerHTML = `
                <div class="p-3 text-center text-red-500">
                    <i class="ti ti-alert-circle mr-1"></i>
                    ${this.__('create.searchError')}
                </div>
            `;
            resultsEl.classList.remove('hidden');
        }
    }

    /**
     * Select a user from search results
     */
    selectUser(userId, userName) {
        document.getElementById('target-user-id').value = userId;
        document.getElementById('user-search-input').value = '';
        document.getElementById('user-search-results')?.classList.add('hidden');
        document.getElementById('selected-user-name').textContent = userName;
        document.getElementById('selected-user-display')?.classList.remove('hidden');
    }

    /**
     * Clear selected user
     */
    clearSelectedUser() {
        document.getElementById('target-user-id').value = '';
        document.getElementById('selected-user-name').textContent = '';
        document.getElementById('selected-user-display')?.classList.add('hidden');
    }

    /**
     * Handle create notification form submission
     */
    async handleCreateNotification() {
        // Get form values
        const title = document.getElementById('notification-title')?.value?.trim();
        const message = document.getElementById('notification-message')?.value?.trim();
        const type = document.getElementById('notification-type')?.value || 'info';
        const targetType = document.querySelector('input[name="target_type"]:checked')?.value || 'all';
        const actionUrl = document.getElementById('notification-link')?.value?.trim() || null;

        // Validate required fields
        if (!title) {
            Toast.error(this.__('messages.titleRequired'));
            throw new Error('Validation failed');
        }

        if (!message) {
            Toast.error(this.__('messages.messageRequired'));
            throw new Error('Validation failed');
        }

        if (title.length > 100) {
            Toast.error(this.__('messages.titleTooLong'));
            throw new Error('Validation failed');
        }

        if (message.length > 500) {
            Toast.error(this.__('messages.messageTooLong'));
            throw new Error('Validation failed');
        }

        // Get target_id based on target_type
        let targetId = null;

        switch (targetType) {
            case 'role':
                targetId = document.getElementById('target-role')?.value;
                if (!targetId) {
                    Toast.error(this.__('messages.selectRole'));
                    throw new Error('Validation failed');
                }
                break;
            case 'user':
                targetId = document.getElementById('target-user-id')?.value;
                if (!targetId) {
                    Toast.error(this.__('messages.selectUser'));
                    throw new Error('Validation failed');
                }
                break;
            case 'company':
                targetId = document.getElementById('target-company')?.value;
                if (!targetId) {
                    Toast.error(this.__('messages.selectCompany'));
                    throw new Error('Validation failed');
                }
                break;
        }

        // Prepare payload
        const payload = {
            title,
            message,
            type,
            target_type: targetType,
            target_id: targetId,
            link: actionUrl
        };

        try {
            await this.app.api.post('/notifications', payload);
            Toast.success(this.__('messages.created'));
            this.table?.refresh();
        } catch (error) {
            Logger.error('Error creating notification:', error);
            Toast.error(error.message || this.__('messages.createError'));
            throw error;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._createModalOutsideClickHandler) {
            document.removeEventListener('click', this._createModalOutsideClickHandler);
            this._createModalOutsideClickHandler = null;
        }
        if (this.userSearchTimeout) {
            clearTimeout(this.userSearchTimeout);
        }
        this.table?.destroy();
        // Clear page translations
        this.app.i18n.clearPageTranslations();
    }
}

export default NotificationListPage;
