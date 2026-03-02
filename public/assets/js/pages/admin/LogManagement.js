/**
 * Log Management Page - SuperAdmin Only
 * View, filter, cleanup, and report system log files
 *
 * @version 2.0.0
 */
import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';
import { DataTable } from '../../components/DataTable.js';

export class LogManagementPage {
    constructor(app) {
        this.app = app;
        this.logFiles = [];
        this.fileDataTable = null;
        this.notifySettings = null;
        this.activeTab = 'files';
        this.activeTypeFilter = 'all';

        // Multi-tab viewer state: Map<filename, {page, perPage, total, totalPages, levelFilter, search, levelStats, lines}>
        this.openFiles = new Map();
        this.activeFile = null;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('admin');
    }

    render() {
        return `
            <!-- Page Header -->
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('logManagement.breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">&rsaquo;</span>
                    <a href="#/admin/users">${this.__('logManagement.breadcrumb.admin')}</a>
                    <span class="breadcrumb-separator">&rsaquo;</span>
                    <span class="breadcrumb-current">${this.__('logManagement.breadcrumb.current')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon amber">
                            <i class="ti ti-file-text"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('logManagement.title')}</h1>
                            <p class="page-subtitle">${this.__('logManagement.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="btn-cleanup-old" class="btn btn-outline">
                            <i class="ti ti-trash"></i>
                            ${this.__('logManagement.actions.cleanupOld')}
                        </button>
                        <button id="btn-refresh" class="btn btn-primary">
                            <i class="ti ti-refresh"></i>
                            ${this.__('logManagement.actions.refresh')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Cards (setup-wizard style) -->
            <div class="setup-status-grid" id="log-stats">
                <div class="setup-status-card">
                    <div class="status-card-icon blue">
                        <i class="ti ti-files"></i>
                    </div>
                    <div class="status-card-info">
                        <span class="status-card-value" id="stat-total-files">-</span>
                        <span class="status-card-label">${this.__('logManagement.stats.totalFiles')}</span>
                    </div>
                </div>
                <div class="setup-status-card">
                    <div class="status-card-icon orange">
                        <i class="ti ti-database"></i>
                    </div>
                    <div class="status-card-info">
                        <span class="status-card-value" id="stat-total-size">-</span>
                        <span class="status-card-label">${this.__('logManagement.stats.totalSize')}</span>
                    </div>
                </div>
                <div class="setup-status-card">
                    <div class="status-card-icon red">
                        <i class="ti ti-alert-triangle"></i>
                    </div>
                    <div class="status-card-info">
                        <span class="status-card-value" id="stat-error-size">-</span>
                        <span class="status-card-label">${this.__('logManagement.stats.errorFile')}</span>
                    </div>
                </div>
                <div class="setup-status-card">
                    <div class="status-card-icon green">
                        <i class="ti ti-clock"></i>
                    </div>
                    <div class="status-card-info">
                        <span class="status-card-value" id="stat-last-activity">-</span>
                        <span class="status-card-label">${this.__('logManagement.stats.lastActivity')}</span>
                    </div>
                </div>
            </div>

            <!-- Page Tabs -->
            <div class="page-tabs" id="log-page-tabs">
                <button class="page-tab active" data-tab="files">
                    <i class="ti ti-files"></i>
                    ${this.__('logManagement.tabs.files')}
                </button>
                <!-- Dynamic viewer tabs will be inserted here -->
                <span id="viewer-tabs-anchor"></span>
                <button class="page-tab" data-tab="notifications">
                    <i class="ti ti-bell"></i>
                    ${this.__('logManagement.tabs.notifications')}
                </button>
            </div>

            <!-- Tab: File List -->
            <div class="tab-content" id="tab-files">
                <div class="card">
                    <!-- Type Filter -->
                    <div class="audit-filters-inline log-type-filter-bar">
                        <div class="audit-filter-item">
                            <i class="ti ti-filter filter-icon"></i>
                            <select id="filter-type" class="filter-select">
                                <option value="all">${this.__('logManagement.types.all')}</option>
                                <option value="error">${this.__('logManagement.types.error')}</option>
                                <option value="general">${this.__('logManagement.types.general')}</option>
                                <option value="audit">${this.__('logManagement.types.audit')}</option>
                                <option value="debug">${this.__('logManagement.types.debug')}</option>
                                <option value="integration">${this.__('logManagement.types.integration')}</option>
                                <option value="render">${this.__('logManagement.types.render')}</option>
                                <option value="device">${this.__('logManagement.types.device')}</option>
                            </select>
                        </div>
                        <div class="audit-filter-actions">
                            <button id="clear-type-filter" class="btn btn-ghost btn-sm" title="${this.__('logManagement.actions.clearFilter')}">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>
                    </div>

                    <div id="files-table"></div>
                </div>
            </div>

            <!-- Tab: Log Viewer (shared content area, switches per active file) -->
            <div class="tab-content" id="tab-viewer" style="display: none;">
                <div class="card">
                    <div id="log-viewer-content">
                        <p class="text-muted">${this.__('logManagement.viewer.selectFile')}</p>
                    </div>
                </div>
            </div>

            <!-- Tab: Notification Settings -->
            <div class="tab-content" id="tab-notifications" style="display: none;">
                <div id="notify-settings-content">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        this.bindEvents();
        await this.loadFiles();
    }

    bindEvents() {
        // Tab navigation (delegated on tab container for dynamic tabs)
        document.getElementById('log-page-tabs')?.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.log-tab-close');
            if (closeBtn) {
                e.stopPropagation();
                const filename = closeBtn.dataset.closeFile;
                if (filename) this.closeViewerTab(filename);
                return;
            }
            const tabBtn = e.target.closest('.page-tab');
            if (tabBtn) {
                const tab = tabBtn.dataset.tab;
                const file = tabBtn.dataset.file;
                if (tab === 'viewer' && file) {
                    this.switchToFile(file);
                } else if (tab) {
                    this.switchTab(tab);
                }
            }
        });

        // Refresh
        document.getElementById('btn-refresh')?.addEventListener('click', () => this.loadFiles());

        // Cleanup old
        document.getElementById('btn-cleanup-old')?.addEventListener('click', () => this.showCleanupDialog());

        // Type filter select
        document.getElementById('filter-type')?.addEventListener('change', (e) => {
            this.activeTypeFilter = e.target.value;
            this.filterByType(this.activeTypeFilter);
        });

        // Clear filter
        document.getElementById('clear-type-filter')?.addEventListener('click', () => {
            document.getElementById('filter-type').value = 'all';
            this.activeTypeFilter = 'all';
            this.filterByType('all');
        });
    }

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.page-tab').forEach(b => b.classList.remove('active'));
        document.querySelector(`.page-tab[data-tab="${tab}"]:not([data-file])`)?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        const tabContent = document.getElementById(`tab-${tab}`);
        if (tabContent) tabContent.style.display = 'block';

        if (tab === 'notifications' && !this.notifySettings) {
            this.loadNotifySettings();
        }
    }

    switchToFile(filename) {
        if (!this.openFiles.has(filename)) return;

        this.activeFile = filename;
        this.activeTab = 'viewer';

        // Re-render tabs to update active state
        this._renderViewerTabs();

        // Show viewer content
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.getElementById('tab-viewer').style.display = 'block';

        // Render this file's cached content (no API call if already loaded)
        const state = this._getFileState();
        if (state && state.lines.length > 0) {
            this.renderViewer();
        } else {
            this.loadLogContent();
        }
    }

    async loadFiles() {
        try {
            const response = await this.app.api.get('/logs');
            if (response.success) {
                this.logFiles = response.data.files;
                this.renderStats(response.data);
                this.renderFileTable();
            }
        } catch (err) {
            Toast.error(this.__('logManagement.toast.loadError'));
        }
    }

    renderStats(data) {
        document.getElementById('stat-total-files').textContent = data.total_files || 0;
        document.getElementById('stat-total-size').textContent = data.total_size_formatted || '0 B';

        const errorFile = data.files.find(f => f.filename === 'error.log');
        document.getElementById('stat-error-size').textContent = errorFile ? errorFile.size_formatted : '0 B';

        if (data.files.length > 0) {
            const newest = data.files[0];
            document.getElementById('stat-last-activity').textContent = this.formatRelativeTime(newest.modified_at);
        }
    }

    renderFileTable() {
        if (this.fileDataTable) {
            this.fileDataTable.destroy?.();
        }

        this.fileDataTable = new DataTable({
            container: '#files-table',
            columns: [
                {
                    key: 'icon',
                    label: '',
                    sortable: false,
                    preview: true,
                    render: (val, row) => {
                        const icon = this.getTypeIcon(row.type);
                        const cls = this.getTypeColorClass(row.type);
                        return `<div class="data-table-icon-cell">
                            <div class="log-file-icon ${cls}">
                                <i class="ti ${icon}"></i>
                            </div>
                        </div>`;
                    }
                },
                {
                    key: 'filename',
                    label: this.__('logManagement.columns.filename'),
                    sortable: true,
                    title: true,
                    render: (val, row) => {
                        return `<div>
                            <div style="font-weight:500;">${this.escapeHtml(val)}</div>
                            <div class="text-muted text-xs">${this.getTypeLabel(row.type)}${row.is_rotated ? ` (${this.__('logManagement.labels.rotated')})` : ''}</div>
                        </div>`;
                    }
                },
                {
                    key: 'size_formatted',
                    label: this.__('logManagement.columns.size'),
                    sortable: true,
                    render: (val, row) => {
                        const cls = row.size > 10485760 ? 'text-danger font-semibold' : row.size > 1048576 ? 'text-warning' : '';
                        return `<span class="${cls}">${val}</span>`;
                    }
                },
                {
                    key: 'line_count',
                    label: this.__('logManagement.columns.lines'),
                    sortable: true,
                    render: (val) => val ? val.toLocaleString() : '0'
                },
                {
                    key: 'modified_at',
                    label: this.__('logManagement.columns.modified'),
                    sortable: true,
                    render: (val) => `<span title="${val}">${this.formatRelativeTime(val)}</span>`
                },
                {
                    key: 'levels',
                    label: this.__('logManagement.columns.levels'),
                    render: (val) => {
                        if (!val) return '-';
                        const badges = [];
                        if (val.critical > 0) badges.push(`<span class="badge badge-danger">${val.critical} ${this.__('logManagement.levels.critical')}</span>`);
                        if (val.error > 0) badges.push(`<span class="badge badge-danger">${val.error} ${this.__('logManagement.levels.error')}</span>`);
                        if (val.warning > 0) badges.push(`<span class="badge badge-warning">${val.warning} ${this.__('logManagement.levels.warn')}</span>`);
                        if (val.info > 0) badges.push(`<span class="badge badge-info">${val.info} ${this.__('logManagement.levels.info')}</span>`);
                        return badges.length > 0 ? badges.join(' ') : '<span class="text-muted">-</span>';
                    }
                }
            ],
            actions: [
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('logManagement.actions.view'),
                    onClick: (row) => this.viewLogFile(row.filename)
                },
                {
                    name: 'download',
                    icon: 'ti-download',
                    label: this.__('logManagement.actions.download'),
                    onClick: (row) => this.downloadFile(row.filename)
                },
                {
                    name: 'truncate',
                    icon: 'ti-eraser',
                    label: this.__('logManagement.actions.truncate'),
                    onClick: (row) => this.truncateFile(row.filename)
                },
                {
                    name: 'more',
                    icon: 'ti-dots-vertical',
                    label: this.__('logManagement.actions.more'),
                    onClick: (row) => this.showFileActions(row)
                }
            ],
            rowKey: 'filename',
            pagination: false,
            searchable: true,
            searchPlaceholder: this.__('logManagement.search'),
            emptyText: this.__('logManagement.emptyText'),
            selectable: true,
            onSelectionChange: (selected) => this.handleSelection(selected)
        });

        this.fileDataTable.setData(this.logFiles);
    }

    filterByType(type) {
        if (type === 'all') {
            this.fileDataTable.setData(this.logFiles);
        } else {
            const filtered = this.logFiles.filter(f => f.type === type);
            this.fileDataTable.setData(filtered);
        }
    }

    handleSelection(selected) {
        // Bulk actions could be added here
    }

    // ==================== File Actions (More Menu) ====================

    showFileActions(row) {
        const content = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="archive-action-item">
                    <div class="archive-action-info">
                        <i class="ti ti-send text-info"></i>
                        <div>
                            <strong>${this.__('logManagement.actions.sendReport')}</strong>
                            <p>${this.__('logManagement.actions.sendReportDesc')}</p>
                        </div>
                    </div>
                    <button class="btn btn-outline btn-sm" data-file-action="report">
                        <i class="ti ti-send"></i>
                    </button>
                </div>

                <div class="archive-action-item danger">
                    <div class="archive-action-info">
                        <i class="ti ti-trash text-danger"></i>
                        <div>
                            <strong>${this.__('logManagement.actions.delete')}</strong>
                            <p>${this.__('logManagement.actions.deleteDesc')}</p>
                        </div>
                    </div>
                    <button class="btn btn-danger btn-sm" data-file-action="delete">
                        <i class="ti ti-trash"></i>
                    </button>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: `${row.filename}`,
            icon: 'ti-file-text',
            content,
            size: 'sm',
            confirmText: null,
            cancelText: this.__('actions.close'),
            onConfirm: null
        });

        // Bind action buttons after modal renders
        setTimeout(() => {
            document.querySelectorAll('[data-file-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.fileAction;
                    // Close current modal
                    if (modal && modal.close) {
                        modal.close();
                    } else {
                        Modal.closeAll();
                    }
                    // Execute action after modal closes
                    setTimeout(() => {
                        if (action === 'report') this.showReportDialog(row.filename);
                        else if (action === 'delete') this.deleteFile(row.filename);
                    }, 200);
                });
            });
        }, 100);
    }

    closeViewerTab(filename) {
        this.openFiles.delete(filename);

        // Remove tab button
        document.querySelector(`.page-tab[data-file="${CSS.escape(filename)}"]`)?.remove();

        // If we closed the active file, switch to another open file or back to files list
        if (this.activeFile === filename) {
            this.activeFile = null;
            if (this.openFiles.size > 0) {
                // Switch to the last opened file
                const lastFile = [...this.openFiles.keys()].pop();
                this.switchToFile(lastFile);
            } else {
                this.switchTab('files');
            }
        }
    }

    // ==================== Log Viewer ====================

    _createFileState() {
        return {
            page: 1,
            perPage: 100,
            total: 0,
            totalPages: 0,
            levelFilter: 'all',
            search: '',
            levelStats: {},
            lines: []
        };
    }

    _getFileState() {
        return this.openFiles.get(this.activeFile);
    }

    _renderViewerTabs() {
        // Remove existing viewer tab buttons
        document.querySelectorAll('.page-tab[data-tab="viewer"]').forEach(el => el.remove());

        const anchor = document.getElementById('viewer-tabs-anchor');
        if (!anchor) return;

        // Insert tab buttons for each open file
        this.openFiles.forEach((state, filename) => {
            const isActive = this.activeFile === filename && this.activeTab === 'viewer';
            const logFile = this.logFiles.find(f => f.filename === filename);
            const icon = logFile ? this.getTypeIcon(logFile.type) : 'ti-file-text';
            const colorClass = logFile ? this.getTypeColorClass(logFile.type) : '';

            const btn = document.createElement('button');
            btn.className = `page-tab${isActive ? ' active' : ''}`;
            btn.dataset.tab = 'viewer';
            btn.dataset.file = filename;
            btn.innerHTML = `
                <i class="ti ${icon}" ${colorClass ? `style="color: var(--color-${colorClass}, inherit)"` : ''}></i>
                <span>${this.escapeHtml(filename)}</span>
                <span class="log-tab-close" data-close-file="${this.escapeHtml(filename)}" title="${this.__('actions.close')}"><i class="ti ti-x"></i></span>
            `;
            anchor.before(btn);
        });
    }

    async viewLogFile(filename) {
        // Create state for this file if not already open
        if (!this.openFiles.has(filename)) {
            this.openFiles.set(filename, this._createFileState());
        }

        this.activeFile = filename;

        // Render all viewer tabs
        this._renderViewerTabs();

        // Show viewer content
        this.activeTab = 'viewer';
        document.querySelectorAll('.page-tab').forEach(b => b.classList.remove('active'));
        document.querySelector(`.page-tab[data-file="${CSS.escape(filename)}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.getElementById('tab-viewer').style.display = 'block';

        await this.loadLogContent();
    }

    async loadLogContent() {
        const state = this._getFileState();
        if (!state || !this.activeFile) return;

        const container = document.getElementById('log-viewer-content');
        container.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div></div>';

        try {
            const params = new URLSearchParams({
                file: this.activeFile,
                page: state.page,
                per_page: state.perPage,
                level: state.levelFilter,
                search: state.search,
                order: 'desc'
            });

            const response = await this.app.api.get(`/logs/read?${params}`);
            if (response.success) {
                state.lines = response.data.lines;
                state.total = response.data.total;
                state.totalPages = response.data.total_pages;
                state.levelStats = response.data.level_stats || {};
                this.renderViewer();
            }
        } catch (err) {
            container.innerHTML = `<p class="text-danger">${this.__('logManagement.toast.loadError')}</p>`;
        }
    }

    renderViewer() {
        const state = this._getFileState();
        if (!state) return;

        const container = document.getElementById('log-viewer-content');

        container.innerHTML = `
            <!-- Viewer Toolbar -->
            <div class="audit-filters-inline" style="margin-bottom:16px;">
                <div class="audit-filter-item">
                    <i class="ti ti-filter filter-icon"></i>
                    <select id="viewer-level-select" class="filter-select">
                        <option value="all" ${state.levelFilter === 'all' ? 'selected' : ''}>${this.__('logManagement.types.all')}</option>
                        ${Object.entries(state.levelStats).map(([level, count]) =>
                            count > 0 ? `<option value="${level.toLowerCase()}" ${state.levelFilter === level.toLowerCase() ? 'selected' : ''}>${level} (${count})</option>` : ''
                        ).filter(Boolean).join('')}
                    </select>
                </div>
                <div class="audit-filter-item">
                    <i class="ti ti-search filter-icon"></i>
                    <input type="text" id="viewer-search" class="filter-input" placeholder="${this.__('logManagement.viewer.searchPlaceholder')}" value="${this.escapeHtml(state.search)}" style="min-width:180px;">
                </div>
                <div class="audit-filter-actions">
                    <button id="viewer-apply-btn" class="btn btn-primary btn-sm">
                        <i class="ti ti-filter"></i>
                        ${this.__('logManagement.viewer.apply')}
                    </button>
                    <button id="viewer-clear-btn" class="btn btn-ghost btn-sm">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
            </div>

            <!-- Log Lines -->
            <div class="log-viewer-lines" id="log-lines-container">
                ${this.renderLogLines(state)}
            </div>

            <!-- Pagination -->
            <div class="log-viewer-pagination">
                <span class="text-muted">${this.__('logManagement.viewer.showing', {
                    from: state.total > 0 ? ((state.page - 1) * state.perPage + 1) : 0,
                    to: Math.min(state.page * state.perPage, state.total),
                    total: state.total
                })}</span>
                <div class="pagination-buttons">
                    <button class="btn btn-sm btn-outline" id="viewer-prev" ${state.page <= 1 ? 'disabled' : ''}>
                        <i class="ti ti-chevron-left"></i>
                    </button>
                    <span class="pagination-info">${state.page} / ${state.totalPages || 1}</span>
                    <button class="btn btn-sm btn-outline" id="viewer-next" ${state.page >= state.totalPages ? 'disabled' : ''}>
                        <i class="ti ti-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // Bind viewer events
        document.getElementById('viewer-level-select')?.addEventListener('change', (e) => {
            const s = this._getFileState();
            if (s) { s.levelFilter = e.target.value; s.page = 1; }
            this.loadLogContent();
        });

        document.getElementById('viewer-apply-btn')?.addEventListener('click', () => {
            const s = this._getFileState();
            if (s) { s.search = document.getElementById('viewer-search')?.value || ''; s.page = 1; }
            this.loadLogContent();
        });

        document.getElementById('viewer-search')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const s = this._getFileState();
                if (s) { s.search = e.target.value; s.page = 1; }
                this.loadLogContent();
            }
        });

        document.getElementById('viewer-clear-btn')?.addEventListener('click', () => {
            const s = this._getFileState();
            if (s) { s.levelFilter = 'all'; s.search = ''; s.page = 1; }
            this.loadLogContent();
        });

        document.getElementById('viewer-prev')?.addEventListener('click', () => {
            const s = this._getFileState();
            if (s && s.page > 1) { s.page--; this.loadLogContent(); }
        });

        document.getElementById('viewer-next')?.addEventListener('click', () => {
            const s = this._getFileState();
            if (s && s.page < s.totalPages) { s.page++; this.loadLogContent(); }
        });

        // Click on a log line to see detail
        document.querySelectorAll('.log-line-row').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.index);
                const line = state.lines[idx];
                if (line) this.showLineDetail(line);
            });
        });
    }

    renderLogLines(state) {
        state = state || this._getFileState();
        if (!state || !state.lines || state.lines.length === 0) {
            return `<p class="text-muted text-center" style="padding:32px;">${this.__('logManagement.viewer.noLines')}</p>`;
        }

        return state.lines.map((line, idx) => {
            const levelClass = this.getLevelClass(line.level);
            const ts = line.timestamp ? `<span class="log-ts">${line.timestamp}</span>` : '';
            const levelBadge = `<span class="log-level-badge ${levelClass}">${line.level}</span>`;
            const msg = this.escapeHtml(line.message || '').substring(0, 200);
            const hasCtx = line.context ? `<i class="ti ti-code text-muted" style="font-size:12px;" title="${this.__('logManagement.viewer.jsonContext')}"></i>` : '';

            return `<div class="log-line-row ${levelClass}" data-index="${idx}">
                <span class="log-line-num">${line.line_number}</span>
                ${ts}
                ${levelBadge}
                <span class="log-msg">${msg}</span>
                ${hasCtx}
            </div>`;
        }).join('');
    }

    showLineDetail(line) {
        const rawContent = line.raw || line.message || '';
        const contextJson = line.context ? JSON.stringify(line.context, null, 2) : null;

        let content = `
            <div class="audit-detail-content">
                <div class="audit-detail-grid">
                    <div class="audit-detail-item">
                        <label>${this.__('logManagement.viewer.lineNumber')}</label>
                        <span>${line.line_number}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('logManagement.viewer.timestamp')}</label>
                        <span>${line.timestamp || '-'}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('logManagement.viewer.level')}</label>
                        <span class="log-level-badge ${this.getLevelClass(line.level)}">${line.level}</span>
                    </div>
                    <div class="audit-detail-item">
                        <label>${this.__('logManagement.viewer.message')}</label>
                        <span>${this.escapeHtml(line.message?.substring(0, 100))}</span>
                    </div>
                </div>

