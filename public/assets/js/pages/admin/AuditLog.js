/**
 * Audit Log Page Component
 * Dashboard-style design with analytics cards
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class AuditLogPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.stats = null;
        this.todayStats = null;
        this.archiveStats = null;
        this.filterOptions = { resources: [], users: [] };
        this.filters = {
            user: '',
            action: '',
            entity: '',
            dateFrom: '',
            dateTo: ''
        };
        this.isSuperAdmin = false;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('admin');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/admin">${this.__('auditLog.breadcrumb.admin')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('auditLog.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon rose">
                            <i class="ti ti-history"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('auditLog.title')}</h1>
                            <p class="page-subtitle">${this.__('auditLog.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="archive-btn" class="btn btn-outline" title="${this.__('auditLog.archive.title')}">
                            <i class="ti ti-archive"></i>
                            ${this.__('auditLog.archive.button')}
                        </button>
                        <button id="refresh-logs-btn" class="btn btn-outline">
                            <i class="ti ti-refresh"></i>
                            ${this.__('auditLog.refresh')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Analytics Cards - Dashboard Style -->
            <div class="dashboard-stats audit-log-stats" id="stats-container">
                ${this.renderStatsLoading()}
            </div>

            <!-- Compact Inline Filters -->
            <div class="audit-filters-inline">
                <div class="audit-filter-item">
                    <i class="ti ti-user filter-icon"></i>
                    <select id="filter-user" class="filter-select">
                        <option value="">${this.__('auditLog.filters.allUsers')}</option>
                    </select>
                </div>
                <div class="audit-filter-item">
                    <i class="ti ti-bolt filter-icon"></i>
                    <select id="filter-action" class="filter-select">
                        <option value="">${this.__('auditLog.filters.allActions')}</option>
                        <option value="create">${this.__('auditLog.actions.create')}</option>
                        <option value="update">${this.__('auditLog.actions.update')}</option>
                        <option value="delete">${this.__('auditLog.actions.delete')}</option>
                        <option value="login">${this.__('auditLog.actions.login')}</option>
                        <option value="logout">${this.__('auditLog.actions.logout')}</option>
                        <option value="register">${this.__('auditLog.actions.register')}</option>
                        <option value="import">${this.__('auditLog.actions.import')}</option>
                        <option value="export">${this.__('auditLog.actions.export')}</option>
                        <option value="send">${this.__('auditLog.actions.send')}</option>
                        <option value="assign_label">${this.__('auditLog.actions.assign_label')}</option>
                        <option value="unassign_label">${this.__('auditLog.actions.unassign_label')}</option>
                        <option value="approve">${this.__('auditLog.actions.approve')}</option>
                        <option value="reject">${this.__('auditLog.actions.reject')}</option>
                        <option value="archive">${this.__('auditLog.actions.archive')}</option>
                        <option value="restore">${this.__('auditLog.actions.restore')}</option>
                        <option value="sync">${this.__('auditLog.actions.sync')}</option>
                        <option value="render">${this.__('auditLog.actions.render')}</option>
                        <option value="bulk_action">${this.__('auditLog.actions.bulk_action')}</option>
                        <option value="upload">${this.__('auditLog.actions.upload')}</option>
                        <option value="fork">${this.__('auditLog.actions.fork')}</option>
                        <option value="payment_initiated">${this.__('auditLog.actions.payment_initiated')}</option>
                        <option value="payment_completed_3d">${this.__('auditLog.actions.payment_completed_3d')}</option>
                        <option value="seed_data">${this.getActionLabel('seed_data')}</option>
                        <option value="clear_demo_data">${this.getActionLabel('clear_demo_data')}</option>
                        <option value="clear_all_data">${this.getActionLabel('clear_all_data')}</option>
                        <option value="truncate">${this.getActionLabel('truncate')}</option>
                        <option value="cleanup">${this.getActionLabel('cleanup')}</option>
                        <option value="send_report">${this.getActionLabel('send_report')}</option>
                    </select>
                </div>
                <div class="audit-filter-item">
                    <i class="ti ti-database filter-icon"></i>
                    <select id="filter-entity" class="filter-select">
                        <option value="">${this.__('auditLog.filters.allEntities')}</option>
                    </select>
                </div>
                <div class="audit-filter-item date-range">
                    <i class="ti ti-calendar filter-icon"></i>
                    <input type="date" id="filter-date-from" class="filter-input" placeholder="${this.__('auditLog.filters.dateFrom')}">
                    <span class="date-separator">-</span>
                    <input type="date" id="filter-date-to" class="filter-input" placeholder="${this.__('auditLog.filters.dateTo')}">
                </div>
                <div class="audit-filter-actions">
                    <button id="clear-filters-btn" class="btn btn-ghost btn-sm" title="${this.__('auditLog.filters.clear')}">
                        <i class="ti ti-x"></i>
                    </button>
                    <button id="apply-filters-btn" class="btn btn-primary btn-sm">
                        <i class="ti ti-filter"></i>
                        ${this.__('auditLog.filters.apply')}
                    </button>
                </div>
            </div>

            <!-- Logs Table -->
            <div class="card card-table">
                <div id="logs-table"></div>
            </div>
        `;
    }

    renderStatsLoading() {
        return [1, 2, 3, 4].map(() => `
            <div class="analytics-card animate-pulse">
                <div class="analytics-card-header">
                    <div class="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
        `).join('');
    }

    renderStats() {
        const stats = this.stats || {};
        const today = this.todayStats || {};

        return `
            <!-- Today's Activity -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon indigo">
                        <i class="ti ti-calendar-event"></i>
                    </div>
                    <span class="analytics-trend up">
                        <i class="ti ti-clock"></i>
                        ${new Date().toLocaleDateString('tr-TR')}
                    </span>
                </div>
                <p class="analytics-card-label">${this.__('auditLog.stats.today')}</p>
                <p class="analytics-card-value">${this.formatNumber(today.total || 0)}</p>
                <p class="analytics-card-footer highlight">
                    <span class="text-success"><i class="ti ti-plus"></i> ${today.creates || 0}</span>
                    <span class="text-warning ml-2"><i class="ti ti-edit"></i> ${today.updates || 0}</span>
                    <span class="text-danger ml-2"><i class="ti ti-trash"></i> ${today.deletes || 0}</span>
                </p>
            </div>

            <!-- Total Operations -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon blue">
                        <i class="ti ti-list-check"></i>
                    </div>
                </div>
                <p class="analytics-card-label">${this.__('auditLog.stats.total')}</p>
                <p class="analytics-card-value">${this.formatNumber(stats.total || 0)}</p>
                <p class="analytics-card-footer">
                    ${this.__('auditLog.stats.allTime')}
                </p>
            </div>

            <!-- CRUD Operations -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon amber">
                        <i class="ti ti-chart-pie"></i>
                    </div>
                </div>
                <p class="analytics-card-label">${this.__('auditLog.stats.byAction')}</p>
                <p class="analytics-card-value">
                    <span class="text-success">${this.formatNumber(stats.creates || 0)}</span>
                    <span class="analytics-card-value-sep">/</span>
                    <span class="text-warning">${this.formatNumber(stats.updates || 0)}</span>
                    <span class="analytics-card-value-sep">/</span>
                    <span class="text-danger">${this.formatNumber(stats.deletes || 0)}</span>
                </p>
                <p class="analytics-card-footer">
                    ${this.__('auditLog.stats.creates')} / ${this.__('auditLog.stats.updates')} / ${this.__('auditLog.stats.deletes')}
                </p>
            </div>

            <!-- Auth & Other -->
            <div class="analytics-card">
                <div class="analytics-card-header">
                    <div class="analytics-card-icon rose">
                        <i class="ti ti-arrows-exchange"></i>
                    </div>
                </div>
                <p class="analytics-card-label">${this.__('auditLog.stats.otherActions')}</p>
                <p class="analytics-card-value">${this.formatNumber((stats.logins || 0) + (stats.imports || 0) + (stats.sends || 0))}</p>
                <p class="analytics-card-footer">
                    <i class="ti ti-login"></i> ${stats.logins || 0}
                    <i class="ti ti-upload ml-2"></i> ${stats.imports || 0}
                    <i class="ti ti-send ml-2"></i> ${stats.sends || 0}
                </p>
            </div>
        `;
    }

    async init() {
        // Check if user is SuperAdmin
        const user = this.app.state.get('user');
        this.isSuperAdmin = user?.role === 'SuperAdmin';

        this.initDataTable();
        this.bindEvents();
        this.loadArchiveStats();
    }

    initDataTable() {
        const container = document.getElementById('logs-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchLogs(params),
            columns: [
                {
                    key: 'icon',
                    label: '',
                    sortable: false,
                    width: '50px',
                    render: (value, row) => {
                        const icon = this.getActionIcon(row.action);
                        const color = this.getActionColor(row.action);
                        return `
                            <div class="audit-icon-cell" style="--icon-color: ${color}">
                                <i class="ti ti-${icon}"></i>
                            </div>
                        `;
                    }
                },
                {
                    key: 'created_at',
                    label: this.__('auditLog.columns.datetime'),
                    sortable: true,
                    render: (value) => {
                        if (!value) return '-';
                        const date = new Date(value);
                        return `
                            <div class="audit-datetime">
                                <span class="audit-date">${date.toLocaleDateString('tr-TR')}</span>
                                <span class="audit-time">${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        `;
                    }
                },
                {
                    key: 'user_name',
                    label: this.__('auditLog.columns.user'),
                    sortable: true,
                    render: (value) => {
                        const initials = value ? value.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'S';
                        return `
                            <div class="audit-user">
                                <div class="audit-user-avatar">${escapeHTML(initials)}</div>
                                <span class="audit-user-name">${escapeHTML(value || this.__('auditLog.fields.system'))}</span>
                            </div>
                        `;
                    }
                },
                {
                    key: 'action',
                    label: this.__('auditLog.columns.action'),
                    sortable: true,
                    type: 'status',
                    statusConfig: {
                        create: { label: this.__('auditLog.actions.create'), class: 'badge-success' },
                        update: { label: this.__('auditLog.actions.update'), class: 'badge-warning' },
                        delete: { label: this.__('auditLog.actions.delete'), class: 'badge-danger' },
                        login: { label: this.__('auditLog.actions.login'), class: 'badge-info' },
                        logout: { label: this.__('auditLog.actions.logout'), class: 'badge-secondary' },
                        register: { label: this.__('auditLog.actions.register'), class: 'badge-success' },
                        import: { label: this.__('auditLog.actions.import'), class: 'badge-primary' },
                        export: { label: this.__('auditLog.actions.export'), class: 'badge-primary' },
                        send: { label: this.__('auditLog.actions.send'), class: 'badge-info' },
                        view: { label: this.__('auditLog.actions.view'), class: 'badge-secondary' },
                        assign_label: { label: this.__('auditLog.actions.assign_label'), class: 'badge-purple' },
                        unassign_label: { label: this.__('auditLog.actions.unassign_label'), class: 'badge-warning' },
                        remove_label: { label: this.__('auditLog.actions.remove_label'), class: 'badge-danger' },
                        update_label: { label: this.__('auditLog.actions.update_label'), class: 'badge-warning' },
                        approve: { label: this.__('auditLog.actions.approve'), class: 'badge-success' },
                        reject: { label: this.__('auditLog.actions.reject'), class: 'badge-danger' },
                        archive: { label: this.__('auditLog.actions.archive'), class: 'badge-secondary' },
                        restore: { label: this.__('auditLog.actions.restore'), class: 'badge-info' },
                        sync: { label: this.__('auditLog.actions.sync'), class: 'badge-info' },
                        render: { label: this.__('auditLog.actions.render'), class: 'badge-primary' },
                        bulk_action: { label: this.__('auditLog.actions.bulk_action'), class: 'badge-warning' },
                        upload: { label: this.__('auditLog.actions.upload'), class: 'badge-info' },
                        upload_preview: { label: this.__('auditLog.actions.upload_preview'), class: 'badge-info' },
                        delete_preview: { label: this.__('auditLog.actions.delete_preview'), class: 'badge-danger' },
                        fork: { label: this.__('auditLog.actions.fork'), class: 'badge-primary' },
                        payment_initiated: { label: this.__('auditLog.actions.payment_initiated'), class: 'badge-warning' },
                        payment_completed_3d: { label: this.__('auditLog.actions.payment_completed_3d'), class: 'badge-success' },
                        storage_recalculate: { label: this.__('auditLog.actions.storage_recalculate'), class: 'badge-info' },
                        seed_data: { label: this.getActionLabel('seed_data'), class: 'badge-success' },
                        clear_demo_data: { label: this.getActionLabel('clear_demo_data'), class: 'badge-warning' },
                        clear_all_data: { label: this.getActionLabel('clear_all_data'), class: 'badge-danger' },
                        truncate: { label: this.getActionLabel('truncate'), class: 'badge-warning' },
                        cleanup: { label: this.getActionLabel('cleanup'), class: 'badge-info' },
                        send_report: { label: this.getActionLabel('send_report'), class: 'badge-primary' }
                    },
                    render: (value) => {
                        // Fallback for unknown actions
                        const config = this.dataTable?.options?.columns?.find(c => c.key === 'action')?.statusConfig;
                        if (config && config[value]) {
                            return `<span class="badge ${config[value].class}">${escapeHTML(config[value].label)}</span>`;
                        }
                        // Unknown action fallback: show readable action key.
                        return `<span class="badge badge-secondary">${escapeHTML(this.getActionLabel(value))}</span>`;
                    }
                },
                {
                    key: 'entity_type',
                    label: this.__('auditLog.columns.entity'),
                    sortable: true,
                    render: (value) => {
                        const icon = this.getEntityIcon(value);
                        const label = this.getEntityLabel(value);
                        return `
                            <div class="audit-entity">
                                <i class="ti ti-${icon}"></i>
                                <span>${escapeHTML(label)}</span>
                            </div>
                        `;
                    }
                },
                {
                    key: 'ip_address',
                    label: this.__('auditLog.columns.ip'),
                    sortable: true,
                    render: (value) => {
                        // ::1 ve 127.0.0.1 localhost olarak göster
                        let displayValue = value || '-';
                        if (value === '::1' || value === '127.0.0.1') {
                            displayValue = 'localhost';
                        }
                        return `<code class="audit-ip" title="${escapeHTML(value || '')}">${escapeHTML(displayValue)}</code>`;
                    }
                }
            ],
            actions: [
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('auditLog.actions.view'),
                    onClick: (row) => this.showDetails(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            defaultSort: {
                key: 'created_at',
                direction: 'desc'
            },
            searchPlaceholder: this.__('auditLog.searchPlaceholder'),
            emptyText: this.__('auditLog.emptyText'),
            emptyIcon: 'ti-history',
            exportFilename: 'islem-gecmisi',
            exportTitle: this.__('auditLog.title')
        });
    }

    async fetchLogs(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            // Add custom filters
            if (this.filters.user) queryParams.append('user_id', this.filters.user);
            if (this.filters.action) queryParams.append('action', this.filters.action);
            if (this.filters.entity) queryParams.append('entity_type', this.filters.entity);
            if (this.filters.dateFrom) queryParams.append('date_from', this.filters.dateFrom);
            if (this.filters.dateTo) queryParams.append('date_to', this.filters.dateTo);

            const response = await this.app.api.get(`/audit-logs?${queryParams}`);

            // Update stats from API response
            if (response.stats) {
                this.stats = response.stats;
            }
            if (response.today) {
                this.todayStats = response.today;
            }

            // Update stats display
            const statsContainer = document.getElementById('stats-container');
            if (statsContainer && (response.stats || response.today)) {
                statsContainer.innerHTML = this.renderStats();
            }

            // Populate filter dropdowns on first load
            if (response.filters) {
                this.populateFilterDropdowns(response.filters);
            }

            // Handle both formats: response.data or direct array
            const data = Array.isArray(response.data) ? response.data :
                         Array.isArray(response) ? response : [];
            const total = response.meta?.total || data.length;

            return {
                data: data,
                total: total
            };
        } catch (error) {
            Logger.error('Audit logs fetch error:', error);
            Toast.error(this.__('auditLog.messages.loadError') + ': ' + (error.message || ''));
            return { data: [], total: 0 };
        }
    }

    populateFilterDropdowns(filters) {
        // Populate entity/resource dropdown
        if (filters.resources && filters.resources.length > 0) {
            const entitySelect = document.getElementById('filter-entity');
            if (entitySelect && entitySelect.options.length <= 1) {
                filters.resources.forEach(resource => {
                    const option = document.createElement('option');
                    option.value = resource;
                    option.textContent = this.getEntityLabel(resource);
                    entitySelect.appendChild(option);
                });
            }
        }

        // Populate users dropdown
        if (filters.users && filters.users.length > 0) {
            const userSelect = document.getElementById('filter-user');
            if (userSelect && userSelect.options.length <= 1) {
                filters.users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.user_id;
                    option.textContent = user.user_name || this.__('auditLog.fields.system');
                    userSelect.appendChild(option);
                });
            }
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    bindEvents() {
        document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        document.getElementById('refresh-logs-btn')?.addEventListener('click', () => {
            this.dataTable?.refresh();
            Toast.info(this.__('auditLog.messages.refreshing'));
        });

        // Archive button
        document.getElementById('archive-btn')?.addEventListener('click', () => {
            this.showArchiveModal();
        });

        // Enter key on filters
        ['filter-date-from', 'filter-date-to'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        });
    }

    async loadArchiveStats() {
        try {
            const response = await this.app.api.get('/audit-logs/archive/stats');
            if (response.success) {
                this.archiveStats = response.data;
            }
        } catch (error) {
            Logger.error('Archive stats load error:', error);
        }
    }

    showArchiveModal() {
        const stats = this.archiveStats || {};
        const protectionDate = stats.protection_date ?
            new Date(stats.protection_date).toLocaleDateString('tr-TR') : '-';

        const content = `
            <div class="archive-modal-content">
                <div class="archive-stats-grid">
                    <div class="archive-stat-item">
                        <div class="archive-stat-icon blue">
                            <i class="ti ti-list-check"></i>
                        </div>
                        <div class="archive-stat-info">
                            <span class="archive-stat-value">${stats.total || 0}</span>
                            <span class="archive-stat-label">${this.__('auditLog.archive.stats.total')}</span>
                        </div>
                    </div>
                    <div class="archive-stat-item">
                        <div class="archive-stat-icon green">
                            <i class="ti ti-shield-check"></i>
                        </div>
                        <div class="archive-stat-info">
                            <span class="archive-stat-value">${stats.protected || 0}</span>
                            <span class="archive-stat-label">${this.__('auditLog.archive.stats.protected')}</span>
                        </div>
                    </div>
                    <div class="archive-stat-item">
                        <div class="archive-stat-icon amber">
                            <i class="ti ti-archive"></i>
                        </div>
                        <div class="archive-stat-info">
                            <span class="archive-stat-value">${stats.archivable || 0}</span>
                            <span class="archive-stat-label">${this.__('auditLog.archive.stats.archivable')}</span>
                        </div>
                    </div>
                    <div class="archive-stat-item">
                        <div class="archive-stat-icon gray">
                            <i class="ti ti-box"></i>
                        </div>
                        <div class="archive-stat-info">
                            <span class="archive-stat-value">${stats.archived || 0}</span>
                            <span class="archive-stat-label">${this.__('auditLog.archive.stats.archived')}</span>
                        </div>
                    </div>
                </div>

                <div class="archive-info-box">
                    <i class="ti ti-info-circle"></i>
                    <div>
                        <p><strong>${this.__('auditLog.archive.protectionInfo')}</strong></p>
                        <p>${this.__('auditLog.archive.protectionDate', { date: protectionDate })}</p>
                    </div>
                </div>

                <div class="archive-actions">
                    <h4>${this.__('auditLog.archive.actions')}</h4>

                    <div class="archive-action-item">
                        <div class="archive-action-info">
                            <i class="ti ti-archive text-amber"></i>
                            <div>
                                <strong>${this.__('auditLog.archive.archiveOld')}</strong>
                                <p>${this.__('auditLog.archive.archiveOldDesc')}</p>
                            </div>
                        </div>
                        <button class="btn btn-outline btn-sm" id="archive-old-btn" ${stats.archivable === 0 ? 'disabled' : ''}>
                            <i class="ti ti-archive"></i>
                            ${this.__('auditLog.archive.archiveButton')}
                        </button>
                    </div>

                    ${this.isSuperAdmin ? `
                        <div class="archive-action-item danger">
                            <div class="archive-action-info">
                                <i class="ti ti-trash text-danger"></i>
                                <div>
                                    <strong>${this.__('auditLog.archive.deleteArchived')}</strong>
                                    <p>${this.__('auditLog.archive.deleteArchivedDesc')}</p>
                                </div>
                            </div>
                            <button class="btn btn-danger btn-sm" id="delete-archived-btn" ${stats.archived === 0 ? 'disabled' : ''}>
                                <i class="ti ti-trash"></i>
                                ${this.__('auditLog.archive.deleteButton')}
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: this.__('auditLog.archive.title'),
            icon: 'ti-archive',
            content: content,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('modal.close')
        });

        // Bind archive action buttons
        setTimeout(() => {
            document.getElementById('archive-old-btn')?.addEventListener('click', async () => {
                await this.archiveOldLogs();
                Modal.close(modal.id);
            });

            document.getElementById('delete-archived-btn')?.addEventListener('click', async () => {
                await this.deleteArchivedLogs();
                Modal.close(modal.id);
            });
        }, 100);
    }

    async archiveOldLogs() {
        const confirmResult = await Modal.confirm({
            title: this.__('auditLog.archive.confirmArchive'),
            message: this.__('auditLog.archive.confirmArchiveMsg'),
            type: 'warning',
            confirmText: this.__('auditLog.archive.archiveButton'),
            cancelText: this.__('modal.cancel')
        });

        if (!confirmResult) return;

        try {
            const response = await this.app.api.post('/audit-logs/archive', {});

            if (response.success) {
                Toast.success(this.__('auditLog.archive.archiveSuccess', {
                    count: response.data?.archived || 0
                }));
                this.dataTable?.refresh();
                this.loadArchiveStats();
            } else {
                Toast.error(response.message || this.__('auditLog.archive.archiveError'));
            }
        } catch (error) {
            Logger.error('Archive error:', error);
            Toast.error(this.__('auditLog.archive.archiveError') + ': ' + (error.message || ''));
        }
    }

    async deleteArchivedLogs() {
        const confirmResult = await Modal.confirm({
            title: this.__('auditLog.archive.confirmDelete'),
            message: this.__('auditLog.archive.confirmDeleteMsg'),
            type: 'danger',
            confirmText: this.__('auditLog.archive.deleteButton'),
            cancelText: this.__('modal.cancel')
        });

        if (!confirmResult) return;

        try {
            const response = await this.app.api.post('/audit-logs/delete', {
                delete_archived: true
            });

            if (response.success) {
                Toast.success(this.__('auditLog.archive.deleteSuccess', {
                    count: response.data?.deleted || 0
                }));
                this.dataTable?.refresh();
                this.loadArchiveStats();
            } else {
                Toast.error(response.message || this.__('auditLog.archive.deleteError'));
            }
        } catch (error) {
            Logger.error('Delete error:', error);
            Toast.error(this.__('auditLog.archive.deleteError') + ': ' + (error.message || ''));
        }
    }

    applyFilters() {
        this.filters = {
            user: document.getElementById('filter-user')?.value || '',
            action: document.getElementById('filter-action')?.value || '',
            entity: document.getElementById('filter-entity')?.value || '',
            dateFrom: document.getElementById('filter-date-from')?.value || '',
            dateTo: document.getElementById('filter-date-to')?.value || ''
        };
        this.dataTable?.refresh();
    }

    clearFilters() {
        document.getElementById('filter-user').value = '';
        document.getElementById('filter-action').value = '';
        document.getElementById('filter-entity').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        this.filters = { user: '', action: '', entity: '', dateFrom: '', dateTo: '' };
        this.dataTable?.refresh();
    }

    humanizeValue(value) {
        if (!value) return '-';
        return String(value)
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    getActionLabel(action) {
        const key = `auditLog.actions.${action}`;
        const translated = this.__(key);
        if (translated !== key) return translated;
        return this.humanizeValue(action);
    }

    getActionIcon(action) {
        const icons = {
            'create': 'plus',
            'update': 'edit',
            'delete': 'trash',
            'login': 'login',
            'logout': 'logout',
            'register': 'user-plus',
            'import': 'upload',
            'export': 'download',
            'send': 'send',
            'view': 'eye',
            'assign_label': 'tag',
            'unassign_label': 'tag-off',
            'remove_label': 'tag-off',
            'update_label': 'tag',
            'approve': 'check',
            'reject': 'x',
            'archive': 'archive',
            'restore': 'restore',
            'sync': 'refresh',
            'render': 'photo',
            'bulk_action': 'list-check',
            'upload': 'cloud-upload',
            'upload_preview': 'photo-up',
            'delete_preview': 'photo-x',
            'fork': 'git-fork',
            'payment_initiated': 'credit-card',
            'payment_completed_3d': 'credit-card-pay',
            'storage_recalculate': 'database',
            'seed_data': 'database-plus',
            'clear_demo_data': 'eraser',
            'clear_all_data': 'trash-x',
            'truncate': 'file-off',
            'cleanup': 'broom',
            'send_report': 'send-2',
            'bt_password_set': 'bluetooth',
            'bt_password_removed': 'bluetooth-off',
            'network_config': 'network',
            'clear_device_content': 'device-desktop-off',
            'render_invalidation': 'refresh-alert',
            'login_failed': 'login-2',
            'seed': 'database-plus',
            'seed_demo_data': 'database-plus',
            'send_to_device': 'send',
            'device_info': 'info-circle',
            'web_template_created': 'template',
            'web_template_updated': 'template',
            'web_template_deleted': 'template-off',
            'web_templates_bulk_deleted': 'template-off',
            'clear_demo_data': 'eraser',
            'clear_all_data': 'trash-x'
        };
        return icons[action] || 'activity';
    }

    getActionColor(action) {
        const colors = {
            'create': '#40c057',
            'update': '#fab005',
            'delete': '#fa5252',
            'login': '#228be6',
            'logout': '#868e96',
            'register': '#40c057',
            'import': '#7950f2',
            'export': '#7950f2',
            'send': '#228be6',
            'view': '#868e96',
            'assign_label': '#9c36b5',
            'unassign_label': '#fab005',
            'remove_label': '#fa5252',
            'update_label': '#fab005',
            'approve': '#40c057',
            'reject': '#fa5252',
            'archive': '#868e96',
            'restore': '#228be6',
            'sync': '#228be6',
            'render': '#7950f2',
            'bulk_action': '#fab005',
            'upload': '#228be6',
            'upload_preview': '#228be6',
            'delete_preview': '#fa5252',
            'fork': '#7950f2',
            'payment_initiated': '#fab005',
            'payment_completed_3d': '#40c057',
            'storage_recalculate': '#228be6',
            'seed_data': '#40c057',
            'clear_demo_data': '#fab005',
            'clear_all_data': '#fa5252',
            'truncate': '#fd7e14',
            'cleanup': '#228be6',
            'send_report': '#7950f2',
            'bt_password_set': '#228be6',
            'bt_password_removed': '#fa5252',
            'network_config': '#228be6',
            'clear_device_content': '#fa5252',
            'render_invalidation': '#fd7e14',
            'login_failed': '#fa5252',
            'seed': '#40c057',
            'seed_demo_data': '#40c057',
            'send_to_device': '#228be6',
            'device_info': '#868e96',
            'web_template_created': '#40c057',
            'web_template_updated': '#fab005',
            'web_template_deleted': '#fa5252',
            'web_templates_bulk_deleted': '#fa5252'
        };
        return colors[action] || '#868e96';
    }

    getEntityIcon(entity) {
        const icons = {
            'product': 'package',
            'products': 'package',
            'Products': 'package',
            'template': 'template',
            'templates': 'template',
            'Templates': 'template',
            'device': 'device-desktop',
            'devices': 'device-desktop',
            'Devices': 'device-desktop',
            'device_group': 'folders',
            'Device_group': 'folders',
            'device_groups': 'folders',
            'user': 'user',
            'users': 'users',
            'Users': 'users',
            'playlist': 'playlist',
            'playlists': 'playlist',
            'schedule': 'calendar',
            'schedules': 'calendar',
            'media': 'photo',
            'settings': 'settings',
            'Settings': 'settings',
            'payment_settings': 'credit-card',
            'Payment_settings': 'credit-card',
            'company': 'building',
            'companies': 'building',
            'license': 'license',
            'licenses': 'license',
            'category': 'category',
            'categories': 'category',
            'notification': 'bell',
            'notifications': 'bell',
            'session': 'key',
            'auth': 'shield',
            'audit_logs': 'history',
            'setup': 'settings-cog',
            'system_logs': 'file-text',
            'logs': 'file-text'
        };
        return icons[entity] || 'file';
    }

    getEntityLabel(entity) {
        const key = `auditLog.entities.${entity}`;
        const translated = this.__(key);
        if (translated !== key) return translated;

        return this.humanizeValue(entity);
    }

    formatIpAddress(ip) {
        if (!ip) return '-';
        // Convert localhost variants to readable format
        if (ip === '::1' || ip === '127.0.0.1') {
            return 'localhost';
        }
        return ip;
    }

    showDetails(log) {
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        };

        const getActionBadge = (action) => {
            const badges = {
                'create': 'badge-success',
                'update': 'badge-warning',
                'delete': 'badge-danger',
                'login': 'badge-info',
                'logout': 'badge-secondary',
                'import': 'badge-primary',
                'export': 'badge-primary',
                'send': 'badge-info',
                'seed_data': 'badge-success',
                'clear_demo_data': 'badge-warning',
                'clear_all_data': 'badge-danger',
                'truncate': 'badge-warning',
                'cleanup': 'badge-info',
                'send_report': 'badge-primary'
            };
            return badges[action] || 'badge-secondary';
        };

        // Parse JSON data safely
        const parseData = (data) => {
            if (!data) return null;
            if (typeof data === 'object') return data;
            try {
                return JSON.parse(data);
            } catch {
                return data;
            }
        };

        const oldData = parseData(log.old_data);
        const newData = parseData(log.new_data);
        const hasChanges = oldData || newData;

        const content = `
            <div class="audit-detail-content">
                <div class="audit-detail-grid">
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.datetime')}</label>
                        <span>${formatDate(log.created_at)}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.user')}</label>
                        <span>${escapeHTML(log.user_name || this.__('auditLog.fields.system'))}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.action')}</label>
                        <span class="badge ${getActionBadge(log.action)}">${escapeHTML(this.getActionLabel(log.action))}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.entityType')}</label>
                        <span>${escapeHTML(this.getEntityLabel(log.entity_type))}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.entity')}</label>
                        <span>${escapeHTML(log.entity_name ? log.entity_name : (log.entity_id && log.entity_id !== 'null' && log.entity_id !== '' ? log.entity_id : '-'))}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('auditLog.fields.ipAddress')}</label>
                        <code>${escapeHTML(this.formatIpAddress(log.ip_address))}</code>
                    </div>
                </div>
                ${hasChanges ? `
                    <div class="audit-detail-changes">
                        <label>${this.__('auditLog.fields.changes')}</label>
                        <div class="audit-changes-grid">
                            <div class="audit-change-box old">
                                <span class="audit-change-label">${this.__('auditLog.fields.oldValue')}</span>
                                <pre>${escapeHTML(oldData ? JSON.stringify(oldData, null, 2) : '-')}</pre>
                            </div>
                            <div class="audit-change-box new">
                                <span class="audit-change-label">${this.__('auditLog.fields.newValue')}</span>
                                <pre>${escapeHTML(newData ? JSON.stringify(newData, null, 2) : '-')}</pre>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('auditLog.detail'),
            icon: 'ti-history',
            content: content,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('modal.close')
        });
    }

    destroy() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default AuditLogPage;
