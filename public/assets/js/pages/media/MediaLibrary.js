/**
 * Media Library Page Component
 * Supports both database mode and direct file browsing
 * Card/List view with DataTable, hover popup, bulk selection
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { ExportManager } from '../../utils/ExportManager.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class MediaLibraryPage {
    constructor(app) {
        this.app = app;
        this.files = [];
        this.folders = [];
        this.currentPath = null;
        this.currentFolderId = null; // Track current folder ID for breadcrumb
        this.currentFolderName = null; // Track current folder name
        this.folderStack = []; // Track folder navigation stack
        this.viewMode = localStorage.getItem('omnex_media_view') || 'grid';
        this.filterType = '';
        this.searchQuery = '';
        this.selectedFiles = new Set();
        this.browseMode = false;
        this.settings = this.loadSettings();
        this.dataTable = null;
        this.hoverPopup = null;
        this.lazyVideoThumbObserver = null;
        this.tableVideoMutationObserver = null;
        this._hoverPopupHandlersBound = false;
        this._hoverPopupMouseOverHandler = null;
        this._hoverPopupMouseMoveHandler = null;
        this._hoverPopupMouseOutHandler = null;

        // Pagination state
        this.currentPage = 1;
        this.pageSlotCount = 28;
        this.perPage = 28;
        this.totalPages = 1;
        this.totalItems = 0;
    }

    /**
     * Translation helper - uses page translations with fallback to common
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    isSuperAdmin() {
        const user = this.app?.state?.get('user');
        const role = (user?.role || '').toLowerCase();
        return role === 'superadmin';
    }

    canDeleteMedia(file) {
        if (!file || file.isFolder) {
            return false;
        }

        const isPublicMedia = Number(file.is_public || 0) === 1 || file.scope === 'public' || !file.company_id;
        if (isPublicMedia) {
            return this.isSuperAdmin();
        }

        return !this.browseMode;
    }

    canSelectMedia(item) {
        if (!item || item.isFolder) {
            return false;
        }

        if (this.browseMode) {
            return true;
        }

        return !this.isSelectionLockedMedia(item);
    }

    getSelectionRowKey(item) {
        if (!item) return null;
        if (typeof item === 'string') return item;
        return item._id || item.id || null;
    }

    findTableItemBySelectionKey(rowKey) {
        if (!rowKey) return null;

        return this.dataTable?.state?.data?.find((row) => this.getSelectionRowKey(row) === rowKey) || null;
    }

    isDeleteLockedMedia(file) {
        if (!file || file.isFolder) {
            return false;
        }

        const isPublicMedia = Number(file.is_public || 0) === 1 || file.scope === 'public' || !file.company_id;
        return isPublicMedia && !this.isSuperAdmin();
    }

    isSelectionLockedMedia(file) {
        if (this.browseMode) {
            return false;
        }

        return this.isDeleteLockedMedia(file);
    }

    normalizeSelectedFileIds(selectedRows = []) {
        const selectableIds = selectedRows
            .map((row) => this.getSelectionRowKey(row))
            .filter(Boolean)
            .filter((rowKey) => this.canSelectMedia(this.findTableItemBySelectionKey(rowKey)));

        return new Set(selectableIds);
    }

    getSelectionLockMarkup(titleText) {
        if (!titleText) return '';
        const title = this.escapeHtml(titleText);
        return `
            <span class="selection-lock-indicator" title="${title}">
                <i class="ti ti-lock"></i>
            </span>
        `;
    }

    applyListSelectionLocks() {
        if (!this.dataTable) return;

        const selectableIds = new Set();
        this.selectedFiles.forEach((rowKey) => {
            if (this.canSelectMedia(this.findTableItemBySelectionKey(rowKey))) {
                selectableIds.add(rowKey);
            }
        });
        this.selectedFiles = selectableIds;
        this.dataTable.state.selectedRows = new Set(selectableIds);

        const rowCheckboxes = this.dataTable.container.querySelectorAll('[data-table-select-row]');
        rowCheckboxes.forEach(checkbox => {
            const rowKey = checkbox.getAttribute('data-table-select-row');
            const item = this.findTableItemBySelectionKey(rowKey);
            const isLocked = item?.isFolder || this.isSelectionLockedMedia(item);
            const lockTitle = item?.isFolder ? 'Klasor secilemez' : (isLocked ? 'Silme yetkisi yok' : '');
            const cell = checkbox.closest('.data-table-td-checkbox');
            const existingIndicator = cell?.querySelector('.selection-lock-indicator');

            if (isLocked) {
                checkbox.checked = false;
                checkbox.disabled = true;
                cell?.classList.add('selection-locked');
                if (cell && !existingIndicator) {
                    cell.insertAdjacentHTML('beforeend', this.getSelectionLockMarkup(lockTitle));
                }
            } else {
                checkbox.disabled = false;
                cell?.classList.remove('selection-locked');
                existingIndicator?.remove();
            }
        });

        this.dataTable.updateSelectionCount?.();

        const selectAll = this.dataTable.container.querySelector('[data-table-select-all]');
        if (selectAll) {
            const selectableCount = (this.dataTable.state.data || []).filter((row) => this.canSelectMedia(row)).length;
            selectAll.checked = selectableCount > 0 && selectableIds.size === selectableCount;
            selectAll.indeterminate = selectableIds.size > 0 && selectableIds.size < selectableCount;
        }
    }

    getSelectedFileRecords() {
        return Array.from(this.selectedFiles)
            .map((id) => this.files.find((file) => (file.id || this.generateId(file)) === id))
            .filter(Boolean);
    }

    getSelectedDeletableFiles() {
        return this.getSelectedFileRecords().filter((file) => this.canDeleteMedia(file));
    }

    /**
     * Get translated folder name. Uses name_key from API if available, otherwise falls back to name.
     */
    getFolderDisplayName(folder) {
        if (folder.name_key) {
            // Use tc() (common-only) to avoid page translation shadowing.
            // Folder name_keys (mediaLibrary.folders.*) are always in common.json.
            const translated = this.app.i18n.tc(folder.name_key);
            // If translation found (not returning the key itself), use it
            if (translated && translated !== folder.name_key) {
                return translated;
            }
        }
        return folder.name || '';
    }

    loadSettings() {
        const defaults = {
            storageType: 'local',
            localPath: '',
            browseMode: false,
            maxFileSize: 10,
            allowImages: true,
            allowVideos: true,
            allowDocuments: true
        };
        try {
            const saved = JSON.parse(localStorage.getItem('omnex_media_settings') || '{}');
            return { ...defaults, ...saved };
        } catch {
            return defaults;
        }
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon pink">
                            <i class="ti ti-photo"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">
                                ${this.browseMode ?
                                    `${this.__('subtitle.directory')}: ${escapeHTML(this.currentPath) || this.__('subtitle.notSelected')}` :
                                    this.__('subtitle.default')}
                            </p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="scan-samples-btn" class="btn btn-outline" title="${this.__('toolbar.scanSamples')}">
                            <i class="ti ti-database-import"></i>
                            <span class="hidden md:inline">${this.__('toolbar.scanSamples')}</span>
                        </button>
                        <button id="toggle-mode-btn" class="btn ${this.browseMode ? 'btn-primary' : 'btn-outline'}" title="${this.__('toolbar.browseMode')}">
                            <i class="ti ti-folder-search"></i>
                            <span class="hidden md:inline">${this.browseMode ? this.__('toolbar.library') : this.__('toolbar.browse')}</span>
                        </button>
                        <button id="media-settings-btn" class="btn btn-ghost" title="${this.__('settings.title')}">
                            <i class="ti ti-settings"></i>
                        </button>
                        ${!this.browseMode ? `
                            <button id="upload-btn" class="btn btn-primary">
                                <i class="ti ti-upload"></i>
                                <span class="hidden md:inline">${this.__('toolbar.upload')}</span>
                            </button>
                            <input type="file" id="file-input" class="hidden" multiple accept="image/*,video/*,application/pdf">
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="card">
                <!-- Toolbar -->
                <div class="media-toolbar">
                    <div class="media-toolbar-top">
                        ${(this.currentFolderId || this.folderStack.length > 0) ? `
                            <nav class="media-breadcrumb">
                                <button id="go-back-btn" class="btn btn-sm btn-outline" title="${this.__('toolbar.parentFolder')}">
                                    <i class="ti ti-arrow-left"></i>
                                </button>
                                <ul class="breadcrumb">
                                    <li class="breadcrumb-item">
                                        <a href="#" data-folder-id="" onclick="event.preventDefault(); window.mediaPage?.goToRoot(); return false;">
                                            ${this.__('title')}
                                        </a>
                                    </li>
                                    ${this.folderStack.map((folder, index) => `
                                        <li class="breadcrumb-item">
                                            <span class="breadcrumb-separator">›</span>
                                            <a href="#" data-folder-id="${folder.id}" onclick="event.preventDefault(); window.mediaPage?.goToFolder('${folder.id}'); return false;">
                                                ${this.escapeHtml(this.getFolderDisplayName(folder))}
                                            </a>
                                        </li>
                                    `).join('')}
                                    ${this.currentFolderName ? `
                                        <li class="breadcrumb-item active">
                                            <span class="breadcrumb-separator">›</span>
                                            <span>${this.escapeHtml(this.currentFolderName)}</span>
                                        </li>
                                    ` : ''}
                                </ul>
                            </nav>
                        ` : ''}
                    </div>
                    <div class="media-toolbar-bottom">
                        <div class="media-toolbar-left">
                            <div class="media-search">
                                <i class="ti ti-search"></i>
                                <input type="text" id="media-search" class="form-control form-control-sm" placeholder="${this.__('toolbar.search')}">
                            </div>
                        </div>

                        <div class="media-toolbar-right">
                            <select id="type-filter" class="form-select form-select-sm">
                                <option value="">${this.__('filter.all')}</option>
                                <option value="image">${this.__('filter.images')}</option>
                                <option value="video">${this.__('filter.videos')}</option>
                                <option value="document">${this.__('filter.documents')}</option>
                            </select>

                            <div class="view-toggle">
                                <button id="view-grid" class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" title="${this.__('toolbar.gridView')}">
                                    <i class="ti ti-grid-dots"></i>
                                </button>
                                <button id="view-list" class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" title="${this.__('toolbar.listView')}">
                                    <i class="ti ti-list"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bulk Actions Bar -->
                <div id="bulk-actions" class="bulk-actions-bar">
                    <div class="bulk-info">
                        <i class="ti ti-checkbox"></i>
                        <span id="selected-count">0 ${this.__('bulk.selected')}</span>
                    </div>
                    <div class="bulk-actions">
                        ${!this.browseMode ? `
                            <button id="bulk-delete-btn" class="btn btn-sm btn-danger">
                                <i class="ti ti-trash"></i>
                                ${this.__('bulk.delete')}
                            </button>
                        ` : `
                            <button id="bulk-import-btn" class="btn btn-sm btn-primary">
                                <i class="ti ti-database-import"></i>
                                ${this.__('bulk.import')}
                            </button>
                        `}
                        <button id="clear-selection-btn" class="btn-clear" title="${this.__('bulk.clear')}">
                            <i class="ti ti-x"></i>
                        </button>
                    </div>
                </div>

                <!-- Media Grid/List Container -->
                <div id="media-container">
                    ${this.renderLoading()}
                </div>
            </div>

            <!-- Image Hover Popup -->
            <div id="image-hover-popup" class="image-hover-popup">
                <img src="" alt="Preview">
            </div>

            <!-- Upload Progress -->
            <div id="upload-progress" class="upload-progress hidden">
                <div class="upload-progress-info">
                    <span class="upload-progress-text">${this.__('upload.uploading')}</span>
                    <span id="upload-percent">0%</span>
                </div>
                <div class="upload-progress-bar">
                    <div id="upload-bar" class="upload-progress-bar-fill"></div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="media-grid">
                ${Array(12).fill(0).map(() => `
                    <div class="media-card skeleton">
                        <div class="media-card-preview"></div>
                        <div class="media-card-body">
                            <div class="skeleton-line w-75"></div>
                            <div class="skeleton-line w-50"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderMedia() {
        let filteredFiles = this.files;

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filteredFiles = filteredFiles.filter(f =>
                (f.name || f.original_name || '').toLowerCase().includes(q)
            );
        }

        if (this.filterType) {
            filteredFiles = filteredFiles.filter(f =>
                (f.type || f.file_type) === this.filterType
            );
        }

        if (this.viewMode === 'list') {
            return this.renderListView(filteredFiles);
        }
        return this.renderGridView(filteredFiles);
    }

    renderGridView(files) {
        let html = '<div class="media-grid">';

        // Folders
        html += this.folders.map(f => {
            const folderId = f.id || f.folder_id || '';
            const folderPath = (f.path || f.name || '').replace(/\\/g, '/'); // Normalize path
            return `
            <div class="media-card media-folder" data-folder-id="${folderId}" data-folder-path="${this.escapeHtml(folderPath)}">
                <div class="media-card-preview">
                    <i class="ti ti-folder media-folder-icon"></i>
                </div>
                <div class="media-card-body">
                    <h4 class="media-card-title">${this.escapeHtml(this.getFolderDisplayName(f))}</h4>
                    <p class="media-card-meta">${this.__('type.folder')}</p>
                </div>
            </div>
        `;
        }).join('');

        // Files
        html += files.map(f => {
            const fileId = f.id || this.generateId(f);
            const isSelected = this.selectedFiles.has(fileId);
            const selectionLocked = this.isSelectionLockedMedia(f);
            const fileType = f.type || f.file_type;
            const filePath = f.path || f.file_path;

            // Badge rengi dosya tipine göre
            const badgeClass = fileType === 'image' ? 'badge-soft-primary' :
                               fileType === 'video' ? 'badge-soft-success' : 'badge-soft-info';

            return `
                <div class="media-card ${isSelected ? 'selected' : ''}" data-file-id="${fileId}">
                    <div class="media-card-checkbox ${selectionLocked ? 'has-lock' : ''}">
                        <input type="checkbox" class="form-checkbox" data-id="${fileId}"
                            ${isSelected ? 'checked' : ''}
                            ${selectionLocked ? 'disabled' : ''}
                            onclick="${selectionLocked ? 'event.stopPropagation();' : `event.stopPropagation(); window.mediaPage?.toggleSelect('${fileId}')`}">
                        ${this.getSelectionLockMarkup(selectionLocked ? 'Silme yetkisi yok' : '')}
                    </div>
                    <button class="media-preview-btn" onclick="event.stopPropagation(); window.mediaPage?.previewFile('${fileId}')" title="${this.__('actions.preview')}">
                        <i class="ti ti-eye"></i>
                    </button>
                    <div class="media-card-preview ${fileType === 'video' ? 'media-video-preview' : ''}" onclick="window.mediaPage?.previewFile('${fileId}')">
                        ${this.renderThumbnail(f)}
                    </div>
                    <div class="media-card-body">
                        <h4 class="media-card-title">${this.escapeHtml(f.name || f.original_name)}</h4>
                        <p class="media-card-meta">${this.formatSize(f.size || f.file_size)}</p>
                        <div class="media-card-footer">
                            <span class="badge ${badgeClass}">
                                ${this.getTypeLabel(fileType)}
                            </span>
                            <div class="media-card-actions">
                                ${this.browseMode ? `
                                    <button onclick="event.stopPropagation(); window.mediaPage?.importSingleFile(window.mediaPage.files.find(x => (x.id || window.mediaPage.generateId(x)) === '${fileId}'))" class="btn btn-sm btn-ghost text-primary" title="${this.__('actions.import')}">
                                        <i class="ti ti-database-import"></i>
                                    </button>
                                ` : `
                                    <button onclick="event.stopPropagation(); window.mediaPage?.previewFile('${fileId}')" class="btn btn-sm btn-ghost text-primary" title="${this.__('actions.preview')}">
                                        <i class="ti ti-eye"></i>
                                    </button>
                                    ${this.canDeleteMedia(f) ? `
                                    <button onclick="event.stopPropagation(); window.mediaPage?.deleteFile('${f.id}')" class="btn btn-sm btn-ghost text-danger" title="${this.__('actions.delete')}">
                                        <i class="ti ti-trash"></i>
                                    </button>
                                    ` : ''}
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        html += '</div>';

        // Empty state
        if (!this.folders.length && !files.length) {
            html = `
                <div class="media-empty">
                    <i class="ti ti-photo"></i>
                    <p>${this.__('empty.title')}</p>
                    <p class="text-sm">${this.browseMode ? this.__('empty.browseHint') : this.__('empty.uploadHint')}</p>
                </div>
            `;
        } else {
            // Add pagination controls for grid view
            html += this.renderGridPagination();
        }

        return html;
    }

    /**
     * Render pagination controls for grid view
     */
    renderGridPagination() {
        if (this.totalPages <= 1) return '';

        const startItem = ((this.currentPage - 1) * this.perPage) + 1;
        const endItem = Math.min(this.currentPage * this.perPage, this.totalItems);

        return `
            <div class="media-pagination">
                <div class="media-pagination-info">
                    ${startItem}-${endItem} / ${this.totalItems} ${this.__('pagination.items')}
                </div>
                <div class="media-pagination-controls">
                    <button type="button" class="btn btn-sm btn-outline" id="media-prev-page"
                        ${this.currentPage <= 1 ? 'disabled' : ''} title="${this.__('pagination.previous')}">
                        <i class="ti ti-chevron-left"></i>
                    </button>
                    <span class="media-pagination-pages">
                        ${this.__('pagination.page') || 'Sayfa'} ${this.currentPage} / ${this.totalPages}
                    </span>
                    <button type="button" class="btn btn-sm btn-outline" id="media-next-page"
                        ${this.currentPage >= this.totalPages ? 'disabled' : ''} title="${this.__('pagination.next') || 'Sonraki'}">
                        <i class="ti ti-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderListView(files) {
        // DataTable için container
        return '<div id="media-table"></div>';
    }

    initDataTable(files) {
        const container = document.getElementById('media-table');
        if (!container) return;

        // Destroy existing
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        // Combine folders and files for table
        const tableData = [
            ...this.folders.map(f => ({
                ...f,
                isFolder: true,
                type: 'folder',
                size: null,
                created_at: null
            })),
            ...files.map(f => ({
                ...f,
                isFolder: false,
                _id: f.id || this.generateId(f)
            }))
        ];

        this.dataTable = new DataTable({
            container: '#media-table',
            toolbar: {
                show: true,
                exports: true,
                filters: true,
                onFilterClick: () => this.showFilterModal()
            },
            exportFilename: 'medya-kutuphanesi',
            exportTitle: this.__('title'),
            columns: [
                {
                    key: 'preview',
                    label: '',
                    width: '70px',
                    sortable: false,
                    render: (_, row) => {
                        const fileId = row._id || row.id;
                        if (row.isFolder) {
                            return `<div class="media-table-preview" style="cursor: pointer;" onclick="event.stopPropagation(); window.mediaPage?.openFolder('${fileId}', '${this.escapeHtml(row.path || row.name)}');">
                                <i class="ti ti-folder media-folder-icon"></i>
                            </div>`;
                        }
                        const fileType = row.type || row.file_type;
                        const filePath = row.path || row.file_path;
                        if (fileType === 'image') {
                            // Use thumbnail_url for faster loading, full URL for hover preview
                            const thumbnailUrl = row.thumbnail_url;
                            const fullUrl = row.url || this.getFileUrl(filePath);
                            const displayUrl = thumbnailUrl || fullUrl;
                            return `<div class="media-table-preview image-hover-trigger" data-src="${escapeHTML(fullUrl)}" style="cursor: pointer;" onclick="event.stopPropagation(); window.mediaPage?.previewFile('${fileId}');">
                                <img src="${escapeHTML(displayUrl)}" alt="${escapeHTML(row.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <div class="media-table-preview-placeholder" style="display:none;">
                                    <i class="ti ti-photo-x"></i>
                                </div>
                            </div>`;
                        }
                        if (fileType === 'video') {
                            const thumbnailUrl = row.thumbnail_url || row.thumbnail;
                            const url = row.url || this.getFileUrl(filePath);
                            return `<div class="media-table-preview media-video-preview" style="cursor: pointer;" onclick="event.stopPropagation(); window.mediaPage?.previewFile('${fileId}');">
                                ${this.renderHybridVideoPreview({
                                    videoUrl: url,
                                    thumbnailUrl,
                                    altText: row.name || 'Video',
                                    placeholderClass: 'media-table-preview-placeholder',
                                    iconClass: 'text-blue-500'
                                })}
                            </div>`;
                        }
                        return `<div class="media-table-preview" style="cursor: pointer;" onclick="event.stopPropagation(); window.mediaPage?.previewFile('${fileId}');"><i class="ti ti-file text-gray-400"></i></div>`;
                    }
                },
                {
                    key: 'name',
                    label: this.__('table.name'),
                    sortable: true,
                    render: (val, row) => {
                        const name = row.name || row.original_name || '-';
                        const icon = row.isFolder ? '<i class="ti ti-folder text-yellow-500 mr-2"></i>' : '';
                        return `<span class="font-medium">${icon}${this.escapeHtml(name)}</span>`;
                    }
                },
                {
                    key: 'type',
                    label: this.__('table.type'),
                    sortable: true,
                    render: (val, row) => {
                        if (row.isFolder) return this.__('type.folder');
                        return this.getTypeLabel(row.type || row.file_type);
                    }
                },
                {
                    key: 'size',
                    label: this.__('table.size'),
                    sortable: true,
                    render: (val, row) => {
                        if (row.isFolder) return '-';
                        return this.formatSize(row.size || row.file_size);
                    }
                },
                {
                    key: 'created_at',
                    label: this.__('table.date'),
                    sortable: true,
                    render: (val) => val ? this.formatDate(val) : '-'
                }
            ],
            actions: [
                {
                    name: 'preview',
                    icon: 'ti-eye',
                    label: this.__('actions.preview'),
                    class: 'btn-ghost text-primary',
                    onClick: (row) => {
                        if (row.isFolder) {
                            this.openFolder(row.id, row.path || row.name);
                        } else {
                            this.previewFile(row._id || row.id);
                        }
                    },
                    visible: () => true
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => {
                        if (!row.isFolder) {
                            this.deleteFile(row.id);
                        }
                    },
                    visible: (row) => this.canDeleteMedia(row)
                },
                {
                    name: 'import',
                    icon: 'ti-database-import',
                    label: this.__('actions.import'),
                    class: 'btn-ghost text-primary',
                    onClick: (row) => {
                        if (!row.isFolder) {
                            this.importSingleFile(row);
                        }
                    },
                    visible: (row) => !row.isFolder && this.browseMode
                }
            ],
            selectable: true,
            onSelectionChange: (selected) => {
                this.selectedFiles = this.normalizeSelectedFileIds(selected);
                this.applyListSelectionLocks();
                this.updateBulkActions();
            },
            onRowClick: (row) => {
                if (row.isFolder) {
                    this.openFolder(row.id, row.path || row.name);
                } else {
                    this.previewFile(row._id || row.id);
                }
            },
            pagination: true,
            pageSize: this.pageSlotCount,
            pageSizes: [this.pageSlotCount],
            showPageSizeSelector: false,
            emptyText: this.__('empty.title')
        });

        this.dataTable.setData(tableData);
        this.applyListSelectionLocks();
        this.initLazyVideoThumbnails(container);
        this.observeTableVideoMutations(container);

        // Setup hover popup for image thumbnails
        this.setupHoverPopup();
    }

    observeTableVideoMutations(container) {
        if (!container || typeof MutationObserver === 'undefined') return;
        if (this.tableVideoMutationObserver) {
            this.tableVideoMutationObserver.disconnect();
        }

        const body = container.querySelector('[data-table-body]');
        const cards = container.querySelector('[data-table-cards]');
        const targets = [body, cards].filter(Boolean);
        if (targets.length === 0) return;

        this.tableVideoMutationObserver = new MutationObserver(() => {
            this.applyListSelectionLocks();
            this.initLazyVideoThumbnails(container);
        });
        targets.forEach((target) => {
            this.tableVideoMutationObserver.observe(target, { childList: true, subtree: true });
        });
    }

    initLazyVideoThumbnails(root = document) {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        const wrappers = Array.from(scope.querySelectorAll('.video-thumbnail, .media-card-preview, .media-table-preview'));
        if (!wrappers.length) return;

        const getContainer = (node) => node?.closest('.video-thumbnail, .media-card-preview, .media-table-preview') || null;
        const hasReadyImage = (container) => {
            const image = container?.querySelector('img.media-thumb-image');
            return !!image && image.dataset.thumbReady === '1';
        };

        const bindThumbImage = (image) => {
            if (image.dataset.thumbBound === '1') return;
            image.dataset.thumbBound = '1';

            const src = image.dataset.thumbSrc;
            if (!src) return;

            const container = getContainer(image);
            const placeholder = container?.querySelector('.media-hybrid-placeholder, .video-placeholder, .media-card-placeholder, .media-table-preview-placeholder');
            const video = container?.querySelector('video.media-lazy-video');

            image.addEventListener('load', () => {
                image.dataset.thumbReady = '1';
                image.style.opacity = '1';
                if (video) video.style.opacity = '0';
                if (placeholder) placeholder.style.display = 'none';
            }, { once: true });

            image.addEventListener('error', () => {
                image.dataset.thumbReady = '0';
                image.style.opacity = '0';
            }, { once: true });

            image.src = src;
        };

        const activateVideo = (video) => {
            if (video.dataset.thumbBound === '1') return;
            video.dataset.thumbBound = '1';

            const src = video.dataset.src;
            if (!src) return;

            const container = getContainer(video);
            const fallback = container?.querySelector('.media-hybrid-placeholder, .video-placeholder, .media-card-placeholder, .media-table-preview-placeholder');
            const showFallback = () => {
                if (hasReadyImage(container)) return;
                video.style.opacity = '0';
                if (fallback) fallback.style.display = 'flex';
            };

            const showVideo = () => {
                if (hasReadyImage(container)) return;
                video.style.opacity = '1';
                if (fallback) fallback.style.display = 'none';
            };

            video.addEventListener('loadedmetadata', () => {
                if (video.duration && Number.isFinite(video.duration)) {
                    try {
                        video.currentTime = Math.min(1, video.duration * 0.1);
                    } catch {
                        // ignore seek errors on unsupported streams
                    }
                }
                showVideo();
            }, { once: true });

            video.addEventListener('loadeddata', showVideo, { once: true });
            video.addEventListener('error', showFallback, { once: true });
            video.src = src;
            video.preload = 'metadata';
            video.load();
        };

        wrappers.forEach((wrapper) => {
            const image = wrapper.querySelector('img.media-thumb-image[data-thumb-src]:not([data-thumb-bound=\"1\"])');
            if (image) bindThumbImage(image);
        });

        const videos = wrappers
            .map((wrapper) => wrapper.querySelector('video.media-lazy-video[data-src]:not([data-thumb-bound=\"1\"])'))
            .filter(Boolean);
        if (!videos.length) return;

        if (typeof IntersectionObserver === 'undefined') {
            videos.forEach(activateVideo);
            return;
        }

        if (!this.lazyVideoThumbObserver) {
            this.lazyVideoThumbObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        activateVideo(entry.target);
                        this.lazyVideoThumbObserver.unobserve(entry.target);
                    }
                });
            }, {
                root: null,
                rootMargin: '200px 0px',
                threshold: 0.01
            });
        }

        videos.forEach((video) => this.lazyVideoThumbObserver.observe(video));
    }

    setupHoverPopup() {
        this.hoverPopup = document.getElementById('image-hover-popup');
        if (!this.hoverPopup) return;

        const popupImg = this.hoverPopup.querySelector('img');

        if (this._hoverPopupHandlersBound) {
            return;
        }

        this._hoverPopupMouseOverHandler = (e) => {
            const trigger = e.target.closest('.image-hover-trigger');
            if (!trigger) return;

            let src = trigger.dataset.src;
            if (!src) {
                const img = trigger.querySelector('img');
                if (img) src = img.src;
            }

            if (src && popupImg) {
                popupImg.src = src;
                this.hoverPopup.classList.add('visible');
                this.positionPopup(e);
            }
        };

        this._hoverPopupMouseMoveHandler = (e) => {
            if (this.hoverPopup.classList.contains('visible')) {
                this.positionPopup(e);
            }
        };

        this._hoverPopupMouseOutHandler = (e) => {
            const trigger = e.target.closest('.image-hover-trigger');
            if (trigger) {
                this.hoverPopup.classList.remove('visible');
            }
        };

        document.addEventListener('mouseover', this._hoverPopupMouseOverHandler);
        document.addEventListener('mousemove', this._hoverPopupMouseMoveHandler);
        document.addEventListener('mouseout', this._hoverPopupMouseOutHandler);
        this._hoverPopupHandlersBound = true;
    }

    positionPopup(e) {
        if (!this.hoverPopup) return;

        const popup = this.hoverPopup;
        const padding = 20;
        let x = e.clientX + padding;
        let y = e.clientY + padding;

        // Get popup dimensions
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position
        if (x + popupRect.width > viewportWidth - padding) {
            x = e.clientX - popupRect.width - padding;
        }

        // Adjust vertical position
        if (y + popupRect.height > viewportHeight - padding) {
            y = e.clientY - popupRect.height - padding;
        }

        // Ensure minimum positions
        x = Math.max(padding, x);
        y = Math.max(padding, y);

        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
    }

    renderHybridVideoPreview({ videoUrl, thumbnailUrl, altText = 'Video', placeholderClass, iconClass = '' }) {
        const safeVideoUrl = escapeHTML(videoUrl || '');
        const safeAltText = escapeHTML(altText || 'Video');
        const safeThumbnailUrl = thumbnailUrl ? escapeHTML(thumbnailUrl) : '';
        const placeholder = placeholderClass || 'media-card-placeholder';
        const icon = iconClass ? ` ${iconClass}` : '';

        return `
            ${safeThumbnailUrl ? `<img class="media-hybrid-video-thumb media-thumb-image" data-thumb-src="${safeThumbnailUrl}" alt="${safeAltText}" loading="lazy" style="opacity:0;">` : ''}
            <video data-src="${safeVideoUrl}" class="media-hybrid-video-frame media-video-thumbnail media-lazy-video" preload="none" muted playsinline style="opacity:0;"></video>
            <div class="${placeholder} media-hybrid-placeholder" style="display:flex;">
                <i class="ti ti-video${icon}"></i>
            </div>
        `;
    }

    renderThumbnail(file, small = false) {
        const fileType = file.type || file.file_type;
        const filePath = file.path || file.file_path;

        if (fileType === 'image') {
            // Use thumbnail_url if available (much faster), otherwise use full URL
            const thumbnailUrl = file.thumbnail_url;
            const fullUrl = file.url || this.getFileUrl(filePath);
            const displayUrl = thumbnailUrl || fullUrl;

            return `<img src="${escapeHTML(displayUrl)}" alt="${escapeHTML(file.name)}" loading="lazy"
                data-full-url="${escapeHTML(fullUrl)}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="media-card-placeholder" style="display:none;">
                    <i class="ti ti-photo-x"></i>
                </div>`;
        }
        if (fileType === 'video') {
            const url = file.url || this.getFileUrl(filePath);
            const thumbnailUrl = file.thumbnail_url || file.thumbnail;
            return this.renderHybridVideoPreview({
                videoUrl: url,
                thumbnailUrl,
                altText: file.name || 'Video',
                placeholderClass: 'media-card-placeholder'
            });
        }
        return `<div class="media-card-placeholder">
            <i class="ti ti-file"></i>
        </div>`;
    }

    getFileUrl(filePath) {
        return MediaUtils.getDisplayUrl(filePath);
    }

    generateId(file) {
        const path = file.path || file.file_path || file.name;
        return btoa(unescape(encodeURIComponent(path))).replace(/[^a-zA-Z0-9]/g, '');
    }

    escapeHtml(str) {
        return escapeHTML(str);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('media');
    }

    async init() {
        window.mediaPage = this;

        if (this.settings.localPath && this.settings.browseMode) {
            this.browseMode = true;
            this.currentPath = this.settings.localPath;
        }

        await this.loadMedia();
        this.bindEvents();
        this.setupHoverPopup();
    }

    async loadMedia(folderId = null, page = 1) {
        try {
            if (this.browseMode && this.currentPath) {
                const response = await this.app.api.post('/media/browse', {
                    path: this.currentPath
                });
                this.folders = response.data?.folders || [];
                this.files = response.data?.files || [];
                this.totalItems = this.files.length;
                this.totalPages = 1;
                this.perPage = this.pageSlotCount;
            } else {
                const pageSlotCount = this.pageSlotCount || 28;

                const fetchMediaPage = async (requestedPerPage) => {
                    let url = '/media';
                    const params = new URLSearchParams();

                    if (folderId) params.append('folder_id', folderId);
                    if (this.filterType) params.append('type', this.filterType);
                    if (this.searchQuery) params.append('search', this.searchQuery);

                    params.append('page', page);
                    params.append('per_page', requestedPerPage);
                    params.append('skip_validation', '1');

                    if (params.toString()) url += '?' + params.toString();
                    const response = await this.app.api.get(url);
                    return response.data || {};
                };

                let requestedPerPage = pageSlotCount;
                let responseData = await fetchMediaPage(requestedPerPage);
                const initialFolderCount = Array.isArray(responseData?.folders) ? responseData.folders.length : 0;
                const adjustedPerPage = Math.max(1, pageSlotCount - initialFolderCount);

                // Folders are rendered as cards too, so reserve file slots accordingly.
                if (adjustedPerPage !== requestedPerPage) {
                    requestedPerPage = adjustedPerPage;
                    responseData = await fetchMediaPage(requestedPerPage);
                }

                this.folders = responseData?.folders || [];
                this.files = responseData?.files || [];

                // Update pagination state from API response
                if (responseData?.meta) {
                    this.currentPage = responseData.meta.current_page || page;
                    this.totalPages = responseData.meta.total_pages || 1;
                    this.totalItems = responseData.meta.total || this.files.length;
                    this.perPage = Number(responseData.meta.per_page || requestedPerPage);
                } else {
                    this.currentPage = page;
                    this.totalItems = this.files.length;
                    this.totalPages = 1;
                    this.perPage = requestedPerPage;
                }

                // Update current folder info from API
                if (responseData?.current_folder) {
                    const folder = responseData.current_folder;
                    this.currentFolderId = folder.id;
                    this.currentFolderName = this.getFolderDisplayName(folder);

                    // Update folder stack if needed
                    if (folder.parent_id && this.folderStack.length === 0) {
                        // Build stack from parent
                        this.buildFolderStack(folder.parent_id);
                    }
                } else if (!folderId) {
                    // Root level
                    this.currentFolderId = null;
                    this.currentFolderName = null;
                    this.folderStack = [];
                }
            }

            const container = document.getElementById('media-container');
            if (container) {
                container.innerHTML = this.renderMedia();
                // Bind folder events after render
                this.bindFolderEvents();
                // Bind pagination events
                this.bindPaginationEvents();
                // Initialize lazy video previews for current view
                this.initLazyVideoThumbnails(container);
            }

            // Update breadcrumb if needed
            this.updateBreadcrumb();

            // Initialize DataTable for list view
            if (this.viewMode === 'list') {
                let filteredFiles = this.files;
                if (this.searchQuery) {
                    const q = this.searchQuery.toLowerCase();
                    filteredFiles = filteredFiles.filter(f =>
                        (f.name || f.original_name || '').toLowerCase().includes(q)
                    );
                }
                if (this.filterType) {
                    filteredFiles = filteredFiles.filter(f =>
                        (f.type || f.file_type) === this.filterType
                    );
                }
                this.initDataTable(filteredFiles);
            }

            this.updateBulkActions();
            this.updateGridSelection();
        } catch (error) {
            Logger.error('Media load error:', error);
            Toast.error(this.__('messages.loadFailed') + ': ' + (error.message || ''));
            const container = document.getElementById('media-container');
            if (container) {
                container.innerHTML = this.renderMedia();
            }
        }
    }

    bindEvents() {
        document.getElementById('toggle-mode-btn')?.addEventListener('click', () => {
            this.toggleBrowseMode();
        });

        document.getElementById('upload-btn')?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
        });
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            this.handleUpload(e.target.files);
        });

        let searchTimeout;
        document.getElementById('media-search')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.currentPage = 1; // Reset to first page on search
                this.loadMedia(this.currentFolderId, 1);
            }, 300);
        });

        const typeFilter = document.getElementById('type-filter');
        if (typeFilter) {
            // Adjust select width based on selected option
            const adjustSelectWidth = () => {
                const selectedOption = typeFilter.options[typeFilter.selectedIndex];
                if (selectedOption) {
                    // Create a temporary span to measure text width
                    const tempSpan = document.createElement('span');
                    tempSpan.style.visibility = 'hidden';
                    tempSpan.style.position = 'absolute';
                    tempSpan.style.whiteSpace = 'nowrap';
                    tempSpan.style.fontSize = window.getComputedStyle(typeFilter).fontSize;
                    tempSpan.style.fontFamily = window.getComputedStyle(typeFilter).fontFamily;
                    tempSpan.textContent = selectedOption.text;
                    document.body.appendChild(tempSpan);
                    const textWidth = tempSpan.offsetWidth;
                    document.body.removeChild(tempSpan);
                    // Set select width (add padding for dropdown icon)
                    typeFilter.style.width = (textWidth + 60) + 'px';
                }
            };

            // Adjust on load
            adjustSelectWidth();

            // Adjust on change
            typeFilter.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                adjustSelectWidth();
                this.currentPage = 1; // Reset to first page on filter change
                this.loadMedia(this.currentFolderId, 1);
            });
        }

        document.getElementById('view-grid')?.addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('view-list')?.addEventListener('click', () => this.setViewMode('list'));

        document.getElementById('bulk-delete-btn')?.addEventListener('click', () => this.bulkDelete());
        document.getElementById('bulk-import-btn')?.addEventListener('click', () => this.bulkImport());
        document.getElementById('clear-selection-btn')?.addEventListener('click', () => this.clearSelection());

        document.getElementById('media-settings-btn')?.addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Scan samples button - scan storage/public/samples directory
        document.getElementById('scan-samples-btn')?.addEventListener('click', () => {
            this.scanSamplesDirectory();
        });

        // Back button - bound dynamically via updateBreadcrumb()

        // Bind folder events
        this.bindFolderEvents();

        // Bind pagination events
        this.bindPaginationEvents();
    }

    /**
     * Bind pagination button events
     */
    bindPaginationEvents() {
        document.getElementById('media-prev-page')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.goToPage(this.currentPage - 1);
            }
        });

        document.getElementById('media-next-page')?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.goToPage(this.currentPage + 1);
            }
        });
    }

    /**
     * Go to specific page
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        // Show loading state
        const container = document.getElementById('media-container');
        if (container) {
            container.innerHTML = this.renderLoading();
        }

        await this.loadMedia(this.currentFolderId, page);
    }

    refreshView() {
        const container = document.getElementById('media-container');
        if (!container) return;

        container.innerHTML = this.renderMedia();

        // Re-bind folder click events after render
        this.bindFolderEvents();

        // Re-bind pagination events
        this.bindPaginationEvents();
        this.initLazyVideoThumbnails(container);

        if (this.viewMode === 'list') {
            let filteredFiles = this.files;
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                filteredFiles = filteredFiles.filter(f =>
                    (f.name || f.original_name || '').toLowerCase().includes(q)
                );
            }
            if (this.filterType) {
                filteredFiles = filteredFiles.filter(f =>
                    (f.type || f.file_type) === this.filterType
                );
            }
            this.initDataTable(filteredFiles);
        }

        this.updateGridSelection();
    }

    bindFolderEvents() {
        // Folder click events - use event delegation
        const mediaContainer = document.getElementById('media-container');
        if (!mediaContainer) return;

        // Remove old listener if exists (avoid cloning which is slow)
        if (this._folderClickHandler) {
            mediaContainer.removeEventListener('click', this._folderClickHandler);
        }

        // Create bound handler
        this._folderClickHandler = (e) => {
            const folderCard = e.target.closest('.media-folder');
            if (folderCard) {
                const folderId = folderCard.dataset.folderId;
                const folderPath = folderCard.dataset.folderPath;
                if (folderId) {
                    this.openFolder(folderId, folderPath || '');
                }
            }
        };

        mediaContainer.addEventListener('click', this._folderClickHandler);
    }

    showSettingsModal() {
        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('settings.fields.defaultPath')}</label>
                    <input type="text" id="local-path" class="form-input"
                        placeholder="C:\\xampp\\htdocs\\images" value="${escapeHTML(this.settings.localPath || '')}">
                    <p class="form-hint mt-1">${this.__('settings.hints.defaultPath')}</p>
                </div>

                <div class="media-settings-info">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <h4 class="font-medium" style="color: var(--color-primary);">
                                <i class="ti ti-folder-search mr-1"></i> ${this.__('settings.scan.title')}
                            </h4>
                            <p class="text-sm" style="color: var(--color-primary); opacity: 0.8;">
                                ${this.__('settings.scan.description')}
                            </p>
                        </div>
                        <button type="button" id="scan-directory-btn" class="btn btn-sm btn-primary">
                            <i class="ti ti-refresh"></i> ${this.__('settings.scan.button')}
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('settings.fields.maxFileSize')}</label>
                    <input type="number" id="max-file-size" class="form-input"
                        value="${this.settings.maxFileSize || 10}" min="1" max="100">
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('settings.fields.allowedTypes')}</label>
                    <div class="flex flex-wrap gap-3 mt-2">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="allow-images" class="form-checkbox" ${this.settings.allowImages ? 'checked' : ''}>
                            <span>${this.__('settings.fileTypes.images')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="allow-videos" class="form-checkbox" ${this.settings.allowVideos ? 'checked' : ''}>
                            <span>${this.__('settings.fileTypes.videos')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="allow-documents" class="form-checkbox" ${this.settings.allowDocuments ? 'checked' : ''}>
                            <span>${this.__('settings.fileTypes.documents')}</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: this.__('settings.title'),
            icon: 'ti-settings',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                this.saveSettings();
            }
        });

        // Scan button event
        setTimeout(() => {
            modal.element.querySelector('#scan-directory-btn')?.addEventListener('click', async () => {
                await this.scanDirectory();
                modal.close();
            });
        }, 100);
    }

    toggleBrowseMode() {
        this.browseMode = !this.browseMode;

        if (this.browseMode) {
            if (!this.currentPath && this.settings.localPath) {
                this.currentPath = this.settings.localPath;
            }
            if (!this.currentPath) {
                Toast.info(this.__('messages.setDirectoryPath'));
                this.showSettingsModal();
                this.browseMode = false;
                return;
            }
        } else {
            this.currentPath = null;
        }

        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = this.render();
            this.loadMedia();
            this.bindEvents();
            this.setupHoverPopup();
        }
    }

    openFolder(id, path) {
        // Reset pagination when navigating to a new folder
        this.currentPage = 1;

        if (this.browseMode) {
            this.currentPath = path;
            this.loadMedia(null, 1);
            const breadcrumb = document.querySelector('.media-breadcrumb-path');
            if (breadcrumb) breadcrumb.textContent = path;
        } else {
            // Find folder info
            const folder = this.folders.find(f => (f.id || f.folder_id) === id);
            if (folder) {
                // Check if folder is already in stack (avoid duplicates)
                const existingIndex = this.folderStack.findIndex(f => f.id === (folder.id || folder.folder_id));
                if (existingIndex >= 0) {
                    // Folder already in stack, trim to this point
                    this.folderStack = this.folderStack.slice(0, existingIndex + 1);
                } else {
                    // Add to stack
                    this.folderStack.push({
                        id: folder.id || folder.folder_id,
                        name: folder.name,
                        name_key: folder.name_key || null,
                        path: folder.path
                    });
                }
                this.currentFolderId = id;
                this.currentFolderName = this.getFolderDisplayName(folder);
            }
            this.loadMedia(id, 1);
        }
    }

    goToRoot() {
        this.currentFolderId = null;
        this.currentFolderName = null;
        this.folderStack = [];
        this.currentPage = 1; // Reset pagination
        this.loadMedia(null, 1);
    }

    goToFolder(folderId) {
        // Find folder in stack
        const folderIndex = this.folderStack.findIndex(f => f.id === folderId);
        if (folderIndex >= 0) {
            // Trim stack to this folder
            this.folderStack = this.folderStack.slice(0, folderIndex + 1);
            const folder = this.folderStack[folderIndex];
            this.currentFolderId = folder.id;
            this.currentFolderName = this.getFolderDisplayName(folder);
            this.loadMedia(folderId);
        } else {
            // If not in stack, go to root
            this.goToRoot();
        }
    }

    async buildFolderStack(parentId) {
        // Build folder stack by traversing parent folders
        // This is called when we need to rebuild the stack
        // For now, we'll build it incrementally as user navigates
    }

    updateBreadcrumb() {
        // Update breadcrumb in toolbar
        const toolbar = document.querySelector('.media-toolbar');
        if (toolbar && (this.currentFolderId || this.folderStack.length > 0)) {
            const breadcrumbHtml = `
                <nav class="media-breadcrumb">
                    <button id="go-back-btn" class="btn btn-sm btn-outline" title="${this.__('toolbar.parentFolder')}">
                        <i class="ti ti-arrow-left"></i>
                    </button>
                    <ul class="breadcrumb">
                        <li class="breadcrumb-item">
                            <a href="#" data-folder-id="" onclick="event.preventDefault(); window.mediaPage?.goToRoot(); return false;">
                                ${this.__('title')}
                            </a>
                        </li>
                        ${this.folderStack.map((folder, index) => `
                            <li class="breadcrumb-item">
                                <span class="breadcrumb-separator">›</span>
                                <a href="#" data-folder-id="${folder.id}" onclick="event.preventDefault(); window.mediaPage?.goToFolder('${folder.id}'); return false;">
                                    ${this.escapeHtml(this.getFolderDisplayName(folder))}
                                </a>
                            </li>
                        `).join('')}
                        ${this.currentFolderName ? `
                            <li class="breadcrumb-item active">
                                <span class="breadcrumb-separator">›</span>
                                <span>${this.escapeHtml(this.currentFolderName)}</span>
                            </li>
                        ` : ''}
                    </ul>
                </nav>
            `;
            const toolbarTop = toolbar.querySelector('.media-toolbar-top');
            if (toolbarTop) {
                const existingBreadcrumb = toolbarTop.querySelector('.media-breadcrumb');
                if (existingBreadcrumb) {
                    existingBreadcrumb.outerHTML = breadcrumbHtml;
                } else {
                    toolbarTop.insertAdjacentHTML('afterbegin', breadcrumbHtml);
                }
                // Re-bind back button
                document.getElementById('go-back-btn')?.addEventListener('click', () => {
                    if (this.folderStack.length > 0) {
                        this.folderStack.pop();
                        if (this.folderStack.length > 0) {
                            const parentFolder = this.folderStack[this.folderStack.length - 1];
                            this.currentFolderId = parentFolder.id;
                            this.currentFolderName = this.getFolderDisplayName(parentFolder);
                            this.loadMedia(parentFolder.id);
                        } else {
                            this.currentFolderId = null;
                            this.currentFolderName = null;
                            this.loadMedia();
                        }
                    } else {
                        this.currentFolderId = null;
                        this.currentFolderName = null;
                        this.loadMedia();
                    }
                });
            }
        } else {
            // No breadcrumb - clear toolbar-top
            const toolbar = document.querySelector('.media-toolbar');
            if (toolbar) {
                const toolbarTop = toolbar.querySelector('.media-toolbar-top');
                if (toolbarTop) {
                    toolbarTop.innerHTML = '';
                }
            }
        }
    }

    goToRoot() {
        this.folderStack = [];
        this.currentFolderId = null;
        this.currentFolderName = null;
        this.currentPage = 1; // Reset pagination
        this.loadMedia(null, 1);
    }

    goToFolder(folderId) {
        if (!folderId) {
            this.goToRoot();
            return;
        }

        // Reset pagination when navigating folders
        this.currentPage = 1;

        // Find folder in stack
        const folderIndex = this.folderStack.findIndex(f => f.id === folderId);
        if (folderIndex >= 0) {
            // Navigate to folder in stack
            this.folderStack = this.folderStack.slice(0, folderIndex + 1);
            const folder = this.folderStack[folderIndex];
            this.currentFolderId = folder.id;
            this.currentFolderName = this.getFolderDisplayName(folder);
            this.loadMedia(folder.id, 1);
        } else {
            // New folder - add to stack
            const folder = this.files.find(f => f.id === folderId && f.isFolder);
            if (folder) {
                this.folderStack.push({
                    id: folder.id,
                    name: folder.name,
                    name_key: folder.name_key || null
                });
                this.currentFolderId = folder.id;
                this.currentFolderName = this.getFolderDisplayName(folder);
                this.loadMedia(folder.id, 1);
            }
        }
    }

    goToParent() {
        this.currentPage = 1; // Reset pagination
        if (this.folderStack.length > 0) {
            this.folderStack.pop();
            if (this.folderStack.length > 0) {
                const parentFolder = this.folderStack[this.folderStack.length - 1];
                this.currentFolderId = parentFolder.id;
                this.currentFolderName = this.getFolderDisplayName(parentFolder);
                this.loadMedia(parentFolder.id, 1);
            } else {
                this.goToRoot();
            }
        } else {
            this.goToRoot();
        }
    }


    previewFile(fileId) {
        const file = this.files.find(f => (f.id || this.generateId(f)) === fileId);
        if (!file) {
            Logger.error('File not found:', fileId);
            return;
        }

        const fileType = file.type || file.file_type;
        const filePath = file.path || file.file_path;
        // Use API-provided URL if available, otherwise generate from path
        const url = file.url || this.getFileUrl(filePath);

        let previewContent = '';
        if (fileType === 'image') {
            previewContent = `<img src="${escapeHTML(url)}" alt="${escapeHTML(file.name)}" class="max-w-full max-h-96 mx-auto rounded block" oncontextmenu="return false;" draggable="false">`;
        } else if (fileType === 'video') {
            previewContent = `<video src="${escapeHTML(url)}" controls class="max-w-full max-h-96 mx-auto rounded block" oncontextmenu="return false;" draggable="false"></video>`;
        } else {
            previewContent = `
                <div class="p-8 text-center">
                    <i class="ti ti-file text-6xl text-gray-400 mb-4"></i>
                    <p class="font-medium">${escapeHTML(file.name || file.original_name)}</p>
                    <a href="${escapeHTML(url)}" target="_blank" class="btn btn-primary mt-4">
                        <i class="ti ti-download"></i> ${this.__('actions.download')}
                    </a>
                </div>
            `;
        }

        // Check if file is from public/shared library
        const isPublicMedia = file.is_public === 1 || file.scope === 'public' || !file.company_id;
        
        const infoContent = `
            <div class="mb-4 flex justify-center items-center" oncontextmenu="return false;">${previewContent}</div>
            <div class="media-preview-info">
                <div class="media-preview-info-grid">
                    <div class="media-preview-info-item">
                        <span class="media-preview-info-label">${this.__('preview.fields.fileName')}</span>
                        <span class="media-preview-info-value">${escapeHTML(file.original_name || file.name)}</span>
                    </div>
                    <div class="media-preview-info-item">
                        <span class="media-preview-info-label">${this.__('preview.fields.size')}</span>
                        <span class="media-preview-info-value">${this.formatSize(file.size || file.file_size)}</span>
                    </div>
                    <div class="media-preview-info-item">
                        <span class="media-preview-info-label">${this.__('preview.fields.type')}</span>
                        <span class="media-preview-info-value">${this.getTypeLabel(fileType)}</span>
                    </div>
                    <div class="media-preview-info-item">
                        <span class="media-preview-info-label">${this.__('preview.fields.date')}</span>
                        <span class="media-preview-info-value">${this.formatDate(file.created_at)}</span>
                    </div>
                </div>
                ${!isPublicMedia ? `
                <div class="mt-3">
                    <span class="media-preview-info-label">${this.__('preview.fields.path')}</span>
                    <div class="flex gap-2 mt-1">
                        <input type="text" id="preview-url" class="form-input form-input-sm flex-1" value="${escapeHTML(filePath)}" readonly>
                        <button id="copy-url-btn" class="btn btn-sm btn-outline">
                            <i class="ti ti-copy"></i>
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        const footerContent = this.browseMode
            ? `<button type="button" class="btn btn-primary" data-action="import">
                   <i class="ti ti-database-import"></i> ${this.__('preview.actions.import')}
               </button>`
            : (this.canDeleteMedia(file)
                ? `<button type="button" class="btn btn-outline-danger" data-action="delete">
                       <i class="ti ti-trash"></i> ${this.__('preview.actions.delete')}
                   </button>`
                : '');

        const modal = Modal.show({
            title: escapeHTML(file.name || file.original_name),
            icon: fileType === 'image' ? 'ti-photo' : fileType === 'video' ? 'ti-video' : 'ti-file',
            content: infoContent,
            size: 'lg',
            showFooter: true,
            footer: `
                ${footerContent}
                <button type="button" class="btn btn-outline" data-modal-close>${this.__('modal.close')}</button>
            `
        });

        // Bind modal actions
        setTimeout(() => {
            // Prevent right-click and drag on media elements
            const mediaContainer = modal.element.querySelector('.mb-4.flex');
            if (mediaContainer) {
                mediaContainer.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    return false;
                });
                mediaContainer.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    return false;
                });
            }
            
            const img = modal.element.querySelector('img');
            if (img) {
                img.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    return false;
                });
                img.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    return false;
                });
            }
            
            const video = modal.element.querySelector('video');
            if (video) {
                video.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    return false;
                });
                video.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    return false;
                });
            }
            
            modal.element.querySelector('#copy-url-btn')?.addEventListener('click', () => {
                const urlInput = modal.element.querySelector('#preview-url');
                if (urlInput) {
                    navigator.clipboard.writeText(urlInput.value);
                    Toast.success(this.__('toast.copied'));
                }
            });

            modal.element.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                modal.close();
                await this.deleteFile(file.id);
            });

            modal.element.querySelector('[data-action="import"]')?.addEventListener('click', async () => {
                await this.importSingleFile(file);
                modal.close();
            });
        }, 100);
    }

    async importSingleFile(file) {
        try {
            await this.app.api.post('/media/scan', {
                path: file.path || file.file_path
            });
            Toast.success(this.__('toast.imported'));
        } catch (error) {
            Toast.error(this.__('messages.importFailed'));
        }
    }

    async bulkImport() {
        if (this.selectedFiles.size === 0) return;

        const selectedPaths = [];
        this.files.forEach(f => {
            const id = f.id || this.generateId(f);
            if (this.selectedFiles.has(id)) {
                selectedPaths.push(f.path || f.file_path);
            }
        });

        for (const path of selectedPaths) {
            try {
                const dir = path.substring(0, path.lastIndexOf('/')) || path.substring(0, path.lastIndexOf('\\'));
                await this.app.api.post('/media/scan', { path: dir });
                break;
            } catch (error) {
                Logger.error('Import error:', error);
            }
        }

        Toast.success(this.__('toast.bulkImported', { count: this.selectedFiles.size }));
        this.clearSelection();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('omnex_media_view', mode);

        // Update toggle buttons
        document.getElementById('view-grid')?.classList.toggle('active', mode === 'grid');
        document.getElementById('view-list')?.classList.toggle('active', mode === 'list');

        this.refreshView();
    }

    toggleSelect(id) {
        const file = this.files.find((item) => (item.id || this.generateId(item)) === id);
        if (file && !this.canSelectMedia(file)) {
            return;
        }

        if (this.selectedFiles.has(id)) {
            this.selectedFiles.delete(id);
        } else {
            this.selectedFiles.add(id);
        }
        this.updateBulkActions();
        this.updateGridSelection();
    }

    updateGridSelection() {
        if (this.viewMode !== 'grid') return;

        document.querySelectorAll('.media-card[data-file-id]').forEach(card => {
            const fileId = card.dataset.fileId;
            const isSelected = this.selectedFiles.has(fileId);
            card.classList.toggle('selected', isSelected);

            const checkbox = card.querySelector('.form-checkbox');
            if (checkbox) checkbox.checked = isSelected;
        });
    }

    clearSelection() {
        this.selectedFiles.clear();
        this.updateBulkActions();
        this.updateGridSelection();

        // Clear DataTable selection if exists
        if (this.dataTable) {
            this.dataTable.clearSelection?.();
            this.applyListSelectionLocks();
        }
    }

    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        const count = document.getElementById('selected-count');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

        if (this.selectedFiles.size > 0) {
            bulkActions?.classList.add('visible');
            if (count) count.textContent = `${this.selectedFiles.size} ${this.__('bulk.selected')}`;
            if (bulkDeleteBtn) {
                bulkDeleteBtn.disabled = this.getSelectedDeletableFiles().length === 0;
            }
        } else {
            bulkActions?.classList.remove('visible');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.disabled = false;
            }
        }
    }

    async handleUpload(files) {
        if (!files.length) return;

        const progress = document.getElementById('upload-progress');
        const bar = document.getElementById('upload-bar');
        const percent = document.getElementById('upload-percent');

        progress?.classList.remove('hidden');

        let uploaded = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                await this.app.api.upload('/media/upload', formData);
                uploaded++;
            } catch (error) {
                Toast.error(`${file.name} ${this.__('messages.uploadFailed')}`);
            }

            const p = Math.round(((i + 1) / files.length) * 100);
            if (bar) bar.style.width = p + '%';
            if (percent) percent.textContent = p + '%';
        }

        progress?.classList.add('hidden');
        if (bar) bar.style.width = '0%';

        if (uploaded > 0) {
            Toast.success(this.__('toast.uploaded', { count: uploaded }));
            await this.loadMedia();
        }

        const input = document.getElementById('file-input');
        if (input) input.value = '';
    }

    async bulkDelete() {
        if (this.selectedFiles.size === 0) return;

        const deletableFiles = this.getSelectedDeletableFiles();
        const deletableIds = deletableFiles.map((file) => file.id);
        const skippedCount = this.selectedFiles.size - deletableIds.length;

        if (deletableIds.length === 0) {
            Toast.warning(this.__('messages.deleteFailed'));
            return;
        }

        Modal.confirm({
            title: this.__('delete.bulk.title'),
            message: this.__('delete.bulk.confirm', { count: deletableIds.length }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                let deleted = 0;
                for (const id of deletableIds) {
                    try {
                        await this.app.api.delete(`/media/${id}`);
                        deleted++;
                    } catch (error) {
                        Logger.error('Delete error:', error);
                    }
                }

                this.selectedFiles.clear();
                Toast.success(this.__('toast.deleted'));
                if (skippedCount > 0) {
                    Toast.warning(`${skippedCount} oge silme yetkisi olmadigi icin atlandi`);
                }
                await this.loadMedia();
            }
        });
    }

    async deleteFile(id) {
        Modal.confirm({
            title: this.__('delete.single.title'),
            message: this.__('delete.single.confirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/media/${id}`);
                    Toast.success(this.__('toast.deleted'));
                    await this.loadMedia();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    saveSettings() {
        this.settings = {
            storageType: 'local',
            localPath: document.getElementById('local-path')?.value || '',
            maxFileSize: document.getElementById('max-file-size')?.value || 10,
            allowImages: document.getElementById('allow-images')?.checked ?? true,
            allowVideos: document.getElementById('allow-videos')?.checked ?? true,
            allowDocuments: document.getElementById('allow-documents')?.checked ?? true,
            browseMode: this.browseMode
        };

        localStorage.setItem('omnex_media_settings', JSON.stringify(this.settings));
        Toast.success(this.__('toast.settingsSaved'));

        if (this.browseMode && this.settings.localPath) {
            this.currentPath = this.settings.localPath;
            this.loadMedia();
        }
    }

    async scanDirectory() {
        const localPath = document.getElementById('local-path')?.value?.trim();

        if (!localPath) {
            Toast.error(this.__('messages.enterPath'));
            throw new Error('Validation failed');
        }

        const scanBtn = document.getElementById('scan-directory-btn');
        const originalContent = scanBtn?.innerHTML;
        if (scanBtn) {
            scanBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i>';
            scanBtn.disabled = true;
        }

        try {
            const response = await this.app.api.post('/media/scan', { path: localPath });

            if (response.success) {
                Toast.success(response.data.message || this.__('toast.scanned'));

                this.browseMode = false;
                this.currentPath = null;
                const container = document.getElementById('app-content');
                if (container) {
                    container.innerHTML = this.render();
                    await this.loadMedia();
                    this.bindEvents();
                    this.setupHoverPopup();
                }
            }
        } catch (error) {
            Toast.error(error.message || this.__('messages.scanFailed'));
            throw error;
        } finally {
            if (scanBtn) {
                scanBtn.innerHTML = originalContent;
                scanBtn.disabled = false;
            }
        }
    }

    /**
     * Scan the default samples directory (storage/public/samples)
     * This imports all media files from the public samples folder into the database
     */
    async scanSamplesDirectory() {
        const scanBtn = document.getElementById('scan-samples-btn');
        const originalContent = scanBtn?.innerHTML;

        if (scanBtn) {
            scanBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i>';
            scanBtn.disabled = true;
        }

        try {
            // Get the base path from config and construct samples path
            const basePath = window.OmnexConfig?.basePath || '';
            // Remove leading slash and construct full path
            const baseDir = basePath.replace(/^\//, '').replace(/\//g, '\\');

            // Construct the samples path - this should match the server's storage/public/samples
            // We'll send a special flag to use the default samples path
            const response = await this.app.api.post('/media/scan', {
                path: 'storage/public/samples',
                use_storage_base: true
            });

            if (response.success) {
                const data = response.data;
                const message = this.__('toast.samplesScanned', {
                    imported: data.imported || 0,
                    skipped: data.skipped || 0,
                    total: data.total_found || 0
                }) || `${data.imported} dosya aktarıldı, ${data.skipped} dosya zaten mevcut (toplam ${data.total_found} dosya bulundu)`;

                Toast.success(message);

                // Reload media library to show imported files
                await this.loadMedia();
            }
        } catch (error) {
            Logger.error('Scan samples error:', error);
            Toast.error(error.message || this.__('messages.scanFailed'));
        } finally {
            if (scanBtn) {
                scanBtn.innerHTML = originalContent;
                scanBtn.disabled = false;
            }
        }
    }

    formatSize(bytes) {
        if (!bytes) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    }

    getTypeLabel(type) {
        const types = {
            'image': this.__('type.image'),
            'video': this.__('type.video'),
            'document': this.__('type.document'),
            'folder': this.__('type.folder')
        };
        return types[type] || type || '-';
    }

    /**
     * Show advanced filter modal
     */
    showFilterModal() {
        const typeOptions = [
            { value: '', label: this.__('filter.all') },
            { value: 'image', label: this.__('filter.images') },
            { value: 'video', label: this.__('filter.videos') },
            { value: 'document', label: this.__('filter.documents') }
        ];

        const content = `
            <form id="filter-form" class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('table.type')}</label>
                    <select id="filter-type" class="form-select">
                        ${typeOptions.map(o => `<option value="${o.value}" ${this.filterType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('toolbar.search')}</label>
                    <input type="text" id="filter-search" class="form-input" value="${this.searchQuery}" placeholder="${this.__('filters.searchPlaceholder')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('filters.sizeRange')}</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <input type="number" id="filter-min-size" class="form-input" placeholder="${this.__('filters.minSize')}" min="0">
                        </div>
                        <div>
                            <input type="number" id="filter-max-size" class="form-input" placeholder="${this.__('filters.maxSize')}" min="0">
                        </div>
                    </div>
                </div>
            </form>
        `;

        Modal.show({
            title: this.__('filters.advancedFilters'),
            icon: 'ti-filter',
            content: content,
            size: 'md',
            confirmText: this.__('filters.apply'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                this.filterType = document.getElementById('filter-type')?.value || '';
                this.searchQuery = document.getElementById('filter-search')?.value || '';

                // Update the dropdown in toolbar
                const typeFilter = document.getElementById('type-filter');
                if (typeFilter) typeFilter.value = this.filterType;

                // Update search input
                const searchInput = document.getElementById('media-search');
                if (searchInput) searchInput.value = this.searchQuery;

                // Refresh view
                const container = document.getElementById('media-container');
                if (container) {
                    container.innerHTML = this.renderMedia();
                    if (this.viewMode === 'list') {
                        this.initDataTable(this.files.filter(f => {
                            let match = true;
                            if (this.filterType) match = match && (f.type || f.file_type) === this.filterType;
                            if (this.searchQuery) match = match && (f.name || f.original_name || '').toLowerCase().includes(this.searchQuery.toLowerCase());
                            return match;
                        }));
                    }
                }

                Toast.success(this.__('filters.applied'));
            }
        });
    }

    destroy() {
        window.mediaPage = null;
        if (this._hoverPopupHandlersBound) {
            document.removeEventListener('mouseover', this._hoverPopupMouseOverHandler);
            document.removeEventListener('mousemove', this._hoverPopupMouseMoveHandler);
            document.removeEventListener('mouseout', this._hoverPopupMouseOutHandler);
            this._hoverPopupHandlersBound = false;
        }
        if (this.dataTable) {
            this.dataTable.destroy();
        }
        if (this.tableVideoMutationObserver) {
            this.tableVideoMutationObserver.disconnect();
            this.tableVideoMutationObserver = null;
        }
        if (this.lazyVideoThumbObserver) {
            this.lazyVideoThumbObserver.disconnect();
            this.lazyVideoThumbObserver = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default MediaLibraryPage;