                <div class="audit-detail-changes">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label>${this.__('logManagement.viewer.rawContent')}</label>
                        <button class="btn btn-sm btn-ghost" id="copy-raw-btn">
                            <i class="ti ti-copy"></i> ${this.__('logManagement.viewer.copy')}
                        </button>
                    </div>
                    <pre id="log-raw-content" class="log-code-block">${this.escapeHtml(rawContent)}</pre>
                </div>

                ${contextJson ? `
                <div class="audit-detail-changes">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label>${this.__('logManagement.viewer.context')}</label>
                        <button class="btn btn-sm btn-ghost" id="copy-ctx-btn">
                            <i class="ti ti-copy"></i> ${this.__('logManagement.viewer.copy')}
                        </button>
                    </div>
                    <pre id="log-ctx-content" class="log-code-block">${this.escapeHtml(contextJson)}</pre>
                </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: `${this.__('logManagement.viewer.lineDetail')} #${line.line_number}`,
            icon: 'ti-file-text',
            content,
            size: 'lg',
            confirmText: this.__('actions.close'),
            cancelText: null,
            onConfirm: () => {}
        });

        // Bind copy buttons
        setTimeout(() => {
            document.getElementById('copy-raw-btn')?.addEventListener('click', () => {
                const text = document.getElementById('log-raw-content')?.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success(this.__('logManagement.viewer.copied'));
                });
            });
            document.getElementById('copy-ctx-btn')?.addEventListener('click', () => {
                const text = document.getElementById('log-ctx-content')?.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success(this.__('logManagement.viewer.copied'));
                });
            });
        }, 100);
    }

    // ==================== File Actions ====================

    async downloadFile(filename) {
        try {
            await this.app.api.download('/logs/download', filename, { file: filename });
        } catch (err) {
            Toast.error(this.__('logManagement.toast.downloadError'));
        }
    }

    async deleteFile(filename) {
        Modal.confirm({
            title: this.__('logManagement.confirm.deleteTitle'),
            message: this.__('logManagement.confirm.deleteMessage', { filename }),
            type: 'danger',
            onConfirm: async () => {
                try {
                    const resp = await this.app.api.post('/logs/cleanup', {
                        action: 'delete_file',
                        filename
                    });
                    if (resp.success) {
                        Toast.success(this.__('logManagement.toast.deleted'));
                        await this.loadFiles();
                    }
                } catch (err) {
                    Toast.error(err?.message || this.__('logManagement.toast.deleteError'));
                }
            }
        });
    }

    async truncateFile(filename) {
        Modal.confirm({
            title: this.__('logManagement.confirm.truncateTitle'),
            message: this.__('logManagement.confirm.truncateMessage', { filename }),
            type: 'warning',
            onConfirm: async () => {
                try {
                    const resp = await this.app.api.post('/logs/cleanup', {
                        action: 'truncate',
                        filename
                    });
                    if (resp.success) {
                        Toast.success(this.__('logManagement.toast.truncated'));
                        await this.loadFiles();
                    }
                } catch (err) {
                    Toast.error(err?.message || this.__('logManagement.toast.truncateError'));
                }
            }
        });
    }

    showCleanupDialog() {
        const content = `
            <div class="form-group">
                <label class="form-label">${this.__('logManagement.cleanup.daysLabel')}</label>
                <input type="number" id="cleanup-days" class="form-input" value="30" min="1" max="365">
                <small class="form-hint">${this.__('logManagement.cleanup.daysHint')}</small>
            </div>
            <div class="archive-info-box">
                <i class="ti ti-info-circle"></i>
                <div>
                    <p><strong>${this.__('logManagement.cleanup.protectedTitle')}</strong></p>
                    <p>${this.__('logManagement.cleanup.warning')}</p>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('logManagement.cleanup.title'),
            icon: 'ti-trash',
            content,
            size: 'sm',
            confirmText: this.__('logManagement.cleanup.confirm'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const days = parseInt(document.getElementById('cleanup-days')?.value || 30);
                try {
                    const resp = await this.app.api.post('/logs/cleanup', {
                        action: 'cleanup_old',
                        days
                    });
                    if (resp.success) {
                        Toast.success(this.__('logManagement.toast.cleanupSuccess', { count: resp.data.deleted }));
                        await this.loadFiles();
                    }
                } catch (err) {
                    Toast.error(err?.message || this.__('logManagement.toast.cleanupError'));
                }
            }
        });
    }

    // ==================== Report ====================

    async showReportDialog(filename) {
        let availableUsers = [];
        try {
            const resp = await this.app.api.get('/logs/notify-settings');
            if (resp.success && resp.data.available_users) {
                availableUsers = resp.data.available_users;
            }
        } catch (err) {
            // fallback
        }

        const userOptions = availableUsers.map(u =>
            `<div class="branch-checkbox-item">
                <input type="checkbox" name="report-recipients" value="${u.id}" id="rpt-user-${u.id}">
                <div class="branch-info">
                    <span class="branch-name">${this.escapeHtml(u.first_name + ' ' + u.last_name)}</span>
                    <span class="branch-type">${this.escapeHtml(u.email)} <span class="badge badge-info text-xs">${u.role}</span></span>
                </div>
            </div>`
        ).join('');

        const content = `
            <div class="form-group">
                <label class="form-label">${this.__('logManagement.report.file')}</label>
                <input type="text" class="form-input" value="${this.escapeHtml(filename)}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">${this.__('logManagement.report.recipients')}</label>
                <div class="branch-checkbox-list">
                    ${userOptions || '<p class="text-muted text-center" style="padding:16px;">' + this.__('logManagement.report.noUsers') + '</p>'}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">${this.__('logManagement.report.note')}</label>
                <textarea id="report-note" class="form-input" rows="3" placeholder="${this.__('logManagement.report.notePlaceholder')}"></textarea>
            </div>
            <div class="form-group">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="report-include-context" class="form-checkbox" checked>
                    <span>${this.__('logManagement.report.includeSystemInfo')}</span>
                </label>
            </div>
        `;

        Modal.show({
            title: this.__('logManagement.report.title'),
            icon: 'ti-send',
            content,
            size: 'md',
            confirmText: this.__('logManagement.report.send'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const checkboxes = document.querySelectorAll('input[name="report-recipients"]:checked');
                const recipientIds = Array.from(checkboxes).map(cb => cb.value);
                const note = document.getElementById('report-note')?.value || '';
                const includeContext = document.getElementById('report-include-context')?.checked ?? true;

                if (recipientIds.length === 0) {
                    Toast.warning(this.__('logManagement.report.selectRecipient'));
                    return;
                }

                try {
                    const resp = await this.app.api.post('/logs/send-report', {
                        filename,
                        recipient_ids: recipientIds,
                        note,
                        include_context: includeContext
                    });
                    if (resp.success) {
                        Toast.success(resp.data.message || this.__('logManagement.toast.reportSent', { count: resp.data.sent_count }));
                        if (resp.data.warnings && resp.data.warnings.length > 0) {
                            resp.data.warnings.forEach(w => Toast.warning(w));
                        }
                        if (resp.data.errors && resp.data.errors.length > 0) {
                            resp.data.errors.forEach(e => Toast.error(e));
                        }
                    }
                } catch (err) {
                    Toast.error(this.__('logManagement.toast.reportError'));
                }
            }
        });

        // Bind checkbox item click
        setTimeout(() => {
            document.querySelectorAll('.branch-checkbox-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        const cb = item.querySelector('input[type="checkbox"]');
                        if (cb) cb.checked = !cb.checked;
                    }
                    item.classList.toggle('selected', item.querySelector('input[type="checkbox"]').checked);
                });
            });
        }, 100);
    }

    // ==================== Notification Settings ====================

    async loadNotifySettings() {
        try {
            const resp = await this.app.api.get('/logs/notify-settings');
            if (resp.success) {
                this.notifySettings = resp.data;
                this.renderNotifySettings();
            }
        } catch (err) {
            document.getElementById('notify-settings-content').innerHTML =
                `<p class="text-danger">${this.__('logManagement.toast.loadError')}</p>`;
        }
    }

    renderNotifySettings() {
        const s = this.notifySettings;
        const availableUsers = s.available_users || [];

        const userCheckboxes = availableUsers.map(u => {
            const checked = (s.notify_users || []).includes(u.id) ? 'checked' : '';
            return `<div class="branch-checkbox-item ${checked ? 'selected' : ''}">
                <input type="checkbox" name="notify-users" value="${u.id}" ${checked}>
                <div class="branch-info">
                    <span class="branch-name">${this.escapeHtml(u.first_name + ' ' + u.last_name)}</span>
                    <span class="branch-type">${this.escapeHtml(u.email)} <span class="badge badge-info text-xs">${u.role}</span></span>
                </div>
            </div>`;
        }).join('');

        const logFileCheckboxes = ['app.log', 'error.log', 'audit.log', 'dynamic_render.log', 'pavo_process.log'].map(f => {
            const checked = (s.monitored_files || []).includes(f) ? 'checked' : '';
            return `<label class="flex items-center gap-2 cursor-pointer" style="margin-bottom:6px;">
                <input type="checkbox" name="monitored-files" value="${f}" class="form-checkbox" ${checked}>
                <span>${f}</span>
            </label>`;
        }).join('');

        document.getElementById('notify-settings-content').innerHTML = `
            <!-- Enable Toggle -->
            <div class="card">
                <div class="card-body">
                    <div class="notification-setting-item">
                        <div class="notification-setting-info">
                            <div class="notification-setting-icon blue">
                                <i class="ti ti-bell-ringing"></i>
                            </div>
                            <div>
                                <h4>${this.__('logManagement.notifications.enabled')}</h4>
                                <p>${this.__('logManagement.notifications.enabledDesc')}</p>
                            </div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="notify-enabled" ${s.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Settings Content -->
            <div id="notify-fields" ${!s.enabled ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6" style="margin-top:16px;">
                    <!-- Left: Trigger Settings -->
                    <div class="card">
                        <div class="card-body">
                            <h3 class="log-card-title" style="margin-bottom:16px;">
                                <i class="ti ti-bolt"></i>
                                ${this.__('logManagement.notifications.triggerTitle')}
                            </h3>

                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon rose">
                                        <i class="ti ti-alert-octagon"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('logManagement.notifications.onCritical')}</h4>
                                        <p>${this.__('logManagement.notifications.onCriticalDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="notify-critical" ${s.notify_on_critical ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon amber">
                                        <i class="ti ti-alert-triangle"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('logManagement.notifications.onError')}</h4>
                                        <p>${this.__('logManagement.notifications.onErrorDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="notify-error" ${s.notify_on_error ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon indigo">
                                        <i class="ti ti-database"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('logManagement.notifications.onSizeThreshold')}</h4>
                                        <p>${this.__('logManagement.notifications.onSizeThresholdDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="notify-size" ${s.notify_on_size_threshold ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <div class="form-grid" style="margin-top:16px;">
                                <div class="form-group">
                                    <label class="form-label">${this.__('logManagement.notifications.sizeThreshold')}</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="number" id="notify-size-mb" class="form-input" value="${s.size_threshold_mb || 50}" min="1" max="1000" style="max-width:120px;">
                                        <span class="text-muted">${this.__('logManagement.notifications.mbUnit')}</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('logManagement.notifications.cooldown')}</label>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <input type="number" id="notify-cooldown" class="form-input" value="${s.cooldown_minutes || 60}" min="5" max="1440" style="max-width:120px;">
                                        <span class="text-muted">${this.__('logManagement.notifications.minutes')}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group" style="margin-top:16px;">
                                <label class="form-label">${this.__('logManagement.notifications.monitoredFiles')}</label>
                                <div style="padding:8px 0;">
                                    ${logFileCheckboxes}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Recipients & Options -->
                    <div>
                        <div class="card" style="margin-bottom:16px;">
                            <div class="card-body">
                                <h3 class="log-card-title" style="margin-bottom:16px;">
                                    <i class="ti ti-users"></i>
                                    ${this.__('logManagement.notifications.recipientsTitle')}
                                </h3>
                                <div class="branch-checkbox-list" style="max-height:240px;">
                                    ${userCheckboxes || '<p class="text-muted text-center" style="padding:16px;">' + this.__('logManagement.report.noUsers') + '</p>'}
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-body">
                                <h3 class="log-card-title" style="margin-bottom:16px;">
                                    <i class="ti ti-settings"></i>
                                    ${this.__('logManagement.notifications.options')}
                                </h3>

                                <div class="notification-setting-item">
                                    <div class="notification-setting-info">
                                        <div class="notification-setting-icon green">
                                            <i class="ti ti-info-circle"></i>
                                        </div>
                                        <div>
                                            <h4>${this.__('logManagement.notifications.includeSystemInfo')}</h4>
                                            <p>${this.__('logManagement.notifications.includeSystemInfoDesc')}</p>
                                        </div>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="notify-system-info" ${s.include_system_info ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>

                                <div class="notification-setting-item">
                                    <div class="notification-setting-info">
                                        <div class="notification-setting-icon blue">
                                            <i class="ti ti-code"></i>
                                        </div>
                                        <div>
                                            <h4>${this.__('logManagement.notifications.includeContext')}</h4>
                                            <p>${this.__('logManagement.notifications.includeContextDesc')}</p>
                                        </div>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="notify-context" ${s.include_context ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <div style="margin-top:24px; display:flex; justify-content:flex-end;">
                    <button type="button" id="save-notify-btn" class="btn btn-primary">
                        <i class="ti ti-check"></i> ${this.__('actions.save')}
                    </button>
                </div>
            </div>
        `;

        // Toggle enabled
        document.getElementById('notify-enabled')?.addEventListener('change', (e) => {
            const fields = document.getElementById('notify-fields');
            if (fields) {
                fields.style.opacity = e.target.checked ? '1' : '0.5';
                fields.style.pointerEvents = e.target.checked ? 'auto' : 'none';
            }
        });

        // Save button
        document.getElementById('save-notify-btn')?.addEventListener('click', () => this.saveNotifySettings());

        // Checkbox item click for recipients
        document.querySelectorAll('#notify-settings-content .branch-checkbox-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const cb = item.querySelector('input[type="checkbox"]');
                    if (cb) cb.checked = !cb.checked;
                }
                item.classList.toggle('selected', item.querySelector('input[type="checkbox"]').checked);
            });
        });
    }

    async saveNotifySettings() {
        const notifyUsers = Array.from(document.querySelectorAll('input[name="notify-users"]:checked')).map(cb => cb.value);
        const monitoredFiles = Array.from(document.querySelectorAll('input[name="monitored-files"]:checked')).map(cb => cb.value);

        const data = {
            enabled: document.getElementById('notify-enabled')?.checked || false,
            notify_on_critical: document.getElementById('notify-critical')?.checked || false,
            notify_on_error: document.getElementById('notify-error')?.checked || false,
            notify_on_size_threshold: document.getElementById('notify-size')?.checked || false,
            size_threshold_mb: parseInt(document.getElementById('notify-size-mb')?.value || 50),
            cooldown_minutes: parseInt(document.getElementById('notify-cooldown')?.value || 60),
            notify_users: notifyUsers,
            monitored_files: monitoredFiles,
            include_system_info: document.getElementById('notify-system-info')?.checked || false,
            include_context: document.getElementById('notify-context')?.checked || false
        };

        try {
            const resp = await this.app.api.put('/logs/notify-settings', data);
            if (resp.success) {
                Toast.success(this.__('logManagement.toast.settingsSaved'));
            }
        } catch (err) {
            Toast.error(this.__('logManagement.toast.settingsError'));
        }
    }

    // ==================== Helpers ====================

    getTypeIcon(type) {
        const map = {
            error: 'ti-alert-circle',
            audit: 'ti-shield-check',
            api: 'ti-api',
            debug: 'ti-bug',
            integration: 'ti-plug',
            render: 'ti-photo',
            device: 'ti-device-desktop',
            general: 'ti-file-text'
        };
        return map[type] || 'ti-file-text';
    }

    getTypeColorClass(type) {
        const map = {
            error: 'rose',
            audit: 'blue',
            api: 'teal',
            debug: 'gray',
            integration: 'amber',
            render: 'purple',
            device: 'indigo',
            general: 'blue'
        };
        return map[type] || 'blue';
    }

    getTypeLabel(type) {
        return this.__(`logManagement.types.${type}`) || type;
    }

    getLevelClass(level) {
        const map = {
            CRITICAL: 'level-critical',
            ERROR: 'level-error',
            WARNING: 'level-warning',
            INFO: 'level-info',
            DEBUG: 'level-debug',
            AUDIT: 'level-audit',
            UNKNOWN: 'level-unknown'
        };
        return map[level] || 'level-unknown';
    }

    formatRelativeTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return this.__('logManagement.time.justNow');
        if (diff < 3600) return this.__('logManagement.time.minutesAgo', { count: Math.floor(diff / 60) });
        if (diff < 86400) return this.__('logManagement.time.hoursAgo', { count: Math.floor(diff / 3600) });
        if (diff < 604800) return this.__('logManagement.time.daysAgo', { count: Math.floor(diff / 86400) });
        return dateStr.split(' ')[0];
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        if (this.fileDataTable?.destroy) {
            this.fileDataTable.destroy();
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default LogManagementPage;
