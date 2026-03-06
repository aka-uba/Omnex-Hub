/**
 * Template List Page Component
 * Supports both grid and list (DataTable) views with bulk operations
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { ExportManager } from '../../utils/ExportManager.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class TemplateListPage {
    constructor(app) {
        this.app = app;
        this.templates = [];
        this.isLoading = true;
        this.viewMode = localStorage.getItem('template_view_mode') || 'grid';
        this.pagination = { page: 1, perPage: 20, total: 0 };
        this.dataTable = null;
        this.selectedTemplates = new Set();
        this.isSuperAdmin = (this.app.auth?.getRole() || '').toLowerCase() === 'superadmin';
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    isSharedTemplate(template) {
        return template?.scope === 'system' || template?.company_id === null;
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon purple">
                            <i class="ti ti-layout"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-outline" onclick="window.templateListPage?.showImportModal()">
                            <i class="ti ti-upload"></i>
                            <span>${this.__('import.button')}</span>
                        </button>
                        <button class="btn btn-outline" onclick="window.templateListPage?.showExportModal()">
                            <i class="ti ti-download"></i>
                            <span>${this.__('export.button')}</span>
                        </button>
                        <a href="#/templates/editor" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            <span>${this.__('addTemplate')}</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Stats & Filters -->
            <div class="card mb-6">
                <div class="templates-stats-bar">
                    <!-- Statistics Left -->
                    <div class="templates-stats-left">
                        <div class="stat-item stat-total">
                            <i class="ti ti-layout"></i>
                            <span class="stat-label">${this.__('stats.total')}:</span>
                            <span class="stat-value" id="stat-total-templates">0</span>
                        </div>
                        <div class="stat-item stat-esl">
                            <i class="ti ti-tag"></i>
                            <span class="stat-label">ESL:</span>
                            <span class="stat-value" id="stat-esl-count">0</span>
                        </div>
                        <div class="stat-item stat-signage">
                            <i class="ti ti-device-tv"></i>
                            <span class="stat-label">Signage:</span>
                            <span class="stat-value" id="stat-signage-count">0</span>
                        </div>
                        <div class="stat-item stat-tv">
                            <i class="ti ti-screen"></i>
                            <span class="stat-label">TV:</span>
                            <span class="stat-value" id="stat-tv-count">0</span>
                        </div>
                        <div class="stat-item stat-label-printer">
                            <i class="ti ti-barcode"></i>
                            <span class="stat-label">${this.__('form.types.label_printer')}:</span>
                            <span class="stat-value" id="stat-label-printer-count">0</span>
                        </div>
                    </div>

                    <!-- Filters Right -->
                    <div class="templates-stats-right">
                        <div class="template-search-wrapper">
                            <i class="ti ti-search"></i>
                            <input type="text" id="search" class="form-input" placeholder="${this.__('actions.search')}...">
                        </div>
                        <select id="type-filter" class="form-select form-select-sm">
                            <option value="">${this.__('form.types.all')}</option>
                            <option value="esl">${this.__('form.types.esl')}</option>
                            <option value="signage">${this.__('form.types.signage')}</option>
                            <option value="tv">${this.__('form.types.tv')}</option>
                            <option value="label_printer">${this.__('form.types.label_printer')}</option>
                        </select>
                        <div class="view-toggle">
                            <button id="view-grid" class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" title="${this.__('viewMode.grid')}">
                                <i class="ti ti-grid-dots"></i>
                            </button>
                            <button id="view-list" class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" title="${this.__('viewMode.list')}">
                                <i class="ti ti-list"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card card-table">

                <!-- Bulk Actions Bar -->
                <div id="bulk-actions" class="bulk-actions-bar hidden">
                    <div class="bulk-actions-left">
                        <span id="selected-count" class="bulk-actions-count">0 ${this.__('actions.selected')}</span>
                    </div>
                    <div class="bulk-actions-right">
                        <button id="bulk-export-btn" class="btn btn-sm btn-outline-primary">
                            <i class="ti ti-download"></i>
                            <span>${this.__('export.selected')}</span>
                        </button>
                        <button id="bulk-delete-btn" class="btn btn-sm btn-outline-danger">
                            <i class="ti ti-trash"></i>
                            <span>${this.__('actions.delete')}</span>
                        </button>
                        <button id="clear-selection-btn" class="btn btn-sm btn-ghost">
                            ${this.__('actions.clearSelection')}
                        </button>
                    </div>
                </div>

                <div class="card-body">
                    <!-- Grid View -->
                    <div id="grid-view" class="template-grid ${this.viewMode === 'grid' ? '' : 'hidden'}">
                        ${this.renderLoading()}
                    </div>

                    <!-- List View (DataTable) -->
                    <div id="list-view" class="${this.viewMode === 'list' ? '' : 'hidden'}">
                        <div id="templates-table"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        return Array(8).fill(0).map(() => `
            <div class="template-card skeleton">
                <div class="template-card-preview"></div>
                <div class="template-card-body">
                    <div class="skeleton-line w-75"></div>
                    <div class="skeleton-line w-50"></div>
                </div>
            </div>
        `).join('');
    }

    renderTemplates() {
        if (this.templates.length === 0) {
            return `
                <div class="template-empty">
                    <i class="ti ti-template"></i>
                    <p>${this.__('empty')}</p>
                </div>
            `;
        }

        return this.templates.map(t => {
            const aspectRatio = t.width && t.height ? (t.width / t.height) : 1;
            const isPortrait = aspectRatio < 1;
            const isSelected = this.selectedTemplates.has(t.id);
            const isShared = this.isSharedTemplate(t);
            const canEdit = this.isSuperAdmin || !isShared;

            return `
            <div class="template-card ${isSelected ? 'selected' : ''}" data-template-id="${t.id}">
                <div class="template-card-checkbox">
                    <input type="checkbox" class="form-checkbox template-checkbox"
                        data-id="${t.id}" ${isSelected ? 'checked' : ''} ${canEdit ? '' : 'disabled'}
                        onclick="${canEdit ? `event.stopPropagation(); window.templateListPage?.toggleSelect('${t.id}')` : 'event.stopPropagation();'}">
                </div>
                <div class="template-card-preview ${isPortrait ? 'portrait' : 'landscape'}">
                    ${t.thumbnail && t.thumbnail.startsWith('data:')
                        ? `<img src="${t.thumbnail}" alt="${escapeHTML(t.name)}" class="image-hover-trigger" data-template-id="${t.id}">`
                        : `<div class="template-placeholder">
                            <i class="ti ti-layout"></i>
                            <span>${t.width}×${t.height}</span>
                           </div>`
                    }
                    <button class="template-preview-btn" onclick="event.stopPropagation(); window.templateListPage?.showPreview('${t.id}')" title="${this.__('preview')}">
                        <i class="ti ti-eye"></i>
                    </button>
                </div>
                <div class="template-card-body">
                    <h3 class="template-card-title">${escapeHTML(t.name)}</h3>
                    <div class="template-card-meta">
                        <p class="template-card-size">${t.width}×${t.height}px</p>
                        ${isShared ? `<span class="badge badge-soft-purple badge-xs">${this.__('sharedBadge')}</span>` : ''}
                        ${t.type === 'label_printer' && t.is_default ? `<span class="badge badge-soft-info badge-xs">${this.__('commonBadge')}</span>` : ''}
                    </div>
                    <div class="template-card-footer">
                        <span class="badge ${t.type === 'esl' ? 'badge-soft-primary' : t.type === 'tv' ? 'badge-soft-success' : t.type === 'label_printer' ? 'badge-soft-warning' : 'badge-soft-info'}">
                            ${t.type === 'esl' ? this.__('form.types.esl') : t.type === 'tv' ? this.__('form.types.tv') : t.type === 'label_printer' ? this.__('form.types.label_printer') : this.__('form.types.signage')}
                        </span>
                        <div class="template-card-actions">
                            ${canEdit ? `
                            <a href="#/templates/${t.id}/edit" class="btn btn-sm btn-ghost text-primary" title="${this.__('actions.edit')}" onclick="event.stopPropagation()">
                                <i class="ti ti-edit"></i>
                            </a>
                            <button onclick="event.stopPropagation(); window.templateListPage?.delete('${t.id}')" class="btn btn-sm btn-ghost text-danger" title="${this.__('actions.delete')}">
                                <i class="ti ti-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    /**
     * Initialize DataTable for list view
     */
    initDataTable() {
        const container = document.getElementById('templates-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: false,
            selectable: true,
            toolbar: {
                show: true,
                exports: true,
                filters: true,
                onFilterClick: () => this.showFilterModal()
            },
            exportFilename: 'sablonlar',
            exportTitle: this.__('title'),
            onSelectionChange: (selectedIds) => {
                this.selectedTemplates = new Set(selectedIds);
                this.updateBulkActions();
            },
            onRowClick: (row) => {
                this.showPreview(row.id);
            },
            columns: [
                {
                    key: 'preview',
                    label: '',
                    width: '70px',
                    sortable: false,
                    render: (_, row) => {
                        if (row.thumbnail && row.thumbnail.startsWith('data:')) {
                            return `
                                <div class="template-table-preview image-hover-trigger" data-template-id="${row.id}">
                                    <img src="${row.thumbnail}" alt="${escapeHTML(row.name)}">
                                </div>
                            `;
                        }
                        return `
                            <div class="template-table-preview">
                                <div class="template-table-preview-placeholder">
                                    <i class="ti ti-layout"></i>
                                </div>
                            </div>
                        `;
                    }
                },
                {
                    key: 'name',
                    label: this.__('form.name'),
                    sortable: true,
                    render: (val) => `<span class="font-medium text-gray-900 dark:text-white">${escapeHTML(val)}</span>`
                },
                {
                    key: 'type',
                    label: this.__('form.type'),
                    width: '120px',
                    sortable: true,
                    render: (val, row) => {
                        const badges = {
                            esl: { class: 'badge-soft-primary', text: this.__('form.types.esl') },
                            signage: { class: 'badge-soft-info', text: this.__('form.types.signage') },
                            tv: { class: 'badge-soft-success', text: this.__('form.types.tv') },
                            label_printer: { class: 'badge-soft-warning', text: this.__('form.types.label_printer') }
                        };
                        const badge = badges[val] || { class: 'badge-soft-secondary', text: val };
                        const sharedBadge = this.isSharedTemplate(row)
                            ? `<span class="badge badge-soft-purple ml-1">${this.__('sharedBadge')}</span>`
                            : '';
                        return `<span class="badge ${badge.class}">${badge.text}</span>${sharedBadge}`;
                    }
                },
                {
                    key: 'dimensions',
                    label: this.__('table.dimensions'),
                    width: '130px',
                    sortable: false,
                    render: (_, row) => `<span class="text-muted">${row.width}×${row.height}px</span>`
                },
                {
                    key: 'orientation',
                    label: this.__('form.orientation'),
                    width: '110px',
                    sortable: true,
                    render: (val) => {
                        if (val === 'portrait') {
                            return `<span class="text-muted"><i class="ti ti-rectangle-vertical"></i> ${this.__('form.orientations.portrait')}</span>`;
                        }
                        return `<span class="text-muted"><i class="ti ti-rectangle"></i> ${this.__('form.orientations.landscape')}</span>`;
                    }
                },
                {
                    key: 'updated_at',
                    label: this.__('table.updatedAt'),
                    width: '120px',
                    sortable: true,
                    render: (val) => val ? `<span class="text-muted">${new Date(val).toLocaleDateString('tr-TR')}</span>` : '-'
                }
            ],
            actions: [
                {
                    name: 'preview',
                    icon: 'ti-eye',
                    label: this.__('preview'),
                    onClick: (row) => this.showPreview(row.id),
                    class: 'btn-ghost text-primary'
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    onClick: (row) => window.location.hash = `#/templates/${row.id}/edit`,
                    class: 'btn-ghost text-primary',
                    visible: (row) => this.isSuperAdmin || !this.isSharedTemplate(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    onClick: (row) => this.delete(row.id),
                    class: 'btn-ghost text-danger',
                    visible: (row) => this.isSuperAdmin || !this.isSharedTemplate(row)
                }
            ],
            pagination: true,
            pageSize: 20,
            searchable: false,
            emptyText: this.__('empty')
        });
    }

    /**
     * Initialize image hover preview popup
     */
    initImageHoverPreview() {
        // Create popup element if not exists
        if (!document.getElementById('image-hover-popup')) {
            const popup = document.createElement('div');
            popup.id = 'image-hover-popup';
            popup.className = 'image-hover-popup';
            popup.innerHTML = '<img src="" alt="Preview">';
            document.body.appendChild(popup);
        }

        const popup = document.getElementById('image-hover-popup');
        const popupImg = popup.querySelector('img');

        // Event delegation for hover
        document.addEventListener('mouseover', (e) => {
            const trigger = e.target.closest('.image-hover-trigger');
            if (!trigger) return;

            // Get image source
            let imgSrc = '';
            if (trigger.tagName === 'IMG') {
                imgSrc = trigger.src;
            } else {
                const img = trigger.querySelector('img');
                if (img) imgSrc = img.src;
            }

            if (!imgSrc) return;

            popupImg.src = imgSrc;
            popup.classList.add('visible');

            // Position popup
            this.positionHoverPopup(popup, trigger);
        });

        document.addEventListener('mouseout', (e) => {
            const trigger = e.target.closest('.image-hover-trigger');
            if (trigger) {
                popup.classList.remove('visible');
            }
        });

        document.addEventListener('mousemove', (e) => {
            const trigger = e.target.closest('.image-hover-trigger');
            if (trigger && popup.classList.contains('visible')) {
                this.positionHoverPopup(popup, trigger, e);
            }
        });
    }

    /**
     * Position hover popup near trigger element
     */
    positionHoverPopup(popup, trigger, event = null) {
        const rect = trigger.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();

        let left = rect.right + 10;
        let top = rect.top;

        // Check if popup goes off screen right
        if (left + popupRect.width > window.innerWidth) {
            left = rect.left - popupRect.width - 10;
        }

        // Check if popup goes off screen bottom
        if (top + popupRect.height > window.innerHeight) {
            top = window.innerHeight - popupRect.height - 10;
        }

        // Ensure popup stays on screen
        if (left < 0) left = 10;
        if (top < 0) top = 10;

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    /**
     * Toggle template selection
     */
    toggleSelect(id) {
        if (this.selectedTemplates.has(id)) {
            this.selectedTemplates.delete(id);
        } else {
            this.selectedTemplates.add(id);
        }
        this.updateBulkActions();
        this.updateGridSelection();
    }

    /**
     * Update grid view selection visual state
     */
    updateGridSelection() {
        document.querySelectorAll('.template-card').forEach(card => {
            const id = card.dataset.templateId;
            const checkbox = card.querySelector('.template-checkbox');
            if (this.selectedTemplates.has(id)) {
                card.classList.add('selected');
                if (checkbox) checkbox.checked = true;
            } else {
                card.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
            }
        });
    }

    /**
     * Update bulk actions visibility and count
     */
    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        const count = document.getElementById('selected-count');

        if (this.selectedTemplates.size > 0) {
            bulkActions?.classList.remove('hidden');
            if (count) {
                count.textContent = `${this.selectedTemplates.size} ${this.__('actions.selected')}`;
            }
        } else {
            bulkActions?.classList.add('hidden');
        }
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedTemplates.clear();
        this.updateBulkActions();
        this.updateGridSelection();
        if (this.dataTable) {
            this.dataTable.clearSelection?.();
        }
    }

    /**
     * Bulk delete selected templates
     */
    async bulkDelete() {
        if (this.selectedTemplates.size === 0) return;

        const selectedIds = Array.from(this.selectedTemplates);
        const deletableIds = selectedIds.filter(id => {
            const template = this.templates.find(t => t.id === id);
            return this.isSuperAdmin || !this.isSharedTemplate(template);
        });
        const skippedCount = selectedIds.length - deletableIds.length;

        if (deletableIds.length === 0) {
            Toast.warning(this.__('messages.sharedDeleteBlocked'));
            return;
        }

        Modal.confirm({
            title: this.__('deleteTemplate'),
            message: this.__('bulkDeleteConfirm', { count: deletableIds.length }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                let deleted = 0;
                for (const id of deletableIds) {
                    try {
                        await this.app.api.delete(`/templates/${id}`);
                        deleted++;
                    } catch (error) {
                        Logger.error('Delete error:', error);
                    }
                }

                this.selectedTemplates.clear();
                Toast.success(this.__('toast.deleted'));
                if (skippedCount > 0) {
                    Toast.warning(this.__('messages.sharedDeleteBlocked'));
                }
                await this.loadTemplates();
            }
        });
    }

    /**
     * Show template preview modal
     */
    showPreview(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const previewImage = template.thumbnail || template.preview_image;
        const aspectRatio = template.width && template.height ? (template.width / template.height) : 1;

        Modal.show({
            title: escapeHTML(template.name),
            icon: 'ti-eye',
            content: `
                <div class="template-preview-modal">
                    <div class="preview-info">
                        <span class="badge ${template.type === 'esl' ? 'badge-soft-primary' : 'badge-soft-info'}">
                            ${template.type === 'esl' ? this.__('form.types.esl') : this.__('form.types.signage')}
                        </span>
                        <span class="preview-dimensions">${template.width}×${template.height}px</span>
                    </div>
                    <div class="preview-container" style="aspect-ratio: ${aspectRatio};">
                        ${previewImage && previewImage.startsWith('data:')
                            ? `<img src="${previewImage}" alt="${escapeHTML(template.name)}">`
                            : `<div class="preview-placeholder">
                                <i class="ti ti-photo-off"></i>
                                <p>${this.__('messages.noPreview')}</p>
                               </div>`
                        }
                    </div>
                    ${template.description ? `<p class="preview-description">${escapeHTML(template.description)}</p>` : ''}
                </div>
            `,
            size: 'lg',
            showCancel: false,
            confirmText: this.__('modal.close')
        });
    }

    /**
     * Switch view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('template_view_mode', mode);

        // Update toggle buttons
        document.getElementById('view-grid')?.classList.toggle('active', mode === 'grid');
        document.getElementById('view-list')?.classList.toggle('active', mode === 'list');

        // Show/hide views
        document.getElementById('grid-view')?.classList.toggle('hidden', mode !== 'grid');
        document.getElementById('list-view')?.classList.toggle('hidden', mode !== 'list');

        // Update data in current view
        if (mode === 'grid') {
            const gridView = document.getElementById('grid-view');
            if (gridView) {
                gridView.innerHTML = this.renderTemplates();
            }
        } else if (mode === 'list' && this.dataTable) {
            this.dataTable.setData(this.templates);
        }
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('templates');
    }

    async init() {
        window.templateListPage = this;

        this.initDataTable();
        this.initImageHoverPreview();
        await this.loadTemplates();
        this.updateStats();
        this.bindEvents();
    }

    async loadTemplates() {
        try {
            const response = await this.app.api.get('/templates', {
                page: this.pagination.page,
                per_page: this.pagination.perPage
            });

            this.templates = response.data || [];
            this.pagination.total = response.meta?.total || 0;

            // Update grid view
            const gridView = document.getElementById('grid-view');
            if (gridView) {
                gridView.innerHTML = this.renderTemplates();
            }

            // Update list view
            if (this.dataTable) {
                this.dataTable.setData(this.templates);
            }

            // Update stats after loading
            this.updateStats();
        } catch (error) {
            Logger.error('Template load error:', error);
            const gridView = document.getElementById('grid-view');
            if (gridView) {
                gridView.innerHTML = this.renderTemplates();
            }
        }

        this.isLoading = false;
    }

    /**
     * Update template statistics
     */
    updateStats() {
        const total = this.templates.length;
        const eslCount = this.templates.filter(t => t.type === 'esl').length;
        const signageCount = this.templates.filter(t => t.type === 'signage').length;
        const tvCount = this.templates.filter(t => t.type === 'tv').length;
        const labelPrinterCount = this.templates.filter(t => t.type === 'label_printer').length;

        document.getElementById('stat-total-templates').textContent = total;
        document.getElementById('stat-esl-count').textContent = eslCount;
        document.getElementById('stat-signage-count').textContent = signageCount;
        document.getElementById('stat-tv-count').textContent = tvCount;
        document.getElementById('stat-label-printer-count').textContent = labelPrinterCount;
    }

    bindEvents() {
        const searchInput = document.getElementById('search');
        const typeFilter = document.getElementById('type-filter');
        const viewGridBtn = document.getElementById('view-grid');
        const viewListBtn = document.getElementById('view-list');

        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.search = e.target.value;
                this.loadTemplates();
            }, 300);
        });

        typeFilter?.addEventListener('change', (e) => {
            this.type = e.target.value;
            this.loadTemplates();
        });

        // View mode toggle
        viewGridBtn?.addEventListener('click', () => this.setViewMode('grid'));
        viewListBtn?.addEventListener('click', () => this.setViewMode('list'));

        // Bulk actions
        document.getElementById('bulk-export-btn')?.addEventListener('click', () => this.exportSelected());
        document.getElementById('bulk-delete-btn')?.addEventListener('click', () => this.bulkDelete());
        document.getElementById('clear-selection-btn')?.addEventListener('click', () => this.clearSelection());
    }

    async delete(id) {
        const template = this.templates.find(t => t.id === id);
        if (!this.isSuperAdmin && this.isSharedTemplate(template)) {
            Toast.warning(this.__('messages.sharedDeleteBlocked'));
            return;
        }

        Modal.confirm({
            title: this.__('deleteTemplate'),
            message: this.__('deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/templates/${id}`);
                    Toast.success(this.__('toast.deleted'));
                    await this.loadTemplates();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Show filter modal for templates
     */
    showFilterModal() {
        // Get current filter values from inputs
        const currentType = document.getElementById('type-filter')?.value || '';
        const currentSearch = document.getElementById('search')?.value || '';

        Modal.show({
            title: this.__('filter.title'),
            icon: 'ti-filter',
            size: 'sm',
            content: `
                <form id="template-filter-form" class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.type')}</label>
                        <select id="modal-type-filter" class="form-select">
                            <option value="">${this.__('form.types.all')}</option>
                            <option value="esl" ${currentType === 'esl' ? 'selected' : ''}>${this.__('form.types.esl')}</option>
                            <option value="signage" ${currentType === 'signage' ? 'selected' : ''}>${this.__('form.types.signage')}</option>
                            <option value="tv" ${currentType === 'tv' ? 'selected' : ''}>${this.__('form.types.tv')}</option>
                            <option value="label_printer" ${currentType === 'label_printer' ? 'selected' : ''}>${this.__('form.types.label_printer')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.orientation')}</label>
                        <select id="modal-orientation-filter" class="form-select">
                            <option value="">${this.__('form.types.all')}</option>
                            <option value="portrait">${this.__('form.orientations.portrait')}</option>
                            <option value="landscape">${this.__('form.orientations.landscape')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('actions.search')}</label>
                        <input type="text" id="modal-search-filter" class="form-input"
                               value="${escapeHTML(currentSearch)}" placeholder="${this.__('actions.search')}...">
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-outline" id="btn-clear-filters">
                    <i class="ti ti-x"></i>
                    ${this.__('actions.clearFilters')}
                </button>
                <button class="btn btn-primary" id="btn-apply-filters">
                    <i class="ti ti-check"></i>
                    ${this.__('actions.apply')}
                </button>
            `,
            showFooter: true
        });

        // Bind events
        document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
            const type = document.getElementById('modal-type-filter')?.value;
            const orientation = document.getElementById('modal-orientation-filter')?.value;
            const search = document.getElementById('modal-search-filter')?.value;

            // Update main filters
            if (document.getElementById('type-filter')) {
                document.getElementById('type-filter').value = type;
            }
            if (document.getElementById('search')) {
                document.getElementById('search').value = search;
            }

            // Apply filters
            this.type = type;
            this.orientation = orientation;
            this.search = search;
            this.loadTemplates();

            Modal.closeAll();
        });

        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            document.getElementById('modal-type-filter').value = '';
            document.getElementById('modal-orientation-filter').value = '';
            document.getElementById('modal-search-filter').value = '';
        });
    }

    /**
     * Show export modal with options
     */
    showExportModal() {
        const hasSelection = this.selectedTemplates.size > 0;

        Modal.show({
            title: this.__('export.title'),
            icon: 'ti-download',
            size: 'sm',
            content: `
                <div class="export-modal-content">
                    <div class="form-group">
                        <label class="form-label">${this.__('export.selectMode')}</label>
                        <div class="radio-group">
                            <label class="radio-option ${hasSelection ? '' : 'disabled'}">
                                <input type="radio" name="export-mode" value="selected" ${hasSelection ? 'checked' : 'disabled'}>
                                <span class="radio-label">
                                    <i class="ti ti-checkbox"></i>
                                    ${this.__('export.selectedOnly')}
                                    ${hasSelection ? `<span class="text-muted">(${this.selectedTemplates.size})</span>` : ''}
                                </span>
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="export-mode" value="all" ${!hasSelection ? 'checked' : ''}>
                                <span class="radio-label">
                                    <i class="ti ti-layout"></i>
                                    ${this.__('export.allTemplates')}
                                    <span class="text-muted">(${this.templates.length})</span>
                                </span>
                            </label>
                        </div>
                    </div>
                    <div class="export-info mt-4">
                        <div class="alert alert-info">
                            <i class="ti ti-info-circle"></i>
                            <span>${this.__('export.infoText')}</span>
                        </div>
                    </div>
                </div>
            `,
            confirmText: this.__('export.download'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                const mode = document.querySelector('input[name="export-mode"]:checked')?.value;
                await this.executeExport(mode);
            }
        });
    }

    /**
     * Execute export based on selected mode
     */
    async executeExport(mode) {
        try {
            let url = '/templates/export?format=file';

            if (mode === 'selected' && this.selectedTemplates.size > 0) {
                const ids = Array.from(this.selectedTemplates).join(',');
                url += `&ids=${ids}`;
            } else {
                url += '&all=true';
            }

            // Download file
            await this.app.api.download(url, `templates_export_${new Date().toISOString().slice(0,10)}.json`);
            Toast.success(this.__('export.success'));
        } catch (error) {
            Logger.error('Export error:', error);
            Toast.error(this.__('export.error'));
            throw error;
        }
    }

    /**
     * Export selected templates (bulk action)
     */
    async exportSelected() {
        if (this.selectedTemplates.size === 0) {
            Toast.warning(this.__('export.noSelection'));
            return;
        }
        await this.executeExport('selected');
    }

    /**
     * Show import modal with file upload
     */
    showImportModal() {
        Modal.show({
            title: this.__('import.title'),
            icon: 'ti-upload',
            size: 'md',
            content: `
                <div class="import-modal-content">
                    <div class="form-group">
                        <label class="form-label">${this.__('import.selectFile')}</label>
                        <div class="file-upload-zone" id="import-drop-zone">
                            <input type="file" id="import-file-input" accept=".json" class="hidden">
                            <div class="file-upload-content">
                                <i class="ti ti-cloud-upload"></i>
                                <p>${this.__('import.dragDrop')}</p>
                                <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('import-file-input').click()">
                                    ${this.__('import.browse')}
                                </button>
                            </div>
                            <div class="file-selected hidden" id="selected-file-info">
                                <i class="ti ti-file-code"></i>
                                <span id="selected-file-name"></span>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="window.templateListPage?.clearImportFile()">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="form-group mt-4">
                        <label class="form-label">${this.__('import.options')}</label>
                        <div class="checkbox-group">
                            <label class="checkbox-option">
                                <input type="checkbox" id="import-add-suffix" checked>
                                <span>${this.__('import.addSuffix')}</span>
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" id="import-overwrite">
                                <span>${this.__('import.overwrite')}</span>
                            </label>
                            <label class="checkbox-option">
                                <input type="checkbox" id="import-skip-existing">
                                <span>${this.__('import.skipExisting')}</span>
                            </label>
                        </div>
                    </div>

                    <div id="import-preview" class="import-preview hidden mt-4">
                        <h4 class="text-sm font-medium mb-2">${this.__('import.preview')}</h4>
                        <div id="import-preview-content" class="import-preview-content"></div>
                    </div>
                </div>
            `,
            confirmText: this.__('import.start'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.executeImport();
            }
        });

        // Bind events after modal opens
        setTimeout(() => {
            this.bindImportEvents();
        }, 100);
    }

    /**
     * Bind import modal events
     */
    bindImportEvents() {
        const fileInput = document.getElementById('import-file-input');
        const dropZone = document.getElementById('import-drop-zone');

        // File input change
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files?.length > 0) {
                this.handleImportFile(e.target.files[0]);
            }
        });

        // Drag and drop
        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files?.length > 0) {
                this.handleImportFile(e.dataTransfer.files[0]);
            }
        });

        // Option checkboxes - mutual exclusivity
        const overwriteCheckbox = document.getElementById('import-overwrite');
        const skipCheckbox = document.getElementById('import-skip-existing');
        const suffixCheckbox = document.getElementById('import-add-suffix');

        overwriteCheckbox?.addEventListener('change', () => {
            if (overwriteCheckbox.checked) {
                skipCheckbox.checked = false;
                suffixCheckbox.checked = false;
            }
        });

        skipCheckbox?.addEventListener('change', () => {
            if (skipCheckbox.checked) {
                overwriteCheckbox.checked = false;
                suffixCheckbox.checked = false;
            }
        });

        suffixCheckbox?.addEventListener('change', () => {
            if (suffixCheckbox.checked) {
                overwriteCheckbox.checked = false;
                skipCheckbox.checked = false;
            }
        });
    }

    /**
     * Handle selected import file
     */
    async handleImportFile(file) {
        if (!file.name.endsWith('.json')) {
            Toast.error(this.__('import.invalidFormat'));
            return;
        }

        this.importFile = file;

        // Show file info
        document.querySelector('.file-upload-content')?.classList.add('hidden');
        document.getElementById('selected-file-info')?.classList.remove('hidden');
        document.getElementById('selected-file-name').textContent = file.name;

        // Parse and preview
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            this.showImportPreview(data);
        } catch (error) {
            Toast.error(this.__('import.parseError'));
        }
    }

    /**
     * Show import preview
     */
    showImportPreview(data) {
        const previewContainer = document.getElementById('import-preview');
        const previewContent = document.getElementById('import-preview-content');

        if (!previewContainer || !previewContent) return;

        const templates = data.templates || (data.name && data.design_data ? [data] : []);

        if (templates.length === 0) {
            previewContent.innerHTML = `
                <div class="alert alert-warning">
                    <i class="ti ti-alert-triangle"></i>
                    ${this.__('import.noTemplates')}
                </div>
            `;
        } else {
            previewContent.innerHTML = `
                <div class="import-summary">
                    <div class="import-summary-stat">
                        <span class="import-summary-value">${templates.length}</span>
                        <span class="import-summary-label">${this.__('import.templatesFound')}</span>
                    </div>
                </div>
                <div class="import-template-list">
                    ${templates.slice(0, 5).map(t => `
                        <div class="import-template-item">
                            <i class="ti ti-layout"></i>
                            <span class="template-name">${escapeHTML(t.name || this.__('editor.messages.unnamed'))}</span>
                            <span class="template-type badge badge-soft-primary">${escapeHTML(t.type || 'esl')}</span>
                            <span class="template-size text-muted">${t.width || 800}×${t.height || 1280}</span>
                        </div>
                    `).join('')}
                    ${templates.length > 5 ? `
                        <div class="import-template-more text-muted">
                            +${templates.length - 5} ${this.__('import.more')}...
                        </div>
                    ` : ''}
                </div>
            `;
        }

        previewContainer.classList.remove('hidden');
    }

    /**
     * Clear import file selection
     */
    clearImportFile() {
        this.importFile = null;
        document.getElementById('import-file-input').value = '';
        document.querySelector('.file-upload-content')?.classList.remove('hidden');
        document.getElementById('selected-file-info')?.classList.add('hidden');
        document.getElementById('import-preview')?.classList.add('hidden');
    }

    /**
     * Execute import
     */
    async executeImport() {
        if (!this.importFile) {
            Toast.error(this.__('import.noFile'));
            throw new Error('No file selected');
        }

        const addSuffix = document.getElementById('import-add-suffix')?.checked;
        const overwrite = document.getElementById('import-overwrite')?.checked;
        const skipExisting = document.getElementById('import-skip-existing')?.checked;

        try {
            const formData = new FormData();
            formData.append('file', this.importFile);

            let url = '/templates/import?';
            if (addSuffix) url += 'add_suffix=true&';
            if (overwrite) url += 'overwrite=true&';
            if (skipExisting) url += 'skip_existing=true&';

            const response = await this.app.api.upload(url, formData);

            if (response.success) {
                const results = response.data.results;
                Toast.success(
                    this.__('import.success', {
                        imported: results.imported,
                        skipped: results.skipped,
                        failed: results.failed
                    })
                );
                await this.loadTemplates();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            Logger.error('Import error:', error);
            Toast.error(this.__('import.error'));
            throw error;
        }
    }

    destroy() {
        window.templateListPage = null;
        // Remove hover popup
        const popup = document.getElementById('image-hover-popup');
        if (popup) popup.remove();
        this.app.i18n.clearPageTranslations();
    }
}

export default TemplateListPage;
